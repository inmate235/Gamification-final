#pragma once

#define LGFX_USE_V1
#include <LovyanGFX.hpp>
#include "config.h"

// Config matched exactly to official LILYGO T-Display-S3 LovyanGFX examples
class LGFX : public lgfx::LGFX_Device {
  lgfx::Bus_Parallel8  _bus;
  lgfx::Panel_ST7789   _panel;
  lgfx::Light_PWM      _light;
  lgfx::Touch_CST816S  _touch;

public:
  LGFX() {
    { // 8-bit parallel bus
      auto cfg = _bus.config();
      cfg.pin_wr = PIN_LCD_WR;
      cfg.pin_rd = PIN_LCD_RD;
      cfg.pin_rs = PIN_LCD_DC;
      cfg.pin_d0 = PIN_LCD_D0;
      cfg.pin_d1 = PIN_LCD_D1;
      cfg.pin_d2 = PIN_LCD_D2;
      cfg.pin_d3 = PIN_LCD_D3;
      cfg.pin_d4 = PIN_LCD_D4;
      cfg.pin_d5 = PIN_LCD_D5;
      cfg.pin_d6 = PIN_LCD_D6;
      cfg.pin_d7 = PIN_LCD_D7;
      _bus.config(cfg);
      _panel.setBus(&_bus);
    }
    { // Panel
      auto cfg = _panel.config();
      cfg.pin_cs    = PIN_LCD_CS;
      cfg.pin_rst   = PIN_LCD_RES;
      cfg.pin_busy  = -1;
      cfg.offset_rotation = 1;
      cfg.offset_x  = 35;
      cfg.readable  = false;
      cfg.invert    = true;
      cfg.rgb_order = false;
      cfg.dlen_16bit = false;
      cfg.bus_shared = false;
      cfg.panel_width  = 170;
      cfg.panel_height = 320;
      _panel.config(cfg);
    }
    { // Backlight
      auto cfg = _light.config();
      cfg.pin_bl      = PIN_LCD_BL;
      cfg.invert      = false;
      cfg.freq        = 22000;
      cfg.pwm_channel = 7;
      _light.config(cfg);
      _panel.setLight(&_light);
    }
    { // Capacitive touch (CST816S via I2C)
      auto cfg = _touch.config();
      cfg.x_min       = 0;
      cfg.x_max       = 169;   // physical panel width (portrait)
      cfg.y_min       = 0;
      cfg.y_max       = 319;   // physical panel height (portrait)
      // LovyanGFX auto-rotates touch coords based on panel offset_rotation
      cfg.pin_int     = TOUCH_INT;
      cfg.pin_rst     = TOUCH_RST;
      cfg.i2c_port    = 0;
      cfg.i2c_addr    = 0x15;
      cfg.pin_sda     = TOUCH_SDA;
      cfg.pin_scl     = TOUCH_SCL;
      cfg.freq        = 400000;
      cfg.bus_shared  = false;
      _touch.config(cfg);
      _panel.setTouch(&_touch);
    }
    setPanel(&_panel);
  }
};
