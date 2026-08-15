import { Question, Routine, CategoryItem, SubcategoryItem } from '../types';

/**
 * Normalizes text for case-insensitive and whitespace-trimmed comparison
 */
export const normalizeText = (txt?: string): string => {
  if (!txt) return '';
  return txt.trim().toLowerCase().replace(/\s+/g, ' ');
};

/**
 * Recursively resolves the subcategory parent chain up to the root category.
 * e.g. "কাজী নজরুল ইসলাম" -> ["বিষয়ভিত্তিক প্রস্তুতি", "বাংলা সাহিত্য", "কাজী নজরুল ইসলাম"]
 */
export const getSubcategoryAncestryChain = (
  subName: string,
  subcategories: SubcategoryItem[],
  rootFallback?: string
): string[] => {
  if (!subName) return rootFallback ? [rootFallback] : [];
  const chain: string[] = [subName.trim()];
  let current = subcategories.find(
    s => normalizeText(s.name) === normalizeText(subName)
  );

  let limit = 10;
  while (current && current.parentCategory && limit > 0) {
    const parentName = current.parentCategory.trim();
    // Check if parentName is another subcategory in the list
    const parentSub = subcategories.find(
      s => normalizeText(s.name) === normalizeText(parentName)
    );

    if (parentSub) {
      chain.unshift(parentSub.name.trim());
      current = parentSub;
    } else {
      // parentName is a root category (e.g. "বিষয়ভিত্তিক প্রস্তুতি" or "জব সলিউশন পরীক্ষা")
      chain.unshift(parentName);
      break;
    }
    limit--;
  }

  // If rootFallback is provided and not already at the head of the chain, prepend it
  if (rootFallback && rootFallback.trim()) {
    const rootNorm = normalizeText(rootFallback);
    const headNorm = normalizeText(chain[0]);
    if (!headNorm.includes(rootNorm) && !rootNorm.includes(headNorm)) {
      // Only prepend if the chain head doesn't look like a root category
      const isKnownRoot = ['বিষয়ভিত্তিক প্রস্তুতি', 'বিষয় ভিক্তিক প্রস্তুতি', 'জব সলিউশন পরীক্ষা', 'সাল ভিত্তিক জব সলিউশন'].some(
        r => normalizeText(r) === headNorm
      );
      if (!isKnownRoot) {
        chain.unshift(rootFallback.trim());
      }
    }
  }

  return chain;
};

/**
 * Computes human-readable hierarchical syllabus path strings for a routine.
 * e.g. ["বিষয়ভিত্তিক প্রস্তুতি > বাংলা সাহিত্য > কাজী নজরুল ইসলাম"]
 */
