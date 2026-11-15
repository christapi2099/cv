import { calmGLSL, noiseGLSL } from './noise.glsl.js';

/**
 * Full-screen procedural tunnel.
 *
 * Each pixel is mapped to polar coordinates around the vanishing point:
 *   depth z = uDepthScale / r   (perspective: the centre is infinitely far)
 * Noise is sampled on (cos θ', sin θ', z + uOffset), where θ' is the swirled
 * angle. Sampling on a circle avoids the seam atan() would leave, and adding
 * uOffset to depth is the entire "infinite travel": one scalar, no geometry.
 */
export const tunnelVertexShader = /* glsl */ `
void main() {
  // A 2×2 plane already spans clip space; camera matrices are not needed.
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const tunnelFragmentShader = /* glsl */ `
uniform vec2 uResolution;   // drawing buffer, device pixels
uniform vec2 uCenter;       // vanishing-point offset, in short-side units
uniform float uTime;        // seconds of animated time
uniform float uOffset;      // distance travelled
uniform float uOctaves;
uniform float uIntensity;
uniform float uDepthScale;
uniform float uTwist;
uniform float uSpin;
uniform float uCalm;
uniform vec3 uDeep;
uniform vec3 uMid;
uniform vec3 uEnergy;
uniform vec3 uFilament;

#define TAU 6.28318530718

${noiseGLSL}
${calmGLSL}

void main() {
  // Normalise by the SHORT side so the tunnel frames identically in landscape
  // and portrait: the short axis always spans [-0.5, 0.5].
  float unit = min(uResolution.x, uResolution.y);
  vec2 screen = (gl_FragCoord.xy - 0.5 * uResolution) / unit;
  vec2 halfExtent = 0.5 * uResolution / unit; // e.g. (0.5, 1.08) on a portrait phone
  vec2 p = screen - uCenter;
  float r = max(length(p), 1e-3);
  float theta = atan(p.y, p.x);

  float z = min(uDepthScale / r, 48.0);
  float travel = z + uOffset;
  float swirl = theta + z * uTwist + uTime * uSpin;
  vec2 ring = vec2(cos(swirl), sin(swirl));

  // Layer 1: cloudy walls, stretched along the depth axis so they read as
  // spiralling streams rather than blobs.
  float walls = fbm(vec3(ring * 2.2, travel * 0.3), uOctaves) * 0.5 + 0.5;

  // Layer 2: broad amber energy bands spiralling with the walls.
  float band = snoise(vec3(ring * 1.1 + 3.1, travel * 0.12)) * 0.5 + 0.5;
  band = smoothstep(0.5, 0.95, band);

  // Layer 3: thin lightning-like filaments (ridged noise, high exponent = thin).
  float ridge = 1.0 - abs(snoise(vec3(ring * 3.2 + 7.3, travel * 0.45)));
  float filament = pow(max(ridge, 0.0), 32.0); // |snoise| can exceed 1 slightly
  // Slow shimmer: well under 1 Hz at normal speed, under 3 Hz at max (WCAG 2.3.1).
  float shimmer = 0.75 + 0.25 * sin(uTime * TAU * 0.5 + travel * 0.5);

  float calm = calmMask(screen / halfExtent, uResolution, uCalm);

  vec3 color = mix(uDeep, uMid, walls * walls);
  color = mix(color, uEnergy, band * 0.45 * walls * calm);
  color += uFilament * filament * shimmer * 0.55 * calm;

  // Depth falloff: fade to black at the far centre, which also hides the
  // aliasing of very high depth values near the vanishing point.
  color *= smoothstep(0.03, 0.6, r);
  // Soft light at the end of the tunnel (glow without a post-processing pass).
  color += uMid * exp(-r * 12.0) * 0.3;

  // Edge vignette keeps the frame calm behind page content.
  // Elliptical, so it hugs the frame in any orientation.
  float vignette = 1.0 - smoothstep(0.75, 1.45, length(screen / halfExtent));
  color *= mix(0.5, 1.0, vignette);

  // Exposure + Reinhard tone map: bright areas roll off instead of clipping.
  color *= uIntensity * 1.25;
  color = color / (1.0 + color);

  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}
`;
