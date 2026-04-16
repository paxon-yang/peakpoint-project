# DESIGN-PATCH.md — CCSA Gantt Chart Complete Fix List
> Supplement to `DESIGN.md`. Apply all fixes below to reach the Cal.com target style.
> Priority order: FIX 3 → FIX 2 → FIX 4 → FIX-ROWS → FIX 1 → FIX 6 → FIX 5/7/8

---

## Codex Prompt (paste this first)

```
Read DESIGN.md and DESIGN-PATCH.md in the project root.
Apply every numbered FIX below to the Gantt chart component.
Follow the exact CSS values given — do not substitute or approximate.
Do not change layout logic, data, or bar position/width calculations.
Only change visual styling properties.
```

---

## FIX-ROWS — Row Borders (Too Many Lines) 🔴

**Problem:** Every row has borders on multiple sides creating a heavy cage/grid effect. The UI looks like a spreadsheet. Cal.com style uses only a single bottom divider per row — no top, no left, no right borders on individual cells.

**Root cause to find in code:** Any rule applying `border`, `border-top`, `outline`, or `box-shadow` to `.gantt-row`, `.gantt-cell`, `tr`, or `td` elements beyond a single `border-bottom`.

**Fix — Row rules:**
```css
/* ✅ CORRECT: single bottom border only */
.gantt-row,
tr {
  border-top: none;
  border-left: none;
  border-right: none;
  border-bottom: 1px solid #e5e7eb;   /* --border */
  box-shadow: none;
  outline: none;
}

.gantt-row:last-child,
tr:last-child {
  border-bottom: none;   /* clean termination */
}
```

**Fix — Cell rules:**
```css
/* ✅ CORRECT: cells have NO individual borders */
.gantt-cell,
td,
th {
  border: none;
  border-right: none;
  border-left: none;
  outline: none;
  box-shadow: none;
}

/* Only exception: vertical divider between left panel and timeline */
.gantt-left-panel {
  border-right: 1px solid #d1d5db;   /* --border-dark, single vertical line */
}
```

**Fix — Row height and padding:**
```css
.gantt-row,
tr {
  min-height: 44px;
  padding: 0;
  display: flex;
  align-items: center;
}

/* Cell padding creates visual rhythm without relying on borders */
.gantt-cell,
td {
  padding: 10px 16px;
}
```

---

## FIX 3 — Status Dropdown (Replace `<select>`) 🔴 MOST CRITICAL

**Problem:** Status column uses browser-native `<select>` dropdown. This is the most visually jarring element in the UI — inconsistent with all other components. Must be replaced with a custom badge-button that looks identical to the status badges defined in DESIGN.md.

**Find in code:** Any `<select>` element in the status column. Remove it entirely.

**Replacement — React component pattern:**
```jsx
const STATUS_OPTIONS = [
  { value: 'not-started', label: 'Not Started', labelCN: '未开始',  dot: '#9ca3af', style: 'badge-gray'   },
  { value: 'in-progress', label: 'In Progress', labelCN: '进行中',  dot: '#3b82f6', style: 'badge-blue'   },
  { value: 'completed',   label: 'Completed',   labelCN: '已完成',  dot: '#10b981', style: 'badge-green'  },
  { value: 'blocked',     label: 'Blocked',     labelCN: '受阻',    dot: '#f59e0b', style: 'badge-amber'  },
  { value: 'cancelled',   label: 'Cancelled',   labelCN: '已取消',  dot: '#ef4444', style: 'badge-red'    },
];

// Render: badge trigger button that opens a dropdown menu on click
// NOT a <select>. NOT a native dropdown. A fully custom component.
```

**CSS — Badge trigger button:**
```css
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
  border: none;
  background: none;
  transition: opacity 0.10s;
  white-space: nowrap;
  letter-spacing: 0.01em;
}

.status-badge:hover { opacity: 0.75; }

/* Dot indicator inside badge */
.status-badge-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* Dropdown arrow */
.status-badge::after {
  content: '▾';
  font-size: 9px;
  margin-left: 1px;
  opacity: 0.5;
}

/* Status variants — match DESIGN.md badge system exactly */
.status-badge.not-started {
  background: #f3f4f6;
  color: #6b7280;
  border: 1px solid #e5e7eb;
}
.status-badge.not-started .status-badge-dot { background: #9ca3af; }

.status-badge.in-progress {
  background: #eff6ff;
  color: #2563eb;
  border: 1px solid #bfdbfe;
}
.status-badge.in-progress .status-badge-dot {
  background: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59,130,246,0.2);
}

.status-badge.completed {
  background: #ecfdf5;
  color: #059669;
  border: 1px solid #a7f3d0;
}
.status-badge.completed .status-badge-dot { background: #10b981; }

.status-badge.blocked {
  background: #fffbeb;
  color: #d97706;
  border: 1px solid #fde68a;
}
.status-badge.blocked .status-badge-dot { background: #f59e0b; }

.status-badge.cancelled {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}
.status-badge.cancelled .status-badge-dot { background: #ef4444; }
```

