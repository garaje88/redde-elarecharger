"use client";

import { useSyncExternalStore } from "react";

// A shared clock that ticks every minute. The server snapshot is null, so prerendered HTML never
// depends on the time and the client fills it in after hydration.

const listeners = new Set<() => void>();
let current: Date | null = null;
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    timer = setInterval(() => {
      current = new Date();
      for (const notify of listeners) notify();
    }, 60_000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

const getSnapshot = () => (current ??= new Date());
const getServerSnapshot = () => null;

export function useNow(): Date | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
