/** Hand-drawn stroke icon set — zero emojis. 24x24, stroke=currentColor. */

interface IconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

function Base({
  size = 20,
  className,
  style,
  children,
  filled,
}: IconProps & { children: React.ReactNode; filled?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      style={{ flexShrink: 0, verticalAlign: "-3px", ...style }}
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function IconLock(p: IconProps) {
  return (
    <Base {...p}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" />
      <circle cx="12" cy="15.5" r="1.4" fill="currentColor" stroke="none" />
    </Base>
  );
}

export function IconSprout(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M12 21v-8" />
      <path d="M12 13c0-4 3-7 8-7 0 4.5-3.5 7-8 7z" />
      <path d="M12 13c0-3-2.4-5.4-6-5.4 0 3.4 2.6 5.4 6 5.4z" />
    </Base>
  );
}

export function IconCheck(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M4.5 12.5l5 5 10-11" />
    </Base>
  );
}

export function IconClock(p: IconProps) {
  return (
    <Base {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3.2 2" />
    </Base>
  );
}

export function IconBranch(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M12 21V9" />
      <path d="M12 13c-3.5 0-5.5-2-6.5-5" />
      <path d="M12 10.5c3.5 0 5.5-2 6.5-5" />
      <circle cx="5.5" cy="8" r="1.6" />
      <circle cx="18.5" cy="5.5" r="1.6" />
    </Base>
  );
}

export function IconArrowRight(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M4 12h15" />
      <path d="M13.5 6l6 6-6 6" />
    </Base>
  );
}

export function IconSun(p: IconProps) {
  return (
    <Base {...p}>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.2 5.2l1.7 1.7M17.1 17.1l1.7 1.7M18.8 5.2l-1.7 1.7M6.9 17.1l-1.7 1.7" />
    </Base>
  );
}

export function IconMoon(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M20 14.5A8.2 8.2 0 0 1 9.5 4 8.2 8.2 0 1 0 20 14.5z" />
    </Base>
  );
}

export function IconAlert(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M12 3.5L22 20H2z" />
      <path d="M12 10v4.5" />
      <circle cx="12" cy="17.2" r="1.1" fill="currentColor" stroke="none" />
    </Base>
  );
}

export function IconX(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Base>
  );
}

export function IconShield(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M12 3l7.5 3v6c0 4.5-3.2 7.8-7.5 9-4.3-1.2-7.5-4.5-7.5-9V6z" />
      <path d="M8.8 12l2.4 2.4 4-4.4" />
    </Base>
  );
}

export function IconPlus(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M12 5v14M5 12h14" />
    </Base>
  );
}

export function IconTree(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M12 21v-7" />
      <path d="M12 14c-4 0-6.5-2.5-7-6.5C8 7 10 5 12 5s4 2 7 2.5c-.5 4-3 6.5-7 6.5z" />
      <path d="M9 21h6" />
    </Base>
  );
}

export function IconWallet(p: IconProps) {
  return (
    <Base {...p}>
      <path d="M3.5 7.5A2.5 2.5 0 0 1 6 5h12a2.5 2.5 0 0 1 2.5 2.5v9A2.5 2.5 0 0 1 18 19H6a2.5 2.5 0 0 1-2.5-2.5z" />
      <path d="M3.5 7.5V6.5A2.5 2.5 0 0 1 6 4h12" />
      <circle cx="16.5" cy="13.5" r="1.2" fill="currentColor" stroke="none" />
    </Base>
  );
}

/**
 * IconMango — the blue mango fruit mark. Fill via `color` style prop.
 * States: pending=unripe sage, done=vivid blue, disputed=bruised, released=golden, refunded=gray.
 */
export function IconMango({
  size = 20,
  className,
  style,
  cracked,
}: IconProps & { cracked?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      style={{ flexShrink: 0, verticalAlign: "-3px", ...style }}
      aria-hidden="true"
    >
      {/* fruit body */}
      <path
        d="M12 8.2c3.9 0 6.8 3 6.8 7 0 4.2-3.3 7-7.2 7-3.7 0-6.2-2.7-6-6.2.2-4 2.7-7.8 6.4-7.8z"
        fill="currentColor"
      />
      {/* stem */}
      <path
        d="M12 8.2c.1-2 .9-3.5 2.4-4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        opacity={0.8}
      />
      {/* leaf */}
      <path
        d="M14.6 4.4c1.9-.9 3.9-.8 5.4.2-1.3 1.5-3.3 2-5.4 1.3.1-.6.1-1 0-1.5z"
        fill="currentColor"
        opacity={0.75}
      />
      {/* sheen */}
      <ellipse cx="9.6" cy="13.4" rx="1.7" ry="2.6" fill="#ffffff" opacity={0.28} transform="rotate(-18 9.6 13.4)" />
      {cracked && (
        <path
          d="M10.5 11.5l1.6 2.2-1.2 1.8 1.8 2.4"
          fill="none"
          stroke="#2b1608"
          strokeWidth={1.3}
          strokeLinecap="round"
          opacity={0.85}
        />
      )}
    </svg>
  );
}

/** Mango fill colors per milestone state: 0 pending, 1 done, 2 disputed, 3 released, 4 refunded */
export const MANGO_STATE_COLORS: Record<number, string> = {
  0: "#8fa383", // unripe — sage green
  1: "#3f8cff", // done — vivid blue
  2: "#8f5e1c", // disputed — bruised bronze
  3: "#f0b429", // released — ripe gold
  4: "#78716c", // refunded — fallen gray
};
