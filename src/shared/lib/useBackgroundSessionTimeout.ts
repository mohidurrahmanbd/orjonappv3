import { useEffect, useRef, useCallback } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { signOut } from 'firebase/auth';
import { auth } from './firebase';
import {
  getActiveExamSession,
  autoSubmitExpiredExamSession,
  ActiveExamSession
} from './examSession';
import { Attempt } from '../types';

export const BACKGROUND_TIMESTAMP_KEY = 'orjon_background_timestamp';
export const LAST_ACTIVITY_KEY = 'orjon_last_activity';
export const DEFAULT_TIMEOUT_MINUTES = 15;

export interface UseBackgroundSessionTimeoutOptions {
  isAuthenticated: boolean;
  isAdmin?: boolean;
  user?: { phone?: string; email?: string; name?: string; userId?: string } | null;
  onLogout: (reason: 'timeout' | 'manual') => Promise<void> | void;
  onSaveAttempt?: (attempt: Attempt) => void;
  onTimeoutNotice?: (message: string) => void;
  onWarningStateChange?: (isWarning: boolean) => void;
  inactivityTimeoutMinutes?: number;
}

/**
 * Phase 4B: Shared background session timeout & exam-aware inactivity management.
 *
 * Rules:
 * 1. No Active Exam: After 15 minutes in background -> await signOut(auth) -> login
 * 2. Active Exam: examRemainingMs = examEndTime - backgroundTimestamp
 *    allowedBackgroundMs = Math.max(15 * 60 * 1000, examRemainingMs)
 * 3. Exam Expiry: If examEndTime reached in background -> auto-submit persisted answers first.
 *    Do not log out before submission. After submission, timeout rules proceed.
 * 4. Wall-clock elapsed time: Date.now() - backgroundTimestamp. No setInterval measuring background.
 * 5. Capacitor App.addListener('appStateChange') as primary Android lifecycle mechanism,
 *    supplemented by visibilitychange and guarded against duplicate events.
 * 6. Preserves Remember Me keys (orjon_saved_login_id, orjon_saved_login_pass, orjon_remember_me).
 */
