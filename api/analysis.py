import fastf1
import pandas as pd
import numpy as np
import os
import datetime
import shutil

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# --- VERCEL CACHE FIX ---
# Check if we are running in a read-only environment (like Vercel)
# We use /tmp which is writable
if os.access(BASE_DIR, os.W_OK):
    CACHE_DIR = os.path.join(BASE_DIR, 'cache')
else:
    CACHE_DIR = "/tmp/fastf1_cache"

# Create cache dir if it doesn't exist
if not os.path.exists(CACHE_DIR):
    os.makedirs(CACHE_DIR, exist_ok=True)

try:
    fastf1.Cache.enable_cache(CACHE_DIR)
except Exception as e:
    print(f"Warning: Could not enable cache: {e}")

# --- HELPER FUNCTIONS ---
def get_available_years():
    current_year = datetime.date.today().year
    return list(range(2021, current_year + 1))

def get_races_for_year(year):
    try:
        schedule = fastf1.get_event_schedule(year)
        races = schedule[schedule['EventFormat'] != 'testing']['EventName'].unique().tolist()
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
    # Load basic data (results + laps)
    session.load(telemetry=False, weather=True, messages=False) 

    # --- 1. Determine Session Winner/Leader ---
    winner_name = "N/A"
    winner_label = "WINNER"
    
    try:
        # Logic A: Practice Session -> Look for Fastest Lap
        if "Practice" in session_type:
            fastest_lap = session.laps.pick_fastest()
            driver_code = fastest_lap['Driver']
            winner_label = "FASTEST LAP"
            
            # Try to get full name from results
            try:
                row = session.results.loc[session.results['Abbreviation'] == driver_code].iloc[0]
                winner_name = f"{row['FirstName']} {row['LastName']}"
            except:
                winner_name = driver_code # Fallback to 'VER' etc.

        # Logic B: Race or Sprint -> Look for Classification P1
        else:
            # Sort by Position (handles penalties/DSQ better than raw lap times)
            results = session.results.sort_values(by='Position')
            if not results.empty:
                p1 = results.iloc[0]
                winner_name = f"{p1['FirstName']} {p1['LastName']}"
            
            if "Sprint" in session_type:
                winner_label = "SPRINT WINNER"
            else:
                winner_label = "RACE WINNER"

    except Exception as e:
        print(f"Winner Error: {e}")
        pass

    # --- 2. Get Weather ---
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

    # --- 3. Process Laps & Stints ---
    lap_data = []
    stint_data = {}

    for d in driver_list:
        try:
            # Use pandas filtering
            driver_laps = session.laps[session.laps['Driver'] == d].copy().reset_index()
            
            driver_stints = []
            current_stint = None
            
            for idx, lap in driver_laps.iterrows():
                # Scatter Plot Data
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

                # Stint Logic
                lap_num = int(lap['LapNumber'])
                raw_compound = lap['Compound']
                compound = str(raw_compound).upper() if raw_compound else 'UNKNOWN'
                if compound in ['NAN', '', 'NONE']: compound = 'UNKNOWN'
                
                is_pit_entry = not pd.isna(lap['PitInTime'])

                if current_stint is None:
                    current_stint = {'compound': compound, 'start': lap_num, 'end': lap_num}
                elif compound != current_stint['compound']:
                    driver_stints.append(current_stint)
                    current_stint = {'compound': compound, 'start': lap_num, 'end': lap_num}
                else:
                    current_stint['end'] = lap_num
                
                if is_pit_entry:
                    driver_stints.append(current_stint)
                    current_stint = None
            
            if current_stint:
                driver_stints.append(current_stint)
            
            stint_data[d] = driver_stints

        except:
            continue
            
    if not lap_data:
         raise Exception("No valid lap data found.")

    # Return structure now includes 'winner_label'
    return {
        "laps": lap_data, 
        "stints": stint_data, 
        "race_winner": winner_name, 
        "winner_label": winner_label, 
        "weather": weather
    }


def get_telemetry_multi(year, race, session_type, driver_list, specific_laps=None):
    session = fastf1.get_session(year, race, session_type)
    session.load()
    
    # Weather
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

    # Load Laps
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

    x_new = np.linspace(0, max_track_length, num=4000)
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
                'time': np.nan_to_num(time_interp, nan=0.0).tolist() 
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
    if k1 not in multi_data['drivers'] or k2 not in multi_data['drivers']:
        return ["Insufficient data."]
    t1 = multi_data['drivers'][k1]['telemetry']
    t2 = multi_data['drivers'][k2]['telemetry']
    dist = np.array(t1['distance'])
    speed1 = np.array(t1['speed'])
    speed2 = np.array(t2['speed'])
    throttle1 = np.array(t1['throttle'])
    throttle2 = np.array(t2['throttle'])
    brake1 = np.array(t1['brake'])
    brake2 = np.array(t2['brake'])
    delta = np.array(t2['time']) - np.array(t1['time'])
    insights = []
    chunk_size = 250 
    for start in range(0, int(dist.max()), chunk_size):
        end = start + chunk_size
        mask = (dist >= start) & (dist < end)
        if not np.any(mask): continue
        delta_change = delta[mask][-1] - delta[mask][0]
        if abs(delta_change) > 0.04: 
            gainer = k1 if delta_change > 0 else k2
            gain_val = abs(delta_change)
            avg_speed = np.mean(speed1[mask])
            avg_brake = np.mean(brake1[mask])
            if avg_brake > 10 and avg_speed < 200:
                min_s1, min_s2 = np.min(speed1[mask]), np.min(speed2[mask])
                if (gainer == k1 and min_s1 > min_s2 + 5): insights.append(f"Turn at {start}m: {gainer} carries +{int(min_s1 - min_s2)}km/h min speed.")
                else: insights.append(f"Braking at {start}m: {gainer} gains {gain_val:.3f}s.")
            elif avg_speed > 250:
                 speed_diff = np.mean(speed1[mask]) - np.mean(speed2[mask])
                 if abs(speed_diff) > 3: insights.append(f"Straight at {start}m: {gainer} faster by {int(abs(speed_diff))}km/h.")
    unique_insights = list(set(insights))

    return unique_insights[:15] if unique_insights else ["No significant differences found."]

