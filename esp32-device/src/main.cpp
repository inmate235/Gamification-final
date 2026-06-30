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
    } else if (dur < 600 && abs(dx) < 30 && abs(dy) < 30) {
      // Tap → forward to active screen
      if (g_state.currentPage == 0) wheelScreen.onTap(touchStartX, touchStartY);
      else                           saleScreen.onTap(touchStartX, touchStartY);
    }
  }
  wasTouched = isTouched;
}

// ── Frame timing ──────────────────────────────────────────────────────────────
static uint32_t lastFrameMs   = 0;
static uint32_t frameInterval = 200;

static void renderFrame(uint32_t now) {
  if (g_state.currentPage == 0) {
    wheelScreen.draw(sprite);
  } else {
    saleScreen.draw(sprite);
  }
  sprite.pushSprite(0, 0);
}

// ── Setup ─────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);

  // Enable power/backlight (required for T-Display-S3)
  pinMode(PIN_POWER_ON, OUTPUT);
  digitalWrite(PIN_POWER_ON, HIGH);

  // Side button for demo sale trigger
  pinMode(BTN_SIDE, INPUT_PULLUP);

  display.init();
  display.setRotation(0);  // Landscape (320x170) with offset_rotation=1
  display.setBrightness(200);

  sprite.setColorDepth(16);
  sprite.createSprite(DISPLAY_WIDTH, DISPLAY_HEIGHT);

  wheelScreen.init(&display);
  saleScreen.init(&display);

  ble_init();

  // ── Splash screen with animated logo ──────────────────────────────────────
  display.fillScreen(C_BG);

  // Bouncing "M" logo animation
  int logoY = DISPLAY_HEIGHT / 2 - 35;
  for (int frame = 0; frame < 20; frame++) {
    display.fillScreen(C_BG);
    float t = (float)frame / 20.0f;
    float bounce = sinf(t * M_PI) * 8.0f;
    int yOff = (int)bounce;

    // Logo circle background
    display.fillCircle(DISPLAY_WIDTH / 2, logoY + yOff, 22, 0x2A1A2AUL);
    display.drawCircle(DISPLAY_WIDTH / 2, logoY + yOff, 22, C_PINK_DIM);
    display.drawCircle(DISPLAY_WIDTH / 2, logoY + yOff, 21, C_PINK);

    // "M" in center
    display.setTextDatum(MC_DATUM);
    display.setTextColor(C_PINK);
    display.setTextSize(3);
    display.drawString("M", DISPLAY_WIDTH / 2, logoY + yOff);

    // Brand name (fades in after frame 8)
    if (frame > 8) {
      display.setTextColor(C_PINK);
      display.setTextSize(2);
      display.drawString("MurkyMall", DISPLAY_WIDTH / 2, DISPLAY_HEIGHT / 2 + 10);
    }

    delay(40);
  }

  // Final splash frame
  display.fillScreen(C_BG);
  display.fillCircle(DISPLAY_WIDTH / 2, logoY, 22, 0x2A1A2AUL);
  display.drawCircle(DISPLAY_WIDTH / 2, logoY, 22, C_PINK);
  display.setTextDatum(MC_DATUM);
  display.setTextColor(C_PINK);
  display.setTextSize(3);
  display.drawString("M", DISPLAY_WIDTH / 2, logoY);
  display.setTextSize(2);
  display.drawString("MurkyMall", DISPLAY_WIDTH / 2, DISPLAY_HEIGHT / 2 + 10);
  display.setTextSize(1);
  display.setTextColor(C_DIM);
  display.drawString("MALL COMPANION", DISPLAY_WIDTH / 2, DISPLAY_HEIGHT / 2 + 35);

  // Loading bar
  int barW = 140, barH = 4;
  int barX = (DISPLAY_WIDTH - barW) / 2;
  int barY = DISPLAY_HEIGHT / 2 + 55;
  display.drawRoundRect(barX, barY, barW, barH, 2, 0x333333UL);
  for (int i = 0; i <= barW; i += 4) {
    display.fillRect(barX, barY, i, barH, C_PINK);
    delay(6);
  }

  delay(300);
  Serial.println("[main] setup done");

  // Enable wheel for demo (also gets updated via BLE when connected)
  g_state.wheelAvailable = true;
}

// ── Loop ──────────────────────────────────────────────────────────────────────
void loop() {
  uint32_t now = millis();

  handleTouch();
  wheelScreen.update(now);
  saleScreen.update(now);

  // Pause sale countdown when user is on the wheel screen (prevents sale
  // expiring while away — fixes the "swipe back to empty sale" bug)
  saleScreen.setCountdownPause(g_state.currentPage != 1);

  // Side button (GPIO14) triggers a demo flash sale
  static bool btnSidePressed = false;
  if (digitalRead(BTN_SIDE) == LOW && !btnSidePressed) {
    btnSidePressed = true;
    if (!g_state.sale.active) {
      saleScreen.triggerDemoSale();
      g_state.currentPage = 1;  // jump to sale screen
    }
  } else if (digitalRead(BTN_SIDE) == HIGH) {
    btnSidePressed = false;
  }

  bool spinning = (g_state.currentPage == 0);
  bool saleAlert = g_state.sale.active;
  if (spinning)        frameInterval = 33;
  else if (saleAlert)  frameInterval = 100;
  else                 frameInterval = 250;

  if (now - lastFrameMs >= frameInterval) {
    lastFrameMs = now;
    renderFrame(now);
  }

  // Auto-switch to sale screen when a new sale arrives
  static bool wasSaleActive = false;
  if (g_state.sale.active && !wasSaleActive) {
    g_state.currentPage = 1;
  }
  wasSaleActive = g_state.sale.active;
}
