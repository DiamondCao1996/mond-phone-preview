# MOND: An Adaptive Personal HRV System
# MOND：个人 HRV 适应系统

[English–Chinese slides / 中英双语演示文稿](MOND_Adaptive_System_EN_ZH.pptx) · 5 November 2026

## The idea / 核心思路

MOND connects physiological observations, personal context and user choices in an adaptive feedback system. It compares recent measurements with personal history, offers a forecast and suggests a manageable next step.

MOND 将生理观测、个人情境与自主选择连接为适应性反馈系统。通过近期测量与个人历史比较，提供预测与可尝试的小步骤。

**Today:** a simplified personal forecasting prototype with editable settings and separate suggestion rules. **Next:** test predictions on future real data and learn from recorded actions and outcomes.

**当前：**可调参数的简化个人预测原型，建议规则独立运行。**后续：**用未来真实数据检验预测，并通过行动与结果记录学习个人响应。

## Try it / 如何体验

| Step / 步骤 | Interaction / 操作 |
|---|---|
| 1. View / 查看 | Open the app and find the forecast after **Personal Context**. / 打开用户端，在 **Personal Context** 下方查看预测与建议。 |
| 2. Explore / 探索 | In the lab, select **载入合成示例**, then **运行预测与回测**. / 在实验页载入合成示例，运行预测与回测。 |
| 3. Compare / 比较 | Save A, change one setting, then run B. / 保存 A，修改一个参数，再运行 B。 |
| 4. Save / 保存 | Select **保存到此浏览器**. In the app, open **Explore forecast options → Use my saved prediction**. / 主动保存后，在用户端预测选项中读取结果。 |

[Local app / 本地用户端](http://localhost:8000/index.html#user-prediction) · [Local lab / 本地实验页](http://localhost:8000/prediction-lab.html)  
[Hosted app / 托管用户端](https://mond-hrv-prediction-lab.muxueqianxun.chatgpt.site/app.html#user-prediction) · [Hosted lab / 托管实验页](https://mond-hrv-prediction-lab.muxueqianxun.chatgpt.site/)

The hosted site requires the owner's account. Save and view on the same origin. Export/import the JSON experiment package to move between devices.

托管站点需要所有者账号。在同一来源保存与读取；跨设备通过导出、导入 JSON 实验包迁移。

## Reading the result / 如何理解结果

- **Synthetic example:** 46.9 ms, +10.2% versus personal reference. These are demonstration values. / **合成示例：**46.9 ms，较个人参考高 10.2%，仅用于演示。
- **Suggestions:** choosing one expresses a temporary intention. It does not record completion or change the prediction. / **建议：**勾选仅表示临时意向，不记录完成情况，也不改变预测。
- **Cycle context:** optional and off by default. Record phase and source, then test its personal predictive value. [2, 3] / **周期背景：**自愿提供、默认关闭。记录阶段及来源，再检验个人预测价值。[2, 3]
- **Evidence:** A/B compares assumptions. Future observations test accuracy; action trials test whether advice helps. [4] / **证据：**A/B 比较模型假设，后续观测检验准确性，行动试验检验建议是否有效。[4]

## Papers / 论文参考

These papers inform the system framing and research design. They do not validate the MOND forecaster or provide its fitted weights.

以下论文支持系统框架与研究设计，并非对 MOND 预测效能的直接验证，也未提供本模型的拟合权重。

1. **Holland, J. H. (1992).** [Complex Adaptive Systems](https://www.jstor.org/stable/20025416). *Daedalus, 121*(1), 17–30.  
   System framing / 复杂适应系统框架。
2. **Schmalenberger et al. (2019).** [A Systematic Review and Meta-Analysis of Within-Person Changes in Cardiac Vagal Activity across the Menstrual Cycle: Implications for Female Health and Future Studies](https://doi.org/10.3390/jcm8111946). *Journal of Clinical Medicine, 8*(11), 1946.  
   Cycle-related variation / 周期相关变化。
3. **Schaffarczyk et al. (2026).** [Cardiac autonomic regulation across the menstrual cycle is highly individual: evidence from phase-aligned cyclic generalized additive mixed models](https://doi.org/10.1152/ajpregu.00028.2026). *American Journal of Physiology-Regulatory, Integrative and Comparative Physiology, 330*(6), R623–R630.  
   Individual cycle dynamics / 个体周期动态。
4. **Klasnja et al. (2019).** [Efficacy of Contextually Tailored Suggestions for Physical Activity: A Micro-randomized Optimization Trial of HeartSteps](https://doi.org/10.1093/abm/kay067). *Annals of Behavioral Medicine, 53*(6), 573–582.  
   Testing contextual prompts / 检验情境化提示效果。
