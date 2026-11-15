def test_health_live(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_health_ready_checks_database(client):
    r = client.get("/health/ready")
    assert r.status_code == 200 and r.json() == {"status": "ok", "database": "ok"}


def test_health_ready_503_when_database_is_down(client, monkeypatch):
    from app import main

    class Broken:
        def connect(self): raise RuntimeError("db down")

    monkeypatch.setattr(main, "engine", Broken())
    r = client.get("/health/ready")
    assert r.status_code == 503 and r.json()["database"] == "down"
