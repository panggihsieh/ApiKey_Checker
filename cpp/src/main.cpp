#define NOMINMAX

#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <bcrypt.h>
#include <shellapi.h>

#include <algorithm>
#include <atomic>
#include <cctype>
#include <cstdint>
#include <cstdlib>
#include <functional>
#include <iostream>
#include <map>
#include <mutex>
#include <optional>
#include <sstream>
#include <stdexcept>
#include <string>
#include <thread>
#include <vector>

#include "assets.hpp"

namespace {

constexpr std::size_t kMaxRequestBodyBytes = 1024 * 128;
constexpr std::size_t kMaxEnvValueBytes = 1024 * 8;
HANDLE gStopEvent = nullptr;

struct HttpRequest {
  std::string method;
  std::string target;
  std::map<std::string, std::string> headers;
  std::string body;
};

struct HttpResponse {
  int status = 200;
  std::string reason = "OK";
  std::map<std::string, std::string> headers;
  std::string body;
};

std::string toLower(std::string value) {
  std::transform(value.begin(), value.end(), value.begin(), [](unsigned char ch) {
    return static_cast<char>(std::tolower(ch));
  });
  return value;
}

std::string trim(std::string value) {
  auto first = std::find_if_not(value.begin(), value.end(), [](unsigned char ch) {
    return std::isspace(ch) != 0;
  });
  auto last = std::find_if_not(value.rbegin(), value.rend(), [](unsigned char ch) {
    return std::isspace(ch) != 0;
  }).base();
  if (first >= last) {
    return "";
  }
  return std::string(first, last);
}

std::string getHeader(const HttpRequest& request, const std::string& name) {
  auto it = request.headers.find(toLower(name));
  return it == request.headers.end() ? "" : it->second;
}

std::string statusReason(int status) {
  switch (status) {
    case 200:
      return "OK";
    case 204:
      return "No Content";
    case 400:
      return "Bad Request";
    case 401:
      return "Unauthorized";
    case 403:
      return "Forbidden";
    case 404:
      return "Not Found";
    case 405:
      return "Method Not Allowed";
    case 500:
      return "Internal Server Error";
    default:
      return "OK";
  }
}

std::string jsonEscape(const std::string& value) {
  std::string output;
  output.reserve(value.size() + 8);
  for (unsigned char ch : value) {
    switch (ch) {
      case '"':
        output += "\\\"";
        break;
      case '\\':
        output += "\\\\";
        break;
      case '\b':
        output += "\\b";
        break;
      case '\f':
        output += "\\f";
        break;
      case '\n':
        output += "\\n";
        break;
      case '\r':
        output += "\\r";
        break;
      case '\t':
        output += "\\t";
        break;
      default:
        if (ch < 0x20) {
          char buffer[7];
          std::snprintf(buffer, sizeof(buffer), "\\u%04x", ch);
          output += buffer;
        } else {
          output.push_back(static_cast<char>(ch));
        }
    }
  }
  return output;
}

std::wstring utf8ToWide(const std::string& value) {
  if (value.empty()) {
    return L"";
  }
  int length = MultiByteToWideChar(CP_UTF8, 0, value.data(), static_cast<int>(value.size()), nullptr, 0);
  std::wstring output(length, L'\0');
  MultiByteToWideChar(CP_UTF8, 0, value.data(), static_cast<int>(value.size()), output.data(), length);
  return output;
}

std::string wideToUtf8(const std::wstring& value) {
  if (value.empty()) {
    return "";
  }
  int length = WideCharToMultiByte(CP_UTF8, 0, value.data(), static_cast<int>(value.size()), nullptr, 0, nullptr, nullptr);
  std::string output(length, '\0');
  WideCharToMultiByte(CP_UTF8, 0, value.data(), static_cast<int>(value.size()), output.data(), length, nullptr, nullptr);
  return output;
}

bool validateEnvVar(const std::string& envVar) {
  if (envVar.empty() || envVar[0] < 'A' || envVar[0] > 'Z') {
    return false;
  }
  return std::all_of(envVar.begin() + 1, envVar.end(), [](unsigned char ch) {
    return (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch == '_';
  });
}

std::string maskKey(const std::string& value) {
  if (value.empty()) {
    return "";
  }
  if (value.size() <= 8) {
    return "****";
  }
  return value.substr(0, 4) + "..." + value.substr(value.size() - 4);
}

bool timingSafeEqual(const std::string& left, const std::string& right) {
  if (left.size() != right.size()) {
    return false;
  }
  unsigned char diff = 0;
  for (std::size_t index = 0; index < left.size(); ++index) {
    diff |= static_cast<unsigned char>(left[index] ^ right[index]);
  }
  return diff == 0;
}

std::string base64UrlEncode(const std::vector<unsigned char>& data) {
  static constexpr char alphabet[] =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  std::string output;
  for (std::size_t index = 0; index < data.size(); index += 3) {
    unsigned int value = data[index] << 16;
    bool hasSecond = index + 1 < data.size();
    bool hasThird = index + 2 < data.size();
    if (hasSecond) {
      value |= data[index + 1] << 8;
    }
    if (hasThird) {
      value |= data[index + 2];
    }
    output.push_back(alphabet[(value >> 18) & 0x3f]);
    output.push_back(alphabet[(value >> 12) & 0x3f]);
    if (hasSecond) {
      output.push_back(alphabet[(value >> 6) & 0x3f]);
    }
    if (hasThird) {
      output.push_back(alphabet[value & 0x3f]);
    }
  }
  return output;
}

std::string randomToken() {
  std::vector<unsigned char> bytes(32);
  if (BCryptGenRandom(nullptr, bytes.data(), static_cast<ULONG>(bytes.size()), BCRYPT_USE_SYSTEM_PREFERRED_RNG) != 0) {
    throw std::runtime_error("Unable to create helper token.");
  }
  return base64UrlEncode(bytes);
}

std::optional<std::string> parseJsonStringAt(const std::string& input, std::size_t& pos) {
  if (pos >= input.size() || input[pos] != '"') {
    return std::nullopt;
  }
  ++pos;
  std::string output;
  while (pos < input.size()) {
    char ch = input[pos++];
    if (ch == '"') {
      return output;
    }
    if (ch != '\\') {
      output.push_back(ch);
      continue;
    }
    if (pos >= input.size()) {
      return std::nullopt;
    }
    char escaped = input[pos++];
    switch (escaped) {
      case '"':
      case '\\':
      case '/':
        output.push_back(escaped);
        break;
      case 'b':
        output.push_back('\b');
        break;
      case 'f':
        output.push_back('\f');
        break;
      case 'n':
        output.push_back('\n');
        break;
      case 'r':
        output.push_back('\r');
        break;
      case 't':
        output.push_back('\t');
        break;
      default:
        output.push_back(escaped);
        break;
    }
  }
  return std::nullopt;
}

std::optional<std::string> jsonStringField(const std::string& body, const std::string& key) {
  std::string needle = "\"" + key + "\"";
  std::size_t pos = body.find(needle);
  if (pos == std::string::npos) {
    return std::nullopt;
  }
  pos = body.find(':', pos + needle.size());
  if (pos == std::string::npos) {
    return std::nullopt;
  }
  ++pos;
  while (pos < body.size() && std::isspace(static_cast<unsigned char>(body[pos]))) {
    ++pos;
  }
  return parseJsonStringAt(body, pos);
}

std::vector<std::string> jsonStringArrayField(const std::string& body, const std::string& key) {
  std::vector<std::string> values;
  std::string needle = "\"" + key + "\"";
  std::size_t pos = body.find(needle);
  if (pos == std::string::npos) {
    return values;
  }
  pos = body.find('[', pos + needle.size());
  if (pos == std::string::npos) {
    return values;
  }
  ++pos;
  while (pos < body.size()) {
    while (pos < body.size() && std::isspace(static_cast<unsigned char>(body[pos]))) {
      ++pos;
    }
    if (pos >= body.size() || body[pos] == ']') {
      break;
    }
    if (body[pos] == '"') {
      auto parsed = parseJsonStringAt(body, pos);
      if (parsed) {
        values.push_back(*parsed);
      }
    } else {
      ++pos;
    }
    while (pos < body.size() && body[pos] != ',' && body[pos] != ']') {
      ++pos;
    }
    if (pos < body.size() && body[pos] == ',') {
      ++pos;
    }
  }
  return values;
}

std::string readProcessEnv(const std::string& envVar) {
  std::wstring name = utf8ToWide(envVar);
  DWORD needed = GetEnvironmentVariableW(name.c_str(), nullptr, 0);
  if (needed == 0) {
    return "";
  }
  std::wstring value(needed, L'\0');
  DWORD written = GetEnvironmentVariableW(name.c_str(), value.data(), needed);
  if (written == 0) {
    return "";
  }
  value.resize(written);
  return wideToUtf8(value);
}

std::string readRegistryEnv(HKEY hive, const wchar_t* subkey, const std::string& envVar) {
  std::wstring name = utf8ToWide(envVar);
  DWORD type = 0;
  DWORD bytes = 0;
  LONG rc = RegGetValueW(hive, subkey, name.c_str(), RRF_RT_REG_SZ | RRF_RT_REG_EXPAND_SZ, &type, nullptr, &bytes);
  if (rc != ERROR_SUCCESS || bytes == 0) {
    return "";
  }
  std::wstring value(bytes / sizeof(wchar_t), L'\0');
  rc = RegGetValueW(hive, subkey, name.c_str(), RRF_RT_REG_SZ | RRF_RT_REG_EXPAND_SZ, &type, value.data(), &bytes);
  if (rc != ERROR_SUCCESS) {
    return "";
  }
  while (!value.empty() && value.back() == L'\0') {
    value.pop_back();
  }
  return wideToUtf8(value);
}

std::string readEnvValue(const std::string& envVar) {
  std::string user = readRegistryEnv(HKEY_CURRENT_USER, L"Environment", envVar);
  if (!user.empty()) {
    return user;
  }
  std::string system = readRegistryEnv(
      HKEY_LOCAL_MACHINE,
      L"SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment",
      envVar);
  if (!system.empty()) {
    return system;
  }
  return readProcessEnv(envVar);
}

bool saveWindowsUserEnv(const std::string& envVar, const std::string& value) {
  HKEY key = nullptr;
  LONG rc = RegCreateKeyExW(
      HKEY_CURRENT_USER,
      L"Environment",
      0,
      nullptr,
      0,
      KEY_SET_VALUE,
      nullptr,
      &key,
      nullptr);
  if (rc != ERROR_SUCCESS) {
    return false;
  }
  std::wstring name = utf8ToWide(envVar);
  std::wstring wideValue = utf8ToWide(value);
  rc = RegSetValueExW(
      key,
      name.c_str(),
      0,
      REG_SZ,
      reinterpret_cast<const BYTE*>(wideValue.c_str()),
      static_cast<DWORD>((wideValue.size() + 1) * sizeof(wchar_t)));
  RegCloseKey(key);
  if (rc != ERROR_SUCCESS) {
    return false;
  }
  SetEnvironmentVariableW(name.c_str(), wideValue.c_str());
  SendMessageTimeoutW(
      HWND_BROADCAST,
      WM_SETTINGCHANGE,
      0,
      reinterpret_cast<LPARAM>(L"Environment"),
      SMTO_ABORTIFHUNG,
      5000,
      nullptr);
  return true;
}

std::string pathOnly(const std::string& target) {
  std::size_t end = target.find_first_of("?#");
  return end == std::string::npos ? target : target.substr(0, end);
}

std::optional<std::string> percentDecodePath(const std::string& value) {
  std::string output;
  output.reserve(value.size());
  for (std::size_t index = 0; index < value.size(); ++index) {
    if (value[index] != '%') {
      output.push_back(value[index]);
      continue;
    }
    if (index + 2 >= value.size()) {
      return std::nullopt;
    }
    auto hex = [](char ch) -> int {
      if (ch >= '0' && ch <= '9') return ch - '0';
      if (ch >= 'a' && ch <= 'f') return ch - 'a' + 10;
      if (ch >= 'A' && ch <= 'F') return ch - 'A' + 10;
      return -1;
    };
    int high = hex(value[index + 1]);
    int low = hex(value[index + 2]);
    if (high < 0 || low < 0) {
      return std::nullopt;
    }
    output.push_back(static_cast<char>((high << 4) | low));
    index += 2;
  }
  return output;
}

std::optional<std::string> resolveStaticPath(const std::string& target) {
  auto decoded = percentDecodePath(pathOnly(target));
  if (!decoded) {
    return std::nullopt;
  }
  std::string relative = *decoded == "/" ? "index.html" : decoded->substr(1);
  std::replace(relative.begin(), relative.end(), '\\', '/');
  if (relative.find("..") != std::string::npos) {
    return std::nullopt;
  }

  bool publicFile =
      relative == "index.html" ||
      relative == "src/app.js" ||
      relative == "src/providers.js" ||
      relative == "src/ranking.js" ||
      relative == "src/styles.css";
  bool flag = relative.rfind("src/flags/", 0) == 0 && relative.size() > 4 && relative.substr(relative.size() - 4) == ".svg";
  bool icon = relative.rfind("icon/", 0) == 0 && relative.size() > 4 && relative.substr(relative.size() - 4) == ".svg";
  if (!publicFile && !flag && !icon) {
    return std::nullopt;
  }
  return relative;
}

std::string contentTypeFor(const std::string& path) {
  if (path.size() >= 5 && path.substr(path.size() - 5) == ".html") return "text/html; charset=utf-8";
  if (path.size() >= 3 && path.substr(path.size() - 3) == ".js") return "text/javascript; charset=utf-8";
  if (path.size() >= 4 && path.substr(path.size() - 4) == ".css") return "text/css; charset=utf-8";
  if (path.size() >= 5 && path.substr(path.size() - 5) == ".json") return "application/json; charset=utf-8";
  if (path.size() >= 4 && path.substr(path.size() - 4) == ".svg") return "image/svg+xml";
  return "application/octet-stream";
}

HttpResponse textResponse(int status, const std::string& body) {
  return {status, statusReason(status), {{"Content-Type", "text/plain; charset=utf-8"}}, body};
}

HttpResponse jsonResponse(int status, const std::string& body) {
  return {status, statusReason(status), {{"Content-Type", "application/json; charset=utf-8"}}, body};
}

void addStaticHeaders(HttpResponse& response) {
  response.headers["Content-Security-Policy"] =
      "default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'none'; script-src 'self'; style-src 'self'; connect-src 'self' http://127.0.0.1:* http://localhost:*";
  response.headers["Cross-Origin-Opener-Policy"] = "same-origin";
  response.headers["Referrer-Policy"] = "no-referrer";
  response.headers["X-Content-Type-Options"] = "nosniff";
  response.headers["X-Frame-Options"] = "DENY";
}

HttpResponse staticResponse(const HttpRequest& request) {
  if (request.method != "GET" && request.method != "HEAD") {
    auto response = textResponse(405, "Method not allowed.");
    addStaticHeaders(response);
    return response;
  }
  auto relative = resolveStaticPath(request.target);
  if (!relative) {
    auto response = textResponse(403, "Forbidden.");
    addStaticHeaders(response);
    return response;
  }
  const auto* asset = embedded_assets::find_asset(*relative);
  if (!asset) {
    auto response = textResponse(404, "Not found.");
    addStaticHeaders(response);
    return response;
  }
  HttpResponse response;
  response.status = 200;
  response.reason = "OK";
  response.headers["Content-Type"] = contentTypeFor(*relative);
  if (request.method != "HEAD") {
    response.body.assign(reinterpret_cast<const char*>(asset->data), asset->size);
  }
  addStaticHeaders(response);
  return response;
}

class HelperHandler {
 public:
  HelperHandler(std::string token, std::vector<std::string> allowedOrigins)
      : token_(std::move(token)), allowedOrigins_(std::move(allowedOrigins)) {}

  HttpResponse operator()(const HttpRequest& request) const {
    if (!originAllowed(request)) {
      return withCors(request, textResponse(403, "Forbidden origin."));
    }
    if (request.method == "OPTIONS") {
      return withCors(request, textResponse(204, ""));
    }
    if (!tokenValid(request)) {
      return withCors(request, textResponse(401, "Unauthorized."));
    }

    std::string path = pathOnly(request.target);
    if (request.method == "GET" && path == "/health") {
      return withCors(request, jsonResponse(200, R"({"ok":true})"));
    }
    if (request.method == "POST" && path == "/api/check") {
      return withCors(request, handleCheck(request));
    }
    if (request.method == "POST" && path == "/api/save") {
      return withCors(request, handleSave(request));
    }
    if (request.method == "POST" && path == "/api/open-terminal") {
      ShellExecuteW(nullptr, L"open", L"powershell.exe", L"-NoExit", nullptr, SW_SHOWNORMAL);
      return withCors(request, jsonResponse(200, R"({"ok":true,"terminal":"PowerShell"})"));
    }
    return withCors(request, textResponse(404, "Not found."));
  }

 private:
  bool originAllowed(const HttpRequest& request) const {
    std::string origin = getHeader(request, "origin");
    if (origin.empty()) {
      return true;
    }
    return std::find(allowedOrigins_.begin(), allowedOrigins_.end(), origin) != allowedOrigins_.end();
  }

  bool tokenValid(const HttpRequest& request) const {
    return timingSafeEqual(getHeader(request, "x-api-key-checker-token"), token_);
  }

  HttpResponse withCors(const HttpRequest& request, HttpResponse response) const {
    std::string origin = getHeader(request, "origin");
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, X-API-Key-Checker-Token";
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS";
    response.headers["Access-Control-Allow-Private-Network"] = "true";
    response.headers["Vary"] = "Origin";
    if (origin.empty() || std::find(allowedOrigins_.begin(), allowedOrigins_.end(), origin) != allowedOrigins_.end()) {
      response.headers["Access-Control-Allow-Origin"] = origin.empty() ? "null" : origin;
    }
    return response;
  }

  HttpResponse handleCheck(const HttpRequest& request) const {
    if (request.body.size() > kMaxRequestBodyBytes) {
      return textResponse(400, "Request body is too large.");
    }
    std::vector<std::string> envVars = jsonStringArrayField(request.body, "envVars");
    std::ostringstream body;
    body << "{";
    bool first = true;
    for (const auto& envVar : envVars) {
      if (!validateEnvVar(envVar)) {
        continue;
      }
      std::string value = readEnvValue(envVar);
      if (!first) {
        body << ",";
      }
      first = false;
      body << "\"" << jsonEscape(envVar) << "\":{"
           << "\"status\":\"" << (value.empty() ? "missing" : "found") << "\","
           << "\"maskedValue\":\"" << jsonEscape(maskKey(value)) << "\"}";
    }
    body << "}";
    return jsonResponse(200, body.str());
  }

  HttpResponse handleSave(const HttpRequest& request) const {
    if (request.body.size() > kMaxRequestBodyBytes) {
      return textResponse(400, "Request body is too large.");
    }
    auto envVar = jsonStringField(request.body, "envVar").value_or("");
    auto value = jsonStringField(request.body, "value").value_or("");
    if (!validateEnvVar(envVar)) {
      return textResponse(400, "Invalid environment variable name.");
    }
    if (trim(value).empty() || value.find('\0') != std::string::npos || value.size() > kMaxEnvValueBytes) {
      return textResponse(400, "Invalid environment variable value.");
    }
    if (!saveWindowsUserEnv(envVar, value)) {
      return textResponse(500, "Unable to save Windows user environment variable.");
    }
    std::ostringstream body;
    body << "{\"ok\":true,"
         << "\"envVar\":\"" << jsonEscape(envVar) << "\","
         << "\"maskedValue\":\"" << jsonEscape(maskKey(value)) << "\","
         << "\"target\":\"windows-user\"}";
    return jsonResponse(200, body.str());
  }

  std::string token_;
  std::vector<std::string> allowedOrigins_;
};

std::optional<HttpRequest> readHttpRequest(SOCKET client) {
  std::string data;
  char buffer[4096];
  std::size_t headerEnd = std::string::npos;
  while (headerEnd == std::string::npos) {
    int received = recv(client, buffer, sizeof(buffer), 0);
    if (received <= 0) {
      return std::nullopt;
    }
    data.append(buffer, received);
    if (data.size() > kMaxRequestBodyBytes + 8192) {
      return std::nullopt;
    }
    headerEnd = data.find("\r\n\r\n");
  }

  std::string headerText = data.substr(0, headerEnd);
  std::istringstream stream(headerText);
  std::string requestLine;
  std::getline(stream, requestLine);
  if (!requestLine.empty() && requestLine.back() == '\r') {
    requestLine.pop_back();
  }
  std::istringstream requestLineStream(requestLine);
  HttpRequest request;
  requestLineStream >> request.method >> request.target;
  if (request.method.empty() || request.target.empty()) {
    return std::nullopt;
  }

  std::string line;
  while (std::getline(stream, line)) {
    if (!line.empty() && line.back() == '\r') {
      line.pop_back();
    }
    std::size_t colon = line.find(':');
    if (colon == std::string::npos) {
      continue;
    }
    request.headers[toLower(trim(line.substr(0, colon)))] = trim(line.substr(colon + 1));
  }

  std::size_t bodyStart = headerEnd + 4;
  std::size_t contentLength = 0;
  auto lengthText = getHeader(request, "content-length");
  if (!lengthText.empty()) {
    contentLength = static_cast<std::size_t>(std::strtoull(lengthText.c_str(), nullptr, 10));
  }
  request.body = data.substr(bodyStart);
  while (request.body.size() < contentLength) {
    int received = recv(client, buffer, sizeof(buffer), 0);
    if (received <= 0) {
      return std::nullopt;
    }
    request.body.append(buffer, received);
    if (request.body.size() > kMaxRequestBodyBytes) {
      break;
    }
  }
  if (request.body.size() > contentLength) {
    request.body.resize(contentLength);
  }
  return request;
}

void sendAll(SOCKET client, const std::string& data) {
  const char* cursor = data.data();
  int remaining = static_cast<int>(data.size());
  while (remaining > 0) {
    int sent = send(client, cursor, remaining, 0);
    if (sent <= 0) {
      return;
    }
    cursor += sent;
    remaining -= sent;
  }
}

void sendHttpResponse(SOCKET client, const HttpResponse& response) {
  std::ostringstream output;
  output << "HTTP/1.1 " << response.status << " " << response.reason << "\r\n";
  for (const auto& [name, value] : response.headers) {
    output << name << ": " << value << "\r\n";
  }
  output << "Content-Length: " << response.body.size() << "\r\n";
  output << "Connection: close\r\n\r\n";
  std::string head = output.str();
  sendAll(client, head);
  sendAll(client, response.body);
}

class TcpServer {
 public:
  using Handler = std::function<HttpResponse(const HttpRequest&)>;

  explicit TcpServer(Handler handler) : handler_(std::move(handler)) {}

  ~TcpServer() {
    stop();
  }

  void start() {
    socket_ = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (socket_ == INVALID_SOCKET) {
      throw std::runtime_error("Unable to create socket.");
    }
    sockaddr_in address{};
    address.sin_family = AF_INET;
    address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
    address.sin_port = 0;
    if (bind(socket_, reinterpret_cast<sockaddr*>(&address), sizeof(address)) == SOCKET_ERROR) {
      throw std::runtime_error("Unable to bind socket.");
    }
    if (listen(socket_, SOMAXCONN) == SOCKET_ERROR) {
      throw std::runtime_error("Unable to listen on socket.");
    }
    sockaddr_in bound{};
    int length = sizeof(bound);
    getsockname(socket_, reinterpret_cast<sockaddr*>(&bound), &length);
    port_ = ntohs(bound.sin_port);
    running_ = true;
    thread_ = std::thread([this]() { acceptLoop(); });
  }

  void stop() {
    running_ = false;
    if (socket_ != INVALID_SOCKET) {
      closesocket(socket_);
      socket_ = INVALID_SOCKET;
    }
    if (thread_.joinable()) {
      thread_.join();
    }
  }

  unsigned short port() const {
    return port_;
  }

 private:
  void acceptLoop() {
    while (running_) {
      SOCKET client = accept(socket_, nullptr, nullptr);
      if (client == INVALID_SOCKET) {
        continue;
      }
      std::thread([this, client]() {
        auto request = readHttpRequest(client);
        if (request) {
          sendHttpResponse(client, handler_(*request));
        }
        shutdown(client, SD_BOTH);
        closesocket(client);
      }).detach();
    }
  }

  SOCKET socket_ = INVALID_SOCKET;
  unsigned short port_ = 0;
  std::atomic<bool> running_{false};
  std::thread thread_;
  Handler handler_;
};

std::string buildUrl(unsigned short webPort, unsigned short helperPort, const std::string& token) {
  std::ostringstream url;
  url << "http://127.0.0.1:" << webPort << "/?helperPort=" << helperPort << "#helperToken=" << token;
  return url.str();
}

BOOL WINAPI consoleHandler(DWORD controlType) {
  switch (controlType) {
    case CTRL_C_EVENT:
    case CTRL_CLOSE_EVENT:
    case CTRL_BREAK_EVENT:
    case CTRL_SHUTDOWN_EVENT:
      if (gStopEvent) {
        SetEvent(gStopEvent);
      }
      return TRUE;
    default:
      return FALSE;
  }
}

}  // namespace

int main() {
  WSADATA wsa{};
  if (WSAStartup(MAKEWORD(2, 2), &wsa) != 0) {
    std::cerr << "Unable to initialize Winsock.\n";
    return 1;
  }

  try {
    gStopEvent = CreateEventW(nullptr, TRUE, FALSE, nullptr);
    SetConsoleCtrlHandler(consoleHandler, TRUE);

    std::string token = randomToken();
    TcpServer staticServer(staticResponse);
    staticServer.start();

    std::vector<std::string> allowedOrigins = {
        "http://127.0.0.1:" + std::to_string(staticServer.port()),
        "http://localhost:" + std::to_string(staticServer.port()),
    };
    HelperHandler helperHandler(token, allowedOrigins);
    TcpServer helperServer(helperHandler);
    helperServer.start();

    std::string url = buildUrl(staticServer.port(), helperServer.port(), token);
    std::cout << "API Key Checker cpp portable running at:\n" << url << "\n";
    std::cout << "Press Ctrl+C or close this window to stop.\n";
    std::cout << std::flush;
    char noOpen[8] = {};
    if (GetEnvironmentVariableA("API_KEY_CHECKER_NO_OPEN", noOpen, sizeof(noOpen)) == 0 || std::string(noOpen) != "1") {
      ShellExecuteA(nullptr, "open", url.c_str(), nullptr, nullptr, SW_SHOWNORMAL);
    }

    WaitForSingleObject(gStopEvent, INFINITE);
  } catch (const std::exception& error) {
    std::cerr << error.what() << "\n";
    WSACleanup();
    return 1;
  }

  WSACleanup();
  return 0;
}
