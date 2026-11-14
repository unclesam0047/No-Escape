import React, { useEffect, useRef, useState } from 'react';
import { GameMode, PlayerProfile, RemotePlayer } from '../types/game';
import { soundEngine } from '../utils/audio';
import { getFlag } from '../utils/playerStorage';
import {
  computeDistanceMap,
  findNextStepToward,
  generateMaze,
  MazeCell,
  MazeData,
} from '../utils/mazeGenerator';
import {
  Heart,
  Coins,
  Timer,
  Pause,
  Volume2,
  VolumeX,
  Compass,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface GameCanvasProps {
  mode: GameMode;
  profile: PlayerProfile;
  multiplayerSocket?: WebSocket | null;
  multiplayerSeed?: number;
  initialRemotePlayers?: RemotePlayer[];
  onFinishGame: (result: {
    escaped: boolean;
    score: number;
    coins: number;
    timeSeconds: number;
    level: number;
    mode: GameMode;
    rank?: number;
  }) => void;
  onExitToMenu: () => void;
}

interface FloatingParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface RemoteVisualState {
  id: string;
  name: string;
  color: string;
  country: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  jumpHeight: number;
  isJumping: boolean;
  coins: number;
  lives: number;
  progress: number;
  status: 'ready' | 'running' | 'escaped' | 'eliminated';
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  mode,
  profile,
  multiplayerSocket,
  multiplayerSeed,
  initialRemotePlayers,
  onFinishGame,
  onExitToMenu,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [lives, setLives] = useState<number>(3);
  const [coins, setCoins] = useState<number>(0);
  const [timerSec, setTimerSec] = useState<number>(0);
  const [level, setLevel] = useState<number>(1);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [clownMessage, setClownMessage] = useState<string | null>(
    'Welcome to the Carnival Maze! Find the Golden Exit Gate!'
  );
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(soundEngine.getMuted());
  const [showControls, setShowControls] = useState<boolean>(true);
  const [blackoutActive, setBlackoutActive] = useState<boolean>(false);
  const [remoteRoster, setRemoteRoster] = useState<RemotePlayer[]>(
    initialRemotePlayers || []
  );

  const socketRef = useRef<WebSocket | null>(multiplayerSocket || null);
  const isPausedRef = useRef<boolean>(false);
  const gameRunningRef = useRef<boolean>(true);
  const keysRef = useRef<Record<string, boolean>>({});
  const dragVectorRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragOriginRef = useRef<{ id: number; x: number; y: number } | null>(null);
  const jumpRequestRef = useRef<boolean>(false);
  const announcementTimerRef = useRef<number | null>(null);
  const clownTimerRef = useRef<number | null>(null);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    soundEngine.startCarnivalBeat();
    return () => {
      soundEngine.stopCarnivalBeat();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const baseSeed = multiplayerSeed || Math.floor(Math.random() * 1000000);
    let currentLevel = 1;
    let maze: MazeData = generateMaze(baseSeed, {
      cols: 21,
      rows: 21,
      cellSize: 58,
      level: currentLevel,
    });

    // Explored tiles for minimap fog in Mystery / Blackout
    let explored: boolean[][] = Array.from({ length: maze.rows }, () =>
      Array(maze.cols).fill(mode !== 'mystery')
    );

    const markExploredAround = (px: number, py: number, radiusCells = 3) => {
      const pc = Math.floor(px / maze.cellSize);
      const pr = Math.floor(py / maze.cellSize);
      for (let dr = -radiusCells; dr <= radiusCells; dr++) {
        for (let dc = -radiusCells; dc <= radiusCells; dc++) {
          const nr = pr + dr;
          const nc = pc + dc;
          if (nr >= 0 && nr < maze.rows && nc >= 0 && nc < maze.cols) {
            explored[nr][nc] = true;
          }
        }
      }
    };

    // Player physics state
    const player = {
      x: (maze.start.col + 0.5) * maze.cellSize,
      y: (maze.start.row + 0.5) * maze.cellSize,
      vx: 0,
      vy: 0,
      facingX: 1,
      facingY: 0,
      radius: maze.cellSize * 0.27,
      jumpHeight: 0, // 0 = ground, > 0 = airborne
      jumpV: 0,
      onGround: true,
      invulnTimer: 0,
      shakeTimer: 0,
    };
    markExploredAround(player.x, player.y, 4);

    // Camera centered on player
    const camera = {
      x: player.x,
      y: player.y,
    };

    // Ringmaster (The Clown) chasing state
    const clown = {
      active: false,
      x: (maze.exit.col + 0.5) * maze.cellSize,
      y: (maze.exit.row + 0.5) * maze.cellSize,
      timer: 0,
      bobPhase: 0,
    };

    // Particles
    const particles: FloatingParticle[] = [];
    const spawnParticles = (
      x: number,
      y: number,
      color: string,
      count = 10,
      speed = 110
    ) => {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const mag = (0.3 + Math.random() * 0.7) * speed;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * mag,
          vy: Math.sin(angle) * mag,
          life: 0.4 + Math.random() * 0.35,
          maxLife: 0.75,
          color,
          size: 2.5 + Math.random() * 3,
        });
      }
    };

    // Remote players map
    const remoteMap = new Map<string, RemoteVisualState>();
    if (initialRemotePlayers) {
      initialRemotePlayers.forEach((rp) => {
        if (rp.name !== profile.name) {
          const sx = (maze.start.col + 0.5) * maze.cellSize;
          const sy = (maze.start.row + 0.5) * maze.cellSize;
          remoteMap.set(rp.id, {
            id: rp.id,
            name: rp.name,
            color: rp.color,
            country: rp.country,
            x: sx,
            y: sy,
            targetX: sx,
            targetY: sy,
            jumpHeight: 0,
            isJumping: false,
            coins: rp.coins || 0,
            lives: rp.lives ?? 3,
            progress: rp.progress || 0,
            status: rp.status || 'running',
          });
        }
      });
    }

    let currentLives = 3;
    let currentCoins = 0;
    let elapsedActiveSec = 0;
    let nextEventAt = mode === 'mystery' ? 4.5 : 8.5;
    let blackoutRemaining = mode === 'mystery' ? 4.0 : 0;
    let trapSpeedBoostRemaining = 0;
    let lastWsSend = 0;
    let myRankFromServer: number | undefined = undefined;

    if (mode === 'mystery') {
      setBlackoutActive(true);
    }

    const announce = (text: string) => {
      setAnnouncement(text);
      if (announcementTimerRef.current) {
        window.clearTimeout(announcementTimerRef.current);
      }
      announcementTimerRef.current = window.setTimeout(() => {
        setAnnouncement(null);
      }, 2500);
    };

    const spawnRingmasterNearPlayer = () => {
      // Find an open cell 4-7 tiles away from player
      const pc = Math.floor(player.x / maze.cellSize);
      const pr = Math.floor(player.y / maze.cellSize);
      const candidates: MazeCell[] = [];
      for (let r = 1; r < maze.rows - 1; r++) {
        for (let c = 1; c < maze.cols - 1; c++) {
          if (maze.grid[r][c] === 0) {
            const d = Math.abs(c - pc) + Math.abs(r - pr);
            if (d >= 5 && d <= 8) {
              candidates.push({ col: c, row: r });
            }
          }
        }
      }
      if (candidates.length > 0) {
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        clown.x = (pick.col + 0.5) * maze.cellSize;
        clown.y = (pick.row + 0.5) * maze.cellSize;
      } else {
        clown.x = (maze.exit.col + 0.5) * maze.cellSize;
        clown.y = (maze.exit.row + 0.5) * maze.cellSize;
      }
      clown.active = true;
      clown.timer = 5.2;
      spawnParticles(clown.x, clown.y, '#ff3ea5', 16, 140);
    };

    const speakClown = (text: string, spawnChase = true) => {
      setClownMessage(text);
      soundEngine.playClownLaugh();
      if (spawnChase) {
        spawnRingmasterNearPlayer();
      }
      if (clownTimerRef.current) {
        window.clearTimeout(clownTimerRef.current);
      }
      clownTimerRef.current = window.setTimeout(() => {
        setClownMessage(null);
      }, 4200);
    };

    // Initial welcome timer
    clownTimerRef.current = window.setTimeout(() => {
      setClownMessage(null);
    }, 3800);

    const handleJump = () => {
      if (gameRunningRef.current && !isPausedRef.current && player.onGround) {
        player.jumpV = 3.6;
        player.onGround = false;
        soundEngine.playJumpSound();
        spawnParticles(player.x, player.y, '#55eaff', 8, 90);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keysRef.current[k] = true;
      if (e.code === 'Space') {
        e.preventDefault();
        handleJump();
      }
      if (e.key === 'Escape') {
        setIsPaused((p) => !p);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const hitTrap = (reason = 'Caught by carnival traps') => {
      if (player.invulnTimer > 0 || !gameRunningRef.current) return;
      currentLives--;
      setLives(currentLives);
      player.invulnTimer = 1.4;
      player.shakeTimer = 0.35;
      soundEngine.playHitSound();
      spawnParticles(player.x, player.y, '#ff2a5f', 18, 170);
      announce('💥 TRAP HIT! Watch your step!');

      if (currentLives <= 0) {
        gameRunningRef.current = false;
        const finalTime = Number(elapsedActiveSec.toFixed(1));
        const finalScore = Math.max(
          10,
          currentCoins * 60 + currentLevel * 500
        );

        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.send(
            JSON.stringify({
              type: 'player_eliminated',
              reason,
            })
          );
        }

        onFinishGame({
          escaped: false,
          score: finalScore,
          coins: currentCoins,
          timeSeconds: finalTime,
          level: currentLevel,
          mode,
        });
      }
    };

    const triggerRandomEvent = () => {
      const events = [
        '🎪 BLACKOUT! Spotlight mode active!',
        '⚡ DOUBLE TROUBLE! Maze traps speeding up!',
        '🪙 COIN STORM! Bonus coins dropped in the maze!',
        '🌀 THE MAZE IS SHIFTING! New paths opened!',
        '🤡 RINGMASTER AMBUSH! Run for cover!',
      ];
      const ev = events[Math.floor(Math.random() * events.length)];
      announce(ev);

      if (ev.includes('BLACKOUT')) {
        blackoutRemaining = mode === 'mystery' ? 6.0 : 4.2;
        setBlackoutActive(true);
      } else if (ev.includes('DOUBLE TROUBLE')) {
        trapSpeedBoostRemaining = 5.5;
      } else if (ev.includes('COIN STORM')) {
        let added = 0;
        for (let r = 1; r < maze.rows - 1 && added < 7; r++) {
          for (let c = 1; c < maze.cols - 1 && added < 7; c++) {
            if (maze.grid[r][c] === 0 && Math.random() < 0.08) {
              const cx = (c + 0.5) * maze.cellSize;
              const cy = (r + 0.5) * maze.cellSize;
              if (Math.hypot(cx - player.x, cy - player.y) < maze.cellSize * 8) {
                maze.coins.push({
                  id: `bonus-${Date.now()}-${added}`,
                  col: c,
                  row: r,
                  x: cx,
                  y: cy,
                  collected: false,
                  bonus: true,
                });
                added++;
              }
            }
          }
        }
      } else if (ev.includes('SHIFTING')) {
        // Toggle safe dynamic walls while verifying path to exit remains valid
        const pc = Math.max(1, Math.min(maze.cols - 2, Math.floor(player.x / maze.cellSize)));
        const pr = Math.max(1, Math.min(maze.rows - 2, Math.floor(player.y / maze.cellSize)));
        for (const dw of maze.dynamicWalls) {
          if (dw.col === pc && dw.row === pr) continue;
          const prev = maze.grid[dw.row][dw.col];
          maze.grid[dw.row][dw.col] = prev === 1 ? 0 : 1;
          const test = computeDistanceMap(maze.grid, maze.exit);
          if (test.distMap[pr][pc] === Infinity) {
            // Revert if it traps the player
            maze.grid[dw.row][dw.col] = prev;
          } else {
            maze.distMap = test.distMap;
            maze.maxDist = test.maxDist;
            dw.open = maze.grid[dw.row][dw.col] === 0;
          }
        }
      }

      if (ev.includes('RINGMASTER') || Math.random() < 0.5) {
        speakClown(ev, true);
      }

      nextEventAt = elapsedActiveSec + (mode === 'mystery' ? 6.2 : 9.0);
    };

    // WebSocket Incoming Updates Handler
    if (socketRef.current) {
      socketRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'player_moved') {
            let rm = remoteMap.get(data.playerId);
            if (!rm) {
              rm = {
                id: data.playerId,
                name: 'Racer',
                color: '#ff3ea5',
                country: 'GLOBAL',
                x: data.x,
                y: data.z,
                targetX: data.x,
                targetY: data.z,
                jumpHeight: data.y || 0,
                isJumping: !!data.isJumping,
                coins: data.coins || 0,
                lives: data.lives ?? 3,
                progress: data.progress || 0,
                status: 'running',
              };
              remoteMap.set(data.playerId, rm);
            } else {
              rm.targetX = data.x;
              rm.targetY = data.z;
              rm.jumpHeight = data.y || 0;
              rm.isJumping = !!data.isJumping;
              rm.coins = data.coins ?? rm.coins;
              rm.lives = data.lives ?? rm.lives;
              rm.progress = data.progress ?? rm.progress;
            }

            setRemoteRoster((prev) =>
              prev.map((p) =>
                p.id === data.playerId
                  ? {
                      ...p,
                      x: data.x,
                      y: data.y,
                      z: data.z,
                      progress: data.progress,
                      coins: data.coins,
                      lives: data.lives,
                    }
                  : p
              )
            );
          } else if (data.type === 'room_state' && Array.isArray(data.players)) {
            setRemoteRoster(data.players);
            data.players.forEach((rp: RemotePlayer) => {
              if (rp.name !== profile.name) {
                const existing = remoteMap.get(rp.id);
                if (existing) {
                  existing.name = rp.name;
                  existing.color = rp.color;
                  existing.country = rp.country;
                  existing.status = rp.status;
                }
              }
            });
          } else if (data.type === 'player_finished') {
            announce(
              `🏁 ${data.playerName} escaped the maze! (Rank #${data.rank})`
            );
            const rm = remoteMap.get(data.playerId);
            if (rm) rm.status = 'escaped';
            if (data.playerName === profile.name) {
              myRankFromServer = data.rank;
            }
            soundEngine.playVictorySound();
          } else if (data.type === 'player_died') {
            announce(`💀 ${data.playerName} was eliminated!`);
            const rm = remoteMap.get(data.playerId);
            if (rm) rm.status = 'eliminated';
          } else if (data.type === 'player_left') {
            remoteMap.delete(data.playerId);
          } else if (data.type === 'reaction') {
            announce(`${data.playerName}: ${data.emoji}`);
          }
        } catch (err) {
          console.error('WS game update error:', err);
        }
      };
    }

    // Circle vs Grid Wall collision with smooth corner sliding
    const isWallAt = (col: number, row: number) => {
      if (row < 0 || row >= maze.rows || col < 0 || col >= maze.cols) return true;
      return maze.grid[row][col] === 1;
    };

    const collidesWithWalls = (cx: number, cy: number, r: number): boolean => {
      const minC = Math.floor((cx - r) / maze.cellSize);
      const maxC = Math.floor((cx + r) / maze.cellSize);
      const minR = Math.floor((cy - r) / maze.cellSize);
      const maxR = Math.floor((cy + r) / maze.cellSize);

      for (let row = minR; row <= maxR; row++) {
        for (let col = minC; col <= maxC; col++) {
          if (isWallAt(col, row)) {
            const wallX = col * maze.cellSize;
            const wallY = row * maze.cellSize;
            const nearestX = Math.max(wallX, Math.min(cx, wallX + maze.cellSize));
            const nearestY = Math.max(wallY, Math.min(cy, wallY + maze.cellSize));
            const dx = cx - nearestX;
            const dy = cy - nearestY;
            if (dx * dx + dy * dy < r * r) {
              return true;
            }
          }
        }
      }
      return false;
    };

    const moveWithSlide = (dx: number, dy: number) => {
      const r = player.radius;
      // Try X
      if (dx !== 0) {
        if (!collidesWithWalls(player.x + dx, player.y, r)) {
          player.x += dx;
        } else {
          // Corner-assist nudge vertically toward open corridor center
          const rowCenter = (Math.floor(player.y / maze.cellSize) + 0.5) * maze.cellSize;
          const offset = rowCenter - player.y;
          if (Math.abs(offset) > 1 && Math.abs(offset) < maze.cellSize * 0.42) {
            const nudge = Math.sign(offset) * Math.min(Math.abs(offset), Math.abs(dx) * 0.85);
            if (!collidesWithWalls(player.x, player.y + nudge, r)) {
              player.y += nudge;
            }
          }
        }
      }
      // Try Y
      if (dy !== 0) {
        if (!collidesWithWalls(player.x, player.y + dy, r)) {
          player.y += dy;
        } else {
          const colCenter = (Math.floor(player.x / maze.cellSize) + 0.5) * maze.cellSize;
          const offset = colCenter - player.x;
          if (Math.abs(offset) > 1 && Math.abs(offset) < maze.cellSize * 0.42) {
            const nudge = Math.sign(offset) * Math.min(Math.abs(offset), Math.abs(dy) * 0.85);
            if (!collidesWithWalls(player.x + nudge, player.y, r)) {
              player.x += nudge;
            }
          }
        }
      }
    };

    // Canvas resize sync
    const syncCanvasSize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = container.clientWidth;
      const h = container.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    syncCanvasSize();
    window.addEventListener('resize', syncCanvasSize);

    let frameId = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      frameId = requestAnimationFrame(tick);
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(rawDt, 0.05);

      if (!gameRunningRef.current) return;

      const viewW = container.clientWidth;
      const viewH = container.clientHeight;

      if (!isPausedRef.current) {
        elapsedActiveSec += dt;
        setTimerSec(Math.floor(elapsedActiveSec));

        if (jumpRequestRef.current) {
          jumpRequestRef.current = false;
          handleJump();
        }

        // Player Movement Speed
        let moveSpeed = 245;
        if (mode === 'challenge') moveSpeed = 285;
        if (mode === 'survival') moveSpeed = 250 + Math.min(90, (currentLevel - 1) * 14);
        if (mode === 'multiplayer') moveSpeed = 255;
        if (!player.onGround) moveSpeed *= 1.15; // slight leap boost

        const keys = keysRef.current;
        let ix =
          (keys['arrowright'] || keys['d'] ? 1 : 0) -
          (keys['arrowleft'] || keys['a'] ? 1 : 0) +
          dragVectorRef.current.x;
        let iy =
          (keys['arrowdown'] || keys['s'] ? 1 : 0) -
          (keys['arrowup'] || keys['w'] ? 1 : 0) +
          dragVectorRef.current.y;

        if (Math.abs(ix) > 0.08 || Math.abs(iy) > 0.08) {
          const len = Math.hypot(ix, iy);
          ix /= len;
          iy /= len;
          player.facingX = ix;
          player.facingY = iy;
          moveWithSlide(ix * moveSpeed * dt, iy * moveSpeed * dt);
          markExploredAround(player.x, player.y, 3);

          // Subtle thruster trail particle
          if (Math.random() < 0.45) {
            particles.push({
              x: player.x - ix * 12,
              y: player.y - iy * 12,
              vx: -ix * 35 + (Math.random() - 0.5) * 20,
              vy: -iy * 35 + (Math.random() - 0.5) * 20,
              life: 0.25,
              maxLife: 0.25,
              color: player.onGround ? '#55eaff' : '#ff3ea5',
              size: player.onGround ? 2.5 : 4,
            });
          }
        }

        // Jump physics
        if (!player.onGround) {
          player.jumpHeight += player.jumpV * dt;
          player.jumpV -= 10.5 * dt;
          if (player.jumpHeight <= 0) {
            player.jumpHeight = 0;
            player.jumpV = 0;
            player.onGround = true;
          }
        }

        if (player.invulnTimer > 0) player.invulnTimer = Math.max(0, player.invulnTimer - dt);
        if (player.shakeTimer > 0) player.shakeTimer = Math.max(0, player.shakeTimer - dt);

        // Blackout & Trap Boost timers
        if (blackoutRemaining > 0) {
          blackoutRemaining -= dt;
          if (blackoutRemaining <= 0) {
            blackoutRemaining = 0;
            setBlackoutActive(false);
          }
        }
        if (trapSpeedBoostRemaining > 0) {
          trapSpeedBoostRemaining = Math.max(0, trapSpeedBoostRemaining - dt);
        }

        // Smooth camera follow
        const targetCamX = player.x + player.facingX * 26;
        const targetCamY = player.y + player.facingY * 26;
        camera.x += (targetCamX - camera.x) * Math.min(1, dt * 8);
        camera.y += (targetCamY - camera.y) * Math.min(1, dt * 8);

        // Traps update & collision
        const trapMult = trapSpeedBoostRemaining > 0 ? 1.65 : 1.0;
        const isAirborne = player.jumpHeight > 0.32;

        for (const trap of maze.traps) {
          if (trap.kind === 'saw') {
            const offset =
              Math.sin(elapsedActiveSec * trap.speed * trapMult + trap.phase) *
              trap.range;
            trap.x = trap.baseX + (trap.axis === 'x' ? offset : 0);
            trap.y = trap.baseY + (trap.axis === 'y' ? offset : 0);

            if (!isAirborne) {
              const dist = Math.hypot(player.x - trap.x, player.y - trap.y);
              if (dist < player.radius + trap.radius * 0.78) {
                hitTrap('Sliced by a carnival sawblade');
              }
            }
          } else {
            // Pulsing high-voltage laser pad (active when sin > 0.15)
            const pulse = Math.sin(
              elapsedActiveSec * trap.speed * trapMult + trap.phase
            );
            const active = pulse > 0.2;
            if (active && !isAirborne) {
              const dist = Math.hypot(player.x - trap.x, player.y - trap.y);
              if (dist < player.radius + trap.radius * 0.72) {
                hitTrap('Shocked by high-voltage barrier');
              }
            }
          }
        }

        // Coins collection
        for (const coin of maze.coins) {
          if (coin.collected) continue;
          const dist = Math.hypot(player.x - coin.x, player.y - coin.y);
          if (dist < player.radius + 14) {
            coin.collected = true;
            currentCoins += coin.bonus ? 2 : 1;
            setCoins(currentCoins);
            soundEngine.playCoinSound();
            spawnParticles(coin.x, coin.y, '#ffd66b', 10, 120);
          }
        }

        // Ringmaster stalking AI
        if (clown.active) {
          clown.timer -= dt;
          clown.bobPhase += dt * 7;
          if (clown.timer <= 0) {
            clown.active = false;
            spawnParticles(clown.x, clown.y, '#ff3ea5', 14, 120);
          } else {
            const clownCell: MazeCell = {
              col: Math.max(1, Math.min(maze.cols - 2, Math.floor(clown.x / maze.cellSize))),
              row: Math.max(1, Math.min(maze.rows - 2, Math.floor(clown.y / maze.cellSize))),
            };
            const playerCell: MazeCell = {
              col: Math.max(1, Math.min(maze.cols - 2, Math.floor(player.x / maze.cellSize))),
              row: Math.max(1, Math.min(maze.rows - 2, Math.floor(player.y / maze.cellSize))),
            };
            const nextStep = findNextStepToward(maze.grid, clownCell, playerCell);
            const tx = (nextStep.col + 0.5) * maze.cellSize;
            const ty = (nextStep.row + 0.5) * maze.cellSize;
            const dx = tx - clown.x;
            const dy = ty - clown.y;
            const d = Math.hypot(dx, dy);
            const clownSpeed = 148 + (currentLevel - 1) * 14;
            if (d > 1) {
              clown.x += (dx / d) * clownSpeed * dt;
              clown.y += (dy / d) * clownSpeed * dt;
            }
            if (
              !isAirborne &&
              Math.hypot(player.x - clown.x, player.y - clown.y) <
                player.radius + maze.cellSize * 0.28
            ) {
              hitTrap('Caught by the Ringmaster');
              clown.active = false;
            }
          }
        }

        // Random Carnival Events
        if (elapsedActiveSec > nextEventAt) {
          triggerRandomEvent();
        }

        // Update particles
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.life -= dt;
          if (p.life <= 0) particles.splice(i, 1);
        }

        // Lerp remote racers
        remoteMap.forEach((rm) => {
          rm.x += (rm.targetX - rm.x) * Math.min(1, dt * 14);
          rm.y += (rm.targetY - rm.y) * Math.min(1, dt * 14);
        });

        // Compute BFS Progress %
        const pCol = Math.max(0, Math.min(maze.cols - 1, Math.floor(player.x / maze.cellSize)));
        const pRow = Math.max(0, Math.min(maze.rows - 1, Math.floor(player.y / maze.cellSize)));
        const distToExit = maze.distMap[pRow]?.[pCol] ?? maze.maxDist;
        const rawProgress =
          maze.maxDist > 0 && isFinite(distToExit)
            ? Math.max(0, Math.min(100, Math.round((1 - distToExit / maze.maxDist) * 100)))
            : 0;
        setProgressPercent(rawProgress);

        // Throttled WebSocket sync
        if (
          socketRef.current &&
          socketRef.current.readyState === WebSocket.OPEN &&
          now - lastWsSend > 45
        ) {
          lastWsSend = now;
          socketRef.current.send(
            JSON.stringify({
              type: 'player_update',
              x: player.x,
              y: player.jumpHeight,
              z: player.y,
              isJumping: !player.onGround,
              coins: currentCoins,
              lives: currentLives,
              progress: rawProgress,
            })
          );
        }

        // Check Exit Gate Arrival
        const exitX = (maze.exit.col + 0.5) * maze.cellSize;
        const exitY = (maze.exit.row + 0.5) * maze.cellSize;
        if (Math.hypot(player.x - exitX, player.y - exitY) < maze.cellSize * 0.45) {
          if (mode === 'survival') {
            // Advance to next maze level!
            currentLevel++;
            setLevel(currentLevel);
            const nextDim = Math.min(29, 21 + Math.floor((currentLevel - 1) * 2));
            const oddDim = nextDim % 2 === 0 ? nextDim + 1 : nextDim;
            maze = generateMaze(baseSeed, {
              cols: oddDim,
              rows: oddDim,
              cellSize: 58,
              level: currentLevel,
            });
            explored = Array.from({ length: maze.rows }, () =>
              Array(maze.cols).fill(true)
            );
            player.x = (maze.start.col + 0.5) * maze.cellSize;
            player.y = (maze.start.row + 0.5) * maze.cellSize;
            camera.x = player.x;
            camera.y = player.y;
            soundEngine.playVictorySound();
            confetti({ particleCount: 70, spread: 70, origin: { y: 0.6 } });
            announce(`⭐ LEVEL ${currentLevel}! Bigger maze, faster traps!`);
            speakClown('Another lap through the labyrinth! Good luck!', false);
          } else {
            gameRunningRef.current = false;
            soundEngine.playVictorySound();
            confetti({ particleCount: 130, spread: 85, origin: { y: 0.6 } });

            const timeSec = Number(elapsedActiveSec.toFixed(1));
            const finalScore = Math.max(
              100,
              Math.floor(10000 - timeSec * 140 + currentCoins * 65)
            );

            if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
              socketRef.current.send(
                JSON.stringify({
                  type: 'player_escaped',
                  timeSeconds: timeSec,
                  coins: currentCoins,
                })
              );
            }

            onFinishGame({
              escaped: true,
              score: finalScore,
              coins: currentCoins,
              timeSeconds: timeSec,
              level: currentLevel,
              mode,
              rank: myRankFromServer,
            });
            return;
          }
        }
      }

      // ========================
      // 2D CANVAS RENDERING
      // ========================
      ctx.fillStyle = '#070713';
      ctx.fillRect(0, 0, viewW, viewH);

      const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const shakeX =
        !reducedMotion && player.shakeTimer > 0 ? (Math.random() - 0.5) * 12 : 0;
      const shakeY =
        !reducedMotion && player.shakeTimer > 0 ? (Math.random() - 0.5) * 12 : 0;

      // Adaptive camera zoom so phones & small tablets see ample maze corridors
      const camZoom = viewW < 520 ? 0.78 : viewW < 900 ? 0.9 : 1.0;
      const halfVisW = viewW / (2 * camZoom);
      const halfVisH = viewH / (2 * camZoom);

      const offsetX = viewW / 2 - camera.x * camZoom + shakeX;
      const offsetY = viewH / 2 - camera.y * camZoom + shakeY;

      ctx.save();
      ctx.translate(offsetX, offsetY);
      ctx.scale(camZoom, camZoom);

      const cs = maze.cellSize;
      const minVisCol = Math.max(0, Math.floor((camera.x - halfVisW) / cs) - 1);
      const maxVisCol = Math.min(
        maze.cols - 1,
        Math.ceil((camera.x + halfVisW) / cs) + 1
      );
      const minVisRow = Math.max(0, Math.floor((camera.y - halfVisH) / cs) - 1);
      const maxVisRow = Math.min(
        maze.rows - 1,
        Math.ceil((camera.y + halfVisH) / cs) + 1
      );

      // 1. Draw Maze Floor Tiles
      for (let r = minVisRow; r <= maxVisRow; r++) {
        for (let c = minVisCol; c <= maxVisCol; c++) {
          if (maze.grid[r][c] === 0) {
            const tx = c * cs;
            const ty = r * cs;
            ctx.fillStyle = (r + c) % 2 === 0 ? '#14122b' : '#181533';
            ctx.fillRect(tx, ty, cs, cs);

            // Subtle arcade tile trim
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
            ctx.lineWidth = 1;
            ctx.strokeRect(tx + 0.5, ty + 0.5, cs - 1, cs - 1);
          }
        }
      }

      // 2. Lantern ambient pools on floor
      for (const l of maze.lanterns) {
        if (
          l.x < camera.x - viewW / 2 - 120 ||
          l.x > camera.x + viewW / 2 + 120 ||
          l.y < camera.y - viewH / 2 - 120 ||
          l.y > camera.y + viewH / 2 + 120
        ) {
          continue;
        }
        const grad = ctx.createRadialGradient(l.x, l.y, 4, l.x, l.y, cs * 1.15);
        grad.addColorStop(0, l.color === '#ff3ea5' ? 'rgba(255,62,165,0.18)' : 'rgba(85,234,255,0.16)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(l.x, l.y, cs * 1.15, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3. Start Pad
      const sx = (maze.start.col + 0.5) * cs;
      const sy = (maze.start.row + 0.5) * cs;
      ctx.save();
      ctx.strokeStyle = 'rgba(85, 234, 255, 0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, cs * 0.34, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(85, 234, 255, 0.75)';
      ctx.font = '800 9px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('START', sx, sy);
      ctx.restore();

      // 4. Golden Exit Gate Portal
      const ex = (maze.exit.col + 0.5) * cs;
      const ey = (maze.exit.row + 0.5) * cs;
      ctx.save();
      const pulse = 1 + Math.sin(now * 0.006) * 0.1;
      const exitGlow = ctx.createRadialGradient(ex, ey, 4, ex, ey, cs * 0.9);
      exitGlow.addColorStop(0, 'rgba(255, 214, 107, 0.75)');
      exitGlow.addColorStop(0.55, 'rgba(255, 62, 165, 0.35)');
      exitGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = exitGlow;
      ctx.beginPath();
      ctx.arc(ex, ey, cs * 0.9, 0, Math.PI * 2);
      ctx.fill();

      // Rotating portal ring
      ctx.translate(ex, ey);
      ctx.rotate(now * 0.0025);
      ctx.strokeStyle = '#ffd66b';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(0, 0, cs * 0.34 * pulse, 0, Math.PI * 1.5);
      ctx.stroke();

      ctx.strokeStyle = '#55eaff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, cs * 0.24 * pulse, Math.PI * 0.5, Math.PI * 2);
      ctx.stroke();

      ctx.rotate(-now * 0.0025);
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('EXIT', 0, 0);
      ctx.restore();

      // 5. Maze Walls (2.5D top-down shaded blocks + neon trim)
      for (let r = minVisRow; r <= maxVisRow; r++) {
        for (let c = minVisCol; c <= maxVisCol; c++) {
          if (maze.grid[r][c] === 1) {
            const wx = c * cs;
            const wy = r * cs;

            // Cast drop shadow onto southern open floor
            if (r + 1 < maze.rows && maze.grid[r + 1][c] === 0) {
              ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
              ctx.fillRect(wx, wy + cs, cs, 8);
            }

            // Wall body
            ctx.fillStyle = '#1b1738';
            ctx.fillRect(wx, wy, cs, cs);

            // Top bevel face
            ctx.fillStyle = '#272252';
            ctx.fillRect(wx + 3, wy + 3, cs - 6, cs - 8);

            // Neon edge accents facing open corridors
            ctx.fillStyle = '#ff3ea5';
            if (r + 1 < maze.rows && maze.grid[r + 1][c] === 0) {
              ctx.fillRect(wx + 1, wy + cs - 3, cs - 2, 3);
            }
            ctx.fillStyle = '#55eaff';
            if (r - 1 >= 0 && maze.grid[r - 1][c] === 0) {
              ctx.fillRect(wx + 1, wy, cs - 2, 2);
            }
          }
        }
      }

      // 6. Traps (Sawblades & High-Voltage Laser Pads)
      for (const trap of maze.traps) {
        if (
          trap.x < camera.x - viewW / 2 - 80 ||
          trap.x > camera.x + viewW / 2 + 80 ||
          trap.y < camera.y - viewH / 2 - 80 ||
          trap.y > camera.y + viewH / 2 + 80
        ) {
          continue;
        }

        if (trap.kind === 'saw') {
          ctx.save();
          ctx.translate(trap.x, trap.y);
          ctx.rotate(now * 0.008);

          // Glow ring
          ctx.fillStyle = 'rgba(255, 62, 165, 0.22)';
          ctx.beginPath();
          ctx.arc(0, 0, trap.radius * 1.25, 0, Math.PI * 2);
          ctx.fill();

          // Saw teeth
          ctx.fillStyle = '#ff3ea5';
          const teeth = 8;
          ctx.beginPath();
          for (let i = 0; i < teeth * 2; i++) {
            const ang = (i * Math.PI) / teeth;
            const rad = i % 2 === 0 ? trap.radius : trap.radius * 0.62;
            const px = Math.cos(ang) * rad;
            const py = Math.sin(ang) * rad;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();

          // Hub
          ctx.fillStyle = '#ffd66b';
          ctx.beginPath();
          ctx.arc(0, 0, trap.radius * 0.34, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else {
          // Laser / Shock tile
          const trapMult = trapSpeedBoostRemaining > 0 ? 1.65 : 1.0;
          const pulseVal = Math.sin(elapsedActiveSec * trap.speed * trapMult + trap.phase);
          const active = pulseVal > 0.2;
          const warning = !active && pulseVal > -0.25;

          ctx.save();
          ctx.translate(trap.x, trap.y);
          ctx.fillStyle = active
            ? 'rgba(239, 68, 68, 0.35)'
            : warning
            ? 'rgba(245, 158, 11, 0.22)'
            : 'rgba(56, 189, 248, 0.1)';
          ctx.beginPath();
          ctx.arc(0, 0, trap.radius, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = active
            ? '#ff2a5f'
            : warning
            ? '#f59e0b'
            : 'rgba(85, 234, 255, 0.35)';
          ctx.lineWidth = active ? 3 : 1.5;
          ctx.beginPath();
          ctx.arc(0, 0, trap.radius * 0.85, 0, Math.PI * 2);
          ctx.stroke();

          if (active) {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-trap.radius * 0.6, 0);
            ctx.lineTo(trap.radius * 0.6, 0);
            ctx.moveTo(0, -trap.radius * 0.6);
            ctx.lineTo(0, trap.radius * 0.6);
            ctx.stroke();
          }
          ctx.restore();
        }
      }

      // 7. Golden Coins
      for (const coin of maze.coins) {
        if (coin.collected) continue;
        if (
          coin.x < camera.x - viewW / 2 - 40 ||
          coin.x > camera.x + viewW / 2 + 40 ||
          coin.y < camera.y - viewH / 2 - 40 ||
          coin.y > camera.y + viewH / 2 + 40
        ) {
          continue;
        }
        const bob = Math.sin(now * 0.005 + coin.x) * 2.5;
        const spinWidth = Math.max(0.35, Math.abs(Math.cos(now * 0.004 + coin.y)));
        ctx.save();
        ctx.translate(coin.x, coin.y + bob);

        // Glow
        ctx.fillStyle = coin.bonus
          ? 'rgba(255, 62, 165, 0.28)'
          : 'rgba(255, 214, 107, 0.22)';
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fill();

        ctx.scale(spinWidth, 1);
        ctx.fillStyle = coin.bonus ? '#ff9de2' : '#ffd66b';
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }

      // 8. Particles
      for (const p of particles) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Helper: Draw 2D Runner Character (local or remote)
      const drawRunner = (
        rx: number,
        ry: number,
        color: string,
        jumpH: number,
        fx: number,
        fy: number,
        label?: string,
        flag?: string,
        isFlicker = false
      ) => {
        if (isFlicker && Math.floor(now / 80) % 2 === 0) return;

        // Ground shadow
        const shadowScale = Math.max(0.55, 1 - jumpH * 0.4);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.beginPath();
        ctx.ellipse(
          rx,
          ry + 12,
          14 * shadowScale,
          7 * shadowScale,
          0,
          0,
          Math.PI * 2
        );
        ctx.fill();

        const liftY = jumpH * 28;
        const scale = 1 + jumpH * 0.35;

        ctx.save();
        ctx.translate(rx, ry - liftY);
        ctx.scale(scale, scale);

        // Leap halo when airborne
        if (jumpH > 0.1) {
          ctx.strokeStyle = 'rgba(85, 234, 255, 0.7)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, 20, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Jetpack flame opposite facing
        const angle = Math.atan2(fy, fx);
        ctx.save();
        ctx.rotate(angle);
        ctx.fillStyle = '#ff3ea5';
        ctx.fillRect(-15, -7, 7, 14);
        ctx.fillStyle = '#55eaff';
        ctx.beginPath();
        ctx.moveTo(-15, -4);
        ctx.lineTo(-22 - Math.sin(now * 0.04) * 3, 0);
        ctx.lineTo(-15, 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Suit body
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Helmet / Head top-down
        ctx.fillStyle = '#ffd2b0';
        ctx.beginPath();
        ctx.arc(0, -2, 8.5, 0, Math.PI * 2);
        ctx.fill();

        // Cyber Visor facing direction
        ctx.fillStyle = '#131320';
        ctx.beginPath();
        ctx.arc(fx * 4.5, fy * 4.5 - 2, 5.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#55eaff';
        ctx.beginPath();
        ctx.arc(fx * 6, fy * 6 - 2, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        if (label) {
          ctx.save();
          ctx.font = '700 11px system-ui, sans-serif';
          ctx.textAlign = 'center';
          const tag = flag ? `${flag} ${label}` : label;
          const tw = ctx.measureText(tag).width + 12;
          ctx.fillStyle = 'rgba(12, 11, 28, 0.85)';
          ctx.beginPath();
          ctx.roundRect(rx - tw / 2, ry - liftY - 34, tw, 18, 6);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.fillText(tag, rx, ry - liftY - 21.5);
          ctx.restore();
        }
      };

      // 9. Remote Players
      remoteMap.forEach((rm) => {
        if (rm.status === 'eliminated') return;
        drawRunner(
          rm.x,
          rm.y,
          rm.color,
          rm.jumpHeight,
          1,
          0,
          rm.name,
          getFlag(rm.country)
        );
      });

      // 10. Ringmaster (The Clown)
      if (clown.active) {
        const bob = Math.sin(clown.bobPhase) * 3;
        ctx.save();
        ctx.translate(clown.x, clown.y + bob);

        // Danger aura
        ctx.fillStyle = 'rgba(255, 24, 90, 0.25)';
        ctx.beginPath();
        ctx.arc(0, 0, 26 + Math.sin(now * 0.01) * 3, 0, Math.PI * 2);
        ctx.fill();

        // Cape
        ctx.fillStyle = '#7c36d8';
        ctx.beginPath();
        ctx.arc(0, 0, 17, 0, Math.PI * 2);
        ctx.fill();

        // Clown Head
        ctx.fillStyle = '#ffe0c5';
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.fill();

        // Jester Horns
        ctx.fillStyle = '#ff3ea5';
        ctx.beginPath();
        ctx.moveTo(-10, -4);
        ctx.lineTo(-19, -15);
        ctx.lineTo(-4, -10);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(10, -4);
        ctx.lineTo(19, -15);
        ctx.lineTo(4, -10);
        ctx.fill();

        // Red Nose
        ctx.fillStyle = '#ff1818';
        ctx.beginPath();
        ctx.arc(0, 4, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 11. Local Player + Subtle Exit Compass Ring
      const angleToExit = Math.atan2(ey - player.y, ex - player.x);
      ctx.save();
      ctx.translate(player.x, player.y);
      ctx.rotate(angleToExit);
      ctx.fillStyle = 'rgba(255, 214, 107, 0.85)';
      ctx.beginPath();
      ctx.moveTo(28, 0);
      ctx.lineTo(21, -4.5);
      ctx.lineTo(21, 4.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      drawRunner(
        player.x,
        player.y,
        profile.color,
        player.jumpHeight,
        player.facingX,
        player.facingY,
        mode === 'multiplayer' ? profile.name : undefined,
        mode === 'multiplayer' ? getFlag(profile.country) : undefined,
        player.invulnTimer > 0
      );

      ctx.restore(); // End world-space transform

      // 12. Blackout / Spotlight Overlay (screen space)
      if (blackoutRemaining > 0) {
        const pxScreen = player.x * camZoom + offsetX;
        const pyScreen = player.y * camZoom + offsetY;
        const spotlight = ctx.createRadialGradient(
          pxScreen,
          pyScreen,
          65,
          pxScreen,
          pyScreen,
          220
        );
        spotlight.addColorStop(0, 'rgba(7, 7, 19, 0)');
        spotlight.addColorStop(0.6, 'rgba(7, 7, 19, 0.72)');
        spotlight.addColorStop(1, 'rgba(7, 7, 19, 0.96)');
        ctx.fillStyle = spotlight;
        ctx.fillRect(0, 0, viewW, viewH);
      }

      // 13. Corner Live Maze Minimap (Top-Right below HUD)
      const mmSize = viewW < 640 ? 108 : 138;
      const mmPad = 16;
      const mmX = viewW - mmSize - mmPad;
      const mmY = 66;
      const tilePx = mmSize / maze.cols;

      ctx.save();
      ctx.fillStyle = 'rgba(12, 11, 28, 0.84)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(mmX - 5, mmY - 5, mmSize + 10, mmSize + 10, 12);
      ctx.fill();
      ctx.stroke();

      for (let r = 0; r < maze.rows; r++) {
        for (let c = 0; c < maze.cols; c++) {
          if (!explored[r][c] && blackoutRemaining > 0) continue;
          if (maze.grid[r][c] === 1) {
            ctx.fillStyle = 'rgba(92, 82, 158, 0.65)';
            ctx.fillRect(
              mmX + c * tilePx,
              mmY + r * tilePx,
              Math.ceil(tilePx),
              Math.ceil(tilePx)
            );
          }
        }
      }

      // Exit beacon on minimap
      ctx.fillStyle = '#ffd66b';
      ctx.beginPath();
      ctx.arc(
        mmX + (maze.exit.col + 0.5) * tilePx,
        mmY + (maze.exit.row + 0.5) * tilePx,
        3.5 + Math.sin(now * 0.008) * 1,
        0,
        Math.PI * 2
      );
      ctx.fill();

      // Remote players on minimap
      remoteMap.forEach((rm) => {
        if (rm.status === 'eliminated') return;
        ctx.fillStyle = rm.color;
        ctx.beginPath();
        ctx.arc(
          mmX + (rm.x / maze.cellSize) * tilePx,
          mmY + (rm.y / maze.cellSize) * tilePx,
          2.6,
          0,
          Math.PI * 2
        );
        ctx.fill();
      });

      // Ringmaster on minimap
      if (clown.active) {
        ctx.fillStyle = '#ff2a5f';
        ctx.beginPath();
        ctx.arc(
          mmX + (clown.x / maze.cellSize) * tilePx,
          mmY + (clown.y / maze.cellSize) * tilePx,
          3.2,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }

      // Local player dot on minimap
      ctx.fillStyle = '#55eaff';
      ctx.beginPath();
      ctx.arc(
        mmX + (player.x / maze.cellSize) * tilePx,
        mmY + (player.y / maze.cellSize) * tilePx,
        3.4,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.restore();
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', syncCanvasSize);
      if (announcementTimerRef.current) window.clearTimeout(announcementTimerRef.current);
      if (clownTimerRef.current) window.clearTimeout(clownTimerRef.current);
    };
  }, [mode, multiplayerSeed, profile.color, profile.country, profile.name]);

  const setTouchKey = (key: string, pressed: boolean) => {
    keysRef.current[key] = pressed;
  };

  const sendEmojiReaction = (emoji: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: 'send_reaction',
          emoji,
        })
      );
    }
    soundEngine.playCoinSound();
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    dragOriginRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    dragVectorRef.current = { x: 0, y: 0 };
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const origin = dragOriginRef.current;
    if (!origin || origin.id !== e.pointerId) return;
    const dx = e.clientX - origin.x;
    const dy = e.clientY - origin.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 10) {
      const clamped = Math.min(1, dist / 40);
      dragVectorRef.current = {
        x: (dx / dist) * clamped,
        y: (dy / dist) * clamped,
      };
    } else {
      dragVectorRef.current = { x: 0, y: 0 };
    }
  };

  const handleCanvasPointerEnd = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragOriginRef.current?.id === e.pointerId) {
      dragOriginRef.current = null;
      dragVectorRef.current = { x: 0, y: 0 };
    }
  };

  const EMOJIS = ['🎪', '🤡', '🏃', '💀', '🔥', '🪙', '⚡'];

  return (
    <div className="relative w-full h-dvh overflow-hidden select-none bg-[#070713]">
      {/* 2D Maze Canvas (supports keyboard, D-Pad, and direct touch-drag steering) */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full">
        <canvas
          ref={canvasRef}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerEnd}
          onPointerCancel={handleCanvasPointerEnd}
          className="block w-full h-full touch-none"
        />
      </div>

      {/* TOP HUD */}
      <div className="absolute top-[max(0.75rem,env(safe-area-inset-top))] left-3 right-3 flex items-start justify-between pointer-events-none z-20 gap-2 flex-wrap">
        {/* Left: Hearts & Coins */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="flex items-center gap-3 px-3.5 py-2 rounded-2xl bg-[#101026]/90 border border-white/15 backdrop-blur-md shadow-lg">
            <div className="flex items-center gap-1" aria-label={`Lives: ${lives} of 3`}>
              {[1, 2, 3].map((heart) => (
                <Heart
                  key={heart}
                  className={`w-4 h-4 transition-colors ${
                    heart <= lives
                      ? 'fill-rose-500 text-rose-500'
                      : 'text-white/20'
                  }`}
                />
              ))}
            </div>

            <div className="w-px h-4 bg-white/15" />

            <div className="flex items-center gap-1.5 text-xs font-extrabold text-yellow-400 tabular-nums">
              <Coins className="w-4 h-4 fill-yellow-400 text-yellow-500" />
              <span>{coins}</span>
            </div>
          </div>

          {blackoutActive && (
            <div className="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/40 text-[11px] font-bold text-amber-300 backdrop-blur-md">
              Spotlight Active
            </div>
          )}
        </div>

        {/* Center: Mode */}
        <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#101026]/90 border border-pink-500/30 backdrop-blur-md text-xs font-extrabold tracking-wider uppercase text-pink-300 shadow-lg pointer-events-auto">
          <Compass className="w-3.5 h-3.5 text-yellow-400" />
          <span>
            {mode === 'multiplayer'
              ? 'Worldwide Maze Race'
              : `${mode} Maze`}
          </span>
        </div>

        {/* Right: Timer, Level & Controls */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-[#101026]/90 border border-white/15 backdrop-blur-md text-xs font-extrabold text-cyan-300 shadow-lg tabular-nums">
            <Timer className="w-4 h-4 text-cyan-400" />
            <span>{timerSec}s</span>
            {mode === 'survival' && (
              <span className="text-yellow-400 font-bold ml-1">L{level}</span>
            )}
          </div>

          <button
            onClick={() => {
              const next = !isMuted;
              setIsMuted(next);
              soundEngine.setMuted(next);
            }}
            className="p-2.5 rounded-xl bg-[#101026]/90 border border-white/15 text-white/75 hover:text-white backdrop-blur-md cursor-pointer"
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-cyan-400" />
            )}
          </button>

          <button
            onClick={() => setIsPaused((p) => !p)}
            className="p-2.5 rounded-xl bg-[#101026]/90 border border-white/15 text-white/75 hover:text-white backdrop-blur-md cursor-pointer"
            title="Pause Game"
          >
            <Pause className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Multiplayer Live Roster Strip (Top Left below HUD) */}
      {mode === 'multiplayer' && remoteRoster.length > 0 && (
        <div className="hidden sm:flex flex-col gap-1 absolute top-16 left-3 z-20 pointer-events-none max-w-[200px]">
          {remoteRoster.slice(0, 5).map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-2 px-2.5 py-1 rounded-lg bg-[#101026]/80 border border-white/10 text-[11px] text-white backdrop-blur-sm"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: r.color }}
                />
                <span className="truncate font-semibold">{r.name}</span>
              </div>
              <span className="text-cyan-300 font-bold tabular-nums shrink-0">
                {r.status === 'escaped'
                  ? `#${r.rank || 1}`
                  : r.status === 'eliminated'
                  ? 'OUT'
                  : `${r.progress}%`}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Ringmaster Sinister Dialogue Bubble */}
      {clownMessage && (
        <div
          role="status"
          aria-live="polite"
          className="absolute top-16 left-1/2 -translate-x-1/2 w-max max-w-[85vw] z-30 pointer-events-none"
        >
          <div className="bg-[#23103a]/95 border-2 border-pink-500 rounded-2xl px-5 py-2.5 shadow-[0_0_24px_rgba(255,62,165,0.4)] text-center">
            <div className="text-[11px] font-black uppercase tracking-wider text-pink-400">
              🤡 THE RINGMASTER
            </div>
            <p className="text-xs sm:text-sm font-bold text-white mt-0.5">
              {clownMessage}
            </p>
          </div>
        </div>
      )}

      {/* Event Announcements */}
      {announcement && (
        <div
          role="status"
          aria-live="polite"
          className="absolute bottom-36 left-1/2 -translate-x-1/2 w-max max-w-[90vw] z-30 pointer-events-none"
        >
          <div className="px-4 py-2 rounded-xl bg-yellow-400 text-slate-950 font-black text-xs sm:text-sm tracking-wide shadow-2xl">
            {announcement}
          </div>
        </div>
      )}

      {/* BOTTOM COLLAPSIBLE DOCK */}
      <div className="absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 w-[94vw] max-w-3xl z-20 pointer-events-none">
        <div className="flex justify-center mb-1">
          <button
            onClick={() => setShowControls((s) => !s)}
            className="pointer-events-auto px-3 py-1 rounded-lg bg-[#13112a]/90 border border-white/15 text-[11px] font-bold text-white/75 hover:text-white cursor-pointer backdrop-blur-md shadow-md"
          >
            {showControls ? 'Hide Controls' : 'Show Controls'}
          </button>
        </div>

        {showControls && (
          <div className="bg-[#100f24]/92 border border-white/15 rounded-2xl p-3 shadow-2xl backdrop-blur-md pointer-events-auto flex flex-col gap-2.5">
            {/* Live Maze Progress Bar */}
            <div className="w-full">
              <div className="flex items-center justify-between text-[11px] font-bold text-white/75 mb-1 px-1 tabular-nums">
                <span>START</span>
                <span className="text-pink-400">
                  {progressPercent}% TO EXIT GATE
                </span>
                <span>EXIT</span>
              </div>
              <div className="relative h-2 w-full bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 transition-all duration-100"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* 4-Way D-Pad, Multiplayer Reactions, & Leap Button */}
            <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/10">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    setTouchKey('arrowleft', true);
                  }}
                  onPointerUp={() => setTouchKey('arrowleft', false)}
                  onPointerLeave={() => setTouchKey('arrowleft', false)}
                  onPointerCancel={() => setTouchKey('arrowleft', false)}
                  className="w-11 h-11 rounded-xl bg-[#1d1b3d] border border-white/20 active:bg-pink-600 font-black text-base text-white flex items-center justify-center cursor-pointer shadow touch-none"
                  aria-label="Move Left"
                >
                  ◀
                </button>
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      setTouchKey('arrowup', true);
                    }}
                    onPointerUp={() => setTouchKey('arrowup', false)}
                    onPointerLeave={() => setTouchKey('arrowup', false)}
                    onPointerCancel={() => setTouchKey('arrowup', false)}
                    className="w-11 h-8 rounded-lg bg-[#1d1b3d] border border-white/20 active:bg-pink-600 font-black text-xs text-white flex items-center justify-center cursor-pointer shadow touch-none"
                    aria-label="Move Up"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      setTouchKey('arrowdown', true);
                    }}
                    onPointerUp={() => setTouchKey('arrowdown', false)}
                    onPointerLeave={() => setTouchKey('arrowdown', false)}
                    onPointerCancel={() => setTouchKey('arrowdown', false)}
                    className="w-11 h-8 rounded-lg bg-[#1d1b3d] border border-white/20 active:bg-pink-600 font-black text-xs text-white flex items-center justify-center cursor-pointer shadow touch-none"
                    aria-label="Move Down"
                  >
                    ▼
                  </button>
                </div>
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    setTouchKey('arrowright', true);
                  }}
                  onPointerUp={() => setTouchKey('arrowright', false)}
                  onPointerLeave={() => setTouchKey('arrowright', false)}
                  onPointerCancel={() => setTouchKey('arrowright', false)}
                  className="w-11 h-11 rounded-xl bg-[#1d1b3d] border border-white/20 active:bg-pink-600 font-black text-base text-white flex items-center justify-center cursor-pointer shadow touch-none"
                  aria-label="Move Right"
                >
                  ▶
                </button>
              </div>

              {mode === 'multiplayer' && (
                <div className="hidden sm:flex items-center gap-1">
                  {EMOJIS.map((em) => (
                    <button
                      key={em}
                      onClick={() => sendEmojiReaction(em)}
                      className="p-1.5 rounded-lg hover:bg-white/15 active:scale-110 transition-transform text-base cursor-pointer"
                      title={`Send ${em}`}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  jumpRequestRef.current = true;
                }}
                className="px-5 h-11 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 active:from-pink-600 active:to-purple-700 font-extrabold text-sm text-white flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-pink-500/30 border border-pink-400/40 whitespace-nowrap touch-none"
              >
                <span>Jump</span>
                <span className="text-xs opacity-75">[Space]</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Pause Menu Modal */}
      {isPaused && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#13112b] border border-white/20 rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl">
            <h3 className="text-xl font-black text-pink-400">Game Paused</h3>
            <p className="text-xs text-white/65">
              Use WASD or Arrow keys to navigate the maze and Space to leap over traps.
            </p>
            <div className="space-y-2 pt-2">
              <button
                onClick={() => setIsPaused(false)}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 font-extrabold text-sm text-white cursor-pointer"
              >
                Resume
              </button>
              <button
                onClick={onExitToMenu}
                className="w-full py-2.5 rounded-xl bg-[#201d40] hover:bg-[#2b2754] text-xs font-bold text-white/75 hover:text-white cursor-pointer"
              >
                Exit to Menu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
