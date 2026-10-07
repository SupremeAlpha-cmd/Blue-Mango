"use client";

import { MILESTONE_STATES, fmtToken, type MilestoneView } from "@/lib/program";
import { IconMango, MANGO_STATE_COLORS } from "@/components/icons";

interface Props {
  milestones: MilestoneView[];
  total: bigint;
  compact?: boolean;
  onSelect?: (idx: number) => void;
  selected?: number | null;
  symbol?: string;
  decimals?: number;
}

/**
 * DealTree — the Blue-Mango signature visual.
 * A wooden tree: bark trunk, opaque wooden branches, and each milestone
 * hangs as a blue mango. The mango's ripeness shows the milestone state:
 * unripe sage = pending, vivid blue = done, bruised = disputed,
 * ripe gold = released, fallen gray = refunded.
 */
export default function DealTree({ milestones, total, compact, onSelect, selected, symbol = "", decimals = 6 }: Props) {
  const W = 440;
  const rowH = compact ? 92 : 118;
  const topPad = 132;
  const H = topPad + milestones.length * rowH + 44;
  const cx = W / 2;
  const trunkTop = 104;
  const trunkBottom = H - 26;
  const trunkW = compact ? 20 : 26;

  const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

  const gid = `bark-${compact ? "c" : "f"}-${milestones.length}`;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Deal milestone tree">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" style={{ stopColor: "var(--bark-2)" }} />
            <stop offset="0.45" style={{ stopColor: "var(--bark-1)" }} />
            <stop offset="1" style={{ stopColor: "var(--bark-2)" }} />
          </linearGradient>
        </defs>

        {/* hanging plaque: deal total */}
        <g>
          <line x1={cx - 56} y1={6} x2={cx - 56} y2={30} style={{ stroke: "var(--bark-line)" }} strokeWidth={2.5} />
          <line x1={cx + 56} y1={6} x2={cx + 56} y2={30} style={{ stroke: "var(--bark-line)" }} strokeWidth={2.5} />
          <rect
            x={cx - 96}
            y={28}
            width={192}
            height={64}
            rx={12}
            style={{ fill: "var(--surface-2)", stroke: "var(--bark-2)" }}
            strokeWidth={2.5}
          />
          <circle cx={cx - 84} cy={40} r={2.5} style={{ fill: "var(--bark-line)" }} />
          <circle cx={cx + 84} cy={40} r={2.5} style={{ fill: "var(--bark-line)" }} />
          <text x={cx} y={54} textAnchor="middle" style={{ fill: "var(--faint)" }} fontSize={10.5} fontWeight={700} letterSpacing={1.5}>
            DEAL LOCKED
          </text>
          <text x={cx} y={78} textAnchor="middle" style={{ fill: "var(--text)" }} fontSize={18} fontWeight={800} fontFamily="var(--serif)">
            {fmtToken(total, decimals)}{symbol ? ` ${symbol}` : ""}
          </text>
        </g>

        {/* trunk */}
        <rect
          x={cx - trunkW / 2}
          y={trunkTop}
          width={trunkW}
          height={trunkBottom - trunkTop}
          rx={trunkW / 2}
          fill={`url(#${gid})`}
        />
        {/* bark grooves */}
        <path
          d={`M ${cx - 5} ${trunkTop + 12} C ${cx - 8} ${trunkTop + 60}, ${cx - 3} ${trunkTop + 120}, ${cx - 6} ${trunkBottom - 14}`}
          fill="none"
          style={{ stroke: "var(--bark-line)" }}
          strokeWidth={2}
          opacity={0.65}
          strokeLinecap="round"
        />
        <path
          d={`M ${cx + 6} ${trunkTop + 20} C ${cx + 9} ${trunkTop + 80}, ${cx + 4} ${trunkTop + 140}, ${cx + 7} ${trunkBottom - 20}`}
          fill="none"
          style={{ stroke: "var(--bark-line)" }}
          strokeWidth={2}
          opacity={0.5}
          strokeLinecap="round"
        />
        {/* roots */}
        <path
          d={`M ${cx - 4} ${trunkBottom - 6} C ${cx - 22} ${trunkBottom + 2}, ${cx - 34} ${trunkBottom + 8}, ${cx - 44} ${trunkBottom + 10}`}
          fill="none"
          style={{ stroke: "var(--bark-2)" }}
          strokeWidth={7}
          strokeLinecap="round"
        />
        <path
          d={`M ${cx + 4} ${trunkBottom - 6} C ${cx + 22} ${trunkBottom + 2}, ${cx + 34} ${trunkBottom + 8}, ${cx + 44} ${trunkBottom + 10}`}
          fill="none"
          style={{ stroke: "var(--bark-2)" }}
          strokeWidth={7}
          strokeLinecap="round"
        />

        {milestones.map((m, i) => {
          const side = i % 2 === 0 ? -1 : 1;
          const y = topPad + i * rowH + 26;
          const nx = cx + side * (compact ? 128 : 142);
          const ay = y - 26; // mango anchor
          const mangoColor = MANGO_STATE_COLORS[m.state] ?? "#78716c";
          const isSel = selected === i;
          const tilt = m.state === 4 ? side * 24 : 0; // fallen mangoes tilt
          const dim = m.state === 4 ? 0.75 : 1;
          const s = compact ? 0.82 : 1; // mango scale

          return (
            <g
              key={i}
              onClick={() => onSelect?.(i)}
              style={{ cursor: onSelect ? "pointer" : "default" }}
              opacity={dim}
            >
              {/* opaque wooden branch */}
              <path
                d={`M ${cx + side * (trunkW / 2 - 2)} ${y} C ${cx + side * 52} ${y - 4}, ${nx - side * 44} ${ay + 8}, ${nx} ${ay + 2}`}
                fill="none"
                style={{ stroke: "var(--bark-1)" }}
                strokeWidth={compact ? 7 : 9}
                strokeLinecap="round"
              />
              <path
                d={`M ${cx + side * (trunkW / 2 - 2)} ${y - 2} C ${cx + side * 52} ${y - 6}, ${nx - side * 44} ${ay + 6}, ${nx} ${ay}`}
                fill="none"
                style={{ stroke: "var(--bark-line)" }}
                strokeWidth={1.6}
                opacity={0.5}
                strokeLinecap="round"
              />
              {/* stem tying mango to branch */}
              <line
                x1={nx}
                y1={ay + 2}
                x2={nx}
                y2={ay + 12}
                style={{ stroke: "var(--bark-line)" }}
                strokeWidth={2.4}
                strokeLinecap="round"
              />
              {/* the mango */}
              <g transform={`translate(${nx} ${ay + 14}) rotate(${tilt}) scale(${s})`}>
                {isSel && (
                  <circle r={30} fill="none" style={{ stroke: "var(--fruit)" }} strokeWidth={2.5} strokeDasharray="6 5" opacity={0.9} />
                )}
                <path
                  d="M0,-13 C8,-13 14,-6 13,3 C12,12 6,17 -2,16 C-9,15 -13,9 -12,1 C-11,-7 -6,-13 0,-13 Z"
                  fill={mangoColor}
                />
                <path
                  d="M1,-13 C1.2,-15.5 2,-17.5 3.6,-19"
                  fill="none"
                  stroke={mangoColor}
                  strokeWidth={2.6}
                  strokeLinecap="round"
                  opacity={0.9}
                />
                <path
                  d="M4.4,-18.6 C7,-19.8 10,-19.6 12.2,-18.2 C10.4,-16.4 7.4,-16 4.6,-17.2 C4.5,-17.7 4.4,-18.1 4.4,-18.6 Z"
                  fill={mangoColor}
                  opacity={0.7}
                />
                <ellipse cx={-4.5} cy={-1} rx={3} ry={4.6} fill="#ffffff" opacity={0.3} transform="rotate(-16 -4.5 -1)" />
                {m.state === 2 && (
                  <path
                    d="M-1.5,-5 L1,0 L-1,4 L2,9"
                    fill="none"
                    stroke="#2b1608"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    opacity={0.9}
                  />
                )}
              </g>
              {/* labels */}
              <text
                x={nx}
                y={ay + 52 * s}
                textAnchor="middle"
                style={{ fill: "var(--text)" }}
                fontSize={compact ? 13 : 14}
                fontWeight={800}
              >
                {fmtToken(m.amount, decimals)}
              </text>
              <text
                x={nx}
                y={ay + 52 * s + 16}
                textAnchor="middle"
                style={{ fill: "var(--muted)" }}
                fontSize={11}
              >
                {trunc(m.description || `Milestone ${i + 1}`, compact ? 16 : 20)}
              </text>
              {!compact && (
                <text
                  x={nx}
                  y={ay + 52 * s + 32}
                  textAnchor="middle"
                  fill={mangoColor}
                  fontSize={10}
                  fontWeight={700}
                  style={{ letterSpacing: 1 }}
                >
                  {MILESTONE_STATES[m.state]?.toUpperCase()}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className="tree-legend">
        {MILESTONE_STATES.map((s, i) => (
          <span key={s}>
            <IconMango size={17} style={{ color: MANGO_STATE_COLORS[i] }} cracked={i === 2} />
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
