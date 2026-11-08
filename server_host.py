"""Entrypoint for running the CollabBoard X Central Dedicated LAN Server.

Usage:
    py -3.13 server_host.py [--port 8000] [--tcp-port 9001]
"""

import argparse
import sys
from pathlib import Path

# Redirect from free-threaded Python on Windows if invoked
if "3.13t" in sys.executable.lower():
    import subprocess
    standard_py = sys.executable.lower().replace("python3.13t.exe", "python.exe")
    if Path(standard_py).exists():
        sys.exit(subprocess.call([standard_py] + sys.argv))

backend_dir = Path(__file__).resolve().parent / "backend"
sys.path.insert(0, str(backend_dir))

import uvicorn
from app.launcher.lan_detector import get_lan_ip
from app.core.config import get_settings


def print_server_banner(lan_ip: str, http_port: int, tcp_port: int) -> None:
    line = "=" * 72
    print("\n" + line)
    print("             COLLABBOARD X - CENTRAL LAN DEDICATED SERVER")
    print(line)
    print(f"  * Host LAN IP:              {lan_ip}")
    print(f"  * Web & WebSocket Address:  http://{lan_ip}:{http_port}")
    print(f"  * Raw TCP Socket Port:      {tcp_port} (Computer Networks Lab)")
    print(f"  * Storage Engine:           SQLite WAL Mode (Authoritative History)")
    print(line)
    print(f"  [+] Desktop Clients connect to:    {lan_ip}:{http_port}")
    print(f"  [+] Mobile / Tablets connect to:   http://{lan_ip}:{http_port}")
    print(line)
    print("  Server is listening on all local interfaces (0.0.0.0).")
    print("  Press Ctrl+C to shut down the server cleanly.")
    print(line + "\n")


def main():
    if sys.stdout and hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

    parser = argparse.ArgumentParser(description="CollabBoard X Central Dedicated Server")
    parser.add_argument("--port", type=int, default=8000, help="Web HTTP / WebSocket port (default: 8000)")
    parser.add_argument("--tcp-port", type=int, default=9001, help="Raw TCP socket port for CN Lab (default: 9001)")
    args = parser.parse_args()

    settings = get_settings()
    settings.HTTP_PORT = args.port
    settings.TCP_SOCKET_PORT = args.tcp_port

    lan_ip = get_lan_ip()
    print_server_banner(lan_ip, args.port, args.tcp_port)

    from app.main import app as fastapi_app
    uvicorn.run(
        fastapi_app,
        host="0.0.0.0",
        port=args.port,
        log_level="info",
    )


if __name__ == "__main__":
    main()
