"""SQLite engine. WAL + foreign keys + busy timeout; critical write paths use BEGIN IMMEDIATE."""
from collections.abc import Iterator
from contextvars import ContextVar

from sqlalchemy import create_engine, event, inspect
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


def upgrade_schema(eng=None) -> None:
    """Additive schema upgrade for databases created by an older version: create_all only creates missing tables, so add missing columns here.
    Only nullable columns and columns with a plain server_default can be added; anything bigger deserves a real migration tool (Alembic)."""
    eng = eng or engine
    insp = inspect(eng)
    with eng.begin() as conn:
        for table in Base.metadata.sorted_tables:
            if not insp.has_table(table.name): continue
            have = {c["name"] for c in insp.get_columns(table.name)}
            for col in table.columns:
                if col.name in have: continue
                ddl = f'ALTER TABLE {table.name} ADD COLUMN {col.name} {col.type.compile(dialect=eng.dialect)}'
                if col.server_default is not None: ddl += f" DEFAULT {col.server_default.arg!r}" if isinstance(col.server_default.arg, str) else ""
                elif not col.nullable: continue  # cannot add a NOT NULL column without a default
                conn.exec_driver_sql(ddl)
