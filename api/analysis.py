import fastf1
import pandas as pd
import numpy as np
import os
import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Updated Cache Logic for Persistent Storage
if os.environ.get('ZEABUR_SERVICE_ID') or os.path.exists("/app/api/cache"):
    # Use the mounted volume path
    CACHE_DIR = "/app/api/cache"
else:
    # Fallback for local dev
    CACHE_DIR = os.path.join(BASE_DIR, 'cache')

if not os.path.exists(CACHE_DIR):
    os.makedirs(CACHE_DIR, exist_ok=True)
fastf1.Cache.enable_cache(CACHE_DIR)

# --- HELPER FUNCTIONS ---
def get_available_years():
    current_year = datetime.date.today().year
    return list(range(2016, current_year + 1))

def get_races_for_year(year):
    try:
        year = int(year)
        schedule = fastf1.get_event_schedule(year)
        schedule = schedule[schedule['EventFormat'] != 'testing']
        
        current_time = datetime.datetime.now(datetime.timezone.utc)
        current_year = datetime.date.today().year
        
        if year == current_year:
            schedule = schedule[
                pd.to_datetime(schedule['Session5Date'], utc=True) < (current_time - datetime.timedelta(hours=2))
            ]
            
        races = schedule['EventName'].unique().tolist()
        return races
    except:
        return []

def get_sessions_for_race(year, race_name):
    try:
        schedule = fastf1.get_event_schedule(year)
        event = schedule[schedule['EventName'] == race_name].iloc[0]
        sessions = []
        for i in range(1, 6):
            session_key = f'Session{i}'
            if hasattr(event, session_key) and not pd.isna(event[session_key]):
                sessions.append(event[session_key])
        return sessions
    except:
        return []

# --- CORE ANALYSIS ---

def get_race_lap_distribution(year, race, session_type, driver_list):
    session = fastf1.get_session(year, race, session_type)
    session.load(telemetry=False, weather=True, messages=False) 

    winner_name = "N/A"
    winner_label = "WINNER"
    try:
        if "Practice" in session_type:
            fastest_lap = session.laps.pick_fastest()
            driver_code = fastest_lap['Driver']
            winner_label = "FASTEST LAP"
            try:
                row = session.results.loc[session.results['Abbreviation'] == driver_code].iloc[0]
                winner_name = f"{row['FirstName']} {row['LastName']}"
            except:
                winner_name = driver_code
        else:
            results = session.results.sort_values(by='Position')
            if not results.empty:
                p1 = results.iloc[0]
                winner_name = f"{p1['FirstName']} {p1['LastName']}"
            
            if "Sprint" in session_type:
                winner_label = "SPRINT WINNER"
            else:
                winner_label = "RACE WINNER"
    except: pass

    weather = {"air_temp": 0, "track_temp": 0, "humidity": 0, "rain": False}
    try:
        if hasattr(session, 'weather_data') and not session.weather_data.empty:
            w = session.weather_data
            weather = {
                "air_temp": round(float(w['AirTemp'].mean()), 1),
                "track_temp": round(float(w['TrackTemp'].mean()), 1),
                "humidity": round(float(w['Humidity'].mean()), 1),
                "rain": bool(w['Rainfall'].any())
            }
    except: pass

    lap_data = []
    stint_data = {}
    deg_insights = []

    for d in driver_list:
        try:
            driver_laps = session.laps[session.laps['Driver'] == d].copy().reset_index()
            driver_stints = []
            current_stint = None
            stint_laps_cache = []

            for idx, lap in driver_laps.iterrows():
                if not pd.isna(lap['LapTime']):
                    raw_compound = lap['Compound']
                    compound = str(raw_compound).upper() if raw_compound else 'UNKNOWN'
                    if compound in ['NAN', '', 'NONE']: compound = 'UNKNOWN'
                    
                    lap_data.append({
                        'driver': d,
                        'lap_number': int(lap['LapNumber']),
                        'lap_time_seconds': lap['LapTime'].total_seconds(),
                        'compound': compound
                    })

                lap_num = int(lap['LapNumber'])
                raw_compound = lap['Compound']
                compound = str(raw_compound).upper() if raw_compound else 'UNKNOWN'
                if compound in ['NAN', '', 'NONE']: compound = 'UNKNOWN'
                
                is_pit_entry = not pd.isna(lap['PitInTime'])
                is_pit_out = not pd.isna(lap['PitOutTime'])

                if current_stint is None:
                    current_stint = {'compound': compound, 'start': lap_num, 'end': lap_num}
                    stint_laps_cache = []
                elif compound != current_stint['compound']:
                    driver_stints.append(current_stint)
                    calculate_degradation(d, current_stint, stint_laps_cache, deg_insights)
                    current_stint = {'compound': compound, 'start': lap_num, 'end': lap_num}
                    stint_laps_cache = []
                else:
                    current_stint['end'] = lap_num
                
                if not pd.isna(lap['LapTime']) and not is_pit_entry and not is_pit_out:
                    stint_laps_cache.append({'n': lap_num, 't': lap['LapTime'].total_seconds()})

                if is_pit_entry:
                    driver_stints.append(current_stint)
                    calculate_degradation(d, current_stint, stint_laps_cache, deg_insights)
                    current_stint = None
                    stint_laps_cache = []
            
            if current_stint:
                driver_stints.append(current_stint)
                calculate_degradation(d, current_stint, stint_laps_cache, deg_insights)
            
            stint_data[d] = driver_stints

        except:
            continue
            
    if not lap_data:
         raise Exception("No valid lap data found.")

    return {
        "laps": lap_data, 
        "stints": stint_data, 
        "race_winner": winner_name, 
        "winner_label": winner_label, 
        "weather": weather,
        "ai_insights": deg_insights[:7]
    }

