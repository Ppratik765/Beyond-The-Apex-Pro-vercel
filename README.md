# 🏎️ Beyond The Apex PRO
Beyond The Apex PRO is an F1 telemetry and race strategy platform built on FastF1 for enthusiasts and data analysts. It features two modes: a Race Engineer Dashboard for long-run pace, tyre strategy and stint history, and a Telemetry Lab for analysing braking, throttle and corner speeds. An AI insights engine highlights where drivers gain time. It is a full-stack web application designed to visualise and analyse Formula 1 telemetry data. It bridges the gap between raw data and actionable race strategy insights, offering features like lap time distribution, tyre stint visualisation, and AI-generated driver comparisons.

## Project Screenshot
<img width="1891" height="941" alt="image" src="https://github.com/user-attachments/assets/c11f9165-d65b-44df-be05-858801adc1c9" />
<img width="1894" height="872" alt="image" src="https://github.com/user-attachments/assets/c2ab178b-441a-43ec-bc3f-5794f510119a" />
<img width="1896" height="872" alt="image" src="https://github.com/user-attachments/assets/b1e8eaea-6759-45a8-ba61-fb3091c826df" />
<img width="1897" height="871" alt="image" src="https://github.com/user-attachments/assets/42065596-3361-4632-8ac5-7846bc7c0586" />


## ✨ Features

### 🏁 Race Strategy & Overview
* **Lap Time Distribution:** Jittered scatter plots to visualise pace consistency and outliers across the grid.
* **Tyre Strategy Visualisation:** a "Pit Wall" style bar chart showing tyre compounds (Soft, Medium, Hard, Inter, Wet), stint lengths, and pit stop sequences.
* **Session Context:** Automatically detects and displays the Race Winner, Sprint Winner, or Practice Session leader.
* **Weather Widget:** Real-time (historical) track temp, air temp, humidity, and rainfall status.

### 📊 Deep Dive Telemetry
* **Multi-Driver Comparison:** Select specific laps to compare trace data.
* **Telemetry Channels:**
    * Speed (km/h)
    * Throttle Application (%)
    * Brake Pressure (%)
    * Delta to Reference (sec)
    * RPM & Gear Usage
    * Longitudinal G-Force
* **Sector Analysis:** Color-coded sector times (Purple/Green/Yellow) relative to the session best.

### 🤖 AI Race Engineer
* **Automated Insights:** The backend analyzes telemetry deltas to generate natural language explanations (e.g., *"Verstappen brakes later into Turn 1 gains 0.15s"*).

### 🌦️ Live Conditions
- Real-time Track Temp, Air Temp, Humidity, and Rain status.

---

## 🛠️ Tech Stack

### Frontend
* **React.js** (Vite)
* **Chart.js** & **React-Chartjs-2** (Data Visualization)
* **Chartjs-plugin-zoom** (Interactive panning/zooming)
* **Axios** (API Communication)

### Backend
* **Python 3.10+**
* **FastAPI** (High-performance API framework)
* **FastF1** (F1 Data gathering and signal processing)
* **Pandas & NumPy** (Data manipulation and interpolation)

---

## 🚀 Getting Started

### Prerequisites
* Node.js (v16+)
* Python (v3.9+)

### 1. Backend Setup

The backend handles data fetching, caching, and mathematical processing.

```bash
# Navigate to backend directory
cd backend

# Create a virtual environment (Optional but recommended)
python -m venv venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the API server
uvicorn api:app --reload --host 0.0.0.0 --port 8000
```
The backend will be available at http://localhost:8000.

## 2. Frontend Setup
The frontend is the visual dashboard.


```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Create environment file (Optional for local dev, required for prod)
# Create a file named .env.local
echo "VITE_API_URL=http://localhost:8000" > .env.local

# Run the development server
npm run dev
```
The frontend will generally start at http://localhost:5173.

### 🔮 Future Roadmap
-Authentication: User accounts to save favorite telemetry comparisons.

-Pro Tier: Paywall implementation for AI Insights and advanced G-Force analysis.

-Real-time Data: Integration with live timing feeds (pending API availability).

-2026 Support: Automatic scaling for future seasons via dynamic calendar fetching

### ⚖️ License & Acknowledgements
Data provided by the excellent FastF1 library.

This project is for educational and non-commercial purposes. F1 data rights belong to Formula One World Championship Limited.
