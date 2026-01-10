from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
import os
import json
from fastapi.middleware.gzip import GZipMiddleware
from fastapi_cache import FastAPICache
from fastapi_cache.backends.redis import RedisBackend
from fastapi_cache.decorator import cache
from redis import asyncio as aioredis
from analysis import (
    get_telemetry_multi, 
    generate_ai_insights, 
    get_available_years, 
    get_races_for_year, 
    get_sessions_for_race,
    get_race_lap_distribution,
    get_season_standings,
    get_season_schedule
)

app = FastAPI()
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Redis on Startup
@app.on_event("startup")
async def startup():
    # On Zeabur, use the internal Redis connection string
    redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379")
    redis = aioredis.from_url(redis_url, encoding="utf8", decode_responses=True)
    FastAPICache.init(RedisBackend(redis), prefix="f1-cache")

@app.get("/years")
def get_years(): return {"years": get_available_years()}

@app.get("/races")
def get_races(year: int): return {"races": get_races_for_year(year)}

@app.get("/sessions")
def get_sessions(year: int, race: str): return {"sessions": get_sessions_for_race(year, race)}

@app.get("/race_laps")
def get_race_laps_endpoint(year: int, race: str, session: str, drivers: str):
    driver_list = [d.strip().upper() for d in drivers.split(',')]
    try:
        data = get_race_lap_distribution(year, race, session, driver_list)
        return {"status": "success", "data": data}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/analyze")
@cache(expire=604800) # Cache for 1 week (604800 seconds)
def analyze_drivers(year: int, race: str, session: str, drivers: str, specific_laps: str = Query(None), quality: str = "high"):
    driver_list = [d.strip().upper() for d in drivers.split(',')]
    num_points = 800 if quality == "low" else 4000
    specific_laps_list = None
    if specific_laps:
        try: specific_laps_list = json.loads(specific_laps)
        except: pass 

    try:
        data = get_telemetry_multi(year, race, session, driver_list, specific_laps=specific_laps_list, resolution=num_points)
        insights = []
        keys = list(data['drivers'].keys())
        if len(keys) >= 2:
            insights = generate_ai_insights(data, keys[0], keys[1])
        return {"status": "success", "data": data, "ai_insights": insights}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# --- NEW ROUTES FOR CHAMPIONSHIP ---
@app.get("/standings")
def season_standings(year: int):
    data = get_season_standings(year)
    return {"status": "success", "data": data}

@app.get("/schedule")
def season_schedule(year: int):
    data = get_season_schedule(year)
    return {"status": "success", "data": data}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

