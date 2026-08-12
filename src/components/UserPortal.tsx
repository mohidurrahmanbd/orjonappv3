import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Question, LiveExam, Notice, Routine, User, Attempt, Bookmark, CategoryItem, SubcategoryItem, formatBengaliDate } from '../types';
import { 
  User as UserIcon, BookOpen, Award, Bookmark as BookmarkIcon, 
  FileText, Clock, ArrowLeft, CheckCircle2, XCircle, Compass, 
  ChevronRight, Sparkles, TrendingUp, AlertCircle, Calendar, 
  HelpCircle, Maximize2, FolderHeart, RefreshCw, Layers, Settings,
  Folder, FolderOpen, Home, Menu, X, Filter,
  Languages, Feather, Calculator, Binary, FlaskConical, Atom, Dna, Laptop, Cpu,
  Landmark, Flag, Globe2, BrainCircuit, Scale, ShieldCheck, Lightbulb, GraduationCap,
  Building2, Coins, School, Globe, History, BookMarked,
  Camera, Eye, EyeOff, KeyRound, Upload, Phone
} from 'lucide-react';
import { motion } from 'motion/react';

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
  questions,
  liveExams,
  notices,
  routines,
  attempts,
  bookmarks,
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'preparation' | 'job' | 'yearJob' | 'bookmarks' | 'exams' | 'results' | 'routines' | 'profile'>('dashboard');
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Study & Preparation states
  const [prepCategory, setPrepCategory] = useState('সাধারণ জ্ঞান');
  const [prepMode, setPrepMode] = useState<'verify' | 'read' | 'exam'>('verify');
  const [prepExamLimit, setPrepExamLimit] = useState(10);
  
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
    message: string,
    onConfirm?: () => void,
    title?: string,
    showCancel?: boolean,
    confirmText?: string,
    cancelText?: string
  ) => {
    setCustomAlert({ open: true, title, message, onConfirm, showCancel, confirmText, cancelText });
  };

  const showCustomConfirm = (message: string, onConfirm: () => void, onCancel?: () => void, title?: string) => {
    setCustomConfirm({ open: true, title, message, onConfirm, onCancel });
  };

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

  const handleTabSelect = (tab: 'dashboard' | 'preparation' | 'job' | 'yearJob' | 'bookmarks' | 'exams' | 'results' | 'routines' | 'profile') => {
    if (user.isGuest && (tab === 'bookmarks' || tab === 'routines')) {
      checkGuestAccess(
        tab === 'bookmarks' ? 'সেভকৃত বুকমার্কস' : 'একাডেমিক রুটিন'
      );
      return;
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
            <div class="mark-calc-title">📊 নম্বর গণনার বিস্তারিত হিসাব (Mark Calculation Table)</div>
            <table class="mark-calc-table">
              <thead>
                <tr>
                  <th style="text-align: left;">বিবরণ (Item)</th>
                  <th>সংখ্যা (Count)</th>
                  <th>প্রতিটির মান (Value per item)</th>
                  <th>মোট নম্বর (Marks)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="text-align: left; font-weight: 700; color: #166534;">✅ সঠিক উত্তর (Correct Answers)</td>
                  <td style="font-weight: 700;">${correctC}টি</td>
                  <td>+১.০০</td>
                  <td style="color: #16a34a; font-weight: 800;">+${correctMarks}</td>
                </tr>
                <tr>
                  <td style="text-align: left; font-weight: 700; color: #9f1239;">❌ ভুল উত্তরের জন্য নেগেটিভ মার্ক (Wrong Answer Penalty)</td>
                  <td style="font-weight: 700;">${wrongC}টি</td>
                  <td>-০.৫০</td>
                  <td style="color: #dc2626; font-weight: 800;">-${negativeDeduction}</td>
                </tr>
                <tr>
                  <td style="text-align: left; font-weight: 700; color: #475569;">⚪ অনুত্তর / স্কিপড (Unanswered / Skipped)</td>
                  <td style="font-weight: 700;">${skippedC}টি</td>
                  <td>০.০০</td>
                  <td style="color: #64748b; font-weight: 800;">০.০০</td>
                </tr>
                <tr class="total-row">
                  <td style="text-align: left; font-weight: 800; color: #1e1b4b;">🏆 সর্বমোট অর্জিত নম্বর (Net Final Score)</td>
                  <td style="font-weight: 800; color: #1e1b4b;">${totalQ}টি</td>
                  <td style="color: #64748b;">—</td>
                  <td style="color: #4f46e5; font-weight: 800; font-size: 14px;">${netScore}</td>
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

          const isCorrect = selectedAnsKey === q.correct;
          const correctText = q[q.correct.replace('Option ', 'option') as keyof Question] as string;
          const userAnsText = selectedAnsKey && (q as any)[selectedAnsKey.replace('Option ', 'option')]
            ? (q as any)[selectedAnsKey.replace('Option ', 'option')]
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

  const distinctCategories = Array.from(new Set(categories.length > 0 ? categories.map(c => c.name.trim()) : questions.map(q => q.category.trim())));
  const distinctSubcategories = Array.from(new Set(subcategories.length > 0 ? subcategories.map(s => s.name.trim()) : (questions.map(q => q.subcategory?.trim()).filter(Boolean) as string[])));

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
        finalQuestions = fetched.filter(q => idSet.has(q.id));
      }
      
      // Keep original order of selected questions if possible
      finalQuestions.sort((a, b) => {
        const idxA = exam.questionIds!.indexOf(a.id);
        const idxB = exam.questionIds!.indexOf(b.id);
        return idxA - idxB;
      });
    } else {
      let pool = questions;
      if (exam.category !== 'ALL') {
        pool = questions.filter(q => q.category === exam.category || (q.categories && q.categories.includes(exam.category)));
        if (pool.length === 0 && onFetchQuestionsLazy) {
          const fetched = await onFetchQuestionsLazy({ category: exam.category, examId: exam.id });
          pool = fetched.filter(q => q.category === exam.category || (q.categories && q.categories.includes(exam.category)));
        }
      } else if (pool.length === 0 && onFetchQuestionsLazy) {
        pool = await onFetchQuestionsLazy({ examId: exam.id });
      }

      if (pool.length === 0) {
        showCustomAlert('দুঃখিত, এই পরীক্ষার সাথে সম্পর্কিত কোনো কুইজ ডাটাবেসে পাওয়া যায়নি!');
        return;
      }
      const limit = Math.min(exam.qLimit, pool.length);
      finalQuestions = [...pool].sort(() => 0.5 - Math.random()).slice(0, limit);
    }

    if (finalQuestions.length === 0) {
      showCustomAlert('দুঃখিত, এই পরীক্ষার সাথে সম্পর্কিত কোনো কুইজ ডাটাবেসে পাওয়া যায়নি!');
      return;
    }

    setQuizQuestions(finalQuestions);
    setQuizTitle(exam.title);
    setQuizExamId(exam.id);
    setQuizTimeLimitMinutes(exam.timeLimit);
    setQuizAnswerMode('after_exam');
    setCurrentQIndex(0);
    setUserSelectedAnswers({});
    setSecondsRemaining(exam.timeLimit * 60);
    setQuizActive(true);
    setIsQuizTimerRunning(true);
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
            {(activeTab !== 'dashboard' || prepPath.length > 0 || jobPath.length > 0 || yearJobPath.length > 0 || selectedAttemptForView || selectedBookmarkFolder || setupModalOpen) && (
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

      {/* -------------------- ACTIVE QUIZ ENGINE CONTAINER -------------------- */}
      {quizActive && (
        <div className="flex-grow flex flex-col justify-between bg-white border border-gray-100 shadow-xl rounded-2xl p-3 sm:p-4 md:p-5 animate-fade-in">
          
          {/* Header */}
          <div className="flex justify-between items-start border-b pb-2.5 gap-2">
            <div className="min-w-0 flex-1 pr-1">
              <span className="text-[9px] bg-indigo-100 text-indigo-800 font-extrabold px-2 py-0.5 rounded-full border border-indigo-200 inline-block">
                ACTIVE TEST
              </span>
              <h3 className="text-xs sm:text-sm font-bold text-gray-800 mt-1 truncate">
                {quizTitle}
              </h3>
              <p className="text-[10px] text-gray-400 mt-0.5 font-semibold truncate">
                ক্যাটাগরি: {quizQuestions[currentQIndex]?.category} {quizQuestions[currentQIndex]?.subcategory ? `| ${quizQuestions[currentQIndex].subcategory}` : ''}
              </p>
            </div>

            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 flex-wrap justify-end max-w-[65%] sm:max-w-none">
              {/* Timer indicator */}
              {quizTimeLimitMinutes !== 'unlimited' && (
                <div className="bg-rose-50 border border-rose-100 text-rose-600 px-2 sm:px-2.5 py-1 rounded-xl text-[11px] sm:text-xs font-bold flex items-center gap-1 animate-pulse shrink-0 whitespace-nowrap">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {Math.floor(secondsRemaining / 60).toString().padStart(2, '0')}:
                    {(secondsRemaining % 60).toString().padStart(2, '0')}
                  </span>
                </div>
              )}
              
              <button 
                onClick={() => handleOpenBookmarkDialog(quizQuestions[currentQIndex]?.id)}
                className={`p-1 sm:p-1.5 rounded-xl border transition shrink-0 ${
                  quizQuestions[currentQIndex]?.id && bookmarks.some(b => b.questionId === quizQuestions[currentQIndex].id)
                    ? 'bg-yellow-50 border-yellow-200 text-yellow-600' 
                    : 'bg-gray-50 hover:bg-amber-50 text-gray-500 hover:text-amber-600'
                }`}
                title={quizQuestions[currentQIndex]?.id && bookmarks.some(b => b.questionId === quizQuestions[currentQIndex].id) ? 'বুকমার্ক করা হয়েছে' : 'বুকমার্ক করুন'}
              >
                <BookmarkIcon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
                  quizQuestions[currentQIndex]?.id && bookmarks.some(b => b.questionId === quizQuestions[currentQIndex].id)
                    ? 'fill-yellow-300 text-yellow-500' 
                    : ''
                }`} />
              </button>

              <div className="bg-indigo-600 text-white text-[11px] sm:text-xs font-extrabold px-2 sm:px-2.5 py-1 rounded-xl shadow-sm shrink-0 whitespace-nowrap">
                {(currentQIndex + 1).toLocaleString('bn-BD')} / {quizQuestions.length.toLocaleString('bn-BD')}
              </div>
            </div>
          </div>

          {/* Question Text */}
          <div className="my-3 sm:my-4">
            <h4 className="text-base sm:text-lg font-bold text-gray-900 leading-relaxed bg-gray-50/50 p-2.5 sm:p-3 rounded-xl border border-gray-100">
              {(currentQIndex + 1).toLocaleString('bn-BD')}. {quizQuestions[currentQIndex]?.text}
            </h4>
          </div>

          {/* Options Grid */}
          <div className="flex flex-col gap-2">
            {[
              { key: 'Option A', label: 'ক) ', text: quizQuestions[currentQIndex]?.optionA },
              { key: 'Option B', label: 'খ) ', text: quizQuestions[currentQIndex]?.optionB },
              { key: 'Option C', label: 'গ) ', text: quizQuestions[currentQIndex]?.optionC },
              { key: 'Option D', label: 'ঘ) ', text: quizQuestions[currentQIndex]?.optionD }
            ].map(opt => {
              const isSelected = userSelectedAnswers[currentQIndex] === opt.key;
              const hasAnsweredThis = userSelectedAnswers.hasOwnProperty(currentQIndex);
              const isCorrect = opt.key === quizQuestions[currentQIndex]?.correct;

              let btnStyle = "border-gray-200 text-gray-700 hover:bg-gray-50";
              if (hasAnsweredThis) {
                if (quizAnswerMode === 'instant') {
                  if (isCorrect) {
                    btnStyle = "bg-green-50 border-green-400 text-green-800 font-bold shadow-sm";
                  } else if (isSelected) {
                    btnStyle = "bg-rose-50 border-rose-400 text-rose-800 font-bold";
                  } else {
                    btnStyle = "border-gray-100 text-gray-400 opacity-60";
                  }
                } else {
                  if (isSelected) {
                    btnStyle = "bg-indigo-50 border-indigo-400 text-indigo-800 font-bold shadow-sm";
                  } else {
                    btnStyle = "border-gray-100 text-gray-400 opacity-60";
                  }
                }
              }

              return (
                <button
                  key={opt.key}
                  disabled={hasAnsweredThis}
                  onClick={() => handleSelectOption(opt.key)}
                  className={`w-full text-left px-3 py-2 sm:py-2.5 border rounded-xl text-xs font-semibold transition flex justify-between items-center ${btnStyle}`}
                >
                  <span>{opt.label}{opt.text}</span>
                  {hasAnsweredThis && quizAnswerMode === 'instant' && (
                    isCorrect ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" /> : isSelected ? <XCircle className="w-4 h-4 text-rose-600 shrink-0" /> : null
                  )}
                </button>
              );
            })}
          </div>

          {/* Instant explanation card replaced with feedback / popup triggers */}
          {userSelectedAnswers.hasOwnProperty(currentQIndex) && (() => {
            const currentQ = quizQuestions[currentQIndex];
            const masterQ = questions.find(mq => mq.id === currentQ?.id) || currentQ;
            const hasPendingReport = !!masterQ?.comments?.some(c => !c.pointsApproved);
            const hasPendingExplanation = !!masterQ?.userExplanations?.some(e => !e.approved);

            return (
              <div className="flex flex-row flex-wrap gap-2 items-center mt-6 pt-3 border-t border-gray-150">
                <button
                  type="button"
                  onClick={() => setPopupExplanationQ(masterQ)}
                  className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-[11px] transition cursor-pointer flex items-center gap-1.5"
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
                  className="px-3 py-1.5 rounded-xl font-extrabold text-[11px] transition flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-100/50 cursor-pointer disabled:bg-rose-100/80 disabled:text-rose-700/80 disabled:border-rose-200/50 disabled:opacity-100 disabled:cursor-not-allowed"
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
                  className="px-3 py-1.5 rounded-xl font-extrabold text-[11px] transition flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-100/50 cursor-pointer disabled:bg-amber-100/85 disabled:text-amber-700/80 disabled:border-amber-200/50 disabled:opacity-100 disabled:cursor-not-allowed"
                >
                  {allowUserExplanation ? '✍️ ব্যাখ্যা +' : '✍️ ব্যাখ্যা (বন্ধ)'}
                </button>
              </div>
            );
          })()}

          {/* Nav Buttons */}
          <div className="flex flex-col gap-3 mt-8">
            <div className="flex justify-between items-center gap-3">
              <button
                onClick={handlePrevQuestion}
                disabled={currentQIndex === 0}
                className="flex-1 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 font-bold py-3 rounded-2xl text-xs transition"
              >
                ◀ পূর্ববর্তী প্রশ্ন
              </button>
              
              {!userSelectedAnswers.hasOwnProperty(currentQIndex) && (
                <button
                  onClick={handleSkipQuestion}
                  className="flex-1 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold py-3 rounded-2xl text-xs transition border border-amber-100"
                >
                  বাদ দিন (Skip) ↷
                </button>
              )}

              <button
                onClick={handleNextQuestion}
                disabled={currentQIndex === quizQuestions.length - 1}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-3 rounded-2xl text-xs transition shadow"
              >
                পরবর্তী প্রশ্ন ▶
              </button>
            </div>

            <button
              onClick={() => {
                showCustomConfirm(
                  'আপনি কি এই পরীক্ষাটি এখনই সমাপ্ত করে আপনার মার্কস ফলাফল হিসেবে রেকর্ড করতে চান?',
                  () => {
                    handleForceEndExam();
                  }
                );
              }}
              className="w-full bg-rose-600 hover:bg-rose-700 text-white font-extrabold py-3.5 rounded-2xl text-xs transition shadow-md shadow-rose-100 mt-2 text-center"
            >
              🛑 পরীক্ষা সমাপ্ত করুন ও মার্কস জমা দিন
            </button>
            
            <button 
              onClick={() => {
                showCustomConfirm(
                  'আপনি কি নিশ্চিত পরীক্ষা বাতিল করতে চান? এতে পরীক্ষার প্রগ্রেস হারিয়ে যাবে।',
                  () => {
                    setIsQuizTimerRunning(false);
                    setQuizActive(false);
                  }
                );
              }}
              className="text-center text-gray-400 hover:text-gray-600 underline text-[10px] mt-1 transition"
            >
              বাতিল করে চলে যান (ফলাফল সংরক্ষণ হবে না)
            </button>
          </div>
        </div>
      )}

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
                <div className="grid grid-cols-2 gap-2">
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
                    className="cursor-pointer p-2.5 rounded-xl border bg-gradient-to-br from-amber-50/50 to-amber-100/30 border-amber-150 hover:shadow transition flex flex-col justify-between min-h-[85px]"
                  >
                    <span className="text-xl">🔖</span>
                    <div>
                      <h4 className="text-xs font-bold text-amber-950">বুকমার্ক কালেকশন</h4>
                      <p className="text-[9px] text-amber-700/80 mt-0.5">সংরক্ষিত গুরুত্বপূর্ণ প্রশ্ন</p>
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

              {/* History & Routines Quick View */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button 
                  onClick={() => handleTabSelect('results')}
                  className="bg-indigo-900 hover:bg-indigo-950 text-white p-4 rounded-2xl text-center shadow transition flex items-center justify-between font-bold text-xs"
                >
                  📊 ফলাফল ও বিস্তারিত উত্তরপত্র ভিউ
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => handleTabSelect('routines')}
                  className="bg-indigo-900 hover:bg-indigo-950 text-white p-4 rounded-2xl text-center shadow transition flex items-center justify-between font-bold text-xs"
                >
                  📅 একাডেমি রুটিন ও শিডিউল জোন
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
            const userCreatedAttempts = attempts.filter(a => a.examId.startsWith('prep_') || a.examId.startsWith('job_') || a.examId.startsWith('custom_'));
            const adminCreatedAttempts = attempts.filter(a => !a.examId.startsWith('prep_') && !a.examId.startsWith('job_') && !a.examId.startsWith('custom_'));
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

              return (
                <div className="bg-white border border-gray-100 p-5 rounded-3xl shadow-sm flex flex-col gap-4">
                  {/* Top Bar with Title, PDF Export & Back */}
                  <div className="flex flex-wrap justify-between items-center border-b pb-3 gap-2">
                    <div>
                      <h3 className="font-extrabold text-indigo-950 text-sm sm:text-base flex items-center gap-1.5">
                        🛡️ {selectedAttemptForView.examTitle}
                      </h3>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        তারিখ: {new Date(selectedAttemptForView.submittedAt).toLocaleString('bn-BD')} | মোট প্রশ্ন: {selectedAttemptForView.totalQuestions}টি | সঠিক: {selectedAttemptForView.correctCount}টি | ভুল: {selectedAttemptForView.wrongCount}টি
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
                        <span>📊 নম্বর গণনার টেবিল (PDF)</span>
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

                  {/* Mark Calculation Table Breakdown */}
                  {(() => {
                    const totalQ = selectedAttemptForView.totalQuestions || attemptQuestions.length || 1;
                    const correctC = selectedAttemptForView.correctCount || 0;
                    const wrongC = selectedAttemptForView.wrongCount || 0;
                    const skippedC = Math.max(0, totalQ - correctC - wrongC);

                    return (
                      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-100">
                          <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm flex items-center gap-2">
                            <span>📊 নম্বর গণনার বিস্তারিত বিবরণী (Mark Calculation Breakdown)</span>
                          </h4>
                          <span className="text-[10px] bg-rose-50 text-rose-700 border border-rose-200/80 px-2.5 py-0.5 rounded-full font-bold">
                            ভুল উত্তর পেনাল্টি: -০.৫০ মার্কস / প্রশ্ন
                          </span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-50 text-slate-700 border-b border-slate-200 font-bold">
                                <th className="p-2.5 rounded-l-xl">বিবরণ</th>
                                <th className="p-2.5 text-center">সংখ্যা</th>
                                <th className="p-2.5 text-center">প্রতিটির মান</th>
                                <th className="p-2.5 text-right rounded-r-xl">অর্জিত / কাটা নম্বর</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-semibold text-slate-800">
                              <tr>
                                <td className="p-2.5 text-emerald-700 font-bold flex items-center gap-1.5">
                                  <span>✅</span> সঠিক উত্তর
                                </td>
                                <td className="p-2.5 text-center">{correctC}টি</td>
                                <td className="p-2.5 text-center text-slate-400">+১.০০</td>
                                <td className="p-2.5 text-right font-extrabold text-emerald-600">+{(correctC * 1.0).toFixed(2)}</td>
                              </tr>
                              <tr>
                                <td className="p-2.5 text-rose-700 font-bold flex items-center gap-1.5">
                                  <span>❌</span> ভুল উত্তরের পেনাল্টি
                                </td>
                                <td className="p-2.5 text-center">{wrongC}টি</td>
                                <td className="p-2.5 text-center text-slate-400">-০.৫০</td>
                                <td className="p-2.5 text-right font-extrabold text-rose-600">-{(wrongC * 0.5).toFixed(2)}</td>
                              </tr>
                              <tr>
                                <td className="p-2.5 text-amber-700 font-bold flex items-center gap-1.5">
                                  <span>⚪</span> অনুত্তর / স্কিপড
                                </td>
                                <td className="p-2.5 text-center">{skippedC}টি</td>
                                <td className="p-2.5 text-center text-slate-400">০.০০</td>
                                <td className="p-2.5 text-right font-extrabold text-slate-400">০.০০</td>
                              </tr>
                              <tr className="bg-indigo-50/80 font-bold text-indigo-950">
                                <td className="p-2.5 font-extrabold text-indigo-900 rounded-l-xl">
                                  🏆 সর্বমোট অর্জিত নম্বর
                                </td>
                                <td className="p-2.5 text-center font-black">{totalQ}টি</td>
                                <td className="p-2.5 text-center text-slate-400">—</td>
                                <td className="p-2.5 text-right font-black text-indigo-700 text-sm rounded-r-xl">{selectedAttemptForView.score}</td>
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

                        const isCorrect = selectedAnsKey === q.correct;
                        const correctText = q[q.correct.replace('Option ', 'option') as keyof Question] as string;
                        const userAnsText = selectedAnsKey && (q as any)[selectedAnsKey.replace('Option ', 'option')]
                          ? (q as any)[selectedAnsKey.replace('Option ', 'option')]
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
                          const isUserCreated = a.examId.startsWith('prep_') || a.examId.startsWith('job_') || a.examId.startsWith('custom_');
                          let hoursLeft = 0;
                          if (isUserCreated) {
                            const submittedTime = new Date(a.submittedAt).getTime();
                            const diffMs = Date.now() - submittedTime;
                            hoursLeft = Math.max(0, 72 - diffMs / (1000 * 60 * 60));
                          }

                          return (
                            <div key={a.id ? `att-${a.id}-${aIdx}` : `att-${aIdx}`} className="py-3 flex justify-between items-center hover:bg-gray-50/50 px-1 transition rounded-lg">
                              <div>
                                <h4 className="font-bold text-indigo-950">{a.examTitle}</h4>
                                <p className="text-[10px] text-gray-400 mt-0.5">
                                  মোট প্রশ্ন: {a.totalQuestions}টি | সঠিক: {a.correctCount}টি | ভুল: {a.wrongCount}টি 
                                </p>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                  <span className="text-[9px] text-gray-400 font-medium">
                                    তারিখ: {new Date(a.submittedAt).toLocaleDateString('bn-BD')}
                                  </span>
                                  {isUserCreated && (
                                    <span className="text-[9px] font-black text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-md border border-rose-100">
                                      ⏱️ আর {Math.ceil(hoursLeft).toLocaleString('bn-BD')} ঘণ্টা সংরক্ষিত
                                    </span>
                                  )}
                                  {!isUserCreated && (
                                    <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-100">
                                      🛡️ আজীবন সংরক্ষিত
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                <span className="text-indigo-600 font-extrabold text-xs bg-indigo-50 px-2.5 py-1.5 rounded-xl border border-indigo-100">
                                  {a.score.toLocaleString('bn-BD')} মার্কস
                                </span>
                                
                                <button 
                                  onClick={() => setSelectedAttemptForView(a)}
                                  className="text-indigo-600 font-extrabold text-[10px] hover:underline cursor-pointer"
                                >
                                  বিশ্লেষণ ➔
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

                  {/* VIEW: ACADEMIC ROUTINES */}
          {activeTab === 'routines' && (
            user.isGuest ? (
              renderGuestLockCard(
                'একাডেমিক রুটিন লক করা আছে',
                'গেস্ট (Guest) হিসেবে শুধুমাত্র "লাইভ পরীক্ষা" দেওয়া যায়। একাডেমিক পরীক্ষার সময়সূচী ও রুটিন দেখতে অ্যাকাউন্ট রেজিস্ট্রেশন করুন।'
              )
            ) : (
            <div className="bg-white border border-gray-100 p-5 rounded-3xl shadow-sm flex flex-col gap-4 text-xs">
              {routines.length === 0 ? (
                <p className="text-gray-400 text-center py-10">বর্তমানে কোনো রুটিন প্রকাশিত হয়নি।</p>
              ) : (
                <div className="space-y-4">
                  {routines.map((item, idx) => (
                    <div key={item.id ? `usr-rt-${item.id}-${idx}` : `usr-rt-${idx}`} className="p-4 bg-gray-50 border border-gray-100 rounded-2xl">
                      <div className="flex justify-between items-start border-b pb-1.5 mb-2 border-gray-200">
                        <h4 className="font-extrabold text-indigo-900 text-xs">{item.title}</h4>
                        <span className="text-[9px] text-gray-400 font-semibold">{new Date(item.createdAt).toLocaleDateString('bn-BD')}</span>
                      </div>
                      <p className="text-gray-600 leading-relaxed whitespace-pre-line text-[11px] font-medium">
                        {item.details}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            )
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
                  {Array.from(new Set(bookmarks.map(b => b.folderName)))
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
              { id: 'bookmarks', label: 'বুকমার্ক', icon: BookmarkIcon },
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
                  if (onConf) onConf();
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
