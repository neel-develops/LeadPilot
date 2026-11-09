"""SQLite persistence layer. Single connection, used from the asyncio event loop thread."""
import json
import os
import sqlite3
import threading

DB_PATH = os.environ.get("LEADPILOT_DB", os.path.join(os.path.dirname(os.path.abspath(__file__)), "leadpilot.db"))

_conn: sqlite3.Connection | None = None
_lock = threading.RLock()

JSON_COLS = {
    "transcript", "rule_ids", "skills", "working_hours", "languages", "input", "output",
    "briefing", "alloc", "score_factors", "value", "extra", "vars",
}

SCHEMA = """
CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    business_name TEXT,
    phone_hash TEXT NOT NULL,
    phone_enc TEXT NOT NULL,
    phone_masked TEXT NOT NULL,
    source TEXT NOT NULL,
    interest TEXT DEFAULT 'soundbox',
    created_at REAL NOT NULL,
    consent INTEGER NOT NULL DEFAULT 0,
    opted_out INTEGER NOT NULL DEFAULT 0,
    language TEXT DEFAULT 'hi',
    status TEXT NOT NULL DEFAULT 'NEW',
    score INTEGER,
    temperature TEXT,
    score_factors TEXT,
    first_contact_at REAL,
    last_attempt_at REAL,
    attempts INTEGER NOT NULL DEFAULT 0,
    reschedules INTEGER NOT NULL DEFAULT 0,
    channel TEXT,
    lost_reason TEXT,
    summary TEXT,
    sentiment TEXT,
    next_retry_at REAL,
    simulated INTEGER NOT NULL DEFAULT 0,
    baseline_ttfc_h REAL,
    baseline_visit INTEGER,
    baseline_wasted INTEGER,
    updated_at REAL
);
CREATE INDEX IF NOT EXISTS ix_leads_hash ON leads(phone_hash);
CREATE INDEX IF NOT EXISTS ix_leads_status ON leads(status);

CREATE TABLE IF NOT EXISTS merchant_profiles (
    lead_id TEXT PRIMARY KEY,
    shop_type TEXT,
    daily_sales_band TEXT,
    daily_sales_value INTEGER,
    current_setup TEXT,
    pincode TEXT,
    area TEXT,
    lat REAL,
    lng REAL,
    outlets INTEGER DEFAULT 1,
    asked_price INTEGER DEFAULT 0,
    hesitation INTEGER DEFAULT 0,
    extra TEXT
);

CREATE TABLE IF NOT EXISTS interactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id TEXT NOT NULL,
    channel TEXT,
    started_at REAL,
    ended_at REAL,
    transcript TEXT,
    summary TEXT,
    sentiment TEXT,
    outcome TEXT
);
CREATE INDEX IF NOT EXISTS ix_inter_lead ON interactions(lead_id);

CREATE TABLE IF NOT EXISTS recommendations (
    lead_id TEXT PRIMARY KEY,
    device TEXT,
    plan TEXT,
    price TEXT,
    reason TEXT,
    rule_ids TEXT
);

CREATE TABLE IF NOT EXISTS field_agents (
    id TEXT PRIMARY KEY,
    name TEXT,
    area TEXT,
    home_lat REAL,
    home_lng REAL,
    skills TEXT,
    working_hours TEXT,
    capacity INTEGER,
    rating REAL,
    languages TEXT,
    active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS visits (
    id TEXT PRIMARY KEY,
    lead_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    slot_start REAL NOT NULL,
    status TEXT NOT NULL,
    merchant_confirmed INTEGER DEFAULT 0,
    verified INTEGER DEFAULT 0,
    outcome TEXT,
    outcome_reason TEXT,
    wasted INTEGER DEFAULT 0,
    distance_km REAL,
    briefing TEXT,
    alloc TEXT,
    created_at REAL
);
CREATE INDEX IF NOT EXISTS ix_visits_agent ON visits(agent_id, slot_start);
CREATE INDEX IF NOT EXISTS ix_visits_lead ON visits(lead_id);

CREATE TABLE IF NOT EXISTS agent_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id TEXT,
    tool TEXT NOT NULL,
    input TEXT,
    output TEXT,
    status TEXT DEFAULT 'ok',
    actor TEXT DEFAULT 'agent',
    duration_ms REAL,
    ts REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_actions_lead ON agent_actions(lead_id);
CREATE INDEX IF NOT EXISTS ix_actions_ts ON agent_actions(ts);

CREATE TABLE IF NOT EXISTS consent_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id TEXT,
    event TEXT,
    detail TEXT,
    ts REAL
);

CREATE TABLE IF NOT EXISTS leakage_flags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id TEXT,
    rule TEXT,
    title TEXT,
    detail TEXT,
    severity TEXT,
    action TEXT,
    status TEXT DEFAULT 'open',
    ts REAL,
    resolved_at REAL
);

CREATE TABLE IF NOT EXISTS handoffs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id TEXT,
    reason TEXT,
    summary TEXT,
    status TEXT DEFAULT 'open',
    assigned_to TEXT,
    ts REAL
);

CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id TEXT,
    channel TEXT,
    template_id TEXT,
    recipient TEXT,
    body TEXT,
    direction TEXT DEFAULT 'out',
    ts REAL
);

CREATE TABLE IF NOT EXISTS dnc_list (
    phone_hash TEXT PRIMARY KEY,
    ts REAL
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);
"""


