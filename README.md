# Poola Kundi Tournament Software

A full-featured badminton tournament management system with real-time scoring, bracket generation, and player statistics.

## Live Demo

- **Frontend:** https://badminton-tournament-software-c2pm.vercel.app
- **Backend API:** https://badminton-tournament-software.onrender.com

## Features

- **Tournament Management** - Create and manage tournaments with multiple formats
- **Bracket Generation** - Automatic bracket creation for Single Elimination, Double Elimination, Round Robin, and Group Knockout
- **Live Scoring** - Real-time point-by-point scoring with badminton rules
- **Player Statistics** - ELO-based ranking system and comprehensive stats
- **Real-time Updates** - Socket.IO powered live updates across all clients
- **Role-based Access** - Multiple user roles with different permissions
- **Installable PWA** - Install as a native app on mobile and desktop devices

## Install as App (PWA)

This app can be installed on your device for a native app-like experience.

### Mobile (iOS/Android)
1. Open the website in your browser
2. **iOS:** Tap the Share button → "Add to Home Screen"
3. **Android:** Tap the menu (⋮) → "Add to Home Screen" or "Install App"

### Desktop (Chrome/Edge)
1. Visit the website
2. Click the install icon (⊕) in the address bar
3. Or use menu → "Install Poola Kundi..."

### Features when installed:
- Runs in standalone mode (no browser UI)
- Faster loading with offline caching
- Push notifications support (coming soon)
- Native app icon on home screen

## Tournament Formats

| Format | Description |
|--------|-------------|
| **Single Elimination** | Standard knockout format with seeding |
| **Double Elimination** | Winners and losers brackets |
| **Round Robin** | Every participant plays each other |
| **Group Knockout** | Group stage followed by knockout rounds |

## User Roles

| Feature | ROOT | ADMIN | ORGANIZER | PLAYER | SPECTATOR |
|---------|------|-------|-----------|--------|-----------|
| Create tournaments | Yes | Yes | Yes | No | No |
| Edit own tournaments | Yes | Yes | Yes | No | No |
| Edit ANY tournament | Yes | Yes | No | No | No |
| Delete tournaments (UI) | Yes | No | No | No | No |
| Manage all users | Yes | Yes | No | No | No |
| Delete users | Yes | Yes | No | No | No |
| Recalculate statistics | Yes | No | No | No | No |
| View DRAFT tournaments | Yes | Yes | Yes | No | No |
| Manage registrations (any) | Yes | Yes | No | No | No |
| Manage registrations (own) | Yes | Yes | Yes | No | No |
| Register for tournaments | Yes | Yes | Yes | Yes | No |
| Live scoring | Yes | Yes | Yes | Yes* | No |
| View tournaments | Yes | Yes | Yes | Yes | Yes |

*Players can score their own matches if enabled by organizer

### Role Hierarchy

```
ROOT > ADMIN > ORGANIZER > PLAYER > SPECTATOR
```

- **ROOT** - Super admin with full system access
- **ADMIN** - Can manage any tournament and users
- **ORGANIZER** - Can create and manage their own tournaments
- **PLAYER** - Default role, can register and play in tournaments
- **SPECTATOR** - View-only access

## Tech Stack

### Frontend
- React 18 with Vite
- Tailwind CSS with glass morphism design
- Socket.IO client for real-time updates
- React Router for navigation

### Backend
- Node.js with Express
- Prisma ORM with PostgreSQL
- Socket.IO for WebSocket connections
- Supabase for authentication

### Database
- PostgreSQL (Supabase)

### Deployment
- Frontend: Vercel
- Backend: Render
- Database: Supabase

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database (or Supabase account)

### Environment Variables

#### Backend (.env)
```env
DATABASE_URL=postgresql://...
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
PORT=5001
```

#### Frontend (.env)
```env
VITE_API_URL=http://localhost:5001/api
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Installation

1. Clone the repository
```bash
git clone https://github.com/suryaKurella/badminton-tournament-software.git
cd badminton-tournament-software
```

2. Install backend dependencies
```bash
cd backend
npm install
npx prisma generate
npx prisma db push
```

3. Install frontend dependencies
```bash
cd ../frontend
npm install
```

4. Start development servers
```bash
# Backend (from backend folder)
npm run dev

# Frontend (from frontend folder)
npm run dev
```

## API Endpoints

### Authentication
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/me` - Update profile

### Tournaments
- `GET /api/tournaments` - List tournaments
- `GET /api/tournaments/:id` - Get tournament details
- `POST /api/tournaments` - Create tournament
- `PUT /api/tournaments/:id` - Update tournament
- `DELETE /api/tournaments/:id` - Delete tournament
- `POST /api/tournaments/:id/register` - Register for tournament
- `DELETE /api/tournaments/:id/register` - Deregister

### Matches
- `GET /api/matches/tournament/:id` - Get tournament matches
- `POST /api/matches/:id/score-point` - Record point (live scoring)
- `POST /api/matches/:id/undo-point` - Undo last point
- `PUT /api/matches/:id/complete` - Complete match

### Statistics
- `GET /api/statistics/leaderboard` - Global leaderboard
- `GET /api/statistics/player/:id` - Player statistics

## License

MIT

## Author

Made with love by Surya
