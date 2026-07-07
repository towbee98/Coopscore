import { useCallback, useEffect, useRef, useState } from "react";

// 3s refetch interval — see coopscore-architecture-v1.md's "<5s webhook →
// dashboard" success metric, satisfied via polling instead of WebSockets/SSE.
const POLL_INTERVAL_MS = 3000;

interface PollingState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
  refetch: () => void;
}

export function usePolling<T>(fetcher: () => Promise<T>, deps: unknown[] = []): PollingState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(() => {
    fetcherRef
      .current()
      .then((result) => {
        setData(result);
        setError(null);
      })
      .catch((err: Error) => setError(err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setLoading(true);
    run();
    const interval = setInterval(run, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, ...deps]);

  return { data, error, loading, refetch: run };
}
