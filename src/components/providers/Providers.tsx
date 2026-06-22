"use client";

import React from "react";

/**
 * Root providers wrapper for the app.
 * Currently a pass-through; future providers (event scheduler, etc.) mount here.
 * Kept as a client component so client-only context providers can be added later
 * without modifying the root layout.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
