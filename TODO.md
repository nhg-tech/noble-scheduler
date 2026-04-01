# Noble Scheduler — To-Do List

Last updated: 2026-04-01

---

## 🏗️ Roadmap (Priority Order)

### 1. Backend: Node.js + Express + PostgreSQL
Replace localStorage persistence with a real database. Schedules, templates, drafts, and postings would be stored server-side, enabling multi-user access, history, and data recovery. This is the foundation that makes the User Permissions module possible.

### 2. User Permissions Module
Add login with role-based access: Owner and GM can edit/post schedules, Team Leads can view and comment, Viewers are read-only. Requires JWT auth and a user management screen. Depends on the backend being in place.

---

## 🐛 Active Bugs

### 3. Fix ON Shift Out-of-Shift Shading
Overnight role columns (e.g. 9pm–6:30am) should show a visible gray tint on cells outside the shift window (e.g. 5am–9pm same day, and after 6:30am the following morning). Currently the shading is either invisible or the `inShift()` logic is returning incorrect values for overnight roles in certain slot ranges.

### 4. Fix Print Columns Not Spanning Full Page Width
When printing via browser (Ctrl+P), the schedule grid columns only fill ~60% of the page, leaving a large white gap on the right. Should fill the full printable area regardless of paper size or margin settings. Multiple approaches attempted (pixel calc, flex fill, CSS override) — root cause still unresolved.

---

## 🔧 Feature Backlog

### 5. Permanent Delete for Custom Roles in Role Config
In the Setup overlay > Role Config tab, user-created extra columns can be hidden from the schedule but cannot be permanently removed. Need a delete/trash action that removes the role from `noble_role_defaults` localStorage entirely.

### 6. Print CSS Polish
Beyond column widths, ensure the printed schedule looks fully professional: correct fonts load (DM Sans, Cormorant Garamond, DM Mono), colors render accurately, page breaks are clean, and the footer summary/assumptions section is properly sized and laid out.

### 7. Mobile Responsive Layout
The current layout assumes a wide desktop screen. On tablets or phones the grid, left panel, and right panel should reflow into a usable single-column or simplified view. Grid columns may need to be horizontally scrollable or collapsed.

### 8. Tooltips for Min Res/Unit and Expected Instances
These two fields in the task editor (Create/Edit Task modal) are not self-explanatory to new users. Add hover tooltips that describe what each field means and how its value affects scheduling calculations and the Schedule Summary.

### 9. Expected Instances Redesign
The current Expected Instances field is a raw number input that is confusing without context. Redesign to be more intuitive — possibly auto-calculated from the dog/room count assumptions, or displayed as a frequency (e.g. "once per X dogs") that auto-converts to a count.

### 10. Automate QA Alias
Set up a shortcut or npm script that runs a standard pre-check sequence (build, lint, key interaction smoke test) so QA validation can be triggered in one step rather than manually running each command.
