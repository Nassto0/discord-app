# Pulse Chat

A modern, aesthetic chat application with DMs, group chats, voice/video calls, voice messages, and media sharing. Built with React, Node.js, and WebRTC -- fully local, no cloud dependencies.

## Features

- **Real-time messaging** -- DMs and group chats with typing indicators, online presence, read status
- **Voice messages** -- Record and play back voice messages with waveform visualization
- **Media sharing** -- Send images and videos with lightbox preview
- **Voice & video calls** -- 1-to-1 WebRTC peer-to-peer calls
- **Beautiful dark UI** -- Glassmorphism, smooth animations, fully responsive
- **Mobile ready** -- Works perfectly on phones with bottom navigation and swipeable panels
- **Sound effects** -- Synthesized notification sounds for messages and calls
- **Electron ready** -- Desktop app wrapper with system tray

## Quick Start

```bash
# Install dependencies
npm install

# Set up the database
cd server && npx prisma db push && cd ..

# Start both servers
npm run dev
```

Open http://localhost:5173 in your browser.

## Architecture

```
discord-app/
├── client/          React + Vite + Tailwind CSS
├── server/          Express + Socket.IO + Prisma + SQLite
├── shared/          Shared TypeScript types
└── electron/        Electron desktop wrapper
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, Framer Motion |
| State | Zustand |
| Real-time | Socket.IO |
| Calls | WebRTC (peer-to-peer) |
| Backend | Express, Socket.IO |
| Database | SQLite via Prisma |
| Desktop | Electron |

## Running the Electron App

```bash
cd electron
npm install
npm start
```

## Deploying Online

### Client (Vercel)

1. Push your repo to GitHub
2. Go to [vercel.com](https://vercel.com) and import the project
3. Set **Root Directory** to `client`
4. Set **Framework Preset** to `Vite`
5. Add environment variable: `VITE_API_URL` = your server URL (e.g. `https://nasscord-api.onrender.com`)
6. Deploy

### Server (Render)

1. Go to [render.com](https://render.com) and create a new **Web Service**
2. Set **Root Directory** to `server`
3. Set **Build Command**: `npm ci && npx prisma generate`
4. Set **Start Command**: `npx prisma db push --accept-data-loss && npm start`
5. Add environment variables:
   - `DATABASE_URL` = `file:./prod.db`
   - `JWT_SECRET` = (generate a strong random string)
   - `CORS_ORIGIN` = your Vercel frontend URL (e.g. `https://nasscord.vercel.app`)
   - `NODE_ENV` = `production`
6. Add a **Disk** at `/app/uploads` for file persistence
7. Deploy

### WebRTC (optional TURN server)

For reliable voice/video calls across all networks, add TURN server credentials:
- `VITE_TURN_URL` = `turn:your-turn-server:3478`
- `VITE_TURN_USER` = your TURN username
- `VITE_TURN_PASS` = your TURN password

Free TURN options: [Open Relay](https://www.metered.ca/tools/openrelay/) or self-hosted [coturn](https://github.com/coturn/coturn).

## License

MIT
