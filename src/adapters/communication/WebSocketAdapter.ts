import type { CommunicationAdapter, ConnectionState, Telemetry } from './types';

export class WebSocketAdapter implements CommunicationAdapter {
  private socket?: WebSocket;
  private sequence = 0;
  private current: ConnectionState = 'disconnected';
  private stateListeners = new Set<(state: ConnectionState) => void>();
  private telemetryListeners = new Set<(data: Telemetry) => void>();
  get state() { return this.current; }
  private setState(state: ConnectionState) { this.current = state; this.stateListeners.forEach(fn => fn(state)); }
  onStateChange(fn: (state: ConnectionState) => void) { this.stateListeners.add(fn); return () => this.stateListeners.delete(fn); }
  onTelemetry(fn: (data: Telemetry) => void) { this.telemetryListeners.add(fn); return () => this.telemetryListeners.delete(fn); }
  connect(endpoint: string) {
    if (!/^wss?:\/\//i.test(endpoint)) return Promise.reject(new Error('Use a valid ws:// or wss:// endpoint.'));
    this.disconnect(); this.setState('connecting');
    return new Promise<void>((resolve, reject) => {
      try {
        const socket = new WebSocket(endpoint); this.socket = socket;
        const timeout = window.setTimeout(() => { if (this.socket !== socket) return; this.setState('error'); socket.close(); reject(new Error('Connection timed out.')); }, 7000);
        socket.onopen = () => { window.clearTimeout(timeout); if (this.socket !== socket) { socket.close(); return; } this.setState('connected'); resolve(); };
        socket.onerror = () => { window.clearTimeout(timeout); if (this.socket !== socket) return; this.setState('error'); socket.close(); reject(new Error('Could not connect to the robot.')); };
        socket.onclose = () => { window.clearTimeout(timeout); if (this.socket !== socket) return; this.socket = undefined; if (this.current !== 'disconnected') this.setState('disconnected'); };
        socket.onmessage = event => {
          if (this.socket !== socket) return;
          try {
            const data: unknown = JSON.parse(String(event.data));
            if (!data || typeof data !== 'object') return;
            const raw = data as Record<string, unknown>;
            if (raw.version !== 1 || raw.type !== 'telemetry') return;
            const clean: Telemetry = { version: 1, type: 'telemetry' };
            if (typeof raw.battery_voltage === 'number' && Number.isFinite(raw.battery_voltage) && raw.battery_voltage > 0 && raw.battery_voltage <= 100) clean.battery_voltage = raw.battery_voltage;
            if (raw.speed === null || (typeof raw.speed === 'number' && Number.isFinite(raw.speed) && Math.abs(raw.speed) <= 1000)) clean.speed = raw.speed;
            if (typeof raw.left_motor === 'string' && raw.left_motor.length <= 32) clean.left_motor = raw.left_motor;
            if (typeof raw.right_motor === 'string' && raw.right_motor.length <= 32) clean.right_motor = raw.right_motor;
            this.telemetryListeners.forEach(fn => fn(clean));
          } catch { /* malformed telemetry is ignored */ }
        };
      } catch (error) { this.setState('error'); reject(error); }
    });
  }
  sendDrive(throttle: number, steering: number) {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    if (![throttle, steering].every(Number.isFinite) || Math.abs(throttle) > 1 || Math.abs(steering) > 1) return;
    this.socket.send(JSON.stringify({ version: 1, type: 'drive', sequence: ++this.sequence, throttle, steering }));
  }
  stop() { if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify({ version: 1, type: 'stop', sequence: ++this.sequence })); }
  disconnect() { if (this.socket) { this.stop(); this.socket.close(); this.socket = undefined; } this.setState('disconnected'); }
}
