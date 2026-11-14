import { PlayerProfile } from '../types/game';

const STORAGE_KEY = 'no_escape_player_profile';
const STATS_KEY = 'no_escape_player_stats';

export const SUIT_COLORS = [
  { name: 'Neon Cyan', hex: '#39bfff', glow: '#55eaff' },
  { name: 'Carnival Pink', hex: '#ff3ea5', glow: '#ff70c0' },
  { name: 'Cyber Gold', hex: '#ffd66b', glow: '#ffe58b' },
  { name: 'Toxic Lime', hex: '#22c55e', glow: '#4ade80' },
  { name: 'Royal Violet', hex: '#a855f7', glow: '#c084fc' },
  { name: 'Solar Blaze', hex: '#f97316', glow: '#fb923c' },
];

export const COUNTRIES = [
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷' },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
  { code: 'GLOBAL', name: 'World', flag: '🌐' },
];

export function getFlag(code: string): string {
  const c = COUNTRIES.find((x) => x.code === code.toUpperCase());
  return c ? c.flag : '🌐';
}

export function loadProfile(): PlayerProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    // ignore
  }
  const randomSuffix = Math.floor(100 + Math.random() * 900);
  return {
    name: `Runner #${randomSuffix}`,
    color: '#39bfff',
    country: 'US',
  };
}

export function saveProfile(profile: PlayerProfile) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch (e) {
    // ignore
  }
}

export interface PlayerStats {
  gamesPlayed: number;
  escapes: number;
  totalCoins: number;
  highScore: number;
  bestTime: number | null;
}

export function loadStats(): PlayerStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    // ignore
  }
  return {
    gamesPlayed: 0,
    escapes: 0,
    totalCoins: 0,
    highScore: 0,
    bestTime: null,
  };
}

export function recordGameStats(escaped: boolean, score: number, coins: number, timeSeconds: number) {
  const stats = loadStats();
  stats.gamesPlayed++;
  if (escaped) {
    stats.escapes++;
    if (!stats.bestTime || timeSeconds < stats.bestTime) {
      stats.bestTime = Number(timeSeconds.toFixed(1));
    }
  }
  stats.totalCoins += coins;
  if (score > stats.highScore) {
    stats.highScore = score;
  }
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch (e) {
    // ignore
  }
  return stats;
}
