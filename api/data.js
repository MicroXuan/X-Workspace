const fs = require("node:fs/promises");
const path = require("node:path");
const { createClient } = require("@supabase/supabase-js");

const STATE_ID = "main";
const FALLBACK_DATA_FILE = path.join(process.cwd(), "data", "workbench-data.json");

module.exports = async function handler(request, response) {
  try {
    if (request.method === "GET") {
      const data = await readPersistentData();
      sendJson(response, 200, data);
      return;
    }

    if (request.method === "PUT") {
      const payload = await readJsonBody(request);
      if (!isPortableData(payload)) {
        sendJson(response, 400, { error: "Invalid data shape" });
        return;
      }

      const supabase = getSupabaseClient();
      if (!supabase) {
        sendJson(response, 501, {
          error: "Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY."
        });
        return;
      }

      const { error } = await supabase
        .from("workspace_state")
        .upsert({
          id: STATE_ID,
          data: payload.data,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      sendJson(response, 200, { ok: true });
      return;
    }

    sendJson(response, 405, { error: "Method not allowed" });
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: "Internal server error" });
  }
};

async function readPersistentData() {
  const supabase = getSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("workspace_state")
      .select("data")
      .eq("id", STATE_ID)
      .maybeSingle();

    if (error) throw error;
    if (data && data.data) return createPortableData(data.data);
  }

  const fallback = await fs.readFile(FALLBACK_DATA_FILE, "utf8");
  return JSON.parse(fallback);
}

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;

  if (!url || !key) return null;
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

function readJsonBody(request) {
  if (request.body && typeof request.body === "object" && !request.readable) {
    return Promise.resolve(request.body);
  }

  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) {
        reject(new Error("Body too large"));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function createPortableData(data) {
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    app: "Personal Workbench",
    data: {
      theme: data.theme === "dark" ? "dark" : "light",
      view: typeof data.view === "string" ? data.view : "today",
      today: Array.isArray(data.today) ? data.today : [],
      week: Array.isArray(data.week) ? data.week : [],
      weekHistory: Array.isArray(data.weekHistory) ? data.weekHistory : [],
      links: Array.isArray(data.links) ? data.links : [],
      ideas: Array.isArray(data.ideas) ? data.ideas : []
    }
  };
}

function isPortableData(value) {
  const data = value && value.data;
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof value.schemaVersion === "number" &&
      data &&
      typeof data === "object" &&
      Array.isArray(data.today) &&
      Array.isArray(data.week) &&
      Array.isArray(data.weekHistory) &&
      Array.isArray(data.links) &&
      Array.isArray(data.ideas)
  );
}

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(payload));
}
