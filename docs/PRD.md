# NEXDRIVE MVP

NEXDRIVE is a mobile-first robotic vehicle controller. Initial target is an ESP32 over Wi-Fi using WebSocket. MVP includes Home, landscape-first Control, Settings, dual joysticks, directional and custom modes, emergency stop, 2WD/4WD differential-drive profiles, TB6612FNG/L298N profile selection, safety/watchdog configuration, PWA, and Android packaging.

The UI must distinguish configured values from live hardware telemetry. No autonomous navigation, camera, cloud accounts, remote internet driving, independent four-motor control, or balancing robots in MVP. Hardware safety must be implemented in firmware as well as requested by the app.
