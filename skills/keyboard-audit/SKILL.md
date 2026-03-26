---
name: keyboard-audit
description: Tests keyboard interactions for Storybook components against WCAG 2.2 AA and repo interaction docs. Navigates stories via Chrome MCP, checks focus/activation/dismiss behaviors, and writes a markdown report. Use when auditing keyboard accessibility for one or all components. Args: optional comma-separated component names (e.g. "Button, Dropdown").
---

# Keyboard Audit Skill

You are a keyboard accessibility auditor for a React design system Storybook. Your job is to **find and report** keyboard interaction bugs — never fix them.

## Invocation

```
/keyboard-audit [optional: ComponentName1, ComponentName2, ...]
```

- **With args:** test only the named components
- **No args:** discover and test all components via the Storybook sidebar

---

## Phase 1: Setup & Verification (MANDATORY FIRST STEP)

1. **Ask the user for the Storybook URL.** Say:
   > "What URL is Storybook running on? (e.g. http://localhost:5000, http://localhost:6006, or a remote URL)"

2. Use `mcp__Claude_in_Chrome__navigate` to load the provided URL.

3. Use `mcp__Claude_in_Chrome__get_page_text` or `mcp__Claude_in_Chrome__read_page` to confirm Storybook loaded (look for sidebar or story content).

4. If it fails: **STOP.** Tell the user Storybook isn't reachable at that URL and ask them to confirm it's running.

5. Record:
   - `storybookUrl` = the confirmed URL
   - `runId` = `keyboard-audit-<YYYYMMDD-HHMM>` (use current date/time)
   - `reportPath` = `keyboard-audit/KEYBOARD_AUDIT_REPORT-<runId>.md`

---

## Phase 2: Component Discovery

**If component names were provided as args:**
- Use those names. Find their entries in the Storybook sidebar to confirm they exist.

**If no args:**
- Use `mcp__Claude_in_Chrome__read_page` or `mcp__Claude_in_Chrome__get_page_text` to read the sidebar.
- Extract all component names (they appear as expandable groups in the sidebar).
- Print the list to the user: "Found N components. Starting audit..."

---

## Phase 3: Per-Component Testing Loop (sequential)

Repeat the following for each component:

### 3a. Find Interaction Docs

Search the repo for this component's keyboard interaction documentation:

```
Glob: docs/src/pages/components/<component-name-lowercase>/interactions.mdx
Glob: docs/src/pages/components/<component-name-lowercase>/*.md
```

- Read the file if found. Extract every keyboard interaction claim (Tab, Enter, Space, Escape, arrows, etc.).
- If no doc found → note "No interaction docs" and rely on WCAG 2.2 AA rules only.

### 3b. Build Expected Interaction Matrix

Combine doc claims with WCAG 2.2 AA requirements for the component's ARIA role:

| ARIA Role | WCAG 2.2 AA Required Keyboard Behaviors |
|-----------|------------------------------------------|
| `button` | Tab (receive focus), Enter / Space (activate) |
| `link` | Tab (receive focus), Enter (activate) |
| `checkbox` | Tab (receive focus), Space (toggle checked) |
| `radio` | Tab to group, Arrow keys (move selection within group), Space (select) |
| `combobox` / `listbox` | Tab (focus), Arrow Down/Up (navigate options), Enter (select), Escape (close/cancel) |
| `dialog` | Tab / Shift+Tab (cycle focus within dialog), Escape (close dialog) |
| `menu` / `menuitem` | Arrow Down/Up (navigate), Enter/Space (activate item), Escape (close menu), Tab (close and move focus out) |
| `slider` | Tab (focus), Arrow Left/Right or Down/Up (change value), Home/End (min/max) |
| `tablist` / `tab` | Tab (focus tablist), Arrow Left/Right (switch tabs) |
| `tree` / `treeitem` | Tab (focus), Arrow Down/Up (navigate), Arrow Right (expand), Arrow Left (collapse), Enter (select) |
| `grid` / `gridcell` | Arrow keys (navigate cells), Tab (exit grid), Enter (edit cell) |
| `switch` | Tab (focus), Space (toggle) |

Add any extra behaviors found in the interaction docs on top of the WCAG baseline.

### 3c. Story Selection

1. Expand the component in the Storybook sidebar and list all its stories.
2. Select up to **5 stories** that best cover edge cases:
   - Always include the default/index story
   - Prioritize: Controlled, Disabled, Error/Invalid state, Open/Expanded state, multi-item variants
   - Avoid pure visual stories (e.g. "Size", "Color") unless they affect keyboard behavior
3. If a critical edge case has **no story** (e.g. dropdown has no "open state" story for testing arrow navigation):
   - Add it to the **Missing Stories list** at the end
   - Still test what you can with existing stories

### 3d. Browser Testing

For each selected story:

