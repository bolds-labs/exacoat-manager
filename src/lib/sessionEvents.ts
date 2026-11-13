/** Fired on window when WordPress rejects the staff session token (HTTP 401). AuthContext signs the user out. */
export const SESSION_EXPIRED_EVENT = 'exacoat:session-expired';

export function notifySessionExpired(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }
}
