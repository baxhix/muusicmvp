/**
 * GLSL shaders for the HeroOrb line-network sphere.
 *
 * Kept in a separate module so the React component stays focused on
 * Three.js plumbing. Both shaders are GLSL ES 1.00 (WebGL 1 baseline)
 * so they run anywhere modern browsers do.
 *
 * Geometry topology
 * -----------------
 * We render a `THREE.LineSegments` mesh: each pair of vertices in
 * the position buffer becomes one line segment. The base positions
 * sit on a unit sphere (the orb's resting form); the vertex shader
 * applies the same layered simplex-noise displacement to each
 * vertex, which means CONNECTED vertices stay connected as the
 * orb morphs (both endpoints of a segment get the same noise
 * because they share basePos values along their chord).
 *
 * Color movement
 * --------------
 * Each line carries a unique `aLineId` attribute. The fragment
 * shader feeds that id (plus uTime) into a fract() cycle that
 * drives where the line samples the 3-color palette. Result: every
 * line cycles through purple → magenta → orange independently, on
 * a long enough loop that the swarm always shows a balanced
 * distribution of colors.
 */

export const VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uSpeed;
  uniform vec2  uMouse;
  uniform float uIntensity;

  attribute float aLineId;

  varying float vLineId;
  varying float vNoise;

  // -- Ashima 3D simplex noise.
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
    vLineId = aLineId;
    float t = uTime * uSpeed;

    vec3 basePos = position;
    vec3 normal  = normalize(basePos);

    // Layered noise displacement. Same algorithm as the original
    // particle orb so connected endpoints displace identically and
    // segments don't tear apart as the sphere morphs.
    float n1 = snoise(basePos * 1.6 + vec3(t * 0.25));
    float n2 = snoise(basePos * 3.0 - vec3(t * 0.40));
    float disp = (n1 * 0.7 + n2 * 0.3) * 0.22 * uIntensity;
    vec3 pos = basePos + normal * disp;

    // Pass noise sample to the fragment so brightness can ride the
    // morph (lines passing through "high-pressure" zones glow more).
    vNoise = n1;

    // Tiny per-vertex wobble — both endpoints of a segment share
    // basePos so they stay together, but the resulting visible
    // motion of the segment is slightly off-axis from the bulk
    // rotation.
    float wobble = sin(t * 0.5 + dot(basePos, vec3(1.7, 2.3, 1.1))) * 0.04;
    float cw = cos(wobble), sw = sin(wobble);
    pos.xz = mat2(cw, -sw, sw, cw) * pos.xz;

    // Mouse parallax.
    pos.xy += uMouse * 0.06;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

export const FRAGMENT_SHADER = /* glsl */ `
  precision mediump float;

  uniform float uTime;
  uniform vec3  uColorA;  // purple
  uniform vec3  uColorB;  // magenta
  uniform vec3  uColorC;  // orange

  varying float vLineId;
  varying float vNoise;

  void main() {
    // Per-line dynamic color: each line samples the palette at a
    // moving offset (fract loops 0→1 → 0→1...). LineId stagger
    // ensures the swarm always shows all three colors at once.
    float phase = fract(vLineId * 0.0173 + uTime * 0.07);

    vec3 col;
    if (phase < 0.42) {
      col = mix(uColorA, uColorB, phase / 0.42);
    } else {
      col = mix(uColorB, uColorC, (phase - 0.42) / 0.58);
    }

    // Brightness rides the noise — lines passing through "valleys"
    // of the deformation field glow stronger. Adds the "energy
    // pulse" effect across the structure.
    float glow = 1.1 + 0.6 * vNoise;
    col *= max(glow, 0.35);

    // Alpha — kept slightly translucent so where two lines cross
    // additive blending bleeds them together into a brighter knot.
    gl_FragColor = vec4(col, 0.85);
  }
`;
