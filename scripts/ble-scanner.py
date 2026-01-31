#!/usr/bin/env python3
"""
BLE Scanner for Mi Scale S400 devices using bleak.

Uses CoreBluetooth on macOS for reliable BLE scanning.
S400 uses MiBeacon protocol with AES-CCM encrypted advertisements.

Usage:
    python3 ble-scanner.py [--scan-duration SECONDS] [--device-mac MAC] [--bindkey KEY]
"""

import asyncio
import json
import sys
import argparse
import re
import struct
from datetime import datetime
from typing import Optional, Dict, Any, Tuple

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

try:
    from cryptography.hazmat.primitives.ciphers.aead import AESCCM
except ImportError:
    print(json.dumps({
        "type": "error",
        "error": "cryptography not installed",
        "message": "Please install cryptography: pip3 install cryptography"
    }))
    sys.exit(1)

# MiBeacon service UUID (Xiaomi BLE advertisements)
MIBEACON_SERVICE_UUID = "0000fe95-0000-1000-8000-00805f9b34fb"
MIBEACON_SERVICE_SHORT = "fe95"

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

# S400 object IDs in MiBeacon protocol
MIBEACON_OBJECT_WEIGHT = 0x1006      # Weight measurement
MIBEACON_OBJECT_IMPEDANCE = 0x1007   # Impedance measurement
MIBEACON_OBJECT_HEART_RATE = 0x1008  # Heart rate (S400 only)


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


def mac_to_bytes(mac: str) -> bytes:
    """Convert MAC address string to bytes (reversed for MiBeacon)."""
    mac_clean = mac.replace(':', '').replace('-', '').upper()
    mac_bytes = bytes.fromhex(mac_clean)
    return mac_bytes[::-1]  # Reversed for MiBeacon


def decrypt_mibeacon(data: bytes, bindkey: bytes, mac: Optional[str] = None) -> Optional[bytes]:
    """
    Decrypt MiBeacon v4/v5 encrypted payload using AES-CCM.
    Based on mnm-matin/miscale implementation.

    MiBeacon frame structure:
    - Bytes 0-1: Frame control
    - Bytes 2-4: Product ID (2) + Frame counter (1)
    - Bytes 5-10: MAC address (optional, based on frame control bit 4)
    - Remaining: Encrypted payload + counter(3) + MIC(4)

    Nonce (12 bytes): MAC_reversed(6) + data[2:5](3) + data[-7:-4](3)
    """
    if len(data) < 11:
        return None

    frame_ctrl = int.from_bytes(data[0:2], 'little')

    # Check if encrypted (bit 3 of frame control)
    is_encrypted = bool(frame_ctrl & 0x08)
    # Check if MAC is included (bit 4 of frame control)
    has_mac = bool(frame_ctrl & 0x10)

    if not is_encrypted:
        # Not encrypted, return payload directly
        offset = 5
        if has_mac:
            offset += 6
        return data[offset:]

    # Get MAC from frame or use provided
    if has_mac:
        xiaomi_mac = data[5:11]
        start = 11
    else:
        if mac:
            xiaomi_mac = mac_to_bytes(mac)[::-1]  # mac_to_bytes already reverses, so reverse back
        else:
            return None  # Can't decrypt without MAC
        start = 5

    # Need at least: start + 1 byte payload + 3 counter + 4 mic = start + 8
    if len(data) < start + 8:
        return None

    # Build nonce (12 bytes): MAC_reversed + data[2:5] + data[-7:-4]
    nonce = b"".join([xiaomi_mac[::-1], data[2:5], data[-7:-4]])

    if len(nonce) != 12:
        return None

    # Extract encrypted payload and MIC
    encrypted_payload = data[start:-7]
    mic = data[-4:]

    # Decrypt with AES-CCM (4-byte tag, associated_data = 0x11)
    try:
        cipher = AESCCM(bindkey, tag_length=4)
        associated_data = b"\x11"
        decrypted = cipher.decrypt(nonce, encrypted_payload + mic, associated_data)
        output_json({
            "type": "debug",
            "message": f"Decrypted: {decrypted.hex()}"
        })
        return decrypted
    except Exception as e:
        output_json({
            "type": "debug",
            "message": f"Decryption failed: {type(e).__name__}: {e}"
        })
        return None


