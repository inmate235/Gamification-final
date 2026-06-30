/*
 * MurkyCorps ESP32 Companion Device
 * LILYGO T-Display-S3 CAP TOUCH
 *
 * Screen 0: Spinning Wheel  — tap to spin, syncs with phone app over BLE
 * Screen 1: Flash Sale Alert — flashes on new sale, shows direction arrow
 *
 * Swipe left/right to switch screens.
 */
#include <Arduino.h>
#include "lgfx_config.h"
#include "config.h"
#include "shared_state.h"
#include "ble_manager.h"
#include "wheel_screen.h"
#include "sale_screen.h"

// ── Globals ───────────────────────────────────────────────────────────────────
SharedState g_state;
static LGFX         display;
static LGFX_Sprite  sprite(&display);
static WheelScreen  wheelScreen;
static SaleScreen   saleScreen;

// ── Touch state ───────────────────────────────────────────────────────────────
static bool     wasTouched   = false;
static int      touchStartX  = 0;
static int      touchStartY  = 0;
static int      lastTouchX   = 0;
static int      lastTouchY   = 0;
static uint32_t touchStartMs = 0;

static void handleTouch() {
  uint16_t tx = 0, ty = 0;
  bool isTouched = display.getTouch(&tx, &ty);

  if (isTouched) {
    lastTouchX = (int)tx;
    lastTouchY = (int)ty;
    if (!wasTouched) {
      touchStartX  = (int)tx;
      touchStartY  = (int)ty;
      touchStartMs = millis();
    }
  } else if (wasTouched) {
    // Finger lifted — classify gesture
    int dx = lastTouchX - touchStartX;
    int dy = lastTouchY - touchStartY;
    uint32_t dur = millis() - touchStartMs;

    if (abs(dx) > 55 && abs(dx) > abs(dy) * 1.5f) {
      // Horizontal swipe → switch page
      g_state.currentPage = (dx < 0) ? 1 : 0;
    } else if (dur < 350 && abs(dx) < 25 && abs(dy) < 25) {
      // Tap → forward to active screen
      if (g_state.currentPage == 0) wheelScreen.onTap(touchStartX, touchStartY);
      else                           saleScreen.onTap(touchStartX, touchStartY);
    }
  }
  wasTouched = isTouched;
}

// ── Frame timing ──────────────────────────────────────────────────────────────
static uint32_t lastFrameMs   = 0;
static uint32_t frameInterval = 200;  // ms between renders

static void renderFrame(uint32_t now) {
  if (g_state.currentPage == 0) {
    wheelScreen.draw(sprite);
    // Animate faster during spin
  } else {
    saleScreen.draw(sprite);
  }
  sprite.pushSprite(0, 0);
}

// ── Setup ─────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);

  display.init();
  display.setRotation(0);
  display.setBrightness(200);

  sprite.setColorDepth(16);
  sprite.createSprite(DISPLAY_WIDTH, DISPLAY_HEIGHT);

  wheelScreen.init(&display);
  saleScreen.init(&display);

  ble_init();

  // Initial splash
  display.fillScreen(C_BG);
  display.setTextDatum(MC_DATUM);
  display.setTextColor(C_PINK);
  display.setTextSize(2);
  display.drawString("MurkyCorps", DISPLAY_WIDTH / 2, DISPLAY_HEIGHT / 2 - 20);
  display.setTextSize(1);
  display.setTextColor(C_DIM);
  display.drawString("Connecting...", DISPLAY_WIDTH / 2, DISPLAY_HEIGHT / 2 + 10);
  delay(800);

  Serial.println("[main] setup done");
}

// ── Loop ──────────────────────────────────────────────────────────────────────
void loop() {
  uint32_t now = millis();

  handleTouch();
  wheelScreen.update(now);
  saleScreen.update(now);

  // Frame-rate: 30fps when wheel is spinning, 10fps for sale alert, 4fps idle
  bool spinning = (g_state.currentPage == 0);  // wheel screen needs faster refresh
  bool saleAlert = g_state.sale.active;
  if (spinning)        frameInterval = 33;
  else if (saleAlert)  frameInterval = 100;
  else                 frameInterval = 250;

  if (now - lastFrameMs >= frameInterval) {
    lastFrameMs = now;
    renderFrame(now);
  }

  // Flash sale page badge: auto-switch to sale screen when a sale arrives
  static bool wasSaleActive = false;
  if (g_state.sale.active && !wasSaleActive) {
    g_state.currentPage = 1;  // jump to sale screen on new sale
  }
  wasSaleActive = g_state.sale.active;
}
