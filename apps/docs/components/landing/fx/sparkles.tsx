"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { prefersReducedMotion } from "@/lib/reduced-motion";

type Particle = { x: number; y: number; r: number; p: number; s: number };

type SparkleState = {
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  parent: HTMLElement;
  parts: Particle[];
  color: string;
  density: number;
  dpr: number;
  w: number;
  h: number;
  raf: number;
  resizeRaf: number;
};

function makeParticle(w: number, h: number): Particle {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    r: Math.random() * 1.3 + 0.3,
    p: Math.random() * Math.PI * 2,
    s: Math.random() * 0.018 + 0.004,
  };
}

function rescaleParticles(parts: Particle[], prevW: number, prevH: number, w: number, h: number) {
  if (parts.length === 0 || prevW <= 0 || prevH <= 0) return;
  const sx = w / prevW;
  const sy = h / prevH;
  for (const o of parts) {
    o.x *= sx;
    o.y *= sy;
  }
}

function fitParticleCount(parts: Particle[], w: number, h: number, density: number) {
  const target = Math.max(18, Math.floor(w * h * density));
  if (parts.length < target) {
    for (let i = parts.length; i < target; i += 1) parts.push(makeParticle(w, h));
  } else if (parts.length > target) {
    parts.length = target;
  }
}

function applySize(state: SparkleState, nextW: number, nextH: number) {
  const prevW = state.w;
  const prevH = state.h;
  state.w = nextW;
  state.h = nextH;
  state.canvas.width = nextW * state.dpr;
  state.canvas.height = nextH * state.dpr;
  state.canvas.style.width = `${nextW}px`;
  state.canvas.style.height = `${nextH}px`;
  state.ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  rescaleParticles(state.parts, prevW, prevH, nextW, nextH);
  fitParticleCount(state.parts, nextW, nextH, state.density);
}

function paintStatic(state: SparkleState) {
  const { ctx, parts, color, w, h } = state;
  ctx.clearRect(0, 0, w, h);
  for (const o of parts) {
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function measure(state: SparkleState, reduce: boolean) {
  const nextW = state.parent.clientWidth;
  const nextH = state.parent.clientHeight;
  if (Math.abs(nextW - state.w) <= 2 && Math.abs(nextH - state.h) <= 2) return;
  applySize(state, nextW, nextH);
  if (reduce) paintStatic(state);
}

function draw(state: SparkleState) {
  const { ctx, parts, color, w, h } = state;
  ctx.clearRect(0, 0, w, h);
  for (const o of parts) {
    o.p += o.s;
    const a = (Math.sin(o.p) + 1) / 2;
    ctx.globalAlpha = a * 0.8;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
    ctx.fill();
  }
  state.raf = requestAnimationFrame(() => draw(state));
}

export function Sparkles({
  density = 0.00018,
  color = "#d8c8f5",
}: {
  density?: number;
  color?: string;
}): ReactNode {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const parent = canvas.parentElement;
    if (!ctx || !parent) return;

    const reduce = prefersReducedMotion();
    const state: SparkleState = {
      ctx,
      canvas,
      parent,
      parts: [],
      color,
      density,
      dpr: Math.min(window.devicePixelRatio || 1, 2),
      w: 0,
      h: 0,
      raf: 0,
      resizeRaf: 0,
    };

    applySize(state, parent.clientWidth, parent.clientHeight);
    if (reduce) {
      paintStatic(state);
    } else {
      draw(state);
    }

    const ro = new ResizeObserver(() => {
      if (state.resizeRaf) return;
      state.resizeRaf = requestAnimationFrame(() => {
        state.resizeRaf = 0;
        measure(state, reduce);
      });
    });
    ro.observe(parent);

    return () => {
      cancelAnimationFrame(state.raf);
      if (state.resizeRaf) cancelAnimationFrame(state.resizeRaf);
      ro.disconnect();
    };
  }, [density, color]);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <canvas ref={ref} className="absolute inset-0" />
    </div>
  );
}
