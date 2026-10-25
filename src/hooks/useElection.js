import { useCallback, useEffect, useRef, useState } from 'react';
import { mergeHistory } from '../lib/forecast.js';

const STORAGE_KEY = 'pulso-react-election-6258-v2';

export function useElection() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastAttempt, setLastAttempt] = useState(null);
  const activeRequest = useRef(null);
  const historyRef = useRef([]);
  const mounted = useRef(false);

  const refresh = useCallback(async () => {
    if (activeRequest.current) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true);
    try {
      const response = await fetch('/api/election', { signal: controller.signal });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'O TSE está indisponível nesta consulta.');
      if (!mounted.current) return;
      const history = mergeHistory(historyRef.current, payload.history || []);
      historyRef.current = history;
      const next = { ...payload, history };
      setData(next);
      setError(payload.stale ? 'Parte dos arquivos não pôde ser atualizada. O horário do retrato exibido está preservado.' : '');
      setLastAttempt(payload.attemptedAt);
      if (!payload.stale) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); }
        catch { /* Storage is optional. */ }
      }
    } catch (failure) {
      if (failure.name !== 'AbortError' && mounted.current) {
        setError(failure.message || 'Não foi possível atualizar. Tente novamente.');
        setLastAttempt(new Date().toISOString());
      }
    } finally {
      if (activeRequest.current === controller) activeRequest.current = null;
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved?.snapshot?.national && Array.isArray(saved.history)) {
        historyRef.current = saved.history;
        setData({ ...saved, stale: true });
      }
    } catch { /* Ignore an invalid local record. */ }
    refresh();
    const interval = setInterval(() => { if (!document.hidden) refresh(); }, 60_000);
    const onVisibility = () => { if (!document.hidden) refresh(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      mounted.current = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      activeRequest.current?.abort();
      activeRequest.current = null;
    };
  }, [refresh]);

  return { data, loading, error, lastAttempt, refresh };
}
