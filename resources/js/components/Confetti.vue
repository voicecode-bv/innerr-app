<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';

const props = withDefaults(
    defineProps<{
        active?: boolean;
        duration?: number;
        particleCount?: number;
    }>(),
    {
        active: false,
        duration: 4000,
        particleCount: 140,
    },
);

type Particle = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    rotation: number;
    rotationSpeed: number;
    color: string;
    shape: 'rect' | 'circle';
    opacity: number;
};

const COLORS = [
    '#0F766E',
    '#5A8A6E',
    '#E8C77B',
    '#E8A0A0',
    '#F2E2C4',
    '#A7C5A1',
];

const canvasRef = ref<HTMLCanvasElement | null>(null);
const isRunning = ref(false);

let particles: Particle[] = [];
let animationId: number | null = null;
let stopAt = 0;

function spawnParticles(width: number, height: number): Particle[] {
    const result: Particle[] = [];

    for (let i = 0; i < props.particleCount; i++) {
        result.push({
            x: Math.random() * width,
            y: -20 - Math.random() * height * 0.4,
            vx: (Math.random() - 0.5) * 3,
            vy: 2 + Math.random() * 4,
            size: 6 + Math.random() * 8,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.25,
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            shape: Math.random() > 0.7 ? 'circle' : 'rect',
            opacity: 1,
        });
    }

    return result;
}

function step(): void {
    const canvas = canvasRef.value;

    if (!canvas) {
        return;
    }

    const ctx = canvas.getContext('2d');

    if (!ctx) {
        return;
    }

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const now = performance.now();
    const fading = now > stopAt;

    for (const p of particles) {
        p.vy += 0.05;
        p.vx += (Math.random() - 0.5) * 0.1;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;

        if (fading) {
            p.opacity = Math.max(0, p.opacity - 0.02);
        }

        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;

        if (p.shape === 'rect') {
            ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.6);
        } else {
            ctx.beginPath();
            ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    particles = particles.filter((p) => p.opacity > 0 && p.y < height + 40);

    if (particles.length === 0) {
        stop();

        return;
    }

    animationId = requestAnimationFrame(step);
}

function start(): void {
    if (isRunning.value) {
        return;
    }

    const canvas = canvasRef.value;

    if (!canvas) {
        return;
    }

    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    particles = spawnParticles(width, height);
    stopAt = performance.now() + props.duration;
    isRunning.value = true;
    animationId = requestAnimationFrame(step);
}

function stop(): void {
    if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }

    particles = [];
    isRunning.value = false;
}

watch(
    () => props.active,
    (value) => {
        if (value) {
            start();
        }
    },
    { immediate: true },
);

onBeforeUnmount(() => {
    stop();
});
</script>

<template>
    <canvas
        v-show="isRunning"
        ref="canvasRef"
        class="pointer-events-none fixed inset-0 z-[100]"
        aria-hidden="true"
    />
</template>
