const fs = require("node:fs/promises");
const path = require("node:path");
const { list, put } = require("@vercel/blob");

const BLOB_PATH = "workbench-data.json";
const FALLBACK_DATA_FILE = path.join(process.cwd(), "data", "workbench-data.json");

module.exports = async function handler(request, response) {
  try {
    if (request.method === "GET") {
      const data = await readPersistentData();
      sendJson(response, 200, data);
      return;
    }

    if (request.method === "PUT") {
      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        sendJson(response, 501, {
          error: "Persistent storage is not configured. Connect Vercel Blob first."
        });
        return;
      }

      const payload = await readJsonBody(request);
      if (!isPortableData(payload)) {
        sendJson(response, 400, { error: "Invalid data shape" });
        return;
      }

      await put(BLOB_PATH, JSON.stringify(payload, null, 2), {
        access: "public",
        allowOverwrite: true,
        contentType: "application/json"
      });
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
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { blobs } = await list({ prefix: BLOB_PATH, limit: 10 });
    const blob = blobs.find((item) => item.pathname === BLOB_PATH);

    if (blob) {
      const response = await fetch(blob.url, { cache: "no-store" });
      if (response.ok) return response.json();
    }
  }

  const fallback = await fs.readFile(FALLBACK_DATA_FILE, "utf8");
  return JSON.parse(fallback);
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
