"use client";
import { useEffect, useRef, useState } from "react";

/** Fetch JSON from `url` now and every `intervalMs`, pausing while the tab is hidden. */
export function usePoll<T>(url: string | null, intervalMs: number) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = useRef(url);
  current.current = url;

  useEffect(() => {
    if (!url) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    setLoading(true);
    setData(null);
    const run = async () => {
      if (document.visibilityState === "visible") {
        try {
          const res = await fetch(url, { cache: "no-store" });
          if (!res.ok) throw new Error(`${res.status}`);
          const json = (await res.json()) as T;
          if (alive && current.current === url) {
            setData(json);
            setError(null);
          }
        } catch (e) {
          if (alive) setError((e as Error).message);
        } finally {
          if (alive) setLoading(false);
        }
      }
      if (alive && intervalMs > 0) timer = setTimeout(run, intervalMs);
    };
    run();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [url, intervalMs]);

  return { data, loading, error };
}
