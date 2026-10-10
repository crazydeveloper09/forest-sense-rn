import { getAccessToken } from '../auth/session';

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

function apiBaseUrl(): string {
  const baseUrl = process.env.EXPO_PUBLIC_AI_API_URL?.replace(/\/$/, '');
  if (!baseUrl) {
    throw new ApiError('Brak EXPO_PUBLIC_AI_API_URL. Ustaw adres backendu w .env i uruchom ponownie Expo.', 0, 'API_URL_MISSING');
  }
  return baseUrl;
}

async function requestJson<T>(path: string, method: 'GET' | 'POST', body?: Record<string, unknown>, auth = false): Promise<T> {
  const headers: Record<string, string> = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = getAccessToken();
    if (!token) throw new ApiError('Zaloguj się, aby kontynuować.', 401, 'AUTH_REQUIRED');
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new ApiError('Brak połączenia z serwerem. Sprawdź internet i adres API.', 0, 'NETWORK');
  }

  const payload = (await response.json().catch(() => null)) as (T & { error?: string; code?: string }) | null;
  if (!response.ok) {
    throw new ApiError(payload?.error || 'Nie udało się połączyć z usługą.', response.status, payload?.code);
  }
  if (!payload) throw new ApiError('Serwer zwrócił nieprawidłową odpowiedź.', response.status, 'INVALID_RESPONSE');
  return payload;
}

export function postJson<T>(path: string, body: Record<string, unknown>, auth = false): Promise<T> {
  return requestJson<T>(path, 'POST', body, auth);
}

export function getJson<T>(path: string): Promise<T> {
  return requestJson<T>(path, 'GET', undefined, true);
}
