const express = require("express");

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

const API_KEY = process.env.OTCHARTS_API_KEY;

const ALLOWED = [
  "EURUSD_otc",
  "GBPUSD_otc",
  "USDJPY_otc",
  "BTCUSD_otc",
  "AUDUSD_otc"
];

app.get("/", (req, res) => {
  res.send("UNCLE B-FX V4 OTC BACKEND READY");
});

// Available OTC symbols
app.get("/api/symbols", async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(503).json({ error: "API key missing" });
    }

    const url = new URL("https://otcharts.com/v1/symbols");
    url.searchParams.set("venue", "otc");

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${API_KEY}` }
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({ error: "Symbols connection failed" });
  }
});

// Historical OTC candles
app.get("/api/candles", async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(503).json({ error: "API key missing" });
    }

    const symbol = req.query.symbol || "EURUSD_otc";
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 300);

    if (!ALLOWED.includes(symbol)) {
      return res.status(400).json({ error: "Pair not available" });
    }

    const url = new URL("https://otcharts.com/v1/candles");
    url.searchParams.set("venue", "otc");
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("tf", "60");
    url.searchParams.set("limit", String(limit));

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${API_KEY}` }
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({ error: "OTC candles connection failed" });
  }
});

// LIVE OTC STREAM — one connection for five pairs
app.get("/api/stream", async (req, res) => {
  if (!API_KEY) {
    return res.status(503).json({ error: "API key missing" });
  }

  const requested = (req.query.symbols || "EURUSD_otc")
    .split(",")
    .map(s => s.trim());

  const symbols = [...new Set(requested)];

  if (
    symbols.length < 1 ||
    symbols.length > 5 ||
    symbols.some(s => !ALLOWED.includes(s))
  ) {
    return res.status(400).json({ error: "Invalid OTC symbols" });
  }

  const controller = new AbortController();

  req.on("close", () => controller.abort());

  try {
    const url = new URL("https://otcharts.com/v1/stream");
    url.searchParams.set("venue", "otc");
    url.searchParams.set("symbol", symbols.join(","));

    const upstream = await fetch(url, {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        Accept: "text/event-stream"
      },
      signal: controller.signal
    });

    if (!upstream.ok) {
      const message = await upstream.text();
      return res.status(upstream.status).json({
        error: "OTCharts stream refused",
        details: message
      });
    }

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const reader = upstream.body.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done || res.destroyed) break;
      res.write(Buffer.from(value));
    }

    if (!res.destroyed) res.end();

  } catch (error) {
    if (!res.destroyed && error.name !== "AbortError") {
      res.end();
    }
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("UNCLE B-FX V4 running on port " + PORT);
});
