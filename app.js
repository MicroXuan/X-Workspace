const STORAGE_KEY = "personal-workbench-state-v1";
const API_DATA_PATH = "/api/data";
const DATA_FILE_PATH = "./data/workbench-data.json";
const DATA_FILE_NAME = "workbench-data.json";
const DATA_SCHEMA_VERSION = 1;

const sampleState = {
  theme: "light",
  addKind: "today",
  view: "today",
  creatorPlatform: "xiaohongshu",
  today: [
    { id: uid(), title: "整理今天最重要的三件事", done: false, createdAt: Date.now() - 900000 },
    { id: uid(), title: "复盘正在推进的项目状态", done: false, createdAt: Date.now() - 600000 },
    { id: uid(), title: "清理收件箱和待读链接", done: true, createdAt: Date.now() - 300000 }
  ],
  dailyHistory: [],
  week: [
    { id: uid(), title: "完成个人知识库结构升级", done: false, createdAt: Date.now() - 200000 },
    { id: uid(), title: "沉淀一个可复用的工作流模板", done: false, createdAt: Date.now() - 100000 }
  ],
  weekHistory: [
    {
      id: uid(),
      label: "上周回顾",
      range: "示例历史周",
      archivedAt: Date.now() - 86400000 * 6,
      tasks: [
        { id: uid(), title: "整理工作台第一版结构", done: true, createdAt: Date.now() - 86400000 * 9 },
        { id: uid(), title: "收集常用链接入口", done: true, createdAt: Date.now() - 86400000 * 8 },
        { id: uid(), title: "记录三个后续优化想法", done: false, createdAt: Date.now() - 86400000 * 7 }
      ]
    }
  ],
  links: [
    { id: uid(), title: "年度目标文档", url: "workspace://goals", type: "file", createdAt: Date.now() - 500000 },
    { id: uid(), title: "AI 产品灵感收藏夹", url: "https://example.com", type: "link", createdAt: Date.now() - 400000 }
  ],
  ideas: [
    { id: uid(), title: "把重复工作做成一键式指令面板", createdAt: Date.now() - 700000 },
    { id: uid(), title: "每周自动生成一次个人进展报告", createdAt: Date.now() - 350000 }
  ],
  creators: []
};

let state = loadState();
let toastTimer;
let serverStorageAvailable = false;
let serverSaveTimer;
let editingItem = null;
let editingCreatorId = null;

const els = {
  body: document.body,
  todayLabel: document.querySelector("#todayLabel"),
  heroTitle: document.querySelector("#heroTitle"),
  exportDataButton: document.querySelector("#exportDataButton"),
  importDataInput: document.querySelector("#importDataInput"),
  themeButton: document.querySelector("#themeButton"),
  quickForm: document.querySelector("#quickForm"),
  quickInput: document.querySelector("#quickInput"),
  creatorUrlInput: document.querySelector("#creatorUrlInput"),
  viewButtons: [...document.querySelectorAll("[data-view]")],
  panels: [...document.querySelectorAll("[data-panel]")],
  todayList: document.querySelector("#todayList"),
  dailyHistoryList: document.querySelector("#dailyHistoryList"),
  dailyHistoryCount: document.querySelector("#dailyHistoryCount"),
  weekList: document.querySelector("#weekList"),
  weekGantt: document.querySelector("#weekGantt"),
  weekGanttRange: document.querySelector("#weekGanttRange"),
  weekHistoryList: document.querySelector("#weekHistoryList"),
  weekHistoryCount: document.querySelector("#weekHistoryCount"),
  linksList: document.querySelector("#linksList"),
  ideasList: document.querySelector("#ideasList"),
  creatorsList: document.querySelector("#creatorsList"),
  platformButtons: [...document.querySelectorAll("[data-platform]")],
  viewEyebrow: document.querySelector("#viewEyebrow"),
  viewTitle: document.querySelector("#viewTitle"),
  viewCount: document.querySelector("#viewCount"),
  viewSub: document.querySelector("#viewSub"),
  viewNoteTitle: document.querySelector("#viewNoteTitle"),
  viewNote: document.querySelector("#viewNote"),
  sidebarProgress: document.querySelector("#sidebarProgress"),
  toast: document.querySelector("#toast")
};

const viewMeta = {
  today: {
    hero: "Daily Focus",
    eyebrow: "Today",
    title: "每日任务",
    placeholder: "添加今日任务...",
    noteTitle: "只处理今天",
    note: "把今天要完成的动作收束在这里，其他工作不混进来。"
  },
  week: {
    hero: "Weekly Track",
    eyebrow: "This Week",
    title: "每周任务",
    placeholder: "添加本周任务...",
    noteTitle: "只看本周推进",
    note: "适合放跨天任务、阶段性目标和需要持续推进的事情。"
  },
  links: {
    hero: "Bookmarks",
    eyebrow: "Folder",
    title: "收藏夹",
    placeholder: "粘贴文件名或链接...",
    noteTitle: "只管理资料入口",
    note: "文件名、网页链接、参考资料都放这里，和任务列表分开。"
  },
  ideas: {
    hero: "Idea Shelf",
    eyebrow: "Ideas",
    title: "灵感库",
    placeholder: "记录一个灵感...",
    noteTitle: "只收集想法",
    note: "未成形的念头先存起来，等它值得行动时再变成任务。"
  },
  creators: {
    hero: "Creator Watch",
    eyebrow: "Creators",
    title: "关注博主",
    placeholder: "添加博主名...",
    noteTitle: "只管理关注源",
    note: "按平台整理值得长期跟进的创作者，和任务、收藏、灵感分开。"
  }
};

