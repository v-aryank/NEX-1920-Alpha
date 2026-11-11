#include "WebSocketServer.h"
#include "Protocol.h"
#include <ArduinoJson.h>
namespace nexdrive {
void ProtocolServer::begin(uint16_t port,DeviceConfig& c,NetworkManager& n,MotorDriver& m,DriveController& d,Safety& s){config_=&c;network_=&n;motor_=&m;drive_=&d;safety_=&s;drive_->begin(c.hardware,m);server_=std::make_unique<WebSocketsServer>(port);server_->begin();server_->onEvent([this](uint8_t id,WStype_t t,uint8_t* p,size_t l){event(id,t,p,l);});}
void ProtocolServer::reply(uint8_t id,const char* type,const char* action,const char* msg){JsonDocument d;d["version"]=1;d["type"]=type;d["sequence"]=responseSequence_;if(action)d["action"]=action;if(msg)d["message"]=msg;String out;serializeJson(d,out);server_->sendTXT(id,out);}
void ProtocolServer::event(uint8_t id,WStype_t type,uint8_t* payload,size_t length){
 if(type==WStype_DISCONNECTED){if(activeClient_==(int)id){safety_->disconnected();drive_->reset();motor_->disable();hasSequence_=false;activeClient_=-1;}return;}
 if(type!=WStype_TEXT)return;
 if(activeClient_>=0&&activeClient_!=(int)id){reply(id,"error",nullptr,"controller_session_in_use");return;}
 JsonDocument d;auto err=deserializeJson(d,payload,length);if(err){responseSequence_=0;reply(id,"error",nullptr,"invalid_json");return;}
 if(!validEnvelope(d)){responseSequence_=0;reply(id,"error",nullptr,"unsupported_or_invalid_envelope");return;}
 const uint32_t seq=d["sequence"].as<uint32_t>();responseSequence_=seq;if(hasSequence_&&!newer(seq,lastSequence_)){reply(id,"error",nullptr,"stale_sequence");return;}lastSequence_=seq;hasSequence_=true;
 const char* kind=d["type"].as<const char*>();const uint32_t now=millis();
 if(!strcmp(kind,"hello")){activeClient_=id;safety_->connected(now);drive_->reset();motor_->disable();reply(id,"acknowledge","hello");telemetry(id);return;}
 if(!strcmp(kind,"heartbeat")){safety_->heartbeat(now);reply(id,"acknowledge","heartbeat");return;}
 if(!strcmp(kind,"arm")){if(!safety_->arm(now,config_->configured)){reply(id,"error",nullptr,"hardware_configuration_invalid");return;}drive_->reset();motor_->disable();reply(id,"acknowledge","arm");telemetry(id);return;}
 if(!strcmp(kind,"stop")){safety_->stop();drive_->reset();motor_->disable();reply(id,"acknowledge","stop");telemetry(id);return;}
 if(!strcmp(kind,"drive")){if(!d["throttle"].is<float>()||!d["steering"].is<float>()){reply(id,"error",nullptr,"missing_drive_axes");return;}float t=d["throttle"].as<float>(),st=d["steering"].as<float>();if(!validAxis(t)||!validAxis(st)){reply(id,"error",nullptr,"drive_axis_out_of_range");return;}if(!config_->configured||!safety_->drive(now,t,st)){reply(id,"error",nullptr,"session_disarmed_or_configuration_invalid");motor_->disable();return;}drive_->command(t,st,now);return;}
 reply(id,"error",nullptr,"unknown_message_type");
}
void ProtocolServer::telemetry(uint8_t id){JsonDocument d;d["version"]=1;d["type"]="telemetry";d["simulated"]=false;d["firmware"]="0.1.0";d["protocol"]=1;d["board"]="esp32dev";d["connection"]=network_->connected()?"online":"waiting";d["driver"]=config_->hardware.driver==Driver::Tb6612?"tb6612fng":"l298n";d["vehicle"]=config_->hardware.vehicle==Vehicle::FourWd?"4wd":"2wd";d["watchdog"]=config_->configured?"ok":"unconfigured";d["armed"]=safety_->armed();d["estop"]=safety_->estop();d["command_age_ms"]=(uint32_t)(millis()-safety_->lastDriveAt());d["ip"]=network_->ip();d["left_output"]=config_->hardware.invertLeft?-drive_->left():drive_->left();d["right_output"]=config_->hardware.invertRight?-drive_->right():drive_->right();String out;serializeJson(d,out);server_->sendTXT(id,out);}
void ProtocolServer::loop(){if(!server_)return;server_->loop();if(safety_->tick(millis())){drive_->reset();motor_->disable();if(activeClient_>=0)telemetry(activeClient_);}drive_->tick(millis(),safety_->armed());if(activeClient_>=0&&(uint32_t)(millis()-lastTelemetry_)>=500){lastTelemetry_=millis();telemetry(activeClient_);}}
}
