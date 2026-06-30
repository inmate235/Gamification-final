#pragma once
#include <LovyanGFX.hpp>
#include "lgfx_config.h"
#include "shared_state.h"

#define MAX_CONFETTI 30

struct ConfettiParticle {
  float x, y, vx, vy;
  uint32_t color;
  int life;
  int size;
};

class WheelScreen {
public:
  void init(LGFX* display);
  void update(uint32_t now);
  void draw(LGFX_Sprite& spr);
  void onSpinResult(int segment, bool nearMiss);
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
  bool     _lastWheelAvail    = false;
  uint32_t _pulseTimer        = 0;

  ConfettiParticle _confetti[MAX_CONFETTI];
  bool _confettiActive = false;

  void     drawWheel(LGFX_Sprite& spr, float angle);
  void     drawPointer(LGFX_Sprite& spr);
  void     drawStatusRow(LGFX_Sprite& spr);
  void     drawSpinButton(LGFX_Sprite& spr);
  void     drawResultLabel(LGFX_Sprite& spr);
  void     drawSegmentLabels(LGFX_Sprite& spr, float angle);
  void     drawConfetti(LGFX_Sprite& spr);
  void     spawnConfetti();
  void     updateConfetti();
  float    easeOut(float t);
  float    computeTarget(float current, int segIndex);
  void     startLocalSpin();
};
