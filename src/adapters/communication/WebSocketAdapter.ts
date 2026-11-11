import type { CommunicationAdapter, ConnectionState, Telemetry } from './types';

export class WebSocketAdapter implements CommunicationAdapter {
  private socket?: WebSocket;
  private sequence = 0;
  private current: ConnectionState = 'disconnected';
  private stateListeners = new Set<(state: ConnectionState) => void>();
  private telemetryListeners = new Set<(data: Telemetry) => void>();
  private armWaiter?: { sequence: number; resolve: () => void; reject: (error: Error) => void; timer: number };
  get state() { return this.current; }
  private setState(state: ConnectionState) { this.current = state; this.stateListeners.forEach(fn => fn(state)); }
  private send(type: string, fields: Record<string, unknown> = {}) {
    if (this.socket?.readyState !== WebSocket.OPEN) return undefined;
    this.sequence = (this.sequence + 1) >>> 0;
    this.socket.send(JSON.stringify({ version: 1, type, sequence: this.sequence, ...fields }));
    return this.sequence;
  }
  private cancelArm(reason: string) { if (this.armWaiter) { window.clearTimeout(this.armWaiter.timer); this.armWaiter.reject(new Error(reason)); this.armWaiter = undefined; } }
  onStateChange(fn: (state: ConnectionState) => void) { this.stateListeners.add(fn); return () => this.stateListeners.delete(fn); }
  onTelemetry(fn: (data: Telemetry) => void) { this.telemetryListeners.add(fn); return () => this.telemetryListeners.delete(fn); }
  connect(endpoint: string) {
    if (!/^wss?:\/\//i.test(endpoint)) return Promise.reject(new Error('Use a valid ws:// or wss:// endpoint.'));
    this.disconnect(); this.setState('connecting');
    return new Promise<void>((resolve, reject) => {
      try {
        const socket = new WebSocket(endpoint); this.socket = socket;
        let settled = false;
        let helloSequence: number | undefined;
        const timeout = window.setTimeout(() => { if (this.socket !== socket || settled) return; settled = true; this.setState('error'); socket.close(); reject(new Error('Robot protocol handshake timed out.')); }, 7000);
        socket.onopen = () => { if (this.socket !== socket) { socket.close(); return; } this.setState('handshaking'); helloSequence = this.send('hello', { client: 'nexdrive-web', capabilities: ['arm', 'heartbeat'] }); };
        socket.onerror = () => { window.clearTimeout(timeout); if (this.socket !== socket) return; this.setState('error'); socket.close(); if (!settled) { settled = true; reject(new Error('Could not connect to the robot.')); } };
        socket.onclose = () => { window.clearTimeout(timeout); if (this.socket !== socket) return; this.socket = undefined; this.cancelArm('Connection lost.'); if (this.current !== 'disconnected') this.setState('disconnected'); };
        socket.onmessage = event => {
          if (this.socket !== socket) return;
          try {
            const data: unknown = JSON.parse(String(event.data));
            if (!data || typeof data !== 'object') return;
            const raw = data as Record<string, unknown>;
            if (raw.version !== 1) { socket.close(); return; }
            if (raw.type === 'acknowledge') {
              if (raw.action === 'hello' && this.current === 'handshaking' && raw.sequence === helloSequence) { window.clearTimeout(timeout); if (!settled) { settled = true; this.setState('connected'); resolve(); } }
              if (raw.action === 'arm' && this.armWaiter && raw.sequence === this.armWaiter.sequence) { window.clearTimeout(this.armWaiter.timer); this.armWaiter.resolve(); this.armWaiter = undefined; }
              return;
            }
            if (raw.type === 'error') { const message = typeof raw.message === 'string' ? raw.message : 'Device rejected a protocol command.'; if (this.current === 'handshaking' && raw.sequence === helloSequence && !settled) { window.clearTimeout(timeout); settled = true; this.setState('error'); socket.close(); reject(new Error(message)); } if (this.armWaiter && raw.sequence === this.armWaiter.sequence) { window.clearTimeout(this.armWaiter.timer); this.armWaiter.reject(new Error(message)); this.armWaiter = undefined; } return; }
            if (raw.type !== 'telemetry') return;
            const clean: Telemetry = { version: 1, type: 'telemetry' };
            if (typeof raw.simulated === 'boolean') clean.simulated = raw.simulated;
            for (const key of ['firmware','board','driver','vehicle','connection','ip'] as const) if (typeof raw[key] === 'string' && raw[key].length <= 64) clean[key] = raw[key] as string;
            if (raw.protocol === 1) clean.protocol = 1;
            if (['ok','unconfigured','expired'].includes(String(raw.watchdog))) clean.watchdog = raw.watchdog as Telemetry['watchdog'];
            if (typeof raw.armed === 'boolean') clean.armed = raw.armed;
            if (typeof raw.estop === 'boolean') clean.estop = raw.estop;
            for (const key of ['left_output','right_output'] as const) if (typeof raw[key] === 'number' && Number.isFinite(raw[key]) && Math.abs(raw[key]) <= 1) clean[key] = raw[key] as number;
            if (typeof raw.command_age_ms === 'number' && Number.isFinite(raw.command_age_ms) && raw.command_age_ms >= 0) clean.command_age_ms = raw.command_age_ms;
            if (raw.battery_voltage === null || (typeof raw.battery_voltage === 'number' && Number.isFinite(raw.battery_voltage) && raw.battery_voltage > 0 && raw.battery_voltage <= 100)) clean.battery_voltage = raw.battery_voltage as number | null;
            if (raw.speed === null || (typeof raw.speed === 'number' && Number.isFinite(raw.speed) && Math.abs(raw.speed) <= 1000)) clean.speed = raw.speed as number | null;
            this.telemetryListeners.forEach(fn => fn(clean));
          } catch { /* malformed frames never affect controller state */ }
        };
      } catch (error) { this.setState('error'); reject(error instanceof Error ? error : new Error('Could not create WebSocket.')); }
    });
  }
  arm() {
    if (this.current !== 'connected') return Promise.reject(new Error('Connect to the robot before arming.'));
    if (this.armWaiter) return Promise.reject(new Error('An arm request is already pending.'));
    return new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => { this.armWaiter = undefined; reject(new Error('Arm acknowledgement timed out.')); }, 3000);
      const sequence = this.send('arm');
      if (sequence === undefined) { window.clearTimeout(timer); reject(new Error('Connection is no longer open.')); return; }
      this.armWaiter = { sequence, resolve, reject, timer };
    });
  }
  heartbeat() { this.send('heartbeat'); }
  sendDrive(throttle: number, steering: number) {
    if (![throttle, steering].every(Number.isFinite) || Math.abs(throttle) > 1 || Math.abs(steering) > 1) return;
    this.send('drive', { throttle, steering });
  }
  stop() { this.cancelArm('Arm cancelled by STOP.'); this.send('stop'); }
  disconnect() { if (this.socket) { this.stop(); const socket = this.socket; this.socket = undefined; socket.close(); } else this.cancelArm('Connection closed.'); this.setState('disconnected'); }
}
