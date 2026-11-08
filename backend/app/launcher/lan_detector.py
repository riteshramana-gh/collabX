"""Zero-internet LAN IP auto-discovery algorithm using local UDP routing probe."""

import socket
import logging

logger = logging.getLogger("collabboard.launcher.lan")


def get_lan_ip() -> str:
    """Discovers the active LAN IP of the host machine without internet connectivity.
    
    Uses standard OS socket routing table lookup by connecting a UDP socket to local broadcast
    destinations. No packets are transmitted over the physical wire.
    """
    candidates = ["10.255.255.255", "192.168.255.255", "172.31.255.255"]
    for dest in candidates:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            s.connect((dest, 1))
            ip = s.getsockname()[0]
            if ip and not ip.startswith("127."):
                return ip
        except Exception:
            pass
        finally:
            s.close()

    # Fallback to hostname resolution
    try:
        hostname = socket.gethostname()
        ip = socket.gethostbyname(hostname)
        if ip and not ip.startswith("127."):
            return ip
    except Exception:
        pass

    return "127.0.0.1"
