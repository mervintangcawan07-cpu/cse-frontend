// Relative Path: src/components/social/whiteboard/LiveWhiteboard.tsx
"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export interface DrawPoint {
  x: number; // Normalized coordinate (0.0 to 1.0)
  y: number; // Normalized coordinate (0.0 to 1.0)
}

export interface DrawDelta {
  points: DrawPoint[];
  color: string;
  width: number;
  isEraser?: boolean;
}

interface LiveWhiteboardProps {
  isHost?: boolean;
  canDraw?: boolean;
  onDrawDelta?: (delta: DrawDelta) => void;
  onClearBoard?: () => void;
  incomingDelta?: DrawDelta | null;
  incomingDeltasBatch?: DrawDelta[] | null;
  incomingClearSignal?: number;
}

export default function LiveWhiteboard({
  isHost = false,
  canDraw = true,
  onDrawDelta,
  onClearBoard,
  incomingDelta,
  incomingDeltasBatch,
  incomingClearSignal,
}: LiveWhiteboardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState("#3b82f6");
  const [lineWidth, setLineWidth] = useState(3);
  const [isEraser, setIsEraser] = useState(false);

  // Persistent stroke history for lossless canvas resizing & late-join sync
  const allDeltasRef = useRef<DrawDelta[]>([]);
  const currentPointsRef = useRef<DrawPoint[]>([]);

  // Helper function to render a single stroke delta onto canvas context
  const renderSingleDelta = useCallback((ctx: CanvasRenderingContext2D, delta: DrawDelta, canvasWidth: number, canvasHeight: number) => {
    if (!delta || !delta.points || delta.points.length === 0) return;

    if (delta.isEraser) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = delta.width || 24;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = delta.color || "#3b82f6";
      ctx.lineWidth = delta.width || 3;
    }

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    delta.points.forEach((pt, idx) => {
      const localX = pt.x * canvasWidth;
      const localY = pt.y * canvasHeight;

      if (idx === 0) {
        ctx.moveTo(localX, localY);
        // Draw single dot if only 1 point
        if (delta.points.length === 1) {
          ctx.lineTo(localX + 0.1, localY + 0.1);
        }
      } else {
        ctx.lineTo(localX, localY);
      }
    });
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
  }, []);

  // Redraw all cumulative strokes on canvas resize or batch updates
  const redrawAll = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const delta of allDeltasRef.current) {
      renderSingleDelta(ctx, delta, canvas.width, canvas.height);
    }
  }, [renderSingleDelta]);

  // Auto-resize canvas on mount and window resize without losing drawings
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const newWidth = Math.max(container.clientWidth, 320);
      const newHeight = Math.max(container.clientHeight, 360);

      // Only update if dimensions actually changed
      if (canvas.width !== newWidth || canvas.height !== newHeight) {
        canvas.width = newWidth;
        canvas.height = newHeight;
        redrawAll();
      }
    };

    handleResize();
    const timeout = setTimeout(handleResize, 100);
    window.addEventListener("resize", handleResize);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener("resize", handleResize);
    };
  }, [redrawAll]);

  // Listen for remote clear board signal
  useEffect(() => {
    if (!incomingClearSignal) return;
    allDeltasRef.current = [];
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [incomingClearSignal]);

  // Render incoming batch strokes (e.g. from server initial load / catch-up)
  useEffect(() => {
    if (!incomingDeltasBatch) return;

    allDeltasRef.current = [...incomingDeltasBatch];
    redrawAll();
  }, [incomingDeltasBatch, redrawAll]);

  // Render incoming strokes/erases from real-time peer device
  useEffect(() => {
    if (!incomingDelta || !incomingDelta.points || incomingDelta.points.length === 0) return;

    allDeltasRef.current.push(incomingDelta);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      renderSingleDelta(ctx, incomingDelta, canvas.width, canvas.height);
    }
  }, [incomingDelta, renderSingleDelta]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!canDraw) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    const px = clientX - rect.left;
    const py = clientY - rect.top;

    // Accurate coordinate normalization against DOM display dimensions
    const normX = Math.max(0, Math.min(1, px / (rect.width || 1)));
    const normY = Math.max(0, Math.min(1, py / (rect.height || 1)));

    setIsDrawing(true);
    currentPointsRef.current = [{ x: normX, y: normY }];
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canDraw) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    const px = clientX - rect.left;
    const py = clientY - rect.top;

    // Accurate coordinate normalization
    const normX = Math.max(0, Math.min(1, px / (rect.width || 1)));
    const normY = Math.max(0, Math.min(1, py / (rect.height || 1)));

    const lastPoint = currentPointsRef.current[currentPointsRef.current.length - 1];

    if (isEraser) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = lineWidth * 8;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
    }

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    if (lastPoint) {
      ctx.moveTo(lastPoint.x * canvas.width, lastPoint.y * canvas.height);
    } else {
      ctx.moveTo(normX * canvas.width, normY * canvas.height);
    }
    ctx.lineTo(normX * canvas.width, normY * canvas.height);
    ctx.stroke();

    ctx.globalCompositeOperation = "source-over";

    currentPointsRef.current.push({ x: normX, y: normY });
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (currentPointsRef.current.length > 0) {
      const delta: DrawDelta = {
        points: [...currentPointsRef.current],
        color: isEraser ? "#000000" : color,
        width: isEraser ? lineWidth * 8 : lineWidth,
        isEraser: isEraser,
      };

      // Save locally to stroke history
      allDeltasRef.current.push(delta);

      // Broadcast to peers and sync to server
      if (onDrawDelta) {
        onDrawDelta(delta);
      }
    }
    currentPointsRef.current = [];
  };

  const clearCanvas = () => {
    if (!canDraw) return;
    allDeltasRef.current = [];
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    if (onClearBoard) {
      onClearBoard();
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      {/* TOOLBAR */}
      <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
        {canDraw ? (
          <>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400">Color:</span>
              {["#3b82f6", "#10b981", "#ef4444", "#f59e0b", "#a855f7", "#ffffff"].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setColor(c);
                    setIsEraser(false);
                  }}
                  className={`w-6 h-6 rounded-full border-2 transition cursor-pointer ${
                    color === c && !isEraser ? "border-white scale-110" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEraser(!isEraser)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  isEraser ? "bg-rose-600 text-white" : "bg-slate-800 text-slate-300 hover:text-white border border-slate-700"
                }`}
              >
                🧹 {isEraser ? "Eraser Active" : "Eraser"}
              </button>

              <button
                type="button"
                onClick={clearCanvas}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition border border-slate-700 cursor-pointer"
              >
                🗑️ Clear Board
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold px-2 py-1 bg-amber-500/10 rounded-xl border border-amber-500/20 w-full justify-center sm:justify-start">
            <span>🔒 View-Only Mode</span>
            <span className="text-[10px] text-slate-400 font-normal">
              (Host has locked drawing permissions)
            </span>
          </div>
        )}
      </div>

      {/* CANVAS STAGE */}
      <div ref={containerRef} className="flex-1 relative min-h-[420px] bg-slate-950">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className={`w-full h-full block touch-none ${canDraw ? "cursor-crosshair" : "cursor-not-allowed"}`}
        />
      </div>
    </div>
  );
}