/**
 * Pure calculation engine for Elacharger (trip energy and charging time, docs/PLAN.md F1/F2).
 * This package must never depend on React, Next.js, the DOM or the network.
 */

/** Stored with every calculation so historical results can be explained. */
export const ENGINE_VERSION = "1.0.0";

export * from "./charging";
export * from "./constants";
export * from "./consumption";
export * from "./curves";
export * from "./route";
export * from "./errors";
export * from "./trip";
