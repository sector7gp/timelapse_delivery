from datetime import timedelta
import os
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from . import crud, models, schemas, database, security, video_service

router = APIRouter()

# --- Auth Endpoints ---
@router.post("/auth/login", response_model=schemas.Token)
def login_for_access_token(db: Session = Depends(database.get_db), form_data: OAuth2PasswordRequestForm = Depends()):
    user = crud.get_user_by_email(db, email=form_data.username)
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=security.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        data={"sub": user.email, "is_admin": user.is_admin}, 
        expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/auth/me", response_model=schemas.User)
def read_current_user(current_user: models.User = Depends(security.get_current_active_user)):
    """Check the current user's profile and status."""
    return current_user

# --- Project & Video Endpoints ---
@router.get("/projects", response_model=List[schemas.Project])
def read_projects(current_user: models.User = Depends(security.get_current_active_user), db: Session = Depends(database.get_db)):
    """List projects for the authenticated user."""
    projects = crud.get_projects_by_user(db, user_id=current_user.id)
    return projects

@router.get("/projects/{project_id}/videos", response_model=List[schemas.Video])
def read_project_videos(project_id: int, current_user: models.User = Depends(security.get_current_active_user), db: Session = Depends(database.get_db)):
    """List videos within a specific project."""
    project = crud.get_project_by_id(db, project_id=project_id)
    if not project or project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found or access denied")
    
    videos = video_service.scan_project_videos(project.directory_name)
    return videos

# --- Download & Delete Endpoints ---
@router.get("/projects/{project_id}/videos/{filename}/download")
def download_video(project_id: int, filename: str, request: Request, current_user: models.User = Depends(security.get_current_active_user), db: Session = Depends(database.get_db)):
    """Download a video and log the activity."""
    project = crud.get_project_by_id(db, project_id=project_id)
    if not project or project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found or access denied")
        
    try:
        file_path = video_service.get_video_file_path(project.directory_name, filename)
    except HTTPException as e:
        raise e
        
    import os
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Video file not found")
        
    # Log the download
    client_ip = request.client.host if request.client else "Unknown"
    log_data = schemas.DownloadLogCreate(filename=filename, project_id=project.id, ip_address=client_ip)
    crud.create_download_log(db, log=log_data, user_id=current_user.id)
    
    return FileResponse(path=file_path, filename=filename, media_type='application/octet-stream')

@router.get("/projects/{project_id}/videos/{filename}/stream")
def stream_video(project_id: int, filename: str, auth_token: Optional[str] = None, db: Session = Depends(database.get_db)):
    """Stream a video for in-browser playback with query param auth."""
    # We call security.get_current_user manually to handle the query param auth
    current_user = security.get_current_user(token=None, db=db, auth_token=auth_token)
    project = crud.get_project_by_id(db, project_id=project_id)
    if not project or project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found or access denied")
        
    try:
        file_path = video_service.get_video_file_path(project.directory_name, filename)
    except HTTPException as e:
        raise e
        
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Video file not found")
        
    return FileResponse(path=file_path, media_type='video/mp4')

@router.delete("/projects/{project_id}/videos/{filename}")
def delete_video(project_id: int, filename: str, current_user: models.User = Depends(security.get_current_active_user), db: Session = Depends(database.get_db)):
    """Delete a video securely."""
    project = crud.get_project_by_id(db, project_id=project_id)
    if not project or project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Project not found or access denied")
        
    success = video_service.delete_video_file(project.directory_name, filename)
    if not success:
        raise HTTPException(status_code=404, detail="File could not be deleted or does not exist")
        
    return {"message": "Video successfully deleted"}

# --- Dependency for Admin check ---
def get_current_admin_user(current_user: models.User = Depends(security.get_current_active_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to perform administrative actions")
    return current_user

# --- Admin Endpoints ---
@router.get("/admin/users", response_model=List[schemas.User])
def admin_read_users(skip: int = 0, limit: int = 100, current_user: models.User = Depends(get_current_admin_user), db: Session = Depends(database.get_db)):
    return crud.get_all_users(db, skip=skip, limit=limit)

@router.post("/admin/users", response_model=schemas.User)
def admin_create_user(user: schemas.UserCreate, current_user: models.User = Depends(get_current_admin_user), db: Session = Depends(database.get_db)):
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    return crud.create_user(db=db, user=user)

@router.patch("/admin/users/{user_id}", response_model=schemas.User)
def admin_update_user(user_id: int, user_update: schemas.UserUpdate, current_user: models.User = Depends(get_current_admin_user), db: Session = Depends(database.get_db)):
    db_user = crud.update_user(db=db, user_id=user_id, user_update=user_update)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user

@router.delete("/admin/users/{user_id}")
def admin_delete_user(user_id: int, current_user: models.User = Depends(get_current_admin_user), db: Session = Depends(database.get_db)):
    success = crud.delete_user(db=db, user_id=user_id)
    if not success:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted successfully"}

@router.post("/admin/users/{user_id}/projects", response_model=schemas.Project)
def admin_create_user_project(user_id: int, project: schemas.ProjectCreate, current_user: models.User = Depends(get_current_admin_user), db: Session = Depends(database.get_db)):
    db_user = crud.get_user(db, user_id=user_id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Validation: Check if directory exists
    try:
        project_path = video_service.get_project_directory(project.directory_name)
        if not os.path.isdir(project_path):
            raise HTTPException(status_code=400, detail=f"Directory '{project.directory_name}' does not exist on the server")
    except HTTPException as e:
        raise e
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid directory name")

    return crud.create_project(db=db, project=project, user_id=user_id)

@router.get("/admin/users/{user_id}/projects", response_model=List[schemas.Project])
def admin_read_user_projects(user_id: int, current_user: models.User = Depends(get_current_admin_user), db: Session = Depends(database.get_db)):
    db_user = crud.get_user(db, user_id=user_id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user.projects

@router.delete("/admin/projects/{project_id}")
def admin_delete_project(project_id: int, current_user: models.User = Depends(get_current_admin_user), db: Session = Depends(database.get_db)):
    success = crud.delete_project(db=db, project_id=project_id)
    if not success:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"message": "Project deleted successfully"}

# --- Logs Endpoint ---
@router.get("/logs", response_model=List[schemas.DownloadLog])
def read_logs(skip: int = 0, limit: int = 100, current_user: models.User = Depends(security.get_current_active_user), db: Session = Depends(database.get_db)):
    """View download logs."""
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to view logs")
        
    logs = crud.get_download_logs(db, skip=skip, limit=limit)
    return logs
