#include <WiFi.h>
#include <ESPAsyncWebServer.h>
#include <ESPmDNS.h>
#include <LittleFS.h>
#include <FastLED.h>
#include <fauxmoESP.h>

// LED setup
#define LED_PIN 4
#define NUM_LEDS 88
#define BRIGHTNESS 255
#define LED_TYPE WS2813
#define COLOR_ORDER GRB

// Keep Alexa callback fast: store command, handle in loop
volatile bool alexaPending = false;
String alexaDeviceName;
volatile bool alexaState = false;
volatile uint8_t alexaValue = 0;

// Wifi
const char* ssid = "Noite Diurna 2G";
const char* password = "vaynevayne";

fauxmoESP fauxmo;

CRGB leds[NUM_LEDS];
static AsyncWebServer server(81);

// Global state variables
bool isOn = false;
String currentMode = "solid";

// Special mode variables
bool specialMode = false;
String specialCategory = "";
int specialSubmodes[5] = {0, 0, 0, 0, 0};
int specialSubmodeCount = 0;
int currentSpecialSubmode = 0;
unsigned long specialSubmodeStartTime = 0;
const unsigned long SPECIAL_SUBMODE_DURATION = 600000; // 10 minutes

// Standard mode variables
String solidColor = "#ff6b6b";
int solidBrightness = 100;

String waveColor1 = "#667eea";
String waveColor2 = "#764ba2";
int waveSpeed = 50;
int waveLength = 20;
int wavePosition = 0;
unsigned long waveLastUpdate = 0;

int rainbowSpeed = 30;
int rainbowBrightness = 100;
int rainbowSaturation = 100;
uint8_t rainbowHue = 0;
unsigned long rainbowLastUpdate = 0;

String fadeColor1 = "#f093fb";
String fadeColor2 = "#f5576c";
int fadeSpeed = 40;
int fadeSmoothness = 5;
int fadePosition = 0;
bool fadeDirection = true;
unsigned long fadeLastUpdate = 0;

String strobeColor = "#ffffff";
int strobeSpeed = 15;
int strobeIntensity = 100;
bool strobeState = false;
unsigned long strobeLastUpdate = 0;

String chaseColor = "#feca57";
int chaseSpeed = 40;
int chaseSpacing = 3;
bool chaseReverse = false;
int chasePosition = 0;
unsigned long chaseLastUpdate = 0;

// Christmas mode variables - ALL PATTERNS KEEP ALL LEDS ON OR OFF
CRGB red = CRGB(255, 0, 0);
CRGB orange = CRGB(255, 140, 0);
CRGB blue = CRGB(0, 0, 255);
CRGB green = CRGB(0, 255, 0);

// Christmas 1: R|O|R|O blink -> OFF -> B|G|B|G blink
int christmas1State = 0; // 0=R/O on, 1=off, 2=B/G on, 3=off
unsigned long christmas1LastUpdate = 0;

// Christmas 2: R|O|R|O fade to B|G|B|G
int christmas2FadeValue = 0;
bool christmas2FadeDirection = true;
unsigned long christmas2LastUpdate = 0;

// Christmas 3: R|B|O|G all 4 colors together
// No state needed, static pattern

// Christmas 4: R|O ON + B|G OFF, then swap
bool christmas4ShowRedOrange = true;
unsigned long christmas4LastUpdate = 0;

// Christmas 5: All 4 colors blink together, then alternate R|O vs B|G
int christmas5Phase = 0; // 0=all blink on, 1=all blink off, 2=R/O on B/G off, 3=R/O off B/G on
unsigned long christmas5LastUpdate = 0;
int christmas5BlinkCount = 0;

// Sex Trip mode variables
int purpleBreathPosition = 0;
bool purpleBreathDirection = true;
unsigned long purpleBreathLastUpdate = 0;

int pinkFadePosition = 0;
bool pinkFadeDirection = true;
unsigned long pinkFadeLastUpdate = 0;

int crimsonWavePosition = 0;
unsigned long crimsonWaveLastUpdate = 0;

// Fire Place mode variables
int emberStates[NUM_LEDS];
unsigned long emberLastUpdate = 0;

int gentleFlamePosition = 0;
unsigned long gentleFlameLastUpdate = 0;

