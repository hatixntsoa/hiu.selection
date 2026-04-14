# Quick Start Guide

## 🚀 Run the CTF Platform

### Option 1: Using the Start Script (Recommended)
```bash
./start.sh
```

### Option 2: Manual Start

**Terminal 1 - Backend:**
```bash
cd backend
npm start
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

## 🌐 Access the Application

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:3001
- **API Health Check:** http://localhost:3001/api/health

## 🔐 Admin Login

- **Username:** `admin`
- **Password:** generated on first backend start
- Check backend logs for: `Admin credentials: admin / <generated-password>`

## 🎮 How to Use

1. **Register a Team:**
   - Go to http://localhost:3000
   - Click "Login to Play" or "Register Team"
   - Switch to "Register" tab
   - Enter team name and password
   - Click "Register"

2. **Browse Challenges:**
   - After login, you'll see the Dashboard
   - View available challenges with categories and points

3. **Submit Flags:**
   - Click on a challenge to select it
   - Enter the flag in the submission form
   - Click "Submit Flag"
   - Score updates immediately!

4. **View Live Scoreboard:**
   - The scoreboard updates in real-time
   - Watch other teams' activity in the live feed

5. **Admin Panel:**
   - Login with admin credentials
   - Create, edit, or delete challenges
   - Monitor all teams

## 🚩 Sample Challenge Flags

| Challenge | Points | Flag |
|-----------|--------|------|
| Welcome | 50 | `HIU_2026{welcome_to_ctf}` |
| Basic Crypto | 100 | `HIU_2026{caesar_encryption}` |
| Web Basics | 150 | `HIU_2026{view_source_master}` |
| Binary Explorer | 200 | `HIU_2026{binary_explorer_solved}` |
| Database Dive | 250 | `HIU_2026{sql_master_2024}` |

## 🛠️ Testing the API

```bash
# Health check
curl http://localhost:3001/api/health

# Get challenges
curl http://localhost:3001/api/challenges

# Register a team
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"MyTeam","password":"password123"}'

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"name":"MyTeam","password":"password123"}'

# Submit a flag (use token from login)
curl -X POST http://localhost:3001/api/flags/submit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"challengeId":1,"flag":"HIU_2026{welcome_to_ctf}"}'

# View scoreboard
curl http://localhost:3001/api/scoreboard
```

## 📝 Project Structure

```
ctf/
├── backend/           # Node.js + Express API
│   ├── src/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── middleware/
│   │   ├── routes/
│   │   └── server.js
│   └── data/ctf.db    # SQLite database (auto-created)
├── frontend/          # React + Vite UI
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── context/
│   │   └── services/
│   └── dist/          # Production build
├── INSTRUCTIONS.md    # Build instructions
├── README.md          # Full documentation
└── start.sh           # Quick start script
```

## ⚡ Features

✅ Team registration & login (JWT auth)  
✅ Flag submission with validation  
✅ Real-time scoreboard (Socket.io)  
✅ Live activity feed  
✅ Challenge management (Admin)  
✅ Rate limiting (30 submissions/min)  
✅ Password hashing (bcrypt)  
✅ Responsive dark theme UI  
✅ 5 pre-loaded sample challenges  

## 🔧 Troubleshooting

**Backend won't start:**
- Check if port 3001 is in use
- Run `cd backend && npm install`

**Frontend errors:**
- Run `cd frontend && npm install`
- Check Node.js version (v16+)

**Database issues:**
- Delete `backend/data/ctf.db` to reset
- Database auto-creates on first run

## 🎯 Next Steps

- Add more challenges
- Invite teams to compete
- Monitor live scoreboard
- Have fun! 🎉
