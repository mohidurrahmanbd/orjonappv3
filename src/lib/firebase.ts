import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, getFirestore, doc, getDocFromServer } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const defaultFirebaseConfig = {
  apiKey: "AIzaSyDXwoEuyzm8FG0vG9VfpgfkBEbT4whs3Mg",
  authDomain: "orjonapp.firebaseapp.com",
  projectId: "orjonapp",
  storageBucket: "orjonapp.firebasestorage.app",
  messagingSenderId: "771910205621",
  appId: "1:771910205621:web:0e9a7e164466d1fbda7efc"
};

// Check for auto-provisioned firebase-applet-config.json if available
let activeConfig: any = defaultFirebaseConfig;
const configModules = (import.meta as any).glob('/firebase-applet-config.json', { eager: true });
if (configModules && configModules['/firebase-applet-config.json']) {
  const mod: any = configModules['/firebase-applet-config.json'];
  activeConfig = mod.default || mod;
}

export const firebaseConfig = activeConfig;

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Initialize Firestore (handling custom databaseId if configured in firebase-applet-config.json)
let firestoreInstance: any;
try {
  if (firebaseConfig.firestoreDatabaseId) {
    firestoreInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  } else {
    firestoreInstance = initializeFirestore(app, {
      experimentalForceLongPolling: true,
    });
  }
} catch {
  firestoreInstance = getFirestore(app);
}

export const db = firestoreInstance;
export const storage = getStorage(app);

// Connection check helper
export async function testFirebaseConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firebase Firestore connected successfully.");
    return true;
  } catch (error: any) {
    if (error instanceof Error && error.message.includes('offline')) {
      console.warn("Please check your Firebase configuration or internet connection.");
    } else {
      console.warn("Firebase connection test notice:", error?.message || error);
    }
    return false;
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