export const formatRoutineSyllabusPaths = (
  routine: Routine,
  subcategories: SubcategoryItem[] = [],
  categories: CategoryItem[] = [],
  questions: Question[] = []
): string[] => {
  const paths: string[] = [];
  const rootCat = (routine.selectedCategories && routine.selectedCategories.length > 0)
    ? routine.selectedCategories[0]
    : undefined;

  const leafList = routine.selectedLeafCategories || [];
  const subList = routine.selectedSubcategories || [];
  const catList = routine.selectedCategories || [];

  // 1. Process Leaf Categories (Specific Subtopics)
  if (leafList.length > 0) {
    leafList.forEach(leaf => {
      // Find chain in subcategories
      let chain = getSubcategoryAncestryChain(leaf, subcategories, rootCat);

      // If chain has only 1 element (leaf itself), check questions for subcategory & category info
      if (chain.length === 1 && questions.length > 0) {
        const sampleQ = questions.find(
          q => normalizeText(q.csvCategory) === normalizeText(leaf) || normalizeText(q.subcategory) === normalizeText(leaf)
        );
        if (sampleQ) {
          const qSub = sampleQ.subcategory ? sampleQ.subcategory.trim() : '';
          const qCat = sampleQ.category ? sampleQ.category.trim() : (rootCat || '');
          if (qSub && normalizeText(qSub) !== normalizeText(leaf)) {
            const subChain = getSubcategoryAncestryChain(qSub, subcategories, qCat || rootCat);
            chain = [...subChain, leaf.trim()];
          } else if (qCat) {
            chain = [qCat, leaf.trim()];
          }
        }
      }

      // If root category is still missing and we have subcategories selected or rootCat
      if (chain.length === 1 && subList.length > 0) {
        const subChain = getSubcategoryAncestryChain(subList[0], subcategories, rootCat);
        chain = [...subChain, leaf.trim()];
      } else if (chain.length === 1 && rootCat) {
        chain = [rootCat, leaf.trim()];
      }

      // Ensure root category is present
      if (rootCat && !chain.some(c => normalizeText(c) === normalizeText(rootCat))) {
        chain.unshift(rootCat);
      }

      // Deduplicate consecutive identical segments
      const dedupedChain = chain.filter((item, idx) => idx === 0 || normalizeText(item) !== normalizeText(chain[idx - 1]));
      paths.push(dedupedChain.join(' > '));
    });
  }

  // 2. Process Subcategories that are not already covered in leaf chains
  if (subList.length > 0) {
    subList.forEach(sub => {
      // Check if this sub is already an ancestor of a leaf path
      const subNorm = normalizeText(sub);
      const alreadyInPath = paths.some(p => normalizeText(p).includes(subNorm));
      if (!alreadyInPath) {
        const chain = getSubcategoryAncestryChain(sub, subcategories, rootCat);
        if (rootCat && !chain.some(c => normalizeText(c) === normalizeText(rootCat))) {
          chain.unshift(rootCat);
        }
        const dedupedChain = chain.filter((item, idx) => idx === 0 || normalizeText(item) !== normalizeText(chain[idx - 1]));
        paths.push(dedupedChain.join(' > '));
      }
    });
  }

  // 3. Process Root Categories if no sub or leaf paths were created
  if (paths.length === 0 && catList.length > 0) {
    catList.forEach(cat => {
      paths.push(cat.trim());
    });
  }

  // 4. Fallback: Parse from routine details or title if they contain '>' or '➔'
  if (paths.length === 0) {
    const combinedText = `${routine.title || ''} ${routine.details || ''}`;
    const arrowMatch = combinedText.match(/([^\n\r,;()]+[>➔][^\n\r,;()]+)/g);
    if (arrowMatch && arrowMatch.length > 0) {
      arrowMatch.forEach(m => {
        const cleaned = m.trim().replace(/\s*[>➔]\s*/g, ' > ');
        if (cleaned.length > 3 && !paths.includes(cleaned)) {
          paths.push(cleaned);
        }
      });
    }
  }

  return Array.from(new Set(paths));
};

/**
 * Returns all descendant subcategory names for a given subcategory (recursively)
 */
export const getSubcategoryDescendantsMap = (
  subcategories: SubcategoryItem[]
): Map<string, Set<string>> => {
  const map = new Map<string, Set<string>>();
  subcategories.forEach(sub => {
    const descendants: string[] = [];
    const queue = [normalizeText(sub.name)];
    const visited = new Set<string>(queue);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const children = subcategories.filter(
        s => s.parentCategory && normalizeText(s.parentCategory) === current
      );
      children.forEach(child => {
        const childNorm = normalizeText(child.name);
        if (!visited.has(childNorm)) {
          visited.add(childNorm);
          descendants.push(childNorm);
          queue.push(childNorm);
        }
      });
    }
    map.set(normalizeText(sub.name), new Set(descendants));
  });
  return map;
};

/**
 * Strictly filters questions that belong to the routine's selected syllabus topics.
 * Guarantees that only MCQs matching the selected topics/subcategories are returned.
 */
