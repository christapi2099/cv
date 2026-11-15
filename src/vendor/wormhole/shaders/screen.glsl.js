/**
 * CRT screen of the purple computer: samples a CanvasTexture drawn once
 * (green prompt + scanlines), adds a blinking block cursor (uniform-driven,
 * 0.9 Hz: well under 2 Hz), a curved-glass vignette and a lightning glint.
 * Unlit and bright, so it reads as emissive.
 */
export const screenVertexShader = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const screenFragmentShader = /* glsl */ `
uniform sampler2D uMap;
uniform vec4 uCursor;     // uv rect: x0, y0, x1, y1
uniform float uTime;
uniform float uFlash;
uniform vec3 uPhosphor;
uniform vec3 uGlint;

varying vec2 vUv;

void main() {
  vec3 color = texture2D(uMap, vUv).rgb;
  float blink = step(0.5, fract(uTime * 0.9));
  float inCursor = step(uCursor.x, vUv.x) * step(vUv.x, uCursor.z) * step(uCursor.y, vUv.y) * step(vUv.y, uCursor.w);
  color += uPhosphor * inCursor * blink;

  vec2 c = vUv - 0.5;
  float vignette = 1.0 - smoothstep(0.25, 0.75, length(c * vec2(1.0, 1.25)));
  color *= mix(0.35, 1.25, vignette);
  // Glass reflection: a soft diagonal sheen, brighter during a flash.
  float sheen = smoothstep(0.12, 0.0, abs(c.x + c.y * 0.6 - 0.18));
  color += uGlint * (0.025 + 0.6 * uFlash) * sheen + uGlint * uFlash * 0.15;
  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}
`;
