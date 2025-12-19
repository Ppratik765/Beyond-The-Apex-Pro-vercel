# 🏎️ Beyond The Apex PRO

## Website Link
[(https://beyond-the-apex-pro.vercel.app/)
](https://beyond-the-apex-pro.vercel.app/)
## Project Screenshot
<img width="1889" height="878" alt="image" src="https://github.com/user-attachments/assets/c67931cc-9c32-482e-afda-a084d7ab3efc" />
<img width="1898" height="876" alt="image" src="https://github.com/user-attachments/assets/4fe9199f-b227-4852-ac18-84d020e8fdd6" />
<img width="1898" height="869" alt="image" src="https://github.com/user-attachments/assets/4f963b48-7184-447e-a44b-edab7c60057c" />
<img width="1893" height="879" alt="image" src="https://github.com/user-attachments/assets/f1f991c6-8808-4611-a330-7663c2799b03" />

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

# 🏗️ Architecture & Tech Stack

This project uses a **Hybrid Deployment Strategy** to handle heavy data processing while maintaining a fast, responsive UI.

### Frontend (Deployed on Vercel)
* **Framework:** React 18 (Vite)
* **Styling:** CSS / Tailwind
* **Visualization:** Chart.js & React-Chartjs-2
* **Networking:** Axios

### Backend (Deployed on Zeabur)
* **Framework:** FastAPI (Python 3.9)
* **Data Source:** [FastF1](https://github.com/theOehrly/Fast-F1) (Official F1 Live Timing Client wrapper)
* **Data Processing:** Pandas, NumPy, SciPy
* **Server:** Uvicorn (ASGI)

### ☁️ Deployment Strategy
Due to the large size of data science libraries (Pandas/NumPy ~300MB), the backend could not be hosted on Vercel Serverless functions.
* **Frontend:** Hosted on **Vercel** for global CDN and fast static asset delivery.
* **Backend:** Dockerized and hosted on **Zeabur**, providing a persistent environment for the Python API.

---

## 🛠️ Local Installation Guide

Follow these steps to run the project on your machine.

### Prerequisites
* Node.js (v16+)
* Python (v3.8+)
* Git

### 1. Clone the Repository
```bash
git clone https://github.com/Ppratik765/Beyond-The-Apex-Pro-vercel.git
cd Beyond-The-Apex-Pro-vercel
```

### 2. Backend Setup
The backend processes the F1 data.
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

* Authentication: User accounts to save favourite telemetry comparisons.
* Pro Tier: Paywall implementation for AI Insights and advanced G-Force analysis.
* Real-time Data: Integration with live timing feeds (pending API availability).
* 2026 Support: Automatic scaling for future seasons via dynamic calendar fetching
* Add WDC (Driver) & WCC (Constructor) Championship Standings tables.
* Authentication (Sign Up/Login).
* "My Garage": Save favourite drivers and teams for quick access
* AI Chatbot Race Engineer.

### ⚠️ Known Issues / Limitations
First Load Speed: Since the backend is hosted on a free-tier instance, it may "sleep" after inactivity. The first request might take 10-30 seconds to wake up. Subsequent requests will be fast.

Data Availability: The Data is retrieved from the FastF1 API. Detailed telemetry is usually available 30-60 minutes after a session ends.

### ⚖️ License & Acknowledgements
Data provided by the excellent FastF1 library.

This project is for educational and non-commercial purposes. F1 data rights belong to Formula One World Championship Limited.
