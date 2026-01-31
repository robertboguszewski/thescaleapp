#!/usr/bin/env python3
"""
Tests for BLE GATT Scanner parsing functions.
Run with: python3 -m pytest scripts/test_ble_gatt_scanner.py -v
"""

import pytest
import struct
from unittest.mock import MagicMock, AsyncMock, patch
from datetime import datetime

# Import functions to test
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))


class TestParseWeightMeasurement:
    """Tests for parse_weight_measurement function."""

    def test_parse_basic_metric_weight(self):
        """Parse weight in kg without optional fields."""
        from ble_gatt_scanner import parse_weight_measurement

        # Flags: 0x00 (metric, no optional fields)
        # Weight: 75.00 kg = 15000 raw (75.00 / 0.005)
        data = bytes([0x00]) + struct.pack('<H', 15000)

        result = parse_weight_measurement(data)

        assert result is not None
        assert result['weightKg'] == 75.0
        assert result['unit'] == 'kg'
        assert 'isStabilized' in result

    def test_parse_imperial_weight(self):
        """Parse weight in lbs and convert to kg."""
        from ble_gatt_scanner import parse_weight_measurement

        # Flags: 0x01 (imperial)
        # Weight: 165.35 lbs = 16535 raw (165.35 / 0.01)
        # Expected: 165.35 * 0.453592 = 74.98 kg
        data = bytes([0x01]) + struct.pack('<H', 16535)

        result = parse_weight_measurement(data)

        assert result is not None
        assert 74.9 < result['weightKg'] < 75.1
        assert result['unit'] == 'lbs'

    def test_parse_with_timestamp(self):
        """Parse weight with device timestamp."""
        from ble_gatt_scanner import parse_weight_measurement

        # Flags: 0x02 (has timestamp)
        # Weight: 80.0 kg = 16000 raw
        # Timestamp: 2024-01-15 10:30:45
        flags = 0x02
        weight_raw = struct.pack('<H', 16000)
        timestamp = struct.pack('<H', 2024) + bytes([1, 15, 10, 30, 45])
        data = bytes([flags]) + weight_raw + timestamp

        result = parse_weight_measurement(data)

        assert result is not None
        assert result['weightKg'] == 80.0
        assert 'deviceTimestamp' in result
        assert '2024-01-15' in result['deviceTimestamp']

    def test_parse_with_user_id(self):
        """Parse weight with user ID."""
        from ble_gatt_scanner import parse_weight_measurement

        # Flags: 0x04 (has user ID)
        # Weight: 70.0 kg = 14000 raw
        # User ID: 5
        data = bytes([0x04]) + struct.pack('<H', 14000) + bytes([5])

        result = parse_weight_measurement(data)

        assert result is not None
        assert result['weightKg'] == 70.0
        assert result['userId'] == 5

    def test_parse_too_short(self):
        """Return None for data shorter than 3 bytes."""
        from ble_gatt_scanner import parse_weight_measurement

        result = parse_weight_measurement(bytes([0x00, 0x00]))

        assert result is None

    def test_stabilization_detection_same_weight_repeated(self):
        """Detect stabilization when weight unchanged for multiple readings."""
        from ble_gatt_scanner import parse_weight_measurement, WeightStabilityTracker

        tracker = WeightStabilityTracker(stable_count_threshold=3, tolerance_kg=0.05)

        # Same weight 3 times should mark as stabilized
        data = bytes([0x00]) + struct.pack('<H', 15000)  # 75.0 kg

        for i in range(3):
            result = parse_weight_measurement(data)
            is_stable = tracker.check_stability(result['weightKg'])

        assert is_stable is True

    def test_stabilization_detection_weight_changing(self):
        """Not stabilized when weight is still changing."""
        from ble_gatt_scanner import parse_weight_measurement, WeightStabilityTracker

        tracker = WeightStabilityTracker(stable_count_threshold=3, tolerance_kg=0.05)

        # Different weights each time
        weights = [14000, 14500, 15000]  # 70.0, 72.5, 75.0 kg

        for w in weights:
            data = bytes([0x00]) + struct.pack('<H', w)
            result = parse_weight_measurement(data)
            is_stable = tracker.check_stability(result['weightKg'])

        assert is_stable is False


