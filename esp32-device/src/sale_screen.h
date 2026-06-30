#pragma once
#include <LovyanGFX.hpp>
#include "lgfx_config.h"
#include "shared_state.h"

#define MAX_SALE_CONFETTI 20

struct SaleConfetti {
  float x, y, vx, vy;
  uint32_t color;
  int life;
  int size;
};

class SaleScreen {
public:
  void init(LGFX* display);
  void update(uint32_t now);
  void draw(LGFX_Sprite& spr);
  void onTap(int x, int y);
  void triggerDemoSale();
  void setCountdownPause(bool paused);

private:
  LGFX*    _display      = nullptr;
  bool     _lastActive   = false;
  uint8_t  _flashCount   = 0;
  uint32_t _flashTimer   = 0;
  int      _countdown    = 0;
  uint32_t _lastTickAt   = 0;
  bool     _countdownPaused = false;

  SaleConfetti _confetti[MAX_SALE_CONFETTI];
  bool     _confettiActive = false;

  void drawIdle(LGFX_Sprite& spr);
  void drawActiveSale(LGFX_Sprite& spr);
  void drawArrow(LGFX_Sprite& spr, int cx, int cy, int dir);
  void drawBorder(LGFX_Sprite& spr, uint32_t col);
  void drawConfetti(LGFX_Sprite& spr);
  void spawnConfetti();
  void updateConfetti();
};
