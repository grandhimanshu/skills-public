---
name: keyboard-audit
description: Tests keyboard interactions for Storybook components against WCAG 2.2 AA and repo interaction docs. Navigates stories via Chrome MCP, checks focus/activation/dismiss behaviors, and writes a markdown report. Use when auditing keyboard accessibility for one or all components. Args: optional comma-separated component names or group names (e.g. "Button, Dropdown" or "chat").
---

# Keyboard Audit Skill

You are the **orchestrator** for a keyboard accessibility audit. You coordinate agents, manage files, and present results. You do no discovery, testing, or browser work yourself — all of that is delegated.

---

## Phase 0: Kickoff

**Resolve `skillRoot`:** Run `echo "$HOME/.claude/skills/keyboard-audit"` — save as `skillRoot`. All agent instruction files live here.

### 0a. Ask for Storybook URL

> "What URL is Storybook running on? (e.g. http://localhost:6006)"

Note any scope args passed to the skill (component names or group names). If none, scope is "all".

### 0b. Spawn the Discovery Agent

```
Read <skillRoot>/discovery-agent.md and follow its instructions exactly.

Storybook URL: <storybookUrl>
Scope args:    <args or "all">
Today's date:  <YYYYMMDD>
```

Wait for it to return a `DISCOVERY_RESULT` or `PREFLIGHT_FAILED` block.

- **`PREFLIGHT_FAILED`** → show the failure to the user and stop.
- **`DISCOVERY_RESULT`** → extract `runId`, `total_batches`, `total_components`, `scope`, and all batch data.

### 0c. Show Plan & Wait for Confirmation

```
## Keyboard Audit Plan — <runId>

Storybook: <storybookUrl>
Scope: <scope>

### Batches (<N> batches, <M> components, running in parallel):

#### Batch 1 — <label> (N stories)
- ComponentA: Story1 [story-id], Story2 [story-id]
  [excluded: X (size variant)]
- ComponentB: Story1 [story-id]

#### Batch 2 — ...

Ready to start? (yes / skip <Component> / stop)
```

- `"yes"` / `"go"` → proceed
- `"skip X"` → remove X from batch data, re-number if needed
- `"stop"` / `"cancel"` → abort

---

## Phase 1: Initialize Files

Resolve absolute paths (audit agents run in isolated worktrees — relative paths won't work):
- `repoRoot`         = absolute path to this repo
- `progressPath`     = `<repoRoot>/keyboard-audit/PROGRESS-<runId>.md`
- `batchFilePath(N)` = `<repoRoot>/keyboard-audit/batch-<N>-<runId>.md`
- `finalReportPath`  = `<repoRoot>/keyboard-audit/FINAL-REPORT-<runId>.md`

**Create `progressPath`** (orchestrator-owned — only you write to this):
```markdown
# Keyboard Audit Progress — <runId>

**Started:** <datetime>
**Storybook:** <url>
**Scope:** <scope>

## Batches

| Batch | Label | Batch File | Status |
|-------|-------|-----------|--------|
| 1 | <label> | <repoRoot>/keyboard-audit/batch-1-<runId>.md | ⏳ pending |
| 2 | <label> | <repoRoot>/keyboard-audit/batch-2-<runId>.md | ⏳ pending |

## Files
- Final report:   <finalReportPath>

## How to Resume (if interrupted)
1. Open a new Claude Code session.
2. Read this file — see which batches completed vs pending.
3. Read each batch file for its status.
4. Run `/keyboard-audit` and say:
   "Resume audit <runId>. Storybook at <url>. Batches done: <list>. Continue from batch <N>."
```

> **Do not pre-create batch files.** Each audit agent creates its own `batch-N-<runId>.md` on startup.

---

## Phase 2: Spawn Audit Agents + Monitor

In a **single message**, spawn all audit agents in parallel and start the monitor loop.

### Audit agent prompt (one per batch)

**Do not paste audit-agent.md** — pass the file path:

```
Read <skillRoot>/audit-agent.md and follow its instructions exactly.

Storybook URL:  <storybookUrl>
Batch file:     <repoRoot>/keyboard-audit/batch-<N>-<runId>.md
Batch number:   <N>
Batch label:    <label>

Components to test:
- <ComponentA>:
  - <StoryName> → story ID: `<story-id>`
  - <StoryName> → story ID: `<story-id>`
- <ComponentB>:
  - <StoryName> → story ID: `<story-id>`
```

Spawn with: `subagent_type: "general-purpose"`, `isolation: "worktree"`

### Monitor loop prompt

```
Read <skillRoot>/monitor-agent.md and follow its instructions exactly.

Progress file:  <progressPath>
Run ID:         <runId>
Total batches:  <N>
Storybook URL:  <storybookUrl>
Check number:   1
```

Start with: `Skill("loop", "5m <monitor-prompt>")`

### While waiting

- Monitor is silent when healthy — only alerts on stuck/broken batches.
- On monitor alert: re-spawn the affected batch if broken, check Chrome MCP if stuck.
- On "spawn fresh monitor": increment `Check number`, restart the loop.
- On **context warning/critical** for a batch:
  1. Read that batch file — note which components already have results vs which don't.
  2. When the agent finishes (or dies), diff assigned components vs completed ones.
  3. If any components are untested, spawn a **new audit agent** for just those, using batch number `<N>b` (e.g., `3b`) so it gets its own file without overwriting the partial results.
  4. Add a row to `progressPath` for the continuation batch.

### After all audit agents complete

1. **Stop the monitor loop.**
2. Update `progressPath` — mark all batch rows `✅ done`.
3. Print to user: `✅ All batches done — spawning report agent.`

---

## Phase 3: Spawn Report Agent

```
Read <skillRoot>/report-agent.md and follow its instructions exactly.

Run ID:          <runId>
Scope:           <scope>
Storybook URL:   <storybookUrl>
Repo root:       <repoRoot>
Final report:    <finalReportPath>
```

Wait for it to complete, then tell the user:

```
## Keyboard Audit Complete — <runId>

Tested: N components | N interactions
✅ Pass: N  ❌ Fail: N  ⚠️ Partial: N  ⏭️ Skip: N
🔴 Critical: N  🟠 Major: N  🟡 Minor: N

Final report: keyboard-audit/FINAL-REPORT-<runId>.md
```

---

## Orchestrator Constraints

- **Never do browser work** — all discovery and testing is delegated to agents
- **Never paste agent instruction files** — always pass the file path, never the contents
- **Never assume a Storybook URL** — always ask the user first
- **Never suggest fixes** — report bugs only
- **Always use absolute paths** for all file variables
- **Always spawn audit agents with `isolation: "worktree"`**
- **Only you write to `progressPath`** — audit agents write only to their own batch files
- If Chrome MCP becomes unreachable mid-audit: stop, save progress, tell the user
