/* MOND prediction lab: deterministic research prototype, not a medical model. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LabEngine = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const VERSION = "mond-lab-1.0.0";
  const features = ["sleep", "activity", "rhr"];
  const defaults = () => ({
    user: "demo",
    horizonHours: 24,
    windowDays: 28,
    clockHours: 2,
    targetToleranceHours: 2,
    minDays: 7,
    matureDays: 14,
    tauHours: 48,
    manualReference: null,
    minFitDates: 30,
    perParameter: 10,
    ridge: 1,
    residualDates: 30,
    intervalLevel: 0.9,
    quality: "good",
    modality: "PPG",
    device: "",
    algorithm: "",
    duration: 120,
    posture: "seated",
    breathing: "natural",
    contextHours: 72,
    coefficients: { sleep: 0, activity: 0, rhr: 0 },
    references: { sleep: null, activity: null, rhr: null },
    enabled: { sleep: false, activity: false, rhr: false },
    coefficientSource: "default",
    rules: [
      {
        id: "sleep",
        enabled: true,
        field: "sleep",
        operator: "lt",
        threshold: 6,
        priority: 1,
        text: "可以考虑为今晚预留更充足的睡眠时间。",
        source: "https://pubmed.ncbi.nlm.nih.gov/42833133/",
      },
      {
        id: "fatigue",
        enabled: true,
        field: "fatigue",
        operator: "gte",
        threshold: 4,
        priority: 2,
        text: "可以根据感受选择轻松活动或休息。",
        source: "https://pubmed.ncbi.nlm.nih.gov/26909534/",
      },
      {
        id: "work",
        enabled: true,
        field: "work",
        operator: "eq",
        threshold: 1,
        priority: 3,
        text: "如果方便，可以安排一次短休息或轻活动。",
        source: "https://pubmed.ncbi.nlm.nih.gov/30192907/",
      },
    ],
  });
  const number = (x) =>
    x === null || x === undefined || (typeof x === "string" && x.trim() === "")
      ? null
      : Number(x);
  const times = new Map();
  const time = (x) => {
    if (!times.has(x)) times.set(x, Date.parse(x));
    return times.get(x);
  };
  const validTime = (x) =>
    typeof x === "string" &&
    /(?:Z|[+-]\d\d:\d\d)$/i.test(x) &&
    Number.isFinite(time(x));
  const formatters = new Map(),
    partsCache = new Map();
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  function localParts(t, zone) {
    try {
      const key = String(t) + "|" + zone;
      if (partsCache.has(key)) return partsCache.get(key);
      if (!formatters.has(zone))
        formatters.set(
          zone,
          new Intl.DateTimeFormat("en-CA", {
            timeZone: zone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23",
          })
        );
      const p = formatters.get(zone).formatToParts(new Date(t));
      const o = {};
      p.forEach((x) => (o[x.type] = x.value));
      const result = {
        date: o.year + "-" + o.month + "-" + o.day,
        minute: (Number(o.hour) % 24) * 60 + Number(o.minute),
      };
      partsCache.set(key, result);
      return result;
    } catch (e) {
      return null;
    }
  }
  function validate(rows) {
    const errors = [];
    const ids = new Set();
    rows.forEach((r, i) => {
      let e = [];
      if (!r.id || ids.has(r.id)) e.push("缺少或重复 ID");
      ids.add(r.id);
      if (!r.user) e.push("缺少用户");
      if (!["measurement", "context"].includes(r.type))
        e.push("类型应为 measurement 或 context");
      if (!validTime(r.time) || !validTime(r.arrival))
        e.push("时间或到达时间无效");
      if (
        validTime(r.time) &&
        validTime(r.arrival) &&
        time(r.arrival) < time(r.time)
      )
        e.push("到达时间早于事件结束");
      if (!r.timezone || !localParts(r.time, r.timezone)) e.push("时区无效");
      if (
        r.type === "measurement" &&
        (!(number(r.rmssd) > 0) ||
          !Number.isFinite(number(r.rmssd)) ||
          !r.modality ||
          !r.device ||
          !r.algorithm ||
          !(number(r.duration) > 0) ||
          !Number.isFinite(number(r.duration)) ||
          !r.posture ||
          !r.breathing ||
          !r.quality)
      )
        e.push("测量需正 RMSSD、来源类型、设备、算法、时长、姿势、呼吸及质量");
      if (
        r.type === "context" &&
        (!validTime(r.start) || time(r.start) > time(r.time))
      )
        e.push("背景需有效起始时间且不得晚于结束时间");
      ["sleep", "activity", "rhr", "energy", "fatigue", "work", "diet"].forEach(
        (k) => {
          if (
            number(r[k]) !== null &&
            (!Number.isFinite(number(r[k])) || number(r[k]) < 0)
          )
            e.push(k + " 无效");
        }
      );
      ["energy", "fatigue"].forEach((k) => {
        if (
          number(r[k]) !== null &&
          (number(r[k]) < 1 ||
            number(r[k]) > 5 ||
            !Number.isInteger(number(r[k])))
        )
          e.push(k + " 须为 1–5");
      });
      ["work", "diet"].forEach((k) => {
        if (number(r[k]) !== null && ![0, 1].includes(number(r[k])))
          e.push(k + " 须为 0 或 1");
      });
      if (e.length) errors.push("第 " + (i + 1) + " 行：" + e.join("、"));
    });
    return errors;
  }
  function compatible(r, c) {
    return (
      r.type === "measurement" &&
      r.user === c.user &&
      r.quality === c.quality &&
      r.modality === c.modality &&
      (!c.device || r.device === c.device) &&
      (!c.algorithm || r.algorithm === c.algorithm) &&
      Number(r.duration) === Number(c.duration) &&
      r.posture === c.posture &&
      r.breathing === c.breathing
    );
  }
  function selectedAt(rows, c, origin) {
    return rows.filter(
      (r) =>
        r.user === c.user && time(r.time) <= origin && time(r.arrival) <= origin
    );
  }
  function measurementHistory(rows, c, origin, excludeToday) {
    const op = localParts(origin, c.zone);
    if (!op) return [];
    return selectedAt(rows, c, origin).filter((r) => {
      if (!compatible(r, c)) return false;
      const t = time(r.time),
        p = localParts(t, r.timezone);
      if (
        !p ||
        t < origin - c.windowDays * 86400000 ||
        (excludeToday && p.date === op.date)
      )
        return false;
      const d = Math.abs(p.minute - op.minute);
      return Math.min(d, 1440 - d) <= c.clockHours * 60;
    });
  }
  function dailyMean(rows, c) {
    const groups = {};
    rows.forEach((r) => {
      const p = localParts(r.time, r.timezone);
      if (p)
        (groups[p.date] || (groups[p.date] = [])).push(
          Math.log(Number(r.rmssd))
        );
    });
    return Object.keys(groups)
      .sort()
      .map((k) => mean(groups[k]));
  }
  function contextValues(rows, c, origin) {
    const pool = selectedAt(rows, c, origin)
      .filter(
        (r) =>
          r.type === "context" &&
          time(r.time) >= origin - c.contextHours * 3600000
      )
      .sort((a, b) => time(b.time) - time(a.time));
    const out = {};
    ["sleep", "activity", "rhr", "fatigue", "work", "diet"].forEach((k) => {
      const r = pool.find((x) => number(x[k]) !== null);
      out[k] = r ? number(r[k]) : null;
    });
    return out;
  }
  function contextRefs(rows, c, origin) {
    const hist = selectedAt(rows, c, origin).filter(
      (r) =>
        r.type === "context" &&
        time(r.time) >= origin - c.windowDays * 86400000 &&
        localParts(r.time, r.timezone).date !== localParts(origin, c.zone).date
    );
    const result = {};
    features.forEach((k) => {
      if (number(c.references[k]) !== null) {
        result[k] = Number(c.references[k]);
        return;
      }
      const byDay = {};
      hist.forEach((r) => {
        let v = number(r[k]);
        if (v !== null) {
          const d = localParts(r.time, r.timezone).date;
          (byDay[d] || (byDay[d] = [])).push(v);
        }
      });
      const vals = Object.keys(byDay).map((k) => mean(byDay[k]));
      result[k] = vals.length ? mean(vals) : null;
    });
    return result;
  }
  function calc(rows, c, origin, target, coefficients) {
    const available = selectedAt(rows, c, origin);
    const all = available
      .filter((r) => compatible(r, c))
      .sort((a, b) => time(b.time) - time(a.time));
    const last = all[0];
    const hist = measurementHistory(rows, c, origin, true);
    const daily = dailyMean(hist, c);
    const manual = number(c.manualReference);
    const mu =
      manual !== null ? Math.log(manual) : daily.length ? mean(daily) : null;
    const values = contextValues(rows, c, origin),
      refs = contextRefs(rows, c, origin);
    const coef = coefficients || c.coefficients;
    const missing = features.filter(
      (k) => c.enabled[k] && (values[k] === null || refs[k] === null)
    );
    const dt = (target - origin) / 3600000;
    if (!(dt > 0) || !(c.tauHours > 0))
      return { error: "目标时间必须晚于预测时间，衰减常数必须大于零。" };
    const result = {
      origin,
      target,
      days: daily.length,
      mu,
      last: last || null,
      values,
      refs,
      missing,
      dt,
      models: {},
      contributions: {},
      manual: manual !== null,
    };
    if (mu === null) {
      result.error = "没有可比历史；可填写手动参考值。";
      return result;
    }
    if (daily.length < c.minDays && manual === null) {
      if (last) result.models.last = Math.log(Number(last.rmssd));
      result.error = "可比历史不足 " + c.minDays + " 个日期；该时段仍在学习。";
      return result;
    }
    result.models.mean = mu;
    if (last) {
      const y = Math.log(Number(last.rmssd));
      result.models.last = y;
      result.sinceLast = (target - time(last.time)) / 3600000;
      const decay = Math.exp(-result.sinceLast / c.tauHours) * (y - mu);
      result.models.ar = mu + decay;
      result.contributions.reference = mu;
      result.contributions.decay = decay;
      if (!missing.length) {
        let sum = 0;
        features.forEach((k) => {
          const part = c.enabled[k]
            ? Number(coef[k]) * (values[k] - refs[k])
            : 0;
          result.contributions[k] = part;
          sum += part;
        });
        result.models.experimental = mu + decay + sum;
      }
    } else if (manual !== null && !missing.length) {
      let sum = 0;
      features.forEach((k) => {
        let p = c.enabled[k] ? Number(coef[k]) * (values[k] - refs[k]) : 0;
        result.contributions[k] = p;
        sum += p;
      });
      result.models.experimental = mu + sum;
      result.contributions.reference = mu;
      result.contributions.decay = 0;
      result.scenario = true;
    }
    if (
      Object.values(result.models).some(
        (v) =>
          !Number.isFinite(v) ||
          !Number.isFinite(Math.exp(v)) ||
          Math.exp(v) === 0
      )
    ) {
      result.error = "模型输出超出数值范围，请检查系数与输入。";
      result.models = {};
    }
    return result;
  }
  function solve(A, b) {
    const n = b.length,
      m = A.map((r, i) => r.slice().concat([b[i]]));
    for (let j = 0; j < n; j++) {
      let best = j;
      for (let i = j + 1; i < n; i++)
        if (Math.abs(m[i][j]) > Math.abs(m[best][j])) best = i;
      if (Math.abs(m[best][j]) < 1e-12) return null;
      [m[j], m[best]] = [m[best], m[j]];
      const p = m[j][j];
      for (let k = j; k <= n; k++) m[j][k] /= p;
      for (let i = 0; i < n; i++) {
        if (i === j) continue;
        const f = m[i][j];
        for (let k = j; k <= n; k++) m[i][k] -= f * m[j][k];
      }
    }
    return m.map((r) => r[n]);
  }
  function matchTargets(rows, c, origins) {
    const targets = rows
      .filter((r) => compatible(r, c))
      .sort((a, b) => time(a.time) - time(b.time));
    const used = new Set();
    return origins.map((o) => {
      const start = Math.max(time(o.time), time(o.arrival));
      const target = start + c.horizonHours * 3600000;
      const candidates = targets
        .filter(
          (t) =>
            !used.has(t.id) &&
            time(t.time) > start &&
            Math.abs(time(t.time) - target) <= c.targetToleranceHours * 3600000
        )
        .sort(
          (a, b) =>
            Math.abs(time(a.time) - target) - Math.abs(time(b.time) - target) ||
            time(a.time) - time(b.time)
        );
      const t = candidates[0];
      if (t) used.add(t.id);
      return { origin: o, target: t || null, planned: target };
    });
  }
  function pairs(rows, c, cutoff) {
    const eligible = rows.filter(
      (r) => time(r.arrival) <= cutoff && time(r.time) <= cutoff
    );
    const origins = eligible
      .filter((r) => compatible(r, c))
      .sort((a, b) => time(a.arrival) - time(b.arrival));
    return matchTargets(eligible, c, origins).filter(
      (p) =>
        p.target &&
        time(p.target.time) <= cutoff &&
        time(p.target.arrival) <= cutoff
    );
  }
  function fit(rows, c, cutoff, mode, cache) {
    const keys = features.filter((k) => c.enabled[k]);
    if (!keys.length) return { error: "请至少启用一个背景特征。" };
    const ps = pairs(rows, c, cutoff);
    const examples = [];
    ps.forEach((p) => {
      const key = p.origin.id + "|" + p.target.id + "|" + p.planned;
      let r = cache && cache.get(key);
      if (!r) {
        r = calc(
          rows,
          c,
          Math.max(time(p.origin.time), time(p.origin.arrival)),
          p.planned
        );
        if (cache) cache.set(key, r);
      }
      if (!r.last || r.mu === null || r.missing.length) return;
      const x = keys.map((k) => r.values[k] - r.refs[k]);
      if (mode === "context") x.unshift(1);
      const base = mode === "context" ? 0 : r.models.ar;
      if (r.error || !Number.isFinite(base)) return;
      examples.push({
        x,
        y: Math.log(Number(p.target.rmssd)) - base,
        date: localParts(p.origin.time, p.origin.timezone).date,
      });
    });
    const days = new Set(examples.map((e) => e.date)).size,
      required = Math.max(
        Number(c.minFitDates),
        Number(c.perParameter) * (keys.length + (mode === "context" ? 1 : 0))
      );
    if (days < required)
      return {
        error: "拟合需要 " + required + " 个有效日期，目前 " + days + " 个。",
        days,
      };
    const counts = {};
    examples.forEach((e) => (counts[e.date] = (counts[e.date] || 0) + 1));
    const size = keys.length + (mode === "context" ? 1 : 0);
    const A = Array.from({ length: size }, (_, i) =>
      Array.from(
        { length: size },
        (_, j) =>
          examples.reduce((s, e) => s + (e.x[i] * e.x[j]) / counts[e.date], 0) +
          (i === j && !(mode === "context" && i === 0) ? Number(c.ridge) : 0)
      )
    );
    const b = Array.from({ length: size }, (_, i) =>
      examples.reduce((s, e) => s + (e.x[i] * e.y) / counts[e.date], 0)
    );
    const v = solve(A, b);
    if (!v || v.some((value) => !Number.isFinite(value)))
      return { error: "拟合矩阵不可解或数值超出范围，请检查数据或正则化。" };
    const coefficients = {
      sleep: 0,
      activity: 0,
      rhr: 0,
      intercept: mode === "context" ? v[0] : 0,
    };
    keys.forEach(
      (k, i) => (coefficients[k] = v[i + (mode === "context" ? 1 : 0)])
    );
    return { coefficients, days, examples: examples.length };
  }
  function quantile(values, q) {
    const a = values.slice().sort((x, y) => x - y);
    const i = Math.min(
      a.length - 1,
      Math.max(0, Math.ceil((a.length + 1) * q) - 1)
    );
    return a[i];
  }
  function backtest(rows, c, options) {
    options = options || {};
    const origins = rows
      .filter((r) => compatible(r, c))
      .sort(
        (a, b) =>
          Math.max(time(a.time), time(a.arrival)) -
          Math.max(time(b.time), time(b.arrival))
      );
    const matches = matchTargets(rows, c, origins);
    const cache = new Map(),
      contextCache = new Map();
    const contextConfig = features.some((k) => c.enabled[k])
      ? c
      : { ...c, enabled: { sleep: true, activity: true, rhr: true } };
    const residuals = [],
      scored = [],
      exclusions = { noTarget: 0, notReady: 0, missing: 0, fit: 0 };
    matches.forEach((p) => {
      const origin = Math.max(time(p.origin.time), time(p.origin.arrival));
      if (!p.target) {
        exclusions.noTarget++;
        return;
      }
      const targetTime = time(p.target.time);
      const r = calc(rows, c, origin, p.planned);
      if (r.error || !r.last || r.mu === null || r.days < c.minDays) {
        exclusions.notReady++;
        return;
      }
      if (r.missing.length) {
        exclusions.missing++;
        return;
      }
      let cf = c.coefficients;
      if (c.coefficientSource === "fitted") {
        const f = fit(rows, c, origin, "experimental", cache);
        if (f.error) {
          exclusions.fit++;
          return;
        }
        cf = f.coefficients;
      }
      const r2 = calc(rows, c, origin, p.planned, cf);
      if (r2.error) {
        exclusions.notReady++;
        return;
      }
      const contextInputs =
        contextConfig === c ? r : calc(rows, contextConfig, origin, p.planned);
      if (contextInputs.missing.length) {
        exclusions.missing++;
        return;
      }
      const context = fit(rows, contextConfig, origin, "context", contextCache);
      if (context.error) {
        exclusions.fit++;
        return;
      }
      let cp = 0;
      features.forEach((k) => {
        if (contextConfig.enabled[k])
          cp +=
            context.coefficients[k] *
            (contextInputs.values[k] - contextInputs.refs[k]);
      });
      r2.models.context = context.coefficients.intercept + cp;
      if (
        !Number.isFinite(r2.models.context) ||
        !Number.isFinite(Math.exp(r2.models.context)) ||
        Math.exp(r2.models.context) === 0
      ) {
        exclusions.fit++;
        return;
      }
      const actual = Math.log(Number(p.target.rmssd));
      const past = residuals.filter((x) => x.available <= origin);
      const dates = new Set(past.map((x) => x.date)).size;
      let interval = null;
      if (dates >= c.residualDates) {
        const q = quantile(
          past.map((x) => x.error),
          Number(c.intervalLevel)
        );
        interval = [r2.models.experimental - q, r2.models.experimental + q];
      }
      const date = localParts(p.target.time, p.target.timezone).date;
      const item = {
        origin: new Date(origin).toISOString(),
        measurementTime: p.origin.time,
        target: p.target.time,
        targetId: p.target.id,
        planned: new Date(p.planned).toISOString(),
        actual,
        models: r2.models,
        interval,
        date,
      };
      if (!options.start || origin >= time(options.start)) scored.push(item);
      if (!residuals.some((x) => x.date === date)) {
        residuals.push({
          error: Math.abs(actual - r2.models.experimental),
          date,
          available: Math.max(targetTime, time(p.target.arrival)),
        });
      }
    });
    const metrics = {};
    ["last", "mean", "ar", "context", "experimental"].forEach((k) => {
      const a = scored.filter((x) => Number.isFinite(x.models[k]));
      if (!a.length) return;
      const e = a.map((x) => x.models[k] - x.actual),
        em = a.map((x) => Math.exp(x.models[k]) - Math.exp(x.actual));
      metrics[k] = {
        n: a.length,
        dates: new Set(a.map((x) => x.date)).size,
        mae: mean(e.map(Math.abs)),
        rmse: Math.sqrt(mean(e.map((x) => x * x))),
        maeMs: mean(em.map(Math.abs)),
        rmseMs: Math.sqrt(mean(em.map((x) => x * x))),
      };
    });
    const covered = scored.filter((x) => x.interval);
    return {
      scored,
      metrics,
      exclusions,
      coverage: covered.length
        ? covered.filter(
            (x) => x.actual >= x.interval[0] && x.actual <= x.interval[1]
          ).length / covered.length
        : null,
      intervalCount: covered.length,
    };
  }
  function advice(c, values) {
    const rule = c.rules
      .filter((r) => r.enabled)
      .sort((a, b) => Number(a.priority) - Number(b.priority))
      .find((r) => {
        const x = values[r.field],
          v = number(r.threshold);
        return (
          x !== null &&
          x !== undefined &&
          v !== null &&
          (r.operator === "lt"
            ? x < v
            : r.operator === "gt"
            ? x > v
            : r.operator === "lte"
            ? x <= v
            : r.operator === "gte"
            ? x >= v
            : x === v)
        );
      });
    return rule
      ? {
          text: rule.text,
          field: rule.field,
          value: values[rule.field],
          source: rule.source,
          rule,
        }
      : { text: "维持安排，继续观察。", field: null };
  }
  function csvParse(text) {
    const out = [],
      rows = [];
    let s = "",
      q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"') {
        if (q && text[i + 1] === '"') {
          s += '"';
          i++;
        } else q = !q;
      } else if (ch === "," && !q) {
        out.push(s);
        s = "";
      } else if ((ch === "\n" || ch === "\r") && !q) {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        out.push(s);
        s = "";
        if (out.some((x) => x !== "")) rows.push(out.splice(0));
        else out.length = 0;
      } else s += ch;
    }
    if (q) throw Error("CSV 引号未闭合");
    out.push(s);
    if (out.some((x) => x !== "")) rows.push(out);
    if (!rows.length) return [];
    const keys = rows.shift().map((x) => x.trim());
    if (new Set(keys).size !== keys.length) throw Error("CSV 表头重复");
    if (rows.some((row) => row.length !== keys.length))
      throw Error("CSV 列数不一致");
    return rows.map((row) =>
      Object.fromEntries(
        keys.map((k, i) => [k, row[i] === undefined ? "" : row[i]])
      )
    );
  }
  function csvString(rows) {
    const keys = [
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
    return [
      keys.join(","),
      ...rows.map((r) =>
        keys
          .map(
            (k) =>
              '"' +
              String(r[k] === undefined || r[k] === null ? "" : r[k]).replace(
                /"/g,
                '""'
              ) +
              '"'
          )
          .join(",")
      ),
    ].join("\n");
  }
  return {
    VERSION,
    features,
    defaults,
    validate,
    localParts,
    compatible,
    selectedAt,
    measurementHistory,
    dailyMean,
    contextValues,
    contextRefs,
    calc,
    fit,
    backtest,
    advice,
    csvParse,
    csvString,
    number,
    matchTargets,
    quantile,
  };
});
