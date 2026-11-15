/**
 * Fake-extruded 3D title. One InstancedMesh of a plane: instance 0 is the
 * front face, instances 1..n-1 are thin slices stacked behind it along -z,
 * all sampling the same canvas alpha mask (one texture, one geometry, one
 * draw call). Opaque with alpha test, so slices depth-sort for free.
 *
 * Front face: brushed steel (vertical gradient + anisotropic streaks) with a
 * bevel highlight from the mask's alpha gradient used as a normal. Slices are
 * darker steel. uFlash adds a violet rim light from behind. uReveal dissolves
 * the title with a noise threshold (0 = gone, 1 = solid).
 */
export const logoVertexShader = /* glsl */ `
uniform float uLayers;

varying vec2 vUv;
varying float vLayer;

void main() {
  vUv = uv;
  vLayer = float(gl_InstanceID) / max(uLayers - 1.0, 1.0);
  vec4 local = vec4(position, 1.0);
  #ifdef USE_INSTANCING
    local = instanceMatrix * local;
  #endif
  gl_Position = projectionMatrix * modelViewMatrix * local;
}
`;

export const logoFragmentShader = /* glsl */ `
uniform sampler2D uMask;
uniform vec2 uTexel;       // 1 / mask size
uniform float uAspect;     // mask width / height (keeps the dissolve grain round)
uniform float uReveal;
uniform float uFlash;
uniform float uTime;
uniform vec3 uSteel;
uniform vec3 uSteelDark;
uniform vec3 uRim;

varying vec2 vUv;
varying float vLayer;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
             mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
}

void main() {
  float alpha = texture2D(uMask, vUv).a;
  if (alpha < 0.5) discard;

  // Dissolve: the same noise for every slice, so whole columns crumble away.
  vec2 g = vUv * vec2(uAspect, 1.0) * 7.0;
  float grain = valueNoise(g) * 0.55 + valueNoise(g * 2.3 + 7.1) * 0.3 + valueNoise(g * 5.1 + 3.7) * 0.15;
  float threshold = 1.0 - uReveal;
  if (grain < threshold) discard;
  float ember = 1.0 - smoothstep(0.0, 0.06, grain - threshold);

  // Alpha gradient (wide stencil) = bevel normal.
  vec2 o = uTexel * 3.0;
  float ax = texture2D(uMask, vUv + vec2(o.x, 0.0)).a - texture2D(uMask, vUv - vec2(o.x, 0.0)).a;
  float ay = texture2D(uMask, vUv + vec2(0.0, o.y)).a - texture2D(uMask, vUv - vec2(0.0, o.y)).a;
  float edge = clamp(length(vec2(ax, ay)) * 1.6, 0.0, 1.0);
  vec3 normal = normalize(vec3(-ax, -ay, 0.45));
  vec3 lightDir = normalize(vec3(-0.35, 0.75, 0.55));
  float diffuse = max(dot(normal, lightDir), 0.0);
  vec3 halfVec = normalize(lightDir + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(dot(normal, halfVec), 0.0), 28.0);

  // Brushed steel: horizontal streaks (anisotropic), vertical gradient.
  float streak = valueNoise(vec2(vUv.x * 6.0, vUv.y * 420.0)) * 0.6 + valueNoise(vec2(vUv.x * 40.0, vUv.y * 900.0)) * 0.4;
  float gradient = mix(0.45, 1.15, smoothstep(0.0, 1.0, vUv.y));
  float sheen = 0.5 + 0.5 * sin(vUv.x * 5.0 - uTime * 0.6);
  vec3 front = uSteel * gradient * (0.78 + 0.32 * streak) * (0.45 + 0.55 * diffuse);
  front += vec3(1.0) * (spec * 0.7 + edge * diffuse * 0.35) + uSteel * sheen * 0.08;

  vec3 side = uSteelDark * (1.0 - 0.55 * vLayer) * (0.8 + 0.2 * streak);
  vec3 color = vLayer < 0.001 ? front : side;

  // Rim light from behind: strongest on the slices and on the bevel.
  float rim = uFlash * (0.25 + edge * 1.2 + vLayer * 0.9);
  color += uRim * rim;
  color += uRim * ember * 1.4 * uReveal; // glowing dissolve edge
  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}
`;
