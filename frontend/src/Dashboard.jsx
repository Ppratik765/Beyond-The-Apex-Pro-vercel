import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Line, Scatter } from 'react-chartjs-2';
import 'chart.js/auto';
import zoomPlugin from 'chartjs-plugin-zoom';
import { Chart } from 'chart.js';

Chart.register(zoomPlugin);

// --- VISUAL CONSTANTS ---
// We use the CSS variables defined in index.css for consistency
const COLORS = {
    primary: 'var(--f1-red)',      // Red
    neon: 'var(--neon-blue)',      // Cyan
    bg: 'var(--dark-bg)',          // Dark Blue/Black
    card: 'var(--card-bg)',        // Card Background
    text: 'var(--text-primary)',   // White
    textDim: 'var(--text-secondary)', // Gray
    border: 'rgba(255, 255, 255, 0.1)',
    grid: 'rgba(255, 255, 255, 0.05)'
};

const DRIVER_COLORS = ['#36a2eb', '#ff6384', '#00ff9d', '#ff9f40', '#9966ff', '#ffcd56'];
const TYRE_COLORS = {
    'SOFT': '#ff3b30', 'MEDIUM': '#ffcc00', 'HARD': '#ffffff',
    'INTERMEDIATE': '#43a047', 'WET': '#0057e7', 'UNKNOWN': '#888'
};
const TYRE_EMOJIS = {
    'SOFT': '🔴', 'MEDIUM': '🟡', 'HARD': '⚪',
    'INTERMEDIATE': '🟢', 'WET': '🔵', 'UNKNOWN': '❓'
};

// --- CHART DEFAULTS ---
Chart.defaults.color = '#a0a0b0';
Chart.defaults.font.family = '"Titillium Web", sans-serif';

