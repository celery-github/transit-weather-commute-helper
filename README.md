# Transit + Weather Commute Helper (Toronto)

A free commute dashboard that shows:
- Next TTC arrivals for a saved stop (Home or Work)
- Rain risk near your destination (Open-Meteo)
- A simple “best time to leave” suggestion

## Architecture
GitHub Pages (docs/) -> Cloudflare Worker (/api/ttc/arrivals) -> TTC GTFS-RT feed
GitHub Pages also calls Open-Meteo directly.

## Configure
Edit `docs/config.js`:
- home.stopId
- work.stopId
- lat/lon for both (used for weather)

## Run locally
### Worker
cd worker
npm install
npx wrangler dev

### Site
Open `docs/index.html` with Live Server (VSCode extension) or any static server.

## Deploy
### Deploy Worker (free)
cd worker
npx wrangler deploy

Update `docs/config.js` with your Worker URL.

### GitHub Pages
Repo Settings -> Pages -> Deploy from branch -> main -> /docs

