"use client";

import { useState, useCallback, useEffect } from "react";
import { esp32ble } from "@/lib/esp32ble";

export function ESP32ConnectButton() {
  const [connected, setConnected] = useState(false);
  const [busy,      setBusy]      = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    esp32ble.onConnectionChange = setConnected;
    return () => { esp32ble.onConnectionChange = null; };
  }, []);

  const handleClick = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      if (connected) {
        await esp32ble.disconnect();
      } else {
        await esp32ble.connect();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Connection failed";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }, [connected]);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={busy}
        className={[
          "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all",
          connected
            ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40 hover:bg-emerald-500/30"
            : "bg-white/5 text-white/50 ring-1 ring-white/10 hover:bg-white/10",
          busy && "opacity-50 cursor-not-allowed",
        ].join(" ")}
        aria-label={connected ? "Disconnect ESP32" : "Connect ESP32 device"}
      >
        <span
          className={[
            "inline-block h-2 w-2 rounded-full",
            connected ? "bg-emerald-400" : "bg-white/30",
            busy ? "animate-pulse" : "",
          ].join(" ")}
        />
        {busy ? "…" : connected ? "ESP32 ●" : "ESP32"}
      </button>
      {error && (
        <p className="max-w-[180px] text-right text-[10px] text-red-400">{error}</p>
      )}
    </div>
  );
}
