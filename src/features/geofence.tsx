import { useState, useRef, useEffect } from "react";
import { MapPin, Save, Crosshair } from "lucide-react";
import { getDB, updateSettings } from "../lib/store";
import { useT } from "../lib/i18n";
import { locateWithFallback } from "../lib/util";
import { Sheet, Btn, toast } from "../components/ui";

export function GeofenceStudio({ open, onClose }: { open: boolean; onClose: () => void }) {
  const db = getDB();
  const t = useT();
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState<"center" | "radius">("center");
  const [temp, setTemp] = useState<{ lat: number; lng: number; radius: number } | null>(null);
  const [locating, setLocating] = useState(false);

  if (!db) return null;
  const s = db.settings;
  const initial = temp ?? { lat: s.lat, lng: s.lng, radius: s.radius };

  useEffect(() => {
    if (open) setTemp({ lat: s.lat, lng: s.lng, radius: s.radius });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePointerDown = (type: "center" | "radius") => (e: React.PointerEvent) => {
    e.preventDefault();
    setDragging(type);
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging || !svgRef.current || !temp) return;
    const rect = svgRef.current.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const x = e.clientX - rect.left - cx;
    const y = e.clientY - rect.top - cy;

    if (dragging === "center") {
      // Convert pixel offset to lat/lng delta
      const maxPixels = Math.min(rect.width, rect.height) / 2;
      const latDelta = (y / maxPixels) * 0.005; // ~500m range
      const lngDelta = (x / maxPixels) * 0.005;
      setTemp({ ...temp, lat: s.lat + latDelta, lng: s.lng + lngDelta });
    } else if (dragging === "radius") {
      const dist = Math.sqrt(x * x + y * y);
      const maxPixels = Math.min(rect.width, rect.height) / 2;
      const newRadius = Math.round((dist / maxPixels) * 500); // max 500m
      setTemp({ ...temp, radius: Math.max(50, Math.min(500, newRadius)) });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setDragging("center");
    try { (e.target as Element).releasePointerCapture(e.pointerId); } catch {}
  };

  const handleSave = () => {
    if (temp) {
      updateSettings({ lat: temp.lat, lng: temp.lng, radius: temp.radius });
      onClose();
    }
  };

  const useCurrentLocation = async () => {
    if (!temp) return;
    setLocating(true);
    const position = await locateWithFallback({ lat: temp.lat, lng: temp.lng }, 8000);
    setLocating(false);
    if (position.simulated) {
      toast("GPS unavailable. Allow location access and use HTTPS to detect this device.", "err");
      return;
    }
    setTemp((current) => current ? { ...current, lat: position.lat, lng: position.lng } : current);
    toast("Current GPS coordinates captured. Save to apply them.", "ok");
  };

  const handleReset = () => {
    setTemp({ lat: s.lat, lng: s.lng, radius: s.radius });
  };

  if (!temp) return null;

  // SVG coordinate system: 0,0 at center, range -100 to 100
  const maxVal = 100;
  const latToY = (lat: number) => ((lat - s.lat) / 0.005) * maxVal;
  const lngToX = (lng: number) => ((lng - s.lng) / 0.005) * maxVal;
  const radiusToPx = (r: number) => (r / 500) * maxVal;

  const centerX = lngToX(temp.lng);
  const centerY = latToY(temp.lat);
  const radiusPx = radiusToPx(temp.radius);

  return (
    <Sheet open={open} onClose={onClose} title={t("a.editGeo")} wide>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] font-semibold text-ink">{t("a.dragCenter")}</p>
            <p className="font-mono text-[10.5px] text-faint">
              {temp.lat.toFixed(6)}, {temp.lng.toFixed(6)} · R: {temp.radius}m
            </p>
          </div>
          <div className="flex gap-2">
            <Btn variant="ghost" onClick={handleReset}><Crosshair size={14} /> {t("c.cancel")}</Btn>
            <Btn variant="ghost" onClick={useCurrentLocation} busy={locating}><MapPin size={14} /> {locating ? "Locating..." : "Use my GPS"}</Btn>
            <Btn variant="primary" onClick={handleSave}><Save size={14} /> {t("c.save")}</Btn>
          </div>
        </div>

        <div
          className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-xl border border-line bg-panel2"
          style={{ touchAction: "none" }}
        >
          <svg
            ref={svgRef}
            viewBox={`-${maxVal} -${maxVal} ${maxVal * 2} ${maxVal * 2}`}
            className="h-full w-full"
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          >
            {/* Grid */}
            <defs>
              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="var(--line)" strokeWidth="0.5" />
              </pattern>
              <radialGradient id="radarGrad">
                <stop offset="0%" stopColor="var(--amber)" stopOpacity="0.15" />
                <stop offset="100%" stopColor="var(--amber)" stopOpacity="0.02" />
              </radialGradient>
            </defs>
            <rect x={-maxVal} y={-maxVal} width={maxVal * 2} height={maxVal * 2} fill="url(#grid)" />
            
            {/* Radar sweep animation */}
            <circle cx="0" cy="0" r={maxVal * 0.9} fill="url(#radarGrad)">
              <animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0" dur="8s" repeatCount="indefinite" />
            </circle>

            {/* Current saved position (reference) */}
            <circle cx="0" cy="0" r="4" fill="var(--faint)" opacity="0.5" />
            <text x="8" y="4" fontSize="8" fill="var(--faint)" className="font-mono">current</text>

            {/* Geofence circle */}
            <circle
              cx={centerX}
              cy={centerY}
              r={radiusPx}
              fill="var(--amber)"
              fillOpacity="0.08"
              stroke="var(--amber)"
              strokeWidth="2"
              strokeDasharray="6 4"
            />

            {/* Center pin */}
            <g
              transform={`translate(${centerX}, ${centerY})`}
              onPointerDown={handlePointerDown("center")}
              className="cursor-grab active:cursor-grabbing"
            >
              <circle r="12" fill="var(--amber)" opacity="0.2" />
              <MapPin size={24} x="-12" y="-12" className="text-amber" fill="var(--amber)" />
            </g>

            {/* Radius handle */}
            <g
              transform={`translate(${centerX + radiusPx}, ${centerY})`}
              onPointerDown={handlePointerDown("radius")}
              className="cursor-grab active:cursor-grabbing"
            >
              <circle r="8" fill="var(--ok)" stroke="var(--panel1)" strokeWidth="2" />
              <circle r="3" fill="var(--panel1)" />
            </g>

            {/* Distance label */}
            <text
              x={centerX + radiusPx / 2}
              y={centerY - 6}
              fontSize="9"
              fill="var(--ok)"
              textAnchor="middle"
              className="font-mono"
            >
              {temp.radius}m
            </text>
          </svg>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <label className="rounded-lg border border-line bg-panel1 p-3">
            <span className="font-mono text-[11px] text-faint">LATITUDE</span>
            <input className="inp mt-1 w-full font-mono text-[13px]" type="number" step="0.000001" value={temp.lat}
              onChange={(e) => setTemp({ ...temp, lat: Number(e.target.value) })} />
          </label>
          <label className="rounded-lg border border-line bg-panel1 p-3">
            <span className="font-mono text-[11px] text-faint">LONGITUDE</span>
            <input className="inp mt-1 w-full font-mono text-[13px]" type="number" step="0.000001" value={temp.lng}
              onChange={(e) => setTemp({ ...temp, lng: Number(e.target.value) })} />
          </label>
          <label className="rounded-lg border border-line bg-panel1 p-3">
            <span className="flex items-center justify-between font-mono text-[11px] text-faint"><span>RADIUS</span><strong className="text-ok">{temp.radius}m</strong></span>
            <input className="mt-3 w-full accent-[var(--ok)]" type="range" min="50" max="500" step="5" value={temp.radius}
              onChange={(e) => setTemp({ ...temp, radius: Number(e.target.value) })} />
          </label>
        </div>

        <p className="font-mono text-[10px] text-faint">
          ℹ {t("a.geoHint")}
        </p>
      </div>
    </Sheet>
  );
}
