export const API_BASE =
  import.meta.env.VITE_API_URL ||
  'https://beats-v3-backend.onrender.com';

export const GENRES = [
  { id: 'all', label: 'ALL' },
  { id: 'malayalam', label: 'ML' },
  { id: 'tamil', label: 'TM' },
  { id: 'hindi', label: 'HI' },
  { id: 'english', label: 'EN' },
  { id: 'phonk', label: 'PH' },
  { id: 'mix', label: 'MIX' },
];
