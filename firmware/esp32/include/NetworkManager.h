#pragma once
#include "Config.h"
namespace nexdrive { class NetworkManager { public: void begin(DeviceConfig&); void loop(DeviceConfig&); String ip() const; bool connected() const; private: uint32_t retryAt_=0; bool stationReported_=false; }; }
