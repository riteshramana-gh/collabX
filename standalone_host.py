"""Root entrypoint for running CollabBoard X in Standalone Host Fallback Mode.

Usage:
    py -3.13 standalone_host.py [--port 8000] [--room my-room]
"""

import sys
from pathlib import Path

# If inadvertently launched with free-threaded python3.13t.exe on Windows, redirect to standard python.exe
if "3.13t" in sys.executable.lower():
    import subprocess
    standard_py = sys.executable.lower().replace("python3.13t.exe", "python.exe")
    if Path(standard_py).exists():
        sys.exit(subprocess.call([standard_py] + sys.argv))

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent / "backend"
sys.path.insert(0, str(backend_dir))

from app.launcher.host_cli import run_host_server

if __name__ == "__main__":
    run_host_server()
