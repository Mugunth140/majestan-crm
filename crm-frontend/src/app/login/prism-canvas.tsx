"use client";

import { useEffect, useRef } from "react";

// Login canvas: a beam of white light strikes a slowly turning glass prism and fans out into a
// spectrum that ripples, shimmers and pours toward the sign-in panel. The cursor bends the beam.
// Raw WebGL, one full-screen fragment shader.

const VERTEX = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAGMENT = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uIntro; // 0 → 1: beam ignites, then the spectrum opens
uniform vec2 uMouse;  // -0.5 … 0.5 across the canvas
uniform vec2 uFocus;  // centre of the visible canvas area (the panel covers the rest)

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
  return v;
}

// Visible spectrum, x = 0 red … 1 violet (Zucconi's six-bump fit).
vec3 spectral(float x) {
  float w = 1.0 - clamp(x, 0.0, 1.0);
  vec3 cs = vec3(3.54541723, 2.86670055, 2.29421995);
  vec3 xs = vec3(0.69548916, 0.49416934, 0.28269708);
  vec3 ys = vec3(0.02320775, 0.15936245, 0.53520021);
  vec3 k = cs * (w - xs);
  return max(max(1.0 - k * k, 0.0) - ys, 0.0);
}

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }

float sdEqTri(vec2 p, float r) {
  const float k = 1.7320508;
  p.x = abs(p.x) - r;
  p.y = p.y + r / k;
  if (p.x + k * p.y > 0.0) p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0;
  p.x -= clamp(p.x, -2.0 * r, 0.0);
  return -length(p) * sign(p.y);
}

