export type DriveInput = { throttle: number; steering: number };
export type DriveOutput = { left: number; right: number };

export function processDrive(input: DriveInput, deadzone = 0.08, maxThrottle = 1): DriveOutput {
  const clamp = (n: number) => Math.max(-1, Math.min(1, Number.isFinite(n) ? n : 0));
  const safeDeadzone = Number.isFinite(deadzone) ? Math.max(0, Math.min(deadzone, 0.95)) : 0.08;
  const safeMaxThrottle = Number.isFinite(maxThrottle) ? Math.max(0, Math.min(maxThrottle, 1)) : 1;
  const clean = (n: number) => Math.abs(n) < safeDeadzone ? 0 : clamp(n);
  const throttle = clean(input.throttle) * safeMaxThrottle;
  const steering = clean(input.steering);
  const left = throttle + steering;
  const right = throttle - steering;
  const scale = Math.max(1, Math.abs(left), Math.abs(right));
  return { left: left / scale, right: right / scale };
}

export function normalizeAxis(value: number, deadzone = 0.08): number {
  if (!Number.isFinite(value)) return 0;
  const clamped = Math.max(-1, Math.min(1, value));
  const safeDeadzone = Number.isFinite(deadzone) ? Math.max(0, Math.min(deadzone, 0.95)) : 0.08;
  return Math.abs(clamped) < safeDeadzone ? 0 : clamped;
}
