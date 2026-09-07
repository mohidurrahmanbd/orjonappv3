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
 * If multiple subtopics share the same category & subcategory parent chain,
 * they are grouped together with the category & subcategory as heading:
 * e.g. "বিষয়ভিত্তিক প্রস্তুতি > ইংরেজি গ্রামার > tense, number, spelling"
 */
export const formatRoutineSyllabusPaths = (
  routine: Routine,
  subcategories: SubcategoryItem[] = [],
  categories: CategoryItem[] = [],
  questions: Question[] = []
): string[] => {
  const rootCat = (routine.selectedCategories && routine.selectedCategories.length > 0)
    ? routine.selectedCategories[0]
    : undefined;

  const leafList = routine.selectedLeafCategories || [];
  const subList = routine.selectedSubcategories || [];
  const catList = routine.selectedCategories || [];

  // Group leaf categories by their ancestor prefix chain
  const leafGroups = new Map<string, string[]>();

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
      
      if (dedupedChain.length > 1) {
        const prefix = dedupedChain.slice(0, -1).join(' > ');
        const leafItem = dedupedChain[dedupedChain.length - 1];
        if (!leafGroups.has(prefix)) {
          leafGroups.set(prefix, []);
        }
        const group = leafGroups.get(prefix)!;
        if (!group.includes(leafItem)) {
          group.push(leafItem);
        }
      } else if (dedupedChain.length === 1) {
        const single = dedupedChain[0];
        if (!leafGroups.has('')) {
          leafGroups.set('', []);
        }
        const group = leafGroups.get('')!;
        if (!group.includes(single)) {
          group.push(single);
        }
      }
    });
  }

  const paths: string[] = [];

  // Convert grouped leaf categories to paths
  leafGroups.forEach((topics, prefix) => {
    if (prefix) {
      paths.push(`${prefix} > ${topics.join(', ')}`);
    } else {
      paths.push(topics.join(', '));
    }
  });

  // 2. Process Subcategories that are not already covered in leaf chains
  if (subList.length > 0) {
    const subGroups = new Map<string, string[]>();

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
        if (dedupedChain.length > 1) {
          const prefix = dedupedChain.slice(0, -1).join(' > ');
          const subItem = dedupedChain[dedupedChain.length - 1];
          if (!subGroups.has(prefix)) {
            subGroups.set(prefix, []);
          }
          const group = subGroups.get(prefix)!;
          if (!group.includes(subItem)) {
            group.push(subItem);
          }
        } else if (dedupedChain.length === 1) {
          const single = dedupedChain[0];
          if (!subGroups.has('')) {
            subGroups.set('', []);
          }
          const group = subGroups.get('')!;
          if (!group.includes(single)) {
            group.push(single);
          }
        }
      }
    });

    subGroups.forEach((subs, prefix) => {
      if (prefix) {
        paths.push(`${prefix} > ${subs.join(', ')}`);
      } else {
        paths.push(subs.join(', '));
      }
    });
  }

  // 3. Process Root Categories if no sub or leaf paths were created
  if (paths.length === 0 && catList.length > 0) {
    paths.push(catList.join(', '));
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
        activeSubSet.has(qCat) ||
        qCats.some(c => activeSubSet.has(c)) ||
        qSubs.some(s => activeSubSet.has(s)) ||
        subList.some(sub => (
          (qSub && (qSub.includes(sub) || sub.includes(qSub))) ||
          (qCsv && (qCsv.includes(sub) || sub.includes(qCsv))) ||
          (qCat && (qCat.includes(sub) || sub.includes(qCat)))
        ));
      if (!matchSub) return false;
    }

    // Root Category Match
    if (hasCatFilter) {
      const isSubjectRoot = catList.some(c => c.includes('বিষয়ভিত্তিক') || c.includes('বিষয় ভিক্তিক') || c.includes('বিষয় ভিত্তিক'));
      const isJobRoot = catList.some(c => c.includes('জব সলিউশন') || c.includes('জব সলউশন') || c.includes('জব'));
      const isYearRoot = catList.some(c => c.includes('সাল ভিত্তিক') || c.includes('সাল ভিক্তিক'));

      const isQSubject = ['বাংলা ব্যাকরণ', 'বাংলা সাহিত্য', 'ইংরেজি গ্রামার', 'ইংরেজি সাহিত্য', 'গণিত', 'বাংলাদেশ বিষয়াবলী', 'আন্তর্জাতিক বিষয়াবলী', 'সাধারণ বিজ্ঞান', 'তথ্য ও যোগাযোগ প্রযুক্তি'].some(s => normalizeText(s) === qCat || normalizeText(s) === qSub);
      const isQJob = ['বিসিএস', 'বিসিএস প্রিলিমিনারি', 'প্রাথমিক', 'এনটিআরসিএ', 'ব্যাংক', 'পিএসসি', 'নন-ক্যাডার', 'মন্ত্রণালয়', 'রেলওয়ে'].some(j => qCat.includes(j) || qSub.includes(j));
      const isQYear = /^[০-৯0-9]{4}/.test(qCat) || /^[০-৯0-9]{4}/.test(qSub);

      const matchCat = 
        (isSubjectRoot && isQSubject) ||
        (isJobRoot && isQJob) ||
        (isYearRoot && isQYear) ||
        catList.some(c => qCat.includes(c) || c.includes(qCat)) ||
        qCats.some(c => catList.some(cat => c.includes(cat) || cat.includes(c)));
      if (!matchCat) return false;
    }

    return true;
  });
};

