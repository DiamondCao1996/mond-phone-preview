# MOND phone preview

Built MOND 0.3.0 interface. Safari supports sample sessions, local notes and preferences, companion themes, and manual music. Native Bluetooth sensor recording requires the native app.

Static preview assets only; no personal recordings or server credentials. Music is supplied from the existing desktop example collection by Miracle Waves, Miracle Wake and Binaural Beats MW. Frequency labels do not establish health benefits.

## HRV 预测实验室

启动静态服务器：`python3 -m http.server 8000`，打开 `http://localhost:8000/prediction-lab.html`，或从主页页脚进入。页面仅在浏览器本地计算；本地保存由用户主动触发。可下载 CSV 模板、导入 CSV / JSON、编辑记录、载入标注的合成示例，并导出完整 JSON 实验包。导入实验包恢复数据、配置、模型来源和结果；文件包含健康数据，请自行管理存储和分享。

### 数据格式

CSV 一行一个事件；表头是 `id,type,user,time,timezone,arrival,start,modality,source,device,algorithm,duration,posture,breathing,quality,rmssd,sleep,activity,rhr,energy,fatigue,work,diet`。时间为带 UTC 偏移的 ISO 8601，timezone 为 IANA 时区。measurement 需要 modality（PPG 或 ECG）、设备、算法、秒数、姿势、呼吸、质量及正的 RMSSD（ms）；context 可通过 source 记录背景来源，其 start 和 time 分别是背景开始、结束，arrival 是信息实际可用时间。sleep 为小时，activity 为步，rhr 为 bpm，energy/fatigue 为 1–5，work 和 diet 为 0/1；diet 表示用户明确记录的饮食背景，用户自行定义其含义。缺失用空白表示。当前只处理已计算的 RMSSD 与用户给定的质量标签，不处理原始 PPG 或判定传感器是否准确。

### 算法与验证边界

对每人、PPG／ECG 来源、设备、算法、姿势、呼吸方式、记录长度和相近当地时段，按日等权计算历史 lnRMSSD 参考 μ（默认 28 天，不含当天）。默认 7 个不同日期才开放个人比较、14 天标记较成熟。默认设备和算法选预测时最新的可用测量；也可显式指定。可手填参考开展情景实验，手填项不代表个人历史。

实验模型为 `lnRMSSD_hat = μ + exp(-Δt/τ) * (lnRMSSD_last - μ) + Σ β_j * (x_j - ref_j)`。Δt 为目标距最近测量的小时数；τ、特征、系数、参考与所有筛选阈值均可修改。睡眠、活动和静息心率的参考值可手填，否则为历史每日均值。背景系数默认零，不是论文估计；缺少启用的背景值时不输出实验模型。显示的 `exp(lnRMSSD_hat)` 为条件中位数形式的 RMSSD 估计，不能保证预测分布已校准。手动参考且没有测量时，偏移项为零，明确标记为情景实验。

拟合在固定 τ 下用岭回归拟合已启用的背景系数，每个日期的样本总权重相同；默认最少 `max(30, 10 × 系数数)` 个训练日期，正则化参数可调整。回测按照预测起点排序，只使用在该时刻已到达的观测；目标为默认 24 小时后、容差 ±2 小时的最近合格测量，目标缺失不计入评分，目标不会重复使用。所有展示的模型指标使用相同有效样本，背景模型不能拟合时不评分。当前实验模型使用手动系数，或在每个回测起点重新拟合；其他基线包括上次值、个人参考、自回归及单独拟合截距、仅以睡眠／活动／静息心率为输入的无 HRV 背景模型（历史 HRV 仅作为拟合目标）。背景对照默认使用三个特征；实验模型启用了特征时，对照使用相同的已启用特征。经验区间使用此前已到达的样本外绝对残差，默认至少 30 个不同日期；后续样本用于估计覆盖率，不保证覆盖。样本外指时间顺序上排除目标，并不保证用户未根据回测调参。

