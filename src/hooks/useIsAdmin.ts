import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { checkIsAdmin } from '../lib/taxonomyInspector';

const cache = new Map<string, Promise<boolean>>();

/** Whether the signed-in user has the admin role (null while loading). */
export function useIsAdmin(): boolean | null {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    let cancelled = false;
    if (!cache.has(user.id)) cache.set(user.id, checkIsAdmin());
    cache.get(user.id)!.then((v) => !cancelled && setIsAdmin(v));
    return () => {
      cancelled = true;
    };
  }, [user]);

  return isAdmin;
}
