import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;

app.use(express.json());

// Persistent leaderboard data storage
const DATA_DIR = path.resolve(process.cwd(), 'data');
const LEADERBOARD_FILE = path.join(DATA_DIR, 'leaderboard.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export interface LeaderboardEntry {
  id: string;
  playerName: string;
  score: number;
  coins: number;
  timeSeconds: number;
  mode: 'adventure' | 'survival' | 'challenge' | 'mystery' | 'multiplayer';
  level: number;
  country: string;
  createdAt: string;
}

const DEFAULT_LEADERBOARD: LeaderboardEntry[] = [
  {
    id: 'seed-1',
    playerName: '🎪 NeonPhantom',
    score: 9850,
    coins: 92,
    timeSeconds: 24.8,
    mode: 'adventure',
    level: 1,
    country: 'JP',
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    id: 'seed-2',
    playerName: '⚡ CarnivalQueen',
    score: 9420,
    coins: 88,
    timeSeconds: 26.3,
    mode: 'adventure',
    level: 1,
    country: 'GB',
    createdAt: new Date(Date.now() - 3600000 * 12).toISOString(),
  },
  {
    id: 'seed-3',
    playerName: '🤡 RingmasterBane',
    score: 18400,
    coins: 165,
    timeSeconds: 142.0,
    mode: 'survival',
    level: 14,
    country: 'US',
    createdAt: new Date(Date.now() - 3600000 * 20).toISOString(),
  },
  {
    id: 'seed-4',
    playerName: '🔥 SpeedJumper',
    score: 9100,
    coins: 79,
    timeSeconds: 27.9,
    mode: 'challenge',
    level: 1,
    country: 'BR',
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
  {
    id: 'seed-5',
    playerName: '🌟 PixelAcrobat',
    score: 15200,
    coins: 134,
    timeSeconds: 118.5,
    mode: 'survival',
    level: 11,
    country: 'DE',
    createdAt: new Date(Date.now() - 3600000 * 30).toISOString(),
  },
  {
    id: 'seed-6',
    playerName: '🚀 TurboClown',
    score: 8750,
    coins: 74,
    timeSeconds: 29.4,
    mode: 'multiplayer',
    level: 1,
    country: 'KR',
    createdAt: new Date(Date.now() - 3600000 * 42).toISOString(),
  },
  {
    id: 'seed-7',
    playerName: '🎪 ShadowRunner',
    score: 8320,
    coins: 68,
    timeSeconds: 31.0,
    mode: 'adventure',
    level: 1,
    country: 'CA',
    createdAt: new Date(Date.now() - 3600000 * 50).toISOString(),
  },
  {
    id: 'seed-8',
    playerName: '⚡ BlitzEscape',
    score: 8100,
    coins: 65,
    timeSeconds: 31.8,
    mode: 'multiplayer',
    level: 1,
    country: 'FR',
    createdAt: new Date(Date.now() - 3600000 * 65).toISOString(),
  },
  {
    id: 'seed-9',
    playerName: '👑 LagosPhantom',
    score: 13800,
    coins: 120,
    timeSeconds: 98.2,
    mode: 'survival',
    level: 9,
    country: 'NG',
    createdAt: new Date(Date.now() - 3600000 * 75).toISOString(),
  },
  {
    id: 'seed-10',
    playerName: '🎯 OutbackDash',
    score: 7950,
    coins: 62,
    timeSeconds: 33.1,
    mode: 'challenge',
    level: 1,
    country: 'AU',
    createdAt: new Date(Date.now() - 3600000 * 90).toISOString(),
  },
];

let leaderboardCache: LeaderboardEntry[] = [];
try {
  if (fs.existsSync(LEADERBOARD_FILE)) {
    const raw = fs.readFileSync(LEADERBOARD_FILE, 'utf-8');
    leaderboardCache = JSON.parse(raw);
  } else {
    leaderboardCache = [...DEFAULT_LEADERBOARD];
    fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(leaderboardCache, null, 2));
  }
} catch (e) {
  console.error('Failed reading leaderboard file, using defaults', e);
  leaderboardCache = [...DEFAULT_LEADERBOARD];
}

