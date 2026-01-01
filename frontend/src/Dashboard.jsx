import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import { Line, Scatter } from 'react-chartjs-2';
import 'chart.js/auto';
import zoomPlugin from 'chartjs-plugin-zoom';
import { Chart } from 'chart.js';

Chart.register(zoomPlugin);

// --- VISUAL CONSTANTS ---
const COLORS = {
    primary: 'var(--f1-red)',      
    neon: 'var(--neon-blue)',      
    bg: 'var(--dark-bg)',          
    card: 'var(--card-bg)',        
    text: 'var(--text-primary)',   
    textDim: 'var(--text-secondary)', 
    border: 'rgba(255, 255, 255, 0.1)',
    grid: 'rgba(255, 255, 255, 0.05)',
    s1: '#ffe119', 
    s2: '#00f3ff', 
    s3: '#ff004d'  
};

const DRIVER_COLORS = [
  '#4363d8', '#e6194b', '#f58231', '#ffe119', '#911eb4', 
  '#3cb44b', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe', 
  '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000'
];

const TYRE_COLORS = {
    'SOFT': '#ff3b30', 'MEDIUM': '#ffcc00', 'HARD': '#ffffff',
    'INTERMEDIATE': '#43a047', 'WET': '#0057e7', 'UNKNOWN': '#888'
};

const TYRE_EMOJIS = {
    'SOFT': '🔴', 'MEDIUM': '🟡', 'HARD': '⚪',
    'INTERMEDIATE': '🟢', 'WET': '🔵', 'UNKNOWN': '❓'
};

Chart.defaults.color = '#a0a0b0';
Chart.defaults.font.family = '"Titillium Web", sans-serif';

// --- HELPER FUNCTIONS ---
const formatTime = (s) => { 
    if (!s) return "-"; 
    const m = Math.floor(s/60); 
    const sc = Math.floor(s%60); 
    const ms = Math.round((s%1)*1000); 
    return `${m}:${sc.toString().padStart(2,'0')}.${ms.toString().padStart(3,'0')}`; 
};

const getSectorColor = (val, best) => (val <= best + 0.001 ? COLORS.neon : '#666');
const getTyreColor = (c) => TYRE_COLORS[c] || TYRE_COLORS['UNKNOWN'];

// --- CHAMPIONSHIP PREDICTOR LOGIC ---
const POINTS_SYSTEM = { 1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1 };
const SPRINT_POINTS = { 1: 8, 2: 7, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1 };

