"use client";

import { Component, type ReactNode } from "react";

/** Keeps the rest of the screen usable when a widget (e.g. the WebGL map) fails. */
export class ErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
