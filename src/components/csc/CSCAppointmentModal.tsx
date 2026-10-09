"use client";

import { useEffect, useId, useRef } from "react";
import { CalendarIcon, CloseIcon, ExternalIcon, GlobeIcon, GovernmentIcon } from "./CSCIcons";
import { cscStyles } from "./cscStyles";
import type { OverlayProps } from "./cscTypes";

export default function CSCAppointmentModal({ isOpen, onClose }: OverlayProps) {
  const appointmentDialogRef = useRef<HTMLDialogElement>(null);
  const portalTitleId = useId();

  useEffect(() => {
    const dialog = appointmentDialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();

    return () => {
      if (dialog.open) dialog.close();
    };
  }, [isOpen]);

  return (
    <dialog
      ref={appointmentDialogRef}
      aria-labelledby={portalTitleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        ) {
          onClose();
        }
      }}
      className={`${cscStyles.dialog} fixed bottom-0 left-0 right-0 top-auto max-h-[90dvh] rounded-t-[28px] p-5 md:inset-0 md:m-auto md:h-fit md:max-w-xl md:rounded-3xl md:p-7 backdrop:bg-slate-950/65 backdrop:backdrop-blur-sm`}
    >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-700 md:hidden" />

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
              Official Government Portals
            </span>
            <h2 id={portalTitleId} className="mt-2 text-xl font-black tracking-tight text-slate-950 dark:text-white">
              Choose CSC Application Portal
            </h2>
            <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500 dark:text-slate-400">
              Different CSC Regional Offices designate different online systems for slot reservations. Select the portal applicable to your region.
            </p>
          </div>

          <button type="button" autoFocus onClick={onClose} className={`${cscStyles.closeButton} border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800`} aria-label="Close CSC application portal chooser">
            <CloseIcon />
          </button>
        </div>

        <div className="mt-5 space-y-2.5">
          <a href="https://ocseas.csc.gov.ph" target="_blank" rel="noopener noreferrer" className={`${cscStyles.portalCard} hover:border-blue-300 focus-visible:ring-blue-500 dark:hover:border-blue-500/50`}>
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300"><GlobeIcon /></span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <strong className="text-sm text-slate-950 dark:text-white">1. CSC OCSEAS Portal</strong>
                <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[9px] font-black uppercase text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">National System</span>
              </span>
              <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                Online Civil Service Examination Application System used by CSC Central and participating Regional Offices.
              </span>
            </span>
            <span className="shrink-0 text-blue-600 dark:text-blue-300"><ExternalIcon /></span>
          </a>

          <a href="https://services.csc.gov.ph" target="_blank" rel="noopener noreferrer" className={`${cscStyles.portalCard} hover:border-indigo-300 focus-visible:ring-indigo-500 dark:hover:border-indigo-500/50`}>
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300"><GovernmentIcon /></span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <strong className="text-sm text-slate-950 dark:text-white">2. CSC Online Services Portal</strong>
                <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[9px] font-black uppercase text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">Regional Appointments</span>
              </span>
              <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                Centralized CSC Online Services portal used by regional offices for slot reservation, filing, and exam services.
              </span>
            </span>
            <span className="shrink-0 text-indigo-600 dark:text-indigo-300"><ExternalIcon /></span>
          </a>

          <a href="https://appointment.csc.gov.ph" target="_blank" rel="noopener noreferrer" className={`${cscStyles.portalCard} hover:border-amber-300 focus-visible:ring-amber-500 dark:hover:border-amber-500/50`}>
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"><CalendarIcon /></span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <strong className="text-sm text-slate-950 dark:text-white">3. CSC ORAS Portal</strong>
                <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] font-black uppercase text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">Field Office Slots</span>
              </span>
              <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                Online Registration & Appointment System for specific field office in-person appearance bookings.
              </span>
            </span>
            <span className="shrink-0 text-amber-700 dark:text-amber-300"><ExternalIcon /></span>
          </a>
        </div>

        <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/70 p-3 text-[11px] font-medium leading-relaxed text-slate-600 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-slate-300">
          ðŸ’¡ <strong className="text-slate-800 dark:text-white">Regional Tip:</strong> Please verify with your specific CSC Regional Office advisory (e.g. NCR, RO3, RO4, RO7, RO11) to confirm whether your testing center requires OCSEAS, Services, or ORAS.
        </div>
    </dialog>
  );
}

