import { Face, palette, Token, type Mood, type TokenColor } from "@doodle-games/ui-doodle";
import type { SnakeArt } from "./art";
import { alongPolyline, type BoardGeom, type FlatPt } from "./geometry";
import { smoothPath, type Pt } from "./projection";
import { kindOf, type SnakeKind } from "./snakeKinds";

const f = (n: number) => n.toFixed(1);
const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const seg = (a: Pt, b: Pt) => `M${f(a.x)},${f(a.y)}L${f(b.x)},${f(b.y)}`;

export interface HeadPose {
  at: Pt;
  fwd: Pt;
  angle: number;
  /** screen units per cell at the head */
  s: number;
}

export function headPose(geom: BoardGeom, snake: SnakeArt): HeadPose {
  const cl = snake.centerline;
  const at = geom.toScreen(cl[0]!);
  const ahead = geom.toScreen(cl[Math.min(3, cl.length - 1)]!);
  const len = Math.hypot(at.x - ahead.x, at.y - ahead.y) || 1;
  const fwd = { x: (at.x - ahead.x) / len, y: (at.y - ahead.y) / len };
  return { at, fwd, angle: (Math.atan2(fwd.y, fwd.x) * 180) / Math.PI, s: geom.scaleAt(cl[0]!).sx };
}

function Pattern({ kind, center, left, right, unit }: { kind: SnakeKind; center: Pt[]; left: Pt[]; right: Pt[]; unit: number }) {
  const n = center.length;
  const ok = (i: number) => i > 3 && i < n - 4;
  const width = (i: number) => Math.hypot(left[i]!.x - right[i]!.x, left[i]!.y - right[i]!.y);
  const out: JSX.Element[] = [];
  switch (kind.pattern) {
    case "bands":
      for (let i = 4; i < n - 3; i += 3) out.push(<path key={i} d={seg(left[i]!, right[i]!)} />);
      return <g stroke={kind.accent} strokeWidth={unit * 0.04} strokeLinecap="round" opacity={0.85}>{out}</g>;
    case "rings":
      for (let i = 4; i < n - 4; i += 6) {
        out.push(<path key={i} d={seg(left[i]!, right[i]!)} />, <path key={`b${i}`} d={seg(left[i + 1]!, right[i + 1]!)} />);
      }
      return <g stroke={kind.accent} strokeWidth={unit * 0.018} strokeLinecap="round">{out}</g>;
    case "spots":
      for (let i = 4; i < n - 4; i += 4) {
        const side = (i / 4) % 2 ? left[i]! : right[i]!;
        const p = lerp(center[i]!, side, 0.4);
        out.push(<circle key={i} cx={p.x} cy={p.y} r={width(i) * 0.2} />);
      }
      return <g fill={kind.accent} stroke={kind.stroke} strokeWidth={unit * 0.008}>{out}</g>;
    case "zigzag": {
      const pts: Pt[] = [];
      for (let i = 3; i < n - 3; i += 2) pts.push(lerp(center[i]!, (i / 2) % 2 ? left[i]! : right[i]!, 0.62));
      return (
        <polyline
          points={pts.map((p) => `${f(p.x)},${f(p.y)}`).join(" ")}
          fill="none"
          stroke={kind.accent}
          strokeWidth={unit * 0.025}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      );
    }
    case "diamonds":
      for (let i = 4; i < n - 5; i += 5) {
        if (!ok(i + 2)) break;
        const d = [center[i - 2]!, lerp(center[i]!, left[i]!, 0.7), center[i + 2]!, lerp(center[i]!, right[i]!, 0.7)];
        out.push(<path key={i} d={`M${d.map((p) => `${f(p.x)},${f(p.y)}`).join("L")}Z`} />);
      }
      return <g fill={kind.accent} fillOpacity={0.75} stroke={kind.stroke} strokeWidth={unit * 0.01} strokeLinejoin="round">{out}</g>;
    case "chevrons":
      for (let i = 4; i < n - 5; i += 4) {
        const a = lerp(center[i]!, left[i]!, 0.8);
        const b = center[i + 2]!;
        const c = lerp(center[i]!, right[i]!, 0.8);
        out.push(<path key={i} d={`M${f(a.x)},${f(a.y)}L${f(b.x)},${f(b.y)}L${f(c.x)},${f(c.y)}`} />);
      }
      return <g fill="none" stroke={kind.accent} strokeWidth={unit * 0.02} strokeLinecap="round" strokeLinejoin="round">{out}</g>;
    case "blotches":
      for (let i = 4; i < n - 4; i += 5) {
        const p = lerp(center[i]!, i % 2 ? left[i]! : right[i]!, 0.18);
        const a = Math.atan2(left[i]!.y - right[i]!.y, left[i]!.x - right[i]!.x) * (180 / Math.PI) + 90;
        out.push(
          <ellipse key={i} cx={p.x} cy={p.y} rx={width(i) * 0.38} ry={width(i) * 0.26} transform={`rotate(${f(a)} ${f(p.x)} ${f(p.y)})`} />,
        );
      }
      return <g fill={kind.accent} fillOpacity={0.7} stroke={kind.stroke} strokeWidth={unit * 0.008}>{out}</g>;
    case "belly": {
      const line = center.slice(2, n - 2).map((p, k) => lerp(p, right[k + 2]!, 0.5));
      for (let i = 5; i < n - 5; i += 4) {
        const p = lerp(center[i]!, left[i]!, 0.45);
        out.push(<circle key={i} cx={p.x} cy={p.y} r={width(i) * 0.09} />);
      }
      return (
        <g>
          <path d={smoothPath(line)} fill="none" stroke={kind.accent} strokeWidth={unit * 0.045} strokeLinecap="round" opacity={0.9} />
          <g fill={kind.stroke} opacity={0.7}>{out}</g>
        </g>
      );
    }
  }
}