const platformMeta = {
  xiaohongshu: "小红书",
  wechat: "公众号",
  bilibili: "B站",
  channels: "视频号"
};

init();

async function init() {
  await hydrateFromDataFile();
  archiveCompletedDailyTasks();

  const initialView = window.location.hash.replace("#", "");
  if (viewMeta[initialView]) {
    state.view = initialView;
    state.addKind = initialView;
  }

  els.todayLabel.textContent = new Intl.DateTimeFormat("zh-CN", {
    weekday: "long",
    month: "long",
    day: "numeric"
  }).format(new Date());

  bindEvents();
  render();
}

function bindEvents() {
  els.quickForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addItem(els.quickInput.value.trim(), els.creatorUrlInput.value.trim());
  });

  els.exportDataButton.addEventListener("click", exportDataFile);
  els.importDataInput.addEventListener("change", importDataFile);

  els.viewButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.view = button.dataset.view;
      state.addKind = state.view;
      window.history.replaceState(null, "", `#${state.view}`);
      saveAndRender();
      els.quickInput.focus();
    });
  });

  els.platformButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.creatorPlatform = button.dataset.platform;
      saveAndRender();
      els.quickInput.focus();
    });
  });

  els.themeButton.addEventListener("click", () => {
    state.theme = state.theme === "dark" ? "light" : "dark";
    saveAndRender();
    showToast(state.theme === "dark" ? "已切换到深色模式" : "已切换到浅色模式");
  });

  document.addEventListener("click", (event) => {
    const clearButton = event.target.closest("[data-clear]");
    const deleteButton = event.target.closest("[data-delete]");
    const editItemButton = event.target.closest("[data-edit-item]");
    const saveItemButton = event.target.closest("[data-save-item]");
    const cancelItemButton = event.target.closest("[data-cancel-item-edit]");
    const editCreatorButton = event.target.closest("[data-edit-creator]");
    const saveCreatorButton = event.target.closest("[data-save-creator]");
    const cancelCreatorButton = event.target.closest("[data-cancel-creator-edit]");
    const checkButton = event.target.closest("[data-check]");
    const taskHitArea = event.target.closest("[data-task-hit]");
    const sortButton = event.target.closest("[data-sort]");
    const randomButton = event.target.closest("[data-random-idea]");
    const archiveWeekButton = event.target.closest("[data-archive-week]");
    const deleteWeekArchiveButton = event.target.closest("[data-delete-week-archive]");

    if (clearButton) clearDone(clearButton.dataset.clear);
    if (deleteButton) removeItem(deleteButton.dataset.group, deleteButton.dataset.delete);
    if (editItemButton) {
      editingItem = {
        group: editItemButton.dataset.group,
        id: editItemButton.dataset.editItem
      };
      render();
      return;
    }
    if (saveItemButton) {
      saveItemEdit(saveItemButton.dataset.group, saveItemButton.dataset.saveItem);
      return;
    }
    if (cancelItemButton) {
      editingItem = null;
      render();
      return;
    }
    if (editCreatorButton) {
      editingCreatorId = editCreatorButton.dataset.editCreator;
      render();
      return;
    }
    if (saveCreatorButton) {
      saveCreatorEdit(saveCreatorButton.dataset.saveCreator);
      return;
    }
    if (cancelCreatorButton) {
      editingCreatorId = null;
      render();
      return;
    }
    if (checkButton) {
      toggleDone(checkButton.dataset.group, checkButton.dataset.check, checkButton);
      return;
    }
    if (taskHitArea) {
      toggleDone(taskHitArea.dataset.group, taskHitArea.dataset.check, taskHitArea);
      return;
    }
    if (sortButton) sortLinks();
    if (randomButton) focusRandomIdea();
    if (archiveWeekButton) archiveCurrentWeek();
    if (deleteWeekArchiveButton) removeWeekArchive(deleteWeekArchiveButton.dataset.deleteWeekArchive);
  });

  document.addEventListener("keydown", (event) => {
    const taskHitArea = event.target.closest("[data-task-hit]");
    if (!taskHitArea || (event.key !== "Enter" && event.key !== " ")) return;

    event.preventDefault();
    toggleDone(taskHitArea.dataset.group, taskHitArea.dataset.check, taskHitArea);
  });
}

function addItem(rawValue, optionalValue = "") {
  if (!rawValue) {
    if (state.view === "creators") {
      showToast("先填写博主名。");
      return;
    }

    showToast("先写点内容，再把它收进工作台。");
    return;
  }

  const id = uid();
  const createdAt = Date.now();

  const group = state.view;

  if (group === "links") {
    const isUrl = /^https?:\/\//i.test(rawValue);
    state.links.unshift({
      id,
      title: isUrl ? new URL(rawValue).hostname.replace(/^www\./, "") : rawValue,
      url: isUrl ? rawValue : "workspace://file",
      type: isUrl ? "link" : "file",
      createdAt
    });
  } else if (group === "ideas") {
    state.ideas.unshift({ id, title: rawValue, createdAt });
  } else if (group === "creators") {
    const url = normalizeCreatorUrl(optionalValue);
    state.creators.unshift({
      id,
      title: rawValue,
      url,
      platform: state.creatorPlatform,
      createdAt
    });
  } else {
    state[group].unshift({ id, title: rawValue, done: false, createdAt });
  }

  els.quickInput.value = "";
  els.creatorUrlInput.value = "";
  saveAndRender();
  showToast("已添加");
}

