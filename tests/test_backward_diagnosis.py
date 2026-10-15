import unittest
from copy import deepcopy

from backward_diagnosis import candidate_changes, diagnose
from bnpl_expert import Applicant, evaluate_dict


def example_user():
    return {
        "identity_verified": True,
        "age": 28,
        "linked_card_type": "Credit",
        "account_age_months": 8,
        "repayment_fulfilment_rate": 0.99,
        "average_monthly_spending": 2600,
        "completed_order_count": 135,
        "consecutive_on_time_repayments": 8,
        "adverse_credit_incidents_6m": 0,
        "device_stability": "Stable",
        "current_credit_limit": 5000,
        "available_credit_limit": 250,
        "external_credit_score": 820,
        "external_overdue_record": "None",
    }


class BackwardDiagnosisTests(unittest.TestCase):
    def test_new_user_evidence_cap_blocks_higher_goal(self):
        data = example_user()
        data["current_credit_limit"] = None
        data["available_credit_limit"] = None
        data["average_monthly_spending"] = None
        data["completed_order_count"] = None
        data["external_credit_score"] = None
        data["external_overdue_record"] = None
        result = diagnose(data, 10000)
        self.assertEqual(result["status"], "blocked-by-evidence-cap")
        self.assertEqual(result["cf_based_limit"], 10000)
        self.assertEqual(result["tier_cap"]["maximum_limit"], 1000)
        self.assertIn("external_credit_score", result["missing_evidence_fields"])
        self.assertEqual(result["single_change_scenarios"], [])
        self.assertEqual(result["combined_change_scenarios"], [])

    def test_goal_decomposition_and_two_verified_options(self):
        result = diagnose(example_user(), 10000)
        self.assertEqual(result["status"], "single-change-options-found")
        self.assertEqual(result["current_cf"], 0.8125)
        self.assertEqual(result["current_limit_result"], 5000)
        self.assertEqual(result["required_raw_cf_sum"], 3.4)
        self.assertEqual(result["raw_cf_gap"], 0.15)
        successful = {
            (item["field"], item["to"]): item
            for item in result["single_change_scenarios"]
            if item["reaches_goal"]
        }
        self.assertEqual(successful[("account_age_months", 12)]["simulated_cf"], 0.85)
        self.assertEqual(successful[("available_credit_limit", 1000.0)]["simulated_cf"], 0.9625)
        tree = result["goal_proof_tree"]
        self.assertEqual(tree["status"], "unsatisfied")
        self.assertEqual([node["status"] for node in tree["children"]],
                         ["satisfied", "not-applicable", "unsatisfied"])
        self.assertEqual(tree["children"][2]["required_value"], 0.85)
        self.assertIn("注册时长达到12个月", result["conclusion"])
        self.assertTrue(all(path["verified_by_clips"] for path in result["improvement_paths"]))
        self.assertEqual(tree["children"][2]["candidate_path_ids"],
                         [path["id"] for path in result["improvement_paths"]])
        self.assertTrue(all("SG-3" in path["proves_subgoals"]
                            for path in result["improvement_paths"]))

    def test_hard_rule_stops_diagnosis(self):
        data = example_user()
        data["device_stability"] = "Abnormal"
        result = diagnose(data, 10000)
        self.assertEqual(result["status"], "blocked-by-hard-rule")
        self.assertEqual(result["blocking_rule"]["rule_id"], "HR-04")
        self.assertIsNone(result["current_cf"])
        self.assertEqual(result["single_change_scenarios"], [])
        self.assertEqual(result["combined_change_scenarios"], [])
        self.assertEqual(result["goal_proof_tree"]["children"][2]["status"], "not-evaluated")

    def test_proof_tree_lists_all_known_hard_failures(self):
        data = example_user()
        data.update(identity_verified=False, age=16, device_stability="Abnormal",
                    external_credit_score=430)
        result = diagnose(data, 10000)
        hard = result["goal_proof_tree"]["children"][0]
        failed = {node["id"] for node in hard["children"]
                  if node["status"] == "unsatisfied"}
        self.assertEqual(failed, {"HR-01", "HR-02", "HR-04", "HR-05"})
        self.assertEqual(result["improvement_paths"], [])

    def test_cap_and_cf_shortfalls_are_both_visible(self):
        data = example_user()
        data.update(current_credit_limit=None, available_credit_limit=None,
                    linked_card_type="None", account_age_months=1,
                    average_monthly_spending=None, completed_order_count=None,
                    device_stability="Changing", external_credit_score=None,
                    external_overdue_record=None)
        result = diagnose(data, 10000)
        self.assertEqual(result["status"], "blocked-by-evidence-cap")
        self.assertEqual([node["status"] for node in result["goal_proof_tree"]["children"]],
                         ["satisfied", "unsatisfied", "unsatisfied"])
        self.assertEqual(result["goal_proof_tree"]["children"][1]["required_value"], 0.9)

    def test_already_achieved_target(self):
        data = example_user()
        data["account_age_months"] = 12
        result = diagnose(data, 10000)
        self.assertEqual(result["status"], "goal-achieved")
        self.assertEqual(result["single_change_scenarios"], [])

    def test_no_single_change_is_reported_without_a_promise(self):
        data = example_user()
        data.update(
            linked_card_type="None",
            account_age_months=1,
            repayment_fulfilment_rate=0.80,
            average_monthly_spending=0,
            completed_order_count=0,
            consecutive_on_time_repayments=0,
            available_credit_limit=5000,
            external_credit_score=500,
            external_overdue_record="Serious",
        )
        result = diagnose(data, 10000)
        self.assertEqual(result["status"], "no-single-change-found")
        self.assertTrue(result["single_change_scenarios"])
        self.assertFalse(any(x["reaches_goal"] for x in result["single_change_scenarios"]))

    def test_new_candidates_follow_clips_thresholds(self):
        data = example_user()
        data.update(repayment_fulfilment_rate=0.89,
                    average_monthly_spending=500, external_credit_score=500)
        candidates = list(candidate_changes(Applicant.from_dict(data)))
        self.assertEqual(
            [x["to"] for x in candidates if x["field"] == "repayment_fulfilment_rate"],
            [0.90, 0.95, 0.98],
        )
        self.assertEqual(
            [x["to"] for x in candidates if x["field"] == "average_monthly_spending"],
            [1000, 2000],
        )
        self.assertEqual(
            [x["to"] for x in candidates if x["field"] == "external_credit_score"],
            [550, 800],
        )
        self.assertTrue(all(x["hypothetical"] for x in candidates
                            if x["field"] in {"repayment_fulfilment_rate",
                                               "average_monthly_spending",
                                               "external_credit_score"}))

    def test_pair_diagnosis_names_two_distinct_changes_and_rechecks_clips(self):
        data = example_user()
        data.update(account_age_months=1, completed_order_count=49,
                    average_monthly_spending=1500, external_credit_score=650,
                    available_credit_limit=2500)
        result = diagnose(data, 10000)
        self.assertEqual(result["status"], "two-change-options-found")
        self.assertFalse(any(x["reaches_goal"] for x in result["single_change_scenarios"]))
        self.assertTrue(result["combined_change_scenarios"])
        self.assertTrue(all(len(path["changes"]) == 2 for path in result["improvement_paths"]))
        self.assertIn("且", result["conclusion"])
        for scenario in result["combined_change_scenarios"]:
            changes = scenario["changes"]
            self.assertEqual(len(changes), 2)
            self.assertNotEqual(changes[0]["field"], changes[1]["field"])
            simulated_input = {**data, **{x["field"]: x["to"] for x in changes}}
            simulated = evaluate_dict(simulated_input)
            self.assertEqual(scenario["simulated_cf"], simulated["combined_cf"])
            self.assertEqual(scenario["simulated_limit"], simulated["approved_limit"])
            self.assertGreaterEqual(scenario["simulated_limit"], 10000)

    def test_new_user_does_not_propose_repayment_rate(self):
        data = example_user()
        data["current_credit_limit"] = None
        data["available_credit_limit"] = None
        data["repayment_fulfilment_rate"] = 0.80
        self.assertFalse(any(x["field"] == "repayment_fulfilment_rate"
                             for x in candidate_changes(Applicant.from_dict(data))))

    def test_input_is_not_mutated(self):
        data = example_user()
        original = deepcopy(data)
        diagnose(data, 10000)
        self.assertEqual(data, original)

    def test_target_must_be_an_existing_tier(self):
        with self.assertRaises(ValueError):
            diagnose(example_user(), 7500)


if __name__ == "__main__":
    unittest.main()
