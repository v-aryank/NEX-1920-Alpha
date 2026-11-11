#pragma once
#include "ControlCore.h"
#include "MotorDriver.h"
namespace nexdrive {
class DriveController {
 public:
  void begin(const HardwareProfile& profile,MotorDriver& motor){profile_=&profile;motor_=&motor;reset();}
  void command(float throttle,float steering,uint32_t now){if(!profile_||!validAxis(throttle)||!validAxis(steering))return;const float sensitive=steering*profile_->steeringSensitivity;const auto out=mix(throttle,sensitive>1?1:(sensitive< -1?-1:sensitive));targetLeft_=out.left;targetRight_=out.right;last_=now;}
  void tick(uint32_t now,bool armed){if(!motor_)return;if(!armed){reset();motor_->disable();return;}const uint32_t dt=now-last_;last_=now;left_=approach(left_,targetLeft_,(float)dt,profile_->accelerationMs,profile_->decelerationMs);right_=approach(right_,targetRight_,(float)dt,profile_->accelerationMs,profile_->decelerationMs);motor_->write(left_,right_);}
  void reset(){left_=right_=targetLeft_=targetRight_=0;}
  float left()const{return left_;} float right()const{return right_;}
 private: const HardwareProfile* profile_=nullptr;MotorDriver* motor_=nullptr;float left_=0,right_=0,targetLeft_=0,targetRight_=0;uint32_t last_=0;
};
}
