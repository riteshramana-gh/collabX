"""Structured logging configuration for CollabBoard X."""

import logging
import sys
from typing import Optional


def setup_logging(level: str = "INFO", log_format: Optional[str] = None) -> logging.Logger:
    """Configures structured console logging across the backend."""
    if log_format is None:
        log_format = (
            "[%(asctime)s.%(msecs)03d] [%(levelname)s] [%(name)s] "
            "[%(filename)s:%(lineno)d]: %(message)s"
        )

    date_format = "%Y-%m-%d %H:%M:%S"

    numeric_level = getattr(logging, level.upper(), logging.INFO)

    root_logger = logging.getLogger()
    root_logger.setLevel(numeric_level)

    # Avoid duplicate handlers if called multiple times
    if not root_logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(numeric_level)
        formatter = logging.Formatter(fmt=log_format, datefmt=date_format)
        handler.setFormatter(formatter)
        root_logger.addHandler(handler)
    else:
        for handler in root_logger.handlers:
            handler.setLevel(numeric_level)

    # Silence overly verbose third-party loggers if not in debug
    if numeric_level > logging.DEBUG:
        logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
        logging.getLogger("asyncio").setLevel(logging.WARNING)

    logger = logging.getLogger("collabboard")
    return logger
