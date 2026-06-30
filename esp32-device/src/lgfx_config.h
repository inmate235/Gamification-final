#pragma once

#define LGFX_USE_V1
#include <LovyanGFX.hpp>
#include "config.h"

class LGFX : public lgfx::LGFX_Device {
  lgfx::Panel_ST7789  _panel;
  lgfx::Bus_SPI       _bus;
  lgfx::Light_PWM     _light;
  lgfx::Touch_CST816S _touch;

public:
  LGFX() {
    { // SPI bus
      auto cfg        = _bus.config();
      cfg.spi_host    = SPI2_HOST;
      cfg.spi_mode    = 0;
      cfg.freq_write  = 80000000;
      cfg.pin_sclk    = TFT_SCLK;
      cfg.pin_mosi    = TFT_MOSI;
      cfg.pin_miso    = -1;
      cfg.pin_dc      = TFT_DC;
      _bus.config(cfg);
      _panel.setBus(&_bus);
    }
    { // Panel
      auto cfg          = _panel.config();
      cfg.pin_cs        = TFT_CS;
      cfg.pin_rst       = TFT_RST;
      cfg.panel_width   = DISPLAY_WIDTH;
      cfg.panel_height  = DISPLAY_HEIGHT;
      cfg.offset_x      = 35;  // ST7789 is addressed in a 240-wide space
      cfg.offset_y      = 0;
      cfg.invert        = true;
      cfg.rgb_order     = false;
      cfg.readable      = false;
      cfg.bus_shared    = false;
      _panel.config(cfg);
    }
    { // Backlight
      auto cfg        = _light.config();
      cfg.pin_bl      = TFT_BL;
      cfg.invert      = false;
      cfg.freq        = 44100;
      cfg.pwm_channel = 7;
      _light.config(cfg);
      _panel.setLight(&_light);
    }
    { // Capacitive touch (CST816S)
      auto cfg        = _touch.config();
      cfg.x_min       = 0;
      cfg.x_max       = DISPLAY_WIDTH  - 1;
      cfg.y_min       = 0;
      cfg.y_max       = DISPLAY_HEIGHT - 1;
      cfg.pin_int     = TOUCH_INT;
      cfg.pin_rst     = TOUCH_RST;
      cfg.i2c_host    = I2C_NUM_0;
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
