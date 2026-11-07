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

app.get("/", (req, res) => {
  res.send("UNCLE B-FX V4 OTC BACKEND READY");
});

app.get("/api/candles", async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(503).json({
        error: "OTCHARTS_API_KEY not configured"
      });
    }

    const symbol = req.query.symbol || "EURUSD_otc";
    const limit = Math.min(
      Math.max(Number(req.query.limit) || 100, 1),
      300
    );

    const allowed = [
      "EURUSD_otc",
      "GBPUSD_otc",
      "USDJPY_otc",
      "BTCUSD_otc",
      "AUDUSD_otc"
    ];

    if (!allowed.includes(symbol)) {
      return res.status(400).json({
        error: "Pair not available on this free-key list"
      });
    }

    const url = new URL(
      "https://otcharts.com/v1/candles"
    );

    url.searchParams.set("venue", "otc");
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("tf", "60");
    url.searchParams.set("limit", String(limit));

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${API_KEY}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    res.json(data);

  } catch (error) {
    res.status(500).json({
      error: "OTC connection failed"
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("UNCLE B-FX V4 running on port " + PORT);
});