function Dashboard({ session, handleLogout }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Selectors
  const [years, setYears] = useState([]);
  const [races, setRaces] = useState([]);
  const [sessions, setSessions] = useState([]);

  // Inputs
  const [inputs, setInputs] = useState({ 
      year: new Date().getFullYear(), 
      race: '', 
      session: '', 
      drivers: 'VER, LEC'
  });
  const [activeDrivers, setActiveDrivers] = useState([]);

  // Data
  const [telemetryData, setTelemetryData] = useState(null); 
  const [raceLapData, setRaceLapData] = useState(null); 
  const [stintData, setStintData] = useState(null);  
  const [raceWinner, setRaceWinner] = useState(null);
  const [raceWeather, setRaceWeather] = useState(null);
  
  const [selectedLaps, setSelectedLaps] = useState([]); 

  // Refs
  const deltaChartRef = useRef(null);
  const speedChartRef = useRef(null);
  const throttleChartRef = useRef(null);
  const brakeChartRef = useRef(null);
  const rpmChartRef = useRef(null);
  const longGChartRef = useRef(null);
  const distributionChartRef = useRef(null);

  // --- INIT & CLEARING ---
  useEffect(() => {
      setTelemetryData(null); setRaceLapData(null); setStintData(null); setRaceWinner(null); setRaceWeather(null); setSelectedLaps([]);
  }, [inputs.race, inputs.session]);

  // Use the API_BASE logic from your App.jsx or hardcode the URL if you prefer
  // Assuming axios base URL is set or using absolute paths. 
  // IMPORTANT: Ensure this matches your LandingPage/App logic. 
  // If you are using Zeabur/Render, replace 'http://localhost:8000' with your variable or URL.
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'; // Default to localhost if not set

  useEffect(() => {
      axios.get(`${API_BASE}/years`).then(res => {
          setYears(res.data.years);
          if(res.data.years.length > 0) setInputs(prev => ({...prev, year: res.data.years[res.data.years.length-1]}));
      });
  }, []);

  useEffect(() => {
      if(inputs.year) {
          axios.get(`${API_BASE}/races?year=${inputs.year}`).then(res => {
              setRaces(res.data.races);
              setInputs(prev => ({...prev, race: res.data.races[0] || '', session: ''}));
          });
      }
  }, [inputs.year]);

  useEffect(() => {
      if(inputs.year && inputs.race) {
          axios.get(`${API_BASE}/sessions?year=${inputs.year}&race=${inputs.race}`).then(res => {
              setSessions(res.data.sessions);
              const def = res.data.sessions.find(s => s.includes('Qualifying')) || res.data.sessions[0] || '';
              setInputs(prev => ({...prev, session: def}));
          });
      }
  }, [inputs.year, inputs.race]);

  const isQualiSession = inputs.session && (inputs.session.includes('Qualifying') || inputs.session.includes('Sprint Qualifying'));
  const isRaceOrPractice = inputs.session && !isQualiSession; 

  // --- ACTIONS ---
  const fetchRaceOverview = async () => {
      if (!inputs.race || !inputs.session) return;
      setLoading(true); setError(null); setRaceLapData(null); setStintData(null); setRaceWinner(null); setRaceWeather(null); setTelemetryData(null); setSelectedLaps([]);
    try {
            const res = await axios.get(`${API_BASE}/race_laps`, { params: { ...inputs } });
            if (res.data.status === 'error') throw new Error(res.data.message);
            
            setRaceLapData(res.data.data.laps);
            setStintData(res.data.data.stints);
            setRaceWinner({ 
                name: res.data.data.race_winner, 
                label: res.data.data.winner_label 
            });
            setRaceWeather(res.data.data.weather); // Ensure backend sends this if available
      } catch (err) { setError(err.message || "Failed to connect."); }
      setLoading(false);
  };

  const fetchDetailedTelemetry = async (lapsToFetch = null) => {
    if (!inputs.race || !inputs.session) return;
    setLoading(true); setError(null);
    try {
      const params = { ...inputs };
      if(lapsToFetch && lapsToFetch.length > 0) {
          params.specific_laps = JSON.stringify(lapsToFetch);
      } else if (isRaceOrPractice) {
           setLoading(false); return;
      }

      const res = await axios.get(`${API_BASE}/analyze`, { params: params });
      if (res.data.status === 'error') throw new Error(res.data.message);
      
      res.data.data.ai_insights = res.data.ai_insights;
      setTelemetryData(res.data.data);
      if(!raceLapData) setActiveDrivers(inputs.drivers.split(',').map(d => d.trim().toUpperCase()));

    } catch (err) { setError(err.message || "Failed to fetch telemetry."); }
    setLoading(false);
  };

  const handleMainAction = () => {
    if(isRaceOrPractice) fetchRaceOverview();
    else fetchDetailedTelemetry();
  };

  const handleDistributionClick = (event, elements) => {
      if(elements.length === 0 || !raceLapData) return;
      const dataIndex = elements[0].index;
      const rawPointData = distributionChartRef.current.data.datasets[0].data[dataIndex];
      
      if(rawPointData && rawPointData.rawLapData) {
          const { driver, lap_number } = rawPointData.rawLapData;
          let newSelection = [...selectedLaps];
          const exists = newSelection.find(s => s.driver === driver && s.lap === lap_number);
          
          if(exists) {
              newSelection = newSelection.filter(s => !(s.driver === driver && s.lap === lap_number));
          } else {
              newSelection.push({driver, lap: lap_number});
          }
          
          setSelectedLaps(newSelection);
          if(newSelection.length > 0) fetchDetailedTelemetry(newSelection);
          else setTelemetryData(null);
      }
  };

  const resetAllCharts = () => {
    [deltaChartRef, speedChartRef, throttleChartRef, brakeChartRef, rpmChartRef, longGChartRef].forEach(ref => { if (ref.current) ref.current.resetZoom(); });
  };
  const formatTime = (s) => { if (!s) return "-"; const m = Math.floor(s/60); const sc = Math.floor(s%60); const ms = Math.round((s%1)*1000); return `${m}:${sc.toString().padStart(2,'0')}.${ms.toString().padStart(3,'0')}`; };
  const getSectorColor = (val, best) => (val <= best + 0.001 ? COLORS.neon : '#666');
  
  const getTyreColor = (c) => TYRE_COLORS[c] || TYRE_COLORS['UNKNOWN'];

  const getDatasets = (metric, tension = 0) => {
    if (!telemetryData) return [];
    const keys = Object.keys(telemetryData.drivers);
    return keys.map((key, idx) => ({
        label: key,
        data: telemetryData.drivers[key]?.telemetry[metric] || [],
        borderColor: DRIVER_COLORS[idx % DRIVER_COLORS.length],
        borderWidth: 2, pointRadius: 0, tension: tension,
        hoverBorderWidth: 3
    }));
  };

  const getRaceDistributionData = () => {
      if(!raceLapData) return { datasets: [] };
      const plotData = [];
      const pointColors = [];
      const borderColors = [];
      const borderCmds = [];
      const radiuses = [];
      
      activeDrivers.forEach((driver, dIdx) => {
          const driverLaps = raceLapData.filter(d => d.driver === driver);
          driverLaps.forEach(lap => {
              const isSelected = selectedLaps.some(s => s.driver === driver && s.lap === lap.lap_number);
              const jitter = (Math.random() - 0.5) * 0.4;
              const compoundColor = getTyreColor(lap.compound);
              
              plotData.push({ x: dIdx + jitter, y: lap.lap_time_seconds, rawLapData: lap });
              pointColors.push(isSelected ? COLORS.neon : compoundColor);
              borderColors.push(isSelected ? COLORS.neon : 'rgba(0,0,0,0.5)');
              borderCmds.push(isSelected ? 2 : 1);
              radiuses.push(isSelected ? 6 : 3.5);
          });
      });
      return { datasets: [{ label: 'Laps', data: plotData, pointStyle: 'circle', pointBackgroundColor: pointColors, pointBorderColor: borderColors, pointBorderWidth: borderCmds, pointRadius: radiuses }] };
  };

  const commonOptions = {
    animation: false, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
    plugins: { legend: { display: false }, zoom: { zoom: { drag: { enabled: true, backgroundColor: 'rgba(0, 243, 255, 0.2)', borderColor: COLORS.neon, borderWidth: 1 }, mode: 'x' }, pan: { enabled: true, mode: 'x', modifierKey: 'shift' } } },
    scales: { x: { type: 'linear', ticks: { color: '#888', font: {family: '"Titillium Web"'}}, grid: { color: COLORS.grid } }, y: { ticks: { color: '#888', font: {family: '"Titillium Web"'} }, grid: { color: COLORS.grid } } }
  };

  const distributionOptions = {
      animation: false, maintainAspectRatio: false, onClick: handleDistributionClick,
      plugins: {
          legend: { display: false }, zoom: false,
          tooltip: { 
              backgroundColor: 'rgba(20, 20, 30, 0.9)',
              titleColor: COLORS.neon,
              bodyFont: { family: '"Titillium Web"' },
              callbacks: { label: (ctx) => `${ctx.raw.rawLapData.driver} L${ctx.raw.rawLapData.lap_number}: ${formatTime(ctx.raw.rawLapData.lap_time_seconds)} (${ctx.raw.rawLapData.compound})` } 
          }
      },
      scales: {
          x: { 
              type: 'linear', offset: false, 
              ticks: { 
                  color: 'white', font: { size: 14, weight: 'bold', family: '"Titillium Web"' }, 
                  stepSize: 1,
                  callback: (val) => activeDrivers[Math.round(val)] || '', 
                  align: 'right', labelOffset: 55
              }, 
              grid: { display: false }, 
              min: -0.5, max: activeDrivers.length - 0.5 
          },
          y: { ticks: { color: '#888', callback: (val) => formatTime(val), stepSize: 0.1, maxTicksLimit: 20 }, grid: { color: COLORS.grid }, title: { display: true, text: 'Lap Time', color: '#666' } }
      }
  };

  const renderSectorPlugin = () => ({
    id: 'sectorLines',
    beforeDraw: (chart) => {
        if (!telemetryData || !telemetryData.track_length) return;
        
        const totalTrackLength = telemetryData.track_length;
        const s1 = totalTrackLength * 0.33; 
        const s2 = totalTrackLength * 0.66;
        
        const ctx = chart.ctx; const xAxis = chart.scales.x; const yAxis = chart.scales.y;
        
        const drawLine = (val, label) => {
            const x = xAxis.getPixelForValue(val);
            if (x < xAxis.left || x > xAxis.right) return;
            ctx.save(); ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'; ctx.lineWidth = 1; ctx.setLineDash([5, 5]);
            ctx.beginPath(); ctx.moveTo(x, yAxis.top); ctx.lineTo(x, yAxis.bottom); ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.font = '10px "Titillium Web"'; ctx.fillText(label, x + 5, yAxis.top + 10); ctx.restore();
        };
        drawLine(s1, "S1"); drawLine(s2, "S2");
    }
  });

  // Reusable Weather Widget
  const WeatherWidget = ({ weatherData }) => (
      <div style={styles.card}>
          <h3 style={styles.cardTitle}>⛅ Weather</h3>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px', fontSize:'0.9em', color: COLORS.textDim}}>
              <div><span style={{color:'#666', fontSize:'0.7em', letterSpacing:'1px'}}>TRACK</span><br/><b style={{color:'white', fontSize:'1.2em'}}>{weatherData.track_temp}°C</b></div>
              <div><span style={{color:'#666', fontSize:'0.7em', letterSpacing:'1px'}}>AIR</span><br/><b style={{color:'white', fontSize:'1.2em'}}>{weatherData.air_temp}°C</b></div>
              <div><span style={{color:'#666', fontSize:'0.7em', letterSpacing:'1px'}}>HUMIDITY</span><br/><b style={{color:'white', fontSize:'1.2em'}}>{weatherData.humidity}%</b></div>
              <div><span style={{color:'#666', fontSize:'0.7em', letterSpacing:'1px'}}>RAIN</span><br/><b style={{color: weatherData.rain ? COLORS.neon : '#666'}}>{weatherData.rain ? 'YES' : 'NO'}</b></div>
          </div>
      </div>
  );

  return (
    <div style={{ padding: '20px', background: COLORS.bg, color: COLORS.text, minHeight: '100vh', fontFamily: '"Titillium Web", sans-serif' }}>
      
      {/* USER HEADER */}
      <div className="dashboard-header" style={styles.topBar}>
        <span style={{ color: COLORS.textDim, fontSize: '0.9em' }}>
          Logged in as: <b style={{ color: COLORS.neon }}>{session?.user?.user_metadata?.full_name || session?.user?.email}</b>
        </span>
        <button onClick={handleLogout} style={styles.logoutBtn}>Log Out</button>
      </div>

      {/* APP HEADER */}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'25px'}}>
        <h1 style={{margin:0, fontSize: '2em', fontStyle:'italic', fontWeight:'800', letterSpacing:'-1px'}}>
            🏎️ Beyond The Apex <span style={{color: COLORS.primary, fontSize:'0.5em', verticalAlign:'text-top'}}>PRO</span>
        </h1>
        <div style={styles.controlsBar}>
            {telemetryData && !isRaceOrPractice && <span>🖱️ <b>Drag</b> to Zoom | ⇧ <b>Shift+Drag</b> Pan | <span style={{cursor:'pointer', color: COLORS.primary, fontWeight:'bold'}} onClick={resetAllCharts}>⟲ Reset All</span></span>}
            {isRaceOrPractice && !telemetryData && <span>🖱️ <b>Click dots</b> to select specific laps.</span>}
             {isRaceOrPractice && telemetryData && <span>Analyzing Selection. <span style={{cursor:'pointer', color: COLORS.primary, fontWeight:'bold'}} onClick={() => {setTelemetryData(null); setSelectedLaps([]);}}>✕ Clear</span></span>}
        </div>
      </div>
      
      {/* CONTROLS */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '30px', flexWrap: 'wrap', alignItems:'center' }}>
        <select value={inputs.year} onChange={e => setInputs(p=>({...p, year: e.target.value}))} style={styles.select}>{years.map(y => <option key={y} value={y}>{y}</option>)}</select>
        <select value={inputs.race} onChange={e => setInputs(p=>({...p, race: e.target.value}))} style={styles.select} disabled={!inputs.year}>{races.map(r => <option key={r} value={r}>{r}</option>)}</select>
        <select value={inputs.session} onChange={e => setInputs(p=>({...p, session: e.target.value}))} style={styles.select} disabled={!inputs.race}>{sessions.map(s => <option key={s} value={s}>{s}</option>)}</select>
        <input placeholder="DRIVERS (e.g. VER, HAM)" value={inputs.drivers} onChange={e => setInputs({...inputs, drivers: e.target.value})} style={styles.input}/>
        <button onClick={handleMainAction} disabled={loading || !inputs.session} style={loading ? styles.btnDisabled : styles.btnPrimary}>{loading ? 'STARTING ENGINE...' : (isRaceOrPractice ? 'LOAD RACE LAPS' : 'ANALYZE FASTEST LAPS')}</button>
      </div>

      {error && <div style={styles.errorBanner}>⚠️ {error}</div>}

      {/* RACE DISTRIBUTION VIEW */}
      {isRaceOrPractice && raceLapData && !loading && (
          <div style={{ display: 'grid', gridTemplateColumns: '7fr 2fr', gap: '20px', marginBottom:'40px', width: '100%' , minWidth:'100%'}}>
               <div style={styles.card}>
                   <h4 style={styles.cardTitle}>LAP TIME DISTRIBUTION</h4>
                   <div style={{ height: '400px' }}>
                       <Scatter ref={distributionChartRef} options={distributionOptions} data={getRaceDistributionData()} />
                   </div>
                   <div style={{marginTop:'15px', display:'flex', gap:'15px', justifyContent:'center', fontSize:'0.8em', color: COLORS.textDim}}>
                        {Object.entries(TYRE_COLORS).map(([compound, color]) => (compound !== 'UNKNOWN' && <div key={compound} style={{display:'flex', alignItems:'center'}}><div style={{width:'8px', height:'8px', borderRadius:'50%', backgroundColor:color, marginRight:'6px', boxShadow:`0 0 5px ${color}`}}></div>{compound}</div>))}
                   </div>
               </div>
               
               {/* STRATEGY & WEATHER (RIGHT SIDEBAR) */}
               <div style={{display:'flex', flexDirection:'column', gap:'20px'}}>
                    {/* Race Winner Widget */}
                    <div style={{...styles.card, border: `1px solid ${COLORS.neon}`, textAlign:'center', background: 'linear-gradient(180deg, rgba(0, 243, 255, 0.1), transparent)'}}>
                        <h4 style={{margin:'0 0 5px 0', color: COLORS.neon, fontSize:'0.7em', letterSpacing:'2px'}}>
                            {raceWinner?.label || "WINNER"}
                        </h4>
                        <div style={{fontSize:'1.5em', fontWeight:'800', color:'white', textShadow: `0 0 10px ${COLORS.neon}`}}>
                            {raceWinner?.name || "N/A"}
                        </div>
                    </div>
                   
                   <div style={styles.card}>
                       <h4 style={styles.cardTitle}>TYRE STRATEGY</h4>
                       {stintData && activeDrivers.map(d => (
                           <div key={d} style={{marginBottom:'25px'}}>
                               <div style={{fontWeight:'bold', marginBottom:'8px', color:'white', fontSize:'1.1em', display:'flex', alignItems:'center'}}><span style={{width:'3px', height:'15px', background: COLORS.primary, marginRight:'8px'}}></span>{d}</div>
                               <div style={{display:'flex', width:'100%', height:'20px', background:'#111', borderRadius:'4px', overflow:'hidden', marginBottom:'8px'}}>
                                   {stintData[d] && stintData[d].map((stint, i) => (
                                       <div key={i} style={{
                                           flex: stint.end - stint.start + 1,
                                           backgroundColor: getTyreColor(stint.compound),
                                           borderRight: '1px solid #1a1a1a'
                                       }} title={`${stint.compound} (${stint.end - stint.start + 1} laps)`}></div>
                                   ))}
                               </div>
                               <div style={{display:'flex', flexWrap:'wrap', gap:'8px', fontSize:'0.75em', color:'#888'}}>
                                   {stintData[d] && stintData[d].map((stint, i) => (
                                       <span key={i}>
                                           {i>0 && '→ '}
                                           {stint.end-stint.start+1}L {TYRE_EMOJIS[stint.compound] || '❓'}
                                       </span>
                                   ))}
                               </div>
                           </div>
                       ))}
                   </div>

                   {/* RESTORED WEATHER WIDGET FOR RACE VIEW */}
                   {raceWeather && <WeatherWidget weatherData={raceWeather} />}
               </div>
          </div>
      )}

      {/* DETAILED TELEMETRY */}
      {telemetryData && !loading && Object.keys(telemetryData.drivers).length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '20px' }}>
              
              {/* CHARTS */}
              <div style={{display:'flex', flexDirection:'column', gap:'20px'}}>
                {isQualiSession && telemetryData.pole_info && (
                    <div style={{background: 'rgba(0, 243, 255, 0.05)', padding:'15px', borderRadius:'8px', border:`1px solid ${COLORS.neon}`, color: COLORS.neon, display:'flex', justifyContent:'center', alignItems:'center', textShadow: `0 0 10px rgba(0,243,255,0.3)`}}>
                        🏆 <b>POLE POSITION:</b> &nbsp; {telemetryData.pole_info.driver} &nbsp; ({formatTime(telemetryData.pole_info.time)})
                    </div>
                )}

                <div style={styles.chartContainer}><div style={styles.headerStyle}><h5 style={styles.chartTitle}>DELTA TO {isRaceOrPractice ? 'FASTEST' : 'POLE'} (SEC)</h5><button onClick={() => deltaChartRef.current?.resetZoom()} style={styles.miniBtn}>⟲ Reset</button></div><div style={{height: '200px'}}><Line ref={deltaChartRef} data={{ labels: telemetryData.drivers[Object.keys(telemetryData.drivers)[0]].telemetry.distance.map(d => Math.round(d)), datasets: getDatasets('delta_to_pole') }} options={{...commonOptions, scales:{...commonOptions.scales, y:{reverse:true, grid:{color: COLORS.grid}}}}} plugins={[renderSectorPlugin()]} /></div></div>
                <div style={styles.chartContainer}><div style={styles.headerStyle}><h5 style={styles.chartTitle}>SPEED (KM/H)</h5><button onClick={() => speedChartRef.current?.resetZoom()} style={styles.miniBtn}>⟲ Reset</button></div><div style={{height: '250px'}}><Line ref={speedChartRef} data={{ labels: telemetryData.drivers[Object.keys(telemetryData.drivers)[0]].telemetry.distance.map(d => Math.round(d)), datasets: getDatasets('speed') }} options={commonOptions} plugins={[renderSectorPlugin()]} /></div></div>
                <div style={styles.chartContainer}><div style={styles.headerStyle}><h5 style={styles.chartTitle}>THROTTLE (%)</h5><button onClick={() => throttleChartRef.current?.resetZoom()} style={styles.miniBtn}>⟲ Reset</button></div><div style={{height: '200px'}}><Line ref={throttleChartRef} data={{ labels: telemetryData.drivers[Object.keys(telemetryData.drivers)[0]].telemetry.distance.map(d => Math.round(d)), datasets: getDatasets('throttle', 0) }} options={{...commonOptions, scales: {y: {min:0, max:105, grid:{color: COLORS.grid}}}}} plugins={[renderSectorPlugin()]} /></div></div>
                <div style={styles.chartContainer}><div style={styles.headerStyle}><h5 style={styles.chartTitle}>BRAKE PRESSURE (%)</h5><button onClick={() => brakeChartRef.current?.resetZoom()} style={styles.miniBtn}>⟲ Reset</button></div><div style={{height: '200px'}}><Line ref={brakeChartRef} data={{ labels: telemetryData.drivers[Object.keys(telemetryData.drivers)[0]].telemetry.distance.map(d => Math.round(d)), datasets: getDatasets('brake', 0) }} options={{...commonOptions, scales: {y: {min:0, max:105, grid:{color: COLORS.grid}}}}} plugins={[renderSectorPlugin()]} /></div></div>
                
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px'}}>
                    <div style={styles.chartContainer}><div style={styles.headerStyle}><h5 style={styles.chartTitle}>RPM</h5><button onClick={() => rpmChartRef.current?.resetZoom()} style={styles.miniBtn}>⟲ Reset</button></div><div style={{height: '150px'}}><Line ref={rpmChartRef} data={{ labels: telemetryData.drivers[Object.keys(telemetryData.drivers)[0]].telemetry.distance.map(d => Math.round(d)), datasets: getDatasets('rpm') }} options={commonOptions} plugins={[renderSectorPlugin()]} /></div></div>
                    <div style={styles.chartContainer}><div style={styles.headerStyle}><h5 style={styles.chartTitle}>LONGITUDINAL G</h5><button onClick={() => longGChartRef.current?.resetZoom()} style={styles.miniBtn}>⟲ Reset</button></div><div style={{height: '150px'}}><Line ref={longGChartRef} data={{ labels: telemetryData.drivers[Object.keys(telemetryData.drivers)[0]].telemetry.distance.map(d => Math.round(d)), datasets: getDatasets('long_g') }} options={commonOptions} plugins={[renderSectorPlugin()]} /></div></div>
                </div>
              </div>

              {/* STATS COLUMN */}
              <div style={{display:'flex', flexDirection:'column', gap:'20px'}}>
                <div style={styles.card}>
                    <h3 style={styles.cardTitle}>⏱️ Lap Data</h3>
                    {Object.keys(telemetryData.drivers).map((key, i) => {
                        const dData = telemetryData.drivers[key]; if (!dData) return null;
                        const delta = dData.lap_time - Math.min(...Object.values(telemetryData.drivers).map(d => d.lap_time));
                        const tyreColor = getTyreColor(dData.tyre_info.compound);
                        return (
                            <div key={key} style={{marginBottom:'15px', borderBottom: `1px solid ${COLORS.grid}`, paddingBottom:'10px'}}>
                                <div style={{display:'flex', justifyContent:'space-between', marginBottom:'5px'}}>
                                    <div><span style={{fontWeight:'bold', color: DRIVER_COLORS[i % DRIVER_COLORS.length], fontSize:'1.2em'}}>{key}</span></div>
                                    <div style={{textAlign:'right'}}>
                                        <div style={{fontFamily:'monospace', color:'white', fontSize:'1.1em'}}>{formatTime(dData.lap_time)} <span style={{color: delta===0? COLORS.neon : '#ffee00', fontSize:'0.7em', fontWeight:'bold'}}>{delta===0?'PURPLE':`+${delta.toFixed(3)}`}</span></div>
                                        <div style={{fontSize:'0.8em', marginTop:'2px', display:'flex', alignItems:'center', justifyContent:'flex-end', gap:'5px'}}>
                                            <span style={{color: tyreColor, fontWeight:'bold', border: `1px solid ${tyreColor}`, padding:'0px 4px', borderRadius:'3px'}}>{dData.tyre_info.symbol}</span> 
                                            <span style={{color:'#888'}}>{dData.tyre_info.age} laps</span>
                                        </div>
                                    </div>
                                </div>
                                <div style={{display:'flex', justifyContent:'space-between', fontSize:'0.75em', fontFamily:'monospace', color:'#888', width:'100%'}}>
                                    {dData.sectors.map((s, idx) => ( <span key={idx} style={{color: getSectorColor(s, telemetryData.session_best_sectors[idx])}}>S{idx+1}:{s.toFixed(3)}</span> ))}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* RESTORED WEATHER WIDGET FOR DETAILED VIEW */}
                {telemetryData.weather && <WeatherWidget weatherData={telemetryData.weather} />}

                <div style={{ ...styles.card, borderTop:`3px solid ${COLORS.primary}` }}>
                   <h3 style={styles.cardTitle}>🤖 AI Analysis</h3>
                   <div style={{fontSize: '0.85em', color: COLORS.textDim, lineHeight:'1.6'}}>
                     {telemetryData.ai_insights?.map((insight, idx) => ( <div key={idx} style={{ marginBottom: '10px', paddingBottom:'10px', borderBottom: `1px solid ${COLORS.grid}` }}>{insight}</div> ))}
                   </div>
                </div>
              </div>
          </div>
      )}
    </div>
  );
}

