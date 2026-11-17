"""Goal-driven diagnosis for the BNPL expert system.

This module does not define another approval policy. It sets a target limit,
asks the existing CLIPS-based evaluator for the current result, builds a goal
proof tree, then tests one- and two-field changes at existing rule thresholds.

Run directly in PyCharm or from a terminal:
    python backward_diagnosis.py
    python backward_diagnosis.py my_applicant.json --target 10000
"""

from __future__ import annotations

import argparse
import json
from itertools import combinations
from decimal import Decimal, ROUND_CEILING
from pathlib import Path
from typing import Any, Iterator

from bnpl_expert import Applicant, evaluate_dict


TARGET_CF = {1000: 0.40, 5000: 0.60, 10000: 0.85}
DEFAULT_INPUT = Path(__file__).parent / "example_diagnosis_applicant.json"


def coverage_fields(applicant: Applicant) -> list[tuple[str, str, float]]:
    """Optional soft-rule inputs whose absence lowers evidence coverage."""
    fields = [
        ("average_monthly_spending", "月均消费", 0.30),
        ("completed_order_count", "完成订单数", 0.30),
        ("external_credit_score", "外部信用分", 0.55),
        ("external_overdue_record", "外部逾期记录", 0.30),
    ]
    if applicant.evaluation_type == "limit-review":
        fields += [
            ("repayment_fulfilment_rate", "按时履约率", 0.65),
            ("consecutive_on_time_repayments", "连续按时还款次数", 0.55),
        ]
    return fields


def goal_proof_tree(applicant: Applicant, current: dict[str, Any], target: int) -> dict[str, Any]:
    """Explain the current goal through the same hard, cap, and CF gates as approval."""
    hard_checks = (
        ("HR-01", "实名认证通过", applicant.identity_verified,
         applicant.identity_verified),
        ("HR-02", "年龄达到18岁", applicant.age, applicant.age >= 18),
        ("HR-03", "近半年失信次数少于2次", applicant.adverse_credit_incidents_6m,
         None if applicant.adverse_credit_incidents_6m is None
         else applicant.adverse_credit_incidents_6m < 2),
        ("HR-04", "设备状态不异常", applicant.device_stability,
         applicant.device_stability.lower() != "abnormal"),
        ("HR-05", "外部信用分高于450分", applicant.external_credit_score,
         None if applicant.external_credit_score is None
         else applicant.external_credit_score > 450),
    )
    hard_children = [
        {
            "id": rule_id, "label": label,
            "status": "unknown" if passed is None else "satisfied" if passed else "unsatisfied",
            "current_value": value, "rule_ids": [rule_id],
        }
        for rule_id, label, value, passed in hard_checks
    ]
    hard_blocked = current["hard_decision"] is not None
    hard = {
        "id": "SG-1", "label": "未触发硬规则", "operator": "AND",
        "status": "unsatisfied" if hard_blocked else "satisfied",
        "current_value": current["hard_decision"], "rule_ids": [x[0] for x in hard_checks],
        "reason": "硬规则优先，不能用软规则加分绕过。" if hard_blocked
                  else "当前资料未触发硬规则；未知字段不等于已验证为良好。",
        "children": hard_children,
    }

    if hard_blocked:
        coverage = {
            "id": "SG-2", "label": "信息覆盖率允许目标档位", "operator": "weighted-threshold",
            "status": "not-evaluated", "current_value": None, "required_value": None,
            "rule_ids": [], "reason": "硬规则已阻断，未计算信息封顶。", "children": [],
        }
        cf_goal = {
            "id": "SG-3", "label": "CF达到目标门槛", "operator": "weighted-sum",
            "status": "not-evaluated", "current_value": None,
            "required_value": TARGET_CF[target], "rule_ids": [],
            "reason": "硬规则已阻断，未计算CF。", "children": [],
            "candidate_path_ids": [],
        }
    else:
        required_coverage = {1000: 0.0, 5000: 0.70, 10000: 0.90}[target]
        reason = "缺失字段必须补充真实资料；补齐不保证CF达标。"
        if applicant.evaluation_type == "limit-review":
            reason += "老用户已持有的额度不因资料缺失被下调，但提额受覆盖率封顶限制。"
        coverage = {
            "id": "SG-2", "label": "信息覆盖率允许目标档位",
            "operator": "weighted-threshold",
            "status": "satisfied" if current["cap_ceiling"] >= target else "unsatisfied",
            "current_value": current["evidence_coverage"],
            "required_value": required_coverage,
            "rule_ids": [current["tier_cap"]["rule_id"]],
            "reason": reason,
            "children": [
                {
                    "id": name, "label": label,
                    "status": "unknown" if getattr(applicant, name) is None else "satisfied",
                    "current_value": getattr(applicant, name),
                    "coverage_weight": weight,
                }
                for name, label, weight in coverage_fields(applicant)
            ],
        }

        maximum = current["applicable_positive_cf_max"]
        required_raw = TARGET_CF[target] * maximum
        cf_goal = {
            "id": "SG-3", "label": "CF达到目标门槛", "operator": "weighted-sum",
            "status": ("satisfied" if current["cf_based_limit"] >= target
                       else "unsatisfied"),
            "current_value": current["combined_cf"],
            "required_value": TARGET_CF[target],
            "raw_cf_sum": current["raw_cf_sum"],
            "applicable_positive_cf_max": maximum,
            "required_raw_cf_sum": round(required_raw, 4),
            "raw_cf_gap": round(max(0.0, required_raw - current["raw_cf_sum"]), 4),
            "rule_ids": [rule["rule_id"] for rule in current["triggered_soft_rules"]],
            "reason": "软规则贡献按适用满分归一化；条件变化后必须重新运行CLIPS。",
            "candidate_path_ids": [],
            "children": [
                {
                    "id": rule["rule_id"], "label": rule["reason"],
                    "status": ("supporting" if rule["cf"] > 0 else
                               "opposing" if rule["cf"] < 0 else "neutral"),
                    "current_value": rule["cf"], "rule_ids": [rule["rule_id"]],
                }
                for rule in current["triggered_soft_rules"]
            ],
        }

    return {
        "id": "G-0", "label": f"最终批准额度达到{target:,}元", "operator": "AND",
        "status": "satisfied" if current["approved_limit"] >= target else "unsatisfied",
        "current_value": current["approved_limit"], "required_value": target,
        "children": [hard, coverage, cf_goal],
    }


