import { lazy, type ComponentType } from 'react';

/**
 * Wraps React.lazy with automatic page-reload recovery when a dynamic import fails.
 * This commonly happens after a new deployment when Vite has generated new chunk hashes
 * and old chunk files (e.g. EventDetailScreen-[hash].js) no longer exist on the server.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  chunkName = 'chunk'
) {
  return lazy(async () => {
    const key = `keg_swap_reload_${chunkName}`;
    const hasReloaded = sessionStorage.getItem(key);

    try {
      const module = await factory();
      sessionStorage.removeItem(key);
      return module;
    } catch (error) {
      if (!hasReloaded) {
        sessionStorage.setItem(key, 'true');
        window.location.reload();
        // Return an unresolved promise while the page reloads,
        // preventing React from throwing an unhandled rejection.
        return new Promise<{ default: T }>(() => {});
      }

      sessionStorage.removeItem(key);
      throw error;
    }
  });
}