/**
 * Converts English digits to Bengali digits
 */
export const toBengaliDigits = (num: number | string): string => {
  const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(num).replace(/[0-9]/g, w => bnDigits[+w]);
};

export interface SubjectWiseMarkItem {
  subject: string;
  totalQuestions: number;
  right: number;
  wrong: number;
  skipped: number;
  totalMarks: number;
}

/**
 * Resolves the primary subject name for a question with specific handling
 * for Bangla, Bangla Literature, English, English Literature, Math, GK, Science, ICT, etc.
 */
export const resolveQuestionSubject = (q: Question): string => {
  const cat = (q.category || '').trim();
  const sub = (q.subcategory || '').trim();
  const csv = (q.csvCategory || '').trim();
  const subs = (q.subcategories || []).map(s => s.trim()).filter(Boolean);
  const cats = (q.categories || []).map(c => c.trim()).filter(Boolean);

  const allTags = [sub, cat, ...subs, ...cats, csv].filter(Boolean);

  const isGenericRoot = (name: string) => {
    const n = normalizeText(name);
    return [
      'বিষয়ভিত্তিক প্রস্তুতি', 'বিষয় ভিক্তিক প্রস্তুতি', 'বিষয় ভিত্তিক প্রস্তুতি',
      'জব সলিউশন পরীক্ষা', 'জব সলিউশন', 'সাল ভিত্তিক জব সলিউশন', 'সাল ভিত্তিক',
      'কাস্টম csv', 'মূল বিষয়াবলি', 'সাধারণ অধ্যায়/টপিক', 'সাধারণ জ্ঞান ও অন্যান্য',
      'সকল mcq', 'অন্যান্য'
    ].some(r => n === r || n.startsWith(r));
  };

  // Check specific subjects in priority order
  // 1. Bangla Literature & Grammar
  for (const tag of allTags) {
    const n = normalizeText(tag);
    if (n.includes('বাংলা সাহিত্য')) return 'বাংলা সাহিত্য';
  }
  for (const tag of allTags) {
    const n = normalizeText(tag);
    if (n.includes('বাংলা ব্যাকরণ') || n.includes('বাংলা ভাষা ও ব্যাকরণ') || n.includes('বাংলা ব্যাকরন') || n.includes('বাংলা ব্যকরণ')) return 'বাংলা ব্যাকরণ';
  }
  for (const tag of allTags) {
    const n = normalizeText(tag);
    if (n === 'বাংলা' || n === 'বাংলা ভাষা ও সাহিত্য' || n === 'বাংলা ভাষা') return 'বাংলা';
  }

  // 2. English Literature & Grammar
  for (const tag of allTags) {
    const n = normalizeText(tag);
    if (n.includes('ইংরেজি সাহিত্য') || n.includes('english literature')) return 'ইংরেজি সাহিত্য';
  }
  for (const tag of allTags) {
    const n = normalizeText(tag);
    if (n.includes('ইংরেজি গ্রামার') || n.includes('ইংরেজি ব্যাকরণ') || n.includes('english grammar') || n.includes('ইংরেজি গ্রামার ও ভাষা')) return 'ইংরেজি গ্রামার';
  }
  for (const tag of allTags) {
    const n = normalizeText(tag);
    if (n === 'ইংরেজি' || n === 'english' || n === 'ইংরেজি ভাষা ও সাহিত্য' || n === 'ইংরেজি ভাষা') return 'ইংরেজি';
  }

  // 3. Bangladesh Affairs
  for (const tag of allTags) {
    const n = normalizeText(tag);
    if (n.includes('বাংলাদেশ বিষয়াবলী') || n.includes('বাংলাদেশ বিষয়াবলি') || n.includes('বাংলাদেশ বিষয়াবলি') || n.includes('বাংলাদেশ বিষয়াবলী') || n === 'বাংলাদেশ') return 'বাংলাদেশ বিষয়াবলী';
  }

  // 4. International Affairs
  for (const tag of allTags) {
    const n = normalizeText(tag);
    if (n.includes('আন্তর্জাতিক বিষয়াবলী') || n.includes('আন্তর্জাতিক বিষয়াবলি') || n.includes('আন্তর্জাতিক বিষয়াবলি') || n.includes('আন্তর্জাতিক বিষয়াবলী') || n === 'আন্তর্জাতিক') return 'আন্তর্জাতিক বিষয়াবলী';
  }

  // 5. Mathematics & Mental Ability
  for (const tag of allTags) {
    const n = normalizeText(tag);
    if (n.includes('মানসিক দক্ষতা')) return 'মানসিক দক্ষতা';
  }
  for (const tag of allTags) {
    const n = normalizeText(tag);
    if (n.includes('গাণিতিক যুক্তি') || n.includes('পাটিগণিত') || n.includes('বীজগণিত') || n.includes('জ্যামিতি') || n.includes('ত্রিকোণমিতি') || n === 'গণিত' || n === 'math' || n.includes('গণিত')) return 'গণিত';
  }

  // 6. General Science
  for (const tag of allTags) {
    const n = normalizeText(tag);
    if (n.includes('সাধারণ বিজ্ঞান') || n === 'বিজ্ঞান' || n === 'science') return 'সাধারণ বিজ্ঞান';
  }

  // 7. ICT & Computer
  for (const tag of allTags) {
    const n = normalizeText(tag);
    if (n.includes('তথ্য ও যোগাযোগ প্রযুক্তি') || n.includes('কম্পিউটার ও তথ্যপ্রযুক্তি') || n.includes('কম্পিউটার') || n.includes('আইসিটি') || n === 'ict') return 'তথ্য ও যোগাযোগ প্রযুক্তি';
  }

  // 8. Geography & Environment
  for (const tag of allTags) {
    const n = normalizeText(tag);
    if (n.includes('ভূগোল') || n.includes('পরিবেশ') || n.includes('দুর্যোগ ব্যবস্থাপনা')) return 'ভূগোল, পরিবেশ ও দুর্যোগ ব্যবস্থাপনা';
  }

  // 9. Ethics & Good Governance
  for (const tag of allTags) {
    const n = normalizeText(tag);
    if (n.includes('নৈতিকতা') || n.includes('মূল্যবোধ') || n.includes('সুশাসন')) return 'নৈতিকতা, মূল্যবোধ ও সুশাসন';
  }

  // 10. General Knowledge
  for (const tag of allTags) {
    const n = normalizeText(tag);
    if (n.includes('সাধারণ জ্ঞান') || n === 'gk') return 'সাধারণ জ্ঞান';
  }

  // 11. Fallback to first non-generic tag
  for (const tag of [sub, cat, ...subs, ...cats, csv]) {
    if (tag && !isGenericRoot(tag)) {
      return tag;
    }
  }

  return 'সাধারণ বিষয়াবলী';
};

