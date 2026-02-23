import { useEffect } from 'react';

if (typeof document !== 'undefined') {
  document.documentElement.classList.add('dark');
}

export function useDarkMode() {
  useEffect(() => {
    document.documentElement.classList.add('dark');
    localStorage.removeItem('dark-mode');
  }, []);

  return { isDark: true };
}
