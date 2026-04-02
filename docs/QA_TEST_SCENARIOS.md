# Noble Task Scheduler — QA Test Scenarios

**Product**: Noble Pet Resort Task Scheduler
**Version**: 1.0 (Phase 2 — current)
**Last Updated**: 2026-04-02
**Environment**: `https://noble-scheduler.vercel.app`

---

## How to Use This Document

Each scenario has:
- **Steps** — exactly what to do, in order
- **Expected Result** — what should happen if the app is working correctly
- **Pass / Fail** — mark after testing

Work through sections in order — later sections depend on setup done in earlier ones.

**Before you start**: Open the app in an incognito / private browser window to ensure no leftover session data affects results.

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Initial Data Load](#2-initial-data-load)
3. [Assumptions Panel](#3-assumptions-panel)
4. [Schedule Grid — Basic Placement](#4-schedule-grid--basic-placement)
5. [Schedule Grid — Conflict Resolution](#5-schedule-grid--conflict-resolution)
6. [Task Block Actions](#6-task-block-actions)
7. [Task Library](#7-task-library)
8. [Schedule Summary](#8-schedule-summary)
9. [Save & Load Drafts](#9-save--load-drafts)
10. [Post a Schedule](#10-post-a-schedule)
11. [Templates](#11-templates)
12. [Setup — Program Mix](#12-setup--program-mix)
13. [Setup — Task Defaults](#13-setup--task-defaults)
14. [Setup — Role Config](#14-setup--role-config)
15. [Setup — Categories](#15-setup--categories)
16. [Data Persistence](#16-data-persistence)
17. [Validation & Checklist](#17-validation--checklist)
18. [Edge Cases & Error Handling](#18-edge-cases--error-handling)

---

## 1. Authentication

### 1-A: Create a new account

**Steps**:
1. Go to `https://noble-scheduler.vercel.app`
2. Click **Create Account**
3. Enter: Name = `QA Tester`, Email = `qa@noblepetresort.com`, Password = `Test1234!`
4. Leave Role as default (Viewer) — or select Owner for full access during QA
5. Click **Create Account**

**Expected Result**: App loads the main scheduler screen. Top-right shows the user's name and role.

**Pass ☐ / Fail ☐**

---

### 1-B: Sign out

**Steps**:
1. Click **Sign out** in the top-right corner

**Expected Result**: Returns to the Sign In screen. App does not show any schedule data.

**Pass ☐ / Fail ☐**

---

### 1-C: Sign back in

**Steps**:
1. On the Sign In screen, enter the email and password from 1-A
2. Click **Sign In**

**Expected Result**: App loads the scheduler screen. Name and role appear in top-right.

**Pass ☐ / Fail ☐**

---

### 1-D: Wrong password is rejected

**Steps**:
1. Sign out
2. Enter correct email, but type a wrong password
3. Click **Sign In**

**Expected Result**: An error message appears (e.g., "Invalid credentials"). App does not log in.

**Pass ☐ / Fail ☐**

---

### 1-E: Duplicate email is rejected

**Steps**:
1. Sign out
2. Click **Create Account**
3. Enter the same email from 1-A with any password
4. Click **Create Account**

**Expected Result**: An error message appears indicating the email is already registered. No new account is created.

**Pass ☐ / Fail ☐**

---

### 1-F: Empty fields are rejected

**Steps**:
1. On the Sign In screen, leave both fields blank
2. Click **Sign In**

**Expected Result**: An error or validation message appears. App does not attempt to log in.

**Pass ☐ / Fail ☐**

---

## 2. Initial Data Load

After signing in, verify the app loads correctly with all default data.

### 2-A: Task Library loads with all categories

**Steps**:
1. Sign in
2. Look at the **Task Library** panel on the right side
3. Click **All Tasks** tab in the library

**Expected Result**:
- Category headers are visible: **Play Groups**, **Suite Care**, **Meals**, **Fixed Tasks**, **Overnight** (plus any custom categories)
- Tasks appear under each category

**Pass ☐ / Fail ☐**

---

### 2-B: Schedule grid loads role columns

**Steps**:
1. Look at the schedule grid (center of screen)
2. Check the column headers

**Expected Result**: Role columns are visible, each showing a label, sub-text, shift window (e.g. 6:30a–2p), and hours. Column count and labels depend on your Role Config setup.

**Pass ☐ / Fail ☐**

---

### 2-C: Default assumptions are loaded

**Steps**:
1. Look at the **Assumptions** section on the left panel

**Expected Result**: Fields for Total Dogs, Dog Rooms, # SocPGs, # SelPGs, # SCs, Cats, Cat Rooms, Total Rooms, # Employees are visible and populated with default values.

**Pass ☐ / Fail ☐**

---

### 2-D: Load Schedule panel is present

**Steps**:
1. Look at the top of the left panel

**Expected Result**: **Load Schedule** section is visible with tabs for Templates, Drafts, and Posted. A date picker and **Load Template** button are present.

**Pass ☐ / Fail ☐**

---

## 3. Assumptions Panel

### 3-A: Changing Total Dogs updates derived values

**Steps**:
1. In the Assumptions panel, change **Total Dogs** from its default to `80`
2. Press Tab or click elsewhere

**Expected Result**: Dog Rooms and other derived fields (Total Rooms, # Employees) update to reflect the new dog count.

**Pass ☐ / Fail ☐**

---

### 3-B: Changing # SocPGs updates task durations

**Steps**:
1. Drag a **Play Groups** task (e.g., "Soc Potty Breaks – AM") from the Task Library onto a role column
2. Note its duration (number of blocks it occupies)
3. Change **# SocPGs** in Assumptions (e.g., from 2 to 4)
4. Look at the same task block on the grid

**Expected Result**: The task block's duration changes to reflect the new SocPG count (more SocPGs = longer task). The number of slots the block occupies increases.

**Pass ☐ / Fail ☐**

---

### 3-C: Resetting assumptions

**Steps**:
1. Change several assumption values
2. Click the reset/clear icon (↺) next to the Assumptions header if present, or manually restore original values

**Expected Result**: Values return to defaults. Derived fields recalculate.

**Pass ☐ / Fail ☐**

---

## 4. Schedule Grid — Basic Placement

### 4-A: Drag a task from the library to the grid

**Steps**:
1. In the Task Library on the right, find a Play Groups task
2. Drag it to any role column around the 8:00 AM row
3. Release

**Expected Result**: Task block appears on the grid at the dropped time. Block shows task name, code, and duration. The task moves from Pending to placed state in the library.

**Pass ☐ / Fail ☐**

---

### 4-B: Task block shows correct duration

**Steps**:
1. After placing a task, look at its block height on the grid

**Expected Result**: The block spans the correct number of 15-minute slots proportional to its duration (e.g. a 60-minute task = 4 slots tall).

**Pass ☐ / Fail ☐**

---

### 4-C: Move a placed task block

**Steps**:
1. Click and drag a placed task block to a different time slot in the same column (e.g., move it 1 hour later)
2. Release

**Expected Result**: Block moves to the new time. Start time updates accordingly.

**Pass ☐ / Fail ☐**

---

### 4-D: Move a task to a different role column

**Steps**:
1. Drag a placed task block from one role column to another

**Expected Result**: Block appears in the new role column at the same or nearest available time. It is removed from the original column.

**Pass ☐ / Fail ☐**

---

### 4-E: Place tasks in multiple columns

**Steps**:
1. Place at least one task in each of three different columns

**Expected Result**: All columns show their respective tasks. Tasks do not bleed across column boundaries.

**Pass ☐ / Fail ☐**

---

### 4-F: Drag task from library to a role that already has tasks

**Steps**:
1. Place a task in a column at 6:30 AM
2. Drag a different task from the library to the same column at 9:00 AM (no overlap)

**Expected Result**: Second task is placed at 9:00 AM without conflict. Both tasks are visible in the column.

**Pass ☐ / Fail ☐**

---

## 5. Schedule Grid — Conflict Resolution

### 5-A: Overlapping drop triggers conflict modal

**Steps**:
1. Place **"PG Prep"** in a column at 8:00 AM (it is 30 min = 2 slots)
2. Drag another task from the library and drop it directly on the same column at 8:00 AM

**Expected Result**: A **Conflict** modal appears with options to resolve the overlap (Merge, Fit, or similar).

**Pass ☐ / Fail ☐**

---

### 5-B: Merge option combines tasks

**Steps**:
1. Reproduce the conflict from 5-A
2. In the Conflict modal, choose **Merge**

**Expected Result**: The two tasks are combined into a single block. The block shows a combined label or indicator that it contains multiple tasks.

**Pass ☐ / Fail ☐**

---

### 5-C: Auto-place after existing block

**Steps**:
1. Place a task in a column at 8:00 AM
2. Drag a second task and drop it at the same 8:00 AM slot

**Expected Result**: If the second task can fit immediately after the first with no gap, it is auto-placed without showing a conflict modal.

**Pass ☐ / Fail ☐**

---

## 6. Task Block Actions

### 6-A: Edit a placed task block

**Steps**:
1. Click on a placed task block on the grid
2. Look for an edit option (pencil icon or right-click context)
3. Change the task's notes to `"Test note"`
4. Save the edit

**Expected Result**: The task block updates to show the edited information. Notes are retained.

**Pass ☐ / Fail ☐**

---

### 6-B: Delete a placed task block

**Steps**:
1. Click on a placed task block
2. Click the delete / remove (✕) icon
3. Confirm if prompted

**Expected Result**: Task block is removed from the grid. The task reappears in the Task Library as available.

**Pass ☐ / Fail ☐**

---

### 6-C: Split a merged block

**Steps**:
1. Create a merged block (see 5-B)
2. Click on the merged block
3. Select **Split**

**Expected Result**: The merged block is separated back into its individual task blocks, placed sequentially in the column.

**Pass ☐ / Fail ☐**

---

### 6-D: Resize a task block

**Steps**:
1. Place a task on the grid
2. Look for a resize handle at the bottom of the block
3. Drag the handle to make the task longer (add 1 slot)

**Expected Result**: Block grows to the new size. Duration updates accordingly.

**Pass ☐ / Fail ☐**

---

## 7. Task Library

### 7-A: Pending vs All Tasks tabs

**Steps**:
1. Place 3 tasks on the grid
2. In the Task Library, click the **Pending** tab
3. Then click the **All Tasks** tab

**Expected Result**:
- **Pending**: Shows only tasks not yet placed on the grid
- **All Tasks**: Shows every task regardless of placement status
- Placed tasks appear with a different visual indicator (dimmed or checked) in All Tasks view

**Pass ☐ / Fail ☐**

---

### 7-B: Skipped tab

**Steps**:
1. In the Task Library, right-click a task (or use its menu) and select **Skip** or the × button
2. Click the **Skipped** tab

**Expected Result**: The skipped task appears in the Skipped tab and is removed from the Pending and All Tasks views.

**Pass ☐ / Fail ☐**

---

### 7-C: Restore a skipped task

**Steps**:
1. In the Skipped tab, find the task from 7-B
2. Click to restore it

**Expected Result**: Task moves back to the Pending tab and is available for placement again.

**Pass ☐ / Fail ☐**

---

### 7-D: Task library reflects assumption changes

**Steps**:
1. Find a task in the library that uses `# SocPGs` as its unit basis
2. Note the duration shown on its chip
3. Change **# SocPGs** in Assumptions
4. Look at the same task chip in the library

**Expected Result**: The duration shown on the task chip updates to reflect the new SocPG count.

**Pass ☐ / Fail ☐**

---

## 8. Schedule Summary

### 8-A: Hours Scheduled updates as tasks are placed

**Steps**:
1. Look at the **Schedule Summary** panel (top-right)
2. Note the current **Hours Scheduled** value
3. Place a task that has Count Hours = true (most tasks)
4. Look at Hours Scheduled again

**Expected Result**: Hours Scheduled increases to reflect the new task span in the role column.

**Pass ☐ / Fail ☐**

---

### 8-B: Hours Available reflects role config

**Steps**:
1. Look at **Hours Available** in the Schedule Summary
2. Open Setup → Role Config and note the total hours for roles with **In Hrs** checked
3. Close Setup

**Expected Result**: Hours Available equals the sum of configured shift hours for all roles that have In Hrs enabled. Roles with In Hrs unchecked (e.g. GM, TL AM) are not included regardless of their type.

**Pass ☐ / Fail ☐**

---

### 8-C: Delta shows correct difference

**Steps**:
1. Note the **Delta** value in the Schedule Summary

**Expected Result**: Delta = Hours Scheduled − Est. Time Required. Positive = overstaffed, negative = understaffed. Value updates as tasks are placed or removed.

**Pass ☐ / Fail ☐**

---

### 8-D: Tasks placed count updates

**Steps**:
1. Note **Tasks Placed** in Schedule Summary
2. Place 2 more tasks
3. Check Tasks Placed again

**Expected Result**: Tasks Placed increases by 2.

**Pass ☐ / Fail ☐**

---

### 8-E: Hours Scheduled tooltip breakdown

**Steps**:
1. Click the **ⓘ** icon next to **Hours Scheduled** in the Schedule Summary

**Expected Result**: A tooltip panel opens showing a table with one row per eligible role (In Hrs checked), each showing their actual counted task span in hours. Roles with no tasks placed show "—". A total row appears at the bottom. A note explains that non-productive tasks are excluded from the span.

**Pass ☐ / Fail ☐**

---

### 8-F: Hours Available tooltip breakdown

**Steps**:
1. Click the **ⓘ** icon next to **Hours Available** in the Schedule Summary

**Expected Result**: A tooltip panel opens showing a table with one row per eligible role (In Hrs checked) and their configured shift hours from Role Config. A total row appears at the bottom. Any roles with In Hrs unchecked are listed by name in a note below the table.

**Pass ☐ / Fail ☐**

---

### 8-G: Est. Time Required excludes non-productive tasks

**Steps**:
1. Load the **2SocPGs+GM+MR** master template (or place a GM block and a BRK-30 block on the grid)
2. Note the **Est. Time Required** value
3. Click the **ⓘ** icon next to Est. Time Required

**Expected Result**: The tooltip breakdown does **not** include GM, MGR, BRK-30, TL shift blocks, UNL, or PGM tasks — only productive tasks with Count Hours checked appear in the list. Est. Time Required should be substantially lower than the sum of all task durations.

**Pass ☐ / Fail ☐**

---

## 9. Save & Load Drafts

### 9-A: Save a schedule as a draft

**Steps**:
1. Place at least 3 tasks on the grid
2. Set the schedule date to today using the date picker in the left panel
3. Click **Save Draft** in the top toolbar
4. Enter a name: `QA Test Draft`
5. Click Save/Confirm

**Expected Result**: A confirmation or the draft name appears. No error messages.

**Pass ☐ / Fail ☐**

---

### 9-B: Draft appears in Drafts list

**Steps**:
1. In the Load Schedule panel, click the **Drafts** tab

**Expected Result**: `QA Test Draft` appears in the list with the correct date and a timestamp.

**Pass ☐ / Fail ☐**

---

### 9-C: Load a saved draft

**Steps**:
1. Click **Clear** in the toolbar to clear the current schedule
2. Confirm the grid is empty
3. In the Drafts tab, click on `QA Test Draft`
4. Click **Load** or click the draft name

**Expected Result**: The schedule grid reloads with all the tasks that were placed when the draft was saved. Assumptions also restore.

**Pass ☐ / Fail ☐**

---

### 9-D: Overwrite an existing draft

**Steps**:
1. Load `QA Test Draft`
2. Add one more task to the grid
3. Click **Save Draft**
4. Use the same name `QA Test Draft`
5. Confirm overwrite if prompted

**Expected Result**: Draft is updated. Reloading the draft shows the additional task.

**Pass ☐ / Fail ☐**

---

### 9-E: Draft persists after sign out and back in

**Steps**:
1. Sign out
2. Sign back in
3. Go to the Drafts tab

**Expected Result**: `QA Test Draft` is still listed. Load it — tasks and assumptions restore correctly.

**Pass ☐ / Fail ☐**

---

## 10. Post a Schedule

### 10-A: Post a draft

**Steps**:
1. Load `QA Test Draft`
2. Click **Post Schedule** in the top toolbar
3. Confirm if prompted

**Expected Result**: Schedule status changes to Posted. It may move from Drafts to the Posted tab.

**Pass ☐ / Fail ☐**

---

### 10-B: Posted schedule appears in Posted tab

**Steps**:
1. In the Load Schedule panel, click the **Posted** tab

**Expected Result**: The schedule from 10-A appears in the Posted list with a posted status indicator.

**Pass ☐ / Fail ☐**

---

### 10-C: Load a posted schedule

**Steps**:
1. Click on the posted schedule in the Posted tab
2. Load it

**Expected Result**: Schedule grid loads with all tasks. Read-only state may apply (if implemented).

**Pass ☐ / Fail ☐**

---

## 11. Templates

### 11-A: Save a master template

**Steps**:
1. Build a small schedule (place 3–5 tasks)
2. Click **Save Template** in the toolbar
3. Choose **Master Template**
4. Enter name: `QA Master Template`
5. Save

**Expected Result**: No error. Template is saved.

**Pass ☐ / Fail ☐**

---

### 11-B: Master template appears in Templates tab

**Steps**:
1. In the Load Schedule panel, click the **Templates** tab

**Expected Result**: `QA Master Template` appears in the master templates list.

**Pass ☐ / Fail ☐**

---

### 11-C: Load a master template

**Steps**:
1. Click **Clear** to empty the grid
2. Select `QA Master Template` from the Templates tab
3. Click **Load Template**

**Expected Result**: Grid loads with the tasks from the template. Assumptions also restore.

**Pass ☐ / Fail ☐**

---

### 11-D: Save a user (personal) template

**Steps**:
1. Build a different small schedule
2. Click **Save Template** → choose **My Template** (personal/user template)
3. Enter name: `QA User Template`
4. Save

**Expected Result**: Template saves. Appears under the user templates section in the Templates tab.

**Pass ☐ / Fail ☐**

---

### 11-E: Delete a template

**Steps**:
1. In the Templates tab, find `QA User Template`
2. Click the delete icon next to it
3. Confirm deletion

**Expected Result**: Template is removed from the list immediately.

**Pass ☐ / Fail ☐**

---

### 11-F: Templates persist after sign out

**Steps**:
1. Sign out and sign back in
2. Go to Templates tab

**Expected Result**: `QA Master Template` is still listed and loads correctly.

**Pass ☐ / Fail ☐**

---

## 12. Setup — Program Mix

### 12-A: Open Setup overlay

**Steps**:
1. Click **Setup** in the top toolbar

**Expected Result**: The Setup & Defaults overlay opens, showing four tabs: Program Mix, Task Defaults, Role Config, Categories.

**Pass ☐ / Fail ☐**

---

### 12-B: Program Mix values are visible

**Steps**:
1. Confirm you are on the **Program Mix** tab

**Expected Result**: Percentage fields are visible for Social, Select, PF, Cats, Multipet, and Multipet/Cats. Values are populated (not blank).

**Pass ☐ / Fail ☐**

---

### 12-C: Change a program mix value and save

**Steps**:
1. Change **Social %** to `65`
2. Click **Save Defaults**

**Expected Result**: Overlay closes without errors. Reopening Setup shows Social % = 65.

**Pass ☐ / Fail ☐**

---

### 12-D: Program mix persists after sign out

**Steps**:
1. Sign out and sign back in
2. Open Setup → Program Mix

**Expected Result**: Social % still shows `65` (the value saved in 12-C).

**Pass ☐ / Fail ☐**

---

## 13. Setup — Task Defaults

### 13-A: All tasks are visible in Task Defaults tab

**Steps**:
1. Open Setup → click **Task Defaults** tab

**Expected Result**: All tasks are listed under their category headers. Each row shows code, name, unit basis, min/unit, color, and Count Hrs checkbox. Drag handles (⠿) are visible on the left of each row.

**Pass ☐ / Fail ☐**

---

### 13-B: Change a task's duration and save

**Steps**:
1. Find **"PG Prep"** in the Task Defaults list
2. Change its **Min / Unit** value from `30` to `45`
3. Click **Save Defaults**

**Expected Result**: Overlay closes. On the main schedule grid, if PG Prep is placed, its block size now reflects 45 minutes. The Task Library chip also shows the updated duration.

**Pass ☐ / Fail ☐**

---

### 13-C: Change a task's color

**Steps**:
1. Open Setup → Task Defaults
2. Click the color swatch for any task
3. Select a different color
4. Click **Save Defaults**

**Expected Result**: The task block on the grid (if placed) and the library chip update to the new color.

**Pass ☐ / Fail ☐**

---

### 13-D: Reorder tasks within a category using drag handle

**Steps**:
1. Open Setup → Task Defaults
2. In the **Play Groups** section, grab the ⠿ handle on the first task
3. Drag it down to swap position with the second task
4. Click **Save Defaults**

**Expected Result**: The order of tasks in Play Groups in the Task Library reflects the new order after reopening Setup.

**Pass ☐ / Fail ☐**

---

### 13-E: Delete a task

**Steps**:
1. Open Setup → Task Defaults
2. Find a non-critical task and click the 🗑 (delete) icon on its row
3. Confirm if prompted
4. Click **Save Defaults**

**Expected Result**: The task is removed from the Task Defaults list and disappears from the Task Library on the main grid.

**Pass ☐ / Fail ☐**

---

### 13-F: Add a new custom task

**Steps**:
1. Open Setup → Task Defaults
2. Look for a **+ Add Task** button or option at the bottom of any category
3. Click it and fill in:
   - Code: `QA-TEST`
   - Name: `QA Custom Task`
   - Min/Unit: `30`
   - Category: Play Groups
4. Save the new task
5. Click **Save Defaults**

**Expected Result**: The new task appears in Task Defaults under Play Groups. It also appears in the Task Library on the main grid and can be dragged onto the schedule.

**Pass ☐ / Fail ☐**

---

## 14. Setup — Role Config

### 14-A: All roles are visible

**Steps**:
1. Open Setup → click **Role Config** tab

**Expected Result**: All configured role rows are visible. Each shows label, sub-text, shift start/end, unpaid break, hours (auto-calculated), and In Hrs checkbox. Drag handles (⠿) are visible on the left.

**Pass ☐ / Fail ☐**

---

### 14-B: Edit a role's shift time

**Steps**:
1. Find **TL AM** in the list
2. Change **Shift Start** to `07:00 AM`
3. Click **Save Defaults**

**Expected Result**: The TL AM column header on the schedule grid updates to show the new start time. The hours value recalculates automatically.

**Pass ☐ / Fail ☐**

---

### 14-C: Drag to reorder roles

**Steps**:
1. Open Setup → Role Config
2. Grab the ⠿ handle on the **GM** row
3. Drag it to a different position
4. Click **Save Defaults**

**Expected Result**: On the main schedule grid, the GM column appears in its new position. Reopening Role Config shows GM in its new position. Hard refresh preserves the order.

**Pass ☐ / Fail ☐**

---

### 14-D: Delete a role (soft delete)

**Steps**:
1. Open Setup → Role Config
2. Find a role (e.g. **UTL Mid**) and click the delete icon
3. Click **Save Defaults**

**Expected Result**:
- The role column disappears from the current (blank) schedule grid
- **No purge/confirmation prompt appears** — saved schedules are not touched
- If you then load a saved draft or template that contained this role, the column is still visible with a **strikethrough label** and **DELETED badge** — the data is preserved, not removed

**Pass ☐ / Fail ☐**

---

### 14-E: Restore a deleted role

**Steps**:
1. Open Setup → Role Config
2. Find the deleted role from 14-D (shown with DELETED status)
3. Click to restore / un-delete it
4. Click **Save Defaults**

**Expected Result**: The role reappears as a column on the schedule grid. Any saved schedules that showed the DELETED badge for this role now display it normally again.

**Pass ☐ / Fail ☐**

---

### 14-F: New role — In Hrs defaults to unchecked

**Steps**:
1. Open Setup → Role Config
2. Click **+ Add Role** (or equivalent)
3. Note the state of the **In Hrs** checkbox for the new role

**Expected Result**: The In Hrs checkbox is **unchecked** by default. The user must explicitly check it.

**Steps continued**:
4. Check the In Hrs checkbox
5. Click **Save Defaults**
6. Hard refresh the page (F5)
7. Open Setup → Role Config

**Expected Result**: The In Hrs checkbox is still checked for the new role. The role appears in Hours Available in the Schedule Summary.

**Pass ☐ / Fail ☐**

---

### 14-G: Role type persists after save

**Steps**:
1. Open Setup → Role Config
2. Find a role and change its **Type** field (if editable) to a different value
3. Click **Save Defaults**
4. Hard refresh the page (F5)
5. Open Setup → Role Config

**Expected Result**: The type change is preserved after refresh. It is not silently reset to a default value.

**Pass ☐ / Fail ☐**

---

## 15. Setup — Categories

### 15-A: Base categories are shown

**Steps**:
1. Open Setup → click **Categories** tab

**Expected Result**: The configured base categories are listed (Play Groups, Suite Care, Meals, Fixed Tasks, Overnight, plus any custom ones). All show **ACTIVE** status.

**Pass ☐ / Fail ☐**

---

### 15-B: Add a new category

**Steps**:
1. In the Categories tab, type `QA Test Category` in the new category input field
2. Click **+ Add Category**

**Expected Result**: `QA Test Category` immediately appears in the list with ACTIVE status.

**Pass ☐ / Fail ☐**

---

### 15-C: New category appears in Task Library

**Steps**:
1. Click **Save Defaults** to save the new category
2. Close Setup
3. In the Task Library, click **All Tasks**

**Expected Result**: `QA Test Category` appears as a category header in the Task Library (it will be empty until tasks are assigned to it).

**Pass ☐ / Fail ☐**

---

### 15-D: Delete (soft delete) a category

**Steps**:
1. Open Setup → Categories
2. Find `QA Test Category` and click **Delete**

**Expected Result**: `QA Test Category` disappears from the list in the Categories tab (soft-deleted, not permanently destroyed).

**Pass ☐ / Fail ☐**

---

### 15-E: Deleted category is hidden from Task Library

**Steps**:
1. Click **Save Defaults**
2. Close Setup
3. Check the Task Library

**Expected Result**: `QA Test Category` no longer appears as a header in the Task Library.

**Pass ☐ / Fail ☐**

---

## 16. Data Persistence

These tests verify that data saved to the server actually persists across sessions.

### 16-A: Setup changes survive a full page reload

**Steps**:
1. Open Setup → Program Mix
2. Note the current Social % value
3. Change it to a distinct number (e.g., `72`)
4. Click **Save Defaults**
5. Press **F5** / **Cmd+R** to reload the page (do not sign out)

**Expected Result**: After reload, the app still shows the logged-in user. Reopening Setup → Program Mix shows Social % = 72.

**Pass ☐ / Fail ☐**

---

### 16-B: Saved draft persists after browser close

**Steps**:
1. Save a draft named `Persistence Test`
2. **Fully close the browser** (not just the tab)
3. Reopen the browser and go to `noble-scheduler.vercel.app`
4. Sign in
5. Check the Drafts tab

**Expected Result**: `Persistence Test` is listed. Loading it restores the schedule correctly.

**Pass ☐ / Fail ☐**

---

### 16-C: Data is user-specific

**Steps**:
1. Sign in as the QA Tester account and save a draft named `User A Draft`
2. Sign out
3. Create a second account (e.g., `qa2@noblepetresort.com`)
4. Sign in as the second account
5. Check the Drafts tab

**Expected Result**: `User A Draft` does **not** appear for the second user. Each user only sees their own schedules.

**Pass ☐ / Fail ☐**

---

## 17. Validation & Checklist

### 17-A: Open the Validate panel

**Steps**:
1. Place several tasks on the grid (leaving some required tasks unplaced)
2. Click **Validate** in the top toolbar

**Expected Result**: A validation panel or modal opens. It lists warnings or issues with the current schedule (e.g., unplaced required tasks, conflicts, understaffed roles).

**Pass ☐ / Fail ☐**

---

### 17-B: Open the Checklist

**Steps**:
1. Click **Checklist** in the top toolbar

**Expected Result**: A checklist panel opens showing a list of tasks or steps for completing the schedule. Items may be checkable.

**Pass ☐ / Fail ☐**

---

### 17-C: Clear the schedule

**Steps**:
1. Place several tasks on the grid
2. Click **Clear** in the top toolbar
3. Confirm if prompted

**Expected Result**: All task blocks are removed from the grid. The schedule is empty. Task Library resets to showing all tasks as Pending.

**Pass ☐ / Fail ☐**

---

## 18. Edge Cases & Error Handling

### 18-A: No duplicate task names in the same column

**Steps**:
1. Drag a task to a column at 8:00 AM
2. Try to drag the same task type to the same column at a non-overlapping time

**Expected Result**: App either allows it (if duplicates are permitted) or shows a warning. Behavior is consistent and the grid does not break.

**Pass ☐ / Fail ☐**

---

### 18-B: Saving a draft with no tasks

**Steps**:
1. Click **Clear** to ensure the grid is empty
2. Click **Save Draft** and enter a name
3. Save

**Expected Result**: An empty draft is saved without error. Loading it shows an empty grid.

**Pass ☐ / Fail ☐**

---

### 18-C: Load schedule with a template that has custom assumptions

**Steps**:
1. Save a template with non-default assumptions (e.g., dogs = 90, socpg = 3)
2. Clear the grid and change assumptions to different values
3. Load the saved template

**Expected Result**: The template restores both the tasks AND the assumptions from when it was saved (dogs = 90, socpg = 3).

**Pass ☐ / Fail ☐**

---

### 18-D: Placing a task outside a role's shift window

**Steps**:
1. Note a role's shift window from its column header (e.g. TL AM 6a–2p)
2. Try to drag a task to that column at a time outside the shift (e.g. 3:00 PM)

**Expected Result**: App either prevents placement outside shift hours or allows it with a visual indicator. Grid does not crash.

**Pass ☐ / Fail ☐**

---

### 18-E: Deleted role column preserved in saved schedules

**Steps**:
1. Save a draft with tasks placed in a role column (e.g. UTL Mid)
2. Open Setup → Role Config and delete that role → Save Defaults
3. Load the saved draft from step 1

**Expected Result**: The deleted role's column is still visible in the loaded schedule with a **strikethrough label** and **DELETED badge**. The task blocks in that column are intact. No data was removed.

**Pass ☐ / Fail ☐**

---

### 18-F: Network error handling

**Steps**:
1. Open browser DevTools → Network tab
2. Set network to **Offline** mode
3. Try to click **Save Defaults** in Setup

**Expected Result**: An error message alerts the user that the save failed to reach the server. The app does not crash or show a blank screen. Data may be saved locally.

**Pass ☐ / Fail ☐**

---

### 18-G: Session timeout handling

**Steps**:
1. Sign in normally
2. Manually clear `noble_token` from `localStorage` (DevTools → Application → Local Storage)
3. Try to save a draft or save defaults

**Expected Result**: App detects the missing/invalid token and redirects to the Sign In screen (or shows a sign-in prompt). No data corruption occurs.

**Pass ☐ / Fail ☐**

---

### 18-H: Hours Available driven purely by In Hrs flag

**Steps**:
1. Open Setup → Role Config
2. Note which roles have **In Hrs** checked
3. Close Setup and look at **Hours Available** in Schedule Summary
4. Click the **ⓘ** next to Hours Available

**Expected Result**: The tooltip lists exactly the roles with In Hrs checked — no others. Roles excluded regardless of their type. GM and TL roles with In Hrs unchecked do not appear even though they have shift hours configured.

**Pass ☐ / Fail ☐**

---

## Test Run Summary

Use this table to track overall results:

| Section | # Tests | Passed | Failed | Notes |
|---------|---------|--------|--------|-------|
| 1. Authentication | 6 | | | |
| 2. Initial Data Load | 4 | | | |
| 3. Assumptions Panel | 3 | | | |
| 4. Schedule Grid — Basic | 6 | | | |
| 5. Schedule Grid — Conflicts | 3 | | | |
| 6. Task Block Actions | 4 | | | |
| 7. Task Library | 4 | | | |
| 8. Schedule Summary | 7 | | | |
| 9. Save & Load Drafts | 5 | | | |
| 10. Post a Schedule | 3 | | | |
| 11. Templates | 6 | | | |
| 12. Setup — Program Mix | 4 | | | |
| 13. Setup — Task Defaults | 6 | | | |
| 14. Setup — Role Config | 7 | | | |
| 15. Setup — Categories | 5 | | | |
| 16. Data Persistence | 3 | | | |
| 17. Validation & Checklist | 3 | | | |
| 18. Edge Cases | 8 | | | |
| **Total** | **97** | | | |

---

*End of QA Test Scenarios*
