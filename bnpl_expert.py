"""Python integration for the CLIPS BNPL expert system."""

from __future__ import annotations

import argparse
import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import clips


RULES_PATH = Path(__file__).parent / "rules" / "bnpl_rules.clp"
NEW_APPLICANT_FULL_POSITIVE_MAX = 2.50
EXISTING_USER_FULL_POSITIVE_MAX = 4.00


@dataclass(frozen=True)
class Applicant:
    identity_verified: bool
    age: int
    linked_card_type: str
    account_age_months: int
    repayment_fulfilment_rate: float | None
    average_monthly_spending: float | None
    completed_order_count: int | None
    consecutive_on_time_repayments: int | None
    adverse_credit_incidents_6m: int | None
    device_stability: str
    current_credit_limit: float | None
    available_credit_limit: float | None
    external_credit_score: int | None
    external_overdue_record: str | None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Applicant":
        required = {
            "identity_verified",
            "age",
            "linked_card_type",
            "account_age_months",
            "device_stability",
        }
        missing = sorted(required - data.keys())
        if missing:
            raise ValueError(f"Missing required fields: {', '.join(missing)}")
        unknown = sorted(data.keys() - cls.__dataclass_fields__.keys())
        if unknown:
            raise ValueError(f"Unknown fields: {', '.join(unknown)}")
        nulls = sorted(name for name in required if data.get(name) is None)
        if nulls:
            raise ValueError(f"Required fields cannot be null: {', '.join(nulls)}")

        values = {field: data.get(field) for field in cls.__dataclass_fields__}
        applicant = cls(**values)
        applicant.validate()
        return applicant

    @property
    def evaluation_type(self) -> str:
        if self.current_credit_limit is None:
            return "new-application"
        return "limit-review"

    @property
    def credit_limit_utilisation_rate(self) -> float | None:
        if self.current_credit_limit is None:
            return None
        if self.current_credit_limit == 0:
            return 0.0
        assert self.available_credit_limit is not None
        return (self.current_credit_limit - self.available_credit_limit) / self.current_credit_limit

    def validate(self) -> None:
        if not isinstance(self.identity_verified, bool):
            raise ValueError("identity_verified must be true or false")
        if not isinstance(self.age, int) or isinstance(self.age, bool) or self.age < 0:
            raise ValueError("age must be a non-negative integer")
        if (not isinstance(self.linked_card_type, str)
                or self.linked_card_type.lower() not in {"debit", "credit", "prepaid", "none"}):
            raise ValueError("linked_card_type must be Debit, Credit, Prepaid, or None")
        if (not isinstance(self.account_age_months, int) or isinstance(self.account_age_months, bool)
                or self.account_age_months < 0):
            raise ValueError("account_age_months must be a non-negative integer")
        if (not isinstance(self.device_stability, str)
                or self.device_stability.lower() not in {"stable", "changing", "abnormal"}):
            raise ValueError("device_stability must be Stable, Changing, or Abnormal")

        # Counts must be whole numbers; amounts and rates must be finite numbers.
        # Booleans are rejected explicitly because Python treats them as ints.
        optional_counts = {
            "completed_order_count": self.completed_order_count,
            "consecutive_on_time_repayments": self.consecutive_on_time_repayments,
            "adverse_credit_incidents_6m": self.adverse_credit_incidents_6m,
        }
        for name, value in optional_counts.items():
            if value is not None and not _is_whole(value):
                raise ValueError(f"{name} must be a non-negative whole number or null")
            if value is not None and value < 0:
                raise ValueError(f"{name} must be a non-negative whole number or null")

        optional_amounts = {
            "average_monthly_spending": self.average_monthly_spending,
            "repayment_fulfilment_rate": self.repayment_fulfilment_rate,
            "current_credit_limit": self.current_credit_limit,
            "available_credit_limit": self.available_credit_limit,
        }
        for name, value in optional_amounts.items():
            if value is not None and not _is_finite_number(value):
                raise ValueError(f"{name} must be a finite number or null")
        if self.average_monthly_spending is not None and self.average_monthly_spending < 0:
            raise ValueError("average_monthly_spending must be non-negative or null")

        rate = self.repayment_fulfilment_rate
        if rate is not None and not 0 <= rate <= 1:
            raise ValueError("repayment_fulfilment_rate must be between 0 and 1 or null")

        one_limit_missing = (self.current_credit_limit is None) != (
            self.available_credit_limit is None
        )
        if one_limit_missing:
            raise ValueError(
                "current_credit_limit and available_credit_limit must both be numbers or both be null"
            )
        if self.current_credit_limit is not None:
            if self.current_credit_limit < 0 or self.available_credit_limit < 0:
                raise ValueError("credit limits must be non-negative")
            if self.available_credit_limit > self.current_credit_limit:
                raise ValueError("available_credit_limit cannot exceed current_credit_limit")

        if self.external_credit_score is not None:
            if not isinstance(self.external_credit_score, int) or isinstance(
                self.external_credit_score, bool
            ):
                raise ValueError("external_credit_score must be an integer or null")
            if not 350 <= self.external_credit_score <= 950:
                raise ValueError("external_credit_score must be between 350 and 950")

        if self.external_overdue_record is not None:
            allowed = {"none", "minor", "moderate", "serious"}
            if (not isinstance(self.external_overdue_record, str)
                    or self.external_overdue_record.lower() not in allowed):
                raise ValueError(
                    "external_overdue_record must be None, Minor, Moderate, Serious, or null"
                )