int hearthGlowBase = 0;
bool hearthGlowDirection = true;
unsigned long hearthGlowLastUpdate = 0;
int hearthSparkles[NUM_LEDS];

// Helper function to parse hex color
CRGB hexToRGB(String hexColor) {
  long hexValue = strtol(hexColor.substring(1).c_str(), NULL, 16);
  uint8_t r = (hexValue >> 16) & 0xFF;
  uint8_t g = (hexValue >> 8) & 0xFF;
  uint8_t b = hexValue & 0xFF;
  return CRGB(r, g, b);
}

// Helper function to blend two colors
CRGB blendColors(CRGB color1, CRGB color2, uint8_t amount) {
  return CRGB(
    ((uint16_t)color1.r * (255 - amount) + (uint16_t)color2.r * amount) / 255,
    ((uint16_t)color1.g * (255 - amount) + (uint16_t)color2.g * amount) / 255,
    ((uint16_t)color1.b * (255 - amount) + (uint16_t)color2.b * amount) / 255
  );
}

void stopAll() {
  isOn = false;
  specialMode = false;
  fill_solid(leds, NUM_LEDS, CRGB::Black);
  FastLED.show();
}

void startCategory(const String& cat) {
  // cat must be "fireplace" or "sextrip"
  currentMode = cat;
  specialMode = true;
  specialCategory = cat;

  // Default: cycle 1,2,3 forever (like your UI commonly does)
  specialSubmodeCount = 3;
  specialSubmodes[0] = 1;
  specialSubmodes[1] = 2;
  specialSubmodes[2] = 3;

  currentSpecialSubmode = 0;
  specialSubmodeStartTime = millis();

  isOn = true;
}

// Standard mode update functions (unchanged)
void updateSolid() {
  CRGB color = hexToRGB(solidColor);
  color.nscale8(map(solidBrightness, 0, 100, 0, 255));
  fill_solid(leds, NUM_LEDS, color);
}

void updateWave() {
  unsigned long currentTime = millis();
  int updateDelay = map(waveSpeed, 1, 100, 100, 10);

  if (currentTime - waveLastUpdate >= updateDelay) {
    waveLastUpdate = currentTime;
    wavePosition = (wavePosition + 1) % (waveLength * 2);
  }

  CRGB color1 = hexToRGB(waveColor1);
  CRGB color2 = hexToRGB(waveColor2);

  for (int i = 0; i < NUM_LEDS; i++) {
    int position = (i + wavePosition) % (waveLength * 2);
    uint8_t blend = 0;

    if (position < waveLength) {
      blend = map(position, 0, waveLength - 1, 0, 255);
    } else {
      blend = map(position, waveLength, waveLength * 2 - 1, 255, 0);
    }

    leds[i] = blendColors(color1, color2, blend);
  }
}

void updateRainbow() {
  unsigned long currentTime = millis();
  int updateDelay = map(rainbowSpeed, 1, 100, 100, 10);

  if (currentTime - rainbowLastUpdate >= updateDelay) {
    rainbowLastUpdate = currentTime;
    rainbowHue++;
  }

  fill_rainbow(leds, NUM_LEDS, rainbowHue, 256 / NUM_LEDS);

  for (int i = 0; i < NUM_LEDS; i++) {
    leds[i].nscale8(map(rainbowBrightness, 0, 100, 0, 255));

    if (rainbowSaturation < 100) {
      CHSV hsv = rgb2hsv_approximate(leds[i]);
      hsv.s = map(rainbowSaturation, 0, 100, 0, 255);
      leds[i] = hsv;
    }
  }
}

void updateFade() {
  unsigned long currentTime = millis();
  int updateDelay = map(fadeSpeed, 1, 100, 100, 10);

  if (currentTime - fadeLastUpdate >= updateDelay) {
    fadeLastUpdate = currentTime;

    int step = map(fadeSmoothness, 1, 10, 10, 1);

    if (fadeDirection) {
      fadePosition += step;
      if (fadePosition >= 255) {
        fadePosition = 255;
        fadeDirection = false;
      }
    } else {
      fadePosition -= step;
      if (fadePosition <= 0) {
        fadePosition = 0;
        fadeDirection = true;
      }
    }
  }

  CRGB color1 = hexToRGB(fadeColor1);
  CRGB color2 = hexToRGB(fadeColor2);
  CRGB blended = blendColors(color1, color2, fadePosition);

  fill_solid(leds, NUM_LEDS, blended);
}

