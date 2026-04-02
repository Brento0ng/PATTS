/*
 * ================================================================
 *  PATTS VIOLATION RECORDING SYSTEM
 *  WiFi + HTTP Edition — HuskyLens + Website Integration
 * ----------------------------------------------------------------
 *  Board   : ESP32-S3 XH-S3E
 *  IDE     : Arduino IDE 2.x
 *  Setting : "ESP32S3 Dev Module"
 *  USB CDC On Boot: Enabled
 *  Serial  : 115200 baud
 * ================================================================
 */

const char* WIFI_SSID     = "UwU muna bago connect";
const char* WIFI_PASSWORD = "Surinaman";
const char* SERVER_URL    = "https://patts.onrender.com";

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <HUSKYLENS.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <HardwareSerial.h>
#include <Preferences.h>

#define BARCODE_RX_PIN   14
#define BARCODE_TX_PIN   21
#define HL_RX_PIN        17
#define HL_TX_PIN        18
#define LCD_SDA_PIN       8
#define LCD_SCL_PIN       9
#define BTN_UNIFORM       4
#define BTN_IMPROPER_ID   5
#define BTN_PROHIBITED    6
#define BTN_REGISTER     13
#define BTN_CLEAR        10
#define BUZZER_PIN        7
#define LED_GREEN        15
#define LED_RED          16

void lcdPrint(String l1, String l2);
void showReadyScreen();
void successBeep();
void errorBeep();
void setLED(bool s);
void logInfo(String msg);
void logOK(String msg);
void logFail(String msg);
void logWait(String msg);
void logGate(String msg);
void logReg(String msg);
void logSep();
void logTitle(String msg);
void printGateState();
void handleBarcode();
void handleRegistration();
void checkViolationButtons();
void checkClearButton();
void clearAllStudents();
void recordViolation();
void resetState();
void enterRegistrationMode();
void exitRegistrationMode();
void learnFaceOnHuskyLens(int faceID);
void checkFaceLearned();
void saveNewStudent();
void saveStudentsToMemory();
void loadStudentsFromMemory();
bool findStudentByBarcode(String code);
int  getFaceID();
int  getNextFaceID();
void connectWiFi();
bool sendRegisterToServer(String studentNumber, String faceId);
bool sendViolationToServer(String studentNumber, String faceId, String violationType);

HardwareSerial    barcodeSerial(2);
HardwareSerial    huskySerial(1);
HUSKYLENS         huskylens;
LiquidCrystal_I2C lcd(0x27, 16, 2);
Preferences       prefs;

struct Student {
  String barcodeCode;
  String studentNumber;
  int    faceID;
};
#define MAX_STUDENTS 100
Student registeredStudents[MAX_STUDENTS];
int totalStudents = 0;

#define VIOLATION_UNIFORM     "Uniform Violation"
#define VIOLATION_IMPROPER_ID "Improper ID"
#define VIOLATION_PROHIBITED  "Prohibited Items"

bool   studentVerified   = false;
bool   faceMatch         = false;
String detectedViolation = "";
String currentBarcode    = "";
String currentStudNum    = "";
int    currentFaceID     = 0;
int    violationCount    = 0;

bool   registrationMode  = false;
int    regStep           = 0;
String regBarcode        = "";
String regStudNum        = "";
int    regFaceID         = 0;

bool lastStateUniform    = HIGH;
bool lastStateImproper   = HIGH;
bool lastStateProhibited = HIGH;
bool lastStateRegister   = HIGH;
bool lastStateClear      = HIGH;

// ─────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────
void lcdPrint(String l1, String l2) {
  lcd.clear();
  delay(20);
  lcd.setCursor(0, 0); lcd.print(l1.substring(0, 16));
  lcd.setCursor(0, 1); lcd.print(l2.substring(0, 16));
}

void showReadyScreen() {
  if (WiFi.status() == WL_CONNECTED) {
    lcdPrint("Scan ID Barcode", "WiFi: Connected");
  } else {
    lcdPrint("Scan ID Barcode", "WiFi: Offline");
  }
}

void setLED(bool s) {
  digitalWrite(LED_GREEN, s ? HIGH : LOW);
  digitalWrite(LED_RED,   s ? LOW  : HIGH);
}

