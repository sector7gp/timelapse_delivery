from datetime import timedelta
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
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

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

# --- Logs Endpoint ---
@router.get("/logs", response_model=List[schemas.DownloadLog])
def read_logs(skip: int = 0, limit: int = 100, current_user: models.User = Depends(security.get_current_active_user), db: Session = Depends(database.get_db)):
    """View download logs (assume all authenticated users can view, or restrict later)."""
    # Note: In a real system, you'd likely restrict this to an admin role.
    # We will restrict it to the admin@example.com for MVP.
    if current_user.email != "admin@example.com":
        raise HTTPException(status_code=403, detail="Not authorized to view logs")
        
    logs = crud.get_download_logs(db, skip=skip, limit=limit)
    return logs
