"use client";

import { useEffect, useRef } from "react";

interface WarpBackgroundProps {
  className?: string;
  speed?: number;
  intensity?: number;
}

export function WarpBackground({
  className = "",
  speed = 0.3,
  intensity = 0.8,
}: WarpBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", { alpha: true });
    if (!gl) {
      console.warn("[WarpBackground] WebGL not available");
      return;
    }

    // Vertex shader
    const vertexShaderSource = `
      attribute vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    // Fragment shader — animated flowing warp
    const fragmentShaderSource = `
      precision highp float;
      uniform float time;
      uniform vec2 resolution;
      uniform float speed;
      uniform float intensity;

      void main() {
        vec2 uv = gl_FragCoord.xy / resolution.xy;
        vec2 p = uv * 2.0 - 1.0;
        p.x *= resolution.x / resolution.y;

        float t = time * speed;

        float d = length(p);
        float a = atan(p.y, p.x);

        float wave1 = sin(d * 8.0 - t * 2.0 + a * 3.0) * intensity * 0.1;
        float wave2 = sin(d * 4.0 + t * 1.5 - a * 2.0) * intensity * 0.15;
        float wave3 = cos(d * 6.0 - t + a * 4.0) * intensity * 0.08;

        float noise = wave1 + wave2 + wave3;

        // Teal / cyan palette (matches brand)
        vec3 color1 = vec3(0.0, 0.85, 0.75);  // Teal
        vec3 color2 = vec3(0.05, 0.25, 0.65);  // Deep blue
        vec3 color3 = vec3(0.1, 0.55, 0.7);    // Cyan

        float gradient = smoothstep(0.0, 1.0, uv.y + noise);
        vec3 color = mix(color1, color2, gradient);
        color = mix(color, color3, smoothstep(0.3, 0.9, d + noise * 0.5));

        // Vignette — softer falloff, brighter center
        float vignette = 1.0 - smoothstep(0.4, 1.8, d);
        color *= vignette * 0.35;

        // Blend with dark background
        vec3 bg = vec3(0.0, 0.02, 0.04);
        color = mix(bg, color, 0.85);

        gl_FragColor = vec4(color, 1.0);
      }
    `;

    // Compile helper with error checking
    function compileShader(type: number, source: string) {
      const shader = gl!.createShader(type);
      if (!shader) return null;
      gl!.shaderSource(shader, source);
      gl!.compileShader(shader);
      if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) {
        console.error("[WarpBackground] Shader error:", gl!.getShaderInfoLog(shader));
        gl!.deleteShader(shader);
        return null;
      }
      return shader;
    }

    const vertexShader = compileShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("[WarpBackground] Program link error:", gl.getProgramInfoLog(program));
      return;
    }

    gl.useProgram(program);

    // Full-screen quad
    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Uniforms
    const timeLocation = gl.getUniformLocation(program, "time");
    const resolutionLocation = gl.getUniformLocation(program, "resolution");
    const speedLocation = gl.getUniformLocation(program, "speed");
    const intensityLocation = gl.getUniformLocation(program, "intensity");

    // Size canvas to its container, not the window
    const resize = () => {
      const parent = canvas.parentElement;
      const w = parent ? parent.clientWidth : window.innerWidth;
      const h = parent ? parent.clientHeight : window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);

    gl.uniform1f(speedLocation, speed);
    gl.uniform1f(intensityLocation, intensity);

    const startTime = Date.now();
    const render = () => {
      const time = (Date.now() - startTime) / 1000;
      gl.uniform1f(timeLocation, time);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      animationRef.current = requestAnimationFrame(render);
    };
    render();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationRef.current);
    };
  }, [speed, intensity]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 h-full w-full ${className}`}
      style={{ zIndex: 0 }}
    />
  );
}
