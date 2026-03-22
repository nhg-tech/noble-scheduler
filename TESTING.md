# Noble Scheduler — Test Script

Run through each scenario in order. Mark Pass / Fail / Notes.
Start each section from a **blank schedule** unless stated otherwise.

---

## SETUP: Before You Start

1. Open `http://localhost:5173`
2. In **Setup & Defaults → Program Mix**, set:
   - Social Play Groups: **2**, Select Play Groups: **1**, Total Dogs: **20**
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
| 1.3 | Click a category header to collapse it | Tasks hide; re-click expands | |
| 1.4 | All categories are expanded on load | No category starts collapsed | |
| 1.5 | Click **⊟** button in Task Library header | All categories collapse simultaneously | |
| 1.6 | Click **⊞** button (now showing) | All categories expand simultaneously | |
| 1.7 | Chip colors match the color set in Task Defaults | e.g. BRFT chip shows same color as its swatch in Setup | |

---

## 2. CUSTOM TASKS

| # | Scenario | Expected | P/F |
|---|----------|----------|-----|
| 2.1 | Click **+ Custom Task** in Task Library | Create Task modal opens; category dropdown lists all active categories | |
| 2.2 | Create task: Code=TEST, Name=Test Task, Duration=45, Category=Fixed | Chip appears in Task Library (session only) | |
| 2.3 | Open **Setup & Defaults → Task Defaults** | TEST task does NOT appear in the Task Defaults table | |
| 2.4 | Reload the page | TEST chip is gone (session-only, not persisted) | |
| 2.5 | Right-click an **empty grid cell** → **Create task here** | Same Create Task modal opens | |
| 2.6 | Create task via right-click, confirm | Block placed directly at the clicked cell | |
| 2.7 | Right-click an empty cell → **Add column** | Add column modal/workflow opens | |

---

## 3. DROPPING CHIPS — BASIC

| # | Scenario | Expected | P/F |
|---|----------|----------|-----|
| 3.1 | Drag **BRFT** chip to empty cell on HC1 | Block placed; duration = 1.5 × (suites + bungalows). No modal. | |
| 3.2 | Drag **HK** chip to empty cell | Block placed; no modal | |
| 3.3 | After placing tasks, column header shows time range | Start/end times appear (e.g. "7a–8:30a") | |
| 3.4 | Column header shows **–** when no tasks in that column | Blank time range displays | |

---

## 4. CONFLICT MODAL — DIRECT OVERLAP

| # | Scenario | Expected | P/F |
|---|----------|----------|-----|
| 4.1 | Drag a chip **directly onto an existing block** | Conflict modal appears | |
| 4.2 | Click **Cancel** | No change; modal closes | |
| 4.3 | Repeat drop → click **Waterfall** | Block placed at same slot with red overflow outline | |
| 4.4 | Repeat drop → click **Fit into space** | Block placed, truncated to available space | |
| 4.5 | Repeat drop (≤2 existing) → click **Merge blocks** | Single merged block with color bars; "A+B" code | |
| 4.6 | Try merge when 3 tasks already merged | **Merge blocks** button hidden | |

---

## 5. CONFLICT MODAL — DURATION BLEED

| # | Scenario | Expected | P/F |
|---|----------|----------|-----|
| 5.1 | Place short block at 7:00am. Drag long task to 6:00am — bleeds into 7:00am block | Conflict modal fires; available space = 60 min | |
| 5.2 | Click **Fit into space** | Long task truncated to 60 min; no overlap | |
| 5.3 | Click **Waterfall** instead | Full task placed with red overflow outline | |

---

## 6. MOVING EXISTING BLOCKS

| # | Scenario | Expected | P/F |
|---|----------|----------|-----|
| 6.1 | Drag block to empty cell in **same column** | Block moves; original slot cleared | |
| 6.2 | Drag block to empty cell in **different column** | Block moves to new column | |
| 6.3 | Drag block onto another block | Conflict modal fires | |
| 6.4 | Drop block on its own original cell | No change, no modal | |

---

## 7. BLOCK ACTIONS

| # | Scenario | Expected | P/F |
|---|----------|----------|-----|
| 7.1 | Hover a block | Red ✕ appears top-right | |
| 7.2 | Click ✕ | Block removed | |
| 7.3 | Double-click a block | Edit modal opens with notes, duration, color, category | |
| 7.4 | Edit modal: change duration, color, add note → Save | Block updates in grid | |
| 7.5 | Right-click a block | Context menu: ✏️ Edit / ✂️ Split / 🗑 Remove | |
| 7.6 | Context menu → **Remove** | Block removed | |
| 7.7 | Context menu → **Edit** | Edit modal opens | |

---

## 8. SPLIT MODAL

| # | Scenario | Expected | P/F |
|---|----------|----------|-----|
| 8.1 | Right-click any regular block → **Split** | Split modal opens with Part 1/Part 2 preview | |
| 8.2 | Change split-at value | Part 1/Part 2 times update live | |
| 8.3 | Click **Split** | Two blocks appear at correct times | |
| 8.4 | Create merged block (conflict → Merge) | Block shows color bars with both codes | |
| 8.5 | Right-click merged block → **Split** | Shows constituent list (different UI) | |
| 8.6 | Confirm split on merged block | Two blocks placed sequentially | |

---

## 9. BLOCK RESIZE

| # | Scenario | Expected | P/F |
|---|----------|----------|-----|
| 9.1 | Drag the dark strip at bottom edge of a block downward | Block grows; snaps to 5-min increments | |
| 9.2 | Drag bottom edge upward | Block shrinks; doesn't collapse below ~10 min | |

