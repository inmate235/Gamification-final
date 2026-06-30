/// <reference types="@types/web-bluetooth" />

/**
 * esp32ble — Web Bluetooth connection manager for the MurkyCorps ESP32 device.
 *
 * Two GATT characteristics:
 *   STATE_CHAR  — phone writes game state JSON; ESP32 reads it
 *   ACTION_CHAR — ESP32 notifies user actions; phone subscribes
 *
 * Usage:
 *   import { esp32ble } from "@/lib/esp32ble"
 *   await esp32ble.connect()
 *   esp32ble.onAction = (action) => { ... }
 *   await esp32ble.sendState({ w: true, t: 42, seg: -1, nm: false, sa: null })
 */

const SERVICE_UUID     = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const STATE_CHAR_UUID  = "beb5483e-36e1-4688-b7f5-ea07361b26a8";
const ACTION_CHAR_UUID = "1c95d5e3-d8f7-413a-bf3d-7a2e5d7be87e";

export interface ESP32SalePayload {
  n:   string;   // store name
  d:   string;   // discount text
  c:   number;   // countdown seconds
  dir: number;   // direction 0-7
}

export interface ESP32StatePayload {
  w:   boolean;               // wheel available
  t:   number;                // token balance
  seg: number;                // spin result segment (-1 = none)
  nm:  boolean;               // near-miss flag
  sa:  ESP32SalePayload | null;
}

type ActionType = "spin" | "grab" | "dismiss";

class ESP32BLE {
  private device:    BluetoothDevice | null          = null;
  private server:    BluetoothRemoteGATTServer | null = null;
  private stateChar: BluetoothRemoteGATTCharacteristic | null = null;
  private encoder = new TextEncoder();

  /** Fires when the ESP32 sends a user action notification. */
  onAction: ((action: ActionType) => void) | null = null;
  /** Fires when connection status changes. */
  onConnectionChange: ((connected: boolean) => void) | null = null;

  get isConnected(): boolean {
    return this.server?.connected ?? false;
  }

  async connect(): Promise<void> {
    if (!navigator.bluetooth) {
      throw new Error("Web Bluetooth is not supported in this browser. Use Chrome or Edge on desktop.");
    }

    this.device = await navigator.bluetooth.requestDevice({
      filters: [{ name: "MurkyCorps" }],
      optionalServices: [SERVICE_UUID],
    });

    this.device.addEventListener("gattserverdisconnected", () => {
      this.stateChar = null;
      this.server    = null;
      this.onConnectionChange?.(false);
    });

    this.server = await this.device.gatt!.connect();
    const service = await this.server.getPrimaryService(SERVICE_UUID);

    this.stateChar = await service.getCharacteristic(STATE_CHAR_UUID);

    const actionChar = await service.getCharacteristic(ACTION_CHAR_UUID);
    await actionChar.startNotifications();
    actionChar.addEventListener("characteristicvaluechanged", (e: Event) => {
      const raw = new TextDecoder().decode((e.target as BluetoothRemoteGATTCharacteristic).value!);
      try {
        const parsed = JSON.parse(raw) as { a: ActionType };
        this.onAction?.(parsed.a);
      } catch {
        console.warn("[BLE] bad action JSON:", raw);
      }
    });

    this.onConnectionChange?.(true);
  }

  async disconnect(): Promise<void> {
    if (this.device?.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this.stateChar = null;
    this.server    = null;
    this.onConnectionChange?.(false);
  }

  async sendState(state: ESP32StatePayload): Promise<void> {
    if (!this.stateChar) return;
    try {
      const bytes = this.encoder.encode(JSON.stringify(state));
      await this.stateChar.writeValue(bytes);
    } catch (err) {
      console.warn("[BLE] sendState failed:", err);
    }
  }
}

export const esp32ble = new ESP32BLE();
