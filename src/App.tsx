import React, { useState, useEffect } from 'react';
import { Question, LiveExam, Notice, Routine, ScheduledExamConfig, User, Attempt, Bookmark, CategoryItem, SubcategoryItem, AuditLog, Course, Coupon, CourseEnrollment, PaymentSettings, DEFAULT_PAYMENT_SETTINGS, generateAutoUserId } from './types';
import { 
  INITIAL_QUESTIONS, 
  INITIAL_NOTICES, 
  INITIAL_ROUTINES, 
  INITIAL_LIVE_EXAMS, 
  INITIAL_USERS,
  INITIAL_COURSES,
  INITIAL_COUPONS
} from './data';
import AdminPanel from './components/AdminPanel';
import UserPortal from './components/UserPortal';
import { 
  fetchQuestionsFromFirestore, 
  addQuestionToFirestore, 
  updateQuestionInFirestore, 
  deleteQuestionFromFirestore, 
  bulkUploadQuestionsToFirestore, 
  bulkDeleteQuestionsFromFirestore,
  fetchCollectionFromFirestore,
  saveItemToFirestore,
  deleteItemFromFirestore,
  syncCollectionToFirestore
} from './lib/migration';
import {
  getQuestionsFromIDB,
  saveQuestionsToIDB,
  performIncrementalSyncFromFirestore,
  fetchQuestionsLazyFromFirestore,
  getCoursesFromIDB,
  saveCoursesToIDB,
  performIncrementalCourseSyncFromFirestore,
  getLiveExamsFromIDB,
  saveLiveExamsToIDB,
  getRoutinesFromIDB,
  saveRoutinesToIDB,
  performIncrementalExamSyncFromFirestore
} from './lib/indexedDB';
import { 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail, 
  signInWithEmailAndPassword,
  sendEmailVerification,
  reload,
  updatePassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { auth } from './lib/firebase';
import { LogIn, KeyRound, Sparkles, BookOpen, UserCheck, Smartphone, Mail, ShieldCheck, CheckCircle2, RefreshCw, ArrowLeft, Lock, RotateCcw, HelpCircle, Eye, EyeOff, AlertCircle } from 'lucide-react';

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

// Helper to detect variations/typos of "সাম্প্রতিক বিষয়াবলী"
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

export default function App() {
  // Database States
  const [questions, setQuestions] = useState<Question[]>([]);
  const [liveExams, setLiveExams] = useState<LiveExam[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>(() => {
    const saved = localStorage.getItem('orjon_coupons');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return INITIAL_COUPONS;
  });
  const [courseEnrollments, setCourseEnrollments] = useState<CourseEnrollment[]>(() => {
    const saved = localStorage.getItem('orjon_course_enrollments');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return [];
  });
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>(() => {
    const saved = localStorage.getItem('orjon_payment_settings');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return DEFAULT_PAYMENT_SETTINGS;
  });
  const [users, setUsers] = useState<User[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [subcategories, setSubcategories] = useState<SubcategoryItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [allowUserExplanation, setAllowUserExplanation] = useState<boolean>(() => {
    return (localStorage.getItem('orjon_allow_user_explanation') || localStorage.getItem('medha_allow_user_explanation')) !== 'false';
  });
  const [showMcqCount, setShowMcqCount] = useState<boolean>(() => {
    return (localStorage.getItem('orjon_show_mcq_count') || localStorage.getItem('medha_show_mcq_count')) !== 'false';
  });

  const addAuditLog = (action: string, details: string, type: AuditLog['type'] = 'other') => {
    const newLog: AuditLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      action,
      details,
      admin: 'এডমিন (Admin)',
      timestamp: new Date().toISOString(),
      type
    };
    setAuditLogs(prev => {
      const updated = [newLog, ...prev].slice(0, 500);
      localStorage.setItem('orjon_audit_logs', JSON.stringify(updated));
      syncCollectionToFirestore('audit_logs', updated, 'log');
      return updated;
    });
  };

  const handleClearAuditLogs = () => {
    setAuditLogs([]);
    localStorage.removeItem('orjon_audit_logs');
    syncCollectionToFirestore('audit_logs', [], 'log');
  };

  const handleToggleMcqCount = (show: boolean) => {
    setShowMcqCount(show);
    localStorage.setItem('orjon_show_mcq_count', show ? 'true' : 'false');
  };

  // Auth / Active Session States
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authScreen, setAuthScreen] = useState<'login' | 'register' | 'admin-login' | 'forgot-password'>('login');

  // Input states for Login / Register
  const [phoneInput, setPhoneInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [loginErrorMessage, setLoginErrorMessage] = useState<string | null>(null);
  
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [regPhone, setRegPhone] = useState('');
  const [regGender, setRegGender] = useState('পুরুষ');
  const [regEducation, setRegEducation] = useState('');
  const [regAvatar, setRegAvatar] = useState('');
  const [regErrors, setRegErrors] = useState<Record<string, string>>({});
  const [regGeneralError, setRegGeneralError] = useState<string | null>(null);

  // Email Verification & Auto ID registration states
  const [regStep, setRegStep] = useState<'form' | 'verify' | 'success'>('form');
  const [otpCode, setOtpCode] = useState('');
  const [userOtpInput, setUserOtpInput] = useState('');
  const [pendingUser, setPendingUser] = useState<User | null>(null);

  // Real Email OTP Resend States & Cooldown
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [otpDeliveryMessage, setOtpDeliveryMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Resend OTP Cooldown Timer Effect
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Real Email OTP Sender function using backend /api/send-otp
  const sendRealOtp = async (email: string, code: string, userName?: string, type: 'register' | 'reset' = 'register') => {
    const trimmedEmail = (email || '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      setOtpDeliveryMessage({ 
        text: `⚠️ সঠিক ইমেইল এড্রেস প্রদান করুন (প্রদানকৃত: "${trimmedEmail || 'খালি'}")।`, 
        isError: true 
      });
      return false;
    }

    setIsSendingOtp(true);
    setOtpDeliveryMessage({ text: '📩 Resend সার্ভিস এর মাধ্যমে আপনার ইমেইলে ওটিপি পাঠানো হচ্ছে...', isError: false });
    
    try {
      const response = await fetch('/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmedEmail,
          otp: code,
          name: userName || 'শ্রদ্ধেয় ইউজার',
          type
        })
      });
      const data = await response.json();
      setIsSendingOtp(false);

      if (data.success) {
        setOtpDeliveryMessage({ 
          text: `✅ Resend এর মাধ্যমে সরাসরি আপনার ইমেইলে (${trimmedEmail}) ৬ ডিজিটের ওটিপি সফলভাবে পাঠানো হয়েছে! (Inbox/Spam ফোল্ডার চেক করুন)`, 
          isError: false 
        });
        setResendCooldown(60);
        return true;
      } else {
        setOtpDeliveryMessage({ 
          text: `⚠️ ওটিপি নোটিশ: ${data.error || 'ইমেইল পাঠাতে সমস্যা হয়েছে।'}`, 
          isError: true 
        });
        setResendCooldown(data.cooldownRemaining ? Number(data.cooldownRemaining) : 60);
        return false;
      }
    } catch (err: any) {
      console.warn("Error calling /api/send-otp backend endpoint:", err);
      setIsSendingOtp(false);
      setOtpDeliveryMessage({ 
        text: `⚠️ ইমেইল এপিআই নোটিশ: সার্ভার রেসপন্স করছে না।`, 
        isError: true 
      });
      setResendCooldown(60);
      return false;
    }
  };

  // Forgot Password states (Firebase Auth Password Reset Email)
  const [forgotStep, setForgotStep] = useState<'email' | 'sent'>('email');
  const [forgotQuery, setForgotQuery] = useState('');
  const [forgotUser, setForgotUser] = useState<User | null>(null);
  const [forgotTargetEmail, setForgotTargetEmail] = useState('');

  const [adminPassInput, setAdminPassInput] = useState('');
  const [adminPassword, setAdminPassword] = useState<string>(() => {
    return localStorage.getItem('orjon_admin_password') || localStorage.getItem('medha_admin_password') || 'admin123';
  });

  const handleUpdateAdminPassword = async (newPass: string) => {
    setAdminPassword(newPass);
    localStorage.setItem('orjon_admin_password', newPass);
    if (auth.currentUser) {
      try {
        await updatePassword(auth.currentUser, newPass);
      } catch (err) {
        console.warn("Firebase Auth admin password update notice:", err);
      }
    }
  };

  // Admin Forgot Password states
  const [adminLoginSubStep, setAdminLoginSubStep] = useState<'login' | 'forgot-request' | 'forgot-sent'>('login');
  const [adminUsernameInput, setAdminUsernameInput] = useState('admin');
  const [adminForgotQuery, setAdminForgotQuery] = useState('mohidur143@gmail.com');

  // Guest Live Exam states
  const [directExamId, setDirectExamId] = useState<string | null>(null);
  const [guestEmailModalOpen, setGuestEmailModalOpen] = useState(false);
  const [guestExamTarget, setGuestExamTarget] = useState<LiveExam | null>(null);
  const [guestEmailInput, setGuestEmailInput] = useState('');
  const [guestError, setGuestError] = useState<string | null>(null);

  // Security Session Timeout states
  const [sessionTimeoutNotice, setSessionTimeoutNotice] = useState<string | null>(null);
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState<number>(() => {
    const stored = localStorage.getItem('orjon_session_timeout_minutes');
    return stored ? parseInt(stored, 10) : 15;
  });

  const handleUpdateSessionTimeout = (mins: number) => {
    setSessionTimeoutMinutes(mins);
    localStorage.setItem('orjon_session_timeout_minutes', mins.toString());
    localStorage.setItem('orjon_last_activity', Date.now().toString());
    addAuditLog('সেশন সিকিউরিটি', `সেশন ইনঅ্যাক্টিভিটি টাইমআউট ${mins} মিনিটে সেট করা হয়েছে`, 'other');
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const examParam = params.get('examId') || params.get('liveExam');
    if (examParam) {
      setDirectExamId(examParam);
    }
  }, []);

  useEffect(() => {
    if (directExamId && !currentUser && liveExams.length > 0) {
      const targetExam = liveExams.find(e => e.id === directExamId);
      if (targetExam) {
        setGuestExamTarget(targetExam);
        setGuestEmailModalOpen(true);
      }
    }
  }, [directExamId, currentUser, liveExams]);

  const handleStartGuestExam = (exam: LiveExam, email: string) => {
    const trimmed = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmed || !emailRegex.test(trimmed)) {
      setGuestError('অনুগ্রহ করে সঠিক ইমেইল এড্রেস প্রদান করুন (যেমন: student@gmail.com)');
      return;
    }

    const guestObj: User = {
      userId: `GUEST-${Date.now().toString(36).toUpperCase()}`,
      name: `গেস্ট (${trimmed.split('@')[0]})`,
      phone: trimmed,
      email: trimmed,
      gender: 'অন্যান্য',
      education: 'গেস্ট পরীক্ষার্থী',
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(trimmed)}`,
      lifetimeAnswered: 0,
      lifetimeCorrect: 0,
      lifetimeWrong: 0,
      createdAt: new Date().toISOString(),
      isGuest: true
    };

    setCurrentUser(guestObj);
    setGuestEmailModalOpen(false);
    setGuestExamTarget(null);
    setGuestError(null);
  };

  const associateGuestAttemptsWithUser = (userObj: User) => {
    const emailLower = userObj.email?.toLowerCase();
    if (!emailLower) return;

    const userIdentifier = userObj.phone || userObj.userId || userObj.email;
    const updatedAttempts = attempts.map(a => {
      const aEmailLower = a.userEmail?.toLowerCase();
      const aPhoneLower = a.userPhone?.toLowerCase();
      if (aEmailLower === emailLower || aPhoneLower === emailLower) {
        return {
          ...a,
          userPhone: userIdentifier,
          userEmail: userObj.email,
          username: userObj.name,
          isGuestAttempt: false
        };
      }
      return a;
    });

    updateAttemptsDB(updatedAttempts);
  };

  // 1. Load database on mount with IndexedDB for instant startup & Timestamp-Based Incremental Sync
  useEffect(() => {
    // Fast initial fallback setup
    const storedQ = localStorage.getItem('orjon_questions') || localStorage.getItem('medha_questions');
    let loadedQ: Question[] = [];
    if (storedQ) {
      try {
        loadedQ = JSON.parse(storedQ);
      } catch (e) {
        loadedQ = INITIAL_QUESTIONS;
      }
    } else {
      loadedQ = INITIAL_QUESTIONS;
    }

    let normalizedQ = loadedQ.map(q => {
      let cat = q.category || '';
      if (isJobSolutionVariation(cat)) {
        cat = 'জব সলিউশন পরীক্ষা';
      } else if (isYearJobSolutionVariation(cat)) {
        cat = 'সাল ভিত্তিক জব সলিউশন';
      }
      return {
        ...q,
        category: cat
      };
    });

    setQuestions(normalizedQ);

    // ==========================================
    // 1. LOCAL QUESTIONS LOADING (Cache-First)
    // ==========================================
    getQuestionsFromIDB().then((idbQuestions) => {
      if (idbQuestions && idbQuestions.length > 0) {
        const loadedFromIDB = idbQuestions.map(q => {
          let cat = q.category || '';
          if (isJobSolutionVariation(cat)) {
            cat = 'জব সলিউশন পরীক্ষা';
          } else if (isYearJobSolutionVariation(cat)) {
            cat = 'সাল ভিত্তিক জব সলিউশন';
          }
          return {
            ...q,
            category: cat
          };
        });
        const dedupedQ = dedupeQuestions(loadedFromIDB);
        setQuestions(dedupedQ);
        syncSubcategoriesWithFirestoreQuestions(dedupedQ);
      } else {
        saveQuestionsToIDB(normalizedQ);
      }
    }).catch(err => {
      console.warn("IndexedDB questions initialization notice:", err);
    });

    // Notices seed (Cache-First)
    const storedN = localStorage.getItem('orjon_notices') || localStorage.getItem('medha_notices');
    if (storedN) {
      setNotices(JSON.parse(storedN));
    } else {
      localStorage.setItem('orjon_notices', JSON.stringify(INITIAL_NOTICES));
      setNotices(INITIAL_NOTICES);
      fetchCollectionFromFirestore<Notice>('notices').then(fsN => {
        if (fsN && fsN.length > 0) {
          setNotices(fsN);
          localStorage.setItem('orjon_notices', JSON.stringify(fsN));
        }
      }).catch(() => {});
    }

    // ==========================================
    // 2. LOCAL COURSES LOADING (Cache-First)
    // ==========================================
    const storedCourses = localStorage.getItem('orjon_courses') || localStorage.getItem('medha_courses');
    if (storedCourses) {
      try {
        setCourses(dedupeCourses(JSON.parse(storedCourses)));
      } catch {
        setCourses(dedupeCourses(INITIAL_COURSES));
      }
    } else {
      localStorage.setItem('orjon_courses', JSON.stringify(dedupeCourses(INITIAL_COURSES)));
      setCourses(dedupeCourses(INITIAL_COURSES));
    }

    getCoursesFromIDB().then((idbCourses) => {
      if (idbCourses && idbCourses.length > 0) {
        const dedupedC = dedupeCourses(idbCourses);
        setCourses(dedupedC);
      } else {
        const localC = storedCourses ? JSON.parse(storedCourses) : INITIAL_COURSES;
        saveCoursesToIDB(dedupeCourses(localC));
      }
    }).catch(err => {
      console.warn("IndexedDB courses initialization notice:", err);
    });

    // ==========================================
    // 3. LOCAL EXAMS & ROUTINES LOADING (Cache-First)
    // ==========================================
    const storedLE = localStorage.getItem('orjon_live_exams') || localStorage.getItem('medha_live_exams');
    if (storedLE) {
      try {
        setLiveExams(dedupeLiveExams(JSON.parse(storedLE)));
      } catch {
        setLiveExams(dedupeLiveExams(INITIAL_LIVE_EXAMS));
      }
    } else {
      localStorage.setItem('orjon_live_exams', JSON.stringify(dedupeLiveExams(INITIAL_LIVE_EXAMS)));
      setLiveExams(dedupeLiveExams(INITIAL_LIVE_EXAMS));
    }

    const storedR = localStorage.getItem('orjon_routines') || localStorage.getItem('medha_routines');
    if (storedR) {
      try {
        setRoutines(dedupeRoutines(JSON.parse(storedR)));
      } catch {
        setRoutines(dedupeRoutines(INITIAL_ROUTINES));
      }
    } else {
      localStorage.setItem('orjon_routines', JSON.stringify(dedupeRoutines(INITIAL_ROUTINES)));
      setRoutines(dedupeRoutines(INITIAL_ROUTINES));
    }

    Promise.all([getLiveExamsFromIDB(), getRoutinesFromIDB()]).then(([idbLE, idbR]) => {
      if (idbLE && idbLE.length > 0) {
        setLiveExams(dedupeLiveExams(idbLE));
      } else {
        const localLE = storedLE ? JSON.parse(storedLE) : INITIAL_LIVE_EXAMS;
        saveLiveExamsToIDB(dedupeLiveExams(localLE));
      }

      if (idbR && idbR.length > 0) {
        setRoutines(dedupeRoutines(idbR));
      } else {
        const localR = storedR ? JSON.parse(storedR) : INITIAL_ROUTINES;
        saveRoutinesToIDB(dedupeRoutines(localR));
      }
    }).catch(err => {
      console.warn("IndexedDB exams initialization notice:", err);
    });

    // ==========================================
    // 4. BACKGROUND INCREMENTAL SYNC
    // - Questions: updatedAt > lastSyncedAt
    // - Courses: updatedAt > lastCourseSyncedAt
    // - Exams: updatedAt > lastExamSyncedAt
    // ==========================================
    performIncrementalSyncFromFirestore((updatedQuestions) => {
      if (updatedQuestions && updatedQuestions.length > 0) {
        const dedupedQ = dedupeQuestions(updatedQuestions);
        setQuestions(dedupedQ);
        try {
          localStorage.setItem('orjon_questions', JSON.stringify(dedupedQ));
        } catch (e) {
          console.warn("localStorage quota notice for questions stringify:", e);
        }
        syncSubcategoriesWithFirestoreQuestions(dedupedQ);
      }
    }).catch(err => {
      console.warn("Background questions incremental sync notice:", err);
    });

    performIncrementalCourseSyncFromFirestore((updatedCourses) => {
      if (updatedCourses && updatedCourses.length > 0) {
        const dedupedC = dedupeCourses(updatedCourses);
        setCourses(dedupedC);
        try {
          localStorage.setItem('orjon_courses', JSON.stringify(dedupedC));
        } catch (e) {
          console.warn("localStorage quota notice for courses:", e);
        }
      }
    }).catch(err => {
      console.warn("Background courses incremental sync notice:", err);
    });

    performIncrementalExamSyncFromFirestore(({ liveExams: updatedLE, routines: updatedR }) => {
      if (updatedLE && updatedLE.length > 0) {
        const dedupedLE = dedupeLiveExams(updatedLE);
        setLiveExams(dedupedLE);
        try {
          localStorage.setItem('orjon_live_exams', JSON.stringify(dedupedLE));
        } catch (e) {
          console.warn("localStorage quota notice for live exams:", e);
        }
      }
      if (updatedR && updatedR.length > 0) {
        const dedupedR = dedupeRoutines(updatedR);
        setRoutines(dedupedR);
        try {
          localStorage.setItem('orjon_routines', JSON.stringify(dedupedR));
        } catch (e) {
          console.warn("localStorage quota notice for routines:", e);
        }
      }
    }).catch(err => {
      console.warn("Background exams incremental sync notice:", err);
    });

    // Audit logs initial seed (Local Cache)
    const storedAudit = localStorage.getItem('orjon_audit_logs');
    if (storedAudit) {
      try {
        setAuditLogs(JSON.parse(storedAudit));
      } catch {}
    }

    // Users database seed (Local Cache)
    const storedU = localStorage.getItem('orjon_users') || localStorage.getItem('medha_users');
    let rawUsers: User[] = [];
    if (storedU) {
      try {
        rawUsers = JSON.parse(storedU);
      } catch (e) {
        rawUsers = INITIAL_USERS;
      }
    } else {
      rawUsers = INITIAL_USERS;
    }

    const migratedUsers = rawUsers.map((u, idx) => {
      const { password, ...rest } = u as any;
      const updated: User = { ...rest };
      if (!updated.userId) {
        updated.userId = `ORJ-${(1000 + idx).toString()}A`;
      }
      if (!updated.email) {
        updated.email = `${updated.phone}@orjon.edu.bd`;
      }
      if (updated.emailVerified === undefined) {
        updated.emailVerified = true;
      }
      return updated;
    });

    const userMap = new Map<string, User>();
    migratedUsers.forEach(u => {
      const k = (u.phone || u.userId || u.email || '').toLowerCase().trim();
      if (k) userMap.set(k, u);
    });
    const dedupedMigratedUsers = Array.from(userMap.values());

    setUsers(dedupedMigratedUsers);
    localStorage.setItem('orjon_users', JSON.stringify(dedupedMigratedUsers));

    // Attempts database (Local Cache)
    const storedAttempts = localStorage.getItem('orjon_attempts') || localStorage.getItem('medha_attempts');
    if (storedAttempts) {
      try {
        const parsed: Attempt[] = JSON.parse(storedAttempts);
        const cutoff = Date.now() - 72 * 60 * 60 * 1000;
        const validAttempts = parsed.filter(a => {
          const isUserCreated = a.examId.startsWith('prep_') || a.examId.startsWith('job_') || a.examId.startsWith('custom_') || a.examId.startsWith('demo_');
          if (isUserCreated) {
            return new Date(a.submittedAt).getTime() >= cutoff;
          }
          return true;
        });
        localStorage.setItem('orjon_attempts', JSON.stringify(validAttempts));
        setAttempts(validAttempts);
      } catch (e) {
        setAttempts([]);
      }
    } else {
      localStorage.setItem('orjon_attempts', JSON.stringify([]));
      setAttempts([]);
    }

    // Bookmarks database (Local Cache)
    const storedBookmarks = localStorage.getItem('orjon_bookmarks') || localStorage.getItem('medha_bookmarks');
    if (storedBookmarks) {
      try {
        setBookmarks(JSON.parse(storedBookmarks));
      } catch {
        setBookmarks([]);
      }
    } else {
      localStorage.setItem('orjon_bookmarks', JSON.stringify([]));
      setBookmarks([]);
    }

    // Categories database seed
    const storedCat = localStorage.getItem('orjon_categories') || localStorage.getItem('medha_categories');
    const targetCats: CategoryItem[] = [
      { id: 'cat-prep', name: 'বিষয়ভিত্তিক প্রস্তুতি' },
      { id: 'cat-job', name: 'জব সলিউশন পরীক্ষা' },
      { id: 'cat-year', name: 'সাল ভিত্তিক জব সলিউশন' },
      { id: 'cat-current', name: 'সাম্প্রতিক বিষয়াবলী' }
    ];
    setCategories(targetCats);
    localStorage.setItem('orjon_categories', JSON.stringify(targetCats));

    // Subcategories database seed
    const storedSubcat = localStorage.getItem('orjon_subcategories') || localStorage.getItem('medha_subcategories');
    let loadedSubcats: SubcategoryItem[] = [];

    if (storedSubcat) {
      try {
        loadedSubcats = JSON.parse(storedSubcat);
      } catch (e) {
        loadedSubcats = [];
      }
    } else {
      const qPool = normalizedQ;
      const addedNames = new Set<string>();
      qPool.forEach((q: any, i: number) => {
        if (q.subcategory && !addedNames.has(q.subcategory)) {
          addedNames.add(q.subcategory);
          loadedSubcats.push({
            id: `subcat-${i + 1}`,
            name: q.subcategory,
            parentCategory: isCurrentAffairVariation(q.category) ? 'সাম্প্রতিক বিষয়াবলী' : 'জব সলিউশন পরীক্ষা'
          });
        }
      });
    }

    // Ensure default year categories exist if none present under 'সাল ভিত্তিক জব সলিউশন'
    const defaultYearList = ['২০২৬ সাল', '২০২৫ সাল', '২০২৪ সাল', '২০২৩ সাল', '২০২২ সাল', '২০২১ সাল', '২০২০ সাল', '২০১৯ সাল', '২০১৮ সাল', '২০১৭ সাল', '২০১৬ সাল', '২০১৫ সাল'];
    defaultYearList.forEach((yr, idx) => {
      const exists = loadedSubcats.some(s => s.name.trim() === yr && isYearJobSolutionVariation(s.parentCategory));
      if (!exists) {
        loadedSubcats.push({
          id: `subcat-year-seed-${yr}-${idx}`,
          name: yr,
          parentCategory: 'সাল ভিত্তিক জব সলিউশন'
        });
      }
    });

    // Ensure default Current Affairs date categories exist if none present
    const defaultCurrentAffairs = [
      {
        id: 'subcat-ca-2026-08-18',
        name: '১৮ আগস্ট ২০২৬',
        parentCategory: 'সাম্প্রতিক বিষয়াবলী',
        date: '2026-08-18',
        text: `জাতীয় সংসদ ভবনে গুরুত্বপূর্ণ বাজেট অধিবেশন সম্পন্ন হয়েছে।\nবাংলাদেশ ব্যাংক মুদ্রাস্ফীতি নিয়ন্ত্রণে নতুন পলিসি রেপো রেট ১০% ঘোষণা করেছে।\nআন্তর্জাতিক সৌর জোটে (ISA) নতুন সদস্য হিসেবে যুক্ত হয়েছে একাধিক দেশ।\nপ্যারিস অলিম্পিকে সর্বকালের সর্বোচ্চ পদক তালিকা প্রকাশ।`,
        createdAt: '2026-08-18T10:00:00.000Z'
      },
      {
        id: 'subcat-ca-2026-08-15',
        name: '১৫ আগস্ট ২০২৬',
        parentCategory: 'সাম্প্রতিক বিষয়াবলী',
        date: '2026-08-15',
        text: `বঙ্গবন্ধু শেখ মুজিবুর রহমান টানেলে দৈনিক যান চলাচলের নতুন রেকর্ড স্থাপিত হয়েছে।\nচাঁদে নতুন অনুসন্ধান মিশনের সফল উৎক্ষেপণ পরিচালনা করেছে নাসা।\nটেস্ট ক্রিকেটে দ্রুততম ৫০০ উইকেটের নতুন বিশ্বরেকর্ড অর্জিত।`,
        createdAt: '2026-08-15T09:00:00.000Z'
      }
    ];
    defaultCurrentAffairs.forEach(ca => {
      const exists = loadedSubcats.some(s => s.name.trim() === ca.name && isCurrentAffairVariation(s.parentCategory));
      if (!exists) {
        loadedSubcats.push(ca);
      }
    });

    // Deduplicate loadedSubcats by ID and by combo key (name + parent)
    const seenIds = new Set<string>();
    const seenKeys = new Set<string>();
    const deduplicatedSubcats: SubcategoryItem[] = [];
    for (const sub of loadedSubcats) {
      const comboKey = `${sub.name.trim().toLowerCase()}|${sub.parentCategory.trim().toLowerCase()}`;
      if (!seenIds.has(sub.id) && !seenKeys.has(comboKey)) {
        seenIds.add(sub.id);
        seenKeys.add(comboKey);
        deduplicatedSubcats.push(sub);
      }
    }
    loadedSubcats = deduplicatedSubcats;

    // Convert old main categories (like বাংলা, ইংরেজি, সাধারণ জ্ঞান) to subcategories under 'বিষয়ভিত্তিক প্রস্তুতি'
    const oldCategoryNames = new Set<string>();
    normalizedQ.forEach((q: any) => {
      if (q.category && q.category !== 'বিষয়ভিত্তিক প্রস্তুতি' && !isJobSolutionVariation(q.category) && !isYearJobSolutionVariation(q.category) && !isCurrentAffairVariation(q.category)) {
        oldCategoryNames.add(q.category);
      }
    });

    if (storedCat) {
      try {
        const parsedCats = JSON.parse(storedCat);
        parsedCats.forEach((c: any) => {
          if (c.name && c.name !== 'বিষয়ভিত্তিক প্রস্তুতি' && !isJobSolutionVariation(c.name) && !isYearJobSolutionVariation(c.name) && !isCurrentAffairVariation(c.name)) {
            oldCategoryNames.add(c.name);
          }
        });
      } catch (e) {}
    }

    oldCategoryNames.forEach(name => {
      const trimmedName = name.trim();
      if (trimmedName && !loadedSubcats.some(s => s.name.trim().toLowerCase() === trimmedName.toLowerCase())) {
        loadedSubcats.push({
          id: `subcat-migrated-${Math.random().toString(36).substr(2, 5)}`,
          name: trimmedName,
          parentCategory: 'বিষয়ভিত্তিক প্রস্তুতি'
        });
      }
    });

    // Filter out subcategories whose names match exactly any of the main root categories or self-parent loops
    loadedSubcats = loadedSubcats.filter(sub => {
      const nameLower = sub.name.trim().toLowerCase();
      const parentLower = sub.parentCategory ? sub.parentCategory.trim().toLowerCase() : '';
      return nameLower !== 'বিষয়ভিত্তিক প্রস্তুতি'.toLowerCase() &&
             nameLower !== 'জব সলিউশন পরীক্ষা'.toLowerCase() &&
             nameLower !== 'সাল ভিত্তিক জব সলিউশন'.toLowerCase() &&
             nameLower !== 'সাম্প্রতিক বিষয়াবলী'.toLowerCase() &&
             !isJobSolutionVariation(nameLower) &&
             !isYearJobSolutionVariation(nameLower) &&
             !isCurrentAffairVariation(nameLower) &&
             nameLower !== parentLower;
    });

    // Create a lookup set of all existing subcategory names
    const loadedSubcatNames = new Set<string>(loadedSubcats.map(s => s.name.trim().toLowerCase()));

    // Clean up parentCategories that are empty, invalid, or misaligned
    const validParentNames = new Set<string>();
    validParentNames.add('বিষয়ভিত্তিক প্রস্তুতি');
    validParentNames.add('জব সলিউশন পরীক্ষা');
    validParentNames.add('সাল ভিত্তিক জব সলিউশন');
    validParentNames.add('সাম্প্রতিক বিষয়াবলী');
    oldCategoryNames.forEach(name => {
      validParentNames.add(name.trim());
    });
    loadedSubcats.forEach(sub => {
      validParentNames.add(sub.name.trim());
    });

    loadedSubcats = loadedSubcats.map(sub => {
      let parent = sub.parentCategory ? sub.parentCategory.trim() : '';
      const nameLower = sub.name.trim().toLowerCase();
      const parentLower = parent.toLowerCase();

      // 1. If own name is a job solution or year solution or current affairs variation
      if (isJobSolutionVariation(sub.name)) {
        parent = 'জব সলিউশন পরীক্ষা';
      } else if (isYearJobSolutionVariation(sub.name)) {
        parent = 'সাল ভিত্তিক জব সলিউশন';
      } else if (isCurrentAffairVariation(sub.name)) {
        parent = 'সাম্প্রতিক বিষয়াবলী';
      }
      // 2. If parent is a job/year/current affairs solution variation:
      else if (isJobSolutionVariation(parent)) {
        if (!loadedSubcatNames.has(parentLower)) {
          parent = 'জব সলিউশন পরীক্ষা';
        }
      } else if (isYearJobSolutionVariation(parent)) {
        if (!loadedSubcatNames.has(parentLower)) {
          parent = 'সাল ভিত্তিক জব সলিউশন';
        }
      } else if (isCurrentAffairVariation(parent)) {
        if (!loadedSubcatNames.has(parentLower)) {
          parent = 'সাম্প্রতিক বিষয়াবলী';
        }
      }
      // 3. Fallbacks for empty or invalid parents
      else if (!parent || !validParentNames.has(parent)) {
        const belongsToJob = nameLower.includes('বিসিএস') || nameLower.includes('নিয়োগ') || nameLower.includes('পরীক্ষা') || nameLower.includes('ব্যাংক') || nameLower.includes('job') || nameLower.includes('exam');
        if (belongsToJob) {
          parent = 'জব সলিউশন পরীক্ষা';
        } else {
          parent = 'বিষয়ভিত্তিক প্রস্তুতি';
        }
      }

      return {
        ...sub,
        parentCategory: parent
      };
    });

    // Detect and break any loops/cycles in the loaded subcategories
    const safeSubs = loadedSubcats.map(s => ({ ...s }));
    const subMap = new Map<string, typeof safeSubs[0]>();
    safeSubs.forEach(s => {
      subMap.set(s.name.trim().toLowerCase(), s);
    });

    for (const sub of safeSubs) {
      const visited = new Set<string>();
      let current = sub;
      let cycleDetected = false;

      while (current && current.parentCategory) {
        const parentName = current.parentCategory.trim().toLowerCase();
        
        if (
          parentName === 'বিষয়ভিত্তিক প্রস্তুতি'.toLowerCase() ||
          parentName === 'জব সলিউশন পরীক্ষা'.toLowerCase() ||
          parentName === 'সাল ভিত্তিক জব সলিউশন'.toLowerCase() ||
          isJobSolutionVariation(parentName) ||
          isYearJobSolutionVariation(parentName)
        ) {
          break;
        }

        if (visited.has(parentName) || parentName === current.name.trim().toLowerCase()) {
          cycleDetected = true;
          break;
        }

        visited.add(current.name.trim().toLowerCase());
        const parentSub = subMap.get(parentName);
        if (parentSub) {
          current = parentSub;
        } else {
          break;
        }
      }

      if (cycleDetected) {
        console.warn(`Loop detected in subcategories for: ${sub.name}. Resetting parent to root.`);
        const lowerName = sub.name.toLowerCase();
        const belongsToJob = lowerName.includes('বিসিএস') || lowerName.includes('নিয়োগ') || lowerName.includes('পরীক্ষা') || lowerName.includes('ব্যাংক') || lowerName.includes('job') || lowerName.includes('exam');
        sub.parentCategory = belongsToJob ? 'জব সলিউশন পরীক্ষা' : 'বিষয়ভিত্তিক প্রস্তুতি';
      }
    }
    loadedSubcats = safeSubs;

    // Ensure leaf nodes under Job / Year solutions have initial dates if none set
    const now = new Date();
    loadedSubcats = loadedSubcats.map((sub, idx) => {
      if (!sub.date) {
        const isJobOrYear = isJobSolutionVariation(sub.parentCategory) || 
                            isYearJobSolutionVariation(sub.parentCategory) ||
                            sub.parentCategory === 'জব সলিউশন পরীক্ষা' ||
                            sub.parentCategory === 'সাল ভিত্তিক জব সলিউশন';
        if (isJobOrYear) {
          const d = new Date(now.getTime() - (idx * 2 + 1) * 24 * 60 * 60 * 1000);
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          return { ...sub, date: `${yyyy}-${mm}-${dd}` };
        }
      }
      return sub;
    });

    localStorage.setItem('medha_subcategories', JSON.stringify(loadedSubcats));
    setSubcategories(loadedSubcats);

    // Cache-First: Fetch from Firestore only if stored subcategories were empty
    if (!storedSubcat) {
      fetchCollectionFromFirestore<SubcategoryItem>('subcategories').then(fsSubcats => {
        if (fsSubcats && fsSubcats.length > 0) {
          const sanitized = sanitizeSubcategoriesList([...loadedSubcats, ...fsSubcats]);
          const seenKeys = new Set<string>();
          const seenIds = new Set<string>();
          const deduped: SubcategoryItem[] = [];
          for (const s of sanitized) {
            const key = `${s.name.trim().toLowerCase()}|${(s.parentCategory || '').trim().toLowerCase()}`;
            if (!seenKeys.has(key) && !seenIds.has(s.id)) {
              seenKeys.add(key);
              seenIds.add(s.id);
              deduped.push(s);
            }
          }
          setSubcategories(deduped);
          localStorage.setItem('orjon_subcategories', JSON.stringify(deduped));
        }
      }).catch(() => {});
    }

    // Check active user login sessions (localStorage or sessionStorage) with Inactivity Session Timeout check
    const activeUserPhone = localStorage.getItem('orjon_session_user') || sessionStorage.getItem('orjon_session_user') || localStorage.getItem('medha_session_user');

    const lastActStr = localStorage.getItem('orjon_last_activity');
    const storedTimeoutMins = parseInt(localStorage.getItem('orjon_session_timeout_minutes') || '15', 10);
    const timeoutMs = storedTimeoutMins * 60 * 1000;
    const lastAct = lastActStr ? parseInt(lastActStr, 10) : 0;
    const nowMs = Date.now();

    const isSessionTimedOut = lastAct > 0 && (nowMs - lastAct > timeoutMs);

    if (isSessionTimedOut && activeUserPhone) {
      localStorage.removeItem('orjon_session_user');
      localStorage.removeItem('medha_session_user');
      sessionStorage.removeItem('orjon_session_user');
      setSessionTimeoutNotice(`দীর্ঘক্ষণ (${storedTimeoutMins} মিনিট) নিষ্ক্রিয় থাকার কারণে সিকিউরিটি পলিসি অনুযায়ী আপনার সেশনটি অটোমেটিক টাইমআউট হয়েছে। অনুগ্রহ করে পুনরায় লগইন করুন।`);
    } else if (activeUserPhone) {
      const allUsers: User[] = JSON.parse(localStorage.getItem('orjon_users') || localStorage.getItem('medha_users') || '[]');
      const found = allUsers.find(u => 
        (u.phone && u.phone === activeUserPhone) || 
        (u.userId && u.userId === activeUserPhone) || 
        (u.email && u.email.toLowerCase() === activeUserPhone.toLowerCase())
      );
      if (found) {
        setCurrentUser(found);
        localStorage.setItem('orjon_last_activity', nowMs.toString());
      }
    }
  }, []);

  // Synchronize Firebase Auth State & Strictly Enforce Server-Side Custom Claims for Admin
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        try {
          // Inspect current token claims
          let tokenResult = await fbUser.getIdTokenResult();
          let hasAdminClaim = tokenResult.claims.admin === true;

          // Check if this is an authorized admin user whose claims need to be populated
          const emailLower = (fbUser.email || '').toLowerCase().trim();
          const isAuthorizedAdmin = emailLower === 'mohidur143@gmail.com';

          if (!hasAdminClaim && isAuthorizedAdmin) {
            try {
              const idToken = await fbUser.getIdToken(true);
              const resp = await fetch('/api/admin/set-admin-claims', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken })
              });
              const data = await resp.json();
              if (data.success && data.admin) {
                // Force token refresh to fetch the newly assigned claims
                tokenResult = await fbUser.getIdTokenResult(true);
                hasAdminClaim = tokenResult.claims.admin === true;
              }
            } catch (claimErr) {
              console.warn("Backend admin claim sync notice:", claimErr);
            }
          }

          // STRICT ADMIN ACCESS RULE: User is ONLY admin if token claims.admin === true
          setIsAdmin(hasAdminClaim === true);

          // If regular user, update currentUser
          if (!hasAdminClaim && fbUser.email) {
            const allUsers: User[] = JSON.parse(localStorage.getItem('orjon_users') || '[]');
            const matched = allUsers.find(u => u.email && u.email.toLowerCase() === fbUser.email?.toLowerCase());
            if (matched) {
              setCurrentUser(matched);
            }
          }
        } catch (err) {
          console.error("Error inspecting Firebase Auth Token claims:", err);
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
    });

    return () => {
      unsubscribeAuth();
    };
  }, []);

  // Real-time Session Inactivity Monitoring & Auto-Logout Effect
  useEffect(() => {
    if (!currentUser && !isAdmin) {
      setShowInactivityWarning(false);
      return;
    }

    let lastWriteTime = Date.now();
    if (!localStorage.getItem('orjon_last_activity')) {
      localStorage.setItem('orjon_last_activity', lastWriteTime.toString());
    }

    const handleUserActivity = () => {
      const now = Date.now();
      // Throttle localStorage updates to once every 5 seconds for optimal performance
      if (now - lastWriteTime > 5000) {
        lastWriteTime = now;
        localStorage.setItem('orjon_last_activity', now.toString());
        setShowInactivityWarning(false);
      }
    };

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click', 'focus'];
    activityEvents.forEach(evt => window.addEventListener(evt, handleUserActivity, { passive: true }));

    const intervalId = setInterval(() => {
      const lastActStr = localStorage.getItem('orjon_last_activity');
      const lastAct = lastActStr ? parseInt(lastActStr, 10) : lastWriteTime;
      const now = Date.now();
      const timeoutMinutes = parseInt(localStorage.getItem('orjon_session_timeout_minutes') || '15', 10);
      const timeoutMs = timeoutMinutes * 60 * 1000;
      const warningMs = Math.max(0, timeoutMs - 60000); // 1 minute warning window

      const elapsed = now - lastAct;

      if (elapsed >= timeoutMs) {
        // Force Auto Logout due to session inactivity
        const sessionType = isAdmin ? 'এডমিন' : 'ব্যবহারকারী';
        setCurrentUser(null);
        setIsAdmin(false);
        localStorage.removeItem('orjon_session_user');
        localStorage.removeItem('medha_session_user');
        localStorage.removeItem('orjon_session_admin');
        localStorage.removeItem('medha_session_admin');
        sessionStorage.removeItem('orjon_session_user');
        sessionStorage.removeItem('orjon_session_admin');
        setShowInactivityWarning(false);
        setSessionTimeoutNotice(`⚠️ সেশন টাইমআউট! ${timeoutMinutes} মিনিট কোনো কার্যক্রম না থাকায় নিরাপত্তার স্বার্থে আপনার ${sessionType} অ্যাকাউন্ট স্বয়ংক্রিয়ভাবে লগআউট করা হয়েছে।`);
        setAuthScreen('login');
      } else if (elapsed >= warningMs) {
        setShowInactivityWarning(true);
      } else {
        setShowInactivityWarning(false);
      }
    }, 5000);

    return () => {
      activityEvents.forEach(evt => window.removeEventListener(evt, handleUserActivity));
      clearInterval(intervalId);
    };
  }, [currentUser, isAdmin]);

  // Helper functions to update state and persistence together
  const updateCategoriesDB = (newC: CategoryItem[]) => {
    setCategories(newC);
    localStorage.setItem('orjon_categories', JSON.stringify(newC));
  };

  const syncSubcategoriesWithFirestoreQuestions = async (questionsList: Question[]) => {
    let fsSubcats: SubcategoryItem[] = [];
    try {
      fsSubcats = await fetchCollectionFromFirestore<SubcategoryItem>('subcategories');
    } catch (err) {
      console.warn('Subcategories fetch notice:', err);
    }

    let combinedSubcats = [...fsSubcats];

    const addedKeys = new Set<string>(
      combinedSubcats.map(s => `${s.name.trim().toLowerCase()}|${(s.parentCategory || '').trim().toLowerCase()}`)
    );

    // Only sync SUBJECT hierarchy categories/subcategories from question records.
    // NEVER auto-create categories from upload destination or exam hierarchy.
    questionsList.forEach((q, idx) => {
      const subjCat = (q.subjectCategory || q.csvCategory || '').trim();
      const subjSub = (q.subjectSubcategory || q.csvSubcategory || '').trim();

      if (subjCat && !isJobSolutionVariation(subjCat) && !isYearJobSolutionVariation(subjCat) && subjCat !== 'বিষয়ভিত্তিক প্রস্তুতি' && subjCat !== 'সাধারণ জ্ঞান') {
        const key = `${subjCat.toLowerCase()}|বিষয়ভিত্তিক প্রস্তুতি`;
        if (!addedKeys.has(key)) {
          addedKeys.add(key);
          combinedSubcats.push({
            id: `fs-subcat-cat-${idx}-${Math.random().toString(36).substr(2, 5)}`,
            name: subjCat,
            parentCategory: 'বিষয়ভিত্তিক প্রস্তুতি'
          });
        }
      }

      if (subjCat && subjSub && subjSub.toLowerCase() !== subjCat.toLowerCase() && !isJobSolutionVariation(subjSub) && !isYearJobSolutionVariation(subjSub) && !isJobSolutionVariation(subjCat) && !isYearJobSolutionVariation(subjCat)) {
        const targetParent = subjCat || 'সাধারণ জ্ঞান';
        const key = `${subjSub.toLowerCase()}|${targetParent.toLowerCase()}`;
        if (!addedKeys.has(key)) {
          addedKeys.add(key);
          combinedSubcats.push({
            id: `fs-subcat-sub-${idx}-${Math.random().toString(36).substr(2, 5)}`,
            name: subjSub,
            parentCategory: targetParent,
            date: q.date || undefined
          });
        }
      }
    });

    const defaultYearList = ['২০২৬ সাল', '২০২৫ সাল', '২০২৪ সাল', '২০২৩ সাল', '২০২২ সাল', '২০২১ সাল', '২০২০ সাল', '২০১৯ সাল', '২০১৮ সাল', '২০১৭ সাল', '২০১৬ সাল', '২০১৫ সাল'];
    defaultYearList.forEach((yr, idx) => {
      const key = `${yr.toLowerCase()}|সাল ভিত্তিক জব সলিউশন`;
      if (!addedKeys.has(key)) {
        addedKeys.add(key);
        combinedSubcats.push({
          id: `subcat-year-seed-${yr}-${idx}`,
          name: yr,
          parentCategory: 'সাল ভিত্তিক জব সলিউশন'
        });
      }
    });

    const sanitized = sanitizeSubcategoriesList(combinedSubcats);

    const seenIds = new Set<string>();
    const seenKeys = new Set<string>();
    const finalSubcats: SubcategoryItem[] = [];
    for (const s of sanitized) {
      const key = `${s.name.trim().toLowerCase()}|${(s.parentCategory || '').trim().toLowerCase()}`;
      if (!seenIds.has(s.id) && !seenKeys.has(key)) {
        seenIds.add(s.id);
        seenKeys.add(key);
        finalSubcats.push(s);
      }
    }

    setSubcategories(finalSubcats);
    localStorage.setItem('orjon_subcategories', JSON.stringify(finalSubcats));
  };

  const sanitizeSubcategoriesList = (subs: SubcategoryItem[]): SubcategoryItem[] => {
    const seenIds = new Set<string>();
    const seenNameParent = new Set<string>();
    const result: SubcategoryItem[] = [];

    // Collect all subcategories that exist under a specific non-root intermediate parent (e.g. "৫২তম বিসিএস" under "বিসিএস পরীক্ষা")
    const namesWithSpecificParent = new Set<string>();
    for (const s of (subs || [])) {
      if (!s || !s.name || !s.parentCategory) continue;
      const pNorm = s.parentCategory.trim().toLowerCase();
      const isRootP = pNorm === 'বিষয়ভিত্তিক প্রস্তুতি'.toLowerCase() ||
                      pNorm === 'জব সলিউশন পরীক্ষা'.toLowerCase() ||
                      pNorm === 'সাল ভিত্তিক জব সলিউশন'.toLowerCase() ||
                      pNorm === 'সাম্প্রতিক বিষয়াবলী'.toLowerCase() ||
                      isJobSolutionVariation(pNorm) ||
                      isYearJobSolutionVariation(pNorm) ||
                      isCurrentAffairVariation(pNorm);
      if (!isRootP) {
        namesWithSpecificParent.add(s.name.trim().toLowerCase());
      }
    }

    for (const sub of (subs || [])) {
      if (!sub) continue;
      const id = sub.id;
      const nameNorm = sub.name ? sub.name.trim().toLowerCase() : '';
      const parentNorm = sub.parentCategory ? sub.parentCategory.trim().toLowerCase() : '';

      if (!nameNorm) continue;
      if (nameNorm === 'বিষয়ভিত্তিক প্রস্তুতি'.toLowerCase() ||
          nameNorm === 'জব সলিউশন পরীক্ষা'.toLowerCase() ||
          nameNorm === 'সাল ভিত্তিক জব সলিউশন'.toLowerCase() ||
          isJobSolutionVariation(nameNorm) ||
          isYearJobSolutionVariation(nameNorm)) {
        continue;
      }
      if (parentNorm && nameNorm === parentNorm) {
        continue;
      }

      // CRITICAL RULE: If a subcategory already exists under a specific child parent (e.g., "৫২তম বিসিএস" under "বিসিএস পরীক্ষা"),
      // NEVER allow a duplicate to exist directly attached to the root "জব সলিউশন পরীক্ষা" / "জব সলিউশন ব্যাংক".
      if (namesWithSpecificParent.has(nameNorm) && (isJobSolutionVariation(parentNorm) || isYearJobSolutionVariation(parentNorm))) {
        continue;
      }

      // Prohibit duplicates of category / subcategory / leaf category within same parent/root category
      const nameParentKey = `${nameNorm}|${parentNorm}`;
      if (id && seenIds.has(id)) continue;
      if (seenNameParent.has(nameParentKey)) continue;

      if (id) seenIds.add(id);
      seenNameParent.add(nameParentKey);
      result.push(sub);
    }

    return result;
  };

  const dedupeQuestions = (qList: Question[]): Question[] => {
    const seenIds = new Set<string>();
    const seenTextKey = new Set<string>();
    const result: Question[] = [];

    for (const q of (qList || [])) {
      if (!q) continue;
      const id = q.id;
      const catNorm = (q.category || '').trim().toLowerCase();
      const subNorm = (q.subcategory || '').trim().toLowerCase();
      const textNorm = (q.text || (q as any).question || '').trim().toLowerCase();

      if (id && seenIds.has(id)) continue;

      const key = `${catNorm}|${subNorm}|${textNorm}`;
      if (textNorm && seenTextKey.has(key)) continue;

      if (id) seenIds.add(id);
      if (textNorm) seenTextKey.add(key);
      result.push(q);
    }
    return result;
  };

  const updateSubcategoriesDB = (newS: SubcategoryItem[]) => {
    const sanitized = sanitizeSubcategoriesList(newS);
    setSubcategories(sanitized);
    localStorage.setItem('orjon_subcategories', JSON.stringify(sanitized));
  };

  const updateQuestionsDB = (newQ: Question[]) => {
    const dedupedQ = dedupeQuestions(newQ);
    setQuestions(dedupedQ);
    saveQuestionsToIDB(dedupedQ);
    try {
      localStorage.setItem('orjon_questions', JSON.stringify(dedupedQ));
    } catch (e) {
      console.warn("localStorage quota exceeded for questions stringify, relying on IndexedDB:", e);
    }
  };

  const updateNoticesDB = (newN: Notice[]) => {
    setNotices(newN);
    localStorage.setItem('orjon_notices', JSON.stringify(newN));
    syncCollectionToFirestore('notices', newN, 'notice');
  };

  const dedupeRoutines = (rList: Routine[]): Routine[] => {
    const map = new Map<string, Routine>();
    (rList || []).forEach(item => {
      if (item && item.id) {
        const nowIso = new Date().toISOString();
        const normalizedRoutine: Routine = {
          ...item,
          createdAt: item.createdAt || nowIso,
          updatedAt: item.updatedAt || item.createdAt || nowIso
        };
        map.set(item.id, normalizedRoutine);
      }
    });
    return Array.from(map.values());
  };

  const updateRoutinesDB = (newR: Routine[]) => {
    const deduped = dedupeRoutines(newR);
    setRoutines(deduped);
    localStorage.setItem('orjon_routines', JSON.stringify(deduped));
    saveRoutinesToIDB(deduped);
    syncCollectionToFirestore('routines', deduped, 'rt');
  };

  const dedupeCourses = (cList: Course[]): Course[] => {
    const map = new Map<string, Course>();
    (cList || []).forEach(item => {
      if (item && item.id) {
        const nowIso = new Date().toISOString();
        const normalizedCourse: Course = {
          ...item,
          createdAt: item.createdAt || nowIso,
          updatedAt: item.updatedAt || item.createdAt || nowIso
        };
        map.set(item.id, normalizedCourse);
      }
    });
    return Array.from(map.values());
  };

  const updateCoursesDB = (newC: Course[]) => {
    const deduped = dedupeCourses(newC);
    setCourses(deduped);
    localStorage.setItem('orjon_courses', JSON.stringify(deduped));
    saveCoursesToIDB(deduped);
    syncCollectionToFirestore('courses', deduped, 'course');
  };

  const dedupeLiveExams = (exams: LiveExam[]): LiveExam[] => {
    const map = new Map<string, LiveExam>();
    (exams || []).forEach(item => {
      if (item && item.id) {
        const nowIso = new Date().toISOString();
        const normalizedExam: LiveExam = {
          ...item,
          createdAt: item.createdAt || nowIso,
          updatedAt: item.updatedAt || item.createdAt || nowIso
        };
        map.set(item.id, normalizedExam);
      }
    });
    return Array.from(map.values());
  };

  const updateLiveExamsDB = (newLE: LiveExam[]) => {
    const deduped = dedupeLiveExams(newLE);
    setLiveExams(deduped);
    localStorage.setItem('orjon_live_exams', JSON.stringify(deduped));
    saveLiveExamsToIDB(deduped);
    syncCollectionToFirestore('live_exams', deduped, 'le');
  };

  const updateUsersDB = (newU: User[]) => {
    const userMap = new Map<string, User>();
    newU.forEach(u => {
      const { password, ...rest } = u as any;
      const sanitizedUser: User = { ...rest };
      const k = (sanitizedUser.phone || sanitizedUser.userId || sanitizedUser.email || '').toLowerCase().trim();
      if (k) userMap.set(k, sanitizedUser);
    });
    const dedupedUsers = Array.from(userMap.values());
    setUsers(dedupedUsers);
    localStorage.setItem('orjon_users', JSON.stringify(dedupedUsers));
    // REQUIREMENT 3: Without verifying user's email, don't store data in Firebase
    const verifiedUsersOnly = dedupedUsers.filter(u => u.emailVerified === true);
    syncCollectionToFirestore('users', verifiedUsersOnly, 'user');
  };

  const updateAttemptsDB = (newA: Attempt[]) => {
    setAttempts(newA);
    localStorage.setItem('orjon_attempts', JSON.stringify(newA));
    // REQUIREMENT: Chapter/Custom/Demo exam results are stored ONLY in localStorage and NOT synced to Firebase.
    // Official Live Exam results are stored in localStorage AND synced to Firebase.
    const officialAttemptsOnly = newA.filter(a => 
      !a.examId.startsWith('prep_') && 
      !a.examId.startsWith('job_') && 
      !a.examId.startsWith('custom_') && 
      !a.examId.startsWith('demo_')
    );
    syncCollectionToFirestore('attempts', officialAttemptsOnly, 'att');
  };

  const updateBookmarksDB = (newB: Bookmark[]) => {
    setBookmarks(newB);
    localStorage.setItem('orjon_bookmarks', JSON.stringify(newB));
    syncCollectionToFirestore('bookmarks', newB, 'bm');
  };

  const handleToggleUserExplanation = (allowed: boolean) => {
    setAllowUserExplanation(allowed);
    localStorage.setItem('orjon_allow_user_explanation', allowed ? 'true' : 'false');
  };

  // 2. Authentication Logic (Unified Login for both User and Admin)
  const handleUserLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginErrorMessage(null);
    const query = phoneInput.trim().toLowerCase();
    const pass = passwordInput.trim();

    if (!query || !pass) {
      setLoginErrorMessage('Please enter your User ID, Email, or Username, and Password.');
      return;
    }

    // A. Check if Admin Login attempt
    const isAdminAttempt = 
      query === 'admin' || 
      query === 'mohidur143@gmail.com' ||
      pass === adminPassword;

    if (isAdminAttempt && (pass === adminPassword || query === 'mohidur143@gmail.com' || query === 'admin')) {
      const adminEmail = query === 'admin' ? 'mohidur143@gmail.com' : query;
      let firebaseUser = null;

      // Authenticate with Firebase Auth
      try {
        const userCred = await signInWithEmailAndPassword(auth, adminEmail, pass);
        firebaseUser = userCred.user;
      } catch (fbErr: any) {
        if (fbErr.code === 'auth/user-not-found' || fbErr.code === 'auth/invalid-credential' || fbErr.code === 'auth/wrong-password') {
          try {
            const regCred = await createUserWithEmailAndPassword(auth, adminEmail, pass);
            firebaseUser = regCred.user;
          } catch (regErr) {
            console.warn("Firebase Auth Admin registration notice:", regErr);
          }
        }
      }

      if (firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken(true);
          const claimResp = await fetch('/api/admin/set-admin-claims', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken })
          });
          const claimData = await claimResp.json();
          if (claimData.success) {
            await firebaseUser.getIdTokenResult(true);
          }
        } catch (claimErr) {
          console.warn("Backend admin claim assignment notice:", claimErr);
        }
      }

      if (pass === adminPassword || firebaseUser) {
        setIsAdmin(true);
        localStorage.setItem('orjon_last_activity', Date.now().toString());
        setSessionTimeoutNotice(null);
        setShowInactivityWarning(false);
        setPhoneInput('');
        setPasswordInput('');
        return;
      } else {
        setLoginErrorMessage('ভুল এডমিন পাসওয়ার্ড অথবা ইউজারনেম!');
        return;
      }
    }

    // B. User Login check (Strictly Firebase Auth verification)
    const found = users.find(u => 
      (u.phone && u.phone.trim().toLowerCase() === query) ||
      (u.userId && u.userId.trim().toLowerCase() === query) ||
      (u.email && u.email.trim().toLowerCase() === query)
    );

    const userEmailToAuth = found?.email || (query.includes('@') ? query : '');

    if (!userEmailToAuth) {
      setLoginErrorMessage('No account found with this identifier. Please enter your registered email address.');
      return;
    }

    let isVerified = false;
    let firebaseUser = null;

    try {
      const userCred = await signInWithEmailAndPassword(auth, userEmailToAuth, pass);
      firebaseUser = userCred.user;
      if (firebaseUser) {
        await reload(firebaseUser);
        isVerified = firebaseUser.emailVerified;
      }
    } catch (fbErr: any) {
      console.warn("Firebase Auth user login notice:", fbErr);
      if (fbErr.code === 'auth/wrong-password' || fbErr.code === 'auth/invalid-credential') {
        setLoginErrorMessage('Invalid password. Please check your credentials.');
      } else if (fbErr.code === 'auth/user-not-found') {
        setLoginErrorMessage('No account found with this email in Firebase Auth.');
      } else if (fbErr.code === 'auth/invalid-email') {
        setLoginErrorMessage('Please enter a valid email address.');
      } else if (fbErr.code === 'auth/too-many-requests') {
        setLoginErrorMessage('Too many failed login attempts. Please try again later or reset your password.');
      } else {
        setLoginErrorMessage(fbErr.message || 'Login failed. Please check your credentials.');
      }
      return;
    }

    // REQUIREMENT 3: Without verifying user's email, don't store data in Firebase or log in
    if (!isVerified) {
      if (firebaseUser) {
        try {
          await sendEmailVerification(firebaseUser);
        } catch (verErr) {
          console.warn("Verification email notice:", verErr);
        }
      }
      if (found) {
        setPendingUser(found);
      } else {
        setPendingUser({
          email: userEmailToAuth,
          emailVerified: false,
          phone: '',
          name: userEmailToAuth.split('@')[0],
          gender: 'Other',
          education: 'General',
          avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(userEmailToAuth)}`,
          lifetimeAnswered: 0,
          lifetimeCorrect: 0,
          lifetimeWrong: 0,
          createdAt: new Date().toISOString()
        });
      }
      setAuthScreen('register');
      setRegStep('verify');
      setOtpDeliveryMessage({
        text: `Email not verified yet. A verification link has been sent to ${userEmailToAuth}. Please check your inbox and verify before logging in.`,
        isError: true
      });
      setResendCooldown(30);
      return;
    }

    // Email is verified: log in user
    const activeUser: User = found ? {
      ...found,
      userId: found.userId || generateAutoUserId(),
      emailVerified: true
    } : {
      userId: generateAutoUserId(),
      email: userEmailToAuth,
      emailVerified: true,
      phone: '',
      name: userEmailToAuth.split('@')[0],
      gender: 'Other',
      education: 'General',
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(userEmailToAuth)}`,
      lifetimeAnswered: 0,
      lifetimeCorrect: 0,
      lifetimeWrong: 0,
      createdAt: new Date().toISOString()
    };

    // Save/update verified user in DB
    if (!users.some(u => u.email?.toLowerCase() === activeUser.email?.toLowerCase())) {
      updateUsersDB([...users, activeUser]);
    } else {
      const updatedUsers = users.map(u => 
        u.email?.toLowerCase() === activeUser.email?.toLowerCase() ? { ...u, emailVerified: true } : u
      );
      updateUsersDB(updatedUsers);
    }

    setCurrentUser(activeUser);
    associateGuestAttemptsWithUser(activeUser);
    localStorage.setItem('orjon_last_activity', Date.now().toString());
    setSessionTimeoutNotice(null);
    setShowInactivityWarning(false);

    if (rememberMe) {
      localStorage.setItem('orjon_session_user', activeUser.phone || activeUser.userId || activeUser.email || '');
      localStorage.setItem('orjon_remember_me', 'true');
    } else {
      sessionStorage.setItem('orjon_session_user', activeUser.phone || activeUser.userId || activeUser.email || '');
      localStorage.removeItem('orjon_session_user');
    }

    setPhoneInput('');
    setPasswordInput('');
  };

  const handleUserRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = regName.trim();
    const email = regEmail.trim();
    const pass = regPassword.trim();
    const confirmPass = regConfirmPassword.trim();

    const errors: Record<string, string> = {};

    if (!name) {
      errors.name = 'Full name is required.';
    }

    if (!email) {
      errors.email = 'Email address is required.';
    } else if (!email.includes('@') || !email.includes('.') || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = 'Please enter a valid email address.';
    } else if (users.some(u => u.email?.toLowerCase() === email.toLowerCase() && u.emailVerified)) {
      errors.email = 'An account with this email address already exists.';
    }

    if (!pass) {
      errors.password = 'Password is required.';
    } else if (pass.length < 6) {
      errors.password = 'Password must be at least 6 characters long.';
    }

    if (!confirmPass) {
      errors.confirmPassword = 'Confirm password is required.';
    } else if (pass && pass !== confirmPass) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    if (Object.keys(errors).length > 0) {
      setRegErrors(errors);
      setRegGeneralError('Please correct the highlighted fields.');
      return;
    }

    setRegErrors({});
    setRegGeneralError(null);

    // User ID is created ONLY after email verification; phone is not set at registration
    const newTempUser: User = {
      email,
      emailVerified: false,
      phone: '',
      name,
      gender: regGender || 'Other',
      education: regEducation.trim() || 'General',
      avatar: regAvatar.trim() || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(email)}`,
      lifetimeAnswered: 0,
      lifetimeCorrect: 0,
      lifetimeWrong: 0,
      createdAt: new Date().toISOString()
    };

    // FIREBASE EMAIL AUTHENTICATION REGISTER & VERIFICATION
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      const firebaseUser = userCredential.user;

      if (firebaseUser) {
        await sendEmailVerification(firebaseUser);
        console.log("Firebase verification email sent successfully to:", email);
      }
    } catch (fbError: any) {
      console.warn("Firebase Auth Register warning:", fbError);
      if (fbError.code === 'auth/email-already-in-use') {
        setRegErrors({ email: 'An account with this email already exists in Firebase Auth.' });
        setRegGeneralError('An account with this email already exists.');
        return;
      } else if (fbError.code === 'auth/invalid-email') {
        setRegErrors({ email: 'Please enter a valid email address.' });
        setRegGeneralError('Invalid email address format.');
        return;
      } else if (fbError.code === 'auth/weak-password') {
        setRegErrors({ password: 'Password must be at least 6 characters long.' });
        setRegGeneralError('Password is too weak (must be at least 6 characters).');
        return;
      } else {
        setRegGeneralError(fbError.message || 'Registration failed. Please check your information and try again.');
        return;
      }
    }

    // REQUIREMENT 3: DO NOT save in Firestore DB before email is verified!
    setPendingUser(newTempUser);
    setRegStep('verify');
    setOtpDeliveryMessage({
      text: `A verification link has been sent to ${email}. Please check your inbox or spam folder and click the link to verify.`,
      isError: false
    });
    setResendCooldown(60);
  };

  const handleCheckEmailVerificationStatus = async () => {
    setIsSendingOtp(true);
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        await reload(currentUser);
        if (currentUser.emailVerified) {
          if (pendingUser) {
            const newUserId = pendingUser.userId || generateAutoUserId();
            const verifiedUser: User = {
              ...pendingUser,
              userId: newUserId,
              emailVerified: true
            };
            setPendingUser(verifiedUser);
            // Save user to Firestore ONLY AFTER email is verified
            const updatedUsers = users.map(u => u.email?.toLowerCase() === pendingUser.email?.toLowerCase() ? verifiedUser : u);
            if (!users.some(u => u.email?.toLowerCase() === pendingUser.email?.toLowerCase())) {
              updatedUsers.push(verifiedUser);
            }
            updateUsersDB(updatedUsers);
            associateGuestAttemptsWithUser(verifiedUser);
          }
          setOtpDeliveryMessage({
            text: 'Your email has been verified successfully!',
            isError: false
          });
          setRegStep('success');
          setIsSendingOtp(false);
          return;
        }
      }

      setOtpDeliveryMessage({
        text: `Email not verified yet. Please check your email (${pendingUser?.email || auth.currentUser?.email}) and click the verification link.`,
        isError: true
      });
    } catch (err: any) {
      console.warn("Check verification status error:", err);
      setOtpDeliveryMessage({
        text: `Error checking verification status: ${err.message || 'Please try again.'}`,
        isError: true
      });
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleResendFirebaseVerification = async () => {
    if (resendCooldown > 0 || isSendingOtp) return;
    setIsSendingOtp(true);
    setOtpDeliveryMessage({ text: 'Sending verification email...', isError: false });

    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        await sendEmailVerification(currentUser);
        setOtpDeliveryMessage({
          text: `Verification link successfully resent to ${pendingUser?.email || currentUser.email}. (Check inbox/spam folder)`,
          isError: false
        });
        setResendCooldown(60);
      } else {
        setOtpDeliveryMessage({
          text: 'Unable to resend verification link. Please try logging in to trigger a new verification link.',
          isError: true
        });
      }
    } catch (err: any) {
      console.warn("Firebase email verification resend error:", err);
      setOtpDeliveryMessage({
        text: `Error sending email: ${err.message || 'Could not send verification link.'}`,
        isError: true
      });
    } finally {
      setIsSendingOtp(false);
    }
  };

  // 3. Forgot Password Handlers (Firebase Authentication sendPasswordResetEmail)
  const handleForgotRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = forgotQuery.trim().toLowerCase();
    if (!q) {
      alert('Please enter your registered email address, User ID, or mobile number.');
      return;
    }

    const found = users.find(u => 
      (u.email && u.email.trim().toLowerCase() === q) ||
      (u.userId && u.userId.trim().toLowerCase() === q) ||
      (u.phone && u.phone.trim() === q)
    );

    const targetEmail = found?.email || (q.includes('@') ? q : '');

    if (!targetEmail) {
      alert('No registered email found for this account. Please enter your registered email address.');
      return;
    }

    setIsSendingOtp(true);
    setOtpDeliveryMessage({ text: 'Sending password reset email...', isError: false });

    try {
      await sendPasswordResetEmail(auth, targetEmail);
      setForgotUser(found || null);
      setForgotTargetEmail(targetEmail);
      setForgotStep('sent');
      setOtpDeliveryMessage({
        text: `A secure password reset link has been dispatched by Firebase Authentication to ${targetEmail}. Please check your inbox (and spam folder) and click the link to reset your password.`,
        isError: false
      });
      setResendCooldown(60);
    } catch (fbErr: any) {
      console.warn("Firebase sendPasswordResetEmail error:", fbErr);
      if (fbErr.code === 'auth/user-not-found') {
        alert('No registered account found with this email in Firebase Auth.');
      } else if (fbErr.code === 'auth/invalid-email') {
        alert('Please enter a valid email address.');
      } else {
        alert(`Failed to send password reset email: ${fbErr.message || 'Please try again.'}`);
      }
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleForgotResendOtp = async () => {
    if (resendCooldown > 0 || isSendingOtp) return;
    const targetEmail = forgotTargetEmail || forgotUser?.email || (forgotQuery.includes('@') ? forgotQuery.trim() : '');
    if (!targetEmail) return;

    setIsSendingOtp(true);
    setOtpDeliveryMessage({ text: 'Resending password reset email...', isError: false });

    try {
      await sendPasswordResetEmail(auth, targetEmail);
      setOtpDeliveryMessage({
        text: `Password reset link successfully resent to ${targetEmail}! Please check your inbox/spam folder.`,
        isError: false
      });
      setResendCooldown(60);
    } catch (fbErr: any) {
      console.warn("Firebase resend password reset email error:", fbErr);
      setOtpDeliveryMessage({
        text: `Failed to resend email: ${fbErr.message || 'Please try again.'}`,
        isError: true
      });
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleAdminVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = adminUsernameInput.trim().toLowerCase();
    const pass = adminPassInput.trim();
    const adminEmail = query.includes('@') ? query : 'mohidur143@gmail.com';

    if (!pass) {
      alert('অনুগ্রহ করে এডমিন পাসওয়ার্ড প্রদান করুন!');
      return;
    }

    const isAuthorized = adminEmail === 'mohidur143@gmail.com';

    if (!isAuthorized && pass !== adminPassword) {
      alert('ভুল এডমিন ইউজারনেম অথবা পাসওয়ার্ড!');
      return;
    }

    try {
      let firebaseUser = auth.currentUser;
      
      // Sign in if not authenticated or different account
      if (!firebaseUser || firebaseUser.email?.toLowerCase() !== adminEmail) {
        try {
          const cred = await signInWithEmailAndPassword(auth, adminEmail, pass);
          firebaseUser = cred.user;
        } catch (signInErr: any) {
          if (signInErr.code === 'auth/user-not-found' || signInErr.code === 'auth/invalid-credential' || signInErr.code === 'auth/wrong-password') {
            try {
              const newCred = await createUserWithEmailAndPassword(auth, adminEmail, pass);
              firebaseUser = newCred.user;
            } catch (createErr: any) {
              console.warn("Firebase Auth Admin registration note:", createErr);
              if (pass === adminPassword || isAuthorized) {
                console.log("Local system admin password matched.");
              }
            }
          }
        }
      }

      if (firebaseUser) {
        try {
          const idToken = await firebaseUser.getIdToken(true);
          const claimResp = await fetch('/api/admin/set-admin-claims', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken })
          });
          const claimData = await claimResp.json();
          if (claimData.success) {
            await firebaseUser.getIdTokenResult(true);
          }
        } catch (claimErr) {
          console.warn("Custom claims backend sync notice:", claimErr);
        }
      }

      if (pass === adminPassword || firebaseUser) {
        setIsAdmin(true);
        localStorage.setItem('orjon_last_activity', Date.now().toString());
        setSessionTimeoutNotice(null);
        setShowInactivityWarning(false);
        setAdminPassInput('');
        return;
      }

      alert('ভুল এডমিন পাসওয়ার্ড! অনুগ্রহ করে সঠিক পাসওয়ার্ড দিন।');
    } catch (err: any) {
      console.error("Admin verify error:", err);
      if (pass === adminPassword) {
        setIsAdmin(true);
        localStorage.setItem('orjon_last_activity', Date.now().toString());
        setSessionTimeoutNotice(null);
        setShowInactivityWarning(false);
        setAdminPassInput('');
        return;
      }
      alert(`এডমিন লগইন ব্যর্থ হয়েছে: ${err.message || 'ভুল এডমিন পাসওয়ার্ড! অনুগ্রহ করে সঠিক পাসওয়ার্ড দিন।'}`);
    }
  };

  const handleAdminForgotRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = adminForgotQuery.trim().toLowerCase();
    if (!q) {
      alert('অনুগ্রহ করে এডমিন ইমেইল অথবা ইউজারনেম প্রদান করুন!');
      return;
    }
    const targetEmail = q.includes('@') ? q : 'mohidur143@gmail.com';

    setIsSendingOtp(true);
    setOtpDeliveryMessage({ text: 'এডমিন পাসওয়ার্ড রিসেট ইমেইল পাঠানো হচ্ছে...', isError: false });

    try {
      await sendPasswordResetEmail(auth, targetEmail);
      setAdminLoginSubStep('forgot-sent');
      setOtpDeliveryMessage({
        text: `Firebase Authentication এর মাধ্যমে এডমিন সিকিউরিটি ইমেইল (${targetEmail})-এ সফলভাবে পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে!`,
        isError: false
      });
      setResendCooldown(60);
    } catch (fbErr: any) {
      console.warn("Firebase admin sendPasswordResetEmail error:", fbErr);
      alert(`এডমিন পাসওয়ার্ড রিসেট ইমেইল পাঠানো ব্যর্থ হয়েছে: ${fbErr.message || 'অনুগ্রহ করে সঠিক ইমেইল দিন।'}`);
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleAdminForgotResendOtp = async () => {
    if (resendCooldown > 0 || isSendingOtp) return;
    const q = adminForgotQuery.trim().toLowerCase();
    const targetEmail = q.includes('@') ? q : 'mohidur143@gmail.com';

    setIsSendingOtp(true);
    setOtpDeliveryMessage({ text: 'এডমিন পাসওয়ার্ড রিসেট ইমেইল পুনরায় পাঠানো হচ্ছে...', isError: false });

    try {
      await sendPasswordResetEmail(auth, targetEmail);
      setOtpDeliveryMessage({
        text: `এডমিন পাসওয়ার্ড রিসেট লিংক সফলভাবে (${targetEmail})-এ পুনরায় পাঠানো হয়েছে! (Inbox/Spam ফোল্ডার চেক করুন)`,
        isError: false
      });
      setResendCooldown(60);
    } catch (fbErr: any) {
      console.warn("Firebase admin resend reset email error:", fbErr);
      setOtpDeliveryMessage({
        text: `ইমেইল পাঠানো ব্যর্থ হয়েছে: ${fbErr.message || 'আবার চেষ্টা করুন।'}`,
        isError: true
      });
    } finally {
      setIsSendingOtp(false);
    }
  };

  const [showLogoutConfirmModal, setShowLogoutConfirmModal] = useState(false);

  const requestLogoutConfirmation = () => {
    setShowLogoutConfirmModal(true);
  };

  const confirmLogout = () => {
    setShowLogoutConfirmModal(false);
    handleLogout();
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.warn("Sign out notice:", err);
    }
    setCurrentUser(null);
    setIsAdmin(false);
    localStorage.removeItem('orjon_session_user');
    localStorage.removeItem('medha_session_user');
    localStorage.removeItem('orjon_session_admin');
    localStorage.removeItem('medha_session_admin');
    localStorage.removeItem('orjon_last_activity');
    sessionStorage.removeItem('orjon_session_user');
    sessionStorage.removeItem('orjon_session_admin');
    setShowInactivityWarning(false);
    setAuthScreen('login');
  };

  // 3. Admin Wrapper Actions
  const ensureCategoryAndSubcategoryExist = (catName: string, subcatName?: string) => {
    const trimmedCat = catName ? catName.trim() : '';
    const trimmedSubcat = subcatName ? subcatName.trim() : '';
    
    let updatedSubcats = [...subcategories];
    let changed = false;

    const isRoot = (name: string) => {
      const norm = name.toLowerCase();
      return norm === 'বিষয়ভিত্তিক প্রস্তুতি'.toLowerCase() ||
             norm === 'জব সলিউশন পরীক্ষা'.toLowerCase() ||
             norm === 'সাল ভিত্তিক জব সলিউশন'.toLowerCase() ||
             norm === 'সাম্প্রতিক বিষয়াবলী'.toLowerCase() ||
             isJobSolutionVariation(norm) ||
             isYearJobSolutionVariation(norm);
    };

    // If a subject category is given, ensure it exists under 'বিষয়ভিত্তিক প্রস্তুতি'
    if (trimmedCat && !isRoot(trimmedCat)) {
      const catExists = updatedSubcats.some(s => 
        s.parentCategory && 
        s.parentCategory.trim().toLowerCase() === 'বিষয়ভিত্তিক প্রস্তুতি'.toLowerCase() &&
        s.name.trim().toLowerCase() === trimmedCat.toLowerCase()
      );
      if (!catExists) {
        const newSub: SubcategoryItem = {
          id: `subcat-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          name: trimmedCat,
          parentCategory: 'বিষয়ভিত্তিক প্রস্তুতি'
        };
        updatedSubcats.push(newSub);
        saveItemToFirestore('subcategories', newSub, 'subcat');
        changed = true;
      }
    }

    // Only create subcategory under a valid non-root parent category (subject parent), never under Job Solution root!
    if (trimmedSubcat && !isRoot(trimmedSubcat) && trimmedCat && !isRoot(trimmedCat) && trimmedSubcat.toLowerCase() !== trimmedCat.toLowerCase()) {
      const subcatExists = updatedSubcats.some(s => 
        s.parentCategory && 
        s.parentCategory.trim().toLowerCase() === trimmedCat.toLowerCase() &&
        s.name.trim().toLowerCase() === trimmedSubcat.toLowerCase()
      );
      if (!subcatExists) {
        const newSub: SubcategoryItem = {
          id: `subcat-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          name: trimmedSubcat,
          parentCategory: trimmedCat
        };
        updatedSubcats.push(newSub);
        saveItemToFirestore('subcategories', newSub, 'subcat');
        changed = true;
      }
    }

    if (changed) {
      updateSubcategoriesDB(updatedSubcats);
    }
  };

  const handleFetchQuestionsLazy = async (filter: { category?: string; subcategory?: string; topic?: string; examId?: string; forceRefresh?: boolean }): Promise<Question[]> => {
    const fetched = await fetchQuestionsLazyFromFirestore(filter);
    if (fetched && fetched.length > 0) {
      setQuestions(prev => {
        const map = new Map<string, Question>();
        prev.forEach(q => map.set(q.id, q));
        fetched.forEach(q => map.set(q.id, q));
        const merged = Array.from(map.values());
        saveQuestionsToIDB(merged);
        return merged;
      });
    }
    return fetched;
  };

  const handleLoadUsersOnDemand = async () => {
    try {
      const fsUsers = await fetchCollectionFromFirestore<User>('users');
      if (fsUsers && fsUsers.length > 0) {
        const fsMap = new Map<string, User>();
        fsUsers.forEach(u => {
          const k = (u.phone || u.userId || u.email || '').toLowerCase().trim();
          if (k) fsMap.set(k, u);
        });
        const dedupedFsUsers = Array.from(fsMap.values());
        setUsers(dedupedFsUsers);
        localStorage.setItem('orjon_users', JSON.stringify(dedupedFsUsers));
      }
    } catch (e) {
      console.warn('On-demand users load notice:', e);
    }
  };

  const handleLoadAttemptsOnDemand = async () => {
    try {
      const fsAttempts = await fetchCollectionFromFirestore<Attempt>('attempts');
      if (fsAttempts && fsAttempts.length > 0) {
        // Merge with local chapter/custom/demo attempts so local results remain preserved
        const localAttempts: Attempt[] = JSON.parse(localStorage.getItem('orjon_attempts') || '[]');
        const localOnlyAttempts = localAttempts.filter(a => 
          a.examId.startsWith('prep_') || 
          a.examId.startsWith('job_') || 
          a.examId.startsWith('custom_') || 
          a.examId.startsWith('demo_')
        );
        const combined = [...fsAttempts, ...localOnlyAttempts.filter(l => !fsAttempts.some(f => f.id === l.id))];
        setAttempts(combined);
        localStorage.setItem('orjon_attempts', JSON.stringify(combined));
      }
    } catch (e) {
      console.warn('On-demand attempts load notice:', e);
    }
  };

  const handleLoadAuditLogsOnDemand = async () => {
    try {
      const fsAudit = await fetchCollectionFromFirestore<AuditLog>('audit_logs');
      if (fsAudit && fsAudit.length > 0) {
        setAuditLogs(fsAudit);
        localStorage.setItem('orjon_audit_logs', JSON.stringify(fsAudit));
      }
    } catch (e) {
      console.warn('On-demand audit logs load notice:', e);
    }
  };

  const handleAddQuestion = (q: Omit<Question, 'id'>) => {
    let cat = q.category || '';
    if (isJobSolutionVariation(cat)) {
      cat = 'জব সলিউশন পরীক্ষা';
    }
    const newQuestion: Question = {
      id: `q_${Date.now()}`,
      ...q,
      category: cat
    };
    updateQuestionsDB([...questions, newQuestion]);
    addQuestionToFirestore(newQuestion);
    ensureCategoryAndSubcategoryExist(cat, q.subcategory);
    addAuditLog('প্রশ্ন তৈরি (Create)', `নতুন প্রশ্ন যোগ করা হয়েছে: "${q.text.slice(0, 45)}..." (${cat})`, 'create');
  };

  const handleUpdateQuestion = (id: string, q: Partial<Question>) => {
    let normalizedQ = { ...q };
    if (q.category && isJobSolutionVariation(q.category)) {
      normalizedQ.category = 'জব সলিউশন পরীক্ষা';
    }
    const updated = questions.map(item => item.id === id ? { ...item, ...normalizedQ } : item);
    updateQuestionsDB(updated);

    const updatedItem = updated.find(item => item.id === id);
    if (updatedItem) {
      addQuestionToFirestore(updatedItem);
    } else {
      updateQuestionInFirestore(id, normalizedQ);
    }

    if (normalizedQ.category || q.subcategory) {
      const existing = questions.find(item => item.id === id);
      const cat = normalizedQ.category || existing?.category || '';
      const sub = q.subcategory || existing?.subcategory || '';
      ensureCategoryAndSubcategoryExist(cat, sub);
    }
    addAuditLog('প্রশ্ন আপডেট (Update)', `প্রশ্ন সম্পাদনা/আপডেট করা হয়েছে (ID: ${id})`, 'update');
  };

  const handleDeleteQuestion = (id: string) => {
    const targetQ = questions.find(item => item.id === id);
    const qSnippet = targetQ ? `"${targetQ.text.slice(0, 45)}..."` : `ID: ${id}`;
    const updatedQ = questions.filter(item => item.id !== id);
    updateQuestionsDB(updatedQ);
    deleteQuestionFromFirestore(id);

    // Clean bookmarks for this question
    const updatedB = bookmarks.filter(b => b.questionId !== id);
    updateBookmarksDB(updatedB);
    addAuditLog('প্রশ্ন মুছে ফেলা (Delete)', `প্রশ্ন সরাসরি মুছে ফেলা হয়েছে: ${qSnippet}`, 'delete');
  };

  const handleBulkDeleteQuestions = (ids: string[]) => {
    const updatedQ = questions.filter(item => !ids.includes(item.id));
    updateQuestionsDB(updatedQ);
    bulkDeleteQuestionsFromFirestore(ids);

    const updatedB = bookmarks.filter(b => !ids.includes(b.questionId));
    updateBookmarksDB(updatedB);
    addAuditLog('বাল্ক প্রশ্ন ডিলিট (Bulk Delete)', `একসাথে ${ids.length} টি প্রশ্ন মুছে ফেলা হয়েছে`, 'bulk');
  };

  const handleBulkMoveQuestions = (ids: string[], targetCategory: string, targetSubcategory?: string, mode: 'move' | 'link' = 'move') => {
    let targetCat = targetCategory;
    if (isJobSolutionVariation(targetCat)) {
      targetCat = 'জব সলিউশন পরীক্ষা';
    }
    const updatedQ = questions.map(item => {
      if (ids.includes(item.id)) {
        // Collect existing categories and subcategories
        const existingCats = item.categories && item.categories.length > 0 ? [...item.categories] : [item.category];
        const existingSubs = item.subcategories && item.subcategories.length > 0 ? [...item.subcategories] : (item.subcategory ? [item.subcategory] : []);

        // Add the target category if not already linked
        if (targetCat && !existingCats.includes(targetCat)) {
          existingCats.push(targetCat);
        }

        // Add the target subcategory if provided and not already linked
        if (targetSubcategory && !existingSubs.includes(targetSubcategory)) {
          existingSubs.push(targetSubcategory);
        }

        if (mode === 'move') {
          // Properly move: update primary category and subcategory to the new destination
          return {
            ...item,
            category: targetCat || item.category,
            subcategory: targetSubcategory !== undefined ? targetSubcategory : item.subcategory,
            categories: Array.from(new Set(existingCats)).filter(Boolean),
            subcategories: Array.from(new Set(existingSubs)).filter(Boolean)
          };
        } else {
          // Link mode: retain primary category/subcategory, append to arrays
          return {
            ...item,
            category: item.category || targetCat,
            subcategory: item.subcategory || targetSubcategory || '',
            categories: Array.from(new Set(existingCats)).filter(Boolean),
            subcategories: Array.from(new Set(existingSubs)).filter(Boolean)
          };
        }
      }
      return item;
    });
    updateQuestionsDB(updatedQ);

    const movedItems = updatedQ.filter(item => ids.includes(item.id));
    bulkUploadQuestionsToFirestore(movedItems);

    ensureCategoryAndSubcategoryExist(targetCat, targetSubcategory);
    addAuditLog('বাল্ক ক্যাটাগরি স্থানান্তরিত (Bulk Move)', `${ids.length} টি প্রশ্নের ক্যাটাগরি স্থানান্তরিত করা হয়েছে (${targetCat}${targetSubcategory ? ` / ${targetSubcategory}` : ''})`, 'bulk');
  };

  const handleBulkUploadQuestions = (questionsList: Omit<Question, 'id'>[]) => {
    const normalizedList = questionsList.map(q => {
      let cat = q.category || '';
      if (isJobSolutionVariation(cat)) {
        cat = 'জব সলিউশন পরীক্ষা';
      }
      return {
        ...q,
        category: cat
      };
    });

    const newQuestions: Question[] = normalizedList.map((q, idx) => ({
      id: `q_bulk_${Date.now()}_${idx}`,
      ...q
    }));
    updateQuestionsDB([...questions, ...newQuestions]);
    bulkUploadQuestionsToFirestore(newQuestions);

    // Also batch process the categories and subcategories strictly from CSV subject data
    // NEVER auto-create categories from upload destination, exam hierarchy, or job solution hierarchy.
    let updatedSubcats = [...subcategories];
    let changed = false;

    const isRoot = (name: string) => {
      const norm = name.toLowerCase();
      return norm === 'বিষয়ভিত্তিক প্রস্তুতি'.toLowerCase() ||
             norm === 'জব সলিউশন পরীক্ষা'.toLowerCase() ||
             norm === 'সাল ভিত্তিক জব সলিউশন'.toLowerCase() ||
             norm === 'সাম্প্রতিক বিষয়াবলী'.toLowerCase() ||
             isJobSolutionVariation(norm) ||
             isYearJobSolutionVariation(norm) ||
             isCurrentAffairVariation(norm);
    };

    normalizedList.forEach(q => {
      // ONLY use CSV Subject fields (subjectCategory / csvCategory and subjectSubcategory / csvSubcategory)
      const subjCat = (q.subjectCategory || q.csvCategory || '').trim();
      const subjSubcat = (q.subjectSubcategory || q.csvSubcategory || '').trim();

      // If subject category is valid and non-root, ensure it exists under 'বিষয়ভিত্তিক প্রস্তুতি'
      if (subjCat && !isRoot(subjCat) && subjCat !== 'সাধারণ জ্ঞান') {
        const catExists = updatedSubcats.some(
          s => s.parentCategory && 
               s.parentCategory.trim().toLowerCase() === 'বিষয়ভিত্তিক প্রস্তুতি'.toLowerCase() &&
               s.name.trim().toLowerCase() === subjCat.toLowerCase()
        );
        if (!catExists) {
          updatedSubcats.push({
            id: `subcat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            name: subjCat,
            parentCategory: 'বিষয়ভিত্তিক প্রস্তুতি'
          });
          changed = true;
        }
      }

      // If subject subcategory is valid, ensure it exists under the subject category
      if (subjSubcat && !isRoot(subjSubcat)) {
        const targetParent = subjCat || 'সাধারণ জ্ঞান';
        if (subjSubcat.toLowerCase() !== targetParent.toLowerCase() && !isRoot(targetParent)) {
          const subcatExists = updatedSubcats.some(
            s => s.parentCategory && 
                 s.parentCategory.trim().toLowerCase() === targetParent.toLowerCase() &&
                 s.name.trim().toLowerCase() === subjSubcat.toLowerCase()
          );
          if (!subcatExists) {
            updatedSubcats.push({
              id: `subcat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              name: subjSubcat,
              parentCategory: targetParent
            });
            changed = true;
          }
        }
      }
    });

    if (changed) {
      updateSubcategoriesDB(updatedSubcats);
    }
    addAuditLog('বাল্ক প্রশ্ন ফাইল আপলোড (Bulk Upload)', `একসাথে ${questionsList.length} টি নতুন প্রশ্ন আপলোড করা হয়েছে`, 'bulk');
  };

  const handleSaveNotice = (text: string) => {
    const newNotice: Notice = {
      id: `notice_${Date.now()}`,
      text,
      createdAt: new Date().toISOString()
    };
    // We only keep the latest notices
    updateNoticesDB([newNotice, ...notices]);
    addAuditLog('নোটিশ প্রকাশ (Notice)', `নতুন এডমিন নোটিশ প্রকাশ করা হয়েছে: "${text.slice(0, 45)}..."`, 'create');
  };

  const handleCreateLiveExam = (exam: Omit<LiveExam, 'id' | 'createdAt' | 'updatedAt'>) => {
    const nowIso = new Date().toISOString();
    const newExam: LiveExam = {
      ...exam,
      id: `exam_${Date.now()}`,
      createdAt: nowIso,
      updatedAt: nowIso
    };
    updateLiveExamsDB([newExam, ...liveExams]);
    addAuditLog('লাইভ পরীক্ষা তৈরি (Exam)', `নতুন লাইভ পরীক্ষা তৈরি করা হয়েছে: "${exam.title}"`, 'exam');
  };

  const handleUpdateLiveExam = (id: string, updatedExam: Partial<LiveExam>) => {
    const nowIso = new Date().toISOString();
    const updated = liveExams.map(e => e.id === id ? { ...e, ...updatedExam, updatedAt: nowIso } : e);
    updateLiveExamsDB(updated);
    addAuditLog('লাইভ পরীক্ষা আপডেট (Update Exam)', `লাইভ পরীক্ষা আপডেট করা হয়েছে (ID: ${id})`, 'exam');
  };

  const handleDeleteLiveExam = (id: string) => {
    const target = liveExams.find(e => e.id === id);
    updateLiveExamsDB(liveExams.filter(item => item.id !== id));
    addAuditLog('লাইভ পরীক্ষা মুছে ফেলা (Delete Exam)', `লাইভ পরীক্ষা মুছে ফেলা হয়েছে: "${target ? target.title : id}"`, 'exam');
  };

  const handleSaveCourse = (cData: Omit<Course, 'id' | 'createdAt' | 'updatedAt'>) => {
    const nowIso = new Date().toISOString();
    const newCourse: Course = {
      ...cData,
      id: `course_${Date.now()}`,
      createdAt: nowIso,
      updatedAt: nowIso
    };
    updateCoursesDB([newCourse, ...courses]);
    addAuditLog('কোর্স তৈরি (Course)', `নতুন কোর্স তৈরি করা হয়েছে: "${cData.title}"`, 'other');
  };

  const handleUpdateCourse = (id: string, updatedCourse: Partial<Course>) => {
    const nowIso = new Date().toISOString();
    const updated = courses.map(c => c.id === id ? { ...c, ...updatedCourse, updatedAt: nowIso } : c);
    updateCoursesDB(updated);
    addAuditLog('কোর্স আপডেট (Update Course)', `কোর্স আপডেট করা হয়েছে (ID: ${id})`, 'other');
  };

  const handleDeleteCourse = (id: string) => {
    const target = courses.find(c => c.id === id);
    updateCoursesDB(courses.filter(item => item.id !== id));
    addAuditLog('কোর্স মুছে ফেলা (Delete Course)', `কোর্স মুছে ফেলা হয়েছে: "${target ? target.title : id}"`, 'other');
  };

  const handleSaveCoupon = (couponData: Omit<Coupon, 'id' | 'createdAt'>) => {
    const newCoupon: Coupon = {
      ...couponData,
      id: `cpn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString()
    };
    setCoupons(prev => {
      const updated = [newCoupon, ...prev];
      localStorage.setItem('orjon_coupons', JSON.stringify(updated));
      syncCollectionToFirestore('coupons', updated, 'item');
      return updated;
    });
    addAuditLog('নতুন কুপন তৈরি (Coupon)', `কুপন: ${newCoupon.code}, ছাড়: ${newCoupon.discountPercent}%`, 'create');
  };

  const handleUpdateCoupon = (id: string, updatedCoupon: Partial<Coupon>) => {
    setCoupons(prev => {
      const updated = prev.map(c => c.id === id ? { ...c, ...updatedCoupon } : c);
      localStorage.setItem('orjon_coupons', JSON.stringify(updated));
      syncCollectionToFirestore('coupons', updated, 'item');
      return updated;
    });
    addAuditLog('কুপন আপডেট (Update Coupon)', `ID: ${id}`, 'update');
  };

  const handleDeleteCoupon = (id: string) => {
    setCoupons(prev => {
      const updated = prev.filter(c => c.id !== id);
      localStorage.setItem('orjon_coupons', JSON.stringify(updated));
      syncCollectionToFirestore('coupons', updated, 'item');
      return updated;
    });
    addAuditLog('কুপন মুছে ফেলা (Delete Coupon)', `ID: ${id}`, 'delete');
  };

  const handleEnrollCourse = (enrollmentData: Omit<CourseEnrollment, 'id' | 'enrolledAt'>) => {
    const newEnrollment: CourseEnrollment = {
      ...enrollmentData,
      id: `enr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      enrolledAt: new Date().toISOString()
    };
    setCourseEnrollments(prev => {
      const updated = [newEnrollment, ...prev];
      localStorage.setItem('orjon_course_enrollments', JSON.stringify(updated));
      syncCollectionToFirestore('course_enrollments', updated, 'item');
      return updated;
    });
    if (enrollmentData.couponCode) {
      setCoupons(prev => {
        const updated = prev.map(c => {
          if (c.code.toUpperCase() === enrollmentData.couponCode?.toUpperCase()) {
            return { ...c, usageCount: (c.usageCount || 0) + 1 };
          }
          return c;
        });
        localStorage.setItem('orjon_coupons', JSON.stringify(updated));
        return updated;
      });
    }
    addAuditLog('কোর্স এনরোলমেন্ট', `শিক্ষার্থী: ${newEnrollment.userName} (${newEnrollment.userPhone}), কোর্স: ${newEnrollment.courseTitle}, পরিশোধিত: ৳${newEnrollment.finalPrice}`, 'other');
  };

  const handleUpdatePaymentSettings = (newSettings: PaymentSettings) => {
    setPaymentSettings(newSettings);
    localStorage.setItem('orjon_payment_settings', JSON.stringify(newSettings));
    syncCollectionToFirestore('payment_settings', [newSettings], 'item');
    addAuditLog('পেমেন্ট সেটিংস পরিবর্তন', `বিকাশ: ${newSettings.bkashNumber} (${newSettings.bkashType}), নগদ: ${newSettings.nagadNumber}, রকেট: ${newSettings.rocketNumber}`, 'update');
  };

  const handleDeleteEnrollment = (id: string) => {
    setCourseEnrollments(prev => {
      const updated = prev.filter(e => e.id !== id);
      localStorage.setItem('orjon_course_enrollments', JSON.stringify(updated));
      syncCollectionToFirestore('course_enrollments', updated, 'item');
      return updated;
    });
    addAuditLog('এনরোলমেন্ট মুছে ফেলা (Delete Enrollment)', `ID: ${id}`, 'delete');
  };

  const handleSaveRoutine = (
    title: string, 
    details: string, 
    courseId?: string, 
    courseName?: string,
    selectedCategories?: string[],
    selectedSubcategories?: string[],
    selectedLeafCategories?: string[],
    examConfig?: ScheduledExamConfig
  ) => {
    const routineId = `routine_${Date.now()}`;
    const nowIso = new Date().toISOString();
    const newRoutine: Routine = {
      id: routineId,
      title,
      details,
      createdAt: nowIso,
      updatedAt: nowIso,
      courseId,
      courseName,
      selectedCategories,
      selectedSubcategories,
      selectedLeafCategories,
      examConfig
    };

    updateRoutinesDB([newRoutine, ...routines]);

    // Automatically create/sync LiveExam if exam schedule is enabled
    if (examConfig && examConfig.enabled && examConfig.startTime) {
      const newLiveExam: LiveExam = {
        id: `exam_rt_${Date.now()}`,
        routineId: routineId,
        courseId: courseId,
        courseName: courseName,
        title: title,
        qLimit: examConfig.qLimit || 20,
        timeLimit: examConfig.timeLimit || 20,
        category: selectedCategories && selectedCategories.length > 0 ? selectedCategories[0] : 'ALL',
        startTime: examConfig.startTime,
        expiryTime: examConfig.expiryTime || new Date(new Date(examConfig.startTime).getTime() + 24 * 60 * 60 * 1000).toISOString(),
        createdAt: nowIso,
        updatedAt: nowIso,
        questionIds: examConfig.questionIds || [],
        selectedCategories: selectedCategories || [],
        selectedSubcategories: selectedSubcategories || [],
        selectedLeafCategories: selectedLeafCategories || [],
        totalMarks: examConfig.totalMarks || examConfig.qLimit || 20,
        passMarks: examConfig.passMarks || Math.ceil((examConfig.qLimit || 20) * 0.4),
        questionSelection: examConfig.questionSelection || 'auto'
      };
      updateLiveExamsDB([newLiveExam, ...liveExams]);
    }

    addAuditLog('রুটিন প্রকাশ (Routine)', `নতুন সিলেবাস রুটিন প্রকাশ করা হয়েছে: "${title}"${courseName ? ` (কোর্স: ${courseName})` : ''}`, 'routine');
  };

  const handleUpdateRoutine = (id: string, updatedRoutine: Partial<Routine>) => {
    const nowIso = new Date().toISOString();
    const updated = routines.map(r => r.id === id ? { ...r, ...updatedRoutine, updatedAt: nowIso } : r);
    updateRoutinesDB(updated);
    addAuditLog('রুটিন আপডেট (Update Routine)', `রুটিন আপডেট করা হয়েছে (ID: ${id})`, 'routine');
  };

  const handleDeleteRoutine = (id: string) => {
    const target = routines.find(r => r.id === id);
    updateRoutinesDB(routines.filter(item => item.id !== id));
    addAuditLog('রুটিন মুছে ফেলা (Delete Routine)', `রুটিন মুছে ফেলা হয়েছে: "${target ? target.title : id}"`, 'routine');
  };

  const handleAddCategory = (name: string, subHeading?: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const lowerName = trimmed.toLowerCase();
    if (lowerName === 'বিষয়ভিত্তিক প্রস্তুতি'.toLowerCase() || lowerName === 'জব সলিউশন পরীক্ষা'.toLowerCase() || lowerName === 'সাল ভিত্তিক জব সলিউশন'.toLowerCase() || lowerName === 'সাম্প্রতিক বিষয়াবলী'.toLowerCase() || isJobSolutionVariation(lowerName) || isYearJobSolutionVariation(lowerName) || isCurrentAffairVariation(lowerName)) {
      alert('⚠️ ত্রুটি: মূল রুট ক্যাটাগরির নামে কোনো নতুন ক্যাটাগরি তৈরি করা সম্ভব নয়!');
      return;
    }
    if (subcategories.some(s => s.name.toLowerCase() === trimmed.toLowerCase() && s.parentCategory === 'বিষয়ভিত্তিক প্রস্তুতি')) {
      alert('এই ক্যাটাগরি ইতিমধ্যে বিষয়ভিত্তিক প্রস্তুতি জোনে বিদ্যমান রয়েছে!');
      return;
    }
    const newSub: SubcategoryItem = {
      id: `subcat-${Date.now()}`,
      name: trimmed,
      parentCategory: 'বিষয়ভিত্তিক প্রস্তুতি',
      subHeading: subHeading ? subHeading.trim() : undefined
    };
    updateSubcategoriesDB([...subcategories, newSub]);
    saveItemToFirestore('subcategories', newSub, 'subcat');
    addAuditLog('ক্যাটাগরি তৈরি (Category)', `নতুন বিষয়ভিত্তিক ক্যাটাগরি তৈরি করা হয়েছে: "${trimmed}"`, 'category');
    alert('🎯 নতুন বিষয়ভিত্তিক প্রস্তুতি ক্যাটাগরি সফলভাবে যোগ করা হয়েছে!');
  };

  const handleAddSubcategory = (name: string, parentCategory: string, date?: string, subHeading?: string, text?: string) => {
    const trimmed = name.trim();
    if (!trimmed || !parentCategory) return;
    
    let normalizedParent = parentCategory.trim();
    if (isJobSolutionVariation(normalizedParent)) {
      normalizedParent = 'জব সলিউশন পরীক্ষা';
    } else if (isYearJobSolutionVariation(normalizedParent)) {
      normalizedParent = 'সাল ভিত্তিক জব সলিউশন';
    } else if (isCurrentAffairVariation(normalizedParent)) {
      normalizedParent = 'সাম্প্রতিক বিষয়াবলী';
    }

    const lowerName = trimmed.toLowerCase();
    if (lowerName === 'বিষয়ভিত্তিক প্রস্তুতি'.toLowerCase() || lowerName === 'জব সলিউশন পরীক্ষা'.toLowerCase() || lowerName === 'সাল ভিত্তিক জব সলিউশন'.toLowerCase() || lowerName === 'সাম্প্রতিক বিষয়াবলী'.toLowerCase() || isJobSolutionVariation(lowerName) || isYearJobSolutionVariation(lowerName) || isCurrentAffairVariation(lowerName)) {
      alert('⚠️ ত্রুটি: মূল রুট ক্যাটাগরির নামে কোনো সাব-ক্যাটাগরি তৈরি করা সম্ভব নয়!');
      return;
    }

    if (lowerName === normalizedParent.toLowerCase()) {
      alert('⚠️ ত্রুটি: কোনো সাব-ক্যাটাগরি নিজের প্যারেন্ট হতে পারে না!');
      return;
    }

    let currentSubcats = [...subcategories];
    
    if (currentSubcats.some(s => s.name.trim().toLowerCase() === trimmed.toLowerCase() && s.parentCategory && s.parentCategory.trim().toLowerCase() === normalizedParent.toLowerCase())) {
      // If already exists, update its text / date / subHeading if provided
      const updated = currentSubcats.map(s => {
        if (s.name.trim().toLowerCase() === trimmed.toLowerCase() && s.parentCategory && s.parentCategory.trim().toLowerCase() === normalizedParent.toLowerCase()) {
          const u: SubcategoryItem = {
            ...s,
            date: date !== undefined ? date : s.date,
            subHeading: subHeading !== undefined ? subHeading.trim() : s.subHeading,
            text: text !== undefined ? text : s.text
          };
          saveItemToFirestore('subcategories', u, 'subcat');
          return u;
        }
        return s;
      });
      updateSubcategoriesDB(updated);
      alert(`🎯 "${trimmed}" সাব-ক্যাটাগরি সফলভাবে আপডেট করা হয়েছে!`);
      return;
    }
    
    const newSub: SubcategoryItem = {
      id: `subcat-${Date.now()}`,
      name: trimmed,
      parentCategory: normalizedParent,
      date: date || undefined,
      subHeading: subHeading ? subHeading.trim() : undefined,
      text: text || undefined,
      createdAt: new Date().toISOString()
    };
    
    currentSubcats.push(newSub);
    updateSubcategoriesDB(currentSubcats);
    saveItemToFirestore('subcategories', newSub, 'subcat');
    addAuditLog('সাব-ক্যাটাগরি তৈরি (Category)', `নতুন সাব-ক্যাটাগরি যুক্ত করা হয়েছে: "${trimmed}" (প্যারেন্ট: ${normalizedParent})`, 'category');
    
    alert(`🎯 "${trimmed}" সাব-ক্যাটাগরি সফলভাবে যোগ করা হয়েছে!`);
    
    let currentParent = trimmed;
    while (confirm(`আপনি কি "${currentParent}" সাব-ক্যাটাগরির অধীনে আরেকটি সাব-ক্যাটাগরি তৈরি করতে চান?`)) {
      const childName = prompt(`"${currentParent}" এর অধীনে নতুন সাব-ক্যাটাগরির নাম লিখুন:`);
      if (childName === null) {
        // user clicked Cancel
        break;
      }
      const childTrimmed = childName.trim();
      if (!childTrimmed) {
        alert('বৈধ নাম না দেওয়ায় বাতিল করা হয়েছে।');
        break;
      }
      const childLower = childTrimmed.toLowerCase();
      if (childLower === 'বিষয়ভিত্তিক প্রস্তুতি'.toLowerCase() || childLower === 'জব সলিউশন পরীক্ষা'.toLowerCase() || childLower === 'সাল ভিত্তিক জব সলিউশন'.toLowerCase() || childLower === 'সাম্প্রতিক বিষয়াবলী'.toLowerCase() || isJobSolutionVariation(childLower) || isYearJobSolutionVariation(childLower) || isCurrentAffairVariation(childLower)) {
        alert('⚠️ ত্রুটি: মূল রুট ক্যাটাগরির নামে কোনো সাব-ক্যাটাগরি তৈরি করা সম্ভব নয়!');
        break;
      }
      if (childLower === currentParent.trim().toLowerCase()) {
        alert('⚠️ ত্রুটি: কোনো সাব-ক্যাটাগরি নিজের প্যারেন্ট হতে পারে না!');
        continue;
      }
      if (currentSubcats.some(s => s.name.toLowerCase() === childTrimmed.toLowerCase() && s.parentCategory === currentParent)) {
        alert('এই সাব-ক্যাটাগরি ইতিমধ্যে বিদ্যমান রয়েছে!');
        continue;
      }
      const childSub: SubcategoryItem = {
        id: `subcat-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        name: childTrimmed,
        parentCategory: currentParent
      };
      currentSubcats.push(childSub);
      updateSubcategoriesDB(currentSubcats);
      saveItemToFirestore('subcategories', childSub, 'subcat');
      addAuditLog('সাব-ক্যাটাগরি তৈরি (Category)', `নতুন নেস্টেড সাব-ক্যাটাগরি যুক্ত করা হয়েছে: "${childTrimmed}" (প্যারেন্ট: ${currentParent})`, 'category');
      alert(`🎯 "${childTrimmed}" সাব-ক্যাটাগরি সফলভাবে "${currentParent}" এর অধীনে যোগ করা হয়েছে!`);
      currentParent = childTrimmed;
    }
  };

  const handleDeleteCategory = (id: string) => {
    const cat = categories.find(c => c.id === id);
    if (!cat) return;
    if (cat.name === 'বিষয়ভিত্তিক প্রস্তুতি' || cat.name === 'জব সলিউশন পরীক্ষা' || cat.name === 'সাল ভিত্তিক জব সলিউশন' || cat.name === 'সাম্প্রতিক বিষয়াবলী' || isJobSolutionVariation(cat.name) || isYearJobSolutionVariation(cat.name) || isCurrentAffairVariation(cat.name)) {
      alert('সতর্কতা: মূল রুট ক্যাটাগরি ডিলিট করা সম্ভব নয়!');
      return;
    }
    const remainingCats = categories.filter(c => c.id !== id);
    const remainingSubcats = subcategories.filter(s => s.parentCategory !== cat.name);
    updateCategoriesDB(remainingCats);
    updateSubcategoriesDB(remainingSubcats);
    addAuditLog('ক্যাটাগরি মুছে ফেলা (Delete Category)', `ক্যাটাগরি মুছে ফেলা হয়েছে: "${cat.name}"`, 'category');
  };

  const handleDeleteSubcategory = (id: string) => {
    const sub = subcategories.find(s => s.id === id);
    if (!sub) return;
    
    // Find all descendants recursively
    const toDelete = new Set<string>([sub.name]);
    let addedAny = true;
    while (addedAny) {
      addedAny = false;
      subcategories.forEach(s => {
        if (s.parentCategory && toDelete.has(s.parentCategory) && !toDelete.has(s.name)) {
          toDelete.add(s.name);
          addedAny = true;
        }
      });
    }

    const remainingSubcats = subcategories.filter(s => s.id !== id && !toDelete.has(s.name));
    updateSubcategoriesDB(remainingSubcats);
    subcategories.forEach(s => {
      if (s.id === id || toDelete.has(s.name)) {
        deleteItemFromFirestore('subcategories', s.id);
      }
    });
    addAuditLog('সাব-ক্যাটাগরি মুছে ফেলা (Delete Category)', `সাব-ক্যাটাগরি ও সংশ্লিষ্ট সাব-ব্রাঞ্চ মুছে ফেলা হয়েছে: "${sub.name}"`, 'category');
  };

  const handleBulkDeleteSubcategories = (ids: string[]) => {
    if (!ids || ids.length === 0) return;
    const targets = subcategories.filter(s => ids.includes(s.id));
    const toDelete = new Set<string>(targets.map(s => s.name));

    let addedAny = true;
    while (addedAny) {
      addedAny = false;
      subcategories.forEach(s => {
        if (s.parentCategory && toDelete.has(s.parentCategory) && !toDelete.has(s.name)) {
          toDelete.add(s.name);
          addedAny = true;
        }
      });
    }

    const remainingSubcats = subcategories.filter(s => !ids.includes(s.id) && !toDelete.has(s.name));
    updateSubcategoriesDB(remainingSubcats);
    subcategories.forEach(s => {
      if (ids.includes(s.id) || toDelete.has(s.name)) {
        deleteItemFromFirestore('subcategories', s.id);
      }
    });
    addAuditLog('বাল্ক সাব-ক্যাটাগরি মুছে ফেলা (Bulk Delete Categories)', `একসাথে ${ids.length} টি সাব-ক্যাটাগরি ডিলিট করা হয়েছে`, 'category');
  };

  const handleBulkMoveSubcategories = (ids: string[], newParentCategory: string) => {
    if (!ids || ids.length === 0 || !newParentCategory) return;
    let normalizedParent = newParentCategory.trim();
    if (isJobSolutionVariation(normalizedParent)) {
      normalizedParent = 'জব সলিউশন পরীক্ষা';
    } else if (isYearJobSolutionVariation(normalizedParent)) {
      normalizedParent = 'সাল ভিত্তিক জব সলিউশন';
    } else if (isCurrentAffairVariation(normalizedParent)) {
      normalizedParent = 'সাম্প্রতিক বিষয়াবলী';
    }

    const updatedSubcats = subcategories.map(s => {
      if (ids.includes(s.id)) {
        const updated = { ...s, parentCategory: normalizedParent };
        saveItemToFirestore('subcategories', updated, 'subcat');
        return updated;
      }
      return s;
    });

    updateSubcategoriesDB(updatedSubcats);
    addAuditLog('বাল্ক সাব-ক্যাটাগরি মুভ (Bulk Move Categories)', `একসাথে ${ids.length} টি সাব-ক্যাটাগরি নতুন প্যারেন্ট "${normalizedParent}" এ স্থানান্তরিত করা হয়েছে`, 'category');
  };

  const handleUpdateCategory = (id: string, newName: string, subHeading?: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const cat = categories.find(c => c.id === id);
    if (!cat) return;
    if (cat.name === 'বিষয়ভিত্তিক প্রস্তুতি' || cat.name === 'জব সলিউশন পরীক্ষা' || cat.name === 'সাল ভিত্তিক জব সলিউশন' || cat.name === 'সাম্প্রতিক বিষয়াবলী' || isJobSolutionVariation(cat.name) || isYearJobSolutionVariation(cat.name) || isCurrentAffairVariation(cat.name)) {
      alert('সতর্কতা: মূল রুট ক্যাটাগরির নাম পরিবর্তন করা সম্ভব নয়!');
      return;
    }
    const oldName = cat.name;

    const updatedCats = categories.map(c => c.id === id ? { ...c, name: trimmed, subHeading: subHeading !== undefined ? subHeading.trim() : c.subHeading } : c);
    updateCategoriesDB(updatedCats);

    const updatedSubcats = subcategories.map(s => {
      let item = s;
      if (s.id === id) {
        item = { ...item, name: trimmed, subHeading: subHeading !== undefined ? subHeading.trim() : s.subHeading };
      }
      if (item.parentCategory === oldName) {
        item = { ...item, parentCategory: trimmed };
      }
      return item;
    });
    updateSubcategoriesDB(updatedSubcats);

    const updatedQs = questions.map(q => {
      let updatedQ = { ...q };
      let changed = false;
      if (q.category === oldName) {
        updatedQ.category = trimmed;
        changed = true;
      }
      if (q.categories && q.categories.includes(oldName)) {
        updatedQ.categories = q.categories.map(c => c === oldName ? trimmed : c);
        changed = true;
      }
      return changed ? updatedQ : q;
    });
    updateQuestionsDB(updatedQs);
    addAuditLog('ক্যাটাগরি আপডেট (Update Category)', `ক্যাটাগরির নাম পরিবর্তন করা হয়েছে: "${oldName}" ➔ "${trimmed}"`, 'category');
    alert('🎯 ক্যাটাগরি সফলভাবে আপডেট করা হয়েছে!');
  };

  const handleUpdateSubcategory = (id: string, newName: string, newParent: string, date?: string, subHeading?: string, text?: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    
    let normalizedParent = newParent.trim();
    if (isJobSolutionVariation(normalizedParent)) {
      normalizedParent = 'জব সলিউশন পরীক্ষা';
    } else if (isYearJobSolutionVariation(normalizedParent)) {
      normalizedParent = 'সাল ভিত্তিক জব সলিউশন';
    } else if (isCurrentAffairVariation(normalizedParent)) {
      normalizedParent = 'সাম্প্রতিক বিষয়াবলী';
    }

    const lowerName = trimmed.toLowerCase();
    if (lowerName === 'বিষয়ভিত্তিক প্রস্তুতি'.toLowerCase() || lowerName === 'জব সলিউশন পরীক্ষা'.toLowerCase() || lowerName === 'সাল ভিত্তিক জব সলিউশন'.toLowerCase() || lowerName === 'সাম্প্রতিক বিষয়াবলী'.toLowerCase() || isJobSolutionVariation(lowerName) || isYearJobSolutionVariation(lowerName) || isCurrentAffairVariation(lowerName)) {
      alert('⚠️ ত্রুটি: মূল রুট ক্যাটাগরির নামে কোনো সাব-ক্যাটাগরি পরিবর্তন বা স্থানান্তর করা সম্ভব নয়!');
      return;
    }

    if (lowerName === normalizedParent.toLowerCase()) {
      alert('⚠️ ত্রুটি: কোনো সাব-ক্যাটাগরি নিজের প্যারেন্ট হতে পারে না!');
      return;
    }

    const sub = subcategories.find(s => s.id === id);
    if (!sub) return;
    const oldName = sub.name;

    const updatedSubcats = subcategories.map(s => {
      if (s.id === id) {
        return { 
          ...s, 
          name: trimmed, 
          parentCategory: normalizedParent,
          date: date !== undefined ? date : s.date,
          subHeading: subHeading !== undefined ? subHeading.trim() : s.subHeading,
          text: text !== undefined ? text : s.text
        };
      }
      if (s.parentCategory === oldName) {
        return { ...s, parentCategory: trimmed };
      }
      return s;
    });

    // Validate if this update creates a circular loop
    const testSubMap = new Map<string, typeof subcategories[0]>();
    updatedSubcats.forEach(s => {
      testSubMap.set(s.name.trim().toLowerCase(), s);
    });

    let loopFound = false;
    for (const s of updatedSubcats) {
      const visited = new Set<string>();
      let current = s;
      while (current && current.parentCategory) {
        const parentName = current.parentCategory.trim().toLowerCase();
        if (
          parentName === 'বিষয়ভিত্তিক প্রস্তুতি'.toLowerCase() ||
          parentName === 'জব সলিউশন পরীক্ষা'.toLowerCase() ||
          parentName === 'সাল ভিত্তিক জব সলিউশন'.toLowerCase() ||
          parentName === 'সাম্প্রতিক বিষয়াবলী'.toLowerCase() ||
          isJobSolutionVariation(parentName) ||
          isYearJobSolutionVariation(parentName) ||
          isCurrentAffairVariation(parentName)
        ) {
          break;
        }
        if (visited.has(parentName) || parentName === current.name.trim().toLowerCase()) {
          loopFound = true;
          break;
        }
        visited.add(current.name.trim().toLowerCase());
        const parentSub = testSubMap.get(parentName);
        if (parentSub) {
          current = parentSub;
        } else {
          break;
        }
      }
      if (loopFound) break;
    }

    if (loopFound) {
      alert('⚠️ ত্রুটি: এই পরিবর্তনের ফলে ক্যাটাগরির মধ্যে চক্রাকার সম্পর্ক (Loop) তৈরি হবে! দয়া করে অন্য প্যারেন্ট নির্বাচন করুন।');
      return;
    }

    updateSubcategoriesDB(updatedSubcats);

    const updatedQs = questions.map(q => {
      let updatedQ = { ...q };
      let changed = false;
      if (q.subcategory === oldName) {
        updatedQ.subcategory = trimmed;
        changed = true;
      }
      if (q.subcategories && q.subcategories.includes(oldName)) {
        updatedQ.subcategories = q.subcategories.map(s => s === oldName ? trimmed : s);
        changed = true;
      }
      return changed ? updatedQ : q;
    });
    updateQuestionsDB(updatedQs);
    addAuditLog('সাব-ক্যাটাগরি আপডেট (Update Category)', `সাব-ক্যাটাগরি আপডেট করা হয়েছে: "${oldName}" ➔ "${trimmed}" (প্যারেন্ট: ${normalizedParent})`, 'category');
    alert('🎯 সাব-ক্যাটাগরি সফলভাবে আপডেট ও মুভ করা হয়েছে!');
  };

  // 4. User Wrapper Actions
  const handleAddBookmark = (questionId: string, folderName: string) => {
    if (!currentUser) return;
    const isAlreadyBookmarked = bookmarks.some(b => b.questionId === questionId && b.userPhone === currentUser.phone);
    if (isAlreadyBookmarked) return;

    const newBookmark: Bookmark = {
      id: `bookmark_${Date.now()}`,
      userPhone: currentUser.phone,
      questionId,
      folderName,
      createdAt: new Date().toISOString()
    };

    updateBookmarksDB([...bookmarks, newBookmark]);
  };

  const handleRemoveBookmark = (bookmarkId: string) => {
    updateBookmarksDB(bookmarks.filter(b => b.id !== bookmarkId));
  };

  const handleSaveAttempt = (attempt: Omit<Attempt, 'id' | 'submittedAt'>) => {
    if (!currentUser) return;
    const nowIso = new Date().toISOString();
    const fullAttempt: Attempt = {
      ...attempt,
      id: `attempt_${Date.now()}`,
      submittedAt: nowIso,
      updatedAt: nowIso
    };

    const cutoff = Date.now() - 72 * 60 * 60 * 1000;
    const cleanAttempts = [fullAttempt, ...attempts].filter(a => {
      const isUserCreated = a.examId.startsWith('prep_') || a.examId.startsWith('job_') || a.examId.startsWith('custom_') || a.examId.startsWith('demo_');
      if (isUserCreated) {
        return new Date(a.submittedAt).getTime() >= cutoff;
      }
      return true;
    });

    updateAttemptsDB(cleanAttempts);

    // Update user stats in users DB
    const updatedUsers = users.map(u => {
      if (u.phone === currentUser.phone) {
        const newUserObj = {
          ...u,
          lifetimeAnswered: u.lifetimeAnswered + attempt.totalQuestions,
          lifetimeCorrect: u.lifetimeCorrect + attempt.correctCount,
          lifetimeWrong: u.lifetimeWrong + attempt.wrongCount
        };
        // Update current session object state
        setCurrentUser(newUserObj);
        return newUserObj;
      }
      return u;
    });

    updateUsersDB(updatedUsers);
  };

  const handleUpdateUserProfile = async (updatedUser: User) => {
    setCurrentUser(updatedUser);
    const updatedUsers = users.map(u => 
      (u.userId && u.userId === updatedUser.userId) || 
      (u.phone && u.phone === updatedUser.phone) || 
      (u.email && u.email === updatedUser.email) 
        ? updatedUser 
        : u
    );
    updateUsersDB(updatedUsers);
  };

  return (
    <div className="min-h-screen max-w-full overflow-x-hidden bg-slate-50 text-slate-800 antialiased font-sans flex flex-col justify-between relative">
      {/* Real-time Session Inactivity Warning Banner */}
      {showInactivityWarning && (currentUser || isAdmin) && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[9999] max-w-md w-[92%] bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 text-slate-950 font-black text-xs sm:text-sm p-3.5 rounded-2xl shadow-2xl border-2 border-amber-200 flex items-center justify-between gap-3 animate-bounce">
          <div className="flex items-center gap-2">
            <span className="text-xl shrink-0">⏳</span>
            <span className="leading-tight">নিষ্ক্রিয়তার কারণে ১ মিনিটের মধ্যে সেশন টাইমআউট হবে!</span>
          </div>
          <button
            type="button"
            onClick={() => {
              localStorage.setItem('orjon_last_activity', Date.now().toString());
              setShowInactivityWarning(false);
            }}
            className="bg-slate-950 hover:bg-slate-800 text-amber-300 font-extrabold text-[11px] px-3 py-1.5 rounded-xl shrink-0 cursor-pointer transition shadow-md border border-amber-400/30"
          >
            সেশন সচল রাখুন
          </button>
        </div>
      )}

      {/* Dynamic Shell Grid Layout */}
      <div className="w-full max-w-5xl mx-auto p-1 sm:p-2 md:p-2.5 flex-grow flex flex-col overflow-x-hidden">
        
        {/* LOGGED IN USER VIEW */}
        {currentUser && !isAdmin && (
          <UserPortal 
            user={currentUser}
            questions={questions}
            liveExams={liveExams}
            notices={notices}
            routines={routines}
            courses={courses}
            coupons={coupons}
            courseEnrollments={courseEnrollments}
            paymentSettings={paymentSettings}
            onEnrollCourse={handleEnrollCourse}
            attempts={attempts.filter(a => {
              if (currentUser.phone && a.userPhone === currentUser.phone) return true;
              if (currentUser.email && a.userEmail && a.userEmail.toLowerCase() === currentUser.email.toLowerCase()) return true;
              if (currentUser.email && a.userPhone && a.userPhone.toLowerCase() === currentUser.email.toLowerCase()) return true;
              return false;
            })}
            allAttempts={attempts}
            bookmarks={bookmarks.filter(b => b.userPhone === currentUser.phone)}
            categories={categories}
            subcategories={subcategories}
            onAddBookmark={handleAddBookmark}
            onRemoveBookmark={handleRemoveBookmark}
            onSaveAttempt={handleSaveAttempt}
            onUpdateQuestion={handleUpdateQuestion}
            onUpdateUser={handleUpdateUserProfile}
            onLogout={requestLogoutConfirmation}
            allowUserExplanation={allowUserExplanation}
            showMcqCount={showMcqCount}
            directExamId={directExamId}
            onFetchQuestionsLazy={handleFetchQuestionsLazy}
            onRegisterPrompt={() => {
              const guestEmail = currentUser.email || '';
              setCurrentUser(null);
              setAuthScreen('register');
              if (guestEmail) {
                setRegEmail(guestEmail);
              }
            }}
          />
        )}

        {/* LOGGED IN ADMIN VIEW */}
        {isAdmin && (
          <AdminPanel 
            questions={questions}
            liveExams={liveExams}
            notices={notices}
            routines={routines}
            courses={courses}
            coupons={coupons}
            courseEnrollments={courseEnrollments}
            paymentSettings={paymentSettings}
            onUpdatePaymentSettings={handleUpdatePaymentSettings}
            onDeleteEnrollment={handleDeleteEnrollment}
            users={users}
            attempts={attempts}
            categories={categories}
            subcategories={subcategories}
            onAddCategory={handleAddCategory}
            onAddSubcategory={handleAddSubcategory}
            onDeleteCategory={handleDeleteCategory}
            onDeleteSubcategory={handleDeleteSubcategory}
            onBulkDeleteSubcategories={handleBulkDeleteSubcategories}
            onBulkMoveSubcategories={handleBulkMoveSubcategories}
            onUpdateCategory={handleUpdateCategory}
            onUpdateSubcategory={handleUpdateSubcategory}
            onAddQuestion={handleAddQuestion}
            onUpdateQuestion={handleUpdateQuestion}
            onDeleteQuestion={handleDeleteQuestion}
            onBulkDeleteQuestions={handleBulkDeleteQuestions}
            onBulkMoveQuestions={handleBulkMoveQuestions}
            onBulkUploadQuestions={handleBulkUploadQuestions}
            onSaveNotice={handleSaveNotice}
            onCreateLiveExam={handleCreateLiveExam}
            onUpdateLiveExam={handleUpdateLiveExam}
            onDeleteLiveExam={handleDeleteLiveExam}
            onSaveRoutine={handleSaveRoutine}
            onUpdateRoutine={handleUpdateRoutine}
            onDeleteRoutine={handleDeleteRoutine}
            onSaveCourse={handleSaveCourse}
            onUpdateCourse={handleUpdateCourse}
            onDeleteCourse={handleDeleteCourse}
            onSaveCoupon={handleSaveCoupon}
            onUpdateCoupon={handleUpdateCoupon}
            onDeleteCoupon={handleDeleteCoupon}
            onLogout={requestLogoutConfirmation}
            allowUserExplanation={allowUserExplanation}
            onToggleUserExplanation={handleToggleUserExplanation}
            showMcqCount={showMcqCount}
            onToggleMcqCount={handleToggleMcqCount}
            currentAdminPassword={adminPassword}
            onUpdateAdminPassword={handleUpdateAdminPassword}
            auditLogs={auditLogs}
            onAddAuditLog={addAuditLog}
            onClearAuditLogs={handleClearAuditLogs}
            sessionTimeoutMinutes={sessionTimeoutMinutes}
            onUpdateSessionTimeout={handleUpdateSessionTimeout}
            onFetchQuestionsLazy={handleFetchQuestionsLazy}
            onLoadUsersOnDemand={handleLoadUsersOnDemand}
            onLoadAttemptsOnDemand={handleLoadAttemptsOnDemand}
            onLoadAuditLogsOnDemand={handleLoadAuditLogsOnDemand}
          />
        )}

        {/* AUTHENTICATION PORTAL */}
        {!currentUser && !isAdmin && (
          <div className="flex-grow flex items-center justify-center py-6 px-4 animate-fade-in">
            <div className="w-full max-w-[420px] bg-white rounded-2xl border border-gray-100 shadow-xl p-6 flex flex-col gap-5">
              
              {/* Header */}
              <div className="text-center flex flex-col items-center gap-2">
                <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
                  <span className="text-white text-2xl font-black">ORJON</span>
                </div>
                <h1 className="text-base font-bold text-gray-900 tracking-tight">Quiz & Exam Portal</h1>
              </div>

              {/* Live Exam Quick Callout for Guests */}
              {liveExams.length > 0 && (
                <div className="bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-purple-500/10 border border-amber-300/80 rounded-2xl p-3.5 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-amber-900 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                      ⏱️ লাইভ পরীক্ষা চলছে
                    </span>
                    <span className="text-[10px] bg-amber-200 text-amber-900 font-extrabold px-2 py-0.5 rounded-md">
                      গেস্ট মোড
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-700 font-medium leading-tight">
                    লগইন ছাড়া শুধু ইমেইল আইডি দিয়ে সরাসরি লাইভ পরীক্ষায় অংশ নিতে পারবেন!
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setGuestExamTarget(liveExams[0]);
                      setGuestEmailModalOpen(true);
                    }}
                    className="w-full py-2 bg-gradient-to-r from-amber-500 via-indigo-600 to-purple-600 hover:from-amber-600 hover:to-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>🎯</span> গেস্ট হিসেবে পরীক্ষা দিন ➔
                  </button>
                </div>
              )}

              {/* View Switchers: Login | Register */}
              <div className="flex bg-gray-100 p-1 rounded-xl gap-1 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setAuthScreen('login');
                    setLoginErrorMessage(null);
                    setRegErrors({});
                    setRegGeneralError(null);
                  }}
                  className={`flex-1 py-2 rounded-lg transition text-center ${
                    authScreen === 'login' ? 'bg-white text-indigo-700 shadow-xs' : 'text-gray-500 hover:text-indigo-700'
                  }`}
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthScreen('register');
                    setLoginErrorMessage(null);
                    setRegErrors({});
                    setRegGeneralError(null);
                  }}
                  className={`flex-1 py-2 rounded-lg transition text-center ${
                    authScreen === 'register' ? 'bg-white text-indigo-700 shadow-xs' : 'text-gray-500 hover:text-indigo-700'
                  }`}
                >
                  Register
                </button>
              </div>

              {/* 1. UNIFIED LOGIN FORM (User & Admin in same form) */}
              {authScreen === 'login' && (
                <form onSubmit={handleUserLogin} className="flex flex-col gap-4 text-xs">
                  <div>
                    <label className="block text-gray-700 mb-1 font-semibold">
                      User ID, Email, or Username
                    </label>
                    <input
                      type="text"
                      required
                      value={phoneInput}
                      onChange={e => setPhoneInput(e.target.value)}
                      placeholder="e.g. A7B9X2 / user@email.com / admin"
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-gray-700 font-semibold">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthScreen('forgot-password');
                          setForgotStep('email');
                          setForgotQuery(phoneInput.trim());
                        }}
                        className="text-[11px] font-medium text-indigo-600 hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <input
                      type="password"
                      required
                      value={passwordInput}
                      onChange={e => setPasswordInput(e.target.value)}
                      placeholder="Enter password"
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  {/* Remember Me Checkbox */}
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="rememberMe"
                      checked={rememberMe}
                      onChange={e => setRememberMe(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"
                    />
                    <label htmlFor="rememberMe" className="text-gray-600 text-xs font-medium cursor-pointer select-none">
                      Remember me
                    </label>
                  </div>

                  {sessionTimeoutNotice && (
                    <div className="p-3 bg-amber-50 border border-amber-300/90 rounded-xl text-amber-950 text-xs font-semibold leading-relaxed flex items-start gap-2.5 shadow-2xs">
                      <span className="text-lg shrink-0">🔒</span>
                      <div className="flex-1">
                        <p className="font-extrabold text-amber-950 text-[12px]">সেশন টাইমআউট!</p>
                        <p className="text-[11px] text-amber-900 font-medium mt-0.5">{sessionTimeoutNotice}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSessionTimeoutNotice(null)}
                        className="text-amber-700 hover:text-amber-950 font-bold text-xs p-0.5 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {loginErrorMessage && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-medium">
                      {loginErrorMessage}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl text-xs transition shadow-md shadow-indigo-100 flex items-center justify-center gap-1.5 mt-1"
                  >
                    <LogIn className="w-4 h-4" /> Sign In
                  </button>
                </form>
              )}

              {/* 2. REGISTRATION FORM & EMAIL VERIFICATION STEPS */}
              {authScreen === 'register' && (
                <div className="flex flex-col gap-3 text-xs max-h-[60vh] overflow-y-auto pr-1">
                  
                  {/* STEP 1: REGISTRATION INPUT FORM */}
                  {regStep === 'form' && (
                    <form onSubmit={handleUserRegister} noValidate className="flex flex-col gap-3">
                      {regGeneralError && (
                        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs flex items-center gap-2 font-bold shadow-2xs">
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>{regGeneralError}</span>
                        </div>
                      )}

                      <div>
                        <label className={`block mb-1 font-bold transition-colors ${regErrors.name ? 'text-rose-700' : 'text-gray-600'}`}>
                          Full Name:
                        </label>
                        <input
                          type="text"
                          value={regName}
                          onChange={e => {
                            setRegName(e.target.value);
                            if (regErrors.name) setRegErrors(prev => ({ ...prev, name: '' }));
                            if (regGeneralError) setRegGeneralError(null);
                          }}
                          placeholder="e.g. John Doe / Sakib Hasan"
                          className={`w-full px-3 py-2 border rounded-xl font-medium focus:outline-none transition ${
                            regErrors.name
                              ? 'border-rose-500 bg-rose-50/30 text-rose-900 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500'
                              : 'border-gray-300 text-gray-800 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500'
                          }`}
                        />
                        {regErrors.name && (
                          <p className="text-rose-600 text-[11px] font-bold mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>{regErrors.name}</span>
                          </p>
                        )}
                      </div>

                      <div>
                        <label className={`block mb-1 font-bold flex items-center gap-1 transition-colors ${regErrors.email ? 'text-rose-700' : 'text-gray-600'}`}>
                          <Mail className={`w-3.5 h-3.5 ${regErrors.email ? 'text-rose-600' : 'text-indigo-600'}`} />
                          Email Address (required for verification):
                        </label>
                        <input
                          type="email"
                          value={regEmail}
                          onChange={e => {
                            setRegEmail(e.target.value);
                            if (regErrors.email) setRegErrors(prev => ({ ...prev, email: '' }));
                            if (regGeneralError) setRegGeneralError(null);
                          }}
                          placeholder="e.g. user@example.com"
                          className={`w-full px-3 py-2 border rounded-xl font-medium focus:outline-none transition ${
                            regErrors.email
                              ? 'border-rose-500 bg-rose-50/30 text-rose-900 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500'
                              : 'border-gray-300 text-gray-800 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500'
                          }`}
                        />
                        {regErrors.email && (
                          <p className="text-rose-600 text-[11px] font-bold mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>{regErrors.email}</span>
                          </p>
                        )}
                      </div>

                      <div>
                        <label className={`block mb-1 font-bold flex items-center gap-1 transition-colors ${regErrors.password ? 'text-rose-700' : 'text-gray-600'}`}>
                          <Lock className={`w-3.5 h-3.5 ${regErrors.password ? 'text-rose-600' : 'text-indigo-600'}`} />
                          Password:
                        </label>
                        <div className="relative">
                          <input
                            type={showRegPassword ? 'text' : 'password'}
                            value={regPassword}
                            onChange={e => {
                              setRegPassword(e.target.value);
                              if (regErrors.password) setRegErrors(prev => ({ ...prev, password: '' }));
                              if (regGeneralError) setRegGeneralError(null);
                            }}
                            placeholder="Minimum 6 characters"
                            className={`w-full px-3 py-2 pr-10 border rounded-xl font-medium focus:outline-none transition ${
                              regErrors.password
                                ? 'border-rose-500 bg-rose-50/30 text-rose-900 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500'
                                : 'border-gray-300 text-gray-800 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowRegPassword(!showRegPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-600 focus:outline-none"
                            title={showRegPassword ? 'Hide password' : 'Show password'}
                          >
                            {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        {regErrors.password && (
                          <p className="text-rose-600 text-[11px] font-bold mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>{regErrors.password}</span>
                          </p>
                        )}
                      </div>

                      <div>
                        <label className={`block mb-1 font-bold flex items-center gap-1 transition-colors ${regErrors.confirmPassword ? 'text-rose-700' : 'text-gray-600'}`}>
                          <Lock className={`w-3.5 h-3.5 ${regErrors.confirmPassword ? 'text-rose-600' : 'text-indigo-600'}`} />
                          Confirm Password:
                        </label>
                        <div className="relative">
                          <input
                            type={showRegConfirmPassword ? 'text' : 'password'}
                            value={regConfirmPassword}
                            onChange={e => {
                              setRegConfirmPassword(e.target.value);
                              if (regErrors.confirmPassword) setRegErrors(prev => ({ ...prev, confirmPassword: '' }));
                              if (regGeneralError) setRegGeneralError(null);
                            }}
                            placeholder="Re-enter your password"
                            className={`w-full px-3 py-2 pr-10 border rounded-xl font-medium focus:outline-none transition ${
                              regErrors.confirmPassword
                                ? 'border-rose-500 bg-rose-50/30 text-rose-900 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500'
                                : 'border-gray-300 text-gray-800 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500'
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-600 focus:outline-none"
                            title={showRegConfirmPassword ? 'Hide password' : 'Show password'}
                          >
                            {showRegConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        {regErrors.confirmPassword && (
                          <p className="text-rose-600 text-[11px] font-bold mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>{regErrors.confirmPassword}</span>
                          </p>
                        )}
                      </div>

                      <button
                        type="submit"
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3 rounded-xl transition shadow mt-2 flex items-center justify-center gap-1.5"
                      >
                        <Mail className="w-4 h-4" /> Register & Verify Email
                      </button>
                    </form>
                  )}

                  {/* STEP 2: FIREBASE EMAIL VERIFICATION VIEW */}
                  {regStep === 'verify' && (
                    <div className="flex flex-col gap-3.5 animate-fade-in">
                      <div className="bg-indigo-50/80 border border-indigo-100 p-4 rounded-2xl flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0" />
                          <span className="font-extrabold text-indigo-950 text-xs">Email Verification</span>
                        </div>
                        <p className="text-gray-700 text-[11px] leading-relaxed font-medium">
                          Verification email sent to: <span className="font-bold text-indigo-900 font-mono">{pendingUser?.email}</span>
                        </p>
                      </div>

                      {/* Auto ID Display Badge / Status */}
                      <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex items-center justify-between">
                        <span className="text-[11px] font-bold text-amber-900">User ID Status:</span>
                        <span className="font-bold font-mono text-amber-800 bg-white px-2.5 py-1 rounded-lg border border-amber-200 text-[11px] shadow-2xs">
                          {pendingUser?.userId ? pendingUser.userId : 'Will be generated after email verification'}
                        </span>
                      </div>

                      {/* Verification Status & Notification Box */}
                      {otpDeliveryMessage && (
                        <div className={`p-3.5 rounded-xl text-[11px] font-medium border space-y-1 ${
                          otpDeliveryMessage.isError 
                            ? 'bg-amber-50 border-amber-200 text-amber-900' 
                            : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        }`}>
                          <div className="flex items-center gap-1.5 font-bold">
                            <Mail className="w-4 h-4 shrink-0 text-indigo-600" />
                            <span>Email Status:</span>
                          </div>
                          <p className="leading-relaxed">{otpDeliveryMessage.text}</p>
                        </div>
                      )}

                      <div className="bg-gray-50 border border-gray-200 p-3.5 rounded-xl text-[11px] text-gray-600 space-y-1.5">
                        <div className="font-bold text-gray-800 flex items-center gap-1.5">
                          <HelpCircle className="w-3.5 h-3.5 text-indigo-600" /> Instructions:
                        </div>
                        <ol className="list-decimal list-inside space-y-1 pl-1">
                          <li>Check your email inbox or spam folder.</li>
                          <li>Click on the verification link sent to your email.</li>
                          <li>After clicking the link, click the "I Have Verified My Email" button below.</li>
                        </ol>
                      </div>

                      <button
                        type="button"
                        onClick={handleCheckEmailVerificationStatus}
                        disabled={isSendingOtp}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white font-extrabold py-3.5 rounded-xl transition shadow flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 className="w-4.5 h-4.5" /> I Have Verified My Email / Check Status
                      </button>

                      <div className="flex justify-between items-center pt-1 text-[11px]">
                        <button
                          type="button"
                          disabled={resendCooldown > 0 || isSendingOtp}
                          onClick={handleResendFirebaseVerification}
                          className={`font-bold flex items-center gap-1.5 transition ${
                            resendCooldown > 0 || isSendingOtp 
                              ? 'text-gray-400 cursor-not-allowed' 
                              : 'text-indigo-600 hover:underline'
                          }`}
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isSendingOtp ? 'animate-spin text-indigo-600' : ''}`} />
                          {isSendingOtp 
                            ? 'Sending email...' 
                            : resendCooldown > 0 
                              ? `Resend Verification Email (${resendCooldown}s)` 
                              : 'Resend Verification Email'
                          }
                        </button>
                        <button
                          type="button"
                          onClick={() => setRegStep('form')}
                          className="text-gray-500 hover:underline font-semibold flex items-center gap-1"
                        >
                          <ArrowLeft className="w-3 h-3" /> Edit Details
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STEP 3: SUCCESS & CREDENTIALS DISPLAY */}
                  {regStep === 'success' && (
                    <div className="flex flex-col gap-3.5 animate-fade-in text-xs">
                      <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl text-center flex flex-col items-center gap-2">
                        <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                        <h3 className="font-extrabold text-emerald-950 text-sm">🎉 Registration & Email Verification Successful!</h3>
                        <p className="text-emerald-800 text-[11px] leading-relaxed font-medium">
                          Your email account has been verified successfully.
                        </p>
                      </div>

                      {/* Credentials Box */}
                      <div className="bg-gray-50 border border-gray-200 p-4 rounded-2xl space-y-2.5">
                        <h4 className="font-bold text-gray-800 border-b pb-1.5 text-xs">Your Account & Login Credentials:</h4>
                        
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-gray-500 font-semibold">🆔 User ID:</span>
                          <span className="font-mono font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
                            {pendingUser?.userId}
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-gray-500 font-semibold">📧 Registered Email:</span>
                          <span className="font-mono font-bold text-gray-800">
                            {pendingUser?.email}
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-gray-500 font-semibold">📱 Mobile Number:</span>
                          <span className="font-mono font-bold text-gray-800">
                            {pendingUser?.phone || 'Not added (can be added from profile)'}
                          </span>
                        </div>

                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-gray-500 font-semibold">Status:</span>
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                            ✅ Email Verified
                          </span>
                        </div>
                      </div>

                      <p className="text-[10px] text-gray-500 text-center font-medium leading-relaxed">
                        💡 For future logins, you can use your **User ID** or **Email** (after adding a mobile number in your profile, you can also log in with your phone number).
                      </p>

                      <button
                        type="button"
                        onClick={() => {
                          setPhoneInput(pendingUser?.userId || pendingUser?.email || pendingUser?.phone || '');
                          setAuthScreen('login');
                          setRegStep('form');
                          setRegName('');
                          setRegEmail('');
                          setRegPhone('');
                          setRegPassword('');
                          setRegEducation('');
                          setRegAvatar('');
                        }}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3.5 rounded-2xl text-xs transition shadow-lg shadow-indigo-100 flex items-center justify-center gap-1.5 mt-1"
                      >
                        <LogIn className="w-4 h-4" /> Proceed to Student Portal Login
                      </button>
                    </div>
                  )}

                </div>
              )}

              {/* 3. SECURE ADMIN LOGIN & PASSWORD RESET PORTAL */}
              {authScreen === 'admin-login' && (
                <div className="flex flex-col gap-4 text-xs animate-fade-in">
                  
                  {/* SUB-STEP 1: ADMIN LOGIN FORM */}
                  {adminLoginSubStep === 'login' && (
                    <form onSubmit={handleAdminVerify} className="flex flex-col gap-4">
                      <div className="bg-gradient-to-r from-red-50 to-amber-50 border border-red-100 p-3.5 rounded-2xl flex items-start gap-2.5">
                        <span className="text-xl">🛡️</span>
                        <div>
                          <h3 className="font-extrabold text-red-950 text-xs">এডমিন প্যানেল সিকিউর লগইন</h3>
                          <p className="text-red-800 text-[11px] font-medium leading-relaxed mt-0.5">
                            অর্জন কন্ট্রোল সেন্টারে প্রবেশের জন্য আপনার এডমিন ক্রেডেনশিয়াল প্রদান করুন।
                          </p>
                        </div>
                      </div>

                      <div>
                        <label className="block text-gray-700 mb-1.5 font-bold flex items-center gap-1">
                          <UserCheck className="w-4 h-4 text-red-600" />
                          এডমিন ইউজারনেম / ইমেইল:
                        </label>
                        <input
                          type="text"
                          required
                          value={adminUsernameInput}
                          onChange={e => setAdminUsernameInput(e.target.value)}
                          placeholder="admin / mohidur143@gmail.com"
                          className="w-full px-4 py-3 border rounded-xl text-gray-800 focus:ring-2 focus:ring-red-500 focus:outline-none font-medium"
                        />
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-1.5">
                          <label className="text-gray-700 font-bold flex items-center gap-1">
                            <KeyRound className="w-4 h-4 text-gray-500" />
                            এডমিন পাসওয়ার্ড:
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setAdminLoginSubStep('forgot-request');
                              setAdminForgotQuery(adminUsernameInput.trim() || 'mohidur143@gmail.com');
                            }}
                            className="text-[11px] font-bold text-red-600 hover:text-red-800 hover:underline transition flex items-center gap-1"
                          >
                            🔑 পাসওয়ার্ড ভুলে গেছেন? রিসেট করুন
                          </button>
                        </div>
                        <input
                          type="password"
                          required
                          value={adminPassInput}
                          onChange={e => setAdminPassInput(e.target.value)}
                          placeholder="আপনার গোপন পাসওয়ার্ড দিন"
                          className="w-full px-4 py-3 border rounded-xl text-gray-800 focus:ring-2 focus:ring-red-500 focus:outline-none font-mono"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full bg-red-600 hover:bg-red-700 text-white font-extrabold py-3.5 rounded-2xl text-xs transition shadow-lg shadow-red-100 flex items-center justify-center gap-1.5 mt-1"
                      >
                        🛡️ এডমিন প্যানেলে প্রবেশ করুন
                      </button>
                    </form>
                  )}

                  {/* SUB-STEP 2: ADMIN FORGOT PASSWORD - REQUEST RESET LINK */}
                  {adminLoginSubStep === 'forgot-request' && (
                    <form onSubmit={handleAdminForgotRequestOtp} className="flex flex-col gap-3.5">
                      <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-amber-950 font-extrabold text-xs">
                          <HelpCircle className="w-4 h-4 text-amber-600 shrink-0" />
                          এডমিন পাসওয়ার্ড রিসেট (Firebase Authentication)
                        </div>
                        <p className="text-amber-900 text-[11px] leading-relaxed font-medium">
                          পাসওয়ার্ড রিসেটের জন্য এডমিন নিবন্ধিত ইমেইল অথবা ইউজারনেম নিশ্চিত করুন। Firebase Authentication সরাসরি আপনার ইমেইলে পাসওয়ার্ড রিসেট লিংক পাঠাবে।
                        </p>
                      </div>

                      <div>
                        <label className="block text-gray-700 mb-1.5 font-bold flex items-center gap-1">
                          <Mail className="w-4 h-4 text-amber-600" />
                          এডমিন ইমেইল / ইউজারনেম:
                        </label>
                        <input
                          type="text"
                          required
                          value={adminForgotQuery}
                          onChange={e => setAdminForgotQuery(e.target.value)}
                          placeholder="mohidur143@gmail.com"
                          className="w-full px-4 py-3 border border-amber-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-amber-500 focus:outline-none font-medium bg-white"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isSendingOtp}
                        className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 text-white font-extrabold py-3.5 rounded-2xl text-xs transition shadow-lg shadow-amber-100 flex items-center justify-center gap-1.5"
                      >
                        <Mail className="w-4 h-4" /> {isSendingOtp ? 'ইমেইল পাঠানো হচ্ছে...' : 'পাসওয়ার্ড রিসেট লিংক পাঠান'}
                      </button>

                      <button
                        type="button"
                        onClick={() => setAdminLoginSubStep('login')}
                        className="text-gray-500 hover:text-gray-800 font-bold text-center text-[11px] flex items-center justify-center gap-1 pt-1"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" /> এডমিন লগইনে ফিরে যান
                      </button>
                    </form>
                  )}

                  {/* SUB-STEP 3: ADMIN FORGOT PASSWORD - LINK SENT BANNER */}
                  {adminLoginSubStep === 'forgot-sent' && (
                    <div className="flex flex-col gap-3.5 text-xs animate-fade-in">
                      <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl text-center flex flex-col items-center gap-2">
                        <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                        <h3 className="font-extrabold text-emerald-950 text-sm">🎉 পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে!</h3>
                        <p className="text-emerald-800 text-[11px] leading-relaxed font-medium">
                          Firebase Authentication এর মাধ্যমে এডমিন সিকিউরিটি ইমেইল <span className="font-bold text-emerald-950 font-mono">{adminForgotQuery.includes('@') ? adminForgotQuery : 'mohidur143@gmail.com'}</span>-এ সফলভাবে পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে।
                        </p>
                      </div>

                      <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl text-[11px] text-amber-900 leading-relaxed font-medium">
                        💡 <strong>পরবর্তী করণীয়:</strong> আপনার ইনবক্স অথবা স্প্যাম ফোল্ডার চেক করুন। প্রাপ্ত লিংকে ক্লিক করে নতুন এডমিন পাসওয়ার্ড নিরাপদে সেট করুন। পাসওয়ার্ড পরিবর্তন সম্পন্ন হলে নিচে ক্লিক করে লগইন করুন।
                      </div>

                      <div className="flex justify-between items-center text-[11px] pt-1">
                        <button
                          type="button"
                          disabled={resendCooldown > 0 || isSendingOtp}
                          onClick={handleAdminForgotResendOtp}
                          className={`font-bold flex items-center gap-1.5 transition ${
                            resendCooldown > 0 || isSendingOtp 
                              ? 'text-gray-400 cursor-not-allowed' 
                              : 'text-red-600 hover:underline'
                          }`}
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isSendingOtp ? 'animate-spin text-red-600' : ''}`} />
                          {isSendingOtp 
                            ? 'লিংক পাঠানো হচ্ছে...' 
                            : resendCooldown > 0 
                              ? `পুনরায় লিংক পাঠান (${resendCooldown}s)` 
                              : 'রিসেট লিংক পুনরায় পাঠান'
                          }
                        </button>
                        <button
                          type="button"
                          onClick={() => setAdminLoginSubStep('forgot-request')}
                          className="text-gray-500 hover:underline font-semibold flex items-center gap-1"
                        >
                          <ArrowLeft className="w-3 h-3" /> ইমেইল পরিবর্তন করুন
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setAdminLoginSubStep('login');
                          setAdminPassInput('');
                        }}
                        className="w-full bg-red-600 hover:bg-red-700 text-white font-extrabold py-3.5 rounded-2xl text-xs transition shadow-lg shadow-red-100 flex items-center justify-center gap-1.5 mt-1"
                      >
                        <LogIn className="w-4 h-4" /> এডমিন লগইনে ফিরে যান
                      </button>
                    </div>
                  )}

                </div>
              )}

              {/* 4. FORGOT PASSWORD VIEW */}
              {authScreen === 'forgot-password' && (
                <div className="flex flex-col gap-3.5 text-xs animate-fade-in">
                  
                  {/* Step 1: Request Password Reset via Firebase Auth */}
                  {forgotStep === 'email' && (
                    <form onSubmit={handleForgotRequestOtp} className="flex flex-col gap-3.5">
                      <div className="bg-indigo-50/80 border border-indigo-100 p-3.5 rounded-2xl flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-indigo-950 font-extrabold text-xs">
                          <HelpCircle className="w-4 h-4 text-indigo-600 shrink-0" />
                          Password Recovery (Firebase Authentication)
                        </div>
                        <p className="text-gray-600 text-[11px] leading-relaxed font-medium">
                          Enter your registered email address, User ID, or mobile number. Firebase Authentication will send a secure password reset link to your email.
                        </p>
                      </div>

                      <div>
                        <label className="block text-gray-700 mb-1.5 font-bold flex items-center gap-1">
                          <Mail className="w-4 h-4 text-indigo-600" />
                          Registered Email / User ID / Mobile Number:
                        </label>
                        <input
                          type="text"
                          required
                          value={forgotQuery}
                          onChange={e => setForgotQuery(e.target.value)}
                          placeholder="e.g. user@example.com / ORJ-1029A / 017XXXXXXXX"
                          className="w-full px-4 py-3 border border-indigo-200 rounded-xl text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none font-medium bg-white"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isSendingOtp}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-extrabold py-3.5 rounded-2xl text-xs transition shadow-lg shadow-indigo-100 flex items-center justify-center gap-1.5"
                      >
                        <Mail className="w-4 h-4" /> {isSendingOtp ? 'Sending Reset Email...' : 'Send Password Reset Link'}
                      </button>

                      <button
                        type="button"
                        onClick={() => setAuthScreen('login')}
                        className="text-gray-500 hover:text-gray-800 font-bold text-center text-[11px] flex items-center justify-center gap-1 pt-1"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" /> Back to Student Login
                      </button>
                    </form>
                  )}

                  {/* Step 2: Reset Link Sent Confirmation */}
                  {forgotStep === 'sent' && (
                    <div className="flex flex-col gap-3.5 text-xs animate-fade-in">
                      <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl text-center flex flex-col items-center gap-2">
                        <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                        <h3 className="font-extrabold text-emerald-950 text-sm">🎉 Password Reset Link Dispatched!</h3>
                        <p className="text-emerald-800 text-[11px] leading-relaxed font-medium">
                          A secure password reset email has been sent by Firebase Authentication to:
                        </p>
                        <div className="font-mono font-bold text-indigo-900 bg-white/80 px-3 py-1.5 rounded-lg border border-emerald-200 text-xs">
                          {forgotTargetEmail || forgotUser?.email || forgotQuery}
                        </div>
                      </div>

                      <div className="bg-indigo-50 border border-indigo-100 p-3.5 rounded-2xl text-[11px] text-indigo-900 leading-relaxed font-medium">
                        📌 <strong>Next steps:</strong> Open your email inbox (and check the spam/junk folder). Click the password reset link to securely enter your new password directly on Firebase's authentication server.
                      </div>

                      <div className="flex justify-between items-center text-[11px] pt-1">
                        <button
                          type="button"
                          disabled={resendCooldown > 0 || isSendingOtp}
                          onClick={handleForgotResendOtp}
                          className={`font-bold flex items-center gap-1.5 transition ${
                            resendCooldown > 0 || isSendingOtp 
                              ? 'text-gray-400 cursor-not-allowed' 
                              : 'text-indigo-600 hover:underline'
                          }`}
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isSendingOtp ? 'animate-spin text-indigo-600' : ''}`} />
                          {isSendingOtp 
                            ? 'Sending email...' 
                            : resendCooldown > 0 
                              ? `Resend Link (${resendCooldown}s)` 
                              : 'Resend Reset Link'
                          }
                        </button>
                        <button
                          type="button"
                          onClick={() => setForgotStep('email')}
                          className="text-gray-500 hover:underline font-semibold flex items-center gap-1"
                        >
                          <ArrowLeft className="w-3 h-3" /> Change Identifier
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setPhoneInput(forgotTargetEmail || forgotUser?.email || forgotUser?.userId || forgotUser?.phone || '');
                          setPasswordInput('');
                          setAuthScreen('login');
                          setForgotStep('email');
                          setForgotQuery('');
                          setForgotUser(null);
                        }}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3.5 rounded-2xl text-xs transition shadow-lg shadow-indigo-100 flex items-center justify-center gap-1.5 mt-1"
                      >
                        <LogIn className="w-4 h-4" /> Back to Login
                      </button>
                    </div>
                  )}

                </div>
              )}

              {/* Small helpful tips */}
              <div className="border-t pt-3 flex justify-between items-center text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> STUDY ZONE</span>
                <span className="flex items-center gap-1"><UserCheck className="w-3 h-3" /> VERIFIED</span>
              </div>

            </div>
          </div>
        )}

      </div>

      {/* Global Logout Confirmation Modal */}
      {showLogoutConfirmModal && (
        <div className="fixed inset-0 bg-black/60 z-[99999] flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-white w-full max-w-[380px] rounded-3xl p-6 flex flex-col gap-4 shadow-2xl animate-scale-up text-center">
            <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto text-2xl border border-rose-100 shadow-xs">
              🚪
            </div>
            <div>
              <h3 className="font-extrabold text-gray-900 text-base">লগআউট নিশ্চিতকরণ</h3>
              <p className="text-xs text-gray-600 font-semibold leading-relaxed mt-1.5">
                {currentUser ? `${currentUser.name}, আপনি কি নিশ্চিতভাবে অর্জন পোর্টাল থেকে লগআউট করতে চান?` : 'আপনি কি নিশ্চিতভাবে আপনার অ্যাকাউন্ট থেকে লগআউট করতে চান?'}
              </p>
            </div>
            <div className="flex gap-3 mt-1">
              <button
                type="button"
                onClick={() => setShowLogoutConfirmModal(false)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-2xl text-xs transition cursor-pointer"
              >
                না, ফিরে যান
              </button>
              <button
                type="button"
                onClick={confirmLogout}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-extrabold py-3 rounded-2xl text-xs transition shadow-md shadow-rose-100 cursor-pointer"
              >
                হ্যাঁ, লগআউট করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Guest Email Modal Overlay */}
      {guestEmailModalOpen && guestExamTarget && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[99999] animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 border border-gray-100 shadow-2xl flex flex-col gap-4 text-xs">
            <div className="flex justify-between items-center border-b pb-3 border-gray-100">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
                <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
                  লাইভ পরীক্ষা (গেস্ট মোড)
                </h3>
              </div>
              <button
                onClick={() => {
                  setGuestEmailModalOpen(false);
                  setGuestExamTarget(null);
                  setGuestError(null);
                }}
                className="text-slate-400 hover:text-slate-600 font-extrabold text-base p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="bg-indigo-50/80 border border-indigo-100 rounded-2xl p-3.5 space-y-1">
              <h4 className="font-black text-indigo-950 text-sm">{guestExamTarget.title}</h4>
              <div className="flex flex-wrap gap-2 text-[10.5px] text-indigo-700 font-bold pt-0.5">
                <span>প্রস্তুতি বিষয়: {guestExamTarget.category === 'ALL' ? 'সব বিষয়' : guestExamTarget.category}</span>
                <span>•</span>
                <span>প্রশ্ন: {guestExamTarget.qLimit}টি</span>
                <span>•</span>
                <span>সময়: {guestExamTarget.timeLimit} মিনিট</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-slate-800 font-bold text-xs">
                আপনার ইমেইল এড্রেস প্রদান করুন: <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                required
                value={guestEmailInput}
                onChange={(e) => {
                  setGuestEmailInput(e.target.value);
                  setGuestError(null);
                }}
                placeholder="যেমন: student@gmail.com"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
              />
              <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                💡 পাসওয়ার্ড বা ইমেইল ভেরিফিকেশনের প্রয়োজন নেই। পরীক্ষা শেষে অর্জিত নম্বর দেখতে পাবেন। পরবর্তীতে অ্যাকাউন্ট রেজিস্ট্রেশন করলে আপনার সকল আগের গেস্ট পরীক্ষার বিস্তারিত সমাধান ও PDF রেজাল্ট কার্ড আনলক হয়ে যাবে।
              </p>
              {guestError && (
                <p className="text-[11px] text-rose-600 font-extrabold bg-rose-50 border border-rose-200 p-2 rounded-lg">
                  ⚠️ {guestError}
                </p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-gray-100">
              <button
                onClick={() => handleStartGuestExam(guestExamTarget, guestEmailInput)}
                className="flex-1 py-3 bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-700 hover:to-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>🎯</span> পরীক্ষা শুরু করুন ➔
              </button>
              <button
                onClick={() => {
                  setGuestEmailModalOpen(false);
                  setAuthScreen('login');
                }}
                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                লগইন করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modern footer */}
      <footer className="w-full bg-white border-t border-gray-150 py-4 text-center text-[10px] text-gray-400 font-bold uppercase tracking-widest">
        © 2026 Orjon MCQ Inc • Crafted for Academic Excellence
      </footer>
    </div>
  );
}
