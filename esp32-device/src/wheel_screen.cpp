#include "wheel_screen.h"
#include "ble_manager.h"
#include "config.h"
#include <math.h>
#include <stdlib.h>

static constexpr float DEG2RAD = M_PI / 180.0f;

#define PANEL_X    180
#define PANEL_W    (DISPLAY_WIDTH - PANEL_X - 5)

// Near-miss weights — tuned for demo (more wins, fewer misses)
static const float BASE_WEIGHTS[7] = {0.15f, 0.18f, 0.12f, 0.18f, 0.12f, 0.20f, 0.05f};
#define NEAR_MISS_THRESHOLD 0.10f   // 10% near-miss (was 40%)
#define NEAR_MISS_INDEX     6

void WheelScreen::init(LGFX* display) {
  _display = display;
}

float WheelScreen::easeOut(float t) {
  float f = 1.0f - t;
  return 1.0f - f * f * f;
}

float WheelScreen::computeTarget(float current, int segIndex) {
  // Center the segment under the top pointer: offset by half a segment angle
  float targetMod = fmod(360.0f - segIndex * SEGMENT_ANGLE - SEGMENT_ANGLE / 2.0f, 360.0f);
  if (targetMod < 0) targetMod += 360.0f;
  float currentMod = fmod(fmod(current, 360.0f) + 360.0f, 360.0f);
  float delta = fmod(targetMod - currentMod + 360.0f, 360.0f);
  return current + delta + 360.0f * 5;
}

// Generate a local spin result (same algorithm as the phone app)
void WheelScreen::startLocalSpin() {
  float r = (float)rand() / (float)RAND_MAX;
  int segment;
  bool nearMiss;

  if (r < NEAR_MISS_THRESHOLD) {
    segment = NEAR_MISS_INDEX;
    nearMiss = true;
  } else {
    // Weighted pick
    float total = 0;
    for (int i = 0; i < 7; i++) total += BASE_WEIGHTS[i];
    float pick = ((float)rand() / (float)RAND_MAX) * total;
    segment = 0;
    for (int i = 0; i < 7; i++) {
      pick -= BASE_WEIGHTS[i];
      if (pick <= 0) { segment = i; break; }
    }
    nearMiss = false;
  }

  _resultSegment  = segment;
  _resultNearMiss = nearMiss;
  _rotationAtStart = _rotation;
  _targetRotation  = computeTarget(_rotation, segment);
  _spinStartTime   = millis();
  _phase           = Phase::SPINNING;
}

void WheelScreen::onSpinResult(int segment, bool nearMiss) {
  if (_phase != Phase::WAIT_RESULT) return;
  _resultSegment  = segment;
  _resultNearMiss = nearMiss;
  _rotationAtStart = _rotation;
  _targetRotation  = computeTarget(_rotation, segment);
  _spinStartTime   = millis();
  _phase           = Phase::SPINNING;
}

void WheelScreen::onTap(int x, int y) {
  if (_phase != Phase::IDLE) return;
  if (!g_state.wheelAvailable) return;

  if (g_state.bleConnected) {
    // BLE mode: send action, wait for phone to compute result
    _phase = Phase::WAIT_RESULT;
    ble_send_action("spin");
  } else {
    // Standalone demo mode: generate result locally
    startLocalSpin();
  }
}

void WheelScreen::update(uint32_t now) {
  if (g_state.wheelAvailable != _lastWheelAvail) {
    _lastWheelAvail = g_state.wheelAvailable;
    _pulseTimer = now;
  }
  if (_phase == Phase::WAIT_RESULT && g_state.spinSegment >= 0) {
    onSpinResult(g_state.spinSegment, g_state.spinNearMiss);
    g_state.spinSegment = -1;
  }
  if (_phase == Phase::SPINNING) {
    // Use millis() directly for accurate timing (avoids stale `now` from loop)
    float elapsed = (float)(millis() - _spinStartTime);
    float t = elapsed / SPIN_DURATION_MS;
    if (t < 0.0f) t = 0.0f;     // guard against negative timing
    if (t >= 1.0f) t = 1.0f;
    float eased = easeOut(t);
    _rotation = _rotationAtStart + (_targetRotation - _rotationAtStart) * eased;
    if (t >= 1.0f) {
      _rotation = _targetRotation;
      _phase = Phase::RESULT;
      _resultShownAt = now;
      // Spawn confetti on any win (not near-miss)
      if (!_resultNearMiss && _resultSegment >= 0) {
        spawnConfetti();
      }
    }
  }
  if (_phase == Phase::RESULT && (now - _resultShownAt) > RESULT_SHOW_MS) {
    _phase = Phase::IDLE;
    _confettiActive = false;
  }
  if (_confettiActive) updateConfetti();
}