/**
 * Calculates subject-wise breakdown for exam questions and user attempt
 */
export const calculateSubjectWiseAnalysis = (
  questions: Question[],
  attempt: {
    userSelectedAnswers?: Record<number, string>;
    answers?: Record<string, string>;
  }
): SubjectWiseMarkItem[] => {
  const subjectMap = new Map<string, { total: number; right: number; wrong: number; skipped: number }>();

  questions.forEach((q, i) => {
    const subj = resolveQuestionSubject(q);
    if (!subjectMap.has(subj)) {
      subjectMap.set(subj, { total: 0, right: 0, wrong: 0, skipped: 0 });
    }
    const stat = subjectMap.get(subj)!;
    stat.total += 1;

    const selectedAnsKey = 
      attempt.userSelectedAnswers?.[i] || 
      attempt.userSelectedAnswers?.[q.id as any] || 
      (attempt as any).answers?.[q.id] || 
      (attempt as any).answers?.[i];

    const isCorrect = Boolean(selectedAnsKey && q?.correct && selectedAnsKey === q.correct);

    if (isCorrect) {
      stat.right += 1;
    } else if (selectedAnsKey && selectedAnsKey !== 'Skipped') {
      stat.wrong += 1;
    } else {
      stat.skipped += 1;
    }
  });

  return Array.from(subjectMap.entries()).map(([subject, data]) => {
    const rawMarks = (data.right * 1.0) - (data.wrong * 0.5);
    const totalMarks = Math.round(rawMarks * 100) / 100;
    return {
      subject,
      totalQuestions: data.total,
      right: data.right,
      wrong: data.wrong,
      skipped: data.skipped,
      totalMarks
    };
  });
};

