"""Standalone Launcher for CollabBoard X (Host Fallback Mode).

Discovers active LAN IP without internet, prints connection banner and ASCII QR code,
and launches the unified FastAPI and TCP socket backend server.
"""

import argparse
import sys
import uvicorn
from app.launcher.lan_detector import get_lan_ip
from app.launcher.qr_generator import generate_ascii_qr
from app.core.config import get_settings


def print_banner(lan_ip: str, http_port: int, tcp_port: int, room_id: str) -> None:
    board_url = f"http://{lan_ip}:{http_port}/?room={room_id}"
    qr_ascii = generate_ascii_qr(board_url)

    line = "=" * 70
    print("\n" + line)
    print("      COLLABBOARD X — STANDALONE LAN HOST SERVER LAUNCHER")
    print(line)
    print(f"  * Host LAN IP:          {lan_ip}")
    print(f"  * Web Application:      http://{lan_ip}:{http_port}")
    print(f"  * Direct Board Link:    {board_url}")
    print(f"  * Raw TCP Socket Port:  {tcp_port} (Computer Networks Lab)")
    print(f"  * Initial Room ID:      {room_id}")
    print(line)
    print("\n  SCAN THIS QR CODE ON PHONES / TABLETS ON THE SAME LAN WIFI:\n")
    print(qr_ascii)
    print(line)
    print("  Server is listening on all local interfaces (0.0.0.0).")
    print("  Press Ctrl+C to terminate the host session cleanly.")
    print(line + "\n")


def run_host_server():
    parser = argparse.ArgumentParser(description="CollabBoard X Standalone LAN Host Launcher")
    parser.add_argument("--port", type=int, default=8000, help="Web HTTP / WebSocket port")
    parser.add_argument("--tcp-port", type=int, default=9001, help="Raw TCP socket port (CN Lab)")
    parser.add_argument("--room", default="main-lan-board", help="Default room code")
    args = parser.parse_args()

    settings = get_settings()
    settings.HTTP_PORT = args.port
    settings.TCP_SOCKET_PORT = args.tcp_port

    lan_ip = get_lan_ip()
    print_banner(lan_ip, args.port, args.tcp_port, args.room)

    # Launch uvicorn running app.main:app
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=args.port,
        log_level="info",
        reload=False,
    )


if __name__ == "__main__":
    run_host_server()
