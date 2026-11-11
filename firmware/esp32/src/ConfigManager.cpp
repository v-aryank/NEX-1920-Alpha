#include "ConfigManager.h"
#include <Preferences.h>
#include <ArduinoJson.h>
#include <cmath>
#include <cstring>

namespace nexdrive {
namespace {
bool readUnsigned(JsonVariantConst value, uint32_t fallback, uint32_t maximum, uint32_t& result) {
  if (value.isUnbound()) { result = fallback; return true; }
  if (!value.is<uint32_t>()) return false;
  result = value.as<uint32_t>();
  return result <= maximum;
}

bool readPin(JsonVariantConst value, int& result) {
  if (!value.is<int>()) return false;
  result = value.as<int>();
  return true;
}

bool readBool(JsonVariantConst value, bool fallback, bool& result) {
  if (value.isUnbound()) { result = fallback; return true; }
  if (!value.is<bool>()) return false;
  result = value.as<bool>();
  return true;
}

bool readFloat(JsonVariantConst value, float fallback, float& result) {
  if (value.isUnbound()) { result = fallback; return true; }
  if (!value.is<float>()) return false;
  result = value.as<float>();
  return std::isfinite(result);
}

bool readString(JsonVariantConst value, String& result) {
  if (value.isUnbound()) { result = ""; return true; }
  if (!value.is<const char*>()) return false;
  result = value.as<const char*>();
  return true;
}

bool storeString(Preferences& preferences, const char* key, const String& value) {
  preferences.putString(key, value);
  return preferences.getType(key) == PT_STR && preferences.getString(key) == value;
}

void rejectConfig(const char* reason) {
  Serial.print("CONFIG REJECTED: ");
  Serial.println(reason);
}
}

DeviceConfig loadConfig() {
  DeviceConfig c;
  Preferences n;
  if (!n.begin("nexdrive", true)) return c;
  c.ssid = n.getString("ap_ssid", "");
  c.password = n.getString("ap_pass", "");
  c.staSsid = n.getString("sta_ssid", "");
  c.staPassword = n.getString("sta_pass", "");
  c.port = n.getUShort("port", 81);
  c.hardware.driver = static_cast<Driver>(n.getUChar("driver", 0xff));
  c.hardware.vehicle = static_cast<Vehicle>(n.getUChar("vehicle", 0xff));
  c.hardware.left = {n.getChar("la1", -1), n.getChar("la2", -1), n.getChar("lap", -1)};
  c.hardware.right = {n.getChar("rb1", -1), n.getChar("rb2", -1), n.getChar("rbp", -1)};
  c.hardware.standby = n.getChar("stby", -1);
  c.hardware.maxCombinedCurrentMa = n.getUShort("current", 0);
  c.hardware.maxPwm = n.getUShort("maxpwm", 700);
  c.hardware.minEffectivePwm = n.getUShort("minpwm", 0);
  c.hardware.accelerationMs = n.getUShort("accelms", 0);
  c.hardware.decelerationMs = n.getUShort("decelms", 0);
  c.hardware.steeringSensitivity = n.getFloat("steersens", 1.0f);
  c.hardware.pwmFrequency = n.getUShort("pwmfreq", 1000);
  c.hardware.pwmResolution = n.getUChar("pwmres", 10);
  c.hardware.invertLeft = n.getBool("invleft", false);
  c.hardware.invertRight = n.getBool("invright", false);
  const bool profileCommitted = n.getBool("profile_ok", false);
  n.end();
  c.configured = profileCommitted && c.hardware.valid();
  return c;
}

void pollSerialConfig() {
  static String line;
  static bool overflow = false;
  if (!Serial.available()) return;
  const char ch = static_cast<char>(Serial.read());
  if (ch != '\n') {
    if (line.length() < 1024) line += ch;
    else overflow = true;
    return;
  }
  if (overflow) {
    line = "";
    overflow = false;
    rejectConfig("input exceeds 1024 bytes.");
    return;
  }

  JsonDocument d;
  const auto error = deserializeJson(d, line);
  line = "";
  if (error || !d["current_verified"].is<bool>() || !d["current_verified"].as<bool>()) {
    rejectConfig("invalid JSON or current_verified is not true.");
    return;
  }

  uint32_t port = 81, current = 0, maxPwm = 700, minPwm = 0;
  uint32_t acceleration = 0, deceleration = 0, pwmFrequency = 1000, pwmResolution = 10;
  if (!readUnsigned(d["port"], 81, 65535, port) || port == 0 ||
      !readUnsigned(d["combined_current_limit_ma"], 0, 65535, current) || current == 0 ||
      !readUnsigned(d["max_pwm"], 700, 65535, maxPwm) ||
      !readUnsigned(d["min_effective_pwm"], 0, 65535, minPwm) ||
      !readUnsigned(d["acceleration_ramp_ms"], 0, 65535, acceleration) ||
      !readUnsigned(d["deceleration_ramp_ms"], 0, 65535, deceleration) ||
      !readUnsigned(d["pwm_frequency_hz"], 1000, 65535, pwmFrequency) ||
      !readUnsigned(d["pwm_resolution_bits"], 10, 255, pwmResolution)) {
    rejectConfig("unsigned configuration values must be integer JSON numbers within range.");
    return;
  }

  if (!d["driver"].is<const char*>() || !d["vehicle"].is<const char*>()) {
    rejectConfig("driver and vehicle must be strings.");
    return;
  }
  HardwareProfile h;
  const char* driver = d["driver"].as<const char*>();
  const char* vehicle = d["vehicle"].as<const char*>();
  if (!strcmp(driver, "tb6612fng")) h.driver = Driver::Tb6612;
  else if (!strcmp(driver, "l298n")) h.driver = Driver::L298;
  else { rejectConfig("unknown driver."); return; }
  if (!strcmp(vehicle, "2wd")) h.vehicle = Vehicle::TwoWd;
  else if (!strcmp(vehicle, "4wd")) h.vehicle = Vehicle::FourWd;
  else { rejectConfig("unknown vehicle profile."); return; }

  if (!readPin(d["pins"]["left"]["in1"], h.left.in1) ||
      !readPin(d["pins"]["left"]["in2"], h.left.in2) ||
      !readPin(d["pins"]["left"]["pwm"], h.left.pwm) ||
      !readPin(d["pins"]["right"]["in1"], h.right.in1) ||
      !readPin(d["pins"]["right"]["in2"], h.right.in2) ||
      !readPin(d["pins"]["right"]["pwm"], h.right.pwm) ||
      !readPin(d["pins"]["standby"], h.standby)) {
    rejectConfig("every pin assignment must be an integer JSON value.");
    return;
  }

  float steeringSensitivity = 1.0f;
  if (!readFloat(d["steering_sensitivity"], 1.0f, steeringSensitivity)) {
    rejectConfig("steering_sensitivity must be a finite JSON number.");
    return;
  }
  bool invertLeft = false, invertRight = false;
  if (!readBool(d["invert_left"], false, invertLeft) || !readBool(d["invert_right"], false, invertRight)) {
    rejectConfig("motor inversion values must be booleans.");
    return;
  }
  h.maxCombinedCurrentMa = static_cast<uint16_t>(current);
  h.maxPwm = static_cast<uint16_t>(maxPwm);
  h.minEffectivePwm = static_cast<uint16_t>(minPwm);
  h.accelerationMs = static_cast<uint16_t>(acceleration);
  h.decelerationMs = static_cast<uint16_t>(deceleration);
  h.pwmFrequency = static_cast<uint16_t>(pwmFrequency);
  h.pwmResolution = static_cast<uint8_t>(pwmResolution);
  h.steeringSensitivity = steeringSensitivity;
  h.invertLeft = invertLeft;
  h.invertRight = invertRight;
  if (!h.valid()) {
    rejectConfig("pin, driver, PWM or current profile failed validation.");
    return;
  }

  String apSsid, apPassword, staSsid, staPassword;
  if (!readString(d["ap"]["ssid"], apSsid) || !readString(d["ap"]["password"], apPassword) ||
      !readString(d["station"]["ssid"], staSsid) || !readString(d["station"]["password"], staPassword) ||
      apSsid.length() > 32 || staSsid.length() > 32 || apPassword.length() > 63 ||
      (apPassword.length() > 0 && apPassword.length() < 8) || staPassword.length() > 63) {
    rejectConfig("Wi-Fi values have invalid types or lengths.");
    return;
  }

  Preferences n;
  if (!n.begin("nexdrive", false)) { rejectConfig("could not open persistent storage."); return; }
  if (n.putBool("profile_ok", false) != 1) {
    n.end();
    rejectConfig("could not invalidate the previous stored profile.");
    return;
  }
  bool stored = true;
  stored = storeString(n, "ap_ssid", apSsid) && stored;
  stored = storeString(n, "ap_pass", apPassword) && stored;
  stored = storeString(n, "sta_ssid", staSsid) && stored;
  stored = storeString(n, "sta_pass", staPassword) && stored;
  stored = n.putUShort("port", static_cast<uint16_t>(port)) == 2 && stored;
  stored = n.putUChar("driver", h.driver == Driver::L298 ? 1 : 0) == 1 && stored;
  stored = n.putUChar("vehicle", h.vehicle == Vehicle::FourWd ? 1 : 0) == 1 && stored;
  stored = n.putChar("la1", h.left.in1) == 1 && stored;
  stored = n.putChar("la2", h.left.in2) == 1 && stored;
  stored = n.putChar("lap", h.left.pwm) == 1 && stored;
  stored = n.putChar("rb1", h.right.in1) == 1 && stored;
  stored = n.putChar("rb2", h.right.in2) == 1 && stored;
  stored = n.putChar("rbp", h.right.pwm) == 1 && stored;
  stored = n.putChar("stby", h.standby) == 1 && stored;
  stored = n.putUShort("current", h.maxCombinedCurrentMa) == 2 && stored;
  stored = n.putUShort("maxpwm", h.maxPwm) == 2 && stored;
  stored = n.putUShort("minpwm", h.minEffectivePwm) == 2 && stored;
  stored = n.putUShort("accelms", h.accelerationMs) == 2 && stored;
  stored = n.putUShort("decelms", h.decelerationMs) == 2 && stored;
  stored = n.putFloat("steersens", h.steeringSensitivity) == sizeof(float) && stored;
  stored = n.putUShort("pwmfreq", h.pwmFrequency) == 2 && stored;
  stored = n.putUChar("pwmres", h.pwmResolution) == 1 && stored;
  stored = n.putBool("invleft", h.invertLeft) == 1 && stored;
  stored = n.putBool("invright", h.invertRight) == 1 && stored;
  if (stored) stored = n.putBool("profile_ok", true) == 1;
  n.end();
  if (!stored) { rejectConfig("storage write failed; hardware profile remains disabled."); return; }
  Serial.println("CONFIG STORED. Reboot the board to apply. Credentials were not echoed.");
}
}
