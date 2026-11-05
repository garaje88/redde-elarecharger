"use client";

import { useSyncExternalStore } from "react";

// True once the page has loaded and the main thread is idle: heavy widgets (the map) mount then,
// so they never compete with the first paint and the first interactions.

let idle = false;
const listeners = new Set<() => void>();
let scheduled = false;

function schedule() {
  if (scheduled) return;
  scheduled = true;
  const done = () => {
    idle = true;
    for (const notify of listeners) notify();
  };
  const whenIdle = () =>
    "requestIdleCallback" in window
      ? window.requestIdleCallback(done, { timeout: 2500 })
      : setTimeout(done, 1200);
  if (document.readyState === "complete") whenIdle();
  else window.addEventListener("load", whenIdle, { once: true });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  schedule();
  return () => listeners.delete(listener);
}

export function useIdle(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => idle,
    () => false,
  );
}
