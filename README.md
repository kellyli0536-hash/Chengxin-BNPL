# BNPL CLIPS Expert System

## Batch classroom test (100 fictional cases)

The workbench includes a separate batch-test section below the individual evaluation flow. Its deterministic [fictional CSV sample](examples/fictional_batch_100.csv) loads automatically, so **Run batch evaluation** works immediately without an upload. You may still download the sample or choose/drop a different fictional CSV. The sample contains 100 distinct fictional IDs and all 14 input fields. Empty cells mean unavailable data, not zero. The server evaluates each row with the same CLIPS rules as the individual flow and returns the ID, decision, final limit, and any hard-rule or evidence-cap ID. Invalid rows are reported individually. Select one result to run the existing target-limit diagnosis for that case; the 100 cases are not automatically diagnosed.

Regenerate the sample with `python -m tools.generate_batch_demo` or `python tools/generate_batch_demo.py` from the project root. The batch endpoint accepts 1–100 records per request and does not store applicant records. Use fictional test data only; this is not a real credit decision or a production load test.

This prototype integrates the agreed BNPL rules with Python through CLIPSPy.

## 浏览器前端

安装依赖后，在 PyCharm 中右键运行 `web_app.py`，或在项目目录运行：

```bash
python web_app.py
```

然后在浏览器打开 `http://127.0.0.1:8765`。首页上方提供四类紧凑的虚构示例，一点即可填入下方表单；也可从空白表单手动填写全部 14 个字段。填写后直接进入确认页，仍可按类别返回修改，确认后才提交评估。页面展示审批额度、规则解释和目标额度诊断。页面最下方是批量测试区：内置 100 条虚构资料，点“开始批量评估”即可一次评估全部，也可上传自己的虚构 CSV。本地运行默认仅监听本机，程序不保存申请记录。若 8765 端口已被占用，可用 `python web_app.py --port 8766`，再打开对应端口。

页面右上角可在中文与 English 之间切换。切换仅改变前端文字，不改变输入资料、CLIPS 规则或计算结果；语言偏好保存在当前浏览器。英文诊断以结构化规则编号和数值生成，不把条件模拟表述为已经获批。

前端使用 Python 标准库提供本地网页服务；除了原有的 `clipspy`，不需要再安装 Web 框架。直接双击 `static/index.html` 无法调用规则接口，必须先启动 `web_app.py`。

## 云端公开演示

