/**
 * Small "verified" check badge — blue circle with a white checkmark.
 * Used wherever a verified user's avatar shows up (chat dock, sidebar,
 * chat panel header, future profile pages). Inline SVG so it scales
 * cleanly via CSS without an extra HTTP round-trip.
 *
 * Render position is the caller's responsibility (absolute on top of
 * the avatar, or inline next to the name). Just give it a size.
 */
interface Props {
  /** Outer diameter in pixels. Defaults to 14 — fits a 44px avatar. */
  size?: number;
  className?: string;
  /** Accessible label. Defaults to "Verificado". */
  label?: string;
}

export default function VerifiedBadge({
  size = 14,
  className,
  label = 'Verificado',
}: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      role="img"
      aria-label={label}
    >
      <title>{label}</title>
      <path
        d="M12 1.5l2.5 2 3.2.2 1 3 2.3 2.2-.8 3.1.8 3.1-2.3 2.2-1 3-3.2.2-2.5 2-2.5-2-3.2-.2-1-3L3 14.1l.8-3.1L3 7.9l2.3-2.2 1-3 3.2-.2 2.5-2z"
        fill="#1d9bf0"
      />
      <path
        d="M9.5 12.6l1.9 1.9 4.1-4.5"
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
