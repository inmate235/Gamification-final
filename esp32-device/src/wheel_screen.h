#pragma once
#include <LovyanGFX.hpp>
#include "lgfx_config.h"
#include "shared_state.h"

class WheelScreen {
public:
  void init(LGFX* display);
  // Called every frame. Pass current millis().
  void update(uint32_t now);
  void draw(LGFX_Sprite& spr);
  // Called when the phone sends a spin result (segment + near-miss flag).
  void onSpinResult(int segment, bool nearMiss);
  // Called by touch handler when user taps this screen.
  void onTap(int x, int y);

private:
  LGFX* _display = nullptr;

  enum class Phase { IDLE, WAIT_RESULT, SPINNING, RESULT };
  Phase _phase = Phase::IDLE;

  float    _rotation          = 0.0f;
  float    _targetRotation    = 0.0f;
  float    _rotationAtStart   = 0.0f;
  uint32_t _spinStartTime     = 0;
  int      _resultSegment     = -1;
  bool     _resultNearMiss    = false;
  uint32_t _resultShownAt     = 0;
  bool     _lastWheelAvail    = false;  // detect edge: wheel becomes available

  // Helpers
  void     drawWheel(LGFX_Sprite& spr, float angle);
  void     drawPointer(LGFX_Sprite& spr);
  void     drawStatusRow(LGFX_Sprite& spr);
  void     drawSpinButton(LGFX_Sprite& spr);
  void     drawResultLabel(LGFX_Sprite& spr);
  float    easeOut(float t);
  float    computeTarget(float current, int segIndex);
};
