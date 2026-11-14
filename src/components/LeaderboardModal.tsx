import React, { useState, useEffect } from 'react';
import { LeaderboardEntry, GameMode } from '../types/game';
import { getFlag } from '../utils/playerStorage';
import { Trophy, Medal, Search, RefreshCw, X, Flame, Sparkles, Clock, Globe, Shuffle } from 'lucide-react';

interface LeaderboardModalProps {
  onClose: () => void;
  currentPlayerName?: string;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({ onClose, currentPlayerName }) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedMode, setSelectedMode] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const url = selectedMode === 'all' ? '/api/leaderboard' : `/api/leaderboard?mode=${selectedMode}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && Array.isArray(data.leaderboard)) {
        setEntries(data.leaderboard);
      }
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [selectedMode]);

  const filteredEntries = entries.filter((e) =>
    e.playerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.country.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const top3 = filteredEntries.slice(0, 3);
  const remaining = filteredEntries.slice(3);

  const modeTabs = [
    { id: 'all', label: 'All Modes', icon: Trophy },
    { id: 'adventure', label: 'Adventure', icon: Sparkles },
    { id: 'survival', label: 'Survival', icon: Flame },
    { id: 'challenge', label: 'Challenge', icon: Clock },
    { id: 'mystery', label: 'Mystery', icon: Shuffle },
    { id: 'multiplayer', label: 'Multiplayer', icon: Globe },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md">
      <div className="bg-[#0f0e24] border border-white/20 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/10 bg-[#151433] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-yellow-400 to-amber-600 flex items-center justify-center text-xl shadow-lg shadow-yellow-500/20">
              🏆
            </div>
            <div>
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                GLOBAL CARNIVAL LEADERBOARD
              </h2>
              <p className="text-xs text-white/50">Official rankings of contestants worldwide</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchLeaderboard}
              disabled={loading}
              className="p-2 rounded-xl bg-[#201e45] hover:bg-[#2b285b] text-white/70 hover:text-white transition-colors cursor-pointer"
              title="Refresh Leaderboard"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-[#201e45] hover:bg-[#2b285b] text-white/70 hover:text-white transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Tabs & Search Bar */}
        <div className="px-6 py-3.5 bg-[#12112b] border-b border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Mode Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {modeTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = selectedMode === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedMode(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-pink-600 text-white shadow-md shadow-pink-600/30'
                      : 'bg-[#1b193a] text-white/60 hover:text-white hover:bg-[#24214d]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-60">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              placeholder="Search runner or country..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#1b193a] border border-white/15 focus:border-pink-500 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white outline-none"
            />
          </div>
        </div>

        {/* Body Container */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Top 3 Podium Cards */}
          {top3.length > 0 && !searchQuery && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
              {/* 2nd Place */}
              {top3[1] && (
                <div className="sm:order-1 order-2 bg-gradient-to-b from-[#1c1b3f] to-[#12112b] border border-slate-400/30 rounded-2xl p-4 flex flex-col items-center text-center relative shadow-lg">
                  <div className="w-9 h-9 rounded-full bg-slate-300 text-slate-900 font-black flex items-center justify-center text-sm shadow-md mb-2">
                    #2
                  </div>
                  <span className="text-xl mb-1">{getFlag(top3[1].country)}</span>
                  <div className="text-sm font-extrabold text-white truncate max-w-[160px]">
                    {top3[1].playerName}
                  </div>
                  <div className="text-base font-black text-slate-200 mt-1">
                    {top3[1].score.toLocaleString()} <span className="text-xs font-normal text-white/50">pts</span>
                  </div>
                  <div className="text-[11px] text-white/50 mt-1">
                    🪙 {top3[1].coins} • ⏱️ {top3[1].timeSeconds}s
                  </div>
                </div>
              )}

              {/* 1st Place Champion */}
              {top3[0] && (
                <div className="sm:order-2 order-1 bg-gradient-to-b from-[#2a2213] to-[#151229] border border-yellow-500/50 rounded-2xl p-5 flex flex-col items-center text-center relative shadow-xl shadow-yellow-500/10 sm:-translate-y-2 ring-1 ring-yellow-400/30">
                  <div className="absolute -top-3.5 bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-black text-[10px] px-3 py-0.5 rounded-full uppercase tracking-wider shadow">
                    👑 Grand Champion
                  </div>
                  <div className="w-11 h-11 rounded-full bg-yellow-400 text-slate-950 font-black flex items-center justify-center text-base shadow-lg shadow-yellow-400/30 mb-2">
                    #1
                  </div>
                  <span className="text-2xl mb-1">{getFlag(top3[0].country)}</span>
                  <div className="text-base font-black text-yellow-300 truncate max-w-[180px]">
                    {top3[0].playerName}
                  </div>
                  <div className="text-xl font-black text-white mt-1">
                    {top3[0].score.toLocaleString()} <span className="text-xs font-normal text-yellow-400">pts</span>
                  </div>
                  <div className="text-xs text-yellow-200/70 mt-1 font-semibold">
                    🪙 {top3[0].coins} • ⏱️ {top3[0].timeSeconds}s • {top3[0].mode}
                  </div>
                </div>
              )}

              {/* 3rd Place */}
              {top3[2] && (
                <div className="sm:order-3 order-3 bg-gradient-to-b from-[#1e172a] to-[#12112b] border border-amber-700/30 rounded-2xl p-4 flex flex-col items-center text-center relative shadow-lg">
                  <div className="w-9 h-9 rounded-full bg-amber-600 text-white font-black flex items-center justify-center text-sm shadow-md mb-2">
                    #3
                  </div>
                  <span className="text-xl mb-1">{getFlag(top3[2].country)}</span>
                  <div className="text-sm font-extrabold text-white truncate max-w-[160px]">
                    {top3[2].playerName}
                  </div>
                  <div className="text-base font-black text-amber-300 mt-1">
                    {top3[2].score.toLocaleString()} <span className="text-xs font-normal text-white/50">pts</span>
                  </div>
                  <div className="text-[11px] text-white/50 mt-1">
                    🪙 {top3[2].coins} • ⏱️ {top3[2].timeSeconds}s
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Leaderboard Table */}
          <div className="bg-[#14132e] border border-white/10 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-12 px-4 py-2.5 bg-[#1b193d] text-[11px] font-black text-white/50 uppercase tracking-wider border-b border-white/10">
              <span className="col-span-1 text-center">Rank</span>
              <span className="col-span-4 sm:col-span-4">Contestant</span>
              <span className="col-span-2 text-center">Mode</span>
              <span className="col-span-2 text-right">Coins</span>
              <span className="col-span-3 sm:col-span-3 text-right">Score</span>
            </div>

            {loading ? (
              <div className="py-12 text-center text-sm text-white/50 flex flex-col items-center justify-center gap-2">
                <RefreshCw className="w-5 h-5 animate-spin text-pink-400" />
                <span>Fetching worldwide scores...</span>
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className="py-12 text-center text-sm text-white/50">
                No scores found matching your criteria. Be the first to escape!
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {filteredEntries.map((entry, index) => {
                  const isCurrent = currentPlayerName && entry.playerName.includes(currentPlayerName);
                  const isGold = index === 0;
                  const isSilver = index === 1;
                  const isBronze = index === 2;

                  return (
                    <div
                      key={entry.id || index}
                      className={`grid grid-cols-12 px-4 py-3 items-center text-xs transition-colors ${
                        isCurrent
                          ? 'bg-pink-500/15 border-l-4 border-pink-500 font-bold'
                          : index % 2 === 0
                          ? 'bg-transparent'
                          : 'bg-white/[0.02]'
                      } hover:bg-white/[0.05]`}
                    >
                      {/* Rank */}
                      <span className="col-span-1 text-center font-black">
                        {isGold ? (
                          <span className="text-yellow-400">🥇</span>
                        ) : isSilver ? (
                          <span className="text-slate-300">🥈</span>
                        ) : isBronze ? (
                          <span className="text-amber-500">🥉</span>
                        ) : (
                          <span className="text-white/40">#{index + 1}</span>
                        )}
                      </span>

                      {/* Contestant */}
                      <div className="col-span-4 sm:col-span-4 flex items-center gap-2 min-w-0 pr-2">
                        <span className="text-base">{getFlag(entry.country)}</span>
                        <span className="font-extrabold text-white truncate max-w-[180px]">
                          {entry.playerName}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] bg-pink-500 text-white px-1.5 py-0.2 rounded font-black">
                            YOU
                          </span>
                        )}
                      </div>

                      {/* Mode */}
                      <span className="col-span-2 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-white/5 text-white/70 border border-white/10">
                          {entry.mode}
                        </span>
                      </span>

                      {/* Coins */}
                      <span className="col-span-2 text-right font-semibold text-yellow-300">
                        🪙 {entry.coins}
                      </span>

                      {/* Score & Time */}
                      <div className="col-span-3 sm:col-span-3 text-right">
                        <span className="font-black text-sm text-pink-400">
                          {entry.score.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-white/40 block">
                          ⏱️ {entry.timeSeconds}s
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#151433] border-t border-white/10 flex items-center justify-between text-xs text-white/60">
          <span>Runs are saved in real-time to the global server.</span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 text-white font-extrabold cursor-pointer hover:opacity-90 shadow"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};
