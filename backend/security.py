"""Phone number handling: normalisation, keyed hashing for lookup, reversible encryption for dialling, masking.

Demo-grade: an HMAC-SHA256 keystream cipher from the standard library. Swap for a KMS-backed AES-GCM in production.
"""
import base64
import hashlib
import hmac
import os
import re

_SECRET = os.environ.get("LEADPILOT_SECRET", "leadpilot-demo-secret-rotate-me").encode()


def normalize_phone(raw: str) -> str:
    digits = re.sub(r"\D", "", raw or "")
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    elif len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    if len(digits) != 10 or digits[0] not in "6789":
        raise ValueError("Enter a valid 10-digit Indian mobile number")
    return digits


def phone_hash(phone: str) -> str:
    return hmac.new(_SECRET, b"hash:" + phone.encode(), hashlib.sha256).hexdigest()


def _keystream(nonce: bytes, n: int) -> bytes:
    out = b""
    i = 0
    while len(out) < n:
        out += hmac.new(_SECRET, b"enc:" + nonce + i.to_bytes(4, "big"), hashlib.sha256).digest()
        i += 1
    return out[:n]


def encrypt(phone: str) -> str:
    nonce = os.urandom(8)
    data = phone.encode()
    ct = bytes(a ^ b for a, b in zip(data, _keystream(nonce, len(data))))
    return base64.urlsafe_b64encode(nonce + ct).decode()


def decrypt(token: str) -> str:
    raw = base64.urlsafe_b64decode(token.encode())
    nonce, ct = raw[:8], raw[8:]
    return bytes(a ^ b for a, b in zip(ct, _keystream(nonce, len(ct)))).decode()


def mask(phone: str) -> str:
    return f"+91 {phone[:2]}••• ••{phone[-3:]}"
