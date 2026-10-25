"""SQLite engine. WAL + foreign keys + busy timeout; critical write paths use BEGIN IMMEDIATE."""
from collections.abc import Iterator
from contextvars import ContextVar

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import get_settings

_immediate: ContextVar[bool] = ContextVar("immediate", default=False)

_url = get_settings().database_url
engine = create_engine(_url, connect_args={"check_same_thread": False} if _url.startswith("sqlite") else {})

if _url.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def _on_connect(dbapi_conn, _rec):
        dbapi_conn.isolation_level = None  # we emit BEGIN ourselves (see below)
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.execute("PRAGMA journal_mode=WAL")
        cur.execute("PRAGMA busy_timeout=5000")
        cur.close()

    @event.listens_for(engine, "begin")
    def _on_begin(conn):
        conn.exec_driver_sql("BEGIN IMMEDIATE" if _immediate.get() else "BEGIN")


class Base(DeclarativeBase):
    pass


SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def begin_immediate(db: Session) -> None:
    """Take SQLite's write lock up front so check-then-write sequences (capacity, grades) cannot race.
    Ends the current read transaction; the next statement opens a BEGIN IMMEDIATE one."""
    db.commit()
    _immediate.set(True)