void WheelScreen::spawnConfetti() {
  static const uint32_t confettiColors[] = {
    0xFFD700UL, 0xE6009EUL, 0x10B981UL, 0x06B6D4UL,
    0xF97316UL, 0xFF8CDBUL, 0x7C3AEDUL, 0xFFFFFFUL
  };
  for (int i = 0; i < MAX_CONFETTI; i++) {
    float angle = (float)(rand() % 360) * DEG2RAD;
    float speed = 1.0f + (float)(rand() % 20) / 10.0f;
    _confetti[i].x = DISPLAY_WIDTH / 2;   // center of screen
    _confetti[i].y = DISPLAY_HEIGHT / 2;
    _confetti[i].vx = cosf(angle) * speed;
    _confetti[i].vy = sinf(angle) * speed - 1.0f;
    _confetti[i].color = confettiColors[rand() % 8];
    _confetti[i].life = 60 + rand() % 40;
    _confetti[i].size = 4 + rand() % 3;   // bigger particles
  }
  _confettiActive = true;
}

void WheelScreen::updateConfetti() {
  for (int i = 0; i < MAX_CONFETTI; i++) {
    if (_confetti[i].life <= 0) continue;
    _confetti[i].x += _confetti[i].vx;
    _confetti[i].y += _confetti[i].vy;
    _confetti[i].vy += 0.12f;  // gravity
    _confetti[i].vx *= 0.98f;  // air resistance
    _confetti[i].life--;
  }
}

void WheelScreen::drawConfetti(LGFX_Sprite& spr) {
  if (!_confettiActive) return;
  for (int i = 0; i < MAX_CONFETTI; i++) {
    if (_confetti[i].life <= 0) continue;
    int alpha = _confetti[i].life > 10 ? 255 : _confetti[i].life * 25;
    if (alpha > 255) alpha = 255;
    spr.fillCircle((int)_confetti[i].x, (int)_confetti[i].y,
                   _confetti[i].size, _confetti[i].color);
  }
}

void WheelScreen::drawWheel(LGFX_Sprite& spr, float angle) {
  // Outer glow ring
  spr.drawCircle(WHEEL_CX, WHEEL_CY, WHEEL_R + 3, 0x2A2A2AUL);
  spr.drawCircle(WHEEL_CX, WHEEL_CY, WHEEL_R + 2, 0x3A3A3AUL);

  for (int seg = 0; seg < NUM_SEGMENTS; seg++) {
    float startA = angle + seg * SEGMENT_ANGLE - 90.0f;
    float endA   = startA + SEGMENT_ANGLE;
    uint32_t col = SEGMENT_COLORS[seg];
    for (float a = startA; a < endA - 0.5f; a += 1.0f) {
      float r1 = a * DEG2RAD;
      float r2 = (a + 1.0f) * DEG2RAD;
      int x1 = WHEEL_CX + (int)(WHEEL_R * cosf(r1));
      int y1 = WHEEL_CY + (int)(WHEEL_R * sinf(r1));
      int x2 = WHEEL_CX + (int)(WHEEL_R * cosf(r2));
      int y2 = WHEEL_CY + (int)(WHEEL_R * sinf(r2));
      spr.fillTriangle(WHEEL_CX, WHEEL_CY, x1, y1, x2, y2, col);
    }
  }

  // Segment dividers (white lines)
  for (int i = 0; i < NUM_SEGMENTS; i++) {
    float r = (angle + i * SEGMENT_ANGLE - 90.0f) * DEG2RAD;
    int x = WHEEL_CX + (int)(WHEEL_R * cosf(r));
    int y = WHEEL_CY + (int)(WHEEL_R * sinf(r));
    spr.drawLine(WHEEL_CX, WHEEL_CY, x, y, C_WHITE);
  }

  // Outer ring
  spr.drawCircle(WHEEL_CX, WHEEL_CY, WHEEL_R, C_WHITE);

  // Segment labels
  drawSegmentLabels(spr, angle);

  // Center hub with gradient effect
  spr.fillCircle(WHEEL_CX, WHEEL_CY, WHEEL_HUB_R + 2, 0x88005FUL);
  spr.fillCircle(WHEEL_CX, WHEEL_CY, WHEEL_HUB_R, C_PINK);
  spr.drawCircle(WHEEL_CX, WHEEL_CY, WHEEL_HUB_R, C_WHITE);
  spr.fillCircle(WHEEL_CX - 3, WHEEL_CY - 3, 3, 0xFF8CDBUL);
}

