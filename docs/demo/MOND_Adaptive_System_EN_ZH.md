# MOND: A Personal Physiological World Model
# MOND：个人生理世界模型

[English–Chinese slides / 中英双语演示文稿](MOND_Adaptive_System_EN_ZH.pptx) · 5 November 2026

## Full scope / 完整范围

MOND models how a person changes over time through interacting physiology, personal characteristics, behavior and context. The original report defines **18 factors**. Menstrual cycle adds one optional context factor within this broader system.

MOND 通过生理、个人特征、行为与情境的相互作用，刻画个体随时间的变化。原始报告定义了 **18 项因素**；月经周期是这一完整系统中新增的可选背景因素。

| Domain / 领域 | Original factors / 原始因素 |
|---|---|
| Physiological observations / 生理观测 | HRV, resting heart rate, sleep, physical activity / HRV、静息心率、睡眠、身体活动 |
| Personal profile / 个人画像 | Age, height, education level / 年龄、身高、教育背景 |
| Behaviors and recommendation areas / 行为与建议领域 | Diet, daily habits, sport and exercise, work, reading habit, meditation habit / 饮食、日常习惯、运动训练、工作、阅读习惯、冥想习惯 |
| Temporal context / 时间背景 | Time of day, season / 时段、季节 |
| Health context and research endpoints / 健康背景与研究终点 | Heart failure, mental health, life expectancy / 心力衰竭、心理健康、预期寿命 |
| Added personal context / 补充个人背景 | Menstrual cycle / 月经周期 |

These factors have different roles: some are measurements, others describe the person or an event, and some are outcomes to study. Their inclusion in the research architecture does not make them interchangeable numerical inputs.

这些因素承担不同角色：有些是观测，有些描述个体或事件，有些属于研究终点；不能简单地把它们都当作同类数值输入。

## How the world model works / 世界模型如何运作

1. **Observe:** align measurements, quality, profile and events on a common timeline. / **观测：**将测量、质量、画像与事件放在统一时间线上。
2. **Represent state:** distinguish long-term personal level from short-term changes. / **表征状态：**区分个人长期水平与短期偏移。
3. **Predict transitions:** use context, elapsed time, delayed effects and interactions to forecast trajectories with uncertainty. / **预测转移：**结合情境、时间间隔、延迟影响及因素互动，预测变化轨迹与不确定性。
4. **Support action:** offer feasible options for habits, activity, work and diet. / **支持行动：**在习惯、活动、工作与饮食领域提供可行选项。
5. **Learn from feedback:** record execution and subsequent physiology, sleep, behavior, energy and fatigue. / **通过反馈学习：**记录执行情况及后续生理、睡眠、行为、精力与疲劳变化。

The target architecture uses shared population learning and personal adaptation across acute, overnight and multiday timescales. Reading, meditation, meals and work require explicit context or logs. Device quality, missingness and data arrival determine what the model can reliably use.

目标架构结合群体共享学习与个人适配，覆盖即时、夜间与多日尺度。阅读、冥想、进食与工作需要明确的情境或日志。设备质量、缺失情况与数据到达时间决定模型可使用的信息。

## Current prototype and development / 当前原型与建设路径

| Current / 当前 | Full model development / 完整模型建设 | Action learning / 行动学习 |
|---|---|---|
| Personal HRV forecasting, optional sleep/activity/RHR/cycle inputs, editable settings, comparisons and rule suggestions. / 个人 HRV 预测，可选睡眠、活动、静息心率与周期输入，可调参数、对照与规则建议。 | Integrate the full factor/event schema, hierarchical personal dynamics, delayed interactions and calibrated uncertainty. / 整合完整因素与事件体系、分层个人动态、延迟互动与经检验的不确定性。 | Test prompts and actions, then personalize support using prospective outcomes. / 检验提示与行动，再根据前瞻性结果优化个人支持。 |

The complete world model is the research and product architecture. The current lab implements its initial forecasting component. Heart-failure, psychiatric and survival endpoints require separate clinical or long-term research validation.

完整世界模型是研究与产品的总体架构，当前实验页实现其中的初步预测部分。心力衰竭、精神健康诊断与生存终点需独立的临床或长期研究验证。

## Interaction / 如何体验

1. Open the app and find the forecast after **Personal Context**. / 打开用户端，在 **Personal Context** 下方查看预测与建议。
2. In the lab, select **载入合成示例**, then **运行预测与回测**. / 在实验页载入示例并运行预测与回测。
3. Save A, change one setting and run B. / 保存 A，修改一个参数后运行 B。
4. Select **保存到此浏览器**. Return to the same-origin app, then **Explore forecast options → Use my saved prediction**. / 主动保存后，返回同一来源的用户端，在预测选项中读取结果。

[Local app / 本地用户端](http://localhost:8000/index.html#user-prediction) · [Local lab / 本地实验页](http://localhost:8000/prediction-lab.html)  
[Hosted app / 托管用户端](https://mond-hrv-prediction-lab.muxueqianxun.chatgpt.site/app.html#user-prediction) · [Hosted lab / 托管实验页](https://mond-hrv-prediction-lab.muxueqianxun.chatgpt.site/)

The default 46.9 ms forecast is a labeled synthetic example. Selecting a suggestion expresses a temporary intention. Saved results are dated snapshots. Export/import JSON to transfer an experiment between devices; hosted access requires the owner's account.

默认 46.9 ms 预测是明确标注的合成示例。勾选建议仅表达临时意向；保存结果是带时间戳的快照。通过导出、导入 JSON 跨设备迁移实验，托管访问需所有者账号。

## Sources / 参考来源

Scope follows *HRV Evidence and World Model Development Report* (31 October 2026) and the original staged product plan. [All 39 original paper references, factor mapping and additional cycle/system references / 原始 39 篇论文、因素映射及补充周期与系统文献](MOND_World_Model_References.md).
