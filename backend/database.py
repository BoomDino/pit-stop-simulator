import sqlite3
from pathlib import Path

class Database:
    def __init__(self, path, recover=False):
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.path = path
        with self.connect() as db:
            db.execute("""CREATE TABLE IF NOT EXISTS events (
                event_id TEXT PRIMARY KEY, run_id TEXT NOT NULL, stage INTEGER NOT NULL,
                payload TEXT NOT NULL, state TEXT NOT NULL, job_id TEXT, result TEXT,
                updated TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE(run_id, stage))""")
            # A crash during dispatch is ambiguous: never launch a duplicate automatically.
            if recover:
                db.execute("UPDATE events SET state='UNKNOWN' WHERE state='SUBMITTING'")

    def connect(self):
        db = sqlite3.connect(self.path, timeout=10)
        db.row_factory = sqlite3.Row
        return db

    def get(self, event_id):
        with self.connect() as db:
            row = db.execute('SELECT * FROM events WHERE event_id=?', (event_id,)).fetchone()
            return dict(row) if row else None

    def update(self, event_id, state, job_id=None, result=None):
        with self.connect() as db:
            db.execute('UPDATE events SET state=?, job_id=COALESCE(?,job_id), result=?, updated=CURRENT_TIMESTAMP WHERE event_id=?',
                       (state, job_id, result, event_id))

    def logs(self, limit=100):
        with self.connect() as db:
            return [dict(x) for x in db.execute('SELECT * FROM events ORDER BY updated DESC, rowid DESC LIMIT ?', (limit,))]
