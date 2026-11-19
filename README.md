# LifeLink

A blood donor network for The Gambia. Verified hospitals post urgent blood requests, LifeLink alerts eligible donors nearby, and donors choose to respond. Donor identities and exact locations are never published: a hospital only sees a donor's contact after that donor accepts.

- `backend/`: Node.js, Express 5, MongoDB (Mongoose), JWT, zod
- `frontend/`: Expo (React Native + Expo Router). Runs as an installable web app (PWA) and can also be built for Android/iOS with EAS.

## Roles

| Role | Can do |
| --- | --- |
| Donor | Register, set availability and location sharing, receive request alerts, accept/decline, see donation history |
| Facility staff | Verify donor blood type in person, create and broadcast requests, coordinate accepted donors, confirm donations |
| Admin | Create/approve facilities, provision staff and permissions, oversight, audit log |

## Deploy (free tier)

1. **Database: MongoDB Atlas.** Create a free M0 cluster, a database user, and allow network access from `0.0.0.0/0`. Copy the `mongodb+srv://…/lifelink` connection string. Atlas clusters are replica sets, which the backend requires.
2. **API: Render.** New → Blueprint → select this repo (it reads `render.yaml`). Set `MONGODB_URI`, and set `CORS_ORIGINS` to your Vercel URL (no trailing slash). Check `https://<api>.onrender.com/api/v1/health`.
3. **First admin.** Render's free plan has no shell, so run this once from your own computer: put the Atlas `MONGODB_URI` and any 32+ character `JWT_SECRET` in `backend/.env`, then run `cd backend && npm install && npm run bootstrap:admin` in an interactive terminal. It refuses to run if an admin already exists.
4. **App: Vercel.** Import the repo with **Root Directory = `frontend`**. Add the env var `EXPO_PUBLIC_API_URL=https://<api>.onrender.com/api/v1`. `frontend/vercel.json` handles the build and routing.
5. **Install on a phone.** Open the Vercel URL. On iPhone: Safari → Share → *Add to Home Screen*. On Android: Chrome → *Install app*.

Render's free plan sleeps after inactivity, so the first request can take around 30–50 s.

## Local development

```bash
cd backend && cp .env.example .env   # fill MONGODB_URI and JWT_SECRET
npm install && npm run dev

cd frontend && cp .env.example .env  # EXPO_PUBLIC_API_URL=http://127.0.0.1:5000/api/v1
npm install && npx expo start --web --port 3000
```

More detail: `backend/README.md`, `frontend/README.md`, `backend/docs/`.
