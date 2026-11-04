import type { PostgrestError } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { check, dbError, unwrap } from "./db";
import { ApiError } from "./http";

const pgError = (code: string): PostgrestError =>
  ({ code, message: "boom", details: "", hint: "", name: "PostgrestError" }) as PostgrestError;

describe("dbError", () => {
  it.each([
    ["P0002", 404],
    ["PGRST116", 404],
    ["23505", 409],
    ["23503", 422],
    ["23514", 422],
    ["22P02", 422],
    ["42501", 403],
  ])("maps %s to %d", (code, status) => {
    const error = dbError(pgError(code), "Vehicle");
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(status);
  });

  it("keeps unknown errors as plain errors (a 500 without details)", () => {
    expect(dbError(pgError("XX000"), "Vehicle")).not.toBeInstanceOf(ApiError);
  });
});

describe("unwrap and check", () => {
  it("returns data, 404s on no row and throws on errors", () => {
    expect(unwrap({ data: [1], error: null }, "Rows")).toEqual([1]);
    expect(() => unwrap({ data: null, error: null }, "Vehicle")).toThrow("Vehicle does not exist.");
    expect(() => unwrap({ data: null, error: pgError("23505") }, "Vehicle")).toThrow(ApiError);
    expect(() => check({ error: null }, "Profile")).not.toThrow();
    expect(() => check({ error: pgError("42501") }, "Profile")).toThrow(ApiError);
  });
});
