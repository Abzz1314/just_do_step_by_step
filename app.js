const STORAGE_KEY = "one_step_state_v1";
const SETTINGS_KEY = "one_step_settings_v1";

const defaultState = {
  goal: "",
  steps: [],
  currentIndex: 0,
  completedTotal: 0,
  streak: 0,
  history: []
};

const fallbackOpeners = [
  "打开一个空白文档或备忘录，只写下这个任务的名字。",
  "花 3 分钟列出你现在最困惑的一个点，不需要解决它。",
  "找一个最容易开始的材料、链接或工具，把它放到眼前。",
  "把目标改写成一句可以今天完成的小动作。",
  "设置一个 8 分钟计时器，只做这一步，不评价成果。"
];

const state = loadJson(STORAGE_KEY, defaultState);
const settings = loadJson(SETTINGS_KEY, {
  apiKey: "",
  model: "deepseek-chat"
});

const els = {
  body: document.body,
  goalInput: document.querySelector("#goalInput"),
  mainAction: document.querySelector("#mainAction"),
  regenerateButton: document.querySelector("#regenerateButton"),
  stepTitle: document.querySelector("#stepTitle"),
  stepDetail: document.querySelector("#stepDetail"),
  panelEyebrow: document.querySelector("#panelEyebrow"),
  progressFill: document.querySelector("#progressFill"),
  progressText: document.querySelector("#progressText"),
  trailProgress: document.querySelector("#trailProgress"),
  trailDots: document.querySelector("#trailDots"),
  coachTip: document.querySelector("#coachTip"),
  coachCard: document.querySelector("#coachCard"),
  stepStamp: document.querySelector("#stepStamp"),
  paperBurst: document.querySelector("#paperBurst"),
  compareButton: document.querySelector("#compareButton"),
  settingsButton: document.querySelector("#settingsButton"),
  statsButton: document.querySelector("#statsButton"),
  shareButton: document.querySelector("#shareButton"),
  voiceButton: document.querySelector("#voiceButton"),
  settingsModal: document.querySelector("#settingsModal"),
  statsModal: document.querySelector("#statsModal"),
  apiKeyInput: document.querySelector("#apiKeyInput"),
  modelSelect: document.querySelector("#modelSelect"),
  saveSettingsButton: document.querySelector("#saveSettingsButton"),
  clearSettingsButton: document.querySelector("#clearSettingsButton"),
  doneCount: document.querySelector("#doneCount"),
  streakCount: document.querySelector("#streakCount"),
  statusSummary: document.querySelector("#statusSummary"),
  toast: document.querySelector("#toast")
};

els.goalInput.value = state.goal;
els.apiKeyInput.value = settings.apiKey;
els.modelSelect.value = settings.model;
render();

els.mainAction.addEventListener("click", handleMainAction);
els.regenerateButton.addEventListener("click", () => createPlan(true));
els.goalInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    handleMainAction();
  }
});
els.goalInput.addEventListener("input", () => {
  state.goal = els.goalInput.value.trim();
  saveState();
});
els.coachCard.addEventListener("click", () => openStats());
els.statsButton.addEventListener("click", () => openStats());
els.settingsButton.addEventListener("click", () => els.settingsModal.showModal());
els.compareButton.addEventListener("click", showBehaviorMirror);
els.voiceButton.addEventListener("click", () => showToast("语音入口先留好，下一版可以接入系统听写。"));
els.shareButton.addEventListener("click", copyCurrentStep);
els.saveSettingsButton.addEventListener("click", saveSettings);
els.clearSettingsButton.addEventListener("click", clearSettings);

async function handleMainAction() {
  if (!state.steps.length || state.currentIndex >= state.steps.length) {
    await createPlan(false);
    return;
  }

  completeCurrentStep();
}

async function createPlan(forceRegenerate) {
  const goal = els.goalInput.value.trim();
  if (!goal) {
    showToast("先写一句你想做的事。");
    els.goalInput.focus();
    return;
  }

  state.goal = goal;
  setLoading(true);

  try {
    const steps = settings.apiKey ? await askDeepSeekFromBrowser(goal) : buildLocalPlan(goal);
    state.steps = normalizeSteps(steps);
    state.currentIndex = 0;
    state.history = forceRegenerate ? state.history : [];
    state.streak = forceRegenerate ? state.streak : 0;
    showToast(settings.apiKey ? "DeepSeek 已拆好，先做最轻的一步。" : "演示模式已拆好，先动起来。");
  } catch (error) {
    console.warn(error);
    state.steps = buildLocalPlan(goal);
    state.currentIndex = 0;
    showToast("DeepSeek 暂时没连上，已切到本地演示。");
  } finally {
    setLoading(false);
    saveState();
    render();
  }
}

