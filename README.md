# MatchPredict — Real-Time Football Fixture & ML Prediction App

A sports analytics web application that automatically retrieves real upcoming football fixtures and forecasts 3-class outcomes (**Home Win**, **Draw**, **Away Win**) using real pre-kickoff historical match statistics and a trained **LightGBM** model.

---

## 1. Key Features & Workflow

1. **Live Upcoming Fixtures Feed**: Automatically fetches upcoming fixtures for La Liga, Premier League, Serie A, Bundesliga, and Ligue 1 from verified free data sources (e.g. Real Betis vs FC Barcelona, Real Betis vs Valencia).
2. **Local Timezone Display**: Real kickoff date and time rendered in the user's local timezone.
3. **Strict Pre-Kickoff Anti-Leakage**: 
   - Retrieves only matches completed strictly **before** target kickoff (`match_datetime < target_kickoff`).
   - The target fixture is never included in historical feature calculations.
4. **Honest Sample Sizes & Missing Data Representation**:
   - Explicitly displays the sample count for every metric (e.g., `5/5 matches` or `3/5 matches`).
   - Unavailable statistics are honestly marked as `N/A`, never silently replaced with zero.
5. **Calibrated 3-Class Outcome Probabilities**:
   - Probabilities for **Home Win**, **Draw**, and **Away Win** strictly derived from the trained model (summing to 100%).
6. **Side-by-Side Team Form Panels**:
   - W/D/L badges, scorelines, dates, and per-game averages.
   - Home-only and Away-only venue performance metrics.
7. **Automated Anti-Leakage Test Suite**:
   - Includes `test_anti_leakage.py` verifying that all retrieved historical matches strictly precede kickoff.

---

## 2. Technology Stack

* **Frontend**: React 19 + Vite (JavaScript), pure modern CSS, Recharts for head-to-head metrics, Lucide React icons.
* **Backend**: Python Flask (`server.py`) with REST API endpoints, CORS enabled.
* **Machine Learning**: 3-Class LightGBM Classifier (`model_3way.joblib`), trained on historical 5-game rolling features with `shift(1)` protection.
* **Data Sources**:
  - Live Fixtures: **OpenFootball** free JSON schedule feed (`es.1.json`, `en.1.json`, etc.) with optional support for **football-data.org** API key.
  - Historical Archive: **96,305 completed European matches** (`cleaned_dataset.csv`) providing shots, shots on target, possession, corners, fouls, and scores.

---

## 3. Quick Start & Installation

### Step 1: Start the Machine Learning Backend
In the root directory:
```bash
# 1. Install Python dependencies
pip install -r requirements.txt

# 2. Run the anti-leakage test suite
python -m unittest ml/tests/test_anti_leakage.py

# 3. Start the prediction server
python server.py
```
Backend will be active on **`http://127.0.0.1:5000`**.

### Step 2: Start the React Frontend
In a new terminal:
```bash
cd frontend

# 1. Install dependencies
npm install

# 2. Start Vite development server
npm run dev
```
* **Discipline & Set Pieces**: Corner kicks, fouls committed.

---

## 7. Project Architecture & Modular Layout

The repository is logically structured into three distinct domains to facilitate future collaboration between backend developers, ML engineers, and frontend designers:

```
ML project - Football/
│
├── backend/                       # BACKEND (REST API & Inference Services)
│   ├── app/                       # Flask application package
│   │   ├── __init__.py
│   │   └── services/              # Domain & serving services
│   │       ├── __init__.py
│   │       ├── football_provider.py  # Live upcoming fixtures & team resolution
│   │       ├── match_history.py      # Historical match records retrieval
│   │       ├── feature_engineering.py# Pre-kickoff feature vector generation
│   │       └── model_service.py      # LightGBM model inference & probabilities
│   ├── config.py                  # Centralized path & environment configuration
│   ├── server.py                  # Flask server implementation
│   └── prediction_history.json    # Cached prediction logs
│
├── ml/                            # MACHINE LEARNING PIPELINE
│   ├── data/                      # Historical datasets
│   │   └── cleaned_dataset.csv    # 96,305 matches archive (2000-2026)
│   ├── models/                    # Serialized model weights & artifacts
│   │   └── model_3way.joblib      # 3-class LightGBM classifier
│   ├── pipelines/                 # Training and data processing scripts
│   │   ├── clean_dataset.py       # Data cleaning & incident parsing pipeline
│   │   ├── inspect_data.py        # Dataset exploratory inspection CLI tool
│   │   └── train_model.py         # LightGBM training & cross-formulation benchmark
│   └── tests/                     # ML validation test suites
│       └── test_anti_leakage.py   # Strict pre-kickoff anti-leakage test suite
│
├── frontend/                      # FRONTEND (React 19 + Vite UI)
│   ├── src/                       # Components, pages, and interactive dashboard
│   ├── package.json
│   └── vite.config.js
│
├── server.py                      # Root entrypoint (delegates to backend/server.py)
├── .gitignore                     # Git exclusions (.env, node_modules, cache)
├── .env.example                   # Environment variable template
└── README.md                      # Project documentation
```

