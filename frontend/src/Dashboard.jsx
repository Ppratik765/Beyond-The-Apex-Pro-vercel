import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Scatter } from 'react-chartjs-2';
import zoomPlugin from 'chartjs-plugin-zoom';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  zoomPlugin
);

function Dashboard({ session, handleLogout }) {
  // --- STATE MANAGEMENT ---
  const [years, setYears] = useState([]);
  const [races, setRaces] = useState([]);
  const [sessions, setSessions] = useState([]);
  
  const [inputs, setInputs] = useState({
    year: '',
    race: '',
    session: '',
    drivers: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [telemetryData, setTelemetryData] = useState(null);
  const [raceLapsData, setRaceLapsData] = useState(null);
  const [selectedLaps, setSelectedLaps] = useState([]);
  const [aiInsights, setAiInsights] = useState([]);

  // Use the API URL from environment or hardcoded fallback
  const API_BASE = import.meta.env.VITE_API_URL || 'https://f1-backend.zeabur.app';

  // --- REFS FOR CHARTS ---
  const chartRefs = {
    speed: useRef(null),
    throttle: useRef(null),
    brake: useRef(null),
    rpm: useRef(null),
    gear: useRef(null),
    drs: useRef(null)
  };

  // --- INITIAL DATA FETCHING ---
  useEffect(() => {
    axios.get(`${API_BASE}/years`).then(res => {
      setYears(res.data.years);
      if(res.data.years.length > 0) {
        setInputs(prev => ({...prev, year: res.data.years[res.data.years.length-1]}));
      }
    }).catch(err => console.error("API Error:", err));
  }, []);

  useEffect(() => {
    if(inputs.year) {
      axios.get(`${API_BASE}/races?year=${inputs.year}`).then(res => {
        setRaces(res.data.races);
        setInputs(prev => ({...prev, race: res.data.races[0] || '', session: ''}));
      }).catch(err => console.error("API Error:", err));
    }
  }, [inputs.year]);

  useEffect(() => {
    if(inputs.year && inputs.race) {
      axios.get(`${API_BASE}/sessions?year=${inputs.year}&race=${inputs.race}`).then(res => {
        setSessions(res.data.sessions);
        const def = res.data.sessions.find(s => s.includes('Qualifying')) || res.data.sessions[0] || '';
        setInputs(prev => ({...prev, session: def}));
      }).catch(err => console.error("API Error:", err));
    }
  }, [inputs.year, inputs.race]);

  // --- HANDLERS ---
  const isRaceOrPractice = inputs.session.includes('Race') || inputs.session.includes('Practice');

  const handleMainAction = () => {
    setTelemetryData(null);
    setRaceLapsData(null);
    setError(null);
    setAiInsights([]);
    setSelectedLaps([]);

    if (isRaceOrPractice) {
      fetchRaceOverview();
    } else {
      fetchDetailedTelemetry();
    }
  };

  const fetchRaceOverview = () => {
    setLoading(true);
    axios.get(`${API_BASE}/race_laps`, {
      params: { year: inputs.year, race: inputs.race, session: inputs.session, drivers: inputs.drivers }
    })
    .then(res => {
      if(res.data.status === 'error') throw new Error(res.data.message);
      setRaceLapsData(res.data.data);
    })
    .catch(err => setError(err.message))
    .finally(() => setLoading(false));
  };

  const fetchDetailedTelemetry = (lapsToFetch = null) => {
    setLoading(true);
    const params = {
      year: inputs.year, 
      race: inputs.race, 
      session: inputs.session, 
      drivers: inputs.drivers
    };
    if (lapsToFetch) {
      params.specific_laps = JSON.stringify(lapsToFetch);
    }

    axios.get(`${API_BASE}/analyze`, { params })
    .then(res => {
      if(res.data.status === 'error') throw new Error(res.data.message);
      setTelemetryData(res.data.data);
      setAiInsights(res.data.ai_insights || []);
    })
    .catch(err => setError(err.message))
    .finally(() => setLoading(false));
  };

  const handleLapSelect = (element) => {
    if (!raceLapsData || element.length === 0) return;
    const index = element[0].index;
    const lapInfo = raceLapsData.laps[index]; 
    
    // Add to selection if not already selected (limit 2 for comparison)
    if (selectedLaps.length < 2 && !selectedLaps.find(l => l.driver === lapInfo.driver && l.lap === lapInfo.lapNumber)) {
        const newSelection = [...selectedLaps, { driver: lapInfo.driver, lap: lapInfo.lapNumber }];
        setSelectedLaps(newSelection);
        
        // If we have 2, auto fetch
        if (newSelection.length === 1) {
            alert(`Selected Lap ${lapInfo.lapNumber} for ${lapInfo.driver}. Select one more to compare, or click Analyze now.`);
        } else if (newSelection.length === 2) {
            fetchDetailedTelemetry(newSelection);
        }
    }
  };

  const resetAllCharts = () => {
    Object.values(chartRefs).forEach(ref => {
      if(ref.current) ref.current.resetZoom();
    });
  };

  // --- CHART OPTIONS (Dark Theme) ---
  const commonOptions = {
    responsive: true,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { labels: { color: '#e0e0e0' } },
      zoom: {
        zoom: { wheel: { enabled: true }, drag: { enabled: true }, mode: 'x' },
        pan: { enabled: true, mode: 'x', modifierKey: 'shift' }
      }
    },
    scales: {
      x: { ticks: { color: '#888' }, grid: { color: '#333' } },
      y: { ticks: { color: '#888' }, grid: { color: '#333' } }
    }
  };

  // --- RENDER HELPERS ---
  const renderTelemetryChart = (key, title, unit) => {
    if (!telemetryData) return null;
    
    const datasets = Object.keys(telemetryData.drivers).map((driver, i) => {
      const color = i === 0 ? '#36a2eb' : '#ff6384'; // Blue vs Red
      return {
        label: `${driver} ${unit}`,
        data: telemetryData.drivers[driver][key],
        borderColor: telemetryData.drivers[driver].color ? `#${telemetryData.drivers[driver].color}` : color,
        backgroundColor: (telemetryData.drivers[driver].color ? `#${telemetryData.drivers[driver].color}` : color) + '33',
        borderWidth: 2,
        pointRadius: 0,
        fill: true
      };
    });

    const data = { labels: telemetryData.distances, datasets };

    return (
      <div className="chart-card">
        <h3>{title}</h3>
        <Line ref={chartRefs[key]} options={commonOptions} data={data} />
      </div>
    );
  };

  // --- MAIN RENDER ---
  return (
    <div className="dashboard-container">
      <div className="bg-glow"></div> {/* Reusing the landing page glow */}
      
      {/* HEADER BAR */}
      <header className="dashboard-header">
        <div className="dashboard-title">
            <h1>🏎️ Beyond The Apex <span className="pro-badge">PRO</span></h1>
        </div>
        <div className="user-controls">
            <span style={{ color: '#aaa', marginRight: '15px' }}>
                Crew Chief: <b style={{ color: '#fff' }}>{session?.user?.user_metadata?.full_name || session?.user?.email}</b>
            </span>
            <button onClick={handleLogout} className="btn-nav">Box Box (Logout)</button>
        </div>
      </header>
      
      {/* RACE CONTROL PANEL */}
      <section className="control-panel">
        <select value={inputs.year} onChange={e => setInputs(p=>({...p, year: e.target.value}))} className="control-select">
            {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        
        <select value={inputs.race} onChange={e => setInputs(p=>({...p, race: e.target.value}))} className="control-select" disabled={!inputs.year}>
            {races.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        
        <select value={inputs.session} onChange={e => setInputs(p=>({...p, session: e.target.value}))} className="control-select" disabled={!inputs.race}>
            {sessions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        
        <input 
            placeholder="Drivers (e.g. VER, HAM)" 
            value={inputs.drivers} 
            onChange={e => setInputs({...inputs, drivers: e.target.value})} 
            className="control-input"
        />
        
        <button 
            onClick={handleMainAction} 
            disabled={loading || !inputs.session} 
            className="btn-race-control"
        >
            {loading ? 'Receiving Telemetry...' : (isRaceOrPractice ? 'Load Race Strategy' : 'Analyze Telemetry')}
        </button>
      </section>

      {/* ERROR MESSAGE */}
      {error && (
        <div className="msg-alert error">
            ⚠️ <b>System Failure:</b> {error}
        </div>
      )}

      {/* STATUS BAR / INSTRUCTIONS */}
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {telemetryData && (
            <div className="status-bar">
                <span>🟢 Telemetry Online.</span> 
                <span> 🖱️ Drag to Zoom | ⇧ Shift+Drag to Pan</span>
                <span className="reset-link" onClick={resetAllCharts}>⟲ Reset Views</span>
                <span className="reset-link" onClick={() => {setTelemetryData(null); setSelectedLaps([]);}}>✕ Clear Data</span>
            </div>
        )}
        {isRaceOrPractice && !telemetryData && raceLapsData && (
            <div className="status-bar">
                 🖱️ Click dots on the Scatter Plot to compare specific laps.
            </div>
        )}
      </div>

      {/* --- VIEW 1: RACE SCATTER PLOT --- */}
      {raceLapsData && !telemetryData && (
        <div className="chart-card full-width">
            <h3>Lap Time Distribution</h3>
            <Scatter 
                options={{
                    ...commonOptions,
                    onClick: (evt, element) => handleLapSelect(element),
                    plugins: {
                        tooltip: {
                            callbacks: {
                                label: (ctx) => `${ctx.raw.driver} Lap ${ctx.raw.lapNumber}: ${ctx.raw.lapTimeStr} (${ctx.raw.compound})`
                            }
                        }
                    }
                }}
                data={{
                    datasets: raceLapsData.laps.map(l => ({
                        label: l.driver,
                        data: [{x: l.lapNumber, y: l.seconds, ...l}],
                        backgroundColor: l.color ? `#${l.color}` : '#fff',
                        pointRadius: 6,
                        pointHoverRadius: 10
                    }))
                }}
            />
        </div>
      )}

      {/* --- VIEW 2: TELEMETRY GRIDS --- */}
      {telemetryData && (
        <>
            {/* AI INSIGHTS */}
            {aiInsights.length > 0 && (
                <div className="chart-card full-width" style={{ borderLeft: '4px solid var(--neon-blue)', marginBottom: '20px' }}>
                    <h3>🤖 Race Engineer AI Insights</h3>
                    <ul style={{ paddingLeft: '20px', color: '#e0e0e0' }}>
                        {aiInsights.map((insight, i) => <li key={i} style={{ marginBottom: '8px' }}>{insight}</li>)}
                    </ul>
                </div>
            )}

            <div className="charts-grid">
                {renderTelemetryChart('Speed', 'Speed Trace', '(km/h)')}
                {renderTelemetryChart('Throttle', 'Throttle Application', '(%)')}
                {renderTelemetryChart('Brake', 'Brake Pressure', '(%)')}
                {renderTelemetryChart('RPM', 'Engine RPM', '')}
                {renderTelemetryChart('nGear', 'Gear Usage', '')}
                {renderTelemetryChart('DRS', 'DRS Activation', '')}
            </div>
        </>
      )}

      {/* EMPTY STATE */}
      {!telemetryData && !raceLapsData && !loading && (
        <div style={{ textAlign: 'center', padding: '50px', opacity: 0.5 }}>
            <h2>Waiting for Session Data...</h2>
            <p>Select a Year, Race, and Drivers to begin analysis.</p>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
