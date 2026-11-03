(function () {
  "use strict";
  const E = window.LabEngine,
    $ = (id) => document.getElementById(id),
    copy = (x) => JSON.parse(JSON.stringify(x)),
    esc = (x) =>
      String(x == null ? "" : x).replace(
        /[&<>"']/g,
        (c) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          }[c])
      ),
    num = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : "—");
  const fields = [
    "id",
    "type",
    "user",
    "time",
    "timezone",
    "arrival",
    "start",
    "modality",
    "source",
    "device",
    "algorithm",
    "duration",
    "posture",
    "breathing",
    "quality",
    "rmssd",
    "sleep",
    "activity",
    "rhr",
    "energy",
    "fatigue",
    "work",
    "diet",
  ];
  const labels = {
    id: "记录 ID",
    type: "类型",
    user: "用户",
    time: "时间 UTC",
    timezone: "时区",
    arrival: "到达时间 UTC",
    start: "背景开始 UTC",
    modality: "来源 PPG/ECG",
    source: "背景来源",
    device: "设备",
    algorithm: "算法版本",
    duration: "时长 秒",
    posture: "姿势",
    breathing: "呼吸",
    quality: "质量",
    rmssd: "RMSSD ms",
    sleep: "睡眠 h",
    activity: "活动 步",
    rhr: "静息心率 bpm",
    energy: "精力 1–5",
    fatigue: "疲劳 1–5",
    work: "工作 0/1",
    diet: "饮食背景 0/1",
  };
  let dataPage = 0;
  let state = {
    rows: [],
    config: E.defaults(),
    origin: new Date().toISOString(),
    source: "手动",
    result: null,
    comparison: null,
    frozen: null,
  };
  state.config.zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const settings = [
    ["user", "用户 ID", "text", "单人独立分析"],
    ["zone", "参考时区", "text", "IANA 时区"],
    ["origin", "预测起点 UTC", "text", "ISO 时间，须有时区偏移"],
    ["horizonHours", "预测间隔", "number", "小时，默认 24"],
    ["windowDays", "参考窗口", "number", "天，默认 28"],
    ["clockHours", "时段容差", "number", "小时，默认 ±2"],
    ["targetToleranceHours", "回测匹配容差", "number", "小时，默认 ±2"],
    ["minDays", "初步参考日期", "number", "默认 7 天"],
    ["matureDays", "成熟参考日期", "number", "默认 14 天"],
    ["tauHours", "衰减时间常数 τ", "number", "小时，工程参数"],
    ["manualReference", "手动参考 RMSSD", "number", "毫秒；空白使用历史"],
    ["quality", "接受的质量标签", "text", "默认 good"],
    ["modality", "测量来源类型", "text", "默认 PPG；ECG 分开"],
    ["device", "设备", "text", "空白使用最近设备"],
    ["algorithm", "算法版本", "text", "空白使用最近算法"],
    ["duration", "测量时长", "number", "秒，默认 120"],
    ["posture", "姿势", "text", "默认 seated"],
    ["breathing", "呼吸", "text", "默认 natural"],
    ["contextHours", "近期背景窗口", "number", "小时，默认 72"],
    ["ridge", "岭回归正则化", "number", "非负"],
    ["minFitDates", "最少拟合日期", "number", "工程默认 30"],
    ["perParameter", "每个系数最少日期", "number", "默认 10"],
    ["residualDates", "区间最少残差日期", "number", "默认 30"],
    ["intervalLevel", "经验区间水平", "number", "0–1，默认 0.9"],
  ];
  function setStatus(s) {
    $("status").textContent = s;
  }
  function getConfig() {
    const c = copy(state.config);
    if (!c.device || !c.algorithm) {
      const pool = state.rows
        .filter(
          (r) =>
            E.compatible(
              r,
              Object.assign({}, c, { device: "", algorithm: "" })
            ) &&
            E.number(r.rmssd) > 0 &&
            Date.parse(r.time) <= Date.parse(state.origin) &&
            Date.parse(r.arrival) <= Date.parse(state.origin)
        )
        .sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
      if (pool.length) {
        if (!c.device) c.device = pool[0].device;
        if (!c.algorithm) c.algorithm = pool[0].algorithm;
      }
    }
    return c;
  }
  function validateConfig(c) {
    let errs = [];
    if (
      !c.zone ||
      !E.localParts(state.origin, c.zone) ||
      !/(?:Z|[+-]\d\d:\d\d)$/i.test(state.origin) ||
      !Number.isFinite(Date.parse(state.origin))
    )
      errs.push("预测起点或参考时区无效。");
    [
      "horizonHours",
      "windowDays",
      "tauHours",
      "duration",
      "contextHours",
      "minDays",
      "matureDays",
      "minFitDates",
      "perParameter",
      "residualDates",
    ].forEach((k) => {
      if (!(Number(c[k]) > 0)) errs.push(k + " 必须大于 0。");
    });
    ["clockHours", "targetToleranceHours", "ridge"].forEach((k) => {
      if (!(Number(c[k]) >= 0)) errs.push(k + " 必须非负。");
    });
    if (!(Number(c.intervalLevel) > 0 && Number(c.intervalLevel) < 1))
      errs.push("区间水平须在 0 和 1 之间。");
    if (
      E.number(c.manualReference) !== null &&
      !(Number(c.manualReference) > 0)
    )
      errs.push("手动参考 RMSSD 必须大于 0。");
    E.features.forEach((k) => {
      if (
        E.number(c.coefficients[k]) === null ||
        !Number.isFinite(Number(c.coefficients[k])) ||
        (E.number(c.references[k]) !== null &&
          !Number.isFinite(Number(c.references[k])))
      )
        errs.push(k + " 系数或参考值无效。");
    });
    c.rules.forEach((r, i) => {
      if (
        r.enabled &&
        (E.number(r.threshold) === null ||
          !Number.isFinite(Number(r.threshold)) ||
          E.number(r.priority) === null ||
          !Number.isFinite(Number(r.priority)) ||
          !String(r.text || "").trim())
      )
        errs.push("第 " + (i + 1) + " 条规则的阈值、优先级和文案必须有效。");
    });
    return errs;
  }
  function table() {
    let h =
      "<thead><tr>" +
      fields.map((k) => "<th>" + labels[k] + "</th>").join("") +
      "<th>操作</th></tr></thead><tbody>";
    const pageSize = 20,
      totalPages = Math.max(1, Math.ceil(state.rows.length / pageSize));
    dataPage = Math.max(0, Math.min(dataPage, totalPages - 1));
    state.rows
      .slice(dataPage * pageSize, (dataPage + 1) * pageSize)
      .forEach((r, n) => {
        const i = dataPage * pageSize + n;
        h +=
          "<tr>" +
          fields
            .map(
              (k) =>
                '<td><input data-row="' +
                i +
                '" data-field="' +
                k +
                '" aria-label="第 ' +
                (i + 1) +
                " 行 " +
                labels[k] +
                '" value="' +
                esc(r[k]) +
                '"></td>'
            )
            .join("") +
          '<td><button data-delete="' +
          i +
          '">删除</button></td></tr>';
      });
    $("data-table").innerHTML = h + "</tbody>";
    $("data-count").textContent =
      state.rows.length + " 条记录 · " + state.source;
    $("table-nav").innerHTML =
      '<button id="page-prev" ' +
      (dataPage === 0 ? "disabled" : "") +
      '>上一页</button><span class="hint">第 ' +
      (dataPage + 1) +
      " / " +
      totalPages +
      ' 页，每页最多 20 条</span><button id="page-next" ' +
      (dataPage >= totalPages - 1 ? "disabled" : "") +
      ">下一页</button>";
  }
  function renderSettings() {
    $("config-fields").innerHTML = settings
      .map(
        ([k, label, type, help]) =>
          "<label>" +
          label +
          '<input data-config="' +
          k +
          '" type="' +
          type +
          '" ' +
          (type === "number" ? 'step="any"' : "") +
          ' value="' +
          esc(k === "origin" ? state.origin : state.config[k]) +
          '"><small>' +
          help +
          "</small></label>"
      )
      .join("");
    $("features").innerHTML =
      "<thead><tr><th>启用</th><th>背景特征</th><th>系数</th><th>手动参考</th><th>输入单位</th></tr></thead><tbody>" +
      E.features
        .map(
          (k) =>
            '<tr><td><input aria-label="启用 ' +
            k +
            '" type="checkbox" data-feature="' +
            k +
            '" data-prop="enabled" ' +
            (state.config.enabled[k] ? "checked" : "") +
            "></td><td>" +
            { sleep: "睡眠时长", activity: "活动量", rhr: "静息心率" }[k] +
            '</td><td><input aria-label="' +
            k +
            ' 系数" type="number" step="any" data-feature="' +
            k +
            '" data-prop="coefficients" value="' +
            esc(state.config.coefficients[k]) +
            '"></td><td><input aria-label="' +
            k +
            ' 参考值" type="number" step="any" data-feature="' +
            k +
            '" data-prop="references" value="' +
            esc(state.config.references[k]) +
            '"></td><td>' +
            { sleep: "小时", activity: "步", rhr: "bpm" }[k] +
            "</td></tr>"
        )
        .join("") +
      "</tbody>";
    $("rules").innerHTML =
      "<thead><tr><th>启用</th><th>字段</th><th>条件</th><th>阈值</th><th>优先级</th><th>建议文案</th><th>来源 URL</th><th>操作</th></tr></thead><tbody>" +
      state.config.rules
        .map(
          (r, i) =>
            '<tr><td><input aria-label="规则 ' +
            (i + 1) +
            ' 启用" type="checkbox" data-rule="' +
            i +
            '" data-prop="enabled" ' +
            (r.enabled ? "checked" : "") +
            "></td>" +
            ["field", "operator"]
              .map(
                (k) =>
                  '<td><select aria-label="规则 ' +
                  (i + 1) +
                  " " +
                  k +
                  '" data-rule="' +
                  i +
                  '" data-prop="' +
                  k +
                  '">' +
                  (k === "field"
                    ? ["sleep", "activity", "rhr", "fatigue", "work", "diet"]
                    : ["lt", "lte", "gt", "gte", "eq"]
                  )
                    .map(
                      (v) =>
                        "<option " +
                        (r[k] === v ? "selected" : "") +
                        ">" +
                        v +
                        "</option>"
                    )
                    .join("") +
                  "</select></td>"
              )
              .join("") +
            ["threshold", "priority", "text", "source"]
              .map(
                (k) =>
                  '<td><input aria-label="规则 ' +
                  (i + 1) +
                  " " +
                  k +
                  '" data-rule="' +
                  i +
                  '" data-prop="' +
                  k +
                  '" value="' +
                  esc(r[k]) +
                  '"></td>'
              )
              .join("") +
            '<td><button data-rule-delete="' +
            i +
            '">删除</button></td></tr>'
        )
        .join("") +
      '</tbody><tfoot><tr><td colspan="8"><button id="add-rule">＋ 自定义规则</button></td></tr></tfoot>';
    $("fit-status").textContent =
      "系数来源：" +
      ({ default: "默认假设", manual: "手动设置", fitted: "历史数据拟合" }[
        state.config.coefficientSource
      ] || state.config.coefficientSource);
  }
  function invalidate() {
    state.result = null;
    $("forecast").hidden = true;
    $("forecast-empty").hidden = false;
    $("forecast-empty").textContent = "输入已改变，请重新运行。";
    $("chart").textContent = "输入已改变，请重新运行。";
    $("metrics").innerHTML = "";
    $("evaluation-info").textContent = "";
    setStatus("参数或数据已更改 · 请重新运行，之前回测仅供探索");
  }
  function add(type) {
    let now = new Date().toISOString(),
      r = {
        id: "row-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
        type,
        user: state.config.user,
        time: now,
        timezone: state.config.zone,
        arrival: now,
      };
    if (type === "measurement")
      Object.assign(r, {
        modality: state.config.modality,
        device: state.config.device || "MOND",
        algorithm: state.config.algorithm || "v1",
        duration: state.config.duration,
        posture: state.config.posture,
        breathing: state.config.breathing,
        quality: state.config.quality,
        rmssd: "",
      });
    else r.start = now;
    state.rows.push(r);
    dataPage = Math.floor((state.rows.length - 1) / 20);
    table();
    invalidate();
  }
  $("table-nav").addEventListener("click", (e) => {
    if (e.target.id === "page-prev") dataPage--;
    if (e.target.id === "page-next") dataPage++;
    table();
  });
  $("data-table").addEventListener("change", (e) => {
    const i = e.target.dataset.row;
    if (i !== undefined) {
      state.rows[Number(i)][e.target.dataset.field] = e.target.value;
      invalidate();
    }
  });
  $("data-table").addEventListener("click", (e) => {
    if (e.target.dataset.delete !== undefined) {
      state.rows.splice(Number(e.target.dataset.delete), 1);
      table();
      invalidate();
    }
  });
  $("config-fields").addEventListener("change", (e) => {
    const k = e.target.dataset.config;
    if (!k) return;
    let v =
      e.target.type === "number" ? E.number(e.target.value) : e.target.value;
    if (k === "origin") state.origin = v;
    else state.config[k] = v;
    invalidate();
  });
  $("features").addEventListener("change", (e) => {
    let k = e.target.dataset.feature,
      p = e.target.dataset.prop;
    if (!k) return;
    state.config[p][k] =
      p === "enabled" ? e.target.checked : E.number(e.target.value);
    if (p === "coefficients") {
      state.config.coefficientSource = "manual";
      $("fit-status").textContent = "系数来源：手动设置";
    }
    invalidate();
  });
  $("rules").addEventListener("change", (e) => {
    let i = e.target.dataset.rule,
      p = e.target.dataset.prop;
    if (i === undefined) return;
    state.config.rules[Number(i)][p] =
      p === "enabled" ? e.target.checked : e.target.value;
    invalidate();
  });
  $("rules").addEventListener("click", (e) => {
    if (e.target.id === "add-rule") {
      state.config.rules.push({
        id: "custom-" + Date.now(),
        enabled: true,
        field: "sleep",
        operator: "lt",
        threshold: 6,
        priority: 10,
        text: "",
        source: "",
      });
      renderSettings();
      invalidate();
    }
    if (e.target.dataset.ruleDelete !== undefined) {
      state.config.rules.splice(Number(e.target.dataset.ruleDelete), 1);
      renderSettings();
      invalidate();
    }
  });
  $("add-measurement").onclick = () => add("measurement");
  $("add-context").onclick = () => add("context");
  $("reset").onclick = () => {
    let zone = state.config.zone,
      user = state.config.user;
    state.config = E.defaults();
    state.config.zone = zone;
    state.config.user = user;
    renderSettings();
    invalidate();
  };
  function sample() {
    const rows = [],
      day = 86400000,
      end = new Date();
    end.setUTCHours(8, 0, 0, 0);
    for (let i = 110; i >= 0; i--) {
      let t = end.getTime() - i * day;
      let d = new Date(t),
        ctx = new Date(t - 3600000).toISOString(),
        start = new Date(t - 9 * 3600000).toISOString(),
        iso = d.toISOString();
      let sleep = 7.1 + 0.8 * Math.sin(i / 6),
        activity = Math.round(6500 + 2100 * Math.sin(i / 7)),
        rhr = 60 + 3 * Math.sin(i / 9);
      rows.push({
        id: "ctx-" + i,
        type: "context",
        user: "demo",
        time: ctx,
        timezone: "UTC",
        arrival: ctx,
        start,
        sleep: num(sleep, 2),
        activity,
        rhr: num(rhr, 1),
        energy: 3,
        fatigue: i % 13 === 0 ? 4 : 2,
        work: i % 7 < 5 ? 1 : 0,
      });
      rows.push({
        id: "m-" + i,
        type: "measurement",
        user: "demo",
        time: iso,
        timezone: "UTC",
        arrival: iso,
        modality: "PPG",
        device: "demo-PPG",
        algorithm: "demo-v1",
        duration: 120,
        posture: "seated",
        breathing: "natural",
        quality: "good",
        rmssd: num(43 + 5 * Math.sin(i / 8) + 2 * Math.cos(i / 3), 2),
      });
    }
    state.rows = rows;
    state.config = E.defaults();
    state.config.zone = "UTC";
    state.config.device = "demo-PPG";
    state.config.algorithm = "demo-v1";
    state.config.enabled = { sleep: true, activity: true, rhr: true };
    state.origin = end.toISOString();
    state.source = "合成示例，非真实用户";
    state.frozen = null;
    state.comparison = null;
    table();
    renderSettings();
    invalidate();
    setStatus("已载入合成示例 · 示例仅用于检查功能");
  }
  $("demo").onclick = sample;
  function errors(config) {
    const es = E.validate(state.rows).concat(
      validateConfig(config || getConfig())
    );
    $("data-errors").textContent = es.join("\n");
    if (es.length) {
      setStatus("请先修正输入错误");
      return true;
    }
    return false;
  }
  function download(name, content, type) {
    let blob = new Blob([content], { type }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  $("template").onclick = () =>
    download(
      "mond-lab-template.csv",
      E.csvString([
        {
          id: "measurement-1",
          type: "measurement",
          user: "demo",
          time: "2026-01-01T08:00:00Z",
          timezone: "Europe/Stockholm",
          arrival: "2026-01-01T08:00:00Z",
          modality: "PPG",
          device: "MOND-1",
          algorithm: "v1",
          duration: 120,
          posture: "seated",
          breathing: "natural",
          quality: "good",
          rmssd: 42,
        },
        {
          id: "context-1",
          type: "context",
          user: "demo",
          start: "2025-12-31T22:00:00Z",
          time: "2026-01-01T07:00:00Z",
          timezone: "Europe/Stockholm",
          arrival: "2026-01-01T07:00:00Z",
          sleep: 7,
          activity: 6200,
          rhr: 60,
        },
      ]),
      "text/csv;charset=utf-8"
    );
  $("export-csv").onclick = () =>
    download(
      "mond-lab-data.csv",
      E.csvString(state.rows),
      "text/csv;charset=utf-8"
    );
  function pack() {
    return {
      format: "mond-prediction-lab",
      version: E.VERSION,
      exportedAt: new Date().toISOString(),
      state: copy(state),
    };
  }
  $("export").onclick = () =>
    download(
      "mond-lab-experiment.json",
      JSON.stringify(pack(), null, 2),
      "application/json"
    );
  function restore(data) {
    if (data.format === "mond-prediction-lab" && data.state) {
      if (!Array.isArray(data.state.rows) || !data.state.config)
        throw Error("实验包缺少数据或配置");
      state = data.state;
      state.config = Object.assign(E.defaults(), state.config);
      state.source = state.source || "导入实验包";
    } else if (Array.isArray(data)) {
      state.rows = data;
      state.source = "导入 JSON";
      state.result = null;
    } else throw Error("JSON 需为记录数组或 MOND 实验包");
    table();
    renderSettings();
    setStatus("数据已导入 · 请运行以检查结果");
    if (state.result) showResult(state.result);
  }
  $("import").onchange = async (e) => {
    let f = e.target.files[0];
    if (!f) return;
    try {
      let text = await f.text();
      if (f.name.toLowerCase().endsWith(".csv")) {
        state.rows = E.csvParse(text.replace(/^\uFEFF/, ""));
        state.source = "导入 CSV";
        state.result = null;
        table();
        setStatus("CSV 已导入 · 请检查输入");
      } else restore(JSON.parse(text));
    } catch (err) {
      setStatus("导入失败：" + err.message);
    }
    e.target.value = "";
  };
  $("save-local").onclick = () => {
    try {
      localStorage.setItem("mond-prediction-lab-v1", JSON.stringify(pack()));
      setStatus("已保存到此浏览器");
    } catch (e) {
      setStatus("保存失败：" + e.message);
    }
  };
  $("load-local").onclick = () => {
    try {
      let d = localStorage.getItem("mond-prediction-lab-v1");
      if (!d) throw Error("没有保存的实验");
      restore(JSON.parse(d));
    } catch (e) {
      setStatus("读取失败：" + e.message);
    }
  };
  $("clear-local").onclick = () => {
    localStorage.removeItem("mond-prediction-lab-v1");
    setStatus("本地保存已删除，当前页面数据仍在内存中");
  };
  $("fit").onclick = () => {
    if (errors()) return;
    const f = E.fit(
      state.rows,
      getConfig(),
      Date.parse(state.origin),
      "experimental"
    );
    if (f.error) {
      $("fit-status").textContent = f.error;
      return;
    }
    state.config.coefficients = f.coefficients;
    state.config.coefficientSource = "fitted";
    renderSettings();
    invalidate();
    $("fit-status").textContent =
      "系数来源：历史数据拟合 · " + f.days + " 个有效日期";
  };
  function card(label, value, detail) {
    return (
      '<div class="metric"><small>' +
      esc(label) +
      "</small><strong>" +
      esc(value) +
      "</strong><small>" +
      esc(detail || "") +
      "</small></div>"
    );
  }
  const names = {
    experimental: "实验模型",
    last: "上次值",
    mean: "个人均值",
    ar: "自回归",
    context: "无 HRV 背景模型",
  };
  function showForecast(r, bt, c) {
    $("forecast-empty").hidden = true;
    $("forecast").hidden = false;
    if (r.error) {
      $("forecast-cards").innerHTML = card("无法预测", "—", r.error);
      $("forecast-info").textContent = "";
      $("contributions").textContent = "";
    } else {
      let html = "";
      ["experimental", "last", "mean", "ar", "context"].forEach((k) => {
        html += card(
          names[k],
          Number.isFinite(r.models[k])
            ? num(Math.exp(r.models[k]), 1) + " ms"
            : "不可用",
          k === "experimental" ? "RMSSD 中位数估计" : "比较基线"
        );
      });
      $("forecast-cards").innerHTML = html;
      const local = new Intl.DateTimeFormat("zh-CN", {
        timeZone: c.zone,
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(r.target));
      let maturity =
        r.days >= c.matureDays
          ? "较成熟"
          : r.days >= c.minDays
          ? "初步"
          : "该时段仍在学习";
      let ref = r.manual
        ? "手动参考，仅作情景实验"
        : maturity + " · " + r.days + " 个有效日期";
      let missing = r.missing.length
        ? "缺失特征：" + r.missing.join("、") + "；实验模型未输出。"
        : "";
      const past = bt.scored.filter((x) => {
        const item = state.rows.find(
          (row) =>
            row.type === "measurement" &&
            row.user === c.user &&
            row.id === x.targetId
        );
        return item && Date.parse(item.arrival) <= r.origin;
      });
      const distinct = Array.from(
        new Map(past.map((x) => [x.date, x])).values()
      );
      let bounds = null;
      if (
        distinct.length >= c.residualDates &&
        Number.isFinite(r.models.experimental)
      ) {
        const q = E.quantile(
          distinct.map((x) => Math.abs(x.actual - x.models.experimental)),
          Number(c.intervalLevel)
        );
        bounds = [
          Math.exp(r.models.experimental - q),
          Math.exp(r.models.experimental + q),
        ];
      }
      $("forecast-info").textContent =
        "目标：" +
        local +
        "（" +
        c.zone +
        "），间隔 " +
        num(r.dt, 1) +
        " 小时；最近测量至目标 " +
        num(r.sinceLast, 1) +
        " 小时。参考：" +
        ref +
        "。" +
        missing +
        " " +
        (bounds
          ? "经验预测区间：" +
            num(bounds[0], 1) +
            "–" +
            num(bounds[1], 1) +
            " ms（" +
            distinct.length +
            " 个残差日期，未保证覆盖率）。"
          : "尚无足够的样本外残差估计预测区间。");
      let parts = Object.keys(r.contributions)
        .map((k) => esc(k) + "：" + num(r.contributions[k], 4))
        .join(" · ");
      let delta = Number.isFinite(r.models.experimental)
        ? (Math.exp(r.models.experimental - r.mu) - 1) * 100
        : null;
      $("contributions").innerHTML =
        '<p class="hint">相对参考：' +
        (delta === null ? "不可用" : num(delta, 1) + "%") +
        "。对数尺度贡献：" +
        parts +
        "</p>";
    }
    const a = E.advice(
      c,
      r.values || E.contextValues(state.rows, c, Date.parse(state.origin))
    );
    $("advice").textContent = a.text;
    let e = a.field
      ? "触发：" +
        a.field +
        " = " +
        a.value +
        "；规则：" +
        a.rule.operator +
        " " +
        a.rule.threshold +
        "。"
      : "";
    $("advice-evidence").textContent = e;
    if (a.source && /^https?:\/\//i.test(a.source)) {
      let link = document.createElement("a");
      link.href = a.source;
      link.textContent = "研究背景（不代表个体因果效果）";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      $("advice-evidence").appendChild(link);
    }
  }
  function showChart(scored) {
    if (!scored.length) {
      $("chart").textContent = "没有满足所有对照模型要求的回测样本。";
      return;
    }
    const items = scored.slice(-80),
      vals = [];
    items.forEach((x) => vals.push(x.actual, x.models.experimental));
    let min = Math.min(...vals),
      max = Math.max(...vals);
    if (min === max) {
      min -= 0.1;
      max += 0.1;
    }
    const x = (i) => 40 + (i * 720) / Math.max(1, items.length - 1),
      y = (v) => 180 - ((v - min) / (max - min)) * 150;
    const line = (k) =>
      items
        .map(
          (r, i) =>
            x(i) + "," + y(k === "actual" ? r.actual : r.models.experimental)
        )
        .join(" ");
    $("chart").innerHTML =
      '<svg viewBox="0 0 800 220" role="img" aria-label="实际 lnRMSSD 与实验模型预测的时间曲线"><line x1="40" y1="180" x2="760" y2="180" stroke="#b8c9b3"/><text x="5" y="30">' +
      num(max, 2) +
      '</text><text x="5" y="180">' +
      num(min, 2) +
      '</text><polyline fill="none" stroke="#385b46" stroke-width="2" points="' +
      line("actual") +
      '"/><polyline fill="none" stroke="#c17e52" stroke-width="2" stroke-dasharray="5 4" points="' +
      line("forecast") +
      '"/><text x="40" y="210">实际 — 绿色　预测 — 橙色虚线　最近 ' +
      items.length +
      " 个样本 · lnRMSSD</text></svg>";
  }
  function showResult(result) {
    const r = result.forecast,
      bt = result.backtest,
      c = result.config;
    showForecast(r, bt, c);
    showChart(bt.scored);
    let head =
      "<table><thead><tr><th>模型</th><th>样本／日期</th><th>ln MAE</th><th>ln RMSE</th><th>ms MAE</th><th>ms RMSE</th><th>相对最强简单基线</th></tr></thead><tbody>";
    const base = ["last", "mean", "ar", "context"]
      .map((k) => bt.metrics[k] && bt.metrics[k].mae)
      .filter(Number.isFinite);
    const best = base.length ? Math.min(...base) : null;
    Object.keys(names).forEach((k) => {
      let m = bt.metrics[k];
      if (!m) return;
      let improve = best !== null && best > 0 ? (1 - m.mae / best) * 100 : null;
      head +=
        "<tr><td>" +
        names[k] +
        "</td><td>" +
        m.n +
        " / " +
        m.dates +
        "</td><td>" +
        num(m.mae, 4) +
        "</td><td>" +
        num(m.rmse, 4) +
        "</td><td>" +
        num(m.maeMs, 2) +
        "</td><td>" +
        num(m.rmseMs, 2) +
        "</td><td>" +
        (improve === null ? "—" : num(improve, 1) + "%") +
        "</td></tr>";
    });
    $("metrics").innerHTML = head + "</tbody></table>";
    $("evaluation-info").textContent =
      (result.holdout ? "冻结配置留出评估" : "探索性回测") +
      " · 区间覆盖：" +
      (bt.coverage === null
        ? "数据不足"
        : num(bt.coverage * 100, 1) + "%（" + bt.intervalCount + " 个样本）") +
      " · 排除：无目标 " +
      bt.exclusions.noTarget +
      "，参考不足 " +
      bt.exclusions.notReady +
      "，背景缺失 " +
      bt.exclusions.missing +
      "，拟合不足 " +
      bt.exclusions.fit +
      "。";
  }
  function run(config, options) {
    if (errors(config)) return null;
    let c = config ? copy(config) : getConfig(),
      origin = Date.parse(state.origin),
      target = origin + Number(c.horizonHours) * 3600000;
    if (validateConfig(c).length) {
      setStatus("冻结配置无效");
      return null;
    }
    if (c.coefficientSource === "fitted") {
      const f = E.fit(state.rows, c, origin, "experimental");
      if (f.error) {
        setStatus("当前时间无法拟合：" + f.error);
        return null;
      }
      c.coefficients = f.coefficients;
      if (!config) {
        state.config.coefficients = copy(f.coefficients);
        renderSettings();
      }
    }
    let forecast = E.calc(state.rows, c, origin, target),
      backtest = E.backtest(state.rows, c, options);
    const contextConfig = E.features.some((k) => c.enabled[k])
      ? c
      : { ...c, enabled: { sleep: true, activity: true, rhr: true } };
    const contextInputs =
      contextConfig === c
        ? forecast
        : E.calc(state.rows, contextConfig, origin, target);
    const context = E.fit(state.rows, contextConfig, origin, "context");
    if (!context.error && !forecast.error && !contextInputs.missing.length) {
      let offset = 0;
      E.features.forEach((k) => {
        if (contextConfig.enabled[k])
          offset +=
            context.coefficients[k] *
            (contextInputs.values[k] - contextInputs.refs[k]);
      });
      const estimate = context.coefficients.intercept + offset;
      if (
        Number.isFinite(estimate) &&
        Number.isFinite(Math.exp(estimate)) &&
        Math.exp(estimate) > 0
      )
        forecast.models.context = estimate;
    }
    let result = {
      modelVersion: E.VERSION,
      config: copy(c),
      origin: state.origin,
      forecast,
      backtest,
      holdout: !!(options && options.start),
      runAt: new Date().toISOString(),
    };
    state.result = result;
    showResult(result);
    setStatus(
      "已完成 · " +
        (result.holdout ? "冻结配置留出评估" : "探索性回测") +
        " · " +
        E.VERSION
    );
    return result;
  }
  $("run").onclick = () => run();
  $("save-a").onclick = () => {
    let r = run();
    if (!r) return;
    state.comparison = { A: copy(r), dataSnapshot: JSON.stringify(state.rows) };
    $("compare-result").innerHTML = card(
      "方案 A",
      Number.isFinite(r.forecast.models.experimental)
        ? num(Math.exp(r.forecast.models.experimental), 1) + " ms"
        : "不可用",
      "参数快照已保存"
    );
  };
  $("compare-b").onclick = () => {
    if (!state.comparison) {
      setStatus("请先保存方案 A");
      return;
    }
    if (state.comparison.dataSnapshot !== JSON.stringify(state.rows)) {
      setStatus("数据已变化，请先重新保存方案 A，以便比较同一份数据");
      return;
    }
    let a = state.comparison.A,
      b = run();
    if (!b) return;
    state.comparison.B = copy(b);
    let av = a.forecast.models.experimental,
      bv = b.forecast.models.experimental;
    $("compare-result").innerHTML =
      card(
        "方案 A",
        Number.isFinite(av) ? num(Math.exp(av), 1) + " ms" : "不可用",
        "已保存配置"
      ) +
      card(
        "方案 B",
        Number.isFinite(bv) ? num(Math.exp(bv), 1) + " ms" : "不可用",
        "当前配置"
      ) +
      card(
        "B − A",
        Number.isFinite(av) && Number.isFinite(bv)
          ? num(Math.exp(bv) - Math.exp(av), 1) + " ms"
          : "不可用",
        "仅为模型敏感性对比"
      ) +
      '<p class="hint">A 贡献：' +
      esc(JSON.stringify(a.forecast.contributions)) +
      "<br>B 贡献：" +
      esc(JSON.stringify(b.forecast.contributions)) +
      "</p>";
  };
  $("freeze").onclick = () => {
    if (errors()) return;
    state.frozen = { config: getConfig(), at: new Date().toISOString() };
    $("freeze-status").textContent =
      "已冻结于 " + state.frozen.at + "；仅评估此后起点";
    setStatus("配置已冻结，留出集须在冻结后开始");
  };
  $("holdout-run").onclick = () => {
    if (!state.frozen) {
      setStatus("请先冻结配置");
      return;
    }
    let t = Date.parse($("holdout").value);
    if (!Number.isFinite(t) || t < Date.parse(state.frozen.at)) {
      setStatus("留出开始时间必须不早于冻结时间");
      return;
    }
    run(state.frozen.config, { start: new Date(t).toISOString() });
  };
  table();
  renderSettings();
})();
