interface IconProps {
  readonly className?: string;
}

export function TargetIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="8" strokeWidth={2} />
      <circle cx="12" cy="12" r="3" strokeWidth={2} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4V2m0 20v-2M4 12H2m20 0h-2" />
    </svg>
  );
}

export function FlameIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className} aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12.5 3.5c.4 3-1.5 4.2-3 6.1-1.2 1.5-1.8 2.9-1.4 4.5.4 1.8 1.7 3 3.9 3.4-1-1.2-1.1-2.4-.5-3.5.5-1 1.4-1.7 2.3-2.8.3 2.1 2.2 3.2 2.2 5.2 0 2.4-1.9 4.1-4.4 4.1-3.7 0-6.1-2.4-6.1-6 0-2.8 1.4-5 3.5-7 1.3-1.3 2.5-2.4 3.5-4Z"
      />
    </svg>
  );
}

export function ExamIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 3h8l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 3v5h5M9 13h6M9 17h4" />
    </svg>
  );
}

export function BookmarkIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v17l-6-4-6 4V4Z" />
    </svg>
  );
}

export function TrophyIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 4h8v4a4 4 0 1 1-8 0V4Zm4 8v5m-4 4h8M10 17h4" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6H4v1a5 5 0 0 0 5 5M16 6h4v1a5 5 0 0 1-5 5" />
    </svg>
  );
}
