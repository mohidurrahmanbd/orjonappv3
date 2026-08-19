import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Question, LiveExam, Notice, Routine, User, Attempt, Bookmark, CategoryItem, SubcategoryItem, Course, formatBengaliDate } from '../types';
import { 
  User as UserIcon, BookOpen, Award, Bookmark as BookmarkIcon, 
  FileText, Clock, ArrowLeft, CheckCircle2, XCircle, Compass, 
  ChevronRight, Sparkles, TrendingUp, AlertCircle, Calendar, 
  HelpCircle, Maximize2, FolderHeart, RefreshCw, Layers, Settings,
  Folder, FolderOpen, Home, Menu, X, Filter,
  Languages, Feather, Calculator, Binary, FlaskConical, Atom, Dna, Laptop, Cpu,
  Landmark, Flag, Globe2, BrainCircuit, Scale, ShieldCheck, Lightbulb, GraduationCap,
  Building2, Coins, School, Globe, History, BookMarked,
  Camera, Eye, EyeOff, KeyRound, Upload, Phone, Download, FolderTree,
  ChevronDown, ChevronLeft, Lock, Unlock, Search
} from 'lucide-react';
import { motion } from 'motion/react';
import { downloadCourseRoutinePDF } from '../lib/pdfGenerator';
import RoutineHierarchicalMCQModal from './RoutineHierarchicalMCQModal';
import CurrentAffairsFeed from './CurrentAffairsFeed';
import { formatRoutineSyllabusPaths, getRoutineMatchingQuestions, calculateSubjectWiseAnalysis, toBengaliDigits } from '../lib/routineUtils';

