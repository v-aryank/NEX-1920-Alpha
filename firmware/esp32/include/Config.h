#pragma once
#include <Arduino.h>
#include "HardwareProfile.h"
namespace nexdrive {
struct DeviceConfig { String ssid,password,staSsid,staPassword; uint16_t port=81; HardwareProfile hardware; bool configured=false; };
}
