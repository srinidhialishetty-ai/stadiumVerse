# StadiumVerse

StadiumVerse is a crowd-aware stadium assistance system built to improve the physical event experience for attendees at large sporting venues. It helps people navigate intelligently, avoid congested concourses, reduce waiting times for amenities, and adapt to real-time venue conditions with clear rerouting guidance.

## Problem Statement

Large stadiums create friction during peak moments such as entry, halftime, and exit. Attendees often face bottlenecks at gates and concourses, long lines at food stands and restrooms, confusion while finding seating or amenities, and poor coordination when conditions change in real time.

## How StadiumVerse Solves It

- Computes crowd-aware routes using distance, congestion, and destination wait impact
- Recommends better food stands and restrooms using travel effort, queue time, and crowd density
- Simulates realistic venue phases such as Entry Rush, Early Event, Halftime Spike, and Exit Surge
- Pushes live updates over WebSocket for dynamic UI refresh and reroute prompts
- Supports accessible routing by preferring accessible edges and destinations
- Provides optional Gemini-powered navigation advice with a safe local fallback

## Architecture

- Frontend: React + Vite + React Three Fiber + Three.js
- Backend: FastAPI + WebSocket simulation loop
- Data: JSON stadium graph and simulated operational metadata
- Deployment: single Docker image for Google Cloud Run

## Features

- Crowd-aware navigation between gates, seating, amenities, and VIP
- Real-time congestion updates with event phase transitions
- Food and restroom recommendations that do not rely on wait time alone
- Accessible mode routing
- Guided route progression that runs once and stops at the destination
- Readable labels and consistent visual mappings by node type
- AI advice with Gemini when configured, local fallback otherwise

## Repository Structure

```text
backend/
  app/
    data/
    services/
  tests/
frontend/
  src/
Dockerfile
README.md
requirements.txt
```

## Local Setup

### Backend

```bash
python -m venv .venv
.venv\Scripts\activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m uvicorn backend.app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend expects the backend at `http://localhost:8000` during development.

Python 3.12+ is recommended locally. The included Docker deployment uses Python 3.12 for consistent Cloud Run behavior.

## Production Build

```bash
cd frontend
npm install
npm run build
cd ..
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
```

FastAPI serves `frontend/dist` automatically when the frontend is built.

## Environment Variables

- `GEMINI_API_KEY`: optional Gemini API key for short AI-generated advice
- `PORT`: Cloud Run port binding, defaults to `8000`

## Deployment To Cloud Run

1. Build the image:

```bash
gcloud builds submit --tag gcr.io/PROJECT_ID/stadiumverse
```

2. Deploy:

```bash
gcloud run deploy stadiumverse \
  --image gcr.io/PROJECT_ID/stadiumverse \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

3. Set optional Gemini key:

```bash
gcloud run services update stadiumverse \
  --set-env-vars GEMINI_API_KEY=your_key_here \
  --region us-central1
```

## Assumptions

- Congestion and wait data are simulated for demo readiness rather than sourced from venue telemetry
- The prototype focuses on a single stylized stadium model and one event timeline
- Accessible routing uses graph metadata and edge accessibility rather than detailed indoor mapping constraints
- Gemini advice is optional enhancement only; fallback messaging is always available
