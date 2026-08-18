# 小宣的个人工作台

一个给自己用的极简个人工作台。它把每日任务、每周任务、每周甘特图、每日历史、每周复盘、收藏夹、灵感库和关注博主放在同一个网站里，但每类工作都在独立 Tab 中管理，避免所有东西混在一起。

项目当前使用：

- 前端：原生 `HTML + CSS + JavaScript`
- 数据存储：Supabase `workspace_state` 表
- 部署：Vercel
- 定时提醒：Vercel Cron + 飞书机器人
- 域名：建议用 Cloudflare 管 DNS，再指向 Vercel

## 功能

- 每日任务：支持创建、完成、编辑、逻辑删除、延期显示、每日历史归档。
- 每周任务：支持创建、完成、编辑、归档、历史查看。
- 本周甘特图：按周一到周日展示任务时间范围。
- 每周复盘：每周记录完成、未完成、原因和下周重点。
- 收藏夹：保存文件或链接。
- 灵感库：保存临时想法。
- 关注博主：按小红书、公众号、B站、视频号等平台管理博主。
- 飞书提醒：每天检查未完成的每日任务，并发送提醒。

## 本地启动

先安装依赖：

```bash
npm install
```

复制环境变量示例文件：

```bash
cp .env.example .env
```

然后填写 `.env`：

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-publishable-key
FEISHU_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/your-webhook-id
REMINDER_TIME_ZONE=America/Los_Angeles
CRON_SECRET=your-random-secret
```

启动本地服务：

```bash
npm run dev
```

默认访问：

```txt
http://127.0.0.1:8765/
```

如果本地端口被占用，可以临时指定端口：

```bash
PORT=8770 npm run dev
```

## 配置 Supabase

这个项目的数据不只存在浏览器 `localStorage`。正式部署时，任务、收藏夹、灵感库、关注博主等内容会保存到 Supabase。

### 1. 创建项目

打开 Supabase，创建一个新项目。创建完成后进入项目后台。

### 2. 创建数据表

进入：

```txt
SQL Editor -> New query
```

执行项目里的 SQL：

```sql
create table if not exists workspace_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);

insert into workspace_state (id, data)
values (
  'main',
  '{
    "theme": "light",
    "view": "today",
    "today": [],
    "week": [],
    "weekHistory": [],
    "links": [],
    "ideas": [],
    "creators": []
  }'::jsonb
)
on conflict (id) do nothing;
```

项目里也保留了一份同样的文件：

```txt
supabase-schema.sql
```

注意：`on conflict (id) do nothing` 很重要，它可以避免重复执行 SQL 时覆盖已有数据。

### 3. 获取 Supabase 环境变量

在 Supabase 项目里进入：

```txt
Project Settings -> API Keys
```

复制：

```txt
Project URL
Publishable key
```

对应填到：

```txt
SUPABASE_URL=Project URL
SUPABASE_ANON_KEY=Publishable key
```

不要把 `service_role` 或 secret key 放到前端，也不要提交到 GitHub。

## 发布到 GitHub

### 1. 初始化 Git

如果本地还没有 Git 仓库：

```bash
git init
git add .
git commit -m "Initial personal workbench"
```

### 2. 创建 GitHub 仓库

在 GitHub 新建一个仓库，例如：

```txt
X-Workspace
```

不要勾选自动生成 README、`.gitignore` 或 license，避免和本地文件冲突。

### 3. 关联远程仓库

把下面地址换成你的仓库地址：

```bash
git remote add origin git@github.com:MicroXuan/X-Workspace.git
git branch -M main
git push -u origin main
```

后续每次更新：

```bash
git add .
git commit -m "Update workbench"
git push origin main
```

## 部署到 Vercel

Vercel 适合这个项目，因为它既能托管静态页面，也能运行 `api/data.js` 和 `api/daily-reminder.js` 这两个 Serverless Function。

### 1. 导入 GitHub 仓库

进入 Vercel：

```txt
Add New -> Project
```

选择 GitHub 仓库：

```txt
MicroXuan/X-Workspace
```

Vercel 连接 GitHub 后，推送到生产分支会自动触发部署。

### 2. 配置构建参数

这个项目已经有 `vercel.json`，通常保持默认即可。

如果 Vercel 页面要求填写，可以按下面配置：

```txt
Framework Preset: Other
Build Command: npm run vercel-build
Output Directory: public
Install Command: npm install
```

### 3. 配置环境变量

进入 Vercel 项目：

```txt
Settings -> Environment Variables
```

添加下面变量，并确保环境选择包含 `Production`：

```txt
SUPABASE_URL
SUPABASE_ANON_KEY
FEISHU_WEBHOOK_URL
REMINDER_TIME_ZONE
CRON_SECRET
```

示例：

```txt
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-publishable-key
FEISHU_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/your-webhook-id
REMINDER_TIME_ZONE=America/Los_Angeles
CRON_SECRET=your-random-secret
```

生成 `CRON_SECRET` 可以用：

```bash
openssl rand -hex 32
```

这个值用于保护提醒接口，防止别人随便触发你的飞书提醒。

### 4. 部署

点：

```txt
Deploy
```

部署成功后，Vercel 会给一个默认域名，例如：

```txt
x-workspace-gray.vercel.app
```

打开这个地址，确认页面能访问。

### 5. 重新部署

如果你改了环境变量，建议重新部署一次：

```txt
Deployments -> 最新部署右侧菜单 -> Redeploy
```

环境变量不是改完旧部署就一定立刻生效，重新部署可以减少很多排查时间。

## 配置飞书提醒

### 1. 创建飞书机器人

在飞书群里添加自定义机器人，复制 webhook 地址，填到：

```txt
FEISHU_WEBHOOK_URL
```

如果机器人开启了安全设置，建议先用“关键词”方式，关键词可以填：

```txt
工作台
```

当前提醒内容里包含“工作台”，可以通过关键词校验。

### 2. Vercel Cron

项目的 `vercel.json` 里配置了自动提醒：

```json
{
  "path": "/api/daily-reminder",
  "schedule": "30 6 * * *"
}
```

Vercel Cron 使用 UTC 时间。`30 6 * * *` 表示每天 UTC 06:30 触发一次。按洛杉矶夏令时大约是晚上 23:30。

### 3. 手动测试提醒

先测试数据读取，不真的发送飞书：

```bash
curl 'https://你的域名/api/daily-reminder?dryRun=1' \
  -H 'Authorization: Bearer 你的_CRON_SECRET'
