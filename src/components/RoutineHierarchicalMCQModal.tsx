import React, { useState, useMemo, useEffect } from 'react';
import { Question, Routine, CategoryItem, SubcategoryItem, Bookmark } from '../types';
import { 
  ChevronDown, ChevronRight, Search, 
  Eye, EyeOff, Bookmark as BookmarkIcon, 
  Check, HelpCircle, Sparkles, ArrowLeft, ArrowRight,
  BookMarked, CheckCircle, RotateCcw
} from 'lucide-react';
import { formatRoutineSyllabusPaths, getRoutineMatchingQuestions } from '../lib/routineUtils';
import CircularProgressBar from './CircularProgressBar';
import { 
  getStoredReadQuestionIds, 
  saveStoredReadQuestionIds, 
  markRoutineQuestionsAsRead, 
  toggleRoutineQuestionReadStatus 
} from '../lib/readingProgress';

interface RoutineHierarchicalMCQModalProps {
  routine: Routine;
  questions: Question[];
  categories?: CategoryItem[];
  subcategories?: SubcategoryItem[];
  bookmarks?: Bookmark[];
  userPhone?: string;
  onClose: () => void;
  onStartPractice?: (routine: Routine) => void;
  onToggleBookmark?: (qId: string) => void;
}

interface HierarchicalLeafNode {
  name: string;
  questions: Question[];
}

interface HierarchicalSubNode {
  name: string;
  leafNodes: HierarchicalLeafNode[];
  directQuestions: Question[];
  totalCount: number;
}

interface HierarchicalCatNode {
  name: string;
  subNodes: HierarchicalSubNode[];
  directQuestions: Question[];
  totalCount: number;
}

interface SelectedLeafTopic {
  catName: string;
  subName: string;
  leafName: string;
  questions: Question[];
}

const PAGE_SIZE = 20;

const toBengaliDigits = (num: number | string): string => {
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(num).replace(/[0-9]/g, (d) => bengaliDigits[parseInt(d, 10)]);
};

const normalizeTopicName = (name: string): string => {
  if (!name) return '';
  return name
    .trim()
    .toLowerCase()
    .replace(/^(পরিচ্ছেদ|অধ্যায়|টপিক|বিষয়|অধ্যায়|চ্যাপ্টার)\s*[:ঃ-]?\s*/iu, '')
    .replace(/[\s\-_:]+/g, ' ')
    .trim();
};

const isSameFolderAndSubfolder = (folderName: string, subfolderName: string): boolean => {
  const normFolder = normalizeTopicName(folderName);
  const normSub = normalizeTopicName(subfolderName);
  
  if (!normFolder || !normSub) return true;
  if (normFolder === normSub) return true;
  if (normSub === 'সকল mcq' || normSub === 'অন্যান্য প্রশ্নসমূহ' || normSub === 'mcq' || normSub === 'সকল প্রশ্ন') return true;
  if (normFolder.includes(normSub) || normSub.includes(normFolder)) return true;
  return false;
};

