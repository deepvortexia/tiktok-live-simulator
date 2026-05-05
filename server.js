import { WebcastPushConnection } from "tiktok-live-connector";
import { WebSocketServer } from "ws";

const username = process.argv[2];
if (!username) {
  console.error("Usage: node server.js @username");
  process.exit(1);
}

// ── Gift ID → game action map ──────────────────────────────────────────────
const GIFT_MAP = {
  5655: { gift: "rose",     team: "red",  pts: 1  },  // Rose
  6748: { gift: "fire",     team: "red",  pts: 3  },  // Lion
  6830: { gift: "rocket",   team: "red",  pts: 25 },  // Rocket
  5651: { gift: "drop",     team: "blue", pts: 1  },  // Ice cream
  6951: { gift: "universe", team: "blue", pts: 25 },  // Universe
};

function resolveGift(giftId, diamondCount) {
  if (GIFT_MAP[giftId]) return GIFT_MAP[giftId];
  const coins = diamondCount ?? 0;
  if (coins >= 100) return { gift: "crown",     team: "red",  pts: 5 };
  if (coins >= 10)  return { gift: "fire",      team: "red",  pts: 3 };
  return               { gift: "rose",       team: "red",  pts: 1 };
}

// ── WebSocket server ───────────────────────────────────────────────────────
const wss = new WebSocketServer({ port: 8080 });

function broadcast(payload) {
  const msg = JSON.stringify(payload);
  for (const client of wss.clients)
    if (client.readyState === 1) client.send(msg);
}

wss.on("listening", () => console.log("WS server listening on ws://localhost:8080"));

// ── TikTok connection ──────────────────────────────────────────────────────
const tiktok = new WebcastPushConnection(username, {
  processInitialData: false,
  enableExtendedGiftInfo: true,
});

tiktok.on("gift", (data) => {
  console.log("GIFT RAW:", JSON.stringify(data, null, 2));

  // Only fire on final repeat (or non-repeatable gifts) to avoid spam
  if (data.repeatEnd === false) return;

  const resolved = resolveGift(data.giftId, data.diamondCount);

  const payload = {
    type:        "gift",
    giftName:    data.giftName ?? data.giftId,
    giftId:      data.giftId,
    repeatCount: data.repeatCount ?? 1,
    username:    data.uniqueId ?? "unknown",
    ...resolved,
  };

  console.log(`[gift] ${payload.username} → ${payload.giftName} x${payload.repeatCount} (${payload.team} +${payload.pts}pt)`);
  broadcast(payload);
});

tiktok.on("connect", () => console.log(`Connected to @${username}`));
tiktok.on("disconnect", () => console.log("Disconnected"));
tiktok.on("error", (err) => console.error("TikTok error:", err.message ?? err));

tiktok.connect()
  .then(() => console.log(`Listening for gifts on @${username}`))
  .catch((err) => console.error("Failed to connect:", err.message ?? err));
