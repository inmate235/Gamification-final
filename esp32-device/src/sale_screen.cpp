#include "sale_screen.h"
#include "ble_manager.h"
#include "config.h"
#include <math.h>

static constexpr float DEG2RAD = M_PI / 180.0f;

// Landscape button regions — bigger, clearly separated
#define ARROW_CX   240
#define ARROW_CY   70
#define GRAB_X     15
#define GRAB_Y     128
#define GRAB_W     135
#define GRAB_H     30
#define DISM_X     170
#define DISM_Y     128
#define DISM_W     135
#define DISM_H     30

void SaleScreen::init(LGFX* display) {
  _display = display;
}

void SaleScreen::setCountdownPause(bool paused) {
  _countdownPaused = paused;
  if (!paused) _lastTickAt = millis();  // reset tick timer when unpausing
}

void SaleScreen::update(uint32_t now) {
  bool active = g_state.sale.active;
  if (active && !_lastActive) {
    _flashCount = 0;
    _flashTimer = now;
    _countdown  = g_state.sale.countdownSeconds;
    _lastTickAt = now;
  }
  _lastActive = active;
  if (!active) return;
  if (_flashCount < 6 && (now - _flashTimer) > 150) {
    _flashCount++;
    _flashTimer = now;
  }
  // Only tick countdown when sale screen is visible (not paused)
  if (!_countdownPaused && _countdown > 0 && (now - _lastTickAt) >= 1000) {
    _countdown--;
    _lastTickAt = now;
    if (_countdown <= 0) g_state.sale.active = false;
  }
  if (g_state.sale.countdownSeconds < _countdown) {
    _countdown = g_state.sale.countdownSeconds;
  }
  if (_confettiActive) updateConfetti();
}

void SaleScreen::drawBorder(LGFX_Sprite& spr, uint32_t col) {
  spr.drawRect(1, 1, DISPLAY_WIDTH - 2, DISPLAY_HEIGHT - 2, col);
  spr.drawRect(2, 2, DISPLAY_WIDTH - 4, DISPLAY_HEIGHT - 4, col);
}

void SaleScreen::drawArrow(LGFX_Sprite& spr, int cx, int cy, int dir) {
  float angleDeg = dir * 45.0f - 90.0f;
  float rad = angleDeg * DEG2RAD;
  int shaft = 28;
  int ex = cx + (int)(shaft * cosf(rad));
  int ey = cy + (int)(shaft * sinf(rad));
  for (int t = -1; t <= 1; t++) {
    float pr = rad + M_PI / 2.0f;
    int ox = (int)(t * cosf(pr));
    int oy = (int)(t * sinf(pr));
    spr.drawLine(cx + ox, cy + oy, ex + ox, ey + oy, C_WHITE);
  }
  float backRad = rad + M_PI;
  float headLen = 14.0f;
  float spread  = 0.6f;
  int hx1 = ex + (int)(headLen * cosf(backRad - spread));
  int hy1 = ey + (int)(headLen * sinf(backRad - spread));
  int hx2 = ex + (int)(headLen * cosf(backRad + spread));
  int hy2 = ey + (int)(headLen * sinf(backRad + spread));
  spr.fillTriangle(ex, ey, hx1, hy1, hx2, hy2, C_WHITE);
}

void SaleScreen::spawnConfetti() {
  static const uint32_t colors[] = {
    0xE6009EUL, 0xFFD700UL, 0xFF8CDBUL, 0xFFFFFFUL, 0x10B981UL
  };
  for (int i = 0; i < MAX_SALE_CONFETTI; i++) {
    float angle = (float)(rand() % 360) * DEG2RAD;
    float speed = 1.0f + (float)(rand() % 25) / 10.0f;
    _confetti[i].x = DISPLAY_WIDTH / 2;
    _confetti[i].y = DISPLAY_HEIGHT / 2;
    _confetti[i].vx = cosf(angle) * speed;
    _confetti[i].vy = sinf(angle) * speed - 1.0f;
    _confetti[i].color = colors[rand() % 5];
    _confetti[i].life = 35 + rand() % 25;
    _confetti[i].size = 2 + rand() % 2;
  }
  _confettiActive = true;
}

void SaleScreen::updateConfetti() {
  for (int i = 0; i < MAX_SALE_CONFETTI; i++) {
    if (_confetti[i].life <= 0) continue;
    _confetti[i].x += _confetti[i].vx;
    _confetti[i].y += _confetti[i].vy;
    _confetti[i].vy += 0.10f;
    _confetti[i].vx *= 0.98f;
    _confetti[i].life--;
  }
}

void SaleScreen::drawConfetti(LGFX_Sprite& spr) {
  if (!_confettiActive) return;
  for (int i = 0; i < MAX_SALE_CONFETTI; i++) {
    if (_confetti[i].life <= 0) continue;
    spr.fillCircle((int)_confetti[i].x, (int)_confetti[i].y,
                   _confetti[i].size, _confetti[i].color);
  }
}

