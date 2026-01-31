#!/usr/bin/env python3
"""
BLE Scanner for Mi Scale devices using bleak.

Uses CoreBluetooth on macOS for reliable BLE scanning.
Outputs discovered devices and measurements as JSON to stdout.

Usage:
    python3 ble-scanner.py [--scan-duration SECONDS] [--device-mac MAC]
"""

import asyncio
import json
import sys
import argparse
import re
from datetime import datetime
from typing import Optional

try:
    from bleak import BleakScanner
    from bleak.backends.device import BLEDevice
    from bleak.backends.scanner import AdvertisementData
except ImportError:
    print(json.dumps({
        "type": "error",
        "error": "bleak not installed",
        "message": "Please install bleak: pip3 install bleak"
    }))
    sys.exit(1)

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

# Device name mapping
DEVICE_NAME_MAP = {
    'MIBFS': 'Mi Body Fat Scale',
    'MIBCS': 'Mi Body Composition Scale',
    'MIBCS2': 'Mi Body Composition Scale 2',
    'XMTZC01HM': 'Xiaomi Mi Scale',
    'XMTZC02HM': 'Xiaomi Mi Scale 2',
    'XMTZC04HM': 'Mi Body Composition Scale',
    'XMTZC05HM': 'Mi Body Composition Scale 2',
    # S400 models typically advertise their full name
}


def is_mi_scale_device(name: Optional[str]) -> bool:
    """Check if device name matches Mi Scale patterns."""
    if not name:
        return False
    for pattern in MI_SCALE_PATTERNS:
        if re.search(pattern, name, re.IGNORECASE):
            return True
    return False


def get_full_device_name(ble_name: Optional[str]) -> str:
    """Get full device name from BLE advertisement name."""
    if not ble_name:
        return 'Mi Scale'

    # Check exact match
    upper_name = ble_name.upper()
    if upper_name in DEVICE_NAME_MAP:
        return DEVICE_NAME_MAP[upper_name]

    # Check prefix match
    for prefix, full_name in DEVICE_NAME_MAP.items():
        if upper_name.startswith(prefix):
            return full_name

    return ble_name


def parse_mi_scale_data(manufacturer_data: dict) -> Optional[dict]:
    """
    Parse Mi Scale manufacturer data to extract weight measurement.

    Mi Scale uses manufacturer ID 0x0157 (343 decimal) for Xiaomi.
    Data format varies by scale model.
    """
    # Xiaomi manufacturer ID
    XIAOMI_MFG_ID = 0x0157

    if XIAOMI_MFG_ID not in manufacturer_data:
        return None

    data = manufacturer_data[XIAOMI_MFG_ID]
    if len(data) < 10:
        return None

    try:
        # Mi Scale 2 / Body Composition Scale format
        # Byte 0: Control byte
        # Byte 1-2: Year
        # Byte 3: Month
        # Byte 4: Day
        # Byte 5: Hour
        # Byte 6: Minute
        # Byte 7: Second
        # Byte 8-9: Weight (little endian, in 0.01 kg or 0.01 lb)
        # Byte 10-11: Impedance (optional)

        control = data[0]
        is_stabilized = bool(control & 0x20)
        weight_removed = bool(control & 0x80)

        # Weight is at bytes 8-9 (little endian)
        if len(data) >= 10:
            weight_raw = data[8] | (data[9] << 8)
            weight_kg = weight_raw / 200.0  # Convert to kg

            measurement = {
                "weightKg": round(weight_kg, 2),
                "isStabilized": is_stabilized,
                "weightRemoved": weight_removed,
                "timestamp": datetime.now().isoformat(),
            }

            # Check for impedance data (body composition scales)
            if len(data) >= 12:
                impedance_raw = data[10] | (data[11] << 8)
                if impedance_raw > 0 and impedance_raw < 10000:
                    measurement["impedanceOhm"] = impedance_raw

            return measurement
    except Exception as e:
        print(json.dumps({
            "type": "debug",
            "message": f"Failed to parse manufacturer data: {e}"
        }), flush=True)

    return None


def output_json(data: dict):
    """Output JSON data to stdout."""
    print(json.dumps(data), flush=True)


class MiScaleScanner:
    """Scanner for Mi Scale devices."""

    def __init__(self, target_mac: Optional[str] = None, scan_duration: float = 30.0):
        self.target_mac = target_mac
        self.scan_duration = scan_duration
        self.discovered_devices = {}
        self.should_stop = False

    def detection_callback(self, device: BLEDevice, advertisement_data: AdvertisementData):
        """Callback for each discovered device."""
        name = advertisement_data.local_name or device.name

        # Log all devices for debugging
        output_json({
            "type": "debug",
            "device": {
                "id": device.address,
                "name": name or "(no name)",
                "rssi": advertisement_data.rssi,
            }
        })

        # Filter for Mi Scale devices
        if not is_mi_scale_device(name):
            return

        device_id = device.address
        full_name = get_full_device_name(name)

        # Emit discovered event if new device
        if device_id not in self.discovered_devices:
            self.discovered_devices[device_id] = True
            output_json({
                "type": "discovered",
                "device": {
                    "id": device_id,
                    "name": full_name,
                    "rssi": advertisement_data.rssi,
                }
            })

        # If we have a target MAC and this isn't it, skip parsing
        if self.target_mac and device_id.lower() != self.target_mac.lower():
            return

        # Try to parse measurement from manufacturer data
        if advertisement_data.manufacturer_data:
            measurement = parse_mi_scale_data(advertisement_data.manufacturer_data)
            if measurement:
                output_json({
                    "type": "measurement",
                    "deviceId": device_id,
                    "deviceName": full_name,
                    "measurement": measurement,
                })

    async def scan(self):
        """Start BLE scanning."""
        output_json({
            "type": "status",
            "status": "scanning",
            "message": "Starting BLE scan..."
        })

        try:
            scanner = BleakScanner(detection_callback=self.detection_callback)
            await scanner.start()

            output_json({
                "type": "status",
                "status": "scanning",
                "message": f"Scanning for {self.scan_duration} seconds..."
            })

            await asyncio.sleep(self.scan_duration)

            await scanner.stop()

            output_json({
                "type": "status",
                "status": "stopped",
                "message": "Scan completed",
                "devicesFound": len(self.discovered_devices)
            })

        except Exception as e:
            output_json({
                "type": "error",
                "error": str(type(e).__name__),
                "message": str(e)
            })


async def main():
    parser = argparse.ArgumentParser(description='BLE Scanner for Mi Scale')
    parser.add_argument('--scan-duration', type=float, default=30.0,
                        help='Scan duration in seconds (default: 30)')
    parser.add_argument('--device-mac', type=str, default=None,
                        help='Target device MAC address')
    parser.add_argument('--continuous', action='store_true',
                        help='Continuous scanning mode')

    args = parser.parse_args()

    output_json({
        "type": "status",
        "status": "initializing",
        "message": "BLE Scanner starting..."
    })

    scanner = MiScaleScanner(
        target_mac=args.device_mac,
        scan_duration=args.scan_duration
    )

    if args.continuous:
        # Continuous mode - restart scanning after each cycle
        while True:
            await scanner.scan()
            await asyncio.sleep(1)
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
