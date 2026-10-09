# Skills & Agents

A collection of reusable skills and agents for AI coding tools (Claude Code, Cursor, and others).

## Structure

```
skills/          # Skill definitions — copy to ~/.claude/skills/ or ~/.cursor/skills/
  <skill-name>/
    SKILL.md     # Main skill file (YAML frontmatter + instructions)
    ...          # Supporting files (templates, docs, scripts)

agents/          # Agent definitions — copy to ~/.claude/agents/ or ~/.cursor/agents/
  <agent-name>.md
```

## Skills

| Skill | Description |
|-------|-------------|
| [keyboard-audit](skills/keyboard-audit/) | Tests keyboard interactions for Storybook components against WCAG 2.2 AA. Navigates stories via Chrome MCP, checks focus/activation/dismiss behaviors, and writes a markdown report. |
| [design-qa-canvas](skills/design-qa-canvas/) | Turns a recording, screenshots or a live page into a reviewable design-QA canvas: numbered, prioritised issues on a pan/zoom canvas, comments that are tasks for Claude, a live screenshot inbox, and the watch loop that works them. Needs Node and Python 3. |
| [workflow-canvas](skills/workflow-canvas/) | Lays out a product flow as screenshots joined by labelled arrows, with the same comment-as-task loop, keyboard walk-through of each flow, and before/after compare. Needs Node and Python 3. |

## Agents

_None yet._

## Installation

Copy the skill folder into your tool's skills directory:

```bash
# Claude Code
cp -r skills/keyboard-audit ~/.claude/skills/

# Cursor
cp -r skills/keyboard-audit ~/.cursor/skills/
```
