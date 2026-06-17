'use client';
import { useRef, useEffect, useState, forwardRef, useImperativeHandle, useCallback } from 'react';

export interface SignaturePadRef {
  clear: () => void;
  getDataUrl: () => string | null;
  isEmpty: () => boolean;
}

interface Props {
  height?: number;
  strokeColor?: string;
  onChange?: (dataUrl: string | null) => void;
}

export const SignaturePad = forwardRef<SignaturePadRef, Props>(
  ({ height = 200, strokeColor = '#1e3a8a', onChange }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing   = useRef(false);
    const [empty, setEmpty] = useState(true);

    // Resize canvas to match CSS size × devicePixelRatio
    const resize = useCallback(() => {
      const c = canvasRef.current;
      if (!c) return;
      const dpr  = window.devicePixelRatio || 1;
      const w    = c.clientWidth;
      const h    = c.clientHeight;
      // Save current drawing
      const prev = c.toDataURL();
      c.width  = w * dpr;
      c.height = h * dpr;
      const ctx = c.getContext('2d')!;
      ctx.scale(dpr, dpr);
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth   = 2.5;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';
      // Restore
      if (!empty) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, w, h);
        img.src = prev;
      }
    }, [empty, strokeColor]);

    useEffect(() => {
      resize();
      window.addEventListener('resize', resize);
      return () => window.removeEventListener('resize', resize);
    }, [resize]);

    const getXY = (e: MouseEvent | Touch): [number, number] => {
      const c    = canvasRef.current!;
      const rect = c.getBoundingClientRect();
      return [e.clientX - rect.left, e.clientY - rect.top];
    };

    const startStroke = (x: number, y: number) => {
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;
      drawing.current = true;
      ctx.beginPath();
      ctx.moveTo(x, y);
    };

    const continueStroke = (x: number, y: number) => {
      if (!drawing.current) return;
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;
      ctx.lineTo(x, y);
      ctx.stroke();
      if (empty) setEmpty(false);
      onChange?.(canvasRef.current!.toDataURL('image/png'));
    };

    const endStroke = () => { drawing.current = false; };

    // Mouse
    const onMouseDown = (e: React.MouseEvent) => {
      const [x, y] = getXY(e.nativeEvent);
      startStroke(x, y);
    };
    const onMouseMove = (e: React.MouseEvent) => {
      const [x, y] = getXY(e.nativeEvent);
      continueStroke(x, y);
    };

    // Touch — must be non-passive to call preventDefault
    useEffect(() => {
      const c = canvasRef.current;
      if (!c) return;
      const onTouchStart = (e: TouchEvent) => {
        e.preventDefault();
        const [x, y] = getXY(e.touches[0]);
        startStroke(x, y);
      };
      const onTouchMove = (e: TouchEvent) => {
        e.preventDefault();
        const [x, y] = getXY(e.touches[0]);
        continueStroke(x, y);
      };
      const onTouchEnd = () => endStroke();
      c.addEventListener('touchstart', onTouchStart, { passive: false });
      c.addEventListener('touchmove',  onTouchMove,  { passive: false });
      c.addEventListener('touchend',   onTouchEnd);
      return () => {
        c.removeEventListener('touchstart', onTouchStart);
        c.removeEventListener('touchmove',  onTouchMove);
        c.removeEventListener('touchend',   onTouchEnd);
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useImperativeHandle(ref, () => ({
      clear: () => {
        const c   = canvasRef.current;
        const ctx = c?.getContext('2d');
        if (!c || !ctx) return;
        ctx.clearRect(0, 0, c.width, c.height);
        setEmpty(true);
        onChange?.(null);
      },
      getDataUrl: () => {
        if (empty) return null;
        return canvasRef.current?.toDataURL('image/png') ?? null;
      },
      isEmpty: () => empty,
    }));

    return (
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height,
          touchAction: 'none',
          cursor: 'crosshair',
          display: 'block',
        }}
        className="rounded-xl border-2 border-dashed border-slate-300 bg-white"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={endStroke}
        onMouseLeave={endStroke}
      />
    );
  }
);

SignaturePad.displayName = 'SignaturePad';
