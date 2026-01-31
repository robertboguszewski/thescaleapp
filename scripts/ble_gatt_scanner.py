#!/usr/bin/env python3
"""
BLE GATT Scanner for Mi Scale S400 devices using bleak.

Connects directly to the scale via GATT for real-time weight updates.
This provides live weight data (including unstable readings) unlike
MiBeacon passive scanning which only gets final measurements.

Usage:
    python3 ble-gatt-scanner.py --device-mac MAC [--scan-duration SECONDS]
"""

import asyncio
import json
import sys
import argparse
import struct
from datetime import datetime
from typing import Optional, Dict, Any, Callable
from enum import IntEnum

try:
    from bleak import BleakClient, BleakScanner
    from bleak.backends.device import BLEDevice
    from bleak.backends.characteristic import BleakGATTCharacteristic
except ImportError:
    print(json.dumps({
        "type": "error",
        "error": "bleak not installed",
        "message": "Please install bleak: pip3 install bleak"
    }))
    sys.exit(1)


# GATT Service and Characteristic UUIDs
WEIGHT_SCALE_SERVICE = "0000181d-0000-1000-8000-00805f9b34fb"
BODY_COMPOSITION_SERVICE = "0000181b-0000-1000-8000-00805f9b34fb"
WEIGHT_MEASUREMENT_CHAR = "00002a9d-0000-1000-8000-00805f9b34fb"
BODY_COMPOSITION_MEASUREMENT_CHAR = "00002a9c-0000-1000-8000-00805f9b34fb"

# Xiaomi custom service (for history and configuration)
XIAOMI_CUSTOM_SERVICE = "00001530-0000-3512-2118-0009af100700"
XIAOMI_HISTORY_CHAR = "00002a2f-0000-3512-2118-0009af100700"
CURRENT_TIME_CHAR = "00002a2b-0000-1000-8000-00805f9b34fb"


class WeightUnit(IntEnum):
    """Weight measurement units from GATT spec."""
    KG = 0
    LBS = 1


class WeightStabilityTracker:
    """
    Track weight readings to detect measurement stabilization.

    Standard GATT Weight Measurement (0x2A9D) doesn't have a stabilization flag.
    We detect stability by observing when consecutive readings are within tolerance.
    """

    def __init__(self, stable_count_threshold: int = 3, tolerance_kg: float = 0.05):
        """
        Args:
            stable_count_threshold: Number of similar readings required for stability
            tolerance_kg: Weight difference tolerance for "same" reading
        """
        self.stable_count_threshold = stable_count_threshold
        self.tolerance_kg = tolerance_kg
        self.stable_count = 0
        self.last_weight: Optional[float] = None
        self.stable_weight: Optional[float] = None

    def check_stability(self, weight_kg: float) -> bool:
        """
        Check if weight has stabilized.

        Args:
            weight_kg: Current weight reading

        Returns:
            True if weight is now stable (threshold reached)
        """
        if self.last_weight is None:
            self.last_weight = weight_kg
            self.stable_count = 1
            return False

        # Check if weight is within tolerance of last reading
        if abs(weight_kg - self.last_weight) <= self.tolerance_kg:
            self.stable_count += 1
        else:
            # Weight changed significantly, reset counter
            self.stable_count = 1

        self.last_weight = weight_kg

        if self.stable_count >= self.stable_count_threshold:
            self.stable_weight = weight_kg
            return True

        return False

    def get_stable_weight(self) -> Optional[float]:
        """Get the stable weight if stabilization was achieved."""
        return self.stable_weight

    def reset(self):
        """Reset the tracker for a new measurement session."""
        self.stable_count = 0
        self.last_weight = None
        self.stable_weight = None


def output_json(data: dict):
    """Output JSON data to stdout."""
    print(json.dumps(data), flush=True)


