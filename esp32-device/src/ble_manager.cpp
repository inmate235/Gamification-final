#include "ble_manager.h"
#include "config.h"
#include "shared_state.h"
#include <ArduinoJson.h>
#include <string.h>

static NimBLEServer*         s_server     = nullptr;
static NimBLECharacteristic* s_stateChar  = nullptr;
static NimBLECharacteristic* s_actionChar = nullptr;

// ── Parse incoming state JSON from phone ──────────────────────────────────────
static void parse_state(const std::string& raw) {
  JsonDocument doc;
  if (deserializeJson(doc, raw) != DeserializationError::Ok) return;

  g_state.wheelAvailable = doc["w"].as<bool>();
  g_state.tokenBalance   = doc["t"].as<int>();
  g_state.spinSegment    = doc["seg"] | -1;
  g_state.spinNearMiss   = doc["nm"].as<bool>();

  JsonVariant sa = doc["sa"];
  if (!sa.isNull() && sa.is<JsonObject>()) {
    g_state.sale.active           = true;
    g_state.sale.countdownSeconds = sa["c"].as<int>();
    g_state.sale.direction        = sa["dir"] | -1;
    g_state.sale.receivedAt       = millis();
    strlcpy(g_state.sale.name,     sa["n"] | "",  sizeof(g_state.sale.name));
    strlcpy(g_state.sale.discount, sa["d"] | "",  sizeof(g_state.sale.discount));
  } else {
    g_state.sale.active = false;
  }
}

// ── NimBLE callbacks ──────────────────────────────────────────────────────────
class ServerCBs : public NimBLEServerCallbacks {
  void onConnect(NimBLEServer* pServer) override {
    g_state.bleConnected = true;
    Serial.println("[BLE] connected");
  }
  void onDisconnect(NimBLEServer* pServer) override {
    g_state.bleConnected = false;
    Serial.println("[BLE] disconnected — restarting adv");
    pServer->startAdvertising();
  }
};

class StateCharCBs : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic* pChar) override {
    parse_state(pChar->getValue());
  }
};

// ── Public API ────────────────────────────────────────────────────────────────
void ble_init() {
  NimBLEDevice::init(BLE_DEVICE_NAME);
  NimBLEDevice::setPower(ESP_PWR_LVL_P9);  // max TX power for demo room range

  s_server = NimBLEDevice::createServer();
  s_server->setCallbacks(new ServerCBs());

  NimBLEService* svc = s_server->createService(SERVICE_UUID);

  // State char: phone writes game state, ESP32 reads
  s_stateChar = svc->createCharacteristic(
    STATE_CHAR_UUID,
    NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::READ);
  s_stateChar->setCallbacks(new StateCharCBs());

  // Action char: ESP32 notifies actions, phone subscribes
  s_actionChar = svc->createCharacteristic(
    ACTION_CHAR_UUID,
    NIMBLE_PROPERTY::NOTIFY | NIMBLE_PROPERTY::READ);

  svc->start();

  NimBLEAdvertising* adv = NimBLEDevice::getAdvertising();
  adv->addServiceUUID(SERVICE_UUID);
  adv->setScanResponse(true);
  adv->start();

  Serial.println("[BLE] advertising as " BLE_DEVICE_NAME);
}

void ble_send_action(const char* action) {
  if (!g_state.bleConnected || !s_actionChar) return;
  char buf[32];
  snprintf(buf, sizeof(buf), "{\"a\":\"%s\"}", action);
  s_actionChar->setValue(buf);
  s_actionChar->notify();
  Serial.printf("[BLE] sent action: %s\n", action);
}

bool ble_is_connected() {
  return g_state.bleConnected;
}
