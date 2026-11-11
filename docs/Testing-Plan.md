# NEXDRIVE testing plan

## Automated checks

Run frontend typecheck and production bundle with `npm run build`.

Run portable firmware core tests from the repository root:

```sh
g++ -std=c++17 -Wall -Wextra -Werror firmware/esp32/test/test_control.cpp -o /tmp/nexdrive-core-tests
/tmp/nexdrive-core-tests
```

Run simulator protocol tests:

```sh
python3 -m unittest discover -s simulator -p 'test_*.py'
```

When PlatformIO is installed, build ESP32 firmware with `pio run -d firmware/esp32 -e esp32`.

## Simulator check

Start `python3 simulator/server.py`, then configure the app endpoint to `ws://127.0.0.1:8765`. For a phone, use the development computer's LAN IP and permit port 8765 on its local firewall. Connect, confirm the app displays SIMULATOR/SIMULATED, explicitly arm, verify reported logical outputs change on input, send STOP, confirm output is zero and re-arm is required. Stop the simulator or disconnect Wi-Fi while armed; controls must lock and the simulator must neutralize. Battery voltage and speed must remain unavailable.

## Safe physical bring-up

1. Identify the exact ESP32 module/board and verify each proposed GPIO against its schematic and boot requirements.
2. Read the exact motor and driver data sheets. Verify voltage, per-motor stall current, grouped 4WD current, thermal conditions, grounds, polarity, and supply current limits. Never infer these from the driver name alone.
3. Keep motors disconnected while flashing/provisioning. Inspect the generated AP password over USB serial and store it securely.
4. Use a current-limited supply where possible, wheels raised, and an independent power disconnect within reach.
5. Recheck pin-to-driver wiring and TB6612 STBY / L298N EN wiring with power off. Enable only after the software profile passes validation and the electrical configuration has been checked.
6. Begin at low PWM. Verify forward, reverse, each side, steering mix, neutral on release, STOP, disconnection, watchdog timeout, and re-arm. Stop immediately for unexpected heating, current, motion, or reset behavior.

The NEXDRIVE code and automated simulator cannot validate motor wiring, the actual board pin map, physical braking distance, battery sensing, motor speed sensing, or driver thermal/current suitability. In this sandbox the loopback WebSocket integration test is skipped because local socket binds are denied; the simulator's protocol and failsafe unit tests still run without networking.
