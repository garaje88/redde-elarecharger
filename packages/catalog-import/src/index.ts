/**
 * Catalog importers (docs/PLAN.md F3): Open EV Data, EPA and Open Charge Map feed the Supabase
 * catalog, which is the only source the app reads. Parsers are pure; `runner` writes with the
 * service role and must only run on a server or in CI.
 */
export * from "./aliases";
export * from "./csv";
export * from "./merge";
export * from "./sources/epa";
export * from "./sources/ocm";
export * from "./sources/open-ev-data";
export * from "./text";
export * from "./types";