**CSS — Dropdown menu:**
```css
.status-dropdown-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 200;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.10), 0 1px 3px rgba(0,0,0,0.06);
  padding: 4px;
  min-width: 160px;
}

.status-dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 5px;
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  cursor: pointer;
  transition: background 0.08s;
}

.status-dropdown-item:hover { background: #f3f4f6; }

.status-dropdown-item-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}
```

---

## FIX 2 — Column Headers (Uppercase + Muted) 🟠

**Problem:** Column headers `TASK NAME / OWNER / STATUS / START / END / DURATION` use the same visual weight and color as body text rows. There is no clear separation between header and data.

**Find in code:** The `<thead>` row or the header row div of the gantt table.

**Fix:**
```css
/* Column header row */
.gantt-col-header-row,
thead tr {
  background: #f3f4f6;           /* --bg-3 */
  border-bottom: 1px solid #e5e7eb;
  position: sticky;
  top: 52px;                     /* below the topbar */
  z-index: 50;
}

/* Each column header cell */
.gantt-col-header,
thead th {
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  font-size: 11px;
  font-weight: 700;
  color: #9ca3af;                /* --text-4 — muted gray */
  letter-spacing: 0.07em;
  text-transform: uppercase;
  padding: 10px 16px;
  white-space: nowrap;
  border: none;                  /* no individual cell borders */
  user-select: none;
}

/* Sortable column — hover feedback */
.gantt-col-header.sortable:hover,
thead th.sortable:hover {
  color: #6b7280;
  cursor: pointer;
}
```

---

## FIX 4 — Group Header Rows (Background Separation) 🟠

**Problem:** Group header rows like `Conveyor & Loading Sys` and `Equipment Arrangement` are visually identical to regular task rows. They need a background tint to create clear section grouping.

**Find in code:** The parent/group rows in the gantt tree structure (rows that contain child tasks but are not themselves tasks).

**Fix:**
```css
/* Group header row — tinted background, NOT extra borders */
.gantt-row.group-header,
tr.group-header {
  background: #f3f4f6;           /* --bg-3 */
  min-height: 34px;              /* slightly shorter than task rows */
  border-top: none;
  border-bottom: 1px solid #e5e7eb;
}

/* Group label text */
.gantt-group-label {
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  font-size: 12px;
  font-weight: 700;
  color: #374151;                /* --text-2 */
  letter-spacing: 0.01em;
  padding-left: 12px;
}

/* Sub-task rows — indent task name to show hierarchy */
.gantt-row.subtask .gantt-cell-task-name,
tr.subtask td:first-child {
  padding-left: 28px;            /* indent under group */
}

/* Group expand/collapse chevron */
.group-chevron {
  font-size: 10px;
  color: #9ca3af;
  margin-right: 6px;
  transition: transform 0.15s;
  cursor: pointer;
}
.group-chevron.expanded { transform: rotate(90deg); }
```

---

## FIX 5 — Gantt Bars (Complete Restyle) 🔴 CRITICAL

**Problem:** Bars are too tall, have square corners, wrong font size/weight/family, and wrong colors for Completed and Not Started states.

**Find in code:** All CSS classes/styles applied to the gantt bar elements inside the timeline area.