// Demo deals shown as tappable buttons on the deals list
struct DemoDeal {
  const char* name;
  const char* discount;
  int direction;
  int distance;
};

static const DemoDeal DEMO_DEALS[] = {
  {"TechNova",   "40% OFF",      2, 30},  // East
  {"Bloom",      "30% OFF",      6, 15},  // West
  {"Cafe Nuit",  "Buy 1 Get 1",  0, 45},  // North
};
#define NUM_DEMO_DEALS 3
#define DEAL_BTN_H  34
#define DEAL_BTN_Y0 38
#define DEAL_BTN_X  10
#define DEAL_BTN_W  300

void SaleScreen::drawIdle(LGFX_Sprite& spr) {
  spr.fillScreen(C_BG);

  // Branding
  spr.setTextSize(1);
  spr.setTextDatum(TL_DATUM);
  spr.setTextColor(C_PINK_DIM);
  spr.drawString("MurkyMall", 8, 5);

  // Header
  spr.setTextDatum(TC_DATUM);
  spr.setTextColor(C_PINK);
  spr.setTextSize(2);
  spr.drawString("DEALS", DISPLAY_WIDTH / 2, 15);
  spr.setTextSize(1);

  // Deal buttons
  for (int i = 0; i < NUM_DEMO_DEALS; i++) {
    int by = DEAL_BTN_Y0 + i * DEAL_BTN_H;
    // Button background
    spr.fillRoundRect(DEAL_BTN_X, by, DEAL_BTN_W, DEAL_BTN_H - 4, 6, 0x1E1E1EUL);
    spr.drawRoundRect(DEAL_BTN_X, by, DEAL_BTN_W, DEAL_BTN_H - 4, 6, 0x333333UL);

    // Store name
    spr.setTextDatum(TL_DATUM);
    spr.setTextSize(2);
    spr.setTextColor(C_WHITE);
    spr.drawString(DEMO_DEALS[i].name, DEAL_BTN_X + 10, by + 5);

    // Discount
    spr.setTextSize(1);
    spr.setTextColor(C_PINK);
    spr.drawString(DEMO_DEALS[i].discount, DEAL_BTN_X + 10, by + 24);

    // Distance on right side
    char distBuf[12];
    snprintf(distBuf, sizeof(distBuf), "%dm", DEMO_DEALS[i].distance);
    spr.setTextDatum(TC_DATUM);
    spr.setTextColor(C_GOLD);
    spr.drawString(distBuf, DEAL_BTN_X + DEAL_BTN_W - 50, by + 14);

    // Small arrow icon pointing in deal direction
    int arrowX = DEAL_BTN_X + DEAL_BTN_W - 20;
    int arrowY = by + 14;
    float aDeg = DEMO_DEALS[i].direction * 45.0f - 90.0f;
    float rad = aDeg * DEG2RAD;
    int ex = arrowX + (int)(8 * cosf(rad));
    int ey = arrowY + (int)(8 * sinf(rad));
    spr.drawLine(arrowX, arrowY, ex, ey, C_DIM);
    // Arrowhead
    float back = rad + M_PI;
    spr.drawLine(ex, ey, ex + (int)(5 * cosf(back - 0.5f)), ey + (int)(5 * sinf(back - 0.5f)), C_DIM);
    spr.drawLine(ex, ey, ex + (int)(5 * cosf(back + 0.5f)), ey + (int)(5 * sinf(back + 0.5f)), C_DIM);
  }

  // BLE dot
  spr.fillCircle(8, 8, 4, g_state.bleConnected ? C_GREEN : C_DIM);

  // Page dots
  int dotY = DISPLAY_HEIGHT - 8;
  spr.fillCircle(DISPLAY_WIDTH / 2 - 8, dotY, 2, C_DIM);
  spr.fillCircle(DISPLAY_WIDTH / 2 + 8, dotY, 3, C_WHITE);
}

