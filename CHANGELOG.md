# Changelog - Video Distribution Portal

All notable changes to this project during this session are documented below.

## [v2.5.0] - 2026-03-23

### Added
- **Video Playback Interface**: 
    - Integration of a high-performance video player in a modal. 
    - Dedicated `/stream` API endpoint with optimized media types for in-browser playback. 
    - Secure token-based authentication via query parameters for media elements.
- **Automated Timelapse Rendering**: 
    - Script `render_timelapse.sh` for batch processing image folders into videos with high-quality FFmpeg filters (`deflicker`, `tmix`, `scale`).
    - Smart strategy to skip already rendered folders.
    - Automated logging to `render.log` with high-precision timestamps.
    - Post-render synchronization to remote servers via `rsync`.
- **User Personalization**: 
    - Added `full_name` column to the database and API.
    - Updated dashboard and admin views to display names instead of emails for a premium feel.
- **Branding Assets**:
    - Custom SVG-based Favicon integrated (v2.3+).

### Fixed & Improved
- **Mobile Responsiveness (v2.0)**: 
    - Complete redesign of the Admin User Management into a card-based layout for smartphones. 
    - Responsive navbar with auto-stacking and icon-only modes for extra-small screens.
    - Critical `z-index` layering fix for navigation buttons.
- **Stability**:
    - Fixed critical syntax error in `app.js` preventing login.
    - Fixed server-side `NameError` due to missing `Optional` import in `api.py`.
- **CDN Reliability**: 
    - Moved Unicons CDN to a more stable source (`v4.0.8`) to resolve font-parsing issues.

---

## Deployment & Automation Notes

### Automated Render Script (Cron Job)
To ensure timelapse videos are generated automatically as images arrive, it is highly recommended to add `render_timelapse.sh` to your **crontab**.

**Setup Instructions:**
1. Open your crontab editor:
   ```bash
   crontab -e
   ```
2. Add the following line to run the script every hour (or your preferred interval):
   ```bash
   0 * * * * /opt/apps/timelapse_delivery/render_timelapse.sh
   ```
   *Note: Ensure the script has execution permissions: `chmod +x /opt/apps/timelapse_delivery/render_timelapse.sh`*

---
*Created with the Video Distribution Portal Team.*
