# Implementation Plan: Remove Icon Before Month Headings ("ডিসেম্বর ২০২৫" and So On)

Remove the icon and its container box before month headings (such as `"ডিসেম্বর ২০২৫ ফোল্ডার"`) across Current Affairs month folders and Year-based Job Solutions month headers, ensuring clean flush alignment for existing and newly generated month items across both Web and Android User APK targets.

---

## User Review & Confirmed Decisions

> [!IMPORTANT]
> The following user preferences were confirmed during Phase 1 clarification:
> - **Flush Text Alignment**: Remove both the folder icon (`Folder` / `FolderOpen`) and its surrounding container box (`<div className="w-9 h-9 ...">`) to achieve clean, flush-left alignment with no empty placeholder.
> - **Unified Application**: Apply across **Current Affairs month folders** and verify **Year-based Job Solutions month headers** so no icons precede month names anywhere in these sections.
> - **Future-Proof Guarantee**: Because the icon wrapper is removed from the dynamic loop template (`pastMonthGroups.map(...)`), any future month folder added to the app will automatically render without an icon.
> - **Dual Target Synchronization**: Rebuild and synchronize both Web (`dist/`) and Android User APK (`dist-user/`).

---

## 1. Overview & Visual Comparison

### Current Layout (Current Affairs Month Folder Header)
```
┌────────────────────────────────────────────────────────────────────────┐
│  button (Month Folder Header)                                         │
│  [ 📁 (Amber Icon Box) ]  ডিসেম্বর ২০২৫ ফোল্ডার         [ ফোল্ডার খুলুন ⌄ ] │
│  ^^^^^^^^^^^^^^^^^^^^^^^                                               │
│  (Icon and container box to be removed)                                │
└────────────────────────────────────────────────────────────────────────┘
```

### Proposed Layout (Current Affairs Month Folder Header)
```
┌────────────────────────────────────────────────────────────────────────┐
│  button (Month Folder Header)                                         │
│  ডিসেম্বর ২০২৫ ফোল্ডার                                   [ ফোল্ডার খুলুন ⌄ ] │
│  (Clean, flush-left title without preceding icon or container box)      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Proposed Source Modifications

### Target File: `src/user/CurrentAffairsFeed.tsx`

#### In Previous Months Folder Header Loop (Lines 429–442)
Remove the amber icon container box:
```tsx
// Before:
<div className="flex items-center gap-3">
  <div className="w-9 h-9 rounded-xl bg-amber-100/80 border border-amber-200/90 flex items-center justify-center text-amber-800 shrink-0">
    {isOpen ? (
      <FolderOpen className="w-5 h-5 text-amber-600" />
    ) : (
      <Folder className="w-5 h-5 text-amber-600" />
    )}
  </div>
  <div>
    <h4 className="text-xs sm:text-sm font-black text-slate-900">
      {group.monthLabel} ফোল্ডার
    </h4>
  </div>
</div>

// After:
<div className="flex items-center gap-2 min-w-0">
  <h4 className="text-xs sm:text-sm font-black text-slate-900 leading-tight">
    {group.monthLabel} ফোল্ডার
  </h4>
</div>
```

### Target File: `src/user/UserPortal.tsx`

#### In Year-Based Job Solutions Month Headers (Lines 6914–6918)
Verify that month headers remain completely flush and clean without any preceding icons:
```tsx
<div className="flex items-center gap-2 min-w-0">
  <span className="font-extrabold text-[12.5px] sm:text-[13.5px] text-slate-800">
    {monthGroup.monthLabel}
  </span>
</div>
```

---

## 3. Build & Target Synchronization Plan

1. **Lint & Type Check**:
   - Run `lint_applet` to confirm zero syntax errors and valid TSX.
2. **Web Production Target (`dist/`)**:
   - Recompile via `npm run build` (`compile_applet`).
3. **Android User APK Target (`dist-user/`)**:
   - Rebuild via `npm run build:user`.
   - Ensure `dist-user/index.html` is generated and automated admin-isolation validation passes.
4. **Dev Server Verification**:
   - Restart the dev server to serve fresh code.

---

## 4. Verification & Testing

- Confirm that month headings such as `"ডিসেম্বর ২০২৫ ফোল্ডার"`, `"নভেম্বর ২০২৫ ফোল্ডার"`, etc. render directly without any folder icon or amber box.
- Confirm that expand/collapse toggle buttons (`ফোল্ডার খুলুন` / `বন্ধ করুন` + chevron indicator) remain fully functional and intact.
- Confirm all typography, badge counters, and child MCQ date cards remain styled as expected.
