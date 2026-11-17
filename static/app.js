"use strict";

const steps = ["选择或填写", "基本信息", "平台行为", "信用与额度", "确认资料"];
const englishSteps = ["Choose or enter", "Basic details", "Platform activity", "Credit and limit", "Review details"];
const labels = {
  identity_verified: "实名认证", age: "年龄", linked_card_type: "绑卡类型",
  account_age_months: "注册月数", device_stability: "设备稳定性",
  repayment_fulfilment_rate: "按时履约率", average_monthly_spending: "月均消费",
  completed_order_count: "完成订单数", consecutive_on_time_repayments: "连续按时还款次数",
  adverse_credit_incidents_6m: "近半年失信次数", current_credit_limit: "当前额度",
  available_credit_limit: "可用额度", external_credit_score: "外部信用分",
  external_overdue_record: "外部逾期记录"
};
const englishLabels = {
  identity_verified: "Identity verification", age: "Age", linked_card_type: "Linked card type",
  account_age_months: "Account age", device_stability: "Device stability",
  repayment_fulfilment_rate: "On-time repayment rate", average_monthly_spending: "Average monthly spending",
  completed_order_count: "Completed orders", consecutive_on_time_repayments: "Consecutive on-time repayments",
  adverse_credit_incidents_6m: "Adverse credit incidents (past 6 months)", current_credit_limit: "Current credit limit",
  available_credit_limit: "Available credit", external_credit_score: "External credit score",
  external_overdue_record: "External overdue record"
};
const ruleText = {
  "SR-01": "实名且绑定信用卡", "SR-02": "实名且绑定借记卡", "SR-03": "未绑定信用卡或借记卡（含仅绑预付卡）",
  "SR-04": "注册满 12 个月", "SR-05": "注册 6–11 个月", "SR-06": "注册不足 1 个月",
  "SR-07": "履约率达到 98%", "SR-08": "履约率 95%–98%", "SR-09": "履约率 90%–95%",
  "SR-10": "履约率低于 90%", "SR-11": "月均消费达到 2,000 元", "SR-12": "月均消费 1,000–2,000 元",
  "SR-13": "完成至少 100 笔订单", "SR-14": "完成 50–99 笔订单", "SR-15": "连续按时还款至少 6 次",
  "SR-16": "连续按时还款 3–5 次", "SR-17": "近半年有 1 次失信", "SR-18": "设备稳定",
  "SR-19": "近期设备有变化", "SR-20": "外部信用分至少 800", "SR-21": "外部信用分 550–799",
  "SR-22": "外部信用分 451–549", "SR-23": "轻微外部逾期", "SR-24": "中等外部逾期",
  "SR-25": "严重外部逾期", "SR-26": "确认无外部逾期", "SR-27": "额度使用率 40%–80%",
  "SR-28": "额度使用率低于 20%", "SR-29": "额度使用率高于 90%"
};
const hardText = {
  "HR-01": "实名认证未通过", "HR-02": "年龄低于 18 岁", "HR-03": "近半年失信次数达到 2 次，或该记录未取得",
  "HR-04": "设备状态异常", "HR-05": "外部信用分不高于 450，或未取得"
};
const englishRuleText = {
  "SR-01": "Verified identity and linked credit card", "SR-02": "Verified identity and linked debit card",
  "SR-03": "No credit or debit card linked (including prepaid only)", "SR-04": "Account age of at least 12 months",
  "SR-05": "Account age of 6–11 months", "SR-06": "Account age under 1 month",
  "SR-07": "On-time repayment rate of at least 98%", "SR-08": "On-time repayment rate of 95% to under 98%",
  "SR-09": "On-time repayment rate of 90% to under 95%", "SR-10": "On-time repayment rate below 90%",
  "SR-11": "Average monthly spending of at least CNY 2,000", "SR-12": "Average monthly spending of CNY 1,000 to under 2,000",
  "SR-13": "At least 100 completed orders", "SR-14": "50–99 completed orders",
  "SR-15": "At least 6 consecutive on-time repayments", "SR-16": "3–5 consecutive on-time repayments",
  "SR-17": "One adverse credit incident in the past 6 months", "SR-18": "Stable device",
  "SR-19": "Recent device change", "SR-20": "External credit score of at least 800",
  "SR-21": "External credit score of 550–799", "SR-22": "External credit score of 451–549",
  "SR-23": "Minor external overdue record", "SR-24": "Moderate external overdue record",
  "SR-25": "Serious external overdue record", "SR-26": "Confirmed no external overdue record",
  "SR-27": "Credit-limit utilisation of 40%–80%", "SR-28": "Credit-limit utilisation below 20%",
  "SR-29": "Credit-limit utilisation above 90%"
};
const englishHardText = {
  "HR-01": "Identity verification failed", "HR-02": "Applicant is under 18",
  "HR-03": "At least two adverse credit incidents in the past 6 months, or the record is unavailable",
  "HR-04": "Abnormal device status", "HR-05": "External credit score is 450 or lower, or unavailable"
};
const englishHardGoalLabels = {
  "HR-01": "Identity verified", "HR-02": "At least 18 years old",
  "HR-03": "Adverse-credit record available, with fewer than two incidents in the past 6 months",
  "HR-04": "Device status is not abnormal", "HR-05": "External credit score available and above 450"
};
const profiles = [
  {
    id: "fresh", title: "全新用户", titleEn: "New applicant", descriptor: "首次申请 · 正常资料", descriptorEn: "First application · standard profile",
    detail: "没有历史额度或还款记录，演示新用户审批路径。",
    data: { identity_verified: true, age: 23, linked_card_type: "Debit", account_age_months: 2,
      repayment_fulfilment_rate: null, average_monthly_spending: 650, completed_order_count: 8,
      consecutive_on_time_repayments: null, adverse_credit_incidents_6m: 0, device_stability: "Stable",
      current_credit_limit: null, available_credit_limit: null, external_credit_score: 650,
      external_overdue_record: "None" }
  },
  {
    id: "increase", title: "老用户想提额", titleEn: "Existing user seeking a higher limit", descriptor: "额度审核 · 可做目标诊断", descriptorEn: "Limit review · target diagnosis",
    detail: "当前额度 5,000 元，查看哪些单项或双项条件可能达到 10,000 元。",
    data: { identity_verified: true, age: 28, linked_card_type: "Credit", account_age_months: 8,
      repayment_fulfilment_rate: 0.99, average_monthly_spending: 2600, completed_order_count: 135,
      consecutive_on_time_repayments: 8, adverse_credit_incidents_6m: 0, device_stability: "Stable",
      current_credit_limit: 5000, available_credit_limit: 250, external_credit_score: 820,
      external_overdue_record: "None" }
  },
  {
    id: "risk", title: "信用风险较高", titleEn: "Higher credit risk", descriptor: "硬规则 · 一票否决", descriptorEn: "Hard rule · automatic rejection",
    detail: "外部信用分较低，演示硬规则如何覆盖软规则得分。",
    data: { identity_verified: true, age: 31, linked_card_type: "Credit", account_age_months: 18,
      repayment_fulfilment_rate: null, average_monthly_spending: 2400, completed_order_count: 110,
      consecutive_on_time_repayments: null, adverse_credit_incidents_6m: 0, device_stability: "Stable",
      current_credit_limit: null, available_credit_limit: null, external_credit_score: 430,
      external_overdue_record: "Moderate" }
  },
  {
    id: "sparse", title: "资料不完整的新用户", titleEn: "New applicant with missing data", descriptor: "信息覆盖率 · 额度封顶", descriptorEn: "Evidence coverage · limit cap",
    detail: "已知资料表现好，但平台消费和订单记录缺失。",
    data: { identity_verified: true, age: 28, linked_card_type: "Credit", account_age_months: 12,
      repayment_fulfilment_rate: null, average_monthly_spending: null, completed_order_count: null,
      consecutive_on_time_repayments: null, adverse_credit_incidents_6m: 0, device_stability: "Stable",
      current_credit_limit: null, available_credit_limit: null, external_credit_score: 820,
      external_overdue_record: "None" }
  }
];