void WheelScreen::drawSegmentLabels(LGFX_Sprite& spr, float angle) {
  float labelR = WHEEL_R - 15;
  for (int seg = 0; seg < NUM_SEGMENTS; seg++) {
    float centerA = angle + seg * SEGMENT_ANGLE + SEGMENT_ANGLE / 2.0f - 90.0f;
    float rad = centerA * DEG2RAD;
    int lx = WHEEL_CX + (int)(labelR * cosf(rad));
    int ly = WHEEL_CY + (int)(labelR * sinf(rad));
    spr.setTextDatum(MC_DATUM);
    spr.setTextSize(1);
    spr.setTextColor(C_WHITE);
    spr.drawString(SEGMENT_LABELS[seg], lx, ly);
  }
}

void WheelScreen::drawPointer(LGFX_Sprite& spr) {
  // Pointer hangs above the wheel, tip pointing down INTO the wheel edge
  int tipY  = WHEEL_CY - WHEEL_R + 3;   // tip touches wheel surface
  int baseY = WHEEL_CY - WHEEL_R - 10;  // base is above the wheel
  // Shadow
  spr.fillTriangle(WHEEL_CX + 1, tipY + 1,
                   WHEEL_CX - 8, baseY + 1,
                   WHEEL_CX + 10, baseY + 1, 0x440022UL);
  // Pointer body (points downward)
  spr.fillTriangle(WHEEL_CX, tipY,
                   WHEEL_CX - 7, baseY,
                   WHEEL_CX + 9, baseY,
                   C_PINK);
  spr.drawTriangle(WHEEL_CX, tipY,
                   WHEEL_CX - 7, baseY,
                   WHEEL_CX + 9, baseY,
                   C_WHITE);
  // Highlight on pointer
  spr.fillCircle(WHEEL_CX, baseY + 3, 2, 0xFF8CDBUL);
}

void WheelScreen::drawStatusRow(LGFX_Sprite& spr) {
  // BLE dot top-left
  spr.fillCircle(8, 8, 4, g_state.bleConnected ? C_GREEN : C_DIM);

  // Token balance on right panel
  char buf[24];
  snprintf(buf, sizeof(buf), "%d tokens", g_state.tokenBalance);
  spr.setTextSize(1);
  spr.setTextDatum(TL_DATUM);
  spr.setTextColor(C_GOLD);
  spr.drawString(buf, PANEL_X, 30);

  // Tier indicator
  spr.setTextColor(C_DIM);
  spr.drawString("Spin the wheel", PANEL_X, 48);
}

