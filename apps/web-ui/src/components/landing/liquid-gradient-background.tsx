'use client';

import { useEffect, useRef, useState } from 'react';
import {
    Clock,
    Mesh,
    PerspectiveCamera,
    PlaneGeometry,
    Scene,
    ShaderMaterial,
    Texture,
    Vector2,
    Vector3,
    WebGLRenderer
} from 'three';

interface LiquidGradientBackgroundProps {
  className?: string;
  colorScheme?: 'blue' | 'green' | 'purple' | 'orange' | 'cyan';
}

const colorSchemes = {
  blue: {
    color1: [0.2, 0.4, 1.0],
    color2: [0.02, 0.02, 0.08],
    color3: [0.1, 0.2, 0.6],
    color4: [0.02, 0.02, 0.08],
    color5: [0.15, 0.3, 0.8],
    color6: [0.02, 0.02, 0.08],
    darkNavy: [0.02, 0.02, 0.08],
  },
  green: {
    color1: [0.1, 0.8, 0.4],
    color2: [0.02, 0.08, 0.04],
    color3: [0.05, 0.5, 0.3],
    color4: [0.02, 0.08, 0.04],
    color5: [0.15, 0.7, 0.35],
    color6: [0.02, 0.08, 0.04],
    darkNavy: [0.02, 0.06, 0.04],
  },
  purple: {
    color1: [0.6, 0.2, 1.0],
    color2: [0.05, 0.02, 0.08],
    color3: [0.4, 0.1, 0.7],
    color4: [0.05, 0.02, 0.08],
    color5: [0.5, 0.15, 0.85],
    color6: [0.05, 0.02, 0.08],
    darkNavy: [0.04, 0.02, 0.08],
  },
  orange: {
    color1: [1.0, 0.5, 0.1],
    color2: [0.08, 0.04, 0.02],
    color3: [0.8, 0.3, 0.05],
    color4: [0.08, 0.04, 0.02],
    color5: [0.9, 0.4, 0.15],
    color6: [0.08, 0.04, 0.02],
    darkNavy: [0.06, 0.03, 0.02],
  },
  cyan: {
    color1: [0.1, 0.8, 0.9],
    color2: [0.02, 0.06, 0.08],
    color3: [0.05, 0.6, 0.7],
    color4: [0.02, 0.06, 0.08],
    color5: [0.15, 0.7, 0.85],
    color6: [0.02, 0.06, 0.08],
    darkNavy: [0.02, 0.05, 0.07],
  },
};

