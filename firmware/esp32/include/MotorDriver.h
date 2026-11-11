#pragma once
#include "ControlCore.h"
#include "HardwareProfile.h"
namespace nexdrive { class MotorDriver { public: bool begin(const HardwareProfile&); void write(float,float); void disable(); private: HardwareProfile p_; bool ready_=false; void channel(const ChannelPins&,float,bool); }; }