void WheelScreen::drawSpinButton(LGFX_Sprite& spr) {
  int bW = 120, bH = 28;
  int bX = PANEL_X + (PANEL_W - bW) / 2;
  int bY = 95;

  if (_phase == Phase::IDLE) {
    if (g_state.wheelAvailable) {
      // Pulsing glow effect
      uint32_t now = millis();
      float pulse = 0.5f + 0.5f * sinf(now * 0.004f);
      uint32_t glowCol = spr.color888(
        (int)(230 * pulse + 20),
        (int)(pulse * 10),
        (int)(158 * pulse + 15));
      spr.fillRoundRect(bX - 2, bY - 2, bW + 4, bH + 4, 10, glowCol);
      spr.fillRoundRect(bX, bY, bW, bH, 8, C_PINK);
      spr.setTextColor(C_WHITE);
      spr.setTextDatum(MC_DATUM);
      spr.drawString("TAP TO SPIN", bX + bW / 2, bY + bH / 2);
    } else {
      spr.fillRoundRect(bX, bY, bW, bH, 8, 0x222222UL);
      spr.setTextColor(C_DIM);
      spr.setTextDatum(MC_DATUM);
      spr.drawString("WAIT...", bX + bW / 2, bY + bH / 2);
    }
  } else if (_phase == Phase::WAIT_RESULT) {
    spr.fillRoundRect(bX, bY, bW, bH, 8, 0x222222UL);
    spr.setTextColor(C_DIM);
    spr.setTextDatum(MC_DATUM);
    spr.drawString("Waiting...", bX + bW / 2, bY + bH / 2);
  } else if (_phase == Phase::SPINNING) {
    spr.fillRoundRect(bX, bY, bW, bH, 8, 0x222222UL);
    spr.setTextColor(0x888888UL);
    spr.setTextDatum(MC_DATUM);
    spr.drawString("Spinning...", bX + bW / 2, bY + bH / 2);
  }
}

void WheelScreen::drawResultLabel(LGFX_Sprite& spr) {
  if (_phase != Phase::RESULT || _resultSegment < 0) return;
  const char* msg = _resultNearMiss ? "SO CLOSE!" : SEGMENT_LABELS[_resultSegment];
  uint32_t col = _resultNearMiss ? C_PINK : SEGMENT_COLORS[_resultSegment];

  // Background box for result
  int bW = 130, bH = 24;
  int bX = PANEL_X + (PANEL_W - bW) / 2;
  int bY = 128;
  spr.fillRoundRect(bX, bY, bW, bH, 6, 0x000000UL);
  spr.drawRoundRect(bX, bY, bW, bH, 6, col);

  spr.setTextDatum(MC_DATUM);
  spr.setTextSize(2);
  spr.setTextColor(col);
  spr.drawString(msg, PANEL_X + PANEL_W / 2, bY + bH / 2);
  spr.setTextSize(1);
}

void WheelScreen::draw(LGFX_Sprite& spr) {
  spr.fillScreen(C_BG);

  // Branding top-left
  spr.setTextSize(1);
  spr.setTextDatum(TL_DATUM);
  spr.setTextColor(C_PINK_DIM);
  spr.drawString("MurkyMall", 22, 5);

  // Header on right panel
  spr.setTextColor(C_PINK);
  spr.drawString("MYSTIC WHEEL", PANEL_X, 10);

  // Divider line
  spr.drawLine(PANEL_X - 5, 5, PANEL_X - 5, DISPLAY_HEIGHT - 15, 0x333333UL);

  drawStatusRow(spr);
  drawWheel(spr, _rotation);
  drawPointer(spr);
  drawSpinButton(spr);
  drawResultLabel(spr);
  drawConfetti(spr);

  // Win flash border — pulses when celebrating a win
  if (_phase == Phase::RESULT && _confettiActive) {
    uint32_t now = millis();
    float pulse = 0.5f + 0.5f * sinf(now * 0.012f);
    uint32_t flashCol = spr.color888((int)(255 * pulse), (int)(215 * pulse), 0);
    spr.drawRect(0, 0, DISPLAY_WIDTH, DISPLAY_HEIGHT, flashCol);
    spr.drawRect(1, 1, DISPLAY_WIDTH - 2, DISPLAY_HEIGHT - 2, flashCol);
  }

  // Page dots
  int dotY = DISPLAY_HEIGHT - 8;
  spr.fillCircle(DISPLAY_WIDTH / 2 - 8, dotY, 3, C_WHITE);
  spr.fillCircle(DISPLAY_WIDTH / 2 + 8, dotY, 2, C_DIM);
}
