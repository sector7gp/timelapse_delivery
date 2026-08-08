import os
import subprocess
from datetime import datetime
from fastapi import HTTPException
from pydantic import BaseModel

BASE_DIR = os.environ.get("BASE_VIDEO_DIR", "/tmp/videos")
THUMBNAILS_DIR = os.path.join(BASE_DIR, ".thumbnails")

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
    """Scan the directory for videos and return their metadata, sorted by date (newest first)."""
    project_path = get_project_directory(directory_name)
    print(f"DEBUG: Scanning path: {project_path}")
    videos = []

    if not os.path.exists(project_path):
        print(f"DEBUG: Path DOES NOT EXIST: {project_path}")
        return videos

    if not os.path.isdir(project_path):
        print(f"DEBUG: Path is NOT a directory: {project_path}")
        return videos

    items = os.listdir(project_path)
    print(f"DEBUG: Found {len(items)} items in directory: {items}")

    for filename in items:
        file_path = os.path.join(project_path, filename)
        if os.path.isfile(file_path):
            stat = os.stat(file_path)
            thumbnail = generate_thumbnail(directory_name, filename)
            videos.append({
                "filename": filename,
                "size": stat.st_size,
                "last_modified": datetime.fromtimestamp(stat.st_mtime),
                "thumbnail": thumbnail
            })
            print(f"DEBUG: Added video: {filename} ({stat.st_size} bytes)")
        else:
            print(f"DEBUG: Skipping non-file item: {filename}")

    videos.sort(key=lambda v: v["last_modified"], reverse=True)
    return videos

def generate_thumbnail(directory_name: str, filename: str) -> str:
    """Generate a thumbnail for a video file. Returns the thumbnail filename or None."""
    try:
        os.makedirs(THUMBNAILS_DIR, exist_ok=True)
        file_path = get_video_file_path(directory_name, filename)

        if not os.path.exists(file_path):
            print(f"DEBUG: Video file not found: {file_path}")
            return None

        # Create a safe thumbnail filename
        thumb_name = f"{os.path.splitext(filename)[0]}.jpg"
        thumb_path = os.path.join(THUMBNAILS_DIR, thumb_name)

        # Only generate if doesn't exist
        if not os.path.exists(thumb_path):
            print(f"DEBUG: Generating thumbnail for {filename} -> {thumb_path}")
            result = subprocess.run([
                'ffmpeg', '-i', file_path,
                '-ss', '00:00:01',
                '-vframes', '1',
                '-vf', 'scale=320:180',
                '-q:v', '3',
                '-y',  # Overwrite output
                thumb_path
            ], capture_output=True, timeout=30, text=True)

            if result.returncode != 0:
                print(f"DEBUG: FFmpeg error for {filename}: {result.stderr}")
                return None

            if not os.path.exists(thumb_path):
                print(f"DEBUG: Thumbnail was not created for {filename}")
                return None

            print(f"DEBUG: Thumbnail created successfully: {thumb_name}")
            return thumb_name
        else:
            print(f"DEBUG: Thumbnail already exists: {thumb_name}")
            return thumb_name

    except subprocess.TimeoutExpired:
        print(f"Error: FFmpeg timeout for {filename}")
        return None
    except Exception as e:
        print(f"Error generating thumbnail for {filename}: {e}")
        return None

def delete_video_file(directory_name: str, filename: str):
    """Safely delete a video file."""
    file_path = get_video_file_path(directory_name, filename)
    if os.path.exists(file_path):
        os.remove(file_path)
        return True
    return False
