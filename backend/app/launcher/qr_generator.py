"""QR Code generator for terminal display and shareable URL representation."""

import io
from typing import Optional


def generate_ascii_qr(url: str) -> str:
    """Generates an ASCII text representation of a QR code for terminal display."""
    try:
        import qrcode
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_L,
            box_size=1,
            border=2,
        )
        qr.add_data(url)
        qr.make(fit=True)

        output = io.StringIO()
        qr.print_ascii(out=output, invert=True)
        return output.getvalue()
    except Exception:
        # Fallback if qrcode library has rendering issues
        border = "=" * 46
        return f"{border}\n  SCAN TO JOIN ON MOBILE / TABLET:\n  {url}\n{border}"
