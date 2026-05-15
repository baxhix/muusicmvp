/**
 * GLSL shaders for the HeroOrb flowing-ribbon sphere.
 *
 * Geometry topology
 * -----------------
 * We render a THREE.LineSegments mesh whose vertices are sampled
 * along closed parametric curves on a unit sphere (each curve is a
 * tilted great-circle with a slight radius variation — see
 * buildFlowingCurves in HeroOrb.tsx). Adjacent vertices along the
 * same curve are connected as segments; multiple curves cross each
 * other so the wireframe reads as a tangle of light ribbons
 * wrapping the orb.
 *
 * Per-vertex attributes:
 *   - position    : base XYZ on the unit sphere (curve sampling)
 *   - aT          : [0,1) parametric position along the curve
 *   - aPathSeed   : random [0,1) per CURVE — drives independent
 *                   color cycles + flow-phase offsets so the
 *                   ribbons don't shimmer in lockstep.
 *
 * Vertex shader
 * -------------
 * Applies layered simplex noise displacement along the radial
 * axis — the whole sphere morphs. Adjacent vertices on a curve
 * displace consistently because they share the same basePos
 * chord, so segments never tear apart even at large amplitudes.
 *
 * Fragment shader
 * ---------------
 *   - Color phase loops the 3-stop palette over time + along the
 *     curve. Different pathSeeds keep curves in different cycles.
 *   - "Flow" effect is a running sine wave of brightness moving
 *     along the curve via `aT - time` → simulates light traveling
 *     through each ribbon like an LED chase, the dominant motion
 *     the reference image was asking for.
 *   - Noise also modulates brightness so the wave brightens more
 *     in deformation hotspots — the orb feels alive instead of
 *     just blinking.
 */

export const VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uSpeed;
  uniform vec2  uMouse;
  uniform float uIntensity;

  attribute float aT;
  attribute float aPathSeed;

  varying float vT;
  varying float vPathSeed;
  varying float vNoise;

  // -- Ashima 3D simplex noise (standard reference implementation).
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
    vT        = aT;
    vPathSeed = aPathSeed;

    float t = uTime * uSpeed;

    vec3 basePos = position;
    vec3 normal  = normalize(basePos);

    // Layered noise displacement. Same algorithm as before so
    // adjacent vertices on a curve displace consistently and the
    // ribbons don't tear apart.
    float n1 = snoise(basePos * 1.6 + vec3(t * 0.25));
    float n2 = snoise(basePos * 3.0 - vec3(t * 0.40));
    float disp = (n1 * 0.7 + n2 * 0.3) * 0.22 * uIntensity;
    vec3 pos = basePos + normal * disp;
    vNoise = n1;

    // Mouse parallax — small body shift.
    pos.xy += uMouse * 0.06;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

export const FRAGMENT_SHADER = /* glsl */ `
  precision mediump float;

  uniform float uTime;
  uniform vec3  uColorA;   // purple
  uniform vec3  uColorB;   // magenta
  uniform vec3  uColorC;   // orange

  varying float vT;
  varying float vPathSeed;
  varying float vNoise;

  void main() {
    float t = uTime * 0.5;

    // ─── Color phase ───────────────────────────────────────
    // Loops the 3-stop palette along each curve. The path seed
    // staggers each curve's cycle so the swarm always shows all
    // three colors at once.
    float colorPhase = fract(vT + vPathSeed * 0.13 + t * 0.06);
    vec3 col;
    if (colorPhase < 0.42) {
      col = mix(uColorA, uColorB, colorPhase / 0.42);
    } else {
      col = mix(uColorB, uColorC, (colorPhase - 0.42) / 0.58);
    }

    // ─── Flow ─────────────────────────────────────────────
    // A sine wave of brightness running along the curve at uTime
    // pace. Each path has its own offset (via pathSeed) so the
    // bright crests don't all align. Sharpened with pow() so the
    // crests read as discrete "pulses" traveling along the
    // ribbon rather than a uniform glow.
    float wave = sin((vT * 6.2831 + vPathSeed * 9.4248) - t * 3.5);
    float flow = pow(0.5 + 0.5 * wave, 2.4);

    // Noise also modulates brightness so the wave brightens more
    // in deformation hotspots — gives the impression of energy
    // flowing through the active morph zones.
    float brightness = 0.35 + 1.1 * flow + 0.35 * vNoise;

    col *= max(brightness, 0.25);

    // Alpha — slight translucency so overlapping ribbons saturate
    // through additive blending to a near-white core where they
    // cross.
    gl_FragColor = vec4(col, 0.88);
  }
`;
