import { API_BASE } from './config';

export function getLocalUserId(): string {
  if (typeof localStorage === 'undefined') {
    return 'anonymous';
  }
  let id = localStorage.getItem('beats_user_id');
  if (!id) {
    id = (typeof crypto !== 'undefined' && crypto.randomUUID) 
      ? crypto.randomUUID() 
      : `u-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem('beats_user_id', id);
  }
  return id;
}

export function getUserName(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem('beats_user_name');
}

export function setUserName(name: string): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('beats_user_name', name);
  }
  // sync to backend
  fetch(`${API_BASE}/api/user`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: getLocalUserId(),
      name
    })
  }).catch(() => {});
}
