export const API_BASE_URL = import.meta.env.VITE_API_URL || (
  window.location.hostname === 'localhost' 
    ? 'http://localhost:3001' 
    : '' // In Zeabur, if frontend and backend are in same project, we can use relative or set via env
);
