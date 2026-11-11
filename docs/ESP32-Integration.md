# ESP32 integration

## Contents and build

Firmware source lives in `firmware/esp32`, uses PlatformIO Arduino, ArduinoJson 7 and WebSocketsServer. Install PlatformIO, then run `pio run -d firmware/esp32 -e esp32`; flash with `pio run -d firmware/esp32 -e esp32 -t upload`. Connect the USB serial monitor at 115200 baud. This image is configured for the ESP32 DevKit target; verify the exact board/module before selecting it.

## First configuration over USB serial

Unconfigured firmware keeps outputs disabled and cannot arm. At the serial monitor, send one JSON object on a single line ending in newline. Provide an exact, board-verified pin map and confirm current requirements before setting `current_verified` true. The following values are illustrative only and must not be copied without hardware verification:

```json
{"current_verified":false,"driver":"tb6612fng","vehicle":"2wd","pins":{"left":{"in1":-1,"in2":-1,"pwm":-1},"right":{"in1":-1,"in2":-1,"pwm":-1},"standby":-1},"combined_current_limit_ma":0,"max_pwm":700,"min_effective_pwm":0,"steering_sensitivity":1.0,"acceleration_ramp_ms":0,"deceleration_ramp_ms":0,"pwm_frequency_hz":1000,"pwm_resolution_bits":10,"invert_left":false,"invert_right":false,"port":81,"ap":{"ssid":"NEXDRIVE-Rover","password":"replace-with-unique-8-char-key"},"station":{"ssid":"","password":""}}
```

The example is intentionally rejected. Configuration numbers must be integer JSON values in range; fractional, negative unsigned fields, wrong types, invalid lengths, unsupported enum values and invalid pin mappings are rejected. Set `current_verified` only after checking motor stall/startup current and driver/supply/thermal limits. For TB6612 provide all A/B direction and PWM pins plus STBY. For L298N use `driver":"l298n"` and `standby:-1` (ENA/ENB correspond to channel PWM; IN1..IN4 to direction pins). Choose unique supported output pins for the exact target board. The validator rejects ESP32 DevKit/WROOM flash, strap, input-only, UART, duplicate or out-of-range pins. Unsupported board layouts require updating the board validator after schematic review.

On successful provisioning, firmware stores the values in ESP32 NVS, checks each write, and commits a profile-valid marker last. A failed or interrupted write leaves motor arming disabled. Firmware versions predating the marker require re-provisioning once. Configuration confirms without echoing credentials. Reboot to apply. A blank AP password causes a random WPA2 key to be generated and printed once for that boot; save it before disconnecting USB. Station credentials are optional. The firmware starts AP+STA mode. Station reconnection retries every 15 seconds without blocking control processing. Local serial setup is intended for a trusted USB connection; protect device access and stored credentials.

## Connect the app

In Settings, enter the AP IP (`192.168.4.1` by default) or the station IP reported in device telemetry, with configured WebSocket port (default 81), for example `ws://192.168.4.1:81`. Join the AP using its generated/configured WPA2 password or place phone and rover on the same trusted LAN. The app waits for protocol v1 hello acknowledgement, then remains locked until explicit arm acknowledgement. The simulator can be selected at `ws://127.0.0.1:8765` on the same computer; from a phone, use the development computer's LAN IP.

## Driver and vehicle constraints

TB6612 uses two direction GPIOs and one PWM per channel plus shared STBY; L298N uses two direction GPIOs and enable PWM per channel. Firmware initializes direction low and PWM zero; TB6612 STBY remains low until a valid armed command. L298N enable outputs are written to zero for STOP. Many L298N boards have EN jumpers that must be checked before connecting GPIO PWM; verify the exact module schematic and remove/retain jumpers only as its documentation requires. Validate logic levels and board compatibility from the specific driver board documentation. 4WD means paired left/right motors share logical outputs; it does not mean independent motor control. Verify combined pair current and driver cooling before wiring in parallel.

The app's battery/speed readings stay blank unless sensor-backed values are received. Current outputs in telemetry are logical normalized commands, not measured wheel motion. Firmware watchdog state reports software configuration/activity; it cannot confirm actual driver wiring or mechanical stopping. Use physical power disconnect and follow `docs/Testing-Plan.md` for bring-up.
