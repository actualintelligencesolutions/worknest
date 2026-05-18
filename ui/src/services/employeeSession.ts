import type { AuthSession } from './worknestApi';

const EMPLOYEE_SESSION_STORAGE_KEY = 'worknest.employeeSession';
export const EMPLOYEE_SESSION_CHANGE_EVENT = 'worknest.employeeSession.change';

export function loadEmployeeSession(): AuthSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const storedSession = window.localStorage.getItem(EMPLOYEE_SESSION_STORAGE_KEY);
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

export function saveEmployeeSession(session: AuthSession) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(EMPLOYEE_SESSION_STORAGE_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event(EMPLOYEE_SESSION_CHANGE_EVENT));
}

export function clearEmployeeSession() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(EMPLOYEE_SESSION_STORAGE_KEY);
  window.dispatchEvent(new Event(EMPLOYEE_SESSION_CHANGE_EVENT));
}
