// Relative Path: src/components/social/whiteboard/LiveWhiteboard.tsx
"use client";

import { useEffect, useRef, useState } from "react";

interface DrawPoint {
  x: number;
  y: number;
}

interface LiveWhiteboardProps {
  isHost?: boolean;
  onDrawDelta?: (delta: { points: DrawPoint[]; color: string; width: number }) => void;
}

export default function LiveWhiteboard({ isHost = false, onDrawDelta }: LiveWhiteboardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState("#3b82f6");
  const [lineWidth, setLineWidth] = useState(3);
  const [isEraser, setIsEraser] = useState(false);
  const currentPointsRef = useRef<DrawPoint[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = parent.clientWidth || 800;
      canvas.height = parent.clientHeight || 500;
    }
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    setIsDrawing(true);
    currentPointsRef.current = [{ x, y }];
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const lastPoint = currentPointsRef.current[currentPointsRef.current.length - 1];

    ctx.strokeStyle = isEraser ? "#0f172a" : color;
    ctx.lineWidth = isEraser ? lineWidth * 5 : lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    if (lastPoint) {
      ctx.moveTo(lastPoint.x, lastPoint.y);
    }
    ctx.lineTo(x, y);
    ctx.stroke();

    currentPointsRef.current.push({ x, y });
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (onDrawDelta && currentPointsRef.current.length > 0) {
      onDrawDelta({
        points: [...currentPointsRef.current],
        color: isEraser ? "#0f172a" : color,
        width: isEraser ? lineWidth * 5 : lineWidth,
      });
    }
    currentPointsRef.current = [];
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
      <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400">Color:</span>
          {["#3b82f6", "#10b981", "#ef4444", "#f59e0b", "#a855f7", "#ffffff"].map((c) => (
            <button
              key={c}
              onClick={() => {
                setColor(c);
                setIsEraser(false);
              }}
              className={`w-6 h-6 rounded-full border-2 transition ${
                color === c && !isEraser ? "border-white scale-110" : "border-transparent"
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEraser(!isEraser)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              isEraser ? "bg-rose-600 text-white" : "bg-slate-800 text-slate-300 hover:text-white border border-slate-700"
            }`}
          >
            🧹 {isEraser ? "Eraser Active" : "Eraser"}
          </button>

          <button
            onClick={clearCanvas}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition border border-slate-700"
          >
            🗑️ Clear Board
          </button>
        </div>
      </div>

      <div className="flex-1 relative min-h-[420px] bg-slate-950">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full h-full touch-none cursor-crosshair block"
        />
      </div>
    </div>
  );
}