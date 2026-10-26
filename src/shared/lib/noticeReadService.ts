import { Notice, User } from '../types';
import { getCleanUserKey } from './favoriteService';

export { getCleanUserKey };

/**
 * Storage schema version for device-local notice read tracking.
 * Forward-compatible with Phase 2 server-backed synchronization.
 */
export const NOTICE_READ_STORAGE_SCHEMA_VERSION = 1;

/**
 * LocalStorage key prefix for user-isolated read state.
 * Prevents account state leaking between different users on the same device.
 */
export const NOTICE_READ_STORAGE_KEY_PREFIX = 'orjon_notice_reads_v1_';

/**
 * Global DOM CustomEvent fired on the window when notice read status changes.
 */
export const NOTICE_READ_EVENT_NAME = 'orjon_notice_reads_updated';

/**
 * Persisted storage payload structure for notice read state.
 */
export interface NoticeReadPayload {
  version: number;
  updatedAt: number;
  readNoticeIds: Record<string, number>; // noticeId -> read timestamp in ms
}

/**
 * In-memory fallback cache when window.localStorage is unavailable.
 * Keyed strictly by sanitized user key.
 */
const inMemoryFallbackCache: Record<string, Record<string, number>> = {};

/**
 * Validates whether the user key represents a genuine authenticated user.
 * A missing or invalid user identity must not write data to a shared anonymous key.
 */
export const isValidUserKey = (userKey?: string | null): boolean => {
  if (!userKey) return false;
  const sanitized = String(userKey).trim().toLowerCase();
  return sanitized !== '' && sanitized !== 'guest' && sanitized !== 'anonymous' && sanitized !== 'null' && sanitized !== 'undefined';
};

/**
 * Computes the unique localStorage key for a given user identifier.
 */
export const getNoticeReadStorageKey = (userKey?: string | null): string => {
  const sanitized = String(userKey || 'guest').trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'guest';
  return `${NOTICE_READ_STORAGE_KEY_PREFIX}${sanitized}`;
};

/**
 * Determines whether a notice is active and eligible for read/unread evaluation.
 * Deleted or otherwise ineligible notices must not count as unread.
 */
export const isNoticeEligible = (notice?: Notice | null): boolean => {
  if (!notice || !notice.id) return false;
  if (notice.isDeleted || (notice as any).deletedAt) return false;
  return true;
};

/**
 * Dispatches an immediate reactive event across the window.
 */
const dispatchNoticeReadChangeEvent = () => {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(NOTICE_READ_EVENT_NAME));
  } catch {}
};

/**
 * Reads a user's stored read-notice IDs as a fast Set.
 * Safe against malformed data, quota errors, and missing keys.
 */
export const getReadNoticeIds = (userKey?: string | null): Set<string> => {
  if (!isValidUserKey(userKey)) {
    return new Set<string>();
  }

  const storageKey = getNoticeReadStorageKey(userKey);

  // 1. Try window.localStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          // If in versioned format
          if (parsed.readNoticeIds && typeof parsed.readNoticeIds === 'object') {
            return new Set(Object.keys(parsed.readNoticeIds).filter(Boolean));
          }
          // If raw array format fallback
          if (Array.isArray(parsed)) {
            return new Set(parsed.filter(Boolean));
          }
        }
      }
    } catch (e) {
      console.warn('[NoticeReadService] Error reading localStorage key:', storageKey, e);
    }
  }

  // 2. Check in-memory fallback
  const mem = inMemoryFallbackCache[storageKey];
  if (mem && typeof mem === 'object') {
    return new Set(Object.keys(mem).filter(Boolean));
  }

  return new Set<string>();
};

/**
 * Checks whether an individual notice is marked as read for the specified user.
 */
export const isNoticeRead = (userKey: string | null | undefined, noticeId: string): boolean => {
  if (!noticeId || !isValidUserKey(userKey)) return false;
  const readSet = getReadNoticeIds(userKey);
  return readSet.has(String(noticeId));
};

/**
 * Marks an individual notice as read for the authenticated user.
 * Prevents redundant writes if the notice is already marked as read.
 * Returns true if state was updated and persisted, false otherwise.
 */
