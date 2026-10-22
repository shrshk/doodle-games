import { useEffect, useRef, useState } from "react";
import type { Pt } from "../board/projection";

// Light on the sheet, drawn by one WebGL canvas laid exactly over the SVG. Everything lives in
// sheet (viewBox) coordinates, so effects register with the drawing on every layout. Rules taken
// from the Anatomy skill's shader guidance: every amount follows an envelope (no pops), every term
// fades to zero before any edge, the canvas only renders while something is lit, the device ratio
// is capped, and the SVG reads the same without it.

export interface LightTargets {
  /** 0 = day, 1 = lamp-lit night */
  night: number;
  /** centre of the lamp pool, sheet units */
  lamp: Pt;
  lampRadius: number;
  /** a smaller second lamp over the controls (die tower and roster), so they stay readable */
  lamp2: Pt;
  lamp2Radius: number;
  /** golden glow following a token up a ladder */
  glow: Pt | null;
  /** cool shimmer where a snake is swallowing */
  shade: Pt | null;
  /** win: light rays from this point */
  burst: Pt | null;
  /** size of a board square in sheet units, to scale the effects */
  unit: number;
}

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision mediump float;
uniform vec2 uRes;        // canvas pixels
uniform vec2 uOff;        // pixel offset of the sheet's origin
uniform float uScale;     // pixels per sheet unit
uniform float uTime;
uniform float uUnit;      // board square, sheet units
uniform float uNight;
uniform vec3 uLamp;       // x, y, radius (sheet)
uniform vec3 uLamp2;      // the controls lamp
uniform vec3 uGlow;       // x, y, amount
uniform vec3 uShade;      // x, y, amount
uniform vec4 uBurst;      // x, y, amount, age (s)

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}

