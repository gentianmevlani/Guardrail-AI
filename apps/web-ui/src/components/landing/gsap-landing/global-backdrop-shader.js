// Full-page flow field background — adapted from Shadertoy flow visualization
// Interactive via mouse, parallax via scroll

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
uniform float iScrollY;
uniform vec4 iMouse;
uniform sampler2D iChannel0;

#define SIZE (iResolution.x / 12.0)
#define ZOOM (2.0 * 256.0 / iResolution.x)

float STRIP = 1.0;
float V_ADV = 1.0;
float V_BOIL = 0.5;

vec3 flow(vec2 uv, float t) {
  vec2 iuv = floor(SIZE * uv + 0.5) / SIZE;

  vec2 pos = 0.01 * V_ADV * vec2(
    cos(t) + sin(0.356 * t) + 2.0 * cos(0.124 * t),
    sin(0.854 * t) + cos(0.441 * t) + 2.0 * cos(0.174 * t)
  );

  vec3 tex = 2.0 * texture2D(iChannel0, iuv / (ZOOM * SIZE) - pos).rgb - 1.0;

  float ft = fract(t * V_BOIL) * 3.0;
  vec3 a = tex.rgb;
  vec3 b = vec3(tex.g, tex.b, tex.r);
  vec3 c = vec3(tex.b, tex.r, tex.g);
  if (ft < 1.0) tex = mix(a, b, ft);
  else if (ft < 2.0) tex = mix(b, c, ft - 1.0);
  else tex = mix(c, a, ft - 2.0);

  // flow mode: rotate vectors 90 degrees
  return vec3(tex.y, -tex.x, tex.z);
}