void updateStrobe() {
  unsigned long currentTime = millis();
  int period = 1000 / strobeSpeed;

  if (currentTime - strobeLastUpdate >= period) {
    strobeLastUpdate = currentTime;
    strobeState = !strobeState;
  }

  if (strobeState) {
    CRGB color = hexToRGB(strobeColor);
    color.nscale8(map(strobeIntensity, 0, 100, 0, 255));
    fill_solid(leds, NUM_LEDS, color);
  } else {
    fill_solid(leds, NUM_LEDS, CRGB::Black);
  }
}

void updateChase() {
  unsigned long currentTime = millis();
  int updateDelay = map(chaseSpeed, 1, 100, 100, 10);

  if (currentTime - chaseLastUpdate >= updateDelay) {
    chaseLastUpdate = currentTime;

    if (chaseReverse) {
      chasePosition--;
      if (chasePosition < 0) chasePosition = chaseSpacing - 1;
    } else {
      chasePosition = (chasePosition + 1) % chaseSpacing;
    }
  }

  fill_solid(leds, NUM_LEDS, CRGB::Black);
  CRGB color = hexToRGB(chaseColor);

  for (int i = 0; i < NUM_LEDS; i++) {
    if (i % chaseSpacing == chasePosition) {
      leds[i] = color;
    }
  }
}

// ========== CHRISTMAS SUB-MODES - ALL LEDS ALWAYS ON OR ALL OFF ==========

// Christmas 1: Tradição Portuguesa
// R|O|R|O blink -> OFF -> B|G|B|G blink -> OFF -> repeat
void updateChristmas1() {
  unsigned long currentTime = millis();

  // State machine: 500ms per state
  if (currentTime - christmas1LastUpdate >= 500) {
    christmas1LastUpdate = currentTime;
    christmas1State = (christmas1State + 1) % 4;
  }

  if (christmas1State == 0) {
    // Red/Orange pattern: R|O|R|O
    for (int i = 0; i < NUM_LEDS; i++) {
      leds[i] = (i % 2 == 0) ? red : orange;
    }
  } else if (christmas1State == 1) {
    // All OFF
    fill_solid(leds, NUM_LEDS, CRGB::Black);
  } else if (christmas1State == 2) {
    // Blue/Green pattern: B|G|B|G
    for (int i = 0; i < NUM_LEDS; i++) {
      leds[i] = (i % 2 == 0) ? blue : green;
    }
  } else {
    // All OFF
    fill_solid(leds, NUM_LEDS, CRGB::Black);
  }
}

// Christmas 2: Cores Alternadas
// R|O|R|O smoothly fades to B|G|B|G
void updateChristmas2() {
  unsigned long currentTime = millis();

  if (currentTime - christmas2LastUpdate >= 20) {
    christmas2LastUpdate = currentTime;

    if (christmas2FadeDirection) {
      christmas2FadeValue += 3;
      if (christmas2FadeValue >= 255) {
        christmas2FadeValue = 255;
        christmas2FadeDirection = false;
      }
    } else {
      christmas2FadeValue -= 3;
      if (christmas2FadeValue <= 0) {
        christmas2FadeValue = 0;
        christmas2FadeDirection = true;
      }
    }
  }

  // Blend between R/O pattern and B/G pattern
  for (int i = 0; i < NUM_LEDS; i++) {
    CRGB colorRO = (i % 2 == 0) ? red : orange;
    CRGB colorBG = (i % 2 == 0) ? blue : green;
    leds[i] = blendColors(colorRO, colorBG, christmas2FadeValue);
  }
}

// Christmas 3: Quatro Cores
// R|B|O|G all 4 colors together, static
void updateChristmas3() {
  // Static pattern: Red, Blue, Orange, Green repeating
  for (int i = 0; i < NUM_LEDS; i++) {
    int colorIndex = i % 4;
    if (colorIndex == 0) leds[i] = red;
    else if (colorIndex == 1) leds[i] = blue;
    else if (colorIndex == 2) leds[i] = orange;
    else leds[i] = green;
  }
}

