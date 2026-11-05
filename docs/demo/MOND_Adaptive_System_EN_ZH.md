# MOND: A Personal Physiological World Model
# MOND：个人生理世界模型

[English–Chinese slides / 中英双语演示文稿](MOND_Adaptive_System_EN_ZH.pptx) · 5 November 2026

## Full scope / 完整范围

MOND models how a person changes over time through interacting physiology, personal characteristics, behavior and context. The original report defines **18 factors**. Menstrual cycle adds one optional context factor within this broader system.

MOND 综合生理数据、个人特征、生活习惯和所处环境，理解一个人的状态如何随时间变化。原始报告涵盖 **18 项因素**；月经周期是后来补充的一项可选生理信息。

| Domain / 领域 | Original factors / 原始因素 |
|---|---|
| Physiological observations / 生理与活动数据 | HRV, resting heart rate, sleep, physical activity / HRV、静息心率、睡眠、身体活动 |
| Personal profile / 个人基本信息 | Age, height, education level / 年龄、身高、受教育程度 |
| Behaviors and recommendation areas / 生活习惯与建议方向 | Diet, daily habits, sport and exercise, work, reading habit, meditation habit / 饮食、日常习惯、运动训练、工作、阅读习惯、冥想习惯 |
| Temporal context / 时间因素 | Time of day, season / 一天中的时段、季节 |
| Health context and research endpoints / 健康背景与研究方向 | Heart failure, mental health, life expectancy / 心力衰竭、心理健康、预期寿命 |
| Added personal context / 补充生理信息 | Menstrual cycle / 月经周期 |

These factors have different roles: some are measurements, others describe the person or an event, and some are outcomes to study. Their inclusion in the research architecture does not make them interchangeable numerical inputs.

这些因素的用途不同：有些是实际测得的数据，有些是个人信息或生活记录，还有些是需要长期研究的健康结果。模型会根据各自的用途处理，而不是把它们简单地放进同一个计算公式。

## How the world model works / 世界模型如何工作

1. **Observe:** align measurements, quality, profile and events on a common timeline. / **采集信息：**按时间整理测量结果、数据质量、个人信息和生活记录。
2. **Represent state:** distinguish long-term personal level from short-term changes. / **了解状态：**区分个人长期水平和近期变化。
3. **Predict transitions:** use context, elapsed time, delayed effects and interactions to forecast trajectories with uncertainty. / **预测变化：**结合生活背景、时间间隔和因素间的相互影响，估计接下来的变化及可能范围。
4. **Support action:** offer feasible options for habits, activity, work and diet. / **给出建议：**围绕生活习惯、活动、工作和饮食，提供当下做得到的选择。
5. **Learn from feedback:** record execution and subsequent physiology, sleep, behavior, energy and fatigue. / **根据反馈调整：**记录是否执行建议，以及之后的生理指标、睡眠、行为、精力和疲劳变化。

The target architecture uses shared population learning and personal adaptation across acute, overnight and multiday timescales. Reading, meditation, meals and work require explicit context or logs. Device quality, missingness and data arrival determine what the model can reliably use.

完整模型计划结合群体数据和个人历史，分析即时、夜间及连续多日的变化。阅读、冥想、进食和工作情况需要由用户记录或通过明确的数据来源获取。模型还会考虑测量质量、缺失数据，以及这些信息何时可用。

## Current prototype and development / 当前进展与后续计划

| Current / 当前 | Full model development / 完整模型的建设 | Action learning / 学习行动效果 |
|---|---|---|
| Personal HRV forecasting, optional sleep/activity/RHR/cycle inputs, editable settings, comparisons and rule suggestions. / 已支持个人 HRV 预测，可加入睡眠、活动、静息心率和月经周期信息，调整参数、比较结果并查看规则生成的建议。 | Integrate the full factor/event schema, hierarchical personal dynamics, delayed interactions and calibrated uncertainty. / 整合完整因素和生活记录，建立兼顾个体差异、延迟影响及因素互动的动态模型，并检验预测范围是否可靠。 | Test prompts and actions, then personalize support using prospective outcomes. / 通过试验评估提示和行动的效果，再根据后续实际结果调整个人建议。 |

The complete world model is the research and product architecture. The current lab implements its initial forecasting component. Heart-failure, psychiatric and survival endpoints require separate clinical or long-term research validation.

完整世界模型是整个项目的研究与产品框架，当前实验页实现了其中的初步预测功能。心力衰竭、精神障碍诊断及寿命预测，需要另行开展临床或长期研究验证。

## Interaction / 如何体验

1. Open the app and find the forecast after **Personal Context**. / 打开 App，在 **Personal Context（个人情况）** 下方查看预测与建议。
2. In the lab, select **载入合成示例**, then **运行预测与回测**. / 在实验页点击 **载入合成示例**，再点击 **运行预测与回测**。
3. Save A, change one setting and run B. / 保存方案 A，修改一个参数，再运行方案 B。
4. Select **保存到此浏览器**. Return to the same-origin app, then **Explore forecast options → Use my saved prediction**. / 点击 **保存到此浏览器**，再打开同一网站的 App，在 **Explore forecast options（预测选项）** 中点击 **Use my saved prediction（查看已保存的预测）**。

[Local app / 本地 App](http://localhost:8000/index.html#user-prediction) · [Local lab / 本地实验页](http://localhost:8000/prediction-lab.html)  
[Hosted app / 在线 App](https://mond-hrv-prediction-lab.muxueqianxun.chatgpt.site/app.html#user-prediction) · [Hosted lab / 在线实验页](https://mond-hrv-prediction-lab.muxueqianxun.chatgpt.site/)

The default 46.9 ms forecast is a labeled synthetic example. Selecting a suggestion expresses a temporary intention. Saved results are dated snapshots. Export/import JSON to transfer an experiment between devices; hosted access requires the owner's account.

默认显示的 46.9 ms 来自模拟数据，页面已注明仅供演示。勾选建议只表示你想尝试，不代表已经完成。保存的结果对应当时的计算时间；如需在其他设备继续，可导出并导入 JSON 实验包。在线网站目前需要所有者账号登录。

## Sources / 参考来源

Scope follows *HRV Evidence and World Model Development Report* (31 October 2026) and the original staged product plan. [All 39 original paper references, factor mapping and additional cycle/system references / 原始 39 篇论文、各因素对应的研究，以及补充的月经周期与复杂适应系统文献](MOND_World_Model_References.md).
