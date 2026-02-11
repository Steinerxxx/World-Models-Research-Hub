export const API_BASE_URL = import.meta.env.VITE_API_URL || (
  window.location.port === '5173' || window.location.port === '5174'
    ? 'http://localhost:3001'
    : ''
);
