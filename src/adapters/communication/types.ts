export type DriveCommand = { version: 1; type: 'drive'; sequence: number; throttle: number; steering: number };
export type StopCommand = { version: 1; type: 'stop'; sequence: number };
export type Telemetry = { version: 1; type: 'telemetry'; simulated?: boolean; firmware?: string; protocol?: number; board?: string; driver?: string; vehicle?: string; connection?: string; watchdog?: 'ok'|'unconfigured'|'expired'; armed?: boolean; estop?: boolean; command_age_ms?: number; left_output?: number; right_output?: number; battery_voltage?: number | null; speed?: number | null; ip?: string };
export type ConnectionState = 'disconnected' | 'connecting' | 'handshaking' | 'connected' | 'error';
export interface CommunicationAdapter {
  readonly state: ConnectionState;
  connect(endpoint: string): Promise<void>;
  sendDrive(throttle: number, steering: number): void;
  arm(): Promise<void>;
  heartbeat(): void;
  stop(): void;
  disconnect(): void;
  onStateChange(listener: (state: ConnectionState) => void): () => void;
  onTelemetry(listener: (data: Telemetry) => void): () => void;
}