def parse_s400_measurement(decrypted: bytes) -> Optional[Dict[str, Any]]:
    """
    Parse S400 scale measurement from decrypted MiBeacon payload.

    S400 decrypted format (12 bytes):
    - Bytes 0-2: Object header (type=0x16, id=0x6E, length=9)
    - Byte 3: Profile ID (user slot on scale)
    - Bytes 4-7: Data field containing weight + heart rate + impedance
    - Bytes 8-11: Device timestamp

    Data field bit layout (based on ble_monitor obj6e16):
    - Bits 0-10 (11 bits): Weight raw (divide by 10 for kg)
    - Bits 11-17 (7 bits): Heart rate raw (add 50 for bpm)
    - Bits 18+ (14 bits): Impedance raw (divide by 10 for ohms)

    Note: Body composition metrics (fat%, muscle, water, etc.) are
    CALCULATED client-side using weight + impedance + user profile.
    """
    if len(decrypted) < 12:
        return None

    # Skip 3-byte object header, get profile_id
    profile_id = decrypted[3]

    # Get 4-byte data field (little endian)
    data_field = int.from_bytes(decrypted[4:8], 'little')

    # Extract weight (bits 0-10, 11 bits, scale /10)
    mass_raw = data_field & 0x7FF
    weight_kg = mass_raw / 10.0

    # Extract heart rate (bits 11-17, 7 bits, +50 offset for bpm)
    heart_rate_raw = (data_field >> 11) & 0x7F
    heart_rate_bpm = heart_rate_raw + 50 if heart_rate_raw > 0 else 0

    # Extract impedance (bits 18+, scale /10 for ohms)
    # Based on ble_monitor obj6e16: impedance = data >> 18
    impedance_raw = data_field >> 18
    impedance_ohm = impedance_raw / 10.0 if impedance_raw > 0 else 0

    # Device timestamp
    device_ts = int.from_bytes(decrypted[8:12], 'little')

    # Determine measurement type based on data
    is_weight_measurement = mass_raw > 0
    is_impedance_measurement = impedance_raw > 0 and impedance_ohm < 3000  # Valid impedance range
    is_heart_rate_measurement = heart_rate_raw > 0 and 0 < heart_rate_raw < 127  # Valid HR range per ble_monitor

    result = {
        "profileId": profile_id,
        "timestamp": device_ts,
        "isWeightMeasurement": is_weight_measurement,
        "isImpedanceMeasurement": is_impedance_measurement,
        "isHeartRateMeasurement": is_heart_rate_measurement,
    }

    if is_weight_measurement:
        result["weightKg"] = weight_kg

    # Distinguish between impedance and impedance_low per ble_monitor logic
    # If weight is present, it's normal impedance; otherwise it's impedance_low
    if is_impedance_measurement:
        if is_weight_measurement:
            result["impedanceOhm"] = impedance_ohm
        else:
            result["impedanceLowOhm"] = impedance_ohm

    if is_heart_rate_measurement:
        result["heartRateBpm"] = heart_rate_bpm

    return result


def parse_mibeacon_objects(data: bytes) -> Dict[str, Any]:
    """
    Parse MiBeacon object data (decrypted payload).

    Object format:
    - Bytes 0-1: Object ID (little endian)
    - Byte 2: Object length
    - Bytes 3+: Object data
    """
    result = {}
    offset = 0

    while offset + 3 <= len(data):
        obj_id = int.from_bytes(data[offset:offset+2], 'little')
        obj_len = data[offset+2]

        if offset + 3 + obj_len > len(data):
            break

        obj_data = data[offset+3:offset+3+obj_len]

        if obj_id == MIBEACON_OBJECT_WEIGHT and obj_len >= 2:
            # Weight: 2 bytes, little endian, unit 0.01 kg
            weight_raw = int.from_bytes(obj_data[0:2], 'little')
            result['weightKg'] = round(weight_raw / 100.0, 2)

        elif obj_id == MIBEACON_OBJECT_IMPEDANCE and obj_len >= 2:
            # Impedance: 2 bytes, little endian, unit Ohm
            impedance = int.from_bytes(obj_data[0:2], 'little')
            if 100 <= impedance <= 2000:  # Valid range
                result['impedanceOhm'] = impedance

        elif obj_id == MIBEACON_OBJECT_HEART_RATE and obj_len >= 1:
            # Heart rate: 1 byte
            result['heartRate'] = obj_data[0]

        offset += 3 + obj_len

    return result


