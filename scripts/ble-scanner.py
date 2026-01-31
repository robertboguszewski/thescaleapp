#!/usr/bin/env python3
"""
BLE Scanner for Mi Scale S400 devices using bleak.

Uses CoreBluetooth on macOS for reliable BLE scanning.
S400 sends weight data via advertisement broadcasts (not GATT characteristics).

Usage:
    python3 ble-scanner.py [--scan-duration SECONDS] [--device-mac MAC]
"""

import asyncio
import json
import sys
import argparse
import re
import struct
from datetime import datetime
from typing import Optional, Dict, Any

try:
    from bleak import BleakScanner, BleakClient
    from bleak.backends.device import BLEDevice
    from bleak.backends.scanner import AdvertisementData
except ImportError:
    print(json.dumps({
        "type": "error",
        "error": "bleak not installed",
        "message": "Please install bleak: pip3 install bleak"
    }))
    sys.exit(1)

# Xiaomi company ID for manufacturer data
XIAOMI_COMPANY_ID = 0x0157  # 343 decimal

# Mi Scale service data UUIDs
WEIGHT_SCALE_SERVICE_UUID = "0000181d-0000-1000-8000-00805f9b34fb"
BODY_COMPOSITION_SERVICE_UUID = "0000181b-0000-1000-8000-00805f9b34fb"

# Short UUIDs for service data lookup (16-bit)
WEIGHT_SCALE_SERVICE_SHORT = "181d"
BODY_COMPOSITION_SERVICE_SHORT = "181b"

# Mi Scale device name patterns
MI_SCALE_PATTERNS = [
    r'^MIBFS',           # Mi Body Fat Scale
    r'^MIBCS',           # Mi Body Composition Scale
    r'^XMTZC',           # Xiaomi Mi Scale (Chinese)
    r'^MI_?SCALE',       # MI SCALE or MI_SCALE
    r'mi\s*scale',       # Mi Scale (with optional space)
    r'body.*scale',      # Body Scale variants
    r'xiaomi.*scale',    # Xiaomi Scale (e.g., "Xiaomi Scale S400")
    r'scale.*s400',      # S400 model
]


def is_mi_scale_device(name: Optional[str]) -> bool:
    """Check if device name matches Mi Scale patterns."""
    if not name:
        return False
    for pattern in MI_SCALE_PATTERNS:
        if re.search(pattern, name, re.IGNORECASE):
            return True
    return False


def output_json(data: dict):
    """Output JSON data to stdout."""
    print(json.dumps(data), flush=True)