def _is_whole(value: Any) -> bool:
    if isinstance(value, bool):
        return False
    if isinstance(value, int):
        return True
    return isinstance(value, float) and math.isfinite(value) and value.is_integer()


def _is_finite_number(value: Any) -> bool:
    return (isinstance(value, (int, float)) and not isinstance(value, bool)
            and math.isfinite(value))


# Soft-rule fields that can carry negative evidence. When one is missing it is
# scored at its worst value (the rule in brackets fires), so leaving it blank can
# never beat reporting a bad value.
WORST_CASE_FIELDS = {
    "external_overdue_record": ("SR-25", "all"),
    "repayment_fulfilment_rate": ("SR-10", "limit-review"),
}


def worst_case_fields(applicant: Applicant) -> list[str]:
    return [
        field for field, (_, scope) in WORST_CASE_FIELDS.items()
        if getattr(applicant, field) is None
        and scope in ("all", applicant.evaluation_type)
    ]


def _positive_groups(applicant: Applicant) -> list[tuple[str, float]]:
    """(field, largest positive CF) for each soft-rule group that applies."""
    groups = [
        ("linked_card_type", 0.45),
        ("account_age_months", 0.35),
        ("average_monthly_spending", 0.30),
        ("completed_order_count", 0.30),
        ("device_stability", 0.25),
        ("external_credit_score", 0.55),
        ("external_overdue_record", 0.30),
    ]
    if applicant.evaluation_type == "limit-review":
        groups += [
            ("repayment_fulfilment_rate", 0.65),
            ("consecutive_on_time_repayments", 0.55),
            ("current_credit_limit", 0.30),  # utilisation group
        ]
    return groups


def applicable_positive_max(applicant: Applicant) -> float:
    """CF denominator: groups with a value, plus groups scored at worst case."""
    imputed = set(worst_case_fields(applicant))
    return round(sum(
        value for field, value in _positive_groups(applicant)
        if getattr(applicant, field) is not None or field in imputed
    ), 4)


def observed_positive_max(applicant: Applicant) -> float:
    """Evidence coverage numerator: only groups whose value was actually provided."""
    return round(sum(
        value for field, value in _positive_groups(applicant)
        if getattr(applicant, field) is not None
    ), 4)


def normalized_cf(evidence: list[dict[str, Any]], maximum: float) -> tuple[float, float]:
    """Return (raw CF sum, non-negative normalized CF)."""
    raw_sum = round(sum(item["cf"] for item in evidence), 4)
    if maximum == 0:
        return raw_sum, 0.0
    return raw_sum, max(0.0, min(1.0, raw_sum / maximum))


def _symbol(value: str) -> clips.Symbol:
    return clips.Symbol(value.lower())


def _assert_inputs(environment: clips.Environment, applicant: Applicant) -> None:
    categorical = environment.find_template("categorical-input")
    numeric = environment.find_template("numeric-input")
    context = environment.find_template("context")

    context.assert_fact(**{"evaluation-type": _symbol(applicant.evaluation_type)})

    categories = {
        "identity-verified": "yes" if applicant.identity_verified else "no",
        "linked-card-type": applicant.linked_card_type,
        "device-stability": applicant.device_stability,
        "external-overdue-record": applicant.external_overdue_record,
    }
    for name, value in categories.items():
        if value is not None:
            categorical.assert_fact(name=_symbol(name), value=_symbol(value))

    numbers = {
        "age": applicant.age,
        "account-age-months": applicant.account_age_months,
        "repayment-fulfilment-rate": applicant.repayment_fulfilment_rate,
        "average-monthly-spending": applicant.average_monthly_spending,
        "completed-order-count": applicant.completed_order_count,
        "consecutive-on-time-repayments": applicant.consecutive_on_time_repayments,
        "adverse-credit-incidents-6m": applicant.adverse_credit_incidents_6m,
        "external-credit-score": applicant.external_credit_score,
        "credit-limit-utilisation-rate": applicant.credit_limit_utilisation_rate,
    }
    for name, value in numbers.items():
        if value is not None:
            numeric.assert_fact(name=_symbol(name), value=value)


def _limit_for_cf(cf: float) -> tuple[str, int]:
    if cf < 0.40:
        return "rejected", 0
    if cf < 0.60:
        return "conditional-approval", 1000
    if cf < 0.85:
        return "approved", 5000
    return "approved", 10000


def _decision_for_limit(limit: float) -> str:
    if limit == 0:
        return "rejected"
    if limit == 1000:
        return "conditional-approval"
    return "approved"


