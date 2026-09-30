import { useEffect } from 'react';

// Consulta periódicamente si el backend tiene cambios de otras pestañas,
// personas o del MCP, y también al volver a la pestaña. No consulta mientras
// la pestaña está oculta.
export function useRemotePolling(syncRef, intervalMs = 5000) {
  useEffect(() => {
    const check = () => {
      if (document.visibilityState === 'hidden') return;
      syncRef.current?.checkRemote();
    };
    const interval = setInterval(check, intervalMs);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, [syncRef, intervalMs]);
}