void main() {
  // fragment -> sheet coordinates (y down, like the SVG)
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 p = (px - uOff) / uScale;

  vec3 col = vec3(0.0);   // premultiplied colour
  float a = 0.0;          // alpha

  // --- night: everything outside the lamp pool falls into warm dusk
  if (uNight > 0.001) {
    float flicker = 0.97 + 0.03 * noise(vec2(uTime * 1.7, 3.1));
    float d = length(p - uLamp.xy) / (uLamp.z * flicker);
    float d2 = length(p - uLamp2.xy) / (uLamp2.z * flicker);
    float lit = max(1.0 - smoothstep(0.35, 1.2, d), 0.95 * (1.0 - smoothstep(0.3, 1.15, d2)));
    // a soft lamp glow, not a dark room: the margins dim to half at most
    float dark = uNight * mix(0.5, 0.0, lit);
    // paper grain shows through the dark a little, like lamplight on a real sheet
    dark *= 0.94 + 0.06 * noise(p * 0.08);
    vec3 dusk = vec3(0.10, 0.07, 0.05);
    col += dusk * dark;
    a += dark;
    // warm tint inside the pool
    float warm = uNight * lit * 0.10;
    col = col * (1.0 - warm) + vec3(1.0, 0.72, 0.38) * warm;
    a = a + warm * (1.0 - a);
  }

  // --- ladder glow: soft golden light plus twinkles around the climbing token
  if (uGlow.z > 0.001) {
    float r = length(p - uGlow.xy) / (uUnit * 1.6);
    float g = exp(-r * r * 2.2) * uGlow.z * mix(0.38, 0.75, uNight);
    vec2 cell = floor(p / (uUnit * 0.22) + uTime * vec2(0.0, -0.6));
    float tw = step(0.965, hash(cell)) * (0.5 + 0.5 * sin(uTime * 9.0 + hash(cell) * 30.0));
    g += tw * exp(-r * r * 1.4) * uGlow.z * 0.6;
    vec3 gold = vec3(1.0, 0.82, 0.42);
    col = col * (1.0 - g) + gold * g;
    a = a + g * (1.0 - a);
  }

  // --- snake shade: a cool, shimmering dimness at the snake's head while it swallows
  if (uShade.z > 0.001) {
    float r = length(p - uShade.xy) / (uUnit * 2.0);
    float ripple = 0.75 + 0.25 * sin(r * 14.0 - uTime * 6.0);
    float s = exp(-r * r * 1.8) * uShade.z * 0.32 * ripple;
    vec3 cool = vec3(0.24, 0.22, 0.42);
    col = col * (1.0 - s) + cool * s;
    a = a + s * (1.0 - a);
  }

  // --- win burst: slowly turning rays and a ring that grows and fades
  if (uBurst.z > 0.001) {
    vec2 q = p - uBurst.xy;
    float r = length(q) / uUnit;
    float ang = atan(q.y, q.x);
    float rays = pow(0.5 + 0.5 * cos(ang * 12.0 + uTime * 0.5), 6.0);
    float reach = 2.0 + uBurst.w * 5.0;
    float fall = exp(-r / reach) * smoothstep(0.0, 1.0, r);
    float ring = exp(-pow(r - uBurst.w * 7.0, 2.0) * 0.6) * exp(-uBurst.w * 0.9);
    float b = (rays * fall * 0.55 + ring * 0.45) * uBurst.z;
    vec3 gold = vec3(1.0, 0.86, 0.5);
    col = col * (1.0 - b) + gold * b;
    a = a + b * (1.0 - a);
  }

  // tiny dither so soft gradients do not band
  float dither = (hash(gl_FragCoord.xy + uTime) - 0.5) / 255.0;
  gl_FragColor = vec4(col + dither * a, a);
}
`;

interface Env {
  night: number;
  glow: number;
  shade: number;
  burst: number;
  burstAge: number;
  glowAt: Pt;
  shadeAt: Pt;
  burstAt: Pt;
}

/** exponential follow: frame-rate independent, never jumps */
const follow = (cur: number, target: number, rate: number, dt: number) => target + (cur - target) * Math.exp(-rate * dt);

export function LightLayer({ targets, sheet, reduced }: { targets: LightTargets; sheet: { width: number; height: number }; reduced: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [glOk, setGlOk] = useState(true);
  const latest = useRef(targets);
  latest.current = targets;
  const wake = useRef<() => void>(() => {});

  useEffect(() => {
    const el = canvas.current!;
    const gl = el.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) {
      setGlOk(false);
      return;
    }
    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) console.error("light_shader_compile_failed", gl.getShaderInfoLog(sh));
      return sh;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = (name: string) => gl.getUniformLocation(prog, name);
    const U = {
      res: u("uRes"),
      off: u("uOff"),
      scale: u("uScale"),
      time: u("uTime"),
      unit: u("uUnit"),
      night: u("uNight"),
      lamp: u("uLamp"),
      lamp2: u("uLamp2"),
      glow: u("uGlow"),
      shade: u("uShade"),
      burst: u("uBurst"),
    };

    const env: Env = {
      night: latest.current.night,
      glow: 0,
      shade: 0,
      burst: 0,
      burstAge: 0,
      glowAt: { x: 0, y: 0 },
      shadeAt: { x: 0, y: 0 },
      burstAt: { x: 0, y: 0 },
    };
    let raf = 0;
    let last = performance.now();
    let running = false;
    const t0 = last;

    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const t = latest.current;
      // envelopes: attack faster than decay, so effects arrive briskly and fade gently
      env.night = follow(env.night, t.night, 3, dt);
      env.glow = follow(env.glow, t.glow ? 1 : 0, t.glow ? 6 : 1.6, dt);
      env.shade = follow(env.shade, t.shade ? 1 : 0, t.shade ? 5 : 1.4, dt);
      env.burst = follow(env.burst, t.burst ? 1 : 0, t.burst ? 4 : 1.2, dt);
      env.burstAge = t.burst ? env.burstAge + dt : 0;
      if (t.glow) env.glowAt = { x: follow(env.glowAt.x, t.glow.x, 14, dt), y: follow(env.glowAt.y, t.glow.y, 14, dt) };
      if (t.shade) env.shadeAt = t.shade;
      if (t.burst) env.burstAt = t.burst;

      // size the canvas to its box, device ratio capped at 1.5
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      const w = Math.round(el.clientWidth * dpr);
      const h = Math.round(el.clientHeight * dpr);
      if (el.width !== w || el.height !== h) {
        el.width = w;
        el.height = h;
      }
      // the SVG fits its viewBox with "meet": the same scale and centring here
      const scale = Math.min(w / sheet.width, h / sheet.height);
      gl.viewport(0, 0, w, h);
      gl.uniform2f(U.res, w, h);
      gl.uniform2f(U.off, (w - sheet.width * scale) / 2, (h - sheet.height * scale) / 2);
      gl.uniform1f(U.scale, scale);
      gl.uniform1f(U.time, reduced ? 0 : (now - t0) / 1000);
      gl.uniform1f(U.unit, t.unit);
      gl.uniform1f(U.night, env.night);
      gl.uniform3f(U.lamp, t.lamp.x, t.lamp.y, t.lampRadius);
      gl.uniform3f(U.lamp2, t.lamp2.x, t.lamp2.y, t.lamp2Radius);
      gl.uniform3f(U.glow, env.glowAt.x, env.glowAt.y, reduced ? 0 : env.glow);
      gl.uniform3f(U.shade, env.shadeAt.x, env.shadeAt.y, reduced ? 0 : env.shade);
      gl.uniform4f(U.burst, env.burstAt.x, env.burstAt.y, reduced ? 0 : env.burst, env.burstAge);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // keep going only while something is lit or still fading; night needs frames for its flicker
      const busy = env.night > 0.002 || env.glow > 0.002 || env.shade > 0.002 || env.burst > 0.002 || t.glow || t.shade || t.burst;
      if (busy && !(reduced && Math.abs(env.night - t.night) < 0.002 && !t.glow && !t.shade && !t.burst)) {
        raf = requestAnimationFrame(frame);
      } else {
        running = false;
      }
    };
    wake.current = () => {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    wake.current();
    const onResize = () => wake.current();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      // no loseContext(): React remounts effects in dev, and the next mount reuses this canvas's
      // context. The browser frees it when the canvas itself goes away.
    };
  }, [sheet.width, sheet.height, reduced]);

  // any change in what should be lit restarts the loop if it was idle
  useEffect(() => {
    wake.current();
  }, [targets]);

  return (
    <>
      <canvas ref={canvas} className="light-layer" aria-hidden="true" style={glOk ? undefined : { display: "none" }} />
      {/* without WebGL the night still falls, as a plain gradient */}
      {!glOk && <div className="light-fallback" aria-hidden="true" style={{ opacity: targets.night * 0.85 }} />}
    </>
  );
}
