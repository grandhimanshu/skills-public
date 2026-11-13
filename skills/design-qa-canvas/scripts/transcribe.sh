#!/usr/bin/env bash
# Transcribe a recording locally. Usage: transcribe.sh <video> <outdir> [name]
# Uses the global Homebrew `whisper-cli` + ~/.cache/whisper-cpp/models/ggml-medium.bin (already installed on this machine —
# do NOT install mlx-whisper). Produces <name>.txt and <name>.vtt; VTT segment N == line N of the txt.
# Keep the outputs LOCAL (add to .git/info/exclude) — transcripts and recordings are never pushed.
set -euo pipefail
video="$1"; out="${2:-.}"; name="${3:-$(basename "${video%.*}" | tr ' /' '__')}"
model="${WHISPER_MODEL:-$HOME/.cache/whisper-cpp/models/ggml-medium.bin}"
mkdir -p "$out"
ffmpeg -y -loglevel error -i "$video" -vn -ac 1 -ar 16000 "$out/$name.wav"
whisper-cli -m "$model" -f "$out/$name.wav" -l auto -otxt -ovtt -of "$out/$name" > "$out/$name.log" 2>&1
rm -f "$out/$name.wav"
echo "$out/$name.txt  $out/$name.vtt"
