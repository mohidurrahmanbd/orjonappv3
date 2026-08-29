import React, { useState, useMemo, useEffect } from 'react';
import { Question, LiveExam, Notice, Routine, ScheduledExamConfig, User, Attempt, CategoryItem, SubcategoryItem, AuditLog, Course, Coupon, CourseEnrollment, PaymentSettings, DEFAULT_PAYMENT_SETTINGS, formatBengaliDate, formatBengaliDateTime } from '../shared/types';
import { 
  Plus, Trash2, Edit, Upload, BookOpen, Users, 
  Settings, AlertCircle, Calendar, Award, X, RefreshCw, FolderTree,
  History, FileText, CheckCircle2, Sparkles, Menu, ChevronDown, ChevronRight, ShieldAlert, AlertTriangle,
  Download, Database, FileJson, RotateCcw, HardDrive, GraduationCap,
  Cloud, UploadCloud, ShieldCheck, Tag, Percent, DollarSign, Copy, Check, Eye,
  Wallet, Search, Filter, Phone, Mail, UserCheck, CreditCard, Printer, FileSpreadsheet, ExternalLink, ArrowUpDown
} from 'lucide-react';
import { motion } from 'motion/react';
import * as ReactWindow from 'react-window';
import { firebaseConfig } from '../shared/lib/firebase';
import { 
  CollectionCounts, 
  MigrationReport, 
  fetchFirestoreDocumentCounts, 
  migrateDataToFirestore,
  syncCollectionToFirestore,
  getAllLocalStorageMap 
} from '../shared/lib/migration';

import UserGrowthChart from './UserGrowthChart';
import { downloadCourseRoutinePDF } from '../shared/lib/pdfGenerator';
import RoutineHierarchicalMCQModal from '../shared/components/RoutineHierarchicalMCQModal';
import { formatRoutineSyllabusPaths, getRoutineMatchingQuestions } from '../shared/lib/routineUtils';
import CurrentAffairsAdmin from './CurrentAffairsAdmin';

const List = (ReactWindow as any).FixedSizeList || (ReactWindow as any).default?.FixedSizeList || (ReactWindow as any).default || ReactWindow;

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
  onAddSubcategory: (name: string, parentCategory: string, date?: string, subHeading?: string, text?: string) => void;
  onDeleteCategory: (id: string) => Promise<boolean> | void;
  onDeleteSubcategory: (id: string) => Promise<boolean> | void;
  onBulkDeleteSubcategories?: (ids: string[]) => Promise<boolean> | void;
  onBulkMoveSubcategories?: (ids: string[], newParentCategory: string) => void;
  onUpdateCategory?: (id: string, newName: string, subHeading?: string) => void;
  onUpdateSubcategory?: (id: string, newName: string, newParent: string, date?: string, subHeading?: string, text?: string) => void;
  onAddQuestion: (q: Omit<Question, 'id'>) => void;
  onUpdateQuestion: (id: string, q: Partial<Question>) => void;
  onDeleteQuestion: (id: string) => Promise<boolean> | void;
  onBulkDeleteQuestions: (ids: string[]) => Promise<boolean> | void;
  onBulkMoveQuestions: (ids: string[], targetCategory: string, targetSubcategory?: string, mode?: 'move' | 'link') => void;
  onBulkUploadQuestions: (questionsList: Omit<Question, 'id'>[]) => void;
  onSaveNotice: (text: string) => void;
  onCreateLiveExam: (exam: Omit<LiveExam, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateLiveExam?: (id: string, updatedExam: Partial<LiveExam>) => void;
  onDeleteLiveExam: (id: string) => Promise<boolean> | void;
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
  onUpdateRoutine?: (id: string, updatedRoutine: Partial<Routine>) => void;
  onDeleteRoutine: (id: string) => Promise<boolean> | void;
  onSaveCourse?: (course: Omit<Course, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateCourse?: (id: string, updatedCourse: Partial<Course>) => void;
  onDeleteCourse?: (id: string) => Promise<boolean> | void;
  coupons?: Coupon[];
  courseEnrollments?: CourseEnrollment[];
  paymentSettings?: PaymentSettings;
  onSaveCoupon?: (coupon: Omit<Coupon, 'id' | 'createdAt'>) => void;
  onUpdateCoupon?: (id: string, updatedCoupon: Partial<Coupon>) => void;
  onDeleteCoupon?: (id: string) => Promise<boolean> | void;
  onUpdatePaymentSettings?: (settings: Partial<PaymentSettings>) => void;
  onDeleteEnrollment?: (id: string) => Promise<boolean> | void;
  onLogout: () => void;
  allowUserExplanation: boolean;
  onToggleUserExplanation: (allowed: boolean) => void;
  showMcqCount?: boolean;
  onToggleMcqCount?: (show: boolean) => void;
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

// Helper to detect variations/typos of "‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶® ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ"
const isJobSolutionVariation = (name: string): boolean => {
  if (!name) return false;
  const normalized = name.trim().toLowerCase();
  return (
    normalized === '‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶® ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ' ||
    normalized === '‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶â‡¶∂‡¶® ‡¶™‡¶∞‡¶ø‡¶ï‡ßç‡¶∑‡¶æ' ||
    normalized === '‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶â‡¶∂‡¶® ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ' ||
    normalized === '‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶® ‡¶¨‡ßç‡¶Ø‡¶æ‡¶Ç‡¶ï' ||
    normalized === '‡¶ú‡¶¨ ‡¶∏„É™„É•„Éº„Ç∑„Éß„É≥ ‡¶¨‡ßç‡¶Ø‡¶æ‡¶Ç‡¶ï' ||
    normalized === 'job solution' ||
    normalized === 'job solutions' ||
    normalized === '‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶®' ||
    normalized === '‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶â‡¶∂‡¶®' ||
    normalized === '‡¶ú‡¶¨ ‡¶∏„É™„É•„Éº„Ç∑„Éß„É≥'
  );
};

// Standard 9 Subject Categories under "‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø"
export const STANDARD_SUBJECT_CATEGORIES = [
  '‡¶¨‡¶æ‡¶Ç‡¶≤‡¶æ ‡¶¨‡ßç‡¶Ø‡¶æ‡¶ï‡¶∞‡¶£',
  '‡¶¨‡¶æ‡¶Ç‡¶≤‡¶æ ‡¶∏‡¶æ‡¶π‡¶ø‡¶§‡ßç‡¶Ø',
  '‡¶á‡¶Ç‡¶∞‡ßá‡¶ú‡¶ø ‡¶ó‡ßç‡¶∞‡¶æ‡¶Æ‡¶æ‡¶∞',
  '‡¶á‡¶Ç‡¶∞‡ßá‡¶ú‡¶ø ‡¶∏‡¶æ‡¶π‡¶ø‡¶§‡ßç‡¶Ø',
  '‡¶ó‡¶£‡¶ø‡¶§',
  '‡¶¨‡¶æ‡¶Ç‡¶≤‡¶æ‡¶¶‡ßá‡¶∂ ‡¶¨‡¶ø‡¶∑‡ßü‡¶æ‡¶¨‡¶≤‡ßÄ',
  '‡¶Ü‡¶®‡ßç‡¶§‡¶∞‡ßç‡¶ú‡¶æ‡¶§‡¶ø‡¶ï ‡¶¨‡¶ø‡¶∑‡ßü‡¶æ‡¶¨‡¶≤‡ßÄ',
  '‡¶∏‡¶æ‡¶ß‡¶æ‡¶∞‡¶£ ‡¶¨‡¶ø‡¶ú‡ßç‡¶û‡¶æ‡¶®',
  '‡¶§‡¶•‡ßç‡¶Ø ‡¶ì ‡¶Ø‡ßã‡¶ó‡¶æ‡¶Ø‡ßã‡¶ó ‡¶™‡ßç‡¶∞‡¶Ø‡ßÅ‡¶ï‡ßç‡¶§‡¶ø'
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

// Helper to detect variations/typos of "‡¶∏‡¶æ‡¶≤ ‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶®"
const isYearJobSolutionVariation = (name: string): boolean => {
  if (!name) return false;
  const normalized = name.trim().toLowerCase();
  return (
    normalized === '‡¶∏‡¶æ‡¶≤ ‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶®' ||
    normalized === '‡¶∏‡¶æ‡¶≤ ‡¶≠‡¶ø‡¶ï‡ßç‡¶§‡¶ø‡¶ï ‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶â‡¶∂‡¶®' ||
    normalized === '‡¶∏‡¶æ‡¶≤ ‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶ú‡¶¨ ‡¶∏‡¶≤‡ßç‡¶Ø‡ßÅ‡¶∂‡¶®' ||
    normalized === '‡¶∏‡¶æ‡¶≤ ‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶® ‡¶¨‡ßç‡¶Ø‡¶æ‡¶Ç‡¶ï' ||
    normalized === '‡¶∏‡¶æ‡¶≤ ‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶® ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ' ||
    normalized === 'year-based job solution' ||
    normalized === 'year job solution' ||
    normalized === '‡¶∏‡¶æ‡¶≤ ‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï' ||
    normalized === '‡¶∏‡¶æ‡¶≤ ‡¶≠‡¶ø‡¶ï‡ßç‡¶§‡¶ø‡¶ï'
  );
};

// Helper to detect variations/typos of "‡¶∏‡¶æ‡¶Æ‡ßç‡¶™‡ßç‡¶∞‡¶§‡¶ø‡¶ï ‡¶¨‡¶ø‡¶∑‡ßü‡¶æ‡¶¨‡¶≤‡ßÄ"
const isCurrentAffairVariation = (name: string): boolean => {
  if (!name) return false;
  const normalized = name.trim().toLowerCase();
  return (
    normalized === '‡¶∏‡¶æ‡¶Æ‡ßç‡¶™‡ßç‡¶∞‡¶§‡¶ø‡¶ï ‡¶¨‡¶ø‡¶∑‡ßü‡¶æ‡¶¨‡¶≤‡ßÄ' ||
    normalized === '‡¶∏‡¶æ‡¶Æ‡ßç‡¶™‡ßç‡¶∞‡¶§‡¶ø‡¶ï ‡¶¨‡¶ø‡¶∑‡¶Ø‡¶º‡¶æ‡¶¨‡¶≤‡ßÄ' ||
    normalized === '‡¶∏‡¶æ‡¶Æ‡ßç‡¶™‡ßç‡¶∞‡¶§‡¶ø‡¶ï ‡¶§‡¶•‡ßç‡¶Ø' ||
    normalized === '‡¶ï‡¶æ‡¶∞‡ßá‡¶®‡ßç‡¶ü ‡¶Ö‡ßç‡¶Ø‡¶æ‡¶´‡ßá‡¶Ø‡¶º‡¶æ‡¶∞‡ßç‡¶∏' ||
    normalized === '‡¶ï‡¶æ‡¶∞‡ßá‡¶®‡ßç‡¶ü ‡¶Ö‡ßç‡¶Ø‡¶æ‡¶´‡ßá‡ßü‡¶æ‡¶∞‡ßç‡¶∏' ||
    normalized === 'current affairs' ||
    normalized === 'current affair' ||
    normalized === '‡¶∏‡¶æ‡¶Æ‡ßç‡¶™‡ßç‡¶∞‡¶§‡¶ø‡¶ï ‡¶¨‡¶ø‡¶∑‡ßü' ||
    normalized === '‡¶∏‡¶æ‡¶Æ‡ßç‡¶™‡ßç‡¶∞‡¶§‡¶ø‡¶ï ‡¶¨‡¶ø‡¶∑‡¶Ø‡¶º' ||
    normalized === '‡¶∏‡¶æ‡¶Æ‡ßç‡¶™‡ßç‡¶∞‡¶§‡¶ø‡¶ï'
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
  onUpdateLiveExam,
  onDeleteLiveExam,
  onSaveRoutine,
  onUpdateRoutine,
  onDeleteRoutine,
  onSaveCourse,
  onUpdateCourse,
  onDeleteCourse,
  coupons = [],
  courseEnrollments = [],
  paymentSettings = DEFAULT_PAYMENT_SETTINGS,
  onSaveCoupon,
  onUpdateCoupon,
  onDeleteCoupon,
  onUpdatePaymentSettings,
  onDeleteEnrollment,
  onLogout,
  allowUserExplanation,
  onToggleUserExplanation,
  showMcqCount = true,
  onToggleMcqCount,
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'add' | 'manage' | 'categories' | 'current-affairs' | 'exams' | 'courses' | 'routines' | 'results' | 'users' | 'feedback' | 'backup' | 'firestore-migration' | 'audit-logs'>('dashboard');
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Course & Pricing Form States
  const [courseSubTab, setCourseSubTab] = useState<'courses' | 'coupons' | 'enrollments' | 'payment-settings'>('courses');
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [courseTitle, setCourseTitle] = useState('');
  const [courseDesc, setCourseDesc] = useState('');
  const [courseCategory, setCourseCategory] = useState('');
  const [courseStatus, setCourseStatus] = useState<'active' | 'upcoming' | 'completed'>('active');
  const [coursePrice, setCoursePrice] = useState<string>('500');
  const [courseOriginalPrice, setCourseOriginalPrice] = useState<string>('1000');
  const [courseStartDate, setCourseStartDate] = useState('');
  const [courseEndDate, setCourseEndDate] = useState('');
  const [routineCourseId, setRoutineCourseId] = useState('');

  // Payment Receive Settings Form States
  const [bkashNumber, setBkashNumber] = useState(paymentSettings?.bkashNumber || '01711223344');
  const [bkashType, setBkashType] = useState<'Personal' | 'Merchant' | 'Agent'>(paymentSettings?.bkashType || 'Personal');
  const [nagadNumber, setNagadNumber] = useState(paymentSettings?.nagadNumber || '01811223344');
  const [nagadType, setNagadType] = useState<'Personal' | 'Merchant' | 'Agent'>(paymentSettings?.nagadType || 'Personal');
  const [rocketNumber, setRocketNumber] = useState(paymentSettings?.rocketNumber || '01911223344');
  const [rocketType, setRocketType] = useState<'Personal' | 'Merchant' | 'Agent'>(paymentSettings?.rocketType || 'Personal');
  const [paymentInstructions, setPaymentInstructions] = useState(paymentSettings?.instructions || '‡¶ü‡¶æ‡¶ï‡¶æ ‡¶™‡¶æ‡¶†‡¶æ‡¶®‡ßã‡¶∞ ‡¶™‡¶∞ ‡¶ü‡ßç‡¶∞‡¶æ‡¶®‡¶ú‡ßá‡¶ï‡¶∂‡¶® ‡¶Ü‡¶á‡¶°‡¶ø (TrxID) ‡¶è‡¶¨‡¶Ç ‡¶Ü‡¶™‡¶®‡¶æ‡¶∞ ‡¶Æ‡ßã‡¶¨‡¶æ‡¶á‡¶≤ ‡¶®‡¶Æ‡ßç‡¶¨‡¶∞ ‡¶®‡¶ø‡¶ö‡ßá ‡¶™‡ßç‡¶∞‡¶¶‡¶æ‡¶® ‡¶ï‡¶∞‡ßÅ‡¶®‡•§');
  const [paymentSaveSuccess, setPaymentSaveSuccess] = useState(false);

  // Sync payment settings when prop changes
  useEffect(() => {
    if (paymentSettings) {
      setBkashNumber(paymentSettings.bkashNumber || '01711223344');
      setBkashType(paymentSettings.bkashType || 'Personal');
      setNagadNumber(paymentSettings.nagadNumber || '01811223344');
      setNagadType(paymentSettings.nagadType || 'Personal');
      setRocketNumber(paymentSettings.rocketNumber || '01911223344');
      setRocketType(paymentSettings.rocketType || 'Personal');
      setPaymentInstructions(paymentSettings.instructions || '');
    }
  }, [paymentSettings]);

  // Enrollment Filter & Modal States
  const [enrollmentSearch, setEnrollmentSearch] = useState('');
  const [enrollmentCourseFilter, setEnrollmentCourseFilter] = useState('all');
  const [enrollmentMethodFilter, setEnrollmentMethodFilter] = useState('all');
  const [selectedEnrollmentForModal, setSelectedEnrollmentForModal] = useState<CourseEnrollment | null>(null);
  const [selectedUserForProfileModal, setSelectedUserForProfileModal] = useState<{ enrollment: CourseEnrollment; user?: User } | null>(null);
  const [copiedTrxId, setCopiedTrxId] = useState<string | null>(null);

  // Discount Coupon Form States
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState<number>(20);
  const [couponCourseId, setCouponCourseId] = useState('');
  const [couponDescription, setCouponDescription] = useState('');
  const [couponExpiryDate, setCouponExpiryDate] = useState('');
  const [couponIsActive, setCouponIsActive] = useState(true);

  const handleStartEditCourse = (course: Course) => {
    setEditingCourseId(course.id);
    setCourseTitle(course.title || '');
    setCourseDesc(course.description || '');
    setCourseCategory(course.category || '');
    setCourseStatus(course.status || 'active');
    setCoursePrice(course.price !== undefined ? String(course.price) : '0');
    setCourseOriginalPrice(course.originalPrice !== undefined ? String(course.originalPrice) : '');
    setCourseStartDate(course.startDate || '');
    setCourseEndDate(course.endDate || '');
    setCourseSubTab('courses');
  };

  const handleCancelEditCourse = () => {
    setEditingCourseId(null);
    setCourseTitle('');
    setCourseDesc('');
    setCourseCategory('');
    setCourseStatus('active');
    setCoursePrice('500');
    setCourseOriginalPrice('1000');
    setCourseStartDate('');
    setCourseEndDate('');
  };

  const handleCreateOrUpdateCourseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseTitle.trim() || !courseDesc.trim()) {
      showCustomAlert('‡¶Ö‡¶∏‡¶Æ‡ßç‡¶™‡ßÇ‡¶∞‡ßç‡¶£ ‡¶§‡¶•‡ßç‡¶Ø!', '‡¶ï‡ßã‡¶∞‡ßç‡¶∏‡ßá‡¶∞ ‡¶∂‡¶ø‡¶∞‡ßã‡¶®‡¶æ‡¶Æ ‡¶ì ‡¶¨‡¶ø‡¶∏‡ßç‡¶§‡¶æ‡¶∞‡¶ø‡¶§ ‡¶¨‡¶ø‡¶¨‡¶∞‡¶£ ‡¶¶‡¶ø‡¶®!', 'error');
      return;
    }

    const parsedPrice = coursePrice.trim() === '' ? 0 : Math.max(0, Number(coursePrice) || 0);
    const parsedOriginalPrice = courseOriginalPrice.trim() !== '' ? Math.max(0, Number(courseOriginalPrice) || 0) : undefined;

    if (editingCourseId) {
      if (onUpdateCourse) {
        onUpdateCourse(editingCourseId, {
          title: courseTitle.trim(),
          description: courseDesc.trim(),
          status: courseStatus,
          category: courseCategory || undefined,
          price: parsedPrice,
          originalPrice: parsedOriginalPrice,
          startDate: courseStartDate || undefined,
          endDate: courseEndDate || undefined
        });
        showCustomAlert('‡¶∏‡¶´‡¶≤!', `üéì "${courseTitle.trim()}" ‡¶ï‡ßã‡¶∞‡ßç‡¶∏‡¶ü‡¶ø ‡¶∏‡¶´‡¶≤‡¶≠‡¶æ‡¶¨‡ßá ‡¶Ü‡¶™‡¶°‡ßá‡¶ü ‡¶ï‡¶∞‡¶æ ‡¶π‡ßü‡ßá‡¶õ‡ßá!`, 'success');
        handleCancelEditCourse();
      }
    } else {
      if (onSaveCourse) {
        onSaveCourse({
          title: courseTitle.trim(),
          description: courseDesc.trim(),
          status: courseStatus,
          category: courseCategory || undefined,
          price: parsedPrice,
          originalPrice: parsedOriginalPrice,
          startDate: courseStartDate || undefined,
          endDate: courseEndDate || undefined
        });
        showCustomAlert('‡¶∏‡¶´‡¶≤!', 'üéì ‡¶®‡¶§‡ßÅ‡¶® ‡¶ï‡ßã‡¶∞‡ßç‡¶∏ ‡¶∏‡¶´‡¶≤‡¶≠‡¶æ‡¶¨‡ßá ‡¶§‡ßà‡¶∞‡¶ø ‡¶ì ‡¶™‡ßç‡¶∞‡¶ï‡¶æ‡¶∂ ‡¶ï‡¶∞‡¶æ ‡¶π‡ßü‡ßá‡¶õ‡ßá!', 'success');
        handleCancelEditCourse();
      }
    }
  };

  const handleCreateCouponSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = couponCode.trim().toUpperCase();
    if (!code) {
      showCustomAlert('‡¶Ö‡¶∏‡¶Æ‡ßç‡¶™‡ßÇ‡¶∞‡ßç‡¶£ ‡¶§‡¶•‡ßç‡¶Ø!', '‡¶Ö‡¶®‡ßÅ‡¶ó‡ßç‡¶∞‡¶π ‡¶ï‡¶∞‡ßá ‡¶ï‡ßÅ‡¶™‡¶® ‡¶ï‡ßã‡¶° ‡¶≤‡¶ø‡¶ñ‡ßÅ‡¶® (‡¶Ø‡ßá‡¶Æ‡¶®: SAVE50, EID100)', 'error');
      return;
    }

    const discountVal = Math.min(100, Math.max(1, Number(couponDiscount) || 1));

    const selectedCourseObj = couponCourseId ? courses.find(c => c.id === couponCourseId) : undefined;

    if (onSaveCoupon) {
      onSaveCoupon({
        code,
        discountPercent: discountVal,
        courseId: couponCourseId || undefined,
        courseTitle: selectedCourseObj?.title,
        description: couponDescription.trim() || undefined,
        expiryDate: couponExpiryDate || undefined,
        isActive: couponIsActive,
        usageCount: 0
      });

      showCustomAlert('‡¶ï‡ßÅ‡¶™‡¶® ‡¶§‡ßà‡¶∞‡¶ø ‡¶∏‡¶´‡¶≤! üéâ', `"${code}" ‡¶ï‡ßÅ‡¶™‡¶® (${discountVal}% ‡¶õ‡¶æ‡ßú) ‡¶∏‡¶´‡¶≤‡¶≠‡¶æ‡¶¨‡ßá ‡¶§‡ßà‡¶∞‡¶ø ‡¶ï‡¶∞‡¶æ ‡¶π‡ßü‡ßá‡¶õ‡ßá!`, 'success');
      setCouponCode('');
      setCouponDiscount(20);
      setCouponCourseId('');
      setCouponDescription('');
      setCouponExpiryDate('');
      setCouponIsActive(true);
    }
  };

  // Payment Settings Handlers
  const handleSavePaymentSettingsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bkashNumber.trim() || !nagadNumber.trim() || !rocketNumber.trim()) {
      showCustomAlert('‡¶§‡ßç‡¶∞‡ßÅ‡¶ü‡¶ø', '‡¶Ö‡¶®‡ßÅ‡¶ó‡ßç‡¶∞‡¶π ‡¶ï‡¶∞‡ßá ‡¶¨‡¶ø‡¶ï‡¶æ‡¶∂, ‡¶®‡¶ó‡¶¶ ‡¶è‡¶¨‡¶Ç ‡¶∞‡¶ï‡ßá‡¶ü ‡¶§‡¶ø‡¶®‡¶ü‡¶ø ‡¶™‡ßá‡¶Æ‡ßá‡¶®‡ßç‡¶ü ‡¶®‡¶Æ‡ßç‡¶¨‡¶∞‡¶á ‡¶™‡ßç‡¶∞‡¶¶‡¶æ‡¶® ‡¶ï‡¶∞‡ßÅ‡¶®!', 'error');
      return;
    }
    const updated: PaymentSettings = {
      bkashNumber: bkashNumber.trim(),
      bkashType,
      nagadNumber: nagadNumber.trim(),
      nagadType,
      rocketNumber: rocketNumber.trim(),
      rocketType,
      instructions: paymentInstructions.trim(),
      updatedAt: new Date().toISOString()
    };
    if (onUpdatePaymentSettings) {
      onUpdatePaymentSettings(updated);
    }
    setPaymentSaveSuccess(true);
    setTimeout(() => setPaymentSaveSuccess(false), 3000);
    showCustomAlert('‡¶∏‡¶´‡¶≤!', '‡¶™‡ßá‡¶Æ‡ßá‡¶®‡ßç‡¶ü ‡¶ó‡ßç‡¶∞‡¶π‡¶£ ‡¶®‡¶Æ‡ßç‡¶¨‡¶∞ ‡¶ì ‡¶®‡¶ø‡¶∞‡ßç‡¶¶‡ßá‡¶∂‡¶®‡¶æ ‡¶∏‡¶´‡¶≤‡¶≠‡¶æ‡¶¨‡ßá ‡¶∏‡ßá‡¶≠ ‡¶ï‡¶∞‡¶æ ‡¶π‡ßü‡ßá‡¶õ‡ßá!', 'success');
  };

  // Filtered Course Enrollments Memo
  const filteredEnrollments = useMemo(() => {
    return (courseEnrollments || []).filter(enr => {
      // Course filter
      if (enrollmentCourseFilter !== 'all' && enr.courseId !== enrollmentCourseFilter) {
        return false;
      }
      // Method filter
      if (enrollmentMethodFilter !== 'all') {
        const m = (enr.paymentMethod || '').toLowerCase();
        if (enrollmentMethodFilter === 'free' && enr.finalPrice !== 0 && m !== 'free') return false;
        if (enrollmentMethodFilter !== 'free' && !m.includes(enrollmentMethodFilter)) return false;
      }
      // Search query
      if (enrollmentSearch.trim()) {
        const q = enrollmentSearch.toLowerCase().trim();
        const matchName = (enr.userName || '').toLowerCase().includes(q);
        const matchId = (enr.userId || '').toLowerCase().includes(q);
        const matchEmail = (enr.userEmail || '').toLowerCase().includes(q);
        const matchPhone = (enr.userPhone || '').toLowerCase().includes(q);
        const matchCourse = (enr.courseTitle || '').toLowerCase().includes(q);
        const matchTrx = (enr.trxId || '').toLowerCase().includes(q);
        const matchCoupon = (enr.couponCode || '').toLowerCase().includes(q);
        return matchName || matchId || matchEmail || matchPhone || matchCourse || matchTrx || matchCoupon;
      }
      return true;
    });
  }, [courseEnrollments, enrollmentCourseFilter, enrollmentMethodFilter, enrollmentSearch]);

  const handleExportEnrollmentsCSV = () => {
    if (!filteredEnrollments || filteredEnrollments.length === 0) {
      showCustomAlert('‡¶∏‡¶§‡¶∞‡ßç‡¶ï‡¶§‡¶æ', '‡¶°‡¶æ‡¶â‡¶®‡¶≤‡ßã‡¶° ‡¶ï‡¶∞‡¶æ‡¶∞ ‡¶Æ‡¶§‡ßã ‡¶ï‡ßã‡¶®‡ßã ‡¶è‡¶®‡¶∞‡ßã‡¶≤‡¶Æ‡ßá‡¶®‡ßç‡¶ü ‡¶∞‡ßá‡¶ï‡¶∞‡ßç‡¶° ‡¶™‡¶æ‡¶ì‡ßü‡¶æ ‡¶Ø‡¶æ‡ßü‡¶®‡¶ø!', 'warning');
      return;
    }
    const headers = [
      'Student Name',
      'User ID',
      'Email',
      'Phone',
      'Course Title',
      'Course ID',
      'Original Price (BDT)',
      'Discount %',
      'Discount Amount (BDT)',
      'Final Price (BDT)',
      'Coupon Code',
      'Payment Method',
      'Transaction ID (TrxID)',
      'Payment Status',
      'Enrolled At'
    ];
    const rows = filteredEnrollments.map(e => [
      `"${(e.userName || '').replace(/"/g, '""')}"`,
      `"${(e.userId || '').replace(/"/g, '""')}"`,
      `"${(e.userEmail || '').replace(/"/g, '""')}"`,
      `"${(e.userPhone || '').replace(/"/g, '""')}"`,
      `"${(e.courseTitle || '').replace(/"/g, '""')}"`,
      `"${(e.courseId || '').replace(/"/g, '""')}"`,
      e.originalPrice || 0,
      e.discountPercent || 0,
      e.discountAmount || 0,
      e.finalPrice || 0,
      `"${(e.couponCode || '').replace(/"/g, '""')}"`,
      `"${(e.paymentMethod || '').replace(/"/g, '""')}"`,
      `"${(e.trxId || '').replace(/"/g, '""')}"`,
      `"${(e.paymentStatus || '').replace(/"/g, '""')}"`,
      `"${(e.enrolledAt || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `orjon_course_enrollments_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyTrx = (trx: string) => {
    if (!trx) return;
    navigator.clipboard.writeText(trx);
    setCopiedTrxId(trx);
    setTimeout(() => setCopiedTrxId(null), 2000);
  };

  const handleViewUserProfile = (enr: CourseEnrollment) => {
    const matchedUser = (users || []).find(u => 
      (enr.userId && u.userId && u.userId.toLowerCase() === enr.userId.toLowerCase()) ||
      (enr.userPhone && u.phone && u.phone === enr.userPhone) ||
      (enr.userEmail && u.email && u.email.toLowerCase() === enr.userEmail.toLowerCase())
    );
    setSelectedUserForProfileModal({ enrollment: enr, user: matchedUser });
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
    if (newAdminPassInput.length < 6) {
      showCustomAlert('‡¶§‡ßç‡¶∞‡ßÅ‡¶ü‡¶ø!', '‡¶®‡¶§‡ßÅ‡¶® ‡¶™‡¶æ‡¶∏‡¶ì‡ßü‡¶æ‡¶∞‡ßç‡¶° ‡¶®‡ßÇ‡¶®‡ßç‡¶Ø‡¶§‡¶Æ ‡ß¨ ‡¶°‡¶ø‡¶ú‡¶ø‡¶ü‡ßá‡¶∞ ‡¶π‡¶§‡ßá ‡¶π‡¶¨‡ßá!', 'warning');
      return;
    }
    if (newAdminPassInput !== confirmAdminPassInput) {
      showCustomAlert('‡¶§‡ßç‡¶∞‡ßÅ‡¶ü‡¶ø!', '‡¶®‡¶§‡ßÅ‡¶® ‡¶™‡¶æ‡¶∏‡¶ì‡ßü‡¶æ‡¶∞‡ßç‡¶° ‡¶è‡¶¨‡¶Ç ‡¶ï‡¶®‡¶´‡¶æ‡¶∞‡ßç‡¶Æ ‡¶™‡¶æ‡¶∏‡¶ì‡ßü‡¶æ‡¶∞‡ßç‡¶° ‡¶Æ‡¶ø‡¶≤‡¶õ‡ßá ‡¶®‡¶æ!', 'warning');
      return;
    }

    if (onUpdateAdminPassword) {
      onUpdateAdminPassword(newAdminPassInput);
    }
    if (onAddAuditLog) {
      onAddAuditLog('‡¶™‡¶æ‡¶∏‡¶ì‡ßü‡¶æ‡¶∞‡ßç‡¶° ‡¶™‡¶∞‡¶ø‡¶¨‡¶∞‡ßç‡¶§‡¶® (Security)', '‡¶è‡¶°‡¶Æ‡¶ø‡¶® ‡¶™‡ßç‡¶Ø‡¶æ‡¶®‡ßá‡¶≤‡ßá‡¶∞ ‡¶∏‡¶ø‡¶ï‡¶ø‡¶â‡¶∞‡¶ø‡¶ü‡¶ø ‡¶™‡¶æ‡¶∏‡¶ì‡ßü‡¶æ‡¶∞‡ßç‡¶° ‡¶™‡¶∞‡¶ø‡¶¨‡¶∞‡ßç‡¶§‡¶® ‡¶ï‡¶∞‡¶æ ‡¶π‡ßü‡ßá‡¶õ‡ßá', 'other');
    }
    setIsPasswordModalOpen(false);
    setCurrPassInput('');
    setNewAdminPassInput('');
    setConfirmAdminPassInput('');
    showCustomAlert('‡¶∏‡¶´‡¶≤!', '‡¶è‡¶°‡¶Æ‡¶ø‡¶® ‡¶™‡¶æ‡¶∏‡¶ì‡ßü‡¶æ‡¶∞‡ßç‡¶° ‡¶∏‡¶´‡¶≤‡¶≠‡¶æ‡¶¨‡ßá ‡¶™‡¶∞‡¶ø‡¶¨‡¶∞‡ßç‡¶§‡¶® ‡¶ï‡¶∞‡¶æ ‡¶π‡ßü‡ßá‡¶õ‡ßá‡•§', 'success');
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

      showCustomAlert('‡¶∏‡¶´‡¶≤!', '‡¶∏‡¶ø‡¶∏‡ßç‡¶ü‡ßá‡¶Æ‡ßá‡¶∞ ‡¶∏‡¶Æ‡ßç‡¶™‡ßÇ‡¶∞‡ßç‡¶£ ‡¶°‡¶æ‡¶ü‡¶æ‡¶¨‡ßá‡¶ú JSON ‡¶´‡¶æ‡¶á‡¶≤ ‡¶π‡¶ø‡¶∏‡ßá‡¶¨‡ßá ‡¶°‡¶æ‡¶â‡¶®‡¶≤‡ßã‡¶° ‡¶ï‡¶∞‡¶æ ‡¶π‡ßü‡ßá‡¶õ‡ßá‡•§', 'success');
    } catch (err) {
      showCustomAlert('‡¶§‡ßç‡¶∞‡ßÅ‡¶ü‡¶ø!', '‡¶°‡¶æ‡¶ü‡¶æ‡¶¨‡ßá‡¶ú ‡¶´‡¶æ‡¶á‡¶≤ ‡¶§‡ßà‡¶∞‡¶ø‡¶§‡ßá ‡¶¨‡ßç‡¶Ø‡¶∞‡ßç‡¶• ‡¶π‡ßü‡ßá‡¶õ‡ßá‡•§', 'warning');
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
          showCustomAlert('‡¶§‡ßç‡¶∞‡ßÅ‡¶ü‡¶ø!', '‡¶´‡¶æ‡¶á‡¶≤‡¶ü‡¶ø‡¶§‡ßá ‡¶ï‡ßã‡¶®‡ßã ‡¶¨‡ßà‡¶ß ‡¶¨‡ßç‡¶Ø‡¶æ‡¶ï‡¶Ü‡¶™ ‡¶°‡¶æ‡¶ü‡¶æ ‡¶™‡¶æ‡¶ì‡ßü‡¶æ ‡¶Ø‡¶æ‡ßü‡¶®‡¶ø‡•§', 'warning');
          return;
        }

        const count = Object.keys(dataToRestore).length;
        showCustomConfirm(
          '‡¶¨‡ßç‡¶Ø‡¶æ‡¶ï‡¶Ü‡¶™ ‡¶∞‡¶ø‡¶∏‡ßç‡¶ü‡ßã‡¶∞ ‡¶ï‡¶®‡¶´‡¶æ‡¶∞‡ßç‡¶Æ‡ßá‡¶∂‡¶®',
          `‡¶Ü‡¶™‡¶®‡¶ø ‡¶ï‡¶ø ‡¶®‡¶ø‡¶∂‡ßç‡¶ö‡¶ø‡¶§‡¶≠‡¶æ‡¶¨‡ßá ${count}‡¶ü‡¶ø ‡¶Ü‡¶á‡¶ü‡ßá‡¶Æ‡ßá‡¶∞ ‡¶¨‡ßç‡¶Ø‡¶æ‡¶ï‡¶Ü‡¶™ ‡¶∞‡¶ø‡¶∏‡ßç‡¶ü‡ßã‡¶∞ ‡¶ï‡¶∞‡¶§‡ßá ‡¶ö‡¶æ‡¶®? ‡¶Ü‡¶™‡¶®‡¶æ‡¶∞ ‡¶¨‡¶∞‡ßç‡¶§‡¶Æ‡¶æ‡¶® ‡¶≤‡ßã‡¶ï‡¶æ‡¶≤ ‡¶°‡¶æ‡¶ü‡¶æ‡¶¨‡ßá‡¶ú ‡¶è‡¶∞ ‡¶´‡¶≤‡ßá ‡¶Ü‡¶™‡¶°‡ßá‡¶ü ‡¶π‡¶¨‡ßá‡•§`,
          () => {
            Object.entries(dataToRestore!).forEach(([k, v]) => {
              if (typeof v === 'string') {
                localStorage.setItem(k, v);
              } else {
                localStorage.setItem(k, JSON.stringify(v));
              }
            });
            showCustomAlert('‡¶∏‡¶´‡¶≤!', '‡¶°‡¶æ‡¶ü‡¶æ‡¶¨‡ßá‡¶ú ‡¶∏‡¶´‡¶≤‡¶≠‡¶æ‡¶¨‡ßá ‡¶∞‡¶ø‡¶∏‡ßç‡¶ü‡ßã‡¶∞ ‡¶π‡ßü‡ßá‡¶õ‡ßá! ‡¶§‡¶•‡ßç‡¶Ø ‡¶∞‡¶ø‡¶´‡ßç‡¶∞‡ßá‡¶∂ ‡¶ï‡¶∞‡¶§‡ßá ‡¶™‡ßá‡¶ú ‡¶∞‡¶ø‡¶≤‡ßã‡¶° ‡¶π‡¶ö‡ßç‡¶õ‡ßá...', 'success');
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          }
        );
      } catch (err) {
        showCustomAlert('‡¶§‡ßç‡¶∞‡ßÅ‡¶ü‡¶ø!', 'JSON ‡¶´‡¶æ‡¶á‡¶≤‡¶ü‡¶ø ‡¶™‡ßú‡¶æ ‡¶∏‡¶Æ‡ßç‡¶≠‡¶¨ ‡¶π‡ßü‡¶®‡¶ø‡•§ ‡¶∏‡¶†‡¶ø‡¶ï ‡¶¨‡ßç‡¶Ø‡¶æ‡¶ï‡¶Ü‡¶™ ‡¶´‡¶æ‡¶á‡¶≤ ‡¶®‡¶ø‡¶∞‡ßç‡¶¨‡¶æ‡¶ö‡¶® ‡¶ï‡¶∞‡ßÅ‡¶®‡•§', 'warning');
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
        showCustomAlert('‡¶´‡¶æ‡¶á‡¶≤ ‡¶®‡¶ø‡¶∞‡ßç‡¶¨‡¶æ‡¶ö‡¶® ‡¶∏‡¶´‡¶≤!', `"${file.name}" ‡¶´‡¶æ‡¶á‡¶≤‡ßá ${qArr.length}‡¶ü‡¶ø ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶ö‡¶ø‡¶π‡ßç‡¶®‡¶ø‡¶§ ‡¶ï‡¶∞‡¶æ ‡¶π‡ßü‡ßá‡¶õ‡ßá‡•§`, 'success');
      } catch (err) {
        showCustomAlert('‡¶§‡ßç‡¶∞‡ßÅ‡¶ü‡¶ø!', 'JSON ‡¶´‡¶æ‡¶á‡¶≤ ‡¶™‡¶æ‡¶∞‡ßç‡¶∏ ‡¶ï‡¶∞‡¶§‡ßá ‡¶∏‡¶Æ‡¶∏‡ßç‡¶Ø‡¶æ ‡¶π‡ßü‡ßá‡¶õ‡ßá‡•§ ‡¶∏‡¶†‡¶ø‡¶ï ‡¶¨‡ßç‡¶Ø‡¶æ‡¶ï‡¶Ü‡¶™ ‡¶´‡¶æ‡¶á‡¶≤ ‡¶∏‡¶ø‡¶≤‡ßá‡¶ï‡ßç‡¶ü ‡¶ï‡¶∞‡ßÅ‡¶®‡•§', 'warning');
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
          '‡¶´‡¶æ‡ßü‡¶æ‡¶∞‡¶∏‡ßç‡¶ü‡ßã‡¶∞ ‡¶ï‡¶æ‡¶®‡ßá‡¶ï‡¶∂‡¶® ‡¶∏‡¶´‡¶≤! (Firestore Verified)',
          `Google Firebase Cloud Firestore (Project ID: "${firebaseConfig.projectId}") ‡¶∏‡¶´‡¶≤‡¶≠‡¶æ‡¶¨‡ßá ‡¶∏‡¶ï‡ßç‡¶∞‡¶ø‡ßü ‡¶ì ‡¶∏‡¶Ç‡¶Ø‡ßÅ‡¶ï‡ßç‡¶§ ‡¶∞‡ßü‡ßá‡¶õ‡ßá‡•§\n\n‡¶Æ‡ßã‡¶ü ‡ßß‡ß¶‡¶ü‡¶ø ‡¶ï‡¶æ‡¶≤‡ßá‡¶ï‡¶∂‡¶®‡ßá ‡¶¨‡¶∞‡ßç‡¶§‡¶Æ‡¶æ‡¶®‡ßá ${res.total.toLocaleString('bn-BD')} ‡¶ü‡¶ø ‡¶°‡¶ï‡ßÅ‡¶Æ‡ßá‡¶®‡ßç‡¶ü ‡¶ö‡¶ø‡¶π‡ßç‡¶®‡¶ø‡¶§ ‡¶™‡¶æ‡¶ì‡ßü‡¶æ ‡¶ó‡ßá‡¶õ‡ßá‡•§`,
          'success'
        );
      } else {
        showCustomAlert(
          '‡¶´‡¶æ‡ßü‡¶æ‡¶∞‡¶∏‡ßç‡¶ü‡ßã‡¶∞ ‡¶ï‡¶æ‡¶®‡ßá‡¶ï‡¶∂‡¶® ‡¶∏‡¶§‡¶∞‡ßç‡¶ï‡¶§‡¶æ!',
          `‡¶´‡¶æ‡ßü‡¶æ‡¶∞‡¶∏‡ßç‡¶ü‡ßã‡¶∞ ‡¶ï‡¶æ‡¶®‡ßá‡¶ï‡¶∂‡¶® ‡¶∏‡¶ï‡ßç‡¶∞‡¶ø‡ßü ‡¶Ü‡¶õ‡ßá, ‡¶§‡¶¨‡ßá ‡¶ï‡¶ø‡¶õ‡ßÅ ‡¶ï‡¶æ‡¶≤‡ßá‡¶ï‡¶∂‡¶® ‡¶∞‡¶ø‡¶° ‡¶ï‡¶∞‡¶æ‡¶∞ ‡¶∏‡¶Æ‡ßü ‡¶∏‡¶Æ‡¶∏‡ßç‡¶Ø‡¶æ ‡¶™‡¶∞‡¶ø‡¶≤‡¶ï‡ßç‡¶∑‡¶ø‡¶§ ‡¶π‡ßü‡ßá‡¶õ‡ßá:\n\n${res.errors.join('\n')}`,
          'warning'
        );
      }
    } catch (err: any) {
      showCustomAlert(
        '‡¶ï‡¶æ‡¶®‡ßá‡¶ï‡¶∂‡¶® ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ ‡¶¨‡ßç‡¶Ø‡¶∞‡ßç‡¶•!',
        `‡¶´‡¶æ‡ßü‡¶æ‡¶∞‡¶∏‡ßç‡¶ü‡ßã‡¶∞ ‡¶°‡¶æ‡¶ü‡¶æ‡¶¨‡ßá‡¶ú‡ßá ‡¶∏‡¶Ç‡¶Ø‡ßÅ‡¶ï‡ßç‡¶§ ‡¶π‡¶ì‡ßü‡¶æ ‡¶∏‡¶Æ‡ßç‡¶≠‡¶¨ ‡¶π‡ßü‡¶®‡¶ø: ${err?.message || String(err)}\n\n‡¶¶‡ßü‡¶æ ‡¶ï‡¶∞‡ßá ‡¶Ü‡¶™‡¶®‡¶æ‡¶∞ ‡¶á‡¶®‡ßç‡¶ü‡¶æ‡¶∞‡¶®‡ßá‡¶ü ‡¶ï‡¶æ‡¶®‡ßá‡¶ï‡¶∂‡¶® ‡¶¨‡¶æ ‡¶´‡¶æ‡ßü‡¶æ‡¶∞‡¶¨‡ßá‡¶∏ ‡¶ï‡¶®‡¶´‡¶ø‡¶ó‡¶æ‡¶∞‡ßá‡¶∂‡¶® ‡¶ö‡ßá‡¶ï ‡¶ï‡¶∞‡ßÅ‡¶®‡•§`,
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
      { key: 'questions', name: '‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶≠‡¶æ‡¶®‡ßç‡¶°‡¶æ‡¶∞ (MCQ Bank)', local: questions.length, cloud: firestoreCounts?.questions ?? 0, icon: 'üìÅ', color: 'indigo', idPrefix: 'q' },
      { key: 'courses', name: '‡¶ï‡ßã‡¶∞‡ßç‡¶∏‡¶∏‡¶Æ‡ßÇ‡¶π (Courses)', local: (courses || []).length, cloud: firestoreCounts?.courses ?? 0, icon: 'üéì', color: 'purple', idPrefix: 'course' },
      { key: 'routines', name: '‡¶∞‡ßÅ‡¶ü‡¶ø‡¶®‡¶∏‡¶Æ‡ßÇ‡¶π (Routines)', local: (routines || []).length, cloud: firestoreCounts?.routines ?? 0, icon: 'üìÖ', color: 'blue', idPrefix: 'rt' },
      { key: 'live_exams', name: '‡¶≤‡¶æ‡¶á‡¶≠ ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ (Live Exams)', local: (liveExams || []).length, cloud: firestoreCounts?.live_exams ?? 0, icon: '‚è±Ô∏è', color: 'amber', idPrefix: 'le' },
      { key: 'categories', name: '‡¶Æ‡ßÇ‡¶≤ ‡¶¨‡¶ø‡¶∑‡ßü/‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø (Categories)', local: (categories || []).length, cloud: firestoreCounts?.categories ?? 0, icon: 'üóÇÔ∏è', color: 'emerald', idPrefix: 'cat' },
      { key: 'subcategories', name: '‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø (Subcategories)', local: (subcategories || []).length, cloud: firestoreCounts?.subcategories ?? 0, icon: 'teal', idPrefix: 'subcat' },
      { key: 'notices', name: '‡¶™‡¶™‡¶Ü‡¶™ ‡¶®‡ßã‡¶ü‡¶ø‡¶∂ (Notices)', local: (notices || []).length, cloud: firestoreCounts?.notices ?? 0, icon: 'üì¢', color: 'rose', idPrefix: 'notice' },
      { key: 'audit_logs', name: '‡¶Ö‡¶°‡¶ø‡¶ü ‡¶≤‡¶ó (Audit Logs)', local: (auditLogs || []).length, cloud: firestoreCounts?.audit_logs ?? 0, icon: 'üìú', color: 'violet', idPrefix: 'log' },
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
    setSyncProgress({ currentStep: 0, totalSteps: 8, currentCollection: '‡¶∏‡¶ø‡¶ô‡ßç‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø ‡¶ö‡¶≤‡¶õ‡ßá...', percent: 0 });

    try {
      // 1. Questions
      setSyncProgress({ currentStep: 1, totalSteps: 8, currentCollection: '‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶≠‡¶æ‡¶®‡ßç‡¶°‡¶æ‡¶∞ (questions)...', percent: 12 });
      if (questions.length > 0) {
        await syncCollectionToFirestore('questions', questions, 'q');
      }

      // 2. Courses
      setSyncProgress({ currentStep: 2, totalSteps: 8, currentCollection: '‡¶ï‡ßã‡¶∞‡ßç‡¶∏‡¶∏‡¶Æ‡ßÇ‡¶π (courses)...', percent: 25 });
      if ((courses || []).length > 0) {
        await syncCollectionToFirestore('courses', courses || [], 'course');
      }

      // 3. Routines
      setSyncProgress({ currentStep: 3, totalSteps: 8, currentCollection: '‡¶∞‡ßÅ‡¶ü‡¶ø‡¶®‡¶∏‡¶Æ‡ßÇ‡¶π (routines)...', percent: 37 });
      if ((routines || []).length > 0) {
        await syncCollectionToFirestore('routines', routines || [], 'rt');
      }

      // 4. Live Exams
      setSyncProgress({ currentStep: 4, totalSteps: 8, currentCollection: '‡¶≤‡¶æ‡¶á‡¶≠ ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ (live_exams)...', percent: 50 });
      if ((liveExams || []).length > 0) {
        await syncCollectionToFirestore('live_exams', liveExams || [], 'le');
      }

      // 5. Categories
      setSyncProgress({ currentStep: 5, totalSteps: 8, currentCollection: '‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø (categories)...', percent: 62 });
      if ((categories || []).length > 0) {
        await syncCollectionToFirestore('categories', categories || [], 'cat');
      }

      // 6. Subcategories
      setSyncProgress({ currentStep: 6, totalSteps: 8, currentCollection: '‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø (subcategories)...', percent: 75 });
      if ((subcategories || []).length > 0) {
        await syncCollectionToFirestore('subcategories', subcategories || [], 'subcat');
      }

      // 7. Notices
      setSyncProgress({ currentStep: 7, totalSteps: 8, currentCollection: '‡¶®‡ßã‡¶ü‡¶ø‡¶∂‡¶∏‡¶Æ‡ßÇ‡¶π (notices)...', percent: 87 });
      if ((notices || []).length > 0) {
        await syncCollectionToFirestore('notices', notices || [], 'notice');
      }

      // 8. Audit Logs
      setSyncProgress({ currentStep: 8, totalSteps: 8, currentCollection: '‡¶Ö‡¶°‡¶ø‡¶ü ‡¶≤‡¶ó (audit_logs)...', percent: 100 });
      if ((auditLogs || []).length > 0) {
        await syncCollectionToFirestore('audit_logs', auditLogs || [], 'log');
      }

      // Refresh Firestore counts
      const res = await fetchFirestoreDocumentCounts();
      if (res && res.counts) {
        setFirestoreCounts(res.counts);
      }

      showCustomAlert(
        '‡¶ï‡ßç‡¶≤‡¶æ‡¶â‡¶° ‡¶∏‡¶ø‡¶ô‡ßç‡¶ï ‡¶∏‡¶´‡¶≤! (Cloud Sync 100%)',
        '‡¶Ö‡ßç‡¶Ø‡¶æ‡¶°‡¶Æ‡¶ø‡¶®‡ßá‡¶∞ ‡¶§‡ßà‡¶∞‡¶ø ‡¶ì ‡¶Ü‡¶™‡¶°‡ßá‡¶ü ‡¶ï‡¶∞‡¶æ ‡¶∏‡¶ï‡¶≤ ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶®, ‡¶ï‡ßã‡¶∞‡ßç‡¶∏, ‡¶∞‡ßÅ‡¶ü‡¶ø‡¶®, ‡¶≤‡¶æ‡¶á‡¶≠ ‡¶è‡¶ï‡ßç‡¶∏‡¶æ‡¶Æ, ‡¶¨‡¶ø‡¶∑‡ßü/‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶ì ‡¶®‡ßã‡¶ü‡¶ø‡¶∂ ‡¶∏‡¶´‡¶≤‡¶≠‡¶æ‡¶¨‡ßá Firebase Firestore ‡¶ï‡ßç‡¶≤‡¶æ‡¶â‡¶°‡ßá ‡ßß‡ß¶‡ß¶% ‡¶∏‡¶ø‡¶ô‡ßç‡¶ï ‡¶∏‡¶Æ‡ßç‡¶™‡¶®‡ßç‡¶® ‡¶π‡ßü‡ßá‡¶õ‡ßá‡•§',
        'success'
      );
    } catch (err: any) {
      showCustomAlert(
        '‡¶∏‡¶ø‡¶ô‡ßç‡¶ï ‡¶¨‡ßç‡¶Ø‡¶∞‡ßç‡¶• ‡¶π‡ßü‡ßá‡¶õ‡ßá!',
        `‡¶ï‡ßç‡¶≤‡¶æ‡¶â‡¶°‡ßá ‡¶∏‡¶ø‡¶ô‡ßç‡¶ï ‡¶ï‡¶∞‡¶æ‡¶∞ ‡¶∏‡¶Æ‡ßü ‡¶§‡ßç‡¶∞‡ßÅ‡¶ü‡¶ø ‡¶ò‡¶ü‡ßá‡¶õ‡ßá: ${err?.message || String(err)}`,
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
      } else if (key === 'coupons') {
        await syncCollectionToFirestore('coupons', coupons || [], 'coupon');
      } else if (key === 'course_enrollments') {
        await syncCollectionToFirestore('course_enrollments', courseEnrollments || [], 'enr');
      } else if (key === 'payment_settings') {
        if (paymentSettings) {
          await syncCollectionToFirestore('payment_settings', [paymentSettings], 'item');
        }
      } else if (key === 'audit_logs') {
        await syncCollectionToFirestore('audit_logs', auditLogs || [], 'log');
      }

      const res = await fetchFirestoreDocumentCounts();
      if (res && res.counts) {
        setFirestoreCounts(res.counts);
      }

      showCustomAlert('‡¶∏‡¶ø‡¶ô‡ßç‡¶ï ‡¶∏‡¶Æ‡ßç‡¶™‡¶®‡ßç‡¶®!', `"${key}" ‡¶ï‡¶æ‡¶≤‡ßá‡¶ï‡¶∂‡¶®‡ßá‡¶∞ ‡¶°‡ßá‡¶ü‡¶æ ‡¶∏‡¶´‡¶≤‡¶≠‡¶æ‡¶¨‡ßá Firebase Firestore-‡¶è ‡¶∏‡¶ø‡¶ô‡ßç‡¶ï ‡¶π‡ßü‡ßá‡¶õ‡ßá‡•§`, 'success');
    } catch (err: any) {
      showCustomAlert('‡¶∏‡¶ø‡¶ô‡ßç‡¶ï ‡¶¨‡ßç‡¶Ø‡¶∞‡ßç‡¶•!', `‡¶§‡ßç‡¶∞‡ßÅ‡¶ü‡¶ø: ${err?.message || String(err)}`, 'warning');
    } finally {
      setSyncingSingleKey(null);
    }
  };

  const handleStartLocalStorageMigration = async () => {
    showCustomConfirm(
      'Firebase Migration Confirmation',
      '‡¶Ü‡¶™‡¶®‡¶ø ‡¶ï‡¶ø ‡¶≤‡ßã‡¶ï‡¶æ‡¶≤ ‡¶°‡¶æ‡¶ü‡¶æ‡¶¨‡ßá‡¶ú (localStorage)-‡¶è‡¶∞ ‡¶∏‡¶ï‡¶≤ ‡¶á‡¶â‡¶ú‡¶æ‡¶∞, ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶®, ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶≤‡¶ó ‡¶ì ‡¶®‡ßã‡¶ü‡¶ø‡¶∂ Firebase Cloud Firestore-‡¶è ‡¶Æ‡¶æ‡¶á‡¶ó‡ßç‡¶∞‡ßá‡¶ü ‡¶ï‡¶∞‡¶§‡ßá ‡¶ö‡¶æ‡¶®? (‡¶Ü‡¶™‡¶®‡¶æ‡¶∞ ‡¶≤‡ßã‡¶ï‡¶æ‡¶≤ ‡¶°‡¶æ‡¶ü‡¶æ‡¶¨‡ßá‡¶ú ‡¶∏‡ßÅ‡¶∞‡¶ï‡ßç‡¶∑‡¶ø‡¶§ ‡¶•‡¶æ‡¶ï‡¶¨‡ßá)',
      async () => {
        setIsMigrating(true);
        setMigrationLogs([]);
        setMigrationStatusMsg('‡¶≤‡ßã‡¶ï‡¶æ‡¶≤ ‡¶°‡¶æ‡¶ü‡¶æ‡¶¨‡ßá‡¶ú ‡¶™‡ßç‡¶∞‡¶∏‡ßá‡¶∏ ‡¶ï‡¶∞‡¶æ ‡¶π‡¶ö‡ßç‡¶õ‡ßá...');
        try {
          const lsMap = getAllLocalStorageMap();
          const report = await migrateDataToFirestore(lsMap, 'localStorage', (msg) => {
            setMigrationStatusMsg(msg);
            setMigrationLogs(prev => [...prev, `[${new Date().toLocaleTimeString('bn-BD')}] ${msg}`]);
          });
          setMigrationReport(report);
          await handleRefreshFirestoreCounts();
          showCustomAlert('‡¶Æ‡¶æ‡¶á‡¶ó‡ßç‡¶∞‡ßá‡¶∂‡¶® ‡¶∏‡¶Æ‡ßç‡¶™‡¶®‡ßç‡¶®!', `Firebase Firestore-‡¶è ‡¶Æ‡ßã‡¶ü ${report.totalDocuments}‡¶ü‡¶ø ‡¶®‡¶•‡¶ø ‡¶∏‡¶´‡¶≤‡¶≠‡¶æ‡¶¨‡ßá ‡¶Ø‡ßÅ‡¶ï‡ßç‡¶§/‡¶Ü‡¶™‡¶°‡ßá‡¶ü ‡¶ï‡¶∞‡¶æ ‡¶π‡ßü‡ßá‡¶õ‡ßá‡•§`, 'success');
        } catch (err: any) {
          showCustomAlert('‡¶§‡ßç‡¶∞‡ßÅ‡¶ü‡¶ø!', `‡¶Æ‡¶æ‡¶á‡¶ó‡ßç‡¶∞‡ßá‡¶∂‡¶® ‡¶¨‡ßç‡¶Ø‡¶∞‡ßç‡¶• ‡¶π‡ßü‡ßá‡¶õ‡ßá: ${err?.message || String(err)}`, 'warning');
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
          `‡¶Ü‡¶™‡¶®‡¶ø ‡¶ï‡¶ø "${file.name}" ‡¶¨‡ßç‡¶Ø‡¶æ‡¶ï‡¶Ü‡¶™ ‡¶´‡¶æ‡¶á‡¶≤‡ßá‡¶∞ ‡¶°‡¶æ‡¶ü‡¶æ Firebase Cloud Firestore-‡¶è ‡¶Æ‡¶æ‡¶á‡¶ó‡ßç‡¶∞‡ßá‡¶ü ‡¶ï‡¶∞‡¶§‡ßá ‡¶ö‡¶æ‡¶®?`,
          async () => {
            setIsMigrating(true);
            setMigrationLogs([]);
            setMigrationStatusMsg('JSON ‡¶´‡¶æ‡¶á‡¶≤ ‡¶•‡ßá‡¶ï‡ßá ‡¶´‡¶æ‡ßü‡¶æ‡¶∞‡¶∏‡ßç‡¶ü‡ßã‡¶∞‡ßá ‡¶Æ‡¶æ‡¶á‡¶ó‡ßç‡¶∞‡ßá‡¶∂‡¶® ‡¶π‡¶ö‡ßç‡¶õ‡ßá...');
            try {
              const report = await migrateDataToFirestore(parsed, 'JSON File', (msg) => {
                setMigrationStatusMsg(msg);
                setMigrationLogs(prev => [...prev, `[${new Date().toLocaleTimeString('bn-BD')}] ${msg}`]);
              });
              setMigrationReport(report);
              await handleRefreshFirestoreCounts();
              showCustomAlert('‡¶Æ‡¶æ‡¶á‡¶ó‡ßç‡¶∞‡ßá‡¶∂‡¶® ‡¶∏‡¶Æ‡ßç‡¶™‡¶®‡ßç‡¶®!', `Firebase Firestore-‡¶è ‡¶¨‡ßç‡¶Ø‡¶æ‡¶ï‡¶Ü‡¶™ ‡¶´‡¶æ‡¶á‡¶≤ ‡¶•‡ßá‡¶ï‡ßá ‡¶Æ‡ßã‡¶ü ${report.totalDocuments}‡¶ü‡¶ø ‡¶®‡¶•‡¶ø ‡¶∏‡¶´‡¶≤‡¶≠‡¶æ‡¶¨‡ßá ‡¶Ü‡¶™‡¶≤‡ßã‡¶° ‡¶ï‡¶∞‡¶æ ‡¶π‡ßü‡ßá‡¶õ‡ßá‡•§`, 'success');
            } catch (err: any) {
              showCustomAlert('‡¶§‡ßç‡¶∞‡ßÅ‡¶ü‡¶ø!', `‡¶Æ‡¶æ‡¶á‡¶ó‡ßç‡¶∞‡ßá‡¶∂‡¶® ‡¶¨‡ßç‡¶Ø‡¶∞‡ßç‡¶• ‡¶π‡ßü‡ßá‡¶õ‡ßá: ${err?.message || String(err)}`, 'warning');
            } finally {
              setIsMigrating(false);
            }
          }
        );
      } catch (err) {
        showCustomAlert('‡¶§‡ßç‡¶∞‡ßÅ‡¶ü‡¶ø!', 'JSON ‡¶´‡¶æ‡¶á‡¶≤ ‡¶™‡ßú‡¶æ ‡¶¨‡ßç‡¶Ø‡¶∞‡ßç‡¶• ‡¶π‡ßü‡ßá‡¶õ‡ßá‡•§ ‡¶∏‡¶†‡¶ø‡¶ï ‡¶¨‡ßç‡¶Ø‡¶æ‡¶ï‡¶Ü‡¶™ ‡¶´‡¶æ‡¶á‡¶≤ ‡¶®‡¶ø‡¶∞‡ßç‡¶¨‡¶æ‡¶ö‡¶® ‡¶ï‡¶∞‡ßÅ‡¶®‡•§', 'warning');
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
  const [category, setCategory] = useState('‡¶∏‡¶æ‡¶ß‡¶æ‡¶∞‡¶£ ‡¶ú‡ßç‡¶û‡¶æ‡¶®');
  const [subcategory, setSubcategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customSubcategory, setCustomSubcategory] = useState('');
  const [isCustomSubcategory, setIsCustomSubcategory] = useState(false);

  // Multi-select state for MCQ category linking
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['‡¶∏‡¶æ‡¶ß‡¶æ‡¶∞‡¶£ ‡¶ú‡ßç‡¶û‡¶æ‡¶®']);
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);

  // Routine Hierarchical MCQ viewer modal state
  const [viewingHierarchyRoutine, setViewingHierarchyRoutine] = useState<Routine | null>(null);

  // Category Hierarchy editor state
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingNodeNewName, setEditingNodeNewName] = useState('');
  const [editingNodeNewParent, setEditingNodeNewParent] = useState('');
  const [editingNodeRootCat, setEditingNodeRootCat] = useState<string>('‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø');
  const [editingNodeParentChain, setEditingNodeParentChain] = useState<string[]>([]);
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
  const [moveDestCat, setMoveDestCat] = useState('‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø');
  const [moveDestSubcatChain, setMoveDestSubcatChain] = useState<string[]>([]);
  const [isAddingNewSubcatInline, setIsAddingNewSubcatInline] = useState(false);
  const [inlineNewSubcatName, setInlineNewSubcatName] = useState('');

  // Single Question Move Modal State
  const [singleMoveQ, setSingleMoveQ] = useState<Question | null>(null);
  const [singleMoveCat, setSingleMoveCat] = useState<string>('‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø');
  const [singleMoveSubcatChain, setSingleMoveSubcatChain] = useState<string[]>([]);

  // Subcategories Multiple Selection & Bulk Move/Delete State
  const [selectedSubcatIds, setSelectedSubcatIds] = useState<string[]>([]);
  const [bulkMoveDestCat, setBulkMoveDestCat] = useState<string>('‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø');
  const [bulkMoveDestSubcatChain, setBulkMoveDestSubcatChain] = useState<string[]>([]);

  // Category View Mode and Filter
  const [categoryViewTab, setCategoryViewTab] = useState<'tree' | 'leaf_nodes' | 'all_table' | 'hidden_nodes'>('tree');
  const [rootCategoryFilter, setRootCategoryFilter] = useState<'ALL' | 'subject' | 'job' | 'year'>('job');
  const [categorySearchQuery, setCategorySearchQuery] = useState('');

  // Add MCQ Form - Cascading Subcategory Chain
  const [addFormSubcatChain, setAddFormSubcatChain] = useState<string[]>([]);
  const [viewNodeQuestionsModal, setViewNodeQuestionsModal] = useState<{ nodeName: string; questions: Question[] } | null>(null);

  // Bulk Upload Destination - Cascading Filters
  const [uploadDestCat, setUploadDestCat] = useState('‡¶∏‡¶æ‡¶ß‡¶æ‡¶∞‡¶£ ‡¶ú‡ßç‡¶û‡¶æ‡¶®');
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
      confirmText: '‡¶†‡¶ø‡¶ï ‡¶Ü‡¶õ‡ßá',
      onConfirm: () => setCustomModal(prev => ({ ...prev, isOpen: false })),
    });
  };

  const showCustomConfirm = (
    title: string, 
    message: string, 
    onConfirm: () => void, 
    type: 'warning' | 'info' = 'warning',
    confirmText = '‡¶π‡ßç‡¶Ø‡¶æ‡¶Å, ‡¶®‡¶ø‡¶∂‡ßç‡¶ö‡¶ø‡¶§ ‡¶ï‡¶∞‡ßÅ‡¶®',
    cancelText = '‡¶¨‡¶æ‡¶§‡¶ø‡¶≤ ‡¶ï‡¶∞‡ßÅ‡¶®'
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
  
  const [manualFilterMainCat, setManualFilterMainCat] = useState('ALL'); // ALL, ‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø, ‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶® ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ
  const [manualSubcatFilterChain, setManualSubcatFilterChain] = useState<string[]>([]);
  const [manualSearchQuery, setManualSearchQuery] = useState('');
  const [activeSelectionTab, setActiveSelectionTab] = useState<string>('bangla');
  const [manualFilterSelectionStatus, setManualFilterSelectionStatus] = useState<'ALL' | 'SELECTED' | 'UNSELECTED'>('ALL');
  const [manualFilterRecommendationOnly, setManualFilterRecommendationOnly] = useState<boolean>(false);

  // Routine settings states & Cascading Topic Filters
  const [routineTitle, setRoutineTitle] = useState('');
  const [routineDetails, setRoutineDetails] = useState('');
  const [routineSelectedRootCategory, setRoutineSelectedRootCategory] = useState<string>('‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø');
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
    const rootCategoryNames = ['‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø', '‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶® ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ', '‡¶∏‡¶æ‡¶≤ ‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶®', '‡¶∏‡¶æ‡¶ß‡¶æ‡¶∞‡¶£ ‡¶ú‡ßç‡¶û‡¶æ‡¶®'];
    const catSet = new Set<string>([
      ...rootCategoryNames,
      ...STANDARD_SUBJECT_CATEGORIES,
      ...(categories || []).map(c => (c?.name || '').trim()),
      ...(subcategories || []).map(s => (s?.name || '').trim()),
      ...(questions || []).map(q => q?.category ? q.category.trim() : '').filter(Boolean)
    ]);
    return Array.from(catSet).filter(Boolean);
  }, [categories, subcategories, questions]);

  // Helper to find existing subcategory item in database dynamically by (parentCategory + name)
  const findSubcategoryInDatabase = (subName: string, parentCat?: string) => {
    if (!subName) return null;
    const normSub = normalizeName(subName);
    const normParent = parentCat ? normalizeName(parentCat) : '';

    // Primary: Check for exact (parentCategory + name) match
    if (normParent) {
      const exactMatch = subcategories.find(s => 
        s.parentCategory && 
        normalizeName(s.parentCategory) === normParent &&
        normalizeName(s.name) === normSub
      );
      if (exactMatch) return exactMatch;
    } else {
      const found = subcategories.find(s => normalizeName(s.name) === normSub);
      if (found) return found;
    }

    // Secondary: Check in questions subcategories
    if (normParent) {
      const qExact = questions.find(q => 
        q.subcategory && 
        normalizeName(q.subcategory) === normSub && 
        q.category && 
        normalizeName(q.category) === normParent
      );
      if (qExact && qExact.subcategory) {
        return { 
          id: `q-sub-${qExact.category}-${qExact.subcategory}`, 
          name: qExact.subcategory, 
          parentCategory: qExact.category 
        };
      }
    } else {
      const qFound = questions.find(q => q.subcategory && normalizeName(q.subcategory) === normSub);
      if (qFound && qFound.subcategory) {
        return { 
          id: `q-sub-${qFound.category || '‡¶∏‡¶æ‡¶ß‡¶æ‡¶∞‡¶£ ‡¶ú‡ßç‡¶û‡¶æ‡¶®'}-${qFound.subcategory}`, 
          name: qFound.subcategory, 
          parentCategory: qFound.category || '‡¶∏‡¶æ‡¶ß‡¶æ‡¶∞‡¶£ ‡¶ú‡ßç‡¶û‡¶æ‡¶®' 
        };
      }
    }
    return null;
  };

  // Hierarchy integrity validation before creating any subcategory
  const validateSubcategoryIntegrity = (
    subName: string, 
    parentCat: string, 
    existingList: SubcategoryItem[] = subcategories
  ): { valid: boolean; reason?: string } => {
    const trimmedSub = (subName || '').trim();
    const trimmedParent = (parentCat || '').trim();

    if (!trimmedSub) {
      return { valid: false, reason: '‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø‡¶∞ ‡¶®‡¶æ‡¶Æ ‡¶ñ‡¶æ‡¶≤‡¶ø ‡¶∞‡¶æ‡¶ñ‡¶æ ‡¶Ø‡¶æ‡¶¨‡ßá ‡¶®‡¶æ‡•§' };
    }
    if (!trimmedParent) {
      return { valid: false, reason: '‡¶™‡ßç‡¶Ø‡¶æ‡¶∞‡ßá‡¶®‡ßç‡¶ü ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶ñ‡¶æ‡¶≤‡¶ø ‡¶∞‡¶æ‡¶ñ‡¶æ ‡¶Ø‡¶æ‡¶¨‡ßá ‡¶®‡¶æ‡•§' };
    }

    const normSub = normalizeName(trimmedSub);
    const normParent = normalizeName(trimmedParent);

    // 1. Self-parenting check
    if (normSub === normParent) {
      return { valid: false, reason: `‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø "${trimmedSub}" ‡¶®‡¶ø‡¶ú‡ßá‡¶∞ ‡¶™‡ßç‡¶Ø‡¶æ‡¶∞‡ßá‡¶®‡ßç‡¶ü ‡¶π‡¶§‡ßá ‡¶™‡¶æ‡¶∞‡ßá ‡¶®‡¶æ‡•§` };
    }

    // 2. Reserved root categories check
    const reservedRoots = ['‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø', '‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶® ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ', '‡¶∏‡¶æ‡¶≤ ‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶®', '‡¶∏‡¶æ‡¶Æ‡ßç‡¶™‡ßç‡¶∞‡¶§‡¶ø‡¶ï ‡¶¨‡¶ø‡¶∑‡ßü‡¶æ‡¶¨‡¶≤‡ßÄ'];
    if (reservedRoots.some(r => normalizeName(r) === normSub)) {
      return { valid: false, reason: `‡¶Æ‡ßÇ‡¶≤ ‡¶∞‡ßÅ‡¶ü ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø "${trimmedSub}" ‡¶è‡¶∞ ‡¶®‡¶æ‡¶Æ‡ßá ‡¶ï‡ßã‡¶®‡ßã ‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶§‡ßà‡¶∞‡¶ø ‡¶ï‡¶∞‡¶æ ‡¶∏‡¶Æ‡ßç‡¶≠‡¶¨ ‡¶®‡ßü‡•§` };
    }

    // 3. Uniqueness check by parentCategory + name (NOT name alone)
    const alreadyExists = existingList.some(
      s => s.parentCategory && 
           normalizeName(s.parentCategory) === normParent &&
           normalizeName(s.name) === normSub
    );
    if (alreadyExists) {
      return { valid: false, reason: `"${trimmedParent}" ‡¶è‡¶∞ ‡¶Ö‡¶ß‡ßÄ‡¶®‡ßá "${trimmedSub}" ‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶á‡¶§‡¶ø‡¶Æ‡¶ß‡ßç‡¶Ø‡ßá ‡¶¨‡¶ø‡¶¶‡ßç‡¶Ø‡¶Æ‡¶æ‡¶®‡•§` };
    }

    // 4. Cycle prevention: parent must not be a descendant of subName
    let curr = trimmedParent;
    const visited = new Set<string>([normSub]);
    let limit = 20;
    while (curr && limit > 0) {
      const currNorm = normalizeName(curr);
      if (visited.has(currNorm)) {
        return { valid: false, reason: `‡¶ö‡¶ï‡ßç‡¶∞ ‡¶∏‡¶®‡¶æ‡¶ï‡ßç‡¶§ ‡¶π‡ßü‡ßá‡¶õ‡ßá: "${trimmedSub}" ‡¶è‡¶¨‡¶Ç "${trimmedParent}" ‡¶è‡¶∞ ‡¶Æ‡¶ß‡ßç‡¶Ø‡ßá ‡¶ö‡¶ï‡ßç‡¶∞‡¶æ‡¶ï‡¶æ‡¶∞ ‡¶π‡¶æ‡ßü‡¶æ‡¶∞‡¶æ‡¶∞‡ßç‡¶ï‡¶ø ‡¶§‡ßà‡¶∞‡¶ø ‡¶π‡¶¨‡ßá‡•§` };
      }
      visited.add(currNorm);
      const parentObj = existingList.find(s => normalizeName(s.name) === currNorm);
      if (parentObj && parentObj.parentCategory) {
        curr = parentObj.parentCategory;
      } else {
        break;
      }
      limit--;
    }

    return { valid: true };
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
    const rootFound = ['‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø', '‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶® ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ', '‡¶∏‡¶æ‡¶≤ ‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶®', '‡¶∏‡¶æ‡¶ß‡¶æ‡¶∞‡¶£ ‡¶ú‡ßç‡¶û‡¶æ‡¶®'].find(r => normalizeName(r) === norm);
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
          category: rawCat || '(‡¶´‡¶æ‡¶Å‡¶ï‡¶æ)',
          subcategory: rawSub || '(‡¶´‡¶æ‡¶Å‡¶ï‡¶æ)',
          issueType: 'category_missing',
          issueDescription: `‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø "${rawCat}" ‡¶°‡¶æ‡¶ü‡¶æ‡¶¨‡ßá‡¶∏‡ßá ‡¶®‡¶ø‡¶¨‡¶®‡ßç‡¶ß‡¶ø‡¶§ ‡¶®‡ßá‡¶á`
        });
      } else if (!subExists) {
        items.push({
          rowNum,
          questionText: q.text,
          category: rawCat || '‡¶∏‡¶æ‡¶ß‡¶æ‡¶∞‡¶£ ‡¶ú‡ßç‡¶û‡¶æ‡¶®',
          subcategory: rawSub,
          issueType: 'subcategory_missing',
          issueDescription: `‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø "${rawSub}" ‡¶°‡¶æ‡¶ü‡¶æ‡¶¨‡ßá‡¶∏‡ßá ‡¶®‡¶ø‡¶¨‡¶®‡ßç‡¶ß‡¶ø‡¶§ ‡¶®‡ßá‡¶á`
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
    const baseRoots = ['‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø', '‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶® ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ', '‡¶∏‡¶æ‡¶≤ ‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶®'];
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
          qRoots.add('‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶® ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ');
          return;
        }
        if (isYearJobSolutionVariation(clean)) {
          qRoots.add('‡¶∏‡¶æ‡¶≤ ‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶®');
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
            qRoots.add('‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶® ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ');
            return;
          }
          if (isYearJobSolutionVariation(parent)) {
            qRoots.add('‡¶∏‡¶æ‡¶≤ ‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶®');
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
    '‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø',
    '‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶® ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ',
    '‡¶∏‡¶æ‡¶≤ ‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶®'
  ], []);

  // 2. Computed Categories dynamically based on selected Root Category (Step 1 -> Step 2)
  const routineAvailableCategories = useMemo(() => {
    if (!routineSelectedRootCategory) {
      return [];
    }

    const normRoot = normalizeName(routineSelectedRootCategory);
    const catMap = new Map<string, number>();

    if (normRoot === normalizeName('‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø') || normRoot === normalizeName('‡¶¨‡¶ø‡¶∑‡ßü ‡¶≠‡¶ø‡¶ï‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø')) {
      // Collect standard subject categories and any subcategories whose parentCategory is '‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø' or default subjects
      const knownSubjects = new Set<string>(STANDARD_SUBJECT_CATEGORIES);
      subcategories.forEach(s => {
        if (s.parentCategory === '‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø' || s.parentCategory === '‡¶¨‡¶ø‡¶∑‡ßü ‡¶≠‡¶ø‡¶ï‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø' || (!s.parentCategory && !isJobSolutionVariation(s.name) && !isYearJobSolutionVariation(s.name))) {
          knownSubjects.add(s.name.trim());
        }
      });
      categories.forEach(c => {
        if (!isJobSolutionVariation(c.name) && !isYearJobSolutionVariation(c.name) && c.name !== '‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø' && c.name !== '‡¶¨‡¶ø‡¶∑‡ßü ‡¶≠‡¶ø‡¶ï‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø') {
          knownSubjects.add(c.name.trim());
        }
      });

      knownSubjects.forEach(subjectName => {
        if (!subjectName || isJobSolutionVariation(subjectName) || isYearJobSolutionVariation(subjectName)) return;
        const subLower = subjectName.toLowerCase();
        const count = subcategoryDescendantsCountMap.get(subLower) || nodeQuestionCountMap.get(subLower) || 0;
        catMap.set(subjectName, count);
      });
    } else if (normRoot === normalizeName('‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶® ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ') || isJobSolutionVariation(routineSelectedRootCategory)) {
      // Collect job solution categories (BCS, Primary, NTRCA, Bank, etc.)
      const jobCats = new Set<string>();
      subcategories.forEach(s => {
        if (isJobSolutionVariation(s.parentCategory || '') || s.parentCategory === '‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶® ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ' || s.parentCategory === '‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶®') {
          jobCats.add(s.name.trim());
        }
      });

      if (jobCats.size === 0) {
        // Fallback common job solution categories
        ['‡¶¨‡¶ø‡¶∏‡¶ø‡¶è‡¶∏ ‡¶™‡ßç‡¶∞‡¶ø‡¶≤‡¶ø‡¶Æ‡¶ø‡¶®‡¶æ‡¶∞‡¶ø', '‡¶™‡ßç‡¶∞‡¶æ‡¶•‡¶Æ‡¶ø‡¶ï ‡¶∏‡¶π‡¶ï‡¶æ‡¶∞‡ßÄ ‡¶∂‡¶ø‡¶ï‡ßç‡¶∑‡¶ï ‡¶®‡¶ø‡ßü‡ßã‡¶ó', '‡¶è‡¶®‡¶ü‡¶ø‡¶Ü‡¶∞‡¶∏‡¶ø‡¶è (NTRCA)', '‡¶¨‡ßç‡¶Ø‡¶æ‡¶Ç‡¶ï ‡¶®‡¶ø‡ßü‡ßã‡¶ó ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ', '‡¶™‡¶ø‡¶è‡¶∏‡¶∏‡¶ø ‡¶ì ‡¶Ö‡¶®‡ßç‡¶Ø‡¶æ‡¶®‡ßç‡¶Ø ‡¶®‡¶®-‡¶ï‡ßç‡¶Ø‡¶æ‡¶°‡¶æ‡¶∞', '‡¶Æ‡¶®‡ßç‡¶§‡ßç‡¶∞‡¶£‡¶æ‡¶≤‡ßü ‡¶ì ‡¶Ö‡¶ß‡¶ø‡¶¶‡¶™‡ßç‡¶§‡¶∞', '‡¶∞‡ßá‡¶≤‡¶ì‡ßü‡ßá ‡¶®‡¶ø‡ßü‡ßã‡¶ó ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ', '‡¶Ö‡¶®‡ßç‡¶Ø‡¶æ‡¶®‡ßç‡¶Ø ‡¶∏‡¶∞‡¶ï‡¶æ‡¶∞‡¶ø ‡¶ì ‡¶∏‡ßç‡¶¨‡¶æ‡ßü‡¶§‡ßç‡¶§‡¶∂‡¶æ‡¶∏‡¶ø‡¶§ ‡¶™‡ßç‡¶∞‡¶§‡¶ø‡¶∑‡ßç‡¶†‡¶æ‡¶®'].forEach(j => jobCats.add(j));
      }

      jobCats.forEach(catName => {
        const catLower = catName.toLowerCase();
        const count = subcategoryDescendantsCountMap.get(catLower) || nodeQuestionCountMap.get(catLower) || 0;
        catMap.set(catName, count);
      });
    } else if (normRoot === normalizeName('‡¶∏‡¶æ‡¶≤ ‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶®') || isYearJobSolutionVariation(routineSelectedRootCategory)) {
      // Collect year categories
      const yearCats = new Set<string>();
      subcategories.forEach(s => {
        if (isYearJobSolutionVariation(s.parentCategory || '') || s.parentCategory === '‡¶∏‡¶æ‡¶≤ ‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶®' || isYearJobSolutionVariation(s.name)) {
          yearCats.add(s.name.trim());
        }
      });

      if (yearCats.size === 0) {
        ['‡ß®‡ß¶‡ß®‡ß™', '‡ß®‡ß¶‡ß®‡ß©', '‡ß®‡ß¶‡ß®‡ß®', '‡ß®‡ß¶‡ß®‡ßß', '‡ß®‡ß¶‡ß®‡ß¶', '‡ß®‡ß¶‡ßß‡ßØ', '‡ß®‡ß¶‡ßß‡ßÆ', '‡ß®‡ß¶‡ßß‡ß≠', '‡ß®‡ß¶‡ßß‡ß¨', '‡ß®‡ß¶‡ßß‡ß´'].forEach(y => yearCats.add(y));
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
    setCategory(categories[0]?.name || '‡¶∏‡¶æ‡¶ß‡¶æ‡¶∞‡¶£ ‡¶ú‡ßç‡¶û‡¶æ‡¶®');
    setSubcategory('');
    setSelectedCategories([categories[0]?.name || '‡¶∏‡¶æ‡¶ß‡¶æ‡¶∞‡¶£ ‡¶ú‡ßç‡¶û‡¶æ‡¶®']);
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

  // Helper to initialize editing of a subcategory node with cascading parent path
  const startEditSubcategory = (sub: SubcategoryItem) => {
    setEditingNodeId(sub.id);
    setEditingNodeNewName(sub.name);
    setEditingNodeSubHeading(sub.subHeading || '');
    setEditingNodeDate(sub.date || '');
    setEditingNodeType('subcategory');
    setAddingChildUnderNodeId(null);

    const parentName = sub.parentCategory ? sub.parentCategory.trim() : '';
    if (parentName) {
      if (
        parentName === '‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø' ||
        parentName === '‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶® ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ' ||
        parentName === '‡¶∏‡¶æ‡¶≤ ‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶®' ||
        parentName === '‡¶∏‡¶æ‡¶Æ‡ßç‡¶™‡ßç‡¶∞‡¶§‡¶ø‡¶ï ‡¶¨‡¶ø‡¶∑‡ßü‡¶æ‡¶¨‡¶≤‡ßÄ' ||
        isJobSolutionVariation(parentName) ||
        isYearJobSolutionVariation(parentName) ||
        isCurrentAffairVariation(parentName)
      ) {
        setEditingNodeRootCat(parentName);
        setEditingNodeParentChain([]);
      } else {
        const path = findSubcategoryPath(parentName);
        const rootZ = getRootZoneForSubcategory(parentName);
        let rCat = '‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø';
        if (rootZ === 'job') rCat = '‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶® ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ';
        else if (rootZ === 'year') rCat = '‡¶∏‡¶æ‡¶≤ ‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶®';
        setEditingNodeRootCat(rCat);
        setEditingNodeParentChain(path);
      }
    } else {
      setEditingNodeRootCat('‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø');
      setEditingNodeParentChain([]);
    }
  };

  // Execute single subcategory merge into an existing destination folder
  const executeSingleMergeAndMove = (
    sourceId: string,
    sourceSub: SubcategoryItem,
    destSub: SubcategoryItem,
    destParent: string,
    newName: string,
    newSubHeading?: string,
    newDate?: string
  ) => {
    const oldName = sourceSub.name;
    const targetName = destSub.name;

    // 1. Move/Repoint all questions belonging to sourceSub to destSub & destParent
    questions.forEach(q => {
      let updatedQ: Partial<Question> = {};
      let changed = false;

      if (q.subcategory === oldName) {
        updatedQ.subcategory = targetName;
        changed = true;
      }
      if (q.subcategories && q.subcategories.includes(oldName)) {
        updatedQ.subcategories = q.subcategories.map(s => s === oldName ? targetName : s);
        changed = true;
      }
      if (q.category === oldName) {
        updatedQ.category = destParent;
        changed = true;
      }
      if (q.categories && q.categories.includes(oldName)) {
        updatedQ.categories = q.categories.map(c => c === oldName ? destParent : c);
        changed = true;
      }

      if (changed && onUpdateQuestion) {
        onUpdateQuestion(q.id, updatedQ);
      }
    });

    // 2. Repoint any child subcategories whose parentCategory was oldName to targetName
    if (oldName !== targetName) {
      subcategories.forEach(s => {
        if (s.parentCategory === oldName && onUpdateSubcategory) {
          onUpdateSubcategory(s.id, s.name, targetName, s.date, s.subHeading, s.text);
        }
      });
    }

    // 3. Update targetSub metadata if needed
    if ((newSubHeading && !destSub.subHeading) || (newDate && !destSub.date)) {
      if (onUpdateSubcategory) {
        onUpdateSubcategory(
          destSub.id,
          destSub.name,
          destSub.parentCategory,
          destSub.date || newDate,
          destSub.subHeading || newSubHeading,
          destSub.text
        );
      }
    }

    // 4. Delete source duplicate subcategory
    if (onDeleteSubcategory) {
      onDeleteSubcategory(sourceId);
    }

    showCustomAlert(
      '‡¶Æ‡¶æ‡¶∞‡ßç‡¶ú ‡¶∏‡¶Æ‡ßç‡¶™‡¶®‡ßç‡¶® ‡¶π‡ßü‡ßá‡¶õ‡ßá!',
      `"${oldName}" ‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶∏‡¶´‡¶≤‡¶≠‡¶æ‡¶¨‡ßá "${destParent}" ‡¶è‡¶∞ ‡¶¨‡¶ø‡¶¶‡ßç‡¶Ø‡¶Æ‡¶æ‡¶® "${targetName}" ‡¶´‡ßã‡¶≤‡ßç‡¶°‡¶æ‡¶∞‡ßá‡¶∞ ‡¶∏‡¶æ‡¶•‡ßá ‡¶Æ‡¶æ‡¶∞‡ßç‡¶ú ‡¶ï‡¶∞‡¶æ ‡¶π‡ßü‡ßá‡¶õ‡ßá ‡¶è‡¶¨‡¶Ç ‡¶è‡¶∞ ‡¶Ü‡¶ì‡¶§‡¶æ‡¶ß‡ßÄ‡¶® ‡¶∏‡¶ï‡¶≤ MCQ ‡¶Ø‡ßÅ‡¶ï‡ßç‡¶§ ‡¶π‡ßü‡ßá‡¶õ‡ßá‡•§`,
      'success'
    );
  };

  // Execute bulk merge and move
  const executeBulkMergeAndMove = (
    duplicates: { sourceSub: SubcategoryItem; targetSub: SubcategoryItem }[],
    nonDuplicates: SubcategoryItem[],
    destParent: string
  ) => {
    // 1. Process each duplicate merge
    duplicates.forEach(({ sourceSub, targetSub }) => {
      const oldName = sourceSub.name;
      const targetName = targetSub.name;

      // Repoint questions
      questions.forEach(q => {
        let updatedQ: Partial<Question> = {};
        let changed = false;

        if (q.subcategory === oldName) {
          updatedQ.subcategory = targetName;
          changed = true;
        }
        if (q.subcategories && q.subcategories.includes(oldName)) {
          updatedQ.subcategories = q.subcategories.map(s => s === oldName ? targetName : s);
          changed = true;
        }
        if (q.category === oldName) {
          updatedQ.category = destParent;
          changed = true;
        }
        if (q.categories && q.categories.includes(oldName)) {
          updatedQ.categories = q.categories.map(c => c === oldName ? destParent : c);
          changed = true;
        }

        if (changed && onUpdateQuestion) {
          onUpdateQuestion(q.id, updatedQ);
        }
      });

      // Repoint children if oldName was different
      if (oldName !== targetName) {
        subcategories.forEach(s => {
          if (s.parentCategory === oldName && onUpdateSubcategory) {
            onUpdateSubcategory(s.id, s.name, targetName, s.date, s.subHeading, s.text);
          }
        });
      }

      // Delete duplicate source subcategory
      if (onDeleteSubcategory) {
        onDeleteSubcategory(sourceSub.id);
      }
    });

    // 2. Move non-duplicates
    if (nonDuplicates.length > 0 && onBulkMoveSubcategories) {
      onBulkMoveSubcategories(nonDuplicates.map(s => s.id), destParent);
    }

    // 3. Clear selections & notify
    setSelectedSubcatIds([]);
    const totalCount = duplicates.length + nonDuplicates.length;
    showCustomAlert(
      '‡¶∏‡¶Æ‡ßç‡¶™‡¶®‡ßç‡¶®!',
      `‡¶Æ‡ßã‡¶ü ${totalCount}‡¶ü‡¶ø ‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø (${duplicates.length}‡¶ü‡¶ø ‡¶Æ‡¶æ‡¶∞‡ßç‡¶ú‡¶ï‡ßÉ‡¶§, ${nonDuplicates.length}‡¶ü‡¶ø ‡¶∏‡ßç‡¶•‡¶æ‡¶®‡¶æ‡¶®‡ßç‡¶§‡¶∞‡¶ø‡¶§) ‡¶∏‡¶´‡¶≤‡¶≠‡¶æ‡¶¨‡ßá "${destParent}" ‡¶è ‡¶Ü‡¶™‡¶°‡ßá‡¶ü ‡¶ï‡¶∞‡¶æ ‡¶π‡ßü‡ßá‡¶õ‡ßá!`,
      'success'
    );
  };

  // Reusable Cascading Hierarchy Selector for Move operations
  const renderCascadingMoveSelector = (
    currentRootCat: string,
    onRootCatChange: (newRoot: string) => void,
    currentChain: string[],
    onChainChange: (newChain: string[]) => void,
    excludedIds: string[] = [],
    excludedNames: string[] = [],
    compactLayout = false
  ) => {
    const rootOptions = [
      '‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø',
      '‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶® ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ',
      '‡¶∏‡¶æ‡¶≤ ‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶®',
      '‡¶∏‡¶æ‡¶Æ‡ßç‡¶™‡ßç‡¶∞‡¶§‡¶ø‡¶ï ‡¶¨‡¶ø‡¶∑‡ßü‡¶æ‡¶¨‡¶≤‡ßÄ',
      ...(categories || []).map(c => c?.name).filter(Boolean)
    ].filter((name, idx, arr) => arr.indexOf(name) === idx);

    // Compute excluded normalized names (self + all recursive descendants)
    const excludedSet = new Set<string>();
    excludedNames.forEach(n => {
      if (n) {
        excludedSet.add(n.trim().toLowerCase());
        getSubcategoryDescendants(n).forEach(d => excludedSet.add(d.trim().toLowerCase()));
      }
    });

    const selectBoxes: React.ReactNode[] = [];
    const maxDepth = currentChain.length;

    for (let i = 0; i <= maxDepth; i++) {
      let options: SubcategoryItem[] = [];

      if (i === 0) {
        if (isJobSolutionVariation(currentRootCat)) {
          options = subcategories.filter(s => isJobSolutionVariation(s.parentCategory));
        } else if (isYearJobSolutionVariation(currentRootCat)) {
          options = subcategories.filter(s => isYearJobSolutionVariation(s.parentCategory));
        } else if (isCurrentAffairVariation(currentRootCat)) {
          options = subcategories.filter(s => isCurrentAffairVariation(s.parentCategory));
        } else {
          options = subcategories.filter(s => s.parentCategory === currentRootCat);
        }
      } else {
        const parentVal = currentChain[i - 1];
        if (parentVal && parentVal !== 'ALL') {
          options = subcategories.filter(s => s.parentCategory === parentVal);
        }
      }

      // Filter out excluded nodes and their descendants to prevent circular movement
      options = options.filter(s => 
        !excludedIds.includes(s.id) && 
        !excludedSet.has(s.name.trim().toLowerCase())
      );

      if (options.length === 0) continue;

      const currentSelection = currentChain[i] || 'ALL';

      selectBoxes.push(
        <div key={`cascade-move-level-${i}`} className="flex flex-col gap-0.5 min-w-[130px]">
          <label className="block text-[9px] text-slate-500 font-bold">
            {i === 0 ? '‡¶â‡¶™-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø (‡¶ß‡¶æ‡¶™ ‡ßß):' : `‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶ß‡¶æ‡¶™ ${i + 1}:`}
          </label>
          <select
            value={currentSelection}
            onChange={e => {
              const val = e.target.value;
              const newChain = [...currentChain];
              if (val === 'ALL') {
                newChain.splice(i);
              } else {
                newChain[i] = val;
                newChain.splice(i + 1);
              }
              onChainChange(newChain);
            }}
            className={`px-2 py-1.5 text-[11px] border border-slate-300 rounded-lg bg-white font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 ${compactLayout ? 'w-full' : 'w-full'}`}
          >
            <option value="ALL">--- ‡¶∏‡¶ø‡¶≤‡ßá‡¶ï‡ßç‡¶ü ‡¶ï‡¶∞‡ßÅ‡¶® (‡¶ê‡¶ö‡ßç‡¶õ‡¶ø‡¶ï) ---</option>
            {options.map(s => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </select>
        </div>
      );
    }

    const activeChain = currentChain.filter(s => s && s !== 'ALL');
    const destinationParent = activeChain.length > 0 ? activeChain[activeChain.length - 1] : currentRootCat;

    return (
      <div className={`space-y-2 ${compactLayout ? 'bg-amber-50/60 p-2.5 rounded-xl border border-amber-200/90' : ''}`}>
        <div className={`flex ${compactLayout ? 'flex-wrap items-end' : 'flex-col'} gap-2`}>
          <div className="flex flex-col gap-0.5 min-w-[140px]">
            <label className="block text-[9px] text-slate-500 font-bold">‡¶Æ‡ßÇ‡¶≤ ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø (‡¶∞‡ßÅ‡¶ü ‡¶ú‡ßã‡¶®):</label>
            <select
              value={currentRootCat}
              onChange={e => {
                onRootCatChange(e.target.value);
                onChainChange([]);
              }}
              className="px-2 py-1.5 text-[11px] border border-slate-300 rounded-lg bg-white font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 w-full"
            >
              {rootOptions.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {selectBoxes}
        </div>

        <div className="flex items-center gap-1.5 text-[10px] text-amber-950 font-bold bg-amber-100/70 px-2 py-1 rounded-md border border-amber-250">
          <span className="text-amber-800 shrink-0">üéØ ‡¶®‡¶ø‡¶∞‡ßç‡¶¨‡¶æ‡¶ö‡¶ø‡¶§ ‡¶®‡¶§‡ßÅ‡¶® ‡¶™‡ßç‡¶Ø‡¶æ‡¶∞‡ßá‡¶®‡ßç‡¶ü:</span>
          <span className="text-indigo-900 font-extrabold bg-white px-1.5 py-0.5 rounded shadow-2xs">
            {destinationParent}
          </span>
          {activeChain.length > 0 && (
            <span className="text-[9px] text-gray-500 truncate max-w-[240px]">
              ({currentRootCat} ‚ûî {activeChain.join(' ‚ûî ')})
            </span>
          )}
        </div>
      </div>
    );
  };

  // Recursive Tree Node Renderer for Hierarchy Tab
  const renderTreeNode = (
    name: string, 
    id: string, 
    type: 'category' | 'subcategory', 
    depth: number,
    visitedIds: Set<string> = new Set()
  ): React.ReactNode => {
    // Resolve true subcategory/category entity strictly using unique ID first
    const targetSub = type === 'subcategory' 
      ? (id ? subcategories.find(s => s.id === id) : subcategories.find(s => s.name.trim().toLowerCase() === name.trim().toLowerCase()))
      : undefined;
    const targetCat = type === 'category' 
      ? (id ? categories.find(c => c.id === id) : categories.find(c => c.name.trim().toLowerCase() === name.trim().toLowerCase()))
      : undefined;
    const realEntityId = id || (targetSub ? targetSub.id : targetCat ? targetCat.id : `node-${name}`);

    // Avoid circular loops / stack overflows by tracking unique IDs
    if (visitedIds.has(realEntityId)) {
      return (
        <div 
          key={`loop-${id || realEntityId}`}
          style={{ paddingLeft: `${Math.max(12, depth * 16)}px` }}
          className="p-2.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold"
        >
          ‚ö†Ô∏è ‡¶ö‡¶ï‡ßç‡¶∞ ‡¶∏‡¶®‡¶æ‡¶ï‡ßç‡¶§ ‡¶π‡ßü‡ßá‡¶õ‡ßá (Loop detected): "{name}" ‡¶è‡¶∞ ‡¶â‡¶™‡¶∞‡ßã‡¶ï‡ßç‡¶§ ‡¶™‡ßç‡¶Ø‡¶æ‡¶∞‡ßá‡¶®‡ßç‡¶ü‡ßá‡¶∞ ‡¶∏‡¶æ‡¶•‡ßá ‡¶ö‡¶ï‡ßç‡¶∞‡¶æ‡¶ï‡¶æ‡¶∞ ‡¶∏‡¶Æ‡ßç‡¶™‡¶∞‡ßç‡¶ï ‡¶∞‡ßü‡ßá‡¶õ‡ßá‡•§
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
      s.id !== realEntityId &&
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
              title="‡¶Æ‡¶æ‡¶≤‡ßç‡¶ü‡¶ø‡¶™‡¶≤ ‡¶∏‡¶ø‡¶≤‡ßá‡¶ï‡ßç‡¶ü ‡¶ï‡¶∞‡ßÅ‡¶®"
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
                title={isCollapsed ? '‡¶™‡ßç‡¶∞‡¶∏‡¶æ‡¶∞‡¶ø‡¶§ ‡¶ï‡¶∞‡ßÅ‡¶® (Expand)' : '‡¶∏‡¶Ç‡¶ï‡ßÅ‡¶ö‡¶ø‡¶§ ‡¶ï‡¶∞‡ßÅ‡¶® (Collapse)'}
              >
                {isCollapsed ? (
                  <ChevronRight className="w-4 h-4 text-indigo-600 font-bold" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-indigo-600 font-bold" />
                )}
              </button>
            ) : (
              <span className="w-5 h-5 flex items-center justify-center text-slate-300 text-[10px] shrink-0 font-bold">
                ‚îî
              </span>
            )}

            <span className="text-sm shrink-0">
              {type === 'category' ? 'üìö' : isMultiItemContainer ? 'üì¶' : hasChildren ? (isCollapsed ? 'üìÅ' : 'üìÇ') : 'üçÉ'}
            </span>

            <div className="flex flex-col gap-0.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="font-bold text-slate-800 text-xs hover:text-indigo-600 transition">{name}</span>

                {/* Total Question Count Badge */}
                <span className="bg-slate-100 text-slate-700 font-extrabold text-[9px] px-1.5 py-0.5 rounded-md border border-slate-200">
                  üìä {qCount} ‡¶ü‡¶ø ‡¶Æ‡ßã‡¶ü ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶®
                </span>

                {/* Direct Questions Badge */}
                {directQuestions.length > 0 && (
                  <span className="bg-purple-100 text-purple-800 font-extrabold text-[9px] px-1.5 py-0.5 rounded-md border border-purple-200">
                    ‚ùì {directQuestions.length} ‡¶ü‡¶ø ‡¶∏‡¶∞‡¶æ‡¶∏‡¶∞‡¶ø MCQ
                  </span>
                )}

                {/* Branch Sub-folders Badge */}
                {branchChildren.length > 0 && (
                  <span className="bg-blue-100 text-blue-800 font-extrabold text-[9px] px-1.5 py-0.5 rounded-md border border-blue-200">
                    üìÅ {branchChildren.length} ‡¶ü‡¶ø ‡¶´‡ßã‡¶≤‡ßç‡¶°‡¶æ‡¶∞
                  </span>
                )}

                {/* Leaf Nodes Badge */}
                {leafChildren.length > 0 && (
                  <span className="bg-emerald-100 text-emerald-800 font-extrabold text-[9px] px-1.5 py-0.5 rounded-md border border-emerald-200">
                    üçÉ {leafChildren.length} ‡¶ü‡¶ø ‡¶≤‡¶ø‡¶´ ‡¶®‡ßã‡¶°
                  </span>
                )}

                {/* Multi-Item Container Tag */}
                {isMultiItemContainer && (
                  <span className="bg-amber-100 text-amber-900 font-black text-[8.5px] px-2 py-0.5 rounded-md border border-amber-300 shadow-2xs flex items-center gap-0.5">
                    üîÄ ‡¶Æ‡¶æ‡¶≤‡ßç‡¶ü‡¶ø-‡¶Ü‡¶á‡¶ü‡ßá‡¶Æ ‡¶ï‡¶®‡ßç‡¶ü‡ßá‡¶á‡¶®‡¶æ‡¶∞ (Folder + MCQ)
                  </span>
                )}

                {/* Pure Leaf Node Tag */}
                {!hasChildren && type === 'subcategory' && (
                  <span className="bg-emerald-100 text-emerald-800 font-black text-[9px] px-2 py-0.5 rounded-md border border-emerald-300 shadow-2xs flex items-center gap-1">
                    üçÉ ‡¶≤‡¶ø‡¶´ ‡¶®‡ßã‡¶° (Leaf Category)
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
                    ‚ñ∂ +{children.length} ‡¶ü‡¶ø ‡¶â‡¶™-‡¶ß‡¶æ‡¶™
                  </button>
                )}
              </div>

              {(targetSub?.subHeading || targetCat?.subHeading) && (
                <div className="text-[10px] text-indigo-700 font-bold flex items-center gap-1">
                  <span>üè∑Ô∏è Sub-heading:</span> {targetSub?.subHeading || targetCat?.subHeading}
                </div>
              )}

              {targetSub && (
                <div className="flex items-center gap-1.5 text-[10px] bg-emerald-50/90 px-2 py-0.5 rounded-md border border-emerald-200/90 shrink-0 flex-wrap">
                  <Calendar className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span className="font-bold text-emerald-900 truncate">
                    {targetSub.date ? formatBengaliDate(targetSub.date) : '‡¶§‡¶æ‡¶∞‡¶ø‡¶ñ ‡¶¶‡ßá‡¶ì‡ßü‡¶æ ‡¶π‡ßü‡¶®‡¶ø'}
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
                    title="‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ‡¶∞ ‡¶§‡¶æ‡¶∞‡¶ø‡¶ñ ‡¶™‡¶∞‡¶ø‡¶¨‡¶∞‡ßç‡¶§‡¶®/‡¶∏‡¶Æ‡ßç‡¶™‡¶æ‡¶¶‡¶®‡¶æ ‡¶ï‡¶∞‡ßÅ‡¶®"
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
              title="‡¶®‡¶§‡ßÅ‡¶® ‡¶â‡¶™-‡¶ß‡¶æ‡¶™ ‡¶Ø‡ßã‡¶ó ‡¶ï‡¶∞‡ßÅ‡¶®"
            >
              ‚ûï ‡¶∏‡¶æ‡¶¨-‡¶ß‡¶æ‡¶™
            </button>
            <button
              type="button"
              onClick={() => {
                if (type === 'subcategory') {
                  const sub = targetSub || subcategories.find(s => s.id === realEntityId);
                  if (sub) {
                    startEditSubcategory(sub);
                  } else {
                    setEditingNodeId(realEntityId);
                    setEditingNodeNewName(name);
                    setEditingNodeType('subcategory');
                    setEditingNodeRootCat('‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø');
                    setEditingNodeParentChain([]);
                  }
                } else {
                  setEditingNodeId(realEntityId);
                  setEditingNodeNewName(name);
                  const cat = targetCat || categories.find(c => c.id === realEntityId);
                  setEditingNodeSubHeading(cat?.subHeading || '');
                  setEditingNodeType('category');
                }
              }}
              className="text-amber-600 hover:text-amber-850 hover:bg-amber-50 px-1.5 py-1 rounded-md transition text-[10px] font-bold flex items-center gap-0.5 cursor-pointer"
              title="‡¶∏‡¶Æ‡ßç‡¶™‡¶æ‡¶¶‡¶®‡¶æ ‡¶¨‡¶æ ‡¶Æ‡ßÅ‡¶≠ ‡¶ï‡¶∞‡ßÅ‡¶®"
            >
              ‚úèÔ∏è ‡¶è‡¶°‡¶ø‡¶ü/‡¶Æ‡ßÅ‡¶≠
            </button>
            <button
              type="button"
              onClick={() => {
                showCustomConfirm(
                  '‡¶°‡¶ø‡¶≤‡¶ø‡¶ü ‡¶®‡¶ø‡¶∂‡ßç‡¶ö‡¶ø‡¶§‡¶ï‡¶∞‡¶£',
                  `‡¶Ü‡¶™‡¶®‡¶ø ‡¶ï‡¶ø ‡¶®‡¶ø‡¶∂‡ßç‡¶ö‡¶ø‡¶§‡¶≠‡¶æ‡¶¨‡ßá "${name}" ${type === 'category' ? '‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø' : '‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø'} ‡¶è‡¶¨‡¶Ç ‡¶è‡¶∞ ‡¶Ü‡¶ì‡¶§‡¶æ‡¶ß‡ßÄ‡¶® ‡¶®‡ßã‡¶° ‡¶Æ‡ßÅ‡¶õ‡ßá ‡¶´‡ßá‡¶≤‡¶§‡ßá ‡¶ö‡¶æ‡¶®?`,
                  () => {
                    if (type === 'category' && onDeleteCategory) {
                      onDeleteCategory(realEntityId);
                    } else if (type === 'subcategory' && onDeleteSubcategory) {
                      onDeleteSubcategory(realEntityId);
                    }
                  },
                  'warning',
                  '‡¶Æ‡ßÅ‡¶õ‡ßá ‡¶´‡ßá‡¶≤‡ßÅ‡¶®',
                  '‡¶¨‡¶æ‡¶§‡¶ø‡¶≤'
                );
              }}
              className="text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-1.5 py-1 rounded-md transition text-[10px] font-bold flex items-center gap-0.5 cursor-pointer"
              title="‡¶Æ‡ßÅ‡¶õ‡ßá ‡¶´‡ßá‡¶≤‡ßÅ‡¶®"
            >
              ‚ùå ‡¶Æ‡ßÅ‡¶õ‡ßÅ‡¶®
            </button>
          </div>
        </div>

        {/* Inline editor panel */}
        {isEditing && (
          <div 
            style={{ marginLeft: `${Math.max(12, depth * 16 + 12)}px` }} 
            className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 shadow-sm flex flex-col gap-3 animate-fade-in text-xs max-w-lg w-full"
          >
            <h5 className="font-extrabold text-amber-900 text-[10px] uppercase tracking-wider flex items-center gap-1">
              ‚úèÔ∏è "{name}" ‡¶è‡¶°‡¶ø‡¶ü ‡¶ì ‡¶™‡¶ú‡¶ø‡¶∂‡¶® ‡¶∏‡ßç‡¶•‡¶æ‡¶®‡¶æ‡¶®‡ßç‡¶§‡¶∞ (Move Node)
            </h5>
            
            <div className="flex flex-col gap-2.5">
              <div>
                <label className="block text-[10px] text-amber-950 font-bold mb-1">‡¶®‡¶§‡ßÅ‡¶® ‡¶®‡¶æ‡¶Æ:</label>
                <input 
                  type="text"
                  value={editingNodeNewName}
                  onChange={e => setEditingNodeNewName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-amber-300 rounded-lg bg-white text-gray-850 font-semibold focus:outline-none text-[11px]"
                />
              </div>

              <div>
                <label className="block text-[10px] text-amber-950 font-bold mb-1">‡¶∏‡¶æ‡¶¨-‡¶π‡ßá‡¶°‡¶ø‡¶Ç / ‡¶∏‡¶æ‡¶¨-‡¶ü‡¶æ‡¶á‡¶ü‡ßá‡¶≤ (Sub Heading):</label>
                <input 
                  type="text"
                  value={editingNodeSubHeading}
                  onChange={e => setEditingNodeSubHeading(e.target.value)}
                  placeholder="‡¶Ø‡ßá‡¶Æ‡¶®: ‡ß©‡¶Ø‡¶º ‡¶ì ‡ß™‡¶∞‡ßç‡¶• ‡¶∂‡ßç‡¶∞‡ßá‡¶£‡ßÄ‡¶∞ ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø / ‡¶Ö‡¶ß‡ßç‡¶Ø‡¶æ‡¶Ø‡¶º‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶∂‡¶∞‡ßç‡¶ü‡¶ï‡¶æ‡¶ü"
                  className="w-full px-3 py-1.5 border border-amber-300 rounded-lg bg-white text-gray-850 font-semibold focus:outline-none text-[11px]"
                />
              </div>

              {type === 'subcategory' && (
                <div>
                  <label className="block text-[10px] text-amber-950 font-bold mb-1">üìÖ ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ‡¶∞ ‡¶§‡¶æ‡¶∞‡¶ø‡¶ñ (Date):</label>
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
                  <label className="block text-[10px] text-amber-950 font-bold mb-1">
                    ‡¶™‡ßç‡¶Ø‡¶æ‡¶∞‡ßá‡¶®‡ßç‡¶ü ‡¶®‡¶ø‡¶∞‡ßç‡¶¨‡¶æ‡¶ö‡¶® ‡¶ì ‡¶∏‡ßç‡¶•‡¶æ‡¶®‡¶æ‡¶®‡ßç‡¶§‡¶∞ (Hierarchical Cascading Selector):
                  </label>
                  {renderCascadingMoveSelector(
                    editingNodeRootCat,
                    setEditingNodeRootCat,
                    editingNodeParentChain,
                    setEditingNodeParentChain,
                    [realEntityId],
                    [name, ...(targetSub ? getSubcategoryDescendants(targetSub.name) : getSubcategoryDescendants(name))],
                    false
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (type === 'category') {
                      if (onUpdateCategory) {
                        onUpdateCategory(realEntityId, editingNodeNewName, editingNodeSubHeading);
                      }
                      setEditingNodeId(null);
                    } else {
                      const activeChain = editingNodeParentChain.filter(s => s && s !== 'ALL');
                      const destinationParent = activeChain.length > 0 ? activeChain[activeChain.length - 1] : editingNodeRootCat;
                      const trimmedNewName = editingNodeNewName.trim();

                      if (!trimmedNewName) {
                        showCustomAlert('‡¶§‡ßç‡¶∞‡ßÅ‡¶ü‡¶ø', '‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø‡¶∞ ‡¶®‡¶æ‡¶Æ ‡¶ñ‡¶æ‡¶≤‡¶ø ‡¶π‡¶§‡ßá ‡¶™‡¶æ‡¶∞‡ßá ‡¶®‡¶æ!', 'warning');
                        return;
                      }

                      const sub = targetSub || subcategories.find(s => s.id === realEntityId);
                      const excludedNames = new Set([
                        trimmedNewName.toLowerCase(),
                        name.toLowerCase(),
                        ...(sub ? getSubcategoryDescendants(sub.name).map(d => d.toLowerCase()) : [])
                      ]);

                      if (excludedNames.has(destinationParent.toLowerCase())) {
                        showCustomAlert('‡¶§‡ßç‡¶∞‡ßÅ‡¶ü‡¶ø', '‡¶ï‡ßã‡¶®‡ßã ‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶®‡¶ø‡¶ú‡ßá‡¶∞ ‡¶≠‡ßá‡¶§‡¶∞ ‡¶¨‡¶æ ‡¶®‡¶ø‡¶ú‡ßá‡¶∞ ‡¶ö‡¶æ‡¶á‡¶≤‡ßç‡¶° ‡¶®‡ßã‡¶°‡ßá‡¶∞ ‡¶≠‡ßá‡¶§‡¶∞ ‡¶∏‡ßç‡¶•‡¶æ‡¶®‡¶æ‡¶®‡ßç‡¶§‡¶∞ ‡¶ï‡¶∞‡¶æ ‡¶∏‡¶Æ‡ßç‡¶≠‡¶¨ ‡¶®‡ßü!', 'warning');
                        return;
                      }

                      // Check if destination already has a subcategory with this name
                      const existingDestSub = subcategories.find(
                        s => s.id !== realEntityId &&
                             s.parentCategory &&
                             s.parentCategory.trim().toLowerCase() === destinationParent.trim().toLowerCase() &&
                             s.name.trim().toLowerCase() === trimmedNewName.toLowerCase()
                      );

                      if (existingDestSub) {
                        showCustomConfirm(
                          '‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶Æ‡¶æ‡¶∞‡ßç‡¶ú ‡¶®‡¶ø‡¶∂‡ßç‡¶ö‡¶ø‡¶§‡¶ï‡¶∞‡¶£ (Merge Confirmation)',
                          `‡¶ó‡¶®‡ßç‡¶§‡¶¨‡ßç‡¶Ø ‡¶™‡ßç‡¶Ø‡¶æ‡¶∞‡ßá‡¶®‡ßç‡¶ü "${destinationParent}" ‡¶è "${trimmedNewName}" ‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶á‡¶§‡¶ø‡¶Æ‡¶ß‡ßç‡¶Ø‡ßá ‡¶¨‡¶ø‡¶¶‡ßç‡¶Ø‡¶Æ‡¶æ‡¶® ‡¶Ü‡¶õ‡ßá‡•§\n\n‡¶Ü‡¶™‡¶®‡¶ø ‡¶ï‡¶ø ‡¶è‡¶á ‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø‡¶ï‡ßá ‡¶¨‡¶ø‡¶¶‡ßç‡¶Ø‡¶Æ‡¶æ‡¶® ‡¶´‡ßã‡¶≤‡ßç‡¶°‡¶æ‡¶∞‡ßá‡¶∞ ‡¶∏‡¶æ‡¶•‡ßá ‡¶Æ‡¶æ‡¶∞‡ßç‡¶ú (Merge) ‡¶ï‡¶∞‡¶§‡ßá ‡¶ö‡¶æ‡¶®? ‡¶Æ‡¶æ‡¶∞‡ßç‡¶ú ‡¶ï‡¶∞‡¶≤‡ßá ‡¶è‡¶∞ ‡¶Ü‡¶ì‡¶§‡¶æ‡¶ß‡ßÄ‡¶® ‡¶∏‡¶ï‡¶≤ MCQ ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶ì ‡¶ö‡¶æ‡¶á‡¶≤‡ßç‡¶° ‡¶®‡ßã‡¶° ‡¶ó‡¶®‡ßç‡¶§‡¶¨‡ßç‡¶Ø‡ßá‡¶∞ ‡¶¨‡¶ø‡¶¶‡ßç‡¶Ø‡¶Æ‡¶æ‡¶® ‡¶´‡ßã‡¶≤‡ßç‡¶°‡¶æ‡¶∞‡ßá ‡¶Ø‡ßÅ‡¶ï‡ßç‡¶§ ‡¶π‡¶¨‡ßá ‡¶è‡¶¨‡¶Ç ‡¶°‡ßÅ‡¶™‡ßç‡¶≤‡¶ø‡¶ï‡ßá‡¶ü ‡¶®‡ßã‡¶°‡¶ü‡¶ø ‡¶Æ‡¶æ‡¶∞‡ßç‡¶ú ‡¶π‡ßü‡ßá ‡¶Ø‡¶æ‡¶¨‡ßá‡•§`,
                          () => {
                            executeSingleMergeAndMove(
                              realEntityId,
                              sub || { id: realEntityId, name, parentCategory: destinationParent },
                              existingDestSub,
                              destinationParent,
                              trimmedNewName,
                              editingNodeSubHeading,
                              editingNodeDate
                            );
                            setEditingNodeId(null);
                          },
                          'warning',
                          '‡¶Æ‡¶æ‡¶∞‡ßç‡¶ú ‡¶ï‡¶∞‡ßÅ‡¶®',
                          '‡¶¨‡¶æ‡¶§‡¶ø‡¶≤'
                        );
                      } else {
                        if (onUpdateSubcategory) {
                          onUpdateSubcategory(realEntityId, trimmedNewName, destinationParent, editingNodeDate || undefined, editingNodeSubHeading);
                        }
                        setEditingNodeId(null);
                      }
                    }
                  }}
                  className="bg-amber-600 hover:bg-amber-750 text-white font-extrabold px-3 py-1.5 rounded-lg transition text-[10px] cursor-pointer shadow-xs"
                >
                  ‡¶∏‡¶Ç‡¶∞‡¶ï‡ßç‡¶∑‡¶£ ‡¶ì ‡¶Æ‡ßÅ‡¶≠ ‡¶ï‡¶∞‡ßÅ‡¶®
                </button>
                <button
                  type="button"
                  onClick={() => setEditingNodeId(null)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold px-3 py-1.5 rounded-lg transition text-[10px] cursor-pointer"
                >
                  ‡¶¨‡¶æ‡¶§‡¶ø‡¶≤
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
              ‚ûï "{name}" ‡¶è‡¶∞ ‡¶Ö‡¶ß‡ßÄ‡¶®‡ßá ‡¶®‡¶§‡ßÅ‡¶® ‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶Ø‡ßã‡¶ó ‡¶ï‡¶∞‡ßÅ‡¶®
            </h5>
            <div className="flex flex-col gap-2">
              <input 
                type="text"
                value={newChildNodeName}
                onChange={e => setNewChildNodeName(e.target.value)}
                placeholder="‡¶®‡¶§‡ßÅ‡¶® ‡¶â‡¶™-‡¶ß‡¶æ‡¶™‡ßá‡¶∞ ‡¶®‡¶æ‡¶Æ ‡¶≤‡¶ø‡¶ñ‡ßÅ‡¶® *"
                className="w-full px-3 py-1.5 border border-indigo-200 rounded-lg bg-white text-gray-800 font-semibold focus:outline-none text-[11px]"
              />
              <input 
                type="text"
                value={newChildNodeSubHeading}
                onChange={e => setNewChildNodeSubHeading(e.target.value)}
                placeholder="‡¶∏‡¶æ‡¶¨-‡¶π‡ßá‡¶°‡¶ø‡¶Ç / ‡¶∏‡¶æ‡¶¨-‡¶ü‡¶æ‡¶á‡¶ü‡ßá‡¶≤ (‡¶ê‡¶ö‡ßç‡¶õ‡¶ø‡¶ï)"
                className="w-full px-3 py-1.5 border border-indigo-200 rounded-lg bg-white text-gray-800 font-semibold focus:outline-none text-[11px]"
              />
              <div>
                <label className="block text-[10px] text-indigo-900 font-bold mb-0.5">üìÖ ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ‡¶∞ ‡¶§‡¶æ‡¶∞‡¶ø‡¶ñ (‡¶ê‡¶ö‡ßç‡¶õ‡¶ø‡¶ï):</label>
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
                      alert('‡¶∏‡¶†‡¶ø‡¶ï ‡¶®‡¶æ‡¶Æ ‡¶≤‡¶ø‡¶ñ‡ßÅ‡¶®!');
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
                  ‡¶Ø‡ßã‡¶ó ‡¶ï‡¶∞‡ßÅ‡¶®
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
                  ‡¶¨‡¶æ‡¶§‡¶ø‡¶≤
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
                    <span>‚ùì</span>
                    "{name}" ‡¶è ‡¶∏‡¶∞‡¶æ‡¶∏‡¶∞‡¶ø ‡¶Ø‡ßÅ‡¶ï‡ßç‡¶§ MCQ/‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶®‡¶æ‡¶¨‡¶≤‡¶ø ({directQuestions.length} ‡¶ü‡¶ø)
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
                    üîç ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶®‡¶ó‡ßÅ‡¶≤‡ßã ‡¶è‡¶°‡¶ø‡¶ü/‡¶Æ‡ßç‡¶Ø‡¶æ‡¶®‡ßá‡¶ú ‡¶ï‡¶∞‡ßÅ‡¶®
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
                        ‡¶∏‡¶†‡¶ø‡¶ï: {dq.correct === 'Option A' ? dq.optionA : dq.correct === 'Option B' ? dq.optionB : dq.correct === 'Option C' ? dq.optionC : dq.optionD}
                      </span>
                    </div>
                  ))}
                  {directQuestions.length > 10 && (
                    <p className="text-[10px] text-purple-700 italic font-semibold text-center pt-1">
                      ...‡¶Ü‡¶∞‡¶ì {directQuestions.length - 10} ‡¶ü‡¶ø ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶∞‡ßü‡ßá‡¶õ‡ßá‡•§ ‡¶¶‡ßá‡¶ñ‡¶§‡ßá '‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶®‡¶ó‡ßÅ‡¶≤‡ßã ‡¶è‡¶°‡¶ø‡¶ü/‡¶Æ‡ßç‡¶Ø‡¶æ‡¶®‡ßá‡¶ú ‡¶ï‡¶∞‡ßÅ‡¶®' ‡¶ö‡¶æ‡¶™‡ßÅ‡¶®‡•§
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
      alert('‡¶Ö‡¶®‡ßÅ‡¶ó‡ßç‡¶∞‡¶π ‡¶ï‡¶∞‡ßá ‡¶™‡ßç‡¶∞‡ßü‡ßã‡¶ú‡¶®‡ßÄ‡ßü ‡¶∏‡¶¨ ‡¶ò‡¶∞ ‡¶™‡ßÇ‡¶∞‡¶£ ‡¶ï‡¶∞‡ßÅ‡¶®!');
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
        alert('‡¶Ö‡¶®‡ßç‡¶§‡¶§ ‡¶è‡¶ï‡¶ü‡¶ø ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶∏‡¶ø‡¶≤‡ßá‡¶ï‡ßç‡¶ü ‡¶Ö‡¶•‡¶¨‡¶æ ‡¶ü‡¶æ‡¶á‡¶™ ‡¶ï‡¶∞‡ßÅ‡¶®!');
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
      alert('‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶®‡¶ü‡¶ø ‡¶∏‡¶´‡¶≤‡¶≠‡¶æ‡¶¨‡ßá ‡¶Ü‡¶™‡¶°‡ßá‡¶ü ‡¶ï‡¶∞‡¶æ ‡¶π‡ßü‡ßá‡¶õ‡ßá!');
    } else {
      onAddQuestion(questionData);
      alert('‡¶®‡¶§‡ßÅ‡¶® ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶®‡¶ü‡¶ø ‡¶°‡¶æ‡¶ü‡¶æ‡¶¨‡ßá‡¶∏‡ßá ‡¶∏‡¶´‡¶≤‡¶≠‡¶æ‡¶¨‡ßá ‡¶Ø‡ßã‡¶ó ‡¶ï‡¶∞‡¶æ ‡¶π‡ßü‡ßá‡¶õ‡ßá!');
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
      throw new Error('‡¶´‡¶æ‡¶á‡¶≤‡¶ü‡¶ø‡¶§‡ßá ‡¶ï‡ßã‡¶®‡ßã ‡¶°‡¶æ‡¶ü‡¶æ ‡¶®‡ßá‡¶á ‡¶¨‡¶æ ‡¶Ö‡¶§‡ßç‡¶Ø‡¶®‡ßç‡¶§ ‡¶õ‡ßã‡¶ü‡•§ ‡¶™‡ßç‡¶∞‡¶•‡¶Æ ‡¶≤‡¶æ‡¶á‡¶® ‡¶Ö‡¶¨‡¶∂‡ßç‡¶Ø‡¶á ‡¶π‡ßá‡¶°‡¶æ‡¶∞ ‡¶π‡¶§‡ßá ‡¶π‡¶¨‡ßá‡•§');
    }

    // Header checking
    const headers = parseCSVLine(lines[0], qualifierChar).map(h => h.trim().replace(/^["']|["']$/g, ''));
    
    // We do NOT require or include subcategory from the CSV upload system.
    const requiredFields = ['text', 'optionA', 'optionB', 'optionC', 'optionD', 'correct'];
    const missing = requiredFields.filter(f => !headers.includes(f));
    if (missing.length > 0) {
      throw new Error(`‡¶´‡¶æ‡¶á‡¶≤ ‡¶´‡¶∞‡¶Æ‡ßç‡¶Ø‡¶æ‡¶ü ‡¶≠‡ßÅ‡¶≤‡•§ ‡¶™‡ßç‡¶∞‡ßü‡ßã‡¶ú‡¶®‡ßÄ‡ßü ‡¶π‡ßá‡¶°‡¶æ‡¶∞ ‡¶Ö‡¶®‡ßÅ‡¶™‡¶∏‡ßç‡¶•‡¶ø‡¶§: ${missing.join(', ')}`);
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
          errors.push(`‡¶≤‡¶æ‡¶á‡¶® ${rowNum}: ‡¶ï‡ßÅ‡¶á‡¶ú‡ßá‡¶∞ ‡¶Æ‡ßÇ‡¶≤ ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶®‡¶ü‡¶ø (text) ‡¶´‡¶æ‡¶Å‡¶ï‡¶æ ‡¶∞‡¶æ‡¶ñ‡¶æ ‡¶Ø‡¶æ‡¶¨‡ßá ‡¶®‡¶æ‡•§`);
        }
        if (!optA) {
          errors.push(`‡¶≤‡¶æ‡¶á‡¶® ${rowNum}: ‡¶Ö‡¶™‡¶∂‡¶® A (optionA) ‡¶´‡¶æ‡¶Å‡¶ï‡¶æ ‡¶∞‡¶æ‡¶ñ‡¶æ ‡¶Ø‡¶æ‡¶¨‡ßá ‡¶®‡¶æ‡•§`);
        }
        if (!optB) {
          errors.push(`‡¶≤‡¶æ‡¶á‡¶® ${rowNum}: ‡¶Ö‡¶™‡¶∂‡¶® B (optionB) ‡¶´‡¶æ‡¶Å‡¶ï‡¶æ ‡¶∞‡¶æ‡¶ñ‡¶æ ‡¶Ø‡¶æ‡¶¨‡ßá ‡¶®‡¶æ‡•§`);
        }
        if (!optC) {
          errors.push(`‡¶≤‡¶æ‡¶á‡¶® ${rowNum}: ‡¶Ö‡¶™‡¶∂‡¶® C (optionC) ‡¶´‡¶æ‡¶Å‡¶ï‡¶æ ‡¶∞‡¶æ‡¶ñ‡¶æ ‡¶Ø‡¶æ‡¶¨‡ßá ‡¶®‡¶æ‡•§`);
        }
        if (!optD) {
          errors.push(`‡¶≤‡¶æ‡¶á‡¶® ${rowNum}: ‡¶Ö‡¶™‡¶∂‡¶® D (optionD) ‡¶´‡¶æ‡¶Å‡¶ï‡¶æ ‡¶∞‡¶æ‡¶ñ‡¶æ ‡¶Ø‡¶æ‡¶¨‡ßá ‡¶®‡¶æ‡•§`);
        }
      }

      let correctKey: 'Option A' | 'Option B' | 'Option C' | 'Option D' | null = null;
      if (!correctVal) {
        if (enableCsvValidation) {
          errors.push(`‡¶≤‡¶æ‡¶á‡¶® ${rowNum}: ‡¶∏‡¶†‡¶ø‡¶ï ‡¶â‡¶§‡ßç‡¶§‡¶∞ (correct) ‡¶´‡¶æ‡¶Å‡¶ï‡¶æ ‡¶∞‡¶æ‡¶ñ‡¶æ ‡¶Ø‡¶æ‡¶¨‡ßá ‡¶®‡¶æ‡•§`);
        }
      } else {
        const rawCorrect = correctVal.toLowerCase().trim();
        if (rawCorrect === 'option a' || rawCorrect === 'a' || rawCorrect === 'optiona' || rawCorrect === '‡¶ï') {
          correctKey = 'Option A';
        } else if (rawCorrect === 'option b' || rawCorrect === 'b' || rawCorrect === 'optionb' || rawCorrect === '‡¶ñ') {
          correctKey = 'Option B';
        } else if (rawCorrect === 'option c' || rawCorrect === 'c' || rawCorrect === 'optionc' || rawCorrect === '‡¶ó') {
          correctKey = 'Option C';
        } else if (rawCorrect === 'option d' || rawCorrect === 'd' || rawCorrect === 'optiond' || rawCorrect === '‡¶ò') {
          correctKey = 'Option D';
        } else {
          if (enableCsvValidation) {
            errors.push(`‡¶≤‡¶æ‡¶á‡¶® ${rowNum}: ‡¶∏‡¶†‡¶ø‡¶ï ‡¶â‡¶§‡ßç‡¶§‡¶∞ '${correctVal}' ‡¶≠‡ßÅ‡¶≤‡•§ ‡¶è‡¶ü‡¶ø ‡¶Ö‡¶¨‡¶∂‡ßç‡¶Ø‡¶á Option A, Option B, Option C ‡¶¨‡¶æ Option D ‡¶π‡¶§‡ßá ‡¶π‡¶¨‡ßá‡•§`);
          }
        }
      }

      if (!enableCsvValidation || errors.length === 0) {
        const rawCat = rowData.category || rowData.subject || rowData['‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø'] || rowData['‡¶¨‡¶ø‡¶∑‡ßü'] || '‡¶∏‡¶æ‡¶ß‡¶æ‡¶∞‡¶£ ‡¶ú‡ßç‡¶û‡¶æ‡¶®';
        const rawSub = rowData.subcategory || rowData.topic || rowData['‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø'] || rowData['‡¶â‡¶™-‡¶¨‡¶ø‡¶∑‡ßü'] || rowData['‡¶ü‡¶™‡¶ø‡¶ï'] || '';

        results.push({
          text: textVal || `‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶®‡¶π‡ßÄ‡¶® ‡¶ï‡ßÅ‡¶á‡¶ú ${rowNum}`,
          optionA: optA || '‡¶Ö‡¶™‡¶∂‡¶® ‡¶ï',
          optionB: optB || '‡¶Ö‡¶™‡¶∂‡¶® ‡¶ñ',
          optionC: optC || '‡¶Ö‡¶™‡¶∂‡¶® ‡¶ó',
          optionD: optD || '‡¶Ö‡¶™‡¶∂‡¶® ‡¶ò',
          correct: correctKey || 'Option A',
          explanation: rowData.explanation || '',
          category: rawCat,
          subcategory: rawSub,
          csvCategory: rawCat,
          csvSubcategory: rawSub,
          subjectCategory: rawCat,
          subjectSubcategory: rawSub
        });
      }
    }

    if (enableCsvValidation && errors.length > 0) {
      const err = new Error('‡¶°‡ßá‡¶ü‡¶æ ‡¶≠‡ßç‡¶Ø‡¶æ‡¶≤‡¶ø‡¶°‡ßá‡¶∂‡¶® ‡¶¨‡ßç‡¶Ø‡¶∞‡ßç‡¶• ‡¶π‡ßü‡ßá‡¶õ‡ßá‡•§');
      (err as any).validationErrors = errors;
      throw err;
    }

    return results;
  };

  const handleBulkUploadCSVText = () => {
    if (!csvText.trim()) {
      alert('‡¶Ö‡¶®‡ßÅ‡¶ó‡ßç‡¶∞‡¶π ‡¶ï‡¶∞‡ßá CSV ‡¶´‡¶∞‡¶Æ‡ßç‡¶Ø‡¶æ‡¶ü‡ßá ‡¶ü‡ßá‡¶ï‡ßç‡¶∏‡¶ü ‡¶™‡ßá‡¶∏‡ßç‡¶ü ‡¶ï‡¶∞‡ßÅ‡¶®!');
      return;
    }
    try {
      setCsvFileError('');
      setCsvValidationErrors([]);
      const parsed = parseCSV(csvText);
      if (parsed.length === 0) {
        alert('‡¶ï‡ßã‡¶®‡ßã ‡¶¨‡ßà‡¶ß ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶ñ‡ßÅ‡¶Å‡¶ú‡ßá ‡¶™‡¶æ‡¶ì‡ßü‡¶æ ‡¶Ø‡¶æ‡ßü‡¶®‡¶ø‡•§ ‡¶´‡¶∞‡¶Æ‡ßç‡¶Ø‡¶æ‡¶ü ‡¶†‡¶ø‡¶ï ‡¶Ü‡¶õ‡ßá ‡¶ï‡¶ø‡¶®‡¶æ ‡¶®‡¶ø‡¶∂‡ßç‡¶ö‡¶ø‡¶§ ‡¶ï‡¶∞‡ßÅ‡¶®‡•§');
        return;
      }
      onBulkUploadQuestions(parsed);
      alert(`üéâ ‡¶∏‡¶´‡¶≤‡¶≠‡¶æ‡¶¨‡ßá ${parsed.length}‡¶ü‡¶ø ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶Ü‡¶™‡¶≤‡ßã‡¶° ‡¶ï‡¶∞‡¶æ ‡¶π‡ßü‡ßá‡¶õ‡ßá!`);
      setCsvText('');
    } catch (err: any) {
      if (err.validationErrors) {
        setCsvValidationErrors(err.validationErrors);
        setCsvFileError('‡¶ï‡ßü‡ßá‡¶ï‡¶ü‡¶ø ‡¶ï‡ßÅ‡¶á‡¶ú‡ßá‡¶∞ ‡¶§‡¶•‡ßç‡¶Ø‡ßá ‡¶≠‡ßç‡¶Ø‡¶æ‡¶≤‡¶ø‡¶°‡ßá‡¶∂‡¶® ‡¶∏‡¶Æ‡¶∏‡ßç‡¶Ø‡¶æ ‡¶™‡¶æ‡¶ì‡ßü‡¶æ ‡¶ó‡ßá‡¶õ‡ßá‡•§ ‡¶®‡¶ø‡¶ö‡ßá ‡¶¨‡¶ø‡¶∏‡ßç‡¶§‡¶æ‡¶∞‡¶ø‡¶§ ‡¶¶‡ßá‡¶ñ‡ßÅ‡¶®‡•§');
      } else {
        setCsvFileError(err.message || 'CSV ‡¶™‡¶æ‡¶∞‡ßç‡¶∏‡¶ø‡¶Ç ‡¶¨‡ßç‡¶Ø‡¶∞‡ßç‡¶• ‡¶π‡ßü‡ßá‡¶õ‡ßá');
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
          alert('‡¶ï‡ßã‡¶®‡ßã ‡¶¨‡ßà‡¶ß ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶ñ‡ßÅ‡¶Å‡¶ú‡ßá ‡¶™‡¶æ‡¶ì‡ßü‡¶æ ‡¶Ø‡¶æ‡ßü‡¶®‡¶ø‡•§');
          return;
        }
        setPendingCSVFile(file);
        setPendingQuestions(parsed);
      } catch (err: any) {
        if (err.validationErrors) {
          setCsvValidationErrors(err.validationErrors);
          setCsvFileError('‡¶´‡¶æ‡¶á‡¶≤‡ßá‡¶∞ ‡¶≠‡ßá‡¶§‡¶∞‡ßá ‡¶≠‡ßç‡¶Ø‡¶æ‡¶≤‡¶ø‡¶°‡ßá‡¶∂‡¶® ‡¶∏‡¶Æ‡¶∏‡ßç‡¶Ø‡¶æ ‡¶™‡¶æ‡¶ì‡ßü‡¶æ ‡¶ó‡ßá‡¶õ‡ßá‡•§ ‡¶®‡¶ø‡¶ö‡ßá ‡¶¨‡¶ø‡¶∏‡ßç‡¶§‡¶æ‡¶∞‡¶ø‡¶§ ‡¶¶‡ßá‡¶ñ‡ßÅ‡¶®‡•§');
        } else {
          setCsvFileError(err.message || '‡¶´‡¶æ‡¶á‡¶≤ ‡¶™‡¶æ‡¶∞‡ßç‡¶∏‡¶ø‡¶Ç ‡¶¨‡ßç‡¶Ø‡¶∞‡ßç‡¶• ‡¶π‡ßü‡ßá‡¶õ‡ßá');
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
    if (combined.includes('‡¶¨‡¶æ‡¶Ç‡¶≤‡¶æ') || combined.includes('bangla') || combined.includes('bengali')) {
      if (combined.includes('‡¶∏‡¶æ‡¶π‡¶ø‡¶§‡ßç‡¶Ø') || combined.includes('literature') || combined.includes('‡¶ï‡¶æ‡¶¨‡ßç‡¶Ø') || combined.includes('‡¶â‡¶™‡¶®‡ßç‡¶Ø‡¶æ‡¶∏') || combined.includes('‡¶≤‡ßá‡¶ñ‡¶ï') || combined.includes('‡¶ï‡¶¨‡¶ø')) {
        return '‡¶¨‡¶æ‡¶Ç‡¶≤‡¶æ ‡¶∏‡¶æ‡¶π‡¶ø‡¶§‡ßç‡¶Ø';
      }
      return '‡¶¨‡¶æ‡¶Ç‡¶≤‡¶æ ‡¶¨‡ßç‡¶Ø‡¶æ‡¶ï‡¶∞‡¶£';
    }

    // English Literature vs Grammar
    if (combined.includes('‡¶á‡¶Ç‡¶∞‡ßá‡¶ú‡¶ø') || combined.includes('english')) {
      if (combined.includes('literature') || combined.includes('‡¶∏‡¶æ‡¶π‡¶ø‡¶§‡ßç‡¶Ø') || combined.includes('drama') || combined.includes('poem') || combined.includes('poet')) {
        return '‡¶á‡¶Ç‡¶∞‡ßá‡¶ú‡¶ø ‡¶∏‡¶æ‡¶π‡¶ø‡¶§‡ßç‡¶Ø';
      }
      return '‡¶á‡¶Ç‡¶∞‡ßá‡¶ú‡¶ø ‡¶ó‡ßç‡¶∞‡¶æ‡¶Æ‡¶æ‡¶∞';
    }

    // Math
    if (combined.includes('‡¶ó‡¶£‡¶ø‡¶§') || combined.includes('math') || combined.includes('mathematics') || combined.includes('‡¶¨‡ßÄ‡¶ú‡¶ó‡¶£‡¶ø‡¶§') || combined.includes('‡¶™‡¶æ‡¶ü‡¶ø‡¶ó‡¶£‡¶ø‡¶§') || combined.includes('‡¶ú‡ßç‡¶Ø‡¶æ‡¶Æ‡¶ø‡¶§‡¶ø') || combined.includes('‡¶Æ‡¶æ‡¶®‡¶∏‡¶ø‡¶ï ‡¶¶‡¶ï‡ßç‡¶∑‡¶§‡¶æ')) {
      return '‡¶ó‡¶£‡¶ø‡¶§';
    }

    // Bangladesh
    if (combined.includes('‡¶¨‡¶æ‡¶Ç‡¶≤‡¶æ‡¶¶‡ßá‡¶∂') || combined.includes('bangladesh') || combined.includes('bd')) {
      return '‡¶¨‡¶æ‡¶Ç‡¶≤‡¶æ‡¶¶‡ßá‡¶∂ ‡¶¨‡¶ø‡¶∑‡ßü‡¶æ‡¶¨‡¶≤‡ßÄ';
    }

    // International
    if (combined.includes('‡¶Ü‡¶®‡ßç‡¶§‡¶∞‡ßç‡¶ú‡¶æ‡¶§‡¶ø‡¶ï') || combined.includes('international') || combined.includes('intl')) {
      return '‡¶Ü‡¶®‡ßç‡¶§‡¶∞‡ßç‡¶ú‡¶æ‡¶§‡¶ø‡¶ï ‡¶¨‡¶ø‡¶∑‡ßü‡¶æ‡¶¨‡¶≤‡ßÄ';
    }

    // Science
    if (combined.includes('‡¶¨‡¶ø‡¶ú‡ßç‡¶û‡¶æ‡¶®') || combined.includes('science') || combined.includes('‡¶™‡¶¶‡¶æ‡¶∞‡ßç‡¶•') || combined.includes('‡¶∞‡¶∏‡¶æ‡ßü‡¶®') || combined.includes('‡¶ú‡ßÄ‡¶¨‡¶¨‡¶ø‡¶ú‡ßç‡¶û‡¶æ‡¶®')) {
      return '‡¶∏‡¶æ‡¶ß‡¶æ‡¶∞‡¶£ ‡¶¨‡¶ø‡¶ú‡ßç‡¶û‡¶æ‡¶®';
    }

    // ICT
    if (combined.includes('‡¶§‡¶•‡ßç‡¶Ø') || combined.includes('‡¶™‡ßç‡¶∞‡¶Ø‡ßÅ‡¶ï‡ßç‡¶§‡¶ø') || combined.includes('ict') || combined.includes('‡¶ï‡¶Æ‡ßç‡¶™‡¶ø‡¶â‡¶ü‡¶æ‡¶∞') || combined.includes('computer')) {
      return '‡¶§‡¶•‡ßç‡¶Ø ‡¶ì ‡¶Ø‡ßã‡¶ó‡¶æ‡¶Ø‡ßã‡¶ó ‡¶™‡ßç‡¶∞‡¶Ø‡ßÅ‡¶ï‡ßç‡¶§‡¶ø';
    }

    if (combined.includes('‡¶¨‡ßç‡¶Ø‡¶æ‡¶ï‡¶∞‡¶£') || combined.includes('grammar')) return '‡¶¨‡¶æ‡¶Ç‡¶≤‡¶æ ‡¶¨‡ßç‡¶Ø‡¶æ‡¶ï‡¶∞‡¶£';
    if (combined.includes('‡¶∏‡¶æ‡¶π‡¶ø‡¶§‡ßç‡¶Ø') || combined.includes('literature')) return '‡¶¨‡¶æ‡¶Ç‡¶≤‡¶æ ‡¶∏‡¶æ‡¶π‡¶ø‡¶§‡ßç‡¶Ø';

    return '‡¶∏‡¶æ‡¶ß‡¶æ‡¶∞‡¶£ ‡¶¨‡¶ø‡¶ú‡ßç‡¶û‡¶æ‡¶®';
  };

  const prepareMappingReview = () => {
    if (pendingQuestions.length === 0) return;

    // Group pending questions strictly by CSV subject fields
    const subcatGroupMap = new Map<string, { rawSubcat: string; rawCat: string; count: number }>();

    pendingQuestions.forEach(q => {
      const rawSub = (q.csvSubcategory || q.subcategory || '').trim() || '‡¶∏‡¶æ‡¶ß‡¶æ‡¶∞‡¶£ ‡¶ï‡ßÅ‡¶á‡¶ú';
      const rawCat = (q.csvCategory || q.category || '').trim() || '‡¶∏‡¶æ‡¶ß‡¶æ‡¶∞‡¶£ ‡¶ú‡ßç‡¶û‡¶æ‡¶®';
      const key = `${rawCat}::${rawSub}`;

      if (!subcatGroupMap.has(key)) {
        subcatGroupMap.set(key, { rawSubcat: rawSub, rawCat: rawCat, count: 0 });
      }
      subcatGroupMap.get(key)!.count += 1;
    });

    const mappingsList: CSVMismatchMapping[] = [];
    let index = 0;

    subcatGroupMap.forEach((val) => {
      const dbCat = findCategoryInDatabase(val.rawCat);

      // Determine target category dynamically (must be a subject category, not job/year root)
      let targetCat = val.rawCat;
      if (dbCat && !isJobSolutionVariation(dbCat) && !isYearJobSolutionVariation(dbCat) && dbCat !== '‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø') {
        targetCat = dbCat;
      } else {
        targetCat = mapToStandardSubjectCategory(val.rawCat, val.rawSubcat);
      }

      // Check if subcategory already exists under this target parentCategory (parentCategory + name)
      const dbSub = findSubcategoryInDatabase(val.rawSubcat, targetCat);

      // Subcategory exists specifically under this parentCategory
      const subExistsInDb = !!dbSub;
      const isMatched = subExistsInDb;
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

    // 1. Ensure all 9 standard subject categories exist under parent '‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø' with integrity validation
    STANDARD_SUBJECT_CATEGORIES.forEach(stdCat => {
      const validation = validateSubcategoryIntegrity(stdCat, '‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø', currentSubcatList);
      if (validation.valid) {
        const newSub: SubcategoryItem = {
          id: `subcat-std-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          name: stdCat,
          parentCategory: '‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø'
        };
        currentSubcatList.push(newSub);
        onAddSubcategory(stdCat, '‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø');
        createdSubcatsCount++;
      }
    });

    // 2. Process mismatch mappings & create required subcategories with strict hierarchy integrity validation
    // ONLY creates categories/subcategories under subject hierarchy, NEVER under exam / job solution hierarchy
    mismatchMappings.forEach(m => {
      if (m.action === 'create') {
        const subName = m.correctedSubcategory.trim();
        const parentCat = m.targetCategory.trim();

        if (subName && parentCat && !isJobSolutionVariation(parentCat) && !isYearJobSolutionVariation(parentCat)) {
          const validation = validateSubcategoryIntegrity(subName, parentCat, currentSubcatList);
          if (validation.valid) {
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
      const rawSub = (q.csvSubcategory || q.subcategory || '').trim() || '‡¶∏‡¶æ‡¶ß‡¶æ‡¶∞‡¶£ ‡¶ï‡ßÅ‡¶á‡¶ú';
      const rawCat = (q.csvCategory || q.category || '').trim() || '‡¶∏‡¶æ‡¶ß‡¶æ‡¶∞‡¶£ ‡¶ú‡ßç‡¶û‡¶æ‡¶®';

      const mappingRule = mismatchMappings.find(m => normalizeName(m.rawSubcategory) === normalizeName(rawSub));

      const finalTargetCat = mappingRule ? mappingRule.targetCategory : (findCategoryInDatabase(rawCat) || rawCat);
      const finalTargetSubcat = mappingRule 
        ? (mappingRule.action === 'map_existing' ? mappingRule.existingSubcategoryChoice : mappingRule.correctedSubcategory)
        : rawSub;

      // Destination hierarchy (Exam / Job Solution)
      const examCat = uploadDestCat || '‡¶∏‡¶æ‡¶ß‡¶æ‡¶∞‡¶£ ‡¶ú‡ßç‡¶û‡¶æ‡¶®';
      const examSub = destSub || '';
      const examPathArray = [uploadDestCat, ...activeDestSubcats].filter(Boolean);

      // Subject hierarchy
      const subjCat = finalTargetCat || '‡¶∏‡¶æ‡¶ß‡¶æ‡¶∞‡¶£ ‡¶ú‡ßç‡¶û‡¶æ‡¶®';
      const subjSub = finalTargetSubcat || '';
      const subjPathArray = ['‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø', finalTargetCat, finalTargetSubcat].filter(Boolean);

      const cats: string[] = [examCat];
      const subs: string[] = [...activeDestSubcats];

      if (enableSubjectAutoMap) {
        if (subjCat && !cats.includes(subjCat)) {
          cats.push(subjCat);
        }
        if (subjSub && !subs.includes(subjSub)) {
          subs.push(subjSub);
        }
      }

      return {
        ...q,
        // Primary fields for backward compatibility and direct match
        category: examCat,
        subcategory: examSub,
        categories: Array.from(new Set(cats.filter(Boolean))),
        subcategories: Array.from(new Set(subs.filter(Boolean))),
        // Separated Exam Hierarchy fields
        examCategory: examCat,
        examSubcategory: examSub,
        examPath: examPathArray,
        // Separated CSV Subject Hierarchy fields
        csvCategory: rawCat,
        csvSubcategory: rawSub,
        subjectCategory: subjCat,
        subjectSubcategory: subjSub,
        subjectPath: subjPathArray
      };
    });

    onBulkUploadQuestions(finalQuestions);

    // Save to upload history
    const destString = destSub ? `${uploadDestCat} ‚ûî ${destSub}` : uploadDestCat;
    const historyNote = enableSubjectAutoMap 
      ? `${destString} (‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶Ö‡¶ü‡ßã-‡¶Æ‡ßç‡¶Ø‡¶æ‡¶™‡¶°)` 
      : destString;

    const newHistoryItem = {
      id: Date.now().toString(),
      filename: pendingCSVFile?.name || '‡¶´‡¶æ‡¶á‡¶≤ ‡¶Ü‡¶™‡¶≤‡ßã‡¶°',
      timestamp: new Date().toLocaleString('bn-BD', { hour12: true }),
      count: finalQuestions.length,
      destination: historyNote
    };

    const updatedHistory = [newHistoryItem, ...uploadHistory];
    setUploadHistory(updatedHistory);
    localStorage.setItem('orjon_upload_history', JSON.stringify(updatedHistory));

    let msg = `üéâ ‡¶∏‡¶´‡¶≤‡¶≠‡¶æ‡¶¨‡ßá ${finalQuestions.length}‡¶ü‡¶ø ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶°‡¶æ‡¶ü‡¶æ‡¶¨‡ßá‡¶∏‡ßá ‡¶Ü‡¶™‡¶≤‡ßã‡¶° ‡¶ï‡¶∞‡¶æ ‡¶π‡ßü‡ßá‡¶õ‡ßá!`;
    if (createdSubcatsCount > 0) {
      msg += `\nüéØ ‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø ‡¶ú‡ßã‡¶®‡ßá ${createdSubcatsCount}‡¶ü‡¶ø ‡¶®‡¶§‡ßÅ‡¶® ‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶∏‡ßç‡¶¨‡ßü‡¶Ç‡¶ï‡ßç‡¶∞‡¶ø‡ßü‡¶≠‡¶æ‡¶¨‡ßá ‡¶§‡ßà‡¶∞‡¶ø ‡¶ì ‡¶Ø‡ßÅ‡¶ï‡ßç‡¶§ ‡¶ï‡¶∞‡¶æ ‡¶π‡ßü‡ßá‡¶õ‡ßá‡•§`;
    }
    
    showCustomAlert('‡¶Ü‡¶™‡¶≤‡ßã‡¶° ‡¶∏‡¶´‡¶≤ ‡¶π‡ßü‡ßá‡¶õ‡ßá!', msg, 'success');

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
    ['‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø', '‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶® ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ', '‡¶∏‡¶æ‡¶≤ ‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶®', '‡¶∏‡¶æ‡¶ß‡¶æ‡¶∞‡¶£ ‡¶ú‡ßç‡¶û‡¶æ‡¶®'].forEach(r => registered.add(r.trim().toLowerCase()));
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
            const parent = idx > 0 ? q.subcategories![idx - 1] : (q.category || '‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø');
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
          let parent = parentHint && parentHint.trim() ? parentHint.trim() : '‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø';
          if (isJobSolutionVariation(parent) || isYearJobSolutionVariation(parent)) {
            parent = '‡¶∏‡¶æ‡¶ß‡¶æ‡¶∞‡¶£ ‡¶ú‡ßç‡¶û‡¶æ‡¶®';
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
      if (parent === '‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø' || current.name === '‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø') return 'subject';

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
      const path = findSubcategoryPath(sub.name).join(' ‚ûî ').toLowerCase();
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
    setSelectedQIds(prev =>
      prev.includes(id)
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  const handleBulkDelete = () => {
    if (selectedQIds.length === 0) {
      showCustomAlert('‡¶§‡ßç‡¶∞‡ßÅ‡¶ü‡¶ø', '‡¶™‡ßç‡¶∞‡¶•‡¶Æ‡ßá ‡¶è‡¶ï ‡¶¨‡¶æ ‡¶è‡¶ï‡¶æ‡¶ß‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶®‡¶ø‡¶∞‡ßç‡¶¨‡¶æ‡¶ö‡¶® ‡¶ï‡¶∞‡ßÅ‡¶®!', 'warning');
      return;
    }
    showCustomConfirm(
      '‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶°‡¶ø‡¶≤‡¶ø‡¶ü ‡¶®‡¶ø‡¶∂‡ßç‡¶ö‡¶ø‡¶§‡¶ï‡¶∞‡¶£',
      `‡¶Ü‡¶™‡¶®‡¶ø ‡¶ï‡¶ø ‡¶®‡¶ø‡¶∂‡ßç‡¶ö‡¶ø‡¶§‡¶≠‡¶æ‡¶¨‡ßá ‡¶®‡¶ø‡¶∞‡ßç‡¶¨‡¶æ‡¶ö‡¶ø‡¶§ ${selectedQIds.length}‡¶ü‡¶ø ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶è‡¶ï‡¶¨‡¶æ‡¶∞‡ßá ‡¶Æ‡ßÅ‡¶õ‡ßá ‡¶´‡ßá‡¶≤‡¶§‡ßá ‡¶ö‡¶æ‡¶®?`,
      async () => {
        const count = selectedQIds.length;
        const ok = await onBulkDeleteQuestions(selectedQIds);
        if (ok !== false) {
          setSelectedQIds([]);
          showCustomAlert('‡¶∏‡¶Æ‡ßç‡¶™‡¶®‡ßç‡¶® ‡¶π‡ßü‡ßá‡¶õ‡ßá!', `‡¶®‡¶ø‡¶∞‡ßç‡¶¨‡¶æ‡¶ö‡¶ø‡¶§ ${count}‡¶ü‡¶ø ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶∏‡¶´‡¶≤‡¶≠‡¶æ‡¶¨‡ßá ‡¶°‡¶ø‡¶≤‡¶ø‡¶ü ‡¶ï‡¶∞‡¶æ ‡¶π‡ßü‡ßá‡¶õ‡ßá!`, 'success');
        } else {
          showCustomAlert('‡¶§‡ßç‡¶∞‡ßÅ‡¶ü‡¶ø!', '‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶®‡¶∏‡¶Æ‡ßÇ‡¶π ‡¶°‡¶ø‡¶≤‡¶ø‡¶ü ‡¶ï‡¶∞‡¶§‡ßá ‡¶¨‡ßç‡¶Ø‡¶∞‡ßç‡¶• ‡¶π‡ßü‡ßá‡¶õ‡ßá!', 'error');
        }
      },
      'warning'
    );
  };

  const handleBulkMove = (mode: 'move' | 'link' = 'move') => {
    if (selectedQIds.length === 0) {
      showCustomAlert('‡¶§‡ßç‡¶∞‡ßÅ‡¶ü‡¶ø', '‡¶™‡ßç‡¶∞‡¶•‡¶Æ‡ßá ‡¶è‡¶ï ‡¶¨‡¶æ ‡¶è‡¶ï‡¶æ‡¶ß‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶®‡¶ø‡¶∞‡ßç‡¶¨‡¶æ‡¶ö‡¶® ‡¶ï‡¶∞‡ßÅ‡¶®!', 'warning');
      return;
    }
    
    // Find destination subcategory if selected in the cascade
    const activeDestSubcats = moveDestSubcatChain.filter(s => s && s !== 'ALL');
    const destSub = activeDestSubcats.length > 0 ? activeDestSubcats[activeDestSubcats.length - 1] : '';

    const isMove = mode === 'move';
    const confirmTitle = isMove ? '‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶∏‡ßç‡¶•‡¶æ‡¶®‡¶æ‡¶®‡ßç‡¶§‡¶∞ (Move) ‡¶®‡¶ø‡¶∂‡ßç‡¶ö‡¶ø‡¶§‡¶ï‡¶∞‡¶£' : '‡¶Æ‡¶æ‡¶≤‡ßç‡¶ü‡¶ø-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶≤‡¶ø‡¶ô‡ßç‡¶ï ‡¶®‡¶ø‡¶∂‡ßç‡¶ö‡¶ø‡¶§‡¶ï‡¶∞‡¶£';
    const confirmMsg = isMove
      ? `‡¶Ü‡¶™‡¶®‡¶ø ‡¶ï‡¶ø ‡¶®‡¶ø‡¶∂‡ßç‡¶ö‡¶ø‡¶§‡¶≠‡¶æ‡¶¨‡ßá ‡¶®‡¶ø‡¶∞‡ßç‡¶¨‡¶æ‡¶ö‡¶ø‡¶§ ${selectedQIds.length}‡¶ü‡¶ø ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶®‡¶ï‡ßá ‡¶Æ‡ßÇ‡¶≤ ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø "${moveDestCat}" ${destSub ? `‡¶ì ‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø "${destSub}"` : ''} ‡¶è ‡¶∏‡ßç‡¶•‡¶æ‡¶®‡¶æ‡¶®‡ßç‡¶§‡¶∞‡¶ø‡¶§ (Reassign Primary Category) ‡¶ï‡¶∞‡¶§‡ßá ‡¶ö‡¶æ‡¶®?`
      : `‡¶Ü‡¶™‡¶®‡¶ø ‡¶ï‡¶ø ‡¶®‡¶ø‡¶∂‡ßç‡¶ö‡¶ø‡¶§‡¶≠‡¶æ‡¶¨‡ßá ‡¶®‡¶ø‡¶∞‡ßç‡¶¨‡¶æ‡¶ö‡¶ø‡¶§ ${selectedQIds.length}‡¶ü‡¶ø ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶®‡¶ï‡ßá ‡¶Ö‡¶§‡¶ø‡¶∞‡¶ø‡¶ï‡ßç‡¶§ ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø "${moveDestCat}" ${destSub ? `‡¶ì ‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø "${destSub}"` : ''} ‡¶è‡¶∞ ‡¶∏‡¶æ‡¶•‡ßá ‡¶≤‡¶ø‡¶ô‡ßç‡¶ï (Link) ‡¶ï‡¶∞‡¶§‡ßá ‡¶ö‡¶æ‡¶®?`;

    showCustomConfirm(
      confirmTitle,
      confirmMsg,
      () => {
        const count = selectedQIds.length;
        onBulkMoveQuestions(selectedQIds, moveDestCat, destSub, mode);
        setSelectedQIds([]);
        setMoveDestSubcatChain([]);
        showCustomAlert('‡¶∏‡¶Æ‡ßç‡¶™‡¶®‡ßç‡¶® ‡¶π‡ßü‡ßá‡¶õ‡ßá!', `‡¶®‡¶ø‡¶∞‡ßç‡¶¨‡¶æ‡¶ö‡¶ø‡¶§ ${count}‡¶ü‡¶ø ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶∏‡¶´‡¶≤‡¶≠‡¶æ‡¶¨‡ßá ${isMove ? '‡¶®‡¶§‡ßÅ‡¶® ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø‡¶§‡ßá ‡¶∏‡ßç‡¶•‡¶æ‡¶®‡¶æ‡¶®‡ßç‡¶§‡¶∞‡¶ø‡¶§' : '‡¶Ö‡¶§‡¶ø‡¶∞‡¶ø‡¶ï‡ßç‡¶§ ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø‡¶§‡ßá ‡¶≤‡¶ø‡¶ô‡ßç‡¶ï'} ‡¶ï‡¶∞‡¶æ ‡¶π‡ßü‡ßá‡¶õ‡ßá!`, 'success');
      },
      'info'
    );
  };

  // Subcategories Multiple Selection & Bulk Action Handlers
  const handleToggleSelectSubcat = (id: string) => {
    setSelectedSubcatIds(prev =>
      prev.includes(id)
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  const handleSelectAllSubcats = (subcatList: SubcategoryItem[]) => {
    setSelectedSubcatIds(prev =>
      prev.length === subcatList.length && subcatList.length > 0
        ? []
        : subcatList.map(s => s.id)
    );
  };

  const handleBulkDeleteSubcatAction = () => {
    if (selectedSubcatIds.length === 0) {
      showCustomAlert('‡¶§‡ßç‡¶∞‡ßÅ‡¶ü‡¶ø', '‡¶™‡ßç‡¶∞‡¶•‡¶Æ‡ßá ‡¶è‡¶ï ‡¶¨‡¶æ ‡¶è‡¶ï‡¶æ‡¶ß‡¶ø‡¶ï ‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶®‡¶ø‡¶∞‡ßç‡¶¨‡¶æ‡¶ö‡¶® ‡¶ï‡¶∞‡ßÅ‡¶®!', 'warning');
      return;
    }
    showCustomConfirm(
      '‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶°‡¶ø‡¶≤‡¶ø‡¶ü ‡¶®‡¶ø‡¶∂‡ßç‡¶ö‡¶ø‡¶§‡¶ï‡¶∞‡¶£',
      `‡¶Ü‡¶™‡¶®‡¶ø ‡¶ï‡¶ø ‡¶®‡¶ø‡¶∂‡ßç‡¶ö‡¶ø‡¶§‡¶≠‡¶æ‡¶¨‡ßá ‡¶®‡¶ø‡¶∞‡ßç‡¶¨‡¶æ‡¶ö‡¶ø‡¶§ ${selectedSubcatIds.length}‡¶ü‡¶ø ‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶è‡¶¨‡¶Ç ‡¶è‡¶¶‡ßá‡¶∞ ‡¶Ö‡¶ß‡ßÄ‡¶®‡¶∏‡ßç‡¶• ‡¶∏‡¶Æ‡¶∏‡ßç‡¶§ ‡¶¨‡ßç‡¶∞‡¶æ‡¶û‡ßç‡¶ö ‡¶è‡¶ï‡¶¨‡¶æ‡¶∞‡ßá ‡¶Æ‡ßÅ‡¶õ‡ßá ‡¶´‡ßá‡¶≤‡¶§‡ßá ‡¶ö‡¶æ‡¶®?`,
      async () => {
        const count = selectedSubcatIds.length;
        let ok = true;
        if (onBulkDeleteSubcategories) {
          const res = await onBulkDeleteSubcategories(selectedSubcatIds);
          if (res === false) ok = false;
        } else {
          for (const id of selectedSubcatIds) {
            const res = await onDeleteSubcategory(id);
            if (res === false) ok = false;
          }
        }
        if (ok) {
          setSelectedSubcatIds([]);
          showCustomAlert('‡¶∏‡¶Æ‡ßç‡¶™‡¶®‡ßç‡¶®!', `‡¶®‡¶ø‡¶∞‡ßç‡¶¨‡¶æ‡¶ö‡¶ø‡¶§ ${count}‡¶ü‡¶ø ‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶∏‡¶´‡¶≤‡¶≠‡¶æ‡¶¨‡ßá ‡¶°‡¶ø‡¶≤‡¶ø‡¶ü ‡¶ï‡¶∞‡¶æ ‡¶π‡ßü‡ßá‡¶õ‡ßá!`, 'success');
        } else {
          showCustomAlert('‡¶§‡ßç‡¶∞‡ßÅ‡¶ü‡¶ø!', '‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶°‡¶ø‡¶≤‡¶ø‡¶ü ‡¶ï‡¶∞‡¶§‡ßá ‡¶∏‡¶Æ‡¶∏‡ßç‡¶Ø‡¶æ ‡¶π‡ßü‡ßá‡¶õ‡ßá!', 'error');
        }
      },
      'warning'
    );
  };

  const handleBulkMoveSubcatAction = () => {
    if (selectedSubcatIds.length === 0) {
      showCustomAlert('‡¶§‡ßç‡¶∞‡ßÅ‡¶ü‡¶ø', '‡¶™‡ßç‡¶∞‡¶•‡¶Æ‡ßá ‡¶è‡¶ï ‡¶¨‡¶æ ‡¶è‡¶ï‡¶æ‡¶ß‡¶ø‡¶ï ‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶®‡¶ø‡¶∞‡ßç‡¶¨‡¶æ‡¶ö‡¶® ‡¶ï‡¶∞‡ßÅ‡¶®!', 'warning');
      return;
    }
    const activeChain = bulkMoveDestSubcatChain.filter(s => s && s !== 'ALL');
    const destinationParent = activeChain.length > 0 ? activeChain[activeChain.length - 1] : bulkMoveDestCat;

    if (!destinationParent) {
      showCustomAlert('‡¶§‡ßç‡¶∞‡ßÅ‡¶ü‡¶ø', '‡¶®‡¶§‡ßÅ‡¶® ‡¶™‡ßç‡¶Ø‡¶æ‡¶∞‡ßá‡¶®‡ßç‡¶ü ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶®‡¶ø‡¶∞‡ßç‡¶¨‡¶æ‡¶ö‡¶® ‡¶ï‡¶∞‡ßÅ‡¶®!', 'warning');
      return;
    }

    const selectedSubs = subcategories.filter(s => selectedSubcatIds.includes(s.id));
    
    // Check if any selected node is being moved into itself or its descendants
    for (const sub of selectedSubs) {
      const descendants = getSubcategoryDescendants(sub.name).map(d => d.toLowerCase());
      if (destinationParent.toLowerCase() === sub.name.toLowerCase() || descendants.includes(destinationParent.toLowerCase())) {
        showCustomAlert('‡¶§‡ßç‡¶∞‡ßÅ‡¶ü‡¶ø', `"${sub.name}" ‡¶ï‡ßá ‡¶®‡¶ø‡¶ú‡ßá‡¶∞ ‡¶≠‡ßá‡¶§‡¶∞ ‡¶¨‡¶æ ‡¶®‡¶ø‡¶ú‡ßá‡¶∞ ‡¶ö‡¶æ‡¶á‡¶≤‡ßç‡¶° ‡¶®‡ßã‡¶°‡ßá‡¶∞ ‡¶≠‡ßá‡¶§‡¶∞ ‡¶∏‡ßç‡¶•‡¶æ‡¶®‡¶æ‡¶®‡ßç‡¶§‡¶∞ ‡¶ï‡¶∞‡¶æ ‡¶∏‡¶Æ‡ßç‡¶≠‡¶¨ ‡¶®‡ßü!`, 'warning');
        return;
      }
    }

    const duplicates: { sourceSub: SubcategoryItem; targetSub: SubcategoryItem }[] = [];
    const nonDuplicates: SubcategoryItem[] = [];

    selectedSubs.forEach(s => {
      const existing = subcategories.find(
        other => !selectedSubcatIds.includes(other.id) &&
                 other.parentCategory &&
                 other.parentCategory.trim().toLowerCase() === destinationParent.trim().toLowerCase() &&
                 other.name.trim().toLowerCase() === s.name.trim().toLowerCase()
      );
      if (existing) {
        duplicates.push({ sourceSub: s, targetSub: existing });
      } else {
        nonDuplicates.push(s);
      }
    });

    if (duplicates.length > 0) {
      const dupNames = duplicates.map(d => `"${d.sourceSub.name}"`).join(', ');
      showCustomConfirm(
        '‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶Æ‡¶æ‡¶∞‡ßç‡¶ú ‡¶ì ‡¶∏‡ßç‡¶•‡¶æ‡¶®‡¶æ‡¶®‡ßç‡¶§‡¶∞ ‡¶®‡¶ø‡¶∂‡ßç‡¶ö‡¶ø‡¶§‡¶ï‡¶∞‡¶£ (Merge Confirmation)',
        `‡¶ó‡¶®‡ßç‡¶§‡¶¨‡ßç‡¶Ø ‡¶™‡ßç‡¶Ø‡¶æ‡¶∞‡ßá‡¶®‡ßç‡¶ü "${destinationParent}" ‡¶è ‡¶á‡¶§‡¶ø‡¶Æ‡¶ß‡ßç‡¶Ø‡ßá ‡¶ï‡¶ø‡¶õ‡ßÅ ‡¶®‡¶ø‡¶∞‡ßç‡¶¨‡¶æ‡¶ö‡¶ø‡¶§ ‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø (${dupNames}) ‡¶¨‡¶ø‡¶¶‡ßç‡¶Ø‡¶Æ‡¶æ‡¶® ‡¶Ü‡¶õ‡ßá‡•§\n\n‡¶Ü‡¶™‡¶®‡¶ø ‡¶ï‡¶ø ‡¶è‡¶¶‡ßá‡¶∞‡¶ï‡ßá ‡¶Æ‡¶æ‡¶∞‡ßç‡¶ú (Merge) ‡¶ï‡¶∞‡¶§‡ßá ‡¶ö‡¶æ‡¶®? ‡¶Æ‡¶æ‡¶∞‡ßç‡¶ú ‡¶ï‡¶∞‡¶≤‡ßá ‡¶è‡¶¶‡ßá‡¶∞ ‡¶∏‡¶Ç‡¶∂‡ßç‡¶≤‡¶ø‡¶∑‡ßç‡¶ü ‡¶∏‡¶ï‡¶≤ MCQ ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶ì ‡¶ö‡¶æ‡¶á‡¶≤‡ßç‡¶° ‡¶®‡ßã‡¶° ‡¶ó‡¶®‡ßç‡¶§‡¶¨‡ßç‡¶Ø‡ßá‡¶∞ ‡¶¨‡¶ø‡¶¶‡ßç‡¶Ø‡¶Æ‡¶æ‡¶® ‡¶´‡ßã‡¶≤‡ßç‡¶°‡¶æ‡¶∞‡ßá ‡¶Ø‡ßÅ‡¶ï‡ßç‡¶§ ‡¶π‡¶¨‡ßá ‡¶è‡¶¨‡¶Ç ‡¶°‡ßÅ‡¶™‡ßç‡¶≤‡¶ø‡¶ï‡ßá‡¶ü ‡¶®‡ßã‡¶°‡¶ó‡ßÅ‡¶≤‡ßã ‡¶Æ‡¶æ‡¶∞‡ßç‡¶ú ‡¶π‡ßü‡ßá ‡¶Ø‡¶æ‡¶¨‡ßá‡•§${nonDuplicates.length > 0 ? `\n\n(‡¶¨‡¶æ‡¶ï‡¶ø ${nonDuplicates.length}‡¶ü‡¶ø ‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶∏‡ßç‡¶¨‡¶æ‡¶≠‡¶æ‡¶¨‡¶ø‡¶ï‡¶≠‡¶æ‡¶¨‡ßá ‡¶∏‡ßç‡¶•‡¶æ‡¶®‡¶æ‡¶®‡ßç‡¶§‡¶∞‡¶ø‡¶§ ‡¶π‡¶¨‡ßá)` : ''}`,
        () => {
          executeBulkMergeAndMove(duplicates, nonDuplicates, destinationParent);
        },
        'warning',
        '‡¶Æ‡¶æ‡¶∞‡ßç‡¶ú ‡¶ì ‡¶Æ‡ßÅ‡¶≠ ‡¶ï‡¶∞‡ßÅ‡¶®',
        '‡¶¨‡¶æ‡¶§‡¶ø‡¶≤'
      );
    } else {
      showCustomConfirm(
        '‡¶™‡ßç‡¶Ø‡¶æ‡¶∞‡ßá‡¶®‡ßç‡¶ü ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶™‡¶∞‡¶ø‡¶¨‡¶∞‡ßç‡¶§‡¶® ‡¶®‡¶ø‡¶∂‡ßç‡¶ö‡¶ø‡¶§‡¶ï‡¶∞‡¶£',
        `‡¶Ü‡¶™‡¶®‡¶ø ‡¶ï‡¶ø ‡¶®‡¶ø‡¶∂‡ßç‡¶ö‡¶ø‡¶§‡¶≠‡¶æ‡¶¨‡ßá ‡¶®‡¶ø‡¶∞‡ßç‡¶¨‡¶æ‡¶ö‡¶ø‡¶§ ${selectedSubcatIds.length}‡¶ü‡¶ø ‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø‡¶ï‡ßá ‡¶®‡¶§‡ßÅ‡¶® ‡¶™‡ßç‡¶Ø‡¶æ‡¶∞‡ßá‡¶®‡ßç‡¶ü "${destinationParent}" ‡¶è ‡¶∏‡ßç‡¶•‡¶æ‡¶®‡¶æ‡¶®‡ßç‡¶§‡¶∞‡¶ø‡¶§ ‡¶ï‡¶∞‡¶§‡ßá ‡¶ö‡¶æ‡¶®?`,
        () => {
          if (onBulkMoveSubcategories) {
            onBulkMoveSubcategories(selectedSubcatIds, destinationParent);
          }
          const count = selectedSubcatIds.length;
          setSelectedSubcatIds([]);
          showCustomAlert('‡¶∏‡¶Æ‡ßç‡¶™‡¶®‡ßç‡¶®!', `‡¶®‡¶ø‡¶∞‡ßç‡¶¨‡¶æ‡¶ö‡¶ø‡¶§ ${count}‡¶ü‡¶ø ‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶∏‡¶´‡¶≤‡¶≠‡¶æ‡¶¨‡ßá "${destinationParent}" ‡¶è ‡¶∏‡ßç‡¶•‡¶æ‡¶®‡¶æ‡¶®‡ßç‡¶§‡¶∞‡¶ø‡¶§ ‡¶ï‡¶∞‡¶æ ‡¶π‡ßü‡ßá‡¶õ‡ßá!`, 'success');
        },
        'info'
      );
    }
  };

  // Notice & Exam publish handlers
  const handleSaveNoticeText = () => {
    if (!noticeText.trim()) {
      alert('‡¶®‡ßã‡¶ü‡¶ø‡¶∂‡ßá‡¶∞ ‡¶ú‡¶®‡ßç‡¶Ø ‡¶¨‡¶ø‡¶¨‡¶∞‡¶£ ‡¶≤‡¶ø‡¶ñ‡ßÅ‡¶®!');
      return;
    }
    onSaveNotice(noticeText.trim());
    alert('üì¢ ‡¶®‡ßã‡¶ü‡¶ø‡¶∂ ‡¶¨‡ßã‡¶∞‡ßç‡¶° ‡¶∏‡¶´‡¶≤‡¶≠‡¶æ‡¶¨‡ßá ‡¶Ü‡¶™‡¶°‡ßá‡¶ü ‡¶ï‡¶∞‡¶æ ‡¶π‡ßü‡ßá‡¶õ‡ßá!');
  };

  const MANUAL_CATEGORIES = [
    { id: 'bangla', name: 'Bangla (‡¶¨‡¶æ‡¶Ç‡¶≤‡¶æ)' },
    { id: 'bengaliLit', name: 'Bengali Literature (‡¶¨‡¶æ‡¶Ç‡¶≤‡¶æ ‡¶∏‡¶æ‡¶π‡¶ø‡¶§‡ßç‡¶Ø)' },
    { id: 'english', name: 'English (‡¶á‡¶Ç‡¶∞‡ßá‡¶ú‡¶ø)' },
    { id: 'englishLit', name: 'English Literature (‡¶á‡¶Ç‡¶∞‡ßá‡¶ú‡¶ø ‡¶∏‡¶æ‡¶π‡¶ø‡¶§‡ßç‡¶Ø)' },
    { id: 'math', name: 'Math (‡¶ó‡¶£‡¶ø‡¶§)' },
    { id: 'science', name: 'General Science (‡¶∏‡¶æ‡¶ß‡¶æ‡¶∞‡¶£ ‡¶¨‡¶ø‡¶ú‡ßç‡¶û‡¶æ‡¶®)' },
    { id: 'bdAffairs', name: 'Bangladesh Affairs (‡¶¨‡¶æ‡¶Ç‡¶≤‡¶æ‡¶¶‡ßá‡¶∂ ‡¶¨‡¶ø‡¶∑‡ßü‡¶æ‡¶¨‡¶≤‡ßÄ)' },
    { id: 'intlAffairs', name: 'International Affairs (‡¶Ü‡¶®‡ßç‡¶§‡¶∞‡ßç‡¶ú‡¶æ‡¶§‡¶ø‡¶ï ‡¶¨‡¶ø‡¶∑‡ßü‡¶æ‡¶¨‡¶≤‡ßÄ)' }
  ];

  const handleCreateLiveExam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!examTitle.trim() || !examStartTime || !examExpiryTime) {
      alert('‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ‡¶∞ ‡¶®‡¶æ‡¶Æ, ‡¶∂‡ßÅ‡¶∞‡ßÅ‡¶∞ ‡¶∏‡¶Æ‡ßü ‡¶ì ‡¶∂‡ßá‡¶∑ ‡¶∏‡¶Æ‡ßü ‡¶®‡¶ø‡¶∞‡ßç‡¶ß‡¶æ‡¶∞‡¶£ ‡¶ï‡¶∞‡ßÅ‡¶®!');
      return;
    }

    let questionIds: string[] | undefined = undefined;

    if (isManualSelection) {
      const sumOfLimits = Object.values(categoryLimits).reduce((sum: number, val: any) => sum + Number(val), 0);
      if (sumOfLimits !== Number(examQLimit)) {
        alert(`‡¶Æ‡ßã‡¶ü ‡¶®‡¶ø‡¶∞‡ßç‡¶ß‡¶æ‡¶∞‡¶ø‡¶§ ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶®‡¶∏‡¶Ç‡¶ñ‡ßç‡¶Ø‡¶æ (${examQLimit}) ‡¶è‡¶¨‡¶Ç ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶ï‡ßã‡¶ü‡¶æ‡¶∞ ‡¶Ø‡ßã‡¶ó‡¶´‡¶≤ (${sumOfLimits}) ‡¶∏‡¶Æ‡¶æ‡¶® ‡¶π‡¶§‡ßá ‡¶π‡¶¨‡ßá‡•§`);
        return;
      }

      // Check selections count
      const missingSelections: string[] = [];
      MANUAL_CATEGORIES.forEach(cat => {
        const limit = categoryLimits[cat.id] || 0;
        const selectedCount = selectedQuestionsByCategory[cat.id]?.length || 0;
        if (selectedCount !== limit) {
          missingSelections.push(`"${cat.name}" ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø‡¶§‡ßá ${limit}‡¶ü‡¶ø ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶ö‡¶æ‡¶ì‡ßü‡¶æ ‡¶π‡ßü‡ßá‡¶õ‡ßá, ‡¶ï‡¶ø‡¶®‡ßç‡¶§‡ßÅ ‡¶Ü‡¶™‡¶®‡¶ø ${selectedCount}‡¶ü‡¶ø ‡¶∏‡¶ø‡¶≤‡ßá‡¶ï‡ßç‡¶ü ‡¶ï‡¶∞‡ßá‡¶õ‡ßá‡¶®‡•§`);
        }
      });

      if (missingSelections.length > 0) {
        alert(`‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶∏‡¶ø‡¶≤‡ßá‡¶ï‡¶∂‡¶®‡ßá ‡¶§‡ßç‡¶∞‡ßÅ‡¶ü‡¶ø:\n${missingSelections.join('\n')}`);
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

    alert('üéØ ‡¶®‡¶§‡ßÅ‡¶® ‡¶Ö‡¶´‡¶ø‡¶∂‡¶ø‡ßü‡¶æ‡¶≤ ‡¶≤‡¶æ‡¶á‡¶≠ ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ ‡¶∏‡¶´‡¶≤‡¶≠‡¶æ‡¶¨‡ßá ‡¶§‡ßà‡¶∞‡¶ø ‡¶π‡ßü‡ßá‡¶õ‡ßá!');
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
      showCustomAlert('‡¶Ö‡¶∏‡¶Æ‡ßç‡¶™‡ßÇ‡¶∞‡ßç‡¶£ ‡¶§‡¶•‡ßç‡¶Ø!', '‡¶∞‡ßÅ‡¶ü‡¶ø‡¶®‡ßá‡¶∞ ‡¶∂‡¶ø‡¶∞‡ßã‡¶®‡¶æ‡¶Æ ‡¶¶‡¶ø‡¶®!', 'error');
      return;
    }

    if (routineEnableExam) {
      if (!routineExamStartTime) {
        showCustomAlert('‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ‡¶∞ ‡¶∏‡¶Æ‡ßü ‡¶¶‡¶ø‡¶®!', '‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ ‡¶∂‡ßÅ‡¶∞‡ßÅ‡¶∞ ‡¶§‡¶æ‡¶∞‡¶ø‡¶ñ ‡¶ì ‡¶∏‡¶Æ‡ßü ‡¶®‡¶ø‡¶∞‡ßç‡¶ß‡¶æ‡¶∞‡¶£ ‡¶ï‡¶∞‡ßÅ‡¶®!', 'error');
        return;
      }
      if (routineExamQuestionSelection === 'manual' && routineExamManualQuestionIds.length === 0) {
        showCustomAlert('‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶®‡¶ø‡¶∞‡ßç‡¶¨‡¶æ‡¶ö‡¶® ‡¶ï‡¶∞‡ßÅ‡¶®!', '‡¶Æ‡ßç‡¶Ø‡¶æ‡¶®‡ßÅ‡ßü‡¶æ‡¶≤ ‡¶Æ‡ßã‡¶°‡ßá ‡¶Ö‡¶®‡ßç‡¶§‡¶§ ‡ßß ‡¶ü‡¶ø ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶®‡¶ø‡¶∞‡ßç‡¶¨‡¶æ‡¶ö‡¶® ‡¶ï‡¶∞‡ßÅ‡¶®!', 'error');
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

    showCustomAlert('‡¶∏‡¶´‡¶≤!', 'üìÖ ‡¶®‡¶§‡ßÅ‡¶® ‡¶∏‡¶ø‡¶≤‡ßá‡¶¨‡¶æ‡¶∏ ‡¶∞‡ßÅ‡¶ü‡¶ø‡¶® ‡¶ì ‡¶∂‡¶ø‡¶°‡¶ø‡¶â‡¶≤‡¶° ‡¶è‡¶ï‡ßç‡¶∏‡¶æ‡¶Æ ‡¶∏‡¶´‡¶≤‡¶≠‡¶æ‡¶¨‡ßá ‡¶™‡¶æ‡¶¨‡¶≤‡¶ø‡¶∂ ‡¶ï‡¶∞‡¶æ ‡¶π‡ßü‡ßá‡¶õ‡ßá!', 'success');

    // Reset Form
    setRoutineTitle('');
    setRoutineDetails('');
    setRoutineCourseId('');
    setRoutineSelectedRootCategory('‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø');
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
    if (categoryLower.includes('‡¶ó‡¶£‡¶ø‡¶§') || categoryLower.includes('math') || subcatLower.includes('‡¶ó‡¶£‡¶ø‡¶§') || subcatLower.includes('math')) {
      return 'math';
    }

    // 2. Science
    if (categoryLower.includes('‡¶¨‡¶ø‡¶ú‡ßç‡¶û‡¶æ‡¶®') || categoryLower.includes('science') || subcatLower.includes('‡¶¨‡¶ø‡¶ú‡ßç‡¶û‡¶æ‡¶®') || subcatLower.includes('science')) {
      return 'science';
    }

    // 3. Bengali Literature
    const containsBengaliLitKeywords = ['‡¶∞‡¶¨‡ßÄ‡¶®‡ßç‡¶¶‡ßç‡¶∞‡¶®‡¶æ‡¶•', '‡¶®‡¶ú‡¶∞‡ßÅ‡¶≤', '‡¶â‡¶™‡¶®‡ßç‡¶Ø‡¶æ‡¶∏', '‡¶ï‡¶æ‡¶¨‡ßç‡¶Ø', '‡¶∞‡¶ö‡¶ø‡¶§', '‡¶≤‡ßá‡¶ñ‡¶ï', '‡¶ï‡¶¨‡¶ø', '‡¶Æ‡¶π‡¶æ‡¶ï‡¶æ‡¶¨‡ßç‡¶Ø', '‡¶®‡¶æ‡¶ü‡¶ï', '‡¶ó‡¶≤‡ßç‡¶™', '‡¶ö‡¶∞‡¶ø‡¶§‡ßç‡¶∞', '‡¶™‡ßç‡¶∞‡¶ï‡¶æ‡¶∂‡¶ø‡¶§', '‡¶™‡¶§‡ßç‡¶∞‡¶ø‡¶ï‡¶æ', '‡¶∏‡¶æ‡¶π‡¶ø‡¶§‡ßç‡¶Ø', '‡¶ï‡¶æ‡¶¨‡ßç‡¶Ø‡¶ó‡ßç‡¶∞‡¶®‡ßç‡¶•', '‡¶õ‡ßã‡¶ü‡¶ó‡¶≤‡ßç‡¶™', '‡¶™‡ßç‡¶∞‡¶π‡¶∏‡¶®', '‡¶ï‡¶æ‡¶¶‡¶Æ‡ßç‡¶¨‡¶∞‡ßÄ', '‡¶Æ‡ßá‡¶ò‡¶®‡¶æ‡¶¶‡¶¨‡¶ß'];
    if (categoryLower.includes('‡¶¨‡¶æ‡¶Ç‡¶≤‡¶æ') || subcatLower.includes('‡¶¨‡¶æ‡¶Ç‡¶≤‡¶æ')) {
      if (categoryLower.includes('‡¶∏‡¶æ‡¶π‡¶ø‡¶§‡ßç‡¶Ø') || subcatLower.includes('‡¶∏‡¶æ‡¶π‡¶ø‡¶§‡ßç‡¶Ø') || containsBengaliLitKeywords.some(kw => textLower.includes(kw) || explanationLower.includes(kw))) {
        return 'bengaliLit';
      }
      return 'bangla';
    }

    // 4. English Literature
    const containsEnglishLitKeywords = ['literature', 'shakespeare', 'poet', 'novel', 'drama', 'play', 'written by', 'author', 'poem', 'romantic age', 'literary', 'milton', 'keats', 'wordsworth', 'shelley', 'coleridge', 'byron', 'george bernard', 'ts eliot', 'macbeth', 'hamlet'];
    if (categoryLower.includes('‡¶á‡¶Ç‡¶∞‡ßá‡¶ú‡¶ø') || categoryLower.includes('english') || subcatLower.includes('‡¶á‡¶Ç‡¶∞‡ßá‡¶ú‡¶ø') || subcatLower.includes('english')) {
      if (categoryLower.includes('literature') || categoryLower.includes('‡¶∏‡¶æ‡¶π‡¶ø‡¶§‡ßç‡¶Ø') || containsEnglishLitKeywords.some(kw => textLower.includes(kw) || explanationLower.includes(kw))) {
        return 'englishLit';
      }
      return 'english';
    }

    // 5. Bangladesh Affairs
    const containsBdKeywords = ['‡¶¨‡¶æ‡¶Ç‡¶≤‡¶æ‡¶¶‡ßá‡¶∂', '‡¶¢‡¶æ‡¶ï‡¶æ', '‡¶¨‡¶ô‡ßç‡¶ó‡¶¨‡¶®‡ßç‡¶ß‡ßÅ', '‡¶Æ‡ßÅ‡¶ï‡ßç‡¶§‡¶ø‡¶Ø‡ßÅ‡¶¶‡ßç‡¶ß', '‡¶≠‡¶æ‡¶∑‡¶æ ‡¶Ü‡¶®‡ßç‡¶¶‡ßã‡¶≤‡¶®', '‡¶®‡¶¶‡ßÄ', '‡¶™‡¶¶‡ßç‡¶Æ‡¶æ ‡¶∏‡ßá‡¶§‡ßÅ', '‡¶∏‡¶Ç‡¶¨‡¶ø‡¶ß‡¶æ‡¶®', '‡¶™‡ßç‡¶∞‡¶ß‡¶æ‡¶®‡¶Æ‡¶®‡ßç‡¶§‡ßç‡¶∞‡ßÄ', '‡¶∞‡¶æ‡¶∑‡ßç‡¶ü‡ßç‡¶∞‡¶™‡¶§‡¶ø', '‡¶¨‡¶æ‡¶ú‡ßá‡¶ü', '‡¶Ö‡¶∞‡ßç‡¶•‡¶®‡ßÄ‡¶§‡¶ø', '‡¶á‡¶§‡¶ø‡¶π‡¶æ‡¶∏', '‡¶ú‡¶æ‡¶§‡ßÄ‡ßü', '‡¶∏‡¶Ç‡¶∏‡¶¶', '‡¶¨‡¶ô‡ßç‡¶ó‡¶≠‡¶ô‡ßç‡¶ó', '‡¶Æ‡ßÅ‡¶ú‡ßÄ‡¶¨', '‡¶Æ‡ßÅ‡¶ú‡¶ø‡¶¨'];
    if (categoryLower.includes('‡¶¨‡¶æ‡¶Ç‡¶≤‡¶æ‡¶¶‡ßá‡¶∂') || subcatLower.includes('‡¶¨‡¶æ‡¶Ç‡¶≤‡¶æ‡¶¶‡ßá‡¶∂') || containsBdKeywords.some(kw => textLower.includes(kw) || explanationLower.includes(kw))) {
      return 'bdAffairs';
    }

    // 6. International Affairs
    const containsIntlKeywords = ['‡¶ú‡¶æ‡¶§‡¶ø‡¶∏‡¶Ç‡¶ò', '‡¶Ü‡¶®‡ßç‡¶§‡¶∞‡ßç‡¶ú‡¶æ‡¶§‡¶ø‡¶ï', '‡¶á‡¶â‡¶ï‡ßç‡¶∞‡ßá‡¶®', '‡¶∞‡¶æ‡¶∂‡¶ø‡ßü‡¶æ', '‡¶Ü‡¶Æ‡ßá‡¶∞‡¶ø‡¶ï‡¶æ', '‡¶ö‡¶ø‡¶®', '‡¶≠‡¶æ‡¶∞‡¶§', '‡¶¨‡¶ø‡¶∂‡ßç‡¶¨', '‡¶á‡¶â‡¶∞‡ßã‡¶™', '‡¶è‡¶∂‡¶ø‡ßü‡¶æ', '‡¶∏‡ßÄ‡¶Æ‡¶æ‡¶®‡ßç‡¶§', '‡¶ö‡ßÅ‡¶ï‡ßç‡¶§‡¶ø', '‡¶∏‡¶Ç‡¶∏‡ßç‡¶•‡¶æ', '‡¶®‡ßç‡¶Ø‡¶æ‡¶ü‡ßã', 'nato', 'un ', 'treaty', 'border', 'capital', 'currency', '‡¶Æ‡ßÅ‡¶¶‡ßç‡¶∞‡¶æ', '‡¶∞‡¶æ‡¶ú‡¶ß‡¶æ‡¶®‡ßÄ'];
    if (categoryLower.includes('‡¶Ü‡¶®‡ßç‡¶§‡¶∞‡ßç‡¶ú‡¶æ‡¶§‡¶ø‡¶ï') || categoryLower.includes('international') || subcatLower.includes('‡¶Ü‡¶®‡ßç‡¶§‡¶∞‡ßç‡¶ú‡¶æ‡¶§‡¶ø‡¶ï') || containsIntlKeywords.some(kw => textLower.includes(kw) || explanationLower.includes(kw))) {
      return 'intlAffairs';
    }

    // Default GK categorization
    if (categoryLower.includes('‡¶ú‡ßç‡¶û‡¶æ‡¶®') || categoryLower.includes('gk') || subcatLower.includes('‡¶ú‡ßç‡¶û‡¶æ‡¶®')) {
      if (textLower.includes('‡¶≠‡¶æ‡¶∞‡¶§') || textLower.includes('‡¶∏‡ßÄ‡¶Æ‡¶æ‡¶®‡ßç‡¶§') || textLower.includes('‡¶ú‡¶æ‡¶§‡¶ø‡¶∏‡¶Ç‡¶ò') || textLower.includes('‡¶á‡¶â‡¶ï‡ßç‡¶∞‡ßá‡¶®') || textLower.includes('‡¶¨‡¶ø‡¶∂‡ßç‡¶¨')) {
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
  const adminAttempts = attempts.filter(a => !a.examId.startsWith('prep_') && !a.examId.startsWith('job_') && !a.examId.startsWith('custom_') && !a.examId.startsWith('demo_'));
  const activeExamResults = adminAttempts.filter(a => a.examId === selectedExamIdForResults);

  const pendingFeedbackCount = (() => {
    const commentsCount = questions.reduce((acc, q) => acc + (q.comments?.filter(c => !c.pointsApproved).length || 0), 0);
    const explsCount = questions.reduce((acc, q) => acc + (q.userExplanations?.filter(e => !e.approved).length || 0), 0);
    return commentsCount + explsCount;
  })();

  const adminNavItems = [
    { id: 'dashboard', label: '‡¶°‡ßç‡¶Ø‡¶æ‡¶∂‡¶¨‡ßã‡¶∞‡ßç‡¶° ‡¶ì‡¶≠‡¶æ‡¶∞‡¶≠‡¶ø‡¶â', icon: 'üìä', description: '‡¶è‡¶°‡¶Æ‡¶ø‡¶® ‡¶™‡ßç‡¶Ø‡¶æ‡¶®‡ßá‡¶≤‡ßá‡¶∞ ‡¶∏‡¶æ‡¶∞‡ßç‡¶¨‡¶ø‡¶ï ‡¶§‡¶•‡ßç‡¶Ø ‡¶ì ‡¶∏‡¶ø‡¶∏‡ßç‡¶ü‡ßá‡¶Æ ‡¶ì‡¶≠‡¶æ‡¶∞‡¶≠‡¶ø‡¶â' },
    { id: 'add', label: '‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶Ø‡ßã‡¶ó ‡¶ï‡¶∞‡ßÅ‡¶®', icon: 'üìù', description: '‡¶®‡¶§‡ßÅ‡¶® MCQ ‡¶§‡ßà‡¶∞‡¶ø ‡¶¨‡¶æ ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶è‡¶°‡¶ø‡¶ü‡¶ø‡¶Ç' },
    { id: 'manage', label: '‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶¨‡ßç‡¶Ø‡¶æ‡¶Ç‡¶ï ‡¶Æ‡ßç‡¶Ø‡¶æ‡¶®‡ßá‡¶ú', icon: 'üìÅ', count: questions.length, description: '‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶ñ‡ßã‡¶Å‡¶ú‡¶æ, ‡¶è‡¶°‡¶ø‡¶ü ‡¶ì ‡¶¨‡¶æ‡¶≤‡ßç‡¶ï ‡¶°‡¶ø‡¶≤‡¶ø‡¶ü' },
    { id: 'categories', label: '‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶ì ‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø', icon: 'üóÇÔ∏è', count: categories.length, description: '‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶ü‡ßç‡¶∞‡¶ø ‡¶∏‡ßç‡¶ü‡ßç‡¶∞‡¶æ‡¶ï‡¶ö‡¶æ‡¶∞ ‡¶§‡ßà‡¶∞‡¶ø' },
    { id: 'current-affairs', label: '‡¶∏‡¶æ‡¶Æ‡ßç‡¶™‡ßç‡¶∞‡¶§‡¶ø‡¶ï ‡¶¨‡¶ø‡¶∑‡ßü‡¶æ‡¶¨‡¶≤‡ßÄ', icon: 'üåç', count: subcategories.filter(s => s.parentCategory === '‡¶∏‡¶æ‡¶Æ‡ßç‡¶™‡ßç‡¶∞‡¶§‡¶ø‡¶ï ‡¶¨‡¶ø‡¶∑‡ßü‡¶æ‡¶¨‡¶≤‡ßÄ' || isCurrentAffairVariation(s.parentCategory)).length, description: '‡¶¶‡ßà‡¶®‡¶ø‡¶ï ‡¶∏‡¶æ‡¶Æ‡ßç‡¶™‡ßç‡¶∞‡¶§‡¶ø‡¶ï ‡¶§‡¶•‡ßç‡¶Ø ‡¶¨‡ßÅ‡¶≤‡ßá‡¶ü ‡¶Ü‡¶ï‡¶æ‡¶∞‡ßá ‡¶™‡ßã‡¶∏‡ßç‡¶ü ‡¶ì MCQ ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶Ü‡¶™‡¶≤‡ßã‡¶°' },
    { id: 'exams', label: '‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ ‡¶ì ‡¶®‡ßã‡¶ü‡¶ø‡¶∂ ‡¶∏‡ßá‡¶®‡ßç‡¶ü‡ßç‡¶∞‡¶æ‡¶≤', icon: '‚è±Ô∏è', count: liveExams.length, description: '‡¶≤‡¶æ‡¶á‡¶≠ ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ ‡¶ì ‡¶™‡¶™‡¶Ü‡¶™ ‡¶®‡ßã‡¶ü‡¶ø‡¶∂' },
    { id: 'courses', label: '‡¶ï‡ßã‡¶∞‡ßç‡¶∏ ‡¶Æ‡ßç‡¶Ø‡¶æ‡¶®‡ßá‡¶ú‡¶Æ‡ßá‡¶®‡ßç‡¶ü', icon: 'üéì', count: courses.length, description: '‡¶ö‡¶≤‡¶Æ‡¶æ‡¶® ‡¶ì ‡¶®‡¶§‡ßÅ‡¶® ‡¶ï‡ßã‡¶∞‡ßç‡¶∏ ‡¶è‡¶¨‡¶Ç ‡¶ï‡ßã‡¶∞‡ßç‡¶∏ ‡¶∞‡ßÅ‡¶ü‡¶ø‡¶® ‡¶Æ‡ßç‡¶Ø‡¶æ‡¶®‡ßá‡¶ú‡¶Æ‡ßá‡¶®‡ßç‡¶ü' },
    { id: 'routines', label: '‡¶∞‡ßÅ‡¶ü‡¶ø‡¶® ‡¶Æ‡ßç‡¶Ø‡¶æ‡¶®‡ßá‡¶ú‡¶Æ‡ßá‡¶®‡ßç‡¶ü', icon: 'üìÖ', count: routines.length, description: '‡¶°‡ßá‡¶á‡¶≤‡¶ø/‡¶â‡¶á‡¶ï‡¶≤‡¶ø ‡¶∏‡ßç‡¶ü‡¶æ‡¶°‡¶ø ‡¶∞‡ßÅ‡¶ü‡¶ø‡¶®' },
    { id: 'results', label: '‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ‡¶∞ ‡¶´‡¶≤‡¶æ‡¶´‡¶≤ ‡¶ì ‡¶Æ‡¶æ‡¶∞‡ßç‡¶ï‡¶∏ ‡¶≠‡¶ø‡¶â', icon: 'üìà', count: adminAttempts.length, description: '‡¶∂‡¶ø‡¶ï‡ßç‡¶∑‡¶æ‡¶∞‡ßç‡¶•‡ßÄ‡¶¶‡ßá‡¶∞ ‡¶™‡ßç‡¶∞‡¶æ‡¶™‡ßç‡¶§ ‡¶®‡¶Æ‡ßç‡¶¨‡¶∞ ‡¶¨‡¶ø‡¶∂‡ßç‡¶≤‡ßá‡¶∑‡¶£' },
    { id: 'users', label: '‡¶®‡¶ø‡¶¨‡¶®‡ßç‡¶ß‡¶ø‡¶§ ‡¶á‡¶â‡¶ú‡¶æ‡¶∞ ‡¶°‡¶æ‡¶ü‡¶æ‡¶¨‡ßá‡¶ú', icon: 'üë•', count: users.length, description: '‡¶á‡¶â‡¶ú‡¶æ‡¶∞ ‡¶∏‡ßç‡¶ü‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶∏ ‡¶ì ‡¶∞‡ßã‡¶≤ ‡¶Æ‡ßç‡¶Ø‡¶æ‡¶®‡ßá‡¶ú' },
    { id: 'feedback', label: '‡¶≠‡ßÅ‡¶≤ ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶ì ‡¶¨‡ßç‡¶Ø‡¶æ‡¶ñ‡ßç‡¶Ø‡¶æ ‡¶∞‡¶ø‡¶≠‡¶ø‡¶â', icon: 'üö©', count: pendingFeedbackCount, description: '‡¶∞‡¶ø‡¶™‡ßã‡¶∞‡ßç‡¶ü ‡¶ì ‡¶á‡¶â‡¶ú‡¶æ‡¶∞ ‡¶∏‡¶æ‡¶¨‡¶Æ‡¶ø‡¶∂‡¶® ‡¶Ö‡¶®‡ßÅ‡¶Æ‡ßã‡¶¶‡¶®' },
    { id: 'audit-logs', label: '‡¶Ö‡¶°‡¶ø‡¶ü ‡¶≤‡¶ó (Audit Log)', icon: 'üìú', count: (auditLogs || []).length, description: '‡¶è‡¶°‡¶Æ‡¶ø‡¶® ‡¶Ö‡ßç‡¶Ø‡¶æ‡¶ï‡¶∂‡¶®, ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶°‡¶ø‡¶≤‡¶ø‡¶ü, ‡¶¨‡¶æ‡¶≤‡ßç‡¶ï ‡¶Ü‡¶™‡¶°‡ßá‡¶ü ‡¶ì ‡¶Æ‡¶°‡¶ø‡¶´‡¶ø‡¶ï‡ßá‡¶∂‡¶®‡ßá‡¶∞ ‡¶π‡¶ø‡¶∏‡ßç‡¶ü‡ßã‡¶∞‡¶ø' },
    { id: 'backup', label: '‡¶¨‡ßç‡¶Ø‡¶æ‡¶ï‡¶Ü‡¶™ ‡¶ì ‡¶∞‡¶ø‡¶∏‡ßç‡¶ü‡ßã‡¶∞', icon: 'üì¶', description: '‡¶∏‡¶ø‡¶∏‡ßç‡¶ü‡ßá‡¶Æ‡ßá‡¶∞ ‡¶∏‡¶Æ‡ßç‡¶™‡ßÇ‡¶∞‡ßç‡¶£ ‡¶°‡¶æ‡¶ü‡¶æ‡¶¨‡ßá‡¶ú JSON ‡¶´‡¶æ‡¶á‡¶≤ ‡¶°‡¶æ‡¶â‡¶®‡¶≤‡ßã‡¶° ‡¶ì ‡¶∞‡¶ø‡¶∏‡ßç‡¶ü‡ßã‡¶∞' },
    { id: 'firestore-migration', label: 'Firestore Migration', icon: 'üî•', description: '‡¶´‡¶æ‡ßü‡¶æ‡¶∞‡¶∏‡ßç‡¶ü‡ßã‡¶∞ ‡¶ï‡ßç‡¶≤‡¶æ‡¶â‡¶° ‡¶°‡¶æ‡¶ü‡¶æ‡¶¨‡ßá‡¶ú ‡¶Æ‡¶æ‡¶á‡¶ó‡ßç‡¶∞‡ßá‡¶∂‡¶®, ‡¶≠‡ßá‡¶∞‡¶ø‡¶´‡¶ø‡¶ï‡ßá‡¶∂‡¶® ‡¶ì ‡¶∞‡¶ø‡¶™‡ßã‡¶∞‡ßç‡¶ü' },
  ];

  return (
    <div className="flex flex-col gap-3.5 max-h-[95vh] overflow-y-auto max-w-full overflow-x-hidden pr-1">
      {/* Admin Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-2.5 gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl transition flex items-center gap-1.5 font-bold text-xs shrink-0"
            title="‡¶®‡ßá‡¶≠‡¶ø‡¶ó‡ßá‡¶∂‡¶® ‡¶°‡ßç‡¶∞‡ßü‡¶æ‡¶∞ ‡¶ñ‡ßÅ‡¶≤‡ßÅ‡¶®"
          >
            <Menu className="w-5 h-5 text-indigo-600" />
            <span className="hidden sm:inline">‡¶Æ‡ßá‡¶®‡ßÅ ‡¶°‡ßç‡¶∞‡ßü‡¶æ‡¶∞</span>
          </button>
          <div>
            <h1 className="text-xl font-bold text-red-600 flex items-center gap-2">
              <Settings className="w-5 h-5 text-red-600 animate-spin-slow" />
              ‡¶è‡¶°‡¶Æ‡¶ø‡¶® ‡¶ï‡¶®‡ßç‡¶ü‡ßç‡¶∞‡ßã‡¶≤ ‡¶™‡ßç‡¶Ø‡¶æ‡¶®‡ßá‡¶≤ (Orjon Control Center)
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">‡¶∏‡¶¨ ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶®, ‡¶ï‡¶æ‡¶∏‡ßç‡¶ü‡¶Æ ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ, ‡¶∞‡ßÅ‡¶ü‡¶ø‡¶® ‡¶ì ‡¶®‡ßã‡¶ü‡¶ø‡¶∂ ‡¶Æ‡ßç‡¶Ø‡¶æ‡¶®‡ßá‡¶ú ‡¶ï‡¶∞‡¶æ‡¶∞ ‡¶ì‡ßü‡¶æ‡¶® ‡¶∏‡ßç‡¶ü‡¶™ ‡¶™‡ßã‡¶∞‡ßç‡¶ü‡¶æ‡¶≤</p>
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
            title="‡¶ï‡ßç‡¶≤‡¶æ‡¶â‡¶° ‡¶∏‡¶ø‡¶ô‡ßç‡¶ï ‡¶∏‡ßç‡¶ü‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶∏ ‡¶¨‡¶ø‡¶∏‡ßç‡¶§‡¶æ‡¶∞‡¶ø‡¶§ ‡¶¶‡ßá‡¶ñ‡ßÅ‡¶®"
          >
            <span className={`w-2.5 h-2.5 rounded-full ${adminSyncStats.overallPercent === 100 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <Cloud className="w-4 h-4 text-indigo-600" />
            <span>‡¶ï‡ßç‡¶≤‡¶æ‡¶â‡¶° ‡¶∏‡¶ø‡¶ô‡ßç‡¶ï: <strong className="font-mono text-sm font-black">{adminSyncStats.overallPercent.toLocaleString('bn-BD')}%</strong></span>
          </button>
          <button
            onClick={() => setActiveTab('firestore-migration')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white border border-indigo-500 text-xs font-extrabold px-3.5 py-1.5 rounded-xl transition shadow-xs flex items-center gap-1 shrink-0 cursor-pointer"
            title="Firestore Migration"
          >
            üî• Firestore Migration
          </button>
          <button
            onClick={() => setActiveTab('backup')}
            className="bg-indigo-100 hover:bg-indigo-200 text-indigo-900 border border-indigo-200 text-xs font-extrabold px-3 py-1.5 rounded-xl transition shadow-xs flex items-center gap-1 shrink-0"
            title="‡¶°‡¶æ‡¶ü‡¶æ‡¶¨‡ßá‡¶ú ‡¶¨‡ßç‡¶Ø‡¶æ‡¶ï‡¶Ü‡¶™ ‡¶ì ‡¶∞‡¶ø‡¶∏‡ßç‡¶ü‡ßã‡¶∞"
          >
            üì¶ ‡¶°‡¶æ‡¶ü‡¶æ‡¶¨‡ßá‡¶ú ‡¶¨‡ßç‡¶Ø‡¶æ‡¶ï‡¶Ü‡¶™
          </button>
          <button
            onClick={() => setIsPasswordModalOpen(true)}
            className="bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-200 text-xs font-extrabold px-3 py-1.5 rounded-xl transition shadow-xs flex items-center gap-1 shrink-0"
            title="‡¶™‡¶æ‡¶∏‡¶ì‡ßü‡¶æ‡¶∞‡ßç‡¶° ‡¶∞‡¶ø‡¶∏‡ßá‡¶ü ‡¶¨‡¶æ ‡¶™‡¶∞‡¶ø‡¶¨‡¶∞‡ßç‡¶§‡¶® ‡¶ï‡¶∞‡ßÅ‡¶®"
          >
            üîë ‡¶™‡¶æ‡¶∏‡¶ì‡ßü‡¶æ‡¶∞‡ßç‡¶° ‡¶™‡¶∞‡¶ø‡¶¨‡¶∞‡ßç‡¶§‡¶®
          </button>
          <button 
            onClick={onLogout}
            className="bg-gray-800 hover:bg-gray-950 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition shadow-sm shrink-0"
          >
            ‡¶è‡¶°‡¶Æ‡¶ø‡¶® ‡¶°‡ßç‡¶Ø‡¶æ‡¶∂‡¶¨‡ßã‡¶∞‡ßç‡¶° ‡¶•‡ßá‡¶ï‡ßá ‡¶¨‡ßá‡¶∞ ‡¶π‡¶® ‚ûî
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
                    <h3 className="font-extrabold text-[15.3px] text-white tracking-wide">‡¶è‡¶°‡¶Æ‡¶ø‡¶® ‡¶ï‡¶®‡ßç‡¶ü‡ßç‡¶∞‡ßã‡¶≤ ‡¶∏‡ßá‡¶®‡ßç‡¶ü‡¶æ‡¶∞</h3>
                    <p className="text-[10px] text-red-100 font-bold uppercase">‡¶Æ‡ßç‡¶Ø‡¶æ‡¶®‡ßá‡¶ú‡¶Æ‡ßá‡¶®‡ßç‡¶ü ‡¶®‡ßá‡¶≠‡¶ø‡¶ó‡ßá‡¶∂‡¶®</p>
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
                  ‡¶∏‡¶ï‡¶≤ ‡¶è‡¶°‡¶Æ‡¶ø‡¶® ‡¶∏‡ßá‡¶ï‡¶∂‡¶® ({adminNavItems.length}‡¶ü‡¶ø)
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
                    <span>‡¶ï‡ßç‡¶≤‡¶æ‡¶â‡¶° ‡¶∏‡¶ø‡¶ô‡ßç‡¶ï ‡¶∏‡ßç‡¶ü‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶∏:</span>
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
                  üö™ ‡¶è‡¶°‡¶Æ‡¶ø‡¶® ‡¶°‡ßç‡¶Ø‡¶æ‡¶∂‡¶¨‡ßã‡¶∞‡ßç‡¶° ‡¶•‡ßá‡¶ï‡ßá ‡¶¨‡ßá‡¶∞ ‡¶π‡¶®
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
          <span>‡¶Æ‡ßá‡¶®‡ßÅ ‡¶°‡ßç‡¶∞‡ßü‡¶æ‡¶∞</span>
        </button>
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={`flex-1 min-w-[90px] py-2 px-3 border-b-2 font-bold text-center transition shrink-0 ${activeTab === 'dashboard' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-indigo-600'}`}
        >
          üìä ‡¶°‡ßç‡¶Ø‡¶æ‡¶∂‡¶¨‡ßã‡¶∞‡ßç‡¶°
        </button>
        <button 
          onClick={() => setActiveTab('add')}
          className={`flex-1 min-w-[90px] py-2 px-3 border-b-2 font-bold text-center transition shrink-0 ${activeTab === 'add' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-indigo-600'}`}
        >
          üìù ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶Ø‡ßã‡¶ó
        </button>
        <button 
          onClick={() => setActiveTab('manage')}
          className={`flex-1 min-w-[90px] py-2 px-3 border-b-2 font-bold text-center transition shrink-0 ${activeTab === 'manage' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-indigo-600'}`}
        >
          üìÅ ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶Æ‡ßç‡¶Ø‡¶æ‡¶®‡ßá‡¶ú ({questions.length})
        </button>
        <button 
          onClick={() => setActiveTab('categories')}
          className={`flex-1 min-w-[90px] py-2 px-3 border-b-2 font-bold text-center transition shrink-0 ${activeTab === 'categories' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-indigo-600'}`}
        >
          üóÇÔ∏è ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶ì ‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø
        </button>
        <button 
          onClick={() => setActiveTab('current-affairs')}
          className={`flex-1 min-w-[105px] py-2 px-3 border-b-2 font-bold text-center transition shrink-0 ${activeTab === 'current-affairs' ? 'border-teal-600 text-teal-600 font-black' : 'border-transparent text-gray-500 hover:text-teal-600'}`}
        >
          üåç ‡¶∏‡¶æ‡¶Æ‡ßç‡¶™‡ßç‡¶∞‡¶§‡¶ø‡¶ï ‡¶¨‡¶ø‡¶∑‡ßü‡¶æ‡¶¨‡¶≤‡ßÄ
        </button>
        <button 
          onClick={() => setActiveTab('exams')}
          className={`flex-1 min-w-[90px] py-2 px-3 border-b-2 font-bold text-center transition shrink-0 ${activeTab === 'exams' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-indigo-600'}`}
        >
          ‚è±Ô∏è ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ ‡¶ì ‡¶®‡ßã‡¶ü‡¶ø‡¶∂
        </button>
        <button 
          onClick={() => setActiveTab('courses')}
          className={`flex-1 min-w-[90px] py-2 px-3 border-b-2 font-bold text-center transition shrink-0 ${activeTab === 'courses' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-indigo-600'}`}
        >
          üéì ‡¶ï‡ßã‡¶∞‡ßç‡¶∏ ‡¶Æ‡ßç‡¶Ø‡¶æ‡¶®‡ßá‡¶ú ({courses.length})
        </button>
        <button 
          onClick={() => setActiveTab('routines')}
          className={`flex-1 min-w-[90px] py-2 px-3 border-b-2 font-bold text-center transition shrink-0 ${activeTab === 'routines' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-indigo-600'}`}
        >
          üìÖ ‡¶∞‡ßÅ‡¶ü‡¶ø‡¶® ‡¶Æ‡ßç‡¶Ø‡¶æ‡¶®‡ßá‡¶ú
        </button>
        <button 
          onClick={() => setActiveTab('results')}
          className={`flex-1 min-w-[90px] py-2 px-3 border-b-2 font-bold text-center transition shrink-0 ${activeTab === 'results' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-indigo-600'}`}
        >
          üìà ‡¶Æ‡¶æ‡¶∞‡ßç‡¶ï‡¶∏ ‡¶≠‡¶ø‡¶â ({adminAttempts.length})
        </button>
        <button 
          onClick={() => setActiveTab('users')}
          className={`flex-1 min-w-[90px] py-2 px-3 border-b-2 font-bold text-center transition shrink-0 ${activeTab === 'users' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-indigo-600'}`}
        >
          üë• ‡¶á‡¶â‡¶ú‡¶æ‡¶∞ ‡¶≤‡¶ø‡¶∏‡ßç‡¶ü ({users.length})
        </button>
        <button 
          onClick={() => setActiveTab('feedback')}
          className={`flex-1 min-w-[90px] py-2 px-3 border-b-2 font-bold text-center transition shrink-0 ${activeTab === 'feedback' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-indigo-600'}`}
        >
          üö© ‡¶≠‡ßÅ‡¶≤ ‡¶ì ‡¶¨‡ßç‡¶Ø‡¶æ‡¶ñ‡ßç‡¶Ø‡¶æ ‡¶∞‡¶ø‡¶≠‡¶ø‡¶â ({pendingFeedbackCount})
        </button>
        <button 
          onClick={() => setActiveTab('audit-logs')}
          className={`flex-1 min-w-[100px] py-2 px-3 border-b-2 font-bold text-center transition shrink-0 ${activeTab === 'audit-logs' ? 'border-indigo-600 text-indigo-600 font-extrabold' : 'border-transparent text-gray-500 hover:text-indigo-600'}`}
        >
          üìú ‡¶Ö‡¶°‡¶ø‡¶ü ‡¶≤‡¶ó ({ (auditLogs || []).length })
        </button>
        <button 
          onClick={() => setActiveTab('backup')}
          className={`flex-1 min-w-[90px] py-2 px-3 border-b-2 font-bold text-center transition shrink-0 ${activeTab === 'backup' ? 'border-indigo-600 text-indigo-600 font-extrabold' : 'border-transparent text-gray-500 hover:text-indigo-600'}`}
        >
          üì¶ ‡¶¨‡ßç‡¶Ø‡¶æ‡¶ï‡¶Ü‡¶™ ‡¶ì ‡¶∞‡¶ø‡¶∏‡ßç‡¶ü‡ßã‡¶∞
        </button>
        <button 
          onClick={() => setActiveTab('firestore-migration')}
          className={`flex-1 min-w-[130px] py-2 px-3 border-b-2 font-bold text-center transition shrink-0 ${activeTab === 'firestore-migration' ? 'border-indigo-600 text-indigo-600 font-black' : 'border-transparent text-gray-500 hover:text-indigo-600'}`}
        >
          üî• Firestore Migration
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
                  ‡¶∏‡¶ø‡¶∏‡ßç‡¶ü‡ßá‡¶Æ ‡¶ì‡¶≠‡¶æ‡¶∞‡¶≠‡¶ø‡¶â
                </span>
                <span className="text-xs text-indigo-200">‡¶Ö‡¶∞‡ßç‡¶ú‡¶® ‡¶è‡¶°‡¶Æ‡¶ø‡¶® ‡¶ï‡¶®‡ßç‡¶ü‡ßç‡¶∞‡ßã‡¶≤ ‡¶∏‡ßá‡¶®‡ßç‡¶ü‡¶æ‡¶∞</span>
              </div>
              <h2 className="text-lg font-black tracking-tight">‡¶è‡¶°‡¶Æ‡¶ø‡¶® ‡¶™‡ßç‡¶Ø‡¶æ‡¶®‡ßá‡¶≤ ‡¶°‡ßç‡¶Ø‡¶æ‡¶∂‡¶¨‡ßã‡¶∞‡ßç‡¶° ‡¶∏‡¶æ‡¶Æ‡¶æ‡¶∞‡¶ø</h2>
              <p className="text-xs text-indigo-100 mt-1 max-w-xl">
                ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶¨‡ßç‡¶Ø‡¶æ‡¶Ç‡¶ï, ‡¶≤‡¶æ‡¶á‡¶≠ ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ, ‡¶®‡¶ø‡¶¨‡¶®‡ßç‡¶ß‡¶ø‡¶§ ‡¶∂‡¶ø‡¶ï‡ßç‡¶∑‡¶æ‡¶∞‡ßç‡¶•‡ßÄ, ‡¶™‡ßü‡ßá‡¶®‡ßç‡¶ü ‡¶ï‡¶®‡ßç‡¶ü‡ßç‡¶∞‡¶ø‡¶¨‡¶ø‡¶â‡¶∂‡¶® ‡¶è‡¶¨‡¶Ç ‡¶∞‡ßÅ‡¶ü‡¶ø‡¶® ‡¶∏‡¶ø‡¶∏‡ßç‡¶ü‡ßá‡¶Æ‡ßá‡¶∞ ‡¶∞‡¶ø‡ßü‡ßá‡¶≤-‡¶ü‡¶æ‡¶á‡¶Æ ‡¶™‡¶∞‡¶ø‡¶∏‡¶Ç‡¶ñ‡ßç‡¶Ø‡¶æ‡¶® ‡¶™‡¶∞‡ßç‡¶Ø‡¶¨‡ßá‡¶ï‡ßç‡¶∑‡¶£ ‡¶ï‡¶∞‡ßÅ‡¶®‡•§
              </p>
            </div>
            <button
              onClick={() => setActiveTab('add')}
              className="bg-white hover:bg-indigo-50 text-indigo-900 font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-sm transition flex items-center gap-1.5 shrink-0"
            >
              <Plus className="w-4 h-4 text-indigo-600" />
              <span>‡¶®‡¶§‡ßÅ‡¶® ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶Ø‡ßã‡¶ó ‡¶ï‡¶∞‡ßÅ‡¶®</span>
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
                      <span>‡¶ï‡ßç‡¶≤‡¶æ‡¶â‡¶° ‡¶∏‡¶ø‡¶ô‡ßç‡¶ï ‡¶∏‡ßç‡¶ü‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶∏ (Firebase Cloud Sync)</span>
                    </h3>
                    <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${
                      adminSyncStats.overallPercent === 100
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                    }`}>
                      {adminSyncStats.overallPercent === 100 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                      <span>{adminSyncStats.overallPercent.toLocaleString('bn-BD')}% ‡¶∏‡¶ø‡¶ô‡ßç‡¶ï‡¶°</span>
                    </span>
                  </div>
                  <p className="text-xs text-indigo-200/90 mt-0.5">
                    ‡¶Ö‡ßç‡¶Ø‡¶æ‡¶°‡¶Æ‡¶ø‡¶®‡ßá‡¶∞ ‡¶§‡ßà‡¶∞‡¶ø/‡¶Ü‡¶™‡¶°‡ßá‡¶ü ‡¶ï‡¶∞‡¶æ ‡¶∏‡¶ï‡¶≤ ‡¶ï‡ßã‡¶∞‡ßç‡¶∏, ‡¶∞‡ßÅ‡¶ü‡¶ø‡¶®, ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶ì ‡¶Ö‡¶®‡ßç‡¶Ø‡¶æ‡¶®‡ßç‡¶Ø ‡¶ï‡¶®‡¶ü‡ßá‡¶®‡ßç‡¶ü ‡¶ï‡ßç‡¶≤‡¶æ‡¶â‡¶°‡ßá ‡¶∏‡ßÅ‡¶∞‡¶ï‡ßç‡¶∑‡¶æ‡¶∞ ‡¶≤‡¶æ‡¶á‡¶≠ ‡¶™‡¶∞‡¶ø‡¶Æ‡¶æ‡¶™‡•§
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
                  title="‡¶´‡¶æ‡ßü‡¶æ‡¶∞‡¶∏‡ßç‡¶ü‡ßã‡¶∞ ‡¶≤‡¶æ‡¶á‡¶≠ ‡¶°‡¶æ‡¶ü‡¶æ ‡¶ï‡¶æ‡¶â‡¶®‡ßç‡¶ü ‡¶Ø‡¶æ‡¶ö‡¶æ‡¶á ‡¶ï‡¶∞‡ßÅ‡¶®"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isCountingFirestore ? 'animate-spin' : ''}`} />
                  <span>‡¶ï‡¶æ‡¶â‡¶®‡ßç‡¶ü ‡¶∞‡¶ø‡¶´‡ßç‡¶∞‡ßá‡¶∂</span>
                </button>

                <button
                  type="button"
                  onClick={handleSyncAllAdminData}
                  disabled={isSyncingAllAdminData}
                  className="flex-1 sm:flex-none px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-950/40 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                  title="‡¶∏‡¶ï‡¶≤ ‡¶è‡¶°‡¶Æ‡¶ø‡¶® ‡¶°‡¶æ‡¶ü‡¶æ ‡¶ï‡ßç‡¶≤‡¶æ‡¶â‡¶°‡ßá ‡¶∏‡¶ø‡¶ô‡ßç‡¶ï ‡¶ï‡¶∞‡ßÅ‡¶®"
                >
                  <UploadCloud className={`w-4 h-4 ${isSyncingAllAdminData ? 'animate-bounce' : ''}`} />
                  <span>{isSyncingAllAdminData ? '‡¶∏‡¶ø‡¶ô‡ßç‡¶ï ‡¶π‡¶ö‡ßç‡¶õ‡ßá...' : '‚ö° ‡¶ï‡ßç‡¶≤‡¶æ‡¶â‡¶°‡ßá ‡¶∏‡¶ï‡¶≤ ‡¶°‡ßá‡¶ü‡¶æ ‡¶∏‡¶ø‡¶ô‡ßç‡¶ï ‡¶ï‡¶∞‡ßÅ‡¶®'}</span>
                </button>
              </div>
            </div>

            {/* Sync Progress Bar if Active */}
            {syncProgress && (
              <div className="bg-indigo-950/80 p-3.5 rounded-2xl border border-indigo-700/50 flex flex-col gap-2 animate-fade-in">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-indigo-200 flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                    <span>‡¶∏‡¶ø‡¶ô‡ßç‡¶ï ‡¶Ö‡¶ó‡ßç‡¶∞‡¶ó‡¶§‡¶ø: {syncProgress.currentCollection}</span>
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
                  ‡¶∏‡¶æ‡¶∞‡ßç‡¶¨‡¶ø‡¶ï ‡¶ï‡ßç‡¶≤‡¶æ‡¶â‡¶° ‡¶∏‡¶ø‡¶ô‡ßç‡¶ï ‡¶π‡¶æ‡¶∞ (Overall Sync)
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
                    ? '‚úÖ ‡¶∏‡¶ï‡¶≤ ‡¶Ö‡ßç‡¶Ø‡¶æ‡¶°‡¶Æ‡¶ø‡¶® ‡¶°‡ßá‡¶ü‡¶æ ‡¶ï‡ßç‡¶≤‡¶æ‡¶â‡¶°‡ßá ‡¶∏‡ßÅ‡¶∞‡¶ï‡ßç‡¶∑‡¶ø‡¶§ ‡¶ì ‡¶∂‡¶§‡¶≠‡¶æ‡¶ó ‡¶∏‡¶ø‡¶ô‡ßç‡¶ï‡¶°'
                    : `‚ö†Ô∏è ${Math.max(0, adminSyncStats.totalLocal - adminSyncStats.totalSynced).toLocaleString('bn-BD')} ‡¶ü‡¶ø ‡¶°‡ßá‡¶ü‡¶æ ‡¶ï‡ßç‡¶≤‡¶æ‡¶â‡¶°‡ßá ‡¶∏‡¶ø‡¶ô‡ßç‡¶ï ‡¶ï‡¶∞‡¶æ ‡¶¨‡¶æ‡¶ï‡¶ø`}
                </span>
              </div>

              {/* Counts Breakdown Stats */}
              <div className="md:col-span-8 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className="bg-indigo-950/40 border border-indigo-800/30 p-3 rounded-xl flex flex-col justify-between">
                  <span className="text-[10px] text-indigo-300 font-bold uppercase">‡¶Æ‡ßã‡¶ü ‡¶Ö‡ßç‡¶Ø‡¶æ‡¶°‡¶Æ‡¶ø‡¶® ‡¶°‡ßá‡¶ü‡¶æ</span>
                  <span className="text-xl font-black text-white mt-1">
                    {adminSyncStats.totalLocal.toLocaleString('bn-BD')} ‡¶ü‡¶ø
                  </span>
                  <span className="text-[10px] text-gray-400">‡¶≤‡ßã‡¶ï‡¶æ‡¶≤ ‡¶∏‡ßç‡¶ü‡ßã‡¶∞‡ßá‡¶ú‡ßá ‡¶∏‡¶Ç‡¶∞‡¶ï‡ßç‡¶∑‡¶ø‡¶§</span>
                </div>

                <div className="bg-indigo-950/40 border border-indigo-800/30 p-3 rounded-xl flex flex-col justify-between">
                  <span className="text-[10px] text-emerald-300 font-bold uppercase">‡¶ï‡ßç‡¶≤‡¶æ‡¶â‡¶°‡ßá ‡¶∏‡¶Ç‡¶∞‡¶ï‡ßç‡¶∑‡¶ø‡¶§</span>
                  <span className="text-xl font-black text-emerald-400 mt-1">
                    {adminSyncStats.totalSynced.toLocaleString('bn-BD')} ‡¶ü‡¶ø
                  </span>
                  <span className="text-[10px] text-emerald-400/80">Firestore ‡¶≤‡¶æ‡¶á‡¶≠ ‡¶∞‡ßá‡¶ï‡¶∞‡ßç‡¶°</span>
                </div>

                <div className="bg-indigo-950/40 border border-indigo-800/30 p-3 rounded-xl flex flex-col justify-between col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-amber-300 font-bold uppercase">‡¶™‡ßá‡¶®‡ßç‡¶°‡¶ø‡¶Ç ‡¶∏‡¶ø‡¶ô‡ßç‡¶ï ‡¶°‡ßá‡¶ü‡¶æ</span>
                  <span className="text-xl font-black text-amber-400 mt-1">
                    {Math.max(0, adminSyncStats.totalLocal - adminSyncStats.totalSynced).toLocaleString('bn-BD')} ‡¶ü‡¶ø
                  </span>
                  <span className="text-[10px] text-amber-400/80">‡¶∏‡¶ø‡¶ô‡ßç‡¶ï ‡¶¨‡¶æ‡¶ü‡¶®‡ßá ‡¶ö‡¶æ‡¶™‡ßÅ‡¶®</span>
                </div>
              </div>
            </div>

            {/* Individual 8 Admin Collections Grid */}
            <div>
              <div className="flex justify-between items-center mb-2 px-1">
                <span className="text-[11px] font-extrabold text-indigo-300 uppercase tracking-wider">
                  ‡¶ï‡¶æ‡¶≤‡ßá‡¶ï‡¶∂‡¶®‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶ï‡ßç‡¶≤‡¶æ‡¶â‡¶° ‡¶∏‡¶ø‡¶ô‡ßç‡¶ï ‡¶∂‡¶§‡¶æ‡¶Ç‡¶∂ (Collection Breakdown):
                </span>
                <span className="text-[10px] text-indigo-400 font-mono">‡ßÆ‡¶ü‡¶ø ‡¶Ö‡ßç‡¶Ø‡¶æ‡¶°‡¶Æ‡¶ø‡¶® ‡¶ï‡¶æ‡¶≤‡ßá‡¶ï‡¶∂‡¶®</span>
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
                          title={`‡¶∂‡ßÅ‡¶ß‡ßÅ‡¶Æ‡¶æ‡¶§‡ßç‡¶∞ ${item.name} ‡¶∏‡¶ø‡¶ô‡ßç‡¶ï ‡¶ï‡¶∞‡ßÅ‡¶®`}
                        >
                          <RefreshCw className={`w-2.5 h-2.5 ${isSingleSyncing ? 'animate-spin' : ''}`} />
                        </button>
                      </div>

                      {/* Numbers */}
                      <div className="flex items-center justify-between text-[11px] border-t border-indigo-900/50 pt-1.5">
                        <span className="text-indigo-200">
                          ‡¶≤‡ßã‡¶ï‡¶æ‡¶≤: <strong className="text-white font-mono">{item.local.toLocaleString('bn-BD')}</strong>
                        </span>
                        <span className="text-indigo-200">
                          ‡¶ï‡ßç‡¶≤‡¶æ‡¶â‡¶°: <strong className="text-emerald-400 font-mono">{item.cloud.toLocaleString('bn-BD')}</strong>
                        </span>
                      </div>

                      {/* Mini Progress Bar */}
                      <div>
                        <div className="flex justify-between items-center text-[10px] font-bold mb-1">
                          <span className={item.isFullySynced ? 'text-emerald-400' : 'text-amber-400'}>
                            {item.isFullySynced ? '‡¶∏‡¶ø‡¶ô‡ßç‡¶ï‡¶°' : '‡¶™‡ßá‡¶®‡ßç‡¶°‡¶ø‡¶Ç'}
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
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">‡¶∂‡¶ø‡¶ï‡ßç‡¶∑‡¶æ‡¶∞‡ßç‡¶•‡ßÄ ‡¶°‡¶æ‡¶ü‡¶æ‡¶¨‡ßá‡¶ú</span>
                <span className="text-xl">üë•</span>
              </div>
              <div>
                <span className="text-2xl font-black text-indigo-950 block">{users.length.toLocaleString('bn-BD')}</span>
                <span className="text-[10px] text-indigo-600 font-semibold">‡¶®‡¶ø‡¶¨‡¶®‡ßç‡¶ß‡¶ø‡¶§ ‡¶∂‡¶ø‡¶ï‡ßç‡¶∑‡¶æ‡¶∞‡ßç‡¶•‡ßÄ ‚ûî</span>
              </div>
            </div>

            <div 
              onClick={() => setActiveTab('manage')}
              className="bg-white hover:bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 shadow-xs cursor-pointer transition flex flex-col justify-between"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶≠‡¶æ‡¶®‡ßç‡¶°‡¶æ‡¶∞ (Firestore)
                </span>
                <span className="text-xl">üìÅ</span>
              </div>
              <div>
                <span className="text-2xl font-black text-indigo-950 block">
                  {(firestoreCounts?.questions ?? questions.length).toLocaleString('bn-BD')}
                </span>
                <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                  ‡¶´‡¶æ‡ßü‡¶æ‡¶∞‡¶∏‡ßç‡¶ü‡ßã‡¶∞ "questions" ‡¶≤‡¶æ‡¶á‡¶≠ ‡¶°‡¶æ‡¶ü‡¶æ ‚ûî
                </span>
              </div>
            </div>

            <div 
              onClick={() => setActiveTab('categories')}
              className="bg-white hover:bg-indigo-50/50 p-4 rounded-2xl border border-gray-100 shadow-xs cursor-pointer transition flex flex-col justify-between"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶ü‡ßç‡¶∞‡¶ø</span>
                <span className="text-xl">üóÇÔ∏è</span>
              </div>
              <div>
                <span className="text-2xl font-black text-indigo-950 block">{categories.length.toLocaleString('bn-BD')}</span>
                <span className="text-[10px] text-indigo-600 font-semibold">‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶ó‡ßç‡¶∞‡ßÅ‡¶™ ‚ûî</span>
              </div>
            </div>

            <div 
              onClick={() => setActiveTab('exams')}
              className="bg-white hover:bg-indigo-50/50 p-4 rounded-2xl border border-gray-100 shadow-xs cursor-pointer transition flex flex-col justify-between"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">‡¶≤‡¶æ‡¶á‡¶≠ ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ</span>
                <span className="text-xl">‚è±Ô∏è</span>
              </div>
              <div>
                <span className="text-2xl font-black text-indigo-950 block">{liveExams.length.toLocaleString('bn-BD')}</span>
                <span className="text-[10px] text-indigo-600 font-semibold">‡¶ö‡¶≤‡¶Æ‡¶æ‡¶® ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ ‚ûî</span>
              </div>
            </div>

            <div 
              onClick={() => setActiveTab('routines')}
              className="bg-white hover:bg-indigo-50/50 p-4 rounded-2xl border border-gray-100 shadow-xs cursor-pointer transition flex flex-col justify-between"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">‡¶∏‡ßç‡¶ü‡¶æ‡¶°‡¶ø ‡¶∞‡ßÅ‡¶ü‡¶ø‡¶®</span>
                <span className="text-xl">üìÖ</span>
              </div>
              <div>
                <span className="text-2xl font-black text-indigo-950 block">{routines.length.toLocaleString('bn-BD')}</span>
                <span className="text-[10px] text-indigo-600 font-semibold">‡¶∏‡¶ï‡ßç‡¶∞‡¶ø‡ßü ‡¶∏‡ßÇ‡¶ö‡¶ø ‚ûî</span>
              </div>
            </div>

            <div 
              onClick={() => setActiveTab('results')}
              className="bg-white hover:bg-indigo-50/50 p-4 rounded-2xl border border-gray-100 shadow-xs cursor-pointer transition flex flex-col justify-between"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ‡¶∞ ‡¶Æ‡¶æ‡¶∞‡ßç‡¶ï‡¶∏</span>
                <span className="text-xl">üìà</span>
              </div>
              <div>
                <span className="text-2xl font-black text-indigo-950 block">{adminAttempts.length.toLocaleString('bn-BD')}</span>
                <span className="text-[10px] text-indigo-600 font-semibold">‡¶Æ‡ßã‡¶ü ‡¶∏‡¶æ‡¶¨‡¶Æ‡¶ø‡¶∂‡¶® ‚ûî</span>
              </div>
            </div>

            <div 
              onClick={() => setActiveTab('feedback')}
              className="bg-white hover:bg-amber-50/50 p-4 rounded-2xl border border-amber-100 shadow-xs cursor-pointer transition flex flex-col justify-between"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">‡¶∞‡¶ø‡¶≠‡¶ø‡¶â ‡¶ì ‡¶∞‡¶ø‡¶™‡ßã‡¶∞‡ßç‡¶ü</span>
                <span className="text-xl">üö©</span>
              </div>
              <div>
                <span className="text-2xl font-black text-amber-700 block">{pendingFeedbackCount.toLocaleString('bn-BD')}</span>
                <span className="text-[10px] text-amber-800 font-semibold">‡¶™‡ßá‡¶®‡ßç‡¶°‡¶ø‡¶Ç ‡¶Ü‡¶á‡¶ü‡ßá‡¶Æ ‚ûî</span>
              </div>
            </div>

            <div 
              onClick={() => setActiveTab('feedback')}
              className="bg-white hover:bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 shadow-xs cursor-pointer transition flex flex-col justify-between"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">‡¶ï‡¶®‡ßç‡¶ü‡ßç‡¶∞‡¶ø‡¶¨‡¶ø‡¶â‡¶∂‡¶® ‡¶™‡ßü‡ßá‡¶®‡ßç‡¶ü</span>
                <span className="text-xl">ü™ô</span>
              </div>
              <div>
                <span className="text-2xl font-black text-emerald-700 block">{totalApprovedPoints.toLocaleString('bn-BD')}</span>
                <span className="text-[10px] text-emerald-800 font-semibold">‡¶Ö‡¶®‡ßÅ‡¶Æ‡ßã‡¶¶‡¶ø‡¶§ ‡¶™‡ßü‡ßá‡¶®‡ßç‡¶ü ‚ûî</span>
              </div>
            </div>

            <div 
              onClick={() => setActiveTab('audit-logs')}
              className="bg-white hover:bg-purple-50/50 p-4 rounded-2xl border border-purple-100 shadow-xs cursor-pointer transition flex flex-col justify-between"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-purple-900 uppercase tracking-wider">‡¶Ö‡¶°‡¶ø‡¶ü ‡¶≤‡¶ó (Audit Log)</span>
                <span className="text-xl">üìú</span>
              </div>
              <div>
                <span className="text-2xl font-black text-purple-950 block">{(auditLogs || []).length.toLocaleString('bn-BD')}</span>
                <span className="text-[10px] text-purple-700 font-semibold">‡¶è‡¶°‡¶Æ‡¶ø‡¶® ‡¶Ö‡ßç‡¶Ø‡¶æ‡¶ï‡¶∂‡¶® ‡¶π‡¶ø‡¶∏‡ßç‡¶ü‡ßã‡¶∞‡¶ø ‚ûî</span>
              </div>
            </div>

            <div 
              onClick={() => setActiveTab('backup')}
              className="bg-white hover:bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 shadow-xs cursor-pointer transition flex flex-col justify-between"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider">‡¶°‡¶æ‡¶ü‡¶æ‡¶¨‡ßá‡¶ú ‡¶¨‡ßç‡¶Ø‡¶æ‡¶ï‡¶Ü‡¶™</span>
                <span className="text-xl">üì¶</span>
              </div>
              <div>
                <span className="text-sm font-extrabold text-indigo-950 block">‡¶¨‡ßç‡¶Ø‡¶æ‡¶ï‡¶Ü‡¶™ ‡¶°‡¶æ‡¶â‡¶®‡¶≤‡ßã‡¶°/‡¶∞‡¶ø‡¶∏‡ßç‡¶ü‡ßã‡¶∞</span>
                <span className="text-[10px] text-indigo-600 font-semibold">JSON ‡¶¨‡ßç‡¶Ø‡¶æ‡¶ï‡¶Ü‡¶™ ‡¶´‡¶æ‡¶á‡¶≤ ‚ûî</span>
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
                    ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶Ö‡¶®‡ßÅ‡¶Ø‡¶æ‡ßü‡ßÄ ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶¨‡¶£‡ßç‡¶ü‡¶®
                  </h3>
                  <button
                    onClick={() => setActiveTab('categories')}
                    className="text-[10px] font-bold text-indigo-600 hover:underline"
                  >
                    ‡¶∏‡¶ï‡¶≤ ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‚ûî
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
                          <span className="text-indigo-600">{count.toLocaleString('bn-BD')}‡¶ü‡¶ø ({pct.toLocaleString('bn-BD')}%)</span>
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
                  ‡¶è‡¶°‡¶Æ‡¶ø‡¶® ‡¶¶‡ßç‡¶∞‡ßÅ‡¶§ ‡¶®‡ßá‡¶≠‡¶ø‡¶ó‡ßá‡¶∂‡¶® ‡¶Æ‡¶°‡¶ø‡¶â‡¶≤
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    onClick={() => setActiveTab('add')}
                    className="p-3 bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-100 rounded-xl text-left transition flex items-center gap-2.5"
                  >
                    <span className="text-2xl">üìù</span>
                    <div>
                      <h4 className="font-extrabold text-xs text-indigo-950">‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶Ø‡ßã‡¶ó</h4>
                      <p className="text-[9px] text-indigo-700">MCQ ‡¶è‡¶®‡ßç‡¶ü‡ßç‡¶∞‡¶ø ‡¶ì ‡¶ü‡¶æ‡¶á‡¶™‡¶ø‡¶Ç</p>
                    </div>
                  </button>

                  <button
                    onClick={() => setActiveTab('manage')}
                    className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-xl text-left transition flex items-center gap-2.5"
                  >
                    <span className="text-2xl">üìÅ</span>
                    <div>
                      <h4 className="font-extrabold text-xs text-slate-900">‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶¨‡ßç‡¶Ø‡¶æ‡¶Ç‡¶ï</h4>
                      <p className="text-[9px] text-slate-500">‡¶°‡¶æ‡¶ü‡¶æ‡¶¨‡ßá‡¶ú ‡¶∏‡¶æ‡¶∞‡ßç‡¶ö ‡¶ì ‡¶´‡¶ø‡¶≤‡ßç‡¶ü‡¶æ‡¶∞</p>
                    </div>
                  </button>

                  <button
                    onClick={() => setActiveTab('exams')}
                    className="p-3 bg-amber-50 hover:bg-amber-100/80 border border-amber-100 rounded-xl text-left transition flex items-center gap-2.5"
                  >
                    <span className="text-2xl">‚è±Ô∏è</span>
                    <div>
                      <h4 className="font-extrabold text-xs text-amber-950">‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ ‡¶ì ‡¶®‡ßã‡¶ü‡¶ø‡¶∂</h4>
                      <p className="text-[9px] text-amber-800">‡¶Æ‡¶ï ‡¶ü‡ßá‡¶∏‡ßç‡¶ü ‡¶ì ‡¶™‡¶™‡¶Ü‡¶™</p>
                    </div>
                  </button>

                  <button
                    onClick={() => setActiveTab('feedback')}
                    className="p-3 bg-rose-50 hover:bg-rose-100/80 border border-rose-100 rounded-xl text-left transition flex items-center gap-2.5"
                  >
                    <span className="text-2xl">üö©</span>
                    <div>
                      <h4 className="font-extrabold text-xs text-rose-950">‡¶≠‡ßÅ‡¶≤ ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶∞‡¶ø‡¶≠‡¶ø‡¶â</h4>
                      <p className="text-[9px] text-rose-800">‡¶∞‡¶ø‡¶™‡ßã‡¶∞‡ßç‡¶ü ‡¶ì ‡¶™‡ßü‡ßá‡¶®‡ßç‡¶ü ‡¶Ö‡ßç‡¶Ø‡¶æ‡¶™‡ßç‡¶∞‡ßÅ‡¶≠</p>
                    </div>
                  </button>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center text-[10px] text-gray-400 font-bold">
                <span>‡¶Ö‡¶∞‡ßç‡¶ú‡¶® ‡¶∏‡¶ø‡¶ï‡¶ø‡¶â‡¶∞ ‡¶è‡¶°‡¶Æ‡¶ø‡¶® ‡¶á‡¶û‡ßç‡¶ú‡¶ø‡¶® v2.5</span>
                <span className="text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  ‡¶∏‡¶ø‡¶∏‡ßç‡¶ü‡ßá‡¶Æ ‡¶∏‡ßç‡¶ü‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶∏: ‡¶Ö‡¶®‡¶≤‡¶æ‡¶á‡¶®
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
              {editingId ? '‚úèÔ∏è ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶®‡¶ü‡¶ø ‡¶è‡¶°‡¶ø‡¶ü ‡¶ï‡¶∞‡ßÅ‡¶®' : 'üìù ‡¶®‡¶§‡ßÅ‡¶® ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶ü‡¶æ‡¶á‡¶™ ‡¶ï‡¶∞‡ßÅ‡¶®'}
            </h2>
            <form onSubmit={handleSaveQuestion} className="space-y-4 text-xs">
              <div>
                <label className="block text-gray-600 mb-1 font-medium">‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶®‡¶ü‡¶ø ‡¶≤‡¶ø‡¶ñ‡ßÅ‡¶® (Bangla/English):</label>
                <textarea 
                  rows={2} 
                  required
                  value={text}
                  onChange={e => setText(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500 text-gray-800 focus:outline-none" 
                  placeholder="‡¶Ø‡ßá‡¶Æ‡¶®: ‡¶¨‡¶æ‡¶Ç‡¶≤‡¶æ‡¶¶‡ßá‡¶∂‡ßá‡¶∞ ‡¶∏‡¶¨‡¶ö‡ßá‡ßü‡ßá ‡¶õ‡ßã‡¶ü ‡¶ú‡ßá‡¶≤‡¶æ ‡¶ï‡ßã‡¶®‡¶ü‡¶ø?"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-600 mb-1 font-medium">‡¶Ö‡¶™‡¶∂‡¶® A (‡¶ï):</label>
                  <input 
                    type="text" 
                    required
                    value={optionA}
                    onChange={e => setOptionA(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-gray-800 focus:outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1 font-medium">‡¶Ö‡¶™‡¶∂‡¶® B (‡¶ñ):</label>
                  <input 
                    type="text" 
                    required
                    value={optionB}
                    onChange={e => setOptionB(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-gray-800 focus:outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1 font-medium">‡¶Ö‡¶™‡¶∂‡¶® C (‡¶ó):</label>
                  <input 
                    type="text" 
                    required
                    value={optionC}
                    onChange={e => setOptionC(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl text-gray-800 focus:outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-gray-600 mb-1 font-medium">‡¶Ö‡¶™‡¶∂‡¶® D (‡¶ò):</label>
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
                <label className="block text-gray-700 mb-1.5 font-bold">‡¶∏‡¶†‡¶ø‡¶ï ‡¶â‡¶§‡ßç‡¶§‡¶∞ ‡¶®‡¶ø‡¶∞‡ßç‡¶¨‡¶æ‡¶ö‡¶® ‡¶ï‡¶∞‡ßÅ‡¶®:</label>
                <select 
                  value={correct}
                  onChange={e => setCorrect(e.target.value as any)}
                  className="w-full px-3 py-2 border border-indigo-200 rounded-xl bg-white text-gray-800 focus:outline-none text-xs font-semibold focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="Option A">Option A (‡¶ï)</option>
                  <option value="Option B">Option B (‡¶ñ)</option>
                  <option value="Option C">Option C (‡¶ó)</option>
                  <option value="Option D">Option D (‡¶ò)</option>
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
                      ? 'üîÑ ‡¶ï‡ßç‡¶Ø‡¶æ‡¶∏‡¶ï‡ßá‡¶°‡¶ø‡¶Ç ‡¶∏‡¶ø‡¶≤‡ßá‡¶ï‡¶∂‡¶®‡ßá ‡¶´‡¶ø‡¶∞‡ßá ‡¶Ø‡¶æ‡¶®' 
                      : '‚ûï ‡¶®‡¶§‡ßÅ‡¶®/‡¶ï‡¶æ‡¶∏‡ßç‡¶ü‡¶Æ ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶¨‡¶æ ‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶§‡ßà‡¶∞‡¶ø ‡¶ï‡¶∞‡ßÅ‡¶®'}
                  </button>
                </div>

                {/* 1. Cascading Filter Selection (Standard Mode) */}
                {!isCustomCategory && !isCustomSubcategory ? (
                  <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/50 space-y-3.5">
                    <div className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                      <FolderTree className="w-4 h-4 text-indigo-600" />
                      ‡¶ß‡¶æ‡¶™‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶ï‡ßç‡¶Ø‡¶æ‡¶∏‡¶ï‡ßá‡¶°‡¶ø‡¶Ç ‡¶ó‡¶®‡ßç‡¶§‡¶¨‡ßç‡¶Ø ‡¶®‡¶ø‡¶∞‡ßç‡¶¨‡¶æ‡¶ö‡¶® (Cascading Destination):
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      {/* Level 1: Main Category */}
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1 font-bold">‡¶Æ‡ßÇ‡¶≤ ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø:</label>
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
                                {i === 0 ? '‡¶â‡¶™-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø / ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ (‡¶ß‡¶æ‡¶™ ‡ßß):' : `‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶ß‡¶æ‡¶™ ${i + 1}:`}
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
                                <option value="ALL">--- ‡¶∏‡¶ø‡¶≤‡ßá‡¶ï‡ßç‡¶ü ‡¶ï‡¶∞‡ßÅ‡¶® (‡¶ê‡¶ö‡ßç‡¶õ‡¶ø‡¶ï) ---</option>
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
                      <label className="block text-gray-600 mb-1 font-medium">‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶®‡¶ø‡¶∞‡ßç‡¶ß‡¶æ‡¶∞‡¶£ ‡¶ï‡¶∞‡ßÅ‡¶®:</label>
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
                          {isCustomCategory ? '‡¶≤‡¶ø‡¶∏‡ßç‡¶ü ‡¶≠‡¶ø‡¶â' : '‚ûï ‡¶®‡¶§‡ßÅ‡¶® ‡¶≤‡¶ø‡¶ñ‡ßÅ‡¶®'}
                        </button>
                      </div>
                      {isCustomCategory && (
                        <input 
                          type="text"
                          required
                          value={customCategory}
                          onChange={e => setCustomCategory(e.target.value)}
                          placeholder="‡¶®‡¶§‡ßÅ‡¶® ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø‡¶∞ ‡¶®‡¶æ‡¶Æ ‡¶≤‡¶ø‡¶ñ‡ßÅ‡¶®"
                          className="w-full px-3 py-1.5 border rounded-xl mt-2 text-gray-800 text-xs focus:outline-none"
                        />
                      )}
                    </div>

                    {/* Custom Subcategory section */}
                    <div>
                      <label className="block text-gray-600 mb-1 font-medium">‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶®‡¶ø‡¶∞‡ßç‡¶ß‡¶æ‡¶∞‡¶£ ‡¶ï‡¶∞‡ßÅ‡¶®:</label>
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
                          <option value="">(‡¶ï‡ßã‡¶®‡ßã‡¶ü‡¶ø‡¶á ‡¶®‡ßü)</option>
                          {distinctSubcategories.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                        <button 
                          type="button"
                          onClick={() => setIsCustomSubcategory(!isCustomSubcategory)}
                          className="shrink-0 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-2.5 py-1.5 rounded-xl border text-[10px]"
                        >
                          {isCustomSubcategory ? '‡¶≤‡¶ø‡¶∏‡ßç‡¶ü ‡¶≠‡¶ø‡¶â' : '‚ûï ‡¶®‡¶§‡ßÅ‡¶® ‡¶≤‡¶ø‡¶ñ‡ßÅ‡¶®'}
                        </button>
                      </div>
                      {isCustomSubcategory && (
                        <input 
                          type="text" 
                          required
                          value={customSubcategory}
                          onChange={e => setCustomSubcategory(e.target.value)}
                          placeholder="‡¶®‡¶§‡ßÅ‡¶® ‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø‡¶∞ ‡¶®‡¶æ‡¶Æ ‡¶≤‡¶ø‡¶ñ‡ßÅ‡¶®" 
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
                    üîó ‡¶≤‡¶ø‡¶Ç‡¶ï ‡¶ï‡¶∞‡¶æ ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶∏‡¶Æ‡ßÇ‡¶π (MCQ linked Categories):
                  </label>
                  <p className="text-[9px] text-gray-400 mb-2 font-medium">‡¶è‡¶á ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶®‡¶ü‡¶ø ‡¶è‡¶ï ‡¶¨‡¶æ ‡¶è‡¶ï‡¶æ‡¶ß‡¶ø‡¶ï ‡¶¨‡¶ø‡¶∑‡ßü‡ßá‡¶∞ ‡¶∏‡¶æ‡¶•‡ßá ‡¶∏‡¶Ç‡¶Ø‡ßÅ‡¶ï‡ßç‡¶§ ‡¶ï‡¶∞‡¶§‡ßá ‡¶™‡¶æ‡¶∞‡ßá‡¶®:</p>
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
                    üîó ‡¶≤‡¶ø‡¶Ç‡¶ï ‡¶ï‡¶∞‡¶æ ‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶∏‡¶Æ‡ßÇ‡¶π (MCQ linked Subcategories):
                  </label>
                  <p className="text-[9px] text-gray-400 mb-2 font-medium">‡¶è‡¶á ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶®‡¶ü‡¶ø ‡¶è‡¶ï ‡¶¨‡¶æ ‡¶è‡¶ï‡¶æ‡¶ß‡¶ø‡¶ï ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ‡¶∞ ‡¶∏‡¶æ‡¶•‡ßá ‡¶∏‡¶Ç‡¶Ø‡ßÅ‡¶ï‡ßç‡¶§ ‡¶ï‡¶∞‡¶§‡ßá ‡¶™‡¶æ‡¶∞‡ßá‡¶®:</p>
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
                <label className="block text-gray-600 mb-1 font-medium">‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶®‡ßá‡¶∞ ‡¶¨‡ßç‡¶Ø‡¶æ‡¶ñ‡ßç‡¶Ø‡¶æ‡¶Æ‡ßÇ‡¶≤‡¶ï ‡¶â‡¶§‡ßç‡¶§‡¶∞ (‡¶â‡¶§‡ßç‡¶§‡¶∞ ‡¶∏‡¶†‡¶ø‡¶ï ‡¶π‡¶¨‡¶æ‡¶∞ ‡¶ï‡¶æ‡¶∞‡¶£):</label>
                <textarea 
                  rows={2} 
                  value={explanation}
                  onChange={e => setExplanation(e.target.value)}
                  className="w-full px-3 py-2 border rounded-xl text-gray-800 focus:outline-none" 
                  placeholder="‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ‡¶∞‡ßç‡¶•‡ßÄ‡¶¶‡ßá‡¶∞ ‡¶¨‡ßÅ‡¶ù‡¶æ‡¶∞ ‡¶∏‡ßÅ‡¶¨‡¶ø‡¶ß‡¶æ‡¶∞‡ßç‡¶•‡ßá ‡¶¨‡¶ø‡¶∏‡ßç‡¶§‡¶æ‡¶∞‡¶ø‡¶§ ‡¶¨‡ßç‡¶Ø‡¶æ‡¶ñ‡ßç‡¶Ø‡¶æ ‡¶¶‡¶ø‡¶®..."
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  type="submit"
                  className="flex-grow bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-md transition"
                >
                  {editingId ? 'üíæ ‡¶Ü‡¶™‡¶°‡ßá‡¶ü ‡¶§‡¶•‡ßç‡¶Ø ‡¶∏‡ßá‡¶≠ ‡¶ï‡¶∞‡ßÅ‡¶®' : 'üöÄ ‡¶°‡¶æ‡¶ü‡¶æ‡¶¨‡ßá‡¶∏‡ßá ‡¶∏‡ßá‡¶≠ ‡¶ï‡¶∞‡ßÅ‡¶®'}
                </button>
                {editingId && (
                  <button 
                    type="button"
                    onClick={handleCancelEdit}
                    className="bg-gray-300 hover:bg-gray-400 text-gray-700 font-bold px-4 rounded-xl transition"
                  >
                    ‡¶¨‡¶æ‡¶§‡¶ø‡¶≤
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
                üìÅ ‡¶è‡¶ï‡ßç‡¶∏‡ßá‡¶≤ ‡¶¨‡¶æ CSV ‡¶´‡¶æ‡¶á‡¶≤ ‡¶Ü‡¶™‡¶≤‡ßã‡¶°
              </h3>
              
              <p className="text-[10px] text-gray-600 leading-relaxed bg-white p-2.5 rounded-xl border border-indigo-150/60">
                ‡¶Ü‡¶™‡¶®‡¶æ‡¶∞ ‡¶§‡ßà‡¶∞‡¶ø ‡¶ï‡¶∞‡¶æ CSV ‡¶´‡¶æ‡¶á‡¶≤ ‡¶Ü‡¶™‡¶≤‡ßã‡¶° ‡¶ï‡¶∞‡ßÅ‡¶®‡•§ ‡¶´‡¶æ‡¶á‡¶≤‡ßá‡¶∞ ‡¶π‡ßá‡¶°‡¶æ‡¶∞‡¶ó‡ßÅ‡¶≤‡ßã ‡¶Ö‡¶¨‡¶∂‡ßç‡¶Ø‡¶á ‡¶è‡¶á ‡¶ï‡ßç‡¶∞‡¶Æ‡¶æ‡¶®‡ßÅ‡¶∏‡¶æ‡¶∞‡ßá ‡¶π‡¶§‡ßá ‡¶π‡¶¨‡ßá:
                <code className="block text-pink-600 font-mono font-bold text-[9px] bg-pink-50 p-1.5 rounded-md border border-pink-100 mt-1 break-all select-all">
                  text, optionA, optionB, optionC, optionD, correct, explanation, category, subcategory
                </code>
              </p>

              {/* Cascading Filter Destination for CSV Upload */}
              <div className="bg-white/70 p-3 rounded-xl border border-indigo-100/60 space-y-3">
                <div className="text-[10px] font-bold text-indigo-950 flex items-center gap-1 uppercase tracking-wider">
                  <FolderTree className="w-3.5 h-3.5 text-indigo-600" />
                  ‡¶Ü‡¶™‡¶≤‡ßã‡¶° ‡¶ó‡¶®‡ßç‡¶§‡¶¨‡ßç‡¶Ø ‡¶®‡¶ø‡¶∞‡ßç‡¶ß‡¶æ‡¶∞‡¶£ (Cascading Destination):
                </div>

                <div className="grid grid-cols-1 gap-2.5 text-xs">
                  {/* Category Dropdown */}
                  <div>
                    <label className="block text-[9px] text-gray-500 mb-0.5 font-bold">‡¶Æ‡ßÇ‡¶≤ ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø:</label>
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
                            {i === 0 ? '‡¶â‡¶™-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø / ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ (‡¶ß‡¶æ‡¶™ ‡ßß):' : `‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶ß‡¶æ‡¶™ ${i + 1}:`}
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
                            <option value="ALL">--- ‡¶∏‡¶ø‡¶≤‡ßá‡¶ï‡ßç‡¶ü ‡¶ï‡¶∞‡ßÅ‡¶® (‡¶ê‡¶ö‡ßç‡¶õ‡¶ø‡¶ï) ---</option>
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
                      <span className="text-[10px] font-bold text-indigo-950">‡¶´‡¶æ‡¶á‡¶≤‡ßá‡¶∞ ‡¶≠‡ßá‡¶§‡¶∞‡ßá‡¶∞ ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶ì‡¶≠‡¶æ‡¶∞‡¶∞‡¶æ‡¶á‡¶° ‡¶ï‡¶∞‡ßÅ‡¶®</span>
                      <span className="text-[8px] text-gray-500">‡¶Ö‡¶® ‡¶•‡¶æ‡¶ï‡¶≤‡ßá ‡¶∏‡¶¨ ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶®‡¶á ‡¶è‡¶á ‡¶®‡¶ø‡¶∞‡ßç‡¶¨‡¶æ‡¶ö‡¶ø‡¶§ ‡¶ó‡¶®‡ßç‡¶§‡¶¨‡ßç‡¶Ø‡ßá ‡¶Ø‡ßÅ‡¶ï‡ßç‡¶§ ‡¶π‡¶¨‡ßá‡•§</span>
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
                        ‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø ‡¶ú‡ßã‡¶®‡ßá ‡¶Ö‡¶ü‡ßã-‡¶Æ‡ßç‡¶Ø‡¶æ‡¶™‡¶ø‡¶Ç ‡¶ì ‡¶®‡¶§‡ßÅ‡¶® ‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶§‡ßà‡¶∞‡¶ø
                      </span>
                      <span className="text-[8.5px] text-emerald-800 leading-snug">
                        {enableSubjectAutoMap ? (
                          <span>
                            ‚úÖ <strong>‡¶Ö‡¶®:</strong> ‡¶ï‡ßÅ‡¶á‡¶ú‡¶ó‡ßÅ‡¶≤‡ßã ‡¶∏‡¶ø‡¶≤‡ßá‡¶ï‡ßç‡¶ü‡ßá‡¶° ‡¶ó‡¶®‡ßç‡¶§‡¶¨‡ßç‡¶Ø‡ßá‡¶∞ (‡¶Ø‡ßá‡¶Æ‡¶®: <em>{uploadDestCat} ‚ûî ...</em>) ‡¶™‡¶æ‡¶∂‡¶æ‡¶™‡¶æ‡¶∂‡¶ø CSV ‡¶´‡¶æ‡¶á‡¶≤‡ßá‡¶∞ ‡¶¨‡¶ø‡¶∑‡ßü ‡¶ì ‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶Ö‡¶®‡ßÅ‡¶Ø‡¶æ‡ßü‡ßÄ <strong>‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø ‡¶ú‡ßã‡¶®‡ßá (‡¶Ø‡ßá‡¶Æ‡¶®: ‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø ‡¶ú‡ßã‡¶® ‚ûî ‡¶¨‡¶æ‡¶Ç‡¶≤‡¶æ ‡¶¨‡ßç‡¶Ø‡¶æ‡¶ï‡¶∞‡¶£ ‚ûî ‡¶∏‡¶Æ‡¶æ‡¶∏)</strong> ‡¶Ö‡¶ü‡ßã-‡¶Æ‡ßç‡¶Ø‡¶æ‡¶™‡¶ø‡¶Ç ‡¶ì ‡¶Ö‡¶®‡ßÅ‡¶™‡¶∏‡ßç‡¶•‡¶ø‡¶§ ‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶Ö‡¶ü‡ßã-‡¶§‡ßà‡¶∞‡¶ø ‡¶ï‡¶∞‡ßá ‡¶â‡¶≠‡ßü ‡¶∏‡ßç‡¶•‡¶æ‡¶®‡ßá ‡¶Ø‡ßÅ‡¶ï‡ßç‡¶§ ‡¶π‡¶¨‡ßá‡•§
                          </span>
                        ) : (
                          <span>
                            ‚ùå <strong>‡¶Ö‡¶´:</strong> ‡¶ï‡ßÅ‡¶á‡¶ú‡¶ó‡ßÅ‡¶≤‡ßã ‡¶∂‡ßÅ‡¶ß‡ßÅ‡¶Æ‡¶æ‡¶§‡ßç‡¶∞ ‡¶â‡¶™‡¶∞‡ßá ‡¶∏‡¶ø‡¶≤‡ßá‡¶ï‡ßç‡¶ü‡ßá‡¶° ‡¶ó‡¶®‡ßç‡¶§‡¶¨‡ßç‡¶Ø‡ßá (‡¶Ø‡ßá‡¶Æ‡¶®: <em>{uploadDestCat} ‚ûî ...</em>) ‡¶Ü‡¶™‡¶≤‡ßã‡¶° ‡¶π‡¶¨‡ßá‡•§
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
                      <span className="text-[10px] font-bold text-rose-950">‡¶°‡ßá‡¶ü‡¶æ ‡¶≠‡ßç‡¶Ø‡¶æ‡¶≤‡¶ø‡¶°‡ßá‡¶∂‡¶® ‡¶∏‡¶ï‡ßç‡¶∞‡¶ø‡ßü ‡¶∞‡¶æ‡¶ñ‡ßÅ‡¶® (‡¶Ö‡¶®)</span>
                      <span className="text-[8px] text-gray-500">‡¶Ö‡¶´ ‡¶•‡¶æ‡¶ï‡¶≤‡ßá ‡¶ï‡ßã‡¶®‡ßã ‡¶≠‡ßÅ‡¶≤ ‡¶¨‡¶æ ‡¶ñ‡¶æ‡¶≤‡¶ø ‡¶ò‡¶∞ ‡¶•‡¶æ‡¶ï‡¶≤‡ßá‡¶ì ‡¶Ö‡¶ü‡ßã ‡¶°‡¶ø‡¶´‡¶≤‡ßç‡¶ü ‡¶§‡¶•‡ßç‡¶Ø‡ßá ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶Ü‡¶™‡¶≤‡ßã‡¶° ‡¶π‡¶¨‡ßá‡•§</span>
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
                        ‡¶∏‡ßç‡¶ü‡ßç‡¶∞‡¶ø‡¶ï‡ßç‡¶ü ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶ì ‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶Æ‡ßç‡¶Ø‡¶æ‡¶™‡¶ø‡¶Ç ‡¶≠‡ßç‡¶Ø‡¶æ‡¶≤‡¶ø‡¶°‡ßá‡¶∂‡¶®
                      </span>
                      <span className="text-[8.5px] text-amber-800 leading-snug">
                        {enableStrictMappingCheck ? (
                          <span>
                            ‚úÖ <strong>‡¶Ö‡¶®:</strong> ‡¶´‡¶æ‡¶á‡¶≤‡ßá ‡¶•‡¶æ‡¶ï‡¶æ ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø/‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶°‡¶æ‡¶ü‡¶æ‡¶¨‡ßá‡¶∏‡ßá‡¶∞ ‡¶∏‡¶æ‡¶•‡ßá ‡¶®‡¶æ ‡¶Æ‡¶ø‡¶≤‡¶≤‡ßá ‡¶∏‡¶§‡¶∞‡ßç‡¶ï‡¶¨‡¶æ‡¶∞‡ßç‡¶§‡¶æ ‡¶™‡ßç‡¶∞‡¶¶‡¶∞‡ßç‡¶∂‡¶® ‡¶ì ‡¶™‡¶∞‡ßç‡¶Ø‡¶æ‡¶≤‡ßã‡¶ö‡¶®‡¶æ (Mapping Review) ‡¶¨‡¶æ‡¶ß‡ßç‡¶Ø‡¶§‡¶æ‡¶Æ‡ßÇ‡¶≤‡¶ï ‡¶π‡¶¨‡ßá‡•§
                          </span>
                        ) : (
                          <span>
                            ‚ùå <strong>‡¶Ö‡¶´:</strong> ‡¶Ö‡¶∏‡¶Ç‡¶ó‡¶§‡¶ø‡¶™‡ßÇ‡¶∞‡ßç‡¶£ ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø/‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶•‡¶æ‡¶ï‡¶≤‡ßá‡¶ì ‡¶ï‡ßã‡¶®‡ßã ‡¶∏‡¶§‡¶∞‡ßç‡¶ï‡¶§‡¶æ ‡¶õ‡¶æ‡ßú‡¶æ‡¶á ‡¶∏‡¶∞‡¶æ‡¶∏‡¶∞‡¶ø ‡¶Ö‡¶ü‡ßã ‡¶Æ‡ßç‡¶Ø‡¶æ‡¶™‡¶ø‡¶Ç ‡¶Ö‡¶•‡¶¨‡¶æ ‡¶°‡¶ø‡¶´‡¶≤‡ßç‡¶ü ‡¶ó‡¶®‡ßç‡¶§‡¶¨‡ßç‡¶Ø‡ßá ‡¶Ü‡¶™‡¶≤‡ßã‡¶° ‡¶π‡¶¨‡ßá‡•§
                          </span>
                        )}
                      </span>
                    </div>
                  </label>

                  {/* Text Qualifier Selector */}
                  <div className="mt-1 bg-slate-50 p-2 rounded-lg border border-slate-200/80">
                    <label className="block text-[10px] font-extrabold text-slate-800 mb-1">
                      ‡¶ü‡ßá‡¶ï‡ßç‡¶∏‡¶ü ‡¶ï‡ßã‡ßü‡¶æ‡¶≤‡¶ø‡¶´‡¶æ‡ßü‡¶æ‡¶∞ (Text Qualifier):
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
                              setCsvFileError('‡¶´‡¶æ‡¶á‡¶≤‡ßá‡¶∞ ‡¶≠‡ßá‡¶§‡¶∞‡ßá ‡¶≠‡ßç‡¶Ø‡¶æ‡¶≤‡¶ø‡¶°‡ßá‡¶∂‡¶® ‡¶∏‡¶Æ‡¶∏‡ßç‡¶Ø‡¶æ ‡¶™‡¶æ‡¶ì‡ßü‡¶æ ‡¶ó‡ßá‡¶õ‡ßá‡•§');
                            } else {
                              setCsvFileError(err.message || '‡¶™‡¶æ‡¶∞‡ßç‡¶∏‡¶ø‡¶Ç ‡¶¨‡ßç‡¶Ø‡¶∞‡ßç‡¶• ‡¶π‡¶Ø‡¶º‡ßá‡¶õ‡ßá');
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
                      <option value='"'>" (Double Quote / ‡¶°‡¶æ‡¶¨‡¶≤ ‡¶ï‡ßã‡¶ü - ‡¶°‡¶ø‡¶´‡¶≤‡ßç‡¶ü)</option>
                      <option value="'">' (Single Quote / ‡¶∏‡¶ø‡¶ô‡ßç‡¶ó‡ßá‡¶≤ ‡¶ï‡ßã‡¶ü)</option>
                      <option value="none">None (‡¶ï‡ßã‡¶®‡ßã‡¶ü‡¶ø‡¶á ‡¶®‡ßü / ‡¶®‡ßã ‡¶ï‡ßã‡ßü‡¶æ‡¶≤‡¶ø‡¶´‡¶æ‡ßü‡¶æ‡¶∞)</option>
                      <option value="auto">Auto Detect (‡¶Ö‡¶ü‡ßã ‡¶°‡¶ø‡¶ü‡ßá‡¶ï‡ßç‡¶ü)</option>
                    </select>
                    <span className="text-[8px] text-gray-500 block mt-1 leading-tight">
                      ‡¶ï‡¶Æ‡¶æ‡¶Ø‡ßÅ‡¶ï‡ßç‡¶§ ‡¶ü‡ßá‡¶ï‡ßç‡¶∏‡¶ü‡ßá‡¶∞ ‡¶¶‡ßÅ‡¶á ‡¶™‡¶æ‡¶∂‡ßá ‡¶•‡¶æ‡¶ï‡¶æ ‡¶ï‡ßã‡¶ü ‡¶¨‡¶æ ‡¶ö‡¶ø‡¶π‡ßç‡¶® ‡¶ö‡¶ø‡¶π‡ßç‡¶®‡¶ø‡¶§ ‡¶ï‡¶∞‡¶§‡ßá ‡¶¨‡ßç‡¶Ø‡¶¨‡¶π‡ßÉ‡¶§ ‡¶π‡ßü‡•§
                    </span>
                  </div>
                </div>
              </div>
              
              {/* File input selection */}
              <div className="space-y-2">
                <label className="block text-[10px] text-gray-700 font-bold mb-1">CSV ‡¶´‡¶æ‡¶á‡¶≤ ‡¶Ü‡¶™‡¶≤‡ßã‡¶° ‡¶ï‡¶∞‡ßÅ‡¶®:</label>
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
                  <span>üìÅ CSV ‡¶´‡¶æ‡¶á‡¶≤ ‡¶∏‡¶ø‡¶≤‡ßá‡¶ï‡ßç‡¶ü / ‡¶Ü‡¶™‡¶≤‡ßã‡¶° ‡¶ï‡¶∞‡ßÅ‡¶®</span>
                </button>
              </div>

              {/* Preview and Confirmation Trigger */}
              {pendingCSVFile && (
                <div className="bg-emerald-50/75 p-3 rounded-xl border border-emerald-150 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-emerald-950 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ‡¶´‡¶æ‡¶á‡¶≤ ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§!
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
                      title="‡¶´‡¶æ‡¶á‡¶≤ ‡¶¨‡¶æ‡¶¶ ‡¶¶‡¶ø‡¶®"
                    >
                      ‚úï
                    </button>
                  </div>
                  <div className="text-[10px] text-gray-600 space-y-0.5">
                    <div>üìÅ <span className="font-semibold text-gray-800">‡¶®‡¶æ‡¶Æ:</span> {pendingCSVFile.name}</div>
                    <div>üìä <span className="font-semibold text-gray-800">‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶∏‡¶Ç‡¶ñ‡ßç‡¶Ø‡¶æ:</span> {pendingQuestions.length} ‡¶ü‡¶ø</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowUploadConfirm(true)}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg text-xs transition shadow-sm shadow-emerald-600/10 cursor-pointer"
                  >
                    üöÄ ‡¶´‡¶æ‡¶á‡¶≤ ‡¶Ü‡¶™‡¶≤‡ßã‡¶° ‡¶®‡¶ø‡¶∂‡ßç‡¶ö‡¶ø‡¶§ ‡¶ï‡¶∞‡ßÅ‡¶®
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
                          ‚ö†Ô∏è ‡¶Ö‡¶∏‡¶Ç‡¶ó‡¶§‡¶ø‡¶™‡ßÇ‡¶∞‡ßç‡¶£ ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø/‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶™‡¶æ‡¶• ‡¶∏‡¶®‡¶æ‡¶ï‡ßç‡¶§ ‡¶π‡ßü‡ßá‡¶õ‡ßá!
                        </h4>
                        <p className="text-[10px] opacity-80 mt-0.5">
                          ‡¶Ü‡¶™‡¶≤‡ßã‡¶°‡¶ï‡ßÉ‡¶§ CSV ‡¶´‡¶æ‡¶á‡¶≤‡ßá‡¶∞ <strong>{nonMatchingPathDetails.length}‡¶ü‡¶ø ‡¶≤‡¶æ‡¶á‡¶®‡ßá</strong> ‡¶∏‡¶ø‡¶∏‡ßç‡¶ü‡ßá‡¶Æ‡ßá‡¶∞ ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶ü‡ßç‡¶∞‡¶ø‡¶∞ ‡¶∏‡¶æ‡¶•‡ßá ‡¶Ö‡¶Æ‡¶ø‡¶≤ ‡¶™‡¶æ‡¶ì‡ßü‡¶æ ‡¶ó‡ßá‡¶õ‡ßá‡•§
                        </p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase shrink-0 border ${
                      enableStrictMappingCheck
                        ? 'bg-rose-100 text-rose-800 border-rose-300'
                        : 'bg-amber-100 text-amber-800 border-amber-300'
                    }`}>
                      {enableStrictMappingCheck ? 'üîí ‡¶∏‡ßç‡¶ü‡ßç‡¶∞‡¶ø‡¶ï‡ßç‡¶ü ‡¶Æ‡ßã‡¶° ‡¶Ö‡¶®' : 'üîì ‡¶∏‡ßç‡¶ü‡ßç‡¶∞‡¶ø‡¶ï‡ßç‡¶ü ‡¶Æ‡ßã‡¶° ‡¶Ö‡¶´'}
                    </span>
                  </div>

                  {/* Expandable/Scrollable Non-matching List */}
                  <div className="bg-white/90 rounded-xl p-2 border border-slate-200/80 max-h-[160px] overflow-y-auto space-y-1.5">
                    <div className="text-[9px] font-extrabold text-slate-700 uppercase tracking-wider border-b pb-1 flex justify-between px-1">
                      <span>‡¶Ö‡¶∏‡¶Ç‡¶ó‡¶§‡¶ø‡¶™‡ßÇ‡¶∞‡ßç‡¶£ ‡¶™‡¶æ‡¶• ‡¶¨‡¶ø‡¶¨‡¶∞‡¶£ ({nonMatchingPathDetails.length}‡¶ü‡¶ø)</span>
                      <span>‡¶≤‡¶æ‡¶á‡¶®</span>
                    </div>
                    {nonMatchingPathDetails.map((item, idx) => (
                      <div key={idx} className="text-[9.5px] bg-slate-50/80 p-2 rounded-lg border border-slate-200/60 space-y-1">
                        <div className="flex items-center justify-between font-bold text-slate-800">
                          <span className="truncate max-w-[200px]" title={item.questionText}>
                            ‚Ä¢ {item.questionText}
                          </span>
                          <span className="bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded text-[8.5px] font-mono shrink-0">
                            ‡¶≤‡¶æ‡¶á‡¶® {item.rowNum}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[8.5px] text-slate-600 bg-white p-1 rounded border border-slate-100">
                          <div>
                            <span className="font-semibold text-slate-500">‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø:</span>{' '}
                            <span className="font-bold text-slate-800">{item.category}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-slate-500">‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø:</span>{' '}
                            <span className="font-bold text-slate-800">{item.subcategory}</span>
                          </div>
                        </div>
                        <div className="text-[8.5px] text-rose-600 font-semibold flex items-center gap-1">
                          <span>üö® {item.issueDescription}</span>
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
                      <span>‡¶∏‡ßç‡¶ü‡ßç‡¶∞‡¶ø‡¶ï‡ßç‡¶ü ‡¶≠‡ßç‡¶Ø‡¶æ‡¶≤‡¶ø‡¶°‡ßá‡¶∂‡¶® ‡¶Æ‡ßã‡¶° ‡¶™‡¶∞‡¶ø‡¶¨‡¶∞‡ßç‡¶§‡¶® ‡¶ï‡¶∞‡ßÅ‡¶®</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => prepareMappingReview()}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-[9.5px] px-2.5 py-1 rounded-lg transition shadow-xs flex items-center gap-1 cursor-pointer"
                    >
                      <span>üîç ‡¶Æ‡ßç‡¶Ø‡¶æ‡¶™‡¶ø‡¶Ç ‡¶∞‡¶ø‡¶≠‡¶ø‡¶â ‡¶á‡¶®‡ßç‡¶ü‡¶æ‡¶∞‡¶´‡ßá‡¶∏ ‡¶ñ‡ßÅ‡¶≤‡ßÅ‡¶®</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Fallback Text area paste block */}
              <div className="border-t border-indigo-100/50 pt-3.5 space-y-2">
                <div className="text-center text-gray-400 text-[10px] font-semibold">‡¶Ö‡¶•‡¶¨‡¶æ ‡¶∏‡¶∞‡¶æ‡¶∏‡¶∞‡¶ø CSV ‡¶´‡¶∞‡¶Æ‡ßç‡¶Ø‡¶æ‡¶ü‡ßá‡¶∞ ‡¶ü‡ßá‡¶ï‡ßç‡¶∏‡¶ü ‡¶™‡ßá‡¶∏‡ßç‡¶ü ‡¶ï‡¶∞‡ßÅ‡¶®:</div>
                <textarea 
                  rows={3}
                  value={csvText}
                  onChange={e => setCsvText(e.target.value)}
                  placeholder={`text,optionA,optionB,optionC,optionD,correct,explanation,category\n‡¶¨‡¶æ‡¶Ç‡¶≤‡¶æ‡¶¶‡ßá‡¶∂‡ßá‡¶∞ ‡¶∞‡¶æ‡¶ú‡¶ß‡¶æ‡¶®‡ßÄ ‡¶ï‡ßã‡¶®‡¶ü‡¶ø?,‡¶¢‡¶æ‡¶ï‡¶æ,‡¶ö‡¶ü‡ßç‡¶ü‡¶ó‡ßç‡¶∞‡¶æ‡¶Æ,‡¶∏‡¶ø‡¶≤‡ßá‡¶ü,‡¶ñ‡ßÅ‡¶≤‡¶®‡¶æ,Option A,‡¶¢‡¶æ‡¶ï‡¶æ ‡¶¨‡¶æ‡¶Ç‡¶≤‡¶æ‡¶¶‡ßá‡¶∂‡ßá‡¶∞ ‡¶∞‡¶æ‡¶ú‡¶ß‡¶æ‡¶®‡ßÄ,‡¶∏‡¶æ‡¶ß‡¶æ‡¶∞‡¶£ ‡¶ú‡ßç‡¶û‡¶æ‡¶®`}
                  className="w-full px-3 py-1.5 border border-indigo-100 rounded-xl bg-white text-[10px] font-mono text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                />

                <button
                  type="button"
                  onClick={handleBulkUploadCSVText}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-lg text-xs transition shadow-sm shadow-indigo-600/10"
                >
                  üì• ‡¶™‡ßá‡¶∏‡ßç‡¶ü‡¶ï‡ßÉ‡¶§ ‡¶ü‡ßá‡¶ï‡ßç‡¶∏‡¶ü ‡¶Ü‡¶™‡¶≤‡ßã‡¶° ‡¶ï‡¶∞‡ßÅ‡¶®
                </button>

                {csvFileError && (
                  <div className="p-2 bg-rose-50 border border-rose-150 text-rose-600 text-[10px] rounded-lg font-bold">
                    ‚ö†Ô∏è {csvFileError}
                  </div>
                )}

                {csvValidationErrors.length > 0 && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-[10px] rounded-xl flex flex-col gap-1 max-h-[160px] overflow-y-auto font-mono">
                    <span className="font-extrabold text-[10px] text-rose-800 uppercase flex items-center gap-1">
                      ‚ùå ‡¶≠‡ßç‡¶Ø‡¶æ‡¶≤‡¶ø‡¶°‡ßá‡¶∂‡¶® ‡¶§‡ßç‡¶∞‡ßÅ‡¶ü‡¶ø ‡¶∏‡¶Æ‡ßÇ‡¶π ({csvValidationErrors.length}‡¶ü‡¶ø):
                    </span>
                    {csvValidationErrors.map((err, idx) => (
                      <div key={idx} className="flex gap-1 items-start leading-relaxed border-b border-rose-100/30 pb-0.5 last:border-0">
                        <span>‚Ä¢</span>
                        <span>{err}</span>
                      </div>
                    ))}
                  </div>
                )}

                <button 
                  type="button"
                  onClick={() => {
                    if (!csvText.trim()) {
                      alert('‡¶Ö‡¶®‡ßÅ‡¶ó‡ßç‡¶∞‡¶π ‡¶ï‡¶∞‡ßá CSV ‡¶´‡¶∞‡¶Æ‡ßç‡¶Ø‡¶æ‡¶ü‡ßá ‡¶ü‡ßá‡¶ï‡ßç‡¶∏‡¶ü ‡¶™‡ßá‡¶∏‡ßç‡¶ü ‡¶ï‡¶∞‡ßÅ‡¶®!');
                      return;
                    }
                    try {
                      setCsvFileError('');
                      setCsvValidationErrors([]);
                      const parsed = parseCSV(csvText);
                      if (parsed.length === 0) {
                        alert('‡¶ï‡ßã‡¶®‡ßã ‡¶¨‡ßà‡¶ß ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶ñ‡ßÅ‡¶Å‡¶ú‡ßá ‡¶™‡¶æ‡¶ì‡ßü‡¶æ ‡¶Ø‡¶æ‡ßü‡¶®‡¶ø‡•§');
                        return;
                      }
                      setPendingCSVFile(null);
                      setPendingQuestions(parsed);
                      setShowUploadConfirm(true);
                    } catch (err: any) {
                      if (err.validationErrors) {
                        setCsvValidationErrors(err.validationErrors);
                        setCsvFileError('‡¶™‡ßá‡¶∏‡ßç‡¶ü ‡¶ï‡¶∞‡¶æ ‡¶ü‡ßá‡¶ï‡ßç‡¶∏‡¶ü‡ßá ‡¶≠‡ßç‡¶Ø‡¶æ‡¶≤‡¶ø‡¶°‡ßá‡¶∂‡¶® ‡¶∏‡¶Æ‡¶∏‡ßç‡¶Ø‡¶æ ‡¶™‡¶æ‡¶ì‡ßü‡¶æ ‡¶ó‡ßá‡¶õ‡ßá‡•§ ‡¶®‡¶ø‡¶ö‡ßá ‡¶¨‡¶ø‡¶∏‡ßç‡¶§‡¶æ‡¶∞‡¶ø‡¶§ ‡¶¶‡ßá‡¶ñ‡ßÅ‡¶®‡•§');
                      } else {
                        setCsvFileError(err.message || '‡¶ü‡ßá‡¶ï‡ßç‡¶∏‡¶ü ‡¶™‡¶æ‡¶∞‡ßç‡¶∏‡¶ø‡¶Ç ‡¶¨‡ßç‡¶Ø‡¶∞‡ßç‡¶• ‡¶π‡ßü‡ßá‡¶õ‡ßá');
                      }
                    }
                  }}
                  className="w-full bg-slate-700 hover:bg-slate-800 text-white font-bold py-2 rounded-xl text-[11px] transition shadow-xs"
                >
                  ‡¶ü‡ßá‡¶ï‡ßç‡¶∏‡¶ü ‡¶•‡ßá‡¶ï‡ßá ‡¶ï‡ßÅ‡¶á‡¶ú ‡¶Ü‡¶™‡¶≤‡ßã‡¶° ‡¶ï‡¶∞‡ßÅ‡¶®
                </button>
              </div>
            </div>

            <div className="bg-amber-50 p-5 rounded-2xl border border-amber-100 text-amber-900">
              <h4 className="font-bold text-xs flex items-center gap-1">
                <AlertCircle className="w-4 h-4 text-amber-600" /> 
                CSV ‡¶Ü‡¶™‡¶≤‡ßã‡¶° ‡¶è‡¶∞ ‡¶ï‡¶ø‡¶õ‡ßÅ ‡¶®‡¶ø‡ßü‡¶Æ‡¶æ‡¶¨‡¶≤‡¶ø:
              </h4>
              <ul className="list-disc pl-4 text-[10px] space-y-1 mt-2 text-amber-800 leading-relaxed">
                <li>‡¶∏‡¶π‡¶ú ‡¶∏‡¶†‡¶ø‡¶ï ‡¶â‡¶§‡ßç‡¶§‡¶∞ ‡¶ò‡¶∞‡ßá ‡¶Ö‡¶¨‡¶∂‡ßç‡¶Ø‡¶á <code className="bg-white px-1 border rounded">Option A</code>, <code className="bg-white px-1 border rounded">Option B</code>, <code className="bg-white px-1 border rounded">Option C</code> ‡¶Ö‡¶•‡¶¨‡¶æ <code className="bg-white px-1 border rounded">Option D</code> ‡¶≤‡¶ø‡¶ñ‡¶§‡ßá ‡¶π‡¶¨‡ßá‡•§</li>
                <li>‡¶ï‡¶Æ‡¶æ ‡¶∏‡ßá‡¶™‡¶æ‡¶∞‡ßá‡¶ü‡ßá‡¶° ‡¶´‡¶æ‡¶á‡¶≤‡ßá ‡¶°‡¶æ‡¶¨‡¶≤ ‡¶ï‡ßã‡¶ü‡ßá‡¶∂‡¶® ‡¶¨‡ßç‡¶Ø‡¶¨‡¶π‡¶æ‡¶∞ ‡¶ï‡¶∞‡¶≤‡ßá ‡¶ï‡¶Æ‡¶æ‡¶∞ ‡¶≠‡ßá‡¶§‡¶∞‡ßá‡¶∞ ‡¶∂‡¶¨‡ßç‡¶¶‡¶ó‡ßÅ‡¶≤‡ßã ‡¶è‡¶ï‡¶ü‡¶ø ‡¶∏‡ßá‡¶≤ ‡¶π‡¶ø‡¶∏‡ßá‡¶¨‡ßá ‡¶¨‡¶ø‡¶¨‡ßá‡¶ö‡¶ø‡¶§ ‡¶π‡¶¨‡ßá‡•§</li>
                <li>‡¶ó‡¶®‡ßç‡¶§‡¶¨‡ßç‡¶Ø ‡¶ì‡¶≠‡¶æ‡¶∞‡¶∞‡¶æ‡¶á‡¶° ‡¶ï‡¶∞‡¶æ ‡¶®‡¶æ ‡¶•‡¶æ‡¶ï‡¶≤‡ßá ‡¶ì ‡¶´‡¶æ‡¶á‡¶≤‡ßá ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶´‡¶æ‡¶ï‡¶æ ‡¶∞‡¶æ‡¶ñ‡¶≤‡ßá ‡¶°‡¶ø‡¶´‡¶≤‡ßç‡¶ü‡¶≠‡¶æ‡¶¨‡ßá "‡¶∏‡¶æ‡¶ß‡¶æ‡¶∞‡¶£ ‡¶ú‡ßç‡¶û‡¶æ‡¶®" ‡¶∏‡¶ø‡¶≤‡ßá‡¶ï‡ßç‡¶ü ‡¶π‡ßü‡ßá ‡¶Ø‡¶æ‡¶¨‡ßá‡•§</li>
              </ul>
            </div>

            {/* 3. Upload History Panel */}
            <div className="bg-white p-5 rounded-2xl border border-gray-150 shadow-xs flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-gray-150/60 pb-2">
                <h3 className="font-bold text-xs text-gray-800 flex items-center gap-1.5 font-sans">
                  <History className="w-4 h-4 text-indigo-600" />
                  üïí ‡¶´‡¶æ‡¶á‡¶≤ ‡¶Ü‡¶™‡¶≤‡ßã‡¶° ‡¶π‡¶ø‡¶∏‡ßç‡¶ü‡ßç‡¶∞‡¶ø ({uploadHistory.length})
                </h3>
                {uploadHistory.length > 0 && (
                  <button 
                    type="button"
                    onClick={() => {
                      showCustomConfirm(
                        '‡¶Ü‡¶™‡¶≤‡ßã‡¶° ‡¶π‡¶ø‡¶∏‡ßç‡¶ü‡ßç‡¶∞‡¶ø ‡¶Æ‡ßÅ‡¶õ‡ßÅ‡¶®',
                        '‡¶Ü‡¶™‡¶®‡¶ø ‡¶ï‡¶ø ‡¶®‡¶ø‡¶∂‡ßç‡¶ö‡¶ø‡¶§‡¶≠‡¶æ‡¶¨‡ßá ‡¶Ü‡¶™‡¶≤‡ßã‡¶° ‡¶π‡¶ø‡¶∏‡ßç‡¶ü‡ßç‡¶∞‡¶ø ‡¶Æ‡ßÅ‡¶õ‡ßá ‡¶´‡ßá‡¶≤‡¶§‡ßá ‡¶ö‡¶æ‡¶®?',
                        () => {
                          setUploadHistory([]);
                          localStorage.removeItem('orjon_upload_history');
                          localStorage.removeItem('medha_upload_history');
                          showCustomAlert('‡¶∏‡¶Æ‡ßç‡¶™‡¶®‡ßç‡¶® ‡¶π‡ßü‡ßá‡¶õ‡ßá!', '‡¶Ü‡¶™‡¶≤‡ßã‡¶° ‡¶π‡¶ø‡¶∏‡ßç‡¶ü‡ßç‡¶∞‡¶ø ‡¶∏‡¶´‡¶≤‡¶≠‡¶æ‡¶¨‡ßá ‡¶Æ‡ßÅ‡¶õ‡ßá ‡¶´‡ßá‡¶≤‡¶æ ‡¶π‡ßü‡ßá‡¶õ‡ßá!', 'success');
                        },
                        'warning'
                      );
                    }}
                    className="text-[9px] text-rose-500 hover:text-rose-700 font-extrabold flex items-center gap-0.5 transition"
                  >
                    üóëÔ∏è ‡¶Æ‡ßÅ‡¶õ‡ßá ‡¶´‡ßá‡¶≤‡ßÅ‡¶®
                  </button>
                )}
              </div>

              {uploadHistory.length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-[11px] flex flex-col items-center justify-center gap-1">
                  <FileText className="w-6 h-6 text-gray-300 stroke-1" />
                  ‡¶è‡¶ñ‡¶®‡ßã ‡¶ï‡ßã‡¶®‡ßã ‡¶´‡¶æ‡¶á‡¶≤ ‡¶Ü‡¶™‡¶≤‡ßã‡¶° ‡¶ï‡¶∞‡¶æ ‡¶π‡ßü‡¶®‡¶ø‡•§
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
                          {item.count}‡¶ü‡¶ø MCQ
                        </span>
                      </div>
                      <div className="text-[9px] text-gray-500 flex flex-wrap justify-between items-center gap-1">
                        <div>üìÖ {item.timestamp}</div>
                        <div className="bg-slate-200/50 text-slate-700 font-semibold px-1 rounded-sm max-w-[120px] truncate" title={item.destination}>
                          üéØ {item.destination}
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
              ‡¶∏‡¶¨ ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶®‡ßá‡¶∞ ‡¶°‡¶ø‡¶∞‡ßá‡¶ï‡ßç‡¶ü‡¶∞‡¶ø ({questions.length}‡¶ü‡¶ø ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶®)
            </h2>
            <input 
              type="text" 
              placeholder="‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶¨‡¶æ ‡¶ü‡ßç‡¶Ø‡¶æ‡¶ó ‡¶ñ‡ßÅ‡¶Å‡¶ú‡ßÅ‡¶®..."
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
                <span>‡¶Æ‡ßÇ‡¶≤ ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶Æ‡ßã‡¶ü MCQ ‡¶∏‡¶Ç‡¶ñ‡ßç‡¶Ø‡¶æ (Root Category MCQ Breakdown):</span>
              </div>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2.5 py-0.5 rounded-full border border-indigo-400/30 font-bold">
                ‡¶Æ‡ßã‡¶ü ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶®: {questions.length.toLocaleString('bn-BD')} ‡¶ü‡¶ø
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
                      {isSelected && <span className="text-[9px] bg-white text-indigo-950 font-black px-1.5 py-0.2 rounded-md shrink-0">‡¶∏‡¶ø‡¶≤‡ßá‡¶ï‡ßç‡¶ü‡ßá‡¶°</span>}
                    </div>
                    <div className="flex items-baseline justify-between gap-1 pt-1.5 border-t border-white/10">
                      <span className="text-[10px] opacity-80 font-medium">‡¶Æ‡ßã‡¶ü MCQ</span>
                      <span className="font-black text-xs text-amber-300">
                        {mcqCount.toLocaleString('bn-BD')} ‡¶ü‡¶ø
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
                ‡¶Æ‡¶æ‡¶≤‡ßç‡¶ü‡¶ø-‡¶≤‡ßá‡¶≠‡ßá‡¶≤ ‡¶ï‡ßç‡¶Ø‡¶æ‡¶∏‡¶ï‡ßá‡¶°‡¶ø‡¶Ç ‡¶´‡¶ø‡¶≤‡ßç‡¶ü‡¶æ‡¶∞ (Multi-Level Cascading Filters):
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
                  ‚úï ‡¶∏‡¶¨ ‡¶´‡¶ø‡¶≤‡ßç‡¶ü‡¶æ‡¶∞ ‡¶Æ‡ßÅ‡¶õ‡ßÅ‡¶®
                </button>
              )}
            </div>

            {/* Breadcrumb Path */}
            {(catFilter !== 'ALL' || subcatFilterChain.length > 0 || leafTopicFilter !== 'ALL') && (
              <div className="flex items-center gap-1.5 flex-wrap text-[10px] bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700">
                <span className="font-bold text-indigo-700">‡¶´‡¶ø‡¶≤‡ßç‡¶ü‡¶æ‡¶∞ ‡¶™‡¶æ‡¶•:</span>
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
                    <span className="bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded font-bold">üåø {leafTopicFilter}</span>
                  </>
                )}
                <span className="ml-auto text-[9.5px] text-slate-500 font-bold">
                  ‡¶´‡¶≤‡¶æ‡¶´‡¶≤: {filteredQuestionsForManage.length.toLocaleString('bn-BD')} ‡¶ü‡¶ø
                </span>
              </div>
            )}
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
              {/* Category Dropdown (Tier 1) */}
              <div>
                <label className="block text-[10px] text-gray-500 mb-1 font-bold">‡ßß. ‡¶Æ‡ßÇ‡¶≤ ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø:</label>
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
                  <option value="ALL">‡¶∏‡¶¨ ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ({questions.length.toLocaleString('bn-BD')}‡¶ü‡¶ø MCQ)</option>
                  {(allRootCategories || []).map(c => (
                    <option key={c} value={c}>
                      {c} ({(rootCategoryMCQCounts[c] || 0).toLocaleString('bn-BD')}‡¶ü‡¶ø MCQ)
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
                      options = subcategories.filter(s => !s.parentCategory || s.parentCategory === '‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø' || isJobSolutionVariation(s.parentCategory));
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
                        {i === 0 ? '‡ß®. ‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶ß‡¶æ‡¶™ ‡ßß:' : `${i + 2}. ‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶ß‡¶æ‡¶™ ${i + 1}:`}
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
                        <option value="ALL">--- ‡¶∏‡¶¨ ---</option>
                        {options.map(s => {
                          const count = subcategoryDescendantsCountMap.get(s.name.trim().toLowerCase()) || nodeQuestionCountMap.get(s.name.trim().toLowerCase()) || 0;
                          return (
                            <option key={s.id} value={s.name}>
                              {s.name} {count > 0 ? `(${count.toLocaleString('bn-BD')}‡¶ü‡¶ø)` : ''}
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
                    üåø ‡¶≤‡¶ø‡¶´ ‡¶ü‡¶™‡¶ø‡¶ï / ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø:
                  </label>
                  <select
                    value={leafTopicFilter}
                    onChange={e => {
                      setLeafTopicFilter(e.target.value);
                      setSelectedQIds([]);
                    }}
                    className="w-full px-2.5 py-1.5 border border-emerald-300 rounded-lg bg-emerald-50/50 text-emerald-950 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition text-xs font-semibold"
                  >
                    <option value="ALL">‡¶∏‡¶¨ ‡¶ü‡¶™‡¶ø‡¶ï ({manageAvailableLeafTopics.reduce((acc, curr) => acc + curr.count, 0).toLocaleString('bn-BD')}‡¶ü‡¶ø)</option>
                    {(manageAvailableLeafTopics || []).map(topic => (
                      <option key={topic.name} value={topic.name}>
                        {topic.name} ({topic.count.toLocaleString('bn-BD')}‡¶ü‡¶ø)
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
                  ‡¶∏‡¶¨ ‡¶∏‡¶ø‡¶≤‡ßá‡¶ï‡ßç‡¶ü ‡¶ï‡¶∞‡ßÅ‡¶® ({filteredQuestionsForManage.length} ‡¶ü‡¶ø‡¶∞ ‡¶Æ‡¶ß‡ßç‡¶Ø‡ßá)
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
                  üìÑ ‡¶è‡¶á ‡¶™‡ßá‡¶ú‡ßá‡¶∞ {paginatedQuestionsForManage.length}‡¶ü‡¶ø ‡¶∏‡¶ø‡¶≤‡ßá‡¶ï‡ßç‡¶ü ‡¶ï‡¶∞‡ßÅ‡¶®
                </button>
                {selectedQIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedQIds([])}
                    className="text-[10px] bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold px-2.5 py-1 rounded-md transition cursor-pointer"
                  >
                    ‚úï ‡¶∏‡¶ø‡¶≤‡ßá‡¶ï‡¶∂‡¶® ‡¶Æ‡ßÅ‡¶õ‡ßÅ‡¶®
                  </button>
                )}
              </div>

              {selectedQIds.length > 0 && (
                <button 
                  onClick={handleBulkDelete}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold py-1.5 px-3.5 rounded-lg transition flex items-center gap-1 text-[11px] shadow-sm animate-pulse cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  ‡¶è‡¶ï‡¶∏‡¶æ‡¶•‡ßá ‡¶Æ‡ßÅ‡¶õ‡ßÅ‡¶® ({selectedQIds.length} ‡¶ü‡¶ø)
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
                return textLower.includes('‡¶¨‡¶ø‡¶∏‡¶ø‡¶è‡¶∏') || textLower.includes('‡¶®‡¶ø‡¶Ø‡¶º‡ßã‡¶ó') || textLower.includes('‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ') || textLower.includes('‡¶¨‡ßç‡¶Ø‡¶æ‡¶Ç‡¶ï') || textLower.includes('job') || textLower.includes('exam') ||
                       subLower.includes('‡¶¨‡¶ø‡¶∏‡¶ø‡¶è‡¶∏') || subLower.includes('‡¶®‡¶ø‡¶Ø‡¶º‡ßã‡¶ó') || subLower.includes('‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ') || subLower.includes('‡¶¨‡ßç‡¶Ø‡¶æ‡¶Ç‡¶ï') || subLower.includes('job') || subLower.includes('exam') ||
                       catLower.includes('‡¶¨‡¶ø‡¶∏‡¶ø‡¶è‡¶∏') || catLower.includes('‡¶®‡¶ø‡¶Ø‡¶º‡ßã‡¶ó') || catLower.includes('‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ') || catLower.includes('‡¶¨‡ßç‡¶Ø‡¶æ‡¶Ç‡¶ï') || catLower.includes('job') || catLower.includes('exam');
              });

              return (
                <div className="bg-gradient-to-br from-indigo-50/40 to-slate-50/50 border border-indigo-150 p-4 rounded-2xl flex flex-col gap-4 shadow-sm mt-1.5 animate-scale-up">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-indigo-100 pb-2.5">
                    <div className="flex items-center gap-2 text-indigo-950 font-extrabold text-[12px] uppercase tracking-wider">
                      <Sparkles className="w-4.5 h-4.5 text-indigo-600 animate-pulse" />
                      ‚ö° ‡¶°‡¶æ‡¶Ø‡¶º‡¶®‡¶æ‡¶Æ‡¶ø‡¶ï ‡¶ï‡¶®‡ßç‡¶ü‡ßá‡¶®‡ßç‡¶ü ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø‡¶ú‡ßá‡¶∂‡¶® (Dynamic Content Categorization)
                    </div>
                    <span className="text-[10px] bg-indigo-100/80 border border-indigo-200 text-indigo-800 font-bold px-2.5 py-1 rounded-full">
                      ‡¶®‡¶ø‡¶∞‡ßç‡¶¨‡¶æ‡¶ö‡¶ø‡¶§ ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶®: {selectedQIds.length} ‡¶ü‡¶ø
                    </span>
                  </div>

                  {/* Recommendation Banner */}
                  {hasJobKeywords ? (
                    <div className="text-[10px] bg-emerald-50 text-emerald-800 px-3 py-2 rounded-lg border border-emerald-150 font-semibold leading-relaxed flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span>üí° <b>‡¶™‡¶∞‡¶æ‡¶Æ‡¶∞‡ßç‡¶∂ (Smart Suggestion):</b> ‡¶®‡¶ø‡¶∞‡ßç‡¶¨‡¶æ‡¶ö‡¶ø‡¶§ ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶®‡¶∏‡¶Æ‡ßÇ‡¶π‡ßá ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ ‡¶¨‡¶æ ‡¶®‡¶ø‡ßü‡ßã‡¶ó ‡¶∏‡¶Ç‡¶ï‡ßç‡¶∞‡¶æ‡¶®‡ßç‡¶§ ‡¶¨‡¶ø‡¶∑‡ßü ‡¶∞‡ßü‡ßá‡¶õ‡ßá‡•§ ‡¶è‡¶ó‡ßÅ‡¶≤‡ßã‡¶ï‡ßá <b>"‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶® ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ"</b> ‡¶ú‡ßã‡¶®‡ßá‡¶∞ ‡¶Ü‡¶ì‡¶§‡¶æ‡¶ß‡ßÄ‡¶® ‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø‡¶§‡ßá ‡¶≤‡¶ø‡¶Ç‡¶ï ‡¶ï‡¶∞‡¶æ ‡¶∞‡¶ø‡¶ï‡¶Æ‡ßá‡¶®‡ßç‡¶°‡ßá‡¶°!</span>
                    </div>
                  ) : (
                    <div className="text-[10px] bg-indigo-50 text-indigo-800 px-3 py-2 rounded-lg border border-indigo-150 font-semibold leading-relaxed flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                      <span>üí° <b>‡¶™‡¶∞‡¶æ‡¶Æ‡¶∞‡ßç‡¶∂ (Smart Suggestion):</b> ‡¶è‡¶ó‡ßÅ‡¶≤‡ßã ‡¶∏‡¶æ‡¶ß‡¶æ‡¶∞‡¶£ ‡¶¨‡¶æ ‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶®‡•§ ‡¶è‡¶ó‡ßÅ‡¶≤‡ßã‡¶ï‡ßá <b>"‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø"</b> ‡¶ú‡ßã‡¶®‡ßá ‡¶≤‡¶ø‡¶Ç‡¶ï ‡¶ï‡¶∞‡¶æ ‡¶∞‡¶ø‡¶ï‡¶Æ‡ßá‡¶®‡ßç‡¶°‡ßá‡¶°!</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    {/* Destination Cascading Selectors */}
                    <div className="md:col-span-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                      {/* Destination Category selector */}
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1 font-bold">‡¶ó‡¶®‡ßç‡¶§‡¶¨‡ßç‡¶Ø ‡¶Æ‡ßÇ‡¶≤ ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø:</label>
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
                                {i === 0 ? '‡¶ó‡¶®‡ßç‡¶§‡¶¨‡ßç‡¶Ø ‡¶â‡¶™-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø (‡¶ß‡¶æ‡¶™ ‡ßß):' : `‡¶ó‡¶®‡ßç‡¶§‡¶¨‡ßç‡¶Ø ‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶ß‡¶æ‡¶™ ${i + 1}:`}
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
                                <option value="ALL">--- ‡¶∏‡¶ø‡¶≤‡ßá‡¶ï‡ßç‡¶ü ‡¶ï‡¶∞‡ßÅ‡¶® (‡¶ê‡¶ö‡ßç‡¶õ‡¶ø‡¶ï) ---</option>
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
                          <label className="block text-[9px] text-slate-500 font-extrabold uppercase">‡¶®‡¶§‡ßÅ‡¶® ‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶§‡ßà‡¶∞‡¶ø ‡¶ï‡¶∞‡ßÅ‡¶® ({moveDestCat}):</label>
                          <input 
                            type="text"
                            placeholder="‡¶Ø‡ßá‡¶Æ‡¶®: ‡ß™‡ß¨‡¶§‡¶Æ ‡¶¨‡¶ø‡¶∏‡¶ø‡¶è‡¶∏ ‡¶™‡ßç‡¶∞‡¶ø‡¶≤‡¶ø..."
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
                              ‡¶¨‡¶æ‡¶§‡¶ø‡¶≤
                            </button>
                            <button
                              onClick={() => {
                                const trimmed = inlineNewSubcatName.trim();
                                if (!trimmed) {
                                  alert('‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø‡¶∞ ‡¶®‡¶æ‡¶Æ ‡¶¶‡¶ø‡¶®!');
                                  return;
                                }
                                onAddSubcategory(trimmed, moveDestCat);
                                setMoveDestSubcatChain([trimmed]);
                                setInlineNewSubcatName('');
                                setIsAddingNewSubcatInline(false);
                              }}
                              className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[10px] font-bold"
                            >
                              ‡¶§‡ßà‡¶∞‡¶ø ‡¶ì ‡¶∏‡¶ø‡¶≤‡ßá‡¶ï‡ßç‡¶ü ‡¶ï‡¶∞‡ßÅ‡¶®
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setIsAddingNewSubcatInline(true)}
                          className="w-full border border-dashed border-indigo-300 hover:border-indigo-400 text-indigo-700 hover:text-indigo-800 font-bold py-1.5 px-3 rounded-lg text-[10px] flex items-center justify-center gap-1 transition bg-indigo-50/20"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          ‡¶ó‡¶®‡ßç‡¶§‡¶¨‡ßç‡¶Ø‡ßá ‡¶®‡¶§‡ßÅ‡¶® ‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶§‡ßà‡¶∞‡¶ø ‡¶ï‡¶∞‡ßÅ‡¶®
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2 border-t border-slate-100 pt-3 mt-1">
                    <span className="text-[10px] text-slate-500 font-semibold italic">
                      ‡¶ó‡¶®‡ßç‡¶§‡¶¨‡ßç‡¶Ø ‡¶®‡¶ø‡¶∞‡ßç‡¶¨‡¶æ‡¶ö‡¶® ‡¶ï‡¶∞‡¶æ‡¶∞ ‡¶™‡¶∞ ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶∏‡ßç‡¶•‡¶æ‡¶®‡¶æ‡¶®‡ßç‡¶§‡¶∞‡¶ø‡¶§ (Move) ‡¶¨‡¶æ ‡¶≤‡¶ø‡¶ô‡ßç‡¶ï (Link) ‡¶ï‡¶∞‡ßÅ‡¶®‡•§
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleBulkMove('move')}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold py-2 px-4 rounded-xl transition text-[11px] shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        üöö ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶™‡¶∞‡¶ø‡¶¨‡¶∞‡ßç‡¶§‡¶®/‡¶Æ‡ßÅ‡¶≠ ‡¶ï‡¶∞‡ßÅ‡¶® ({selectedQIds.length}‡¶ü‡¶ø)
                      </button>
                      <button
                        onClick={() => handleBulkMove('link')}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2 px-4 rounded-xl transition text-[11px] shadow-xs shadow-indigo-600/10 flex items-center gap-1.5 cursor-pointer"
                      >
                        üîó ‡¶Ö‡¶§‡¶ø‡¶∞‡¶ø‡¶ï‡ßç‡¶§ ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø‡¶§‡ßá ‡¶≤‡¶ø‡¶ô‡ßç‡¶ï ‡¶ï‡¶∞‡ßÅ‡¶®
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
                ‡¶Æ‡ßã‡¶ü <strong className="text-slate-900">{filteredQuestionsForManage.length.toLocaleString('bn-BD')}</strong> ‡¶ü‡¶ø ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶®‡ßá‡¶∞ ‡¶Æ‡¶ß‡ßç‡¶Ø‡ßá{' '}
                <span className="text-indigo-600 font-bold">
                  {((managePage - 1) * managePageSize + 1).toLocaleString('bn-BD')} - {Math.min(managePage * managePageSize, filteredQuestionsForManage.length).toLocaleString('bn-BD')}
                </span>{' '}
                ‡¶¶‡ßá‡¶ñ‡¶æ‡¶®‡ßã ‡¶π‡¶ö‡ßç‡¶õ‡ßá
              </div>

              <div className="flex items-center gap-2">
                <label className="text-[11px] text-slate-500 font-bold">‡¶™‡ßç‡¶∞‡¶§‡¶ø ‡¶™‡ßá‡¶ú‡ßá:</label>
                <select
                  value={managePageSize}
                  onChange={e => {
                    setManagePageSize(Number(e.target.value));
                    setManagePage(1);
                  }}
                  className="px-2 py-1 border border-slate-200 rounded-lg bg-white text-xs font-bold focus:outline-none"
                >
                  <option value={25}>‡ß®‡ß´ ‡¶ü‡¶ø</option>
                  <option value={50}>‡ß´‡ß¶ ‡¶ü‡¶ø</option>
                  <option value={100}>‡ßß‡ß¶‡ß¶ ‡¶ü‡¶ø</option>
                  <option value={200}>‡ß®‡ß¶‡ß¶ ‡¶ü‡¶ø</option>
                </select>

                <div className="flex items-center gap-1 ml-2">
                  <button
                    disabled={managePage === 1}
                    onClick={() => setManagePage(1)}
                    className="px-2 py-1 bg-white hover:bg-slate-100 disabled:opacity-40 border rounded-md font-bold transition cursor-pointer"
                    title="‡¶™‡ßç‡¶∞‡¶•‡¶Æ ‡¶™‡ßá‡¶ú"
                  >
                    ¬´¬´
                  </button>
                  <button
                    disabled={managePage === 1}
                    onClick={() => setManagePage(prev => Math.max(1, prev - 1))}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 disabled:opacity-40 border rounded-md font-bold transition cursor-pointer"
                  >
                    ¬´ ‡¶™‡ßÇ‡¶∞‡ßç‡¶¨‡¶¨‡¶∞‡ßç‡¶§‡ßÄ
                  </button>
                  <span className="px-2 py-1 text-slate-700 font-bold">
                    ‡¶™‡ßá‡¶ú {managePage.toLocaleString('bn-BD')} / {totalManagePages.toLocaleString('bn-BD')}
                  </span>
                  <button
                    disabled={managePage >= totalManagePages}
                    onClick={() => setManagePage(prev => Math.min(totalManagePages, prev + 1))}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 disabled:opacity-40 border rounded-md font-bold transition cursor-pointer"
                  >
                    ‡¶™‡¶∞‡¶¨‡¶∞‡ßç‡¶§‡ßÄ ¬ª
                  </button>
                  <button
                    disabled={managePage >= totalManagePages}
                    onClick={() => setManagePage(totalManagePages)}
                    className="px-2 py-1 bg-white hover:bg-slate-100 disabled:opacity-40 border rounded-md font-bold transition cursor-pointer"
                    title="‡¶∂‡ßá‡¶∑ ‡¶™‡ßá‡¶ú"
                  >
                    ¬ª¬ª
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* List Display */}
          <div className="border border-gray-150 rounded-xl divide-y divide-gray-100 max-h-[50vh] overflow-y-auto">
            {filteredQuestionsForManage.length === 0 ? (
              <p className="text-center text-gray-400 py-8 text-xs">‡¶ï‡ßã‡¶®‡ßã ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶™‡¶æ‡¶ì‡ßü‡¶æ ‡¶Ø‡¶æ‡ßü‡¶®‡¶ø‡•§ ‡¶´‡¶ø‡¶≤‡ßç‡¶ü‡¶æ‡¶∞ ‡¶™‡¶∞‡¶ø‡¶¨‡¶∞‡ßç‡¶§‡¶® ‡¶ï‡¶∞‡ßá ‡¶¶‡ßá‡¶ñ‡ßÅ‡¶®‡•§</p>
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
                          üìö {c}
                        </span>
                      ))}
                      {Array.from(new Set(q.subcategories && q.subcategories.length > 0 ? q.subcategories : (q.subcategory ? [q.subcategory] : []))).filter(Boolean).map((s, idx) => (
                        <span key={`${s}-${idx}`} className="bg-emerald-50 text-emerald-700 font-extrabold px-2.5 py-0.5 rounded-md border border-emerald-100/70 shadow-xs flex items-center gap-1">
                          üíº {s}
                        </span>
                      ))}
                      <span className="text-emerald-600 font-extrabold border-l pl-2 border-slate-200">
                        ‡¶∏‡¶†‡¶ø‡¶ï: {q.correct === 'Option A' ? q.optionA : q.correct === 'Option B' ? q.optionB : q.correct === 'Option C' ? q.optionC : q.optionD}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2.5 shrink-0 self-center">
                    <button 
                      onClick={() => handleStartEdit(q)}
                      className="text-indigo-600 hover:text-indigo-800 font-bold hover:underline flex items-center gap-0.5 text-[11px] cursor-pointer"
                    >
                      <Edit className="w-3 h-3" /> ‡¶è‡¶°‡¶ø‡¶ü
                    </button>
                    <button 
                      onClick={() => {
                        setSingleMoveQ(q);
                        setSingleMoveCat(q.category || '‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø');
                        setSingleMoveSubcatChain(q.subcategory ? [q.subcategory] : []);
                      }}
                      className="text-amber-600 hover:text-amber-800 font-bold hover:underline flex items-center gap-0.5 text-[11px] cursor-pointer"
                    >
                      üöö ‡¶Æ‡ßÅ‡¶≠ / ‡¶≤‡¶ø‡¶ô‡ßç‡¶ï
                    </button>
                    <button 
                      onClick={() => {
                        showCustomConfirm(
                          '‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶°‡¶ø‡¶≤‡¶ø‡¶ü ‡¶®‡¶ø‡¶∂‡ßç‡¶ö‡¶ø‡¶§‡¶ï‡¶∞‡¶£',
                          '‡¶Ü‡¶™‡¶®‡¶ø ‡¶ï‡¶ø ‡¶®‡¶ø‡¶∂‡ßç‡¶ö‡¶ø‡¶§‡¶≠‡¶æ‡¶¨‡ßá ‡¶è‡¶á ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶®‡¶ü‡¶ø ‡¶Æ‡ßÅ‡¶õ‡ßá ‡¶´‡ßá‡¶≤‡¶§‡ßá ‡¶ö‡¶æ‡¶®?',
                          async () => {
                            const ok = await onDeleteQuestion(q.id);
                            if (ok !== false) {
                              showCustomAlert('‡¶∏‡¶Æ‡ßç‡¶™‡¶®‡ßç‡¶® ‡¶π‡ßü‡ßá‡¶õ‡ßá!', '‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶®‡¶ü‡¶ø ‡¶∏‡¶´‡¶≤‡¶≠‡¶æ‡¶¨‡ßá ‡¶°‡¶ø‡¶≤‡¶ø‡¶ü ‡¶ï‡¶∞‡¶æ ‡¶π‡ßü‡ßá‡¶õ‡ßá!', 'success');
                            } else {
                              showCustomAlert('‡¶§‡ßç‡¶∞‡ßÅ‡¶ü‡¶ø!', '‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶°‡¶ø‡¶≤‡¶ø‡¶ü ‡¶ï‡¶∞‡¶§‡ßá ‡¶¨‡ßç‡¶Ø‡¶∞‡ßç‡¶• ‡¶π‡ßü‡ßá‡¶õ‡ßá!', 'error');
                            }
                          },
                          'warning'
                        );
                      }}
                      className="text-rose-600 hover:text-rose-800 font-bold hover:underline flex items-center gap-0.5 text-[11px] cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" /> ‡¶°‡¶ø‡¶≤‡¶ø‡¶ü
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
          ['‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø', '‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶® ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ', '‡¶∏‡¶æ‡¶≤ ‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶®', '‡¶∏‡¶æ‡¶ß‡¶æ‡¶∞‡¶£ ‡¶ú‡ßç‡¶û‡¶æ‡¶®'].forEach(r => registered.add(r.trim().toLowerCase()));
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
            const subjCat = (q.subjectCategory || q.csvCategory || '').trim();
            const subjSub = (q.subjectSubcategory || q.csvSubcategory || '').trim();

            if (subjCat && !isJobSolutionVariation(subjCat) && !isYearJobSolutionVariation(subjCat) && subjCat !== '‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø' && subjCat !== '‡¶∏‡¶æ‡¶ß‡¶æ‡¶∞‡¶£ ‡¶ú‡ßç‡¶û‡¶æ‡¶®') {
              candidates.push({ name: subjCat, parentHint: '‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø' });
            }

            if (subjSub && !isJobSolutionVariation(subjSub) && !isYearJobSolutionVariation(subjSub)) {
              candidates.push({ name: subjSub, parentHint: subjCat || '‡¶∏‡¶æ‡¶ß‡¶æ‡¶∞‡¶£ ‡¶ú‡ßç‡¶û‡¶æ‡¶®' });
            }

            // Also check non-exam legacy fields if subject fields were empty
            if (!subjCat && !subjSub) {
              if (q.category && !isJobSolutionVariation(q.category) && !isYearJobSolutionVariation(q.category) && q.category !== '‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø') {
                candidates.push({ name: q.category.trim(), parentHint: '‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø' });
              }
              if (q.subcategory && !isJobSolutionVariation(q.subcategory) && !isYearJobSolutionVariation(q.subcategory)) {
                candidates.push({ name: q.subcategory.trim(), parentHint: q.category || '‡¶∏‡¶æ‡¶ß‡¶æ‡¶∞‡¶£ ‡¶ú‡ßç‡¶û‡¶æ‡¶®' });
              }
            }

            candidates.forEach(({ name, parentHint }) => {
              if (!name) return;
              const lower = name.toLowerCase();
              if (registered.has(lower) || isJobSolutionVariation(name) || isYearJobSolutionVariation(name)) {
                return;
              }

              if (!map.has(lower)) {
                let parent = parentHint && parentHint.trim() ? parentHint.trim() : '‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø';
                if (isJobSolutionVariation(parent) || isYearJobSolutionVariation(parent)) {
                  parent = '‡¶∏‡¶æ‡¶ß‡¶æ‡¶∞‡¶£ ‡¶ú‡ßç‡¶û‡¶æ‡¶®';
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
          const path = findSubcategoryPath(sub.name).join(' ‚ûî ').toLowerCase();
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
                üíº ‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶¨‡¶æ ‡¶≤‡¶ø‡¶´ ‡¶®‡ßã‡¶° ‡¶§‡ßà‡¶∞‡¶ø ‡¶ï‡¶∞‡ßÅ‡¶® (Subcategories / Topics)
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
                    <label className="block text-[10px] text-gray-500 mb-1 font-bold">‡¶Æ‡ßÇ‡¶≤ ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶¨‡¶æ ‡¶™‡ßç‡¶Ø‡¶æ‡¶∞‡ßá‡¶®‡ßç‡¶ü ‡¶®‡¶ø‡¶∞‡ßç‡¶ß‡¶æ‡¶∞‡¶£ ‡¶ï‡¶∞‡ßÅ‡¶®:</label>
                    <select 
                      name="parentCat"
                      required
                      className="w-full px-3 py-2 border rounded-xl bg-white text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 text-[11px]"
                    >
                      <optgroup label="‡¶Æ‡ßÇ‡¶≤ ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø (Root Zones)">
                        <option value="‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø">‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø</option>
                        <option value="‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶® ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ">‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶® ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ</option>
                        <option value="‡¶∏‡¶æ‡¶≤ ‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶®">‡¶∏‡¶æ‡¶≤ ‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶®</option>
                        {(categories || []).map(c => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                      </optgroup>
                      {subcategories.length > 0 && (
                        <optgroup label="‡¶¨‡¶ø‡¶¶‡ßç‡¶Ø‡¶Æ‡¶æ‡¶® ‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶∏‡¶Æ‡ßÇ‡¶π">
                          {subcategories
                            .filter(s => s.name !== '‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø' && !isJobSolutionVariation(s.name) && !isYearJobSolutionVariation(s.name))
                            .map(s => (
                              <option key={s.id} value={s.name}>{s.name}</option>
                            ))
                          }
                        </optgroup>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1 font-bold">üè∑Ô∏è ‡¶∏‡¶æ‡¶¨-‡¶π‡ßá‡¶°‡¶ø‡¶Ç / ‡¶∏‡¶æ‡¶¨-‡¶ü‡¶æ‡¶á‡¶ü‡ßá‡¶≤ (‡¶ê‡¶ö‡ßç‡¶õ‡¶ø‡¶ï):</label>
                    <input 
                      name="subHeading"
                      type="text"
                      placeholder="‡¶Ø‡ßá‡¶Æ‡¶®: ‡ß©‡¶Ø‡¶º ‡¶ì ‡ß™‡¶∞‡ßç‡¶• ‡¶∂‡ßç‡¶∞‡ßá‡¶£‡ßÄ‡¶∞ ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø"
                      className="w-full px-3 py-1.5 border rounded-xl bg-white text-gray-800 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 text-[11px]"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1 font-bold">üìÖ ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ‡¶∞ ‡¶§‡¶æ‡¶∞‡¶ø‡¶ñ (‡¶≤‡¶ø‡¶´ ‡¶®‡ßã‡¶° ‡¶¨‡¶æ ‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø‡¶∞ ‡¶ú‡¶®‡ßç‡¶Ø):</label>
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
                    placeholder="‡¶®‡¶§‡ßÅ‡¶® ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø, ‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶¨‡¶æ ‡¶ü‡¶™‡¶ø‡¶ï‡ßá‡¶∞ ‡¶®‡¶æ‡¶Æ (‡¶Ø‡ßá‡¶Æ‡¶®: ‡¶¨‡¶æ‡¶Ç‡¶≤‡¶æ ‡¶∏‡¶æ‡¶π‡¶ø‡¶§‡ßç‡¶Ø / ‡¶∏‡¶Æ‡¶æ‡¶∏)"
                    className="flex-grow px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-800 font-semibold text-xs"
                  />
                  <button 
                    type="submit"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2 rounded-xl transition shadow-xs shrink-0 cursor-pointer text-xs"
                  >
                    ‚ûï ‡¶Ø‡ßã‡¶ó ‡¶ï‡¶∞‡ßÅ‡¶®
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
                  üå≥ ‡¶á‡¶®‡ßç‡¶ü‡¶æ‡¶∞‡ßá‡¶ï‡ßç‡¶ü‡¶ø‡¶≠ ‡¶ü‡ßç‡¶∞‡¶ø (Tree View)
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
                  üçÉ ‡¶≤‡¶ø‡¶´ ‡¶®‡ßã‡¶° ‡¶∏‡¶Æ‡ßÇ‡¶π (Leaf Nodes - {filteredLeafNodes.length})
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
                  üìã ‡¶∏‡¶ï‡¶≤ ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶ì ‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶ü‡ßá‡¶¨‡¶ø‡¶≤ ({categories.length + subcategories.length})
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
                  üïµÔ∏è‚Äç‚ôÇÔ∏è ‡¶≤‡ßÅ‡¶ï‡¶æ‡¶®‡ßã/‡¶á‡¶Æ‡¶™‡ßç‡¶≤‡¶ø‡¶∏‡¶ø‡¶ü ‡¶®‡ßã‡¶° ({hiddenNodes.length})
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative shrink-0 sm:w-64">
                <input
                  type="text"
                  value={categorySearchQuery}
                  onChange={e => setCategorySearchQuery(e.target.value)}
                  placeholder="üîç ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶¨‡¶æ ‡¶≤‡¶ø‡¶´ ‡¶®‡ßã‡¶° ‡¶ñ‡ßÅ‡¶Å‡¶ú‡ßÅ‡¶®..."
                  className="w-full pl-3 pr-8 py-2 border rounded-xl bg-slate-50 text-gray-800 font-semibold focus:outline-none focus:bg-white text-xs border-slate-200"
                />
                {categorySearchQuery && (
                  <button
                    onClick={() => setCategorySearchQuery('')}
                    className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 text-xs font-bold"
                  >
                    ‚úï
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
                    üå≥ ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø, ‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶ì ‡¶≤‡¶ø‡¶´ ‡¶®‡ßã‡¶° ‡¶∞‡¶ø‡¶≤‡ßá‡¶∂‡¶®‡¶∂‡¶ø‡¶™ ‡¶ü‡ßç‡¶∞‡¶ø (Interactive Tree View)
                  </h3>
                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <button
                      type="button"
                      onClick={expandAllNodes}
                      className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold px-2.5 py-1 rounded-xl text-[10px] transition border border-indigo-200 flex items-center gap-1 shadow-2xs cursor-pointer"
                      title="‡¶∏‡¶¨ ‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶™‡ßç‡¶∞‡¶∏‡¶æ‡¶∞‡¶ø‡¶§ ‡¶ï‡¶∞‡ßÅ‡¶®"
                    >
                      üìÇ ‡¶∏‡¶¨ ‡¶ñ‡ßÅ‡¶≤‡ßÅ‡¶®
                    </button>
                    <button
                      type="button"
                      onClick={collapseAllNodes}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold px-2.5 py-1 rounded-xl text-[10px] transition border border-slate-200 flex items-center gap-1 shadow-2xs cursor-pointer"
                      title="‡¶∏‡¶¨ ‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶ó‡ßÅ‡¶ü‡¶ø‡ßü‡ßá ‡¶®‡¶ø‡¶®"
                    >
                      üìÅ ‡¶∏‡¶¨ ‡¶ó‡ßÅ‡¶ü‡¶ø‡ßü‡ßá ‡¶®‡¶ø‡¶®
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  ‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø ‡¶ú‡ßã‡¶®, ‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶® ‡¶¨‡ßç‡¶Ø‡¶æ‡¶Ç‡¶ï ‡¶è‡¶¨‡¶Ç ‡¶∏‡¶æ‡¶≤ ‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶®‡ßá‡¶∞ ‡¶ï‡¶æ‡¶†‡¶æ‡¶Æ‡ßã ‡¶®‡¶ø‡¶ö‡ßá ‡¶∏‡¶æ‡¶ú‡¶æ‡¶®‡ßã ‡¶π‡ßü‡ßá‡¶õ‡ßá‡•§ ‡¶™‡ßç‡¶∞‡¶§‡¶ø‡¶ü‡¶ø ‡¶™‡ßç‡¶∞‡¶æ‡¶®‡ßç‡¶§‡¶ø‡¶ï ‡¶ß‡¶æ‡¶™ ‡¶¨‡¶æ ‡¶∂‡¶æ‡¶ñ‡¶æ ‡¶Ø‡¶æ‡¶∞ ‡¶Ü‡¶∞ ‡¶ï‡ßã‡¶®‡ßã ‡¶â‡¶™-‡¶ß‡¶æ‡¶™ ‡¶®‡ßá‡¶á, ‡¶§‡¶æ üçÉ <strong className="text-emerald-700">‡¶≤‡¶ø‡¶´ ‡¶®‡ßã‡¶° (Leaf Category)</strong> ‡¶π‡¶ø‡¶∏‡ßá‡¶¨‡ßá ‡¶ö‡¶ø‡¶π‡ßç‡¶®‡¶ø‡¶§ ‡¶Ü‡¶õ‡ßá‡•§
                </p>

                {/* Root Categories Switcher Bar (3 Toggle Buttons with Logos Only) */}
                <div className="bg-slate-50/80 p-2.5 rounded-2xl border border-slate-200/80 flex flex-row items-center justify-center gap-3">
                  <div className="flex flex-row items-center justify-center gap-3">
                    <button
                      type="button"
                      title="‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø"
                      onClick={() => setRootCategoryFilter('subject')}
                      className={`w-10 h-10 rounded-xl font-bold text-lg transition cursor-pointer flex items-center justify-center shrink-0 ${
                        rootCategoryFilter === 'subject'
                          ? 'bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-300 scale-105'
                          : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100 border border-indigo-200/80'
                      }`}
                    >
                      üìö
                    </button>
                    <button
                      type="button"
                      title="‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶® ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ"
                      onClick={() => setRootCategoryFilter('job')}
                      className={`w-10 h-10 rounded-xl font-bold text-lg transition cursor-pointer flex items-center justify-center shrink-0 ${
                        rootCategoryFilter === 'job'
                          ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-300 scale-105'
                          : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/80'
                      }`}
                    >
                      üíº
                    </button>
                    <button
                      type="button"
                      title="‡¶∏‡¶æ‡¶≤ ‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶®"
                      onClick={() => setRootCategoryFilter('year')}
                      className={`w-10 h-10 rounded-xl font-bold text-lg transition cursor-pointer flex items-center justify-center shrink-0 ${
                        rootCategoryFilter === 'year'
                          ? 'bg-amber-600 text-white shadow-xs ring-2 ring-amber-300 scale-105'
                          : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/80'
                      }`}
                    >
                      üìÖ
                    </button>
                  </div>
                </div>

                <div className="border border-slate-100 rounded-2xl bg-slate-50/50 p-4 max-h-[80vh] overflow-y-auto space-y-4">
                  {/* Tree View Subcategory Bulk Action Bar */}
                  {selectedSubcatIds.length > 0 && (
                    <div className="bg-gradient-to-r from-amber-50 to-indigo-50 border border-amber-200 p-3 rounded-2xl flex flex-col gap-2.5 shadow-xs animate-scale-up sticky top-0 z-20">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="bg-amber-600 text-white text-[11px] font-extrabold px-3 py-1 rounded-full shadow-2xs">
                            {selectedSubcatIds.length} ‡¶ü‡¶ø ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø/‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶®‡¶ø‡¶∞‡ßç‡¶¨‡¶æ‡¶ö‡¶ø‡¶§
                          </span>
                          <button
                            type="button"
                            onClick={() => setSelectedSubcatIds([])}
                            className="text-[11px] text-slate-600 hover:text-slate-800 font-bold underline cursor-pointer"
                          >
                            ‡¶ï‡ßç‡¶≤‡¶ø‡ßü‡¶æ‡¶∞
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleBulkMoveSubcatAction}
                            className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold px-3.5 py-1.5 rounded-lg text-[11px] shadow-2xs flex items-center gap-1 cursor-pointer transition"
                          >
                            üöö ‡¶∏‡ßç‡¶•‡¶æ‡¶®‡¶æ‡¶®‡ßç‡¶§‡¶∞‡¶ø‡¶§ ‡¶ï‡¶∞‡ßÅ‡¶®
                          </button>
                          <button
                            type="button"
                            onClick={handleBulkDeleteSubcatAction}
                            className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold px-3.5 py-1.5 rounded-lg text-[11px] shadow-2xs flex items-center gap-1 cursor-pointer transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            ‡¶è‡¶ï‡¶∏‡¶æ‡¶•‡ßá ‡¶Æ‡ßÅ‡¶õ‡ßÅ‡¶® ({selectedSubcatIds.length}‡¶ü‡¶ø)
                          </button>
                        </div>
                      </div>

                      <div className="w-full">
                        {renderCascadingMoveSelector(
                          bulkMoveDestCat,
                          setBulkMoveDestCat,
                          bulkMoveDestSubcatChain,
                          setBulkMoveDestSubcatChain,
                          selectedSubcatIds,
                          subcategories.filter(s => selectedSubcatIds.includes(s.id)).flatMap(s => [s.name, ...getSubcategoryDescendants(s.name)]),
                          true
                        )}
                      </div>
                    </div>
                  )}

                  {/* 1. Subject Categories */}
                  {(rootCategoryFilter === 'ALL' || rootCategoryFilter === 'subject') && (
                    <div>
                      <h4 className="font-extrabold text-xs text-indigo-950 mb-3 flex items-center gap-1.5 uppercase tracking-wider">
                        üìö ‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø ‡¶ú‡ßã‡¶® (Subject Categories Hierarchy)
                      </h4>
                      <div className="space-y-2">
                        {subcategories.filter(s => s.parentCategory === '‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø').length === 0 ? (
                          <p className="text-gray-400 italic text-[11px] pl-3">‡¶ï‡ßã‡¶®‡ßã ‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶®‡ßá‡¶á‡•§</p>
                        ) : (
                          subcategories
                            .filter(s => s.parentCategory === '‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø')
                            .map((sub, idx) => renderTreeNode(sub.name, sub.id, 'subcategory', 0))
                        )}
                      </div>
                    </div>
                  )}

                  {/* 2. Job Solutions / Exams */}
                  {(rootCategoryFilter === 'ALL' || rootCategoryFilter === 'job') && (
                    <div className={rootCategoryFilter === 'ALL' ? "border-t border-slate-200/80 pt-4" : ""}>
                      <h4 className="font-extrabold text-xs text-emerald-950 mb-3 flex items-center gap-1.5 uppercase tracking-wider">
                        üíº ‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶® ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ ‡¶∏‡¶Æ‡ßÇ‡¶π (Job Exams Hierarchy)
                      </h4>
                      <div className="space-y-2">
                        {subcategories.filter(s => isJobSolutionVariation(s.parentCategory)).length === 0 ? (
                          <p className="text-gray-400 italic text-[11px] pl-3">‡¶ï‡ßã‡¶®‡ßã ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ ‡¶¨‡¶æ ‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶® ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶®‡ßá‡¶á‡•§</p>
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
                        üìÖ ‡¶∏‡¶æ‡¶≤ ‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶® (Year-based Job Solutions Hierarchy)
                      </h4>
                      <div className="space-y-2">
                        {subcategories.filter(s => isYearJobSolutionVariation(s.parentCategory)).length === 0 ? (
                          <p className="text-gray-400 italic text-[11px] pl-3">‡¶ï‡ßã‡¶®‡ßã ‡¶∏‡¶æ‡¶≤ ‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶®‡ßá‡¶á‡•§</p>
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
                      üçÉ ‡¶∏‡¶ï‡¶≤ ‡¶≤‡¶ø‡¶´ ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø / ‡¶≤‡¶ø‡¶´ ‡¶®‡ßã‡¶° ‡¶∏‡¶Æ‡ßÇ‡¶π (Leaf Categories List)
                    </h3>
                    <p className="text-[11px] text-gray-500 mt-1">
                      ‡¶ü‡ßç‡¶∞‡¶ø ‡¶π‡¶æ‡ßü‡¶æ‡¶∞‡¶æ‡¶∞‡ßç‡¶ï‡¶ø‡¶∞ ‡¶Ø‡ßá‡¶∏‡¶¨ ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø‡¶∞ ‡¶Ö‡¶ß‡ßÄ‡¶®‡ßá ‡¶Ö‡¶®‡ßç‡¶Ø ‡¶ï‡ßã‡¶®‡ßã ‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶®‡ßá‡¶á, ‡¶∏‡ßá‡¶ó‡ßÅ‡¶≤‡ßã‡¶á ‡¶≤‡¶ø‡¶´ ‡¶®‡ßã‡¶°‡•§ ‡¶è‡¶ó‡ßÅ‡¶≤‡ßã‡¶§‡ßá ‡¶∏‡¶∞‡¶æ‡¶∏‡¶∞‡¶ø ‡¶ï‡ßÅ‡¶á‡¶ú ‡¶ì ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶Ø‡ßÅ‡¶ï‡ßç‡¶§ ‡¶ï‡¶∞‡¶æ ‡¶Ø‡¶æ‡ßü‡•§
                    </p>
                  </div>
                  <span className="bg-emerald-50 text-emerald-800 font-extrabold px-3 py-1 rounded-xl text-xs border border-emerald-200 shrink-0 self-start sm:self-auto">
                    ‡¶Æ‡ßã‡¶ü {filteredLeafNodes.length} ‡¶ü‡¶ø ‡¶≤‡¶ø‡¶´ ‡¶®‡ßã‡¶°
                  </span>
                </div>

                {/* Leaf Nodes Bulk Action Bar */}
                {selectedSubcatIds.length > 0 && (
                  <div className="bg-gradient-to-r from-amber-50 to-indigo-50 border border-amber-200 p-3 rounded-2xl flex flex-col gap-2.5 shadow-xs animate-scale-up">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="bg-amber-600 text-white text-[11px] font-extrabold px-3 py-1 rounded-full shadow-2xs">
                          {selectedSubcatIds.length} ‡¶ü‡¶ø ‡¶®‡ßã‡¶° ‡¶®‡¶ø‡¶∞‡ßç‡¶¨‡¶æ‡¶ö‡¶ø‡¶§
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedSubcatIds([])}
                          className="text-[11px] text-slate-600 hover:text-slate-800 font-bold underline cursor-pointer"
                        >
                          ‡¶ï‡ßç‡¶≤‡¶ø‡ßü‡¶æ‡¶∞
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleBulkMoveSubcatAction}
                          className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold px-3.5 py-1.5 rounded-lg text-[11px] shadow-2xs flex items-center gap-1 cursor-pointer transition"
                        >
                          üöö ‡¶∏‡ßç‡¶•‡¶æ‡¶®‡¶æ‡¶®‡ßç‡¶§‡¶∞‡¶ø‡¶§ ‡¶ï‡¶∞‡ßÅ‡¶®
                        </button>
                        <button
                          type="button"
                          onClick={handleBulkDeleteSubcatAction}
                          className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold px-3.5 py-1.5 rounded-lg text-[11px] shadow-2xs flex items-center gap-1 cursor-pointer transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          ‡¶è‡¶ï‡¶∏‡¶æ‡¶•‡ßá ‡¶Æ‡ßÅ‡¶õ‡ßÅ‡¶® ({selectedSubcatIds.length}‡¶ü‡¶ø)
                        </button>
                      </div>
                    </div>

                    <div className="w-full">
                      {renderCascadingMoveSelector(
                        bulkMoveDestCat,
                        setBulkMoveDestCat,
                        bulkMoveDestSubcatChain,
                        setBulkMoveDestSubcatChain,
                        selectedSubcatIds,
                        subcategories.filter(s => selectedSubcatIds.includes(s.id)).flatMap(s => [s.name, ...getSubcategoryDescendants(s.name)]),
                        true
                      )}
                    </div>
                  </div>
                )}

                {filteredLeafNodes.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 font-semibold">
                    ‡¶ï‡ßã‡¶®‡ßã ‡¶≤‡¶ø‡¶´ ‡¶®‡ßã‡¶° ‡¶™‡¶æ‡¶ì‡ßü‡¶æ ‡¶Ø‡¶æ‡ßü‡¶®‡¶ø‡•§
                  </div>
                ) : (
                  <div className="border border-slate-200/80 rounded-2xl bg-slate-50/50 p-2 overflow-hidden">
                    <div className="flex items-center justify-between text-[11px] text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl mb-2 font-semibold border border-emerald-200">
                      <span>‚ö° react-window ‡¶â‡¶á‡¶®‡ßç‡¶°‡ßã‡ßü‡ßá‡¶ú‡¶° ‡¶≠‡¶æ‡¶∞‡ßç‡¶ö‡ßÅ‡¶Ø‡¶º‡¶æ‡¶≤‡¶æ‡¶á‡¶ú‡ßá‡¶∂‡¶® ‡¶∏‡¶ï‡ßç‡¶∞‡¶ø‡ßü (‡¶ï‡ßá‡¶¨‡¶≤‡¶Æ‡¶æ‡¶§‡ßç‡¶∞ ‡¶¶‡ßÉ‡¶∂‡ßç‡¶Ø‡¶Æ‡¶æ‡¶® ‡¶â‡¶™‡¶æ‡¶¶‡¶æ‡¶® ‡¶∞‡ßá‡¶®‡ßç‡¶°‡¶æ‡¶∞ ‡¶π‡¶ö‡ßç‡¶õ‡ßá)</span>
                      <span className="font-extrabold">{filteredLeafNodes.length} ‡¶ü‡¶ø ‡¶®‡ßã‡¶°</span>
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
                                            title="‡¶∏‡¶ø‡¶≤‡ßá‡¶ï‡ßç‡¶ü ‡¶ï‡¶∞‡ßÅ‡¶®"
                                          />
                                          <span className="text-base shrink-0">üçÉ</span>
                                          <span className="truncate">{leaf.name}</span>
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => setViewNodeQuestionsModal({ nodeName: leaf.name, questions: getQuestionsForNode(leaf.name) })}
                                          className="bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-extrabold text-[9px] px-2 py-0.5 rounded-md border border-emerald-200 shrink-0 transition cursor-pointer flex items-center gap-1"
                                          title="‡¶è‡¶á ‡¶≤‡¶ø‡¶´ ‡¶®‡ßã‡¶°‡ßá‡¶∞ ‡¶∏‡¶ï‡¶≤ ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶¶‡ßá‡¶ñ‡ßÅ‡¶®"
                                        >
                                          {qCount} ‡¶ü‡¶ø ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® üëÅÔ∏è
                                        </button>
                                      </div>

                                      {/* Full Breadcrumb Trail */}
                                      <div className="text-[10px] text-slate-500 font-semibold flex items-center gap-1 flex-wrap bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-150 truncate">
                                        <span className="text-indigo-600 font-bold shrink-0">‡¶™‡ßç‡¶Ø‡¶æ‡¶∞‡ßá‡¶®‡ßç‡¶ü:</span>
                                        {fullPath.length > 0 ? (
                                          fullPath.map((p, idx) => (
                                            <span key={idx} className="flex items-center gap-1 truncate">
                                              <span className="text-slate-700 font-extrabold truncate">{p}</span>
                                              {idx < fullPath.length - 1 && <span className="text-gray-300 shrink-0">‚ûî</span>}
                                            </span>
                                          ))
                                        ) : (
                                          <span className="text-slate-600 truncate">{leaf.parentCategory || '‡¶∏‡¶æ‡¶ß‡¶æ‡¶∞‡¶£ ‡¶ú‡ßç‡¶û‡¶æ‡¶®'}</span>
                                        )}
                                      </div>

                                      {/* Date Setter & Formatted Display */}
                                      <div className="flex items-center justify-between text-[10px] bg-emerald-50/60 p-1.5 rounded-xl border border-emerald-100">
                                        <span className="text-emerald-900 font-extrabold flex items-center gap-1 truncate">
                                          <Calendar className="w-3 h-3 text-emerald-600 shrink-0" />
                                          {leaf.date ? formatBengaliDate(leaf.date) : '‡¶§‡¶æ‡¶∞‡¶ø‡¶ñ ‡¶¶‡ßá‡¶ì‡ßü‡¶æ ‡¶π‡ßü‡¶®‡¶ø'}
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
                                          title="‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ‡¶∞ ‡¶§‡¶æ‡¶∞‡¶ø‡¶ñ ‡¶™‡¶∞‡¶ø‡¶¨‡¶∞‡ßç‡¶§‡¶® ‡¶ï‡¶∞‡ßÅ‡¶®"
                                        />
                                      </div>

                                      {leaf.subHeading && (
                                        <div className="text-[10px] text-indigo-700 font-bold bg-indigo-50/80 px-2 py-0.5 rounded-md border border-indigo-100/80 truncate flex items-center gap-1">
                                          <span>üè∑Ô∏è Sub-heading:</span> {leaf.subHeading}
                                        </div>
                                      )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-slate-200/60">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setCategory(fullPath[0] || '‡¶∏‡¶æ‡¶ß‡¶æ‡¶∞‡¶£ ‡¶ú‡ßç‡¶û‡¶æ‡¶®');
                                          setSubcategory(leaf.name);
                                          setAddFormSubcatChain(fullPath);
                                          setActiveTab('add');
                                        }}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-2.5 py-1 rounded-lg text-[10px] transition shadow-2xs flex items-center gap-1 cursor-pointer shrink-0"
                                        title="‡¶è‡¶á ‡¶≤‡¶ø‡¶´ ‡¶®‡ßã‡¶°‡ßá ‡¶∏‡¶∞‡¶æ‡¶∏‡¶∞‡¶ø ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶Ø‡ßã‡¶ó ‡¶ï‡¶∞‡ßÅ‡¶®"
                                      >
                                        ‚ûï ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶Ø‡ßã‡¶ó
                                      </button>

                                      <div className="flex items-center gap-1 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            startEditSubcategory(leaf);
                                            expandNodeAndParents(leaf.name);
                                            setCategoryViewTab('tree');
                                          }}
                                          className="text-amber-700 hover:bg-amber-100 px-2 py-1 rounded-md text-[10px] font-bold transition cursor-pointer"
                                          title="‡¶è‡¶°‡¶ø‡¶ü ‡¶ï‡¶∞‡ßÅ‡¶®"
                                        >
                                          ‚úèÔ∏è ‡¶è‡¶°‡¶ø‡¶ü
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            showCustomConfirm(
                                              '‡¶°‡¶ø‡¶≤‡¶ø‡¶ü ‡¶®‡¶ø‡¶∂‡ßç‡¶ö‡¶ø‡¶§‡¶ï‡¶∞‡¶£',
                                              `‡¶Ü‡¶™‡¶®‡¶ø ‡¶ï‡¶ø ‡¶®‡¶ø‡¶∂‡ßç‡¶ö‡¶ø‡¶§‡¶≠‡¶æ‡¶¨‡ßá "${leaf.name}" ‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø/‡¶ü‡¶™‡¶ø‡¶ï ‡¶Æ‡ßÅ‡¶õ‡ßá ‡¶´‡ßá‡¶≤‡¶§‡ßá ‡¶ö‡¶æ‡¶®?`,
                                              () => {
                                                if (onDeleteSubcategory) {
                                                  onDeleteSubcategory(leaf.id);
                                                }
                                              },
                                              'warning',
                                              '‡¶Æ‡ßÅ‡¶õ‡ßá ‡¶´‡ßá‡¶≤‡ßÅ‡¶®',
                                              '‡¶¨‡¶æ‡¶§‡¶ø‡¶≤'
                                            );
                                          }}
                                          className="text-rose-600 hover:bg-rose-100 px-2 py-1 rounded-md text-[10px] font-bold transition cursor-pointer"
                                          title="‡¶Æ‡ßÅ‡¶õ‡ßÅ‡¶®"
                                        >
                                          ‚ùå ‡¶Æ‡ßÅ‡¶õ‡ßÅ‡¶®
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
                    üìã ‡¶∏‡¶ï‡¶≤ ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø, ‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶ì ‡¶≤‡¶ø‡¶´ ‡¶®‡ßã‡¶°‡ßá‡¶∞ ‡¶™‡ßÇ‡¶∞‡ßç‡¶£‡¶æ‡¶ô‡ßç‡¶ó ‡¶§‡¶æ‡¶≤‡¶ø‡¶ï‡¶æ (Complete Taxonomy List)
                  </h3>
                  <p className="text-[11px] text-gray-500 mt-1">
                    ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶ü‡ßç‡¶∞‡¶ø‡¶∞ ‡¶™‡ßç‡¶∞‡¶§‡¶ø‡¶ü‡¶ø ‡¶≤‡ßá‡ßü‡¶æ‡¶∞‡ßá‡¶∞ ‡¶∏‡¶Æ‡ßç‡¶™‡ßÇ‡¶∞‡ßç‡¶£ ‡¶¨‡¶ø‡¶¨‡¶∞‡¶£, ‡¶™‡ßç‡¶Ø‡¶æ‡¶∞‡ßá‡¶®‡ßç‡¶ü ‡¶®‡ßã‡¶° ‡¶è‡¶¨‡¶Ç ‡¶∏‡¶Ç‡¶∂‡ßç‡¶≤‡¶ø‡¶∑‡ßç‡¶ü ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶∏‡¶Ç‡¶ñ‡ßç‡¶Ø‡¶æ ‡¶®‡¶ø‡¶ö‡ßá ‡¶∏‡¶æ‡¶∞‡¶£‡¶ø ‡¶¨‡¶æ ‡¶ó‡ßç‡¶∞‡¶ø‡¶° ‡¶Ü‡¶ï‡¶æ‡¶∞‡ßá ‡¶¶‡ßá‡¶ì‡ßü‡¶æ ‡¶π‡¶≤‡ßã‡•§
                  </p>
                </div>

                {/* Section A: Root Categories */}
                <div className="space-y-3">
                  <h4 className="font-extrabold text-xs text-indigo-950 flex items-center gap-1.5 uppercase tracking-wider">
                    üìö ‡¶Æ‡ßÇ‡¶≤ ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶∏‡¶Æ‡ßÇ‡¶π (Root / Parent Categories)
                  </h4>
                  <div className="border border-slate-200 rounded-2xl overflow-hidden overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-extrabold border-b border-slate-200">
                        <tr>
                          <th className="p-3">‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø‡¶∞ ‡¶®‡¶æ‡¶Æ</th>
                          <th className="p-3">‡¶ü‡¶æ‡¶á‡¶™ / ‡¶Ö‡¶¨‡¶∏‡ßç‡¶•‡¶æ‡¶®</th>
                          <th className="p-3">‡¶Ö‡¶ß‡ßÄ‡¶®‡¶∏‡ßç‡¶• ‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø</th>
                          <th className="p-3">‡¶Æ‡ßã‡¶ü ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶®</th>
                          <th className="p-3 text-right">‡¶Ö‡ßç‡¶Ø‡¶æ‡¶ï‡¶∂‡¶®</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {['‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø', '‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶® ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ', '‡¶∏‡¶æ‡¶≤ ‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶®', ...(categories || []).map(c => c?.name || '').filter(Boolean)]
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
                                    <span>üìö</span>
                                    <span>{rootName}</span>
                                  </div>
                                  {catObj?.subHeading && (
                                    <div className="text-[10px] text-indigo-700 font-bold ml-6 mt-0.5">
                                      üè∑Ô∏è {catObj.subHeading}
                                    </div>
                                  )}
                                </td>
                                <td className="p-3">
                                  <span className="bg-indigo-50 text-indigo-700 font-extrabold text-[10px] px-2 py-0.5 rounded-md">
                                    Root Category
                                  </span>
                                </td>
                                <td className="p-3 text-slate-600 font-bold">{childCount} ‡¶ü‡¶ø ‡¶â‡¶™-‡¶ß‡¶æ‡¶™</td>
                                <td className="p-3 font-bold text-indigo-600">{qCount} ‡¶ü‡¶ø</td>
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
                                        ‚úèÔ∏è ‡¶è‡¶°‡¶ø‡¶ü
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          showCustomConfirm(
                                            '‡¶°‡¶ø‡¶≤‡¶ø‡¶ü ‡¶®‡¶ø‡¶∂‡ßç‡¶ö‡¶ø‡¶§‡¶ï‡¶∞‡¶£',
                                            `‡¶Ü‡¶™‡¶®‡¶ø ‡¶ï‡¶ø ‡¶®‡¶ø‡¶∂‡ßç‡¶ö‡¶ø‡¶§‡¶≠‡¶æ‡¶¨‡ßá "${catObj.name}" ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶è‡¶¨‡¶Ç ‡¶è‡¶∞ ‡¶Ü‡¶ì‡¶§‡¶æ‡¶ß‡ßÄ‡¶® ‡¶®‡ßã‡¶° ‡¶Æ‡ßÅ‡¶õ‡ßá ‡¶´‡ßá‡¶≤‡¶§‡ßá ‡¶ö‡¶æ‡¶®?`,
                                            () => {
                                              if (onDeleteCategory) {
                                                onDeleteCategory(catObj.id);
                                              }
                                            },
                                            'warning',
                                            '‡¶Æ‡ßÅ‡¶õ‡ßá ‡¶´‡ßá‡¶≤‡ßÅ‡¶®',
                                            '‡¶¨‡¶æ‡¶§‡¶ø‡¶≤'
                                          );
                                        }}
                                        className="text-rose-600 hover:underline font-bold text-[10px] px-1.5 py-1 cursor-pointer"
                                      >
                                        ‚ùå ‡¶Æ‡ßÅ‡¶õ‡ßÅ‡¶®
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
                      üíº ‡¶∏‡¶ï‡¶≤ ‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶ì ‡¶≤‡¶ø‡¶´ ‡¶®‡ßã‡¶°‡ßá‡¶∞ ‡¶∏‡¶æ‡¶∞‡¶£‡¶ø (Subcategories & Leaf Nodes)
                    </h4>
                    <span className="text-[10px] bg-emerald-50 text-emerald-800 font-bold px-2.5 py-0.5 rounded-md border border-emerald-200">
                      ‚ö° react-window ‡¶≠‡¶æ‡¶∞‡ßç‡¶ö‡ßÅ‡¶Ø‡¶º‡¶æ‡¶≤‡¶æ‡¶á‡¶ú‡¶° ‡¶∏‡¶æ‡¶∞‡¶£‡¶ø ({filteredAllSubcats.length} ‡¶ü‡¶ø ‡¶®‡ßã‡¶°)
                    </span>
                  </div>

                  {/* Subcategory Bulk Action Bar */}
                  {selectedSubcatIds.length > 0 && (
                    <div className="bg-gradient-to-r from-amber-50 to-indigo-50 border border-amber-200 p-3 rounded-2xl flex flex-col gap-2.5 shadow-xs animate-scale-up">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="bg-amber-600 text-white text-[11px] font-extrabold px-3 py-1 rounded-full shadow-2xs">
                            {selectedSubcatIds.length} ‡¶ü‡¶ø ‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶®‡¶ø‡¶∞‡ßç‡¶¨‡¶æ‡¶ö‡¶ø‡¶§
                          </span>
                          <button
                            type="button"
                            onClick={() => setSelectedSubcatIds([])}
                            className="text-[11px] text-slate-600 hover:text-slate-800 font-bold underline cursor-pointer"
                          >
                            ‡¶ï‡ßç‡¶≤‡¶ø‡ßü‡¶æ‡¶∞
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleBulkMoveSubcatAction}
                            className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold px-3.5 py-1.5 rounded-lg text-[11px] shadow-2xs flex items-center gap-1 cursor-pointer transition"
                          >
                            üöö ‡¶∏‡ßç‡¶•‡¶æ‡¶®‡¶æ‡¶®‡ßç‡¶§‡¶∞‡¶ø‡¶§ ‡¶ï‡¶∞‡ßÅ‡¶®
                          </button>
                          <button
                            type="button"
                            onClick={handleBulkDeleteSubcatAction}
                            className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold px-3.5 py-1.5 rounded-lg text-[11px] shadow-2xs flex items-center gap-1 cursor-pointer transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            ‡¶è‡¶ï‡¶∏‡¶æ‡¶•‡ßá ‡¶Æ‡ßÅ‡¶õ‡ßÅ‡¶® ({selectedSubcatIds.length}‡¶ü‡¶ø)
                          </button>
                        </div>
                      </div>

                      <div className="w-full">
                        {renderCascadingMoveSelector(
                          bulkMoveDestCat,
                          setBulkMoveDestCat,
                          bulkMoveDestSubcatChain,
                          setBulkMoveDestSubcatChain,
                          selectedSubcatIds,
                          subcategories.filter(s => selectedSubcatIds.includes(s.id)).flatMap(s => [s.name, ...getSubcategoryDescendants(s.name)]),
                          true
                        )}
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
                      <div className="col-span-3">‡¶®‡¶æ‡¶Æ</div>
                      <div className="col-span-3">‡¶™‡ßç‡¶Ø‡¶æ‡¶∞‡ßá‡¶®‡ßç‡¶ü ‡¶®‡ßã‡¶° / ‡¶ö‡ßá‡¶á‡¶®</div>
                      <div className="col-span-2">‡¶®‡ßã‡¶° ‡¶ü‡¶æ‡¶á‡¶™</div>
                      <div className="col-span-1">‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶®</div>
                      <div className="col-span-2 text-right">‡¶Ö‡ßç‡¶Ø‡¶æ‡¶ï‡¶∂‡¶®</div>
                    </div>

                    {filteredAllSubcats.length === 0 ? (
                      <div className="text-center py-8 text-gray-400 font-bold">
                        ‡¶ï‡ßã‡¶®‡ßã ‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶™‡¶æ‡¶ì‡ßü‡¶æ ‡¶Ø‡¶æ‡ßü‡¶®‡¶ø‡•§
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
                                  <span>{isLeaf ? 'üçÉ' : 'üìÇ'}</span>
                                  <span className="truncate">{sub.name}</span>
                                </div>
                                {sub.subHeading && (
                                  <div className="text-[10px] text-indigo-700 font-bold ml-5 truncate">
                                    üè∑Ô∏è {sub.subHeading}
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
                                {path.length > 0 ? path.join(' ‚ûî ') : sub.parentCategory}
                              </div>
                              <div className="col-span-2">
                                {isLeaf ? (
                                  <span className="bg-emerald-100 text-emerald-800 font-black text-[9.5px] px-2 py-0.5 rounded-md border border-emerald-300 shadow-2xs">
                                    üçÉ Leaf Node
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
                                  title="‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶®‡¶ó‡ßÅ‡¶≤‡ßã ‡¶¶‡ßá‡¶ñ‡ßÅ‡¶®"
                                >
                                  {qCount} ‡¶ü‡¶ø (‡¶¶‡ßá‡¶ñ‡ßÅ‡¶® üëÅÔ∏è)
                                </button>
                              </div>
                              <div className="col-span-2 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {isLeaf && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCategory(path[0] || '‡¶∏‡¶æ‡¶ß‡¶æ‡¶∞‡¶£ ‡¶ú‡ßç‡¶û‡¶æ‡¶®');
                                        setSubcategory(sub.name);
                                        setAddFormSubcatChain(path);
                                        setActiveTab('add');
                                      }}
                                      className="text-emerald-700 hover:underline font-extrabold text-[10px] px-1 cursor-pointer"
                                    >
                                      ‚ûï ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶Ø‡ßã‡¶ó
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      startEditSubcategory(sub);
                                      expandNodeAndParents(sub.name);
                                      setCategoryViewTab('tree');
                                    }}
                                    className="text-amber-700 hover:underline font-bold text-[10px] px-1 cursor-pointer"
                                  >
                                    ‚úèÔ∏è ‡¶è‡¶°‡¶ø‡¶ü
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      showCustomConfirm(
                                        '‡¶°‡¶ø‡¶≤‡¶ø‡¶ü ‡¶®‡¶ø‡¶∂‡ßç‡¶ö‡¶ø‡¶§‡¶ï‡¶∞‡¶£',
                                        `‡¶Ü‡¶™‡¶®‡¶ø ‡¶ï‡¶ø ‡¶®‡¶ø‡¶∂‡ßç‡¶ö‡¶ø‡¶§‡¶≠‡¶æ‡¶¨‡ßá "${sub.name}" ‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶Æ‡ßÅ‡¶õ‡ßá ‡¶´‡ßá‡¶≤‡¶§‡ßá ‡¶ö‡¶æ‡¶®?`,
                                        () => {
                                          if (onDeleteSubcategory) {
                                            onDeleteSubcategory(sub.id);
                                          }
                                        },
                                        'warning',
                                        '‡¶Æ‡ßÅ‡¶õ‡ßá ‡¶´‡ßá‡¶≤‡ßÅ‡¶®',
                                        '‡¶¨‡¶æ‡¶§‡¶ø‡¶≤'
                                      );
                                    }}
                                    className="text-rose-600 hover:underline font-bold text-[10px] px-1 cursor-pointer"
                                  >
                                    ‚ùå ‡¶Æ‡ßÅ‡¶õ‡ßÅ‡¶®
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
                      üïµÔ∏è‚Äç‚ôÇÔ∏è ‡¶≤‡ßÅ‡¶ï‡¶æ‡¶®‡ßã, ‡¶Ü‡¶®‡¶Æ‡ßç‡¶Ø‡¶æ‡¶™‡¶° ‡¶ì ‡¶π‡¶ø‡¶°‡ßá‡¶® ‡¶®‡ßã‡¶° ‡¶∏‡¶Æ‡ßÇ‡¶π (Hidden & Implicit Categories in Questions)
                    </h3>
                    <p className="text-[11px] text-purple-700 mt-1">
                      ‡¶Ø‡ßá‡¶∏‡¶¨ ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø, ‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶¨‡¶æ ‡¶ü‡¶™‡¶ø‡¶ï ‡¶®‡¶æ‡¶Æ ‡¶ï‡ßÅ‡¶á‡¶ú/‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶¨‡ßç‡¶Ø‡¶æ‡¶Ç‡¶ï‡ßá ‡¶¨‡ßç‡¶Ø‡¶¨‡¶π‡¶æ‡¶∞ ‡¶ï‡¶∞‡¶æ ‡¶π‡ßü‡ßá‡¶õ‡ßá ‡¶ï‡¶ø‡¶®‡ßç‡¶§‡ßÅ ‡¶Æ‡ßÇ‡¶≤ ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶ü‡ßç‡¶∞‡¶ø‡¶§‡ßá ‡¶Ü‡¶®‡ßÅ‡¶∑‡ßç‡¶†‡¶æ‡¶®‡¶ø‡¶ï‡¶≠‡¶æ‡¶¨‡ßá ‡¶®‡¶ø‡¶¨‡¶®‡ßç‡¶ß‡¶ø‡¶§ ‡¶®‡ßá‡¶á, ‡¶∏‡ßá‡¶ó‡ßÅ‡¶≤‡ßã ‡¶®‡¶ø‡¶ö‡ßá ‡¶¶‡ßá‡¶ñ‡¶æ‡¶®‡ßã ‡¶π‡¶≤‡ßã‡•§
                    </p>
                  </div>

                  {hiddenNodes.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        showCustomConfirm(
                          '‡¶∏‡¶ï‡¶≤ ‡¶π‡¶ø‡¶°‡ßá‡¶® ‡¶®‡ßã‡¶° ‡¶∏‡¶ø‡¶ô‡ßç‡¶ï ‡¶®‡¶ø‡¶∂‡ßç‡¶ö‡¶ø‡¶§‡¶ï‡¶∞‡¶£',
                          `‡¶Ü‡¶™‡¶®‡¶ø ‡¶ï‡¶ø ‡¶®‡¶ø‡¶∂‡ßç‡¶ö‡¶ø‡¶§‡¶≠‡¶æ‡¶¨‡ßá ‡¶∏‡¶®‡¶æ‡¶ï‡ßç‡¶§‡¶ï‡ßÉ‡¶§ ${hiddenNodes.length} ‡¶ü‡¶ø ‡¶π‡¶ø‡¶°‡ßá‡¶® ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø/‡¶ü‡¶™‡¶ø‡¶ï‡¶ï‡ßá ‡¶Æ‡ßÇ‡¶≤ ‡¶ü‡ßç‡¶∞‡¶ø‡¶§‡ßá ‡¶®‡¶ø‡¶¨‡¶®‡ßç‡¶ß‡¶® ‡¶ï‡¶∞‡¶§‡ßá ‡¶ö‡¶æ‡¶®?`,
                          () => {
                            hiddenNodes.forEach(hn => {
                              const parent = unmappedNodeParents[hn.name] || hn.suggestedParent;
                              onAddSubcategory(hn.name, parent);
                            });
                            showCustomAlert('‡¶∏‡¶Æ‡ßç‡¶™‡¶®‡ßç‡¶® ‡¶π‡ßü‡ßá‡¶õ‡ßá!', '‡¶∏‡¶ï‡¶≤ ‡¶π‡¶ø‡¶°‡ßá‡¶® ‡¶®‡ßã‡¶° ‡¶∏‡¶´‡¶≤‡¶≠‡¶æ‡¶¨‡ßá ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶ü‡ßç‡¶∞‡¶ø‡¶§‡ßá ‡¶∏‡¶ø‡¶ô‡ßç‡¶ï ‡¶ì ‡¶∞‡ßá‡¶ú‡¶ø‡¶∏‡ßç‡¶ü‡¶æ‡¶∞ ‡¶ï‡¶∞‡¶æ ‡¶π‡ßü‡ßá‡¶õ‡ßá!', 'success');
                          },
                          'info'
                        );
                      }}
                      className="bg-purple-600 hover:bg-purple-700 text-white font-extrabold px-3.5 py-2 rounded-xl text-xs transition shadow-xs flex items-center gap-1.5 shrink-0 self-start sm:self-auto cursor-pointer"
                    >
                      ‚ö° ‡¶∏‡¶¨ {hiddenNodes.length} ‡¶ü‡¶ø ‡¶ü‡ßç‡¶∞‡¶ø‡¶§‡ßá ‡¶Ö‡¶ü‡ßã-‡¶®‡¶ø‡¶¨‡¶®‡ßç‡¶ß‡¶® ‡¶ï‡¶∞‡ßÅ‡¶®
                    </button>
                  )}
                </div>

                {hiddenNodes.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 font-bold bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                    üéâ ‡¶ï‡ßã‡¶®‡ßã ‡¶π‡¶ø‡¶°‡ßá‡¶® ‡¶¨‡¶æ ‡¶Ü‡¶®‡¶Æ‡ßç‡¶Ø‡¶æ‡¶™‡¶° ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶™‡¶æ‡¶ì‡ßü‡¶æ ‡¶Ø‡¶æ‡ßü‡¶®‡¶ø! ‡¶∏‡¶ï‡¶≤ ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶ü‡ßç‡¶∞‡¶ø‡¶∞ ‡¶∏‡¶æ‡¶•‡ßá ‡¶™‡ßÅ‡¶∞‡ßã‡¶™‡ßÅ‡¶∞‡¶ø ‡¶∏‡¶ø‡¶ô‡ßç‡¶ï‡¶° ‡¶∞‡ßü‡ßá‡¶õ‡ßá‡•§
                  </div>
                ) : (
                  <div className="border border-purple-200/80 rounded-2xl bg-purple-50/30 p-2 overflow-hidden">
                    <div className="flex items-center justify-between text-[11px] text-purple-900 bg-purple-100/70 px-3 py-1.5 rounded-xl mb-2 font-semibold border border-purple-200">
                      <span>‚ö° react-window ‡¶â‡¶á‡¶®‡ßç‡¶°‡ßã‡ßü‡ßá‡¶ú‡¶° ‡¶≠‡¶æ‡¶∞‡ßç‡¶ö‡ßÅ‡¶Ø‡¶º‡¶æ‡¶≤‡¶æ‡¶á‡¶ú‡ßá‡¶∂‡¶® ‡¶∏‡¶ï‡ßç‡¶∞‡¶ø‡ßü</span>
                      <span className="font-extrabold">{hiddenNodes.length} ‡¶ü‡¶ø ‡¶π‡¶ø‡¶°‡ßá‡¶® ‡¶®‡ßã‡¶°</span>
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
                                            üïµÔ∏è‚Äç‚ôÇÔ∏è ‡¶Ü‡¶®‡¶Æ‡ßç‡¶Ø‡¶æ‡¶™‡¶° ‡¶®‡ßã‡¶°
                                          </span>
                                          <h4 className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5 truncate">
                                            <span>üçÉ</span> <span className="truncate">{hn.name}</span>
                                          </h4>
                                        </div>
                                        <span className="bg-purple-600 text-white font-extrabold text-[10px] px-2 py-0.5 rounded-full shrink-0 shadow-2xs">
                                          {hn.questionCount} ‡¶ü‡¶ø ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶®
                                        </span>
                                      </div>

                                      <div className="bg-purple-50/60 p-2 rounded-xl border border-purple-150 text-[10.5px] space-y-1">
                                        <label className="text-purple-800 font-extrabold block text-[9.5px]">
                                          üìÅ ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡¶æ‡¶¨‡¶ø‡¶§ ‡¶™‡ßç‡¶Ø‡¶æ‡¶∞‡ßá‡¶®‡ßç‡¶ü ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø:
                                        </label>
                                        <select
                                          value={currentSelectedParent}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            setUnmappedNodeParents(prev => ({ ...prev, [hn.name]: val }));
                                          }}
                                          className="w-full px-2 py-1 border border-purple-200 rounded-lg bg-white text-slate-900 font-extrabold focus:outline-none focus:ring-1 focus:ring-purple-500 text-[10.5px] cursor-pointer"
                                        >
                                          <optgroup label="‡¶Æ‡ßÇ‡¶≤ ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø (Root Zones)">
                                            <option value="‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø">‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø</option>
                                            <option value="‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶® ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ">‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶® ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ</option>
                                            <option value="‡¶∏‡¶æ‡¶≤ ‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶®">‡¶∏‡¶æ‡¶≤ ‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶®</option>
                                            {(categories || []).map(c => (
                                              <option key={c.id} value={c.name}>{c.name}</option>
                                            ))}
                                          </optgroup>
                                          {subcategories.length > 0 && (
                                            <optgroup label="‡¶¨‡¶ø‡¶¶‡ßç‡¶Ø‡¶Æ‡¶æ‡¶® ‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø ‡¶∏‡¶Æ‡ßÇ‡¶π">
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
                                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">‡¶®‡¶Æ‡ßÅ‡¶®‡¶æ ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶®:</span>
                                          {hn.sampleQuestions.slice(0, 1).map((sq, sIdx) => (
                                            <div key={sq.id || sIdx} className="text-[9.5px] text-slate-700 bg-slate-50 p-1 rounded-md border border-slate-200/70 truncate">
                                              ‚Ä¢ {sq.text}
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
                                          showCustomAlert('‡¶®‡¶ø‡¶¨‡¶®‡ßç‡¶ß‡¶ø‡¶§ ‡¶π‡ßü‡ßá‡¶õ‡ßá!', `"${hn.name}" ‡¶∏‡¶´‡¶≤‡¶≠‡¶æ‡¶¨‡ßá "${currentSelectedParent}" ‡¶è‡¶∞ ‡¶Ö‡¶ß‡ßÄ‡¶®‡ßá ‡¶Ø‡ßÅ‡¶ï‡ßç‡¶§ ‡¶ï‡¶∞‡¶æ ‡¶π‡ßü‡ßá‡¶õ‡ßá‡•§`, 'success');
                                        }}
                                        className="w-full bg-purple-600 hover:bg-purple-700 text-white font-extrabold py-1 px-3 rounded-xl transition shadow-2xs text-[10.5px] flex items-center justify-center gap-1 cursor-pointer"
                                      >
                                        ‚ûï ‡¶ü‡ßç‡¶∞‡¶ø‡¶§‡ßá ‡¶®‡¶ø‡¶¨‡¶®‡ßç‡¶ß‡¶® ‡¶ï‡¶∞‡ßÅ‡¶®
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

      {/* CURRENT AFFAIRS MANAGEMENT TAB */}
      {activeTab === 'current-affairs' && (
        <CurrentAffairsAdmin
          subcategories={subcategories}
          questions={questions}
          categories={categories}
          onAddSubcategory={onAddSubcategory}
          onUpdateSubcategory={onUpdateSubcategory ? (id, newName, newParent, date, subHeading, text) => onUpdateSubcategory(id, newName, newParent, date, subHeading, text) : () => {}}
          onDeleteSubcategory={onDeleteSubcategory}
          onAddQuestion={(q) => onAddQuestion(q)}
          onUpdateQuestion={(q) => onUpdateQuestion(q.id, q)}
          onDeleteQuestion={onDeleteQuestion}
        />
      )}

      {/* 3. EXAMS & NOTICE BOARD */}
      {activeTab === 'exams' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 text-xs">
          {/* Notice Board Settings */}
          <div className="md:col-span-5 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-4">
            <h3 className="font-bold text-sm text-gray-800 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-indigo-600" />
              üì¢ ‡¶®‡ßã‡¶ü‡¶ø‡¶∂ ‡¶¨‡ßã‡¶∞‡ßç‡¶° ‡¶Ü‡¶™‡¶°‡ßá‡¶ü ‡¶ï‡¶∞‡ßÅ‡¶®
            </h3>
            <div>
              <label className="block text-gray-500 mb-1">‡¶∏‡¶∞‡ßç‡¶¨‡¶∂‡ßá‡¶∑ ‡¶®‡ßã‡¶ü‡¶ø‡¶∂ ‡¶ü‡ßá‡¶ï‡ßç‡¶∏‡¶ü:</label>
              <textarea 
                rows={4}
                value={noticeText}
                onChange={e => setNoticeText(e.target.value)}
                placeholder="‡¶®‡¶§‡ßÅ‡¶® ‡¶ï‡ßã‡¶®‡ßã ‡¶Ü‡¶™‡¶°‡ßá‡¶ü ‡¶•‡¶æ‡¶ï‡¶≤‡ßá ‡¶è‡¶ñ‡¶æ‡¶®‡ßá ‡¶≤‡¶ø‡¶ñ‡ßÅ‡¶® ‡¶Ø‡¶æ ‡¶∏‡¶∞‡¶æ‡¶∏‡¶∞‡¶ø ‡¶π‡ßã‡¶Æ‡¶™‡ßá‡¶ú‡ßá ‡¶™‡ßç‡¶∞‡¶¶‡¶∞‡ßç‡¶∂‡¶ø‡¶§ ‡¶π‡¶¨‡ßá..."
                className="w-full px-3 py-2 border rounded-xl text-gray-800 focus:outline-none"
              />
            </div>
            <button 
              onClick={handleSaveNoticeText}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl transition shadow"
            >
              ‡¶®‡ßã‡¶ü‡¶ø‡¶∂ ‡¶™‡¶æ‡¶¨‡¶≤‡¶ø‡¶∂ ‡¶ï‡¶∞‡ßÅ‡¶®
            </button>
          </div>

          {/* Live Exam Management */}
          <div className="md:col-span-7 flex flex-col gap-5">
            {/* Create Exam */}
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
              <h3 className="font-bold text-sm text-gray-800 mb-3 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-red-600" />
                ‚è±Ô∏è ‡¶®‡¶§‡ßÅ‡¶® ‡¶Ö‡¶´‡¶ø‡¶∂‡¶ø‡ßü‡¶æ‡¶≤ ‡¶≤‡¶æ‡¶á‡¶≠ ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ ‡¶Ø‡ßÅ‡¶ï‡ßç‡¶§ ‡¶ï‡¶∞‡ßÅ‡¶®
              </h3>
              <form onSubmit={handleCreateLiveExam} className="space-y-3">
                <div>
                  <label className="block text-gray-600 mb-1 font-medium">‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ‡¶∞ ‡¶®‡¶æ‡¶Æ/‡¶∂‡¶ø‡¶∞‡ßã‡¶®‡¶æ‡¶Æ:</label>
                  <input 
                    type="text" 
                    required
                    value={examTitle}
                    onChange={e => setExamTitle(e.target.value)}
                    placeholder="‡¶Ø‡ßá‡¶Æ‡¶®: ‡ß™‡ß¨‡¶§‡¶Æ ‡¶¨‡¶ø‡¶∏‡¶ø‡¶è‡¶∏ ‡¶∏‡ßç‡¶™‡ßá‡¶∂‡¶æ‡¶≤ ‡¶Æ‡¶°‡ßá‡¶≤ ‡¶ü‡ßá‡¶∏‡ßç‡¶ü - ‡ß¶‡ß©" 
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
                    üõ†Ô∏è ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶®‡ßá‡¶∞ ‡¶Æ‡ßç‡¶Ø‡¶æ‡¶®‡ßÅ‡ßü‡¶æ‡¶≤ ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶®‡¶ø‡¶∞‡ßç‡¶¨‡¶æ‡¶ö‡¶® (Manual MCQ Selection) ‡¶∏‡¶ï‡ßç‡¶∞‡¶ø‡ßü ‡¶ï‡¶∞‡ßÅ‡¶®
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-600 mb-1 font-medium">‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶∏‡¶Ç‡¶ñ‡ßç‡¶Ø‡¶æ ‡¶∏‡ßÄ‡¶Æ‡¶æ (Questions Limit):</label>
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
                    <label className="block text-gray-600 mb-1 font-medium">‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ‡¶∞ ‡¶∏‡¶Æ‡ßü (‡¶Æ‡¶ø‡¶®‡¶ø‡¶ü):</label>
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
                      üìä ‡ßÆ‡¶ü‡¶ø ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶®‡ßá‡¶∞ ‡¶ï‡ßã‡¶ü‡¶æ ‡¶®‡¶ø‡¶∞‡ßç‡¶ß‡¶æ‡¶∞‡¶£ ‡¶ï‡¶∞‡ßÅ‡¶®:
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
                        ‡¶ü‡¶æ‡¶∞‡ßç‡¶ó‡ßá‡¶ü ‡¶Æ‡ßã‡¶ü ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶®: <b className="text-gray-900 font-black">{examQLimit}‡¶ü‡¶ø</b>
                      </span>
                      <span className={`font-black px-2 py-1 rounded-md ${
                        Object.values(categoryLimits).reduce((s: number, v: any) => s + Number(v), 0) === Number(examQLimit)
                          ? 'text-green-600 bg-green-50' 
                          : 'text-rose-600 bg-rose-50'
                      }`}>
                        ‡¶¨‡¶∞‡ßç‡¶§‡¶Æ‡¶æ‡¶® ‡¶ï‡ßã‡¶ü‡¶æ‡¶∞ ‡¶Ø‡ßã‡¶ó‡¶´‡¶≤: {Object.values(categoryLimits).reduce((s: number, v: any) => s + Number(v), 0)}‡¶ü‡¶ø {
                          Object.values(categoryLimits).reduce((s: number, v: any) => s + Number(v), 0) === Number(examQLimit) ? '‚úì' : '‚úï'
                        }
                      </span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-1">
                    <label className="block text-gray-600 mb-1 font-medium">‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ‡¶∞ ‡¶¨‡¶ø‡¶∑‡ßü:</label>
                    {isManualSelection ? (
                      <input 
                        type="text" 
                        disabled 
                        value="‡¶Æ‡ßç‡¶Ø‡¶æ‡¶®‡ßÅ‡ßü‡¶æ‡¶≤ ‡¶∏‡¶ø‡¶≤‡ßá‡¶ï‡¶∂‡¶® (Mixed)"
                        className="w-full px-3 py-2 border rounded-xl bg-gray-50 text-gray-500 focus:outline-none text-xs font-bold" 
                      />
                    ) : (
                      <select 
                        value={examCategory}
                        onChange={e => setExamCategory(e.target.value)}
                        className="w-full px-3 py-2 border rounded-xl bg-white text-gray-800 focus:outline-none text-xs"
                      >
                        <option value="ALL">‡¶∏‡¶¨ ‡¶¨‡¶ø‡¶∑‡ßü ‡¶Æ‡¶ø‡¶≤‡¶ø‡ßü‡ßá</option>
                        {distinctCategories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    )}
                  </div>
                  <div className="sm:col-span-1">
                    <label className="block text-gray-600 mb-1 font-medium">‡¶∂‡ßÅ‡¶∞‡ßÅ‡¶∞ ‡¶∏‡¶Æ‡ßü:</label>
                    <input 
                      type="datetime-local" 
                      required
                      value={examStartTime}
                      onChange={e => setExamStartTime(e.target.value)}
                      className="w-full px-3 py-1.5 border rounded-xl text-gray-800 focus:outline-none text-xs" 
                    />
                  </div>
                  <div className="sm:col-span-1">
                    <label className="block text-gray-600 mb-1 font-medium">‡¶∂‡ßá‡¶∑‡ßá‡¶∞ ‡¶∏‡¶Æ‡ßü‡¶∏‡ßÄ‡¶Æ‡¶æ:</label>
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
                        üéØ ‡¶Æ‡ßç‡¶Ø‡¶æ‡¶®‡ßÅ‡ßü‡¶æ‡¶≤ ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶®‡¶ø‡¶∞‡ßç‡¶¨‡¶æ‡¶ö‡¶® ‡¶ì ‡¶ï‡ßç‡¶Ø‡¶æ‡¶∏‡ßç‡¶ï‡ßá‡¶°‡¶ø‡¶Ç ‡¶´‡¶ø‡¶≤‡ßç‡¶ü‡¶æ‡¶∞ ‡¶™‡ßç‡¶Ø‡¶æ‡¶®‡ßá‡¶≤
                      </h4>
                      <p className="text-[10px] text-gray-500 font-semibold mt-0.5">
                        ‡¶®‡¶ø‡¶ö‡ßá‡¶∞ ‡ßÆ‡¶ü‡¶ø ‡¶¨‡¶ø‡¶∑‡ßü ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø‡¶∞ ‡¶ü‡ßç‡¶Ø‡¶æ‡¶¨ ‡¶®‡¶ø‡¶∞‡ßç‡¶¨‡¶æ‡¶ö‡¶® ‡¶ï‡¶∞‡ßÅ‡¶® ‡¶è‡¶¨‡¶Ç ‡¶ï‡ßç‡¶Ø‡¶æ‡¶∏‡ßç‡¶ï‡ßá‡¶°‡¶ø‡¶Ç ‡¶´‡¶ø‡¶≤‡ßç‡¶ü‡¶æ‡¶∞ ‡¶¨‡ßç‡¶Ø‡¶¨‡¶π‡¶æ‡¶∞ ‡¶ï‡¶∞‡ßá ‡¶°‡¶æ‡¶ü‡¶æ‡¶¨‡ßá‡¶∏ ‡¶•‡ßá‡¶ï‡ßá ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶®‡¶∏‡¶Æ‡ßÇ‡¶π ‡¶Æ‡ßç‡¶Ø‡¶æ‡¶®‡ßÅ‡ßü‡¶æ‡¶≤‡¶ø ‡¶∏‡¶ø‡¶≤‡ßá‡¶ï‡ßç‡¶ü ‡¶ï‡¶∞‡ßÅ‡¶®‡•§
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
                            alert(`‡¶Ü‡¶™‡¶®‡¶ø ‡¶á‡¶§‡¶ø‡¶Æ‡¶ß‡ßç‡¶Ø‡ßá ‡¶è‡¶á ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø‡¶∞ ‡¶∏‡¶∞‡ßç‡¶¨‡ßã‡¶ö‡ßç‡¶ö ‡¶ï‡ßã‡¶ü‡¶æ (${limit}‡¶ü‡¶ø) ‡¶™‡ßÇ‡¶∞‡¶£ ‡¶ï‡¶∞‡ßá‡¶õ‡ßá‡¶®! ‡¶®‡¶§‡ßÅ‡¶® ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶®‡¶ø‡¶∞‡ßç‡¶¨‡¶æ‡¶ö‡¶® ‡¶ï‡¶∞‡¶æ‡¶∞ ‡¶™‡ßÇ‡¶∞‡ßç‡¶¨‡ßá ‡¶™‡ßÇ‡¶∞‡ßç‡¶¨‡ßá‡¶∞ ‡¶ï‡ßã‡¶®‡ßã ‡¶®‡¶ø‡¶∞‡ßç‡¶¨‡¶æ‡¶ö‡¶® ‡¶¨‡¶æ‡¶§‡¶ø‡¶≤ ‡¶ï‡¶∞‡ßÅ‡¶® ‡¶¨‡¶æ ‡¶ï‡ßã‡¶ü‡¶æ‡¶∞ ‡¶™‡¶∞‡¶ø‡¶Æ‡¶æ‡¶£ ‡¶¨‡ßÉ‡¶¶‡ßç‡¶ß‡¶ø ‡¶ï‡¶∞‡ßÅ‡¶®‡•§`);
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
                          alert("‡¶á‡¶§‡¶ø‡¶Æ‡¶ß‡ßç‡¶Ø‡ßá ‡¶ï‡ßã‡¶ü‡¶æ ‡¶∏‡¶Æ‡ßç‡¶™‡ßÇ‡¶∞‡ßç‡¶£ ‡¶∞‡ßü‡ßá‡¶õ‡ßá!");
                          return;
                        }
                        const matchingRecs = questions.filter(q => {
                          if (classifyQuestion(q) !== activeSelectionTab) return false;
                          return !getSelectedCategoryForQuestion(q.id);
                        });

                        if (matchingRecs.length === 0) {
                          alert("‡¶¶‡ßÅ‡¶É‡¶ñ‡¶ø‡¶§, ‡¶è‡¶á ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø‡¶∞ ‡¶ú‡¶®‡ßç‡¶Ø ‡¶ï‡ßã‡¶®‡ßã ‡¶Ö‡¶¨‡ßç‡¶Ø‡¶¨‡¶π‡ßÉ‡¶§ ‡¶∞‡ßá‡¶ï‡¶Æ‡ßá‡¶®‡ßç‡¶°‡ßá‡¶° ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶ñ‡ßÅ‡¶Å‡¶ú‡ßá ‡¶™‡¶æ‡¶ì‡ßü‡¶æ ‡¶Ø‡¶æ‡ßü‡¶®‡¶ø!");
                          return;
                        }

                        const shuffled = [...matchingRecs].sort(() => 0.5 - Math.random());
                        const toAdd = shuffled.slice(0, needed).map(q => q.id);

                        setSelectedQuestionsByCategory({
                          ...selectedQuestionsByCategory,
                          [activeSelectionTab]: [...selectedList, ...toAdd]
                        });
                        alert(`‚ú® ‡¶∏‡¶´‡¶≤‡¶≠‡¶æ‡¶¨‡ßá ${toAdd.length}‡¶ü‡¶ø ‡¶∞‡ßá‡¶ï‡¶Æ‡ßá‡¶®‡ßç‡¶°‡ßá‡¶° ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶Ö‡¶ü‡ßã-‡¶´‡¶ø‡¶≤ ‡¶ï‡¶∞‡¶æ ‡¶π‡ßü‡ßá‡¶õ‡ßá!`);
                      };

                      // Auto-fill using currently filtered list
                      const autoFillRandomFiltered = () => {
                        const needed = limit - selectedList.length;
                        if (needed <= 0) {
                          alert("‡¶á‡¶§‡¶ø‡¶Æ‡¶ß‡ßç‡¶Ø‡ßá ‡¶ï‡ßã‡¶ü‡¶æ ‡¶∏‡¶Æ‡ßç‡¶™‡ßÇ‡¶∞‡ßç‡¶£ ‡¶∞‡ßü‡ßá‡¶õ‡ßá!");
                          return;
                        }
                        const matchingPool = filteredList.filter(q => {
                          return !getSelectedCategoryForQuestion(q.id) && !selectedList.includes(q.id);
                        });

                        if (matchingPool.length === 0) {
                          alert("‡¶¶‡ßÅ‡¶É‡¶ñ‡¶ø‡¶§, ‡¶¨‡¶∞‡ßç‡¶§‡¶Æ‡¶æ‡¶® ‡¶´‡¶ø‡¶≤‡ßç‡¶ü‡¶æ‡¶∞ ‡¶ï‡¶∞‡¶æ ‡¶§‡¶æ‡¶≤‡¶ø‡¶ï‡¶æ‡ßü ‡¶ï‡ßã‡¶®‡ßã ‡¶Ö‡¶§‡¶ø‡¶∞‡¶ø‡¶ï‡ßç‡¶§ ‡¶Ö‡¶¨‡ßç‡¶Ø‡¶¨‡¶π‡ßÉ‡¶§ ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶®‡ßá‡¶á!");
                          return;
                        }

                        const shuffled = [...matchingPool].sort(() => 0.5 - Math.random());
                        const toAdd = shuffled.slice(0, needed).map(q => q.id);

                        setSelectedQuestionsByCategory({
                          ...selectedQuestionsByCategory,
                          [activeSelectionTab]: [...selectedList, ...toAdd]
                        });
                        alert(`üé≤ ‡¶∏‡¶´‡¶≤‡¶≠‡¶æ‡¶¨‡ßá ${toAdd.length}‡¶ü‡¶ø ‡¶´‡¶ø‡¶≤‡ßç‡¶ü‡¶æ‡¶∞‡ßç‡¶° ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶Ö‡¶ü‡ßã-‡¶´‡¶ø‡¶≤ ‡¶ï‡¶∞‡¶æ ‡¶π‡ßü‡ßá‡¶õ‡ßá!`);
                      };

                      // Select all matching filtered list questions up to limit
                      const selectAllMatching = () => {
                        const needed = limit - selectedList.length;
                        if (needed <= 0) {
                          alert("‡¶á‡¶§‡¶ø‡¶Æ‡¶ß‡ßç‡¶Ø‡ßá ‡¶ï‡ßã‡¶ü‡¶æ ‡¶∏‡¶Æ‡ßç‡¶™‡ßÇ‡¶∞‡ßç‡¶£ ‡¶∞‡ßü‡ßá‡¶õ‡ßá!");
                          return;
                        }
                        const available = filteredList.filter(q => {
                          return !getSelectedCategoryForQuestion(q.id) && !selectedList.includes(q.id);
                        });

                        if (available.length === 0) {
                          alert("‡¶®‡¶ø‡¶∞‡ßç‡¶¨‡¶æ‡¶ö‡¶® ‡¶ï‡¶∞‡¶æ‡¶∞ ‡¶Æ‡¶§‡ßã ‡¶®‡¶§‡ßÅ‡¶® ‡¶ï‡ßã‡¶®‡ßã ‡¶Ö‡¶¨‡ßç‡¶Ø‡¶¨‡¶π‡ßÉ‡¶§ ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶™‡¶æ‡¶ì‡ßü‡¶æ ‡¶Ø‡¶æ‡ßü‡¶®‡¶ø!");
                          return;
                        }

                        const toAdd = available.slice(0, needed).map(q => q.id);
                        setSelectedQuestionsByCategory({
                          ...selectedQuestionsByCategory,
                          [activeSelectionTab]: [...selectedList, ...toAdd]
                        });
                        alert(`‚úì ‡¶∏‡¶´‡¶≤‡¶≠‡¶æ‡¶¨‡ßá ${toAdd.length}‡¶ü‡¶ø ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶è‡¶ï‡¶∏‡¶æ‡¶•‡ßá ‡¶∏‡¶ø‡¶≤‡ßá‡¶ï‡ßç‡¶ü ‡¶ï‡¶∞‡¶æ ‡¶π‡ßü‡ßá‡¶õ‡ßá!`);
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
                          '‡¶®‡¶ø‡¶∞‡ßç‡¶¨‡¶æ‡¶ö‡¶® ‡¶∞‡¶ø‡¶∏‡ßá‡¶ü ‡¶®‡¶ø‡¶∂‡ßç‡¶ö‡¶ø‡¶§‡¶ï‡¶∞‡¶£',
                          "‡¶Ü‡¶™‡¶®‡¶ø ‡¶ï‡¶ø ‡¶®‡¶ø‡¶∂‡ßç‡¶ö‡¶ø‡¶§‡¶≠‡¶æ‡¶¨‡ßá ‡¶∏‡¶¨ ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø‡¶∞ ‡¶∏‡¶ø‡¶≤‡ßá‡¶ï‡ßç‡¶ü‡ßá‡¶° ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶®‡¶∏‡¶Æ‡ßÇ‡¶π ‡¶∞‡¶ø‡¶∏‡ßá‡¶ü ‡¶ï‡¶∞‡¶§‡ßá ‡¶ö‡¶æ‡¶®?",
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
                            showCustomAlert('‡¶∏‡¶Æ‡ßç‡¶™‡¶®‡ßç‡¶® ‡¶π‡ßü‡ßá‡¶õ‡ßá!', '‡¶∏‡¶¨ ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø‡¶∞ ‡¶∏‡¶ø‡¶≤‡ßá‡¶ï‡ßç‡¶ü‡ßá‡¶° ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶®‡¶∏‡¶Æ‡ßÇ‡¶π ‡¶∞‡¶ø‡¶∏‡ßá‡¶ü ‡¶ï‡¶∞‡¶æ ‡¶π‡ßü‡ßá‡¶õ‡ßá!', 'success');
                          },
                          'warning'
                        );
                      };

                      return (
                        <div className="flex flex-col gap-3">
                          <div className="flex justify-between items-center p-2 bg-indigo-50/40 border border-indigo-100/50 rounded-xl">
                            <span className="font-bold text-indigo-900">
                              ‡¶¨‡¶ø‡¶∑‡ßü: <b className="text-indigo-950 font-black">{activeCat?.name}</b>
                            </span>
                            <span className={`font-extrabold text-[10px] px-2.5 py-1 rounded-full ${selectedList.length === limit && limit > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                              {selectedList.length === limit && limit > 0 ? '‚úì ‡¶ï‡ßã‡¶ü‡¶æ ‡¶∏‡¶Æ‡ßç‡¶™‡ßÇ‡¶∞‡ßç‡¶£' : `‚è≥ ‡¶Ü‡¶∞‡¶ì ${limit - selectedList.length}‡¶ü‡¶ø ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶®‡¶ø‡¶∞‡ßç‡¶¨‡¶æ‡¶ö‡¶® ‡¶ï‡¶∞‡ßÅ‡¶®`}
                            </span>
                          </div>

                          {/* Cascading & Advanced Filter Controls */}
                          <div className="bg-white p-3.5 rounded-xl border border-slate-200/60 flex flex-col gap-3">
                            <div className="flex flex-wrap gap-2.5 items-end">
                              <div className="flex flex-col gap-1 min-w-[140px] flex-1 sm:flex-initial">
                                <span className="font-extrabold text-gray-500 text-[10px] uppercase">‡¶ß‡¶æ‡¶™ ‡ßß: ‡¶Æ‡ßÇ‡¶≤ ‡¶ú‡ßã‡¶®</span>
                                <select
                                  value={manualFilterMainCat}
                                  onChange={e => handleMainCatChange(e.target.value)}
                                  className="px-2 py-1.5 border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] font-bold text-gray-700 transition"
                                >
                                  <option value="ALL">‡¶∏‡¶ï‡¶≤ ‡¶â‡ßé‡¶∏ (‡¶∏‡¶¨ ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶®)</option>
                                  <option value="‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø">‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø</option>
                                  <option value="‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶® ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ">‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶® ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ</option>
                                  <option value="‡¶∏‡¶æ‡¶≤ ‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶®">‡¶∏‡¶æ‡¶≤ ‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶ú‡¶¨ ‡¶∏‡¶≤‡¶ø‡¶â‡¶∂‡¶®</option>
                                </select>
                              </div>

                              {(() => {
                                const selectBoxes: React.ReactNode[] = [];
                                const maxDepth = manualSubcatFilterChain.length;

                                for (let i = 0; i <= maxDepth; i++) {
                                  let options: SubcategoryItem[] = [];

                                  if (i === 0) {
                                    if (manualFilterMainCat === 'ALL') {
                                      options = subcategories.filter(s => s.parentCategory === '‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶™‡ßç‡¶∞‡¶∏‡ßç‡¶§‡ßÅ‡¶§‡¶ø' || isJobSolutionVariation(s.parentCategory) || isYearJobSolutionVariation(s.parentCategory));
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
                                        {i === 0 ? '‡¶ß‡¶æ‡¶™ ‡ß®: ‡¶¨‡¶ø‡¶∑‡ßü ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø' : `‡¶ß‡¶æ‡¶™ ${i + 2}: ‡¶∏‡¶æ‡¶¨-‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø`}
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
                                        <option value="ALL">--- ‡¶∏‡¶¨ ---</option>
                                        {options.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                      </select>
                                    </div>
                                  );
                                }

                                return selectBoxes;
                              })()}

                              <div className="flex flex-col gap-1 min-w-[140px] flex-1 sm:flex-initial">
                                <span className="font-extrabold text-gray-500 text-[10px] uppercase">‡¶ñ‡ßÅ‡¶Å‡¶ú‡ßÅ‡¶® (‡¶∏‡¶æ‡¶∞‡ßç‡¶ö ‡¶ï‡¶∞‡ßÅ‡¶®)</span>
                                <input
                                  type="text"
                                  placeholder="‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶¨‡¶æ ‡¶¨‡ßç‡¶Ø‡¶æ‡¶ñ‡ßç‡¶Ø‡¶æ‡¶∞ ‡¶Ö‡¶Ç‡¶∂‡¶¨‡¶ø‡¶∂‡ßá‡¶∑..."
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
                                  <span className="font-bold text-gray-500">‡¶∏‡¶ø‡¶≤‡ßá‡¶ï‡¶∂‡¶® ‡¶´‡¶ø‡¶≤‡ßç‡¶ü‡¶æ‡¶∞:</span>
                                  <div className="inline-flex rounded-md shadow-xs bg-slate-100 p-0.5">
                                    <button
                                      type="button"
                                      onClick={() => setManualFilterSelectionStatus('ALL')}
                                      className={`px-2 py-1 rounded text-[9px] font-extrabold transition-colors ${manualFilterSelectionStatus === 'ALL' ? 'bg-white text-indigo-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
                                    >
                                      ‡¶∏‡¶¨ ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶®
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setManualFilterSelectionStatus('SELECTED')}
                                      className={`px-2 py-1 rounded text-[9px] font-extrabold transition-colors ${manualFilterSelectionStatus === 'SELECTED' ? 'bg-white text-indigo-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
                                    >
                                      ‡¶∂‡ßÅ‡¶ß‡ßÅ ‡¶®‡¶ø‡¶∞‡ßç‡¶¨‡¶æ‡¶ö‡¶ø‡¶§ ({selectedList.length})
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setManualFilterSelectionStatus('UNSELECTED')}
                                      className={`px-2 py-1 rounded text-[9px] font-extrabold transition-colors ${manualFilterSelectionStatus === 'UNSELECTED' ? 'bg-white text-indigo-700 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}
                                    >
                                      ‡¶Ö‡¶®‡¶ø‡¶∞‡ßç‡¶¨‡¶æ‡¶ö‡¶ø‡¶§
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
                                  <span>‚ú® ‡¶∂‡ßÅ‡¶ß‡ßÅ ‡¶∞‡ßá‡¶ï‡¶Æ‡ßá‡¶®‡ßç‡¶°‡ßá‡¶° ‡¶ï‡¶®‡ßç‡¶ü‡ßá‡¶®‡ßç‡¶ü ‡¶¶‡ßá‡¶ñ‡ßÅ‡¶®</span>
                                </label>
                              </div>

                              <div className="font-semibold text-gray-400">
                                ‡¶¨‡¶∞‡ßç‡¶§‡¶Æ‡¶æ‡¶® ‡¶´‡¶ø‡¶≤‡ßç‡¶ü‡¶æ‡¶∞‡ßá ‡¶Æ‡¶ø‡¶≤‡¶õ‡ßá: <b className="text-slate-700 font-extrabold">{filteredList.length}‡¶ü‡¶ø ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶®</b>
                              </div>
                            </div>
                          </div>

                          {/* Quick Actions Panel */}
                          <div className="bg-indigo-50/20 border border-indigo-100/40 p-2.5 rounded-xl flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between text-[10px]">
                            <span className="font-extrabold text-indigo-950/80 flex items-center gap-1">
                              ‚ö° ‡¶ï‡ßÅ‡¶á‡¶ï ‡¶Ö‡¶ü‡ßã-‡¶´‡¶ø‡¶≤ ‡¶ì ‡¶∏‡¶ø‡¶≤‡ßá‡¶ï‡¶∂‡¶® ‡¶ü‡ßÅ‡¶≤‡¶∏:
                            </span>
                            <div className="flex flex-wrap gap-1">
                              <button
                                type="button"
                                onClick={autoFillRecommended}
                                className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white font-extrabold rounded-lg shadow-xs transition"
                                title="‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø‡¶∞ ‡¶∞‡ßá‡¶ï‡¶Æ‡ßá‡¶®‡ßç‡¶°‡ßá‡¶° ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶•‡ßá‡¶ï‡ßá ‡¶∏‡ßç‡¶¨‡ßü‡¶Ç‡¶ï‡ßç‡¶∞‡¶ø‡ßü‡¶≠‡¶æ‡¶¨‡ßá ‡¶∞‡ßç‡¶Ø‡¶æ‡¶®‡ßç‡¶°‡¶Æ ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶∏‡¶ø‡¶≤‡ßá‡¶ï‡ßç‡¶ü ‡¶ï‡¶∞‡ßá ‡¶ï‡ßã‡¶ü‡¶æ ‡¶™‡ßÇ‡¶∞‡¶£ ‡¶ï‡¶∞‡ßÅ‡¶®"
                              >
                                ‚ú® ‡¶∞‡ßá‡¶ï‡¶Æ‡ßá‡¶®‡ßç‡¶°‡ßá‡¶° ‡¶Ö‡¶ü‡ßã-‡¶´‡¶ø‡¶≤
                              </button>
                              <button
                                type="button"
                                onClick={autoFillRandomFiltered}
                                className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-lg shadow-xs transition"
                                title="‡¶¨‡¶∞‡ßç‡¶§‡¶Æ‡¶æ‡¶® ‡¶´‡¶ø‡¶≤‡ßç‡¶ü‡¶æ‡¶∞ ‡¶ï‡¶∞‡¶æ ‡¶§‡¶æ‡¶≤‡¶ø‡¶ï‡¶æ ‡¶•‡ßá‡¶ï‡ßá ‡¶∞‡ßç‡¶Ø‡¶æ‡¶®‡ßç‡¶°‡¶Æ ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶∏‡¶ø‡¶≤‡ßá‡¶ï‡ßç‡¶ü ‡¶ï‡¶∞‡ßá ‡¶ï‡ßã‡¶ü‡¶æ ‡¶™‡ßÇ‡¶∞‡¶£ ‡¶ï‡¶∞‡ßÅ‡¶®"
                              >
                                üé≤ ‡¶∞‡ßç‡¶Ø‡¶æ‡¶®‡ßç‡¶°‡¶Æ ‡¶Ö‡¶ü‡ßã-‡¶´‡¶ø‡¶≤
                              </button>
                              <button
                                type="button"
                                onClick={selectAllMatching}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg shadow-xs transition"
                                title="‡¶¨‡¶∞‡ßç‡¶§‡¶Æ‡¶æ‡¶® ‡¶´‡¶ø‡¶≤‡ßç‡¶ü‡¶æ‡¶∞‡ßá‡¶∞ ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶®‡¶∏‡¶Æ‡ßÇ‡¶π‡¶ï‡ßá ‡¶ï‡ßã‡¶ü‡¶æ ‡¶∏‡ßÄ‡¶Æ‡¶æ ‡¶™‡¶∞‡ßç‡¶Ø‡¶®‡ßç‡¶§ ‡¶è‡¶ï‡¶∏‡¶æ‡¶•‡ßá ‡¶∏‡¶ø‡¶≤‡ßá‡¶ï‡ßç‡¶ü ‡¶ï‡¶∞‡ßÅ‡¶®"
                              >
                                ‚úì ‡¶´‡¶ø‡¶≤‡ßç‡¶ü‡¶æ‡¶∞‡ßç‡¶° ‡¶∏‡¶ø‡¶≤‡ßá‡¶ï‡ßç‡¶ü ‡¶ï‡¶∞‡ßÅ‡¶®
                              </button>
                              <button
                                type="button"
                                onClick={clearTabSelections}
                                className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold rounded-lg border border-rose-200 transition"
                                title="‡¶∂‡ßÅ‡¶ß‡ßÅ‡¶Æ‡¶æ‡¶§‡ßç‡¶∞ ‡¶è‡¶á ‡¶¨‡¶ø‡¶∑‡ßü‡ßá‡¶∞ ‡¶∏‡¶¨ ‡¶∏‡¶ø‡¶≤‡ßá‡¶ï‡¶∂‡¶® ‡¶ï‡ßç‡¶≤‡¶ø‡ßü‡¶æ‡¶∞ ‡¶ï‡¶∞‡ßÅ‡¶®"
                              >
                                üßπ ‡¶è‡¶á ‡¶¨‡¶ø‡¶∑‡ßü ‡¶∞‡¶ø‡¶∏‡ßá‡¶ü
                              </button>
                              <button
                                type="button"
                                onClick={clearAllSelections}
                                className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold rounded-lg border border-gray-200 transition"
                                title="‡ßÆ‡¶ü‡¶ø ‡¶¨‡¶ø‡¶∑‡ßü‡ßá‡¶∞ ‡¶∏‡¶Æ‡ßç‡¶™‡ßÇ‡¶∞‡ßç‡¶£ ‡¶∏‡¶ø‡¶≤‡ßá‡¶ï‡¶∂‡¶® ‡¶ï‡ßç‡¶≤‡¶ø‡ßü‡¶æ‡¶∞ ‡¶ï‡¶∞‡ßÅ‡¶®"
                              >
                                üßπ ‡¶∏‡¶¨ ‡¶∞‡¶ø‡¶∏‡ßá‡¶ü
                              </button>
                            </div>
                          </div>

                          {/* Questions List scroll area */}
                          <div className="border border-slate-100 rounded-xl bg-white max-h-[300px] overflow-y-auto divide-y divide-slate-100">
                            {filteredList.length === 0 ? (
                              <p className="text-center py-8 text-gray-400 font-bold">‡¶ï‡ßã‡¶®‡ßã ‡¶Æ‡¶ø‡¶≤ ‡¶•‡¶æ‡¶ï‡¶æ ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶™‡¶æ‡¶ì‡ßü‡¶æ ‡¶Ø‡¶æ‡ßü‡¶®‡¶ø‡•§ ‡¶´‡¶ø‡¶≤‡ßç‡¶ü‡¶æ‡¶∞ ‡¶™‡¶∞‡¶ø‡¶¨‡¶∞‡ßç‡¶§‡¶® ‡¶ï‡¶∞‡ßá ‡¶ö‡ßá‡¶∑‡ßç‡¶ü‡¶æ ‡¶ï‡¶∞‡ßÅ‡¶®‡•§</p>
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
                                        alert(`‡¶è‡¶á ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶®‡¶ü‡¶ø ‡¶á‡¶§‡¶ø‡¶Æ‡¶ß‡ßç‡¶Ø‡ßá "${belongsToOtherCat}" ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø‡¶§‡ßá ‡¶∏‡¶ø‡¶≤‡ßá‡¶ï‡ßç‡¶ü ‡¶ï‡¶∞‡¶æ ‡¶∞‡ßü‡ßá‡¶õ‡ßá‡•§`);
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
                                        <span className="bg-slate-100 px-1.5 py-0.5 rounded-md">‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø: {q.category}</span>
                                        {q.subcategory && <span className="bg-slate-100 px-1.5 py-0.5 rounded-md">‡¶∏‡¶æ‡¶¨: {q.subcategory}</span>}
                                        {isRecommended && (
                                          <span className="bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-md flex items-center gap-0.5 animate-pulse">
                                            ‚ú® ‡¶∞‡ßá‡¶ï‡¶Æ‡ßá‡¶®‡ßç‡¶°‡ßá‡¶° ‡¶ï‡¶®‡ßç‡¶ü‡ßá‡¶®‡ßç‡¶ü
                                          </span>
                                        )}
                                        {belongsToOtherCat && !isChecked && (
                                          <span className="bg-rose-50 text-rose-600 border border-rose-200 px-1.5 py-0.5 rounded-md font-black">
                                            üîí "{belongsToOtherCat}" ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø‡¶§‡ßá ‡¶¨‡ßç‡¶Ø‡¶¨‡¶π‡ßÉ‡¶§
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
                                    üìã ‡¶®‡¶ø‡¶∞‡ßç‡¶¨‡¶æ‡¶ö‡¶ø‡¶§ ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶®‡¶∏‡¶Æ‡ßÇ‡¶π‡ßá‡¶∞ ‡¶≤‡¶æ‡¶á‡¶≠ ‡¶∞‡¶ø‡¶≠‡¶ø‡¶â ‡¶ì ‡¶™‡¶∞‡¶ø‡¶¨‡¶∞‡ßç‡¶§‡¶® ({totalSelected} / {totalTarget}‡¶ü‡¶ø ‡¶∏‡¶ø‡¶≤‡ßá‡¶ï‡ßç‡¶ü‡ßá‡¶°)
                                  </span>
                                </div>
                                <div className="p-3 max-h-[220px] overflow-y-auto flex flex-col gap-2">
                                  {totalSelected === 0 ? (
                                    <p className="text-center py-4 text-gray-400 font-bold text-[10px]">‡¶è‡¶ñ‡¶®‡ßã ‡¶ï‡ßã‡¶®‡ßã ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶®‡¶ø‡¶∞‡ßç‡¶¨‡¶æ‡¶ö‡¶® ‡¶ï‡¶∞‡¶æ ‡¶π‡ßü‡¶®‡¶ø‡•§ ‡¶â‡¶™‡¶∞‡ßá ‡¶ü‡ßç‡¶Ø‡¶æ‡¶¨ ‡¶®‡¶ø‡¶∞‡ßç‡¶¨‡¶æ‡¶ö‡¶® ‡¶ï‡¶∞‡ßá ‡¶ï‡ßÅ‡¶á‡¶ï ‡¶Ö‡¶ü‡ßã-‡¶´‡¶ø‡¶≤ ‡¶¨‡¶æ ‡¶Æ‡ßç‡¶Ø‡¶æ‡¶®‡ßÅ‡ßü‡¶æ‡¶≤‡¶ø ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶® ‡¶∏‡¶ø‡¶≤‡ßá‡¶ï‡ßç‡¶ü ‡¶ï‡¶∞‡ßÅ‡¶®‡•§</p>
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
                                              ‡¶ï‡ßç‡¶≤‡¶ø‡ßü‡¶æ‡¶∞ ‡¶ï‡¶∞‡ßÅ‡¶®
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
                                                    ‚úï
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
                  üéØ ‡¶®‡¶§‡ßÅ‡¶® ‡¶≤‡¶æ‡¶á‡¶≠ ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ ‡¶∂‡¶ø‡¶°‡¶ø‡¶â‡¶≤ ‡¶ï‡¶∞‡ßÅ‡¶®
                </button>
              </form>
            </div>

            {/* Live Exam Lists */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-sm">
              <h3 className="font-bold text-sm text-gray-800 mb-3 flex items-center gap-2">
                <span>üìã</span> ‡¶∏‡¶ï‡ßç‡¶∞‡¶ø‡ßü ‡¶Ö‡¶´‡¶ø‡¶∂‡¶ø‡ßü‡¶æ‡¶≤ ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ‡¶∏‡¶Æ‡ßÇ‡¶π
              </h3>
              {liveExams.length === 0 ? (
                <p className="text-gray-400 py-4 text-xs text-center border border-dashed border-gray-200 rounded-xl">‡¶ï‡ßã‡¶®‡ßã ‡¶Ö‡¶´‡¶ø‡¶∂‡¶ø‡ßü‡¶æ‡¶≤ ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ ‡¶∂‡¶ø‡¶°‡¶ø‡¶â‡¶≤ ‡¶ï‡¶∞‡¶æ ‡¶®‡ßá‡¶á‡•§</p>
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
                            ‚è±Ô∏è ‡¶Ö‡¶´‡¶ø‡¶∂‡¶ø‡ßü‡¶æ‡¶≤
                          </span>
                        </div>

                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 sm:p-3 space-y-1.5">
                          <p className="text-[10px] sm:text-[10.5px] text-slate-600 font-medium leading-relaxed">
                            üìÖ ‡¶∏‡¶Æ‡ßü‡¶∏‡ßÄ‡¶Æ‡¶æ: <span className="font-bold text-slate-800">{new Date(exam.startTime).toLocaleString('bn-BD')}</span> ‡¶•‡ßá‡¶ï‡ßá <span className="font-bold text-slate-800">{new Date(exam.expiryTime).toLocaleString('bn-BD')}</span>
                          </p>
                          <div className="flex flex-wrap gap-1 sm:gap-1.5 text-[9.5px] sm:text-[10px] text-indigo-700 font-bold pt-0.5">
                            <span className="bg-white border border-slate-200 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md shadow-2xs">
                              ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø: {exam.category === 'ALL' ? '‡¶∏‡¶¨ ‡¶¨‡¶ø‡¶∑‡ßü' : exam.category}
                            </span>
                            <span className="bg-white border border-slate-200 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md shadow-2xs">
                              ‡¶™‡ßç‡¶∞‡¶∂‡ßç‡¶®: {exam.qLimit}‡¶ü‡¶ø
                            </span>
                            <span className="bg-white border border-slate-200 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md shadow-2xs">
                              ‡¶∏‡¶Æ‡ßü: {exam.timeLimit} ‡¶Æ‡¶ø‡¶®‡¶ø‡¶ü
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
                            title="‡¶´‡ßá‡¶∏‡¶¨‡ßÅ‡¶ï‡ßá ‡¶∂‡ßá‡ßü‡¶æ‡¶∞ ‡¶ï‡¶∞‡ßÅ‡¶®"
                          >
                            <span>üìò</span> <span className="whitespace-nowrap">FB ‡¶∂‡ßá‡ßü‡¶æ‡¶∞</span>
                          </button>
                          <button
                            onClick={() => {
                              const shareUrl = `${window.location.origin}${window.location.pathname}?examId=${exam.id}`;
                              navigator.clipboard.writeText(shareUrl);
                              showCustomAlert('‡¶ï‡¶™‡¶ø ‡¶∏‡¶Æ‡ßç‡¶™‡¶®‡ßç‡¶®!', '‡¶≤‡¶æ‡¶á‡¶≠ ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ‡¶∞ ‡¶≤‡¶ø‡¶ô‡ßç‡¶ï ‡¶ï‡ßç‡¶≤‡¶ø‡¶™‡¶¨‡ßã‡¶∞‡ßç‡¶°‡ßá ‡¶ï‡¶™‡¶ø ‡¶ï‡¶∞‡¶æ ‡¶π‡ßü‡ßá‡¶õ‡ßá!\n‡¶è‡¶ñ‡¶® ‡¶≤‡¶ø‡¶ô‡ßç‡¶ï‡¶ü‡¶ø ‡¶Ø‡ßá‡¶ï‡ßã‡¶®‡ßã ‡¶∏‡ßã‡¶∂‡ßç‡¶Ø‡¶æ‡¶≤ ‡¶Æ‡¶ø‡¶°‡¶ø‡ßü‡¶æ‡ßü ‡¶¨‡¶æ ‡¶Æ‡ßá‡¶∏‡ßá‡¶û‡ßç‡¶ú‡¶æ‡¶∞‡ßá ‡¶∂‡ßá‡ßü‡¶æ‡¶∞ ‡¶ï‡¶∞‡¶§‡ßá ‡¶™‡¶æ‡¶∞‡¶¨‡ßá‡¶®‡•§', 'success');
                            }}
                            className="px-1.5 py-1 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold text-[9.5px] sm:text-[10.5px] flex items-center gap-1 transition cursor-pointer whitespace-nowrap shrink-0"
                            title="‡¶≤‡¶ø‡¶ô‡ßç‡¶ï ‡¶ï‡¶™‡¶ø ‡¶ï‡¶∞‡ßÅ‡¶®"
                          >
                            <span>üîó</span> <span className="whitespace-nowrap">‡¶≤‡¶ø‡¶ô‡ßç‡¶ï ‡¶ï‡¶™‡¶ø</span>
                          </button>
                        </div>

                        <div className="shrink-0 flex items-center">
                          <button 
                            onClick={() => {
                              showCustomConfirm(
                                '‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ ‡¶°‡¶ø‡¶≤‡¶ø‡¶ü ‡¶®‡¶ø‡¶∂‡ßç‡¶ö‡¶ø‡¶§‡¶ï‡¶∞‡¶£',
                                '‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ‡¶ü‡¶ø ‡¶°‡¶ø‡¶≤‡¶ø‡¶ü ‡¶ï‡¶∞‡¶§‡ßá ‡¶ö‡¶æ‡¶®? ‡¶è‡¶ü‡¶ø ‡¶°‡¶ø‡¶≤‡¶ø‡¶ü ‡¶ï‡¶∞‡¶≤‡ßá ‡¶è‡¶∞ ‡¶´‡¶≤‡¶æ‡¶´‡¶≤ ‡¶°‡¶æ‡¶ü‡¶æ‡¶ì ‡¶π‡¶æ‡¶∞‡¶ø‡ßü‡ßá ‡¶Ø‡¶æ‡¶¨‡ßá!',
                                async () => {
                                  const ok = await onDeleteLiveExam(exam.id);
                                  if (ok !== false) {
                                    showCustomAlert('‡¶∏‡¶Æ‡ßç‡¶™‡¶®‡ßç‡¶® ‡¶π‡ßü‡ßá‡¶õ‡ßá!', '‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ‡¶ü‡¶ø ‡¶∏‡¶´‡¶≤‡¶≠‡¶æ‡¶¨‡ßá ‡¶°‡¶ø‡¶≤‡¶ø‡¶ü ‡¶ï‡¶∞‡¶æ ‡¶π‡ßü‡ßá‡¶õ‡ßá!', 'success');
                                  } else {
                                    showCustomAlert('‡¶§‡ßç‡¶∞‡ßÅ‡¶ü‡¶ø!', '‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ ‡¶°‡¶ø‡¶≤‡¶ø‡¶ü ‡¶ï‡¶∞‡¶§‡ßá ‡¶¨‡ßç‡¶Ø‡¶∞‡ßç‡¶• ‡¶π‡ßü‡ßá‡¶õ‡ßá!', 'error');
                                  }
                                },
                                'warning'
                              );
                            }}
                            className="px-2 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold text-[9.5px] sm:text-xs flex items-center gap-1 transition cursor-pointer whitespace-nowrap shrink-0"
                          >
                            <span>üóëÔ∏è</span> <span className="whitespace-nowrap">‡¶Æ‡ßÅ‡¶õ‡ßÅ‡¶®</span>
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
        <div className="space-y-5 text-xs">
          {/* Sub-tab Navigation */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 sm:p-3 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => setCourseSubTab('courses')}
                className={`px-3 sm:px-4 py-2 rounded-xl font-extrabold text-xs transition flex items-center gap-1.5 ${
                  courseSubTab === 'courses'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <GraduationCap className="w-4 h-4" />
                <span>üéì ‡¶ï‡ßã‡¶∞‡ßç‡¶∏‡¶∏‡¶Æ‡ßÇ‡¶π ({courses.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setCourseSubTab('coupons')}
                className={`px-3 sm:px-4 py-2 rounded-xl font-extrabold text-xs transition flex items-center gap-1.5 ${
                  courseSubTab === 'coupons'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Tag className="w-4 h-4 text-emerald-500" />
                <span>üè∑Ô∏è ‡¶°‡¶ø‡¶∏‡¶ï‡¶æ‡¶â‡¶®‡ßç‡¶ü ‡¶ï‡ßÅ‡¶™‡¶® ({coupons.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setCourseSubTab('enrollments')}
                className={`px-3 sm:px-4 py-2 rounded-xl font-extrabold text-xs transition flex items-center gap-1.5 ${
                  courseSubTab === 'enrollments'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Users className="w-4 h-4 text-purple-500" />
                <span>üë• ‡¶è‡¶®‡¶∞‡ßã‡¶≤‡¶Æ‡ßá‡¶®‡ßç‡¶ü ‡¶∞‡ßá‡¶ï‡¶∞‡ßç‡¶° ({courseEnrollments.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setCourseSubTab('payment-settings')}
                className={`px-3 sm:px-4 py-2 rounded-xl font-extrabold text-xs transition flex items-center gap-1.5 ${
                  courseSubTab === 'payment-settings'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Wallet className="w-4 h-4 text-amber-500" />
                <span>üí≥ ‡¶™‡ßá‡¶Æ‡ßá‡¶®‡ßç‡¶ü ‡¶®‡¶Æ‡ßç‡¶¨‡¶∞ ‡¶∏‡ßá‡¶ü‡¶ø‡¶Ç‡¶∏</span>
              </button>
            </div>

            {editingCourseId && (
              <button
                type="button"
                onClick={handleCancelEditCourse}
                className="text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-xl font-bold border border-amber-200 text-[11px] flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>‡¶è‡¶°‡¶ø‡¶ü ‡¶Æ‡ßã‡¶° ‡¶¨‡¶æ‡¶§‡¶ø‡¶≤</span>
              </button>
            )}
          </div>

          {/* SUB-VIEW 1: COURSES & PRICING */}
          {courseSubTab === 'courses' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Create/Edit Course Form */}
              <div className="md:col-span-5 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-4">
                <div className="flex justify-between items-center border-b border-gray-100 pb-2.5">
                  <h3 className="font-bold text-sm text-gray-800 flex items-center gap-1.5">
                    <GraduationCap className="w-4 h-4 text-indigo-600" />
                    <span>{editingCourseId ? '‚úèÔ∏è ‡¶ï‡ßã‡¶∞‡ßç‡¶∏ ‡¶∏‡¶Æ‡ßç‡¶™‡¶æ‡¶¶‡¶®‡¶æ ‡¶ï‡¶∞‡ßÅ‡¶®' : 'üéì ‡¶®‡¶§‡ßÅ‡¶® ‡¶ï‡ßã‡¶∞‡ßç‡¶∏ ‡¶§‡ßà‡¶∞‡¶ø ‡¶ì ‡¶´‡¶ø ‡¶®‡¶ø‡¶∞‡ßç‡¶ß‡¶æ‡¶∞‡¶£'}</span>
                  </h3>
                  {editingCourseId && (
                    <span className="text-[10px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md font-extrabold">
                      ‡¶∏‡¶Æ‡ßç‡¶™‡¶æ‡¶¶‡¶®‡¶æ ‡¶Æ‡ßã‡¶°
                    </span>
                  )}
                </div>

                <form onSubmit={handleCreateOrUpdateCourseSubmit} className="space-y-3">
                  <div>
                    <label className="block text-gray-600 mb-1 font-medium">‡¶ï‡ßã‡¶∞‡ßç‡¶∏‡ßá‡¶∞ ‡¶®‡¶æ‡¶Æ / ‡¶∂‡¶ø‡¶∞‡ßã‡¶®‡¶æ‡¶Æ:</label>
                    <input 
                      type="text" 
                      required
                      value={courseTitle}
                      onChange={e => setCourseTitle(e.target.value)}
                      placeholder="‡¶Ø‡ßá‡¶Æ‡¶®: ‡ß™‡ß¨‡¶§‡¶Æ ‡¶¨‡¶ø‡¶∏‡¶ø‡¶è‡¶∏ ‡¶™‡ßç‡¶∞‡¶ø‡¶≤‡¶ø‡¶Æ‡¶ø‡¶®‡¶æ‡¶∞‡¶ø ‡¶∏‡ßç‡¶™‡ßá‡¶∂‡¶æ‡¶≤ ‡¶ï‡ßç‡¶∞‡ßç‡¶Ø‡¶æ‡¶∂ ‡¶ï‡ßã‡¶∞‡ßç‡¶∏" 
                      className="w-full px-3 py-2 border rounded-xl text-gray-800 focus:outline-none" 
                    />
                  </div>

                  <div>
                    <label className="block text-gray-600 mb-1 font-medium">‡¶ï‡ßã‡¶∞‡ßç‡¶∏‡ßá‡¶∞ ‡¶¨‡¶ø‡¶¨‡¶∞‡¶£ / ‡¶¨‡¶ø‡¶∏‡ßç‡¶§‡¶æ‡¶∞‡¶ø‡¶§:</label>
                    <textarea 
                      rows={3}
                      required
                      value={courseDesc}
                      onChange={e => setCourseDesc(e.target.value)}
                      placeholder="‡¶Ø‡ßá‡¶Æ‡¶®: ‡¶∏‡¶Æ‡ßç‡¶™‡ßÇ‡¶∞‡ßç‡¶£ ‡¶∏‡¶ø‡¶≤‡ßá‡¶¨‡¶æ‡¶∏ ‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶¨‡¶ø‡¶∑‡ßü‡¶≠‡¶ø‡¶§‡ßç‡¶§‡¶ø‡¶ï ‡¶≤‡¶æ‡¶á‡¶≠ ‡¶™‡¶∞‡ßÄ‡¶ï‡ßç‡¶∑‡¶æ, ‡¶∞‡¶ø‡¶°‡¶æ‡¶∞ ‡¶Æ‡ßã‡¶° ‡¶Ö‡¶®‡ßÅ‡¶∂‡ßÄ‡¶≤‡¶® ‡¶ì ‡¶è‡¶ï‡ßç‡¶∏‡¶ï‡ßç‡¶≤‡ßÅ‡¶∏‡¶ø‡¶≠ ‡¶∏‡ßç‡¶ü‡¶æ‡¶°‡¶ø ‡¶™‡ßç‡¶≤‡ßç‡¶Ø‡¶æ‡¶®‡•§"
                      className="w-full px-3 py-2 border rounded-xl text-gray-800 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-600 mb-1 font-medium">‡¶∏‡¶Æ‡ßç‡¶™‡¶∞‡ßç‡¶ï‡¶ø‡¶§ ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø (‡¶ê‡¶ö‡ßç‡¶õ‡¶ø‡¶ï):</label>
                    <select
                      value={courseCategory}
                      onChange={e => setCourseCategory(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl text-gray-800 focus:outline-none bg-white"
                    >
                      <option value="">‡¶∏‡¶ï‡¶≤ ‡¶ï‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶ó‡¶∞‡¶ø / ‡¶∏‡¶æ‡¶ß‡¶æ‡¶∞‡¶£</option>
                      {(categories || []).map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Pricing Inputs */}
                  <div className="grid grid-cols-2 gap-2 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
                    <div>
                      <label className="block text-indigo-950 mb-1 font-bold flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5 text-indigo-600" />
                        <span>‡¶ï‡ßã‡¶∞‡ßç‡¶∏ ‡¶Æ‡ßÇ‡¶≤‡ßç‡¶Ø (‡ß≥):</span>
                      </label>
                      <input 
                        type="number"
                        min="0"
                        value={coursePrice}
                        onChange={e => setCoursePrice(e.target.value)}
                        placeholder="0 = ‡¶´‡ßç‡¶∞‡¶ø"
                        className="w-full px-3 py-2 border rounded-xl text-indigo-950 font-black bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <span className="text-[10px] text-gray-500 mt-0.5 block">‡ß¶ ‡¶≤‡¶ø‡¶ñ‡¶≤‡ßá ‡¶´‡ßç‡¶∞‡¶ø ‡¶π‡¶ø‡¶∏‡ßá‡¶¨‡ßá ‡¶ó‡¶£‡ßç‡¶Ø ‡¶π‡¶¨‡ßá</span>
                    </div>

                    <div>
                      <label className="block text-gray-700 mb-1 font-bold">‡¶™‡ßÇ‡¶∞‡ßç‡¶¨‡ßá‡¶∞ ‡¶Æ‡ßÇ‡¶≤‡ßç‡¶Ø (‡ß≥ - ‡¶ê‡¶ö‡ßç‡¶õ‡¶ø‡¶ï):</label>
                      <input 
                        type="number"
                        min="0"
                        value={courseOriginalPrice}
                        onChange={e => setCourseOriginalPrice(e.target.value)}
                        placeholder="‡¶Ø‡ßá‡¶Æ‡¶®: 1000"
                        className="w-full px-3 py-2 border rounded-xl text-gray-700 font-bold bg-white focus:outline-none"
                      />
                      <span className="text-[10px] text-gray-500 mt-0.5 block">‡¶ï‡¶æ‡¶ü‡¶æ ‡¶¶‡¶æ‡¶ó‡ßá‡¶∞ ‡¶∏‡¶æ‡¶•‡ßá ‡¶°‡¶ø‡¶∏‡¶™‡ßç‡¶≤‡ßá ‡¶π‡¶¨‡ßá</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-gray-600 mb-1 font-medium">‡¶∏‡ßç‡¶ü‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶∏:</label>
                      <select
                        value={courseStatus}
                        onChange={e => setCourseStatus(e.target.value as any)}
                        className="w-full px-3 py-2 border rounded-xl text-gray-800 focus:outline-none bg-white font-bold"
                      >
                        <option value="active">üü¢ ‡¶ö‡¶≤‡¶Æ‡¶æ‡¶® (Active)</option>
                        <option value="upcoming">üü° ‡¶Ü‡¶∏‡¶®‡ßç‡¶® (Upcoming)</option>
                        <option value="completed">‚ö™ ‡¶∏‡¶Æ‡ßç‡¶™‡¶®‡ßç‡¶® (Completed)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-gray-600 mb-1 font-medium">‡¶∂‡ßÅ‡¶∞‡ßÅ‡¶∞ ‡¶§‡¶æ‡¶∞‡¶ø‡¶ñ:</label>
                      <input 
                        type="date"
                        value={courseStartDate}
                        onChange={e => setCourseStartDate(e.target.value)}
                        className="w-full px-3 py-2 border rounded-xl text-gray-800 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-600 mb-1 font-medium">‡¶∂‡ßá‡¶∑‡ßá‡¶∞ ‡¶§‡¶æ‡¶∞‡¶ø‡¶ñ (‡¶ê‡¶ö‡ßç‡¶õ‡¶ø‡¶ï):</label>
                    <input 
                      type="date"
                      value={courseEndDate}
                      onChange={e => setCourseEndDate(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl text-gray-800 focus:outline-none"
                    />
                  </div>

                  <div className="flex gap-2 pt-1">
                    {editingCourseId && (
                      <button 
                        type="button"
                        onClick={handleCancelEditCourse}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded-xl transition"
                      >
                        ‡¶¨‡¶æ‡¶§‡¶ø‡¶≤
                      </button>
                    )}
                    <button 
                      type="submit"
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl transition shadow flex items-center justify-center gap-2"
                    >
                      {editingCourseId ? '‡¶Ü‡¶™‡¶°‡ßá‡¶ü ‡¶∏‡¶Ç‡¶∞‡¶ï‡ßç‡¶∑‡¶£ ‡¶ï‡¶∞‡ßÅ‡¶® ‚úèÔ∏è' : '‡¶ï‡ßã‡¶∞‡ßç‡¶∏ ‡¶∏‡ßá‡¶≠ ‡¶ì ‡¶™‡ßç‡¶∞‡¶ï‡¶æ‡¶∂ ‡¶ï‡¶∞‡ßÅ‡¶® üéì'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Published Courses List */}
              <div className="md:col-span-7 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                <h3 className="font-bold text-sm text-gray-800 mb-3">üìã ‡¶§‡ßà‡¶∞‡¶ø ‡¶ï‡¶∞‡¶æ ‡¶ï‡ßã‡¶∞‡ßç‡¶∏‡¶∏‡¶Æ‡ßÇ‡¶π ({courses.length})</h3>
                <div className="space-y-3.5">
                  {(!courses || courses.length === 0) ? (
                    <p className="text-gray-400 py-6 text-center">‡¶ï‡ßã‡¶®‡ßã ‡¶ï‡ßã‡¶∞‡ßç‡¶∏ ‡¶™‡¶æ‡¶ì‡ßü‡¶æ ‡¶Ø‡¶æ‡ßü‡¶®‡¶ø‡•§ ‡¶®‡¶§‡ßÅ‡¶® ‡¶ï‡ßã‡¶∞‡ßç‡¶∏ ‡¶§‡ßà‡¶∞‡¶ø ‡¶ï‡¶∞‡ßÅ‡¶®‡•§</p>
                  ) : (
                    (courses || []).map((course, idx) => {
                      const courseRoutines = routines.filter(r => r.courseId === course.id || r.courseName === course.title);
                      const courseEnrollmentsList = courseEnrollments.filter(e => e.courseId === course.id);
                      const coursePriceVal = course.price ?? 0;
                      const courseOrigVal = course.originalPrice;

                      return (
                        <div key={course.id || idx} className="p-4 bg-gray-50 border border-gray-200/80 rounded-2xl flex flex-col gap-2.5">
                          <div className="flex justify-between items-start gap-2 border-b border-gray-200/60 pb-2">
                            <div>
                              <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                                  course.status === 'active' ? 'bg-emerald-100 text-emerald-800' :
                                  course.status === 'upcoming' ? 'bg-amber-100 text-amber-800' : 'bg-gray-200 text-gray-700'
                                }`}>
                                  {course.status === 'active' ? '‚óè ‡¶ö‡¶≤‡¶Æ‡¶æ‡¶® ‡¶ï‡ßã‡¶∞‡ßç‡¶∏' : course.status === 'upcoming' ? '‚ñ≤ ‡¶Ü‡¶∏‡¶®‡ßç‡¶® ‡¶ï‡ßã‡¶∞‡ßç‡¶∏' : '‚úì ‡¶∏‡¶Æ‡ßç‡¶™‡¶®‡ßç‡¶® ‡¶ï‡ßã‡¶∞‡ßç‡¶∏'}
                                </span>

                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-black ${
                                  coursePriceVal === 0 
                                    ? 'bg-emerald-600 text-white' 
                                    : 'bg-indigo-900 text-white'
                                }`}>
                                  {coursePriceVal === 0 ? '‡¶´‡ßç‡¶∞‡¶ø (Free)' : `‡ß≥${coursePriceVal}`}
                                  {courseOrigVal && courseOrigVal > coursePriceVal && (
                                    <span className="line-through text-indigo-300 text-[9.5px] font-normal">‡ß≥{courseOrigVal}</span>
                                  )}
                                </span>
                              </div>
                              <h4 className="font-extrabold text-indigo-950 text-sm">{course.title}</h4>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => handleStartEditCourse(course)}
                                className="text-indigo-600 hover:text-indigo-800 font-bold text-xs bg-white px-2.5 py-1 rounded-lg border border-indigo-200"
                              >
                                ‡¶è‡¶°‡¶ø‡¶ü ‚úèÔ∏è
                              </button>
                              <button
                                onClick={() => {
                                  showCustomConfirm(
                                    '‡¶ï‡ßã‡¶∞‡ßç‡¶∏ ‡¶°‡¶ø‡¶≤‡¶ø‡¶ü ‡¶®‡¶ø‡¶∂‡ßç‡¶ö‡¶ø‡¶§‡¶ï‡¶∞‡¶£',
                                    `"${course.title}" ‡¶ï‡ßã‡¶∞‡ßç‡¶∏‡¶ü‡¶ø ‡¶°‡¶ø‡¶≤‡¶ø‡¶ü ‡¶ï‡¶∞‡¶§‡ßá ‡¶ö‡¶æ‡¶®?`,
                                    async () => {
                                      if (onDeleteCourse) {
                                        const ok = await onDeleteCourse(course.id);
                                        if (ok !== false) {
                                          showCustomAlert('‡¶∏‡¶Æ‡ßç‡¶™‡¶®‡ßç‡¶® ‡¶π‡ßü‡ßá‡¶õ‡ßá!', '‡¶ï‡ßã‡¶∞‡ßç‡¶∏‡¶ü‡¶ø ‡¶∏‡¶´‡¶≤‡¶≠‡¶æ‡¶¨‡ßá ‡¶Æ‡ßÅ‡¶õ‡ßá ‡¶´‡ßá‡¶≤‡¶æ ‡¶π‡ßü‡ßá‡¶õ‡ßá!', 'success');
                                        } else {
                                          showCustomAlert('‡¶§‡ßç‡¶∞‡ßÅ‡¶ü‡¶ø!', '‡¶ï‡ßã‡¶∞‡ßç‡¶∏ ‡¶°‡¶ø‡¶≤‡¶ø‡¶ü ‡¶ï‡¶∞‡¶§‡ßá ‡¶¨‡ßç‡¶Ø‡¶∞‡ßç‡¶• ‡¶π‡ßü‡ßá‡¶õ‡ßá!', 'error');
                                        }
                                      }
                                    },
                                    'warning'
                                  );
                                }}
                                className="text-rose-600 hover:text-rose-800 font-bold text-xs bg-white px-2.5 py-1 rounded-lg border border-rose-200"
                              >
                                ‡¶Æ‡ßÅ‡¶õ‡ßÅ‡¶® üóëÔ∏è
                              </button>
                            </div>
                          </div>

                          <p className="text-gray-600 text-xs leading-relaxed">{course.description}</p>
                          
                          <div className="flex flex-wrap gap-1.5 text-[10px] font-semibold text-gray-500 pt-1">
                            {course.category && <span className="bg-white border px-2 py-0.5 rounded-lg text-indigo-700 font-bold">üè∑Ô∏è {course.category}</span>}
                            {course.startDate && <span className="bg-white border px-2 py-0.5 rounded-lg">üìÖ ‡¶∂‡ßÅ‡¶∞‡ßÅ: {course.startDate}</span>}
                            {course.endDate && <span className="bg-white border px-2 py-0.5 rounded-lg">üèÅ ‡¶∂‡ßá‡¶∑: {course.endDate}</span>}
                            <span className="bg-white border px-2 py-0.5 rounded-lg text-emerald-700 font-bold">üìÖ ‡¶∏‡¶Ç‡¶Ø‡ßÅ‡¶ï‡ßç‡¶§ ‡¶∞‡ßÅ‡¶ü‡¶ø‡¶®: {courseRoutines.length} ‡¶ü‡¶ø</span>
                            <span className="bg-purple-50 text-purple-800 border border-purple-200 px-2 py-0.5 rounded-lg font-bold">üë• ‡¶è‡¶®‡¶∞‡ßã‡¶≤‡ßç‡¶° ‡¶∂‡¶ø‡¶ï‡ßç‡¶∑‡¶æ‡¶∞‡ßç‡¶•‡ßÄ: {courseEnrollmentsList.length} ‡¶ú‡¶®</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SUB-VIEW 2: DISCOUNT COUPONS MANAGEMENT */}
          {courseSubTab === 'coupons' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Create Coupon Form */}
              <div className="md:col-span-5 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-4">
                <div className="border-b border-gray-100 pb-2.5">
                  <h3 className="font-bold text-sm text-gray-800 flex items-center gap-1.5">
                    <Tag className="w-4 h-4 text-emerald-600" />
                    <span>üè∑Ô∏è ‡¶®‡¶§‡ßÅ‡¶® ‡¶°‡¶ø‡¶∏‡¶ï‡¶æ‡¶â‡¶®‡ßç‡¶ü ‡¶ï‡ßÅ‡¶™‡¶® ‡¶§‡ßà‡¶∞‡¶ø ‡¶ï‡¶∞‡ßÅ‡¶®</span>
                  </h3>
                  <p className="text-gray-500 text-[11px] mt-0.5">‡¶ï‡ßÅ‡¶™‡¶® ‡¶ï‡ßã‡¶° ‡¶¨‡ßç‡¶Ø‡¶¨‡¶π‡¶æ‡¶∞ ‡¶ï‡¶∞‡ßá ‡¶∂‡¶ø‡¶ï‡ßç‡¶∑‡¶æ‡¶∞‡ßç‡¶•‡ßÄ‡¶∞‡¶æ ‡ßß-‡ßß‡ß¶‡ß¶% ‡¶°‡¶ø‡¶∏‡¶ï‡¶æ‡¶â‡¶®‡ßç‡¶ü ‡¶™‡¶æ‡¶¨‡ßá‡•§</p>
                </div>

                <form onSubmit={handleCreateCouponSubmit} className="space-y-3.5">
                  <div>
                    <label className="block text-gray-700 mb-1 font-bold">‡¶ï‡ßÅ‡¶™‡¶® ‡¶ï‡ßã‡¶° (Coupon Code):</label>
                    <input 
                      type="text" 
                      required
                      value={couponCode}
                      onChange={e => setCouponCode(e.target.value.toUpperCase())}
                      placeholder="‡¶Ø‡ßá‡¶Æ‡¶®: WELCOME50, FREE100, SAVE30" 
                      className="w-full px-3 py-2 border rounded-xl text-gray-900 uppercase font-black tracking-wider focus:outline-none focus:ring-2 focus:ring-emerald-500" 
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-gray-700 font-bold flex items-center gap-1">
                        <Percent className="w-3.5 h-3.5 text-emerald-600" />
                        <span>‡¶°‡¶ø‡¶∏‡¶ï‡¶æ‡¶â‡¶®‡ßç‡¶ü ‡¶∂‡¶§‡¶ï‡¶∞‡¶æ ‡¶π‡¶æ‡¶∞ (%):</span>
                      </label>
                      <span className="text-emerald-700 font-black text-sm bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                        {couponDiscount}% ‡¶õ‡¶æ‡ßú {couponDiscount === 100 ? '(‡ßß‡ß¶‡ß¶% ‡¶´‡ßç‡¶∞‡¶ø)' : ''}
                      </span>
                    </div>

                    <input 
                      type="range"
                      min="1"
                      max="100"
                      value={couponDiscount}
                      onChange={e => setCouponDiscount(Number(e.target.value))}
                      className="w-full accent-emerald-600 cursor-pointer h-2 bg-gray-200 rounded-lg"
                    />

                    {/* Quick Percentage Presets */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {[10, 20, 30, 50, 75, 100].map(p => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setCouponDiscount(p)}
                          className={`px-2 py-0.5 rounded-md font-bold text-[10.5px] border transition ${
                            couponDiscount === p
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          {p === 100 ? '‡ßß‡ß¶‡ß¶% ‡¶´‡ßç‡¶∞‡¶ø' : `${p}%`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-700 mb-1 font-bold">‡¶™‡ßç‡¶∞‡¶Ø‡ßã‡¶ú‡ßç‡¶Ø ‡¶ï‡ßã‡¶∞‡ßç‡¶∏:</label>
                    <select
                      value={couponCourseId}
                      onChange={e => setCouponCourseId(e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl text-gray-800 focus:outline-none bg-white font-bold"
                    >
                      <option value="">üåê ‡¶∏‡¶ï‡¶≤ ‡¶ï‡ßã‡¶∞‡ßç‡¶∏ (All Courses)</option>
                      {(courses || []).map(c => (
                        <option key={c.id} value={c.id}>üéì {c.title}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-gray-700 mb-1 font-medium">‡¶ï‡ßÅ‡¶™‡¶®‡ßá‡¶∞ ‡¶¨‡¶ø‡¶¨‡¶∞‡¶£ / ‡¶Ö‡¶´‡¶æ‡¶∞ ‡¶Æ‡ßá‡¶∏‡ßá‡¶ú (‡¶ê‡¶ö‡ßç‡¶õ‡¶ø‡¶ï):</label>
                    <input 
                      type="text" 
                      value={couponDescription}
                      onChange={e => setCouponDescription(e.target.value)}
                      placeholder="‡¶Ø‡ßá‡¶Æ‡¶®: ‡¶®‡¶§‡ßÅ‡¶® ‡¶∂‡¶ø‡¶ï‡ßç‡¶∑‡¶æ‡¶∞‡ßç‡¶•‡ßÄ‡¶¶‡ßá‡¶∞ ‡¶ú‡¶®‡ßç‡¶Ø ‡ß´‡ß¶% ‡¶∏‡ßç‡¶™‡ßá‡¶∂‡¶æ‡¶≤ ‡¶à‡¶¶ ‡¶Ö‡¶´‡¶æ‡¶∞" 
                      className="w-full px-3 py-2 border rounded-xl text-gray-800 focus:outline-none" 
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-gray-700 mb-1 font-medium">‡¶Æ‡ßá‡ßü‡¶æ‡¶¶ ‡¶∂‡ßá‡¶∑ (‡¶ê‡¶ö‡ßç‡¶õ‡¶ø‡¶ï):</label>
                      <input 
                        type="date"
                        value={couponExpiryDate}
                        onChange={e => setCouponExpiryDate(e.target.value)}
                        className="w-full px-3 py-2 border rounded-xl text-gray-800 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-gray-700 mb-1 font-medium">‡¶∏‡ßç‡¶ü‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶∏:</label>
                      <select
                        value={couponIsActive ? 'active' : 'inactive'}
                        onChange={e => setCouponIsActive(e.target.value === 'active')}
                        className="w-full px-3 py-2 border rounded-xl text-gray-800 focus:outline-none bg-white font-bold"
                      >
                        <option value="active">üü¢ ‡¶∏‡¶ï‡ßç‡¶∞‡¶ø‡ßü (Active)</option>
                        <option value="inactive">üî¥ ‡¶®‡¶ø‡¶∑‡ßç‡¶ï‡ßç‡¶∞‡¶ø‡ßü (Inactive)</option>
                      </select>
                    </div>
                  </div>

                  <button 
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl transition shadow flex items-center justify-center gap-2 text-xs"
                  >
                    <span>‡¶ï‡ßÅ‡¶™‡¶® ‡¶§‡ßà‡¶∞‡¶ø ‡¶ì ‡¶∏‡¶ï‡ßç‡¶∞‡¶ø‡ßü ‡¶ï‡¶∞‡ßÅ‡¶®</span>
                    <Sparkles className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>

              {/* Coupons List */}
              <div className="md:col-span-7 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold text-sm text-gray-800">üè∑Ô∏è ‡¶§‡ßà‡¶∞‡¶ø ‡¶ï‡¶∞‡¶æ ‡¶ï‡ßÅ‡¶™‡¶®‡¶∏‡¶Æ‡ßÇ‡¶π ({coupons.length})</h3>
                  <span className="text-[11px] font-bold text-gray-500">
                    ‡¶∏‡¶ï‡ßç‡¶∞‡¶ø‡ßü: {coupons.filter(c => c.isActive).length} ‡¶ü‡¶ø
                  </span>
                </div>

                <div className="space-y-3">
                  {(!coupons || coupons.length === 0) ? (
                    <p className="text-gray-400 py-6 text-center">‡¶ï‡ßã‡¶®‡ßã ‡¶ï‡ßÅ‡¶™‡¶® ‡¶§‡ßà‡¶∞‡¶ø ‡¶ï‡¶∞‡¶æ ‡¶π‡ßü‡¶®‡¶ø‡•§ ‡¶®‡¶§‡ßÅ‡¶® ‡¶ï‡ßÅ‡¶™‡¶® ‡¶§‡ßà‡¶∞‡¶ø ‡¶ï‡¶∞‡ßÅ‡¶®‡•§</p>
                  ) : (
                    (coupons || []).map((coupon, idx) => {
                      const isExpired = coupon.expiryDate && coupon.expiryDate < new Date().toISOString().split('T')[0];

                      return (
                        <div 
                          key={coupon.id || idx}
                          className={`p-3.5 rounded-2xl border transition flex flex-col gap-2 ${
                            coupon.isActive && !isExpired
                              ? 'bg-emerald-50/40 border-emerald-200/80'
                              : 'bg-gray-50 border-gray-200 opacity-80'
                          }`}
                        >
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black text-emerald-950 font-mono tracking-wider bg-white px-2.5 py-1 rounded-xl border border-emerald-300 shadow-2xs">
                                {coupon.code}
                              </span>

                              <span className="bg-emerald-600 text-white font-black text-[11px] px-2.5 py-0.5 rounded-lg shadow-2xs">
                                {coupon.discountPercent}% ‡¶õ‡¶æ‡ßú
                              </span>

                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                coupon.isActive && !isExpired
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}>
                                {isExpired ? '‡¶Æ‡ßá‡ßü‡¶æ‡¶¶‡ßã‡¶§‡ßç‡¶§‡ßÄ‡¶∞‡ßç‡¶£' : coupon.isActive ? '‡¶∏‡¶ï‡ßç‡¶∞‡¶ø‡ßü' : '‡¶®‡¶ø‡¶∑‡ßç‡¶ï‡ßç‡¶∞‡¶ø‡ßü'}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {onUpdateCoupon && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onUpdateCoupon(coupon.id, { isActive: !coupon.isActive });
                                    showCustomAlert('‡¶Ü‡¶™‡¶°‡ßá‡¶ü ‡¶π‡ßü‡ßá‡¶õ‡ßá!', `"${coupon.code}" ‡¶ï‡ßÅ‡¶™‡¶®‡¶ü‡¶ø ${!coupon.isActive ? '‡¶∏‡¶ï‡ßç‡¶∞‡¶ø‡ßü' : '‡¶®‡¶ø‡¶∑‡ßç‡¶ï‡ßç‡¶∞‡¶ø‡ßü'} ‡¶ï‡¶∞‡¶æ ‡¶π‡ßü‡ßá‡¶õ‡ßá‡•§`, 'info');
                                  }}
                                  className="text-[11px] font-bold px-2.5 py-1 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700"
                                >
                                  {coupon.isActive ? '‡¶®‡¶ø‡¶∑‡ßç‡¶ï‡ßç‡¶∞‡¶ø‡ßü ‡¶ï‡¶∞‡ßÅ‡¶®' : '‡¶∏‡¶ï‡ßç‡¶∞‡¶ø‡ßü ‡¶ï‡¶∞‡ßÅ‡¶®'}
                                </button>
                              )}

                              {onDeleteCoupon && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    showCustomConfirm(
                                      '‡¶ï‡ßÅ‡¶™‡¶® ‡¶°‡¶ø‡¶≤‡¶ø‡¶ü ‡¶®‡¶ø‡¶∂‡ßç‡¶ö‡¶ø‡¶§‡¶ï‡¶∞‡¶£',
                                      `"${coupon.code}" ‡¶ï‡ßÅ‡¶™‡¶®‡¶ü‡¶ø ‡¶Æ‡ßÅ‡¶õ‡ßá ‡¶´‡ßá‡¶≤‡¶§‡ßá ‡¶ö‡¶æ‡¶®?`,
                                      async () => {
                                        if (onDeleteCoupon) {
                                          const ok = await onDeleteCoupon(coupon.id);
                                          if (ok !== false) {
                                            showCustomAlert('‡¶∏‡¶Æ‡ßç‡¶™‡¶®‡ßç‡¶® ‡¶π‡ßü‡ßá‡¶õ‡ßá!', '‡¶ï‡ßÅ‡¶™‡¶®‡¶ü‡¶ø ‡¶∏‡¶´‡¶≤‡¶≠‡¶æ‡¶¨‡ßá ‡¶Æ‡ßÅ‡¶õ‡ßá ‡¶´‡ßá‡¶≤‡¶æ ‡¶π‡ßü‡ßá‡¶õ‡ßá!', 'success');
                                          } else {
                                            showCustomAlert('‡¶§‡ßç‡¶∞‡ßÅ‡¶ü‡¶ø!', '‡¶ï‡ßÅ‡¶™‡¶® ‡¶Æ‡ßÅ‡¶õ‡ßá ‡¶´‡ßá‡¶≤‡¶§‡ßá ‡¶¨‡ßç‡¶Ø‡¶∞‡ßç‡¶• ‡¶π‡ßü‡ßá‡¶õ‡ßá!', 'error');
                                          }
                                        }
                                      },
                                      'warning'
                                    );
                                  }}
                                  className="text-rose-600 hover:text-rose-800 p-1 rounded-lg hover:bg-rose-50"
                                  title="‡¶Æ‡ßÅ‡¶õ‡ßÅ‡¶®"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          {coupon.description && (
                            <p className="text-gray-600 text-xs font-medium">{coupon.description}</p>
                          )}

                          <div className="flex flex-wrap items-center gap-2 text-[10.5px] font-semibold text-gray-500 pt-0.5">
                            <span className="bg-white border px-2 py-0.5 rounded-lg text-indigo-700 font-bold">
                              üéØ {coupon.courseTitle ? `‡¶ï‡ßã‡¶∞‡ßç‡¶∏: ${coupon.courseTitle}` : 'üåê ‡¶∏‡¶ï‡¶≤ ‡¶ï‡ßã‡¶∞‡ßç‡¶∏‡ßá‡¶∞ ‡¶ú‡¶®‡ßç‡¶Ø ‡¶™‡ßç‡¶∞‡¶Ø‡ßã‡¶ú‡ßç‡¶Ø'}
                            </span>
                            {coupon.expiryDate && (
                              <span className="bg-white border px-2 py-0.5 rounded-lg">
                                ‚è≥ ‡¶Æ‡ßá‡ßü‡¶æ‡¶¶: {coupon.expiryDate}
                              </span>
                            )}
                            <span className="bg-white border px-2 py-0.5 rounded-lg text-emerald-700 font-bold">
                              üìä ‡¶¨‡ßç‡¶Ø‡¶¨‡¶π‡¶æ‡¶∞‡ßá‡¶∞ ‡¶∏‡¶Ç‡¶ñ‡ßç‡¶Ø‡¶æ: {coupon.usageCount || 0} ‡¶¨‡¶æ‡¶∞
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SUB-VIEW 3: ENROLLMENT & PAYMENT RECORDS */}
          {courseSubTab === 'enrollments' && (
            <div className="bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm space-y-5">
              {/* Header with Export Action */}
              <div className="flex flex-wrap justify-between items-center gap-3 border-b border-gray-100 pb-4">
                <div>
                  <h3 className="font-extrabold text-base text-slate-800 flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-600" />
                    <span>üë• ‡¶∂‡¶ø‡¶ï‡ßç‡¶∑‡¶æ‡¶∞‡ßç‡¶•‡ßÄ‡¶¶‡ßá‡¶∞ ‡¶ï‡ßã‡¶∞‡ßç‡¶∏ ‡¶è‡¶®‡¶∞‡ßã‡¶≤‡¶Æ‡ßá‡¶®‡ßç‡¶ü ‡¶ì ‡¶™‡ßá‡¶Æ‡ßá‡¶®‡ßç‡¶ü ‡¶∞‡ßá‡¶ï‡¶∞‡ßç‡¶° ({courseEnrollments.length})</span>
                  </h3>
                  <p className="text-slate-500 text-xs mt-0.5">
                    ‡¶∂‡¶ø‡¶ï‡ßç‡¶∑‡¶æ‡¶∞‡ßç‡¶•‡ßÄ‡¶∞ ‡¶™‡ßÇ‡¶∞‡ßç‡¶£ ‡¶¨‡¶ø‡¶¨‡¶∞‡¶£, ‡¶è‡¶®‡¶∞‡ßã‡¶≤‡ßç‡¶° ‡¶ï‡ßã‡¶∞‡ßç‡¶∏, ‡¶ü‡ßç‡¶∞‡¶æ‡¶®‡¶ú‡ßá‡¶ï‡¶∂‡¶® ‡¶Ü‡¶á‡¶°‡¶ø (TrxID) ‡¶ì ‡¶∏‡¶Ç‡¶ó‡ßÉ‡¶π‡ßÄ‡¶§ ‡¶´‡¶ø ‡¶¨‡ßç‡¶Ø‡¶¨‡¶∏‡ßç‡¶•‡¶æ‡¶™‡¶®‡¶æ
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportEnrollmentsCSV}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition"
                    title="CSV ‡¶´‡¶æ‡¶á‡¶≤ ‡¶Ü‡¶ï‡¶æ‡¶∞‡ßá ‡¶°‡¶æ‡¶â‡¶®‡¶≤‡ßã‡¶° ‡¶ï‡¶∞‡ßÅ‡¶®"
                  >
                    <Download className="w-4 h-4" />
                    <span>üì• ‡¶è‡¶ï‡ßç‡¶∏‡¶™‡ßã‡¶∞‡ßç‡¶ü CSV ({filteredEnrollments.length})</span>
                  </button>
                </div>
              </div>

              {/* Summary Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-2xl">
                  <div className="text-[11px] font-bold text-indigo-700">‡¶Æ‡ßã‡¶ü ‡¶è‡¶®‡¶∞‡ßã‡¶≤‡¶Æ‡ßá‡¶®‡ßç‡¶ü</div>
                  <div className="text-xl font-black text-indigo-950 mt-1">{courseEnrollments.length} ‡¶ú‡¶®</div>
                  <div className="text-[10px] text-indigo-600 mt-0.5">‡¶∏‡¶´‡¶≤‡¶≠‡¶æ‡¶¨‡ßá ‡¶®‡¶ø‡¶¨‡¶®‡ßç‡¶ß‡¶ø‡¶§</div>
                </div>

                <div className="p-3.5 bg-emerald-50/70 border border-emerald-100 rounded-2xl">
                  <div className="text-[11px] font-bold text-emerald-700">‡¶Æ‡ßã‡¶ü ‡¶∏‡¶Ç‡¶ó‡ßÉ‡¶π‡ßÄ‡¶§ ‡¶´‡¶ø</div>
                  <div className="text-xl font-black text-emerald-950 mt-1">
                    ‡ß≥{courseEnrollments.reduce((acc, curr) => acc + (curr.finalPrice || 0), 0)}
                  </div>
                  <div className="text-[10px] text-emerald-600 mt-0.5">‡¶Æ‡ßã‡¶ü ‡¶™‡ßç‡¶∞‡¶æ‡¶™‡ßç‡¶§ ‡¶™‡ßá‡¶Æ‡ßá‡¶®‡ßç‡¶ü</div>
                </div>

                <div className="p-3.5 bg-purple-50/70 border border-purple-100 rounded-2xl">
                  <div className="text-[11px] font-bold text-purple-700">‡¶Æ‡ßã‡¶ü ‡¶ï‡ßÅ‡¶™‡¶® ‡¶õ‡¶æ‡ßú</div>
                  <div className="text-xl font-black text-purple-950 mt-1">
                    ‡ß≥{courseEnrollments.reduce((acc, curr) => acc + (curr.discountAmount || 0), 0)}
                  </div>
                  <div className="text-[10px] text-purple-600 mt-0.5">‡¶°‡¶ø‡¶∏‡¶ï‡¶æ‡¶â‡¶®‡ßç‡¶ü ‡¶∏‡ßÅ‡¶¨‡¶ø‡¶ß‡¶æ</div>
                </div>

                <div className="p-3.5 bg-amber-50/70 border border-amber-100 rounded-2xl">
                  <div className="text-[11px] font-bold text-amber-700">‡¶™‡ßá‡¶á‡¶° ‡¶¨‡¶®‡¶æ‡¶Æ ‡¶´‡ßç‡¶∞‡¶ø</div>
                  <div className="text-xl font-black text-amber-950 mt-1">
                    {courseEnrollments.filter(e => e.finalPrice > 0).length} / {courseEnrollments.filter(e => e.finalPrice === 0).length}
                  </div>
                  <div className="text-[10px] text-amber-600 mt-0.5">‡¶™‡ßá‡¶á‡¶° / ‡¶´‡ßç‡¶∞‡¶ø ‡¶è‡¶®‡¶∞‡ßã‡¶≤‡¶Æ‡ßá‡¶®‡ßç‡¶ü</div>
                </div>
              </div>

              {/* Live Search & Filter Bar */}
              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl flex flex-wrap items-center justify-between gap-3">
                <div className="flex-1 min-w-[240px] relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={enrollmentSearch}
                    onChange={(e) => setEnrollmentSearch(e.target.value)}
                    placeholder="‡¶∂‡¶ø‡¶ï‡ßç‡¶∑‡¶æ‡¶∞‡ßç‡¶•‡ßÄ‡¶∞ ‡¶®‡¶æ‡¶Æ, User ID, ‡¶Æ‡ßã‡¶¨‡¶æ‡¶á‡¶≤, ‡¶á‡¶Æ‡ßá‡¶á‡¶≤, ‡¶ï‡ßã‡¶∞‡ßç‡¶∏ ‡¶¨‡¶æ TrxID ‡¶¶‡¶ø‡ßü‡ßá ‡¶ñ‡ßÅ‡¶Å‡¶ú‡ßÅ‡¶®..."
                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                  />
                  {enrollmentSearch && (
                    <button
                      onClick={() => setEnrollmentSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1">
                    <Filter className="w-3.5 h-3.5 text-slate-500" />
                    <select
                      value={enrollmentCourseFilter}
                      onChange={(e) => setEnrollmentCourseFilter(e.target.value)}
                      className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
                    >
                      <option value="all">‡¶∏‡¶¨ ‡¶ï‡ßã‡¶∞‡ßç‡¶∏ ({courses.length})</option>
                      {courses.map(c => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1">
                    <CreditCard className="w-3.5 h-3.5 text-slate-500" />
                    <select
                      value={enrollmentMethodFilter}
                      onChange={(e) => setEnrollmentMethodFilter(e.target.value)}
                      className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
                    >
                      <option value="all">‡¶∏‡¶¨ ‡¶Æ‡ßá‡¶•‡¶°</option>
                      <option value="bkash">bKash (‡¶¨‡¶ø‡¶ï‡¶æ‡¶∂)</option>
                      <option value="nagad">Nagad (‡¶®‡¶ó‡¶¶)</option>
                      <option value="rocket">Rocket (‡¶∞‡¶ï‡ßá‡¶ü)</option>
                      <option value="free">‡¶´‡ßç‡¶∞‡¶ø (Free)</option>
                    </select>
                  </div>

                  {(enrollmentSearch || enrollmentCourseFilter !== 'all' || enrollmentMethodFilter !== 'all') && (
                    <button
                      onClick={() => {
                        setEnrollmentSearch('');
                        setEnrollmentCourseFilter('all');
                        setEnrollmentMethodFilter('all');
                      }}
                      className="px-2.5 py-1.5 text-slate-600 hover:text-rose-600 text-[11px] font-bold transition"
                    >
                      ‡¶∞‡¶ø‡¶∏‡ßá‡¶ü ‡¶´‡¶ø‡¶≤‡ßç‡¶ü‡¶æ‡¶∞
                    </button>
                  )}
                </div>
              </div>

              {/* Records List Table */}
              {(!filteredEnrollments || filteredEnrollments.length === 0) ? (
                <div className="text-center py-12 text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                  <GraduationCap className="w-12 h-12 mx-auto mb-2 text-slate-300" />
                  <p className="font-bold text-sm text-slate-600">‡¶ï‡ßã‡¶®‡ßã ‡¶è‡¶®‡¶∞‡ßã‡¶≤‡¶Æ‡ßá‡¶®‡ßç‡¶ü ‡¶∞‡ßá‡¶ï‡¶∞‡ßç‡¶° ‡¶™‡¶æ‡¶ì‡ßü‡¶æ ‡¶Ø‡¶æ‡ßü‡¶®‡¶ø!</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {courseEnrollments.length === 0
                      ? '‡¶è‡¶ñ‡¶®‡¶ì ‡¶ï‡ßã‡¶®‡ßã ‡¶∂‡¶ø‡¶ï‡ßç‡¶∑‡¶æ‡¶∞‡ßç‡¶•‡ßÄ ‡¶ï‡ßã‡¶∞‡ßç‡¶∏‡ßá ‡¶è‡¶®‡¶∞‡ßã‡¶≤ ‡¶ï‡¶∞‡ßá‡¶®‡¶ø‡•§'
                      : '‡¶´‡¶ø‡¶≤‡ßç‡¶ü‡¶æ‡¶∞‡ßá‡¶∞ ‡¶∏‡¶æ‡¶•‡ßá ‡¶Æ‡¶ø‡¶≤‡ßá ‡¶è‡¶Æ‡¶® ‡¶ï‡ßã‡¶®‡ßã ‡¶∞‡ßá‡¶ï‡¶∞‡ßç‡¶° ‡¶™‡¶æ‡¶ì‡ßü‡¶æ ‡¶Ø‡¶æ‡ßü‡¶®‡¶ø‡•§'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-2xs">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100/90 text-slate-700 font-black border-b border-slate-200 text-[11px]">
                        <th className="p-3">‡¶∂‡¶ø‡¶ï‡ßç‡¶∑‡¶æ‡¶∞‡ßç‡¶•‡ßÄ‡¶∞ ‡¶¨‡¶ø‡¶¨‡¶∞‡¶£ (User Details)</th>
                        <th className="p-3">‡¶è‡¶®‡¶∞‡ßã‡¶≤‡ßç‡¶° ‡¶ï‡ßã‡¶∞‡ßç‡¶∏ (Course)</th>
                        <th className="p-3">‡¶§‡¶æ‡¶∞‡¶ø‡¶ñ ‡¶ì ‡¶∏‡¶Æ‡ßü</th>
                        <th className="p-3">‡¶Æ‡ßÇ‡¶≤ ‡¶´‡¶ø ‡¶ì ‡¶õ‡¶æ‡ßú</th>
                        <th className="p-3">‡¶™‡¶∞‡¶ø‡¶∂‡ßã‡¶ß‡¶ø‡¶§ ‡¶´‡¶ø (Paid)</th>
                        <th className="p-3">‡¶™‡ßá‡¶Æ‡ßá‡¶®‡ßç‡¶ü ‡¶Æ‡ßá‡¶•‡¶° ‡¶ì TrxID</th>
                        <th className="p-3 text-center">‡¶∏‡ßç‡¶ü‡ßç‡¶Ø‡¶æ‡¶ü‡¶æ‡¶∏</th>
                        <th className="p-3 text-center">‡¶Ö‡ßç‡¶Ø‡¶æ‡¶ï‡¶∂‡¶®</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {filteredEnrollments.map((enr, i) => {
                        const isFree = enr.finalPrice === 0 || (enr.paymentMethod || '').toLowerCase() === 'free';
                        const method = (enr.paymentMethod || '').toLowerCase();

                        return (
                          <tr key={enr.id || i} className="hover:bg-slate-50/80 transition">
                            {/* User Details */}
                            <td className="p-3">
                              <div className="flex items-start gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-black flex items-center justify-center text-xs shrink-0 mt-0.5">
                                  {(enr.userName || 'U')[0].toUpperCase()}
                                </div>
                                <div className="space-y-0.5">
                                  <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                                    <span>{enr.userName || '‡¶®‡¶æ‡¶Æ ‡¶™‡ßç‡¶∞‡¶¶‡¶æ‡¶® ‡¶ï‡¶∞‡¶æ ‡¶π‡ßü‡¶®‡¶ø'}</span>
                                    {enr.userId && (
                                      <span className="bg-indigo-50 text-indigo-700 font-mono font-black text-[9.5px] px-1.5 py-0.2 rounded border border-indigo-200">
                                        {enr.userId}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10.5px] text-slate-500 font-medium">
                                    {enr.userPhone && (
                                      <span className="flex items-center gap-0.5 font-mono">
                                        <Phone className="w-3 h-3 text-slate-400" />
                                        {enr.userPhone}
                                      </span>
                                    )}
                                    {enr.userEmail && (
                                      <span className="flex items-center gap-0.5">
                                        <Mail className="w-3 h-3 text-slate-400" />
                                        {enr.userEmail}
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleViewUserProfile(enr)}
                                    className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50/60 hover:bg-indigo-100 px-2 py-0.5 rounded-md mt-1 transition cursor-pointer"
                                  >
                                    <UserCheck className="w-3 h-3" />
                                    <span>‡¶™‡ßÇ‡¶∞‡ßç‡¶£ ‡¶™‡ßç‡¶∞‡ßã‡¶´‡¶æ‡¶á‡¶≤ ‡¶¶‡ßá‡¶ñ‡ßÅ‡¶®</span>
                                  </button>
                                </div>
                              </div>
                            </td>

                            {/* Enrolled Course */}
                            <td className="p-3">
                              <div className="font-bold text-slate-900 max-w-[200px]">
                                {enr.courseTitle}
                              </div>
                              {enr.courseId && (
                                <div className="text-[10px] text-slate-400 font-mono">
                                  ID: {enr.courseId}
                                </div>
                              )}
                            </td>

                            {/* Date */}
                            <td className="p-3 text-slate-600 whitespace-nowrap text-[11px]">
                              <div>{formatBengaliDate(enr.enrolledAt)}</div>
                              <div className="text-[10px] text-slate-400">
                                {formatBengaliDateTime(enr.enrolledAt).split(' ')[1] || ''}
                              </div>
                            </td>

                            {/* Original Fee & Discount */}
                            <td className="p-3">
                              <div className="font-semibold text-slate-600 text-xs">
                                ‡ß≥{enr.originalPrice}
                              </div>
                              {enr.couponCode ? (
                                <div className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded text-[10px] font-bold mt-0.5">
                                  <Tag className="w-2.5 h-2.5 text-emerald-600" />
                                  <span>{enr.couponCode} (-‡ß≥{enr.discountAmount})</span>
                                </div>
                              ) : (
                                <div className="text-[10px] text-slate-400">‡¶ï‡ßã‡¶®‡ßã ‡¶õ‡¶æ‡ßú ‡¶®‡ßá‡¶á</div>
                              )}
                            </td>

                            {/* Final Paid Amount */}
                            <td className="p-3">
                              {isFree ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl font-black text-xs bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  ‡ß≥‡ß¶ (‡¶´‡ßç‡¶∞‡¶ø)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl font-black text-xs bg-indigo-900 text-white shadow-2xs">
                                  ‡ß≥{enr.finalPrice}
                                </span>
                              )}
                            </td>

                            {/* Payment Method & TrxID */}
                            <td className="p-3">
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className={`px-2 py-0.5 rounded-md font-black text-[10.5px] uppercase tracking-wider ${
                                  method.includes('bkash') ? 'bg-pink-100 text-pink-700 border border-pink-200' :
                                  method.includes('nagad') ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                                  method.includes('rocket') ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                                  'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                }`}>
                                  {enr.paymentMethod || (isFree ? 'Free' : 'Online')}
                                </span>
                              </div>

                              {enr.trxId ? (
                                <div className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-mono text-[10.5px] font-bold text-slate-800">
                                  <span className="truncate max-w-[110px]" title={enr.trxId}>{enr.trxId}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyTrx(enr.trxId!)}
                                    className="text-indigo-600 hover:text-indigo-800 cursor-pointer ml-auto"
                                    title="TrxID ‡¶ï‡¶™‡¶ø ‡¶ï‡¶∞‡ßÅ‡¶®"
                                  >
                                    {copiedTrxId === enr.trxId ? (
                                      <Check className="w-3 h-3 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                              ) : (
                                <span className="text-slate-400 text-[10px]">TrxID ‡¶®‡ßá‡¶á</span>
                              )}
                            </td>

                            {/* Status */}
                            <td className="p-3 text-center">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>‡¶∏‡¶´‡¶≤</span>
                              </span>
                            </td>

                            {/* Actions */}
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setSelectedEnrollmentForModal(enr)}
                                  className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-800 transition cursor-pointer border border-indigo-200/80"
                                  title="‡¶∞‡¶∂‡¶ø‡¶¶ / ‡¶á‡¶®‡¶≠‡ßü‡ßá‡¶∏ ‡¶¶‡ßá‡¶ñ‡ßÅ‡¶® ‡¶ì ‡¶™‡ßç‡¶∞‡¶ø‡¶®‡ßç‡¶ü ‡¶ï‡¶∞‡ßÅ‡¶®"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>

                                {onDeleteEnrollment && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      showCustomConfirm(
                                        '‡¶∞‡ßá‡¶ï‡¶∞‡ßç‡¶° ‡¶Æ‡ßÅ‡¶õ‡ßÅ‡¶®',
                                        `"${enr.userName || '‡¶∂‡¶ø‡¶ï‡ßç‡¶∑‡¶æ‡¶∞‡ßç‡¶•‡ßÄ'}"-‡¶è‡¶∞ "${enr.courseTitle}" ‡¶ï‡ßã‡¶∞‡ßç‡¶∏‡ßá‡¶∞ ‡¶è‡¶á ‡¶è‡¶®‡¶∞‡ßã‡¶≤‡¶Æ‡ßá‡¶®‡ßç‡¶ü ‡¶∞‡ßá‡¶ï‡¶∞‡ßç‡¶°‡¶ü‡¶ø ‡¶Æ‡ßÅ‡¶õ‡ßá ‡¶´‡ßá‡¶≤‡¶§‡ßá ‡¶ö‡¶æ‡¶®?`,
                                        async () => {
                                          if (onDeleteEnrollment) {
                                            const ok = await onDeleteEnrollment(enr.id);
                                            if (ok !== false) {
                                              showCustomAlert('‡¶∏‡¶Æ‡ßç‡¶™‡¶®‡ßç‡¶®!', '‡¶è‡¶®‡¶∞‡ßã‡¶≤‡¶Æ‡ßá‡¶®‡ßç‡¶ü ‡¶∞‡ßá‡¶ï‡¶∞‡ßç‡¶° ‡¶Æ‡ßÅ‡¶õ‡ßá ‡¶´‡ßá‡¶≤‡¶æ ‡¶π‡ßü‡ßá‡¶õ‡ßá!', 'success');
                                            } else {
               xúÏ}{s«ïÔˇ˚)⁄*ó	&ﬂ‘É+…EQ¥√]Ω"R…n˘∫‚!0$h0…bXe;◊÷z≥^ÔÆ"ª÷q]EΩ"À∂Æ∂ Qn›íøä _‡˙#‹>˝öÓû”=3 HKñPâLfz˙q˙Ùy¸Œ9Ñx?…F¥π–K∫Qkæ∆› »ì€7ü‹˘Ë…ÌOÓº˚‰ˆı'∑ø}i‰ °ó?~r˚.ª¸ª'∑>π˝’ì;W‡
‹{ù∞Ë˜kÏzÈa∑–&˛¿ZºBøﬂgø|-oπE/˝ı…ùÎÏ¡?–Ÿã¬8é‚ë—ø˝øÕœnâªãﬂª{∞≠#õA‹n¥◊G
>Qp|ª≈:[kIr6hÖ«t™ìc≥$ézÌzXØ6◊…Íz5éí∞:;A∫·Vó941A6¢∑√xN˛<©Æ§w°◊∫q–N›F‘&µ^úDqµ5⁄›0&´Q\Wˇ·LMLåô8P®œ›F∑I˚;]¡øwãºÌD°[âÉdcJüÕÕÍ4ùÕ¯˜ /“Ã±Ò’^∑µÛÔÕ[€c„ı∆€˛véçwÎæ;ËÔ±˚w'Ó:˙Fõ[çÍ€XãÙß`µfBGaµüπá˛Æ}€ˇ	Yæx≤˙ã•≈_íô9r~˛œ,û]!ó~±HñWVñŒææL~2Æ∑ªSã(≈ÜÀΩ’ï`ï?~úåtÇÌVÿÓVì∞€•ª5!ØºB*f_hWtXèuˇTkQ3©NíV}N˚:E÷ÉNı–{Ñ–ÁÖ®Ω÷XÔ≈€>ØEqÀÍ!ˆ>⁄<mπötÇvı0ÏﬁÕçF7$ùÍ,IZsÙUjsOm5≠M∏€l''A=⁄¨&-B€©Ö’ÌÍl¶áŸWãVV3ÕuV´”»Û¥ÖçiΩÅµàŒÌj3®]‚ºf5HB˛W“∫ú°¨5√-BG‘J™µê1ò¿)¥y˙Ç_Õfÿ5˜$Ï»Yﬁn–Z•ùùòpnœc0ì'æø˛ˇM9«=∆LlÛ©8Ëit˚OÑ±£Øÿ•˚Ù*˝~ï_˚VÚ†€Ï˘oÿ≈«Ñ1'˙◊ÏéOÈ%…¥‡éc„Ï˝ËéŸòFØwÙ—j≥7;!X¯VBZ›Í§c ÿ{øÖ^A_ˇ"˚Óì;Ô∞qÚN√Â?<‚Á≥¡ââ`∫Ïq˜¿§\WOﬁe:‹ÛÕA>KtnÛü3Ó∑_·ÛlÃ+%L[h‚èÏﬂ˚¸óõº⁄ßOÿÂª¸Ú#’⁄5)£‹}rÎ&:ø'7 ^_É›µ)≥h5∫«w6ÇvΩ.oáÁ9ÀXÉﬂ∞´/ë‹b3ËÇ #X˝{z∞XÏ À	X?¨-Ÿ©Œ Ë4⁄óË˙è”C‹‹ÒÏzÏLAvﬂ≥Ÿód∑‰Ø©DÿX€ÆÆÜ›Õ0l;⁄)“íosc-lR¶∑AˇoJ0lòá$˝séh3∫+‹·_=˝ d’›GˇA|lc&√iá‚`5j÷mˆ«ø∂ú∞v©0"u2)A¯Ïô˜ËW >fúÀ‚Î0càÛ∆‰dgÎM1©™ﬂlﬁ”nÀ5`ß¡Vuät∂´ö†Ÿ™{Ê÷*„∏|0Wπ¸Ôáãy∫w2˚-Ôß'i˙uö©k≥d[£´⁄K⁄Õ`5ll3¢‘jÕ1ßç√í6ƒB¥Vùﬁ3©∆1ˆ„”˜ŸÔW8G7O6úÑ∂0q‡ƒO|Ûœ◊Ä—sC£›Èu=£Ënwƒ{}r¸€A≥ﬂYΩDw»Ÿ˘>Ÿ9j/PˆΩN®Ñ£‰¯	B•ΩìÈ£ïp¨ƒÎawå5Î√;îΩÑt©¬¯¯Åpl}åLLûúúööûûôÒıÿ‡hkΩfvÕ4Ïö©T¶CX˘¥∆ )'WåH¶µ#úxéÇ\’z…\‘Î6Ì∞⁄é⁄°∏”cãæU˚"NØ¢áó{ç8¨;oqjCæç…7”∑e>ñ˚ÂCùµﬁaªÊÓ dûÑÕ∞Ê£sùÇW(Õ˜Eø†EΩ$HH–ﬁˆÒ^–"v¥ıAÅñM¡Mê^%7Í0âäœÒÅÛ!m≤4úêëäf{‚bÒM)¨ﬂ=6Œü/Òä3a\£K‘=pB˛Ø¯Jµ?”OÔ~^1øB˚Ï?–8•‹œK∂Iπ7#À>§ÁOÓÕrÓŸ`=®"ÁJu.+ËÚ_~¸í.Áã∫~f∑'¬Æ‘+åFû21óO˙.ÁÚ/}
∫©¸Bƒ¬ymLÁè[∏m√æËO∏=õ>:®p{dèÑ[æ©ˆE∫MMÇ/ƒ€}o˜#ﬁûïÓèxõOç ∑ä_∏ÆW<ìÓ∫[√Ó@ñ‹^‹iÜ∏-óˇÙ„óq≈@˜X»Ω∞ﬂ"ÆÊÎ®pBy ƒ\1ÔBŒﬂ˙t«ŒYwá∑=£?nq7f§?y˜ÇˆÏ†Ô—Ω≤ÊÚ›µ?ˆ\y¶ºy˜]‰Ât‹èÃ{A=πO6›|ä‘™´ËÖÿÎz≈3)ˆ.µìn‹´A∑ÄRb≤‹Ì’È èÏÎË@_Ï  />Vêy·Ä@±|.'˙k"ì≤è˚∏ûÛ·0 8áπ‹ˆçcä=¨Â'à√¿1¡TLMüv3¿8À˘Ï„EèI„àd}Ã¨“·ÛÄ_Öˇ\ó˚Q–Ù5>}ÑÕ0˝~–>ïïxkÈ‘(Á›Tvyèˇ|èœ3o-W‹ë+ıG›ìoøÕ;`√É\(é6ì„;”ÆŸ»·≤ñe1Z~y
Á≥˝s◊FªﬁXè‹ßºˇñÖìâ”UÎ ÌäR&⁄+DÆ……lÛÕ`„…àîe”%MÒc∏Ftè˝Ô˛≥µ§ºUæ«o2‘8Câ·∏/Ú+è«÷ãÃ◊ hÙ]X†>µÌc&Ïòn.J'kÊ¢]Ω'[’YFïT[UîbÄº≈µ√àŒùÍ∂ò\Ä€ 4Ñ©!éw‹yj-lÑÙ 0∂‹Ÿ®ŒxÄ◊
€˘∏∞¢Õ)Ò=©nÒ„‚Oø´©ﬁç˛,97”rØVì$ã0∂˙üŸûa+åÉfù≠ïu.:d÷]>8;°¯î`0*yˇ(ànqÉ-ÃB#Æ5√)d}à—ÈC(n∫dlæ`xˇ/u–gvi‘é◊„D¸∫¨ÔWÙ‡sHE«∆j_«πpê” AŒ«·€çp”êíFõB Â…‚V'åaªñÑÇœ¶ŒQsBÜß'éÿ∏≠:ß$¯Ï&6€">T´Kæ+mä$6‰<Ì'`ŒAÍ√QµÉ+è-wÇ¯R3Lú$Õç¯3^Ç.b+lÈ'Ì$ÏµÔØ_˝ﬂú7}ƒ$ßwA42˘"õ™Ò[∂kËø∫ÕÜ>%¿a2ú0MÜ´∫»1>%hN\-“§0ÌﬁÈ“E∆	∏¨˜%>R« ›‡z◊YÔÑ◊Oõ⁄ÜãÓˆ^ˇ5[yÉ-⁄‚±Æ•‹=êú?ÀÜ4Ôü®–Ω{™;sËlwπ∂M≠“ïë2≥#,dåÄw$è{vS)∆~9huö!9m9Ñ8Ã13≠‡ÕGg'∆gPå=Ùs÷êËÛ≥˜°8¸1,¢Gk≈ﬁ‰∂{Öçj&•y'"=œpåº+çXHáÇ‚‹Ü2êUÀòí”å-g0ﬁ±SÇ(¥Ã7âó[(À®õŒµ<ÑûÍZ9®£ù…o~∏ˆ&Êõî˘\ÿ¶eB€÷#Óa˚ΩI˝∏öÿJ:Ç4‰90©K°j’Ω¶kåÎ|kàÊCv,•ò≈˛˘óP∆°`e?.Œ°‰"ùuX¯æ˛òÜÇM(Æë"5˙gi´˘|£Çeﬂ˘F
I,¬84$Ÿ≥¡8PÃÎ”œ9d ëÉ˚Kp°C˘Í\ÃCåÀ‚t¢O±Cπ†R¡#ı{ z§ÌÊ3ëb>¡˝ó>R¿G6¢{Ëü>Ç„äûF‚¸≥H#. ∑%1c8ÍRu™c´Yá>‚–∞‡.\).√|yS®kˇ˚ÎWˇ´Ñ˜ŒæÕ˘i%WÕiÜA‹+qÿ∂BJ®˜Õ·R¨-bitü„«C∫r3π+wƒïÂ€)c;∂º—õuó9ﬁ4˜Œ0ãbíøÀL&-æÔKO˝cÊ¸ä≠‚]e¢ˇ±à<f$p˘rçõP|Ñ√-7˘Æ-lq>û‹∫È⁄‰( ±<'Ëoi˛4f∆»ÖsWñŒ..ì3ÛgÁ__dÈORic'†d˙v®“úPbÈ6⁄°ùﬁ§ø‘&Ë˛gÈM‚ê“ÉÿÀ∞¸&˝Á6ô.í€ƒ4`CgÌ#≠TÜì>D´¬˘OÑuîäz%ˆ‚±Ö†∂ÎAÏLíz˙–ÕGŸÎ˚àkˆ€5•sÓ#¢'¸‚˚Â™DWq&‹ˆï⁄r7∏UV⁄mdh?õ€§≥≥1»√® EµIç#"S'˚ÕŸÕ#)^ÚnøGd∂ñá¬oÚú{⁄|qØ”çÃ¯≤å „ÓxZæqƒæ)òJÑÁÇ|Fdô°¢ÿ·ABË»∫a≥À∂ Ã-ú»tn5…Ë˚Îˇz!›nÃ…Á3r1ÁD¡∏Åu
P«¶Öèu©é…ë)Ê%TX:„°"h€1ñ˙—9˜—ç“È|ı›Hô^:œôŒ°ß®	#;pB´≤ˇˇ)≥á+˙Qi;$l<îx∂S·π¥Pﬁxst¨t*5ò|á@*z{)‹>æSk‘wÂÚ≤/.°çΩÖÂÜ€%˙g“∫ΩÑk¸î!ØÇ.Úô»«>#dé»{wGÇö{x£®∞Ü£Ï‹˛ﬂË5yÖú
ªA£âa„ Ÿßú@vßˇµF◊∑πM6„’≈ÑoC∂RÏü;±∏CÍ´9ÚËç√∆	∫&bø¡ãY6õ}\ÎtÚˆL1húå˚Zìî’1∏öﬂ>$Úƒx$%Ã;T¢ºC™
:ı?3â]},%ﬂ?âcó'˚˜Èqó;ﬂ’qÆé9Û26õ≠â´q„CXoÙZhØŸƒ∫2isó÷#Øñ∫JmâG®ó¿7ˇçy‡?bŸKa˙G›'Za/@ƒÇuî$cÒ‘ôJ>øÖ›#ˇ#ßRKA∫Û•ËÍì;Ù⁄ƒÙ—®Ám>üN‘ÂMüêßõ˜W´U≤0øº0jÈÏÎd˘Oüû?yqô¨ú;ø¥∞L^[:Ω≤xaô›ï*PÅ∑ﬁÄDï›®∫ìµ8j•√?L„Hã$<úÁ?èNr_ªÚ¬£¿·Ñb∏M1“‘°\õ”JyÏ5F√+q:≠9Í|®äÙôÔº√u%á\Yí3'ëÂÌ&ÂTr·“:<0±ƒÖﬂ¡L€¬Œ·‘ï™T[“a8lÀ	%⁄i’£íÿ◊DÓ¸ØÂÖÓ§‡9ﬂ∞?(Áê¸ÎL–≠m–·ˇº&Ãp6FÿıÓ∆X7:’®6ª‹Ö≠YYmWOû›%úˇ¢S„µµdÆ3o7Ïê…9r!ä∫dÅÍXÎQºùÆ ÍüAvü¥JLk≥VpO9Ljÿû≤°p:Ìªh>s⁄Ã£∫áòä]⁄°ì°Bi{0H…kîiË˜9ëºö”Çû⁄wÓ¯ù#RÎπGœ£;\ ªÛûRs≈rΩ˛S~Jyv≠A.£¿)'¨Cí?ß¥∞*Ú+çˇÕòDl+àa"È/IMv@&öÛéƒÂ“ﬁ÷±OòÅo3:yﬁq«)»ﬁkΩnÑ	SVc~	ß«8jî_uI#ëc'«âo]A%≠∫ÚhÛ·¶3µÀtq∫D=√9≥sv9yC\}Ï	W{qÿÌ≈m'9ÂE¿ái‰‚e>Ô$ó[ysæ®R*î6µK«w*£æπÂüTd≈fTÆQNn¸l#ÈRWﬁx≥Ù”ÀΩ’⁄@úÉµ‚]¶ÙOiÁ-¬ü	ÿ‰"UÅ!Œ(+Uøìıìó˝¶mÔ}l2ŒÉ¿<1ô˘…A*†,olbÍÕëºóÃ±ó∞„n6€"ÖI•ÍF˛©â	_mÜ›∑‹ÀíãA8±£ÕùàÔ>ø
©*[˛À»nA √	µ+Ûÿ1X 	2·;d¥wÙeIäYƒºlMJG
]¡æçË+√ã@òK1BÁ◊ö∞ÂùÚ¢6‘‹˘ÛÑVÁ’opÏmºbÇ3∞$GÑùö√§◊ ©Ìv–j–Yinì”Q¿P*ABˇ•?r—wÙÖà˚¨à∏ﬁ03Sƒe¶∑`;N§ôÎ/<Ç¿≠ù
ök‰ˆmÔˇ*CÆ≤4>dÜ∞√Ö51å´ÇyÏ*OÑ)&òîKë'î&ì%<íD1ï¬*ÉYÕ5≠>ù‚Å¥≥r_.8º4yÿ«f1ø’K>	˛’Çp*È=k ìèx≤i$a´·Öò}˝ﬂˇâ 0,œÔÍIî3’àÑæ≈·+¶˙K8,Ü{∏•À^e§Áóÿ¡ü®H Ê~˛Ì†—Ñ‚@Y^ :‘DŸuêÚ_z0Ã˙≤Ïp´on`{Å©‚¡˜a˙¡T(*íàr(ÙﬂúiÊP¢-…ÓíÄ…æ&∏ÿ¥!Z4{≠`´∫Qù>D`ÛØ5©8æ]z›»ß`ß¸[TÊˆÎÿE¥l≠≈Fª÷Ï’)#§ÕéQ·'Ù∞√\Â∏àz,d˘:âÆ¢:rI-ô™]k§íŒ–hÓ˝9áX'ﬂÜ◊¬«÷M*åpÁ}çºD7†ö€EÈVüÒF ©–Ÿ%a3	á53oåçç¡ﬂ’dËÅ˜˜ú }ñ¢èÄöîl)D€ÙËÓS€œ”ıÀh˚}Í˚[IÆäÔTÚTØoﬂØÂÁU	ti˙Ñ)ø?%E}’ä‚/Eûaw◊ä´˙neˇ®FK¸\döøäy(°Ìáoıû úG$GΩw…Üj|fÕõ>-øJcµÇ+¿Ù°|µZÎ«0ı¬∞WF <¿d #¿üã˛<ß©˜´≈Õæò£oI≈ ™}¥B¬≥cx°Ã£ <∂ö˚§œÁZó˙“(ShÕ°,Ê<OΩÔó·ú ı?'ìQö,)w€gCW≤+‹µÌ
É€-{B_sòYe.OÉe¡Èg/odx$#£©Â6Ï≈(ƒkÅpq˘π«¨!ºÎ ±k )ù 9í7ı•ae&¿Ø`5˙Ã⁄@L
3H“[‘b6™,!¥Â˝¥Ñ¿Îu@%»?√6Û<«Ã"	C÷2≥àöËßﬂ¢Åè+5j»°º0j¯?\Â≈•|3¿£F∂≈ 
5‡ÓÖQC‰ÖQ√o‘òô#¿…J‘i‘›¶qéEfM™íÊö7¶_ò7ˆ º·@ò`ﬂ∏W‹æqoŒíòoKïBDÍsë¯#%µ2Ω„:œ–ãäN\`€»∆n»0èı“íQD‰xÜl
Ëƒ˛0FÖ˝◊'Íêˆé–àﬂ–Œ„
o⁄⁄˝ümÌæò˛∏_@|ó=Ì*}Å9ƒï˚‰Zi
=ª'ç[ºã1@ﬁ ¿|™{±•}ˆï¯©ïxãË@ãáÉnP5ﬁjVÈÒ–ˆ~*ÚÍ}œ∞˛nùpòﬂÑM¶¿ß3ºó∫∑£O©Ú≠∫ÒÙhﬂOØÓÌA≠Ç/¥o§µø?Ñ)”2`_‘Á
Ôı‡⁄sÅãßW9fu#Tºœî∆„⁄∆69P°G÷ì¿tﬁùäõıÚÉ©ﬁkµ∂√öSô∫é;]£N±√_8rΩÖefQÀüÅﬂXÁ9	‘≠"G~síqÁÕë7<»›ÉÑrWß+Myúå¢f¥G˝/5ƒ˝9ØﬁﬂêydZ2∆õ™±ÃPı˘Ói”E?EøTFÈŒXZ>'∂∂v1 Â–§¥tî–Eá\TÅ:æΩ±+:ù0s±6f¢ˇ}Yv£ªŒxıFClï≤Lª◊lbèzEƒ∏ì∫lè:*QÿuîA!êˆ≈2U&≥en=,:œLx‡´¥ìIû€_^Wf0Ñm∞ãfG‡ë#OÖ¿}ä∑HEYVÊ∞º∞ŒÊe¡ıÖH€Æz,ã\_ıç	ë5ËÆìõ¢e“ûÈ1sπ?ÓsÄ˛¶N˝GÊ;ÙUG’˙∫L•Cˇ<H:Kı≠Qw‚.Ì≈LkÄ€wQª™ÀåöÕw®'ZñR©#¶’ß™¥æú‹À8πhHT›>	ÒôÖ|0ucIßŸËV∆ˇGÚìÙˇ„<Z%	◊)√§≥têqú;≥¨è¬†÷{-÷!œ¨≥¬DÁª2r<«X,}ª‰∏U2I%µ¯B∞°SiÌÄµyÏûÿ°É)$=≤Iao>fø˜ïW¸k0£o”'æ{Áˇà˙ïÿ)Ê¥Â8Jr<%ﬁ‘⁄Óá˚)≠äúîª£ïÃ+¸πÖŒ_X\^\!À?[<uÒÙ‚)≤¯Ûg»¬π≥Ø-Ω~Ò¬¸ “π≥E≥;+gL\‘åñ6KîÒh∏Í»dUtg‹¬%Tf¿®Aˆ‚’hÀëÇ
~Î*Ì÷b@ã[A´dÊ≠Ù¡4˘ñh‹AC˘©äîÊU∏ˆß'ÌÚw?HCúp7>~®*πfºﬁ¿$≠∫‚ÃÆ¨ŸÅIÖj.	îG†ÛQÔ5Èx`öúi˝ï&´Âd…ÂkqñõÇCß´íãUª»©¥-»ñΩ‘CzΩ`—π~8¶≠y$ü>3ﬁ·+ı[æ8zΩ± 2%€.”4»+d•—
G˝˘EÁ‹ê¯6¨”fª¥ÕjT˚"’ÈÔI˛1”Á¡›l<0ébıÿÌ≠∑P¥h2|º•Çss⁄ib´ÃÍ5¥∫¿q◊/Ãì?˜ë>Ø0ﬂ÷ã>∑:çx€$–˝'œ,ùÒ~Dhiœ7•˘
Ì‰p‹)ì„Œp)√ÜÿöV‘™Í∞ØèT€¨ãèD[çˆÒìÂàhÔt£’¶ÇÚ“∞j°¬+≈ÿî‹')Of3p ÊgÉ~Ãà‰ë¨µbë•è?Q.⁄ßúr~>Ÿ¸ºoö©7ÍfoÑY2≈î±Ñ·≠†›öûZD√'A’?›¡Ùl–•4xY9ürB\â∫AÛL_rdMÊ?SMº`b%§∏4Ó3C,ÁÈ(£’¬èèTÚÍJ&´!wœDu¨êΩhœGî•Kí(<,ß>3±e‹∏¶íësûvÉT≤ùœïÕPÛª_£/n	3J≠X]¿ ¶^ó∑õ‰~ÇÑ‚ë–”f›ΩÃ'V÷{∆àÊ>áçÂ=ÖıMg√[—v+ºMÔnÛ˙¥ÑyÏ≥D¢ÏÓ≥H∏˜§^ ‡z “œ”µÇn£F∏[ôec'âprÂ÷©Ãgà/(¶/…≠ö≠J5ﬂ_ˇ‰ﬂ˛ﬂ£è≠¸Ë,÷V‹?$ïÂNXk¨Q™QúÁ|£viPrÄ}üaÉ7ªbE§ƒ#Ö…}˜Ñe‰, ∑Ñ?$KøÅ¢5¥Ü≠èa˚-x›≈Ô§âVïõR¸∞”<èx~ª 2å2√zsRë´æT∑=ﬂ>0V(VQ‰Æö"?V1dñ>aÉ*]±YÛ7i
çÊL,á g( î,Èk™å›œuÄß%76◊úÁfu∆£z˘]…
ƒá=s$É√÷Q7ÙôFù~ë§c/öÅ∏kLxÁLb¡.√bº‰YUqæ<3«êàõaº$ÄæRàmœ√Ê#£~∞"\>Häë£ï Û~~¶s|Ø™_k‘s1«0Ê¸#‰ÜV∏,b¬:Dì\ÊWJSˆ”µ∑`≈&J5ösx©ËT>/ëü"éa˚£$5˘y0˛±%ì|`9ˇpêºxUåº¸ò¢OÜ&P®<]BzÖ˛`yF+"›˘ß0^ælˇRÿ<t®H2A—°B˜Â ËÂ«¨§Ö“<ÊïÂ«fô≈E’B'#ô ˙ ÛÂ–˚Z"∂√˘öªàuÊ%8ËÓ®¬‹±)(ON‘î˝°›ë9®v…wÔ¸\H!ßÙ‹êº≠•È}ÓzŸºº˚@Œs45†Ç†¶‹3/Ω-G´„ü˙u!Às;‚˘±L"˙Ç $cîç≥‡,5a≈m≥{$kÌ23F⁄ı{[QQ«‘¥∞ÂÕNÊßë∫¥:å`Rñ;A|©&y®ù)Ñv»•óïx{ç]˙∆Ô3+â≈;∏~-ª‚†+ûÔ≠6…ï5◊N»+í'!ßT*)^{÷,¯-ó≤P•oW]‰“äü|ZÛÁT¯¶}K‚QJ *˝≤VŒ¢ìéµæ¶U≥ø!ÃÔA
/:ùFIgÀm£≈®=(.ªøAœ‡Òô@JL6ﬂ©HqöU∂:%aˇX∏ÆyÜô
›ÊG¯îÍ	‰	c…⁄sÈ⁄ aÚW=◊6r‚q®}å≤Ú1ﬁÙÀÔ\fﬂX¡à!˝{!jØ5÷¡fb]‚©ÓÊ‡™¢®~ú»íÃØ ø®`◊ÆãÃŒ †óAê5Q∆ ™+€?¬Z¿¿¶§Õ@7ê~‰Gi§±¶{+ÓV_ñﬂw·O™1¿…-~ÄoÜ!êßB%Äús%fÙ” çÊH-F 2õç.‚ÅsM£…±Ey’Xk“ÀóÓ9–h3˘é{Lÿ+ B?¨é»Ô\û”8ZØ”	„Uaô„%Wû„’∫≠·¯Â±ÅJÛ¥™hé]é“C3d%9´IªGïJﬁa^a‹U~Sv÷o˛pIEÈß\q¥çhsÅ^ƒ˘A‹ S…G≤Ü/¯Hôπ5Ï3YNZ‘övD¯π€WQ/H´»ªç‘üq˘´π/íÌvç’ö9_å.Qnl˙g˚Tÿª°[*ÇÛ–#Aı¶Å.ºPÂ∂òˆù.⁄|3åªï#É»úpWû> ı˝Å˛˚“»A˜Ï>bπ<≤™ èyRÁÏ>F[NzµZò$#F]BëGÜzSú∑rÿ∏Ú(CUAÁ≤Œ-tDaGq°Ò‰‹±õKÙõA‹¶‹¬ı=å
∞;È5”„ülƒçˆ•ÍÑn⁄u[%¸¡|ü˛ªr^ΩÀÊQ“O^‡¥œÌƒïâ_@¸≤åÑ‘^‰Ã¬œ2ÔÆ…+Zﬁ£¥I–∫¬*:QÁ≈R&e‘Y§·‰Ñ'.’>è≥∫.+«∑•©º¶∆kÂQ,¢¯"X-÷1lœÒ˜z‘{Ùf!Ëò≥”_†©tÆ˛ÎUo¬ízAn]»ó…qÄ~È±ˆm^§•§c©û?ıUn;ïÛr…≥ú óüß•î∞¿>˛r•¢Oï0a‚ç°•8ïˇQç ÷Å©~∂K)®›åÇ˙Çﬁ:ë{~Ë´F≤„∞†º^Wr^UÜ¬É÷XRóü¢l:›Ï‹xÅî-¥œÕ Â‚[ºÃÔÔH8vJ,·–¬≈o·¶/<Aï).¿îu	>drë®C–˜	Ey∫gÀ3˝\(Â'É˙∫œFÔó˙º´g1Î ¶°+UÌFU Rπl Ω⁄É¶ùı¶√Uÿî:,sø Â^Ms‚¯Òù`#’`M{y7,A8GvxRäìa{=h6 »áÖ√X¶ëW«ìï◊Îup v'π
ì•|(ÜNúz∑/3ò;pæ©	ï6‡7r3∞∫ÿc]Të>	a%cÏQc˚∞@≥BõQ∏f—NøSÁ’Ñ˝€K%É`Ÿl“‰6ûMÊ…j√?¸KÙ&˛Ù&‹\7‡â
¢ÒŒr	N¯ßHF7áôvR∑üOÃi{t¢HûÒb_™O‹∂ÉÉ‰⁄è‹yJ‡ÿ)yË¿«ìß$õùƒììÑuÆH≠ÅÚsœéIRe3uhqÊÎH£¯ªEU≤€ôπ√Ã&ßPFGs“N›!Ü≤	<ƒT7çáËÔ …<ˇp)=ƒ4Ìsb1•“{è?ÿB∂[¿üü◊Pn#y	E‹©Â*û„ìË"ëZé»È®)ÅRrÏ¯‡J'´‡FPÊqpïlÖı¬ßå
nÀ˜và1¯¿NÈ£tÚ=,›äÌÍ3€Ã¥e]0æ¶Î‚ÕÏ˘≈“‚/…Ö≈ÂãßWñ5±fáRs„Ìp%XÂ`È8LzÕnb°•=¯ËY>qëgüY4Ω¥ÂÈøò–Vπ?πt	w*ô“.ëq)¨GüüÔ“EÓtì√ßÇmêƒÒ]Z!Lúì†FË¿O{è2v©Œ˛‰óçÓFRv~52
B,˙˚Ø£Uﬂœ5f¥ˆ›Q[—Ø≤Êeê¯^2z®§<Ê"∞Ôr)É√–õA]°CRâ¸Ç1ı”|wtl=‰I&2ØÕÑoámò–˘ıà∂-åµ£M∫Urò¸ÑLÕ–M»(1Lÿâæö:q‹h⁄|fw‘r˚:‰’b*nj °◊D·óµÑA0™3Õõ$ù¥Êÿﬂq¥	{”˘œ»È“ØÁïùuqm+Ø¬pÎæ[fl⁄¨∂Ç-ÕK©]&ΩŸ®;£4_ }p¢àËÖ$yG¡J…,Ò_93˚\óÆﬂ"⁄¡f√)_ÙÁ∞mπÛvSâÔüâ,7˜)s<ﬁ˘í»‘¯"ü˙7Y√1˜-±aﬁVA∑µ8·Lª˘‰Œ?©úËi@4≤èÃ:;∏ì9≥ı¥ÜÍ¸6ãZßµìd§À¯/=u7˘ Ô≤Nﬂ‰ÉTUe1∏;Ô‰#æ°íY(´ªät∫1NVJ—iWTzMvJ≠%[å¬d õ„Œ“«‚èÙ%¢‹Ñ∂h√ªœ›‡D+ú®j‚IØ++âzÎ¶ ütá˝ÀM.¬˘Id˚È "JµŒÿ©Ìg¥ïˆœ∑è
Tô)?À)z’√≠Í¨â«Ùò tüpb/Æ£X1˜ã6÷7∫ÆÃ\Â Àl/π˘´æ˜ëeÛñÆD;2•¨∑ !èΩìØÑJÊÃñ-ååôŸ…ß]“¥s4†|ˇ˛ñ;õ“r—ê}2 êü$ty¿ÿ≤eAÃ2\ßà3ØJÉb@’f@@ô3∑p÷ﬁcÛõAly]4tq 	X∫•¨ÌãÑˇTÇÁ*ßÈc˘˜M"‚˜“\µ9™‚oÂÈ˜"	ﬂógæ·q“"ÏU>I_˚%æwL]AÆ‚FYN©™‚ãyä¶ú»ùŸPO' +Ó§pÎ9úÙèÒd‡YPò+îπ¬ôÚZ_‡jaV…Õ∆.;ûÕ"4=	'ã∑3Oÿ9¬
ÄÁ#V‘M¸ ÃtÅ ’±±±c„¸…lì;Yçôæ˙&¬Æ∆í(ÓV*¡A≤ÍÒ!4-’ÜÊM˝L•_Áö¢r:¡◊	è∆f7{Rov’lvµl≥B„ÌVy∑±;—bY‹∫ŸS∞≤\f®lÜ¶K53zΩ˙2øb u’O¨+(ôﬂx˛À¡î¿“Õ?™ñ	2·ª E¨g.xŒÉ,˝*‡˙Æ€|º kƒ∑œ®ΩÆu›·©∫çû(Æ¬]«∫°ÈGO¡Ãò˛Ÿç—S∑ªaÌŸ.o!<M¶Dy›;i‚"‰±86ﬁ›VÛ˛ÉÊÅîïo5Ãór!Ïæ$™áv∂°aΩK80“ÀßÂæºöû;‰S=.+m=ÓªÑm™Eüà£_$2ƒﬂHØf»Ó§ü›´Q}[Ôùkg!ª¬yJrKÍà£úc3¡tGFÕez^ﬂ9¥õÑ\ëDÅY∫≠™•ÛS
‘¬•‘pE·\DD
ã‰ëHﬁ˛$ù“ÕÃ®kx‡
76√|â©*R4oo&L$õ∆¥›;¬ñÚâ¥)§Ó]µÕÆ±ô˘êõ&ﬁ„Q<Ã‚`ÑÔîù l¸ôIC'√ñ)Ë^ã‚ê≈ˇèˆ7ÖË˘‰˜Â“•0Bgå9œ ß(1_ J∑és,hîå;÷QÚS29ÍT0]S_Ó•z=>f–tE˘™˛_–ä⁄ëi>”õ?øA%◊~€œæÌì÷îÒW2‚ˆ<‚˚o∂|…•(QΩYü0⁄˘ò2·®Õ%=»d‹Òt÷	±g7„®Ωn<ÈÒ¸ı?Ï$≥∏êéè˜:&ï|Œ◊J˜Ã∏ñ¨ØA‡,	>HöDVf©-*3A∂?èÂ°1raÒı•Âï≈ãß»≈Â≈À‰4˝Íq]¬ﬁéK€8> :Âáa;n@Ñ0i6í4#ápfk!∏—¿;»Z„—îk›&õê∑™«3ÌŸ}˘B–¨ıöêúa⁄uﬁª$Ëtb <ÎÁŸè¥E√Gwt¬6ÿ”Ò,ll-äÉ⁄O#cjï‡%ºL∑K`I6l(˝MµR√uSh©ñr*6˘Ω±¸çG#Ò¯»Á≈P]qK÷T¸Ù8ôDµH_@ê9YŒ&≤xÎ Æ•ÍÓ"
”∞∏’iÌÄ#ÛêâµÔQ∫'8,;¡·èlÇ-Ø±âNt&Ãèf·Á⁄mCqJßê∞eKª∂1‡+|(◊ßnªπG≥›†«Jóô‘œ‘.∂§˜jåûiΩZX©$=*¡<x®◊¢¬Q¿Åµ*ˇ‘A2·ô“skkçZ#hr†9m=ÄËÍLo"q3m…ª\3c¨≠göå˚^Úb+ä›-ê≈nNqØºR‡v¬–ÓJå1π¬fÓü±±±ûŸgÓFÛ7cóô?ÈDa˛Ç.êæ≠R
3v%Ü◊ÿ“Yg_œÙ¨3Œ>π⁄ô#è?+ÈK>6FÖñV°˜‰MëÌÏ∏πÇ=V:÷ï˘Ï2@g¨˚ë˘n©Ùa.’Å\‰ﬂÓ7`œá≠†—‰è≥?=O;«˚:]l*+€„•Ω·ø≈·ÇŒ¸È”# ôXC]M?ûyÓo≥îiŒ3Ìº—7ï,S5”õË•îB¿˙mPÕõ>s7]åFË-'∑˘¯öç5VÔdæùlB+#ˆY&Ü∞:fﬂ…¥]˚¢·º„«˙VmOyﬁ®≥cˆ6ÌB¡7ôõﬁ˝.Î®Ü∑ôó
æœ`$Ó◊ôß:ºÕ∏Re(rø?P‡ÂË/H'ÃÜ)Öû
◊Ç^≥;óñ©%t˜’¯X∞^`>˝êÆ¢ŒáGdﬂ9B-’5õÉEÈBj6HæGõ›2ﬂö€›F-…ÑØÉ€¯]‡ufZŒÒ•¡ÏÇ◊|d°ü”(Ù≥ü|I≠UÃ◊∫Wq1ëπ	∑\Ò ﬂ_ˇ˜[<¢
d|M!@◊ıtJ}¯Õ¡ƒ˚ÖÓá∞}‚Ω›ˆk#Üó¸R,wãï1mFe§ﬁ,4⁄«™Ò¡APwe2bë8U∫”§øüÉ¡ˆ7D˙¸s
”¯[˛¨q<Yœgf(k¬r	¿V‰g-ÀA∆O’’ õ∏:∑6_´ÆUäöNAMi˙—ô˚nq‰±@7ﬁ≥%»GZ†g1§i67|&&ÀÇS*s†‹‰£~íÕôÏLvh õm)∑fß;›≥ïÊ˘Æ í&‡Çy~B"wÍ'9I†Öo;ï≠ÛÍÅVBôU‚¢z¶XRg§H∂s\=¬kπ˘/ ∫º`∑IºÜõU´<ìD¥p•Qm∫‹Q*˛¸Ÿ$⁄té∏MØ⁄$´I‘Ï—…`VaÜ¨ÓF*›£≤kiVLÑm:Æl.Ôwü_√áÏâKGF‰√Ã!¸FË5B}y ﬂ}ˇ…6‰ß:Ë¯ë‰>W√≈Õz∏èôZmÎöFBÆ}¨?Wd7˚J2˛–€ÿÆíÈ> ´M’ã6·~éÏ‰oee¬ï™I˚ÅªH/îjÍÆ
r@3ÒÕ›éBÚÌ8P∆»©8Í@∆ìß}«Ò√‚H˘¥≠∫ÕWi’πIÖçÒ‰ˆË`˚é´≠ev¬⁄k$H®û∂˝\n9•ß¿I]Vø´Ë(û
[K±Uuu -∫Ú£%ˆñmÙ…Ä„ˇ(‚*Œ,¸‹z=‹Ùœ8P4Cº›ˆ≥}1ÕD–uîÒIπ≠¢LÓ…]wWÄ|ˆ§CÜ%IPıNûÇÂΩ}ÎjYìÙÖ–∆M¥∏%$∞?∞⁄¢3Ö`ùat;áÛ#ó¸võí(‘}¡°ñF¢z—`? \¥ø◊æœ"ß àwÖ°Ù>W1V∞K7Xö∏aæÒ
€¯Wîﬁ	  /9sfSÖúà+º&·pﬂﬁ/@vXã*¢ˆæf›¯Tb˘n≤©aΩŸF»∫üΩyc&ÖõëPe"HÚN¢ΩÏX¬XD∑ÿﬂ≤S•XÓ^ˆêÀ Iô√r/{ƒ√™Dèäó√Óé¬`#íù-”9—ﬂ(∞ÃÅ«ëòÏ‘Y[Ï9O,|Ò‰dIÄ±∏Œ1eÚ2≈WÜ[9Áâ›∏=òòËﬁZ˛Ì•Q7π∏_Â,ïº’K‚ÍÀÍäå#±⁄MÏÇ∞√…¶÷ﬂ±€€„Kô∂·÷:I‚ÃCv@ï¿]4ª«Ã≥/LYÈŸ†ˇ7|ò+EÂLéVM≈=™Ö”ÒÁ§€·@à˛†ûÖ–…8˙pNù>}G¥ìô%
V¶d	…[œú˙YııããÀ+ﬁ™K{É¯ıœNÆÂeu6m†U?-@π ·*q÷;§ÛÛ›;ø)îlK>ıã0n¨5¬∫ìáz∫góp∞åD2±•ê“l£±Ë	0µXôH÷Æò{˝Û›ÁÔg%_.ï∫3∑ä°ò17◊Ìäî $c≠≠È·óûúœ˛»SÆ#“∆0&«ø˝U,Üm!O§AÄ˝¶gÜÔ5zZı⁄ê≥ì’*⁄§¸kÜÉ¸a3’{5Ü 9¶?î^eıâå ∫}ed∏qáLiß“À"ßxêØ+¶Äã9&E±©î‚µejBÙU«\Ìg?ï⁄íÌ•‘bdq”~vVi0vo≠M fê_·–Ë-ÂVÖzaÿÍƒp¢lz:æKÆ¸≤ˇA6Ô+hÉÜ⁄∏C’—Ø
√f§7±Cl÷¬∞æ‘.Â§Ã
6áå˘gé·f¥4…©F“i€ÄôŸN®49Œªq‘¥±kÂ`3S<µó[â÷◊õ!Yﬁltkêåô·YòÍKdgX∏˛“¡ıÈø€;,‡Ÿ~ˇ_*ñ,»LL“
ìåfêR÷€Ú…o∞2/Pç8ÛâŒö{ﬂoÅ&àˆûV@ò§d êÜ˛BuÛÉŒ»i†.ÏX_äzVi±k Ω…s \ó6Jëä+}˛~’ßg¬≥UÊKL?aŒ	ûLÔæó5µ-Cõ∞Ÿ›ï5N>RŸ åHqd=3âøp`Inö{u∫t˜´¥I˘I`3yçﬂ ∫M_ﬁÅ™RT˙‡|‚U2b(/TºÅ*ø∆·3≤˚ö[9”îcò≈±"KíQÚ{wîΩÑˇ-◊ûôó*∫in—zù˘Ø2N}	ç#¢x_væ-ßq_:usUÕ\ü©Ç∑®Õºö`zNŸ◊R˜ΩxS>Ù-â´QªπM:!Ê'w Œl⁄›¨NN2ìê¥mÅãZ¨"Ó}CÅÉõ¯ù¢«s¡Za`É≠ÍVz£uèÿ¸¿‚ójî∞!Í##oäK
ñ&é:’7¶ÄuÚÔ‡Ï3.®#–x	’4ï~U|1ƒ/m ¿ù˝µ©˛Jç}’¿êf `Jú+Q 
)Ë7≈Ö0/ë0ç·‰Ÿjì´ΩÙB\»æ˚¸#ng(ùäÛ±u|âcRf ’* îï¿*˘°}À{∫«rEéY&l—ˆ©M§ùÍKïœ’!ÀÑ√c^dÏÆo∆ÑT5sSππ+Á≈q«=e=—ÊE3l[˚ipGâSﬂ’¢~¿sˇ?Tì'}z™k?˝héwlJJÛ÷”/Nˆg˜d◊”ÃÎ`œ\∞lÀ!Øû89G°t+πBQ≈<€√ûÑ¿Â‰√:êeÁVIôcEsqÕF~i—m≤,öÔı≥?ïN^Ü>-T‹kítW]˛J;µÓ ‡8Û¶ NöÌD¶>jµÉ‰2cÙOÚS=—…´2Fù%3y)ìÜDÇò•R$Ïˆï˘’X”<5ºªbòóóÉD¢ˇ‰∏ûﬁÖÖewIá:éñΩ%âZ°k¥HÓNñ∆{≥U7À"ÇZÌÒb#ô9n3Hâ<“…áJ¿NG™´dÆàﬁ„Édƒe$"-duŸNÇf≤ ∂S&πÎé˝=;1>ôWAÇ±W˛¬π¶Èﬂ∂¨§RLÛå”ÔêÚΩÀfà±_7ºUƒ0`Ä|S S+˘:ıÜÖΩtxÄc¶[´’I)ﬁ∞*1^À?*pß Ã9¬WÿcÌœA ï%,0 Q⁄iª∏QÍ"π<Ô∫™3à∑‰’h0<CÏ˝û‚rf“üÑôGïÛLÀóeÓ5 áY‰ce‰áYC)téjÖ‡∫S¢5"—º	óÊNÈ´“í◊S\0-7
ˆ˝ÔÑ?·øh∑l]d*Ø÷¡„G7⁄bΩ—≠\ˆzø]à¨Zwé5-◊¢„ öÎÙçÅØ )ÊÀçŒa¯®Èªœ?V–{ª},AfÇQm*ı^Úß>ÿ≠0∂SBÅ”¶ÊØÊóû9µÃô#ÂQá¸Ÿ1K`x≤)§Cy$Sn…b{®xx~]N	Ö°±]¡;<}›Yû«≥H’¡\–é Ÿo
< Î}‡DeGKö∑;:¯{”7M€xØﬂh.ÌÊ“Œ¶˘†7GË
ÈS Hc≤N8™© vÈ<¸ä‰ªèˇ{Ä•E]ñBÅó≠áDâAÏ˛Z–π%o™ßk0˜§Éèu⁄πã Àè»©◊©ã
z:sd‹è~Éñ‡øêÏ¥éœ˙øy”‡˙AbÚÕ9 [ÖdóÃ±«FÌlùÓŒ_d˝êIdºÉÙ=≤Ks™£vÜBÏn™ñDé)œï$éÕS ¢z˚#Yﬂ‰KΩ–S∂UóÇ)CïÅ••\‹˘ù;¸iÒZy4+MÊ*w0“√{"Ÿµ|7˝¬Äí^≠&I∂R°˝ŸÕ+åjräk(±(≈=˙¡Gha`îŸ`Úp[∑ÿü<˛Ù˝ı{ˇâœ¢gE˝R|Ú$!q◊ﬁÏËîÏY!˜∏U§ÒàK≠ø!í*09p‰`±¶>`ÊÄª
Ò≠tRÈÚ3ÅΩ07ë»¸éÙC•ƒ7zc˚J∏¡˛Ó´ÖzYt6·„„ëRÄ¥ÿ‰KÇMÊ}2ˇÉ¬I{ﬁ=IÔw9∑ÛM<ŒˆÂ»2ºRÃ>ªÖm3à€Ù…Ωw®èü⁄ä’e≠%áÃ<1Ïà∫zÌÛîï©„?ß¨J‰™(∞Ocä«V‚ Ÿò2ÕÃ”0f¯7'¶ÛÀEï{~vU€v°√»]9ƒ“˚®ﬂ_15'"ßI•ücü≈xë∏œb È¥–ë#Y“RêÑú⁄¥:*¡∞è˘ 
îæ«Xïx–vË_eÆÿZèeR@&vıuÿ˘≈’i¡Úãø*¨˜SÎÌÄﬁ˚\ˆπÀ#ìWùπ>2É.‚Ù`¯Å<π$˜†0∫coù#|íÜ„—öFÃ«ÏSÌI-≥{Ô— í[ﬂ>]$⁄î?óNí| „dêë/ÎA¡Ís˙M§òeHÂJ6?¨Î≈Î|qåå+œG
ååüÖùLåì¥‰°ryè•°s`ÉË{p~ﬂ“«”«”`éßΩp2ïê˛‡Ëã∫ô¬˝p3ÕHEc Å°ıM“ê<NSÏ8§4À⁄‹åÉŒ0}O≥∂Ô)¸A|O·˙ûLS∏w˛&÷-Îpzy'›Äπ5dÛ∏20TnyÔïl~¨>Jd,`ÔïÆÔ>˛oÔ˘∆Êmøg◊ÙÀ<ÕsúÌ©˙[∏≠˘V≈°Ã˙Ä.E[÷]åå7”‘¬j'´ €ki„«gÄAOiÁ2cECÒAñuO¢*gÀt“SM¨?&∂»•sr‰êØ;eGOìûÀ?ëÚ”¿¿ßÑõ®z‘[(ΩI!oS˛&Ã?íï}òà≥-Ü[“èj~‰pÀ„EÜÍ∑Ö˝(N/ä›©≤ﬁî˛‰~˝…,œéO9ﬂÅ≤g~Â¢ûÂ4Q˛Ÿ—¥wÕÌ≠O?Ôû!ÆÅ”Ä”/ã[Vr\≥•9HZW˝c’4í~¡äy®≤xÕ@ V˛-À∏|≈ï·@§Û¸+∆>∞MòPåFó2∆`bÖxá˘•·&ó¡—˛1o#˝ ]íê ®X€Ø≤C./—›Õ∑%"·[»æ¡å¡ﬂ_∫+ÀÅóx4üæ˛¸äZ}˛µøµOõ2Vû_Ów›ÛV]7†˝¯`JN;Û˛#ïrÛ”Vr"µ3ı%q¶∞4Ë°Y∏‘◊:¸»QJ2…Ñ*)æ¶"ª ≥5’ê¡’ÿ’)ßˇ`P¶f,„sè@Bøj	‚∆BééëìÛÒ<yÖ\X\^9waëúô?;ˇ˙‚≤2R&ŸÈ‰ ï\ØS:ô\¶,*ZK∫ˆ≥0 r:¥€ôÍcBj=ÍàüÔF’ò¨≈QK°‡~~ªHÁ’Q æH˚çΩ«W	ˇFÀ·çßOÉiŒmÛyP0KôùÙŒ„ÒE˚ÿèâ"îiî˛¯ÙÑGñV!Ç˚tœ·ÙÑ◊ÔyÏT–V°Xî‰:B6ËˇıvfPó3´ñ‚f*che/ñY](;‚PÑ&%”¥vU7M4)ä3ï»$˛˝ı´∑âÑz]Wg=U~¨s˛ó:Ï¡ΩF,Cd2çL”˘ei¨ìlOë3ÙH\„lZ…c„SÖ2ﬁl%∆|É	àåöÁπeH=	º&	MÌ}©ì}Æ◊ä“`P˜¯"¢FD:WxuMl2+Æ ±∂∂yP§&D‹√˙r–n\Éåe∂Ë/	ö˛Ô "¸é¥µÉDj@¸¬]Gﬁ@âI´ÉD&Ñ_x¥3èFπxòÊî5~©‘˜wÀÁŒ:…âœ÷ál~≤ûﬁ0Ù4æ*∑T—R}Ó£ô“∂ç“√∑ÿÕ◊Ç!xú¨áëJπd˛é*Jπ‡ 
*YBΩ7∂°Ïìÿú»"'ô«Ê(¶;-Mf´y–≈—A˘ê¯À‰æö¯„rl´⁄(wû·Ì¯ ¿e¶˙T¥ŸnFf≈&Å≥≈ÿ1Û)∏à#"†]ºÊrV÷¬A“Í YÓF1ÂÅ‰4$<:v„lEÙ=EI@C[ÑP≠·q@ÙœÇ∏~*Üaª––ﬁÂº(ìÑúâåDÆ‹5ï⁄ﬂ‘èÑC@(¥ﬂí B/é°FΩZ±ˆÿ+ªdí˛“£ZO˙k‰ ûXıÜNF^h\¶ïN–ˆßé˙≈Sı…rPY.Üc+¥jö†√UHìg~›Ùé3ë⁄[K>JmXGÑ® æµB<N0·Á?˛ˆBy‚Ò!w•¯ÌáZFçy)≤ñTÿ˘_∫m»!®ºf©""-E·Á/œ`?»¬•¶ÒÏ i6ÌrÈt√|˛¬9•;+[Â72Ω#óìdÁÅTˆV€ÜAóû!ùÓ˛,®t©fóSπV»≈L∫˘Kô'Ó+ıL^?¶ñ´Wi“£úñê*?ÖyÎ6⁄°º‚F⁄ï]“Ç°hÛ<mÅJ…·í2yÖ,µÿ√œ›o|Å¿õY‚æ8Ó¬
Y˛«Âï≈3≈sÒ:C#t©§¿rŸxUÇMU\u£QØá˝§Â≈≠x⁄Nõ˛ò Èä39§M≈V”pÛZ£˛]µM9"8]ÒõnòQ	˘85√A]À;c>õAS¶¶T8mè:2;2U:0|á\a,¢Tny })<÷≠BO´	,AËAoUü‹˛ò»* 46&$√Gl*"2∆¡¨’+Lê'˛òùqÔ˘ÏWd-ÔˆH3“ú¬“˝uMÉò"ænüÈ§›√∞B|†Ö“âƒ∆ π√I◊’œ„¨Ãª¢l._ˆcí»Q=≈ƒ—ò9ıp$Md„Äœm«©ÛFp∆e∑”˜◊Ø˛ã=á¢2ø¸¿L”y}Œ≥£kQ=ƒ’Î¢¡jSÆ∏´H!çØ–Yˇ:jˇä{~ï¢’·‡\Z>'NÕ—±§Ÿ®ÖïâÉdrbtwÏ◊	Íê>6#+»–ó∑ªÑ	äò\◊*0y±Eˆ⁄¢ÊßV›2?Yxwén√d!-]>kÊû+iqJmN}ö?ø'|Œ°∏ÁœUNÄâ*SsdÈUR/Ÿ`BK
T|ÓdWt@æƒr!Í“møP€‹gëÖ˜QH,w«˙6âìä±)Q-=ä√ßE2±ŸîÍKo1ñ˙V1¬#·â~ÑèÙ@=∑S·V‚˝är0›◊Líèy©^q¸Å(g¿⁄˙@¬◊‡Ñ˜x‹2–#¯ƒbR.√›‡ùBd·ÕîRïB˚?
ËÂπíá „!	⁄¶PµGÒ8g6π◊∏J3F?ˆâiKbN⁄Ωu3Ó6”hsK¥ˆ7í#KÆ®Ò&{»æ¿¿ü∫-ˆóHa‘∫©çÜ◊Ô∫á@]QáQP	a&Shb”JıhH#)ø@·çS—Pÿ9v±3<1ƒñØøM9'¸ôçûUlﬂ+ñwm^ôcçÍÎ>*®’¬N˜¯∆ùùïA¢n.`O§%9∏† ª«{Vπ§Õúê027!Ä§ÊCñ
q#’≈¸KÌ§˜j<qÃ…h+ﬂËuQí?\$áª-“¯”\§ÆIù≈ã*}˝?∏∫∂Å -@}âX0∞ªØ⁄é:+Õ∆±»ÿ¸ÕF“≠÷√Z£4	˚“†î™Ç∫@°˙ê~ú¯“¶íNÛÂ5'ÿ Ó)…@´¨[Î¡èQBà⁄Î'îıH†˚ç?j¬#¥˚S7åÜÔÀ£„Æ¥Uh¿€
A7Füâb&¢ú£-ÁlíV˚]7dj+~„#¢p$>√<+’ºÑH+_¡4+"Pä#Õ=_j%;˘àn™πM30I—Ì?ŸÇ•.#(iM+* b•©ôÏ	‡wrßÎN|∂åp…•ß≤ÁÜA_;iÍäoum¶¿%ì+à»Ø»Íö-˛jB∑∑yñÔÿxd∞|úΩW˚¯XÃöymÈ¬‚…˘ÂE≤p˙‹≈S‰‘¸ <˚∫tveÒıÛ+KÁŒRmÎÃí¸{Â‹π”H3CËM$uµ&’»î◊43“Â0!^°'⁄!ß≠ÄÂµ…sŸ¨@jIâ…Õ3zÎJ„E€qû +{§≥Z`ô»¸»YXÄ)?Kó*J gÈõó;A|©&¶åzò ®áuÖ∞$A›È5ì`ˆ| 3O∆í“7◊6ˇ˝ıﬂﬂ“Ÿ?o8utX˚-≥(|dÊf|≠áf÷£Ô≈ ∑KH˙ã7· #√ó?ÌÃô°C¨3Ô4'ìù∂√9Qﬂ}ö:âæïÜôíK*Qª÷∫a›5ZßfÓX(;Œ3@ÚzA’Vµ0ÛΩÓ•<°…$Õ®Wg?3ªY
G{%}Fb•<ƒœ∂/π@≤Äey‹©Hwf_z`ƒ±Ôç ]Ãp!\£√›PÉfêì¨rVo$¡j™26v›\Í!Ø„¡
8‰¿jNˆÏî	Ò1À2 XK›ócûã®Ó—ËBñîÓ1£∫yÁ--q1yõC»4#yn“i¥Yé»Z„≥|¡-ñR:µÌTÜxı)HØ≤`k* ≈¡˜=√{ƒaˆT–L»9∫Œo7¬Õ‹£‹€ú.Å"Ω „≥A´ì6¢à¡vÈ1Qè£=6z±“©•T1@ﬂ¥It‡ƒ˘8˙5ù;≤t™.|7»&·2$Ñ|eiÇØù5¡¡XêÎ˙Xáøv©ÓÃ¥Â©qˆÃ(å$
$≈Ù§hûÜ]HÜ?naëÉ@”ûA2O1™&∑ÇFª‹¢ ‚∆Öh	ÚZ¥ÈÀ¬,Q¥+¸˝œU¡¸ëTÁÿ~AKR∫9Ÿ´]
ª?%ººœqÓ$gp@Çrù¥,TEìP£Z
r.∂Å%ªCπzî’ûŸ,kñm«iË>:À,⁄>ÉAIπQùWﬂùnó/1+=⁄jC9Ù˚ÎWˇ9s)_ÆƒhÃˆ]‡¢%-ADÖ≠!_LOÚhIπ4ØmrÕü∫Æ·¡zÃ©Ù·K|òôAú>RS2Gv*ÁVA®{;hˆ¬§bëÀ7›ÓÅÖ·ç7G”Ç…*/W@~JV°Ê@Tπƒ§π“Í84´{	π∑ßK'¬Ô(œ∑àŒˆë	ôã—â~wŸHJ”á¢8ª
Î•˙+/ç
ØQ¬X@R>ˇ´€VåM7}⁄Û©ÊVœÒ4ØF—•V_⁄˚©Vozûß[FÌ˘l´ê•Áx≤AÇ^è‚F∏˜”ùæÍyû§∑∫èsnºÌyûˆv‘m‘ˆa¬≈{ûÁ©ñqÉ{>◊*@Ò9ûlà€¸UÅõ{>›È´ûÁ	ØEΩ8Ÿ‚∂u›1Ò"^HÔyûÒ≈˛j£≥≥Ω˜ÍéÒ∫Áy‚É^Ω—˝U3ZﬂjOﬂ5lÇ˜yºıKv¶q0ñû;ªX]Y:≥®A≥Ê‡?ÀE"™¥≈uEcJ|êï)Åâ:/ë—"`GºP?©Â~ˇ?E–l5ãÛ+„J˛J"3®ˆ»ª Ó´úká’n£í3çıò˚¶V¢®â&úC™ÚıüpÆp`t6:„¥Õß*_a‰>C–ªlfpoñ5;éâ£o˘ﬂ33+†§¡ºJDÖÅ1M+3Ë‡úU¸Lb†‘{ﬂ·?\e`U∏Û/˙˚Â¥Zàè›äˇæ=º%,Ÿ‰@√î¥˜z2CqﬁíµHt1ô·)ÏΩŒú’á’„”gOΩ î–—8‚Fºb# 3Çm4úX&‹ÜÉÈ ‘¸[öèÀ>'[BœCÕóÀ)ìS §É'ıu$uÏ(ÿ$î∞]Àe®v≠JßêÜ[›ˇ
∂cFn∫}ãSåßpJÃÑ`˘C¡'á“—∞âAì™P¬@µ\ÿVJ,H◊Ç∞xO®™M3(ÆﬁK$ƒŸï€’OtW6æã109ÒÚ≤Ø¨PPF¿0◊˘†|ÎÈn¢Íˆr&LXêÿ+tÀØ€È!Ÿ£⁄6nø∫£^›¨TåÜêY(Ì`◊:¸{⁄	¿tÕ#òGïORG5:∂TähÃJÑ¨6GvZr≠¯RùI÷á§◊1>gÁY°å-Ø·Pñ⁄$ÿ™nTßß“àÌj–ÎF9!—D–+7T°J’A“®oç˙ ≤¶EYÈùª'vËCªûÃÒxﬁ¯2X∂∞ìy]Y0ÍrØ’
‚ml◊®°ä[ãÓ]»8‚√ºœÿ@x°¯“®îL¸àñaèëëª|)Ïä^®ßx≈ãa““æjdÏ‹™Dj,"¨L®9èíª«Jq V\S6~†,5ó0`¨cài ãP«@ßM∫A´ìZ9VË%€“QrÓ˙œC»qõUÒoµ	§:hVŸUQY?|rÁ_!ú¢≤ı‚ZòSéÿìJ¬∞ZŸô∞∆ΩïÜ}ªü¢˘J≥˙¢;êáö‹Hai{3ü›®4%"—Ìe æ|ìœ–¥BKı?õµ¢H©À|Ê¬°ûK?jêyÙpÔ¨õ»q‘0„;Q®∏ypd ∏€∆Í¢ûƒëe∆Q°ﬁ∂5‘NL‰Ã	Ä”–”Hé:„æøbAÌø„°·Œ,ìFl—≥E6Ë¸‚h_Àà˜«¸çiπ≠{≤o_+cå”X˘W-∫ﬂŒôqü•f˙≠J†sS&iFÙa$‘¡À0˝çÛ)O¶…â1À.*0)ß»©≈SKÛ+ãß»Ú"Ûèx*2)œOUm≤“ÂôŸÂôZ◊˛‘*4±y{Wüi»±˚TüI4G≤æ¸PÅÊé0s≠DSÒ0Û2ıö…#à‘zK¶.óµã¥$‹ú Ã8s'œ˛˝-Õôì*=¨[({¿j0!‡–£¬C£¸^©–p/¢ó◊œ\^x1Á•(óÆÂ˛ﬁa©úáÖL«xí∑g≠ùƒ@Â∆Ò9"¿≥˜%ùLF£ú√©∑d^+Rc©XÄz©ÙÅ| Y”Ã`AÈiﬁ∫°áßgñ≈öŒ@ÉÜ•Jø&Iœò £º¡J>-w√‘ÆQèm6»EW¥Ëì-	∏≤øQÖüÏ ŒAN¯åïQ´<¥Z®B#P®ë–øPëùœ 9˘1_ö+un©RåÖÛË*ôgˇº@QØù€G*ZBÒ-X˙]˜ô∆ÚÌŒÚmëÎÿ@‹˘“àO±ì≠E˜–åº¨z†K9l‚Æ¯é_u“}.¶Ømù’Ëˆ‚`Í-2„èSE‹Ô|”©Zmı ŸPYÓuI€®m¨ùLF¡ÄÏÙF§5vp›[nr©|ºu≠”∂;CÄ-±Bﬂ„T¥±F™|	òh™ìì˙ ‹iT=6!π©T˙Lt;Ìp‹hXOîû
ªA£ô¿»êI)M©=;¬ÁÛ¢egiÈQtH˛7Ç¿D˙é∑ó\Î¿â
√ à«ñà€•üæ\µÀa3¨Â‰™ÌÇU>©≠Ì5ıëi)˜iÊ◊}ãÂS◊‚ÔÎﬂq:5a{Mˇ?   ˇˇÏ}{s«µﬂˇ˘MF◊Xî	 AäÑE™@ îÛÇ¥}ã•
óª`Æˆ•ŸABï‰î¬8ä£rhââ.cZ1MÚJ≈0U2î?®Ø¢“∏˙È”ØÈ«ÈûûŸHZû≤)ÏÓ<zNü>}ûøc>®J‘Ù∏7jäAÊ™Gïäõ‚˝2ÂQ∞IÓ∞ﬂüñè}zì·PˆTç•Ùì¡e’:‘∫˜Ñ.âoÒ[Ú6ÎˆÕò& Zi')ËÎ¡?·∏eò…-≥·éá\~ï¸-6‘*Ÿ(«6&€∑ô-ˆáª∑ﬁ◊¸ÙX«Õ%Ô_⁄ì Ë`@€§Vp÷r˙NÚãS€‰ß∆b>'øˇ_∑¥¡}*ö-±éJ€Cz^€pqo £XÃº,é¿ÑGŒÄ8Ú°Á¡OªQbÂ·≤HÊ≈§Ae“p#.ïRCµÅπcÒcÆ«ÌãPE.„ƒ<T˛Ík%q«sÖ)6-RDyîp0yKG¥˛ñÿà…Hv}Uáû–«¸©øaÁ¢Î¸πvK÷>Õ®+XÂÊ›Éı83ˆ0Üß\*”+xN¿·rhV¯∫2◊j18M2Ëjﬁ·ó€Eı$äÈ“§ÖIä|.x˚ãÂuaπ“£*1˙H ä—™Z˙?,çd>áÒˆÃG√∑“Oï!‡Ÿz—ãOD˚Q¢‘ƒ/ﬁVí/è¶?‰˚&£#AÉò0Éß&Èâú<ßÏË9;iê’ì[¶<'“2,QöS‹	á◊còeàyda/ãm¢TqgúòfYµ3FÍ…˜¸ÉQ6Á#E∞∑eŸÑW[àHWHÕ´jé£ó:w›çy:1›6CEÃ⁄æÃÔ1)‰§Qß;§«xÆ∫j©L B…˛Wblê˝Xx2t•°˚o´÷àmqÀ‹Ï¢<∑—÷u∏ˆ˜ı´æwØ˜7;‚ü/1…`)_ΩµA∂ûåˇ,tˆY=uøvÂÕ»≥UÈBmÃßƒ=C›{—jÁ7l˙œßöúúålêmhBeV∑”êåÁjü ıçz: <(ÅU~©´&ÕœÛìΩz÷Oöp˛2¶'cH≠›_-ò?˝‡Zˇõ°≥‘ÀíÎ∏+î,˜rı +fÎWÇ˜õîÎÈ3∑ØÜ¶öêÌ‡Ø˙êx≤bçS7xß{(>^?UIóπVBrB¥©·>:[W(æΩR#Jû-ˆÂ&¸+[ñJúVÛ¶≠)æ§Z(*ƒ˝´îı˙ÎçF“Ôáƒ6i‘ç5RK≤lñ‘;õ>ÅÌ%¨jX˝>Fπ0Ω˘∏„/ˆg)°Ëx^ülã⁄¥wﬂ%Ç;È◊„€nı¨Cøø€J⁄©∑Z·%o	¬ïz´íÑ>Á!˛=z£mí–gnåä¬_…mÂWSÔ^-‡ØE∂ÏÉ˜s¶·:ÆhJÃ˛apf|,£+pÍ‡∞Zì«„ DÑl(ÎéMØKÎÌH-8iüWp«∑y®–X˙Ö÷`´uv,ÿŒ1Üô˛j~Ô≥9<´Â'^»∫´t,}÷K∏ﬁbhHl∏∂RıÎë -®f
jbáèQÂ£<ÏqU™∫ùQ†ÕyíiObÙ’€2üOLΩÌ.W€˙¸ã>‹xÕ9ñÁ∞Zµ»¨‘ñJà√ -¶C®’˙¸†‰;≈∂ÙÛΩÑø¿¶+Vßö`dL<hDU#AÂÎñœÛóO⁄Ú>°
á°É÷ÍT™66+ç=,Œì€ÉÌºpÿ)Ÿ–˝ùﬂø˜ˇ
Î>e¡s…⁄o∑⁄Ôz“Æ⁄FÁíGËˇ_ùç-É..Å.(>^P˛\,AÒ‡~d≥ªëT;∏Óu∑v⁄EœävﬁG≈ØîáﬁJ•˜ÿÃ Œz}Ÿªs
éR~‘'µÉQ0¸Ià_€_òı¶óŒy¥˜ÔÔ|PÏ.]˝çïD¸2…“ŸÀÜØã“≠Û¸^{=ΩƒhI*π#DU$œé®ÿòº´ÃjËõ∞KµÊHâYQH∫pœﬁ∫ÍŸÉçÕå≥òØœå\XØ`&ûC8√¬äœ§¡9y—ï/∆i3S,Èé^ÃÚTÙ+Ÿ⁄eÍzçkP]›∆à%0Ó‘{ﬁ@91Hm˘Ú¸¸‚ÚÚ∏»t µ”sKg∆£ˆ¸(7†Ωëüß´k-®X¬ mF 8£ªï∆∏º}’√9†ÈKXúˆB‰iŒπHçΩ›í©⁄%pYACû~ Æ¿£˚™ÀXEì¡.ï€ö∏æƒìë∏Djˇ^ñ÷èb¬rk%8i£™Íˇ€ú∂õnˇykŒ.C	ˇ-∞X‘Ä;AÏæø≈y‚~–˜tp>aHB©ÕâF{;mÖÌA™¨0ˇ∂∫Düñæì4…|∑’ΩP•Ÿ˜l†≈˚¨—nÌ®èé·,ó¢]™süŒÌkû\¿Óﬁ˙O!≤j‚}·‰ó¸{<	Ê[i=‹ì∆Ñ»8€©*y}¶≤cÿÚWT>ï%ı∑®€üç‘àÜ‘kÜË˘e¡¢Íx*Ê⁄Ã∏«ìÂõQ›eÎDGº™÷ÊÀSˇ.Ωî’w∫—@ˆΩhD.ﬂ‹´"Å˜¢ø◊ãF‹j-Ω*xØ∫zΩhDÆ‘»´"ç˜®ó◊ãF‚ä≠§*yœZIΩhdÆﬁ¥´"•˜≤o◊ãFÏ*≠∫*íyo∫uΩhÆ‘†´"Ö˜®G◊ãF‚ämπ*yœ:sΩhd¢5TUeyó∫CïpxfL∏qA»úÖ 0t0†ãiÂbJ"Â#ë9•fòoË≥Uêë®:∏
mf∏»'"EÔ˛}Òäv«ô'VöËËÚéŒÚÿÊ¶ñﬂï˚ä •ﬂ£w≥±*nóB˝%+È‚c¸œ˙(’˜„ƒË3FUíEyˇQîá;ˆ,¥Æoy&∑¯π‚s,òÔÂY~'pÍüIÈ¢˙aâbºí zû$+ï)6ﬁaî{
Y√ﬂ=∏ØrŸÒÍ9˛l√ÍDA$ÂM`•r‡Hû¸Ä2Y\Â\~_Iøëe`¯π8}RÜéßM9ˆaıA¢Ù˚wXºæ<¥`% ∑Mòe•OŸ«˜%ˇﬁ€©ü+‰+ﬂŸç>ºõ¯˜#Û<⁄&¬ yG£sñ
t%]˝¯s[´NËMB'€!nªË∆∂_öy(àå|ˆ(f˝“–?"`0Ú9(é¸¯÷AqLa‰”∞+y /˜,ƒ8√G>ÒﬂLDF&F>qäﬂ|/F>E1åﬂ«7F>	Öaéﬂ,ƒÑ@F>ëêﬂLƒFIFoDƒKÜ»£‘ø¬‡+ÉıM[YúÎ29î»ëx]û Ë…óv,„ˆw˜ˇÃc!ïÄÊÖì√¿mˆÔâsg?âÖ6Û√Ä™X61b#ñ£(–˚äcFêSÎ≠∑dÅ¨ƒKÕŒvõıñﬁ˜
Ä&¯â‚ºÇ.WÈç§I“N?L0hvÂ~á ﬂktÒ5≥nè.√ı˜!Z‹˘ΩÔ ü[≠≤§«“‡©®î3,Ö^∞•ïÄz∫_±Ö™∞Á Ì{ nìW« 'öÌ™,h·lµB4±M)Xù•ﬂë/vç>©Q™ï˝æ‡nt{éâ„(ê÷ë›®†j∞Uo›#r•äPÑç8Å4…≥º≤ë∞áz≠@^•›JÍM®ÍÀíVù≤øGŒπHc1›˚>‚B∆Æ‰a¡d.ö>$ºµëëŸ	!YaàaÃVu‘M„ó<c$ö;∞∫1qR;:k«^Eªâﬁ5˙9ûr—O⁄iŒ¢9‰?⁄≤Í£˘√ŸËû(ê0ã`nıí∞⁄¸Ú/Y√û◊…˝”¿œµìH ÓÆ/º√˜≥œ%Ø¿^8ÊI¯@ª=í®æÂ#ôëëÃâ<´G˙fEÏ(W¶èq˝6£2ì˛¥ü“A+9aj≤ËÅˆDÚoKÈé.h√ã¿˛yyh$hz‹ä»˜øÈ)sØ;Ê–±œÓ◊◊nÕ¡{üà)Qıêì≠§≥:Xìö}ue≠(õÑAåÔ˙‘H’®[i¥∑µˆw"®≤†“∫äÌwé:›ìË@Ã∆˘√›ˇˆï©_†33_ll˙ÚSñô[o~≠ûvƒíìd
D‘Cñ#?%¯Ÿ+iãjùµ ˚rÉÏÉRıπ3g∆∆'ˇ©õvj‚jh`XVÿÎeÇFæïßà‰5ﬁü)x¬œ¢ŸcÎjŒtMN{ó#ye≤≤¥ôPy8œ=≤õ∫ÅZ¯Z†1»±√Ÿ¸#¸Ó¡'=N$©¡ç/IçóÔIHÆ∞˝ïùÇù¯EilÇê;…óºÀX·[âﬁxOY±p”yBf/~%
ÈÔøŸI:ê<B◊Í?%ç¡‹˙†{∂ﬁ+¡!≈Bù¿>Ö¯√˜4Œ0◊øeŸ_wâ›OT‰ ÅnŒ˘CÙƒ≠\2	‹É√->`ˇÚ$QÅíÈ√@Ü"≥Ÿ›wùÛF¿[ Ô"óé÷Ô·%ûdßªdæï÷Œ◊etÍ
¨6»“∆ÄŒ{‘4HiÏÊ6Ç’ÚlN”^)b6ÙyœC"Ÿöæw|tCÌt;gFé~w°>Xì–∆ÊÆ’ŒE‡ÃXV"˚ñ˜‚≤s“ÙÖlw_í=ô|mÆò«∑-ñ◊“§’d®™¶´Dks•ö;©Dÿæ‡˜ü˛	RÕ∑Ç¥ ¡}ï√Sìòp¯ñC£âŸ˚¿Øi[¯∑ºÈâlÉ	m"ˆ„¨ﬁ$VªÂ"7
k©R›ÑâÒ'∞e.i>âÆg⁄óè…õÂÒ›Æ[nw∞e€Ò)0É9òL•_Ö¨pïIÈs{‰ö Ab çßm∂/{ﬁ≤0âRŒÓ=≈Fﬁ∂aæÜa#°*Üs’Àí^=KÑ\πò\Oìµ;0'ÓÈ“o—4ïNü-ûπWÅP Gú>3sﬂhK˘˝àG/rΩGÕ≥!˝h§˝≤¨≤*6âòW˙ÌŸ¥ﬂfÄ£≈ÒÉ¯ïÉG*Éìô«Æ?~¸M_¯¡∆#≠éÄø"„<${ÑãKPπ∏9qL@¶^9>u}ÌÕ¢HÖÒfÛÁ‘0OÏúààFë•bT∫∏xñ#&1;¬Å≈Pp}‡4]ÂIv)K¨æ-h‰dØj[ÃòÉØîQàt„ô˘ûÍ]ÛYÆv0◊®±¯
Tm…£âô∫∆ˇ¯`ë≈IY∫D&”∞(åÀâ†5."¢ÚY^˜La¯‹óÔ"P¢ıbóQêO’ø<„U6ﬁŸ‚—FﬁÛNîñUËàÍƒßO√2ëÙßyË‹ò—›(º±æåkE$¥wKâQÁ∏≠†±—åR¥/è∫ ú^@«aAsù ‹ !…Ø„äËJëp¸ÀN≥û5ÈŒº∞Ÿ©∑”YﬁÏSô!wÚ4ÈìSu¿Ã.‹ËkSøôRY31ËNdd%Î∂ÕˆÎ◊”˙Do=Îµ`)(3=èÓ«â¯Ÿ∑”a=<à/ƒÎU\4iÔUÏñYΩüÚÇ…fÕ	.ÂPπnÀØ-SÖ¯≠%øœ¸ƒ*1qTˆT^óõlùÍÕfä%TÓƒb8d´ﬁjq÷…9«4j#›1ìh∫Ë˛∂R‡à∞T‡`}ä∏+$Jﬁ=	˛À–„€·÷MºyTÛUì…	Ë=”‘Ê•éÏWkOfıÌß§=Iï†’d uÌ@ˇô,¨gù`Gõ………∂Ø9uV©:+F˙:£Ôˆíi
ÌòÛ©ë%t$ﬁÓjp@KNØY≤è›…{Ú∂Ôm∂«=/äyp‡hU:
JàgƒÛ$S‚+#ß#Z„⁄»˜ü~ÊıπJúf?∑C>¡Æ‡/÷2™mq>U‹(ô∏b∂®ﬁ§ÁEaä?~Ã≈Ò#Æ»›S*˝Î?+^ëJËaﬁ–∂⁄K•√U⁄§Ø2Ál»tÊ∫≥ kPëËmÃ;J0÷≠É^√lÊ°±Ñù)Ï5…ç8'≠jñIœÙ‰x}≈ÒSÓΩo;-”ÿ√QïøÊ' âs	‚ ‰ 9C˜Ä8ﬂÄ°¶v∫∑~8¬|Ωq…óW„ ∫≠ª!›⁄—ÃRyÿ…V*ü(Œvë\∑⁄ñt¬w•}¸1÷Æy(= ‚HEëI˝˙Fj¥"e·‡`>áººÂÜ±„Aq	'r7ÿ∂±Ø=ôk„⁄®üéæ∑Ê1?ÒŒ™üy‘Û≥ÔÀÉE∫H?(Ì˘ãET  @;√a›îÄÛÚvJÆR¿5b©Zrï∑πn7¶ÔR5Ÿ¨‘/Ÿß∑√–Yï≤yÓíÜ8e÷Æ∑“wXÛﬁö}∆8ÎJaûÉ∂ımW¬∫ô˙ız⁄96Ù¸ÔßáK_—a÷§√œ‹>%BÔ˜µ¨ÚoåÏu”f—Ê∏u’6«{Á:œ›µ#˝0ﬁÁ˛l≈™^Aèø—‡·ÛE˛°ŒÈøûBzó»c÷j¢®bÆxrÓ¨¡Ç„˜ﬁæä_ıJTp√„¢˜¥‚∞z◊ºﬁﬂ·ånq[H |fw∫U-¯âÌπ2hü◊iEjcÇvåÕ‰ßd⁄◊ä5$ˆ=Ô·ã˜(˘†Ä◊M√~Ñå»ì&E÷|ã»éÊﬂŒãË»~ög∑ˆYRA“1ûàê:îxÜ%%ªVÅï{‰Ué|÷cpñHä-«O2F.bXµRäºÅ<Çw-ìSfo¨≤hN–Ï¨„#ôµÀTúDµ£∆T(¡g⁄˘§J`]˘öü±ﬂäP•©√Å∂Ép∞åÅnkΩ›!”≥d±ôòi©g¿cên!æÒ ı°ãÍfIÀW¢åöÜxQ]~Ñcdk†{?∞¶¢w Ø˛5s‡=Äu„6Ù»ßâç>viß∑>åï;Ú‡Âp7?Æ◊[Îâ–›,KÉ§µo1G‡ZΩ≥J/Ø%AW ?∏“Lz≤–∫'ŸÛ˝.n8‚â†‹2-_(∫T‹K◊"ˆn≥l0€T µ}nF~xúç‚µê‰,Ï∞.SÕ≈®bHFZÌJ∑±ﬁüÖt∫èkTÃm RNBÛ‹£∫V≤∆“NÏèueŒıﬂçG¡í2Üd84KÑ›£,πóJ‡7y4Ì`Ä¬√¨˛~(£ë€¥pGæ§;…Ü≤·wgaáGAçÀR≥ˇx·U⁄¯¡π F‰pP§
~Dƒ˜‰QÁìá…	≥˘‘≈\l:-ÿÊ◊∫i#ôU$4ΩÚ€+So≤‚Gê¥Ë.S¯po‹PùPª†e;|oR¸ºó˚@©= OHÎ†±W!
ìØu{,¶¢/R˙¿ﬂ'ŸøØ‰ÁÑ·Ü2¥G‰oËÁ,ô„-Î8Ôæ\€Õ&˙˚◊“º¿3Ìv4kÌÅTY°§hòù'2Ï´ˆPhÎ™/Ä*}”z¨Mz%µ®lNVòX◊z]î¸`€èDÛ>∆2Õ=ìZLYãõ±¬£y°êﬁ¨Ay¬y‡î	¯=ôﬁ~Ã]ãL8∏y ]›êﬁGáœß…ƒ+ çå˙>ı£û	sÌ°i—4uD&˙o
∏Y‹(|õúÈ˚ŸD∑”⁄Œ´ÛÉ«ˆ=A˝†S@¨–óeô…F__£[_eüÔ*3'˘˘¨µÓ˛·v(ì€ÿ>c÷ûˇÑê"ùÍ˛5ÄRj∑/4˚L√œ´±áÈ_“
îvTÉ+TÂå¿˘w∂âVÑüß@√F«~ËiW¶öe‘¸˙c¢í!ƒÙaéﬂ≤É”¶e÷Áâ⁄fs–/∂‡0¨Å>2…ì}	å”óX8≈F„° CqAT°øìg|»TÂC2√.∫ê}ü9˙W-àÒ∏˜
…"{h®‡@ÙŒj⁄é(˜cÏt∑ÀzØ±Ãƒ~â<3®<È4U—poêw`8uiªZN\±ÂÔïƒN7ù”iá9Œx1Ø“Å⁄äHyD∂∑.5ºdŸØˆ§ÉáºÒ√…àä‡@HóUà†Ö aW˛«L.}°y´ã è<—)<÷Z◊	ﬂ¡√Ú¸‡
Å¯í„ÀùîŒYøﬁí®¶¥· Va\;◊%ÈJéFÜÛ€ﬂ7ÆW7ÿÿ©ìiˇ|/ÈTÆ8>Z≠‚Xñ3w#Ì=Ê©Vü˚<1O!ÀÏ0ésäÿë˙‰Å· sΩ—H˙˝1$Ë»îì@Ì≈»{n‘≥éfèJ»$˛nIñu3„^&@—´¯Õ4Kÿ-l∂çW‘`›*†e˝ÄòaÖœ f\QÎπ±"‹ò-R~„aÔ+8‚ª¶ùï.øÈ©n˜-&‚Óä–ªÅÜ´™õ˚ùı’˝'Õ4 Ìh§[≥|˙®0:\Ã>¬§«k•ŸD+Ì$Ö†ﬂ∆¿⁄îÁÍ´àŸ9:⁄b‘cDÄA!ˆêSlœÚÄyK•ä
•¢ § p©èä^TÔ4í÷8¡æ≈1SIZÄêÊÛkîÕã´‡”¬wΩY¬R_∞5Å]ƒÁÁß±‚¶Ø1πFÆKÙV‰›w@ÀØ—¢¿Y∏VÎV⁄Ï`∞‹§ªbÛÅ¿ggBleΩ√IcæP7z-ŒD€úâ˚ååµúÔÇ>TCPL6.è`YΩ7Í™.•dx
ƒò>ÇmÚe4„iRsêèígî|é´õ˜À}èï\bIÆ/ﬁı|Ë7Œ⁄⁄ÇˇìÇ6˘O<Õ“YÁ#GGÇG®†ÉÜÑ$π—k’;‹:i€¯G	?sëûS“·Ì”èNôÜD°Ÿ·+ñ’aZ+›¨m•€Y^ø÷N^p¬§ }ﬁB≤R_o\√=ƒoì$Ôô	eÒµ∑·~oK«ÆFô…∑óöŒm@0æ4{õı}\Ã©‹«Ñ ÍzØIﬂï>Ä^Î\¸rÂÕqÊ‡LnÑrr%LÙí7ŸH¶Ä†Ln`"h÷∏æ¡”[∞}X‹/πÅ†°!"∑€πÃﬁ]¬]◊Ä–Ëpl*Ã*"a∑a∫[nLØç°éÅ±|ßÕùüò	— ˙Vi4@∞cUÉgMÉCÑßHâå5,Ê‘≠u®%Ï:)çœ÷TdfÎö[€≠UﬁÄá™…ÉÙzÇ”rg≤çjÕ@◊uK°FHøpΩí=l∆“^π~≠ﬂm≠CDµÀj¿“’µl¡;O`ºÊíù}°Z’H/	2«ÁË˙øéqoyDu|¯|⁄Ú˚;Ò}≈©èx/√V9‹ÔÒö_úù-œÿ3»&E°é#Ø¡hÍYR∑»ê%oØßY“¥øÓnÙOl±ÁKƒ0l)büÊDÒ,^–cl2í∆ï9!•å(ãü±èX=Â}w{S1&·µ3êÕ÷]Ä59—È2ì≤(€Õ‰&õMº·Æy¸◊f:È«\Jáå•
ì’ßùa#©Ó≤Æ¸ëxÔ˚LpâÉæg<áÔEÛÌ√Ÿúv3ﬂ1J=Êâtìˇıª˚ÆÏ ÷ø m)J?úªº∞tâú9ˇY^úø¥t˛úÆBJ¿ı‰R˝WÕÎÎî±&Z›’˛XÅÜpﬂb ù¸à≈¡~Â*ÛÎ8G¸“Ä4Ù…ÃJm∫M„,Évsñ˝∏≠v¨Ób¶Á9±k_åN_ºá0AÈ£ œXU1{GÒïZŒz“gQyØ£5|*‚v3¸	yˇDz£∆[  7“¶ßPñUû}∆ñˇ]+î´müÈ∏çÍ€πØÒj&ıÂ∑8⁄‚BâÏ.b¯!5≤ﬁE∂?Îœ¸–Åú4“b!˝µ*˛⁄!gHV/IIË(D%∞7∏{zï}ƒÊÄ >¥Á‰)†9’Ê`≈ì3›U;◊Åjáú˚}π9⁄F!Úp=ìãH>6ar˜Ä⁄Eûr¸y&…ÑÀ~![`ˇDˆo|Oì œrÃLõÕhvÍ7R%W‹3ﬂL4…z®ºüK‘ÕGí{Óq0vıÚ8–C’¯ÒK?s¡/ø6Ê’éîE*.¶2 v5ÉaÆŸ§l»]}ÉlΩ s!Ä∆&ü≈@Ä]2.‘@pAx»ÈïÄÿ¢óó∆‹º–Z«q|_&M¬ıü⁄‚WFõO ·:ÿÃMRœòX†”—.·â‹óŒcÙ4"ûX2Õhå*ª≤‚πJ&xÅ«™6W¥•6Œ«lä˛ô_ÃSßÉ"ó„9 CΩÂª&CÕ¸BtZ‡/+;3>¥Ã≈/%ò=Á/˜ºØ∆÷„”ß≥á/4dŒ¢Óæ7Ã>Ó≥â!ë-ÚºTs\6Ï5ÉN~l{ß^:ƒ—ﬂ+±§{˚¯ÙE~È`¿©$y‡˛–î”êDH≤ê´*Ωò◊kó≤z-˙¿;„A-œÂöòeØû•Ê⁄/ ¢g>ªe¶,S˛n¨Qk¶IN≥BL¿*é∞WÑ=âC990 ◊Ø`âd	Ää`∂»aRåˆbKPEPò˙h¯1<º!T˝/¸GÃ∆‰cqWKÓ<JÑj0óü^3]CàÇ`ïõÓBî∑J›‰ÉÀê—„&ˇ1á(∑È˚∫¥˝Ñq'˝ﬂŒ¶ìììA7ÖÙVµ&é0°TA o–t^›–ÄçÃ0veGñ¯V±´nÔXcvA¿m#Jym[…
dæÇÛˆ∞iMîˇ;|ÂÍ¨∞ÀzÜ≈HcX£E‹#Õ}—¸ÂE"∂˜À:R∞˛⁄#S=Ω à=G\ÇÄ,óp‰TôÑhtQõ78¸&4	Eˇ;ÂÔÇáúy$˜g∞˙Ö6CÛîöœS±k0µŒ”¥mÎäCΩ-í6g…XΩ’¢Z+ØëΩçIc∂ù1L?◊6ìV’⁄ÂÜ	∫ˆ⁄zÎ-„ †≠∫ìÃÔ7ÓÊ5åCw‚±8„>Ò£x›⁄µyYaË¬‰FΩm\ÜòÊ°ÎÈ*Ph‹Çõ>wπ∏]‹¨%ôqÈ“Î§;´æs¢¢o≤»Ì
^ö‚[¨8e≈ÜXQ¶¡BÊÎ∏w&u˙m8ñ‰ÇÅMk+0◊ı’ß‹VA¶ß
≥në˘ôaò•;Tç©¨q_•›$—Js¡±aıèhÊ◊ $cõâ\’RÂ¢Îst‰_¶…F¨:ZRUR|-m6ùûún'§CAÒwdB[Õ˚àãAaŒTÙÊËV*«îï[wÇN‰ìà$’î&,Ó'§vÃo¿[X€‚‡.ISô–V+Ò2dÙMÑ◊ﬂRTa9*Ôïö7g¸öΩ–_ï„‰â™7crtGy‰ı˘ÛáÿhQç√˜ﬁL `µÅ.∑M2rÈ¨4:¢(sjé8ûk _z¢Á®.hJıQ’;ØÔ√|¡“>º•ëÎêó},-’ñºiÂAº…å`èOÏ∂MÑ œ_∏ó†¿zy∆‰_cñ6[–èi3ôÿ$‚è\ËxJ˝»ñ .ã¬ﬂÍÆ˙|bT˝#◊ÍÕ’‰=%ÿ†◊IS√‹Gpø¥%⁄då2ﬁEOÇú0:&-°RË°æd0sÑnaâ6<ÈbBL¥±›˛˝øÓ|Ñû%2z›Q2ç7nå
ˆ\√Ÿ<6ÂB2Û÷˝rcT∫t‹8U¥¡àÅi#Õ£b≈˝Miä
}=n¨¢#ñËÍ¥q≤œ≈£‰9L%I É∏A˙*©¥°j»µÖ£}Xn®Ãâ(^$•S|1 è˛OiöJõ'n¨É§ﬁR#e¥q≤œQKÈ|åËD )^pf¡KAôæŸ\|v	«¡Wßw∂⁄‚˚Ì‹cJˇ.4˜˘H≠!V˙\£⁄}úNÒ=”EØﬁ@ΩU^â(¶∞ fÊgåo¨Älö¥”ŒƒÜßgiâå r^=ÔIm	—køûQùQòåüÑ16ähÖçè—ÿ9o »t±„Z˜ì\5≥;…Í5ò xù»?'›Àêì3›@Uõc˘]¿;≈/ÑGg'∏jßU^≈]  o¿…pçnoMl–∑ÔGˆJ5^ø…õ⁄á·)%9Íµ¬:(∑Kπ„òJ6Ñ-ÅËèV•Ñå†?…ø©Ë £=€c5Æ—.DÖ—gßL#ÖPÉIﬁ}&ﬂ‰6˜∂´
NÂwO¨…&3¢j∆Øÿ∑tœÃV¿7PÅ?‹˝¯øSª ¨Ê¡)jÆ÷[ÈΩŸ•¥ù-ô˛AwÑv/!Y≠Å˜'¨'}L;.„úÇ£¸{<´ÙÏ‹πÀsg»‹¬Çñ`zˆ¸˝ŒÍ∏ÆÂıî©:záyî¥“£j»U+éíjıF†´Ìk◊;Îıá˚d—÷…Añ∂©à¶‹.~\‡≤LˇSÊÍ2q‚Èåπ-=4ﬂ6˙◊"	Ñ{${ﬁauGöˆœ§ΩèXõU⁄⁄}Ö5dòÏXWÙ¬Ö.ú(›ÂiXcØjúPÛë Ò“O˛æfˆ}AG ≥ü°A˚:uû˛‘‡âj5b¿Nµìﬁ8^èsbQç·á	Ââ.ß<i…∞ÒAÖ3jÜ)hj7GR–ÑÁ/[â˙£Øt¬'rOÀùºuÎ√V> •_e2L\É80…bÔ”=	õÑ{TéZI˝ﬁi∆3°ùùu∞£õmâb/6/«πØ5z
œ/û∏	ß°{|sXâÏèdæ¢pÙ„YŒπP>ﬁdŸ$ájz®ÆD¿ùU≥-PÜ√⁄p.u≠ËíUøîáë∏ŸâCXKG8ÓÁ§B{|÷ÉµÈÉ¿IM÷÷ìÿdÔV›õ7äãdiyÃn
QÂÚ7-ó:ê&Ñ∞®Åy∏ümÄ|∞–:©ùá‡Ñ÷˝∏∑nh$[ê⁄˚!˛F‹}
72≤Hç/«ﬂ<€bë˘S8HÌ=çîΩ∑ÙHã íß⁄°¶ö?DﬂúùpS¨¢∂HåøïpGÓ?ie^ê⁄E˛Kâ◊eﬁb∏ì÷i∫6œæ-1≥}ŒqîÓøï¡ 'VläßèÖ.\ª‹ éz˘$ñí±R«Øâ¶ó Å…/º 'kzJÉ-Åß)ŒÒ"O◊∂Àft~≈˜*JÄY¢E¶'ìÔüËŸˇœÿÙfïSÃ¶⁄ ˛'gÑ®îÕ·lÕ]µéí∂ª¸≤Â1„˚—À#?z
–|∆ã–ªa0†në≈s†a«Ua¡P‡¸ë
wãà∏«ö"ä™V:ﬂ‡>)ó\¸Rp*^5œ<ü{VjÅí;‚˙˘aPqùçi◊KÈUv√ó“Á¶[I¢<ˇ™˙Ö≥KÁ»¸œÁŒΩ±H.Ã-/ˇÍ¸≈◊öˆ/PöB»Éq[YÙ◊—8A£ùû ôÀÃ9œÀ¡øpÆ’äu=;ÆèíN í;°«ù¿ØÀ2∏¿Î2dgùK6π√gäz»‚≥ùJ¥øªüÚ˚x›OX‚Qÿ˘î3"Ê{˙√Ô˜ﬁ˜d◊*}.´–o©bXÂË≈ïòëzû ÚTﬁ"ÏûÆ‚©Ú<“∆ıU√˙π¥sûÿÈÜ∑ô£ÍÛ‚‹QΩ1u«⁄ã‡è“)ûwwàûºJ¶^OàÆÚÊ^Cóc1ä∂)¯ Íÿ8qB}üìÏπÍ∆Rz»5–Ì8=òˆÿÑ3çü|¨[4$®+ˇ‹=Ê~HïIﬁ·^∂j.ÜÍ|◊±w∆ﬁs∑”≤¸I∑ø≥›Plá¬‹óæC°ÍÏ5«50+J‚°™YYŒC(Ú„·?C'®hFﬁKG©¢¨KUyv=&ôÎQ¿≥|û!/‚ÈªE%CÀ rËä:åo%ÿèB*ïò$zxÍ1Sà~À‚KÜ⁄ñ6	$"—9˜îΩVãeıì~ü*Ú‚ﬁg”5ê¨;k†¿÷óÆá>9Azı¨ü,uÏ%qÄLO°X<kÑ«Kñç!˘“ûÒ≥k¸Q‡ÇÔıB2>¥dË≤∏≠#€'ø{Qz•ñ"˙≈ˇN+˝‚ò9†°«∆[∂¶ŸTz(
ßKT'EGz∂O¡ìˇÂª˜wÒıé≤á<¬R£ØMø¸ﬂ›ˇ≥*¨Ø˛h_{5‘ˆö
⁄^ÉÕl⁄ÅzÉh¥~i◊¡Â˜µ∑Ω´‚l‹Í“jﬁÀêÃN~[.·>’√6ÏL/∆∏iGi:Q„êŸc˙V˚~ÀN˙L$_‰rïΩˇ#ûÊ‰Lé™ˆ¸⁄ò ,È•äıSïÒTïÛU…›µˇ=wB©wÊ_Ô}Wæ´í	)§fŒ√û∫‰Áœúøº@ñˇÒ‹<YXº4∑tfOH^ﬁÏ4™•#«5=0:∂!.˚`J≤[»ü◊º†˜:˛´Îä¯[®!ò8jzÂyﬂ3Â\«úÚ¢|ˆ¯‘ıµ¢ÍYñŒ(*0~£pdÇx 6ñ@^awpf „÷çuc ºSl.<¬ZÀê√¶X/ò8û¥∆‡µ˘VwΩâÙˇR“[ß€˝É{å}mTMOrﬁ”K6¯≤`g5‰ÃhTˆaÓ FÆ…Ôﬂw≥	8a`ôíÂA}∞ﬁ˜`"pJ`æjTcíPµyi¶Á50º/›KÕÙ-?â'⁄£íOú*”ÏU˛J!˝NºC¥‹À/Uæ÷Ÿπw‰E_°Ñ¡P	ÙÀÜ€ï¿çjIÀÃÓ|Â	)j√∏+Tƒ|6u,.Sﬁ®PÛ…
R¡€vî»Û◊°pπE.$,•˙jBÊÎY≥PV‚PËí:¸\ÏP©ƒ4•®øå6(ö1ÃsèÙ-®è„≈¥:¶áH…  ®CCi9W¯¸–ÂfŸ#e|ÿ‚Ík≥Ç~1±(„[W%éàzØ•à2I´f¢Qb•r∞à@ˆ'ªúë±äp–·^'cFÕ¸kÒ)æ‰™ﬁÜx‰©>›
>ur–=”Ö(˝Ú \µ±kùâSc„€ˇÄ»ú2òÏ»\¶¯1èÀfl~ËÕ\»e˙√¨ÛjÉÓ†ﬁbØ„}-"¸sÔ"≤õﬁŸsO¯ò4ãnI1ºBµ∏1√!’ô∑=ª·√>–"OÅWûkµò—∑P‘±∫»f⁄Ø_k%Õ[iŒßD)∫ÎYŒ∑	D6Í≠ÚË∑‚ 7†åSé‰€FW%† ¥÷ÎO[øπI€µ¨{Wëe∂€´7“¡&s$l$oUéËì~`q©¨·S ¬ƒÇﬂ (5|ÄÙ≈……I&^æˇÙ3|Mp)˙1/z…ó"\ıÆòe1~G»∫ìï,ÈØùNÈøÉnñÃ”©†ÂÊ:≥≥(˘‘e±Ïß„†˚75˝)©ˇ∏¯jª¿±Æs⁄√±Ç÷Û∆v©£HøÇ—¯R%âı“„¿1∫ÉÖQ¶?ñ|˘Pπ(üó≥h„^E+I§Ffê0f0l.d›U˙R[:]!s¨è£nıÈ…Í\#—5’PouÓS3π«tî•\⁄7áQu@∑’ZLBF
Ωˇ|∑sÄ˜âËΩ5EIã\ZèÈq}g˚¸·5≈ëÿëÚÁ¿⁄^”¿`ÿØa¯EÌ∆®ŸjrÅ˛vk¸ˆûåΩ	∞JöÎk…ö3&+	È6[tën™:÷f…’W<î∫ä√‡«∫1p‡gÂœqEË>‹!-¿«,2®xCq’›	ÓUS+6ß>3É0tí‚È©,õ‰†ëxÀSbkùl›I@IRFÓ?n7“ïÏm}ç? `Ò‡/<¡£æTØ†‡
!¥ß=A˙¸/˛ı/íMfπ¿m&ﬂJ6}ÿ(àÃ( £VJﬁá‰…J0àC∆≤ÿú—y‘î≤Æ7µÿÆÊf∞]%sYC…Ò›µL¶,«z∫2=3ÇèÒÙœjQi…®Õ`®
ÄNÇòBØ≠ÕÂ∫rïF-Y˛‡=ù>xm&pÎBê‘|	ŒXnì´ı,üL5,úKÙ|ML;Ü!ÃüÒán±CKpuñ£Áñ§l°{ïL }®Ñ”,Ω€ ÎRAaﬂOoT¿7h6≠†ΩNgâ›Ì$j±˚Ê”	ÿ#``?“OØíE[WÛΩ&Á WƒíÎü¶º±…]±ŒüB89∏sØ¥ã'Ó√¯[˙h≥E˙.øè3˝6ƒ∆^çä˙Ñî‘§|†ËÚ¿g“‘ﬁ∆¨y¿Öóxy~ *ú>„^’ç®âGU°Á5‹·(2ﬁ·∞¬πäÎÃùëÎâ5)√Ω`]Üc –^ﬁ}óD˚™‡p9Ÿ‚
xÔ} Æ[÷‡Ì Â≥ıÍt=1Lí˜I˛},R-òQ.€‚É^#œ{Ÿ’Î| ◊s<òì_ŒÈ¿°|kˆç"Ωj÷i~ø{ö◊7Ê]õnΩXd◊Ê?›Ì"¬¸v˙ÆƒU≈eI«ı<ø@‰çâ# QßÌ&6≠ïÖ„∫Ÿ*∆ ôë«›UFíFD˚¡/ûªx˛Ãô≥ãÁ.ë•sø<ø4øHíããÛãK.!˘4,]1i.v2*g€TJúÓfœÎ/î§Rÿ!√)\m≠∆ÆzÎTÛ∆#vm´7Öfû≤%føT.MÙ∏†≤z#Gg;F%Ë1´YéjlVØNE‰SÂ°T˚·ÓÉgerπ1°*Kïâïws‡q„û2ÚP"0>ï≠EsÛ-^Ìr”˝ÂâDoº_"ó≈ÌÚ`÷_ú\Í\Ô¶çÑ¸€¿ùLõì}*&ì⁄‘rl‹ƒﬁ.ù@RâØ<NÊQı}€†‹÷›òÏQÖeP+Í˘f)f%˙y(È˙˛ˆﬁÆ&Ì◊¿9ø’Y'ﬂ"√.2Æ©ïË2óGQê1<óh]æ•{9ª÷°rºp∫ÀNÙQs¢CSá“1™ˆ=DæA&6”†çìãI#I{É∏d#ª•SQˇ(ëõ!]ÍnZxµ“ûo7+ÂÆ‚éR;5¥YÔØ)<jmÊ–›.∞ÿ„∞"Y¬§Åí}d*wÙ Daˇ…Ûˇ›˘sdn~naÒÏ?zÌb˚Qû∂MG¯N√pÛL∆è§Ok«¿˙µ˜$ÜÚ&K¥˜üœÖsÃ¿ñ˚Bµ»ˆmßqa/ﬁeÜ”&&0óvXôî
ò‚ÖVx}N1m¢4œâ“7‹"H+è{Ë˚;∑tîÑØ}HÃ∏sK„®ÕÂD∆M¸åØ¬ë. y-∞…'Ï´§97@bô˘≈7z∂ƒÎMHF[Í±Å7°x©K±!‰∞Ï†àY+Q°ézxƒ¢s(7kQ6$Å5àä˜xØÜ†]”i0π>V≥¥I‡0*˙‘÷‰[Fﬂo8êÑÌ¡E† ™—≠1‚›èj†lcàù˚˘@·&Û?G)ÁíÈf»«î§ï…`√CÊùü´RÜ9ËÒ Ò´1ÙYj2Íú;8∑˜‘‡Iîè‰6Ûtî4–⁄8ë‡¬î»>7*(m /N•Àzß¡∞Mã(∞ÿÆß≠!(PRtœw◊3*˝~B.Å>À[ÂÅê¯7 √mù»oàπeÙ’‡F—¬üπS†ËÜ
k¬åkºßçÎ¡‹º†ÎSÁÑìÏ °£<q ƒ‘∆a¢∂Ízﬁ=∫·ºp[Ê´ﬁ‚êùUhUîÿ*{ıM¯|6¨u˘ép:KíJ¬0ÙòAvÉn8HRa<›óF…ÙcÓJÁ3UË¶¨%+[3©]¢√^A^è¯_Ï-+Áz= W©R8BÑàä¶ß ﬂ§(ä
GL$4ö:ﬂÌmRÇá6Œ}ÅHÜ◊EPÊv¥X¡tÖF∑ó&ÕKåç!ô¨ê◊_'ØÕØ%tÜMã˚∆"¥Ï%OíYz• r>¸j˙‰…Òﬂ+¥}¬:çó⁄ÍÁ⁄êPMN©|…]›ﬁ≠ò(c˙ﬂ¸^Ñì≤…ˆSƒÚÖ¶”˚o‡ˇÜñcóÓ{ißﬁ∫ê•ˇ>ÊôΩÇÌ±G◊^∑ô¯dq<°Ù“ó‚$.≠^˜}ß¯œxÍ©≈çyõæ]3Ì7ÄÎ.»ì∞‰ÊCö ì!Ô 9∫¸∆à≠•";™Q€q	¢¿U!ù◊`‡•Su91g†AÒ≥7∑çôaÙ]©»È%<‘<⁄…õ∏ÜFp6†Ø¢BVAp¿Fï2P:æ‡´Û>îÙ2§,_∫º y.û?ΩtfëöîsgŒàÑÇ≈2˛Ú≈ÂEîC–zpP
_»∫+i+˘€»"`ªóE∞˚(ªüYUf¥AWUª¶≠êî–a‡V∏r∫pÚ˘˚¯nπU∞)Û€ºŒR’¿\ùô(abzD/èç_ôz”ä¡ó	ªå*π°ÊGhèÄ8%›≈q≥ï;\Ki©9Ó∑òëù◊€+˛U=_√·W·Úë≠1;â·≥ÄBs„	Có˚ÆânÜäES2|n :-£∑3t˛Ãàµd>c‘ò]Kí@àô QwEº∞ö|¬nªê°<¿≈õ°õåm;\Òπ@“Ã0ÊﬁP5’∫¸˜.¬Q¿êk%à∑˘RÅ’!ZV2^œ€WÊãh+* Jûú ©|üºΩ¸H¢Òˆîä?`—3Ó{,aeûÖí ∆“éy~Ñ∞Ô…[	Yü«Â¸≠¢Û&W—Úu‘ßƒÂIPØºﬁß⁄îåt"Í+1yxpO'"‚mV©]NZ¿âU>J#ÊÚ©Vqõ‘ﬁ`OU|÷»¯^PºﬂHúM‘§fÌ ¨≥˝j7HjkKDcß{†Ôü8kÌ1≠µ∑ﬂ+Ç7”˛ KÉ]°6hA9»ÒƒæâÿFLT˘Ü{EQﬁÕµ9∑;$}"3ıN÷9úá∫ñˇ…h…Ìœ¬ÛNÄ"»¯¶†L6pí±—v	É‘Ï3»ôÎt#a)¬.ÍL·‘ˆŸ]" iÑ≠å‡ÉAMZ+Q0Òi"®2ù◊WÓ?˘√›[ˇEz◊Õû«™A0¯π‰!ñkg’
ÎPyÏyk¬OÙì™%ŒË…Äf•˛T81–B≤%éõ2@wüõß ;ZœâÊn•Å‘œ±Ú†Ât‘ö©ÌPpõ¯º Ü£(ÓwC)Êd˚SMbsPˆà™í]Y≤∂“ïdê∂ì˘nñ—ÛGG€¶à≈Ò[§Ê…KCÿ¨€OÜ£ÍØ~ƒ»h˙%—<}i	™µâ≠L“ÂF7K^ß‚‡4ƒuj”„ª!vdOé+êw¿™Eëá/.°Fò Ûµ¥OÄ<Ò®UàÔg´ÊÎ¡±òr˚˝D–““;‡b8ÂèáùàgWtCáûÃÌÂòáW∂∆Ê\‰œó”}Ç‘x"dNf˚›ï7«'ÈÌÈÓ^cçîn¨	≤Pu+ôtˇfH-2hƒ2°∞`9˘nŒπC›˝(ÔÀ>Ön∆)ÆÆ∆>zÜå¸Êÿå#‰. ãîiÖÒŒˆ5oå†VöÑîÛ9î@ÁÆz»YΩπŒºÿÛıûÈËe˛Ú('Ø∫õpˆ~Ù›˝õ$&Äí#∫ö—Ÿ˛√åô‘∂¥`¬“ ˝Ÿ¿ê^e–˘åú/Lu—t©Õ≤T$˝=≤§πﬁHjµz£qÄ4ò‡•íü“ı≠ÂÕ∞Ωk¸ ˝ïY∞∞œê'Ã≥H/Ûì—›√ù$∂ R‹ÁDsyBæn≤ÙXY®’
 é≠qKÙì!¬píÓÀÔ˛r¶ÒcúÃÜ©ø¿÷Ëú•Õl÷¸W	"38¡∆d 6$z’∂©XF√CÅËP°Ä	"¶ÖDô5¯d~•◊∞RÙ´<O0VØ@Ígœ ÂîÈÕ¡
!FΩcQÚ¥yˇÔﬂ˚ﬂÂ.@´Ë∞HˇyVŸŒZ–zïü_≠ÿÏRvcV›F>7î•Õ^¨xÚcN)Wl\ZTçb{ÄÉAD7bíÕÉ3~AÚmƒõ]9Æ±∑ìÇÀ!è∏˚—_ˇuÁ#Ûôqk-òZ1' *Vπeç&k Nm-⁄‘Kó_QeÍ%Có2æ£‹∞˝o˛?   ˇˇ }‚‘