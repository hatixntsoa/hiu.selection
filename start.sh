#!/bin/bash

echo "====================================="
echo "  CTF Platform - Starting..."
echo "====================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to cleanup on exit
cleanup() {
  echo ""
  echo -e "${YELLOW}Shutting down servers...${NC}"
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
  exit 0
}

trap cleanup SIGINT SIGTERM

# Start backend
echo -e "${BLUE}Starting backend server...${NC}"
cd backend
npm start &
BACKEND_PID=$!
echo -e "${GREEN}✓ Backend started (PID: $BACKEND_PID)${NC}"
cd ..

# Wait for backend to initialize
sleep 2

# Start frontend
echo -e "${BLUE}Starting frontend dev server...${NC}"
cd frontend
npm run dev --host &
FRONTEND_PID=$!
echo -e "${GREEN}✓ Frontend started (PID: $FRONTEND_PID)${NC}"
cd ..

echo ""
echo "====================================="
echo -e "${GREEN}  CTF Platform is running!${NC}"
echo "====================================="
echo ""
echo -e "${BLUE}Frontend:${NC} http://localhost:3000"
echo -e "${BLUE}Backend:${NC}  http://localhost:3001"
echo ""
echo -e "${YELLOW}Admin Login:${NC}"
echo -e "  Email: admin@ctf.local"
echo -e "  Password: admin123"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all servers${NC}"
echo ""

# Wait for both processes
wait