function toggleDone(group, id, trigger) {
  const task = state[group].find((item) => item.id === id);
  const isCompleting = task && !task.done;

  if (isCompleting) {
    launchTaskCelebration(trigger);
  }

  state[group] = state[group].map((item) =>
    item.id === id
      ? {
          ...item,
          done: !item.done,
          completedAt: item.done ? null : Date.now()
        }
      : item
  );
  saveAndRender();
}

function clearDone(group) {
  const before = state[group].length;
  state[group] = state[group].filter((item) => !item.done);
  saveAndRender();
  showToast(before === state[group].length ? "没有已完成任务" : "已清除完成项");
}

function archiveCurrentWeek() {
  if (!state.week.length) {
    showToast("本周还没有可归档的任务。");
    return;
  }

  const range = getCurrentWeekRange();
  state.weekHistory.unshift({
    id: uid(),
    label: range.label,
    range: range.text,
    archivedAt: Date.now(),
    tasks: state.week.map((item) => ({ ...item }))
  });
  state.week = [];
  saveAndRender();
  showToast("本周任务已归档");
}

function removeWeekArchive(id) {
  state.weekHistory = state.weekHistory.filter((archive) => archive.id !== id);
  saveAndRender();
  showToast("已删除历史周");
}

function removeItem(group, id) {
  state[group] = state[group].filter((item) => item.id !== id);
  saveAndRender();
  showToast("已移除");
}

function sortLinks() {
  state.links.sort((a, b) => a.type.localeCompare(b.type));
  saveAndRender();
  showToast("已按类型排序");
}

function focusRandomIdea() {
  if (!state.ideas.length) {
    showToast("灵感库还没有内容");
    return;
  }

  const index = Math.floor(Math.random() * state.ideas.length);
  const [idea] = state.ideas.splice(index, 1);
  state.ideas.unshift(idea);
  saveAndRender();
  showToast("已把一个灵感放到顶部");
}

function archiveCompletedDailyTasks() {
  if (!Array.isArray(state.today) || !state.today.length) return;

  const today = startOfToday();
  const completedBeforeToday = state.today.filter((item) => {
    if (!item.done) return false;
    const completedAt = Number.isFinite(item.completedAt) ? item.completedAt : item.createdAt;
    return completedAt && startOfDay(new Date(completedAt)) < today;
  });

  if (!completedBeforeToday.length) return;

  state.today = state.today.filter((item) => !completedBeforeToday.includes(item));

  completedBeforeToday.forEach((item) => {
    const completedAt = Number.isFinite(item.completedAt) ? item.completedAt : item.createdAt;
    const date = getLocalDateString(new Date(completedAt));
    const label = formatDailyHistoryLabel(date);
    let archive = state.dailyHistory.find((entry) => entry.date === date);

    if (!archive) {
      archive = {
        id: uid(),
        date,
        label,
        archivedAt: Date.now(),
        tasks: []
      };
      state.dailyHistory.unshift(archive);
    }

    archive.tasks.unshift({ ...item, completedAt });
  });

  state.dailyHistory.sort((a, b) => b.date.localeCompare(a.date));
  persistState();
}

function render() {
  ensureStateShape();
  document.documentElement.dataset.theme = state.theme;
  document.documentElement.dataset.activeView = state.view;
  renderSegments();
  renderNavigation();
  renderWeekGantt();
  renderTasks("today", els.todayList);
  renderDailyHistory();
  renderTasks("week", els.weekList);
  renderWeekHistory();
  renderLinks();
  renderIdeas();
  renderCreators();
  renderMetrics();
}

function ensureStateShape() {
  if (!viewMeta[state.view]) state.view = "today";
  if (!platformMeta[state.creatorPlatform]) state.creatorPlatform = "xiaohongshu";
  if (!Array.isArray(state.creators)) state.creators = [];
  if (!Array.isArray(state.dailyHistory)) state.dailyHistory = [];
}

