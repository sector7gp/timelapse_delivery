import os
from datetime import datetime
from fastapi import HTTPException
from pydantic import BaseModel

BASE_DIR = os.environ.get("BASE_VIDEO_DIR", "/tmp/videos")

def get_project_directory(directory_name: str) -> str:
    """Safely get the absolute path for a project, preventing path traversal."""
    # Ensure BASE_DIR is absolute
    base_path = os.path.abspath(BASE_DIR)
    
    # Create the project path and resolve it
    project_path = os.path.abspath(os.path.join(base_path, directory_name))
    
    # Verify the resolved path starts with the base_path
    if not project_path.startswith(base_path):
        raise HTTPException(status_code=400, detail="Invalid project directory name (potential path traversal)")
        
    return project_path

def get_video_file_path(directory_name: str, filename: str) -> str:
    """Safely get the absolute path for a specific video, preventing path traversal."""
    project_path = get_project_directory(directory_name)
    file_path = os.path.abspath(os.path.join(project_path, filename))
    
    if not file_path.startswith(project_path):
        raise HTTPException(status_code=400, detail="Invalid filename (potential path traversal)")
        
    return file_path

def scan_project_videos(directory_name: str):
    """Scan the directory for videos and return their metadata."""
    project_path = get_project_directory(directory_name)
    videos = []
    
    # Just in case directory doesn't exist, return empty list instead of failing
    if not os.path.exists(project_path) or not os.path.isdir(project_path):
        return videos
        
    for filename in os.listdir(project_path):
        file_path = os.path.join(project_path, filename)
        if os.path.isfile(file_path):
            stat = os.stat(file_path)
            videos.append({
                "filename": filename,
                "size": stat.st_size,
                "last_modified": datetime.fromtimestamp(stat.st_mtime)
            })
            
    return videos

def delete_video_file(directory_name: str, filename: str):
    """Safely delete a video file."""
    file_path = get_video_file_path(directory_name, filename)
    if os.path.exists(file_path):
        os.remove(file_path)
        return True
    return False
