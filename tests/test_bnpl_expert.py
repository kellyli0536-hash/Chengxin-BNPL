import unittest

import clips

from bnpl_expert import Applicant, RULES_PATH, evaluate_dict, normalized_cf


def base_applicant(**overrides):
    data = {
        "identity_verified": True,
        "age": 28,
        "linked_card_type": "Credit",
        "account_age_months": 18,
        "repayment_fulfilment_rate": 0.99,
        "average_monthly_spending": 2600,
        "completed_order_count": 135,
        "consecutive_on_time_repayments": 8,
        "adverse_credit_incidents_6m": 0,
        "device_stability": "Stable",
        "current_credit_limit": None,
        "available_credit_limit": None,
        "external_credit_score": 820,
        "external_overdue_record": "None",
    }
    data.update(overrides)
    return data


# Positive-only soft-rule evidence removed; hard-rule and negative-evidence
# inputs are kept, so the CF is not pulled down by worst-case scoring.
SPARSE = dict(
    average_monthly_spending=None,
    completed_order_count=None,
)


def cap_environment(evaluation_type, ratio):
    """CLIPS run with hard-rule inputs present, so only the EC rules decide."""
    environment = clips.Environment()
    environment.load(str(RULES_PATH))
    environment.reset()
    environment.find_template("context").assert_fact(
        **{"evaluation-type": clips.Symbol(evaluation_type)}
    )
    numeric = environment.find_template("numeric-input")
    numeric.assert_fact(name=clips.Symbol("adverse-credit-incidents-6m"), value=0)
    numeric.assert_fact(name=clips.Symbol("external-credit-score"), value=820)
    environment.find_template("evidence-coverage").assert_fact(ratio=ratio)
    environment.run()
    # Copy the values out before the environment is released.
    return [(str(fact["rule-id"]), int(fact["maximum-limit"]))
            for fact in environment.facts() if fact.template.name == "tier-cap"]


