"use client";

import React from "react";

interface DeleteConversationModalProps {
  isOpen: boolean;
  classmateName: string;
  isDeleting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteConversationModal: React.FC<DeleteConversationModalProps> = ({
  isOpen,
  classmateName,
  isDeleting = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4">
        {/* Warning Header */}
        <div className="flex items-start gap-3">
          <div className="p-3 rounded-2xl bg-rose-950/60 text-rose-400 border border-rose-500/20 text-xl font-bold flex-shrink-0">
            🗑️
          </div>
          <div>
            <h3 className="text-base font-black text-white">
              Delete Conversation?
            </h3>
            <p className="text-xs font-semibold text-slate-400 mt-1">
              Are you sure you want to delete your conversation with{" "}
              <span className="text-white font-bold">&quot;{classmateName || "Classmate"}&quot;</span>?
            </p>
          </div>
        </div>

        {/* Warning Details */}
        <div className="p-3.5 rounded-2xl bg-rose-950/30 border border-rose-900/40 text-[11px] font-medium text-rose-300 leading-relaxed space-y-1">
          <p className="font-bold flex items-center gap-1">
            ⚠️ Permanent Action (Both Participants)
          </p>
          <p className="text-rose-400/90">
            All messages, shared solutions, and chat history in this conversation will be permanently deleted for both participants.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-5 py-2.5 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 transition cursor-pointer disabled:opacity-50 flex items-center gap-2"
          >
            {isDeleting ? (
              <>
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>Deleting Conversation...</span>
              </>
            ) : (
              "Delete Conversation"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