def improvement_path(changes: list[dict[str, Any]], simulated_cf: float,
                     simulated_limit: int) -> dict[str, Any]:
    """Give a verified counterfactual a conditional, non-promissory conclusion."""
    conditions = "，且".join(change["description"] for change in changes)
    return {
        "changes": changes,
        "assumption_type": ("hypothetical" if any(x.get("hypothetical") for x in changes)
                            else "conditional"),
        "simulated_cf": simulated_cf,
        "simulated_limit": simulated_limit,
        "verified_by_clips": True,
        "proves_subgoals": ["SG-3", "G-0"],
        "rule_ids": [change["related_rule"] for change in changes],
        "conditional_conclusion": (
            f"若{conditions}，其他资料保持不变，按当前规则重新评估时，"
            f"模拟额度可达到{simulated_limit:,}元；不保证实际提额。"
        ),
    }


def candidate_changes(applicant: Applicant) -> Iterator[dict[str, Any]]:
    """Yield one-field scenarios using only thresholds in the existing rules."""
    months = applicant.account_age_months
    for threshold in (6, 12):
        if months < threshold:
            yield {
                "field": "account_age_months",
                "from": months,
                "to": threshold,
                "related_rule": "SR-05" if threshold == 6 else "SR-04",
                "description": f"注册时长达到{threshold}个月",
                "changes": {"account_age_months": threshold},
            }

    orders = applicant.completed_order_count
    if orders is not None:
        for threshold in (50, 100):
            if orders < threshold:
                yield {
                    "field": "completed_order_count",
                    "from": orders,
                    "to": threshold,
                    "related_rule": "SR-14" if threshold == 50 else "SR-13",
                    "description": f"完成订单数达到{threshold}笔",
                    "changes": {"completed_order_count": threshold},
                }

    spending = applicant.average_monthly_spending
    if spending is not None:
        for threshold in (1000, 2000):
            if spending < threshold:
                yield {
                    "field": "average_monthly_spending",
                    "from": spending,
                    "to": threshold,
                    "related_rule": "SR-12" if threshold == 1000 else "SR-11",
                    "description": f"假设月均消费达到{threshold:,}元",
                    "changes": {"average_monthly_spending": threshold},
                    "hypothetical": True,
                }

    score = applicant.external_credit_score
    if score is not None:
        for threshold in (550, 800):
            if score < threshold:
                yield {
                    "field": "external_credit_score",
                    "from": score,
                    "to": threshold,
                    "related_rule": "SR-21" if threshold == 550 else "SR-20",
                    "description": f"假设外部信用分达到{threshold}分",
                    "changes": {"external_credit_score": threshold},
                    "hypothetical": True,
                }

    if applicant.evaluation_type == "limit-review":
        fulfilment = applicant.repayment_fulfilment_rate
        if fulfilment is not None:
            for threshold, rule_id in ((0.90, "SR-09"), (0.95, "SR-08"), (0.98, "SR-07")):
                if fulfilment < threshold:
                    yield {
                        "field": "repayment_fulfilment_rate",
                        "from": fulfilment,
                        "to": threshold,
                        "related_rule": rule_id,
                        "description": f"假设履约率达到{threshold:.0%}",
                        "changes": {"repayment_fulfilment_rate": threshold},
                        "hypothetical": True,
                    }

        streak = applicant.consecutive_on_time_repayments
        if streak is not None:
            for threshold in (3, 6):
                if streak < threshold:
                    yield {
                        "field": "consecutive_on_time_repayments",
                        "from": streak,
                        "to": threshold,
                        "related_rule": "SR-16" if threshold == 3 else "SR-15",
                        "description": f"连续按时还款达到{threshold}期",
                        "changes": {"consecutive_on_time_repayments": threshold},
                    }

        utilisation = applicant.credit_limit_utilisation_rate
        current_limit = applicant.current_credit_limit
        if utilisation is not None and current_limit is not None and current_limit > 0:
            if utilisation > 0.80:
                # The resulting available amount is rounded upward to cents so
                # the simulated utilisation cannot exceed 80% due to rounding.
                available = float(
                    (Decimal(str(current_limit)) * Decimal("0.20")).quantize(
                        Decimal("0.01"), rounding=ROUND_CEILING
                    )
                )
                yield {
                    "field": "available_credit_limit",
                    "from": applicant.available_credit_limit,
                    "to": available,
                    "related_rule": "SR-27",
                    "description": "通过偿还欠款使额度使用率降至80%或以下",
                    "changes": {"available_credit_limit": available},
                }