class BNPLExpertTests(unittest.TestCase):
    def test_evidence_cap_boundary_rules_are_mutually_exclusive(self):
        for ratio, expected in ((0.6999, 1000), (0.70, 5000), (0.8999, 5000), (0.90, 10000)):
            with self.subTest(ratio=ratio):
                caps = cap_environment("new-application", ratio)
                self.assertEqual(len(caps), 1)
                self.assertEqual(caps[0][1], expected)

    def test_evidence_cap_rules_fire_for_limit_reviews(self):
        caps = cap_environment("limit-review", 0.5)
        self.assertEqual([rule_id for rule_id, _ in caps], ["EC-01"])

    def test_normalized_cf_uses_sum_over_applicable_positive_max(self):
        raw_sum, cf = normalized_cf(
            [{"cf": 0.45}, {"cf": 0.35}, {"cf": -0.25}], 2.50
        )
        self.assertAlmostEqual(raw_sum, 0.55)
        self.assertAlmostEqual(cf, 0.22)

    def test_negative_total_is_clamped_to_zero(self):
        raw_sum, cf = normalized_cf([{"cf": -0.70}], 2.50)
        self.assertAlmostEqual(raw_sum, -0.70)
        self.assertEqual(cf, 0)

    def test_new_high_quality_user_gets_top_limit(self):
        result = evaluate_dict(base_applicant())
        self.assertEqual(result["decision"], "approved")
        self.assertEqual(result["approved_limit"], 10000)
        self.assertEqual(result["limit_action"], "open")
        self.assertIsNone(result["hard_decision"])
        self.assertEqual(result["data_gaps"], [])
        self.assertEqual(result["applicable_positive_cf_max"], 2.50)
        self.assertEqual(result["raw_cf_sum"], 2.50)
        self.assertEqual(result["evidence_coverage"], 1.0)
        self.assertEqual(result["tier_cap"]["rule_id"], "EC-03")
        self.assertFalse(result["cap_applied"])
        ids = {item["rule_id"] for item in result["triggered_soft_rules"]}
        self.assertNotIn("SR-07", ids)
        self.assertNotIn("SR-15", ids)

    def test_existing_user_uses_four_point_maximum(self):
        result = evaluate_dict(
            base_applicant(current_credit_limit=5000, available_credit_limit=2000)
        )
        self.assertEqual(result["applicable_positive_cf_max"], 4.00)
        self.assertEqual(result["raw_cf_sum"], 4.00)
        self.assertEqual(result["combined_cf"], 1.00)
        self.assertEqual(result["evidence_coverage"], 1.0)
        self.assertEqual(result["tier_cap"]["rule_id"], "EC-03")
        self.assertEqual(result["approved_limit"], 10000)

    def test_sparse_new_user_is_capped_despite_perfect_cf(self):
        result = evaluate_dict(base_applicant(**SPARSE))
        self.assertEqual(result["combined_cf"], 1.0)
        self.assertEqual(result["evidence_coverage"], 0.76)
        self.assertEqual(result["cf_based_limit"], 10000)
        self.assertEqual(result["tier_cap"]["rule_id"], "EC-02")
        self.assertEqual(result["approved_limit"], 5000)
        self.assertTrue(result["cap_applied"])

    def test_missing_overdue_record_scores_as_serious(self):
        for limits in ({}, {"current_credit_limit": 5000, "available_credit_limit": 2000}):
            with self.subTest(limits=limits):
                missing = evaluate_dict(base_applicant(external_overdue_record=None, **limits))
                serious = evaluate_dict(base_applicant(external_overdue_record="Serious", **limits))
                self.assertEqual(missing["combined_cf"], serious["combined_cf"])
                self.assertEqual(missing["approved_limit"], serious["approved_limit"])
                self.assertIn({"field": "external_overdue_record", "rule_id": "SR-25",
                               "treatment": "worst-case"}, missing["data_gaps"])
                self.assertLess(missing["evidence_coverage"], serious["evidence_coverage"])

    def test_missing_fulfilment_rate_scores_as_lowest_band(self):
        limits = {"current_credit_limit": 5000, "available_credit_limit": 2000}
        missing = evaluate_dict(base_applicant(repayment_fulfilment_rate=None, **limits))
        low = evaluate_dict(base_applicant(repayment_fulfilment_rate=0.5, **limits))
        self.assertEqual(missing["combined_cf"], low["combined_cf"])
        self.assertIn("SR-10", {item["rule_id"] for item in missing["triggered_soft_rules"]})

    def test_cap_never_raises_a_low_cf_result(self):
        result = evaluate_dict(
            base_applicant(
                linked_card_type="None",
                account_age_months=0,
                device_stability="Changing",
                **SPARSE,
            )
        )
        self.assertEqual(result["cf_based_limit"], 0)
        self.assertEqual(result["approved_limit"], 0)
        self.assertFalse(result["cap_applied"])

    # ------------------------------------------------------------------
    # Hard rules, including missing hard-rule inputs
    # ------------------------------------------------------------------
    def test_unverified_new_user_is_rejected(self):
        result = evaluate_dict(base_applicant(identity_verified=False))
        self.assertEqual(result["decision"], "rejected")
        self.assertEqual(result["approved_limit"], 0)
        self.assertEqual(result["hard_decision"]["rule_id"], "HR-01")
        self.assertEqual(result["hard_decision"]["action"], "reject")

    def test_abnormal_existing_user_is_suspended(self):
        result = evaluate_dict(
            base_applicant(
                device_stability="Abnormal",
                current_credit_limit=5000,
                available_credit_limit=2000,
            )
        )
        self.assertEqual(result["decision"], "suspended")
        self.assertEqual(result["approved_limit"], 0)
        self.assertEqual(result["limit_action"], "set-to-zero")
        self.assertEqual(result["hard_decision"]["rule_id"], "HR-04")
        self.assertIsNone(result["combined_cf"])
        self.assertEqual(result["triggered_soft_rules"], [])

    def test_low_external_score_suspends_existing_user(self):
        result = evaluate_dict(
            base_applicant(
                external_credit_score=450,
                current_credit_limit=5000,
                available_credit_limit=3000,
            )
        )
        self.assertEqual(result["decision"], "suspended")
        self.assertEqual(result["approved_limit"], 0)
        self.assertEqual(result["hard_decision"]["rule_id"], "HR-05")

    def test_missing_hard_rule_input_blocks_like_a_failed_red_line(self):
        cases = (
            ("adverse_credit_incidents_6m", "HR-03"),
            ("external_credit_score", "HR-05"),
        )
        for field, rule_id in cases:
            for limits, decision in (
                ({}, "rejected"),
                ({"current_credit_limit": 1000, "available_credit_limit": 500}, "suspended"),
                ({"current_credit_limit": 5000, "available_credit_limit": 2000}, "suspended"),
            ):
                with self.subTest(field=field, limits=limits):
                    result = evaluate_dict(base_applicant(**{field: None}, **limits))
                    self.assertEqual(result["decision"], decision)
                    self.assertEqual(result["approved_limit"], 0)
                    self.assertEqual(result["hard_decision"]["rule_id"], rule_id)
                    self.assertIn({"field": field, "rule_id": rule_id,
                                   "treatment": "hard-rule-failed"}, result["data_gaps"])

    def test_missing_value_is_never_better_than_a_bad_value(self):
        pairs = (
            ({"adverse_credit_incidents_6m": 2}, {"adverse_credit_incidents_6m": None}),
            ({"external_credit_score": 430}, {"external_credit_score": None}),
            ({"external_overdue_record": "Serious"}, {"external_overdue_record": None}),
            ({"repayment_fulfilment_rate": 0.0}, {"repayment_fulfilment_rate": None}),
            ({"repayment_fulfilment_rate": 0.80},
             {"repayment_fulfilment_rate": None, "consecutive_on_time_repayments": None}),
        )
        for limits in ({}, {"current_credit_limit": 1000, "available_credit_limit": 500},
                       {"current_credit_limit": 7000, "available_credit_limit": 3000},
                       {"current_credit_limit": 12000, "available_credit_limit": 6000}):
            for bad, missing in pairs:
                with self.subTest(limits=limits, bad=bad):
                    bad_result = evaluate_dict(base_applicant(**limits, **bad))
                    missing_result = evaluate_dict(base_applicant(**limits, **missing))
                    self.assertLessEqual(missing_result["approved_limit"],
                                         bad_result["approved_limit"])

    # ------------------------------------------------------------------
    # Evidence cap for existing users
    # ------------------------------------------------------------------
    def test_sparse_existing_user_cannot_jump_to_top_limit(self):
        result = evaluate_dict(
            base_applicant(current_credit_limit=1000, available_credit_limit=500, **SPARSE)
        )
        self.assertEqual(result["combined_cf"], 1.0)
        self.assertEqual(result["cf_based_limit"], 10000)
        self.assertEqual(result["evidence_coverage"], 0.85)
        self.assertEqual(result["tier_cap"]["rule_id"], "EC-02")
        self.assertEqual(result["approved_limit"], 5000)
        self.assertTrue(result["cap_applied"])

    def test_existing_user_without_repayment_history_is_capped_low(self):
        sparse = dict(SPARSE, repayment_fulfilment_rate=None,
                      consecutive_on_time_repayments=None, account_age_months=12)
        existing = evaluate_dict(
            base_applicant(current_credit_limit=0, available_credit_limit=0, **sparse)
        )
        self.assertEqual(existing["evidence_coverage"], 0.55)
        self.assertEqual(existing["tier_cap"]["rule_id"], "EC-01")
        self.assertLessEqual(existing["approved_limit"], 1000)

    def test_missing_data_cannot_keep_a_limit_above_the_cap(self):
        result = evaluate_dict(
            base_applicant(
                repayment_fulfilment_rate=None,
                consecutive_on_time_repayments=None,
                current_credit_limit=5000,
                available_credit_limit=2500,
                **SPARSE,
            )
        )
        self.assertEqual(result["tier_cap"]["maximum_limit"], 1000)
        self.assertEqual(result["approved_limit"], 1000)
        self.assertEqual(result["limit_action"], "decrease")
        self.assertNotIn("cap_ceiling", result)

    def test_low_cf_reduces_an_existing_limit(self):
        result = evaluate_dict(
            base_applicant(
                linked_card_type="None",
                account_age_months=0,
                device_stability="Changing",
                repayment_fulfilment_rate=0.80,
                consecutive_on_time_repayments=0,
                current_credit_limit=5000,
                available_credit_limit=200,
                **SPARSE,
            )
        )
        self.assertEqual(result["cf_based_limit"], 0)
        self.assertEqual(result["approved_limit"], 0)
        self.assertEqual(result["limit_action"], "decrease")

    def test_existing_limits_always_land_on_a_tier(self):
        for current in (700, 3000, 7000, 12000):
            with self.subTest(current=current):
                result = evaluate_dict(
                    base_applicant(current_credit_limit=current,
                                   available_credit_limit=current / 2, **SPARSE)
                )
                self.assertIn(result["approved_limit"], (0, 1000, 5000, 10000))

    # ------------------------------------------------------------------
    # Individual rules and input contract
    # ------------------------------------------------------------------
    def test_account_age_one_to_five_months_fires_no_rule(self):
        for months in range(1, 6):
            with self.subTest(months=months):
                result = evaluate_dict(base_applicant(account_age_months=months))
                ids = {item["rule_id"] for item in result["triggered_soft_rules"]}
                self.assertNotIn("SR-04", ids)
                self.assertNotIn("SR-05", ids)
                self.assertNotIn("SR-06", ids)

    def test_account_age_six_months_triggers_sr05(self):
        result = evaluate_dict(base_applicant(account_age_months=6))
        ids = {item["rule_id"] for item in result["triggered_soft_rules"]}
        self.assertIn("SR-05", ids)

    def test_missing_optional_values_are_neutral(self):
        result = evaluate_dict(
            base_applicant(
                repayment_fulfilment_rate=None,
                consecutive_on_time_repayments=None,
                **SPARSE,
            )
        )
        ids = {item["rule_id"] for item in result["triggered_soft_rules"]}
        self.assertFalse(ids & {"SR-07", "SR-11", "SR-13", "SR-15"})
        self.assertEqual(result["applicable_positive_cf_max"], 1.90)

    def test_one_adverse_incident_fires_for_float_input(self):
        result = evaluate_dict(base_applicant(adverse_credit_incidents_6m=1.0))
        ids = {item["rule_id"] for item in result["triggered_soft_rules"]}
        self.assertIn("SR-17", ids)

    def test_prepaid_card_counts_as_no_bank_card(self):
        result = evaluate_dict(base_applicant(linked_card_type="Prepaid"))
        cfs = {item["rule_id"]: item["cf"] for item in result["triggered_soft_rules"]}
        self.assertEqual(cfs.get("SR-03"), -0.25)
        self.assertNotIn("SR-01", cfs)
        self.assertNotIn("SR-02", cfs)

    def test_unknown_or_misspelt_field_is_rejected(self):
        data = base_applicant()
        data["adverse_credit_incident_6m"] = data.pop("adverse_credit_incidents_6m")
        with self.assertRaisesRegex(ValueError, "Unknown fields: adverse_credit_incident_6m"):
            Applicant.from_dict(data)

    def test_null_required_field_gives_a_clear_error(self):
        for field in ("linked_card_type", "device_stability", "age"):
            with self.subTest(field=field):
                with self.assertRaisesRegex(ValueError, f"Required fields cannot be null: {field}"):
                    Applicant.from_dict(base_applicant(**{field: None}))

    def test_counts_must_be_whole_numbers(self):
        for field, value in (("adverse_credit_incidents_6m", 1.5),
                             ("completed_order_count", 100.5),
                             ("consecutive_on_time_repayments", True),
                             ("completed_order_count", float("nan"))):
            with self.subTest(field=field, value=value):
                with self.assertRaisesRegex(ValueError, "whole number"):
                    Applicant.from_dict(base_applicant(**{field: value}))
        self.assertEqual(
            evaluate_dict(base_applicant(adverse_credit_incidents_6m=2.0))["hard_decision"]["rule_id"],
            "HR-03")

    def test_account_age_rejects_booleans(self):
        with self.assertRaisesRegex(ValueError, "account_age_months"):
            Applicant.from_dict(base_applicant(account_age_months=True))

    def test_amounts_and_rates_must_be_finite(self):
        for field, value in (("average_monthly_spending", float("nan")),
                             ("average_monthly_spending", float("inf")),
                             ("repayment_fulfilment_rate", float("nan")),
                             ("average_monthly_spending", True)):
            with self.subTest(field=field, value=value):
                with self.assertRaisesRegex(ValueError, "finite number"):
                    Applicant.from_dict(base_applicant(**{field: value}))

    def test_invalid_available_limit_is_rejected(self):
        with self.assertRaises(ValueError):
            Applicant.from_dict(
                base_applicant(current_credit_limit=1000, available_credit_limit=1200)
            )


if __name__ == "__main__":
    unittest.main()