function saveLeaderboard() {
  try {
    fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(leaderboardCache, null, 2));
  } catch (e) {
    console.error('Failed writing leaderboard file', e);
  }
}

// REST Endpoints
app.get('/api/leaderboard', (req, res) => {
  const mode = req.query.mode as string | undefined;
  let results = [...leaderboardCache];

  if (mode && mode !== 'all') {
    results = results.filter((entry) => entry.mode === mode);
  }

  // Sort primarily by score descending (or time ascending if equal)
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.timeSeconds - b.timeSeconds;
  });

  res.json({
    success: true,
    count: results.length,
    leaderboard: results.slice(0, 50),
  });
});

app.post('/api/leaderboard', (req, res) => {
  const { playerName, score, coins, timeSeconds, mode, level, country } = req.body;

  if (!playerName || typeof score !== 'number') {
    return res.status(400).json({ success: false, error: 'Invalid payload' });
  }

  const cleanName = String(playerName).trim().slice(0, 24) || 'Carnival Guest';
  const newEntry: LeaderboardEntry = {
    id: `run-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    playerName: cleanName,
    score: Math.max(0, Math.floor(score)),
    coins: Math.max(0, Math.floor(coins || 0)),
    timeSeconds: Number((timeSeconds || 0).toFixed(1)),
    mode: mode || 'adventure',
    level: Math.max(1, Math.floor(level || 1)),
    country: (country || 'GLOBAL').slice(0, 6).toUpperCase(),
    createdAt: new Date().toISOString(),
  };

  leaderboardCache.push(newEntry);
  // Keep cache reasonable size
  if (leaderboardCache.length > 500) {
    leaderboardCache.sort((a, b) => b.score - a.score);
    leaderboardCache = leaderboardCache.slice(0, 500);
  }
  saveLeaderboard();

  // Find rank of new entry
  const sorted = [...leaderboardCache].sort((a, b) => b.score - a.score);
  const rank = sorted.findIndex((e) => e.id === newEntry.id) + 1;

  res.json({
    success: true,
    entry: newEntry,
    rank,
  });
});

// Multiplayer WebSocket Server
interface PlayerState {
  id: string;
  ws: WebSocket;
  name: string;
  color: string;
  country: string;
  x: number;
  y: number;
  z: number;
  isJumping: boolean;
  coins: number;
  lives: number;
  status: 'ready' | 'running' | 'escaped' | 'eliminated';
  escapedTime?: number;
  rank?: number;
  progress: number;
  lastUpdate: number;
}

interface Room {
  id: string;
  name: string;
  isPublic: boolean;
  maxPlayers: number;
  status: 'waiting' | 'countdown' | 'in_progress' | 'finished';
  countdown: number;
  seed: number;
  createdAt: number;
  players: Map<string, PlayerState>;
  finishOrder: string[];
}

const rooms = new Map<string, Room>();

function getPublicRooms() {
  const list: any[] = [];
  rooms.forEach((r) => {
    if (r.isPublic) {
      list.push({
        id: r.id,
        name: r.name,
        playerCount: r.players.size,
        maxPlayers: r.maxPlayers,
        status: r.status,
      });
    }
  });
  return list;
}

app.get('/api/multiplayer/rooms', (_req, res) => {
  res.json({ success: true, rooms: getPublicRooms() });
});

function getOrCreateRoom(roomId: string, roomName?: string, isPublic = true): Room {
  let room = rooms.get(roomId);
  if (!room) {
    room = {
      id: roomId,
      name: roomName || `Carnival Arena ${roomId}`,
      isPublic,
      maxPlayers: 8,
      status: 'waiting',
      countdown: 3,
      seed: Math.floor(Math.random() * 1000000),
      createdAt: Date.now(),
      players: new Map(),
      finishOrder: [],
    };
    rooms.set(roomId, room);
  }
  return room;
}

function broadcastToRoom(room: Room, message: any, excludePlayerId?: string) {
  const payload = JSON.stringify(message);
  room.players.forEach((p) => {
    if (excludePlayerId && p.id === excludePlayerId) return;
    if (p.ws.readyState === WebSocket.OPEN) {
      try {
        p.ws.send(payload);
      } catch (err) {
        console.error('Error sending ws payload:', err);
      }
    }
  });
}

function sendRoomState(room: Room) {
  const playersList = Array.from(room.players.values()).map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
    country: p.country,
    x: p.x,
    y: p.y,
    z: p.z,
    isJumping: p.isJumping,
    coins: p.coins,
    lives: p.lives,
    status: p.status,
    progress: p.progress,
    escapedTime: p.escapedTime,
    rank: p.rank,
  }));

  broadcastToRoom(room, {
    type: 'room_state',
    roomId: room.id,
    status: room.status,
    countdown: room.countdown,
    seed: room.seed,
    players: playersList,
  });
}

function startCountdown(room: Room) {
  if (room.status !== 'waiting') return;
  room.status = 'countdown';
  room.countdown = 3;

  broadcastToRoom(room, {
    type: 'countdown_tick',
    countdown: room.countdown,
  });

  const interval = setInterval(() => {
    room.countdown--;
    if (room.countdown > 0) {
      broadcastToRoom(room, {
        type: 'countdown_tick',
        countdown: room.countdown,
      });
    } else {
      clearInterval(interval);
      room.status = 'in_progress';
      room.finishOrder = [];
      room.players.forEach((p) => {
        p.status = 'running';
        p.x = 0;
        p.y = 0;
        p.z = 5;
        p.coins = 0;
        p.lives = 3;
        p.progress = 0;
        p.escapedTime = undefined;
        p.rank = undefined;
      });

      broadcastToRoom(room, {
        type: 'game_started',
        seed: room.seed,
      });
      sendRoomState(room);
    }
  }, 1000);
}

// WebSocket Connection Management
wss.on('connection', (ws: WebSocket) => {
  let currentRoomId: string | null = null;
  let playerId: string = `p-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw.toString());

      if (data.type === 'join_room') {
        const targetRoomId = data.roomId || 'global-carnival-1';
        const room = getOrCreateRoom(targetRoomId, data.roomName, data.isPublic !== false);

        if (room.players.size >= room.maxPlayers && !room.players.has(playerId)) {
          ws.send(JSON.stringify({ type: 'error', message: 'Room is full (max 8 players)' }));
          return;
        }

        currentRoomId = targetRoomId;
        const playerState: PlayerState = {
          id: playerId,
          ws,
          name: data.playerName || 'Carnival Runner',
          color: data.playerColor || '#39bfff',
          country: data.country || 'GLOBAL',
          x: (Math.random() - 0.5) * 4,
          y: 0,
          z: 5,
          isJumping: false,
          coins: 0,
          lives: 3,
          status: 'ready',
          progress: 0,
          lastUpdate: Date.now(),
        };

        room.players.set(playerId, playerState);

        ws.send(
          JSON.stringify({
            type: 'joined_success',
            playerId,
            roomId: room.id,
            seed: room.seed,
            status: room.status,
          })
        );

        sendRoomState(room);

        // Auto start countdown if 2+ players in public room and still waiting
        if (room.players.size >= 2 && room.status === 'waiting') {
          startCountdown(room);
        }
      } else if (data.type === 'request_start') {
        if (!currentRoomId) return;
        const room = rooms.get(currentRoomId);
        if (room && (room.status === 'waiting' || room.status === 'finished')) {
          if (room.status === 'finished') {
            room.status = 'waiting';
            room.seed = Math.floor(Math.random() * 1000000);
          }
          startCountdown(room);
        }
      } else if (data.type === 'player_update') {
        if (!currentRoomId) return;
        const room = rooms.get(currentRoomId);
        if (!room) return;
        const p = room.players.get(playerId);
        if (!p) return;

        p.x = typeof data.x === 'number' ? data.x : p.x;
        p.y = typeof data.y === 'number' ? data.y : p.y;
        p.z = typeof data.z === 'number' ? data.z : p.z;
        p.isJumping = !!data.isJumping;
        p.coins = typeof data.coins === 'number' ? data.coins : p.coins;
        p.lives = typeof data.lives === 'number' ? data.lives : p.lives;
        p.progress = typeof data.progress === 'number' ? data.progress : p.progress;
        p.lastUpdate = Date.now();

        // Broadcast delta position to other players
        broadcastToRoom(
          room,
          {
            type: 'player_moved',
            playerId: p.id,
            x: p.x,
            y: p.y,
            z: p.z,
            isJumping: p.isJumping,
            coins: p.coins,
            lives: p.lives,
            progress: p.progress,
          },
          playerId
        );
      } else if (data.type === 'player_escaped') {
        if (!currentRoomId) return;
        const room = rooms.get(currentRoomId);
        if (!room) return;
        const p = room.players.get(playerId);
        if (!p || p.status === 'escaped') return;

        const escapedTime = typeof data.timeSeconds === 'number' ? data.timeSeconds : 0;
        p.status = 'escaped';
        p.escapedTime = escapedTime;
        p.coins = data.coins || p.coins;
        room.finishOrder.push(p.id);
        p.rank = room.finishOrder.length;

        // Also auto-post to leaderboard!
        const score = Math.max(100, Math.floor(10000 - escapedTime * 150 + p.coins * 50));
        const newEntry: LeaderboardEntry = {
          id: `mp-${Date.now()}-${p.id}`,
          playerName: p.name,
          score,
          coins: p.coins,
          timeSeconds: Number(escapedTime.toFixed(1)),
          mode: 'multiplayer',
          level: 1,
          country: p.country,
          createdAt: new Date().toISOString(),
        };
        leaderboardCache.push(newEntry);
        saveLeaderboard();

        broadcastToRoom(room, {
          type: 'player_finished',
          playerId: p.id,
          playerName: p.name,
          rank: p.rank,
          timeSeconds: escapedTime,
          coins: p.coins,
        });

        // Check if all players finished or eliminated
        const active = Array.from(room.players.values()).filter(
          (pl) => pl.status === 'running'
        );
        if (active.length === 0) {
          room.status = 'finished';
          sendRoomState(room);
        }
      } else if (data.type === 'player_eliminated') {
        if (!currentRoomId) return;
        const room = rooms.get(currentRoomId);
        if (!room) return;
        const p = room.players.get(playerId);
        if (!p) return;

        p.status = 'eliminated';
        broadcastToRoom(room, {
          type: 'player_died',
          playerId: p.id,
          playerName: p.name,
          reason: data.reason || 'Caught by the carnival traps',
        });

        const active = Array.from(room.players.values()).filter(
          (pl) => pl.status === 'running'
        );
        if (active.length === 0) {
          room.status = 'finished';
          sendRoomState(room);
        }
      } else if (data.type === 'send_reaction') {
        if (!currentRoomId) return;
        const room = rooms.get(currentRoomId);
        if (!room) return;
        const p = room.players.get(playerId);
        const emoji = data.emoji || '🎪';

        broadcastToRoom(room, {
          type: 'reaction',
          playerId,
          playerName: p?.name || 'Guest',
          emoji,
        });
      } else if (data.type === 'chat_message') {
        if (!currentRoomId) return;
        const room = rooms.get(currentRoomId);
        if (!room) return;
        const p = room.players.get(playerId);
        const text = String(data.text || '').trim().slice(0, 100);
        if (!text) return;

        broadcastToRoom(room, {
          type: 'chat',
          playerId,
          playerName: p?.name || 'Guest',
          playerColor: p?.color || '#39bfff',
          text,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });
      }
    } catch (err) {
      console.error('Error parsing ws message:', err);
    }
  });

  ws.on('close', () => {
    if (currentRoomId) {
      const room = rooms.get(currentRoomId);
      if (room) {
        room.players.delete(playerId);
        if (room.players.size === 0) {
          rooms.delete(currentRoomId);
        } else {
          broadcastToRoom(room, {
            type: 'player_left',
            playerId,
          });
          sendRoomState(room);
        }
      }
    }
  });
});

// Periodic room tick & state sync (every 500ms for status check)
setInterval(() => {
  rooms.forEach((room, id) => {
    if (room.players.size === 0) {
      rooms.delete(id);
    }
  });
}, 5000);

// Setup Vite or static serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  }

  server.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`NO ESCAPE server listening on 0.0.0.0:${PORT}`);
  });
}

startServer();