async function askDeepSeekFromBrowser(goal) {
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify({
      model: settings.model,
      temperature: 0.5,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "你是一个温柔但具体的行动拆解助手。根据目标的复杂度，自行决定拆成 3 到 8 个非常小、可在 5 到 20 分钟内开始的步骤。简单任务不要过度拆解，复杂任务可以拆得更细。输出 JSON：{\"steps\":[{\"title\":\"...\",\"detail\":\"...\"}]}"
        },
        {
          role: "user",
          content: `用户想做的事：${goal}`
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`DeepSeek error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "{}";
  const parsed = JSON.parse(content);
  return parsed.steps;
}

function buildLocalPlan(goal) {
  const seed = Math.abs(hashCode(goal));
  const opener = fallbackOpeners[seed % fallbackOpeners.length];
  const plan = [
    {
      title: "把目标写成一句话",
      detail: opener
    },
    {
      title: "圈出最小入口",
      detail: "只选一个不用等待别人、也不用做完美的小动作。"
    },
    {
      title: "准备眼前材料",
      detail: "打开需要的页面、文档或工具，让下一步不再需要寻找。"
    },
    {
      title: "做 8 分钟版本",
      detail: `针对「${goal}」只推进一个可见痕迹，比如一行草稿、一个清单或一个截图。`
    },
    {
      title: "留下下一步钩子",
      detail: "停止前写下下一次打开时要做的第一件事。"
    },
    {
      title: "补一个最小反馈",
      detail: "快速看一眼成果，记下一个需要调整的小地方。"
    },
    {
      title: "做一次轻量完善",
      detail: "只处理刚才记录的一个小地方，不扩展范围。"
    },
    {
      title: "保存今天的成果",
      detail: "把当前版本保存好，为下一次继续留下清晰入口。"
    }
  ];
  const stepCount = Math.min(8, Math.max(3, 3 + Math.floor(goal.length / 8)));
  return plan.slice(0, stepCount);
}

function normalizeSteps(steps) {
  const safeSteps = Array.isArray(steps) ? steps : [];
  return safeSteps
    .map((step, index) => ({
      title: String(step.title || `第 ${index + 1} 步`).slice(0, 36),
      detail: String(step.detail || "做一个很小、能马上开始的动作。").slice(0, 120)
    }))
    .slice(0, 8);
}

function completeCurrentStep() {
  const current = state.steps[state.currentIndex];
  if (!current) return;

  state.history.push({
    ...current,
    doneAt: new Date().toISOString()
  });
  state.currentIndex += 1;
  state.completedTotal += 1;
  state.streak += 1;
  playCompletionRitual();

  if (state.currentIndex >= state.steps.length) {
    showToast("这组步骤完成了，已经不是零进展了。");
  } else {
    showToast("很好，下一步已经变小了。");
  }

  saveState();
  render();
}

function render() {
  const total = state.steps.length;
  const done = Math.min(state.currentIndex, total);
  const current = state.steps[state.currentIndex];
  const percent = total ? (done / total) * 100 : 0;

  els.progressFill.style.width = `${percent}%`;
  els.progressText.textContent = `${done}/${total}`;
  els.trailProgress.style.width = `${percent}%`;
  els.doneCount.textContent = state.completedTotal;
  els.streakCount.textContent = state.streak;
  els.regenerateButton.hidden = !total || done >= total;
  renderRoute(done, total);

  if (!total) {
    els.panelEyebrow.textContent = "还没有开始";
    els.stepTitle.textContent = "先把脑子里的大事放下来";
    els.stepDetail.textContent = "输入一个目标，我会帮你拆成轻到可以动手的小步骤。";
    els.mainAction.textContent = "先做一步试试";
    els.coachTip.textContent = "点击我，查看「我的状态」";
    els.stepStamp.textContent = "GO";
    els.statusSummary.textContent = "你还没有开始，第一步会被设计得很轻。";
    return;
  }

  if (done >= total) {
    els.panelEyebrow.textContent = "今日完成";
    els.stepTitle.textContent = "已经完成一轮小步推进";
    els.stepDetail.textContent = "可以换一组更小的步骤，或者把刚才的成果继续往前推一点点。";
    els.mainAction.textContent = "再拆一个目标";
    els.coachTip.textContent = "你刚刚完成了一轮";
    els.stepStamp.textContent = "YES";
    els.statusSummary.textContent = `你围绕「${state.goal}」完成了 ${total} 个小步骤。`;
    return;
  }

  els.panelEyebrow.textContent = `第 ${done + 1} 步`;
  els.stepTitle.textContent = current.title;
  els.stepDetail.textContent = current.detail;
  els.mainAction.textContent = done === 0 ? "完成这一步" : "我做完了，下一步";
  els.coachTip.textContent = done ? `已经推进 ${done} 步` : "先做眼前这一小步";
  els.stepStamp.textContent = done ? `${done}` : "GO";
  els.statusSummary.textContent = `当前目标是「${state.goal}」，正在做第 ${done + 1} 步。`;
}

function renderRoute(done, total) {
  const progress = total ? done / total : 0;
  const visibleTotal = total || 4;

  if (els.trailDots.childElementCount !== visibleTotal) {
    els.trailDots.replaceChildren();
    for (let index = 0; index < visibleTotal; index += 1) {
      const dot = document.createElement("span");
      dot.className = "trail-dot";
      els.trailDots.appendChild(dot);
    }
  }

  [...els.trailDots.children].forEach((dot, index) => {
    const dotProgress = index / Math.max(visibleTotal - 1, 1);
    dot.classList.toggle("is-done", total > 0 && progress >= dotProgress);
    dot.classList.toggle("is-next", total > 0 && progress < dotProgress && progress >= dotProgress - 1 / visibleTotal);
  });
}

function playCompletionRitual() {
  els.coachCard.classList.remove("stamp-hit");
  els.stepStamp.classList.remove("stamp-drop");
  void els.coachCard.offsetWidth;
  els.coachCard.classList.add("stamp-hit");
  els.stepStamp.classList.add("stamp-drop");
  createPaperBurst();

  setTimeout(() => {
    els.coachCard.classList.remove("stamp-hit");
    els.stepStamp.classList.remove("stamp-drop");
  }, 720);
}

function createPaperBurst() {
  const colors = ["#e96b52", "#f5c04b", "#285e52", "#d6d0f0", "#b9ddd2"];
  els.paperBurst.replaceChildren();

  for (let index = 0; index < 18; index += 1) {
    const paper = document.createElement("i");
    paper.style.setProperty("--x", `${(index - 8.5) * 13}px`);
    paper.style.setProperty("--r", `${(index % 2 ? 1 : -1) * (45 + index * 13)}deg`);
    paper.style.setProperty("--delay", `${(index % 4) * 28}ms`);
    paper.style.background = colors[index % colors.length];
    els.paperBurst.appendChild(paper);
  }

  els.paperBurst.classList.remove("show");
  void els.paperBurst.offsetWidth;
  els.paperBurst.classList.add("show");
  setTimeout(() => els.paperBurst.classList.remove("show"), 900);
}

function showBehaviorMirror() {
  if (!state.goal) {
    showToast("先输入一个目标，我再帮你做对照。");
    return;
  }

  const current = state.steps[state.currentIndex];
  const message = current
    ? `大脑想要一下做完；我们现在只做「${current.title}」。`
    : "大脑想等准备完美；我们先让第一步小到没有压力。";
  showToast(message);
}

async function copyCurrentStep() {
  const current = state.steps[state.currentIndex];
  if (!current) {
    showToast("还没有可复制的步骤。");
    return;
  }

  const text = `我的下一步：${current.title}\n${current.detail}`;
  try {
    await navigator.clipboard.writeText(text);
    showToast("当前步骤已复制。");
  } catch {
    showToast(text);
  }
}

function openStats() {
  render();
  els.statsModal.showModal();
}

function saveSettings() {
  settings.apiKey = els.apiKeyInput.value.trim();
  settings.model = els.modelSelect.value;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  els.settingsModal.close();
  showToast(settings.apiKey ? "已保存 DeepSeek 设置。" : "已切回演示模式。");
}

function clearSettings() {
  settings.apiKey = "";
  els.apiKeyInput.value = "";
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  showToast("已清除本机保存的 Key。");
}

function setLoading(isLoading) {
  els.body.classList.toggle("loading", isLoading);
  els.mainAction.disabled = isLoading;
  els.regenerateButton.disabled = isLoading;
  els.mainAction.textContent = isLoading ? "正在拆成小步..." : els.mainAction.textContent;
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    els.toast.classList.remove("show");
  }, 2200);
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadJson(key, fallback) {
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(key)) };
  } catch {
    return { ...fallback };
  }
}

function hashCode(value) {
  return [...value].reduce((hash, char) => (hash << 5) - hash + char.charCodeAt(0), 0);
}