def calculate_degradation(driver, stint, laps, insights_list):
    if len(laps) < 4: return
    x = np.array([l['n'] for l in laps])
    y = np.array([l['t'] for l in laps])
    mean_y = np.mean(y)
    std_y = np.std(y)
    mask = np.abs(y - mean_y) < 2 * std_y
    if np.sum(mask) < 4: return
    slope, _ = np.polyfit(x[mask], y[mask], 1)
    compound = stint['compound']
    if compound == 'UNKNOWN': return
    if slope > 0.08:
        insights_list.append(f"{driver} {compound}s degraded heavily (+{slope:.2f}s/lap).")
    elif slope > 0.03:
        insights_list.append(f"{driver} {compound}s degraded by {slope:.2f}s per lap.")
    elif slope > -0.01 and slope < 0.01:
        insights_list.append(f"{driver} {compound}s held steady.")
    elif slope < -0.02:
        insights_list.append(f"{driver} got faster on {compound}s (-{abs(slope):.2f}s/lap).")

def get_telemetry_multi(year, race, session_type, driver_list, specific_laps=None, resolution=4000):
    session = fastf1.get_session(year, race, session_type)
    session.load()
    
    weather = {"air_temp": 0, "track_temp": 0, "humidity": 0, "rain": False}
    try:
        if hasattr(session, 'weather_data') and not session.weather_data.empty:
            w = session.weather_data
            weather = {
                "air_temp": round(float(w['AirTemp'].mean()), 1),
                "track_temp": round(float(w['TrackTemp'].mean()), 1),
                "humidity": round(float(w['Humidity'].mean()), 1),
                "rain": bool(w['Rainfall'].any())
            }
    except: pass

    pole_lap = session.laps.pick_fastest()
    pole_tel = pole_lap.get_telemetry().add_distance()
    max_track_length = pole_tel['Distance'].max()
    
    max_dist = 0
    loaded_laps = {} 

    if specific_laps and len(specific_laps) > 0:
        for item in specific_laps:
            d = item['driver']
            ln = item['lap']
            try:
                drv_laps = session.laps[session.laps['Driver'] == d]
                target_rows = drv_laps[drv_laps['LapNumber'] == ln]
                if not target_rows.empty:
                    target = target_rows.iloc[0]
                    tel = target.get_telemetry().add_distance()
                    max_dist = max(max_dist, tel['Distance'].max())
                    key = f"{d} (L{ln})"
                    loaded_laps[key] = {"lap": target, "tel": tel, "driver": d}
            except: continue
    else:
        for d in driver_list:
            try:
                drv_laps = session.laps[session.laps['Driver'] == d]
                if not drv_laps.empty:
                    target = drv_laps.pick_fastest()
                    if target is not None:
                        tel = target.get_telemetry().add_distance()
                        max_dist = max(max_dist, tel['Distance'].max())
                        loaded_laps[d] = {"lap": target, "tel": tel, "driver": d}
            except: continue

    if max_dist == 0 or not loaded_laps:
        raise Exception("No data found.")

    x_new = np.linspace(0, max_track_length, num=resolution)
    pole_time_interp = np.interp(x_new, pole_tel['Distance'], pole_tel['Time'].dt.total_seconds())

    results = {}
    for key, data in loaded_laps.items():
        tel = data["tel"]
        lap = data["lap"]
        
        time_interp = np.interp(x_new, tel['Distance'], tel['Time'].dt.total_seconds())
        delta_to_pole = time_interp - pole_time_interp
        
        rpm = np.interp(x_new, tel['Distance'], tel['RPM']) if 'RPM' in tel else np.zeros_like(x_new)
        gear = np.interp(x_new, tel['Distance'], tel['nGear']) if 'nGear' in tel else np.zeros_like(x_new)
        speed = np.interp(x_new, tel['Distance'], tel['Speed'])
        throttle = np.interp(x_new, tel['Distance'], tel['Throttle'])
        brake_raw = np.interp(x_new, tel['Distance'], tel['Brake'])
        
        x_track = np.interp(x_new, tel['Distance'], tel['X']) if 'X' in tel else np.zeros_like(x_new)
        y_track = np.interp(x_new, tel['Distance'], tel['Y']) if 'Y' in tel else np.zeros_like(x_new)

        speed_ms = speed / 3.6
        dv = np.gradient(speed_ms)
        dt = np.gradient(time_interp)
        dt[dt == 0] = 1e-6 
        long_accel_g = dv / dt / 9.81 
        
        if np.max(brake_raw) <= 1.5: brake_raw = brake_raw * 100
        brake_pct = brake_raw.tolist()

        rpm = np.nan_to_num(rpm, nan=0.0)
        long_accel_g = np.nan_to_num(long_accel_g, nan=0.0)
        delta_to_pole = np.nan_to_num(delta_to_pole, nan=0.0)
        
        raw_compound = lap['Compound']
        compound_str = str(raw_compound).upper() if raw_compound else 'UNKNOWN'
        compound_symbol = compound_str[0] if len(compound_str) > 0 else '?'

        results[key] = {
            "telemetry": {
                'distance': x_new.tolist(),
                'speed': np.nan_to_num(speed, nan=0.0).tolist(),
                'throttle': np.nan_to_num(throttle, nan=0.0).tolist(),
                'brake': np.nan_to_num(brake_pct, nan=0.0).tolist(),
                'rpm': np.nan_to_num(rpm, nan=0.0).tolist(),
                'gear': np.nan_to_num(gear, nan=0.0).tolist(),
                'long_g': np.nan_to_num(long_accel_g, nan=0.0).tolist(),
                'delta_to_pole': np.nan_to_num(delta_to_pole, nan=0.0).tolist(),
                'time': np.nan_to_num(time_interp, nan=0.0).tolist(),
                'x': np.nan_to_num(x_track, nan=0.0).tolist(),
                'y': np.nan_to_num(y_track, nan=0.0).tolist()
            },
            "sectors": [
                lap['Sector1Time'].total_seconds(), 
                lap['Sector2Time'].total_seconds(), 
                lap['Sector3Time'].total_seconds()
            ],
            "lap_time": lap.LapTime.total_seconds(),
            "lap_number": int(lap['LapNumber']),
            "tyre_info": {
                "compound": compound_str,
                "symbol": compound_symbol,
                "age": int(lap['TyreLife']) if not pd.isna(lap['TyreLife']) else 0
            }
        }

    try:
        best_s1 = session.laps['Sector1Time'].min().total_seconds()
        best_s2 = session.laps['Sector2Time'].min().total_seconds()
        best_s3 = session.laps['Sector3Time'].min().total_seconds()
    except:
        best_s1, best_s2, best_s3 = 0,0,0

    return {
        "drivers": results,
        "session_best_sectors": [best_s1, best_s2, best_s3],
        "track_length": max_track_length, 
        "pole_info": {"driver": pole_lap['Driver'], "time": pole_lap.LapTime.total_seconds()},
        "weather": weather
    }

