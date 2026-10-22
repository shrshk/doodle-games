import { palette } from "./palette";

export type Mood = "idle" | "happy" | "dizzy" | "surprised" | "sleepy";

const INK = "#2B211D";

function Spiral({ x, y, r }: { x: number; y: number; r: number }) {
  const pts: string[] = [];
  for (let i = 0; i <= 28; i++) {
    const a = i * 0.45;
    const rr = (r * i) / 28;
    pts.push(`${(x + Math.cos(a) * rr).toFixed(2)},${(y + Math.sin(a) * rr).toFixed(2)}`);
  }
  return <polyline points={pts.join(" ")} fill="none" stroke={INK} strokeWidth={1.3} strokeLinecap="round" />;
}

/** Dot eyes, pink blush and a mouth; shared by every character. */
export function Face({
  cx,
  cy,
  spread = 9,
  eye = 3.4,
  mood = "idle",
  sclera = false,
  blush = true,
  lashes = false,
}: {
  cx: number;
  cy: number;
  spread?: number;
  eye?: number;
  mood?: Mood;
  sclera?: boolean;
  blush?: boolean;
  lashes?: boolean;
}) {
  const eyes = [cx - spread, cx + spread];
  return (
    <g>
      {blush &&
        [cx - spread - 4.5, cx + spread + 4.5].map((x) => (
          <ellipse key={x} cx={x} cy={cy + 5} rx={3.6} ry={2.2} fill={palette.blush} opacity={0.6} />
        ))}
      {eyes.map((x) => {
        switch (mood) {
          case "happy":
            return (
              <path
                key={x}
                d={`M${x - eye},${cy + 1} Q${x},${cy - eye * 1.5} ${x + eye},${cy + 1}`}
                fill="none"
                stroke={INK}
                strokeWidth={1.8}
                strokeLinecap="round"
              />
            );
          case "sleepy":
            return (
              <path
                key={x}
                d={`M${x - eye},${cy} Q${x},${cy + eye * 1.2} ${x + eye},${cy}`}
                fill="none"
                stroke={INK}
                strokeWidth={1.6}
                strokeLinecap="round"
              />
            );
          case "dizzy":
            return <Spiral key={x} x={x} y={cy} r={eye * 1.2} />;
          default: {
            const s = mood === "surprised" ? 1.3 : 1;
            return (
              <g key={x} className="doodle-blink">
                {sclera && <ellipse cx={x} cy={cy} rx={eye * 1.6} ry={eye * 1.75} fill="#FBF8F2" />}
                <ellipse cx={x} cy={cy} rx={eye * 0.95 * s} ry={eye * 1.12 * s} fill={INK} />
                <circle cx={x - eye * 0.3} cy={cy - eye * 0.42} r={eye * 0.36} fill="#fff" />
              </g>
            );
          }
        }
      })}
      {lashes &&
        eyes.map((x, i) => {
          const side = i === 0 ? -1 : 1;
          return (
            <path
              key={`l${x}`}
              d={`M${x + side * eye * 0.6},${cy - eye * 0.9} l${side * 2.2},-2.2 M${x + side * eye * 1.05},${cy - eye * 0.35} l${side * 2.6},-1`}
              stroke={INK}
              strokeWidth={1.1}
              strokeLinecap="round"
            />
          );
        })}
      {mood === "happy" ? (
        <path d={`M${cx - 4.5},${cy + 5} Q${cx},${cy + 12} ${cx + 4.5},${cy + 5} Z`} fill="#8A3A33" />
      ) : mood === "surprised" ? (
        <ellipse cx={cx} cy={cy + 7} rx={2} ry={2.5} fill="#8A3A33" />
      ) : mood === "dizzy" ? (
        <path
          d={`M${cx - 5},${cy + 7.5} q2.5,-2.2 5,0 t5,0`}
          fill="none"
          stroke={INK}
          strokeWidth={1.4}
          strokeLinecap="round"
        />
      ) : (
        <path
          d={`M${cx - 3.2},${cy + 5.5} Q${cx},${cy + 8.6} ${cx + 3.2},${cy + 5.5}`}
          fill="none"
          stroke={INK}
          strokeWidth={1.4}
          strokeLinecap="round"
        />
      )}
    </g>
  );
}
