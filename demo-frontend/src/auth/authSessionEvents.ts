export const AUTH_SESSION_CHANGED_EVENT = 'auth-session-changed';

export function notifyAuthSessionChanged() {
  window.dispatchEvent(new Event(AUTH_SESSION_CHANGED_EVENT));
}