def diagnose(data: dict[str, Any], target_limit: int = 10000) -> dict[str, Any]:
    """Apply BD-01 through BD-05 to one applicant and target limit."""
    if target_limit not in TARGET_CF:
        raise ValueError("target_limit must be 1000, 5000, or 10000")

    applicant = Applicant.from_dict(data)
    current = evaluate_dict(data)
    base = {
        "target_limit": target_limit,
        "target_cf": TARGET_CF[target_limit],
        "current_decision": current["decision"],
        "current_limit_result": current["approved_limit"],
        "current_cf": current["combined_cf"],
        "evidence_coverage": current["evidence_coverage"],
        "cf_based_limit": current["cf_based_limit"],
        "tier_cap": current["tier_cap"],
        "cap_ceiling": current["cap_ceiling"],
        "goal_proof_tree": goal_proof_tree(applicant, current, target_limit),
    }
    tree = base["goal_proof_tree"]
    hard_goal, coverage_goal, cf_goal = tree["children"]

    # BD-01: hard rules take precedence; no CF or counterfactual simulation.
    if hard_goal["status"] == "unsatisfied":
        return {
            **base,
            "status": "blocked-by-hard-rule",
            "blocking_rule": current["hard_decision"],
            "message": "硬规则阻断目标；本次不进行CF提额模拟。",
            "conclusion": "当前触发硬规则，额度为0元；不能通过软规则加分提额。",
            "single_change_scenarios": [],
            "combined_change_scenarios": [],
            "improvement_paths": [],
        }

    # BD-02: the existing decision has already achieved the requested limit.
    if tree["status"] == "satisfied":
        return {
            **base,
            "status": "goal-achieved",
            "message": "当前评估结果已达到目标额度。",
            "conclusion": f"当前评估额度已达到{target_limit:,}元，无需假设改善条件。",
            "single_change_scenarios": [],
            "combined_change_scenarios": [],
            "improvement_paths": [],
        }

    # A higher CF cannot overcome the evidence cap. Missing fields must be
    # supplied with genuine data and evaluated again.
    if coverage_goal["status"] == "unsatisfied":
        missing_fields = [
            name for name, _, _ in coverage_fields(applicant)
            if getattr(applicant, name) is None
        ]
        return {
            **base,
            "status": "blocked-by-evidence-cap",
            "missing_evidence_fields": missing_fields,
            "message": (
                "目标额度超过当前信息覆盖率允许的最高档。请补充真实资料后重新评估；"
                "资料补齐不保证提额。"
            ),
            "conclusion": (
                f"当前信息覆盖率不足，额度最高被封顶至{current['cap_ceiling']:,.0f}元；"
                "须补充真实资料并重新审核，补齐后仍需满足CF门槛，不能保证提额。"
            ),
            "single_change_scenarios": [],
            "combined_change_scenarios": [],
            "improvement_paths": [],
        }

    # BD-03: calculate the gap from the current denominator and raw CF sum.
    maximum = current["applicable_positive_cf_max"]
    raw_sum = current["raw_cf_sum"]
    required_sum = TARGET_CF[target_limit] * maximum
    gap = max(0.0, required_sum - raw_sum)

    # BD-04: change one field at a time and rerun the exact same CLIPS rules.
    scenarios = []
    candidates = list(candidate_changes(applicant))
    for candidate in candidates:
        simulated_input = {**data, **candidate["changes"]}
        simulated = evaluate_dict(simulated_input)
        scenarios.append(
            {
                "field": candidate["field"],
                "from": candidate["from"],
                "to": candidate["to"],
                "related_rule": candidate["related_rule"],
                "description": candidate["description"],
                "hypothetical": candidate.get("hypothetical", False),
                "simulated_cf": simulated["combined_cf"],
                "simulated_limit": simulated["approved_limit"],
                "cf_delta": round(simulated["combined_cf"] - current["combined_cf"], 4),
                "reaches_goal": (
                    simulated["hard_decision"] is None
                    and simulated["approved_limit"] >= target_limit
                ),
            }
        )

    # BD-05: if single changes are insufficient, test pairs of distinct fields.
    successful = [scenario for scenario in scenarios if scenario["reaches_goal"]]
    combined_scenarios = []
    if not successful:
        for first, second in combinations(candidates, 2):
            if first["field"] == second["field"]:
                continue
            simulated = evaluate_dict({**data, **first["changes"], **second["changes"]})
            if simulated["hard_decision"] is not None or simulated["approved_limit"] < target_limit:
                continue
            combined_scenarios.append({
                "changes": [
                    {
                        "field": candidate["field"],
                        "from": candidate["from"],
                        "to": candidate["to"],
                        "related_rule": candidate["related_rule"],
                        "description": candidate["description"],
                        "hypothetical": candidate.get("hypothetical", False),
                    }
                    for candidate in (first, second)
                ],
                "simulated_cf": simulated["combined_cf"],
                "simulated_limit": simulated["approved_limit"],
                "cf_delta": round(simulated["combined_cf"] - current["combined_cf"], 4),
                "reaches_goal": True,
            })
        combined_scenarios.sort(key=lambda item: (item["simulated_cf"],
                                                  item["changes"][0]["field"],
                                                  item["changes"][1]["field"]))

    status = ("single-change-options-found" if successful else
              "two-change-options-found" if combined_scenarios else "no-single-change-found")
    paths = [
        improvement_path(
            [{key: scenario[key] for key in (
                "field", "from", "to", "related_rule", "description", "hypothetical") }],
            scenario["simulated_cf"], scenario["simulated_limit"],
        )
        for scenario in successful
    ]
    paths.extend(
        improvement_path(scenario["changes"], scenario["simulated_cf"],
                         scenario["simulated_limit"])
        for scenario in combined_scenarios
    )
    for index, path in enumerate(paths, 1):
        path["id"] = f"P-{index}"
    cf_goal["candidate_path_ids"] = [path["id"] for path in paths]
    message = (
        "以下单项条件变化在其他资料不变时可达到目标；这不是立即提额承诺。"
        if successful
        else "单项变化不足；以下两项条件同时变化的模拟可达到目标，非提额承诺。"
        if combined_scenarios
        else "已测试的单项及双项条件变化均不足以达到目标。"
    )
    return {
        **base,
        "status": status,
        "current_raw_cf_sum": raw_sum,
        "applicable_positive_cf_max": maximum,
        "required_raw_cf_sum": round(required_sum, 4),
        "raw_cf_gap": round(gap, 4),
        "message": message,
        "conclusion": (paths[0]["conditional_conclusion"] if paths else
                       "在已测试的单项及双项条件变化中，未找到可达到目标额度的方案；"
                       "这不代表其他路径绝无可能。"),
        "single_change_scenarios": scenarios,
        "combined_change_scenarios": combined_scenarios,
        "improvement_paths": paths,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Diagnose a target BNPL credit limit.")
    parser.add_argument(
        "input",
        nargs="?",
        type=Path,
        default=DEFAULT_INPUT,
        help="Applicant JSON file (defaults to example_diagnosis_applicant.json)",
    )
    parser.add_argument(
        "--target", type=int, choices=sorted(TARGET_CF), default=10000,
        help="Target limit in CNY (default: 10000)",
    )
    args = parser.parse_args()
    with args.input.open("r", encoding="utf-8") as stream:
        data = json.load(stream)
    print(json.dumps(diagnose(data, args.target), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
