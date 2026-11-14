import React, { useState } from 'react';
import { GameMode, GameScreen, PlayerProfile, RemotePlayer } from './types/game';
import { loadProfile } from './utils/playerStorage';
import { CoverScreen } from './components/CoverScreen';
import { MultiplayerLobby } from './components/MultiplayerLobby';
import { GameCanvas } from './components/GameCanvas';
import { LeaderboardModal } from './components/LeaderboardModal';
import { GameOverModal } from './components/GameOverModal';
import { OfflineIndicator } from './components/OfflineIndicator';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<GameScreen>('cover');
  const [profile, setProfile] = useState<PlayerProfile>(loadProfile());
  const [gameMode, setGameMode] = useState<GameMode>('adventure');
  const [showLeaderboard, setShowLeaderboard] = useState<boolean>(false);
  const [gameSessionKey, setGameSessionKey] = useState<number>(0);

  // Multiplayer Active Session State
  const [mpSocket, setMpSocket] = useState<WebSocket | null>(null);
  const [mpSeed, setMpSeed] = useState<number | undefined>(undefined);
  const [mpPlayers, setMpPlayers] = useState<RemotePlayer[]>([]);

  // Game End State
  const [gameResult, setGameResult] = useState<{
    escaped: boolean;
    score: number;
    coins: number;
    timeSeconds: number;
    level: number;
    mode: GameMode;
    rank?: number;
  } | null>(null);

  const handleStartSolo = (mode: GameMode) => {
    setGameMode(mode);
    setMpSocket(null);
    setMpSeed(undefined);
    setMpPlayers([]);
    setGameResult(null);
    setGameSessionKey((k) => k + 1);
    setCurrentScreen('playing');
  };

  const handleOpenMultiplayer = () => {
    setCurrentScreen('lobby');
  };

  const handleMultiplayerGameStart = (
    socket: WebSocket,
    _roomId: string,
    seed: number,
    initialPlayers: RemotePlayer[]
  ) => {
    setMpSocket(socket);
    setMpSeed(seed);
    setMpPlayers(initialPlayers);
    setGameMode('multiplayer');
    setGameResult(null);
    setGameSessionKey((k) => k + 1);
    setCurrentScreen('playing');
  };

  const handleFinishGame = (result: {
    escaped: boolean;
    score: number;
    coins: number;
    timeSeconds: number;
    level: number;
    mode: GameMode;
    rank?: number;
  }) => {
    setGameResult(result);
  };

  const handlePlayAgain = () => {
    setGameResult(null);
    if (gameMode === 'multiplayer') {
      if (mpSocket && mpSocket.readyState === WebSocket.OPEN) {
        mpSocket.close();
      }
      setMpSocket(null);
      setCurrentScreen('lobby');
      return;
    }
    setGameSessionKey((k) => k + 1);
    setCurrentScreen('playing');
  };

  const handleReturnToCover = () => {
    if (mpSocket && mpSocket.readyState === WebSocket.OPEN) {
      mpSocket.close();
    }
    setMpSocket(null);
    setGameResult(null);
    setCurrentScreen('cover');
  };

  return (
    <div className="relative w-screen h-dvh overflow-hidden bg-[#080816] font-sans">
      {/* 1. Cover Screen */}
      {currentScreen === 'cover' && (
        <CoverScreen
          profile={profile}
          onUpdateProfile={setProfile}
          onStartSolo={handleStartSolo}
          onOpenMultiplayer={handleOpenMultiplayer}
          onOpenLeaderboard={() => setShowLeaderboard(true)}
        />
      )}

      {/* 2. Worldwide Multiplayer Lobby */}
      {currentScreen === 'lobby' && (
        <MultiplayerLobby
          profile={profile}
          onBack={handleReturnToCover}
          onGameStart={handleMultiplayerGameStart}
        />
      )}

      {/* 3. 2D Maze Active Game Canvas */}
      {currentScreen === 'playing' && (
        <GameCanvas
          key={gameSessionKey}
          mode={gameMode}
          profile={profile}
          multiplayerSocket={mpSocket}
          multiplayerSeed={mpSeed}
          initialRemotePlayers={mpPlayers}
          onFinishGame={handleFinishGame}
          onExitToMenu={handleReturnToCover}
        />
      )}

      {/* 4. Game Over / Victory Modal */}
      {gameResult && (
        <GameOverModal
          result={gameResult}
          profile={profile}
          onPlayAgain={handlePlayAgain}
          onOpenLeaderboard={() => setShowLeaderboard(true)}
          onReturnCover={handleReturnToCover}
        />
      )}

      {/* 5. Global Leaderboard Modal */}
      {showLeaderboard && (
        <LeaderboardModal
          onClose={() => setShowLeaderboard(false)}
          currentPlayerName={profile.name}
        />
      )}

      {/* 6. Offline Connectivity Status */}
      <OfflineIndicator />
    </div>
  );
}
