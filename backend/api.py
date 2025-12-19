from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from analysis import (
    get_telemetry_multi, 
    generate_ai_insights, 
    get_available_years, 
    get_races_for_year, 
    get_sessions_for_race,
    get_race_lap_distribution
)
import json
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# HELPER: Determine route prefix based on environment
# If on Vercel, requests come in as "/api/years", so we need to handle that.
PREFIX = "/api" if os.environ.get('VERCEL') else ""

@app.get(f"{PREFIX}/years")
def get_years(): return {"years": get_available_years()}

@app.get(f"{PREFIX}/races")
def get_races(year: int): return {"races": get_races_for_year(year)}

@app.get(f"{PREFIX}/sessions")
def get_sessions(year: int, race: str): return {"sessions": get_sessions_for_race(year, race)}

@app.get(f"{PREFIX}/race_laps")
def get_race_laps_endpoint(year: int, race: str, session: str, drivers: str):
    driver_list = [d.strip().upper() for d in drivers.split(',')]
    try:
        data = get_race_lap_distribution(year, race, session, driver_list)
        return {"status": "success", "data": data}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get(f"{PREFIX}/analyze")
def analyze_drivers(
    year: int, 
    race: str, 
    session: str, 
    drivers: str, 
    specific_laps: str = Query(None)
):
    driver_list = [d.strip().upper() for d in drivers.split(',')]
    specific_laps_list = None
    if specific_laps:
        try:
            specific_laps_list = json.loads(specific_laps)
        except:
            pass 

    try:
        data = get_telemetry_multi(year, race, session, driver_list, specific_laps=specific_laps_list)
        insights = []
        keys = list(data['drivers'].keys())
        if len(keys) >= 2:
            insights = generate_ai_insights(data, keys[0], keys[1])
        
        return {
            "status": "success",
            "data": data,
            "ai_insights": insights
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    import uvicorn
    # When running locally, we still run on port 8000, but routes won't have the /api prefix 
    # unless you manually add it. Ideally, Vercel handles the rewrite.
    uvicorn.run(app, host="0.0.0.0", port=8000)
