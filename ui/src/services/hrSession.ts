import type { AuthSession } from './worknestApi';

const HR_SESSION_STORAGE_KEY = 'worknest.hrSession';

export function loadHrSession(): AuthSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const storedSession = window.localStorage.getItem(HR_SESSION_STORAGE_KEY);
  if (!storedSession) {
    return null;
  }

  try {
    const session = JSON.parse(storedSession) as AuthSession;
    if (!session.token || !session.tenantId) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

export function saveHrSession(session: AuthSession) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(HR_SESSION_STORAGE_KEY, JSON.stringify(session));
}
