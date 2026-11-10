export type DriveCommand = { version: 1; type: 'drive'; sequence: number; throttle: number; steering: number };
export type StopCommand = { version: 1; type: 'stop'; sequence: number };
export type Telemetry = { version: 1; type: 'telemetry'; battery_voltage?: number; speed?: number | null; left_motor?: string; right_motor?: string };
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';
export interface CommunicationAdapter {
  readonly state: ConnectionState;
  connect(endpoint: string): Promise<void>;
  sendDrive(throttle: number, steering: number): void;
  stop(): void;
  disconnect(): void;
  onStateChange(listener: (state: ConnectionState) => void): () => void;
  onTelemetry(listener: (data: Telemetry) => void): () => void;
}
