import { useState, useEffect } from 'react';
import { User as FirebaseUser, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';

/**
 * Force refresh token and verify if current user has the custom claim `admin: true`
 */
export async function verifyAdminClaim(user: FirebaseUser | null = auth.currentUser): Promise<boolean> {
  if (!user) return false;
  try {
    // 1. Force refresh token to ensure newest custom claims are evaluated
    const tokenResult = await user.getIdTokenResult(true);
    if (tokenResult.claims.admin === true) {
      return true;
    }

    // 2. If claim not yet set on token, call backend /api/admin/set-admin-claims
    const idToken = await user.getIdToken();
    const res = await fetch('/api/admin/set-admin-claims', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.admin === true) {
        const refreshedToken = await user.getIdTokenResult(true);
        return refreshedToken.claims.admin === true || data.admin === true;
      }
    }
    return false;
  } catch (err) {
    console.error('Error verifying admin custom claims:', err);
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
