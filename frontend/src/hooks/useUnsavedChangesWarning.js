import { useEffect } from 'react'

/**
 * Warns the user before closing/refreshing the tab or navigating away while
 * there are unsaved attendance/marks changes (requirement #13, frontend spec).
 */
export function useUnsavedChangesWarning(hasUnsavedChanges) {
  useEffect(() => {
    if (!hasUnsavedChanges) return

    const handler = (e) => {
      e.preventDefault()
      e.returnValue = ''
      return ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasUnsavedChanges])
}

export function confirmLeaveIfUnsaved(hasUnsavedChanges) {
  if (!hasUnsavedChanges) return true
  return window.confirm('Unsaved attendance/marks changes exist.\nAre you sure you want to leave?')
}