def parse_weight_measurement(data: bytes) -> Optional[Dict[str, Any]]:
    """
    Parse Weight Measurement characteristic (0x2A9D) data.

    Bluetooth GATT Weight Measurement format:
    - Byte 0: Flags
      - Bit 0: Imperial (lbs) if set, Metric (kg) if not
      - Bit 1: Timestamp present
      - Bit 2: User ID present
      - Bit 3: BMI and Height present
    - Bytes 1-2: Weight (uint16, little-endian)
      - Resolution: 0.005 kg or 0.01 lb
    - Optional fields follow based on flags
    """
    if len(data) < 3:
        return None

    flags = data[0]
    is_imperial = bool(flags & 0x01)
    has_timestamp = bool(flags & 0x02)
    has_user_id = bool(flags & 0x04)
    has_bmi_height = bool(flags & 0x08)

    # Weight is in bytes 1-2 (uint16 little-endian)
    weight_raw = struct.unpack('<H', data[1:3])[0]

    # Convert to kg
    if is_imperial:
        # Resolution: 0.01 lb, convert to kg
        weight_kg = (weight_raw * 0.01) * 0.453592
    else:
        # Resolution: 0.005 kg
        weight_kg = weight_raw * 0.005

    result = {
        "weightKg": round(weight_kg, 2),
        "unit": "lbs" if is_imperial else "kg",
        "isStabilized": None,  # Will be set by WeightStabilityTracker
        "timestamp": datetime.now().isoformat(),
        # Include all fields for consistency with MiBeacon (even if not available via GATT)
        "impedanceOhm": None,
        "impedanceLowOhm": None,
        "heartRateBpm": None,
        "profileId": None,
        "isImpedanceMeasurement": False,
        "isHeartRateMeasurement": False,
    }

    offset = 3

    # Parse optional timestamp (7 bytes: year, month, day, hour, min, sec)
    if has_timestamp and len(data) >= offset + 7:
        year = struct.unpack('<H', data[offset:offset+2])[0]
        month = data[offset+2]
        day = data[offset+3]
        hour = data[offset+4]
        minute = data[offset+5]
        second = data[offset+6]
        result["deviceTimestamp"] = f"{year}-{month:02d}-{day:02d}T{hour:02d}:{minute:02d}:{second:02d}"
        offset += 7

    # Parse optional user ID (1 byte)
    if has_user_id and len(data) >= offset + 1:
        result["userId"] = data[offset]
        offset += 1

    # Parse optional BMI and Height (4 bytes: BMI uint16, Height uint16)
    if has_bmi_height and len(data) >= offset + 4:
        bmi_raw = struct.unpack('<H', data[offset:offset+2])[0]
        height_raw = struct.unpack('<H', data[offset+2:offset+4])[0]
        result["bmi"] = bmi_raw * 0.1
        result["heightCm"] = height_raw * 0.1
        offset += 4

    return result


def parse_xiaomi_weight_advertisement(data: bytes) -> Optional[Dict[str, Any]]:
    """
    Parse Xiaomi Mi Scale advertisement format (10 bytes).
    Used when receiving via GATT indications on custom characteristic.

    Format:
    - Byte 0: Status flags
      - Bit 1: Kilogram unit
      - Bit 2: Pounds unit
      - Bit 4: Jin unit
      - Bit 5: Stabilized
      - Bit 7: Load removed
    - Bytes 1-2: Weight (little-endian)
    - Bytes 3-7: Reserved / timestamp
    - Bytes 8-9: Sequence number
    """
    if len(data) < 10:
        return None

    flags = data[0]

    # Determine unit
    is_jin = bool(flags & 0x10)
    is_lbs = bool(flags & 0x04)
    is_kg = bool(flags & 0x02)
    is_stabilized = bool(flags & 0x20)
    load_removed = bool(flags & 0x80)

    # Weight in bytes 1-2
    weight_raw = struct.unpack('<H', data[1:3])[0]

    # Convert to kg based on unit
    if is_jin:
        weight_kg = weight_raw / 100.0 * 0.5  # Jin to kg
    elif is_lbs:
        weight_kg = weight_raw / 100.0 * 0.453592  # Lbs to kg
    elif is_kg:
        weight_kg = weight_raw / 200.0  # Kg (divided by 200 per protocol)
    else:
        weight_kg = weight_raw / 100.0  # Default

    return {
        "weightKg": round(weight_kg, 2),
        "isStabilized": is_stabilized,
        "loadRemoved": load_removed,
        "timestamp": datetime.now().isoformat(),
        # Include all fields for consistency with MiBeacon (even if not available via GATT)
        "impedanceOhm": None,
        "impedanceLowOhm": None,
        "heartRateBpm": None,
        "profileId": None,
        "isImpedanceMeasurement": False,
        "isHeartRateMeasurement": False,
    }


