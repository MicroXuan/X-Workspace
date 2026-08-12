const fs = require("node:fs");
const path = require("node:path");
const { createClient } = require("@supabase/supabase-js");

const rootDir = path.join(__dirname, "..");
loadEnvFile(path.join(rootDir, ".env"));

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY.");
  console.error("Create .env from .env.example, then fill in your Supabase values.");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

async function check() {
  const { data, error } = await supabase
    .from("workspace_state")
    .select("id, data, updated_at")
    .eq("id", "main")
    .maybeSingle();

  if (error) {
    console.error("Supabase connection failed:");
    console.error(error.message);
    process.exit(1);
  }

  if (!data) {
    console.error("Connected to Supabase, but workspace_state/main does not exist.");
    console.error("Run supabase-schema.sql in Supabase SQL Editor.");
    process.exit(1);
  }

  console.log("Supabase connection OK.");
  console.log(`Row: ${data.id}`);
  console.log(`Updated: ${data.updated_at || "not set"}`);
}

function loadEnvFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match) continue;

      const [, envKey, rawValue] = match;
      if (process.env[envKey]) continue;

      process.env[envKey] = rawValue.replace(/^["']|["']$/g, "");
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

check();