function renderSegments() {
  els.viewButtons.forEach((button) => {
    const isActive = button.dataset.view === state.view;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  els.quickInput.placeholder = viewMeta[state.view].placeholder;
  els.quickInput.setAttribute("aria-label", state.view === "creators" ? "博主名" : "添加内容");
}

function renderPlatformTabs() {
  els.platformButtons.forEach((button) => {
    const isActive = button.dataset.platform === state.creatorPlatform;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });
}

function renderNavigation() {
  els.panels.forEach((panel) => {
    panel.classList.toggle("is-visible", panel.dataset.panel === state.view);
  });
}

function renderTasks(group, container) {
  const items = group === "today" ? getSortedTodayTasks() : state[group];
  container.innerHTML = items.length
    ? items.map((item) => taskTemplate(group, item)).join("")
    : emptyTemplate(group === "today" ? "今天还很干净。" : "本周任务等待安排。");
}

function getSortedTodayTasks() {
  const rank = (item) => {
    if (item.done) return 2;
    if (isBeforeToday(item.createdAt)) return 0;
    return 1;
  };

  return [...state.today].sort((a, b) => rank(a) - rank(b) || b.createdAt - a.createdAt);
}

function renderLinks() {
  els.linksList.innerHTML = state.links.length
    ? state.links.map(linkTemplate).join("")
    : emptyTemplate("收藏一个文件或链接。");
}

function renderIdeas() {
  els.ideasList.innerHTML = state.ideas.length
    ? state.ideas.map(ideaTemplate).join("")
    : emptyTemplate("把一闪而过的想法放在这里。");
}

function renderCreators() {
  renderPlatformTabs();

  const visibleCreators = state.creators.filter(
    (item) => item.platform === state.creatorPlatform
  );

  els.creatorsList.innerHTML = visibleCreators.length
    ? visibleCreators.map(creatorTemplate).join("")
    : emptyTemplate(`还没有收藏${platformMeta[state.creatorPlatform]}博主。`);
}

function renderMetrics() {
  const todayDone = state.today.filter((item) => item.done).length;
  const weekDone = state.week.filter((item) => item.done).length;
  const progress = state.today.length ? Math.round((todayDone / state.today.length) * 100) : 0;
  const meta = viewMeta[state.view];
  const activeItems = state[state.view];
  const doneCount = state.view === "today" || state.view === "week"
    ? activeItems.filter((item) => item.done).length
    : null;

  els.heroTitle.textContent = meta.hero;
  els.viewEyebrow.textContent = meta.eyebrow;
  els.viewTitle.textContent = meta.title;
  els.viewCount.textContent = activeItems.length;
  els.viewSub.textContent = state.view === "week"
    ? `${activeItems.length} 个当前 / ${state.weekHistory.length} 周历史`
    : state.view === "today"
    ? `${doneCount} 个已完成 / ${state.dailyHistory.length} 天历史`
    : state.view === "creators"
    ? `${getCreatorsByPlatform(state.creatorPlatform).length} 个${platformMeta[state.creatorPlatform]}博主`
    : doneCount === null
    ? `${activeItems.length} 条已保存`
    : `${doneCount} 个已完成`;
  els.viewNoteTitle.textContent = meta.noteTitle;
  els.viewNote.textContent = meta.note;
  els.sidebarProgress.textContent = `${progress}%`;
}

function renderWeekHistory() {
  els.weekHistoryCount.textContent = `${state.weekHistory.length} 周`;
  els.weekHistoryList.innerHTML = state.weekHistory.length
    ? state.weekHistory.map(weekArchiveTemplate).join("")
    : emptyTemplate("归档一次本周任务后，历史会出现在这里。");
}

function renderDailyHistory() {
  els.dailyHistoryCount.textContent = `${state.dailyHistory.length} 天`;
  els.dailyHistoryList.innerHTML = state.dailyHistory.length
    ? state.dailyHistory.map(dailyArchiveTemplate).join("")
    : emptyTemplate("完成项会在第二天自动进入这里。");
}

function dailyArchiveTemplate(archive) {
  return `
    <article class="archive-item daily-archive-item">
      <div>
        <p class="archive-title">${escapeHtml(archive.label)}</p>
        <div class="item-meta">
          <span class="tag">${archive.tasks.length} Done</span>
          <span>归档于 ${formatDate(archive.archivedAt)}</span>
        </div>
      </div>
      <div class="archive-task-list">
        ${archive.tasks.map(archiveTaskTemplate).join("")}
      </div>
    </article>
  `;
}

function renderWeekGantt() {
  const range = getCurrentWeekRange();
  const days = getCurrentWeekDays();
  const scheduledTasks = state.week
    .map((item) => ({ item, schedule: getWeekTaskSchedule(item, days) }))
    .filter((entry) => entry.schedule);
  const unplannedTasks = state.week.filter((item) => !getWeekTaskSchedule(item, days));
  const todayIndex = days.findIndex((day) => day.dateString === getLocalDateString(new Date()));

  els.weekGanttRange.textContent = range.text;
  els.weekGantt.innerHTML = state.week.length
    ? `
      <div class="gantt-grid" style="--today-index: ${Math.max(todayIndex, 0)}">
        <div class="gantt-label-spacer" aria-hidden="true"></div>
        ${days.map((day) => `
          <div class="gantt-day ${day.isToday ? "is-today" : ""}">
            <span>${day.weekday}</span>
            <strong>${day.label}</strong>
          </div>
        `).join("")}
        ${todayIndex >= 0 ? `<div class="gantt-today-line" aria-hidden="true" style="grid-column: ${todayIndex + 2};"></div>` : ""}
        ${scheduledTasks.length
          ? scheduledTasks.map(({ item, schedule }) => ganttRowTemplate(item, schedule)).join("")
          : '<div class="gantt-empty-row">本周任务还没有排期。</div>'}
      </div>
      ${unplannedTasks.length ? `
        <div class="unscheduled-row">
          <span>未排期</span>
          <div>
            ${unplannedTasks.map((item) => `<button class="unscheduled-pill" type="button" data-group="week" data-edit-item="${item.id}">${escapeHtml(item.title)}</button>`).join("")}
          </div>
        </div>
      ` : ""}
    `
    : emptyTemplate("添加本周任务后，这里会显示甘特图。");
}

function ganttRowTemplate(item, schedule) {
  const statusClass = item.done
    ? "is-complete"
    : isWeekTaskOverdue(item)
      ? "is-overdue-task"
      : "is-active-task";
  const dateLabel = `${formatDateString(item.startDate)} - ${formatDateString(item.endDate)}`;

  return `
    <div class="gantt-task-label">
      <span>${escapeHtml(item.title)}</span>
      <small>${dateLabel}</small>
    </div>
    <button
      class="gantt-bar ${statusClass}"
      type="button"
      title="${escapeAttribute(`${item.title}｜${dateLabel}`)}"
      data-group="week"
      data-edit-item="${item.id}"
      style="grid-column: ${schedule.start + 2} / span ${schedule.span};"
    >
      <span>${escapeHtml(item.title)}</span>
    </button>
  `;
}

function taskTemplate(group, item) {
  if (isEditingItem(group, item.id)) return taskEditTemplate(group, item);

  const overdue = group === "today"
    ? !item.done && isBeforeToday(item.createdAt)
    : group === "week" && isWeekTaskOverdue(item);
  const statusClass = item.done
    ? "is-complete"
    : overdue
      ? "is-overdue-task"
      : group === "week"
        ? "is-week-task"
        : "is-active-task";

  return `
    <article class="item task-item task-${group} ${statusClass}">
      <button class="check ${item.done ? "is-done" : ""}" type="button" data-group="${group}" data-check="${item.id}" aria-label="${item.done ? "标记为未完成" : "标记为完成"}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
      </button>
      <div class="item-main task-hit-area" data-task-hit data-group="${group}" data-check="${item.id}" role="button" tabindex="0" aria-label="${item.done ? "标记为未完成" : "标记为完成"}">
        <p class="item-title">${escapeHtml(item.title)}</p>
        <div class="item-meta">
          <span class="tag ${overdue ? "is-overdue" : ""}">${overdue ? "已延期" : item.done ? "Done" : "Open"}</span>
          <span>${getTaskMetaTime(group, item)}</span>
        </div>
      </div>
      <button class="edit-button" type="button" data-group="${group}" data-edit-item="${item.id}" aria-label="修改任务">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9" /><path d="m16.5 3.5 4 4L8 20H4v-4L16.5 3.5Z" /></svg>
      </button>
      <button class="delete-button" type="button" data-group="${group}" data-delete="${item.id}" aria-label="删除">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" /></svg>
      </button>
    </article>
  `;
}

function linkTemplate(item) {
  if (isEditingItem("links", item.id)) return linkEditTemplate(item);

  const isExternal = item.url.startsWith("http");
  return `
    <article class="item">
      <div class="item-main">
        <p class="item-title">${escapeHtml(item.title)}</p>
        <div class="item-meta">
          <span class="tag">${item.type}</span>
          ${isExternal ? `<a href="${escapeAttribute(item.url)}" target="_blank" rel="noreferrer">打开链接</a>` : "<span>本地文件</span>"}
        </div>
      </div>
      <button class="edit-button" type="button" data-group="links" data-edit-item="${item.id}" aria-label="修改收藏">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9" /><path d="m16.5 3.5 4 4L8 20H4v-4L16.5 3.5Z" /></svg>
      </button>
      <button class="delete-button" type="button" data-group="links" data-delete="${item.id}" aria-label="删除">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" /></svg>
      </button>
    </article>
  `;
}

function ideaTemplate(item) {
  if (isEditingItem("ideas", item.id)) return simpleItemEditTemplate("ideas", item, "灵感");

  return `
    <article class="item">
      <div class="item-main">
        <p class="item-title">${escapeHtml(item.title)}</p>
        <div class="item-meta">
          <span class="tag">Idea</span>
          <span>${formatTime(item.createdAt)}</span>
        </div>
      </div>
      <button class="edit-button" type="button" data-group="ideas" data-edit-item="${item.id}" aria-label="修改灵感">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9" /><path d="m16.5 3.5 4 4L8 20H4v-4L16.5 3.5Z" /></svg>
      </button>
      <button class="delete-button" type="button" data-group="ideas" data-delete="${item.id}" aria-label="删除">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" /></svg>
      </button>
    </article>
  `;
}

function creatorTemplate(item) {
  if (item.id === editingCreatorId) return creatorEditTemplate(item);

  const platform = platformMeta[item.platform] || "平台";
  const link = item.url
    ? `<a href="${escapeAttribute(item.url)}" target="_blank" rel="noreferrer">打开主页</a>`
    : "";

  return `
    <article class="item creator-item">
      <div class="item-main">
        <p class="item-title">${escapeHtml(item.title)}</p>
        <div class="item-meta">
          <span class="tag">${platform}</span>
          ${link}
          <span>${formatTime(item.createdAt)}</span>
        </div>
      </div>
      <button class="edit-button" type="button" data-edit-creator="${item.id}" aria-label="修改博主">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9" /><path d="m16.5 3.5 4 4L8 20H4v-4L16.5 3.5Z" /></svg>
      </button>
      <button class="delete-button" type="button" data-group="creators" data-delete="${item.id}" aria-label="删除">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" /></svg>
      </button>
    </article>
  `;
}

function taskEditTemplate(group, item) {
  if (group !== "week") return simpleItemEditTemplate(group, item, "每日任务");

  return `
    <article class="item item-edit-row week-edit-row">
      <div class="item-edit-grid week-date-edit" data-item-edit-row="${group}:${item.id}">
        <label>
          <span>每周任务</span>
          <input type="text" data-item-title value="${escapeAttribute(item.title)}" />
        </label>
        <label>
          <span>开始日期</span>
          <input type="date" data-item-start value="${escapeAttribute(item.startDate || "")}" />
        </label>
        <label>
          <span>结束日期</span>
          <input type="date" data-item-end value="${escapeAttribute(item.endDate || "")}" />
        </label>
      </div>
      <button class="edit-button strong-edit" type="button" data-group="${group}" data-save-item="${item.id}" aria-label="保存修改">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
      </button>
      <button class="delete-button" type="button" data-cancel-item-edit aria-label="取消修改">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
    </article>
  `;
}

function simpleItemEditTemplate(group, item, label) {
  return `
    <article class="item item-edit-row">
      <div class="item-edit-grid" data-item-edit-row="${group}:${item.id}">
        <label>
          <span>${label}</span>
          <input type="text" data-item-title value="${escapeAttribute(item.title)}" />
        </label>
      </div>
      <button class="edit-button strong-edit" type="button" data-group="${group}" data-save-item="${item.id}" aria-label="保存修改">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
      </button>
      <button class="delete-button" type="button" data-cancel-item-edit aria-label="取消修改">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
    </article>
  `;
}

function linkEditTemplate(item) {
  return `
    <article class="item item-edit-row">
      <div class="item-edit-grid two-field-edit" data-item-edit-row="links:${item.id}">
        <label>
          <span>名称</span>
          <input type="text" data-item-title value="${escapeAttribute(item.title)}" />
        </label>
        <label>
          <span>链接</span>
          <input type="text" data-item-url value="${escapeAttribute(item.url.startsWith("workspace://") ? "" : item.url)}" placeholder="可选" />
        </label>
      </div>
      <button class="edit-button strong-edit" type="button" data-group="links" data-save-item="${item.id}" aria-label="保存修改">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
      </button>
      <button class="delete-button" type="button" data-cancel-item-edit aria-label="取消修改">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
    </article>
  `;
}

function creatorEditTemplate(item) {
  return `
    <article class="item creator-edit-item">
      <div class="creator-edit-grid" data-creator-edit-row="${item.id}">
        <label>
          <span>博主名</span>
          <input type="text" data-creator-name value="${escapeAttribute(item.title)}" />
        </label>
        <label>
          <span>博主主页</span>
          <input type="text" data-creator-url value="${escapeAttribute(item.url)}" placeholder="可选" />
        </label>
      </div>
      <button class="edit-button strong-edit" type="button" data-save-creator="${item.id}" aria-label="保存修改">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
      </button>
      <button class="delete-button" type="button" data-cancel-creator-edit aria-label="取消修改">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
    </article>
  `;
}

function saveItemEdit(group, id) {
  const row = [...document.querySelectorAll("[data-item-edit-row]")].find(
    (element) => element.dataset.itemEditRow === `${group}:${id}`
  );
  if (!row) return;

  const title = row.querySelector("[data-item-title]").value.trim();
  if (!title) {
    showToast(group === "links" ? "名称不能为空。" : "内容不能为空。");
    return;
  }

  if (group === "links") {
    const url = normalizeOptionalUrl(row.querySelector("[data-item-url]").value.trim());
    state.links = state.links.map((item) =>
      item.id === id
        ? { ...item, title, url: url || "workspace://file", type: url ? "link" : "file" }
        : item
    );
  } else {
    if (group === "week") {
      const startDate = row.querySelector("[data-item-start]")?.value || "";
      const endDate = row.querySelector("[data-item-end]")?.value || "";

      if ((startDate && !endDate) || (!startDate && endDate)) {
        showToast("开始日期和结束日期需要一起填写。");
        return;
      }

      if (startDate && endDate && parseLocalDate(startDate) > parseLocalDate(endDate)) {
        showToast("结束日期不能早于开始日期。");
        return;
      }

      state.week = state.week.map((item) =>
        item.id === id ? { ...item, title, startDate, endDate } : item
      );
      editingItem = null;
      saveAndRender();
      showToast("已更新");
      return;
    }

    state[group] = state[group].map((item) =>
      item.id === id ? { ...item, title } : item
    );
  }

  editingItem = null;
  saveAndRender();
  showToast("已更新");
}

function saveCreatorEdit(id) {
  const row = [...document.querySelectorAll("[data-creator-edit-row]")].find(
    (element) => element.dataset.creatorEditRow === id
  );
  if (!row) return;

  const title = row.querySelector("[data-creator-name]").value.trim();
  const url = normalizeCreatorUrl(row.querySelector("[data-creator-url]").value.trim());

  if (!title) {
    showToast("博主名不能为空。");
    return;
  }

  state.creators = state.creators.map((item) =>
    item.id === id ? { ...item, title, url } : item
  );
  editingCreatorId = null;
  saveAndRender();
  showToast("已更新博主");
}

function getCreatorsByPlatform(platform) {
  return state.creators.filter((item) => item.platform === platform);
}

function isEditingItem(group, id) {
  return Boolean(editingItem && editingItem.group === group && editingItem.id === id);
}

function weekArchiveTemplate(archive) {
  const doneCount = archive.tasks.filter((item) => item.done).length;
  return `
    <article class="archive-item">
      <div class="archive-top">
        <div>
          <p class="archive-title">${escapeHtml(archive.label)}</p>
          <div class="item-meta">
            <span class="tag">${doneCount}/${archive.tasks.length} Done</span>
            <span>${escapeHtml(archive.range)}</span>
            <span>归档于 ${formatDate(archive.archivedAt)}</span>
          </div>
        </div>
        <button class="delete-button" type="button" data-delete-week-archive="${archive.id}" aria-label="删除历史周">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" /></svg>
        </button>
      </div>
      <div class="archive-task-list">
        ${archive.tasks.map(archiveTaskTemplate).join("")}
      </div>
    </article>
  `;
}

function archiveTaskTemplate(item) {
  return `
    <div class="archive-task ${item.done ? "is-done" : ""}">
      <span aria-hidden="true"></span>
      <p>${escapeHtml(item.title)}</p>
    </div>
  `;
}

function emptyTemplate(message) {
  return `<div class="empty"><p>${message}</p></div>`;
}

function saveAndRender() {
  persistState();
  render();
}

async function hydrateFromDataFile() {
  const serverState = await loadStateFromServer();
  if (serverState) {
    state = serverState;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return;
  }

  if (localStorage.getItem(STORAGE_KEY)) return;

  try {
    const response = await fetch(DATA_FILE_PATH, { cache: "no-store" });
    if (!response.ok) return;

    const data = normalizeImportedState(await response.json());
    if (!data) return;

    state = data;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // file:// may block fetch; import/export remains available.
  }
}

async function loadStateFromServer() {
  if (window.location.protocol === "file:") return null;

  try {
    const response = await fetch(API_DATA_PATH, { cache: "no-store" });
    if (!response.ok) return null;

    const data = normalizeImportedState(await response.json());
    if (!data) return null;

    serverStorageAvailable = true;
    return data;
  } catch {
    return null;
  }
}

function exportDataFile() {
  const payload = JSON.stringify(createPortableData(), null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = DATA_FILE_NAME;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("已导出数据文件");
}

async function importDataFile(event) {
  const [file] = event.target.files;
  if (!file) return;

  try {
    const imported = normalizeImportedState(JSON.parse(await file.text()));
    if (!imported) {
      showToast("数据文件格式不正确");
      return;
    }

    state = imported;
    persistState();
    await saveStateToServerNow();
    render();
    showToast("已导入数据文件");
  } catch {
    showToast("无法读取这个数据文件");
  } finally {
    event.target.value = "";
  }
}

function persistState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  scheduleServerSave();
}

function scheduleServerSave() {
  if (!serverStorageAvailable) return;

  window.clearTimeout(serverSaveTimer);
  serverSaveTimer = window.setTimeout(saveStateToServerNow, 250);
}

async function saveStateToServerNow() {
  if (!serverStorageAvailable) return;

  try {
    const response = await fetch(API_DATA_PATH, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createPortableData())
    });

    if (!response.ok) throw new Error("Failed to persist data");
  } catch {
    serverStorageAvailable = false;
    showToast("服务器数据保存失败，已暂存到浏览器");
  }
}

