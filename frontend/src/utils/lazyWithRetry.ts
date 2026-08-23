import React from 'react';

/**
 * Wraps React.lazy with automatic reload & retry logic.
 * When a new deployment occurs and old chunk hashes are replaced on the server,
 * dynamic imports fail with MIME type / chunk loading errors.
 * This helper catches that failure, forces a page reload once to get the fresh index.html,
 * and seamlessly loads the new version without showing a crash screen to the user.
 */
export function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  chunkName?: string
): React.LazyExoticComponent<T> {
  return React.lazy(async () => {
    const storageKey = `retry_chunk_${chunkName || 'page'}`;
    const hasReloaded = sessionStorage.getItem(storageKey) === 'true';

    try {
      const module = await factory();
      // Reset flag on successful load
      if (hasReloaded) {
        sessionStorage.removeItem(storageKey);
      }
      return module;
    } catch (error: any) {
      console.warn(`[LazyRetry] Failed to load chunk "${chunkName || 'unknown'}":`, error);

      const isChunkError =
        error?.name === 'ChunkLoadError' ||
        error?.message?.includes('Failed to fetch dynamically imported module') ||
        error?.message?.includes('Importing a module script failed') ||
        error?.message?.includes('text/html') ||
        error?.message?.includes('dynamically imported module');

      if (isChunkError && !hasReloaded) {
        console.warn(`[LazyRetry] Reloading page to fetch updated application bundle...`);
        sessionStorage.setItem(storageKey, 'true');
        window.location.reload();
        // Return an unresolved promise to prevent rendering crash while reloading
        return new Promise<{ default: T }>(() => {});
      }

      // If already reloaded and still failed, clear flag and throw
      sessionStorage.removeItem(storageKey);
      throw error;
    }
  });
}
