# Smart Shepherd Admin Dashboard

Admin dashboard for monitoring Smart Shepherd IoT collars, telemetry, alerts, and operations.

## Prerequisites

- Node.js 18+
- npm 9+
- Optional: Docker and Docker Compose for containerized services

## Clone

```bash
git clone <your-repo-url>
cd Interface_Web_Admin
```

## Install Dependencies

Install frontend dependencies:

```bash
npm install
```

Install backend dependencies:

```bash
cd backend
npm install
cd ..
```

## Environment Variables

Create environment files from examples and set required variables.

Frontend (`.env`):

```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_MQTT_URL=ws://localhost:1883
VITE_MQTT_MODE=local
```

Backend (`backend/.env`):

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/smart_shepherd
JWT_SECRET=replace-with-a-strong-random-secret
REDIS_URL=redis://localhost:6379
```

Important: `JWT_SECRET` is required and the backend will fail to start if it is missing.

## Run in Development

Start frontend:

```bash
npm run dev
```

Start backend in another terminal:

```bash
cd backend
npm run dev
```

The frontend is typically available at `http://localhost:5173`.

## Scripts

- `npm run dev`: start Vite development server (frontend)
- `npm run build`: create production frontend build
- `npm run preview`: preview production frontend build