// Christmas 4: Dança de Pares
// R|O ON with B|G OFF, then swap
void updateChristmas4() {
  unsigned long currentTime = millis();

  if (currentTime - christmas4LastUpdate >= 600) {
    christmas4LastUpdate = currentTime;
    christmas4ShowRedOrange = !christmas4ShowRedOrange;
  }

  if (christmas4ShowRedOrange) {
    // Red/Orange ON, Blue/Green OFF
    for (int i = 0; i < NUM_LEDS; i++) {
      leds[i] = (i % 2 == 0) ? red : orange;
    }
  } else {
    // Blue/Green ON, Red/Orange OFF
    for (int i = 0; i < NUM_LEDS; i++) {
      leds[i] = (i % 2 == 0) ? blue : green;
    }
  }
}

// Christmas 5: Luzes Completas
// All 4 colors blink together (3 times), then alternate R/O vs B/G
void updateChristmas5() {
  unsigned long currentTime = millis();

  if (currentTime - christmas5LastUpdate >= 300) {
    christmas5LastUpdate = currentTime;

    if (christmas5Phase <= 1) {
      // Blink phase
      christmas5Phase = (christmas5Phase + 1) % 2;
      christmas5BlinkCount++;

      if (christmas5BlinkCount >= 6) { // 3 full blinks (on+off = 2 states per blink)
        christmas5Phase = 2;
        christmas5BlinkCount = 0;
      }
    } else {
      // Alternating phase
      christmas5Phase++;
      if (christmas5Phase >= 4) christmas5Phase = 0;
    }
  }

  if (christmas5Phase == 0) {
    // All 4 colors ON: R|B|O|G
    for (int i = 0; i < NUM_LEDS; i++) {
      int colorIndex = i % 4;
      if (colorIndex == 0) leds[i] = red;
      else if (colorIndex == 1) leds[i] = blue;
      else if (colorIndex == 2) leds[i] = orange;
      else leds[i] = green;
    }
  } else if (christmas5Phase == 1) {
    // All OFF
    fill_solid(leds, NUM_LEDS, CRGB::Black);
  } else if (christmas5Phase == 2) {
    // R/O ON, B/G positions OFF
    for (int i = 0; i < NUM_LEDS; i++) {
      int colorIndex = i % 4;
      if (colorIndex == 0) leds[i] = red;
      else if (colorIndex == 1) leds[i] = CRGB::Black;
      else if (colorIndex == 2) leds[i] = orange;
      else leds[i] = CRGB::Black;
    }
  } else {
    // B/G ON, R/O positions OFF
    for (int i = 0; i < NUM_LEDS; i++) {
      int colorIndex = i % 4;
      if (colorIndex == 0) leds[i] = CRGB::Black;
      else if (colorIndex == 1) leds[i] = blue;
      else if (colorIndex == 2) leds[i] = CRGB::Black;
      else leds[i] = green;
    }
  }
}

// ========== SEX TRIP SUB-MODES ==========

void updateSexTrip1() {
  unsigned long currentTime = millis();

  if (currentTime - purpleBreathLastUpdate >= 30) {
    purpleBreathLastUpdate = currentTime;

    if (purpleBreathDirection) {
      purpleBreathPosition += 2;
      if (purpleBreathPosition >= 255) {
        purpleBreathPosition = 255;
        purpleBreathDirection = false;
      }
    } else {
      purpleBreathPosition -= 2;
      if (purpleBreathPosition <= 50) {
        purpleBreathPosition = 50;
        purpleBreathDirection = true;
      }
    }
  }

  CRGB purple = CRGB(128, 0, 128);
  purple.nscale8(purpleBreathPosition);
  fill_solid(leds, NUM_LEDS, purple);
}

void updateSexTrip2() {
  unsigned long currentTime = millis();

  if (currentTime - pinkFadeLastUpdate >= 25) {
    pinkFadeLastUpdate = currentTime;

    if (pinkFadeDirection) {
      pinkFadePosition += 3;
      if (pinkFadePosition >= 255) {
        pinkFadePosition = 255;
        pinkFadeDirection = false;
      }
    } else {
      pinkFadePosition -= 3;
      if (pinkFadePosition <= 0) {
        pinkFadePosition = 0;
        pinkFadeDirection = true;
      }
    }
  }

  CRGB hotPink = CRGB(255, 105, 180);
  CRGB magenta = CRGB(255, 0, 255);
  CRGB blended = blendColors(hotPink, magenta, pinkFadePosition);
  fill_solid(leds, NUM_LEDS, blended);
}

