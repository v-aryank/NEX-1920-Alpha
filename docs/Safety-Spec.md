# Safety requirements

Emergency stop immediately requests STOP and requires explicit user action before driving again. Send neutral when input releases; STOP on control-session exit, hidden/lost active session, mode change, disconnect, or communication loss. Reconnection never restores throttle. Reject malformed/out-of-range commands and clamp controller outputs. The firmware independently monitors valid command age and neutralizes motor outputs when its configured watchdog expires. Frontend safety cannot replace firmware or physical validation.

This repository currently implements frontend stop requests and an ESP32 WebSocket transport contract only; firmware and physical failsafe behavior are not yet implemented or verified.