function Rattle({ kind, center, unit }: { kind: SnakeKind; center: Pt[]; unit: number }) {
  const n = center.length;
  const end = center[n - 1]!;
  const prev = center[n - 3]!;
  const l = Math.hypot(end.x - prev.x, end.y - prev.y) || 1;
  const d = { x: (end.x - prev.x) / l, y: (end.y - prev.y) / l };
  const angle = (Math.atan2(d.y, d.x) * 180) / Math.PI;
  return (
    <g>
      {[0, 1, 2].map((k) => {
        const p = { x: end.x + d.x * unit * (0.05 + k * 0.075), y: end.y + d.y * unit * (0.05 + k * 0.075) };
        const r = unit * (0.055 - k * 0.012);
        return (
          <ellipse
            key={k}
            cx={p.x}
            cy={p.y}
            rx={r * 0.8}
            ry={r * 1.25}
            transform={`rotate(${f(angle)} ${f(p.x)} ${f(p.y)})`}
            fill="#F6E3B4"
            stroke={kind.stroke}
            strokeWidth={unit * 0.012}
          />
        );
      })}
    </g>
  );
}

export function SnakeBody({ geom, snake }: { geom: BoardGeom; snake: SnakeArt }) {
  const kind = kindOf(snake.style);
  const center = snake.centerline.map(geom.toScreen);
  const left = snake.left.map(geom.toScreen);
  const right = snake.right.map(geom.toScreen);
  const n = center.length;
  const last = snake.centerline[n - 1]!;
  const prev = snake.centerline[n - 2]!;
  const tip = geom.toScreen({ c: last.c + (last.c - prev.c) * 0.8, r: last.r + (last.r - prev.r) * 0.8 });
  const body = smoothPath([...left, tip, ...[...right].reverse()], true);
  return (
    <g filter="url(#doodle-crayon)">
      <path d={body} fill={kind.fill} />
      <path d={body} fill="url(#doodle-streak-soft)" />
      <Pattern kind={kind} center={center} left={left} right={right} unit={geom.unit} />
      <path d={body} fill="none" stroke={kind.stroke} strokeWidth={geom.unit * 0.026} strokeLinejoin="round" />
      {kind.tail === "rattle" && <Rattle kind={kind} center={center} unit={geom.unit} />}
    </g>
  );
}

// Head shapes in local units (forward is +x, one unit = one cell), scaled into screen units so the
// crayon streak pattern keeps its size.
const ARROW: [number, number][][] = [
  [[0.36, 0]],
  [[0.3, -0.19], [-0.08, -0.29], [-0.25, -0.18]],
  [[-0.33, -0.08], [-0.33, 0.08], [-0.25, 0.18]],
  [[-0.08, 0.29], [0.3, 0.19], [0.36, 0]],
];
const arrowPath = (u: number) => {
  const p = ([x, y]: [number, number]) => `${f(x * u)},${f(y * u)}`;
  return `M${p(ARROW[0]![0]!)} ${ARROW.slice(1).map((c) => `C${c.map(p).join(" ")}`).join(" ")} Z`;
};

