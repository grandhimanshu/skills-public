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