function Dashboard({ session, handleLogout }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [years, setYears] = useState([]);
  const [races, setRaces] = useState([]);
  const [sessions, setSessions] = useState([]);

  const [inputs, setInputs] = useState({ 
      year: new Date().getFullYear(), 
      race: '', 
      session: '', 
      drivers: 'VER, LEC'
  });
  const [activeDrivers, setActiveDrivers] = useState([]);

  const [telemetryData, setTelemetryData] = useState(null); 
  const [raceLapData, setRaceLapData] = useState(null); 
  const [stintData, setStintData] = useState(null);  
  const [raceWinner, setRaceWinner] = useState(null);
  const [raceWeather, setRaceWeather] = useState(null);
  const [raceInsights, setRaceInsights] = useState([]);
  
  const [selectedLaps, setSelectedLaps] = useState([]); 
  const [hoverIndex, setHoverIndex] = useState(null); 

  // Track Map State (Animation Vars)
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [isClosing, setIsClosing] = useState(false); // NEW: Closing animation state
  const [buttonCoords, setButtonCoords] = useState({ x: 0, y: 0, width: 0, height: 0 }); // NEW: Capture origin
  const [animOrigin, setAnimOrigin] = useState("top right"); // NEW: Dynamic transform origin

  const [mapSize, setMapSize] = useState({ width: 500, height: 480 });
  const [mapPosition, setMapPosition] = useState({ x: 0, y: 0 });
  
  // Championship & Predictor State
  const [isChampModalOpen, setIsChampModalOpen] = useState(false);
  const [standings, setStandings] = useState({ wdc: [], wcc: [] });
  const [schedule, setSchedule] = useState([]);
  const [predictionMode, setPredictionMode] = useState(false);
  const [predictions, setPredictions] = useState({});
  const [currentPredictRound, setCurrentPredictRound] = useState(0);

  const widgetRef = useRef(null);
  const mapBtnRef = useRef(null); // NEW: Ref for button
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const deltaChartRef = useRef(null);
  const speedChartRef = useRef(null);
  const throttleChartRef = useRef(null);
  const brakeChartRef = useRef(null);
  const rpmChartRef = useRef(null);
  const longGChartRef = useRef(null);
  const distributionChartRef = useRef(null);

  const API_BASE = import.meta.env.VITE_API_URL || 'https://f1-backend.zeabur.app';

  // --- INITIAL DATA FETCH ---
  useEffect(() => {
      setTelemetryData(null); setRaceLapData(null); setStintData(null); 
      setRaceWinner(null); setRaceWeather(null); setSelectedLaps([]); 
      setRaceInsights([]); setHoverIndex(null); setIsMapExpanded(false); setIsClosing(false);
  }, [inputs.race, inputs.session]);

  useEffect(() => {
      axios.get(`${API_BASE}/years`).then(res => {
          setYears(res.data.years);
          if(res.data.years.length > 0) setInputs(prev => ({...prev, year: res.data.years[res.data.years.length-1]}));
      });
  }, [API_BASE]);

  useEffect(() => {
      if(inputs.year) {
          axios.get(`${API_BASE}/races?year=${inputs.year}`).then(res => {
              setRaces(res.data.races);
              setInputs(prev => ({...prev, race: res.data.races[0] || '', session: ''}));
          });
      }
  }, [inputs.year, API_BASE]);

  useEffect(() => {
      if(inputs.year && inputs.race) {
          axios.get(`${API_BASE}/sessions?year=${inputs.year}&race=${inputs.race}`).then(res => {
              setSessions(res.data.sessions);
              const def = res.data.sessions.find(s => s.includes('Qualifying')) || res.data.sessions[0] || '';
              setInputs(prev => ({...prev, session: def}));
          });
      }
  }, [inputs.year, inputs.race, API_BASE]);

  // --- CHAMPIONSHIP DATA ---
  const fetchChampionshipData = async () => {
      setIsChampModalOpen(true);
      try {
          const sRes = await axios.get(`${API_BASE}/standings?year=${inputs.year}`);
          const schedRes = await axios.get(`${API_BASE}/schedule?year=${inputs.year}`);
          setStandings(sRes.data.data);
          setSchedule(schedRes.data.data);
          
          const currentYear = new Date().getFullYear();
          if (parseInt(inputs.year) >= currentYear) {
               const nextRace = schedRes.data.data.find(r => !r.is_done);
               if(nextRace) setCurrentPredictRound(nextRace.round - 1);
          }
      } catch (err) { console.error(err); }
  };

  // --- PREDICTOR LOGIC ---
  const getSimulatedStandings = () => {
      let simWdc = standings.wdc.map(d => ({...d}));
      let simWcc = standings.wcc.map(t => ({...t}));

      Object.keys(predictions).forEach(round => {
          const roundPred = predictions[round];
          if(roundPred.race) {
              Object.entries(roundPred.race).forEach(([pos, driverCode]) => {
                  const points = POINTS_SYSTEM[pos] || 0;
                  const driver = simWdc.find(d => d.code === driverCode);
                  if(driver) {
                      driver.points += points;
                      const team = simWcc.find(t => t.team === driver.team);
                      if(team) team.points += points;
                  }
              });
          }
          if(roundPred.sprint) {
              Object.entries(roundPred.sprint).forEach(([pos, driverCode]) => {
                  const points = SPRINT_POINTS[pos] || 0;
                  const driver = simWdc.find(d => d.code === driverCode);
                  if(driver) {
                      driver.points += points;
                      const team = simWcc.find(t => t.team === driver.team);
                      if(team) team.points += points;
                  }
              });
          }
      });

      simWdc.sort((a,b) => b.points - a.points);
      simWcc.sort((a,b) => b.points - a.points);
      simWdc.forEach((d,i) => d.position = i+1);
      simWcc.forEach((t,i) => t.position = i+1);

      return { wdc: simWdc, wcc: simWcc };
  };

  const updatePrediction = (type, pos, driverCode) => {
      const roundData = schedule[currentPredictRound];
      setPredictions(prev => ({
          ...prev,
          [roundData.round]: {
              ...prev[roundData.round],
              [type]: {
                  ...(prev[roundData.round]?.[type] || {}),
                  [pos]: driverCode
              }
          }
      }));
  };

  const getAvailableDrivers = (round, type, currentPos) => {
      const picked = predictions[round]?.[type] || {};
      const pickedCodes = Object.entries(picked)
          .filter(([pos, code]) => parseInt(pos) !== currentPos && code)
          .map(([_, code]) => code);
      return standings.wdc.filter(d => !pickedCodes.includes(d.code));
  };

  const isQualiSession = inputs.session && (inputs.session.includes('Qualifying') || inputs.session.includes('Sprint Qualifying'));
  const isRaceOrPractice = inputs.session && !isQualiSession; 

  const fetchRaceOverview = async () => {
      if (!inputs.race || !inputs.session) return;
      setLoading(true); setError(null); setRaceLapData(null); setTelemetryData(null);
      try {
            const res = await axios.get(`${API_BASE}/race_laps`, { params: { ...inputs } });
            if (res.data.status === 'error') throw new Error(res.data.message);
            setRaceLapData(res.data.data.laps);
            setStintData(res.data.data.stints);
            setRaceWinner({ name: res.data.data.race_winner, label: res.data.data.winner_label });
            setRaceWeather(res.data.data.weather);
            setRaceInsights(res.data.data.ai_insights || []);
            setActiveDrivers(inputs.drivers.split(',').map(d => d.trim().toUpperCase()));
      } catch (err) { setError(err.message || "Failed to connect."); }
      setLoading(false);
  };

  const fetchDetailedTelemetry = async (lapsToFetch = null) => {
    if (!inputs.race || !inputs.session) return;
    setLoading(true); setError(null);
    try {
      const params = { ...inputs };
      if(lapsToFetch && lapsToFetch.length > 0) params.specific_laps = JSON.stringify(lapsToFetch);
      else if (isRaceOrPractice) { setLoading(false); return; }
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

  const resetAllCharts = () => {
    [deltaChartRef, speedChartRef, throttleChartRef, brakeChartRef, rpmChartRef, longGChartRef].forEach(ref => { if (ref.current) ref.current.resetZoom(); });
  };

  const getDatasets = (metric) => {
    if (!telemetryData) return [];
    return Object.keys(telemetryData.drivers).map((key, idx) => ({
        label: key,
        data: telemetryData.drivers[key]?.telemetry[metric] || [],
        borderColor: DRIVER_COLORS[idx % DRIVER_COLORS.length],
        borderWidth: 2, pointRadius: 0, tension: 0, hoverBorderWidth: 3
    }));
  };

  const chartLabels = useMemo(() => {
      if (!telemetryData) return [];
      const firstDriver = Object.keys(telemetryData.drivers)[0];
      return telemetryData.drivers[firstDriver].telemetry.distance.map(d => Math.round(d));
  }, [telemetryData]);

  const deltaData = useMemo(() => ({ labels: chartLabels, datasets: getDatasets('delta_to_pole') }), [chartLabels, telemetryData]);
  const speedData = useMemo(() => ({ labels: chartLabels, datasets: getDatasets('speed') }), [chartLabels, telemetryData]);
  const throttleData = useMemo(() => ({ labels: chartLabels, datasets: getDatasets('throttle') }), [chartLabels, telemetryData]);
  const brakeData = useMemo(() => ({ labels: chartLabels, datasets: getDatasets('brake') }), [chartLabels, telemetryData]);
  const rpmData = useMemo(() => ({ labels: chartLabels, datasets: getDatasets('rpm') }), [chartLabels, telemetryData]);
  const longGData = useMemo(() => ({ labels: chartLabels, datasets: getDatasets('long_g') }), [chartLabels, telemetryData]);

  const raceDistributionData = useMemo(() => {
    if(!raceLapData || !activeDrivers.length) return { datasets: [] };
    const plotData = []; const pointColors = []; const borderColors = []; const borderCmds = []; const radiuses = [];
    activeDrivers.forEach((driver, dIdx) => {
        const driverLaps = raceLapData.filter(d => d.driver === driver);
        driverLaps.forEach(lap => {
            const isSelected = selectedLaps.some(s => s.driver === driver && s.lap === lap.lap_number);
            const jitter = (Math.random() - 0.5) * 0.4;
            plotData.push({ x: dIdx + jitter, y: lap.lap_time_seconds, rawLapData: lap });
            pointColors.push(isSelected ? COLORS.neon : getTyreColor(lap.compound));
            borderColors.push(isSelected ? COLORS.neon : 'rgba(0,0,0,0.5)');
            borderCmds.push(isSelected ? 2 : 1);
            radiuses.push(isSelected ? 6 : 3.5);
        });
    });
    return { datasets: [{ label: 'Laps', data: plotData, pointStyle: 'circle', pointBackgroundColor: pointColors, pointBorderColor: borderColors, pointBorderWidth: borderCmds, pointRadius: radiuses }] };
  }, [raceLapData, selectedLaps, activeDrivers]);

  const handleDistributionClick = (event, elements) => {
    if (elements.length === 0 || !raceLapData) return;
    const dataIndex = elements[0].index;
    const rawPointData = raceDistributionData.datasets[0].data[dataIndex];
    if (rawPointData && rawPointData.rawLapData) {
        const { driver, lap_number } = rawPointData.rawLapData;
        setSelectedLaps(prevSelected => {
            const exists = prevSelected.find(s => s.driver === driver && s.lap === lap_number);
            let newSelection;
            if (exists) newSelection = prevSelected.filter(s => !(s.driver === driver && s.lap === lap_number));
            else newSelection = [...prevSelected, { driver, lap: lap_number }];
            if (newSelection.length > 0) fetchDetailedTelemetry(newSelection);
            else setTelemetryData(null);
            return newSelection;
        });
    }
  };

  const telemetryOptions = useMemo(() => ({
    animation: false, maintainAspectRatio: false, responsive: true,
    interaction: { mode: 'index', intersect: false },
    onHover: (e, elements) => {
        if (elements && elements.length > 0) setHoverIndex(elements[0].index);
        else setHoverIndex(null);
    },
    plugins: { legend: { display: false }, zoom: { zoom: { drag: { enabled: true, backgroundColor: 'rgba(0, 243, 255, 0.2)', borderColor: COLORS.neon, borderWidth: 1 }, mode: 'x' }, pan: { enabled: true, mode: 'x', modifierKey: 'shift' } } },
    scales: { x: { type: 'linear', ticks: { color: '#888', font: {family: '"Titillium Web"'}}, grid: { color: COLORS.grid } }, y: { ticks: { color: '#888', font: {family: '"Titillium Web"'} }, grid: { color: COLORS.grid } } }
  }), []);

  const pctTelemetryOptions = useMemo(() => ({
      ...telemetryOptions, scales: { ...telemetryOptions.scales, y: { min: 0, max: 105, ticks: { color: '#888' }, grid: { color: COLORS.grid } } }
  }), [telemetryOptions]);

  const distributionOptions = useMemo(() => ({
      animation: false, maintainAspectRatio: false, responsive: true, onClick: handleDistributionClick,
      plugins: {
          legend: { display: false }, zoom: false,
          tooltip: { 
              backgroundColor: 'rgba(20, 20, 30, 0.9)', titleColor: COLORS.neon, bodyFont: { family: '"Titillium Web"' },
              callbacks: { label: (ctx) => `${ctx.raw.rawLapData.driver} L${ctx.raw.rawLapData.lap_number}: ${formatTime(ctx.raw.rawLapData.lap_time_seconds)} (${ctx.raw.rawLapData.compound})` } 
          }
      },
      scales: {
          x: { 
              type: 'linear', offset: false, title: { display: true, text: 'DRIVERS', color: '#666', font:{weight:'bold'} },
              ticks: { color: 'white', font: { size: 14, weight: 'bold', family: '"Titillium Web"' }, stepSize: 1, callback: (val) => activeDrivers[Math.round(val)] || '', autoSkip: false }, 
              grid: { display: false }, min: -0.5, max: activeDrivers.length - 0.5 
          },
          y: { ticks: { color: '#888', callback: (val) => formatTime(val), stepSize: 0.1 }, grid: { color: COLORS.grid }, title: { display: true, text: 'LAP TIME (m:ss.ms)', color: '#666', font:{weight:'bold'} } }
      }
  }), [activeDrivers]);

  const getTrackMapData = () => {
      if(!telemetryData) return { datasets: [] };
      const driverKey = Object.keys(telemetryData.drivers)[0]; 
      const t = telemetryData.drivers[driverKey].telemetry;
      const totalLen = telemetryData.track_length;
      const s1End = totalLen * 0.33; const s2End = totalLen * 0.66;
      const s1 = [], s2 = [], s3 = [];
      t.distance.forEach((d, i) => {
          const pt = { x: t.x[i], y: t.y[i] };
          if(d <= s1End) s1.push(pt);
          if(d >= s1End && d <= s2End) s2.push(pt);
          else if(i > 0 && t.distance[i-1] < s1End && d > s1End) s2.push(pt);
          if(d >= s2End) s3.push(pt);
          else if(i > 0 && t.distance[i-1] < s2End && d > s2End) s3.push(pt);
      });
      const datasets = [
          { label: 'S1', data: s1, borderColor: COLORS.s1, borderWidth: isMapExpanded?5:4, pointRadius: 0, showLine: true },
          { label: 'S2', data: s2, borderColor: COLORS.s2, borderWidth: isMapExpanded?5:4, pointRadius: 0, showLine: true },
          { label: 'S3', data: s3, borderColor: COLORS.s3, borderWidth: isMapExpanded?5:4, pointRadius: 0, showLine: true },
      ];
      if(hoverIndex !== null && t.x[hoverIndex]) {
          datasets.push({ label: 'Car', data: [{ x: t.x[hoverIndex], y: t.y[hoverIndex] }], backgroundColor: 'white', borderColor: 'black', borderWidth: 2, pointRadius: isMapExpanded ? 10 : 6 });
      }
      return { datasets };
  };

  const trackMapOptions = { animation: false, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { display: false }, y: { display: false } }, interaction: { mode: 'nearest', intersect: false } };

  const renderSectorPlugin = () => ({
    id: 'sectorLines',
    beforeDraw: (chart) => {
        if (!telemetryData || !telemetryData.track_length) return;
        const totalTrackLength = telemetryData.track_length;
        const s1 = totalTrackLength * 0.33; const s2 = totalTrackLength * 0.66;
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

  const toggleMapExpand = () => {
      if (isMapExpanded) {
          // CLOSING LOGIC
          const originX = buttonCoords.x - mapPosition.x + (buttonCoords.width / 2);
          const originY = buttonCoords.y - mapPosition.y + (buttonCoords.height / 2);
          setAnimOrigin(`${originX}px ${originY}px`);

          setIsClosing(true);
          setTimeout(() => {
              setIsMapExpanded(false);
              setIsClosing(false);
          }, 300);
      } else {
          // OPENING LOGIC
          if (mapBtnRef.current) {
              const rect = mapBtnRef.current.getBoundingClientRect();
              setButtonCoords(rect);
              
              const defaultX = window.innerWidth - 550;
              const defaultY = 120;
              const originX = rect.left - defaultX + (rect.width / 2);
              const originY = rect.top - defaultY + (rect.height / 2);
              
              setAnimOrigin(`${originX}px ${originY}px`);
              setMapPosition({ x: defaultX, y: defaultY });
          }
          setIsMapExpanded(true);
      }
  };

  const handleMouseDown = (e) => {
    isDragging.current = true;
    dragOffset.current = { x: e.clientX - mapPosition.x, y: e.clientY - mapPosition.y };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e) => {
      if (!isDragging.current) return;
      setMapPosition({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y });
  };

  const handleMouseUp = () => {
      isDragging.current = false;
      if (widgetRef.current) { setMapSize({ width: widgetRef.current.offsetWidth, height: widgetRef.current.offsetHeight }); }
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
  };
  
  // Predictor Helpers
  const displayedStandings = predictionMode ? getSimulatedStandings() : standings;
  const currentRace = schedule[currentPredictRound];
  const nextRound = () => setCurrentPredictRound(p => Math.min(p + 1, schedule.length - 1));
  const prevRound = () => setCurrentPredictRound(p => Math.max(p - 1, 0));

  return (
    <div style={{ padding: '20px', background: COLORS.bg, color: COLORS.text, minHeight: '100vh', fontFamily: '"Titillium Web", sans-serif' }}>
      
      {/* CHAMPIONSHIP MODAL */}
      {isChampModalOpen && (
          <div style={styles.modalOverlay} onClick={() => setIsChampModalOpen(false)}>
              <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
                  <div style={styles.modalHeader}>
                      <h2>🏆 {inputs.year} CHAMPIONSHIP {predictionMode && <span style={{color: COLORS.neon}}>PREDICTOR</span>}</h2>
                      <div style={{display:'flex', gap:'15px', alignItems:'center'}}>
                         {parseInt(inputs.year) >= new Date().getFullYear() && (
                             <button onClick={() => setPredictionMode(!predictionMode)} style={predictionMode ? styles.btnPrimary : styles.btnOutline}>
                                 {predictionMode ? 'EXIT PREDICTOR' : 'PREDICT FUTURE'}
                             </button>
                         )}
                         <button onClick={() => setIsChampModalOpen(false)} style={styles.closeBtn}>✕</button>
                      </div>
                  </div>

                  {predictionMode && currentRace ? (
                      <div style={styles.predictorContainer}>
                          {/* PREDICTOR WIDGET (Left Side - Race & Sprint) */}
                          <div style={{...styles.scrollableCard, gridColumn: 'span 2', display: 'flex', flexDirection: 'column', maxHeight: '600px'}}>
                              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px', flexShrink: 0}}>
                                  <button onClick={prevRound} style={styles.miniBtn}>◀</button>
                                  <div style={{textAlign:'center'}}>
                                      <div style={{color: COLORS.neon, letterSpacing:'2px', fontSize:'0.8em'}}>ROUND {currentRace.round}</div>
                                      <h3 style={{margin:0}}>{currentRace.name}</h3>
                                      <div style={{color: '#666', fontSize:'0.8em'}}>{currentRace.date}</div>
                                  </div>
                                  <button onClick={nextRound} style={styles.miniBtn}>▶</button>
                              </div>
                              
                              {/* SCROLLABLE PREDICTION AREA */}
                              <div style={{display:'flex', gap:'20px', overflowY: 'auto', paddingRight: '5px', flex: 1}}>
                                  {/* RACE COLUMN */}
                                  <div style={{flex:1}}>
                                      <h5 style={styles.colHeader}>RACE PREDICTION (TOP 10)</h5>
                                      <div style={styles.predGrid}>
                                        {[...Array(10)].map((_, i) => {
                                            const pos = i + 1;
                                            const currentVal = predictions[currentRace.round]?.race?.[pos] || '';
                                            const available = getAvailableDrivers(currentRace.round, 'race', pos);
                                            
                                            return (
                                                <div key={i} style={styles.predRow}>
                                                    <span style={{color:'#666', width:'25px'}}>{pos}</span>
                                                    <select 
                                                        style={styles.predSelect} 
                                                        value={currentVal}
                                                        onChange={(e) => updatePrediction('race', pos, e.target.value)}
                                                    >
                                                        <option value="" style={{backgroundColor: '#2b2b3d', color: 'white'}}>Select Driver</option>
                                                        {currentVal && <option value={currentVal} style={{backgroundColor: '#2b2b3d', color: 'white'}}>{currentVal}</option>}
                                                        {available.map(d => <option key={d.code} value={d.code} style={{backgroundColor: '#2b2b3d', color: 'white'}}>{d.code}</option>)}
                                                    </select>
                                                    <span style={{color: COLORS.neon, fontSize:'0.8em'}}>+{POINTS_SYSTEM[pos]}pts</span>
                                                </div>
                                            );
                                        })}
                                      </div>
                                  </div>

                                  {/* SPRINT COLUMN (Conditional) */}
                                  {currentRace.is_sprint && (
                                      <div style={{flex:1}}>
                                          <h5 style={styles.colHeader}>SPRINT PREDICTION (TOP 8)</h5>
                                          <div style={styles.predGrid}>
                                            {[...Array(8)].map((_, i) => {
                                                const pos = i + 1;
                                                const currentVal = predictions[currentRace.round]?.sprint?.[pos] || '';
                                                const available = getAvailableDrivers(currentRace.round, 'sprint', pos);

                                                return (
                                                    <div key={i} style={styles.predRow}>
                                                        <span style={{color:'#666', width:'25px'}}>{pos}</span>
                                                        <select 
                                                            style={styles.predSelect}
                                                            value={currentVal}
                                                            onChange={(e) => updatePrediction('sprint', pos, e.target.value)}
                                                        >
                                                            <option value="" style={{backgroundColor: '#2b2b3d', color: 'white'}}>Select Driver</option>
                                                            {currentVal && <option value={currentVal} style={{backgroundColor: '#2b2b3d', color: 'white'}}>{currentVal}</option>}
                                                            {available.map(d => <option key={d.code} value={d.code} style={{backgroundColor: '#2b2b3d', color: 'white'}}>{d.code}</option>)}
                                                        </select>
                                                        <span style={{color: COLORS.neon, fontSize:'0.8em'}}>+{SPRINT_POINTS[pos]}pts</span>
                                                    </div>
                                                );
                                            })}
                                          </div>
                                      </div>
                                  )}
                              </div>
                          </div>
                          
                          {/* LIVE STANDINGS WIDGETS (Right Side) */}
                          <div style={{...styles.scrollableCard, maxHeight: '600px', display: 'flex', flexDirection: 'column'}}>
                              <h4 style={styles.cardTitle}>WDC (PREDICTED)</h4>
                              <div style={styles.standingsList}>
                                  {displayedStandings.wdc.map((d, i) => (
                                      <div key={d.code} style={styles.standingRow}>
                                          <span style={{color: COLORS.neon, width:'25px'}}>{i+1}</span>
                                          <span style={{flex:1, textAlign:'left'}}>{d.code}</span>
                                          <b>{d.points}</b>
                                      </div>
                                  ))}
                              </div>
                          </div>
                          <div style={{...styles.scrollableCard, maxHeight: '600px', display: 'flex', flexDirection: 'column'}}>
                              <h4 style={styles.cardTitle}>WCC (PREDICTED)</h4>
                              <div style={styles.standingsList}>
                                  {displayedStandings.wcc.map((t, i) => (
                                      <div key={t.id} style={styles.standingRow}>
                                          <span style={{color: COLORS.neon, width:'25px'}}>{i+1}</span>
                                          <span style={{flex:1, textAlign:'left'}}>{t.team}</span>
                                          <b>{t.points}</b>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      </div>
                  ) : (
                      <div style={styles.standingsContainer}>
                          <div style={styles.scrollableCard}>
                              <h3 style={styles.cardTitle}>WORLD DRIVERS' CHAMPIONSHIP</h3>
                              <table style={styles.table}>
                                  <thead>
                                      <tr style={{color: COLORS.textDim, fontSize:'0.8em'}}>
                                          <th style={{textAlign:'left'}}>POS</th>
                                          <th style={{textAlign:'left'}}>DRIVER</th>
                                          <th style={{textAlign:'left'}}>TEAM</th>
                                          <th style={{textAlign:'right'}}>PTS</th>
                                      </tr>
                                  </thead>
                                  <tbody>
                                      {displayedStandings.wdc.map(d => (
                                          <tr key={d.code} style={{borderBottom: `1px solid ${COLORS.grid}`}}>
                                              <td style={{color: COLORS.neon, fontWeight:'bold', padding:'10px 0'}}>{d.position}</td>
                                              <td>{d.name}</td>
                                              <td style={{color: '#888', fontSize:'0.9em'}}>{d.team}</td>
                                              <td style={{textAlign:'right', fontWeight:'bold'}}>{d.points}</td>
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                          </div>
                          <div style={styles.scrollableCard}>
                              <h3 style={styles.cardTitle}>WORLD CONSTRUCTORS' CHAMPIONSHIP</h3>
                              <table style={styles.table}>
                                  <thead>
                                      <tr style={{color: COLORS.textDim, fontSize:'0.8em'}}>
                                          <th style={{textAlign:'left'}}>POS</th>
                                          <th style={{textAlign:'left'}}>TEAM</th>
                                          <th style={{textAlign:'right'}}>PTS</th>
                                      </tr>
                                  </thead>
                                  <tbody>
                                      {displayedStandings.wcc.map(t => (
                                          <tr key={t.id} style={{borderBottom: `1px solid ${COLORS.grid}`}}>
                                              <td style={{color: COLORS.neon, fontWeight:'bold', padding:'10px 0'}}>{t.position}</td>
                                              <td>{t.team}</td>
                                              <td style={{textAlign:'right', fontWeight:'bold'}}>{t.points}</td>
                                          </tr>
                                      ))}
                                  </tbody>
                              </table>
                          </div>
                      </div>
                  )}
              </div>
          </div>
      )}
      
      {/* TRACK MAP WIDGET */}
      {(isMapExpanded || isClosing) && telemetryData && (
          <div ref={widgetRef} style={{ ...styles.floatingWidget, left: mapPosition.x, top: mapPosition.y, width: `${mapSize.width}px`, height: `${mapSize.height}px`, resize: 'both', overflow: 'hidden', transformOrigin: animOrigin, animation: isClosing ? 'morphOut 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards' : 'morphIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
              <div style={styles.floatingHeader} onMouseDown={handleMouseDown} title="Drag Header to Move | Drag Bottom-Right to Resize">
                  <span>📍 TRACK MAP</span>
                  <button onClick={toggleMapExpand} style={styles.closeBtn}>✕</button>
              </div>
              <div style={{height: 'calc(100% - 50px)', padding:'10px'}}>
                  <Scatter data={getTrackMapData()} options={trackMapOptions} />
              </div>
          </div>
      )}

      {/* HEADER BAR */}
      <div className="dashboard-header" style={styles.topBar}>
        <span style={{ color: COLORS.textDim, fontSize: '0.9em' }}>
          Logged in as: <b style={{ color: COLORS.neon }}>{session?.user?.user_metadata?.full_name || session?.user?.email}</b>
        </span>
        <div style={{display: 'flex', alignItems: 'center', gap: '20px'}}>
             
             {/* CHAMPIONSHIP BUTTON */}
             <div className="map-trigger" style={styles.mapButton} onClick={fetchChampionshipData} title="Championship Standings">
                 🏆
             </div>

             {telemetryData && !isMapExpanded && (
                 <div ref={mapBtnRef} style={{position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor:'pointer'}} onClick={toggleMapExpand} className="map-trigger">
                     <div style={styles.tooltipAbove}>CLICK TO EXPAND</div>
                     <div style={styles.mapButton}>
                        <Scatter data={getTrackMapData()} options={{...trackMapOptions, animation: false}} />
                     </div>
                 </div>
             )}
             <button onClick={handleLogout} style={styles.logoutBtn}>Log Out</button>
        </div>
      </div>

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
      
      <div className="dashboard-controls">
        <select value={inputs.year} onChange={e => setInputs(p=>({...p, year: e.target.value}))} style={styles.select}>{years.map(y => <option key={y} value={y}>{y}</option>)}</select>
        <select value={inputs.race} onChange={e => setInputs(p=>({...p, race: e.target.value}))} style={styles.select} disabled={!inputs.year}>{races.map(r => <option key={r} value={r}>{r}</option>)}</select>
        <select value={inputs.session} onChange={e => setInputs(p=>({...p, session: e.target.value}))} style={styles.select} disabled={!inputs.race}>{sessions.map(s => <option key={s} value={s}>{s}</option>)}</select>
        <input placeholder="DRIVERS (e.g. VER, HAM)" value={inputs.drivers} onChange={e => setInputs({...inputs, drivers: e.target.value})} style={styles.input}/>
        <button onClick={handleMainAction} disabled={loading || !inputs.session} style={loading ? styles.btnDisabled : styles.btnPrimary}>{loading ? 'GETTING DATA...' : (isRaceOrPractice ? 'LOAD RACE LAPS' : 'ANALYZE FASTEST LAPS')}</button>
      </div>

      {error && <div style={styles.errorBanner}>⚠️ {error}</div>}

      {isRaceOrPractice && raceLapData && !loading && (
          <div className="dashboard-grid-race">
               <div style={{...styles.card, display: 'flex', flexDirection: 'column', height: '820px'}}>
                   <h4 style={styles.cardTitle}>LAP TIME DISTRIBUTION</h4>
                   <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
                       <Scatter ref={distributionChartRef} options={distributionOptions} data={raceDistributionData} />
                   </div>
                   <div style={{marginTop:'15px', display:'flex', gap:'15px', justifyContent:'center', fontSize:'0.8em', color: COLORS.textDim}}>
                        {Object.entries(TYRE_COLORS).map(([compound, color]) => (compound !== 'UNKNOWN' && <div key={compound} style={{display:'flex', alignItems:'center'}}><div style={{width:'8px', height:'8px', borderRadius:'50%', backgroundColor:color, marginRight:'6px', boxShadow:`0 0 5px ${color}`}}></div>{compound}</div>))}
                   </div>
               </div>
               
               <div style={{display:'flex', flexDirection:'column', gap:'20px'}}>
                    <div style={{...styles.card, border: `1px solid ${COLORS.neon}`, textAlign:'center', background: 'linear-gradient(180deg, rgba(0, 243, 255, 0.1), transparent)'}}>
                        <h4 style={{margin:'0 0 5px 0', color: COLORS.neon, fontSize:'0.7em', letterSpacing:'2px'}}>{raceWinner?.label || "WINNER"}</h4>
                        <div style={{fontSize:'1.5em', fontWeight:'800', color:'white', textShadow: `0 0 10px ${COLORS.neon}`}}>{raceWinner?.name || "N/A"}</div>
                    </div>
                   <div style={styles.card}>
                       <h4 style={styles.cardTitle}>TYRE STRATEGY</h4>
                       {stintData && activeDrivers.map(d => (
                           <div key={d} style={{marginBottom:'25px'}}>
                               <div style={{fontWeight:'bold', marginBottom:'8px', color:'white', fontSize:'1.1em', display:'flex', alignItems:'center'}}><span style={{width:'3px', height:'15px', background: COLORS.primary, marginRight:'8px'}}></span>{d}</div>
                               <div style={{display:'flex', width:'100%', height:'20px', background:'#111', borderRadius:'4px', overflow:'hidden', marginBottom:'8px'}}>
                                   {stintData[d] && stintData[d].map((stint, i) => (
                                       <div key={i} style={{flex: stint.end - stint.start + 1, backgroundColor: getTyreColor(stint.compound), borderRight: '1px solid #1a1a1a'}} title={`${stint.compound} (${stint.end - stint.start + 1} laps)`}></div>
                                   ))}
                               </div>
                           </div>
                       ))}
                   </div>
                   {raceInsights.length > 0 && (
                     <div style={{...styles.card, borderTop: `3px solid ${COLORS.primary}`}}>
                        <h4 style={styles.cardTitle}>🤖 Tyre Deg Insights</h4>
                        <div style={{fontSize:'0.85em', color: COLORS.textDim, lineHeight:'1.5'}}>
                          {raceInsights.map((insight, i) => (<div key={i} style={{marginBottom:'8px', paddingBottom:'8px', borderBottom:`1px solid ${COLORS.grid}`}}>{insight}</div>))}
                        </div>
                     </div>
                   )}
               </div>
          </div>
      )}

      {telemetryData && !loading && Object.keys(telemetryData.drivers).length > 0 && (
          <div className="dashboard-grid-telemetry">
              <div style={{display:'flex', flexDirection:'column', gap:'20px'}}>
                {isQualiSession && telemetryData.pole_info && (
                    <div style={{background: 'rgba(0, 243, 255, 0.05)', padding:'15px', borderRadius:'8px', border:`1px solid ${COLORS.neon}`, color: COLORS.neon, display:'flex', justifyContent:'center', alignItems:'center', textShadow: `0 0 10px rgba(0,243,255,0.3)`, marginBottom: '10px'}}>
                        🏆 <b>POLE POSITION:</b> &nbsp; {telemetryData.pole_info.driver} &nbsp; ({formatTime(telemetryData.pole_info.time)})
                    </div>
                )}

                <div style={styles.chartContainer}>
                    <div style={styles.headerStyle}><h5 style={styles.chartTitle}>DELTA TO {isRaceOrPractice ? 'FASTEST' : 'POLE'} (SEC)</h5><button onClick={() => deltaChartRef.current?.resetZoom()} style={styles.miniBtn}>⟲ Reset</button></div>
                    <div style={{height: '200px'}}><Line ref={deltaChartRef} data={deltaData} options={{...telemetryOptions, scales:{...telemetryOptions.scales, y:{reverse:true, grid:{color: COLORS.grid}}}}} plugins={[renderSectorPlugin()]} /></div>
                </div>
                <div style={styles.chartContainer}>
                    <div style={styles.headerStyle}><h5 style={styles.chartTitle}>SPEED (KM/H)</h5><button onClick={() => speedChartRef.current?.resetZoom()} style={styles.miniBtn}>⟲ Reset</button></div>
                    <div style={{height: '250px'}}><Line ref={speedChartRef} data={speedData} options={telemetryOptions} plugins={[renderSectorPlugin()]} /></div>
                </div>
                <div style={styles.chartContainer}>
                    <div style={styles.headerStyle}><h5 style={styles.chartTitle}>THROTTLE (%)</h5><button onClick={() => throttleChartRef.current?.resetZoom()} style={styles.miniBtn}>⟲ Reset</button></div>
                    <div style={{height: '200px'}}><Line ref={throttleChartRef} data={throttleData} options={pctTelemetryOptions} plugins={[renderSectorPlugin()]} /></div>
                </div>
                <div style={styles.chartContainer}>
                    <div style={styles.headerStyle}><h5 style={styles.chartTitle}>BRAKE PRESSURE (%)</h5><button onClick={() => brakeChartRef.current?.resetZoom()} style={styles.miniBtn}>⟲ Reset</button></div>
                    <div style={{height: '200px'}}><Line ref={brakeChartRef} data={brakeData} options={pctTelemetryOptions} plugins={[renderSectorPlugin()]} /></div>
                </div>
                <div className="charts-split">
                    <div style={styles.chartContainer}>
                        <div style={styles.headerStyle}><h5 style={styles.chartTitle}>RPM</h5><button onClick={() => rpmChartRef.current?.resetZoom()} style={styles.miniBtn}>⟲ Reset</button></div>
                        <div style={{height: '150px'}}><Line ref={rpmChartRef} data={rpmData} options={telemetryOptions} plugins={[renderSectorPlugin()]} /></div>
                    </div>
                    <div style={styles.chartContainer}>
                        <div style={styles.headerStyle}><h5 style={styles.chartTitle}>LONGITUDINAL G</h5><button onClick={() => longGChartRef.current?.resetZoom()} style={styles.miniBtn}>⟲ Reset</button></div>
                        <div style={{height: '150px'}}><Line ref={longGChartRef} data={longGData} options={telemetryOptions} plugins={[renderSectorPlugin()]} /></div>
                    </div>
                </div>
              </div>

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
                                        <div style={{fontFamily:'monospace', color:'white', fontSize:'1.1em'}}>{formatTime(dData.lap_time)} <span style={{color: delta===0? COLORS.neon : '#ffee00', fontSize:'0.7em', fontWeight:'bold'}}>{delta===0?'FASTEST':`+${delta.toFixed(3)}`}</span></div>
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
                {telemetryData.weather && <WeatherWidget weatherData={telemetryData.weather} />}
                <div style={{ ...styles.card, borderTop:`3px solid ${COLORS.primary}` }}>
                   <h3 style={styles.cardTitle}>🤖 AI Analysis</h3>
                   <div style={{fontSize: '0.85em', color: COLORS.textDim, lineHeight:'1.6'}}>
                     {telemetryData.ai_insights?.map((insight, idx) => (<div key={idx} style={{ marginBottom: '10px', paddingBottom:'10px', borderBottom: `1px solid ${COLORS.grid}` }}>{insight}</div>))}
                   </div>
                </div>
              </div>
          </div>
      )}
    </div>
  );
}

const styles = {
    topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(30, 30, 47, 0.7)', backdropFilter: 'blur(10px)', padding: '12px 25px', borderRadius: '12px', marginBottom: '30px', border: `1px solid ${COLORS.border}` },
    logoutBtn: { background: 'transparent', color: COLORS.textDim, border: `1px solid ${COLORS.border}`, padding: '6px 18px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8em', transition: '0.2s', fontWeight: '600' },
    controlsBar: { fontSize:'0.8em', color: COLORS.textDim, background: COLORS.card, padding:'8px 15px', borderRadius:'6px', border: `1px solid ${COLORS.border}` },
    select: { padding: '12px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, background: COLORS.card, color: 'white', fontWeight:'600', fontSize:'0.9em', cursor:'pointer', minWidth:'120px' },
    input: { padding: '12px', borderRadius: '8px', border: `1px solid ${COLORS.border}`, background: COLORS.card, color: 'white', fontWeight:'600', fontSize:'0.9em', width:'180px' },
    btnPrimary: { padding: '12px 25px', background: COLORS.primary, color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight:'700', fontSize:'0.9em', letterSpacing:'1px', boxShadow: `0 4px 15px rgba(255, 24, 1, 0.4)` },
    btnOutline: { padding: '12px 25px', background: 'transparent', color: COLORS.neon, border: `1px solid ${COLORS.neon}`, borderRadius: '8px', cursor: 'pointer', fontWeight:'700', fontSize:'0.9em', letterSpacing:'1px' },
    btnDisabled: { padding: '12px 25px', background: '#444', color: '#888', border: 'none', borderRadius: '8px', fontWeight:'700', fontSize:'0.9em' },
    card: { background: COLORS.card, padding: '25px', borderRadius: '16px', border: `1px solid ${COLORS.border}`, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' },
    cardTitle: { marginTop: 0, marginBottom: '20px', borderBottom: `1px solid ${COLORS.border}`, paddingBottom: '15px', fontSize: '0.9em', color: COLORS.textDim, textTransform: 'uppercase', letterSpacing: '1px' },
    chartContainer: { background: COLORS.card, padding: '20px', borderRadius: '16px', border: `1px solid ${COLORS.border}`, position: 'relative', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' },
    headerStyle: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px' },
    chartTitle: { margin:0, color: COLORS.textDim, fontSize:'0.8em', letterSpacing:'1px', textTransform:'uppercase' },
    miniBtn: { padding: '4px 10px', background: 'rgba(255,255,255,0.05)', color: COLORS.textDim, border: `1px solid ${COLORS.border}`, borderRadius: '4px', cursor: 'pointer', fontSize: '0.7em' },
    errorBanner: { padding: '15px', background: 'rgba(255, 0, 0, 0.1)', borderRadius: '8px', marginBottom: '20px', borderLeft: `4px solid ${COLORS.primary}`, color: '#ffaaaa' },
    mapButton: { width: '40px', height: '40px', borderRadius: '50%', background: '#1a1a2e', border: `1px solid ${COLORS.neon}`, cursor: 'pointer', overflow: 'hidden', boxShadow: '0 0 10px rgba(0, 243, 255, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2em' },
    tooltipAbove: { position: 'absolute', top: '-30px', whiteSpace: 'nowrap', background: 'rgba(0,0,0,0.8)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.7em', color: COLORS.neon, pointerEvents: 'none', opacity: 0, transition: 'opacity 0.2s', },
    floatingWidget: { position: 'fixed', width: '500px', background: 'rgba(20, 20, 35, 0.95)', border: `2px solid ${COLORS.neon}`, borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)', zIndex: 9999, backdropFilter: 'blur(10px)', animation: 'popIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)' },
    floatingHeader: { padding: '12px 15px', background: 'rgba(255,255,255,0.05)', borderBottom: `1px solid ${COLORS.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'move', color: COLORS.neon, fontWeight: 'bold', fontSize: '0.9em', letterSpacing: '1px' },
    closeBtn: { background: 'transparent', border:'none', color:'#888', fontSize:'1.2em', cursor:'pointer', padding:'0 5px' },
    
    // --- CHAMPIONSHIP MODAL STYLES ---
    modalOverlay: { position: 'fixed', top:0, left:0, width:'100vw', height:'100vh', background: 'rgba(0,0,0,0.8)', backdropFilter:'blur(8px)', zIndex: 10000, display:'flex', justifyContent:'center', alignItems:'center', animation: 'fadeIn 0.2s ease' },
    modalContent: { width: '90vw', height: '90vh', background: COLORS.bg, borderRadius: '20px', border: `1px solid ${COLORS.border}`, padding: '30px', display:'flex', flexDirection:'column' },
    modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: `1px solid ${COLORS.border}`, paddingBottom:'20px', flexShrink: 0 },
    
    // Standings (Static View)
    standingsContainer: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', height: '100%', overflow:'hidden', minHeight: 0 },
    scrollableCard: { background: COLORS.card, padding: '20px', borderRadius: '16px', border: `1px solid ${COLORS.border}`, overflowY: 'auto', maxHeight: '100%' }, 
    table: { width: '100%', borderCollapse: 'collapse', marginTop: '15px', fontSize:'0.9em' },
    
    // Predictor View
    predictorContainer: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '20px', height: '100%', minHeight:0 },
    
    // FIXED: Explicit scroll behavior for the predictor columns
    predGrid: { display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', flex: 1, paddingRight: '5px', paddingBottom: '20px' }, 
    
    predRow: { display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.03)', padding: '8px', borderRadius: '6px' },
    predSelect: { background: 'transparent', border: 'none', color: 'white', flex: 1, fontFamily:'inherit', cursor:'pointer' },
    colHeader: { color: COLORS.textDim, marginBottom: '15px', fontSize:'0.8em', borderBottom:`1px solid ${COLORS.border}`, paddingBottom:'5px' },
    
    // FIXED: Live Standings scrolling
    standingsList: { flex: 1, overflowY: 'auto', paddingRight: '5px', paddingBottom: '20px' }, 
    standingRow: { display: 'flex', justifyContent: 'space-between', padding: '10px', borderBottom: `1px solid ${COLORS.grid}`, fontSize:'0.9em' }
};

const styleSheet = document.createElement("style");
styleSheet.innerText = `
  .map-trigger:hover .tooltip-above { opacity: 1 !important; }
  
  /* Morphing Animations */
  @keyframes morphIn {
      from { transform: scale(0); opacity: 0; border-radius: 50%; }
      to { transform: scale(1); opacity: 1; border-radius: 12px; }
  }
  @keyframes morphOut {
      from { transform: scale(1); opacity: 1; border-radius: 12px; }
      to { transform: scale(0); opacity: 0; border-radius: 50%; }
  }
  
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); }
  ::-webkit-scrollbar-thumb { background: #333; borderRadius: 3px; }
`;
document.head.appendChild(styleSheet);

export default Dashboard;