export const getRoutineMatchingQuestions = (
  routine: Routine,
  questions: Question[],
  subcategories: SubcategoryItem[] = []
): Question[] => {
  if (!questions || questions.length === 0) return [];

  // 1. Explicit Question IDs if configured manually
  const explicitIds = routine.examConfig?.questionIds;
  if (explicitIds && explicitIds.length > 0) {
    const idSet = new Set(explicitIds);
    const explicitQs = questions.filter(q => idSet.has(q.id));
    if (explicitQs.length > 0) {
      return explicitQs.sort((a, b) => explicitIds.indexOf(a.id) - explicitIds.indexOf(b.id));
    }
  }

  // 2. Normalize filter lists
  const catList = (routine.selectedCategories || []).map(normalizeText).filter(Boolean);
  const subList = (routine.selectedSubcategories || []).map(normalizeText).filter(Boolean);
  const leafList = (routine.selectedLeafCategories || []).map(normalizeText).filter(Boolean);

  // If no explicit syllabus filters are set in arrays, try to parse from routine title / details
  if (catList.length === 0 && subList.length === 0 && leafList.length === 0) {
    const textToScan = `${routine.title || ''} ${routine.details || ''}`.toLowerCase();
    
    // Check if any subcategory or leaf matches text in title/details
    subcategories.forEach(sub => {
      const subNorm = normalizeText(sub.name);
      if (subNorm.length >= 3 && textToScan.includes(subNorm)) {
        subList.push(subNorm);
      }
    });

    // Check for arrow separators e.g. "বিষয় ভিক্তিক প্রস্তুতি>বাংলা সাহিত্য>কাজী নজরুল ইসলাম"
    const arrowSegments = textToScan.split(/[>➔]/).map(s => s.trim().toLowerCase()).filter(s => s.length > 1);
    if (arrowSegments.length > 1) {
      arrowSegments.forEach(seg => {
        if (!subList.includes(seg) && !leafList.includes(seg)) {
          leafList.push(seg);
        }
      });
    }
  }

  const hasCatFilter = catList.length > 0;
  const hasSubFilter = subList.length > 0;
  const hasLeafFilter = leafList.length > 0;

  // If absolutely no filters exist, return all questions
  if (!hasCatFilter && !hasSubFilter && !hasLeafFilter) {
    return questions;
  }

  // 3. Build active subcategory set including all descendants
  const descendantsMap = getSubcategoryDescendantsMap(subcategories);
  const activeSubSet = new Set<string>();
  if (hasSubFilter) {
    subList.forEach(s => {
      activeSubSet.add(s);
      const desc = descendantsMap.get(s);
      if (desc) {
        desc.forEach(d => activeSubSet.add(d));
      }
    });
  }

  const activeLeafSet = new Set<string>(leafList);
  leafList.forEach(l => {
    const desc = descendantsMap.get(l);
    if (desc) {
      desc.forEach(d => activeLeafSet.add(d));
    }
  });

  // 4. Strict filter execution
  return questions.filter(q => {
    const qCat = normalizeText(q.category);
    const qCats = (q.categories || []).map(normalizeText);
    const qSub = normalizeText(q.subcategory);
    const qSubs = (q.subcategories || []).map(normalizeText);
    const qCsv = normalizeText(q.csvCategory);
    const qText = normalizeText(q.text);

    // Leaf Topic Match
    if (hasLeafFilter) {
      const matchLeaf = 
        activeLeafSet.has(qCsv) ||
        activeLeafSet.has(qSub) ||
        qSubs.some(s => activeLeafSet.has(s)) ||
        leafList.some(leaf => (
          (qCsv && (qCsv.includes(leaf) || leaf.includes(qCsv))) ||
          (qSub && (qSub.includes(leaf) || leaf.includes(qSub))) ||
          (leaf.length >= 3 && qText.includes(leaf))
        ));
      if (!matchLeaf) return false;
    }

    // Subcategory Match
    if (hasSubFilter) {
      const matchSub = 
        activeSubSet.has(qSub) ||
        activeSubSet.has(qCsv) ||
        qSubs.some(s => activeSubSet.has(s)) ||
        subList.some(sub => (
          (qSub && (qSub.includes(sub) || sub.includes(qSub))) ||
          (qCsv && (qCsv.includes(sub) || sub.includes(qCsv)))
        ));
      if (!matchSub) return false;
    }

    // Root Category Match
    if (hasCatFilter) {
      const matchCat = 
        catList.some(c => qCat.includes(c) || c.includes(qCat)) ||
        qCats.some(c => catList.some(cat => c.includes(cat) || cat.includes(c)));
      if (!matchCat) return false;
    }

    return true;
  });
};