class TestParseXiaomiWeightAdvertisement:
    """Tests for parse_xiaomi_weight_advertisement function."""

    def test_parse_stabilized_kg_measurement(self):
        """Parse stabilized measurement in kg."""
        from ble_gatt_scanner import parse_xiaomi_weight_advertisement

        # Flags: 0x22 (kg unit + stabilized)
        # Weight: 75.0 kg = 15000 raw (75.0 * 200)
        flags = 0x22  # Bit 1 (kg) + Bit 5 (stabilized)
        weight_raw = struct.pack('<H', 15000)
        reserved = bytes([0] * 5)
        sequence = struct.pack('<H', 1)
        data = bytes([flags]) + weight_raw + reserved + sequence

        result = parse_xiaomi_weight_advertisement(data)

        assert result is not None
        assert result['weightKg'] == 75.0
        assert result['isStabilized'] is True
        assert result['loadRemoved'] is False

    def test_parse_unstable_measurement(self):
        """Parse unstable (in-progress) measurement."""
        from ble_gatt_scanner import parse_xiaomi_weight_advertisement

        # Flags: 0x02 (kg unit only, not stabilized)
        flags = 0x02
        weight_raw = struct.pack('<H', 14000)
        reserved = bytes([0] * 5)
        sequence = struct.pack('<H', 1)
        data = bytes([flags]) + weight_raw + reserved + sequence

        result = parse_xiaomi_weight_advertisement(data)

        assert result is not None
        assert result['isStabilized'] is False

    def test_parse_load_removed(self):
        """Parse measurement after person stepped off."""
        from ble_gatt_scanner import parse_xiaomi_weight_advertisement

        # Flags: 0xA2 (kg + stabilized + load removed)
        flags = 0xA2  # Bit 1 + Bit 5 + Bit 7
        weight_raw = struct.pack('<H', 15000)
        reserved = bytes([0] * 5)
        sequence = struct.pack('<H', 1)
        data = bytes([flags]) + weight_raw + reserved + sequence

        result = parse_xiaomi_weight_advertisement(data)

        assert result is not None
        assert result['isStabilized'] is True
        assert result['loadRemoved'] is True

    def test_parse_lbs_measurement(self):
        """Parse measurement in pounds."""
        from ble_gatt_scanner import parse_xiaomi_weight_advertisement

        # Flags: 0x04 (lbs unit)
        # Weight: 165.35 lbs = 16535 raw
        flags = 0x04
        weight_raw = struct.pack('<H', 16535)
        reserved = bytes([0] * 5)
        sequence = struct.pack('<H', 1)
        data = bytes([flags]) + weight_raw + reserved + sequence

        result = parse_xiaomi_weight_advertisement(data)

        assert result is not None
        # 165.35 lbs * 0.453592 = 74.98 kg
        assert 74.9 < result['weightKg'] < 75.1

    def test_parse_too_short(self):
        """Return None for data shorter than 10 bytes."""
        from ble_gatt_scanner import parse_xiaomi_weight_advertisement

        result = parse_xiaomi_weight_advertisement(bytes([0x22] * 9))

        assert result is None