HARD_RULE_FIELDS = {
    "adverse_credit_incidents_6m": "HR-03",
    "external_credit_score": "HR-05",
}


def data_gaps(applicant: Applicant) -> list[dict[str, str]]:
    """Missing inputs that were not simply ignored.

    `hard-rule-failed`: a red line could not be checked, so it counts as failed.
    `worst-case`: a negative-evidence field was scored at its worst value.
    """
    gaps = [
        {"field": field, "rule_id": rule_id, "treatment": "hard-rule-failed"}
        for field, rule_id in HARD_RULE_FIELDS.items()
        if getattr(applicant, field) is None
    ]
    gaps += [
        {"field": field, "rule_id": WORST_CASE_FIELDS[field][0], "treatment": "worst-case"}
        for field in worst_case_fields(applicant)
    ]
    return gaps


def evaluate(applicant: Applicant) -> dict[str, Any]:
    """Evaluate one applicant and return a serialisable decision trace."""
    environment = clips.Environment()
    environment.load(str(RULES_PATH))
    environment.reset()
    _assert_inputs(environment, applicant)
    fired_count = environment.run()

    hard_decisions = []
    evidence = []
    for fact in environment.facts():
        if fact.template.name == "hard-decision":
            hard_decisions.append(
                {
                    "rule_id": str(fact["rule-id"]),
                    "action": str(fact["action"]),
                    "reason": fact["reason"],
                }
            )
        elif fact.template.name == "evidence":
            evidence.append(
                {
                    "rule_id": str(fact["rule-id"]),
                    "cf": float(fact["cf"]),
                    "reason": fact["reason"],
                }
            )

    evidence.sort(key=lambda item: item["rule_id"])

    if hard_decisions:
        hard = hard_decisions[0]
        approved_limit = 0
        decision = {"reject": "rejected", "suspend": "suspended"}[hard["action"]]
        limit_action = "set-to-zero"
        combined_cf = None
        raw_cf_sum = None
        positive_cf_max = None
        evidence_coverage = None
        tier_cap = None
        cap_applied = False
        cf_based_limit = None
        evidence = []
    else:
        positive_cf_max = applicable_positive_max(applicant)
        raw_cf_sum, unrounded_cf = normalized_cf(evidence, positive_cf_max)
        combined_cf = round(unrounded_cf, 4)
        decision, cf_based_limit = _limit_for_cf(unrounded_cf)
        full_max = (
            NEW_APPLICANT_FULL_POSITIVE_MAX
            if applicant.evaluation_type == "new-application"
            else EXISTING_USER_FULL_POSITIVE_MAX
        )
        evidence_coverage = round(observed_positive_max(applicant) / full_max, 4)
        environment.find_template("evidence-coverage").assert_fact(
            ratio=evidence_coverage
        )
        fired_count += environment.run()
        caps = [
            fact for fact in environment.facts()
            if fact.template.name == "tier-cap"
        ]
        if len(caps) != 1:
            raise RuntimeError(f"Expected exactly one evidence tier cap, got {len(caps)}")
        cap = caps[0]
        tier_cap = {
            "rule_id": str(cap["rule-id"]),
            "maximum_limit": int(cap["maximum-limit"]),
            "reason": cap["reason"],
        }
        approved_limit = min(cf_based_limit, tier_cap["maximum_limit"])
        cap_applied = approved_limit < cf_based_limit
        decision = _decision_for_limit(approved_limit)
        if applicant.evaluation_type == "new-application":
            limit_action = "open" if approved_limit > 0 else "do-not-open"
        else:
            current = applicant.current_credit_limit or 0
            if approved_limit > current:
                limit_action = "increase"
            elif approved_limit < current:
                limit_action = "decrease"
            else:
                limit_action = "maintain"

    return {
        "evaluation_type": applicant.evaluation_type,
        "decision": decision,
        "approved_limit": approved_limit,
        "limit_action": limit_action,
        "combined_cf": combined_cf,
        "raw_cf_sum": raw_cf_sum,
        "applicable_positive_cf_max": positive_cf_max,
        "evidence_coverage": evidence_coverage,
        "cf_based_limit": cf_based_limit,
        "tier_cap": tier_cap,
        "cap_applied": cap_applied,
        "hard_decision": hard_decisions[0] if hard_decisions else None,
        "data_gaps": data_gaps(applicant),
        "triggered_soft_rules": evidence,
        "credit_limit_utilisation_rate": applicant.credit_limit_utilisation_rate,
        "fired_rule_count": fired_count,
    }


def evaluate_dict(data: dict[str, Any]) -> dict[str, Any]:
    return evaluate(Applicant.from_dict(data))


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate a BNPL application with CLIPS rules.")
    parser.add_argument(
        "input",
        nargs="?",
        type=Path,
        default=Path(__file__).parent / "example_applicant.json",
        help="Path to an applicant JSON file (defaults to example_applicant.json)",
    )
    args = parser.parse_args()
    with args.input.open("r", encoding="utf-8") as stream:
        applicant_data = json.load(stream)
    result = evaluate_dict(applicant_data)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
