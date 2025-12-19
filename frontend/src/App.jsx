import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Line, Scatter } from 'react-chartjs-2';
import 'chart.js/auto';
import zoomPlugin from 'chartjs-plugin-zoom';
import { Chart } from 'chart.js';

Chart.register(zoomPlugin);

const DRIVER_COLORS = ['#36a2eb', '#ff6384', '#00ff9d', '#ff9f40', '#9966ff', '#ffcd56'];
const TYRE_COLORS = {
    'SOFT': '#ff3b30', 'MEDIUM': '#ffcc00', 'HARD': '#ffffff',
    'INTERMEDIATE': '#43a047', 'WET': '#0057e7', 'UNKNOWN': '#888'
};
const TYRE_EMOJIS = {
    'SOFT': '🔴', 'MEDIUM': '🟡', 'HARD': '⚪',
    'INTERMEDIATE': '🟢', 'WET': '🔵', 'UNKNOWN': '❓'
};

function App() {
    // If we are in production (Vite sets this), use relative path which Vercel rewrites.
    // If local, use the full localhost URL.
  const API_BASE = import.meta.env.PROD 
    ? '/api' 
    : 'http://localhost:8000';
    
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
      drivers: 'VER, LEC, PIA'
  });
  const [activeDrivers, setActiveDrivers] = useState([]);

  // Data
  const [telemetryData, setTelemetryData] = useState(null); 
  const [raceLapData, setRaceLapData] = useState(null); 
  const [stintData, setStintData] = useState(null);  
  const [raceWinner, setRaceWinner] = useState(null);
  const [raceWeather, setRaceWeather] = useState(null); // Added state for race weather
  
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
            
            // UPDATE THIS LINE: Store both name and label
            setRaceWinner({ 
                name: res.data.data.race_winner, 
                label: res.data.data.winner_label 
            });
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
  const getSectorColor = (val, best) => (val <= best + 0.001 ? '#d042ff' : '#888');
  
  const getTyreColor = (c) => TYRE_COLORS[c] || TYRE_COLORS['UNKNOWN'];

  const getDatasets = (metric, tension = 0) => {
    if (!telemetryData) return [];
    const keys = Object.keys(telemetryData.drivers);
    return keys.map((key, idx) => ({
        label: key,
        data: telemetryData.drivers[key]?.telemetry[metric] || [],
        borderColor: DRIVER_COLORS[idx % DRIVER_COLORS.length],
        borderWidth: 1.5, pointRadius: 0, tension: tension
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
              pointColors.push(isSelected ? '#00ff00' : compoundColor);
              borderColors.push(isSelected ? '#00ff00' : 'rgba(0,0,0,0.5)');
              borderCmds.push(isSelected ? 2 : 1);
              radiuses.push(isSelected ? 6 : 4);
          });
      });
      return { datasets: [{ label: 'Laps', data: plotData, pointStyle: 'circle', pointBackgroundColor: pointColors, pointBorderColor: borderColors, pointBorderWidth: borderCmds, pointRadius: radiuses }] };
  };

  const commonOptions = {
    animation: false, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
    plugins: { legend: { display: false }, zoom: { zoom: { drag: { enabled: true, backgroundColor: 'rgba(225, 6, 0, 0.3)', borderColor: '#e10600', borderWidth: 1 }, mode: 'x' }, pan: { enabled: true, mode: 'x', modifierKey: 'shift' } } },
    scales: { x: { type: 'linear', ticks: { color: '#666' }, grid: { color: '#2a2a2a' } }, y: { ticks: { color: '#666' }, grid: { color: '#2a2a2a' } } }
  };

  const distributionOptions = {
      animation: false, maintainAspectRatio: false, onClick: handleDistributionClick,
      plugins: {
          legend: { display: false }, zoom: false,
          tooltip: { callbacks: { label: (ctx) => `${ctx.raw.rawLapData.driver} L${ctx.raw.rawLapData.lap_number}: ${formatTime(ctx.raw.rawLapData.lap_time_seconds)} (${ctx.raw.rawLapData.compound})` } }
      },
      scales: {
          x: { 
              type: 'linear', offset: false, 
              ticks: { 
                  color: 'white', font: { size: 14, weight: 'bold' }, 
                  stepSize: 1,
                  callback: (val) => activeDrivers[Math.round(val)] || '', 
                  align: 'right', labelOffset: 55
              }, 
              grid: { display: false, color: '#2a2a2a' }, 
              min: -0.5, max: activeDrivers.length - 0.5 
          },
          y: { ticks: { color: '#666', callback: (val) => formatTime(val), stepSize: 0.1, maxTicksLimit: 20 }, grid: { color: '#2a2a2a' }, title: { display: true, text: 'Lap Time', color: '#666' } }
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
            ctx.save(); ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'; ctx.lineWidth = 1; ctx.setLineDash([5, 5]);
            ctx.beginPath(); ctx.moveTo(x, yAxis.top); ctx.lineTo(x, yAxis.bottom); ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillText(label, x + 5, yAxis.top + 10); ctx.restore();
        };
        drawLine(s1, "S1"); drawLine(s2, "S2");
    }
  });

  // Reusable Weather Widget
  const WeatherWidget = ({ weatherData }) => (
      <div style={{ background: '#1a1a1a', padding: '20px', borderRadius: '12px', border: '1px solid #333' }}>
          <h3 style={{marginTop:0, borderBottom:'1px solid #444', paddingBottom:'10px', fontSize:'1.1em'}}>⛅ Weather</h3>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', fontSize:'0.9em', color:'#ccc'}}>
              <div><span style={{color:'#666', fontSize:'0.8em'}}>🌡️ TRACK</span><br/><b>{weatherData.track_temp}°C</b></div>
              <div><span style={{color:'#666', fontSize:'0.8em'}}>💨 AIR</span><br/><b>{weatherData.air_temp}°C</b></div>
              <div><span style={{color:'#666', fontSize:'0.8em'}}>💧 HUMIDITY</span><br/><b>{weatherData.humidity}%</b></div>
              <div><span style={{color:'#666', fontSize:'0.8em'}}>🌧️ RAIN</span><br/><b style={{color: weatherData.rain ? '#36a2eb' : '#ccc'}}>{weatherData.rain ? 'YES' : 'NO'}</b></div>
          </div>
      </div>
  );

  return (
    <div style={{ padding: '20px', background: '#121212', color: '#e0e0e0', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
      {/* HEADER */}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
        <h1 style={{margin:0, fontSize: '2.2em'}}>🏎️ Beyond The Apex <span style={{color:'#e10600', fontSize:'0.7em', verticalAlign:'middle'}}>PRO</span></h1>
        <div style={{fontSize:'0.8em', color:'#666', background:'#1a1a1a', padding:'5px 10px', borderRadius:'4px'}}>
            {telemetryData && !isRaceOrPractice && <span>🖱️ <b>Drag</b> to Zoom | ⇧ <b>Shift+Drag</b> Pan | <span style={{cursor:'pointer', color:'#e10600', fontWeight:'bold'}} onClick={resetAllCharts}>⟲ Reset All</span></span>}
            {isRaceOrPractice && !telemetryData && <span>🖱️ <b>Click dots</b> to select specific laps.</span>}
             {isRaceOrPractice && telemetryData && <span>Analyzing Selection. <span style={{cursor:'pointer', color:'#e10600', fontWeight:'bold'}} onClick={() => {setTelemetryData(null); setSelectedLaps([]);}}>✕ Clear</span></span>}
        </div>
      </div>
      
      {/* CONTROLS */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems:'center' }}>
        <select value={inputs.year} onChange={e => setInputs(p=>({...p, year: e.target.value}))} style={selectStyle}>{years.map(y => <option key={y} value={y}>{y}</option>)}</select>
        <select value={inputs.race} onChange={e => setInputs(p=>({...p, race: e.target.value}))} style={selectStyle} disabled={!inputs.year}>{races.map(r => <option key={r} value={r}>{r}</option>)}</select>
        <select value={inputs.session} onChange={e => setInputs(p=>({...p, session: e.target.value}))} style={selectStyle} disabled={!inputs.race}>{sessions.map(s => <option key={s} value={s}>{s}</option>)}</select>
        <input placeholder="DRIVERS (e.g. VER, HAM)" value={inputs.drivers} onChange={e => setInputs({...inputs, drivers: e.target.value})} style={inputStyle}/>
        <button onClick={handleMainAction} disabled={loading || !inputs.session} style={btnStyle}>{loading ? 'LOADING...' : (isRaceOrPractice ? 'Load Race Laps' : 'Analyze Fastest Laps')}</button>
      </div>

      {error && <div style={{padding: '15px', background: '#4a1010', borderRadius: '4px', marginBottom: '20px', borderLeft: '4px solid #e10600'}}>⚠️ {error}</div>}

      {/* RACE DISTRIBUTION VIEW */}
      {isRaceOrPractice && raceLapData && !loading && (
          <div style={{ display: 'grid', gridTemplateColumns: '7fr 2fr', gap: '20px', marginBottom:'40px', width: '100%' , minWidth:'100%'}}>
               <div style={{background: '#1a1a1a', padding: '20px', borderRadius: '12px', border: '1px solid #333'}}>
                   <h4 style={{margin:'0 0 10px 0', color:'#aaa'}}>LAP TIME DISTRIBUTION</h4>
                   <div style={{ height: '400px' }}>
                       <Scatter ref={distributionChartRef} options={distributionOptions} data={getRaceDistributionData()} />
                   </div>
                   <div style={{marginTop:'10px', display:'flex', gap:'15px', justifyContent:'center', fontSize:'0.8em', color:'#aaa'}}>
                        {Object.entries(TYRE_COLORS).map(([compound, color]) => (compound !== 'UNKNOWN' && <div key={compound} style={{display:'flex', alignItems:'center'}}><div style={{width:'10px', height:'10px', borderRadius:'50%', backgroundColor:color, marginRight:'5px'}}></div>{compound}</div>))}
                   </div>
               </div>
               
               {/* STRATEGY & WEATHER (RIGHT SIDEBAR) */}
               <div style={{display:'flex', flexDirection:'column', gap:'20px'}}>
                    {/* Race Winner Widget */}
                    <div style={{background: '#1a1a1a', padding: '15px', borderRadius: '12px', border: '1px solid #d042ff', textAlign:'center'}}>
                        {/* Dynamic Label (FASTEST LAP / SPRINT WINNER / RACE WINNER) */}
                        <h4 style={{margin:'0 0 5px 0', color:'#d042ff', fontSize:'0.8em'}}>
                            {raceWinner?.label || "WINNER"}
                        </h4>
                        <div style={{fontSize:'1.3em', fontWeight:'bold', color:'white'}}>
                            {raceWinner?.name || "N/A"}
                        </div>
                    </div>
                   
                   <div style={{background: '#1a1a1a', padding: '20px', borderRadius: '12px', border: '1px solid #333'}}>
                       <h4 style={{margin:'0 0 15px 0', color:'#aaa'}}>TYRE STRATEGY</h4>
                       {stintData && activeDrivers.map(d => (
                           <div key={d} style={{marginBottom:'25px'}}>
                               <div style={{fontWeight:'bold', marginBottom:'5px', color:'white', fontSize:'1.1em'}}>{d}</div>
                               <div style={{display:'flex', width:'100%', height:'25px', background:'#222', borderRadius:'4px', overflow:'hidden', marginBottom:'5px'}}>
                                   {stintData[d] && stintData[d].map((stint, i) => (
                                       <div key={i} style={{
                                           flex: stint.end - stint.start + 1,
                                           backgroundColor: getTyreColor(stint.compound),
                                           borderRight: '1px solid #121212'
                                       }} title={`${stint.compound} (${stint.end - stint.start + 1} laps)`}></div>
                                   ))}
                               </div>
                               <div style={{display:'flex', flexWrap:'wrap', gap:'8px', fontSize:'0.8em', color:'#ccc'}}>
                                   {stintData[d] && stintData[d].map((stint, i) => (
                                       <span key={i}>
                                           {i===0 && 'Start '}
                                           {i>0 && '→ '}
                                           L{stint.start} {TYRE_EMOJIS[stint.compound] || '❓'}
                                       </span>
                                   ))}
                                   <span>🏁</span>
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
              <div style={{display:'flex', flexDirection:'column', gap:'15px'}}>
                {isQualiSession && telemetryData.pole_info && (
                    <div style={{background:'#1a1a1a', padding:'10px 20px', borderRadius:'8px', border:'1px solid #d042ff', color:'#d042ff', display:'flex', justifyContent:'center', alignItems:'center'}}>
                        🏆 <b>POLE POSITION:</b> &nbsp; {telemetryData.pole_info.driver} &nbsp; ({formatTime(telemetryData.pole_info.time)})
                    </div>
                )}

                <div style={chartContainerStyle}><div style={headerStyle}><h5 style={chartTitleStyle}>DELTA TO {isRaceOrPractice ? 'FASTEST' : 'POLE'} (SEC)</h5><button onClick={() => deltaChartRef.current?.resetZoom()} style={miniBtnStyle}>⟲ Reset</button></div><div style={{height: '200px'}}><Line ref={deltaChartRef} data={{ labels: telemetryData.drivers[Object.keys(telemetryData.drivers)[0]].telemetry.distance.map(d => Math.round(d)), datasets: getDatasets('delta_to_pole') }} options={{...commonOptions, scales:{...commonOptions.scales, y:{reverse:true, grid:{color:'#444'}}}}} plugins={[renderSectorPlugin()]} /></div></div>
                <div style={chartContainerStyle}><div style={headerStyle}><h5 style={chartTitleStyle}>SPEED (KM/H)</h5><button onClick={() => speedChartRef.current?.resetZoom()} style={miniBtnStyle}>⟲ Reset</button></div><div style={{height: '250px'}}><Line ref={speedChartRef} data={{ labels: telemetryData.drivers[Object.keys(telemetryData.drivers)[0]].telemetry.distance.map(d => Math.round(d)), datasets: getDatasets('speed') }} options={commonOptions} plugins={[renderSectorPlugin()]} /></div></div>
                <div style={chartContainerStyle}><div style={headerStyle}><h5 style={chartTitleStyle}>THROTTLE (%)</h5><button onClick={() => throttleChartRef.current?.resetZoom()} style={miniBtnStyle}>⟲ Reset</button></div><div style={{height: '200px'}}><Line ref={throttleChartRef} data={{ labels: telemetryData.drivers[Object.keys(telemetryData.drivers)[0]].telemetry.distance.map(d => Math.round(d)), datasets: getDatasets('throttle', 0) }} options={{...commonOptions, scales: {y: {min:0, max:105, grid:{color:'#2a2a2a'}}}}} plugins={[renderSectorPlugin()]} /></div></div>
                <div style={chartContainerStyle}><div style={headerStyle}><h5 style={chartTitleStyle}>BRAKE PRESSURE (%)</h5><button onClick={() => brakeChartRef.current?.resetZoom()} style={miniBtnStyle}>⟲ Reset</button></div><div style={{height: '200px'}}><Line ref={brakeChartRef} data={{ labels: telemetryData.drivers[Object.keys(telemetryData.drivers)[0]].telemetry.distance.map(d => Math.round(d)), datasets: getDatasets('brake', 0) }} options={{...commonOptions, scales: {y: {min:0, max:105, grid:{color:'#2a2a2a'}}}}} plugins={[renderSectorPlugin()]} /></div></div>
                
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
                    <div style={chartContainerStyle}><div style={headerStyle}><h5 style={chartTitleStyle}>RPM</h5><button onClick={() => rpmChartRef.current?.resetZoom()} style={miniBtnStyle}>⟲ Reset</button></div><div style={{height: '150px'}}><Line ref={rpmChartRef} data={{ labels: telemetryData.drivers[Object.keys(telemetryData.drivers)[0]].telemetry.distance.map(d => Math.round(d)), datasets: getDatasets('rpm') }} options={commonOptions} plugins={[renderSectorPlugin()]} /></div></div>
                    <div style={chartContainerStyle}><div style={headerStyle}><h5 style={chartTitleStyle}>LONGITUDINAL G</h5><button onClick={() => longGChartRef.current?.resetZoom()} style={miniBtnStyle}>⟲ Reset</button></div><div style={{height: '150px'}}><Line ref={longGChartRef} data={{ labels: telemetryData.drivers[Object.keys(telemetryData.drivers)[0]].telemetry.distance.map(d => Math.round(d)), datasets: getDatasets('long_g') }} options={commonOptions} plugins={[renderSectorPlugin()]} /></div></div>
                </div>
              </div>

              {/* STATS COLUMN */}
              <div style={{display:'flex', flexDirection:'column', gap:'20px'}}>
                <div style={{ background: '#1a1a1a', padding: '20px', borderRadius: '8px', border:'1px solid #333' }}>
                    <h3 style={{marginTop:0, borderBottom:'1px solid #444', paddingBottom:'10px', fontSize:'1.1em'}}>⏱️ Lap Data</h3>
                    {Object.keys(telemetryData.drivers).map((key, i) => {
                        const dData = telemetryData.drivers[key]; if (!dData) return null;
                        const delta = dData.lap_time - Math.min(...Object.values(telemetryData.drivers).map(d => d.lap_time));
                        const tyreColor = getTyreColor(dData.tyre_info.compound);
                        return (
                            <div key={key} style={{marginBottom:'15px', borderBottom:'1px solid #2a2a2a', paddingBottom:'10px'}}>
                                <div style={{display:'flex', justifyContent:'space-between', marginBottom:'5px'}}>
                                    <div><span style={{fontWeight:'bold', color: DRIVER_COLORS[i % DRIVER_COLORS.length], fontSize:'1.2em'}}>{key}</span></div>
                                    <div style={{textAlign:'right'}}>
                                        <div style={{fontFamily:'monospace', color:'white'}}>{formatTime(dData.lap_time)} <span style={{color: delta===0?'#d042ff':'#ffee00', fontSize:'0.8em'}}>{delta===0?'FASTEST':`+${delta.toFixed(3)}`}</span></div>
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

                <div style={{ background: '#1a1a1a', padding: '20px', borderRadius: '8px', border:'1px solid #333', borderTop:'3px solid #00ff9d', flex: 1 }}>
                   <h3 style={{marginTop:0, fontSize:'1.1em'}}>🤖 AI Analysis</h3>
                   <div style={{fontSize: '0.85em', color:'#ccc', lineHeight:'1.5'}}>
                     {telemetryData.ai_insights?.map((insight, idx) => ( <div key={idx} style={{ marginBottom: '10px', paddingBottom:'10px', borderBottom:'1px solid #2a2a2a' }}>{insight}</div> ))}
                   </div>
                </div>
              </div>
          </div>
      )}
    </div>
  );
}

// --- STYLES ---
const inputStyle = { padding: '10px', borderRadius: '4px', border: '1px solid #444', background: '#222', color: 'white', fontWeight:'bold', fontSize:'0.9em', width:'150px' };
const selectStyle = { padding: '10px', borderRadius: '4px', border: '1px solid #444', background: '#222', color: 'white', fontWeight:'bold', fontSize:'0.9em', cursor:'pointer', maxWidth:'180px' };
const btnStyle = { padding: '10px 20px', background: '#e10600', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight:'bold', fontSize:'0.9em' };
const miniBtnStyle = { padding: '2px 8px', background: '#333', color: '#aaa', border: '1px solid #444', borderRadius: '3px', cursor: 'pointer', fontSize: '0.7em' };
const chartContainerStyle = { background: '#1a1a1a', padding: '10px 15px', borderRadius: '8px', border:'1px solid #333', position: 'relative' };
const headerStyle = { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' };
const chartTitleStyle = { margin:0, color:'#666', fontSize:'0.8em', letterSpacing:'1px' };


export default App;

