import { useEffect } from 'react'

/**
 * Calls `onFocus` whenever the tab/window regains focus or becomes visible again.
 * Lets data fetched on mount stay fresh when the user returns to a page — e.g. a
 * dashboard card reloads after the user logs an activity elsewhere and comes back.
 *
 * Pass a stable callback (wrap it in useCallback) so listeners aren't rebound on
 * every render.
 */
export function useRefreshOnFocus(onFocus: () => void) {
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') onFocus()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [onFocus])
}
