#!/usr/bin/env bash
# Read the active-speaker name tile every N seconds from a meeting recording (Meet/Zoom show the speaker's name bottom-right).
# Usage: speaker-labels.sh <video> <out.txt> [every_sec=10] [crop=w:h:x:y at 1280-wide]   default crop 330:36:950:420
# Output lines: "n0001.png <name>"  -> time of sample N = (N-1)*every_sec. Attribution is "who was talking", not "who raised the point".
set -euo pipefail
video="$1"; out="$2"; every="${3:-10}"; crop="${4:-330:36:950:420}"
here="$(cd "$(dirname "$0")" && pwd)"; tmp="$(mktemp -d)"
ffmpeg -y -loglevel error -i "$video" -vf "fps=1/$every,scale=1280:-2,crop=$crop" "$tmp/n%04d.png"
[ -x "$here/.ocr" ] || swiftc -O "$here/ocr-speaker-labels.swift" -o "$here/.ocr"
"$here/.ocr" "$tmp" > "$out"; rm -rf "$tmp"
awk '{ $1=""; print }' "$out" | sort | uniq -c | sort -rn | head -12