export function LiquidGradientBackground({ className = '', colorScheme = 'blue' }: LiquidGradientBackgroundProps) {
  const colors = colorSchemes[colorScheme];
  const containerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const [webglSupported, setWebglSupported] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
      setWebglSupported(false);
      return;
    }
    
    class TouchTexture {
      size: number;
      width: number;
      height: number;
      maxAge: number;
      radius: number;
      speed: number;
      trail: Array<{ x: number; y: number; age: number; force: number; vx: number; vy: number }>;
      last: { x: number; y: number } | null;
      canvas: HTMLCanvasElement;
      ctx: CanvasRenderingContext2D;
      texture: Texture;

      constructor() {
        this.size = 64;
        this.width = this.height = this.size;
        this.maxAge = 64;
        this.radius = 0.25 * this.size;
        this.speed = 1 / this.maxAge;
        this.trail = [];
        this.last = null;
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.ctx = this.canvas.getContext('2d')!;
        this.ctx.fillStyle = 'black';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.texture = new Texture(this.canvas);
      }

      update() {
        this.ctx.fillStyle = 'black';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        for (let i = this.trail.length - 1; i >= 0; i--) {
          const point = this.trail[i];
          const f = point.force * this.speed * (1 - point.age / this.maxAge);
          point.x += point.vx * f;
          point.y += point.vy * f;
          point.age++;
          if (point.age > this.maxAge) {
            this.trail.splice(i, 1);
          } else {
            this.drawPoint(point);
          }
        }
        this.texture.needsUpdate = true;
      }

      addTouch(point: { x: number; y: number }) {
        let force = 0;
        let vx = 0;
        let vy = 0;
        if (this.last) {
          const dx = point.x - this.last.x;
          const dy = point.y - this.last.y;
          if (dx === 0 && dy === 0) return;
          const dd = dx * dx + dy * dy;
          const d = Math.sqrt(dd);
          vx = dx / d;
          vy = dy / d;
          force = Math.min(dd * 20000, 2.0);
        }
        this.last = { x: point.x, y: point.y };
        this.trail.push({ x: point.x, y: point.y, age: 0, force, vx, vy });
      }

      drawPoint(point: { x: number; y: number; age: number; force: number; vx: number; vy: number }) {
        const pos = {
          x: point.x * this.width,
          y: (1 - point.y) * this.height
        };

        let intensity = 1;
        if (point.age < this.maxAge * 0.3) {
          intensity = Math.sin((point.age / (this.maxAge * 0.3)) * (Math.PI / 2));
        } else {
          const t = 1 - (point.age - this.maxAge * 0.3) / (this.maxAge * 0.7);
          intensity = -t * (t - 2);
        }
        intensity *= point.force;

        const color = `${((point.vx + 1) / 2) * 255}, ${((point.vy + 1) / 2) * 255}, ${intensity * 255}`;
        const offset = this.size * 5;
        this.ctx.shadowOffsetX = offset;
        this.ctx.shadowOffsetY = offset;
        this.ctx.shadowBlur = this.radius;
        this.ctx.shadowColor = `rgba(${color},${0.2 * intensity})`;

        this.ctx.beginPath();
        this.ctx.fillStyle = 'rgba(255,0,0,1)';
        this.ctx.arc(pos.x - offset, pos.y - offset, this.radius, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }

    const renderer = new WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    
    const width = container.clientWidth;
    const height = container.clientHeight;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const camera = new PerspectiveCamera(45, width / height, 0.1, 10000);
    camera.position.z = 50;

    const scene = new Scene();
    const clock = new Clock();
    const touchTexture = new TouchTexture();

    const getViewSize = () => {
      const fovInRadians = (camera.fov * Math.PI) / 180;
      const h = Math.abs(camera.position.z * Math.tan(fovInRadians / 2) * 2);
      return { width: h * camera.aspect, height: h };
    };

    const viewSize = getViewSize();
    const geometry = new PlaneGeometry(viewSize.width, viewSize.height, 1, 1);

    const uniforms = {
      uTime: { value: 0 },
      uResolution: { value: new Vector2(width, height) },
      uColor1: { value: new Vector3(colors.color1[0], colors.color1[1], colors.color1[2]) },
      uColor2: { value: new Vector3(colors.color2[0], colors.color2[1], colors.color2[2]) },
      uColor3: { value: new Vector3(colors.color3[0], colors.color3[1], colors.color3[2]) },
      uColor4: { value: new Vector3(colors.color4[0], colors.color4[1], colors.color4[2]) },
      uColor5: { value: new Vector3(colors.color5[0], colors.color5[1], colors.color5[2]) },
      uColor6: { value: new Vector3(colors.color6[0], colors.color6[1], colors.color6[2]) },
      uSpeed: { value: 0.8 },
      uIntensity: { value: 1.2 },
      uTouchTexture: { value: touchTexture.texture },
      uGrainIntensity: { value: 0.04 },
      uDarkNavy: { value: new Vector3(colors.darkNavy[0], colors.darkNavy[1], colors.darkNavy[2]) },
      uGradientSize: { value: 0.5 },
      uGradientCount: { value: 12.0 },
      uColor1Weight: { value: 0.6 },
      uColor2Weight: { value: 1.5 }
    };

    const material = new ShaderMaterial({
      uniforms,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          vUv = uv;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec2 uResolution;
        uniform vec3 uColor1;
        uniform vec3 uColor2;
        uniform vec3 uColor3;
        uniform vec3 uColor4;
        uniform vec3 uColor5;
        uniform vec3 uColor6;
        uniform float uSpeed;
        uniform float uIntensity;
        uniform sampler2D uTouchTexture;
        uniform float uGrainIntensity;
        uniform vec3 uDarkNavy;
        uniform float uGradientSize;
        uniform float uGradientCount;
        uniform float uColor1Weight;
        uniform float uColor2Weight;
        
        varying vec2 vUv;
        
        float grain(vec2 uv, float time) {
          vec2 grainUv = uv * uResolution * 0.5;
          float grainValue = fract(sin(dot(grainUv + time, vec2(12.9898, 78.233))) * 43758.5453);
          return grainValue * 2.0 - 1.0;
        }
        
        vec3 getGradientColor(vec2 uv, float time) {
          float gradientRadius = uGradientSize;
          
          vec2 center1 = vec2(0.5 + sin(time * uSpeed * 0.4) * 0.4, 0.5 + cos(time * uSpeed * 0.5) * 0.4);
          vec2 center2 = vec2(0.5 + cos(time * uSpeed * 0.6) * 0.5, 0.5 + sin(time * uSpeed * 0.45) * 0.5);
          vec2 center3 = vec2(0.5 + sin(time * uSpeed * 0.35) * 0.45, 0.5 + cos(time * uSpeed * 0.55) * 0.45);
          vec2 center4 = vec2(0.5 + cos(time * uSpeed * 0.5) * 0.4, 0.5 + sin(time * uSpeed * 0.4) * 0.4);
          vec2 center5 = vec2(0.5 + sin(time * uSpeed * 0.7) * 0.35, 0.5 + cos(time * uSpeed * 0.6) * 0.35);
          vec2 center6 = vec2(0.5 + cos(time * uSpeed * 0.45) * 0.5, 0.5 + sin(time * uSpeed * 0.65) * 0.5);
          
          float dist1 = length(uv - center1);
          float dist2 = length(uv - center2);
          float dist3 = length(uv - center3);
          float dist4 = length(uv - center4);
          float dist5 = length(uv - center5);
          float dist6 = length(uv - center6);
          
          float influence1 = 1.0 - smoothstep(0.0, gradientRadius, dist1);
          float influence2 = 1.0 - smoothstep(0.0, gradientRadius, dist2);
          float influence3 = 1.0 - smoothstep(0.0, gradientRadius, dist3);
          float influence4 = 1.0 - smoothstep(0.0, gradientRadius, dist4);
          float influence5 = 1.0 - smoothstep(0.0, gradientRadius, dist5);
          float influence6 = 1.0 - smoothstep(0.0, gradientRadius, dist6);
          
          vec2 rotatedUv1 = uv - 0.5;
          float angle1 = time * uSpeed * 0.15;
          rotatedUv1 = vec2(
            rotatedUv1.x * cos(angle1) - rotatedUv1.y * sin(angle1),
            rotatedUv1.x * sin(angle1) + rotatedUv1.y * cos(angle1)
          );
          rotatedUv1 += 0.5;
          
          float radialGradient1 = length(rotatedUv1 - 0.5);
          float radialInfluence1 = 1.0 - smoothstep(0.0, 0.8, radialGradient1);
          
          vec3 color = vec3(0.0);
          color += uColor1 * influence1 * (0.55 + 0.45 * sin(time * uSpeed)) * uColor1Weight;
          color += uColor2 * influence2 * (0.55 + 0.45 * cos(time * uSpeed * 1.2)) * uColor2Weight;
          color += uColor3 * influence3 * (0.55 + 0.45 * sin(time * uSpeed * 0.8)) * uColor1Weight;
          color += uColor4 * influence4 * (0.55 + 0.45 * cos(time * uSpeed * 1.3)) * uColor2Weight;
          color += uColor5 * influence5 * (0.55 + 0.45 * sin(time * uSpeed * 1.1)) * uColor1Weight;
          color += uColor6 * influence6 * (0.55 + 0.45 * cos(time * uSpeed * 0.9)) * uColor2Weight;
          
          color += mix(uColor1, uColor3, radialInfluence1) * 0.3 * uColor1Weight;
          
          color = clamp(color, vec3(0.0), vec3(1.0)) * uIntensity;
          
          float luminance = dot(color, vec3(0.299, 0.587, 0.114));
          color = mix(vec3(luminance), color, 1.35);
          color = pow(color, vec3(0.92));
          
          float brightness1 = length(color);
          float mixFactor1 = max(brightness1 * 1.2, 0.15);
          color = mix(uDarkNavy, color, mixFactor1);
          
          return color;
        }
        
        void main() {
          vec2 uv = vUv;
          
          vec4 touchTex = texture2D(uTouchTexture, uv);
          float vx = -(touchTex.r * 2.0 - 1.0);
          float vy = -(touchTex.g * 2.0 - 1.0);
          float intensity = touchTex.b;
          uv.x += vx * 0.5 * intensity;
          uv.y += vy * 0.5 * intensity;
          
          vec2 center = vec2(0.5);
          float dist = length(uv - center);
          float ripple = sin(dist * 20.0 - uTime * 3.0) * 0.03 * intensity;
          uv += vec2(ripple);
          
          vec3 color = getGradientColor(uv, uTime);
          
          float grainValue = grain(uv, uTime);
          color += grainValue * uGrainIntensity;
          
          float brightness2 = length(color);
          float mixFactor2 = max(brightness2 * 1.2, 0.15);
          color = mix(uDarkNavy, color, mixFactor2);
          
          color = clamp(color, vec3(0.0), vec3(1.0));
          
          gl_FragColor = vec4(color, 1.0);
        }
      `
    });

    const mesh = new Mesh(geometry, material);
    scene.add(mesh);

    let mouse = { x: 0, y: 0 };
    
    const handleMouseMove = (ev: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouse = {
        x: (ev.clientX - rect.left) / rect.width,
        y: 1 - (ev.clientY - rect.top) / rect.height
      };
      touchTexture.addTouch(mouse);
    };

    const handleTouchMove = (ev: TouchEvent) => {
      const touch = ev.touches[0];
      const rect = container.getBoundingClientRect();
      mouse = {
        x: (touch.clientX - rect.left) / rect.width,
        y: 1 - (touch.clientY - rect.top) / rect.height
      };
      touchTexture.addTouch(mouse);
    };

    const handleResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      uniforms.uResolution.value.set(w, h);
      
      const newViewSize = getViewSize();
      mesh.geometry.dispose();
      mesh.geometry = new PlaneGeometry(newViewSize.width, newViewSize.height, 1, 1);
    };

    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.1);
      uniforms.uTime.value += delta;
      touchTexture.update();
      renderer.render(scene, camera);
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('resize', handleResize);
    
    animate();

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('resize', handleResize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [colors]);

  if (!webglSupported) {
    return (
      <div
        className={`absolute inset-0 ${className}`}
        style={{
          zIndex: 0,
          background: 'radial-gradient(ellipse at 30% 40%, rgba(59, 130, 246, 0.15) 0%, transparent 50%), radial-gradient(ellipse at 70% 60%, rgba(37, 99, 235, 0.1) 0%, transparent 50%), linear-gradient(to bottom, #0a0a0f, #050510)'
        }}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 ${className}`}
      style={{ zIndex: 0 }}
    />
  );
}
