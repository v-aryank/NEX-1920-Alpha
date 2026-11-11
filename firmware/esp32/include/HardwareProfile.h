#pragma once
#include <cstdint>
#include <cmath>
namespace nexdrive {
enum class Driver : uint8_t { Tb6612, L298 };
enum class Vehicle : uint8_t { TwoWd, FourWd };
struct ChannelPins { int in1=-1, in2=-1, pwm=-1; };
struct HardwareProfile {
  Driver driver=Driver::Tb6612; Vehicle vehicle=Vehicle::TwoWd;
  ChannelPins left, right; int standby=-1; bool invertLeft=false,invertRight=false;
  uint16_t pwmFrequency=1000, maxPwm=700; uint8_t pwmResolution=10;
  uint16_t minEffectivePwm=0, accelerationMs=0, decelerationMs=0;
  float steeringSensitivity=1.0f;
  uint16_t maxCombinedCurrentMa=0; // Must be explicitly checked/configured by installer.
  bool valid() const {
    if((driver!=Driver::Tb6612 && driver!=Driver::L298) ||
       (vehicle!=Vehicle::TwoWd && vehicle!=Vehicle::FourWd)) return false;
    const int pins[]={left.in1,left.in2,left.pwm,right.in1,right.in2,right.pwm};
    if(maxCombinedCurrentMa==0 || maxPwm==0 || minEffectivePwm>maxPwm || pwmResolution<8 || pwmResolution>12 || maxPwm>((1u<<pwmResolution)-1u) || pwmFrequency<100 || pwmFrequency>20000 || pwmFrequency>(80000000u/(1u<<pwmResolution)) || !std::isfinite(steeringSensitivity) || steeringSensitivity<0.1f || steeringSensitivity>2.0f) return false;
    // ESP32 DevKit/WROOM profile: output-capable, non-strapping GPIOs only.
    const int allowed[]={4,13,14,16,17,18,19,21,22,23,25,26,27,32,33};
    for(int p:pins){bool ok=false;for(int a:allowed)if(p==a)ok=true;if(!ok)return false;}
    for(int i=0;i<6;i++) for(int j=i+1;j<6;j++) if(pins[i]==pins[j]) return false;
    if(driver==Driver::Tb6612){bool ok=false;for(int a:allowed)if(standby==a)ok=true;if(!ok)return false;}
    if(driver==Driver::L298 && standby!=-1) return false;
    if(standby>=0) for(int p:pins) if(standby==p) return false;
    return true;
  }
};
}
