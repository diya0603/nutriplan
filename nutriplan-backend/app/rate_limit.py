# app/rate_limit.py
import time
from collections import defaultdict
from fastapi import HTTPException, status

_request_log = defaultdict(list)

def check_rate_limit(key: str, max_requests: int, window_seconds: int):
    now = time.time()
    _request_log[key] = [t for t in _request_log[key] if now - t < window_seconds]

    if len(_request_log[key]) >= max_requests:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests, please wait a moment and try again.",
        )

    _request_log[key].append(now)