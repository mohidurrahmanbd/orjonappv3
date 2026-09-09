import { useState, useEffect } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

/**
 * Verify if the authenticated Firebase user is an authorized admin in Firestore `admins` collection.
 * Maintains public API signature for backward compatibility.
 */
export async function verifyAdminClaim(user: FirebaseUser | null = auth.currentUser): Promise<boolean> {
  if (!user || !user.email) return false;
  try {
    const normalizedEmail = user.email.trim().toLowerCase();
    if (!normalizedEmail) return false;

    // Direct Firestore authorization lookup in `admins/{normalized_email}`
    const adminDocRef = doc(db, 'admins', normalizedEmail);
    const adminDocSnap = await getDoc(adminDocRef);

    if (adminDocSnap.exists()) {
      const data = adminDocSnap.data();
      if (data && data.role === 'admin') {
        return true;
      }
    }

    return false;
  } catch (err) {
    console.error('Error verifying admin authorization in Firestore:', err);
    return false;
  }
}

/**
 * Hook to manage and observe Admin custom claim authentication state
 */
export function useAdminAuth() {
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [adminUser, setAdminUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const hasAdminClaim = await verifyAdminClaim(user);
          if (hasAdminClaim) {
            setIsAdmin(true);
            setAdminUser(user);
          } else {
            setIsAdmin(false);
            setAdminUser(null);
          }
        } catch {
          setIsAdmin(false);
          setAdminUser(null);
        }
      } else {
        setIsAdmin(false);
        setAdminUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logoutAdmin = async () => {
    await signOut(auth);
    setIsAdmin(false);
    setAdminUser(null);
  };

  return {
    isAdmin,
    adminUser,
    loading,
    verifyAdminClaim,
    logoutAdmin
  };
}
