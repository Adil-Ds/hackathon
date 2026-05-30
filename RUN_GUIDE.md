# BookNFix — Run Guide

**Google Antigravity Hackathon · Al Seekho Phase II · Challenge 2**

Two apps in one repo:

```
serviceai-backend/    FastAPI backend  (port 8001)
serviceai-mobile/     Expo React Native mobile app
```

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Python | 3.11+ | python.org |
| Node.js | 18+ | nodejs.org |
| npm | 9+ | bundled with Node |
| Expo Go | latest | App Store / Play Store |
| Docker Desktop | any | docker.com (optional — for PostgreSQL + Redis) |

---

## 1. Clone the repo

```bash
git clone https://github.com/Adil-Ds/hackathon.git
cd hackathon
git checkout adil
```

---

## 2. Backend setup

### 2a. Create the environment file

```bash
cd serviceai-backend
cp .env.example .env
```

Open `.env` and fill in your keys:

| Variable | Where to get it |
|----------|----------------|
| `GROQ_API_KEY` | console.groq.com → API Keys |
| `VAPI_API_KEY` | dashboard.vapi.ai → API Keys |
| `VAPI_PHONE_NUMBER_ID` | VAPI → Phone Numbers |
| `VAPI_ASSISTANT_ID` | VAPI → Assistants |
| `JWT_SECRET` | Any long random string |
| PostgreSQL / Redis | Leave defaults if using Docker (step 2b) |

> The core AI pipeline (search, rank, book) runs on **SQLite only** — Groq is the only required key to get the app working. PostgreSQL/Redis/VAPI are optional enhancements.

### 2b. Start PostgreSQL + Redis (optional, for v2 chat & provider profiles)

```bash
# Inside serviceai-backend/
docker-compose up -d
```

This starts PostgreSQL 16 on port 5432 and Redis 7 on port 6379 using the defaults in `.env`.

### 2c. Install Python dependencies

```bash
# Still inside serviceai-backend/
pip install -r requirements.txt
```

### 2d. Run the backend

```bash
python -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

API docs: [http://localhost:8001/docs](http://localhost:8001/docs)  
Health check: [http://localhost:8001/health](http://localhost:8001/health)

---

## 3. Mobile app setup

### 3a. Create the environment file

```bash
cd serviceai-mobile
cp .env.example .env
```

Open `.env` and paste your Firebase Web config values.  
Get them from: **Firebase Console → Project Settings → Your apps → Web app → SDK setup and configuration**

### 3b. Set your backend URL

Open `src/config/constants.js` and update `LAN_IP` to your machine's local IP address:

```js
const LAN_IP = "192.168.x.x";   // run `ipconfig` on Windows / `ifconfig` on Mac
```

**Three connection options** (pick one):

| Option | When to use | What to set |
|--------|-------------|-------------|
| LAN IP | Physical device on same Wi-Fi | Set `LAN_IP` to your PC's IP |
| ngrok | Router blocks direct LAN | Run `ngrok http 8001`, paste URL in `NGROK_URL` |
| Railway | Deployed backend | Paste Railway URL in `RAILWAY_URL` |

### 3c. Install dependencies

```bash
# Inside serviceai-mobile/
npm install --legacy-peer-deps
```

### 3d. Run the mobile app

```bash
npx expo start          # scan QR with Expo Go on your phone
npx expo start --web    # open in browser (limited features)
npx expo start --tunnel # use if LAN connection fails
```

---

## 4. Firebase setup (required for auth)

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a project (or use existing)
3. Enable **Authentication → Email/Password**
4. Enable **Firestore Database** (start in test mode for development)
5. Add a **Web app** and copy the config into `serviceai-mobile/.env`

---

## 5. Quick start (minimal — no Docker)

This gets the core AI booking flow running without PostgreSQL/Redis:

```bash
# Terminal 1 — backend
cd serviceai-backend
pip install -r requirements.txt
# Add GROQ_API_KEY to .env
python -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload

# Terminal 2 — mobile
cd serviceai-mobile
npm install --legacy-peer-deps
# Add Firebase config to .env, update LAN_IP in constants.js
npx expo start
```

---

## 6. Feature availability by setup

| Feature | SQLite only | + PostgreSQL | + Redis | + VAPI |
|---------|:-----------:|:------------:|:-------:|:------:|
| AI provider search | ✅ | ✅ | ✅ | ✅ |
| Booking (PENDING/CONFIRMED) | ✅ | ✅ | ✅ | ✅ |
| Browse & direct book | ✅ | ✅ | ✅ | ✅ |
| Real-time chat | ✅* | ✅ | ✅ | ✅ |
| Provider profiles (v2) | ❌ | ✅ | ✅ | ✅ |
| WebSocket presence | ❌ | ✅ | ✅ | ✅ |
| AI voice calling | ❌ | ❌ | ❌ | ✅ |

*Chat works via SQLite fallback without PostgreSQL.

---

## 7. Project structure

```
serviceai-backend/
├── app/
│   ├── agents/          # AI pipeline (intent → search → rank → book → followup)
│   ├── api/
│   │   ├── routes.py    # v1 endpoints (SQLite)
│   │   └── v2/          # v2 endpoints (PostgreSQL + Redis)
│   ├── core/            # config, database, redis, security
│   ├── models/          # ORM models + Pydantic schemas
│   ├── websocket/       # WebSocket manager + handlers
│   └── Agentic_Caller/  # VAPI outbound call logic
├── data/
│   ├── providers.json   # 50 mock providers
│   └── bookings.db      # SQLite (auto-created on startup)
├── .env.example
└── docker-compose.yml

serviceai-mobile/
├── src/
│   ├── screens/
│   │   ├── auth/        # Splash, Welcome, Login, Register
│   │   ├── user/        # Dashboard, Search, Browse, Booking, History
│   │   ├── provider/    # Dashboard, Requests, Profile, Public Profile
│   │   └── chat/        # Inbox, ChatRoom
│   ├── services/        # api.js, chatApi.js, websocket.js
│   ├── contexts/        # AuthContext, WSContext
│   ├── stores/          # chatStore, notificationStore (Zustand)
│   └── config/
│       └── constants.js # BASE_URL — update LAN_IP here
├── .env.example
└── App.js
```

---

## 8. Common issues

**`Network request failed` on device**
→ Make sure `LAN_IP` in `constants.js` matches your PC's IP (`ipconfig` on Windows).  
→ Both phone and PC must be on the same Wi-Fi network.  
→ Try `npx expo start --tunnel` as a fallback.

**`GROQ_API_KEY` error**
→ Add your key to `serviceai-backend/.env`. Get one free at console.groq.com.

**Chat inbox blank after messaging a provider**
→ Pull down to refresh in the Chat tab.

**Provider sees no bookings**
→ Make sure the booking was created after the provider registered (bookings are matched by provider ID).

**Docker not starting**
→ The app works without Docker. Skip docker-compose and leave PostgreSQL/Redis fields blank — the backend gracefully falls back to SQLite-only mode.