export function useBackgroundSessionTimeout({
  isAuthenticated,
  isAdmin = false,
  user = null,
  onLogout,
  onSaveAttempt,
  onTimeoutNotice,
  onWarningStateChange,
  inactivityTimeoutMinutes
}: UseBackgroundSessionTimeoutOptions) {
  const timeoutMinutes = inactivityTimeoutMinutes || DEFAULT_TIMEOUT_MINUTES;

  // Stable references to prevent unnecessary effect re-executions
  const isAuthenticatedRef = useRef(isAuthenticated);
  const isAdminRef = useRef(isAdmin);
  const userRef = useRef(user);
  const onLogoutRef = useRef(onLogout);
  const onSaveAttemptRef = useRef(onSaveAttempt);
  const onTimeoutNoticeRef = useRef(onTimeoutNotice);
  const onWarningStateChangeRef = useRef(onWarningStateChange);

  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  useEffect(() => {
    isAdminRef.current = isAdmin;
  }, [isAdmin]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    onLogoutRef.current = onLogout;
  }, [onLogout]);

  useEffect(() => {
    onSaveAttemptRef.current = onSaveAttempt;
  }, [onSaveAttempt]);

  useEffect(() => {
    onTimeoutNoticeRef.current = onTimeoutNotice;
  }, [onTimeoutNotice]);

  useEffect(() => {
    onWarningStateChangeRef.current = onWarningStateChange;
  }, [onWarningStateChange]);

  // Guard flags to prevent duplicate resume handling and loops
  const isProcessingResumeRef = useRef<boolean>(false);
  const isLoggingOutRef = useRef<boolean>(false);
  const lastResumeCheckTimestampRef = useRef<number>(0);
  const isBackgroundedRef = useRef<boolean>(false);

  /**
   * Perform real Firebase Auth sign-out and session state clearing without touching Remember Me credentials.
   */
  const performTimeoutLogout = useCallback(async () => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;

    try {
      await signOut(auth);
    } catch (err) {
      console.warn('Firebase signOut notice on session timeout:', err);
    }

    // Clean session storage (DO NOT delete Remember Me credentials: orjon_saved_login_id, orjon_saved_login_pass, orjon_remember_me)
    try {
      localStorage.removeItem('orjon_session_user');
      localStorage.removeItem('medha_session_user');
      localStorage.removeItem('orjon_session_admin');
      localStorage.removeItem('medha_session_admin');
      localStorage.removeItem(BACKGROUND_TIMESTAMP_KEY);
      localStorage.removeItem(LAST_ACTIVITY_KEY);
      sessionStorage.removeItem('orjon_session_user');
      sessionStorage.removeItem('orjon_session_admin');
    } catch (e) {
      console.error('Failed clearing session keys from storage:', e);
    }

    onWarningStateChangeRef.current?.(false);

    const sessionType = isAdminRef.current ? 'এডমিন' : 'ব্যবহারকারী';
    const noticeMsg = `⚠️ সেশন টাইমআউট! ${timeoutMinutes} মিনিট কোনো কার্যক্রম না থাকায় নিরাপত্তার স্বার্থে আপনার ${sessionType} অ্যাকাউন্ট স্বয়ংক্রিয়ভাবে লগআউট করা হয়েছে।`;
    onTimeoutNoticeRef.current?.(noticeMsg);

    try {
      await Promise.resolve(onLogoutRef.current('timeout'));
    } catch (err) {
      console.error('Error invoking onLogout callback:', err);
    } finally {
      isLoggingOutRef.current = false;
    }
  }, [timeoutMinutes]);

  /**
   * Record background entry timestamp under 'orjon_background_timestamp'.
   */
  const handleEnterBackground = useCallback(() => {
    if (!isAuthenticatedRef.current) return;

    // Do not overwrite an existing timestamp if set within the last 2 seconds
    const existing = localStorage.getItem(BACKGROUND_TIMESTAMP_KEY);
    if (existing) {
      const existingTs = parseInt(existing, 10);
      if (!isNaN(existingTs) && Date.now() - existingTs < 2000) {
        return;
      }
    }

    localStorage.setItem(BACKGROUND_TIMESTAMP_KEY, Date.now().toString());
  }, []);

  /**
   * Authoritative resume handler driven by wall-clock time.
   */
  const checkAndHandleResume = useCallback(async (source: string) => {
    if (!isAuthenticatedRef.current) {
      localStorage.removeItem(BACKGROUND_TIMESTAMP_KEY);
      return;
    }

    const now = Date.now();

    // Guard against duplicate simultaneous triggers (appStateChange, visibilitychange, focus)
    if (isProcessingResumeRef.current) {
      return;
    }
    if (now - lastResumeCheckTimestampRef.current < 1500) {
      return;
    }
    lastResumeCheckTimestampRef.current = now;
    isProcessingResumeRef.current = true;

    try {
      const bgTsStr = localStorage.getItem(BACKGROUND_TIMESTAMP_KEY);
      if (!bgTsStr) {
        return;
      }

      const backgroundTimestamp = parseInt(bgTsStr, 10);
      if (isNaN(backgroundTimestamp) || backgroundTimestamp <= 0) {
        localStorage.removeItem(BACKGROUND_TIMESTAMP_KEY);
        return;
      }

      const backgroundDuration = now - backgroundTimestamp;
      if (backgroundDuration < 0) {
        localStorage.removeItem(BACKGROUND_TIMESTAMP_KEY);
        return;
      }

      const session = getActiveExamSession();
      let allowedBackgroundMs = timeoutMinutes * 60 * 1000;
      let isExamExpired = false;

      if (session && typeof session.examEndTime === 'number') {
        const examRemainingMs = session.examEndTime - backgroundTimestamp;
        allowedBackgroundMs = Math.max(timeoutMinutes * 60 * 1000, examRemainingMs);
        if (now >= session.examEndTime) {
          isExamExpired = true;
        }
      }

      // Rule: If the exam expires in the background -> auto-submit persisted answers before logout.
      if (isExamExpired && session) {
        try {
          await autoSubmitExpiredExamSession(session, userRef.current, onSaveAttemptRef.current);
        } catch (err) {
          console.error('Error auto-submitting expired exam on resume:', err);
        }
      }

      // Check if background duration exceeded allowed limit
      if (backgroundDuration >= allowedBackgroundMs) {
        localStorage.removeItem(BACKGROUND_TIMESTAMP_KEY);
        await performTimeoutLogout();
        return;
      }

      // Limit not exceeded: session remains valid
      localStorage.removeItem(BACKGROUND_TIMESTAMP_KEY);
      localStorage.setItem(LAST_ACTIVITY_KEY, now.toString());
    } finally {
      isProcessingResumeRef.current = false;
    }
  }, [timeoutMinutes, performTimeoutLogout]);

  // Startup / initial mount check: process any valid stored background timestamp before continuing
  useEffect(() => {
    if (isAuthenticated) {
      checkAndHandleResume('mount');
    }
  }, [isAuthenticated, checkAndHandleResume]);

  // Lifecycle listeners: Capacitor App state + web visibilitychange & focus
  useEffect(() => {
    let appStateListener: any = null;

    if (Capacitor.isNativePlatform()) {
      CapacitorApp.addListener('appStateChange', (state) => {
        if (state.isActive) {
          isBackgroundedRef.current = false;
          checkAndHandleResume('capacitor:active');
        } else {
          isBackgroundedRef.current = true;
          handleEnterBackground();
        }
      }).then(handle => {
        appStateListener = handle;
      }).catch(() => {});
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        isBackgroundedRef.current = true;
        handleEnterBackground();
      } else if (document.visibilityState === 'visible') {
        isBackgroundedRef.current = false;
        checkAndHandleResume('visibility:visible');
      }
    };

    const handleWindowFocus = () => {
      isBackgroundedRef.current = false;
      checkAndHandleResume('window:focus');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      if (appStateListener && appStateListener.remove) {
        appStateListener.remove();
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [checkAndHandleResume, handleEnterBackground]);

  // Foreground inactivity monitoring (runs only while app is open and in foreground)
  useEffect(() => {
    if (!isAuthenticated) {
      onWarningStateChangeRef.current?.(false);
      return;
    }

    if (!localStorage.getItem(LAST_ACTIVITY_KEY)) {
      localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
    }

    let lastWrite = Date.now();
    const handleUserActivity = () => {
      const now = Date.now();
      if (now - lastWrite > 5000) {
        lastWrite = now;
        localStorage.setItem(LAST_ACTIVITY_KEY, now.toString());
        onWarningStateChangeRef.current?.(false);
      }
    };

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    activityEvents.forEach(evt => window.addEventListener(evt, handleUserActivity, { passive: true }));

    // Gentle foreground interval (checks every 10s exclusively while in foreground)
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'hidden' || isBackgroundedRef.current) {
        return;
      }

      const lastActStr = localStorage.getItem(LAST_ACTIVITY_KEY);
      const lastAct = lastActStr ? parseInt(lastActStr, 10) : lastWrite;
      const now = Date.now();
      const elapsed = now - lastAct;

      const session = getActiveExamSession();
      let allowedIdleMs = timeoutMinutes * 60 * 1000;
      let isExamExpired = false;

      if (session && typeof session.examEndTime === 'number') {
        const examRemainingMs = session.examEndTime - lastAct;
        allowedIdleMs = Math.max(timeoutMinutes * 60 * 1000, examRemainingMs);
        if (now >= session.examEndTime) {
          isExamExpired = true;
        }
      }

      if (isExamExpired && session) {
        autoSubmitExpiredExamSession(session, userRef.current, onSaveAttemptRef.current);
      }

      const warningMs = Math.max(0, allowedIdleMs - 60000);

      if (elapsed >= allowedIdleMs) {
        performTimeoutLogout();
      } else if (elapsed >= warningMs) {
        onWarningStateChangeRef.current?.(true);
      } else {
        onWarningStateChangeRef.current?.(false);
      }
    }, 10000);

    return () => {
      activityEvents.forEach(evt => window.removeEventListener(evt, handleUserActivity));
      clearInterval(intervalId);
    };
  }, [isAuthenticated, timeoutMinutes, performTimeoutLogout]);
}
