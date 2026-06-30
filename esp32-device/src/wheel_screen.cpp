#include "wheel_screen.h"
#include "ble_manager.h"
#include "config.h"
#include <math.h>

static constexpr float DEG2RAD = M_PI / 180.0f;

void WheelScreen::init(LGFX* display) {
  _display = display;
}

// Cubic ease-out matching app's animation curve
float WheelScreen::easeOut(float t) {
  float f = 1.0f - t;
  return 1.0f - f * f * f;
}

// Replicate app's computeTargetRotation
float WheelScreen::computeTarget(float current, int segIndex) {
  float targetMod = fmod(360.0f - segIndex * SEGMENT_ANGLE, 360.0f);
  float currentMod = fmod(fmod(current, 360.0f) + 360.0f, 360.0f);
  float delta = fmod(targetMod - currentMod + 360.0f, 360.0f);
  return current + delta + 360.0f * 5; // 5 full spins
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
  if (_phase == Phase::IDLE && g_state.wheelAvailable) {
    _phase = Phase::WAIT_RESULT;
    ble_send_action("spin");
  }
}

void WheelScreen::update(uint32_t now) {
  // Detect wheel becoming available (for visual pulse)
  if (g_state.wheelAvailable != _lastWheelAvail) {
    _lastWheelAvail = g_state.wheelAvailable;
  }
  // Pick up spin result set by BLE
  if (_phase == Phase::WAIT_RESULT && g_state.spinSegment >= 0) {
    onSpinResult(g_state.spinSegment, g_state.spinNearMiss);
    g_state.spinSegment = -1;
  }
  if (_phase == Phase::SPINNING) {
    float elapsed = (float)(now - _spinStartTime);
    float t = elapsed / SPIN_DURATION_MS;
    if (t >= 1.0f) t = 1.0f;
    float eased = easeOut(t);
    _rotation = _rotationAtStart + (_targetRotation - _rotationAtStart) * eased;
    if (t >= 1.0f) {
      _rotation = _targetRotation;
      _phase = Phase::RESULT;
      _resultShownAt = now;
    }
  }
  if (_phase == Phase::RESULT && (now - _resultShownAt) > RESULT_SHOW_MS) {
    _phase = Phase::IDLE;
  }
}

void WheelScreen::drawWheel(LGFX_Sprite& spr, float angle) {
  for (int seg = 0; seg < NUM_SEGMENTS; seg++) {
    float startA = angle + seg * SEGMENT_ANGLE - 90.0f;
    float endA   = startA + SEGMENT_ANGLE;
    uint32_t col = SEGMENT_COLORS[seg];
    for (float a = startA; a < endA - 0.5f; a += 1.5f) {
      float r1 = a * DEG2RAD;
      float r2 = (a + 1.5f) * DEG2RAD;
      int x1 = WHEEL_CX + (int)(WHEEL_R * cosf(r1));
      int y1 = WHEEL_CY + (int)(WHEEL_R * sinf(r1));
      int x2 = WHEEL_CX + (int)(WHEEL_R * cosf(r2));
      int y2 = WHEEL_CY + (int)(WHEEL_R * sinf(r2));
      spr.fillTriangle(WHEEL_CX, WHEEL_CY, x1, y1, x2, y2, col);
    }
  }
  // Segment dividers
  for (int i = 0; i < NUM_SEGMENTS; i++) {
    float r = (angle + i * SEGMENT_ANGLE - 90.0f) * DEG2RAD;
    int x = WHEEL_CX + (int)(WHEEL_R * cosf(r));
    int y = WHEEL_CY + (int)(WHEEL_R * sinf(r));
    spr.drawLine(WHEEL_CX, WHEEL_CY, x, y, C_WHITE);
  }
  // Outer ring
  spr.drawCircle(WHEEL_CX, WHEEL_CY, WHEEL_R,     C_WHITE);
  spr.drawCircle(WHEEL_CX, WHEEL_CY, WHEEL_R + 1, 0x444444UL);
  // Center hub
  spr.fillCircle(WHEEL_CX, WHEEL_CY, WHEEL_HUB_R, C_PINK);
  spr.drawCircle(WHEEL_CX, WHEEL_CY, WHEEL_HUB_R, C_WHITE);
}

