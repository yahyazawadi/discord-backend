import { useEffect, useRef } from 'react';

export default function FloatingParticles() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const mouseRef = useRef({ x: -1000, y: -1000 });
    const lastMoveTimeRef = useRef(Date.now());

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationId: number;
        let width = (canvas.width = window.innerWidth);
        let height = (canvas.height = window.innerHeight);

        const handleResize = () => {
            if (!canvas) return;
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        };

        const handleMouseMove = (e: MouseEvent) => {
            mouseRef.current.x = e.clientX;
            mouseRef.current.y = e.clientY;
            lastMoveTimeRef.current = Date.now();
        };

        const handleMouseLeave = () => {
            mouseRef.current.x = -1000;
            mouseRef.current.y = -1000;
        };

        window.addEventListener('resize', handleResize);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseleave', handleMouseLeave);

        // Free-flowing velocity-based particle model
        interface Particle {
            x: number;
            y: number;
            vx: number;            // Velocity X
            vy: number;            // Velocity Y
            size: number;          // stroke thickness
            alpha: number;         // opacity
            length: number;        // line length
        }

        const particles: Particle[] = [];
        const maxParticles = 380; // Dense starry field

        const centerX = () => width / 2;
        const centerY = () => height / 2;

        const createParticle = (initRandom = false): Particle => {
            const maxRadius = Math.max(width, height) * 0.7;
            const startDist = initRandom ? Math.random() * maxRadius : Math.random() * 30;
            const angle = Math.random() * Math.PI * 2;

            // Cartesian spawn point
            const x = centerX() + Math.cos(angle) * startDist;
            const y = centerY() + Math.sin(angle) * startDist;

            // Initial vector combining radial expansion and circular orbit velocity
            const speed = 0.3 + Math.random() * 0.7;
            const angularSpeed = 0.0006 + Math.random() * 0.0016;

            const radVelX = speed * Math.cos(angle);
            const radVelY = speed * Math.sin(angle);
            const orbitVelX = -angularSpeed * startDist * Math.sin(angle);
            const orbitVelY = angularSpeed * startDist * Math.cos(angle);

            return {
                x,
                y,
                vx: radVelX + orbitVelX,
                vy: radVelY + orbitVelY,
                size: 1.8 + Math.random() * 2.2,
                alpha: initRandom ? 0.45 + Math.random() * 0.45 : 0.3,
                length: 2 + Math.random() * 5,
            };
        };

        // Initialize particles
        for (let i = 0; i < maxParticles; i++) {
            particles.push(createParticle(true));
        }

        const animate = () => {
            const timeSinceLastMove = Date.now() - lastMoveTimeRef.current;

            // Fades trails when mouse stops moving for 3 seconds
            let clearOpacity = 0.22;
            if (timeSinceLastMove > 3000) {
                const fadeProgress = Math.min((timeSinceLastMove - 3000) / 1000, 1);
                clearOpacity = 0.22 + fadeProgress * 0.58;
            }

            ctx.fillStyle = `rgba(13, 17, 20, ${clearOpacity})`;
            ctx.fillRect(0, 0, width, height);

            particles.forEach((p, index) => {
                // Continuous proximity checks to the current mouse position (regardless of mouse movement state)
                const dx = p.x - mouseRef.current.x;
                const dy = p.y - mouseRef.current.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const repulsionRadius = 130;

                if (distance < repulsionRadius) {
                    // Repulsion force that pushes them permanently off their trajectory
                    const force = (repulsionRadius - distance) / repulsionRadius;
                    const angle = Math.atan2(dy, dx);

                    // Alter the physical velocity vectors!
                    const pushStrength = 0.7;
                    p.vx += Math.cos(angle) * force * pushStrength;
                    p.vy += Math.sin(angle) * force * pushStrength;

                    // Limit speed to prevent chaotic teleportation off screen
                    const currentSpeed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
                    const maxSpeed = 5.0;
                    if (currentSpeed > maxSpeed) {
                        p.vx = (p.vx / currentSpeed) * maxSpeed;
                        p.vy = (p.vy / currentSpeed) * maxSpeed;
                    }

                    p.alpha = Math.min(p.alpha + 0.15, 1.0); // Make them fully radiant when actively pushed
                }

                // Apply physical movements
                p.x += p.vx;
                p.y += p.vy;

                if (p.alpha < 0.85) {
                    p.alpha += 0.015;
                }

                // Check if out of bounds relative to center
                const distFromCenter = Math.sqrt(Math.pow(p.x - centerX(), 2) + Math.pow(p.y - centerY(), 2));
                const maxRadius = Math.max(width, height) * 0.65;

                if (distFromCenter > maxRadius) {
                    p.alpha -= 0.03;
                }

                // Reset if out of bounds or dead
                if (distFromCenter > maxRadius || p.alpha <= 0) {
                    particles[index] = createParticle(false);
                    return;
                }

                // Draw particle line pointing dynamically along its exact velocity vector direction
                ctx.beginPath();
                const velocityMagnitude = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
                const dirX = velocityMagnitude > 0 ? p.vx / velocityMagnitude : 1;
                const dirY = velocityMagnitude > 0 ? p.vy / velocityMagnitude : 0;

                ctx.moveTo(p.x, p.y);
                ctx.lineTo(
                    p.x + dirX * p.length,
                    p.y + dirY * p.length
                );

                // Highly luminous electric emerald green (#2EE59D) for high-impact brightness
                ctx.strokeStyle = `rgba(46, 229, 157, ${p.alpha})`;
                ctx.lineWidth = p.size;
                ctx.lineCap = 'round';
                ctx.stroke();
            });

            animationId = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            window.removeEventListener('resize', handleResize);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseleave', handleMouseLeave);
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
