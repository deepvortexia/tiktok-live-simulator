import { useState, useEffect, useRef, useCallback } from "react";
import "./TikTokLive.css";

const EMOJIS = ["❤️", "🔥", "😍", "💯", "👏", "🎉", "✨", "💕", "😂", "🤩", "👑", "💎"];
const COLORS = ["#ff2d55", "#ff6b35", "#ff9a00", "#a855f7", "#3b82f6", "#10b981", "#f59e0b"];

const FAKE_NAMES = [
  "xoxo_lena", "toxic_vibes99", "cloudboy.fr", "kittywave", "drip.stefan",
  "noonmoood", "babygirl.exe", "blaze_it_up", "lunatica77", "jeanmich_974",
  "sweetpain.co", "raf_officiel", "slay.mode", "darkmatter_yt", "pinkflash00",
  "reivax_tt", "noura.vibe", "lil_trapstar", "coeur_brisé", "yassvibe"
];

const COMMENTS = [
  "omg t'es trop beau 😍", "j'te follow depuis trop longtemps 🔥", "FIRST !!!",
  "rep svp 🙏", "combo de ouf ❤️‍🔥", "t'arrives quand tu veux haha",
  "gg la team 💪", "tu check mon live après?", "j'te love bestie 💕",
  "HYPE HYPE HYPE", "tu fais quoi ce soir?", "j'ai envoyé une rose 🌹",
  "lol ce live 😂", "tu streams souvent?", "t'as grandi fr", "banger ce live",
  "salut de Montréal 🇨🇦", "c'est quand le prochain live?", "fan numéro 1 ici 👑",
  "gg gg gg", "combo x100 !", "go go go!!!", "🎉🎉🎉",
];