const basicFields = [
  { key: "identity_verified", type: "select", label: "实名认证", required: true,
    options: [["true", "已通过"], ["false", "未通过"]] },
  { key: "age", type: "number", label: "年龄", required: true, min: 0, max: 120, step: 1, unit: "岁" },
  { key: "linked_card_type", type: "select", label: "绑卡类型", required: true,
    options: [["Credit", "信用卡"], ["Debit", "借记卡"], ["Prepaid", "预付卡"], ["None", "未绑卡"]] },
  { key: "account_age_months", type: "number", label: "平台注册时长", required: true, min: 0, step: 1, unit: "个月" },
  { key: "device_stability", type: "select", label: "设备稳定性", required: true,
    options: [["Stable", "稳定"], ["Changing", "近期有变化"], ["Abnormal", "异常"]] }
];
const behaviorFields = [
  { key: "average_monthly_spending", type: "number", label: "月均消费", min: 0, step: 0.01, unit: "元", hint: "留空表示未取得，不代表 0 元。" },
  { key: "completed_order_count", type: "number", label: "完成订单数", min: 0, step: 1, unit: "笔" },
  { key: "repayment_fulfilment_rate", type: "number", label: "按时履约率", min: 0, max: 100, step: 0.01, unit: "%", hint: "老用户适用；输入 98 表示 98%。" },
  { key: "consecutive_on_time_repayments", type: "number", label: "连续按时还款次数", min: 0, step: 1, unit: "次", hint: "老用户适用。" },
  { key: "adverse_credit_incidents_6m", type: "number", label: "近半年失信次数", min: 0, step: 1, unit: "次", hint: "填 0 表示确认无失信；留空表示未知。" }
];
const creditFields = [
  { key: "current_credit_limit", type: "number", label: "当前额度", min: 0, step: 0.01, unit: "元", hint: "新用户不适用。" },
  { key: "available_credit_limit", type: "number", label: "可用额度", min: 0, step: 0.01, unit: "元", hint: "不可高于当前额度。" },
  { key: "external_credit_score", type: "number", label: "外部信用分", min: 350, max: 950, step: 1, unit: "分", hint: "留空表示未取得。" },
  { key: "external_overdue_record", type: "select", label: "外部逾期记录", optional: true,
    options: [["", "未取得"], ["None", "确认无逾期"], ["Minor", "轻微"], ["Moderate", "中等"], ["Serious", "严重"]] }
];
const allFields = [...basicFields, ...behaviorFields, ...creditFields];
const emptyApplicant = Object.fromEntries(allFields.map(field => [field.key, null]));
const englishUnits = {
  age: "years", account_age_months: "months", average_monthly_spending: "CNY",
  completed_order_count: "orders", repayment_fulfilment_rate: "%",
  consecutive_on_time_repayments: "repayments", adverse_credit_incidents_6m: "incidents",
  current_credit_limit: "CNY", available_credit_limit: "CNY", external_credit_score: "points"
};
const englishHints = {
  average_monthly_spending: "Leave blank if unavailable; blank does not mean CNY 0.",
  repayment_fulfilment_rate: "Existing users only. Enter 98 for 98%.",
  consecutive_on_time_repayments: "Existing users only.",
  adverse_credit_incidents_6m: "Enter 0 only if no incidents are confirmed; leave blank if unknown.",
  current_credit_limit: "Not applicable to new applicants.",
  available_credit_limit: "Cannot exceed the current credit limit.",
  external_credit_score: "Leave blank if unavailable."
};
const englishOptions = {
  identity_verified: { true: "Verified", false: "Not verified" },
  linked_card_type: { Credit: "Credit card", Debit: "Debit card", Prepaid: "Prepaid card", None: "No card linked" },
  device_stability: { Stable: "Stable", Changing: "Recently changed", Abnormal: "Abnormal" },
  external_overdue_record: { "": "Unavailable", None: "Confirmed none", Minor: "Minor", Moderate: "Moderate", Serious: "Serious" }
};
const pageText = {
  zh: {
    title: "先用后付 · 专家系统演示", home: "返回首页", brandMark: "橙", brandName: "橙信",
    brandSub: "先用后付实验室", courseTag: "CDS521 · 课堂原型", languageChoice: "语言选择",
    headline: "从申请资料，到清晰的额度决定。",
    intro: "选择顶部虚构示例，或在下方手动填写用户信息。提交前可核对修改；系统会展示规则、CF 计算及最终额度。",
    batchShortcutAria: "跳转到批量规则测试", batchShortcutKicker: "批量规则测试 · 独立入口",
    batchShortcutTitle: "上传 CSV，快速查看 100 位用户的额度结果", batchShortcutAction: "前往批量测试 ↗",
    noticeTitle: "公开演示提醒",
    noticeBody: "请仅使用虚构测试数据，不要输入真实个人或征信资料。提交后，资料会发送至演示服务器即时计算；本程序不建立申请记录。",
    progressAria: "办理进度", progressTitle: "办理流程",
    journeyNote: "本页面仅供课程演示，不构成真实授信决定；请勿填写真实个人资料。",
    footerTech: "规则引擎 CLIPS · Python 集成", footerNotice: "课堂演示，不构成真实授信决定"
  },
  en: {
    title: "Buy Now, Pay Later · Expert System Demo", home: "Return to the home page", brandMark: "C",
    brandName: "Chengxin", brandSub: "Buy Now, Pay Later Lab", courseTag: "CDS521 · Classroom prototype",
    languageChoice: "Choose a language", headline: "From application details to a clear credit-limit decision.",
    intro: "Choose a fictional example above or enter an applicant's details below. Review and edit the information before submission; the system then shows the rules, CF calculation, and final limit.",
    batchShortcutAria: "Jump to batch rule testing", batchShortcutKicker: "Batch rule test · Separate workflow",
    batchShortcutTitle: "Upload a CSV to review limits for up to 100 fictional users", batchShortcutAction: "Go to batch test ↗",
    noticeTitle: "Public demo notice",
    noticeBody: "Use fictional test data only. Do not enter real personal or credit information. Submitted details are sent to the demo server for immediate evaluation; this application does not store applicant records.",
    progressAria: "Application progress", progressTitle: "Application steps",
    journeyNote: "For classroom demonstration only. This is not a real credit decision. Do not enter real personal information.",
    footerTech: "CLIPS rule engine · Python integration", footerNotice: "Classroom demo · Not a real credit decision"
  }
};
function savedLanguage() {
  try { return localStorage.getItem("chengxin-language") === "en" ? "en" : "zh"; }
  catch (_) { return "zh"; }
}

