import { useEffect } from "react";

export function useOrbCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  speaking: boolean
) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId = 0;
    let running = true;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const cx = w / 2;
      const cy = h / 2;
      const radius = Math.min(w, h) * 0.22;

      const pulse = 0.05 + 0.05 * Math.sin(t * 0.003);
      const gradient = ctx.createRadialGradient(
        cx,
        cy,
        radius * 0.3,
        cx,
        cy,
        radius * (1.3 + pulse)
      );
      gradient.addColorStop(0, "rgba(99, 179, 237, 0.65)");
      gradient.addColorStop(1, "rgba(99, 179, 237, 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * (1.25 + pulse), 0, Math.PI * 2);
      ctx.fill();

      const coreGrad = ctx.createRadialGradient(
        cx - radius * 0.2,
        cy - radius * 0.2,
        radius * 0.1,
        cx,
        cy,
        radius
      );
      coreGrad.addColorStop(0, "#b3e0ff");
      coreGrad.addColorStop(1, "#63b3ed");
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      const beams = 24;
      const baseAngle = (t * 0.0008) % (Math.PI * 2);
      for (let i = 0; i < beams; i++) {
        const angle = baseAngle + (i / beams) * Math.PI * 2;
        const len = radius * (1.0 + (speaking ? 1.2 : 0.2) * Math.abs(Math.sin(t * 0.005 + i)));
        const alpha = speaking ? 0.35 : 0.12;
        ctx.strokeStyle = `rgba(99,179,237,${alpha})`;
        ctx.lineWidth = Math.max(1, radius * 0.03);
        ctx.beginPath();
        ctx.moveTo(
          cx + Math.cos(angle) * (radius * 0.95),
          cy + Math.sin(angle) * (radius * 0.95)
        );
        ctx.lineTo(
          cx + Math.cos(angle) * (radius * 0.95 + len * 0.45),
          cy + Math.sin(angle) * (radius * 0.95 + len * 0.45)
        );
        ctx.stroke();
      }

      if (running) animationId = requestAnimationFrame(draw);
    };

    const onResize = () => {
      resize();
    };

    window.addEventListener("resize", onResize);
    resize();
    animationId = requestAnimationFrame(draw);

    return () => {
      running = false;
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", onResize);
    };
  }, [canvasRef, speaking]);
}