void updateSexTrip3() {
  unsigned long currentTime = millis();

  if (currentTime - crimsonWaveLastUpdate >= 40) {
    crimsonWaveLastUpdate = currentTime;
    crimsonWavePosition = (crimsonWavePosition + 1) % (NUM_LEDS * 2);
  }

  CRGB red = CRGB(220, 20, 60);
  CRGB deepPink = CRGB(255, 20, 147);

  for (int i = 0; i < NUM_LEDS; i++) {
    int position = (i + crimsonWavePosition) % (NUM_LEDS * 2);
    uint8_t blend = 0;

    if (position < NUM_LEDS) {
      blend = map(position, 0, NUM_LEDS - 1, 0, 255);
    } else {
      blend = map(position, NUM_LEDS, NUM_LEDS * 2 - 1, 255, 0);
    }

    leds[i] = blendColors(red, deepPink, blend);
  }
}

// ========== FIRE PLACE SUB-MODES ==========

void updateFirePlace1() {
  unsigned long currentTime = millis();

  if (currentTime - emberLastUpdate >= 50) {
    emberLastUpdate = currentTime;

    for (int i = 0; i < NUM_LEDS; i++) {
      if (random(100) < 30) {
        emberStates[i] = random(150, 255);
      } else {
        if (emberStates[i] > 100) {
          emberStates[i] -= random(5, 15);
        }
      }

      if (emberStates[i] > 200) {
        leds[i] = CRGB(255, 100, 0);
      } else if (emberStates[i] > 150) {
        leds[i] = CRGB(255, 50, 0);
      } else {
        leds[i] = CRGB(200, 0, 0);
      }
      leds[i].nscale8(emberStates[i]);
    }
  }
}

void updateFirePlace2() {
  unsigned long currentTime = millis();

  if (currentTime - gentleFlameLastUpdate >= 60) {
    gentleFlameLastUpdate = currentTime;
    gentleFlamePosition = (gentleFlamePosition + 1) % (NUM_LEDS / 2);
  }

  CRGB yellow = CRGB(255, 200, 0);
  CRGB orange = CRGB(255, 100, 0);

  for (int i = 0; i < NUM_LEDS; i++) {
    int position = (i + gentleFlamePosition) % (NUM_LEDS / 2);
    uint8_t blend = map(position, 0, NUM_LEDS / 2 - 1, 0, 255);
    leds[i] = blendColors(yellow, orange, blend);
  }
}

void updateFirePlace3() {
  unsigned long currentTime = millis();

  if (currentTime - hearthGlowLastUpdate >= 40) {
    hearthGlowLastUpdate = currentTime;

    if (hearthGlowDirection) {
      hearthGlowBase += 3;
      if (hearthGlowBase >= 180) {
        hearthGlowBase = 180;
        hearthGlowDirection = false;
      }
    } else {
      hearthGlowBase -= 3;
      if (hearthGlowBase <= 100) {
        hearthGlowBase = 100;
        hearthGlowDirection = true;
      }
    }

    CRGB deepRed = CRGB(139, 0, 0);
    deepRed.nscale8(hearthGlowBase);
    fill_solid(leds, NUM_LEDS, deepRed);

    for (int i = 0; i < NUM_LEDS; i++) {
      if (random(100) < 5) {
        hearthSparkles[i] = 255;
      } else if (hearthSparkles[i] > 0) {
        hearthSparkles[i] -= 10;
      }

      if (hearthSparkles[i] > 0) {
        CRGB amber = CRGB(255, 191, 0);
        amber.nscale8(hearthSparkles[i]);
        leds[i] = blendColors(leds[i], amber, hearthSparkles[i]);
      }
    }
  }
}

// ========== SPECIAL MODE CONTROLLER ==========

