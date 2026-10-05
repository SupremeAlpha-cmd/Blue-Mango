"use client";

/**
 * HeroTree — the Blue-Mango landing hero visual.
 * A wooden tree with opaque branches and ripe blue mangoes hanging.
 * Bark colors come from CSS vars so it transforms with the theme.
 */
export default function HeroTree() {
  const mangoes: { x: number; y: number; s: number; flip?: boolean }[] = [
    { x: 118, y: 148, s: 1.15 },
    { x: 196, y: 118, s: 0.95, flip: true },
    { x: 268, y: 156, s: 1.2 },
    { x: 84, y: 208, s: 0.9 },
    { x: 232, y: 216, s: 1.05, flip: true },
    { x: 158, y: 248, s: 0.85 },
    { x: 300, y: 226, s: 0.9 },
  ];

  return (
    <svg viewBox="0 0 380 460" className="hero-tree" role="img" aria-label="Wooden tree with blue mangoes">
      <defs>
        <linearGradient id="hero-bark" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" style={{ stopColor: "var(--bark-2)" }} />
          <stop offset="0.5" style={{ stopColor: "var(--bark-1)" }} />
          <stop offset="1" style={{ stopColor: "var(--bark-2)" }} />
        </linearGradient>
        <radialGradient id="mango-shade" cx="0.38" cy="0.32" r="0.9">
          <stop offset="0" stopColor="#7db4ff" />
          <stop offset="0.55" stopColor="#3f8cff" />
          <stop offset="1" stopColor="#2456c4" />
        </radialGradient>
      </defs>

      {/* ground */}
      <ellipse cx={190} cy={428} rx={150} ry={20} style={{ fill: "var(--bark-line)" }} opacity={0.35} />

      {/* trunk */}
      <path
        d="M168,428 C164,340 166,260 158,196 C154,162 148,140 138,122 L182,112 C188,140 192,168 194,200 C198,270 200,350 206,428 Z"
        fill="url(#hero-bark)"
      />
      {/* bark grooves */}
      <path d="M176,400 C172,330 174,260 168,200" fill="none" style={{ stroke: "var(--bark-line)" }} strokeWidth={3} opacity={0.6} strokeLinecap="round" />
      <path d="M190,410 C188,340 190,270 186,210" fill="none" style={{ stroke: "var(--bark-line)" }} strokeWidth={2.4} opacity={0.45} strokeLinecap="round" />
      {/* roots */}
      <path d="M170,420 C150,428 132,432 112,434" fill="none" style={{ stroke: "var(--bark-2)" }} strokeWidth={12} strokeLinecap="round" />
      <path d="M200,420 C222,428 242,432 262,434" fill="none" style={{ stroke: "var(--bark-2)" }} strokeWidth={12} strokeLinecap="round" />

      {/* opaque branches */}
      <g fill="none" strokeLinecap="round">
        <path d="M160,220 C120,200 96,180 78,150" style={{ stroke: "var(--bark-1)" }} strokeWidth={15} />
        <path d="M170,170 C200,150 220,140 244,128" style={{ stroke: "var(--bark-1)" }} strokeWidth={13} />
        <path d="M186,250 C220,240 250,232 282,226" style={{ stroke: "var(--bark-1)" }} strokeWidth={14} />
        <path d="M162,270 C130,262 104,254 84,240" style={{ stroke: "var(--bark-1)" }} strokeWidth={12} />
        <path d="M178,140 C190,118 196,104 198,88" style={{ stroke: "var(--bark-1)" }} strokeWidth={11} />
        {/* branch highlight lines */}
        <path d="M160,216 C122,197 100,179 84,152" style={{ stroke: "var(--bark-line)" }} strokeWidth={2.5} opacity={0.5} />
        <path d="M188,246 C220,237 248,230 276,224" style={{ stroke: "var(--bark-line)" }} strokeWidth={2.5} opacity={0.5} />
      </g>

      {/* hanging blue mangoes */}
      {mangoes.map((mg, i) => (
        <g key={i} transform={`translate(${mg.x} ${mg.y}) scale(${mg.flip ? -mg.s : mg.s} ${mg.s})`}>
          <line x1={0} y1={-34} x2={0} y2={-16} style={{ stroke: "var(--bark-line)" }} strokeWidth={3} strokeLinecap="round" />
          <path
            d="M0,-15 C9,-15 16,-7 15,4 C14,14 7,20 -2,19 C-10,18 -15,11 -14,1 C-13,-8 -7,-15 0,-15 Z"
            fill="url(#mango-shade)"
          />
          <path d="M1,-15 C1.2,-18 2.4,-20.6 4.6,-22.4" fill="none" stroke="#2456c4" strokeWidth={3} strokeLinecap="round" />
          <path
            d="M5.4,-21.8 C8.6,-23.4 12.4,-23.2 15.2,-21.4 C13,-19.2 9.4,-18.8 5.8,-20.2 C5.6,-20.8 5.5,-21.3 5.4,-21.8 Z"
            fill="#4d8f4d"
            opacity={0.9}
          />
          <ellipse cx={-5} cy={-2} rx={3.6} ry={5.4} fill="#ffffff" opacity={0.32} transform="rotate(-16 -5 -2)" />
        </g>
      ))}

      {/* drifting leaves */}
      <g fill="#4d8f4d" opacity={0.55}>
        <ellipse cx={250} cy={300} rx={9} ry={4.5} transform="rotate(28 250 300)" />
        <ellipse cx={110} cy={320} rx={8} ry={4} transform="rotate(-24 110 320)" />
        <ellipse cx={300} cy={330} rx={7} ry={3.6} transform="rotate(14 300 330)" />
      </g>
    </svg>
  );
}