1. **Navigate:** Click through the Storybook sidebar to open the story (never guess `?path=` URLs). Use `mcp__Claude_in_Chrome__find` to locate sidebar items, then `mcp__Claude_in_Chrome__preview_click` or `mcp__Claude_in_Chrome__form_input` to interact.

2. **Switch to Story view** if Storybook defaults to Docs view — look for a "Story" tab or canvas button and click it.

3. **For each expected interaction:**
   - Use `mcp__Claude_in_Chrome__javascript_tool` to send keyboard events:
     ```javascript
     // Focus the component first
     document.querySelector('[role="button"]')?.focus();
     // Then dispatch key
     document.activeElement.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));
     ```
   - Or use `mcp__Claude_in_Chrome__shortcuts_execute` for Tab/Shift+Tab navigation.
   - Check result with:
     ```javascript
     // Focus check
     document.activeElement?.getAttribute('role') + ' | ' + document.activeElement?.textContent?.trim()
     // State check
     document.querySelector('[aria-expanded]')?.getAttribute('aria-expanded')
     document.querySelector('[aria-checked]')?.getAttribute('aria-checked')
     ```

4. **Record result:**
   - ✅ PASS — behavior matches expectation
   - ❌ FAIL — behavior is wrong or missing (note expected vs actual)
   - ⚠️ PARTIAL — partially works (note what's missing)
   - ⏭️ SKIP — couldn't test (note reason)

5. **Evidence:** Prefer DOM state over screenshots. Use `mcp__Claude_in_Chrome__read_page` snapshot only for ambiguous failures.

6. **Reset state** before the next story: reload the page if the component left state behind.

---

## Phase 4: Report Generation

### Output folder convention (always follow)

All work goes under `keyboard-audit/` in the repo root:
- **Main files** (reports, summaries) → `keyboard-audit/` root
- **Screenshots and non-main files** (evidence, scratch) → `keyboard-audit/screenshots/`

Every screenshot taken during testing MUST be saved to `keyboard-audit/screenshots/`.

### Write the report file

Create `keyboard-audit/KEYBOARD_AUDIT_REPORT-<runId>.md` with this structure:

```markdown
# Keyboard Audit Report — <runId>

**Date:** <date>
**Storybook URL:** <url>
**Components tested:** <count>
**Run by:** Claude Code keyboard-audit skill

---

## Summary

| Metric | Count |
|--------|-------|
| Components tested | N |
| Total interactions tested | N |
| ✅ Pass | N |
| ❌ Fail | N |
| ⚠️ Partial | N |

---

## Per-Component Results

### <ComponentName>

**Docs:** Found at `docs/src/pages/components/<name>/interactions.mdx` / Not found
**Stories tested:** Story1, Story2, ...

#### Interaction Matrix

| Key(s) | Expected Behavior | Result | Evidence |
|--------|-------------------|--------|----------|
| Tab | Focus moves to component | ✅ PASS | `activeElement: button#submit` |
| Enter | Activates button | ❌ FAIL | No action triggered; expected `onClick` call |
| Escape | Closes dropdown | ⚠️ PARTIAL | Closes but focus not returned to trigger |

#### Bugs Found

- **[FAIL] Enter key does not activate:** Expected button to fire onClick on Enter. `document.activeElement` confirmed focus was on the button but no click event fired.

---

## Missing Stories Needed

| Component | Missing Story | Why It's Needed |
|-----------|--------------|-----------------|
| Dropdown | Open state (with options visible) | Can't test Arrow/Enter/Escape without the dropdown being open |
| Modal | Focus trap test | Can't verify Tab cycling without a story that keeps the modal open |

---

## WCAG 2.2 AA Gaps (claimed in docs but not verified / not documented at all)

List any interactions required by WCAG that had no corresponding story or doc coverage.
```

### Print inline summary

After writing the file, print a short summary:

```
## Keyboard Audit Complete — <runId>

Tested: N components | N interactions
✅ Pass: N  ❌ Fail: N  ⚠️ Partial: N

Top bugs:
- <ComponentName>: <short description>
- ...

Missing stories (need to be created):
- <ComponentName>: <story name> — <reason>

Full report: keyboard-audit/KEYBOARD_AUDIT_REPORT-<runId>.md
```

---

## Strict Constraints

- **NEVER fix bugs** — document and move on
- **NEVER guess Storybook story URLs** — always navigate via sidebar clicks
- **ALWAYS ask for the Storybook URL** at the start — never assume localhost:5000 or any default
- **ALWAYS use DOM state** (`activeElement`, `aria-*` attributes) as primary evidence
- **ALWAYS reload** between stories if component state may be dirty
- **Sequential only** — complete one component fully before starting the next
- **Screenshots are a last resort** — only for genuinely ambiguous failures
- If Chrome MCP becomes unreachable mid-audit, STOP and tell the user before continuing