// Helper to detect variations/typos of "জব সলিউশন পরীক্ষা"
const isJobSolutionVariation = (name: string): boolean => {
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

// Helper to detect variations/typos of "সাল ভিত্তিক জব সলিউশন"
const isYearJobSolutionVariation = (name: string): boolean => {
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

// Helper to return representative icon based on subject/category title
const renderSubjectIcon = (name: string, sizeClass = "w-4 h-4") => {
  const norm = (name || '').toLowerCase();

  if (norm.includes('বাংলা') || norm.includes('bangla') || norm.includes('সাহিত্য') || norm.includes('ব্যাকরণ')) {
    return <Languages className={sizeClass} />;
  }
  if (norm.includes('ইংরেজি') || norm.includes('english') || norm.includes('গ্রামার') || norm.includes('grammar')) {
    return <Globe className={sizeClass} />;
  }
  if (norm.includes('গণিত') || norm.includes('math') || norm.includes('পাটিগণিত') || norm.includes('বীজগণিত') || norm.includes('জ্যামিতি') || norm.includes('অঙ্ক')) {
    return <Calculator className={sizeClass} />;
  }
  if (norm.includes('কম্পিউটার') || norm.includes('ict') || norm.includes('আইসিটি') || norm.includes('তথ্যপ্রযুক্তি') || norm.includes('প্রযুক্তি') || norm.includes('কম্পিউটার ও তথ্যপ্রযুক্তি')) {
    return <Laptop className={sizeClass} />;
  }
  if (norm.includes('বিজ্ঞান') || norm.includes('science') || norm.includes('পদার্থ') || norm.includes('রসায়ন') || norm.includes('জীববিজ্ঞান') || norm.includes('পদার্থবিজ্ঞান')) {
    return <FlaskConical className={sizeClass} />;
  }
  if (norm.includes('বাংলাদেশ') || norm.includes('bangladesh') || norm.includes('সংবিধান') || norm.includes('মুক্তিযুদ্ধ')) {
    return <Landmark className={sizeClass} />;
  }
  if (norm.includes('আন্তর্জাতিক') || norm.includes('international') || norm.includes('বিশ্ব')) {
    return <Globe2 className={sizeClass} />;
  }
  if (norm.includes('ভূগোল') || norm.includes('পরিবেশ') || norm.includes('দুর্যোগ') || norm.includes('geography')) {
    return <Compass className={sizeClass} />;
  }
  if (norm.includes('মানসিক দক্ষতা') || norm.includes('বুদ্ধিমত্তা') || norm.includes('mental')) {
    return <BrainCircuit className={sizeClass} />;
  }
  if (norm.includes('নৈতিকতা') || norm.includes('মূল্যবোধ') || norm.includes('সুশাসন') || norm.includes('ethics')) {
    return <Scale className={sizeClass} />;
  }
  if (norm.includes('সাধারণ জ্ঞান') || norm.includes('gk') || norm.includes('জ্ঞান')) {
    return <Lightbulb className={sizeClass} />;
  }
  if (norm.includes('ব্যাংক') || norm.includes('bank') || norm.includes('অর্থনীতি') || norm.includes('finance')) {
    return <Building2 className={sizeClass} />;
  }
  if (norm.includes('প্রাথমিক') || norm.includes('প্রাইমারি') || norm.includes('শিক্ষক') || norm.includes('স্কুল')) {
    return <School className={sizeClass} />;
  }
  if (norm.includes('ইতিহাস') || norm.includes('history') || norm.includes('ঐতিহ্য')) {
    return <History className={sizeClass} />;
  }
  return <BookOpen className={sizeClass} />;
};

// Helper for dynamic subject theme colors
const getSubjectTheme = (name: string) => {
  const norm = (name || '').toLowerCase();
  if (norm.includes('বাংলা') || norm.includes('bangla') || norm.includes('সাহিত্য')) {
    return {
      bg: 'bg-rose-600',
      lightBg: 'bg-rose-50',
      text: 'text-rose-950',
      subText: 'text-rose-700',
      border: 'border-rose-200',
      hoverBg: 'hover:bg-rose-50/80',
      hoverBorder: 'hover:border-rose-400',
      badgeBg: 'bg-rose-100/90 text-rose-950 border-rose-300',
    };
  }
  if (norm.includes('ইংরেজি') || norm.includes('english')) {
    return {
      bg: 'bg-blue-600',
      lightBg: 'bg-blue-50',
      text: 'text-blue-950',
      subText: 'text-blue-700',
      border: 'border-blue-200',
      hoverBg: 'hover:bg-blue-50/80',
      hoverBorder: 'hover:border-blue-400',
      badgeBg: 'bg-blue-100/90 text-blue-950 border-blue-300',
    };
  }
  if (norm.includes('গণিত') || norm.includes('math') || norm.includes('মানসিক দক্ষতা')) {
    return {
      bg: 'bg-amber-600',
      lightBg: 'bg-amber-50',
      text: 'text-amber-950',
      subText: 'text-amber-800',
      border: 'border-amber-200',
      hoverBg: 'hover:bg-amber-50/80',
      hoverBorder: 'hover:border-amber-400',
      badgeBg: 'bg-amber-100/90 text-amber-950 border-amber-300',
    };
  }
  if (norm.includes('বিজ্ঞান') || norm.includes('science') || norm.includes('পদার্থ') || norm.includes('রসায়ন')) {
    return {
      bg: 'bg-teal-600',
      lightBg: 'bg-teal-50',
      text: 'text-teal-950',
      subText: 'text-teal-700',
      border: 'border-teal-200',
      hoverBg: 'hover:bg-teal-50/80',
      hoverBorder: 'hover:border-teal-400',
      badgeBg: 'bg-teal-100/90 text-teal-950 border-teal-300',
    };
  }
  if (norm.includes('কম্পিউটার') || norm.includes('ict') || norm.includes('আইসিটি')) {
    return {
      bg: 'bg-cyan-600',
      lightBg: 'bg-cyan-50',
      text: 'text-cyan-950',
      subText: 'text-cyan-800',
      border: 'border-cyan-200',
      hoverBg: 'hover:bg-cyan-50/80',
      hoverBorder: 'hover:border-cyan-400',
      badgeBg: 'bg-cyan-100/90 text-cyan-950 border-cyan-300',
    };
  }
  if (norm.includes('বাংলাদেশ') || norm.includes('bangladesh')) {
    return {
      bg: 'bg-emerald-600',
      lightBg: 'bg-emerald-50',
      text: 'text-emerald-950',
      subText: 'text-emerald-800',
      border: 'border-emerald-200',
      hoverBg: 'hover:bg-emerald-50/80',
      hoverBorder: 'hover:border-emerald-400',
      badgeBg: 'bg-emerald-100/90 text-emerald-950 border-emerald-300',
    };
  }
  if (norm.includes('আন্তর্জাতিক') || norm.includes('international')) {
    return {
      bg: 'bg-purple-600',
      lightBg: 'bg-purple-50',
      text: 'text-purple-950',
      subText: 'text-purple-800',
      border: 'border-purple-200',
      hoverBg: 'hover:bg-purple-50/80',
      hoverBorder: 'hover:border-purple-400',
      badgeBg: 'bg-purple-100/90 text-purple-950 border-purple-300',
    };
  }
  if (norm.includes('ভূগোল') || norm.includes('পরিবেশ')) {
    return {
      bg: 'bg-lime-600',
      lightBg: 'bg-lime-50',
      text: 'text-lime-950',
      subText: 'text-lime-800',
      border: 'border-lime-200',
      hoverBg: 'hover:bg-lime-50/80',
      hoverBorder: 'hover:border-lime-400',
      badgeBg: 'bg-lime-100/90 text-lime-950 border-lime-300',
    };
  }
  if (norm.includes('নৈতিকতা') || norm.includes('মূল্যবোধ') || norm.includes('সুশাসন')) {
    return {
      bg: 'bg-indigo-600',
      lightBg: 'bg-indigo-50',
      text: 'text-indigo-950',
      subText: 'text-indigo-800',
      border: 'border-indigo-200',
      hoverBg: 'hover:bg-indigo-50/80',
      hoverBorder: 'hover:border-indigo-400',
      badgeBg: 'bg-indigo-100/90 text-indigo-950 border-indigo-300',
    };
  }
  return {
    bg: 'bg-indigo-600',
    lightBg: 'bg-indigo-50',
    text: 'text-indigo-950',
    subText: 'text-indigo-800',
    border: 'border-indigo-200',
    hoverBg: 'hover:bg-indigo-50/80',
    hoverBorder: 'hover:border-indigo-400',
    badgeBg: 'bg-indigo-100/90 text-indigo-950 border-indigo-300',
  };
};

interface UserPortalProps {
  user: User;
  questions: Question[];
  liveExams: LiveExam[];
  notices: Notice[];
  routines: Routine[];
  courses?: Course[];
  attempts: Attempt[];
  bookmarks: Bookmark[];
  categories: CategoryItem[];
  subcategories: SubcategoryItem[];
  onAddBookmark: (questionId: string, folder: string) => void;
  onRemoveBookmark: (bookmarkId: string) => void;
  onSaveAttempt: (attempt: Omit<Attempt, 'id' | 'submittedAt'>) => void;
  onUpdateQuestion?: (id: string, q: Partial<Question>) => void;
  onUpdateUser?: (updatedUser: User) => void;
  onLogout: () => void;
  allowUserExplanation?: boolean;
  showMcqCount?: boolean;
  directExamId?: string | null;
  onRegisterPrompt?: () => void;
  onFetchQuestionsLazy?: (filter: { category?: string; subcategory?: string; topic?: string; examId?: string; forceRefresh?: boolean }) => Promise<Question[]>;
}

export default function UserPortal({
  user,
  questions = [],
  liveExams = [],
  notices = [],
  routines = [],
  courses = [],
  attempts = [],
  bookmarks = [],
  categories = [],
  subcategories = [],
  onAddBookmark,
  onRemoveBookmark,
  onSaveAttempt,
  onUpdateQuestion,
  onUpdateUser,
  onLogout,
  allowUserExplanation = true,
  showMcqCount = true,
  directExamId,
  onRegisterPrompt,
  onFetchQuestionsLazy
}: UserPortalProps) {
  // Navigation
  const [activeTab, setActiveTab] = useState<'dashboard' | 'preparation' | 'job' | 'yearJob' | 'bookmarks' | 'exams' | 'results' | 'courses' | 'routines' | 'profile' | 'currentAffairs'>('dashboard');
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Study & Preparation states
  const [prepCategory, setPrepCategory] = useState('সাধারণ জ্ঞান');
  const [prepMode, setPrepMode] = useState<'verify' | 'read' | 'exam'>('verify');
  const [prepExamLimit, setPrepExamLimit] = useState(10);

  // Custom Alert and Confirm Dialog States
  const [customAlert, setCustomAlert] = useState<{
    open: boolean;
    title?: string;
    message: string;
    onConfirm?: () => void;
    showCancel?: boolean;
    confirmText?: string;
    cancelText?: string;
  } | null>(null);
  const [customConfirm, setCustomConfirm] = useState<{ open: boolean; title?: string; message: string; onConfirm: () => void; onCancel?: () => void } | null>(null);

  const showCustomAlert = (
    param1: string,
    param2?: (() => void) | string,
    param3?: string,
    showCancel?: boolean,
    confirmText?: string,
    cancelText?: string
  ) => {
    let title = '📢 তথ্য';
    let message = '';
    let onConfirmFunc: (() => void) | undefined = undefined;

    if (typeof param2 === 'function') {
      message = param1;
      onConfirmFunc = param2;
      if (param3) title = param3;
    } else if (typeof param2 === 'string') {
      title = param1;
      message = param2;
      if (param3 && param3 !== 'success' && param3 !== 'info' && param3 !== 'warning' && param3 !== 'error') {
        title = `${param3} ${param1}`;
      }
    } else {
      message = param1;
      if (param3) title = param3;
    }

    setCustomAlert({ open: true, title, message, onConfirm: onConfirmFunc, showCancel, confirmText, cancelText });
  };

  const showCustomConfirm = (message: string, onConfirm: () => void, onCancel?: () => void, title?: string) => {
    setCustomConfirm({ open: true, title, message, onConfirm, onCancel });
  };

  // Course States
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<string[]>(() => {
    const userKey = user?.userId || user?.phone || 'guest';
    const saved = localStorage.getItem(`orjon_enrolled_courses_${userKey}`);
    if (saved) {
      try { return JSON.parse(saved); } catch { return []; }
    }
    return [];
  });
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<'enrolled' | 'all' | 'active' | 'upcoming' | 'completed'>('enrolled');
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(null);
  const [expandedSyllabusMap, setExpandedSyllabusMap] = useState<Record<string, boolean>>({});

  const handleToggleEnrollCourse = (courseId: string, courseTitle: string) => {
    const userKey = user?.userId || user?.phone || 'guest';
    let updated: string[];
    if (enrolledCourseIds.includes(courseId)) {
      updated = enrolledCourseIds.filter(id => id !== courseId);
      showCustomAlert('আন-এনরোলড!', `"${courseTitle}" কোর্সটি থেকে আন-এনরোল করা হয়েছে।`, 'info');
    } else {
      updated = [...enrolledCourseIds, courseId];
      showCustomAlert('অভিনন্দন! 🎉', `"${courseTitle}" কোর্সে আপনি সফলভাবে এনরোল করেছেন! এটি "আমার কোর্স" সেকশনে যুক্ত হয়েছে।`, 'success');
      setSelectedCourseFilter('enrolled');
    }
    setEnrolledCourseIds(updated);
    localStorage.setItem(`orjon_enrolled_courses_${userKey}`, JSON.stringify(updated));
  };

  // Helper to determine routine batch status: open, enrolled, or unrolled
  const getRoutineBatchInfo = (item: Routine) => {
    const targetCourse = courses ? courses.find(c => 
      (item.courseId && c.id === item.courseId) || 
      (item.courseName && c.title.trim().toLowerCase() === item.courseName.trim().toLowerCase())
    ) : undefined;

    const courseTitle = targetCourse?.title || item.courseName;
    const courseId = targetCourse?.id || item.courseId;
    const hasCourse = Boolean(courseTitle || courseId);

    if (!hasCourse) {
      return {
        type: 'open' as const,
        label: '🌐 ওপেন ব্যাচ (Open)',
        shortLabel: 'উন্মুক্ত (Open)',
        badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
        cardBorder: 'border-blue-200/80 hover:border-blue-300',
        description: 'উন্মুক্ত পরীক্ষা ও রুটিন — কোনো কোর্সে এনরোলমেন্ট ছাড়াই সরাসরি অংশগ্রহণযোগ্য।',
        courseTitle: undefined,
        courseId: undefined,
        isEnrolled: false
      };
    }

    const isEnrolled = courseId 
      ? enrolledCourseIds.includes(courseId) 
      : (courseTitle ? courses.some(c => c.title === courseTitle && enrolledCourseIds.includes(c.id)) : false);

    if (isEnrolled) {
      return {
        type: 'enrolled' as const,
        label: '✅ এনরোল্ড ব্যাচ (Enrolled)',
        shortLabel: 'এনরোল্ড (Enrolled)',
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300',
        cardBorder: 'border-emerald-200/80 hover:border-emerald-300',
        description: `আপনি "${courseTitle}" কোর্সে সফলভাবে এনরোল্ড আছেন।`,
        courseTitle,
        courseId: courseId || targetCourse?.id,
        isEnrolled: true
      };
    }

    return {
      type: 'unrolled' as const,
      label: '🔒 আন-এনরোল্ড (Unenrolled)',
      shortLabel: 'আন-এনরোল্ড (Unenrolled)',
      badgeClass: 'bg-amber-50 text-amber-900 border-amber-300',
      cardBorder: 'border-amber-200/70 hover:border-amber-300',
      description: `কোর্স: "${courseTitle}"। আপনি এই কোর্সে এখনও এনরোল করেননি।`,
      courseTitle,
      courseId: courseId || targetCourse?.id,
      isEnrolled: false
    };
  };

  // Check whether a routine's course is enrolled before allowing exams or preparation
  const checkCourseEnrollmentAccess = (routine: Routine, featureName: string = 'পরীক্ষা ও প্রস্তুতি'): boolean => {
    const batchInfo = getRoutineBatchInfo(routine);
    if (batchInfo.type === 'unrolled') {
      const courseTitle = batchInfo.courseTitle || 'এই কোর্সটি';
      const courseId = batchInfo.courseId;
      showCustomAlert(
        `🔒 কোর্সে এনরোল প্রয়োজন!\n\n"${courseTitle}" কোর্সের ${featureName} শুধুমাত্র এনরোল্ড শিক্ষার্থীদের জন্য উন্মুক্ত।\n\nআপনি বর্তমানে শুধুমাত্র রুটিন ও সিলেবাস দেখতে পারবেন। ${featureName} আনলক করতে অনুগ্রহ করে কোর্সে এনরোল (Enroll) করুন।`,
        () => {
          if (courseId) {
            handleToggleEnrollCourse(courseId, courseTitle);
          }
        },
        '🔒 কোর্সটি লক করা আছে',
        true,
        'এনরোল করুন',
        'বন্ধ করুন'
      );
      return false;
    }
    return true;
  };

  // Hierarchical Routine MCQ Viewer Modal State
  const [viewingHierarchyRoutine, setViewingHierarchyRoutine] = useState<Routine | null>(null);
  // Routine Syllabus Pop-up Modal State
  const [syllabusModalRoutine, setSyllabusModalRoutine] = useState<Routine | null>(null);

  const handleOpenRoutinePreparation = (routine: Routine) => {
    if (!checkCourseEnrollmentAccess(routine, 'পরিক্ষার প্রস্তুতি (Chapter MCQ)')) {
      return;
    }
    setViewingHierarchyRoutine(routine);
  };

  const startDemoExam = async (routine: Routine) => {
    if (!checkCourseEnrollmentAccess(routine, 'ডেমো পরীক্ষা (Demo Exam)')) {
      return;
    }
    // 1. Find corresponding original exam config or linked live exam
    const linkedExam = liveExams.find(e => 
      (e.routineId && e.routineId === routine.id) || 
      (routine.courseId && e.courseId === routine.courseId && e.title?.trim().toLowerCase() === routine.title?.trim().toLowerCase())
    );

    // Number of MCQs of demo exam is equal to original exam
    const targetQLimit = 
      routine.examConfig?.qLimit || 
      linkedExam?.qLimit || 
      (routine.examConfig?.questionIds && routine.examConfig.questionIds.length) || 
      (linkedExam?.questionIds && linkedExam.questionIds.length) || 
      20;

    const targetTimeLimit = 
      routine.examConfig?.timeLimit || 
      linkedExam?.timeLimit || 
      Math.max(5, Math.round(targetQLimit * 0.8));

    let finalQuestions: Question[] = [];

    // Check if explicit questionIds were configured in routine or linked live exam
    const explicitIds = (routine.examConfig?.questionIds && routine.examConfig.questionIds.length > 0) 
      ? routine.examConfig.questionIds 
      : (linkedExam?.questionIds && linkedExam.questionIds.length > 0) 
        ? linkedExam.questionIds 
        : null;

    if (explicitIds && explicitIds.length > 0) {
      let idSet = new Set(explicitIds);
      finalQuestions = questions.filter(q => idSet.has(q.id));
      if (finalQuestions.length === 0 && onFetchQuestionsLazy) {
        const fetched = await onFetchQuestionsLazy({ examId: linkedExam?.id, category: routine.selectedCategories?.[0] });
        idSet = new Set(explicitIds);
        finalQuestions = (fetched || []).filter(q => idSet.has(q.id));
      }
      finalQuestions.sort((a, b) => explicitIds.indexOf(a.id) - explicitIds.indexOf(b.id));
    } else {
      // Strictly filter questions matching the routine's selected syllabus topics
      let matchedQs = getRoutineMatchingQuestions(routine, questions, subcategories);

      // Lazy load if questions are empty in local memory
      if (matchedQs.length === 0 && onFetchQuestionsLazy && routine.selectedCategories && routine.selectedCategories.length > 0) {
        const fetched = await onFetchQuestionsLazy({ category: routine.selectedCategories[0] });
        if (fetched && fetched.length > 0) {
          matchedQs = getRoutineMatchingQuestions(routine, fetched, subcategories);
        }
      }

      if (matchedQs.length === 0) {
        const syllabusPaths = formatRoutineSyllabusPaths(routine, subcategories, categories, questions);
        const syllabusName = syllabusPaths.length > 0 ? syllabusPaths.join(', ') : routine.title;
        showCustomAlert(
          'সিলেবাসের প্রশ্ন পাওয়া যায়নি',
          `রুটিনের নির্বাচিত সিলেবাসের ("${syllabusName}") জন্য প্রশ্নভাণ্ডারে কোনো প্রশ্ন পাওয়া যায়নি।`,
          'info'
        );
        return;
      }

      // Strictly shuffle and take up to targetQLimit from the syllabus-matched questions only!
      const countToTake = Math.min(targetQLimit, matchedQs.length);
      finalQuestions = [...matchedQs].sort(() => 0.5 - Math.random()).slice(0, countToTake);
    }

    if (finalQuestions.length === 0) {
      showCustomAlert('দুঃখিত, ডেমো পরীক্ষার জন্য কোনো প্রশ্ন পাওয়া যায়নি!');
      return;
    }

    // Close hierarchy routine modal if open
    setViewingHierarchyRoutine(null);

    // Initialize Quiz in Real Exam mode (answers not revealed instantly!)
    setQuizQuestions(finalQuestions);
    setQuizTitle(`ডেমো এক্সাম: ${routine.title}`);
    setQuizExamId(`demo_exam_${routine.id}_${Date.now()}`);
    setQuizTimeLimitMinutes(targetTimeLimit);
    setQuizAnswerMode('after_exam'); // CRITICAL: answers are NOT visible instantly during the test
    setCurrentQIndex(0);
    setQuizPage(1);
    setQuizFilterMode('all');
    setUserSelectedAnswers({});
    setSecondsRemaining(targetTimeLimit * 60);
    setIsQuizTimerRunning(true);
    setReaderModeActive(false);
    setQuizActive(true);
  };
  
  // Job Solution Bank states
  const [jobSubcategory, setJobSubcategory] = useState('');
  const [jobMode, setJobMode] = useState<'verify' | 'read' | 'exam'>('verify');
  const [jobExamLimit, setJobExamLimit] = useState(10);

  // Year Job Solution states
  const [yearJobPath, setYearJobPath] = useState<string[]>([]);

  // Hierarchical navigation states
  const [prepPath, setPrepPath] = useState<string[]>([]); // path of Category/Subcategory names
  const [jobPath, setJobPath] = useState<string[]>([]);   // path of Subcategory names

  // Reader Mode State (Immersive full screen)
  const [readerModeActive, setReaderModeActive] = useState(false);
  const [readerQuestions, setReaderQuestions] = useState<Question[]>([]);
  const [readerTitle, setReaderTitle] = useState('');
  const [readerActiveMode, setReaderActiveMode] = useState<'read' | 'verify'>('read');
  const [readerSelectedAnswers, setReaderSelectedAnswers] = useState<Record<string, string>>({});
  const [readerPage, setReaderPage] = useState(1);
  const [readerSource, setReaderSource] = useState<'prep' | 'job' | 'yearJob'>('prep');
  const [readerCategoryFilter, setReaderCategoryFilter] = useState('সব প্রশ্ন');

  // Bookmark specific states
  const [selectedBookmarkFolder, setSelectedBookmarkFolder] = useState<string | null>(null);
  const [bookmarkViewPage, setBookmarkViewPage] = useState(1);
  const [showBookmarkExplanation, setShowBookmarkExplanation] = useState<Record<string, boolean>>({});
  const [bookmarkSelectedAnswers, setBookmarkSelectedAnswers] = useState<Record<string, string>>({});

  // Question correction comment & user suggestion states
  const [popupExplanationQ, setPopupExplanationQ] = useState<Question | null>(null);
  const [flagModalQ, setFlagModalQ] = useState<Question | null>(null);
  const [flagCommentText, setFlagCommentText] = useState('');
  const [userExplModalQ, setUserExplModalQ] = useState<Question | null>(null);
  const [userExplText, setUserExplText] = useState('');

  // Challenge Modal State
  const [challengeModalData, setChallengeModalData] = useState<{ exam: LiveExam; score: number } | null>(null);

  // Routine Tab Filter & Multi-Page Hierarchy Navigation States
  // Level 1: Course Main Cards -> Level 2: Date-wise Routine List -> Level 3: Syllabus & Chapter MCQ Page
  const [routineBatchFilter, setRoutineBatchFilter] = useState<'all' | 'open' | 'enrolled' | 'unrolled'>('all');
  const [routineSearchQuery, setRoutineSearchQuery] = useState('');
  const [selectedRoutineCourseId, setSelectedRoutineCourseId] = useState<string | null>(null);
  const [selectedRoutineItem, setSelectedRoutineItem] = useState<Routine | null>(null);

  // Helper to format Bengali Date with Starting Time (e.g. ১২ মে, ২০২৬ (সকাল ১০:০০ টা))
  const formatExamScheduleWithTime = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const months = [
        'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
        'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
      ];
      const bnDigits = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];
      const toBn = (num: number | string) => num.toString().replace(/\d/g, x => bnDigits[parseInt(x)]);
      
      const day = toBn(d.getDate());
      const month = months[d.getMonth()];
      const year = toBn(d.getFullYear());

      const hours = d.getHours();
      const minutes = d.getMinutes();
      let period = 'সকাল';
      if (hours >= 12 && hours < 15) period = 'দুপুর';
      else if (hours >= 15 && hours < 18) period = 'বিকাল';
      else if (hours >= 18 && hours < 20) period = 'সন্ধ্যা';
      else if (hours >= 20 || hours < 6) period = 'রাত';

      const displayHours = hours % 12 || 12;
      const timeFormatted = `${period} ${toBn(displayHours)}:${minutes < 10 ? '০' : ''}${toBn(minutes)} টা`;

      return `${day} ${month}, ${year} (${timeFormatted})`;
    } catch {
      return dateStr;
    }
  };

  // Group routines by course so each course has strictly ONE main card (Level 1)
  const courseRoutineGroups = useMemo(() => {
    const groupMap = new Map<string, {
      courseId: string;
      courseTitle: string;
      category?: string;
      routines: Routine[];
      isEnrolled: boolean;
      batchType: 'open' | 'enrolled' | 'unrolled';
      nextExamDateStr: string;
      hasLiveExam: boolean;
    }>();

    // 1. Initialize from registered courses
    (courses || []).forEach(c => {
      const isEnrolled = enrolledCourseIds.includes(c.id);
      groupMap.set(c.id, {
        courseId: c.id,
        courseTitle: c.title,
        category: c.category,
        routines: [],
        isEnrolled,
        batchType: isEnrolled ? 'enrolled' : 'unrolled',
        nextExamDateStr: '',
        hasLiveExam: false,
      });
    });

    // 2. Assign routines to courses
    const unassignedRoutines: Routine[] = [];
    (routines || []).forEach(r => {
      let matchedCourseKey: string | null = null;
      if (r.courseId && groupMap.has(r.courseId)) {
        matchedCourseKey = r.courseId;
      } else if (r.courseName) {
        const foundCourse = (courses || []).find(
          c => c.title.trim().toLowerCase() === r.courseName!.trim().toLowerCase()
        );
        if (foundCourse) {
          matchedCourseKey = foundCourse.id;
        }
      }

      if (matchedCourseKey) {
        groupMap.get(matchedCourseKey)!.routines.push(r);
      } else if (r.courseName && r.courseName.trim()) {
        const virtualKey = `named_${r.courseName.trim().toLowerCase()}`;
        if (!groupMap.has(virtualKey)) {
          groupMap.set(virtualKey, {
            courseId: virtualKey,
            courseTitle: r.courseName.trim(),
            category: 'কোর্স রুটিন',
            routines: [],
            isEnrolled: false,
            batchType: 'open',
            nextExamDateStr: '',
            hasLiveExam: false,
          });
        }
        groupMap.get(virtualKey)!.routines.push(r);
      } else {
        unassignedRoutines.push(r);
      }
    });

    // 3. Group any remaining open/unassigned routines into an Open Batch course card
    if (unassignedRoutines.length > 0) {
      groupMap.set('open_general_course', {
        courseId: 'open_general_course',
        courseTitle: 'উন্মুক্ত / সাধারণ রুটিন (Open Batch)',
        category: 'উন্মুক্ত প্রস্তুতি',
        routines: unassignedRoutines,
        isEnrolled: true,
        batchType: 'open',
        nextExamDateStr: '',
        hasLiveExam: false,
      });
    }

    // 4. Calculate next upcoming exam date and live status for each course card
    const result = Array.from(groupMap.values()).filter(g => g.routines.length > 0);

    result.forEach(g => {
      const now = Date.now();
      let nextExamTimeStr = '';
      let minFutureDiff = Infinity;
      let fallbackDateStr = '';
      let hasLive = false;

      // Sort routines chronologically
      g.routines.sort((a, b) => {
        const timeA = new Date(a.examConfig?.startTime || a.examDate || a.createdAt || 0).getTime();
        const timeB = new Date(b.examConfig?.startTime || b.examDate || b.createdAt || 0).getTime();
        return timeA - timeB;
      });

      g.routines.forEach(r => {
        const startTime = r.examConfig?.startTime;
        const examDate = r.examDate || r.createdAt;

        if (r.examConfig?.enabled && startTime) {
          const examTime = new Date(startTime).getTime();
          if (!isNaN(examTime)) {
            if (examTime >= now && (examTime - now) < minFutureDiff) {
              minFutureDiff = examTime - now;
              nextExamTimeStr = formatExamScheduleWithTime(startTime);
            }
            if (examTime <= now && r.examConfig.expiryTime && new Date(r.examConfig.expiryTime).getTime() > now) {
              hasLive = true;
            }
          }
        }

        if (!fallbackDateStr) {
          if (startTime) {
            fallbackDateStr = formatExamScheduleWithTime(startTime);
          } else if (examDate) {
            fallbackDateStr = formatBengaliDate(examDate);
          }
        }
      });

      g.nextExamDateStr = nextExamTimeStr || fallbackDateStr || 'শিডিউল অনুযায়ী';
      g.hasLiveExam = hasLive;
    });

    return result;
  }, [courses, routines, enrolledCourseIds]);

  useEffect(() => {
    const userKey = user?.userId || user?.phone || 'guest';
    const saved = localStorage.getItem(`orjon_enrolled_courses_${userKey}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setEnrolledCourseIds(parsed);
      } catch {
        setEnrolledCourseIds([]);
      }
    } else {
      setEnrolledCourseIds([]);
    }
  }, [user?.userId, user?.phone]);

  // Custom Exam Setup & Cascading Filter States
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [setupQLimit, setSetupQLimit] = useState(10);
  const [setupTimeLimit, setSetupTimeLimit] = useState(10); // in minutes
  const [setupAnswerView, setSetupAnswerView] = useState<'instant' | 'after_exam'>('after_exam');
  const [revisionMode, setRevisionMode] = useState(false); // revision only wrong questions
  const [userCsvQualifier, setUserCsvQualifier] = useState<string>('"');
  const [customExamOverridePool, setCustomExamOverridePool] = useState<Question[] | null>(null);
  const [customExamTitle, setCustomExamTitle] = useState<string>('');

  // Profile Settings Modal State
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [editName, setEditName] = useState(user.name || '');
  const [editPhone, setEditPhone] = useState(user.phone || '');
  const [editEducation, setEditEducation] = useState(user.education || 'উচ্চ মাধ্যমিক/সমমান');
  const [editAvatar, setEditAvatar] = useState(user.avatar || '');
  const [editPassword, setEditPassword] = useState('');
  const [editConfirmPassword, setEditConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);
  const [profileErrorMsg, setProfileErrorMsg] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    if (user) {
      setEditName(user.name || '');
      setEditPhone(user.phone || '');
      setEditEducation(user.education || 'উচ্চ মাধ্যমিক/সমমান');
      setEditAvatar(user.avatar || '');
    }
  }, [user]);

  const openProfileModal = () => {
    setEditName(user.name || '');
    setEditPhone(user.phone || '');
    setEditEducation(user.education || 'উচ্চ মাধ্যমিক/সমমান');
    setEditAvatar(user.avatar || '');
    setEditPassword('');
    setEditConfirmPassword('');
    setShowPassword(false);
    setPhotoError(null);
    setProfileSuccessMsg(null);
    setProfileErrorMsg(null);
    setProfileModalOpen(true);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_SIZE_BYTES = 100 * 1024; // 100 KB limit
    if (file.size > MAX_SIZE_BYTES) {
      setPhotoError(`Selected file size is ${(file.size / 1024).toFixed(1)} KB. Maximum allowed size is 100 KB.`);
      e.target.value = '';
      return;
    }

    setPhotoError(null);
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setEditAvatar(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileErrorMsg(null);
    setProfileSuccessMsg(null);

    if (!editName.trim()) {
      setProfileErrorMsg('দয়া করে আপনার নাম প্রদান করুন।');
      return;
    }

    if (!editEducation.trim()) {
      setProfileErrorMsg('দয়া করে আপনার শিক্ষাগত যোগ্যতা প্রদান করুন।');
      return;
    }

    if (editPassword.trim()) {
      if (editPassword.length < 6) {
        setProfileErrorMsg('পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে।');
        return;
      }
      if (editPassword !== editConfirmPassword) {
        setProfileErrorMsg('নতুন পাসওয়ার্ড এবং কনফার্ম পাসওয়ার্ড মিলছে না।');
        return;
      }
    }

    if (photoError) {
      setProfileErrorMsg('দয়া করে সর্বোচ্চ ১০০ KB সাইজের ছবি নির্বাচন করুন।');
      return;
    }

    setIsSavingProfile(true);

    try {
      const updatedUser: User = {
        ...user,
        name: editName.trim(),
        phone: editPhone.trim(),
        education: editEducation.trim(),
        avatar: editAvatar.trim() || user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
        ...(editPassword.trim() ? { password: editPassword.trim() } : {})
      };

      if (onUpdateUser) {
        await onUpdateUser(updatedUser);
      }

      setProfileSuccessMsg('প্রোফাইল তথ্য সফলভাবে আপডেট হয়েছে!');
      setTimeout(() => {
        setProfileModalOpen(false);
        setProfileSuccessMsg(null);
      }, 1200);
    } catch (err: any) {
      setProfileErrorMsg(err?.message || 'প্রোফাইল আপডেট করতে সমস্যা হয়েছে।');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Cascading Filter Selection States
  const [customExamSelectedCat, setCustomExamSelectedCat] = useState<string>('ALL');
  const [customExamSelectedSubcat, setCustomExamSelectedSubcat] = useState<string>('ALL');
  const [customExamSelectedSubSubcat, setCustomExamSelectedSubSubcat] = useState<string>('ALL');

  // Active Quiz State (When exam is running)
  const [quizActive, setQuizActive] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);
  const [quizTitle, setQuizTitle] = useState('');
  const [quizExamId, setQuizExamId] = useState('');
  const [quizTimeLimitMinutes, setQuizTimeLimitMinutes] = useState<number | 'unlimited'>('unlimited');
  const [quizAnswerMode, setQuizAnswerMode] = useState<'instant' | 'after_exam'>('after_exam');
  
  const [quizPage, setQuizPage] = useState(1);
  const [quizFilterMode, setQuizFilterMode] = useState<'all' | 'answered' | 'unanswered'>('all');
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [userSelectedAnswers, setUserSelectedAnswers] = useState<Record<number, string>>({});
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [isQuizTimerRunning, setIsQuizTimerRunning] = useState(false);

  // Bookmark folder selection popup
  const [bookmarkModalOpen, setBookmarkModalOpen] = useState(false);
  const [selectedBookmarkQId, setSelectedBookmarkQId] = useState<string | null>(null);
  const [bookmarkFolder, setBookmarkFolder] = useState('সাধারণ বুকমার্ক');
  const [customFolderInput, setCustomFolderInput] = useState('');
  const [isCustomFolder, setIsCustomFolder] = useState(false);

  // History detailed sheet view state
  const [selectedAttemptForView, setSelectedAttemptForView] = useState<Attempt | null>(null);
  const [includeMarkTableInPDF, setIncludeMarkTableInPDF] = useState(true);
  const [resultFilterMode, setResultFilterMode] = useState<'user' | 'admin'>('user');

  // Guest Limitation Guard & Helpers
  const checkGuestAccess = (featureName: string = 'এই ফিচারটি'): boolean => {
    if (user.isGuest) {
      showCustomAlert(
        `🔒 রেজিস্ট্রেশন প্রয়োজন!\n\nগেস্ট (Guest) হিসেবে ক্যাটাগরি ও সাব-ক্যাটাগরি দেখা গেলেও MCQ পড়া ও পরীক্ষা দেওয়ার জন্য বিনামূল্যে অ্যাকাউন্ট রেজিস্ট্রেশন সম্পন্ন করুন।\n\n${featureName} অ্যাক্সেস করতে রেজিস্ট্রেশন করুন।`,
        () => {
          if (onRegisterPrompt) onRegisterPrompt();
        },
        '🔒 রেজিস্ট্রেশন প্রয়োজন',
        true,
        'রেজিস্ট্রেশন করুন',
        'এখন নয়'
      );
      return false;
    }
    return true;
  };

  const handleTabSelect = (tab: 'dashboard' | 'preparation' | 'job' | 'yearJob' | 'bookmarks' | 'exams' | 'results' | 'courses' | 'routines' | 'profile' | 'currentAffairs') => {
    if (user.isGuest && (tab === 'bookmarks' || tab === 'routines')) {
      checkGuestAccess(
        tab === 'bookmarks' ? 'সেভকৃত বুকমার্কস' : 'একাডেমিক রুটিন'
      );
      return;
    }
    if (tab === 'courses') {
      setSelectedCourseFilter(enrolledCourseIds.length > 0 ? 'enrolled' : 'all');
    }
    if (tab === 'routines') {
      setSelectedRoutineCourseId(null);
      setSelectedRoutineItem(null);
    }
    setActiveTab(tab);
  };

  const renderGuestLockCard = (title: string, description: string) => (
    <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 text-white rounded-3xl p-6 sm:p-10 my-4 shadow-xl border border-indigo-700/50 text-center space-y-5 animate-fade-in max-w-2xl mx-auto">
      <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center text-3xl mx-auto backdrop-blur-sm border border-white/20 shadow-md">
        🔒
      </div>
      <div className="space-y-2.5">
        <span className="text-[10px] font-black uppercase text-amber-300 tracking-wider bg-amber-500/20 px-3 py-1 rounded-full border border-amber-400/30 inline-block">
          গেস্ট মোড সীমাবদ্ধতা
        </span>
        <h3 className="text-base sm:text-xl font-extrabold text-white">
          {title}
        </h3>
        <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed max-w-lg mx-auto">
          {description}
        </p>
      </div>
      <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center items-center">
        <button
          onClick={() => onRegisterPrompt ? onRegisterPrompt() : onLogout()}
          className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black text-xs sm:text-sm rounded-2xl shadow-lg hover:shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>🚀</span> বিনামূল্যে রেজিস্ট্রেশন সম্পূর্ণ করুন
        </button>
        <button
          onClick={() => setActiveTab('dashboard')}
          className="w-full sm:w-auto px-6 py-3.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm rounded-2xl transition-all border border-white/20 cursor-pointer"
        >
          এখন নয়
        </button>
      </div>
    </div>
  );

  // Stack Unwinding Engine: unwinds one layer of navigation/state stack.
  const handleStackUnwind = (): boolean => {
    // 1. Close alert or confirm modal if open
    if (customAlert && customAlert.open) {
      setCustomAlert(null);
      return true;
    }
    if (customConfirm && customConfirm.open) {
      setCustomConfirm(null);
      return true;
    }

    // 2. Modals and Popups
    if (popupExplanationQ) {
      setPopupExplanationQ(null);
      return true;
    }
    if (flagModalQ) {
      setFlagModalQ(null);
      return true;
    }
    if (userExplModalQ) {
      setUserExplModalQ(null);
      return true;
    }
    if (bookmarkModalOpen) {
      setBookmarkModalOpen(false);
      return true;
    }
    if (drawerOpen) {
      setDrawerOpen(false);
      return true;
    }
    if (setupModalOpen) {
      setSetupModalOpen(false);
      return true;
    }

    // 3. Sub-views / Full screen modes
    if (quizActive) {
      showCustomConfirm(
        'আপনি কি নিশ্চিতভাবে বর্তমান পরীক্ষা থেকে বের হতে চান?\nবেরিয়ে গেলে পরীক্ষার অগ্রগতি হারিয়ে যাবে।',
        () => {
          setQuizActive(false);
          setIsQuizTimerRunning(false);
        },
        undefined,
        'চলমান পরীক্ষা স্থগিত'
      );
      return true;
    }

    if (syllabusModalRoutine) {
      setSyllabusModalRoutine(null);
      return true;
    }

    if (viewingHierarchyRoutine) {
      setViewingHierarchyRoutine(null);
      return true;
    }

    if (readerModeActive) {
      setReaderModeActive(false);
      return true;
    }

    if (selectedAttemptForView) {
      setSelectedAttemptForView(null);
      return true;
    }

    if (selectedBookmarkFolder) {
      setSelectedBookmarkFolder(null);
      return true;
    }

    // 4. Hierarchical path steps
    if (activeTab === 'preparation' && prepPath.length > 0) {
      setPrepPath(prev => prev.slice(0, -1));
      return true;
    }

    if (activeTab === 'job' && jobPath.length > 0) {
      setJobPath(prev => prev.slice(0, -1));
      return true;
    }

    if (activeTab === 'yearJob' && yearJobPath.length > 0) {
      setYearJobPath(prev => prev.slice(0, -1));
      return true;
    }

    // 5. Non-dashboard tab
    if (activeTab !== 'dashboard') {
      setActiveTab('dashboard');
      return true;
    }

    // At root dashboard level! Return false so caller knows we are at root
    return false;
  };

  // Keep a ref to handleStackUnwind so popstate callback always accesses fresh closures
  const stackUnwindRef = useRef(handleStackUnwind);
  stackUnwindRef.current = handleStackUnwind;

  useEffect(() => {
    // Push initial history state to capture browser back button
    window.history.pushState({ orjonPortal: true }, '', window.location.href);

    const handlePopState = () => {
      // Re-push history state immediately to lock page and prevent exiting
      window.history.pushState({ orjonPortal: true }, '', window.location.href);

      // Perform stack unwinding
      const unwound = stackUnwindRef.current();
      if (!unwound) {
        // At root level: trigger logout confirmation modal!
        onLogout();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [onLogout]);

  useEffect(() => {
    if (directExamId && liveExams.length > 0) {
      const targetExam = liveExams.find(e => e.id === directExamId);
      if (targetExam) {
        setActiveTab('exams');
        startOfficialLiveExam(targetExam);
      }
    }
  }, [directExamId, liveExams]);

  const handleDownloadPDF = (attempt: Attempt, includeMarkCalcTable: boolean = true) => {
    if (user.isGuest) {
      showCustomAlert(
        'গেস্ট (Guest) হিসেবে পরীক্ষা দিলে PDF ডাউনলোড করার সুযোগ নেই।\n\nবিনামূল্যে একটি একাউন্ট রেজিস্ট্রেশন করলে আপনার সকল আগের পরীক্ষার উত্তরপত্র ও PDF রেজাল্ট কার্ড ডাউনলোড করতে পারবেন!',
        undefined,
        '🔒 PDF ডাউনলোডে সীমাবদ্ধতা'
      );
      return;
    }
    const attemptQuestions = 
      (attempt.activeQuizQuestions && attempt.activeQuizQuestions.length > 0)
        ? attempt.activeQuizQuestions
        : ((attempt as any).questionIds && (attempt as any).questionIds.length > 0)
          ? questions.filter(q => (attempt as any).questionIds.includes(q.id))
          : (attempt.incorrectQuestionIds && attempt.incorrectQuestionIds.length > 0)
            ? questions.filter(q => attempt.incorrectQuestionIds.includes(q.id))
            : [];

    const totalQ = attempt.totalQuestions || attemptQuestions.length || 1;
    const correctC = attempt.correctCount || 0;
    const wrongC = attempt.wrongCount || 0;
    const skippedC = Math.max(0, totalQ - correctC - wrongC);
    const accuracy = Math.round((correctC / totalQ) * 100);

    const correctMarks = (correctC * 1.0).toFixed(2);
    const negativeDeduction = (wrongC * 0.5).toFixed(2);
    const netScore = attempt.score;
    const subjectBreakdown = calculateSubjectWiseAnalysis(attemptQuestions, attempt);

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="bn">
      <head>
        <meta charset="UTF-8">
        <title>পরীক্ষার ফলাফল - ${attempt.examTitle}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&display=swap');
          body {
            font-family: 'Hind Siliguri', 'Kalpurush', sans-serif;
            margin: 25px;
            color: #0f172a;
            line-height: 1.5;
            background: #ffffff;
          }
          .header-box {
            border-bottom: 2px solid #4f46e5;
            padding-bottom: 12px;
            margin-bottom: 16px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .brand-title {
            font-size: 20px;
            font-weight: 800;
            color: #312e81;
            margin: 0;
          }
          .brand-sub {
            font-size: 13px;
            color: #64748b;
            margin-top: 2px;
          }
          .user-info-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 12px 16px;
            margin-bottom: 16px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            font-size: 13px;
          }
          .info-item {
            display: flex;
            gap: 6px;
          }
          .info-label {
            font-weight: 700;
            color: #475569;
          }
          .info-val {
            font-weight: 800;
            color: #0f172a;
          }
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 10px;
            margin-bottom: 20px;
            text-align: center;
          }
          .summary-card {
            border: 1px solid #e2e8f0;
            padding: 10px 6px;
            border-radius: 8px;
            background: #fafafa;
          }
          .summary-label {
            font-size: 11px;
            font-weight: 600;
            color: #64748b;
          }
          .summary-val {
            font-size: 16px;
            font-weight: 800;
            margin-top: 4px;
          }
          .mark-calc-box {
            background: #f8fafc;
            border: 1.5px solid #cbd5e1;
            border-radius: 10px;
            padding: 12px 16px;
            margin-bottom: 20px;
            page-break-inside: avoid;
          }
          .mark-calc-title {
            font-size: 13.5px;
            font-weight: 800;
            color: #1e1b4b;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 6px;
            margin-bottom: 10px;
          }
          .mark-calc-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
          }
          .mark-calc-table th {
            background: #f1f5f9;
            color: #334155;
            font-weight: 700;
            padding: 7px 10px;
            border: 1px solid #cbd5e1;
            text-align: center;
          }
          .mark-calc-table td {
            padding: 7px 10px;
            border: 1px solid #e2e8f0;
            text-align: center;
            color: #0f172a;
          }
          .mark-calc-table tr.total-row {
            background: #e0e7ff;
          }
          .mark-calc-table tr.total-row td {
            border-top: 2px solid #4f46e5;
            font-weight: 800;
          }
          .section-title {
            font-size: 15px;
            font-weight: 800;
            color: #1e1b4b;
            border-bottom: 1.5px solid #e2e8f0;
            padding-bottom: 6px;
            margin-bottom: 14px;
          }
          .question-card {
            border: 1px solid #e2e8f0;
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 12px;
            page-break-inside: avoid;
          }
          .q-title {
            font-weight: 700;
            font-size: 13px;
            margin-bottom: 8px;
            color: #0f172a;
          }
          .options-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px;
            font-size: 12px;
            color: #334155;
            margin-bottom: 8px;
            background: #f8fafc;
            padding: 8px;
            border-radius: 6px;
          }
          .option-correct {
            font-weight: 700;
            color: #15803d;
          }
          .ans-box {
            padding: 6px 10px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 700;
            margin-bottom: 6px;
          }
          .ans-correct { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
          .ans-wrong { background: #fff1f2; color: #9f1239; border: 1px solid #fecdd3; }
          .explanation {
            background: #eef2ff;
            border: 1px solid #c7d2fe;
            padding: 8px 10px;
            border-radius: 6px;
            font-size: 11.5px;
            color: #1e1b4b;
            line-height: 1.5;
          }
          @media print {
            body { margin: 12px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header-box">
          <div>
            <h1 class="brand-title">অর্জন - পরীক্ষার পূর্ণাঙ্গ ফলাফল ও বিবরণী</h1>
            <div class="brand-sub">পরীক্ষা: ${attempt.examTitle}</div>
          </div>
          <div style="text-align: right; font-size: 12px; color: #64748b;">
            তারিখ: ${new Date(attempt.submittedAt).toLocaleString('bn-BD')}
          </div>
        </div>

        <div class="user-info-card">
          <div class="info-item">
            <span class="info-label">শিক্ষার্থীর নাম:</span>
            <span class="info-val">${user.name || 'শিক্ষার্থী'}</span>
          </div>
          <div class="info-item">
            <span class="info-label">ইউজার আইডি:</span>
            <span class="info-val">${user.userId || '—'}</span>
          </div>
          <div class="info-item">
            <span class="info-label">পরীক্ষার শিরোনাম:</span>
            <span class="info-val">${attempt.examTitle}</span>
          </div>
          <div class="info-item">
            <span class="info-label">নির্ভুলতার হার:</span>
            <span class="info-val">${accuracy}%</span>
          </div>
        </div>

        <div class="summary-grid">
          <div class="summary-card">
            <div class="summary-label">মোট প্রশ্ন</div>
            <div class="summary-val" style="color: #334155;">${totalQ}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">সঠিক উত্তর</div>
            <div class="summary-val" style="color: #16a34a;">${correctC}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">ভুল উত্তর</div>
            <div class="summary-val" style="color: #dc2626;">${wrongC}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">অনুত্তর / স্কিপড</div>
            <div class="summary-val" style="color: #d97706;">${skippedC}</div>
          </div>
          <div class="summary-card">
            <div class="summary-label">অর্জিত নম্বর</div>
            <div class="summary-val" style="color: #4f46e5;">${attempt.score}</div>
          </div>
        </div>

        ${includeMarkCalcTable ? `
          <div class="mark-calc-box">
            <div class="mark-calc-title">📚 বিষয়ভিত্তিক নম্বর ও সঠিক-ভুল বিবরণী (Subject-wise Marking & Result Breakdown)</div>
            <table class="mark-calc-table">
              <thead>
                <tr>
                  <th style="text-align: left;">বিষয় (Subject)</th>
                  <th>মোট প্রশ্ন (Total)</th>
                  <th style="color: #166534;">সঠিক (Right)</th>
                  <th style="color: #9f1239;">ভুল (Wrong)</th>
                  <th style="color: #92400e;">স্কিপড (Skipped)</th>
                  <th style="text-align: right;">মোট নম্বর (Total Marks)</th>
                </tr>
              </thead>
              <tbody>
                ${subjectBreakdown.map(item => `
                  <tr>
                    <td style="text-align: left; font-weight: 700; color: #1e1b4b;">📖 ${item.subject}</td>
                    <td style="font-weight: 700;">${item.totalQuestions}টি</td>
                    <td style="color: #16a34a; font-weight: 700;">${item.right}টি</td>
                    <td style="color: #dc2626; font-weight: 700;">${item.wrong}টি</td>
                    <td style="color: #d97706; font-weight: 700;">${item.skipped}টি</td>
                    <td style="text-align: right; font-weight: 800; color: ${item.totalMarks >= 0 ? '#4338ca' : '#dc2626'};">
                      ${item.totalMarks > 0 ? '+' : ''}${item.totalMarks.toFixed(2)}
                    </td>
                  </tr>
                `).join('')}
                <tr class="total-row">
                  <td style="text-align: left; font-weight: 800; color: #1e1b4b;">🏆 সর্বমোট (Total)</td>
                  <td style="font-weight: 800; color: #1e1b4b;">${totalQ}টি</td>
                  <td style="color: #16a34a; font-weight: 800;">${correctC}টি</td>
                  <td style="color: #dc2626; font-weight: 800;">${wrongC}টি</td>
                  <td style="color: #d97706; font-weight: 800;">${skippedC}টি</td>
                  <td style="text-align: right; font-weight: 800; color: #312e81; font-size: 13px;">${netScore}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ` : ''}

        <div class="section-title">প্রশ্নোত্তর ও ব্যাখ্যামূলক বিশ্লেষণ</div>

        ${attemptQuestions.map((q, i) => {
          const selectedAnsKey = 
            attempt.userSelectedAnswers?.[i] || 
            attempt.userSelectedAnswers?.[q.id as any] || 
            (attempt as any).answers?.[q.id] || 
            (attempt as any).answers?.[i];

          const isCorrect = Boolean(selectedAnsKey && q?.correct && selectedAnsKey === q.correct);
          const correctText = (q && q.correct && typeof q.correct === 'string') ? (q as any)[q.correct.replace('Option ', 'option')] || '' : '';
          const userAnsText = (selectedAnsKey && typeof selectedAnsKey === 'string' && selectedAnsKey.includes('Option'))
            ? (q as any)[selectedAnsKey.replace('Option ', 'option')] || ''
            : (selectedAnsKey === 'Skipped' ? 'স্কিপড' : 'উত্তর দেওয়া হয়নি');

          const masterQ = questions.find(mq => mq.id === q.id) || q;
          const expl = masterQ.explanation || q.explanation;

          return `
            <div class="question-card">
              <div class="q-title">${(i + 1).toLocaleString('bn-BD')}. ${q.text}</div>
              <div class="options-grid">
                <div class="${q.correct === 'Option A' ? 'option-correct' : ''}">ক) ${q.optionA}</div>
                <div class="${q.correct === 'Option B' ? 'option-correct' : ''}">খ) ${q.optionB}</div>
                <div class="${q.correct === 'Option C' ? 'option-correct' : ''}">গ) ${q.optionC}</div>
                <div class="${q.correct === 'Option D' ? 'option-correct' : ''}">ঘ) ${q.optionD}</div>
              </div>
              <div class="ans-box ${isCorrect ? 'ans-correct' : 'ans-wrong'}">
                আপনার উত্তর: ${userAnsText} ${!isCorrect ? ` | সঠিক উত্তর: ${correctText}` : ''}
              </div>
              ${expl ? `<div class="explanation"><strong>💡 ব্যাখ্যা:</strong> ${expl}</div>` : ''}
            </div>
          `;
        }).join('')}

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Tree helper to find all descendants of a category/subcategory name recursively (queue-based)
  const getDescendants = (nodeName: string): string[] => {
    const descendants: string[] = [];
    const queue = [nodeName.trim().toLowerCase()];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const children = subcategories.filter(s => 
        s.parentCategory && s.parentCategory.trim().toLowerCase() === current
      );

      children.forEach(child => {
        const trimmedChild = child.name.trim();
        const lowerChild = trimmedChild.toLowerCase();
        if (!visited.has(lowerChild) && !descendants.some(d => d.trim().toLowerCase() === lowerChild)) {
          descendants.push(trimmedChild);
          queue.push(lowerChild);
        }
      });
    }
    return descendants;
  };

  const getQuestionsForPrepNode = (nodeName: string, isRoot: boolean): Question[] => {
    if (isRoot) {
      return questions;
    }
    const normalizedNode = nodeName.trim().toLowerCase();
    const descendants = getDescendants(nodeName).map(d => d.toLowerCase());

    return questions.filter(q => {
      // 1. Check primary single fields
      const qCat = q.category ? q.category.trim().toLowerCase() : '';
      const qSub = q.subcategory ? q.subcategory.trim().toLowerCase() : '';
      const qCsv = q.csvCategory ? q.csvCategory.trim().toLowerCase() : '';

      if (qCat === normalizedNode || descendants.includes(qCat)) return true;
      if (qSub && (qSub === normalizedNode || descendants.includes(qSub))) return true;
      if (qCsv && (qCsv === normalizedNode || descendants.includes(qCsv))) return true;

      // 2. Check multiple categories array
      if (q.categories && q.categories.some(c => {
        const normC = c.trim().toLowerCase();
        return normC === normalizedNode || descendants.includes(normC);
      })) {
        return true;
      }

      // 3. Check multiple subcategories array
      if (q.subcategories && q.subcategories.some(s => {
        const normS = s.trim().toLowerCase();
        return normS === normalizedNode || descendants.includes(normS);
      })) {
        return true;
      }

      return false;
    });
  };

  const getQuestionsForJobNode = (nodeName: string, isRoot: boolean): Question[] => {
    if (isRoot) {
      return questions.filter(q => q.subcategory || (q.subcategories && q.subcategories.length > 0));
    }
    const normalizedNode = nodeName.trim().toLowerCase();
    const descendants = getDescendants(nodeName).map(d => d.toLowerCase());

    return questions.filter(q => {
      // 1. Check primary single fields
      const qCat = q.category ? q.category.trim().toLowerCase() : '';
      const qSub = q.subcategory ? q.subcategory.trim().toLowerCase() : '';
      const qCsv = q.csvCategory ? q.csvCategory.trim().toLowerCase() : '';

      if (qCat === normalizedNode || descendants.includes(qCat)) return true;
      if (qSub && (qSub === normalizedNode || descendants.includes(qSub))) return true;
      if (qCsv && (qCsv === normalizedNode || descendants.includes(qCsv))) return true;

      // 2. Check multiple categories array
      if (q.categories && q.categories.some(c => {
        const normC = c.trim().toLowerCase();
        return normC === normalizedNode || descendants.includes(normC);
      })) {
        return true;
      }

      // 3. Check multiple subcategories array
      if (q.subcategories && q.subcategories.some(s => {
        const normS = s.trim().toLowerCase();
        return normS === normalizedNode || descendants.includes(normS);
      })) {
        return true;
      }

      return false;
    });
  };

  const getQuestionsForYearJobNode = (nodeName: string, isRoot: boolean): Question[] => {
    if (isRoot) {
      return questions.filter(q => isYearJobSolutionVariation(q.category) || (q.subcategory || (q.subcategories && q.subcategories.length > 0)));
    }
    const normalizedNode = nodeName.trim().toLowerCase();
    const descendants = getDescendants(nodeName).map(d => d.toLowerCase());

    return questions.filter(q => {
      // 1. Check primary single fields
      const qCat = q.category ? q.category.trim().toLowerCase() : '';
      const qSub = q.subcategory ? q.subcategory.trim().toLowerCase() : '';
      const qCsv = q.csvCategory ? q.csvCategory.trim().toLowerCase() : '';

      if (qCat === normalizedNode || descendants.includes(qCat)) return true;
      if (qSub && (qSub === normalizedNode || descendants.includes(qSub))) return true;
      if (qCsv && (qCsv === normalizedNode || descendants.includes(qCsv))) return true;

      // 2. Check multiple categories array
      if (q.categories && q.categories.some(c => {
        const normC = c.trim().toLowerCase();
        return normC === normalizedNode || descendants.includes(normC);
      })) {
        return true;
      }

      // 3. Check multiple subcategories array
      if (q.subcategories && q.subcategories.some(s => {
        const normS = s.trim().toLowerCase();
        return normS === normalizedNode || descendants.includes(normS);
      })) {
        return true;
      }

      return false;
    });
  };

  // General computed stats
  const totalUserExams = attempts.length;
  const totalNetScore = attempts.reduce((sum, a) => sum + a.score, 0);
  const totalExamQuestions = attempts.reduce((sum, a) => sum + (a.totalQuestions || 0), 0);
  const avgScore = totalUserExams > 0 ? Math.round((totalNetScore / totalUserExams) * 10) / 10 : 0;
  const netMarkPercentage = totalExamQuestions > 0 ? Math.max(0, Math.round((totalNetScore / totalExamQuestions) * 1000) / 10) : 0;
  const bookmarksCount = bookmarks.length;

  const distinctCategories = Array.from(new Set((categories || []).length > 0 ? (categories || []).map(c => (c?.name || '').trim()) : (questions || []).map(q => (q?.category || '').trim()))).filter(Boolean);
  const distinctSubcategories = Array.from(new Set((subcategories || []).length > 0 ? (subcategories || []).map(s => (s?.name || '').trim()) : ((questions || []).map(q => (q?.subcategory || '').trim()).filter(Boolean) as string[]))).filter(Boolean);

  // Generate incorrect questions checklist
  const allIncorrectQuestionIds = Array.from(new Set(attempts.flatMap(a => a.incorrectQuestionIds)));
  const incorrectQuestions = questions.filter(q => allIncorrectQuestionIds.includes(q.id));

  // Category analytics compilation for dashboard chart
  const categoryAnalytics: Record<string, { correct: number; total: number }> = {};
  attempts.forEach(a => {
    if (a.categoryAnalysis) {
      Object.entries(a.categoryAnalysis).forEach(([cat, data]) => {
        if (!categoryAnalytics[cat]) {
          categoryAnalytics[cat] = { correct: 0, total: 0 };
        }
        categoryAnalytics[cat].correct += data.correct;
        categoryAnalytics[cat].total += data.total;
      });
    }
  });

  // Calculate strong/weak categories
  let strongCategory = 'পর্যাপ্ত তথ্য নেই';
  let weakCategory = 'পর্যাপ্ত তথ্য নেই';
  let highestRatio = -1;
  let lowestRatio = 2;

  Object.entries(categoryAnalytics).forEach(([cat, data]) => {
    if (data.total >= 3) {
      const ratio = data.correct / data.total;
      if (ratio > highestRatio) {
        highestRatio = ratio;
        strongCategory = `${cat} (${Math.round(ratio * 100)}% সঠিক)`;
      }
      if (ratio < lowestRatio) {
        lowestRatio = ratio;
        weakCategory = `${cat} (${Math.round(ratio * 100)}% সঠিক)`;
      }
    }
  });

  // Countdown clock effect
  useEffect(() => {
    let interval: any = null;
    if (isQuizTimerRunning && secondsRemaining > 0 && quizActive) {
      interval = setInterval(() => {
        setSecondsRemaining(prev => prev - 1);
      }, 1000);
    } else if (isQuizTimerRunning && secondsRemaining === 0 && quizActive) {
      setIsQuizTimerRunning(false);
      handleForceEndExam();
    }
    return () => clearInterval(interval);
  }, [isQuizTimerRunning, secondsRemaining, quizActive]);

  // Quiz helper functions
  const startPrepExam = async (categoryName: string, overrideQuestions?: Question[]) => {
    if (!checkGuestAccess('বিষয়ভিত্তিক প্রস্তুতি পরীক্ষা')) return;
    let filtered = overrideQuestions || questions.filter(q => 
      q.category === categoryName || (q.categories && q.categories.includes(categoryName))
    );
    if (filtered.length === 0 && onFetchQuestionsLazy && !overrideQuestions) {
      const fetched = await onFetchQuestionsLazy({ category: categoryName });
      filtered = fetched.filter(q => q.category === categoryName || (q.categories && q.categories.includes(categoryName)));
    }
    if (filtered.length === 0) {
      showCustomAlert('কোনো প্রশ্ন পাওয়া যায়নি!');
      return;
    }
    setCustomExamOverridePool(filtered);
    setCustomExamTitle(`প্রস্তুতি পরীক্ষা: ${categoryName}`);
    setSetupModalOpen(true);
  };

  const startJobExam = async (subcatName: string, overrideQuestions?: Question[]) => {
    if (!checkGuestAccess('জব সলিউশন পরীক্ষা')) return;
    let filtered = overrideQuestions || questions.filter(q => 
      q.subcategory === subcatName || (q.subcategories && q.subcategories.includes(subcatName))
    );
    if (filtered.length === 0 && onFetchQuestionsLazy && !overrideQuestions) {
      const fetched = await onFetchQuestionsLazy({ subcategory: subcatName });
      filtered = fetched.filter(q => q.subcategory === subcatName || (q.subcategories && q.subcategories.includes(subcatName)));
    }
    if (filtered.length === 0) {
      showCustomAlert('কোনো প্রশ্ন পাওয়া যায়নি!');
      return;
    }
    setCustomExamOverridePool(filtered);
    setCustomExamTitle(`জব সলিউশন পরীক্ষা: ${subcatName}`);
    setSetupModalOpen(true);
  };

  const STANDARD_SUBJECT_CATEGORIES = [
    'বাংলা ব্যাকরণ',
    'বাংলা সাহিত্য',
    'ইংরেজি গ্রামার',
    'ইংরেজি সাহিত্য',
    'গণিত',
    'বাংলাদেশ বিষয়াবলী',
    'আন্তর্জাতিক বিষয়াবলী',
    'সাধারণ বিজ্ঞান',
    'তথ্য ও যোগাযোগ প্রযুক্তি'
  ];

  // Cascading Category Options for Custom Exam
  const customExamCategoryOptions = useMemo(() => {
    const catsSet = new Set<string>();
    STANDARD_SUBJECT_CATEGORIES.forEach(c => catsSet.add(c));
    categories.forEach(c => {
      if (c && c.name && c.name.trim()) catsSet.add(c.name.trim());
    });
    questions.forEach(q => {
      if (q.category && q.category.trim()) catsSet.add(q.category.trim());
      if (q.csvCategory && q.csvCategory.trim()) catsSet.add(q.csvCategory.trim());
      if (q.categories) {
        q.categories.forEach(cat => {
          if (cat && cat.trim()) catsSet.add(cat.trim());
        });
      }
    });
    return Array.from(catsSet).filter(c => c && c.toLowerCase() !== 'কাস্টম csv');
  }, [categories, questions]);

  // Cascading Subcategory Options for Custom Exam
  const customExamSubcategoryOptions = useMemo(() => {
    if (customExamSelectedCat === 'ALL') {
      const subSet = new Set<string>();
      subcategories.forEach(s => {
        if (s && s.name && s.name.trim()) subSet.add(s.name.trim());
      });
      questions.forEach(q => {
        if (q.subcategory && q.subcategory.trim()) subSet.add(q.subcategory.trim());
        if (q.subcategories) {
          q.subcategories.forEach(sub => {
            if (sub && sub.trim()) subSet.add(sub.trim());
          });
        }
      });
      return Array.from(subSet);
    } else {
      const normSelectedCat = customExamSelectedCat.trim().toLowerCase();
      const matchedSubs = new Set<string>();

      subcategories.filter(s => 
        s.parentCategory && s.parentCategory.trim().toLowerCase() === normSelectedCat
      ).forEach(s => matchedSubs.add(s.name.trim()));

      questions.forEach(q => {
        const qCat = (q.category || '').trim().toLowerCase();
        const qCsv = (q.csvCategory || '').trim().toLowerCase();
        const qCats = (q.categories || []).map(c => c.trim().toLowerCase());

        if (qCat === normSelectedCat || qCsv === normSelectedCat || qCats.includes(normSelectedCat)) {
          if (q.subcategory && q.subcategory.trim()) matchedSubs.add(q.subcategory.trim());
          if (q.subcategories) {
            q.subcategories.forEach(sub => {
              if (sub && sub.trim()) matchedSubs.add(sub.trim());
            });
          }
        }
      });

      return Array.from(matchedSubs);
    }
  }, [customExamSelectedCat, subcategories, questions]);

  // Cascading Level 3 Sub-subcategory Options
  const customExamSubSubcategoryOptions = useMemo(() => {
    if (customExamSelectedSubcat === 'ALL') {
      return [];
    }
    const normSubcat = customExamSelectedSubcat.trim().toLowerCase();
    const matchedChildSubs = new Set<string>();

    subcategories.filter(s => 
      s.parentCategory && s.parentCategory.trim().toLowerCase() === normSubcat
    ).forEach(s => matchedChildSubs.add(s.name.trim()));

    return Array.from(matchedChildSubs);
  }, [customExamSelectedSubcat, subcategories]);

  // Question Pool for Custom Exam based on Cascading Filters
  const getCustomExamQuestionsPool = (): Question[] => {
    if (customExamOverridePool && customExamOverridePool.length > 0) {
      return customExamOverridePool;
    }

    let basePool = revisionMode ? incorrectQuestions : questions;

    if (customExamSelectedCat !== 'ALL') {
      const targetCat = customExamSelectedCat.trim().toLowerCase();
      const catDescendants = getDescendants(customExamSelectedCat).map(d => d.toLowerCase());

      basePool = basePool.filter(q => {
        const qCat = (q.category || '').trim().toLowerCase();
        const qCsv = (q.csvCategory || '').trim().toLowerCase();
        const qCats = (q.categories || []).map(c => c.trim().toLowerCase());

        if (qCat === targetCat || catDescendants.includes(qCat)) return true;
        if (qCsv === targetCat || catDescendants.includes(qCsv)) return true;
        if (qCats.some(c => c === targetCat || catDescendants.includes(c))) return true;

        const qSub = (q.subcategory || '').trim().toLowerCase();
        const qSubs = (q.subcategories || []).map(s => s.trim().toLowerCase());
        if (qSub && catDescendants.includes(qSub)) return true;
        if (qSubs.some(s => catDescendants.includes(s))) return true;

        return false;
      });
    }

    const activeSubNode = customExamSelectedSubSubcat !== 'ALL' 
      ? customExamSelectedSubSubcat 
      : customExamSelectedSubcat;

    if (activeSubNode !== 'ALL') {
      const targetSub = activeSubNode.trim().toLowerCase();
      const subDescendants = getDescendants(activeSubNode).map(d => d.toLowerCase());

      basePool = basePool.filter(q => {
        const qSub = (q.subcategory || '').trim().toLowerCase();
        const qSubs = (q.subcategories || []).map(s => s.trim().toLowerCase());
        const qCat = (q.category || '').trim().toLowerCase();
        const qCsv = (q.csvCategory || '').trim().toLowerCase();
        const qCats = (q.categories || []).map(c => c.trim().toLowerCase());

        if (qSub === targetSub || subDescendants.includes(qSub)) return true;
        if (qSubs.some(s => s === targetSub || subDescendants.includes(s))) return true;
        if (qCat === targetSub || subDescendants.includes(qCat)) return true;
        if (qCsv === targetSub || subDescendants.includes(qCsv)) return true;
        if (qCats.some(c => c === targetSub || subDescendants.includes(c))) return true;

        return false;
      });
    }

    return basePool;
  };

  const startCustomPracticeExam = () => {
    if (!checkGuestAccess('কাস্টম পরীক্ষা ও প্র্যাকটিস এক্সাম')) return;
    setSetupModalOpen(false);
    const pool = getCustomExamQuestionsPool();

    if (pool.length === 0) {
      if (revisionMode) {
        showCustomAlert('আপনার ভুল উত্তরের তালিকায় এই ফিল্টারে কোনো প্রশ্ন সংরক্ষিত নেই!');
      } else {
        showCustomAlert('মনোনীত বিষয় বা উপ-অধ্যায়ে কোনো প্রশ্ন পাওয়া যায়নি!');
      }
      return;
    }

    const limit = Math.min(setupQLimit, pool.length);
    const shuffled = [...pool].sort(() => 0.5 - Math.random()).slice(0, limit);

    let filterTag = '';
    if (customExamSelectedSubSubcat !== 'ALL') {
      filterTag = `: ${customExamSelectedSubSubcat}`;
    } else if (customExamSelectedSubcat !== 'ALL') {
      filterTag = `: ${customExamSelectedSubcat}`;
    } else if (customExamSelectedCat !== 'ALL') {
      filterTag = `: ${customExamSelectedCat}`;
    }

    const titleToUse = customExamTitle || (revisionMode ? `ভুল সংশোধন পরীক্ষা${filterTag}` : `কাস্টম পরীক্ষা${filterTag}`);

    setQuizQuestions(shuffled);
    setQuizTitle(titleToUse);
    setQuizExamId(`custom_${Date.now()}`);
    setQuizTimeLimitMinutes(setupTimeLimit === 999 ? 'unlimited' : setupTimeLimit);
    setQuizAnswerMode(setupAnswerView);
    setCurrentQIndex(0);
    setQuizPage(1);
    setQuizFilterMode('all');
    setUserSelectedAnswers({});
    
    if (setupTimeLimit !== 999) {
      setSecondsRemaining(setupTimeLimit * 60);
      setIsQuizTimerRunning(true);
    } else {
      setSecondsRemaining(0);
      setIsQuizTimerRunning(false);
    }
    setReaderModeActive(false);
    setQuizActive(true);
  };

  const parseUserCSVLine = (line: string, qualifier: string = userCsvQualifier) => {
    const cells: string[] = [];
    let inQuotes = false;
    let currentCell = '';

    for (let j = 0; j < line.length; j++) {
      const char = line[j];

      if (qualifier === '"' && char === '"') {
        if (inQuotes && j + 1 < line.length && line[j + 1] === '"') {
          currentCell += '"';
          j++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (qualifier === "'" && char === "'") {
        if (inQuotes && j + 1 < line.length && line[j + 1] === "'") {
          currentCell += "'";
          j++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (qualifier === 'auto' && (char === '"' || char === "'")) {
        if (inQuotes && j + 1 < line.length && (line[j + 1] === '"' || line[j + 1] === "'")) {
          currentCell += line[j + 1];
          j++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (qualifier === 'none') {
        if (char === ',') {
          cells.push(currentCell.trim());
          currentCell = '';
          continue;
        } else {
          currentCell += char;
          continue;
        }
      }

      if (char === ',' && !inQuotes) {
        cells.push(currentCell.trim());
        currentCell = '';
      } else if (
        !(qualifier === '"' && char === '"') &&
        !(qualifier === "'" && char === "'") &&
        !(qualifier === 'auto' && (char === '"' || char === "'"))
      ) {
        currentCell += char;
      }
    }
    cells.push(currentCell.trim());

    return cells.map(cell => {
      let val = cell.trim();
      if (qualifier === '"') {
        if (val.startsWith('"') && val.endsWith('"') && val.length >= 2) {
          val = val.slice(1, -1).replace(/""/g, '"');
        }
      } else if (qualifier === "'") {
        if (val.startsWith("'") && val.endsWith("'") && val.length >= 2) {
          val = val.slice(1, -1).replace(/''/g, "'");
        }
      } else if (qualifier === 'auto') {
        val = val.replace(/^["']|["']$/g, '');
      }
      return val;
    });
  };

  const handleUserCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        if (!content) return;

        const lines = content.split('\n');
        if (lines.length < 2) {
          showCustomAlert('CSV ফাইলে কোনো প্রশ্ন পাওয়া যায়নি!');
          return;
        }

        const rawHeaders = parseUserCSVLine(lines[0], userCsvQualifier).map(h => h.trim().replace(/^["']|["']$/g, ''));
        const parsedQuestions: Question[] = [];

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const cells = parseUserCSVLine(line, userCsvQualifier);

          const rowData: Record<string, string> = {};
          rawHeaders.forEach((h, idx) => {
            rowData[h] = cells[idx] || '';
          });

          const textVal = rowData.text || rowData.question || rowData.Question || rowData.Text || cells[0] || '';
          if (!textVal) continue;

          let correctKey: 'Option A' | 'Option B' | 'Option C' | 'Option D' = 'Option A';
          const rawCorr = (rowData.correct || rowData.Correct || rowData.answer || cells[5] || '').toLowerCase().trim();
          if (rawCorr === 'option a' || rawCorr === 'a' || rawCorr === 'optiona' || rawCorr === 'ক') correctKey = 'Option A';
          else if (rawCorr === 'option b' || rawCorr === 'b' || rawCorr === 'optionb' || rawCorr === 'খ') correctKey = 'Option B';
          else if (rawCorr === 'option c' || rawCorr === 'c' || rawCorr === 'optionc' || rawCorr === 'গ') correctKey = 'Option C';
          else if (rawCorr === 'option d' || rawCorr === 'd' || rawCorr === 'optiond' || rawCorr === 'ঘ') correctKey = 'Option D';

          parsedQuestions.push({
            id: `csv_q_${Date.now()}_${i}`,
            text: textVal,
            optionA: rowData.optionA || rowData.OptionA || cells[1] || 'অপশন ক',
            optionB: rowData.optionB || rowData.OptionB || cells[2] || 'অপশন খ',
            optionC: rowData.optionC || rowData.OptionC || cells[3] || 'অপশন গ',
            optionD: rowData.optionD || rowData.OptionD || cells[4] || 'অপশন ঘ',
            correct: correctKey,
            explanation: rowData.explanation || rowData.Explanation || cells[6] || 'CSV ফাইল থেকে সংগৃহীত প্রশ্ন',
            category: 'কাস্টম CSV',
            subcategory: '',
            csvCategory: rowData.category || rowData.Category || 'সাধারণ জ্ঞান'
          });
        }

        if (parsedQuestions.length === 0) {
          showCustomAlert('CSV ফাইলটিতে সঠিক ফরম্যাটের প্রশ্ন পাওয়া যায়নি!');
          return;
        }

        setSetupModalOpen(false);
        setQuizQuestions(parsedQuestions);
        setQuizTitle(`CSV ফাইল পরীক্ষা (${file.name})`);
        setQuizExamId(`custom_csv_${Date.now()}`);
        setQuizTimeLimitMinutes(setupTimeLimit === 999 ? 'unlimited' : setupTimeLimit);
        setQuizAnswerMode(setupAnswerView);
        setCurrentQIndex(0);
        setQuizPage(1);
        setQuizFilterMode('all');
        setUserSelectedAnswers({});
        if (setupTimeLimit !== 999) {
          setSecondsRemaining(setupTimeLimit * 60);
          setIsQuizTimerRunning(true);
        } else {
          setSecondsRemaining(0);
          setIsQuizTimerRunning(false);
        }
        setQuizActive(true);
        showCustomAlert(`🎉 সফলভাবে ${parsedQuestions.length}টি প্রশ্ন লোড হয়েছে!`);
      } catch (err) {
        showCustomAlert('CSV ফাইল পার্স করতে সমস্যা হয়েছে। ফাইলের ফরম্যাট সঠিক আছে কিনা পরীক্ষা করুন।');
      }
    };
    reader.readAsText(file);
  };

  const startOfficialLiveExam = async (exam: LiveExam) => {
    // Check if course is enrolled if this exam belongs to an unenrolled course
    if (exam.courseId && !enrolledCourseIds.includes(exam.courseId)) {
      const course = courses ? courses.find(c => c.id === exam.courseId) : undefined;
      const courseTitle = course?.title || exam.courseName || 'এই কোর্সটি';
      showCustomAlert(
        `🔒 কোর্সে এনরোল প্রয়োজন!\n\n"${courseTitle}" কোর্সের অফিশিয়াল লাইভ পরীক্ষায় অংশগ্রহণ করতে অনুগ্রহ করে প্রথমে কোর্সে এনরোল (Enroll) করুন।\n\nআপনি বর্তমানে শুধুমাত্র রুটিন ও সিলেবাস দেখতে পারবেন।`,
        () => {
          if (exam.courseId) {
            handleToggleEnrollCourse(exam.courseId, courseTitle);
          }
        },
        '🔒 কোর্সটি লক করা আছে',
        true,
        'এনরোল করুন',
        'বন্ধ করুন'
      );
      return;
    }

    // Check if already completed
    const alreadyTaken = attempts.some(a => a.examId === exam.id);
    if (alreadyTaken) {
      showCustomAlert('আপনি ইতিপূর্বে এই অফিশিয়াল পরীক্ষায় অংশগ্রহণ করেছেন!');
      return;
    }

    let finalQuestions: Question[] = [];

    if (exam.questionIds && exam.questionIds.length > 0) {
      // Load specific manually selected questions
      let idSet = new Set(exam.questionIds);
      finalQuestions = questions.filter(q => idSet.has(q.id));
      if (finalQuestions.length === 0 && onFetchQuestionsLazy) {
        const fetched = await onFetchQuestionsLazy({ examId: exam.id, category: exam.category === 'ALL' ? undefined : exam.category });
        idSet = new Set(exam.questionIds);
        finalQuestions = (fetched || []).filter(q => idSet.has(q.id));
      }
      
      // Keep original order of selected questions if possible
      finalQuestions.sort((a, b) => {
        const idxA = exam.questionIds!.indexOf(a.id);
        const idxB = exam.questionIds!.indexOf(b.id);
        return idxA - idxB;
      });
    } else {
      let pool = questions;

      // If exam is linked to a routine, strictly match the routine syllabus topics
      if (exam.routineId) {
        const targetRoutine = routines.find(r => r.id === exam.routineId);
        if (targetRoutine) {
          const matched = getRoutineMatchingQuestions(targetRoutine, questions, subcategories);
          if (matched.length > 0) {
            pool = matched;
          }
        }
      } else if (exam.category !== 'ALL') {
        pool = questions.filter(q => q.category === exam.category || (q.categories && q.categories.includes(exam.category)));
        if (pool.length === 0 && onFetchQuestionsLazy) {
          const fetched = await onFetchQuestionsLazy({ category: exam.category, examId: exam.id });
          pool = (fetched || []).filter(q => q.category === exam.category || (q.categories && q.categories.includes(exam.category)));
        }
      } else if (pool.length === 0 && onFetchQuestionsLazy) {
        pool = (await onFetchQuestionsLazy({ examId: exam.id })) || [];
      }

      if (pool.length === 0) {
        showCustomAlert('দুঃখিত, এই পরীক্ষার সাথে সম্পর্কিত কোনো কুইজ ডাটাবেসে পাওয়া যায়নি!');
        return;
      }
      const limit = Math.min(exam.qLimit || 20, pool.length);
      finalQuestions = [...pool].sort(() => 0.5 - Math.random()).slice(0, limit);
    }

    if (finalQuestions.length === 0) {
      showCustomAlert('দুঃখিত, এই পরীক্ষার সাথে সম্পর্কিত কোনো কুইজ ডাটাবেসে পাওয়া যায়নি!');
      return;
    }

    setViewingHierarchyRoutine(null);
    setSyllabusModalRoutine(null);
    setQuizQuestions(finalQuestions);
    setQuizTitle(exam.title);
    setQuizExamId(exam.id);
    setQuizTimeLimitMinutes(exam.timeLimit || 20);
    setQuizAnswerMode('after_exam');
    setCurrentQIndex(0);
    setQuizPage(1);
    setQuizFilterMode('all');
    setUserSelectedAnswers({});
    setSecondsRemaining((exam.timeLimit || 20) * 60);
    setIsQuizTimerRunning(true);
    setReaderModeActive(false);
    setQuizActive(true);
  };

  const findRoutineAttempt = (routine: Routine): Attempt | undefined => {
    const linkedLiveExam = liveExams.find(e => 
      (e.routineId && e.routineId === routine.id) || 
      (routine.id && e.id === routine.id) ||
      (routine.courseId && e.courseId === routine.courseId && e.title?.trim().toLowerCase() === routine.title?.trim().toLowerCase())
    );
    return attempts.find(a => 
      a.examId === routine.id || 
      (linkedLiveExam && a.examId === linkedLiveExam.id) ||
      (routine.title && a.examTitle?.trim().toLowerCase() === routine.title?.trim().toLowerCase())
    );
  };

  const handleStartLiveExamForRoutine = (routine: Routine) => {
    if (!checkCourseEnrollmentAccess(routine, 'লাইভ পরীক্ষা (Live Exam)')) {
      return;
    }

    // 1. Check if linked official LiveExam already exists in liveExams list
    const linked = liveExams.find(e => 
      (e.routineId && e.routineId === routine.id) || 
      (routine.id && e.id === routine.id) ||
      (routine.courseId && e.courseId === routine.courseId && e.title?.trim().toLowerCase() === routine.title?.trim().toLowerCase())
    );

    if (linked) {
      startOfficialLiveExam(linked);
      return;
    }

    // 2. Build live exam object from routine exam config or defaults
    const examConfig = routine.examConfig;
    const targetQLimit = examConfig?.qLimit || 20;
    const targetTimeLimit = examConfig?.timeLimit || 20;

    const liveExamObj: LiveExam = {
      id: routine.id || `live_routine_${Date.now()}`,
      title: routine.title,
      qLimit: targetQLimit,
      timeLimit: targetTimeLimit,
      category: routine.selectedCategories?.[0] || 'ALL',
      startTime: examConfig?.startTime || routine.examDate || routine.createdAt,
      expiryTime: examConfig?.expiryTime || new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      createdAt: routine.createdAt,
      questionIds: examConfig?.questionIds,
      routineId: routine.id,
      courseId: routine.courseId,
      courseName: routine.courseName,
      selectedCategories: routine.selectedCategories,
      selectedSubcategories: routine.selectedSubcategories,
      selectedLeafCategories: routine.selectedLeafCategories,
      totalMarks: examConfig?.totalMarks || 20,
      passMarks: examConfig?.passMarks || 8,
      questionSelection: examConfig?.questionSelection || 'auto'
    };

    startOfficialLiveExam(liveExamObj);
  };

  const handleSelectOptionForIndex = (qIdx: number, key: string) => {
    // If user clicks on answer, they cannot change it (permanent selection)
    if (userSelectedAnswers.hasOwnProperty(qIdx)) {
      return;
    }
    setUserSelectedAnswers(prev => ({
      ...prev,
      [qIdx]: key
    }));
  };

  const handleClearAnswerForIndex = (qIdx: number) => {
    if (quizAnswerMode === 'instant') return;
    setUserSelectedAnswers(prev => {
      const updated = { ...prev };
      delete updated[qIdx];
      return updated;
    });
  };

  const handleJumpToExamQuestion = (targetQIndex: number) => {
    const targetPage = Math.floor(targetQIndex / 20) + 1;
    if (targetPage !== quizPage) {
      setQuizPage(targetPage);
    }
    setTimeout(() => {
      const el = document.getElementById(`exam-card-q-${targetQIndex}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 120);
  };

  const handleSelectOption = (key: string) => {
    setUserSelectedAnswers({
      ...userSelectedAnswers,
      [currentQIndex]: key
    });
    if (quizAnswerMode !== 'instant') {
      setTimeout(() => {
        handleNextQuestion();
      }, 300);
    }
  };

  const handleNextQuestion = () => {
    if (currentQIndex < quizQuestions.length - 1) {
      setCurrentQIndex(prev => prev + 1);
    }
  };

  const handlePrevQuestion = () => {
    if (currentQIndex > 0) {
      setCurrentQIndex(prev => prev - 1);
    }
  };

  const handleSkipQuestion = () => {
    setUserSelectedAnswers({
      ...userSelectedAnswers,
      [currentQIndex]: 'Skipped'
    });
    if (currentQIndex < quizQuestions.length - 1) {
      setCurrentQIndex(prev => prev + 1);
    }
  };

  const handleForceEndExam = () => {
    if (isQuizTimerRunning) {
      setIsQuizTimerRunning(false);
    }

    // Score calculation
    let correctCount = 0;
    let wrongCount = 0;
    let catAnalysis: Record<string, { correct: number; total: number }> = {};
    const incorrectQIds: string[] = [];

    quizQuestions.forEach((q, i) => {
      const selected = userSelectedAnswers[i];
      const isCorrect = selected === q.correct;
      const qCats = q.categories && q.categories.length > 0 ? q.categories : [q.category];

      qCats.forEach(cat => {
        if (!catAnalysis[cat]) {
          catAnalysis[cat] = { correct: 0, total: 0 };
        }
        catAnalysis[cat].total++;
        if (isCorrect) {
          catAnalysis[cat].correct++;
        }
      });

      if (isCorrect) {
        correctCount++;
      } else {
        if (selected && selected !== 'Skipped') {
          wrongCount++;
        }
        incorrectQIds.push(q.id);
      }
    });

    // Standard marking: 0.5 negative marks for each wrong answer
    const negativeMarks = wrongCount * 0.5;
    const finalScore = Math.max(0, correctCount - negativeMarks);

    const finishedAttempt: Attempt = {
      id: `attempt_${Date.now()}`,
      userPhone: user.phone || user.email || '',
      username: user.name || 'গেস্ট পরীক্ষার্থী',
      examId: quizExamId,
      examTitle: quizTitle,
      score: finalScore,
      correctCount,
      wrongCount,
      totalQuestions: quizQuestions.length,
      categoryAnalysis: catAnalysis,
      incorrectQuestionIds: incorrectQIds,
      userSelectedAnswers,
      activeQuizQuestions: quizQuestions,
      submittedAt: new Date().toISOString(),
      userEmail: user.email || user.phone || '',
      isGuestAttempt: user.isGuest || false
    };

    onSaveAttempt(finishedAttempt);
    setSelectedAttemptForView(finishedAttempt);

    setQuizActive(false);
    setActiveTab('results');
    showCustomAlert(`🎉 পরীক্ষা সমাপ্ত হয়েছে!\nপ্রাপ্ত স্কোর: ${finalScore}\nসঠিক উত্তর: ${correctCount}, ভুল উত্তর: ${wrongCount}`);
  };

  // Open Bookmark folder Modal
  const handleOpenBookmarkDialog = (qId: string) => {
    setSelectedBookmarkQId(qId);
    setBookmarkFolder('সাধারণ বুকমার্ক');
    setIsCustomFolder(false);
    setCustomFolderInput('');
    setBookmarkModalOpen(true);
  };

  const handleConfirmBookmark = () => {
    if (!selectedBookmarkQId) return;
    const folderName = isCustomFolder ? customFolderInput.trim() : bookmarkFolder;
    if (!folderName) {
      showCustomAlert('বুকমার্ক গ্রুপের নাম দিন!');
      return;
    }

    onAddBookmark(selectedBookmarkQId, folderName);
    setBookmarkModalOpen(false);
    setSelectedBookmarkQId(null);
    showCustomAlert('🔖 প্রশ্নটি বুকমার্ক কালেকশনে যোগ করা হয়েছে!');
  };

  const handleOpenReaderMode = async (type: 'prep' | 'job', customValue?: string, overrideQuestions?: Question[]) => {
    if (!checkGuestAccess('MCQ পড়া ও সমাধান ভিউ')) return;
    let filtered: Question[] = [];
    const targetValue = customValue || (type === 'prep' ? prepCategory : jobSubcategory);
    
    if (overrideQuestions) {
      filtered = overrideQuestions;
      setReaderTitle(type === 'prep' ? `বিষয়ভিত্তিক পড়া: ${targetValue}` : `জব সলিউশন রিডার: ${targetValue}`);
    } else {
      if (type === 'prep') {
        filtered = questions.filter(q => 
          q.category === targetValue || (q.categories && q.categories.includes(targetValue))
        );
        if (filtered.length === 0 && onFetchQuestionsLazy) {
          const fetched = await onFetchQuestionsLazy({ category: targetValue });
          filtered = fetched.filter(q => q.category === targetValue || (q.categories && q.categories.includes(targetValue)));
        }
        setReaderTitle(`বিষয়ভিত্তিক পড়া: ${targetValue}`);
        if (customValue) setPrepCategory(customValue);
      } else {
        filtered = questions.filter(q => 
          q.subcategory === targetValue || (q.subcategories && q.subcategories.includes(targetValue))
        );
        if (filtered.length === 0 && onFetchQuestionsLazy) {
          const fetched = await onFetchQuestionsLazy({ subcategory: targetValue });
          filtered = fetched.filter(q => q.subcategory === targetValue || (q.subcategories && q.subcategories.includes(targetValue)));
        }
        setReaderTitle(`জব সলিউশন রিডার: ${targetValue}`);
        if (customValue) setJobSubcategory(customValue);
      }
    }

    if (filtered.length === 0) {
      showCustomAlert('পড়ার জন্য কোনো প্রশ্ন পাওয়া যায়নি!');
      return;
    }
    setReaderSelectedAnswers({});
    setReaderPage(1);
    setReaderQuestions(filtered);
    setReaderSource(type);
    setReaderCategoryFilter('সব প্রশ্ন');
    setReaderModeActive(true);
  };

  // Group Bookmarks by folder
  const groupedBookmarks: Record<string, Bookmark[]> = {};
  bookmarks.forEach(b => {
    if (!groupedBookmarks[b.folderName]) {
      groupedBookmarks[b.folderName] = [];
    }
    groupedBookmarks[b.folderName].push(b);
  });

  const renderModals = () => {
    return (
      <>
        {/* Syllabus Popup Modal for a Routine Date */}
        {syllabusModalRoutine && (() => {
          const routine = syllabusModalRoutine;
          const targetCourse = courses ? courses.find(c => c.id === routine.courseId || c.title === routine.courseName) : undefined;
          const syllabusPaths = formatRoutineSyllabusPaths(routine, subcategories, categories, questions);
          const hasExam = routine.examConfig && routine.examConfig.enabled;
          const isExamLive = hasExam && routine.examConfig?.startTime && new Date() >= new Date(routine.examConfig.startTime);
          const examDateStr = routine.examConfig?.startTime
            ? formatExamScheduleWithTime(routine.examConfig.startTime)
            : routine.examDate
              ? formatBengaliDate(routine.examDate)
              : formatBengaliDate(routine.createdAt);

          const totalMark = routine.examConfig?.totalMarks || 20;
          const passMark = routine.examConfig?.passMarks || 8;
          const timeLimit = routine.examConfig?.timeLimit || 20;

          return (
            <div 
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in"
              onClick={() => setSyllabusModalRoutine(null)}
            >
              <div 
                className="bg-white rounded-3xl w-full max-w-lg shadow-2xl p-5 sm:p-6 relative border border-slate-100 flex flex-col gap-4 text-xs max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Close Button */}
                <button
                  type="button"
                  id="btn-close-syllabus-modal"
                  onClick={() => setSyllabusModalRoutine(null)}
                  className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 rounded-full transition cursor-pointer"
                  title="বন্ধ করুন"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Header */}
                <div className="pr-8 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10.5px] font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-lg">
                      {routine.courseName || targetCourse?.title || 'কোর্স রুটিন'}
                    </span>
                    {isExamLive && (
                      <span className="bg-emerald-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-2xs animate-pulse">
                        লাইভ পরীক্ষা চলছে
                      </span>
                    )}
                  </div>

                  <h3 className="font-black text-indigo-950 text-base sm:text-lg leading-snug">
                    {routine.title}
                  </h3>

                  <div className="text-[11px] text-slate-600 font-semibold">
                    <span>তারিখ ও সময়: {examDateStr}</span>
                  </div>
                </div>

                {/* Exam Quick Specs Grid */}
                <div className="grid grid-cols-3 gap-2 text-[11px] p-2.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-center font-bold">
                  <div className="bg-white p-2 rounded-xl border border-slate-100 text-indigo-950">
                    <span className="block text-[10px] text-slate-400 font-medium">পূর্ণমান</span>
                    <span>{totalMark.toLocaleString('bn-BD')}</span>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-slate-100 text-slate-800">
                    <span className="block text-[10px] text-slate-400 font-medium">পাস মার্ক</span>
                    <span>{passMark.toLocaleString('bn-BD')}</span>
                  </div>
                  <div className="bg-white p-2 rounded-xl border border-slate-100 text-slate-800">
                    <span className="block text-[10px] text-slate-400 font-medium">সময়</span>
                    <span>{timeLimit.toLocaleString('bn-BD')} মি.</span>
                  </div>
                </div>

                {/* Syllabus Section */}
                <div className="space-y-2">
                  <span className="text-xs font-black text-indigo-950 block">
                    সিলেবাস ও বিষয়সমূহ (Syllabus):
                  </span>

                  {syllabusPaths.length > 0 ? (
                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                      {syllabusPaths.map((path, pIdx) => (
                        <div
                          key={pIdx}
                          className="bg-indigo-50/80 border border-indigo-200/80 text-indigo-950 font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 flex-wrap"
                        >
                          {path.split(/\s*>\s*/).map((seg, sIdx, arr) => (
                            <React.Fragment key={sIdx}>
                              <span className={sIdx === arr.length - 1 ? "text-indigo-950 font-black" : "text-indigo-700 font-semibold"}>
                                {seg}
                              </span>
                              {sIdx < arr.length - 1 && <span className="text-indigo-300 font-black">›</span>}
                            </React.Fragment>
                          ))}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-slate-600 font-medium">
                      {routine.title}
                    </div>
                  )}
                </div>

                {/* Details / Instructions */}
                {routine.details && (
                  <div className="space-y-1 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      রুটিন নির্দেশিকা ও বিবরণ:
                    </span>
                    <p className="text-slate-700 leading-relaxed whitespace-pre-line text-xs font-medium">
                      {routine.details}
                    </p>
                  </div>
                )}

                {/* Course Unenrolled Notice Banner if locked */}
                {(() => {
                  const rBatch = getRoutineBatchInfo(routine);
                  if (rBatch.type === 'unrolled') {
                    return (
                      <div className="bg-amber-50 border border-amber-200 p-3 rounded-2xl flex items-center justify-between gap-2.5 text-xs text-amber-900 animate-fade-in">
                        <div className="flex items-center gap-2 min-w-0">
                          <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                          <span className="font-bold leading-tight">
                            কোর্সটি আন-এনরোল্ড! পরীক্ষা ও প্রস্তুতি লক করা আছে।
                          </span>
                        </div>
                        {rBatch.courseId && (
                          <button
                            type="button"
                            onClick={() => {
                              if (rBatch.courseId) {
                                handleToggleEnrollCourse(rBatch.courseId, rBatch.courseTitle || 'এই কোর্স');
                              }
                            }}
                            className="bg-amber-600 hover:bg-amber-700 text-white font-black px-3 py-1.5 rounded-xl text-xs shrink-0 shadow-2xs cursor-pointer"
                          >
                            এনরোল করুন
                          </button>
                        )}
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Actions Footer */}
                <div className="flex items-center justify-end pt-2 border-t border-slate-100 mt-1">
                  <button
                    type="button"
                    onClick={() => setSyllabusModalRoutine(null)}
                    className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-5 rounded-xl transition text-center cursor-pointer"
                  >
                    বন্ধ করুন
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Explanation Popup Modal */}
        {popupExplanationQ && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl p-6 relative border border-gray-100 flex flex-col gap-4 animate-fade-in text-xs">
              <button
                type="button"
                onClick={() => setPopupExplanationQ(null)}
                className="absolute top-4 right-4 p-2 bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-gray-700 rounded-full transition"
              >
                <X className="w-4 h-4" />
              </button>
              
              <div className="flex items-center gap-2 text-indigo-700 font-bold">
                <span>💡 সঠিক ব্যাখ্যা ও উত্তর</span>
              </div>

              <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                <p className="font-extrabold text-gray-900 leading-relaxed mb-2">
                  {popupExplanationQ.text}
                </p>
                <div className="text-[10px] text-gray-500 font-bold">
                  সঠিক উত্তর: <span className="text-green-700 font-extrabold bg-green-50 px-2 py-0.5 rounded border border-green-150">
                    {(() => {
                      const correctKey = popupExplanationQ.correct;
                      return correctKey === 'Option A' ? popupExplanationQ.optionA :
                             correctKey === 'Option B' ? popupExplanationQ.optionB :
                             correctKey === 'Option C' ? popupExplanationQ.optionC :
                             popupExplanationQ.optionD;
                    })()}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-3 max-h-[40vh] overflow-y-auto pr-1">
                {/* Standard Explanation */}
                <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-100 text-gray-800">
                  <span className="font-extrabold text-amber-900 block mb-1">📖 মূল ব্যাখ্যা:</span>
                  <p className="leading-relaxed whitespace-pre-line">
                    {popupExplanationQ.explanation || 'এই প্রশ্নের জন্য কোনো মূল ব্যাখ্যা দেওয়া নেই।'}
                  </p>
                </div>

                {/* Approved Suggested Explanations */}
                {popupExplanationQ.userExplanations?.filter(e => e.approved).map((e) => (
                  <div key={e.id} className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-100 text-gray-800">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-extrabold text-emerald-900 flex items-center gap-1">
                        🏆 অনুমোদিত অতিরিক্ত ব্যাখ্যা
                      </span>
                      <span className="text-[9px] font-bold bg-emerald-100/60 px-1.5 py-0.5 rounded text-emerald-800">
                        অবদানকারী: {e.userName}
                      </span>
                    </div>
                    <p className="leading-relaxed whitespace-pre-line">
                      {e.text}
                    </p>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setPopupExplanationQ(null)}
                className="w-full bg-gray-150 hover:bg-gray-200 text-gray-700 font-extrabold py-3 rounded-2xl transition text-center"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        )}

        {/* Red Flag / Mistake comment modal */}
        {flagModalQ && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <form
              onSubmit={(ev) => {
                ev.preventDefault();
                if (!flagCommentText.trim()) return;
                if (onUpdateQuestion) {
                  const newComment = {
                    id: `comment-${Math.random().toString(36).substr(2, 9)}`,
                    userPhone: user.phone,
                    userName: user.name,
                    text: flagCommentText.trim(),
                    createdAt: new Date().toISOString()
                  };
                  const updatedComments = [...(flagModalQ.comments || []), newComment];
                  onUpdateQuestion(flagModalQ.id, { comments: updatedComments });
                  alert('আপনার রিপোর্টটি সফলভাবে জমা দেওয়া হয়েছে! এডমিন এটি খতিয়ে দেখবেন।');
                  setFlagModalQ(null);
                  setFlagCommentText('');
                }
              }}
              className="bg-white rounded-3xl w-full max-w-lg shadow-2xl p-6 relative border border-gray-100 flex flex-col gap-4 animate-fade-in text-xs"
            >
              <button
                type="button"
                onClick={() => setFlagModalQ(null)}
                className="absolute top-4 right-4 p-2 bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-gray-700 rounded-full transition"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 text-rose-700 font-bold">
                <span>🚩 প্রশ্নে ভুল রিপোর্ট করুন</span>
              </div>

              <div className="bg-rose-50/50 p-3.5 rounded-2xl border border-rose-100 text-rose-900 leading-relaxed">
                <strong>প্রশ্ন:</strong> {flagModalQ.text}
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1.5">
                  প্রশ্নে কোন ভুল থাকলে ব্যাখ্যা করুন:
                </label>
                <textarea
                  required
                  rows={4}
                  value={flagCommentText}
                  onChange={(e) => setFlagCommentText(e.target.value)}
                  placeholder="ভুলটি কি এবং সঠিক তথ্য কি হবে তা বিস্তারিত লিখুন..."
                  className="w-full p-3 border rounded-2xl text-gray-800 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFlagModalQ(null)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-2xl transition"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-extrabold py-3 rounded-2xl transition shadow-lg shadow-rose-100"
                >
                  দাখিল করুন
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Suggest Explanation Modal */}
        {userExplModalQ && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <form
              onSubmit={(ev) => {
                ev.preventDefault();
                if (!userExplText.trim()) return;
                if (!allowUserExplanation) {
                  alert('দুঃখিত, বর্তমানে ব্যাখ্যা যোগ করার সুবিধাটি সাময়িকভাবে বন্ধ রয়েছে।');
                  return;
                }
                if (onUpdateQuestion) {
                  const newExpl = {
                    id: `expl-${Math.random().toString(36).substr(2, 9)}`,
                    userPhone: user.phone,
                    userName: user.name,
                    text: userExplText.trim(),
                    approved: false,
                    createdAt: new Date().toISOString()
                  };
                  const updatedExpls = [...(userExplModalQ.userExplanations || []), newExpl];
                  onUpdateQuestion(userExplModalQ.id, { userExplanations: updatedExpls });
                  alert('আপনার ব্যাখ্যাটি সফলভাবে প্রেরণ করা হয়েছে! এডমিন প্যানেল থেকে অনুমোদন মিললে এটি প্রকাশ করা হবে।');
                  setUserExplModalQ(null);
                  setUserExplText('');
                }
              }}
              className="bg-white rounded-3xl w-full max-w-lg shadow-2xl p-6 relative border border-gray-100 flex flex-col gap-4 animate-fade-in text-xs"
            >
              <button
                type="button"
                onClick={() => setUserExplModalQ(null)}
                className="absolute top-4 right-4 p-2 bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-gray-700 rounded-full transition"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 text-amber-700 font-bold">
                <span>✍️ সঠিক উত্তরের ব্যাখ্যা প্রদান করুন</span>
              </div>

              <div className="bg-amber-50/50 p-3.5 rounded-2xl border border-amber-100 text-amber-900 leading-relaxed">
                <strong>প্রশ্ন:</strong> {userExplModalQ.text}
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1.5">
                  প্রশ্নের উত্তরের সঠিক ব্যাখ্যা লিখুন:
                </label>
                <textarea
                  required
                  rows={4}
                  value={userExplText}
                  onChange={(e) => setUserExplText(e.target.value)}
                  placeholder="সঠিক উত্তরটির পেছনে যুক্তি বা সঠিক রেফারেন্সটি ব্যাখ্যা করুন..."
                  className="w-full p-3 border rounded-2xl text-gray-800 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setUserExplModalQ(null)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-2xl transition"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-extrabold py-3 rounded-2xl transition shadow-lg shadow-amber-100"
                >
                  দাখিল করুন
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Challenge Modal for Live Exams */}
        {challengeModalData && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[99999] animate-fade-in">
            <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-6 relative border border-gray-100 flex flex-col gap-4 text-xs">
              {/* Header */}
              <div className="flex justify-between items-center border-b pb-3 border-gray-100">
                <div className="flex items-center gap-2.5">
                  <span className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 via-rose-600 to-purple-600 text-white flex items-center justify-center text-lg shadow-md shrink-0">
                    ⚔️
                  </span>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
                      ফ্রেন্ড চ্যালেঞ্জ (Facebook Share)
                    </h3>
                    <p className="text-[10.5px] text-slate-500 font-medium">
                      প্রাপ্ত নম্বর দিয়ে ফেসবুকে বন্ধুদের সরাসরি চ্যালেঞ্জ জানান!
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setChallengeModalData(null)}
                  className="text-slate-400 hover:text-slate-600 font-extrabold text-base p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Exam Details & Score Card */}
              <div className="bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-purple-500/10 border border-amber-300/80 rounded-2xl p-4 space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <div className="space-y-1">
                    <span className="text-[9.5px] font-black uppercase text-amber-900 tracking-wider bg-amber-200/90 px-2 py-0.5 rounded-md inline-block">
                      🎯 লাইভ পরীক্ষা সম্পন্ন
                    </span>
                    <h4 className="font-extrabold text-indigo-950 text-sm">{challengeModalData.exam.title}</h4>
                    <p className="text-[10px] text-slate-600 font-semibold">
                      বিষয়: {challengeModalData.exam.category === 'ALL' ? 'সব বিষয়' : challengeModalData.exam.category} | প্রশ্ন: {challengeModalData.exam.qLimit}টি
                    </p>
                  </div>
                  <div className="text-right bg-white px-3.5 py-2 rounded-2xl border border-amber-200 shadow-xs shrink-0">
                    <span className="text-[9.5px] text-slate-500 font-bold block">অর্জিত নম্বর</span>
                    <span className="text-base font-black text-rose-600">{challengeModalData.score}</span>
                  </div>
                </div>
              </div>

              {/* Challenge Message Preview */}
              <div className="space-y-1.5">
                <label className="block text-slate-700 font-bold text-xs flex items-center justify-between">
                  <span>💬 চ্যালেঞ্জ পোস্ট প্রিভিউ:</span>
                  <span className="text-[10px] text-indigo-600 font-semibold">স্বয়ংক্রিয় তৈরি</span>
                </label>
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-slate-800 text-[11px] leading-relaxed font-medium whitespace-pre-wrap select-all">
                  {`🎯 ফ্রেন্ড চ্যালেঞ্জ! 🔥\nআমি অর্জন (Orjon MCQ) -এর "${challengeModalData.exam.title}" লাইভ পরীক্ষায় ${challengeModalData.score} নম্বর পেয়েছি! 🏆\n\nতুমি কি পারবে আমার চেয়ে বেশি নম্বর পেতে? চ্যালেঞ্জ গ্রহণ করতে এখনই পরীক্ষা দাও:\n${window.location.origin}${window.location.pathname}?examId=${challengeModalData.exam.id}`}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    const shareUrl = `${window.location.origin}${window.location.pathname}?examId=${challengeModalData.exam.id}`;
                    const challengeMsg = `🎯 ফ্রেন্ড চ্যালেঞ্জ! 🔥\nআমি অর্জন (Orjon MCQ) -এর "${challengeModalData.exam.title}" লাইভ পরীক্ষায় ${challengeModalData.score} নম্বর পেয়েছি! 🏆\n\nতুমি কি পারবে আমার চেয়ে বেশি নম্বর পেতে? চ্যালেঞ্জ গ্রহণ করতে এখনই পরীক্ষা দাও:\n${shareUrl}`;

                    navigator.clipboard.writeText(challengeMsg);
                    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
                    window.open(fbUrl, '_blank', 'width=600,height=500');

                    showCustomAlert(
                      `আপনার নম্বর (${challengeModalData.score}) সহ চ্যালেঞ্জ মেসেজ ক্লিপবোর্ডে কপি করা হয়েছে এবং ফেসবুক শেয়ার পেজ চালু হয়েছে!\n\nফেসবুকে পেস্ট (Paste) করে বন্ধুদের চ্যালেঞ্জ পোস্ট করুন।`,
                      undefined,
                      '⚔️ ফেসবুক চ্যালেঞ্জ প্রস্তুত!'
                    );
                  }}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-extrabold text-xs sm:text-sm rounded-2xl shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>📘</span> ফেসবুকে চ্যালেঞ্জ শেয়ার করুন (FB Share)
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const shareUrl = `${window.location.origin}${window.location.pathname}?examId=${challengeModalData.exam.id}`;
                      const challengeMsg = `🎯 ফ্রেন্ড চ্যালেঞ্জ! 🔥\nআমি অর্জন (Orjon MCQ) -এর "${challengeModalData.exam.title}" লাইভ পরীক্ষায় ${challengeModalData.score} নম্বর পেয়েছি! 🏆\n\nতুমি কি পারবে আমার চেয়ে বেশি নম্বর পেতে? চ্যালেঞ্জ গ্রহণ করতে এখনই পরীক্ষা দাও:\n${shareUrl}`;

                      navigator.clipboard.writeText(challengeMsg);
                      showCustomAlert('চ্যালেঞ্জ মেসেজ ও পরীক্ষার লিঙ্ক সফলভাবে ক্লিপবোর্ডে কপি করা হয়েছে!', undefined, '📋 কপি সম্পন্ন!');
                    }}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-200 transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>📋</span> মেসেজ কপি করুন
                  </button>
                  <button
                    type="button"
                    onClick={() => setChallengeModalData(null)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-xl transition cursor-pointer"
                  >
                    বন্ধ করুন
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  return (
    <div className={`flex flex-col gap-3 min-h-[90vh] max-w-full overflow-x-hidden ${!quizActive && !readerModeActive ? 'pb-24' : ''}`}>
      
      {/* Guest Mode Banner if active */}
      {user.isGuest && !quizActive && !readerModeActive && (
        <div className="bg-gradient-to-r from-amber-500 via-indigo-600 to-purple-600 text-white px-3 sm:px-4 py-2.5 rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-2 text-xs animate-fade-in">
          <div className="flex items-center gap-2 font-bold">
            <span className="bg-amber-300 text-slate-950 px-2 py-0.5 rounded-md text-[10px] uppercase font-black tracking-wider">গেস্ট মোড (Guest)</span>
            <span>ইমেইল: <strong className="text-amber-200 font-extrabold">{user.email}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onRegisterPrompt ? onRegisterPrompt() : onLogout()}
              className="px-3 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[11px] rounded-lg shadow-2xs transition flex items-center gap-1 cursor-pointer"
            >
              <span>🚀</span> একাউন্ট তৈরি (রেজিস্ট্রেশন) করুন
            </button>
            <button
              onClick={onLogout}
              className="px-2.5 py-1 bg-black/20 hover:bg-black/30 text-white font-extrabold text-[11px] rounded-lg transition cursor-pointer"
            >
              বের হন
            </button>
          </div>
        </div>
      )}

      {/* Top Floating Mini Header */}
      {!quizActive && !readerModeActive && (
        <div className="flex justify-between items-center bg-indigo-50 border border-indigo-100 p-2 sm:p-2.5 rounded-2xl shadow-sm gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <button
              onClick={() => setDrawerOpen(true)}
              className="p-1.5 sm:p-2 bg-white hover:bg-indigo-100 text-indigo-700 rounded-xl border border-indigo-100 shadow-sm transition-all hover:scale-105 active:scale-95 duration-150 flex items-center justify-center shrink-0 cursor-pointer"
              title="মেনু খুলুন"
            >
              <Menu className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Quick Stack Unwind Back Button when in sub-views/paths/tabs */}
            {(activeTab !== 'dashboard' || prepPath.length > 0 || jobPath.length > 0 || yearJobPath.length > 0 || selectedAttemptForView || selectedBookmarkFolder || setupModalOpen || viewingHierarchyRoutine || syllabusModalRoutine) && (
              <button
                onClick={() => handleStackUnwind()}
                className="p-1.5 sm:p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition-all hover:scale-105 active:scale-95 duration-150 flex items-center justify-center gap-1 shrink-0 text-xs font-extrabold cursor-pointer"
                title="এক ধাপ পেছনে যান"
              >
                <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">পেছনে</span>
              </button>
            )}
            <img 
              src={user.avatar} 
              alt="Avatar" 
              className="w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 border-indigo-500 bg-white shadow-sm object-cover shrink-0" 
            />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-gray-400 font-semibold leading-tight">স্বাগতম,</p>
              <h2 className="text-xs sm:text-sm font-extrabold text-indigo-950 flex items-center gap-1 min-w-0">
                <span className="truncate max-w-[100px] xs:max-w-[150px] sm:max-w-none">{user.name}</span>
                <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-yellow-500 animate-pulse shrink-0" />
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button 
              onClick={() => setActiveTab('profile')}
              className={`text-[11px] sm:text-xs font-bold px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl transition shrink-0 whitespace-nowrap ${activeTab === 'profile' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white hover:bg-gray-100 text-indigo-700'}`}
            >
              👤 প্রোফাইল
            </button>
            <button 
              onClick={onLogout}
              className="text-[11px] sm:text-xs font-bold text-rose-600 hover:text-rose-800 bg-white hover:bg-rose-50 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl border border-rose-100 transition shrink-0 whitespace-nowrap"
            >
              লগআউট
            </button>
          </div>
        </div>
      )}

      {/* Navigation Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
          />

          {/* Drawer Pane */}
          <div className="absolute inset-y-0 left-0 max-w-full flex">
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="w-full max-w-[320px] bg-white shadow-2xl flex flex-col justify-between border-r border-slate-100"
            >
              {/* Drawer Scrollable Content */}
              <div className="flex-1 overflow-y-auto py-5 px-4 flex flex-col gap-6">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-2">
                    <span className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
                      <Sparkles className="w-5 h-5 text-indigo-600 animate-pulse" />
                    </span>
                    <div>
                      <h3 className="font-extrabold text-[15.3px] text-indigo-950 tracking-wide">অর্জন অ্যাপ্লিকেশন</h3>
                      <p className="text-[10px] text-gray-400 font-bold uppercase">মেনু নেভিগেশন</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setDrawerOpen(false)}
                    className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-lg transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Profile Section inside drawer */}
                <div className="bg-gradient-to-br from-indigo-50/80 to-slate-50 border border-indigo-100/50 p-4 rounded-2xl flex items-center justify-between gap-3 shadow-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <img 
                      src={user.avatar} 
                      alt="Avatar" 
                      className="w-12 h-12 rounded-full border-2 border-indigo-400 bg-white object-cover shrink-0 cursor-pointer" 
                      onClick={() => {
                        openProfileModal();
                        setDrawerOpen(false);
                      }}
                    />
                    <div className="min-w-0">
                      <h4 className="text-[13.1px] font-bold text-slate-800 truncate">{user.name}</h4>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">{user.userId || user.phone || user.email}</p>
                      <div className="mt-1 flex items-center gap-1">
                        <span className="text-[9px] bg-indigo-100 text-indigo-850 px-2 py-0.5 rounded-full font-extrabold">
                          স্মার্ট লার্নার
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      openProfileModal();
                      setDrawerOpen(false);
                    }}
                    className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition shrink-0"
                    title="Profile Settings / সেটিংস"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </div>

                {/* Navigation Links */}
                <div className="flex flex-col gap-1.5">
                  {[
                    { id: 'dashboard', label: '📊 ড্যাশবোর্ড', icon: Home },
                    { id: 'preparation', label: '📚 বিষয়ভিত্তিক প্রস্তুতি', icon: BookOpen },
                    { id: 'job', label: '💼 জব সলিউশন ব্যাংক', icon: Layers },
                    { id: 'yearJob', label: '📅 সাল ভিত্তিক জব সলিউশন', icon: Calendar },
                    { id: 'exams', label: '⏱️ এক্সাম জোন (পরীক্ষা)', icon: Clock },
                    { id: 'bookmarks', label: '🔖 সেভকৃত বুকমার্কস', icon: BookmarkIcon },
                    { id: 'results', label: '📝 পরীক্ষার ফলাফল', icon: Award },
                    { id: 'courses', label: '🎓 চলমান কোর্স স্পেস', icon: GraduationCap },
                    { id: 'routines', label: '📅 একাডেমিক রুটিন', icon: Calendar },
                    { id: 'profile', label: '👤 প্রোফাইল ও সেটিংস', icon: UserIcon },
                  ].map(item => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          handleTabSelect(item.id as any);
                          setDrawerOpen(false);
                        }}
                        className={`flex items-center justify-between px-3.5 py-3 rounded-xl font-semibold text-[13.1px] border transition duration-200 ${
                          isActive 
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100 scale-[1.02]' 
                            : 'bg-slate-50/50 hover:bg-slate-100/70 text-slate-600 border-slate-100/80 hover:border-slate-200 hover:text-indigo-600'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`p-1.5 rounded-lg transition ${isActive ? 'bg-white/15 text-white' : 'text-slate-500 group-hover:text-indigo-600'}`}>
                            <Icon className="w-4 h-4" />
                          </span>
                          <span>{item.label}</span>
                        </div>
                        <ChevronRight className={`w-3.5 h-3.5 opacity-60 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col gap-2">
                <button
                  onClick={() => {
                    setDrawerOpen(false);
                    onLogout();
                  }}
                  className="w-full py-2.5 bg-white hover:bg-rose-50 text-rose-600 hover:text-rose-700 font-bold text-[13.1px] rounded-xl border border-rose-100 hover:border-rose-200 shadow-sm transition text-center flex items-center justify-center gap-1.5"
                >
                  🚪 লগআউট করুন
                </button>
                <p className="text-[9px] text-center text-slate-400 font-medium">অর্জন পোর্টাল © {new Date().getFullYear()}</p>
              </div>
            </motion.div>
          </div>
        </div>
      )}

      {/* -------------------- ACTIVE QUIZ ENGINE CONTAINER (SCROLL SYSTEM + PAGINATION) -------------------- */}
      {quizActive && (() => {
        const filteredQuizItems = quizQuestions.map((q, origIdx) => ({ q, origIdx })).filter(({ origIdx }) => {
          const isAnswered = userSelectedAnswers.hasOwnProperty(origIdx) && userSelectedAnswers[origIdx] !== 'Skipped';
          if (quizFilterMode === 'answered') return isAnswered;
          if (quizFilterMode === 'unanswered') return !isAnswered;
          return true;
        });

        const EXAM_PAGE_SIZE = 20;
        const totalExamPages = Math.ceil(filteredQuizItems.length / EXAM_PAGE_SIZE) || 1;
        const safeQuizPage = Math.min(Math.max(1, quizPage), totalExamPages);
        const startIdx = (safeQuizPage - 1) * EXAM_PAGE_SIZE;
        const endIdx = Math.min(startIdx + EXAM_PAGE_SIZE, filteredQuizItems.length);
        const currentPagedItems = filteredQuizItems.slice(startIdx, endIdx);
        const answeredExamCount = Object.keys(userSelectedAnswers).filter(
          k => userSelectedAnswers[Number(k)] && userSelectedAnswers[Number(k)] !== 'Skipped'
        ).length;
        const unansweredCount = Math.max(0, quizQuestions.length - answeredExamCount);

        const handleExamPageChange = (newPage: number) => {
          if (newPage < 1 || newPage > totalExamPages) return;
          setQuizPage(newPage);
          const topEl = document.getElementById('exam-scroll-top');
          if (topEl) {
            topEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        };

        const handleFilterChange = (mode: 'all' | 'answered' | 'unanswered') => {
          setQuizFilterMode(mode);
          setQuizPage(1);
          const topEl = document.getElementById('exam-scroll-top');
          if (topEl) {
            topEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        };

        return (
          <div className="flex-grow flex flex-col bg-white border border-slate-200/90 shadow-xl rounded-2xl p-3.5 sm:p-5 md:p-6 animate-fade-in space-y-4">
            <div id="exam-scroll-top" />
            
            {/* Sticky/Fixed Header Bar during Exam */}
            <div className="sticky top-2 z-20 bg-white/95 backdrop-blur-md border border-indigo-100 shadow-sm rounded-2xl p-3 sm:p-4 transition-all">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] bg-indigo-600 text-white font-black px-2.5 py-0.5 rounded-full shadow-xs tracking-wider uppercase">
                      চলমান পরীক্ষা (Active Exam)
                    </span>
                    {totalExamPages > 1 && (
                      <span className="text-[11px] bg-amber-50 text-amber-800 font-bold px-2.5 py-0.5 rounded-full border border-amber-200">
                        পৃষ্ঠা {toBengaliDigits(safeQuizPage)} / {toBengaliDigits(totalExamPages)}
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 mt-1 truncate">
                    {quizTitle}
                  </h3>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-between sm:justify-end w-full sm:w-auto">
                  {/* Timer indicator */}
                  {quizTimeLimitMinutes !== 'unlimited' && (
                    <div className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs sm:text-sm font-black flex items-center gap-1.5 shrink-0 whitespace-nowrap shadow-xs ${
                      secondsRemaining < 120 
                        ? 'bg-rose-500 text-white animate-pulse' 
                        : 'bg-rose-50 border border-rose-200 text-rose-700'
                    }`}>
                      <Clock className="w-4 h-4 shrink-0" />
                      <span>
                        {Math.floor(secondsRemaining / 60).toString().padStart(2, '0')}:
                        {(secondsRemaining % 60).toString().padStart(2, '0')}
                      </span>
                    </div>
                  )}

                  {/* Answered Counter */}
                  <div className="bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs sm:text-sm font-black px-2.5 sm:px-3 py-1.5 rounded-xl shrink-0 whitespace-nowrap shadow-2xs">
                    উত্তর: {toBengaliDigits(answeredExamCount)} / {toBengaliDigits(quizQuestions.length)}
                  </div>

                  {/* Header Submit Button */}
                  <button
                    onClick={() => {
                      showCustomConfirm(
                        `আপনি কি এই পরীক্ষাটি সমাপ্ত করতে চান?\n\n• মোট প্রশ্ন: ${toBengaliDigits(quizQuestions.length)}টি\n• উত্তর দিয়েছেন: ${toBengaliDigits(answeredExamCount)}টি\n• অনুত্তর/বাকি: ${toBengaliDigits(unansweredCount)}টি\n\nজমা দিলে আপনার ফলাফল তাৎক্ষণিক রেকর্ড হবে।`,
                        () => {
                          handleForceEndExam();
                        }
                      );
                    }}
                    className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-black px-3 py-1.5 rounded-xl shadow-xs transition shrink-0 flex items-center gap-1 cursor-pointer"
                  >
                    🛑 জমা দিন
                  </button>
                </div>
              </div>

              {/* Filter Tabs (Answered / Unanswered / All) Replacing Question Palette */}
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => handleFilterChange('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      quizFilterMode === 'all'
                        ? 'bg-white text-indigo-900 shadow-xs border border-indigo-100'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                    }`}
                  >
                    সব প্রশ্ন ({toBengaliDigits(quizQuestions.length)})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFilterChange('answered')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      quizFilterMode === 'answered'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-emerald-700 hover:text-emerald-900 hover:bg-white/50'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${quizFilterMode === 'answered' ? 'bg-white' : 'bg-emerald-500'}`} />
                    উত্তর দিয়েছেন ({toBengaliDigits(answeredExamCount)})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFilterChange('unanswered')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      quizFilterMode === 'unanswered'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-rose-700 hover:text-rose-900 hover:bg-white/50'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${quizFilterMode === 'unanswered' ? 'bg-white' : 'bg-rose-500'}`} />
                    অনুত্তর / বাকি ({toBengaliDigits(unansweredCount)})
                  </button>
                </div>

                {totalExamPages > 1 && (
                  <span className="text-[11px] bg-slate-100 text-slate-700 font-bold px-2.5 py-1 rounded-lg border border-slate-200">
                    পৃষ্ঠা {toBengaliDigits(safeQuizPage)} / {toBengaliDigits(totalExamPages)}
                  </span>
                )}
              </div>
            </div>

            {/* Page Subtitle & Info */}
            <div className="flex justify-between items-center px-1 text-xs text-slate-500 font-semibold">
              <span>
                {filteredQuizItems.length > 0 ? (
                  <>
                    প্রশ্ন তালিকা: <strong className="text-slate-800">{toBengaliDigits(startIdx + 1)}</strong> হতে <strong className="text-slate-800">{toBengaliDigits(endIdx)}</strong> (প্রতি পেজে সর্বোচ্চ ২০টি MCQ)
                  </>
                ) : (
                  <span className="text-rose-600">এই ফিল্টারে কোনো প্রশ্ন নেই</span>
                )}
              </span>
              {totalExamPages > 1 && (
                <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-bold text-[11px]">
                  পৃষ্ঠা {toBengaliDigits(safeQuizPage)} / {toBengaliDigits(totalExamPages)}
                </span>
              )}
            </div>

            {/* ---------------- SCROLLABLE QUESTIONS LIST (MAX 20 PER PAGE) ---------------- */}
            <div className="space-y-4">
              {currentPagedItems.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 border border-slate-200 rounded-2xl text-slate-500 text-sm font-semibold">
                  {quizFilterMode === 'answered' ? 'আপনি এখনো কোনো প্রশ্নের উত্তর দেননি।' : 'সকল প্রশ্নের উত্তর দেওয়া সম্পন্ন হয়েছে!'}
                </div>
              ) : (
                currentPagedItems.map(({ q, origIdx }) => {
                  const isSelected = userSelectedAnswers.hasOwnProperty(origIdx);
                  const selectedKey = userSelectedAnswers[origIdx];
                  const masterQ = questions.find(mq => mq.id === q?.id) || q;

                  return (
                    <div
                      key={q.id || origIdx}
                      id={`exam-card-q-${origIdx}`}
                      className="bg-white border border-slate-200/90 hover:border-indigo-300/80 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3.5 transition-all"
                    >
                      {/* Question Text with Number */}
                      <h4 className="text-sm sm:text-base font-bold text-slate-900 leading-relaxed">
                        {toBengaliDigits(origIdx + 1)}. {q.text}
                      </h4>

                      {/* 4 Options Grid (Responsive) - Locked after selection */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                        {[
                          { key: 'Option A', label: 'ক) ', text: q.optionA },
                          { key: 'Option B', label: 'খ) ', text: q.optionB },
                          { key: 'Option C', label: 'গ) ', text: q.optionC },
                          { key: 'Option D', label: 'ঘ) ', text: q.optionD }
                        ].map(opt => {
                          const isThisSelected = selectedKey === opt.key;
                          const isCorrect = opt.key === q.correct;

                          let cardStyle = "bg-white hover:bg-slate-50/80 border-slate-200 text-slate-800 font-medium cursor-pointer";
                          let radioStyle = "border-slate-300 bg-white";

                          if (isSelected) {
                            if (quizAnswerMode === 'instant') {
                              if (isCorrect) {
                                cardStyle = "bg-emerald-50 border-emerald-500 text-emerald-950 font-bold shadow-xs cursor-default";
                                radioStyle = "border-emerald-600 bg-emerald-600 text-white";
                              } else if (isThisSelected) {
                                cardStyle = "bg-rose-50 border-rose-500 text-rose-950 font-bold shadow-xs cursor-default";
                                radioStyle = "border-rose-600 bg-rose-600 text-white";
                              } else {
                                cardStyle = "border-slate-150 text-slate-400 opacity-60 bg-slate-50/50 cursor-default";
                                radioStyle = "border-slate-200 bg-slate-100";
                              }
                            } else {
                              if (isThisSelected) {
                                cardStyle = "bg-indigo-50/90 border-indigo-600 text-indigo-950 font-extrabold ring-2 ring-indigo-500/20 shadow-xs cursor-default";
                                radioStyle = "border-indigo-600 bg-indigo-600 text-white";
                              } else {
                                cardStyle = "bg-white border-slate-200 text-slate-400 opacity-70 cursor-not-allowed";
                                radioStyle = "border-slate-200 bg-slate-50";
                              }
                            }
                          }

                          return (
                            <button
                              key={opt.key}
                              type="button"
                              disabled={isSelected}
                              onClick={() => handleSelectOptionForIndex(origIdx, opt.key)}
                              className={`w-full text-left p-3 border rounded-xl text-xs sm:text-sm transition flex items-center justify-between gap-2.5 ${cardStyle}`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 text-[9px] font-black transition ${radioStyle}`}>
                                  {isThisSelected && <div className="w-1.5 h-1.5 rounded-full bg-current" />}
                                </div>
                                <span className="font-bold shrink-0">{opt.label}</span>
                                <span className="leading-snug break-words">{opt.text}</span>
                              </div>

                              {isSelected && quizAnswerMode === 'instant' && (
                                <div className="shrink-0">
                                  {isCorrect ? (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                  ) : isThisSelected ? (
                                    <XCircle className="w-4 h-4 text-rose-600" />
                                  ) : null}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Instant Mode Feedback Buttons */}
                      {isSelected && quizAnswerMode === 'instant' && (() => {
                        const hasPendingReport = !!masterQ?.comments?.some(c => !c.pointsApproved);
                        const hasPendingExplanation = !!masterQ?.userExplanations?.some(e => !e.approved);

                        return (
                          <div className="flex flex-row flex-wrap gap-2 items-center pt-2.5 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() => setPopupExplanationQ(masterQ)}
                              className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-[11px] transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                            >
                              💡 ব্যাখ্যা
                            </button>
                            <button
                              type="button"
                              disabled={hasPendingReport}
                              onClick={() => {
                                if (hasPendingReport) return;
                                setFlagModalQ(masterQ);
                                setFlagCommentText('');
                              }}
                              className="px-3 py-1.5 rounded-xl font-extrabold text-[11px] transition flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              🚩 রিপোর্ট
                            </button>
                            <button
                              type="button"
                              disabled={hasPendingExplanation || !allowUserExplanation}
                              onClick={() => {
                                if (hasPendingExplanation || !allowUserExplanation) return;
                                setUserExplModalQ(masterQ);
                                setUserExplText('');
                              }}
                              className="px-3 py-1.5 rounded-xl font-extrabold text-[11px] transition flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {allowUserExplanation ? '✍️ ব্যাখ্যা +' : '✍️ ব্যাখ্যা (বন্ধ)'}
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })
              )}
            </div>

            {/* ---------------- PAGINATION CONTROLS ---------------- */}
            {totalExamPages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-slate-200 p-3 sm:p-4 rounded-2xl shadow-2xs mt-4">
                <button
                  type="button"
                  disabled={safeQuizPage === 1}
                  onClick={() => handleExamPageChange(safeQuizPage - 1)}
                  className="px-3.5 py-2 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition shadow-2xs flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" /> পূর্ববর্তী পৃষ্ঠা
                </button>

                <div className="flex items-center gap-1.5 overflow-x-auto max-w-[60vw]">
                  {Array.from({ length: totalExamPages }, (_, i) => i + 1).map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handleExamPageChange(p)}
                      className={`w-8 h-8 rounded-xl text-xs font-black transition cursor-pointer ${
                        safeQuizPage === p
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-white hover:bg-indigo-50 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {toBengaliDigits(p)}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  disabled={safeQuizPage === totalExamPages}
                  onClick={() => handleExamPageChange(safeQuizPage + 1)}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white font-bold text-xs rounded-xl transition shadow-2xs flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
                >
                  পরবর্তী পৃষ্ঠা <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* ---------------- BOTTOM ACTIONS & SUBMIT ---------------- */}
            <div className="flex flex-col gap-3 pt-4 border-t border-slate-200">
              {/* Stats Summary Bar */}
              <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200 text-center">
                <div className="p-1">
                  <div className="text-[11px] text-slate-500 font-bold">মোট প্রশ্ন</div>
                  <div className="text-sm sm:text-base font-black text-slate-900">{toBengaliDigits(quizQuestions.length)}টি</div>
                </div>
                <div className="p-1 border-x border-slate-200">
                  <div className="text-[11px] text-emerald-700 font-bold">উত্তর দিয়েছেন</div>
                  <div className="text-sm sm:text-base font-black text-emerald-600">{toBengaliDigits(answeredExamCount)}টি</div>
                </div>
                <div className="p-1">
                  <div className="text-[11px] text-rose-700 font-bold">অনুত্তর / বাকি</div>
                  <div className="text-sm sm:text-base font-black text-rose-600">{toBengaliDigits(unansweredCount)}টি</div>
                </div>
              </div>

              {/* Big Submit Button */}
              <button
                type="button"
                onClick={() => {
                  showCustomConfirm(
                    `আপনি কি এই পরীক্ষাটি সমাপ্ত করতে চান?\n\n• মোট প্রশ্ন: ${toBengaliDigits(quizQuestions.length)}টি\n• উত্তর দিয়েছেন: ${toBengaliDigits(answeredExamCount)}টি\n• অনুত্তর/বাকি: ${toBengaliDigits(unansweredCount)}টি\n\nজমা দিলে আপনার ফলাফল তাৎক্ষণিক তৈরি হবে।`,
                    () => {
                      handleForceEndExam();
                    }
                  );
                }}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-black py-4 rounded-2xl text-sm transition shadow-lg shadow-rose-200/50 cursor-pointer flex items-center justify-center gap-2"
              >
                <span>🛑 পরীক্ষা সমাপ্ত করুন ও মার্কস জমা দিন</span>
              </button>

              {/* Cancel Button */}
              <button 
                type="button"
                onClick={() => {
                  showCustomConfirm(
                    'আপনি কি নিশ্চিত পরীক্ষা বাতিল করতে চান? এতে আপনার এই পরীক্ষার সমস্ত প্রগ্রেস হারিয়ে যাবে।',
                    () => {
                      setIsQuizTimerRunning(false);
                      setQuizActive(false);
                    }
                  );
                }}
                className="text-center text-slate-400 hover:text-slate-600 underline text-xs font-semibold py-1 transition cursor-pointer"
              >
                বাতিল করে চলে যান (ফলাফল সংরক্ষণ হবে না)
              </button>
            </div>
          </div>
        );
      })()}

      {/* -------------------- IMMERSIVE FULL SCREEN READER MODE -------------------- */}
      {readerModeActive && (() => {
        const filteredReaderQuestions = readerQuestions.filter(q => {
          if (readerSource === 'job' && readerCategoryFilter !== 'সব প্রশ্ন') {
            const normFilter = readerCategoryFilter.trim().toLowerCase();
            const matchCsv = q.csvCategory && q.csvCategory.trim().toLowerCase() === normFilter;
            const matchCat = q.category && q.category.trim().toLowerCase() === normFilter;
            const matchCats = q.categories && q.categories.some(c => c.trim().toLowerCase() === normFilter);
            return matchCsv || matchCat || matchCats;
          }
          return true;
        });

        const pageSize = 20;
        const totalPages = Math.ceil(filteredReaderQuestions.length / pageSize) || 1;
        const currentPage = Math.min(Math.max(1, readerPage), totalPages);
        const startIndex = (currentPage - 1) * pageSize;
        const paginatedQuestions = filteredReaderQuestions.slice(startIndex, startIndex + pageSize);

        const availableCategories = [
          'সব প্রশ্ন',
          ...Array.from(
            new Set(
              readerQuestions.flatMap(q => [
                q.csvCategory,
                q.category,
                ...(q.categories || [])
              ])
            )
          )
            .filter(Boolean)
            .map(c => String(c).trim())
            .filter(cat => cat && !cat.toLowerCase().includes('জব সলিউশন') && !cat.toLowerCase().includes('job'))
        ];

        return (
          <div className="flex-grow flex flex-col justify-between bg-white border border-gray-100 shadow-xl rounded-2xl p-2.5 sm:p-3.5 animate-fade-in min-h-[85vh]">
            <div id="reader-questions-top" className="flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center border-b pb-3.5">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setReaderModeActive(false)}
                  className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition flex items-center justify-center shrink-0 border border-gray-200/40"
                  title="বন্ধ করুন"
                >
                  <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
                </button>
                <div>
                  <span className="text-[9px] bg-indigo-50 text-indigo-700 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    রিডার ও প্র্যাকটিস
                  </span>
                  <h3 className="text-xs font-extrabold text-gray-800 mt-0.5 leading-tight">{readerTitle}</h3>
                </div>
              </div>
              
              {/* Mode Switcher Buttons */}
              <div className="flex flex-row bg-gray-100 p-0.5 rounded-xl gap-0.5 font-bold text-[10px] border border-gray-200/60 max-w-full overflow-x-auto self-center md:self-auto">
                <button
                  onClick={() => setReaderActiveMode('read')}
                  className={`px-3 py-1.5 rounded-lg text-center transition flex items-center gap-1 whitespace-nowrap ${
                    readerActiveMode === 'read' 
                      ? 'bg-indigo-600 text-white shadow-sm' 
                      : 'text-gray-600 hover:text-indigo-600 hover:bg-white/40'
                  }`}
                >
                  📖 পড়া
                </button>
                <button
                  onClick={() => setReaderActiveMode('verify')}
                  className={`px-3 py-1.5 rounded-lg text-center transition flex items-center gap-1 whitespace-nowrap ${
                    readerActiveMode === 'verify' 
                      ? 'bg-purple-600 text-white shadow-sm' 
                      : 'text-gray-600 hover:text-purple-600 hover:bg-white/40'
                  }`}
                >
                  ✏️ যাচাই
                </button>
                <button
                  onClick={() => {
                    const cleanedTitle = readerTitle
                      .replace('অধ্যায়ভিত্তিক অনুশীলন: ', '')
                      .replace('পরীক্ষাভিত্তিক অনুশীলন: ', '')
                      .replace('বিষয়ভিত্তিক অনুশীলন: ', '');
                    
                    const poolToUse = readerCategoryFilter === 'সব প্রশ্ন' 
                      ? readerQuestions 
                      : readerQuestions.filter(q => {
                          const normFilter = readerCategoryFilter.trim().toLowerCase();
                          const matchCsv = q.csvCategory && q.csvCategory.trim().toLowerCase() === normFilter;
                          const matchCat = q.category && q.category.trim().toLowerCase() === normFilter;
                          const matchCats = q.categories && q.categories.some(c => c.trim().toLowerCase() === normFilter);
                          return matchCsv || matchCat || matchCats;
                        });
                    setCustomExamOverridePool(poolToUse);
                    setCustomExamTitle(`পরীক্ষা: ${cleanedTitle}`);
                    setSetupModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-lg text-center transition text-gray-600 hover:text-amber-600 hover:bg-white/40 flex items-center gap-1 whitespace-nowrap cursor-pointer"
                >
                  ⏱️ পরিক্ষা
                </button>
              </div>
            </div>

            {/* Category Filter for Job Solution Bank */}
            {readerSource === 'job' && (
              <div className="mt-3.5 flex flex-col gap-1.5 bg-emerald-50/10 p-3 rounded-2xl border border-emerald-100/30">
                <span className="text-[10px] font-extrabold text-emerald-900 mr-1.5 flex items-center gap-1">
                  🎯 বিষয় অনুযায়ী ফিল্টার করুন:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {availableCategories.map(cat => {
                    const isSelected = readerCategoryFilter === cat;
                    const catQCount = cat === 'সব প্রশ্ন' 
                      ? readerQuestions.length 
                      : readerQuestions.filter(q => {
                          const normFilter = cat.trim().toLowerCase();
                          const matchCsv = q.csvCategory && q.csvCategory.trim().toLowerCase() === normFilter;
                          const matchCat = q.category && q.category.trim().toLowerCase() === normFilter;
                          const matchCats = q.categories && q.categories.some(c => c.trim().toLowerCase() === normFilter);
                          return matchCsv || matchCat || matchCats;
                        }).length;
                    
                    return (
                      <button
                        key={cat}
                        onClick={() => {
                          setReaderCategoryFilter(cat);
                          setReaderPage(1); // Reset page to 1
                        }}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all border ${
                          isSelected 
                            ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm' 
                            : 'bg-white border-gray-200 hover:border-emerald-300 text-gray-700 hover:text-emerald-800'
                        }`}
                      >
                        {cat} ({catQCount.toLocaleString('bn-BD')}টি)
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Questions container - Clean full screen layout, no nested scroll view */}
            <div className="my-3 flex-grow space-y-3">
              {paginatedQuestions.length === 0 ? (
                <div className="text-center py-6 text-gray-500 font-bold bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                  এই ক্যাটাগরিতে কোনো প্রশ্ন খুঁজে পাওয়া যায়নি।
                </div>
              ) : (
                paginatedQuestions.map((q, i) => {
                const idx = startIndex + i;
                const selectedOpt = readerSelectedAnswers[q.id];
                const hasSelected = !!selectedOpt;
                
                return (
                  <div key={q.id} className="p-2.5 sm:p-3 bg-gray-50 rounded-xl border border-gray-100 relative text-xs shadow-xs">
                    {/* Save bookmark option */}
                    <button 
                      onClick={() => handleOpenBookmarkDialog(q.id)}
                      className={`absolute top-3 right-3 font-bold flex items-center gap-1 text-[10px] ${
                        bookmarks.some(b => b.questionId === q.id)
                          ? 'text-yellow-600' 
                          : 'text-gray-400 hover:text-amber-500'
                      }`}
                    >
                      <BookmarkIcon className={`w-3.5 h-3.5 ${
                        bookmarks.some(b => b.questionId === q.id)
                          ? 'fill-yellow-300 text-yellow-500' 
                          : ''
                      }`} /> {bookmarks.some(b => b.questionId === q.id) ? 'বুকমার্কড' : 'বুকমার্ক'}
                    </button>

                    <h4 className="font-extrabold text-gray-900 leading-relaxed mb-3 pr-20">
                      {(idx+1).toLocaleString('bn-BD')}. {q.text}
                      {(() => {
                        if (readerSource !== 'prep') return null;
                        const subs = Array.from(new Set(
                          q.subcategories && q.subcategories.length > 0 
                            ? q.subcategories 
                            : (q.subcategory ? [q.subcategory] : [])
                        )).filter(Boolean);
                        if (subs.length === 0) return null;
                        return (
                          <span className="text-[10px] font-extrabold text-emerald-600 bg-emerald-50/80 px-1.5 py-0.5 rounded-md border border-emerald-100 inline-flex items-center gap-1 ml-2 font-sans align-middle">
                            ({subs.join(', ')})
                          </span>
                        );
                      })()}
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-gray-600 mb-3 font-semibold text-[11px]">
                      {['Option A', 'Option B', 'Option C', 'Option D'].map((optKey) => {
                        const optText = optKey === 'Option A' ? q.optionA : optKey === 'Option B' ? q.optionB : optKey === 'Option C' ? q.optionC : q.optionD;
                        const label = optKey === 'Option A' ? 'ক) ' : optKey === 'Option B' ? 'খ) ' : optKey === 'Option C' ? 'গ) ' : 'ঘ) ';
                        
                        if (readerActiveMode === 'read') {
                          const isCorrect = q.correct === optKey;
                          return (
                            <div 
                              key={optKey} 
                              className={`p-2.5 rounded-xl border ${isCorrect ? 'bg-green-50 border-green-300 text-green-800 font-extrabold shadow-xs' : 'bg-white border-gray-100'}`}
                            >
                              {label}{optText}
                            </div>
                          );
                        } else {
                          const isSelected = selectedOpt === optKey;
                          const isCorrect = q.correct === optKey;
                          
                          let btnStyle = 'bg-white border-gray-100 hover:bg-gray-100/50';
                          if (isSelected) {
                            btnStyle = isCorrect 
                              ? 'bg-green-50 border-green-300 text-green-800 font-extrabold shadow-xs'
                              : 'bg-rose-50 border-rose-300 text-rose-800 font-extrabold shadow-xs';
                          } else if (hasSelected && isCorrect) {
                            btnStyle = 'bg-green-50 border-green-200 text-green-700 font-bold';
                          }

                          return (
                            <button
                              key={optKey}
                              disabled={hasSelected}
                              onClick={() => {
                                setReaderSelectedAnswers(prev => ({ ...prev, [q.id]: optKey }));
                              }}
                              className={`w-full text-left p-2.5 rounded-xl border transition ${btnStyle}`}
                            >
                              {label}{optText}
                            </button>
                          );
                        }
                      })}
                    </div>

                    {(() => {
                      const masterQ = questions.find(mq => mq.id === q.id) || q;
                      const hasPendingReport = !!masterQ?.comments?.some(c => !c.pointsApproved);
                      const hasPendingExplanation = !!masterQ?.userExplanations?.some(e => !e.approved);

                      return (
                        <div className="flex flex-row flex-wrap gap-2 items-center mt-3 pt-2.5 border-t border-gray-100/50">
                          <button
                            type="button"
                            onClick={() => setPopupExplanationQ(masterQ)}
                            className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[10px] transition cursor-pointer flex items-center gap-1"
                          >
                            💡 ব্যাখা
                          </button>
                          <button
                            type="button"
                            disabled={hasPendingReport}
                            onClick={() => {
                              if (hasPendingReport) return;
                              setFlagModalQ(masterQ);
                              setFlagCommentText('');
                            }}
                            className="px-2.5 py-1 rounded-lg font-bold text-[10px] transition flex items-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-100/50 cursor-pointer disabled:bg-rose-100/80 disabled:text-rose-700/80 disabled:border-rose-200/50 disabled:opacity-100 disabled:cursor-not-allowed"
                          >
                            🚩 রিপোর্ট
                          </button>
                          <button
                            type="button"
                            disabled={hasPendingExplanation || !allowUserExplanation}
                            onClick={() => {
                              if (hasPendingExplanation || !allowUserExplanation) return;
                              setUserExplModalQ(masterQ);
                              setUserExplText('');
                            }}
                            className="px-2.5 py-1 rounded-lg font-bold text-[10px] transition flex items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-100/50 cursor-pointer disabled:bg-amber-100/85 disabled:text-amber-700/80 disabled:border-amber-200/50 disabled:opacity-100 disabled:cursor-not-allowed"
                          >
                            {allowUserExplanation ? '✍️ ব্যাখ্যা +' : '✍️ ব্যাখ্যা (বন্ধ)'}
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                );
              }))}
            </div>

            {/* Pagination Controls - Simple 1, 2, 3 buttons */}
            {totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-center gap-1.5 border-t border-gray-100 pt-4 pb-2 mt-4">
                <button
                  disabled={currentPage === 1}
                  onClick={() => {
                    setReaderPage(p => Math.max(1, p - 1));
                    const el = document.getElementById('reader-questions-top');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="px-3 py-1.5 bg-white hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-600 rounded-lg border border-gray-200 transition text-[11px] font-bold shadow-xs"
                >
                  ◀
                </button>
                
                {Array.from({ length: totalPages }, (_, index) => {
                  const pNum = index + 1;
                  const isSelected = pNum === currentPage;
                  return (
                    <button
                      key={pNum}
                      onClick={() => {
                        setReaderPage(pNum);
                        const el = document.getElementById('reader-questions-top');
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-extrabold transition border ${
                        isSelected 
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' 
                          : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {pNum.toLocaleString('bn-BD')}
                    </button>
                  );
                })}

                <button
                  disabled={currentPage === totalPages}
                  onClick={() => {
                    setReaderPage(p => Math.min(totalPages, p + 1));
                    const el = document.getElementById('reader-questions-top');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="px-3 py-1.5 bg-white hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-600 rounded-lg border border-gray-200 transition text-[11px] font-bold shadow-xs"
                >
                  ▶
                </button>
              </div>
            )}

            <button 
              onClick={() => setReaderModeActive(false)}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 mt-4 rounded-2xl text-xs transition shadow-sm"
            >
              পড়া শেষ করেছি (ড্যাশবোর্ডে ফিরে যান)
            </button>
          </div>
        );
      })()}

      {/* -------------------- USER MAIN PORTAL SCREEN -------------------- */}
      {!quizActive && !readerModeActive && (
        viewingHierarchyRoutine ? (
          <RoutineHierarchicalMCQModal
            routine={viewingHierarchyRoutine}
            questions={questions}
            categories={categories}
            subcategories={subcategories}
            bookmarks={bookmarks}
            onClose={() => setViewingHierarchyRoutine(null)}
            onStartPractice={startDemoExam}
            onToggleBookmark={(qId: string) => {
              const existing = bookmarks.find(b => b.questionId === qId);
              if (existing) {
                onRemoveBookmark(existing.id);
              } else {
                handleOpenBookmarkDialog(qId);
              }
            }}
          />
        ) : (
        <div className="flex-grow flex flex-col gap-3 animate-fade-in">
          
          {/* VIEW: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="flex flex-col gap-3">
              
              {/* Main Notice Banner */}
              {notices.length > 0 && notices[0]?.text && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-l-4 border-amber-500 p-2.5 rounded-r-2xl shadow-sm text-xs leading-relaxed animate-pulse">
                  <div className="flex items-center gap-1.5 font-bold text-amber-950 mb-0.5">
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span>সর্বশেষ একাডেমিক নোটিশ</span>
                  </div>
                  <p className="text-gray-700 font-medium whitespace-pre-line">{notices[0].text}</p>
                </div>
              )}

              {/* Category Grid Section */}
              <div className="bg-white border border-gray-100 p-3 rounded-2xl shadow-sm">
                <h3 className="text-xs font-extrabold text-gray-800 mb-2 uppercase tracking-wider flex items-center gap-1.5">
                  <Compass className="w-4 h-4 text-indigo-600" />
                  দ্রুত নেভিগেশন ক্যাটাগরি
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  <div 
                    onClick={() => { if (!checkGuestAccess('কাস্টম পরীক্ষা ও প্র্যাকটিস এক্সাম')) return; setRevisionMode(false); setSetupModalOpen(true); }}
                    className="cursor-pointer p-2.5 rounded-xl border bg-gradient-to-br from-indigo-50/50 to-indigo-100/30 border-indigo-150 hover:shadow transition flex flex-col justify-between min-h-[85px]"
                  >
                    <span className="text-xl">⏱️</span>
                    <div>
                      <h4 className="text-xs font-bold text-indigo-950">কাস্টম পরীক্ষা</h4>
                      <p className="text-[9px] text-indigo-700/80 mt-0.5">টাইমার সহ মক টেস্ট</p>
                    </div>
                  </div>

                  <div 
                    onClick={() => {
                      setSelectedCourseFilter('all');
                      handleTabSelect('courses');
                    }}
                    className="cursor-pointer p-2.5 rounded-xl border bg-gradient-to-br from-blue-50/50 to-blue-100/30 border-blue-150 hover:shadow transition flex flex-col justify-between min-h-[85px]"
                  >
                    <span className="text-xl">🎓</span>
                    <div>
                      <h4 className="text-xs font-bold text-blue-950">চলমান কোর্স</h4>
                      <p className="text-[9px] text-blue-700/80 mt-0.5">সকল প্রকার কোর্স ও স্টাডি</p>
                    </div>
                  </div>

                  <div 
                    onClick={() => handleTabSelect('currentAffairs')}
                    className="cursor-pointer p-2.5 rounded-xl border bg-gradient-to-br from-teal-50/50 to-teal-100/30 border-teal-150 hover:shadow transition flex flex-col justify-between min-h-[85px]"
                  >
                    <span className="text-xl">🌍</span>
                    <div>
                      <h4 className="text-xs font-bold text-teal-950">সাম্প্রতিক বিষয়াবলী</h4>
                      <p className="text-[9px] text-teal-700/80 mt-0.5">দৈনিক বুলেট পয়েন্ট ও প্রশ্ন</p>
                    </div>
                  </div>

                  <div 
                    onClick={() => handleTabSelect('preparation')}
                    className="cursor-pointer p-2.5 rounded-xl border bg-gradient-to-br from-purple-50/50 to-purple-100/30 border-purple-150 hover:shadow transition flex flex-col justify-between min-h-[85px]"
                  >
                    <span className="text-xl">📚</span>
                    <div>
                      <h4 className="text-xs font-bold text-purple-950">প্রস্তুতি জোন</h4>
                      <p className="text-[9px] text-purple-700/80 mt-0.5">বিষয়ভিত্তিক সেলফ স্টাডি</p>
                    </div>
                  </div>

                  <div 
                    onClick={() => handleTabSelect('job')}
                    className="cursor-pointer p-2.5 rounded-xl border bg-gradient-to-br from-emerald-50/50 to-emerald-100/30 border-emerald-150 hover:shadow transition flex flex-col justify-between min-h-[85px]"
                  >
                    <span className="text-xl">💼</span>
                    <div>
                      <h4 className="text-xs font-bold text-emerald-950">জব সলিউশন ব্যাংক</h4>
                      <p className="text-[9px] text-emerald-700/80 mt-0.5">বিগত বছরের প্রশ্নসমূহ</p>
                    </div>
                  </div>

                  <div 
                    onClick={() => handleTabSelect('yearJob')}
                    className="cursor-pointer p-2.5 rounded-xl border bg-gradient-to-br from-amber-50/50 to-amber-100/30 border-amber-150 hover:shadow transition flex flex-col justify-between min-h-[85px]"
                  >
                    <span className="text-xl">📅</span>
                    <div>
                      <h4 className="text-xs font-bold text-amber-950">সাল ভিত্তিক জব সলিউশন</h4>
                      <p className="text-[9px] text-amber-700/80 mt-0.5">বছর অনুযায়ী সরকারি পরীক্ষা</p>
                    </div>
                  </div>

                  <div 
                    onClick={() => handleTabSelect('bookmarks')}
                    className="cursor-pointer p-2.5 rounded-xl border bg-gradient-to-br from-rose-50/50 to-rose-100/30 border-rose-150 hover:shadow transition flex flex-col justify-between min-h-[85px]"
                  >
                    <span className="text-xl">🔖</span>
                    <div>
                      <h4 className="text-xs font-bold text-rose-950">বুকমার্ক কালেকশন</h4>
                      <p className="text-[9px] text-rose-700/80 mt-0.5">সংরক্ষিত গুরুত্বপূর্ণ প্রশ্ন</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pure SVG Dynamic Analytics Chart */}
              <div className="bg-white border border-gray-100 p-3 sm:p-3.5 rounded-2xl shadow-sm flex flex-col">
                <h3 className="text-xs font-extrabold text-gray-800 mb-0.5 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-indigo-600" />
                  বিষয়ভিত্তিক নির্ভুলতা সূচক (Performance Rate)
                </h3>
                <p className="text-[10px] text-gray-400 mb-2 font-semibold">বিগত পরীক্ষাগুলোর ফলাফলের ওপর ভিত্তি করে পরিসংখ্যান</p>
                
                {Object.keys(categoryAnalytics).length === 0 ? (
                  <div className="text-center py-6 text-gray-400 text-xs">
                     কোনো পরীক্ষার ডাটা নেই। কুইজে অংশ নিলে এখানে চার্ট প্রদর্শিত হবে।
                  </div>
                ) : (
                  <div className="space-y-3.5 text-xs">
                    {Object.entries(categoryAnalytics).map(([cat, val]) => {
                      const percentage = val.total > 0 ? Math.round((val.correct / val.total) * 100) : 0;
                      return (
                        <div key={cat} className="flex items-center gap-3">
                          <span className="w-24 font-bold text-gray-700 truncate">{cat}</span>
                          <div className="flex-grow bg-gray-100 h-3 rounded-full overflow-hidden">
                            <div 
                              className="bg-indigo-600 h-full rounded-full transition-all duration-500" 
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="w-12 text-right font-extrabold text-indigo-950">{percentage}%</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Strong and Weak Zone cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-start gap-2.5">
                  <span className="bg-green-100 text-green-700 p-1.5 rounded-xl font-bold">🟢</span>
                  <div>
                    <h5 className="font-extrabold text-emerald-950 text-xs">স্ট্রং জোন (সবচেয়ে ভালো)</h5>
                    <p className="text-[11px] text-emerald-800 font-semibold mt-1">{strongCategory}</p>
                  </div>
                </div>

                <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex items-start gap-2.5">
                  <span className="bg-rose-100 text-rose-700 p-1.5 rounded-xl font-bold">🔴</span>
                  <div>
                    <h5 className="font-extrabold text-rose-950 text-xs">উইক জোন (মনোযোগ দিন)</h5>
                    <p className="text-[11px] text-rose-800 font-semibold mt-1">{weakCategory}</p>
                  </div>
                </div>
              </div>

              {/* History, Courses & Routines Quick View */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button 
                  onClick={() => handleTabSelect('courses')}
                  className="bg-indigo-900 hover:bg-indigo-950 text-white p-3.5 rounded-2xl text-center shadow transition flex items-center justify-between font-bold text-xs"
                >
                  🎓 চলমান কোর্স ও স্টাডি স্পেস
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => handleTabSelect('results')}
                  className="bg-indigo-900 hover:bg-indigo-950 text-white p-3.5 rounded-2xl text-center shadow transition flex items-center justify-between font-bold text-xs"
                >
                  📊 ফলাফল ও বিস্তারিত উত্তরপত্র
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => handleTabSelect('routines')}
                  className="bg-indigo-900 hover:bg-indigo-950 text-white p-3.5 rounded-2xl text-center shadow transition flex items-center justify-between font-bold text-xs"
                >
                  📅 একাডেমিক রুটিন ও শিডিউল
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

            </div>
          )}

          {/* VIEW: PREPARATION / SELF-STUDY */}
          {activeTab === 'preparation' && (() => {
            const isPrepRoot = prepPath.length === 0;
            const currentPrepNode = isPrepRoot ? '' : prepPath[prepPath.length - 1];
            const prepQuestions = getQuestionsForPrepNode(currentPrepNode, isPrepRoot);
            
            // Get items to display at current level (excluding root categories, self-references, or duplicates)
            const prepItems = Array.from(new Set(isPrepRoot 
              ? subcategories.filter(s => 
                  s.parentCategory === 'বিষয়ভিত্তিক প্রস্তুতি' && 
                  s.name.trim().toLowerCase() !== 'বিষয়ভিত্তিক প্রস্তুতি'.toLowerCase()
                ).map(s => s.name.trim())
              : subcategories.filter(s => 
                  s.parentCategory && 
                  s.parentCategory.trim().toLowerCase() === currentPrepNode.trim().toLowerCase() &&
                  s.name.trim().toLowerCase() !== currentPrepNode.trim().toLowerCase() &&
                  s.name.trim().toLowerCase() !== 'বিষয়ভিত্তিক প্রস্তুতি'.toLowerCase()
                ).map(s => s.name.trim())));

            return (
              <div className="bg-white border border-slate-200/60 p-2 sm:p-3.5 rounded-xl shadow-2xs flex flex-col gap-3 text-xs animate-fade-in">
                {/* Interactive Breadcrumbs */}
                {!isPrepRoot && (
                  <div className="flex flex-wrap items-center gap-1 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200/60">
                    <button 
                      onClick={() => setPrepPath([])}
                      className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 transition text-[11px]"
                    >
                      <Home className="w-3.5 h-3.5" />
                      <span>প্রস্তুতি হোম</span>
                    </button>
                    {prepPath.map((pathItem, index) => {
                      const isLast = index === prepPath.length - 1;
                      return (
                        <React.Fragment key={`prep-path-${pathItem}-${index}`}>
                          <ChevronRight className="w-3 h-3 text-gray-400" />
                          {isLast ? (
                            <span className="text-gray-800 font-extrabold">{pathItem}</span>
                          ) : (
                            <button 
                              onClick={() => setPrepPath(prepPath.slice(0, index + 1))}
                              className="text-indigo-600 hover:text-indigo-800 font-bold transition"
                            >
                              {pathItem}
                            </button>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}

                {/* Sub-Folders / Content Items */}
                <div className="flex flex-col gap-2">
                  {!isPrepRoot && (
                    <div className="flex justify-between items-center px-0.5 my-0.5">
                      <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">
                        {subcategories.filter(s => s.parentCategory && s.parentCategory.trim().toLowerCase() === currentPrepNode.trim().toLowerCase()).length > 0 ? '📁 উপ-অধ্যায়সমূহ' : '📖 কোনো উপ-অধ্যায় নেই'}
                      </span>
                      <button 
                        onClick={() => setPrepPath(prepPath.slice(0, -1))}
                        className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 text-[11px]"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" /> পেছনে যান
                      </button>
                    </div>
                  )}

                  {prepItems.length === 0 ? (
                    <div className="text-center text-gray-400 py-6 bg-gray-50 rounded-lg border border-dashed text-xs">
                      এই স্তরে কোনো সাব-ক্যাটাগরি বা অধ্যায় তৈরি করা নেই।
                    </div>
                  ) : (() => {
                    const categoryItems = prepItems.filter(item =>
                      subcategories.some(s => s.parentCategory && s.parentCategory.trim().toLowerCase() === item.trim().toLowerCase())
                    );
                    const leafItems = prepItems.filter(item =>
                      !subcategories.some(s => s.parentCategory && s.parentCategory.trim().toLowerCase() === item.trim().toLowerCase())
                    );

                    return (
                      <div className="flex flex-col gap-3">
                        {/* Parent Category Grid Cards */}
                        {categoryItems.length > 0 && (
                          <div className="flex flex-col gap-1.5">
                            {!isPrepRoot && leafItems.length > 0 && (
                              <span className="text-[10px] font-extrabold text-indigo-900 uppercase tracking-wider px-0.5">
                                📁 বিষয় ও ক্যাটাগরি কার্ডসমূহ
                              </span>
                            )}
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                              {categoryItems.map((item, idx) => {
                                const qCount = getQuestionsForPrepNode(item, false).length;
                                const subCount = subcategories.filter(s => s.parentCategory && s.parentCategory.trim().toLowerCase() === item.trim().toLowerCase()).length;
                                const theme = getSubjectTheme(item);
                                const targetSub = subcategories.find(s => s.name.trim().toLowerCase() === item.trim().toLowerCase());
                                const targetCat = categories.find(c => c.name.trim().toLowerCase() === item.trim().toLowerCase());
                                const itemSubHeading = targetSub?.subHeading || targetCat?.subHeading;

                                return (
                                  <button
                                    key={`prep-cat-${idx}-${item}`}
                                    id={`prep-cat-card-${idx}`}
                                    onClick={() => {
                                      setPrepPath(isPrepRoot ? [item] : [...prepPath, item]);
                                    }}
                                    className={`group bg-white ${theme.hoverBg} border ${theme.border} ${theme.hoverBorder} rounded-xl p-2.5 sm:p-3 flex flex-col justify-between gap-2 text-left shadow-2xs hover:shadow-xs transition-all duration-150 cursor-pointer active:scale-98`}
                                  >
                                    <div className="flex items-center justify-between gap-1">
                                      <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg ${theme.bg} text-white flex items-center justify-center shadow-2xs shrink-0 group-hover:scale-105 transition-transform`}>
                                        {renderSubjectIcon(item, "w-4 h-4")}
                                      </div>
                                      <span className={`text-[9px] sm:text-[9.5px] ${theme.badgeBg} font-extrabold px-1.5 py-0.5 rounded-md border shrink-0`}>
                                        {subCount.toLocaleString('bn-BD')} টি উপ-অধ্যায়
                                      </span>
                                    </div>

                                    <div className="my-0.5">
                                      <h4 className="font-black text-[12.5px] sm:text-[13.5px] text-slate-900 group-hover:text-indigo-950 transition-colors leading-snug line-clamp-2">
                                        {item}
                                      </h4>
                                      {itemSubHeading && (
                                        <p className={`text-[10px] ${theme.subText} font-extrabold leading-tight mt-1 line-clamp-1`}>
                                          {itemSubHeading}
                                        </p>
                                      )}
                                    </div>

                                    <div className="pt-1.5 border-t border-slate-100/90 flex items-center justify-between text-[9px] sm:text-[9.5px]">
                                      {showMcqCount ? (
                                        <span className="bg-slate-900 text-white font-extrabold px-1.5 py-0.5 rounded-md shadow-2xs">
                                          {qCount.toLocaleString('bn-BD')} MCQ
                                        </span>
                                      ) : <span />}
                                      <span className={`${theme.subText} font-black flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform`}>
                                        খুলুন <ChevronRight className="w-3 h-3" />
                                      </span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Leaf Category List */}
                        {leafItems.length > 0 && (
                          <div className="flex flex-col gap-1.5">
                            {categoryItems.length > 0 && (
                              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider px-0.5 mt-0.5">
                                📖 অধ্যায়ভিত্তিক পড়ার তালিকা
                              </span>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                              {leafItems.map((item, idx) => {
                                const subObj = subcategories.find(s => s.name.trim().toLowerCase() === item.trim().toLowerCase());
                                const catObj = categories.find(c => c.name.trim().toLowerCase() === item.trim().toLowerCase());
                                const itemSubHeading = subObj?.subHeading || catObj?.subHeading;
                                const qCount = getQuestionsForPrepNode(item, false).length;
                                const theme = getSubjectTheme(item);

                                return (
                                  <button
                                    key={`prep-leaf-${idx}-${item}`}
                                    id={`prep-leaf-btn-${idx}`}
                                    onClick={async () => {
                                      if (user.isGuest) {
                                        checkGuestAccess(`"${item}" - অধ্যায়ভিত্তিক MCQ সমাধান`);
                                        return;
                                      }
                                      let subcatQuestions = getQuestionsForPrepNode(item, false);
                                      if (subcatQuestions.length === 0 && onFetchQuestionsLazy) {
                                        const fetched = await onFetchQuestionsLazy({ category: item, subcategory: item });
                                        subcatQuestions = fetched.filter(q => 
                                          q.category === item || q.subcategory === item ||
                                          (q.categories && q.categories.includes(item)) ||
                                          (q.subcategories && q.subcategories.includes(item))
                                        );
                                      }
                                      setReaderQuestions(subcatQuestions);
                                      setReaderTitle(`অধ্যায়ভিত্তিক অনুশীলন: ${item}`);
                                      setReaderActiveMode('read');
                                      setReaderSelectedAnswers({});
                                      setReaderPage(1);
                                      setReaderSource('prep');
                                      setReaderCategoryFilter('সব প্রশ্ন');
                                      setReaderModeActive(true);
                                    }}
                                    className={`flex items-center justify-between py-3.5 px-3.5 sm:py-4 sm:px-4 bg-white hover:${theme.lightBg} text-slate-900 rounded-xl font-bold text-xs transition border ${theme.border} ${theme.hoverBorder} shadow-2xs text-left group cursor-pointer`}
                                  >
                                    <div className="flex items-center gap-3">
                                      <span className={`w-8.5 h-8.5 sm:w-9.5 sm:h-9.5 flex items-center justify-center rounded-lg ${theme.lightBg} ${theme.text} border ${theme.border} shrink-0 group-hover:scale-105 transition-transform`}>
                                        {renderSubjectIcon(item, "w-4.5 h-4.5")}
                                      </span>
                                      <div className="flex flex-col">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="font-black text-slate-900 text-[13.5px] sm:text-[15px] group-hover:text-indigo-950 transition-colors">{item}</span>
                                          {user.isGuest && (
                                            <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 border border-amber-300/80 font-black px-2 py-0.5 rounded-md text-[10px] shadow-2xs">
                                              🔒 লক করা
                                            </span>
                                          )}
                                        </div>
                                        {itemSubHeading && (
                                          <span className={`text-[10.5px] sm:text-[11.5px] ${theme.subText} font-extrabold mt-0.5`}>{itemSubHeading}</span>
                                        )}
                                        {subObj?.date && (
                                          <span className="text-[10px] text-emerald-800 font-extrabold flex items-center gap-1 mt-0.5 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/80 w-max">
                                            <Calendar className="w-3 h-3 text-emerald-600" />
                                            {formatBengaliDate(subObj.date)}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    {user.isGuest ? (
                                      <span className="text-[10px] bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-2.5 py-1 rounded-md shrink-0 shadow-2xs flex items-center gap-1">
                                        🔒 আনলক করুন
                                      </span>
                                    ) : showMcqCount ? (
                                      <span className="text-[10px] bg-slate-900 text-white font-black px-2.5 py-1 rounded-md shrink-0 shadow-2xs">
                                        {qCount.toLocaleString('bn-BD')} MCQ
                                      </span>
                                    ) : null}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {prepQuestions.length === 0 && !isPrepRoot && (
                  <div className="mt-1 bg-gray-50 border border-gray-100 p-4 rounded-xl text-center text-gray-500 font-bold text-[11px] flex flex-col gap-1">
                    <span>🎯 এই উপ-অধ্যায়ে এখনো কোনো প্রশ্ন যোগ করা হয়নি।</span>
                    <span className="text-[10px] text-gray-400 font-semibold">এডমিন প্যানেল থেকে এই উপ-অধ্যায়ে নতুন প্রশ্ন যোগ করতে পারেন।</span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* VIEW: JOB SOLUTION BANK */}
          {activeTab === 'job' && (() => {
            const isJobRoot = jobPath.length === 0;
            const currentJobNode = isJobRoot ? '' : jobPath[jobPath.length - 1];
            const jobQuestions = getQuestionsForJobNode(currentJobNode, isJobRoot);

            // Get items to display at current level
            const jobRawItems = isJobRoot
              ? subcategories.filter(s => isJobSolutionVariation(s.parentCategory)).map(s => s.name.trim())
              : subcategories.filter(s => s.parentCategory && s.parentCategory.trim().toLowerCase() === currentJobNode.trim().toLowerCase()).map(s => s.name.trim());

            const jobItems = Array.from(new Set(jobRawItems)).sort((aName, bName) => {
              const subA = subcategories.find(s => s.name.trim().toLowerCase() === aName.trim().toLowerCase());
              const subB = subcategories.find(s => s.name.trim().toLowerCase() === bName.trim().toLowerCase());
              
              const isLeafA = !subcategories.some(s => s.parentCategory && s.parentCategory.trim().toLowerCase() === aName.trim().toLowerCase());
              const isLeafB = !subcategories.some(s => s.parentCategory && s.parentCategory.trim().toLowerCase() === bName.trim().toLowerCase());

              if (isLeafA && isLeafB) {
                const timeA = subA?.date ? new Date(subA.date).getTime() : 0;
                const timeB = subB?.date ? new Date(subB.date).getTime() : 0;
                return timeB - timeA; // latest date first
              }
              return 0;
            });

            return (
              <div className="bg-white border border-slate-200/60 p-2 sm:p-3.5 rounded-xl shadow-2xs flex flex-col gap-3 text-xs animate-fade-in">
                {/* Interactive Breadcrumbs */}
                {!isJobRoot && (
                  <div className="flex flex-wrap items-center gap-1 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200/60">
                    <button 
                      onClick={() => setJobPath([])}
                      className="text-emerald-600 hover:text-emerald-800 font-bold flex items-center gap-1 transition text-[11px]"
                    >
                      <Home className="w-3.5 h-3.5" />
                      <span>জব ব্যাংক হোম</span>
                    </button>
                    {jobPath.map((pathItem, index) => {
                      const isLast = index === jobPath.length - 1;
                      return (
                        <React.Fragment key={`job-path-${pathItem}-${index}`}>
                          <ChevronRight className="w-3 h-3 text-gray-400" />
                          {isLast ? (
                            <span className="text-gray-800 font-extrabold">{pathItem}</span>
                          ) : (
                            <button 
                              onClick={() => setJobPath(jobPath.slice(0, index + 1))}
                              className="text-emerald-600 hover:text-emerald-800 font-bold transition"
                            >
                              {pathItem}
                            </button>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}

                {/* Sub-Folders / Content Items */}
                <div className="flex flex-col gap-2">
                  {!isJobRoot && (
                    <div className="flex justify-between items-center px-0.5 my-0.5">
                      <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">
                        {subcategories.filter(s => s.parentCategory && s.parentCategory.trim().toLowerCase() === currentJobNode.trim().toLowerCase()).length > 0 ? '📁 উপ-ক্যাটাগরি সমূহ' : '💼 কোনো উপ-ক্যাটাগরি নেই'}
                      </span>
                      <button 
                        onClick={() => setJobPath(jobPath.slice(0, -1))}
                        className="text-emerald-600 hover:text-emerald-800 font-bold flex items-center gap-1 text-[11px]"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" /> পেছনে যান
                      </button>
                    </div>
                  )}

                  {jobItems.length === 0 ? (
                    <div className="text-center text-gray-400 py-6 bg-gray-50 rounded-lg border border-dashed text-xs">
                      এই স্তরে কোনো উপ-পরীক্ষা বা ক্যাটাগরি তৈরি করা নেই।
                    </div>
                  ) : (() => {
                    const categoryItems = jobItems.filter(item =>
                      subcategories.some(s => s.parentCategory && s.parentCategory.trim().toLowerCase() === item.trim().toLowerCase())
                    );
                    const leafItems = jobItems.filter(item =>
                      !subcategories.some(s => s.parentCategory && s.parentCategory.trim().toLowerCase() === item.trim().toLowerCase())
                    );

                    return (
                      <div className="flex flex-col gap-3">
                        {/* Parent Category Grid Cards */}
                        {categoryItems.length > 0 && (
                          <div className="flex flex-col gap-1.5">
                            {!isJobRoot && leafItems.length > 0 && (
                              <span className="text-[10px] font-extrabold text-emerald-900 uppercase tracking-wider px-0.5">
                                📁 প্রতিষ্ঠান ও পরীক্ষা গ্রুপসমূহ
                              </span>
                            )}
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                              {categoryItems.map((item, idx) => {
                                const qCount = getQuestionsForJobNode(item, false).length;
                                const subCount = subcategories.filter(s => s.parentCategory && s.parentCategory.trim().toLowerCase() === item.trim().toLowerCase()).length;
                                const theme = getSubjectTheme(item);
                                const targetSub = subcategories.find(s => s.name.trim().toLowerCase() === item.trim().toLowerCase());
                                const targetCat = categories.find(c => c.name.trim().toLowerCase() === item.trim().toLowerCase());
                                const itemSubHeading = targetSub?.subHeading || targetCat?.subHeading;

                                return (
                                  <button
                                    key={`job-cat-${idx}-${item}`}
                                    id={`job-cat-card-${idx}`}
                                    onClick={() => {
                                      setJobPath(isJobRoot ? [item] : [...jobPath, item]);
                                    }}
                                    className="group bg-white hover:bg-emerald-50/40 border border-slate-200/80 hover:border-emerald-300 rounded-lg p-2 sm:p-2.5 flex flex-col justify-between gap-1.5 text-left shadow-2xs hover:shadow-2xs transition-all duration-150 cursor-pointer active:scale-98"
                                  >
                                    <div className="flex items-center justify-between gap-1">
                                      <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-md bg-emerald-600 text-white flex items-center justify-center shadow-2xs shrink-0">
                                        {renderSubjectIcon(item, "w-3.5 h-3.5")}
                                      </div>
                                      <span className="text-[8.5px] bg-emerald-50 text-emerald-700 font-extrabold px-1 py-0.5 rounded border border-emerald-150 shrink-0">
                                        {subCount.toLocaleString('bn-BD')} টি উপ-ধাপ
                                      </span>
                                    </div>

                                    <div className="my-0">
                                      <h4 className="font-extrabold text-[12px] sm:text-[13px] text-slate-800 group-hover:text-emerald-700 transition-colors leading-tight line-clamp-2">
                                        {item}
                                      </h4>
                                      {itemSubHeading && (
                                        <p className="text-[10px] text-emerald-600 font-bold leading-tight mt-0.5 line-clamp-1">
                                          {itemSubHeading}
                                        </p>
                                      )}
                                    </div>

                                    <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-[8.5px]">
                                      {showMcqCount ? (
                                        <span className="bg-slate-800 text-white font-extrabold px-1.5 py-0.5 rounded">
                                          {qCount.toLocaleString('bn-BD')} MCQ
                                        </span>
                                      ) : <span />}
                                      <span className="text-emerald-700 font-bold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                                        খুলুন <ChevronRight className="w-2.5 h-2.5" />
                                      </span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Leaf Category List */}
                        {leafItems.length > 0 && (
                          <div className="flex flex-col gap-1.5">
                            {categoryItems.length > 0 && (
                              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider px-0.5 mt-0.5">
                                💼 পরীক্ষার প্রশ্ন সমাধানসমূহ
                              </span>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                              {leafItems.map((item, idx) => {
                                const subObj = subcategories.find(s => s.name.trim().toLowerCase() === item.trim().toLowerCase());
                                const qCount = getQuestionsForJobNode(item, false).length;

                                return (
                                  <button
                                    key={`job-leaf-${idx}-${item}`}
                                    id={`job-leaf-btn-${idx}`}
                                    onClick={async () => {
                                      if (user.isGuest) {
                                        checkGuestAccess(`"${item}" - জব সলিউশন MCQ সমাধান`);
                                        return;
                                      }
                                      let subcatQuestions = getQuestionsForJobNode(item, false);
                                      if (subcatQuestions.length === 0 && onFetchQuestionsLazy) {
                                        const fetched = await onFetchQuestionsLazy({ subcategory: item });
                                        subcatQuestions = fetched.filter(q => 
                                          q.subcategory === item || (q.subcategories && q.subcategories.includes(item))
                                        );
                                      }
                                      setReaderQuestions(subcatQuestions);
                                      setReaderTitle(`পরীক্ষাভিত্তিক অনুশীলন: ${item}`);
                                      setReaderActiveMode('read');
                                      setReaderSelectedAnswers({});
                                      setReaderPage(1);
                                      setReaderSource('job');
                                      setReaderCategoryFilter('সব প্রশ্ন');
                                      setReaderModeActive(true);
                                    }}
                                    className="flex items-center justify-between py-3.5 px-3 sm:py-4 sm:px-3.5 bg-gray-50/80 hover:bg-emerald-50/40 text-slate-800 rounded-xl font-bold text-xs transition border border-gray-200/60 hover:border-emerald-200 shadow-2xs text-left cursor-pointer"
                                  >
                                    <div className="flex items-center gap-2.5">
                                      <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-150 shrink-0">
                                        {renderSubjectIcon(item, "w-4 h-4")}
                                      </span>
                                      <div className="flex flex-col">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="font-extrabold text-gray-800 text-[13px] sm:text-[15px]">{item}</span>
                                          {user.isGuest && (
                                            <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 border border-amber-300/80 font-black px-2 py-0.5 rounded-md text-[10px] shadow-2xs">
                                              🔒 লক করা
                                            </span>
                                          )}
                                        </div>
                                        {subObj?.subHeading && (
                                          <span className="text-[10px] sm:text-[11px] text-emerald-700 font-bold mt-0.5">{subObj.subHeading}</span>
                                        )}
                                        {subObj?.date && (
                                          <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1 mt-0.5">
                                            <Calendar className="w-3 h-3 text-emerald-600" />
                                            {formatBengaliDate(subObj.date)}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    {user.isGuest ? (
                                      <span className="text-[10px] bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-2.5 py-1 rounded-md shrink-0 shadow-2xs flex items-center gap-1">
                                        🔒 আনলক করুন
                                      </span>
                                    ) : showMcqCount ? (
                                      <span className="text-[9.5px] bg-slate-800 text-white font-extrabold px-2 py-1 rounded-md shrink-0">
                                        {qCount.toLocaleString('bn-BD')} MCQ
                                      </span>
                                    ) : null}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {jobQuestions.length === 0 && !isJobRoot && (
                  <div className="mt-1 bg-gray-50 border border-gray-100 p-4 rounded-xl text-center text-gray-500 font-bold text-[11px] flex flex-col gap-1">
                    <span>🎯 এই উপ-ক্যাটাগরিতে এখনো কোনো প্রশ্ন যোগ করা হয়নি।</span>
                    <span className="text-[10px] text-gray-400 font-semibold">এডমিন প্যানেল থেকে এই ক্যাটাগরিতে নতুন প্রশ্ন যোগ করতে পারেন।</span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* VIEW: YEAR-BASED JOB SOLUTION (সাল ভিত্তিক জব সলিউশন) */}
          {activeTab === 'yearJob' && (() => {
            const isYearJobRoot = yearJobPath.length === 0;
            const currentYearJobNode = isYearJobRoot ? '' : yearJobPath[yearJobPath.length - 1];
            const yearJobQuestions = getQuestionsForYearJobNode(currentYearJobNode, isYearJobRoot);

            // Get items to display at current level
            const yearJobRawItems = isYearJobRoot
              ? subcategories.filter(s => isYearJobSolutionVariation(s.parentCategory)).map(s => s.name.trim())
              : subcategories.filter(s => s.parentCategory && s.parentCategory.trim().toLowerCase() === currentYearJobNode.trim().toLowerCase()).map(s => s.name.trim());

            const yearJobItems = Array.from(new Set(yearJobRawItems)).sort((aName, bName) => {
              const subA = subcategories.find(s => s.name.trim().toLowerCase() === aName.trim().toLowerCase());
              const subB = subcategories.find(s => s.name.trim().toLowerCase() === bName.trim().toLowerCase());
              
              const isLeafA = !subcategories.some(s => s.parentCategory && s.parentCategory.trim().toLowerCase() === aName.trim().toLowerCase());
              const isLeafB = !subcategories.some(s => s.parentCategory && s.parentCategory.trim().toLowerCase() === bName.trim().toLowerCase());

              if (isLeafA && isLeafB) {
                const timeA = subA?.date ? new Date(subA.date).getTime() : 0;
                const timeB = subB?.date ? new Date(subB.date).getTime() : 0;
                return timeB - timeA; // latest date first
              }
              return 0;
            });

            return (
              <div className="bg-white border border-slate-200/60 p-2 sm:p-3.5 rounded-xl shadow-2xs flex flex-col gap-3 text-xs animate-fade-in">
                {/* Interactive Breadcrumbs */}
                {!isYearJobRoot && (
                  <div className="flex flex-wrap items-center gap-1 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200/60">
                    <button 
                      onClick={() => setYearJobPath([])}
                      className="text-amber-600 hover:text-amber-800 font-bold flex items-center gap-1 transition text-[11px]"
                    >
                      <Home className="w-3.5 h-3.5" />
                      <span>সাল ভিত্তিক হোম</span>
                    </button>
                    {yearJobPath.map((pathItem, index) => {
                      const isLast = index === yearJobPath.length - 1;
                      return (
                        <React.Fragment key={`year-job-path-${pathItem}-${index}`}>
                          <ChevronRight className="w-3 h-3 text-gray-400" />
                          {isLast ? (
                            <span className="text-gray-800 font-extrabold">{pathItem}</span>
                          ) : (
                            <button 
                              onClick={() => setYearJobPath(yearJobPath.slice(0, index + 1))}
                              className="text-amber-600 hover:text-amber-800 font-bold transition"
                            >
                              {pathItem}
                            </button>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}

                {/* Sub-Folders / Content Items */}
                <div className="flex flex-col gap-2">
                  {!isYearJobRoot && (
                    <div className="flex justify-between items-center px-0.5 my-0.5">
                      <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">
                        {subcategories.filter(s => s.parentCategory && s.parentCategory.trim().toLowerCase() === currentYearJobNode.trim().toLowerCase()).length > 0 ? '📁 উপ-ক্যাটাগরি সমূহ' : '💼 কোনো উপ-ক্যাটাগরি নেই'}
                      </span>
                      <button 
                        onClick={() => setYearJobPath(yearJobPath.slice(0, -1))}
                        className="text-amber-600 hover:text-amber-800 font-bold flex items-center gap-1 text-[11px]"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" /> পেছনে যান
                      </button>
                    </div>
                  )}

                  {yearJobItems.length === 0 ? (
                    <div className="text-center text-gray-400 py-6 bg-gray-50 rounded-lg border border-dashed text-xs">
                      এই সাল ভিত্তিক ক্যাটাগরিতে এখনো কোনো প্রশ্ন বা পরীক্ষা তৈরি করা নেই।
                    </div>
                  ) : (() => {
                    const categoryItems = yearJobItems.filter(item =>
                      subcategories.some(s => s.parentCategory && s.parentCategory.trim().toLowerCase() === item.trim().toLowerCase())
                    );
                    const leafItems = yearJobItems.filter(item =>
                      !subcategories.some(s => s.parentCategory && s.parentCategory.trim().toLowerCase() === item.trim().toLowerCase())
                    );

                    return (
                      <div className="flex flex-col gap-3">
                        {/* Parent Category Grid Cards */}
                        {categoryItems.length > 0 && (
                          <div className="flex flex-col gap-1.5">
                            {!isYearJobRoot && leafItems.length > 0 && (
                              <span className="text-[10px] font-extrabold text-amber-900 uppercase tracking-wider px-0.5">
                                📁 সাল ও পরীক্ষা গ্রুপসমূহ
                              </span>
                            )}
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                              {categoryItems.map((item, idx) => {
                                const qCount = getQuestionsForYearJobNode(item, false).length;
                                const subCount = subcategories.filter(s => s.parentCategory && s.parentCategory.trim().toLowerCase() === item.trim().toLowerCase()).length;

                                return (
                                  <button
                                    key={`year-job-cat-${idx}-${item}`}
                                    id={`year-job-cat-card-${idx}`}
                                    onClick={() => {
                                      setYearJobPath(isYearJobRoot ? [item] : [...yearJobPath, item]);
                                    }}
                                    className="group bg-white hover:bg-amber-50/40 border border-slate-200/80 hover:border-amber-300 rounded-lg p-2 sm:p-2.5 flex flex-col justify-between gap-1.5 text-left shadow-2xs hover:shadow-2xs transition-all duration-150 cursor-pointer active:scale-98"
                                  >
                                    <div className="flex items-center justify-between gap-1">
                                      <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-md bg-amber-600 text-white flex items-center justify-center shadow-2xs shrink-0">
                                        {renderSubjectIcon(item, "w-3.5 h-3.5")}
                                      </div>
                                      <span className="text-[8.5px] bg-amber-50 text-amber-800 font-extrabold px-1 py-0.5 rounded border border-amber-200 shrink-0">
                                        {subCount.toLocaleString('bn-BD')} টি ধাপ
                                      </span>
                                    </div>

                                    <div className="my-0">
                                      <h4 className="font-extrabold text-[12px] sm:text-[13px] text-slate-800 group-hover:text-amber-800 transition-colors leading-tight line-clamp-2">
                                        {item}
                                      </h4>
                                    </div>

                                    <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-[8.5px]">
                                      {showMcqCount ? (
                                        <span className="bg-slate-800 text-white font-extrabold px-1.5 py-0.5 rounded">
                                          {qCount.toLocaleString('bn-BD')} MCQ
                                        </span>
                                      ) : <span />}
                                      <span className="text-amber-800 font-bold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                                        খুলুন <ChevronRight className="w-2.5 h-2.5" />
                                      </span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Leaf Category List */}
                        {leafItems.length > 0 && (
                          <div className="flex flex-col gap-1.5">
                            {categoryItems.length > 0 && (
                              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider px-0.5 mt-0.5">
                                📅 সাল ভিত্তিক প্রশ্ন সমাধানসমূহ
                              </span>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                              {leafItems.map((item, idx) => {
                                const subObj = subcategories.find(s => s.name.trim().toLowerCase() === item.trim().toLowerCase());
                                const qCount = getQuestionsForYearJobNode(item, false).length;

                                return (
                                  <button
                                    key={`year-job-leaf-${idx}-${item}`}
                                    id={`year-job-leaf-btn-${idx}`}
                                    onClick={async () => {
                                      if (user.isGuest) {
                                        checkGuestAccess(`"${item}" - সালভিত্তিক প্রশ্ন সমাধান`);
                                        return;
                                      }
                                      let subcatQuestions = getQuestionsForYearJobNode(item, false);
                                      if (subcatQuestions.length === 0 && onFetchQuestionsLazy) {
                                        const fetched = await onFetchQuestionsLazy({ subcategory: item });
                                        subcatQuestions = fetched.filter(q => 
                                          q.subcategory === item || (q.subcategories && q.subcategories.includes(item))
                                        );
                                      }
                                      setReaderQuestions(subcatQuestions);
                                      setReaderTitle(`সাল ভিত্তিক সমাধান: ${item}`);
                                      setReaderActiveMode('read');
                                      setReaderSelectedAnswers({});
                                      setReaderPage(1);
                                      setReaderSource('yearJob');
                                      setReaderCategoryFilter('সব প্রশ্ন');
                                      setReaderModeActive(true);
                                    }}
                                    className="flex items-center justify-between py-3.5 px-3 sm:py-4 sm:px-3.5 bg-gray-50/80 hover:bg-amber-50/40 text-slate-800 rounded-xl font-bold text-xs transition border border-gray-200/60 hover:border-amber-200 shadow-2xs text-left cursor-pointer"
                                  >
                                    <div className="flex items-center gap-2.5">
                                      <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                                        {renderSubjectIcon(item, "w-4 h-4")}
                                      </span>
                                      <div className="flex flex-col">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          <span className="font-extrabold text-gray-800 text-[13px] sm:text-[15px]">{item}</span>
                                          {user.isGuest && (
                                            <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 border border-amber-300/80 font-black px-2 py-0.5 rounded-md text-[10px] shadow-2xs">
                                              🔒 লক করা
                                            </span>
                                          )}
                                        </div>
                                        {subObj?.date && (
                                          <span className="text-[10px] text-amber-800 font-bold flex items-center gap-1 mt-0.5">
                                            <Calendar className="w-3 h-3 text-amber-600" />
                                            {formatBengaliDate(subObj.date)}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    {user.isGuest ? (
                                      <span className="text-[10px] bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-2.5 py-1 rounded-md shrink-0 shadow-2xs flex items-center gap-1">
                                        🔒 আনলক করুন
                                      </span>
                                    ) : showMcqCount ? (
                                      <span className="text-[9.5px] bg-slate-800 text-white font-extrabold px-2 py-1 rounded-md shrink-0">
                                        {qCount.toLocaleString('bn-BD')} MCQ
                                      </span>
                                    ) : null}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {yearJobQuestions.length === 0 && !isYearJobRoot && (
                  <div className="mt-1 bg-gray-50 border border-gray-100 p-4 rounded-xl text-center text-gray-500 font-bold text-[11px] flex flex-col gap-1">
                    <span>🎯 এই সাল ভিত্তিক ক্যাটাগরিতে এখনো কোনো প্রশ্ন যোগ করা হয়নি।</span>
                    <span className="text-[10px] text-gray-400 font-semibold">এডমিন প্যানেল থেকে এই ক্যাটাগরিতে নতুন প্রশ্ন যোগ করতে পারেন।</span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* VIEW: BOOKMARKS */}
          {activeTab === 'bookmarks' && (() => {
            if (user.isGuest) {
              return renderGuestLockCard(
                'বুকমার্ক করা প্রশ্ন লক করা আছে',
                'গেস্ট (Guest) হিসেবে সেভ করা প্রশ্ন ফিচার ব্যবহার করা সম্ভব নয়। গুরুত্বপূর্ণ প্রশ্ন সেভ ও পরবর্তীতে প্র্যাকটিস করতে রেজিস্ট্রেশন করুন।'
              );
            }
            const selectedItemsList = selectedBookmarkFolder ? groupedBookmarks[selectedBookmarkFolder] || [] : [];
            const hasBookmarks = bookmarks.length > 0;

            // Safety check: if folder was selected but is now empty
            if (selectedBookmarkFolder && selectedItemsList.length === 0) {
              setSelectedBookmarkFolder(null);
            }

            return (
              <div className="bg-white border border-gray-100 p-5 rounded-3xl shadow-sm flex flex-col gap-4 text-xs">
                {!hasBookmarks ? (
                  <div className="text-center py-10 text-gray-400">
                    কোনো বুকমার্ক সংরক্ষিত নেই। পড়ার সময় যেকোনো প্রশ্নের বুকমার্ক বাটনে ক্লিক করুন।
                  </div>
                ) : !selectedBookmarkFolder ? (
                  /* Generally show the list of folders */
                  <div className="flex flex-col gap-3">
                    <span className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">
                      📂 আপনার বুকমার্ক ফোল্ডার সমূহ:
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {Object.entries(groupedBookmarks).map(([folderName, itemsList]) => (
                        <button
                          key={folderName}
                          onClick={() => {
                            setSelectedBookmarkFolder(folderName);
                            setBookmarkViewPage(1);
                          }}
                          className="w-full text-left p-4 rounded-2xl border border-indigo-100 hover:border-indigo-300 bg-indigo-50/10 hover:bg-indigo-50/30 transition flex items-center justify-between font-bold"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-9 h-9 flex items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                              <FolderHeart className="w-4 h-4 fill-indigo-100" />
                            </span>
                            <div>
                              <h4 className="text-xs font-extrabold text-indigo-950">{folderName}</h4>
                              <span className="text-[10px] text-indigo-500 font-bold">
                                {itemsList.length.toLocaleString('bn-BD')}টি প্রশ্ন
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-indigo-400" />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Inside selected folder - Show MCQs with pagination (max 20) */
                  <div>
                    <div className="flex justify-between items-center border-b border-gray-100 pb-3 mb-4">
                      <button
                        onClick={() => {
                          setSelectedBookmarkFolder(null);
                          setBookmarkViewPage(1);
                        }}
                        className="text-indigo-600 hover:text-indigo-800 font-extrabold flex items-center gap-1 text-[11px]"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" /> ফোল্ডার সমূহে ফিরে যান
                      </button>
                      <span className="font-extrabold text-indigo-950 text-xs bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100">
                        📂 {selectedBookmarkFolder} ({selectedItemsList.length.toLocaleString('bn-BD')}টি প্রশ্ন)
                      </span>
                    </div>

                    {(() => {
                      const bPageSize = 20;
                      const bTotalPages = Math.ceil(selectedItemsList.length / bPageSize) || 1;
                      const bCurrentPage = Math.min(Math.max(1, bookmarkViewPage), bTotalPages);
                      const bStartIndex = (bCurrentPage - 1) * bPageSize;
                      const bPaginatedBookmarks = selectedItemsList.slice(bStartIndex, bStartIndex + bPageSize);

                      return (
                        <div className="space-y-6">
                          <div className="divide-y divide-gray-100 space-y-4">
                            {bPaginatedBookmarks.map((b, bIdx) => {
                              const q = questions.find(question => question.id === b.questionId);
                              if (!q) return null;
                              const idx = bStartIndex + bIdx;

                              const selectedOpt = bookmarkSelectedAnswers[q.id];
                              const hasSelected = !!selectedOpt;

                              return (
                                <div key={b.id} className="pt-4 text-xs relative first:pt-0">
                                  <button 
                                    onClick={() => {
                                      onRemoveBookmark(b.id);
                                      alert('বুকমার্ক সফলভাবে মুছে ফেলা হয়েছে।');
                                    }}
                                    className="absolute top-1.5 right-1 text-rose-500 hover:text-rose-700 hover:underline text-[10px] font-bold"
                                  >
                                    রিমুভ 🗑️
                                  </button>

                                  <h5 className="font-bold text-gray-900 leading-relaxed pr-16 mb-2">
                                    {(idx + 1).toLocaleString('bn-BD')}. {q.text}
                                    {(() => {
                                      const leafCategories = Array.from(new Set(
                                        q.subcategories && q.subcategories.length > 0 
                                          ? q.subcategories 
                                          : (q.subcategory ? [q.subcategory] : (q.category ? [q.category] : []))
                                      )).filter(Boolean);
                                      
                                      if (leafCategories.length === 0) return null;
                                      return (
                                        <span className="inline-flex flex-wrap gap-1 ml-2 align-middle">
                                          {leafCategories.map((catName) => (
                                            <span 
                                              key={catName} 
                                              className="text-[9px] font-extrabold text-indigo-700 bg-indigo-50/80 px-1.5 py-0.5 rounded-md border border-indigo-100 inline-flex items-center gap-1 font-sans"
                                            >
                                              🏷️ {catName}
                                            </span>
                                          ))}
                                        </span>
                                      );
                                    })()}
                                  </h5>

                                  {/* Interactive Options as buttons */}
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-gray-600 mb-3 font-semibold text-[11px] max-w-2xl">
                                    {['Option A', 'Option B', 'Option C', 'Option D'].map((optKey) => {
                                      const optText = optKey === 'Option A' ? q.optionA : optKey === 'Option B' ? q.optionB : optKey === 'Option C' ? q.optionC : q.optionD;
                                      const label = optKey === 'Option A' ? 'ক) ' : optKey === 'Option B' ? 'খ) ' : optKey === 'Option C' ? 'গ) ' : 'ঘ) ';
                                      
                                      const isSelected = selectedOpt === optKey;
                                      const isCorrect = q.correct === optKey;
                                      
                                      let btnStyle = 'bg-white border-gray-150 hover:bg-gray-50/50 hover:border-indigo-200';
                                      if (isSelected) {
                                        btnStyle = isCorrect 
                                          ? 'bg-green-50 border-green-300 text-green-800 font-extrabold shadow-xs'
                                          : 'bg-rose-50 border-rose-300 text-rose-800 font-extrabold shadow-xs';
                                      } else if (hasSelected && isCorrect) {
                                        btnStyle = 'bg-green-50 border-green-200 text-green-700 font-bold';
                                      }

                                      return (
                                        <button
                                          key={optKey}
                                          disabled={hasSelected}
                                          onClick={() => {
                                            setBookmarkSelectedAnswers(prev => ({ ...prev, [q.id]: optKey }));
                                          }}
                                          className={`w-full text-left p-2.5 rounded-xl border transition ${btnStyle}`}
                                        >
                                          {label}{optText}
                                        </button>
                                      );
                                    })}
                                  </div>

                                  {/* Interactive Actions Panel */}
                                  {(() => {
                                    const masterQ = questions.find(mq => mq.id === q.id) || q;
                                    const hasPendingReport = !!masterQ?.comments?.some(c => !c.pointsApproved);
                                    const hasPendingExplanation = !!masterQ?.userExplanations?.some(e => !e.approved);

                                    return (
                                      <div className="flex flex-row flex-wrap gap-2 items-center mb-1">
                                        {!hasSelected && (
                                          <button
                                            onClick={() => {
                                              setBookmarkSelectedAnswers(prev => ({ ...prev, [q.id]: q.correct }));
                                            }}
                                            className="px-2.5 py-1 rounded bg-indigo-50 hover:bg-indigo-100 border border-indigo-150 text-indigo-700 transition font-bold text-[9px] cursor-pointer"
                                          >
                                            🔑 উত্তর দেখুন
                                          </button>
                                        )}

                                        <button
                                          onClick={() => setPopupExplanationQ(masterQ)}
                                          className="px-2.5 py-1 rounded bg-indigo-50 hover:bg-indigo-100 border border-indigo-150 text-indigo-700 transition font-bold text-[9px] cursor-pointer"
                                        >
                                          💡 ব্যাখা
                                        </button>

                                        <button
                                          disabled={hasPendingReport}
                                          onClick={() => {
                                            if (hasPendingReport) return;
                                            setFlagModalQ(masterQ);
                                            setFlagCommentText('');
                                          }}
                                          className="px-2.5 py-1 rounded border transition font-bold text-[9px] bg-rose-50 hover:bg-rose-100 border-rose-150 text-rose-700 cursor-pointer disabled:bg-rose-100/80 disabled:border-rose-200/50 disabled:text-rose-700/80 disabled:opacity-100 disabled:cursor-not-allowed"
                                        >
                                          🚩 রিপোর্ট
                                        </button>

                                        <button
                                          disabled={hasPendingExplanation || !allowUserExplanation}
                                          onClick={() => {
                                            if (hasPendingExplanation || !allowUserExplanation) return;
                                            setUserExplModalQ(masterQ);
                                            setUserExplText('');
                                          }}
                                          className="px-2.5 py-1 rounded border transition font-bold text-[9px] bg-amber-50 hover:bg-amber-100 border-amber-150 text-amber-700 cursor-pointer disabled:bg-amber-100/85 disabled:border-amber-200/50 disabled:text-amber-700/80 disabled:opacity-100 disabled:cursor-not-allowed"
                                        >
                                          {allowUserExplanation ? '✍️ ব্যাখ্যা +' : '✍️ ব্যাখ্যা (বন্ধ)'}
                                        </button>
                                      </div>
                                    );
                                  })()}

                                  {/* Correct Answer Feedback Box - ONLY shown after they interact or click to reveal */}
                                  {hasSelected && (
                                    <div className="bg-green-50/60 p-2.5 rounded-xl border border-green-100 text-green-800 font-semibold text-[10px] flex items-center justify-between mt-2">
                                      <span>
                                        {selectedOpt === q.correct ? '🎉 আপনার উত্তরটি সঠিক হয়েছে! ' : '❌ আপনার উত্তরটি ভুল হয়েছে। '}
                                        <b>সঠিক উত্তর:</b> {q.correct === 'Option A' ? q.optionA : q.correct === 'Option B' ? q.optionB : q.correct === 'Option C' ? q.optionC : q.optionD}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Pagination controls */}
                          {bTotalPages > 1 && (
                            <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
                              <button
                                disabled={bCurrentPage === 1}
                                onClick={() => setBookmarkViewPage(prev => Math.max(1, prev - 1))}
                                className="px-3 py-1.5 rounded-xl border text-[11px] font-bold bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
                              >
                                ← পূর্ববর্তী
                              </button>
                              
                              <div className="flex items-center gap-1">
                                {Array.from({ length: bTotalPages }).map((_, pIdx) => {
                                  const pageNum = pIdx + 1;
                                  const isPageActive = pageNum === bCurrentPage;
                                  return (
                                    <button
                                      key={`b-page-${pageNum}`}
                                      onClick={() => setBookmarkViewPage(pageNum)}
                                      className={`w-7 h-7 rounded-lg text-[10px] font-extrabold flex items-center justify-center transition ${
                                        isPageActive 
                                          ? 'bg-indigo-600 text-white shadow-xs' 
                                          : 'bg-gray-50 border border-gray-100 hover:bg-gray-100 text-gray-700'
                                      }`}
                                    >
                                      {pageNum.toLocaleString('bn-BD')}
                                    </button>
                                  );
                                })}
                              </div>

                              <button
                                disabled={bCurrentPage === bTotalPages}
                                onClick={() => setBookmarkViewPage(prev => Math.min(bTotalPages, prev + 1))}
                                className="px-3 py-1.5 rounded-xl border text-[11px] font-bold bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
                              >
                                পরবর্তী →
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })()}

          {/* VIEW: EXAM ZONE */}
          {activeTab === 'exams' && (
            <div className="flex flex-col gap-4 text-xs">
              {/* Official Live Exams Header */}
              <div className="flex items-center justify-between px-1">
                <h3 className="font-extrabold text-indigo-950 text-sm sm:text-base flex items-center gap-2">
                  <span>🎯</span> অফিশিয়াল লাইভ পরীক্ষা জোন
                </h3>
                <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-xl">
                  মোট পরীক্ষা: {liveExams.length.toLocaleString('bn-BD')}টি
                </span>
              </div>

              {/* Grid cards for Live Exams */}
              {liveExams.length === 0 ? (
                <div className="bg-white border border-gray-100 p-8 rounded-3xl shadow-xs text-center text-gray-400">
                  <p className="font-bold">বর্তমানে কোনো সক্রিয় অফিশিয়াল লাইভ পরীক্ষা নেই।</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[...liveExams]
                    .sort((a, b) => {
                      const timeA = new Date(a.createdAt || a.startTime || 0).getTime();
                      const timeB = new Date(b.createdAt || b.startTime || 0).getTime();
                      return timeB - timeA;
                    })
                    .map((exam, idx) => {
                    const alreadyTaken = attempts.some(a => a.examId === exam.id);
                    const now = new Date();
                    const isStarted = new Date(exam.startTime) <= now;
                    const isExpired = new Date(exam.expiryTime) < now;

                    return (
                      <div
                        key={exam.id ? `usr-le-${exam.id}-${idx}` : `usr-le-${idx}`}
                        className="bg-white border border-slate-150 rounded-2xl p-4 shadow-xs flex flex-col justify-between gap-3.5 hover:shadow-md transition-all border-l-4 border-l-indigo-600"
                      >
                        {/* Top / Details section of the grid card */}
                        <div className="space-y-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-extrabold text-indigo-950 text-sm leading-snug">{exam.title}</h4>
                            {alreadyTaken ? (
                              <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-lg font-bold shrink-0">
                                🟢 অংশগ্রহণকৃত
                              </span>
                            ) : !isStarted ? (
                              <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-lg font-bold shrink-0">
                                ⏳ শুরু হয়নি
                              </span>
                            ) : isExpired ? (
                              <span className="text-[10px] text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-lg font-bold shrink-0">
                                🔒 সময় শেষ
                              </span>
                            ) : (
                              <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-lg font-bold shrink-0 animate-pulse">
                                ⏱️ চলমান পরীক্ষা
                              </span>
                            )}
                          </div>

                          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-1.5">
                            <p className="text-[10.5px] text-slate-600 font-medium leading-relaxed">
                              📅 সময়সীমা: <span className="font-bold text-slate-800">{new Date(exam.startTime).toLocaleString('bn-BD')}</span> থেকে <span className="font-bold text-slate-800">{new Date(exam.expiryTime).toLocaleString('bn-BD')}</span>
                            </p>
                            <div className="flex flex-wrap gap-1.5 text-[10px] text-indigo-700 font-bold pt-0.5">
                              <span className="bg-white border border-slate-200 px-2.5 py-1 rounded-md shadow-2xs">
                                বিষয়: {exam.category === 'ALL' ? 'সব বিষয়' : exam.category}
                              </span>
                              <span className="bg-white border border-slate-200 px-2.5 py-1 rounded-md shadow-2xs">
                                প্রশ্ন: {exam.qLimit}টি
                              </span>
                              <span className="bg-white border border-slate-200 px-2.5 py-1 rounded-md shadow-2xs">
                                সময়: {exam.timeLimit} মিনিট
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Positioned strictly BELOW every grid card: Action/Toggle buttons (Strict Single Line / Inline) */}
                        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-1 sm:gap-2 flex-nowrap w-full overflow-x-auto no-scrollbar scrollbar-none pb-0.5">
                          <div className="flex items-center gap-1 sm:gap-1.5 flex-nowrap shrink-0">
                            <button
                              onClick={() => {
                                const shareUrl = `${window.location.origin}${window.location.pathname}?examId=${exam.id}`;
                                const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
                                window.open(fbUrl, '_blank', 'width=600,height=500');
                              }}
                              className="px-1.5 py-1 sm:px-2.5 sm:py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-[9.5px] sm:text-[10.5px] flex items-center gap-1 shadow-2xs transition cursor-pointer whitespace-nowrap shrink-0"
                              title="ফেসবুকে শেয়ার করুন"
                            >
                              <span>📘</span> <span className="whitespace-nowrap">FB শেয়ার</span>
                            </button>
                            <button
                              onClick={() => {
                                const shareUrl = `${window.location.origin}${window.location.pathname}?examId=${exam.id}`;
                                navigator.clipboard.writeText(shareUrl);
                                showCustomAlert('লাইভ পরীক্ষার লিঙ্ক ক্লিপবোর্ডে কপি করা হয়েছে!\nএখন যেকোনো বন্ধুদের সাথে বা সোশ্যাল মিডিয়ায় শেয়ার করতে পারবেন।', undefined, 'কপি সম্পন্ন!');
                              }}
                              className="px-1.5 py-1 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold text-[9.5px] sm:text-[10.5px] flex items-center gap-1 transition cursor-pointer whitespace-nowrap shrink-0"
                              title="লিঙ্ক কপি করুন"
                            >
                              <span>🔗</span> <span className="whitespace-nowrap">লিঙ্ক কপি</span>
                            </button>

                            {alreadyTaken && (
                              <button
                                onClick={() => {
                                  if (user.isGuest) {
                                    showCustomAlert(
                                      'গেস্ট (Guest) হিসেবে চ্যালেঞ্জ পোস্ট করা যাবে না।\n\nবিনামূল্যে একাউন্ট রেজিস্ট্রেশন করলে আপনার স্কোর দিয়ে বন্ধুদের ফেসবুকে চ্যালেঞ্জ জানাতে পারবেন!',
                                      undefined,
                                      '🔒 রেজিস্ট্রেশন প্রয়োজন'
                                    );
                                    return;
                                  }
                                  const userAttempt = attempts.find(a => a.examId === exam.id);
                                  const userScore = userAttempt ? userAttempt.score : 0;
                                  setChallengeModalData({ exam, score: userScore });
                                }}
                                className="px-1.5 py-1 sm:px-2.5 sm:py-1.5 rounded-xl bg-gradient-to-r from-amber-500 via-rose-600 to-purple-600 hover:from-amber-600 hover:to-rose-700 text-white font-extrabold text-[9.5px] sm:text-[10.5px] flex items-center gap-1 shadow-2xs transition cursor-pointer whitespace-nowrap shrink-0 animate-pulse"
                                title="আপনার প্রাপ্ত নম্বর দিয়ে বন্ধুদের ফেসবুকে চ্যালেঞ্জ পাঠান"
                              >
                                <span>⚔️</span> <span className="whitespace-nowrap">চ্যালেঞ্জ</span>
                              </button>
                            )}
                          </div>

                          <div className="shrink-0 flex items-center">
                            {alreadyTaken ? (
                              <span className="text-[9.5px] sm:text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-1 sm:px-3 sm:py-1.5 rounded-xl font-extrabold whitespace-nowrap inline-flex items-center">
                                অংশগ্রহণ করেছেন
                              </span>
                            ) : !isStarted ? (
                              <span className="text-[9.5px] sm:text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 sm:px-3 sm:py-1.5 rounded-xl font-extrabold whitespace-nowrap inline-flex items-center">
                                শুরু হয়নি
                              </span>
                            ) : isExpired ? (
                              <span className="text-[9.5px] sm:text-xs text-rose-700 bg-rose-50 border border-rose-200 px-2 py-1 sm:px-3 sm:py-1.5 rounded-xl font-extrabold whitespace-nowrap inline-flex items-center">
                                সময় শেষ
                              </span>
                            ) : (
                              <button
                                onClick={() => startOfficialLiveExam(exam)}
                                className="px-2 py-1 sm:px-4 sm:py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[9.5px] sm:text-xs transition shadow-sm cursor-pointer flex items-center gap-1 sm:gap-1.5 whitespace-nowrap shrink-0"
                              >
                                <span>🎯</span> <span className="whitespace-nowrap">পরীক্ষা দিন ➔</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* VIEW: EXAM RESULTS */}
          {activeTab === 'results' && (() => {
            if (user.isGuest && !selectedAttemptForView) {
              return renderGuestLockCard(
                'পরীক্ষার ফলাফল ও সমাধান লক করা আছে',
                'গেস্ট (Guest) হিসেবে দেওয়া পরীক্ষার উত্তরপত্র ও ব্যাখ্যামূলক সমাধান দেখতে অ্যাকাউন্ট রেজিস্ট্রেশন সম্পন্ন করুন।'
              );
            }
            const userCreatedAttempts = attempts.filter(a => a.examId.startsWith('prep_') || a.examId.startsWith('job_') || a.examId.startsWith('custom_') || a.examId.startsWith('demo_'));
            const adminCreatedAttempts = attempts.filter(a => !a.examId.startsWith('prep_') && !a.examId.startsWith('job_') && !a.examId.startsWith('custom_') && !a.examId.startsWith('demo_'));
            const activeFilteredAttempts = resultFilterMode === 'user' ? userCreatedAttempts : adminCreatedAttempts;

            if (selectedAttemptForView) {
              const attemptQuestions = 
                (selectedAttemptForView.activeQuizQuestions && selectedAttemptForView.activeQuizQuestions.length > 0)
                  ? selectedAttemptForView.activeQuizQuestions
                  : ((selectedAttemptForView as any).questionIds && (selectedAttemptForView as any).questionIds.length > 0)
                    ? questions.filter(q => (selectedAttemptForView as any).questionIds.includes(q.id))
                    : (selectedAttemptForView.incorrectQuestionIds && selectedAttemptForView.incorrectQuestionIds.length > 0)
                      ? questions.filter(q => selectedAttemptForView.incorrectQuestionIds.includes(q.id))
                      : [];

              const linkedRoutine = routines.find(r => r.id === selectedAttemptForView.examId || (r.title && r.title.trim().toLowerCase() === selectedAttemptForView.examTitle?.trim().toLowerCase()));
              const linkedLiveExam = liveExams.find(e => e.id === selectedAttemptForView.examId || (e.routineId && e.routineId === selectedAttemptForView.examId) || (e.title && e.title.trim().toLowerCase() === selectedAttemptForView.examTitle?.trim().toLowerCase()));
              const courseId = linkedRoutine?.courseId || linkedLiveExam?.courseId;
              const attemptCourseName = linkedRoutine?.courseName || linkedLiveExam?.courseName || (courses.find(c => c.id === courseId)?.title);
              const attemptDateStr = formatBengaliDate(selectedAttemptForView.submittedAt) || new Date(selectedAttemptForView.submittedAt).toLocaleString('bn-BD');

              return (
                <div className="bg-white border border-gray-100 p-5 rounded-3xl shadow-sm flex flex-col gap-4">
                  {/* Top Bar with Title, PDF Export & Back */}
                  <div className="flex flex-wrap justify-between items-center border-b pb-3 gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-extrabold text-indigo-950 text-sm sm:text-base flex items-center gap-1.5">
                          🛡️ {selectedAttemptForView.examTitle}
                        </h3>
                        {attemptCourseName && (
                          <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-200/80 flex items-center gap-1">
                            <GraduationCap className="w-3 h-3 text-indigo-500" />
                            <span>{attemptCourseName}</span>
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-500 mt-0.5 font-medium">
                        তারিখ: {attemptDateStr} | মোট প্রশ্ন: {toBengaliDigits(selectedAttemptForView.totalQuestions)}টি | সঠিক: {toBengaliDigits(selectedAttemptForView.correctCount)}টি | ভুল: {toBengaliDigits(selectedAttemptForView.wrongCount)}টি
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <label className="flex items-center gap-1.5 text-[11px] font-extrabold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl cursor-pointer border border-slate-200 transition">
                        <input
                          type="checkbox"
                          checked={includeMarkTableInPDF}
                          onChange={(e) => setIncludeMarkTableInPDF(e.target.checked)}
                          className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                        />
                        <span>📚 বিষয়ভিত্তিক মার্কিং টেবিল (PDF)</span>
                      </label>
                      {user.isGuest ? (
                        <button
                          onClick={() => {
                            showCustomAlert(
                              'গেস্ট হিসেবে পরীক্ষা দিলে PDF ডাউনলোড করা যায় না।\n\nবিনামূল্যে রেজিস্ট্রেশন করলে প্রশ্নপত্র, ব্যাখ্যামূলক সমাধান ও PDF নামাতে পারবেন!',
                              undefined,
                              '🔒 PDF ডাউনলোডে সীমাবদ্ধতা'
                            );
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-200 text-slate-700 font-extrabold text-xs flex items-center gap-1.5 cursor-pointer hover:bg-slate-300 transition"
                          title="রেজিস্ট্রেশন করুন PDF ডাউনলোডের জন্য"
                        >
                          <span>🔒</span> PDF নামান (রেজিস্ট্রেশন প্রয়োজন)
                        </button>
                      ) : (
                        <button
                          onClick={() => handleDownloadPDF(selectedAttemptForView, includeMarkTableInPDF)}
                          className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          📄 PDF নামান
                        </button>
                      )}
                      <button
                        onClick={() => setSelectedAttemptForView(null)}
                        className="px-3 py-1.5 rounded-xl border font-bold text-xs hover:bg-gray-50 transition cursor-pointer text-gray-600"
                      >
                        ← ফিরে যান
                      </button>
                    </div>
                  </div>

                  {/* Pie Chart Analysis Block & User Details */}
                  {(() => {
                    const totalQ = selectedAttemptForView.totalQuestions || attemptQuestions.length || 1;
                    const correctC = selectedAttemptForView.correctCount || 0;
                    const wrongC = selectedAttemptForView.wrongCount || 0;
                    const skippedC = Math.max(0, totalQ - correctC - wrongC);

                    const correctPercent = Math.min(100, Math.max(0, (correctC / totalQ) * 100));
                    const wrongPercent = Math.min(100, Math.max(0, (wrongC / totalQ) * 100));
                    const skippedPercent = Math.min(100, Math.max(0, (skippedC / totalQ) * 100));

                    return (
                      <div className="bg-slate-50/80 border border-slate-100 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
                        {/* User Info & Summary Card */}
                        <div className="flex flex-col gap-1 w-full md:w-1/2 text-xs">
                          <div className="flex flex-wrap items-center gap-2 font-bold text-indigo-950 text-sm">
                            <span>👤 {user.name || 'শিক্ষার্থী'}</span>
                            <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full font-extrabold">ID: {user.userId || user.phone || '—'}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 mt-2 text-[11px]">
                            <div className="bg-white p-2.5 rounded-xl border border-gray-100 shadow-2xs">
                              <span className="text-gray-400 block text-[10px]">অর্জিত নম্বর</span>
                              <span className="font-extrabold text-indigo-600 text-base">{selectedAttemptForView.score}</span>
                            </div>
                            <div className="bg-white p-2.5 rounded-xl border border-gray-100 shadow-2xs">
                              <span className="text-gray-400 block text-[10px]">নির্ভুলতার হার</span>
                              <span className="font-extrabold text-emerald-600 text-base">{Math.round(correctPercent)}%</span>
                            </div>
                          </div>
                        </div>

                        {/* Pie Chart & Legend */}
                        <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-1/2 justify-end">
                          {/* SVG Doughnut Pie Chart */}
                          <div className="relative w-28 h-28 flex-shrink-0 flex items-center justify-center">
                            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                              <circle cx="50" cy="50" r="40" stroke="#e2e8f0" strokeWidth="12" fill="none" />
                              <circle
                                cx="50"
                                cy="50"
                                r="40"
                                stroke="#22c55e"
                                strokeWidth="12"
                                fill="none"
                                strokeDasharray={`${correctPercent * 2.51327} 251.327`}
                                strokeDashoffset="0"
                              />
                              <circle
                                cx="50"
                                cy="50"
                                r="40"
                                stroke="#f43f5e"
                                strokeWidth="12"
                                fill="none"
                                strokeDasharray={`${wrongPercent * 2.51327} 251.327`}
                                strokeDashoffset={`-${correctPercent * 2.51327}`}
                              />
                              <circle
                                cx="50"
                                cy="50"
                                r="40"
                                stroke="#f59e0b"
                                strokeWidth="12"
                                fill="none"
                                strokeDasharray={`${skippedPercent * 2.51327} 251.327`}
                                strokeDashoffset={`-${(correctPercent + wrongPercent) * 2.51327}`}
                              />
                            </svg>
                            <div className="absolute flex flex-col items-center justify-center text-center">
                              <span className="text-[9px] font-bold text-gray-400">সঠিক</span>
                              <span className="text-xs font-extrabold text-green-600">{Math.round(correctPercent)}%</span>
                            </div>
                          </div>

                          {/* Legend */}
                          <div className="flex flex-col gap-1.5 text-[11px] font-medium w-full sm:w-auto">
                            <div className="flex items-center justify-between gap-3 bg-white px-2.5 py-1 rounded-lg border border-gray-100 shadow-2xs">
                              <span className="flex items-center gap-1.5 font-bold text-green-700">
                                <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
                                সঠিক:
                              </span>
                              <span className="font-extrabold text-gray-800">{correctC}টি ({Math.round(correctPercent)}%)</span>
                            </div>
                            <div className="flex items-center justify-between gap-3 bg-white px-2.5 py-1 rounded-lg border border-gray-100 shadow-2xs">
                              <span className="flex items-center gap-1.5 font-bold text-rose-700">
                                <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>
                                ভুল:
                              </span>
                              <span className="font-extrabold text-gray-800">{wrongC}টি ({Math.round(wrongPercent)}%)</span>
                            </div>
                            <div className="flex items-center justify-between gap-3 bg-white px-2.5 py-1 rounded-lg border border-gray-100 shadow-2xs">
                              <span className="flex items-center gap-1.5 font-bold text-amber-700">
                                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
                                স্কিপড:
                              </span>
                              <span className="font-extrabold text-gray-800">{skippedC}টি ({Math.round(skippedPercent)}%)</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Subject-Wise Marking & Performance Breakdown */}
                  {(() => {
                    const totalQ = selectedAttemptForView.totalQuestions || attemptQuestions.length || 1;
                    const correctC = selectedAttemptForView.correctCount || 0;
                    const wrongC = selectedAttemptForView.wrongCount || 0;
                    const skippedC = Math.max(0, totalQ - correctC - wrongC);
                    const subjectBreakdown = calculateSubjectWiseAnalysis(attemptQuestions, selectedAttemptForView);

                    return (
                      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                          <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm flex items-center gap-2">
                            <span>📚 বিষয়ভিত্তিক সঠিক-ভুল ও নম্বর বিবরণী (Subject-wise Marking System)</span>
                          </h4>
                          <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200/80 px-2.5 py-0.5 rounded-full font-bold">
                            মোট বিষয়: {toBengaliDigits(subjectBreakdown.length)}টি
                          </span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-50 text-slate-700 border-b border-slate-200 font-bold">
                                <th className="p-2.5 rounded-l-xl">বিষয় (Subject)</th>
                                <th className="p-2.5 text-center">মোট প্রশ্ন (Total Questions)</th>
                                <th className="p-2.5 text-center text-emerald-700">সঠিক (Right)</th>
                                <th className="p-2.5 text-center text-rose-700">ভুল (Wrong)</th>
                                <th className="p-2.5 text-center text-amber-700">স্কিপড (Skipped)</th>
                                <th className="p-2.5 text-right rounded-r-xl">মোট নম্বর (Total Marks)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                              {subjectBreakdown.map((item, idx) => (
                                <tr key={`sb-row-${idx}`} className="hover:bg-slate-50/70 transition">
                                  <td className="p-2.5 font-bold text-indigo-950 flex items-center gap-1.5">
                                    <span className="text-indigo-400">📖</span>
                                    <span>{item.subject}</span>
                                  </td>
                                  <td className="p-2.5 text-center font-bold text-slate-700">
                                    {toBengaliDigits(item.totalQuestions)}টি
                                  </td>
                                  <td className="p-2.5 text-center">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-extrabold text-[11px]">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                      {toBengaliDigits(item.right)}
                                    </span>
                                  </td>
                                  <td className="p-2.5 text-center">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200/80 font-extrabold text-[11px]">
                                      <XCircle className="w-3 h-3 text-rose-600" />
                                      {toBengaliDigits(item.wrong)}
                                    </span>
                                  </td>
                                  <td className="p-2.5 text-center">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200/80 font-extrabold text-[11px]">
                                      <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                                      {toBengaliDigits(item.skipped)}
                                    </span>
                                  </td>
                                  <td className="p-2.5 text-right">
                                    <span className={`font-black text-sm ${item.totalMarks > 0 ? 'text-indigo-600' : item.totalMarks < 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                                      {item.totalMarks > 0 ? `+${toBengaliDigits(item.totalMarks.toFixed(2))}` : toBengaliDigits(item.totalMarks.toFixed(2))}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                              <tr className="bg-indigo-50/80 font-bold text-indigo-950 border-t-2 border-indigo-200">
                                <td className="p-2.5 font-extrabold text-indigo-900 rounded-l-xl">
                                  🏆 সর্বমোট (Total)
                                </td>
                                <td className="p-2.5 text-center font-black text-indigo-950">
                                  {toBengaliDigits(totalQ)}টি
                                </td>
                                <td className="p-2.5 text-center">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 font-black text-[11px]">
                                    {toBengaliDigits(correctC)}টি
                                  </span>
                                </td>
                                <td className="p-2.5 text-center">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-100 text-rose-800 font-black text-[11px]">
                                    {toBengaliDigits(wrongC)}টি
                                  </span>
                                </td>
                                <td className="p-2.5 text-center">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-100 text-amber-800 font-black text-[11px]">
                                    {toBengaliDigits(skippedC)}টি
                                  </span>
                                </td>
                                <td className="p-2.5 text-right font-black text-indigo-700 text-sm rounded-r-xl">
                                  {toBengaliDigits(typeof selectedAttemptForView.score === 'number' ? selectedAttemptForView.score.toFixed(2) : selectedAttemptForView.score)}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Detailed Analysis / Question Review */}
                  {user.isGuest ? (
                    <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 text-white rounded-3xl p-6 sm:p-8 my-6 shadow-xl border border-indigo-700/50 text-center space-y-4 animate-fade-in">
                      <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center text-3xl mx-auto backdrop-blur-sm border border-white/20">
                        🔒
                      </div>
                      <div className="space-y-2 max-w-lg mx-auto">
                        <h4 className="font-black text-xl sm:text-2xl text-amber-300">
                          বিস্তারিত ফলাফল ও ব্যাখ্যামূলক সমাধান আনলক করুন!
                        </h4>
                        <p className="text-xs sm:text-sm text-indigo-150 leading-relaxed font-medium">
                          আপনি <strong>গেস্ট (Guest)</strong> হিসেবে এই পরীক্ষায় অংশ নিয়েছেন। আপনার অর্জিত প্রাপ্ত নম্বর: <strong className="text-amber-300 text-base">{selectedAttemptForView.score}</strong>।
                        </p>
                        <p className="text-[11.5px] sm:text-xs text-indigo-200/90 leading-relaxed">
                          প্রতিটি প্রশ্নের সঠিক উত্তর, বিষয়ভিত্তিক ব্যাখ্যা এবং PDF রেজাল্ট শিট ডাউনলোড করতে একটি ফ্রি একাউন্ট তৈরি (রেজিস্ট্রেশন) করুন।
                        </p>
                      </div>

                      <div className="bg-white/10 p-4 rounded-2xl border border-white/10 text-left max-w-md mx-auto space-y-2 text-xs text-indigo-100">
                        <div className="font-extrabold text-amber-200 text-xs flex items-center gap-1.5">
                          <span>✨</span> একাউন্ট রেজিস্ট্রেশন করার বিশেষ সুবিধা:
                        </div>
                        <ul className="space-y-1.5 text-[11px] text-indigo-150 list-disc list-inside">
                          <li>এই ইমেইলে দেওয়া পূর্বের সকল গেস্ট পরীক্ষার ফলাফল স্বয়ংক্রিয়ভাবে প্রোফাইলে যুক্ত হবে।</li>
                          <li>পরীক্ষার বিস্তারিত উত্তরপত্র ও ব্যাখ্যামূলক সমাধান দেখতে পাবেন।</li>
                          <li>অফিশিয়াল PDF রেজাল্ট শিট যেকোনো সময় ডাউনলোড করতে পারবেন।</li>
                        </ul>
                      </div>

                      <div className="pt-2">
                        <button
                          onClick={() => onRegisterPrompt ? onRegisterPrompt() : onLogout()}
                          className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-sm rounded-2xl shadow-lg hover:shadow-amber-500/20 transition-all flex items-center justify-center gap-2 mx-auto cursor-pointer"
                        >
                          <span>🚀</span> রেজিস্ট্রেশন সম্পূর্ণ করুন (ফ্রি)
                        </button>
                      </div>
                    </div>
                  ) : attemptQuestions.length === 0 ? (
                    <p className="text-center py-8 text-gray-400 font-bold text-xs">
                      এই পরীক্ষার কোনো সংরক্ষিত প্রশ্ন পাওয়া যায়নি।
                    </p>
                  ) : (
                    <div className="divide-y divide-gray-100 space-y-4 pt-1">
                      {attemptQuestions.map((q, i) => {
                        const selectedAnsKey = 
                          selectedAttemptForView.userSelectedAnswers?.[i] || 
                          selectedAttemptForView.userSelectedAnswers?.[q.id as any] || 
                          (selectedAttemptForView as any).answers?.[q.id] || 
                          (selectedAttemptForView as any).answers?.[i];

                        const isCorrect = Boolean(selectedAnsKey && q?.correct && selectedAnsKey === q.correct);
                        const correctText = (q && q.correct && typeof q.correct === 'string') ? (q as any)[q.correct.replace('Option ', 'option')] || '' : '';
                        const userAnsText = (selectedAnsKey && typeof selectedAnsKey === 'string' && selectedAnsKey.includes('Option'))
                          ? (q as any)[selectedAnsKey.replace('Option ', 'option')] || ''
                          : (selectedAnsKey === 'Skipped' ? 'স্কিপড' : 'উত্তর দেওয়া হয়নি');

                        const masterQ = questions.find(mq => mq.id === q.id) || q;

                        return (
                          <div key={q.id || i} className="pt-3 text-xs flex flex-col gap-2">
                            <h5 className="font-bold text-gray-900 leading-snug">
                              {(i + 1).toLocaleString('bn-BD')}. {q.text}
                            </h5>

                            <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[10px] text-gray-600 font-medium bg-slate-50/50 p-2 rounded-xl border border-slate-100">
                              <div className={q.correct === 'Option A' ? 'font-bold text-green-700' : ''}>ক) {q.optionA}</div>
                              <div className={q.correct === 'Option B' ? 'font-bold text-green-700' : ''}>খ) {q.optionB}</div>
                              <div className={q.correct === 'Option C' ? 'font-bold text-green-700' : ''}>গ) {q.optionC}</div>
                              <div className={q.correct === 'Option D' ? 'font-bold text-green-700' : ''}>ঘ) {q.optionD}</div>
                            </div>

                            <div className={`p-2.5 rounded-xl border flex flex-col gap-1 ${isCorrect ? 'bg-green-50/60 border-green-200 text-green-800' : 'bg-rose-50/60 border-rose-200 text-rose-800'}`}>
                              <span className="font-extrabold text-[10px] flex items-center gap-1">
                                {isCorrect ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> : <XCircle className="w-3.5 h-3.5 text-rose-600" />}
                                আপনার উত্তর: {userAnsText}
                              </span>
                              {!isCorrect && (
                                <span className="font-bold text-green-700 text-[10px]">সঠিক উত্তর: {correctText}</span>
                              )}
                            </div>

                            {/* Main Explanation Block */}
                            {(masterQ.explanation || q.explanation) && (
                              <div className="p-2.5 rounded-xl bg-indigo-50/80 border border-indigo-100 text-indigo-900 text-[11px] leading-relaxed">
                                <span className="font-bold text-indigo-950 flex items-center gap-1 mb-0.5 text-xs">
                                  💡 ব্যাখ্যা:
                                </span>
                                {masterQ.explanation || q.explanation}
                              </div>
                            )}

                            {/* User Approved Explanations */}
                            {masterQ.userExplanations?.filter(e => e.approved).map((e) => (
                              <div key={e.id} className="p-2 rounded-xl bg-amber-50/80 border border-amber-100 text-amber-900 text-[10px] leading-relaxed">
                                <span className="font-bold text-amber-950">✍️ {e.userName}: </span>
                                {e.text}
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            } else {
              return (
                <div className="bg-white border border-gray-100 p-5 rounded-3xl shadow-sm flex flex-col gap-4 text-xs">
                  <div className="flex flex-col gap-4">
                    {/* Toggle Buttons */}
                    <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1.5 border border-slate-200/40">
                      <button
                        onClick={() => setResultFilterMode('user')}
                        className={`flex-1 py-2.5 px-3 rounded-xl font-extrabold text-center transition flex items-center justify-center gap-2 text-[10px] sm:text-xs ${
                          resultFilterMode === 'user'
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-gray-500 hover:text-indigo-600 hover:bg-white/40'
                        }`}
                      >
                        👤 চ্যাপ্টার/কাস্টম পরীক্ষা ({userCreatedAttempts.length})
                      </button>
                      <button
                        onClick={() => setResultFilterMode('admin')}
                        className={`flex-1 py-2.5 px-3 rounded-xl font-extrabold text-center transition flex items-center justify-center gap-2 text-[10px] sm:text-xs ${
                          resultFilterMode === 'admin'
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-gray-500 hover:text-indigo-600 hover:bg-white/40'
                        }`}
                      >
                        🛡️ অফিশিয়াল লাইভ পরীক্ষা ({adminCreatedAttempts.length})
                      </button>
                    </div>

                    {activeFilteredAttempts.length === 0 ? (
                      <p className="text-center py-10 text-gray-400 font-bold">
                        {resultFilterMode === 'user' 
                          ? 'আপনার কোনো কাস্টম বা অধ্যায়ভিত্তিক পরীক্ষার রেকর্ড পাওয়া যায়নি (রেকর্ডসমূহ ৭২ ঘণ্টা পর স্বয়ংক্রিয়ভাবে মুছে যায়)।'
                          : 'বর্তমানে কোনো অফিশিয়াল লাইভ পরীক্ষার রেকর্ড পাওয়া যায়নি।'}
                      </p>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {activeFilteredAttempts.map((a, aIdx) => {
                          const isUserCreated = a.examId.startsWith('prep_') || a.examId.startsWith('job_') || a.examId.startsWith('custom_') || a.examId.startsWith('demo_');
                          let hoursLeft = 0;
                          if (isUserCreated) {
                            const submittedTime = new Date(a.submittedAt).getTime();
                            const diffMs = Date.now() - submittedTime;
                            hoursLeft = Math.max(0, 72 - diffMs / (1000 * 60 * 60));
                          }

                          const linkedRoutine = routines.find(r => r.id === a.examId || (r.title && r.title.trim().toLowerCase() === a.examTitle?.trim().toLowerCase()));
                          const linkedLiveExam = liveExams.find(e => e.id === a.examId || (e.routineId && e.routineId === a.examId) || (e.title && e.title.trim().toLowerCase() === a.examTitle?.trim().toLowerCase()));
                          const courseId = linkedRoutine?.courseId || linkedLiveExam?.courseId;
                          const courseName = linkedRoutine?.courseName || linkedLiveExam?.courseName || (courses.find(c => c.id === courseId)?.title);
                          const formattedDate = formatBengaliDate(a.submittedAt) || new Date(a.submittedAt).toLocaleDateString('bn-BD');

                          return (
                            <div key={a.id ? `att-${a.id}-${aIdx}` : `att-${aIdx}`} className="py-3 flex justify-between items-center hover:bg-gray-50/50 px-2 transition rounded-xl">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-bold text-indigo-950 text-xs sm:text-sm">{a.examTitle}</h4>
                                  {courseName && (
                                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-200/80 flex items-center gap-1">
                                      <GraduationCap className="w-3 h-3 text-indigo-500" />
                                      <span>{courseName}</span>
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-gray-500 font-medium">
                                  মোট প্রশ্ন: {toBengaliDigits(a.totalQuestions)}টি | সঠিক: {toBengaliDigits(a.correctCount)}টি | ভুল: {toBengaliDigits(a.wrongCount)}টি 
                                </p>
                                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                  <span className="text-[9.5px] text-slate-600 font-semibold bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1 border border-slate-200/60">
                                    <Calendar className="w-3 h-3 text-slate-500" />
                                    <span>তারিখ: {formattedDate}</span>
                                  </span>
                                  {isUserCreated && (
                                    <span className="text-[9px] font-black text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-md border border-rose-100">
                                      ⏱️ আর {Math.ceil(hoursLeft).toLocaleString('bn-BD')} ঘণ্টা সংরক্ষিত
                                    </span>
                                  )}
                                  {!isUserCreated && (
                                    <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200/80">
                                      🛡️ অফিশিয়াল লাইভ পরীক্ষা
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2.5 shrink-0">
                                <span className="text-indigo-700 font-extrabold text-xs bg-indigo-50 px-2.5 py-1.5 rounded-xl border border-indigo-200/80">
                                  {toBengaliDigits(typeof a.score === 'number' ? a.score.toFixed(2) : a.score)} মার্কস
                                </span>
                                
                                <button 
                                  onClick={() => setSelectedAttemptForView(a)}
                                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-3 py-1.5 rounded-xl shadow-2xs transition cursor-pointer flex items-center gap-1"
                                >
                                  <span>বিশ্লেষণ</span>
                                  <span>➔</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            }
          })()}

          {/* VIEW: COURSES SPACE */}
          {activeTab === 'courses' && (
            <div className="space-y-5 animate-fade-in text-xs">
              {(() => {
                const selectedCourse = courses.find(c => c.id === expandedCourseId);

                // SINGLE COURSE DETAIL VIEW
                if (expandedCourseId && selectedCourse) {
                  const courseRoutines = routines.filter(r => r.courseId === selectedCourse.id || r.courseName === selectedCourse.title);
                  const isEnrolled = enrolledCourseIds.includes(selectedCourse.id);

                  return (
                    <div className="space-y-5 animate-fade-in">
                      {/* Top Bar with Left Upper Corner Back Arrow */}
                      <div className="flex items-center justify-between gap-3">
                        <button
                          onClick={() => setExpandedCourseId(null)}
                          className="inline-flex items-center gap-2 bg-white hover:bg-slate-100 text-indigo-950 font-bold px-4 py-2.5 rounded-2xl border border-slate-200 shadow-2xs transition text-xs"
                        >
                          <ArrowLeft className="w-4 h-4 text-indigo-600 stroke-[2.5]" />
                          কোর্স তালিকায় ফিরে যান
                        </button>
                      </div>

                      {/* Main Course Info Card */}
                      <div className={`bg-white border ${isEnrolled ? 'border-emerald-300 ring-2 ring-emerald-500/10' : 'border-gray-100/90'} p-6 rounded-3xl shadow-sm space-y-4 relative overflow-hidden`}>
                        {isEnrolled && (
                          <div className="absolute -right-12 top-5 bg-emerald-600 text-white font-extrabold text-[9px] uppercase px-10 py-1 rotate-45 shadow-xs pointer-events-none">
                            ENROLLED
                          </div>
                        )}

                        {/* Status Badges */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3 pr-6">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider ${
                              selectedCourse.status === 'active' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                              selectedCourse.status === 'upcoming' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-gray-100 text-gray-700 border border-gray-200'
                            }`}>
                              {selectedCourse.status === 'active' ? 'চলমান কোর্স' : selectedCourse.status === 'upcoming' ? 'আসন্ন কোর্স' : 'সম্পন্ন কোর্স'}
                            </span>

                            {isEnrolled && (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-[10px] font-extrabold bg-emerald-600 text-white shadow-xs">
                                এনরোলড
                              </span>
                            )}
                          </div>

                          {selectedCourse.category && (
                            <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-3 py-1 rounded-xl text-[10px] font-bold">
                              {selectedCourse.category}
                            </span>
                          )}
                        </div>

                        {/* Title & Description */}
                        <div>
                          <h2 className="font-extrabold text-indigo-950 text-lg sm:text-xl leading-snug">
                            {selectedCourse.title}
                          </h2>
                          <p className="text-gray-600 font-medium text-xs sm:text-sm mt-2 leading-relaxed whitespace-pre-line">
                            {selectedCourse.description}
                          </p>
                        </div>

                        {/* Dates & Metrics */}
                        <div className="flex flex-wrap items-center gap-2.5 text-xs font-semibold text-gray-600 pt-1">
                          {selectedCourse.startDate && (
                            <span className="bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-slate-800 font-bold">
                              শুরু: {selectedCourse.startDate}
                            </span>
                          )}
                          {selectedCourse.endDate && (
                            <span className="bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-slate-800 font-bold">
                              শেষ: {selectedCourse.endDate}
                            </span>
                          )}
                          <span className="bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-xl text-indigo-800 font-bold flex items-center gap-1.5">
                            মোট পরিক্ষা: {toBengaliDigits(courseRoutines.length)}টি
                          </span>
                        </div>
                      </div>

                      {/* Course Routines List */}
                      <div className="space-y-4">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
                          <h3 className="font-extrabold text-sm text-indigo-950">
                            কোর্স রুটিন ও স্টাডি প্ল্যান ({courseRoutines.length})
                          </h3>

                          <button
                            onClick={() => downloadCourseRoutinePDF(selectedCourse.title, selectedCourse.category, courseRoutines, subcategories, categories, questions)}
                            className="text-xs font-extrabold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                          >
                            <Download className="w-3.5 h-3.5" />
                            PDF রুটিন
                          </button>
                        </div>

                        {courseRoutines.length === 0 ? (
                          <div className="p-8 bg-white rounded-2xl border border-gray-100 text-center space-y-2">
                            <p className="text-gray-400 text-xs font-medium">এই কোর্সের জন্য এখনও কোনো রুটিন পোস্ট করা হয়নি।</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {courseRoutines.map((r, rIdx) => {
                              const hasExam = r.examConfig && r.examConfig.enabled;
                              const isExamLive = hasExam && r.examConfig?.startTime && new Date() >= new Date(r.examConfig.startTime);

                              return (
                                <div key={r.id || rIdx} className="p-4 bg-white border border-gray-200/80 rounded-2xl text-xs space-y-3 shadow-2xs">
                                  <div className="flex justify-between items-start font-bold text-indigo-950">
                                    <div>
                                      <span className="font-extrabold text-sm block">{r.title}</span>
                                      {hasExam && r.examConfig?.startTime && (
                                        <span className="text-[11px] text-emerald-700 font-extrabold flex items-center gap-1 mt-1">
                                          পরীক্ষা: {formatBengaliDate(r.examConfig.startTime)}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Syllabus Path Hierarchy */}
                                  {(() => {
                                    const syllabusPaths = formatRoutineSyllabusPaths(r, subcategories, categories, questions);
                                    if (!syllabusPaths || syllabusPaths.length === 0) return null;

                                    // Group paths by root category name (shown only once per root)
                                    const rootMap = new Map<string, string[]>();
                                    syllabusPaths.forEach(path => {
                                      const parts = path.split(/\s*>\s*/).map(p => p.trim()).filter(Boolean);
                                      if (parts.length === 0) return;
                                      const root = parts[0];
                                      const subHierarchy = parts.length > 1 ? parts.slice(1).join(" › ") : "";
                                      if (!rootMap.has(root)) {
                                        rootMap.set(root, []);
                                      }
                                      if (subHierarchy && !rootMap.get(root)!.includes(subHierarchy)) {
                                        rootMap.get(root)!.push(subHierarchy);
                                      }
                                    });

                                    // Build discrete lines: Root category name is a heading, hierarchy under it starts on a new line
                                    const displayLines: React.ReactNode[] = [];
                                    rootMap.forEach((subList, root) => {
                                      // Root Category Heading
                                      displayLines.push(
                                        <div key={`${root}-head`} className="font-bold text-black text-xs leading-snug">
                                          {root}
                                        </div>
                                      );

                                      // Hierarchy under respective root category starting on new lines
                                      subList.forEach((sub, sIdx) => {
                                        displayLines.push(
                                          <div key={`${root}-sub-${sIdx}`} className="text-black font-normal text-xs pl-2.5 flex items-start gap-1 leading-snug">
                                            <span className="text-black font-bold select-none">›</span>
                                            <span className="text-black">{sub}</span>
                                          </div>
                                        );
                                      });
                                    });

                                    const routineKey = r.id || `routine-${rIdx}`;
                                    const isExpanded = !!expandedSyllabusMap[routineKey];
                                    const hasMore = displayLines.length > 2;
                                    const visibleLines = (hasMore && !isExpanded) ? displayLines.slice(0, 2) : displayLines;

                                    return (
                                      <div className="space-y-1 pt-0.5 text-black">
                                        <span className="text-[10.5px] font-black text-black flex items-center gap-1.5">
                                          সিলেবাস (Selected Syllabus):
                                        </span>
                                        <div className="flex flex-col gap-1 pl-1 text-xs text-black font-medium leading-relaxed">
                                          {visibleLines.map((lineNode, lIdx) => (
                                            <div key={lIdx} className="text-black text-xs leading-snug">
                                              {lineNode}
                                            </div>
                                          ))}
                                        </div>
                                        {hasMore && (
                                          <button
                                            type="button"
                                            onClick={() => setExpandedSyllabusMap(prev => ({ ...prev, [routineKey]: !prev[routineKey] }))}
                                            className="text-emerald-600 hover:text-emerald-700 font-bold text-xs inline-flex items-center gap-1 cursor-pointer mt-0.5"
                                          >
                                            {isExpanded ? "See less" : "See more"}
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })()}

                                  {r.details && (
                                    <p className="text-gray-600 text-xs whitespace-pre-line font-medium leading-relaxed bg-gray-50/50 p-3 rounded-xl border border-gray-100">
                                      {r.details}
                                    </p>
                                  )}

                                  {/* Action Buttons: Practice & Live Exam */}
                                  <div className="flex flex-wrap items-center gap-2 pt-1">
                                    {(() => {
                                      const isCourseLocked = !enrolledCourseIds.includes(selectedCourse.id);
                                      const hasExam = r.examConfig && r.examConfig.enabled;
                                      const isExamLive = hasExam && r.examConfig?.startTime && new Date() >= new Date(r.examConfig.startTime);
                                      const routineAttempt = findRoutineAttempt(r);

                                      return (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => handleOpenRoutinePreparation(r)}
                                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 font-extrabold py-2 px-3 rounded-xl transition text-xs flex items-center justify-center gap-1 shadow-2xs cursor-pointer"
                                          >
                                            {isCourseLocked && <Lock className="w-3 h-3 text-indigo-700" />}
                                            <span>পরিক্ষার প্রস্তুতি</span>
                                          </button>
                                          <button
                                            onClick={() => startDemoExam(r)}
                                            className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-extrabold py-2.5 px-3 rounded-xl transition text-xs flex items-center justify-center gap-1 shadow-2xs cursor-pointer"
                                          >
                                            {isCourseLocked && <Lock className="w-3 h-3 text-white/90" />}
                                            <span>Demo exam</span>
                                          </button>

                                          {routineAttempt ? (
                                            <button
                                              type="button"
                                              id={`btn-course-routine-result-${r.id || rIdx}`}
                                              onClick={() => {
                                                setSelectedAttemptForView(routineAttempt);
                                                setActiveTab('results');
                                              }}
                                              className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2.5 px-3.5 rounded-xl transition text-xs flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                                              title="ফলাফল ও বিস্তারিত সমাধান দেখুন"
                                            >
                                              <Award className="w-3.5 h-3.5 text-amber-300" />
                                              <span>Result</span>
                                            </button>
                                          ) : (
                                            hasExam && (
                                              isExamLive ? (
                                                <button
                                                  onClick={() => handleStartLiveExamForRoutine(r)}
                                                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-2.5 px-3.5 rounded-xl transition text-xs flex items-center justify-center gap-1.5 shadow-2xs animate-pulse cursor-pointer"
                                                >
                                                  {isCourseLocked && <Lock className="w-3.5 h-3.5 text-white/90" />}
                                                  <span>লাইভ পরীক্ষা চলমান (পরীক্ষা দিন)</span>
                                                </button>
                                              ) : (
                                                <span className="bg-amber-100 text-amber-900 border border-amber-200 px-3 py-2 rounded-xl text-xs font-extrabold">
                                                  পরিক্ষা শুরু হয়নি
                                                </span>
                                              )
                                            )
                                          )}
                                        </>
                                      );
                                    })()}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                // COURSES LIST VIEW
                const filteredCourses = courses.filter(c => {
                  if (selectedCourseFilter === 'enrolled') {
                    return enrolledCourseIds.includes(c.id);
                  }
                  if (selectedCourseFilter === 'all') return true;
                  return c.status === selectedCourseFilter;
                });

                return (
                  <div className="space-y-5">
                    {/* Header Banner */}
                    <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-purple-900 text-white p-5 rounded-3xl shadow-md border border-indigo-700/40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 mb-1.5">
                          🎓 একাডেমি ও জব সলিউশন
                        </span>
                        <h2 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2">
                          <GraduationCap className="w-5 h-5 text-indigo-300" />
                          আমার কোর্স ও স্টাডি প্রোগ্রাম
                        </h2>
                        <p className="text-xs text-indigo-100/80 font-medium mt-1">
                          আপনার পছন্দের কোর্সে এনরোল করুন, রুটিনমাফিক প্রস্তুতি নিন এবং এক্সাম সেশনে অংশ নিন।
                        </p>
                      </div>

                      {/* Filter Controls */}
                      <div className="flex flex-wrap gap-1.5 bg-white/10 p-1.5 rounded-2xl border border-white/15 backdrop-blur-sm self-stretch sm:self-auto">
                        {(['enrolled', 'all', 'active', 'upcoming', 'completed'] as const).map(statusKey => {
                          const count = statusKey === 'enrolled' 
                            ? enrolledCourseIds.length 
                            : statusKey === 'all' 
                              ? courses.length 
                              : courses.filter(c => c.status === statusKey).length;
                          
                          const labels = {
                            enrolled: `🎓 আমার কোর্স (${count})`,
                            all: `🌐 সকল (${count})`,
                            active: `🟢 চলমান (${count})`,
                            upcoming: `🟡 আসন্ন (${count})`,
                            completed: `⚪ সম্পন্ন (${count})`
                          };
                          const isActive = selectedCourseFilter === statusKey;
                          return (
                            <button
                              key={statusKey}
                              onClick={() => setSelectedCourseFilter(statusKey)}
                              className={`px-3 py-1.5 rounded-xl font-bold transition text-[11px] ${
                                isActive 
                                  ? 'bg-white text-indigo-950 shadow-sm' 
                                  : 'text-indigo-100 hover:bg-white/10 hover:text-white'
                              }`}
                            >
                              {labels[statusKey]}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {filteredCourses.length === 0 ? (
                      <div className="bg-white border border-gray-100 p-8 sm:p-12 rounded-3xl text-center space-y-3.5 shadow-sm">
                        <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center text-3xl mx-auto font-bold shadow-inner">
                          🎓
                        </div>
                        <h4 className="font-black text-indigo-950 text-base">
                          {selectedCourseFilter === 'enrolled' ? 'আপনি এখনও কোনো কোর্সে এনরোল করেননি' : 'কোনো কোর্স পাওয়া যায়নি'}
                        </h4>
                        <p className="text-gray-500 max-w-md mx-auto text-xs leading-relaxed font-medium">
                          {selectedCourseFilter === 'enrolled' 
                            ? 'আমাদের উপলব্ধ কোর্সগুলো থেকে আপনার পছন্দের কোর্সে এনরোল করুন। এনরোলকৃত কোর্সসমূহ সরাসরি এখানে জমা থাকবে।' 
                            : 'নির্বাচিত ফিল্টারে কোনো কোর্স পাওয়া যায়নি। অন্য ফিল্টার নির্বাচন করুন।'}
                        </p>
                        {selectedCourseFilter === 'enrolled' && (
                          <button
                            onClick={() => setSelectedCourseFilter('all')}
                            className="mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-5 py-2.5 rounded-xl transition shadow text-xs inline-flex items-center gap-2"
                          >
                            🌐 উপলব্ধ সকল কোর্স দেখুন ➔
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filteredCourses.map((course, idx) => {
                          const courseRoutines = routines.filter(r => r.courseId === course.id || r.courseName === course.title);
                          const isEnrolled = enrolledCourseIds.includes(course.id);

                          return (
                            <div 
                              key={course.id || idx} 
                              onClick={() => setExpandedCourseId(course.id)}
                              className={`bg-white border ${isEnrolled ? 'border-emerald-300 ring-2 ring-emerald-500/10' : 'border-gray-100/90 hover:border-indigo-300'} p-5 rounded-3xl shadow-sm hover:shadow-md transition flex flex-col justify-between gap-4 relative overflow-hidden cursor-pointer group`}
                            >
                              {isEnrolled && (
                                <div className="absolute -right-12 top-5 bg-emerald-600 text-white font-extrabold text-[9px] uppercase px-10 py-1 rotate-45 shadow-xs pointer-events-none">
                                  ENROLLED
                                </div>
                              )}

                              <div className="space-y-3">
                                {/* Course Badges */}
                                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2.5 pr-6">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider ${
                                      course.status === 'active' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                                      course.status === 'upcoming' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-gray-100 text-gray-700 border border-gray-200'
                                    }`}>
                                      {course.status === 'active' ? '● চলমান কোর্স' : course.status === 'upcoming' ? '▲ আসন্ন কোর্স' : '✓ সম্পন্ন কোর্স'}
                                    </span>

                                    {isEnrolled && (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-extrabold bg-emerald-600 text-white shadow-xs">
                                        ✓ এনরোলড
                                      </span>
                                    )}
                                  </div>

                                  {course.category && (
                                    <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-0.5 rounded-lg text-[10px] font-bold">
                                      🏷️ {course.category}
                                    </span>
                                  )}
                                </div>

                                {/* Course Title & Description */}
                                <div>
                                  <h3 className="font-extrabold text-indigo-950 text-sm sm:text-base leading-snug group-hover:text-indigo-600 transition">
                                    {course.title}
                                  </h3>
                                  <p className="text-gray-600 font-medium text-xs mt-1.5 leading-relaxed line-clamp-2">
                                    {course.description}
                                  </p>
                                </div>

                                {/* Key Metadata */}
                                <div className="flex flex-wrap gap-2 text-[10px] font-semibold text-gray-500 pt-1">
                                  {course.startDate && (
                                    <span className="bg-gray-50 border border-gray-100 px-2.5 py-1 rounded-xl flex items-center gap-1 text-gray-700 font-bold">
                                      📅 শুরু: {course.startDate}
                                    </span>
                                  )}
                                  {course.endDate && (
                                    <span className="bg-gray-50 border border-gray-100 px-2.5 py-1 rounded-xl flex items-center gap-1 text-gray-700 font-bold">
                                      🏁 শেষ: {course.endDate}
                                    </span>
                                  )}
                                  <span className="bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-xl text-indigo-800 font-bold flex items-center gap-1">
                                    📋 মোট পরিক্ষা: {toBengaliDigits(courseRoutines.length)} টি
                                  </span>
                                </div>

                                {/* Click Prompt Bar */}
                                <div className="bg-slate-50 group-hover:bg-indigo-50/80 border border-slate-200/80 p-2.5 rounded-2xl flex justify-between items-center transition">
                                  <span className="text-[11px] font-bold text-slate-700 group-hover:text-indigo-900 flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                                    কোর্স রুটিন ও বিস্তারিত দেখুন
                                  </span>
                                  <span className="text-xs font-black text-indigo-600 group-hover:translate-x-0.5 transition-transform">
                                    ➔
                                  </span>
                                </div>
                              </div>

                              {/* Action Buttons */}
                              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-100" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => downloadCourseRoutinePDF(course.title, course.category, courseRoutines, subcategories, categories, questions)}
                                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold py-2.5 px-3.5 rounded-xl transition text-xs flex items-center justify-center gap-1.5 border border-indigo-200/80 shadow-2xs"
                                  title="কোর্সের সম্পূর্ণ রুটিন PDF হিসেবে ডাউনলোড করুন"
                                >
                                  <Download className="w-4 h-4 text-indigo-600" />
                                  Routine (PDF)
                                </button>

                                {isEnrolled ? (
                                  <div className="flex items-center gap-2 flex-1 justify-end">
                                    <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-2xs">
                                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                      ✓ এনরোলড
                                    </span>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => handleToggleEnrollCourse(course.id, course.title)}
                                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2.5 px-4 rounded-xl transition text-center shadow flex items-center justify-center gap-2 text-xs"
                                  >
                                    <GraduationCap className="w-4 h-4 text-indigo-200" />
                                    Enroll Now
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* VIEW: ACADEMIC ROUTINES */}
          {activeTab === 'routines' && (
            user.isGuest ? (
              renderGuestLockCard(
                'একাডেমিক রুটিন লক করা আছে',
                'গেস্ট (Guest) হিসেবে শুধুমাত্র "লাইভ পরীক্ষা" দেওয়া যায়। একাডেমিক পরীক্ষার সময়সূচী ও রুটিন দেখতে অ্যাকাউন্ট রেজিস্ট্রেশন করুন।'
              )
            ) : (
            <div className="bg-white border border-gray-100 p-3 sm:p-4 rounded-3xl shadow-sm flex flex-col gap-3 text-xs animate-fade-in">
              {/* PAGE 1 (Level 1): COURSE MAIN CARDS LIST */}
              {!selectedRoutineCourseId && (
                <div className="flex flex-col gap-3">
                  {/* Header & Filter Controls */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b pb-3">
                    <div>
                      <h3 className="font-black text-sm sm:text-base text-indigo-950">
                        একাডেমিক ও কোর্স রুটিন সেন্টার
                      </h3>
                      <p className="text-[11px] text-gray-500 mt-0.5 font-medium">
                        কোর্স নির্বাচন করে তার তারিখভিত্তিক রুটিন ও সিলেবাস দেখুন।
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="bg-indigo-50 text-indigo-700 font-extrabold px-2.5 py-1 rounded-xl text-[11px] border border-indigo-100">
                        মোট কোর্স: {courseRoutineGroups.length.toLocaleString('bn-BD')} টি
                      </span>
                    </div>
                  </div>

                  {/* Search & Batch Filters */}
                  {courseRoutineGroups.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-150">
                      {/* Filter Pills */}
                      <div className="flex items-center gap-1.5 flex-wrap overflow-x-auto no-scrollbar py-0.5">
                        {(() => {
                          const counts = {
                            all: courseRoutineGroups.length,
                            open: courseRoutineGroups.filter(g => g.batchType === 'open').length,
                            enrolled: courseRoutineGroups.filter(g => g.batchType === 'enrolled').length,
                            unrolled: courseRoutineGroups.filter(g => g.batchType === 'unrolled').length,
                          };

                          return ([
                            { key: 'all' as const, label: `সব কোর্স (${counts.all.toLocaleString('bn-BD')})` },
                            { key: 'open' as const, label: `ওপেন (${counts.open.toLocaleString('bn-BD')})` },
                            { key: 'enrolled' as const, label: `এনরোল্ড (${counts.enrolled.toLocaleString('bn-BD')})` },
                            { key: 'unrolled' as const, label: `আন-এনরোল্ড (${counts.unrolled.toLocaleString('bn-BD')})` },
                          ]).map(tab => (
                            <button
                              key={tab.key}
                              type="button"
                              onClick={() => setRoutineBatchFilter(tab.key)}
                              className={`px-2.5 py-1 rounded-xl font-extrabold text-[11px] transition-all cursor-pointer whitespace-nowrap shadow-2xs ${
                                routineBatchFilter === tab.key
                                  ? 'bg-indigo-600 text-white shadow-xs'
                                  : 'bg-white text-slate-700 hover:bg-indigo-50 hover:text-indigo-900 border border-slate-200/80'
                              }`}
                            >
                              {tab.label}
                            </button>
                          ));
                        })()}
                      </div>

                      {/* Search Bar */}
                      <div className="relative min-w-[180px] sm:max-w-xs w-full">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={routineSearchQuery}
                          onChange={(e) => setRoutineSearchQuery(e.target.value)}
                          placeholder="কোর্স বা পরীক্ষার নাম খুঁজুন..."
                          className="w-full pl-7 pr-6 py-1 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition font-medium"
                        />
                        {routineSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setRoutineSearchQuery('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Level 1: Course Cards Grid / List (1 Main Card per Course) */}
                  {(() => {
                    const filteredGroups = courseRoutineGroups.filter(g => {
                      if (routineBatchFilter !== 'all' && g.batchType !== routineBatchFilter) {
                        return false;
                      }
                      if (routineSearchQuery.trim()) {
                        const q = routineSearchQuery.trim().toLowerCase();
                        const titleMatch = g.courseTitle.toLowerCase().includes(q);
                        const routineMatch = g.routines.some(r => 
                          r.title.toLowerCase().includes(q) || (r.details || '').toLowerCase().includes(q)
                        );
                        return titleMatch || routineMatch;
                      }
                      return true;
                    });

                    if (courseRoutineGroups.length === 0) {
                      return (
                        <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                          <p className="text-gray-400 font-bold">বর্তমানে কোনো কোর্স রুটিন প্রকাশিত হয়নি।</p>
                        </div>
                      );
                    }

                    if (filteredGroups.length === 0) {
                      return (
                        <div className="p-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-1.5">
                          <p className="text-gray-500 font-bold">নির্বাচিত ফিল্টারে কোনো কোর্স পাওয়া যায়নি।</p>
                          <button
                            type="button"
                            onClick={() => { setRoutineBatchFilter('all'); setRoutineSearchQuery(''); }}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-extrabold underline cursor-pointer"
                          >
                            সব কোর্স প্রদর্শন করুন
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {filteredGroups.map((group) => {
                          const badgeStyle = group.batchType === 'open'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : group.batchType === 'enrolled'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200';

                          const badgeLabel = group.batchType === 'open'
                            ? 'ওপেন ব্যাচ'
                            : group.batchType === 'enrolled'
                              ? 'এনরোল্ড'
                              : 'আন-এনরোল্ড';

                          return (
                            <div
                              key={group.courseId}
                              id={`course-main-card-${group.courseId}`}
                              onClick={() => {
                                setSelectedRoutineCourseId(group.courseId);
                                setSelectedRoutineItem(null);
                              }}
                              className="bg-white border border-slate-200/90 hover:border-indigo-400 p-3 rounded-2xl transition-all duration-200 shadow-2xs hover:shadow-md cursor-pointer flex flex-col justify-between gap-2.5 group"
                            >
                              {/* Top Row: Course Name & Batch Badge */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <h4 className="font-black text-indigo-950 text-xs sm:text-sm leading-snug group-hover:text-indigo-600 transition truncate">
                                    {group.courseTitle}
                                  </h4>
                                  {group.category && (
                                    <p className="text-[10px] text-slate-400 font-semibold truncate">
                                      {group.category}
                                    </p>
                                  )}
                                </div>

                                <div className="shrink-0 flex items-center gap-1">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-extrabold border shadow-2xs ${badgeStyle}`}>
                                    {badgeLabel}
                                  </span>
                                  {group.hasLiveExam && (
                                    <span className="bg-emerald-600 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-md shadow-2xs animate-pulse">
                                      লাইভ
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Next Exam Date & Routine Count */}
                              <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-slate-100 text-[11px]">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-xl bg-indigo-50/90 text-indigo-950 border border-indigo-200/70 font-extrabold text-[11px]">
                                  <span>পরবর্তী পরীক্ষা: {group.nextExamDateStr}</span>
                                </span>

                                <div className="flex items-center gap-1 text-indigo-600 font-extrabold text-[11px] group-hover:translate-x-0.5 transition-transform">
                                  <span>{group.routines.length.toLocaleString('bn-BD')} টি রুটিন</span>
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* PAGE 2 (Level 2): DATE-WISE ROUTINE LIST (When Course is Selected and No Specific Routine is Selected) */}
              {selectedRoutineCourseId && !selectedRoutineItem && (() => {
                const currentGroup = courseRoutineGroups.find(g => g.courseId === selectedRoutineCourseId);
                if (!currentGroup) {
                  return (
                    <div className="p-6 text-center">
                      <p className="text-slate-500 font-bold mb-2">কোর্সটি পাওয়া যায়নি।</p>
                      <button
                        type="button"
                        onClick={() => setSelectedRoutineCourseId(null)}
                        className="text-xs text-indigo-600 underline font-bold cursor-pointer"
                      >
                        কোর্স তালিকায় ফিরে যান
                      </button>
                    </div>
                  );
                }

                const targetCourse = courses ? courses.find(c => c.id === currentGroup.courseId || c.title === currentGroup.courseTitle) : undefined;

                return (
                  <div className="flex flex-col gap-3 animate-fade-in">
                    {/* Top Bar: Back Button, Course Title, PDF Action */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-200">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          id="btn-back-to-courses"
                          onClick={() => setSelectedRoutineCourseId(null)}
                          className="bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 font-extrabold px-2.5 py-1.5 rounded-xl text-xs transition flex items-center gap-1 cursor-pointer border border-slate-200 shrink-0"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          <span>কোর্স তালিকা</span>
                        </button>
                        <div className="min-w-0">
                          <h3 className="font-black text-sm sm:text-base text-indigo-950 truncate">
                            {currentGroup.courseTitle}
                          </h3>
                          <p className="text-[10.5px] text-slate-500 font-medium">
                            তারিখভিত্তিক রুটিনের তালিকা থেকে সিলেবাস ও ডেমো পরীক্ষা দিন।
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {currentGroup.batchType === 'unrolled' && currentGroup.courseId && !currentGroup.courseId.startsWith('virtual_') && (
                          <button
                            type="button"
                            onClick={() => handleToggleEnrollCourse(currentGroup.courseId, currentGroup.courseTitle)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-3 py-1.5 rounded-xl text-xs shadow-2xs transition flex items-center cursor-pointer"
                          >
                            <span>এনরোল করুন</span>
                          </button>
                        )}
                        <button
                          type="button"
                          id="btn-download-course-pdf"
                          onClick={() => {
                            downloadCourseRoutinePDF(
                              currentGroup.courseTitle,
                              targetCourse?.category,
                              currentGroup.routines,
                              subcategories,
                              categories,
                              questions
                            );
                          }}
                          className="bg-white hover:bg-indigo-50 text-indigo-700 font-extrabold px-2.5 py-1.5 rounded-xl text-xs border border-indigo-200 flex items-center gap-1 shadow-2xs cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5 text-indigo-600" />
                          <span>PDF ডাউনলোড</span>
                        </button>
                      </div>
                    </div>

                    {/* Date Wise Routine Cards List */}
                    <div className="space-y-2.5">
                      {currentGroup.routines.map((routine, rIdx) => {
                        const hasExam = routine.examConfig && routine.examConfig.enabled;
                        const isExamLive = hasExam && routine.examConfig?.startTime && new Date() >= new Date(routine.examConfig.startTime);
                        const examDateStr = routine.examConfig?.startTime
                          ? formatExamScheduleWithTime(routine.examConfig.startTime)
                          : routine.examDate
                            ? formatBengaliDate(routine.examDate)
                            : formatBengaliDate(routine.createdAt);

                        const totalMark = routine.examConfig?.totalMarks || 20;
                        const passMark = routine.examConfig?.passMarks || 8;
                        const timeLimit = routine.examConfig?.timeLimit || 20;

                        const rBatch = getRoutineBatchInfo(routine);
                        const isCardLocked = rBatch.type === 'unrolled';

                        return (
                          <div
                            key={routine.id || `course-rt-${rIdx}`}
                            id={`routine-card-${routine.id || rIdx}`}
                            onClick={() => handleOpenRoutinePreparation(routine)}
                            className="bg-white border border-slate-200/90 hover:border-indigo-400 p-2.5 sm:p-3 rounded-2xl transition-all duration-200 shadow-2xs hover:shadow-md cursor-pointer flex flex-col gap-2 group"
                          >
                            {/* 2. Date Wise Routine Header (e.g. "বাংলা, ইংরেজি") */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center text-xs font-black shrink-0">
                                  {(rIdx + 1).toLocaleString('bn-BD')}
                                </span>
                                <h4 className="font-black text-indigo-950 text-xs sm:text-sm leading-snug group-hover:text-indigo-600 transition truncate">
                                  {routine.title}
                                </h4>
                              </div>

                              {isExamLive && (
                                <span className="bg-emerald-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow-2xs animate-pulse shrink-0">
                                  লাইভ পরীক্ষা চলছে
                                </span>
                              )}
                            </div>

                            {/* Metadata Row: Exam Date, Total Mark, Pass Mark, Duration */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px]">
                              <div className="bg-indigo-50/80 border border-indigo-100/80 px-2 py-1 rounded-xl flex items-center justify-center text-indigo-950 font-bold">
                                <span className="truncate">{examDateStr}</span>
                              </div>
                              <div className="bg-slate-50 border border-slate-200/80 px-2 py-1 rounded-xl flex items-center justify-center text-slate-700 font-bold">
                                <span>পূর্ণমান: {totalMark.toLocaleString('bn-BD')}</span>
                              </div>
                              <div className="bg-slate-50 border border-slate-200/80 px-2 py-1 rounded-xl flex items-center justify-center text-slate-700 font-bold">
                                <span>পাস: {passMark.toLocaleString('bn-BD')}</span>
                              </div>
                              <div className="bg-slate-50 border border-slate-200/80 px-2 py-1 rounded-xl flex items-center justify-center text-slate-700 font-bold">
                                <span>সময়: {timeLimit.toLocaleString('bn-BD')} মি.</span>
                              </div>
                            </div>

                            {/* Bottom Row: Syllabus Button, Demo Exam Button, Live Exam Button & Open Preparation Button */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <button
                                  type="button"
                                  id={`btn-syllabus-${routine.id || rIdx}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSyllabusModalRoutine(routine);
                                  }}
                                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200/80 font-extrabold py-1.5 px-3 rounded-xl text-[11px] shadow-2xs transition cursor-pointer"
                                >
                                  <span>Syllabus</span>
                                </button>

                                <button
                                  type="button"
                                  id={`btn-demo-exam-${routine.id || rIdx}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startDemoExam(routine);
                                  }}
                                  className={`bg-gradient-to-r ${isCardLocked ? 'from-purple-700/90 to-indigo-700/90' : 'from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700'} text-white font-extrabold py-1.5 px-3 rounded-xl text-[11px] shadow-2xs transition cursor-pointer flex items-center gap-1`}
                                >
                                  {isCardLocked && <Lock className="w-3 h-3 text-white/90" />}
                                  <span>Demo exam</span>
                                </button>

                                {(() => {
                                  const routineAttempt = findRoutineAttempt(routine);
                                  if (routineAttempt) {
                                    return (
                                      <button
                                        type="button"
                                        id={`btn-routine-result-${routine.id || rIdx}`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedAttemptForView(routineAttempt);
                                          setActiveTab('results');
                                        }}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-1.5 px-3 rounded-xl text-[11px] shadow-2xs transition cursor-pointer flex items-center gap-1"
                                        title="ফলাফল ও বিস্তারিত সমাধান দেখুন"
                                      >
                                        <Award className="w-3 h-3 text-amber-300" />
                                        <span>Result</span>
                                      </button>
                                    );
                                  }

                                  return (
                                    <button
                                      type="button"
                                      id={`btn-live-exam-${routine.id || rIdx}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleStartLiveExamForRoutine(routine);
                                      }}
                                      className={`${isCardLocked ? 'bg-emerald-700/90 hover:bg-emerald-800' : 'bg-emerald-600 hover:bg-emerald-700'} text-white font-extrabold py-1.5 px-3 rounded-xl text-[11px] shadow-2xs transition cursor-pointer flex items-center gap-1`}
                                    >
                                      {isCardLocked && <Lock className="w-3 h-3 text-white/90" />}
                                      <span>Live exam</span>
                                    </button>
                                  );
                                })()}
                              </div>

                              <button
                                type="button"
                                id={`btn-prep-${routine.id || rIdx}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenRoutinePreparation(routine);
                                }}
                                className="flex items-center gap-1 text-indigo-600 font-extrabold text-[11px] group-hover:translate-x-0.5 transition-transform cursor-pointer bg-transparent border-none p-0"
                              >
                                {isCardLocked && <Lock className="w-3 h-3 text-indigo-700" />}
                                <span>পরিক্ষার  প্রস্তুতি</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* PAGE 3 (Level 3): SYLLABUS & CHAPTER MCQ VIEW (When a Routine is Selected) */}
              {selectedRoutineItem && (() => {
                const item = selectedRoutineItem;
                const targetCourse = courses ? courses.find(c => c.id === item.courseId || c.title === item.courseName) : undefined;
                const syllabusPaths = formatRoutineSyllabusPaths(item, subcategories, categories, questions);
                const hasExam = item.examConfig && item.examConfig.enabled;
                const isExamLive = hasExam && item.examConfig?.startTime && new Date() >= new Date(item.examConfig.startTime);
                const examDateStr = item.examConfig?.startTime
                  ? formatExamScheduleWithTime(item.examConfig.startTime)
                  : item.examDate
                    ? formatBengaliDate(item.examDate)
                    : formatBengaliDate(item.createdAt);

                const totalMark = item.examConfig?.totalMarks || 20;
                const passMark = item.examConfig?.passMarks || 8;
                const timeLimit = item.examConfig?.timeLimit || 20;

                const itemBatch = getRoutineBatchInfo(item);
                const isItemLocked = itemBatch.type === 'unrolled';

                return (
                  <div className="flex flex-col gap-3 animate-fade-in">
                    {/* Top Bar: Back to Routine List */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          id="btn-back-to-routines"
                          onClick={() => setSelectedRoutineItem(null)}
                          className="bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 font-extrabold px-2.5 py-1.5 rounded-xl text-xs transition flex items-center gap-1 cursor-pointer border border-slate-200 shrink-0"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          <span>রুটিন তালিকা</span>
                        </button>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1 text-[10.5px] text-slate-400 font-bold truncate">
                            <span>{item.courseName || targetCourse?.title || 'কোর্স রুটিন'}</span>
                            <span>›</span>
                            <span className="text-indigo-950 font-black truncate">{item.title}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.courseName && (
                          <button
                            type="button"
                            onClick={() => {
                              const courseRoutines = routines.filter(r => r.courseId === item.courseId || r.courseName === item.courseName);
                              downloadCourseRoutinePDF(item.courseName || 'কোর্স রুটিন', targetCourse?.category, courseRoutines, subcategories, categories, questions);
                            }}
                            className="bg-white hover:bg-indigo-50 text-indigo-700 font-extrabold px-2.5 py-1.5 rounded-xl text-xs border border-indigo-200 flex items-center gap-1 shadow-2xs cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5 text-indigo-600" />
                            <span>PDF</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Unenrolled Notice Banner if Locked */}
                    {isItemLocked && (
                      <div className="bg-amber-50 border border-amber-200 p-3 sm:p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 shadow-2xs">
                        <div className="flex items-start gap-2.5">
                          <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-black block text-amber-950 text-sm">
                              🔒 কোর্সটি লক করা আছে (আন-এনরোল্ড)
                            </span>
                            <p className="text-amber-800 text-[11px] font-medium mt-0.5">
                              আপনি রুটিন ও সিলেবাস দেখতে পারবেন। তবে "পরিক্ষার প্রস্তুতি", "Demo exam" এবং "Live exam"-এ অংশগ্রহণ করতে কোর্সে এনরোল করুন।
                            </p>
                          </div>
                        </div>
                        {itemBatch.courseId && (
                          <button
                            type="button"
                            onClick={() => {
                              if (itemBatch.courseId) {
                                handleToggleEnrollCourse(itemBatch.courseId, itemBatch.courseTitle || 'এই কোর্স');
                              }
                            }}
                            className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold px-4 py-2 rounded-xl text-xs shrink-0 shadow-2xs cursor-pointer text-center"
                          >
                            এখনই এনরোল করুন
                          </button>
                        )}
                      </div>
                    )}

                    {/* Routine Header Summary Card (Minimal padding) */}
                    <div className="bg-slate-50 border border-slate-200/90 p-2.5 sm:p-3 rounded-2xl flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                            পরীক্ষার শিরোনাম:
                          </span>
                          <h4 className="font-black text-indigo-950 text-sm sm:text-base leading-snug">
                            {item.title}
                          </h4>
                        </div>
                        {isExamLive && (
                          <span className="bg-emerald-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-2xs animate-pulse shrink-0">
                            পরীক্ষা চলমান
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px] pt-1 border-t border-slate-200/70">
                        <div className="bg-white px-2 py-1 rounded-xl border border-slate-200 flex items-center justify-center text-indigo-950 font-bold">
                          <span className="truncate">{examDateStr}</span>
                        </div>
                        <div className="bg-white px-2 py-1 rounded-xl border border-slate-200 flex items-center justify-center text-slate-700 font-bold">
                          <span>পূর্ণমান: {totalMark.toLocaleString('bn-BD')}</span>
                        </div>
                        <div className="bg-white px-2 py-1 rounded-xl border border-slate-200 flex items-center justify-center text-slate-700 font-bold">
                          <span>পাস: {passMark.toLocaleString('bn-BD')}</span>
                        </div>
                        <div className="bg-white px-2 py-1 rounded-xl border border-slate-200 flex items-center justify-center text-slate-700 font-bold">
                          <span>সময়: {timeLimit.toLocaleString('bn-BD')} মি.</span>
                        </div>
                      </div>
                    </div>

                    {/* 3. Syllabus Section with "অধ্যায়ভিক্তিক MCQ পড়ুন" Button */}
                    <div className="bg-white border border-indigo-100 p-3 sm:p-4 rounded-2xl shadow-2xs space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span className="text-xs font-black text-indigo-950">
                          সিলেবাস ও অধ্যায়সমূহ (Syllabus Hierarchy):
                        </span>

                        {/* User Requested Button: "পরিক্ষার  প্রস্তুতি" */}
                        <button
                          type="button"
                          id="btn-read-chapter-mcq"
                          onClick={() => handleOpenRoutinePreparation(item)}
                          className={`${isItemLocked ? 'bg-indigo-700/90 hover:bg-indigo-800' : 'bg-indigo-600 hover:bg-indigo-700'} text-white font-extrabold py-2 px-3.5 rounded-xl transition text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer`}
                        >
                          {isItemLocked && <Lock className="w-3.5 h-3.5 text-white/90" />}
                          <span>পরিক্ষার  প্রস্তুতি</span>
                        </button>
                      </div>

                      {/* Syllabus Paths */}
                      {syllabusPaths.length > 0 ? (
                        <div className="flex flex-col gap-1.5">
                          {syllabusPaths.map((path, pIdx) => (
                            <div
                              key={pIdx}
                              className="bg-indigo-50/80 border border-indigo-200/80 text-indigo-950 font-bold px-2.5 py-1.5 rounded-xl text-xs flex items-center gap-1 flex-wrap"
                            >
                              {path.split(/\s*>\s*/).map((seg, sIdx, arr) => (
                                <React.Fragment key={sIdx}>
                                  <span className={sIdx === arr.length - 1 ? "text-indigo-950 font-black" : "text-indigo-700"}>
                                    {seg}
                                  </span>
                                  {sIdx < arr.length - 1 && <span className="text-indigo-400 font-bold">›</span>}
                                </React.Fragment>
                              ))}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-3 bg-slate-50 rounded-xl text-slate-500 font-medium text-xs">
                          এই রুটিনের জন্য নির্দিষ্ট কোনো ক্যাটাগরি নির্ধারিত নেই (সার্বিক সিলেবাস)।
                        </div>
                      )}

                      {/* Routine Details Text Description */}
                      {item.details && (
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-0.5">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                            রুটিন নির্দেশিকা ও বিবরণ:
                          </span>
                          <p className="text-gray-700 leading-relaxed whitespace-pre-line text-xs font-medium">
                            {item.details}
                          </p>
                        </div>
                      )}

                      {/* Action Buttons: Demo Exam & Live Exam */}
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          id="btn-syllabus-demo-exam"
                          onClick={() => startDemoExam(item)}
                          className={`flex-1 bg-gradient-to-r ${isItemLocked ? 'from-purple-700/90 to-indigo-700/90' : 'from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700'} text-white font-extrabold py-2 px-3 rounded-xl transition text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer`}
                        >
                          {isItemLocked && <Lock className="w-3.5 h-3.5 text-white/90" />}
                          <span>Demo exam (অনুশীলন পরীক্ষা)</span>
                        </button>

                        {(() => {
                          const itemAttempt = findRoutineAttempt(item);
                          if (itemAttempt) {
                            return (
                              <button
                                type="button"
                                id="btn-syllabus-result"
                                onClick={() => {
                                  setSelectedAttemptForView(itemAttempt);
                                  setActiveTab('results');
                                }}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2 px-3.5 rounded-xl transition text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                                title="ফলাফল ও বিস্তারিত সমাধান দেখুন"
                              >
                                <Award className="w-3.5 h-3.5 text-amber-300" />
                                <span>ফলাফল দেখুন (Result)</span>
                              </button>
                            );
                          }

                          if (hasExam && isExamLive) {
                            return (
                              <button
                                type="button"
                                id="btn-syllabus-live-exam"
                                onClick={() => handleStartLiveExamForRoutine(item)}
                                className={`${isItemLocked ? 'bg-emerald-700/90 hover:bg-emerald-800' : 'bg-emerald-600 hover:bg-emerald-700'} text-white font-extrabold py-2 px-3.5 rounded-xl transition text-xs flex items-center justify-center gap-1.5 shadow-xs animate-pulse cursor-pointer`}
                              >
                                {isItemLocked && <Lock className="w-3.5 h-3.5 text-white/90" />}
                                <span>লাইভ পরীক্ষায় অংশগ্রহণ করুন</span>
                              </button>
                            );
                          }

                          return null;
                        })()}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
            )
          )}

          {/* VIEW: CURRENT AFFAIRS */}
          {activeTab === 'currentAffairs' && (
            <CurrentAffairsFeed
              subcategories={subcategories}
              questions={questions}
              bookmarkedIds={bookmarks.map(b => b.questionId)}
              onToggleBookmark={(qId: string) => {
                const existing = bookmarks.find(b => b.questionId === qId);
                if (existing) {
                  onRemoveBookmark(existing.id);
                } else {
                  handleOpenBookmarkDialog(qId);
                }
              }}
              onStartExamWithQuestions={(caQuestions, caTitle) => {
                setQuizQuestions(caQuestions);
                setQuizTitle(caTitle);
                setQuizExamId(`ca_${Date.now()}`);
                setQuizTimeLimitMinutes('unlimited');
                setQuizAnswerMode('instant');
                setCurrentQIndex(0);
                setUserSelectedAnswers({});
                setSecondsRemaining(0);
                setIsQuizTimerRunning(false);
                setQuizActive(true);
              }}
            />
          )}

          {/* VIEW: PROFILE */}
          {activeTab === 'profile' && (() => {
            let approvedPoints = 0;
            let pendingPoints = 0;
            questions.forEach(q => {
              if (q.comments) {
                q.comments.forEach(c => {
                  if (c.userPhone === user.phone) {
                    if (c.pointsApproved) {
                      approvedPoints += 1;
                    } else {
                      pendingPoints += 1;
                    }
                  }
                });
              }
              if (q.userExplanations) {
                q.userExplanations.forEach(e => {
                  if (e.userPhone === user.phone) {
                    if (e.pointsApproved) {
                      approvedPoints += 1;
                    } else {
                      pendingPoints += 1;
                    }
                  }
                });
              }
            });

            return (
              <div className="bg-white border border-gray-100 p-5 rounded-3xl shadow-sm flex flex-col gap-4 text-xs">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-gray-50 p-4 rounded-2xl border">
                  <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                    <div className="relative group cursor-pointer" onClick={() => openProfileModal()}>
                      <img 
                        src={user.avatar} 
                        alt="Profile" 
                        className="w-16 h-16 rounded-full border-2 border-indigo-600 bg-white shadow-sm object-cover" 
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openProfileModal();
                        }}
                        className="absolute bottom-0 right-0 p-1.5 bg-indigo-600 text-white rounded-full shadow-md hover:bg-indigo-700 transition"
                        title="Edit Photo / Profile Settings"
                      >
                        <Camera className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="text-xs text-gray-600 flex flex-col gap-1">
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5">
                        <h4 className="text-sm font-extrabold text-gray-900">{user.name}</h4>
                        {user.emailVerified && (
                          <span className="bg-emerald-100 text-emerald-800 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md inline-flex items-center gap-0.5">
                            ✅ ভেরিফাইড ইমেইল
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-center sm:justify-start gap-1 mt-0.5">
                        <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md font-mono">
                          🆔 অটো ইউজার আইডি: {user.userId || 'MDH-GUEST'}
                        </span>
                      </div>

                      <p className="mt-0.5">📧 ইমেইল: <span className="font-mono text-gray-800 font-medium">{user.email || 'উল্লেখ নেই'}</span></p>
                      <p>📱 মোবাইল নম্বর: <span className="font-mono text-gray-800 font-medium">{user.phone || 'যুক্ত করা হয়নি'}</span></p>
                      <p>🎓 শিক্ষাগত যোগ্যতা: {user.education}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => openProfileModal()}
                    className="w-full sm:w-auto px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition shadow-sm flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <Settings className="w-4 h-4" />
                    প্রোফাইল সেটিংস (Profile Settings)
                  </button>
                </div>

                {/* Quick Stats Grid */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white border border-gray-150 p-3 rounded-2xl shadow-2xs text-center flex flex-col justify-center">
                    <span className="text-[10px] font-bold text-gray-500 block">মোট পরীক্ষা</span>
                    <span className="text-lg font-extrabold text-indigo-600 mt-0.5">{totalUserExams.toLocaleString('bn-BD')}টি</span>
                  </div>
                  <div className="bg-white border border-gray-150 p-3 rounded-2xl shadow-2xs text-center flex flex-col justify-center">
                    <span className="text-[10px] font-bold text-gray-500 block">গড় শতাংশ</span>
                    <span className="text-lg font-extrabold text-green-600 mt-0.5">{netMarkPercentage.toLocaleString('bn-BD')}%</span>
                  </div>
                  <div 
                    onClick={() => handleTabSelect('bookmarks')}
                    className="bg-white border border-amber-100 p-3 rounded-2xl shadow-2xs text-center flex flex-col justify-center cursor-pointer hover:bg-amber-50/60 transition"
                  >
                    <span className="text-[10px] font-bold text-gray-500 block">বুকমার্ক</span>
                    <span className="text-lg font-extrabold text-amber-600 mt-0.5">{bookmarksCount.toLocaleString('bn-BD')}টি</span>
                  </div>
                </div>

                {/* Contributor Points Card */}
                <div className="bg-amber-50 border border-amber-100/70 p-4 rounded-2xl flex flex-col gap-2">
                  <h4 className="font-bold text-amber-900 flex items-center gap-1.5 text-xs">
                    🪙 অর্জন কন্ট্রিবিউটর পয়েন্ট (Contributor Points)
                  </h4>
                  <p className="text-[11px] text-amber-700 leading-normal">
                    প্রশ্নে ভুল রিপোর্ট করে অথবা কাস্টম ব্যাখ্যা দিয়ে আপনি কন্ট্রিবিউটর পয়েন্ট অর্জন করতে পারেন। প্রতিটি অনুমোদিত কন্ট্রিবিউশন-এর জন্য ১টি পয়েন্ট দেওয়া হয়।
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-center mt-1">
                    <div className="bg-emerald-50 border border-emerald-150 p-3 rounded-xl">
                      <span className="block text-[9px] text-emerald-600 font-extrabold">অনুমোদিত পয়েন্ট (Approved)</span>
                      <span className="text-xl font-black text-emerald-700 mt-0.5 block">{approvedPoints.toLocaleString('bn-BD')}</span>
                    </div>
                    <div className="bg-amber-100/50 border border-amber-200 p-3 rounded-xl">
                      <span className="block text-[9px] text-amber-600 font-extrabold">পেন্ডিং পয়েন্ট (Pending)</span>
                      <span className="text-xl font-black text-amber-700 mt-0.5 block">{pendingPoints.toLocaleString('bn-BD')}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-indigo-900 text-white p-4 rounded-2xl shadow-sm">
                  <h4 className="font-bold text-xs opacity-80 mb-2 flex items-center gap-1">📊 আজীবন সামগ্রিক প্রগ্রেস রিপোর্ট</h4>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-white/10 p-2.5 rounded-xl">
                      <span className="block opacity-75 text-[9px]">মোট উত্তর</span>
                      <span className="text-base font-extrabold">{(user.lifetimeAnswered || 0).toLocaleString('bn-BD')}</span>
                    </div>
                    <div className="bg-green-600/30 p-2.5 rounded-xl border border-green-500/30">
                      <span className="block opacity-90 text-[9px] text-green-300">সঠিক</span>
                      <span className="text-base font-extrabold text-green-200">{(user.lifetimeCorrect || 0).toLocaleString('bn-BD')}</span>
                    </div>
                    <div className="bg-rose-600/30 p-2.5 rounded-xl border border-rose-500/30">
                      <span className="block opacity-90 text-[9px] text-rose-300">ভুল</span>
                      <span className="text-base font-extrabold text-rose-200">{(user.lifetimeWrong || 0).toLocaleString('bn-BD')}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

        </div>
        )
      )}

      {/* -------------------- POPUP: CUSTOM PRACTICE CONFIG SETUP MODAL -------------------- */}
      {setupModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-white w-full max-w-[480px] max-h-[92vh] overflow-y-auto rounded-3xl p-5 sm:p-6 flex flex-col gap-4 shadow-2xl animate-scale-up">
            <div className="border-b pb-3 flex justify-between items-center">
              <h3 className="font-extrabold text-gray-900 text-sm sm:text-base flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-600" />
                {revisionMode ? 'ভুল সংশোধন কুইজ কন্ট্রোলস' : 'কাস্টম পরীক্ষা সেটিংস ও প্রশ্ন বাছাই'}
              </h3>
              <button 
                onClick={() => setSetupModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* OVERRIDE POOL BANNER (If opened from Reader Mode or Category Card) */}
            {customExamTitle && (
              <div className="bg-indigo-50 border border-indigo-200/80 p-3 rounded-2xl flex items-center justify-between text-xs font-bold text-indigo-950 shadow-2xs">
                <div className="flex items-center gap-2 truncate pr-2">
                  <span className="p-1.5 bg-indigo-600 text-white rounded-lg shrink-0">📝</span>
                  <span className="truncate">{customExamTitle}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCustomExamOverridePool(null);
                    setCustomExamTitle('');
                  }}
                  className="text-[10px] text-rose-600 hover:text-rose-700 font-extrabold bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg border border-rose-200/80 shrink-0 transition cursor-pointer"
                >
                  🔄 ফিল্টার পরিবর্তন
                </button>
              </div>
            )}

            {/* CASCADING FILTER BOX (Hide if override pool active) */}
            {!customExamOverridePool && (
              <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/80 flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-slate-200/50 pb-2">
                  <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                    <Filter className="w-4 h-4 text-indigo-600" />
                    ক্যাসকেডিং ফিল্টার (ক্যাটাগরি ও বিষয় বাছাই):
                  </span>
                  {(customExamSelectedCat !== 'ALL' || customExamSelectedSubcat !== 'ALL') && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomExamSelectedCat('ALL');
                        setCustomExamSelectedSubcat('ALL');
                        setCustomExamSelectedSubSubcat('ALL');
                      }}
                      className="text-[10px] font-extrabold text-rose-600 hover:text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100 transition cursor-pointer"
                    >
                      🔄 ফিল্টার রিসেট
                    </button>
                  )}
                </div>

                {/* Level 1: Main Category Filter */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    ১.১ মূল বিষয়/ক্যাটাগরি সিলেক্ট করুন:
                  </label>
                  <select
                    value={customExamSelectedCat}
                    onChange={e => {
                      setCustomExamSelectedCat(e.target.value);
                      setCustomExamSelectedSubcat('ALL');
                      setCustomExamSelectedSubSubcat('ALL');
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="ALL">সকল বিষয় (All Subjects & Categories)</option>
                    {customExamCategoryOptions.map((cat, cIdx) => (
                      <option key={`ce-cat-${cat}-${cIdx}`} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                {/* Level 2: Subcategory Filter */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">
                    ১.২ উপ-অধ্যায়/সাব-ক্যাটাগরি সিলেক্ট করুন:
                  </label>
                  <select
                    value={customExamSelectedSubcat}
                    onChange={e => {
                      setCustomExamSelectedSubcat(e.target.value);
                      setCustomExamSelectedSubSubcat('ALL');
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="ALL">সকল উপ-অধ্যায় (All Subcategories / Topics)</option>
                    {customExamSubcategoryOptions.map((sub, sIdx) => (
                      <option key={`ce-sub-${sub}-${sIdx}`} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>

                {/* Level 3: Sub-subcategory Filter (Conditional) */}
                {customExamSubSubcategoryOptions.length > 0 && (
                  <div className="animate-fade-in">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      ১.৩ বিস্তারিত সাব-টপিক সিলেক্ট করুন:
                    </label>
                    <select
                      value={customExamSelectedSubSubcat}
                      onChange={e => setCustomExamSelectedSubSubcat(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                      <option value="ALL">সকল বিস্তারিত সাব-টপিক</option>
                      {customExamSubSubcategoryOptions.map((subsub, ssIdx) => (
                        <option key={`ce-ssub-${subsub}-${ssIdx}`} value={subsub}>{subsub}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Matching Question Count Badge */}
                <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-indigo-50 p-2.5 rounded-xl border border-indigo-100 flex items-center justify-between mt-0.5">
                  <div className="flex items-center gap-2">
                    <span className="p-1 bg-indigo-600 text-white rounded-lg">
                      <Sparkles className="w-3.5 h-3.5" />
                    </span>
                    <span className="text-[11px] font-extrabold text-indigo-950">
                      উপলব্ধ MCQ: {getCustomExamQuestionsPool().length.toLocaleString('bn-BD')} টি
                    </span>
                  </div>
                  {getCustomExamQuestionsPool().length === 0 && (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded border border-amber-200">
                      ⚠️ প্রশ্ন পাওয়া যায়নি
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* OVERRIDE POOL MCQ BADGE */}
            {customExamOverridePool && (
              <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-indigo-50 p-2.5 rounded-xl border border-indigo-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-1 bg-indigo-600 text-white rounded-lg">
                    <Sparkles className="w-3.5 h-3.5" />
                  </span>
                  <span className="text-[11px] font-extrabold text-indigo-950">
                    উপলব্ধ মোট প্রশ্ন: {getCustomExamQuestionsPool().length.toLocaleString('bn-BD')} টি
                  </span>
                </div>
              </div>
            )}

            {/* QUESTION COUNT LIMIT */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">২. কতটি প্রশ্নে পরীক্ষা দিতে চান?</label>
              <select 
                value={setupQLimit}
                onChange={e => setSetupQLimit(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-xs font-bold text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value={5}>৫ টি প্রশ্ন</option>
                <option value={10}>১০ টি প্রশ্ন</option>
                <option value={15}>১৫ টি প্রশ্ন</option>
                <option value={20}>২০ টি প্রশ্ন</option>
                <option value={25}>২৫ টি প্রশ্ন</option>
                <option value={30}>৩০ টি প্রশ্ন</option>
                <option value={50}>৫০ টি প্রশ্ন</option>
                <option value={100}>১০০ টি প্রশ্ন</option>
                <option value={getCustomExamQuestionsPool().length || 99999}>
                  সকল প্রশ্ন ({getCustomExamQuestionsPool().length.toLocaleString('bn-BD')} টি)
                </option>
              </select>
            </div>

            {/* TIME LIMIT */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">৩. সময়সীমা নির্ধারণ করুন (পরীক্ষার সময়):</label>
              <select 
                value={setupTimeLimit}
                onChange={e => setSetupTimeLimit(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-xs font-bold text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value={1}>১ মিনিট</option>
                <option value={2}>২ মিনিট</option>
                <option value={3}>৩ মিনিট</option>
                <option value={5}>৫ মিনিট</option>
                <option value={10}>১০ মিনিট</option>
                <option value={15}>১৫ মিনিট</option>
                <option value={20}>২০ মিনিট</option>
                <option value={25}>২৫ মিনিট</option>
                <option value={30}>৩০ মিনিট</option>
                <option value={45}>৪৫ মিনিট</option>
                <option value={60}>৬০ মিনিট (১ ঘণ্টা)</option>
                <option value={999}>আনলিমিটেড (টাইমার ছাড়া)</option>
              </select>
            </div>

            {/* ANSWER VIEW MODE */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">৪. কুইজের সঠিক উত্তর ও ব্যাখ্যা কখন দেখতে চান?</label>
              <select 
                value={setupAnswerView}
                onChange={e => setSetupAnswerView(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-xs font-bold text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="instant">প্রতিটি উত্তর সাবমিট করার সাথে সাথে (Instant)</option>
                <option value="after_exam">পরীক্ষা সম্পন্ন হওয়ার পর (After Completion)</option>
              </select>
            </div>

            <button 
              disabled={getCustomExamQuestionsPool().length === 0}
              onClick={startCustomPracticeExam}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-extrabold py-3.5 rounded-2xl text-xs transition shadow-md shadow-indigo-600/20 disabled:shadow-none mt-1 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed"
            >
              <span>🚀 পরীক্ষা শুরু করুন</span>
              {getCustomExamQuestionsPool().length > 0 && (
                <span className="bg-indigo-800/60 text-indigo-100 text-[10px] px-2 py-0.5 rounded-full font-bold">
                  ({Math.min(setupQLimit, getCustomExamQuestionsPool().length).toLocaleString('bn-BD')} টি MCQ)
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* -------------------- POPUP: BOOKMARK GROUP CHOOSE MODAL -------------------- */}
      {bookmarkModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-white w-full max-w-[360px] rounded-3xl p-5 flex flex-col gap-4 shadow-2xl animate-scale-up">
            <div className="border-b pb-2 flex justify-between items-center">
              <h3 className="font-extrabold text-gray-800 text-sm">🔖 বুকমার্কের ধরণ নির্ধারণ</h3>
              <button 
                onClick={() => setBookmarkModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-md"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-500 mb-2">বুকমার্ক গ্রুপ বা ফোল্ডার সিলেক্ট করুন:</label>
              <div className="flex flex-col gap-2">
                <select 
                  disabled={isCustomFolder}
                  value={bookmarkFolder}
                  onChange={e => setBookmarkFolder(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl bg-white text-xs focus:outline-none text-gray-700 disabled:bg-gray-100"
                >
                  <option value="সাধারণ বুকমার্ক">সাধারণ বুকমার্ক</option>
                  <option value="গুরুত্বপূর্ণ কুইজ">গুরুত্বপূর্ণ কুইজ</option>
                  <option value="বিগত বিসিএস প্রশ্ন">বিগত বিসিএস প্রশ্ন</option>
                  <option value="ভুল হওয়া প্রশ্নাবলী">ভুল হওয়া প্রশ্নাবলী</option>
                  {Array.from(new Set((bookmarks || []).map(b => b.folderName)))
                    .filter(f => !['সাধারণ বুকমার্ক', 'গুরুত্বপূর্ণ কুইজ', 'বিগত বিসিএস প্রশ্ন', 'ভুল হওয়া প্রশ্নাবলী'].includes(f))
                    .map(f => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                </select>

                <button 
                  type="button"
                  onClick={() => setIsCustomFolder(!isCustomFolder)}
                  className="text-indigo-600 font-bold hover:underline self-end text-[10px]"
                >
                  {isCustomFolder ? 'গ্রুপ লিস্ট থেকে সিলেক্ট করুন' : '➕ নতুন ফোল্ডার তৈরি করুন...'}
                </button>
              </div>

              {isCustomFolder && (
                <input 
                  type="text" 
                  value={customFolderInput}
                  onChange={e => setCustomFolderInput(e.target.value)}
                  placeholder="নতুন বুকমার্ক ফোল্ডারের নাম"
                  className="w-full px-3 py-2 border rounded-xl mt-2 text-xs text-gray-700 focus:outline-none"
                />
              )}
            </div>

            <button 
              onClick={handleConfirmBookmark}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2.5 rounded-2xl text-xs transition shadow"
            >
              বুকমার্ক লিস্টে সংরক্ষণ করুন
            </button>
          </div>
        </div>
      )}

      {/* -------------------- TRANSPARENT BOTTOM NAVIGATION BAR -------------------- */}
      {!quizActive && !readerModeActive && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/75 backdrop-blur-md border-t border-gray-100 shadow-[0_-8px_32px_rgba(0,0,0,0.06)]">
          <div className="max-w-md mx-auto px-4 py-2 flex justify-between items-center gap-1">
            {[
              { id: 'dashboard', label: 'হোম', icon: Home },
              { id: 'exams', label: 'লাইভ এক্সাম', icon: Clock },
              { id: 'results', label: 'ফলাফল', icon: Award },
              { id: 'routines', label: 'রুটিন', icon: Calendar },
              { id: 'courses', label: 'আমার কোর্স', icon: GraduationCap },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    handleTabSelect(item.id as any);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`flex flex-col items-center justify-center gap-1 flex-1 py-1 rounded-2xl transition-all duration-300 relative group ${
                    isActive 
                      ? 'text-indigo-600 scale-105 font-bold' 
                      : 'text-gray-500 hover:text-indigo-500 font-medium'
                  }`}
                >
                  <div className={`p-2 rounded-xl transition-all duration-300 ${
                    isActive 
                      ? 'bg-indigo-100/60 text-indigo-700 shadow-sm' 
                      : 'bg-transparent text-gray-400 group-hover:bg-gray-100/50 group-hover:text-indigo-600'
                  }`}>
                    <Icon className={`w-4.5 h-4.5 transition-transform duration-300 ${isActive ? 'scale-110 stroke-[2.5]' : 'group-hover:scale-110'}`} />
                  </div>
                  <span className="text-[10px] tracking-tight whitespace-nowrap">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* -------------------- CUSTOM ALERT DIALOG -------------------- */}
      {customAlert && customAlert.open && (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-white w-full max-w-[380px] rounded-3xl p-6 flex flex-col gap-4 shadow-2xl animate-scale-up">
            <div className="flex items-center gap-2.5 text-indigo-600">
              <span className="text-xl">📢</span>
              <h3 className="font-extrabold text-gray-800 text-sm">{customAlert.title || 'বিজ্ঞপ্তি'}</h3>
            </div>
            <p className="text-xs text-gray-600 font-semibold leading-relaxed whitespace-pre-line">
              {customAlert.message}
            </p>
            <div className="flex gap-2.5 mt-1">
              {(customAlert.showCancel || (user.isGuest && customAlert.onConfirm)) && (
                <button
                  onClick={() => setCustomAlert(null)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 rounded-2xl text-xs transition cursor-pointer"
                >
                  {customAlert.cancelText || 'এখন নয়'}
                </button>
              )}
              <button
                onClick={() => {
                  const onConf = customAlert.onConfirm;
                  setCustomAlert(null);
                  if (typeof onConf === 'function') onConf();
                }}
                className={`${(customAlert.showCancel || (user.isGuest && customAlert.onConfirm)) ? 'flex-1' : 'w-full'} bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2.5 rounded-2xl text-xs transition shadow cursor-pointer`}
              >
                {customAlert.confirmText || (user.isGuest && customAlert.onConfirm ? 'রেজিস্ট্রেশন করুন' : 'ঠিক আছে')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------- CUSTOM CONFIRM DIALOG -------------------- */}
      {customConfirm && customConfirm.open && (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-white w-full max-w-[380px] rounded-3xl p-6 flex flex-col gap-4 shadow-2xl animate-scale-up">
            <div className="flex items-center gap-2.5 text-rose-600">
              <span className="text-xl">❓</span>
              <h3 className="font-extrabold text-gray-800 text-sm">{customConfirm.title || 'অনুমতি প্রয়োজন'}</h3>
            </div>
            <p className="text-xs text-gray-600 font-semibold leading-relaxed whitespace-pre-line">
              {customConfirm.message}
            </p>
            <div className="flex gap-3 mt-1">
              <button
                onClick={() => {
                  const onCanc = customConfirm.onCancel;
                  setCustomConfirm(null);
                  if (onCanc) onCanc();
                }}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 rounded-2xl text-xs transition"
              >
                বাতিল করুন
              </button>
              <button
                onClick={() => {
                  const onConf = customConfirm.onConfirm;
                  setCustomConfirm(null);
                  onConf();
                }}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-extrabold py-2.5 rounded-2xl text-xs transition shadow"
              >
                হ্যাঁ, নিশ্চিত
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------- PROFILE SETTINGS MODAL -------------------- */}
      {profileModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-white w-full max-w-[480px] max-h-[92vh] overflow-y-auto rounded-3xl p-5 sm:p-6 flex flex-col gap-4 shadow-2xl animate-scale-up">
            
            {/* Modal Header */}
            <div className="border-b pb-3 flex justify-between items-center">
              <h3 className="font-extrabold text-gray-900 text-base flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-600" />
                প্রোফাইল সেটিংস (Profile Settings)
              </h3>
              <button 
                type="button"
                onClick={() => setProfileModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Alert Messages */}
            {profileErrorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{profileErrorMsg}</span>
              </div>
            )}

            {profileSuccessMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{profileSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="flex flex-col gap-4 text-xs">
              
              {/* Profile Photo Section */}
              <div className="flex flex-col items-center gap-3 bg-indigo-50/60 p-4 rounded-2xl border border-indigo-100">
                <div className="relative group">
                  <img 
                    src={editAvatar || user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'} 
                    alt="Profile Preview" 
                    className="w-20 h-20 rounded-full border-2 border-indigo-600 bg-white object-cover shadow-md"
                  />
                  <label 
                    htmlFor="profile-photo-upload"
                    className="absolute bottom-0 right-0 p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-md cursor-pointer transition"
                    title="Change photo (Max 100KB)"
                  >
                    <Camera className="w-4 h-4" />
                  </label>
                  <input 
                    type="file" 
                    id="profile-photo-upload" 
                    accept="image/*" 
                    onChange={handlePhotoUpload}
                    className="hidden" 
                  />
                </div>

                <div className="text-center flex flex-col items-center gap-1">
                  <label htmlFor="profile-photo-upload" className="text-xs font-bold text-indigo-700 hover:underline cursor-pointer flex items-center gap-1">
                    <Upload className="w-3.5 h-3.5" />
                    নতুন ছবি আপলোড করুন (সর্বোচ্চ ১০০ KB)
                  </label>
                  <p className="text-[10px] text-gray-500 font-medium">
                    অনুমোদিত ফরম্যাট: JPG, PNG, WebP (Max Size: 100 KB)
                  </p>
                  {photoError && (
                    <span className="text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg mt-1">
                      ⚠️ {photoError}
                    </span>
                  )}
                </div>

                {/* Preset Avatars */}
                <div className="w-full border-t border-indigo-100 pt-2 mt-1">
                  <p className="text-[10px] font-bold text-gray-500 mb-1.5 text-center">অথবা ডেমো অ্যাভাটার সিলেক্ট করুন:</p>
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    {[
                      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
                      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
                      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150',
                      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
                      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150',
                      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150'
                    ].map((url, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setEditAvatar(url);
                          setPhotoError(null);
                        }}
                        className={`w-9 h-9 rounded-full border-2 overflow-hidden transition ${
                          editAvatar === url ? 'border-indigo-600 scale-110 shadow-sm ring-2 ring-indigo-200' : 'border-gray-200 hover:border-indigo-300'
                        }`}
                      >
                        <img src={url} alt={`Avatar ${idx}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Name Input */}
              <div>
                <label className="block text-gray-700 font-bold mb-1">
                  পুরো নাম (Full Name) <span className="text-rose-500">*</span>
                </label>
                <input 
                  type="text" 
                  required
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="আপনার নাম লিখুন"
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
                />
              </div>

              {/* Phone Input */}
              <div>
                <label className="block text-gray-700 font-bold mb-1 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-indigo-600" />
                  মোবাইল নম্বর (Mobile Number) <span className="text-[10px] text-gray-400 font-normal ml-auto">(ঐচ্ছিক)</span>
                </label>
                <input 
                  type="tel" 
                  value={editPhone}
                  onChange={e => setEditPhone(e.target.value)}
                  placeholder="যেমন: 01700000000"
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
                />
              </div>

              {/* Education Input */}
              <div>
                <label className="block text-gray-700 font-bold mb-1">
                  শিক্ষাগত যোগ্যতা (Educational Qualification) <span className="text-rose-500">*</span>
                </label>
                <select 
                  value={editEducation}
                  onChange={e => setEditEducation(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium bg-white"
                >
                  <option value="উচ্চ মাধ্যমিক/সমমান">উচ্চ মাধ্যমিক/সমমান</option>
                  <option value="স্নাতক/সমমান">স্নাতক/সমমান</option>
                  <option value="স্নাতকোত্তর/সমমান">স্নাতকোত্তর/সমমান</option>
                  <option value="মাধ্যমিক/সমমান">মাধ্যমিক/সমমান</option>
                  <option value="ডিপ্লোমা">ডিপ্লোমা</option>
                  <option value="অন্যান্য">অন্যান্য</option>
                </select>
              </div>

              {/* Password Section */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex flex-col gap-3">
                <div className="flex items-center gap-1.5 text-gray-800 font-bold border-b border-slate-200 pb-2">
                  <KeyRound className="w-4 h-4 text-indigo-600" />
                  <span>পাসওয়ার্ড পরিবর্তন (Password Change)</span>
                  <span className="text-[10px] text-gray-400 font-normal ml-auto">(ঐচ্ছিক)</span>
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold mb-1">
                    নতুন পাসওয়ার্ড (New Password)
                  </label>
                  <div className="relative">
                    <input 
                      type={showPassword ? 'text' : 'password'}
                      value={editPassword}
                      onChange={e => setEditPassword(e.target.value)}
                      placeholder="নতুন পাসওয়ার্ড লিখুন (কমপক্ষে ৬ অক্ষর)"
                      className="w-full px-3.5 py-2.5 pr-10 border border-gray-200 rounded-xl text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {editPassword.trim().length > 0 && (
                  <div>
                    <label className="block text-gray-700 font-semibold mb-1">
                      পাসওয়ার্ড নিশ্চিত করুন (Confirm Password)
                    </label>
                    <input 
                      type={showPassword ? 'text' : 'password'}
                      value={editConfirmPassword}
                      onChange={e => setEditConfirmPassword(e.target.value)}
                      placeholder="নতুন পাসওয়ার্ডটি পুনরায় লিখুন"
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 mt-2">
                <button 
                  type="button"
                  onClick={() => setProfileModalOpen(false)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 rounded-xl transition"
                >
                  বাতিল
                </button>
                <button 
                  type="submit"
                  disabled={isSavingProfile}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2.5 rounded-xl transition shadow-md shadow-indigo-100 flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isSavingProfile ? (
                    <span>সংরক্ষণ হচ্ছে...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      সংরক্ষণ করুন
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {renderModals()}
    </div>
  );
}
