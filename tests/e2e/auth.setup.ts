import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { test as setup } from "@playwright/test";
import { createTestSession, secretKey } from "./support/session";

// The shared signed-in user of the garage and api suites. Without a Supabase secret key the
// signed-in suites are skipped.

export const SESSION_FILE = "playwright/.auth/user.json";
export const TOKEN_FILE = "playwright/.auth/token.txt";

setup("sign in a test user", async ({ baseURL }) => {
  mkdirSync(dirname(SESSION_FILE), { recursive: true });
  if (!secretKey) {
    writeFileSync(SESSION_FILE, JSON.stringify({ cookies: [], origins: [] }));
    writeFileSync(TOKEN_FILE, "");
    setup.skip(true, "Set E2E_SUPABASE_SECRET_KEY to run the signed-in suites.");
    return;
  }
  const session = await createTestSession(baseURL);
  writeFileSync(SESSION_FILE, JSON.stringify(session.storageState));
  writeFileSync(TOKEN_FILE, session.accessToken);
});