const state = {
  step: 0, selectedProfile: null, applicant: { ...emptyApplicant },
  mode: null, reviewBackStep: 0, result: null, diagnosis: null, targetLimit: null,
  returnToReview: false, busy: false, language: savedLanguage()
};
const content = document.getElementById("step-content");
const actions = document.getElementById("step-actions");
const errorBox = document.getElementById("form-error");

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}
function tr(zh, en) { return state.language === "en" ? en : zh; }
function labelFor(key) { return (state.language === "en" ? englishLabels : labels)[key] || key; }
function ruleFor(id, fallback) { return (state.language === "en" ? englishRuleText : ruleText)[id] || (state.language === "en" ? id : fallback); }
const worstCaseText = {
  "SR-10": ["履约率未取得，按最差情况计分（−0.50）", "Repayment rate unavailable; scored at its worst value (−0.50)"],
  "SR-25": ["外部逾期资料未取得，按最差情况计分（−0.70）", "External overdue record unavailable; scored at its worst value (−0.70)"]
};
function isWorstCase(id, gaps) { return (gaps || []).some(gap => gap.rule_id === id && gap.treatment === "worst-case"); }
function softRuleText(id, fallback, gaps) {
  if (isWorstCase(id, gaps) && worstCaseText[id]) return tr(worstCaseText[id][0], worstCaseText[id][1]);
  return ruleFor(id, fallback);
}
function hardFor(id, fallback) { return (state.language === "en" ? englishHardText : hardText)[id] || (state.language === "en" ? id : fallback); }
function money(value) { return Number(value).toLocaleString(state.language === "en" ? "en-US" : "zh-CN", { maximumFractionDigits: 2 }); }
function currency(value) { return tr(`${money(value)} 元`, `CNY ${money(value)}`); }
function currentMode() { return state.mode === "old" ? tr("老用户额度审核", "Existing-user limit review") : tr("新用户申请", "New application"); }
function showError(message) { errorBox.textContent = message; errorBox.hidden = false; }
function clearError() { errorBox.hidden = true; errorBox.textContent = ""; }
function scrollPanel() { document.querySelector(".panel").scrollIntoView({ behavior: "smooth", block: "start" }); }
function syncStaticLanguage() {
  const copy = pageText[state.language];
  document.documentElement.lang = state.language === "en" ? "en" : "zh-CN";
  document.title = copy.title;
  document.querySelectorAll("[data-i18n]").forEach(node => { node.textContent = copy[node.dataset.i18n]; });
  document.querySelectorAll("[data-i18n-aria]").forEach(node => { node.setAttribute("aria-label", copy[node.dataset.i18nAria]); });
  document.querySelectorAll("[data-language]").forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.language === state.language));
  });
}
function setLanguage(language) {
  if (state.language === language) return;
  captureDraft();
  state.language = language;
  try { localStorage.setItem("chengxin-language", language); } catch (_) { /* Storage may be unavailable. */ }
  syncStaticLanguage();
  window.dispatchEvent(new Event("chengxin-language-change"));
  render();
}
function captureDraft() {
  const form = document.getElementById("step-form");
  if (!form) return;
  const mode = form.querySelector("#application_mode");
  if (mode) state.mode = mode.value || null;
  for (const field of allFields) {
    const input = form.querySelector(`[data-field="${field.key}"]`);
    if (!input || input.disabled) continue;
    let value = input.value;
    if (value === "") value = null;
    else if (field.key === "identity_verified") value = value === "true";
    else if (field.type === "number") value = Number(value);
    if (field.key === "repayment_fulfilment_rate" && value !== null) value /= 100;
    state.applicant[field.key] = value;
  }
}
document.querySelectorAll("[data-language]").forEach(button => {
  button.addEventListener("click", () => setLanguage(button.dataset.language));
});
syncStaticLanguage();

function renderProgress() {
  const list = document.getElementById("progress-list");
  list.innerHTML = (state.language === "en" ? englishSteps : steps).map((label, index) => {
    const current = state.step === index;
    const done = state.step > index;
    return `<li class="progress-item ${current ? "is-current" : done ? "is-done" : ""}" ${current ? 'aria-current="step"' : ""}>
      <span class="progress-number">${done ? "✓" : index + 1}</span><span>${label}</span></li>`;
  }).join("");
  document.getElementById("step-count").textContent = state.step === 5
    ? tr("审批结果", "Decision result") : tr(`步骤 ${state.step + 1} / 5`, `Step ${state.step + 1} of 5`);
  const pill = document.getElementById("profile-pill");
  pill.hidden = state.step === 0;
  const profile = profiles.find(item => item.id === state.selectedProfile);
  pill.textContent = profile ? (state.language === "en" ? profile.titleEn : profile.title) : tr("自定义用户", "Custom applicant");
}

