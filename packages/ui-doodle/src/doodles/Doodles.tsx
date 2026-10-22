import { Crayon } from "../PencilDefs";
import { Face } from "../Face";
import { palette } from "../palette";

// Ambient margin doodles. Each draws around its own local origin; place them with a transform.

export function Sun({ grin = false }: { grin?: boolean }) {
  const rays = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2 + (i % 2) * 0.06;
    const r0 = 60;
    const r1 = i % 2 ? 74 : 80;
    return `M${(Math.cos(a) * r0).toFixed(1)},${(Math.sin(a) * r0).toFixed(1)} L${(Math.cos(a) * r1).toFixed(1)},${(Math.sin(a) * r1).toFixed(1)}`;
  });
  return (
    <g>
      <g className={grin ? "doodle-sun-rays doodle-wiggle" : "doodle-sun-rays"}>
        <path d={rays.join(" ")} stroke="#E0A93A" strokeWidth={3} strokeLinecap="round" fill="none" />
      </g>
      <g filter="url(#doodle-crayon)">
        <Crayon d="M0,-52 C30,-52 52,-30 52,0 C52,30 30,52 0,52 C-30,52 -52,30 -52,0 C-52,-30 -30,-52 0,-52 Z" fill={palette.pencilYellow} stroke="#C9962A" strokeWidth={2.4} />
        <g transform="scale(2.1) translate(0,-4)">
          <Face cx={0} cy={0} spread={7} eye={2.4} mood={grin ? "happy" : "idle"} />
        </g>
      </g>
    </g>
  );
}

export function Cloud() {
  return (
    <g filter="url(#doodle-pencil)">
      <path
        d="M-60,20 C-80,20 -80,-6 -58,-6 C-60,-30 -26,-36 -16,-16 C-8,-38 30,-36 32,-12 C56,-16 70,18 46,20 Z"
        fill="#FBFAF6"
        fillOpacity={0.7}
        stroke="#7686AD"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <g transform="translate(-6,2)">
        <Face cx={0} cy={0} spread={7} eye={2.2} mood="sleepy" />
      </g>
    </g>
  );
}

export function Rainbow() {
  const colors = ["#D9534A", "#E3A84B", "#E9C24A", "#8DB27A", "#6C8FD0", "#8E6BB5"];
  return (
    <g>
      <g filter="url(#doodle-crayon)" fill="none" strokeLinecap="round" opacity={0.85}>
        {colors.map((c, i) => {
          const r = 120 - i * 10;
          return <path key={c} d={`M${-r},0 A${r},${r * 0.95} 0 0 1 ${r},0`} stroke={c} strokeWidth={8} />;
        })}
      </g>
      <g transform="translate(-118,4) scale(0.55)">
        <Cloud />
      </g>
      <g transform="translate(118,4) scale(0.55)">
        <Cloud />
      </g>
    </g>
  );
}

export function Potato({ awake = false }: { awake?: boolean }) {
  return (
    <g>
      <g filter="url(#doodle-crayon)">
        <Crayon
          d="M-30,4 C-32,-16 -14,-26 4,-24 C22,-23 34,-12 32,4 C31,20 16,26 0,26 C-18,26 -29,18 -30,4 Z"
          fill="#EAD8B6"
          stroke={palette.pencilBrown}
        />
        {[
          [14, -14],
          [20, -8],
          [-18, 14],
        ].map(([x, y]) => (
          <circle key={`${x}${y}`} cx={x} cy={y} r={1.6} fill={palette.pencilBrown} opacity={0.7} />
        ))}
        <g transform="translate(0,2)">
          <Face cx={0} cy={0} spread={8} eye={2.6} mood={awake ? "surprised" : "sleepy"} />
        </g>
      </g>
      <path d="M-24,30 l10,-1 M-6,31 l12,-1 M12,30 l8,-1" stroke="#9A8F80" strokeWidth={1.2} strokeLinecap="round" />
      {awake ? (
        <text x={26} y={-26} className="doodle-hand" fontSize={22} fill={palette.crayonRed}>
          !
        </text>
      ) : (
        <g className="doodle-zzz" fill={palette.ink}>
          <text x={28} y={-22} className="doodle-hand" fontSize={16}>
            z
          </text>
          <text x={38} y={-34} className="doodle-hand" fontSize={11}>
            z
          </text>
        </g>
      )}
    </g>
  );
}

export const STAR_PATH =
  "M0,-10 L2.9,-3.6 L9.6,-3.1 L4.5,1.4 L6,8.2 L0,4.6 L-6,8.2 L-4.5,1.4 L-9.6,-3.1 L-2.9,-3.6 Z";

export function Star({ face = true, sleepy = false, size = 1 }: { face?: boolean; sleepy?: boolean; size?: number }) {
  return (
    <g transform={`scale(${size})`} filter="url(#doodle-crayon)">
      <path d={STAR_PATH} fill={palette.pencilYellow} stroke="#C9962A" strokeWidth={1} strokeLinejoin="round" />
      {face && (
        <g transform="translate(0,0.5) scale(0.32)">
          <Face cx={0} cy={0} spread={6} eye={2.2} mood={sleepy ? "sleepy" : "idle"} blush={false} />
        </g>
      )}
    </g>
  );
}

