# NEXDRIVE agent guidance

Read `docs/PRD.md`, `docs/Communication-Protocol.md`, `docs/Hardware-Schema.md`, and `docs/Safety-Spec.md` before changing product behavior. The product brief is the source of truth.

- Keep presentation, controller input, command processing, communication adapters, vehicle/hardware configuration, telemetry, and safety/session logic separate.
- UI components must not contain motor driver logic or claim unsupported telemetry.
- All movement inputs pass through validated, normalized differential-drive processing. Stopping, control release, session exit, disconnect, and safety-triggered stop must request neutral/STOP.
- Reconnection never restores throttle automatically. Firmware watchdog/failsafe is mandatory; frontend logic is supplementary.
- Do not assume GPIO assignments, current capability, wiring, or electrical characteristics.
- Keep communication transport behind adapters and version all protocol messages.
- Preserve the NEXDRIVE visual identity and use accessible labels, keyboard focus, touch targets, and reduced-motion support.
- Keep changes in scope and update documentation when architecture or behavior changes.
