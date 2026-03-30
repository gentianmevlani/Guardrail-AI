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

    const gl = canvas.getContext("webgl");
    if (!gl) return;

    // Vertex shader
    const vertexShaderSource = `
      attribute vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    // Fragment shader - warp effect
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
        
        // Create flowing warp effect
        float d = length(p);
        float a = atan(p.y, p.x);
        
        float wave1 = sin(d * 8.0 - t * 2.0 + a * 3.0) * intensity * 0.1;
        float wave2 = sin(d * 4.0 + t * 1.5 - a * 2.0) * intensity * 0.15;
        float wave3 = cos(d * 6.0 - t + a * 4.0) * intensity * 0.08;
        
        float noise = wave1 + wave2 + wave3;
        
        // Color gradient
        vec3 color1 = vec3(0.0, 0.8, 0.9); // Cyan
        vec3 color2 = vec3(0.1, 0.2, 0.8); // Blue
        vec3 color3 = vec3(0.5, 0.0, 0.8); // Purple
        
        float gradient = smoothstep(0.0, 1.0, uv.y + noise);
        vec3 color = mix(color1, color2, gradient);
        color = mix(color, color3, smoothstep(0.3, 0.9, d + noise * 0.5));
        
        // Fade edges
        float vignette = 1.0 - smoothstep(0.5, 1.5, d);
        color *= vignette * 0.15;
        
        // Dark background
        vec3 bg = vec3(0.02, 0.02, 0.05);
        color = mix(bg, color, 0.8);
        
        gl_FragColor = vec4(color, 1.0);
      }
    `;

    // Compile shaders
    const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);

    // Create program
    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);

    // Set up geometry
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

    // Handle resize
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);

    // Set static uniforms
    gl.uniform1f(speedLocation, speed);
    gl.uniform1f(intensityLocation, intensity);

    // Animation loop
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
      className={`absolute inset-0 ${className}`}
      style={{ zIndex: 0 }}
    />
  );
}
