# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Timelapse Delivery** is a video distribution portal built with FastAPI (Python backend) and vanilla JavaScript frontend. It enables users to organize videos into projects, stream/download them securely, and automatically render timelapses from image sequences. The app uses MariaDB for persistence, JWT for authentication, and can be deployed with PM2.

Core features:
- Multi-user authentication with role-based access (admin/regular users)
- Project-based video organization
- Video streaming and download with access logging
- Automated timelapse rendering from image folders via FFmpeg
- Remote synchronization via rsync

## Quick Start

### Environment Setup
```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt

# Copy and configure environment variables
cp .env.template .env
# Edit .env: set DATABASE_URL, SECRET_KEY, BASE_VIDEO_DIR, port
```

### Initialize Database & Server
```bash
# Set up database schema and create admin user
python init_db.py

# Create video directory (default: /tmp/videos/sample)
mkdir -p /tmp/videos/sample

# Start development server (auto-reload)
python3 -m backend.main
# Runs on http://localhost:8082 (or $PORT env var)
```

### Alternative: PM2 Deployment
```bash
# Start with PM2 (production-like environment)
pm2 start ecosystem.config.js

# Monitor processes
pm2 logs timelapse_delivery
pm2 stop timelapse_delivery
```

### Admin Setup
```bash
# Create additional admin user
python set_admin.py
```

## Architecture

### Backend (FastAPI)
**Files**: `backend/main.py`, `backend/api.py`, `backend/database.py`, `backend/models.py`, `backend/schemas.py`, `backend/crud.py`, `backend/security.py`, `backend/video_service.py`

**Flow**: 
- `main.py` initializes FastAPI app with CORS and static file serving (frontend)
- `api.py` defines all endpoints (auth, projects, videos, downloads, streaming)
- `security.py` handles JWT token creation/validation and password hashing (bcrypt)
- `database.py` configures SQLAlchemy ORM with MariaDB
- `models.py` defines User, Project, Video, DownloadLog database entities
- `schemas.py` defines Pydantic request/response models
- `crud.py` provides database query functions
- `video_service.py` scans filesystem for videos and validates file paths

**Key Patterns**:
- API uses dependency injection (`Depends`) for auth and DB sessions
- JWT tokens include user email and admin status; validated per request
- Projects are user-owned; endpoints verify ownership before granting access
- Video files are scanned from filesystem (not stored in DB) by `video_service.scan_project_videos()`
- Auth supports header token OR query param (`?auth_token=...`) for HTML `<video>` elements

### Frontend (Vanilla JS)
**Files**: `frontend/index.html`, `frontend/app.js`, `frontend/style.css`, `frontend/favicon.svg`

**Structure**:
- Single-page app (no build step; served directly by FastAPI)
- `index.html` is the entry point, referenced in `main.py`
- `app.js` handles all client logic: login, project browsing, video playback/download, admin user management
- `style.css` includes responsive design with mobile-first breakpoints

**Key Features**:
- Login/logout with JWT token storage (localStorage)
- Admin panel for creating users (POST `/api/auth/register` if enabled)
- Video player in modal with HTML5 `<video>` tag
- Download buttons with activity logging
- Responsive navbar with collapsible menu for mobile

### Database (MariaDB)
- Uses SQLAlchemy ORM; migrations not tracked (schema created by `init_db.py`)
- Tables: `user`, `project`, `download_log`
- Foreign keys enforce referential integrity

### Video Processing
- `render_timelapse.sh`: Bash script for batch timelapse rendering
  - Reads images from `$TIMELAPSE_IMAGES_DIR` (env var)
  - Uses FFmpeg filters (deflicker, tmix, scale) for quality
  - Outputs to `$TIMELAPSE_VIDEOS_DIR`
  - Syncs results via `rsync` to `$REMOTE_SYNC_DEST`
  - Logs to `render.log` with timestamps
- Recommended to run hourly via cron: `0 * * * * /path/to/render_timelapse.sh`

## Configuration

