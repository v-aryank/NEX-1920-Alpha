# Communication protocol (frontend contract)

Transport stays behind `CommunicationAdapter`; the ESP32 and simulator use WebSocket over Wi-Fi. Every client command is JSON with `version: 1`, a `type`, and a monotonically increasing unsigned 32-bit sequence number. Wrap is allowed using serial-number arithmetic; duplicate and stale frames are rejected. One WebSocket client owns the active controller session.

Client sends `hello` on socket open and waits for `acknowledge/action=hello` before showing Connected. `arm` requires an `acknowledge/action=arm`; errors leave controls locked. Drive frames carry finite normalized throttle and steering in [-1, 1]. Stop is explicit. The app sends heartbeat every 50 ms and, while armed, sends drive frames (including neutral) every 100 ms. Heartbeats alone never renew the motion watchdog: only a valid drive command does. A 500 ms movement-command timeout disarms and neutralizes outputs.

Acknowledgements and command errors echo the request sequence so a delayed response cannot unlock the wrong arm request. Example handshake request and response:

```json
{"version":1,"type":"hello","sequence":1,"client":"nexdrive-web","capabilities":["arm","heartbeat"]}
{"version":1,"type":"acknowledge","sequence":1,"action":"hello"}
```

Server messages include `acknowledge`, `error`, and telemetry. Telemetry fields are optional and only represent received device reports: `simulated`, `firmware`, `protocol`, `board`, `driver`, `vehicle`, `connection`, `watchdog`, `armed`, `estop`, `command_age_ms`, `left_output`, `right_output`, `ip`, `battery_voltage`, and `speed`. Missing battery and speed sensors are `null` in the simulator and omitted in firmware. Outputs are logical motor commands, not physical shaft feedback. Frontend validates fields before display and never restores arm on reconnect.
