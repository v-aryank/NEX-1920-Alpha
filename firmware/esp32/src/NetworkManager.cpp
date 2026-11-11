#include "NetworkManager.h"
#include <WiFi.h>
namespace nexdrive {
void NetworkManager::begin(DeviceConfig& c) {
  WiFi.mode(WIFI_AP_STA);
  String ssid=c.ssid.length()?c.ssid:"NEXDRIVE-"+String((uint32_t)ESP.getEfuseMac(),HEX).substring(4);
  String pass=c.password;
  if(pass.length()<8) { char key[17];snprintf(key,sizeof(key),"%08lx%08lx",(unsigned long)esp_random(),(unsigned long)esp_random());pass=key;Serial.println("Generated AP key (store securely): "+pass); }
  WiFi.softAP(ssid.c_str(),pass.c_str());
  Serial.println("AP SSID: "+ssid);Serial.println("AP IP: "+WiFi.softAPIP().toString());
  if(c.staSsid.length()) { WiFi.begin(c.staSsid.c_str(),c.staPassword.c_str()); retryAt_=millis()+15000; }
}
void NetworkManager::loop(DeviceConfig& c) { const bool station=WiFi.status()==WL_CONNECTED;if(station&&!stationReported_){stationReported_=true;Serial.println("Station IP: "+WiFi.localIP().toString());}if(!station)stationReported_=false;if(c.staSsid.length()&&!station&&(int32_t)(millis()-retryAt_)>=0){WiFi.disconnect();WiFi.begin(c.staSsid.c_str(),c.staPassword.c_str());retryAt_=millis()+15000;} }
String NetworkManager::ip() const { return WiFi.status()==WL_CONNECTED?WiFi.localIP().toString():WiFi.softAPIP().toString(); }
bool NetworkManager::connected() const { return WiFi.status()==WL_CONNECTED||WiFi.softAPgetStationNum()>0; }
}
