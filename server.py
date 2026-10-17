"""
server.py
Root entrypoint delegating to backend/server.py.
Maintains 100% backwards-compatibility for existing scripts and dev commands.
"""
import sys
from pathlib import Path

# Add project root and backend to sys.path
ROOT_DIR = Path(__file__).resolve().parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.server import app, start_server

if __name__ == "__main__":
    start_server()
