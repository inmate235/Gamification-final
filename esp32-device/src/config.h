#pragma once

// ── Display dimensions ────────────────────────────────────────────────────────
// T-Display-S3: 1.9" ST7789, 170×320, portrait
// Adjust if your specific board variant differs.
#define DISPLAY_WIDTH  170
#define DISPLAY_HEIGHT 320

// ── T-Display-S3 CAP TOUCH pin mapping ───────────────────────────────────────
// Display SPI
#define TFT_MOSI 11
#define TFT_SCLK 12
#define TFT_CS   10
#define TFT_DC    7
#define TFT_RST   5
#define TFT_BL   38

// Capacitive touch (CST816S via I2C)
#define TOUCH_SDA 18
#define TOUCH_SCL 17
#define TOUCH_INT 16
#define TOUCH_RST 21

// Physical buttons
#define BTN_BOOT  0   // IO0
#define BTN_SIDE  14  // IO14

// ── BLE UUIDs ─────────────────────────────────────────────────────────────────
#define BLE_DEVICE_NAME  "MurkyCorps"
#define SERVICE_UUID     "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
// Phone writes game state here; ESP32 reads it
#define STATE_CHAR_UUID  "beb5483e-36e1-4688-b7f5-ea07361b26a8"
// ESP32 notifies user actions here; phone subscribes
#define ACTION_CHAR_UUID "1c95d5e3-d8f7-413a-bf3d-7a2e5d7be87e"

// ── Wheel geometry ────────────────────────────────────────────────────────────
#define WHEEL_CX          85     // center x (display_width / 2)
#define WHEEL_CY         145     // center y
#define WHEEL_R           65     // outer radius
#define WHEEL_HUB_R       16     // center hub radius
#define NUM_SEGMENTS       7
#define SEGMENT_ANGLE    (360.0f / NUM_SEGMENTS)  // ~51.43°
#define SPIN_DURATION_MS  3000.0f
#define RESULT_SHOW_MS    3500

// ── Colours (RGB888 passed to LovyanGFX) ──────────────────────────────────────
#define C_BG       0x141414UL
#define C_WHITE    0xFFFFFFUL
#define C_PINK     0xE6009EUL
#define C_PINK_DIM 0x88005FUL
#define C_GOLD     0xFFD700UL
#define C_RED      0xFF2020UL
#define C_DIM      0x444444UL
#define C_GREEN    0x22C55EUL

// Segment colours matching the app exactly (index 0-6)
static const uint32_t SEGMENT_COLORS[NUM_SEGMENTS] = {
  0xFFD700UL,  // 0: Gold  – 10 tokens
  0x10B981UL,  // 1: Green – 5 tokens
  0x7C3AEDUL,  // 2: Purple – map reveal
  0x06B6D4UL,  // 3: Cyan  – 3 tokens
  0xF43F5EUL,  // 4: Pink  – flash sale
  0xF97316UL,  // 5: Orange – 1 token
  0x475569UL,  // 6: Slate – nothing
};

static const char* const SEGMENT_LABELS[NUM_SEGMENTS] = {
  "+10T", "+5T", "MAP", "+3T", "SALE", "+1T", "...",
};
