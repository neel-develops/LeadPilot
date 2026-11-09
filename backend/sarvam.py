"""Sarvam AI client: speech-to-text (saarika), text-to-speech (bulbul), LLM (sarvam-105b) and translation.
The API key is read from backend/.env and never leaves the server."""
import asyncio
import base64
import hashlib
import json
import os
import re
import time
import uuid

import httpx

BASE = "https://api.sarvam.ai"
CHAT_MODEL = "sarvam-105b"
TTS_MODEL = "bulbul:v3"
STT_MODEL = "saarika:v2.5"
AGENT_VOICE = "priya"
VOICES = {"female": "ritu", "male": "rahul", "agent": AGENT_VOICE}


def _load_key() -> str:
    key = os.environ.get("SARVAM_API_KEY", "").strip()
    env = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if not key and os.path.exists(env):
        for line in open(env, encoding="utf-8"):
            if line.strip().startswith("SARVAM_API_KEY="):
                key = line.split("=", 1)[1].strip().strip('"').strip("'")
    return key


KEY = _load_key()
_client: httpx.AsyncClient | None = None
_audio: dict[str, tuple[bytes, float]] = {}      # audio_id -> (wav bytes, created)
_tts_cache: dict[str, tuple[str, float]] = {}    # text hash -> (audio_id, duration)
stats = {"calls": 0, "errors": 0, "last_error": None}


def enabled() -> bool:
    return bool(KEY)


def client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(base_url=BASE, headers={"api-subscription-key": KEY}, timeout=httpx.Timeout(20.0, connect=6.0))
    return _client


def _err(e: Exception):
    stats["errors"] += 1
    stats["last_error"] = f"{type(e).__name__}: {e}"[:200]


# --------------------------------------------------------------------------- audio store
def _prune():
    if len(_audio) > 400:
        for k, _ in sorted(_audio.items(), key=lambda kv: kv[1][1])[:150]:
            _audio.pop(k, None)


def wav_duration(wav: bytes) -> float:
    try:
        byte_rate = int.from_bytes(wav[28:32], "little")
        i = wav.find(b"data")
        size = int.from_bytes(wav[i + 4:i + 8], "little") if i > 0 else len(wav) - 44
        return max(0.3, size / byte_rate) if byte_rate else 2.0
    except Exception:
        return 2.0


def get_audio(audio_id: str) -> bytes | None:
    a = _audio.get(audio_id)
    return a[0] if a else None


async def tts(text: str, lang: str = "hi", speaker: str = AGENT_VOICE) -> tuple[str, float] | None:
    """Returns (audio_id, seconds) or None on failure."""
    if not enabled() or not text.strip():
        return None
    code = "hi-IN" if lang == "hi" else "en-IN"
    h = hashlib.sha1(f"{code}|{speaker}|{text}".encode()).hexdigest()
    if h in _tts_cache and _tts_cache[h][0] in _audio:
        return _tts_cache[h]
    try:
        stats["calls"] += 1
        r = await client().post("/text-to-speech", json={"text": text[:1400], "target_language_code": code,
                                                         "speaker": speaker, "model": TTS_MODEL, "pace": 1.12})
        r.raise_for_status()
        wav = base64.b64decode(r.json()["audios"][0])
        aid = uuid.uuid4().hex
        _audio[aid] = (wav, time.time())
        _prune()
        res = (aid, wav_duration(wav))
        _tts_cache[h] = res
        return res
    except Exception as e:
        _err(e)
        return None


async def stt(data: bytes, filename: str = "audio.wav", mime: str = "audio/wav") -> dict | None:
    if not enabled():
        return None
    try:
        stats["calls"] += 1
        r = await client().post("/speech-to-text", files={"file": (filename, data, mime)},
                                data={"model": STT_MODEL, "language_code": "unknown"})
        r.raise_for_status()
        d = r.json()
        return {"transcript": (d.get("transcript") or "").strip(), "language_code": d.get("language_code") or "hi-IN"}
    except Exception as e:
        _err(e)
        return None


async def translate(text: str, src: str = "hi-IN", tgt: str = "en-IN") -> str | None:
    if not enabled() or not text.strip():
        return None
    try:
        stats["calls"] += 1
        r = await client().post("/translate", json={"input": text[:900], "source_language_code": src, "target_language_code": tgt})
        r.raise_for_status()
        return r.json().get("translated_text")
    except Exception as e:
        _err(e)
        return None


async def chat(messages: list[dict], max_tokens: int = 300, temperature: float = 0.2) -> str | None:
    if not enabled():
        return None
    try:
        stats["calls"] += 1
        r = await client().post("/v1/chat/completions", json={"model": CHAT_MODEL, "messages": messages, "max_tokens": max_tokens,
                                                               "temperature": temperature, "reasoning_effort": None})
        r.raise_for_status()
        txt = r.json()["choices"][0]["message"].get("content") or ""
        return re.sub(r"<think>.*?</think>", "", txt, flags=re.S).strip()
    except Exception as e:
        _err(e)
        return None


def parse_json(txt: str | None) -> dict | None:
    if not txt:
        return None
    m = re.search(r"\{.*\}", txt, re.S)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except ValueError:
        return None


async def ping() -> dict:
    t = time.time()
    out = await chat([{"role": "user", "content": "Reply with the single word OK"}], max_tokens=5)
    return {"enabled": enabled(), "ok": bool(out), "latency_ms": round((time.time() - t) * 1000), **stats}