function renderProfileStep() {
  content.innerHTML = `<h2>${tr("选择情景，或直接填写资料", "Choose a scenario or enter details")}</h2>
    <p class="section-lead">${tr("上方情景可快速填入虚构示例；也可以从空白表单开始。填写后先核对，再提交评估。", "Use a fictional example to fill the form, or start with a blank form. Review the details before submitting them for evaluation.")}</p>
    <div class="preset-heading"><h3 class="minor-title">${tr("快捷示例", "Quick examples")}</h3><span>${tr("点击会覆盖下方尚未提交的输入", "Selecting an example replaces the unsubmitted form entries below")}</span></div>
    <div class="persona-grid">${profiles.map((profile, index) => `
      <button type="button" class="persona-card ${state.selectedProfile === profile.id ? "is-selected" : ""}"
        data-profile="${profile.id}" aria-pressed="${state.selectedProfile === profile.id}">
        <span class="persona-index">0${index + 1} · ${escapeHTML(state.language === "en" ? profile.descriptorEn : profile.descriptor)}</span>
        <span class="persona-title">${escapeHTML(state.language === "en" ? profile.titleEn : profile.title)}</span>
      </button>`).join("")}</div>
    <div class="manual-header"><div><h3>${tr("手动填写用户信息", "Enter applicant details manually")}</h3>
      <p>${tr("留空的可选字段表示“未取得”，不等于 0 或“确认无逾期”。请仅使用虚构测试资料。", "A blank optional field means unavailable, not zero or confirmed no overdue record. Use fictional test data only.")}</p></div>
      <span class="manual-count">${tr(`共 ${allFields.length} 个字段`, `${allFields.length} fields`)}</span></div>
    <form id="step-form" class="manual-form" novalidate>
      <div class="field manual-mode"><label class="field-label" for="application_mode">${tr("申请类型", "Application type")} <small>${tr("必选", "Required")}</small></label>
        <select id="application_mode" required><option value="" ${state.mode === null ? "selected" : ""}>${tr("请选择申请类型", "Select an application type")}</option>
          <option value="new" ${state.mode === "new" ? "selected" : ""}>${tr("新用户申请", "New application")}</option>
          <option value="old" ${state.mode === "old" ? "selected" : ""}>${tr("老用户额度审核", "Existing-user limit review")}</option></select>
        <span class="field-help">${tr("老用户需填写当前额度和可用额度；新用户不适用还款与已有额度字段。", "Existing users must enter their current and available credit limits. Repayment history and existing-limit fields do not apply to new applicants.")}</span></div>
      <section class="manual-section"><h4>${tr("01 基本信息", "01 Basic details")}</h4><div class="form-grid">${basicFields.map(field => fieldHTML(field, true)).join("")}</div></section>
      <section class="manual-section"><h4>${tr("02 平台行为", "02 Platform activity")}</h4><div class="form-grid">${behaviorFields.map(field => fieldHTML(field, true)).join("")}</div></section>
      <section class="manual-section"><h4>${tr("03 信用与额度", "03 Credit and limit")}</h4><div class="form-grid">${creditFields.map(field => fieldHTML(field, true)).join("")}</div></section>
    </form>`;
  content.querySelectorAll("[data-profile]").forEach(button => button.addEventListener("click", () => {
    const profile = profiles.find(item => item.id === button.dataset.profile);
    state.selectedProfile = profile.id;
    state.applicant = { ...profile.data };
    state.mode = profile.data.current_credit_limit === null ? "new" : "old";
    render();
  }));
  const markCustom = () => {
    if (state.selectedProfile === null) return;
    state.selectedProfile = null;
    content.querySelectorAll("[data-profile]").forEach(button => {
      button.classList.remove("is-selected");
      button.setAttribute("aria-pressed", "false");
    });
  };
  const modeSelect = document.getElementById("application_mode");
  const updateModeFields = () => {
    const old = modeSelect.value === "old";
    for (const key of ["repayment_fulfilment_rate", "consecutive_on_time_repayments",
                       "current_credit_limit", "available_credit_limit"]) {
      document.getElementById(key).disabled = !old;
    }
    for (const key of ["current_credit_limit", "available_credit_limit"]) {
      document.getElementById(key).required = old;
    }
  };
  updateModeFields();
  modeSelect.addEventListener("change", () => {
    state.mode = modeSelect.value || null;
    markCustom();
    updateModeFields();
  });
  document.getElementById("step-form").addEventListener("input", markCustom);
  document.getElementById("step-form").addEventListener("change", markCustom);
  actions.innerHTML = `<span class="muted hint-small">${tr("填写后先核对资料，不会直接运行审批", "You will review the details before the evaluation runs.")}</span>
    <button type="button" class="button button-primary action-right" id="next-button">${tr("下一步：核对资料", "Next: review details")} <span aria-hidden="true">→</span></button>`;
  document.getElementById("next-button").addEventListener("click", () => {
    if (!saveForm(allFields, true)) return;
    state.reviewBackStep = 0;
    navigate(4);
  });
}

function fieldHTML(config, manual = false) {
  const value = state.applicant[config.key];
  const uiValue = value === null || value === undefined ? "" :
    config.key === "repayment_fulfilment_rate" ? String(Math.round(value * 10000) / 100) : String(value);
  const required = config.required ? "required" : "";
  let control;
  if (config.type === "select") {
    const choices = manual && config.required ? [["", "请选择"], ...config.options] : config.options;
    const options = choices.map(([optionValue, label]) =>
      `<option value="${escapeHTML(optionValue)}" ${uiValue === optionValue ? "selected" : ""}>${escapeHTML(state.language === "en" ? (optionValue === "" && config.required ? "Select an option" : englishOptions[config.key]?.[optionValue] || label) : label)}</option>`).join("");
    control = `<select id="${config.key}" data-field="${config.key}" ${required}>${options}</select>`;
  } else {
    const min = config.min === undefined ? "" : `min="${config.min}"`;
    const max = config.max === undefined ? "" : `max="${config.max}"`;
    control = `<input id="${config.key}" data-field="${config.key}" type="number" inputmode="decimal"
      value="${escapeHTML(uiValue)}" ${min} ${max} step="${config.step || "any"}" ${required} placeholder="${tr("未取得", "Unavailable")}">`;
  }
  const label = state.language === "en" ? labelFor(config.key) : config.label;
  const unit = state.language === "en" ? (englishUnits[config.key] || (config.required ? "Required" : "Optional"))
    : (config.unit || (config.required ? "必填" : "可选"));
  const hint = state.language === "en" ? englishHints[config.key] : config.hint;
  return `<div class="field"><label class="field-label" for="${config.key}">${escapeHTML(label)}
      <small>${escapeHTML(unit)}</small></label>${control}
    ${hint ? `<span class="field-help">${escapeHTML(hint)}</span>` : ""}</div>`;
}

