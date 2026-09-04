import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, ImagePlus, RotateCcw, X } from "lucide-react";
import { Btn, Sheet, toast, useBackHandler, useScrollLock } from "./ui";

/** Downscale an image file to a compact JPEG data URL (max 720px edge) */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const max = 720;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad image")); };
    img.src = url;
  });
}

/** Programmatic photo capture: opens camera and returns data URL */
export function takePhoto(): Promise<string> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error("no file"));
        return;
      }
      try {
        const dataUrl = await fileToDataUrl(file);
        resolve(dataUrl);
      } catch (e) {
        reject(e);
      }
    };
    input.onerror = () => reject(new Error("cancelled"));
    input.click();
  });
}

/** Camera-proof capture sheet: take/choose photo → preview → save */
export function CaptureSheet({ open, onClose, onSave, title, required }: {
  open: boolean; onClose: () => void; onSave: (dataUrl: string) => void; title: string; required?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [shot, setShot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setShot(null);
      const t = setTimeout(() => inputRef.current?.click(), 320);
      return () => clearTimeout(t);
    }
  }, [open]);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    try {
      setShot(await fileToDataUrl(f));
    } catch {
      toast("Could not read that image — try again", "err");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => pick(e.target.files?.[0])} />
      <Sheet open={open} onClose={onClose} title={title}>
        <div className="space-y-3.5">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-line bg-[#0b0e12]">
            {shot ? (
              <img src={shot} alt="proof" className="a-fadein h-full w-full object-contain" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-faint">
                <Camera size={30} className="text-amber" />
                <p className="font-mono text-[11px] uppercase tracking-widest">
                  {busy ? "Processing photo…" : "No photo yet"}
                </p>
              </div>
            )}
            {shot && (
              <button onClick={() => inputRef.current?.click()}
                className="tap absolute right-2.5 top-2.5 flex items-center gap-1.5 rounded-lg border border-line bg-black/60 px-2.5 py-1.5 font-mono text-[10.5px] uppercase text-white backdrop-blur">
                <RotateCcw size={12} /> retake
              </button>
            )}
          </div>
          <p className="text-center font-mono text-[10.5px] uppercase tracking-widest text-faint">
            {required ? "photo proof required for this task" : "compressed & stored with the record"}
          </p>
          <div className="flex gap-2.5">
            <Btn variant="ghost" className="flex-1" onClick={() => inputRef.current?.click()}>
              <ImagePlus size={15} /> {shot ? "Change" : "Take photo"}
            </Btn>
            <Btn className="flex-1" disabled={!shot} onClick={() => { if (shot) { onSave(shot); onClose(); } }}>
              Save proof
            </Btn>
          </div>
        </div>
      </Sheet>
    </>
  );
}

/** Full-screen image viewer (admin evidence review) */
export function Lightbox({ src, onClose, caption }: { src: string | null; onClose: () => void; caption?: string }) {
  useBackHandler(!!src, onClose);
  useScrollLock(!!src);
  if (!src) return null;
  return createPortal(
    <div className="fixed inset-0 z-[85] flex flex-col bg-black/92 backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 py-3 pt-[max(env(safe-area-inset-top),12px)]">
        <p className="ttl text-[13px] font-bold text-white/90">{caption ?? "Evidence photo"}</p>
        <button onClick={onClose} className="tap rounded-lg border border-white/20 bg-white/10 p-2 text-white" aria-label="Close">
          <X size={16} />
        </button>
      </div>
      <div className="a-pop flex min-h-0 flex-1 items-center justify-center p-4">
        <img src={src} alt={caption ?? "evidence"} className="max-h-full max-w-full rounded-xl border border-white/15 object-contain shadow-2xl" />
      </div>
      <p className="pb-[max(env(safe-area-inset-bottom),14px)] text-center font-mono text-[10px] uppercase tracking-widest text-white/40">
        submitted by staff · stored with attendance record
      </p>
    </div>,
    document.body,
  );
}