function launchTaskCelebration(trigger) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!trigger) return;

  const rect = trigger.getBoundingClientRect();
  const originX = rect.left + rect.width / 2;
  const originY = rect.top + rect.height / 2;
  const burst = document.createElement("div");
  const pieces = 18;
  const colors = ["#111111", "#f7f7f7", "#d7d7d7", "#8f8f8f"];

  burst.className = "confetti-burst";
  burst.style.left = `${originX}px`;
  burst.style.top = `${originY}px`;
  burst.setAttribute("aria-hidden", "true");

  for (let index = 0; index < pieces; index += 1) {
    const piece = document.createElement("span");
    const angle = (Math.PI * 2 * index) / pieces + (Math.random() - 0.5) * 0.45;
    const distance = 44 + Math.random() * 58;
    const size = 5 + Math.random() * 5;

    piece.style.setProperty("--x", `${Math.cos(angle) * distance}px`);
    piece.style.setProperty("--y", `${Math.sin(angle) * distance - 18}px`);
    piece.style.setProperty("--r", `${Math.random() * 260 - 130}deg`);
    piece.style.setProperty("--s", `${size}px`);
    piece.style.setProperty("--delay", `${Math.random() * 80}ms`);
    piece.style.background = colors[index % colors.length];
    burst.appendChild(piece);
  }

  document.body.appendChild(burst);
  window.setTimeout(() => burst.remove(), 900);
}