function renderFormStep(step) {
  const config = {
    1: { title: tr("先确认基本信息", "Review the basic details"), lead: tr("身份、年龄和设备状态会参与硬规则判断。", "Identity, age, and device status are checked against the hard rules."), fields: basicFields },
    2: { title: tr("查看平台行为", "Review platform activity"), lead: tr("消费与订单表现参与软规则；老用户的还款历史也在此填写。", "Spending and orders contribute to soft-rule scores. Existing users can also enter repayment history here."), fields: behaviorFields },
    3: { title: tr("补充信用与额度", "Review credit and limit details"), lead: tr("外部信用和现有额度会影响审批及提额判断。", "External credit information and existing limits affect approval and limit reviews."), fields: creditFields }
  }[step];
  const modeControl = step === 1 ? `<div class="field span-2">
    <label class="field-label" for="application_mode">${tr("申请类型", "Application type")} <small>${tr("影响适用规则", "Determines applicable rules")}</small></label>
    <select id="application_mode"><option value="new" ${state.mode === "new" ? "selected" : ""}>${tr("新用户申请", "New application")}</option>
      <option value="old" ${state.mode === "old" ? "selected" : ""}>${tr("老用户额度审核", "Existing-user limit review")}</option></select></div>` : "";
  const banner = step === 3 ? `<div class="mode-banner"><strong>${currentMode()}</strong>
    <span>${state.mode === "new"
      ? tr("新用户的当前额度、可用额度应为空；系统会根据资料计算首批额度。", "Leave current and available credit limits blank for new applicants. The system will calculate an initial limit.")
      : tr("老用户需提供当前额度与可用额度，系统会判断维持、增加或降低。", "Existing users must provide both credit-limit fields. The system will determine whether to retain, increase, or reduce the limit.")}</span></div>` : "";
  content.innerHTML = `<h2>${config.title}</h2><p class="section-lead">${config.lead}</p>${banner}
    <form id="step-form" novalidate><div class="form-grid">${modeControl}${config.fields.map(fieldHTML).join("")}</div></form>`;
  if (step === 1) {
    document.getElementById("application_mode").addEventListener("change", event => {
      state.mode = event.target.value;
      if (state.mode === "new") {
        state.applicant.current_credit_limit = null;
        state.applicant.available_credit_limit = null;
        state.applicant.repayment_fulfilment_rate = null;
        state.applicant.consecutive_on_time_repayments = null;
      }
    });
  }
  if (step === 3) {
    for (const key of ["current_credit_limit", "available_credit_limit"]) {
      document.getElementById(key).disabled = state.mode === "new";
    }
  }
  if (step === 2 && state.mode === "new") {
    for (const key of ["repayment_fulfilment_rate", "consecutive_on_time_repayments"]) {
      document.getElementById(key).disabled = true;
    }
  }
  actions.innerHTML = `<button type="button" class="button button-secondary" id="back-button">← ${tr("返回", "Back")}</button>
    <button type="button" class="button button-primary action-right" id="next-button">${state.returnToReview ? tr("保存并返回确认", "Save and return to review") : tr("下一步", "Next")} →</button>`;
  document.getElementById("back-button").addEventListener("click", () => {
    if (state.returnToReview) { state.returnToReview = false; navigate(4); }
    else navigate(step - 1);
  });
  document.getElementById("next-button").addEventListener("click", () => {
    if (!saveForm(config.fields)) return;
    if (state.returnToReview && state.mode === "old" &&
        (state.applicant.current_credit_limit === null || state.applicant.available_credit_limit === null)) {
      navigate(3);
    } else if (state.returnToReview) { state.returnToReview = false; navigate(4); }
    else navigate(step + 1);
  });
}

function saveForm(fields, manual = false) {
  const form = document.getElementById("step-form");
  if (manual && state.mode === null) { showError(tr("请先选择新用户申请或老用户额度审核。", "Select a new application or an existing-user limit review first.")); return false; }
  if (!form.reportValidity()) { showError(tr("请检查必填项及数值范围。", "Check the required fields and allowed number ranges.")); return false; }
  const next = { ...state.applicant };
  for (const field of fields) {
    const input = document.getElementById(field.key);
    if (input.disabled) continue;
    let value = input.value;
    if (field.key === "identity_verified") value = value === "true";
    else if (field.type === "number") value = value.trim() === "" ? null : Number(value);
    else if (field.optional && value === "") value = null;
    if (field.key === "repayment_fulfilment_rate" && value !== null) value /= 100;
    next[field.key] = value;
  }
  if ((manual || state.step === 1) && state.mode === "new") {
    next.current_credit_limit = null;
    next.available_credit_limit = null;
    next.repayment_fulfilment_rate = null;
    next.consecutive_on_time_repayments = null;
  }
  if ((manual || state.step === 3) && state.mode === "old") {
    if (next.current_credit_limit === null || next.available_credit_limit === null) {
      showError(tr("老用户必须同时填写当前额度和可用额度。", "Existing users must enter both the current and available credit limits.")); return false;
    }
    if (next.available_credit_limit > next.current_credit_limit) {
      showError(tr("可用额度不能高于当前额度。", "Available credit cannot exceed the current credit limit.")); return false;
    }
  }
  state.applicant = next;
  clearError();
  return true;
}

function displayValue(key, value) {
  if (value === null || value === undefined) return tr("未取得／不适用", "Unavailable / not applicable");
  if (key === "identity_verified") return value ? tr("已通过", "Verified") : tr("未通过", "Not verified");
  if (englishOptions[key]) return state.language === "en" ? englishOptions[key][value] || value :
    ({ linked_card_type: { Credit: "信用卡", Debit: "借记卡", Prepaid: "预付卡", None: "未绑卡" },
       device_stability: { Stable: "稳定", Changing: "近期有变化", Abnormal: "异常" },
       external_overdue_record: { None: "确认无逾期", Minor: "轻微", Moderate: "中等", Serious: "严重" } })[key]?.[value] || value;
  if (key === "repayment_fulfilment_rate") return `${Math.round(value * 10000) / 100}%`;
  if (state.language === "en") {
    if (["average_monthly_spending", "current_credit_limit", "available_credit_limit"].includes(key)) return currency(value);
    const unit = englishUnits[key];
    return `${money(value)}${unit ? ` ${unit}` : ""}`;
  }
  const unit = ({ age: " 岁", account_age_months: " 个月", average_monthly_spending: " 元",
    completed_order_count: " 笔", consecutive_on_time_repayments: " 次",
    adverse_credit_incidents_6m: " 次", current_credit_limit: " 元",
    available_credit_limit: " 元", external_credit_score: " 分" })[key] || "";
  return `${money(value)}${unit}`;
}
function reviewGroup(title, fields, editStep) {
  return `<div class="review-section"><div class="review-heading"><h3>${title}</h3>
    <button type="button" class="text-button" data-edit-step="${editStep}">${tr("修改这部分", "Edit this section")}</button></div>
    <div class="review-grid">${fields.map(field => `<div class="review-item"><span>${escapeHTML(labelFor(field.key))}</span>
      <strong>${escapeHTML(displayValue(field.key, state.applicant[field.key]))}</strong></div>`).join("")}</div></div>`;
}