void updateSpecialMode() {
  unsigned long currentTime = millis();

  // Check if we need to switch sub-modes (every 10 minutes)
  if (currentTime - specialSubmodeStartTime >= SPECIAL_SUBMODE_DURATION) {
    currentSpecialSubmode = (currentSpecialSubmode + 1) % specialSubmodeCount;
    specialSubmodeStartTime = currentTime;
    Serial.print("Switching to ");
    Serial.print(specialCategory);
    Serial.print(" sub-mode: ");
    Serial.println(specialSubmodes[currentSpecialSubmode]);
  }

  int submodeId = specialSubmodes[currentSpecialSubmode];

  if (specialCategory == "christmas") {
    switch (submodeId) {
      case 1: updateChristmas1(); break;
      case 2: updateChristmas2(); break;
      case 3: updateChristmas3(); break;
      case 4: updateChristmas4(); break;
      case 5: updateChristmas5(); break;
    }
  } else if (specialCategory == "sextrip") {
    switch (submodeId) {
      case 1: updateSexTrip1(); break;
      case 2: updateSexTrip2(); break;
      case 3: updateSexTrip3(); break;
    }
  } else if (specialCategory == "fireplace") {
    switch (submodeId) {
      case 1: updateFirePlace1(); break;
      case 2: updateFirePlace2(); break;
      case 3: updateFirePlace3(); break;
    }
  }
}

