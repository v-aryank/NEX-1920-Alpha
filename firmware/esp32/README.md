# NEXDRIVE ESP32 firmware

Build with PlatformIO: `pio run -e esp32`. Complete board-specific USB serial configuration, wiring checks, AP/STA setup, protocol details and safe testing steps are in `../../docs/ESP32-Integration.md` and `../../docs/Testing-Plan.md`.

`include/ControlCore.h` is portable and tested natively. Networking, WebSocket protocol, config persistence, safety, and driver output are separate modules. No pin mapping or current rating is enabled by default. Invalid configuration leaves outputs disabled. Firmware includes a 500 ms drive-command watchdog and explicit arm/STOP latch, but software status does not validate physical wiring or stopping distance.
