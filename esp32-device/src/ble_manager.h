#pragma once
#include <NimBLEDevice.h>
#include "shared_state.h"

void ble_init();
void ble_send_action(const char* action);  // "spin" | "grab" | "dismiss"
bool ble_is_connected();
