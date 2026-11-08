"""The institution's rooms (code, kind, seats). Kind and seats are estimates from the room names: correct them under Rooms in the admin UI."""
from .models import RoomKind

ROOMS: list[tuple[str, RoomKind, int]] = [
    ("Meridian", RoomKind.lecture_hall, 120), ("Hyperion", RoomKind.lecture_hall, 100), ("P27", RoomKind.lecture_hall, 80), ("Romulus", RoomKind.classroom, 40),
    ("Aurora", RoomKind.classroom, 40), ("Virtual, Webex", RoomKind.online, 500), ("P25", RoomKind.lecture_hall, 80), ("ZP1", RoomKind.classroom, 24),
    ("Vulcan", RoomKind.classroom, 30), ("Zasadačka online", RoomKind.online, 100), ("PK6_PC1", RoomKind.lab, 24), ("PK6_PC5", RoomKind.lab, 24),
    ("ZP4", RoomKind.classroom, 24), ("Aula VW Slovakia", RoomKind.lecture_hall, 200), ("PK6_PC2", RoomKind.lab, 24), ("Abydos", RoomKind.classroom, 30),
    ("Kronos", RoomKind.classroom, 36), ("Nyx", RoomKind.classroom, 30), ("Solaris", RoomKind.lecture_hall, 90), ("Duna", RoomKind.classroom, 30),
    ("Caprica", RoomKind.classroom, 40),
]

# Rooms of the earlier demo data; removed by app.seed_rooms once nothing uses them.
OLD_DEMO_CODES = {"B-101", "B-102", "B-105", "B-201", "B-202", "B-203", "B-210", "A-301", "A-302", "LAB-1", "LAB-2", "LAB-3", "LAB-4", "LAB-5", "LAB-6"}
