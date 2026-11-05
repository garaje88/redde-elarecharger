// Deletes AI uploads (technical sheets, charging photos) older than 24 h (docs/PLAN.md,
// Funcionalidades de IA). The app deletes each file right after reading it; this catches
// uploads that were never read. Runs hourly from .github/workflows/ai-uploads-purge.yml.
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");

const BUCKET = "ai-uploads";
const cutoff = Date.now() - 24 * 60 * 60 * 1000;
const storage = createClient(url, key, { auth: { persistSession: false } }).storage.from(BUCKET);

// One folder per user: list the folders, then each folder's files.
const { data: folders, error } = await storage.list("", { limit: 1000 });
if (error) throw error;
let removed = 0;
for (const folder of folders) {
  const { data: files, error: listError } = await storage.list(folder.name, { limit: 1000 });
  if (listError) throw listError;
  const old = files
    .filter((file) => file.created_at && new Date(file.created_at).getTime() < cutoff)
    .map((file) => `${folder.name}/${file.name}`);
  if (old.length > 0) {
    const { error: removeError } = await storage.remove(old);
    if (removeError) throw removeError;
    removed += old.length;
  }
}
console.log(`Removed ${removed} AI uploads older than 24 h.`);