void successBeep() { tone(BUZZER_PIN, 1000, 150); delay(200); }
void errorBeep()   { tone(BUZZER_PIN, 300,  600); delay(650); }

// ─────────────────────────────────────────────────────────────
//  LOGGER
// ─────────────────────────────────────────────────────────────
void logInfo(String msg)  { Serial.println("[INFO]     " + msg); }
void logOK(String msg)    { Serial.println("[OK]       " + msg); }
void logFail(String msg)  { Serial.println("[FAIL]     " + msg); }
void logWait(String msg)  { Serial.println("[WAIT]     " + msg); }
void logGate(String msg)  { Serial.println("[AND GATE] " + msg); }
void logReg(String msg)   { Serial.println("[REG]      " + msg); }
void logSep()             { Serial.println("------------------------------------------"); }
void logTitle(String msg) {
  Serial.println("\n==========================================");
  Serial.println("  " + msg);
  Serial.println("==========================================");
}

void printGateState() {
  logSep();
  Serial.println("[AND GATE] INPUT A - Barcode    : " +
    String(studentVerified ? "1 (TRUE)" : "0 (FALSE)"));
  Serial.println("[AND GATE] INPUT B - Face Match : " +
    String(faceMatch ? "1 (TRUE)" : "0 (FALSE)"));
  Serial.println("[AND GATE] INPUT C - Viol.Button: " +
    String(detectedViolation != "" ?
      "1 (TRUE) = " + detectedViolation : "0 (FALSE)"));
  Serial.println("[AND GATE] OUTPUT  - Record     : " +
    String((studentVerified && faceMatch && detectedViolation != "")
      ? "1 (TRUE) >>> RECORDING VIOLATION <<<"
      : "0 (FALSE) - Not all inputs satisfied"));
  logSep();
}

// ─────────────────────────────────────────────────────────────
//  WIFI
// ─────────────────────────────────────────────────────────────
void connectWiFi() {
  logSep();
  logInfo("Connecting to WiFi: " + String(WIFI_SSID));
  lcdPrint("Connecting WiFi", String(WIFI_SSID).substring(0, 16));
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    String ip = WiFi.localIP().toString();
    logOK("WiFi connected!");
    logOK("ESP32 IP: " + ip);
    logOK("Server  : " + String(SERVER_URL));
    lcdPrint("WiFi Connected!", ip.substring(0, 16));
    delay(1500);
  } else {
    logFail("WiFi FAILED. Running in offline mode.");
    lcdPrint("WiFi Failed!", "Offline Mode");
    delay(2000);
  }
  logSep();
}