function renderReview() {
  content.innerHTML = `<h2>${tr("提交前，再核对一次", "Review before submitting")}</h2>
    <p class="section-lead">${tr(`当前为${currentMode()}。可点击各部分的“修改”返回编辑；只有点击提交后才会运行规则。`, `Application type: ${currentMode()}. Use “Edit this section” to make changes. The rules run only after you submit.`)}</p>
    ${reviewGroup(tr("基本信息", "Basic details"), basicFields, 1)}
    ${reviewGroup(tr("平台行为", "Platform activity"), behaviorFields, 2)}
    ${reviewGroup(tr("信用与额度", "Credit and limit"), creditFields, 3)}
    <p class="consent-line">${tr("提示：外部逾期“确认无逾期”和“未取得”含义不同；请按所设测试情景选择。", "Note: “Confirmed none” and “Unavailable” mean different things for external overdue records. Choose the value that fits your test scenario.")}</p>`;
  content.querySelectorAll("[data-edit-step]").forEach(button => button.addEventListener("click", () => {
    state.returnToReview = true;
    navigate(Number(button.dataset.editStep));
  }));
  actions.innerHTML = `<button type="button" class="button button-secondary" id="back-button">← ${tr("返回修改", "Back to edit")}</button>
    <button type="button" class="button button-primary action-right" id="submit-button">${tr("提交并查看结果", "Submit and view result")} →</button>`;
  document.getElementById("back-button").addEventListener("click", () => navigate(state.reviewBackStep));
  document.getElementById("submit-button").addEventListener("click", submitApplicant);
}

function formatPercent(value) { return value === null ? "—" : `${Math.round(value * 10000) / 100}%`; }
function resultDecision(result) {
  if (result.hard_decision && result.decision === "rejected") return tr("硬规则拒绝", "Rejected by a hard rule");
  if (result.decision === "suspended") return tr("硬规则暂停", "Suspended by a hard rule");
  if (result.decision === "rejected") return tr("未获批", "Not approved");
  if (result.decision === "conditional-approval") return tr("有条件批准", "Conditionally approved");
  return tr("审批通过", "Approved");
}
function renderResult() {
  const result = state.result;
  const negative = result.approved_limit === 0;
  const trace = result.hard_decision
    ? `<div class="explain-row"><strong>${escapeHTML(result.hard_decision.rule_id)}</strong><span>${escapeHTML(hardFor(result.hard_decision.rule_id, result.hard_decision.reason))}${tr("。硬规则优先，额度归零。", ". Hard rules take precedence, so the limit is CNY 0.")}</span></div>`
    : `<div class="metric-row">
        <div class="metric"><label>${tr("最终 CF", "Final CF")}</label><strong>${result.combined_cf.toFixed(4)}</strong></div>
        <div class="metric"><label>${tr("原始 CF / 适用满分", "Raw CF / applicable maximum")}</label><strong>${result.raw_cf_sum.toFixed(2)} / ${result.applicable_positive_cf_max.toFixed(2)}</strong></div>
        <div class="metric"><label>${tr("信息覆盖率", "Evidence coverage")}</label><strong>${formatPercent(result.evidence_coverage)}</strong></div>
      </div>
      ${result.tier_cap ? `<div class="explain-row"><strong>${escapeHTML(result.tier_cap.rule_id)}</strong><span>${tr(`CF 对应额度 ${currency(result.cf_based_limit)}；信息覆盖率最高允许 ${currency(result.tier_cap.maximum_limit)}。${result.cap_applied ? "本次已触发封顶。" : "本次未压低额度。"}`, `The CF-based limit is ${currency(result.cf_based_limit)}. Evidence coverage allows at most ${currency(result.tier_cap.maximum_limit)}. ${result.cap_applied ? "The cap reduced this result." : "The cap did not reduce this result."}`)}</span></div>` : ""}
      <div class="divider"></div><h3 class="minor-title">${tr("本次触发的软规则", "Soft rules triggered")}</h3>
      ${result.triggered_soft_rules.length ? `<ul class="rules-list">${result.triggered_soft_rules.map(rule => `
        <li><span class="rule-id">${escapeHTML(rule.rule_id)}</span><span>${escapeHTML(softRuleText(rule.rule_id, rule.reason, result.data_gaps))}</span>
        <span class="rule-cf ${rule.cf < 0 ? "negative" : ""}">${rule.cf > 0 ? "+" : ""}${rule.cf.toFixed(2)}</span></li>`).join("")}</ul>` : `<p class="muted">${tr("本次没有软规则贡献。", "No soft rule contributed to this result.")}</p>`}`;
  content.innerHTML = `<h2>${tr("规则已完成评估", "Evaluation complete")}</h2><p class="section-lead">${tr("结果来自当前输入与课堂规则库，可返回修改资料重新计算。", "This result is based on the submitted details and the classroom rule base. You can edit the details and recalculate.")}</p>
    <div class="result-head"><div><div class="result-kicker">${tr("最终额度 · CNY", "Final credit limit")}</div>
      <div class="result-value">${state.language === "en" ? `<span>CNY</span> ${money(result.approved_limit)}` : `${money(result.approved_limit)} <span>元</span>`}</div></div>
      <span class="decision-badge ${negative ? "is-negative" : ""}">${resultDecision(result)}</span></div>
    ${trace}
    <div class="diagnosis-panel"><h3 class="minor-title">${tr("目标额度诊断", "Target-limit diagnosis")}</h3>
      <p class="section-lead">${tr("选择期望额度，查看目前的阻断因素。先测试单项变化；若单项不足，再测试两项条件同时变化。其他资料保持不变；模拟不是当前达标状态或提额承诺，履约率、月均消费和外部信用分变化属于假设情景。", "Choose a target limit to see what currently blocks it. The system tests one change at a time, then pairs of changes if needed. All other details stay the same. These simulations do not mean the target is already met or promise a future increase. Changes in repayment rate, monthly spending, and external credit score are hypothetical.")}</p>
      <div class="diagnosis-toolbar"><label for="target-limit">${tr("目标额度", "Target limit")}</label>
        <select id="target-limit">${[1000, 5000, 10000].map(limit => `<option value="${limit}" ${limit === (state.targetLimit ?? (result.approved_limit === 1000 ? 1000 : 10000)) ? "selected" : ""}>${currency(limit)}</option>`).join("")}</select>
        <button type="button" class="button button-secondary" id="diagnose-button">${tr("查看诊断", "View diagnosis")}</button></div>
      <div id="diagnosis-output" class="diagnosis-output" aria-live="polite"></div></div>`;
  actions.innerHTML = `<button type="button" class="button button-secondary" id="edit-button">← ${tr("修改资料并重算", "Edit details and recalculate")}</button>
    <button type="button" class="button button-quiet action-right" id="restart-button">${tr("重新填写或选择示例", "Start over or choose an example")}</button>`;
  document.getElementById("edit-button").addEventListener("click", () => navigate(4));
  document.getElementById("restart-button").addEventListener("click", () => {
    Object.assign(state, {
      selectedProfile: null, applicant: { ...emptyApplicant }, mode: null, reviewBackStep: 0,
      result: null, diagnosis: null, targetLimit: null, returnToReview: false
    });
    navigate(0);
  });
  document.getElementById("target-limit").addEventListener("change", event => {
    state.targetLimit = Number(event.target.value);
    state.diagnosis = null;
    document.getElementById("diagnosis-output").textContent = "";
  });
  document.getElementById("diagnose-button").addEventListener("click", runDiagnosis);
  if (state.diagnosis) renderDiagnosis(state.diagnosis);
}

