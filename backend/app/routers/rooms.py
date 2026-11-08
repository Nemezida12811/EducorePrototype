from typing import Literal

from fastapi import APIRouter, Depends, Query, Request, Response
from pydantic import Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..errors import bad_request, conflict, not_found
from ..models import CourseSession, Department, Role, Room, RoomDepartment, RoomKind
from ..schemas import CamelModel
from ..security import Principal, authenticate, require_roles
from ..services import audit

router = APIRouter(tags=["rooms"])


class RoomIn(CamelModel):
    code: str = Field(min_length=1, max_length=30)
    building: str = Field("", max_length=60)
    kind: RoomKind
    capacity: int = Field(ge=1, le=2000)
    department_ids: list[str] = Field(min_length=1, max_length=50)
    active: bool = True


class RoomUpdate(CamelModel):
    code: str | None = Field(None, min_length=1, max_length=30)
    building: str | None = Field(None, max_length=60)
    kind: RoomKind | None = None
    capacity: int | None = Field(None, ge=1, le=2000)
    department_ids: list[str] | None = Field(None, min_length=1, max_length=50)
    active: bool | None = None


def _out(db: Session, rooms: list[Room]) -> list[dict]:
    ids = [r.id for r in rooms]
    deps: dict[str, list[str]] = {}
    for rid, did in db.execute(select(RoomDepartment.room_id, RoomDepartment.department_id).where(RoomDepartment.room_id.in_(ids))) if ids else []:
        deps.setdefault(rid, []).append(did)
    used: dict[str, int] = {}
    for code, n in db.execute(select(func.lower(CourseSession.room), func.count()).group_by(func.lower(CourseSession.room))):
        used[code] = n
    return [{**r.d(), "departmentIds": sorted(deps.get(r.id, [])), "sessionCount": used.get(r.code.lower(), 0)} for r in rooms]


def _check_departments(db: Session, ids: list[str]) -> list[str]:
    ids = list(dict.fromkeys(ids))
    if db.scalar(select(func.count()).select_from(Department).where(Department.id.in_(ids))) != len(ids):
        raise bad_request("invalid_departments", "Every department must exist")
    return ids


def _code_free(db: Session, code: str, exclude_id: str | None = None) -> None:
    other = db.scalars(select(Room).where(func.lower(Room.code) == code.lower())).first()
    if other and other.id != exclude_id: raise conflict("room_code_taken", f"A room with the code {code} already exists")


@router.get("/rooms")
def list_rooms(department_id: str | None = Query(None, alias="departmentId"), kind: RoomKind | None = None,
               min_capacity: int | None = Query(None, alias="minCapacity", ge=1), active: Literal["true", "false", "all"] = "true",
               _: Principal = Depends(authenticate), db: Session = Depends(get_db)):
    q = select(Room)
    if active != "all": q = q.where(Room.active.is_(active == "true"))
    if kind: q = q.where(Room.kind == kind)
    if min_capacity: q = q.where(Room.capacity >= min_capacity)
    if department_id: q = q.where(Room.id.in_(select(RoomDepartment.room_id).where(RoomDepartment.department_id == department_id)))
    return {"items": _out(db, list(db.scalars(q.order_by(Room.building, Room.code))))}


@router.post("/rooms", status_code=201)
def create_room(body: RoomIn, request: Request, _: Principal = Depends(require_roles(Role.admin)), db: Session = Depends(get_db)):
    _code_free(db, body.code.strip())
    dept_ids = _check_departments(db, body.department_ids)
    r = Room(code=body.code.strip(), building=body.building.strip(), kind=body.kind, capacity=body.capacity, active=body.active)
    db.add(r); db.flush()
    db.add_all([RoomDepartment(room_id=r.id, department_id=d) for d in dept_ids])
    audit(db, request, "room.create", "room", r.id, {"code": r.code}); db.commit()
    return _out(db, [r])[0]


@router.put("/rooms/{room_id}")
def update_room(room_id: str, body: RoomUpdate, request: Request, _: Principal = Depends(require_roles(Role.admin)), db: Session = Depends(get_db)):
    r = db.get(Room, room_id)
    if not r: raise not_found("Room")
    data = body.model_dump(exclude_unset=True)
    dept_ids = data.pop("department_ids", None)
    old_code = r.code
    if "code" in data:
        data["code"] = data["code"].strip()
        _code_free(db, data["code"], exclude_id=r.id)
    if "building" in data: data["building"] = data["building"].strip()
    for k, v in data.items(): setattr(r, k, v)
    if r.code != old_code:  # timetables keep working: sessions refer to rooms by code
        for s in db.scalars(select(CourseSession).where(func.lower(CourseSession.room) == old_code.lower())): s.room = r.code
    if dept_ids is not None:
        keep = _check_departments(db, dept_ids)
        for link in db.scalars(select(RoomDepartment).where(RoomDepartment.room_id == r.id)): db.delete(link)
        db.flush()
        db.add_all([RoomDepartment(room_id=r.id, department_id=d) for d in keep])
    audit(db, request, "room.update", "room", r.id, {"fields": sorted(body.model_dump(exclude_unset=True))}); db.commit()
    return _out(db, [r])[0]


@router.delete("/rooms/{room_id}", status_code=204)
def delete_room(room_id: str, request: Request, _: Principal = Depends(require_roles(Role.admin)), db: Session = Depends(get_db)):
    r = db.get(Room, room_id)
    if not r: raise not_found("Room")
    if db.scalar(select(func.count()).select_from(CourseSession).where(func.lower(CourseSession.room) == r.code.lower())):
        raise conflict("room_in_use", "This room is used in timetables. Deactivate it instead of deleting it.")
    db.delete(r); audit(db, request, "room.delete", "room", room_id, {"code": r.code}); db.commit()
    return Response(status_code=204)
