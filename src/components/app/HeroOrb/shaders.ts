/**
 * GLSL shaders for the HeroOrb particle sphere.
 *
 * Kept in a separate module so the React component stays focused on
 * Three.js plumbing. Both shaders are GLSL ES 1.00 (WebGL 1 baseline)
 * so they run anywhere modern browsers do.
 *
 * Vertex shader
 * -------------
 *   - Inputs : `position` (base point on a unit sphere — spherical
 *              fibonacci layout precomputed in JS), `aSeed` (random
 *              [0,1) per particle, drives color + pulse phase),
 *              `aSize` (per-particle base size variation).
 *   - Uniforms: time, speed, mouse, intensity, devicePixelRatio.
 *   - Output : varying `vSeed` (passed to fragment for color mix)
 *              and `vGlow` (pulse phase brightness).
 *   - Algorithm:
 *       1. Compute layered 3D simplex noise displacement along the
 *          radial axis — the sphere becomes a living blob.
 *       2. Per-particle pulse via sin(time + seed) gives ethereal
 *          breathing.
 *       3. Subtle XZ wobble per particle (asymmetric rotation).
 *       4. Mouse parallax — small XY shift of each point.
 *       5. gl_PointSize scales with depth + pulse so foreground
 *          particles render bigger than background ones.
 *
 * Fragment shader
 * ---------------
 *   - Renders each point sprite as a soft radial glow (no texture)
 *     using gl_PointCoord — fully procedural.
 *   - Color is a 3-stop palette interpolated from `vSeed`:
 *     purple → magenta → orange.
 *   - Additive blending + a `core² + halo` alpha curve creates the
 *     premium soft glow when particles overlap.
 */

export const VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uSpeed;
  uniform vec2  uMouse;
  uniform float uIntensity;
  uniform float uPixelRatio;

  attribute float aSeed;
  attribute float aSize;

  varying float vSeed;
  varying float vGlow;

  // -- Ashima 3D simplex noise. Standard reference (Ashima Arts,
  // -- Stefan Gustavson). Inlined so the shader is self-contained.
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2  C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v   - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;

    i = mod289(i);
    vec4 p = permute(permute(permute(
                 i.z + vec4(0.0, i1.z, i2.z, 1.0))
               + i.y + vec4(0.0, i1.y, i2.y, 1.0))
               + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }

  void main() {
    vSeed = aSeed;
    float t = uTime * uSpeed;

    vec3 basePos = position;
    vec3 normal  = normalize(basePos);

    // Layered noise displacement along the radial axis. Two octaves
    // at different frequencies + opposing time drift = soft organic
    // morphing without any single sine becoming visible.
    float n1 = snoise(basePos * 1.6 + vec3(t * 0.25));
    float n2 = snoise(basePos * 3.0 - vec3(t * 0.40));
    float disp = (n1 * 0.7 + n2 * 0.3) * 0.22 * uIntensity;
    vec3 pos = basePos + normal * disp;

    // Per-particle pulse (used by both this stage for gl_PointSize
    // and the fragment for brightness).
    float pulse = 0.5 + 0.5 * sin(t * 1.8 + aSeed * 6.2831);
    vGlow = 0.55 + 0.55 * pulse;

    // Slight per-particle wobble — breaks the otherwise uniform
    // group rotation that lives on the parent THREE.Points object.
    float wobble = sin(t * 0.6 + aSeed * 3.0) * 0.04;
    float cw = cos(wobble), sw = sin(wobble);
    pos.xz = mat2(cw, -sw, sw, cw) * pos.xz;

    // Mouse parallax — small whole-body offset, not per-particle
    // chaos. The parent transform doesn't get a mouse hook because
    // we want the parallax to feel like the SCENE is shifting, not
    // the sphere center.
    pos.xy += uMouse * 0.06;

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPos;

    // Depth-attenuated point size, scaled by DPR so it stays sharp
    // on retina displays.
    float depthAtten = 1.0 / max(-mvPos.z, 0.1);
    gl_PointSize = aSize * (2.6 + 2.0 * pulse) * uPixelRatio * depthAtten;
  }
`;

export const FRAGMENT_SHADER = /* glsl */ `
  precision mediump float;

  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorC;

  varying float vSeed;
  varying float vGlow;

  void main() {
    // gl_PointCoord is [0, 1] within the sprite quad. Center it.
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;

    // Two stacked falloffs: bright core + soft halo. The halo gives
    // overlapping particles the additive bloom we want.
    float core = smoothstep(0.5, 0.05, d);
    float halo = smoothstep(0.5, 0.20, d);
    float alpha = core * core * 0.95 + halo * 0.22;

    // Three-stop color ramp keyed off seed. Split at 0.42 so the
    // purple→magenta range gets a bit more population than the
    // hotter magenta→orange range (premium tone, not arcade).
    vec3 col;
    if (vSeed < 0.42) {
      col = mix(uColorA, uColorB, vSeed / 0.42);
    } else {
      col = mix(uColorB, uColorC, (vSeed - 0.42) / 0.58);
    }

    // Pulse brightness scales the emissive output. Additive blending
    // does the rest; output is intentionally > 1.0 so overlapping
    // particles saturate to a near-white core in the middle.
    col *= vGlow * 1.6;

    gl_FragColor = vec4(col, alpha);
  }
`;
