import { Moon, Sun, Zap, Coffee, Layers } from "lucide-react";
import type { Settings } from "../types";
import { updateSettings } from "../lib/store";
import { Sheet, Btn } from "./ui";

export interface ThemeOption {
  id: "dark" | "light" | "contrast" | "amber" | "minimalist";
  name: string;
  description: string;
  icon: React.ReactNode;
}

const THEMES: ThemeOption[] = [
  {
    id: "dark",
    name: "Dark",
    description: "Default dark theme with amber accents",
    icon: <Moon size={18} />,
  },
  {
    id: "light",
    name: "Light",
    description: "Clean bright theme for daylight",
    icon: <Sun size={18} />,
  },
  {
    id: "contrast",
    name: "High Contrast",
    description: "Maximum visibility in bright warehouse",
    icon: <Zap size={18} />,
  },
  {
    id: "amber",
    name: "Amber",
    description: "Warm monochrome for reading comfort",
    icon: <Coffee size={18} />,
  },
  {
    id: "minimalist",
    name: "Minimalist",
    description: "Clean white, thin lines, no hazard — maximal clarity",
    icon: <Layers size={18} />,
  },
];

export function ThemeSelector({
  open,
  onClose,
  currentTheme,
}: {
  open: boolean;
  onClose: () => void;
  currentTheme: Settings["theme"];
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Select Theme">
      <div className="space-y-2">
        {THEMES.map((theme) => (
          <button
            key={theme.id}
            onClick={() => {
              updateSettings({ theme: theme.id });
              onClose();
            }}
            className={`tap w-full rounded-lg border-2 p-3 text-left transition-all ${
              currentTheme === theme.id
                ? "border-amber bg-amber/10"
                : "border-line2 bg-panel2 hover:border-line"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`mt-1 flex h-8 w-8 items-center justify-center rounded-lg ${
                currentTheme === theme.id
                  ? "bg-amber/20 text-amber"
                  : "bg-line text-mut"
              }`}>
                {theme.icon}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-ink">{theme.name}</p>
                <p className="text-[12px] text-faint">{theme.description}</p>
              </div>
              {currentTheme === theme.id && (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-amber">
                  <div className="h-2 w-2 rounded-full bg-black" />
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Theme preview */}
      <div className="mt-4 rounded-lg border border-line2 p-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-faint">Preview</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-panel p-2">
            <p className="text-[11px] text-mut">Background</p>
          </div>
          <div className="rounded-lg bg-panel2 p-2">
            <p className="text-[11px] text-mut">Panel 2</p>
          </div>
          <div className="flex gap-1">
            <div className="flex-1 rounded bg-amber p-2 text-center text-[10px] font-bold text-black">
              Amber
            </div>
            <div className="flex-1 rounded bg-ok p-2 text-center text-[10px] font-bold text-black">
              OK
            </div>
          </div>
          <div className="flex gap-1">
            <div className="flex-1 rounded bg-bad p-2 text-center text-[10px] font-bold text-white">
              Bad
            </div>
            <div className="flex-1 rounded bg-cool p-2 text-center text-[10px] font-bold text-black">
              Cool
            </div>
          </div>
        </div>
      </div>
    </Sheet>
  );
}