**Replace ALL existing gantt bar CSS with this exact block:**
```css
/* Base bar — ALL status variants inherit this */
.gantt-bar {
  position: absolute;
  height: 20px;                  /* SLIM — not 26px, not 28px */
  top: 50%;
  transform: translateY(-50%);
  border-radius: 20px;           /* FULL PILL — not 4px, not 6px */
  display: flex;
  align-items: center;
  padding: 0 10px;
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  font-size: 11px;               /* SMALL — not 13px, not 14px */
  font-weight: 600;              /* SEMIBOLD — not 700 bold */
  letter-spacing: 0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: default;
  transition: filter 0.12s ease;
}

.gantt-bar:hover {
  filter: brightness(0.93);
}

/* IN PROGRESS — solid blue pill */
.gantt-bar.in-progress {
  background: #3b82f6;
  color: #ffffff;
  box-shadow: 0 1px 4px rgba(59,130,246,0.35),
              0 0 0 1px rgba(59,130,246,0.15);
}

/* COMPLETED — green tint pill (NOT solid green fill) */
.gantt-bar.completed {
  background: #ecfdf5;
  color: #059669;
  border: 1.5px solid #a7f3d0;
  box-shadow: none;
}

/* NOT STARTED — ghost pill, lowest visual weight */
.gantt-bar.not-started {
  background: #f3f4f6;
  color: #6b7280;
  border: 1.5px solid #d1d5db;
  box-shadow: none;
}

/* BLOCKED — amber tint pill */
.gantt-bar.blocked {
  background: #fffbeb;
  color: #b45309;
  border: 1.5px solid #fde68a;
  box-shadow: none;
}

/* CANCELLED — red tint pill */
.gantt-bar.cancelled {
  background: #fef2f2;
  color: #dc2626;
  border: 1.5px solid #fecaca;
  box-shadow: none;
}

/* MILESTONE DIAMOND */
.gantt-milestone {
  position: absolute;
  width: 10px;
  height: 10px;
  background: #111827;
  transform: translateY(-50%) rotate(45deg);
  top: 50%;
  border-radius: 2px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.25);
}
```

**Property change summary — what changed and why:**

| Property | ❌ Wrong | ✅ Correct | Reason |
|----------|----------|-----------|--------|
| `height` | 26–30px | **20px** | Slim pill, not a block |
| `border-radius` | 4–6px | **20px** | Full pill shape |
| `font-size` | 13–14px | **11px** | Bar label is secondary UI |
| `font-weight` | 700 | **600** | Semibold reads clearly |
| `font-family` | system-ui | **Plus Jakarta Sans** | Must match rest of UI |
| `letter-spacing` | 0 | **0.01em** | Legibility at 11px |
| Completed `background` | solid green | **#ecfdf5 tint** | Tint + border, not fill |
| Completed `border` | none | **1.5px solid #a7f3d0** | Defines shape on tint |
| Not Started `background` | solid gray | **#f3f4f6** | Very light, lowest weight |
| Blue bar `box-shadow` | none | **colored glow** | Lift and polish |

---

## FIX 1 — Top Bar Styling 🟡

**Problem:** Top bar blends into page with no visual separation. CN/EN toggle is unstyled. Controls lack grouping.

**Fix:**
```css
.topbar {
  height: 52px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  display: flex;
  align-items: center;
  padding: 0 24px;
  gap: 12px;
  position: sticky;
  top: 0;
  z-index: 100;
}

/* CN/EN language toggle */
.lang-toggle {
  display: flex;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
}

.lang-toggle button {
  padding: 4px 10px;
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  font-size: 12px;
  font-weight: 600;
  border: none;
  background: transparent;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.10s;
}

.lang-toggle button.active {
  background: #111827;
  color: #ffffff;
  border-radius: 5px;
}

/* Logout button */
.btn-logout {
  padding: 5px 12px;
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  font-size: 12px;
  font-weight: 600;
  background: transparent;
  color: #6b7280;
  border: 1px solid #e5e7eb;
  border-radius: 7px;
  cursor: pointer;
  transition: all 0.10s;
}
.btn-logout:hover {
  color: #111827;
  border-color: #d1d5db;
  background: #f3f4f6;
}

/* "Saved" indicator */
.save-indicator {
  font-size: 12px;
  color: #9ca3af;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 5px;
}
.save-indicator::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #10b981;
}

/* New Project button */
.btn-new-project {
  background: #111827;
  color: #ffffff;
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  font-size: 13px;
  font-weight: 600;
  padding: 7px 14px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  transition: background 0.12s;
  white-space: nowrap;
}
.btn-new-project:hover { background: #1f2937; }
```

---

## FIX 6 — Timeline Date Axis 🟡

**Problem:** Month labels (April/May) are too light and thin. Day number cells are too large and not muted. Today's column has no highlight. The axis does not provide enough visual orientation.