def parse_mi_scale_service_data(data: bytes) -> Optional[Dict[str, Any]]:
    """
    Parse Mi Scale service data from advertisement.

    Mi Scale V2/S400 format (service data under 0x181D or 0x181B):

    Common format:
    - Byte 0: Control byte 1
      - Bit 0: LBS unit (1) vs KG unit (0)
      - Bit 1: Jin unit (Chinese)
      - Bit 4: Stabilized weight
      - Bit 5: Weight removed
      - Bit 7: Has impedance
    - Byte 1: Control byte 2 (year offset, etc.)
    - Bytes 2-3 or later: Weight value (little endian)
    - Optional: Year, month, day, hour, minute, second
    - Optional: Impedance (if bit 7 of byte 0 is set)
    """
    if len(data) < 10:
        return None

    ctrl_byte0 = data[0]
    ctrl_byte1 = data[1]

    # Parse flags
    is_lbs = bool(ctrl_byte0 & 0x01)
    is_jin = bool(ctrl_byte0 & 0x02)
    is_stabilized = bool(ctrl_byte0 & 0x10)
    weight_removed = bool(ctrl_byte0 & 0x20)
    has_impedance = bool(ctrl_byte0 & 0x80)

    # Weight is at bytes 1-2 (little endian, resolution 0.01 kg or 0.01 lb)
    # Different scales put weight at different offsets
    # Try common offsets

    weight_kg = None

    # Format 1: Weight at bytes 1-2 (Mi Scale V1 style)
    if len(data) >= 3:
        weight_raw = int.from_bytes(data[1:3], byteorder='little')
        if is_lbs:
            weight_kg = weight_raw * 0.01 * 0.453592
        elif is_jin:
            weight_kg = weight_raw * 0.01 * 0.5
        else:
            weight_kg = weight_raw * 0.01

        # Sanity check - valid human weight range
        if not (1.0 <= weight_kg <= 300.0):
            weight_kg = None

    # Format 2: Weight at bytes 11-12 (Mi Scale V2 style with timestamp)
    if weight_kg is None and len(data) >= 13:
        weight_raw = int.from_bytes(data[11:13], byteorder='little')
        if is_lbs:
            weight_kg = weight_raw * 0.01 * 0.453592
        elif is_jin:
            weight_kg = weight_raw * 0.01 * 0.5
        else:
            weight_kg = weight_raw * 0.005  # 0.005 kg resolution for V2

        if not (1.0 <= weight_kg <= 300.0):
            weight_kg = None

    if weight_kg is None:
        return None

    measurement = {
        "weightKg": round(weight_kg, 2),
        "isStabilized": is_stabilized,
        "weightRemoved": weight_removed,
        "timestamp": datetime.now().isoformat(),
    }

    # Parse impedance if present
    if has_impedance and len(data) >= 15:
        impedance_raw = int.from_bytes(data[13:15], byteorder='little')
        if 100 <= impedance_raw <= 2000:  # Valid impedance range
            measurement["impedanceOhm"] = impedance_raw

    return measurement


def parse_xiaomi_manufacturer_data(data: bytes) -> Optional[Dict[str, Any]]:
    """
    Parse Xiaomi manufacturer data from advertisement.

    Format varies by device, but generally:
    - First 2 bytes after company ID: Frame control
    - Following bytes: Payload with weight/impedance
    """
    if len(data) < 6:
        return None

    # Try to find weight data in various formats
    # Xiaomi uses different encoding for different scales

    # Look for weight pattern - 2 bytes that represent a reasonable weight
    for i in range(len(data) - 1):
        weight_raw = int.from_bytes(data[i:i+2], byteorder='little')

        # Try 0.01 kg resolution
        weight_kg = weight_raw * 0.01
        if 1.0 <= weight_kg <= 300.0:
            return {
                "weightKg": round(weight_kg, 2),
                "isStabilized": True,  # Assume stabilized if in valid range
                "timestamp": datetime.now().isoformat(),
            }

        # Try 0.005 kg resolution (common for body composition scales)
        weight_kg = weight_raw * 0.005
        if 1.0 <= weight_kg <= 300.0:
            return {
                "weightKg": round(weight_kg, 2),
                "isStabilized": True,
                "timestamp": datetime.now().isoformat(),
            }

    return None


