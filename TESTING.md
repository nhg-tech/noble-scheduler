# Noble Scheduler — v1 Test Script

Run through each scenario in order. Mark Pass / Fail / Notes.
Start each section from a **blank schedule** unless stated otherwise.

---

## SETUP: Before You Start

1. Open `http://localhost:5173`
2. In **Setup & Defaults → Program Mix**, set:
   - Social Play Groups: **2**
   - Select Play Groups: **1**
   - Total Dogs: **20**
   - Social %: **30**, Select %: **20**, P/F %: **50**, Multipet Dogs: **30%**
   - Cats %: **10**, Multipet Cats: **20%**
3. In **Task Defaults**, set Breakfasts (BRFT) Min/Unit to **1.5**
4. Click **Save Defaults**, then close Setup.

---

## 1. TASK LIBRARY

| # | Scenario | Expected | P/F |
|---|----------|----------|-----|
| 1.1 | Switch filter to **All Tasks** | All tasks shown across all categories | |
| 1.2 | Switch filter to **Pending** | Only unscheduled tasks visible | |
| 1.3 | Collapse a category (click header) | Tasks hide; re-click expands | |
| 1.4 | Click **+ Custom Task** | Create Task modal opens | |
| 1.5 | Create custom task: Code=TEST, Name=Test Task, Duration=45, Category=Fixed | Chip appears in Task Library under Fixed | |

---

## 2. DROPPING CHIPS — BASIC

| # | Scenario | Expected | P/F |
|---|----------|----------|-----|
| 2.1 | Drag **BRFT** chip to an empty cell on HC1 | Block placed; duration = 1.5 × (suites + bungalows). No modal. | |
| 2.2 | Drag **HK** chip to an empty cell | Block placed; no modal | |
| 2.3 | After placing tasks, column header shows time range | Start/end times appear in header (e.g. "7a–8:30a") | |
| 2.4 | Drag **SC1** chip to empty cell | Block placed correctly | |

---

## 3. CONFLICT MODAL — DIRECT OVERLAP

| # | Scenario | Expected | P/F |
|---|----------|----------|-----|
| 3.1 | Drag a chip **directly onto an existing block** | Conflict modal appears with task names and available space | |
| 3.2 | In conflict modal, click **Cancel** | No change to schedule; modal closes | |
| 3.3 | Repeat drop → click **Waterfall** | New block placed at same slot with red outline; modal closes | |
| 3.4 | Repeat drop → click **Fit into space** | New block placed, truncated to available space | |
| 3.5 | Repeat drop (≤2 existing constituents) → click **Merge blocks** | Single merged block with color bars; code shows "A+B" format | |
| 3.6 | Try to merge when 3 tasks already merged | **Merge blocks** button hidden; only Cancel / Waterfall / Fit shown | |

---

## 4. CONFLICT MODAL — DURATION BLEED

| # | Scenario | Expected | P/F |
|---|----------|----------|-----|
| 4.1 | Place a short block at 7:00am. Drag a **long task** (e.g. SOC PG, 150 min) to 6:00am empty slot — it should bleed into 7:00am block | Conflict modal fires showing available space = 60 min | |
| 4.2 | Click **Fit into space** | Long task truncated to 60 min; placed at 6:00am without overlap | |
| 4.3 | Click **Waterfall** instead | Full-length task placed at 6:00am with red overflow outline | |

---

## 5. MOVING EXISTING BLOCKS

| # | Scenario | Expected | P/F |
|---|----------|----------|-----|
| 5.1 | Grab an existing block, drag to empty cell in **same column** | Block moves; original slot cleared | |
| 5.2 | Drag block to empty cell in **different column** | Block moves to new column | |
| 5.3 | Drag block onto another block (same column) | Conflict modal fires | |
| 5.4 | Drop block back on **its own original cell** | Nothing changes (no flicker, no modal) | |

---

## 6. BLOCK ACTIONS

| # | Scenario | Expected | P/F |
|---|----------|----------|-----|
| 6.1 | Hover a block | Red ✕ delete button appears top-right | |
| 6.2 | Click ✕ | Block removed immediately | |
| 6.3 | Double-click a block | Edit modal opens showing notes, duration, color | |
| 6.4 | In Edit modal: change duration to 45, change color, add note → Save | Block updates in grid (smaller height, new color) | |
| 6.5 | Right-click a block | Context menu: ✏️ Edit / ✂️ Split / 🗑 Remove | |
| 6.6 | Context menu → **Remove** | Block removed | |
| 6.7 | Context menu → **Edit** | Edit modal opens | |

---

## 7. SPLIT MODAL