项目包含 `render.yaml`、`.python-version` 和 `/healthz` 健康检查，已作为 Render Web Service 部署：[公开演示网站](https://bnpl-expert-demo-2kx9.onrender.com)。部署与维护步骤见 [DEPLOYMENT.md](DEPLOYMENT.md)。公开展示只可使用虚构资料，切勿输入真实个人信用信息。

## Setup

Create a virtual environment and install the dependency:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

## Run the example

```bash
python bnpl_expert.py
```

To run a different JSON file:

```bash
python bnpl_expert.py my_applicant.json
```

To see the evidence cap in action, run
`python bnpl_expert.py example_sparse_new_applicant.json`.

The command prints a JSON decision containing:

- application or limit-review branch;
- final decision and approved limit;
- combined certainty factor;
- raw CF sum and applicable positive CF maximum;
- evidence coverage, CF-based limit and evidence tier cap;
- `data_gaps`: missing inputs that were not simply ignored, each with a `treatment` of `hard-rule-failed` or `worst-case`;
- hard decision, when one is triggered;
- every triggered soft rule and its explanation;
- derived credit-limit utilisation rate.

## Run tests

```bash
python -m unittest discover -s tests -v
```

## Missing values

Use JSON `null` for missing optional values. A missing soft-rule input is not
asserted into CLIPS, so it neither earns nor loses CF. New applicants must set
both `current_credit_limit` and `available_credit_limit` to `null`.

Two optional inputs are also needed by hard rules: `adverse_credit_incidents_6m`
(HR-03) and `external_credit_score` (HR-05). If either is missing, the red line
cannot be checked, so the hard rule fires as if it had failed (new applicant
rejected, existing user suspended, limit 0) and the field is listed in
`data_gaps`.

Two soft-rule inputs can carry negative evidence: `external_overdue_record`
(down to SR-25, -0.70) and, for existing users, `repayment_fulfilment_rate`
(down to SR-10, -0.50). If either is missing it is scored at that worst value
and its group stays in the CF denominator, so the result is exactly the same as
reporting the worst value. It is listed in `data_gaps` with treatment
`worst-case`, and it does not count towards evidence coverage.

Together these rules guarantee that hiding negative information never helps:
a missing hard-rule or negative-evidence field is never better than a bad value.
Positive-only fields (spending, completed orders, on-time streak) are different:
a missing value earns nothing and is left out of the denominator, while the
evidence cap limits how far a profile with missing positive evidence can go.

Input keys and values are checked strictly: an unknown or misspelt key, `null`
in a required field, a fractional or boolean count (orders, repayments, adverse
incidents), and a non-finite or boolean amount or rate (`NaN`, `Infinity`) all
return a clear validation error instead of being evaluated. The web API also
rejects the JSON literals `NaN` and `Infinity`.

## CF calculation

The final CF is `max(0, sum of triggered soft-rule CFs / applicable positive
CF maximum)`. The denominator includes the highest positive CF of each
applicable group whose input field has a value; negative rules do not add to
the denominator. A missing positive-only field (spending, orders, on-time streak)
adds nothing to either side. A missing negative-evidence field (overdue record;
fulfilment rate for existing users) is the exception: it is scored at its worst
value and its group stays in the denominator (see Missing values). A new applicant
does not use repayment fulfilment, consecutive repayments, or credit-limit
utilisation. With all inputs available, the maximum is 2.50 for a new applicant
and 4.00 for an existing user. A hard rule skips CF calculation entirely.

Account age from 1 through 5 months fires no rule, but the account-age group
still counts in the applicable maximum, so such a user cannot earn that group's
0.35. The SR-05 positive interval is 6 through 11 months. A prepaid card is
treated like no bank card (SR-03, -0.25).

## Evidence tier cap

The CF formula and hard/soft rules are unchanged. After the CF-based limit is
found, every evaluation receives an evidence-coverage cap from CLIPS rules
EC-01 through EC-03. Coverage is the positive CF maximum of the groups whose value was actually
provided (`observed_positive_max`), divided by the complete positive maximum
(2.50 for a new applicant, 4.00 for an existing user). It differs from the CF
denominator (`applicable_positive_cf_max`), which also includes groups scored at
their worst value: for example, an existing user with no overdue record has a CF
denominator of 4.00 but a coverage of 3.70 / 4.00 = 92.5%. It measures availability of the positive soft-rule input
groups, not the quality of the values.

| Evidence coverage | Maximum limit |
| --- | ---: |
| `< 0.70` | CNY 1,000 |
| `0.70 to < 0.90` | CNY 5,000 |
| `>= 0.90` | CNY 10,000 |

The final limit is the smaller of the CF-based limit and the cap, for new and
existing users alike, so every result is one of the four tiers. An existing
user whose evidence is too sparse can therefore be moved down a tier at review.
The cap can only reduce a limit, never increase it. A hard rule still takes
precedence and sets the limit to zero. These coverage thresholds are project
policy choices, not empirically calibrated credit-risk thresholds.

## Decision mapping

| Combined CF | Decision | Limit |
| --- | --- | ---: |
| `< 0.40` | Rejected | CNY 0 |
| `0.40 to < 0.60` | Conditional approval | CNY 1,000 |
| `0.60 to < 0.85` | Approved | CNY 5,000 |
| `>= 0.85` | Approved | CNY 10,000 |

Hard rules are evaluated before the CF-based result. Every triggered hard rule
sets the limit to zero; `decision` is `rejected` for a new applicant and
`suspended` for an existing user, and `hard_decision.action` keeps the raw
CLIPS action (`reject` or `suspend`).

| Source | `decision` values |
| --- | --- |
| Hard rule (HR-01 to HR-05, including missing HR-03/HR-05 inputs) | `rejected`, `suspended` |
| CF mapping and evidence cap | `rejected`, `conditional-approval`, `approved` |

## PyCharm 使用说明

1. 解压 ZIP 后，在 PyCharm 中选择 **Open**，打开解压后的整个项目文件夹（包含 `bnpl_expert.py` 和 `rules` 的文件夹）。
2. 在 **Settings → Project → Python Interpreter** 中选择项目里的 `.venv/bin/python`；如果 ZIP 中没有 `.venv`，在 PyCharm 中新建虚拟环境，然后在底部 **Terminal** 执行 `python -m pip install -r requirements.txt`。安装包叫 `clipspy`，代码导入名叫 `clips`。
3. 右键 `bnpl_expert.py` → **Run**。不填参数时，程序读取同目录的 `example_applicant.json`。
4. 要用自己的数据，复制 `example_applicant.json` 并命名为 `my_applicant.json`，只修改其中的值。然后进入 **Run → Edit Configurations**，在 **Script parameters** 填 `my_applicant.json`；**Working directory** 选择项目文件夹。
5. 也可以直接在 PyCharm 的 Terminal 运行 `python bnpl_expert.py my_applicant.json`。

JSON 注意事项：布尔值写 `true`/`false`；缺失数据写 `null`，不要写字符串 `"无"`；枚举值如 `"Credit"`、`"Stable"` 要加双引号。履约率用 0–1，例如 98% 写 `0.98`。新申请人把 `current_credit_limit` 和 `available_credit_limit` 都写成 `null`；已有用户两项都写数字，单位是人民币元。`external_overdue_record` 的字符串 `"None"` 表示确认没有外部逾期，JSON `null` 表示没有取得该字段的数据。

## 目标驱动反向诊断

单独运行 `backward_diagnosis.py`，不传参数会读取 `example_diagnosis_applicant.json`，检查10,000元目标：

```bash
python backward_diagnosis.py
python backward_diagnosis.py my_applicant.json --target 5000
```

PyCharm 中可直接右键运行该文件。使用自己的资料时，在 **Run → Edit Configurations → Script parameters** 填 `my_applicant.json --target 10000`。

诊断以目标额度为根节点生成 `goal_proof_tree`：硬规则通过、信息覆盖率允许目标档位、CF 达到目标门槛，三项必须同时成立。即使同时存在信息封顶与 CF 不足，证明树也会展示两处差距；硬规则阻断时 CF 标为“未评估”，不虚构为 0 分。`conclusion` 是面向前端的一句话结论，`improvement_paths` 列出已由 CLIPS 重算验证的条件性方案；原有返回字段继续保留。

系统对注册时长、完成订单数、连续按时还款次数、额度使用率、月均消费、履约率（老用户）和外部信用分作**单项条件模拟**。履约率、月均消费和外部信用分的变化明确标为假设情景。若没有任何单项变化达到目标，诊断会测试**不同字段的两项组合**，在 `combined_change_scenarios` 中列出具体需同时变化的两项条件。每个模拟都重新运行相同的CLIPS规则，只有实际达到目标额度才标记 `reaches_goal: true`。模拟结果不是当前达标状态，也不保证未来审批结果；双项测试未找到方案不代表不存在更复杂的改善路径。

新用户或老用户若因信息覆盖率封顶而无法达到目标，诊断会返回 `blocked-by-evidence-cap` 和缺失的软规则输入字段。补充真实资料后须重新计算；补齐字段本身不保证提额。
