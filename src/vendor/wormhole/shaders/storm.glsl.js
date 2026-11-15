import { calmGLSL, noiseGLSL } from './noise.glsl.js';

/**
 * Storm vortex tunnel (v2 look). Same polar mapping as the classic tunnel:
 *   depth z = uDepthScale / r, noise sampled on (cos θ', sin θ', z + offset)
 * so there is no atan seam and travel is one scalar.
 *
 * Clouds: domain-warped fBm (the sample point is displaced by a second fBm)
 * gives billowing, folded shapes instead of smooth bands; low twist keeps it
 * reading as cloud, not spiral. Fake volumetric light: a second density sample
 * a small step toward the light gives self-shadow (dark undersides) and
 * silver-lined edges. A tighter violet vortex with a ring fold sits at the far
 * end. uFlash lights the clouds from inside around uFlashPos; uAmbient grades
 * the whole thing down into a quiet background.
 */
export const STORM_MAX_OCTAVES = 5;

export const stormVertexShader = /* glsl */ `
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const stormFragmentShader = /* glsl */ `
uniform vec2 uResolution;
uniform vec2 uCenter;
uniform float uTime;
uniform float uOffset;
uniform float uOctaves;     // 3..5 by quality tier
uniform float uWarp;        // 0 on the low tier (warp skipped)
uniform float uIntensity;
uniform float uDepthScale;
uniform float uTwist;
uniform float uSpin;
uniform float uCalm;
uniform float uFlash;       // 0..1 cloud illumination from lightning
uniform vec2 uFlashPos;     // short-side screen units, centred
uniform float uFlashRadius; // gaussian sigma, short-side units
uniform float uAmbient;     // 0 intro grading .. 1 ambient grading
uniform float uFade;        // 1 = black
uniform vec3 uDeep;
uniform vec3 uCloudDark;
uniform vec3 uCloudMid;
uniform vec3 uCloudLight;
uniform vec3 uCore;
uniform vec3 uLightning;

#define TAU 6.28318530718

${noiseGLSL}
${calmGLSL}

// fBm with up to ${STORM_MAX_OCTAVES} octaves; each octave is rotated so the
// simplex lattice never lines up into visible bands.
const mat3 OCTAVE_ROT = mat3(0.00, 0.80, 0.60, -0.80, 0.36, -0.48, -0.60, -0.48, 0.64);

float stormFbm(vec3 p, float octaves) {
  float sum = 0.0;
  float amp = 0.5;
  float norm = 0.0;
  for (int i = 0; i < ${STORM_MAX_OCTAVES}; i++) {
    if (float(i) >= octaves) break;
    sum += amp * snoise(p);
    norm += amp;
    p = OCTAVE_ROT * p * 2.03 + vec3(3.1, 1.7, 4.3);
    amp *= 0.5;
  }
  return sum / max(norm, 1e-4);
}

// Cloud density: soft, signed fBm with a fast amplitude falloff, so large
// smoky masses dominate and fine octaves only add a gentle texture (crease
// terms such as |simplex| read as hard ink/foil, not vapour). A separate
// low-frequency term decides where the masses are, leaving dim gaps between.
float cloudDensity(vec3 p, float octaves) {
  float mass = snoise(p * 0.45 + vec3(11.0, 3.0, 7.0));
  float sum = 0.0;
  float amp = 0.5;
  float norm = 0.0;
  for (int i = 0; i < ${STORM_MAX_OCTAVES}; i++) {
    if (float(i) >= octaves) break;
    sum += amp * snoise(p);
    norm += amp;
    p = OCTAVE_ROT * p * 2.1 + vec3(1.3, 4.1, 2.7);
    amp *= 0.48;
  }
  float billow = sum / max(norm, 1e-4);
  return clamp(0.5 + billow * 0.72 + mass * 0.3, 0.0, 1.0);
}