void main() {
  float t = iTime;
  vec2 uv = gl_FragCoord.xy / iResolution.y;

  // parallax scroll offset
  uv.y += iScrollY * 0.8;

  // mouse warp — pull flow field toward cursor
  float presence = iMouse.z;
  vec2 mouseUV = iMouse.xy / iResolution.y;
  vec2 diff = uv - mouseUV;
  float md = length(diff);
  uv -= diff * presence * 0.12 * exp(-md * md * 8.0);

  vec2 iuv = floor(SIZE * uv + 0.5) / SIZE;
  vec2 fuv = 2.0 * SIZE * (uv - iuv);
  vec3 tex = flow(uv, t);
  float v = fuv.x * tex.x + fuv.y * tex.y;
  v = sin(STRIP * v);
  float lineVal = clamp(1.0 - v * v * min(SIZE, 40.0), 0.0, 1.0);
  vec3 col = vec3(lineVal) * (mix(tex, vec3(1.0), 0.5) * 0.5 + 0.5);

  // color grade: dark base with accent tints
  vec3 dark = vec3(0.02, 0.02, 0.04);
  vec3 mid = vec3(0.05, 0.12, 0.22);
  vec3 accent = vec3(0.82, 1.0, 0.34);

  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  vec3 graded = mix(dark, mid, smoothstep(0.15, 0.5, lum));
  graded = mix(graded, accent * 0.2, smoothstep(0.6, 0.9, lum) * 0.4);
  // keep some of the original hue for variety
  graded = mix(graded, col * vec3(0.08, 0.14, 0.22), 0.3);

  // cursor glow
  float glow = presence * 0.3 * exp(-md * md * 6.0);
  graded += accent * 0.15 * glow;

  // vignette
  vec2 vuv = gl_FragCoord.xy / iResolution.xy;
  float vig = 1.0 - 0.4 * length(vuv - 0.5);
  graded *= vig;

  // overall brightness — keep it subtle as a background
  graded *= 0.85;

  gl_FragColor = vec4(graded, 1.0);
}
`;

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  console.warn("Global shader compile error:", gl.getShaderInfoLog(shader));
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
  console.warn("Global program link error:", gl.getProgramInfoLog(program));
  gl.deleteProgram(program);
  return null;
}

// Generate a tileable noise texture for the flow field
function createNoiseTexture(gl, size) {
  const data = new Uint8Array(size * size * 4);
  // integer hash for deterministic pseudo-random RGB
  const ihash = (x, y, seed) => {
    let h = (x * 374761393 + y * 668265263 + seed * 1274126177) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return (h ^ (h >>> 16)) & 0xFF;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      data[i]     = ihash(x, y, 0);
      data[i + 1] = ihash(x, y, 1);
      data[i + 2] = ihash(x, y, 2);
      data[i + 3] = 255;
    }
  }
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  return tex;
}

export function initGlobalBackdropShader({ prefersReducedMotion = false } = {}) {
  const canvas = document.createElement("canvas");
  canvas.className = "global-backdrop-canvas";
  canvas.setAttribute("aria-hidden", "true");
  document.body.prepend(canvas);

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
  console.log("[global-shader] program:", !!program);
  if (!program) {
    canvas.remove();
    return null;
  }

  const positionAttr = gl.getAttribLocation(program, "aPosition");
  const uTime = gl.getUniformLocation(program, "iTime");
  const uResolution = gl.getUniformLocation(program, "iResolution");
  const uScrollY = gl.getUniformLocation(program, "iScrollY");
  const uMouse = gl.getUniformLocation(program, "iMouse");
  const uChannel0 = gl.getUniformLocation(program, "iChannel0");

  const vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  gl.useProgram(program);
  gl.enableVertexAttribArray(positionAttr);
  gl.vertexAttribPointer(positionAttr, 2, gl.FLOAT, false, 0, 0);

  // noise texture for flow sampling
  const noiseTex = createNoiseTexture(gl, 256);

  let rafId = 0;
  let isDisposed = false;
  let width = 0;
  let height = 0;
  let scrollY = 0;
  let targetMouseX = 0;
  let targetMouseY = 0;
  let smoothMouseX = 0;
  let smoothMouseY = 0;
  let mousePresence = 0;
  let smoothPresence = 0;
  const startTime = performance.now();
  const LERP_SPEED = 0.1;

  const docHeight = () => document.documentElement.scrollHeight - window.innerHeight || 1;
  const handleScroll = () => { scrollY = window.scrollY / docHeight(); };

  const updateTarget = (clientX, clientY) => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    targetMouseX = clientX * dpr;
    targetMouseY = (window.innerHeight - clientY) * dpr;
    mousePresence = 1;
  };

  const handleMouseMove = (e) => { updateTarget(e.clientX, e.clientY); };
  const handleMouseLeave = () => { mousePresence = 0; };

  const handleTouchMove = (e) => {
    const t = e.touches[0];
    if (!t) return;
    updateTarget(t.clientX, t.clientY);
  };

  const handleTouchEnd = () => { mousePresence = 0; };

  const lerpMouse = () => {
    smoothMouseX += (targetMouseX - smoothMouseX) * LERP_SPEED;
    smoothMouseY += (targetMouseY - smoothMouseY) * LERP_SPEED;
    smoothPresence += (mousePresence - smoothPresence) * LERP_SPEED;
  };

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const nextWidth = Math.max(1, Math.round(window.innerWidth * dpr));
    const nextHeight = Math.max(1, Math.round(window.innerHeight * dpr));
    if (nextWidth === width && nextHeight === height) return;
    width = nextWidth;
    height = nextHeight;
    canvas.width = nextWidth;
    canvas.height = nextHeight;
    gl.viewport(0, 0, nextWidth, nextHeight);
  };

  const draw = (now) => {
    if (isDisposed) return;
    resize();
    lerpMouse();
    const t = prefersReducedMotion ? 0 : (now - startTime) / 1000;

    gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, noiseTex);
    gl.uniform1i(uChannel0, 0);
    gl.uniform1f(uTime, t);
    gl.uniform3f(uResolution, width, height, 1);
    gl.uniform1f(uScrollY, scrollY);
    gl.uniform4f(uMouse, smoothMouseX, smoothMouseY, smoothPresence, 0);
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

  // seed smooth mouse to center
  const initDpr = Math.min(window.devicePixelRatio || 1, 1.5);
  smoothMouseX = targetMouseX = (window.innerWidth / 2) * initDpr;
  smoothMouseY = targetMouseY = (window.innerHeight / 2) * initDpr;

  window.addEventListener("resize", restart);
  window.addEventListener("scroll", handleScroll, { passive: true });
  window.addEventListener("mousemove", handleMouseMove, { passive: true });
  window.addEventListener("mouseleave", handleMouseLeave);
  window.addEventListener("touchmove", handleTouchMove, { passive: true });
  window.addEventListener("touchend", handleTouchEnd);
  document.addEventListener("visibilitychange", handleVisibilityChange);

  draw(startTime);
  if (!prefersReducedMotion) {
    rafId = window.requestAnimationFrame(renderFrame);
  }

  return () => {
    isDisposed = true;
    window.cancelAnimationFrame(rafId);
    window.removeEventListener("resize", restart);
    window.removeEventListener("scroll", handleScroll);
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseleave", handleMouseLeave);
    window.removeEventListener("touchmove", handleTouchMove);
    window.removeEventListener("touchend", handleTouchEnd);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    gl.deleteTexture(noiseTex);
    gl.deleteBuffer(vertexBuffer);
    gl.deleteProgram(program);
    canvas.remove();
  };
}
