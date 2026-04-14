# PROMPT FOR OTHER LLM / VIBE-CODING TOOLS

You are working on a full-stack CTF platform named **HIU Selection CTF Platform**.

Your task is to continue building and maintaining this exact product behavior and architecture.

## 1. Product goals

Build a polished CTF web app with:

- Team-based competition
- Real-time scoreboard/activity
- Admin management tools
- Timer-controlled competition lifecycle
- Spectator-friendly live scoreboard
- Modern themed UI with multilingual support

## 2. Tech stack and architecture

### Backend
- Node.js
- Express
- TypeScript
- SQLite database (`backend/ctf.db`)
- Socket.IO for real-time events
- JWT auth
- bcrypt for password hashing

### Frontend
- React 18 + TypeScript
- Vite
- React Router
- React Bootstrap + custom CSS theme
- Axios
- Socket.IO client
- Chart.js + react-chartjs-2
- canvas-confetti

## 3. Critical current behavior (must preserve)

### Authentication
- Auth page route is **`/auth`**.
- `/login` should redirect to `/auth`.
- Login and registration use **username + password only** (no email fields in UI).
- Admin credentials use username/password (`admin` + configured password).
- After login, admin users should land on **`/admin`** by default.
- Team registration can join existing team if username+password match.
- A team has a max of **6 members**.

### Home CTA routing
- "Login to Play" should open `/auth?tab=login`.
- "Register Team" should open `/auth?tab=register`.
- Auth page should open corresponding tab from query param.
- Navbar **Home** tab is removed for all users; clicking the HIU Selection brand title is the home navigation.

### Timer and locking
- CTF timer is global/shared across all users (DB-backed).
- Default timer duration is **120 minutes**.
- Timer does **not** auto-start; admin must explicitly start it.
- Only admin can change timer (set duration, start, restart, add time, set infinite).
- Setting duration updates the configured duration but keeps timer stopped until start.
- When timer ends:
  - team users (non-admin) are locked to an End of CTF page
  - challenges/submissions disabled
  - non-admin protected API actions blocked
  - admin remains unrestricted

### End page
- Big centered "END OF CTF" style page.
- Show team name, rank, points.

### Dashboard
- Top-level sections/tabs:
  - Ranking
  - Scoreboard
  - Live Activity
  - Challenges
- Challenge interaction:
  - click card opens modal for flag submit
  - correct flag triggers fullscreen confetti effect

### Admin panel
- Admin navigation includes:
  - Admin panel
  - Live Scoreboard route (`/admin/live-scoreboard`)
- Live Scoreboard:
  - top 3 podium bars
  - others listed below
  - header includes a CTF timer **pill** next to the "Live Scoreboard" title
  - fullscreen button that actually uses full viewport
- Challenge management:
  - challenge category must come from dropdown
  - category manager modal exists to create categories
  - dropdown must include default categories:
    - Web, Crypto, Reverse, Misc, SQL, Forensics

### Challenge ID display
- Display challenge code style by category sequence:
  - examples: `crypto#1`, `web#3`
- Codes are generated from category buckets over ordered challenges.

### Theme / i18n / settings
- Theme modes: system, light, dark.
- Dark palette should feel GitHub-like.
- Font options in settings.
- Language support: English + French.
- Localize UI text and API messages where mapped.

## 4. Backend data model expectations

Minimum tables and fields in use:

- `teams`: includes name, password hash, score, admin flag, and member count
- `categories`: challenge categories
- `challenges`: title, description, category, points, flag
- `submissions`: team/challenge submissions
- `ctf_timer`: single-row global timer state

## 5. API expectations

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
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
- `POST /api/scoreboard/timer/start` (admin)
- `POST /api/scoreboard/timer/restart` (admin)
- `POST /api/scoreboard/timer/add-time` (admin)
- `POST /api/scoreboard/timer/infinite` (admin)

## 6. Docker expectations

Project provides:
- `backend/Dockerfile` + `backend/.dockerignore`
- `frontend/Dockerfile` + `frontend/.dockerignore`
- frontend nginx SPA fallback config (`frontend/nginx.conf`)

Use these in `docker-compose.yml` for local stack execution.

## 7. Quality bar

- Keep TypeScript strict and passing build/typecheck.
- Keep behavior backward-compatible unless explicitly requested.
- Preserve current UX polish and dark-mode consistency.
- Keep admin-only controls secured with middleware and frontend guards.
- Do not remove existing real-time scoreboard functionality.

## 8. Common pitfalls to avoid

- Don’t use `0.0.0.0` as browser API URL target (bind server to it, but clients should use host/localhost).
- Don’t reintroduce email-based auth forms.
- Don’t make timer per-user; it must remain global.
- Don’t auto-start timer on duration save; start must stay explicit via admin action.
- Don’t break non-admin lock behavior after timer expiry.
- Don’t revert live scoreboard fullscreen to modal-like/floating appearance.