| # | Scenario | Expected | P/F |
|---|----------|----------|-----|
| 7.1 | Right-click any regular block → **Split** | Split modal opens; shows Part 1 / Part 2 preview with time ranges | |
| 7.2 | Change split-at value (e.g. 20 min) | Part 1 / Part 2 times update live | |
| 7.3 | Click **Split** | Two separate blocks appear at correct times | |
| 7.4 | Create a **merged block** (merge two tasks via conflict modal) | Block shows color bar with both task codes | |
| 7.5 | Right-click merged block → **Split** | Split modal shows constituent list (different UI from regular split) | |
| 7.6 | Confirm split on merged block | Two separate blocks placed sequentially | |

---

## 8. BLOCK RESIZE

| # | Scenario | Expected | P/F |
|---|----------|----------|-----|
| 8.1 | Hover a block; drag the dark strip at the **bottom edge** downward | Block grows taller; height snaps to 5-min increments | |
| 8.2 | Drag bottom edge upward | Block shrinks; minimum ~10 min | |
| 8.3 | Resize stops at a reasonable minimum | Block doesn't collapse to zero height | |

---

## 9. COLUMN MANAGEMENT

| # | Scenario | Expected | P/F |
|---|----------|----------|-----|
| 9.1 | Click **+** button in column header area | "Add Column" popover appears | |
| 9.2 | Enter label "SOC 3", sub-text "TM" → Add | New column appears in grid | |
| 9.3 | Reload page | Custom column persists (localStorage) | |
| 9.4 | Click **✕** on custom column header | Column removed | |
| 9.5 | Grab the **⠿ grip** on any column header and drag left/right | Columns reorder in real time | |
| 9.6 | Reload page | Column order persists | |
| 9.7 | Column header shows **–** when no tasks assigned | Blank time range displays | |
| 9.8 | Drop a task onto new column; check header | Start–end time appears | |

---

## 10. SCROLLING & LAYOUT

| # | Scenario | Expected | P/F |
|---|----------|----------|-----|
| 10.1 | Scroll the grid **horizontally** | Column headers scroll with the grid (not stuck behind right panel) | |
| 10.2 | Scroll the grid **vertically** | Column headers remain sticky at the top | |
| 10.3 | Time gutter (left time column) stays visible when scrolling horizontally | Time labels remain sticky on the left | |

---

## 11. SETUP OVERLAY

| # | Scenario | Expected | P/F |
|---|----------|----------|-----|
| 11.1 | Click **Setup** button in header | Setup overlay opens with 3 tabs | |
| 11.2 | Change Total Dogs to 25 → Save Defaults | Value persists on next open | |
| 11.3 | Task Defaults: change BRFT Min/Unit to 2.0 | Input accepts decimal; no revert icon visible | |
| 11.4 | Drag BRFT chip after changing Min/Unit | Block duration = 2.0 × (suites+bungalows), not flat 2 min | |
| 11.5 | Role Config tab | Shows role list (read-only) with shift times | |
| 11.6 | Click **Cancel** | Changes not saved | |
| 11.7 | Click **Reset to defaults** | All task overrides cleared | |

---

## 12. SAVE & LOAD

| # | Scenario | Expected | P/F |
|---|----------|----------|-----|
| 12.1 | Place a few tasks, then click **Save → Save as Draft** | Save modal opens; enter name "Test Draft" → Save | |
| 12.2 | Clear schedule, then open Left Panel → Load → Drafts → "Test Draft" | Schedule restored | |
| 12.3 | Save as **Template** | Appears in Templates list | |
| 12.4 | Load a blank template | Grid clears; column headers reset to "–" | |
| 12.5 | Click **Post Schedule** | Post modal opens; save as "Test Post" | |

---

## 13. VALIDATION & CHECKLIST

| # | Scenario | Expected | P/F |
|---|----------|----------|-----|
| 13.1 | Click **Validate** in header | Validation modal opens | |
| 13.2 | Close validation modal | Grid unchanged | |
| 13.3 | Click **Checklist** in header | Checklist modal opens | |

---

## 14. SCHEDULE SUMMARY (Right Panel)

| # | Scenario | Expected | P/F |
|---|----------|----------|-----|
| 14.1 | Add several tasks to grid | Summary panel updates: scheduled hours, open slots, task count | |
| 14.2 | Remove a task | Summary reflects removal | |

---

## 15. PERSISTENCE (localStorage)

| # | Scenario | Expected | P/F |
|---|----------|----------|-----|
| 15.1 | Build a schedule, then **reload the page** | Schedule, column order, and custom columns all restore | |
| 15.2 | Change assumptions in left panel, reload | Assumption values persist | |

---

## REVERTING TO v1

If a future session breaks something and you need to roll back:

```bash
cd "D:/NHG/NHG - Technology/Claude Local Session/noble-scheduler"
git log --oneline          # find the v1 commit hash
git checkout <hash>        # detached HEAD at v1
# or to fully reset the working tree:
git reset --hard <hash>
```

The v1 commit hash is: **6a03cc8**
