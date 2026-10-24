import sys, unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "pipelines"))
from train_cleansheet import FEATURES


class TestCleanSheetLeakage(unittest.TestCase):
    def test_no_match_outcome_features(self):
        forbidden = {"home_score", "away_score", "result", "target",
                     "home_cs", "away_cs", "synthetic_power_diff",
                     "home_xg", "away_xg"}
        self.assertFalse(forbidden.intersection(FEATURES))

    def test_only_rolling_features(self):
        for f in FEATURES:
            self.assertTrue(f.endswith("_l5"), f)


if __name__ == "__main__":
    unittest.main()