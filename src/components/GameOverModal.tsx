import React, { useEffect, useState } from 'react';
import { GameMode, PlayerProfile } from '../types/game';
import { recordGameStats, getFlag } from '../utils/playerStorage';
import { Trophy, RefreshCw, Home, Sparkles, Skull, Medal } from 'lucide-react';
import confetti from 'canvas-confetti';

interface GameOverModalProps {
  result: {
    escaped: boolean;
    score: number;
    coins: number;
    timeSeconds: number;
    level: number;
    mode: GameMode;
    rank?: number;
  };
  profile: PlayerProfile;
  onPlayAgain: () => void;
  onOpenLeaderboard: () => void;
  onReturnCover: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  result,
  profile,
  onPlayAgain,
  onOpenLeaderboard,
  onReturnCover,
}) => {
  const [submitting, setSubmitting] = useState<boolean>(true);
  const [globalRank, setGlobalRank] = useState<number | null>(result.rank || null);

  useEffect(() => {
    // Record to local stats
    recordGameStats(result.escaped, result.score, result.coins, result.timeSeconds);

    if (result.escaped) {
      confetti({
        particleCount: 140,
        spread: 90,
        origin: { y: 0.5 },
      });
    }

    // Submit to server leaderboard
    const submitScore = async () => {
      try {
        const res = await fetch('/api/leaderboard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            playerName: profile.name,
            score: result.score,
            coins: result.coins,
            timeSeconds: result.timeSeconds,
            mode: result.mode,
            level: result.level,
            country: profile.country,
          }),
        });
        const data = await res.json();
        if (data.success && typeof data.rank === 'number') {
          setGlobalRank(data.rank);
        }
      } catch (err) {
        console.error('Failed submitting score to server:', err);
      } finally {
        setSubmitting(false);
      }
    };

    submitScore();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="bg-[#12102b] border border-white/20 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
        {/* Top Icon Badge */}
        <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-xl">
          {result.escaped ? (
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-yellow-400 to-amber-600 flex items-center justify-center shadow-yellow-500/30">
              🏆
            </div>
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-rose-600 to-purple-800 flex items-center justify-center shadow-rose-600/30">
              💀
            </div>
          )}
        </div>

        {/* Title */}
        <div>
          <h2
            className={`text-2xl sm:text-3xl font-black uppercase tracking-tight ${
              result.escaped ? 'text-yellow-400' : 'text-rose-400'
            }`}
          >
            {result.escaped ? 'ESCAPED THE CARNIVAL!' : 'THE RINGMASTER WINS!'}
          </h2>
          <p className="text-xs text-white/60 mt-1">
            {result.escaped
              ? 'You breached the glowing exit gate with heroic speed!'
              : 'The carnival traps overwhelmed you this time. Ready to conquer it?'}
          </p>
        </div>

        {/* Global Rank Ribbon */}
        <div className="p-3 bg-[#1c183d] rounded-2xl border border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{getFlag(profile.country)}</span>
            <span className="text-xs font-bold text-white truncate max-w-[140px]">{profile.name}</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-white/50 uppercase block">Global Ranking</span>
            <span className="text-sm font-black text-pink-400">
              {submitting ? 'Calculating...' : globalRank ? `#${globalRank} Worldwide` : 'Top 50'}
            </span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="p-3 rounded-2xl bg-[#171536] border border-white/5">
            <span className="text-[10px] text-white/40 uppercase block">Total Score</span>
            <span className="text-lg font-black text-white">{result.score.toLocaleString()}</span>
          </div>
          <div className="p-3 rounded-2xl bg-[#171536] border border-white/5">
            <span className="text-[10px] text-white/40 uppercase block">Coins</span>
            <span className="text-lg font-black text-yellow-400">🪙 {result.coins}</span>
          </div>
          <div className="p-3 rounded-2xl bg-[#171536] border border-white/5">
            <span className="text-[10px] text-white/40 uppercase block">Time</span>
            <span className="text-lg font-black text-cyan-400">⏱️ {result.timeSeconds}s</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 pt-2">
          <button
            onClick={onPlayAgain}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 font-black text-sm uppercase tracking-wide cursor-pointer shadow-lg shadow-pink-500/30 transition-transform hover:scale-[1.01] flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>PLAY AGAIN</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onOpenLeaderboard}
              className="py-2.5 rounded-xl bg-[#1e1c44] hover:bg-[#29265c] text-xs font-bold text-yellow-300 border border-white/10 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Trophy className="w-3.5 h-3.5 text-yellow-400" />
              <span>Leaderboard</span>
            </button>
            <button
              onClick={onReturnCover}
              className="py-2.5 rounded-xl bg-[#1e1c44] hover:bg-[#29265c] text-xs font-bold text-white/70 hover:text-white border border-white/10 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Cover Menu</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
