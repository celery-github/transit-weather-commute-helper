// Replace these with your actual TTC stop IDs
export const CONFIG = {
  home: {
    label: "Home",
    stopId: "8761",
    lat: 43.6532,
    lon: -79.3832
  },
  work: {
    label: "Work",
    stopId: "0000",
    lat: 43.6532,
    lon: -79.3832
  },

  // Your Cloudflare Worker URL after deploy:
  // e.g. https://ttc-proxy.<your-subdomain>.workers.dev
  workerBaseUrl: "http://127.0.0.1:8787" // local dev default
};
