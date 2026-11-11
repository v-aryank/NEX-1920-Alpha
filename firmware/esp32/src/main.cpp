#include <Arduino.h>
#include "ConfigManager.h"
#include "ControlCore.h"
#include "MotorDriver.h"
#include "NetworkManager.h"
#include "WebSocketServer.h"
using namespace nexdrive;
static DeviceConfig config;
static nexdrive::NetworkManager network;
static MotorDriver motors;
static DriveController drive;
static ProtocolServer protocol;
static Safety safety(500);
void setup(){
  Serial.begin(115200);delay(100);
  config=loadConfig();
  const bool motorReady=motors.begin(config.hardware);
  if(!motorReady)Serial.println("MOTOR OUTPUTS DISABLED: hardware profile missing or invalid.");
  config.configured=config.configured&&motorReady;
  network.begin(config);
  protocol.begin(config.port,config,network,motors,drive,safety);
  Serial.println("NEXDRIVE firmware ready. Motion remains disarmed until valid configuration and explicit arm.");
}
void loop(){pollSerialConfig();network.loop(config);protocol.loop();delay(1);}
