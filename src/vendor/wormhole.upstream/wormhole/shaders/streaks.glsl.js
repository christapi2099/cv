import { calmGLSL } from './noise.glsl.js';

/**
 * Star streaks rushing past the viewer.
 *
 * Every point's depth is mod(seed * range - offset, range): points recycle
 * forever with no CPU work. Positions use the same perspective and swirl as
 * the tunnel shader, so streaks ride the walls instead of floating over them.
 */
export const streaksVertexShader = /* glsl */ `
attribute vec3 aSeed;       // x: angle (rad), y: radius factor, z: depth seed [0,1)

uniform vec2 uResolution;
uniform vec2 uCenter;
uniform float uTime;
uniform float uOffset;
uniform float uDepthScale;
uniform float uTwist;
uniform float uSpin;
uniform float uRange;       // depth range points recycle through
uniform float uNear;        // nearest depth
uniform float uPixelRatio;
uniform float uCalm;

varying float vAlpha;
varying float vNear;
varying float vTint;
varying vec2 vDir;

${calmGLSL}

void main() {
  float depth = mod(aSeed.z * uRange - uOffset, uRange) + uNear;
  float angle = aSeed.x - depth * uTwist - uTime * uSpin;
  vec2 dir = vec2(cos(angle), sin(angle));

  // Same short-side normalisation as the tunnel shader.
  vec2 p = dir * (uDepthScale * aSeed.y / depth) + uCenter;
  float unit = min(uResolution.x, uResolution.y);
  vec2 ndc = p * 2.0 * unit / uResolution;
  gl_Position = vec4(ndc, 0.0, 1.0);

  float far = uNear + uRange;
  float near = 1.0 - smoothstep(uNear, far * 0.5, depth); // 1 = close to viewer
  gl_PointSize = clamp((1.5 + 22.0 * near * near) * uPixelRatio, 1.0, 64.0);

  // Fade in from the far end (hides recycling); dim inside the calm zone.
  vAlpha = (1.0 - smoothstep(far * 0.55, far, depth)) * calmMask(ndc, uResolution, uCalm);
  vNear = near;
  vTint = fract(aSeed.x * 7.31);
  vDir = dir;
}
`;

export const streaksFragmentShader = /* glsl */ `
uniform vec3 uStar;
uniform vec3 uFilament;
uniform float uIntensity;

varying float vAlpha;
varying float vNear;
varying float vTint;
varying vec2 vDir;

void main() {
  // Rotate the sprite into the streak's radial frame and draw a stretched Gaussian.
  vec2 c = gl_PointCoord - 0.5;
  c.y = -c.y;
  float along = dot(c, vDir);
  float across = dot(c, vec2(-vDir.y, vDir.x));
  float stretch = mix(70.0, 24.0, vNear);
  float shape = exp(-across * across * 220.0 - along * along * stretch);
  // Fade before the square sprite's edge so no streak is visibly clipped.
  shape *= 1.0 - smoothstep(0.4, 0.5, max(abs(c.x), abs(c.y)));

  float alpha = shape * vAlpha * uIntensity;
  if (alpha < 0.004) discard;

  vec3 color = mix(uStar, uFilament, step(0.82, vTint));
  gl_FragColor = vec4(color, alpha);
  #include <colorspace_fragment>
}
`;
