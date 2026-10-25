from fastapi import APIRouter, Depends, File as FormFile, Request, Response, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session
from urllib.parse import quote

from ..db import get_db
from ..errors import bad_request, forbidden, not_found
from ..models import CourseDocument, CourseTeacher, DocKind, Enrollment, EnrollmentStatus, File, Role
from ..security import Principal, authenticate, role_allowed
from ..services import audit, read_upload, remove_stored, save_file, sniff_mime, stored_path

router = APIRouter(tags=["files"])


@router.post("/files", status_code=201)
async def upload(request: Request, file: UploadFile = FormFile(...), p: Principal = Depends(authenticate), db: Session = Depends(get_db)):
    data = await read_upload(file)
    if not data: raise bad_request("file_required")
    f = save_file(db, data, p.user_id, file.filename or "file", sniff_mime(data))
    audit(db, request, "file.upload", "file", f.id, {"size": f.size}); db.commit()
    return {"id": f.id, "name": f.name, "mime": f.mime, "size": f.size, "createdAt": f.d()["createdAt"]}


@router.get("/files/{file_id}")
def download(file_id: str, request: Request, p: Principal = Depends(authenticate), db: Session = Depends(get_db)):
    f = db.get(File, file_id)
    if not f: raise not_found("File")
    allowed = f.owner_id == p.user_id or role_allowed(p.role, [Role.admin])
    if not allowed:
        doc = db.scalars(select(CourseDocument).where(CourseDocument.file_id == file_id)).first()
        if doc:
            if doc.kind == DocKind.syllabus: allowed = True  # syllabi are part of the public course catalog
            elif p.role == Role.teacher: allowed = db.get(CourseTeacher, (doc.course_id, p.user_id)) is not None
            elif p.role == Role.student:
                allowed = db.scalars(select(Enrollment.id).where(Enrollment.course_id == doc.course_id, Enrollment.student_id == p.user_id,
                                                                 Enrollment.status == EnrollmentStatus.enrolled)).first() is not None
    if not allowed: raise forbidden()
    audit(db, request, "file.download", "file", file_id); db.commit()
    return FileResponse(stored_path(f.storage_key), media_type=f.mime, headers={
        "x-content-type-options": "nosniff", "content-disposition": f"attachment; filename*=UTF-8''{quote(f.name)}"})


@router.delete("/files/{file_id}", status_code=204)
def delete(file_id: str, request: Request, p: Principal = Depends(authenticate), db: Session = Depends(get_db)):
    f = db.get(File, file_id)
    if not f: raise not_found("File")
    if f.owner_id != p.user_id and not role_allowed(p.role, [Role.admin]): raise forbidden()
    for d in db.scalars(select(CourseDocument).where(CourseDocument.file_id == file_id)): db.delete(d)
    key = f.storage_key
    db.delete(f); audit(db, request, "file.delete", "file", file_id); db.commit()
    remove_stored(key)
    return Response(status_code=204)