### Running Commands:
* **Start Server:** `python server.py` (or `python backend/server.py`)
* **Start Frontend:** `cd frontend && npm run dev`
* **Run ML Tests:** `python -m unittest ml/tests/test_anti_leakage.py`
* **Train Model:** `python ml/pipelines/train_model.py`
* **Inspect Dataset:** `python ml/pipelines/inspect_data.py --summary`

## Player Injury Risk (Players tab)

The **Players** tab searches any player from the top 5 European leagues (2014-2023) and shows a monthly injury-risk forecast.

* **Search**: type part of a name (accents and case ignored), pick the player from the list. Player portraits come from Wikipedia (avatar icon when none is found).
* **Risk card**: probability of an injury during the selected month, level (Low / Medium / High), the model inputs, what actually happened that month, a 24-month risk timeline and the injury history.
* **Model**: `HistGradientBoostingClassifier` on one row per player-month (`ml/data/dataset_risque_blessure.csv`, injuries from `ml/data/blessures.csv`). Chronological split: train < 2020-07, validation 2020-07 → 2021-06 (sets the Medium/High thresholds at the 50th/80th percentile), test ≥ 2021-07.
* **Test results**: ROC-AUC 0.669; real injury rate 5.1% (Low), 10.2% (Medium), 18.1% (High).
* **Retrain**: `python ml/pipelines/train_injury_model.py` → `ml/models/injury_risk.joblib`.
* **Notebook**: the original analysis is in `notebooks/projet esprit final v3.ipynb`.

Endpoints:
* `GET /api/players/search?q=messi`
* `GET /api/players/injury-risk?name=Lionel Messi&month=2022-11` (month optional, defaults to the latest)
* `GET /api/players/photos?names=Lionel Messi|Neymar` and `GET /api/players/photo?name=Neymar`

---

## 4. Backend API Contract (`server.py`)

All endpoints are hosted at `http://127.0.0.1:5000/api`:

### `GET /api/competitions`
Returns supported European football competitions.
```json
{
  "competitions": [
    { "id": "laliga", "name": "La Liga", "country": "Spain" },
    { "id": "premier-league", "name": "Premier League", "country": "England" }
  ]
}
```

### `GET /api/fixtures/upcoming?competition=laliga&search=`
Fetches scheduled upcoming matches for the selected league.
```json
{
  "total": 10,
  "competition": "laliga",
  "fixtures": [
    {
      "id": "laliga-20250523-betis-valencia",
      "competitionName": "La Liga",
      "round": "Matchday 38",
      "kickoffDate": "2025-05-23",
      "kickoffTime": "21:00",
      "kickoffUtc": "2025-05-23T21:00:00Z",
      "status": "SCHEDULED",
      "homeTeam": { "name": "Real Betis", "normalizedName": "Betis", "logo": "..." },
      "awayTeam": { "name": "Valencia CF", "normalizedName": "Valencia", "logo": "..." }
    }
  ]
}
```

### `GET /api/fixtures/:fixtureId/history`
Returns pre-kickoff 5-match histories and aggregated statistics for both clubs.

### `POST /api/predictions`
Requests an ML model forecast using the real fixture ID.
* **Request Body**:
  ```json
  {
    "fixtureId": "laliga-20250523-betis-valencia"
  }
  ```
* **Response Body**:
  ```json
  {
    "fixture": { ... },
    "match": "Real Betis vs Valencia CF",
    "home_team": "Betis",
    "away_team": "Valencia",
    "predicted_outcome": "Home Win",
    "probabilities": {
      "home_win": 0.739,
      "draw": 0.239,
      "away_win": 0.022
    },
    "key_drivers": [
      "Betis holds an elite goal difference edge (+1.0 net margin/match) in recent games."
    ],
    "home_summary": { ... },
    "away_summary": { ... },
    "data_source": "OpenFootball fixtures + 96,305 European Match Historical Dataset",
    "disclaimer": "Predictions are probabilistic statistical estimates based on pre-kickoff historical performance, not financial guarantees."
  }
  ```

---

## 5. Machine Learning Integrity & Anti-Leakage Verification

Run the test suite at any time:
```bash
python test_anti_leakage.py
```
Output:
```text
....
----------------------------------------------------------------------
Ran 4 tests in 3.123s

OK
```
Tests assert:
1. `test_strict_temporal_precedence`: Guarantees `match_datetime < target_kickoff` for all historical rows.
2. `test_target_fixture_exclusion`: Guarantees target match is never included in form calculations.
3. `test_feature_contract_and_ordering`: Guarantees exact 21 features with zero NaNs.
4. `test_three_class_probabilities_sum_to_one`: Guarantees `P(Home) + P(Draw) + P(Away) == 1.0`.

---

## 6. Available Fields vs. Real Limitations

### Available Fields:
* **Match Outcomes & Scores**: Home/Away goals, half-time scores, W/D/L result.
* **Shot Volume & Accuracy**: Total Shots, Shots on Target, Shots off Target.
* **Possession**: Coupled ball possession percentages.
* **Discipline & Set Pieces**: Corner kicks, fouls committed.

### Honest Limitations:
* **Passes & Advanced xG Models**: Free historical football datasets do not record pass completion networks or proprietary xG values. These fields are honestly represented as unavailable rather than fabricated.
* **Older Seasons**: Matches before 2012 occasionally lack shot tracking; sample sizes are tracked explicitly (`3/5 matches`) rather than treating missing records as 0%.
