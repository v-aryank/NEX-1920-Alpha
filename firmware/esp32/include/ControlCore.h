#pragma once
#include <cmath>
#include <cstdint>

namespace nexdrive {
struct Output { float left; float right; };
struct MotorSignal { bool in1; bool in2; uint16_t pwm; };
inline bool validAxis(float v) { return std::isfinite(v) && v >= -1.0f && v <= 1.0f; }
inline MotorSignal mapMotorSignal(float value,uint16_t maxPwm,bool invert=false,uint16_t minPwm=0) {
  if(!validAxis(value)||maxPwm==0)return {false,false,0};
  if(invert)value=-value;
  if(value==0)return {false,false,0};
  if(minPwm>maxPwm)return {false,false,0};
  return {value>0,value<0,static_cast<uint16_t>(minPwm+fabsf(value)*(maxPwm-minPwm))};
}
inline Output mix(float throttle, float steering, bool invertLeft=false, bool invertRight=false) {
  float left = throttle + steering, right = throttle - steering;
  const float scale = fmaxf(1.0f, fmaxf(fabsf(left), fabsf(right)));
  left /= scale; right /= scale;
  return { invertLeft ? -left : left, invertRight ? -right : right };
}
inline bool newer(uint32_t next, uint32_t previous) { return static_cast<int32_t>(next - previous) > 0; }
class Safety {
 public:
  explicit Safety(uint32_t timeoutMs=500): timeout_(timeoutMs) {}
  void connected(uint32_t now) { connected_=true; armed_=false; throttle_=steering_=0; last_=now; }
  void disconnected() { connected_=false; armed_=false; estop_=true; throttle_=steering_=0; }
  bool arm(uint32_t now, bool configured) { if(!connected_ || !configured) return false; throttle_=steering_=0; armed_=true; estop_=false; last_=now; return true; }
  void stop() { armed_=false; estop_=true; throttle_=steering_=0; }
  bool drive(uint32_t now,float throttle,float steering) { if(!connected_||!armed_||estop_||!validAxis(throttle)||!validAxis(steering)) return false; throttle_=throttle; steering_=steering; last_=now; return true; }
  void heartbeat(uint32_t) { /* Heartbeats keep the link observable; only fresh drive frames renew motion. */ }
  bool tick(uint32_t now) { if(armed_ && static_cast<uint32_t>(now-last_) > timeout_) { stop(); return true; } return false; }
  bool armed() const { return armed_; } bool estop() const { return estop_; }
  uint32_t lastDriveAt() const { return last_; }
  float throttle() const { return throttle_; } float steering() const { return steering_; }
 private: uint32_t timeout_; uint32_t last_=0; bool connected_=false,armed_=false,estop_=true; float throttle_=0,steering_=0;
};
inline float approach(float current,float target,float dtMs,uint16_t accelMs,uint16_t decelMs) {
  if(current==target)return current;
  const bool reducing=fabsf(target)<fabsf(current)||(current*target<0);
  const uint16_t duration=reducing?decelMs:accelMs;
  if(duration==0)return target;
  const float step=dtMs/(float)duration;
  if(fabsf(target-current)<=step)return target;
  return current+(target>current?step:-step);
}
inline bool validPins(const int* pins, int count, int maximum, int minimum=0) {
  for(int i=0;i<count;i++) { if(pins[i]<minimum || pins[i]>maximum) return false; for(int j=0;j<i;j++) if(pins[i]==pins[j]) return false; }
  return true;
}
} // namespace nexdrive
