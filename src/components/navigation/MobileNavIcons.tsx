interface IconProps {
  readonly className?: string;
}

function iconClass(className?: string): string {
  return className || "h-5 w-5";
}

export function HomeIcon({ className }: IconProps = {}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={iconClass(className)} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m3 11 9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9Z" />
    </svg>
  );
}

export function PracticeIcon({ className }: IconProps = {}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={iconClass(className)} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 20V10m7 10V4m7 16v-7" />
      <path strokeLinecap="round" strokeWidth={2} d="M3 20h18" />
    </svg>
  );
}

export function LearningIcon({ className }: IconProps = {}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={iconClass(className)} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Zm16 0A2.5 2.5 0 0 0 17.5 3H13v16h4.5A2.5 2.5 0 0 1 20 21.5v-16Z" />
    </svg>
  );
}

export function CSCIcon({ className }: IconProps = {}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={iconClass(className)} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m3 9 9-5 9 5M5 10h14M6 10v7m4-7v7m4-7v7m4-7v7M4 20h16" />
    </svg>
  );
}

export function ProfileIcon({ className }: IconProps = {}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={iconClass(className)} aria-hidden="true">
      <circle cx="12" cy="8" r="4" strokeWidth={2} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

export function MistakesIcon({ className }: IconProps = {}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={iconClass(className)} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 4h12a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
      <path strokeLinecap="round" strokeWidth={2} d="m9 9 6 6m0-6-6 6" />
    </svg>
  );
}

export function BadgeIcon({ className }: IconProps = {}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={iconClass(className)} aria-hidden="true">
      <circle cx="12" cy="9" r="5" strokeWidth={2} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m9 13-2 8 5-3 5 3-2-8" />
    </svg>
  );
}

export function DrillIcon({ className }: IconProps = {}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={iconClass(className)} aria-hidden="true">
      <circle cx="12" cy="12" r="8" strokeWidth={2} />
      <circle cx="12" cy="12" r="3" strokeWidth={2} />
      <path strokeLinecap="round" strokeWidth={2} d="M12 2v3m10 7h-3M12 22v-3M2 12h3" />
    </svg>
  );
}

export function FlashcardIcon({ className }: IconProps = {}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={iconClass(className)} aria-hidden="true">
      <rect x="4" y="5" width="14" height="14" rx="2" strokeWidth={2} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5V3h12v14h-2" />
    </svg>
  );
}

export function CommunityIcon({ className }: IconProps = {}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={iconClass(className)} aria-hidden="true">
      <circle cx="9" cy="8" r="3" strokeWidth={2} />
      <circle cx="17" cy="9" r="2.5" strokeWidth={2} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 20a6 6 0 0 1 12 0m1-5a5 5 0 0 1 5 5" />
    </svg>
  );
}

export function GiftIcon({ className }: IconProps = {}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={iconClass(className)} aria-hidden="true">
      <rect x="3" y="8" width="18" height="4" rx="1" strokeWidth={2} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12v9h14v-9M12 8v13M12 8H8.5A2.5 2.5 0 1 1 11 5.5V8Zm0 0h3.5A2.5 2.5 0 1 0 13 5.5V8Z" />
    </svg>
  );
}

export function ShieldIcon({ className }: IconProps = {}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={iconClass(className)} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3 5 6v5c0 4.7 2.9 8.2 7 10 4.1-1.8 7-5.3 7-10V6l-7-3Z" />
    </svg>
  );
}

export function LogoutIcon({ className }: IconProps = {}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={iconClass(className)} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h5m4-4 4-4-4-4m4 4H9" />
    </svg>
  );
}

export function SyncIcon({ className }: IconProps = {}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={iconClass(className)} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7h-5V2m4.5 5A8 8 0 0 0 5 5m-1 12h5v5m-4.5-5A8 8 0 0 0 19 19" />
    </svg>
  );
}

export function SupportIcon({ className }: IconProps = {}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={iconClass(className)} aria-hidden="true">
      <circle cx="12" cy="12" r="9" strokeWidth={2} />
      <path strokeLinecap="round" strokeWidth={2} d="M9.7 9a2.5 2.5 0 1 1 4.4 1.6c-1.1 1.1-2.1 1.5-2.1 3M12 17h.01" />
    </svg>
  );
}
