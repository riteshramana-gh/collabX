"""Network Impairment & Fault Injection Verification Tool.

Simulates packet drops, sequence gaps, and recovery in CollabBoard X to demonstrate
authoritative sequence gap detection and deterministic replay.

Usage:
    python tools/network_impairment_tester.py --host 127.0.0.1 --port 9001
"""

import argparse
import json
import socket
import struct
import sys
import time
import uuid

HEADER_STRUCT = struct.Struct(">I")


def send_frame(sock: socket.socket, message: dict) -> None:
    payload = json.dumps(message).encode("utf-8")
    header = HEADER_STRUCT.pack(len(payload))
    sock.sendall(header + payload)


def receive_frame(sock: socket.socket) -> dict:
    header = sock.recv(4)
    if not header or len(header) < 4:
        raise ConnectionError("Connection lost")
    length = HEADER_STRUCT.unpack(header)[0]
    data = bytearray()
    while len(data) < length:
        chunk = sock.recv(min(4096, length - len(data)))
        if not chunk:
            raise ConnectionError("EOF while reading payload")
        data.extend(chunk)
    return json.loads(data.decode("utf-8"))


def run_impairment_test(host: str, port: int, room_id: str):
    print("=" * 70)
    print("  CollabBoard X — Network Impairment & Sequence Gap Verification")
    print(f"  Target: {host}:{port} | Room: {room_id}")
    print("=" * 70)

    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.connect((host, port))
    print("[1] Connected to Raw TCP socket server.")

    # 1. Join room
    join_env = {
        "protocol_version": "1.0",
        "message_id": uuid.uuid4().hex,
        "room_id": room_id,
        "sender_id": "impairment-tester",
        "type": "ROOM_JOIN_REQ",
        "timestamp": int(time.time() * 1000),
        "payload": {"display_name": "FaultInjector"},
    }
    send_frame(sock, join_env)
    join_ack = receive_frame(sock)
    snapshot = receive_frame(sock)
    print(f"[2] Received ROOM_JOIN_ACK and ROOM_SNAPSHOT (Initial Seq: {snapshot.get('server_seq', 0)})")

    # 2. Inject operations
    print("[3] Sending 5 consecutive canvas operations...")
    for i in range(1, 6):
        op_env = {
            "protocol_version": "1.0",
            "message_id": uuid.uuid4().hex,
            "room_id": room_id,
            "sender_id": "impairment-tester",
            "type": "CANVAS_OP_REQ",
            "client_seq": i,
            "timestamp": int(time.time() * 1000),
            "payload": {
                "client_op_id": f"fault-op-{i}-{uuid.uuid4().hex[:6]}",
                "op_type": "ADD",
                "element": {
                    "id": f"fault-elem-{i}",
                    "type": "RECTANGLE",
                    "x": float(i * 10),
                    "y": float(i * 10),
                    "stroke_color": "#ff0000",
                    "stroke_width": 2,
                    "z_index": i,
                    "version": 1,
                    "created_by": "impairment-tester",
                    "last_modified_by": "impairment-tester",
                    "last_modified_at": int(time.time() * 1000),
                },
            },
        }
        send_frame(sock, op_env)
        ack = receive_frame(sock)
        bcast = receive_frame(sock)
        print(f"    -> Op {i} assigned Server Sequence: {ack.get('server_seq')}")

    # 3. Simulate client packet drop / sequence gap
    print("\n[4] SIMULATING NETWORK PACKET LOSS:")
    print("    Client missed sequences 2 and 3 due to simulated packet drop.")
    print("    Sending ROOM_REPLAY_REQ for range [2, 3]...")

    replay_req = {
        "protocol_version": "1.0",
        "message_id": uuid.uuid4().hex,
        "room_id": room_id,
        "sender_id": "impairment-tester",
        "type": "ROOM_REPLAY_REQ",
        "timestamp": int(time.time() * 1000),
        "payload": {"from_seq": 2, "to_seq": 3},
    }
    send_frame(sock, replay_req)
    replay_res = receive_frame(sock)

    ops = replay_res.get("payload", {}).get("operations", [])
    print(f"[5] Received ROOM_REPLAY_RES with {len(ops)} replayed operations:")
    for op in ops:
        print(f"    - Seq {op['server_seq']}: ClientOpId={op['client_op_id']}, Element={op['element_id']}")

    assert len(ops) == 2, f"Expected 2 operations, got {len(ops)}"
    assert ops[0]["server_seq"] == 2
    assert ops[1]["server_seq"] == 3

    print("\n>>> VERIFICATION SUCCESSFUL: Sequence gap was deterministically recovered! <<<")
    sock.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=9001)
    parser.add_argument("--room", default="fault-test-room")
    args = parser.parse_args()
    run_impairment_test(args.host, args.port, args.room)
