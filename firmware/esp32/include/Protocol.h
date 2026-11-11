#pragma once
#include <ArduinoJson.h>
namespace nexdrive {
constexpr int kProtocolVersion=1;
inline bool validEnvelope(JsonDocument& d) { return d["version"].is<int>() && d["version"].as<int>()==kProtocolVersion && d["type"].is<const char*>() && d["sequence"].is<uint32_t>(); }
}
