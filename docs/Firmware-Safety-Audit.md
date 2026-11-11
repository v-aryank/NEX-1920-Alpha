# Firmware Safety Audit — Phase 3.1

**Audit date:** 2026-11-11  
**Scope:** Firmware source, configuration loading/provisioning, WebSocket command path, frontend session safety, simulator, native tests, PlatformIO build, and default ESP32 partition usage. No board was flashed and no motor was operated.

## Result summary

| Classification | Result |
|---|---|
| PASS | Differential mix and axis validation; software arm/STOP/disconnect/watchdog state transitions; enum and profile validation; simulator control-state tests; ESP32 build. |
| WARNING | Watchdog shares the main loop; hardware output levels and driver behavior are unverified; firmware protocol handler has no direct automated protocol test; UI exit/mode behavior has no interaction test; station-mode WebSocket has no app-level authentication; flash slot has about 17% headroom. |
| FAIL | One persisted-enum fail-open condition was found and fixed. Serial provisioning also accepted coercible numeric values and lacked an atomic profile-valid gate; both were fixed. No known software FAIL remains after the fixes and rerun. |
| NOT VERIFIED | Physical GPIO levels, wiring, motor current/thermal suitability, driver stopping behavior, and physical watchdog response. Loopback WebSocket integration is blocked by sandbox socket permissions. |

## Files inspected

- Project instructions: `AGENTS.md`.
- Documentation: `docs/ESP32-Integration.md`, `docs/Testing-Plan.md`, `docs/Communication-Protocol.md`, `docs/Hardware-Schema.md`, `docs/Safety-Spec.md`.
- Firmware: all headers and sources under `firmware/esp32/include` and `firmware/esp32/src`, `firmware/esp32/platformio.ini`, `firmware/esp32/README.md`, and `firmware/esp32/test/test_control.cpp`.
- Simulator: `simulator/server.py`, `simulator/test_simulator.py`, and `simulator/test_server.py`.
- Frontend safety paths: `src/app/App.tsx`, `src/adapters/communication/WebSocketAdapter.ts`, and `src/adapters/communication/types.ts`.
- Build partition table: PlatformIO generated `firmware/esp32/.pio/build/esp32/partitions.bin`, decoded with the Arduino framework `gen_esp32part.py` tool.

## Safety checks

