#!/bin/bash

# Timelapse Rendering Script
# This script iterates through folders of images and generates a video for each folder.
# It uses ffmpeg for rendering and rsync for remote syncing.

# Load environment variables
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Configuration from .env
IMAGES_DIR=${TIMELAPSE_IMAGES_DIR:-"/home/sector7gp/tony_timelapse/images"}
VIDEOS_DIR=${TIMELAPSE_VIDEOS_DIR:-"/home/sector7gp/tony_timelapse/videos"}
REMOTE_DEST=${REMOTE_SYNC_DEST:-"sector7gp@192.168.1.100:/tmp/videos/Riva"}

# Ensure videos directory exists
mkdir -p "$VIDEOS_DIR"

echo "Starting timelapse rendering process..."
echo "Images Directory: $IMAGES_DIR"
echo "Videos Directory: $VIDEOS_DIR"

# Iterate through each date folder in the images directory
for dir in "$IMAGES_DIR"/*/; do
    # Get the folder name (e.g., 080326)
    folder_name=$(basename "$dir")
    video_output="$VIDEOS_DIR/${folder_name}.mp4"

    # Strategy: Skip if video already exists
    if [ -f "$video_output" ]; then
        echo "Skipping $folder_name: Video already exists at $video_output"
        continue
    fi

    echo "Processing folder: $folder_name"
    
    # Check if there are .jpg files in the folder
    if ! ls "$dir"img_*.jpg >/dev/null 2>&1; then
        echo "No images found in $dir matching 'img_*.jpg'. Skipping..."
        continue
    fi

    # FFmpeg command
    # -framerate 30
    # -pattern_type glob -i "img_*.jpg"
    # -vf "deflicker,tmix=frames=5:weights='1 2 3 2 1',scale=1080:1920"
    # -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p
    
    ffmpeg -y -framerate 30 -pattern_type glob -i "${dir}img_*.jpg" \
        -vf "deflicker,tmix=frames=5:weights='1 2 3 2 1',scale=1080:1920" \
        -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p "$video_output"

    if [ $? -eq 0 ]; then
        echo "Successfully generated: $video_output"
        
        # Rsync to remote location
        echo "Syncing $video_output to remote destination..."
        rsync -avz "$video_output" "$REMOTE_DEST/"
        
        if [ $? -eq 0 ]; then
            echo "Remote sync complete for $folder_name"
        else
            echo "Error syncing $folder_name to remote destination"
        fi
    else
        echo "Error generating video for $folder_name"
    fi
done

echo "Timelapse rendering process finished."
