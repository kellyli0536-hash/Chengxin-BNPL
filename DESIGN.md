# 橙信：代码与界面设计交接说明

本项目是课堂演示用的网购平台“先用后付”专家系统，不是实际授信产品。所有预设情景均为虚构数据；公开演示时请勿输入真实个人资料。

## 界面流程

首页采用橙白配色。上方是四个紧凑的虚构用户情景，下方是完整的手动资料表单，按基本信息、平台行为、信用与额度分组；页面最下方是独立的批量测试区。选择预设会填入表单；之后仍可修改任一字段，修改后不再把资料标记为原预设。申请类型可选择新用户申请或老用户额度审核。

表单校验通过后直接进入资料确认页，用户可返回对应类别继续编辑。确认提交后，结果页展示审批结论、额度、CF、触发的软/硬规则和目标额度诊断。目标诊断属于假设情景模拟，不代表承诺提额。

## 模块与数据流

`static/index.html`、`static/styles.css`、`static/app.js` 实现页面、样式和交互；`static/batch.js` 实现批量测试区（读取 CSV、调用批量接口、汇总与逐条诊断）；`examples/fictional_batch_100.csv` 是由 `tools/generate_batch_demo.py` 生成的 100 条虚构资料；`web_app.py` 提供页面与 JSON 接口；`bnpl_expert.py` 将输入送入 `rules/bnpl_rules.clp`，输出规则结论；`backward_diagnosis.py` 基于既有规则结果建立目标证明树，测试单项和双项字段变化。`tests/` 包含规则、反向诊断和网页接口测试。

`POST /api/evaluate` 负责当前审批评估；`POST /api/batch-evaluate` 一次接受 1–100 条 `{user_id, applicant}`，逐条运行同一套 CLIPS 规则，单条资料错误不影响其他行；`POST /api/diagnose` 接受目标额度并返回目标诊断。评估与诊断接口均以 JSON 输入 `applicant` 对象，诊断接口另可传 `target_limit`（1000、5000、10000）。反向诊断的候选变化需重新通过原有 CLIPS 规则评估，不另设一套审批规则。

## 输入与结论约定

硬规则所需的“近半年失信次数”和“外部信用分”若缺失，视为对应硬规则未通过（额度 0）；可能带来扣分的“外部逾期记录”和老用户“履约率”若缺失，按最差值计分（SR-25 / SR-10）。两类情况都会列在 `data_gaps` 中，因此隐去负面资料永远不会得到更好的结果。未知字段名、必填字段为 null、次数字段不是整数、金额或比率不是有限数值（NaN、Infinity）都会直接报错。`decision` 取值统一为 `rejected`、`suspended`、`conditional-approval`、`approved`。

## 部署边界

本项目需要 Python 后端与 CLIPSPy；不能仅将 `static/` 放到 GitHub Pages。根目录的 `render.yaml` 是 Render Blueprint 配置。将解压后的项目源码上传到 Git 仓库，再按 `DEPLOYMENT.md` 创建 Web Service 才会得到可供其他设备访问的 HTTPS 地址。

系统目前没有账号、限流、生产审计或真实金融风险校准，只适合作为课程演示。
