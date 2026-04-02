# Noble Scheduler — To-Do List

Last updated: 2026-04-02

---

## ✅ Recently Completed

- **Backend: Node.js + Express + PostgreSQL** — Live on Railway. Schedules, templates, drafts, postings, setup defaults, and auth all persisted server-side.
- **User Permissions / JWT Auth** — Owner, GM, TL, Viewer roles enforced on all API routes. Login/logout flow in place.
- **Hours Available fully DB-driven** — Removed all hardcoded type-based fallbacks (`TM`/`TL` checks). `include_in_hrs` in Role Config is now the single source of truth for both Hours Available and Hours Scheduled inclusion.
- **Role `type` field now persisted** — Was silently dropped on every save due to a missing column in the PUT SQL. Fixed; type changes in Role Config now survive hard refresh.
- **In Hrs checkbox defaults to unchecked** — New roles start unchecked; user explicitly opts in. Removed computed type-based default that was masking null DB values.
- **Deleted role visual indicator** — Soft-deleted roles still referenced in saved schedules/drafts/templates show in the grid with strikethrough label + DELETED badge. No data is removed on delete; no purge prompt shown.
- **Hours Scheduled / Hours Available tooltips** — Click ⓘ in Schedule Summary to see per-role breakdowns for both metrics.
- **Est. Time Required fix** — Tasks with `count_hours = false` (GM, MGR, BRK-30, PGM, TL shifts, UNL) are now excluded from the calculation. Delta is now apples-to-apples.
- **BRK-30 counter fix** — totalRoleCount now counts only roles visible in the grid (in columnOrder, not hidden), not all non-deleted DB roles.
- **migrate.js cleanup** — Removed dangerous Phase 3 DROP TABLE block, removed task/role seed data (was silently overwriting user edits on every Railway deploy), removed one-time historical data patches.

---

## 🐛 Active Bugs

### 1. Fix ON Shift Out-of-Shift Shading
Overnight role columns (e.g. 9pm–6:30am) should show a visible gray tint on cells outside the shift window. Currently the shading is either invisible or the `inShift()` logic is returning incorrect values for overnight roles in certain slot ranges.

### 2. Fix Print Columns Not Spanning Full Page Width
When printing via browser (Ctrl+P), the schedule grid columns only fill ~60% of the page, leaving a large white gap on the right. Should fill the full printable area regardless of paper size or margin settings. Multiple approaches attempted — root cause still unresolved.

---

## 🔧 Feature Backlog

### 3. New Install Strategy
Define the process for provisioning a fresh instance (new customer or QA wipe): either an export/import flow or a DB snapshot restore. Currently there is no seed data on a clean DB — the app starts empty and requires manual setup. Options: guided first-run wizard, a sample data import, or a documented manual setup checklist.

### 4. Permanent Delete for Roles
Roles can currently be soft-deleted (marked deleted, shown with DELETED indicator in saved schedules). There is no way to permanently remove a role from the DB. Consider a two-step flow: soft-delete first, then a separate "Permanently remove" action once the user has resolved all saved schedules referencing that role.

### 5. Print CSS Polish
Beyond column widths, ensure the printed schedule looks fully professional: correct fonts load (DM Sans, Cormorant Garamond, DM Mono), colors render accurately, page breaks are clean, and the footer summary/assumptions section is properly sized and laid out.

### 6. Mobile Responsive Layout
The current layout assumes a wide desktop screen. On tablets or phones the grid, left panel, and right panel should reflow into a usable single-column or simplified view. Grid columns may need to be horizontally scrollable or collapsed.

### 7. Tooltips for Min Res/Unit and Expected Instances Fields
These two fields in the task editor (Create/Edit Task modal) are not self-explanatory to new users. Add tooltips that describe what each field means and how its value affects scheduling calculations and the Schedule Summary.

### 8. Expected Instances Redesign
The current Expected Instances field is a raw number input that is confusing without context. Redesign to be more intuitive — possibly auto-calculated from the dog/room count assumptions, or displayed as a frequency (e.g. "once per X dogs") that auto-converts to a count.

### 9. User Permissions Module — UI Layer
Backend role enforcement is in place. Still needed: a user management screen (Owner only) to view, create, deactivate, and change roles for staff accounts.

### 10. Automate QA Alias
Set up a shortcut or npm script that runs a standard pre-check sequence (build, lint, key interaction smoke test) so QA validation can be triggered in one step rather than manually running each command.