// ─────────────────────────────────────────────────────────────
//  HTTP POST - REGISTER
// ─────────────────────────────────────────────────────────────
bool sendRegisterToServer(String studentNumber, String faceId) {
  if (WiFi.status() != WL_CONNECTED) {
    logFail("WiFi not connected. Cannot send register.");
    return false;
  }
  String url = String(SERVER_URL) + "/api/register";
  StaticJsonDocument<256> doc;
  doc["studentNumber"] = studentNumber;
  doc["faceId"]        = faceId;
  doc["name"]          = "";
  doc["course"]        = "";
  doc["section"]       = "";
  String payload;
  serializeJson(doc, payload);
  logInfo("Sending register to: " + url);
  logInfo("Payload: " + payload);
  lcdPrint("Waiting...", "Server waking up");
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  http.setTimeout(60000);
  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  int httpCode = http.POST(payload);
  String response = http.getString();
  http.end();
  if (httpCode == 200) {
    logOK("Server: Student registered on website!");
    logOK("Response: " + response);
    return true;
  } else if (httpCode == 409) {
    logInfo("Server: Student already on website (that's OK).");
    return true;
  } else {
    logFail("Server error. Code: " + String(httpCode));
    logFail("Response: " + response);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
//  HTTP POST - VIOLATION
// ─────────────────────────────────────────────────────────────
bool sendViolationToServer(String studentNumber, String faceId, String violationType) {
  if (WiFi.status() != WL_CONNECTED) {
    logFail("WiFi not connected. Violation saved locally only.");
    return false;
  }
  String url = String(SERVER_URL) + "/api/violation";
  StaticJsonDocument<256> doc;
  doc["studentNumber"] = studentNumber;
  doc["faceId"]        = faceId;
  doc["violationType"] = violationType;
  doc["description"]   = "Recorded via ESP32 device";
  doc["recordedBy"]    = "PATTS Guard System";
  String payload;
  serializeJson(doc, payload);
  logInfo("Sending violation to: " + url);
  logInfo("Payload: " + payload);
  lcdPrint("Waiting...", "Server waking up");
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  http.setTimeout(60000);
  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  int httpCode = http.POST(payload);
  String response = http.getString();
  http.end();
  if (httpCode == 200) {
    logOK("Server: Violation recorded on website!");
    logOK("Response: " + response);
    return true;
  } else if (httpCode == 403) {
    logFail("Server: Face ID mismatch!");
    return false;
  } else if (httpCode == 404) {
    logFail("Server: Student not found on website.");
    return false;
  } else {
    logFail("Server error. Code: " + String(httpCode));
    logFail("Response: " + response);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
//  SETUP
// ─────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(1000);
  logTitle("PATTS VIOLATION RECORDING SYSTEM");
  logInfo("Board  : ESP32-S3 XH-S3E");
  logInfo("Mode   : HuskyLens + WiFi + Website Integration");
  logInfo("Serial : 115200 baud");
  logSep();
  pinMode(BTN_UNIFORM,     INPUT_PULLUP);
  pinMode(BTN_IMPROPER_ID, INPUT_PULLUP);
  pinMode(BTN_PROHIBITED,  INPUT_PULLUP);
  pinMode(BTN_REGISTER,    INPUT_PULLUP);
  pinMode(BTN_CLEAR,       INPUT_PULLUP);
  pinMode(BUZZER_PIN,      OUTPUT);
  pinMode(LED_GREEN,       OUTPUT);
  pinMode(LED_RED,         OUTPUT);
  digitalWrite(LED_GREEN, LOW);
  digitalWrite(LED_RED,   LOW);
  logOK("GPIO pins initialized");
  Wire.begin(LCD_SDA_PIN, LCD_SCL_PIN);
  delay(100);
  lcd.init();
  lcd.backlight();
  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("PATTS System");
  lcd.setCursor(0, 1); lcd.print("Starting...");
  logOK("LCD initialized");
  delay(1000);
  connectWiFi();
  barcodeSerial.begin(115200, SERIAL_8N1, BARCODE_RX_PIN, BARCODE_TX_PIN);
  logOK("GM65 Barcode Scanner ready (RX=GPIO14, TX=GPIO21)");
  huskySerial.begin(9600, SERIAL_8N1, HL_RX_PIN, HL_TX_PIN);
  delay(500);
  if (huskylens.begin(huskySerial)) {
    logOK("HuskyLens connected via UART");
    if (huskylens.writeAlgorithm(ALGORITHM_FACE_RECOGNITION)) {
      logOK("HuskyLens set to Face Recognition mode");
      lcdPrint("HuskyLens OK", "Face Recog.");
    } else {
      logFail("Could not set Face Recognition mode.");
      lcdPrint("HL Mode Warn", "Set Face Recog");
    }
    delay(1000);
  } else {
    logFail("HuskyLens NOT found! Check wiring.");
    lcdPrint("HuskyLens ERR", "Check wiring!");
    errorBeep();
    while (true) { delay(1000); }
  }
  successBeep();
  logOK("Buzzer OK");
  digitalWrite(LED_GREEN, HIGH); delay(400);
  digitalWrite(LED_GREEN, LOW);
  digitalWrite(LED_RED,   HIGH); delay(400);
  digitalWrite(LED_RED,   LOW);
  logOK("LEDs OK");
  loadStudentsFromMemory();
  logSep();
  logTitle("SYSTEM READY");
  logInfo("Scan ID barcode to begin");
  logInfo("Press REGISTER button (GPIO13) to add new student");
  logInfo("Hold CLEAR button (GPIO10) 3s to clear all data");
  if (WiFi.status() == WL_CONNECTED) {
    logOK("Website: " + String(SERVER_URL));
  } else {
    logFail("Website: OFFLINE - check WiFi settings");
  }
  logSep();
  showReadyScreen();
}

// ─────────────────────────────────────────────────────────────
//  MAIN LOOP
// ─────────────────────────────────────────────────────────────
void loop() {
  checkClearButton();
  bool curReg = digitalRead(BTN_REGISTER);
  if (curReg == LOW && lastStateRegister == HIGH) {
    delay(100);
    if (digitalRead(BTN_REGISTER) == LOW) {
      lastStateRegister = LOW;
      if (!registrationMode) enterRegistrationMode();
    }
  }
  if (curReg == HIGH) lastStateRegister = HIGH;
  if (registrationMode) {
    handleRegistration();
    return;
  }
  if (!studentVerified) {
    handleBarcode();
    return;
  }
  if (!faceMatch) {
    lcdPrint("Look at Camera", "HuskyLens...");
    int result = getFaceID();
    if (result > 0) {
      if (result == currentFaceID) {
        faceMatch = true;
        logOK("Face matched! ID: " + String(result) + " -> " + currentStudNum);
        logGate("INPUT B = 1");
        printGateState();
        lcdPrint("Face Matched!", currentStudNum);
        successBeep();
        setLED(true);
        delay(1000);
        lcdPrint("Press violation", "button now");
        logWait("Waiting for violation button...");
      } else {
        logFail("Face ID " + String(result) + " does NOT match student " +
                currentStudNum + " (expected ID " + String(currentFaceID) + ")");
        logGate("INPUT B = 0 - Wrong person");
        printGateState();
        lcdPrint("Wrong Person!", "Access Denied");
        errorBeep();
        setLED(false);
        delay(2500);
        resetState();
      }
    } else if (result == -2) {
      logFail("Face not recognized.");
      logGate("INPUT B = 0 - Unknown face");
      printGateState();
      lcdPrint("Face Unknown!", "Access Denied");
      errorBeep();
      setLED(false);
      delay(2500);
      resetState();
    }
    return;
  }
  if (detectedViolation == "") {
    checkViolationButtons();
    return;
  }
  recordViolation();
}

// ─────────────────────────────────────────────────────────────
//  CLEAR BUTTON
// ─────────────────────────────────────────────────────────────
void checkClearButton() {
  bool curClear = digitalRead(BTN_CLEAR);
  if (curClear == LOW && lastStateClear == HIGH) {
    lastStateClear = LOW;
    unsigned long holdStart = millis();
    int lastSecShown = -1;
    while (digitalRead(BTN_CLEAR) == LOW) {
      unsigned long held = millis() - holdStart;
      int secHeld = held / 1000;
      if (secHeld != lastSecShown) {
        lastSecShown = secHeld;
        int remaining = 3 - secHeld;
        if (remaining > 0) {
          lcdPrint("HOLD TO CLEAR", "Release=cancel " + String(remaining) + "s");
          logInfo("Clear button held: " + String(secHeld) + "s / 3s");
        }
      }
      if (held >= 3000) {
        clearAllStudents();
        lastStateClear = HIGH;
        return;
      }
    }
    logInfo("Clear button released early. Cancelled.");
    lcdPrint("Clear Cancelled", "");
    delay(1000);
    showReadyScreen();
  }
  if (curClear == HIGH) lastStateClear = HIGH;
}

// ─────────────────────────────────────────────────────────────
//  CLEAR ALL STUDENTS
// ─────────────────────────────────────────────────────────────
void clearAllStudents() {
  logTitle("CLEARING ALL STUDENT DATA");
  lcdPrint("Clearing...", "Please wait");
  prefs.begin("students", false);
  prefs.clear();
  prefs.end();
  totalStudents = 0;
  for (int i = 0; i < MAX_STUDENTS; i++) {
    registeredStudents[i].barcodeCode   = "";
    registeredStudents[i].studentNumber = "";
    registeredStudents[i].faceID        = 0;
  }
  studentVerified   = false;
  faceMatch         = false;
  detectedViolation = "";
  currentBarcode    = "";
  currentStudNum    = "";
  currentFaceID     = 0;
  registrationMode  = false;
  regStep           = 0;
  logOK("ESP32 NVS cleared. All student records deleted.");
  logInfo("REMINDER: Also clear HuskyLens faces manually.");
  lcdPrint("All Cleared!", "0 students");
  setLED(false);
  errorBeep(); delay(200);
  errorBeep(); delay(200);
  errorBeep();
  delay(3000);
  showReadyScreen();
}

// ─────────────────────────────────────────────────────────────
//  BARCODE SCAN
// ─────────────────────────────────────────────────────────────
void handleBarcode() {
  if (barcodeSerial.available()) {
    String scanned = barcodeSerial.readStringUntil('\n');
    scanned.trim();
    if (scanned.length() > 0) {
      logSep();
      logInfo("Barcode: [" + scanned + "]");
      logInfo("Searching " + String(totalStudents) + " students...");
      if (findStudentByBarcode(scanned)) {
        studentVerified = true;
        logOK("Student FOUND: " + currentStudNum +
              " | Expected Face ID: " + String(currentFaceID));
        logGate("INPUT A = 1");
        printGateState();
        lcdPrint(currentStudNum, "Get Ready...");
        delay(5000);
        lcdPrint(currentStudNum, "Look at camera");
        logWait("Waiting for face recognition...");
        delay(500);
      } else {
        logFail("NOT registered: [" + scanned + "]");
        logGate("INPUT A = 0 - Output stays 0");
        printGateState();
        lcdPrint("Unknown ID!", "Not Registered");
        errorBeep();
        setLED(false);
        delay(2500);
        showReadyScreen();
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────
//  FACE RECOGNITION
// ─────────────────────────────────────────────────────────────
int getFaceID() {
  if (!huskylens.request())   return -1;
  if (!huskylens.isLearned()) return -1;
  if (!huskylens.available()) return -1;
  HUSKYLENSResult result = huskylens.read();
  if (result.ID == 0) return -2;
  return result.ID;
}

// ─────────────────────────────────────────────────────────────
//  STUDENT LOOKUP
// ─────────────────────────────────────────────────────────────
bool findStudentByBarcode(String code) {
  code.trim();
  for (int i = 0; i < totalStudents; i++) {
    if (code == registeredStudents[i].barcodeCode ||
        code == registeredStudents[i].studentNumber) {
      currentBarcode = code;
      currentStudNum = registeredStudents[i].studentNumber;
      currentFaceID  = registeredStudents[i].faceID;
      return true;
    }
  }
  return false;
}

// ─────────────────────────────────────────────────────────────
//  VIOLATION BUTTONS
// ─────────────────────────────────────────────────────────────
void checkViolationButtons() {
  bool curU = digitalRead(BTN_UNIFORM);
  if (curU == LOW && lastStateUniform == HIGH) {
    delay(50);
    if (digitalRead(BTN_UNIFORM) == LOW) {
      lastStateUniform  = LOW;
      detectedViolation = VIOLATION_UNIFORM;
      logOK("UNIFORM VIOLATION (GPIO4)");
      logGate("INPUT C = 1"); printGateState();
      lcdPrint("Violation:", "Uniform"); delay(800);
    }
  }
  if (curU == HIGH) lastStateUniform = HIGH;
  bool curI = digitalRead(BTN_IMPROPER_ID);
  if (curI == LOW && lastStateImproper == HIGH) {
    delay(50);
    if (digitalRead(BTN_IMPROPER_ID) == LOW) {
      lastStateImproper = LOW;
      detectedViolation = VIOLATION_IMPROPER_ID;
      logOK("IMPROPER ID (GPIO5)");
      logGate("INPUT C = 1"); printGateState();
      lcdPrint("Violation:", "Improper ID"); delay(800);
    }
  }
  if (curI == HIGH) lastStateImproper = HIGH;
  bool curP = digitalRead(BTN_PROHIBITED);
  if (curP == LOW && lastStateProhibited == HIGH) {
    delay(50);
    if (digitalRead(BTN_PROHIBITED) == LOW) {
      lastStateProhibited = LOW;
      detectedViolation   = VIOLATION_PROHIBITED;
      logOK("PROHIBITED ITEMS (GPIO6)");
      logGate("INPUT C = 1"); printGateState();
      lcdPrint("Violation:", "Prohibited"); delay(800);
    }
  }
  if (curP == HIGH) lastStateProhibited = HIGH;
}

// ─────────────────────────────────────────────────────────────
//  RECORD VIOLATION
// ─────────────────────────────────────────────────────────────
void recordViolation() {
  violationCount++;
  unsigned long sec = millis() / 1000;
  String uptime = String(sec / 3600) + "h " +
                  String((sec % 3600) / 60) + "m " +
                  String(sec % 60) + "s";
  lcdPrint("Recording...", currentStudNum);
  logTitle("VIOLATION RECORDED #" + String(violationCount));
  logOK("AND Gate: A=1, B=1, C=1 -> OUTPUT = 1");
  logSep();
  Serial.println("[RECORD]  Student # : " + currentStudNum);
  Serial.println("[RECORD]  Face ID   : " + String(currentFaceID));
  Serial.println("[RECORD]  Violation : " + detectedViolation);
  Serial.println("[RECORD]  Uptime    : " + uptime);
  Serial.println("[RECORD]  Record #  : " + String(violationCount));
  logSep();
  lcdPrint("Sending to", "website...");
  bool sent = sendViolationToServer(currentStudNum, String(currentFaceID), detectedViolation);
  if (sent) {
    logOK("Violation sent to website successfully!");
    lcdPrint("Sent to Website!", detectedViolation.substring(0, 16));
  } else {
    logFail("Could not send to website. Saved locally only.");
    lcdPrint("Recorded!", detectedViolation.substring(0, 16));
  }
  successBeep(); delay(300); successBeep();
  setLED(true);
  delay(3000);
  resetState();
}

// ─────────────────────────────────────────────────────────────
//  RESET STATE
// ─────────────────────────────────────────────────────────────
void resetState() {
  studentVerified     = false;
  faceMatch           = false;
  detectedViolation   = "";
  currentBarcode      = "";
  currentStudNum      = "";
  currentFaceID       = 0;
  lastStateUniform    = HIGH;
  lastStateImproper   = HIGH;
  lastStateProhibited = HIGH;
  lastStateRegister   = HIGH;
  digitalWrite(LED_GREEN, LOW);
  digitalWrite(LED_RED,   LOW);
  logSep();
  logInfo("RESET. AND Gate: A=0, B=0, C=0 -> Output=0");
  logInfo("Ready for next student.");
  logSep();
  showReadyScreen();
}

// ─────────────────────────────────────────────────────────────
//  REGISTRATION MODE
// ─────────────────────────────────────────────────────────────
void enterRegistrationMode() {
  registrationMode = true;
  regStep          = 1;
  regBarcode       = "";
  regStudNum       = "";
  regFaceID        = getNextFaceID();
  logTitle("REGISTRATION MODE");
  logReg("Register button pressed (GPIO13)");
  logReg("Next Face ID slot: #" + String(regFaceID));
  logReg("Step 1 of 2: Scan student barcode");
  lcdPrint("REGISTER MODE", "Scan ID Barcode");
  successBeep(); delay(300); successBeep();
}

void handleRegistration() {
  if (regStep == 1) {
    if (barcodeSerial.available()) {
      String code = barcodeSerial.readStringUntil('\n');
      code.trim();
      if (code.length() > 0) {
        logReg("Barcode: [" + code + "]");
        if (findStudentByBarcode(code)) {
          logFail("Already registered!");
          lcdPrint("Already", "Registered!");
          errorBeep(); delay(2500);
          exitRegistrationMode(); return;
        }
        regBarcode = code;
        regStudNum = code;
        regStep    = 2;
        logReg("Barcode accepted: [" + code + "]");
        logReg("Step 2 of 2: Look at HuskyLens to learn face.");
        lcdPrint("Barcode Scanned!", "Get Ready...");
        delay(5000);
        lcdPrint("Look at Camera", "Learning face..");
        learnFaceOnHuskyLens(regFaceID);
      }
    }
    return;
  }
  if (regStep == 2) { checkFaceLearned(); return; }
  if (regStep == 3) saveNewStudent();
}

// ─────────────────────────────────────────────────────────────
//  HUSKYLENS FACE LEARNING
// ─────────────────────────────────────────────────────────────
void learnFaceOnHuskyLens(int faceID) {
  logReg("Sending learn command for Face ID #" + String(faceID));
  if (huskylens.writeLearn(faceID)) {
    logOK("HuskyLens learned Face ID #" + String(faceID));
    lcdPrint("Face Learned!", "Verifying...");
    delay(1000);
    regStep = 2;
  } else {
    logFail("Learn failed. Make sure face is visible.");
    lcdPrint("Learn Failed!", "Try again");
    errorBeep();
    delay(2000);
    lcdPrint("Look at Camera", "Learning face..");
    learnFaceOnHuskyLens(faceID);
  }
}

void checkFaceLearned() {
  lcdPrint("Confirm Face", "Look at camera");
  logReg("Confirming face detection (8s window)...");
  unsigned long startTime = millis();
  while (millis() - startTime < 8000) {
    if (huskylens.request() && huskylens.available()) {
      HUSKYLENSResult result = huskylens.read();
      if (result.ID == regFaceID) {
        logOK("Face confirmed! ID #" + String(regFaceID) + " detected.");
        lcdPrint("Face Confirmed!", "Saving...");
        regStep = 3;
        return;
      }
    }
    delay(100);
  }
  logFail("Confirmation timeout. Re-learning face.");
  lcdPrint("Confirm Failed", "Try again");
  errorBeep();
  delay(2000);
  lcdPrint("Look at Camera", "Learning face..");
  learnFaceOnHuskyLens(regFaceID);
}

void saveNewStudent() {
  lcdPrint("Saving...", regStudNum);
  if (totalStudents < MAX_STUDENTS) {
    registeredStudents[totalStudents] = {regBarcode, regStudNum, regFaceID};
    totalStudents++;
  }
  saveStudentsToMemory();
  logTitle("STUDENT REGISTERED");
  Serial.println("[REG]  Student # : " + regStudNum);
  Serial.println("[REG]  Barcode   : " + regBarcode);
  Serial.println("[REG]  Face ID   : " + String(regFaceID));
  Serial.println("[REG]  Total     : " + String(totalStudents) + " student(s)");
  logSep();
  logInfo("REMINDER: On HuskyLens press function button -> Save -> Yes");
  lcdPrint("Sending to", "website...");
  bool sent = sendRegisterToServer(regStudNum, String(regFaceID));
  if (sent) {
    logOK("Student registration sent to website!");
    lcdPrint("Registered!", "Sent to website");
  } else {
    logFail("Could not send to website. Saved locally only.");
    lcdPrint("Registered!", regStudNum.substring(0, 16));
  }
  successBeep(); delay(300); successBeep(); delay(300); successBeep();
  delay(3000);
  exitRegistrationMode();
}

void exitRegistrationMode() {
  registrationMode = false;
  regStep    = 0;
  regBarcode = "";
  regStudNum = "";
  regFaceID  = 0;
  logInfo("Back to violation mode.");
  showReadyScreen();
}

int getNextFaceID() {
  int m = 0;
  for (int i = 0; i < totalStudents; i++)
    if (registeredStudents[i].faceID > m) m = registeredStudents[i].faceID;
  return m + 1;
}

// ─────────────────────────────────────────────────────────────
//  MEMORY (ESP32 NVS)
// ─────────────────────────────────────────────────────────────
void saveStudentsToMemory() {
  prefs.begin("students", false);
  prefs.putInt("total", totalStudents);
  for (int i = 0; i < totalStudents; i++) {
    String p = "s" + String(i) + "_";
    prefs.putString((p + "bc").c_str(), registeredStudents[i].barcodeCode);
    prefs.putString((p + "sn").c_str(), registeredStudents[i].studentNumber);
    prefs.putInt(   (p + "fi").c_str(), registeredStudents[i].faceID);
  }
  prefs.end();
  logOK("Saved to NVS. Total: " + String(totalStudents));
}

void loadStudentsFromMemory() {
  prefs.begin("students", true);
  totalStudents = prefs.getInt("total", 0);
  for (int i = 0; i < totalStudents; i++) {
    String p = "s" + String(i) + "_";
    registeredStudents[i].barcodeCode   = prefs.getString((p + "bc").c_str(), "");
    registeredStudents[i].studentNumber = prefs.getString((p + "sn").c_str(), "");
    registeredStudents[i].faceID        = prefs.getInt(   (p + "fi").c_str(), 0);
  }
  prefs.end();
  logSep();
  logOK("Loaded " + String(totalStudents) + " student(s) from NVS.");
  if (totalStudents == 0) {
    logInfo("No students yet. Press REGISTER to add.");
  } else {
    for (int i = 0; i < totalStudents; i++) {
      Serial.println("[INFO]  [" + String(i + 1) + "] " +
        "ID: "        + registeredStudents[i].studentNumber +
        " | BC: "     + registeredStudents[i].barcodeCode +
        " | FaceID: " + String(registeredStudents[i].faceID));
    }
  }
  logSep();
}