**Fix:**
```css
/* Timeline header wrapper */
.timeline-header {
  position: sticky;
  top: 52px;
  z-index: 50;
  background: #f3f4f6;
  border-bottom: 2px solid #d1d5db;
}

/* Month label row */
.timeline-month-cell {
  text-align: center;
  padding: 6px 0 4px;
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  font-size: 11px;
  font-weight: 700;              /* bold month labels */
  color: #374151;                /* --text-2, more visible */
  letter-spacing: 0.04em;
  text-transform: uppercase;
  border-right: 1px solid #e5e7eb;
  border-bottom: 1px solid #e5e7eb;
}

/* Current month — blue accent */
.timeline-month-cell.current {
  color: #3b82f6;
}

/* Day number cells */
.timeline-day-cell {
  text-align: center;
  padding: 3px 0;
  font-size: 10px;
  font-weight: 500;
  color: #9ca3af;                /* --text-4 — muted small numbers */
  border-right: 1px solid #e5e7eb;
}

/* Today column — blue highlight */
.timeline-day-cell.today {
  color: #3b82f6;
  font-weight: 700;
  background: rgba(59, 130, 246, 0.06);
}

/* Weekend columns — very subtle tint */
.timeline-day-cell.weekend {
  background: rgba(0, 0, 0, 0.012);
}

/* Today vertical line through all rows */
.today-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: #3b82f6;
  opacity: 0.35;
  z-index: 10;
  pointer-events: none;
}
```

---

## FIX 7 — Frozen First Column + Scroll Layout 🟢

**Problem:** When scrolling horizontally, the task name column scrolls away. It should stay frozen (sticky) so the user always knows which task they're looking at.

**Fix:**
```css
/* Page container — full height, no overflow */
.gantt-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  background: #fafafa;
}

/* Scrollable body */
.gantt-body {
  flex: 1;
  overflow: auto;
  position: relative;
}

/* Frozen task name column */
.gantt-cell-task-name,
td:first-child,
th:first-child {
  position: sticky;
  left: 0;
  z-index: 20;
  background: inherit;           /* inherits row background (white or --bg-3) */
  border-right: 1px solid #d1d5db;
}

/* Ensure group rows also freeze correctly */
.gantt-row.group-header .gantt-cell-task-name {
  background: #f3f4f6;           /* --bg-3 explicitly set for group rows */
}
```

---

## FIX 8 — Row Controls (Drag Handle + Expand Toggle) 🟢

**Problem:** Drag handles and expand arrows are always visible and taking up space. They should appear only on hover, keeping rows clean by default.

**Fix:**
```css
/* Row controls container — hidden by default */
.row-controls {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 0 4px;
  opacity: 0;
  transition: opacity 0.10s;
  flex-shrink: 0;
}

/* Reveal on row hover */
.gantt-row:hover .row-controls {
  opacity: 1;
}

/* Drag handle */
.drag-handle {
  cursor: grab;
  color: #9ca3af;
  font-size: 12px;
  padding: 3px;
  border-radius: 3px;
  line-height: 1;
  transition: color 0.10s;
  user-select: none;
}
.drag-handle:hover { color: #374151; }
.drag-handle:active { cursor: grabbing; }

/* Expand/collapse toggle */
.expand-toggle {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  cursor: pointer;
  color: #9ca3af;
  font-size: 10px;
  background: none;
  border: none;
  transition: all 0.10s;
  padding: 0;
}
.expand-toggle:hover {
  background: #e9eaec;
  color: #374151;
}
.expand-toggle.expanded {
  transform: rotate(90deg);
}

/* Add subtask (+) button — hidden until row hover */
.add-subtask-btn {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  font-size: 13px;
  color: #9ca3af;
  background: none;
  border: none;
  cursor: pointer;
  opacity: 0;
  transition: all 0.10s;
  padding: 0;
}
.gantt-row:hover .add-subtask-btn {
  opacity: 1;
}
.add-subtask-btn:hover {
  background: #e9eaec;
  color: #3b82f6;
}
```

---

## Complete Fix Summary

| Priority | Fix | Problem | Key Change |
|----------|-----|---------|------------|
| 🔴 | **FIX-ROWS** | Too many borders, cage effect | Only `border-bottom` on rows; no cell borders |
| 🔴 | **FIX 3** | Native `<select>` for status | Replace with custom badge-button + dropdown |
| 🟠 | **FIX 2** | Column headers same as body text | `uppercase` + `font-weight:700` + `color:#9ca3af` |
| 🟠 | **FIX 4** | Group rows blend with task rows | `background:#f3f4f6` on group header rows |
| 🔴 | **FIX 5** | Bars too tall, square, wrong font | `height:20px` + `border-radius:20px` + `font-size:11px` + `font-weight:600` + Plus Jakarta Sans |
| 🟡 | **FIX 1** | Top bar no separation | `border-bottom` + `backdrop-filter:blur` + styled CN/EN toggle |
| 🟡 | **FIX 6** | Timeline axis too weak | Month labels bold `#374151`; day numbers small `#9ca3af`; today blue |
| 🟢 | **FIX 7** | First column not frozen | `position:sticky; left:0` on task name column |
| 🟢 | **FIX 8** | Row controls always visible | `opacity:0` default, `opacity:1` on `.gantt-row:hover` |
