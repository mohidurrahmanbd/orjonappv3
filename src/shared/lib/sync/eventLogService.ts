import {
  doc,
  runTransaction,
  collection,
  query,
  where,
  getDocs,
  orderBy
} from 'firebase/firestore';
import { db } from '../firebase';
import { GlobalSyncVersions } from '../../types';
import { isDeleteLogOnlyWritesActive } from './deleteLogWriteActivationService';

export const VERSIONED_COLLECTIONS = [
  'questions',
  'categories',
  'subcategories',
  'courses',
  'live_exams',
  'routines',
  'coupons'
] as const;

export type VersionedCollectionName = typeof VERSIONED_COLLECTIONS[number];

export function getEntityTypeForCollection(col: string): string {
  switch (col) {
    case 'questions': return 'question';
    case 'categories': return 'category';
    case 'subcategories': return 'subcategory';
    case 'courses': return 'course';
    case 'live_exams': return 'live_exam';
    case 'routines': return 'routine';
    case 'coupons': return 'coupon';
    default: return col.replace(/s$/, '');
  }
}

export interface DeleteLogValidationResult {
  valid: boolean;
  error?: string;
  missingFields?: string[];
}

/**
 * Validates that every deletion recorded through delete_log contains all mandatory fields:
 * - globalVersion (positive integer)
 * - entityId (non-empty string)
 * - collection (non-empty string)
 * - entityVersion (positive integer)
 * - deletedAt (valid ISO date string)
 * - action === 'delete'
 */
export function validateDeleteLogEvent(event: any): DeleteLogValidationResult {
  if (!event || typeof event !== 'object') {
    return { valid: false, error: 'Event must be a non-null object' };
  }

  const missingFields: string[] = [];

  if (
    typeof event.globalVersion !== 'number' ||
    !Number.isInteger(event.globalVersion) ||
    event.globalVersion <= 0
  ) {
    missingFields.push('globalVersion (must be positive integer)');
  }

  if (typeof event.entityId !== 'string' || event.entityId.trim().length === 0) {
    missingFields.push('entityId (must be non-empty string)');
  }

  if (typeof event.collection !== 'string' || event.collection.trim().length === 0) {
    missingFields.push('collection (must be non-empty string)');
  }

  if (
    typeof event.entityVersion !== 'number' ||
    !Number.isInteger(event.entityVersion) ||
    event.entityVersion <= 0
  ) {
    missingFields.push('entityVersion (must be positive integer)');
  }

  if (typeof event.deletedAt !== 'string' || event.deletedAt.trim().length === 0) {
    missingFields.push('deletedAt (must be non-empty date string)');
  } else {
    const parsedDate = Date.parse(event.deletedAt);
    if (isNaN(parsedDate)) {
      missingFields.push('deletedAt (must be valid date string)');
    }
  }

  if (event.action !== 'delete') {
    missingFields.push('action (must be "delete")');
  }

  if (missingFields.length > 0) {
    return {
      valid: false,
      error: `Invalid delete_log event: missing or invalid [${missingFields.join(', ')}]`,
      missingFields
    };
  }

  return { valid: true };
}

export interface ChangeLogEvent<T = any> {
  globalVersion: number;
  entity: string;
  collection: string;
  entityId: string;
  action: 'create' | 'update';
  entityVersion: number;
  data: T;
  createdAt: string;
}

export interface DeleteLogEvent {
  globalVersion: number;
  entity: string;
  collection: string;
  entityId: string;
  action: 'delete';
  entityVersion: number;
  deletedAt: string;
  source?: 'standard' | 'legacy_backfill';
}

export type VersionKey =
  | 'questionVersion'
  | 'categoryVersion'
  | 'subcategoryVersion'
  | 'courseVersion'
  | 'examVersion'
  | 'routineVersion'
  | 'couponVersion'
  | 'paymentSettingsVersion';

export interface AtomicMutationOptions<T = any> {
  collectionName: string;
  entityType: string;
  entityId: string;
  action: 'create' | 'update' | 'delete';
  versionKey: VersionKey;
  data?: T;
}

export interface AtomicMutationResult {
  success: boolean;
  entityVersion: number;
  globalVersion: number;
}

