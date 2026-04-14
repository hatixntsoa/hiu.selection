# HIU Selection CTF Platform

A full-stack CTF platform with real-time scoring, admin controls, timer-based competition locking, themed multilingual UI, and spectator-ready live scoreboard.

## Current state (implemented)

- **Auth route/UI:** `/auth` (with `/login` redirect compatibility)
- **Credentials:** username + password only (no email in UI)
- **Team member model:** up to **6 members** can join the same team using the same team name/password
- **Admin account:** `admin / admin123` (or `ADMIN_PASSWORD` if set)
- **Dashboard navigation:** top tabs (Ranking, Scoreboard, Live Activity, Challenges)
- **Challenges UX:** click challenge card -> submit flag modal + confetti on correct flag
- **Live updates:** scoreboard/activity via Socket.IO
- **Themes:** system/light/dark with GitHub-style dark palette
- **Settings:** theme, language (EN/FR), font family
- **i18n:** UI text localized (EN/FR)
- **Admin features:** challenge CRUD, category management, CTF timer controls, teams list, live scoreboard view (with fullscreen button)
- **CTF timer controls (admin):** set duration, restart, add time, infinite mode
- **Timer enforcement:** non-admin submissions locked when timer is over
- **End state for teams:** when CTF ends, team users are redirected to an end page with team name, rank, and points

## Tech stack

### Backend
- Node.js + Express + TypeScript
- SQLite (`backend/ctf.db`)
- JWT auth
- bcrypt password hashing
- Socket.IO
- express-rate-limit

### Frontend
- React + TypeScript + Vite
- React Router
- React Bootstrap + custom theme CSS
- Axios
- Socket.IO client
- Chart.js (`react-chartjs-2`)
- `canvas-confetti`

## Project structure

```text
ctf/
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   └── server.ts
│   ├── Dockerfile
│   └── .dockerignore
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── i18n/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── Dockerfile
│   ├── nginx.conf
│   └── .dockerignore
├── INSTRUCTIONS.md
├── QUICKSTART.md
└── start.sh
```

## Local development

### 1. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Run backend

```bash
cd backend
npm start
```

Backend: `http://localhost:3001`

### 3. Run frontend

```bash
cd frontend
npm run dev
```

Frontend: `http://localhost:3000`

### Quick script

```bash
./start.sh
```

## Docker support

Both services now include Docker support:

- `backend/Dockerfile`
- `backend/.dockerignore`
- `frontend/Dockerfile`
- `frontend/.dockerignore`
- `frontend/nginx.conf` (SPA route fallback)

### Example `docker-compose.yml`

```yaml
services:
  backend:
    build:
      context: ./backend
    ports:
      - "3001:3001"
    environment:
      - PORT=3001
      - HOST=0.0.0.0
      - JWT_SECRET=change-me
      - ADMIN_PASSWORD=admin123
      - FRONTEND_URL=http://localhost:3000
    volumes:
      - ./backend/ctf.db:/app/ctf.db

  frontend:
    build:
      context: ./frontend
      args:
        VITE_API_URL: http://localhost:3001/api
    ports:
      - "3000:80"
    depends_on:
      - backend
```

### Run with Docker Compose

```bash
docker compose up --build
```

Then open:

- Frontend: `http://localhost:3000`
- Backend health: `http://localhost:3001/api/health`

## Main API routes

### Auth
- `POST /api/auth/register` (username + password)
- `POST /api/auth/login` (username + password)
- `GET /api/auth/me`

### Challenges
- `GET /api/challenges`
- `GET /api/challenges/:id`
- `GET /api/challenges/categories`
- `POST /api/challenges` (admin)
- `POST /api/challenges/categories` (admin)
- `PUT /api/challenges/:id` (admin)
- `DELETE /api/challenges/:id` (admin)

### Flags
- `POST /api/flags/submit`
- `GET /api/flags/history`

### Scoreboard + timer
- `GET /api/scoreboard`
- `GET /api/scoreboard/activity`
- `GET /api/scoreboard/stats`
- `GET /api/scoreboard/timer`
- `PUT /api/scoreboard/timer` (admin)
- `POST /api/scoreboard/timer/restart` (admin)
- `POST /api/scoreboard/timer/add-time` (admin)
- `POST /api/scoreboard/timer/infinite` (admin)

## Notes

- `0.0.0.0` is used for server binding; browser access should use `localhost` (or your host/IP), not `0.0.0.0`.
- Challenge display IDs are generated in the format `category#n` (e.g. `crypto#1`, `web#2`) based on sorted challenge order.
