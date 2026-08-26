import React, { useState, useEffect } from 'react';
import { 
  Question, 
  LiveExam, 
  Notice, 
  Routine, 
  User, 
  Attempt, 
  Bookmark, 
  CategoryItem, 
  SubcategoryItem, 
  Course, 
  Coupon, 
  CourseEnrollment, 
  PaymentSettings, 
  DEFAULT_PAYMENT_SETTINGS, 
  generateAutoUserId 
} from '../shared/types';
import { 
  INITIAL_QUESTIONS, 
  INITIAL_NOTICES, 
  INITIAL_ROUTINES, 
  INITIAL_LIVE_EXAMS, 
  INITIAL_USERS,
  INITIAL_COURSES,
  INITIAL_COUPONS
} from '../shared/data';
import UserApp from './UserApp';
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
} from '../shared/lib/migration';
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
} from '../shared/lib/indexedDB';
import { 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail, 
  signInWithEmailAndPassword,
  sendEmailVerification,
  reload,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { auth } from '../shared/lib/firebase';
import { LogIn, Sparkles, BookOpen, Smartphone, Mail, ShieldCheck, CheckCircle2, RefreshCw, ArrowLeft, Lock, RotateCcw, HelpCircle, Eye, EyeOff, AlertCircle } from 'lucide-react';

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

export default function MobileApp() {
  // Database States (strictly client & user-facing)
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
  const [allowUserExplanation] = useState<boolean>(() => {
    return (localStorage.getItem('orjon_allow_user_explanation') || localStorage.getItem('medha_allow_user_explanation')) !== 'false';
  });
  const [showMcqCount] = useState<boolean>(() => {
    return (localStorage.getItem('orjon_show_mcq_count') || localStorage.getItem('medha_show_mcq_count')) !== 'false';
  });

  // Auth / Active User Session States
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authScreen, setAuthScreen] = useState<'login' | 'register' | 'forgot-password'>('login');

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
  const [regGender, setRegGender] = useState('পুরুষ');
  const [regEducation, setRegEducation] = useState('');
  const [regAvatar, setRegAvatar] = useState('');
  const [regErrors, setRegErrors] = useState<Record<string, string>>({});
  const [regGeneralError, setRegGeneralError] = useState<string | null>(null);

  // Email Verification states
  const [regStep, setRegStep] = useState<'form' | 'verify' | 'success'>('form');
  const [pendingUser, setPendingUser] = useState<User | null>(null);

  // Real Email Verification States & Cooldown
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

  // Forgot Password states
  const [forgotStep, setForgotStep] = useState<'email' | 'sent'>('email');
  const [forgotQuery, setForgotQuery] = useState('');
  const [forgotUser, setForgotUser] = useState<User | null>(null);
  const [forgotTargetEmail, setForgotTargetEmail] = useState('');

  // Guest Live Exam states
  const [directExamId, setDirectExamId] = useState<string | null>(null);
  const [guestEmailModalOpen, setGuestEmailModalOpen] = useState(false);
  const [guestExamTarget, setGuestExamTarget] = useState<LiveExam | null>(null);
  const [guestEmailInput, setGuestEmailInput] = useState('');
  const [guestError, setGuestError] = useState<string | null>(null);

  // Security Session Timeout states
  const [sessionTimeoutNotice, setSessionTimeoutNotice] = useState<string | null>(null);
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);
  const storedTimeoutMins = 30; // standard mobile app session duration

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

    // Notices seed
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

    // Courses seed
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

    // Live exams & routines
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

    // Background incremental sync
    performIncrementalSyncFromFirestore((updatedQuestions) => {
      if (updatedQuestions && updatedQuestions.length > 0) {
        const dedupedQ = dedupeQuestions(updatedQuestions);
        setQuestions(dedupedQ);
        try {
          localStorage.setItem('orjon_questions', JSON.stringify(dedupedQ));
        } catch (e) {}
        syncSubcategoriesWithFirestoreQuestions(dedupedQ);
      }
    }).catch(err => {});

    performIncrementalCourseSyncFromFirestore((updatedCourses) => {
      if (updatedCourses && updatedCourses.length > 0) {
        const dedupedC = dedupeCourses(updatedCourses);
        setCourses(dedupedC);
        try {
          localStorage.setItem('orjon_courses', JSON.stringify(dedupedC));
        } catch (e) {}
      }
    }).catch(err => {});

    performIncrementalExamSyncFromFirestore(({ liveExams: updatedLE, routines: updatedR }) => {
      if (updatedLE && updatedLE.length > 0) {
        const dedupedLE = dedupeLiveExams(updatedLE);
        setLiveExams(dedupedLE);
        try {
          localStorage.setItem('orjon_live_exams', JSON.stringify(dedupedLE));
        } catch (e) {}
      }
      if (updatedR && updatedR.length > 0) {
        const dedupedR = dedupeRoutines(updatedR);
        setRoutines(dedupedR);
        try {
          localStorage.setItem('orjon_routines', JSON.stringify(dedupedR));
        } catch (e) {}
      }
    }).catch(err => {});

    // Users database seed
    const storedU = localStorage.getItem('orjon_users') || localStorage.getItem('medha_users');
    if (storedU) {
      try {
        setUsers(JSON.parse(storedU));
      } catch (e) {
        setUsers(INITIAL_USERS);
      }
    } else {
      localStorage.setItem('orjon_users', JSON.stringify(INITIAL_USERS));
      setUsers(INITIAL_USERS);
    }

    // Attempts database seed
    const storedA = localStorage.getItem('orjon_attempts') || localStorage.getItem('medha_attempts');
    if (storedA) {
      setAttempts(JSON.parse(storedA));
    } else {
      fetchCollectionFromFirestore<Attempt>('attempts').then(fsA => {
        if (fsA && fsA.length > 0) {
          setAttempts(fsA);
          localStorage.setItem('orjon_attempts', JSON.stringify(fsA));
        }
      }).catch(() => {});
    }

    // Bookmarks database seed
    const storedB = localStorage.getItem('orjon_bookmarks') || localStorage.getItem('medha_bookmarks');
    if (storedB) {
      setBookmarks(JSON.parse(storedB));
    }

    // Standard Categories
    const standardRootCategories: CategoryItem[] = [
      { id: 'cat-1', name: 'বিষয়ভিত্তিক প্রস্তুতি' },
      { id: 'cat-2', name: 'জব সলিউশন পরীক্ষা' },
      { id: 'cat-3', name: 'সাল ভিত্তিক জব সলিউশন' },
      { id: 'cat-4', name: 'সাম্প্রতিক বিষয়াবলী' }
    ];
    setCategories(standardRootCategories);
    localStorage.setItem('orjon_categories', JSON.stringify(standardRootCategories));

    // Subcategories initial setup
    const storedSub = localStorage.getItem('orjon_subcategories') || localStorage.getItem('medha_subcategories');
    if (storedSub) {
      try {
        setSubcategories(JSON.parse(storedSub));
      } catch (e) {}
    }

    fetchCollectionFromFirestore<SubcategoryItem>('subcategories').then(fsSub => {
      if (fsSub && fsSub.length > 0) {
        setSubcategories(fsSub);
        localStorage.setItem('orjon_subcategories', JSON.stringify(fsSub));
      }
    }).catch(() => {});

    // Check active user login session
    const activeUserPhone = localStorage.getItem('orjon_session_user') || sessionStorage.getItem('orjon_session_user') || localStorage.getItem('medha_session_user');
    if (activeUserPhone) {
      const allUsers: User[] = JSON.parse(localStorage.getItem('orjon_users') || localStorage.getItem('medha_users') || '[]');
      const found = allUsers.find(u => 
        (u.phone && u.phone === activeUserPhone) || 
        (u.userId && u.userId === activeUserPhone) || 
        (u.email && u.email.toLowerCase() === activeUserPhone.toLowerCase())
      );
      if (found) {
        setCurrentUser(found);
      }
    }
  }, []);

  // Firebase Auth State Listener (Student / User only)
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser && fbUser.email) {
        const allUsers: User[] = JSON.parse(localStorage.getItem('orjon_users') || '[]');
        const matched = allUsers.find(u => u.email && u.email.toLowerCase() === fbUser.email?.toLowerCase());
        if (matched) {
          setCurrentUser(matched);
        }
      }
    });

    return () => {
      unsubscribeAuth();
    };
  }, []);

  const syncSubcategoriesWithFirestoreQuestions = async (questionsList: Question[]) => {
    let fsSubcats: SubcategoryItem[] = [];
    try {
      fsSubcats = await fetchCollectionFromFirestore<SubcategoryItem>('subcategories');
    } catch (err) {}

    let combinedSubcats = [...fsSubcats];
    setSubcategories(combinedSubcats);
    localStorage.setItem('orjon_subcategories', JSON.stringify(combinedSubcats));
  };

  const dedupeQuestions = (rawList: Question[]): Question[] => {
    const map = new Map<string, Question>();
    rawList.forEach(q => {
      if (q && q.id) {
        map.set(q.id, q);
      }
    });
    return Array.from(map.values());
  };

  const dedupeCourses = (rawList: Course[]): Course[] => {
    const map = new Map<string, Course>();
    rawList.forEach(c => {
      if (c && c.id) {
        map.set(c.id, c);
      }
    });
    return Array.from(map.values());
  };

  const dedupeLiveExams = (rawList: LiveExam[]): LiveExam[] => {
    const map = new Map<string, LiveExam>();
    rawList.forEach(e => {
      if (e && e.id) {
        map.set(e.id, e);
      }
    });
    return Array.from(map.values());
  };

  const dedupeRoutines = (rawList: Routine[]): Routine[] => {
    const map = new Map<string, Routine>();
    rawList.forEach(r => {
      if (r && r.id) {
        map.set(r.id, r);
      }
    });
    return Array.from(map.values());
  };

  const updateUsersDB = (newU: User[]) => {
    const userMap = new Map<string, User>();
    newU.forEach(u => {
      const sanitizedUser = { ...u };
      const k = sanitizedUser.email ? sanitizedUser.email.toLowerCase() : sanitizedUser.phone || sanitizedUser.userId;
      if (k) userMap.set(k, sanitizedUser);
    });
    const dedupedUsers = Array.from(userMap.values());
    setUsers(dedupedUsers);
    localStorage.setItem('orjon_users', JSON.stringify(dedupedUsers));
    const verifiedUsersOnly = dedupedUsers.filter(u => u.emailVerified === true);
    syncCollectionToFirestore('users', verifiedUsersOnly, 'user');
  };

  const updateAttemptsDB = (newA: Attempt[]) => {
    setAttempts(newA);
    localStorage.setItem('orjon_attempts', JSON.stringify(newA));
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

  // Student Authentication Handlers
  const handleUserLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginErrorMessage(null);
    const query = phoneInput.trim().toLowerCase();
    const pass = passwordInput.trim();

    if (!query || !pass) {
      setLoginErrorMessage('Please enter your User ID, Email, or Phone, and Password.');
      return;
    }

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

    if (!isVerified) {
      setLoginErrorMessage('Your email address is not verified yet. Please check your email inbox (and spam folder) and click the verification link.');
      try {
        if (firebaseUser) {
          await sendEmailVerification(firebaseUser);
        }
      } catch (sendErr) {}
      return;
    }

    const autoAssignedId = found?.userId || generateAutoUserId();
    const activeUser: User = found ? {
      ...found,
      userId: autoAssignedId,
      emailVerified: true
    } : {
      userId: autoAssignedId,
      name: firebaseUser.displayName || userEmailToAuth.split('@')[0],
      phone: '',
      email: userEmailToAuth,
      emailVerified: true,
      gender: 'অন্যান্য',
      education: 'সাধারণ শিক্ষার্থী',
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(userEmailToAuth)}`,
      lifetimeAnswered: 0,
      lifetimeCorrect: 0,
      lifetimeWrong: 0,
      createdAt: new Date().toISOString()
    };

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

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      const firebaseUser = userCredential.user;

      if (firebaseUser) {
        await sendEmailVerification(firebaseUser);
      }
    } catch (fbError: any) {
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
      setOtpDeliveryMessage({
        text: `Error sending email: ${err.message || 'Could not send verification link.'}`,
        isError: true
      });
    } finally {
      setIsSendingOtp(false);
    }
  };

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
        text: `A secure password reset link has been dispatched to ${targetEmail}. Please check your inbox (and spam folder) and click the link to reset your password.`,
        isError: false
      });
      setResendCooldown(60);
    } catch (fbErr: any) {
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

  const [showLogoutConfirmModal, setShowLogoutConfirmModal] = useState(false);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {}
    setCurrentUser(null);
    localStorage.removeItem('orjon_session_user');
    localStorage.removeItem('medha_session_user');
    sessionStorage.removeItem('orjon_session_user');
  };

  const handleAddBookmark = (questionId: string, folder: string) => {
    if (!currentUser) return;
    const isAlreadyBookmarked = bookmarks.some(b => b.questionId === questionId && b.userPhone === currentUser.phone);
    if (isAlreadyBookmarked) return;

    const newBookmark: Bookmark = {
      id: `bookmark_${Date.now()}`,
      userPhone: currentUser.phone || currentUser.userId || currentUser.email || 'user',
      questionId,
      folderName: folder,
      createdAt: new Date().toISOString()
    };
    const updated = [...bookmarks, newBookmark];
    updateBookmarksDB(updated);
  };

  const handleRemoveBookmark = (bookmarkId: string) => {
    const updated = bookmarks.filter(b => b.id !== bookmarkId && b.questionId !== bookmarkId);
    updateBookmarksDB(updated);
  };

  const handleSaveAttempt = (attemptData: Omit<Attempt, 'id' | 'submittedAt'>) => {
    if (!currentUser) return;
    const nowIso = new Date().toISOString();
    const fullAttempt: Attempt = {
      ...attemptData,
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
      if ((u.phone && u.phone === currentUser.phone) || (u.userId && u.userId === currentUser.userId) || (u.email && u.email === currentUser.email)) {
        const newUserObj: User = {
          ...u,
          lifetimeAnswered: (u.lifetimeAnswered || 0) + attemptData.totalQuestions,
          lifetimeCorrect: (u.lifetimeCorrect || 0) + attemptData.correctCount,
          lifetimeWrong: (u.lifetimeWrong || 0) + attemptData.wrongCount
        };
        setCurrentUser(newUserObj);
        return newUserObj;
      }
      return u;
    });

    updateUsersDB(updatedUsers);
  };

  const handleUpdateQuestion = (id: string, partial: Partial<Question>) => {
    const updated = questions.map(q => q.id === id ? { ...q, ...partial } : q);
    setQuestions(updated);
    saveQuestionsToIDB(updated);
    updateQuestionInFirestore(id, partial).catch(() => {});
  };

  const handleUpdateUserProfile = (updatedUser: User) => {
    setCurrentUser(updatedUser);
    const updatedUsers = users.map(u => 
      (u.phone && u.phone === updatedUser.phone) || (u.userId && u.userId === updatedUser.userId) || (u.email && u.email === updatedUser.email) ? updatedUser : u
    );
    updateUsersDB(updatedUsers);
  };

  const handleEnrollCourse = async (enrollmentData: Omit<CourseEnrollment, 'id' | 'enrolledAt'>) => {
    const newEnrollment: CourseEnrollment = {
      ...enrollmentData,
      id: `enroll_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      enrolledAt: new Date().toISOString()
    };
    const updated = [newEnrollment, ...courseEnrollments];
    setCourseEnrollments(updated);
    localStorage.setItem('orjon_course_enrollments', JSON.stringify(updated));
    saveItemToFirestore('course_enrollments', newEnrollment, 'enroll').catch(() => {});
  };

  const handleFetchQuestionsLazy = async (filter: { category?: string; subcategory?: string; topic?: string; examId?: string; forceRefresh?: boolean }): Promise<Question[]> => {
    try {
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
    } catch (e) {
      return questions;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Dynamic Shell Grid Layout */}
      <div className="w-full max-w-5xl mx-auto p-1 sm:p-2 md:p-2.5 flex-grow flex flex-col overflow-x-hidden">
        {/* LOGGED IN USER VIEW */}
        {currentUser && (
          <UserApp 
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
            onLogout={() => setShowLogoutConfirmModal(true)}
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

        {/* AUTHENTICATION PORTAL (Students Only) */}
        {!currentUser && (
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

              {/* 1. STUDENT LOGIN FORM */}
              {authScreen === 'login' && (
                <form onSubmit={handleUserLogin} className="flex flex-col gap-4 text-xs">
                  <div>
                    <label className="block text-gray-700 mb-1 font-semibold">
                      User ID, Email, or Phone
                    </label>
                    <input
                      type="text"
                      required
                      value={phoneInput}
                      onChange={e => setPhoneInput(e.target.value)}
                      placeholder="e.g. A7B9X2 / user@email.com"
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
                            if (regErrors.name) setRegErrors({ ...regErrors, name: '' });
                          }}
                          placeholder="Your Name"
                          className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none ${regErrors.name ? 'border-rose-300 bg-rose-50/30' : 'border-gray-200'}`}
                        />
                        {regErrors.name && <p className="text-rose-600 text-[11px] mt-1 font-bold">{regErrors.name}</p>}
                      </div>

                      <div>
                        <label className={`block mb-1 font-bold transition-colors ${regErrors.email ? 'text-rose-700' : 'text-gray-600'}`}>
                          Email Address:
                        </label>
                        <input
                          type="email"
                          value={regEmail}
                          onChange={e => {
                            setRegEmail(e.target.value);
                            if (regErrors.email) setRegErrors({ ...regErrors, email: '' });
                          }}
                          placeholder="your.email@example.com"
                          className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none ${regErrors.email ? 'border-rose-300 bg-rose-50/30' : 'border-gray-200'}`}
                        />
                        {regErrors.email && <p className="text-rose-600 text-[11px] mt-1 font-bold">{regErrors.email}</p>}
                      </div>

                      <div>
                        <label className={`block mb-1 font-bold transition-colors ${regErrors.password ? 'text-rose-700' : 'text-gray-600'}`}>
                          Password:
                        </label>
                        <div className="relative">
                          <input
                            type={showRegPassword ? "text" : "password"}
                            value={regPassword}
                            onChange={e => {
                              setRegPassword(e.target.value);
                              if (regErrors.password) setRegErrors({ ...regErrors, password: '' });
                            }}
                            placeholder="At least 6 characters"
                            className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none ${regErrors.password ? 'border-rose-300 bg-rose-50/30' : 'border-gray-200'}`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowRegPassword(!showRegPassword)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                          >
                            {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        {regErrors.password && <p className="text-rose-600 text-[11px] mt-1 font-bold">{regErrors.password}</p>}
                      </div>

                      <div>
                        <label className={`block mb-1 font-bold transition-colors ${regErrors.confirmPassword ? 'text-rose-700' : 'text-gray-600'}`}>
                          Confirm Password:
                        </label>
                        <div className="relative">
                          <input
                            type={showRegConfirmPassword ? "text" : "password"}
                            value={regConfirmPassword}
                            onChange={e => {
                              setRegConfirmPassword(e.target.value);
                              if (regErrors.confirmPassword) setRegErrors({ ...regErrors, confirmPassword: '' });
                            }}
                            placeholder="Repeat password"
                            className={`w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none ${regErrors.confirmPassword ? 'border-rose-300 bg-rose-50/30' : 'border-gray-200'}`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                          >
                            {showRegConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        {regErrors.confirmPassword && <p className="text-rose-600 text-[11px] mt-1 font-bold">{regErrors.confirmPassword}</p>}
                      </div>

                      <button
                        type="submit"
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-xs transition shadow-md shadow-indigo-100 mt-2"
                      >
                        Register
                      </button>
                    </form>
                  )}

                  {regStep === 'verify' && (
                    <div className="flex flex-col gap-4 text-center py-2">
                      <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto text-xl font-black">
                        ✉️
                      </div>
                      <div>
                        <h3 className="font-extrabold text-sm text-gray-900">Verify Your Email</h3>
                        <p className="text-gray-600 text-xs mt-1 leading-relaxed">
                          We sent a verification link to <strong className="text-indigo-600">{pendingUser?.email}</strong>.
                        </p>
                      </div>

                      {otpDeliveryMessage && (
                        <div className={`p-3 rounded-xl text-xs font-medium text-left ${otpDeliveryMessage.isError ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'}`}>
                          {otpDeliveryMessage.text}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={handleCheckEmailVerificationStatus}
                        disabled={isSendingOtp}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5"
                      >
                        {isSendingOtp ? 'Checking status...' : 'I have verified my email ➔'}
                      </button>

                      <button
                        type="button"
                        onClick={handleResendFirebaseVerification}
                        disabled={resendCooldown > 0 || isSendingOtp}
                        className={`w-full py-2 rounded-xl text-xs font-bold transition border border-gray-200 ${
                          resendCooldown > 0 || isSendingOtp ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {resendCooldown > 0 ? `Resend Link (${resendCooldown}s)` : 'Resend Link'}
                      </button>
                    </div>
                  )}

                  {regStep === 'success' && (
                    <div className="flex flex-col items-center gap-3 text-center py-4">
                      <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="w-8 h-8" />
                      </div>
                      <h3 className="font-bold text-gray-900 text-base">Registration Complete!</h3>
                      <p className="text-gray-600 text-xs">
                        Your auto-generated User ID: <strong className="text-indigo-600 font-mono text-sm">{pendingUser?.userId}</strong>
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          if (pendingUser) {
                            setCurrentUser(pendingUser);
                          }
                        }}
                        className="w-full mt-2 py-2.5 bg-indigo-600 text-white font-bold rounded-xl text-xs hover:bg-indigo-700 transition"
                      >
                        Go to Dashboard ➔
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* 3. FORGOT PASSWORD VIEW */}
              {authScreen === 'forgot-password' && (
                <div className="flex flex-col gap-4 text-xs">
                  {forgotStep === 'email' ? (
                    <form onSubmit={handleForgotRequestOtp} className="flex flex-col gap-3">
                      <div>
                        <label className="block text-gray-700 mb-1 font-bold">
                          Enter your Email or User ID:
                        </label>
                        <input
                          type="text"
                          required
                          value={forgotQuery}
                          onChange={e => setForgotQuery(e.target.value)}
                          placeholder="your.email@example.com / User ID"
                          className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isSendingOtp}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl transition text-xs shadow-md shadow-indigo-100 mt-1"
                      >
                        {isSendingOtp ? 'Sending reset link...' : 'Send Reset Link ➔'}
                      </button>

                      <button
                        type="button"
                        onClick={() => setAuthScreen('login')}
                        className="w-full text-center text-gray-500 hover:text-gray-800 text-xs font-semibold py-1.5"
                      >
                        Back to Login
                      </button>
                    </form>
                  ) : (
                    <div className="flex flex-col gap-3 text-center">
                      <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium text-left">
                        {otpDeliveryMessage?.text || 'Password reset link sent to your email.'}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setAuthScreen('login');
                          setForgotStep('email');
                        }}
                        className="w-full bg-indigo-600 text-white font-bold py-2.5 rounded-xl text-xs hover:bg-indigo-700 transition mt-2"
                      >
                        Back to Login
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Guest Email Modal */}
      {guestEmailModalOpen && guestExamTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-2xl flex flex-col gap-4 border border-gray-100">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-base text-gray-900">গেস্ট হিসেবে পরীক্ষা দিন</h3>
              <button 
                onClick={() => setGuestEmailModalOpen(false)}
                className="text-gray-400 hover:text-gray-700 font-bold p-1"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              পরীক্ষা: <strong className="text-indigo-600">{guestExamTarget.title}</strong>
              <br />
              আপনার ফলাফল ও পজিশন নির্ভুলভাবে সংরক্ষণের জন্য একটি ইমেইল দিন।
            </p>
            {guestError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium">
                {guestError}
              </div>
            )}
            <input 
              type="email"
              value={guestEmailInput}
              onChange={e => setGuestEmailInput(e.target.value)}
              placeholder="student@example.com"
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setGuestEmailModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition"
              >
                বাতিল
              </button>
              <button
                type="button"
                onClick={() => handleStartGuestExam(guestExamTarget, guestEmailInput)}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-md shadow-indigo-100"
              >
                শুরু করুন ➔
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-2xl p-5 shadow-2xl flex flex-col gap-4 border border-gray-100 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto text-xl">
              🚪
            </div>
            <div>
              <h3 className="font-extrabold text-base text-gray-900">লগআউট নিশ্চিতকরণ</h3>
              <p className="text-xs text-gray-500 mt-1">আপনি কি নিশ্চিতভাবে অ্যাকাউন্ট থেকে লগআউট করতে চান?</p>
            </div>
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={() => setShowLogoutConfirmModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition cursor-pointer"
              >
                না, ফিরে যান
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLogoutConfirmModal(false);
                  handleLogout();
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-md shadow-rose-100 cursor-pointer"
              >
                হ্যাঁ, লগআউট
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
