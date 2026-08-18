// Relative Path: src/components/social/StudyRoomsSection.tsx
"use client";

import { useEffect, useState } from "react";
import StudyRoomStage from "@/components/social/rooms/StudyRoomStage";
import { RoomRoleBadge } from "@/components/social/rooms/RoomRoleBadge";
import { RoomSettingsModal } from "@/components/social/rooms/RoomSettingsModal";
import { ParticipantActionsMenu } from "@/components/social/rooms/ParticipantActionsMenu";
import { PresenceBadge } from "@/components/social/presence/PresenceBadge";

export default function StudyRoomsSection() {
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState<any[]>([]);
  const [filter, setFilter] = useState<"all" | "mine">("all");
  const [currentUserId, setCurrentUserId] = useState<string>("");

  // Create room modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [roomDesc, setRoomDesc] = useState("");
  const [roomTopic, setRoomTopic] = useState("General Review");
  const [isPublic, setIsPublic] = useState(true);
  const [maxMembers, setMaxMembers] = useState(10);
  const [creating, setCreating] = useState(false);

  // Active room view state
  const [activeRoom, setActiveRoom] = useState<any | null>(null);
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [joiningCode, setJoiningCode] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Delete room state
  const [roomToDelete, setRoomToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deletingRoom, setDeletingRoom] = useState(false);

  // Room chat state
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [pinnedMessage, setPinnedMessage] = useState<any | null>(null);
  const [newChatMessage, setNewChatMessage] = useState("");
  const [sendingChat, setSendingChat] = useState(false);

  useEffect(() => {
    // Fetch current user id
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user?.id) setCurrentUserId(String(data.user.id));
      })
      .catch(() => {});
  }, []);

  const fetchRooms = async () => {
    try {
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

  // Poll room details & chat when active
  useEffect(() => {
    if (!activeRoom?.id) return;

    let isMounted = true;
    const fetchChat = async () => {
      try {
        const res = await fetch(`/api/social/rooms/${activeRoom.id}/chat`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setChatMessages(data.messages || []);
            setPinnedMessage(data.pinnedMessage || null);
          }
        }
      } catch (err) {
        console.error("Chat poll error:", err);
      }
    };

    fetchChat();
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && !document.hidden) {
        fetchChat();
      }
    }, 4000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeRoom?.id]);

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
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to join room");
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

  const refreshActiveRoom = async () => {
    if (activeRoom?.id) {
      await openRoomView(activeRoom.id);
    }
  };

  const leaveRoom = async (roomId: string) => {
    try {
      const res = await fetch(`/api/social/rooms/${roomId}/leave`, { method: "POST" });
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

  const confirmDeleteRoom = async () => {
    if (!roomToDelete?.id || deletingRoom) return;

    setDeletingRoom(true);
    try {
      const res = await fetch(`/api/social/rooms/${roomToDelete.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        if (activeRoom?.id === roomToDelete.id) {
          setActiveRoom(null);
          setChatMessages([]);
          setPinnedMessage(null);
        }
        setRoomToDelete(null);
        await fetchRooms();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to delete study room");
      }
    } catch (err) {
      console.error("Failed to delete room:", err);
    } finally {
      setDeletingRoom(false);
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
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to send message");
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

  // ACTIVE ROOM VIEW
  if (activeRoom) {
    const currentUserRole = activeRoom.currentUserRole || (activeRoom.isHost ? "HOST" : "MEMBER");
    const isHost = currentUserRole === "HOST";
    const isModerator = currentUserRole === "MODERATOR";
    const isHostOrMod = isHost || isModerator;

    const currentParticipant = activeRoom.participants.find((p: any) => p.userId === currentUserId);
    const canUserDraw = currentParticipant?.canDraw ?? true;
    const canUserShare = currentParticipant?.canShare ?? true;
    const isUserForceMuted = currentParticipant?.isMuted ?? false;

    return (
      <div className="space-y-6 animate-fade-in">
        {/* ROOM TOP BAR */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-slate-200/90 p-5 rounded-3xl shadow-xs">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-700 px-2.5 py-0.5 bg-blue-50 rounded-full border border-blue-200">
                {activeRoom.topic}
              </span>
              <RoomRoleBadge role={currentUserRole} size="sm" />
              {activeRoom.isLocked && (
                <span className="text-[10px] font-black text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                  🔒 Locked
                </span>
              )}
            </div>
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span>{activeRoom.name}</span>
            </h3>
            {activeRoom.description && (
              <p className="text-xs text-slate-500 max-w-xl">{activeRoom.description}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-700 flex items-center gap-1.5">
              <span className="text-slate-400 text-[10px]">Invite Code:</span>
              <span className="font-bold text-slate-900">{activeRoom.inviteCode}</span>
            </div>

            {/* Room Host Settings Button */}
            {isHost && (
              <button
                type="button"
                onClick={() => setShowSettingsModal(true)}
                className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5"
                title="Room Settings & Policies"
              >
                <span>👑</span>
                <span>Policies</span>
              </button>
            )}

            {/* Delete Room Button (Host Only) */}
            {activeRoom.isHost && (
              <button
                type="button"
                onClick={() => setRoomToDelete({ id: activeRoom.id, name: activeRoom.name })}
                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition cursor-pointer"
                title="Permanently Delete Study Room"
              >
                Delete Room
              </button>
            )}

            <button
              type="button"
              onClick={() => leaveRoom(activeRoom.id)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 text-xs font-bold rounded-xl transition border border-slate-200 cursor-pointer"
            >
              Leave Room
            </button>
          </div>
        </div>

        {/* INTERACTIVE STUDY STAGE */}
        <StudyRoomStage
          roomId={activeRoom.id}
          roomName={activeRoom.name}
          isHost={isHost}
          userRole={currentUserRole}
          allowMemberWhiteboard={activeRoom.allowMemberWhiteboard}
          allowMemberScreenShare={activeRoom.allowMemberScreenShare}
          canUserDraw={canUserDraw}
          canUserShare={canUserShare}
          isUserForceMuted={isUserForceMuted}
          activeTopicType={activeRoom.activeTopicType}
          activeQuestionId={activeRoom.activeQuestionId}
          activeTopicImage={activeRoom.activeTopicImage}
          activeTopicMeta={activeRoom.activeTopicMeta}
          onOpenSettings={() => setShowSettingsModal(true)}
          onTopicChanged={() => openRoomView(activeRoom.id)}
        />

        {/* TWO COLUMN: LIVE CHAT & PARTICIPANTS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ROOM LIVE CHAT */}
          <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-3xl p-5 space-y-4 flex flex-col h-[480px] shadow-xs">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <span>💬 Live Study Chat</span>
                <span className="text-[10px] text-slate-500 font-normal">({chatMessages.length} msgs)</span>
              </h4>
              {activeRoom.allowMemberChat === false && (
                <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                  🔒 Chat Restricted to Host/Mods
                </span>
              )}
            </div>

            {/* PINNED MESSAGE BANNER */}
            {pinnedMessage && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between gap-2 text-xs text-amber-800">
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className="text-sm">📌</span>
                  <div className="truncate">
                    <span className="font-bold">{pinnedMessage.senderName}: </span>
                    <span>{pinnedMessage.content}</span>
                  </div>
                </div>
                {isHostOrMod && (
                  <button
                    onClick={() => togglePinMessage(pinnedMessage.id)}
                    className="text-[10px] font-bold text-amber-700 hover:text-amber-900 cursor-pointer px-2 py-0.5 rounded"
                  >
                    Unpin
                  </button>
                )}
              </div>
            )}

            {/* MESSAGE STREAM */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {chatMessages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">
                  No messages yet. Start collaborating by saying hi!
                </div>
              ) : (
                chatMessages.map((msg) => {
                  const isMine = msg.senderId === currentUserId;
                  return (
                    <div
                      key={msg.id}
                      className={`group p-3 rounded-2xl border text-xs flex flex-col space-y-1 relative ${
                        isMine
                          ? "bg-blue-50 border-blue-200 ml-8"
                          : "bg-slate-50 border-slate-200/80 mr-8"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-extrabold text-slate-800 flex items-center gap-1.5">
                          <span>{msg.senderName}</span>
                          {msg.isPinned && <span className="text-[10px]">📌</span>}
                        </span>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">
                          {isHostOrMod && (
                            <button
                              onClick={() => togglePinMessage(msg.id)}
                              className="text-[10px] text-amber-600 hover:text-amber-800 cursor-pointer"
                              title={msg.isPinned ? "Unpin" : "Pin message"}
                            >
                              📌
                            </button>
                          )}
                          {(isMine || isHostOrMod) && (
                            <button
                              onClick={() => deleteRoomMessage(msg.id)}
                              className="text-[10px] text-rose-500 hover:text-rose-700 cursor-pointer"
                              title="Delete message"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-slate-700 leading-relaxed break-words">{msg.content}</p>
                    </div>
                  );
                })
              )}
            </div>

            {/* CHAT INPUT */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
                {["👍 Got it", "❓ Need help with Q12", "💡 Good explanation!", "🎯 Let's review Math"].map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setNewChatMessage((prev) => prev + (prev ? " " : "") + e)}
                    className="px-2 py-1 bg-slate-50 hover:bg-slate-100 rounded-lg text-[10px] text-slate-700 transition cursor-pointer shrink-0 border border-slate-200"
                  >
                    {e}
                  </button>
                ))}
              </div>

              {activeRoom.allowMemberChat === false && !isHostOrMod ? (
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500">
                  🔒 Chat is locked to Host and Moderators.
                </div>
              ) : (
                <form onSubmit={sendRoomMessage} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ask a question or explain a solution..."
                    value={newChatMessage}
                    onChange={(e) => setNewChatMessage(e.target.value)}
                    className="px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 flex-1"
                  />
                  <button
                    type="submit"
                    disabled={sendingChat || !newChatMessage.trim()}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl transition cursor-pointer disabled:opacity-50 shrink-0 shadow-xs"
                  >
                    {sendingChat ? "..." : "Send"}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* PARTICIPANTS PANEL */}
          <div className="bg-white border border-slate-200/90 rounded-3xl p-5 space-y-4 shadow-xs">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex justify-between items-center">
              <span>Participants ({activeRoom.participants.length}/{activeRoom.maxParticipants})</span>
              <span className="text-[10px] text-emerald-600 font-semibold">&bull; Active Room</span>
            </h4>

            <div className="space-y-2 max-h-[380px] overflow-y-auto">
              {activeRoom.participants.map((p: any) => (
                <div key={p.id} className="bg-slate-50 p-3 rounded-2xl border border-slate-200 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center font-bold text-blue-700 text-xs uppercase shrink-0">
                      {p.displayName ? p.displayName[0] : p.name ? p.name[0] : "U"}
                    </div>
                    <div className="overflow-hidden space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-slate-900 truncate">{p.displayName || p.name || "Examinee"}</p>
                        <RoomRoleBadge role={p.role} size="sm" showLabel={false} />
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-slate-500">
                        <span>{p.role === "HOST" ? "Host" : p.role === "MODERATOR" ? "Moderator" : "Member"}</span>
                        {p.isMuted && <span className="text-rose-600 font-semibold">• Muted</span>}
                        {p.canDraw === false && <span className="text-amber-600 font-semibold">• No Draw</span>}
                      </div>
                    </div>
                  </div>

                  {/* Actions Menu for Host and Moderators */}
                  <ParticipantActionsMenu
                    roomId={activeRoom.id}
                    currentUserRole={currentUserRole}
                    currentUserId={currentUserId}
                    participant={{
                      id: p.id,
                      userId: p.userId,
                      role: p.role,
                      name: p.displayName || p.name || "Examinee",
                      canDraw: p.canDraw,
                      canShare: p.canShare,
                      isMuted: p.isMuted,
                    }}
                    onActionComplete={refreshActiveRoom}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ROOM SETTINGS MODAL (HOST ONLY) */}
        {isHost && (
          <RoomSettingsModal
            isOpen={showSettingsModal}
            roomId={activeRoom.id}
            initialSettings={{
              name: activeRoom.name,
              description: activeRoom.description,
              topic: activeRoom.topic,
              isPublic: activeRoom.isPublic,
              allowMemberWhiteboard: activeRoom.allowMemberWhiteboard,
              allowMemberScreenShare: activeRoom.allowMemberScreenShare,
              allowMemberChat: activeRoom.allowMemberChat,
              isLocked: activeRoom.isLocked,
            }}
            onClose={() => setShowSettingsModal(false)}
            onSettingsSaved={refreshActiveRoom}
          />
        )}
      </div>
    );
  }

  // ROOM DIRECTORY VIEW
  return (
    <div className="space-y-6">
      {/* HEADER BAR & CONTROLS */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Active Study Rooms</h3>
          <p className="text-xs text-slate-500">Join virtual group review rooms or create your own session.</p>
        </div>

        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Invite Code (e.g., A8K2L9)"
            value={inviteCodeInput}
            onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 uppercase font-mono placeholder-slate-400 focus:outline-none focus:border-blue-500 w-36"
          />
          <button
            onClick={() => joinRoom(undefined, inviteCodeInput)}
            disabled={joiningCode || !inviteCodeInput.trim()}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-50"
          >
            Join
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs"
          >
            + Create Room
          </button>
        </div>
      </div>

      {/* FILTER TABS */}
      <div className="flex gap-2 border-b border-slate-100 pb-2">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            filter === "all" ? "bg-blue-50 text-blue-700 border border-blue-200 font-black" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          All Public Rooms
        </button>
        <button
          onClick={() => setFilter("mine")}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
            filter === "mine" ? "bg-blue-50 text-blue-700 border border-blue-200 font-black" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          My Active Rooms
        </button>
      </div>

      {/* ROOM DIRECTORY GRID */}
      {loading ? (
        <div className="bg-white border border-slate-200/90 rounded-3xl p-12 text-center text-slate-400 font-bold animate-pulse shadow-xs">
          Loading study room directory...
        </div>
      ) : rooms.length === 0 ? (
        <div className="bg-white border border-slate-200/90 rounded-3xl p-12 text-center space-y-3 shadow-xs">
          <span className="text-4xl block">🎧</span>
          <h4 className="text-sm font-bold text-slate-900">No Active Study Rooms Found</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
            Be the first to create a study room and invite classmates to review Civil Service Exam topics together.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {rooms.map((room) => (
            <div key={room.id} className="bg-white border border-slate-200/90 p-5 rounded-3xl space-y-4 hover:border-slate-300 shadow-xs transition">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-200">
                    {room.topic}
                  </span>
                  {room.isLocked && (
                    <span className="text-[10px] font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                      🔒 Locked
                    </span>
                  )}
                </div>
                <span className="text-xs font-bold text-slate-500">
                  👥 {room.participantCount}/{room.maxParticipants}
                </span>
              </div>

              <div>
                <h4 className="text-base font-bold text-slate-900 truncate">{room.name}</h4>
                <p className="text-xs text-slate-600 line-clamp-2 mt-1 min-h-[32px]">
                  {room.description || "Interactive group review room for Civil Service Exam preparation."}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-slate-500">
                  <span>👑</span>
                  <span className="truncate max-w-[100px]">{room.host?.name || "Host"}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {room.isHost && (
                    <button
                      onClick={() => setRoomToDelete({ id: room.id, name: room.name })}
                      className="px-2.5 py-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                      title="Permanently Delete Room"
                    >
                      Delete
                    </button>
                  )}

                  {room.isMember ? (
                    <button
                      onClick={() => openRoomView(room.id)}
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl transition cursor-pointer shadow-xs"
                    >
                      Enter Room &rarr;
                    </button>
                  ) : (
                    <button
                      onClick={() => joinRoom(room.id)}
                      disabled={room.isLocked}
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl transition cursor-pointer disabled:opacity-40 shadow-xs"
                    >
                      {room.isLocked ? "🔒 Locked" : "Join Room"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE ROOM MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md p-6 rounded-3xl bg-white border border-slate-200 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>🎧</span> Create Study Room
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-900 text-xs px-2 py-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={createRoom} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-700 font-bold block mb-1">Room Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Numerical Reasoning Sprint"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Description (Optional)</label>
                <textarea
                  placeholder="Briefly describe what you'll review together..."
                  value={roomDesc}
                  onChange={(e) => setRoomDesc(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 h-20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Topic</label>
                  <select
                    value={roomTopic}
                    onChange={(e) => setRoomTopic(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500"
                  >
                    <option value="General Review">General Review</option>
                    <option value="Numerical Reasoning">Numerical Reasoning</option>
                    <option value="Verbal Ability">Verbal Ability</option>
                    <option value="Analytical Reasoning">Analytical Reasoning</option>
                    <option value="Philippine Constitution">Philippine Constitution</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-700 font-bold block mb-1">Max Capacity</label>
                  <select
                    value={maxMembers}
                    onChange={(e) => setMaxMembers(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500"
                  >
                    <option value={5}>5 Participants</option>
                    <option value={10}>10 Participants</option>
                    <option value={20}>20 Participants</option>
                    <option value={30}>30 Participants</option>
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-0"
                  />
                  <span className="text-slate-700">Make room public (Listed in Study Together Hub)</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !roomName.trim()}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-xl transition cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  {creating ? "Creating..." : "Create Room"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE STUDY ROOM MODAL */}
      {roomToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-sm p-6 rounded-3xl bg-white border border-rose-200 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-rose-50 border border-rose-200 rounded-2xl text-xl">⚠️</span>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Delete Study Room?</h3>
                <p className="text-xs text-slate-500">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200">
              Are you sure you want to permanently delete <strong>{roomToDelete.name}</strong>?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRoomToDelete(null)}
                disabled={deletingRoom}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteRoom}
                disabled={deletingRoom}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {deletingRoom ? "Deleting..." : "Delete Room"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}