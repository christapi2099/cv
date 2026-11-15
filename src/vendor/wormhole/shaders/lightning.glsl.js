/**
 * Lightning bolt ribbon. The ribbon is built in JS when a bolt spawns, in 2D
 * screen space (short-side units, centred), so it always faces the camera.
 * aRibbon.x is the signed position across the ribbon (-1..1), aRibbon.y the
 * brightness along it (tapers on branches). Drawn with additive blending:
 * a hot white core with a violet glow falloff across the width.
 */
export const lightningVertexShader = /* glsl */ `
attribute vec2 aRibbon;

uniform vec2 uResolution;

varying vec2 vRibbon;

void main() {
  float unit = min(uResolution.x, uResolution.y);
  vec2 ndc = position.xy * 2.0 * unit / uResolution;
  vRibbon = aRibbon;
  gl_Position = vec4(ndc, 0.0, 1.0);
}
`;

export const lightningFragmentShader = /* glsl */ `
uniform vec3 uCoreColor;
uniform vec3 uGlowColor;
uniform float uAlpha;     // life envelope × flicker × gain

varying vec2 vRibbon;

void main() {
  float x = abs(vRibbon.x);
  // The geometry is 7× wider than the core so the glow has room to fall off.
  float core = 1.0 - smoothstep(0.06, 0.16, x);
  float glow = (1.0 - x) * (1.0 - x);
  glow *= glow;
  float strength = (core * 1.0 + glow * 0.55) * vRibbon.y * uAlpha;
  if (strength < 0.002) discard;
  vec3 color = mix(uGlowColor, uCoreColor, core);
  gl_FragColor = vec4(color, strength);
  #include <colorspace_fragment>
}
`;