void SaleScreen::drawActiveSale(LGFX_Sprite& spr) {
  spr.fillScreen(C_BG);

  uint32_t borderCol = (_flashCount < 6 && (_flashCount % 2 == 0)) ? C_RED : C_PINK;
  drawBorder(spr, borderCol);

  // Branding top-left
  spr.setTextSize(1);
  spr.setTextDatum(TL_DATUM);
  spr.setTextColor(C_PINK_DIM);
  spr.drawString("MurkyMall", 22, 5);

  // Header centered at top
  spr.setTextDatum(TC_DATUM);
  spr.setTextColor(C_PINK);
  spr.drawString("! FLASH SALE !", DISPLAY_WIDTH / 2, 8);

  // Left side: store info
  spr.setTextDatum(TL_DATUM);
  spr.setTextSize(2);
  spr.setTextColor(C_WHITE);
  spr.drawString(g_state.sale.name, 12, 25);

  spr.setTextSize(2);
  spr.setTextColor(C_PINK);
  spr.drawString(g_state.sale.discount, 12, 48);

  // Countdown
  char countBuf[16];
  snprintf(countBuf, sizeof(countBuf), "%ds left", _countdown);
  spr.setTextSize(1);
  spr.setTextColor(_countdown < 20 ? C_RED : C_DIM);
  spr.drawString(countBuf, 12, 75);

  // Divider
  spr.drawLine(160, 20, 160, 115, 0x333333UL);

  // Right side: direction arrow
  spr.setTextDatum(TC_DATUM);
  spr.setTextSize(1);
  spr.setTextColor(C_DIM);
  spr.drawString("WALK", ARROW_CX, 28);
  spr.drawString("THIS WAY", ARROW_CX, 40);

  if (g_state.sale.direction >= 0) {
    drawArrow(spr, ARROW_CX, ARROW_CY, g_state.sale.direction);
  } else {
    spr.setTextColor(C_DIM);
    spr.drawString("?", ARROW_CX, ARROW_CY);
  }

  // Distance under arrow
  if (g_state.sale.distanceMeters > 0) {
    char distBuf[16];
    snprintf(distBuf, sizeof(distBuf), "%dm", g_state.sale.distanceMeters);
    spr.setTextSize(2);
    spr.setTextColor(C_GOLD);
    spr.drawString(distBuf, ARROW_CX, ARROW_CY + 28);
    spr.setTextSize(1);
  }

  // GRAB button (left)
  spr.fillRoundRect(GRAB_X, GRAB_Y, GRAB_W, GRAB_H, 8, C_PINK);
  spr.setTextSize(1);
  spr.setTextColor(C_WHITE);
  spr.setTextDatum(MC_DATUM);
  spr.drawString("GRAB DEAL", GRAB_X + GRAB_W / 2, GRAB_Y + GRAB_H / 2);

  // DISMISS button (right) — clearly visible, returns to deals list
  spr.fillRoundRect(DISM_X, DISM_Y, DISM_W, DISM_H, 8, 0x2A2A2AUL);
  spr.drawRoundRect(DISM_X, DISM_Y, DISM_W, DISM_H, 8, 0x666666UL);
  spr.setTextColor(0xAAAAAAUL);
  spr.drawString("DISMISS", DISM_X + DISM_W / 2, DISM_Y + DISM_H / 2);

  // BLE dot
  spr.fillCircle(8, 8, 4, g_state.bleConnected ? C_GREEN : C_DIM);

  // Page dots
  int dotY = DISPLAY_HEIGHT - 8;
  spr.fillCircle(DISPLAY_WIDTH / 2 - 8, dotY, 2, C_DIM);
  spr.fillCircle(DISPLAY_WIDTH / 2 + 8, dotY, 3, C_WHITE);

  // Confetti overlay
  drawConfetti(spr);
}

void SaleScreen::triggerDemoSale() {
  // Called by side button — pick random deal
  int idx = rand() % NUM_DEMO_DEALS;
  g_state.sale.active           = true;
  g_state.sale.countdownSeconds = 120;
  g_state.sale.direction        = DEMO_DEALS[idx].direction;
  g_state.sale.distanceMeters   = DEMO_DEALS[idx].distance;
  g_state.sale.receivedAt       = millis();
  strlcpy(g_state.sale.name,     DEMO_DEALS[idx].name,     sizeof(g_state.sale.name));
  strlcpy(g_state.sale.discount, DEMO_DEALS[idx].discount, sizeof(g_state.sale.discount));
}

void SaleScreen::onTap(int x, int y) {
  if (!g_state.sale.active) {
    // Check which deal button was tapped
    for (int i = 0; i < NUM_DEMO_DEALS; i++) {
      int by = DEAL_BTN_Y0 + i * DEAL_BTN_H;
      if (x >= DEAL_BTN_X && x <= DEAL_BTN_X + DEAL_BTN_W &&
          y >= by && y <= by + DEAL_BTN_H - 4) {
        g_state.sale.active           = true;
        g_state.sale.countdownSeconds = 120;
        g_state.sale.direction        = DEMO_DEALS[i].direction;
        g_state.sale.distanceMeters   = DEMO_DEALS[i].distance;
        g_state.sale.receivedAt       = millis();
        strlcpy(g_state.sale.name,     DEMO_DEALS[i].name,     sizeof(g_state.sale.name));
        strlcpy(g_state.sale.discount, DEMO_DEALS[i].discount, sizeof(g_state.sale.discount));
        return;
      }
    }
    return;
  }
  if (x >= GRAB_X && x <= GRAB_X + GRAB_W && y >= GRAB_Y && y <= GRAB_Y + GRAB_H) {
    ble_send_action("grab");
    spawnConfetti();
    g_state.sale.active = false;
  } else if (x >= DISM_X && x <= DISM_X + DISM_W && y >= DISM_Y && y <= DISM_Y + DISM_H) {
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
