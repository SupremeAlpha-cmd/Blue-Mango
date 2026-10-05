"use client";

import { STATE_COLORS, MILESTONE_STATES, fmtUsdg, type MilestoneView } from "@/lib/contract";

interface Props {
  milestones: MilestoneView[];
  total: bigint;
  compact?: boolean;
  onSelect?: (idx: number) => void;
  selected?: number | null;
}

/**
 * DealTree — the Blue-Mango signature visual. The deal is the trunk;
 * each milestone branches off it, colored by state.
 */
export default function DealTree({ milestones, total, compact, onSelect, selected }: Props) {
  const W = 420;
  const rowH = compact ? 74 : 96;
  const topPad = 118;
  const H = topPad + milestones.length * rowH + 30;
  const cx = W / 2;
  const trunkTop = 78;
  const trunkBottom = H - 24;

  const trunc = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Deal milestone tree">
        {/* trunk */}
        <line
          x1={cx}
          y1={trunkTop}
          x2={cx}
          y2={trunkBottom}
          style={{ stroke: "var(--trunk)" }}
          strokeWidth={compact ? 5 : 7}
          strokeLinecap="round"
          opacity={0.9}
        />
        {/* root node = deal total */}
        <g>
          <rect
            x={cx - 92}
            y={8}
            width={184}
            height={62}
            rx={16}
            style={{ fill: "var(--surface-2)", stroke: "var(--trunk)" }}
            strokeWidth={2.5}
          />
          <text x={cx} y={34} textAnchor="middle" style={{ fill: "var(--faint)" }} fontSize={11} fontWeight={700}>
            DEAL LOCKED
          </text>
          <text x={cx} y={58} textAnchor="middle" style={{ fill: "var(--text)" }} fontSize={17} fontWeight={800}>
            {fmtUsdg(total)} USDG
          </text>
        </g>

        {milestones.map((m, i) => {
          const side = i % 2 === 0 ? -1 : 1;
          const nx = cx + side * (compact ? 118 : 128);
          const y = topPad + i * rowH + rowH / 2;
          const color = STATE_COLORS[m.state] ?? "#64748b";
          const isSel = selected === i;
          const nw = compact ? 132 : 150;
          const nh = compact ? 52 : 60;

          return (
            <g
              key={i}
              onClick={() => onSelect?.(i)}
              style={{ cursor: onSelect ? "pointer" : "default" }}
            >
              {/* branch */}
              <path
                d={`M ${cx} ${y - 30} C ${cx} ${y - 8}, ${nx} ${y - 12}, ${nx} ${y - nh / 2}`}
                fill="none"
                stroke={color}
                strokeWidth={isSel ? 4.5 : 3}
                strokeLinecap="round"
                opacity={m.state === 4 ? 0.55 : 0.95}
                strokeDasharray={m.state === 0 ? "7 6" : m.state === 4 ? "5 5" : undefined}
              />
              {/* fruit node */}
              <rect
                x={nx - nw / 2}
                y={y - nh / 2}
                width={nw}
                height={nh}
                rx={14}
                style={{ fill: "var(--surface)" }}
                stroke={color}
                strokeWidth={isSel ? 3 : 2}
              />
              <circle cx={nx - nw / 2 + 16} cy={y - nh / 2 + 16} r={5} fill={color} />
              <text
                x={nx}
                y={y - 4}
                textAnchor="middle"
                style={{ fill: "var(--text)" }}
                fontSize={compact ? 12.5 : 13.5}
                fontWeight={800}
              >
                {fmtUsdg(m.amount)}
              </text>
              <text
                x={nx}
                y={y + 14}
                textAnchor="middle"
                style={{ fill: "var(--muted)" }}
                fontSize={11}
              >
                {trunc(m.description || `Milestone ${i + 1}`, compact ? 16 : 20)}
              </text>
              {!compact && (
                <text
                  x={nx}
                  y={y + 30}
                  textAnchor="middle"
                  fill={color}
                  fontSize={10}
                  fontWeight={700}
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
            <span className="dot" style={{ background: STATE_COLORS[i] }} />
            {s}
          </span>
        ))}
      </div>
    </div>
  );
}