---

## 10. COLUMN MANAGEMENT

| # | Scenario | Expected | P/F |
|---|----------|----------|-----|
| 10.1 | Click **+** in column header | Add Column form appears | |
| 10.2 | Enter label "SOC 3", sub-text "TM" → Add | New column appears | |
| 10.3 | Reload page | Custom column persists | |
| 10.4 | Click **✕** on custom column | Column removed | |
| 10.5 | Drag **⠿ grip** on any column header left/right | Columns reorder in real time | |
| 10.6 | Reload page | Column order persists | |

---

## 11. SCROLLING & LAYOUT

| # | Scenario | Expected | P/F |
|---|----------|----------|-----|
| 11.1 | Scroll grid **horizontally** | Column headers scroll with grid (not fixed behind right panel) | |
| 11.2 | Scroll grid **vertically** | Column headers stay sticky at top | |
| 11.3 | Scroll grid horizontally | Time gutter stays sticky on left | |

---

## 12. SETUP — TASK DEFAULTS

| # | Scenario | Expected | P/F |
|---|----------|----------|-----|
| 12.1 | Open Setup → Task Defaults | Table shows standard tasks only; no custom/session tasks | |
| 12.2 | Change BRFT Min/Unit to 2.0 → Save | Drag BRFT chip: duration = 2.0 × (suites+bungalows) | |
| 12.3 | Edit a task row (pencil icon) | Edit modal shows: duration, min resources, color, category, description | |
| 12.4 | Change a task's category in Edit modal | Task moves to new category in the table | |
| 12.5 | Drag a task row's grip up/down | Task reorders within its category | |
| 12.6 | Click **Reset to defaults** | All task overrides cleared | |

---

## 13. SETUP — CATEGORIES TAB

| # | Scenario | Expected | P/F |
|---|----------|----------|-----|
| 13.1 | Open Setup → Categories tab | All built-in categories listed in order | |
| 13.2 | Edit a category label (e.g. "Suite Care" → "Suite Services") | Label updates; saves on Save Defaults | |
| 13.3 | Reload and check Task Library | Updated label appears in Task Library | |
| 13.4 | Click **+ Add Category**, enter "Enrichment" → Add | New category appears in list | |
| 13.5 | Open Create Task modal or Edit task modal | "Enrichment" appears in category dropdown | |
| 13.6 | Soft-delete a category (click delete icon) | Category marked "[Name] - Deleted" | |
| 13.7 | Verify deleted category absent from dropdowns | Does not appear in Create Task / Edit modal category list | |
| 13.8 | Tasks already in deleted category | Still display; category label shows "[Name] - Deleted" in library | |
| 13.9 | Restore deleted category | Label returns to normal; available in dropdowns again | |
| 13.10 | Drag category rows to reorder | Order changes in real time; Task Library reflects new order | |

---

## 14. LEFT PANEL

| # | Scenario | Expected | P/F |
|---|----------|----------|-----|
| 14.1 | Click the **Assumptions ▾** title row | Section collapses; shows summary: "🐕 X dogs · Y rooms · ... · 🐈 Z cats · N bungalows" | |
| 14.2 | Click again | Section expands; all inputs visible | |
| 14.3 | Set Schedule Date | Date persists on reload | |
| 14.4 | Load Template tab: select and load a template | Schedule updates | |
| 14.5 | Load Draft tab: load a saved draft | Schedule updates | |
| 14.6 | Load Posted tab: load a posted schedule | Schedule updates | |

---

## 15. SAVE & LOAD

| # | Scenario | Expected | P/F |
|---|----------|----------|-----|
| 15.1 | Place tasks → **Save → Draft** → name "Test Draft" | Saves successfully | |
| 15.2 | Load "Test Draft" from left panel | Schedule restored | |
| 15.3 | Save as **Template** | Appears in Templates list | |
| 15.4 | Load blank template | Grid clears; headers reset to "–" | |
| 15.5 | **Post Schedule** | Post modal saves; appears in Posted list | |

---

## 16. VALIDATION & CHECKLIST

| # | Scenario | Expected | P/F |
|---|----------|----------|-----|
| 16.1 | Click **Validate** | Validation modal opens | |
| 16.2 | Click **Checklist** | Checklist modal opens | |

---

## 17. SCHEDULE SUMMARY

| # | Scenario | Expected | P/F |
|---|----------|----------|-----|
| 17.1 | Add tasks → check right panel summary | Scheduled hours, task count update | |
| 17.2 | Remove a task | Summary reflects removal immediately | |

---

## 18. PERSISTENCE

| # | Scenario | Expected | P/F |
|---|----------|----------|-----|
| 18.1 | Build schedule, reload page | Schedule, column order, custom columns restore | |
| 18.2 | Change assumptions, reload | Assumption values persist | |
| 18.3 | Add custom category in Setup, reload | Custom category persists | |
| 18.4 | Create a session custom task, reload | Task chip is gone (session-only) | |

---

## REVERTING TO A PRIOR VERSION

```bash
cd "D:/NHG/NHG - Technology/Claude Local Session/noble-scheduler"
git log --oneline          # see all versions
git reset --hard v1        # revert to v1
git reset --hard v1.1      # revert to v1.1
```

| Tag | Commit | Description |
|-----|--------|-------------|
| v1  | 6a03cc8 | Initial full React frontend |
| v1.1 | d0f725f | Categories tab, session tasks, left panel UX, expand/collapse |
