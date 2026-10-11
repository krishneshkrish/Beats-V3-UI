import { writable } from 'svelte/store';

export interface ToastItem {
  id: string;
  message: string;
  type: 'info' | 'error' | 'success';
}

export const toasts = writable<ToastItem[]>([]);

export function showToast(
  message: string,
  type: 'info' | 'error' | 'success' = 'info',
  duration = 3000
) {
  const id = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `t-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  toasts.update(t => [...t, { id, message, type }]);
  setTimeout(() => {
    toasts.update(t => t.filter(x => x.id !== id));
  }, duration);
}
