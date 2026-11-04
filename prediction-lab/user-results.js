/* User-facing projection of the lab's structured results. */
(function () {
  "use strict";
  const E = window.LabEngine,
    root = document.getElementById("user-prediction");
  if (!root || !E) return;
  const text = (id, value) =>
    (root.querySelector('[data-result="' + id + '"]').textContent = value);
  const fmt = (n) => (Number.isFinite(n) ? n.toFixed(1) : "—");
  function show(result, source) {
    const r = result.forecast;
    if (
      !r ||
      r.error ||
      !r.models ||
      !Number.isFinite(r.models.experimental) ||
      !Number.isFinite(r.mu)
    )
      throw Error(
        (r && r.error) ||
          "No usable prediction in this experiment. Run and save the lab first."
      );
    const value = Math.exp(r.models.experimental),
      reference = Math.exp(r.mu);
    if (!Number.isFinite(value) || value <= 0)
      throw Error("The saved prediction is outside the supported range.");
    text("message", "");
    text("source", source);
    text("value", fmt(value));
    text("reference", fmt(reference) + " ms in your personal reference");
    const delta = (value / reference - 1) * 100;
    text(
      "change",
      (delta >= 0 ? "+" : "") + fmt(delta) + "% compared with your reference"
    );
    text(
      "time",
      "Next check-in: " +
        new Intl.DateTimeFormat("en-GB", {
          timeZone: result.config.zone || "UTC",
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(r.target)) +
        " · " +
        (result.config.zone || "UTC")
    );
    text(
      "history",
      r.manual
        ? "Manually defined reference"
        : r.days +
            " comparable dates · " +
            (r.days >= result.config.matureDays
              ? "established reference"
              : r.days >= result.config.minDays
              ? "initial reference"
              : "still learning")
    );
    text(
      "quality",
      r.last
        ? "Latest input: " +
            r.last.quality +
            " · " +
            r.last.modality +
            " · " +
            r.last.duration +
            " seconds"
        : "Manual scenario · no measured input"
    );
    text(
      "context",
      ["sleep", "activity", "rhr"]
        .filter((k) => r.values[k] !== null && r.values[k] !== undefined)
        .map(
          (k) =>
            ({ sleep: "Sleep: ", activity: "Steps: ", rhr: "Resting pulse: " }[
              k
            ] +
            r.values[k] +
            { sleep: " h", activity: "", rhr: " bpm" }[k])
        )
        .join(" · ") || "No recent background data available."
    );
    const advice = E.advice(result.config, r.values || {});
    text(
      "advice",
      {
        "可以根据感受选择轻松活动或休息。":
          "Consider an easy activity or some rest, guided by how you feel.",
        "维持安排，继续观察。":
          "Keep your current plans and continue observing.",
      }[advice.text] || advice.text
    );
    text(
      "basis",
      advice.field
        ? "Based on your recorded " +
            advice.field +
            " (" +
            advice.value +
            "). Optional; observe how you feel."
        : "Choose one of these optional ideas, or keep doing what works for you."
    );
    const strengths = [];
    if (r.values.sleep != null && r.values.sleep >= 7)
      strengths.push(
        "You logged " +
          r.values.sleep +
          " hours of sleep. Keep making room for rest."
      );
    if (r.values.activity != null && r.values.activity > 0)
      strengths.push(
        "You recorded movement today: " +
          r.values.activity +
          " steps. Every comfortable bit of activity counts."
      );
    if (r.days >= result.config.minDays)
      strengths.push(
        "Your " +
          r.days +
          " comparable recording dates give this estimate personal context."
      );
    if (!strengths.length)
      strengths.push(
        "You took a moment to check in. That is a useful starting point."
      );
    const list = (key, items) => {
      const el = root.querySelector('[data-result="' + key + '"]');
      el.replaceChildren();
      items.forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        el.appendChild(li);
      });
    };
    list("strengths", strengths);
    list("suggestions", [
      "Keep a regular wind-down time and leave space for sleep.",
      "Choose an easy movement break if it feels comfortable.",
      "Check again under similar quiet conditions to see how your pattern develops.",
    ]);
    root.querySelectorAll('[data-result="suggestions"] li').forEach((li) => {
      const label = li.textContent;
      li.textContent = "";
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-pressed", "false");
      button.textContent = label;
      button.onclick = () => {
        const chosen = button.getAttribute("aria-pressed") !== "true";
        button.setAttribute("aria-pressed", String(chosen));
        text(
          "choice",
          chosen
            ? "A small intention, just for you. You can change your mind anytime."
            : "Choose what feels right for today."
        );
      };
      li.appendChild(button);
    });
    text("choice", "Pick an idea if you’d like. Everything here is optional.");
    text(
      "encouragement",
      "You don’t have to do everything. Let how you feel guide your pace."
    );
    text(
      "uncertainty",
      "This is an experimental estimate, not a health score. An uncertainty range is not available in this view. Higher HRV is not automatically better, and the habits shown do not establish why it changed."
    );
    text(
      "cycle",
      result.config.enabled.cycleLuteal
        ? "Your recorded cycle phase is included as optional context; its effect is an individual model assumption."
        : "Cycle context is optional and is not used in this forecast."
    );
    text(
      "updated",
      "Calculated " +
        new Date(result.runAt).toLocaleString("en-GB") +
        " · " +
        result.modelVersion +
        " · result snapshot"
    );
    root.querySelector('[data-result="content"]').hidden = false;
    root.querySelector('[data-result="empty"]').hidden = true;
  }
  root.querySelector('[data-action="saved"]').onclick = () => {
    try {
      const raw = localStorage.getItem("mond-prediction-lab-v1");
      if (!raw)
        throw Error(
          "No saved experiment. Open the lab, run a prediction and choose “Save to this browser”."
        );
      const pack = JSON.parse(raw);
      if (!pack.state || !pack.state.result)
        throw Error(
          "The saved experiment has no results. Run and save the lab first."
        );
      show(
        pack.state.result,
        pack.state.source === "合成示例，非真实用户"
          ? "SAMPLE DATA · saved experiment"
          : "SAVED EXPERIMENT · " + pack.state.source
      );
    } catch (e) {
      text("message", e.message);
    }
  };
  root.querySelector('[data-action="sample"]').onclick = () => {
    const c = E.defaults();
    Object.assign(c, {
      zone: "UTC",
      user: "preview",
      device: "sample-PPG",
      algorithm: "sample-v1",
    });
    const origin = new Date();
    origin.setUTCHours(8, 0, 0, 0);
    const rows = [];
    for (let i = 28; i >= 0; i--) {
      const t = new Date(origin.getTime() - i * 86400000).toISOString();
      rows.push({
        id: "preview-" + i,
        type: "measurement",
        user: c.user,
        time: t,
        arrival: t,
        timezone: "UTC",
        device: c.device,
        algorithm: c.algorithm,
        modality: "PPG",
        duration: 120,
        posture: "seated",
        breathing: "natural",
        quality: "good",
        rmssd: i === 0 ? 50 : 42 + Math.sin(i / 3) * 3,
      });
    }
    rows.push({
      id: "context",
      type: "context",
      user: c.user,
      start: new Date(origin.getTime() - 9 * 3600000).toISOString(),
      time: origin.toISOString(),
      arrival: origin.toISOString(),
      timezone: "UTC",
      sleep: 8,
      activity: 6500,
      rhr: 63,
      fatigue: 2,
    });
    show(
      {
        forecast: E.calc(
          rows,
          c,
          origin.getTime(),
          origin.getTime() + 86400000
        ),
        config: c,
        runAt: new Date().toISOString(),
        modelVersion: E.VERSION,
      },
      "Sample preview · synthetic data"
    );
    text("message", "You’re viewing an example, not your personal forecast.");
  };
  function initialize() {
    const context = document.querySelector(".wellbeing-grid");
    if (context) context.after(root);
    root.querySelector('[data-action="sample"]').click();
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();
