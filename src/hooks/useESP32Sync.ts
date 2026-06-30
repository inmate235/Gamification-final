"use client";

/**
 * useESP32Sync — subscribes to game stores and keeps the ESP32 in sync.
 *
 * On every relevant state change it:
 *   1. Builds the ESP32StatePayload from live store values.
 *   2. Computes the directional arrow for any active flash sale.
 *   3. Writes the payload to the ESP32 via BLE.
 *
 * On incoming actions from the ESP32:
 *   - "spin"    → run computeSpinResult + applySpinReward, send result back
 *   - "grab"    → open the flash-sale overlay on the phone app
 *   - "dismiss" → dismiss the active flash sale
 */

import { useEffect, useRef } from "react";
import { usePlayerStore } from "@/stores/playerStore";
import { useEconomyStore } from "@/stores/economyStore";
import { useMapStore } from "@/stores/mapStore";
import { useUIStore } from "@/stores/uiStore";
import { esp32ble, type ESP32StatePayload, type ESP32SalePayload } from "@/lib/esp32ble";
import { computeSpinResult, applySpinReward } from "@/engine/nearMissAlgorithm";
import { dismissFlashSale } from "@/engine/flashSaleEngine";
import { getStoreById } from "@/data/mallData";

// ── Directional arrow computation ─────────────────────────────────────────────
function computeDirection(
  fromX: number, fromY: number,
  toX: number,   toY: number
): number {
  const dx = toX - fromX;
  const dy = toY - fromY; // SVG y goes down, so dy>0 = toward entrance (South)
  const angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);
  // Rotate so 0 = North (up on map = smaller y = deeper into mall)
  const normalized = (angleDeg + 90 + 360) % 360;
  return Math.round(normalized / 45) % 8;
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useESP32Sync() {
  const tokens        = usePlayerStore((s) => s.tokens);
  const tier          = usePlayerStore((s) => s.tier);
  const wheelState    = useEconomyStore((s) => s.spinningWheel);
  const flashSales    = useEconomyStore((s) => s.flashSales);
  const playerPos     = useMapStore((s) => s.playerPosition);
  const showOverlay   = useUIStore((s) => s.showOverlay);

  // Track pending spin result to send once
  const pendingSpinRef = useRef<{ seg: number; nm: boolean } | null>(null);

  // Register action handler once
  useEffect(() => {
    esp32ble.onAction = (action) => {
      if (action === "spin") {
        const result  = computeSpinResult(tier);
        const outcome = applySpinReward(result);
        void outcome; // side-effects already applied by applySpinReward
        pendingSpinRef.current = {
          seg: result.segmentIndex,
          nm:  result.nearMiss,
        };
      } else if (action === "grab") {
        const sale = flashSales[0];
        if (sale) showOverlay("flash-sale", sale);
      } else if (action === "dismiss") {
        const sale = flashSales[0];
        if (sale) dismissFlashSale(sale.id);
      }
    };
    return () => { esp32ble.onAction = null; };
  }, [tier, flashSales, showOverlay]);

  // Sync state to device on every relevant change
  useEffect(() => {
    if (!esp32ble.isConnected) return;

    // Build flash sale payload
    let sa: ESP32SalePayload | null = null;
    const activeSale = flashSales[0];
    if (activeSale) {
      const store = getStoreById(activeSale.storeId);
      let dir = -1;
      if (store) {
        dir = computeDirection(
          playerPos.x, playerPos.y,
          store.position.x, store.position.y
        );
      }
      sa = {
        n:   store?.name ?? "Store",
        d:   activeSale.discount,
        c:   activeSale.countdownSeconds,
        dir,
      };
    }

    // Consume pending spin result (send once, then clear)
    const pending = pendingSpinRef.current;
    const payload: ESP32StatePayload = {
      w:   wheelState.available,
      t:   tokens,
      seg: pending?.seg ?? -1,
      nm:  pending?.nm  ?? false,
      sa,
    };

    void esp32ble.sendState(payload);

    // Clear after sending so it doesn't repeat on next render
    if (pending) pendingSpinRef.current = null;

  }, [tokens, wheelState.available, flashSales, playerPos]);
}