| # | Requirement | Result and evidence |
|---:|---|---|
| 1 | Outputs disabled at startup | **PASS (software path).** Default profile has unset pins and zero current gate. `MotorDriver::begin()` returns before setting GPIO modes when the profile is invalid. A valid profile initializes direction low, PWM zero, and TB6612 STBY low. **WARNING:** actual reset-time GPIO and driver-module pulls were not measured. |
| 2 | Missing/invalid configuration blocks arm | **PASS after fix.** `loadConfig()` now preserves unknown driver/vehicle enum bytes so `HardwareProfile::valid()` rejects them. Serial provisioning requires typed, in-range values and commits `profile_ok` only after successful writes. Native tests cover unsupported enums and invalid profiles. NVS interruption itself was not power-cut tested. |
| 3 | Explicit arm required | **PASS.** `Safety::arm()` requires a connected session and valid configuration. `drive()` rejects disarmed sessions. The protocol sends arm acknowledgement only after the firmware arms; the frontend remains locked until the matching request sequence is acknowledged. Native state tests pass. |
| 4 | STOP disables outputs immediately | **PASS (software request).** STOP disarms, resets the drive controller, then calls `MotorDriver::disable()` in the WebSocket callback. TB6612 direction/PWM are zeroed and STBY is lowered; L298 direction is low and EN PWM is zero. No hardware latency or physical stopping distance was measured. |
| 5 | WebSocket disconnect disarms | **PASS (implementation/native state).** The active client disconnect event calls `Safety::disconnected()`, resets the drive controller, and disables the motor driver. Native disconnect state tests pass. The live socket integration test could not run in this sandbox. |
| 6 | Watchdog stops motors | **PASS when the main loop is running.** Only accepted drive messages refresh the 500 ms timer; heartbeat does not. On expiry, the loop disarms, resets output state, and disables the driver. Native watchdog and simulator timeout tests pass. **WARNING:** `tick()` runs after `server_->loop()` in the same Arduino loop; a stalled CPU/event loop can delay this watchdog. It is not an independent hardware watchdog. |
| 7 | Reconnect does not resume movement | **PASS.** A new hello calls `connected()`, clears movement state, and leaves the session disarmed; the STOP latch is preserved until deliberate arm. Native and simulator re-arm tests pass. |
| 8 | Leaving control page disarms | **WARNING.** `App.tsx` calls STOP and locks on control-page exit. The frontend build passes, but there is no automated browser interaction test for this transition. |
| 9 | Mode switch cannot leave controller armed | **WARNING.** Mode selection sends STOP and locks the UI. Device STOP disarms in firmware. The code path was inspected and frontend typecheck/build passed; no UI interaction test exercises it. |
| 10 | Malformed, stale, unsupported, and out-of-range commands | **WARNING.** Firmware validates JSON, v1 envelope, required sequence/type, stale sequence, required axes, and axis bounds; oversized WebSocket frames are disconnected by WebSockets 2.7.3 at 15 KiB. Simulator tests cover protocol version, stale sequence, and axis rejection. Firmware command parsing does not have a direct unit test, and local WebSocket integration was skipped. |
| 11 | Invalid numeric input cannot create unsafe motor output | **PASS (core path).** `validAxis()` rejects nonfinite/out-of-range values; `DriveController::command()` validates both axes; `mapMotorSignal()` maps invalid values to zero. Native core tests pass. |
| 12 | Driver direction, neutral, and disable behavior | **WARNING.** Native tests verify the direction/PWM signal mapping. Source inspection confirms both drivers use zero direction/PWM for neutral/disable. This is coasting/output-disable behavior, not demonstrated active braking. Driver board jumpers, logic, and motor response are unverified. |
| 13 | 2WD and 4WD mapping | **PASS for the documented logical model.** Both profiles use the same left/right differential channels; 4WD requires the two motors on each side to be physically grouped on that side’s driver channel. There is no independent four-motor mapping. Actual paired wiring/current is **NOT VERIFIED**. |
| 14 | TB6612FNG and L298N support | **PASS in software configuration/build.** TB6612 requires a valid STBY pin and uses STBY low for disable. L298N requires no STBY and uses EN PWM for output control. Profile tests and the ESP32 compile pass. Physical board behavior is **NOT VERIFIED**. |
| 15 | Configuration/communication initialization failures fail safe | **PASS for invalid motor profiles and absent WebSocket sessions.** Invalid profile prevents motor GPIO initialization and arm; no handshake means no drive session. **WARNING:** `WiFi.softAP()` and Arduino `analogWriteFrequency()/analogWriteResolution()` provide no checked success path in the current code. Software cannot assert a physical enable state after board/peripheral failure. |

## Hardware configuration findings

