"""Standalone Launcher for CollabBoard X (Host Fallback Mode).

Discovers active LAN IP without internet, prints connection banner and ASCII QR code,
and launches the unified FastAPI and TCP socket backend server.
"""

import argparse
import sys
import threading
import time
import urllib.request
import webbrowser
import subprocess
import shutil
from pathlib import Path
import uvicorn
from app.launcher.lan_detector import get_lan_ip
from app.launcher.qr_generator import generate_ascii_qr
from app.core.config import get_settings


def open_desktop_window(port: int, url: str) -> None:
    """Waits for local server to be ready, then opens the UI in a dedicated desktop window."""
    # Wait for server health endpoint to respond
    for _ in range(25):
        time.sleep(0.2)
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/health", timeout=1):
                break
        except Exception:
            pass

    # Windows: Launch in frameless desktop application window mode (MS Edge or Google Chrome)
    if sys.platform == "win32":
        candidates = [
            r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
            r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        ]
        for exe in candidates:
            if Path(exe).exists():
                try:
                    subprocess.Popen([exe, f"--app={url}"])
                    return
                except Exception:
                    pass

    # Linux: Launch in app window mode (Chrome / Chromium / Edge)
    elif sys.platform.startswith("linux"):
        for browser in ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge"]:
            if shutil.which(browser):
                try:
                    subprocess.Popen([browser, f"--app={url}"])
                    return
                except Exception:
                    pass

    # Fallback to standard system web browser
    try:
        webbrowser.open(url)
    except Exception:
        pass


def print_banner(lan_ip: str, http_port: int, tcp_port: int, room_id: str) -> None:
    board_url = f"http://{lan_ip}:{http_port}/?room={room_id}"
    qr_ascii = generate_ascii_qr(board_url)

    line = "=" * 70
    print("\n" + line)
    print("      COLLABBOARD X - STANDALONE LAN HOST SERVER LAUNCHER")
    print(line)
    print(f"  * Host LAN IP:          {lan_ip}")
    print(f"  * Web Application:      http://{lan_ip}:{http_port}")
    print(f"  * Direct Board Link:    {board_url}")
    print(f"  * Raw TCP Socket Port:  {tcp_port} (Computer Networks Lab)")
    print(f"  * Initial Room ID:      {room_id}")
    print(line)
    print("\n  SCAN THIS QR CODE ON PHONES / TABLETS ON THE SAME LAN WIFI:\n")
    try:
        print(qr_ascii)
    except Exception:
        print("  [QR Code rendered on web dashboard]")
    print(line)
    print("  Server is listening on all local interfaces (0.0.0.0).")
    print("  Press Ctrl+C to terminate the host session cleanly.")
    print(line + "\n")


def run_host_server():
    if sys.stdout and hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
    if sys.stderr and hasattr(sys.stderr, "reconfigure"):
        try:
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
    parser = argparse.ArgumentParser(description="CollabBoard X Standalone LAN Host Launcher")
    parser.add_argument("--port", type=int, default=8000, help="Web HTTP / WebSocket port")
    parser.add_argument("--tcp-port", type=int, default=9001, help="Raw TCP socket port (CN Lab)")
    parser.add_argument("--room", default="main-lan-board", help="Default room code")
    parser.add_argument("--no-gui", action="store_true", help="Do not automatically launch desktop GUI window")
    args = parser.parse_args()

    settings = get_settings()
    settings.HTTP_PORT = args.port
    settings.TCP_SOCKET_PORT = args.tcp_port

    lan_ip = get_lan_ip()
    board_url = f"http://{lan_ip}:{args.port}/?room={args.room}"
    print_banner(lan_ip, args.port, args.tcp_port, args.room)

    # Automatically launch native desktop GUI window in background
    if not args.no_gui:
        threading.Thread(
            target=open_desktop_window,
            args=(args.port, board_url),
            daemon=True,
        ).start()

    # Launch uvicorn running app directly (supports both source and PyInstaller frozen executable)
    from app.main import app as fastapi_app
    uvicorn.run(
        fastapi_app,
        host="0.0.0.0",
        port=args.port,
        log_level="info",
    )


if __name__ == "__main__":
    run_host_server()