void WheelScreen::drawPointer(LGFX_Sprite& spr) {
  int tipY  = WHEEL_CY - WHEEL_R - 14;
  int baseY = WHEEL_CY - WHEEL_R - 2;
  spr.fillTriangle(WHEEL_CX, tipY,
                   WHEEL_CX - 9, baseY,
                   WHEEL_CX + 9, baseY,
                   C_PINK);
  spr.drawTriangle(WHEEL_CX, tipY,
                   WHEEL_CX - 9, baseY,
                   WHEEL_CX + 9, baseY,
                   C_WHITE);
}

void WheelScreen::drawStatusRow(LGFX_Sprite& spr) {
  spr.setTextSize(1);
  spr.setTextColor(C_DIM);
  spr.setTextDatum(TL_DATUM);
  // BLE dot
  spr.fillCircle(10, 10, 4, g_state.bleConnected ? C_GREEN : C_DIM);
  // Token balance
  char buf[24];
  snprintf(buf, sizeof(buf), "%d tokens", g_state.tokenBalance);
  spr.setTextColor(C_GOLD);
  spr.drawString(buf, DISPLAY_WIDTH / 2 - 28, 6);
}

void WheelScreen::drawSpinButton(LGFX_Sprite& spr) {
  int bY = WHEEL_CY + WHEEL_R + 28;
  int bW = 110, bH = 30;
  int bX = (DISPLAY_WIDTH - bW) / 2;

  if (_phase == Phase::IDLE) {
    if (g_state.wheelAvailable) {
      spr.fillRoundRect(bX, bY, bW, bH, 8, C_PINK);
      spr.setTextColor(C_WHITE);
      spr.setTextDatum(MC_DATUM);
      spr.drawString("TAP TO SPIN", DISPLAY_WIDTH / 2, bY + bH / 2);
    } else {
      spr.fillRoundRect(bX, bY, bW, bH, 8, 0x222222UL);
      spr.setTextColor(C_DIM);
      spr.setTextDatum(MC_DATUM);
      spr.drawString("WAIT...", DISPLAY_WIDTH / 2, bY + bH / 2);
    }
  } else if (_phase == Phase::WAIT_RESULT) {
    spr.setTextColor(C_DIM);
    spr.setTextDatum(MC_DATUM);
    spr.drawString("Waiting...", DISPLAY_WIDTH / 2, bY + bH / 2);
  } else if (_phase == Phase::SPINNING) {
    spr.setTextColor(0x888888UL);
    spr.setTextDatum(MC_DATUM);
    spr.drawString("Spinning...", DISPLAY_WIDTH / 2, bY + bH / 2);
  }
}

void WheelScreen::drawResultLabel(LGFX_Sprite& spr) {
  if (_phase != Phase::RESULT || _resultSegment < 0) return;
  const char* msg = _resultNearMiss ? "SO CLOSE!" : SEGMENT_LABELS[_resultSegment];
  uint32_t col = _resultNearMiss ? C_PINK : SEGMENT_COLORS[_resultSegment];
  spr.setTextDatum(MC_DATUM);
  spr.setTextSize(2);
  spr.setTextColor(col);
  spr.drawString(msg, DISPLAY_WIDTH / 2, WHEEL_CY + WHEEL_R + 20);
  spr.setTextSize(1);
}

void WheelScreen::draw(LGFX_Sprite& spr) {
  spr.fillScreen(C_BG);
  // Header
  spr.setTextSize(1);
  spr.setTextDatum(MC_DATUM);
  spr.setTextColor(C_PINK);
  spr.drawString("MYSTIC WHEEL", DISPLAY_WIDTH / 2, 20);

  drawStatusRow(spr);
  drawWheel(spr, _rotation);
  drawPointer(spr);
  drawSpinButton(spr);
  drawResultLabel(spr);

  // Page dots
  int dotY = DISPLAY_HEIGHT - 12;
  spr.fillCircle(DISPLAY_WIDTH / 2 - 8, dotY, 4, C_WHITE);  // active
  spr.fillCircle(DISPLAY_WIDTH / 2 + 8, dotY, 2, C_DIM);
}