function renderDiagnosis(diagnosis) {
  const output = document.getElementById("diagnosis-output");
  if (!output) return;
  const tree = diagnosis.goal_proof_tree;
  const statusText = state.language === "en"
    ? { satisfied: "Met", unsatisfied: "Not met", unknown: "Unknown",
        "not-applicable": "Not applicable", "not-evaluated": "Not evaluated",
        supporting: "Positive", opposing: "Negative", neutral: "Neutral" }
    : { satisfied: "已满足", unsatisfied: "未满足", unknown: "资料未知",
        "not-applicable": "不适用", "not-evaluated": "未评估", supporting: "加分",
        opposing: "扣分", neutral: "中性" };
  const badge = status => `<span class="proof-status proof-${status}">${statusText[status] || escapeHTML(status)}</span>`;
  const branchLabel = node => state.language === "en" ? ({
    "SG-1": "No hard rule triggered", "SG-2": "Evidence coverage permits the target tier",
    "SG-3": "CF meets the target threshold"
  })[node.id] || node.id : node.label;
  const branchReason = node => {
    if (state.language !== "en") return node.reason || "";
    if (node.id === "SG-1") return node.status === "unsatisfied"
      ? "Hard rules take precedence; soft-rule gains cannot override them. A missing hard-rule field also counts as failed."
      : "All fields the hard rules need are available, and no red line is triggered.";
    if (node.id === "SG-2") {
      if (node.status === "not-evaluated") return "A hard rule blocked the application, so the evidence cap was not assessed.";
      return "Missing fields must be filled with genuine information. Doing so does not guarantee that the CF threshold will be met.";
    }
    if (node.status === "not-evaluated") return "A hard rule blocked the application, so CF was not calculated.";
    return "Soft-rule contributions are normalised by the applicable maximum. CLIPS is run again after a condition changes.";
  };
  const leafLabel = leaf => {
    if (leaf.id.startsWith("SR-") && isWorstCase(leaf.id, diagnosis.data_gaps)) return softRuleText(leaf.id, leaf.label, diagnosis.data_gaps);
    if (state.language !== "en") return leaf.id.startsWith("SR-") ? (ruleText[leaf.id] || leaf.label) : (labels[leaf.id] || leaf.label);
    if (leaf.id.startsWith("SR-")) return englishRuleText[leaf.id] || leaf.id;
    return englishHardGoalLabels[leaf.id] || englishLabels[leaf.id] || leaf.id;
  };
  const leafValue = leaf => {
    if (leaf.id.startsWith("SR-")) return `CF ${leaf.current_value > 0 ? "+" : ""}${leaf.current_value.toFixed(2)}`;
    if (leaf.current_value === null || leaf.current_value === undefined) return tr("未取得", "Unavailable");
    if (typeof leaf.current_value === "boolean") return leaf.current_value ? tr("是", "Yes") : tr("否", "No");
    if (leaf.id === "HR-04") return tr(({ Stable: "稳定", Changing: "近期有变化", Abnormal: "异常" })[leaf.current_value] || leaf.current_value,
      englishOptions.device_stability[leaf.current_value] || leaf.current_value);
    if (englishLabels[leaf.id]) return displayValue(leaf.id, leaf.current_value);
    return String(leaf.current_value);
  };
  const changeText = change => {
    if (state.language !== "en") return change.description;
    const value = change.to;
    return ({
      account_age_months: () => `Account age reaches ${value} months`,
      completed_order_count: () => `Completed orders reach ${value}`,
      average_monthly_spending: () => `Assumed average monthly spending reaches ${currency(value)}`,
      external_credit_score: () => `Assumed external credit score reaches ${value}`,
      repayment_fulfilment_rate: () => `Assumed on-time repayment rate reaches ${Math.round(value * 100)}%`,
      consecutive_on_time_repayments: () => `Consecutive on-time repayments reach ${value}`,
      available_credit_limit: () => "Outstanding balance is repaid until credit-limit utilisation is 80% or lower"
    })[change.field]?.() || `${labelFor(change.field)} reaches ${value}`;
  };
  const diagnosisConclusion = () => {
    if (state.language !== "en") return diagnosis.conclusion || diagnosis.message;
    if (diagnosis.status === "blocked-by-hard-rule") return "A hard rule is triggered. The current limit is CNY 0; soft-rule gains cannot override it.";
    if (diagnosis.status === "goal-achieved") return `The current approved limit already reaches ${currency(diagnosis.target_limit)}. No improvements are needed.`;
    if (diagnosis.status === "blocked-by-evidence-cap") return `Current evidence coverage caps the limit at ${currency(diagnosis.tier_cap.maximum_limit)}. Provide genuine missing information and reassess; meeting the coverage requirement alone does not guarantee a higher limit.`;
    const first = (diagnosis.improvement_paths || [])[0];
    if (first) return `One tested path requires the following change${first.changes.length === 1 ? "" : "s"}: ${first.changes.map(change => changeText(change)).join("; ")}. With all other details unchanged, reassessment under the current rules would reach a simulated limit of ${currency(first.simulated_limit)}. This is not a guarantee of an actual increase.`;
    return "None of the tested one- or two-field changes reaches the target. Other paths may still be possible.";
  };
  const proof = tree ? `<section class="proof-panel"><h4 class="minor-title">${tr("目标证明树", "Target proof tree")}</h4>
    <div class="proof-root"><span>${tr(`目标：批准额度达到 ${currency(tree.required_value)}`, `Goal: approved limit of at least ${currency(tree.required_value)}`)}</span>${badge(tree.status)}</div>
    <div class="proof-branches">${tree.children.map(node => {
      const metric = node.id === "SG-2" && typeof node.current_value === "number"
        ? tr(`当前覆盖率 ${formatPercent(node.current_value)} · 门槛 ${formatPercent(node.required_value)}`, `Current coverage ${formatPercent(node.current_value)} · required ${formatPercent(node.required_value)}`)
        : node.id === "SG-3" && typeof node.current_value === "number"
          ? tr(`当前 CF ${node.current_value.toFixed(4)} · 门槛 ${node.required_value.toFixed(2)} · 原始 CF 差额 ${node.raw_cf_gap.toFixed(4)}`, `Current CF ${node.current_value.toFixed(4)} · required ${node.required_value.toFixed(2)} · raw CF gap ${node.raw_cf_gap.toFixed(4)}`)
          : "";
      return `<details class="proof-branch"><summary><span>${escapeHTML(branchLabel(node))}</span>${badge(node.status)}</summary>
        <div class="proof-detail"><p>${escapeHTML(branchReason(node))}${metric ? `<br>${escapeHTML(metric)}` : ""}</p>
        ${node.children.length ? `<ul>${node.children.map(leaf => `<li><span>${escapeHTML(leafLabel(leaf))}</span>
          <span class="proof-leaf-meta">${escapeHTML(leafValue(leaf))} · ${statusText[leaf.status] || leaf.status}</span></li>`).join("")}</ul>` : ""}</div></details>`;
    }).join("")}</div></section>` : "";
  const paths = diagnosis.improvement_paths || [];
  const failedSingles = (diagnosis.single_change_scenarios || []).filter(item => !item.reaches_goal);
  output.innerHTML = `<div class="goal-summary ${paths.length ? "has-path" : ""}"><span class="goal-kicker">${tr("目标额度结论", "Target-limit conclusion")}</span>
    <p>${escapeHTML(diagnosisConclusion())}</p></div>${proof}
    ${diagnosis.status === "blocked-by-evidence-cap" ? `<p class="diagnosis-note">${tr("缺失资料：", "Missing information: ")}${escapeHTML((diagnosis.missing_evidence_fields || []).map(labelFor).join(tr("、", ", ")) || tr("无", "none"))}${tr("。证明树同时显示 CF 是否还存在差距。", ". The proof tree also shows whether there is a CF shortfall.")}</p>` : ""}
    ${paths.length ? `<section class="path-section"><h4 class="minor-title">${tr("满足条件后可达到的模拟方案", "Simulated paths to the target")}</h4>
      <div class="scenario-list">${paths.map(path => `<div class="scenario is-success"><span>${path.changes.map(change => escapeHTML(changeText(change))).join(tr(" ＋ ", " + "))}
        <br><span class="muted">${path.assumption_type === "hypothetical" ? tr("含假设情景 · ", "Includes hypothetical changes · ") : tr("条件性模拟 · ", "Conditional simulation · ")}${tr("CLIPS 重算 CF", "CLIPS recalculated CF")} ${path.simulated_cf.toFixed(4)} · ${tr("模拟额度", "simulated limit")} ${currency(path.simulated_limit)}</span></span>
        <strong>${tr("条件成立时可达", "Reachable if conditions hold")}</strong></div>`).join("")}</div></section>` : ""}
    ${failedSingles.length ? `<details class="failed-scenarios"><summary>${tr(`查看 ${failedSingles.length} 项已测试但单独不足的条件`, `View ${failedSingles.length} tested conditions that are insufficient on their own`)}</summary>
      <div class="scenario-list">${failedSingles.map(item => `<div class="scenario"><span>${escapeHTML(changeText(item))}<br><span class="muted">${tr("模拟 CF", "Simulated CF")} ${item.simulated_cf.toFixed(4)} · ${tr("额度", "limit")} ${currency(item.simulated_limit)}</span></span><strong>${tr("单独不足", "Insufficient alone")}</strong></div>`).join("")}</div></details>` : ""}
    <p class="diagnosis-note">${tr("所有改善结果均以其他资料保持不变为前提，属于条件性规则模拟，不代表当前已获批或保证未来提额；搜索范围限于单项及双项变化。", "Every improvement path is a conditional rule simulation with all other details held constant. It does not mean the target is already approved or guarantee a future increase. The search covers one- and two-field changes only.")}</p>`;
}

