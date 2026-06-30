"use client";

import { useESP32Sync } from "@/hooks/useESP32Sync";

export function ESP32Provider({ children }: { children: React.ReactNode }) {
  useESP32Sync();
  return <>{children}</>;
}