- **GPIO validation — PASS for the declared target profile.** The validator accepts only ESP32 DevKit/WROOM output GPIOs 4, 13, 14, 16–19, 21–23, 25–27, 32–33; it rejects duplicate pins, boot strapping pins, flash pins, UART pins, and input-only GPIOs. This is board-specific, not a universal ESP32 map. Some modules (for example WROVER variants) reserve pins differently.
- **PWM — PASS in software validation.** Per-pin Arduino Core 3 PWM frequency and resolution are configured. Frequency/resolution/duty limits and sensitivity are checked before profile acceptance. Actual waveform and channel behavior require measurement on the selected board.
- **Polarity/direction — PASS in normalized code.** Channel inversion is applied at the motor driver boundary. Motor signal mapping covers forward, reverse, neutral, and configured minimum/maximum PWM. Wiring polarity still requires bench confirmation.
- **Driver disable — WARNING.** TB6612 uses STBY and L298 uses EN PWM. Many L298N modules include EN jumpers; whether a jumper must be removed depends on the exact module. Check its schematic before attaching GPIOs.
- **2WD/4WD — WARNING.** The firmware treats 4WD as paired left-front/left-rear and right-front/right-rear loads on two logical channels. Combined stall/startup current and thermal capability are user assertions, not measured or checked against driver ratings.
- **Persistence — PASS after fix, with remaining verification.** Unknown enum bytes now fail closed. Serial JSON rejects noninteger/range-coerced GPIO and PWM fields. NVS writes are checked and a profile-valid marker is written last; missing marker disables arm. Previously provisioned NVS without the marker must be provisioned again. No simulated power-cut test covers this path.
- **Startup hardware levels — NOT VERIFIED.** Invalid profiles do not configure GPIO outputs. With a valid profile, software sets safe states during setup; ESP32 reset-time pin behavior, external pulls, driver-board jumpers, and output response need physical verification.

## Validation actually run

- `~/.local/venvs/platformio/bin/pio run -d firmware/esp32` — **PASS**, ESP32 Dev Module, Arduino 3.3.12, WebSockets 2.7.3, ArduinoJson 7.4.3. Firmware image generated; no compiler warnings reported.
- `g++ -std=c++17 -Wall -Wextra -Werror firmware/esp32/test/test_control.cpp -o /tmp/nexdrive-core-tests && /tmp/nexdrive-core-tests` — **PASS**.
- `python3 -m unittest discover -s simulator -p 'test_*.py' -v` — four simulator unit tests **PASS**. The WebSocket loopback integration test was **SKIPPED**, with reason: `sandbox disallows local socket binds: [Errno 1] Operation not permitted`.
- `npm run build` — **PASS** for TypeScript and Vite production build. No frontend test runner is defined. Vite reports one chunk over its 500 kB advisory threshold (the lazy 3D vehicle asset); this does not fail the build.
- `git diff --check` — **PASS**.

## Memory and partitions

The build uses **47,600 / 327,680 bytes RAM (14.5%)** and **1,089,778 / 1,310,720 bytes app flash (83.1%)**. The default `default.csv` partition table has two OTA app slots of 1,280 KiB each; this is not 83.1% of the ESP32’s full 4 MiB flash. The active app slot has **220,942 bytes remaining (~216 KiB, 16.9%)**. This is expected for the default OTA-capable layout and leaves moderate growth headroom. Future features or larger assets may require size review; no partition change is justified now.

## Risks and prioritized next actions

1. **Before motor power:** verify the exact ESP32 module, GPIO schematic, driver-board version/jumpers, motor voltage and stall/startup current, grouped 4WD current, supply, grounds, and cooling. Configure only those verified values. Keep wheels raised, use current limiting, and have an independent power disconnect.
2. **Before relying on autonomous failsafe:** evaluate a hardware watchdog or independent driver-enable/power-disable path. The existing 500 ms firmware watchdog cannot run if the main loop stalls.
3. **Before release:** add an on-target test for malformed/stale frames, watchdog latency, STOP/disconnect, and driver pin outputs. Run the currently skipped loopback WebSocket test in an environment that permits local sockets; add UI interaction checks for page exit and mode changes.
4. **Station-mode security:** WebSocket has no app-level authentication or TLS. Limit Station mode to a trusted isolated LAN until transport authentication is designed; do not expose this port to the internet.
5. **Flash growth:** monitor app slot usage; the current OTA slot has about 216 KiB free.

## Unverified behavior

No ESP32 was flashed. No motor or driver was connected or energized. Physical startup pin levels, AP/Station operation on the target network, PWM waveform, driver truth tables, braking/coasting, watchdog behavior during CPU/network stalls, current/thermal limits, and vehicle stopping distance remain unverified. The simulator is not evidence of physical safety.
