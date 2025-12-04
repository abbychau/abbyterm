import { useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

export function useDevtools() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F12 to toggle devtools
      if (e.key === 'F12') {
        e.preventDefault();
        invoke('toggle_devtools').catch(console.error);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