function createPortableData() {
  return {
    schemaVersion: DATA_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    app: "小宣的个人工作台",
    data: {
      theme: state.theme,
      view: state.view,
      creatorPlatform: state.creatorPlatform,
      today: state.today,
      dailyHistory: state.dailyHistory,
      week: state.week,
      weekHistory: state.weekHistory,
      links: state.links,
      ideas: state.ideas,
      creators: state.creators
    }
  };
}

function normalizeImportedState(payload) {
  const data = payload && payload.data ? payload.data : payload;
  if (!data || typeof data !== "object") return null;

  const nextState = {
    ...structuredClone(sampleState),
    theme: data.theme === "dark" ? "dark" : "light",
    view: viewMeta[data.view] ? data.view : "today",
    creatorPlatform: platformMeta[data.creatorPlatform] ? data.creatorPlatform : "xiaohongshu",
    today: normalizeList(data.today),
    dailyHistory: normalizeDailyHistory(data.dailyHistory),
    week: normalizeList(data.week),
    weekHistory: normalizeWeekHistory(data.weekHistory),
    links: normalizeLinks(data.links),
    ideas: normalizeList(data.ideas, false),
    creators: normalizeCreators(data.creators)
  };

  nextState.addKind = nextState.view;
  return nextState;
}

function normalizeList(value, hasDone = true) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item.title === "string")
    .map((item) => ({
      id: typeof item.id === "string" ? item.id : uid(),
      title: item.title,
      ...(hasDone ? { done: Boolean(item.done) } : {}),
      createdAt: Number.isFinite(item.createdAt) ? item.createdAt : Date.now(),
      ...(Number.isFinite(item.completedAt) ? { completedAt: item.completedAt } : {}),
      ...(isDateString(item.startDate) ? { startDate: item.startDate } : {}),
      ...(isDateString(item.endDate) ? { endDate: item.endDate } : {})
    }));
}

