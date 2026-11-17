"""Generate 100 deterministic, fictional BNPL records for classroom testing."""

import csv
import random
import sys
from pathlib import Path

# Allow both `python -m tools.generate_batch_demo` and `python tools/generate_batch_demo.py`.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from bnpl_expert import Applicant  # noqa: E402


FIELDS = list(Applicant.__dataclass_fields__)
DESTINATION = Path(__file__).resolve().parents[1] / "examples" / "fictional_batch_100.csv"


def make_rows():
    rng = random.Random(521)
    rows = []
    for index in range(100):
        group = index // 25
        old = group in (1, 3)
        row = {
            "identity_verified": group != 3 or index % 5 != 0,
            "age": rng.randint(21, 58) if group != 3 else (17 if index % 5 == 1 else rng.randint(21, 58)),
            "linked_card_type": rng.choice(["Credit", "Debit", "Prepaid"]),
            "account_age_months": rng.randint(0, 5) if group == 0 else rng.randint(6, 30),
            "repayment_fulfilment_rate": round(rng.uniform(0.88, 1), 2) if old else None,
            "average_monthly_spending": rng.choice([None, 500, 1200, 2100, 2800]) if group == 0 else rng.randint(700, 3100),
            "completed_order_count": rng.choice([None, 3, 12, 48]) if group == 0 else rng.randint(35, 150),
            "consecutive_on_time_repayments": rng.randint(0, 10) if old else None,
            "adverse_credit_incidents_6m": 2 if group == 3 and index % 5 == 2 else 0,
            "device_stability": "Abnormal" if group == 3 and index % 5 == 3 else rng.choice(["Stable", "Changing"]),
            "current_credit_limit": rng.choice([1000, 5000]) if old else None,
            "available_credit_limit": None,
            "external_credit_score": 430 if group == 3 and index % 5 == 4 else (None if group == 0 and index % 2 == 0 else rng.randint(560, 880)),
            "external_overdue_record": None if group == 0 and index % 3 == 0 else rng.choice(["None", "Minor", "Moderate"]),
        }
        if old:
            row["available_credit_limit"] = rng.randint(0, row["current_credit_limit"])
        Applicant.from_dict(row)
        rows.append({"user_id": f"DEMO-{index + 1:03d}", **row})
    return rows


def main():
    DESTINATION.parent.mkdir(parents=True, exist_ok=True)
    with DESTINATION.open("w", encoding="utf-8-sig", newline="") as output:
        writer = csv.DictWriter(output, fieldnames=["user_id", *FIELDS])
        writer.writeheader()
        for row in make_rows():
            writer.writerow({key: "" if value is None else str(value).lower() if isinstance(value, bool) else value
                             for key, value in row.items()})
    print(DESTINATION)


if __name__ == "__main__":
    main()