/**
 * Executes an atomic mutation across:
 * 1. Primary entity document (create/update or soft-delete tombstone)
 * 2. Dedicated event log (`change_log` or `delete_log`)
 * 3. Central version registry (`meta/versions`) updating both per-collection version and globalVersion.
 *
 * Guarantees zero missing events, zero duplicate globalVersion numbers, and full atomicity.
 */
export async function commitAtomicMutationWithEventLog<T = any>(
  options: AtomicMutationOptions<T>
): Promise<AtomicMutationResult> {
  const { collectionName, entityType, entityId, action, versionKey, data } = options;
  const nowIso = new Date().toISOString();
  const versionDocRef = doc(db, 'meta', 'versions');
  const entityDocRef = doc(db, collectionName, String(entityId));

  try {
    const result = await runTransaction(db, async (transaction) => {
      // 1. Read phase: get current version state
      const versionSnap = await transaction.get(versionDocRef);
      const vData = versionSnap.exists() ? (versionSnap.data() as Partial<GlobalSyncVersions>) : {};

      const currentEntityVersion = Number(vData[versionKey] || 1);
      const nextEntityVersion = currentEntityVersion + 1;

      const currentGlobalVersion = Number(vData.globalVersion || 0);
      const nextGlobalVersion = currentGlobalVersion + 1;

      // 2. Write phase: entity + event log
      if (action === 'delete') {
        const isDeleteLogOnly = isDeleteLogOnlyWritesActive();

        if (!isDeleteLogOnly) {
          // Dual-write compatibility: Keep soft-delete tombstone in primary collection
          transaction.set(
            entityDocRef,
            {
              isDeleted: true,
              deletedAt: nowIso,
              updatedAt: nowIso,
              version: nextEntityVersion
            },
            { merge: true }
          );
        }

        // Record in delete_log
        const deleteLogRef = doc(db, 'delete_log', String(nextGlobalVersion));
        const deleteEvent: DeleteLogEvent = {
          globalVersion: nextGlobalVersion,
          entity: entityType,
          collection: collectionName,
          entityId: String(entityId),
          action: 'delete',
          entityVersion: nextEntityVersion,
          deletedAt: nowIso
        };

        // Validate delete log event before writing
        const validation = validateDeleteLogEvent(deleteEvent);
        if (!validation.valid) {
          throw new Error(`[EventLog] Rejected invalid delete event: ${validation.error}`);
        }

        transaction.set(deleteLogRef, deleteEvent);
      } else {
        // Create / Update
        const cleanPayload = JSON.parse(
          JSON.stringify({
            ...(data || {}),
            id: String(entityId),
            version: nextEntityVersion,
            updatedAt: (data as any)?.updatedAt || nowIso,
            isDeleted: false,
            deletedAt: null
          })
        );

        transaction.set(entityDocRef, cleanPayload, { merge: true });

        // Record in change_log (Option B: full snapshot data attached for zero secondary reads)
        const changeLogRef = doc(db, 'change_log', String(nextGlobalVersion));
        const changeEvent: ChangeLogEvent = {
          globalVersion: nextGlobalVersion,
          entity: entityType,
          collection: collectionName,
          entityId: String(entityId),
          action,
          entityVersion: nextEntityVersion,
          data: cleanPayload,
          createdAt: nowIso
        };
        transaction.set(changeLogRef, changeEvent);
      }

      // 3. Update meta/versions atomically
      transaction.set(
        versionDocRef,
        {
          [versionKey]: nextEntityVersion,
          globalVersion: nextGlobalVersion,
          updatedAt: nowIso
        },
        { merge: true }
      );

      return {
        success: true,
        entityVersion: nextEntityVersion,
        globalVersion: nextGlobalVersion
      };
    });

    return result;
  } catch (err) {
    console.error(`[EventLog] Error executing atomic mutation for ${entityType} ${entityId}:`, err);
    throw err;
  }
}

/**
 * Atomically records bulk deletions with dedicated delete_log events and globalVersion increments.
 * Chunks in batches of up to 150 items to stay safely within Firestore's 500-write transaction limit.
 */
