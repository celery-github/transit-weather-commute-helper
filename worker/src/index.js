import GtfsRealtimeBindings from "gtfs-realtime-bindings";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname === "/api/ttc/arrivals") {
      const stopId = url.searchParams.get("stopId");
      if (!stopId) {
        return json({ error: "Missing stopId" }, 400);
      }

      try {
        const feedUrl = new URL(env.TTC_GTFSRT_FEED_URL);

        // Optional API key support (if your TTC feed needs it)
        if (env.TTC_API_KEY && env.TTC_API_KEY.trim().length > 0) {
          feedUrl.searchParams.set("key", env.TTC_API_KEY.trim());
        }

        const resp = await fetch(feedUrl.toString(), {
          headers: { "User-Agent": "transit-weather-commute-helper" }
        });

        if (!resp.ok) {
          return json({ error: `Upstream TTC feed failed: ${resp.status}` }, 502);
        }

        const buf = await resp.arrayBuffer();
        const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
          new Uint8Array(buf)
        );

        const arrivals = extractStopArrivals(feed, stopId);

        // Sort by minutes ascending (nulls last)
        arrivals.sort((a, b) => (a.minutes ?? 9999) - (b.minutes ?? 9999));

        return json({
          generatedAt: new Date().toISOString(),
          stopId,
          arrivals
        });
      } catch (e) {
        return json({ error: String(e?.message || e) }, 500);
      }
    }

    return json({ error: "Not found" }, 404);
  }
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders }
  });
}

function extractStopArrivals(feed, stopId) {
  const nowSec = Math.floor(Date.now() / 1000);
  const out = [];

  for (const entity of feed.entity || []) {
    const tu = entity.tripUpdate;
    if (!tu || !tu.stopTimeUpdate) continue;

    // find stop updates matching stopId
    for (const stu of tu.stopTimeUpdate) {
      if (String(stu.stopId) !== String(stopId)) continue;

      const routeShortName = tu.trip?.routeId ?? null;
      const tripHeadSign = tu.trip?.tripId ?? null; // placeholder; headsign often needs static GTFS

      // Prefer arrival time, fallback to departure
      const etaSec =
        stu.arrival?.time ??
        stu.departure?.time ??
        null;

      const minutes = etaSec ? Math.max(0, Math.round((etaSec - nowSec) / 60)) : null;

      out.push({
        routeShortName,
        tripHeadSign,
        minutes,
        scheduledTime: etaSec ? new Date(etaSec * 1000).toISOString() : null
      });
    }
  }

  // Keep it sane (some feeds can be noisy)
  return out.slice(0, 20);
}