def generate_ai_insights(multi_data, k1, k2):
    """
    Generates smart comparison insights between two drivers by identifying
    corners (local minima in speed) and straights (local maxima).
    """
    if k1 not in multi_data['drivers'] or k2 not in multi_data['drivers']:
        return ["Insufficient data for analysis."]

    d1 = multi_data['drivers'][k1]
    d2 = multi_data['drivers'][k2]
    
    t1 = d1['telemetry']
    t2 = d2['telemetry']
    
    # Extract arrays
    dist = np.array(t1['distance'])
    speed1 = np.array(t1['speed'])
    speed2 = np.array(t2['speed'])
    throttle1 = np.array(t1['throttle'])
    throttle2 = np.array(t2['throttle'])
    brake1 = np.array(t1['brake'])
    brake2 = np.array(t2['brake'])
    time1 = np.array(t1['time'])
    time2 = np.array(t2['time'])
    
    insights = []
    
    # 1. Compare Lap Times
    gap = d2['lap_time'] - d1['lap_time']
    faster_driver = k1 if gap > 0 else k2
    insights.append(f"🏁 **Lap Time:** {faster_driver} is faster by {abs(gap):.3f}s.")

    # 2. Identify Corners (Local Minima in Speed)
    # We smooth speed slightly to avoid noise, then find peaks
    # A 'corner' is where speed drops significantly
    
    # Simple peak detection for local minima (corners)
    # We look for points where speed is lower than neighbors
    window = 50 # Check +/- 50 indices
    corners = []
    
    # Iterate through track to find apexes
    # Optimization: Skip every 50m to speed up
    for i in range(window, len(dist) - window, window):
        chunk_s1 = speed1[i-window:i+window]
        min_idx_local = np.argmin(chunk_s1)
        global_idx = i - window + min_idx_local
        
        # Check if it's a real corner (speed < 200km/h usually, distinct dip)
        current_speed = speed1[global_idx]
        if current_speed < 250 and current_speed < np.mean(speed1[global_idx-100:global_idx+100]) - 20:
            # Avoid duplicate corners close to each other
            if not corners or abs(dist[global_idx] - dist[corners[-1]]) > 200:
                corners.append(global_idx)

    # 3. Analyze Each Corner
    turn_count = 1
    for idx in corners:
        meter_point = int(dist[idx])
        
        # A. Apex Speed
        s1_apex = speed1[idx]
        s2_apex = speed2[idx]
        diff = s1_apex - s2_apex
        
        if abs(diff) > 3: # Ignore negligible diffs
            adv = k1 if diff > 0 else k2
            insights.append(f"📍 **Turn {turn_count} ({meter_point}m):** {adv} carries +{abs(int(diff))} km/h minimum speed.")

        # B. Braking (Who brakes later?)
        # Look backwards from apex to find where brake went > 50%
        # Simple heuristic: Check 300m before apex
        search_back = 300 
        start_search = max(0, idx - int(search_back)) # Roughly indices, not meters perfectly, but close enough for gradients
        
        # Find where braking started (first index where brake > 10 in the window leading to corner)
        b1_zone = np.where(brake1[start_search:idx] > 10)[0]
        b2_zone = np.where(brake2[start_search:idx] > 10)[0]
        
        if len(b1_zone) > 0 and len(b2_zone) > 0:
            # Global index of braking start
            b1_start = start_search + b1_zone[0]
            b2_start = start_search + b2_zone[0]
            
            # Distance diff
            brake_diff_m = dist[b1_start] - dist[b2_start]
            
            if abs(brake_diff_m) > 5: # If diff is > 5 meters
                late_braker = k1 if brake_diff_m > 0 else k2 # Larger distance means started later
                insights.append(f"🛑 **Braking into Turn {turn_count}:** {late_braker} brakes {abs(int(brake_diff_m))}m later.")

        # C. Throttle Application (Who gets on power earlier?)
        # Look forwards from apex
        search_fwd = 300
        end_search = min(len(dist), idx + int(search_fwd))
        
        t1_zone = np.where(throttle1[idx:end_search] > 90)[0] # Full throttle
        t2_zone = np.where(throttle2[idx:end_search] > 90)[0]
        
        if len(t1_zone) > 0 and len(t2_zone) > 0:
            t1_full = idx + t1_zone[0]
            t2_full = idx + t2_zone[0]
            
            throttle_diff_m = dist[t1_full] - dist[t2_full]
            
            if abs(throttle_diff_m) > 10:
                early_power = k2 if throttle_diff_m > 0 else k1 # Smaller distance means earlier
                insights.append(f"🚀 **Exit of Turn {turn_count}:** {early_power} reaches full throttle {abs(int(throttle_diff_m))}m earlier.")

        turn_count += 1

    # 4. Straight Line Speed (DRS/Drag)
    # Find max speed on longest straight
    max_idx = np.argmax(speed1)
    top_s1 = speed1[max_idx]
    top_s2 = speed2[max_idx]
    
    if abs(top_s1 - top_s2) > 2:
        fastest_straight = k1 if top_s1 > top_s2 else k2
        insights.append(f"🔥 **Top Speed:** {fastest_straight} is faster by {abs(int(top_s1 - top_s2))} km/h on the main straight.")

    # Limit to 12 most impactful
    return insights[:12]

