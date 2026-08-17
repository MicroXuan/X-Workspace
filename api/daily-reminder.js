const { runDailyReminder, verifyReminderRequest } = require("../lib/reminder");

module.exports = async function handler(request, response) {
  try {
    if (request.method !== "GET" && request.method !== "POST") {
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }

    if (!verifyReminderRequest(request)) {
      sendJson(response, 401, { error: "Unauthorized" });
      return;
    }

    const url = new URL(request.url, "https://x-workspace-gray.vercel.app");
    const result = await runDailyReminder({
      dryRun: url.searchParams.get("dryRun") === "1"
    });
    sendJson(response, 200, result);
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: "Daily reminder failed" });
  }
};

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(payload));
}
