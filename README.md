# Noble Scheduler — Technical Specification

**Noble Pet Resort · Task Scheduler**
Version: 0.4.0 · Stack: React + Vite · Status: Active Development

---

## Overview

A daily staff scheduling tool for Noble Pet Resort (SeaTac, WA). Managers build a visual task schedule by dragging task chips onto a time grid across role columns. The app calculates hours scheduled, hours available, and estimated required hours based on occupancy assumptions, then surfaces the delta so managers can spot over/under-staffed days at a glance.

---

## Running Locally

```bash
# Node.js is installed at C:\Program Files\nodejs\
export PATH="$PATH:/c/Program Files/nodejs"

cd noble-scheduler
npm install
npm run dev
# → http://localhost:5173
```

---

## Tech Stack

| Layer | Choice |
|---|---|
| UI Framework | React 18 (via Vite) |
| Drag-and-Drop | @dnd-kit/core |
| State | React Context (SchedulerContext) |
| Persistence | localStorage (browser) |
| Styling | Inline styles + CSS variables |
| Fonts | DM Sans, Cormorant Garamond, DM Mono (Google Fonts) |
| Future Backend | Node.js + Express + PostgreSQL (planned) |
| Future Auth | JWT with role-based access (planned) |

---

## Architecture

### Component Tree

```
App.jsx                          ← DndContext, all modal state
├── Header/Header.jsx            ← Nav bar, action buttons (Save, Post, Validate, etc.)
├── LeftPanel/LeftPanel.jsx      ← Load Schedule (Templates/Drafts/Posted) + Assumptions form
├── Grid/
│   ├── GridHeader.jsx           ← Sticky column headers with role name, shift times, span hours
│   ├── GridBody.jsx             ← Time gutter + role columns + drag target cells
│   ├── GridCell.jsx             ← Individual 15-min slot cell (droppable, in/out-of-shift shading)
│   └── TaskBlock.jsx            ← Placed task chip (draggable, resizable)
├── RightPanel/
│   ├── ScheduleSummary.jsx      ← Live stats: tasks placed, hrs scheduled, hrs available, delta
│   └── TaskLibrary.jsx          ← Draggable task chips grouped by category
├── Modals/
│   ├── ConflictModal.jsx        ← Handles drop conflicts (swap, push, cancel)
│   ├── SplitModal.jsx           ← Split a task block into two
│   ├── EditModal.jsx            ← Edit a placed task block's duration/notes
│   ├── CreateTaskModal.jsx      ← Create a new custom task definition
│   ├── SaveModal.jsx            ← Save as Draft or Template
│   ├── ValidationModal.jsx      ← Pre-post schedule validation warnings
│   └── ChecklistModal.jsx       ← Pre-shift checklist overlay
├── Setup/SetupOverlay.jsx       ← 3-tab settings overlay:
│   ├── Tab 1: Program Mix       ← Set % social/select/service coach/cats
│   ├── Tab 2: Task Defaults     ← Override duration, countHours, color per task
│   └── Tab 3: Role Config       ← Add/hide/configure extra role columns
└── Print/PrintLayout.jsx        ← Portal-rendered print layout (display:none on screen)
```

### State & Context (`SchedulerContext.jsx`)

All application state lives in a single React Context. Key state:

| State | Description |
|---|---|
| `schedule` | `{ "roleId\|startMin": taskObject }` — all placed task blocks |
| `assumptions` | Occupancy inputs: dogs, rooms, socpg, selpg, date, etc. |
| `userTaskDefs` | User overrides for task definitions (duration, color, countHours) |
| `userProgramDefs` | User-defined program mix percentages |
| `userRoleDefs` | User-defined role config overrides |
| `extraRoles` | Dynamically added role columns |
| `columnOrder` | Array of role IDs defining left-to-right column order |
| `hiddenColumns` | Set of role IDs hidden from current view |
| `colWidth` | Column pixel width (persisted; shared between GridBody and PrintLayout) |
| `taskLibrary` | Merged array of built-in + session task definitions |

### localStorage Keys

| Key | Contents |
|---|---|
| `noble_task_defaults` | User task definition overrides |
| `noble_role_defaults` | User role config overrides |
| `noble_program_defaults` | User program mix settings |
| `noble_templates` | Saved templates `{ name: { schedule, assumptions } }` |
| `noble_postings` | Posted schedules |
| `noble_drafts` | Saved drafts |
| `noble_col_width` | Grid column width (px) |

---

## Grid System

### Time Slots

- **Range:** 5:00am → 4:45am next day (24-hour cycle, no duplicate rows)
- **Granularity:** 15-minute slots (4 per hour) — `TIME_SLOTS` array in `src/data/roles.js`
- **Slot height:** 22px per 15-min slot (same pixel-per-minute density as previous 44px/30-min)
- **Post-midnight representation:** Hours 24–28 represent midnight through 4am next day (e.g. `h=25` = 1am)
- **Midnight marker:** Purple double-border line at `h=24`

### Schedule Key Format

```
"roleId|startMin"
```

`startMin` is always raw minutes from midnight (e.g. `"ON|1260"` = ON role, 9:00pm). This format is grid-granularity-agnostic and backward compatible.

### In-Shift Shading

Each `GridCell` receives an `isInShift` boolean from `inShift(role, slotIdx)` in `scheduling.js`.

