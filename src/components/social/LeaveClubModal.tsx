// Relative Path: src/components/social/LeaveClubModal.tsx
"use client";

import React from "react";

interface LeaveClubModalProps {
  isOpen: boolean;
  clubName: string;
  isLeaving?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const LeaveClubModal: React.FC<LeaveClubModalProps> = ({
  isOpen,
  clubName,
  isLeaving = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xl font-bold flex-shrink-0">
            🚪
          </div>
          <div>
            <h3 className="text-base font-black text-white">
              Leave Study Club?
            </h3>
            <p className="text-xs font-semibold text-slate-400 mt-1">
              Are you sure you want to leave <span className="text-white font-bold">&quot;{clubName}&quot;</span>?
            </p>
          </div>
        </div>

        {/* Details */}
        <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 text-[11px] font-medium text-slate-300 leading-relaxed space-y-1">
          <p className="text-slate-400">
            You will stop receiving group discussions, announcements, and study session invitations for this club. You can rejoin at any time if the club is public.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLeaving}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
          >
            Stay in Club
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLeaving}
            className="px-5 py-2.5 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30 transition cursor-pointer disabled:opacity-50 flex items-center gap-2"
          >
            {isLeaving ? (
              <>
                <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>Leaving Club...</span>
              </>
            ) : (
              "Leave Club"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
