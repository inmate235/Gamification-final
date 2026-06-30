#include "sale_screen.h"
#include "ble_manager.h"
#include "config.h"
#include <math.h>

static constexpr float DEG2RAD = M_PI / 180.0f;

// Grab button region
static const int GRAB_Y  = 238;
static const int GRAB_H  = 32;
static const int DISM_Y  = 276;
static const int DISM_H  = 22;

void SaleScreen::init(LGFX* display) {
  _display = display;
}

void SaleScreen::update(uint32_t now) {
  bool active = g_state.sale.active;

  // Detect new sale arriving
  if (active && !_lastActive) {
    _flashCount = 0;
    _flashTimer = now;
    _countdown  = g_state.sale.countdownSeconds;
    _lastTickAt = now;
  }
  _lastActive = active;

  if (!active) return;

  // Flash border animation (6 half-cycles @ 150ms each)
  if (_flashCount < 6 && (now - _flashTimer) > 150) {
    _flashCount++;
    _flashTimer = now;
  }

  // Local countdown tick (1 second intervals)
  if (_countdown > 0 && (now - _lastTickAt) >= 1000) {
    _countdown--;
    _lastTickAt = now;
    if (_countdown <= 0) {
      g_state.sale.active = false;
    }
  }
  // Keep in sync if phone sends updated countdown
  if (g_state.sale.countdownSeconds < _countdown) {
    _countdown = g_state.sale.countdownSeconds;
  }
}

void SaleScreen::drawBorder(LGFX_Sprite& spr, uint32_t col) {
  spr.drawRect(1, 1, DISPLAY_WIDTH - 2, DISPLAY_HEIGHT - 2, col);
  spr.drawRect(2, 2, DISPLAY_WIDTH - 4, DISPLAY_HEIGHT - 4, col);
}

void SaleScreen::drawArrow(LGFX_Sprite& spr, int cx, int cy, int dir) {
  // dir: 0=N 1=NE 2=E 3=SE 4=S 5=SW 6=W 7=NW
  // 0 = North = up = -90 from East
  float angleDeg = dir * 45.0f - 90.0f;
  float rad = angleDeg * DEG2RAD;

  int shaft = 30;
  int ex = cx + (int)(shaft * cosf(rad));
  int ey = cy + (int)(shaft * sinf(rad));

  // Thick shaft (3px wide)
  for (int t = -1; t <= 1; t++) {
    float pr = rad + M_PI / 2.0f;
    int ox = (int)(t * cosf(pr));
    int oy = (int)(t * sinf(pr));
    spr.drawLine(cx + ox, cy + oy, ex + ox, ey + oy, C_WHITE);
  }

  // Arrowhead
  float backRad = rad + M_PI;
  float headLen = 16.0f;
  float spread  = 0.6f;
  int hx1 = ex + (int)(headLen * cosf(backRad - spread));
  int hy1 = ey + (int)(headLen * sinf(backRad - spread));
  int hx2 = ex + (int)(headLen * cosf(backRad + spread));
  int hy2 = ey + (int)(headLen * sinf(backRad + spread));
  spr.fillTriangle(ex, ey, hx1, hy1, hx2, hy2, C_WHITE);
}

void SaleScreen::drawIdle(LGFX_Sprite& spr) {
  spr.fillScreen(C_BG);

  // Large dim "M" logo
  spr.setTextSize(8);
  spr.setTextColor(0x252525UL);
  spr.setTextDatum(MC_DATUM);
  spr.drawString("M", DISPLAY_WIDTH / 2, DISPLAY_HEIGHT / 2 - 20);

  spr.setTextSize(1);
  spr.setTextColor(C_DIM);
  spr.drawString("No active deals", DISPLAY_WIDTH / 2, DISPLAY_HEIGHT / 2 + 30);
  spr.drawString("Watch the app", DISPLAY_WIDTH / 2, DISPLAY_HEIGHT / 2 + 45);

  // BLE dot
  spr.fillCircle(10, 10, 4, g_state.bleConnected ? C_GREEN : C_DIM);

  // Page dots
  int dotY = DISPLAY_HEIGHT - 12;
  spr.fillCircle(DISPLAY_WIDTH / 2 - 8, dotY, 2, C_DIM);
  spr.fillCircle(DISPLAY_WIDTH / 2 + 8, dotY, 4, C_WHITE);  // active
}

