"use strict";

(() => {
  const keys = ["identity_verified", "age", "linked_card_type", "account_age_months",
    "repayment_fulfilment_rate", "average_monthly_spending", "completed_order_count",
    "consecutive_on_time_repayments", "adverse_credit_incidents_6m", "device_stability",
    "current_credit_limit", "available_credit_limit", "external_credit_score", "external_overdue_record"];
  const numeric = new Set(["age", "account_age_months", "repayment_fulfilment_rate",
    "average_monthly_spending", "completed_order_count", "consecutive_on_time_repayments",
    "adverse_credit_incidents_6m", "current_credit_limit", "available_credit_limit", "external_credit_score"]);
  const integers = new Set(["age", "account_age_months", "completed_order_count",
    "consecutive_on_time_repayments", "adverse_credit_incidents_6m", "external_credit_score"]);
  const fileInput = document.getElementById("batch-file");
  const runButton = document.getElementById("batch-run");
  const resetButton = document.getElementById("batch-reset");
  const filename = document.getElementById("batch-filename");
  const message = document.getElementById("batch-message");
  const output = document.getElementById("batch-output");
  let records = [];
  let evaluated = [];
  let source = { type: "loading", name: "" };
  let loadVersion = 0;
  const en = () => document.documentElement.lang === "en";
  const say = (zh, english) => en() ? english : zh;
  const escape = value => String(value).replace(/[&<>"']/g, ch =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

  function parseCSV(source) {
    const rows = []; let row = []; let value = ""; let quoted = false;
    for (let i = 0; i < source.length; i++) {
      const ch = source[i];
      if (quoted) {
        if (ch === '"' && source[i + 1] === '"') { value += '"'; i++; }
        else if (ch === '"') quoted = false;
        else value += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ",") { row.push(value); value = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && source[i + 1] === "\n") i++;
        row.push(value); value = "";
        if (row.some(cell => cell.trim() !== "")) rows.push(row);
        row = [];
      } else value += ch;
    }
    if (quoted) throw new Error(say("CSV 引号未闭合。", "CSV contains an unclosed quote."));
    row.push(value);
    if (row.some(cell => cell.trim() !== "")) rows.push(row);
    return rows;
  }

  function readRecords(source) {
    const csv = parseCSV(source.replace(/^\uFEFF/, ""));
    if (!csv.length) throw new Error(say("CSV 文件为空。", "The CSV file is empty."));
    const header = csv.shift().map(cell => cell.trim());
    if (new Set(header).size !== header.length || !["user_id", ...keys].every(key => header.includes(key)))
      throw new Error(say("表头须包含 user_id 和全部 14 个字段，且不能重复。", "The header must contain user_id and all 14 unique fields."));
    if (csv.length < 1 || csv.length > 100)
      throw new Error(say("每次只能上传 1 至 100 条记录。", "Upload between 1 and 100 records."));
    const ids = new Set();
    return csv.map((cells, index) => {
      if (cells.length !== header.length) throw new Error(say(`第 ${index + 2} 行列数不正确。`, `Row ${index + 2} has the wrong number of columns.`));
      const raw = Object.fromEntries(header.map((key, col) => [key, cells[col].trim()]));
      const id = raw.user_id;
      if (!id || id.length > 64 || ids.has(id)) throw new Error(say(`第 ${index + 2} 行用户号为空、重复或过长。`, `Row ${index + 2} has a missing, duplicate, or overlong user ID.`));
      ids.add(id);
      const applicant = {};
      for (const key of keys) {
        const cell = raw[key];
        if (cell === "") applicant[key] = null;
        else if (key === "identity_verified") {
          if (!["true", "false"].includes(cell.toLowerCase())) throw new Error(say(`第 ${index + 2} 行实名认证须为 true 或 false。`, `Row ${index + 2}: identity_verified must be true or false.`));
          applicant[key] = cell.toLowerCase() === "true";
        } else if (numeric.has(key)) {
          const number = Number(cell);
          if (!Number.isFinite(number) || (integers.has(key) && !Number.isInteger(number))) throw new Error(say(`第 ${index + 2} 行 ${key} 不是有效数字。`, `Row ${index + 2}: ${key} is not a valid number.`));
          applicant[key] = number;
        } else applicant[key] = cell;
      }
      return { user_id: id, applicant };
    });
  }

  function sourceLabel() {
    if (source.type === "built-in") return say(`已备好 ${records.length} 条内置虚构资料 · 点击右侧即可开始`, `${records.length} built-in fictional records ready · click Run to begin`);
    if (source.type === "file") return `${source.name} · ${records.length} ${say("条虚构资料", "fictional records")}`;
    return say("正在载入内置示例…", "Loading built-in sample…");
  }

  async function loadBuiltin() {
    const version = ++loadVersion;
    runButton.disabled = true;
    source = { type: "loading", name: "" };
    filename.textContent = sourceLabel();
    evaluated = []; output.hidden = true; message.textContent = "";
    try {
      const response = await fetch("/fictional_batch_100.csv");
      if (!response.ok) throw new Error(say("无法载入内置示例。", "Could not load the built-in sample."));
      const loaded = readRecords(await response.text());
      if (version !== loadVersion) return;
      records = loaded;
      source = { type: "built-in", name: "" };
      filename.textContent = sourceLabel();
      fileInput.value = "";
      runButton.disabled = false;
    } catch (error) {
      if (version !== loadVersion) return;
      records = [];
      message.textContent = error.message || say("内置示例载入失败，可改用自己的 CSV。", "Built-in sample failed to load; you can upload a CSV instead.");
    }
  }

  function renderResults() {
    if (!evaluated.length) return;
    const counts = { 0: 0, 1000: 0, 5000: 0, 10000: 0, error: 0 };
    evaluated.forEach(item => { if (item.status === "ok") counts[item.result.approved_limit]++; else counts.error++; });
    output.hidden = false;
    output.innerHTML = `<div class="batch-summary">${[
      [say("已处理", "Processed"), evaluated.length, say("条", "records")],
      [say("0 元", "CNY 0"), counts[0], say("人", "users")],
      [say("1,000 元", "CNY 1,000"), counts[1000], say("人", "users")],
      [say("5,000 元", "CNY 5,000"), counts[5000], say("人", "users")],
      [say("10,000 元", "CNY 10,000"), counts[10000], say("人", "users")],
      [say("错误行", "Errors"), counts.error, say("条", "rows")]
    ].map(([label, count, unit]) => `<div><span>${label}</span><strong>${count}<small>${unit}</small></strong></div>`).join("")}</div>
    <div class="batch-table-wrap"><table class="batch-table"><thead><tr><th>${say("用户号", "User ID")}</th><th>${say("类型", "Type")}</th><th>${say("评估结论", "Decision")}</th><th>${say("最终额度", "Limit")}</th><th>${say("规则/错误", "Rule / error")}</th><th>${say("目标诊断", "Target diagnosis")}</th></tr></thead><tbody>
    ${evaluated.map((item, index) => {
      const result = item.result;
      return `<tr><td>${escape(item.user_id)}</td><td>${item.status === "ok" ? (result.evaluation_type === "limit-review" ? say("老用户", "Existing") : say("新用户", "New")) : "—"}</td>
        <td>${item.status === "ok" ? (en() ? escape({ rejected: "Rejected", "conditional-approval": "Conditional approval", approved: "Approved", suspended: "Suspended" }[result.decision] || result.decision) : escape({ rejected: "拒绝", "conditional-approval": "有条件通过", approved: "通过", suspended: "暂停" }[result.decision] || result.decision)) : say("资料错误", "Invalid")}</td>
        <td class="batch-limit">${item.status === "ok" ? escape(result.approved_limit.toLocaleString()) : "—"}</td>
        <td>${item.status === "ok" ? escape(result.hard_decision?.rule_id || result.tier_cap?.rule_id || "—") : escape(item.error)}</td>
        <td>${item.status === "ok" ? `<button type="button" class="batch-diagnose" data-index="${index}">${say("查看", "View")}</button>` : "—"}</td></tr>`;
    }).join("")}</tbody></table></div><div id="batch-diagnosis" class="batch-diagnosis" hidden></div>`;
  }

  async function loadFile(file) {
    const version = ++loadVersion;
    evaluated = []; output.hidden = true; message.textContent = "";
    if (!file) return;
    try {
      if (file.size > 256 * 1024) throw new Error(say("CSV 文件不能超过 256 KB。", "CSV file must be 256 KB or smaller."));
      const loaded = readRecords(await file.text());
      if (version !== loadVersion) return;
      records = loaded;
      source = { type: "file", name: file.name };
      filename.textContent = sourceLabel();
      runButton.disabled = false;
    } catch (error) {
      if (version !== loadVersion) return;
      records = []; source = { type: "loading", name: "" };
      filename.textContent = sourceLabel();
      runButton.disabled = true; message.textContent = error.message;
    }
  }
  fileInput.addEventListener("change", () => loadFile(fileInput.files?.[0]));
  resetButton.addEventListener("click", loadBuiltin);
  const dropZone = document.querySelector(".batch-upload");
  dropZone.addEventListener("dragover", event => { event.preventDefault(); dropZone.classList.add("is-dragging"); });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("is-dragging"));
  dropZone.addEventListener("drop", event => {
    event.preventDefault(); dropZone.classList.remove("is-dragging");
    loadFile(event.dataTransfer.files?.[0]);
  });

  runButton.addEventListener("click", async () => {
    runButton.disabled = true; output.hidden = true;
    message.textContent = say("正在运行 CLIPS 规则…", "Running the CLIPS rules…");
    const started = performance.now();
    try {
      const response = await fetch("/api/batch-evaluate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: records }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || say("批量评估失败。", "Batch evaluation failed."));
      evaluated = payload.results;
      message.textContent = say(`已处理 ${evaluated.length} 条；浏览器往返耗时 ${((performance.now() - started) / 1000).toFixed(2)} 秒。`, `Processed ${evaluated.length} records; browser round-trip time ${((performance.now() - started) / 1000).toFixed(2)} seconds.`);
      renderResults();
    } catch (error) { message.textContent = error.message; }
    finally { runButton.disabled = !records.length; }
  });

  output.addEventListener("click", async event => {
    const button = event.target.closest(".batch-diagnose");
    if (!button) return;
    const index = Number(button.dataset.index);
    const record = records[index];
    const panel = document.getElementById("batch-diagnosis");
    panel.hidden = false;
    panel.innerHTML = `<strong>${escape(record.user_id)}</strong> · ${say("目标额度", "Target limit")}
      <select id="batch-target"><option value="1000">1,000</option><option value="5000">5,000</option><option value="10000" selected>10,000</option></select>
      <button type="button" class="button button-secondary" id="batch-target-run">${say("运行反向诊断", "Run target diagnosis")}</button><div id="batch-target-result"></div>`;
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    document.getElementById("batch-target-run").addEventListener("click", async () => {
      const resultNode = document.getElementById("batch-target-result");
      resultNode.textContent = say("正在诊断…", "Diagnosing…");
      try {
        const response = await fetch("/api/diagnose", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ applicant: record.applicant, target_limit: Number(document.getElementById("batch-target").value) }) });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error);
        const diagnosis = payload.result;
        const paths = diagnosis.improvement_paths || [];
        const englishStatus = {
          "blocked-by-hard-rule": "A hard rule blocks this target; no CF improvement is simulated.",
          "blocked-by-evidence-cap": "Evidence coverage caps the current limit. Supply genuine missing data and reassess.",
          "goal-achieved": "The current result already meets this target.",
          "single-change-options-found": "A tested one-field change can reach the target under the current rules.",
          "two-change-options-found": "A tested pair of changes can reach the target under the current rules.",
          "no-single-change-found": "No tested one- or two-field change reaches the target."
        };
        resultNode.innerHTML = `<p>${escape(en() ? englishStatus[diagnosis.status] || diagnosis.status : diagnosis.conclusion)}</p>${paths.slice(0, 3).map(path =>
          `<p class="batch-path">${escape(path.changes.map(change => en() ? `${change.field} → ${change.to}` : change.description).join(" + "))} → ${escape(path.simulated_limit.toLocaleString())} ${say("元（模拟）", "CNY (simulated)")}</p>`).join("")}
          <small>${say("仅为假设情景，不保证提额。", "Hypothetical scenario only; no increase is guaranteed.")}</small>`;
      } catch (error) { resultNode.textContent = error.message || say("诊断失败。", "Diagnosis failed."); }
    });
  });

  function syncBatchLanguage() {
    document.querySelectorAll("[data-batch-zh]").forEach(node => { node.textContent = node.dataset[en() ? "batchEn" : "batchZh"]; });
    filename.textContent = sourceLabel();
    if (evaluated.length) renderResults();
  }
  window.addEventListener("chengxin-language-change", syncBatchLanguage);
  syncBatchLanguage();
  loadBuiltin();
})();
