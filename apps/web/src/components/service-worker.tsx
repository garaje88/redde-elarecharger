"use client";

import { useEffect } from "react";

/** Registers /sw.js in production builds (installable PWA, offline page). */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error: unknown) => {
      console.warn("Service worker registration failed", error);
    });
  }, []);
  return null;
}