export default function RoutineHierarchicalMCQModal({
  routine,
  questions,
  categories = [],
  subcategories = [],
  bookmarks = [],
  userPhone,
  onClose,
  onStartPractice,
  onToggleBookmark
}: RoutineHierarchicalMCQModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllAnswers, setShowAllAnswers] = useState(true);
  const [revealedAnswers, setRevealedAnswers] = useState<Record<string, boolean>>({});
  const [selectedUserOptions, setSelectedUserOptions] = useState<Record<string, number>>({});
  
  // Reading Progress State (Persistent in localStorage)
  const routineId = routine.id || routine.title || 'routine';
  const [readQuestionIds, setReadQuestionIds] = useState<string[]>(() => {
    return getStoredReadQuestionIds(userPhone, routineId);
  });

  // Dedicated Clean Page for Selected Leaf Topic
  const [selectedLeafTopic, setSelectedLeafTopic] = useState<SelectedLeafTopic | null>(null);
  const [leafSearchQuery, setLeafSearchQuery] = useState('');

  // ALL categories and topics are COLLAPSED by default (empty state = everything collapsed)
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  // Per-topic and global search pagination (max 20 MCQs per page)
  const [topicPages, setTopicPages] = useState<Record<string, number>>({});
  const [searchPage, setSearchPage] = useState(1);

  // Handlers for Leaf Topic Clean Page Navigation
  const openLeafTopic = (catName: string, subName: string, leafName: string, leafQuestions: Question[]) => {
    setSelectedLeafTopic({
      catName,
      subName,
      leafName,
      questions: leafQuestions
    });
    setLeafSearchQuery('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToHierarchy = () => {
    setSelectedLeafTopic(null);
    setLeafSearchQuery('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Filter questions for the selected leaf topic page
  const leafFilteredQuestions = useMemo(() => {
    if (!selectedLeafTopic) return [];
    if (!leafSearchQuery.trim()) return selectedLeafTopic.questions;
    const qLower = leafSearchQuery.trim().toLowerCase();
    return selectedLeafTopic.questions.filter(q => 
      (q.text || '').toLowerCase().includes(qLower) ||
      (q.optionA || '').toLowerCase().includes(qLower) ||
      (q.optionB || '').toLowerCase().includes(qLower) ||
      (q.optionC || '').toLowerCase().includes(qLower) ||
      (q.optionD || '').toLowerCase().includes(qLower) ||
      (q.explanation || '').toLowerCase().includes(qLower)
    );
  }, [selectedLeafTopic, leafSearchQuery]);

  // Subcategory descendant map for deep hierarchy resolution
  const subcategoryDescendantsMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    subcategories.forEach(sub => {
      const descendants: string[] = [];
      const queue = [sub.name.trim().toLowerCase()];
      const visited = new Set<string>(queue);

      while (queue.length > 0) {
        const current = queue.shift()!;
        const children = subcategories.filter(s => s.parentCategory && s.parentCategory.trim().toLowerCase() === current);
        children.forEach(child => {
          const childLower = child.name.trim().toLowerCase();
          if (!visited.has(childLower)) {
            visited.add(childLower);
            descendants.push(child.name.trim().toLowerCase());
            queue.push(childLower);
          }
        });
      }
      map.set(sub.name.trim().toLowerCase(), new Set(descendants));
    });
    return map;
  }, [subcategories]);

  // 1. Filter questions strictly or cascaded by the routine's selected syllabus
  const matchedRoutineQuestions = useMemo(() => {
    return getRoutineMatchingQuestions(routine, questions, subcategories);
  }, [questions, routine, subcategories]);

  // Overall Reading Progress Metrics
  const totalMatchedCount = matchedRoutineQuestions.length;
  const readCount = useMemo(() => {
    const set = new Set(readQuestionIds);
    return matchedRoutineQuestions.filter(q => set.has(q.id)).length;
  }, [matchedRoutineQuestions, readQuestionIds]);

  const readingPercentage = totalMatchedCount > 0 
    ? Math.min(100, Math.round((readCount / totalMatchedCount) * 100))
    : (readQuestionIds.length > 0 ? 100 : 0);

  // Progress Action Handlers
  const handleToggleQuestionRead = (qId: string) => {
    const res = toggleRoutineQuestionReadStatus(userPhone, routineId, qId, totalMatchedCount);
    setReadQuestionIds(res.readQuestionIds);
  };

  const handleMarkAllQuestionsAsRead = () => {
    const allIds = matchedRoutineQuestions.map(q => q.id);
    const res = markRoutineQuestionsAsRead(userPhone, routineId, allIds, totalMatchedCount);
    setReadQuestionIds(res.readQuestionIds);
  };

  const handleResetReadingProgress = () => {
    saveStoredReadQuestionIds(userPhone, routineId, [], 0);
    setReadQuestionIds([]);
  };

  // Automatically mark visible questions as read when student views/interacts with them
  const markQuestionsAsReadAuto = (targetQuestions: Question[]) => {
    if (!targetQuestions || targetQuestions.length === 0) return;
    const newUnreadIds = targetQuestions.map(q => q.id).filter(id => !readQuestionIds.includes(id));
    if (newUnreadIds.length > 0) {
      const res = markRoutineQuestionsAsRead(userPhone, routineId, newUnreadIds, totalMatchedCount);
      setReadQuestionIds(res.readQuestionIds);
    }
  };

  // 2. Apply search filter if active
  const filteredQuestions = useMemo(() => {
    if (!searchQuery.trim()) {
      return matchedRoutineQuestions;
    }
    const qLower = searchQuery.trim().toLowerCase();
    return matchedRoutineQuestions.filter(q => {
      return (
        (q.text || '').toLowerCase().includes(qLower) ||
        (q.optionA || '').toLowerCase().includes(qLower) ||
        (q.optionB || '').toLowerCase().includes(qLower) ||
        (q.optionC || '').toLowerCase().includes(qLower) ||
        (q.optionD || '').toLowerCase().includes(qLower) ||
        (q.explanation || '').toLowerCase().includes(qLower) ||
        (q.category || '').toLowerCase().includes(qLower) ||
        (q.subcategory || '').toLowerCase().includes(qLower) ||
        (q.csvCategory || '').toLowerCase().includes(qLower)
      );
    });
  }, [matchedRoutineQuestions, searchQuery]);

  // 3. Build Tree Structure matching the exact Syllabus created by Admin
  const hierarchicalTree: HierarchicalCatNode[] = useMemo(() => {
    if (filteredQuestions.length === 0) {
      return [];
    }

    // A. Extract explicit syllabus configuration from routine
    const routineCatList = (routine.selectedCategories || []).map(s => s.trim()).filter(Boolean);
    const routineSubList = (routine.selectedSubcategories || []).map(s => s.trim()).filter(Boolean);
    const routineLeafList = (routine.selectedLeafCategories || []).map(s => s.trim()).filter(Boolean);

    // B. Parse fallback syllabus paths from title / details / formatting
    const paths = formatRoutineSyllabusPaths(routine, subcategories, categories, questions);
    let parsedRoot = '';
    let parsedSubs: string[] = [];
    let parsedLeaves: string[] = [];

    if (paths.length > 0) {
      const firstPath = paths[0];
      const segments = firstPath.split(/\s*>\s*/);
      if (segments.length >= 1) parsedRoot = segments[0].trim();
      if (segments.length >= 2) parsedSubs = segments[1].split(/[,،]+/).map(s => s.trim()).filter(Boolean);
      if (segments.length >= 3) parsedLeaves = segments[2].split(/[,،]+/).map(s => s.trim()).filter(Boolean);
    }

    // Determine target Root, Subcategories and Leaf Categories
    const rootName = routineCatList.length > 0 
      ? routineCatList[0] 
      : (parsedRoot || 'বিষয়ভিত্তিক প্রস্তুতি');

    let targetSubList: string[] = [];
    if (routineSubList.length > 0) {
      targetSubList = routineSubList;
    } else if (routineCatList.length > 1) {
      targetSubList = routineCatList.slice(1);
    } else if (parsedSubs.length > 0) {
      targetSubList = parsedSubs;
    }

    let targetLeafList: string[] = [];
    if (routineLeafList.length > 0) {
      targetLeafList = routineLeafList;
    } else if (parsedLeaves.length > 0) {
      targetLeafList = parsedLeaves;
    }

    // Map: RootName -> SubName -> LeafName -> Question[]
    const rootNodeMap = new Map<string, {
      name: string;
      subMap: Map<string, {
        name: string;
        leafMap: Map<string, { name: string; questions: Question[] }>;
        directQuestions: Question[];
        totalCount: number;
      }>;
      directQuestions: Question[];
      totalCount: number;
    }>();

    const getOrCreateRoot = (rName: string) => {
      let rNode = rootNodeMap.get(rName);
      if (!rNode) {
        rNode = {
          name: rName,
          subMap: new Map(),
          directQuestions: [],
          totalCount: 0
        };
        rootNodeMap.set(rName, rNode);
      }
      return rNode;
    };

    const getOrCreateSub = (rNode: { name: string; subMap: Map<string, any>; directQuestions: Question[]; totalCount: number }, sName: string) => {
      let sNode = rNode.subMap.get(sName);
      if (!sNode) {
        sNode = {
          name: sName,
          leafMap: new Map<string, { name: string; questions: Question[] }>(),
          directQuestions: [],
          totalCount: 0
        };
        rNode.subMap.set(sName, sNode);
      }
      return sNode;
    };

    const getOrCreateLeaf = (sNode: { name: string; leafMap: Map<string, { name: string; questions: Question[] }>; directQuestions: Question[]; totalCount: number }, lName: string) => {
      let lNode = sNode.leafMap.get(lName);
      if (!lNode) {
        lNode = {
          name: lName,
          questions: []
        };
        sNode.leafMap.set(lName, lNode);
      }
      return lNode;
    };

    // Pre-seed tree structure with the exact syllabus blueprint
    const primaryRoot = getOrCreateRoot(rootName);
    if (targetSubList.length > 0) {
      targetSubList.forEach(subItem => {
        const subNode = getOrCreateSub(primaryRoot, subItem);
        if (targetLeafList.length > 0) {
          targetLeafList.forEach(leafItem => {
            getOrCreateLeaf(subNode, leafItem);
          });
        }
      });
    }

    // Distribute each filtered question to the matching (Root -> Sub -> Leaf)
    filteredQuestions.forEach(q => {
      const qCat = (q.category || '').trim();
      const qSub = (q.subcategory || '').trim();
      const qCsv = (q.csvCategory || '').trim();
      const qText = (q.text || '').toLowerCase();
      const qSubs = (q.subcategories || []).map(s => s.trim().toLowerCase());

      // 1. Root Category Resolution
      let assignedRoot = rootName;
      if (routineCatList.length > 0) {
        const matchingCat = routineCatList.find(c => {
          const cNorm = c.toLowerCase();
          return qCat.toLowerCase().includes(cNorm) || cNorm.includes(qCat.toLowerCase());
        });
        if (matchingCat) {
          assignedRoot = matchingCat;
        }
      }

      const rNode = getOrCreateRoot(assignedRoot);
      rNode.totalCount += 1;

      // 2. Subcategory Resolution
      let assignedSub = '';
      if (targetSubList.length > 0) {
        const matchedTargetSub = targetSubList.find(sub => {
          const sNorm = sub.trim().toLowerCase();
          return (
            qSub.toLowerCase() === sNorm ||
            qCat.toLowerCase() === sNorm ||
            qSub.toLowerCase().includes(sNorm) ||
            sNorm.includes(qSub.toLowerCase()) ||
            qCat.toLowerCase().includes(sNorm) ||
            sNorm.includes(qCat.toLowerCase()) ||
            qSubs.some(s => s.includes(sNorm) || sNorm.includes(s))
          );
        });
        if (matchedTargetSub) {
          assignedSub = matchedTargetSub;
        } else {
          assignedSub = targetSubList[0];
        }
      } else {
        assignedSub = qSub || qCat || 'মূল বিষয়াবলি';
      }

      const sNode = getOrCreateSub(rNode, assignedSub);
      sNode.totalCount += 1;

      // 3. Leaf Topic Resolution
      let assignedLeaf = '';
      if (targetLeafList.length > 0) {
        const matchedTargetLeaf = targetLeafList.find(leaf => {
          const lNorm = leaf.trim().toLowerCase();
          return (
            qCsv.toLowerCase() === lNorm ||
            qSub.toLowerCase() === lNorm ||
            qCsv.toLowerCase().includes(lNorm) ||
            lNorm.includes(qCsv.toLowerCase()) ||
            qSub.toLowerCase().includes(lNorm) ||
            lNorm.includes(qSub.toLowerCase()) ||
            qSubs.some(s => s.includes(lNorm) || lNorm.includes(s)) ||
            (lNorm.length >= 3 && qText.includes(lNorm))
          );
        });

        if (matchedTargetLeaf) {
          assignedLeaf = matchedTargetLeaf;
        } else {
          assignedLeaf = 'অন্যান্য প্রশ্নসমূহ';
        }
      } else {
        if (qCsv && qCsv.toLowerCase() !== assignedSub.toLowerCase()) {
          assignedLeaf = qCsv;
        } else if (qSub && qSub.toLowerCase() !== assignedSub.toLowerCase()) {
          assignedLeaf = qSub;
        } else {
          assignedLeaf = 'সকল MCQ';
        }
      }

      const lNode = getOrCreateLeaf(sNode, assignedLeaf);
      lNode.questions.push(q);
    });

    // Convert to nested array structure
    return Array.from(rootNodeMap.values())
      .filter(r => r.totalCount > 0)
      .map(r => {
        const subNodes: HierarchicalSubNode[] = Array.from(r.subMap.values())
          .filter(s => s.totalCount > 0)
          .map(s => {
            const leafNodes: HierarchicalLeafNode[] = Array.from(s.leafMap.values())
              .filter(l => l.questions.length > 0)
              .map(l => ({
                name: l.name,
                questions: l.questions
              }));

            return {
              name: s.name,
              leafNodes,
              directQuestions: s.directQuestions,
              totalCount: s.totalCount
            };
          });

        return {
          name: r.name,
          subNodes,
          directQuestions: r.directQuestions,
          totalCount: r.totalCount
        };
      });
  }, [filteredQuestions, routine, subcategories, categories, questions]);

  // Auto-expand root category if there's only 1 category in the tree
  React.useEffect(() => {
    if (hierarchicalTree.length === 1) {
      const singleCatKey = `cat-${hierarchicalTree[0].name}`;
      setExpandedNodes(prev => {
        if (prev[singleCatKey]) return prev;
        return { ...prev, [singleCatKey]: true };
      });
    }
  }, [hierarchicalTree]);

  // Auto-collapse behavior: nodes start collapsed.
  // Expanding an element shows its content. When the user collapses/leaves that level, child expansions are cleaned up.
  const toggleCategoryNode = (catKey: string, catName: string) => {
    setExpandedNodes(prev => {
      const isCurrentlyExpanded = !!prev[catKey];
      if (isCurrentlyExpanded) {
        // Collapsing this category: remove this catKey and any child subcategory & leaf topic keys
        const next = { ...prev };
        delete next[catKey];
        Object.keys(next).forEach(k => {
          if (k.startsWith(`sub-${catName}-`) || k.startsWith(`leaf-${catName}-`)) {
            delete next[k];
          }
        });
        return next;
      } else {
        // Expand this category
        return {
          ...prev,
          [catKey]: true
        };
      }
    });
  };

  const toggleSubcategoryNode = (subKey: string, catName: string, subName: string) => {
    setExpandedNodes(prev => {
      const isCurrentlyExpanded = !!prev[subKey];
      if (isCurrentlyExpanded) {
        // Collapsing this subcategory: remove this subKey and its child leaf keys
        const next = { ...prev };
        delete next[subKey];
        Object.keys(next).forEach(k => {
          if (k.startsWith(`leaf-${catName}-${subName}-`)) {
            delete next[k];
          }
        });
        return next;
      } else {
        // Expand this subcategory
        return {
          ...prev,
          [subKey]: true
        };
      }
    });
  };

  const toggleLeafNode = (leafKey: string) => {
    setExpandedNodes(prev => ({
      ...prev,
      [leafKey]: !prev[leafKey]
    }));
  };

  const isBookmarked = (qId: string) => {
    return bookmarks.some(b => b.questionId === qId);
  };

  const getQuestionListReadingStats = (qList: Question[]) => {
    if (!qList || qList.length === 0) return { read: 0, total: 0, percentage: 0 };
    const read = qList.filter(q => readQuestionIds.includes(q.id)).length;
    const total = qList.length;
    const percentage = Math.min(100, Math.round((read / total) * 100));
    return { read, total, percentage };
  };

  const getOptionLetter = (idx: number) => {
    switch (idx) {
      case 0: return 'ক';
      case 1: return 'খ';
      case 2: return 'গ';
      case 3: return 'ঘ';
      default: return '';
    }
  };

  const getCorrectIndex = (correctKey: string): number => {
    if (correctKey === 'Option A' || correctKey === 'optionA' || correctKey === 'ক') return 0;
    if (correctKey === 'Option B' || correctKey === 'optionB' || correctKey === 'খ') return 1;
    if (correctKey === 'Option C' || correctKey === 'optionC' || correctKey === 'গ') return 2;
    if (correctKey === 'Option D' || correctKey === 'optionD' || correctKey === 'ঘ') return 3;
    return -1;
  };

  // Render a paginated list of MCQs (maximum 20 MCQs per page)
  const renderQuestionList = (
    questionList: Question[], 
    pageKey: string,
    startIndexOffset: number = 0
  ) => {
    const totalQ = questionList.length;
    const currentPage = topicPages[pageKey] || 1;
    const totalPages = Math.ceil(totalQ / PAGE_SIZE) || 1;
    
    // Slice 20 questions for this page
    const startIdx = (currentPage - 1) * PAGE_SIZE;
    const endIdx = Math.min(startIdx + PAGE_SIZE, totalQ);
    const visibleQuestions = questionList.slice(startIdx, endIdx);

    const handlePageChange = (newPage: number) => {
      setTopicPages(prev => ({
        ...prev,
        [pageKey]: newPage
      }));
    };

    return (
      <div className="space-y-3">
        {/* Pagination Top Bar (if more than 20 MCQs) */}
        {totalQ > PAGE_SIZE && (
          <div className="bg-slate-100 border border-slate-200/90 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-slate-700">
              <span className="bg-indigo-600 text-white text-[10px] font-black px-2 py-0.5 rounded-md">
                পৃষ্ঠা {toBengaliDigits(currentPage)} / {toBengaliDigits(totalPages)}
              </span>
              <span className="text-[11px] text-slate-600">
                (দেখাচ্ছে {toBengaliDigits(startIdx + 1)} - {toBengaliDigits(endIdx)} / মোট {toBengaliDigits(totalQ)} টি MCQ)
              </span>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white font-bold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition cursor-pointer text-[11px]"
              >
                ← পূর্ববর্তী
              </button>

              <div className="flex items-center gap-1 overflow-x-auto max-w-[200px] sm:max-w-none">
                {Array.from({ length: totalPages }).map((_, pIdx) => {
                  const pNum = pIdx + 1;
                  const isCurrent = pNum === currentPage;
                  // Show current, first, last, and immediate neighbors
                  if (
                    pNum === 1 || 
                    pNum === totalPages || 
                    (pNum >= currentPage - 1 && pNum <= currentPage + 1)
                  ) {
                    return (
                      <button
                        key={`page-${pNum}`}
                        type="button"
                        onClick={() => handlePageChange(pNum)}
                        className={`w-7 h-7 rounded-lg text-xs font-black transition cursor-pointer ${
                          isCurrent
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {toBengaliDigits(pNum)}
                      </button>
                    );
                  }
                  if (pNum === currentPage - 2 || pNum === currentPage + 2) {
                    return <span key={`ellipsis-${pNum}`} className="text-slate-400 text-xs px-0.5">...</span>;
                  }
                  return null;
                })}
              </div>

              <button
                type="button"
                onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white font-bold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition cursor-pointer text-[11px]"
              >
                পরবর্তী →
              </button>
            </div>
          </div>
        )}

        {/* Questions List */}
        <div className="space-y-3 divide-y divide-slate-100">
          {visibleQuestions.map((q, localIdx) => {
            const absoluteQIndex = startIdx + localIdx + startIndexOffset;
            const isRevealed = showAllAnswers || !!revealedAnswers[q.id];
            const bookmarked = isBookmarked(q.id);
            const isRead = readQuestionIds.includes(q.id);
            const options = [q.optionA, q.optionB, q.optionC, q.optionD];
            const correctIdx = getCorrectIndex(q.correct);
            const userChoice = selectedUserOptions[q.id];

            return (
              <div 
                key={q.id || `q-${absoluteQIndex}`}
                className={`pt-3.5 first:pt-0 space-y-2.5 ${localIdx > 0 ? 'mt-2.5' : ''}`}
              >
                {/* Question Header & Action Row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    <span className="bg-indigo-50 border border-indigo-200 text-indigo-900 font-black text-xs px-2 py-0.5 rounded-lg shrink-0 mt-0.5">
                      {toBengaliDigits(absoluteQIndex + 1)}
                    </span>
                    <p className="text-xs sm:text-[13.5px] font-extrabold text-slate-900 leading-relaxed">
                      {q.text}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Read Status Toggle Button */}
                    <button
                      type="button"
                      onClick={() => handleToggleQuestionRead(q.id)}
                      className={`p-1.5 px-2.5 rounded-lg border text-[10px] font-bold transition cursor-pointer flex items-center gap-1 ${
                        isRead
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 shadow-2xs'
                          : 'bg-white text-slate-500 border-slate-200 hover:text-slate-800 hover:bg-slate-50'
                      }`}
                      title={isRead ? 'পড়া সম্পন্ন (ক্লিক করে আনমার্ক করুন)' : 'পড়া হয়েছে হিসেবে চিহ্নিত করুন'}
                    >
                      <CheckCircle className={`w-3.5 h-3.5 ${isRead ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span className="hidden sm:inline">{isRead ? 'পড়া হয়েছে' : 'পড়া বাকি'}</span>
                    </button>

                    {onToggleBookmark && (
                      <button
                        type="button"
                        onClick={() => onToggleBookmark(q.id)}
                        className={`p-1.5 rounded-lg border transition cursor-pointer ${
                          bookmarked 
                            ? 'bg-amber-50 text-amber-600 border-amber-300 hover:bg-amber-100 shadow-2xs' 
                            : 'bg-white text-slate-400 border-slate-200 hover:text-slate-700 hover:bg-slate-50'
                        }`}
                        title={bookmarked ? 'বুকমার্ক সরানো' : 'বুকমার্কে যোগ করুন'}
                      >
                        <BookmarkIcon className={`w-3.5 h-3.5 ${bookmarked ? 'fill-amber-500 text-amber-500' : ''}`} />
                      </button>
                    )}

                    {!showAllAnswers && (
                      <button
                        type="button"
                        onClick={() => {
                          setRevealedAnswers(prev => ({
                            ...prev,
                            [q.id]: !prev[q.id]
                          }));
                          if (!isRead) {
                            handleToggleQuestionRead(q.id);
                          }
                        }}
                        className="text-[10px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg border border-indigo-200 transition cursor-pointer shadow-2xs"
                      >
                        {isRevealed ? 'উত্তর লুকান' : 'উত্তর দেখুন'}
                      </button>
                    )}
                  </div>
                </div>

                {/* 4 Options Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5 text-xs">
                  {options.map((optText, optIdx) => {
                    const isCorrectOption = optIdx === correctIdx;
                    const isSelectedByUser = userChoice === optIdx;

                    let optionStyle = 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200';
                    
                    if (isRevealed) {
                      if (isCorrectOption) {
                        optionStyle = 'bg-emerald-50 text-emerald-950 border-emerald-300 font-extrabold shadow-2xs ring-1 ring-emerald-300';
                      } else if (isSelectedByUser) {
                        optionStyle = 'bg-rose-50 text-rose-950 border-rose-300 line-through';
                      }
                    } else if (isSelectedByUser) {
                      optionStyle = 'bg-indigo-50 text-indigo-950 border-indigo-400 font-bold';
                    }

                    return (
                      <button
                        key={`opt-${optIdx}`}
                        type="button"
                        onClick={() => {
                          setSelectedUserOptions(prev => ({
                            ...prev,
                            [q.id]: optIdx
                          }));
                          if (!isRevealed) {
                            setRevealedAnswers(prev => ({
                              ...prev,
                              [q.id]: true
                            }));
                          }
                          if (!isRead) {
                            handleToggleQuestionRead(q.id);
                          }
                        }}
                        className={`p-2.5 rounded-xl border text-left flex items-start gap-2.5 transition select-none cursor-pointer ${optionStyle}`}
                      >
                        <span className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5 ${
                          isRevealed && isCorrectOption
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {getOptionLetter(optIdx)}
                        </span>
                        <span className="flex-1 leading-relaxed font-semibold">{optText || '—'}</span>
                        {isRevealed && isCorrectOption && (
                          <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Explanation Box */}
                {isRevealed && (
                  <div className="bg-amber-50/80 border border-amber-200/90 rounded-xl p-3 text-xs text-amber-950 space-y-1.5 animate-fade-in shadow-2xs">
                    <div className="flex items-center justify-between font-extrabold text-[11px] text-amber-900 border-b border-amber-200/70 pb-1">
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                        সঠিক উত্তর: ({getOptionLetter(correctIdx)}) {options[correctIdx]}
                      </span>
                      <span className="text-[9.5px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded font-bold">
                        ব্যাখ্যা
                      </span>
                    </div>

                    <p className="text-[11.5px] leading-relaxed whitespace-pre-line text-slate-800 font-medium pt-0.5">
                      {q.explanation || 'এই প্রশ্নের জন্য আলাদা কোনো অতিরিক্ত ব্যাখ্যা যুক্ত নেই।'}
                    </p>

                    {/* Approved User Explanations */}
                    {q.userExplanations && q.userExplanations.filter(e => e.approved).length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-amber-200/70 space-y-1.5">
                        {q.userExplanations.filter(e => e.approved).map(ue => (
                          <div key={ue.id} className="bg-emerald-50/90 border border-emerald-200 rounded-lg p-2 text-[10.5px]">
                            <div className="flex justify-between font-bold text-emerald-900 mb-0.5">
                              <span>🏆 অতিরিক্ত ব্যাখ্যা:</span>
                              <span className="text-[9px] text-emerald-700">{ue.userName}</span>
                            </div>
                            <p className="text-slate-800">{ue.text}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Pagination Bottom Bar (if more than 20 MCQs) */}
        {totalQ > PAGE_SIZE && (
          <div className="bg-slate-100/90 border border-slate-200 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs pt-3 mt-2">
            <span className="text-[11px] font-bold text-slate-600">
              পৃষ্ঠা {toBengaliDigits(currentPage)} / {toBengaliDigits(totalPages)} (সর্বমোট {toBengaliDigits(totalQ)} টি MCQ)
            </span>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 rounded-lg border border-slate-300 bg-white font-bold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition cursor-pointer text-[11px]"
              >
                ← পূর্ববর্তী
              </button>

              <button
                type="button"
                onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 rounded-lg border border-slate-300 bg-white font-bold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition cursor-pointer text-[11px]"
              >
                পরবর্তী →
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ----------------------------------------------------
  // DEDICATED CLEAN PAGE FOR SELECTED LEAF TOPIC
  // ----------------------------------------------------
  if (selectedLeafTopic) {
    return (
      <div 
        id="leaf-category-clean-page"
        className="w-full flex-grow flex flex-col gap-4 animate-fade-in pb-12"
      >
        {/* 1. Header with Upper Left Back Button */}
        <div className="bg-gradient-to-r from-emerald-950 via-teal-900 to-indigo-950 rounded-2xl sm:rounded-3xl text-white p-4 sm:p-6 shadow-md border border-emerald-700/50 space-y-3">
          {/* Back button on upper left corner */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-700/60 pb-3">
            <button
              id="btn-leaf-page-back-upper-left"
              type="button"
              onClick={handleBackToHierarchy}
              className="bg-white/15 hover:bg-white/25 active:scale-95 text-white font-black px-3.5 py-2 rounded-xl text-xs flex items-center gap-2 transition border border-white/25 cursor-pointer shadow-xs"
            >
              <ArrowLeft className="w-4 h-4 text-amber-300" />
              <span>← অধ্যায় তালিকায় ফিরে যান (Back to Chapters)</span>
            </button>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-emerald-500/30 text-emerald-100 border border-emerald-400/30 text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
                <span>🌿</span> পরিচ্ছেদ MCQ পাঠ
              </span>
              {routine.courseName && (
                <span className="bg-purple-500/30 text-purple-100 border border-purple-400/30 text-[11px] font-bold px-3 py-1 rounded-full">
                  🎓 {routine.courseName}
                </span>
              )}
            </div>
          </div>

          {/* Breadcrumb Hierarchy */}
          <div className="flex items-center gap-1.5 flex-wrap text-xs text-emerald-100 pt-1">
            <span className="text-white/80 font-bold">📁 {selectedLeafTopic.catName}</span>
            <span className="text-emerald-300">›</span>
            <span className="text-white/90 font-bold">📂 {selectedLeafTopic.subName}</span>
            {!isSameFolderAndSubfolder(selectedLeafTopic.subName, selectedLeafTopic.leafName) && (
              <>
                <span className="text-emerald-300">›</span>
                <span className="text-amber-300 font-black">🌿 {selectedLeafTopic.leafName}</span>
              </>
            )}
          </div>

          {/* Title & Stats with Circular Reading Progress */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
            <div className="space-y-1">
              <h1 className="text-lg sm:text-2xl font-black text-white flex items-center gap-2.5 flex-wrap">
                <span>
                  {isSameFolderAndSubfolder(selectedLeafTopic.subName, selectedLeafTopic.leafName)
                    ? selectedLeafTopic.subName
                    : selectedLeafTopic.leafName}
                </span>
                <span className="bg-white/20 text-white text-xs font-black px-3 py-1 rounded-full border border-white/25">
                  {toBengaliDigits(selectedLeafTopic.questions.length)} টি MCQ
                </span>
              </h1>
              <p className="text-xs text-emerald-200 font-medium">
                রুটিন: {routine.title}
              </p>
            </div>

            {/* Circular Reading Progress Banner */}
            <div className="bg-white/10 backdrop-blur-xs border border-white/20 rounded-2xl p-2.5 sm:px-4 flex items-center gap-3 self-start sm:self-auto shadow-xs">
              <CircularProgressBar
                percentage={readingPercentage}
                size={40}
                strokeWidth={4}
                className="bg-emerald-950/40 rounded-full"
                textSizeClass="text-[9.5px] text-emerald-300 font-black"
                title={`সামগ্রিক পড়ার অগ্রগতি: ${toBengaliDigits(readingPercentage)}%`}
              />
              <div className="space-y-0.5">
                <span className="text-[10.5px] text-emerald-200 font-bold block">পড়ার অগ্রগতি</span>
                <span className="text-xs font-black text-white block">
                  {toBengaliDigits(readCount)}/{toBengaliDigits(totalMatchedCount)} সম্পন্ন ({toBengaliDigits(readingPercentage)}%)
                </span>
              </div>
              <div className="ml-1 pl-2 border-l border-white/20 flex flex-col gap-1">
                <button
                  type="button"
                  onClick={handleMarkAllQuestionsAsRead}
                  className="text-[9.5px] bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-black px-2 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 shadow-2xs"
                  title="এই রুটিনের সকল প্রশ্ন পড়া হয়েছে হিসেবে চিহ্নিত করুন"
                >
                  <CheckCircle className="w-3 h-3" />
                  <span>সব পড়া শেষ</span>
                </button>
                {readCount > 0 && (
                  <button
                    type="button"
                    onClick={handleResetReadingProgress}
                    className="text-[9px] text-rose-200 hover:text-white hover:bg-rose-500/50 px-1.5 py-0.5 rounded transition cursor-pointer text-center"
                    title="পড়ার অগ্রগতি শূন্য করুন"
                  >
                    রিসেট
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 2. Action Toolbar (Search, Answer Toggle, Count, Demo Exam) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-sm flex flex-wrap items-center justify-between gap-3 sticky top-2 z-20">
          {/* Search bar inside this leaf category */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="input-leaf-search"
              type="text"
              value={leafSearchQuery}
              onChange={e => setLeafSearchQuery(e.target.value)}
              placeholder={`"${selectedLeafTopic.leafName}" এর ভেতরে প্রশ্ন খুঁজুন...`}
              className="w-full pl-9.5 pr-8 py-2.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
            />
            {leafSearchQuery && (
              <button
                type="button"
                onClick={() => setLeafSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-black cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-emerald-50 border border-emerald-200 text-emerald-900 font-extrabold text-xs px-3.5 py-2 rounded-xl">
              মোট প্রশ্ন: {toBengaliDigits(leafFilteredQuestions.length)} টি
            </span>

            <button
              id="btn-leaf-toggle-answers"
              type="button"
              onClick={() => setShowAllAnswers(prev => !prev)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition border cursor-pointer shadow-2xs ${
                showAllAnswers 
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100' 
                  : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
              }`}
            >
              {showAllAnswers ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              {showAllAnswers ? 'উত্তর প্রদর্শিত' : 'কুইজ মোড (উত্তর গোপন)'}
            </button>
          </div>
        </div>

        {/* 3. Clean MCQ Content */}
        {leafFilteredQuestions.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-300 p-8 space-y-3">
            <HelpCircle className="w-14 h-14 text-slate-300 mx-auto" />
            <h3 className="text-sm font-black text-slate-700">কোনো প্রশ্ন মেলেনি</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed font-medium">
              {leafSearchQuery 
                ? `"${leafSearchQuery}" অনুসন্ধানে "${selectedLeafTopic.leafName}" টপিকে কোনো প্রশ্ন মেলেনি।`
                : 'এই পরিচ্ছেদের সাথে যুক্ত কোনো প্রশ্ন পাওয়া যায়নি।'
              }
            </p>
            {leafSearchQuery && (
              <button
                type="button"
                onClick={() => setLeafSearchQuery('')}
                className="mt-2 bg-emerald-600 text-white font-bold text-xs px-4 py-2 rounded-xl hover:bg-emerald-700 transition cursor-pointer"
              >
                সার্চ রিসেট করুন
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-emerald-100 p-4 sm:p-6 shadow-sm">
            {renderQuestionList(leafFilteredQuestions, `leaf-clean-page-${selectedLeafTopic.leafName}`, 0)}
          </div>
        )}
      </div>
    );
  }

  // ----------------------------------------------------
  // FULL CHAPTER HIERARCHY PAGE
  // ----------------------------------------------------
  return (
    <div 
      id="routine-hierarchical-page"
      className="w-full flex-grow flex flex-col gap-4 animate-fade-in pb-12"
    >
      {/* 1. Page Header & Navigation Banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 rounded-2xl sm:rounded-3xl text-white p-4 sm:p-6 shadow-md border border-indigo-700/50 space-y-3">
        {/* Back navigation & Badges */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-indigo-700/60 pb-3">
          <div className="flex items-center gap-2">
            <button
              id="btn-back-from-hierarchical-page"
              type="button"
              onClick={onClose}
              className="bg-white/10 hover:bg-white/20 active:scale-95 text-white font-extrabold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 transition border border-white/20 cursor-pointer shadow-xs"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>← রুটিন তালিকায় ফিরে যান</span>
            </button>
          </div>

          {routine.courseName && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-purple-500/30 text-purple-100 border border-purple-400/30 text-[11px] font-bold px-3 py-1 rounded-full">
                🎓 {routine.courseName}
              </span>
            </div>
          )}
        </div>

        {/* Title & Reading Progress Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
          <div className="space-y-1">
            <h1 className="text-base sm:text-xl font-black text-white leading-snug">
              {routine.title}
            </h1>
            <p className="text-xs text-indigo-200 font-medium">
              অধ্যায় ও পরিচ্ছেদ ভিত্তিক MCQ প্রস্তুতি
            </p>
          </div>

          {/* Circular Reading Progress Banner */}
          <div className="bg-white/10 backdrop-blur-xs border border-white/20 rounded-2xl p-2.5 sm:px-4 flex items-center gap-3 self-start sm:self-auto shadow-xs">
            <CircularProgressBar
              percentage={readingPercentage}
              size={42}
              strokeWidth={4}
              className="bg-indigo-950/40 rounded-full"
              textSizeClass="text-[10px] text-amber-300 font-black"
              title={`সামগ্রিক পড়ার অগ্রগতি: ${toBengaliDigits(readingPercentage)}%`}
            />
            <div className="space-y-0.5">
              <span className="text-[10.5px] text-indigo-200 font-bold block">পড়ার অগ্রগতি</span>
              <span className="text-xs font-black text-white block">
                {toBengaliDigits(readCount)}/{toBengaliDigits(totalMatchedCount)} সম্পন্ন ({toBengaliDigits(readingPercentage)}%)
              </span>
            </div>
            <div className="ml-1 pl-2 border-l border-white/20 flex flex-col gap-1">
              <button
                type="button"
                onClick={handleMarkAllQuestionsAsRead}
                className="text-[9.5px] bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-black px-2 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 shadow-2xs"
                title="এই রুটিনের সকল প্রশ্ন পড়া হয়েছে হিসেবে চিহ্নিত করুন"
              >
                <CheckCircle className="w-3 h-3" />
                <span>সব পড়া শেষ</span>
              </button>
              {readCount > 0 && (
                <button
                  type="button"
                  onClick={handleResetReadingProgress}
                  className="text-[9px] text-rose-200 hover:text-white hover:bg-rose-500/50 px-1.5 py-0.5 rounded transition cursor-pointer text-center"
                  title="পড়ার অগ্রগতি শূন্য করুন"
                >
                  রিসেট
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Sticky Action Toolbar (Search, Answer Mode, Total count, Practice) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-sm flex flex-wrap items-center justify-between gap-3 sticky top-2 z-20">
        {/* Search bar */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="input-hierarchical-search"
            type="text"
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setSearchPage(1);
            }}
            placeholder="এই সিলেবাসের ভেতর প্রশ্ন বা অপশন খুঁজুন..."
            className="w-full pl-9.5 pr-8 py-2.5 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-black cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Total Badge */}
          <span className="bg-indigo-50 border border-indigo-200 text-indigo-900 font-extrabold text-xs px-3.5 py-2 rounded-xl">
            মোট MCQ: {toBengaliDigits(filteredQuestions.length)} টি
          </span>

          {/* Answer Toggle */}
          <button
            id="btn-toggle-all-answers"
            type="button"
            onClick={() => setShowAllAnswers(prev => !prev)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition border cursor-pointer shadow-2xs ${
              showAllAnswers 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100' 
                : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
            }`}
          >
            {showAllAnswers ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            {showAllAnswers ? 'উত্তর প্রদর্শিত' : 'কুইজ মোড (উত্তর গোপন)'}
          </button>
        </div>
      </div>

      {/* 3. Hierarchy Content Section */}
      {hierarchicalTree.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-300 p-8 space-y-3">
          <HelpCircle className="w-14 h-14 text-slate-300 mx-auto" />
          <h3 className="text-sm font-black text-slate-700">কোনো প্রশ্ন পাওয়া যায়নি</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed font-medium">
            {searchQuery 
              ? `"${searchQuery}" অনুসন্ধানে কোনো প্রশ্ন মেলেনি। অন্য শব্দ লিখে চেষ্টা করুন।`
              : 'এই সিলেবাসের সাথে সরাসরি লিঙ্কযুক্ত প্রশ্ন ডাটাবেজে পাওয়া যায়নি।'
            }
          </p>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="mt-2 bg-indigo-600 text-white font-bold text-xs px-4 py-2 rounded-xl hover:bg-indigo-700 transition cursor-pointer"
            >
              সার্চ রিসেট করুন
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3.5">
          {hierarchicalTree.map((catNode, catIdx) => {
            const catKey = `cat-${catNode.name}`;
            const isCatExpanded = !!expandedNodes[catKey];

            const catAllQuestions = [
              ...catNode.directQuestions,
              ...catNode.subNodes.flatMap(s => [
                ...s.directQuestions,
                ...s.leafNodes.flatMap(l => l.questions)
              ])
            ];
            const catStats = getQuestionListReadingStats(catAllQuestions);

            return (
              <div 
                key={`cat-${catIdx}-${catNode.name}`}
                className="bg-white rounded-2xl border border-indigo-100 shadow-2xs overflow-hidden transition"
              >
                {/* 1. Category Header (Level 1) - Collapsed by default */}
                <div 
                  onClick={() => toggleCategoryNode(catKey, catNode.name)}
                  className="p-4 sm:p-4.5 bg-gradient-to-r from-indigo-50/90 via-purple-50/40 to-white hover:bg-indigo-50 flex items-center justify-between gap-3 cursor-pointer border-b border-indigo-100/70 select-none transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-2xs">
                      {toBengaliDigits(catIdx + 1)}
                    </span>
                    <div>
                      <h3 className="text-xs sm:text-sm font-black text-indigo-950 flex items-center gap-2 flex-wrap">
                        <span>{catNode.name}</span>
                        <span className="bg-indigo-100 text-indigo-800 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-indigo-200">
                          {toBengaliDigits(catNode.totalCount)} টি MCQ
                        </span>
                      </h3>
                      <span className="text-[10.5px] text-slate-500 font-semibold">
                        অধ্যায় / বিষয়: {toBengaliDigits(catNode.subNodes.length)} টি
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Circular Reading Progress for Category */}
                    <div 
                      className="flex items-center gap-1.5 bg-white border border-indigo-200/90 px-2 py-1 rounded-xl shadow-2xs shrink-0"
                      title={`এই বিষয়ের পড়ার অগ্রগতি: ${toBengaliDigits(catStats.read)}/${toBengaliDigits(catStats.total)} (${toBengaliDigits(catStats.percentage)}%)`}
                    >
                      <CircularProgressBar
                        percentage={catStats.percentage}
                        size={26}
                        strokeWidth={2.5}
                        textSizeClass="text-[7.5px]"
                      />
                      <div className="text-right hidden sm:block">
                        <span className="text-[8.5px] text-indigo-700 font-bold block leading-none">পড়া হয়েছে</span>
                        <span className="text-[10px] font-black text-indigo-950 leading-tight">
                          {toBengaliDigits(catStats.percentage)}%
                        </span>
                      </div>
                    </div>

                    <span className="text-[10px] text-indigo-600 font-bold hidden md:inline">
                      {isCatExpanded ? 'সংকুচিত করুন' : 'অধ্যায় দেখতে ক্লিক করুন'}
                    </span>
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${
                      isCatExpanded ? 'bg-indigo-600 text-white shadow-2xs' : 'bg-indigo-100 text-indigo-700'
                    }`}>
                      {isCatExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {/* Subcategories (Level 2) - Collapsed by default */}
                {isCatExpanded && (
                  <div className="p-3 sm:p-5 space-y-3 bg-slate-50/50">
                    {catNode.subNodes.map((subNode, subIdx) => {
                      const subKey = `sub-${catNode.name}-${subNode.name}`;
                      const isSubExpanded = !!expandedNodes[subKey];

                      const subAllQuestions = [
                        ...subNode.directQuestions,
                        ...subNode.leafNodes.flatMap(l => l.questions)
                      ];
                      const subStats = getQuestionListReadingStats(subAllQuestions);

                      // Check if this subfolder has a single leaf that is the same topic, or if folder and subfolder names match
                      const hasSingleLeaf = subNode.leafNodes.length === 1;
                      const singleLeaf = hasSingleLeaf ? subNode.leafNodes[0] : null;
                      const isSameName = singleLeaf ? isSameFolderAndSubfolder(subNode.name, singleLeaf.name) : false;
                      const canDirectOpen = (hasSingleLeaf && isSameName) || subNode.leafNodes.length === 0;

                      // The target questions and leaf topic name to open directly
                      const directTargetLeafName = singleLeaf?.name || subNode.name;
                      const directTargetQuestions = singleLeaf?.questions && singleLeaf.questions.length > 0 
                        ? singleLeaf.questions 
                        : (subNode.directQuestions && subNode.directQuestions.length > 0 ? subNode.directQuestions : []);

                      return (
                        <div 
                          key={`sub-${subIdx}-${subNode.name}`}
                          className="bg-white rounded-xl border border-purple-100 shadow-2xs overflow-hidden transition"
                        >
                          {/* 2. Subcategory Header (Level 2) */}
                          <div 
                            onClick={() => {
                              if (canDirectOpen) {
                                openLeafTopic(catNode.name, subNode.name, directTargetLeafName, directTargetQuestions);
                              } else {
                                toggleSubcategoryNode(subKey, catNode.name, subNode.name);
                              }
                            }}
                            className="p-3.5 bg-purple-50/60 hover:bg-purple-100/70 active:scale-[0.99] flex items-center justify-between gap-3 cursor-pointer border-b border-purple-100 select-none transition group"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="w-5.5 h-5.5 rounded-lg bg-purple-600 group-hover:bg-purple-700 text-white flex items-center justify-center font-bold text-[10.5px] shrink-0 shadow-2xs transition">
                                {toBengaliDigits(subIdx + 1)}
                              </span>
                              <div>
                                <h4 className="text-xs sm:text-[13px] font-extrabold text-purple-950 flex items-center gap-2 flex-wrap">
                                  <span>{subNode.name}</span>
                                  <span className="bg-purple-100 group-hover:bg-purple-200 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-purple-200 transition">
                                    {toBengaliDigits(subNode.totalCount)} টি প্রশ্ন
                                  </span>
                                </h4>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {/* Circular Reading Progress for Subcategory */}
                              <div 
                                className="flex items-center gap-1.5 bg-white border border-purple-200/90 px-2 py-1 rounded-xl shadow-2xs shrink-0"
                                title={`এই অধ্যায়ের পড়ার অগ্রগতি: ${toBengaliDigits(subStats.read)}/${toBengaliDigits(subStats.total)} (${toBengaliDigits(subStats.percentage)}%)`}
                              >
                                <CircularProgressBar
                                  percentage={subStats.percentage}
                                  size={24}
                                  strokeWidth={2.5}
                                  textSizeClass="text-[7px]"
                                />
                                <div className="text-right hidden sm:block">
                                  <span className="text-[8.5px] text-purple-700 font-bold block leading-none">পড়া হয়েছে</span>
                                  <span className="text-[10px] font-black text-purple-950 leading-tight">
                                    {toBengaliDigits(subStats.percentage)}%
                                  </span>
                                </div>
                              </div>

                              {canDirectOpen ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openLeafTopic(catNode.name, subNode.name, directTargetLeafName, directTargetQuestions);
                                  }}
                                  className="bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                                >
                                  <span>MCQ পড়ুন</span>
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] text-purple-700 font-bold hidden sm:inline">
                                    {isSubExpanded ? 'সংকুচিত করুন' : 'উপ-অধ্যায় দেখুন'}
                                  </span>
                                  <div className={`w-6 h-6 rounded-md flex items-center justify-center transition ${
                                    isSubExpanded ? 'bg-purple-600 text-white' : 'bg-purple-100 text-purple-700'
                                  }`}>
                                    {isSubExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Leaf Topics (Level 3) - Only shown if multiple distinct subfolders exist */}
                          {!canDirectOpen && isSubExpanded && (
                            <div className="p-3 sm:p-4 space-y-2.5 bg-slate-50/30">
                              {subNode.leafNodes.map((leafNode, leafIdx) => {
                                const leafStats = getQuestionListReadingStats(leafNode.questions);

                                return (
                                  <div 
                                    key={`leaf-${leafIdx}-${leafNode.name}`}
                                    onClick={() => openLeafTopic(catNode.name, subNode.name, leafNode.name, leafNode.questions)}
                                    className="p-3 sm:p-3.5 bg-white hover:bg-emerald-50/60 active:scale-[0.99] border border-emerald-100/90 hover:border-emerald-300 rounded-xl shadow-2xs flex items-center justify-between gap-3 cursor-pointer transition select-none group"
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <span className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white flex items-center justify-center font-bold text-xs shrink-0 transition">
                                        🌿
                                      </span>
                                      <div>
                                        <h5 className="text-xs sm:text-[13px] font-bold text-slate-900 group-hover:text-emerald-950 flex items-center gap-2 flex-wrap transition">
                                          <span>পরিচ্ছেদ: {leafNode.name}</span>
                                          <span className="bg-emerald-50 group-hover:bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-md border border-emerald-200">
                                            {toBengaliDigits(leafNode.questions.length)} টি MCQ
                                          </span>
                                        </h5>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                      {/* Circular Reading Progress for Leaf Topic */}
                                      <div 
                                        className="flex items-center gap-1.5 bg-emerald-50/90 border border-emerald-200 px-2 py-1 rounded-xl shadow-2xs shrink-0"
                                        title={`এই পরিচ্ছেদের পড়ার অগ্রগতি: ${toBengaliDigits(leafStats.read)}/${toBengaliDigits(leafStats.total)} (${toBengaliDigits(leafStats.percentage)}%)`}
                                      >
                                        <CircularProgressBar
                                          percentage={leafStats.percentage}
                                          size={24}
                                          strokeWidth={2.5}
                                          textSizeClass="text-[7px]"
                                        />
                                        <div className="text-right hidden sm:block">
                                          <span className="text-[8px] text-emerald-700 font-bold block leading-none">পড়া হয়েছে</span>
                                          <span className="text-[9.5px] font-black text-emerald-950 leading-tight">
                                            {toBengaliDigits(leafStats.percentage)}%
                                          </span>
                                        </div>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openLeafTopic(catNode.name, subNode.name, leafNode.name, leafNode.questions);
                                        }}
                                        className="bg-emerald-600 group-hover:bg-emerald-700 text-white font-extrabold text-xs px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                                      >
                                        <span>MCQ পড়ুন</span>
                                        <ArrowRight className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
