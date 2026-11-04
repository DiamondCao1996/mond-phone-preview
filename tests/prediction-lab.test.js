"use strict";
const assert = require("assert"),
  E = require("../prediction-lab/engine.js");
const c = E.defaults();
Object.assign(c, {
  user: "u",
  zone: "UTC",
  device: "d",
  algorithm: "v",
  minDays: 2,
  matureDays: 3,
  minFitDates: 5,
  perParameter: 2,
  residualDates: 3,
});
function rows(n) {
  const all = [];
  for (let i = 0; i < n; i++) {
    let t = Date.UTC(2025, 0, 1 + i, 8);
    const iso = (x) => new Date(x).toISOString();
    all.push({
      id: "c" + i,
      type: "context",
      user: "u",
      start: iso(t - 10 * 3600000),
      time: iso(t - 3600000),
      arrival: iso(t - 3600000),
      timezone: "UTC",
      sleep: 6 + (i % 5) * 0.4,
      activity: 4000 + i * 20,
      rhr: 60 + (i % 4),
      work: i % 2,
    });
    all.push({
      id: "m" + i,
      type: "measurement",
      user: "u",
      time: iso(t),
      arrival: iso(t),
      timezone: "UTC",
      modality: "PPG",
      device: "d",
      algorithm: "v",
      duration: 120,
      posture: "seated",
      breathing: "natural",
      quality: "good",
      rmssd: 30 + (i % 7),
    });
  }
  return all;
}
let a = rows(40),
  origin = Date.UTC(2025, 0, 10, 8),
  target = origin + 86400000;
assert.deepStrictEqual(E.validate(a), []);
let r = E.calc(a, c, origin, target);
assert.equal(r.days, 9);
assert(
  Math.abs(r.models.ar - (r.mu + Math.exp(-0.5) * (Math.log(32) - r.mu))) <
    1e-10
);
assert.equal(
  E.dailyMean(
    [
      { time: new Date(origin - 86400000).toISOString(), rmssd: 25 },
      { time: new Date(origin - 86400000).toISOString(), rmssd: 100 },
      { time: new Date(origin - 2 * 86400000).toISOString(), rmssd: 50 },
    ],
    c
  ).length,
  2
);
let future = a.concat([
  {
    ...a[0],
    id: "late",
    time: new Date(origin - 1000).toISOString(),
    arrival: new Date(origin + 1000).toISOString(),
    rmssd: 999,
  },
]);
assert.equal(E.calc(future, c, origin, target).mu, r.mu);
assert.equal(E.calc(future, c, origin, target).last.id, r.last.id);
let other = a.concat([
  {
    ...a[1],
    id: "other",
    time: new Date(origin - 1000).toISOString(),
    arrival: new Date(origin - 1000).toISOString(),
    device: "new",
    rmssd: 999,
  },
]);
assert.equal(E.calc(other, c, origin, target).last.id, r.last.id);
let low = a.concat([
  {
    ...a[1],
    id: "bad",
    time: new Date(origin - 1000).toISOString(),
    arrival: new Date(origin - 1000).toISOString(),
    quality: "bad",
    rmssd: 999,
  },
]);
assert.equal(E.calc(low, c, origin, target).last.id, r.last.id);
let cc = JSON.parse(JSON.stringify(c));
cc.enabled.sleep = true;
cc.references.sleep = 7;
cc.coefficients.sleep = 0.2;
let rr = E.calc(a, cc, origin, target);
assert(
  Math.abs(
    rr.models.experimental - (rr.models.ar + 0.2 * (rr.values.sleep - 7))
  ) < 1e-10
);
let missing = JSON.parse(JSON.stringify(cc));
missing.contextHours = 0.1;
assert.deepStrictEqual(E.calc(a, missing, origin, target).missing, ["sleep"]);
assert(!("experimental" in E.calc(a, missing, origin, target).models));
const fitted = E.fit(a, cc, Date.UTC(2025, 1, 10), "experimental");
assert(!fitted.error, JSON.stringify(fitted));
assert(Number.isFinite(fitted.coefficients.sleep));
const b = E.backtest(a, cc);
assert(b.scored.length > 0);
assert(b.metrics.experimental.n === b.metrics.context.n);
assert(b.scored.every((x) => x.models.last !== undefined));
assert(new Set(b.scored.map((x) => x.target)).size === b.scored.length);
let edited = a.map((x) =>
  Date.parse(x.time) > Date.UTC(2025, 0, 30)
    ? { ...x, rmssd: x.rmssd ? 999 : x.rmssd, sleep: x.sleep ? 20 : x.sleep }
    : x
);
const cutoff = Date.UTC(2025, 0, 25);
let f1 = E.fit(a, cc, cutoff, "experimental"),
  f2 = E.fit(edited, cc, cutoff, "experimental");
assert.deepStrictEqual(f1, f2);
let before = E.backtest(a, cc).scored.filter(
    (x) => Date.parse(x.origin) < cutoff
  ),
  after = E.backtest(edited, cc).scored.filter(
    (x) => Date.parse(x.origin) < cutoff
  );