def conn() -> sqlite3.Connection:
    global _conn
    if _conn is None:
        _conn = sqlite3.connect(DB_PATH, check_same_thread=False, isolation_level=None)
        _conn.row_factory = sqlite3.Row
        _conn.execute("PRAGMA journal_mode=WAL")
        _conn.execute("PRAGMA synchronous=NORMAL")
        _conn.executescript(SCHEMA)
        cols = {r[1] for r in _conn.execute("PRAGMA table_info(leads)").fetchall()}
        if "created_by" not in cols:
            _conn.execute("ALTER TABLE leads ADD COLUMN created_by TEXT")
        if "audio" not in cols:
            _conn.execute("ALTER TABLE leads ADD COLUMN audio INTEGER DEFAULT 0")
    return _conn


def _decode(row: sqlite3.Row | None) -> dict | None:
    if row is None:
        return None
    d = dict(row)
    for k, v in d.items():
        if k in JSON_COLS and isinstance(v, str):
            try:
                d[k] = json.loads(v)
            except (ValueError, TypeError):
                pass
    return d


def _encode(args):
    out = []
    for a in args:
        if isinstance(a, (dict, list)):
            out.append(json.dumps(a, default=str, ensure_ascii=False))
        elif isinstance(a, bool):
            out.append(int(a))
        else:
            out.append(a)
    return tuple(out)


def q(sql: str, args=()) -> list[dict]:
    with _lock:
        return [_decode(r) for r in conn().execute(sql, _encode(args)).fetchall()]


def one(sql: str, args=()) -> dict | None:
    with _lock:
        return _decode(conn().execute(sql, _encode(args)).fetchone())


def scalar(sql: str, args=()):
    with _lock:
        r = conn().execute(sql, _encode(args)).fetchone()
        return r[0] if r else None


def ex(sql: str, args=()) -> int:
    with _lock:
        cur = conn().execute(sql, _encode(args))
        return cur.lastrowid


def many(sql: str, rows: list) -> None:
    with _lock:
        c = conn()
        c.execute("BEGIN")
        try:
            c.executemany(sql, [_encode(r) for r in rows])
            c.execute("COMMIT")
        except Exception:
            c.execute("ROLLBACK")
            raise


def update(table: str, key_col: str, key, fields: dict) -> None:
    if not fields:
        return
    cols = ", ".join(f"{k} = ?" for k in fields)
    ex(f"UPDATE {table} SET {cols} WHERE {key_col} = ?", (*fields.values(), key))


def reset() -> None:
    global _conn
    with _lock:
        if _conn is not None:
            _conn.close()
            _conn = None
        for suffix in ("", "-wal", "-shm"):
            p = DB_PATH + suffix
            if os.path.exists(p):
                os.remove(p)
        conn()
