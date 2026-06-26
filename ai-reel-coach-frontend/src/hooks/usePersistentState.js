import { useState, useEffect } from 'react';

// In-memory cache outside the React component lifecycle.
// This preserves state when navigating between different React pages (SPA routing),
// but completely clears out when the user performs a hard refresh on the browser.
const memoryCache = new Map();

export function usePersistentState(key, initialValue) {
  const [state, setState] = useState(() => {
    try {
      if (memoryCache.has(key)) {
        return memoryCache.get(key);
      }
    } catch (e) {
      console.error('Error reading memoryCache for', key, e);
    }
    return typeof initialValue === 'function' ? initialValue() : initialValue;
  });

  useEffect(() => {
    try {
      if (state === null || state === undefined) {
        memoryCache.delete(key);
      } else {
        memoryCache.set(key, state);
      }
    } catch (e) {
      console.error('Error writing memoryCache for', key, e);
    }
  }, [key, state]);

  return [state, setState];
}
