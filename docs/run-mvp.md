# Run NoWenOS MVP

## Start backend
```bash
cd server
go run ./cmd/nowenos-api
```

Default backend address: http://localhost:8080

## Start frontend
```bash
cd web
npm run dev
```

Default frontend address: http://localhost:5173

## Current flow
- Open http://localhost:5173/login
- Login with any non-empty username/password for the current local dev flow
- After login, the app redirects to /dashboard
- Dashboard fetches /api/v1/system/info from the backend through Vite proxy