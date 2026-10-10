import { getJson, postJson } from '../api/http';
import type { SealedPayload } from '../crypto/e2e';

export type MfaChallenge = {
  mfaToken: string;
  purpose: 'enroll' | 'login';
  totpSecret?: string;
  expiresIn: number;
  profileReady: boolean;
};

export type SessionPayload = {
  accessToken: string;
  userId: string;
  kdfSalt: string;
  profile: {
    email: SealedPayload;
    displayName: SealedPayload;
  };
};

export function registerAccount(body: {
  emailLookup: string;
  password: string;
}): Promise<MfaChallenge> {
  return postJson<MfaChallenge>('/auth/register', body);
}

export function sealAccountProfile(body: {
  mfaToken: string;
  kdfSalt: string;
  email: SealedPayload;
  displayName: SealedPayload;
}): Promise<{ ok: boolean }> {
  return postJson<{ ok: boolean }>('/auth/profile', body);
}

export function loginAccount(emailLookup: string, password: string): Promise<MfaChallenge> {
  return postJson<MfaChallenge>('/auth/login', { emailLookup, password });
}

export function verifyMfa(mfaToken: string, code: string): Promise<SessionPayload> {
  return postJson<SessionPayload>('/auth/mfa/verify', { mfaToken, code });
}

export function logoutAccount(): Promise<{ ok: boolean }> {
  return postJson<{ ok: boolean }>('/auth/logout', {}, true);
}

export function fetchSession(): Promise<{ id: string }> {
  return getJson<{ id: string }>('/auth/session');
}
