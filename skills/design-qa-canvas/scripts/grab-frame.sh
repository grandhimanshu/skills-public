#!/usr/bin/env bash
# Cut one frame from a recording, cropped to the shared screen. Usage: grab-frame.sh <video> <seconds> <out.jpg> [crop=w:h:x:y]
# Default crop 1440:822:0:132 fits a 1920x1080 Meet recording (shared screen left, participant tiles right). Check the first frame by eye.
# Tries a few later offsets if the frame is dark (a talking-head tile instead of the screen share). Always LOOK at the result.
set -euo pipefail
video="$1"; t="$2"; out="$3"; crop="${4:-1440:822:0:132}"
for off in 0 6 14 26 42; do
  ffmpeg -y -loglevel error -ss $((t+off)) -i "$video" -frames:v 1 -vf "crop=$crop,scale=1280:-2" -q:v 3 "$out"
  mean=$(ffmpeg -loglevel error -i "$out" -vf scale=32:18 -f rawvideo -pix_fmt gray - | python3 -c "import sys;d=sys.stdin.buffer.read();print(sum(d)//max(len(d),1))")
  [ "$mean" -gt 60 ] && break
done
echo "$out (t=$((t+off))s)"
