"""
test_anti_leakage.py

Automated test suite verifying:
1. Strict pre-kickoff anti-leakage guarantee (match_datetime < target_kickoff).
2. Target fixture is strictly excluded from historical statistics.
3. Pre-kickoff feature vector preserves exact trained model contract.
4. Model probabilities sum to 1.0 across all 3 classes (Home Win, Draw, Away Win).
"""

import unittest
import sys
from pathlib import Path
import pandas as pd
from datetime import datetime

# Ensure project root is in sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.app.services.match_history import retrieve_last_five_matches, get_dataset
from backend.app.services.feature_engineering import build_pre_match_features, FEATURE_COLS
from backend.app.services.model_service import predict_outcome, load_model


class TestAntiLeakageAndIntegrity(unittest.TestCase):

    def setUp(self):
        self.df = get_dataset()
        self.target_kickoff = "2024-12-07T16:15:00Z"
        self.home_team = "Betis"
        self.away_team = "Barcelona"

    def test_strict_temporal_precedence(self):
        """Verify that every retrieved historical match occurred strictly prior to target kickoff."""
        kickoff_dt = pd.to_datetime(self.target_kickoff).tz_localize(None)
        
        home_matches, home_summary = retrieve_last_five_matches(self.home_team, self.target_kickoff, n=5)
        away_matches, away_summary = retrieve_last_five_matches(self.away_team, self.target_kickoff, n=5)

        self.assertGreater(len(home_matches), 0, "Should retrieve matches for Betis")
        self.assertGreater(len(away_matches), 0, "Should retrieve matches for Barcelona")

        for m in home_matches:
            m_dt = pd.to_datetime(m["datetime"]).tz_localize(None)
            self.assertLess(
                m_dt,
                kickoff_dt,
                f"Data Leakage Detected: Match {m['match_id']} on {m_dt} occurred on or after kickoff {kickoff_dt}"
            )

        for m in away_matches:
            m_dt = pd.to_datetime(m["datetime"]).tz_localize(None)
            self.assertLess(
                m_dt,
                kickoff_dt,
                f"Data Leakage Detected: Match {m['match_id']} on {m_dt} occurred on or after kickoff {kickoff_dt}"
            )

    def test_target_fixture_exclusion(self):
        """Ensure the target fixture itself is never included in the historical sample."""
        kickoff_dt = pd.to_datetime(self.target_kickoff).tz_localize(None)
        
        home_matches, _ = retrieve_last_five_matches(self.home_team, self.target_kickoff, n=5)
        for m in home_matches:
            m_dt = pd.to_datetime(m["datetime"]).tz_localize(None)
            # If a match has both teams on the same date, verify it's not the future match
            if m["opponent"] == self.away_team:
                self.assertLess(m_dt, kickoff_dt)

    def test_feature_contract_and_ordering(self):
        """Verify that feature engineering produces the exact 21 features in the exact trained model order."""
        _, home_summary = retrieve_last_five_matches(self.home_team, self.target_kickoff, n=5)
        _, away_summary = retrieve_last_five_matches(self.away_team, self.target_kickoff, n=5)

        feat_df, feat_dict, drivers = build_pre_match_features(
            home_summary, away_summary, self.home_team, self.away_team
        )

        self.assertEqual(list(feat_df.columns), FEATURE_COLS, "Feature columns must match FEATURE_COLS exactly")
        self.assertEqual(len(feat_df.columns), 21, "Model expects exactly 21 features")
        self.assertFalse(feat_df.isnull().any().any(), "Feature vector must contain zero NaN values")

    def test_three_class_probabilities_sum_to_one(self):
        """Verify model output format and probability calibration."""
        _, home_summary = retrieve_last_five_matches(self.home_team, self.target_kickoff, n=5)
        _, away_summary = retrieve_last_five_matches(self.away_team, self.target_kickoff, n=5)

        feat_df, _, _ = build_pre_match_features(
            home_summary, away_summary, self.home_team, self.away_team
        )

        pred_res = predict_outcome(feat_df)
        self.assertIn(pred_res["predicted_outcome"], ["Home Win", "Draw", "Away Win"])

        probs = pred_res["probabilities"]
        prob_sum = probs["home_win"] + probs["draw"] + probs["away_win"]
        self.assertAlmostEqual(prob_sum, 1.0, delta=0.01, msg="Class probabilities must sum to 1.0")


if __name__ == "__main__":
    unittest.main()
