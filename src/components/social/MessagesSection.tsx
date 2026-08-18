// Relative Path: src/components/social/MessagesSection.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { DeleteConversationModal } from "@/components/social/DeleteConversationModal";

export default function MessagesSection() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [classmates, setClassmates] = useState<any[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [activeConversation, setActiveConversation] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [convToDelete, setConvToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deletingConv, setDeletingConv] = useState(false);
  
  const [loadingConv, setLoadingConv] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  
  const [newMessage, setNewMessage] = useState("");
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const quickEmojis = ["😊", "👍", "🎉", "💯", "📚", "✍️", "🤔", "👏", "🔥", "❤️"];

  // Fetch current user ID and conversations list
  const loadConversations = async () => {
    try {
      const meRes = await fetch("/api/auth/me");
      if (meRes.ok) {
        const meData = await meRes.json();
        setCurrentUserId(meData.user?.id || null);
      }

      const res = await fetch("/api/social/messages/conversations");
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations || []);
      }

      // Also load connected classmates to allow starting new chats
      const classmatesRes = await fetch("/api/social/classmates");
      if (classmatesRes.ok) {
        const classmatesData = await classmatesRes.json();
        setClassmates(classmatesData.classmates || []);
      }
    } catch (err) {
      console.error("Failed to load conversations:", err);
    } finally {
      setLoadingConv(false);
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  // Poll active chat messages every 4 seconds
  useEffect(() => {
    if (!activeConvId) return;

    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/social/messages/${activeConvId}`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || []);
          setActiveConversation(data.otherUser || null);
        }
      } catch (err) {
        console.error("Failed to load chat messages:", err);
      } finally {
        setLoadingChat(false);
      }
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 4000);
    return () => clearInterval(interval);
  }, [activeConvId]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const selectConversation = (convId: string) => {
    setActiveConvId(convId);
    setLoadingChat(true);
    setReplyingTo(null);
  };

  const startNewChat = async (targetUserId: string) => {
    try {
      const res = await fetch("/api/social/messages/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId }),
      });
      if (res.ok) {
        const data = await res.json();
        await loadConversations();
        selectConversation(data.conversationId);
      }
    } catch (err) {
      console.error("Failed to start conversation:", err);
    }
  };

  const sendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || !activeConvId || sending) return;

    setSending(true);
    try {
      const res = await fetch(`/api/social/messages/${activeConvId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newMessage,
          replyToId: replyingTo ? replyingTo.id : undefined,
        }),
      });

      if (res.ok) {
        setNewMessage("");
        setReplyingTo(null);
        const data = await res.json();
        setMessages((prev) => [...prev, data.message]);
        await loadConversations();
      }
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setSending(false);
    }
  };

  const deleteMessage = async (messageId: string) => {
    if (!activeConvId) return;
    try {
      const res = await fetch(`/api/social/messages/${activeConvId}?messageId=${messageId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
        await loadConversations();
      }
    } catch (err) {
      console.error("Failed to delete message:", err);
    }
  };

  const confirmDeleteConversation = async () => {
    if (!convToDelete?.id || deletingConv) return;

    setDeletingConv(true);
    try {
      const res = await fetch(`/api/social/messages/${convToDelete.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        if (activeConvId === convToDelete.id) {
          setActiveConvId(null);
          setActiveConversation(null);
          setMessages([]);
        }
        setConvToDelete(null);
        await loadConversations();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to delete conversation");
      }
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    } finally {
      setDeletingConv(false);
    }
  };

  const addEmoji = (emoji: string) => {
    setNewMessage((prev) => prev + emoji);
  };

  if (loadingConv) {
    return (
      <div className="bg-white border border-slate-200/90 rounded-3xl p-12 text-center text-slate-500 font-bold animate-pulse shadow-xs">
        Loading private messaging hub...
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 min-h-[520px]">
      {/* CONVERSATION SIDEBAR */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 flex flex-col justify-between space-y-4 shadow-xs">
        <div>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
            Conversations ({conversations.length})
          </h3>

          <div className="space-y-1.5 overflow-y-auto max-h-[380px] pr-1">
            {conversations.map((c) => {
              const isActive = activeConvId === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => selectConversation(c.id)}
                  className={`w-full p-3 rounded-xl transition text-left flex items-center justify-between gap-3 cursor-pointer group ${
                    isActive
                      ? "bg-blue-50 border border-blue-200 text-blue-900 font-bold"
                      : "bg-slate-50 hover:bg-slate-100/90 border border-slate-200/70 text-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-2.5 overflow-hidden flex-1">
                    <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center font-bold text-blue-700 text-xs uppercase shrink-0">
                      {c.otherUser?.name ? c.otherUser.name[0] : "C"}
                    </div>
                    <div className="overflow-hidden flex-1">
                      <p className="text-xs font-bold text-slate-900 truncate">{c.otherUser?.name || "Classmate"}</p>
                      <p className="text-[10px] text-slate-500 truncate">
                        {c.lastMessage ? c.lastMessage.content : "Start chatting..."}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {c.unreadCount > 0 && (
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center shrink-0">
                        {c.unreadCount}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConvToDelete({ id: c.id, name: c.otherUser?.name || "Classmate" });
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer text-xs"
                      title="Delete Conversation"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CONNECTED CLASSMATES DIRECT LAUNCH */}
        {classmates.length > 0 && (
          <div className="pt-3 border-t border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Start Chat with Classmate
            </span>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {classmates.map((c) => (
                <button
                  key={c.user.id}
                  onClick={() => startNewChat(c.user.id)}
                  className="p-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex items-center gap-1.5 transition text-xs text-slate-700 shrink-0 cursor-pointer"
                >
                  <span className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-700">
                    {c.user.name ? c.user.name[0] : "U"}
                  </span>
                  <span className="truncate max-w-[80px]">{c.user.name || "User"}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ACTIVE CHAT AREA */}
      <div className="md:col-span-2 bg-white border border-slate-200/90 rounded-2xl flex flex-col justify-between overflow-hidden shadow-xs">
        {activeConvId && activeConversation ? (
          <>
            {/* CHAT HEADER */}
            <div className="p-4 bg-slate-50/90 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center font-bold text-blue-700 text-xs uppercase">
                  {activeConversation.name ? activeConversation.name[0] : "C"}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">{activeConversation.name}</h4>
                  <span className="text-[10px] text-emerald-600 block font-semibold">● Online Classmate</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setConvToDelete({
                      id: activeConvId,
                      name: activeConversation.name || "Classmate",
                    })
                  }
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1"
                  title="Delete Conversation"
                >
                  <span>🗑️</span>
                  <span>Delete Chat</span>
                </button>
                <button
                  onClick={() => setActiveConvId(null)}
                  className="text-xs text-slate-500 hover:text-slate-900 px-2.5 py-1.5 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                >
                  ✕ Close
                </button>
              </div>
            </div>

            {/* MESSAGES FEED */}
            <div className="p-4 flex-1 overflow-y-auto max-h-[360px] space-y-3">
              {loadingChat ? (
                <div className="text-center py-12 text-xs text-slate-400 font-bold animate-pulse">
                  Loading conversation history...
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12 text-slate-500 space-y-2">
                  <span className="text-3xl block">👋</span>
                  <p className="text-xs font-bold text-slate-700">No messages yet</p>
                  <p className="text-[10px] text-slate-500">Send a greeting to start reviewing together!</p>
                </div>
              ) : (
                messages.map((m) => {
                  const isMine = m.senderId === currentUserId;
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isMine ? "items-end" : "items-start"} group space-y-1`}
                    >
                      {m.replyTo && (
                        <div className="text-[10px] bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 max-w-xs truncate">
                          ↩ Reply to: {m.replyTo.content}
                        </div>
                      )}

                      <div className="flex items-center gap-2 max-w-[80%]">
                        {isMine && (
                          <button
                            onClick={() => deleteMessage(m.id)}
                            className="opacity-0 group-hover:opacity-100 text-[10px] text-slate-400 hover:text-rose-600 transition cursor-pointer"
                            title="Delete message"
                          >
                            🗑️
                          </button>
                        )}

                        <div
                          onClick={() => setReplyingTo(m)}
                          className={`p-3 rounded-2xl text-xs leading-relaxed cursor-pointer transition ${
                            isMine
                              ? "bg-blue-600 text-white rounded-br-none shadow-xs"
                              : "bg-slate-100 text-slate-900 rounded-bl-none border border-slate-200/80"
                          }`}
                        >
                          <p>{m.content}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-[9px] text-slate-400 px-1">
                        <span>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {isMine && (
                          <span className={m.state === "READ" ? "text-emerald-600 font-bold" : "text-slate-400"}>
                            {m.state === "READ" ? "✓✓ Read" : m.state === "DELIVERED" ? "✓✓ Delivered" : "✓ Sent"}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* REPLY BANNER */}
            {replyingTo && (
              <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-700">
                <span className="truncate">Replying to: <i>"{replyingTo.content}"</i></span>
                <button
                  onClick={() => setReplyingTo(null)}
                  className="text-slate-400 hover:text-slate-900 ml-2 text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* EMOJI BAR & INPUT AREA */}
            <div className="p-3 bg-slate-50/90 border-t border-slate-200 space-y-2">
              <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
                {quickEmojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => addEmoji(emoji)}
                    className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200/80 rounded-lg text-xs transition cursor-pointer shrink-0"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              <form onSubmit={sendMessage} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type a message or explanation..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 flex-1"
                />
                <button
                  type="submit"
                  disabled={sending || !newMessage.trim()}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl transition cursor-pointer disabled:opacity-50 shrink-0 shadow-xs"
                >
                  {sending ? "Sending..." : "Send"}
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
            <span className="text-4xl block">💬</span>
            <h4 className="text-sm font-bold text-slate-900">Select a Conversation</h4>
            <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
              Choose a connected classmate from the sidebar to discuss Civil Service exam questions and review notes.
            </p>
          </div>
        )}
      </div>
      {/* DELETE CONVERSATION CONFIRMATION MODAL */}
      <DeleteConversationModal
        isOpen={!!convToDelete}
        classmateName={convToDelete?.name || ""}
        isDeleting={deletingConv}
        onConfirm={confirmDeleteConversation}
        onCancel={() => setConvToDelete(null)}
      />
    </div>
  );
}