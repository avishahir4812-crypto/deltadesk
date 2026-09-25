"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Poll a JSON endpoint. Revalidates on interval + window focus. */
export function usePolling<T>(url: string | null, intervalMs = 15000) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<number>(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!url) return;
    if (!silent) setLoading(true);
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as T;
      setData(json);
      setError(null);
      setUpdatedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    setData(null);
    setLoading(true);
    void load();
    if (intervalMs > 0) timer.current = setInterval(() => void load(true), intervalMs);
    const onFocus = () => void load(true);
    window.addEventListener("focus", onFocus);
    return () => {
      if (timer.current) clearInterval(timer.current);
      window.removeEventListener("focus", onFocus);
    };
  }, [load, intervalMs]);

  return { data, error, loading, updatedAt, refresh: () => void load(true) };
}

/** Ticking clock (1s). */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** ResizeObserver-based element size, for precise responsive SVG charts. */
export function useSize<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/* --------------------------- palette store --------------------------- */

type Listener = () => void;
let paletteOpen = false;
const listeners = new Set<Listener>();

export function setPaletteOpen(open: boolean) {
  paletteOpen = open;
  listeners.forEach((l) => l());
}

export function usePaletteOpen(): boolean {
  const [open, setOpen] = useState(paletteOpen);
  useEffect(() => {
    const l: Listener = () => setOpen(paletteOpen);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  return open;
}
