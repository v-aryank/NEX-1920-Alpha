#include "MotorDriver.h"
#include <Arduino.h>
#include <math.h>
namespace nexdrive {
bool MotorDriver::begin(const HardwareProfile& p){p_=p;if(!p_.valid())return false;const ChannelPins ps[]={p.left,p.right};for(const auto& c:ps){pinMode(c.in1,OUTPUT);pinMode(c.in2,OUTPUT);pinMode(c.pwm,OUTPUT);analogWriteFrequency(c.pwm,p_.pwmFrequency);analogWriteResolution(c.pwm,p_.pwmResolution);digitalWrite(c.in1,LOW);digitalWrite(c.in2,LOW);analogWrite(c.pwm,0);}if(p_.driver==Driver::Tb6612){pinMode(p_.standby,OUTPUT);digitalWrite(p_.standby,LOW);}ready_=true;return true;}
void MotorDriver::channel(const ChannelPins& c,float v,bool inverted){const MotorSignal s=mapMotorSignal(v,p_.maxPwm,inverted,p_.minEffectivePwm);digitalWrite(c.in1,s.in1?HIGH:LOW);digitalWrite(c.in2,s.in2?HIGH:LOW);analogWrite(c.pwm,s.pwm);}
void MotorDriver::write(float l,float r){if(!ready_)return;if(p_.driver==Driver::Tb6612)digitalWrite(p_.standby,HIGH);channel(p_.left,l,p_.invertLeft);channel(p_.right,r,p_.invertRight);}
void MotorDriver::disable(){if(!ready_)return;channel(p_.left,0,false);channel(p_.right,0,false);if(p_.driver==Driver::Tb6612)digitalWrite(p_.standby,LOW);}
}