function Accessory({ kind }: { kind: SnakeKind }) {
  // drawn upright in face units (head is ~24 units tall), above the face
  switch (kind.accessory) {
    case "bow":
      return (
        <g transform="translate(10 -15) rotate(18)">
          <path d="M0,0 L-9,-6 L-9,6 Z M0,0 L9,-6 L9,6 Z" fill="#F5A3B5" stroke="#B5465E" strokeWidth={1.2} strokeLinejoin="round" />
          <circle r={2.4} fill="#E06F87" />
        </g>
      );
    case "crown":
      return (
        <path
          d="M-9,-14 L-9,-24 L-4,-19 L0,-26 L4,-19 L9,-24 L9,-14 Z"
          fill={palette.pencilYellow}
          stroke="#B38A1E"
          strokeWidth={1.2}
          strokeLinejoin="round"
        />
      );
    case "leaf":
      return (
        <g transform="translate(0 -14)">
          <path d="M0,0 Q-1,-6 1,-9" stroke="#4E7F3E" strokeWidth={1.3} fill="none" />
          <path d="M1,-9 C6,-16 14,-14 15,-9 C9,-6 4,-7 1,-9 Z" fill="#A8CC8C" stroke="#4E7F3E" strokeWidth={1.1} />
        </g>
      );
    case "partyhat":
      return (
        <g transform="translate(4 -15) rotate(14)">
          <path d="M-7,0 L0,-20 L7,0 Z" fill="#9FB3E2" stroke="#2F3088" strokeWidth={1.2} strokeLinejoin="round" />
          <path d="M-4.5,-7 L4.5,-7 M-2.5,-13 L2.5,-13" stroke={palette.crayonRed} strokeWidth={1.6} />
          <circle cy={-21} r={2.8} fill={palette.pencilYellow} stroke="#B38A1E" strokeWidth={0.9} />
        </g>
      );
    case "none":
      return null;
  }
}

