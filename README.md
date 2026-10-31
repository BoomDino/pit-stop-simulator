# 🏎️ RPA PIT STOP: PRECISION UNDER PRESSURE

> **High-Octane Formula 1 Pit Stop Simulation Powered by Robotic Process Automation (RPA)**  
> Developed for college tech-fests, interactive engineering stalls, and competitive arcade gaming.

---

## 🎮 Overview

**RPA PIT STOP: PRECISION UNDER PRESSURE** puts players in command of an ultra-fast Formula 1 pit stop. Players must complete **six consecutive precision timing challenges** in sequence under high pressure to lift the car, change all four tyres with robotic wheel guns, and launch the car back onto the track.

The game seamlessly combines:
- **Formula 1 Grand Prix pit lane atmosphere** (authentic aerodynamics, pit crew mechanics, pneumatic jacks, tyre warmers).
- **Arcade precision timing skill checks** with rotating needles, sweet-spot green zones, and warning margins.
- **Robotic Process Automation (RPA)** pipeline orchestration (`DETECT → ANALYSE → EXECUTE → VERIFY`), autonomous telemetry agents, live bot logs, and an optional AI Assist mode.

---

## 🏁 The Six Skill Checks

Every pit stop consists of exactly six progressive stages:

| Stage | Name | Target Station | Dynamic Difficulty | Robotic Action |
|:---:|:---|:---|:---|:---|
| **1** | **DOCK IN** | Front Pneumatic Jack | Speed: 1.0x \| Zone: 64° | Engages pneumatic front & rear jacks to raise chassis |
| **2** | **FRONT LEFT TYRE** | Front-Left Wheel Hub | Speed: 1.2x \| Zone: 52° | Spins off wheel nut, removes old compound, mounts fresh red slick |
| **3** | **FRONT RIGHT TYRE** | Front-Right Wheel Hub | Speed: 1.4x \| Zone: 42° | High-torque optical alignment & pneumatic nut torque |
| **4** | **REAR LEFT TYRE** | Rear-Left Wheel Hub | Speed: 1.7x \| Zone: 36° | High-velocity torque wrench locking rear drive axle |
| **5** | **REAR RIGHT TYRE** | Rear-Right Wheel Hub | Speed: 2.1x \| Zone: 28° | Maximum tyre difficulty; ultra-narrow tolerance zone |
| **6** | **DOCK OUT** | Rear Jack & Release | Speed: 2.4x \| Zone: 24° | Releases jacks, flashes green gantry lights, triggers V6 burnout launch! |

---

## 🎯 Precision Timing Mechanic

The core mechanic is an interactive circular neon gauge:
- **Rotating Needle**: Rotates smoothly at 60 FPS using `performance.now()`.
- **Green Success Zone**: Highlights the valid window.
- **Center Sweet Spot (Cyan/White Marker)**: ±15% sweet-spot center of the green zone triggers a **PERFECT** hit!
- **Yellow Boundary Zones**: Flanking borders trigger a **GOOD** hit.
- **Red Zones**: Needle outside triggers a **MISS** (Mechanical Failure).

### Controls & Shortcuts
- <kbd>SPACEBAR</kbd> or **Click Dial**: Strike / Lock timing check.
- <kbd>R</kbd> or **🔄 Reset Run**: Instantly aborts and restarts pit stop from Stage 1.
- **🤖 RPA ASSIST**: Toggles autonomous AI bot takeover for 1 random tyre check.

### Scoring & Penalties
- **PERFECT**: Maximum precision chime, particle spark shockwave, optimal cycle time.
- **GOOD**: Reliable confirmation tone, green telemetry verification.
- **MISS**: Mechanical failure! Triggers a **+1.500s penalty**, warning buzzer, screen shake, and requires retrying the current station before advancing. Timer never resets!

---

## 🤖 RPA Integration

RPA is not just a cosmetic theme—it monitors and orchestrates the entire pit stop workflow:

1. **4-Stage Pipeline**:
   - `DETECT`: Optical LiDAR / Computer Vision scan locks onto the wheel hub `[CV_CONFIDENCE: 99.4%]`.
   - `ANALYSE`: Signal telemetry engine calculates rotational speed, angle delta, and torque requirements.
   - `EXECUTE`: Simulated high-torque pneumatic actuator torques wheel nut to 460 Nm.
   - `VERIFY`: Locking pin seating verification and telemetry handshake pass.
2. **Active RPA Bots**:
   - `BOT-JACK-F01`: Pneumatic Chassis Lift Bot
   - `BOT-WHEEL-FL`: Front-Left Torque Station
   - `BOT-WHEEL-FR`: Front-Right Torque Station
   - `BOT-WHEEL-RL`: Rear-Left Torque Station
   - `BOT-WHEEL-RR`: Rear-Right Torque Station
   - `BOT-JACK-R02`: Rear Pneumatic Release & Telemetry Launch Bot
3. **Live Terminal Feed**:
   - Real-time stream of robotic logs with millisecond timestamps and status codes (`[INFO]`, `[SYNC]`, `[EXEC]`, `[PASS]`, `[WARN]`).
4. **Autonomous AI Assist Mode**:
   - When enabled via the **🤖 RPA ASSIST** button, the RPA Bot autonomously executes one randomly chosen tyre check with predictive AI lock-on and mathematical perfection.

---

## 🔊 Procedural Web Audio Engine

Uses the **HTML5 Web Audio API** for 100% synthesized procedural sound effects without relying on external MP3 downloads:
- Realistic V6 turbo hybrid engine deceleration & tyre screech entering pit lane.
- Heavy pneumatic jack lift hiss and mechanical chassis clunk.
- High-rpm pneumatic wheel gun electric motor whine and rapid impact ratcheting.
- Sci-fi harmonic chimes for perfect hits.
- Mechanical fault alarm buzzer and metallic drop clatter.
- High-octane V6 turbo burnout acceleration and tyre spin doppler sound!
- Results fanfare chords.
- Full volume and mute toggles.

---

## 🏆 Leaderboard & Racing Ranks

Persisted in `localStorage` across refreshes:
- **PIT STOP MASTER**: Total time < 24s and Accuracy ≥ 85% (F1 World Championship tier).
- **PRECISION DRIVER**: Total time < 40s and Accuracy ≥ 70%.
- **ROOKIE PIT CREW**: Completed with under 4 misses.
- **MECHANICAL DISASTER**: Multiple cross-threaded wheel nuts. Back to the sim!

Leaderboard records Player Name, Total Time (millisecond precision), Accuracy %, Number of Perfect Hits, and Date.

---

## 🚀 Quick Start / How to Run

### Method 1: Direct Browser Launch (Easiest)
Simply double-click or open `index.html` in **Google Chrome**, **Microsoft Edge**, **Opera**, or **Firefox**. No installation or internet access needed!

### Method 2: One-Click Windows Batch Runner
Double-click `start-game.bat` in the project folder. It will launch the local HTTP server or open the game in your browser automatically.

### Method 3: Node.js Server
Run in command prompt / terminal:
```bash
agy-node server.js
# or: node server.js
```
Then visit `http://localhost:3000` in your browser.

---

## 🎪 College Tech-Fest Stall Tips

- **Dual Control**: Connect an arcade button, USB gamepad mapped to `Spacebar`, or use a large touchscreen laptop/tablet!
- **Sound System**: Plug in external desktop speakers or a Bluetooth soundbar—the synthesized pneumatic wheel guns and F1 burnout engine sounds will draw massive crowds to your stall!
- **High-Score Competition**: Keep the Leaderboard open between players to spark competition for the "Fastest Pit Crew on Campus"!
