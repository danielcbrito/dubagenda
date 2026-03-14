import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const DEVICES = [
  { name: "iPhone SE", width: 375, height: 667 },
  { name: "iPhone 14", width: 390, height: 844 },
  { name: "iPhone 14 Pro Max", width: 430, height: 932 },
  { name: "Samsung Galaxy S21", width: 360, height: 800 },
  { name: "Samsung Galaxy S24 Ultra", width: 412, height: 915 },
  { name: "Pixel 7", width: 412, height: 892 },
  { name: "iPad Mini", width: 768, height: 1024 },
  { name: "iPad Air", width: 820, height: 1180 },
  { name: "iPad Pro 12.9", width: 1024, height: 1366 },
  { name: "Desktop HD", width: 1280, height: 800 },
  { name: "Desktop Full HD", width: 1920, height: 1080 },
];

export default function ResponsivePreview() {
  const navigate = useNavigate();
  const [scale] = useState(0.3);
  const previewUrl = window.location.origin + "/";

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-neutral-950/95 backdrop-blur-xl border-b border-white/10 px-6 py-4 flex items-center gap-4">
        <button
          onClick={() => navigate("/")}
          className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-lg font-bold tracking-tight">Responsive Preview</h1>
          <p className="text-xs text-neutral-400">Landing page em todos os dispositivos</p>
        </div>
      </div>

      {/* Grid of devices */}
      <div className="px-6 py-8 flex flex-wrap gap-8 justify-center">
        {DEVICES.map((device) => {
          const scaledW = device.width * scale;
          const scaledH = device.height * scale;

          return (
            <div key={device.name} className="flex flex-col items-center gap-3">
              {/* Label */}
              <div className="text-center">
                <p className="text-xs font-semibold text-white/80">{device.name}</p>
                <p className="text-[10px] text-neutral-500 tabular-nums">
                  {device.width} × {device.height}
                </p>
              </div>

              {/* Device frame */}
              <div
                className="rounded-xl border border-white/10 bg-neutral-900 overflow-hidden shadow-2xl shadow-black/50"
                style={{ width: scaledW + 4, height: scaledH + 4, padding: 2 }}
              >
                <div
                  style={{
                    width: scaledW,
                    height: scaledH,
                    overflow: "hidden",
                    borderRadius: 8,
                  }}
                >
                  <iframe
                    src={previewUrl}
                    title={device.name}
                    style={{
                      width: device.width,
                      height: device.height,
                      transform: `scale(${scale})`,
                      transformOrigin: "top left",
                      border: "none",
                      pointerEvents: "none",
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
