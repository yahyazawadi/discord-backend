import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { colors } from '../../utils/colors';

export default function FloatingParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000, isActive: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Entrance animation using GSAP
    gsap.fromTo(
      canvas,
      { opacity: 0 },
      { opacity: 1, duration: 1.5, ease: 'power2.out' }
    );

    let animationId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      initParticles();
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
      mouseRef.current.isActive = true;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        mouseRef.current.x = e.touches[0].clientX;
        mouseRef.current.y = e.touches[0].clientY;
        mouseRef.current.isActive = true;
      }
    };

    const handleMouseLeave = () => {
      mouseRef.current.x = -1000;
      mouseRef.current.y = -1000;
      mouseRef.current.isActive = false;
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleMouseLeave);

    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      homeX: number;
      homeY: number;
      angle: number;
      speed: number;
      size: number;
      alpha: number;
      baseAlpha: number;
    }

    let particles: Particle[] = [];
    const maxParticles = 90; // Lightweight particle count for clean presentation

    const initParticles = () => {
      particles = [];
      for (let i = 0; i < maxParticles; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const alpha = 0.15 + Math.random() * 0.3;
        particles.push({
          x,
          y,
          vx: 0,
          vy: 0,
          homeX: x,
          homeY: y,
          angle: Math.random() * Math.PI * 2,
          speed: 0.15 + Math.random() * 0.3,
          size: 1.2 + Math.random() * 1.8,
          alpha,
          baseAlpha: alpha,
        });
      }
    };

    initParticles();

    // Hex to RGB parser for primary color
    const primaryHex = colors.primary;
    let r = 13, g = 135, b = 96;
    if (primaryHex && primaryHex.startsWith('#')) {
      const hex = primaryHex.slice(1);
      if (hex.length === 6) {
        r = parseInt(hex.slice(0, 2), 16);
        g = parseInt(hex.slice(2, 4), 16);
        b = parseInt(hex.slice(4, 6), 16);
      }
    }

    const animate = () => {
      // Clear canvas with a solid background representing dark mode (#0D1114)
      ctx.fillStyle = '#0D1114';
      ctx.fillRect(0, 0, width, height);

      // 1. Draw subtle connection lines between close particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const p1 = particles[i];
          const p2 = particles[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 75) {
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            const lineAlpha = (1 - dist / 75) * 0.05 * Math.min(p1.alpha, p2.alpha);
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${lineAlpha})`;
            ctx.lineWidth = 0.55;
            ctx.stroke();
          }
        }
      }

      // 2. Update and draw each particle
      particles.forEach((p) => {
        // Slow float drift of home coordinates to keep background alive
        p.angle += 0.003;
        p.homeX += Math.cos(p.angle) * p.speed;
        p.homeY += Math.sin(p.angle) * p.speed;

        // Wrap home positions if they drift completely off-screen
        if (p.homeX < -20) p.homeX = width + 20;
        if (p.homeX > width + 20) p.homeX = -20;
        if (p.homeY < -20) p.homeY = height + 20;
        if (p.homeY > height + 20) p.homeY = -20;

        // Calculate interaction with pointer
        const dx = mouseRef.current.x - p.x;
        const dy = mouseRef.current.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const attractionRadius = 280;

        if (mouseRef.current.isActive && dist < attractionRadius) {
          const force = (attractionRadius - dist) / attractionRadius;
          p.vx += (dx / dist) * force * 0.65;
          p.vy += (dy / dist) * force * 0.65;
          p.alpha = Math.min(p.alpha + 0.04, 0.7);
        } else {
          p.alpha += (p.baseAlpha - p.alpha) * 0.04;
        }

        // Return-to-home elastic spring force
        const homeDx = p.homeX - p.x;
        const homeDy = p.homeY - p.y;
        p.vx += homeDx * 0.02;
        p.vy += homeDy * 0.02;

        // Apply friction/damping
        p.vx *= 0.88;
        p.vy *= 0.88;

        p.x += p.vx;
        p.y += p.vy;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${p.alpha})`;
        ctx.fill();
      });

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseLeave);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
        display: 'block',
      }}
    />
  );
}
