# GATT Implementation Gap Analysis

## Executive Summary

The GATT implementation provides basic real-time weight reading capability but lacks several critical features for production readiness, particularly around connection resilience, complete data parsing, and body composition metrics.

---

## Implementation Status

### Completed
| Feature | File | Status |
|---------|------|--------|
| Dual mode support (mibeacon/gatt) | BleakBLEAdapter.ts | Done |
| Basic GATT connection | ble-gatt-scanner.py | Done |
| Weight measurement parsing (0x2A9D) | ble-gatt-scanner.py | Done |
| Script selection by mode | BleakBLEAdapter.ts:105-107 | Done |
| Scan mode IPC handlers | ipc-handlers.ts | Done |
| Type definitions | BLETypes.ts | Done |

### Missing / Incomplete
| Feature | Priority | Impact |
|---------|----------|--------|
| Auto-reconnection | HIGH | Connection drops require manual restart |
| Stabilized weight detection | HIGH | All weights emitted, no finality signal |
| Body Composition characteristic (0x2A9C) | MEDIUM | No impedance via GATT |
| Historical data retrieval | LOW | Cannot sync past measurements |
| Disconnect callback | MEDIUM | UI doesn't know when connection lost |

---

## Gap Details

### 1. Connection Resilience (HIGH)

**Current:** Scanner exits when connection drops.
**Expected:** Auto-reconnect with exponential backoff.

**Missing in ble-gatt-scanner.py:**
```python
# Should use set_disconnected_callback
def disconnected_callback(client):
    # Handle reconnection
    pass

client = BleakClient(address, disconnected_callback=disconnected_callback)
```

**Best Practice (from bleak docs):**
```python
async with BleakClient(address) as client:
    # Context manager ensures proper cleanup
```

### 2. Stabilized Weight Detection (HIGH)

**Current:** All weight notifications emitted equally.
**Expected:** Distinguish live vs. final measurements.

**From openScale research:**
- Byte 0, Bit 5: Stabilized flag
- Byte 0, Bit 7: Weight removed flag
- Valid final: stabilized=true AND weightRemoved=false

**Current parsing (line 72-79):**
```python
flags = data[0]
is_imperial = bool(flags & 0x01)
# Missing: is_stabilized = bool(flags & 0x20)
# Missing: weight_removed = bool(flags & 0x80)
```

### 3. Body Composition Characteristic (LOW - By Design)

**Current:** Only subscribes to 0x2A9D (weight).
**Reality:** S400 does NOT expose impedance/heartRate via GATT - only via MiBeacon advertisements.

**Standard GATT (0x181D) provides:**
- Weight (real-time, live updates)
- Stabilization state (via flags or tracking)

**MiBeacon provides (but no real-time):**
- Weight (final only)
- Impedance
- Heart rate
- Profile ID

**Conclusion:** This is a protocol limitation, not a bug. Use MiBeacon for full data, GATT for live weight only.

### 4. Historical Data Sync (LOW)

**Current:** Not implemented.
**Expected:** Retrieve measurements stored on scale.

**Protocol (from openScale):**
1. Subscribe to 0x2a2f
2. Write `0x01 0xFF 0xFF 0xFF 0xFF`
3. Write `0x02` to trigger history
4. Receive historical records
5. Write `0x03` to acknowledge

### 5. Edge Cases Not Handled

| Edge Case | Current Behavior | Expected |
|-----------|------------------|----------|
| Device out of range | Python process crashes | Reconnect with timeout |
| Bluetooth adapter off | Error emitted, no recovery | Detect and wait for adapter |
| Scale paired to other device | Connection fails silently | Clear error message |
| Multiple scales nearby | Connects to first found | Device selection/confirmation |
| Battery low | Not detected | Parse and relay warning |

---

## Architecture Gaps

### Data Flow Bottleneck

**Identified in previous session:**
- `heartRateBpm` and `impedanceLowOhm` dropped between scanner and frontend
- Only `weightKg` reliably reaches UI

**Location:** IPC event forwarding in ipc-handlers.ts

### Type Inconsistency

Multiple `RawMeasurement` definitions:
- [src/main/ble/BLETypes.ts](src/main/ble/BLETypes.ts) (BLE layer)
- [src/domain/calculations/types.ts](src/domain/calculations/types.ts) (domain layer)

Should consolidate or ensure consistent mapping.

---

## Recommendations

### Immediate (Before next release)

1. **Add stabilized detection to GATT parser**
   ```python
   is_stabilized = bool(flags & 0x20)
   result["isStabilized"] = is_stabilized
   ```

2. **Add disconnect callback in Python**
   ```python
   self.client = BleakClient(
       self.device_address,
       disconnected_callback=self._on_disconnect
   )
   ```

3. **Fix data flow** - Ensure all measurement fields propagate to frontend

### Short-term

4. **Implement reconnection logic** with exponential backoff (1s, 2s, 4s, max 30s)
5. **Add connection state events** to UI (connecting, connected, disconnected, reconnecting)
6. **Test body composition characteristic** on S400 hardware

### Long-term

7. **Historical data sync** for offline measurements
8. **Multi-device support** with device picker UI
9. **Battery level monitoring**

---

## Sources

- [Bleak Documentation](https://bleak.readthedocs.io/en/latest/)
- [openScale Mi Scale Wiki](https://github.com/oliexdev/openScale/wiki/Xiaomi-Bluetooth-Mi-Scale)
- [Bluetooth GATT Parser - Body Composition](https://github.com/sputnikdev/bluetooth-gatt-parser)
- [bodymiscale - Home Assistant](https://github.com/dckiller51/bodymiscale)

---

*Analysis performed: 2026-01-31*
