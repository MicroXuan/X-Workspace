const http = require("node:http");
const fsSync = require("node:fs");
const fs = require("node:fs/promises");
const path = require("node:path");
const { createClient } = require("@supabase/supabase-js");

const rootDir = path.join(__dirname, "..");
loadEnvFile(path.join(rootDir, ".env"));

const dataDir = path.join(rootDir, "data");
const dataFile = path.join(dataDir, "workbench-data.json");
const port = Number(process.env.PORT || 8765);
const stateId = "main";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (url.pathname === "/api/data") {
      await handleDataApi(request, response);
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }

    await serveStatic(url.pathname, request, response);
  } catch (error) {
    sendJson(response, 500, { error: "Internal server error" });
  }
});

server.listen(port, () => {
  console.log(`Personal Workbench running at http://127.0.0.1:${port}/`);
});

async function handleDataApi(request, response) {
  if (request.method === "GET") {
    const data = await readPersistentData();
    response.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    });
    response.end(data);
    return;
  }

  if (request.method === "PUT") {
    const body = await readRequestBody(request);
    const parsed = JSON.parse(body);

    if (!isPortableData(parsed)) {
      sendJson(response, 400, { error: "Invalid data shape" });
      return;
    }

    await writePersistentData(parsed);
    sendJson(response, 200, { ok: true });
    return;
  }

  sendJson(response, 405, { error: "Method not allowed" });
}

async function readPersistentData() {
  const supabase = getSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("workspace_state")
      .select("data")
      .eq("id", stateId)
      .maybeSingle();

    if (error) throw error;
    if (data && data.data) return JSON.stringify(createPortableData(data.data), null, 2);
  }

  await ensureDataFile();
  return fs.readFile(dataFile, "utf8");
}

async function writePersistentData(parsed) {
  const supabase = getSupabaseClient();
  if (supabase) {
    const { error } = await supabase
      .from("workspace_state")
      .upsert({
        id: stateId,
        data: parsed.data,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;
    return;
  }

  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(dataFile, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
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

function loadEnvFile(filePath) {
  try {
    const content = fsSync.readFileSync(filePath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!match) continue;

      const [, key, rawValue] = match;
      if (process.env[key]) continue;

      process.env[key] = rawValue.replace(/^["']|["']$/g, "");
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function serveStatic(pathname, request, response) {
  const cleanPath = decodeURIComponent(pathname === "/" ? "/index.html" : pathname);
  const absolutePath = path.normalize(path.join(rootDir, cleanPath));

  if (!absolutePath.startsWith(rootDir)) {
    sendJson(response, 403, { error: "Forbidden" });
    return;
  }

  try {
    const content = await fs.readFile(absolutePath);
    const ext = path.extname(absolutePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": ext === ".html" ? "no-store" : "public, max-age=60"
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    response.end(content);
  } catch {
    sendJson(response, 404, { error: "Not found" });
  }
}

async function ensureDataFile() {
  try {
    await fs.access(dataFile);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(
      dataFile,
      `${JSON.stringify(createEmptyPortableData(), null, 2)}\n`,
      "utf8"
    );
  }
}

function readRequestBody(request) {
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
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
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
      Array.isArray(data.ideas) &&
      (!("creators" in data) || Array.isArray(data.creators))
  );
}

function createEmptyPortableData() {
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    app: "Personal Workbench",
    data: {
      theme: "light",
      view: "today",
      creatorPlatform: "xiaohongshu",
      today: [],
      week: [],
      weekHistory: [],
      links: [],
      ideas: [],
      creators: []
    }
  };
}

function createPortableData(data) {
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    app: "Personal Workbench",
    data: {
      theme: data.theme === "dark" ? "dark" : "light",
      view: typeof data.view === "string" ? data.view : "today",
      creatorPlatform: typeof data.creatorPlatform === "string" ? data.creatorPlatform : "xiaohongshu",
      today: Array.isArray(data.today) ? data.today : [],
      week: Array.isArray(data.week) ? data.week : [],
      weekHistory: Array.isArray(data.weekHistory) ? data.weekHistory : [],
      links: Array.isArray(data.links) ? data.links : [],
      ideas: Array.isArray(data.ideas) ? data.ideas : [],
      creators: Array.isArray(data.creators) ? data.creators : []
    }
  };
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}