function normalizeLinks(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item.title === "string")
    .map((item) => ({
      id: typeof item.id === "string" ? item.id : uid(),
      title: item.title,
      url: typeof item.url === "string" ? item.url : "workspace://file",
      type: item.type === "link" ? "link" : "file",
      createdAt: Number.isFinite(item.createdAt) ? item.createdAt : Date.now()
    }));
}

function normalizeCreators(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item.title === "string")
    .map((item) => ({
      id: typeof item.id === "string" ? item.id : uid(),
      title: item.title,
      url: normalizeCreatorUrl(typeof item.url === "string" ? item.url : ""),
      platform: platformMeta[item.platform] ? item.platform : "xiaohongshu",
      createdAt: Number.isFinite(item.createdAt) ? item.createdAt : Date.now()
    }));
}

function normalizeCreatorUrl(value) {
  return normalizeOptionalUrl(value);
}

function normalizeOptionalUrl(value) {
  if (!value) return "";

  const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;

  try {
    return new URL(candidate).href;
  } catch {
    return "";
  }
}

function normalizeWeekHistory(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((archive) => archive && Array.isArray(archive.tasks))
    .map((archive) => ({
      id: typeof archive.id === "string" ? archive.id : uid(),
      label: typeof archive.label === "string" ? archive.label : "历史周",
      range: typeof archive.range === "string" ? archive.range : "",
      archivedAt: Number.isFinite(archive.archivedAt) ? archive.archivedAt : Date.now(),
      tasks: normalizeList(archive.tasks)
    }));
}