void main() {
  float unit = min(uResolution.x, uResolution.y);
  vec2 screen = (gl_FragCoord.xy - 0.5 * uResolution) / unit;
  vec2 halfExtent = 0.5 * uResolution / unit;
  vec2 p = screen - uCenter;
  float r = max(length(p), 1e-3);
  float theta = atan(p.y, p.x);

  float z = min(uDepthScale / r, 40.0);
  float travel = z + uOffset;

  // ── Cloud walls ───────────────────────────────────────────────────────────
  // Depth is z = k / r as in the classic tunnel, but the cloud noise is
  // sampled at log depth: with the ring radius equal to the log scale the
  // mapping is conformal, so puffs stay round at every radius instead of
  // smearing into radial streaks near the screen edge. Low twist.
  float swirl = theta + z * uTwist * 0.3 + uTime * uSpin * 0.6;
  vec2 ring = vec2(cos(swirl), sin(swirl));
  const float WALL = 0.95; // lower = bigger, softer cloud masses
  vec3 q = vec3(ring * WALL, log(z) * WALL + uOffset * 0.75);

  // Domain warp: displace the sample point by a second, coarser fBm.
  vec3 warp = vec3(0.0);
  if (uWarp > 0.5) {
    float wo = 2.0;
    vec3 wq = q * 0.6;
    warp = vec3(
      stormFbm(wq + vec3(1.7, 9.2, 0.3), wo),
      stormFbm(wq + vec3(8.3, 2.8, 5.1), wo),
      stormFbm(wq + vec3(4.1, 6.3, 2.2), wo));
  }
  vec3 qq = q + warp * 0.55; // strong, low-frequency warp = rolling smoke

  float density = cloudDensity(qq, uOctaves);

  // Fake volumetric light: the coarse density (2 octaves) sampled twice, a
  // small step apart toward the light (the far end of the tunnel). Denser
  // toward the light = self-shadowed underside; thinner = lit, with a silver
  // lining at the edge. Coarse-only keeps the shading smooth across each lobe.
  vec3 lightStep = vec3(0.0, 0.05, 0.16);
  float coarse = cloudDensity(qq, 2.0);
  float towardLight = cloudDensity(qq + lightStep, 2.0);
  float lit = clamp(0.55 + (coarse - towardLight) * 1.6 + (density - coarse) * 1.2, 0.0, 1.0);

  float body = smoothstep(0.15, 0.85, density);
  // Lobes: lit side toward the light, self-shadowed underside.
  vec3 cloud = mix(uCloudDark * 0.7, uCloudMid, smoothstep(0.1, 0.9, lit));
  cloud = mix(cloud, uCloudLight, smoothstep(0.7, 1.0, lit) * body * 0.45);
  cloud *= mix(0.55, 1.0, body);
  float edge = smoothstep(0.12, 0.35, density) * (1.0 - smoothstep(0.35, 0.65, density));
  float lining = edge * smoothstep(0.5, 0.9, lit);
  // Gaps are dim cloud, not black: the tunnel is full of vapour.
  vec3 color = mix(mix(uDeep, uCloudDark, 0.55), cloud, smoothstep(0.05, 0.75, density));
  float calm = calmMask(screen / halfExtent, uResolution, uCalm);
  color += uCloudLight * lining * 0.15 * mix(0.5, 1.0, calm);
  // Aerial haze: deeper cloud melts into a soft blue mist.
  color = mix(color, uCloudMid * 0.6, 0.3 * smoothstep(1.0, 5.0, z));

  // ── Core swirl: a tighter violet vortex at the far end ────────────────────
  float coreN = snoise(vec3(ring * 1.2, z * 0.3 + uOffset * 0.35)) * 0.5 + 0.5;
  float arms = 0.5 + 0.5 * sin(3.0 * theta + z * 1.6 - uTime * 0.9 + coreN * 2.5);
  float fold = 0.5 + 0.5 * sin(z * 2.4 - uOffset * 0.8 + coreN * 3.0);
  float coreMask = smoothstep(2.0, 8.0, z + (coreN - 0.5) * 2.5);
  vec3 core = uCore * (0.25 + 0.9 * coreN) * (0.35 + 0.65 * arms) * (0.75 + 0.25 * fold);
  core += uCloudMid * 0.35 * density * arms;
  color = mix(color, core, coreMask * 0.9);
  color *= mix(1.0, 0.78, smoothstep(1.5, 6.0, z) * (1.0 - coreMask));
  color += uCore * exp(-r * 16.0) * 0.6;

  // ── Lightning: light inside the clouds around the bolt ───────────────────
  vec2 fd = screen - uFlashPos;
  float falloff = exp(-dot(fd, fd) / (2.0 * uFlashRadius * uFlashRadius));
  float glow = uFlash * falloff;
  // Dense cloud scatters more and gaps stay dark; the light fills the
  // self-shadow, so the cloud reads as lit from within, not painted over.
  vec3 flashTint = mix(uLightning, uCore * 1.8, 0.3);
  color += flashTint * glow * (0.04 + 0.95 * body * mix(0.55, 1.0, lit));
  color += flashTint * glow * lining * 0.9;

  // ── Edges darken ──────────────────────────────────────────────────────────
  float vignette = 1.0 - smoothstep(0.45, 1.25, length(screen / halfExtent));
  color *= mix(0.15, 1.0, vignette);

  // ── Exposure, tone map, ambient grading ──────────────────────────────────
  color *= uIntensity * 1.15;
  color = color / (1.0 + color);

  float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
  color = mix(color, vec3(luma), 0.4 * uAmbient);                  // desaturate ~40%
  color = mix(color, vec3(0.08), 0.25 * uAmbient);                 // lower contrast
  color = mix(color, uDeep, 0.2 * uAmbient) * mix(1.0, 0.9, uAmbient); // darken toward the page

  color *= 1.0 - uFade;
  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}
`;