All config via `.env` file (see `.env.template`):

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `mysql+pymysql://root:password@localhost:3306/video_portal` | MariaDB connection string |
| `SECRET_KEY` | (required) | JWT signing key; generate with `openssl rand -hex 32` |
| `PORT` | `8082` | Server port |
| `ALGORITHM` | `HS256` | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` | Token TTL (24 hours default) |
| `BASE_VIDEO_DIR` | `/tmp/videos` | Root directory for user project folders |
| `TIMELAPSE_IMAGES_DIR` | `./images` | Source for timelapse image batches |
| `TIMELAPSE_VIDEOS_DIR` | `./videos` | Output for rendered timelapses |
| `REMOTE_SYNC_DEST` | (optional) | rsync target for post-render sync |

## Development Workflow

### Adding an API Endpoint
1. Define request/response models in `backend/schemas.py` (Pydantic)
2. Add database logic in `backend/crud.py` if needed
3. Implement endpoint in `backend/api.py` with `@router` decorator
4. Use `Depends(database.get_db)` for DB session, `Depends(security.get_current_active_user)` for auth
5. Restart dev server (auto-reload on file changes)

### Modifying Frontend
- Edit `frontend/app.js` (JS logic) or `frontend/style.css` (styling)
- No build step; changes visible after browser refresh
- Open browser DevTools console for debugging

### Database Schema Changes
- Edit `init_db.py` to update `Base.metadata.create_all()` definitions
- Re-run `python init_db.py` to apply changes (WARNING: drops existing tables)
- For production, consider migrations (SQLAlchemy Alembic)

### Testing Authentication Locally
```bash
# Login (returns JWT token)
curl -X POST http://localhost:8082/api/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin@example.com&password=admin123"

# Use token in requests
curl http://localhost:8082/api/auth/me \
  -H "Authorization: Bearer <token>"
```

### Video Streaming Issues
- Stream endpoint uses query param auth for `<video>` tags: `/api/projects/{id}/videos/{filename}/stream?auth_token={token}`
- Ensure FFmpeg is installed for timelapse rendering
- Check `render.log` for batch job errors

## Common Issues & Fixes

| Issue | Diagnosis | Fix |
|-------|-----------|-----|
| 401 on stream endpoint | Token invalid or missing | Use query param `?auth_token=...` in `<video src=...>` |
| "Project not found" | User doesn't own project | Verify `project.user_id == current_user.id` in `api.py` |
| Video files not listed | `scan_project_videos()` fails | Ensure `BASE_VIDEO_DIR/project_folder` exists; check file permissions |
| Database connection refused | MariaDB not running or wrong creds | Verify MariaDB service and `DATABASE_URL` in `.env` |
| Timelapse not rendering | `render_timelapse.sh` not executable | `chmod +x render_timelapse.sh`; check cron logs (`tail /var/log/cron`) |

## File Structure Summary

```
timelapse_delivery/
├── backend/               # FastAPI application
│   ├── main.py           # App initialization & routing
│   ├── api.py            # Route handlers
│   ├── security.py       # JWT & password logic
│   ├── database.py       # SQLAlchemy setup
│   ├── models.py         # ORM models
│   ├── schemas.py        # Pydantic models
│   ├── crud.py           # DB queries
│   └── video_service.py  # Video filesystem scanning
├── frontend/             # Vanilla JS SPA
│   ├── index.html        # HTML shell
│   ├── app.js            # Client logic
│   ├── style.css         # Styling
│   └── favicon.svg       # Logo
├── venv/                 # Virtual environment
├── init_db.py            # Database initialization
├── set_admin.py          # Admin user creation
├── render_timelapse.sh   # FFmpeg batch processor
├── ecosystem.config.js   # PM2 configuration
├── requirements.txt      # Python dependencies
├── .env.template         # Configuration template
├── README.md             # User-facing docs (Spanish)
├── CHANGELOG.md          # Version history
└── CLAUDE.md             # This file
```

## Performance Notes

- Vanilla JS means no module bundler; keep `app.js` organized with clear function sections
- Video streaming uses `FileResponse`; large files may benefit from range-request handling (currently not implemented)
- Database schema is minimal (no indexes); add indexes if query performance degrades
- Timelapse rendering is I/O-bound; consider parallelizing with `xargs` if processing many folders

## Security Reminders

- `SECRET_KEY` in `.env` must be a strong random value; never commit `.env` to git
- JWT tokens expire after `ACCESS_TOKEN_EXPIRE_MINUTES`; extend if needed for long-running uploads
- Project access is user-scoped; all endpoints verify `project.user_id == current_user.id`
- Video streaming auth via token prevents unauthorized access to private videos
- FFmpeg filters in `render_timelapse.sh` are safe; validate image sources if adding user uploads
