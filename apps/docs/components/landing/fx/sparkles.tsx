"use client";

import { type ReactNode, useEffect, useRef } from "react";

// Lightweight twinkling canvas particle field. Renders nothing meaningful on the server
// (the canvas is empty until JS draws), so it is loaded via next/dynamic ssr:false. The
// rAF loop runs once for the canvas lifetime; the ResizeObserver is rAF-coalesced and only
// rebuilds when the box changes beyond a small threshold, preserving particle positions and
// phases so the field never visibly reseeds. Under prefers-reduced-motion it paints one
// static frame.
type Particle = { x: number; y: number; r: number; p: number; s: number };

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

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let raf = 0;
    let resizeRaf = 0;
    const parts: Particle[] = [];
    let w = 0;
    let h = 0;

    function makeParticle(): Particle {
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.3 + 0.3,
        p: Math.random() * Math.PI * 2,
        s: Math.random() * 0.018 + 0.004,
      };
    }

    // Rescale existing particle positions into the new box so the field shifts with the
    // resize instead of clumping.
    function rescaleParticles(prevW: number, prevH: number) {
      if (parts.length === 0 || prevW <= 0 || prevH <= 0) return;
      const sx = w / prevW;
      const sy = h / prevH;
      for (const o of parts) {
        o.x *= sx;
        o.y *= sy;
      }
    }

    // Add or trim only the difference to the target count, preserving every kept particle's
    // x/y/phase so the twinkle never visibly reseeds during normal play.
    function fitParticleCount() {
      const target = Math.max(18, Math.floor(w * h * density));
      if (parts.length < target) {
        for (let i = parts.length; i < target; i += 1) parts.push(makeParticle());
      } else if (parts.length > target) {
        parts.length = target;
      }
    }

    // Resize the backing store while preserving the existing field.
    function applySize(nextW: number, nextH: number) {
      if (!ctx || !canvas) return;
      const prevW = w;
      const prevH = h;
      w = nextW;
      h = nextH;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      rescaleParticles(prevW, prevH);
      fitParticleCount();
    }

    // Only rebuild when the box actually changed beyond a small threshold; pure re-fires
    // at the same size (the hero terminal typing reflows the section) must not touch particles.
    function measure() {
      if (!parent) return;
      const nextW = parent.clientWidth;
      const nextH = parent.clientHeight;
      if (Math.abs(nextW - w) <= 2 && Math.abs(nextH - h) <= 2) return;
      applySize(nextW, nextH);
      if (reduce) paintStatic();
    }

    function draw() {
      if (!ctx) return;
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
      raf = requestAnimationFrame(draw);
    }

    function paintStatic() {
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      for (const o of parts) {
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    applySize(parent.clientWidth, parent.clientHeight);
    if (reduce) {
      paintStatic();
    } else {
      // One continuous loop for the canvas lifetime; never restarted on resize.
      draw();
    }

    // Coalesce a burst of height changes into a single measure on the next frame.
    const ro = new ResizeObserver(() => {
      if (resizeRaf) return;
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = 0;
        measure();
      });
    });
    ro.observe(parent);

    return () => {
      cancelAnimationFrame(raf);
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      ro.disconnect();
    };
  }, [density, color]);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <canvas ref={ref} className="absolute inset-0" />
    </div>
  );
}
