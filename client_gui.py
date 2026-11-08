"""Entrypoint for running the CollabBoard X Native Desktop GUI Client.

Usage:
    py -3.13 client_gui.py [--server 192.168.1.37:8000]
"""

import argparse
import http.server
import socket
import socketserver
import subprocess
import shutil
import sys
import threading
import time
import urllib.request
import webbrowser
from pathlib import Path

# Redirect from free-threaded Python on Windows if invoked
if "3.13t" in sys.executable.lower():
    import subprocess
    standard_py = sys.executable.lower().replace("python3.13t.exe", "python.exe")
    if Path(standard_py).exists():
        sys.exit(subprocess.call([standard_py] + sys.argv))

# Find frontend dist path (either from PyInstaller _MEIPASS or source tree)
def get_dist_path() -> Path:
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        p = Path(sys._MEIPASS) / "frontend" / "dist"
        if p.is_dir():
            return p
    source_p = Path(__file__).resolve().parent / "frontend" / "dist"
    if source_p.is_dir():
        return source_p
    exe_p = Path(sys.executable).parent / "frontend" / "dist"
    if exe_p.is_dir():
        return exe_p
    return source_p


def get_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class SPAStaticHTTPHandler(http.server.SimpleHTTPRequestHandler):
    """Serves static assets with fallback to index.html for Single Page Applications."""
    def __init__(self, *args, directory=None, **kwargs):
        super().__init__(*args, directory=str(directory), **kwargs)

    def do_GET(self):
        # If path has no extension and is not an API call, serve index.html
        path_obj = Path(self.directory) / self.path.lstrip("/").split("?")[0]
        if not path_obj.exists() and "." not in Path(self.path).name:
            self.path = "/index.html"
        return super().do_GET()

    def log_message(self, format, *args):
        # Silence routine static asset HTTP logs
        pass


def open_desktop_window(app_url: str):
    """Launches the GUI in a native frameless desktop application window."""
    # Windows: Launch via Microsoft Edge or Google Chrome in dedicated app mode
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
                    subprocess.Popen([exe, f"--app={app_url}"])
                    return
                except Exception:
                    pass

    # Linux: Launch via Chrome / Chromium / Edge in app mode
    elif sys.platform.startswith("linux"):
        for browser in ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge"]:
            if shutil.which(browser):
                try:
                    subprocess.Popen([browser, f"--app={app_url}"])
                    return
                except Exception:
                    pass

    # Fallback to standard system default web browser
    try:
        webbrowser.open(app_url)
    except Exception:
        pass


def main():
    if sys.stdout and hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

    parser = argparse.ArgumentParser(description="CollabBoard X Desktop GUI Client")
    parser.add_argument("--server", default="", help="Default Central Server address (e.g. 192.168.1.37:8000)")
    args = parser.parse_args()

    dist_path = get_dist_path()
    if not dist_path.exists():
        print(f"[-] Error: Could not locate frontend assets at {dist_path}")
        sys.exit(1)

    port = get_free_port()
    handler = lambda *a, **k: SPAStaticHTTPHandler(*a, directory=dist_path, **k)

    server = socketserver.TCPServer(("127.0.0.1", port), handler)
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()

    app_url = f"http://127.0.0.1:{port}"
    if args.server:
        app_url += f"?server={args.server}"

    print("=" * 64)
    print("           COLLABBOARD X - DESKTOP GUI CLIENT")
    print("=" * 64)
    print(f"  [+] GUI Client Window starting...")
    print(f"  [+] Local App Bridge: {app_url}")
    if args.server:
        print(f"  [+] Target Central Server: {args.server}")
    print("=" * 64)
    print("  Close the GUI application window or press Ctrl+C to exit.\n")

    # Launch desktop window
    threading.Thread(target=open_desktop_window, args=(app_url,), daemon=True).start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        server.shutdown()
        sys.exit(0)


if __name__ == "__main__":
    main()