- **Day shifts** (shiftStart < shiftEnd): standard `t >= start && t < end`
- **Overnight shifts** (shiftStart > shiftEnd, e.g. 21→6.5):
  - Same-day slots (`t < 24`): in-shift only if `t >= shiftStart`
  - Post-midnight slots (`t >= 24`): in-shift if `(t - 24) < shiftEnd`
- Out-of-shift cells: `rgba(0,0,0,0.12)` background

---

## Calculations

### Single Source of Truth (`src/utils/calculations.js`)

All span/hour calculations flow through two shared functions:

**`computeRoleSpan(roleId, schedule, taskLibrary, getTaskDefault)`**
Returns `{ startMin, endMin, nonCountedMins }` for a role. Handles cross-midnight overnight shifts by detecting `hasMorning && hasEvening` and normalizing early-morning task start times by adding 1440 minutes.

**`computeAllSpanMins(roles, schedule, taskLibrary, getTaskDefault)`**
Sums span across all eligible roles. Called inside `computeSummary`.

**`computeSummary({ ... })`**
Returns the full schedule summary object:
- `schedHrs` — total scheduled hours (span-based)
- `countedTaskMins` — minutes from tasks where `countHours !== false`
- `openMins` — `schedMins - countedTaskMins`
- `reqHrs` — estimated required hours from occupancy assumptions
- `delta` — `schedMins - reqMins` (positive = over-staffed, negative = under-staffed)

Both `GridHeader` (column span display) and `ScheduleSummary` (right panel) delegate to these shared functions — no duplicate span logic.

---

## Roles (`src/data/roles.js`)

Built-in roles and their default shift windows:

| ID | Label | Type | Shift |
|---|---|---|---|
| GM | GM | GM | 6:30a–3p |
| MR | MR | MR | 1p–9:30p |
| PAW | PAW | PAW | 7a–3p |
| TL_AM | TL AM | TL | 6a–2p |
| TL_PM | TL PM | TL | 1:30p–9:30p |
| ON | ON | ON | 9p–6:30a (overnight) |
| ... | Various PG/SEL/FLX roles | TM | Various |

Additional roles can be added dynamically via Setup > Role Config and are stored in `extraRoles` state + `noble_role_defaults` localStorage.

---

## Print Layout (`src/components/Print/PrintLayout.jsx`)

A React portal rendered to `document.body`, hidden on screen (`position: fixed; left: -99999px`), shown only during `@media print`.

- **Paper sizes:** Legal landscape (~1267px wide) or Letter landscape (~979px wide)
- **Column layout:** `flex: 1` per column — fills available print width regardless of browser margin settings
- **Slot height:** Dynamically sized between `MIN_SLOT_H` (14px) and `MAX_SLOT_H` (30px) to fill vertical space
- **Task block positioning:** `topPx = ((startMin - activeStart) / 15) * slotH` (15-min based)
- **Footer:** Assumptions box + Schedule Summary box in a horizontal flex row
- **CSS:** `@media print` in `index.css` shows `#noble-print-root` and sets `width: 100%` on the wrapper

---

## Drag-and-Drop

Uses `@dnd-kit/core`. Task chips from `TaskLibrary` are draggables; `GridCell` components are droppables. On drop:

1. Check for conflicts with existing blocks at the target slot
2. If conflict: show `ConflictModal` (swap / push down / cancel)
3. If clear: place block, snap to 15-min boundary

Block resizing is handled via mouse drag on the bottom handle of `TaskBlock`, snapping to 15-min increments.

---

## Changelog (Recent Sessions)

### Session 3 (Current)
- **DRY refactor:** Extracted `computeRoleSpan()` and `computeAllSpanMins()` into `calculations.js` as single source of truth. `GridHeader` and `ScheduleSummary` both delegate to these functions — no duplicate span logic.
- **ON shift span fix:** Cross-midnight overnight span calculation now correctly detects `hasMorning && hasEvening` and normalizes early-morning start times by +1440 to prevent wrong span values (e.g. 25h instead of 9.5h).
- **15-minute grid:** TIME_SLOTS updated from 30-min to 15-min granularity. Slot height: 44px → 22px. Task placement, block height, resize, and print positioning all updated to `/15` base.
- **inShift overnight fix:** Same-day slots for overnight roles no longer incorrectly marked as in-shift. Removed `|| t < shiftEnd` from the same-day branch; post-midnight branch now correctly unwraps `t - 24`.
- **24-hour grid cycle:** TIME_SLOTS loop changed from `h <= 30` to `h <= 28`, ending at 4:45am. Eliminates duplicate 5am row at top/bottom of grid.
- **colWidth persistence:** Column resize width lifted from `GridBody` local state to `SchedulerContext`, persisted in `noble_col_width` localStorage key.
- **Print layout:** Removed `transform: scale` and outer footprint div. Columns switched to `flex: 1`. Content wrapper set to `width: 100%`. Print CSS updated with `#noble-print-root > div { width: 100% }`.

### Session 2
- Full React frontend scaffolded with feature parity to HTML prototype
- All modals implemented (Conflict, Split, Edit, CreateTask, Save, Validation, Checklist)
- Setup overlay with 3 tabs (Program Mix, Task Defaults, Role Config)
- Drag-and-drop via @dnd-kit
- localStorage persistence for all schedule data
- Schedule Summary with live delta calculation
- Post Schedule / Save Draft / Save Template / Load flows
