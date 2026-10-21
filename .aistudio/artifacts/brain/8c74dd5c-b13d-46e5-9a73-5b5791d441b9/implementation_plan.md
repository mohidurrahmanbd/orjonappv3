# Implementation Plan: Remove Leaf Icon from Chapter Headings, Header Badge, and Breadcrumbs

Remove the leaf icon (`🌿`) from before `"বাংলা সাহিত্য"` and other chapter headings in the Course routine viewer (`RoutineHierarchicalMCQModal.tsx`), as well as from the reader header badge and breadcrumb path, ensuring clean flush alignment for all current and future chapters across both Web and Android User APK targets.

---

## User Review & Confirmed Decisions

> [!IMPORTANT]
> The following user preferences were confirmed during Phase 1 clarification:
> - **Scope Extension**: Remove the leaf icon (`🌿`) from **chapter topic cards**, the **reader top header badge** (`পরিচ্ছেদ MCQ পাঠ`), and the **breadcrumb trail**.
> - **Alignment**: Keep clean flush alignment on the left of each card heading without any replacement number or icon.
> - **Dual Target Synchronization**: Rebuild and verify for both Web (`dist/`) and Android User APK (`dist-user/`).
> - **Future-Proof Guarantee**: Because the leaf icon is removed directly from the component rendering templates, all newly created or fetched routines and chapters will automatically display with this clean, icon-free layout.

---

## 1. Overview & Layout Comparison

### Topic Card Header (Level 3)
```
Current:
[ 🌿 Green Box ]  বাংলা সাহিত্য  [২৪ টি MCQ]       (Circular Progress Indicator)
^^^^^^^^^^^^^^^^

Proposed:
বাংলা সাহিত্য  [২৪ টি MCQ]                         (Circular Progress Indicator)
(Clean flush left alignment, all styles, badges, and progress tracking preserved)
```

### Reader Header & Breadcrumbs
```
Current:
Header Badge:  [ 🌿 পরিচ্ছেদ MCQ পাঠ ]
Breadcrumb:    📁 বাংলা  ›  📂 সাহিত্য  ›  🌿 বাংলা সাহিত্য

Proposed:
Header Badge:  [ পরিচ্ছেদ MCQ পাঠ ]
Breadcrumb:    📁 বাংলা  ›  📂 সাহিত্য  ›  বাংলা সাহিত্য
```

---

## 2. Proposed Source Modifications

### Target File: `src/shared/components/RoutineHierarchicalMCQModal.tsx`

#### A. Level 3 Topic Cards (Lines 1414–1426)
Remove the `<span className="w-7 h-7 rounded-lg bg-emerald-50 ...">🌿</span>` container box, allowing the topic title and MCQ badge to align cleanly on the left of the card:
```tsx
<div className="flex items-center gap-2.5 min-w-0">
  <div>
    <h5 className="text-xs sm:text-[13px] font-bold text-slate-900 group-hover:text-emerald-950 flex items-center gap-2 flex-wrap transition">
      <span>{leafNode.name.replace(/^(?:পরিচ্ছেদ\s*[:ঃ-]?\s*)/iu, '')}</span>
      <span className="bg-emerald-50 group-hover:bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-md border border-emerald-200">
        {toBengaliDigits(leafNode.questions.length)} টি MCQ
      </span>
    </h5>
  </div>
</div>
```

#### B. Reader Upper-Right Header Badge (Line 923–925)
Remove the inner `<span>🌿</span>`:
```tsx
<span className="bg-emerald-500/30 text-emerald-100 border border-emerald-400/30 text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
  পরিচ্ছেদ MCQ পাঠ
</span>
```

#### C. Reader Breadcrumb Trail (Line 939–945)
Remove `🌿 ` prefix from the leaf node breadcrumb label:
```tsx
{!isSameFolderAndSubfolder(selectedLeafTopic.subName, selectedLeafTopic.leafName) && (
  <>
    <span className="text-emerald-300">›</span>
    <span className="text-amber-300 font-black">{selectedLeafTopic.leafName}</span>
  </>
)}
```

---

## 3. Propagation & Verification Plan

1. **Web Target (`dist/`)**:
   - Recompile via `npm run build` (`compile_applet`).
2. **Android User APK Target (`dist-user/`)**:
   - Rebuild via `npm run build:user`.
   - Prepare entry point: `cp dist-user/index-user.html dist-user/index.html`.
   - Automated verification check: `npm run verify:user`.
3. **Quality & Functional Verification**:
   - Type check with `npm run lint` (`tsc --noEmit`).
   - Verify that card clicking still opens the leaf topic reader smoothly.
   - Restart development server to ensure immediate availability in preview.
