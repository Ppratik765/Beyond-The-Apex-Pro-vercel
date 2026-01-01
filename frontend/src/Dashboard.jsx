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
    s1: '#ffe119', // Yellow
    s2: '#00f3ff', // Cyan
    s3: '#ff004d'  // Red
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
    const m = Math.floor(s / 60);
    const sc = Math.floor(s % 60);
    const ms = Math.round((s % 1) * 1000);
    return `${m}:${sc.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
};

const getSectorColor = (val, best) => (val <= best + 0.001 ? COLORS.neon : '#666');
const getTyreColor = (c) => TYRE_COLORS[c] || TYRE_COLORS['UNKNOWN'];

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
    const [raceInsights, setRaceInsights] = useState([]);

    const [selectedLaps, setSelectedLaps] = useState([]);
    const [hoverIndex, setHoverIndex] = useState(null);

    // Track Map State
    const [isMapExpanded, setIsMapExpanded] = useState(false);
    const [mapSize, setMapSize] = useState({ width: 500, height: 480 });
    const [mapPosition, setMapPosition] = useState({ x: 0, y: 0 });
    const widgetRef = useRef(null);
    const isDragging = useRef(false);
    const dragOffset = useRef({ x: 0, y: 0 });

    // Refs
    const deltaChartRef = useRef(null);
    const speedChartRef = useRef(null);
    const throttleChartRef = useRef(null);
    const brakeChartRef = useRef(null);
    const rpmChartRef = useRef(null);
    const longGChartRef = useRef(null);
    const distributionChartRef = useRef(null);

    const API_BASE = import.meta.env.VITE_API_URL || 'https://f1-backend.zeabur.app';

    useEffect(() => {
        setTelemetryData(null); setRaceLapData(null); setStintData(null);
        setRaceWinner(null); setRaceWeather(null); setSelectedLaps([]);
        setRaceInsights([]); setHoverIndex(null); setIsMapExpanded(false);
    }, [inputs.race, inputs.session]);

    useEffect(() => {
        axios.get(`${API_BASE}/years`).then(res => {
            setYears(res.data.years);
            if (res.data.years.length > 0) setInputs(prev => ({ ...prev, year: res.data.years[res.data.years.length - 1] }));
        });
    }, []);

    useEffect(() => {
        if (inputs.year) {
            axios.get(`${API_BASE}/races?year=${inputs.year}`).then(res => {
                setRaces(res.data.races);
                setInputs(prev => ({ ...prev, race: res.data.races[0] || '', session: '' }));
            });
        }
    }, [inputs.year]);

    useEffect(() => {
        if (inputs.year && inputs.race) {
            axios.get(`${API_BASE}/sessions?year=${inputs.year}&race=${inputs.race}`).then(res => {
                setSessions(res.data.sessions);
                const def = res.data.sessions.find(s => s.includes('Qualifying')) || res.data.sessions[0] || '';
                setInputs(prev => ({ ...prev, session: def }));
            });
        }
    }, [inputs.year, inputs.race]);

    const isQualiSession = inputs.session && (inputs.session.includes('Qualifying') || inputs.session.includes('Sprint Qualifying'));
    const isRaceOrPractice = inputs.session && !isQualiSession;

    const fetchRaceOverview = async () => {
        if (!inputs.race || !inputs.session) return;
        setLoading(true); setError(null);
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
            if (lapsToFetch && lapsToFetch.length > 0) {
                params.specific_laps = JSON.stringify(lapsToFetch);
            } else if (isRaceOrPractice) {
                setLoading(false); return;
            }
            const res = await axios.get(`${API_BASE}/analyze`, { params: params });
            if (res.data.status === 'error') throw new Error(res.data.message);
            setTelemetryData(res.data.data);
            if (!raceLapData) setActiveDrivers(inputs.drivers.split(',').map(d => d.trim().toUpperCase()));
        } catch (err) { setError(err.message || "Failed to fetch telemetry."); }
        setLoading(false);
    };

    const handleMainAction = () => {
        if (isRaceOrPractice) fetchRaceOverview();
        else fetchDetailedTelemetry();
    };

    // --- CHART DATA MEMOIZATION (Fixes Zoom Bug) ---
    const getDatasets = (metric) => {
        if (!telemetryData) return [];
        return Object.keys(telemetryData.drivers).map((key, idx) => ({
            label: key,
            data: telemetryData.drivers[key]?.telemetry[metric] || [],
            borderColor: DRIVER_COLORS[idx % DRIVER_COLORS.length],
            borderWidth: 2, pointRadius: 0, hoverBorderWidth: 3
        }));
    };

    const telemetryLabels = useMemo(() => {
        if (!telemetryData) return [];
        const firstDriver = Object.keys(telemetryData.drivers)[0];
        return telemetryData.drivers[firstDriver].telemetry.distance.map(d => Math.round(d));
    }, [telemetryData]);

    const chartData = useMemo(() => ({
        speed: { labels: telemetryLabels, datasets: getDatasets('speed') },
        throttle: { labels: telemetryLabels, datasets: getDatasets('throttle') },
        brake: { labels: telemetryLabels, datasets: getDatasets('brake') },
        rpm: { labels: telemetryLabels, datasets: getDatasets('rpm') },
        longG: { labels: telemetryLabels, datasets: getDatasets('long_g') },
        delta: { labels: telemetryLabels, datasets: getDatasets('delta_to_pole') }
    }), [telemetryData, telemetryLabels]);

    const raceDistributionData = useMemo(() => {
        if (!raceLapData || !activeDrivers.length) return { datasets: [] };
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
            let newSelection = [...selectedLaps];
            const exists = newSelection.find(s => s.driver === driver && s.lap === lap_number);
            if (exists) newSelection = newSelection.filter(s => !(s.driver === driver && s.lap === lap_number));
            else newSelection.push({ driver, lap: lap_number });
            setSelectedLaps(newSelection);
            if (newSelection.length > 0) fetchDetailedTelemetry(newSelection);
            else setTelemetryData(null);
        }
    };

    const resetAllCharts = () => {
        [deltaChartRef, speedChartRef, throttleChartRef, brakeChartRef, rpmChartRef, longGChartRef].forEach(ref => { if (ref.current) ref.current.resetZoom(); });
    };

    // --- CHART OPTIONS ---
    const commonOptions = {
        animation: { duration: 0 }, // Crucial for zoom stability
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        onHover: (e, elements) => {
            if (elements && elements.length > 0) setHoverIndex(elements[0].index);
            else setHoverIndex(null);
        },
        plugins: {
            legend: { display: false },
            zoom: {
                zoom: { drag: { enabled: true, backgroundColor: 'rgba(0, 243, 255, 0.2)', borderColor: COLORS.neon, borderWidth: 1 }, mode: 'x' },
                pan: { enabled: true, mode: 'x', modifierKey: 'shift' }
            }
        },
        scales: {
            x: { type: 'linear', ticks: { color: '#888', font: { family: '"Titillium Web"' } }, grid: { color: COLORS.grid } },
            y: { ticks: { color: '#888', font: { family: '"Titillium Web"' } }, grid: { color: COLORS.grid } }
        }
    };

    const distributionOptions = {
        animation: false, maintainAspectRatio: false, onClick: handleDistributionClick,
        plugins: {
            legend: { display: false }, zoom: false,
            tooltip: {
                backgroundColor: 'rgba(20, 20, 30, 0.9)',
                titleColor: COLORS.neon,
                callbacks: { label: (ctx) => `${ctx.raw.rawLapData.driver} L${ctx.raw.rawLapData.lap_number}: ${formatTime(ctx.raw.rawLapData.lap_time_seconds)} (${ctx.raw.rawLapData.compound})` }
            }
        },
        scales: {
            x: {
                type: 'linear',
                ticks: {
                    color: 'white', font: { size: 14, weight: 'bold' },
                    stepSize: 1, callback: (val) => activeDrivers[Math.round(val)] || ''
                },
                grid: { display: false }, min: -0.5, max: activeDrivers.length - 0.5
            },
            y: { ticks: { color: '#888', callback: (val) => formatTime(val), stepSize: 0.1 }, grid: { color: COLORS.grid } }
        }
    };

    const getTrackMapData = () => {
        if (!telemetryData) return { datasets: [] };
        const driverKey = Object.keys(telemetryData.drivers)[0];
        const t = telemetryData.drivers[driverKey].telemetry;
        const totalLen = telemetryData.track_length;
        const s1End = totalLen * 0.33; const s2End = totalLen * 0.66;
        const s1 = [], s2 = [], s3 = [];
        t.distance.forEach((d, i) => {
            const pt = { x: t.x[i], y: t.y[i] };
            if (d <= s1End) s1.push(pt);
            if (d >= s1End && d <= s2End) s2.push(pt);
            else if (i > 0 && t.distance[i - 1] < s1End && d > s1End) s2.push(pt);
            if (d >= s2End) s3.push(pt);
            else if (i > 0 && t.distance[i - 1] < s2End && d > s2End) s3.push(pt);
        });
        const datasets = [
            { label: 'S1', data: s1, borderColor: COLORS.s1, borderWidth: isMapExpanded ? 5 : 4, pointRadius: 0, showLine: true },
            { label: 'S2', data: s2, borderColor: COLORS.s2, borderWidth: isMapExpanded ? 5 : 4, pointRadius: 0, showLine: true },
            { label: 'S3', data: s3, borderColor: COLORS.s3, borderWidth: isMapExpanded ? 5 : 4, pointRadius: 0, showLine: true },
        ];
        if (hoverIndex !== null && t.x[hoverIndex]) {
            datasets.push({
                data: [{ x: t.x[hoverIndex], y: t.y[hoverIndex] }],
                backgroundColor: 'white', borderColor: 'black', borderWidth: 2, pointRadius: isMapExpanded ? 10 : 6,
            });
        }
        return { datasets };
    };

    const trackMapOptions = {
        animation: false, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: { x: { display: false }, y: { display: false } }
    };

    const renderSectorPlugin = () => ({
        id: 'sectorLines',
        beforeDraw: (chart) => {
            if (!telemetryData || !telemetryData.track_length) return;
            const s1 = telemetryData.track_length * 0.33; const s2 = telemetryData.track_length * 0.66;
            const ctx = chart.ctx; const xAxis = chart.scales.x; const yAxis = chart.scales.y;
            const drawLine = (val, label) => {
                const x = xAxis.getPixelForValue(val);
                if (x < xAxis.left || x > xAxis.right) return;
                ctx.save(); ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'; ctx.setLineDash([5, 5]);
                ctx.beginPath(); ctx.moveTo(x, yAxis.top); ctx.lineTo(x, yAxis.bottom); ctx.stroke();
                ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillText(label, x + 5, yAxis.top + 10); ctx.restore();
            };
            drawLine(s1, "S1"); drawLine(s2, "S2");
        }
    });

    const toggleMapExpand = () => {
        if (!isMapExpanded) {
            setMapPosition({ x: window.innerWidth - 550, y: 120 });
        }
        setIsMapExpanded(!isMapExpanded);
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
        if (widgetRef.current) {
            setMapSize({ width: widgetRef.current.offsetWidth, height: widgetRef.current.offsetHeight });
        }
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    };

    return (
        <div style={{ padding: '20px', background: COLORS.bg, color: COLORS.text, minHeight: '100vh' }}>

            {/* FLOATING RESIZABLE TRACK MAP */}
            {isMapExpanded && telemetryData && (
                <div
                    ref={widgetRef}
                    style={{
                        ...styles.floatingWidget,
                        left: mapPosition.x, top: mapPosition.y,
                        width: `${mapSize.width}px`, height: `${mapSize.height}px`,
                        resize: 'both', overflow: 'hidden'
                    }}
                >
                    <div style={styles.floatingHeader} onMouseDown={handleMouseDown}>
                        <span>📍 TRACK MAP</span>
                        <button onClick={toggleMapExpand} style={styles.closeBtn}>✕</button>
                    </div>
                    <div style={{ height: 'calc(100% - 50px)', padding: '10px' }}>
                        <Scatter data={getTrackMapData()} options={trackMapOptions} />
                    </div>
                </div>
            )}

            {/* HEADER */}
            <div style={styles.topBar}>
                <span>Logged in as: <b style={{ color: COLORS.neon }}>{session?.user?.email}</b></span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    {telemetryData && !isMapExpanded && (
                        <div style={{ position: 'relative' }} onClick={toggleMapExpand} className="map-trigger">
                            <div style={styles.tooltipAbove}>CLICK TO EXPAND</div>
                            <div style={styles.mapButton}>
                                <Scatter data={getTrackMapData()} options={{ ...trackMapOptions, animation: false }} />
                            </div>
                        </div>
                    )}
                    <button onClick={handleLogout} style={styles.logoutBtn}>Log Out</button>
                </div>
            </div>

            {/* CONTROLS */}
            <div className="dashboard-controls" style={{ display: 'flex', gap: '10px', marginBottom: '25px' }}>
                <select value={inputs.year} onChange={e => setInputs(p => ({ ...p, year: e.target.value }))} style={styles.select}>{years.map(y => <option key={y} value={y}>{y}</option>)}</select>
                <select value={inputs.race} onChange={e => setInputs(p => ({ ...p, race: e.target.value }))} style={styles.select}>{races.map(r => <option key={r} value={r}>{r}</option>)}</select>
                <select value={inputs.session} onChange={e => setInputs(p => ({ ...p, session: e.target.value }))} style={styles.select}>{sessions.map(s => <option key={s} value={s}>{s}</option>)}</select>
                <input value={inputs.drivers} onChange={e => setInputs({ ...inputs, drivers: e.target.value })} style={styles.input} />
                <button onClick={handleMainAction} disabled={loading} style={styles.btnPrimary}>{loading ? 'LOADING...' : 'ANALYZE'}</button>
            </div>

            {/* RACE OVERVIEW */}
            {isRaceOrPractice && raceLapData && !loading && (
                <div className="dashboard-grid-race" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
                    <div style={{ ...styles.card, display: 'flex', flexDirection: 'column', height: '600px' }}>
                        <h4 style={styles.cardTitle}>LAP TIME DISTRIBUTION</h4>
                        <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
                            <Scatter ref={distributionChartRef} options={distributionOptions} data={raceDistributionData} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={styles.card}>
                            <h4 style={styles.cardTitle}>{raceWinner?.label}</h4>
                            <div style={{ fontSize: '1.5em', fontWeight: '800' }}>{raceWinner?.name}</div>
                        </div>
                        <div style={styles.card}>
                            <h4 style={styles.cardTitle}>TYRE STRATEGY</h4>
                            {stintData && activeDrivers.map(d => (
                                <div key={d} style={{ marginBottom: '15px' }}>
                                    <div style={{ fontWeight: 'bold' }}>{d}</div>
                                    <div style={{ display: 'flex', height: '20px', background: '#111', borderRadius: '4px', overflow: 'hidden' }}>
                                        {stintData[d]?.map((stint, i) => (
                                            <div key={i} style={{ flex: stint.end - stint.start + 1, backgroundColor: getTyreColor(stint.compound), borderRight: '1px solid #1a1a1a' }}></div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                        {raceInsights.length > 0 && (
                            <div style={styles.card}>
                                <h4 style={styles.cardTitle}>🤖 Tyre Deg Insights</h4>
                                {raceInsights.map((insight, i) => <div key={i} style={{ fontSize: '0.85em', marginBottom: '5px' }}>• {insight}</div>)}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* DETAILED TELEMETRY */}
            {telemetryData && !loading && (
                <div className="dashboard-grid-telemetry" style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr', gap: '20px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={styles.chartContainer}>
                            <h5 style={styles.chartTitle}>DELTA (SEC)</h5>
                            <div style={{ height: '180px' }}><Line ref={deltaChartRef} data={chartData.delta} options={{ ...commonOptions, scales: { ...commonOptions.scales, y: { reverse: true } } }} plugins={[renderSectorPlugin()]} /></div>
                        </div>
                        <div style={styles.chartContainer}>
                            <h5 style={styles.chartTitle}>SPEED (KM/H)</h5>
                            <div style={{ height: '220px' }}><Line ref={speedChartRef} data={chartData.speed} options={commonOptions} plugins={[renderSectorPlugin()]} /></div>
                        </div>
                        <div style={styles.chartContainer}>
                            <h5 style={styles.chartTitle}>THROTTLE (%)</h5>
                            <div style={{ height: '180px' }}><Line ref={throttleChartRef} data={chartData.throttle} options={commonOptions} plugins={[renderSectorPlugin()]} /></div>
                        </div>
                        <div style={styles.chartContainer}>
                            <h5 style={styles.chartTitle}>BRAKE (%)</h5>
                            <div style={{ height: '180px' }}><Line ref={brakeChartRef} data={chartData.brake} options={commonOptions} plugins={[renderSectorPlugin()]} /></div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div style={styles.chartContainer}>
                                <h5 style={styles.chartTitle}>RPM</h5>
                                <div style={{ height: '150px' }}><Line ref={rpmChartRef} data={chartData.rpm} options={commonOptions} plugins={[renderSectorPlugin()]} /></div>
                            </div>
                            <div style={styles.chartContainer}>
                                <h5 style={styles.chartTitle}>LONG G</h5>
                                <div style={{ height: '150px' }}><Line ref={longGChartRef} data={chartData.longG} options={commonOptions} plugins={[renderSectorPlugin()]} /></div>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={styles.card}>
                            <h4 style={styles.cardTitle}>⏱️ Lap Data</h4>
                            {Object.keys(telemetryData.drivers).map(key => (
                                <div key={key} style={{ marginBottom: '10px' }}>
                                    <b>{key}</b>: {formatTime(telemetryData.drivers[key].lap_time)}
                                </div>
                            ))}
                        </div>
                        {telemetryData.weather && (
                            <div style={styles.card}>
                                <h4 style={styles.cardTitle}>⛅ Weather</h4>
                                <div>Air: {telemetryData.weather.air_temp}°C</div>
                                <div>Track: {telemetryData.weather.track_temp}°C</div>
                            </div>
                        )}
                        <div style={styles.card}>
                            <h4 style={styles.cardTitle}>🤖 AI Analysis</h4>
                            {telemetryData.ai_insights?.map((insight, idx) => <div key={idx} style={{ fontSize: '0.85em', marginBottom: '8px' }}>• {insight}</div>)}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const styles = {
    topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(30, 30, 47, 0.7)', padding: '12px 25px', borderRadius: '12px', marginBottom: '30px', border: `1px solid ${COLORS.border}` },
    logoutBtn: { background: 'transparent', color: COLORS.textDim, border: `1px solid ${COLORS.border}`, padding: '6px 18px', borderRadius: '6px', cursor: 'pointer' },
    select: { padding: '10px', borderRadius: '8px', background: COLORS.card, color: 'white', border: `1px solid ${COLORS.border}` },
    input: { padding: '10px', borderRadius: '8px', background: COLORS.card, color: 'white', border: `1px solid ${COLORS.border}` },
    btnPrimary: { padding: '10px 20px', background: COLORS.primary, color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold' },
    card: { background: COLORS.card, padding: '20px', borderRadius: '16px', border: `1px solid ${COLORS.border}` },
    cardTitle: { fontSize: '0.8em', color: COLORS.textDim, textTransform: 'uppercase', marginBottom: '15px', borderBottom: `1px solid ${COLORS.border}`, paddingBottom: '10px' },
    chartContainer: { background: COLORS.card, padding: '15px', borderRadius: '16px', border: `1px solid ${COLORS.border}` },
    chartTitle: { margin: '0 0 10px 0', fontSize: '0.75em', color: COLORS.textDim },
    mapButton: { width: '40px', height: '40px', borderRadius: '50%', background: '#1a1a2e', border: `1px solid ${COLORS.neon}`, cursor: 'pointer', overflow: 'hidden' },
    tooltipAbove: { position: 'absolute', top: '-30px', background: 'black', color: COLORS.neon, padding: '4px', fontSize: '0.6em', whiteSpace: 'nowrap' },
    floatingWidget: { position: 'fixed', background: 'rgba(20, 20, 35, 0.95)', border: `2px solid ${COLORS.neon}`, borderRadius: '12px', zIndex: 9999 },
    floatingHeader: { padding: '10px', background: 'rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', cursor: 'move' },
    closeBtn: { background: 'transparent', border: 'none', color: '#888', cursor: 'pointer' }
};

export default Dashboard;