const GIFTS = [
  { name: "Rose",    emoji: "🌹", coins: 1,    color: "#ff2d55" },
  { name: "Lion",    emoji: "🦁", coins: 100,  color: "#f59e0b" },
  { name: "Fusée",   emoji: "🚀", coins: 500,  color: "#3b82f6" },
  { name: "Univers", emoji: "🌌", coins: 2000, color: "#a855f7" },
];

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// Floating heart animation
function FloatingHeart({ x, color, id, onDone }) {
  useEffect(() => {
    const t = setTimeout(() => onDone(id), 2200);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="floating-heart" style={{ left: `${x}%`, color }}>
      ❤️
    </div>
  );
}

// Gift notification
function GiftNotif({ gift, username, onDone, id }) {
  useEffect(() => {
    const t = setTimeout(() => onDone(id), 3000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="gift-notif" style={{ borderColor: gift.color }}>
      <span className="gift-emoji">{gift.emoji}</span>
      <div className="gift-info">
        <span className="gift-user">{username}</span>
        <span className="gift-text">a envoyé un <strong>{gift.name}</strong></span>
      </div>
      <span className="gift-coins">🪙 {gift.coins}</span>
    </div>
  );
}

export default function TikTokLive() {
  const [isLive, setIsLive] = useState(false);
  const [viewers, setViewers] = useState(0);
  const [likes, setLikes] = useState(0);
  const [comments, setComments] = useState([]);
  const [hearts, setHearts] = useState([]);
  const [giftNotifs, setGiftNotifs] = useState([]);
  const [totalCoins, setTotalCoins] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [inputComment, setInputComment] = useState("");
  const [username] = useState("mon_live_tiktok");

  const commentsEndRef = useRef(null);
  const heartIdRef = useRef(0);
  const giftIdRef = useRef(0);
  const intervalsRef = useRef([]);

  const addComment = useCallback((name, text, isGift = false, giftColor = null) => {
    setComments(prev => {
      const next = [...prev, { id: Date.now() + Math.random(), name, text, isGift, giftColor }];
      return next.slice(-60);
    });
  }, []);

  const spawnHeart = useCallback(() => {
    const id = heartIdRef.current++;
    setHearts(prev => [...prev, { id, x: randInt(20, 80), color: rand(COLORS) }]);
  }, []);

  const removeHeart = useCallback((id) => {
    setHearts(prev => prev.filter(h => h.id !== id));
  }, []);

  const removeGiftNotif = useCallback((id) => {
    setGiftNotifs(prev => prev.filter(g => g.id !== id));
  }, []);

  const triggerGift = useCallback(() => {
    const gift = rand(GIFTS);
    const user = rand(FAKE_NAMES);
    const id = giftIdRef.current++;
    setGiftNotifs(prev => [...prev.slice(-3), { id, gift, username: user }]);
    setTotalCoins(prev => prev + gift.coins);
    addComment(user, `${gift.emoji} a envoyé un ${gift.name} !`, true, gift.color);
    for (let i = 0; i < randInt(3, 8); i++) {
      setTimeout(spawnHeart, i * 120);
    }
  }, [addComment, spawnHeart]);

  const startLive = useCallback(() => {
    setIsLive(true);
    setViewers(randInt(50, 300));
    setLikes(0);
    setComments([]);
    setTotalCoins(0);
    setElapsed(0);

    addComment("TikTok", "🎉 Le live a démarré !", false);

    // Viewer fluctuation
    const v = setInterval(() => {
      setViewers(prev => Math.max(1, prev + randInt(-15, 25)));
    }, 3000);

    // Auto comments
    const c = setInterval(() => {
      if (Math.random() < 0.85) {
        addComment(rand(FAKE_NAMES), rand(COMMENTS));
      }
    }, randInt(800, 1800));

    // Auto likes
    const l = setInterval(() => {
      setLikes(prev => prev + randInt(1, 12));
      for (let i = 0; i < randInt(1, 3); i++) {
        setTimeout(spawnHeart, i * 200);
      }
    }, 1500);

    // Random gifts
    const g = setInterval(() => {
      if (Math.random() < 0.3) triggerGift();
    }, 5000);

    // Timer
    const ti = setInterval(() => setElapsed(prev => prev + 1), 1000);

    intervalsRef.current = [v, c, l, g, ti];
  }, [addComment, spawnHeart, triggerGift]);

  const stopLive = useCallback(() => {
    setIsLive(false);
    intervalsRef.current.forEach(clearInterval);
    intervalsRef.current = [];
    addComment("TikTok", "👋 Le live est terminé.", false);
  }, [addComment]);

  // Re-bind triggerGift when it changes
  useEffect(() => {
    if (!isLive) return;
    const g = setInterval(() => {
      if (Math.random() < 0.3) triggerGift();
    }, 5000);
    return () => clearInterval(g);
  }, [isLive, triggerGift]);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  const sendComment = () => {
    if (!inputComment.trim()) return;
    addComment(username, inputComment.trim());
    setInputComment("");
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  return (
    <div className="tiktok-wrapper">
      {/* Phone frame */}
      <div className="phone-frame">

        {/* Screen */}
        <div className="phone-screen">

          {/* Video background */}
          <div className="video-bg">
            <div className="video-gradient" />
            <div className={`video-pulse ${isLive ? "active" : ""}`} />
            {!isLive && (
              <div className="offline-overlay">
                <div className="avatar-big">🎥</div>
                <p className="offline-text">Prêt à streamer</p>
              </div>
            )}
          </div>

          {/* Top bar */}
          <div className="top-bar">
            <div className="top-left">
              {isLive && <span className="live-badge">LIVE</span>}
              <span className="username-top">@{username}</span>
            </div>
            <div className="top-right">
              <div className="viewers-count">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                {viewers.toLocaleString()}
              </div>
              {isLive && (
                <button className="btn-end" onClick={stopLive}>✕</button>
              )}
            </div>
          </div>

          {/* Stats row */}
          {isLive && (
            <div className="stats-row">
              <span className="stat">❤️ {likes.toLocaleString()}</span>
              <span className="stat">🪙 {totalCoins.toLocaleString()}</span>
              <span className="stat timer">⏱ {formatTime(elapsed)}</span>
            </div>
          )}

          {/* Gift notifications */}
          <div className="gift-notifs-container">
            {giftNotifs.map(g => (
              <GiftNotif key={g.id} {...g} onDone={removeGiftNotif} />
            ))}
          </div>

          {/* Comments */}
          <div className="comments-area">
            {comments.map(c => (
              <div key={c.id} className={`comment-line ${c.isGift ? "gift-comment" : ""}`}
                style={c.giftColor ? { borderLeft: `3px solid ${c.giftColor}` } : {}}>
                <span className="comment-name" style={c.name === "TikTok" ? { color: "#ff2d55" } : {}}>
                  {c.name}
                </span>
                <span className="comment-text">{c.text}</span>
              </div>
            ))}
            <div ref={commentsEndRef} />
          </div>

          {/* Floating hearts */}
          <div className="hearts-container">
            {hearts.map(h => (
              <FloatingHeart key={h.id} {...h} onDone={removeHeart} />
            ))}
          </div>

          {/* Bottom bar */}
          <div className="bottom-bar">
            {isLive ? (
              <>
                <input
                  className="comment-input"
                  placeholder="Écrire un commentaire..."
                  value={inputComment}
                  onChange={e => setInputComment(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendComment()}
                />
                <button className="btn-send" onClick={sendComment}>➤</button>
                <button className="btn-gift" onClick={triggerGift}>🎁</button>
                <button className="btn-heart" onClick={() => { setLikes(l => l + 1); spawnHeart(); }}>❤️</button>
              </>
            ) : (
              <button className="btn-go-live" onClick={startLive}>
                <span className="go-live-dot" />
                Démarrer le LIVE
              </button>
            )}
          </div>

        </div>{/* phone-screen */}
      </div>{/* phone-frame */}
    </div>
  );
}
