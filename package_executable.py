"""Packaging script for CollabBoard X executables using PyInstaller.

Builds:
1. CollabBoardX-Server (.exe / linux binary): Dedicated Central LAN Server.
2. CollabBoardX-Client (.exe / linux binary): Dedicated Native Desktop GUI Client.
"""

import sys
import subprocess
import shutil
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
FRONTEND_DIST = ROOT_DIR / "frontend" / "dist"
BACKEND_DIR = ROOT_DIR / "backend"


def check_frontend():
    if not (FRONTEND_DIST / "index.html").exists():
        print("[*] frontend/dist/ not found. Running npm run build...")
        subprocess.check_call(["npm", "--prefix", "frontend", "run", "build"], shell=True)
    else:
        print("[+] Verified pre-built frontend/dist/ exists.")


def build_server():
    check_frontend()
    sep = ";" if sys.platform == "win32" else ":"
    data_arg = f"{FRONTEND_DIST}{sep}frontend/dist"
    name = "CollabBoardX-Server"

    cmd = [
        sys.executable,
        "-m", "PyInstaller",
        "--name", name,
        "--onefile",
        "--paths", str(BACKEND_DIR),
        "--add-data", data_arg,
        "--hidden-import", "uvicorn",
        "--hidden-import", "uvicorn.logging",
        "--hidden-import", "uvicorn.loops",
        "--hidden-import", "uvicorn.loops.auto",
        "--hidden-import", "uvicorn.protocols",
        "--hidden-import", "uvicorn.protocols.http",
        "--hidden-import", "uvicorn.protocols.http.auto",
        "--hidden-import", "uvicorn.protocols.websockets",
        "--hidden-import", "uvicorn.protocols.websockets.auto",
        "--hidden-import", "uvicorn.lifespan",
        "--hidden-import", "uvicorn.lifespan.on",
        "--hidden-import", "websockets",
        "--hidden-import", "aiosqlite",
        "--hidden-import", "fastapi",
        "--hidden-import", "starlette",
        "--hidden-import", "pydantic",
        "--hidden-import", "pydantic_settings",
        "--hidden-import", "qrcode",
        "--clean",
        "--noconfirm",
        str(ROOT_DIR / "server_host.py"),
    ]

    print(f"\n[*] Building {name}...")
    subprocess.check_call(cmd)
    out = ROOT_DIR / "dist" / (f"{name}.exe" if sys.platform == "win32" else name)
    print(f"[+] Server executable created: {out} ({out.stat().st_size / (1024*1024):.2f} MB)")


def build_client():
    check_frontend()
    sep = ";" if sys.platform == "win32" else ":"
    data_arg = f"{FRONTEND_DIST}{sep}frontend/dist"
    name = "CollabBoardX-Client"

    cmd = [
        sys.executable,
        "-m", "PyInstaller",
        "--name", name,
        "--onefile",
        "--add-data", data_arg,
        "--clean",
        "--noconfirm",
        str(ROOT_DIR / "client_gui.py"),
    ]

    print(f"\n[*] Building {name}...")
    subprocess.check_call(cmd)
    out = ROOT_DIR / "dist" / (f"{name}.exe" if sys.platform == "win32" else name)
    print(f"[+] Client executable created: {out} ({out.stat().st_size / (1024*1024):.2f} MB)")


if __name__ == "__main__":
    target = sys.argv[1].lower() if len(sys.argv) > 1 else "all"
    if target in ("server", "all"):
        build_server()
    if target in ("client", "all"):
        build_client()
