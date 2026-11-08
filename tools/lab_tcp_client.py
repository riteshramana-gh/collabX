"""Computer Networks Laboratory - Explicit Raw TCP Socket Client.

This script demonstrates low-level socket programming using Python's standard `socket` module.
It connects to CollabBoard X's explicit TCP socket listener (default port 9001), encodes
messages with a 4-byte big-endian length prefix, sends them over a raw TCP stream, and decodes responses.

Usage:
    python tools/lab_tcp_client.py --host 127.0.0.1 --port 9001 --room test-room
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
    """Serializes a JSON message, prefixes with 4-byte big-endian length, and sends over TCP socket."""
    payload = json.dumps(message).encode("utf-8")
    length_header = HEADER_STRUCT.pack(len(payload))
    sock.sendall(length_header + payload)
    print(f"\n[TX Raw Socket] Sent {len(payload)} bytes payload (+ 4 bytes header):")
    print(f"    Type: {message.get('type')}")
    print(f"    Payload: {json.dumps(message, indent=2)}")


def receive_frame(sock: socket.socket) -> dict:
    """Reads the 4-byte length prefix from raw TCP socket, then reads exactly that many bytes of JSON."""
    header = sock.recv(4)
    if not header or len(header) < 4:
        raise ConnectionError("Socket closed while awaiting frame header")

    payload_len = HEADER_STRUCT.unpack(header)[0]
    data = bytearray()
    while len(data) < payload_len:
        chunk = sock.recv(min(4096, payload_len - len(data)))
        if not chunk:
            raise ConnectionError("Socket closed during payload transmission")
        data.extend(chunk)

    message = json.loads(data.decode("utf-8"))
    print(f"\n[RX Raw Socket] Received {payload_len} bytes:")
    print(f"    Type: {message.get('type')}")
    print(f"    Payload: {json.dumps(message, indent=2)}")
    return message


def main():
    parser = argparse.ArgumentParser(description="CollabBoard X Raw TCP Socket Laboratory Client")
    parser.add_argument("--host", default="127.0.0.1", help="Server host IP")
    parser.add_argument("--port", type=int, default=9001, help="Server TCP socket port")
    parser.add_argument("--room", default="cn-lab-room-1", help="Target Room ID")
    parser.add_argument("--name", default="LabStudent", help="Participant display name")
    args = parser.parse_args()

    client_id = f"lab-client-{uuid.uuid4().hex[:8]}"
    print("=" * 70)
    print("  CollabBoard X - Explicit TCP Socket Laboratory Demonstration")
    print("  Computer Networks Laboratory Evaluation Tool")
    print(f"  Target: {args.host}:{args.port}")
    print(f"  Client ID: {client_id}")
    print("=" * 70)

    try:
        # Create standard BSD stream socket (AF_INET, SOCK_STREAM)
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        print(f"Connecting raw socket to {args.host}:{args.port}...")
        sock.connect((args.host, args.port))
        print("Connected successfully via raw TCP socket.")

        # Test 1: Send Ping Request
        ping_envelope = {
            "protocol_version": "1.0",
            "message_id": uuid.uuid4().hex,
            "room_id": args.room,
            "sender_id": client_id,
            "type": "PING_REQ",
            "client_seq": 1,
            "timestamp": int(time.time() * 1000),
            "payload": {
                "display_name": args.name,
                "client_type": "RAW_TCP_SOCKET_LAB",
            },
        }

        send_frame(sock, ping_envelope)
        response = receive_frame(sock)

        if response.get("type") == "PONG_RES":
            print("\n>>> PING/PONG SUCCESSFUL: Raw socket communication verified! <<<")

        sock.close()
        print("\nSocket connection closed cleanly.")

    except Exception as e:
        print(f"\nSocket error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
