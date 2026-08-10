"use client";

import React from "react";

interface DeleteEventModalProps {
  isOpen: boolean;
  eventTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteEventModal: React.FC<DeleteEventModalProps> = ({
  isOpen,
  eventTitle,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
        {/* Warning Icon & Title */}
        <div className="flex items-start gap-3">
          <div className="p-3 rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-950/80 dark:text-rose-400 text-xl font-bold flex-shrink-0">
            ???
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              Delete Scheduled Event?
            </h3>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
              Are you sure you want to delete <span className="text-slate-800 dark:text-slate-200 font-bold">"{eventTitle}"</span>?
            </p>
          </div>
        </div>

        {/* Warning Note */}
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 text-[11px] font-medium text-rose-800 dark:text-rose-300 leading-relaxed">
          ?? This action is permanent and will remove the session from all enrolled examinees.
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-5 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/30 transition-all"
          >
            Delete Event
          </button>
        </div>
      </div>
    </div>
  );
};
