// Wireframe globe that slowly spins. Each longitude line is an ellipse whose
// width swings between full and zero, which reads as rotation. Uses SVG's own
// animation (no JavaScript), so it works everywhere.

const R = 40;
const SPIN_SECONDS = 24;
const MERIDIANS = 6;
const LATITUDES = [-60, -30, 0, 30, 60];

export default function Globe({ size = 88, className = "" }: { size?: number; className?: string }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="-50 -50 100 100" className={className}>
      <g fill="none" style={{ stroke: "var(--accent)" }} strokeWidth="0.6">
        <circle r={R} strokeWidth="1" />
        {LATITUDES.map((lat) => {
          const rad = (lat * Math.PI) / 180;
          return <ellipse key={lat} cy={-R * Math.sin(rad)} rx={R * Math.cos(rad)} ry={R * Math.cos(rad) * 0.18} opacity={0.55} />;
        })}
        {Array.from({ length: MERIDIANS }, (_, i) => (
          <ellipse key={i} rx={R} ry={R} opacity={0.7}>
            <animate
              attributeName="rx"
              values={`${R};0;${R}`}
              dur={`${SPIN_SECONDS / 2}s`}
              begin={`-${((i / MERIDIANS) * SPIN_SECONDS) / 2}s`}
              repeatCount="indefinite"
            />
          </ellipse>
        ))}
        {/* Tilted orbit ring with a "satellite" riding it. */}
        <g transform="rotate(-24)">
          <ellipse rx={R + 7} ry={9} strokeDasharray="1.5 3" opacity={0.6} />
          <circle r="1.8" style={{ fill: "var(--accent)" }} stroke="none">
            <animateMotion dur="9s" repeatCount="indefinite" path={`M${R + 7},0 A${R + 7},9 0 1,1 ${-(R + 7)},0 A${R + 7},9 0 1,1 ${R + 7},0`} />
          </circle>
        </g>
        {/* Target marker. */}
        <circle cx="12" cy="-10" r="2" style={{ fill: "var(--series-2)" }} stroke="none" className="pulse" />
        <circle cx="12" cy="-10" r="5" style={{ stroke: "var(--series-2)" }} opacity={0.6} />
      </g>
    </svg>
  );
}