class TestGATTScaleScannerReconnection:
    """Tests for disconnect/reconnect handling."""

    @pytest.mark.asyncio
    async def test_disconnect_callback_triggered(self):
        """Verify disconnect callback is called when connection drops."""
        from ble_gatt_scanner import GATTScaleScanner

        scanner = GATTScaleScanner(
            device_address="AA:BB:CC:DD:EE:FF",
            scan_duration=10.0,
            auto_reconnect=True
        )

        disconnect_called = False

        def on_disconnect():
            nonlocal disconnect_called
            disconnect_called = True

        scanner.on_disconnect_callback = on_disconnect

        # Simulate disconnect
        scanner._handle_disconnection(None)

        assert disconnect_called is True

    @pytest.mark.asyncio
    async def test_auto_reconnect_on_disconnect(self):
        """Verify auto-reconnect is attempted after disconnect."""
        from ble_gatt_scanner import GATTScaleScanner

        scanner = GATTScaleScanner(
            device_address="AA:BB:CC:DD:EE:FF",
            scan_duration=10.0,
            auto_reconnect=True,
            reconnect_delay=0.1,
            max_reconnect_attempts=3
        )

        scanner._reconnect = AsyncMock()
        scanner._handle_disconnection(None)

        # Wait for reconnect attempt
        import asyncio
        await asyncio.sleep(0.2)

        assert scanner._reconnect.called or scanner.reconnect_scheduled

    @pytest.mark.asyncio
    async def test_no_reconnect_when_disabled(self):
        """Verify no reconnect when auto_reconnect is False."""
        from ble_gatt_scanner import GATTScaleScanner

        scanner = GATTScaleScanner(
            device_address="AA:BB:CC:DD:EE:FF",
            scan_duration=10.0,
            auto_reconnect=False
        )

        scanner._reconnect = AsyncMock()
        scanner._handle_disconnection(None)

        import asyncio
        await asyncio.sleep(0.2)

        assert not scanner._reconnect.called

    @pytest.mark.asyncio
    async def test_reconnect_exponential_backoff(self):
        """Verify reconnect delay increases exponentially."""
        from ble_gatt_scanner import GATTScaleScanner

        scanner = GATTScaleScanner(
            device_address="AA:BB:CC:DD:EE:FF",
            scan_duration=10.0,
            auto_reconnect=True,
            reconnect_delay=1.0,
            max_reconnect_delay=30.0,
            max_reconnect_attempts=5
        )

        # Calculate expected delays
        delays = scanner._get_reconnect_delays()

        assert delays[0] == 1.0
        assert delays[1] == 2.0
        assert delays[2] == 4.0
        assert delays[3] == 8.0
        assert delays[4] == 16.0  # Still under max of 30

    @pytest.mark.asyncio
    async def test_reconnect_max_delay_capped(self):
        """Verify reconnect delay is capped at max_reconnect_delay."""
        from ble_gatt_scanner import GATTScaleScanner

        scanner = GATTScaleScanner(
            device_address="AA:BB:CC:DD:EE:FF",
            scan_duration=10.0,
            auto_reconnect=True,
            reconnect_delay=10.0,
            max_reconnect_delay=15.0,
            max_reconnect_attempts=5
        )

        delays = scanner._get_reconnect_delays()

        # 10, 15 (capped), 15, 15, 15
        assert delays[0] == 10.0
        assert delays[1] == 15.0  # Capped
        assert delays[2] == 15.0


class TestWeightStabilityTracker:
    """Tests for weight stabilization detection."""

    def test_stability_after_threshold_reached(self):
        """Weight is stable after N consecutive similar readings."""
        from ble_gatt_scanner import WeightStabilityTracker

        tracker = WeightStabilityTracker(
            stable_count_threshold=3,
            tolerance_kg=0.05
        )

        # First reading - not stable yet
        assert tracker.check_stability(75.0) is False
        assert tracker.check_stability(75.02) is False  # Within tolerance
        assert tracker.check_stability(75.01) is True   # 3rd similar reading

    def test_stability_reset_on_weight_change(self):
        """Stability counter resets when weight changes significantly."""
        from ble_gatt_scanner import WeightStabilityTracker

        tracker = WeightStabilityTracker(
            stable_count_threshold=3,
            tolerance_kg=0.05
        )

        tracker.check_stability(75.0)
        tracker.check_stability(75.02)
        tracker.check_stability(76.0)  # Significant change

        assert tracker.stable_count == 1  # Reset to 1

    def test_get_stable_weight(self):
        """Return stable weight when stabilized."""
        from ble_gatt_scanner import WeightStabilityTracker

        tracker = WeightStabilityTracker(
            stable_count_threshold=2,
            tolerance_kg=0.05
        )

        tracker.check_stability(75.0)
        tracker.check_stability(75.02)

        assert tracker.get_stable_weight() == pytest.approx(75.01, abs=0.05)


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
