# Computer Networks Laboratory: Socket Programming & Protocol Analysis Guide

**Subject:** Computer Networks Laboratory  
**Project:** CollabBoard X — Explicit Socket Programming & Authoritative Synchronization  
**Focus:** Layer 4 (TCP Transport) to Layer 7 (Application Protocol Framing & Synchronization)

---

## 1. Laboratory Objectives

1. Demonstrate explicit BSD socket programming in Python (`socket.socket(AF_INET, SOCK_STREAM)` and `asyncio.start_server`).
2. Implement and verify **Application-Layer Framing** over continuous byte streams using a 4-byte big-endian length prefix.
3. Observe and analyze TCP connection lifecycles (3-way handshake, stream framing, buffering, clean teardown) using **Wireshark**.
4. Test network fault tolerance: simulate packet loss, sequence gaps, and demonstrate deterministic state recovery using monotonic sequence numbers.

---

## 2. Low-Level Socket & Framing Specification

### 2.1 The TCP Streaming Problem
TCP is a byte-stream transport protocol without native record or message boundaries. Consecutive calls to `sock.send()` may be bundled into a single TCP segment (Nagle's algorithm) or fragmented across multiple MTU boundaries.

### 2.2 Length-Prefixed Protocol Frame Format
To solve message framing over raw TCP, CollabBoard X enforces a strict 4-byte header:

```
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|               Payload Length N (Big-Endian uint32)            |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                                                               |
+                    Payload Data (N Bytes UTF-8 JSON)          +
|                                                               |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
```

- **Header:** 4 bytes unsigned integer (`struct.pack('>I', len(payload))`).
- **Payload:** UTF-8 encoded JSON `MessageEnvelope`.
- **Maximum Frame Size:** 10 MB (enforced by `StreamFramer` to prevent buffer overflow attacks).

---

## 3. Laboratory Execution Steps

### Step 1: Start the CollabBoard X Server
Run the unified server in standalone or background mode:
```powershell
py standalone_host.py --port 8000 --tcp-port 9001 --room lab-demo
```
Verify the server output confirms:
- Raw TCP Socket Server listening on `0.0.0.0:9001`
- Web Application listening on `0.0.0.0:8000`

---

### Step 2: Wireshark Packet Capture Setup

1. Open **Wireshark**.
2. Select your loopback or local LAN adapter (`Adapter for loopback traffic capture` on Windows or `lo` on Linux).
3. Set the capture filter:
   ```text
   tcp.port == 9001
   ```
4. Click **Start Capture**.

---

### Step 3: Run the Explicit Socket Client

In a separate terminal, run the laboratory client script:
```powershell
py tools/lab_tcp_client.py --host 127.0.0.1 --port 9001 --room lab-demo --name LabStudent
```

**Expected Terminal Output:**
```text
======================================================================
  CollabBoard X - Explicit TCP Socket Laboratory Demonstration
  Computer Networks Laboratory Evaluation Tool
  Target: 127.0.0.1:9001
======================================================================
Connecting raw socket to 127.0.0.1:9001...
Connected successfully via raw TCP socket.

[TX Raw Socket] Sent 168 bytes payload (+ 4 bytes header):
    Type: PING_REQ
    ...

[RX Raw Socket] Received 142 bytes:
    Type: PONG_RES
    ...

>>> PING/PONG SUCCESSFUL: Raw socket communication verified! <<<
Socket connection closed cleanly.
```

---

### Step 4: Run Fault Injection & Gap Recovery Verification

Run the network impairment tester to simulate packet loss and verify sequence gap recovery:
```powershell
py tools/network_impairment_tester.py --host 127.0.0.1 --port 9001 --room fault-demo
```

**What this verifies:**
1. Sequence number assignment: Operations 1 through 5 are assigned monotonic sequence numbers $1, 2, 3, 4, 5$.
2. Simulated packet drop: The client drops packets 2 and 3.
3. Gap request: The client detects missing sequence numbers and sends `ROOM_REPLAY_REQ` for range $[2, 3]$.
4. Replay recovery: The server reads operations 2 and 3 from SQLite and retransmits them in order without state loss.

---

## 4. Wireshark Packet Inspection Checklist for Examiners

| Packet # | Protocol | Flags | Explanation |
|---|---|---|---|
| **1** | TCP | `[SYN]` | Client initiates connection to server port 9001. |
| **2** | TCP | `[SYN, ACK]` | Server acknowledges and agrees to connect. |
| **3** | TCP | `[ACK]` | 3-way handshake established. |
| **4** | TCP | `[PSH, ACK]` | Client sends 4-byte length header + JSON payload. Inspect hex bytes: first 4 bytes indicate length. |
| **5** | TCP | `[PSH, ACK]` | Server responds with length-prefixed `PONG_RES` or `ROOM_SNAPSHOT`. |
| **6-7**| TCP | `[FIN, ACK]` | Graceful socket termination sequence. |

---

## 5. Lab Submission Summary

- **Source Code Files for Socket Grading:**
  - `backend/app/transport/raw_tcp_server.py`: Low-level TCP listener and streaming worker.
  - `backend/app/transport/framing.py`: Length prefix packing, unpacking, and stream buffering.
  - `backend/app/transport/session.py`: `RawTCPSession` implementing length-prefixed stream writes.
  - `tools/lab_tcp_client.py`: Client script demonstrating BSD socket calls.
