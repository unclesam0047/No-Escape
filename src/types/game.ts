export type GameMode = 'adventure' | 'survival' | 'challenge' | 'mystery' | 'multiplayer';

export type GameScreen = 'cover' | 'lobby' | 'playing' | 'game_over' | 'victory' | 'leaderboard';

export interface PlayerProfile {
  name: string;
  color: string;
  country: string;
}

export interface LeaderboardEntry {
  id: string;
  playerName: string;
  score: number;
  coins: number;
  timeSeconds: number;
  mode: GameMode;
  level: number;
  country: string;
  createdAt: string;
}

export interface RemotePlayer {
  id: string;
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
  progress: number;
  escapedTime?: number;
  rank?: number;
}

export interface RoomInfo {
  id: string;
  name: string;
  status: 'waiting' | 'countdown' | 'in_progress' | 'finished';
  countdown: number;
  seed: number;
  players: RemotePlayer[];
}

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  playerColor: string;
  text: string;
  time: string;
}

export interface ReactionEvent {
  id: string;
  playerId: string;
  playerName: string;
  emoji: string;
}
