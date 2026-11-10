# Communication protocol (frontend contract)

Transport is behind `CommunicationAdapter`; the initial adapter uses WebSocket over Wi-Fi. The endpoint is configurable. Messages are JSON with `version: 1`, a `type`, and monotonically increasing sequence number. Drive commands carry finite normalized throttle and steering in [-1, 1]; stop is explicit. Invalid and unsupported messages are rejected.

The current UI requires an explicitly initiated connection and never resumes motion after reconnect. Movement commands are emitted only during active input. Neutral input is emitted on release. Heartbeat/watchdog behavior must be paired with a firmware-side timeout and motor neutralization. Telemetry is shown only when received and validated. Capability negotiation and detailed firmware schemas remain to be finalized before firmware release.
