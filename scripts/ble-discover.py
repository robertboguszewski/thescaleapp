#!/usr/bin/env python3
"""
Discover all BLE services and characteristics on a device.
"""

import asyncio
import sys
from bleak import BleakClient, BleakScanner

async def discover_services(address):
    print(f"Connecting to {address}...")

    async with BleakClient(address) as client:
        print(f"Connected: {client.is_connected}")
        print("\n=== Services and Characteristics ===\n")

        for service in client.services:
            print(f"Service: {service.uuid}")
            print(f"  Description: {service.description}")

            for char in service.characteristics:
                print(f"  Characteristic: {char.uuid}")
                print(f"    Description: {char.description}")
                print(f"    Properties: {char.properties}")

                # Try to read if readable
                if "read" in char.properties:
                    try:
                        value = await client.read_gatt_char(char.uuid)
                        print(f"    Value: {value.hex()} ({value})")
                    except Exception as e:
                        print(f"    Read error: {e}")

                # List descriptors
                for desc in char.descriptors:
                    print(f"    Descriptor: {desc.uuid} = {desc.description}")

            print()

async def main():
    if len(sys.argv) > 1:
        address = sys.argv[1]
    else:
        # Scan for Xiaomi Scale
        print("Scanning for Xiaomi Scale...")
        devices = await BleakScanner.discover(timeout=10)

        scale = None
        for d in devices:
            name = d.name or ""
            if "xiaomi" in name.lower() or "scale" in name.lower() or "s400" in name.lower():
                scale = d
                print(f"Found: {d.name} ({d.address})")
                break

        if not scale:
            print("No scale found!")
            return

        address = scale.address

    await discover_services(address)

if __name__ == "__main__":
    asyncio.run(main())