def parse_scale_service_data(data: bytes, bindkey: Optional[bytes] = None, mac: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Parse Mi Scale service data from MiBeacon advertisement.
    Handles both encrypted (S400) and unencrypted (older scales) formats.
    """
    if len(data) < 5:
        return None

    frame_ctrl = int.from_bytes(data[0:2], 'little')
    is_encrypted = bool(frame_ctrl & 0x08)

    if is_encrypted:
        if not bindkey:
            output_json({
                "type": "debug",
                "message": "Encrypted MiBeacon but no bindkey provided"
            })
            return None

        decrypted = decrypt_mibeacon(data, bindkey, mac)
        if not decrypted:
            return None

        # Try S400-specific parsing first (12-byte payload)
        s400_data = parse_s400_measurement(decrypted)
        if s400_data:
            # Log measurement details
            hr_info = f", HR: {s400_data.get('heartRateBpm')} bpm" if s400_data.get('isHeartRateMeasurement') else ""
            if s400_data.get('isWeightMeasurement'):
                output_json({
                    "type": "debug",
                    "message": f"S400 weight: {s400_data.get('weightKg')} kg, impedance: {s400_data.get('impedanceOhm')} ohm{hr_info}"
                })
            elif s400_data.get('isImpedanceMeasurement'):
                output_json({
                    "type": "debug",
                    "message": f"S400 impedance-only: {s400_data.get('impedanceOhm')} ohm{hr_info} (body composition phase)"
                })

            # Return measurement if we have weight OR impedance
            if s400_data.get('isWeightMeasurement') or s400_data.get('isImpedanceMeasurement'):
                return {
                    "weightKg": s400_data.get('weightKg', 0),
                    "impedanceOhm": s400_data.get('impedanceOhm'),
                    "impedanceLowOhm": s400_data.get('impedanceLowOhm'),
                    "heartRateBpm": s400_data.get('heartRateBpm'),
                    "profileId": s400_data.get('profileId'),
                    "isStabilized": s400_data.get('isWeightMeasurement', False),
                    "isImpedanceMeasurement": s400_data.get('isImpedanceMeasurement', False),
                    "isHeartRateMeasurement": s400_data.get('isHeartRateMeasurement', False),
                    "timestamp": datetime.now().isoformat(),
                }

        # Fallback to standard MiBeacon object parsing
        objects = parse_mibeacon_objects(decrypted)
        if 'weightKg' in objects:
            return {
                "weightKg": objects['weightKg'],
                "impedanceOhm": objects.get('impedanceOhm'),
                "heartRate": objects.get('heartRate'),
                "isStabilized": True,
                "timestamp": datetime.now().isoformat(),
            }

    else:
        # Unencrypted MiBeacon (older Mi Scale V1/V2)
        # Try to parse weight from service data directly
        has_mac = bool(frame_ctrl & 0x10)
        offset = 11 if has_mac else 5

        if len(data) >= offset + 3:
            objects = parse_mibeacon_objects(data[offset:])
            if 'weightKg' in objects:
                return {
                    "weightKg": objects['weightKg'],
                    "impedanceOhm": objects.get('impedanceOhm'),
                    "isStabilized": True,
                    "timestamp": datetime.now().isoformat(),
                }

    return None


class MiScaleScanner:
    """Scanner for Mi Scale S400 devices - parses MiBeacon encrypted advertisements."""

    def __init__(
        self,
        target_mac: Optional[str] = None,
        bindkey: Optional[str] = None,
        scan_duration: float = 60.0
    ):
        self.target_mac = target_mac
        self.bindkey = bytes.fromhex(bindkey) if bindkey else None
        self.scan_duration = scan_duration
        self.discovered_devices: Dict[str, BLEDevice] = {}
        self.last_measurement: Optional[Dict[str, Any]] = None
        self.measurement_count = 0
        self.should_stop = False

    def detection_callback(self, device: BLEDevice, advertisement_data: AdvertisementData):
        """Callback for each discovered device - parses MiBeacon advertisements."""
        name = advertisement_data.local_name or device.name
        device_id = device.address

        # Check for MiBeacon service data
        has_mibeacon = any(
            MIBEACON_SERVICE_SHORT in str(uuid).lower()
            for uuid in advertisement_data.service_data.keys()
        )

        # Log all Mi Scale devices
        if is_mi_scale_device(name):
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
                output_json({
                    "type": "debug",
                    "message": f"Mi Scale detected: {name} ({device_id}), has MiBeacon: {has_mibeacon}"
                })

        # Skip if not Mi Scale and no MiBeacon data
        if not is_mi_scale_device(name) and not has_mibeacon:
            return

        # MAC filtering logic:
        # On macOS, device_id is a UUID, not a MAC address
        # We can't reliably match MAC (from Xiaomi Cloud) to UUID (from CoreBluetooth)
        # So we use softer matching: process all Mi Scale devices with MiBeacon data
        # The bindkey will only decrypt data from the correct device anyway
        mac_matches = True
        if self.target_mac and has_mibeacon:
            # Try MAC comparison (works on Linux/Windows where device_id is MAC)
            target_clean = self.target_mac.lower().replace(':', '').replace('-', '')
            device_clean = device_id.lower().replace(':', '').replace('-', '')
            # If device_id looks like a UUID (contains letters a-f outside of hex MAC), skip MAC filter
            is_macos_uuid = len(device_clean) > 12  # MAC is 12 hex chars, UUID is longer
            if not is_macos_uuid:
                mac_matches = target_clean in device_clean or device_clean in target_clean
            # On macOS, accept all Mi Scale devices - bindkey will validate

            if not mac_matches and not is_macos_uuid:
                output_json({
                    "type": "debug",
                    "message": f"MAC mismatch, skipping: {device_id} (target: {self.target_mac})"
                })
                return

        # Parse MiBeacon service data
        for uuid, data in advertisement_data.service_data.items():
            uuid_str = str(uuid).lower()

            if MIBEACON_SERVICE_SHORT in uuid_str:
                output_json({
                    "type": "debug",
                    "message": f"MiBeacon data [{uuid}]: {data.hex()}"
                })

                measurement = parse_scale_service_data(
                    bytes(data),
                    self.bindkey,
                    self.target_mac
                )

                if measurement and (measurement.get('weightKg') or measurement.get('impedanceOhm')):
                    # Check if this is a new/different measurement
                    is_new_measurement = self.last_measurement is None
                    weight_changed = False
                    impedance_changed = False

                    if not is_new_measurement:
                        last_weight = self.last_measurement.get("weightKg") or 0
                        last_impedance = self.last_measurement.get("impedanceOhm") or 0
                        curr_weight = measurement.get("weightKg") or 0
                        curr_impedance = measurement.get("impedanceOhm") or 0

                        weight_changed = abs(curr_weight - last_weight) > 0.05
                        impedance_changed = abs(curr_impedance - last_impedance) > 10

                    # Always emit for real-time weight display in UI
                    output_json({
                        "type": "measurement",
                        "deviceId": device_id,
                        "deviceName": name or "Mi Scale",
                        "measurement": measurement,
                    })

                    # Track unique measurements for stats
                    if is_new_measurement or weight_changed or impedance_changed:
                        self.last_measurement = measurement
                        self.measurement_count += 1

    async def scan(self):
        """Start BLE scanning and parse MiBeacon advertisements."""
        output_json({
            "type": "status",
            "status": "scanning",
            "message": "Starting MiBeacon BLE scan for Mi Scale..."
        })

        if self.bindkey:
            output_json({
                "type": "debug",
                "message": f"Using bindkey for decryption: {self.bindkey.hex()} (length: {len(self.bindkey)} bytes)"
            })
        else:
            output_json({
                "type": "debug",
                "message": "No bindkey provided - will only work with unencrypted scales"
            })

        try:
            scanner = BleakScanner(detection_callback=self.detection_callback)
            await scanner.start()

            output_json({
                "type": "status",
                "status": "scanning",
                "message": f"Scanning for {self.scan_duration}s... Step on scale for measurement."
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
    parser = argparse.ArgumentParser(description='BLE Scanner for Mi Scale S400 (MiBeacon)')
    parser.add_argument('--scan-duration', type=float, default=60.0,
                        help='Scan duration in seconds (default: 60)')
    parser.add_argument('--device-mac', type=str, default=None,
                        help='Target device MAC address')
    parser.add_argument('--bindkey', type=str, default=None,
                        help='MiBeacon decryption key (32 hex characters)')
    parser.add_argument('--continuous', action='store_true',
                        help='Continuous scanning mode')

    args = parser.parse_args()

    output_json({
        "type": "status",
        "status": "initializing",
        "message": "Mi Scale MiBeacon BLE Scanner starting..."
    })

    # Validate bindkey format
    if args.bindkey:
        if len(args.bindkey) != 32:
            output_json({
                "type": "error",
                "error": "invalid_bindkey",
                "message": f"Bindkey must be 32 hex characters, got {len(args.bindkey)}"
            })
            sys.exit(1)
        try:
            bytes.fromhex(args.bindkey)
        except ValueError:
            output_json({
                "type": "error",
                "error": "invalid_bindkey",
                "message": "Bindkey must be valid hexadecimal"
            })
            sys.exit(1)

    scanner = MiScaleScanner(
        target_mac=args.device_mac,
        bindkey=args.bindkey,
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
