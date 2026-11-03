// Fixed topographic-map backdrop: contour rings around a few "peaks" plus a
// faint coordinate grid. Built once from a fixed seed, so it never changes.

const W = 1200;
const H = 1600;

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function contourPaths(): { d: string; index: boolean }[] {
  const rand = rng(7);
  const peaks = [
    { x: 260, y: 300, rings: 11, step: 26 },
    { x: 980, y: 520, rings: 9, step: 30 },
    { x: 520, y: 1050, rings: 13, step: 24 },
    { x: 1080, y: 1380, rings: 8, step: 28 },
    { x: 120, y: 1450, rings: 7, step: 32 },
  ];
  const paths: { d: string; index: boolean }[] = [];
  for (const p of peaks) {
    // Each peak gets its own lumpy shape: a few sine waves around the circle.
    const waves = [2, 3, 5].map((f) => ({ f, amp: 0.08 + rand() * 0.14, phase: rand() * Math.PI * 2 }));
    for (let ring = 1; ring <= p.rings; ring++) {
      const r = ring * p.step;
      const drift = ring * 0.06; // outer rings twist a little, like real terrain
      const pts: string[] = [];
      for (let i = 0; i < 72; i++) {
        const a = (i / 72) * Math.PI * 2;
        const wobble = waves.reduce((s, w) => s + w.amp * Math.sin(w.f * a + w.phase + drift), 0);
        const rr = r * (1 + wobble);
        pts.push(`${(p.x + rr * Math.cos(a)).toFixed(1)},${(p.y + rr * Math.sin(a) * 0.85).toFixed(1)}`);
      }
      paths.push({ d: `M${pts.join("L")}Z`, index: ring % 4 === 0 });
    }
  }
  return paths;
}

const PATHS = contourPaths();

export default function TopoBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <svg
        className="topo-drift absolute inset-[-10%] h-[120%] w-[120%]"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern id="graticule" width="100" height="100" patternUnits="userSpaceOnUse">
            <path d="M100 0H0V100" fill="none" style={{ stroke: "var(--topo)" }} strokeWidth="0.6" strokeDasharray="2 6" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#graticule)" />
        <g fill="none" style={{ stroke: "var(--topo)" }}>
          {PATHS.map((p, i) => (
            // Every 4th ring is an "index contour": thicker, like on real maps.
            <path key={i} d={p.d} strokeWidth={p.index ? 1.6 : 0.8} vectorEffect="non-scaling-stroke" />
          ))}
        </g>
      </svg>
      {/* Darken the edges so the middle (where the content is) stays calm. */}
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 50% 40%, transparent 30%, var(--page) 95%)" }} />
    </div>
  );
}
