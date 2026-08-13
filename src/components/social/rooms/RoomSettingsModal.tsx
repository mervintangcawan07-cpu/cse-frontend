// Relative Path: src/components/social/rooms/RoomSettingsModal.tsx
"use client";

import React, { useState, useEffect } from "react";

interface RoomSettingsModalProps {
  isOpen: boolean;
  roomId: string;
  initialSettings: {
    name: string;
    description?: string | null;
    topic: string;
    isPublic: boolean;
    allowMemberWhiteboard: boolean;
    allowMemberScreenShare: boolean;
    allowMemberChat: boolean;
    isLocked: boolean;
  };
  onClose: () => void;
  onSettingsSaved: () => void;
}

export const RoomSettingsModal: React.FC<RoomSettingsModalProps> = ({
  isOpen,
  roomId,
  initialSettings,
  onClose,
  onSettingsSaved,
}) => {
  const [name, setName] = useState(initialSettings.name || "");
  const [description, setDescription] = useState(initialSettings.description || "");
  const [topic, setTopic] = useState(initialSettings.topic || "General Review");
  const [isPublic, setIsPublic] = useState(initialSettings.isPublic ?? true);

  const [allowMemberWhiteboard, setAllowMemberWhiteboard] = useState(
    initialSettings.allowMemberWhiteboard ?? true
  );
  const [allowMemberScreenShare, setAllowMemberScreenShare] = useState(
    initialSettings.allowMemberScreenShare ?? true
  );
  const [allowMemberChat, setAllowMemberChat] = useState(
    initialSettings.allowMemberChat ?? true
  );
  const [isLocked, setIsLocked] = useState(initialSettings.isLocked ?? false);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    setName(initialSettings.name || "");
    setDescription(initialSettings.description || "");
    setTopic(initialSettings.topic || "General Review");
    setIsPublic(initialSettings.isPublic ?? true);
    setAllowMemberWhiteboard(initialSettings.allowMemberWhiteboard ?? true);
    setAllowMemberScreenShare(initialSettings.allowMemberScreenShare ?? true);
    setAllowMemberChat(initialSettings.allowMemberChat ?? true);
    setIsLocked(initialSettings.isLocked ?? false);
  }, [initialSettings, isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg("Room name cannot be empty.");
      return;
    }

    setSaving(true);
    setErrorMsg("");

    try {
      const res = await fetch(`/api/social/rooms/${roomId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          topic: topic.trim(),
          isPublic,
          allowMemberWhiteboard,
          allowMemberScreenShare,
          allowMemberChat,
          isLocked,
        }),
      });

      if (res.ok) {
        onSettingsSaved();
        onClose();
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error || "Failed to update room settings.");
      }
    } catch (err) {
      console.error("Failed to save room settings:", err);
      setErrorMsg("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-5 relative">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>👑</span> Study Room Permissions & Settings
            </h3>
            <p className="text-xs text-slate-400">
              Configure participant permissions and room-wide collaboration policies.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-sm px-2.5 py-1.5 rounded-xl hover:bg-slate-800 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs font-bold rounded-xl flex items-center gap-2">
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          {/* Room Policies */}
          <div className="space-y-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
            <span className="text-xs font-black text-white uppercase tracking-wider block">
              🛡️ Participant Access Policies
            </span>

            <div className="space-y-2 text-xs">
              <label className="flex items-center justify-between p-2.5 bg-slate-900 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700">
                <div>
                  <span className="text-slate-200 font-bold block">✏️ Allow Member Whiteboard Drawing</span>
                  <span className="text-[10px] text-slate-400">When disabled, only Host and Moderators can draw.</span>
                </div>
                <input
                  type="checkbox"
                  checked={allowMemberWhiteboard}
                  onChange={(e) => setAllowMemberWhiteboard(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-0 cursor-pointer w-4 h-4"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 bg-slate-900 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700">
                <div>
                  <span className="text-slate-200 font-bold block">🖥️ Allow Member Screen Sharing</span>
                  <span className="text-[10px] text-slate-400">When disabled, only Host and Moderators can present.</span>
                </div>
                <input
                  type="checkbox"
                  checked={allowMemberScreenShare}
                  onChange={(e) => setAllowMemberScreenShare(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-0 cursor-pointer w-4 h-4"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 bg-slate-900 border border-slate-800 rounded-xl cursor-pointer hover:border-slate-700">
                <div>
                  <span className="text-slate-200 font-bold block">💬 Allow Member Text Chat</span>
                  <span className="text-[10px] text-slate-400">When disabled, chat is locked to Host and Moderators.</span>
                </div>
                <input
                  type="checkbox"
                  checked={allowMemberChat}
                  onChange={(e) => setAllowMemberChat(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-0 cursor-pointer w-4 h-4"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 bg-slate-900 border border-amber-500/30 rounded-xl cursor-pointer hover:border-amber-500/50">
                <div>
                  <span className="text-amber-300 font-bold block">🔒 Lock Room from New Participants</span>
                  <span className="text-[10px] text-slate-400">Prevents new examinees from entering the room.</span>
                </div>
                <input
                  type="checkbox"
                  checked={isLocked}
                  onChange={(e) => setIsLocked(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-0 cursor-pointer w-4 h-4"
                />
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-xs font-bold text-slate-300 hover:bg-slate-800 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-blue-600/20 transition cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? "Saving..." : "Save Policies"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