/**
 * Helper to detect variations/typos of "জব সলিউশন পরীক্ষা"
 */
export const isJobSolutionVariation = (name: string): boolean => {
  if (!name) return false;
  const normalized = name.trim().toLowerCase();
  return (
    normalized === 'জব সলিউশন পরীক্ষা' ||
    normalized === 'জব সলউশন পরিক্ষা' ||
    normalized === 'জব সলউশন পরীক্ষা' ||
    normalized === 'জব সলিউশন ব্যাংক' ||
    normalized === 'জব সリューション ব্যাংক' ||
    normalized === 'job solution' ||
    normalized === 'job solutions' ||
    normalized === 'জব সলিউশন' ||
    normalized === 'জব সলউশন' ||
    normalized === 'জব সリューション'
  );
};

/**
 * Helper to detect variations/typos of "সাল ভিত্তিক জব সলিউশন"
 */
export const isYearJobSolutionVariation = (name: string): boolean => {
  if (!name) return false;
  const normalized = name.trim().toLowerCase();
  return (
    normalized === 'সাল ভিত্তিক জব সলিউশন' ||
    normalized === 'সাল ভিক্তিক জব সলউশন' ||
    normalized === 'সাল ভিত্তিক জব সল্যুশন' ||
    normalized === 'সাল ভিত্তিক জব সলিউশন ব্যাংক' ||
    normalized === 'সাল ভিত্তিক জব সলিউশন পরীক্ষা' ||
    normalized === 'year-based job solution' ||
    normalized === 'year job solution' ||
    normalized === 'সাল ভিত্তিক' ||
    normalized === 'সাল ভিক্তিক'
  );
};

/**
 * Helper to detect variations/typos of "সাম্প্রতিক বিষয়াবলী"
 */
export const isCurrentAffairVariation = (name: string): boolean => {
  if (!name) return false;
  const normalized = name.trim().toLowerCase();
  return (
    normalized === 'সাম্প্রতিক বিষয়াবলী' ||
    normalized === 'সাম্প্রতিক বিষয়াবলী' ||
    normalized === 'সাম্প্রতিক বিষয়' ||
    normalized === 'সাম্প্রতিক বিষয়' ||
    normalized === 'current affairs' ||
    normalized === 'current affair' ||
    normalized === 'সাম্প্রতিক'
  );
};
