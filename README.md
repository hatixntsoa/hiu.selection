# CTF Platform

A full-stack Capture The Flag (CTF) platform with real-time scoring, team authentication, and live dashboard.

## Features

✅ **Team Authentication** - Register and login with JWT-based auth  
✅ **Flag Submission** - Submit flags for multiple challenges  
✅ **Live Dashboard** - Real-time scoreboard with Socket.io  
✅ **Challenge Management** - Admin panel to create/edit/delete challenges  
✅ **Activity Feed** - Live feed showing recent flag captures  
✅ **Responsive UI** - Built with React and Bootstrap  

## Tech Stack

**Backend:**
- Node.js + Express.js
- SQLite (database)
- Socket.io (real-time updates)
- JWT + bcrypt (authentication)

**Frontend:**
- React 18
- Vite
- React Bootstrap
- Socket.io Client
- Axios

## Project Structure

```
ctf/
├── backend/                 # Backend API server
│   ├── src/
│   │   ├── controllers/    # Route controllers
│   │   ├── models/         # Database models
│   │   ├── middleware/     # Auth & admin middleware
│   │   ├── routes/         # API routes
│   │   └── server.js       # Main server file
│   ├── package.json
│   └── .env
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/          # Page components
│   │   ├── context/        # Auth context
│   │   ├── services/       # API & socket services
│   │   └── App.jsx
│   ├── package.json
│   └── vite.config.js
└── INSTRUCTIONS.md         # Build instructions
```

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm

### Installation

1. **Clone or navigate to the project:**
   ```bash
   cd /home/hatixntsoa/Desktop/c3lf/ctf
   ```

2. **Install backend dependencies:**
   ```bash
   cd backend
   npm install
   ```

3. **Install frontend dependencies:**
   ```bash
   cd ../frontend
   npm install
   ```

### Running the Application

#### Option 1: Run both servers (Development)

**Terminal 1 - Backend:**
```bash
cd backend
npm start
```
Backend runs on: `http://localhost:3001`

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```
Frontend runs on: `http://localhost:3000`

#### Option 2: Quick Start Script

Create a `start.sh` file:
```bash
#!/bin/bash

# Start backend
cd backend
npm start &
BACKEND_PID=$!

# Wait for backend to start
sleep 2

# Start frontend
cd ../frontend
npm run dev &
FRONTEND_PID=$!

# Handle cleanup on exit
trap "kill $BACKEND_PID $FRONTEND_PID" EXIT

# Wait for both
wait
```

Make it executable and run:
```bash
chmod +x start.sh
./start.sh
```

### Default Admin Credentials

- **Email:** `admin@ctf.local`
- **Password:** `admin123`

You can change the admin password in `backend/.env`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new team
- `POST /api/auth/login` - Login team
- `GET /api/auth/me` - Get current team info (requires auth)

### Challenges
- `GET /api/challenges` - List all challenges (public)
- `GET /api/challenges/:id` - Get challenge details
- `POST /api/challenges` - Create challenge (admin only)
- `PUT /api/challenges/:id` - Update challenge (admin only)
- `DELETE /api/challenges/:id` - Delete challenge (admin only)

### Flags
- `POST /api/flags/submit` - Submit a flag (rate limited)
- `GET /api/flags/history` - Get team's submission history

### Scoreboard
- `GET /api/scoreboard` - Get current rankings
- `GET /api/scoreboard/activity` - Get recent activity
- `GET /api/scoreboard/stats` - Get CTF statistics

## Flag Format

All flags follow the format: `flag{...}`

Flags are case-insensitive when submitted.

## Database

The platform uses SQLite for persistence. The database file (`ctf.db`) is automatically created in the `backend/` directory on first run.

### Sample Challenges

5 sample challenges are pre-loaded:
- Welcome (50 pts) - `flag{welcome_to_ctf}`
- Basic Crypto (100 pts) - `flag{caesar_encryption}`
- Web Basics (150 pts) - `flag{view_source_master}`
- Binary Explorer (200 pts) - `flag{binary_explorer_solved}`
- Database Dive (250 pts) - `flag{sql_master_2024}`

## Security Features

- ✅ JWT-based authentication
- ✅ Password hashing with bcrypt
- ✅ Rate limiting on flag submissions (30/min)
- ✅ Protected routes with middleware
- ✅ Admin-only routes
- ✅ SQL injection prevention (parameterized queries)
- ✅ CORS configuration

## Screenshots

### Home Page
Public landing page with CTF information and rules

### Dashboard
- Team statistics (points, solved challenges, rank)
- Challenge browsing with categories
- Flag submission form
- Live scoreboard
- Real-time activity feed

### Admin Panel
- Create/Edit/Delete challenges
- View all registered teams
- Monitor CTF progress

## Troubleshooting

### Backend won't start
- Check if port 3001 is already in use
- Ensure all dependencies are installed: `npm install`
- Check `backend/.env` configuration

### Frontend build errors
- Clear node_modules and reinstall: 
  ```bash
  rm -rf node_modules
  npm install
  ```
- Check Node.js version (v16+)

### Database issues
- Delete `ctf.db` to reset everything
- Database is auto-created on first run

## License

MIT

## Built With

- [Express.js](https://expressjs.com/) - Backend framework
- [React](https://react.dev/) - Frontend library
- [Socket.io](https://socket.io/) - Real-time communication
- [SQLite](https://www.sqlite.org/) - Database
- [Bootstrap](https://getbootstrap.com/) - UI framework