// --- UPDATED MODERN STYLES ---
const styles = {
    topBar: {
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        background: 'rgba(30, 30, 47, 0.7)', 
        backdropFilter: 'blur(10px)',
        padding: '12px 25px', 
        borderRadius: '12px', 
        marginBottom: '30px',
        border: `1px solid ${COLORS.border}`
    },
    logoutBtn: {
        background: 'transparent',
        color: COLORS.textDim,
        border: `1px solid ${COLORS.border}`,
        padding: '6px 18px',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '0.8em',
        transition: '0.2s',
        fontWeight: '600'
    },
    controlsBar: {
        fontSize:'0.8em', 
        color: COLORS.textDim, 
        background: COLORS.card, 
        padding:'8px 15px', 
        borderRadius:'6px',
        border: `1px solid ${COLORS.border}`
    },
    select: { 
        padding: '12px', 
        borderRadius: '8px', 
        border: `1px solid ${COLORS.border}`, 
        background: COLORS.card, 
        color: 'white', 
        fontWeight:'600', 
        fontSize:'0.9em', 
        cursor:'pointer', 
        minWidth:'120px' 
    },
    input: { 
        padding: '12px', 
        borderRadius: '8px', 
        border: `1px solid ${COLORS.border}`, 
        background: COLORS.card, 
        color: 'white', 
        fontWeight:'600', 
        fontSize:'0.9em', 
        width:'180px' 
    },
    btnPrimary: { 
        padding: '12px 25px', 
        background: COLORS.primary, 
        color: 'white', 
        border: 'none', 
        borderRadius: '8px', 
        cursor: 'pointer', 
        fontWeight:'700', 
        fontSize:'0.9em', 
        letterSpacing:'1px',
        boxShadow: `0 4px 15px rgba(255, 24, 1, 0.4)`
    },
    btnDisabled: {
        padding: '12px 25px', 
        background: '#444', 
        color: '#888', 
        border: 'none', 
        borderRadius: '8px', 
        fontWeight:'700', 
        fontSize:'0.9em'
    },
    card: {
        background: COLORS.card, 
        padding: '25px', 
        borderRadius: '16px', 
        border: `1px solid ${COLORS.border}`,
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
    },
    cardTitle: {
        marginTop: 0, 
        marginBottom: '20px', 
        borderBottom: `1px solid ${COLORS.border}`, 
        paddingBottom: '15px', 
        fontSize: '0.9em', 
        color: COLORS.textDim, 
        textTransform: 'uppercase', 
        letterSpacing: '1px'
    },
    chartContainer: { 
        background: COLORS.card, 
        padding: '20px', 
        borderRadius: '16px', 
        border: `1px solid ${COLORS.border}`, 
        position: 'relative',
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
    },
    headerStyle: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px' },
    chartTitle: { margin:0, color: COLORS.textDim, fontSize:'0.8em', letterSpacing:'1px', textTransform:'uppercase' },
    miniBtn: { padding: '4px 10px', background: 'rgba(255,255,255,0.05)', color: COLORS.textDim, border: `1px solid ${COLORS.border}`, borderRadius: '4px', cursor: 'pointer', fontSize: '0.7em' },
    errorBanner: { padding: '15px', background: 'rgba(255, 0, 0, 0.1)', borderRadius: '8px', marginBottom: '20px', borderLeft: `4px solid ${COLORS.primary}`, color: '#ffaaaa' }
};

export default Dashboard;
