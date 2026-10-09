"use client";

import { useEffect, useId, useRef, useState } from "react";
import CSCAppointmentModal from "./CSCAppointmentModal";
import { CalendarIcon, CloseIcon, ExternalIcon, GovernmentIcon } from "./CSCIcons";
import { cscStyles } from "./cscStyles";
import type { OverlayProps } from "./cscTypes";

export default function CSCServicesSheet({
  isOpen,
  onClose,
}: OverlayProps) {
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const servicesDialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  const closeSheet = () => {
    setShowAppointmentModal(false);
    onClose();
  };

  useEffect(() => {
    const dialog = servicesDialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();

    return () => {
      if (dialog.open) dialog.close();
    };
  }, [isOpen]);

  return (
    <>
      <dialog
        ref={servicesDialogRef}
        aria-labelledby={titleId}
        onCancel={(event) => {
          event.preventDefault();
          if (!showAppointmentModal) closeSheet();
        }}
        onClick={(event) => {
          if (event.target !== event.currentTarget || showAppointmentModal) return;
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          ) {
            closeSheet();
          }
        }}
        className={`${cscStyles.dialog} fixed bottom-0 left-0 right-0 top-auto rounded-t-[28px] px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3 sm:px-5 md:bottom-5 md:left-1/2 md:right-auto md:w-[min(36rem,calc(100vw-2.5rem))] md:-translate-x-1/2 md:rounded-3xl xl:bottom-auto xl:top-1/2 xl:-translate-y-1/2 backdrop:bg-slate-950/45 backdrop:backdrop-blur-sm`}
      >
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-300 dark:bg-slate-700 xl:hidden" />

          <div className="flex items-start justify-between gap-4">
            <div>
              <h2
                id={titleId}
                className="text-lg font-black tracking-tight text-slate-950 dark:text-white"
              >
                CSC Services
              </h2>
              <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                Quick access to official CSC tools and resources.
              </p>
            </div>

            <button
              type="button"
              autoFocus
              onClick={closeSheet}
              className={cscStyles.closeButton}
              aria-label="Close CSC services"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="mt-4 space-y-2.5">
            <button
              type="button"
              onClick={() => setShowAppointmentModal(true)}
              className={`${cscStyles.serviceCard} hover:border-blue-300 focus-visible:ring-blue-500 dark:hover:border-blue-500/50`}
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                <CalendarIcon />
              </span>

              <span className="min-w-0 flex-1">
                <strong className="block text-sm text-slate-950 dark:text-white">
                  CSC Appointment Helper
                </strong>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                  Find the correct application portal for your region.
                </span>
              </span>

              <span className="text-lg text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-blue-600">
                ›
              </span>
            </button>

            <a
              href="https://erpo.csc.gov.ph"
              target="_blank"
              rel="noopener noreferrer"
              className={`${cscStyles.serviceCard} hover:border-amber-300 focus-visible:ring-amber-500 dark:hover:border-amber-500/50`}
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                <GovernmentIcon />
              </span>

              <span className="min-w-0 flex-1">
                <strong className="block text-sm text-slate-950 dark:text-white">
                  OCSERGS &amp; ONSA
                </strong>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                  Eligibility, exam services, and other CSC online systems.
                </span>
              </span>

              <span className="text-slate-400 transition group-hover:text-amber-700">
                <ExternalIcon />
              </span>
            </a>
          </div>
      </dialog>

      <CSCAppointmentModal
        isOpen={showAppointmentModal}
        onClose={() => setShowAppointmentModal(false)}
      />
    </>
  );
}
