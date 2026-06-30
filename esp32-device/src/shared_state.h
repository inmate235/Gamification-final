#pragma once
#include <stdint.h>
#include <string.h>

struct SaleData {
  bool     active           = false;
  char     name[32]         = "";
  char     discount[20]     = "";
  int      countdownSeconds = 0;
  int      direction        = -1;   // 0=N 1=NE 2=E 3=SE 4=S 5=SW 6=W 7=NW
  uint32_t receivedAt       = 0;    // millis() when state was last written
};

struct SharedState {
  // ── BLE ────────────────────────────────────────────────────────────────────
  bool bleConnected  = false;

  // ── Player ─────────────────────────────────────────────────────────────────
  int  tokenBalance  = 0;

  // ── Wheel ──────────────────────────────────────────────────────────────────
  bool wheelAvailable  = false;
  int  spinSegment     = -1;   // -1 = no pending result; 0-6 = animate to this
  bool spinNearMiss    = false;

  // ── Flash sale ─────────────────────────────────────────────────────────────
  SaleData sale;

  // ── Navigation ─────────────────────────────────────────────────────────────
  int currentPage = 0;  // 0 = wheel screen, 1 = sale screen
};

extern SharedState g_state;