assert.deepStrictEqual(before, after);
assert(E.validate([{ ...a[1], id: "m0" }]).length === 0);
assert(E.validate([a[1], a[1]]).length);
assert(E.validate([{ ...a[1], rmssd: 0 }]).length);
assert(E.validate([{ ...a[1], time: "2025-01-01T08:00:00" }]).length);
assert.equal(
  E.localParts("2025-03-30T01:30:00Z", "Europe/Stockholm").minute,
  210
);
assert.equal(
  E.advice(c, { sleep: 5, activity: null, rhr: null, fatigue: 5, work: 1 })
    .field,
  "sleep"
);
assert.equal(
  E.advice(c, {
    sleep: null,
    activity: null,
    rhr: null,
    fatigue: null,
    work: null,
  }).field,
  null
);
const csv = E.csvString([{ ...a[0], id: 'a,"b"' }]);
assert.equal(E.csvParse(csv)[0].id, 'a,"b"');
assert.deepStrictEqual(E.csvParse(E.csvString(a)).length, a.length);
console.log(
  "prediction-lab: calculation, fitting, temporal leakage, comparability, validation, timezone, advice, CSV and backtest passed"
);
// A delayed last measurement must decay over the entire measurement-to-target gap.
const delayedOrigin = origin + 12 * 3600000,
  delayedConfig = { ...c, manualReference: 35 },
  delayed = E.calc(
    a.filter((x) => Date.parse(x.time) <= origin),
    delayedConfig,
    delayedOrigin,
    delayedOrigin + 24 * 3600000
  );
assert.equal(delayed.sinceLast, 36);
assert(
  Math.abs(
    delayed.models.ar -
      (delayed.mu + Math.exp(-36 / 48) * (Math.log(32) - delayed.mu))
  ) < 1e-10
);
// A measurement taken at 08:00 New York local time is comparable with an 08:00 UTC origin.
const travel = {
  ...a[1],
  id: "travel",
  time: "2025-01-08T13:00:00Z",
  arrival: "2025-01-08T13:00:00Z",
  timezone: "America/New_York",
};
assert(
  E.measurementHistory(a.concat([travel]), c, origin, true).some(
    (x) => x.id === "travel"
  )
);
assert(E.validate([{ ...a[1], rmssd: "Infinity" }]).length);
console.log(
  "prediction-lab: long-gap decay and local-clock travel comparisons passed"
);

assert.strictEqual(E.number("   "), null);
assert.throws(() => E.csvParse("id,id\na,b"));
assert.throws(() => E.csvParse("id,user\na,b,c"));
// Background-only comparator must not use the personal HRV reference as a predictor.
const ctx1 = { ...cc, manualReference: 30 },
  ctx2 = { ...cc, manualReference: 80 };
const fctx1 = E.fit(a, ctx1, Date.UTC(2025, 1, 10), "context"),
  fctx2 = E.fit(a, ctx2, Date.UTC(2025, 1, 10), "context");
assert(!fctx1.error && !fctx2.error);
assert.deepStrictEqual(fctx1.coefficients, fctx2.coefficients);
console.log(
  "prediction-lab: background-only comparator excludes personal HRV reference"
);

const delayedRows = a.map((x) =>
  x.id === "m10" ? { ...x, arrival: "2025-01-15T09:00:00Z" } : x
);
const order = E.backtest(delayedRows, cc).scored.map((x) =>
  Date.parse(x.origin)
);
assert(order.every((x, i) => i === 0 || order[i - 1] <= x));
const extreme = JSON.parse(JSON.stringify(cc));
extreme.coefficients.sleep = 1e308;
assert(E.calc(a, extreme, origin, target).error);
console.log(
  "prediction-lab: chronological arrivals and numeric overflow handled"
);

const defaultFeatureBacktest = E.backtest(a, c);
assert(
  defaultFeatureBacktest.scored.length > 0,
  "default settings must score contextual baseline when background data exists"
);
console.log(
  "prediction-lab: default zero-effect configuration retains background comparator"
);

assert(E.validate([{ ...a[1], timezone: "" }]).length);
assert(E.validate([{ ...a[0], energy: 2.5 }]).length);
const cycleConfig = {
  ...cc,
  enabled: { ...cc.enabled, cycleLuteal: true },
  coefficients: { ...cc.coefficients, cycleLuteal: -0.1 },
  references: { ...cc.references, cycleLuteal: 0.5 },
};
const cycleRows = a.map((r) =>
  r.type === "context"
    ? {
        ...r,
        cycleLuteal: Number(r.id.slice(1)) % 2,
        cycleStatus: "natural",
        cycleMethod: "LH",
        cycleId: "cycle-" + Math.floor(Number(r.id.slice(1)) / 14),
      }
    : r
);
assert.deepStrictEqual(E.validate(cycleRows), []);
const cy = E.calc(cycleRows, cycleConfig, origin, target);
assert(
  Math.abs(
    cy.contributions.cycleLuteal - -0.1 * (cy.values.cycleLuteal - 0.5)
  ) < 1e-10
);
const latePhase = {
  ...cycleRows[0],
  id: "unknown-phase",
  time: new Date(origin - 1000).toISOString(),
  arrival: new Date(origin - 1000).toISOString(),
  cycleLuteal: "",
  cycleStatus: "unknown",
};
assert.strictEqual(
  E.calc(cycleRows.concat([latePhase]), cycleConfig, origin, target).values
    .cycleLuteal,
  null
);
assert(
  E.fit(cycleRows.slice(0, 10), cycleConfig, origin, "experimental").error
);
const futurePhase = cycleRows.map((r) =>
  Date.parse(r.time) > origin ? { ...r, cycleLuteal: 1 } : r
);
assert.deepStrictEqual(E.calc(futurePhase, cycleConfig, origin, target), cy);
const cycBacktest = E.backtest(cycleRows, cycleConfig);
assert(cycBacktest.metrics.noCycle);
assert.equal(cycBacktest.metrics.noCycle.n, cycBacktest.metrics.experimental.n);
console.log(
  "cycle: provenance, missingness, contribution, evidence gates, future-label leakage and ablation passed"
);