/** Snake head with face and accessory. `open` shows a wide mouth with fangs for the swallow. */
export function SnakeHead({
  pose,
  kind,
  mood,
  open = 0,
  unit,
}: {
  pose: HeadPose;
  kind: SnakeKind;
  mood: Mood;
  /** 0 closed .. 1 wide open */
  open?: number;
  unit: number;
}) {
  const { at, fwd, angle, s } = pose;
  const u = s * (1 + open * 0.22);
  const sw = unit * 0.026;
  const Shape = (props: { fill: string; stroke?: string; strokeWidth?: number }) =>
    kind.head === "arrow" ? (
      <path d={arrowPath(u)} {...props} />
    ) : (
      <ellipse rx={u * (kind.head === "hood" ? 0.26 : 0.29)} ry={u * (kind.head === "hood" ? 0.22 : 0.24)} {...props} />
    );
  const k = (0.24 * u) / 12;
  const m = 0.4 + open * 0.6;
  return (
    <g filter="url(#doodle-crayon)">
      <g transform={`translate(${f(at.x)} ${f(at.y)}) rotate(${f(angle)})`}>
        {open < 0.2 && (
          <path
            d={`M${f(0.27 * u)},0 L${f(0.43 * u)},0 M${f(0.48 * u)},${f(-0.045 * u)} L${f(0.43 * u)},0 L${f(0.48 * u)},${f(0.045 * u)}`}
            stroke={palette.crayonRed}
            strokeWidth={unit * 0.02}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {kind.head === "hood" && (
          <g>
            <ellipse cx={-0.1 * u} rx={0.3 * u} ry={0.42 * u} fill={kind.fill} stroke={kind.stroke} strokeWidth={sw} />
            <ellipse cx={-0.1 * u} rx={0.3 * u} ry={0.42 * u} fill="url(#doodle-streak-soft)" />
            <path
              d={`M${f(-0.22 * u)},${f(-0.26 * u)} Q${f(-0.12 * u)},0 ${f(-0.22 * u)},${f(0.26 * u)} M${f(-0.3 * u)},${f(-0.16 * u)} Q${f(-0.24 * u)},0 ${f(-0.3 * u)},${f(0.16 * u)}`}
              stroke={kind.accent}
              strokeWidth={unit * 0.016}
              fill="none"
            />
          </g>
        )}
        <Shape fill={kind.fill} stroke={kind.stroke} strokeWidth={sw} />
        <Shape fill="url(#doodle-streak-soft)" />
        {open > 0 && (
          <g transform={`translate(${f(0.17 * u)} 0)`}>
            <ellipse rx={0.17 * u * m} ry={0.2 * u * m} fill="#7A2420" stroke={kind.stroke} strokeWidth={sw} />
            <path
              d={`M${f(0.02 * u * m)},${f(-0.12 * u * m)} L${f(0.07 * u * m)},${f(-0.04 * u * m)} L${f(0.1 * u * m)},${f(-0.13 * u * m)} Z M${f(0.02 * u * m)},${f(0.12 * u * m)} L${f(0.07 * u * m)},${f(0.04 * u * m)} L${f(0.1 * u * m)},${f(0.13 * u * m)} Z`}
              fill="#FFFDF7"
            />
          </g>
        )}
      </g>
      <g transform={`translate(${f(at.x - fwd.x * s * 0.04)} ${f(at.y - fwd.y * s * 0.04)}) scale(${f(k)})`}>
        <Face cx={0} cy={-3} spread={6.5} eye={2.5} mood={open > 0.3 ? "surprised" : mood} lashes={kind.lashes} />
        {open < 0.3 && <Accessory kind={kind} />}
      </g>
    </g>
  );
}

export interface Meal {
  index: number;
  phase: "chomp" | "digest" | "spit";
  /** 0..1 within the phase */
  t: number;
  color: TokenColor;
}

/** The swallow: open mouth, a lump travelling down the body with the token faintly inside, and a poof at the tail. */
export function MealLayer({ geom, snakes, meal }: { geom: BoardGeom; snakes: SnakeArt[]; meal: Meal }) {
  const snake = snakes[meal.index];
  if (!snake) return null;
  const kind = kindOf(snake.style);
  const pose = headPose(geom, snake);
  const body = snake.centerline.slice(0, snake.bodyCount);

  if (meal.phase === "chomp") {
    // snaps open, stays wide while the token is pulled in, then gulps shut
    const open = meal.t < 0.25 ? meal.t / 0.25 : meal.t < 0.85 ? 1 : (1 - meal.t) / 0.15;
    return <SnakeHead pose={pose} kind={kind} mood="happy" open={open} unit={geom.unit} />;
  }

  if (meal.phase === "digest") {
    const e = meal.t < 0.5 ? 2 * meal.t * meal.t : 1 - Math.pow(-2 * meal.t + 2, 2) / 2;
    const p: FlatPt = alongPolyline(body, e);
    const q: FlatPt = alongPolyline(body, Math.min(1, e + 0.02));
    const at = geom.toScreen(p);
    const ahead = geom.toScreen(q);
    const angle = (Math.atan2(ahead.y - at.y, ahead.x - at.x) * 180) / Math.PI;
    const i = Math.min(snake.bodyCount - 1, Math.round(e * (snake.bodyCount - 1)));
    const l = geom.toScreen(snake.left[i]!);
    const r = geom.toScreen(snake.right[i]!);
    const w = Math.max(geom.unit * 0.12, Math.hypot(l.x - r.x, l.y - r.y));
    const ry = Math.max(w * 0.95, geom.unit * 0.22);
    const rx = ry * 1.2;
    const pulse = 1 + Math.sin(meal.t * Math.PI * 10) * 0.06;
    return (
      <g>
        <SnakeHead pose={pose} kind={kind} mood="happy" unit={geom.unit} />
        <g transform={`translate(${f(at.x)} ${f(at.y)}) rotate(${f(angle)}) scale(${f(pulse)} ${f(2 - pulse)})`} filter="url(#doodle-crayon)">
          <clipPath id="meal-lump">
            <ellipse rx={rx} ry={ry} />
          </clipPath>
          <ellipse rx={rx} ry={ry} fill={kind.fill} />
          <g clipPath="url(#meal-lump)" opacity={0.42}>
            <g transform={`rotate(${f(-angle)}) scale(${f((ry * 1.5) / 100)}) translate(-50 -62)`}>
              <Token color={meal.color} mood="surprised" />
            </g>
          </g>
          <ellipse rx={rx} ry={ry} fill="url(#doodle-streak-soft)" />
          <ellipse rx={rx} ry={ry} fill="none" stroke={kind.stroke} strokeWidth={geom.unit * 0.026} />
        </g>
      </g>
    );
  }

  // spit: a poof of tiny stars at the tail
  const tail = geom.toScreen(body[body.length - 1]!);
  const spread = geom.unit * (0.2 + meal.t * 0.45);
  return (
    <g opacity={1 - meal.t} pointerEvents="none">
      <SnakeHead pose={pose} kind={kind} mood="happy" unit={geom.unit} />
      {Array.from({ length: 7 }, (_, k) => {
        const a = (k / 7) * Math.PI * 2 + 0.4;
        const x = tail.x + Math.cos(a) * spread;
        const y = tail.y + Math.sin(a) * spread * 0.8;
        return (
          <g key={k} transform={`translate(${f(x)} ${f(y)}) scale(${f(geom.unit / 90)})`}>
            <path d="M0,-8 L0,8 M-8,0 L8,0" stroke={k % 2 ? palette.pencilYellow : kind.stroke} strokeWidth={2.4} strokeLinecap="round" />
          </g>
        );
      })}
    </g>
  );
}
