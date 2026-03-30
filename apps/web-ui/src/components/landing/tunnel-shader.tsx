"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

const vertexShader = `
  void main() {
    gl_Position = vec4(position, 1.0);
  }
`;

// Hyperspace Warp Tunnel Shader - scroll-driven speed
const fragmentShader = `
  precision highp float;
  
  uniform vec2 iResolution;
  uniform float iTime;
  uniform float scrollSpeed;

  #define PI 3.14159265359
  #define NUM_LAYERS 6.0

  mat2 rotate(float a) {
    float c = cos(a), s = sin(a);
    return mat2(c, -s, s, c);
  }

  float hash(float n) {
    return fract(sin(n) * 43758.5453123);
  }

  float noise(vec3 x) {
    vec3 p = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    float n = p.x + p.y * 57.0 + 113.0 * p.z;
    return mix(
      mix(mix(hash(n), hash(n + 1.0), f.x),
          mix(hash(n + 57.0), hash(n + 58.0), f.x), f.y),
      mix(mix(hash(n + 113.0), hash(n + 114.0), f.x),
          mix(hash(n + 170.0), hash(n + 171.0), f.x), f.y), f.z);
  }

  float star(vec2 uv, float flare) {
    float d = length(uv);
    float m = 0.02 / d;
    
    float rays = max(0.0, 1.0 - abs(uv.x * uv.y * 1000.0));
    m += rays * flare;
    
    m *= smoothstep(1.0, 0.2, d);
    return m;
  }

  vec3 starLayer(vec2 uv, float t, float scale, float speed) {
    vec3 col = vec3(0.0);
    
    uv *= scale;
    vec2 gv = fract(uv) - 0.5;
    vec2 id = floor(uv);
    
    for(int y = -1; y <= 1; y++) {
      for(int x = -1; x <= 1; x++) {
        vec2 offs = vec2(float(x), float(y));
        float n = hash(dot(id + offs, vec2(12.9898, 78.233)));
        
        if(n > 0.8) {
          float size = fract(n * 345.32);
          vec2 p = gv - offs - vec2(n, fract(n * 34.0)) + 0.5;
          
          // Stars streak based on scroll speed
          float streak = 1.0 + scrollSpeed * 2.0;
          p.y *= streak;
          
          float s = star(p, smoothstep(0.9, 1.0, size) * 0.5);
          
          // Color variation - blue/cyan theme
          vec3 starCol = mix(
            vec3(0.5, 0.7, 1.0),
            vec3(0.8, 0.9, 1.0),
            n
          );
          
          col += s * size * starCol;
        }
      }
    }
    
    return col;
  }

  void main() {
    vec2 fragCoord = gl_FragCoord.xy;
    vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    
    // Tunnel effect - warp toward center
    float angle = atan(uv.y, uv.x);
    float radius = length(uv);
    
    // Speed based on scroll - almost still when not scrolling
    float baseSpeed = 0.02;
    float warpSpeed = baseSpeed + scrollSpeed * 0.5;
    
    // Tunnel depth movement
    float z = iTime * warpSpeed;
    
    // Convert to tunnel coordinates
    vec2 tunnelUV = vec2(angle / PI, 1.0 / (radius + 0.1) - z);
    
    vec3 col = vec3(0.0);
    
    // Multiple star layers at different depths
    for(float i = 0.0; i < NUM_LAYERS; i++) {
      float depth = fract(i / NUM_LAYERS + z * 0.5);
      float scale = mix(20.0, 5.0, depth);
      float fade = depth * smoothstep(1.0, 0.9, depth);
      
      // Slight rotation per layer
      vec2 layerUV = tunnelUV;
      layerUV *= rotate(i * 0.5 + iTime * 0.02);
      
      col += starLayer(layerUV, iTime, scale, warpSpeed) * fade;
    }
    
    // Radial streaks when scrolling fast
    if(scrollSpeed > 0.1) {
      float streaks = 0.0;
      for(float i = 0.0; i < 50.0; i++) {
        float a = hash(i) * PI * 2.0;
        float r = hash(i * 2.0);
        vec2 dir = vec2(cos(a), sin(a));
        
        float d = abs(dot(uv, vec2(-dir.y, dir.x)));
        float streak = smoothstep(0.003, 0.0, d) * smoothstep(0.0, 0.3, dot(uv, dir) - r * 0.5);
        streak *= scrollSpeed * 0.3;
        streaks += streak;
      }
      col += vec3(0.6, 0.8, 1.0) * streaks;
    }
    
    // Vignette
    float vignette = 1.0 - radius * 0.5;
    col *= vignette;
    
    // Subtle blue tint
    col = mix(col, col * vec3(0.8, 0.9, 1.0), 0.3);
    
    // Gamma correction
    col = pow(col, vec3(0.8));
    
    gl_FragColor = vec4(col, 1.0);
  }
`;

interface TunnelShaderProps {
  className?: string;
}

export function TunnelShader({ className = "" }: TunnelShaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollSpeedRef = useRef(0);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const isMobile = window.innerWidth < 768;

    // Three.js setup
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const renderer = new THREE.WebGLRenderer({ 
      canvas, 
      antialias: !isMobile,
      alpha: true 
    });
    
    const pixelRatio = isMobile ? Math.min(window.devicePixelRatio, 1.5) : Math.min(window.devicePixelRatio, 2);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);

    const geometry = new THREE.PlaneGeometry(2, 2);
    const uniforms = {
      iTime: { value: 0 },
      iResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      scrollSpeed: { value: 0 },
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    let animationId: number;
    const startTime = performance.now();
    let lastScrollY = window.scrollY;
    let scrollVelocity = 0;

    const animate = () => {
      // Use real time (in seconds)
      const currentTime = (performance.now() - startTime) * 0.001;
      uniforms.iTime.value = currentTime;
      
      // Calculate scroll velocity for responsive speed
      const currentScrollY = window.scrollY;
      const scrollDelta = Math.abs(currentScrollY - lastScrollY);
      lastScrollY = currentScrollY;
      
      // Smooth velocity - ramps up quickly, decays slowly
      scrollVelocity = scrollVelocity * 0.92 + scrollDelta * 0.15;
      
      // Clamp velocity and use it as scroll speed (0 to ~5)
      const targetSpeed = Math.min(scrollVelocity * 0.1, 5);
      
      // Smooth transition to target speed
      uniforms.scrollSpeed.value += (targetSpeed - uniforms.scrollSpeed.value) * 0.15;
      
      renderer.render(scene, camera);
      animationId = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      renderer.setSize(width, height);
      uniforms.iResolution.value.set(width, height);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 ${className}`}
      style={{ 
        opacity: 0.85,
        zIndex: 0,
        pointerEvents: "none"
      }}
    />
  );
}
