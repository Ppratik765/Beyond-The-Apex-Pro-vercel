from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
# Import analysis carefully so if it crashes, we see the error
try:
    from analysis import (
        get_telemetry_multi, 
        generate_ai_insights, 
        get_available_years, 
        get_races_for_year, 
        get_sessions_for_race,
        get_race_lap_distribution
    )
except ImportError as e:
    print(f"CRITICAL ERROR IMPORTING ANALYSIS: {e}")
    # We define dummy functions so the app doesn't crash completely
    def get_available_years(): return []
    def get_races_for_year(y): return []
    def get_sessions_for_race(y, r): return []
    def get_race_lap_distribution(*args): raise Exception("Analysis module failed to load")
    def get_telemetry_multi(*args, **kwargs): raise Exception("Analysis module failed to load")
    def generate_ai_insights(*args): return []

import json

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- ROUTES ---
# We define a wrapper to register routes twice:
# 1. At /api/... (for Vercel rewrites)
# 2. At /... (for local dev or if Vercel strips the prefix)

def register_route(path, func, method="GET"):
    if method == "GET":
        app.get(path)(func)
        app.get(f"/api{path}")(func)

# 1. Health Check (To verify API is running)
@app.get("/")
@app.get("/api")
def health_check():
    return {"status": "ok", "message": "F1 Insights Engine is running"}

# 2. Years
@app.get("/years")
@app.get("/api/years")
def get_years_endpoint():
    return {"years": get_available_years()}

# 3. Races
@app.get("/races")
@app.get("/api/races")
def get_races_endpoint(year: int):
    return {"races": get_races_for_year(year)}

# 4. Sessions
@app.get("/sessions")
@app.get("/api/sessions")
def get_sessions_endpoint(year: int, race: str):
    return {"sessions": get_sessions_for_race(year, race)}

# 5. Race Laps
@app.get("/race_laps")
@app.get("/api/race_laps")
def get_race_laps_endpoint(year: int, race: str, session: str, drivers: str):
    driver_list = [d.strip().upper() for d in drivers.split(',')]
    try:
        data = get_race_lap_distribution(year, race, session, driver_list)
        return {"status": "success", "data": data}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# 6. Analyze
@app.get("/analyze")
@app.get("/api/analyze")
def analyze_endpoint(year: int, race: str, session: str, drivers: str, specific_laps: str = Query(None)):
    driver_list = [d.strip().upper() for d in drivers.split(',')]
    specific_laps_list = None
    if specific_laps:
        try: specific_laps_list = json.loads(specific_laps)
        except: pass 

    try:
        data = get_telemetry_multi(year, race, session, driver_list, specific_laps=specific_laps_list)
        insights = []
        keys = list(data['drivers'].keys())
        if len(keys) >= 2:
            insights = generate_ai_insights(data, keys[0], keys[1])
        return {"status": "success", "data": data, "ai_insights": insights}
    except Exception as e:
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