```

正式触发一条飞书提醒：

```bash
curl -X POST 'https://你的域名/api/daily-reminder' \
  -H 'Authorization: Bearer 你的_CRON_SECRET'
```

如果返回类似下面内容，就说明发送成功：

```json
{"ok":true,"sent":true,"count":1}
```

## 用 Cloudflare 绑定自定义域名

这里推荐的方式是：

```txt
Cloudflare 管 DNS -> Vercel 托管网站
```

也就是说，网站还是部署在 Vercel，Cloudflare 负责域名解析、DNS 管理和基础安全能力。

### 1. 先在 Vercel 添加域名

进入 Vercel 项目：

```txt
Settings -> Domains
```

添加你想使用的域名，例如：

```txt
workspace.thexuan.com
```

Vercel 会提示你需要添加什么 DNS 记录。子域名一般是 `CNAME`。

### 2. 在 Cloudflare 添加 DNS 记录

进入 Cloudflare：

```txt
Websites -> 选择你的域名 -> DNS -> Records -> Add record
```

如果你要绑定子域名：

```txt
Type: CNAME
Name: workspace
Target: cname.vercel-dns.com
Proxy status: DNS only
```

有些 Vercel 项目会给你一个专属 CNAME 目标。如果 Vercel 页面展示的是专属目标，就以 Vercel 页面显示的值为准。

如果你要绑定根域名：

```txt
Type: A
Name: @
Target: 76.76.21.21
Proxy status: DNS only
```

### 3. 等待生效

DNS 生效通常需要几分钟，有时会更久。回到 Vercel 的 `Settings -> Domains`，看到 `Valid Configuration` 就说明配置成功。

### 4. 常见问题

如果 Vercel 一直显示域名配置不正确：

- 检查 Cloudflare 里是否有重复的 `A`、`AAAA` 或 `CNAME` 记录。
- 子域名用 `CNAME`，根域名用 Vercel 提示的 `A` 记录。
- 先把 Cloudflare 代理状态设为 `DNS only`，等 Vercel 验证通过后再决定是否开启代理。
- 修改 DNS 后回到 Vercel 点刷新或等待它重新检测。

## Cloudflare Pages 可以直接部署吗？

不建议直接把当前项目部署到 Cloudflare Pages。

原因是当前项目依赖 Vercel 风格的 Node Serverless Function：

```txt
api/data.js
api/daily-reminder.js
```

Cloudflare Pages 的函数运行时和 Vercel 不一样。如果要完整迁移到 Cloudflare Pages，需要把 API 改成 Cloudflare Pages Functions 或 Workers 写法。对于现在这个工作台，最省心的方案是继续用 Vercel 部署，把 Cloudflare 用作域名和 DNS。

## 数据安全注意事项

- 不要提交 `.env`。
- 不要提交真实 webhook、密钥或 secret。
- 不要手动覆盖 Supabase 里的 `workspace_state.main.data`。
- 删除任务、收藏、灵感、博主时，项目应使用 `deletedAt` 做逻辑删除，不做物理删除。
- 重跑 `supabase-schema.sql` 不会清空数据，因为初始化语句用了 `on conflict do nothing`。

## 参考文档

- Vercel GitHub 部署文档：<https://vercel.com/docs/git/vercel-for-github>
- Vercel 环境变量文档：<https://vercel.com/docs/environment-variables>
- Vercel 自定义域名文档：<https://vercel.com/docs/domains/working-with-domains/add-a-domain>
- Vercel Cron 文档：<https://vercel.com/docs/cron-jobs>
- Cloudflare Pages 自定义域名文档：<https://developers.cloudflare.com/pages/configuration/custom-domains/>
