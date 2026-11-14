import React, { useState, useEffect, useRef } from 'react';
import { GameMode, PlayerProfile } from '../types/game';
import {
  SUIT_COLORS,
  COUNTRIES,
  getFlag,
  loadStats,
  saveProfile,
} from '../utils/playerStorage';
import { soundEngine } from '../utils/audio';
import {
  Trophy,
  Globe,
  Play,
  User,
  Volume2,
  VolumeX,
  Sparkles,
  HelpCircle,
  Flame,
  Clock,
  Shuffle,
  Image as ImageIcon,
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import previewImg from '../assets/images/carnival_maze_preview_1794668974857.jpg';

interface CoverScreenProps {
  profile: PlayerProfile;
  onUpdateProfile: (p: PlayerProfile) => void;
  onStartSolo: (mode: GameMode) => void;
  onOpenMultiplayer: () => void;
  onOpenLeaderboard: () => void;
}

export const CoverScreen: React.FC<CoverScreenProps> = ({
  profile,
  onUpdateProfile,
  onStartSolo,
  onOpenMultiplayer,
  onOpenLeaderboard,
}) => {
  const [selectedMode, setSelectedMode] = useState<GameMode>('adventure');
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [isMuted, setIsMuted] = useState(soundEngine.getMuted());
  const [stats] = useState(loadStats());
  const [showcaseTab, setShowcaseTab] = useState<'runner' | 'preview'>('runner');
  const [previewImgError, setPreviewImgError] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const pointerOffsetRef = useRef<{ x: number; y: number }>({ x: 0.4, y: 0.2 });
  const colorRef = useRef<string>(profile.color);

  useEffect(() => {
    colorRef.current = profile.color;
  }, [profile.color]);

  // Interactive 2D Runner & Mini-Maze Preview Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    const mount = mountRef.current;
    if (!canvas || !mount) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const syncSize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = mount.clientWidth || 320;
      const h = mount.clientHeight || 300;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    syncSize();
    window.addEventListener('resize', syncSize);

    // Decorative 5x5 mini-maze backdrop around the runner pedestal
    const miniMaze = [
      [1, 1, 1, 1, 1],
      [1, 0, 0, 0, 1],
      [1, 0, 0, 0, 1],
      [1, 0, 0, 0, 1],
      [1, 1, 1, 1, 1],
    ];

    let animId = 0;
    const render = (now: number) => {
      animId = requestAnimationFrame(render);
      const w = mount.clientWidth || 320;
      const h = mount.clientHeight || 300;
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2 + 4;
      const tileSize = Math.min(w, h) / 5.4;
      const startX = cx - (5 * tileSize) / 2;
      const startY = cy - (5 * tileSize) / 2;

      // Mini-maze floor & border walls
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          const tx = startX + c * tileSize;
          const ty = startY + r * tileSize;
          if (miniMaze[r][c] === 1) {
            ctx.fillStyle = '#1d193d';
            ctx.fillRect(tx, ty, tileSize, tileSize);
            ctx.fillStyle = '#282254';
            ctx.fillRect(tx + 3, ty + 3, tileSize - 6, tileSize - 6);
            ctx.strokeStyle = 'rgba(255, 62, 165, 0.35)';
            ctx.lineWidth = 1;
            ctx.strokeRect(tx + 0.5, ty + 0.5, tileSize - 1, tileSize - 1);
          } else {
            ctx.fillStyle = (r + c) % 2 === 0 ? '#110f26' : '#15132e';
            ctx.fillRect(tx, ty, tileSize, tileSize);
          }
        }
      }

      // Orbiting mini coins around the runner
      for (let i = 0; i < 3; i++) {
        const ang = now * 0.0014 + (i * Math.PI * 2) / 3;
        const coinX = cx + Math.cos(ang) * (tileSize * 1.12);
        const coinY = cy + Math.sin(ang) * (tileSize * 1.12);
        ctx.fillStyle = 'rgba(255, 214, 107, 0.25)';
        ctx.beginPath();
        ctx.arc(coinX, coinY, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffd66b';
        ctx.beginPath();
        ctx.arc(coinX, coinY, 6.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Pedestal neon ring
      ctx.strokeStyle = 'rgba(255, 62, 165, 0.75)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, tileSize * 0.72, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(85, 234, 255, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, tileSize * 0.85, now * 0.0015, now * 0.0015 + Math.PI * 1.2);
      ctx.stroke();

      // 2D Runner Character (with hover bob and mouse-tracking visor)
      const bobY = Math.sin(now * 0.004) * 5;
      const fx = pointerOffsetRef.current.x;
      const fy = pointerOffsetRef.current.y;
      const facingLen = Math.hypot(fx, fy) || 1;
      const nx = fx / facingLen;
      const ny = fy / facingLen;
      const lookAngle = Math.atan2(ny, nx);

      // Ground shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 28, 22, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(cx, cy - 4 + bobY);

      // Jetpack + animated thrusters behind facing
      ctx.save();
      ctx.rotate(lookAngle);
      ctx.fillStyle = '#ff3ea5';
      ctx.fillRect(-26, -12, 12, 24);
      ctx.fillStyle = '#55eaff';
      ctx.beginPath();
      ctx.moveTo(-26, -7);
      ctx.lineTo(-40 - Math.sin(now * 0.03) * 6, 0);
      ctx.lineTo(-26, 7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Suit circle
      ctx.fillStyle = colorRef.current;
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Helmet / Head
      ctx.fillStyle = '#ffd2b0';
      ctx.beginPath();
      ctx.arc(0, -3, 15, 0, Math.PI * 2);
      ctx.fill();

      // Visor tracking pointer
      ctx.fillStyle = '#131320';
      ctx.beginPath();
      ctx.arc(nx * 7, ny * 7 - 3, 9, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#55eaff';
      ctx.beginPath();
      ctx.arc(nx * 9.5, ny * 9.5 - 3, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    };

    animId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', syncSize);
    };
  }, []);

  const handleStagePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    pointerOffsetRef.current = { x: dx, y: dy };
  };

  const toggleSound = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundEngine.setMuted(next);
  };

  const handleColorChange = (hex: string) => {
    const updated = { ...profile, color: hex };
    onUpdateProfile(updated);
    saveProfile(updated);
    soundEngine.playCoinSound();
  };

  const handleNameChange = (name: string) => {
    const updated = { ...profile, name };
    onUpdateProfile(updated);
    saveProfile(updated);
  };

  const handleCountryChange = (country: string) => {
    const updated = { ...profile, country };
    onUpdateProfile(updated);
    saveProfile(updated);
  };

  const modes: {
    id: GameMode;
    title: string;
    subtitle: string;
    icon: any;
  }[] = [
    {
      id: 'adventure',
      title: 'Adventure',
      subtitle: 'Classic maze escape gate',
      icon: Sparkles,
    },
    {
      id: 'survival',
      title: 'Endless Survival',
      subtitle: 'Infinite mazes, faster traps',
      icon: Flame,
    },
    {
      id: 'challenge',
      title: 'Time Trial',
      subtitle: 'High-speed maze sprint',
      icon: Clock,
    },
    {
      id: 'mystery',
      title: 'Mystery Chaos',
      subtitle: 'Blackouts & shifting walls',
      icon: Shuffle,
    },
  ];

  return (
    <div className="relative w-full h-full min-h-dvh overflow-y-auto bg-[#080816] text-white flex flex-col justify-between selection:bg-pink-500 selection:text-white">
      {/* Background Ambient Glows */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-pink-600/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-[450px] h-[450px] bg-cyan-600/15 rounded-full blur-[140px] pointer-events-none" />

      {/* Top Header Bar */}
      <header className="relative z-10 w-full px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3 border-b border-white/10 bg-[#0d0d21]/70 backdrop-blur-md">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-pink-500 to-purple-600 flex items-center justify-center text-xl shadow-lg shadow-pink-500/30 shrink-0">
            🎪
          </div>
          <div className="min-w-0">
            <h2 className="font-extrabold tracking-wider text-sm text-pink-400 uppercase whitespace-nowrap truncate">
              Carnival Maze Arena
            </h2>
            <p className="text-xs text-white/60 truncate">2D Labyrinth &amp; Global Races</p>
          </div>
        </div>

        {/* Player Profile, Install & Audio Bar */}
        <div className="flex items-center gap-2 shrink-0">
          <PWAInstallButton variant="header" />

          <button
            type="button"
            onClick={() => setShowCustomizer(true)}
            className="min-h-[44px] flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#181834] border border-white/15 hover:border-pink-500/50 hover:bg-[#202044] transition-all cursor-pointer shadow-md"
            title="Customize your runner"
            aria-label={`Customize profile for ${profile.name}`}
          >
            <span className="text-base">{getFlag(profile.country)}</span>
            <div
              className="w-3.5 h-3.5 rounded-full border border-white/40 shadow-sm shrink-0"
              style={{ backgroundColor: profile.color }}
            />
            <span className="hidden sm:inline text-xs font-bold text-white max-w-[110px] truncate">
              {profile.name}
            </span>
            <User className="w-3.5 h-3.5 text-white/50" />
          </button>

          <button
            type="button"
            onClick={toggleSound}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2.5 rounded-xl bg-[#181834] border border-white/10 hover:border-white/30 text-white/80 hover:text-white transition-all cursor-pointer"
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-cyan-400" />
            )}
          </button>
        </div>
      </header>

      {/* Main Cover Body */}
      <main className="relative z-10 flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 md:py-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Side: Game Title, Mode Selector & Big Actions */}
        <div className="lg:col-span-7 flex flex-col space-y-6">
          <p className="text-xs font-bold tracking-wider uppercase text-pink-300">
            2D Maze Runner · Worldwide Multiplayer Arcade
          </p>

          <div>
            <h1 className="text-5xl sm:text-7xl font-black tracking-tight leading-none text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-300 to-cyan-300 drop-shadow-[0_0_35px_rgba(255,62,165,0.45)]">
              NO ESCAPE
            </h1>
            <p className="mt-2 text-lg sm:text-xl font-medium text-purple-200/90 flex flex-wrap items-center gap-2">
              <span>The 2D Carnival Maze</span>
              <span className="text-white/40">·</span>
              <span className="text-cyan-300">Outrun the World</span>
            </p>
            <p className="mt-2 text-sm text-white/65 max-w-xl">
              Navigate shifting carnival labyrinths, leap over spinning sawblades and laser barriers,
              snatch hidden dead-end coins, and escape the stalking Ringmaster solo or head-to-head online.
            </p>
          </div>

          {/* Primary Play Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
            <button
              onClick={() => {
                soundEngine.playJumpSound();
                onStartSolo(selectedMode);
              }}
              className="group relative overflow-hidden rounded-2xl p-4 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 text-white font-extrabold shadow-lg shadow-pink-600/30 hover:scale-[1.01] active:scale-[0.99] transition-all text-left flex items-center justify-between cursor-pointer border border-pink-400/40"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                  <Play className="w-6 h-6 fill-white" />
                </div>
                <div>
                  <div className="text-lg tracking-wide uppercase font-black whitespace-nowrap">
                    Play Solo
                  </div>
                  <div className="text-xs text-pink-100 font-normal capitalize">
                    {selectedMode} Maze
                  </div>
                </div>
              </div>
              <span className="text-2xl group-hover:translate-x-1 transition-transform">
                ➔
              </span>
            </button>

            <button
              onClick={() => {
                soundEngine.playJumpSound();
                onOpenMultiplayer();
              }}
              className="group relative overflow-hidden rounded-2xl p-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-extrabold shadow-lg shadow-cyan-600/30 hover:scale-[1.01] active:scale-[0.99] transition-all text-left flex items-center justify-between cursor-pointer border border-cyan-400/40"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                  <Globe className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="text-lg tracking-wide uppercase font-black whitespace-nowrap">
                    Play Online
                  </div>
                  <div className="text-xs text-cyan-100 font-normal">
                    Real-Time Maze Race
                  </div>
                </div>
              </div>
              <span className="text-2xl group-hover:translate-x-1 transition-transform">
                ➔
              </span>
            </button>
          </div>

          {/* Game Mode Selector */}
          <div className="space-y-2 pt-2">
            <div className="text-xs font-bold text-white/55 uppercase tracking-wider flex items-center justify-between">
              <span>Select Solo Maze Mode</span>
              <span className="text-pink-400 text-[11px]">Click to switch</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {modes.map((m) => {
                const Icon = m.icon;
                const isSelected = selectedMode === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      setSelectedMode(m.id);
                      soundEngine.playCoinSound();
                    }}
                    className={`p-3 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between h-24 ${
                      isSelected
                        ? 'bg-[#1e1a3a] border-pink-500 shadow-md shadow-pink-500/20 ring-1 ring-pink-500/50'
                        : 'bg-[#121124] border-white/10 hover:border-white/20 hover:bg-[#171630]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Icon
                        className={`w-4 h-4 ${
                          isSelected ? 'text-pink-400' : 'text-white/50'
                        }`}
                      />
                    </div>
                    <div>
                      <div className="text-xs font-black text-white uppercase">
                        {m.title}
                      </div>
                      <div className="text-[10px] text-white/55 truncate">
                        {m.subtitle}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Sub-actions */}
          <div className="flex flex-wrap items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={onOpenLeaderboard}
              className="min-h-[44px] flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#14142d] hover:bg-[#1d1d42] border border-white/10 hover:border-yellow-500/40 text-xs font-bold text-yellow-300 transition-all cursor-pointer shadow-sm whitespace-nowrap"
            >
              <Trophy className="w-4 h-4 text-yellow-400" />
              <span>Leaderboard &amp; Records</span>
            </button>

            <button
              type="button"
              onClick={() => setShowCustomizer(true)}
              className="min-h-[44px] flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#14142d] hover:bg-[#1d1d42] border border-white/10 hover:border-purple-500/40 text-xs font-bold text-purple-300 transition-all cursor-pointer shadow-sm whitespace-nowrap"
            >
              <User className="w-4 h-4 text-purple-400" />
              <span>Customize Runner</span>
            </button>

            <button
              type="button"
              onClick={() => setShowHowToPlay(true)}
              className="min-h-[44px] flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#14142d] hover:bg-[#1d1d42] border border-white/10 hover:border-white/30 text-xs font-bold text-white/75 hover:text-white transition-all cursor-pointer shadow-sm whitespace-nowrap"
            >
              <HelpCircle className="w-4 h-4" />
              <span>How To Play</span>
            </button>

            <PWAInstallButton variant="action" />
          </div>
        </div>

        {/* Right Side: 2D Character & Preview Photo Stage */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div className="relative w-full max-w-[380px] aspect-[4/5] bg-gradient-to-b from-[#181432]/90 to-[#0c0a1e]/90 rounded-3xl border border-white/15 p-4 shadow-2xl flex flex-col justify-between overflow-hidden">
            <div className="relative z-10 flex items-center justify-between gap-2 w-full px-1 pt-0.5 text-xs">
              <div className="flex items-center gap-1 p-1 rounded-xl bg-[#110f26] border border-white/10">
                <button
                  type="button"
                  onClick={() => setShowcaseTab('runner')}
                  aria-pressed={showcaseTab === 'runner'}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    showcaseTab === 'runner'
                      ? 'bg-pink-600 text-white'
                      : 'text-white/65 hover:text-white'
                  }`}
                >
                  2D Runner
                </button>
                <button
                  type="button"
                  onClick={() => setShowcaseTab('preview')}
                  aria-pressed={showcaseTab === 'preview'}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap ${
                    showcaseTab === 'preview'
                      ? 'bg-cyan-600 text-white'
                      : 'text-white/65 hover:text-white'
                  }`}
                >
                  <ImageIcon className="w-3 h-3" />
                  Preview
                </button>
              </div>
              <span className="font-bold text-white/65 whitespace-nowrap">
                {getFlag(profile.country)} {profile.country}
              </span>
            </div>

            {showcaseTab === 'runner' ? (
              <div
                ref={mountRef}
                onPointerMove={handleStagePointerMove}
                className="relative z-10 w-full flex-1 flex items-center justify-center my-2 cursor-crosshair"
              >
                <canvas ref={canvasRef} className="block w-full h-full" />
              </div>
            ) : (
              <div className="relative z-10 w-full flex-1 flex flex-col items-center justify-center my-2 rounded-2xl overflow-hidden border border-white/10 bg-[#0b0a1d]">
                {!previewImgError ? (
                  <img
                    src={previewImg}
                    alt="NO ESCAPE 2D Carnival Maze gameplay preview"
                    referrerPolicy="no-referrer"
                    onError={() => setPreviewImgError(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-center p-4 bg-gradient-to-br from-[#19163a] to-[#0b0a1d]">
                    <span className="text-3xl">🎪</span>
                    <span className="text-xs font-bold text-white">NO ESCAPE · 2D Carnival Maze</span>
                    <span className="text-[11px] text-white/60">Procedural neon labyrinths &amp; multiplayer</span>
                  </div>
                )}
              </div>
            )}

            {/* Bottom Character Info & Swatch Quick-Picker */}
            <div className="relative z-10 bg-[#120f28]/90 border border-white/10 rounded-2xl p-3 shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h4 className="text-sm font-extrabold text-white truncate max-w-[150px]">
                    {profile.name}
                  </h4>
                  <p className="text-[11px] text-white/55 tabular-nums">
                    High Score: {stats.highScore.toLocaleString()} pts
                  </p>
                </div>
                <div className="text-right tabular-nums">
                  <div className="text-xs font-extrabold text-yellow-400">
                    🪙 {stats.totalCoins}
                  </div>
                  <div className="text-[11px] text-white/55">
                    Escaped: {stats.escapes} times
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-white/10">
                <span className="text-[10px] text-white/50 font-semibold uppercase">
                  Suit Color
                </span>
                <div className="flex items-center gap-1.5">
                  {SUIT_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      onClick={() => handleColorChange(c.hex)}
                      style={{ backgroundColor: c.hex }}
                      className={`w-5 h-5 rounded-full transition-transform cursor-pointer ${
                        profile.color === c.hex
                          ? 'scale-125 ring-2 ring-white shadow-lg'
                          : 'hover:scale-110 opacity-75 hover:opacity-100'
                      }`}
                      title={c.name}
                      aria-label={`Select ${c.name}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full px-6 py-4 border-t border-white/10 bg-[#0d0d21]/70 text-center text-xs text-white/50 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div>NO ESCAPE · 2D Carnival Maze &amp; Multiplayer</div>
        <div>
          Desktop: WASD / Arrow Keys to move, Space to leap traps · Mobile: On-screen D-Pad &amp; Jump
        </div>
      </footer>

      {/* Modal: Customize Runner */}
      {showCustomizer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#121126] border border-white/20 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-lg font-black text-pink-400 flex items-center gap-2">
                <User className="w-5 h-5" /> Customize Your Runner
              </h3>
              <button
                onClick={() => setShowCustomizer(false)}
                className="text-white/50 hover:text-white text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-white/60 uppercase block mb-1.5">
                Contestant Name
              </label>
              <input
                type="text"
                value={profile.name}
                maxLength={20}
                onChange={(e) => handleNameChange(e.target.value)}
                className="w-full bg-[#1b1933] border border-white/15 focus:border-pink-500 rounded-xl px-3.5 py-2.5 text-sm text-white font-bold outline-none"
                placeholder="Enter your runner tag..."
              />
            </div>

            <div>
              <label className="text-xs font-bold text-white/60 uppercase block mb-1.5">
                Suit Color Theme
              </label>
              <div className="grid grid-cols-3 gap-2">
                {SUIT_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    onClick={() => handleColorChange(c.hex)}
                    className={`flex items-center gap-2 p-2 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                      profile.color === c.hex
                        ? 'bg-[#221c3d] border-pink-500 text-white shadow-md shadow-pink-500/20'
                        : 'bg-[#18162d] border-white/10 text-white/60 hover:text-white'
                    }`}
                  >
                    <div
                      className="w-4 h-4 rounded-full shrink-0"
                      style={{ backgroundColor: c.hex }}
                    />
                    <span className="truncate">{c.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-white/60 uppercase block mb-1.5">
                Home Country / Region
              </label>
              <select
                value={profile.country}
                onChange={(e) => handleCountryChange(e.target.value)}
                className="w-full bg-[#1b1933] border border-white/15 focus:border-cyan-500 rounded-xl px-3.5 py-2.5 text-sm text-white font-bold outline-none cursor-pointer"
              >
                {COUNTRIES.map((ct) => (
                  <option
                    key={ct.code}
                    value={ct.code}
                    className="bg-[#1b1933] text-white"
                  >
                    {ct.flag} {ct.name} ({ct.code})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setShowCustomizer(false)}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 font-extrabold text-sm uppercase tracking-wide cursor-pointer shadow-lg shadow-pink-500/30"
            >
              Save Runner
            </button>
          </div>
        </div>
      )}

      {/* Modal: How To Play */}
      {showHowToPlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#121126] border border-white/20 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-lg font-black text-cyan-400 flex items-center gap-2">
                <HelpCircle className="w-5 h-5" /> How To Play 2D Maze
              </h3>
              <button
                onClick={() => setShowHowToPlay(false)}
                className="text-white/50 hover:text-white text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-sm text-white/80">
              <div className="p-3.5 bg-[#191734] rounded-2xl border border-white/10">
                <h4 className="font-bold text-pink-400 mb-1">The Objective</h4>
                <p className="text-xs text-white/75">
                  Explore the 2D carnival maze, follow the golden exit compass &amp; corner minimap,
                  collect golden coins (dead ends hide bonus coins!), and reach the Golden Exit Gate
                  before losing all 3 hearts.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 bg-[#191734] rounded-2xl border border-white/10">
                  <h4 className="font-bold text-cyan-400 mb-1">Keyboard</h4>
                  <ul className="text-xs text-white/75 space-y-1">
                    <li>
                      <strong className="text-white">WASD / Arrows</strong>: Move through maze
                    </li>
                    <li>
                      <strong className="text-white">Spacebar</strong>: Leap over sawblades &amp; lasers
                    </li>
                    <li>
                      <strong className="text-white">Esc</strong>: Pause game
                    </li>
                  </ul>
                </div>

                <div className="p-3.5 bg-[#191734] rounded-2xl border border-white/10">
                  <h4 className="font-bold text-yellow-400 mb-1">Mobile &amp; Touch</h4>
                  <ul className="text-xs text-white/75 space-y-1">
                    <li>
                      <strong className="text-white">4-Way D-Pad</strong>: Navigate corridors
                    </li>
                    <li>
                      <strong className="text-white">Jump Button</strong>: Vault traps
                    </li>
                    <li>
                      <strong className="text-white">Emoji Bar</strong>: React in multiplayer
                    </li>
                  </ul>
                </div>
              </div>

              <div className="p-3.5 bg-[#191734] rounded-2xl border border-white/10">
                <h4 className="font-bold text-purple-400 mb-1">Worldwide Multiplayer</h4>
                <p className="text-xs text-white/75">
                  Join public rooms or create custom arena codes. Every racer spawns in the exact same
                  seeded 2D maze and races live to the Exit Gate!
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowHowToPlay(false)}
              className="w-full py-2.5 rounded-xl bg-[#201d3f] hover:bg-[#2b2754] font-bold text-sm cursor-pointer"
            >
              Got It, Let&apos;s Run
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
