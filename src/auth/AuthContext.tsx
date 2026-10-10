import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError } from '../api/http';
import { decryptUtf8 } from '../crypto/e2e';
import { fetchSession, logoutAccount, type SessionPayload } from './api';
import {
  clearSession,
  getCurrentProfile,
  loadSession,
  persistSession,
  subscribeSession,
  type AccountProfile,
} from './session';

type AuthContextValue = {
  ready: boolean;
  user: AccountProfile | null;
  authVisible: boolean;
  openAuth: () => void;
  closeAuth: () => void;
  signIn: (payload: SessionPayload, dataKey: Uint8Array) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AccountProfile | null>(null);
  const [authVisible, setAuthVisible] = useState(false);

  useEffect(() => {
    let mounted = true;
    loadSession()
      .then(async (profile) => {
        if (!profile) return;
        try {
          await fetchSession();
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) {
            await clearSession();
            return;
          }
        }
        if (mounted) setUser(getCurrentProfile());
      })
      .finally(() => {
        if (mounted) setReady(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => subscribeSession(() => setUser(getCurrentProfile())), []);

  const value = useMemo<AuthContextValue>(() => ({
    ready,
    user,
    authVisible,
    openAuth: () => setAuthVisible(true),
    closeAuth: () => setAuthVisible(false),
    signIn: async (payload, dataKey) => {
      let email = '';
      let displayName = '';
      try {
        email = decryptUtf8(payload.profile.email.ciphertext, payload.profile.email.iv, dataKey);
        displayName = decryptUtf8(payload.profile.displayName.ciphertext, payload.profile.displayName.iv, dataKey);
      } catch {
        throw new Error('Nie udało się odszyfrować profilu. Sprawdź hasło.');
      }
      await persistSession({
        accessToken: payload.accessToken,
        dataKey,
        id: payload.userId,
        email,
        displayName,
      });
      setAuthVisible(false);
    },
    logout: async () => {
      try {
        await logoutAccount();
      } catch {
        // Local logout still removes the device key when the server is unreachable.
      }
      await clearSession();
    },
  }), [authVisible, ready, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('Konto jest dostępne tylko wewnątrz aplikacji.');
  return value;
}