async function submitApplicant() {
  if (state.busy) return;
  state.busy = true;
  const button = document.getElementById("submit-button");
  button.disabled = true; button.textContent = tr("正在运行规则…", "Running the rules…");
  clearError();
  try {
    const response = await fetch("/api/evaluate", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicant: state.applicant }) });
    const payload = await response.json();
    if (!response.ok) throw new Error(tr(payload.error || "评估失败，请检查输入。", "Evaluation failed. Please check the details and try again."));
    state.result = payload.result;
    state.diagnosis = null;
    state.targetLimit = null;
    navigate(5);
  } catch (error) {
    showError(error.message || tr("无法连接服务，请重试。", "Could not connect to the service. Please try again."));
    button.disabled = false; button.textContent = `${tr("提交并查看结果", "Submit and view result")} →`;
  } finally { state.busy = false; }
}

async function runDiagnosis() {
  const button = document.getElementById("diagnose-button");
  button.disabled = true; button.textContent = tr("正在诊断…", "Running diagnosis…");
  const output = document.getElementById("diagnosis-output");
  output.textContent = tr("正在逐项重跑规则，请稍候。", "Re-running the rules for each scenario. Please wait.");
  try {
    const target = Number(document.getElementById("target-limit").value);
    state.targetLimit = target;
    const response = await fetch("/api/diagnose", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicant: state.applicant, target_limit: target }) });
    const payload = await response.json();
    if (!response.ok) throw new Error(tr(payload.error || "诊断失败。", "Diagnosis failed. Please try again."));
    state.diagnosis = payload.result;
    renderDiagnosis(state.diagnosis);
  } catch (error) {
    output.textContent = error.message || tr("诊断失败，请重试。", "Diagnosis failed. Please try again.");
  } finally { button.disabled = false; button.textContent = tr("查看诊断", "View diagnosis"); }
}

function navigate(step) {
  state.step = step;
  clearError();
  render();
  scrollPanel();
}
function render() {
  renderProgress();
  if (state.step === 0) renderProfileStep();
  else if (state.step >= 1 && state.step <= 3) renderFormStep(state.step);
  else if (state.step === 4) renderReview();
  else renderResult();
}
render();