export async function commitAtomicBulkDeleteWithEventLog(
  collectionName: string,
  entityType: string,
  versionKey: VersionKey,
  entityIds: string[]
): Promise<{ success: boolean; entityVersion: number; globalVersion: number }> {
  if (!entityIds || entityIds.length === 0) {
    return { success: true, entityVersion: 1, globalVersion: 0 };
  }

  const nowIso = new Date().toISOString();
  const versionDocRef = doc(db, 'meta', 'versions');

  const chunkSize = 150;
  let finalEntityVersion = 1;
  let finalGlobalVersion = 0;

  for (let i = 0; i < entityIds.length; i += chunkSize) {
    const chunk = entityIds.slice(i, i + chunkSize);

    const chunkResult = await runTransaction(db, async (transaction) => {
      const versionSnap = await transaction.get(versionDocRef);
      const vData = versionSnap.exists() ? (versionSnap.data() as Partial<GlobalSyncVersions>) : {};

      const currentEntityVersion = Number(vData[versionKey] || 1);
      const nextEntityVersion = currentEntityVersion + 1;

      const currentGlobalVersion = Number(vData.globalVersion || 0);

      const isDeleteLogOnly = isDeleteLogOnlyWritesActive();

      chunk.forEach((id, idx) => {
        const itemGlobalVersion = currentGlobalVersion + idx + 1;
        const itemRef = doc(db, collectionName, String(id));

        if (!isDeleteLogOnly) {
          transaction.set(
            itemRef,
            {
              isDeleted: true,
              deletedAt: nowIso,
              updatedAt: nowIso,
              version: nextEntityVersion
            },
            { merge: true }
          );
        }

        const deleteLogRef = doc(db, 'delete_log', String(itemGlobalVersion));
        const deleteEvent: DeleteLogEvent = {
          globalVersion: itemGlobalVersion,
          entity: entityType,
          collection: collectionName,
          entityId: String(id),
          action: 'delete',
          entityVersion: nextEntityVersion,
          deletedAt: nowIso
        };

        const validation = validateDeleteLogEvent(deleteEvent);
        if (!validation.valid) {
          throw new Error(`[EventLog] Rejected invalid bulk delete event: ${validation.error}`);
        }

        transaction.set(deleteLogRef, deleteEvent);
      });

      const nextGlobalVersion = currentGlobalVersion + chunk.length;
      transaction.set(
        versionDocRef,
        {
          [versionKey]: nextEntityVersion,
          globalVersion: nextGlobalVersion,
          updatedAt: nowIso
        },
        { merge: true }
      );

      return { entityVersion: nextEntityVersion, globalVersion: nextGlobalVersion };
    });

    finalEntityVersion = chunkResult.entityVersion;
    finalGlobalVersion = chunkResult.globalVersion;
  }

  return {
    success: true,
    entityVersion: finalEntityVersion,
    globalVersion: finalGlobalVersion
  };
}

/**
 * Fetch change log events strictly greater than a given global version.
 */
export async function getChangeLogEventsSince(sinceGlobalVersion: number): Promise<ChangeLogEvent[]> {
  try {
    const q = query(
      collection(db, 'change_log'),
      where('globalVersion', '>', sinceGlobalVersion),
      orderBy('globalVersion', 'asc')
    );
    const snap = await getDocs(q);
    const events: ChangeLogEvent[] = [];
    snap.forEach((d) => events.push(d.data() as ChangeLogEvent));
    return events;
  } catch (err) {
    console.error('[EventLog] Error querying change_log:', err);
    return [];
  }
}

/**
 * Fetch delete log events strictly greater than a given global version.
 */
export async function getDeleteLogEventsSince(sinceGlobalVersion: number): Promise<DeleteLogEvent[]> {
  try {
    const q = query(
      collection(db, 'delete_log'),
      where('globalVersion', '>', sinceGlobalVersion),
      orderBy('globalVersion', 'asc')
    );
    const snap = await getDocs(q);
    const events: DeleteLogEvent[] = [];
    snap.forEach((d) => events.push(d.data() as DeleteLogEvent));
    return events;
  } catch (err) {
    console.error('[EventLog] Error querying delete_log:', err);
    return [];
  }
}
