#pragma once
#include <WebSocketsServer.h>
#include "NetworkManager.h"
#include "MotorDriver.h"
#include "DriveController.h"
#include "ControlCore.h"
#include <memory>
namespace nexdrive { class ProtocolServer { public: void begin(uint16_t,DeviceConfig&,NetworkManager&,MotorDriver&,DriveController&,Safety&); void loop(); private: std::unique_ptr<WebSocketsServer> server_; DeviceConfig* config_=nullptr; NetworkManager* network_=nullptr; MotorDriver* motor_=nullptr; DriveController* drive_=nullptr; Safety* safety_=nullptr; uint32_t lastSequence_=0,lastTelemetry_=0,responseSequence_=0; bool hasSequence_=false; int activeClient_=-1; void event(uint8_t,WStype_t,uint8_t*,size_t); void reply(uint8_t,const char*,const char*,const char* = nullptr); void telemetry(uint8_t); }; }
