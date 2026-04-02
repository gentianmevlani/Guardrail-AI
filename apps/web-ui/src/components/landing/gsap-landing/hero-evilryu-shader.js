/**
 * Hero section WebGL background — raymarched tunnel adapted from Shadertoy
 * (evilryu). Original uses iChannel0/iChannel1; we use procedural noise.
 * License: CC BY-NC-SA 3.0 (Shadertoy default for that upload).
 */

const vertexShaderSource = `
attribute vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const fragmentShaderSource = `
precision highp float;

uniform float iTime;
uniform vec3 iResolution;
uniform float iMotion;
uniform vec2 iParallax;
uniform float iScrollFade;

#define PI 3.1415926535898

float matid = 0.0;
float tdist = 0.0;

float n11(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float n13(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
}

float texcube(vec3 p, vec3 n) {
  float x = n13(p.yzx * 3.7);
  float y = n13(p.zxy * 3.7);
  float z = n13(p.xyz * 3.7);
  return x * abs(n.x) + y * abs(n.y) + z * abs(n.z);
}

float box(vec3 p, vec3 b) {
  vec3 d = abs(p) - b;
  return min(max(d.x, max(d.y, d.z)), 0.0) + length(max(d, 0.0));
}

float infi_box(vec3 p, vec2 b) {
  vec2 d = abs(p.xy) - b;
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

vec3 path(float p) {
  return vec3(sin(p * 0.05) * cos(p * 0.025) * 18.0, 0.0, 0.0);
}

float cylinder(vec3 p, vec2 h) {
  vec3 q = vec3(p.x, p.z, p.y);
  vec2 d = abs(vec2(length(q.xz), q.y)) - h;
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

vec2 map(vec3 pos) {
  vec3 p = pos - path(pos.z);
  float d = 2.0 - length(p.xy);
  float d0 = length(vec3(p.x, -0.5, p.z) - p);
  float d1 = length(vec3(p.x, 1.2, p.z) - p);
  float d2 = cylinder(vec3(abs(p.x) - 1.6, p.y - 1.15, mod(p.z, 2.0) - 1.0), vec2(0.06, 0.2));
  float d3 = infi_box(vec3(abs(p.x) - 1.8, p.y + 0.5, p.z), vec2(0.5, 0.03));
  float d4 = infi_box(vec3(abs(p.x) - 1.3, p.y + 0.5, p.z), vec2(0.015, 0.04));
  float d5 = box(vec3(abs(p.x) - 1.99, p.y + 0.2, mod(p.z, 8.0) - 4.0), vec3(0.02, 0.02, 0.02));

  matid = 0.0;
  if (d0 < d) { d = d0; matid = 1.0; }
  if (d1 < d) { d = d1; matid = 2.0; }
  if (d2 < d) { d = d2; matid = 3.0; }
  if (d3 < d) { d = d3; matid = 1.0; }
  if (d4 < d) { d = d4; matid = 1.0; }
  if (d5 < d) { d = d5; matid = 4.0; }

  return vec2(d, matid);
}

vec3 get_normal(vec3 p) {
  const vec2 e = vec2(0.002, 0.0);
  return normalize(vec3(
    map(p + e.xyy).x - map(p - e.xyy).x,
    map(p + e.yxy).x - map(p - e.yxy).x,
    map(p + e.yyx).x - map(p - e.yyx).x
  ));
}

float get_ao(vec3 p, vec3 n) {
  float r = 0.0;
  float w = 1.0;
  for (float i = 1.0; i < 5.0 + 1.1; i += 1.0) {
    float di = i / 5.0;
    r += w * (di - map(p + n * di).x);
    w *= 0.5;
  }
  return 1.0 - clamp(r, 0.0, 1.0);
}

float intersect(vec3 ro, vec3 rd) {
  vec2 res = vec2(100.0, 0.0);
  float t = 0.01;
  for (int i = 0; i < 128; i++) {
    vec3 p = ro + rd * t;
    res = map(p);
    if (res.x < 0.005 * t || res.x > 20.0) break;
    t += res.x;
    tdist = t;
  }
  if (res.x > 20.0) {
    t = -1.0;
  }
  return t;
}

vec3 lighting(vec3 rd, vec3 ro, vec3 lp0, vec3 pos, vec3 n, float mid) {
  vec3 p = pos - path(pos.z);
  float r = sqrt(p.x * p.x + p.y * p.y);
  float a = atan(p.y, p.x);
  vec2 uv = vec2(p.z * 0.1, a * 0.1);

  vec3 mate = vec3(1.0);

  if (mid < 0.9) {
    mate = (0.35 + 3.5 * pow(p.y, 5.0)) * vec3(n11(uv * 50.0 + iTime * 0.02));
  } else if (mid < 2.9) {
    mate = 0.5 * vec3(texcube(p * 2.0, n));
  } else if (mid < 3.9) {
    mate = 10.0 * vec3(0.7, 0.8, 1.2);
  } else if (mid < 4.9) {
    mate = 10.0 * vec3(1.0, 1.0, 0.1);
  }

  if (p.y < 0.5) {
    mate += (1.0 - smoothstep(0.05, 0.06, abs(abs(p.x) - 1.1))) * vec3(1.0);
    mate = mix(mate, vec3(1.0),
      floor(fract(p.z * 0.5) + 0.5) * (1.0 - smoothstep(0.04, 0.05, abs(p.x) - 0.001)));
  }

  if (mid > 1.9 && mid < 2.9) {
    mate += 0.5 * smoothstep(0.8, 1.5, abs(p.x));
  }

  vec3 ld0 = normalize(lp0 - pos);
  float dif = max(0.0, dot(n, ld0));
  float spe = max(0.0, pow(clamp(dot(ld0, reflect(rd, n)), 0.0, 1.0), 20.0));
  float ao = get_ao(pos, n);
  vec3 lin = 4.0 * vec3(0.1, 0.5, 1.0) * dif * ao * ao;
  lin += 2.5 * vec3(1.0) * spe;
  lin = lin * 0.2 * mate;

  return lin;
}

vec3 shade(vec3 ro, vec3 rd, vec3 l0_pos) {
  vec3 col = rd;
  float res = intersect(ro, rd);
  if (res > -0.5) {
    vec3 pos = ro + rd * res;
    vec3 n = get_normal(pos);
    vec2 m = map(pos);
    col = lighting(rd, ro, l0_pos, pos, n, m.y);
  }
  return col;
}

void main() {
  vec2 fragCoord = gl_FragCoord.xy;
  vec2 uv = (fragCoord - iResolution.xy * 0.5) / iResolution.xy;
  uv.x *= iResolution.x / iResolution.y;

  float parallaxAmt = 0.16 * iMotion;
  uv += iParallax * parallaxAmt;

  float velocity = 8.0 * iMotion;
  float fov = PI / 3.0;

  float timeShift = dot(iParallax, vec2(0.22, -0.16)) * iMotion;
  float tCam = iTime + timeShift * 0.35;

  vec3 look_at = vec3(0.0, 0.0, tCam * velocity);
  vec3 ro = look_at + vec3(0.0, 0.0, -0.5);
  ro.xy += iParallax * vec2(0.14, 0.11) * iMotion;
  vec3 l0_pos = ro + vec3(0.0, 0.0, 2.0);

  look_at += path(look_at.z);
  ro += path(ro.z);
  l0_pos += path(l0_pos.z);

  vec3 forward = normalize(look_at - ro);
  vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(right, forward);

  vec3 rd = normalize(uv.x * right + uv.y * up + fov * forward);

  tdist = 0.0;
  vec3 col = shade(ro, rd, l0_pos);
  col = mix(col, 0.15 * vec3(0.4, 0.75, 1.0), 1.0 - exp(-0.002 * tdist * tdist));

  vec2 uvScreen = fragCoord.xy / iResolution.xy;
  vec2 vigCenter = vec2(0.5) + iParallax * 0.035 * iMotion;
  float vigDist = length(uvScreen - vigCenter);
  float vignette = smoothstep(0.92, 0.28, vigDist * 1.75);
  vignette = mix(0.52, 1.0, vignette);
  col *= vignette;

  vec3 fadeBg = vec3(0.02, 0.025, 0.045);
  col = mix(fadeBg, col, iScrollFade);

  gl_FragColor = vec4(col, 1.0);
}
`;

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  console.warn("[hero-evilryu] compile:", gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);
  return null;
}

function createProgram(gl, vertexSource, fragmentSource) {
  const vs = createShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  if (!vs || !fs) {
    if (vs) gl.deleteShader(vs);
    if (fs) gl.deleteShader(fs);
    return null;
  }
  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return null;
  }
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (gl.getProgramParameter(program, gl.LINK_STATUS)) return program;
  console.warn("[hero-evilryu] link:", gl.getProgramInfoLog(program));
  gl.deleteProgram(program);
  return null;
}

/**
 * @param {{ prefersReducedMotion?: boolean }} opts
 */
export function initHeroEvilryuShader({ prefersReducedMotion = false } = {}) {
  const backdrop = document.querySelector(".hero-backdrop");
  if (!backdrop) {
    console.warn("[hero-evilryu] .hero-backdrop not found");
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.className = "hero-backdrop-canvas";
  canvas.setAttribute("aria-hidden", "true");
  backdrop.appendChild(canvas);

  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    powerPreference: "high-performance"
  });

  if (!gl) {
    canvas.remove();
    return null;
  }

  const program = createProgram(gl, vertexShaderSource, fragmentShaderSource);
  if (!program) {
    canvas.remove();
    return null;
  }

  const positionAttr = gl.getAttribLocation(program, "aPosition");
  const uTime = gl.getUniformLocation(program, "iTime");
  const uResolution = gl.getUniformLocation(program, "iResolution");
  const uMotion = gl.getUniformLocation(program, "iMotion");
  const uParallax = gl.getUniformLocation(program, "iParallax");
  const uScrollFade = gl.getUniformLocation(program, "iScrollFade");

  const vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  gl.useProgram(program);
  gl.enableVertexAttribArray(positionAttr);
  gl.vertexAttribPointer(positionAttr, 2, gl.FLOAT, false, 0, 0);

  let rafId = 0;
  let isDisposed = false;
  let width = 0;
  let height = 0;
  const startTime = performance.now();

  const heroPanel = backdrop.closest(".hero-panel");
  const targetParallax = { x: 0, y: 0 };
  const smoothParallax = { x: 0, y: 0 };
  const PARALLAX_LERP = 0.07;

  const updateParallaxFromClient = (clientX, clientY) => {
    const rect = backdrop.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    const nx = ((clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -(((clientY - rect.top) / rect.height) * 2 - 1);
    targetParallax.x = Math.max(-1, Math.min(1, nx));
    targetParallax.y = Math.max(-1, Math.min(1, ny));
  };

  const resetParallaxTarget = () => {
    targetParallax.x = 0;
    targetParallax.y = 0;
  };

  const handleWindowPointerMove = (e) => {
    const panel = heroPanel;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    if (
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom
    ) {
      updateParallaxFromClient(e.clientX, e.clientY);
    } else {
      resetParallaxTarget();
    }
  };

  const getScrollFade = () => {
    if (!heroPanel) return 1;
    const rect = heroPanel.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    const visible = Math.min(rect.bottom, vh) - Math.max(rect.top, 0);
    const frac = Math.max(0, visible) / Math.max(rect.height, 1);
    return frac * frac;
  };

  const resize = () => {
    const rect = backdrop.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const nextWidth = Math.max(1, Math.round(rect.width * dpr));
    const nextHeight = Math.max(1, Math.round(rect.height * dpr));
    if (nextWidth === width && nextHeight === height) return;
    width = nextWidth;
    height = nextHeight;
    canvas.width = nextWidth;
    canvas.height = nextHeight;
    gl.viewport(0, 0, nextWidth, nextHeight);
  };

  const ro = new ResizeObserver(() => {
    resize();
    draw(performance.now());
  });
  ro.observe(backdrop);

  const draw = (now) => {
    if (isDisposed) return;
    resize();
    const t = prefersReducedMotion ? 0 : (now - startTime) / 1000;
    const motion = prefersReducedMotion ? 0 : 1;

    smoothParallax.x += (targetParallax.x - smoothParallax.x) * PARALLAX_LERP;
    smoothParallax.y += (targetParallax.y - smoothParallax.y) * PARALLAX_LERP;

    const px = prefersReducedMotion ? 0 : smoothParallax.x;
    const py = prefersReducedMotion ? 0 : smoothParallax.y;
    const scrollFade = prefersReducedMotion ? 1 : getScrollFade();

    gl.useProgram(program);
    gl.uniform1f(uTime, t);
    gl.uniform3f(uResolution, width, height, 1);
    gl.uniform1f(uMotion, motion);
    gl.uniform2f(uParallax, px, py);
    gl.uniform1f(uScrollFade, scrollFade);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  const renderFrame = (now) => {
    draw(now);
    if (!prefersReducedMotion && document.visibilityState === "visible") {
      rafId = window.requestAnimationFrame(renderFrame);
    }
  };

  const restart = () => {
    if (prefersReducedMotion || document.visibilityState !== "visible") {
      draw(performance.now());
      return;
    }
    window.cancelAnimationFrame(rafId);
    rafId = window.requestAnimationFrame(renderFrame);
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState !== "visible") {
      window.cancelAnimationFrame(rafId);
      return;
    }
    restart();
  };

  window.addEventListener("resize", restart);
  window.addEventListener("scroll", restart, { passive: true });
  window.addEventListener("pointermove", handleWindowPointerMove, { passive: true });
  document.addEventListener("visibilitychange", handleVisibilityChange);

  draw(startTime);
  if (!prefersReducedMotion) {
    rafId = window.requestAnimationFrame(renderFrame);
  }

  return () => {
    isDisposed = true;
    window.cancelAnimationFrame(rafId);
    ro.disconnect();
    window.removeEventListener("resize", restart);
    window.removeEventListener("scroll", restart);
    window.removeEventListener("pointermove", handleWindowPointerMove);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    gl.deleteBuffer(vertexBuffer);
    gl.deleteProgram(program);
    canvas.remove();
  };
}
