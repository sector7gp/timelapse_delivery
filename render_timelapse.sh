#!/bin/bash

# Timelapse Rendering Script
# This script iterates through folders of images and generates a video for each folder.
# It uses ffmpeg for rendering and rsync for remote syncing.

# Load environment variables
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Configuration from .env
IMAGES_DIR=${TIMELAPSE_IMAGES_DIR:-"./images"}
VIDEOS_DIR=${TIMELAPSE_VIDEOS_DIR:-"./videos"}
REMOTE_DEST=${REMOTE_SYNC_DEST:-"user@192.168.1.1:/tmp/videos/proyecto1"}

# Local logging setup
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$SCRIPT_DIR/render.log"

# Function to log with timestamp
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Redirect all output to log file AND console
exec > >(tee -a "$LOG_FILE") 2>&1

# Ensure videos directory exists
mkdir -p "$VIDEOS_DIR"

log_message "Starting timelapse rendering process..."
log_message "Images Directory: $IMAGES_DIR"
log_message "Videos Directory: $VIDEOS_DIR"
log_message "Logging to: $LOG_FILE"

# Iterate through each date folder in the images directory
for dir in "$IMAGES_DIR"/*/; do
    # Get the folder name (e.g., 080326)
    folder_name=$(basename "$dir")
    video_output="$VIDEOS_DIR/${folder_name}.mp4"

    # Strategy: Skip if video already exists
    if [ -f "$video_output" ]; then
        log_message "Skipping $folder_name: Video already exists at $video_output"
        continue
    fi

    log_message "Processing folder: $folder_name"
    
    # Check if there are .jpg files in the folder
    if ! ls "$dir"img_*.jpg >/dev/null 2>&1; then
        log_message "No images found in $dir matching 'img_*.jpg'. Skipping..."
        continue
    fi
    
    #preset un poco lento
    #ffmpeg -y -framerate 30 -pattern_type glob -i "${dir}img_*.jpg" \
    #    -vf "deflicker,tmix=frames=5:weights='1 2 3 2 1',scale=1080:1920" \
    #    -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p "$video_output"

    #preset mas rapido, pesa mas el archivo
    #ffmpeg -framerate 30 -pattern_type glob -i "${dir}img_*.jpg" \
    #    -vf "deflicker,tmix=frames=5:weights='1 2 3 2 1',scale=1080:1920,format=yuv420p" \
    #    -c:v libx264 -preset ultrafast -crf 22 -threads 0 \
   #     -y "$video_output"

    #con el MB mas suave
    ffmpeg -framerate 30 -pattern_type glob -i "${dir}img_*.jpg" \
        -vf "deflicker,tmix=frames=3:weights='1 3 1',scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p" \
        -c:v libx264 -preset ultrafast -crf 20 -threads 0 \
        -y "$video_output"

    if [ $? -eq 0 ]; then
        log_message "Successfully generated: $video_output"
    else
        log_message "Error generating video for $folder_name"
    fi
done

# Sync all videos to remote location at the end
log_message "Starting final sync to remote destination: $REMOTE_DEST"
rsync -avz "$VIDEOS_DIR/" "$REMOTE_DEST/"

if [ $? -eq 0 ]; then
    log_message "Remote sync complete for all files."
else
    log_message "Error during final remote sync."
fi

log_message "Timelapse rendering process finished."
