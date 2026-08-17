const { createClient } = require("@supabase/supabase-js");

const STATE_ID = "main";
const DEFAULT_TIME_ZONE = "America/Los_Angeles";

async function runDailyReminder(options = {}) {
  const data = await readWorkspaceData();
  const tasks = getIncompleteTodayTasks(data.today);
  const timeZone = process.env.REMINDER_TIME_ZONE || DEFAULT_TIME_ZONE;

  if (!tasks.length) {
    return {
      ok: true,
      sent: false,
      count: 0,
      message: "No incomplete daily tasks."
    };
  }

  const payload = createFeishuPayload(tasks, timeZone);
  if (options.dryRun) {
    return {
      ok: true,
      sent: false,
      dryRun: true,
      count: tasks.length,
      payload
    };
  }

  await sendFeishuMessage(payload);
  return {
    ok: true,
    sent: true,
    count: tasks.length
  };
}

async function readWorkspaceData() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase
    .from("workspace_state")
    .select("data")
    .eq("id", STATE_ID)
    .maybeSingle();

  if (error) throw error;
  return data && data.data ? data.data : {};
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

function getIncompleteTodayTasks(value) {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item) =>
      item &&
      typeof item.title === "string" &&
      !item.done &&
      !Number.isFinite(item.deletedAt)
    )
    .sort((a, b) => {
      const aTime = Number.isFinite(a.createdAt) ? a.createdAt : 0;
      const bTime = Number.isFinite(b.createdAt) ? b.createdAt : 0;
      return aTime - bTime;
    });
}

function createFeishuPayload(tasks, timeZone) {
  const today = new Intl.DateTimeFormat("zh-CN", {
    timeZone,
    month: "2-digit",
    day: "2-digit",
    weekday: "short"
  }).format(new Date());
  const taskLines = tasks.map((task, index) => `${index + 1}. ${task.title}`).join("\n");

  return {
    msg_type: "text",
    content: {
      text: `工作台提醒｜${today}\n今晚还有 ${tasks.length} 个每日任务未完成：\n${taskLines}`
    }
  };
}

async function sendFeishuMessage(payload) {
  const webhookUrl = process.env.FEISHU_WEBHOOK_URL;
  if (!webhookUrl) {
    throw new Error("FEISHU_WEBHOOK_URL is not configured.");
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Feishu webhook failed with ${response.status}: ${body}`);
  }

  try {
    const result = JSON.parse(body);
    if (result && result.code && result.code !== 0) {
      throw new Error(`Feishu webhook returned code ${result.code}: ${result.msg || body}`);
    }
  } catch (error) {
    if (error instanceof SyntaxError) return;
    throw error;
  }
}

function verifyReminderRequest(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;

  return request.headers.authorization === `Bearer ${secret}`;
}

module.exports = {
  createFeishuPayload,
  getIncompleteTodayTasks,
  runDailyReminder,
  verifyReminderRequest
};
