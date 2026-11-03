const { chromium } = require("playwright-core");
const path = require("path");
const os = require("os");
const fs = require("fs");
const artifactDir = fs.mkdtempSync(path.join(os.tmpdir(), "mond-lab-test-"));
const exportPath = path.join(artifactDir, "experiment.json");
(async () => {
  let b = await chromium.launch({
    headless: true,
    executablePath:
      process.env.CHROME_PATH ||
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    args: ["--no-sandbox"],
  });
  let p = await b.newPage({
    viewport: { width: 1280, height: 800 },
    acceptDownloads: true,
  });
  p.setDefaultTimeout(120000);
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  const base = process.env.LAB_URL || "http://127.0.0.1:8765";
  await p.goto(base + "/", { waitUntil: "domcontentloaded" });
  await p
    .locator('a[href="./prediction-lab.html"]')
    .click({ noWaitAfter: true });
  await p.waitForURL("**/prediction-lab.html", {
    waitUntil: "domcontentloaded",
  });
  await p.locator("#demo").click();
  await p.locator("#run").click();
  await p.locator("#save-a").click();
  const coefficient = p.locator(
    'input[data-feature="sleep"][data-prop="coefficients"]'
  );
  await coefficient.fill("0.05");
  await coefficient.press("Tab");
  await p.locator("#compare-b").click();
  if (!(await p.locator("#compare-result").innerText()).includes("B − A"))
    throw Error("A/B comparison missing");
  console.log("desktop entry, prediction and A/B comparison passed");
  await p.setViewportSize({ width: 390, height: 844 });
  await p.locator("#fit").click();
  console.log("fit:", await p.locator("#fit-status").innerText());
  await p.locator("#run").click();
  let a = await p.locator("#forecast-cards").innerText(),
    info = await p.locator("#evaluation-info").innerText();
  const [download] = await Promise.all([
    p.waitForEvent("download"),
    p.locator("#export").click(),
  ]);
  await download.saveAs(exportPath);
  await p.reload({ waitUntil: "domcontentloaded" });
  await p.locator("#import").setInputFiles(exportPath);
  await p.locator("#run").click();
  let btext = await p.locator("#forecast-cards").innerText(),
    info2 = await p.locator("#evaluation-info").innerText();
  if (a !== btext || info !== info2)
    throw Error("JSON roundtrip results changed");
  console.log("experiment export/import reproduced predictions and metrics");
  await p.locator("#freeze").click();
  await p.locator("#holdout").fill("2020-01-01T12:00");
  await p.locator("#holdout-run").click();
  console.log("holdout guard:", await p.locator("#status").innerText());
  if (!(await p.locator("#status").innerText()).includes("不早于"))
    throw Error("holdout guard missing");
  await p.locator("#add-measurement").click();
  await p.locator("#run").click();
  if (!(await p.locator("#data-errors").innerText()).includes("测量需"))
    throw Error("invalid data guard missing");
  console.log("invalid input blocked; page errors:", errors);
  if (errors.length) throw Error(errors.join(";"));
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