function normalizeDailyHistory(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((archive) => archive && Array.isArray(archive.tasks))
    .map((archive) => ({
      id: typeof archive.id === "string" ? archive.id : uid(),
      date: isDateString(archive.date) ? archive.date : getLocalDateString(new Date(archive.archivedAt || Date.now())),
      label: typeof archive.label === "string" ? archive.label : formatDailyHistoryLabel(archive.date),
      archivedAt: Number.isFinite(archive.archivedAt) ? archive.archivedAt : Date.now(),
      tasks: normalizeList(archive.tasks)
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const nextState = saved ? { ...structuredClone(sampleState), ...saved } : structuredClone(sampleState);
    if (!viewMeta[nextState.view]) nextState.view = "today";
    if (!platformMeta[nextState.creatorPlatform]) nextState.creatorPlatform = "xiaohongshu";
    if (saved && !Array.isArray(saved.weekHistory)) nextState.weekHistory = [];
    if (!Array.isArray(nextState.weekHistory)) nextState.weekHistory = [];
    if (saved && !Array.isArray(saved.dailyHistory)) nextState.dailyHistory = [];
    if (!Array.isArray(nextState.dailyHistory)) nextState.dailyHistory = [];
    if (!Array.isArray(nextState.creators)) nextState.creators = [];
    nextState.addKind = nextState.view;
    return nextState;
  } catch {
    return structuredClone(sampleState);
  }
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => {
    els.toast.classList.remove("is-visible");
  }, 1800);
}

function formatTime(timestamp) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(timestamp));
}

function formatTaskDateTime(timestamp) {
  const date = new Date(timestamp);
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${month}/${day} ${weekdays[date.getDay()]} ${hour}:${minute}`;
}

function formatDailyHistoryLabel(value) {
  const date = parseLocalDate(value) || startOfToday();
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${month}/${day} ${weekdays[date.getDay()]}`;
}

function getTaskMetaTime(group, item) {
  if (group === "today") return formatTaskDateTime(item.createdAt);
  if (group === "week" && item.startDate && item.endDate) {
    return `${formatDateString(item.startDate)} - ${formatDateString(item.endDate)}`;
  }

  return formatTime(item.createdAt);
}

function isBeforeToday(timestamp) {
  const date = new Date(timestamp);
  const today = new Date();

  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);

  return date < today;
}

function isWeekTaskOverdue(item) {
  return Boolean(item.endDate && !item.done && parseLocalDate(item.endDate) < startOfToday());
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(timestamp));
}

function formatDateString(value) {
  const date = parseLocalDate(value);
  if (!date) return "未排期";

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function getCurrentWeekRange() {
  const now = new Date();
  const day = now.getDay() || 7;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(now.getDate() - day + 1);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  return {
    label: `${start.getFullYear()} 年第 ${getISOWeek(start)} 周`,
    text: `${formatDate(start.getTime())} - ${formatDate(end.getTime())}`
  };
}

function getCurrentWeekDays() {
  const today = startOfToday();
  const day = today.getDay() || 7;
  const start = new Date(today);
  start.setDate(today.getDate() - day + 1);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);

    return {
      date,
      dateString: getLocalDateString(date),
      weekday: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"][index],
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      isToday: date.getTime() === today.getTime()
    };
  });
}

function getWeekTaskSchedule(item, days) {
  if (!isDateString(item.startDate) || !isDateString(item.endDate)) return null;

  const start = parseLocalDate(item.startDate);
  const end = parseLocalDate(item.endDate);
  if (!start || !end || start > end) return null;

  const weekStart = days[0].date;
  const weekEnd = days[6].date;
  if (end < weekStart || start > weekEnd) return null;

  const visibleStart = start < weekStart ? weekStart : start;
  const visibleEnd = end > weekEnd ? weekEnd : end;
  const startIndex = days.findIndex((day) => day.date.getTime() === visibleStart.getTime());
  const endIndex = days.findIndex((day) => day.date.getTime() === visibleEnd.getTime());

  if (startIndex < 0 || endIndex < 0) return null;

  return {
    start: startIndex,
    span: endIndex - startIndex + 1
  };
}

function startOfToday() {
  const today = new Date();
  return startOfDay(today);
}

function startOfDay(date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function getLocalDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalDate(value) {
  if (!isDateString(value)) return null;

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return date;
}

function isDateString(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function getISOWeek(date) {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil(((target - yearStart) / 86400000 + 1) / 7);
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
