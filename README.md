# StadiumVerse — Smart Crowd Navigation & Experience Platform

Live Demo: https://stadiumverse-1094925083449.asia-south1.run.app  

---

## Overview

StadiumVerse is a crowd navigation and experience platform designed to improve movement and decision-making inside large venues such as stadiums.

It combines real-time simulation, graph-based routing, and intelligent recommendations to provide users with efficient navigation and contextual suggestions.

---

## Features

### Smart Route Navigation
- Computes shortest paths between locations  
- Supports accessibility-aware routing  

### Real-Time Simulation
- Continuously updates crowd conditions  
- Routes adapt dynamically based on simulation  

### Location-Based Recommendations
- Suggests nearby food stalls and restrooms  
- Considers user location and accessibility preferences  

### AI-Based Advice System
- Generates structured recommendations for users  
- Enhances in-venue decision making  

### Live Updates
- WebSocket-based streaming for real-time data  
- Keeps frontend synchronized with backend state  

### Full Stack Integration
- Backend serves both API and frontend assets  
- Seamless deployment as a single service  

---

## Tech Stack

**Backend**
- FastAPI  
- WebSockets  
- Graph-based routing logic  
- Custom simulation engine  

**Frontend**
- Vite  

**Deployment**
- Docker (multi-stage build)  
- Google Cloud Run  
- Cloud Build (CI/CD)  

---

## Project Structure

StadiumVerse/
│
├── backend/  
│   ├── app/  
│   │   ├── main.py  
│   │   ├── models/  
│   │   └── services/  
│   │       ├── routing.py  
│   │       ├── simulation.py  
│   │       └── advice.py  
│
├── frontend/  
│   ├── src/  
│   └── dist/  
│
├── Dockerfile  
├── requirements.txt  
└── README.md  

---

## Local Setup

### Clone the repository
git clone https://github.com/srinidhialishetty-ai/stadiumVerse.git  
cd stadiumVerse  

### Backend
pip install -r requirements.txt  
uvicorn backend.app.main:app --reload  

### Frontend
cd frontend  
npm install  
npm run dev  

---

## Docker

docker build -t stadiumverse .  
docker run -p 8080:8080 stadiumverse  

---

## Deployment

- Deployed on Google Cloud Run  
- Automated builds using Cloud Build  
- Multi-stage Docker build for optimized deployment  

---

## Problem Statement

Large venues often lack efficient navigation systems, leading to congestion and poor user experience.

This project addresses:
- Inefficient movement inside venues  
- Lack of real-time routing  
- Limited contextual assistance for users  

---

## Future Scope

- Mobile application support  
- Crowd density heatmaps  
- Advanced AI-based recommendations  
- Multi-venue scalability  

---

## Author

Srinidhi Alishetty  

---
