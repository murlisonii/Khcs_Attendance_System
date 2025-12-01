# Attendance Backend (demo)

This is a minimal Express + MongoDB backend for the face-recognition attendance demo.

It is intentionally simple (no auth) so you can show it in a college demo. Do NOT use this as-is in production.

## Quick steps to connect to your MongoDB Atlas account

1. Create a MongoDB Atlas cluster (free tier is fine for demo).
2. Create a database user with a password in Atlas (Username: e.g. `att_user`).
3. Whitelist your IP address (or allow access from anywhere for quick demo: `0.0.0.0/0`).
4. Get the connection string from Atlas (Drivers -> Connect -> Connect your application). It will look like:

```
mongodb+srv://<username>:<password>@cluster0.abcd123.mongodb.net/attendancedb?retryWrites=true&w=majority
```

Replace `<username>` and `<password>` with the user you created and `attendancedb` is the database name.

## Local environment (.env)

Create a `.env` file in the `server/` folder (do NOT commit this file) and put:

```
MONGODB_URI=mongodb+srv://att_user:YourPassword@cluster0.abcd123.mongodb.net/attendancedb?retryWrites=true&w=majority
PORT=4000
```

## Install and run the server

In a terminal (macOS / zsh):

```bash
cd /Users/mokshsharma/Downloads/att/server
npm install
# start server in dev mode (auto-restart)
npm run dev
# or start normally:
npm start
```

By default server listens on `http://localhost:4000` and exposes the endpoints:

- `POST /api/attendance` — accepts records in the request body (see below)
- `GET /api/attendance` — query by `date=YYYY-MM-DD`, `session`, `name`
- `GET /api/labels` and `POST /api/labels`

### Example POST payload (from frontend)

```json
{
  "deviceId": "camera-1",
  "session": "Morning shift",
  "records": [
    { "name": "moksh", "confidence": 0.86, "time": "2025-12-01T08:00:00Z" }
  ]
}
```

## Frontend configuration

If you run the backend on a different host/port (for example `http://localhost:4000`), update the `BACKEND_URL` constant at the top of `script.js` in the frontend:

```js
const BACKEND_URL = 'http://localhost:4000';
```

If you get CORS errors, the server already includes `cors()` middleware to allow cross-origin requests by default in this demo.

## Notes and tips

- Keep `.env` secret. For the college demo, you can allow access from your IP and keep the URI in `.env`.
- The server has minimal validation; it saves the records as provided. This keeps it simple for a demo but you can extend validation later.
- If you prefer to run Mongo locally instead of Atlas, you can use the default URI `mongodb://127.0.0.1:27017/attendancedb` (already the default when `MONGODB_URI` is not set).

If you want, I can: create a `docker-compose.yml` that runs node + mongo together, add a small Postman collection, or add a simple web UI for viewing today's attendance. Which would you like next?
