import React, { useState, useMemo, useEffect } from 'react';
import { Question, LiveExam, Notice, Routine, ScheduledExamConfig, User, Attempt, CategoryItem, SubcategoryItem, AuditLog, Course, formatBengaliDate, formatBengaliDateTime } from '../types';
import { 
  Plus, Trash2, Edit, Upload, BookOpen, Users, 
  Settings, AlertCircle, Calendar, Award, X, RefreshCw, FolderTree,
  History, FileText, CheckCircle2, Sparkles, Menu, ChevronDown, ChevronRight, ShieldAlert, AlertTriangle,
  Download, Database, FileJson, RotateCcw, HardDrive, GraduationCap,
  Cloud, UploadCloud, ShieldCheck
} from 'lucide-react';
import { motion } from 'motion/react';
import * as ReactWindow from 'react-window';
import { firebaseConfig } from '../lib/firebase';
import { 
  CollectionCounts, 
  MigrationReport, 
  fetchFirestoreDocumentCounts, 
  migrateDataToFirestore,
  syncCollectionToFirestore,
  getAllLocalStorageMap 
} from '../lib/migration';

import UserGrowthChart from './UserGrowthChart';
import { downloadCourseRoutinePDF } from '../lib/pdfGenerator';
import RoutineHierarchicalMCQModal from './RoutineHierarchicalMCQModal';
import { formatRoutineSyllabusPaths, getRoutineMatchingQuestions } from '../lib/routineUtils';

const List = (ReactWindow as any).FixedSizeList || (ReactWindow as any).default?.FixedSizeList || ReactWindow;

interface AdminPanelProps {
  questions: Question[];
  liveExams: LiveExam[];
  notices: Notice[];
  routines: Routine[];
  courses?: Course[];
  users: User[];
  attempts: Attempt[];
  categories: CategoryItem[];
  subcategories: SubcategoryItem[];
  onAddCategory: (name: string, subHeading?: string) => void;
  onAddSubcategory: (name: string, parentCategory: string, date?: string, subHeading?: string) => void;
  onDeleteCategory: (id: string) => void;
  onDeleteSubcategory: (id: string) => void;
  onBulkDeleteSubcategories?: (ids: string[]) => void;
  onBulkMoveSubcategories?: (ids: string[], newParentCategory: string) => void;
  onUpdateCategory?: (id: string, newName: string, subHeading?: string) => void;
  onUpdateSubcategory?: (id: string, newName: string, newParent: string, date?: string, subHeading?: string) => void;
  onAddQuestion: (q: Omit<Question, 'id'>) => void;
  onUpdateQuestion: (id: string, q: Partial<Question>) => void;
  onDeleteQuestion: (id: string) => void;
  onBulkDeleteQuestions: (ids: string[]) => void;
  onBulkMoveQuestions: (ids: string[], targetCategory: string, targetSubcategory?: string, mode?: 'move' | 'link') => void;
  onBulkUploadQuestions: (questionsList: Omit<Question, 'id'>[]) => void;
  onSaveNotice: (text: string) => void;
  onCreateLiveExam: (exam: Omit<LiveExam, 'id' | 'createdAt'>) => void;
  onDeleteLiveExam: (id: string) => void;
  onSaveRoutine: (
    title: string, 
    details: string, 
    courseId?: string, 
    courseName?: string, 
    selectedCategories?: string[], 
    selectedSubcategories?: string[], 
    selectedLeafCategories?: string[], 
    examConfig?: ScheduledExamConfig
  ) => void;
  onDeleteRoutine: (id: string) => void;
  onSaveCourse?: (course: Omit<Course, 'id' | 'createdAt'>) => void;
  onDeleteCourse?: (id: string) => void;
  onLogout: () => void;
  allowUserExplanation: boolean;
  onToggleUserExplanation: (allowed: boolean) => void;
  showMcqCount?: boolean;
  onToggleMcqCount?: (show: boolean) => void;
  currentAdminPassword?: string;
  onUpdateAdminPassword?: (newPassword: string) => void;
  auditLogs?: AuditLog[];
  onAddAuditLog?: (action: string, details: string, type?: AuditLog['type']) => void;
  onClearAuditLogs?: () => void;
  sessionTimeoutMinutes?: number;
  onUpdateSessionTimeout?: (mins: number) => void;
  onFetchQuestionsLazy?: (filter: { category?: string; subcategory?: string; topic?: string; examId?: string; forceRefresh?: boolean }) => Promise<Question[]>;
  onLoadUsersOnDemand?: () => void;
  onLoadAuditLogsOnDemand?: () => void;
  onLoadAttemptsOnDemand?: () => void;
}

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

// Standard 9 Subject Categories under "বিষয়ভিত্তিক প্রস্তুতি"
export const STANDARD_SUBJECT_CATEGORIES = [
  'বাংলা ব্যাকরণ',
  'বাংলা সাহিত্য',
  'ইংরেজি গ্রামার',
  'ইংরেজি সাহিত্য',
  'গণিত',
  'বাংলাদেশ বিষয়াবলী',
  'আন্তর্জাতিক বিষয়াবলী',
  'সাধারণ বিজ্ঞান',
  'তথ্য ও যোগাযোগ প্রযুক্তি'
] as const;

export interface CSVMismatchMapping {
  id: string;
  rawSubcategory: string;
  correctedSubcategory: string;
  targetCategory: string;
  action: 'create' | 'map_existing';
  existingSubcategoryChoice: string;
  questionCount: number;
  isMismatch: boolean;
}

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

export default function AdminPanel({
  questions = [],
  liveExams = [],
  notices = [],
  routines = [],
  courses = [],
  users = [],
  attempts = [],
  categories = [],
  subcategories = [],
  onAddCategory,
  onAddSubcategory,
  onDeleteCategory,
  onDeleteSubcategory,
  onBulkDeleteSubcategories,
  onBulkMoveSubcategories,
  onUpdateCategory,
  onUpdateSubcategory,
  onAddQuestion,
  onUpdateQuestion,
  onDeleteQuestion,
  onBulkDeleteQuestions,
  onBulkMoveQuestions,
  onBulkUploadQuestions,
  onSaveNotice,
  onCreateLiveExam,
  onDeleteLiveExam,
  onSaveRoutine,
  onDeleteRoutine,
  onSaveCourse,
  onDeleteCourse,
  onLogout,
  allowUserExplanation,
  onToggleUserExplanation,
  showMcqCount = true,
  onToggleMcqCount,
  currentAdminPassword = 'admin123',
  onUpdateAdminPassword,
  auditLogs = [],
  onAddAuditLog,
  onClearAuditLogs,
  sessionTimeoutMinutes = 15,
  onUpdateSessionTimeout,
  onFetchQuestionsLazy,
  onLoadUsersOnDemand,
  onLoadAuditLogsOnDemand,
  onLoadAttemptsOnDemand
}: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'add' | 'manage' | 'categories' | 'exams' | 'courses' | 'routines' | 'results' | 'users' | 'feedback' | 'backup' | 'firestore-migration' | 'audit-logs'>('dashboard');
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Course Form States
  const [courseTitle, setCourseTitle] = useState('');
  const [courseDesc, setCourseDesc] = useState('');
  const [courseCategory, setCourseCategory] = useState('');
  const [courseStatus, setCourseStatus] = useState<'active' | 'upcoming' | 'completed'>('active');
  const [courseStartDate, setCourseStartDate] = useState('');
  const [courseEndDate, setCourseEndDate] = useState('');
  const [routineCourseId, setRoutineCourseId] = useState('');

  const handleCreateCourseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseTitle.trim() || !courseDesc.trim()) {
      showCustomAlert('অসম্পূর্ণ তথ্য!', 'কোর্সের শিরোনাম ও বিস্তারিত বিবরণ দিন!', 'error');
      return;
    }
    if (onSaveCourse) {
      onSaveCourse({
        title: courseTitle.trim(),
        description: courseDesc.trim(),
        status: courseStatus,
        category: courseCategory || undefined,
        startDate: courseStartDate || undefined,
        endDate: courseEndDate || undefined
      });
      showCustomAlert('সফল!', '🎓 নতুন কোর্স সফলভাবে তৈরি ও প্রকাশ করা হয়েছে!', 'success');
      setCourseTitle('');
      setCourseDesc('');
      setCourseCategory('');
      setCourseStatus('active');
      setCourseStartDate('');
      setCourseEndDate('');
    }
  };

  useEffect(() => {
    if (activeTab === 'users' && onLoadUsersOnDemand) {
      onLoadUsersOnDemand();
    } else if (activeTab === 'results' && onLoadAttemptsOnDemand) {
      onLoadAttemptsOnDemand();
    } else if (activeTab === 'audit-logs' && onLoadAuditLogsOnDemand) {
      onLoadAuditLogsOnDemand();
    }
  }, [activeTab]);

  // Audit Log State
  const [auditSearch, setAuditSearch] = useState('');
  const [auditTypeFilter, setAuditTypeFilter] = useState<'all' | 'delete' | 'update' | 'bulk' | 'category' | 'exam' | 'routine' | 'create' | 'user' | 'other'>('all');
  const [showAddLogModal, setShowAddLogModal] = useState(false);
  const [manualActionInput, setManualActionInput] = useState('');
  const [manualDetailsInput, setManualDetailsInput] = useState('');
  const [manualTypeInput, setManualTypeInput] = useState<AuditLog['type']>('other');

  const filteredAuditLogs = useMemo(() => {
    let logs = auditLogs || [];
    if (auditTypeFilter !== 'all') {
      logs = logs.filter(l => (l.type || 'other') === auditTypeFilter);
    }
    if (auditSearch.trim()) {
      const q = auditSearch.trim().toLowerCase();
      logs = logs.filter(l => 
        (l.action || '').toLowerCase().includes(q) || 
        (l.details || '').toLowerCase().includes(q) || 
        (l.admin || '').toLowerCase().includes(q) ||
        (l.id || '').toLowerCase().includes(q)
      );
    }
    return logs;
  }, [auditLogs, auditTypeFilter, auditSearch]);
  
  // Admin Password Change Modal State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currPassInput, setCurrPassInput] = useState('');
  const [newAdminPassInput, setNewAdminPassInput] = useState('');
  const [confirmAdminPassInput, setConfirmAdminPassInput] = useState('');

  const handleChangeAdminPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (currPassInput !== currentAdminPassword) {
      showCustomAlert('ত্রুটি!', 'বর্তমান পাসওয়ার্ড সঠিক নয়! আবার চেষ্টা করুন।', 'warning');
      return;
    }
    if (newAdminPassInput.length < 6) {
      showCustomAlert('ত্রুটি!', 'নতুন পাসওয়ার্ড নূন্যতম ৬ ডিজিটের হতে হবে!', 'warning');
      return;
    }
    if (newAdminPassInput !== confirmAdminPassInput) {
      showCustomAlert('ত্রুটি!', 'নতুন পাসওয়ার্ড এবং কনফার্ম পাসওয়ার্ড মিলছে না!', 'warning');
      return;
    }

    if (onUpdateAdminPassword) {
      onUpdateAdminPassword(newAdminPassInput);
    }
    if (onAddAuditLog) {
      onAddAuditLog('পাসওয়ার্ড পরিবর্তন (Security)', 'এডমিন প্যানেলের সিকিউরিটি পাসওয়ার্ড পরিবর্তন করা হয়েছে', 'other');
    }
    setIsPasswordModalOpen(false);
    setCurrPassInput('');
    setNewAdminPassInput('');
    setConfirmAdminPassInput('');
    showCustomAlert('সফল!', 'এডমিন পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে।', 'success');
  };

  // Stack Unwinding Engine for Admin Panel
  const handleAdminStackUnwind = (): boolean => {
    if (drawerOpen) {
      setDrawerOpen(false);
      return true;
    }
    if (isPasswordModalOpen) {
      setIsPasswordModalOpen(false);
      return true;
    }
    if (activeTab !== 'dashboard') {
      setActiveTab('dashboard');
      return true;
    }
    return false;
  };

  const adminStackUnwindRef = React.useRef(handleAdminStackUnwind);
  adminStackUnwindRef.current = handleAdminStackUnwind;

  useEffect(() => {
    window.history.pushState({ orjonAdmin: true }, '', window.location.href);

    const handlePopState = () => {
      window.history.pushState({ orjonAdmin: true }, '', window.location.href);
      const unwound = adminStackUnwindRef.current();
      if (!unwound) {
        onLogout();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [onLogout]);

  // Backup & Export System Handlers
  const handleExportBackup = () => {
    try {
      const backupMap: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          backupMap[key] = localStorage.getItem(key) || '';
        }
      }

      const backupData = {
        app: 'Orjon Exam Portal',
        version: '1.0',
        exportedAt: new Date().toISOString(),
        totalKeys: Object.keys(backupMap).length,
        data: backupMap
      };

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `orjon_backup_${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showCustomAlert('সফল!', 'সিস্টেমের সম্পূর্ণ ডাটাবেজ JSON ফাইল হিসেবে ডাউনলোড করা হয়েছে।', 'success');
    } catch (err) {
      showCustomAlert('ত্রুটি!', 'ডাটাবেজ ফাইল তৈরিতে ব্যর্থ হয়েছে।', 'warning');
    }
  };

  const handleImportBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        let dataToRestore: Record<string, string> | null = null;
        if (parsed && typeof parsed === 'object' && parsed.data && typeof parsed.data === 'object') {
          dataToRestore = parsed.data;
        } else if (parsed && typeof parsed === 'object') {
          dataToRestore = parsed;
        }

        if (!dataToRestore || Object.keys(dataToRestore).length === 0) {
          showCustomAlert('ত্রুটি!', 'ফাইলটিতে কোনো বৈধ ব্যাকআপ ডাটা পাওয়া যায়নি।', 'warning');
          return;
        }

        const count = Object.keys(dataToRestore).length;
        showCustomConfirm(
          'ব্যাকআপ রিস্টোর কনফার্মেশন',
          `আপনি কি নিশ্চিতভাবে ${count}টি আইটেমের ব্যাকআপ রিস্টোর করতে চান? আপনার বর্তমান লোকাল ডাটাবেজ এর ফলে আপডেট হবে।`,
          () => {
            Object.entries(dataToRestore!).forEach(([k, v]) => {
              if (typeof v === 'string') {
                localStorage.setItem(k, v);
              } else {
                localStorage.setItem(k, JSON.stringify(v));
              }
            });
            showCustomAlert('সফল!', 'ডাটাবেজ সফলভাবে রিস্টোর হয়েছে! তথ্য রিফ্রেশ করতে পেজ রিলোড হচ্ছে...', 'success');
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          }
        );
      } catch (err) {
        showCustomAlert('ত্রুটি!', 'JSON ফাইলটি পড়া সম্ভব হয়নি। সঠিক ব্যাকআপ ফাইল নির্বাচন করুন।', 'warning');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Firebase Firestore Migration State & Handlers
  const [firestoreCounts, setFirestoreCounts] = useState<CollectionCounts | null>(null);
  const [isCountingFirestore, setIsCountingFirestore] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationLogs, setMigrationLogs] = useState<string[]>([]);
  const [migrationStatusMsg, setMigrationStatusMsg] = useState('');
  const [migrationReport, setMigrationReport] = useState<MigrationReport | null>(null);
  const [uploadedBackupFileDetails, setUploadedBackupFileDetails] = useState<{
    fileName: string;
    fileSizeKB: number;
    parsedData: any;
    questionCount: number;
    totalRecordCount: number;
  } | null>(null);

  useEffect(() => {
    fetchFirestoreDocumentCounts().then(res => {
      if (res && res.counts) {
        setFirestoreCounts(res.counts);
      }
    }).catch(e => {
      console.warn('Auto fetch firestore counts notice:', e);
    });
  }, []);

  const handleSelectBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        // Calculate counts inside parsed JSON
        const extractArr = (p: string, f: string) => {
          let raw = parsed[p] || parsed[f];
          if (!raw && parsed.data && typeof parsed.data === 'object') {
            raw = parsed.data[p] || parsed.data[f];
          }
          if (typeof raw === 'string') {
            try { return JSON.parse(raw); } catch { return []; }
          }
          return Array.isArray(raw) ? raw : [];
        };

        const qArr = extractArr('orjon_questions', 'medha_questions');
        const keysCount = Object.keys(parsed).length;
        let totalRecords = qArr.length;
        if (typeof parsed === 'object') {
          Object.values(parsed).forEach((v: any) => {
            if (Array.isArray(v)) totalRecords += v.length;
            else if (typeof v === 'string') {
              try {
                const p = JSON.parse(v);
                if (Array.isArray(p)) totalRecords += p.length;
              } catch {}
            }
          });
        }

        setUploadedBackupFileDetails({
          fileName: file.name,
          fileSizeKB: Math.round(file.size / 1024),
          parsedData: parsed,
          questionCount: qArr.length,
          totalRecordCount: totalRecords
        });
        showCustomAlert('ফাইল নির্বাচন সফল!', `"${file.name}" ফাইলে ${qArr.length}টি প্রশ্ন চিহ্নিত করা হয়েছে।`, 'success');
      } catch (err) {
        showCustomAlert('ত্রুটি!', 'JSON ফাইল পার্স করতে সমস্যা হয়েছে। সঠিক ব্যাকআপ ফাইল সিলেক্ট করুন।', 'warning');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleRefreshFirestoreCounts = async () => {
    setIsCountingFirestore(true);
    try {
      const res = await fetchFirestoreDocumentCounts();
      setFirestoreCounts(res.counts);

      if (res.success) {
        showCustomAlert(
          'ফায়ারস্টোর কানেকশন সফল! (Firestore Verified)',
          `Google Firebase Cloud Firestore (Project ID: "${firebaseConfig.projectId}") সফলভাবে সক্রিয় ও সংযুক্ত রয়েছে।\n\nমোট ১০টি কালেকশনে বর্তমানে ${res.total.toLocaleString('bn-BD')} টি ডকুমেন্ট চিহ্নিত পাওয়া গেছে।`,
          'success'
        );
      } else {
        showCustomAlert(
          'ফায়ারস্টোর কানেকশন সতর্কতা!',
          `ফায়ারস্টোর কানেকশন সক্রিয় আছে, তবে কিছু কালেকশন রিড করার সময় সমস্যা পরিলক্ষিত হয়েছে:\n\n${res.errors.join('\n')}`,
          'warning'
        );
      }
    } catch (err: any) {
      showCustomAlert(
        'কানেকশন পরীক্ষা ব্যর্থ!',
        `ফায়ারস্টোর ডাটাবেজে সংযুক্ত হওয়া সম্ভব হয়নি: ${err?.message || String(err)}\n\nদয়া করে আপনার ইন্টারনেট কানেকশন বা ফায়ারবেস কনফিগারেশন চেক করুন।`,
        'warning'
      );
    } finally {
      setIsCountingFirestore(false);
    }
  };

  // Cloud Sync Status & Percentage Calculation for Admin-Managed Data
  const [isSyncingAllAdminData, setIsSyncingAllAdminData] = useState(false);
  const [syncingSingleKey, setSyncingSingleKey] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState<{
    currentStep: number;
    totalSteps: number;
    currentCollection: string;
    percent: number;
  } | null>(null);
  const [showSyncModal, setShowSyncModal] = useState(false);

  const adminSyncStats = useMemo(() => {
    const rawList = [
      { key: 'questions', name: 'প্রশ্ন ভান্ডার (MCQ Bank)', local: questions.length, cloud: firestoreCounts?.questions ?? 0, icon: '📁', color: 'indigo', idPrefix: 'q' },
      { key: 'courses', name: 'কোর্সসমূহ (Courses)', local: (courses || []).length, cloud: firestoreCounts?.courses ?? 0, icon: '🎓', color: 'purple', idPrefix: 'course' },
      { key: 'routines', name: 'রুটিনসমূহ (Routines)', local: (routines || []).length, cloud: firestoreCounts?.routines ?? 0, icon: '📅', color: 'blue', idPrefix: 'rt' },
      { key: 'live_exams', name: 'লাইভ পরীক্ষা (Live Exams)', local: (liveExams || []).length, cloud: firestoreCounts?.live_exams ?? 0, icon: '⏱️', color: 'amber', idPrefix: 'le' },
      { key: 'categories', name: 'মূল বিষয়/ক্যাটাগরি (Categories)', local: (categories || []).length, cloud: firestoreCounts?.categories ?? 0, icon: '🗂️', color: 'emerald', idPrefix: 'cat' },
      { key: 'subcategories', name: 'সাব-ক্যাটাগরি (Subcategories)', local: (subcategories || []).length, cloud: firestoreCounts?.subcategories ?? 0, icon: 'teal', idPrefix: 'subcat' },
      { key: 'notices', name: 'পপআপ নোটিশ (Notices)', local: (notices || []).length, cloud: firestoreCounts?.notices ?? 0, icon: '📢', color: 'rose', idPrefix: 'notice' },
      { key: 'audit_logs', name: 'অডিট লগ (Audit Logs)', local: (auditLogs || []).length, cloud: firestoreCounts?.audit_logs ?? 0, icon: '📜', color: 'violet', idPrefix: 'log' },
    ];

    let totalLocal = 0;
    let totalSynced = 0;

    const items = rawList.map(col => {
      totalLocal += col.local;
      const synced = col.local === 0 ? 0 : Math.min(col.local, col.cloud);
      totalSynced += synced;
      const pct = col.local === 0 
        ? 100 
        : Math.min(100, Math.round((col.cloud / col.local) * 100));

      return {
        ...col,
        synced,
        percent: pct,
        isFullySynced: col.local === 0 ? true : col.cloud >= col.local
      };
    });

    const overallPercent = totalLocal === 0 ? 100 : Math.min(100, Math.round((totalSynced / totalLocal) * 100));

    return {
      items,
      totalLocal,
      totalSynced,
      overallPercent,
      isAllSynced: overallPercent === 100,
      hasCheckedCloud: !!firestoreCounts
    };
  }, [questions.length, courses, routines, liveExams, categories, subcategories, notices, auditLogs, firestoreCounts]);

  const handleSyncAllAdminData = async () => {
    setIsSyncingAllAdminData(true);
    setSyncProgress({ currentStep: 0, totalSteps: 8, currentCollection: 'সিঙ্ক প্রস্তুতি চলছে...', percent: 0 });

    try {
      // 1. Questions
      setSyncProgress({ currentStep: 1, totalSteps: 8, currentCollection: 'প্রশ্ন ভান্ডার (questions)...', percent: 12 });
      if (questions.length > 0) {
        await syncCollectionToFirestore('questions', questions, 'q');
      }

      // 2. Courses
      setSyncProgress({ currentStep: 2, totalSteps: 8, currentCollection: 'কোর্সসমূহ (courses)...', percent: 25 });
      if ((courses || []).length > 0) {
        await syncCollectionToFirestore('courses', courses || [], 'course');
      }

      // 3. Routines
      setSyncProgress({ currentStep: 3, totalSteps: 8, currentCollection: 'রুটিনসমূহ (routines)...', percent: 37 });
      if ((routines || []).length > 0) {
        await syncCollectionToFirestore('routines', routines || [], 'rt');
      }

      // 4. Live Exams
      setSyncProgress({ currentStep: 4, totalSteps: 8, currentCollection: 'লাইভ পরীক্ষা (live_exams)...', percent: 50 });
      if ((liveExams || []).length > 0) {
        await syncCollectionToFirestore('live_exams', liveExams || [], 'le');
      }

      // 5. Categories
      setSyncProgress({ currentStep: 5, totalSteps: 8, currentCollection: 'ক্যাটাগরি (categories)...', percent: 62 });
      if ((categories || []).length > 0) {
        await syncCollectionToFirestore('categories', categories || [], 'cat');
      }

      // 6. Subcategories
      setSyncProgress({ currentStep: 6, totalSteps: 8, currentCollection: 'সাব-ক্যাটাগরি (subcategories)...', percent: 75 });
      if ((subcategories || []).length > 0) {
        await syncCollectionToFirestore('subcategories', subcategories || [], 'subcat');
      }

      // 7. Notices
      setSyncProgress({ currentStep: 7, totalSteps: 8, currentCollection: 'নোটিশসমূহ (notices)...', percent: 87 });
      if ((notices || []).length > 0) {
        await syncCollectionToFirestore('notices', notices || [], 'notice');
      }

      // 8. Audit Logs
      setSyncProgress({ currentStep: 8, totalSteps: 8, currentCollection: 'অডিট লগ (audit_logs)...', percent: 100 });
      if ((auditLogs || []).length > 0) {
        await syncCollectionToFirestore('audit_logs', auditLogs || [], 'log');
      }

      // Refresh Firestore counts
      const res = await fetchFirestoreDocumentCounts();
      if (res && res.counts) {
        setFirestoreCounts(res.counts);
      }

      showCustomAlert(
        'ক্লাউড সিঙ্ক সফল! (Cloud Sync 100%)',
        'অ্যাডমিনের তৈরি ও আপডেট করা সকল প্রশ্ন, কোর্স, রুটিন, লাইভ এক্সাম, বিষয়/ক্যাটাগরি ও নোটিশ সফলভাবে Firebase Firestore ক্লাউডে ১০০% সিঙ্ক সম্পন্ন হয়েছে।',
        'success'
      );
    } catch (err: any) {
      showCustomAlert(
        'সিঙ্ক ব্যর্থ হয়েছে!',
        `ক্লাউডে সিঙ্ক করার সময় ত্রুটি ঘটেছে: ${err?.message || String(err)}`,
        'warning'
      );
    } finally {
      setIsSyncingAllAdminData(false);
      setSyncProgress(null);
    }
  };

  const handleSyncSingleAdminCollection = async (key: string) => {
    setSyncingSingleKey(key);
    try {
      if (key === 'questions') {
        await syncCollectionToFirestore('questions', questions, 'q');
      } else if (key === 'courses') {
        await syncCollectionToFirestore('courses', courses || [], 'course');
      } else if (key === 'routines') {
        await syncCollectionToFirestore('routines', routines || [], 'rt');
      } else if (key === 'live_exams') {
        await syncCollectionToFirestore('live_exams', liveExams || [], 'le');
      } else if (key === 'categories') {
        await syncCollectionToFirestore('categories', categories || [], 'cat');
      } else if (key === 'subcategories') {
        await syncCollectionToFirestore('subcategories', subcategories || [], 'subcat');
      } else if (key === 'notices') {
        await syncCollectionToFirestore('notices', notices || [], 'notice');
      } else if (key === 'audit_logs') {
        await syncCollectionToFirestore('audit_logs', auditLogs || [], 'log');
      }

      const res = await fetchFirestoreDocumentCounts();
      if (res && res.counts) {
        setFirestoreCounts(res.counts);
      }

      showCustomAlert('সিঙ্ক সম্পন্ন!', `"${key}" কালেকশনের ডেটা সফলভাবে Firebase Firestore-এ সিঙ্ক হয়েছে।`, 'success');
    } catch (err: any) {
      showCustomAlert('সিঙ্ক ব্যর্থ!', `ত্রুটি: ${err?.message || String(err)}`, 'warning');
    } finally {
      setSyncingSingleKey(null);
    }
  };

  const handleStartLocalStorageMigration = async () => {
    showCustomConfirm(
      'Firebase Migration Confirmation',
      'আপনি কি লোকাল ডাটাবেজ (localStorage)-এর সকল ইউজার, প্রশ্ন, ক্যাটালগ ও নোটিশ Firebase Cloud Firestore-এ মাইগ্রেট করতে চান? (আপনার লোকাল ডাটাবেজ সুরক্ষিত থাকবে)',
      async () => {
        setIsMigrating(true);
        setMigrationLogs([]);
        setMigrationStatusMsg('লোকাল ডাটাবেজ প্রসেস করা হচ্ছে...');
        try {
          const lsMap = getAllLocalStorageMap();
          const report = await migrateDataToFirestore(lsMap, 'localStorage', (msg) => {
            setMigrationStatusMsg(msg);
            setMigrationLogs(prev => [...prev, `[${new Date().toLocaleTimeString('bn-BD')}] ${msg}`]);
          });
          setMigrationReport(report);
          await handleRefreshFirestoreCounts();
          showCustomAlert('মাইগ্রেশন সম্পন্ন!', `Firebase Firestore-এ মোট ${report.totalDocuments}টি নথি সফলভাবে যুক্ত/আপডেট করা হয়েছে।`, 'success');
        } catch (err: any) {
          showCustomAlert('ত্রুটি!', `মাইগ্রেশন ব্যর্থ হয়েছে: ${err?.message || String(err)}`, 'warning');
        } finally {
          setIsMigrating(false);
        }
      }
    );
  };

  const handleStartJSONBackupMigration = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        showCustomConfirm(
          'JSON Backup to Firebase Migration',
          `আপনি কি "${file.name}" ব্যাকআপ ফাইলের ডাটা Firebase Cloud Firestore-এ মাইগ্রেট করতে চান?`,
          async () => {
            setIsMigrating(true);
            setMigrationLogs([]);
            setMigrationStatusMsg('JSON ফাইল থেকে ফায়ারস্টোরে মাইগ্রেশন হচ্ছে...');
            try {
              const report = await migrateDataToFirestore(parsed, 'JSON File', (msg) => {
                setMigrationStatusMsg(msg);
                setMigrationLogs(prev => [...prev, `[${new Date().toLocaleTimeString('bn-BD')}] ${msg}`]);
              });
              setMigrationReport(report);
              await handleRefreshFirestoreCounts();
              showCustomAlert('মাইগ্রেশন সম্পন্ন!', `Firebase Firestore-এ ব্যাকআপ ফাইল থেকে মোট ${report.totalDocuments}টি নথি সফলভাবে আপলোড করা হয়েছে।`, 'success');
            } catch (err: any) {
              showCustomAlert('ত্রুটি!', `মাইগ্রেশন ব্যর্থ হয়েছে: ${err?.message || String(err)}`, 'warning');
            } finally {
              setIsMigrating(false);
            }
          }
        );
      } catch (err) {
        showCustomAlert('ত্রুটি!', 'JSON ফাইল পড়া ব্যর্থ হয়েছে। সঠিক ব্যাকআপ ফাইল নির্বাচন করুন।', 'warning');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };
  
  // Single Question Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');
  const [optionC, setOptionC] = useState('');
  const [optionD, setOptionD] = useState('');
  const [correct, setCorrect] = useState<'Option A' | 'Option B' | 'Option C' | 'Option D'>('Option A');
  const [explanation, setExplanation] = useState('');
  const [category, setCategory] = useState('সাধারণ জ্ঞান');
  const [subcategory, setSubcategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customSubcategory, setCustomSubcategory] = useState('');
  const [isCustomSubcategory, setIsCustomSubcategory] = useState(false);

  // Multi-select state for MCQ category linking
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['সাধারণ জ্ঞান']);
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);

  // Routine Hierarchical MCQ viewer modal state
  const [viewingHierarchyRoutine, setViewingHierarchyRoutine] = useState<Routine | null>(null);

  // Category Hierarchy editor state
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingNodeNewName, setEditingNodeNewName] = useState('');
  const [editingNodeNewParent, setEditingNodeNewParent] = useState('');
  const [editingNodeSubHeading, setEditingNodeSubHeading] = useState('');
  const [editingNodeDate, setEditingNodeDate] = useState('');
  const [editingNodeType, setEditingNodeType] = useState<'category' | 'subcategory' | null>(null);
  const [addingChildUnderNodeId, setAddingChildUnderNodeId] = useState<string | null>(null);
  const [newChildNodeName, setNewChildNodeName] = useState('');
  const [newChildNodeSubHeading, setNewChildNodeSubHeading] = useState('');
  const [newChildNodeDate, setNewChildNodeDate] = useState('');

  // Expanded state for hierarchy tree nodes (Default = empty set, so all nodes are collapsed on initial load)
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());

  // Custom selected parent categories for unmapped/hidden nodes
  const [unmappedNodeParents, setUnmappedNodeParents] = useState<Record<string, string>>({});

  const toggleNodeExpansion = (nodeId: string) => {
    setExpandedNodeIds(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const collapseAllNodes = () => {
    setExpandedNodeIds(new Set());
  };

  const expandAllNodes = () => {
    const allIds = new Set<string>();
    subcategories.forEach(s => allIds.add(s.id));
    categories.forEach(c => allIds.add(c.id));
    setExpandedNodeIds(allIds);
  };

  const expandNodeAndParents = (subName: string) => {
    const path = findSubcategoryPath(subName);
    setExpandedNodeIds(prev => {
      const next = new Set(prev);
      subcategories.forEach(s => {
        if (path.includes(s.name) || s.name === subName) {
          next.add(s.id);
        }
      });
      return next;
    });
  };

  // User explanation admin editing state
  const [editingExpl, setEditingExpl] = useState<{ qId: string, explId: string, text: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    name: string;
    type: 'category' | 'subcategory';
  } | null>(null);

  // User list search/filter/sort states
  const [userSearch, setUserSearch] = useState('');
  const [userGenderFilter, setUserGenderFilter] = useState('ALL');
  const [userSortBy, setUserSortBy] = useState<'createdAt' | 'lifetimeAnswered' | 'last7DaysMcq' | 'approvedPoints' | 'pendingPoints' | 'officialExamsAttained'>('createdAt');

  const toggleSelectedCategory = (catName: string) => {
    if (selectedCategories.includes(catName)) {
      setSelectedCategories(selectedCategories.filter(c => c !== catName));
    } else {
      setSelectedCategories([...selectedCategories, catName]);
    }
  };

  const toggleSelectedSubcategory = (subcatName: string) => {
    if (selectedSubcategories.includes(subcatName)) {
      setSelectedSubcategories(selectedSubcategories.filter(s => s !== subcatName));
    } else {
      setSelectedSubcategories([...selectedSubcategories, subcatName]);
    }
  };

  // Manage Questions Tab State - Cascading Filters
  const [catFilter, setCatFilter] = useState('ALL');
  const [subcatFilterChain, setSubcatFilterChain] = useState<string[]>([]);
  const [leafTopicFilter, setLeafTopicFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedQIds, setSelectedQIds] = useState<string[]>([]);

  // Pagination states for Manage Questions and Categories
  const [managePage, setManagePage] = useState(1);
  const [managePageSize, setManagePageSize] = useState(50);
  const [leafPage, setLeafPage] = useState(1);
  const [leafPageSize, setLeafPageSize] = useState(50);
  const [allSubcatPage, setAllSubcatPage] = useState(1);
  const [allSubcatPageSize, setAllSubcatPageSize] = useState(50);

  // Bulk Move Destination - Cascading Filters
  const [moveDestCat, setMoveDestCat] = useState('বিষয়ভিত্তিক প্রস্তুতি');
  const [moveDestSubcatChain, setMoveDestSubcatChain] = useState<string[]>([]);
  const [isAddingNewSubcatInline, setIsAddingNewSubcatInline] = useState(false);
  const [inlineNewSubcatName, setInlineNewSubcatName] = useState('');

  // Single Question Move Modal State
  const [singleMoveQ, setSingleMoveQ] = useState<Question | null>(null);
  const [singleMoveCat, setSingleMoveCat] = useState<string>('বিষয়ভিত্তিক প্রস্তুতি');
  const [singleMoveSubcatChain, setSingleMoveSubcatChain] = useState<string[]>([]);

  // Subcategories Multiple Selection & Bulk Move/Delete State
  const [selectedSubcatIds, setSelectedSubcatIds] = useState<string[]>([]);
  const [bulkSubcatMoveParent, setBulkSubcatMoveParent] = useState<string>('বিষয়ভিত্তিক প্রস্তুতি');

  // Category View Mode and Filter
  const [categoryViewTab, setCategoryViewTab] = useState<'tree' | 'leaf_nodes' | 'all_table' | 'hidden_nodes'>('tree');
  const [rootCategoryFilter, setRootCategoryFilter] = useState<'ALL' | 'subject' | 'job' | 'year'>('job');
  const [categorySearchQuery, setCategorySearchQuery] = useState('');

  // Add MCQ Form - Cascading Subcategory Chain
  const [addFormSubcatChain, setAddFormSubcatChain] = useState<string[]>([]);
  const [viewNodeQuestionsModal, setViewNodeQuestionsModal] = useState<{ nodeName: string; questions: Question[] } | null>(null);

  // Bulk Upload Destination - Cascading Filters
  const [uploadDestCat, setUploadDestCat] = useState('সাধারণ জ্ঞান');
  const [uploadDestSubcatChain, setUploadDestSubcatChain] = useState<string[]>([]);
  const [overrideCSVCategory, setOverrideCSVCategory] = useState(true);
  const [enableSubjectAutoMap, setEnableSubjectAutoMap] = useState(true);
  const [textQualifier, setTextQualifier] = useState<string>('"');
  const [rawCSVContent, setRawCSVContent] = useState<string>('');

  // Dedicated CSV File upload pending states & modal
  const [pendingCSVFile, setPendingCSVFile] = useState<File | null>(null);
  const [pendingQuestions, setPendingQuestions] = useState<Omit<Question, 'id'>[]>([]);
  const [showUploadConfirm, setShowUploadConfirm] = useState(false);
  const [showMappingReviewModal, setShowMappingReviewModal] = useState(false);
  const [mismatchMappings, setMismatchMappings] = useState<CSVMismatchMapping[]>([]);

  // Custom dialog/confirmation modal state for iframe compatibility
  const [customModal, setCustomModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'warning' | 'error' | 'info';
    showConfirmButton: boolean;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
    showConfirmButton: false,
  });

  const showCustomAlert = (title: string, message: string, type: 'success' | 'warning' | 'error' | 'info' = 'info') => {
    setCustomModal({
      isOpen: true,
      title,
      message,
      type,
      showConfirmButton: false,
      confirmText: 'ঠিক আছে',
      onConfirm: () => setCustomModal(prev => ({ ...prev, isOpen: false })),
    });
  };

  const showCustomConfirm = (
    title: string, 
    message: string, 
    onConfirm: () => void, 
    type: 'warning' | 'info' = 'warning',
    confirmText = 'হ্যাঁ, নিশ্চিত করুন',
    cancelText = 'বাতিল করুন'
  ) => {
    setCustomModal({
      isOpen: true,
      title,
      message,
      type,
      showConfirmButton: true,
      confirmText,
      cancelText,
      onConfirm: () => {
        setCustomModal(prev => ({ ...prev, isOpen: false }));
        onConfirm();
      },
      onCancel: () => {
        setCustomModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Upload History log state
  const [uploadHistory, setUploadHistory] = useState<{
    id: string;
    filename: string;
    timestamp: string;
    count: number;
    destination: string;
  }[]>(() => {
    const saved = localStorage.getItem('orjon_upload_history') || localStorage.getItem('medha_upload_history');
    return saved ? JSON.parse(saved) : [];
  });

  // Exam and Notice settings states
  const [noticeText, setNoticeText] = useState(notices[0]?.text || '');
  const [examTitle, setExamTitle] = useState('');
  const [examQLimit, setExamQLimit] = useState(10);
  const [examTimeLimit, setExamTimeLimit] = useState(10);
  const [examCategory, setExamCategory] = useState('ALL');
  const [examStartTime, setExamStartTime] = useState('');
  const [examExpiryTime, setExamExpiryTime] = useState('');

  // Manual Exam Question Selection states
  const [isManualSelection, setIsManualSelection] = useState(false);
  const [categoryLimits, setCategoryLimits] = useState<Record<string, number>>({
    bangla: 0,
    bengaliLit: 0,
    english: 0,
    englishLit: 0,
    math: 0,
    science: 0,
    bdAffairs: 0,
    intlAffairs: 0
  });
  const [selectedQuestionsByCategory, setSelectedQuestionsByCategory] = useState<Record<string, string[]>>({
    bangla: [],
    bengaliLit: [],
    english: [],
    englishLit: [],
    math: [],
    science: [],
    bdAffairs: [],
    intlAffairs: []
  });
  
  const [manualFilterMainCat, setManualFilterMainCat] = useState('ALL'); // ALL, বিষয়ভিত্তিক প্রস্তুতি, জব সলিউশন পরীক্ষা
  const [manualSubcatFilterChain, setManualSubcatFilterChain] = useState<string[]>([]);
  const [manualSearchQuery, setManualSearchQuery] = useState('');
  const [activeSelectionTab, setActiveSelectionTab] = useState<string>('bangla');
  const [manualFilterSelectionStatus, setManualFilterSelectionStatus] = useState<'ALL' | 'SELECTED' | 'UNSELECTED'>('ALL');
  const [manualFilterRecommendationOnly, setManualFilterRecommendationOnly] = useState<boolean>(false);

  // Routine settings states & Cascading Topic Filters
  const [routineTitle, setRoutineTitle] = useState('');
  const [routineDetails, setRoutineDetails] = useState('');
  const [routineSelectedRootCategory, setRoutineSelectedRootCategory] = useState<string>('বিষয়ভিত্তিক প্রস্তুতি');
  const [routineSelectedCategories, setRoutineSelectedCategories] = useState<string[]>([]);
  const [routineSelectedSubcategories, setRoutineSelectedSubcategories] = useState<string[]>([]);
  const [routineSelectedLeafCategories, setRoutineSelectedLeafCategories] = useState<string[]>([]);

  // Preset Exam Configuration States
  const [routineEnableExam, setRoutineEnableExam] = useState(false);
  const [routineExamStartTime, setRoutineExamStartTime] = useState('');
  const [routineExamExpiryTime, setRoutineExamExpiryTime] = useState('');
  const [routineExamTimeLimit, setRoutineExamTimeLimit] = useState(20);
  const [routineExamQLimit, setRoutineExamQLimit] = useState(20);
  const [routineExamTotalMarks, setRoutineExamTotalMarks] = useState(20);
  const [routineExamPassMarks, setRoutineExamPassMarks] = useState(8);
  const [routineExamQuestionSelection, setRoutineExamQuestionSelection] = useState<'auto' | 'manual'>('auto');
  const [routineExamManualQuestionIds, setRoutineExamManualQuestionIds] = useState<string[]>([]);
  const [routineManualQuestionSearch, setRoutineManualQuestionSearch] = useState('');

  // Selected exam for results viewing
  const [selectedExamIdForResults, setSelectedExamIdForResults] = useState('');

  // CSV paste or CSV file upload state
  const [csvText, setCsvText] = useState('');
  const [csvFileError, setCsvFileError] = useState('');
  const [csvValidationErrors, setCsvValidationErrors] = useState<string[]>([]);
  const [enableCsvValidation, setEnableCsvValidation] = useState(true);
  const [enableStrictMappingCheck, setEnableStrictMappingCheck] = useState(true);

  // Normalized string helper for accurate whitespace/unicode/case insensitive matching
  const normalizeName = (str: string = '') => 
    str.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

  // Distinct lists from existing database or dynamic categories
  const distinctCategories = useMemo(() => Array.from(new Set((categories || []).length > 0 ? (categories || []).map(c => c?.name || '') : (questions || []).map(q => q?.category || ''))).filter(Boolean), [categories, questions]);
  const distinctSubcategories = useMemo(() => Array.from(new Set((subcategories || []).length > 0 ? (subcategories || []).map(s => s?.name || '') : (questions || []).map(q => q?.subcategory || '').filter(Boolean))).filter(Boolean), [subcategories, questions]);

  // All dynamic system categories (root zones, standard subjects, dynamic categories, subcategories, and existing questions)
  const allSystemCategories = useMemo(() => {
    const rootCategoryNames = ['বিষয়ভিত্তিক প্রস্তুতি', 'জব সলিউশন পরীক্ষা', 'সাল ভিত্তিক জব সলিউশন', 'সাধারণ জ্ঞান'];
    const catSet = new Set<string>([
      ...rootCategoryNames,
      ...STANDARD_SUBJECT_CATEGORIES,
      ...(categories || []).map(c => (c?.name || '').trim()),
      ...(subcategories || []).map(s => (s?.name || '').trim()),
      ...(questions || []).map(q => q?.category ? q.category.trim() : '').filter(Boolean)
    ]);
    return Array.from(catSet).filter(Boolean);
  }, [categories, subcategories, questions]);

  // Helper to find existing subcategory item in database dynamically
  const findSubcategoryInDatabase = (subName: string) => {
    if (!subName) return null;
    const norm = normalizeName(subName);
    const found = subcategories.find(s => normalizeName(s.name) === norm);
    if (found) return found;
    // Check in questions subcategories
    const qFound = questions.find(q => q.subcategory && normalizeName(q.subcategory) === norm);
    if (qFound && qFound.subcategory) {
      return { id: `q-sub-${qFound.subcategory}`, name: qFound.subcategory, parentCategory: qFound.category || 'সাধারণ জ্ঞান' };
    }
    return null;
  };

  // Helper to find existing category name in database dynamically
  const findCategoryInDatabase = (catName: string) => {
    if (!catName) return null;
    const norm = normalizeName(catName);
    const cFound = categories.find(c => normalizeName(c.name) === norm);
    if (cFound) return cFound.name;
    const sFound = subcategories.find(s => normalizeName(s.name) === norm);
    if (sFound) return sFound.name;
    const stdFound = STANDARD_SUBJECT_CATEGORIES.find(s => normalizeName(s) === norm);
    if (stdFound) return stdFound;
    const rootFound = ['বিষয়ভিত্তিক প্রস্তুতি', 'জব সলিউশন পরীক্ষা', 'সাল ভিত্তিক জব সলিউশন', 'সাধারণ জ্ঞান'].find(r => normalizeName(r) === norm);
    if (rootFound) return rootFound;
    return null;
  };

  // Compute non-matching category/subcategory path details for pending questions
  const nonMatchingPathDetails = useMemo(() => {
    if (pendingQuestions.length === 0) return [];
    
    const items: {
      rowNum: number;
      questionText: string;
      category: string;
      subcategory: string;
      issueType: 'category_missing' | 'subcategory_missing' | 'mismatched_parent';
      issueDescription: string;
    }[] = [];

    const normCatNames = new Set((allSystemCategories || []).map(c => normalizeName(c)));
    const normSubcatNames = new Set([
      ...(subcategories || []).map(s => normalizeName(s?.name || '')),
      ...(categories || []).map(c => normalizeName(c?.name || '')),
      ...(questions || []).map(q => normalizeName(q?.subcategory || '')).filter(Boolean)
    ]);

    pendingQuestions.forEach((q, idx) => {
      const rowNum = idx + 2; // Line 1 is header
      const rawCat = q.category ? q.category.trim() : '';
      const rawSub = q.subcategory ? q.subcategory.trim() : '';

      const normCat = normalizeName(rawCat);
      const normSub = normalizeName(rawSub);

      const catExists = !normCat || normCatNames.has(normCat);
      const subExists = !normSub || normSubcatNames.has(normSub);

      if (!catExists) {
        items.push({
          rowNum,
          questionText: q.text,
          category: rawCat || '(ফাঁকা)',
          subcategory: rawSub || '(ফাঁকা)',
          issueType: 'category_missing',
          issueDescription: `ক্যাটাগরি "${rawCat}" ডাটাবেসে নিবন্ধিত নেই`
        });
      } else if (!subExists) {
        items.push({
          rowNum,
          questionText: q.text,
          category: rawCat || 'সাধারণ জ্ঞান',
          subcategory: rawSub,
          issueType: 'subcategory_missing',
          issueDescription: `সাব-ক্যাটাগরি "${rawSub}" ডাটাবেসে নিবন্ধিত নেই`
        });
      }
    });

    return items;
  }, [pendingQuestions, allSystemCategories, subcategories, questions]);

  // Helper to find parent subcategory chain recursively
  const findSubcategoryPath = (subName: string): string[] => {
    if (!subName) return [];
    const path: string[] = [subName];
    let current = subcategories.find(s => s.name.trim().toLowerCase() === subName.trim().toLowerCase());
    
    // Safety limit to avoid infinite loops
    let limit = 10;
    while (current && current.parentCategory && limit > 0) {
      const parentName = current.parentCategory;
      // Is the parent a subcategory?
      const parentSub = subcategories.find(s => s.name.trim().toLowerCase() === parentName.trim().toLowerCase());
      if (parentSub) {
        path.unshift(parentSub.name);
        current = parentSub;
      } else {
        break;
      }
      limit--;
    }
    return path;
  };

  // Helper to find all descendants of a subcategory recursively (for deep cascading filter matching)
  const getSubcategoryDescendants = (subName: string): string[] => {
    const descendants: string[] = [];
    const queue = [subName.trim().toLowerCase()];
    const visited = new Set<string>(queue);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const children = subcategories.filter(s => s.parentCategory && s.parentCategory.trim().toLowerCase() === current);
      children.forEach(child => {
        const childLower = child.name.trim().toLowerCase();
        if (!visited.has(childLower)) {
          visited.add(childLower);
          descendants.push(child.name.trim());
          queue.push(childLower);
        }
      });
    }
    return descendants;
  };

  // Memoized subcategory descendants map for ultra-fast filtering
  const subcategoryDescendantsMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    subcategories.forEach(sub => {
      const descendants = getSubcategoryDescendants(sub.name).map(d => d.toLowerCase());
      map.set(sub.name.trim().toLowerCase(), new Set(descendants));
    });
    return map;
  }, [subcategories]);

  // Memoized question count map for all direct nodes in O(N) time
  const nodeQuestionCountMap = useMemo(() => {
    const map = new Map<string, number>();
    questions.forEach(q => {
      const targets = new Set<string>();
      if (q.category) targets.add(q.category.trim().toLowerCase());
      if (q.subcategory) targets.add(q.subcategory.trim().toLowerCase());
      if (q.csvCategory) targets.add(q.csvCategory.trim().toLowerCase());
      if (q.categories) q.categories.forEach(c => c && targets.add(c.trim().toLowerCase()));
      if (q.subcategories) q.subcategories.forEach(s => s && targets.add(s.trim().toLowerCase()));

      targets.forEach(t => {
        map.set(t, (map.get(t) || 0) + 1);
      });
    });
    return map;
  }, [questions]);

  // Root Category & Question Multi-Category Link Resolution for Manage and Routine Tabs
  const { questionRootCategoriesMap = new Map<string, Set<string>>(), rootCategoryMCQCounts = {}, allRootCategories = [] } = useMemo(() => {
    const baseRoots = ['বিষয়ভিত্তিক প্রস্তুতি', 'জব সলিউশন পরীক্ষা', 'সাল ভিত্তিক জব সলিউশন'];
    const customRoots = (categories || []).map(c => (c?.name || '').trim()).filter(Boolean);
    const rootSet = new Set<string>([...baseRoots, ...customRoots, ...(distinctCategories || [])]);
    const rootList = Array.from(rootSet).filter(Boolean);

    const qToRoots = new Map<string, Set<string>>();
    const rootCounts: Record<string, number> = {};

    rootList.forEach(r => {
      rootCounts[r] = 0;
    });

    questions.forEach(q => {
      const qRoots = new Set<string>();

      const resolveRootForName = (nameStr: string) => {
        if (!nameStr) return;
        const clean = nameStr.trim();
        if (!clean) return;

        if (isJobSolutionVariation(clean)) {
          qRoots.add('জব সলিউশন পরীক্ষা');
          return;
        }
        if (isYearJobSolutionVariation(clean)) {
          qRoots.add('সাল ভিত্তিক জব সলিউশন');
          return;
        }

        const matchedRoot = rootList.find(r => r.toLowerCase() === clean.toLowerCase());
        if (matchedRoot) {
          qRoots.add(matchedRoot);
          return;
        }

        let sub = subcategories.find(s => s?.name && s.name.trim().toLowerCase() === clean.toLowerCase());
        let depth = 10;
        while (sub && sub.parentCategory && depth > 0) {
          const parent = sub.parentCategory.trim();
          if (isJobSolutionVariation(parent)) {
            qRoots.add('জব সলিউশন পরীক্ষা');
            return;
          }
          if (isYearJobSolutionVariation(parent)) {
            qRoots.add('সাল ভিত্তিক জব সলিউশন');
            return;
          }

          const matchedParentRoot = rootList.find(r => r.toLowerCase() === parent.toLowerCase());
          if (matchedParentRoot) {
            qRoots.add(matchedParentRoot);
            return;
          }

          const parentSub = subcategories.find(s => s?.name && s.name.trim().toLowerCase() === parent.toLowerCase());
          if (parentSub) {
            sub = parentSub;
          } else {
            qRoots.add(parent);
            return;
          }
          depth--;
        }

        const catObj = categories.find(c => c?.name && c.name.trim().toLowerCase() === clean.toLowerCase());
        if (catObj) {
          qRoots.add(catObj.name);
        }
      };

      if (q.category) resolveRootForName(q.category);
      if (q.csvCategory) resolveRootForName(q.csvCategory);
      if (q.categories && Array.isArray(q.categories)) {
        q.categories.forEach(c => c && resolveRootForName(c));
      }
      if (q.subcategory) resolveRootForName(q.subcategory);
      if (q.subcategories && Array.isArray(q.subcategories)) {
        q.subcategories.forEach(s => s && resolveRootForName(s));
      }

      if (qRoots.size === 0 && q.category) {
        qRoots.add(q.category);
      }

      qToRoots.set(q.id, qRoots);

      qRoots.forEach(rName => {
        rootCounts[rName] = (rootCounts[rName] || 0) + 1;
      });
    });

    return {
      questionRootCategoriesMap: qToRoots,
      rootCategoryMCQCounts: rootCounts,
      allRootCategories: rootList
    };
  }, [questions, subcategories, categories, distinctCategories]);

  // Memoized subcategory total (recursive) question counts
  const subcategoryDescendantsCountMap = useMemo(() => {
    const totalMap = new Map<string, number>();
    subcategories.forEach(sub => {
      const subLower = sub.name.trim().toLowerCase();
      const descendants = subcategoryDescendantsMap.get(subLower);
      let count = nodeQuestionCountMap.get(subLower) || 0;
      if (descendants) {
        descendants.forEach(d => {
          count += nodeQuestionCountMap.get(d) || 0;
        });
      }
      totalMap.set(subLower, count);
    });
    return totalMap;
  }, [subcategories, subcategoryDescendantsMap, nodeQuestionCountMap]);

  // 1. Root categories for routine builder
  const routineRootCategories = useMemo(() => [
    'বিষয়ভিত্তিক প্রস্তুতি',
    'জব সলিউশন পরীক্ষা',
    'সাল ভিত্তিক জব সলিউশন'
  ], []);

  // 2. Computed Categories dynamically based on selected Root Category (Step 1 -> Step 2)
  const routineAvailableCategories = useMemo(() => {
    if (!routineSelectedRootCategory) {
      return [];
    }

    const normRoot = normalizeName(routineSelectedRootCategory);
    const catMap = new Map<string, number>();

    if (normRoot === normalizeName('বিষয়ভিত্তিক প্রস্তুতি') || normRoot === normalizeName('বিষয় ভিক্তিক প্রস্তুতি')) {
      // Collect standard subject categories and any subcategories whose parentCategory is 'বিষয়ভিত্তিক প্রস্তুতি' or default subjects
      const knownSubjects = new Set<string>(STANDARD_SUBJECT_CATEGORIES);
      subcategories.forEach(s => {
        if (s.parentCategory === 'বিষয়ভিত্তিক প্রস্তুতি' || s.parentCategory === 'বিষয় ভিক্তিক প্রস্তুতি' || (!s.parentCategory && !isJobSolutionVariation(s.name) && !isYearJobSolutionVariation(s.name))) {
          knownSubjects.add(s.name.trim());
        }
      });
      categories.forEach(c => {
        if (!isJobSolutionVariation(c.name) && !isYearJobSolutionVariation(c.name) && c.name !== 'বিষয়ভিত্তিক প্রস্তুতি' && c.name !== 'বিষয় ভিক্তিক প্রস্তুতি') {
          knownSubjects.add(c.name.trim());
        }
      });

      knownSubjects.forEach(subjectName => {
        if (!subjectName || isJobSolutionVariation(subjectName) || isYearJobSolutionVariation(subjectName)) return;
        const subLower = subjectName.toLowerCase();
        const count = subcategoryDescendantsCountMap.get(subLower) || nodeQuestionCountMap.get(subLower) || 0;
        catMap.set(subjectName, count);
      });
    } else if (normRoot === normalizeName('জব সলিউশন পরীক্ষা') || isJobSolutionVariation(routineSelectedRootCategory)) {
      // Collect job solution categories (BCS, Primary, NTRCA, Bank, etc.)
      const jobCats = new Set<string>();
      subcategories.forEach(s => {
        if (isJobSolutionVariation(s.parentCategory || '') || s.parentCategory === 'জব সলিউশন পরীক্ষা' || s.parentCategory === 'জব সলিউশন') {
          jobCats.add(s.name.trim());
        }
      });

      if (jobCats.size === 0) {
        // Fallback common job solution categories
        ['বিসিএস প্রিলিমিনারি', 'প্রাথমিক সহকারী শিক্ষক নিয়োগ', 'এনটিআরসিএ (NTRCA)', 'ব্যাংক নিয়োগ পরীক্ষা', 'পিএসসি ও অন্যান্য নন-ক্যাডার', 'মন্ত্রণালয় ও অধিদপ্তর', 'রেলওয়ে নিয়োগ পরীক্ষা', 'অন্যান্য সরকারি ও স্বায়ত্তশাসিত প্রতিষ্ঠান'].forEach(j => jobCats.add(j));
      }

      jobCats.forEach(catName => {
        const catLower = catName.toLowerCase();
        const count = subcategoryDescendantsCountMap.get(catLower) || nodeQuestionCountMap.get(catLower) || 0;
        catMap.set(catName, count);
      });
    } else if (normRoot === normalizeName('সাল ভিত্তিক জব সলিউশন') || isYearJobSolutionVariation(routineSelectedRootCategory)) {
      // Collect year categories
      const yearCats = new Set<string>();
      subcategories.forEach(s => {
        if (isYearJobSolutionVariation(s.parentCategory || '') || s.parentCategory === 'সাল ভিত্তিক জব সলিউশন' || isYearJobSolutionVariation(s.name)) {
          yearCats.add(s.name.trim());
        }
      });

      if (yearCats.size === 0) {
        ['২০২৪', '২০২৩', '২০২২', '২০২১', '২০২০', '২০১৯', '২০১৮', '২০১৭', '২০১৬', '২০১৫'].forEach(y => yearCats.add(y));
      }

      yearCats.forEach(catName => {
        const catLower = catName.toLowerCase();
        const count = subcategoryDescendantsCountMap.get(catLower) || nodeQuestionCountMap.get(catLower) || 0;
        catMap.set(catName, count);
      });
    } else {
      // Custom root category
      subcategories.forEach(s => {
        if (s.parentCategory && normalizeName(s.parentCategory) === normRoot) {
          const count = subcategoryDescendantsCountMap.get(s.name.toLowerCase()) || nodeQuestionCountMap.get(s.name.toLowerCase()) || 0;
          catMap.set(s.name.trim(), count);
        }
      });
    }

    return Array.from(catMap.entries()).map(([name, count]) => ({ name, count }));
  }, [routineSelectedRootCategory, subcategories, categories, subcategoryDescendantsCountMap, nodeQuestionCountMap]);

  // 3. Computed Sub-categories dynamically based on selected Categories (Step 2 -> Step 3)
  const routineAvailableSubcategories = useMemo(() => {
    if (routineSelectedCategories.length === 0) {
      return [];
    }

    const selectedCatNorms = routineSelectedCategories.map(c => normalizeName(c));
    const subMap = new Map<string, { id: string; name: string; parentCategory: string; count: number }>();

    subcategories.forEach(s => {
      const parentNorm = normalizeName(s.parentCategory || '');
      const sNorm = normalizeName(s.name);

      // Direct child of one of the selected categories
      const isDirectChild = selectedCatNorms.includes(parentNorm);
      
      // Or descendant of one of the selected categories
      let isDescendant = false;
      let currentSub: SubcategoryItem | undefined = s;
      let depth = 10;
      while (currentSub && currentSub.parentCategory && depth > 0) {
        const pNorm = normalizeName(currentSub.parentCategory);
        if (selectedCatNorms.includes(pNorm)) {
          isDescendant = true;
          break;
        }
        currentSub = subcategories.find(item => normalizeName(item.name) === pNorm);
        depth--;
      }

      // Do not list the category itself if it appears in subcategories
      if ((isDirectChild || isDescendant) && !selectedCatNorms.includes(sNorm)) {
        const count = subcategoryDescendantsCountMap.get(sNorm) || nodeQuestionCountMap.get(sNorm) || 0;
        subMap.set(s.name.trim(), {
          id: s.id || s.name,
          name: s.name.trim(),
          parentCategory: s.parentCategory || '',
          count
        });
      }
    });

    // Also check questions with matching category for distinct subcategories
    questions.forEach(q => {
      const qCatNorm = normalizeName(q.category || '');
      const qCatsNorm = (q.categories || []).map(normalizeName);
      const matchesCat = selectedCatNorms.includes(qCatNorm) || qCatsNorm.some(c => selectedCatNorms.includes(c));

      if (matchesCat && q.subcategory) {
        const subName = q.subcategory.trim();
        const subNorm = normalizeName(subName);
        if (!selectedCatNorms.includes(subNorm) && !subMap.has(subName)) {
          const count = nodeQuestionCountMap.get(subNorm) || 1;
          subMap.set(subName, {
            id: `q-sub-${subName}`,
            name: subName,
            parentCategory: q.category || '',
            count
          });
        }
      }
    });

    return Array.from(subMap.values());
  }, [routineSelectedCategories, subcategories, questions, subcategoryDescendantsCountMap, nodeQuestionCountMap]);

  // 4. Computed Leaf Categories dynamically based on selected Subcategories (Step 3 -> Step 4)
  const routineAvailableLeafCategories = useMemo(() => {
    if (routineSelectedSubcategories.length === 0) {
      return [];
    }

    const leafMap = new Map<string, number>();
    const activeSubNames = routineSelectedSubcategories.map(s => s.trim().toLowerCase());
    const activeSubSet = new Set(activeSubNames);

    activeSubNames.forEach(subName => {
      const descendants = subcategoryDescendantsMap.get(subName);
      if (descendants) {
        descendants.forEach(d => activeSubSet.add(d));
      }
    });

    // 1. Leaf child subcategories (subcategories under selected that have no further subcategories)
    subcategories.forEach(s => {
      const sLower = s.name.trim().toLowerCase();
      const parentLower = (s.parentCategory || '').trim().toLowerCase();
      if (activeSubSet.has(parentLower)) {
        const isLeaf = !subcategories.some(child => (child.parentCategory || '').trim().toLowerCase() === sLower);
        if (isLeaf && !activeSubSet.has(sLower)) {
          const count = subcategoryDescendantsCountMap.get(sLower) || nodeQuestionCountMap.get(sLower) || 0;
          leafMap.set(s.name.trim(), count);
        }
      }
    });

    // 2. csvCategory values from questions matching active subcategories
    questions.forEach(q => {
      const qSub = (q.subcategory || '').trim().toLowerCase();
      const qCsv = (q.csvCategory || '').trim();
      const qSubArray = (q.subcategories || []).map(s => s.trim().toLowerCase());

      const matchesSub = activeSubSet.has(qSub) || qSubArray.some(s => activeSubSet.has(s));
      if (matchesSub && qCsv && !activeSubSet.has(qCsv.toLowerCase())) {
        leafMap.set(qCsv, (leafMap.get(qCsv) || 0) + 1);
      }
    });

    return Array.from(leafMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [routineSelectedSubcategories, subcategories, questions, subcategoryDescendantsMap, subcategoryDescendantsCountMap, nodeQuestionCountMap]);

  // Questions matching selected cascading syllabus topics for Routine Management
  const routineMatchingQuestions = useMemo(() => {
    const hasRoot = Boolean(routineSelectedRootCategory);
    const catSelected = routineSelectedCategories.length > 0;
    const subSelected = routineSelectedSubcategories.length > 0;
    const leafSelected = routineSelectedLeafCategories.length > 0;

    if (!hasRoot && !catSelected && !subSelected && !leafSelected) {
      return questions;
    }

    const dummyRoutine: Routine = {
      id: 'routine-draft',
      title: routineTitle,
      details: routineDetails,
      selectedCategories: [routineSelectedRootCategory, ...routineSelectedCategories].filter(Boolean),
      selectedSubcategories: routineSelectedSubcategories,
      selectedLeafCategories: routineSelectedLeafCategories,
      createdAt: new Date().toISOString()
    };

    return getRoutineMatchingQuestions(dummyRoutine, questions, subcategories);
  }, [questions, routineTitle, routineDetails, routineSelectedRootCategory, routineSelectedCategories, routineSelectedSubcategories, routineSelectedLeafCategories, subcategories]);

  // Populate form for editing
  const handleStartEdit = (q: Question) => {
    setEditingId(q.id);
    setText(q.text);
    setOptionA(q.optionA);
    setOptionB(q.optionB);
    setOptionC(q.optionC);
    setOptionD(q.optionD);
    setCorrect(q.correct);
    setExplanation(q.explanation);
    setCategory(q.category);
    setSubcategory(q.subcategory);
    setSelectedCategories(q.categories && q.categories.length > 0 ? q.categories : [q.category]);
    setSelectedSubcategories(q.subcategories && q.subcategories.length > 0 ? q.subcategories : (q.subcategory ? [q.subcategory] : []));
    setIsCustomCategory(false);
    setIsCustomSubcategory(false);
    
    if (q.subcategory) {
      const path = findSubcategoryPath(q.subcategory);
      setAddFormSubcatChain(path);
    } else {
      setAddFormSubcatChain([]);
    }

    setActiveTab('add');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setText('');
    setOptionA('');
    setOptionB('');
    setOptionC('');
    setOptionD('');
    setCorrect('Option A');
    setExplanation('');
    setCategory(categories[0]?.name || 'সাধারণ জ্ঞান');
    setSubcategory('');
    setSelectedCategories([categories[0]?.name || 'সাধারণ জ্ঞান']);
    setSelectedSubcategories([]);
    setAddFormSubcatChain([]);
    setCustomCategory('');
    setIsCustomCategory(false);
    setCustomSubcategory('');
    setIsCustomSubcategory(false);
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
        s.parentCategory && 
        s.parentCategory.trim().toLowerCase() === current &&
        s.name.trim().toLowerCase() !== current
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

  // Helper to fetch all MCQs associated with a node (including direct, leaf, auto-mapped, and descendants)
  const getQuestionsForNode = (nodeName: string): Question[] => {
    if (!nodeName) return [];
    const norm = nodeName.trim().toLowerCase();
    const descendants = getDescendants(nodeName).map(d => d.toLowerCase());

    return questions.filter(q => {
      const qCat = q.category ? q.category.trim().toLowerCase() : '';
      const qSub = q.subcategory ? q.subcategory.trim().toLowerCase() : '';
      const qCsv = q.csvCategory ? q.csvCategory.trim().toLowerCase() : '';

      if (qCat === norm || descendants.includes(qCat)) return true;
      if (qSub === norm || descendants.includes(qSub)) return true;
      if (qCsv === norm || descendants.includes(qCsv)) return true;

      if (q.categories && q.categories.some(c => c && (c.trim().toLowerCase() === norm || descendants.includes(c.trim().toLowerCase())))) return true;
      if (q.subcategories && q.subcategories.some(s => s && (s.trim().toLowerCase() === norm || descendants.includes(s.trim().toLowerCase())))) return true;

      return false;
    });
  };

  // Recursive Tree Node Renderer for Hierarchy Tab
  const renderTreeNode = (
    name: string, 
    id: string, 
    type: 'category' | 'subcategory', 
    depth: number,
    visitedIds: Set<string> = new Set()
  ): React.ReactNode => {
    // Resolve true subcategory/category entity ID if id contains render suffix
    const targetSub = subcategories.find(s => s.id === id || s.name.trim().toLowerCase() === name.trim().toLowerCase());
    const targetCat = categories.find(c => c.id === id || c.name.trim().toLowerCase() === name.trim().toLowerCase());
    const realEntityId = targetSub ? targetSub.id : targetCat ? targetCat.id : id;

    // Avoid circular loops / stack overflows
    if (visitedIds.has(realEntityId) || Array.from(visitedIds).some(vId => {
      const existingSub = subcategories.find(s => s.id === vId);
      const existingCat = categories.find(c => c.id === vId);
      const existingName = (existingSub?.name || existingCat?.name || '').trim().toLowerCase();
      return existingName === name.trim().toLowerCase();
    })) {
      return (
        <div 
          key={`loop-${id}`}
          style={{ paddingLeft: `${Math.max(12, depth * 16)}px` }}
          className="p-2.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold"
        >
          ⚠️ চক্র সনাক্ত হয়েছে (Loop detected): "{name}" এর উপরোক্ত প্যারেন্টের সাথে চক্রাকার সম্পর্ক রয়েছে।
        </div>
      );
    }

    const nextVisited = new Set(visitedIds);
    nextVisited.add(realEntityId);

    // Associated question count (including multi-links, descendants & auto-mapped MCQs)
    const nodeQuestions = getQuestionsForNode(name);
    const qCount = nodeQuestions.length;

    // Direct child subcategories (excluding self-referential loops)
    const children = subcategories.filter(s => 
      s.parentCategory && 
      s.parentCategory.trim().toLowerCase() === name.trim().toLowerCase() &&
      s.name.trim().toLowerCase() !== name.trim().toLowerCase()
    );
    const hasChildren = children.length > 0;

    // Categorize child subcategories into branch folders vs leaf nodes
    const branchChildren = children.filter(c => subcategories.some(other => other.parentCategory && other.parentCategory.trim().toLowerCase() === c.name.trim().toLowerCase()));
    const leafChildren = children.filter(c => !subcategories.some(other => other.parentCategory && other.parentCategory.trim().toLowerCase() === c.name.trim().toLowerCase()));

    // Direct questions attached to this exact category/subcategory node level
    const normName = name.trim().toLowerCase();
    const directQuestions = questions.filter(q => {
      const qCat = q.category ? q.category.trim().toLowerCase() : '';
      const qSub = q.subcategory ? q.subcategory.trim().toLowerCase() : '';
      const qCsv = q.csvCategory ? q.csvCategory.trim().toLowerCase() : '';

      if (qSub === normName || qCat === normName || qCsv === normName) return true;
      if (q.subcategories && q.subcategories.some(s => s && s.trim().toLowerCase() === normName)) return true;
      if (q.categories && q.categories.some(c => c && c.trim().toLowerCase() === normName)) return true;
      return false;
    });

    // Multi-item container flag (if node contains both sub-folders/leaf-nodes AND direct MCQs, or mixed sub-branches)
    const isMultiItemContainer = (hasChildren && directQuestions.length > 0) || (branchChildren.length > 0 && leafChildren.length > 0);

    const isEditing = editingNodeId === realEntityId || editingNodeId === id;
    const isAddingChild = addingChildUnderNodeId === realEntityId || addingChildUnderNodeId === id;
    const isExpanded = expandedNodeIds.has(realEntityId) || expandedNodeIds.has(id);
    const isCollapsed = !isExpanded;
    const isSelectedInBulk = selectedSubcatIds.includes(realEntityId);

    return (
      <div key={`tree-node-${realEntityId}-${depth}`} className="flex flex-col gap-1.5 w-full">
        <div 
          style={{ paddingLeft: `${Math.max(8, depth * 12)}px` }} 
          className={`group flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-xl border transition gap-2 ${
            isSelectedInBulk
              ? 'bg-amber-50/80 border-amber-300 ring-1 ring-amber-300'
              : type === 'category' 
              ? 'bg-indigo-50/45 hover:bg-indigo-50 border-indigo-100/60' 
              : depth === 0
              ? 'bg-white hover:bg-emerald-50/20 border-slate-200 shadow-2xs'
              : 'bg-slate-50/70 hover:bg-indigo-50/30 border-slate-200/80'
          }`}
        >
          {/* Left info (Clickable to expand/collapse) */}
          <div 
            className="flex items-center gap-2 cursor-pointer select-none flex-wrap"
            onClick={() => {
              if (hasChildren || directQuestions.length > 0) {
                toggleNodeExpansion(realEntityId);
              }
            }}
          >
            {/* Multi-select checkbox */}
            <input
              type="checkbox"
              checked={isSelectedInBulk}
              onChange={(e) => {
                e.stopPropagation();
                handleToggleSelectSubcat(realEntityId);
              }}
              className="rounded border-gray-300 w-4 h-4 text-amber-600 focus:ring-amber-500 cursor-pointer shrink-0"
              title="মাল্টিপল সিলেক্ট করুন"
            />

            {/* Collapse/Expand toggle button */}
            {(hasChildren || directQuestions.length > 0) ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleNodeExpansion(realEntityId);
                }}
                className="p-1 hover:bg-indigo-100/80 rounded-md text-indigo-700 transition flex items-center justify-center shrink-0 cursor-pointer"
                title={isCollapsed ? 'প্রসারিত করুন (Expand)' : 'সংকুচিত করুন (Collapse)'}
              >
                {isCollapsed ? (
                  <ChevronRight className="w-4 h-4 text-indigo-600 font-bold" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-indigo-600 font-bold" />
                )}
              </button>
            ) : (
              <span className="w-5 h-5 flex items-center justify-center text-slate-300 text-[10px] shrink-0 font-bold">
                └
              </span>
            )}

            <span className="text-sm shrink-0">
              {type === 'category' ? '📚' : isMultiItemContainer ? '📦' : hasChildren ? (isCollapsed ? '📁' : '📂') : '🍃'}
            </span>

            <div className="flex flex-col gap-0.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-bold text-slate-800 text-xs hover:text-indigo-600 transition">{name}</span>

                {/* Total Question Count Badge */}
                <span className="bg-slate-100 text-slate-700 font-extrabold text-[9px] px-1.5 py-0.5 rounded-md border border-slate-200">
                  📊 {qCount} টি মোট প্রশ্ন
                </span>

                {/* Direct Questions Badge */}
                {directQuestions.length > 0 && (
                  <span className="bg-purple-100 text-purple-800 font-extrabold text-[9px] px-1.5 py-0.5 rounded-md border border-purple-200">
                    ❓ {directQuestions.length} টি সরাসরি MCQ
                  </span>
                )}

                {/* Branch Sub-folders Badge */}
                {branchChildren.length > 0 && (
                  <span className="bg-blue-100 text-blue-800 font-extrabold text-[9px] px-1.5 py-0.5 rounded-md border border-blue-200">
                    📁 {branchChildren.length} টি ফোল্ডার
                  </span>
                )}

                {/* Leaf Nodes Badge */}
                {leafChildren.length > 0 && (
                  <span className="bg-emerald-100 text-emerald-800 font-extrabold text-[9px] px-1.5 py-0.5 rounded-md border border-emerald-200">
                    🍃 {leafChildren.length} টি লিফ নোড
                  </span>
                )}

                {/* Multi-Item Container Tag */}
                {isMultiItemContainer && (
                  <span className="bg-amber-100 text-amber-900 font-black text-[8.5px] px-2 py-0.5 rounded-md border border-amber-300 shadow-2xs flex items-center gap-0.5">
                    🔀 মাল্টি-আইটেম কন্টেইনার (Folder + MCQ)
                  </span>
                )}

                {/* Pure Leaf Node Tag */}
                {!hasChildren && type === 'subcategory' && (
                  <span className="bg-emerald-100 text-emerald-800 font-black text-[9px] px-2 py-0.5 rounded-md border border-emerald-300 shadow-2xs flex items-center gap-1">
                    🍃 লিফ নোড (Leaf Category)
                  </span>
                )}

                {depth > 0 && (
                  <span className="bg-indigo-50 text-indigo-600 font-mono text-[9px] px-1.5 py-0.5 rounded-md border border-indigo-150/60">
                    Level {depth + 1}
                  </span>
                )}

                {hasChildren && isCollapsed && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleNodeExpansion(realEntityId);
                    }}
                    className="bg-amber-100 hover:bg-amber-200 text-amber-900 font-extrabold text-[9px] px-2 py-0.5 rounded-full border border-amber-300 flex items-center gap-1 transition cursor-pointer"
                  >
                    ▶ +{children.length} টি উপ-ধাপ
                  </button>
                )}
              </div>

              {(targetSub?.subHeading || targetCat?.subHeading) && (
                <div className="text-[10px] text-indigo-700 font-bold flex items-center gap-1">
                  <span>🏷️ Sub-heading:</span> {targetSub?.subHeading || targetCat?.subHeading}
                </div>
              )}

              {targetSub && (
                <div className="flex items-center gap-1.5 text-[10px] bg-emerald-50/90 px-2 py-0.5 rounded-md border border-emerald-200/90 shrink-0 flex-wrap">
                  <Calendar className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span className="font-bold text-emerald-900 truncate">
                    {targetSub.date ? formatBengaliDate(targetSub.date) : 'তারিখ দেওয়া হয়নি'}
                  </span>
                  <input
                    type="date"
                    value={targetSub.date || ''}
                    onChange={(e) => {
                      const newDate = e.target.value;
                      if (onUpdateSubcategory) {
                        onUpdateSubcategory(targetSub.id, targetSub.name, targetSub.parentCategory, newDate, targetSub.subHeading);
                      }
                    }}
                    className="px-1.5 py-0.5 border border-emerald-200 rounded text-[9.5px] font-bold text-gray-800 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 shrink-0 cursor-pointer"
                    title="পরীক্ষার তারিখ পরিবর্তন/সম্পাদনা করুন"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Right action controls */}
          <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100 transition self-end sm:self-auto">
            <button
              type="button"
              onClick={() => {
                setAddingChildUnderNodeId(realEntityId);
                setNewChildNodeName('');
                setNewChildNodeSubHeading('');
                setNewChildNodeDate('');
                setEditingNodeId(null);
                if (isCollapsed) {
                  toggleNodeExpansion(realEntityId);
                }
              }}
              className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-1.5 py-1 rounded-md transition text-[10px] font-bold flex items-center gap-0.5 cursor-pointer"
              title="নতুন উপ-ধাপ যোগ করুন"
            >
              ➕ সাব-ধাপ
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingNodeId(realEntityId);
                setEditingNodeNewName(name);
                const sub = targetSub || subcategories.find(s => s.id === realEntityId);
                const cat = targetCat || categories.find(c => c.id === realEntityId);
                setEditingNodeSubHeading(sub?.subHeading || cat?.subHeading || '');
                setEditingNodeDate(sub?.date || '');
                setEditingNodeNewParent(sub ? sub.parentCategory : (type === 'subcategory' ? 'বিষয়ভিত্তিক প্রস্তুতি' : ''));
                setEditingNodeType(type);
                setAddingChildUnderNodeId(null);
              }}
              className="text-amber-600 hover:text-amber-850 hover:bg-amber-50 px-1.5 py-1 rounded-md transition text-[10px] font-bold flex items-center gap-0.5 cursor-pointer"
              title="সম্পাদনা বা মুভ করুন"
            >
              ✏️ এডিট/মুভ
            </button>
            <button
              type="button"
              onClick={() => {
                setDeleteConfirm({ id: realEntityId, name, type });
              }}
              className="text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-1.5 py-1 rounded-md transition text-[10px] font-bold flex items-center gap-0.5 cursor-pointer"
              title="মুছে ফেলুন"
            >
              ❌ মুছুন
            </button>
          </div>
        </div>

        {/* Inline editor panel */}
        {isEditing && (
          <div 
            style={{ marginLeft: `${Math.max(12, depth * 16 + 12)}px` }} 
            className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 shadow-sm flex flex-col gap-3 animate-fade-in text-xs max-w-md w-full"
          >
            <h5 className="font-extrabold text-amber-900 text-[10px] uppercase tracking-wider flex items-center gap-1">
              ✏️ "{name}" এডিট ও পজিশন পরিবর্তন (Move Node)
            </h5>
            
            <div className="flex flex-col gap-2.5">
              <div>
                <label className="block text-[10px] text-amber-950 font-bold mb-1">নতুন নাম:</label>
                <input 
                  type="text"
                  value={editingNodeNewName}
                  onChange={e => setEditingNodeNewName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-amber-300 rounded-lg bg-white text-gray-850 font-semibold focus:outline-none text-[11px]"
                />
              </div>

              <div>
                <label className="block text-[10px] text-amber-950 font-bold mb-1">সাব-হেডিং / সাব-টাইটেল (Sub Heading):</label>
                <input 
                  type="text"
                  value={editingNodeSubHeading}
                  onChange={e => setEditingNodeSubHeading(e.target.value)}
                  placeholder="যেমন: ৩য় ও ৪র্থ শ্রেণীর প্রস্তুতি / অধ্যায়ভিত্তিক শর্টকাট"
                  className="w-full px-3 py-1.5 border border-amber-300 rounded-lg bg-white text-gray-850 font-semibold focus:outline-none text-[11px]"
                />
              </div>

              {type === 'subcategory' && (
                <div>
                  <label className="block text-[10px] text-amber-950 font-bold mb-1">📅 পরীক্ষার তারিখ (Date):</label>
                  <input 
                    type="date"
                    value={editingNodeDate}
                    onChange={e => setEditingNodeDate(e.target.value)}
                    className="w-full px-3 py-1.5 border border-amber-300 rounded-lg bg-white text-gray-850 font-semibold focus:outline-none text-[11px]"
                  />
                </div>
              )}

              {type === 'subcategory' && (
                <div>
                  <label className="block text-[10px] text-amber-950 font-bold mb-1">প্যারেন্ট পরিবর্তন করুন (Move to other place):</label>
                  <select
                    value={editingNodeNewParent}
                    onChange={e => setEditingNodeNewParent(e.target.value)}
                    className="w-full px-3 py-1.5 border border-amber-300 rounded-lg bg-white text-gray-700 font-semibold focus:outline-none text-[11px]"
                  >
                    <optgroup label="মূল ক্যাটাগরি (Root Zones)">
                      <option value="বিষয়ভিত্তিক প্রস্তুতি">বিষয়ভিত্তিক প্রস্তুতি</option>
                      <option value="জব সলিউশন পরীক্ষা">জব সলিউশন পরীক্ষা</option>
                      <option value="সাল ভিত্তিক জব সলিউশন">সাল ভিত্তিক জব সলিউশন</option>
                    </optgroup>
                    <optgroup label="অন্যান্য সাব-ক্যাটাগরি সমূহ">
                      {subcategories
                        // Filter out self and its direct descendants to avoid loops
                        .filter(s => s.id !== realEntityId && s.parentCategory !== name && s.name !== name && s.name !== 'বিষয়ভিত্তিক প্রস্তুতি' && !isJobSolutionVariation(s.name) && !isYearJobSolutionVariation(s.name))
                        .map((s, idx) => (
                          <option key={`opt-sub-${s.id}-${idx}`} value={s.name}>{s.name}</option>
                        ))
                      }
                    </optgroup>
                  </select>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (type === 'category') {
                      if (onUpdateCategory) {
                        onUpdateCategory(realEntityId, editingNodeNewName, editingNodeSubHeading);
                      }
                    } else {
                      if (onUpdateSubcategory) {
                        onUpdateSubcategory(realEntityId, editingNodeNewName, editingNodeNewParent, editingNodeDate || undefined, editingNodeSubHeading);
                      }
                    }
                    setEditingNodeId(null);
                  }}
                  className="bg-amber-600 hover:bg-amber-750 text-white font-extrabold px-3 py-1.5 rounded-lg transition text-[10px] cursor-pointer"
                >
                  সংরক্ষণ করুন
                </button>
                <button
                  type="button"
                  onClick={() => setEditingNodeId(null)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold px-3 py-1.5 rounded-lg transition text-[10px] cursor-pointer"
                >
                  বাতিল
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Inline Add Child input */}
        {isAddingChild && (
          <div 
            style={{ marginLeft: `${Math.max(12, depth * 16 + 12)}px` }} 
            className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-150/80 shadow-sm flex flex-col gap-2.5 animate-fade-in text-xs max-w-sm w-full"
          >
            <h5 className="font-extrabold text-indigo-900 text-[10px] uppercase tracking-wider">
              ➕ "{name}" এর অধীনে নতুন সাব-ক্যাটাগরি যোগ করুন
            </h5>
            <div className="flex flex-col gap-2">
              <input 
                type="text"
                value={newChildNodeName}
                onChange={e => setNewChildNodeName(e.target.value)}
                placeholder="নতুন উপ-ধাপের নাম লিখুন *"
                className="w-full px-3 py-1.5 border border-indigo-200 rounded-lg bg-white text-gray-800 font-semibold focus:outline-none text-[11px]"
              />
              <input 
                type="text"
                value={newChildNodeSubHeading}
                onChange={e => setNewChildNodeSubHeading(e.target.value)}
                placeholder="সাব-হেডিং / সাব-টাইটেল (ঐচ্ছিক)"
                className="w-full px-3 py-1.5 border border-indigo-200 rounded-lg bg-white text-gray-800 font-semibold focus:outline-none text-[11px]"
              />
              <div>
                <label className="block text-[10px] text-indigo-900 font-bold mb-0.5">📅 পরীক্ষার তারিখ (ঐচ্ছিক):</label>
                <input 
                  type="date"
                  value={newChildNodeDate}
                  onChange={e => setNewChildNodeDate(e.target.value)}
                  className="w-full px-3 py-1.5 border border-indigo-200 rounded-lg bg-white text-gray-800 font-semibold focus:outline-none text-[11px]"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    if (!newChildNodeName.trim()) {
                      alert('সঠিক নাম লিখুন!');
                      return;
                    }
                    onAddSubcategory(newChildNodeName.trim(), name, newChildNodeDate.trim() || undefined, newChildNodeSubHeading.trim() || undefined);
                    setAddingChildUnderNodeId(null);
                    setNewChildNodeName('');
                    setNewChildNodeSubHeading('');
                    setNewChildNodeDate('');
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg transition text-[10px] cursor-pointer"
                >
                  যোগ করুন
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddingChildUnderNodeId(null);
                    setNewChildNodeName('');
                    setNewChildNodeSubHeading('');
                    setNewChildNodeDate('');
                  }}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold px-2 py-1.5 rounded-lg transition text-[10px] cursor-pointer"
                >
                  বাতিল
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Children & Direct Questions Render recursion with visual tree depth lines */}
        {!isCollapsed && (hasChildren || directQuestions.length > 0) && (
          <div className="flex flex-col gap-2 w-full border-l-2 border-indigo-200/80 ml-3.5 pl-3.5 py-1 relative">
            {/* If node has direct questions assigned directly to this level */}
            {directQuestions.length > 0 && (
              <div className="bg-purple-50/70 p-3 rounded-xl border border-purple-200/80 my-1 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2 border-b border-purple-200/60 pb-1.5">
                  <span className="font-extrabold text-[11px] text-purple-950 flex items-center gap-1.5">
                    <span>❓</span>
                    "{name}" এ সরাসরি যুক্ত MCQ/প্রশ্নাবলি ({directQuestions.length} টি)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setCatFilter(type === 'category' ? name : 'ALL');
                      setSubcatFilterChain(type === 'subcategory' ? [name] : []);
                      setActiveTab('manage');
                    }}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-2 py-0.5 rounded-md text-[9.5px] transition shadow-2xs cursor-pointer"
                  >
                    🔍 প্রশ্নগুলো এডিট/ম্যানেজ করুন
                  </button>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {directQuestions.slice(0, 10).map((dq, idx) => (
                    <div key={dq.id || idx} className="bg-white p-2 rounded-lg border border-purple-100 text-[10.5px] text-slate-800 font-semibold flex items-start justify-between gap-2 shadow-2xs">
                      <div className="flex-1">
                        <span className="text-purple-700 font-bold mr-1">Q{idx + 1}.</span>
                        {dq.text}
                      </div>
                      <span className="bg-purple-100 text-purple-800 font-extrabold text-[9px] px-1.5 py-0.5 rounded shrink-0">
                        সঠিক: {dq.correct === 'Option A' ? dq.optionA : dq.correct === 'Option B' ? dq.optionB : dq.correct === 'Option C' ? dq.optionC : dq.optionD}
                      </span>
                    </div>
                  ))}
                  {directQuestions.length > 10 && (
                    <p className="text-[10px] text-purple-700 italic font-semibold text-center pt-1">
                      ...আরও {directQuestions.length - 10} টি প্রশ্ন রয়েছে। দেখতে 'প্রশ্নগুলো এডিট/ম্যানেজ করুন' চাপুন।
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Recursively render child subcategories */}
            {hasChildren && children.map((child, idx) => renderTreeNode(child.name, child.id, 'subcategory', depth + 1, nextVisited))}
          </div>
        )}
      </div>
    );
  };

  const handleSaveQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text || !optionA || !optionB || !optionC || !optionD) {
      alert('অনুগ্রহ করে প্রয়োজনীয় সব ঘর পূরণ করুন!');
      return;
    }

    let finalCategories = [...selectedCategories];
    let primaryCategory = category;

    if (isCustomCategory && customCategory.trim()) {
      const customCatTrimmed = customCategory.trim();
      primaryCategory = customCatTrimmed;
      if (!finalCategories.includes(customCatTrimmed)) {
        finalCategories.push(customCatTrimmed);
      }
    }

    // Ensure we have at least one category
    if (finalCategories.length === 0) {
      if (primaryCategory) {
        finalCategories = [primaryCategory];
      } else {
        alert('অন্তত একটি ক্যাটাগরি সিলেক্ট অথবা টাইপ করুন!');
        return;
      }
    } else {
      primaryCategory = finalCategories[0];
    }

    let finalSubcategories = [...selectedSubcategories];
    let primarySubcategory = subcategory;

    if (isCustomSubcategory && customSubcategory.trim()) {
      const customSubTrimmed = customSubcategory.trim();
      primarySubcategory = customSubTrimmed;
      if (!finalSubcategories.includes(customSubTrimmed)) {
        finalSubcategories.push(customSubTrimmed);
      }
    }

    if (finalSubcategories.length > 0) {
      primarySubcategory = finalSubcategories[0];
    }

    const questionData = {
      text: text.trim(),
      optionA: optionA.trim(),
      optionB: optionB.trim(),
      optionC: optionC.trim(),
      optionD: optionD.trim(),
      correct,
      explanation: explanation.trim(),
      category: primaryCategory,
      subcategory: primarySubcategory.trim(),
      categories: finalCategories,
      subcategories: finalSubcategories
    };

    if (editingId) {
      onUpdateQuestion(editingId, questionData);
      alert('প্রশ্নটি সফলভাবে আপডেট করা হয়েছে!');
    } else {
      onAddQuestion(questionData);
      alert('নতুন প্রশ্নটি ডাটাবেসে সফলভাবে যোগ করা হয়েছে!');
    }

    handleCancelEdit();
  };

  // CSV Line Parser with Text Qualifier support
  const parseCSVLine = (line: string, qualifier: string = textQualifier) => {
    const cells: string[] = [];
    let inQuotes = false;
    let currentCell = '';

    for (let j = 0; j < line.length; j++) {
      const char = line[j];

      if (qualifier === '"' && char === '"') {
        if (inQuotes && j + 1 < line.length && line[j + 1] === '"') {
          currentCell += '"';
          j++; // skip escaped quote ""
        } else {
          inQuotes = !inQuotes;
        }
      } else if (qualifier === "'" && char === "'") {
        if (inQuotes && j + 1 < line.length && line[j + 1] === "'") {
          currentCell += "'";
          j++; // skip escaped quote ''
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

  // CSV safe parser helper function with detailed validation
  const parseCSV = (text: string, qualifierChar: string = textQualifier) => {
    const lines = text.split('\n');
    if (lines.length < 2) {
      throw new Error('ফাইলটিতে কোনো ডাটা নেই বা অত্যন্ত ছোট। প্রথম লাইন অবশ্যই হেডার হতে হবে।');
    }

    // Header checking
    const headers = parseCSVLine(lines[0], qualifierChar).map(h => h.trim().replace(/^["']|["']$/g, ''));
    
    // We do NOT require or include subcategory from the CSV upload system.
    const requiredFields = ['text', 'optionA', 'optionB', 'optionC', 'optionD', 'correct'];
    const missing = requiredFields.filter(f => !headers.includes(f));
    if (missing.length > 0) {
      throw new Error(`ফাইল ফরম্যাট ভুল। প্রয়োজনীয় হেডার অনুপস্থিত: ${missing.join(', ')}`);
    }

    const results: Omit<Question, 'id'>[] = [];
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cells = parseCSVLine(line, qualifierChar);

      // Create mapping from headers to cell values
      const rowData: Record<string, string> = {};
      headers.forEach((header, index) => {
        let val = cells[index] || '';
        rowData[header] = val;
      });

      const rowNum = i + 1; // Actual CSV line number
      const textVal = rowData.text ? rowData.text.trim() : '';
      const optA = rowData.optionA ? rowData.optionA.trim() : '';
      const optB = rowData.optionB ? rowData.optionB.trim() : '';
      const optC = rowData.optionC ? rowData.optionC.trim() : '';
      const optD = rowData.optionD ? rowData.optionD.trim() : '';
      const correctVal = rowData.correct ? rowData.correct.trim() : '';

      if (enableCsvValidation) {
        if (!textVal) {
          errors.push(`লাইন ${rowNum}: কুইজের মূল প্রশ্নটি (text) ফাঁকা রাখা যাবে না।`);
        }
        if (!optA) {
          errors.push(`লাইন ${rowNum}: অপশন A (optionA) ফাঁকা রাখা যাবে না।`);
        }
        if (!optB) {
          errors.push(`লাইন ${rowNum}: অপশন B (optionB) ফাঁকা রাখা যাবে না।`);
        }
        if (!optC) {
          errors.push(`লাইন ${rowNum}: অপশন C (optionC) ফাঁকা রাখা যাবে না।`);
        }
        if (!optD) {
          errors.push(`লাইন ${rowNum}: অপশন D (optionD) ফাঁকা রাখা যাবে না।`);
        }
      }

      let correctKey: 'Option A' | 'Option B' | 'Option C' | 'Option D' | null = null;
      if (!correctVal) {
        if (enableCsvValidation) {
          errors.push(`লাইন ${rowNum}: সঠিক উত্তর (correct) ফাঁকা রাখা যাবে না।`);
        }
      } else {
        const rawCorrect = correctVal.toLowerCase().trim();
        if (rawCorrect === 'option a' || rawCorrect === 'a' || rawCorrect === 'optiona' || rawCorrect === 'ক') {
          correctKey = 'Option A';
        } else if (rawCorrect === 'option b' || rawCorrect === 'b' || rawCorrect === 'optionb' || rawCorrect === 'খ') {
          correctKey = 'Option B';
        } else if (rawCorrect === 'option c' || rawCorrect === 'c' || rawCorrect === 'optionc' || rawCorrect === 'গ') {
          correctKey = 'Option C';
        } else if (rawCorrect === 'option d' || rawCorrect === 'd' || rawCorrect === 'optiond' || rawCorrect === 'ঘ') {
          correctKey = 'Option D';
        } else {
          if (enableCsvValidation) {
            errors.push(`লাইন ${rowNum}: সঠিক উত্তর '${correctVal}' ভুল। এটি অবশ্যই Option A, Option B, Option C বা Option D হতে হবে।`);
          }
        }
      }

      if (!enableCsvValidation || errors.length === 0) {
        results.push({
          text: textVal || `প্রশ্নহীন কুইজ ${rowNum}`,
          optionA: optA || 'অপশন ক',
          optionB: optB || 'অপশন খ',
          optionC: optC || 'অপশন গ',
          optionD: optD || 'অপশন ঘ',
          correct: correctKey || 'Option A',
          explanation: rowData.explanation || '',
          category: rowData.category || rowData.subject || rowData['ক্যাটাগরি'] || rowData['বিষয়'] || 'সাধারণ জ্ঞান',
          subcategory: rowData.subcategory || rowData.topic || rowData['সাব-ক্যাটাগরি'] || rowData['উপ-বিষয়'] || rowData['টপিক'] || ''
        });
      }
    }

    if (enableCsvValidation && errors.length > 0) {
      const err = new Error('ডেটা ভ্যালিডেশন ব্যর্থ হয়েছে।');
      (err as any).validationErrors = errors;
      throw err;
    }

    return results;
  };

  const handleBulkUploadCSVText = () => {
    if (!csvText.trim()) {
      alert('অনুগ্রহ করে CSV ফরম্যাটে টেক্সট পেস্ট করুন!');
      return;
    }
    try {
      setCsvFileError('');
      setCsvValidationErrors([]);
      const parsed = parseCSV(csvText);
      if (parsed.length === 0) {
        alert('কোনো বৈধ প্রশ্ন খুঁজে পাওয়া যায়নি। ফরম্যাট ঠিক আছে কিনা নিশ্চিত করুন।');
        return;
      }
      onBulkUploadQuestions(parsed);
      alert(`🎉 সফলভাবে ${parsed.length}টি প্রশ্ন আপলোড করা হয়েছে!`);
      setCsvText('');
    } catch (err: any) {
      if (err.validationErrors) {
        setCsvValidationErrors(err.validationErrors);
        setCsvFileError('কয়েকটি কুইজের তথ্যে ভ্যালিডেশন সমস্যা পাওয়া গেছে। নিচে বিস্তারিত দেখুন।');
      } else {
        setCsvFileError(err.message || 'CSV পার্সিং ব্যর্থ হয়েছে');
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const textVal = event.target?.result as string;
      setRawCSVContent(textVal);
      try {
        setCsvFileError('');
        setCsvValidationErrors([]);
        const parsed = parseCSV(textVal, textQualifier);
        if (parsed.length === 0) {
          alert('কোনো বৈধ প্রশ্ন খুঁজে পাওয়া যায়নি।');
          return;
        }
        setPendingCSVFile(file);
        setPendingQuestions(parsed);
      } catch (err: any) {
        if (err.validationErrors) {
          setCsvValidationErrors(err.validationErrors);
          setCsvFileError('ফাইলের ভেতরে ভ্যালিডেশন সমস্যা পাওয়া গেছে। নিচে বিস্তারিত দেখুন।');
        } else {
          setCsvFileError(err.message || 'ফাইল পার্সিং ব্যর্থ হয়েছে');
        }
        setPendingCSVFile(null);
        setPendingQuestions([]);
      }
    };
    reader.readAsText(file);
  };

  const mapToStandardSubjectCategory = (catName: string = '', subcatName: string = ''): string => {
    const c = catName.trim().toLowerCase();
    const s = subcatName.trim().toLowerCase();
    const combined = `${c} ${s}`.trim();

    // Direct match with standard 9 categories
    for (const std of STANDARD_SUBJECT_CATEGORIES) {
      if (c === std.toLowerCase() || s === std.toLowerCase() || combined === std.toLowerCase()) {
        return std;
      }
    }

    // Bangla Literature vs Grammar
    if (combined.includes('বাংলা') || combined.includes('bangla') || combined.includes('bengali')) {
      if (combined.includes('সাহিত্য') || combined.includes('literature') || combined.includes('কাব্য') || combined.includes('উপন্যাস') || combined.includes('লেখক') || combined.includes('কবি')) {
        return 'বাংলা সাহিত্য';
      }
      return 'বাংলা ব্যাকরণ';
    }

    // English Literature vs Grammar
    if (combined.includes('ইংরেজি') || combined.includes('english')) {
      if (combined.includes('literature') || combined.includes('সাহিত্য') || combined.includes('drama') || combined.includes('poem') || combined.includes('poet')) {
        return 'ইংরেজি সাহিত্য';
      }
      return 'ইংরেজি গ্রামার';
    }

    // Math
    if (combined.includes('গণিত') || combined.includes('math') || combined.includes('mathematics') || combined.includes('বীজগণিত') || combined.includes('পাটিগণিত') || combined.includes('জ্যামিতি') || combined.includes('মানসিক দক্ষতা')) {
      return 'গণিত';
    }

    // Bangladesh
    if (combined.includes('বাংলাদেশ') || combined.includes('bangladesh') || combined.includes('bd')) {
      return 'বাংলাদেশ বিষয়াবলী';
    }

    // International
    if (combined.includes('আন্তর্জাতিক') || combined.includes('international') || combined.includes('intl')) {
      return 'আন্তর্জাতিক বিষয়াবলী';
    }

    // Science
    if (combined.includes('বিজ্ঞান') || combined.includes('science') || combined.includes('পদার্থ') || combined.includes('রসায়ন') || combined.includes('জীববিজ্ঞান')) {
      return 'সাধারণ বিজ্ঞান';
    }

    // ICT
    if (combined.includes('তথ্য') || combined.includes('প্রযুক্তি') || combined.includes('ict') || combined.includes('কম্পিউটার') || combined.includes('computer')) {
      return 'তথ্য ও যোগাযোগ প্রযুক্তি';
    }

    if (combined.includes('ব্যাকরণ') || combined.includes('grammar')) return 'বাংলা ব্যাকরণ';
    if (combined.includes('সাহিত্য') || combined.includes('literature')) return 'বাংলা সাহিত্য';

    return 'সাধারণ বিজ্ঞান';
  };

  const prepareMappingReview = () => {
    if (pendingQuestions.length === 0) return;

    // Group pending questions by subcategory and category
    const subcatGroupMap = new Map<string, { rawSubcat: string; rawCat: string; count: number }>();

    pendingQuestions.forEach(q => {
      const rawSub = (q.subcategory && q.subcategory.trim()) ? q.subcategory.trim() : 'সাধারণ কুইজ';
      const rawCat = (q.category && q.category.trim()) ? q.category.trim() : 'সাধারণ জ্ঞান';
      const key = `${rawCat}::${rawSub}`;

      if (!subcatGroupMap.has(key)) {
        subcatGroupMap.set(key, { rawSubcat: rawSub, rawCat: rawCat, count: 0 });
      }
      subcatGroupMap.get(key)!.count += 1;
    });

    const mappingsList: CSVMismatchMapping[] = [];
    let index = 0;

    subcatGroupMap.forEach((val) => {
      const dbSub = findSubcategoryInDatabase(val.rawSubcat);
      const dbCat = findCategoryInDatabase(val.rawCat);

      // Determine target category dynamically
      let targetCat = val.rawCat;
      if (dbCat) {
        targetCat = dbCat;
      } else if (dbSub && dbSub.parentCategory) {
        targetCat = dbSub.parentCategory;
      } else {
        targetCat = mapToStandardSubjectCategory(val.rawCat, val.rawSubcat);
      }

      // Check if subcategory or category already exists in database dynamically
      const subExistsInDb = !!dbSub;
      const catExistsInDb = !!dbCat;

      // It's a match if the subcategory or category exists dynamically in the system
      const isMatched = subExistsInDb || catExistsInDb;
      const isMismatch = !isMatched;

      // Existing subcategories under targetCat
      const existingUnderTarget = subcategories.filter(s =>
        s.parentCategory && normalizeName(s.parentCategory) === normalizeName(targetCat)
      );

      const defaultExistingChoice = dbSub ? dbSub.name : (existingUnderTarget.length > 0 ? existingUnderTarget[0].name : val.rawSubcat);

      mappingsList.push({
        id: `mismatch-${index++}-${Date.now()}`,
        rawSubcategory: val.rawSubcat,
        correctedSubcategory: dbSub ? dbSub.name : val.rawSubcat,
        targetCategory: targetCat,
        action: subExistsInDb ? 'map_existing' : 'create',
        existingSubcategoryChoice: defaultExistingChoice,
        questionCount: val.count,
        isMismatch: isMismatch
      });
    });

    setMismatchMappings(mappingsList);
    setShowUploadConfirm(false);
    setShowMappingReviewModal(true);
  };

  const handleFinalizeUploadWithMappings = () => {
    if (pendingQuestions.length === 0) return;

    const activeDestSubcats = uploadDestSubcatChain.filter(s => s && s !== 'ALL');
    const destSub = activeDestSubcats.length > 0 ? activeDestSubcats[activeDestSubcats.length - 1] : '';

    let currentSubcatList = [...subcategories];
    let createdSubcatsCount = 0;

    // 1. Ensure all 9 standard subject categories exist under parent 'বিষয়ভিত্তিক প্রস্তুতি'
    STANDARD_SUBJECT_CATEGORIES.forEach(stdCat => {
      const exists = currentSubcatList.some(
        s => normalizeName(s.name) === normalizeName(stdCat) &&
             s.parentCategory && normalizeName(s.parentCategory) === normalizeName('বিষয়ভিত্তিক প্রস্তুতি')
      );
      if (!exists) {
        const newSub: SubcategoryItem = {
          id: `subcat-std-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          name: stdCat,
          parentCategory: 'বিষয়ভিত্তিক প্রস্তুতি'
        };
        currentSubcatList.push(newSub);
        onAddSubcategory(stdCat, 'বিষয়ভিত্তিক প্রস্তুতি');
        createdSubcatsCount++;
      }
    });

    // 2. Process mismatch mappings & create required subcategories
    mismatchMappings.forEach(m => {
      if (m.action === 'create') {
        const subName = m.correctedSubcategory.trim();
        const parentCat = m.targetCategory.trim();

        if (subName) {
          const subExists = currentSubcatList.some(
            s => normalizeName(s.name) === normalizeName(subName) &&
                 s.parentCategory && normalizeName(s.parentCategory) === normalizeName(parentCat)
          );
          if (!subExists) {
            const newSubItem: SubcategoryItem = {
              id: `subcat-map-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              name: subName,
              parentCategory: parentCat
            };
            currentSubcatList.push(newSubItem);
            onAddSubcategory(subName, parentCat);
            createdSubcatsCount++;
          }
        }
      }
    });

    // 3. Map final questions
    const finalQuestions = pendingQuestions.map(q => {
      const rawSub = (q.subcategory && q.subcategory.trim()) ? q.subcategory.trim() : 'সাধারণ কুইজ';
      const rawCat = (q.category && q.category.trim()) ? q.category.trim() : 'সাধারণ জ্ঞান';

      const mappingRule = mismatchMappings.find(m => normalizeName(m.rawSubcategory) === normalizeName(rawSub));

      const finalTargetCat = mappingRule ? mappingRule.targetCategory : (findCategoryInDatabase(rawCat) || rawCat);
      const finalTargetSubcat = mappingRule 
        ? (mappingRule.action === 'map_existing' ? mappingRule.existingSubcategoryChoice : mappingRule.correctedSubcategory)
        : rawSub;

      const cats: string[] = [uploadDestCat || 'সাধারণ জ্ঞান'];
      const subs: string[] = [...activeDestSubcats];

      if (enableSubjectAutoMap) {
        if (finalTargetCat && !cats.includes(finalTargetCat)) {
          cats.push(finalTargetCat);
        }
        if (finalTargetSubcat && !subs.includes(finalTargetSubcat)) {
          subs.push(finalTargetSubcat);
        }
      }

      return {
        ...q,
        category: uploadDestCat || 'সাধারণ জ্ঞান',
        subcategory: destSub,
        categories: Array.from(new Set(cats.filter(Boolean))),
        subcategories: Array.from(new Set(subs.filter(Boolean))),
        csvCategory: finalTargetCat
      };
    });

    onBulkUploadQuestions(finalQuestions);

    // Save to upload history
    const destString = destSub ? `${uploadDestCat} ➔ ${destSub}` : uploadDestCat;
    const historyNote = enableSubjectAutoMap 
      ? `${destString} (বিষয়ভিত্তিক অটো-ম্যাপড)` 
      : destString;

    const newHistoryItem = {
      id: Date.now().toString(),
      filename: pendingCSVFile?.name || 'ফাইল আপলোড',
      timestamp: new Date().toLocaleString('bn-BD', { hour12: true }),
      count: finalQuestions.length,
      destination: historyNote
    };

    const updatedHistory = [newHistoryItem, ...uploadHistory];
    setUploadHistory(updatedHistory);
    localStorage.setItem('orjon_upload_history', JSON.stringify(updatedHistory));

    let msg = `🎉 সফলভাবে ${finalQuestions.length}টি প্রশ্ন ডাটাবেসে আপলোড করা হয়েছে!`;
    if (createdSubcatsCount > 0) {
      msg += `\n🎯 বিষয়ভিত্তিক প্রস্তুতি জোনে ${createdSubcatsCount}টি নতুন সাব-ক্যাটাগরি স্বয়ংক্রিয়ভাবে তৈরি ও যুক্ত করা হয়েছে।`;
    }
    
    showCustomAlert('আপলোড সফল হয়েছে!', msg, 'success');

    // Reset states
    setPendingCSVFile(null);
    setPendingQuestions([]);
    setShowUploadConfirm(false);
    setShowMappingReviewModal(false);
    setMismatchMappings([]);

    // Reset file input
    const fileInput = document.getElementById('csv-file-input') as HTMLInputElement | null;
    if (fileInput) fileInput.value = '';
  };

  const executeBulkUpload = () => {
    prepareMappingReview();
  };

  // Dynamically compute available Leaf Categories / Topics for Manage tab based on active filters
  const manageAvailableLeafTopics = useMemo(() => {
    const activeSubcatFilters = subcatFilterChain.filter(s => s && s !== 'ALL');
    const leafMap = new Map<string, number>();

    if (activeSubcatFilters.length > 0) {
      const deepestSub = activeSubcatFilters[activeSubcatFilters.length - 1];
      const deepestLower = deepestSub.trim().toLowerCase();
      const descendants = subcategoryDescendantsMap.get(deepestLower) || new Set<string>();
      const activeSet = new Set<string>([deepestLower, ...descendants]);

      // 1. Child subcategory leaf nodes
      subcategories.forEach(s => {
        const sLower = s.name.trim().toLowerCase();
        const pLower = (s.parentCategory || '').trim().toLowerCase();
        if (activeSet.has(pLower)) {
          const isLeaf = !subcategories.some(child => (child.parentCategory || '').trim().toLowerCase() === sLower);
          if (isLeaf) {
            const count = subcategoryDescendantsCountMap.get(sLower) || nodeQuestionCountMap.get(sLower) || 0;
            leafMap.set(s.name.trim(), count);
          }
        }
      });

      // 2. csvCategory values on questions matching this subcategory chain
      questions.forEach(q => {
        const qSub = (q.subcategory || '').trim().toLowerCase();
        const qCsv = (q.csvCategory || '').trim();
        const qSubArray = (q.subcategories || []).map(s => s.trim().toLowerCase());

        const matches = activeSet.has(qSub) || qSubArray.some(s => activeSet.has(s));
        if (matches && qCsv) {
          leafMap.set(qCsv, (leafMap.get(qCsv) || 0) + 1);
        }
      });
    } else if (catFilter !== 'ALL') {
      // Leaf topics under this Root Category
      questions.forEach(q => {
        const rootSet = questionRootCategoriesMap.get(q.id);
        const matchesRoot = rootSet && rootSet.has(catFilter);
        const matchesCat = q.category === catFilter || (q.categories && q.categories.includes(catFilter));
        const qCsv = (q.csvCategory || '').trim();
        if ((matchesRoot || matchesCat) && qCsv) {
          leafMap.set(qCsv, (leafMap.get(qCsv) || 0) + 1);
        }
      });
    }

    return Array.from(leafMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [questions, subcategories, catFilter, subcatFilterChain, subcategoryDescendantsMap, subcategoryDescendantsCountMap, nodeQuestionCountMap, questionRootCategoriesMap]);

  // Manage Question Filter Logics (Advanced Cascading Filters - Memoized)
  const filteredQuestionsForManage = useMemo(() => {
    const activeSubcatFilters = subcatFilterChain.filter(s => s && s !== 'ALL');
    let deepestSubLower = '';
    let descendantSet: Set<string> | null = null;

    if (activeSubcatFilters.length > 0) {
      const deepestSub = activeSubcatFilters[activeSubcatFilters.length - 1];
      deepestSubLower = deepestSub.trim().toLowerCase();
      descendantSet = subcategoryDescendantsMap.get(deepestSubLower) || new Set();
    }

    const searchLower = searchQuery.toLowerCase().trim();
    const leafLower = leafTopicFilter !== 'ALL' ? leafTopicFilter.trim().toLowerCase() : '';

    return questions.filter(q => {
      // 1. Matches Main Category
      if (catFilter !== 'ALL') {
        const rootSet = questionRootCategoriesMap.get(q.id);
        const matchesRoot = rootSet && rootSet.has(catFilter);
        const qCats = q.categories && q.categories.length > 0 ? q.categories : [q.category];
        const matchesDirectCat = qCats.some(c => c === catFilter);
        if (!matchesRoot && !matchesDirectCat) return false;
      }

      // 2. Matches Subcategory Chain
      if (descendantSet) {
        const qSubs = q.subcategories && q.subcategories.length > 0 ? q.subcategories : (q.subcategory ? [q.subcategory] : []);
        const matchesSub = qSubs.some(s => {
          const lowerS = s.trim().toLowerCase();
          return lowerS === deepestSubLower || descendantSet!.has(lowerS);
        });
        if (!matchesSub) return false;
      }

      // 3. Matches Leaf Topic Filter
      if (leafLower) {
        const qCsvLower = (q.csvCategory || '').trim().toLowerCase();
        const qSubLower = (q.subcategory || '').trim().toLowerCase();
        const qSubs = (q.subcategories || []).map(s => s.trim().toLowerCase());
        const matchesLeaf = qCsvLower === leafLower || qSubLower === leafLower || qSubs.includes(leafLower);
        if (!matchesLeaf) return false;
      }

      // 4. Matches Search Text
      if (searchLower) {
        const matchesSearch = q.text.toLowerCase().includes(searchLower) || 
                              q.category.toLowerCase().includes(searchLower) ||
                              (q.subcategory && q.subcategory.toLowerCase().includes(searchLower)) ||
                              (q.csvCategory && q.csvCategory.toLowerCase().includes(searchLower)) ||
                              (q.explanation && q.explanation.toLowerCase().includes(searchLower));
        if (!matchesSearch) return false;
      }

      return true;
    });
  }, [questions, catFilter, subcatFilterChain, leafTopicFilter, searchQuery, subcategoryDescendantsMap, questionRootCategoriesMap]);

  // Reset managePage to 1 when filters change
  useEffect(() => {
    setManagePage(1);
  }, [catFilter, subcatFilterChain, leafTopicFilter, searchQuery]);

  const paginatedQuestionsForManage = useMemo(() => {
    const start = (managePage - 1) * managePageSize;
    return filteredQuestionsForManage.slice(start, start + managePageSize);
  }, [filteredQuestionsForManage, managePage, managePageSize]);

  const totalManagePages = Math.ceil(filteredQuestionsForManage.length / managePageSize) || 1;

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedQIds(filteredQuestionsForManage.map(q => q.id));
    } else {
      setSelectedQIds([]);
    }
  };

  // Memoized Category Calculations for Category Tab
  const leafSubcategories = useMemo(() => {
    const parentSet = new Set(
      subcategories
        .map(s => s.parentCategory ? s.parentCategory.trim().toLowerCase() : '')
        .filter(Boolean)
    );
    return subcategories.filter(sub => !parentSet.has(sub.name.trim().toLowerCase()));
  }, [subcategories]);

  const branchSubcategories = useMemo(() => {
    const parentSet = new Set(
      subcategories
        .map(s => s.parentCategory ? s.parentCategory.trim().toLowerCase() : '')
        .filter(Boolean)
    );
    return subcategories.filter(sub => parentSet.has(sub.name.trim().toLowerCase()));
  }, [subcategories]);

  const hiddenNodes = useMemo(() => {
    const registered = new Set<string>();
    ['বিষয়ভিত্তিক প্রস্তুতি', 'জব সলিউশন পরীক্ষা', 'সাল ভিত্তিক জব সলিউশন', 'সাধারণ জ্ঞান'].forEach(r => registered.add(r.trim().toLowerCase()));
    categories.forEach(c => registered.add(c.name.trim().toLowerCase()));
    subcategories.forEach(s => registered.add(s.name.trim().toLowerCase()));

    const map = new Map<string, {
      name: string;
      questionCount: number;
      suggestedParent: string;
      sampleQuestions: Question[];
    }>();

    questions.forEach(q => {
      const candidates: Array<{ name: string; parentHint?: string }> = [];
      if (q.category) candidates.push({ name: q.category.trim() });
      if (q.subcategory) candidates.push({ name: q.subcategory.trim(), parentHint: q.category || q.csvCategory });
      if (q.csvCategory) candidates.push({ name: q.csvCategory.trim() });
      if (q.categories && Array.isArray(q.categories)) {
        q.categories.forEach(c => c && candidates.push({ name: c.trim() }));
      }
      if (q.subcategories && Array.isArray(q.subcategories)) {
        q.subcategories.forEach((s, idx) => {
          if (s) {
            const parent = idx > 0 ? q.subcategories![idx - 1] : (q.category || 'বিষয়ভিত্তিক প্রস্তুতি');
            candidates.push({ name: s.trim(), parentHint: parent });
          }
        });
      }

      candidates.forEach(({ name, parentHint }) => {
        if (!name) return;
        const lower = name.toLowerCase();
        if (registered.has(lower) || isJobSolutionVariation(name) || isYearJobSolutionVariation(name)) {
          return;
        }

        if (!map.has(lower)) {
          let parent = parentHint && parentHint.trim() ? parentHint.trim() : 'বিষয়ভিত্তিক প্রস্তুতি';
          if (isJobSolutionVariation(parent) || isYearJobSolutionVariation(parent)) {
            parent = 'সাধারণ জ্ঞান';
          }
          map.set(lower, {
            name,
            questionCount: 1,
            suggestedParent: parent,
            sampleQuestions: [q]
          });
        } else {
          const item = map.get(lower)!;
          item.questionCount += 1;
          if (item.sampleQuestions.length < 3 && !item.sampleQuestions.some(sq => sq.id === q.id)) {
            item.sampleQuestions.push(q);
          }
        }
      });
    });

    return Array.from(map.values());
  }, [questions, categories, subcategories]);

  // Helper to determine root category zone for any subcategory
  const getRootZoneForSubcategory = (subName: string): 'subject' | 'job' | 'year' => {
    let current = subcategories.find(s => s.name.trim().toLowerCase() === subName.trim().toLowerCase());
    let limit = 10;
    while (current && limit > 0) {
      const parent = current.parentCategory ? current.parentCategory.trim() : '';
      if (isJobSolutionVariation(parent) || isJobSolutionVariation(current.name)) return 'job';
      if (isYearJobSolutionVariation(parent) || isYearJobSolutionVariation(current.name)) return 'year';
      if (parent === 'বিষয়ভিত্তিক প্রস্তুতি' || current.name === 'বিষয়ভিত্তিক প্রস্তুতি') return 'subject';

      const parentSub = subcategories.find(s => s.name.trim().toLowerCase() === parent.toLowerCase());
      if (parentSub) {
        current = parentSub;
      } else {
        break;
      }
      limit--;
    }
    return 'subject';
  };

  const filteredLeafNodes = useMemo(() => {
    let list = leafSubcategories;
    if (rootCategoryFilter !== 'ALL') {
      list = list.filter(sub => getRootZoneForSubcategory(sub.name) === rootCategoryFilter);
    }
    if (!categorySearchQuery.trim()) return list;
    const q = categorySearchQuery.toLowerCase();
    return list.filter(sub => {
      const path = findSubcategoryPath(sub.name).join(' ➔ ').toLowerCase();
      return sub.name.toLowerCase().includes(q) || (sub.parentCategory && sub.parentCategory.toLowerCase().includes(q)) || path.includes(q);
    });
  }, [leafSubcategories, rootCategoryFilter, categorySearchQuery, subcategories]);

  const sortedLeafNodes = useMemo(() => {
    return [...filteredLeafNodes].sort((a, b) => {
      const timeA = a.date ? new Date(a.date).getTime() : 0;
      const timeB = b.date ? new Date(b.date).getTime() : 0;
      return timeB - timeA;
    });
  }, [filteredLeafNodes]);

  // Chunk leaf nodes into pairs (2 cards per row) for react-window virtualized grid rendering
  const leafNodeRows = useMemo(() => {
    const rows: SubcategoryItem[][] = [];
    for (let i = 0; i < sortedLeafNodes.length; i += 2) {
      rows.push(sortedLeafNodes.slice(i, i + 2));
    }
    return rows;
  }, [sortedLeafNodes]);

  // Chunk hidden nodes into pairs (2 cards per row) for react-window virtualized grid rendering
  const hiddenNodeRows = useMemo(() => {
    const rows: Array<typeof hiddenNodes[number][]> = [];
    for (let i = 0; i < hiddenNodes.length; i += 2) {
      rows.push(hiddenNodes.slice(i, i + 2));
    }
    return rows;
  }, [hiddenNodes]);

  const filteredAllSubcats = useMemo(() => {
    if (!categorySearchQuery.trim()) return subcategories;
    const q = categorySearchQuery.toLowerCase();
    return subcategories.filter(sub => 
      sub.name.toLowerCase().includes(q) || (sub.parentCategory && sub.parentCategory.toLowerCase().includes(q))
    );
  }, [subcategories, categorySearchQuery]);

  const handleToggleSelectQ = (id: string) => {
    if (selectedQIds.includes(id)) {
      setSelectedQIds(selectedQIds.filter(item => item !== id));
    } else {
      setSelectedQIds([...selectedQIds, id]);
    }
  };

  const handleBulkDelete = () => {
    if (selectedQIds.length === 0) {
      showCustomAlert('ত্রুটি', 'প্রথমে এক বা একাধিক প্রশ্ন নির্বাচন করুন!', 'warning');
      return;
    }
    showCustomConfirm(
      'প্রশ্ন ডিলিট নিশ্চিতকরণ',
      `আপনি কি নিশ্চিতভাবে নির্বাচিত ${selectedQIds.length}টি প্রশ্ন একবারে মুছে ফেলতে চান?`,
      () => {
        const count = selectedQIds.length;
        onBulkDeleteQuestions(selectedQIds);
        setSelectedQIds([]);
        showCustomAlert('সম্পন্ন হয়েছে!', `নির্বাচিত ${count}টি প্রশ্ন সফলভাবে ডিলিট করা হয়েছে!`, 'success');
      },
      'warning'
    );
  };

  const handleBulkMove = (mode: 'move' | 'link' = 'move') => {
    if (selectedQIds.length === 0) {
      showCustomAlert('ত্রুটি', 'প্রথমে এক বা একাধিক প্রশ্ন নির্বাচন করুন!', 'warning');
      return;
    }
    
    // Find destination subcategory if selected in the cascade
    const activeDestSubcats = moveDestSubcatChain.filter(s => s && s !== 'ALL');
    const destSub = activeDestSubcats.length > 0 ? activeDestSubcats[activeDestSubcats.length - 1] : '';

    const isMove = mode === 'move';
    const confirmTitle = isMove ? 'প্রশ্ন স্থানান্তর (Move) নিশ্চিতকরণ' : 'মাল্টি-ক্যাটাগরি লিঙ্ক নিশ্চিতকরণ';
    const confirmMsg = isMove
      ? `আপনি কি নিশ্চিতভাবে নির্বাচিত ${selectedQIds.length}টি প্রশ্নকে মূল ক্যাটাগরি "${moveDestCat}" ${destSub ? `ও সাব-ক্যাটাগরি "${destSub}"` : ''} এ স্থানান্তরিত (Reassign Primary Category) করতে চান?`
      : `আপনি কি নিশ্চিতভাবে নির্বাচিত ${selectedQIds.length}টি প্রশ্নকে অতিরিক্ত ক্যাটাগরি "${moveDestCat}" ${destSub ? `ও সাব-ক্যাটাগরি "${destSub}"` : ''} এর সাথে লিঙ্ক (Link) করতে চান?`;

    showCustomConfirm(
      confirmTitle,
      confirmMsg,
      () => {
        const count = selectedQIds.length;
        onBulkMoveQuestions(selectedQIds, moveDestCat, destSub, mode);
        setSelectedQIds([]);
        setMoveDestSubcatChain([]);
        showCustomAlert('সম্পন্ন হয়েছে!', `নির্বাচিত ${count}টি প্রশ্ন সফলভাবে ${isMove ? 'নতুন ক্যাটাগরিতে স্থানান্তরিত' : 'অতিরিক্ত ক্যাটাগরিতে লিঙ্ক'} করা হয়েছে!`, 'success');
      },
      'info'
    );
  };

  // Subcategories Multiple Selection & Bulk Action Handlers
  const handleToggleSelectSubcat = (id: string) => {
    if (selectedSubcatIds.includes(id)) {
      setSelectedSubcatIds(selectedSubcatIds.filter(item => item !== id));
    } else {
      setSelectedSubcatIds([...selectedSubcatIds, id]);
    }
  };

  const handleSelectAllSubcats = (subcatList: SubcategoryItem[]) => {
    if (selectedSubcatIds.length === subcatList.length && subcatList.length > 0) {
      setSelectedSubcatIds([]);
    } else {
      setSelectedSubcatIds(subcatList.map(s => s.id));
    }
  };

  const handleBulkDeleteSubcatAction = () => {
    if (selectedSubcatIds.length === 0) {
      showCustomAlert('ত্রুটি', 'প্রথমে এক বা একাধিক সাব-ক্যাটাগরি নির্বাচন করুন!', 'warning');
      return;
    }
    showCustomConfirm(
      'সাব-ক্যাটাগরি ডিলিট নিশ্চিতকরণ',
      `আপনি কি নিশ্চিতভাবে নির্বাচিত ${selectedSubcatIds.length}টি সাব-ক্যাটাগরি এবং এদের অধীনস্থ সমস্ত ব্রাঞ্চ একবারে মুছে ফেলতে চান?`,
      () => {
        const count = selectedSubcatIds.length;
        if (onBulkDeleteSubcategories) {
          onBulkDeleteSubcategories(selectedSubcatIds);
        } else {
          selectedSubcatIds.forEach(id => onDeleteSubcategory(id));
        }
        setSelectedSubcatIds([]);
        showCustomAlert('সম্পন্ন!', `নির্বাচিত ${count}টি সাব-ক্যাটাগরি সফলভাবে ডিলিট করা হয়েছে!`, 'success');
      },
      'warning'
    );
  };

  const handleBulkMoveSubcatAction = () => {
    if (selectedSubcatIds.length === 0) {
      showCustomAlert('ত্রুটি', 'প্রথমে এক বা একাধিক সাব-ক্যাটাগরি নির্বাচন করুন!', 'warning');
      return;
    }
    if (!bulkSubcatMoveParent) {
      showCustomAlert('ত্রুটি', 'নতুন প্যারেন্ট ক্যাটাগরি নির্বাচন করুন!', 'warning');
      return;
    }
    showCustomConfirm(
      'প্যারেন্ট ক্যাটাগরি পরিবর্তন নিশ্চিতকরণ',
      `আপনি কি নিশ্চিতভাবে নির্বাচিত ${selectedSubcatIds.length}টি সাব-ক্যাটাগরিকে নতুন প্যারেন্ট "${bulkSubcatMoveParent}" এ স্থানান্তরিত করতে চান?`,
      () => {
        const count = selectedSubcatIds.length;
        if (onBulkMoveSubcategories) {
          onBulkMoveSubcategories(selectedSubcatIds, bulkSubcatMoveParent);
        }
        setSelectedSubcatIds([]);
        showCustomAlert('সম্পন্ন!', `নির্বাচিত ${count}টি সাব-ক্যাটাগরি সফলভাবে "${bulkSubcatMoveParent}" এ স্থানান্তরিত করা হয়েছে!`, 'success');
      },
      'info'
    );
  };

  // Notice & Exam publish handlers
  const handleSaveNoticeText = () => {
    if (!noticeText.trim()) {
      alert('নোটিশের জন্য বিবরণ লিখুন!');
      return;
    }
    onSaveNotice(noticeText.trim());
    alert('📢 নোটিশ বোর্ড সফলভাবে আপডেট করা হয়েছে!');
  };

  const MANUAL_CATEGORIES = [
    { id: 'bangla', name: 'Bangla (বাংলা)' },
    { id: 'bengaliLit', name: 'Bengali Literature (বাংলা সাহিত্য)' },
    { id: 'english', name: 'English (ইংরেজি)' },
    { id: 'englishLit', name: 'English Literature (ইংরেজি সাহিত্য)' },
    { id: 'math', name: 'Math (গণিত)' },
    { id: 'science', name: 'General Science (সাধারণ বিজ্ঞান)' },
    { id: 'bdAffairs', name: 'Bangladesh Affairs (বাংলাদেশ বিষয়াবলী)' },
    { id: 'intlAffairs', name: 'International Affairs (আন্তর্জাতিক বিষয়াবলী)' }
  ];

  const handleCreateLiveExam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!examTitle.trim() || !examStartTime || !examExpiryTime) {
      alert('পরীক্ষার নাম, শুরুর সময় ও শেষ সময় নির্ধারণ করুন!');
      return;
    }

    let questionIds: string[] | undefined = undefined;

    if (isManualSelection) {
      const sumOfLimits = Object.values(categoryLimits).reduce((sum: number, val: any) => sum + Number(val), 0);
      if (sumOfLimits !== Number(examQLimit)) {
        alert(`মোট নির্ধারিত প্রশ্নসংখ্যা (${examQLimit}) এবং ক্যাটাগরিভিত্তিক কোটার যোগফল (${sumOfLimits}) সমান হতে হবে।`);
        return;
      }

      // Check selections count
      const missingSelections: string[] = [];
      MANUAL_CATEGORIES.forEach(cat => {
        const limit = categoryLimits[cat.id] || 0;
        const selectedCount = selectedQuestionsByCategory[cat.id]?.length || 0;
        if (selectedCount !== limit) {
          missingSelections.push(`"${cat.name}" ক্যাটাগরিতে ${limit}টি প্রশ্ন চাওয়া হয়েছে, কিন্তু আপনি ${selectedCount}টি সিলেক্ট করেছেন।`);
        }
      });

      if (missingSelections.length > 0) {
        alert(`প্রশ্ন সিলেকশনে ত্রুটি:\n${missingSelections.join('\n')}`);
        return;
      }

      // Merge all selected IDs
      questionIds = MANUAL_CATEGORIES.flatMap(cat => selectedQuestionsByCategory[cat.id] || []);
    }

    onCreateLiveExam({
      title: examTitle.trim(),
      qLimit: Number(examQLimit),
      timeLimit: Number(examTimeLimit),
      category: isManualSelection ? 'ALL' : examCategory,
      startTime: new Date(examStartTime).toISOString(),
      expiryTime: new Date(examExpiryTime).toISOString(),
      questionIds
    });

    alert('🎯 নতুন অফিশিয়াল লাইভ পরীক্ষা সফলভাবে তৈরি হয়েছে!');
    setExamTitle('');
    setExamStartTime('');
    setExamExpiryTime('');

    // Clear manual selection states after success
    if (isManualSelection) {
      setCategoryLimits({
        bangla: 0,
        bengaliLit: 0,
        english: 0,
        englishLit: 0,
        math: 0,
        science: 0,
        bdAffairs: 0,
        intlAffairs: 0
      });
      setSelectedQuestionsByCategory({
        bangla: [],
        bengaliLit: [],
        english: [],
        englishLit: [],
        math: [],
        science: [],
        bdAffairs: [],
        intlAffairs: []
      });
      setIsManualSelection(false);
    }
  };

  const handleCreateRoutine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!routineTitle.trim()) {
      showCustomAlert('অসম্পূর্ণ তথ্য!', 'রুটিনের শিরোনাম দিন!', 'error');
      return;
    }

    if (routineEnableExam) {
      if (!routineExamStartTime) {
        showCustomAlert('পরীক্ষার সময় দিন!', 'পরীক্ষা শুরুর তারিখ ও সময় নির্ধারণ করুন!', 'error');
        return;
      }
      if (routineExamQuestionSelection === 'manual' && routineExamManualQuestionIds.length === 0) {
        showCustomAlert('প্রশ্ন নির্বাচন করুন!', 'ম্যানুয়াল মোডে অন্তত ১ টি প্রশ্ন নির্বাচন করুন!', 'error');
        return;
      }
    }

    const targetCourse = courses ? courses.find(c => c.id === routineCourseId) : undefined;

    const examConfig: ScheduledExamConfig | undefined = routineEnableExam ? {
      enabled: true,
      startTime: routineExamStartTime,
      expiryTime: routineExamExpiryTime || undefined,
      timeLimit: Number(routineExamTimeLimit) || 20,
      qLimit: routineExamQuestionSelection === 'manual' ? routineExamManualQuestionIds.length : (Number(routineExamQLimit) || 20),
      totalMarks: Number(routineExamTotalMarks) || 20,
      passMarks: Number(routineExamPassMarks) || 8,
      questionSelection: routineExamQuestionSelection,
      questionIds: routineExamQuestionSelection === 'manual' ? routineExamManualQuestionIds : undefined
    } : undefined;

    onSaveRoutine(
      routineTitle.trim(), 
      routineDetails.trim(), 
      targetCourse?.id, 
      targetCourse?.title,
      [routineSelectedRootCategory, ...routineSelectedCategories].filter(Boolean),
      routineSelectedSubcategories,
      routineSelectedLeafCategories,
      examConfig
    );

    showCustomAlert('সফল!', '📅 নতুন সিলেবাস রুটিন ও শিডিউলড এক্সাম সফলভাবে পাবলিশ করা হয়েছে!', 'success');

    // Reset Form
    setRoutineTitle('');
    setRoutineDetails('');
    setRoutineCourseId('');
    setRoutineSelectedRootCategory('বিষয়ভিত্তিক প্রস্তুতি');
    setRoutineSelectedCategories([]);
    setRoutineSelectedSubcategories([]);
    setRoutineSelectedLeafCategories([]);
    setRoutineEnableExam(false);
    setRoutineExamStartTime('');
    setRoutineExamExpiryTime('');
    setRoutineExamTimeLimit(20);
    setRoutineExamQLimit(20);
    setRoutineExamTotalMarks(20);
    setRoutineExamPassMarks(8);
    setRoutineExamQuestionSelection('auto');
    setRoutineExamManualQuestionIds([]);
  };

  const classifyQuestion = (q: Question): string => {
    const textLower = q.text.toLowerCase();
    const explanationLower = (q.explanation || '').toLowerCase();
    const categoryLower = q.category.toLowerCase();
    const subcatLower = (q.subcategory || '').toLowerCase();

    // 1. Math
    if (categoryLower.includes('গণিত') || categoryLower.includes('math') || subcatLower.includes('গণিত') || subcatLower.includes('math')) {
      return 'math';
    }

    // 2. Science
    if (categoryLower.includes('বিজ্ঞান') || categoryLower.includes('science') || subcatLower.includes('বিজ্ঞান') || subcatLower.includes('science')) {
      return 'science';
    }

    // 3. Bengali Literature
    const containsBengaliLitKeywords = ['রবীন্দ্রনাথ', 'নজরুল', 'উপন্যাস', 'কাব্য', 'রচিত', 'লেখক', 'কবি', 'মহাকাব্য', 'নাটক', 'গল্প', 'চরিত্র', 'প্রকাশিত', 'পত্রিকা', 'সাহিত্য', 'কাব্যগ্রন্থ', 'ছোটগল্প', 'প্রহসন', 'কাদম্বরী', 'মেঘনাদবধ'];
    if (categoryLower.includes('বাংলা') || subcatLower.includes('বাংলা')) {
      if (categoryLower.includes('সাহিত্য') || subcatLower.includes('সাহিত্য') || containsBengaliLitKeywords.some(kw => textLower.includes(kw) || explanationLower.includes(kw))) {
        return 'bengaliLit';
      }
      return 'bangla';
    }

    // 4. English Literature
    const containsEnglishLitKeywords = ['literature', 'shakespeare', 'poet', 'novel', 'drama', 'play', 'written by', 'author', 'poem', 'romantic age', 'literary', 'milton', 'keats', 'wordsworth', 'shelley', 'coleridge', 'byron', 'george bernard', 'ts eliot', 'macbeth', 'hamlet'];
    if (categoryLower.includes('ইংরেজি') || categoryLower.includes('english') || subcatLower.includes('ইংরেজি') || subcatLower.includes('english')) {
      if (categoryLower.includes('literature') || categoryLower.includes('সাহিত্য') || containsEnglishLitKeywords.some(kw => textLower.includes(kw) || explanationLower.includes(kw))) {
        return 'englishLit';
      }
      return 'english';
    }

    // 5. Bangladesh Affairs
    const containsBdKeywords = ['বাংলাদেশ', 'ঢাকা', 'বঙ্গবন্ধু', 'মুক্তিযুদ্ধ', 'ভাষা আন্দোলন', 'নদী', 'পদ্মা সেতু', 'সংবিধান', 'প্রধানমন্ত্রী', 'রাষ্ট্রপতি', 'বাজেট', 'অর্থনীতি', 'ইতিহাস', 'জাতীয়', 'সংসদ', 'বঙ্গভঙ্গ', 'মুজীব', 'মুজিব'];
    if (categoryLower.includes('বাংলাদেশ') || subcatLower.includes('বাংলাদেশ') || containsBdKeywords.some(kw => textLower.includes(kw) || explanationLower.includes(kw))) {
      return 'bdAffairs';
    }

    // 6. International Affairs
    const containsIntlKeywords = ['জাতিসংঘ', 'আন্তর্জাতিক', 'ইউক্রেন', 'রাশিয়া', 'আমেরিকা', 'চিন', 'ভারত', 'বিশ্ব', 'ইউরোপ', 'এশিয়া', 'সীমান্ত', 'চুক্তি', 'সংস্থা', 'ন্যাটো', 'nato', 'un ', 'treaty', 'border', 'capital', 'currency', 'মুদ্রা', 'রাজধানী'];
    if (categoryLower.includes('আন্তর্জাতিক') || categoryLower.includes('international') || subcatLower.includes('আন্তর্জাতিক') || containsIntlKeywords.some(kw => textLower.includes(kw) || explanationLower.includes(kw))) {
      return 'intlAffairs';
    }

    // Default GK categorization
    if (categoryLower.includes('জ্ঞান') || categoryLower.includes('gk') || subcatLower.includes('জ্ঞান')) {
      if (textLower.includes('ভারত') || textLower.includes('সীমান্ত') || textLower.includes('জাতিসংঘ') || textLower.includes('ইউক্রেন') || textLower.includes('বিশ্ব')) {
        return 'intlAffairs';
      }
      return 'bdAffairs';
    }

    if (categoryLower.includes('bangla') || categoryLower.includes('bengali')) return 'bangla';
    if (categoryLower.includes('english') || categoryLower.includes('grammar')) return 'english';
    if (categoryLower.includes('math') || categoryLower.includes('mental')) return 'math';
    
    return 'bangla';
  };

  const getFilteredManualQuestions = () => {
    let pool = questions;

    // 1. Filter by Main Zone (primary or multiple array, including hierarchical descendants)
    if (manualFilterMainCat !== 'ALL') {
      const descendants = getSubcategoryDescendants(manualFilterMainCat).map(d => d.toLowerCase());
      const lowerMain = manualFilterMainCat.toLowerCase();

      pool = pool.filter(q => {
        const qCats = q.categories && q.categories.length > 0 ? q.categories : [q.category];
        const qSubs = q.subcategories && q.subcategories.length > 0 ? q.subcategories : (q.subcategory ? [q.subcategory] : []);
        return qCats.some(c => c.toLowerCase() === lowerMain || descendants.includes(c.toLowerCase())) ||
               qSubs.some(s => s.toLowerCase() === lowerMain || descendants.includes(s.toLowerCase()));
      });
    }

    // 2. Filter by dynamic Subcategory Chain (primary or multiple array, including hierarchical descendants)
    const activeSubcatFilters = manualSubcatFilterChain.filter(s => s && s !== 'ALL');
    if (activeSubcatFilters.length > 0) {
      const deepestSub = activeSubcatFilters[activeSubcatFilters.length - 1];
      const descendants = getSubcategoryDescendants(deepestSub).map(d => d.toLowerCase());
      const lowerDeepest = deepestSub.toLowerCase();

      pool = pool.filter(q => {
        const qCats = q.categories && q.categories.length > 0 ? q.categories : [q.category];
        const qSubs = q.subcategories && q.subcategories.length > 0 ? q.subcategories : (q.subcategory ? [q.subcategory] : []);
        return qCats.some(c => c.toLowerCase() === lowerDeepest || descendants.includes(c.toLowerCase())) ||
               qSubs.some(s => s.toLowerCase() === lowerDeepest || descendants.includes(s.toLowerCase()));
      });
    }

    // 3. Search query
    if (manualSearchQuery.trim()) {
      const q = manualSearchQuery.toLowerCase();
      pool = pool.filter(item => 
        item.text.toLowerCase().includes(q) || 
        item.explanation.toLowerCase().includes(q) ||
        item.optionA.toLowerCase().includes(q) ||
        item.optionB.toLowerCase().includes(q) ||
        item.optionC.toLowerCase().includes(q) ||
        item.optionD.toLowerCase().includes(q)
      );
    }

    if (manualFilterRecommendationOnly) {
      pool = pool.filter(q => classifyQuestion(q) === activeSelectionTab);
    }

    if (manualFilterSelectionStatus === 'SELECTED') {
      const selectedList = selectedQuestionsByCategory[activeSelectionTab] || [];
      pool = pool.filter(q => selectedList.includes(q.id));
    } else if (manualFilterSelectionStatus === 'UNSELECTED') {
      const selectedList = selectedQuestionsByCategory[activeSelectionTab] || [];
      pool = pool.filter(q => !selectedList.includes(q.id));
    }

    return pool;
  };

  // Calculate total approved and pending points across the entire database
  let totalApprovedPoints = 0;
  let totalPendingPoints = 0;
  questions.forEach(q => {
    if (q.comments) {
      q.comments.forEach(c => {
        if (c.pointsApproved) {
          totalApprovedPoints += 1;
        } else {
          totalPendingPoints += 1;
        }
      });
    }
    if (q.userExplanations) {
      q.userExplanations.forEach(e => {
        if (e.pointsApproved) {
          totalApprovedPoints += 1;
        } else {
          totalPendingPoints += 1;
        }
      });
    }
  });

  // Result mapping
  const adminAttempts = attempts.filter(a => !a.examId.startsWith('prep_') && !a.examId.startsWith('job_') && !a.examId.startsWith('custom_'));
  const activeExamResults = adminAttempts.filter(a => a.examId === selectedExamIdForResults);

  const pendingFeedbackCount = (() => {
    const commentsCount = questions.reduce((acc, q) => acc + (q.comments?.filter(c => !c.pointsApproved).length || 0), 0);
    const explsCount = questions.reduce((acc, q) => acc + (q.userExplanations?.filter(e => !e.approved).length || 0), 0);
    return commentsCount + explsCount;
  })();

  const adminNavItems = [
    { id: 'dashboard', label: 'ড্যাশবোর্ড ওভারভিউ', icon: '📊', description: 'এডমিন প্যানেলের সার্বিক তথ্য ও সিস্টেম ওভারভিউ' },
    { id: 'add', label: 'প্রশ্ন যোগ করুন', icon: '📝', description: 'নতুন MCQ তৈরি বা প্রশ্ন এডিটিং' },
    { id: 'manage', label: 'প্রশ্ন ব্যাংক ম্যানেজ', icon: '📁', count: questions.length, description: 'প্রশ্ন খোঁজা, এডিট ও বাল্ক ডিলিট' },
    { id: 'categories', label: 'ক্যাটাগরি ও সাব-ক্যাটাগরি', icon: '🗂️', count: categories.length, description: 'বিষয়ভিত্তিক ট্রি স্ট্রাকচার তৈরি' },
    { id: 'exams', label: 'পরীক্ষা ও নোটিশ সেন্ট্রাল', icon: '⏱️', count: liveExams.length, description: 'লাইভ পরীক্ষা ও পপআপ নোটিশ' },
    { id: 'courses', label: 'কোর্স ম্যানেজমেন্ট', icon: '🎓', count: courses.length, description: 'চলমান ও নতুন কোর্স এবং কোর্স রুটিন ম্যানেজমেন্ট' },
    { id: 'routines', label: 'রুটিন ম্যানেজমেন্ট', icon: '📅', count: routines.length, description: 'ডেইলি/উইকলি স্টাডি রুটিন' },
    { id: 'results', label: 'পরীক্ষার ফলাফল ও মার্কস ভিউ', icon: '📈', count: adminAttempts.length, description: 'শিক্ষার্থীদের প্রাপ্ত নম্বর বিশ্লেষণ' },
    { id: 'users', label: 'নিবন্ধিত ইউজার ডাটাবেজ', icon: '👥', count: users.length, description: 'ইউজার স্ট্যাটাস ও রোল ম্যানেজ' },
    { id: 'feedback', label: 'ভুল প্রশ্ন ও ব্যাখ্যা রিভিউ', icon: '🚩', count: pendingFeedbackCount, description: 'রিপোর্ট ও ইউজার সাবমিশন অনুমোদন' },
    { id: 'audit-logs', label: 'অডিট লগ (Audit Log)', icon: '📜', count: (auditLogs || []).length, description: 'এডমিন অ্যাকশন, প্রশ্ন ডিলিট, বাল্ক আপডেট ও মডিফিকেশনের হিস্টোরি' },
    { id: 'backup', label: 'ব্যাকআপ ও রিস্টোর', icon: '📦', description: 'সিস্টেমের সম্পূর্ণ ডাটাবেজ JSON ফাইল ডাউনলোড ও রিস্টোর' },
    { id: 'firestore-migration', label: 'Firestore Migration', icon: '🔥', description: 'ফায়ারস্টোর ক্লাউড ডাটাবেজ মাইগ্রেশন, ভেরিফিকেশন ও রিপোর্ট' },
  ];

  return (
    <div className="flex flex-col gap-3.5 max-h-[95vh] overflow-y-auto max-w-full overflow-x-hidden pr-1">
      {/* Admin Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-2.5 gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl transition flex items-center gap-1.5 font-bold text-xs shrink-0"
            title="নেভিগেশন ড্রয়ার খুলুন"
          >
            <Menu className="w-5 h-5 text-indigo-600" />
            <span className="hidden sm:inline">মেনু ড্রয়ার</span>
          </button>
          <div>
            <h1 className="text-xl font-bold text-red-600 flex items-center gap-2">
              <Settings className="w-5 h-5 text-red-600 animate-spin-slow" />
              এডমিন কন্ট্রোল প্যানেল (Orjon Control Center)
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">সব প্রশ্ন, কাস্টম পরীক্ষা, রুটিন ও নোটিশ ম্যানেজ করার ওয়ান স্টপ পোর্টাল</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Cloud Sync Status Indicator */}
          <button
            id="btn-admin-cloud-sync-status-badge"
            type="button"
            onClick={() => setShowSyncModal(true)}
            className={`text-xs font-extrabold px-3.5 py-1.5 rounded-xl transition shadow-xs flex items-center gap-2 shrink-0 cursor-pointer border ${
              adminSyncStats.overallPercent === 100
                ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-300'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300 animate-pulse'
            }`}
            title="ক্লাউড সিঙ্ক স্ট্যাটাস বিস্তারিত দেখুন"
          >
            <span className={`w-2.5 h-2.5 rounded-full ${adminSyncStats.overallPercent === 100 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <Cloud className="w-4 h-4 text-indigo-600" />
            <span>ক্লাউড সিঙ্ক: <strong className="font-mono text-sm font-black">{adminSyncStats.overallPercent.toLocaleString('bn-BD')}%</strong></span>
          </button>
          <button
            onClick={() => setActiveTab('firestore-migration')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-500 text-xs font-extrabold px-3.5 py-1.5 rounded-xl transition shadow-xs flex items-center gap-1 shrink-0 cursor-pointer"
            title="Firestore Migration"
          >
            🔥 Firestore Migration
          </button>
          <button
            onClick={() => setActiveTab('backup')}
            className="bg-indigo-100 hover:bg-indigo-200 text-indigo-900 border border-indigo-200 text-xs font-extrabold px-3 py-1.5 rounded-xl transition shadow-xs flex items-center gap-1 shrink-0"
            title="ডাটাবেজ ব্যাকআপ ও রিস্টোর"
          >
            📦 ডাটাবেজ ব্যাকআপ
          </button>
          <button
            onClick={() => setIsPasswordModalOpen(true)}
            className="bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-200 text-xs font-extrabold px-3 py-1.5 rounded-xl transition shadow-xs flex items-center gap-1 shrink-0"
            title="পাসওয়ার্ড রিসেট বা পরিবর্তন করুন"
          >
            🔑 পাসওয়ার্ড পরিবর্তন
          </button>
          <button 
            onClick={onLogout}
            className="bg-gray-800 hover:bg-gray-950 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition shadow-sm shrink-0"
          >
            এডমিন ড্যাশবোর্ড থেকে বের হন ➔
          </button>
        </div>
      </div>

      {/* Admin Dashboard Navigation Drawer Overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
          />

          {/* Drawer Slide Panel */}
          <div className="fixed inset-y-0 left-0 max-w-full flex">
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="w-full max-w-[320px] bg-white shadow-2xl flex flex-col justify-between border-r border-slate-100"
            >
              {/* Drawer Header */}
              <div className="p-4 bg-gradient-to-r from-red-600 to-indigo-900 text-white flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-2.5">
                  <span className="p-1.5 bg-white/20 rounded-xl backdrop-blur-md">
                    <Settings className="w-5 h-5 text-white animate-spin-slow" />
                  </span>
                  <div>
                    <h3 className="font-extrabold text-[15.3px] text-white tracking-wide">এডমিন কন্ট্রোল সেন্টার</h3>
                    <p className="text-[10px] text-red-100 font-bold uppercase">ম্যানেজমেন্ট নেভিগেশন</p>
                  </div>
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Menu Items */}
              <div className="flex-1 overflow-y-auto p-3.5 space-y-1.5 text-xs">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-2 mb-1">
                  সকল এডমিন সেকশন ({adminNavItems.length}টি)
                </div>
                {adminNavItems.map((item) => {
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id as any);
                        setDrawerOpen(false);
                      }}
                      className={`w-full text-left p-3 rounded-xl transition duration-150 border flex items-center justify-between gap-2 ${
                        isActive
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100'
                          : 'bg-slate-50/70 hover:bg-slate-100/80 text-slate-700 border-slate-100 hover:border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl">{item.icon}</span>
                        <div>
                          <h4 className={`font-extrabold text-xs ${isActive ? 'text-white' : 'text-slate-800'}`}>
                            {item.label}
                          </h4>
                          <p className={`text-[10px] ${isActive ? 'text-indigo-100' : 'text-gray-400'}`}>
                            {item.description}
                          </p>
                        </div>
                      </div>
                      {item.count !== undefined && (
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${
                          isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {item.count.toLocaleString('bn-BD')}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Drawer Footer */}
              <div className="p-3.5 border-t border-gray-100 bg-slate-50 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDrawerOpen(false);
                    setShowSyncModal(true);
                  }}
                  className={`w-full p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                    adminSyncStats.overallPercent === 100
                      ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-200'
                      : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Cloud className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>ক্লাউড সিঙ্ক স্ট্যাটাস:</span>
                  </div>
                  <span className="font-mono font-black text-xs px-2 py-0.5 bg-white/80 rounded-full border border-gray-200 shadow-2xs">
                    {adminSyncStats.overallPercent.toLocaleString('bn-BD')}%
                  </span>
                </button>
                <button
                  onClick={() => {
                    setDrawerOpen(false);
                    onLogout();
                  }}
                  className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition text-center flex items-center justify-center gap-1.5"
                >
                  🚪 এডমিন ড্যাশবোর্ড থেকে বের হন
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      )}

      {/* Responsive Dashboard Tabs Header */}
      <div className="flex items-center gap-1 border-b pb-1 text-xs overflow-x-auto">
        <button
          onClick={() => setDrawerOpen(true)}
          className="py-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-bold flex items-center gap-1.5 shrink-0 transition"
        >
          <Menu className="w-4 h-4 text-indigo-600" />
          <span>মেনু ড্রয়ার</span>
        </button>
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={`flex-1 min-w-[90px] py-2 px-3 border-b-2 font-bold text-center transition shrink-0 ${activeTab === 'dashboard' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-indigo-600'}`}
        >
          📊 ড্যাশবোর্ড
        </button>
        <button 
          onClick={() => setActiveTab('add')}
          className={`flex-1 min-w-[90px] py-2 px-3 border-b-2 font-bold text-center transition shrink-0 ${activeTab === 'add' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-indigo-600'}`}
        >
          📝 প্রশ্ন যোগ
        </button>
        <button 
          onClick={() => setActiveTab('manage')}
          className={`flex-1 min-w-[90px] py-2 px-3 border-b-2 font-bold text-center transition shrink-0 ${activeTab === 'manage' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-indigo-600'}`}
        >
          📁 প্রশ্ন ম্যানেজ ({questions.length})
        </button>
        <button 
          onClick={() => setActiveTab('categories')}
          className={`flex-1 min-w-[90px] py-2 px-3 border-b-2 font-bold text-center transition shrink-0 ${activeTab === 'categories' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-indigo-600'}`}
        >
          🗂️ ক্যাটাগরি ও সাব-ক্যাটাগরি
        </button>
        <button 
          onClick={() => setActiveTab('exams')}
          className={`flex-1 min-w-[90px] py-2 px-3 border-b-2 font-bold text-center transition shrink-0 ${activeTab === 'exams' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-indigo-600'}`}
        >
          ⏱️ পরীক্ষা ও নোটিশ
        </button>
        <button 
          onClick={() => setActiveTab('courses')}
          className={`flex-1 min-w-[90px] py-2 px-3 border-b-2 font-bold text-center transition shrink-0 ${activeTab === 'courses' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-indigo-600'}`}
        >
          🎓 কোর্স ম্যানেজ ({courses.length})
        </button>
        <button 
          onClick={() => setActiveTab('routines')}
          className={`flex-1 min-w-[90px] py-2 px-3 border-b-2 font-bold text-center transition shrink-0 ${activeTab === 'routines' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-indigo-600'}`}
        >
          📅 রুটিন ম্যানেজ
        </button>
        <button 
          onClick={() => setActiveTab('results')}
          className={`flex-1 min-w-[90px] py-2 px-3 border-b-2 font-bold text-center transition shrink-0 ${activeTab === 'results' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-indigo-600'}`}
        >
          📈 মার্কস ভিউ ({adminAttempts.length})
        </button>
        <button 
          onClick={() => setActiveTab('users')}
          className={`flex-1 min-w-[90px] py-2 px-3 border-b-2 font-bold text-center transition shrink-0 ${activeTab === 'users' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-indigo-600'}`}
        >
          👥 ইউজার লিস্ট ({users.length})
        </button>
        <button 
          onClick={() => setActiveTab('feedback')}
          className={`flex-1 min-w-[90px] py-2 px-3 border-b-2 font-bold text-center transition shrink-0 ${activeTab === 'feedback' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-indigo-600'}`}
        >
          🚩 ভুল ও ব্যাখ্যা রিভিউ ({pendingFeedbackCount})
        </button>
        <button 
          onClick={() => setActiveTab('audit-logs')}
          className={`flex-1 min-w-[100px] py-2 px-3 border-b-2 font-bold text-center transition shrink-0 ${activeTab === 'audit-logs' ? 'border-indigo-600 text-indigo-600 font-extrabold' : 'border-transparent text-gray-500 hover:text-indigo-600'}`}
        >
          📜 অডিট লগ ({ (auditLogs || []).length })
        </button>
        <button 
          onClick={() => setActiveTab('backup')}
          className={`flex-1 min-w-[90px] py-2 px-3 border-b-2 font-bold text-center transition shrink-0 ${activeTab === 'backup' ? 'border-indigo-600 text-indigo-600 font-extrabold' : 'border-transparent text-gray-500 hover:text-indigo-600'}`}
        >
          📦 ব্যাকআপ ও রিস্টোর
        </button>
        <button 
          onClick={() => setActiveTab('firestore-migration')}
          className={`flex-1 min-w-[130px] py-2 px-3 border-b-2 font-bold text-center transition shrink-0 ${activeTab === 'firestore-migration' ? 'border-indigo-600 text-indigo-600 font-black' : 'border-transparent text-gray-500 hover:text-indigo-600'}`}
        >
          🔥 Firestore Migration
        </button>
      </div>

      {/* TAB CONTENTS / FULL PAGE HIERARCHICAL MCQ VIEW */}
      {viewingHierarchyRoutine ? (
        <RoutineHierarchicalMCQModal
          routine={viewingHierarchyRoutine}
          questions={questions}
          categories={categories}
          subcategories={subcategories}
          onClose={() => setViewingHierarchyRoutine(null)}
        />
      ) : (
        <>
          {/* 0. DASHBOARD OVERVIEW SECTION */}
          {activeTab === 'dashboard' && (
        <div className="flex flex-col gap-5 animate-fade-in">
          {/* Welcome Banner */}
          <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-red-800 rounded-2xl p-5 text-white shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-white/20 text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-white/20 uppercase">
                  সিস্টেম ওভারভিউ
                </span>
                <span className="text-xs text-indigo-200">অর্জন এডমিন কন্ট্রোল সেন্টার</span>
              </div>
              <h2 className="text-lg font-black tracking-tight">এডমিন প্যানেল ড্যাশবোর্ড সামারি</h2>
              <p className="text-xs text-indigo-100 mt-1 max-w-xl">
                প্রশ্ন ব্যাংক, লাইভ পরীক্ষা, নিবন্ধিত শিক্ষার্থী, পয়েন্ট কন্ট্রিবিউশন এবং রুটিন সিস্টেমের রিয়েল-টাইম পরিসংখ্যান পর্যবেক্ষণ করুন।
              </p>
            </div>
            <button
              onClick={() => setActiveTab('add')}
              className="bg-white hover:bg-indigo-50 text-indigo-900 font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-sm transition flex items-center gap-1.5 shrink-0"
            >
              <Plus className="w-4 h-4 text-indigo-600" />
              <span>নতুন প্রশ্ন যোগ করুন</span>
            </button>
          </div>

          {/* Cloud Sync Status & Percentage Dashboard Card */}
          <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 text-white rounded-3xl p-5 sm:p-6 border border-indigo-500/30 shadow-xl flex flex-col gap-5">
            {/* Header row */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-indigo-800/40 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-600/30 border border-indigo-400/30 rounded-2xl text-indigo-300">
                  <Cloud className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-1.5">
                      <span>ক্লাউড সিঙ্ক স্ট্যাটাস (Firebase Cloud Sync)</span>
                    </h3>
                    <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${
                      adminSyncStats.overallPercent === 100
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                    }`}>
                      {adminSyncStats.overallPercent === 100 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                      <span>{adminSyncStats.overallPercent.toLocaleString('bn-BD')}% সিঙ্কড</span>
                    </span>
                  </div>
                  <p className="text-xs text-indigo-200/90 mt-0.5">
                    অ্যাডমিনের তৈরি/আপডেট করা সকল কোর্স, রুটিন, প্রশ্ন ও অন্যান্য কনটেন্ট ক্লাউডে সুরক্ষার লাইভ পরিমাপ।
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleRefreshFirestoreCounts}
                  disabled={isCountingFirestore || isSyncingAllAdminData}
                  className="flex-1 sm:flex-none px-3.5 py-2 bg-indigo-800/50 hover:bg-indigo-700/60 border border-indigo-500/30 text-indigo-200 hover:text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="ফায়ারস্টোর লাইভ ডাটা কাউন্ট যাচাই করুন"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCountingFirestore ? 'animate-spin' : ''}`} />
                  <span>কাউন্ট রিফ্রেশ</span>
                </button>

                <button
                  type="button"
                  onClick={handleSyncAllAdminData}
                  disabled={isSyncingAllAdminData}
                  className="flex-1 sm:flex-none px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-950/40 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                  title="সকল এডমিন ডাটা ক্লাউডে সিঙ্ক করুন"
                >
                  <UploadCloud className={`w-4 h-4 ${isSyncingAllAdminData ? 'animate-bounce' : ''}`} />
                  <span>{isSyncingAllAdminData ? 'সিঙ্ক হচ্ছে...' : '⚡ ক্লাউডে সকল ডেটা সিঙ্ক করুন'}</span>
                </button>
              </div>
            </div>

            {/* Sync Progress Bar if Active */}
            {syncProgress && (
              <div className="bg-indigo-950/80 p-3.5 rounded-2xl border border-indigo-700/50 flex flex-col gap-2 animate-fade-in">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-indigo-200 flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                    <span>সিঙ্ক অগ্রগতি: {syncProgress.currentCollection}</span>
                  </span>
                  <span className="text-emerald-400 font-mono font-black">{syncProgress.percent}%</span>
                </div>
                <div className="w-full bg-slate-800/80 h-2.5 rounded-full overflow-hidden border border-indigo-900">
                  <div 
                    className="bg-gradient-to-r from-indigo-500 via-teal-400 to-emerald-400 h-full rounded-full transition-all duration-300"
                    style={{ width: `${syncProgress.percent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Main KPI Summary Gauge */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              {/* Giant Percent Display */}
              <div className="md:col-span-4 bg-indigo-950/50 border border-indigo-800/40 p-4 sm:p-5 rounded-2xl flex flex-col items-center justify-center text-center">
                <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider">
                  সার্বিক ক্লাউড সিঙ্ক হার (Overall Sync)
                </span>
                <div className="my-2 flex items-baseline gap-1">
                  <span className={`text-4xl sm:text-5xl font-black font-mono tracking-tight ${
                    adminSyncStats.overallPercent === 100 ? 'text-emerald-400' : 'text-amber-400'
                  }`}>
                    {adminSyncStats.overallPercent.toLocaleString('bn-BD')}%
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden my-1">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      adminSyncStats.overallPercent === 100 
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-400' 
                        : 'bg-gradient-to-r from-amber-500 to-emerald-400'
                    }`}
                    style={{ width: `${adminSyncStats.overallPercent}%` }}
                  />
                </div>
                <span className="text-[11px] text-indigo-200/80 mt-1">
                  {adminSyncStats.overallPercent === 100
                    ? '✅ সকল অ্যাডমিন ডেটা ক্লাউডে সুরক্ষিত ও শতভাগ সিঙ্কড'
                    : `⚠️ ${Math.max(0, adminSyncStats.totalLocal - adminSyncStats.totalSynced).toLocaleString('bn-BD')} টি ডেটা ক্লাউডে সিঙ্ক করা বাকি`}
                </span>
              </div>

              {/* Counts Breakdown Stats */}
              <div className="md:col-span-8 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className="bg-indigo-950/40 border border-indigo-800/30 p-3 rounded-xl flex flex-col justify-between">
                  <span className="text-[10px] text-indigo-300 font-bold uppercase">মোট অ্যাডমিন ডেটা</span>
                  <span className="text-xl font-black text-white mt-1">
                    {adminSyncStats.totalLocal.toLocaleString('bn-BD')} টি
                  </span>
                  <span className="text-[10px] text-gray-400">লোকাল স্টোরেজে সংরক্ষিত</span>
                </div>

                <div className="bg-indigo-950/40 border border-indigo-800/30 p-3 rounded-xl flex flex-col justify-between">
                  <span className="text-[10px] text-emerald-300 font-bold uppercase">ক্লাউডে সংরক্ষিত</span>
                  <span className="text-xl font-black text-emerald-400 mt-1">
                    {adminSyncStats.totalSynced.toLocaleString('bn-BD')} টি
                  </span>
                  <span className="text-[10px] text-emerald-400/80">Firestore লাইভ রেকর্ড</span>
                </div>

                <div className="bg-indigo-950/40 border border-indigo-800/30 p-3 rounded-xl flex flex-col justify-between col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-amber-300 font-bold uppercase">পেন্ডিং সিঙ্ক ডেটা</span>
                  <span className="text-xl font-black text-amber-400 mt-1">
                    {Math.max(0, adminSyncStats.totalLocal - adminSyncStats.totalSynced).toLocaleString('bn-BD')} টি
                  </span>
                  <span className="text-[10px] text-amber-400/80">সিঙ্ক বাটনে চাপুন</span>
                </div>
              </div>
            </div>

            {/* Individual 8 Admin Collections Grid */}
            <div>
              <div className="flex justify-between items-center mb-2 px-1">
                <span className="text-[11px] font-extrabold text-indigo-300 uppercase tracking-wider">
                  কালেকশনভিত্তিক ক্লাউড সিঙ্ক শতাংশ (Collection Breakdown):
                </span>
                <span className="text-[10px] text-indigo-400 font-mono">৮টি অ্যাডমিন কালেকশন</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
                {adminSyncStats.items.map((item) => {
                  const isSingleSyncing = syncingSingleKey === item.key;
                  return (
                    <div 
                      key={item.key}
                      className="bg-indigo-950/60 border border-indigo-800/40 hover:border-indigo-600/60 p-3 rounded-2xl flex flex-col justify-between gap-2 transition"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-1.5">
                          <span className="text-base">{item.icon}</span>
                          <div>
                            <h4 className="font-extrabold text-white text-[11.5px] leading-tight">
                              {item.name}
                            </h4>
                            <span className="text-[9.5px] text-indigo-300/70 font-mono uppercase">{item.key}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSyncSingleAdminCollection(item.key)}
                          disabled={isSingleSyncing || isSyncingAllAdminData}
                          className="p-1 text-indigo-300 hover:text-white bg-indigo-900/60 hover:bg-indigo-800 border border-indigo-700/50 rounded-lg text-[10px] font-bold transition flex items-center gap-0.5 shrink-0 cursor-pointer disabled:opacity-50"
                          title={`শুধুমাত্র ${item.name} সিঙ্ক করুন`}
                        >
                          <RefreshCw className={`w-2.5 h-2.5 ${isSingleSyncing ? 'animate-spin' : ''}`} />
                        </button>
                      </div>

                      {/* Numbers */}
                      <div className="flex items-center justify-between text-[11px] border-t border-indigo-900/50 pt-1.5">
                        <span className="text-indigo-200">
                          লোকাল: <strong className="text-white font-mono">{item.local.toLocaleString('bn-BD')}</strong>
                        </span>
                        <span className="text-indigo-200">
                          ক্লাউড: <strong className="text-emerald-400 font-mono">{item.cloud.toLocaleString('bn-BD')}</strong>
                        </span>
                      </div>

                      {/* Mini Progress Bar */}
                      <div>
                        <div className="flex justify-between items-center text-[10px] font-bold mb-1">
                          <span className={item.isFullySynced ? 'text-emerald-400' : 'text-amber-400'}>
                            {item.isFullySynced ? 'সিঙ্কড' : 'পেন্ডিং'}
                          </span>
                          <span className="font-mono text-white font-extrabold">{item.percent.toLocaleString('bn-BD')}%</span>
                        </div>
                        <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-300 ${
                              item.isFullySynced ? 'bg-emerald-400' : 'bg-amber-400'
                            }`}
                            style={{ width: `${item.percent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Core System Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div 
              onClick={() => setActiveTab('users')}
              className="bg-white hover:bg-indigo-50/50 p-4 rounded-2xl border border-gray-100 shadow-xs cursor-pointer transition flex flex-col justify-between"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">শিক্ষার্থী ডাটাবেজ</span>
                <span className="text-xl">👥</span>
              </div>
              <div>
                <span className="text-2xl font-black text-indigo-950 block">{users.length.toLocaleString('bn-BD')}</span>
                <span className="text-[10px] text-indigo-600 font-semibold">নিবন্ধিত শিক্ষার্থী ➔</span>
              </div>
            </div>

            <div 
              onClick={() => setActiveTab('manage')}
              className="bg-white hover:bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 shadow-xs cursor-pointer transition flex flex-col justify-between"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  প্রশ্ন ভান্ডার (Firestore)
                </span>
                <span className="text-xl">📁</span>
              </div>
              <div>
                <span className="text-2xl font-black text-indigo-950 block">
                  {(firestoreCounts?.questions ?? questions.length).toLocaleString('bn-BD')}
                </span>
                <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                  ফায়ারস্টোর "questions" লাইভ ডাটা ➔
                </span>
              </div>
            </div>

            <div 
              onClick={() => setActiveTab('categories')}
              className="bg-white hover:bg-indigo-50/50 p-4 rounded-2xl border border-gray-100 shadow-xs cursor-pointer transition flex flex-col justify-between"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">ক্যাটাগরি ট্রি</span>
                <span className="text-xl">🗂️</span>
              </div>
              <div>
                <span className="text-2xl font-black text-indigo-950 block">{categories.length.toLocaleString('bn-BD')}</span>
                <span className="text-[10px] text-indigo-600 font-semibold">ক্যাটাগরি গ্রুপ ➔</span>
              </div>
            </div>

            <div 
              onClick={() => setActiveTab('exams')}
              className="bg-white hover:bg-indigo-50/50 p-4 rounded-2xl border border-gray-100 shadow-xs cursor-pointer transition flex flex-col justify-between"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">লাইভ পরীক্ষা</span>
                <span className="text-xl">⏱️</span>
              </div>
              <div>
                <span className="text-2xl font-black text-indigo-950 block">{liveExams.length.toLocaleString('bn-BD')}</span>
                <span className="text-[10px] text-indigo-600 font-semibold">চলমান পরীক্ষা ➔</span>
              </div>
            </div>

            <div 
              onClick={() => setActiveTab('routines')}
              className="bg-white hover:bg-indigo-50/50 p-4 rounded-2xl border border-gray-100 shadow-xs cursor-pointer transition flex flex-col justify-between"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">স্টাডি রুটিন</span>
                <span className="text-xl">📅</span>
              </div>
              <div>
                <span className="text-2xl font-black text-indigo-950 block">{routines.length.toLocaleString('bn-BD')}</span>
                <span className="text-[10px] text-indigo-600 font-semibold">সক্রিয় সূচি ➔</span>
              </div>
            </div>

            <div 
              onClick={() => setActiveTab('results')}
              className="bg-white hover:bg-indigo-50/50 p-4 rounded-2xl border border-gray-100 shadow-xs cursor-pointer transition flex flex-col justify-between"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">পরীক্ষার মার্কস</span>
                <span className="text-xl">📈</span>
              </div>
              <div>
                <span className="text-2xl font-black text-indigo-950 block">{adminAttempts.length.toLocaleString('bn-BD')}</span>
                <span className="text-[10px] text-indigo-600 font-semibold">মোট সাবমিশন ➔</span>
              </div>
            </div>

            <div 
              onClick={() => setActiveTab('feedback')}
              className="bg-white hover:bg-amber-50/50 p-4 rounded-2xl border border-amber-100 shadow-xs cursor-pointer transition flex flex-col justify-between"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">রিভিউ ও রিপোর্ট</span>
                <span className="text-xl">🚩</span>
              </div>
              <div>
                <span className="text-2xl font-black text-amber-700 block">{pendingFeedbackCount.toLocaleString('bn-BD')}</span>
                <span className="text-[10px] text-amber-800 font-semibold">পেন্ডিং আইটেম ➔</span>
              </div>
            </div>

            <div 
              onClick={() => setActiveTab('feedback')}
              className="bg-white hover:bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 shadow-xs cursor-pointer transition flex flex-col justify-between"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">কন্ট্রিবিউশন পয়েন্ট</span>
                <span className="text-xl">🪙</span>
              </div>
              <div>
                <span className="text-2xl font-black text-emerald-700 block">{totalApprovedPoints.toLocaleString('bn-BD')}</span>
                <span className="text-[10px] text-emerald-800 font-semibold">অনুমোদিত পয়েন্ট ➔</span>
              </div>
            </div>

            <div 
              onClick={() => setActiveTab('audit-logs')}
              className="bg-white hover:bg-purple-50/50 p-4 rounded-2xl border border-purple-100 shadow-xs cursor-pointer transition flex flex-col justify-between"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-purple-900 uppercase tracking-wider">অডিট লগ (Audit Log)</span>
                <span className="text-xl">📜</span>
              </div>
              <div>
                <span className="text-2xl font-black text-purple-950 block">{(auditLogs || []).length.toLocaleString('bn-BD')}</span>
                <span className="text-[10px] text-purple-700 font-semibold">এডমিন অ্যাকশন হিস্টোরি ➔</span>
              </div>
            </div>

            <div 
              onClick={() => setActiveTab('backup')}
              className="bg-white hover:bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 shadow-xs cursor-pointer transition flex flex-col justify-between"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider">ডাটাবেজ ব্যাকআপ</span>
                <span className="text-xl">📦</span>
              </div>
              <div>
                <span className="text-sm font-extrabold text-indigo-950 block">ব্যাকআপ ডাউনলোড/রিস্টোর</span>
                <span className="text-[10px] text-indigo-600 font-semibold">JSON ব্যাকআপ ফাইল ➔</span>
              </div>
            </div>
          </div>

          {/* Recent User Growth Chart */}
          <UserGrowthChart users={users} />

          {/* Quick Management Shortcuts & Insights */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Category Distribution Breakdown */}
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-extrabold text-xs text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                    <FolderTree className="w-4 h-4 text-indigo-600" />
                    ক্যাটাগরি অনুযায়ী প্রশ্ন বণ্টন
                  </h3>
                  <button
                    onClick={() => setActiveTab('categories')}
                    className="text-[10px] font-bold text-indigo-600 hover:underline"
                  >
                    সকল ক্যাটাগরি ➔
                  </button>
                </div>

                <div className="space-y-2.5">
                  {(categories || []).slice(0, 6).map((catItem) => {
                    const catName = typeof catItem === 'string' ? catItem : catItem.name;
                    const catKey = typeof catItem === 'string' ? catItem : catItem.id || catItem.name;
                    const count = questions.filter(q => q.category === catName).length;
                    const pct = questions.length > 0 ? Math.round((count / questions.length) * 100) : 0;
                    return (
                      <div key={catKey} className="space-y-1">
                        <div className="flex justify-between text-xs font-bold text-slate-700">
                          <span>{catName}</span>
                          <span className="text-indigo-600">{count.toLocaleString('bn-BD')}টি ({pct.toLocaleString('bn-BD')}%)</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div 
                            className="bg-gradient-to-r from-indigo-500 to-indigo-700 h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(pct, 3)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Quick Actions Shortcuts */}
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs flex flex-col justify-between">
              <div>
                <h3 className="font-extrabold text-xs text-gray-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  এডমিন দ্রুত নেভিগেশন মডিউল
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    onClick={() => setActiveTab('add')}
                    className="p-3 bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-100 rounded-xl text-left transition flex items-center gap-2.5"
                  >
                    <span className="text-2xl">📝</span>
                    <div>
                      <h4 className="font-extrabold text-xs text-indigo-950">প্রশ্ন যোগ</h4>
                      <p className="text-[9px] text-indigo-700">MCQ এন্ট্রি ও টাইপিং</p>
                    </div>
                  </button>

                  <button
                    onClick={() => setActiveTab('manage')}
                    className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-xl text-left transition flex items-center gap-2.5"
                  >
                    <span className="text-2xl">📁</span>
                    <div>
                      <h4 className="font-extrabold text-xs text-slate-900">প্রশ্ন ব্যাংক</h4>
                      <p className="text-[9px] text-slate-500">ডাটাবেজ সার্চ ও ফিল্টার</p>
                    </div>
                  </button>

                  <button
                    onClick={() => setActiveTab('exams')}
                    className="p-3 bg-amber-50 hover:bg-amber-100/80 border border-amber-100 rounded-xl text-left transition flex items-center gap-2.5"
                  >
                    <span className="text-2xl">⏱️</span>
                    <div>
                      <h4 className="font-extrabold text-xs text-amber-950">পরীক্ষা ও নোটিশ</h4>
                      <p className="text-[9px] text-amber-800">মক টেস্ট ও পপআপ</p>
                    </div>
                  </button>

                  <button
                    onClick={() => setActiveTab('feedback')}
                    className="p-3 bg-rose-50 hover:bg-rose-100/80 border border-rose-100 rounded-xl text-left transition flex items-center gap-2.5"
                  >
                    <span className="text-2xl">🚩</span>
                    <div>
                      <h4 className="font-extrabold text-xs text-rose-950">ভুল প্রশ্ন রিভিউ</h4>
                      <p className="text-[9px] text-rose-800">রিপোর্ট ও পয়েন্ট অ্যাপ্রুভ</p>
                    </div>
                  </button>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center text-[10px] text-gray-400 font-bold">
                <span>অর্জন সিকিউর এডমিন ইঞ্জিন v2.5</span>
                <span className="text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  সিস্টেম স্ট্যাটাস: অনলাইন
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 1. ADD / EDIT QUESTION */}
      {activeTab === 'add' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Add Form */}
          <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <h2 className="font-bold text-sm text-gray-800 mb-4 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-indigo-600" />
              {editingId ? '✏️ প্রশ্নটি এডিট করুন' : '📝 নতুন প্রশ্ন টাইপ করুন'}
            </h2>
            <form onSubmit={handleSaveQuestion} className="space-y-4 text-xs">
              <div>
                <label className="block text-gray-600 mb-1 font-medium">প্রশ্নটি লিখুন (Bangla/English):</label>
                <textarea 
                  rows={2} 
                  required
                  value={text}
                  onChange={e => setText(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500 text-gray-800 focus:outline-none" 
                  placeholder="যেমন: বাংলাদেশের সবচেয়ে ছোট জেলা কোনটি?"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-600 mb-1 font-medium">অপশন A (ক):</label>
                  <input 
                    type="text" 
                    required
                    value={optionA}
                    onChange={e => setOptionA(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-gray-800 focus:outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1 font-medium">অপশন B (খ):</label>
                  <input 
                    type="text" 
                    required
                    value={optionB}
                    onChange={e => setOptionB(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-gray-800 focus:outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1 font-medium">অপশন C (গ):</label>
                  <input 
                    type="text" 
                    required
                    value={optionC}
                    onChange={e => setOptionC(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-gray-800 focus:outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1 font-medium">অপশন D (ঘ):</label>
                  <input 
                    type="text" 
                    required
                    value={optionD}
                    onChange={e => setOptionD(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-gray-800 focus:outline-none" 
                  />
                </div>
              </div>

              <div className="bg-indigo-50/40 p-4 rounded-xl border border-indigo-100/50">
                <label className="block text-gray-700 mb-1.5 font-bold">সঠিক উত্তর নির্বাচন করুন:</label>
                <select 
                  value={correct}
                  onChange={e => setCorrect(e.target.value as any)}
                  className="w-full px-3 py-2 border border-indigo-200 rounded-xl bg-white text-gray-800 focus:outline-none text-xs font-semibold focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="Option A">Option A (ক)</option>
                  <option value="Option B">Option B (খ)</option>
                  <option value="Option C">Option C (গ)</option>
                  <option value="Option D">Option D (ঘ)</option>
                </select>
              </div>

              {/* Category & Subcategory Selection Zone */}
              <div className="space-y-3.5">
                {/* Mode Toggle Button if they want to write something custom */}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (isCustomCategory || isCustomSubcategory) {
                        setIsCustomCategory(false);
                        setIsCustomSubcategory(false);
                      } else {
                        setIsCustomCategory(true);
                      }
                    }}
                    className="text-[10px] text-indigo-600 hover:text-indigo-800 font-extrabold flex items-center gap-1 transition"
                  >
                    {isCustomCategory || isCustomSubcategory 
                      ? '🔄 ক্যাসকেডিং সিলেকশনে ফিরে যান' 
                      : '➕ নতুন/কাস্টম ক্যাটাগরি বা সাব-ক্যাটাগরি তৈরি করুন'}
                  </button>
                </div>

                {/* 1. Cascading Filter Selection (Standard Mode) */}
                {!isCustomCategory && !isCustomSubcategory ? (
                  <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/50 space-y-3.5">
                    <div className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                      <FolderTree className="w-4 h-4 text-indigo-600" />
                      ধাপভিত্তিক ক্যাসকেডিং গন্তব্য নির্বাচন (Cascading Destination):
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      {/* Level 1: Main Category */}
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1 font-bold">মূল ক্যাটাগরি:</label>
                        <select 
                          value={category}
                          onChange={e => {
                            const val = e.target.value;
                            setCategory(val);
                            setAddFormSubcatChain([]);
                            setSubcategory('');
                            if (val && !selectedCategories.includes(val)) {
                              setSelectedCategories([val]);
                            }
                            setSelectedSubcategories([]);
                          }}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-gray-750 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition text-xs font-semibold"
                        >
                          {distinctCategories.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>

                      {/* Level 2+: Subcategory Cascading selection */}
                      {(() => {
                        const selectBoxes: React.ReactNode[] = [];
                        const maxDepth = addFormSubcatChain.length;

                        for (let i = 0; i <= maxDepth; i++) {
                          let options: SubcategoryItem[] = [];

                          if (i === 0) {
                            if (isJobSolutionVariation(category)) {
                              options = subcategories.filter(s => isJobSolutionVariation(s.parentCategory));
                            } else if (isYearJobSolutionVariation(category)) {
                              options = subcategories.filter(s => isYearJobSolutionVariation(s.parentCategory));
                            } else {
                              options = subcategories.filter(s => s.parentCategory === category);
                            }
                          } else {
                            const parentVal = addFormSubcatChain[i - 1];
                            if (parentVal && parentVal !== 'ALL') {
                              options = subcategories.filter(s => s.parentCategory === parentVal);
                            }
                          }

                          if (options.length === 0) continue;

                          const currentSelection = addFormSubcatChain[i] || 'ALL';

                          selectBoxes.push(
                            <div key={`add-cascade-level-${i}`}>
                              <label className="block text-[10px] text-gray-500 mb-1 font-bold">
                                {i === 0 ? 'উপ-ক্যাটাগরি / পরীক্ষা (ধাপ ১):' : `সাব-ক্যাটাগরি ধাপ ${i + 1}:`}
                              </label>
                              <select
                                value={currentSelection}
                                onChange={e => {
                                  const val = e.target.value;
                                  const newChain = [...addFormSubcatChain];
                                  if (val === 'ALL') {
                                    newChain.splice(i);
                                  } else {
                                    newChain[i] = val;
                                    newChain.splice(i + 1);
                                  }
                                  setAddFormSubcatChain(newChain);
                                  
                                  // Set the deepest subcategory
                                  const activeSubs = newChain.filter(s => s && s !== 'ALL');
                                  if (activeSubs.length > 0) {
                                    const deepest = activeSubs[activeSubs.length - 1];
                                    setSubcategory(deepest);
                                    setSelectedSubcategories([deepest]);
                                  } else {
                                    setSubcategory('');
                                    setSelectedSubcategories([]);
                                  }
                                }}
                                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-gray-750 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition text-xs font-semibold"
                              >
                                <option value="ALL">--- সিলেক্ট করুন (ঐচ্ছিক) ---</option>
                                {options.map((s, idx) => <option key={`opt-sel1-${s.id}-${idx}`} value={s.name}>{s.name}</option>)}
                              </select>
                            </div>
                          );
                        }

                        return selectBoxes;
                      })()}
                    </div>
                  </div>
                ) : (
                  // 2. Custom Creation Mode (Legacy Mode)
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-amber-50/40 p-4 rounded-xl border border-amber-200/50">
                    {/* Custom Category section */}
                    <div>
                      <label className="block text-gray-600 mb-1 font-medium">ক্যাটাগরি নির্ধারণ করুন:</label>
                      <div className="flex gap-2">
                        <select 
                          disabled={isCustomCategory}
                          value={category}
                          onChange={e => {
                            const val = e.target.value;
                            setCategory(val);
                            if (val && !selectedCategories.includes(val)) {
                              setSelectedCategories([...selectedCategories, val]);
                            }
                          }}
                          className="flex-grow px-3 py-1.5 border rounded-xl bg-white text-gray-800 text-xs focus:outline-none disabled:bg-gray-100"
                        >
                          {distinctCategories.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                        <button 
                          type="button"
                          onClick={() => setIsCustomCategory(!isCustomCategory)}
                          className="shrink-0 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-2.5 py-1.5 rounded-xl border text-[10px]"
                        >
                          {isCustomCategory ? 'লিস্ট ভিউ' : '➕ নতুন লিখুন'}
                        </button>
                      </div>
                      {isCustomCategory && (
                        <input 
                          type="text"
                          required
                          value={customCategory}
                          onChange={e => setCustomCategory(e.target.value)}
                          placeholder="নতুন ক্যাটাগরির নাম লিখুন"
                          className="w-full px-3 py-1.5 border rounded-xl mt-2 text-gray-800 text-xs focus:outline-none"
                        />
                      )}
                    </div>

                    {/* Custom Subcategory section */}
                    <div>
                      <label className="block text-gray-600 mb-1 font-medium">সাব-ক্যাটাগরি নির্ধারণ করুন:</label>
                      <div className="flex gap-2">
                        <select 
                          disabled={isCustomSubcategory}
                          value={subcategory}
                          onChange={e => {
                            const val = e.target.value;
                            setSubcategory(val);
                            if (val && !selectedSubcategories.includes(val)) {
                              setSelectedSubcategories([...selectedSubcategories, val]);
                            }
                          }}
                          className="flex-grow px-3 py-1.5 border rounded-xl bg-white text-gray-800 text-xs focus:outline-none disabled:bg-gray-100"
                        >
                          <option value="">(কোনোটিই নয়)</option>
                          {distinctSubcategories.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                        <button 
                          type="button"
                          onClick={() => setIsCustomSubcategory(!isCustomSubcategory)}
                          className="shrink-0 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-2.5 py-1.5 rounded-xl border text-[10px]"
                        >
                          {isCustomSubcategory ? 'লিস্ট ভিউ' : '➕ নতুন লিখুন'}
                        </button>
                      </div>
                      {isCustomSubcategory && (
                        <input 
                          type="text" 
                          required
                          value={customSubcategory}
                          onChange={e => setCustomSubcategory(e.target.value)}
                          placeholder="নতুন সাব-ক্যাটাগরির নাম লিখুন" 
                          className="w-full px-3 py-1.5 border rounded-xl mt-2 text-gray-800 text-xs focus:outline-none" 
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Multi-category and Multi-subcategory mapping lists */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-150">
                <div>
                  <label className="block text-gray-700 mb-1 font-extrabold text-[10px] uppercase tracking-wider text-indigo-950">
                    🔗 লিংক করা ক্যাটাগরি সমূহ (MCQ linked Categories):
                  </label>
                  <p className="text-[9px] text-gray-400 mb-2 font-medium">এই প্রশ্নটি এক বা একাধিক বিষয়ের সাথে সংযুক্ত করতে পারেন:</p>
                  <div className="max-h-[140px] overflow-y-auto border border-gray-200 rounded-xl bg-white p-2.5 space-y-1.5">
                    {distinctCategories.map(c => {
                      const isChecked = selectedCategories.includes(c);
                      return (
                        <label key={c} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50/50 p-1 rounded-md transition text-xs font-semibold text-gray-700">
                          <input 
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelectedCategory(c)}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                          />
                          <span>{c}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-gray-700 mb-1 font-extrabold text-[10px] uppercase tracking-wider text-emerald-950">
                    🔗 লিংক করা সাব-ক্যাটাগরি সমূহ (MCQ linked Subcategories):
                  </label>
                  <p className="text-[9px] text-gray-400 mb-2 font-medium">এই প্রশ্নটি এক বা একাধিক পরীক্ষার সাথে সংযুক্ত করতে পারেন:</p>
                  <div className="max-h-[140px] overflow-y-auto border border-gray-200 rounded-xl bg-white p-2.5 space-y-1.5">
                    {distinctSubcategories.map(s => {
                      const isChecked = selectedSubcategories.includes(s);
                      return (
                        <label key={s} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50/50 p-1 rounded-md transition text-xs font-semibold text-gray-700">
                          <input 
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelectedSubcategory(s)}
                            className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                          />
                          <span>{s}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-gray-600 mb-1 font-medium">প্রশ্নের ব্যাখ্যামূলক উত্তর (উত্তর সঠিক হবার কারণ):</label>
                <textarea 
                  rows={2} 
                  value={explanation}
                  onChange={e => setExplanation(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl text-gray-800 focus:outline-none" 
                  placeholder="পরীক্ষার্থীদের বুঝার সুবিধার্থে বিস্তারিত ব্যাখ্যা দিন..."
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  type="submit"
                  className="flex-grow bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-md transition"
                >
                  {editingId ? '💾 আপডেট তথ্য সেভ করুন' : '🚀 ডাটাবেসে সেভ করুন'}
                </button>
                {editingId && (
                  <button 
                    type="button"
                    onClick={handleCancelEdit}
                    className="bg-gray-300 hover:bg-gray-400 text-gray-700 font-bold px-4 rounded-xl transition"
                  >
                    বাতিল
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Bulk Upload Block */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            <div className="bg-indigo-50 p-5 rounded-2xl border border-indigo-100/80 space-y-4">
              <h3 className="font-bold text-sm text-indigo-900 flex items-center gap-1.5">
                <Upload className="w-4 h-4 text-indigo-700" />
                📁 এক্সেল বা CSV ফাইল আপলোড
              </h3>
              
              <p className="text-[10px] text-gray-600 leading-relaxed bg-white p-2.5 rounded-xl border border-indigo-150/60">
                আপনার তৈরি করা CSV ফাইল আপলোড করুন। ফাইলের হেডারগুলো অবশ্যই এই ক্রমানুসারে হতে হবে:
                <code className="block text-pink-600 font-mono font-bold text-[9px] bg-pink-50 p-1.5 rounded-md border border-pink-100 mt-1 break-all select-all">
                  text, optionA, optionB, optionC, optionD, correct, explanation, category, subcategory
                </code>
              </p>

              {/* Cascading Filter Destination for CSV Upload */}
              <div className="bg-white/70 p-3 rounded-xl border border-indigo-100/60 space-y-3">
                <div className="text-[10px] font-bold text-indigo-950 flex items-center gap-1 uppercase tracking-wider">
                  <FolderTree className="w-3.5 h-3.5 text-indigo-600" />
                  আপলোড গন্তব্য নির্ধারণ (Cascading Destination):
                </div>

                <div className="grid grid-cols-1 gap-2.5 text-xs">
                  {/* Category Dropdown */}
                  <div>
                    <label className="block text-[9px] text-gray-500 mb-0.5 font-bold">মূল ক্যাটাগরি:</label>
                    <select 
                      value={uploadDestCat}
                      onChange={e => {
                        setUploadDestCat(e.target.value);
                        setUploadDestSubcatChain([]);
                      }}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg bg-white text-gray-750 focus:outline-none text-xs font-semibold"
                    >
                      {distinctCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  {/* Cascading Subcategory Chain */}
                  {(() => {
                    const selectBoxes: React.ReactNode[] = [];
                    const maxDepth = uploadDestSubcatChain.length;

                    for (let i = 0; i <= maxDepth; i++) {
                      let options: SubcategoryItem[] = [];

                      if (i === 0) {
                        if (isJobSolutionVariation(uploadDestCat)) {
                          options = subcategories.filter(s => isJobSolutionVariation(s.parentCategory));
                        } else if (isYearJobSolutionVariation(uploadDestCat)) {
                          options = subcategories.filter(s => isYearJobSolutionVariation(s.parentCategory));
                        } else {
                          options = subcategories.filter(s => s.parentCategory === uploadDestCat);
                        }
                      } else {
                        const parentVal = uploadDestSubcatChain[i - 1];
                        if (parentVal && parentVal !== 'ALL') {
                          options = subcategories.filter(s => s.parentCategory === parentVal);
                        }
                      }

                      if (options.length === 0) continue;

                      const currentSelection = uploadDestSubcatChain[i] || 'ALL';

                      selectBoxes.push(
                        <div key={`upload-cascade-level-${i}`}>
                          <label className="block text-[9px] text-gray-500 mb-0.5 font-bold">
                            {i === 0 ? 'উপ-ক্যাটাগরি / পরীক্ষা (ধাপ ১):' : `সাব-ক্যাটাগরি ধাপ ${i + 1}:`}
                          </label>
                          <select
                            value={currentSelection}
                            onChange={e => {
                              const val = e.target.value;
                              const newChain = [...uploadDestSubcatChain];
                              if (val === 'ALL') {
                                newChain.splice(i);
                              } else {
                                newChain[i] = val;
                                newChain.splice(i + 1);
                              }
                              setUploadDestSubcatChain(newChain);
                            }}
                            className="w-full px-2 py-1.5 border border-slate-200 rounded-lg bg-white text-gray-750 focus:outline-none text-xs font-semibold"
                          >
                            <option value="ALL">--- সিলেক্ট করুন (ঐচ্ছিক) ---</option>
                            {options.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                          </select>
                        </div>
                      );
                    }

                    return selectBoxes;
                  })()}

                  {/* Override Mode Toggle */}
                  <label className="flex items-center gap-2 cursor-pointer mt-1 bg-indigo-50/50 p-2 rounded-lg border border-indigo-100/30">
                    <input 
                      type="checkbox"
                      checked={overrideCSVCategory}
                      onChange={e => setOverrideCSVCategory(e.target.checked)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                    />
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-indigo-950">ফাইলের ভেতরের ক্যাটাগরি ওভাররাইড করুন</span>
                      <span className="text-[8px] text-gray-500">অন থাকলে সব প্রশ্নই এই নির্বাচিত গন্তব্যে যুক্ত হবে।</span>
                    </div>
                  </label>

                  {/* Dual Destination & Subject Auto Mapping Toggle */}
                  <label className="flex items-start gap-2 cursor-pointer mt-1 bg-emerald-50/70 hover:bg-emerald-50 p-2.5 rounded-xl border border-emerald-200/80 transition">
                    <input 
                      type="checkbox"
                      checked={enableSubjectAutoMap}
                      onChange={e => setEnableSubjectAutoMap(e.target.checked)}
                      className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 mt-0.5 cursor-pointer"
                    />
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-extrabold text-emerald-950 flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        বিষয়ভিত্তিক প্রস্তুতি জোনে অটো-ম্যাপিং ও নতুন সাব-ক্যাটাগরি তৈরি
                      </span>
                      <span className="text-[8.5px] text-emerald-800 leading-snug">
                        {enableSubjectAutoMap ? (
                          <span>
                            ✅ <strong>অন:</strong> কুইজগুলো সিলেক্টেড গন্তব্যের (যেমন: <em>{uploadDestCat} ➔ ...</em>) পাশাপাশি CSV ফাইলের বিষয় ও সাব-ক্যাটাগরি অনুযায়ী <strong>বিষয়ভিত্তিক প্রস্তুতি জোনে (যেমন: বিষয়ভিত্তিক প্রস্তুতি জোন ➔ বাংলা ব্যাকরণ ➔ সমাস)</strong> অটো-ম্যাপিং ও অনুপস্থিত সাব-ক্যাটাগরি অটো-তৈরি করে উভয় স্থানে যুক্ত হবে।
                          </span>
                        ) : (
                          <span>
                            ❌ <strong>অফ:</strong> কুইজগুলো শুধুমাত্র উপরে সিলেক্টেড গন্তব্যে (যেমন: <em>{uploadDestCat} ➔ ...</em>) আপলোড হবে।
                          </span>
                        )}
                      </span>
                    </div>
                  </label>

                  {/* Validation Toggle */}
                  <label className="flex items-center gap-2 cursor-pointer mt-1 bg-rose-50/40 p-2 rounded-lg border border-rose-100/20">
                    <input 
                      type="checkbox"
                      checked={enableCsvValidation}
                      onChange={e => {
                        setEnableCsvValidation(e.target.checked);
                        // Reset errors when validation is disabled
                        if (!e.target.checked) {
                          setCsvFileError('');
                          setCsvValidationErrors([]);
                        }
                      }}
                      className="rounded border-gray-300 text-rose-600 focus:ring-rose-500 w-3.5 h-3.5"
                    />
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-rose-950">ডেটা ভ্যালিডেশন সক্রিয় রাখুন (অন)</span>
                      <span className="text-[8px] text-gray-500">অফ থাকলে কোনো ভুল বা খালি ঘর থাকলেও অটো ডিফল্ট তথ্যে প্রশ্ন আপলোড হবে।</span>
                    </div>
                  </label>

                  {/* Strict Mapping Validation Toggle */}
                  <label className="flex items-start gap-2 cursor-pointer mt-1 bg-amber-50/70 hover:bg-amber-50 p-2.5 rounded-xl border border-amber-200/80 transition">
                    <input 
                      type="checkbox"
                      checked={enableStrictMappingCheck}
                      onChange={e => setEnableStrictMappingCheck(e.target.checked)}
                      className="rounded border-gray-300 text-amber-600 focus:ring-amber-500 w-4 h-4 mt-0.5 cursor-pointer"
                    />
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-extrabold text-amber-950 flex items-center gap-1">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        স্ট্রিক্ট ক্যাটাগরি ও সাব-ক্যাটাগরি ম্যাপিং ভ্যালিডেশন
                      </span>
                      <span className="text-[8.5px] text-amber-800 leading-snug">
                        {enableStrictMappingCheck ? (
                          <span>
                            ✅ <strong>অন:</strong> ফাইলে থাকা ক্যাটাগরি/সাব-ক্যাটাগরি ডাটাবেসের সাথে না মিললে সতর্কবার্তা প্রদর্শন ও পর্যালোচনা (Mapping Review) বাধ্যতামূলক হবে।
                          </span>
                        ) : (
                          <span>
                            ❌ <strong>অফ:</strong> অসংগতিপূর্ণ ক্যাটাগরি/সাব-ক্যাটাগরি থাকলেও কোনো সতর্কতা ছাড়াই সরাসরি অটো ম্যাপিং অথবা ডিফল্ট গন্তব্যে আপলোড হবে।
                          </span>
                        )}
                      </span>
                    </div>
                  </label>

                  {/* Text Qualifier Selector */}
                  <div className="mt-1 bg-slate-50 p-2 rounded-lg border border-slate-200/80">
                    <label className="block text-[10px] font-extrabold text-slate-800 mb-1">
                      টেক্সট কোয়ালিফায়ার (Text Qualifier):
                    </label>
                    <select
                      value={textQualifier}
                      onChange={e => {
                        const newQual = e.target.value;
                        setTextQualifier(newQual);
                        if (rawCSVContent) {
                          try {
                            setCsvFileError('');
                            setCsvValidationErrors([]);
                            const parsed = parseCSV(rawCSVContent, newQual);
                            setPendingQuestions(parsed);
                          } catch (err: any) {
                            if (err.validationErrors) {
                              setCsvValidationErrors(err.validationErrors);
                              setCsvFileError('ফাইলের ভেতরে ভ্যালিডেশন সমস্যা পাওয়া গেছে।');
                            } else {
                              setCsvFileError(err.message || 'পার্সিং ব্যর্থ হয়েছে');
                            }
                            setPendingQuestions([]);
                          }
                        } else if (csvText) {
                          try {
                            setCsvFileError('');
                            setCsvValidationErrors([]);
                            parseCSV(csvText, newQual);
                          } catch (err: any) {
                            if (err.validationErrors) {
                              setCsvValidationErrors(err.validationErrors);
                            }
                          }
                        }
                      }}
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg bg-white text-gray-800 focus:outline-none text-xs font-semibold"
                    >
                      <option value='"'>" (Double Quote / ডাবল কোট - ডিফল্ট)</option>
                      <option value="'">' (Single Quote / সিঙ্গেল কোট)</option>
                      <option value="none">None (কোনোটিই নয় / নো কোয়ালিফায়ার)</option>
                      <option value="auto">Auto Detect (অটো ডিটেক্ট)</option>
                    </select>
                    <span className="text-[8px] text-gray-500 block mt-1 leading-tight">
                      কমাযুক্ত টেক্সটের দুই পাশে থাকা কোট বা চিহ্ন চিহ্নিত করতে ব্যবহৃত হয়।
                    </span>
                  </div>
                </div>
              </div>
              
              {/* File input selection */}
              <div className="space-y-2">
                <label className="block text-[10px] text-gray-700 font-bold mb-1">CSV ফাইল আপলোড করুন:</label>
                <input 
                  type="file" 
                  id="csv-file-input"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => document.getElementById('csv-file-input')?.click()}
                  className="w-full py-3.5 px-4 bg-white hover:bg-indigo-50/80 border-2 border-dashed border-indigo-300 hover:border-indigo-600 rounded-2xl flex items-center justify-center gap-2.5 text-indigo-800 font-extrabold text-xs transition cursor-pointer shadow-sm group"
                >
                  <Upload className="w-4 h-4 text-indigo-600 group-hover:scale-110 transition-transform" />
                  <span>📁 CSV ফাইল সিলেক্ট / আপলোড করুন</span>
                </button>
              </div>

              {/* Preview and Confirmation Trigger */}
              {pendingCSVFile && (
                <div className="bg-emerald-50/75 p-3 rounded-xl border border-emerald-150 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-emerald-950 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ফাইল প্রস্তুত!
                    </span>
                    <button 
                      type="button"
                      onClick={() => {
                        setPendingCSVFile(null);
                        setPendingQuestions([]);
                        const inp = document.getElementById('csv-file-input') as HTMLInputElement | null;
                        if (inp) inp.value = '';
                      }}
                      className="text-gray-400 hover:text-rose-600 transition animate-pulse"
                      title="ফাইল বাদ দিন"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="text-[10px] text-gray-600 space-y-0.5">
                    <div>📁 <span className="font-semibold text-gray-800">নাম:</span> {pendingCSVFile.name}</div>
                    <div>📊 <span className="font-semibold text-gray-800">প্রশ্ন সংখ্যা:</span> {pendingQuestions.length} টি</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowUploadConfirm(true)}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg text-xs transition shadow-sm shadow-emerald-600/10 cursor-pointer"
                  >
                    🚀 ফাইল আপলোড নিশ্চিত করুন
                  </button>
                </div>
              )}

              {/* Non-Matching Paths Indicator & Breakdown Card */}
              {pendingQuestions.length > 0 && nonMatchingPathDetails.length > 0 && (
                <div className={`p-3.5 rounded-2xl border transition shadow-xs space-y-2.5 ${
                  enableStrictMappingCheck 
                    ? 'bg-rose-50/90 border-rose-200 text-rose-950' 
                    : 'bg-amber-50/90 border-amber-200 text-amber-950'
                }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className={`w-5 h-5 shrink-0 ${enableStrictMappingCheck ? 'text-rose-600' : 'text-amber-600'}`} />
                      <div>
                        <h4 className="font-extrabold text-xs flex items-center gap-1.5">
                          ⚠️ অসংগতিপূর্ণ ক্যাটাগরি/সাব-ক্যাটাগরি পাথ সনাক্ত হয়েছে!
                        </h4>
                        <p className="text-[10px] opacity-80 mt-0.5">
                          আপলোডকৃত CSV ফাইলের <strong>{nonMatchingPathDetails.length}টি লাইনে</strong> সিস্টেমের ক্যাটাগরি ট্রির সাথে অমিল পাওয়া গেছে।
                        </p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase shrink-0 border ${
                      enableStrictMappingCheck
                        ? 'bg-rose-100 text-rose-800 border-rose-300'
                        : 'bg-amber-100 text-amber-800 border-amber-300'
                    }`}>
                      {enableStrictMappingCheck ? '🔒 স্ট্রিক্ট মোড অন' : '🔓 স্ট্রিক্ট মোড অফ'}
                    </span>
                  </div>

                  {/* Expandable/Scrollable Non-matching List */}
                  <div className="bg-white/90 rounded-xl p-2 border border-slate-200/80 max-h-[160px] overflow-y-auto space-y-1.5">
                    <div className="text-[9px] font-extrabold text-slate-700 uppercase tracking-wider border-b pb-1 flex justify-between px-1">
                      <span>অসংগতিপূর্ণ পাথ বিবরণ ({nonMatchingPathDetails.length}টি)</span>
                      <span>লাইন</span>
                    </div>
                    {nonMatchingPathDetails.map((item, idx) => (
                      <div key={idx} className="text-[9.5px] bg-slate-50/80 p-2 rounded-lg border border-slate-200/60 space-y-1">
                        <div className="flex items-center justify-between font-bold text-slate-800">
                          <span className="truncate max-w-[200px]" title={item.questionText}>
                            • {item.questionText}
                          </span>
                          <span className="bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded text-[8.5px] font-mono shrink-0">
                            লাইন {item.rowNum}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[8.5px] text-slate-600 bg-white p-1 rounded border border-slate-100">
                          <div>
                            <span className="font-semibold text-slate-500">ক্যাটাগরি:</span>{' '}
                            <span className="font-bold text-slate-800">{item.category}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-slate-500">সাব-ক্যাটাগরি:</span>{' '}
                            <span className="font-bold text-slate-800">{item.subcategory}</span>
                          </div>
                        </div>
                        <div className="text-[8.5px] text-rose-600 font-semibold flex items-center gap-1">
                          <span>🚨 {item.issueDescription}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Indicator Footer Controls */}
                  <div className="pt-1 flex items-center justify-between gap-2 flex-wrap border-t border-slate-200/50">
                    <label className="flex items-center gap-1.5 cursor-pointer text-[9.5px] font-bold text-slate-800">
                      <input 
                        type="checkbox"
                        checked={enableStrictMappingCheck}
                        onChange={e => setEnableStrictMappingCheck(e.target.checked)}
                        className="rounded text-rose-600 focus:ring-rose-500 w-3.5 h-3.5 cursor-pointer"
                      />
                      <span>স্ট্রিক্ট ভ্যালিডেশন মোড পরিবর্তন করুন</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => prepareMappingReview()}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[9.5px] px-2.5 py-1 rounded-lg transition shadow-xs flex items-center gap-1 cursor-pointer"
                    >
                      <span>🔍 ম্যাপিং রিভিউ ইন্টারফেস খুলুন</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Fallback Text area paste block */}
              <div className="border-t border-indigo-100/50 pt-3.5 space-y-2">
                <div className="text-center text-gray-400 text-[10px] font-semibold">অথবা সরাসরি CSV ফরম্যাটের টেক্সট পেস্ট করুন:</div>
                <textarea 
                  rows={3}
                  value={csvText}
                  onChange={e => setCsvText(e.target.value)}
                  placeholder={`text,optionA,optionB,optionC,optionD,correct,explanation,category\nবাংলাদেশের রাজধানী কোনটি?,ঢাকা,চট্টগ্রাম,সিলেট,খুলনা,Option A,ঢাকা বাংলাদেশের রাজধানী,সাধারণ জ্ঞান`}
                  className="w-full px-3 py-1.5 border border-indigo-100 rounded-xl bg-white text-[10px] font-mono text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                />

                <button
                  type="button"
                  onClick={handleBulkUploadCSVText}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-lg text-xs transition shadow-sm shadow-indigo-600/10"
                >
                  📥 পেস্টকৃত টেক্সট আপলোড করুন
                </button>

                {csvFileError && (
                  <div className="p-2 bg-rose-50 border border-rose-150 text-rose-600 text-[10px] rounded-lg font-bold">
                    ⚠️ {csvFileError}
                  </div>
                )}

                {csvValidationErrors.length > 0 && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-[10px] rounded-xl flex flex-col gap-1 max-h-[160px] overflow-y-auto font-mono">
                    <span className="font-extrabold text-[10px] text-rose-800 uppercase flex items-center gap-1">
                      ❌ ভ্যালিডেশন ত্রুটি সমূহ ({csvValidationErrors.length}টি):
                    </span>
                    {csvValidationErrors.map((err, idx) => (
                      <div key={idx} className="flex gap-1 items-start leading-relaxed border-b border-rose-100/30 pb-0.5 last:border-0">
                        <span>•</span>
                        <span>{err}</span>
                      </div>
                    ))}
                  </div>
                )}

                <button 
                  type="button"
                  onClick={() => {
                    if (!csvText.trim()) {
                      alert('অনুগ্রহ করে CSV ফরম্যাটে টেক্সট পেস্ট করুন!');
                      return;
                    }
                    try {
                      setCsvFileError('');
                      setCsvValidationErrors([]);
                      const parsed = parseCSV(csvText);
                      if (parsed.length === 0) {
                        alert('কোনো বৈধ প্রশ্ন খুঁজে পাওয়া যায়নি।');
                        return;
                      }
                      setPendingCSVFile(null);
                      setPendingQuestions(parsed);
                      setShowUploadConfirm(true);
                    } catch (err: any) {
                      if (err.validationErrors) {
                        setCsvValidationErrors(err.validationErrors);
                        setCsvFileError('পেস্ট করা টেক্সটে ভ্যালিডেশন সমস্যা পাওয়া গেছে। নিচে বিস্তারিত দেখুন।');
                      } else {
                        setCsvFileError(err.message || 'টেক্সট পার্সিং ব্যর্থ হয়েছে');
                      }
                    }
                  }}
                  className="w-full bg-slate-700 hover:bg-slate-800 text-white font-bold py-2 rounded-xl text-[11px] transition shadow-xs"
                >
                  টেক্সট থেকে কুইজ আপলোড করুন
                </button>
              </div>
            </div>

            <div className="bg-amber-50 p-5 rounded-2xl border border-amber-100 text-amber-900">
              <h4 className="font-bold text-xs flex items-center gap-1">
                <AlertCircle className="w-4 h-4 text-amber-600" /> 
                CSV আপলোড এর কিছু নিয়মাবলি:
              </h4>
              <ul className="list-disc pl-4 text-[10px] space-y-1 mt-2 text-amber-800 leading-relaxed">
                <li>সহজ সঠিক উত্তর ঘরে অবশ্যই <code className="bg-white px-1 border rounded">Option A</code>, <code className="bg-white px-1 border rounded">Option B</code>, <code className="bg-white px-1 border rounded">Option C</code> অথবা <code className="bg-white px-1 border rounded">Option D</code> লিখতে হবে।</li>
                <li>কমা সেপারেটেড ফাইলে ডাবল কোটেশন ব্যবহার করলে কমার ভেতরের শব্দগুলো একটি সেল হিসেবে বিবেচিত হবে।</li>
                <li>গন্তব্য ওভাররাইড করা না থাকলে ও ফাইলে ক্যাটাগরি ফাকা রাখলে ডিফল্টভাবে "সাধারণ জ্ঞান" সিলেক্ট হয়ে যাবে।</li>
              </ul>
            </div>

            {/* 3. Upload History Panel */}
            <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-xs flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-gray-150/60 pb-2">
                <h3 className="font-bold text-xs text-gray-800 flex items-center gap-1.5 font-sans">
                  <History className="w-4 h-4 text-indigo-600" />
                  🕒 ফাইল আপলোড হিস্ট্রি ({uploadHistory.length})
                </h3>
                {uploadHistory.length > 0 && (
                  <button 
                    type="button"
                    onClick={() => {
                      showCustomConfirm(
                        'আপলোড হিস্ট্রি মুছুন',
                        'আপনি কি নিশ্চিতভাবে আপলোড হিস্ট্রি মুছে ফেলতে চান?',
                        () => {
                          setUploadHistory([]);
                          localStorage.removeItem('orjon_upload_history');
                          localStorage.removeItem('medha_upload_history');
                          showCustomAlert('সম্পন্ন হয়েছে!', 'আপলোড হিস্ট্রি সফলভাবে মুছে ফেলা হয়েছে!', 'success');
                        },
                        'warning'
                      );
                    }}
                    className="text-[9px] text-rose-500 hover:text-rose-700 font-extrabold flex items-center gap-0.5 transition"
                  >
                    🗑️ মুছে ফেলুন
                  </button>
                )}
              </div>

              {uploadHistory.length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-[11px] flex flex-col items-center justify-center gap-1">
                  <FileText className="w-6 h-6 text-gray-300 stroke-1" />
                  এখনো কোনো ফাইল আপলোড করা হয়নি।
                </div>
              ) : (
                <div className="max-h-[220px] overflow-y-auto space-y-2.5 pr-1">
                  {uploadHistory.map(item => (
                    <div key={item.id} className="p-3 bg-slate-50/75 rounded-xl border border-slate-100 hover:border-slate-200 transition space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-gray-800 text-[10px] truncate max-w-[160px]" title={item.filename}>
                          {item.filename}
                        </span>
                        <span className="bg-indigo-50 text-indigo-600 font-extrabold text-[9px] px-1.5 py-0.5 rounded-md shrink-0">
                          {item.count}টি MCQ
                        </span>
                      </div>
                      <div className="text-[9px] text-gray-500 flex flex-wrap justify-between items-center gap-1">
                        <div>📅 {item.timestamp}</div>
                        <div className="bg-slate-200/50 text-slate-700 font-semibold px-1 rounded-sm max-w-[120px] truncate" title={item.destination}>
                          🎯 {item.destination}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. MANAGE QUESTIONS LIST */}
      {activeTab === 'manage' && (
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <h2 className="font-bold text-sm text-gray-800 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-indigo-600" />
              সব প্রশ্নের ডিরেক্টরি ({questions.length}টি প্রশ্ন)
            </h2>
            <input 
              type="text" 
              placeholder="প্রশ্ন বা ট্যাগ খুঁজুন..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full md:w-64 px-3 py-1.5 border rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 text-gray-800"
            />
          </div>

          {/* Root Category MCQ Breakdown Cards */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4.5 rounded-2xl border border-indigo-800/50 shadow-md space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-800/40 pb-2.5">
              <div className="flex items-center gap-2 font-black text-xs uppercase tracking-wider text-indigo-200">
                <FolderTree className="w-4 h-4 text-indigo-400" />
                <span>মূল ক্যাটাগরি ভিত্তিক মোট MCQ সংখ্যা (Root Category MCQ Breakdown):</span>
              </div>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2.5 py-0.5 rounded-full border border-indigo-400/30 font-bold">
                মোট প্রশ্ন: {questions.length.toLocaleString('bn-BD')} টি
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 text-xs">
              {(allRootCategories || []).map(rootName => {
                const mcqCount = rootCategoryMCQCounts[rootName] || 0;
                const isSelected = catFilter === rootName;
                return (
                  <button
                    key={rootName}
                    type="button"
                    onClick={() => {
                      setCatFilter(isSelected ? 'ALL' : rootName);
                      setSubcatFilterChain([]);
                      setSelectedQIds([]);
                    }}
                    className={`p-3 rounded-xl border text-left transition flex flex-col justify-between gap-2 cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 border-indigo-400 text-white shadow-md ring-2 ring-indigo-300/30'
                        : 'bg-white/10 hover:bg-white/20 border-white/10 text-slate-100'
                    }`}
                  >
                    <div className="font-extrabold text-[11px] line-clamp-1 flex items-center justify-between gap-1">
                      <span>{rootName}</span>
                      {isSelected && <span className="text-[9px] bg-white text-indigo-950 font-black px-1.5 py-0.2 rounded-md shrink-0">সিলেক্টেড</span>}
                    </div>
                    <div className="flex items-baseline justify-between gap-1 pt-1.5 border-t border-white/10">
                      <span className="text-[10px] opacity-80 font-medium">মোট MCQ</span>
                      <span className="font-black text-xs text-amber-300">
                        {mcqCount.toLocaleString('bn-BD')} টি
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Multi-Level Cascading Search Filters */}
          <div className="flex flex-col gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
              <div className="text-[11px] font-bold text-slate-800 flex items-center gap-1 uppercase tracking-wider">
                <FolderTree className="w-3.5 h-3.5 text-indigo-600" />
                মাল্টি-লেভেল ক্যাসকেডিং ফিল্টার (Multi-Level Cascading Filters):
              </div>
              {(catFilter !== 'ALL' || subcatFilterChain.length > 0 || leafTopicFilter !== 'ALL' || searchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setCatFilter('ALL');
                    setSubcatFilterChain([]);
                    setLeafTopicFilter('ALL');
                    setSearchQuery('');
                    setSelectedQIds([]);
                  }}
                  className="text-[10px] text-rose-600 hover:text-rose-800 font-bold bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded-md border border-rose-200 transition cursor-pointer"
                >
                  ✕ সব ফিল্টার মুছুন
                </button>
              )}
            </div>

            {/* Breadcrumb Path */}
            {(catFilter !== 'ALL' || subcatFilterChain.length > 0 || leafTopicFilter !== 'ALL') && (
              <div className="flex items-center gap-1.5 flex-wrap text-[10px] bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700">
                <span className="font-bold text-indigo-700">ফিল্টার পাথ:</span>
                <span className="bg-indigo-50 text-indigo-800 px-1.5 py-0.5 rounded font-semibold">{catFilter}</span>
                {subcatFilterChain.map((sub, idx) => (
                  <React.Fragment key={`bc-manage-${idx}`}>
                    <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded font-semibold">{sub}</span>
                  </React.Fragment>
                ))}
                {leafTopicFilter !== 'ALL' && (
                  <>
                    <ChevronRight className="w-3 h-3 text-emerald-500 shrink-0" />
                    <span className="bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded font-bold">🌿 {leafTopicFilter}</span>
                  </>
                )}
                <span className="ml-auto text-[9.5px] text-slate-500 font-bold">
                  ফলাফল: {filteredQuestionsForManage.length.toLocaleString('bn-BD')} টি
                </span>
              </div>
            )}
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
              {/* Category Dropdown (Tier 1) */}
              <div>
                <label className="block text-[10px] text-gray-500 mb-1 font-bold">১. মূল ক্যাটাগরি:</label>
                <select 
                  value={catFilter}
                  onChange={e => { 
                    setCatFilter(e.target.value); 
                    setSubcatFilterChain([]); 
                    setLeafTopicFilter('ALL');
                    setSelectedQIds([]); 
                  }}
                  className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition text-xs font-semibold"
                >
                  <option value="ALL">সব ক্যাটাগরি ({questions.length.toLocaleString('bn-BD')}টি MCQ)</option>
                  {(allRootCategories || []).map(c => (
                    <option key={c} value={c}>
                      {c} ({(rootCategoryMCQCounts[c] || 0).toLocaleString('bn-BD')}টি MCQ)
                    </option>
                  ))}
                </select>
              </div>

              {/* Recursive Dropdowns for Subcategories (Tier 2, 3, etc.) */}
              {(() => {
                const selectBoxes: React.ReactNode[] = [];
                const maxDepth = subcatFilterChain.length;

                for (let i = 0; i <= maxDepth; i++) {
                  let options: SubcategoryItem[] = [];

                  if (i === 0) {
                    if (catFilter === 'ALL') {
                      options = subcategories.filter(s => !s.parentCategory || s.parentCategory === 'বিষয়ভিত্তিক প্রস্তুতি' || isJobSolutionVariation(s.parentCategory));
                    } else if (isJobSolutionVariation(catFilter)) {
                      options = subcategories.filter(s => isJobSolutionVariation(s.parentCategory));
                    } else {
                      options = subcategories.filter(s => s.parentCategory === catFilter);
                    }
                  } else {
                    const parentVal = subcatFilterChain[i - 1];
                    if (parentVal && parentVal !== 'ALL') {
                      options = subcategories.filter(s => s.parentCategory === parentVal);
                    }
                  }

                  if (options.length === 0) continue;

                  const currentSelection = subcatFilterChain[i] || 'ALL';

                  selectBoxes.push(
                    <div key={`cascade-filter-level-${i}`}>
                      <label className="block text-[10px] text-gray-500 mb-1 font-bold">
                        {i === 0 ? '২. সাব-ক্যাটাগরি ধাপ ১:' : `${i + 2}. সাব-ক্যাটাগরি ধাপ ${i + 1}:`}
                      </label>
                      <select
                        value={currentSelection}
                        onChange={e => {
                          const val = e.target.value;
                          const newChain = [...subcatFilterChain];
                          if (val === 'ALL') {
                            newChain.splice(i);
                          } else {
                            newChain[i] = val;
                            newChain.splice(i + 1);
                          }
                          setSubcatFilterChain(newChain);
                          setLeafTopicFilter('ALL');
                          setSelectedQIds([]);
                        }}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition text-xs font-semibold"
                      >
                        <option value="ALL">--- সব ---</option>
                        {options.map(s => {
                          const count = subcategoryDescendantsCountMap.get(s.name.trim().toLowerCase()) || nodeQuestionCountMap.get(s.name.trim().toLowerCase()) || 0;
                          return (
                            <option key={s.id} value={s.name}>
                              {s.name} {count > 0 ? `(${count.toLocaleString('bn-BD')}টি)` : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  );
                }

                return selectBoxes;
              })()}

              {/* Dynamic Leaf Category / Topic Dropdown */}
              {manageAvailableLeafTopics.length > 0 && (
                <div>
                  <label className="block text-[10px] text-emerald-700 mb-1 font-bold flex items-center gap-1">
                    🌿 লিফ টপিক / ক্যাটাগরি:
                  </label>
                  <select
                    value={leafTopicFilter}
                    onChange={e => {
                      setLeafTopicFilter(e.target.value);
                      setSelectedQIds([]);
                    }}
                    className="w-full px-2.5 py-1.5 border border-emerald-300 rounded-lg bg-emerald-50/50 text-emerald-950 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition text-xs font-semibold"
                  >
                    <option value="ALL">সব টপিক ({manageAvailableLeafTopics.reduce((acc, curr) => acc + curr.count, 0).toLocaleString('bn-BD')}টি)</option>
                    {(manageAvailableLeafTopics || []).map(topic => (
                      <option key={topic.name} value={topic.name}>
                        {topic.name} ({topic.count.toLocaleString('bn-BD')}টি)
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Bulk Action Controls */}
          <div className="flex flex-col gap-3 bg-indigo-50/50 p-3 rounded-xl text-xs border border-indigo-100/50">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                  <input 
                    type="checkbox"
                    onChange={handleSelectAll}
                    checked={selectedQIds.length === filteredQuestionsForManage.length && filteredQuestionsForManage.length > 0}
                    className="rounded border-gray-300 w-3.5 h-3.5 text-indigo-600 focus:ring-indigo-500"
                  />
                  সব সিলেক্ট করুন ({filteredQuestionsForManage.length} টির মধ্যে)
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const pageIds = paginatedQuestionsForManage.map(q => q.id);
                    const newSet = new Set([...selectedQIds, ...pageIds]);
                    setSelectedQIds(Array.from(newSet));
                  }}
                  className="text-[10px] bg-indigo-100 hover:bg-indigo-200 text-indigo-800 font-bold px-2.5 py-1 rounded-md transition cursor-pointer"
                >
                  📄 এই পেজের {paginatedQuestionsForManage.length}টি সিলেক্ট করুন
                </button>
                {selectedQIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedQIds([])}
                    className="text-[10px] bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold px-2.5 py-1 rounded-md transition cursor-pointer"
                  >
                    ✕ সিলেকশন মুছুন
                  </button>
                )}
              </div>

              {selectedQIds.length > 0 && (
                <button 
                  onClick={handleBulkDelete}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-1.5 px-3.5 rounded-lg transition flex items-center gap-1 text-[11px] shadow-sm animate-pulse cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  একসাথে মুছুন ({selectedQIds.length} টি)
                </button>
              )}
            </div>

            {/* Dynamic Content Categorization Panel (Appears only when questions are selected) */}
            {selectedQIds.length > 0 && (() => {
              const selectedQuestions = questions.filter(q => selectedQIds.includes(q.id));
              const hasJobKeywords = selectedQuestions.some(q => {
                const textLower = q.text.toLowerCase();
                const subLower = (q.subcategory || '').toLowerCase();
                const catLower = (q.category || '').toLowerCase();
                return textLower.includes('বিসিএস') || textLower.includes('নিয়োগ') || textLower.includes('পরীক্ষা') || textLower.includes('ব্যাংক') || textLower.includes('job') || textLower.includes('exam') ||
                       subLower.includes('বিসিএস') || subLower.includes('নিয়োগ') || subLower.includes('পরীক্ষা') || subLower.includes('ব্যাংক') || subLower.includes('job') || subLower.includes('exam') ||
                       catLower.includes('বিসিএস') || catLower.includes('নিয়োগ') || catLower.includes('পরীক্ষা') || catLower.includes('ব্যাংক') || catLower.includes('job') || catLower.includes('exam');
              });

              return (
                <div className="bg-gradient-to-br from-indigo-50/40 to-slate-50/50 border border-indigo-150 p-4 rounded-2xl flex flex-col gap-4 shadow-sm mt-1.5 animate-scale-up">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-indigo-100 pb-2.5">
                    <div className="flex items-center gap-2 text-indigo-950 font-extrabold text-[12px] uppercase tracking-wider">
                      <Sparkles className="w-4.5 h-4.5 text-indigo-600 animate-pulse" />
                      ⚡ ডায়নামিক কন্টেন্ট ক্যাটাগরিজেশন (Dynamic Content Categorization)
                    </div>
                    <span className="text-[10px] bg-indigo-100/80 border border-indigo-200 text-indigo-800 font-bold px-2.5 py-1 rounded-full">
                      নির্বাচিত প্রশ্ন: {selectedQIds.length} টি
                    </span>
                  </div>

                  {/* Recommendation Banner */}
                  {hasJobKeywords ? (
                    <div className="text-[10px] bg-emerald-50 text-emerald-800 px-3 py-2 rounded-lg border border-emerald-150 font-semibold leading-relaxed flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span>💡 <b>পরামর্শ (Smart Suggestion):</b> নির্বাচিত প্রশ্নসমূহে পরীক্ষা বা নিয়োগ সংক্রান্ত বিষয় রয়েছে। এগুলোকে <b>"জব সলিউশন পরীক্ষা"</b> জোনের আওতাধীন সাব-ক্যাটাগরিতে লিংক করা রিকমেন্ডেড!</span>
                    </div>
                  ) : (
                    <div className="text-[10px] bg-indigo-50 text-indigo-800 px-3 py-2 rounded-lg border border-indigo-150 font-semibold leading-relaxed flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                      <span>💡 <b>পরামর্শ (Smart Suggestion):</b> এগুলো সাধারণ বা বিষয়ভিত্তিক প্রশ্ন। এগুলোকে <b>"বিষয়ভিত্তিক প্রস্তুতি"</b> জোনে লিংক করা রিকমেন্ডেড!</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    {/* Destination Cascading Selectors */}
                    <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                      {/* Destination Category selector */}
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1 font-bold">গন্তব্য মূল ক্যাটাগরি:</label>
                        <select
                          value={moveDestCat}
                          onChange={e => {
                            setMoveDestCat(e.target.value);
                            setMoveDestSubcatChain([]);
                          }}
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition text-[11px] font-semibold"
                        >
                          {distinctCategories.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>

                      {/* Destination Cascading Subcategories selector chain */}
                      {(() => {
                        const selectBoxes: React.ReactNode[] = [];
                        const maxDepth = moveDestSubcatChain.length;

                        for (let i = 0; i <= maxDepth; i++) {
                          let options: SubcategoryItem[] = [];

                          if (i === 0) {
                            if (isJobSolutionVariation(moveDestCat)) {
                              options = subcategories.filter(s => isJobSolutionVariation(s.parentCategory));
                            } else if (isYearJobSolutionVariation(moveDestCat)) {
                              options = subcategories.filter(s => isYearJobSolutionVariation(s.parentCategory));
                            } else {
                              options = subcategories.filter(s => s.parentCategory === moveDestCat);
                            }
                          } else {
                            const parentVal = moveDestSubcatChain[i - 1];
                            if (parentVal && parentVal !== 'ALL') {
                              options = subcategories.filter(s => s.parentCategory === parentVal);
                            }
                          }

                          if (options.length === 0) continue;

                          const currentSelection = moveDestSubcatChain[i] || 'ALL';

                          selectBoxes.push(
                            <div key={`move-dest-level-${i}`}>
                              <label className="block text-[10px] text-gray-500 mb-1 font-bold">
                                {i === 0 ? 'গন্তব্য উপ-ক্যাটাগরি (ধাপ ১):' : `গন্তব্য সাব-ক্যাটাগরি ধাপ ${i + 1}:`}
                              </label>
                              <select
                                value={currentSelection}
                                onChange={e => {
                                  const val = e.target.value;
                                  const newChain = [...moveDestSubcatChain];
                                  if (val === 'ALL') {
                                    newChain.splice(i);
                                  } else {
                                    newChain[i] = val;
                                    newChain.splice(i + 1);
                                  }
                                  setMoveDestSubcatChain(newChain);
                                }}
                                className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition text-[11px] font-semibold"
                              >
                                <option value="ALL">--- সিলেক্ট করুন (ঐচ্ছিক) ---</option>
                                {options.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                              </select>
                            </div>
                          );
                        }

                        return selectBoxes;
                      })()}
                    </div>

                    {/* Quick Inline Creator / Action Panel */}
                    <div className="md:col-span-4 flex flex-col justify-end gap-2.5 border-l border-slate-200/80 pl-4">
                      {isAddingNewSubcatInline ? (
                        <div className="bg-white p-2 rounded-xl border border-slate-100 flex flex-col gap-2 shadow-2xs">
                          <label className="block text-[9px] text-slate-500 font-extrabold uppercase">নতুন সাব-ক্যাটাগরি তৈরি করুন ({moveDestCat}):</label>
                          <input 
                            type="text"
                            placeholder="যেমন: ৪৬তম বিসিএস প্রিলি..."
                            value={inlineNewSubcatName}
                            onChange={e => setInlineNewSubcatName(e.target.value)}
                            className="w-full px-2.5 py-1 border border-slate-200 rounded-md text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          <div className="flex gap-1.5 justify-end">
                            <button
                              onClick={() => {
                                setIsAddingNewSubcatInline(false);
                                setInlineNewSubcatName('');
                              }}
                              className="px-2 py-1 border border-slate-200 rounded text-[10px] text-gray-500 hover:bg-gray-50 font-bold"
                            >
                              বাতিল
                            </button>
                            <button
                              onClick={() => {
                                const trimmed = inlineNewSubcatName.trim();
                                if (!trimmed) {
                                  alert('সাব-ক্যাটাগরির নাম দিন!');
                                  return;
                                }
                                onAddSubcategory(trimmed, moveDestCat);
                                setMoveDestSubcatChain([trimmed]);
                                setInlineNewSubcatName('');
                                setIsAddingNewSubcatInline(false);
                              }}
                              className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] font-bold"
                            >
                              তৈরি ও সিলেক্ট করুন
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setIsAddingNewSubcatInline(true)}
                          className="w-full border border-dashed border-indigo-300 hover:border-indigo-400 text-indigo-700 hover:text-indigo-800 font-bold py-1.5 px-3 rounded-lg text-[10px] flex items-center justify-center gap-1 transition bg-indigo-50/20"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          গন্তব্যে নতুন সাব-ক্যাটাগরি তৈরি করুন
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2 border-t border-slate-100 pt-3 mt-1">
                    <span className="text-[10px] text-slate-500 font-semibold italic">
                      গন্তব্য নির্বাচন করার পর ক্যাটাগরি স্থানান্তরিত (Move) বা লিঙ্ক (Link) করুন।
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleBulkMove('move')}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold py-2 px-4 rounded-xl transition text-[11px] shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        🚚 ক্যাটাগরি পরিবর্তন/মুভ করুন ({selectedQIds.length}টি)
                      </button>
                      <button
                        onClick={() => handleBulkMove('link')}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2 px-4 rounded-xl transition text-[11px] shadow-xs shadow-indigo-600/10 flex items-center gap-1.5 cursor-pointer"
                      >
                        🔗 অতিরিক্ত ক্যাটাগরিতে লিঙ্ক করুন
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Pagination Controls Bar */}
          {filteredQuestionsForManage.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs font-semibold">
              <div className="text-slate-600">
                মোট <strong className="text-slate-900">{filteredQuestionsForManage.length.toLocaleString('bn-BD')}</strong> টি প্রশ্নের মধ্যে{' '}
                <span className="text-indigo-600 font-bold">
                  {((managePage - 1) * managePageSize + 1).toLocaleString('bn-BD')} - {Math.min(managePage * managePageSize, filteredQuestionsForManage.length).toLocaleString('bn-BD')}
                </span>{' '}
                দেখানো হচ্ছে
              </div>

              <div className="flex items-center gap-2">
                <label className="text-[11px] text-slate-500 font-bold">প্রতি পেজে:</label>
                <select
                  value={managePageSize}
                  onChange={e => {
                    setManagePageSize(Number(e.target.value));
                    setManagePage(1);
                  }}
                  className="px-2 py-1 border border-slate-200 rounded-lg bg-white text-xs font-bold focus:outline-none"
                >
                  <option value={25}>২৫ টি</option>
                  <option value={50}>৫০ টি</option>
                  <option value={100}>১০০ টি</option>
                  <option value={200}>২০০ টি</option>
                </select>

                <div className="flex items-center gap-1 ml-2">
                  <button
                    disabled={managePage === 1}
                    onClick={() => setManagePage(1)}
                    className="px-2 py-1 bg-white hover:bg-slate-100 disabled:opacity-40 border rounded-md font-bold transition cursor-pointer"
                    title="প্রথম পেজ"
                  >
                    ««
                  </button>
                  <button
                    disabled={managePage === 1}
                    onClick={() => setManagePage(prev => Math.max(1, prev - 1))}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 disabled:opacity-40 border rounded-md font-bold transition cursor-pointer"
                  >
                    « পূর্ববর্তী
                  </button>
                  <span className="px-2 py-1 text-slate-700 font-bold">
                    পেজ {managePage.toLocaleString('bn-BD')} / {totalManagePages.toLocaleString('bn-BD')}
                  </span>
                  <button
                    disabled={managePage >= totalManagePages}
                    onClick={() => setManagePage(prev => Math.min(totalManagePages, prev + 1))}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 disabled:opacity-40 border rounded-md font-bold transition cursor-pointer"
                  >
                    পরবর্তী »
                  </button>
                  <button
                    disabled={managePage >= totalManagePages}
                    onClick={() => setManagePage(totalManagePages)}
                    className="px-2 py-1 bg-white hover:bg-slate-100 disabled:opacity-40 border rounded-md font-bold transition cursor-pointer"
                    title="শেষ পেজ"
                  >
                    »»
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* List Display */}
          <div className="border border-gray-150 rounded-xl divide-y divide-gray-100 max-h-[50vh] overflow-y-auto">
            {filteredQuestionsForManage.length === 0 ? (
              <p className="text-center text-gray-400 py-8 text-xs">কোনো প্রশ্ন পাওয়া যায়নি। ফিল্টার পরিবর্তন করে দেখুন।</p>
            ) : (
              paginatedQuestionsForManage.map((q, i) => (
                <div key={q.id} className="p-3.5 flex items-start gap-3 hover:bg-gray-50/50 transition text-xs">
                  <input 
                    type="checkbox"
                    checked={selectedQIds.includes(q.id)}
                    onChange={() => handleToggleSelectQ(q.id)}
                    className="mt-1.5 rounded border-gray-300 w-3.5 h-3.5 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <div className="flex-grow">
                    <p className="font-bold text-gray-800 leading-snug">
                      {(((managePage - 1) * managePageSize) + i + 1).toLocaleString('bn-BD')}. {q.text}
                    </p>
                    
                    {/* Display multiple categories/subcategories dynamically */}
                    <div className="flex flex-wrap gap-x-2 gap-y-1 mt-2 text-[10px] items-center">
                      {Array.from(new Set(q.categories && q.categories.length > 0 ? q.categories : [q.category])).filter(Boolean).map((c, idx) => (
                        <span key={`${c}-${idx}`} className="bg-indigo-50 text-indigo-700 font-extrabold px-2.5 py-0.5 rounded-md border border-indigo-100/70 shadow-xs flex items-center gap-1">
                          📚 {c}
                        </span>
                      ))}
                      {Array.from(new Set(q.subcategories && q.subcategories.length > 0 ? q.subcategories : (q.subcategory ? [q.subcategory] : []))).filter(Boolean).map((s, idx) => (
                        <span key={`${s}-${idx}`} className="bg-emerald-50 text-emerald-700 font-extrabold px-2.5 py-0.5 rounded-md border border-emerald-100/70 shadow-xs flex items-center gap-1">
                          💼 {s}
                        </span>
                      ))}
                      <span className="text-emerald-600 font-extrabold border-l pl-2 border-slate-200">
                        সঠিক: {q.correct === 'Option A' ? q.optionA : q.correct === 'Option B' ? q.optionB : q.correct === 'Option C' ? q.optionC : q.optionD}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2.5 shrink-0 self-center">
                    <button 
                      onClick={() => handleStartEdit(q)}
                      className="text-indigo-600 hover:text-indigo-800 font-bold hover:underline flex items-center gap-0.5 text-[11px] cursor-pointer"
                    >
                      <Edit className="w-3 h-3" /> এডিট
                    </button>
                    <button 
                      onClick={() => {
                        setSingleMoveQ(q);
                        setSingleMoveCat(q.category || 'বিষয়ভিত্তিক প্রস্তুতি');
                        setSingleMoveSubcatChain(q.subcategory ? [q.subcategory] : []);
                      }}
                      className="text-amber-600 hover:text-amber-800 font-bold hover:underline flex items-center gap-0.5 text-[11px] cursor-pointer"
                    >
                      🚚 মুভ / লিঙ্ক
                    </button>
                    <button 
                      onClick={() => {
                        showCustomConfirm(
                          'প্রশ্ন ডিলিট নিশ্চিতকরণ',
                          'আপনি কি নিশ্চিতভাবে এই প্রশ্নটি মুছে ফেলতে চান?',
                          () => {
                            onDeleteQuestion(q.id);
                            showCustomAlert('সম্পন্ন হয়েছে!', 'প্রশ্নটি সফলভাবে ডিলিট করা হয়েছে!', 'success');
                          },
                          'warning'
                        );
                      }}
                      className="text-rose-600 hover:text-rose-800 font-bold hover:underline flex items-center gap-0.5 text-[11px] cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" /> ডিলিট
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 2.5 CATEGORIES, SUBCATEGORIES & LEAF NODES MANAGEMENT */}
      {activeTab === 'categories' && (() => {
        // Calculate Leaf Nodes (Nodes with no sub-children)
        const leafSubcategories = subcategories.filter(sub => {
          const hasChildren = subcategories.some(
            other => other.parentCategory && other.parentCategory.trim().toLowerCase() === sub.name.trim().toLowerCase()
          );
          return !hasChildren;
        });

        // Intermediate Branch Subcategories (Nodes that have children)
        const branchSubcategories = subcategories.filter(sub => {
          const hasChildren = subcategories.some(
            other => other.parentCategory && other.parentCategory.trim().toLowerCase() === sub.name.trim().toLowerCase()
          );
          return hasChildren;
        });

        // Find all hidden/implicit categories and leaf nodes present in questions but missing from category tree
        const getHiddenNodes = () => {
          const registered = new Set<string>();
          ['বিষয়ভিত্তিক প্রস্তুতি', 'জব সলিউশন পরীক্ষা', 'সাল ভিত্তিক জব সলিউশন', 'সাধারণ জ্ঞান'].forEach(r => registered.add(r.trim().toLowerCase()));
          categories.forEach(c => registered.add(c.name.trim().toLowerCase()));
          subcategories.forEach(s => registered.add(s.name.trim().toLowerCase()));

          const map = new Map<string, {
            name: string;
            questionCount: number;
            suggestedParent: string;
            sampleQuestions: Question[];
          }>();

          questions.forEach(q => {
            const candidates: Array<{ name: string; parentHint?: string }> = [];
            if (q.category) candidates.push({ name: q.category.trim() });
            if (q.subcategory) candidates.push({ name: q.subcategory.trim(), parentHint: q.category || q.csvCategory });
            if (q.csvCategory) candidates.push({ name: q.csvCategory.trim() });
            if (q.categories && Array.isArray(q.categories)) {
              q.categories.forEach(c => c && candidates.push({ name: c.trim() }));
            }
            if (q.subcategories && Array.isArray(q.subcategories)) {
              q.subcategories.forEach((s, idx) => {
                if (s) {
                  const parent = idx > 0 ? q.subcategories![idx - 1] : (q.category || 'বিষয়ভিত্তিক প্রস্তুতি');
                  candidates.push({ name: s.trim(), parentHint: parent });
                }
              });
            }

            candidates.forEach(({ name, parentHint }) => {
              if (!name) return;
              const lower = name.toLowerCase();
              if (registered.has(lower) || isJobSolutionVariation(name) || isYearJobSolutionVariation(name)) {
                return;
              }

              if (!map.has(lower)) {
                let parent = parentHint && parentHint.trim() ? parentHint.trim() : 'বিষয়ভিত্তিক প্রস্তুতি';
                if (isJobSolutionVariation(parent) || isYearJobSolutionVariation(parent)) {
                  parent = 'সাধারণ জ্ঞান';
                }
                map.set(lower, {
                  name,
                  questionCount: 1,
                  suggestedParent: parent,
                  sampleQuestions: [q]
                });
              } else {
                const item = map.get(lower)!;
                item.questionCount += 1;
                if (item.sampleQuestions.length < 3 && !item.sampleQuestions.some(sq => sq.id === q.id)) {
                  item.sampleQuestions.push(q);
                }
              }
            });
          });

          return Array.from(map.values());
        };

        const hiddenNodes = getHiddenNodes();

        // Filter leaf nodes by search query
        const filteredLeafNodes = leafSubcategories.filter(sub => {
          if (!categorySearchQuery.trim()) return true;
          const q = categorySearchQuery.toLowerCase();
          const path = findSubcategoryPath(sub.name).join(' ➔ ').toLowerCase();
          return sub.name.toLowerCase().includes(q) || (sub.parentCategory && sub.parentCategory.toLowerCase().includes(q)) || path.includes(q);
        });

        // Filter all subcategories by search query for table overview
        const filteredAllSubcats = subcategories.filter(sub => {
          if (!categorySearchQuery.trim()) return true;
          const q = categorySearchQuery.toLowerCase();
          return sub.name.toLowerCase().includes(q) || (sub.parentCategory && sub.parentCategory.toLowerCase().includes(q));
        });

        return (
          <div className="flex flex-col gap-6 text-xs animate-fade-in">
            {/* Subcategory / Node Creation Form */}
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-4">
              <h3 className="font-extrabold text-sm text-emerald-950 flex items-center gap-1.5 border-b pb-2">
                <FolderTree className="w-4 h-4 text-emerald-600" />
                💼 সাব-ক্যাটাগরি বা লিফ নোড তৈরি করুন (Subcategories / Topics)
              </h3>

              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const subName = fd.get('subName') as string;
                  const parentCat = fd.get('parentCat') as string;
                  const subDate = fd.get('subDate') as string;
                  const subHeading = fd.get('subHeading') as string;
                  if (subName && subName.trim()) {
                    onAddSubcategory(subName.trim(), parentCat, subDate || undefined, subHeading ? subHeading.trim() : undefined);
                  }
                  e.currentTarget.reset();
                }}
                className="flex flex-col gap-3"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1 font-bold">মূল ক্যাটাগরি বা প্যারেন্ট নির্ধারণ করুন:</label>
                    <select 
                      name="parentCat"
                      required
                      className="w-full px-3 py-2 border rounded-xl bg-white text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 text-[11px]"
                    >
                      <optgroup label="মূল ক্যাটাগরি (Root Zones)">
                        <option value="বিষয়ভিত্তিক প্রস্তুতি">বিষয়ভিত্তিক প্রস্তুতি</option>
                        <option value="জব সলিউশন পরীক্ষা">জব সলিউশন পরীক্ষা</option>
                        <option value="সাল ভিত্তিক জব সলিউশন">সাল ভিত্তিক জব সলিউশন</option>
                        {(categories || []).map(c => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                      </optgroup>
                      {subcategories.length > 0 && (
                        <optgroup label="বিদ্যমান সাব-ক্যাটাগরি সমূহ">
                          {subcategories
                            .filter(s => s.name !== 'বিষয়ভিত্তিক প্রস্তুতি' && !isJobSolutionVariation(s.name) && !isYearJobSolutionVariation(s.name))
                            .map(s => (
                              <option key={s.id} value={s.name}>{s.name}</option>
                            ))
                          }
                        </optgroup>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1 font-bold">🏷️ সাব-হেডিং / সাব-টাইটেল (ঐচ্ছিক):</label>
                    <input 
                      name="subHeading"
                      type="text"
                      placeholder="যেমন: ৩য় ও ৪র্থ শ্রেণীর প্রস্তুতি"
                      className="w-full px-3 py-1.5 border rounded-xl bg-white text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 text-[11px]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1 font-bold">📅 পরীক্ষার তারিখ (লিফ নোড বা সাব-ক্যাটাগরির জন্য):</label>
                    <input 
                      name="subDate"
                      type="date"
                      className="w-full px-3 py-1.5 border rounded-xl bg-white text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 text-[11px]"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <input 
                    name="subName"
                    type="text"
                    required
                    placeholder="নতুন ক্যাটাগরি, সাব-ক্যাটাগরি বা টপিকের নাম (যেমন: বাংলা সাহিত্য / সমাস)"
                    className="flex-grow px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-800 font-semibold text-xs"
                  />
                  <button 
                    type="submit"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2 rounded-xl transition shadow-xs shrink-0 cursor-pointer text-xs"
                  >
                    ➕ যোগ করুন
                  </button>
                </div>
              </form>
            </div>

            {/* View Selector & Search Filter Bar */}
            <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCategoryViewTab('tree')}
                  className={`px-3.5 py-2 rounded-xl font-extrabold text-xs transition flex items-center gap-1.5 cursor-pointer ${
                    categoryViewTab === 'tree'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  🌳 ইন্টারেক্টিভ ট্রি (Tree View)
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryViewTab('leaf_nodes')}
                  className={`px-3.5 py-2 rounded-xl font-extrabold text-xs transition flex items-center gap-1.5 cursor-pointer ${
                    categoryViewTab === 'leaf_nodes'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  🍃 লিফ নোড সমূহ (Leaf Nodes - {filteredLeafNodes.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryViewTab('all_table')}
                  className={`px-3.5 py-2 rounded-xl font-extrabold text-xs transition flex items-center gap-1.5 cursor-pointer ${
                    categoryViewTab === 'all_table'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  📋 সকল ক্যাটাগরি ও সাব-ক্যাটাগরি টেবিল ({categories.length + subcategories.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryViewTab('hidden_nodes')}
                  className={`px-3.5 py-2 rounded-xl font-extrabold text-xs transition flex items-center gap-1.5 cursor-pointer ${
                    categoryViewTab === 'hidden_nodes'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  🕵️‍♂️ লুকানো/ইমপ্লিসিট নোড ({hiddenNodes.length})
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative shrink-0 sm:w-64">
                <input
                  type="text"
                  value={categorySearchQuery}
                  onChange={e => setCategorySearchQuery(e.target.value)}
                  placeholder="🔍 ক্যাটাগরি বা লিফ নোড খুঁজুন..."
                  className="w-full pl-3 pr-8 py-2 border rounded-xl bg-slate-50 text-gray-800 font-semibold focus:outline-none focus:bg-white text-xs border-slate-200"
                />
                {categorySearchQuery && (
                  <button
                    onClick={() => setCategorySearchQuery('')}
                    className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* TAB 1: Hierarchical Tree View */}
            {categoryViewTab === 'tree' && (
              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
                  <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                    <FolderTree className="w-5 h-5 text-indigo-600" />
                    🌳 ক্যাটাগরি, সাব-ক্যাটাগরি ও লিফ নোড রিলেশনশিপ ট্রি (Interactive Tree View)
                  </h3>
                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <button
                      type="button"
                      onClick={expandAllNodes}
                      className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold px-2.5 py-1 rounded-xl text-[10px] transition border border-indigo-200 flex items-center gap-1 shadow-2xs cursor-pointer"
                      title="সব সাব-ক্যাটাগরি প্রসারিত করুন"
                    >
                      📂 সব খুলুন
                    </button>
                    <button
                      type="button"
                      onClick={collapseAllNodes}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold px-2.5 py-1 rounded-xl text-[10px] transition border border-slate-200 flex items-center gap-1 shadow-2xs cursor-pointer"
                      title="সব সাব-ক্যাটাগরি গুটিয়ে নিন"
                    >
                      📁 সব গুটিয়ে নিন
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  বিষয়ভিত্তিক প্রস্তুতি জোন, জব সলিউশন ব্যাংক এবং সাল ভিত্তিক জব সলিউশনের কাঠামো নিচে সাজানো হয়েছে। প্রতিটি প্রান্তিক ধাপ বা শাখা যার আর কোনো উপ-ধাপ নেই, তা 🍃 <strong className="text-emerald-700">লিফ নোড (Leaf Category)</strong> হিসেবে চিহ্নিত আছে।
                </p>

                {/* Root Categories Switcher Bar (3 Toggle Buttons with Logos Only) */}
                <div className="bg-slate-50/80 p-2.5 rounded-2xl border border-slate-200/80 flex flex-row items-center justify-center gap-3">
                  <div className="flex flex-row items-center justify-center gap-3">
                    <button
                      type="button"
                      title="বিষয়ভিত্তিক প্রস্তুতি"
                      onClick={() => setRootCategoryFilter('subject')}
                      className={`w-10 h-10 rounded-xl font-bold text-lg transition cursor-pointer flex items-center justify-center shrink-0 ${
                        rootCategoryFilter === 'subject'
                          ? 'bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-300 scale-105'
                          : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100 border border-indigo-200/80'
                      }`}
                    >
                      📚
                    </button>
                    <button
                      type="button"
                      title="জব সলিউশন পরীক্ষা"
                      onClick={() => setRootCategoryFilter('job')}
                      className={`w-10 h-10 rounded-xl font-bold text-lg transition cursor-pointer flex items-center justify-center shrink-0 ${
                        rootCategoryFilter === 'job'
                          ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-300 scale-105'
                          : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/80'
                      }`}
                    >
                      💼
                    </button>
                    <button
                      type="button"
                      title="সাল ভিত্তিক জব সলিউশন"
                      onClick={() => setRootCategoryFilter('year')}
                      className={`w-10 h-10 rounded-xl font-bold text-lg transition cursor-pointer flex items-center justify-center shrink-0 ${
                        rootCategoryFilter === 'year'
                          ? 'bg-amber-600 text-white shadow-xs ring-2 ring-amber-300 scale-105'
                          : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/80'
                      }`}
                    >
                      📅
                    </button>
                  </div>
                </div>

                <div className="border border-slate-100 rounded-2xl bg-slate-50/50 p-4 max-h-[80vh] overflow-y-auto space-y-4">
                  {/* Tree View Subcategory Bulk Action Bar */}
                  {selectedSubcatIds.length > 0 && (
                    <div className="bg-gradient-to-r from-amber-50 to-indigo-50 border border-amber-200 p-3 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xs animate-scale-up sticky top-0 z-20">
                      <div className="flex items-center gap-2">
                        <span className="bg-amber-600 text-white text-[11px] font-extrabold px-3 py-1 rounded-full shadow-2xs">
                          {selectedSubcatIds.length} টি ক্যাটাগরি/সাব-ক্যাটাগরি নির্বাচিত
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedSubcatIds([])}
                          className="text-[11px] text-slate-600 hover:text-slate-800 font-bold underline cursor-pointer"
                        >
                          ক্লিয়ার
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          <label className="text-[10px] font-bold text-slate-700">নতুন প্যারেন্ট:</label>
                          <select
                            value={bulkSubcatMoveParent}
                            onChange={e => setBulkSubcatMoveParent(e.target.value)}
                            className="px-2 py-1 text-[11px] border border-slate-300 rounded-lg bg-white font-semibold text-slate-800"
                          >
                            <option value="বিষয়ভিত্তিক প্রস্তুতি">বিষয়ভিত্তিক প্রস্তুতি</option>
                            <option value="জব সলিউশন পরীক্ষা">জব সলিউশন পরীক্ষা</option>
                            <option value="সাল ভিত্তিক জব সলিউশন">সাল ভিত্তিক জব সলিউশন</option>
                            {(categories || []).map(c => (
                              <option key={c.id} value={c.name}>{c.name}</option>
                            ))}
                            {subcategories.filter(s => !selectedSubcatIds.includes(s.id)).map(s => (
                              <option key={s.id} value={s.name}>{s.name}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={handleBulkMoveSubcatAction}
                            className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold px-3 py-1 rounded-lg text-[11px] shadow-2xs flex items-center gap-1 cursor-pointer transition"
                          >
                            🚚 স্থানান্তরিত করুন
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={handleBulkDeleteSubcatAction}
                          className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold px-3 py-1 rounded-lg text-[11px] shadow-2xs flex items-center gap-1 cursor-pointer transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          একসাথে মুছুন ({selectedSubcatIds.length}টি)
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 1. Subject Categories */}
                  {(rootCategoryFilter === 'ALL' || rootCategoryFilter === 'subject') && (
                    <div>
                      <h4 className="font-extrabold text-xs text-indigo-950 mb-3 flex items-center gap-1.5 uppercase tracking-wider">
                        📚 বিষয়ভিত্তিক প্রস্তুতি জোন (Subject Categories Hierarchy)
                      </h4>
                      <div className="space-y-2">
                        {subcategories.filter(s => s.parentCategory === 'বিষয়ভিত্তিক প্রস্তুতি').length === 0 ? (
                          <p className="text-gray-400 italic text-[11px] pl-3">কোনো বিষয়ভিত্তিক ক্যাটাগরি নেই।</p>
                        ) : (
                          subcategories
                            .filter(s => s.parentCategory === 'বিষয়ভিত্তিক প্রস্তুতি')
                            .map((sub, idx) => renderTreeNode(sub.name, sub.id, 'subcategory', 0))
                        )}
                      </div>
                    </div>
                  )}

                  {/* 2. Job Solutions / Exams */}
                  {(rootCategoryFilter === 'ALL' || rootCategoryFilter === 'job') && (
                    <div className={rootCategoryFilter === 'ALL' ? "border-t border-slate-200/80 pt-4" : ""}>
                      <h4 className="font-extrabold text-xs text-emerald-950 mb-3 flex items-center gap-1.5 uppercase tracking-wider">
                        💼 জব সলিউশন পরীক্ষা সমূহ (Job Exams Hierarchy)
                      </h4>
                      <div className="space-y-2">
                        {subcategories.filter(s => isJobSolutionVariation(s.parentCategory)).length === 0 ? (
                          <p className="text-gray-400 italic text-[11px] pl-3">কোনো পরীক্ষা বা জব সলিউশন ক্যাটাগরি নেই।</p>
                        ) : (
                          subcategories
                            .filter(s => isJobSolutionVariation(s.parentCategory))
                            .map((sub, idx) => renderTreeNode(sub.name, sub.id, 'subcategory', 0))
                        )}
                      </div>
                    </div>
                  )}

                  {/* 3. Year-based Job Solutions */}
                  {(rootCategoryFilter === 'ALL' || rootCategoryFilter === 'year') && (
                    <div className={rootCategoryFilter === 'ALL' ? "border-t border-slate-200/80 pt-4" : ""}>
                      <h4 className="font-extrabold text-xs text-amber-950 mb-3 flex items-center gap-1.5 uppercase tracking-wider">
                        📅 সাল ভিত্তিক জব সলিউশন (Year-based Job Solutions Hierarchy)
                      </h4>
                      <div className="space-y-2">
                        {subcategories.filter(s => isYearJobSolutionVariation(s.parentCategory)).length === 0 ? (
                          <p className="text-gray-400 italic text-[11px] pl-3">কোনো সাল ভিত্তিক ক্যাটাগরি নেই।</p>
                        ) : (
                          subcategories
                            .filter(s => isYearJobSolutionVariation(s.parentCategory))
                            .map((sub, idx) => renderTreeNode(sub.name, sub.id, 'subcategory', 0))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: Leaf Nodes View */}
            {categoryViewTab === 'leaf_nodes' && (
              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
                  <div>
                    <h3 className="font-extrabold text-sm text-emerald-950 flex items-center gap-2">
                      🍃 সকল লিফ ক্যাটাগরি / লিফ নোড সমূহ (Leaf Categories List)
                    </h3>
                    <p className="text-[11px] text-gray-500 mt-1">
                      ট্রি হায়ারার্কির যেসব ক্যাটাগরির অধীনে অন্য কোনো সাব-ক্যাটাগরি নেই, সেগুলোই লিফ নোড। এগুলোতে সরাসরি কুইজ ও প্রশ্ন যুক্ত করা যায়।
                    </p>
                  </div>
                  <span className="bg-emerald-50 text-emerald-800 font-extrabold px-3 py-1 rounded-xl text-xs border border-emerald-200 shrink-0 self-start sm:self-auto">
                    মোট {filteredLeafNodes.length} টি লিফ নোড
                  </span>
                </div>

                {/* Leaf Nodes Bulk Action Bar */}
                {selectedSubcatIds.length > 0 && (
                  <div className="bg-gradient-to-r from-amber-50 to-indigo-50 border border-amber-200 p-3 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xs animate-scale-up">
                    <div className="flex items-center gap-2">
                      <span className="bg-amber-600 text-white text-[11px] font-extrabold px-3 py-1 rounded-full shadow-2xs">
                        {selectedSubcatIds.length} টি নোড নির্বাচিত
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedSubcatIds([])}
                        className="text-[11px] text-slate-600 hover:text-slate-800 font-bold underline cursor-pointer"
                      >
                        ক্লিয়ার
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <label className="text-[10px] font-bold text-slate-700">নতুন প্যারেন্ট:</label>
                        <select
                          value={bulkSubcatMoveParent}
                          onChange={e => setBulkSubcatMoveParent(e.target.value)}
                          className="px-2 py-1 text-[11px] border border-slate-300 rounded-lg bg-white font-semibold text-slate-800"
                        >
                          <option value="বিষয়ভিত্তিক প্রস্তুতি">বিষয়ভিত্তিক প্রস্তুতি</option>
                          <option value="জব সলিউশন পরীক্ষা">জব সলিউশন পরীক্ষা</option>
                          <option value="সাল ভিত্তিক জব সলিউশন">সাল ভিত্তিক জব সলিউশন</option>
                          {(categories || []).map(c => (
                            <option key={c.id} value={c.name}>{c.name}</option>
                          ))}
                          {subcategories.filter(s => !selectedSubcatIds.includes(s.id)).map(s => (
                            <option key={s.id} value={s.name}>{s.name}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={handleBulkMoveSubcatAction}
                          className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold px-3 py-1 rounded-lg text-[11px] shadow-2xs flex items-center gap-1 cursor-pointer transition"
                        >
                          🚚 স্থানান্তরিত করুন
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={handleBulkDeleteSubcatAction}
                        className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold px-3 py-1 rounded-lg text-[11px] shadow-2xs flex items-center gap-1 cursor-pointer transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        একসাথে মুছুন ({selectedSubcatIds.length}টি)
                      </button>
                    </div>
                  </div>
                )}

                {filteredLeafNodes.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 font-semibold">
                    কোনো লিফ নোড পাওয়া যায়নি।
                  </div>
                ) : (
                  <div className="border border-slate-200/80 rounded-2xl bg-slate-50/50 p-2 overflow-hidden">
                    <div className="flex items-center justify-between text-[11px] text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl mb-2 font-semibold border border-emerald-200">
                      <span>⚡ react-window উইন্ডোয়েজড ভার্চুয়ালাইজেশন সক্রিয় (কেবলমাত্র দৃশ্যমান উপাদান রেন্ডার হচ্ছে)</span>
                      <span className="font-extrabold">{filteredLeafNodes.length} টি নোড</span>
                    </div>

                    <List
                      height={550}
                      itemCount={leafNodeRows.length}
                      itemSize={190}
                      width="100%"
                    >
                      {({ index, style }) => {
                        const rowItems = leafNodeRows[index];

                        return (
                          <div style={{ ...style, padding: '4px' }} key={index}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 h-full">
                              {rowItems.map(leaf => {
                                const fullPath = findSubcategoryPath(leaf.name);
                                const qCount = nodeQuestionCountMap.get(leaf.name.trim().toLowerCase()) || 0;
                                const isLeafSelected = selectedSubcatIds.includes(leaf.id);

                                return (
                                  <div key={leaf.id} className={`p-3.5 rounded-2xl border transition flex flex-col justify-between gap-2.5 shadow-2xs group h-[180px] ${
                                    isLeafSelected ? 'bg-amber-50/80 border-amber-300 ring-1 ring-amber-300' : 'bg-white hover:bg-emerald-50/30 border-slate-200/80 hover:border-emerald-300'
                                  }`}>
                                    <div className="space-y-1.5">
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5 truncate">
                                          <input
                                            type="checkbox"
                                            checked={isLeafSelected}
                                            onChange={() => handleToggleSelectSubcat(leaf.id)}
                                            className="rounded border-gray-300 w-3.5 h-3.5 text-amber-600 focus:ring-amber-500 cursor-pointer shrink-0 mr-0.5"
                                            title="সিলেক্ট করুন"
                                          />
                                          <span className="text-base shrink-0">🍃</span>
                                          <span className="truncate">{leaf.name}</span>
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => setViewNodeQuestionsModal({ nodeName: leaf.name, questions: getQuestionsForNode(leaf.name) })}
                                          className="bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-extrabold text-[9px] px-2 py-0.5 rounded-md border border-emerald-200 shrink-0 transition cursor-pointer flex items-center gap-1"
                                          title="এই লিফ নোডের সকল প্রশ্ন দেখুন"
                                        >
                                          {qCount} টি প্রশ্ন 👁️
                                        </button>
                                      </div>

                                      {/* Full Breadcrumb Trail */}
                                      <div className="text-[10px] text-slate-500 font-semibold flex items-center gap-1 flex-wrap bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-150 truncate">
                                        <span className="text-indigo-600 font-bold shrink-0">প্যারেন্ট:</span>
                                        {fullPath.length > 0 ? (
                                          fullPath.map((p, idx) => (
                                            <span key={idx} className="flex items-center gap-1 truncate">
                                              <span className="text-slate-700 font-extrabold truncate">{p}</span>
                                              {idx < fullPath.length - 1 && <span className="text-gray-300 shrink-0">➔</span>}
                                            </span>
                                          ))
                                        ) : (
                                          <span className="text-slate-600 truncate">{leaf.parentCategory || 'সাধারণ জ্ঞান'}</span>
                                        )}
                                      </div>

                                      {/* Date Setter & Formatted Display */}
                                      <div className="flex items-center justify-between text-[10px] bg-emerald-50/60 p-1.5 rounded-xl border border-emerald-100">
                                        <span className="text-emerald-900 font-extrabold flex items-center gap-1 truncate">
                                          <Calendar className="w-3 h-3 text-emerald-600 shrink-0" />
                                          {leaf.date ? formatBengaliDate(leaf.date) : 'তারিখ দেওয়া হয়নি'}
                                        </span>
                                        <input
                                          type="date"
                                          value={leaf.date || ''}
                                          onChange={(e) => {
                                            const newDate = e.target.value;
                                            if (onUpdateSubcategory) {
                                              onUpdateSubcategory(leaf.id, leaf.name, leaf.parentCategory, newDate);
                                            }
                                          }}
                                          className="px-1.5 py-0.5 border border-emerald-200 rounded-lg text-[10px] font-bold text-gray-800 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 shrink-0"
                                          title="পরীক্ষার তারিখ পরিবর্তন করুন"
                                        />
                                      </div>

                                      {leaf.subHeading && (
                                        <div className="text-[10px] text-indigo-700 font-bold bg-indigo-50/80 px-2 py-0.5 rounded-md border border-indigo-100/80 truncate flex items-center gap-1">
                                          <span>🏷️ Sub-heading:</span> {leaf.subHeading}
                                        </div>
                                      )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-slate-200/60">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setCategory(fullPath[0] || 'সাধারণ জ্ঞান');
                                          setSubcategory(leaf.name);
                                          setAddFormSubcatChain(fullPath);
                                          setActiveTab('add');
                                        }}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-2.5 py-1 rounded-lg text-[10px] transition shadow-2xs flex items-center gap-1 cursor-pointer shrink-0"
                                        title="এই লিফ নোডে সরাসরি প্রশ্ন যোগ করুন"
                                      >
                                        ➕ প্রশ্ন যোগ
                                      </button>

                                      <div className="flex items-center gap-1 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingNodeId(leaf.id);
                                            setEditingNodeNewName(leaf.name);
                                            setEditingNodeSubHeading(leaf.subHeading || '');
                                            setEditingNodeDate(leaf.date || '');
                                            setEditingNodeNewParent(leaf.parentCategory);
                                            setEditingNodeType('subcategory');
                                            expandNodeAndParents(leaf.name);
                                            setCategoryViewTab('tree');
                                          }}
                                          className="text-amber-700 hover:bg-amber-100 px-2 py-1 rounded-md text-[10px] font-bold transition cursor-pointer"
                                          title="এডিট করুন"
                                        >
                                          ✏️ এডিট
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setDeleteConfirm({ id: leaf.id, name: leaf.name, type: 'subcategory' });
                                          }}
                                          className="text-rose-600 hover:bg-rose-100 px-2 py-1 rounded-md text-[10px] font-bold transition cursor-pointer"
                                          title="মুছুন"
                                        >
                                          ❌ মুছুন
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }}
                    </List>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: All Categories Overview Table */}
            {categoryViewTab === 'all_table' && (
              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col gap-6">
                <div className="border-b pb-3">
                  <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                    📋 সকল ক্যাটাগরি, সাব-ক্যাটাগরি ও লিফ নোডের পূর্ণাঙ্গ তালিকা (Complete Taxonomy List)
                  </h3>
                  <p className="text-[11px] text-gray-500 mt-1">
                    ক্যাটাগরি ট্রির প্রতিটি লেয়ারের সম্পূর্ণ বিবরণ, প্যারেন্ট নোড এবং সংশ্লিষ্ট প্রশ্ন সংখ্যা নিচে সারণি বা গ্রিড আকারে দেওয়া হলো।
                  </p>
                </div>

                {/* Section A: Root Categories */}
                <div className="space-y-3">
                  <h4 className="font-extrabold text-xs text-indigo-950 flex items-center gap-1.5 uppercase tracking-wider">
                    📚 মূল ক্যাটাগরি সমূহ (Root / Parent Categories)
                  </h4>
                  <div className="border border-slate-200 rounded-2xl overflow-hidden overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-extrabold border-b border-slate-200">
                        <tr>
                          <th className="p-3">ক্যাটাগরির নাম</th>
                          <th className="p-3">টাইপ / অবস্থান</th>
                          <th className="p-3">অধীনস্থ সাব-ক্যাটাগরি</th>
                          <th className="p-3">মোট প্রশ্ন</th>
                          <th className="p-3 text-right">অ্যাকশন</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {['বিষয়ভিত্তিক প্রস্তুতি', 'জব সলিউশন পরীক্ষা', 'সাল ভিত্তিক জব সলিউশন', ...(categories || []).map(c => c?.name || '').filter(Boolean)]
                          .filter((v, i, a) => a.indexOf(v) === i)
                          .map((rootName, idx) => {
                            const childCount = subcategories.filter(s => s.parentCategory === rootName).length;
                            const qCount = questions.filter(q => 
                              q.category === rootName || (q.categories && q.categories.includes(rootName))
                            ).length;
                            const catObj = categories.find(c => c.name === rootName);

                            return (
                              <tr key={idx} className="hover:bg-slate-50/80 transition">
                                <td className="p-3 font-bold text-slate-900">
                                  <div className="flex items-center gap-2">
                                    <span>📚</span>
                                    <span>{rootName}</span>
                                  </div>
                                  {catObj?.subHeading && (
                                    <div className="text-[10px] text-indigo-700 font-bold ml-6 mt-0.5">
                                      🏷️ {catObj.subHeading}
                                    </div>
                                  )}
                                </td>
                                <td className="p-3">
                                  <span className="bg-indigo-50 text-indigo-700 font-extrabold text-[10px] px-2 py-0.5 rounded-md">
                                    Root Category
                                  </span>
                                </td>
                                <td className="p-3 text-slate-600 font-bold">{childCount} টি উপ-ধাপ</td>
                                <td className="p-3 font-bold text-indigo-600">{qCount} টি</td>
                                <td className="p-3 text-right">
                                  {catObj && (
                                    <div className="flex items-center justify-end gap-1">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingNodeId(catObj.id);
                                          setEditingNodeNewName(catObj.name);
                                          setEditingNodeSubHeading(catObj.subHeading || '');
                                          setEditingNodeType('category');
                                          setCategoryViewTab('tree');
                                        }}
                                        className="text-amber-700 hover:underline font-bold text-[10px] px-1.5 py-1 cursor-pointer"
                                      >
                                        ✏️ এডিট
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setDeleteConfirm({ id: catObj.id, name: catObj.name, type: 'category' })}
                                        className="text-rose-600 hover:underline font-bold text-[10px] px-1.5 py-1 cursor-pointer"
                                      >
                                        ❌ মুছুন
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Section B: All Subcategories & Leaf Nodes Table */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-extrabold text-xs text-emerald-950 flex items-center gap-1.5 uppercase tracking-wider">
                      💼 সকল সাব-ক্যাটাগরি ও লিফ নোডের সারণি (Subcategories & Leaf Nodes)
                    </h4>
                    <span className="text-[10px] bg-emerald-50 text-emerald-800 font-bold px-2.5 py-0.5 rounded-md border border-emerald-200">
                      ⚡ react-window ভার্চুয়ালাইজড সারণি ({filteredAllSubcats.length} টি নোড)
                    </span>
                  </div>

                  {/* Subcategory Bulk Action Bar */}
                  {selectedSubcatIds.length > 0 && (
                    <div className="bg-gradient-to-r from-amber-50 to-indigo-50 border border-amber-200 p-3 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xs animate-scale-up">
                      <div className="flex items-center gap-2">
                        <span className="bg-amber-600 text-white text-[11px] font-extrabold px-3 py-1 rounded-full shadow-2xs">
                          {selectedSubcatIds.length} টি সাব-ক্যাটাগরি নির্বাচিত
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedSubcatIds([])}
                          className="text-[11px] text-slate-600 hover:text-slate-800 font-bold underline cursor-pointer"
                        >
                          ক্লিয়ার
                        </button>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          <label className="text-[10px] font-bold text-slate-700">নতুন প্যারেন্ট:</label>
                          <select
                            value={bulkSubcatMoveParent}
                            onChange={e => setBulkSubcatMoveParent(e.target.value)}
                            className="px-2 py-1 text-[11px] border border-slate-300 rounded-lg bg-white font-semibold text-slate-800"
                          >
                            <option value="বিষয়ভিত্তিক প্রস্তুতি">বিষয়ভিত্তিক প্রস্তুতি</option>
                            <option value="জব সলিউশন পরীক্ষা">জব সলিউশন পরীক্ষা</option>
                            <option value="সাল ভিত্তিক জব সলিউশন">সাল ভিত্তিক জব সলিউশন</option>
                            {(categories || []).map(c => (
                              <option key={c.id} value={c.name}>{c.name}</option>
                            ))}
                            {subcategories.filter(s => !selectedSubcatIds.includes(s.id)).map(s => (
                              <option key={s.id} value={s.name}>{s.name}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={handleBulkMoveSubcatAction}
                            className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold px-3 py-1.5 rounded-lg text-[11px] shadow-2xs flex items-center gap-1 cursor-pointer transition"
                          >
                            🚚 স্থানান্তরিত করুন
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={handleBulkDeleteSubcatAction}
                          className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold px-3 py-1.5 rounded-lg text-[11px] shadow-2xs flex items-center gap-1 cursor-pointer transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          একসাথে মুছুন ({selectedSubcatIds.length}টি)
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs overflow-x-auto">
                    <div className="grid grid-cols-12 bg-slate-100 text-slate-700 font-extrabold text-xs border-b border-slate-200 p-3 sticky top-0 z-10 min-w-[680px]">
                      <div className="col-span-1 flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedSubcatIds.length === filteredAllSubcats.length && filteredAllSubcats.length > 0}
                          onChange={() => handleSelectAllSubcats(filteredAllSubcats)}
                          className="rounded border-gray-300 w-3.5 h-3.5 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                      </div>
                      <div className="col-span-3">নাম</div>
                      <div className="col-span-3">প্যারেন্ট নোড / চেইন</div>
                      <div className="col-span-2">নোড টাইপ</div>
                      <div className="col-span-1">প্রশ্ন</div>
                      <div className="col-span-2 text-right">অ্যাকশন</div>
                    </div>

                    {filteredAllSubcats.length === 0 ? (
                      <div className="text-center py-8 text-gray-400 font-bold">
                        কোনো সাব-ক্যাটাগরি পাওয়া যায়নি।
                      </div>
                    ) : (
                      <List
                        height={450}
                        itemCount={filteredAllSubcats.length}
                        itemSize={52}
                        width="100%"
                      >
                        {({ index, style }) => {
                          const sub = filteredAllSubcats[index];
                          const isLeaf = !subcategories.some(
                            other => other.parentCategory && other.parentCategory.trim().toLowerCase() === sub.name.trim().toLowerCase()
                          );
                          const path = findSubcategoryPath(sub.name);
                          const qCount = nodeQuestionCountMap.get(sub.name.trim().toLowerCase()) || 0;
                          const isSubSelected = selectedSubcatIds.includes(sub.id);

                          return (
                            <div
                              style={style}
                              key={sub.id}
                              className={`grid grid-cols-12 items-center p-3 text-xs border-b border-slate-100 font-medium min-w-[680px] ${
                                isSubSelected ? 'bg-amber-50/60' : isLeaf ? 'bg-emerald-50/20 hover:bg-emerald-50/50' : 'hover:bg-slate-50/80'
                              }`}
                            >
                              <div className="col-span-1 flex items-center">
                                <input
                                  type="checkbox"
                                  checked={isSubSelected}
                                  onChange={() => handleToggleSelectSubcat(sub.id)}
                                  className="rounded border-gray-300 w-3.5 h-3.5 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                />
                              </div>
                              <div className="col-span-3 font-extrabold text-slate-900 flex flex-col justify-center truncate pr-2">
                                <div className="flex items-center gap-1.5 truncate">
                                  <span>{isLeaf ? '🍃' : '📂'}</span>
                                  <span className="truncate">{sub.name}</span>
                                </div>
                                {sub.subHeading && (
                                  <div className="text-[10px] text-indigo-700 font-bold ml-5 truncate">
                                    🏷️ {sub.subHeading}
                                  </div>
                                )}
                                {sub.date && (
                                  <div className="text-[10px] text-emerald-700 font-bold ml-5 truncate flex items-center gap-1">
                                    <Calendar className="w-3 h-3 text-emerald-600 shrink-0" />
                                    <span>{formatBengaliDate(sub.date)}</span>
                                  </div>
                                )}
                              </div>
                              <div className="col-span-3 text-slate-600 text-[11px] truncate pr-2">
                                {path.length > 0 ? path.join(' ➔ ') : sub.parentCategory}
                              </div>
                              <div className="col-span-2">
                                {isLeaf ? (
                                  <span className="bg-emerald-100 text-emerald-800 font-black text-[9.5px] px-2 py-0.5 rounded-md border border-emerald-300 shadow-2xs">
                                    🍃 Leaf Node
                                  </span>
                                ) : (
                                  <span className="bg-blue-50 text-blue-700 font-bold text-[9.5px] px-2 py-0.5 rounded-md">
                                    Branch Subcategory
                                  </span>
                                )}
                              </div>
                              <div className="col-span-2">
                                <button
                                  type="button"
                                  onClick={() => setViewNodeQuestionsModal({ nodeName: sub.name, questions: getQuestionsForNode(sub.name) })}
                                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-[10px] px-2 py-1 rounded-md border border-indigo-200 transition cursor-pointer"
                                  title="প্রশ্নগুলো দেখুন"
                                >
                                  {qCount} টি (দেখুন 👁️)
                                </button>
                              </div>
                              <div className="col-span-2 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {isLeaf && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCategory(path[0] || 'সাধারণ জ্ঞান');
                                        setSubcategory(sub.name);
                                        setAddFormSubcatChain(path);
                                        setActiveTab('add');
                                      }}
                                      className="text-emerald-700 hover:underline font-extrabold text-[10px] px-1 cursor-pointer"
                                    >
                                      ➕ প্রশ্ন যোগ
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingNodeId(sub.id);
                                      setEditingNodeNewName(sub.name);
                                      setEditingNodeSubHeading(sub.subHeading || '');
                                      setEditingNodeDate(sub.date || '');
                                      setEditingNodeNewParent(sub.parentCategory);
                                      setEditingNodeType('subcategory');
                                      expandNodeAndParents(sub.name);
                                      setCategoryViewTab('tree');
                                    }}
                                    className="text-amber-700 hover:underline font-bold text-[10px] px-1 cursor-pointer"
                                  >
                                    ✏️ এডিট
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDeleteConfirm({ id: sub.id, name: sub.name, type: 'subcategory' })}
                                    className="text-rose-600 hover:underline font-bold text-[10px] px-1 cursor-pointer"
                                  >
                                    ❌ মুছুন
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        }}
                      </List>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: Hidden & Implicit Nodes View */}
            {categoryViewTab === 'hidden_nodes' && (
              <div className="bg-white p-6 rounded-3xl border border-purple-100 shadow-sm flex flex-col gap-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-100 pb-3">
                  <div>
                    <h3 className="font-extrabold text-sm text-purple-950 flex items-center gap-2">
                      🕵️‍♂️ লুকানো, আনম্যাপড ও হিডেন নোড সমূহ (Hidden & Implicit Categories in Questions)
                    </h3>
                    <p className="text-[11px] text-purple-700 mt-1">
                      যেসব ক্যাটাগরি, সাব-ক্যাটাগরি বা টপিক নাম কুইজ/প্রশ্ন ব্যাংকে ব্যবহার করা হয়েছে কিন্তু মূল ক্যাটাগরি ট্রিতে আনুষ্ঠানিকভাবে নিবন্ধিত নেই, সেগুলো নিচে দেখানো হলো।
                    </p>
                  </div>

                  {hiddenNodes.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        showCustomConfirm(
                          'সকল হিডেন নোড সিঙ্ক নিশ্চিতকরণ',
                          `আপনি কি নিশ্চিতভাবে সনাক্তকৃত ${hiddenNodes.length} টি হিডেন ক্যাটাগরি/টপিককে মূল ট্রিতে নিবন্ধন করতে চান?`,
                          () => {
                            hiddenNodes.forEach(hn => {
                              const parent = unmappedNodeParents[hn.name] || hn.suggestedParent;
                              onAddSubcategory(hn.name, parent);
                            });
                            showCustomAlert('সম্পন্ন হয়েছে!', 'সকল হিডেন নোড সফলভাবে ক্যাটাগরি ট্রিতে সিঙ্ক ও রেজিস্টার করা হয়েছে!', 'success');
                          },
                          'info'
                        );
                      }}
                      className="bg-purple-600 hover:bg-purple-700 text-white font-extrabold px-3.5 py-2 rounded-xl text-xs transition shadow-xs flex items-center gap-1.5 shrink-0 self-start sm:self-auto cursor-pointer"
                    >
                      ⚡ সব {hiddenNodes.length} টি ট্রিতে অটো-নিবন্ধন করুন
                    </button>
                  )}
                </div>

                {hiddenNodes.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 font-bold bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                    🎉 কোনো হিডেন বা আনম্যাপড ক্যাটাগরি পাওয়া যায়নি! সকল প্রশ্ন ক্যাটাগরি ট্রির সাথে পুরোপুরি সিঙ্কড রয়েছে।
                  </div>
                ) : (
                  <div className="border border-purple-200/80 rounded-2xl bg-purple-50/30 p-2 overflow-hidden">
                    <div className="flex items-center justify-between text-[11px] text-purple-900 bg-purple-100/70 px-3 py-1.5 rounded-xl mb-2 font-semibold border border-purple-200">
                      <span>⚡ react-window উইন্ডোয়েজড ভার্চুয়ালাইজেশন সক্রিয়</span>
                      <span className="font-extrabold">{hiddenNodes.length} টি হিডেন নোড</span>
                    </div>

                    <List
                      height={550}
                      itemCount={hiddenNodeRows.length}
                      itemSize={240}
                      width="100%"
                    >
                      {({ index, style }) => {
                        const rowItems = hiddenNodeRows[index];

                        return (
                          <div style={{ ...style, padding: '4px' }} key={index}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 h-full">
                              {rowItems.map((hn, hIdx) => {
                                const currentSelectedParent = unmappedNodeParents[hn.name] || hn.suggestedParent;

                                return (
                                  <div key={hIdx} className="bg-white hover:bg-purple-50 p-3.5 rounded-2xl border border-purple-200/80 transition flex flex-col justify-between gap-2.5 shadow-2xs group h-[230px]">
                                    <div className="space-y-1.5">
                                      <div className="flex items-start justify-between gap-2">
                                        <div>
                                          <span className="bg-purple-100 text-purple-900 font-extrabold text-[9px] px-2 py-0.5 rounded-md border border-purple-300 inline-block mb-1">
                                            🕵️‍♂️ আনম্যাপড নোড
                                          </span>
                                          <h4 className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5 truncate">
                                            <span>🍃</span> <span className="truncate">{hn.name}</span>
                                          </h4>
                                        </div>
                                        <span className="bg-purple-600 text-white font-extrabold text-[10px] px-2 py-0.5 rounded-full shrink-0 shadow-2xs">
                                          {hn.questionCount} টি প্রশ্ন
                                        </span>
                                      </div>

                                      <div className="bg-purple-50/60 p-2 rounded-xl border border-purple-150 text-[10.5px] space-y-1">
                                        <label className="text-purple-800 font-extrabold block text-[9.5px]">
                                          📁 প্রস্তাবিত প্যারেন্ট ক্যাটাগরি:
                                        </label>
                                        <select
                                          value={currentSelectedParent}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            setUnmappedNodeParents(prev => ({ ...prev, [hn.name]: val }));
                                          }}
                                          className="w-full px-2 py-1 border border-purple-200 rounded-lg bg-white text-slate-900 font-extrabold focus:outline-none focus:ring-1 focus:ring-purple-500 text-[10.5px] cursor-pointer"
                                        >
                                          <optgroup label="মূল ক্যাটাগরি (Root Zones)">
                                            <option value="বিষয়ভিত্তিক প্রস্তুতি">বিষয়ভিত্তিক প্রস্তুতি</option>
                                            <option value="জব সলিউশন পরীক্ষা">জব সলিউশন পরীক্ষা</option>
                                            <option value="সাল ভিত্তিক জব সলিউশন">সাল ভিত্তিক জব সলিউশন</option>
                                            {(categories || []).map(c => (
                                              <option key={c.id} value={c.name}>{c.name}</option>
                                            ))}
                                          </optgroup>
                                          {subcategories.length > 0 && (
                                            <optgroup label="বিদ্যমান সাব-ক্যাটাগরি সমূহ">
                                              {subcategories
                                                .filter(s => s.name.trim().toLowerCase() !== hn.name.trim().toLowerCase())
                                                .map(s => (
                                                  <option key={s.id} value={s.name}>{s.name}</option>
                                                ))
                                              }
                                            </optgroup>
                                          )}
                                        </select>
                                      </div>

                                      {/* Sample questions preview */}
                                      {hn.sampleQuestions.length > 0 && (
                                        <div className="space-y-0.5">
                                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">নমুনা প্রশ্ন:</span>
                                          {hn.sampleQuestions.slice(0, 1).map((sq, sIdx) => (
                                            <div key={sq.id || sIdx} className="text-[9.5px] text-slate-700 bg-slate-50 p-1 rounded-md border border-slate-200/70 truncate">
                                              • {sq.text}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>

                                    {/* Action Button */}
                                    <div className="pt-1.5 border-t border-purple-200/60 flex items-center justify-between gap-2">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          onAddSubcategory(hn.name, currentSelectedParent);
                                          showCustomAlert('নিবন্ধিত হয়েছে!', `"${hn.name}" সফলভাবে "${currentSelectedParent}" এর অধীনে যুক্ত করা হয়েছে।`, 'success');
                                        }}
                                        className="w-full bg-purple-600 hover:bg-purple-700 text-white font-extrabold py-1 px-3 rounded-xl transition shadow-2xs text-[10.5px] flex items-center justify-center gap-1 cursor-pointer"
                                      >
                                        ➕ ট্রিতে নিবন্ধন করুন
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }}
                    </List>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* 3. EXAMS & NOTICE BOARD */}
      {activeTab === 'exams' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 text-xs">
          {/* Notice Board Settings */}
          <div className="md:col-span-5 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-4">
            <h3 className="font-bold text-sm text-gray-800 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-indigo-600" />
              📢 নোটিশ বোর্ড আপডেট করুন
            </h3>
            <div>
              <label className="block text-gray-500 mb-1">সর্বশেষ নোটিশ টেক্সট:</label>
              <textarea 
                rows={4}
                value={noticeText}
                onChange={e => setNoticeText(e.target.value)}
                placeholder="নতুন কোনো আপডেট থাকলে এখানে লিখুন যা সরাসরি হোমপেজে প্রদর্শিত হবে..."
                className="w-full px-3 py-2 border rounded-xl text-gray-800 focus:outline-none"
              />
            </div>
            <button 
              onClick={handleSaveNoticeText}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl transition shadow"
            >
              নোটিশ পাবলিশ করুন
            </button>
          </div>

          {/* Live Exam Management */}
          <div className="md:col-span-7 flex flex-col gap-5">
            {/* Create Exam */}
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
              <h3 className="font-bold text-sm text-gray-800 mb-3 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-red-600" />
                ⏱️ নতুন অফিশিয়াল লাইভ পরীক্ষা যুক্ত করুন
              </h3>
              <form onSubmit={handleCreateLiveExam} className="space-y-3">
                <div>
                  <label className="block text-gray-600 mb-1 font-medium">পরীক্ষার নাম/শিরোনাম:</label>
                  <input 
                    type="text" 
                    required
                    value={examTitle}
                    onChange={e => setExamTitle(e.target.value)}
                    placeholder="যেমন: ৪৬তম বিসিএস স্পেশাল মডেল টেস্ট - ০৩" 
                    className="w-full px-3 py-2 border rounded-xl text-gray-800 focus:outline-none text-xs" 
                  />
                </div>

                <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-100">
                  <input 
                    type="checkbox" 
                    id="manual-select" 
                    checked={isManualSelection} 
                    onChange={e => setIsManualSelection(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                  />
                  <label htmlFor="manual-select" className="font-extrabold text-xs text-indigo-950 cursor-pointer select-none">
                    🛠️ প্রশ্নের ম্যানুয়াল ক্যাটাগরিভিত্তিক নির্বাচন (Manual MCQ Selection) সক্রিয় করুন
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-600 mb-1 font-medium">প্রশ্ন সংখ্যা সীমা (Questions Limit):</label>
                    <input 
                      type="number" 
                      required
                      min={1}
                      max={questions.length}
                      value={examQLimit}
                      onChange={e => setExamQLimit(Number(e.target.value))}
                      className="w-full px-3 py-2 border rounded-xl text-gray-800 focus:outline-none text-xs" 
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 mb-1 font-medium">পরীক্ষার সময় (মিনিট):</label>
                    <input 
                      type="number" 
                      required
                      min={1}
                      value={examTimeLimit}
                      onChange={e => setExamTimeLimit(Number(e.target.value))}
                      className="w-full px-3 py-2 border rounded-xl text-gray-800 focus:outline-none text-xs" 
                    />
                  </div>
                </div>

                {isManualSelection && (
                  <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-2xl">
                    <h4 className="font-extrabold text-indigo-950 text-xs mb-2">
                      📊 ৮টি ক্যাটাগরিভিত্তিক প্রশ্নের কোটা নির্ধারণ করুন:
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                      {MANUAL_CATEGORIES.map(cat => (
                        <div key={cat.id} className="flex flex-col gap-1 bg-white p-2 rounded-xl border border-indigo-50">
                          <span className="font-bold text-[10px] text-gray-700">{cat.name.split(' (')[1].replace(')', '')} / {cat.name.split(' (')[0]}</span>
                          <input
                            type="number"
                            min={0}
                            value={categoryLimits[cat.id] || 0}
                            onChange={e => {
                              const val = Math.max(0, Number(e.target.value));
                              setCategoryLimits({ ...categoryLimits, [cat.id]: val });
                            }}
                            className="w-full px-2 py-1 border rounded-lg text-xs font-extrabold text-indigo-600 focus:outline-none"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between items-center mt-3 pt-2.5 border-t border-indigo-100 text-xs">
                      <span className="font-bold text-gray-600">
                        টার্গেট মোট প্রশ্ন: <b className="text-gray-900 font-black">{examQLimit}টি</b>
                      </span>
                      <span className={`font-black px-2 py-1 rounded-md ${
                        Object.values(categoryLimits).reduce((s: number, v: any) => s + Number(v), 0) === Number(examQLimit)
                          ? 'text-green-600 bg-green-50' 
                          : 'text-rose-600 bg-rose-50'
                      }`}>
                        বর্তমান কোটার যোগফল: {Object.values(categoryLimits).reduce((s: number, v: any) => s + Number(v), 0)}টি {
                          Object.values(categoryLimits).reduce((s: number, v: any) => s + Number(v), 0) === Number(examQLimit) ? '✓' : '✕'
                        }
                      </span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-1">
                    <label className="block text-gray-600 mb-1 font-medium">পরীক্ষার বিষয়:</label>
                    {isManualSelection ? (
                      <input 
                        type="text" 
                        disabled 
                        value="ম্যানুয়াল সিলেকশন (Mixed)"
                        className="w-full px-3 py-2 border rounded-xl bg-gray-50 text-gray-500 focus:outline-none text-xs font-bold" 
                      />
                    ) : (
                      <select 
                        value={examCategory}
                        onChange={e => setExamCategory(e.target.value)}
                        className="w-full px-3 py-2 border rounded-xl bg-white text-gray-800 focus:outline-none text-xs"
                      >
                        <option value="ALL">সব বিষয় মিলিয়ে</option>
                        {distinctCategories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    )}
                  </div>
                  <div className="sm:col-span-1">
                    <label className="block text-gray-600 mb-1 font-medium">শুরুর সময়:</label>
                    <input 
                      type="datetime-local" 
                      required
                      value={examStartTime}
                      onChange={e => setExamStartTime(e.target.value)}
                      className="w-full px-3 py-1.5 border rounded-xl text-gray-800 focus:outline-none text-xs" 
                    />
                  </div>
                  <div className="sm:col-span-1">
                    <label className="block text-gray-600 mb-1 font-medium">শেষের সময়সীমা:</label>
                    <input 
                      type="datetime-local" 
                      required
                      value={examExpiryTime}
                      onChange={e => setExamExpiryTime(e.target.value)}
                      className="w-full px-3 py-1.5 border rounded-xl text-gray-800 focus:outline-none text-xs" 
                    />
                  </div>
                </div>

                {isManualSelection && (
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col gap-4 mt-4 text-xs">
                    <div className="border-b pb-2">
                      <h4 className="font-extrabold text-indigo-950 text-sm flex items-center gap-2">
                        🎯 ম্যানুয়াল প্রশ্ন নির্বাচন ও ক্যাস্কেডিং ফিল্টার প্যানেল
                      </h4>
                      <p className="text-[10px] text-gray-500 font-semibold mt-0.5">
                        নিচের ৮টি বিষয় ক্যাটাগরির ট্যাব নির্বাচন করুন এবং ক্যাস্কেডিং ফিল্টার ব্যবহার করে ডাটাবেস থেকে প্রশ্নসমূহ ম্যানুয়ালি সিলেক্ট করুন।
                      </p>
                    </div>

                    {/* 8 Category Tabs */}
                    <div className="flex flex-wrap gap-1.5 border-b pb-2.5">
                      {MANUAL_CATEGORIES.map(cat => {
                        const limit = categoryLimits[cat.id] || 0;
                        const selectedCount = selectedQuestionsByCategory[cat.id]?.length || 0;
                        const isActive = activeSelectionTab === cat.id;
                        const isDone = selectedCount === limit && limit > 0;

                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setActiveSelectionTab(cat.id)}
                            className={`px-3 py-2 rounded-xl font-extrabold text-[10px] transition flex items-center gap-1.5 ${
                              isActive
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : isDone
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-white text-gray-600 hover:bg-indigo-50 border border-gray-200/50'
                            }`}
                          >
                            <span>{cat.name.split(' (')[1].replace(')', '')}</span>
                            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'}`}>
                              {selectedCount}/{limit}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Active Selection Area */}
                    {(() => {
                      const activeCat = MANUAL_CATEGORIES.find(c => c.id === activeSelectionTab);
                      const limit = categoryLimits[activeSelectionTab] || 0;
                      const selectedList = selectedQuestionsByCategory[activeSelectionTab] || [];
                      const filteredList = getFilteredManualQuestions();

                      // Reset dependents on cascading changes
                      const handleMainCatChange = (val: string) => {
                        setManualFilterMainCat(val);
                        setManualSubcatFilterChain([]);
                      };

                      const toggleQuestionSelection = (qId: string) => {
                        const activeList = selectedQuestionsByCategory[activeSelectionTab] || [];
                        if (activeList.includes(qId)) {
                          setSelectedQuestionsByCategory({
                            ...selectedQuestionsByCategory,
                            [activeSelectionTab]: activeList.filter(id => id !== qId)
                          });
                        } else {
                          if (activeList.length >= limit) {
                            alert(`আপনি ইতিমধ্যে এই ক্যাটাগরির সর্বোচ্চ কোটা (${limit}টি) পূরণ করেছেন! নতুন প্রশ্ন নির্বাচন করার পূর্বে পূর্বের কোনো নির্বাচন বাতিল করুন বা কোটার পরিমাণ বৃদ্ধি করুন।`);
                            return;
                          }
                          setSelectedQuestionsByCategory({
                            ...selectedQuestionsByCategory,
                            [activeSelectionTab]: [...activeList, qId]
                          });
                        }
                      };

                      const getSelectedCategoryForQuestion = (qId: string): string | null => {
                        for (const [catId, ids] of Object.entries(selectedQuestionsByCategory)) {
                          const idList = ids as string[];
                          if (idList.includes(qId)) {
                            const cat = MANUAL_CATEGORIES.find(c => c.id === catId);
                            return cat ? cat.name.split(' (')[1].replace(')', '') : catId;
                          }
                        }
                        return null;
                      };

                      // Auto-fill using classified recommended questions
                      const autoFillRecommended = () => {
                        const needed = limit - selectedList.length;
                        if (needed <= 0) {
                          alert("ইতিমধ্যে কোটা সম্পূর্ণ রয়েছে!");
                          return;
                        }
                        const matchingRecs = questions.filter(q => {
                          if (classifyQuestion(q) !== activeSelectionTab) return false;
                          return !getSelectedCategoryForQuestion(q.id);
                        });

                        if (matchingRecs.length === 0) {
                          alert("দুঃখিত, এই ক্যাটাগরির জন্য কোনো অব্যবহৃত রেকমেন্ডেড প্রশ্ন খুঁজে পাওয়া যায়নি!");
                          return;
                        }

                        const shuffled = [...matchingRecs].sort(() => 0.5 - Math.random());
                        const toAdd = shuffled.slice(0, needed).map(q => q.id);

                        setSelectedQuestionsByCategory({
                          ...selectedQuestionsByCategory,
                          [activeSelectionTab]: [...selectedList, ...toAdd]
                        });
                        alert(`✨ সফলভাবে ${toAdd.length}টি রেকমেন্ডেড প্রশ্ন অটো-ফিল করা হয়েছে!`);
                      };

                      // Auto-fill using currently filtered list
                      const autoFillRandomFiltered = () => {
                        const needed = limit - selectedList.length;
                        if (needed <= 0) {
                          alert("ইতিমধ্যে কোটা সম্পূর্ণ রয়েছে!");
                          return;
                        }
                        const matchingPool = filteredList.filter(q => {
                          return !getSelectedCategoryForQuestion(q.id) && !selectedList.includes(q.id);
                        });

                        if (matchingPool.length === 0) {
                          alert("দুঃখিত, বর্তমান ফিল্টার করা তালিকায় কোনো অতিরিক্ত অব্যবহৃত প্রশ্ন নেই!");
                          return;
                        }

                        const shuffled = [...matchingPool].sort(() => 0.5 - Math.random());
                        const toAdd = shuffled.slice(0, needed).map(q => q.id);

                        setSelectedQuestionsByCategory({
                          ...selectedQuestionsByCategory,
                          [activeSelectionTab]: [...selectedList, ...toAdd]
                        });
                        alert(`🎲 সফলভাবে ${toAdd.length}টি ফিল্টার্ড প্রশ্ন অটো-ফিল করা হয়েছে!`);
                      };

                      // Select all matching filtered list questions up to limit
                      const selectAllMatching = () => {
                        const needed = limit - selectedList.length;
                        if (needed <= 0) {
                          alert("ইতিমধ্যে কোটা সম্পূর্ণ রয়েছে!");
                          return;
                        }
                        const available = filteredList.filter(q => {
                          return !getSelectedCategoryForQuestion(q.id) && !selectedList.includes(q.id);
                        });

                        if (available.length === 0) {
                          alert("নির্বাচন করার মতো নতুন কোনো অব্যবহৃত প্রশ্ন পাওয়া যায়নি!");
                          return;
                        }

                        const toAdd = available.slice(0, needed).map(q => q.id);
                        setSelectedQuestionsByCategory({
                          ...selectedQuestionsByCategory,
                          [activeSelectionTab]: [...selectedList, ...toAdd]
                        });
                        alert(`✓ সফলভাবে ${toAdd.length}টি প্রশ্ন একসাথে সিলেক্ট করা হয়েছে!`);
                      };

                      // Clear current active tab selections
                      const clearTabSelections = () => {
                        if (selectedList.length === 0) return;
                        setSelectedQuestionsByCategory({
                          ...selectedQuestionsByCategory,
                          [activeSelectionTab]: []
                        });
                      };

                      // Clear all tab selections
                      const clearAllSelections = () => {
                        const totalSelected = Object.values(selectedQuestionsByCategory).reduce((sum: number, list: any) => sum + (Array.isArray(list) ? list.length : 0), 0);
                        if (totalSelected === 0) return;
                        showCustomConfirm(
                          'নির্বাচন রিসেট নিশ্চিতকরণ',
                          "আপনি কি নিশ্চিতভাবে সব ক্যাটাগরির সিলেক্টেড প্রশ্নসমূহ রিসেট করতে চান?",
                          () => {
                            setSelectedQuestionsByCategory({
                              bangla: [],
                              bengaliLit: [],
                              english: [],
                              englishLit: [],
                              math: [],
                              science: [],
                              bdAffairs: [],
                              intlAffairs: []
                            });
                            showCustomAlert('সম্পন্ন হয়েছে!', 'সব ক্যাটাগরির সিলেক্টেড প্রশ্নসমূহ রিসেট করা হয়েছে!', 'success');
                          },
                          'warning'
                        );
                      };

                      return (
                        <div className="flex flex-col gap-3">
                          <div className="flex justify-between items-center p-2 bg-indigo-50/40 border border-indigo-100/50 rounded-xl">
                            <span className="font-bold text-indigo-900">
                              বিষয়: <b className="text-indigo-950 font-black">{activeCat?.name}</b>
                            </span>
                            <span className={`font-extrabold text-[10px] px-2.5 py-1 rounded-full ${selectedList.length === limit && limit > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                              {selectedList.length === limit && limit > 0 ? '✓ কোটা সম্পূর্ণ' : `⏳ আরও ${limit - selectedList.length}টি প্রশ্ন নির্বাচন করুন`}
                            </span>
                          </div>

                          {/* Cascading & Advanced Filter Controls */}
                          <div className="bg-white p-3.5 rounded-xl border border-slate-200/60 flex flex-col gap-3">
                            <div className="flex flex-wrap gap-2.5 items-end">
                              <div className="flex flex-col gap-1 min-w-[140px] flex-1 sm:flex-initial">
                                <span className="font-extrabold text-gray-500 text-[10px] uppercase">ধাপ ১: মূল জোন</span>
                                <select
                                  value={manualFilterMainCat}
                                  onChange={e => handleMainCatChange(e.target.value)}
                                  className="px-2 py-1.5 border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] font-bold text-gray-700 transition"
                                >
                                  <option value="ALL">সকল উৎস (সব প্রশ্ন)</option>
                                  <option value="বিষয়ভিত্তিক প্রস্তুতি">বিষয়ভিত্তিক প্রস্তুতি</option>
                                  <option value="জব সলিউশন পরীক্ষা">জব সলিউশন পরীক্ষা</option>
                                  <option value="সাল ভিত্তিক জব সলিউশন">সাল ভিত্তিক জব সলিউশন</option>
                                </select>
                              </div>

                              {(() => {
                                const selectBoxes: React.ReactNode[] = [];
                                const maxDepth = manualSubcatFilterChain.length;

                                for (let i = 0; i <= maxDepth; i++) {
                                  let options: SubcategoryItem[] = [];

                                  if (i === 0) {
                                    if (manualFilterMainCat === 'ALL') {
                                      options = subcategories.filter(s => s.parentCategory === 'বিষয়ভিত্তিক প্রস্তুতি' || isJobSolutionVariation(s.parentCategory) || isYearJobSolutionVariation(s.parentCategory));
                                    } else if (isJobSolutionVariation(manualFilterMainCat)) {
                                      options = subcategories.filter(s => isJobSolutionVariation(s.parentCategory));
                                    } else if (isYearJobSolutionVariation(manualFilterMainCat)) {
                                      options = subcategories.filter(s => isYearJobSolutionVariation(s.parentCategory));
                                    } else {
                                      options = subcategories.filter(s => s.parentCategory === manualFilterMainCat);
                                    }
                                  } else {
                                    const parentVal = manualSubcatFilterChain[i - 1];
                                    if (parentVal && parentVal !== 'ALL') {
                                      options = subcategories.filter(s => s.parentCategory === parentVal);
                                    }
                                  }

                                  if (options.length === 0) continue;

                                  const currentSelection = manualSubcatFilterChain[i] || 'ALL';

                                  selectBoxes.push(
                                    <div key={`manual-cascade-filter-level-${i}`} className="flex flex-col gap-1 min-w-[140px] flex-1 sm:flex-initial">
                                      <span className="font-extrabold text-gray-500 text-[10px] uppercase">
                                        {i === 0 ? 'ধাপ ২: বিষয় ক্যাটাগরি' : `ধাপ ${i + 2}: সাব-ক্যাটাগরি`}
                                      </span>
                                      <select
                                        value={currentSelection}
                                        onChange={e => {
                                          const val = e.target.value;
                                          const newChain = [...manualSubcatFilterChain];
                                          if (val === 'ALL') {
                                            newChain.splice(i);
                                          } else {
                                            newChain[i] = val;
                                            newChain.splice(i + 1);
                                          }
                                          setManualSubcatFilterChain(newChain);
                                        }}
                                        className="px-2 py-1.5 border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] font-bold text-gray-700 transition"
                                      >
                                        <option value="ALL">--- সব ---</option>
                                        {options.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                      </select>
                                    </div>
                                  );
                                }

                                return selectBoxes;
                              })()}

                              <div className="flex flex-col gap-1 min-w-[140px] flex-1 sm:flex-initial">
                                <span className="font-extrabold text-gray-500 text-[10px] uppercase">খুঁজুন (সার্চ করুন)</span>
                                <input
                                  type="text"
                                  placeholder="প্রশ্ন বা ব্যাখ্যার অংশবিশেষ..."
                                  value={manualSearchQuery}
                                  onChange={e => setManualSearchQuery(e.target.value)}
                                  className="px-2 py-1.5 border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px]"
                                />
                              </div>
                            </div>

                            {/* Advanced Filters Line */}
                            <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-slate-100 text-[10px]">
                              <div className="flex flex-wrap items-center gap-3">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-gray-500">সিলেকশন ফিল্টার:</span>
                                  <div className="inline-flex rounded-md shadow-xs bg-slate-100 p-0.5">
                                    <button
                                      type="button"
                                      onClick={() => setManualFilterSelectionStatus('ALL')}
                                      className={`px-2 py-1 rounded text-[9px] font-extrabold transition-colors ${manualFilterSelectionStatus === 'ALL' ? 'bg-white text-indigo-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
                                    >
                                      সব প্রশ্ন
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setManualFilterSelectionStatus('SELECTED')}
                                      className={`px-2 py-1 rounded text-[9px] font-extrabold transition-colors ${manualFilterSelectionStatus === 'SELECTED' ? 'bg-white text-indigo-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
                                    >
                                      শুধু নির্বাচিত ({selectedList.length})
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setManualFilterSelectionStatus('UNSELECTED')}
                                      className={`px-2 py-1 rounded text-[9px] font-extrabold transition-colors ${manualFilterSelectionStatus === 'UNSELECTED' ? 'bg-white text-indigo-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
                                    >
                                      অনির্বাচিত
                                    </button>
                                  </div>
                                </div>

                                <label className="flex items-center gap-1.5 font-bold text-gray-600 cursor-pointer select-none bg-amber-50/50 hover:bg-amber-50 border border-amber-100 px-2 py-1 rounded-md transition-colors">
                                  <input
                                    type="checkbox"
                                    checked={manualFilterRecommendationOnly}
                                    onChange={e => setManualFilterRecommendationOnly(e.target.checked)}
                                    className="rounded text-amber-600 focus:ring-amber-500 w-3 h-3 cursor-pointer"
                                  />
                                  <span>✨ শুধু রেকমেন্ডেড কন্টেন্ট দেখুন</span>
                                </label>
                              </div>

                              <div className="font-semibold text-gray-400">
                                বর্তমান ফিল্টারে মিলছে: <b className="text-slate-700 font-extrabold">{filteredList.length}টি প্রশ্ন</b>
                              </div>
                            </div>
                          </div>

                          {/* Quick Actions Panel */}
                          <div className="bg-indigo-50/20 border border-indigo-100/40 p-2.5 rounded-xl flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between text-[10px]">
                            <span className="font-extrabold text-indigo-950/80 flex items-center gap-1">
                              ⚡ কুইক অটো-ফিল ও সিলেকশন টুলস:
                            </span>
                            <div className="flex flex-wrap gap-1">
                              <button
                                type="button"
                                onClick={autoFillRecommended}
                                className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white font-extrabold rounded-lg shadow-xs transition"
                                title="ক্যাটাগরির রেকমেন্ডেড প্রশ্ন থেকে স্বয়ংক্রিয়ভাবে র্যান্ডম প্রশ্ন সিলেক্ট করে কোটা পূরণ করুন"
                              >
                                ✨ রেকমেন্ডেড অটো-ফিল
                              </button>
                              <button
                                type="button"
                                onClick={autoFillRandomFiltered}
                                className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-lg shadow-xs transition"
                                title="বর্তমান ফিল্টার করা তালিকা থেকে র্যান্ডম প্রশ্ন সিলেক্ট করে কোটা পূরণ করুন"
                              >
                                🎲 র্যান্ডম অটো-ফিল
                              </button>
                              <button
                                type="button"
                                onClick={selectAllMatching}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg shadow-xs transition"
                                title="বর্তমান ফিল্টারের প্রশ্নসমূহকে কোটা সীমা পর্যন্ত একসাথে সিলেক্ট করুন"
                              >
                                ✓ ফিল্টার্ড সিলেক্ট করুন
                              </button>
                              <button
                                type="button"
                                onClick={clearTabSelections}
                                className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold rounded-lg border border-rose-200 transition"
                                title="শুধুমাত্র এই বিষয়ের সব সিলেকশন ক্লিয়ার করুন"
                              >
                                🧹 এই বিষয় রিসেট
                              </button>
                              <button
                                type="button"
                                onClick={clearAllSelections}
                                className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold rounded-lg border border-gray-200 transition"
                                title="৮টি বিষয়ের সম্পূর্ণ সিলেকশন ক্লিয়ার করুন"
                              >
                                🧹 সব রিসেট
                              </button>
                            </div>
                          </div>

                          {/* Questions List scroll area */}
                          <div className="border border-slate-100 rounded-xl bg-white max-h-[300px] overflow-y-auto divide-y divide-slate-100">
                            {filteredList.length === 0 ? (
                              <p className="text-center py-8 text-gray-400 font-bold">কোনো মিল থাকা প্রশ্ন পাওয়া যায়নি। ফিল্টার পরিবর্তন করে চেষ্টা করুন।</p>
                            ) : (
                              filteredList.map((q) => {
                                const isChecked = selectedList.includes(q.id);
                                const belongsToOtherCat = getSelectedCategoryForQuestion(q.id);
                                const isRecommended = classifyQuestion(q) === activeSelectionTab;

                                return (
                                  <div
                                    key={q.id}
                                    onClick={() => {
                                      if (belongsToOtherCat && !isChecked) {
                                        alert(`এই প্রশ্নটি ইতিমধ্যে "${belongsToOtherCat}" ক্যাটাগরিতে সিলেক্ট করা রয়েছে।`);
                                        return;
                                      }
                                      toggleQuestionSelection(q.id);
                                    }}
                                    className={`p-3 flex items-start gap-3 cursor-pointer hover:bg-slate-50/80 transition ${
                                      isChecked ? 'bg-indigo-50/25' : ''
                                    }`}
                                  >
                                    <div className="mt-0.5 shrink-0">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        readOnly
                                        className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                      />
                                    </div>

                                    <div className="flex-1 flex flex-col gap-1">
                                      <p className="font-extrabold text-gray-800 leading-snug">
                                        {q.text}
                                      </p>
                                      <div className="flex flex-wrap gap-2 text-[9px] font-semibold text-gray-400">
                                        <span className="bg-slate-100 px-1.5 py-0.5 rounded-md">ক্যাটাগরি: {q.category}</span>
                                        {q.subcategory && <span className="bg-slate-100 px-1.5 py-0.5 rounded-md">সাব: {q.subcategory}</span>}
                                        {isRecommended && (
                                          <span className="bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-md flex items-center gap-0.5 animate-pulse">
                                            ✨ রেকমেন্ডেড কন্টেন্ট
                                          </span>
                                        )}
                                        {belongsToOtherCat && !isChecked && (
                                          <span className="bg-rose-50 text-rose-600 border border-rose-200 px-1.5 py-0.5 rounded-md font-black">
                                            🔒 "{belongsToOtherCat}" ক্যাটাগরিতে ব্যবহৃত
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>

                          {/* Live Summary / Review Selected Panel */}
                          {(() => {
                            const totalSelected = Object.values(selectedQuestionsByCategory).reduce((sum: number, list: any) => sum + (Array.isArray(list) ? list.length : 0), 0);
                            const totalTarget = Object.values(categoryLimits).reduce((sum: number, val: any) => sum + Number(val), 0);
                            
                            return (
                              <div className="border border-slate-200 rounded-xl bg-white overflow-hidden mt-2">
                                <div className="bg-slate-50/85 px-3 py-2 border-b flex justify-between items-center">
                                  <span className="font-extrabold text-indigo-950 text-xs flex items-center gap-1.5">
                                    📋 নির্বাচিত প্রশ্নসমূহের লাইভ রিভিউ ও পরিবর্তন ({totalSelected} / {totalTarget}টি সিলেক্টেড)
                                  </span>
                                </div>
                                <div className="p-3 max-h-[220px] overflow-y-auto flex flex-col gap-2">
                                  {totalSelected === 0 ? (
                                    <p className="text-center py-4 text-gray-400 font-bold text-[10px]">এখনো কোনো প্রশ্ন নির্বাচন করা হয়নি। উপরে ট্যাব নির্বাচন করে কুইক অটো-ফিল বা ম্যানুয়ালি প্রশ্ন সিলেক্ট করুন।</p>
                                  ) : (
                                    MANUAL_CATEGORIES.map(cat => {
                                      const ids = selectedQuestionsByCategory[cat.id] || [];
                                      if (ids.length === 0) return null;
                                      const catLimit = categoryLimits[cat.id] || 0;
                                      
                                      return (
                                        <div key={cat.id} className="border border-slate-100 rounded-lg p-2 bg-slate-50/30">
                                          <div className="flex justify-between items-center border-b pb-1 mb-1.5 text-[10px] font-black text-gray-500">
                                            <span>{cat.name} ({ids.length}/{catLimit})</span>
                                            <button 
                                              type="button"
                                              onClick={() => {
                                                setSelectedQuestionsByCategory({
                                                  ...selectedQuestionsByCategory,
                                                  [cat.id]: []
                                                });
                                              }}
                                              className="text-rose-500 hover:text-rose-700"
                                            >
                                              ক্লিয়ার করুন
                                            </button>
                                          </div>
                                          <div className="flex flex-col gap-1">
                                            {ids.map((id, index) => {
                                              const q = questions.find(item => item.id === id);
                                              if (!q) return null;
                                              return (
                                                <div key={id} className="flex justify-between items-start gap-2 bg-white p-1.5 rounded-md border border-slate-100/80 text-[10px]">
                                                  <span className="font-semibold text-gray-700 line-clamp-1 flex-1">
                                                    {index + 1}. {q.text}
                                                  </span>
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      setSelectedQuestionsByCategory({
                                                        ...selectedQuestionsByCategory,
                                                        [cat.id]: ids.filter(x => x !== id)
                                                      });
                                                    }}
                                                    className="text-rose-500 hover:text-rose-700 font-extrabold hover:scale-105 transition"
                                                  >
                                                    ✕
                                                  </button>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })()}
                  </div>
                )}

                <button 
                  type="submit"
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-xl transition shadow-md"
                >
                  🎯 নতুন লাইভ পরীক্ষা শিডিউল করুন
                </button>
              </form>
            </div>

            {/* Live Exam Lists */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm">
              <h3 className="font-bold text-sm text-gray-800 mb-3 flex items-center gap-2">
                <span>📋</span> সক্রিয় অফিশিয়াল পরীক্ষাসমূহ
              </h3>
              {liveExams.length === 0 ? (
                <p className="text-gray-400 py-4 text-xs text-center border border-dashed border-gray-200 rounded-xl">কোনো অফিশিয়াল পরীক্ষা শিডিউল করা নেই।</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
                  {[...liveExams]
                    .sort((a, b) => {
                      const timeA = new Date(a.createdAt || a.startTime || 0).getTime();
                      const timeB = new Date(b.createdAt || b.startTime || 0).getTime();
                      return timeB - timeA;
                    })
                    .map((exam, idx) => (
                    <div
                      key={exam.id ? `le-${exam.id}-${idx}` : `le-${idx}`}
                      className="bg-white border border-slate-150 rounded-2xl p-3.5 sm:p-4 shadow-xs flex flex-col justify-between gap-3 hover:shadow-md transition-all border-l-4 border-l-indigo-600"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-extrabold text-indigo-950 text-xs sm:text-sm leading-snug">{exam.title}</h4>
                          <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg font-bold shrink-0">
                            ⏱️ অফিশিয়াল
                          </span>
                        </div>

                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 sm:p-3 space-y-1.5">
                          <p className="text-[10px] sm:text-[10.5px] text-slate-600 font-medium leading-relaxed">
                            📅 সময়সীমা: <span className="font-bold text-slate-800">{new Date(exam.startTime).toLocaleString('bn-BD')}</span> থেকে <span className="font-bold text-slate-800">{new Date(exam.expiryTime).toLocaleString('bn-BD')}</span>
                          </p>
                          <div className="flex flex-wrap gap-1 sm:gap-1.5 text-[9.5px] sm:text-[10px] text-indigo-700 font-bold pt-0.5">
                            <span className="bg-white border border-slate-200 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md shadow-2xs">
                              ক্যাটাগরি: {exam.category === 'ALL' ? 'সব বিষয়' : exam.category}
                            </span>
                            <span className="bg-white border border-slate-200 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md shadow-2xs">
                              প্রশ্ন: {exam.qLimit}টি
                            </span>
                            <span className="bg-white border border-slate-200 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md shadow-2xs">
                              সময়: {exam.timeLimit} মিনিট
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1 sm:gap-2 flex-nowrap w-full overflow-x-auto no-scrollbar scrollbar-none pb-0.5">
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
                              showCustomAlert('কপি সম্পন্ন!', 'লাইভ পরীক্ষার লিঙ্ক ক্লিপবোর্ডে কপি করা হয়েছে!\nএখন লিঙ্কটি যেকোনো সোশ্যাল মিডিয়ায় বা মেসেঞ্জারে শেয়ার করতে পারবেন।', 'success');
                            }}
                            className="px-1.5 py-1 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold text-[9.5px] sm:text-[10.5px] flex items-center gap-1 transition cursor-pointer whitespace-nowrap shrink-0"
                            title="লিঙ্ক কপি করুন"
                          >
                            <span>🔗</span> <span className="whitespace-nowrap">লিঙ্ক কপি</span>
                          </button>
                        </div>

                        <div className="shrink-0 flex items-center">
                          <button 
                            onClick={() => {
                              showCustomConfirm(
                                'পরীক্ষা ডিলিট নিশ্চিতকরণ',
                                'পরীক্ষাটি ডিলিট করতে চান? এটি ডিলিট করলে এর ফলাফল ডাটাও হারিয়ে যাবে!',
                                () => {
                                  onDeleteLiveExam(exam.id);
                                  showCustomAlert('সম্পন্ন হয়েছে!', 'পরীক্ষাটি সফলভাবে ডিলিট করা হয়েছে!', 'success');
                                },
                                'warning'
                              );
                            }}
                            className="px-2 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold text-[9.5px] sm:text-xs flex items-center gap-1 transition cursor-pointer whitespace-nowrap shrink-0"
                          >
                            <span>🗑️</span> <span className="whitespace-nowrap">মুছুন</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* COURSE MANAGEMENT */}
      {activeTab === 'courses' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 text-xs">
          {/* Create Course Form */}
          <div className="md:col-span-5 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-4">
            <h3 className="font-bold text-sm text-gray-800 flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4 text-indigo-600" />
              🎓 নতুন কোর্স তৈরি করুন
            </h3>
            <form onSubmit={handleCreateCourseSubmit} className="space-y-3">
              <div>
                <label className="block text-gray-600 mb-1 font-medium">কোর্সের নাম / শিরোনাম:</label>
                <input 
                  type="text" 
                  required
                  value={courseTitle}
                  onChange={e => setCourseTitle(e.target.value)}
                  placeholder="যেমন: ৪৬তম বিসিএস প্রিলিমিনারি স্পেশাল ক্র্যাশ কোর্স" 
                  className="w-full px-3 py-2 border rounded-xl text-gray-800 focus:outline-none" 
                />
              </div>

              <div>
                <label className="block text-gray-600 mb-1 font-medium">কোর্সের বিবরণ / বিস্তারিত:</label>
                <textarea 
                  rows={4}
                  required
                  value={courseDesc}
                  onChange={e => setCourseDesc(e.target.value)}
                  placeholder="যেমন: সম্পূর্ণ সিলেবাস ভিত্তিক বিষয়ভিত্তিক লাইভ পরীক্ষা, রিডার মোড অনুশীলন ও এক্সক্লুসিভ স্টাডি প্ল্যান।"
                  className="w-full px-3 py-2 border rounded-xl text-gray-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-gray-600 mb-1 font-medium">সম্পর্কিত ক্যাটাগরি (ঐচ্ছিক):</label>
                <select
                  value={courseCategory}
                  onChange={e => setCourseCategory(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl text-gray-800 focus:outline-none bg-white"
                >
                  <option value="">সকল ক্যাটাগরি / সাধারণ</option>
                  {(categories || []).map(cat => (
                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-gray-600 mb-1 font-medium">স্ট্যাটাস:</label>
                  <select
                    value={courseStatus}
                    onChange={e => setCourseStatus(e.target.value as any)}
                    className="w-full px-3 py-2 border rounded-xl text-gray-800 focus:outline-none bg-white font-bold"
                  >
                    <option value="active">🟢 চলমান (Active)</option>
                    <option value="upcoming">🟡 আসন্ন (Upcoming)</option>
                    <option value="completed">⚪ সম্পন্ন (Completed)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-600 mb-1 font-medium">শুরুর তারিখ:</label>
                  <input 
                    type="date"
                    value={courseStartDate}
                    onChange={e => setCourseStartDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-gray-800 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-600 mb-1 font-medium">শেষের তারিখ (ঐচ্ছিক):</label>
                <input 
                  type="date"
                  value={courseEndDate}
                  onChange={e => setCourseEndDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl text-gray-800 focus:outline-none"
                />
              </div>

              <button 
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl transition shadow flex items-center justify-center gap-2"
              >
                কোর্স সেভ ও প্রকাশ করুন 🎓
              </button>
            </form>
          </div>

          {/* Published Courses */}
          <div className="md:col-span-7 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
            <h3 className="font-bold text-sm text-gray-800 mb-3">📋 তৈরি করা কোর্সসমূহ ({courses.length})</h3>
            <div className="space-y-4">
              {(!courses || courses.length === 0) ? (
                <p className="text-gray-400 py-6 text-center">কোনো কোর্স পাওয়া যায়নি। নতুন কোর্স তৈরি করুন।</p>
              ) : (
                (courses || []).map((course, idx) => {
                  const courseRoutines = routines.filter(r => r.courseId === course.id || r.courseName === course.title);
                  return (
                    <div key={course.id || idx} className="p-4 bg-gray-50 border border-gray-100 rounded-2xl flex flex-col gap-2">
                      <div className="flex justify-between items-start gap-2 border-b pb-2">
                        <div>
                          <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider mb-1 ${
                            course.status === 'active' ? 'bg-emerald-100 text-emerald-800' :
                            course.status === 'upcoming' ? 'bg-amber-100 text-amber-800' : 'bg-gray-200 text-gray-700'
                          }`}>
                            {course.status === 'active' ? '● চলমান কোর্স' : course.status === 'upcoming' ? '▲ আসন্ন কোর্স' : '✓ সম্পন্ন কোর্স'}
                          </span>
                          <h4 className="font-extrabold text-indigo-950 text-sm">{course.title}</h4>
                        </div>
                        <button
                          onClick={() => {
                            showCustomConfirm(
                              'কোর্স ডিলিট নিশ্চিতকরণ',
                              `"${course.title}" কোর্সটি ডিলিট করতে চান?`,
                              () => {
                                if (onDeleteCourse) onDeleteCourse(course.id);
                                showCustomAlert('সম্পন্ন হয়েছে!', 'কোর্সটি সফলভাবে মুছে ফেলা হয়েছে!', 'success');
                              },
                              'warning'
                            );
                          }}
                          className="text-rose-600 hover:text-rose-800 font-bold shrink-0 text-xs"
                        >
                          মুছুন 🗑️
                        </button>
                      </div>
                      <p className="text-gray-600 text-xs leading-relaxed">{course.description}</p>
                      
                      <div className="flex flex-wrap gap-2 text-[10px] font-semibold text-gray-500 pt-1">
                        {course.category && <span className="bg-white border px-2 py-0.5 rounded-lg text-indigo-700 font-bold">🏷️ {course.category}</span>}
                        {course.startDate && <span className="bg-white border px-2 py-0.5 rounded-lg">📅 শুরু: {course.startDate}</span>}
                        {course.endDate && <span className="bg-white border px-2 py-0.5 rounded-lg">🏁 শেষ: {course.endDate}</span>}
                        <span className="bg-white border px-2 py-0.5 rounded-lg text-emerald-700 font-bold">📅 সংযুক্ত রুটিন: {courseRoutines.length} টি</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. ROUTINES MANAGEMENT */}
      {activeTab === 'routines' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 text-xs">
          {/* Create Routine Form */}
          <div className="md:col-span-7 bg-white p-5 sm:p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col gap-5">
            <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
              <h3 className="font-black text-base text-indigo-950 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-600" />
                📅 কোর্স সিলেবাস রুটিন ও এক্সাম শিডিউলার
              </h3>
              <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-xl">
                ক্যাসকেডিং ফিল্টার সাপোর্টেড
              </span>
            </div>

            <form onSubmit={handleCreateRoutine} className="space-y-4">
              {/* Course Selector */}
              <div>
                <label className="block text-gray-700 mb-1.5 font-bold">🎓 কোর্স নির্বাচন করুন:</label>
                <select
                  value={routineCourseId}
                  onChange={e => setRoutineCourseId(e.target.value)}
                  className="w-full px-3.5 py-2.5 border rounded-2xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-bold"
                >
                  <option value="">সাধারণ রুটিন (সকল কোর্সের জন্য)</option>
                  {(courses || []).map(c => (
                    <option key={c.id} value={c.id}>
                      🎓 {c.title} ({c.status === 'active' ? 'চলমান' : c.status})
                    </option>
                  ))}
                </select>
              </div>

              {/* Title & Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 mb-1 font-bold">রুটিন / পরীক্ষার শিরোনাম: *</label>
                  <input 
                    type="text" 
                    required
                    value={routineTitle}
                    onChange={e => setRoutineTitle(e.target.value)}
                    placeholder="যেমন: মডেল টেস্ট ০১ - বাংলা ব্যাকরণ ও গাণিতিক যুক্তি" 
                    className="w-full px-3.5 py-2 border rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium" 
                  />
                </div>
                <div>
                  <label className="block text-gray-700 mb-1 font-bold">বিস্তারিত রুটিন নোট (ঐচ্ছিক):</label>
                  <input 
                    type="text"
                    value={routineDetails}
                    onChange={e => setRoutineDetails(e.target.value)}
                    placeholder="যেমন: পৃষ্ঠা নম্বর ৫০-৮৫ রিভিশন দিন।"
                    className="w-full px-3.5 py-2 border rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>
              </div>

              {/* --- CASCADING SYLLABUS TOPICS FILTERS --- */}
              <div className="bg-gradient-to-br from-indigo-50/70 to-purple-50/70 p-4 rounded-2xl border border-indigo-100/80 space-y-3.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-indigo-950 text-xs flex items-center gap-1.5">
                    <FolderTree className="w-4 h-4 text-indigo-600" />
                    📚 পরীক্ষার সিলেবাস নির্বাচন (Cascading Syllabus Selection)
                  </h4>
                  <span className="bg-emerald-600 text-white font-extrabold text-[10px] px-2.5 py-0.5 rounded-full shadow-xs">
                    🎯 ম্যাচিং প্রশ্ন: {routineMatchingQuestions.length.toLocaleString('bn-BD')} টি
                  </span>
                </div>

                {/* Step 1: Root Category Selection */}
                <div className="bg-white p-3.5 rounded-xl border border-indigo-100/80 space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-gray-800 font-extrabold text-[11.5px] flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center font-black">১</span>
                      ধাপ ১: মূল ক্যাটাগরি নির্বাচন (Root Category):
                    </label>
                    {routineSelectedRootCategory && (
                      <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                        নির্বাচিত: {routineSelectedRootCategory}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {routineRootCategories.map(rootCat => {
                      const isSelected = routineSelectedRootCategory === rootCat;
                      const rootMcqCount = rootCategoryMCQCounts[rootCat] || 0;
                      return (
                        <button
                          key={rootCat}
                          type="button"
                          onClick={() => {
                            setRoutineSelectedRootCategory(rootCat);
                            setRoutineSelectedCategories([]);
                            setRoutineSelectedSubcategories([]);
                            setRoutineSelectedLeafCategories([]);
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-black transition border cursor-pointer flex items-center gap-1.5 ${
                            isSelected 
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm scale-[1.02]' 
                              : 'bg-gray-50 hover:bg-indigo-50 text-gray-700 border-gray-200'
                          }`}
                        >
                          <span>{isSelected ? '✓' : '📌'}</span>
                          <span>{rootCat}</span>
                          {rootMcqCount > 0 && (
                            <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${isSelected ? 'bg-white/20 text-white' : 'bg-gray-200/80 text-gray-700'}`}>
                              {rootMcqCount.toLocaleString('bn-BD')}টি
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Step 2: Category Selection (Dynamically Loaded based on Step 1) */}
                <div className="bg-white p-3.5 rounded-xl border border-indigo-100/80 space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-gray-800 font-extrabold text-[11.5px] flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center font-black">২</span>
                      ধাপ ২: ক্যাটাগরি / বিষয় নির্বাচন (Category - ডায়নামিক লোড):
                    </label>
                    {routineSelectedCategories.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setRoutineSelectedCategories([]);
                          setRoutineSelectedSubcategories([]);
                          setRoutineSelectedLeafCategories([]);
                        }}
                        className="text-[10px] font-bold text-rose-600 hover:underline"
                      >
                        রিসেট ({routineSelectedCategories.length})
                      </button>
                    )}
                  </div>

                  {!routineSelectedRootCategory ? (
                    <div className="p-3 bg-amber-50 text-amber-800 rounded-xl text-xs font-semibold">
                      👈 অনুগ্রহ করে প্রথমে ধাপ ১ থেকে একটি মূল ক্যাটাগরি নির্বাচন করুন।
                    </div>
                  ) : routineAvailableCategories.length === 0 ? (
                    <div className="p-3 bg-gray-50 text-gray-500 rounded-xl text-xs font-medium">
                      এই মূল ক্যাটাগরির অধীনে কোনো ক্যাটাগরি পাওয়া যায়নি।
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pt-1">
                      {routineAvailableCategories.map(cat => {
                        const isSelected = routineSelectedCategories.includes(cat.name);
                        return (
                          <button
                            key={cat.name}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setRoutineSelectedCategories(prev => prev.filter(c => c !== cat.name));
                                setRoutineSelectedSubcategories([]);
                                setRoutineSelectedLeafCategories([]);
                              } else {
                                setRoutineSelectedCategories(prev => [...prev, cat.name]);
                              }
                            }}
                            className={`px-2.5 py-1 rounded-xl text-[10.5px] font-bold transition border cursor-pointer flex items-center gap-1 ${
                              isSelected 
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' 
                                : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                            }`}
                          >
                            <span>{isSelected ? '✓ ' : '+ '}</span>
                            <span>{cat.name}</span>
                            {cat.count > 0 && (
                              <span className={`text-[9.5px] font-medium px-1 rounded ${isSelected ? 'bg-white/20 text-white' : 'text-gray-500'}`}>
                                ({cat.count.toLocaleString('bn-BD')}টি)
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Step 3: Sub-category Selection (Dynamically Loaded based on Step 2) */}
                <div className="bg-white p-3.5 rounded-xl border border-indigo-100/80 space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-gray-800 font-extrabold text-[11.5px] flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-purple-600 text-white text-[10px] flex items-center justify-center font-black">৩</span>
                      ধাপ ৩: সাব-ক্যাটাগরি / বিষয়াবলি (Sub-category - ডায়নামিক লোড):
                    </label>
                    {routineSelectedSubcategories.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setRoutineSelectedSubcategories([]);
                          setRoutineSelectedLeafCategories([]);
                        }}
                        className="text-[10px] font-bold text-rose-600 hover:underline"
                      >
                        রিসেট ({routineSelectedSubcategories.length})
                      </button>
                    )}
                  </div>

                  {routineSelectedCategories.length === 0 ? (
                    <div className="p-3 bg-indigo-50/60 text-indigo-700 rounded-xl text-xs font-semibold flex items-center gap-1.5">
                      <span>👈</span>
                      <span>সাব-ক্যাটাগরি দেখতে অনুগ্রহ করে প্রথমে ধাপ ২ থেকে ক্যাটাগরি / বিষয় নির্বাচন করুন।</span>
                    </div>
                  ) : routineAvailableSubcategories.length === 0 ? (
                    <div className="p-3 bg-gray-50 text-gray-500 rounded-xl text-xs font-medium">
                      নির্বাচিত ক্যাটাগরির অধীনে সরাসরি কোনো সাব-ক্যাটাগরি পাওয়া যায়নি (সম্পূর্ণ ক্যাটাগরি সিলেবাসে অন্তর্ভুক্ত থাকবে)।
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pt-1">
                      {routineAvailableSubcategories.map(sub => {
                        const isSelected = routineSelectedSubcategories.includes(sub.name);
                        return (
                          <button
                            key={sub.id || sub.name}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setRoutineSelectedSubcategories(prev => prev.filter(s => s !== sub.name));
                                setRoutineSelectedLeafCategories([]);
                              } else {
                                setRoutineSelectedSubcategories(prev => [...prev, sub.name]);
                              }
                            }}
                            className={`px-2.5 py-1 rounded-xl text-[10.5px] font-bold transition border cursor-pointer flex items-center gap-1 ${
                              isSelected 
                                ? 'bg-purple-600 text-white border-purple-600 shadow-xs' 
                                : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                            }`}
                          >
                            <span>{isSelected ? '✓ ' : '+ '}</span>
                            <span>{sub.name}</span>
                            {sub.count > 0 && (
                              <span className={`text-[9.5px] font-medium px-1 rounded ${isSelected ? 'bg-white/20 text-white' : 'text-gray-500'}`}>
                                ({sub.count.toLocaleString('bn-BD')}টি)
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Step 4: Leaf Topics Selection (Optional - Dynamically Loaded based on Step 3) */}
                <div className="bg-white p-3.5 rounded-xl border border-indigo-100/80 space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-gray-800 font-extrabold text-[11.5px] flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center font-black">৪</span>
                      ধাপ ৪: নির্দিষ্ট অধ্যায় / টপিক (Leaf Topics - ঐচ্ছিক):
                    </label>
                    {routineSelectedLeafCategories.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setRoutineSelectedLeafCategories([])}
                        className="text-[10px] font-bold text-rose-600 hover:underline"
                      >
                        রিসেট ({routineSelectedLeafCategories.length})
                      </button>
                    )}
                  </div>

                  {routineSelectedSubcategories.length === 0 ? (
                    <div className="p-3 bg-gray-50 text-gray-500 rounded-xl text-xs">
                      নির্দিষ্ট টপিক ফিল্টার করতে ধাপ ৩ থেকে সাব-ক্যাটাগরি নির্বাচন করুন।
                    </div>
                  ) : routineAvailableLeafCategories.length === 0 ? (
                    <div className="p-3 bg-gray-50 text-gray-500 rounded-xl text-xs font-medium">
                      নির্বাচিত সাব-ক্যাটাগরির অধীনে আর কোনো অধস্তন অধ্যায় নেই (সম্পূর্ণ সাব-ক্যাটাগরি সিলেবাসে অন্তর্ভুক্ত থাকবে)।
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pt-1">
                      {routineAvailableLeafCategories.map(item => {
                        const isSelected = routineSelectedLeafCategories.includes(item.name);
                        return (
                          <button
                            key={item.name}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setRoutineSelectedLeafCategories(prev => prev.filter(l => l !== item.name));
                              } else {
                                setRoutineSelectedLeafCategories(prev => [...prev, item.name]);
                              }
                            }}
                            className={`px-2.5 py-1 rounded-xl text-[10px] font-bold transition border cursor-pointer flex items-center gap-1 ${
                              isSelected 
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' 
                                : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                            }`}
                          >
                            <span>{isSelected ? '✓ ' : '+ '}</span>
                            <span>{item.name}</span>
                            <span className={`text-[9px] px-1 rounded ${isSelected ? 'bg-white/20 text-white' : 'text-gray-500'}`}>
                              ({item.count.toLocaleString('bn-BD')}টি)
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Live Syllabus Hierarchy Path Preview */}
                {(() => {
                  const dummyRoutine: Routine = {
                    id: 'preview',
                    title: routineTitle,
                    details: routineDetails,
                    selectedCategories: [routineSelectedRootCategory, ...routineSelectedCategories].filter(Boolean),
                    selectedSubcategories: routineSelectedSubcategories,
                    selectedLeafCategories: routineSelectedLeafCategories,
                    createdAt: new Date().toISOString()
                  };
                  const livePaths = formatRoutineSyllabusPaths(dummyRoutine, subcategories, categories, questions);
                  if (livePaths.length === 0) return null;
                  return (
                    <div className="bg-indigo-50/90 border border-indigo-200 rounded-2xl p-3 space-y-1.5 shadow-2xs">
                      <div className="flex items-center justify-between text-xs font-black text-indigo-950">
                        <span className="flex items-center gap-1.5">
                          <FolderTree className="w-3.5 h-3.5 text-indigo-600" />
                          📚 সিলেবাস পাথ (Selected Syllabus Hierarchy):
                        </span>
                        <span className="text-[10px] text-indigo-700 font-bold bg-indigo-100 px-2 py-0.5 rounded-md">
                          মোট {livePaths.length} টি শাখা
                        </span>
                      </div>
                      <div className="flex flex-col gap-1">
                        {livePaths.map((path, pIdx) => (
                          <div key={pIdx} className="bg-white border border-indigo-100 text-indigo-950 font-bold px-2.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 flex-wrap">
                            <span className="text-indigo-600 font-black">📌</span>
                            {path.split(/\s*>\s*/).map((seg, sIdx, arr) => (
                              <React.Fragment key={sIdx}>
                                <span className={sIdx === arr.length - 1 ? "text-indigo-950 font-black" : "text-indigo-700"}>{seg}</span>
                                {sIdx < arr.length - 1 && <span className="text-indigo-400 font-bold">›</span>}
                              </React.Fragment>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* --- PRESET SCHEDULED EXAM CONFIGURATION --- */}
              <div className="border border-indigo-200 rounded-2xl p-4 bg-indigo-50/40 space-y-3">
                <label className="flex items-center gap-2 font-black text-indigo-950 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={routineEnableExam}
                    onChange={e => setRoutineEnableExam(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  <span>⏰ এই সিলেবাসের উপর শিডিউলড পরীক্ষা সেটআপ করুন (Preset Scheduled Exam)</span>
                </label>

                {routineEnableExam && (
                  <div className="space-y-3.5 pt-2 border-t border-indigo-100 animate-fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-gray-700 mb-1 font-bold">পরীক্ষা শুরুর সময় (Start Date & Time): *</label>
                        <input
                          type="datetime-local"
                          required={routineEnableExam}
                          value={routineExamStartTime}
                          onChange={e => setRoutineExamStartTime(e.target.value)}
                          className="w-full px-3 py-2 border rounded-xl text-gray-800 font-bold bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-700 mb-1 font-bold">পরীক্ষা শেষের সময় (Expiry Date & Time):</label>
                        <input
                          type="datetime-local"
                          value={routineExamExpiryTime}
                          onChange={e => setRoutineExamExpiryTime(e.target.value)}
                          className="w-full px-3 py-2 border rounded-xl text-gray-800 font-bold bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div>
                        <label className="block text-gray-700 mb-1 font-bold">সময় (মিনিট):</label>
                        <input
                          type="number"
                          min="1"
                          value={routineExamTimeLimit}
                          onChange={e => setRoutineExamTimeLimit(Number(e.target.value))}
                          className="w-full px-3 py-1.5 border rounded-xl text-gray-800 font-bold bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-700 mb-1 font-bold">এমসিকিউ সংখ্যা:</label>
                        <input
                          type="number"
                          min="1"
                          value={routineExamQLimit}
                          onChange={e => setRoutineExamQLimit(Number(e.target.value))}
                          disabled={routineExamQuestionSelection === 'manual'}
                          className="w-full px-3 py-1.5 border rounded-xl text-gray-800 font-bold bg-white disabled:bg-gray-100"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-700 mb-1 font-bold">মোট নম্বর:</label>
                        <input
                          type="number"
                          min="1"
                          value={routineExamTotalMarks}
                          onChange={e => setRoutineExamTotalMarks(Number(e.target.value))}
                          className="w-full px-3 py-1.5 border rounded-xl text-gray-800 font-bold bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-700 mb-1 font-bold">পাস নম্বর:</label>
                        <input
                          type="number"
                          min="1"
                          value={routineExamPassMarks}
                          onChange={e => setRoutineExamPassMarks(Number(e.target.value))}
                          className="w-full px-3 py-1.5 border rounded-xl text-gray-800 font-bold bg-white"
                        />
                      </div>
                    </div>

                    {/* Question Selection Mode */}
                    <div>
                      <label className="block text-gray-700 mb-1.5 font-extrabold">প্রশ্ন সিলেকশন মোড (Question Selection):</label>
                      <div className="flex gap-3">
                        <label className="flex items-center gap-1.5 font-bold text-gray-800 cursor-pointer">
                          <input
                            type="radio"
                            name="qSelectMode"
                            checked={routineExamQuestionSelection === 'auto'}
                            onChange={() => setRoutineExamQuestionSelection('auto')}
                          />
                          <span>⚡ স্বয়ংক্রিয় (Automatic filter from syllabus)</span>
                        </label>
                        <label className="flex items-center gap-1.5 font-bold text-gray-800 cursor-pointer">
                          <input
                            type="radio"
                            name="qSelectMode"
                            checked={routineExamQuestionSelection === 'manual'}
                            onChange={() => setRoutineExamQuestionSelection('manual')}
                          />
                          <span>🖐️ ম্যানুয়াল (Specific Question Pick)</span>
                        </label>
                      </div>
                    </div>

                    {/* Manual Question Picker */}
                    {routineExamQuestionSelection === 'manual' && (
                      <div className="bg-white p-3 rounded-2xl border border-indigo-200 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-extrabold text-indigo-950 text-[11px]">
                            নির্ধারিত সিলেবাসের প্রশ্ন থেকে নির্বাচন করুন (নির্বাচিত: {routineExamManualQuestionIds.length} টি)
                          </span>
                          <input
                            type="text"
                            placeholder="প্রশ্ন খুঁজুন..."
                            value={routineManualQuestionSearch}
                            onChange={e => setRoutineManualQuestionSearch(e.target.value)}
                            className="px-2.5 py-1 border rounded-lg text-[10px] w-40"
                          />
                        </div>
                        <div className="max-h-48 overflow-y-auto space-y-1.5 divide-y divide-gray-100 pr-1">
                          {routineMatchingQuestions
                            .filter(q => !routineManualQuestionSearch || q.text.toLowerCase().includes(routineManualQuestionSearch.toLowerCase()))
                            .map((q, idx) => {
                              const isChecked = routineExamManualQuestionIds.includes(q.id);
                              return (
                                <label key={q.id || idx} className="flex items-start gap-2 pt-1.5 cursor-pointer hover:bg-gray-50 p-1 rounded-lg">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {
                                      if (isChecked) {
                                        setRoutineExamManualQuestionIds(prev => prev.filter(id => id !== q.id));
                                      } else {
                                        setRoutineExamManualQuestionIds(prev => [...prev, q.id]);
                                      }
                                    }}
                                    className="mt-0.5"
                                  />
                                  <div className="text-[11px]">
                                    <p className="font-bold text-gray-800 line-clamp-1">{q.text}</p>
                                    <span className="text-[9px] text-gray-400 font-medium">
                                      {q.category} • {q.subcategory} {q.csvCategory ? `• ${q.csvCategory}` : ''}
                                    </span>
                                  </div>
                                </label>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button 
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3 rounded-2xl transition shadow flex items-center justify-center gap-2 text-xs"
              >
                <Sparkles className="w-4 h-4 text-indigo-200" />
                কোর্স সিলেবাস রুটিন ও এক্সাম প্রকাশ করুন
              </button>
            </form>
          </div>

          {/* Published Routines & Scheduled Exams List */}
          <div className="md:col-span-5 bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-2.5">
              <h3 className="font-black text-sm text-gray-900">📋 প্রকাশিত রুটিন ও এক্সাম কার্ডসমূহ ({routines.length})</h3>
            </div>

            <div className="space-y-3.5 max-h-[800px] overflow-y-auto pr-1">
              {(!routines || routines.length === 0) ? (
                <p className="text-gray-400 py-8 text-center font-medium">কোনো রুটিন প্রকাশ করা হয়নি।</p>
              ) : (
                (routines || []).map((item, idx) => {
                  const hasExam = item.examConfig && item.examConfig.enabled;
                  const targetCourse = courses ? courses.find(c => c.id === item.courseId || c.title === item.courseName) : undefined;

                  return (
                    <div key={item.id ? `rt-${item.id}-${idx}` : `rt-${idx}`} className="p-4 bg-gray-50/80 border border-gray-200/80 rounded-2xl shadow-2xs space-y-2.5 relative">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          {item.courseName && (
                            <span className="inline-block px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[9px] font-black uppercase mb-1">
                              🎓 {item.courseName}
                            </span>
                          )}
                          <h4 className="font-extrabold text-indigo-950 text-xs leading-snug">{item.title}</h4>
                        </div>
                        <button 
                          onClick={() => {
                            showCustomConfirm(
                              'রুটিন ডিলিট নিশ্চিতকরণ',
                              'রুটিনটি নিশ্চিত ডিলিট করতে চান?',
                              () => {
                                onDeleteRoutine(item.id);
                                showCustomAlert('সম্পন্ন হয়েছে!', 'রুটিনটি সফলভাবে ডিলিট করা হয়েছে!', 'success');
                              },
                              'warning'
                            );
                          }}
                          className="text-rose-600 hover:text-rose-800 font-bold shrink-0 text-[10px]"
                        >
                          🗑️ মুছুন
                        </button>
                      </div>

                      {/* View Hierarchical MCQs Action */}
                      <button
                        type="button"
                        onClick={() => setViewingHierarchyRoutine(item)}
                        className="w-full bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 font-extrabold py-1.5 px-3 rounded-xl transition text-[10.5px] flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
                        <span>🎓 পরিক্ষার  প্রস্তুতি</span>
                      </button>

                      {/* PDF Export Action */}
                      {item.courseName && (
                        <button
                          onClick={() => {
                            const courseRoutines = routines.filter(r => r.courseId === item.courseId || r.courseName === item.courseName);
                            downloadCourseRoutinePDF(item.courseName || 'কোর্স রুটিন', targetCourse?.category, courseRoutines, subcategories, categories, questions);
                          }}
                          className="w-full bg-white hover:bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold py-1.5 px-3 rounded-xl transition text-[10px] flex items-center justify-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5 text-indigo-600" />
                          📥 কোর্স সম্পূর্ণ রুটিন PDF ডাউনলোড
                        </button>
                      )}

                      {/* Exam Config Badge */}
                      {hasExam && (
                        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white p-2.5 rounded-xl font-bold text-[10px] space-y-1 shadow-xs">
                          <p className="flex items-center gap-1 text-[11px] font-black">
                            ⏰ শিডিউলড পরীক্ষা: {formatBengaliDateTime(item.examConfig?.startTime)}
                          </p>
                          <p className="text-emerald-100 font-medium">
                            এমসিকিউ: {item.examConfig?.qLimit || 20} টি | সময়: {item.examConfig?.timeLimit || 20} মি. | পূর্ণমান: {item.examConfig?.totalMarks || 20}
                          </p>
                        </div>
                      )}

                      {/* Syllabus Path Hierarchy */}
                      {(() => {
                        const syllabusPaths = formatRoutineSyllabusPaths(item, subcategories, categories, questions);
                        if (syllabusPaths.length === 0) return null;
                        return (
                          <div className="space-y-1 bg-white p-2.5 rounded-xl border border-indigo-100/90 shadow-2xs">
                            <span className="text-[10px] font-black text-indigo-950 flex items-center gap-1">
                              <FolderTree className="w-3 h-3 text-indigo-600" />
                              📚 সিলেবাস (Selected Syllabus):
                            </span>
                            <div className="flex flex-col gap-1">
                              {syllabusPaths.map((path, pIdx) => (
                                <div key={pIdx} className="bg-indigo-50/70 border border-indigo-200/80 text-indigo-950 font-bold px-2 py-1 rounded-lg text-[9.5px] flex items-center gap-1.5 flex-wrap">
                                  <span className="text-indigo-600 font-black">📌</span>
                                  {path.split(/\s*>\s*/).map((seg, sIdx, arr) => (
                                    <React.Fragment key={sIdx}>
                                      <span className={sIdx === arr.length - 1 ? "text-indigo-950 font-black" : "text-indigo-700"}>{seg}</span>
                                      {sIdx < arr.length - 1 && <span className="text-indigo-400 font-bold">›</span>}
                                    </React.Fragment>
                                  ))}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {item.details && (
                        <p className="text-gray-600 text-[11px] whitespace-pre-line leading-relaxed bg-white p-2.5 rounded-xl border border-gray-100">
                          {item.details}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. VIEW RESULTS */}
      {activeTab === 'results' && (
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-5 text-xs">
          
          {/* User Exams Stat block */}
          {(() => {
            const userAttempts7Days = attempts.filter(a => {
              const isUserCreated = a.examId.startsWith('prep_') || a.examId.startsWith('job_') || a.examId.startsWith('custom_');
              if (!isUserCreated) return false;
              const submittedTime = new Date(a.submittedAt).getTime();
              const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
              return submittedTime >= sevenDaysAgo;
            });

            return (
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] bg-indigo-600 text-white font-extrabold px-2.5 py-0.5 rounded-full w-max uppercase tracking-wider">
                    ব্যবহারকারী কাস্টম পরীক্ষা ট্র্যাকার
                  </span>
                  <h4 className="font-extrabold text-indigo-950 text-xs mt-1">
                    📊 বিগত ৭ দিনে শিক্ষার্থীদের দ্বারা তৈরি মোট এমসিকিউ পরীক্ষা
                  </h4>
                  <p className="text-[10px] text-gray-600 font-semibold leading-relaxed">
                    নিরাপত্তা নীতি অনুযায়ী, এডমিন প্যানেল থেকে শিক্ষার্থীদের ব্যক্তিগত বা কাস্টম পরীক্ষার ফলাফলের বিস্তারিত বিবরণ দেখা যাবে না। শুধুমাত্র তাদের তৈরি করা পরীক্ষার সংখ্যা ট্র্যাক করা যাবে।
                  </p>
                </div>
                <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-xl border border-indigo-100 shadow-sm shrink-0">
                  <div className="flex flex-col text-right">
                    <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">মোট পরীক্ষা</span>
                    <span className="text-2xl font-black text-indigo-600">
                      {userAttempts7Days.length.toLocaleString('bn-BD')} টি
                    </span>
                  </div>
                  <span className="text-2xl">🔥</span>
                </div>
              </div>
            );
          })()}

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-t pt-4 border-gray-100">
            <h3 className="font-bold text-sm text-gray-800 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-500" />
              📈 শিক্ষার্থীদের প্রাপ্ত মার্কস ও ফলাফল তালিকা (অফিশিয়াল লাইভ পরীক্ষা)
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 font-semibold shrink-0">পরীক্ষা সিলেক্ট করুন:</span>
              <select 
                value={selectedExamIdForResults}
                onChange={e => setSelectedExamIdForResults(e.target.value)}
                className="px-3 py-1.5 border rounded-xl bg-white text-gray-800 focus:outline-none"
              >
                <option value="">নির্বাচন করুন...</option>
                {[...liveExams]
                  .sort((a, b) => {
                    const timeA = new Date(a.createdAt || a.startTime || 0).getTime();
                    const timeB = new Date(b.createdAt || b.startTime || 0).getTime();
                    return timeB - timeA;
                  })
                  .map((le, idx) => <option key={le.id ? `le-opt-${le.id}-${idx}` : `le-opt-${idx}`} value={le.id}>{le.title} (লাইভ)</option>)}
              </select>
            </div>
          </div>

          <div className="border rounded-xl overflow-x-auto">
            <table className="w-full text-left divide-y divide-gray-100 text-[11px] sm:text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-gray-500 font-bold">র‍্যাংক</th>
                  <th className="px-4 py-3 text-gray-500 font-bold">শিক্ষার্থীর নাম</th>
                  <th className="px-4 py-3 text-gray-500 font-bold">মোবাইল নম্বর</th>
                  <th className="px-4 py-3 text-gray-500 font-bold text-center">প্রাপ্ত নম্বর</th>
                  <th className="px-4 py-3 text-gray-500 font-bold text-center">সঠিক/ভুল</th>
                  <th className="px-4 py-3 text-gray-500 font-bold text-right">তারিখ ও সময়</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {selectedExamIdForResults === '' ? (
                  <tr>
                    <td colSpan={6} className="text-center text-gray-400 py-8">দয়া করে উপরে কোনো একটি পরীক্ষা সিলেক্ট করুন।</td>
                  </tr>
                ) : activeExamResults.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-gray-400 py-8">এই পরীক্ষায় এখন পর্যন্ত কেউ অংশ নেয়নি।</td>
                  </tr>
                ) : (
                  activeExamResults
                    .sort((a, b) => b.score - a.score)
                    .map((item, index) => (
                      <tr key={item.id} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3 font-bold text-gray-500">{(index + 1).toLocaleString('bn-BD')}</td>
                        <td className="px-4 py-3 font-bold text-indigo-950">{item.username}</td>
                        <td className="px-4 py-3 font-mono text-gray-600">{item.userPhone}</td>
                        <td className="px-4 py-3 text-center text-indigo-600 font-extrabold">{item.score.toLocaleString('bn-BD')}</td>
                        <td className="px-4 py-3 text-center text-gray-500 font-medium">
                          <span className="text-green-600">{item.correctCount}</span> / <span className="text-red-500">{item.wrongCount}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-400 text-[10px]">
                          {new Date(item.submittedAt).toLocaleString('bn-BD')}
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. REGISTERED USERS LIST */}
      {activeTab === 'users' && (() => {
        // Prepare enriched list
        const safeUsers = users || [];
        const enrichedUsers = safeUsers.map(u => {
          // Calculate points
          let approvedPoints = 0;
          let pendingPoints = 0;
          questions.forEach(q => {
            if (q.comments) {
              q.comments.forEach(c => {
                if (c.userPhone === u.phone) {
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
                if (e.userPhone === u.phone) {
                  if (e.pointsApproved) {
                    approvedPoints += 1;
                  } else {
                    pendingPoints += 1;
                  }
                }
              });
            }
          });

          // Calculate Last 7 Days MCQ
          const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
          const user7DayAttempts = attempts.filter(a => a.userPhone === u.phone && new Date(a.submittedAt).getTime() >= sevenDaysAgo);
          const last7DaysMcq = user7DayAttempts.reduce((sum, a) => sum + a.totalQuestions, 0);

          // Calculate Official Exam Attained
          const officialExamsAttained = attempts.filter(a => 
            a.userPhone === u.phone && 
            !a.examId.startsWith('prep_') && 
            !a.examId.startsWith('job_') && 
            !a.examId.startsWith('custom_')
          ).length;

          return {
            ...u,
            approvedPoints,
            pendingPoints,
            last7DaysMcq,
            officialExamsAttained
          };
        });

        // Filter
        const filteredUsers = enrichedUsers.filter(u => {
          const q = userSearch.toLowerCase().trim();
          const matchesSearch = 
            u.name.toLowerCase().includes(q) ||
            u.phone.includes(q) ||
            (u.userId && u.userId.toLowerCase().includes(q)) ||
            (u.email && u.email.toLowerCase().includes(q));
          const matchesGender = 
            userGenderFilter === 'ALL' || 
            u.gender === userGenderFilter;
          return matchesSearch && matchesGender;
        });

        // Sort
        const sortedUsers = [...filteredUsers].sort((a, b) => {
          if (userSortBy === 'lifetimeAnswered') {
            return b.lifetimeAnswered - a.lifetimeAnswered;
          } else if (userSortBy === 'last7DaysMcq') {
            return b.last7DaysMcq - a.last7DaysMcq;
          } else if (userSortBy === 'approvedPoints') {
            return b.approvedPoints - a.approvedPoints;
          } else if (userSortBy === 'pendingPoints') {
            return b.pendingPoints - a.pendingPoints;
          } else if (userSortBy === 'officialExamsAttained') {
            return b.officialExamsAttained - a.officialExamsAttained;
          } else {
            // Default: createdAt descending
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          }
        });

        return (
          <div className="flex flex-col gap-5 animate-fade-in">
            {/* Recent User Growth Analytics */}
            <UserGrowthChart users={safeUsers} />

            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-3 text-xs">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold text-sm text-gray-800 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-indigo-600" />
                👥 রেজিস্টার্ড শিক্ষার্থীদের প্রোফাইল তালিকা
              </h3>
              <span className="bg-indigo-50 border border-indigo-100 text-indigo-800 font-bold px-3 py-1 rounded-full text-xs">
                মোট নিবন্ধিত: {safeUsers.length} জন | ফিল্টারকৃত: {filteredUsers.length} জন
              </span>
            </div>

            {/* Filters & Search bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-gray-50 p-4 rounded-2xl border border-gray-100/50">
              {/* Search Input */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">শিক্ষার্থী খুঁজুন</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="নাম বা মোবাইল নম্বর লিখুন..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="w-full pl-3 pr-8 py-2 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-bold text-gray-800"
                  />
                  {userSearch && (
                    <button
                      onClick={() => setUserSearch('')}
                      className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600 font-bold text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Gender Filter */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">লিঙ্গ অনুসারে ফিল্টার</label>
                <select
                  value={userGenderFilter}
                  onChange={(e) => setUserGenderFilter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-bold text-gray-800 cursor-pointer"
                >
                  <option value="ALL">সব শিক্ষার্থী</option>
                  <option value="পুরুষ">পুরুষ</option>
                  <option value="নারী">নারী</option>
                </select>
              </div>

              {/* Sort Dropdown */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">বাছাইয়ের ক্রমানুসার (Sort By)</label>
                <select
                  value={userSortBy}
                  onChange={(e) => setUserSortBy(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs font-bold text-gray-800 cursor-pointer"
                >
                  <option value="createdAt">নিবন্ধনের তারিখ (সর্বশেষ প্রথম)</option>
                  <option value="lifetimeAnswered">মোট পঠিত MCQ (সর্বোচ্চ প্রথম)</option>
                  <option value="last7DaysMcq">গত ৭ দিনে পঠিত MCQ (সর্বোচ্চ প্রথম)</option>
                  <option value="approvedPoints">অনুমোদিত পয়েন্ট (সর্বোচ্চ প্রথম)</option>
                  <option value="pendingPoints">পেন্ডিং পয়েন্ট (সর্বোচ্চ প্রথম)</option>
                  <option value="officialExamsAttained">অফিসিয়াল পরীক্ষায় অংশগ্রহণ (সর্বোচ্চ প্রথম)</option>
                </select>
              </div>
            </div>

            <div className="border rounded-xl overflow-x-auto">
              <table className="w-full text-left divide-y divide-gray-100 text-[11px] sm:text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-gray-500 font-bold">শিক্ষার্থীর নাম</th>
                    <th className="px-4 py-3 text-gray-500 font-bold">অটো ইউজার আইডি</th>
                    <th className="px-4 py-3 text-gray-500 font-bold">ইমেইল ও ভেরিফিকেশন</th>
                    <th className="px-4 py-3 text-gray-500 font-bold">মোবাইল নম্বর</th>
                    <th className="px-4 py-3 text-gray-500 font-bold">শিক্ষাগত যোগ্যতা</th>
                    <th className="px-4 py-3 text-gray-500 font-bold text-center">মোট পঠিত MCQ</th>
                    <th className="px-4 py-3 text-gray-500 font-bold text-center text-indigo-700 bg-indigo-50/30">৭ দিনে পঠিত MCQ</th>
                    <th className="px-4 py-3 text-gray-500 font-bold text-center text-pink-700 bg-pink-50/30">অফিসিয়াল পরীক্ষা</th>
                    <th className="px-4 py-3 text-gray-500 font-bold text-center text-green-700">অনুমোদিত পয়েন্ট</th>
                    <th className="px-4 py-3 text-gray-500 font-bold text-center text-amber-700">পেন্ডিং পয়েন্ট</th>
                    <th className="px-4 py-3 text-gray-500 font-bold text-right">নিবন্ধন তারিখ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedUsers.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="text-center text-gray-400 py-8">কোনো শিক্ষার্থী পাওয়া যায়নি।</td>
                    </tr>
                  ) : (
                    sortedUsers.map((u, idx) => (
                      <tr key={u.userId ? `usr-${u.userId}-${idx}` : u.phone ? `usr-${u.phone}-${idx}` : `usr-${idx}`} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3 font-bold text-gray-800 flex items-center gap-2">
                          <img src={u.avatar} alt="Avatar" className="w-6 h-6 rounded-full bg-indigo-50 border shrink-0 object-cover" />
                          {u.name}
                        </td>
                        <td className="px-4 py-3 font-mono font-bold text-indigo-700">
                          <span className="bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded text-[11px]">
                            {u.userId || 'MDH-GUEST'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-mono text-gray-700 font-medium">{u.email || '—'}</span>
                            {u.emailVerified ? (
                              <span className="text-[9px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 rounded-full w-fit">
                                ✅ ভেরিফাইড
                              </span>
                            ) : (
                              <span className="text-[9px] font-extrabold text-amber-700 bg-amber-50 border border-amber-100 px-1.5 rounded-full w-fit">
                                ⚠️ পেন্ডিং
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-gray-600">{u.phone}</td>
                        <td className="px-4 py-3 text-gray-600 font-medium truncate max-w-[140px]">{u.education || 'উল্লেখ নেই'}</td>
                        <td className="px-4 py-3 text-center text-gray-600 font-bold">{(u.lifetimeAnswered || 0).toLocaleString('bn-BD')}টি</td>
                        <td className="px-4 py-3 text-center text-indigo-700 font-extrabold bg-indigo-50/20">{(u.last7DaysMcq || 0).toLocaleString('bn-BD')}টি</td>
                        <td className="px-4 py-3 text-center text-pink-700 font-extrabold bg-pink-50/20">{(u.officialExamsAttained || 0).toLocaleString('bn-BD')}টি</td>
                        <td className="px-4 py-3 text-center text-green-700 font-extrabold font-mono text-xs">{u.approvedPoints}</td>
                        <td className="px-4 py-3 text-center text-amber-700 font-extrabold font-mono text-xs">{u.pendingPoints}</td>
                        <td className="px-4 py-3 text-right text-gray-400 text-[10px]">
                          {new Date(u.createdAt).toLocaleDateString('bn-BD')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );
      })()}

      {activeTab === 'feedback' && (
        <div className="flex flex-col gap-6">
          {/* Global Display & System Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Toggle Switch for MCQ Count Display */}
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between gap-4 animate-fade-in">
              <div className="flex flex-col gap-1">
                <h3 className="font-bold text-sm text-gray-800 flex items-center gap-1.5">
                  🔢 কার্ডে মোট MCQ সংখ্যা প্রদর্শন
                </h3>
                <p className="text-gray-500 text-[10px] sm:text-xs">
                  ইউজার পোর্টালে বিষয়, পরীক্ষা ও সাল ভিত্তিক ক্যাটাগরি ও সাব-ক্যাটাগরি কার্ডে মোট প্রশ্নসংখ্যা প্রদর্শন থাকবে কি না তা নিয়ন্ত্রণ করুন।
                </p>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <span className={`text-xs font-bold ${showMcqCount ? 'text-emerald-600' : 'text-gray-400'}`}>
                  {showMcqCount ? 'প্রদর্শিত (চালু)' : 'লুকানো (বন্ধ)'}
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showMcqCount}
                    onChange={(e) => onToggleMcqCount && onToggleMcqCount(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>
            </div>

            {/* Toggle Switch for user explanation submission */}
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between gap-4 animate-fade-in">
              <div className="flex flex-col gap-1">
                <h3 className="font-bold text-sm text-gray-800 flex items-center gap-1.5">
                  ✍️ শিক্ষার্থীদের ব্যাখ্যা সাবমিট করার সুবিধা
                </h3>
                <p className="text-gray-500 text-[10px] sm:text-xs">
                  শিক্ষার্থীরা কোনো প্রশ্ন রিভিউ করার সময় নতুন ব্যাখ্যা যোগ করতে পারবে কি না তা নিয়ন্ত্রণ করুন।
                </p>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <span className={`text-xs font-bold ${allowUserExplanation ? 'text-indigo-600' : 'text-gray-400'}`}>
                  {allowUserExplanation ? 'চালু আছে' : 'বন্ধ আছে'}
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowUserExplanation}
                    onChange={(e) => onToggleUserExplanation(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Section 1: Error Reports */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-3 text-xs animate-fade-in">
            <h3 className="font-bold text-sm text-gray-800 flex items-center gap-1.5 border-b pb-2">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              🚩 ভুল রিপোর্ট ও কমেন্ট ম্যানেজমেন্ট ({questions.reduce((acc, q) => acc + (q.comments?.filter(c => !c.pointsApproved).length || 0), 0)})
            </h3>
            <div className="flex flex-col gap-4 mt-1">
              {(() => {
                const questionsWithComments = questions.filter(q => q.comments && q.comments.some(c => !c.pointsApproved));
                if (questionsWithComments.length === 0) {
                  return <div className="text-center text-gray-400 py-6 font-semibold">কোনো ভুল রিপোর্ট পাওয়া যায়নি।</div>;
                }
                return questionsWithComments.map(q => (
                  <div key={q.id} className="border border-rose-100 bg-rose-50/10 p-4 rounded-2xl flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 border-b border-rose-50 pb-2">
                      <div className="flex-1">
                        <span className="bg-rose-50 text-rose-700 text-[9px] font-bold px-2 py-0.5 rounded border border-rose-100 mb-1 inline-block">
                          প্রশ্ন আইডি: {q.id}
                        </span>
                        <h4 className="font-bold text-gray-900 leading-relaxed text-xs">{q.text}</h4>
                        <p className="text-[10px] text-green-700 font-bold mt-1">
                          সঠিক উত্তর: {q[q.correct.replace('Option ', 'option') as keyof Question] as string}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 mt-2 sm:mt-0 shrink-0">
                        <button
                          onClick={() => handleStartEdit(q)}
                          className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold px-2.5 py-1.5 rounded-lg border border-indigo-150 transition text-[10px] flex items-center gap-1"
                        >
                          ✏️ প্রশ্ন এডিট করুন
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      {q.comments?.filter(c => !c.pointsApproved).map(c => (
                        <div key={c.id} className="bg-white border border-gray-100 p-3 rounded-xl flex justify-between items-start gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="font-extrabold text-gray-800 text-[10px]">{c.userName}</span>
                              <span className="text-[9px] font-semibold text-gray-400 font-mono">({c.userPhone})</span>
                              <span className="text-[9px] text-gray-300 font-medium">| {new Date(c.createdAt).toLocaleString('bn-BD')}</span>
                              <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                                Pending point ⏳
                              </span>
                            </div>
                            <p className="text-gray-700 font-medium leading-relaxed">{c.text}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => {
                                const updated = q.comments?.map(comm => comm.id === c.id ? { ...comm, pointsApproved: true } : comm) || [];
                                onUpdateQuestion(q.id, { comments: updated });
                                showCustomAlert('পয়েন্ট অনুমোদিত', 'পয়েন্ট সফলভাবে অনুমোদন করা হয়েছে! শিক্ষার্থী ১ কন্ট্রিবিউশন পয়েন্ট পেয়েছেন।', 'success');
                              }}
                              className="bg-amber-50 hover:bg-amber-100 text-amber-700 font-extrabold px-2 py-1 rounded-lg border border-amber-150 transition text-[9px]"
                            >
                              🪙 পয়েন্ট অনুমোদন করুন
                            </button>
                            <button
                              onClick={() => {
                                showCustomConfirm(
                                  'রিপোর্ট ডিলিট',
                                  'আপনি কি নিশ্চিতভাবে এই রিপোর্টটি ডিলিট করতে চান?',
                                  () => {
                                    const updated = q.comments?.filter(comm => comm.id !== c.id) || [];
                                    onUpdateQuestion(q.id, { comments: updated });
                                    showCustomAlert('সম্পন্ন', 'রিপোর্টটি সফলভাবে ডিলিট করা হয়েছে!', 'success');
                                  },
                                  'warning'
                                );
                              }}
                              className="p-1.5 hover:bg-rose-50 text-rose-600 hover:text-rose-800 rounded-lg transition shrink-0"
                              title="রিপোর্ট ডিলিট"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>

          {/* Section 2: User Explanations */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-3 text-xs animate-fade-in">
            <h3 className="font-bold text-sm text-gray-800 flex items-center gap-1.5 border-b pb-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ✍️ ব্যবহারকারীদের সঠিক ব্যাখ্যা সমূহের রিভিউ ও মডারেশন ({questions.reduce((acc, q) => acc + (q.userExplanations?.filter(e => !e.approved).length || 0), 0)})
            </h3>
            <div className="flex flex-col gap-4 mt-1">
              {(() => {
                const questionsWithExpls = questions.filter(q => q.userExplanations && q.userExplanations.some(e => !e.approved));
                if (questionsWithExpls.length === 0) {
                  return <div className="text-center text-gray-400 py-6 font-semibold">কোনো ব্যবহারকারীর নতুন ব্যাখ্যা পাওয়া যায়নি।</div>;
                }
                return questionsWithExpls.map(q => (
                  <div key={q.id} className="border border-indigo-100 bg-indigo-50/5 p-4 rounded-2xl flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 border-b border-indigo-50 pb-2">
                      <div className="flex-1">
                        <span className="bg-indigo-50 text-indigo-700 text-[9px] font-bold px-2 py-0.5 rounded border border-indigo-100 mb-1 inline-block">
                          প্রশ্ন আইডি: {q.id}
                        </span>
                        <h4 className="font-bold text-gray-900 leading-relaxed text-xs">{q.text}</h4>
                        <div className="flex flex-col gap-1 mt-1.5 text-[10px] text-gray-500 font-semibold">
                          <p className="text-green-700">
                            সঠিক উত্তর: {q[q.correct.replace('Option ', 'option') as keyof Question] as string}
                          </p>
                          <p className="text-amber-800">
                            মূল ব্যাখ্যা: {q.explanation || 'মূল ব্যাখ্যা নেই।'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2 sm:mt-0 shrink-0">
                        <button
                          onClick={() => handleStartEdit(q)}
                          className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold px-2.5 py-1.5 rounded-lg border border-indigo-150 transition text-[10px] flex items-center gap-1"
                        >
                          ✏️ প্রশ্ন এডিট করুন
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      {q.userExplanations?.filter(e => !e.approved).map(e => (
                        <div key={e.id} className="bg-white border border-gray-100 p-3 rounded-xl flex justify-between items-start gap-4 shadow-2xs">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              <span className="font-extrabold text-gray-850 text-[10px]">{e.userName}</span>
                              <span className="text-[9px] font-semibold text-gray-400 font-mono">({e.userPhone})</span>
                              <span className="text-[9px] text-gray-300">| {new Date(e.createdAt).toLocaleString('bn-BD')}</span>
                              <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded-full ${e.approved ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
                                {e.approved ? 'Approved ✅' : 'Pending ⏳'}
                              </span>
                              <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded-full ${e.pointsApproved ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
                                {e.pointsApproved ? 'Approved point ✅' : 'Pending point ⏳'}
                              </span>
                            </div>
                            <p className="text-gray-700 leading-relaxed font-medium whitespace-pre-line bg-gray-50/40 p-2 rounded-lg">{e.text}</p>
                          </div>
                          
                          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1.5 shrink-0">
                            {e.pointsApproved ? (
                              <span className="bg-emerald-50 text-emerald-700 text-[9px] font-extrabold px-2 py-1 rounded-lg border border-emerald-100 flex items-center gap-0.5">
                                পয়েন্ট অনুমোদিত ✅
                              </span>
                            ) : (
                              <button
                                onClick={() => {
                                  const updated = q.userExplanations?.map(ex => ex.id === e.id ? { ...ex, pointsApproved: true } : ex) || [];
                                  onUpdateQuestion(q.id, { userExplanations: updated });
                                  showCustomAlert('পয়েন্ট অনুমোদিত', 'পয়েন্ট সফলভাবে অনুমোদন করা হয়েছে! শিক্ষার্থী ১ কন্ট্রিবিউশন পয়েন্ট পেয়েছেন।', 'success');
                                }}
                                className="bg-amber-50 hover:bg-amber-100 text-amber-700 font-extrabold px-2 py-1 rounded-lg border border-amber-150 transition text-[9px]"
                              >
                                🪙 পয়েন্ট অনুমোদন করুন
                              </button>
                            )}

                            {!e.approved && (
                              <button
                                onClick={() => {
                                  const updated = q.userExplanations?.map(ex => ex.id === e.id ? { ...ex, approved: true } : ex) || [];
                                  onUpdateQuestion(q.id, { userExplanations: updated });
                                  showCustomAlert('অনুমোদন সম্পন্ন', 'ব্যাখ্যাটি সফলভাবে অনুমোদন করা হয়েছে! এখন এটি ইউজার প্যানেলে মূল ব্যাখ্যার নিচে প্রদর্শিত হবে।', 'success');
                                }}
                                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-extrabold px-2 py-1 rounded-lg border border-emerald-100 hover:border-emerald-200 transition text-[10px]"
                              >
                                অনুমোদন করুন
                              </button>
                            )}
                            <button
                              onClick={() => setEditingExpl({ qId: q.id, explId: e.id, text: e.text })}
                              className="bg-slate-50 hover:bg-slate-100 text-slate-700 font-extrabold px-2 py-1 rounded-lg border border-slate-100 hover:border-slate-200 transition text-[10px]"
                            >
                              এডিট
                            </button>
                            <button
                              onClick={() => {
                                showCustomConfirm(
                                  'ব্যাখ্যা ডিলিট',
                                  'আপনি কি নিশ্চিতভাবে এই ব্যাখ্যাটি ডিলিট করতে চান?',
                                  () => {
                                    const updated = q.userExplanations?.filter(ex => ex.id !== e.id) || [];
                                    onUpdateQuestion(q.id, { userExplanations: updated });
                                    showCustomAlert('সম্পন্ন', 'ব্যাখ্যাটি ডিলিট করা হয়েছে!', 'success');
                                  },
                                  'warning'
                                );
                              }}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold px-2 py-1 rounded-lg border border-rose-100 hover:border-rose-250 transition text-[10px]"
                            >
                              ডিলিট
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {/* 9. BACKUP & RESTORE MANAGER TAB */}
      {activeTab === 'backup' && (
        <div className="flex flex-col gap-5 animate-fade-in text-xs">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 rounded-2xl shadow-md border border-indigo-900/40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-indigo-600/30 rounded-2xl border border-indigo-500/30 text-indigo-300 shrink-0">
                <Database className="w-8 h-8 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                  📦 ডাটাবেজ ব্যাকআপ ও রিস্টোর সেন্টার (Backup Manager)
                </h2>
                <p className="text-xs text-indigo-200 mt-1 leading-relaxed max-w-2xl font-medium">
                  আপনার অর্জনের সম্পূর্ণ সিস্টেম ডাটাবেজ (নিবন্ধিত ইউজার, MCQ প্রশ্ন ব্যাংক, লাইভ পরীক্ষা, নোটিশ, রুটিন, পরীক্ষার রেজাল্ট ও সেটিংস) এক ক্লিকে JSON ব্যাকআপ ডাউনলোড করুন অথবা পূর্বের ব্যাকআপ ফাইল থেকে ডাটাবেজ রিস্টোর করুন।
                </p>
              </div>
            </div>
            
            <button
              onClick={handleExportBackup}
              className="bg-indigo-500 hover:bg-indigo-600 text-white font-extrabold text-xs px-4 py-3 rounded-xl shadow-lg shadow-indigo-600/30 transition flex items-center gap-2 shrink-0 border border-indigo-400/30 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>ডাউনলোড ব্যাকআপ JSON</span>
            </button>
          </div>

          {/* Database Storage Live Metrics */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-3">
            <h3 className="font-extrabold text-sm text-gray-800 flex items-center gap-2 border-b pb-2">
              <HardDrive className="w-4 h-4 text-indigo-600" />
              বর্তমান লোকাল ডাটাবেজ স্থিতি (Current Database Metrics)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
              <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl text-center flex flex-col justify-center">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">মোট নিবন্ধিত শিক্ষার্থী</span>
                <span className="text-lg font-black text-slate-800 mt-1">{users.length.toLocaleString('bn-BD')} জন</span>
              </div>
              <div className="bg-indigo-50/60 border border-indigo-100/60 p-3.5 rounded-xl text-center flex flex-col justify-center">
                <span className="text-[10px] font-bold text-indigo-600/80 uppercase tracking-wider block">সঞ্চিত MCQ প্রশ্ন</span>
                <span className="text-lg font-black text-indigo-900 mt-1">{questions.length.toLocaleString('bn-BD')} টি</span>
              </div>
              <div className="bg-emerald-50/60 border border-emerald-100/60 p-3.5 rounded-xl text-center flex flex-col justify-center">
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">পরীক্ষার সাবমিশন রেকর্ড</span>
                <span className="text-lg font-black text-emerald-800 mt-1">{attempts.length.toLocaleString('bn-BD')} টি</span>
              </div>
              <div className="bg-amber-50/60 border border-amber-100/60 p-3.5 rounded-xl text-center flex flex-col justify-center">
                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">লাইভ পরীক্ষা ও রুটিন</span>
                <span className="text-lg font-black text-amber-800 mt-1">{(liveExams.length + routines.length).toLocaleString('bn-BD')} টি</span>
              </div>
            </div>
          </div>

          {/* Action Cards: Export & Import */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Card 1: EXPORT SYSTEM */}
            <div className="bg-white border border-indigo-100 rounded-2xl p-5 shadow-sm flex flex-col justify-between gap-4 relative overflow-hidden">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <FileJson className="w-5 h-5" />
                  </span>
                  <h3 className="font-extrabold text-sm text-indigo-950">১. সম্পূর্ণ ডাটাবেজ ব্যাকআপ ডাউনলোড (Export)</h3>
                </div>
                <p className="text-gray-600 leading-relaxed text-[11px] font-medium">
                  আপনার ব্রাউজারের `localStorage`-এ সংরক্ষিত সকল প্রশ্ন, ইউজার, ক্যাটালগ এবং পরীক্ষার ইতিহাস একত্রে একটি স্ট্রাকচার্ড JSON ফাইল আকারে কম্পিউটারে/ফোনে সেভ করুন।
                </p>
                <div className="bg-indigo-50/50 border border-indigo-100/60 p-3 rounded-xl text-[10px] text-indigo-900 space-y-1">
                  <span className="font-bold block text-indigo-950">📌 ফাইল নাম ফরম্যাট:</span>
                  <code className="bg-white px-2 py-0.5 rounded border border-indigo-200 text-indigo-700 font-mono font-bold block w-fit">
                    orjon_backup_{new Date().toISOString().slice(0, 10)}.json
                  </code>
                </div>
              </div>

              <button
                onClick={handleExportBackup}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3 rounded-xl shadow-md shadow-indigo-200 transition flex items-center justify-center gap-2 text-xs cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>ব্যাকআপ ডাউনলোড করুন (Export Backup)</span>
              </button>
            </div>

            {/* Card 2: IMPORT & RESTORE SYSTEM */}
            <div className="bg-white border border-amber-100 rounded-2xl p-5 shadow-sm flex flex-col justify-between gap-4 relative overflow-hidden">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="p-2 bg-amber-50 text-amber-700 rounded-xl">
                    <RotateCcw className="w-5 h-5" />
                  </span>
                  <h3 className="font-extrabold text-sm text-amber-950">২. ডাটাবেজ রিস্টোর করুন (Import & Restore)</h3>
                </div>
                <p className="text-gray-600 leading-relaxed text-[11px] font-medium">
                  পূর্বে সেভ করা `.json` ব্যাকআপ ফাইল সিলেক্ট করে ডাটাবেজ আগের অবস্থায় ফিরিয়ে আনুন। রিস্টোর সম্পন্ন হলে লোকাল ডাটাবেজ আপডেট হয়ে পেজ রিলোড হবে।
                </p>
                <div className="bg-amber-50/60 border border-amber-100 p-3 rounded-xl text-[10px] text-amber-900 space-y-1">
                  <span className="font-bold block text-amber-950">⚠️ সতর্কবার্তা:</span>
                  <p className="leading-snug">
                    রিস্টোর করার সাথে সাথে বর্তমান ডাটাবেজের তথ্য ব্যাকআপ ফাইলের তথ্য দ্বারা প্রতিস্থাপিত হবে।
                  </p>
                </div>
              </div>

              <label className="w-full bg-amber-600 hover:bg-amber-700 text-white font-extrabold py-3 rounded-xl shadow-md shadow-amber-200 transition flex items-center justify-center gap-2 text-xs cursor-pointer text-center">
                <Upload className="w-4 h-4" />
                <span>ব্যাকআপ ফাইল নির্বাচন করুন (Import Backup)</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleImportBackupFile}
                  className="hidden"
                />
              </label>
            </div>

          </div>

          {/* Usage Instructions Box */}
          <div className="bg-slate-50 border border-slate-200/70 p-4 rounded-2xl flex flex-col gap-2">
            <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
              💡 কীভাবে ব্যাকআপ ফাইল ডাউনলোড করবেন?
            </h4>
            <ol className="list-decimal list-inside text-[11px] text-slate-600 space-y-1 font-medium leading-relaxed pl-1">
              <li>উপরে উল্লিখিত <strong>"ডাউনলোড ব্যাকআপ JSON"</strong> অথবা <strong>"ব্যাকআপ ডাউনলোড করুন"</strong> বাটনে ক্লিক করুন।</li>
              <li>আপনার ব্রাউজার সাথে সাথে ব্যাকআপ ফাইলটি আপনার ডিভাইস বা কম্পিউটারের Downloads ফোল্ডারে সেভ করবে।</li>
              <li>ভবিষ্যতে কোনো কারণে ডাটা রিসেট হলে বা নতুন ডিভাইসে শিফট করতে চাইলে <strong>"ব্যাকআপ ফাইল নির্বাচন করুন"</strong> এ ক্লিক করে ফাইলটি আপলোড করলেই পূর্বের সকল ডাটা ফিরে আসবে।</li>
            </ol>
          </div>

          {/* ---------------------------------------------------- */}
          {/* FIREBASE CLOUD DATABASE INTEGRATION & MIGRATION TOOL */}
          {/* ---------------------------------------------------- */}
          <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 rounded-3xl p-6 text-white shadow-xl flex flex-col gap-6 relative overflow-hidden mt-2">
            
            {/* Title Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-indigo-800/50 pb-5">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-500/20 border border-indigo-400/30 rounded-2xl text-indigo-300 shrink-0">
                  <Sparkles className="w-7 h-7 text-amber-400 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                      🔥 ক্লাউড ডাটাবেজ ইন্টিগ্রেশন (Firebase Suite)
                    </h3>
                    <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                      ● সংযুক্ত (Connected)
                    </span>
                  </div>
                  <p className="text-xs text-indigo-200 mt-1 font-medium">
                    Google Firebase Authentication, Cloud Firestore Database & Firebase Storage সার্ভিস অর্জনে সক্রিয় রয়েছে।
                  </p>
                </div>
              </div>

              <button
                onClick={handleRefreshFirestoreCounts}
                disabled={isCountingFirestore}
                className="bg-indigo-600/60 hover:bg-indigo-600 text-indigo-100 font-extrabold text-xs px-4 py-2.5 rounded-xl border border-indigo-400/30 transition flex items-center gap-2 shrink-0 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isCountingFirestore ? 'animate-spin' : ''}`} />
                <span>ফায়ারস্টোর ডাটা গণনা করুন</span>
              </button>
            </div>

            {/* Connection Credentials Overview */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white/5 border border-white/10 p-3.5 rounded-2xl backdrop-blur-xs flex flex-col">
                <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider">Project ID</span>
                <span className="text-sm font-extrabold text-white mt-0.5 font-mono">{firebaseConfig.projectId}</span>
                <span className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1 font-semibold">
                  <CheckCircle2 className="w-3 h-3" /> Cloud Firestore Live
                </span>
              </div>
              <div className="bg-white/5 border border-white/10 p-3.5 rounded-2xl backdrop-blur-xs flex flex-col">
                <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider">Authentication Domain</span>
                <span className="text-xs font-extrabold text-white mt-0.5 font-mono truncate">{firebaseConfig.authDomain}</span>
                <span className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1 font-semibold">
                  <CheckCircle2 className="w-3 h-3" /> Auth Ready
                </span>
              </div>
              <div className="bg-white/5 border border-white/10 p-3.5 rounded-2xl backdrop-blur-xs flex flex-col">
                <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider">Storage Bucket</span>
                <span className="text-xs font-extrabold text-white mt-0.5 font-mono truncate">{firebaseConfig.storageBucket}</span>
                <span className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1 font-semibold">
                  <CheckCircle2 className="w-3 h-3" /> Cloud Storage Ready
                </span>
              </div>
            </div>

            {/* Live Firestore Document Counts Inspector */}
            {firestoreCounts && (
              <div className="bg-slate-950/70 border border-indigo-500/30 p-4 rounded-2xl flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="font-extrabold text-xs text-indigo-200 flex items-center gap-2">
                    📊 Cloud Firestore কালেকশন নথি সংখ্যা (Live Counts)
                  </span>
                  <span className="text-[10px] text-indigo-300 font-bold bg-indigo-900/60 px-2.5 py-0.5 rounded-full border border-indigo-700/50">
                    মোট: {(Object.values(firestoreCounts) as number[]).reduce((a, b) => a + b, 0).toLocaleString('bn-BD')} টি
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 text-[11px]">
                  <div className="bg-indigo-950/40 border border-indigo-800/40 p-2.5 rounded-xl text-center">
                    <span className="text-[10px] text-indigo-300 font-medium block">questions</span>
                    <span className="text-sm font-extrabold text-white">{firestoreCounts.questions.toLocaleString('bn-BD')}</span>
                  </div>
                  <div className="bg-indigo-950/40 border border-indigo-800/40 p-2.5 rounded-xl text-center">
                    <span className="text-[10px] text-indigo-300 font-medium block">users</span>
                    <span className="text-sm font-extrabold text-white">{firestoreCounts.users.toLocaleString('bn-BD')}</span>
                  </div>
                  <div className="bg-indigo-950/40 border border-indigo-800/40 p-2.5 rounded-xl text-center">
                    <span className="text-[10px] text-indigo-300 font-medium block">bookmarks</span>
                    <span className="text-sm font-extrabold text-white">{firestoreCounts.bookmarks.toLocaleString('bn-BD')}</span>
                  </div>
                  <div className="bg-indigo-950/40 border border-indigo-800/40 p-2.5 rounded-xl text-center">
                    <span className="text-[10px] text-indigo-300 font-medium block">attempts</span>
                    <span className="text-sm font-extrabold text-white">{firestoreCounts.attempts.toLocaleString('bn-BD')}</span>
                  </div>
                  <div className="bg-indigo-950/40 border border-indigo-800/40 p-2.5 rounded-xl text-center">
                    <span className="text-[10px] text-indigo-300 font-medium block">categories</span>
                    <span className="text-sm font-extrabold text-white">{firestoreCounts.categories.toLocaleString('bn-BD')}</span>
                  </div>
                  <div className="bg-indigo-950/40 border border-indigo-800/40 p-2.5 rounded-xl text-center">
                    <span className="text-[10px] text-indigo-300 font-medium block">subcategories</span>
                    <span className="text-sm font-extrabold text-white">{firestoreCounts.subcategories.toLocaleString('bn-BD')}</span>
                  </div>
                  <div className="bg-indigo-950/40 border border-indigo-800/40 p-2.5 rounded-xl text-center">
                    <span className="text-[10px] text-indigo-300 font-medium block">notices</span>
                    <span className="text-sm font-extrabold text-white">{firestoreCounts.notices.toLocaleString('bn-BD')}</span>
                  </div>
                  <div className="bg-indigo-950/40 border border-indigo-800/40 p-2.5 rounded-xl text-center">
                    <span className="text-[10px] text-indigo-300 font-medium block">routines</span>
                    <span className="text-sm font-extrabold text-white">{firestoreCounts.routines.toLocaleString('bn-BD')}</span>
                  </div>
                  <div className="bg-indigo-950/40 border border-indigo-800/40 p-2.5 rounded-xl text-center">
                    <span className="text-[10px] text-indigo-300 font-medium block">live_exams</span>
                    <span className="text-sm font-extrabold text-white">{firestoreCounts.live_exams.toLocaleString('bn-BD')}</span>
                  </div>
                  <div className="bg-indigo-950/40 border border-indigo-800/40 p-2.5 rounded-xl text-center">
                    <span className="text-[10px] text-indigo-300 font-medium block">courses</span>
                    <span className="text-sm font-extrabold text-white">{(firestoreCounts.courses || 0).toLocaleString('bn-BD')}</span>
                  </div>
                  <div className="bg-indigo-950/40 border border-indigo-800/40 p-2.5 rounded-xl text-center">
                    <span className="text-[10px] text-indigo-300 font-medium block">upload_history</span>
                    <span className="text-sm font-extrabold text-white">{firestoreCounts.upload_history.toLocaleString('bn-BD')}</span>
                  </div>
                  <div className="bg-indigo-950/40 border border-indigo-800/40 p-2.5 rounded-xl text-center">
                    <span className="text-[10px] text-indigo-300 font-medium block">audit_logs</span>
                    <span className="text-sm font-extrabold text-white">{(firestoreCounts.audit_logs || 0).toLocaleString('bn-BD')}</span>
                  </div>
                </div>
              </div>
            )}

            {/* ONE-TIME MIGRATION ACTIONS */}
            <div className="bg-indigo-950/50 border border-indigo-800/50 p-5 rounded-2xl flex flex-col gap-4">
              <div>
                <h4 className="font-extrabold text-sm text-white flex items-center gap-2">
                  🔄 এক-ক্লিক ফায়ারস্টোর ডাটা মাইগ্রেশন টুল (One-time Migration Tool)
                </h4>
                <p className="text-xs text-indigo-200 mt-1 leading-relaxed">
                  আপনার বর্তমান LocalStorage এর তথ্য অথবা ডাউনলোডকৃত JSON ব্যাকআপ ফাইল সরাসরি Cloud Firestore কালেকশনে আপলোড ও কনভার্ট করুন। মাইগ্রেশন চলাকালীন ও শেষে আপনার LocalStorage ব্যাকআপ সম্পূর্ণ অক্ষত থাকবে।
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Migration Action 1 */}
                <button
                  onClick={handleStartLocalStorageMigration}
                  disabled={isMigrating}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3.5 px-4 rounded-xl shadow-lg shadow-emerald-950/40 border border-emerald-400/30 transition flex items-center justify-center gap-2 text-xs cursor-pointer disabled:opacity-50"
                >
                  <Database className="w-4 h-4" />
                  <span>১. LocalStorage থেকে Firestore-এ স্থানান্তর করুন</span>
                </button>

                {/* Migration Action 2 */}
                <label className="bg-indigo-600 hover:bg-indigo-500 text-white font-black py-3.5 px-4 rounded-xl shadow-lg shadow-indigo-950/40 border border-indigo-400/30 transition flex items-center justify-center gap-2 text-xs cursor-pointer text-center disabled:opacity-50">
                  <Upload className="w-4 h-4" />
                  <span>২. ব্যাকআপ JSON ফাইল সিলেক্ট করে Firestore-এ আপলোড করুন</span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleStartJSONBackupMigration}
                    disabled={isMigrating}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Live Migration Status Message & Logs */}
              {isMigrating && (
                <div className="bg-slate-900 border border-amber-500/40 p-4 rounded-xl flex flex-col gap-2 animate-pulse">
                  <div className="flex items-center gap-2 text-amber-300 font-extrabold text-xs">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>মাইগ্রেশন চলমান: {migrationStatusMsg}</span>
                  </div>
                  <div className="bg-black/60 p-3 rounded-lg text-[10px] font-mono text-emerald-400 max-h-32 overflow-y-auto space-y-1">
                    {migrationLogs.map((log, idx) => (
                      <div key={idx}>{log}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* Migration Report Summary */}
              {migrationReport && (
                <div className="bg-emerald-950/80 border border-emerald-500/50 p-4 rounded-xl flex flex-col gap-3">
                  <div className="flex justify-between items-center border-b border-emerald-800/60 pb-2">
                    <span className="font-extrabold text-xs text-emerald-200 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      সর্বশেষ মাইগ্রেশন রিপোর্ট (Migration Report Summary)
                    </span>
                    <span className="text-[10px] text-emerald-300 font-mono">
                      {new Date(migrationReport.timestamp).toLocaleTimeString('bn-BD')}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                    <div className="bg-emerald-900/40 p-2 rounded-lg text-center">
                      <span className="text-[10px] text-emerald-300 block">উৎস (Source)</span>
                      <span className="font-bold text-white">{migrationReport.source}</span>
                    </div>
                    <div className="bg-emerald-900/40 p-2 rounded-lg text-center">
                      <span className="text-[10px] text-emerald-300 block">মোট মাইগ্রেটেড নথি</span>
                      <span className="font-bold text-white">{migrationReport.totalDocuments.toLocaleString('bn-BD')} টি</span>
                    </div>
                    <div className="bg-emerald-900/40 p-2 rounded-lg text-center">
                      <span className="text-[10px] text-emerald-300 block">questions</span>
                      <span className="font-bold text-white">{migrationReport.counts.questions.toLocaleString('bn-BD')} টি</span>
                    </div>
                    <div className="bg-emerald-900/40 p-2 rounded-lg text-center">
                      <span className="text-[10px] text-emerald-300 block">users</span>
                      <span className="font-bold text-white">{migrationReport.counts.users.toLocaleString('bn-BD')} টি</span>
                    </div>
                  </div>

                  <p className="text-[10px] text-emerald-200/90 font-medium">
                    🛡️ <strong>ব্যাকআপ সুরক্ষা:</strong> আপনার লোকাল ব্রাউজার ডাটাবেজ (localStorage) পূর্বের মতোই সংরক্ষিত রয়েছে এবং ডাটা নিশ্চিতভাবে যাচাই করা পর্যন্ত ব্যাকআপ হিসেবে ব্যবহৃত হতে পারবে।
                  </p>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* 10. FIRESTORE MIGRATION DEDICATED SECTION */}
      {activeTab === 'firestore-migration' && (
        <div className="flex flex-col gap-6 animate-fade-in">
          
          {/* Header Card */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 rounded-3xl p-6 text-white shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-indigo-500/20 border border-indigo-400/30 rounded-2xl text-indigo-300 shrink-0">
                <Sparkles className="w-8 h-8 text-amber-400 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                    🔥 Firestore Migration Center
                  </h2>
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">
                    ● Cloud Firestore Live
                  </span>
                </div>
                <p className="text-xs text-indigo-200 mt-1 font-medium">
                  মাইগ্রেশন টুল দিয়ে আপনার লোকাল ব্রাউজার ডাটাবেজ বা ব্যাকআপ JSON ফাইলের তথ্য ফায়ারস্টোর ক্লাউডে স্থানান্তর ও ভেরিফাই করুন।
                </p>
              </div>
            </div>

            <button
              onClick={handleRefreshFirestoreCounts}
              disabled={isCountingFirestore}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl border border-indigo-400/30 transition shadow-md flex items-center gap-2 shrink-0 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isCountingFirestore ? 'animate-spin' : ''}`} />
              <span>ফায়ারস্টোর কানেকশন ভেরিফাই করুন</span>
            </button>
          </div>

          {/* Step 1: Upload Backup JSON File */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col gap-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-2xl text-indigo-600 shrink-0">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">
                  ১. ব্যাকআপ JSON ফাইল আপলোড করুন (Upload Backup JSON File)
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  কম্পিউটার বা ডিভাইস থেকে পূর্বে সংসংরক্ষিত ব্যাকআপ JSON ফাইল আপলোড করে মাইগ্রেশনের জন্য ডাটা যাচাই করুন।
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
              <label className="border-2 border-dashed border-indigo-300 hover:border-indigo-500 bg-indigo-50/40 hover:bg-indigo-50/80 transition rounded-2xl p-5 text-center flex flex-col items-center justify-center gap-2 cursor-pointer group">
                <FileText className="w-8 h-8 text-indigo-500 group-hover:scale-110 transition" />
                <span className="font-bold text-xs text-slate-800">
                  {uploadedBackupFileDetails ? 'অন্য কোনো ব্যাকআপ JSON সিলেক্ট করুন' : 'মাইগ্রেশনের জন্য ব্যাকআপ JSON ফাইল নির্বাচন করুন'}
                </span>
                <span className="text-[10px] text-gray-500">(.json ফাইল সাপোর্টেড)</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleSelectBackupFile}
                  disabled={isMigrating}
                  className="hidden"
                />
              </label>

              {uploadedBackupFileDetails ? (
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex flex-col gap-2">
                  <div className="flex justify-between items-center border-b border-emerald-200 pb-2">
                    <span className="font-extrabold text-xs text-emerald-900 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ফাইল আপলোড সফল
                    </span>
                    <button
                      onClick={() => setUploadedBackupFileDetails(null)}
                      className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                    >
                      রিমুভ করুন
                    </button>
                  </div>

                  <div className="text-xs space-y-1 text-emerald-800">
                    <div>📁 <strong>ফাইল নাম:</strong> {uploadedBackupFileDetails.fileName} ({uploadedBackupFileDetails.fileSizeKB} KB)</div>
                    <div>❓ <strong>চিহ্নিত প্রশ্ন সংখ্যা:</strong> {uploadedBackupFileDetails.questionCount.toLocaleString('bn-BD')} টি</div>
                    <div>📊 <strong>মোট রেকর্ড সংখ্যা:</strong> {uploadedBackupFileDetails.totalRecordCount.toLocaleString('bn-BD')} টি</div>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-2xl text-xs text-gray-500 flex flex-col justify-center gap-1">
                  <div className="font-bold text-slate-700">💡 কোনো ফাইল সিলেক্ট করা নেই</div>
                  <div>আপনি চাইলে সরাসরি আপনার লোকাল ব্রাউজারের LocalStorage থেকে মাইগ্রেশন করতে পারেন, অথবা উপর থেকে JSON ব্যাকআপ আপলোড করতে পারেন।</div>
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Migrate All Data to Firestore */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col gap-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="p-2.5 bg-amber-50 border border-amber-100 rounded-2xl text-amber-600 shrink-0">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">
                  ২. ফায়ারস্টোর ডাটা মাইগ্রেশন এক্সিকিউট করুন (Migrate Data to Firestore)
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  নিচের বাটনে ক্লিক করে প্রশ্ন, ইউজার, রেজাল্ট, ক্যাটাগরি এবং নোটিশ ক্লাউড ফায়ারস্টোর কালেকশনে রাইট করুন।
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={handleStartLocalStorageMigration}
                disabled={isMigrating}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3.5 px-5 rounded-2xl shadow-md transition flex items-center justify-center gap-2 text-xs cursor-pointer disabled:opacity-50"
              >
                <Database className="w-4 h-4" />
                <span>লোকাল ডাটাবেজ (LocalStorage) ➔ Firestore মাইগ্রেশন</span>
              </button>

              <button
                onClick={() => {
                  if (uploadedBackupFileDetails) {
                    showCustomConfirm(
                      'Migrate Uploaded Backup JSON',
                      `আপনি কি "${uploadedBackupFileDetails.fileName}" ফাইলের ${uploadedBackupFileDetails.questionCount}টি প্রশ্ন ও ডাটা Firestore-এ মাইগ্রেট করতে চান?`,
                      async () => {
                        setIsMigrating(true);
                        setMigrationLogs([]);
                        setMigrationStatusMsg('আপলোড করা JSON ফাইল থেকে মাইগ্রেশন হচ্ছে...');
                        try {
                          const report = await migrateDataToFirestore(uploadedBackupFileDetails.parsedData, 'JSON File', (msg) => {
                            setMigrationStatusMsg(msg);
                            setMigrationLogs(prev => [...prev, `[${new Date().toLocaleTimeString('bn-BD')}] ${msg}`]);
                          });
                          setMigrationReport(report);
                          await handleRefreshFirestoreCounts();
                          showCustomAlert('মাইগ্রেশন সম্পন্ন!', `Firebase Firestore-এ ব্যাকআপ ফাইল থেকে মোট ${report.totalDocuments}টি নথি সফলভাবে আপলোড করা হয়েছে।`, 'success');
                        } catch (err: any) {
                          showCustomAlert('ত্রুটি!', `মাইগ্রেশন ব্যর্থ হয়েছে: ${err?.message || String(err)}`, 'warning');
                        } finally {
                          setIsMigrating(false);
                        }
                      }
                    );
                  } else {
                    showCustomAlert('ফাইল প্রয়োজন!', 'মাইগ্রেশন শুরু করার আগে উপরে ১ নম্বর ধাপে একটি JSON ব্যাকআপ ফাইল নির্বাচন করুন।', 'warning');
                  }
                }}
                disabled={isMigrating || !uploadedBackupFileDetails}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3.5 px-5 rounded-2xl shadow-md transition flex items-center justify-center gap-2 text-xs cursor-pointer disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                <span>আপলোড করা JSON ব্যাকআপ ➔ Firestore মাইগ্রেশন</span>
              </button>
            </div>
          </div>

          {/* Step 3: Migration Progress & Realtime Logs */}
          {isMigrating && (
            <div className="bg-slate-900 border border-amber-500/50 rounded-3xl p-6 text-white shadow-xl flex flex-col gap-4 animate-pulse">
              <div className="flex justify-between items-center border-b border-amber-500/30 pb-3">
                <div className="flex items-center gap-2 text-amber-400 font-black text-sm">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>মাইগ্রেশন চলমান: {migrationStatusMsg}</span>
                </div>
                <span className="text-xs bg-amber-500/20 text-amber-300 font-mono px-3 py-1 rounded-full border border-amber-500/30">
                  Batch Operations In Progress...
                </span>
              </div>

              <div className="bg-black/70 p-4 rounded-2xl text-xs font-mono text-emerald-400 max-h-48 overflow-y-auto space-y-1.5 border border-slate-800 shadow-inner">
                {migrationLogs.map((log, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-slate-500 shrink-0">›</span>
                    <span>{log}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 4 & 5 & 7: Migration Report Summary */}
          {migrationReport && (
            <div className="bg-emerald-950/90 border border-emerald-500/50 rounded-3xl p-6 text-white shadow-2xl flex flex-col gap-5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-emerald-800/60 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/20 border border-emerald-400/40 rounded-2xl text-emerald-400 shrink-0">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-black text-base text-white">
                      ✅ ফায়ারস্টোর মাইগ্রেশন রিপোর্ট (Firestore Migration Verification Report)
                    </h3>
                    <p className="text-xs text-emerald-200 mt-0.5 font-medium">
                      উৎস: <span className="font-bold text-white">{migrationReport.source}</span> | সময়: {new Date(migrationReport.timestamp).toLocaleTimeString('bn-BD')}
                    </p>
                  </div>
                </div>

                <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${
                  migrationReport.status === 'success' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                }`}>
                  ● {migrationReport.status === 'success' ? 'সফল (SUCCESS)' : 'ব্যর্থ (FAILED)'}
                </span>
              </div>

              {/* Stat Highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-emerald-900/40 border border-emerald-700/40 p-4 rounded-2xl text-center">
                  <span className="text-[11px] text-emerald-300 font-extrabold uppercase block">মোট রাইট নথি (Total Docs)</span>
                  <span className="text-xl font-black text-white mt-1 block">{migrationReport.totalDocuments.toLocaleString('bn-BD')} টি</span>
                </div>
                <div className="bg-emerald-900/40 border border-emerald-700/40 p-4 rounded-2xl text-center">
                  <span className="text-[11px] text-emerald-300 font-extrabold uppercase block">প্রশ্ন সংখ্যা (Questions)</span>
                  <span className="text-xl font-black text-amber-300 mt-1 block">{migrationReport.counts.questions.toLocaleString('bn-BD')} টি</span>
                </div>
                <div className="bg-emerald-900/40 border border-emerald-700/40 p-4 rounded-2xl text-center">
                  <span className="text-[11px] text-emerald-300 font-extrabold uppercase block">ইউজার সংখ্যা (Users)</span>
                  <span className="text-xl font-black text-white mt-1 block">{migrationReport.counts.users.toLocaleString('bn-BD')} জন</span>
                </div>
                <div className="bg-emerald-900/40 border border-emerald-700/40 p-4 rounded-2xl text-center">
                  <span className="text-[11px] text-emerald-300 font-extrabold uppercase block">পরীক্ষার রেজাল্ট (Attempts)</span>
                  <span className="text-xl font-black text-white mt-1 block">{migrationReport.counts.attempts.toLocaleString('bn-BD')} টি</span>
                </div>
              </div>

              {/* Itemized Collection Summary Grid */}
              <div className="bg-slate-950/60 border border-emerald-800/40 p-4 rounded-2xl flex flex-col gap-2">
                <span className="text-xs font-extrabold text-emerald-300 mb-1">
                  📋 কালেকশন অনুযায়ী বিস্তারিত নথির তালিকা (Itemized Breakdown):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 text-[11px]">
                  <div className="bg-emerald-950/40 p-2 rounded-xl text-center border border-emerald-800/30">
                    <span className="text-emerald-400 block font-mono">questions</span>
                    <span className="font-black text-white text-sm">{migrationReport.counts.questions.toLocaleString('bn-BD')}</span>
                  </div>
                  <div className="bg-emerald-950/40 p-2 rounded-xl text-center border border-emerald-800/30">
                    <span className="text-emerald-400 block font-mono">users</span>
                    <span className="font-black text-white text-sm">{migrationReport.counts.users.toLocaleString('bn-BD')}</span>
                  </div>
                  <div className="bg-emerald-950/40 p-2 rounded-xl text-center border border-emerald-800/30">
                    <span className="text-emerald-400 block font-mono">bookmarks</span>
                    <span className="font-black text-white text-sm">{migrationReport.counts.bookmarks.toLocaleString('bn-BD')}</span>
                  </div>
                  <div className="bg-emerald-950/40 p-2 rounded-xl text-center border border-emerald-800/30">
                    <span className="text-emerald-400 block font-mono">attempts</span>
                    <span className="font-black text-white text-sm">{migrationReport.counts.attempts.toLocaleString('bn-BD')}</span>
                  </div>
                  <div className="bg-emerald-950/40 p-2 rounded-xl text-center border border-emerald-800/30">
                    <span className="text-emerald-400 block font-mono">categories</span>
                    <span className="font-black text-white text-sm">{migrationReport.counts.categories.toLocaleString('bn-BD')}</span>
                  </div>
                  <div className="bg-emerald-950/40 p-2 rounded-xl text-center border border-emerald-800/30">
                    <span className="text-emerald-400 block font-mono">subcategories</span>
                    <span className="font-black text-white text-sm">{migrationReport.counts.subcategories.toLocaleString('bn-BD')}</span>
                  </div>
                  <div className="bg-emerald-950/40 p-2 rounded-xl text-center border border-emerald-800/30">
                    <span className="text-emerald-400 block font-mono">notices</span>
                    <span className="font-black text-white text-sm">{migrationReport.counts.notices.toLocaleString('bn-BD')}</span>
                  </div>
                  <div className="bg-emerald-950/40 p-2 rounded-xl text-center border border-emerald-800/30">
                    <span className="text-emerald-400 block font-mono">routines</span>
                    <span className="font-black text-white text-sm">{migrationReport.counts.routines.toLocaleString('bn-BD')}</span>
                  </div>
                  <div className="bg-emerald-950/40 p-2 rounded-xl text-center border border-emerald-800/30">
                    <span className="text-emerald-400 block font-mono">live_exams</span>
                    <span className="font-black text-white text-sm">{migrationReport.counts.live_exams.toLocaleString('bn-BD')}</span>
                  </div>
                  <div className="bg-emerald-950/40 p-2 rounded-xl text-center border border-emerald-800/30">
                    <span className="text-emerald-400 block font-mono">upload_history</span>
                    <span className="font-black text-white text-sm">{migrationReport.counts.upload_history.toLocaleString('bn-BD')}</span>
                  </div>
                </div>
              </div>

              <div className="bg-black/40 p-3 rounded-xl border border-emerald-800/30 text-xs text-emerald-200 font-medium">
                🛡️ <strong>ব্যাকআপ ও ডাটা সুরক্ষা:</strong> ক্লাউড মাইগ্রেশন সম্পূর্ণ হওয়ার পর আপনার LocalStorage ব্যাকআপ ডাটা নিরাপদ ও অক্ষত রয়েছে।
              </div>
            </div>
          )}

          {/* Step 6: Verify Firestore Collections Inspector */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 border border-indigo-100 rounded-2xl text-indigo-600 shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">
                    ৩. ফায়ারস্টোর কালেকশন ভেরিফিকেশন (Verify Firestore Collections)
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    সার্ভারের ফায়ারস্টোর ক্লাউড ডাটাবেজ থেকে সরাসরি সকল ১০টি কালেকশনের নথির সংখ্যা রিড করে যাচাই করুন।
                  </p>
                </div>
              </div>

              <button
                onClick={handleRefreshFirestoreCounts}
                disabled={isCountingFirestore}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition shadow-xs flex items-center gap-2 shrink-0 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isCountingFirestore ? 'animate-spin' : ''}`} />
                <span>ফায়ারস্টোর রি-ক্যালকুলেট ও যাচাই করুন</span>
              </button>
            </div>

            {firestoreCounts ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                <div className="bg-slate-50 border border-indigo-100 p-3.5 rounded-2xl text-center">
                  <span className="text-[10px] text-gray-500 font-extrabold uppercase block font-mono">questions</span>
                  <span className="text-lg font-black text-indigo-900 mt-1 block">{firestoreCounts.questions.toLocaleString('bn-BD')} টি</span>
                </div>
                <div className="bg-slate-50 border border-indigo-100 p-3.5 rounded-2xl text-center">
                  <span className="text-[10px] text-gray-500 font-extrabold uppercase block font-mono">users</span>
                  <span className="text-lg font-black text-indigo-900 mt-1 block">{firestoreCounts.users.toLocaleString('bn-BD')} জন</span>
                </div>
                <div className="bg-slate-50 border border-indigo-100 p-3.5 rounded-2xl text-center">
                  <span className="text-[10px] text-gray-500 font-extrabold uppercase block font-mono">bookmarks</span>
                  <span className="text-lg font-black text-indigo-900 mt-1 block">{firestoreCounts.bookmarks.toLocaleString('bn-BD')} টি</span>
                </div>
                <div className="bg-slate-50 border border-indigo-100 p-3.5 rounded-2xl text-center">
                  <span className="text-[10px] text-gray-500 font-extrabold uppercase block font-mono">attempts</span>
                  <span className="text-lg font-black text-indigo-900 mt-1 block">{firestoreCounts.attempts.toLocaleString('bn-BD')} টি</span>
                </div>
                <div className="bg-slate-50 border border-indigo-100 p-3.5 rounded-2xl text-center">
                  <span className="text-[10px] text-gray-500 font-extrabold uppercase block font-mono">categories</span>
                  <span className="text-lg font-black text-indigo-900 mt-1 block">{firestoreCounts.categories.toLocaleString('bn-BD')} টি</span>
                </div>
                <div className="bg-slate-50 border border-indigo-100 p-3.5 rounded-2xl text-center">
                  <span className="text-[10px] text-gray-500 font-extrabold uppercase block font-mono">subcategories</span>
                  <span className="text-lg font-black text-indigo-900 mt-1 block">{firestoreCounts.subcategories.toLocaleString('bn-BD')} টি</span>
                </div>
                <div className="bg-slate-50 border border-indigo-100 p-3.5 rounded-2xl text-center">
                  <span className="text-[10px] text-gray-500 font-extrabold uppercase block font-mono">notices</span>
                  <span className="text-lg font-black text-indigo-900 mt-1 block">{firestoreCounts.notices.toLocaleString('bn-BD')} টি</span>
                </div>
                <div className="bg-slate-50 border border-indigo-100 p-3.5 rounded-2xl text-center">
                  <span className="text-[10px] text-gray-500 font-extrabold uppercase block font-mono">routines</span>
                  <span className="text-lg font-black text-indigo-900 mt-1 block">{firestoreCounts.routines.toLocaleString('bn-BD')} টি</span>
                </div>
                <div className="bg-slate-50 border border-indigo-100 p-3.5 rounded-2xl text-center">
                  <span className="text-[10px] text-gray-500 font-extrabold uppercase block font-mono">live_exams</span>
                  <span className="text-lg font-black text-indigo-900 mt-1 block">{firestoreCounts.live_exams.toLocaleString('bn-BD')} টি</span>
                </div>
                <div className="bg-slate-50 border border-indigo-100 p-3.5 rounded-2xl text-center">
                  <span className="text-[10px] text-gray-500 font-extrabold uppercase block font-mono">upload_history</span>
                  <span className="text-lg font-black text-indigo-900 mt-1 block">{firestoreCounts.upload_history.toLocaleString('bn-BD')} টি</span>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200/80 p-6 rounded-2xl text-center flex flex-col items-center justify-center gap-2">
                <span className="text-xs text-gray-500 font-medium">
                  ফায়ারস্টোর লাইভ ডাটা গণনা দেখতে উপরের "ফায়ারস্টোর রি-ক্যালকুলেট ও যাচাই করুন" বাটনে ক্লিক করুন।
                </span>
              </div>
            )}
          </div>

        </div>
      )}

      {/* Custom Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 p-6 flex flex-col gap-4 animate-scale-up">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-rose-50 rounded-2xl shrink-0">
                <Trash2 className="w-6 h-6 text-rose-600 animate-pulse" />
              </div>
              <div className="flex-1">
                <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">ধাপটি মুছতে চান?</h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                  আপনি কি নিশ্চিতভাবে <span className="font-bold text-slate-800">"{deleteConfirm.name}"</span> {deleteConfirm.type === 'category' ? 'বিষয়ভিত্তিক ক্যাটাগরি' : 'সাব-ক্যাটাগরি'} ডিলিট করতে চান?
                </p>
                <div className="bg-rose-50 border border-rose-100/70 p-3 rounded-xl text-[11px] text-rose-700 font-semibold mt-3 leading-relaxed">
                  ⚠️ সতর্কবার্তা: এর ফলে এই ক্যাটাগরি এবং এর অধীনে থাকা সমস্ত সাব-ক্যাটাগরি স্থায়ীভাবে মুছে যাবে!
                </div>
              </div>
            </div>

            <div className="flex gap-2.5 mt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="flex-grow px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs transition"
              >
                বাতিল করুন
              </button>
              <button
                type="button"
                onClick={() => {
                  const name = deleteConfirm.name;
                  const isCat = deleteConfirm.type === 'category';
                  if (isCat) {
                    onDeleteCategory(deleteConfirm.id);
                  } else {
                    onDeleteSubcategory(deleteConfirm.id);
                  }
                  setDeleteConfirm(null);
                  showCustomAlert('সম্পন্ন হয়েছে!', `"${name}" নামক ${isCat ? 'বিষয়ভিত্তিক ক্যাটাগরি' : 'সাব-ক্যাটাগরি'} সফলভাবে ডিলিট করা হয়েছে!`, 'success');
                }}
                className="flex-grow px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition shadow-md shadow-rose-600/15"
              >
                হ্যাঁ, নিশ্চিত মুছুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Bulk Upload Confirmation Modal */}
      {showUploadConfirm && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-xs">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-indigo-50 p-6 flex flex-col gap-4 animate-scale-up">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-indigo-50 rounded-2xl shrink-0 text-indigo-600">
                <Upload className="w-6 h-6 text-indigo-600 animate-bounce" />
              </div>
              <div className="flex-1 space-y-1">
                <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">📤 কুইজ আপলোড নিশ্চিত করুন</h3>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  আপনি কি নিশ্চিতভাবে এই প্রশ্নগুলো ডেটাবেসে আপলোড করতে চান?
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-2xl space-y-2 text-[11px] text-slate-700">
              <div className="flex justify-between border-b border-dashed pb-1.5">
                <span className="font-semibold text-gray-500">ফাইলের ধরন:</span>
                <span className="font-bold text-slate-900">{pendingCSVFile ? 'CSV ফাইল' : 'সরাসরি টেক্সট পেস্ট'}</span>
              </div>
              {pendingCSVFile && (
                <div className="flex justify-between border-b border-dashed pb-1.5">
                  <span className="font-semibold text-gray-500">ফাইলের নাম:</span>
                  <span className="font-bold text-slate-900 max-w-[180px] truncate" title={pendingCSVFile.name}>{pendingCSVFile.name}</span>
                </div>
              )}
              <div className="flex justify-between border-b border-dashed pb-1.5">
                <span className="font-semibold text-gray-500">মোট প্রশ্ন সংখ্যা:</span>
                <span className="bg-indigo-100 text-indigo-800 font-extrabold px-2 py-0.5 rounded-md text-[10px]">
                  {pendingQuestions.length} টি
                </span>
              </div>
              <div className="flex flex-col gap-1 border-b border-dashed pb-1.5">
                <span className="font-semibold text-gray-500">টার্গেট গন্তব্য:</span>
                <span className="font-bold text-indigo-950 bg-indigo-50/60 p-2 rounded-lg mt-0.5 leading-relaxed">
                  🎯 {uploadDestCat} 
                  {uploadDestSubcatChain.length > 0 && ' ➔ ' + uploadDestSubcatChain.filter(x => x !== 'ALL').join(' ➔ ')}
                </span>
              </div>
              <div className="flex justify-between border-b border-dashed pb-1.5">
                <span className="font-semibold text-gray-500">ক্যাটাগরি ওভাররাইড মোড:</span>
                <span className={`font-bold px-1.5 rounded-md text-[10px] ${overrideCSVCategory ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                  {overrideCSVCategory ? 'সক্রিয় (অন)' : 'নিষ্ক্রিয় (অফ)'}
                </span>
              </div>
              <div className="flex justify-between border-b border-dashed pb-1.5">
                <span className="font-semibold text-gray-500">বিষয়ভিত্তিক অটো-ম্যাপিং:</span>
                <span className={`font-bold px-1.5 rounded-md text-[10px] ${enableSubjectAutoMap ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                  {enableSubjectAutoMap ? 'অন (উভয় স্থানে যুক্ত হবে)' : 'অফ (শুধুমাত্র নির্বাচিত গন্তব্যে)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-gray-500">স্ট্রিক্ট ম্যাপিং ভ্যালিডেশন:</span>
                <span className={`font-bold px-1.5 rounded-md text-[10px] ${enableStrictMappingCheck ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
                  {enableStrictMappingCheck ? 'সক্রিয় (অন)' : 'নিষ্ক্রিয় (অফ)'}
                </span>
              </div>

              {enableStrictMappingCheck && nonMatchingPathDetails.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-xl text-rose-800 font-bold text-[10px] flex items-center gap-1.5 mt-1">
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>⚠️ {nonMatchingPathDetails.length}টি লাইনে অমিল রয়েছে! "আপলোড ও ম্যাপিং রিভিউ" নির্বাচন করে তথ্য নিশ্চিত করুন।</span>
                </div>
              )}
            </div>

            <div className="flex gap-2.5 mt-2">
              <button
                type="button"
                onClick={() => setShowUploadConfirm(false)}
                className="flex-grow px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs transition"
              >
                বাতিল করুন
              </button>
              <button
                type="button"
                onClick={() => {
                  prepareMappingReview();
                  setShowUploadConfirm(false);
                }}
                className="flex-grow px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition shadow-md shadow-indigo-600/15"
              >
                হ্যাঁ, আপলোড ও ম্যাপিং রিভিউ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category & Subcategory Mapping & Mismatch Confirmation Modal */}
      {showMappingReviewModal && (
        <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-[999] animate-fade-in text-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-indigo-100 p-5 sm:p-6 flex flex-col gap-5 my-8 max-h-[90vh] animate-scale-up">
            
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-start gap-3">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl shrink-0">
                  <FolderTree className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base sm:text-lg flex items-center gap-2">
                    📋 ডাইনামিক ক্যাটাগরি ও সাব-ক্যাটাগরি ট্রিম/ম্যাপিং রিভিউ
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    ডাটাবেসে থাকা বিদ্যমান সকল ক্যাটাগরি ও সাব-ক্যাটাগরির সাথে ডাইনামিকলি মিল পাওয়া তথ্য নিশ্চিত করুন বা ম্যানুয়াল রি-ম্যাপ করুন।
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowMappingReviewModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Standard & Dynamic System Categories Banner */}
            <div className="bg-gradient-to-r from-indigo-50/80 via-purple-50/50 to-blue-50/80 border border-indigo-100/80 p-4 rounded-2xl flex flex-col gap-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-extrabold text-indigo-950 text-xs flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                  সিস্টেমে মোট ক্যাটাগরি ও বিষয় সংখ্যা: {allSystemCategories.length}টি
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMismatchMappings(prev => prev.map(m => {
                        const dbSub = findSubcategoryInDatabase(m.rawSubcategory);
                        return {
                          ...m,
                          action: dbSub ? 'map_existing' : 'create',
                          isMismatch: !dbSub
                        };
                      }));
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-3 py-1.5 rounded-xl text-[11px] transition shadow-xs flex items-center gap-1 cursor-pointer"
                  >
                    ⚡ অটো-ম্যাচ প্রয়োগ করুন
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMismatchMappings(prev => prev.map(m => ({ ...m, action: 'create' })));
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-3 py-1.5 rounded-xl text-[11px] transition shadow-xs flex items-center gap-1 cursor-pointer"
                  >
                    ➕ সব নতুন তৈরি করুন
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1 max-h-[70px] overflow-y-auto">
                {allSystemCategories.map(cat => (
                  <span
                    key={cat}
                    className="bg-white/90 text-indigo-900 border border-indigo-100 font-bold px-2.5 py-0.5 rounded-lg text-[10.5px] shadow-xs"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            </div>

            {/* Mismatch & Mapping Table / List */}
            <div className="flex flex-col gap-3 overflow-y-auto max-h-[50vh] pr-1">
              <div className="flex items-center justify-between px-1">
                <span className="font-bold text-slate-700 text-xs">
                  CSV ফাইলের সাব-ক্যাটাগরি তালিকা ({mismatchMappings.length}টি টপিক)
                </span>
                <div className="flex items-center gap-2 text-[10.5px] font-bold">
                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    ✅ ম্যাচড: {mismatchMappings.filter(m => !m.isMismatch).length}টি
                  </span>
                  <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                    ⚠️ নতুন/মিসম্যাচ: {mismatchMappings.filter(m => m.isMismatch).length}টি
                  </span>
                </div>
              </div>

              {mismatchMappings.map((item, idx) => {
                const existingSubcatsUnderTarget = subcategories.filter(s =>
                  s.parentCategory && normalizeName(s.parentCategory) === normalizeName(item.targetCategory)
                );
                const availableSubcats = existingSubcatsUnderTarget.length > 0 ? existingSubcatsUnderTarget : subcategories;

                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-2xl border transition-all flex flex-col gap-3 ${
                      item.isMismatch
                        ? 'bg-amber-50/40 border-amber-200/80 hover:border-amber-300'
                        : 'bg-emerald-50/30 border-emerald-200/80 hover:border-emerald-300'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/50 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-black flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span className="font-extrabold text-slate-900 text-xs">
                          {item.rawSubcategory}
                        </span>
                        <span className="bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-md text-[10px]">
                          {item.questionCount}টি প্রশ্ন
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {!item.isMismatch ? (
                          <span className="bg-emerald-100 text-emerald-800 font-extrabold px-2.5 py-0.5 rounded-md text-[10px] border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> ✅ ম্যাচড (ডাটাবেসে বিদ্যমান)
                          </span>
                        ) : (
                          <span className="bg-amber-100 text-amber-900 font-extrabold px-2.5 py-0.5 rounded-md text-[10px] border border-amber-200 flex items-center gap-1">
                            ⚠️ নতুন / অমিল রয়েছে
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {/* Column 1: Editable Subcategory Name */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-600">
                          ম্যানুয়াল কারেকশন (নাম সংশোধন):
                        </label>
                        <input
                          type="text"
                          value={item.correctedSubcategory}
                          onChange={(e) => {
                            const val = e.target.value;
                            setMismatchMappings(prev => prev.map(m => m.id === item.id ? { ...m, correctedSubcategory: val } : m));
                          }}
                          className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 text-slate-900"
                          placeholder="সাব-ক্যাটাগরি নাম"
                        />
                      </div>

                      {/* Column 2: Target Category */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-600">
                          টার্গেট বিষয়/ক্যাটাগরি:
                        </label>
                        <select
                          value={item.targetCategory}
                          onChange={(e) => {
                            const newTarget = e.target.value;
                            setMismatchMappings(prev => prev.map(m => {
                              if (m.id === item.id) {
                                const newExist = subcategories.filter(s => s.parentCategory && normalizeName(s.parentCategory) === normalizeName(newTarget));
                                return {
                                  ...m,
                                  targetCategory: newTarget,
                                  existingSubcategoryChoice: newExist.length > 0 ? newExist[0].name : m.correctedSubcategory
                                };
                              }
                              return m;
                            }));
                          }}
                          className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold focus:ring-2 focus:ring-indigo-500 text-indigo-950"
                        >
                          {allSystemCategories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>

                      {/* Column 3: Action Choice */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-600">
                          অ্যাকশন / ম্যাপিং সিদ্ধান্ত:
                        </label>
                        <div className="flex items-center gap-2 mt-0.5">
                          <label className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-bold cursor-pointer transition ${
                            item.action === 'create' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                          }`}>
                            <input
                              type="radio"
                              name={`action-${item.id}`}
                              checked={item.action === 'create'}
                              onChange={() => setMismatchMappings(prev => prev.map(m => m.id === item.id ? { ...m, action: 'create' } : m))}
                              className="sr-only"
                            />
                            ➕ নতুন তৈরি
                          </label>

                          <label className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-bold cursor-pointer transition ${
                            item.action === 'map_existing' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                          }`}>
                            <input
                              type="radio"
                              name={`action-${item.id}`}
                              checked={item.action === 'map_existing'}
                              onChange={() => setMismatchMappings(prev => prev.map(m => m.id === item.id ? { ...m, action: 'map_existing' } : m))}
                              className="sr-only"
                            />
                            🔗 বিদ্যমান ম্যাপ
                          </label>
                        </div>

                        {item.action === 'map_existing' && (
                          <select
                            value={item.existingSubcategoryChoice}
                            onChange={(e) => {
                              const choice = e.target.value;
                              setMismatchMappings(prev => prev.map(m => m.id === item.id ? { ...m, existingSubcategoryChoice: choice } : m));
                            }}
                            className="bg-white border border-slate-300 rounded-xl px-2.5 py-1 text-[11px] font-semibold text-slate-800 mt-1"
                          >
                            {availableSubcats.length > 0 ? (
                              availableSubcats.map(s => (
                                <option key={s.id} value={s.name}>{s.name}</option>
                              ))
                            ) : (
                              <option value={item.correctedSubcategory}>কোনো বিদ্যমান পাওয়া যায়নি ({item.correctedSubcategory})</option>
                            )}
                          </select>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer buttons */}
            <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowMappingReviewModal(false)}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs transition"
              >
                বাতিল করুন
              </button>
              <button
                type="button"
                onClick={handleFinalizeUploadWithMappings}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs transition shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                ক্যাটাগরি কনফার্ম ও ফাইল আপলোড সম্পন্ন করুন
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Universal Custom Alert / Confirmation Modal (No iframe blocks!) */}
      {customModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] flex-col animate-fade-in text-xs">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 p-6 flex flex-col gap-4 animate-scale-up">
            <div className="flex items-start gap-3">
              <div className={`p-3 rounded-2xl shrink-0 ${
                customModal.type === 'success' ? 'bg-emerald-50 text-emerald-600' :
                customModal.type === 'warning' ? 'bg-rose-50 text-rose-600' :
                customModal.type === 'error' ? 'bg-rose-100 text-rose-700' :
                'bg-indigo-50 text-indigo-600'
              }`}>
                {customModal.type === 'success' && <CheckCircle2 className="w-6 h-6" />}
                {customModal.type === 'warning' && <AlertCircle className="w-6 h-6" />}
                {customModal.type === 'error' && <AlertCircle className="w-6 h-6" />}
                {customModal.type === 'info' && <BookOpen className="w-6 h-6" />}
              </div>
              <div className="flex-grow">
                <h3 className="font-extrabold text-slate-900 text-sm sm:text-base leading-snug">{customModal.title}</h3>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed whitespace-pre-line font-medium">
                  {customModal.message}
                </p>
              </div>
            </div>

            <div className="flex gap-2.5 mt-2">
              {customModal.showConfirmButton && (
                <button
                  type="button"
                  onClick={() => {
                    if (customModal.onCancel) customModal.onCancel();
                    else setCustomModal(prev => ({ ...prev, isOpen: false }));
                  }}
                  className="flex-1 px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs transition"
                >
                  {customModal.cancelText || 'বাতিল করুন'}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (typeof customModal.onConfirm === 'function') {
                    customModal.onConfirm();
                  } else {
                    setCustomModal(prev => ({ ...prev, isOpen: false }));
                  }
                }}
                className={`px-4 py-2 text-white font-bold rounded-xl text-xs transition shadow-md flex-1 text-center ${
                  customModal.type === 'success' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/15' :
                  customModal.type === 'warning' ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/15' :
                  customModal.type === 'error' ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/15' :
                  'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/15'
                }`}
              >
                {customModal.confirmText || 'ঠিক আছে'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Editing user explanation modal */}
      {editingExpl && (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const q = questions.find(q => q.id === editingExpl.qId);
              if (q && q.userExplanations) {
                const updated = (q.userExplanations || []).map(ex => {
                  if (ex.id === editingExpl.explId) {
                    return { ...ex, text: editingExpl.text };
                  }
                  return ex;
                });
                onUpdateQuestion(q.id, { userExplanations: updated });
                showCustomAlert('সম্পন্ন', 'ব্যাখ্যাটি সফলভাবে সংশোধন করা হয়েছে!', 'success');
                setEditingExpl(null);
              }
            }}
            className="bg-white rounded-3xl w-full max-w-lg p-6 relative flex flex-col gap-4 text-xs animate-scale-up shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setEditingExpl(null)}
              className="absolute top-4 right-4 p-2 bg-gray-50 hover:bg-gray-100 text-gray-500 rounded-full"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="font-extrabold text-sm text-indigo-700">✏️ ব্যবহারকারীর ব্যাখ্যা সম্পাদনা করুন</h3>
            <textarea
              required
              rows={5}
              value={editingExpl.text}
              onChange={(e) => setEditingExpl(prev => prev ? { ...prev, text: e.target.value } : null)}
              className="w-full p-3 border rounded-2xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditingExpl(null)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-2xl font-bold"
              >
                বাতিল
              </button>
              <button
                type="submit"
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-2xl font-extrabold shadow-md shadow-indigo-100"
              >
                সংরক্ষণ করুন
              </button>
            </div>
          </form>
        </div>
      )}

      {/* AUDIT LOG SECTION */}
      {activeTab === 'audit-logs' && (
        <div className="flex flex-col gap-4 animate-fade-in">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-purple-950 to-indigo-900 rounded-2xl p-5 text-white shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-purple-500/30 text-purple-200 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-purple-400/30 uppercase tracking-wider">
                  অডিট অ্যান্ড ট্রান্সপারেন্সি সিস্টেম
                </span>
                <span className="text-xs text-purple-200 font-medium">হিস্টোরি ট্র্যাকিং</span>
              </div>
              <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
                📜 এডমিন অডিট লগ (Audit Log)
              </h2>
              <p className="text-xs text-purple-200/90 mt-1 max-w-2xl">
                প্রশ্ন ডিলিট, বাল্ক আপডেট, ক্যাটাগরি মডিফিকেশন, পরীক্ষা ও সিস্টেম অ্যাকশনসহ সমস্ত প্রশাসনিক পরিবর্তনের সময়ভিত্তিক রেকর্ড।
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <button
                type="button"
                onClick={() => setShowAddLogModal(true)}
                className="bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>ম্যানুয়াল নোট যোগ করুন</span>
              </button>
              {onClearAuditLogs && (
                <button
                  type="button"
                  onClick={() => {
                    showCustomConfirm(
                      'অডিট লগ ক্লিয়ার কনফার্মেশন',
                      'আপনি কি নিশ্চিতভাবে সমস্ত অডিট লগ মুছে ফেলতে চান? এটি পুনরায় ফিরিয়ে আনা সম্ভব নয়।',
                      () => {
                        onClearAuditLogs();
                        showCustomAlert('সফল!', 'সমস্ত অডিট লগ রেকর্ড মুছে ফেলা হয়েছে।', 'success');
                      },
                      'warning'
                    );
                  }}
                  className="bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-200 font-bold text-xs px-3 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>লগ হিস্টোরি মুছুন</span>
                </button>
              )}
            </div>
          </div>

          {/* Search and Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-2xs flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 text-xs">
            {/* Search Input */}
            <div className="relative flex-1">
              <input
                type="text"
                value={auditSearch}
                onChange={e => setAuditSearch(e.target.value)}
                placeholder="লগ অ্যাকশন, ডিটেইলস, আইডি বা এডমিন দিয়ে খুঁজুন..."
                className="w-full pl-9 pr-3.5 py-2.5 border rounded-xl bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white font-medium"
              />
              <span className="absolute left-3 top-3 text-slate-400">🔍</span>
              {auditSearch && (
                <button
                  type="button"
                  onClick={() => setAuditSearch('')}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Type Filter Buttons */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 shrink-0">
              <span className="font-bold text-slate-500 text-[11px] mr-1">ফিল্টার:</span>
              {[
                { id: 'all', label: 'সবকিছু' },
                { id: 'delete', label: 'ডিলিট' },
                { id: 'bulk', label: 'বাল্ক আপডেট' },
                { id: 'category', label: 'ক্যাটাগরি' },
                { id: 'update', label: 'আপডেট' },
                { id: 'create', label: 'তৈরি' },
                { id: 'exam', label: 'পরীক্ষা' },
                { id: 'routine', label: 'রুটিন' },
                { id: 'other', label: 'অন্যান্য' }
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setAuditTypeFilter(f.id as any)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition text-[11px] shrink-0 cursor-pointer ${
                    auditTypeFilter === f.id
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Audit Logs List View */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xs overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex justify-between items-center text-xs font-bold text-slate-700">
              <div className="flex items-center gap-2">
                <span className="text-base">📜</span>
                <span>রেকর্ডকৃত অ্যাকশনসমূহ ({filteredAuditLogs.length} টি)</span>
              </div>
              <span className="text-[10px] text-slate-400 font-normal">সর্বশেষ ক্রমানুসারে সাজানো</span>
            </div>

            {filteredAuditLogs.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                <span className="text-3xl">📭</span>
                <p className="font-extrabold text-slate-600">কোনো অডিট লগ পাওয়া যায়নি</p>
                <p className="text-[11px] text-slate-400">ফিল্টার পরিবর্তন করে দেখুন বা নতুন কাজ সম্পাদনা করুন।</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                {filteredAuditLogs.map(log => {
                  let badgeBg = 'bg-slate-100 text-slate-700 border-slate-200';
                  let icon = '📌';
                  if (log.type === 'delete') {
                    badgeBg = 'bg-rose-50 text-rose-700 border-rose-200';
                    icon = '🗑️';
                  } else if (log.type === 'bulk') {
                    badgeBg = 'bg-amber-50 text-amber-800 border-amber-200';
                    icon = '📦';
                  } else if (log.type === 'category') {
                    badgeBg = 'bg-purple-50 text-purple-800 border-purple-200';
                    icon = '🗂️';
                  } else if (log.type === 'update') {
                    badgeBg = 'bg-blue-50 text-blue-800 border-blue-200';
                    icon = '✏️';
                  } else if (log.type === 'create') {
                    badgeBg = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                    icon = '✨';
                  } else if (log.type === 'exam') {
                    badgeBg = 'bg-indigo-50 text-indigo-800 border-indigo-200';
                    icon = '⏱️';
                  } else if (log.type === 'routine') {
                    badgeBg = 'bg-teal-50 text-teal-800 border-teal-200';
                    icon = '📅';
                  }

                  return (
                    <div key={log.id} className="p-3.5 hover:bg-slate-50/70 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div className="flex items-start gap-3 flex-1">
                        <span className={`p-2 rounded-xl border text-sm shrink-0 ${badgeBg}`}>
                          {icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-black text-slate-900 text-xs">
                              {log.action}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[9.5px] font-extrabold border ${badgeBg}`}>
                              {log.type ? log.type.toUpperCase() : 'ACTION'}
                            </span>
                          </div>
                          <p className="text-slate-700 font-medium text-[11.5px] break-words leading-relaxed">
                            {log.details}
                          </p>
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100 shrink-0 text-[10.5px]">
                        <span className="font-extrabold text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                          👤 {log.admin || 'এডমিন'}
                        </span>
                        <span className="text-slate-400 font-semibold mt-0.5">
                          🕒 {formatBengaliDateTime(log.timestamp)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
        </>
      )}

      {/* MANUAL ADD AUDIT LOG MODAL */}
      {showAddLogModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <form
            onSubmit={e => {
              e.preventDefault();
              if (!manualActionInput.trim() || !manualDetailsInput.trim()) {
                alert('অনুগ্রহ করে শিরোনাম ও বিস্তারিত তথ্য প্রদান করুন।');
                return;
              }
              if (onAddAuditLog) {
                onAddAuditLog(manualActionInput.trim(), manualDetailsInput.trim(), manualTypeInput);
              }
              setManualActionInput('');
              setManualDetailsInput('');
              setManualTypeInput('other');
              setShowAddLogModal(false);
              showCustomAlert('সফল!', 'নতুন ম্যানুয়াল অডিট নোট রেকর্ড করা হয়েছে।', 'success');
            }}
            className="bg-white rounded-3xl w-full max-w-md p-6 relative flex flex-col gap-4 text-xs animate-scale-up shadow-2xl border border-purple-100"
          >
            <button
              type="button"
              onClick={() => setShowAddLogModal(false)}
              className="absolute top-4 right-4 p-2 bg-gray-50 hover:bg-gray-100 text-gray-500 rounded-full transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 border-b pb-3">
              <span className="p-2.5 bg-purple-50 text-purple-600 rounded-2xl border border-purple-100">
                📜
              </span>
              <div>
                <h3 className="font-extrabold text-sm text-gray-900">ম্যানুয়াল অডিট লগ যোগ করুন</h3>
                <p className="text-[11px] text-gray-500 font-medium">বিশেষ সিস্টেম নোট বা অফলাইন সিদ্ধান্তের রেকর্ড</p>
              </div>
            </div>

            <div>
              <label className="block text-gray-700 font-bold mb-1">অ্যাকশন টাইপ (Type):</label>
              <select
                value={manualTypeInput}
                onChange={e => setManualTypeInput(e.target.value as any)}
                className="w-full px-3.5 py-2 border rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
              >
                <option value="other">অন্যান্য (Other)</option>
                <option value="delete">ডিলিট (Delete)</option>
                <option value="update">আপডেট (Update)</option>
                <option value="bulk">বাল্ক আপডেট (Bulk Update)</option>
                <option value="category">ক্যাটাগরি (Category)</option>
                <option value="exam">পরীক্ষা (Exam)</option>
                <option value="routine">রুটিন (Routine)</option>
                <option value="create">তৈরি (Create)</option>
                <option value="user">ইউজার সম্পর্কিত (User)</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-700 font-bold mb-1">অ্যাকশনের নাম (Action Title):</label>
              <input
                type="text"
                required
                value={manualActionInput}
                onChange={e => setManualActionInput(e.target.value)}
                placeholder="যেমন: সার্ভার ক্লাউড ব্যাকআপ সিঙ্ক"
                className="w-full px-3.5 py-2.5 border rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-bold mb-1">বিস্তারিত বিবরণ (Details):</label>
              <textarea
                required
                rows={3}
                value={manualDetailsInput}
                onChange={e => setManualDetailsInput(e.target.value)}
                placeholder="যে পরিবর্তন বা কাজ করা হয়েছে তার বিস্তারিত লিখুন..."
                className="w-full px-3.5 py-2.5 border rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddLogModal(false)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-2xl font-bold transition"
              >
                বাতিল
              </button>
              <button
                type="submit"
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2.5 rounded-2xl font-extrabold shadow-md shadow-purple-100 transition"
              >
                সংরক্ষণ করুন
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ADMIN CHANGE PASSWORD MODAL */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleChangeAdminPassword}
            className="bg-white rounded-3xl w-full max-w-md p-6 relative flex flex-col gap-4 text-xs animate-scale-up shadow-2xl border border-amber-100"
          >
            <button
              type="button"
              onClick={() => {
                setIsPasswordModalOpen(false);
                setCurrPassInput('');
                setNewAdminPassInput('');
                setConfirmAdminPassInput('');
              }}
              className="absolute top-4 right-4 p-2 bg-gray-50 hover:bg-gray-100 text-gray-500 rounded-full transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 border-b pb-3">
              <span className="p-2.5 bg-amber-50 text-amber-600 rounded-2xl border border-amber-100">
                🔑
              </span>
              <div>
                <h3 className="font-extrabold text-sm text-gray-900">এডমিন পাসওয়ার্ড পরিবর্তন</h3>
                <p className="text-[11px] text-gray-500 font-medium">নিরাপত্তার স্বার্থে আপনার নতুন গোপন পাসওয়ার্ড সেট করুন</p>
              </div>
            </div>

            <div>
              <label className="block text-gray-700 font-bold mb-1">বর্তমান এডমিন পাসওয়ার্ড:</label>
              <input
                type="password"
                required
                value={currPassInput}
                onChange={e => setCurrPassInput(e.target.value)}
                placeholder="বর্তমান পাসওয়ার্ড দিন"
                className="w-full px-3.5 py-2.5 border rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-bold mb-1">নতুন পাসওয়ার্ড (নূন্যতম ৬ ডিজিট):</label>
              <input
                type="password"
                required
                value={newAdminPassInput}
                onChange={e => setNewAdminPassInput(e.target.value)}
                placeholder="নতুন পাসওয়ার্ড দিন"
                className="w-full px-3.5 py-2.5 border rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-gray-700 font-bold mb-1">নতুন পাসওয়ার্ড পুনরায় দিন (Confirm):</label>
              <input
                type="password"
                required
                value={confirmAdminPassInput}
                onChange={e => setConfirmAdminPassInput(e.target.value)}
                placeholder="পুনরায় পাসওয়ার্ড দিন"
                className="w-full px-3.5 py-2.5 border rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
              />
            </div>

            <div className="pt-2 border-t border-gray-100 mt-1">
              <label className="block text-gray-800 font-extrabold mb-1 flex items-center gap-1.5 text-xs">
                <span>⏱️</span>
                <span>ইনঅ্যাক্টিভিটি সেশন টাইমআউট (Inactivity Timeout):</span>
              </label>
              <select
                value={sessionTimeoutMinutes}
                onChange={e => {
                  const mins = parseInt(e.target.value, 10);
                  if (onUpdateSessionTimeout) {
                    onUpdateSessionTimeout(mins);
                  }
                }}
                className="w-full px-3.5 py-2.5 border rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold text-xs bg-slate-50"
              >
                <option value={5}>৫ মিনিট নিষ্ক্রিয়তা</option>
                <option value={15}>১৫ মিনিট নিষ্ক্রিয়তা (ডিফল্ট)</option>
                <option value={30}>৩০ মিনিট নিষ্ক্রিয়তা</option>
                <option value={60}>৬০ মিনিট (১ ঘণ্টা) নিষ্ক্রিয়তা</option>
              </select>
              <p className="text-[10px] text-gray-500 font-medium mt-1 leading-snug">
                ব্যবহারকারী বা এডমিন নির্দিষ্ট সময় কোনো মাউস বা টাচ ক্লিক না করলে সেশন স্বয়ংক্রিয়ভাবে সিকিউরড লগআউট হবে।
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsPasswordModalOpen(false);
                  setCurrPassInput('');
                  setNewAdminPassInput('');
                  setConfirmAdminPassInput('');
                }}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-2xl font-bold transition"
              >
                বাতিল
              </button>
              <button
                type="submit"
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-2.5 rounded-2xl font-extrabold shadow-md shadow-amber-100 transition"
              >
                পাসওয়ার্ড আপডেট করুন
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CLOUD SYNC DETAILS MODAL */}
      {showSyncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-slate-900 border border-indigo-500/30 text-white rounded-3xl p-5 sm:p-6 w-full max-w-2xl shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-indigo-800/40 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-indigo-600/30 rounded-2xl text-indigo-300 border border-indigo-500/30">
                  <Cloud className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                    <span>ক্লাউড সিঙ্ক বিশদ বিবরণ (Cloud Sync Status)</span>
                  </h3>
                  <p className="text-xs text-indigo-200">
                    এডমিন দ্বারা তৈরি ও আপডেট করা তথ্যের ক্লাউড স্টোরেজ লাইভ সামঞ্জস্য
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSyncModal(false)}
                className="p-1.5 bg-indigo-900/60 hover:bg-indigo-800 text-indigo-200 hover:text-white rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Overall Percentage Card */}
            <div className="bg-gradient-to-r from-indigo-950 to-slate-950 p-4 rounded-2xl border border-indigo-800/40 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
                <span className="text-[11px] text-indigo-300 font-bold uppercase tracking-wider">সার্বিক সিঙ্ক শতাংশ</span>
                <span className={`text-3xl sm:text-4xl font-black font-mono mt-0.5 ${
                  adminSyncStats.overallPercent === 100 ? 'text-emerald-400' : 'text-amber-400'
                }`}>
                  {adminSyncStats.overallPercent.toLocaleString('bn-BD')}%
                </span>
                <span className="text-[11px] text-indigo-200/80 mt-1">
                  মোট অ্যাডমিন ডেটা: {adminSyncStats.totalLocal.toLocaleString('bn-BD')} টি | ক্লাউডে: {adminSyncStats.totalSynced.toLocaleString('bn-BD')} টি
                </span>
              </div>

              <div className="flex flex-col gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleSyncAllAdminData}
                  disabled={isSyncingAllAdminData}
                  className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>{isSyncingAllAdminData ? 'সিঙ্ক হচ্ছে...' : '⚡ ক্লাউডে সকল ডেটা সিঙ্ক করুন'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleRefreshFirestoreCounts}
                  disabled={isCountingFirestore}
                  className="px-4 py-2 bg-indigo-900/60 hover:bg-indigo-800 border border-indigo-700/50 text-indigo-200 hover:text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCountingFirestore ? 'animate-spin' : ''}`} />
                  <span>কাউন্ট রিফ্রেশ করুন</span>
                </button>
              </div>
            </div>

            {/* Sync Progress Bar if Active */}
            {syncProgress && (
              <div className="bg-indigo-950 p-3 rounded-xl border border-indigo-700/50 flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-indigo-200">{syncProgress.currentCollection}</span>
                  <span className="text-emerald-400 font-mono">{syncProgress.percent}%</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-emerald-400 h-full rounded-full transition-all duration-300"
                    style={{ width: `${syncProgress.percent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Collection breakdown list */}
            <div className="space-y-2 text-xs">
              <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider block px-1">
                কালেকশনভিত্তিক বিবরণ ({adminSyncStats.items.length}টি কালেকশন):
              </span>

              {adminSyncStats.items.map(item => {
                const isSingleSyncing = syncingSingleKey === item.key;
                return (
                  <div
                    key={item.key}
                    className="bg-indigo-950/40 border border-indigo-800/40 hover:border-indigo-700/60 p-3 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 transition"
                  >
                    <div className="flex items-center gap-2.5 min-w-[140px]">
                      <span className="text-xl">{item.icon}</span>
                      <div>
                        <h4 className="font-extrabold text-white text-xs">{item.name}</h4>
                        <span className="text-[10px] text-indigo-300/70 font-mono uppercase">{item.key}</span>
                      </div>
                    </div>

                    <div className="flex-1 w-full sm:w-auto px-1 sm:px-3">
                      <div className="flex justify-between items-center text-[11px] mb-1 font-medium">
                        <span className="text-indigo-200">
                          লোকাল: <strong className="text-white font-mono">{item.local.toLocaleString('bn-BD')}</strong> | ক্লাউড: <strong className="text-emerald-400 font-mono">{item.cloud.toLocaleString('bn-BD')}</strong>
                        </span>
                        <span className={`font-bold font-mono ${item.isFullySynced ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {item.percent.toLocaleString('bn-BD')}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-indigo-900/50">
                        <div 
                          className={`h-full rounded-full transition-all duration-300 ${
                            item.isFullySynced ? 'bg-emerald-400' : 'bg-amber-400'
                          }`}
                          style={{ width: `${item.percent}%` }}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSyncSingleAdminCollection(item.key)}
                      disabled={isSingleSyncing || isSyncingAllAdminData}
                      className="w-full sm:w-auto px-3 py-1.5 bg-indigo-900/60 hover:bg-indigo-800 border border-indigo-700/50 text-indigo-200 hover:text-white rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1 shrink-0 cursor-pointer disabled:opacity-50"
                      title={`শুধুমাত্র ${item.name} সিঙ্ক করুন`}
                    >
                      <RefreshCw className={`w-3 h-3 ${isSingleSyncing ? 'animate-spin' : ''}`} />
                      <span>{isSingleSyncing ? 'সিঙ্ক হচ্ছে...' : 'সিঙ্ক'}</span>
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="border-t border-indigo-800/40 pt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setShowSyncModal(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