/** A sagging string of hanging stars across `width`, starting at the local origin. */
export function Bunting({ width }: { width: number }) {
  const sag = 26;
  const count = Math.max(3, Math.round(width / 80));
  const y = (t: number) => 4 * sag * t * (1 - t);
  return (
    <g>
      <path d={`M0,0 Q${width / 2},${sag * 2} ${width},0`} fill="none" stroke="#9A8F80" strokeWidth={1.2} />
      {Array.from({ length: count }, (_, i) => {
        const t = (i + 0.5) / count;
        const x = t * width;
        const drop = 14 + (i % 3) * 9;
        return (
          <g key={i} transform={`translate(${x.toFixed(1)},${y(t).toFixed(1)})`}>
            <line x1={0} y1={0} x2={0} y2={drop} stroke="#9A8F80" strokeWidth={1} />
            <g transform={`translate(0,${drop + 11}) rotate(${(i % 2 ? 1 : -1) * 8})`} className="doodle-sway">
              <Star sleepy={i % 3 === 1} size={1.5} />
            </g>
          </g>
        );
      })}
    </g>
  );
}

export function Whale() {
  return (
    <g>
      {/* palm tree on its back */}
      <path d="M40,-38 Q44,-70 36,-96" fill="none" stroke={palette.pencilBrown} strokeWidth={4} strokeLinecap="round" />
      <g fill="#7FB069" stroke="#4E7F3E" strokeWidth={1.3} filter="url(#doodle-crayon)">
        <path d="M36,-96 Q14,-104 -2,-90 Q16,-96 36,-94 Z" />
        <path d="M36,-96 Q56,-108 74,-96 Q56,-98 37,-94 Z" />
        <path d="M36,-96 Q30,-118 12,-118 Q28,-110 35,-95 Z" />
        <path d="M36,-96 Q48,-118 64,-114 Q48,-110 37,-95 Z" />
      </g>
      <g filter="url(#doodle-crayon)">
        <Crayon
          d="M-110,-6 C-110,-46 -50,-62 10,-58 C70,-54 106,-30 112,-8 C120,-14 132,-30 146,-30 C140,-16 136,-6 140,6 C128,2 118,-2 112,4 C104,34 50,46 -10,44 C-70,42 -110,28 -110,-6 Z"
          fill="#8FA6DA"
          stroke={palette.crayonBlue}
          strokeWidth={2.4}
        />
        <path d="M-96,14 Q-30,30 60,20" fill="none" stroke={palette.crayonBlue} strokeWidth={1.4} opacity={0.6} />
        <path d="M-40,8 q-6,14 6,22" fill="none" stroke={palette.crayonBlue} strokeWidth={1.6} />
        <g transform="translate(-70,-12)">
          <Face cx={0} cy={0} spread={9} eye={3} mood="sleepy" />
        </g>
      </g>
      {/* the sleepers */}
      {[-20, 4, 26, 60].map((x, i) => (
        <g key={x} transform={`translate(${x},${-58 + (i % 2) * 2}) scale(0.34)`}>
          <Potato />
        </g>
      ))}
    </g>
  );
}

export function GrassTuft() {
  return (
    <path
      d="M0,0 Q-3,-10 -7,-16 M3,0 Q3,-12 1,-20 M6,0 Q9,-8 13,-13"
      fill="none"
      stroke="#6FA05A"
      strokeWidth={1.8}
      strokeLinecap="round"
    />
  );
}

export function Flower({ color = "#6C8FD0" }: { color?: string }) {
  return (
    <g>
      <path d="M0,0 Q2,-16 0,-30" fill="none" stroke="#6FA05A" strokeWidth={1.5} />
      <path d="M1,-12 q8,-6 12,-2 q-6,5 -12,2" fill="#A8CC8C" stroke="#6FA05A" strokeWidth={1} />
      {Array.from({ length: 5 }, (_, i) => {
        const a = (i / 5) * Math.PI * 2;
        return (
          <circle
            key={i}
            cx={Math.cos(a) * 5}
            cy={-34 + Math.sin(a) * 5}
            r={3.6}
            fill="#FBFAF6"
            stroke={color}
            strokeWidth={1.2}
          />
        );
      })}
      <circle cx={0} cy={-34} r={2.4} fill={palette.pencilYellow} />
    </g>
  );
}

export function MiniMushroom() {
  return (
    <g filter="url(#doodle-pencil)">
      <path d="M-14,-10 Q0,-26 14,-10 Z" fill="#E7A39C" stroke={palette.crayonRed} strokeWidth={1.4} />
      <path d="M-4,-10 L-5,0 M4,-10 L5,0" stroke={palette.pencilBrown} strokeWidth={1.4} strokeLinecap="round" />
    </g>
  );
}