# --- UPDATED CHAMPIONSHIP LOGIC ---
def get_season_standings(year):
    """
    Fetches WDC and WCC standings.
    Robust fallback to previous year standings if current year data is missing (e.g. 2026).
    """
    from fastf1.ergast import Ergast
    ergast = Ergast()
    
    wdc = []
    wcc = []
    
    # 1. Try fetching real WDC standings
    try:
        response = ergast.get_driver_standings(season=year)
        if hasattr(response, 'content') and len(response.content) > 0:
            drivers = response.content[0]
            for _, d in drivers.iterrows():
                team_name = "N/A"
                if 'constructorNames' in d: # List of strings
                    try:
                        c_names = d['constructorNames']
                        if isinstance(c_names, list) and len(c_names) > 0:
                            team_name = c_names[-1]
                        elif isinstance(c_names, str):
                            team_name = c_names
                    except: pass
                elif 'constructorName' in d:
                    team_name = d['constructorName']
                
                wdc.append({
                    "position": int(d['position']),
                    "points": float(d['points']),
                    "driver": d['driverId'],
                    "code": d['driverCode'],
                    "name": f"{d['givenName']} {d['familyName']}",
                    "team": team_name
                })
        else:
            raise Exception("No data")
    except:
        # Fallback: Fetch previous year standings and reset points to 0
        try:
            fallback_response = ergast.get_driver_standings(season=year-1)
            if hasattr(fallback_response, 'content') and len(fallback_response.content) > 0:
                drivers_fallback = fallback_response.content[0]
                for idx, d in drivers_fallback.iterrows():
                    team_name = "N/A"
                    if 'constructorNames' in d: 
                        try:
                            c_names = d['constructorNames']
                            if isinstance(c_names, list) and len(c_names) > 0: team_name = c_names[-1]
                            elif isinstance(c_names, str): team_name = c_names
                        except: pass
                    elif 'constructorName' in d:
                        team_name = d['constructorName']

                    wdc.append({
                        "position": idx + 1,
                        "points": 0, # Reset points
                        "driver": d['driverId'],
                        "code": d['driverCode'],
                        "name": f"{d['givenName']} {d['familyName']}",
                        "team": team_name
                    })
        except Exception as e:
            print(f"WDC Fallback Error: {e}")

    # 2. Try fetching real WCC standings
    try:
        response = ergast.get_constructor_standings(season=year)
        if hasattr(response, 'content') and len(response.content) > 0:
            teams = response.content[0]
            for _, t in teams.iterrows():
                wcc.append({
                    "position": int(t['position']),
                    "points": float(t['points']),
                    "team": t['constructorName'],
                    "id": t['constructorId']
                })
        else:
            raise Exception("No data")
    except:
        try:
            fallback_response = ergast.get_constructor_standings(season=year-1)
            if hasattr(fallback_response, 'content') and len(fallback_response.content) > 0:
                teams_fallback = fallback_response.content[0]
                for idx, t in teams_fallback.iterrows():
                    wcc.append({
                        "position": idx + 1,
                        "points": 0,
                        "team": t['constructorName'],
                        "id": t['constructorId']
                    })
        except Exception as e:
            print(f"WCC Fallback Error: {e}")
            
    return {"wdc": wdc, "wcc": wcc}

def get_season_schedule(year):
    """
    Returns the full schedule with 'upcoming' status for the predictor.
    """
    try:
        schedule = fastf1.get_event_schedule(year)
        schedule = schedule[schedule['EventFormat'] != 'testing']
        
        current_time = datetime.datetime.now(datetime.timezone.utc)
        races = []
        
        for _, event in schedule.iterrows():
            is_done = False
            # Check if session 5 (Race) has a date
            if hasattr(event, 'Session5Date') and not pd.isna(event['Session5Date']):
                is_done = pd.to_datetime(event['Session5Date'], utc=True) < (current_time - datetime.timedelta(hours=2))
            
            # FIXED: Lowercase check for sprint detection
            fmt = str(event['EventFormat']).lower()
            is_sprint = 'sprint' in fmt
            
            races.append({
                "round": int(event['RoundNumber']),
                "name": event['EventName'],
                "date": str(event['Session5Date']) if not pd.isna(event['Session5Date']) else "TBD",
                "is_sprint": is_sprint,
                "is_done": is_done,
                "location": event['Location']
            })
            
        return races
    except Exception as e:
        print(f"Schedule Error: {e}")
        return []
