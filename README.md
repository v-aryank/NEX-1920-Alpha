# NEXDRIVE

Mobile-first robotic vehicle control interface for ESP32 Wi-Fi robots.

## Development

```sh
npm install
npm run dev
```

The Home dashboard, Control cockpit, local configuration, differential-drive input processing, and version 1 WebSocket adapter are implemented. Set the robot endpoint in Configuration (default `ws://192.168.4.1:81`), then connect. Movement remains locked after connection until **Enable control** is explicitly selected.

## 3D vehicle and mobile orientation

The Home hero uses original procedural Three.js mesh geometry in `src/components/VehicleScene.tsx`; it loads as a split chunk and has no downloaded model or third-party vehicle asset. Its faceted silver-and-black wedge body is inspired by the supplied cyber-car reference. Three.js is MIT licensed ([upstream license](https://github.com/mrdoob/three.js/blob/dev/LICENSE)). The model rotates continuously, has subtle suspension idle, contact shadows and accent lighting, supports pointer parallax and drag-to-inspect, and spins its wheel assemblies while the user inspects it. Reduced motion turns idle animation off.

On mobile, opening Control requests landscape orientation. Capacitor Android uses `@capacitor/screen-orientation`; mobile browsers use the Screen Orientation API and request fullscreen when available. Unsupported browsers show a rotate-device prompt. Leaving Control sends STOP, requests portrait, and exits fullscreen only when this app requested it. Desktop does not receive orientation calls. See the [Capacitor Screen Orientation API](https://next.capacitorjs.com/docs/apis/screen-orientation).

To create or refresh the Android project after dependency installation, run `npx cap sync android`. Open it in Android Studio with `npx cap open android` to build an APK. A local Android SDK/device is required for physical APK and orientation verification.

## Current integration boundary

This frontend can exchange versioned JSON commands and parse telemetry over WebSocket. It does not include ESP32 firmware, motor driver code, board pin assignments, or verified electrical constraints. Firmware watchdog behavior must be implemented and verified independently. PWA metadata and Capacitor Android project scaffolding are included; offline caching, Android Studio APK build, and device verification remain release work.

See [docs](./docs/PRD.md) for the current requirements and safety boundaries.
