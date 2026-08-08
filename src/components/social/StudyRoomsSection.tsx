// Relative Path: src/components/social/StudyRoomsSection.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import StudyRoomStage from "@/components/social/rooms/StudyRoomStage";

export default function StudyRoomsSection() {
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "public" | "mine">("all");
  
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [joiningCode, setJoiningCode] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeRoom, setActiveRoom] = useState<any>(null);
  
  // Room Live Chat States
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [pinnedMessage, setPinnedMessage] = useState<any>(null);
  const [newChatMessage, setNewChatMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [sendingChat, setSendingChat] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Form states for room creation
  const [roomName, setRoomName] = useState("");
  const [roomDesc, setRoomDesc] = useState("");
  const [roomTopic, setRoomTopic] = useState("Numerical Reasoning");
  const [isPublic, setIsPublic] = useState(true);
  const [maxMembers, setMaxMembers] = useState(10);
  const [creating, setCreating] = useState(false);

  const topicOptions = [
    "Numerical Reasoning",
    "Verbal Ability",
    "Analytical Reasoning",
    "General Information",
    "Philippine Constitution",
    "Full Mock Drill",
  ];

  const quickEmojis = ["👍", "🔥", "💡", "❓", "👏", "💯", "✍️", "🎉"];

  const fetchRooms = async () => {
    try {
      const meRes = await fetch("/api/auth/me");
      if (meRes.ok) {
        const meData = await meRes.json();
        setCurrentUserId(meData.user?.id || null);
      }

      const res = await fetch(`/api/social/rooms?filter=${filter}`);
      if (res.ok) {
        const data = await res.json();
        setRooms(data.rooms || []);
      }
    } catch (err) {
      console.error("Failed to fetch rooms:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, [filter]);

  // Live polling for room messages every 3 seconds
  useEffect(() => {
    if (!activeRoom?.id) return;

    const fetchChat = async () => {
      try {
        const res = await fetch(`/api/social/rooms/${activeRoom.id}/chat`);
        if (res.ok) {
          const data = await res.json();
          setChatMessages(data.messages || []);
          setPinnedMessage(data.pinnedMessage || null);
        }
      } catch (err) {
        console.error("Failed to load room chat:", err);
      }
    };

    fetchChat();
    const interval = setInterval(fetchChat, 3000);
    return () => clearInterval(interval);
  }, [activeRoom?.id]);

  // Container-only scroll fix (Prevents global window auto-scroll)
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const joinRoom = async (roomId?: string, code?: string) => {
    setJoiningCode(true);
    try {
      const res = await fetch("/api/social/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, inviteCode: code }),
      });
      if (res.ok) {
        const data = await res.json();
        setInviteCodeInput("");
        await openRoomView(data.roomId);
        await fetchRooms();
      }
    } catch (err) {
      console.error("Failed to join room:", err);
    } finally {
      setJoiningCode(false);
    }
  };

  const createRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim() || creating) return;

    setCreating(true);
    try {
      const res = await fetch("/api/social/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: roomName,
          description: roomDesc,
          topic: roomTopic,
          isPublic,
          maxParticipants: maxMembers,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setShowCreateModal(false);
        setRoomName("");
        setRoomDesc("");
        await openRoomView(data.room.id);
        await fetchRooms();
      }
    } catch (err) {
      console.error("Failed to create room:", err);
    } finally {
      setCreating(false);
    }
  };

  const openRoomView = async (roomId: string) => {
    try {
      const res = await fetch(`/api/social/rooms/${roomId}`);
      if (res.ok) {
        const data = await res.json();
        setActiveRoom(data.room);
      }
    } catch (err) {
      console.error("Failed to fetch room view:", err);
    }
  };

  const leaveRoom = async (roomId: string) => {
    try {
      const res = await fetch(`/api/social/rooms/${roomId}`, { method: "DELETE" });
      if (res.ok) {
        setActiveRoom(null);
        setChatMessages([]);
        setPinnedMessage(null);
        await fetchRooms();
      }
    } catch (err) {
      console.error("Failed to leave room:", err);
    }
  };

  const sendRoomMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newChatMessage.trim() || !activeRoom?.id || sendingChat) return;

    setSendingChat(true);
    try {
      const res = await fetch(`/api/social/rooms/${activeRoom.id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newChatMessage }),
      });
      if (res.ok) {
        setNewChatMessage("");
        const data = await res.json();
        setChatMessages((prev) => [...prev, data.message]);
      }
    } catch (err) {
      console.error("Failed to send room chat:", err);
    } finally {
      setSendingChat(false);
    }
  };

  const togglePinMessage = async (messageId: string) => {
    if (!activeRoom?.id) return;
    try {
      const res = await fetch(`/api/social/rooms/${activeRoom.id}/chat`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId }),
      });
      if (res.ok) {
        const chatRes = await fetch(`/api/social/rooms/${activeRoom.id}/chat`);
        if (chatRes.ok) {
          const data = await chatRes.json();
          setChatMessages(data.messages || []);
          setPinnedMessage(data.pinnedMessage || null);
        }
      }
    } catch (err) {
      console.error("Failed to toggle pin:", err);
    }
  };

  const deleteRoomMessage = async (messageId: string) => {
    if (!activeRoom?.id) return;
    try {
      const res = await fetch(`/api/social/rooms/${activeRoom.id}/chat?messageId=${messageId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setChatMessages((prev) => prev.filter((m) => m.id !== messageId));
      }
    } catch (err) {
      console.error("Failed to delete message:", err);
    }
  };

  const kickParticipant = async (roomId: string, targetUserId: string) => {
    try {
      const res = await fetch(`/api/social/rooms/${roomId}/participants?targetUserId=${targetUserId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await openRoomView(roomId);
      }
    } catch (err) {
      console.error("Failed to kick participant:", err);
    }
  };

  if (activeRoom) {
    return (
      <div className="space-y-6">
        {/* ROOM ACTIVE VIEW HEADER */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-xl">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 bg-blue-500/20 text-blue-400 rounded-full border border-blue-500/30">
                {activeRoom.topic}
              </span>
              <span className="text-[10px] font-bold text-slate-400">
                Invite Code: <code className="text-white font-mono bg-slate-950 px-2 py-0.5 rounded border border-slate-800">{activeRoom.inviteCode}</code>
              </span>
            </div>
            <h2 className="text-xl font-black text-white">{activeRoom.name}</h2>
            {activeRoom.description && (
              <p className="text-xs text-slate-400 mt-1 max-w-xl">{activeRoom.description}</p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => leaveRoom(activeRoom.id)}
              className="px-4 py-2 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Leave Room
            </button>
            <button
              onClick={() => setActiveRoom(null)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              &larr; Back to Directory
            </button>
          </div>
        </div>

        {/* INTERACTIVE VOICE, SCREEN SHARE, AND LIVE WHITEBOARD STAGE */}
        <StudyRoomStage
          roomId={activeRoom.id}
          roomName={activeRoom.name}
          isHost={activeRoom.isHost || activeRoom.hostId === currentUserId}
        />

        {/* WORKSPACE & LIVE GROUP CHAT */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LIVE GROUP CHAT PANEL */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl flex flex-col justify-between overflow-hidden min-h-[460px]">
            {pinnedMessage && (
              <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2.5 flex items-center justify-between gap-3 text-xs text-amber-200">
                <div className="flex items-center gap-2 truncate">
                  <span className="shrink-0">📌</span>
                  <span className="truncate"><b>{pinnedMessage.senderName}:</b> {pinnedMessage.content}</span>
                </div>
                {activeRoom.isHost && (
                  <button
                    onClick={() => togglePinMessage(pinnedMessage.id)}
                    className="text-[10px] text-amber-400 hover:text-white font-bold shrink-0 cursor-pointer"
                  >
                    Unpin
                  </button>
                )}
              </div>
            )}

            {/* MESSAGE FEED (Container Scroll Only) */}
            <div ref={chatContainerRef} className="p-5 flex-1 overflow-y-auto max-h-[380px] space-y-3">
              {chatMessages.length === 0 ? (
                <div className="text-center py-16 text-slate-500 space-y-2">
                  <span className="text-4xl block">💬</span>
                  <p className="text-xs font-bold text-slate-300">Room Chat Ready</p>
                  <p className="text-[10px] font-semibold text-slate-500">Ask questions or share solutions with room participants.</p>
                </div>
              ) : (
                chatMessages.map((msg) => {
                  const isMine = msg.senderId === currentUserId;
                  const isRoomHostMsg = msg.senderId === activeRoom.hostId;
                  return (
                    <div key={msg.id} className={`flex flex-col ${isMine ? "items-end" : "items-start"} group space-y-1`}>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 px-1">
                        <span className="font-bold text-white">{msg.senderName}</span>
                        {isRoomHostMsg && (
                          <span className="text-[9px] font-black uppercase text-amber-400 px-1.5 py-0.2 bg-amber-500/10 rounded border border-amber-500/20">
                            Host
                          </span>
                        )}
                        <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>

                      <div className="flex items-center gap-2 max-w-[85%]">
                        {(isMine || activeRoom.isHost) && (
                          <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition">
                            {activeRoom.isHost && (
                              <button
                                onClick={() => togglePinMessage(msg.id)}
                                className="text-[10px] text-slate-400 hover:text-amber-400 cursor-pointer"
                                title="Pin Message"
                              >
                                📌
                              </button>
                            )}
                            <button
                              onClick={() => deleteRoomMessage(msg.id)}
                              className="text-[10px] text-slate-400 hover:text-rose-400 cursor-pointer"
                              title="Delete Message"
                            >
                              🗑️
                            </button>
                          </div>
                        )}

                        <div className={`p-3 rounded-2xl text-xs leading-relaxed ${
                          isMine
                            ? "bg-blue-600 text-white rounded-br-none"
                            : "bg-slate-950 border border-slate-800 text-slate-200 rounded-bl-none"
                        }`}>
                          {msg.content}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* EMOJI BAR & INPUT FORM */}
            <div className="p-3 bg-slate-950 border-t border-slate-800 space-y-2">
              <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
                {quickEmojis.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setNewChatMessage((prev) => prev + e)}
                    className="px-2 py-1 bg-slate-900 hover:bg-slate-800 rounded-lg text-xs transition cursor-pointer shrink-0"
                  >
                    {e}
                  </button>
                ))}
              </div>

              <form onSubmit={sendRoomMessage} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ask a question or explain a solution..."
                  value={newChatMessage}
                  onChange={(e) => setNewChatMessage(e.target.value)}
                  className="px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 flex-1"
                />
                <button
                  type="submit"
                  disabled={sendingChat || !newChatMessage.trim()}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl transition cursor-pointer disabled:opacity-50 shrink-0"
                >
                  {sendingChat ? "..." : "Send"}
                </button>
              </form>
            </div>
          </div>

          {/* PARTICIPANTS PANEL */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex justify-between items-center">
              <span>Participants ({activeRoom.participants.length}/{activeRoom.maxParticipants})</span>
              <span className="text-[10px] text-emerald-400 font-semibold">&bull; Active Room</span>
            </h4>

            <div className="space-y-2 max-h-[380px] overflow-y-auto">
              {activeRoom.participants.map((p: any) => (
                <div key={p.id} className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center font-bold text-blue-400 text-xs uppercase shrink-0">
                      {p.name ? p.name[0] : "U"}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-xs font-bold text-white truncate">{p.name || "Examinee"}</p>
                      <span className="text-[10px] text-slate-500 block">
                        {p.role === "HOST" ? "👑 Room Host" : "Member"}
                      </span>
                    </div>
                  </div>

                  {activeRoom.isHost && p.userId !== activeRoom.hostId && (
                    <button
                      onClick={() => kickParticipant(activeRoom.id, p.userId)}
                      className="text-[10px] font-bold text-rose-400 hover:text-rose-300 p-1 cursor-pointer"
                    >
                      Kick
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER BAR & CONTROLS */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/80 p-5 rounded-2xl border border-slate-800">
        <div>
          <h3 className="text-sm font-bold text-white">Active Study Rooms</h3>
          <p className="text-xs text-slate-400">Join virtual group review rooms or create your own session.</p>
        </div>

        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Invite Code (e.g., A8K2L9)"
            value={inviteCodeInput}
            onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white uppercase font-mono placeholder-slate-500 focus:outline-none focus:border-blue-500 w-36"
          />
          <button
            onClick={() => joinRoom(undefined, inviteCodeInput)}
            disabled={joiningCode || !inviteCodeInput.trim()}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-50"
          >
            Join
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition cursor-pointer"
          >
            + Create Room
          </button>
        </div>
      </div>

      {/* FILTER TABS */}
      <div className="flex gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            filter === "all" ? "bg-blue-600/20 text-blue-400 border border-blue-500/30" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          All Public Rooms
        </button>
        <button
          onClick={() => setFilter("mine")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            filter === "mine" ? "bg-blue-600/20 text-blue-400 border border-blue-500/30" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          My Active Rooms
        </button>
      </div>

      {/* ROOM DIRECTORY GRID */}
      {loading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-400 font-bold animate-pulse">
          Loading study room directory...
        </div>
      ) : rooms.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
          <span className="text-4xl block">🎧</span>
          <h4 className="text-sm font-bold text-white">No Active Study Rooms Found</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            Be the first to create a study room and invite classmates to review Civil Service Exam topics together.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {rooms.map((room) => (
            <div key={room.id} className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-4 hover:border-slate-700 transition">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 bg-blue-500/10 text-blue-400 rounded-full border border-blue-500/20">
                  {room.topic}
                </span>
                <span className="text-[10px] font-bold text-slate-500">
                  {room.participantCount}/{room.maxParticipants} Examinees
                </span>
              </div>

              <div>
                <h4 className="text-sm font-bold text-white truncate">{room.name}</h4>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2 min-h-[32px]">
                  {room.description || "Interactive group practice and problem solving."}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[10px] text-slate-500 font-semibold">
                  Host: {room.host?.name || "Examinee"}
                </span>

                {room.isMember ? (
                  <button
                    onClick={() => openRoomView(room.id)}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold rounded-xl transition cursor-pointer"
                  >
                    Open Room
                  </button>
                ) : (
                  <button
                    onClick={() => joinRoom(room.id)}
                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    Join Room
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE ROOM MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">Create New Study Room</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white text-xs cursor-pointer">
                &times;
              </button>
            </div>

            <form onSubmit={createRoom} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Room Title *</label>
                <input
                  type="text"
                  placeholder="e.g., Numerical Reasoning Marathon"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Study Topic</label>
                <select
                  value={roomTopic}
                  onChange={(e) => setRoomTopic(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  {topicOptions.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Description (Optional)</label>
                <textarea
                  placeholder="What will your group focus on during this session?"
                  value={roomDesc}
                  onChange={(e) => setRoomDesc(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500 h-20"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Capacity Limit</label>
                  <input
                    type="number"
                    min="2"
                    max="50"
                    value={maxMembers}
                    onChange={(e) => setMaxMembers(Number(e.target.value))}
                    className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Privacy</label>
                  <select
                    value={isPublic ? "public" : "private"}
                    onChange={(e) => setIsPublic(e.target.value === "public")}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="public">Public Directory</option>
                    <option value="private">Private (Invite Only)</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !roomName.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Launch Room"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}