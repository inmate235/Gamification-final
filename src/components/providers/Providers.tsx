"use client";

import React from "react";
import { SoundManager } from "@/components/providers/SoundManager";

/**
 * Root providers wrapper for the app.
 * Currently wraps children with the SoundManager (global audio orchestration).
 * Kept as a client component so client-only context providers can be added later
 * without modifying the root layout.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SoundManager />
      {children}
    </>
  );
}