void SaleScreen::drawActiveSale(LGFX_Sprite& spr) {
  spr.fillScreen(C_BG);

  // Flash border: alternates red/dim for first 6 half-cycles
  uint32_t borderCol = (_flashCount < 6 && (_flashCount % 2 == 0)) ? C_RED : C_PINK;
  drawBorder(spr, borderCol);

  // Header
  spr.setTextSize(1);
  spr.setTextDatum(MC_DATUM);
  spr.setTextColor(C_PINK);
  spr.drawString("! FLASH SALE !", DISPLAY_WIDTH / 2, 15);

  // Store name
  spr.setTextSize(2);
  spr.setTextColor(C_WHITE);
  spr.drawString(g_state.sale.name, DISPLAY_WIDTH / 2, 38);

  // Discount
  spr.setTextSize(2);
  spr.setTextColor(C_PINK);
  spr.drawString(g_state.sale.discount, DISPLAY_WIDTH / 2, 62);

  // Divider
  spr.drawLine(20, 80, DISPLAY_WIDTH - 20, 80, C_DIM);

  // "WALK THIS WAY" label
  spr.setTextSize(1);
  spr.setTextColor(C_DIM);
  spr.drawString("WALK THIS WAY", DISPLAY_WIDTH / 2, 92);

  // Direction arrow
  if (g_state.sale.direction >= 0) {
    drawArrow(spr, DISPLAY_WIDTH / 2, 140, g_state.sale.direction);
  } else {
    spr.setTextColor(C_DIM);
    spr.drawString("?", DISPLAY_WIDTH / 2, 140);
  }

  // Countdown
  char countBuf[16];
  snprintf(countBuf, sizeof(countBuf), "%ds", _countdown);
  spr.setTextSize(1);
  spr.setTextColor(_countdown < 20 ? C_RED : C_DIM);
  spr.drawString(countBuf, DISPLAY_WIDTH / 2, 200);

  // GRAB button
  int bW = 130, bH = GRAB_H;
  int bX = (DISPLAY_WIDTH - bW) / 2;
  spr.fillRoundRect(bX, GRAB_Y, bW, bH, 8, C_PINK);
  spr.setTextSize(1);
  spr.setTextColor(C_WHITE);
  spr.setTextDatum(MC_DATUM);
  spr.drawString("GRAB DEAL", DISPLAY_WIDTH / 2, GRAB_Y + GRAB_H / 2);

  // DISMISS
  spr.setTextColor(C_DIM);
  spr.drawString("Dismiss", DISPLAY_WIDTH / 2, DISM_Y + DISM_H / 2);

  // BLE dot
  spr.fillCircle(10, 10, 4, g_state.bleConnected ? C_GREEN : C_DIM);

  // Page dots
  int dotY = DISPLAY_HEIGHT - 12;
  spr.fillCircle(DISPLAY_WIDTH / 2 - 8, dotY, 2, C_DIM);
  spr.fillCircle(DISPLAY_WIDTH / 2 + 8, dotY, 4, C_WHITE);
}

void SaleScreen::onTap(int x, int y) {
  if (!g_state.sale.active) return;
  if (y >= GRAB_Y && y <= GRAB_Y + GRAB_H) {
    ble_send_action("grab");
    g_state.sale.active = false;
  } else if (y >= DISM_Y && y <= DISM_Y + DISM_H) {
    ble_send_action("dismiss");
    g_state.sale.active = false;
  }
}

void SaleScreen::draw(LGFX_Sprite& spr) {
  if (g_state.sale.active) {
    drawActiveSale(spr);
  } else {
    drawIdle(spr);
  }
}