class GATTScaleScanner:
    """
    GATT-based scanner for Mi Scale S400.
    Connects directly to scale for real-time weight updates.

    Features:
    - Auto-reconnection with exponential backoff
    - Weight stabilization detection for standard GATT
    - Disconnect callback support
    """

    def __init__(
        self,
        device_address: str,
        scan_duration: float = 60.0,
        on_weight: Optional[Callable[[Dict[str, Any]], None]] = None,
        auto_reconnect: bool = True,
        reconnect_delay: float = 1.0,
        max_reconnect_delay: float = 30.0,
        max_reconnect_attempts: int = 10,
    ):
        self.device_address = device_address
        self.scan_duration = scan_duration
        self.on_weight = on_weight or self._default_weight_handler
        self.client: Optional[BleakClient] = None
        self.connected = False
        self.last_weight: Optional[float] = None
        self.measurement_count = 0

        # Reconnection settings
        self.auto_reconnect = auto_reconnect
        self.reconnect_delay = reconnect_delay
        self.max_reconnect_delay = max_reconnect_delay
        self.max_reconnect_attempts = max_reconnect_attempts
        self.reconnect_attempt = 0
        self.reconnect_scheduled = False
        self._should_stop = False

        # Stability tracking for standard GATT (no native stabilization flag)
        self.stability_tracker = WeightStabilityTracker(
            stable_count_threshold=3,
            tolerance_kg=0.05
        )

        # Callbacks
        self.on_disconnect_callback: Optional[Callable[[], None]] = None

    def _default_weight_handler(self, measurement: Dict[str, Any]):
        """Default handler - output as JSON."""
        output_json({
            "type": "measurement",
            "measurement": measurement
        })

    def _handle_disconnection(self, client: Optional[BleakClient]):
        """Handle unexpected disconnection."""
        self.connected = False

        output_json({
            "type": "status",
            "status": "disconnected",
            "message": "Connection lost"
        })

        # Call user callback if set
        if self.on_disconnect_callback:
            self.on_disconnect_callback()

        # Schedule reconnection if enabled
        if self.auto_reconnect and not self._should_stop:
            self._schedule_reconnect()

    def _schedule_reconnect(self):
        """Schedule a reconnection attempt with exponential backoff."""
        if self.reconnect_attempt >= self.max_reconnect_attempts:
            output_json({
                "type": "error",
                "error": "max_reconnect_attempts",
                "message": f"Max reconnection attempts ({self.max_reconnect_attempts}) reached"
            })
            return

        delay = self._get_current_reconnect_delay()
        self.reconnect_scheduled = True

        output_json({
            "type": "status",
            "status": "reconnecting",
            "message": f"Reconnecting in {delay:.1f}s (attempt {self.reconnect_attempt + 1}/{self.max_reconnect_attempts})"
        })

        # Use asyncio to schedule reconnection
        asyncio.get_event_loop().call_later(delay, self._trigger_reconnect)

    def _trigger_reconnect(self):
        """Trigger the reconnection coroutine."""
        if not self._should_stop:
            asyncio.ensure_future(self._reconnect())

    async def _reconnect(self):
        """Attempt to reconnect to the device."""
        self.reconnect_attempt += 1
        self.reconnect_scheduled = False

        try:
            connected = await self.connect_and_subscribe()
            if connected:
                self.reconnect_attempt = 0  # Reset on success
                output_json({
                    "type": "status",
                    "status": "reconnected",
                    "message": "Successfully reconnected"
                })
        except Exception as e:
            output_json({
                "type": "error",
                "error": "reconnect_failed",
                "message": f"Reconnection failed: {e}"
            })
            if self.auto_reconnect and not self._should_stop:
                self._schedule_reconnect()

    def _get_current_reconnect_delay(self) -> float:
        """Get current delay with exponential backoff."""
        delay = self.reconnect_delay * (2 ** self.reconnect_attempt)
        return min(delay, self.max_reconnect_delay)

    def _get_reconnect_delays(self) -> list:
        """Get list of all reconnect delays for testing."""
        delays = []
        for i in range(self.max_reconnect_attempts):
            delay = self.reconnect_delay * (2 ** i)
            delays.append(min(delay, self.max_reconnect_delay))
        return delays

    def _weight_notification_handler(
        self,
        characteristic: BleakGATTCharacteristic,
        data: bytearray
    ):
        """Handle weight measurement notifications from GATT."""
        output_json({
            "type": "debug",
            "message": f"GATT notification [{characteristic.uuid}]: {data.hex()}"
        })

        # Try standard GATT weight measurement format
        measurement = parse_weight_measurement(bytes(data))

        if not measurement:
            # Try Xiaomi custom format
            measurement = parse_xiaomi_weight_advertisement(bytes(data))

        if measurement:
            weight_kg = measurement["weightKg"]

            # For standard GATT without native stabilization flag,
            # use our stability tracker
            if "isStabilized" not in measurement or measurement.get("isStabilized") is None:
                is_stable = self.stability_tracker.check_stability(weight_kg)
                measurement["isStabilized"] = is_stable

                if is_stable:
                    output_json({
                        "type": "debug",
                        "message": f"Weight stabilized at {weight_kg:.2f} kg"
                    })

            # Only emit if weight changed significantly (> 0.05 kg)
            weight_changed = (
                self.last_weight is None or
                abs(weight_kg - self.last_weight) > 0.05
            )

            if weight_changed:
                self.last_weight = weight_kg
                self.measurement_count += 1
                self.on_weight(measurement)

    async def find_device(self) -> Optional[BLEDevice]:
        """Find device by address using scanning."""
        output_json({
            "type": "status",
            "status": "scanning",
            "message": f"Scanning for device {self.device_address}..."
        })

        # On macOS, we might need to scan to find UUID for MAC
        devices = await BleakScanner.discover(timeout=10.0)

        for device in devices:
            # Check if address matches (handle both MAC and UUID formats)
            addr_clean = self.device_address.lower().replace(':', '').replace('-', '')
            device_addr_clean = device.address.lower().replace(':', '').replace('-', '')

            if addr_clean in device_addr_clean or device_addr_clean in addr_clean:
                output_json({
                    "type": "debug",
                    "message": f"Found device: {device.name} ({device.address})"
                })
                return device

            # Also check device name for Mi Scale patterns
            if device.name and 'scale' in device.name.lower():
                output_json({
                    "type": "debug",
                    "message": f"Found scale device: {device.name} ({device.address})"
                })
                # Return first scale found if target not found by address

        return None

    async def connect_and_subscribe(self):
        """Connect to scale and subscribe to weight notifications."""
        output_json({
            "type": "status",
            "status": "connecting",
            "message": f"Connecting to {self.device_address}..."
        })

        try:
            # Reset stability tracker for new connection
            self.stability_tracker.reset()

            # Create client with disconnect callback
            self.client = BleakClient(
                self.device_address,
                disconnected_callback=self._handle_disconnection
            )
            await self.client.connect()
            self.connected = True

            output_json({
                "type": "status",
                "status": "connected",
                "message": f"Connected to scale"
            })

            # Discover services
            services = self.client.services
            output_json({
                "type": "debug",
                "message": f"Discovered {len(services)} services"
            })

            for service in services:
                output_json({
                    "type": "debug",
                    "message": f"Service: {service.uuid}"
                })
                for char in service.characteristics:
                    props = ', '.join(char.properties)
                    output_json({
                        "type": "debug",
                        "message": f"  Char: {char.uuid} [{props}]"
                    })

            # Subscribe to weight measurement characteristic
            subscribed = False

            # Try standard Weight Measurement characteristic
            try:
                await self.client.start_notify(
                    WEIGHT_MEASUREMENT_CHAR,
                    self._weight_notification_handler
                )
                output_json({
                    "type": "debug",
                    "message": f"Subscribed to Weight Measurement (0x2A9D)"
                })
                subscribed = True
            except Exception as e:
                output_json({
                    "type": "debug",
                    "message": f"Could not subscribe to 0x2A9D: {e}"
                })

            # Try Body Composition Measurement characteristic
            try:
                await self.client.start_notify(
                    BODY_COMPOSITION_MEASUREMENT_CHAR,
                    self._weight_notification_handler
                )
                output_json({
                    "type": "debug",
                    "message": f"Subscribed to Body Composition (0x2A9C)"
                })
                subscribed = True
            except Exception as e:
                output_json({
                    "type": "debug",
                    "message": f"Could not subscribe to 0x2A9C: {e}"
                })

            # Try Xiaomi custom history characteristic
            try:
                await self.client.start_notify(
                    XIAOMI_HISTORY_CHAR,
                    self._weight_notification_handler
                )
                output_json({
                    "type": "debug",
                    "message": f"Subscribed to Xiaomi History characteristic"
                })
                subscribed = True
            except Exception as e:
                output_json({
                    "type": "debug",
                    "message": f"Could not subscribe to Xiaomi char: {e}"
                })

            # Try to find any characteristic with notify/indicate property
            if not subscribed:
                for service in services:
                    for char in service.characteristics:
                        if 'notify' in char.properties or 'indicate' in char.properties:
                            try:
                                await self.client.start_notify(
                                    char.uuid,
                                    self._weight_notification_handler
                                )
                                output_json({
                                    "type": "debug",
                                    "message": f"Subscribed to {char.uuid}"
                                })
                                subscribed = True
                            except Exception as e:
                                pass

            if subscribed:
                output_json({
                    "type": "status",
                    "status": "listening",
                    "message": "Listening for weight updates... Step on scale"
                })
            else:
                output_json({
                    "type": "error",
                    "error": "no_characteristics",
                    "message": "Could not find any subscribable characteristics"
                })

            return subscribed

        except Exception as e:
            output_json({
                "type": "error",
                "error": str(type(e).__name__),
                "message": f"Connection failed: {e}"
            })
            return False

    async def disconnect(self):
        """Disconnect from scale."""
        if self.client and self.connected:
            try:
                await self.client.disconnect()
            except Exception:
                pass
            self.connected = False

            output_json({
                "type": "status",
                "status": "disconnected",
                "message": f"Disconnected. Measurements received: {self.measurement_count}"
            })

    async def run(self):
        """Main run loop - connect and listen for weight updates."""
        try:
            connected = await self.connect_and_subscribe()

            if connected:
                # Keep connection alive for scan_duration
                await asyncio.sleep(self.scan_duration)

        except asyncio.CancelledError:
            output_json({
                "type": "status",
                "status": "cancelled",
                "message": "Scan cancelled"
            })
        finally:
            await self.disconnect()


async def main():
    parser = argparse.ArgumentParser(description='BLE GATT Scanner for Mi Scale S400')
    parser.add_argument('--device-mac', type=str, required=True,
                        help='Target device MAC address')
    parser.add_argument('--scan-duration', type=float, default=60.0,
                        help='How long to listen for weight updates (default: 60s)')

    args = parser.parse_args()

    output_json({
        "type": "status",
        "status": "initializing",
        "message": "Mi Scale GATT Scanner starting..."
    })

    scanner = GATTScaleScanner(
        device_address=args.device_mac,
        scan_duration=args.scan_duration
    )

    await scanner.run()


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        output_json({
            "type": "status",
            "status": "stopped",
            "message": "Scanner stopped by user"
        })
    except Exception as e:
        output_json({
            "type": "error",
            "error": str(type(e).__name__),
            "message": str(e)
        })
        sys.exit(1)
