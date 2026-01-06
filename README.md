# 🏎️ Beyond The Apex PRO
**Beyond The Apex** is a professional-grade Formula 1 telemetry analysis and visualisation platform. It allows users to dive deep into race data, compare driver performance, analyse tyre strategies, and predict championship outcomes using real-time and historical data. It features two modes: a Race Engineer Dashboard for long-run pace, tyre strategy and stint history, and a Telemetry Lab for analysing braking, throttle and corner speeds. An AI insights engine highlights where drivers gain time. It is a full-stack web application designed to visualise and analyse Formula 1 telemetry data.

## Website Link
```bash
PitWall.io
RaceControl.io
BoxBox.io
FullPush.io
PushPush.com
ApexLap.com
GridIQ.com
```
https://beyond-the-apex-pro.vercel.app

## Project Screenshot
<img width="1906" height="878" alt="Screenshot 2026-01-04 001456" src="https://github.com/user-attachments/assets/db0caaed-2bfc-486c-8d0f-0fe52d1ac414" />
<img width="1907" height="877" alt="image" src="https://github.com/user-attachments/assets/d3d10716-83c6-4051-ab4f-4d2095b430e7" />
<img width="1909" height="871" alt="image" src="https://github.com/user-attachments/assets/26048506-0471-4394-8149-ae3fbeadb4a0" />
<img width="1912" height="868" alt="image" src="https://github.com/user-attachments/assets/395be6f8-bc4e-4a00-9100-8cf4a57d2e03" />
<img width="1907" height="871" alt="image" src="https://github.com/user-attachments/assets/ac510b73-c1a5-421c-8614-f0484066fa04" />
<img width="1905" height="870" alt="image" src="https://github.com/user-attachments/assets/d6c43f64-df67-4394-826a-7274abb41263" />

## Features

### Race Strategy & Overview
* **Lap Time Distribution:** Jittered scatter plots to visualise pace consistency and outliers across the grid.
* **Tyre Strategy Visualisation:** a "Pit Wall" style bar chart showing tyre compounds (Soft, Medium, Hard, Inter, Wet), stint lengths, and pit stop sequences.
* **Session Context:** Automatically detects and displays the Race Winner, Sprint Winner, or Practice Session leader.
* **Degradation Insights:** AI-powered analysis of tyre wear and lap time degradation trends.
  
### Deep Dive Telemetry
* **Multi-Driver Comparison:** Select specific laps to compare trace data.
* **Telemetry Channels:**
    * Speed (km/h)
    * Throttle Application (%)
    * Brake Pressure (%)
    * Delta to Reference (sec)
    * RPM & Gear Usage
    * Longitudinal G-Force
* **Corner Analysis:** Interactive charts with zoom/pan capabilities to analyse braking points and cornering speeds.
* **Track Map:** Dynamic 3D-style track map with sector segmentation and driver position markers.
* **Sector Analysis:** Colour-coded sector times (Purple/Green/Yellow) relative to the session best.

### Championship Hub
* **Live Standings:** Real-time WDC (Driver) and WCC (Constructor) rankings.
* **Archive Access:** Browse historical standings from previous seasons (2021-Present).
* **Interactive Predictor:** * Predict race and sprint outcomes for the current season.
    * Dynamic point calculation updates the "Predicted Standings" in real-time.
    * Exclusive dropdown logic prevents duplicate driver selection.
 
### 🎨 Modern UI/UX
* **Cinematic Landing Page:** Immersive video background with glassmorphism design.
* **Responsive Dashboard:** Optimised for desktop, tablet, and mobile devices.
* **Animations:** Smooth transitions using Framer Motion (Morphing widgets, fade-ins).
* **Dark Mode:** Sleek, high-contrast dark theme optimised for data visualisation.

### 🤖 AI Race Engineer
* **Automated Insights:** The backend analyses telemetry deltas to generate natural language explanations (e.g., *"Verstappen brakes later into Turn 1 gains 0.15s"*).

### 🌦️ Live Conditions
- Real-time Track Temp, Air Temp, Humidity, and Rain status.

---

# 🏗️ Architecture & Tech Stack

This project uses a **Hybrid Deployment Strategy** to handle heavy data processing while maintaining a fast, responsive UI.

### Frontend (Deployed on Vercel)
* **Framework:** React (Vite)
* **Styling:** CSS3 (Variables, Glassmorphism, Flexbox/Grid)
* **Visualization:** Chart.js, React-Chartjs-2, Chartjs-Plugin-Zoom
* **Animation:** Framer Motion
* **Auth:** Supabase Auth Helpers
  
### Backend (Deployed on Zeabur)
* **Framework:** Python FastAPI
* **Data Processing:** Pandas, NumPy
* **F1 Data Source:** FastF1 (Ergast API integration)
* **Caching:** File-based caching for optimal performance

### ☁️ Deployment Strategy
Due to the large size of data science libraries (Pandas/NumPy ~300MB), the backend could not be hosted on Vercel Serverless functions.
* **Frontend:** Hosted on **Vercel** for global CDN and fast static asset delivery.
* **Backend:** Dockerized and hosted on **Zeabur**, providing a persistent environment for the Python API.

---

## Installation & Setup
Follow these steps to run the project on your machine.

### Prerequisites
* Node.js (v16+)
* Python (v3.9+)
* Supabase Account (for Authentication)

### 1. Clone the Repository
```bash
git clone [https://github.com/yourusername/beyond-the-apex.git](https://github.com/yourusername/beyond-the-apex.git)
cd beyond-the-apex
```

### 2. Backend Setup
Navigate to the backend directory and set up the Python environment.

```bash

# Navigate to backend folder
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn index:app --reload
```
The Backend will start at http://127.0.0.1:8000

### 3. Frontend Setup
Open a new terminal for the frontend.
```bash

# Navigate to frontend folder
cd frontend

# Install dependencies
npm install

# Run the development server
npm run dev
```

The Frontend will start at http://localhost:5173

Note: In frontend/src/App.jsx, ensure API_BASE points to http://localhost:8000 when running locally.

### 🗺️ Roadmap & Future Plans
I am actively working to turn this into a comprehensive F1 platform.

* "My Garage": Save favourite drivers and teams for quick access
* Real-time WebSocket Data: Live telemetry streaming during race sessions.
* Social Sharing: Share your predictions and lap analysis images.
* Setup Comparison: Compare car setups (Wing angles, suspension) where data permits.
* Apple Sign-In: Integration for iOS users

### ⚠️ Known Issues / Limitations
First Load Speed: Since the backend is hosted on a free-tier instance, it may "sleep" after inactivity. The first request might take 10-30 seconds to wake up. Subsequent requests will be fast.

Data Availability: The Data is retrieved from the FastF1 API. Detailed telemetry is usually available 30-60 minutes after a session ends.

### ⚖️ License & Acknowledgements
Data provided by the excellent FastF1 library.

This project is for educational and non-commercial purposes. F1 data rights belong to Formula One World Championship Limited.
<p align="center"> Built with ❤️ for F1 Fans. </p>
