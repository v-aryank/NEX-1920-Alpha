#include "../include/ControlCore.h"
#include "../include/HardwareProfile.h"
#include <cassert>
#include <limits>
using namespace nexdrive;
int main(){
 auto f=mix(1,1); assert(f.left==1 && f.right==0);
 auto turn=mix(0,1); assert(turn.left==1 && turn.right==-1);
 auto reverse=mix(-.5f,0,true,false); assert(reverse.left==.5f && reverse.right==-.5f);
 auto tbForward=mapMotorSignal(.75f,700); assert(tbForward.in1&&!tbForward.in2&&tbForward.pwm==525);
 auto l298Reverse=mapMotorSignal(-.5f,500); assert(!l298Reverse.in1&&l298Reverse.in2&&l298Reverse.pwm==250);
 auto inverted=mapMotorSignal(.25f,400,true); assert(!inverted.in1&&inverted.in2&&inverted.pwm==100);
 auto neutral=mapMotorSignal(0,700); assert(!neutral.in1&&!neutral.in2&&neutral.pwm==0);
 auto minimum=mapMotorSignal(.01f,700,false,80); assert(minimum.pwm==86);
 assert(approach(0,1,100,1000,500)==.1f);assert(approach(1,0,100,1000,500)==.8f);assert(approach(.6f,-.6f,300,1000,500)==0);assert(approach(.6f,0,10,1000,0)==0);
 assert(validAxis(-1)&&validAxis(1)&&!validAxis(1.01f)&&!validAxis(std::numeric_limits<float>::infinity()));
 assert(newer(2,1)&&newer(0,UINT32_MAX)&&!newer(5,5)&&!newer(4,5));
 Safety safety(500); safety.connected(10); assert(!safety.drive(11,1,0)); assert(!safety.arm(11,false)); assert(safety.arm(12,true));
 assert(safety.drive(20,.7f,-.2f)); assert(!safety.drive(21,std::numeric_limits<float>::quiet_NaN(),0));
 assert(!safety.tick(519)); assert(safety.tick(521)); assert(!safety.armed()&&safety.estop());
 assert(safety.arm(600,true)); safety.stop(); assert(!safety.drive(601,1,1)); assert(safety.arm(602,true));
 safety.disconnected(); assert(!safety.armed()&&!safety.drive(603,1,0));safety.connected(604);assert(safety.estop()&&!safety.armed()&&!safety.drive(605,1,0));assert(safety.arm(606,true));
 int good[]={4,5,18,19,21,22}; int duplicate[]={4,5,5}; int invalid[]={4,5,40};
 assert(validPins(good,6,39)); assert(!validPins(duplicate,3,39)); assert(!validPins(invalid,3,39));
 HardwareProfile hp; assert(!hp.valid()); hp.left={4,16,18};hp.right={19,21,22};hp.standby=23;hp.maxCombinedCurrentMa=2000;assert(hp.valid());
 hp.vehicle=Vehicle::FourWd;assert(hp.valid());hp.driver=Driver::L298;hp.standby=-1;assert(hp.valid());
 hp.driver=static_cast<Driver>(0xff);assert(!hp.valid());hp.driver=Driver::Tb6612;hp.vehicle=static_cast<Vehicle>(0xff);assert(!hp.valid());hp.vehicle=Vehicle::TwoWd;
 hp.right.pwm=34;assert(!hp.valid());hp.right.pwm=22;hp.maxCombinedCurrentMa=0;assert(!hp.valid());
 hp.maxCombinedCurrentMa=2000;hp.pwmResolution=12;hp.pwmFrequency=20000;assert(!hp.valid());
}
