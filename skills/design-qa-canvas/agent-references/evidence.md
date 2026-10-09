# Gathering evidence (first build)

Everything stays local. Recordings, transcripts and frames go in `.git/info/exclude`, never `.gitignore`, and are never pushed.

**Use subagents.** Run one background Sonnet agent per source or app area, in parallel. You coordinate and verify, and you are the only writer of `issues.json`.

| Source | How (scripts in this skill's `scripts/`) |
|---|---|
| Recording → transcript | `transcribe.sh <video> <outdir>` (global `whisper-cli` + ggml-medium; never install mlx-whisper). VTT segment N = line N of the txt. |
| Who was speaking | `speaker-labels.sh <video> <out.txt>` OCRs the active-speaker tile every 10 s. Say "speaking around this point", not "raised this". Flag a person only for ≥ 30 s on the topic. |
| Frames | `grab-frame.sh <video> <sec> <out.jpg>` crops to the shared screen and skips dark talking-head frames. **Look at every frame.** If one is wrong, pick another moment of the same discussion. Keep frames cached (delete one to re-cut it). |
| Live page | Chrome, **new tab**, read-only: computed fonts, contrast, headings, loading states, stage logic. Number findings `A1, A2…`. Never click anything that saves data. |
| **Design reference (do this first)** | Get the design before anything else: Figma (frames per screen) or the design/demo repo (run it, open the same screens). **Ask the user which one is the reference if it's not obvious.** Capture the same screens on both sides and compare them pairwise. Issues are differences from the design, each citing the frame or file. |

## Parallel live audit (compare-to-design, not opinion)

Split the page by area (creation, state/stage logic, queues/lists, edge states). Launch one agent per area, each in **its own tab**. Each prompt is self-contained:

- **Rules:**
  - Read-only, unless the user authorised NEW test records with fictional data.
  - Never touch existing records, and nothing leaves the app.
  - Never sign in: on a login page, stop and report.
- **Scope:** the area, plus known findings to skip, **and the design reference for that area** (Figma frame links, or the design-repo route). Agents report differences from the design. Their own opinions are marked `"judgement": true`, low priority, major problems only.
- **Output:**
  - `live-review/shots/<agent>-NN.jpg`, one per finding.
  - `live-review/findings-<agent>.json` as `[{key, section, kind, priority, title, what, out, screenshot}]`.
  - `<agent>-log.md` listing records created and scenarios it couldn't reach.
- **Tips:** if a page loads forever, switch tab and back. Masked inputs drop keystrokes, so reuse existing test records.

Then verify as coordinator:
- Check every screenshot against its claim.
- Drop unverifiable, duplicate or agent-caused items, and rewrite overstated claims.
- Add the rest to `issues.json` with stable `A<n>` codes, rebuild, and set priorities.
- Report counts and the scenarios nobody reached.

If you can't see or measure something, say so.