export const markNoticeAsRead = (userKey: string | null | undefined, noticeId: string): boolean => {
  const cleanId = String(noticeId || '').trim();
  if (!cleanId || !isValidUserKey(userKey)) {
    return false;
  }

  const storageKey = getNoticeReadStorageKey(userKey);
  const now = Date.now();

  let existingReads: Record<string, number> = {};

  // Read existing mapping
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.readNoticeIds === 'object') {
          existingReads = { ...parsed.readNoticeIds };
        } else if (Array.isArray(parsed)) {
          parsed.forEach((id: any) => {
            if (id) existingReads[String(id)] = now;
          });
        }
      }
    } catch {}
  } else {
    existingReads = { ...(inMemoryFallbackCache[storageKey] || {}) };
  }

  // Idempotency check: Already marked as read? Avoid redundant persistence & event dispatch
  if (existingReads[cleanId]) {
    return false;
  }

  // Add new notice read timestamp
  existingReads[cleanId] = now;

  const payload: NoticeReadPayload = {
    version: NOTICE_READ_STORAGE_SCHEMA_VERSION,
    updatedAt: now,
    readNoticeIds: existingReads
  };

  let writeSucceeded = false;

  // Persist to localStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(payload));
      writeSucceeded = true;
    } catch (writeErr) {
      console.warn('[NoticeReadService] Failed writing to localStorage (fallback active):', writeErr);
      inMemoryFallbackCache[storageKey] = existingReads;
      writeSucceeded = true;
    }
  } else {
    inMemoryFallbackCache[storageKey] = existingReads;
    writeSucceeded = true;
  }

  if (writeSucceeded) {
    dispatchNoticeReadChangeEvent();
  }

  return writeSucceeded;
};

/**
 * Marks multiple notices as read in a single atomic storage write.
 */
export const markAllNoticesAsRead = (userKey: string | null | undefined, noticeIds: string[]): boolean => {
  if (!isValidUserKey(userKey) || !Array.isArray(noticeIds) || noticeIds.length === 0) {
    return false;
  }

  const storageKey = getNoticeReadStorageKey(userKey);
  const now = Date.now();

  let existingReads: Record<string, number> = {};

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.readNoticeIds === 'object') {
          existingReads = { ...parsed.readNoticeIds };
        } else if (Array.isArray(parsed)) {
          parsed.forEach((id: any) => {
            if (id) existingReads[String(id)] = now;
          });
        }
      }
    } catch {}
  } else {
    existingReads = { ...(inMemoryFallbackCache[storageKey] || {}) };
  }

  let hasNew = false;
  noticeIds.forEach(id => {
    const cleanId = String(id || '').trim();
    if (cleanId && !existingReads[cleanId]) {
      existingReads[cleanId] = now;
      hasNew = true;
    }
  });

  if (!hasNew) {
    return false; // Nothing changed
  }

  const payload: NoticeReadPayload = {
    version: NOTICE_READ_STORAGE_SCHEMA_VERSION,
    updatedAt: now,
    readNoticeIds: existingReads
  };

  let writeSucceeded = false;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(payload));
      writeSucceeded = true;
    } catch (err) {
      console.warn('[NoticeReadService] Bulk mark failed writing to localStorage:', err);
      inMemoryFallbackCache[storageKey] = existingReads;
      writeSucceeded = true;
    }
  } else {
    inMemoryFallbackCache[storageKey] = existingReads;
    writeSucceeded = true;
  }

  if (writeSucceeded) {
    dispatchNoticeReadChangeEvent();
  }

  return writeSucceeded;
};

/**
 * Computes the number of unread notices for the specified user.
 * Filters out invalid or deleted notices.
 */
export const getUnreadNoticeCount = (
  userKey: string | null | undefined,
  notices: Notice[] = [],
  currentReadIds?: Set<string>
): number => {
  if (!notices || notices.length === 0) return 0;
  const readSet = currentReadIds || getReadNoticeIds(userKey);
  return notices.filter(n => isNoticeEligible(n) && !readSet.has(String(n.id))).length;
};

/**
 * Subscribes a React component to read state updates across window events and tabs.
 * Returns an unsubscribe cleanup function.
 */
export const subscribeToNoticeReadChanges = (callback: () => void): (() => void) => {
  if (typeof window === 'undefined') return () => {};

  const handleCustomEvent = () => {
    callback();
  };

  const handleStorageEvent = (e: StorageEvent) => {
    if (!e.key || e.key.startsWith(NOTICE_READ_STORAGE_KEY_PREFIX)) {
      callback();
    }
  };

  window.addEventListener(NOTICE_READ_EVENT_NAME, handleCustomEvent);
  window.addEventListener('storage', handleStorageEvent);

  return () => {
    window.removeEventListener(NOTICE_READ_EVENT_NAME, handleCustomEvent);
    window.removeEventListener('storage', handleStorageEvent);
  };
};
