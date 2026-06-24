import { useEffect, useRef } from "react";

/**
 * FanverseCore — "The Living Universe"
 * Siri-inspired fluid energy: soft iridescent blobs flowing, blending,
 * and pulsing. No sphere mask, no frame — fully free-floating.
 */
export interface FanverseCoreProps {
  intensity?: number;
  /** 5 hex colors used by the palette (deep, mid, accent1, accent2, highlight). */
  palette?: [string, string, string, string, string];
  maxDpr?: number;
  className?: string;
}

/* Paleta vibrante: cada cor cromática puxada pro pico de saturação
 * (chroma máximo), mais próxima dos eixos RGB puros pra preservar
 * o punch após o tonemap Reinhard do shader (col / (1 + col*0.7)).
 * O deep-space #080318 fica como está — é o background que
 * sustenta o contraste das outras. */
const DEFAULT_PALETTE: [string, string, string, string, string] = [
  "#080318", // deep space (unchanged)
  "#6500FF", // electric violet (era #5b1fd1)
  "#C800FF", // saturated magenta-purple (era #b026ff)
  "#FF00B8", // pure neon pink (era #ff2bd6)
  "#00FFE5", // peak cyan-aqua (era #22f0ff)
];

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const v = parseInt(
    h.length === 3
      ? h.split("").map((c) => c + c).join("")
      : h,
    16,
  );
  return [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

const VERT = `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  vec2 p = vec2((gl_VertexID == 1) ? 3.0 : -1.0, (gl_VertexID == 2) ? 3.0 : -1.0);
  vUv = p * 0.5 + 0.5;
  gl_Position = vec4(p, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 outColor;

uniform vec2  uResolution;
uniform float uTime;
uniform float uIntensity;
uniform vec3  uC0; // deep background
uniform vec3  uC1; // violet shell
uniform vec3  uC2; // magenta/pink petal
uniform vec3  uC3; // cyan petal
uniform vec3  uC4; // white highlight

float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float vnoise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  float a = hash(i), b = hash(i+vec2(1.,0.));
  float c = hash(i+vec2(0.,1.)), d = hash(i+vec2(1.,1.));
  vec2 u = f*f*(3.-2.*f);
  return mix(a,b,u.x) + (c-a)*u.y*(1.-u.x) + (d-b)*u.x*u.y;
}

mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }

// anisotropic gaussian "petal" — long ellipse, soft edges
// sharpness controls how solid (high) vs blurry (low) the petal looks
float petal(vec2 p, vec2 c, float ang, vec2 size, float sharpness){
  vec2 q = rot(-ang) * (p - c);
  q /= size;
  float d = dot(q, q);
  return exp(-d * sharpness);
}

void main(){
  vec2 res = uResolution;
  vec2 uv = (vUv * res - 0.5*res) / min(res.x, res.y);
  uv.y = -uv.y;
  // Zoom-out (1.3): a esfera tem R=0.55 e os halos vão até ~0.65, mas a
  // borda do canvas fica em 0.5 — então o orbe encostava/cortava nas 4
  // bordas, lendo como um "box" que cortava a sombra/forma. Escalando o
  // uv por 1.3 o conteúdo inteiro (corpo + halo) cabe dentro do canvas
  // com folga, restaurando o orbe "free-floating, no frame" do design.
  uv *= 1.3;

  // Varying speed in a loop: slow -> fast -> slow via integrated sine
  // d/dt(t) = 3.0 + 1.5*cos(uTime*0.5) → ranges ~ 1.5 .. 4.5
  float speedNorm = 0.5 + 0.5 * cos(uTime * 0.5); // 0 slow .. 1 fast
  float pinkShift = pow(speedNorm, 1.4);
  float t = uTime * 3.0 + 3.0 * sin(uTime * 0.5);

  float r = length(uv);
  float R = 0.55;

  // breathing halo — drops near 0 at moments so background shows through
  float haloBreath = 0.5 + 0.5 * sin(uTime * 0.55);
  haloBreath = pow(haloBreath, 1.8);

  // ---------- soft energy mask (no rim, no frame) ----------
  float sphere = smoothstep(R + 0.10, R - 0.34, r);       // wider, softer edge
  float halo   = exp(-pow((r - R*0.7) * 9.0, 2.0)) * 0.35; // tighter, dimmer
  float wideHalo = exp(-pow((r - R*0.5) * 5.5, 2.0)) * 0.10;

  // ---------- inside: swirling translucent petals ----------
  vec2 puv = uv;
  float edgeSquash = smoothstep(R, R*0.6, r);
  puv *= mix(1.15, 1.0, edgeSquash);

  float a0 = t * 0.9;
  float a1 = -t * 0.75 + 1.1;
  float a2 = t * 0.6 + 2.3;
  float a3 = -t * 1.1  + 3.7;

  vec2 c0 = vec2( 0.18,  0.10) * (0.6 + 0.4*sin(t*1.2));
  vec2 c1 = vec2(-0.20,  0.05) * (0.6 + 0.4*sin(t*1.4+1.0));
  vec2 c2 = vec2( 0.05, -0.18) * (0.6 + 0.4*sin(t*1.1+2.0));
  vec2 c3 = vec2(-0.08, -0.05) * (0.6 + 0.4*sin(t*1.5+3.0));

  vec2 s0 = vec2(0.55, 0.22);
  vec2 s1 = vec2(0.50, 0.20);
  vec2 s2 = vec2(0.48, 0.18);
  vec2 s3 = vec2(0.42, 0.16);

  // Sharpness range 9..17 com bias pow(sw, 2.0). Floor 9 garante
  // que mesmo o estado "fluido" tem definição clara; pico 17 produz
  // momentos quase cristalinos. Combinado com o boost de intensity
  // + tonemap menos compressor lá embaixo, os traços lêem como
  // sólidos e brilhantes o tempo todo.
  float sw = 0.5 + 0.5 * sin(uTime * 0.7 + 1.3);
  sw = pow(sw, 2.0);
  float sharpness = mix(9.0, 17.0, sw);
  float p0 = petal(puv, c0, a0, s0, sharpness);
  float p1 = petal(puv, c1, a1, s1, sharpness);
  float p2 = petal(puv, c2, a2, s2, sharpness);
  float p3 = petal(puv, c3, a3, s3, sharpness);

  // color blending — additive translucent
  // pink palette (hot pink) — used to shift colors when movement is fast
  vec3 pinkHot = mix(uC2, vec3(1.0, 0.18, 0.78), 0.85);
  vec3 col1 = mix(uC3, pinkHot, pinkShift);                 // cyan → pink
  vec3 col2 = mix(mix(uC2, uC4, 0.35), pinkHot, pinkShift); // pinkish white → hot pink
  vec3 col3 = mix(mix(uC3, uC1, 0.45), pinkHot, pinkShift * 0.85); // teal-violet → pink

  vec3 inner = vec3(0.0);
  inner += mix(uC2, pinkHot, pinkShift) * p0 * 1.05;
  inner += col1 * p1 * 1.05;
  inner += col2 * p2;
  inner += col3 * p3;

  // bright hot core where petals overlap — boost de brilho (0.9 → 1.15)
  // pra deixar o núcleo mais incandescente; overlap também sobe (0.8 → 1.0).
  float overlap = p0*p1 + p1*p2 + p2*p3 + p0*p3;
  float core = exp(-r*r * 22.0) * 1.15 + smoothstep(0.4, 1.8, overlap) * 1.0;
  inner += uC4 * core;

  // subtle inner depth tint
  inner += uC1 * smoothstep(R, 0.0, r) * 0.08;

  // ---------- compose ----------
  vec3 col = vec3(0.0);
  // base shell color (very faint violet inside)
  col += uC1 * sphere * 0.05;
  // petals only inside sphere
  col += inner * sphere;
  // outer halos modulated by breath so background peeks through
  col += uC1 * halo * (0.15 + 0.55 * haloBreath);
  col += uC1 * wideHalo * (0.2 + 0.8 * haloBreath);

  // top-left specular highlight on glass
  vec2 sp = uv - vec2(-0.28, 0.32);
  float spec = exp(-dot(sp, sp) * 35.0) * sphere * 0.35;
  col += vec3(1.0) * spec;

  // breathing pulse
  float pulse = 0.95 + 0.05*sin(t*2.5);
  col *= pulse * uIntensity;

  // grain
  col += (hash(gl_FragCoord.xy + uTime) - 0.5) * 0.015;

  // tonemap Reinhard — fator reduzido 0.7 → 0.55 pra comprimir
  // menos os brilhantes (deixa os picos mais "incandescentes"
  // em vez de saturar pra branco/cinza claro).
  col = col / (1.0 + col*0.55);

  // alpha: soft body + halos, no rim
  float a = clamp(sphere*0.95 + halo*(0.2 + 0.7*haloBreath) + wideHalo*(0.2 + 0.8*haloBreath), 0.0, 1.0);

  outColor = vec4(col, a);
}`;

export function FanverseCore({
  /* Default 1.3 (era 1) — multiplica o `col` final no shader pra
   * que o orb leia como brilhante na navbar. Caller pode passar
   * intensity={1} pra voltar ao baseline. */
  intensity = 1.3,
  palette = DEFAULT_PALETTE,
  maxDpr = 1.75,
  className,
}: FanverseCoreProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
      powerPreference: "high-performance",
    });
    if (!gl) return;

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(s));
      }
      return s;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(prog));
    }
    gl.useProgram(prog);

    const u = {
      res: gl.getUniformLocation(prog, "uResolution"),
      time: gl.getUniformLocation(prog, "uTime"),
      inten: gl.getUniformLocation(prog, "uIntensity"),
      c0: gl.getUniformLocation(prog, "uC0"),
      c1: gl.getUniformLocation(prog, "uC1"),
      c2: gl.getUniformLocation(prog, "uC2"),
      c3: gl.getUniformLocation(prog, "uC3"),
      c4: gl.getUniformLocation(prog, "uC4"),
    };

    gl.uniform3fv(u.c0, hexToRgb(palette[0]));
    gl.uniform3fv(u.c1, hexToRgb(palette[1]));
    gl.uniform3fv(u.c2, hexToRgb(palette[2]));
    gl.uniform3fv(u.c3, hexToRgb(palette[3]));
    gl.uniform3fv(u.c4, hexToRgb(palette[4]));
    gl.uniform1f(u.inten, intensity);

    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(2, Math.floor(rect.width * dpr));
      const h = Math.max(2, Math.floor(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const start = performance.now();
    // Estado de pausa: o rAF só corre quando o canvas está VISÍVEL no
    // viewport (IntersectionObserver) E o tab está em foreground
    // (visibilitychange). Sem isso, instâncias off-screen (ex.: o
    // FanverseCore do pre-footer enquanto o user está na hero)
    // continuavam queimando GPU à toa.
    let visible = false;
    let tabHidden = document.hidden;

    /* Per perf feedback "performance diminuiu" — throttle pra ~30fps
     * em mobile (matchMedia coarse pointer ~= touch device). Desktop
     * mantém 60fps. Reduz GPU work pela metade em phones sem perda
     * perceptível visual no shader. */
    const isCoarsePointer =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(pointer: coarse)').matches;
    const targetFrameMs = isCoarsePointer ? 1000 / 30 : 0;
    let lastFrameTime = 0;

    const render = () => {
      const tNow = performance.now();
      if (targetFrameMs > 0 && tNow - lastFrameTime < targetFrameMs) {
        rafRef.current = requestAnimationFrame(render);
        return;
      }
      lastFrameTime = tNow;
      const now = (tNow - start) / 1000;

      gl.uniform2f(u.res, canvas.width, canvas.height);
      gl.uniform1f(u.time, now);

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      rafRef.current = requestAnimationFrame(render);
    };

    const startLoop = () => {
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(render);
    };
    const stopLoop = () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
    const refresh = () => {
      if (visible && !tabHidden) startLoop();
      else stopLoop();
    };

    // IntersectionObserver — pausa quando o canvas sai do viewport.
    // rootMargin: 100px dá uma pequena margem pra resumir um pouco
    // antes do canvas aparecer (evita flash de "primeira frame".
    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? false;
        refresh();
      },
      { rootMargin: "100px" },
    );
    io.observe(canvas);

    // visibilitychange — pausa quando o tab sai pra background.
    const onVisChange = () => {
      tabHidden = document.hidden;
      refresh();
    };
    document.addEventListener("visibilitychange", onVisChange);

    return () => {
      stopLoop();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisChange);
      ro.disconnect();
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, [intensity, palette, maxDpr]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: "100%", height: "100%", display: "block", background: "transparent" }}
    />
  );
}

export default FanverseCore;
