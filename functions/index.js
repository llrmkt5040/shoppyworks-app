const functions = require("firebase-functions");
const https = require("https");

exports.anthropicProxy = functions.https.onRequest((req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  const apiKey = functions.config().anthropic.key;
  const body = JSON.stringify(req.body);

  const options = {
    hostname: "api.anthropic.com",
    path: "/v1/messages",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
  };

  const proxyReq = https.request(options, (proxyRes) => {
    let data = "";
    proxyRes.on("data", (chunk) => data += chunk);
    proxyRes.on("end", () => res.status(proxyRes.statusCode).send(data));
  });

  proxyReq.on("error", (e) => res.status(500).send(e.message));
  proxyReq.write(body);
  proxyReq.end();
});