class MiScaleScanner:
    """Scanner for Mi Scale S400 devices - parses advertisement data for measurements."""

    def __init__(self, target_mac: Optional[str] = None, scan_duration: float = 60.0):
        self.target_mac = target_mac
        self.scan_duration = scan_duration
        self.discovered_devices: Dict[str, BLEDevice] = {}
        self.last_measurement: Optional[Dict[str, Any]] = None
        self.measurement_count = 0
        self.should_stop = False

    def detection_callback(self, device: BLEDevice, advertisement_data: AdvertisementData):
        """Callback for each discovered device - parses advertisement data for measurements."""
        name = advertisement_data.local_name or device.name
        device_id = device.address

        # Check if this is a Mi Scale
        if not is_mi_scale_device(name):
            # Also check for Xiaomi manufacturer data even without name
            if XIAOMI_COMPANY_ID not in advertisement_data.manufacturer_data:
                return

        # Log discovery
        if device_id not in self.discovered_devices:
            self.discovered_devices[device_id] = device
            output_json({
                "type": "discovered",
                "device": {
                    "id": device_id,
                    "name": name or "Mi Scale",
                    "rssi": advertisement_data.rssi,
                }
            })

        # If we have a target MAC and this isn't it, skip measurement parsing
        if self.target_mac and device_id.lower() != self.target_mac.lower():
            return

        measurement = None

        # Try to parse service data (primary method for S400)
        for uuid, data in advertisement_data.service_data.items():
            uuid_str = str(uuid).lower()

            # Check for weight scale or body composition service
            if WEIGHT_SCALE_SERVICE_SHORT in uuid_str or BODY_COMPOSITION_SERVICE_SHORT in uuid_str:
                output_json({
                    "type": "debug",
                    "message": f"Service data [{uuid}]: {data.hex()}"
                })
                measurement = parse_mi_scale_service_data(bytes(data))
                if measurement:
                    break

        # Try manufacturer data if service data didn't work
        if not measurement and XIAOMI_COMPANY_ID in advertisement_data.manufacturer_data:
            mfr_data = advertisement_data.manufacturer_data[XIAOMI_COMPANY_ID]
            output_json({
                "type": "debug",
                "message": f"Manufacturer data (Xiaomi): {mfr_data.hex()}"
            })
            measurement = parse_xiaomi_manufacturer_data(bytes(mfr_data))

        # Emit measurement if found and different from last
        if measurement:
            # Avoid duplicate emissions (same weight within short time)
            if (self.last_measurement is None or
                abs(measurement["weightKg"] - self.last_measurement.get("weightKg", 0)) > 0.1 or
                measurement.get("isStabilized") != self.last_measurement.get("isStabilized")):

                self.last_measurement = measurement
                self.measurement_count += 1

                output_json({
                    "type": "measurement",
                    "deviceId": device_id,
                    "deviceName": name or "Mi Scale",
                    "measurement": measurement,
                })

    async def scan(self):
        """Start BLE scanning and parse advertisements."""
        output_json({
            "type": "status",
            "status": "scanning",
            "message": "Starting BLE scan for Mi Scale..."
        })

        try:
            scanner = BleakScanner(detection_callback=self.detection_callback)
            await scanner.start()

            output_json({
                "type": "status",
                "status": "scanning",
                "message": f"Scanning for {self.scan_duration} seconds... Step on scale for measurement."
            })

            # Continuous scan until timeout or stop
            start_time = asyncio.get_event_loop().time()
            while not self.should_stop:
                await asyncio.sleep(0.5)

                elapsed = asyncio.get_event_loop().time() - start_time
                if elapsed >= self.scan_duration:
                    break

            await scanner.stop()

            output_json({
                "type": "status",
                "status": "stopped",
                "message": f"Scan completed. Devices: {len(self.discovered_devices)}, Measurements: {self.measurement_count}",
                "devicesFound": len(self.discovered_devices),
                "measurementsReceived": self.measurement_count
            })

        except Exception as e:
            output_json({
                "type": "error",
                "error": str(type(e).__name__),
                "message": str(e)
            })


async def main():
    parser = argparse.ArgumentParser(description='BLE Scanner for Mi Scale S400')
    parser.add_argument('--scan-duration', type=float, default=60.0,
                        help='Scan duration in seconds (default: 60)')
    parser.add_argument('--device-mac', type=str, default=None,
                        help='Target device MAC address')
    parser.add_argument('--continuous', action='store_true',
                        help='Continuous scanning mode')

    args = parser.parse_args()

    output_json({
        "type": "status",
        "status": "initializing",
        "message": "Mi Scale BLE Scanner (advertisement-based) starting..."
    })

    scanner = MiScaleScanner(
        target_mac=args.device_mac,
        scan_duration=args.scan_duration
    )

    if args.continuous:
        # Continuous mode - restart scanning after each cycle
        while True:
            await scanner.scan()
            output_json({
                "type": "status",
                "status": "restarting",
                "message": "Restarting scan cycle..."
            })
            await asyncio.sleep(2)
            scanner.discovered_devices = {}
            scanner.last_measurement = None
    else:
        await scanner.scan()


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
