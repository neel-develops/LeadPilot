# Running and deploying LeadPilot

## Local

1. Put your Sarvam key in `backend/.env`:

   ```
   SARVAM_API_KEY=your-key
   ```

2. On Windows, double-click `start.bat`. It creates the Python environment, installs packages, builds the dashboard and opens http://localhost:8000.

For dev mode, use two terminals:

```bash
backend/.venv/Scripts/python -m uvicorn main:app --app-dir backend --port 8000
```

```bash
npm --prefix frontend run dev
```

Then open http://localhost:5173.

To rebuild the standalone `LeadPilot.html`:

```bash
npm --prefix frontend run build:html
```

## Docker

```bash
docker build -t leadpilot .
```

```bash
docker run -p 8000:8000 --env-file backend/.env leadpilot
```

## Render

1. Go to dashboard.render.com and choose **New → Blueprint**.
2. Pick this repository. Render reads `render.yaml` and builds the `Dockerfile`.
3. Paste `SARVAM_API_KEY` when prompted. `LEADPILOT_SECRET` is generated automatically, and `TZ=Asia/Kolkata` keeps the calling-hours rule on IST.
4. Use the HTTPS URL Render gives you. Browsers only allow the microphone on HTTPS.

On the free plan the service sleeps after about 15 minutes idle. The database is re-seeded on every start.
