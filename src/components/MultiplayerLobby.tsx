import React, { useState, useEffect, useRef } from 'react';
import { PlayerProfile, RemotePlayer, RoomInfo, ChatMessage } from '../types/game';
import { getFlag } from '../utils/playerStorage';
import { soundEngine } from '../utils/audio';
import { Globe, Users, ArrowLeft, Send, Sparkles, AlertCircle, Play, Smile } from 'lucide-react';

interface MultiplayerLobbyProps {
  profile: PlayerProfile;
  onBack: () => void;
  onGameStart: (socket: WebSocket, roomId: string, seed: number, initialPlayers: RemotePlayer[]) => void;
}

export const MultiplayerLobby: React.FC<MultiplayerLobbyProps> = ({ profile, onBack, onGameStart }) => {
  const [roomIdInput, setRoomIdInput] = useState<string>('carnival-global-1');
  const [connected, setConnected] = useState<boolean>(false);
  const [inRoom, setInRoom] = useState<boolean>(false);
  const [currentRoom, setCurrentRoom] = useState<RoomInfo | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatText, setChatText] = useState<string>('');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [publicRooms, setPublicRooms] = useState<any[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const currentRoomRef = useRef<RoomInfo | null>(null);
  const handedOffToGameRef = useRef<boolean>(false);

  // Fetch active public rooms
  const fetchRooms = async () => {
    try {
      const res = await fetch('/api/multiplayer/rooms');
      const data = await res.json();
      if (data.success && Array.isArray(data.rooms)) {
        setPublicRooms(data.rooms);
      }
    } catch (err) {
      console.error('Failed to fetch rooms:', err);
    }
  };

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 4000);
    return () => clearInterval(interval);
  }, []);

  // Connect to WebSocket
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'joined_success') {
          setInRoom(true);
          soundEngine.playCoinSound();
        } else if (data.type === 'room_state') {
          const updatedRoom: RoomInfo = {
            id: data.roomId,
            name: `Arena ${data.roomId}`,
            status: data.status,
            countdown: data.countdown,
            seed: data.seed,
            players: data.players || [],
          };
          currentRoomRef.current = updatedRoom;
          setCurrentRoom(updatedRoom);
        } else if (data.type === 'countdown_tick') {
          setCountdown(data.countdown);
          soundEngine.playCountdownBeep(data.countdown === 1);
        } else if (data.type === 'game_started') {
          setCountdown(0);
          soundEngine.playCountdownBeep(true);
          if (wsRef.current && currentRoomRef.current) {
            handedOffToGameRef.current = true;
            onGameStart(
              wsRef.current,
              currentRoomRef.current.id,
              data.seed,
              currentRoomRef.current.players
            );
          }
        } else if (data.type === 'chat') {
          setChatMessages((prev) => [
            ...prev.slice(-40),
            {
              id: `msg-${Date.now()}-${Math.random()}`,
              playerId: data.playerId,
              playerName: data.playerName,
              playerColor: data.playerColor || '#39bfff',
              text: data.text,
              time: data.time || '',
            },
          ]);
        } else if (data.type === 'reaction') {
          soundEngine.playCoinSound();
          setChatMessages((prev) => [
            ...prev.slice(-40),
            {
              id: `react-${Date.now()}`,
              playerId: data.playerId,
              playerName: data.playerName,
              playerColor: '#ff3ea5',
              text: `sent ${data.emoji}`,
              time: 'now',
            },
          ]);
        }
      } catch (err) {
        console.error('Error handling ws message in lobby:', err);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      setInRoom(false);
    };

    return () => {
      if (!handedOffToGameRef.current && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const joinRoom = (targetRoomId: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const cleanId = targetRoomId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '') || 'carnival-global-1';
    wsRef.current.send(
      JSON.stringify({
        type: 'join_room',
        roomId: cleanId,
        playerName: profile.name,
        playerColor: profile.color,
        country: profile.country,
      })
    );
  };

  const requestStart = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(
      JSON.stringify({
        type: 'request_start',
      })
    );
  };

  const sendChatMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatText.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(
      JSON.stringify({
        type: 'chat_message',
        text: chatText.trim(),
      })
    );
    setChatText('');
  };

  const sendEmojiReaction = (emoji: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(
      JSON.stringify({
        type: 'send_reaction',
        emoji,
      })
    );
  };

  const EMOJIS = ['🎪', '🤡', '🏃', '💀', '🔥', '🪙', '⚡', '🎉'];

  return (
    <div className="relative w-full h-full min-h-dvh bg-[#080816] text-white flex flex-col justify-between overflow-y-auto selection:bg-pink-500 selection:text-white">
      {/* Background Neon Lights */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-cyan-600/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 left-1/4 w-96 h-96 bg-pink-600/15 rounded-full blur-[140px] pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 w-full px-4 sm:px-6 py-4 flex items-center justify-between border-b border-white/10 bg-[#0d0d21]/70 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-xl bg-[#181834] border border-white/10 hover:border-white/30 text-white/70 hover:text-white transition-all cursor-pointer"
            title="Return to Cover"
            aria-label="Return to Cover"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-cyan-300">
              WORLDWIDE MULTIPLAYER ARENA
            </h1>
            <p className="text-xs text-white/50">Race with contestants across the globe in real-time</p>
          </div>
        </div>

        {/* Connection status pill */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#16152e] border border-white/10 text-xs font-bold">
            <span
              className={`w-2 h-2 rounded-full ${
                connected ? 'bg-emerald-400' : 'bg-rose-400 animate-pulse'
              }`}
            />
            <span className="text-white/80">{connected ? 'Online Server' : 'Connecting...'}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Room Joining & Public Arenas */}
        {!inRoom ? (
          <div className="lg:col-span-12 max-w-2xl mx-auto w-full space-y-6">
            {/* Quick Match Card */}
            <div className="bg-gradient-to-br from-[#1b1535] to-[#110f27] border border-pink-500/30 rounded-3xl p-6 shadow-xl shadow-pink-500/10">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center">
                  <Globe className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white">WORLDWIDE QUICK MATCH</h2>
                  <p className="text-xs text-white/60">Instant matchmaking into an active carnival arena</p>
                </div>
              </div>

              <div className="mt-4 flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={roomIdInput}
                  onChange={(e) => setRoomIdInput(e.target.value)}
                  placeholder="Arena Code (e.g. carnival-global-1)"
                  className="flex-1 bg-[#15132d] border border-white/15 focus:border-cyan-400 rounded-xl px-4 py-3 text-sm text-white font-bold outline-none"
                />
                <button
                  onClick={() => joinRoom(roomIdInput)}
                  disabled={!connected}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 font-extrabold text-sm uppercase tracking-wide cursor-pointer shadow-lg shadow-pink-500/30 transition-all flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>JOIN ARENA</span>
                </button>
              </div>
            </div>

            {/* Public Arenas List */}
            <div className="bg-[#121128] border border-white/10 rounded-3xl p-6 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-cyan-400" /> ACTIVE WORLDWIDE ARENAS
                </h3>
                <span className="text-xs text-white/40">{publicRooms.length} Active Rooms</span>
              </div>

              {publicRooms.length === 0 ? (
                <div className="text-center py-8 text-white/40 text-xs">
                  No other active arenas right now. Click "JOIN ARENA" above to start the first global match!
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {publicRooms.map((room) => (
                    <div
                      key={room.id}
                      className="p-4 bg-[#181636] border border-white/10 hover:border-pink-500/50 rounded-2xl flex items-center justify-between transition-all"
                    >
                      <div>
                        <div className="text-sm font-black text-white">{room.name}</div>
                        <div className="text-[11px] text-white/50">
                          {room.playerCount} / {room.maxPlayers} Contestants • Status: {room.status}
                        </div>
                      </div>
                      <button
                        onClick={() => joinRoom(room.id)}
                        className="px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-bold cursor-pointer"
                      >
                        Enter
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Active Room Lobby View */
          <>
            {/* Left: Players Roster & Start Control */}
            <div className="lg:col-span-7 space-y-5">
              <div className="bg-[#13112b] border border-white/15 rounded-3xl p-6 shadow-xl">
                <div className="flex items-center justify-between pb-4 border-b border-white/10">
                  <div>
                    <span className="text-[10px] font-bold text-pink-400 uppercase tracking-wider block">
                      CURRENT ARENA
                    </span>
                    <h2 className="text-xl font-black text-white">{currentRoom?.id}</h2>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-extrabold text-cyan-300">
                      👥 {currentRoom?.players.length || 1} / 8 Racers
                    </span>
                    <p className="text-[11px] text-white/40">Synchronized 2D Maze</p>
                  </div>
                </div>

                {/* Countdown Alert Banner */}
                {countdown !== null && countdown > 0 && (
                  <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-pink-600 to-purple-600 text-center animate-pulse shadow-lg">
                    <div className="text-xs uppercase font-extrabold text-pink-200">RACE STARTING IN</div>
                    <div className="text-4xl font-black text-white mt-1">{countdown}</div>
                  </div>
                )}

                {/* Players Roster Grid */}
                <div className="mt-5 space-y-2">
                  <h4 className="text-xs font-bold text-white/50 uppercase tracking-wider">Connected Contestants</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {currentRoom?.players.map((p) => {
                      const isMe = p.name === profile.name;
                      return (
                        <div
                          key={p.id}
                          className={`p-3 rounded-2xl border flex items-center justify-between ${
                            isMe
                              ? 'bg-[#221c40] border-pink-500/70 shadow-md shadow-pink-500/20'
                              : 'bg-[#181636] border-white/10'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-xl">{getFlag(p.country)}</span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <div
                                  className="w-3 h-3 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: p.color }}
                                />
                                <span className="text-xs font-black text-white truncate max-w-[120px]">
                                  {p.name}
                                </span>
                              </div>
                              <span className="text-[10px] text-white/40">{isMe ? '(You)' : 'Contestant'}</span>
                            </div>
                          </div>
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            READY
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Action Controls */}
                <div className="mt-6 pt-4 border-t border-white/10 flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={requestStart}
                    className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-400 hover:to-purple-500 font-black text-sm uppercase tracking-wide cursor-pointer shadow-lg shadow-pink-500/30 transition-all flex items-center justify-center gap-2"
                  >
                    <Play className="w-5 h-5 fill-white" />
                    <span>START RACE NOW</span>
                  </button>
                  <button
                    onClick={() => setInRoom(false)}
                    className="px-5 py-3.5 rounded-2xl bg-[#201d40] hover:bg-[#2b2754] text-xs font-bold text-white/70 hover:text-white cursor-pointer"
                  >
                    Leave Arena
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Live Arena Chat & Quick Emojis */}
            <div className="lg:col-span-5 flex flex-col h-[460px] bg-[#13112b] border border-white/15 rounded-3xl p-4 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <span className="text-xs font-extrabold text-white flex items-center gap-2">
                  <Smile className="w-4 h-4 text-yellow-400" /> LIVE ARENA CHAT
                </span>
                <span className="text-[10px] text-white/40">Broadcasted globally</span>
              </div>

              {/* Chat messages list */}
              <div ref={chatScrollRef} className="flex-1 overflow-y-auto py-3 space-y-2 pr-1">
                {chatMessages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-white/40 text-center">
                    Say hello or send a carnival reaction to other runners!
                  </div>
                ) : (
                  chatMessages.map((m) => (
                    <div key={m.id} className="text-xs p-2 rounded-xl bg-[#1b193d]/80 border border-white/5">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-extrabold truncate max-w-[120px]" style={{ color: m.playerColor }}>
                          {m.playerName}
                        </span>
                        <span className="text-[9px] text-white/40">{m.time}</span>
                      </div>
                      <p className="text-white/80 break-words">{m.text}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Quick Emojis */}
              <div className="py-2 border-t border-white/10 flex items-center justify-between gap-1 overflow-x-auto">
                {EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => sendEmojiReaction(emoji)}
                    className="text-lg p-1.5 rounded-lg hover:bg-white/10 transition-transform hover:scale-125 cursor-pointer"
                    title={`Send ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Chat Input */}
              <form onSubmit={sendChatMessage} className="flex gap-2 pt-2">
                <input
                  type="text"
                  maxLength={75}
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                  placeholder="Send message to racers..."
                  className="flex-1 bg-[#1a1738] border border-white/15 focus:border-pink-500 rounded-xl px-3 py-2 text-xs text-white outline-none"
                />
                <button
                  type="submit"
                  className="p-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full px-6 py-3 border-t border-white/10 bg-[#0d0d21]/70 text-center text-xs text-white/40">
        Rooms feature server-authoritative maze seeds so all players navigate identical 2D labyrinths in real-time.
      </footer>
    </div>
  );
};