float segDist(vec2 p, vec2 a, vec2 b, out float h) {
  vec2 pa = p - a, ba = b - a;
  h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

// A dispersed fan of light leaving \`origin\`, centred on angle \`centre\`, red on top → violet below.
vec3 fan(vec2 p, vec2 origin, float centre, float spread, float reachLen, float t, float seed) {
  vec2 q = p - origin;
  float dist = length(q);
  float ang = atan(q.y, q.x);
  float warp = (fbm(vec2(dist * 2.2 - t * 0.35 + seed, ang * 3.0 + t * 0.05)) - 0.5) * 0.11 * smoothstep(0.0, 0.6, dist);
  float u = (ang + warp - (centre + spread * 0.5)) / -spread;
  float inFan = smoothstep(-0.08, 0.06, u) * (1.0 - smoothstep(0.94, 1.08, u));
  float reach = exp(-dist * 0.55) * (1.0 - smoothstep(reachLen - 0.5, reachLen, dist)) * smoothstep(0.0, 0.03, dist);
  float caus = fbm(vec2(dist * 7.0 - t * 1.1 + seed, u * 9.0 + fbm(vec2(dist * 3.0, u * 4.0) - t * 0.2) * 3.0));
  caus = 0.45 + 1.3 * pow(caus, 2.2);
  vec3 spec = spectral(u);
  float haze = exp(-pow((u - 0.5) / 0.9, 2.0)) * 0.12;
  return spec * reach * (inFan * caus * 1.15 + haze);
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float t = uTime;
  float beamIn = clamp(uIntro * 2.0, 0.0, 1.0);
  float fanIn = smoothstep(0.45, 1.0, uIntro);

  // Prism: a tilted glass block with visible depth, turning slowly
  float r = 0.23;
  vec2 C = uFocus + vec2(-0.1, -0.07);
  float a = -0.5 + 0.1 * sin(t * 0.23) + uMouse.x * 0.18;
  mat2 R = rot(a);
  vec2 vA = vec2(-r, -r / 1.7320508), vB = vec2(r, -r / 1.7320508), vT = vec2(0.0, 2.0 * r / 1.7320508);
  vec2 E = C + R * mix(vA, vT, 0.4);    // entry, left face
  vec2 X = C + R * mix(vB, vT, 0.45);   // exit, right face
  vec2 D = vec2(0.075, 0.05) + 0.025 * vec2(sin(t * 0.3), cos(t * 0.26)); // back face offset

  // Background: near-black with a faint, slow nebula
  vec3 col = vec3(0.008, 0.012, 0.014);
  col += vec3(0.01, 0.025, 0.03) * fbm(p * 1.4 + vec2(t * 0.02, -t * 0.015));

  // Incoming beam
  vec2 S = vec2(uFocus.x - 1.8, E.y + 0.8 + uMouse.y * 0.4);
  float h;
  float d = segDist(p, S, E, h);
  float beam = exp(-d * d * 9000.0) * 1.4 + exp(-d * d * 250.0) * 0.22 + exp(-d * 30.0) * 0.06;
  beam *= step(h, beamIn);
  col += vec3(1.0, 0.97, 0.92) * beam * (0.95 + 0.05 * sin(t * 7.0));

  // Light inside the glass
  float h2;
  float d2 = segDist(p, E, X, h2);
  col += mix(vec3(1.0), spectral(h2), h2 * 0.7) * exp(-d2 * d2 * 2500.0) * 0.7 * fanIn;

  // Spectrum fans
  float centre = -0.05 + 0.08 * sin(t * 0.31) + uMouse.y * 0.2;
  float spread = 0.6 * fanIn + 0.0001;
  vec3 lit = fan(p, X, centre, spread, fanIn * 3.2, t, 0.0);
  col += lit;

  // Dust catching the light
  vec2 g = floor(p * 70.0);
  vec2 rp = vec2(hash(g), hash(g + 3.1));
  float star = step(0.985, hash(g + 9.7));
  float tw = 0.5 + 0.5 * sin(t * 2.5 + hash(g) * 6.2831);
  float spark = exp(-length(fract(p * 70.0) - rp) * 28.0) * star * tw;
  col += spark * (lit * 3.0 + vec3(0.04));

  // Glass prism: crisp front edges, dimmer back face and depth edges, a glint travelling round the rim
  float show = smoothstep(0.0, 0.35, uIntro);
  vec2 lp = (p - C) * R;
  float sd = sdEqTri(lp, r);
  float sdBack = sdEqTri(lp - D * R, r);
  float glint = pow(0.5 + 0.5 * sin(atan(lp.y, lp.x) - t * 1.4), 14.0);
  float edge = exp(-abs(sd) * 700.0) * 0.6 + exp(-abs(sd) * 60.0) * 0.05;
  float hd;
  float depth = min(min(segDist(lp, vA, vA + D * R, hd), segDist(lp, vB, vB + D * R, hd)), segDist(lp, vT, vT + D * R, hd));
  float back = exp(-abs(sdBack) * 700.0) * 0.22 + exp(-depth * 900.0) * 0.3;
  col += vec3(0.9, 0.96, 1.0) * (edge * (0.55 + 1.8 * glint) + back) * show;
  float body = max(1.0 - smoothstep(-0.004, 0.0, sd), 1.0 - smoothstep(-0.004, 0.0, sdBack));
  col += vec3(0.6, 0.8, 0.85) * 0.03 * body * (0.6 + 0.4 * lp.y / r) * show;

  // Vignette, tone map, grain
  col *= 0.72 + 0.28 * smoothstep(1.3, 0.3, length(p - uFocus));
  col = 1.0 - exp(-col * 1.35);
  col += (hash(gl_FragCoord.xy + fract(t) * 100.0) - 0.5) * 0.03;
  gl_FragColor = vec4(col, 1.0);
}
`;

const INTRO_MS = 2600;
const SPEED = 0.6; // scene time runs slower than wall time
const RENDER_SCALE = 0.75; // soft light tolerates a lower internal resolution

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? "shader");
  return shader;
}

export function PrismCanvas({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, preserveDrawingBuffer: false });
    if (!gl || gl.isContextLost()) return;

    let program: WebGLProgram;
    try {
      program = gl.createProgram()!;
      gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
      gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "link");
    } catch (err) {
      console.error("Prism canvas:", err);
      return;
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, "uRes");
    const uTime = gl.getUniformLocation(program, "uTime");
    const uIntro = gl.getUniformLocation(program, "uIntro");
    const uMouse = gl.getUniformLocation(program, "uMouse");
    const uFocus = gl.getUniformLocation(program, "uFocus");

    // The canvas runs on under the sign-in panel; the scene centres on the parent's visible width.
    let focusX = 0;
    const resize = () => {
      const scale = Math.min(window.devicePixelRatio || 1, 1.5) * RENDER_SCALE;
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * scale));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
      const visible = canvas.parentElement?.clientWidth ?? canvas.clientWidth;
      focusX = (visible - canvas.clientWidth) / 2 / Math.max(1, canvas.clientHeight);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    // Cursor position eases toward its target so the light bends smoothly.
    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    const onPointer = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.tx = Math.max(-0.5, Math.min(0.5, (e.clientX - rect.left) / rect.width - 0.5));
      mouse.ty = Math.max(-0.5, Math.min(0.5, 0.5 - (e.clientY - rect.top) / rect.height));
    };
    window.addEventListener("pointermove", onPointer);

    const draw = (time: number, intro: number) => {
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, time);
      gl.uniform1f(uIntro, intro);
      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.uniform2f(uFocus, focusX, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    if (reduceMotion) {
      draw(8, 1);
    } else {
      const start = performance.now();
      const tick = (now: number) => {
        mouse.x += (mouse.tx - mouse.x) * 0.04;
        mouse.y += (mouse.ty - mouse.y) * 0.04;
        const k = Math.min(1, (now - start) / INTRO_MS);
        draw(((now - start) / 1000) * SPEED, 1 - (1 - k) ** 3);
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("pointermove", onPointer);
      // Don't force-lose the context: React's dev double-mount reuses this canvas, and getContext
      // would hand back the lost context, failing the shader compile.
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className={className} />;
}
