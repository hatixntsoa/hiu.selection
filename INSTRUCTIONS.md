# CTF Platform - Build Instructions

## Overview
Build a Capture The Flag (CTF) platform that supports:
- Multiple teams with authentication
- Flag submission system
- Live scoring dashboard
- Challenge management
- Real-time score updates

## Tech Stack
- **Backend**: Node.js with Express.js
- **Frontend**: React with Bootstrap CSS
- **Database**: SQLite (lightweight, no setup required)
- **Real-time**: Socket.io for live dashboard updates
- **Authentication**: JWT-based auth system

## Architecture

### Backend Structure
```
backend/
├── src/
│   ├── controllers/
│   │   ├── auth.controller.js      # Team registration/login
│   │   ├── challenge.controller.js # Challenge CRUD operations
│   │   ├── flag.controller.js      # Flag submission & validation
│   │   └── scoreboard.controller.js # Score calculations
│   ├── models/
│   │   ├── database.js             # SQLite setup & schema
│   │   ├── team.model.js           # Team data operations
│   │   ├── challenge.model.js      # Challenge data operations
│   │   └── submission.model.js     # Flag submission tracking
│   ├── middleware/
│   │   ├── auth.middleware.js      # JWT verification
│   │   └── admin.middleware.js     # Admin-only routes
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── challenge.routes.js
│   │   ├── flag.routes.js
│   │   └── scoreboard.routes.js
│   └── server.js                   # Main entry point
├── package.json
└── .env                            # Environment variables
```

### Frontend Structure
```
frontend/
├── src/
│   ├── components/
│   │   ├── Auth/
│   │   │   ├── Login.jsx
│   │   │   └── Register.jsx
│   │   ├── Dashboard/
│   │   │   ├── Scoreboard.jsx
│   │   │   ├── TeamStats.jsx
│   │   │   └── LiveFeed.jsx
│   │   ├── Challenges/
│   │   │   ├── ChallengeList.jsx
│   │   │   ├── ChallengeCard.jsx
│   │   │   └── FlagSubmission.jsx
│   │   └── Admin/
│   │       ├── AdminPanel.jsx
│   │       └── ChallengeManager.jsx
│   ├── pages/
│   │   ├── HomePage.jsx
│   │   ├── DashboardPage.jsx
│   │   └── AdminPage.jsx
│   ├── services/
│   │   ├── api.js                  # Axios instance
│   │   └── socket.js               # Socket.io client
│   ├── context/
│   │   └── AuthContext.jsx         # Auth state management
│   ├── App.jsx
│   └── main.jsx
├── package.json
└── vite.config.js
```

## Database Schema

### Tables
1. **teams**
   - id (INTEGER PRIMARY KEY)
   - name (TEXT UNIQUE NOT NULL)
   - email (TEXT UNIQUE NOT NULL)
   - password (TEXT NOT NULL) - hashed
   - score (INTEGER DEFAULT 0)
   - created_at (DATETIME DEFAULT CURRENT_TIMESTAMP)

2. **challenges**
   - id (INTEGER PRIMARY KEY)
   - title (TEXT NOT NULL)
   - description (TEXT)
   - category (TEXT)
   - points (INTEGER NOT NULL)
   - flag (TEXT NOT NULL)
   - created_at (DATETIME DEFAULT CURRENT_TIMESTAMP)

3. **submissions**
   - id (INTEGER PRIMARY KEY)
   - team_id (INTEGER, FK -> teams.id)
   - challenge_id (INTEGER, FK -> challenges.id)
   - submitted_flag (TEXT)
   - is_correct (BOOLEAN)
   - submitted_at (DATETIME DEFAULT CURRENT_TIMESTAMP)

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new team
- `POST /api/auth/login` - Login team
- `GET /api/auth/me` - Get current team info

### Challenges
- `GET /api/challenges` - List all challenges (without flag)
- `POST /api/challenges` - Create challenge (admin only)
- `PUT /api/challenges/:id` - Update challenge (admin only)
- `DELETE /api/challenges/:id` - Delete challenge (admin only)

### Flag Submission
- `POST /api/flags/submit` - Submit a flag
- `GET /api/flags/history` - Get team's submission history

### Scoreboard
- `GET /api/scoreboard` - Get current rankings
- `GET /api/scoreboard/activity` - Get recent activity feed

## Features Implementation

### 1. Authentication System
- JWT-based authentication
- Password hashing with bcrypt
- Protected routes with middleware
- Team registration with validation

### 2. Flag Submission
- Case-insensitive flag comparison
- Prevent duplicate submissions
- Track submission history
- Real-time score updates via Socket.io

### 3. Live Dashboard
- Real-time scoreboard with Socket.io
- Auto-refresh on flag submissions
- Team rankings with points
- Activity feed showing recent solves

### 4. Admin Panel
- Create/edit/delete challenges
- View all team submissions
- Monitor CTF progress
- Reset scoreboard

### 5. Scoring System
- Dynamic point allocation
- First blood bonuses (optional)
- Score calculation per challenge
- Tiebreaker handling (earliest submission wins)

## Frontend Pages

### Public Pages
- **Home**: CTF info, rules, countdown
- **Login/Register**: Team authentication
- **Scoreboard**: Live rankings (public view)

### Authenticated Pages
- **Dashboard**: Team stats, submitted flags
- **Challenges**: Browse and submit flags
- **Profile**: Team info and history

### Admin Pages
- **Admin Panel**: Manage challenges
- **Analytics**: View statistics
- **Settings**: CTF configuration

## Setup Instructions

### Backend
1. Initialize Node.js project
2. Install dependencies: express, sqlite3, bcrypt, jsonwebtoken, socket.io, cors, dotenv
3. Setup database schema
4. Implement authentication
5. Create API routes
6. Add Socket.io for real-time updates

### Frontend
1. Create React app with Vite
2. Install dependencies: react, react-router-dom, axios, socket.io-client, bootstrap
3. Setup routing and auth context
4. Build components
5. Connect to backend API
6. Add real-time updates

## Security Considerations
- Rate limiting on flag submissions
- SQL injection prevention (parameterized queries)
- XSS protection
- CORS configuration
- Environment variable management
- Password strength requirements

## Running the Application
- Backend: `npm start` (port 3001)
- Frontend: `npm run dev` (port 3000)
- Database: Auto-created SQLite file
- Default admin credentials for setup
