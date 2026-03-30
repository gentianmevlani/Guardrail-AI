"use client";

import { useEffect, useRef } from "react";
import { logger } from "@/lib/logger";

const vertexShaderSource = `
  precision mediump float;
  varying vec2 vUv;
  attribute vec2 a_position;

  void main() {
    vUv = .5 * (a_position + 1.);
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const fragmentShaderSource = `
  precision mediump float;

  varying vec2 vUv;
  uniform float u_time;
  uniform float u_ratio;
  uniform vec2 u_pointer_position;
  uniform float u_scroll_progress;

  vec2 rotate(vec2 uv, float th) {
    return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;
  }

  float neuro_shape(vec2 uv, float t, float p) {
    vec2 sine_acc = vec2(0.);
    vec2 res = vec2(0.);
    float scale = 8.;

    for (int j = 0; j < 15; j++) {
      uv = rotate(uv, 1.);
      sine_acc = rotate(sine_acc, 1.);
      vec2 layer = uv * scale + float(j) + sine_acc - t;
      sine_acc += sin(layer) + 2.4 * p;
      res += (.5 + .5 * cos(layer)) / scale;
      scale *= (1.2);
    }
    return res.x + res.y;
  }

  void main() {
    vec2 uv = .5 * vUv;
    uv.x *= u_ratio;

    vec2 pointer = vUv - u_pointer_position;
    pointer.x *= u_ratio;
    float p = clamp(length(pointer), 0., 1.);
    p = .5 * pow(1. - p, 2.);

    float t = .001 * u_time;
    vec3 color = vec3(0.);

    float noise = neuro_shape(uv, t, p);

    noise = 1.2 * pow(noise, 3.);
    noise += pow(noise, 10.);
    noise = max(.0, noise - .5);
    noise *= (1. - length(vUv - .5));

    color = normalize(vec3(.2, .5 + .4 * cos(3. * u_scroll_progress), .5 + .5 * sin(3. * u_scroll_progress)));

    color = color * noise;

    gl_FragColor = vec4(color, noise);
  }
`;

export function NeuroNoiseBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef({ x: 0, y: 0, tX: 0, tY: 0 });
  const uniformsRef = useRef<Record<string, WebGLUniformLocation | null>>({});
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const devicePixelRatio = Math.min(window.devicePixelRatio, 2);

    function createShader(
      gl: WebGLRenderingContext,
      sourceCode: string,
      type: number,
    ) {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, sourceCode);
      gl.compileShader(shader);

      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        logger.error("Shader compile error", {
          shaderInfoLog: gl.getShaderInfoLog(shader) || 'No info log available',
          component: 'NeuroNoiseBackground'
        });
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    function createShaderProgram(
      gl: WebGLRenderingContext,
      vertexShader: WebGLShader,
      fragmentShader: WebGLShader,
    ) {
      const program = gl.createProgram();
      if (!program) return null;
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        logger.error("Program link error", {
          programInfoLog: gl.getProgramInfoLog(program) || 'No info log available',
          component: 'NeuroNoiseBackground'
        });
        return null;
      }
      return program;
    }

    function getUniforms(gl: WebGLRenderingContext, program: WebGLProgram) {
      const uniforms: Record<string, WebGLUniformLocation | null> = {};
      const uniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < uniformCount; i++) {
        const uniformInfo = gl.getActiveUniform(program, i);
        if (uniformInfo) {
          uniforms[uniformInfo.name] = gl.getUniformLocation(
            program,
            uniformInfo.name,
          );
        }
      }
      return uniforms;
    }

    const gl =
      canvas.getContext("webgl") ||
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext);
    if (!gl) {
      logger.error("WebGL not supported", {
        component: 'NeuroNoiseBackground',
        userAgent: navigator.userAgent
      });
      return;
    }
    glRef.current = gl;

    const vertexShader = createShader(gl, vertexShaderSource, gl.VERTEX_SHADER);
    const fragmentShader = createShader(
      gl,
      fragmentShaderSource,
      gl.FRAGMENT_SHADER,
    );

    if (!vertexShader || !fragmentShader) return;

    const shaderProgram = createShaderProgram(gl, vertexShader, fragmentShader);
    if (!shaderProgram) return;

    uniformsRef.current = getUniforms(gl, shaderProgram);

    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    gl.useProgram(shaderProgram);

    const positionLocation = gl.getAttribLocation(shaderProgram, "a_position");
    gl.enableVertexAttribArray(positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    function resizeCanvas() {
      if (!canvas || !gl) return;
      canvas.width = canvas.offsetWidth * devicePixelRatio;
      canvas.height = canvas.offsetHeight * devicePixelRatio;
      if (uniformsRef.current.u_ratio) {
        gl.uniform1f(uniformsRef.current.u_ratio, canvas.width / canvas.height);
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
    }

    function render() {
      if (!gl) return;
      const currentTime = performance.now();
      const pointer = pointerRef.current;

      pointer.x += (pointer.tX - pointer.x) * 0.2;
      pointer.y += (pointer.tY - pointer.y) * 0.2;

      const uniforms = uniformsRef.current;
      if (uniforms.u_time) gl.uniform1f(uniforms.u_time, currentTime);
      if (uniforms.u_pointer_position && canvas) {
        gl.uniform2f(
          uniforms.u_pointer_position,
          pointer.x / canvas.offsetWidth,
          1 - pointer.y / canvas.offsetHeight,
        );
      }
      if (uniforms.u_scroll_progress) {
        gl.uniform1f(
          uniforms.u_scroll_progress,
          window.scrollY / (2 * window.innerHeight),
        );
      }

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      animationRef.current = requestAnimationFrame(render);
    }

    function handlePointerMove(e: PointerEvent | MouseEvent) {
      pointerRef.current.tX = e.clientX;
      pointerRef.current.tY = e.clientY;
    }

    function handleTouchMove(e: TouchEvent) {
      if (e.targetTouches[0]) {
        pointerRef.current.tX = e.targetTouches[0].clientX;
        pointerRef.current.tY = e.targetTouches[0].clientY;
      }
    }

    resizeCanvas();
    render();

    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("touchmove", handleTouchMove);
    window.addEventListener("click", handlePointerMove);

    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("click", handlePointerMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none opacity-95"
      style={{ zIndex: 0 }}
    />
  );
}
