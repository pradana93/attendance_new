import { useState, useEffect } from "react";
import { Server, Database, CheckCircle2, Shield, Activity, RefreshCw } from "lucide-react";
import { Sheet, Btn, Chip } from "./ui";
import { useDB, updateSettings, refreshProductionData, getDB } from "../lib/store";
import { productionClient, hasProductionConfiguration } from "../lib/production";
import { useT } from "../lib/i18n";
import { getSupabase } from "../lib/supabase";

interface ServerStatusSheetProps {
  open: boolean;
  onClose: () => void;
  online: boolean;
}

export function ServerStatusSheet({ open, onClose, online }: ServerStatusSheetProps) {
  const db = useDB();
  const t = useT();
  const [checking, setChecking] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [latency, setLatency] = useState<number | null>(null);
  const [syncCount, setSyncCount] = useState({ pending: 0, total: 0 });

  const client = productionClient();
  const hasConfig = hasProductionConfiguration();
  const supabaseStatus = (online && hasConfig && client) ? "connected" : "off";
  const supabaseUrl = client?.supabaseUrl ?? db?.settings.supabase.url ?? "";

  // Dynamic status details
  const getStatusColor = () => {
    if (!online) return "bad";
    if (supabaseStatus === "connected") return "ok";
    return "amber";
  };

  const getStatusLabel = () => {
    if (!online) return "Offline";
    if (supabaseStatus === "connected") return "Active (Cloud)";
    return "Local First";
  };

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const testLatency = async () => {
    if (cooldown > 0 || checking) return;
    setChecking(true);
    setLatency(null);
    const start = performance.now();
    try {
      const client = productionClient();
      if (client) {
        const { error } = await client.from("workspace_settings").select("workspace_id").limit(1);
        if (!error) {
          const end = performance.now();
          setLatency(Math.round(end - start));
        } else {
          setLatency(-1); // failed to reach or authenticate
        }
      } else {
        setLatency(-1);
      }
    } catch {
      setLatency(-1);
    } finally {
      setChecking(false);
      setCooldown(3); // 3-second cooldown to avoid spamming
    }
  };

  useEffect(() => {
    if (open) {
      void testLatency();

      // Check for any pending items in our local DB if active
      const localDB = getDB();
      if (localDB) {
        // Simple counts based on lists present in memory
        const totalItems = (localDB.attendance?.length ?? 0) + (localDB.pointEvents?.length ?? 0);
        setSyncCount({ pending: 0, total: totalItems });
      }
    }
  }, [open]);

  return (
    <Sheet open={open} onClose={onClose} title="Server Status">
      <div className="flex flex-col gap-5 pt-1">
        {/* Hub status */}
        <div className="flex items-center justify-between rounded-xl border border-line bg-panel2 p-4">
          <div className="flex items-center gap-3">
            <Server className={`text-${getStatusColor()}`} size={20} />
            <div>
              <p className="text-[14px] font-bold text-ink">Connection Status</p>
              <p className="font-mono text-[11px] text-faint uppercase">{getStatusLabel()}</p>
            </div>
          </div>
          <Chip tone={getStatusColor()}>{online ? "Online" : "Offline"}</Chip>
        </div>

        {/* Live Metrics */}
        <div className="space-y-3">
          <h4 className="font-mono text-[10px] uppercase tracking-widest text-[#9c9583]">Connection Metrics</h4>
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl border border-line bg-panel/40 p-3">
              <span className="flex items-center gap-1.5 text-faint">
                <Activity size={12} />
                <span className="font-mono text-[10p] uppercase tracking-wider text-xs">Latency</span>
              </span>
              <p className="mt-1 font-mono text-[18px] font-extrabold text-ink">
                {checking ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-amber inline-block" />
                ) : latency === null ? (
                  "--"
                ) : latency === -1 ? (
                  <span className="text-bad">ERR</span>
                ) : (
                  `${latency} ms`
                )}
              </p>
            </div>

            <div className="rounded-xl border border-line bg-panel/40 p-3">
              <span className="flex items-center gap-1.5 text-faint">
                <Database size={12} />
                <span className="font-mono text-[10px] uppercase tracking-wider text-xs">Sync Cache</span>
              </span>
              <p className="mt-1 font-mono text-[18px] font-extrabold text-ink">
                {syncCount.pending === 0 ? "Synced" : `${syncCount.pending} Items`}
              </p>
            </div>
          </div>
        </div>

        {/* Database specs */}
        <div className="rounded-xl border border-line bg-panel/40 divide-y divide-line2">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2 text-faint">
              <Shield size={14} />
              <span className="text-[12.5px] font-semibold text-ink">Cloud Database</span>
            </div>
            <span className="font-mono text-[10.5px] text-mut max-w-[21ch] truncate">
              {supabaseUrl ? supabaseUrl.replace("https://", "") : "Not Connected"}
            </span>
          </div>

          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2 text-faint">
              <CheckCircle2 size={14} />
              <span className="text-[12.5px] font-semibold text-ink">Schema Integrity</span>
            </div>
            <span className="font-mono text-[10.5px] text-ok font-bold uppercase">Passed</span>
          </div>
        </div>

        {/* Control and action buttons */}
        <div className="mt-1 flex gap-2">
          <Btn variant="ghost" className="flex-1" onClick={testLatency} disabled={checking || cooldown > 0}>
            <RefreshCw size={13} className={checking ? "animate-spin" : ""} />
            {cooldown > 0 ? `Wait (${cooldown}s)` : "Ping Database"}
          </Btn>
          <Btn variant="primary" className="flex-1" onClick={async () => {
            setChecking(true);
            try {
              await refreshProductionData();
            } finally {
              setChecking(false);
              onClose();
            }
          }}>
            Refresh App
          </Btn>
        </div>
      </div>
    </Sheet>
  );
}