调整参数后的回测为探索性分析。可冻结配置，然后对冻结后的新预测起点执行留出评估；这不能替代独立前瞻研究。合成数据只用于检查功能。PRV 不等同于经过本设备验证的 ECG HRV；本页不作疾病诊断或行动效果预测。规则及系数是可编辑的研究假设，建议并不自动确定原因。

研究参考：[FLIRT](https://github.com/im-ethz/flirt)（特征提取）、[FitRec](https://github.com/nijianmo/fit-rec)（运动心率）、[HeartSteps](https://github.com/StatisticalReinforcementLearningLab/HeartstepsV1Code)（干预分析）、[生理世界模型框架](https://arxiv.org/abs/2608.15309)（概念）、[个体睡眠分布研究](https://pubmed.ncbi.nlm.nih.gov/42833133/)。本页面未引用这些库的代码或预训练权重。

运行计算测试：`node tests/prediction-lab.test.js`。

浏览器回归可在静态服务器运行于 8765 端口时执行（需要 Chrome；依赖安装在临时目录，不修改仓库）：

```sh
npm install --prefix /tmp/mond-lab-browser playwright-core@1.31.2 --no-save
NODE_PATH=/tmp/mond-lab-browser/node_modules CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node tests/browser-smoke.js
```

如服务器地址不同，可设置 `LAB_URL`。

## Menstrual cycle update (v1.1)

Optional `cycleLuteal` is a lagged, explicitly recorded context input (0 follicular, 1 luteal); `cycleStatus=natural`, `cycleMethod=self_report|calendar|LH|hormone`, and `cycleId` preserve applicability and provenance. Missing/unknown is not follicular. Calendar labels remain estimates. No fixed 28-day assumption, ovulation inference, population correction, or phase-specific lifestyle prescription is applied. Other reproductive contexts can be recorded with status and a missing phase value; natural-cycle effects are not extrapolated to hormonal contraception, pregnancy, menopause or unknown contexts.

The new feature is disabled with coefficient zero by default. When enabled, its contribution is `beta_cycle * (known_phase_at_origin - historical_phase_reference)`. The model uses information available at forecast origin, not the eventual target-day phase. Its reference, coefficient and training gates are editable. Fitting requires both phases represented on at least 5 different dates and 2 recorded cycle IDs (engineering defaults, not validation criteria). Fitting still uses chronological, per-user training and now reports a no-cycle ablation on identical evaluation samples. Prospective multi-cycle performance must justify retaining the feature. Old experiment configurations import with the feature disabled.

Research checked 2026-11-04:

| Source | Finding/model | Reuse boundary |
|---|---|---|
| [Schmalenberger et al. 2019](https://pmc.ncbi.nlm.nih.gov/articles/PMC6912442/) | Within-person meta-analysis: 37 studies, 1,004 participants; follicular-to-luteal cardiac vagal activity difference d=-0.39 (95% CI -0.67 to -0.11). | Pooled CVA metrics are not an individual RMSSD percentage or a MOND coefficient. |
| [2024 wearable cardiovascular amplitude study](https://pmc.ncbi.nlm.nih.gov/articles/PMC11666598/) | 11,590 participants, 45,811 cycles; models quantify wearable RHR/RMSSD fluctuation amplitude. | Describes within-cycle patterns, not a validated short-rest PPG forecasting model. |
| [Schaffarczyk et al. 2026](https://pubmed.ncbi.nlm.nih.gov/42012497/) | Ovulation-aligned cyclic GAMMs: 21 participants, 62 cycles, 1,213 daily HRV observations; flat population lnRMSSD trajectory with significant individual deviations. | Supports testing personal patterns; retrospective cycle-length alignment cannot be used as future-known input. No pretrained MOND weights were reused. |

Cycle logs are optional sensitive data. They remain browser-local unless the user explicitly exports a package or saves in the browser; exported files include them.