void setup() {
  Serial.begin(115200);

  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nConnected!");
  Serial.println(WiFi.localIP());

  if (!MDNS.begin("led")) {
    Serial.println("mDNS FAILED!");
  }


  if (!LittleFS.begin(true)) {
    Serial.println("LittleFS mount FAILED");
    return;
  }

  Serial.println("LittleFS mounted");

  server.serveStatic("/", LittleFS, "/").setDefaultFile("index.html");
  server.serveStatic("/script.js", LittleFS, "/script.js");
  server.serveStatic("/style.css", LittleFS, "/style.css");
  server.serveStatic("/special.html", LittleFS, "/special.html");
  server.serveStatic("/special.js", LittleFS, "/special.js");

  FastLED.addLeds<LED_TYPE, LED_PIN, COLOR_ORDER>(leds, NUM_LEDS);
  FastLED.setBrightness(BRIGHTNESS);
  FastLED.clear();
  FastLED.show();

  // Alexa (fauxmoESP)
  fauxmo.setPort(80);        // required for gen3 devices [page:1]
  fauxmo.enable(true);

  fauxmo.addDevice("LED Strip");
  fauxmo.addDevice("Fireplace");
  fauxmo.addDevice("Night Lights");

  fauxmo.onSetState([](unsigned char device_id, const char * device_name, bool state, unsigned char value) {
    // Keep it fast: just store and exit [page:1]
    alexaDeviceName = device_name;
    alexaState = state;
    alexaValue = value; // 0..255 brightness [page:0]
    alexaPending = true;
  });


  server.on("/state", HTTP_GET, [](AsyncWebServerRequest *request) {
    String json = "{";
    json += "\"mode\":\"" + currentMode + "\",";
    json += "\"isOn\":" + String(isOn ? "true" : "false");
    json += "}";
    request->send(200, "application/json", json);
  });

  server.on("/status", HTTP_GET, [](AsyncWebServerRequest *request) {
    String json = "{";
    json += "\"isOn\":" + String(isOn ? "true" : "false") + ",";
    json += "\"mode\":\"" + currentMode + "\"";
    json += "}";
    request->send(200, "application/json", json);
  });

  server.on("/apply", HTTP_GET, [](AsyncWebServerRequest *request) {
    if (request->hasParam("mode")) {
      currentMode = request->getParam("mode")->value();

      if (currentMode == "christmas" || currentMode == "sextrip" || currentMode == "fireplace") {
        specialMode = true;
        specialCategory = currentMode;

        if (request->hasParam("submodes")) {
          String submodesStr = request->getParam("submodes")->value();
          specialSubmodeCount = 0;

          int startIdx = 0;
          int commaIdx = submodesStr.indexOf(',');

          while (commaIdx != -1 && specialSubmodeCount < 5) {
            specialSubmodes[specialSubmodeCount++] = submodesStr.substring(startIdx, commaIdx).toInt();
            startIdx = commaIdx + 1;
            commaIdx = submodesStr.indexOf(',', startIdx);
          }

          if (startIdx < submodesStr.length() && specialSubmodeCount < 5) {
            specialSubmodes[specialSubmodeCount++] = submodesStr.substring(startIdx).toInt();
          }

          currentSpecialSubmode = 0;
          specialSubmodeStartTime = millis();

          Serial.print(specialCategory);
          Serial.print(" mode started with ");
          Serial.print(specialSubmodeCount);
          Serial.println(" submodes");
        }
      } else {
        specialMode = false;
      }
    }

    if (currentMode == "solid") {
      if (request->hasParam("color")) solidColor = request->getParam("color")->value();
      if (request->hasParam("brightness")) solidBrightness = request->getParam("brightness")->value().toInt();
    }
    else if (currentMode == "wave") {
      if (request->hasParam("color1")) waveColor1 = request->getParam("color1")->value();
      if (request->hasParam("color2")) waveColor2 = request->getParam("color2")->value();
      if (request->hasParam("speed")) waveSpeed = request->getParam("speed")->value().toInt();
      if (request->hasParam("length")) waveLength = request->getParam("length")->value().toInt();
      waveLastUpdate = millis();
    }
    else if (currentMode == "rainbow") {
      if (request->hasParam("speed")) rainbowSpeed = request->getParam("speed")->value().toInt();
      if (request->hasParam("brightness")) rainbowBrightness = request->getParam("brightness")->value().toInt();
      if (request->hasParam("saturation")) rainbowSaturation = request->getParam("saturation")->value().toInt();
      rainbowLastUpdate = millis();
    }
    else if (currentMode == "fade") {
      if (request->hasParam("color1")) fadeColor1 = request->getParam("color1")->value();
      if (request->hasParam("color2")) fadeColor2 = request->getParam("color2")->value();
      if (request->hasParam("speed")) fadeSpeed = request->getParam("speed")->value().toInt();
      if (request->hasParam("smoothness")) fadeSmoothness = request->getParam("smoothness")->value().toInt();
      fadeLastUpdate = millis();
    }
    else if (currentMode == "strobe") {
      if (request->hasParam("color")) strobeColor = request->getParam("color")->value();
      if (request->hasParam("speed")) strobeSpeed = request->getParam("speed")->value().toInt();
      if (request->hasParam("intensity")) strobeIntensity = request->getParam("intensity")->value().toInt();
      strobeLastUpdate = millis();
    }
    else if (currentMode == "chase") {
      if (request->hasParam("color")) chaseColor = request->getParam("color")->value();
      if (request->hasParam("speed")) chaseSpeed = request->getParam("speed")->value().toInt();
      if (request->hasParam("spacing")) chaseSpacing = request->getParam("spacing")->value().toInt();
      if (request->hasParam("reverse")) chaseReverse = request->getParam("reverse")->value() == "true";
      chaseLastUpdate = millis();
    }

    isOn = true;
    request->send(200, "application/json", "{\"status\":\"Settings applied\"}");
  });

  server.on("/off", HTTP_GET, [](AsyncWebServerRequest *request) {
    isOn = false;
    specialMode = false;
    fill_solid(leds, NUM_LEDS, CRGB::Black);
    FastLED.show();
    request->send(200, "application/json", "{\"status\":\"LED strip turned off\"}");
  });

  server.begin();
  Serial.println("Web server started");

  for (int i = 0; i < NUM_LEDS; i++) {
    emberStates[i] = 100;
    hearthSparkles[i] = 0;
  }


}

void loop() {
  fauxmo.handle();

  if (alexaPending) {
    alexaPending = false;

    if (alexaDeviceName == "LED Strip") {
      if (alexaState) {
        isOn = true;               // resumes last mode if you want
      } else {
        stopAll();
      }
    } else if (alexaDeviceName == "Fireplace") {
      if (alexaState) startCategory("fireplace");
      else stopAll();
    } else if (alexaDeviceName == "Night Lights") {
      if (alexaState) startCategory("sextrip");
      else stopAll();
    }
  }

  // Your existing rendering logic
  if (isOn) {
    if (specialMode) updateSpecialMode();
    else if (currentMode == "solid") updateSolid();
    else if (currentMode == "wave") updateWave();
    else if (currentMode == "rainbow") updateRainbow();
    else if (currentMode == "fade") updateFade();
    else if (currentMode == "strobe") updateStrobe();
    else if (currentMode == "chase") updateChase();
    FastLED.show();
  }

  delay(10);
}
