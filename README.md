# 📚 ESP32 Student Violation System — Setup Guide

## 📁 Project Structure
```
esp32-violation-system/
├── backend/
│   ├── server.js          ← Node.js API server
│   ├── package.json       ← Dependencies list
│   └── database.json      ← Auto-created when server runs
├── frontend/
│   └── public/
│       └── index.html     ← Website (served by backend)
└── ESP32_ViolationSystem.ino  ← Arduino code for ESP32
```

---

## 🖥️ STEP 1: Install Node.js

1. Go to https://nodejs.org
2. Download and install the **LTS version**
3. To verify, open Command Prompt and type:
   ```
   node --version
   ```

---

## 🚀 STEP 2: Run the Backend Server

1. Open **Command Prompt** (or Terminal)
2. Navigate to the backend folder:
   ```
   cd path\to\esp32-violation-system\backend
   ```
3. Install dependencies (only once):
   ```
   npm install
   ```
4. Start the server:
   ```
   node server.js
   ```
5. You should see:
   ```
   🚀 Server running at http://localhost:3000
   📡 ESP32 can connect to: http://YOUR_PC_IP:3000
   ```

---

## 🌐 STEP 3: Access the Website

Open your browser and go to:
```
http://localhost:3000
```

The website has 5 sections:
- **Dashboard** — Stats overview + recent violations
- **Students** — View/delete registered students
- **Violations** — View/delete violation records
- **Register** — Manually register or test ESP32 registration API
- **Log Violation** — Manually log or test ESP32 violation API

---

## 🔍 STEP 4: Find Your PC's IP Address

The ESP32 needs to connect to your PC. Find your IP:

**Windows:**
1. Open Command Prompt
2. Type: `ipconfig`
3. Look for **IPv4 Address** (e.g., `192.168.1.100`)

**Make sure:**
- Your PC and ESP32 are on the **same WiFi network**
- Windows Firewall allows port 3000 (or temporarily disable it)

---

## ⚙️ STEP 5: Configure the ESP32 Code

Open `ESP32_ViolationSystem.ino` in Arduino IDE and change these lines:

```cpp
const char* WIFI_SSID     = "YOUR_WIFI_NAME";       // Your WiFi name
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";   // Your WiFi password
const char* SERVER_IP     = "192.168.1.100";         // Your PC's IP address
```

---

## 🔧 STEP 6: Install Arduino Libraries

In Arduino IDE: **Tools → Manage Libraries**

Install these:
- `HUSKYLENS` by DFRobot
- `ArduinoJson` by Benoit Blanchon

Also make sure ESP32 board is installed:
- **File → Preferences → Additional Boards Manager URLs:**
  ```
  https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
  ```
- **Tools → Board → Boards Manager** → search "esp32" → Install

---

## 🔌 STEP 7: Wiring

| Component      | ESP32 Pin |
|---------------|-----------|
| HuskyLens SDA | GPIO 21   |
| HuskyLens SCL | GPIO 22   |
| HuskyLens VCC | 3.3V      |
| HuskyLens GND | GND       |
| Barcode RX    | GPIO 16   |
| Barcode TX    | GPIO 17   |
| Register Btn  | GPIO 12   |
| Violation Btn | GPIO 13   |
| Button GND    | GND       |

---

## 📡 API Endpoints (for reference)

| Method | Endpoint         | Description                        |
|--------|------------------|------------------------------------|
| POST   | /api/register    | Register a student                |
| POST   | /api/violation   | Record a violation                |
| POST   | /api/verify      | Verify identity only              |
| GET    | /api/students    | Get all students                  |
| GET    | /api/violations  | Get all violations                |
| GET    | /api/stats       | Dashboard stats                   |
| DELETE | /api/students/:id | Delete a student                 |
| DELETE | /api/violations/:id | Delete a violation record      |

---

## 🌍 STEP 8: Make Website Accessible Online (Optional)

To access your website from outside your home network:

### Option A: ngrok (Easiest, Free)
1. Download ngrok from https://ngrok.com
2. Run: `ngrok http 3000`
3. You'll get a URL like `https://abc123.ngrok.io` — shareable online!

### Option B: Deploy to Render.com (Free Cloud Hosting)
1. Create a free account at https://render.com
2. Upload your backend folder to GitHub
3. Create a new Web Service on Render pointing to your repo
4. Set start command: `node server.js`
5. Your site will have a permanent URL like `https://your-app.onrender.com`

---

## ✅ Testing Without ESP32

Use the **"Test ESP32 API"** tabs in the Register and Log Violation pages.
They simulate exactly what the ESP32 sends to the server.

---

## ❓ Common Issues

**Website not loading?**
→ Make sure `node server.js` is running in Command Prompt

**ESP32 can't connect to server?**
→ Check that PC and ESP32 are on the same WiFi
→ Check the IP address in the .ino file
→ Temporarily disable Windows Firewall

**HuskyLens not working?**
→ Check I2C wiring (SDA=21, SCL=22)
→ Make sure HuskyLens is set to I2C mode (not UART)

---

*Good luck with your project! 🎓*
