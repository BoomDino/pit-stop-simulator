/**
 * RPA PIT STOP: PRECISION UNDER PRESSURE
 * Core Game Engine, Precision Timing Loop, Stage State Machine & Animations
 */

class PitStopGame {
  constructor() {
    // Configuration & Tuning
    this.penaltyDuration = 1500; // 1.5 seconds penalty per miss
    this.assistModeEnabled = false;

    // Game Stages Definition
    this.stages = [
      {
        id: 1,
        code: 'DOCK_IN',
        name: 'Dock In (Front Jack)',
        targetElementId: 'station-front-jack',
        zoneSize: 64, // degrees
        speed: 180, // degrees per second
        description: 'Engage pneumatic front jack to raise chassis'
      },
      {
        id: 2,
        code: 'TYRE_FL',
        name: 'Front Left Tyre',
        targetElementId: 'station-tyre-fl',
        zoneSize: 52,
        speed: 230,
        description: 'Remove worn soft tyre & mount fresh compound'
      },
      {
        id: 3,
        code: 'TYRE_FR',
        name: 'Front Right Tyre',
        targetElementId: 'station-tyre-fr',
        zoneSize: 42,
        speed: 280,
        description: 'Align high-torque pneumatic nut on front right'
      },
      {
        id: 4,
        code: 'TYRE_RL',
        name: 'Rear Left Tyre',
        targetElementId: 'station-tyre-rl',
        zoneSize: 36,
        speed: 340,
        description: 'Lock rear drive hub with high-velocity rotation'
      },
      {
        id: 5,
        code: 'TYRE_RR',
        name: 'Rear Right Tyre',
        targetElementId: 'station-tyre-rr',
        zoneSize: 28,
        speed: 410,
        description: 'Maximum pressure! Tightest tolerance wheel change'
      },
      {
        id: 6,
        code: 'DOCK_OUT',
        name: 'Dock Out (Release Jacks)',
        targetElementId: 'station-rear-jack',
        zoneSize: 24,
        speed: 480,
        description: 'Drop jacks & trigger pit exit launch sequence'
      }
    ];

    // State Variables
    this.isPlaying = false;
    this.currentStageIndex = 1; // 1 to 6
    this.startTime = 0;
    this.currentTime = 0;
    this.totalPenalties = 0;
    this.isProcessingHit = false;

    // Statistics
    this.perfectHits = 0;
    this.goodHits = 0;
    this.misses = 0;
    this.totalAttempts = 0;

    // Timing Dial State
    this.needleAngle = 0; // 0 to 360
    this.targetCenterAngle = 0; // Where green zone center is located
    this.lastFrameTime = 0;
    this.animFrameId = null;

    // Subsystems
    this.rpa = new window.RPAEngine(this);
    this.particleCanvas = document.getElementById('particle-canvas');
    this.particles = new window.ParticleEngine(this.particleCanvas);
    this.particles.start();

    // DOM Elements Cache
    this.initDOMElements();
    this.bindEvents();
    this.renderStageChecklist();
    this.initWaveformGraphs();
    this.renderLeaderboards();
    this.rpa.reset();
  }

  initDOMElements() {
    this.timerDisplay = document.getElementById('hud-timer');
    this.penaltyDisplay = document.getElementById('hud-penalty');
    this.accuracyDisplay = document.getElementById('hud-accuracy');
    this.currentStageDisplay = document.getElementById('hud-current-stage');
    this.needleEl = document.getElementById('dial-needle');
    this.greenArcEl = document.getElementById('dial-svg-green-arc');
    this.perfectLineEl = document.getElementById('dial-svg-perfect-line');
    this.f1CarEl = document.getElementById('f1-car');
    this.f1CarContainer = document.getElementById('f1-car-container');
    this.hitFeedbackBanner = document.getElementById('hit-feedback-banner');
    this.penaltyAlertBanner = document.getElementById('penalty-alert-banner');
    this.resultsModal = document.getElementById('results-modal');
    this.dialContainer = document.getElementById('precision-dial');
    this.rxCanvas = document.getElementById('canvas-rx-graph');
    this.torqueCanvas = document.getElementById('canvas-torque-graph');
    this.rxLabel = document.getElementById('live-rx-time');
    this.psiLabel = document.getElementById('live-psi');
  }

  bindEvents() {
    // Keyboard listener for Spacebar (Strike), Key R (Reset), and Key E (Fix Nut)
    window.addEventListener('keydown', (e) => {
      // Don't intercept if user is typing their name in the input box
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.code === 'KeyR') {
        e.preventDefault();
        this.resetGame();
        return;
      }

      if (e.code === 'KeyE') {
        e.preventDefault();
        this.handleFixJammedNut();
        return;
      }

      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        if (!this.isPlaying) {
          // If start overlay is showing, spacebar starts game
          const startOverlay = document.getElementById('start-overlay');
          if (startOverlay && !startOverlay.classList.contains('hidden')) {
            this.startGame();
            return;
          }
        }
        this.handlePlayerAction();
      }
    });

    // Central button & dial click listener
    const strikeBtn = document.getElementById('btn-strike-action');
    if (strikeBtn) {
      strikeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.isCompleted) {
          this.startGame();
          return;
        }
        this.handlePlayerAction();
      });
    }

    if (this.dialContainer) {
      this.dialContainer.addEventListener('click', (e) => {
        if (this.isCompleted) {
          this.startGame();
          return;
        }
        this.handlePlayerAction();
      });
    }

    // Canvas click also triggers strike during active play
    const arena = document.getElementById('pit-lane-arena');
    if (arena) {
      arena.addEventListener('click', (e) => {
        // Only if clicking on game arena, not controls
        if (this.isPlaying && !e.target.closest('.interactive-control')) {
          this.handlePlayerAction();
        }
      });
    }

    // Assist Toggle Button
    const assistToggle = document.getElementById('btn-assist-toggle');
    if (assistToggle) {
      assistToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleAssistMode();
      });
    }

    // Start / Retry buttons
    const startBtn = document.getElementById('btn-start-game');
    if (startBtn) {
      startBtn.addEventListener('click', () => this.startGame());
    }

    const retryBtn = document.getElementById('btn-retry-game');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        this.closeResultsModal();
        this.startGame();
      });
    }

    const modalCloseBtn = document.getElementById('btn-modal-close');
    if (modalCloseBtn) {
      modalCloseBtn.addEventListener('click', () => this.closeResultsModal());
    }

    // Leaderboard form submit
    const submitScoreBtn = document.getElementById('btn-submit-score');
    if (submitScoreBtn) {
      submitScoreBtn.addEventListener('click', () => this.submitScore());
    }

    const nameInput = document.getElementById('player-name-input');
    if (nameInput) {
      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.submitScore();
        }
      });
    }

    // Audio Mute Toggle
    const muteBtn = document.getElementById('btn-mute-toggle');
    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        const isMuted = window.soundEngine.toggleMute();
        muteBtn.innerHTML = isMuted ? '🔇 <span class="lbl">Muted</span>' : '🔊 <span class="lbl">Sound ON</span>';
        muteBtn.classList.toggle('muted', isMuted);
      });
    }

    // Leaderboard button
    const viewLeaderboardBtn = document.getElementById('btn-view-leaderboard');
    if (viewLeaderboardBtn) {
      viewLeaderboardBtn.addEventListener('click', () => this.openLeaderboardModal());
    }

    // Reset buttons (Header & HUD)
    const resetHeaderBtn = document.getElementById('btn-reset-game');
    if (resetHeaderBtn) {
      resetHeaderBtn.addEventListener('click', () => this.resetGame());
    }

    const resetHudBtn = document.getElementById('btn-hud-reset');
    if (resetHudBtn) {
      resetHudBtn.addEventListener('click', () => this.resetGame());
    }

    // Leaderboard reset / clear button
    const clearLeaderboardBtn = document.getElementById('btn-clear-leaderboard');
    if (clearLeaderboardBtn) {
      clearLeaderboardBtn.addEventListener('click', () => {
        if (confirm('Reset leaderboard to default baseline times?')) {
          window.leaderboardManager.clearAll();
          const tableBody = document.getElementById('leaderboard-table-body');
          if (tableBody) {
            window.leaderboardManager.renderToTable(tableBody);
          }
        }
      });
    }

    const closeLeaderboardFootBtn = document.getElementById('btn-close-leaderboard-foot');
    if (closeLeaderboardFootBtn) {
      closeLeaderboardFootBtn.addEventListener('click', () => {
        document.getElementById('leaderboard-modal').classList.remove('active');
      });
    }

    const closeLeaderboardBtn = document.getElementById('btn-close-leaderboard');
    if (closeLeaderboardBtn) {
      closeLeaderboardBtn.addEventListener('click', () => {
        document.getElementById('leaderboard-modal').classList.remove('active');
      });
    }

    // Equipment Logistics: Tap 'E' to fix nut button
    const fixJamBtn = document.getElementById('btn-fix-jam');
    if (fixJamBtn) {
      fixJamBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleFixJammedNut();
      });
    }

    // Car Customizer / Shop button (opens Leaderboard)
    const openShopBtn = document.getElementById('btn-open-shop');
    if (openShopBtn) {
      openShopBtn.addEventListener('click', () => this.openLeaderboardModal());
    }

    // Torque slider
    const torqueSlider = document.getElementById('slider-torque');
    if (torqueSlider) {
      torqueSlider.addEventListener('input', (e) => {
        window.soundEngine.playTelemetryBlip();
      });
    }
  }

  handleFixJammedNut() {
    window.soundEngine.playWheelGun();

    const stage = this.stages[this.currentStageIndex - 1];
    if (stage) {
      this.spawnStationFX(stage.id, '#ffcc00', 25);
    }

    if (this.totalPenalties > 0) {
      this.totalPenalties = Math.max(0, this.totalPenalties - 500);
      this.showHitBanner('THREAD FREED!', '-0.5s PENALTY OVERRIDE', 'good');
    } else {
      this.showHitBanner('TORQUE SYNC', 'NUT THREAD 460 Nm VERIFIED', 'perfect');
    }

    if (this.penaltyDisplay) {
      this.penaltyDisplay.textContent = `+${(this.totalPenalties / 1000).toFixed(3)}s`;
    }
  }

  initWaveformGraphs() {
    this.rxHistory = Array.from({ length: 30 }, () => 35 + Math.random() * 25);
    this.torqueHistory = Array.from({ length: 30 }, () => 116 + Math.random() * 6);

    setInterval(() => {
      if (!this.rxCanvas || !this.torqueCanvas) return;
      const nextRx = Math.max(15, Math.min(95, this.rxHistory[this.rxHistory.length - 1] + (Math.random() - 0.5) * 14));
      const nextTorque = Math.max(110, Math.min(125, this.torqueHistory[this.torqueHistory.length - 1] + (Math.random() - 0.5) * 3));
      this.rxHistory.push(nextRx);
      this.rxHistory.shift();
      this.torqueHistory.push(nextTorque);
      this.torqueHistory.shift();

      if (this.rxLabel) this.rxLabel.textContent = `${Math.round(nextRx)}ms`;
      if (this.psiLabel) this.psiLabel.textContent = `${nextTorque.toFixed(1)} PSI`;

      this.renderGraph(this.rxCanvas, this.rxHistory, '#00e5ff', 'rgba(0, 229, 255, 0.15)', 0, 100);
      this.renderGraph(this.torqueCanvas, this.torqueHistory, '#ffcc00', 'rgba(255, 204, 0, 0.15)', 105, 130);
    }, 150);
  }

  renderGraph(canvas, data, strokeColor, fillColor, minVal, maxVal) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Grid center line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    const step = w / (data.length - 1);
    ctx.beginPath();
    data.forEach((val, i) => {
      const norm = (val - minVal) / (maxVal - minVal);
      const y = h - (norm * (h - 10) + 5);
      const x = i * step;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.shadowColor = strokeColor;
    ctx.shadowBlur = 6;
    ctx.stroke();

    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.shadowBlur = 0;
    ctx.fill();
  }

  renderLeaderboards() {
    const compactBody = document.getElementById('leaderboard-table-body');
    if (compactBody) {
      window.leaderboardManager.renderToCompactTable(compactBody);
    }
    const modalBody = document.getElementById('leaderboard-modal-table-body');
    if (modalBody) {
      window.leaderboardManager.renderToTable(modalBody);
    }
  }

  resetGame() {
    this.isPlaying = false;
    this.isCompleted = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.assistTimeoutId) {
      clearTimeout(this.assistTimeoutId);
      this.assistTimeoutId = null;
    }

    // Reset strike button text
    const strikeBtn = document.getElementById('btn-strike-action');
    if (strikeBtn) {
      strikeBtn.innerHTML = 'STRIKE<span class="btn-sub">LOCK</span>';
    }

    // Reset stats
    this.currentStageIndex = 1;
    this.startTime = 0;
    this.currentTime = 0;
    this.totalPenalties = 0;
    this.perfectHits = 0;
    this.goodHits = 0;
    this.misses = 0;
    this.totalAttempts = 0;
    this.isProcessingHit = false;
    this.stageReadyTime = 0;

    // Reset Assist
    this.assistModeEnabled = false;

    // Reset HUD metrics
    if (this.timerDisplay) this.timerDisplay.textContent = '00:00.000';
    if (this.penaltyDisplay) this.penaltyDisplay.textContent = '+0.000s';
    if (this.accuracyDisplay) this.accuracyDisplay.textContent = '100%';
    if (this.currentStageDisplay) this.currentStageDisplay.textContent = 'STAGE 1/6: DOCK IN';

    // Reset car visuals & stations
    this.resetCarVisuals();
    document.querySelectorAll('.pit-station').forEach((st) => st.classList.remove('active-station'));

    // Reset RPA Engine
    this.rpa.reset();

    // Re-render checklist
    this.renderStageChecklist();

    // Close any open modals
    this.closeResultsModal();

    // Show start overlay
    const startOverlay = document.getElementById('start-overlay');
    if (startOverlay) {
      startOverlay.classList.remove('hidden');
    }

    // Sound effect
    if (window.soundEngine) {
      window.soundEngine.playTelemetryBlip();
    }
  }

  toggleAssistMode() {
    this.assistModeEnabled = !this.assistModeEnabled;
    if (this.assistModeEnabled) {
      this.rpa.setupAssistStage();
    }
    this.rpa.updateUI();
  }

  startGame() {
    window.soundEngine.init();
    window.soundEngine.playPitEntry();

    if (this.assistTimeoutId) {
      clearTimeout(this.assistTimeoutId);
      this.assistTimeoutId = null;
    }

    // Reset stats
    this.isPlaying = true;
    this.isCompleted = false;
    this.currentStageIndex = 1;
    this.startTime = performance.now();
    this.totalPenalties = 0;
    this.perfectHits = 0;
    this.goodHits = 0;
    this.misses = 0;
    this.totalAttempts = 0;
    this.isProcessingHit = false;
    this.stageReadyTime = performance.now() + 250;

    const strikeBtn = document.getElementById('btn-strike-action');
    if (strikeBtn) {
      strikeBtn.innerHTML = 'STRIKE<span class="btn-sub">LOCK</span>';
    }

    // Setup RPA
    this.rpa.reset();
    if (this.assistModeEnabled) {
      this.rpa.setupAssistStage();
    }

    // Reset car graphics & animations
    this.resetCarVisuals();

    // Hide start overlay if open
    const startOverlay = document.getElementById('start-overlay');
    if (startOverlay) {
      startOverlay.classList.add('hidden');
    }
    this.closeResultsModal();

    // Car drive in animation
    this.animateCarEnter();

    // Render Checklist
    this.renderStageChecklist();

    // Start Dial Loop
    this.setupStageDial(1);

    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    this.lastFrameTime = performance.now();
    this.loop = this.loop.bind(this);
    this.animFrameId = requestAnimationFrame(this.loop);
  }

  resetCarVisuals() {
    if (this.f1CarContainer) {
      this.f1CarContainer.className = 'car-container';
    }
    // Clear wheel changed marks
    ['fl', 'fr', 'rl', 'rr'].forEach((wheel) => {
      const el = document.getElementById(`wheel-${wheel}`);
      if (el) {
        el.classList.remove('fresh-tyre', 'changing');
      }
      const sparkHost = document.getElementById(`spark-${wheel}`);
      if (sparkHost) sparkHost.innerHTML = '';
    });

    // Reset jacks
    const frontJack = document.getElementById('jack-front-indicator');
    const rearJack = document.getElementById('jack-rear-indicator');
    if (frontJack) frontJack.classList.remove('engaged');
    if (rearJack) rearJack.classList.remove('engaged');

    // Reset gantry lights
    this.setGantryLights('red');
  }

  setGantryLights(state) {
    const lights = document.querySelectorAll('.gantry-led');
    lights.forEach((led) => {
      led.classList.remove('active-red', 'active-green');
      if (state === 'red') led.classList.add('active-red');
      if (state === 'green') led.classList.add('active-green');
    });
  }

  animateCarEnter() {
    if (!this.f1CarContainer) return;
    this.f1CarContainer.classList.add('anim-entering');
    setTimeout(() => {
      this.f1CarContainer.classList.remove('anim-entering');
      this.f1CarContainer.classList.add('pit-box-locked');
    }, 700);
  }

  setupStageDial(stageIdx) {
    const stage = this.stages[stageIdx - 1];
    if (!stage) return;

    // Minimum 250ms reaction grace period before any hit can register
    // (Prevents carry-over clicks or ghost touches from auto-clearing the stage)
    this.stageReadyTime = performance.now() + 250;

    // Clear any previous assist timeout
    if (this.assistTimeoutId) {
      clearTimeout(this.assistTimeoutId);
      this.assistTimeoutId = null;
    }

    // Pick a random target angle for the green zone (0 to 360)
    this.targetCenterAngle = Math.floor(20 + Math.random() * 320);
    this.needleAngle = (this.targetCenterAngle + 180) % 360; // Start opposite to give reaction time

    // Calculate arc for SVG dial (100% bug-free across all angles, zero orange hue)
    this.updateDialGraphics(stage.zoneSize, this.targetCenterAngle);

    // Update active station indicator on the car
    this.updateStationHighlight(stageIdx);

    // RPA notification
    this.rpa.onStageStart(stageIdx, stage);

    // Update Stage text
    if (this.currentStageDisplay) {
      this.currentStageDisplay.textContent = `STAGE ${stageIdx}/6: ${stage.name.toUpperCase()}`;
    }

    this.renderStageChecklist();
  }

  updateDialGraphics(zoneSizeDeg, centerDeg) {
    // Circle radius = 66, circumference = 2 * PI * 66 = 414.690
    const circumf = 414.690;
    const arcLen = (zoneSizeDeg / 360) * circumf;
    // SVG circle starts at 3 o'clock (90 deg). We align center of arc to centerDeg:
    const startRot = centerDeg - (zoneSizeDeg / 2) - 90;

    if (this.greenArcEl) {
      this.greenArcEl.style.strokeDasharray = `${arcLen.toFixed(2)} ${circumf.toFixed(2)}`;
      this.greenArcEl.style.transformOrigin = '85px 85px';
      this.greenArcEl.style.transform = `rotate(${startRot.toFixed(2)}deg)`;
    }

    if (this.perfectLineEl) {
      this.perfectLineEl.style.transformOrigin = '85px 85px';
      this.perfectLineEl.style.transform = `rotate(${centerDeg.toFixed(2)}deg)`;
    }
  }

  updateStationHighlight(stageIdx) {
    // Remove all previous active highlights
    document.querySelectorAll('.pit-station').forEach((st) => st.classList.remove('active-station'));

    const stage = this.stages[stageIdx - 1];
    if (stage) {
      const stationEl = document.getElementById(stage.targetElementId);
      if (stationEl) {
        stationEl.classList.add('active-station');
      }
    }
  }

  // Animation Loop: Updates live timer & needle position
  loop(timestamp) {
    if (!this.isPlaying) return;

    const delta = (timestamp - this.lastFrameTime) / 1000;
    this.lastFrameTime = timestamp;

    // 1. Update Timer
    const rawElapsed = performance.now() - this.startTime;
    this.currentTime = rawElapsed + this.totalPenalties;
    this.timerDisplay.textContent = this.formatTime(this.currentTime);
    this.penaltyDisplay.textContent = `+${(this.totalPenalties / 1000).toFixed(3)}s`;

    // 2. Rotate Needle
    const stage = this.stages[this.currentStageIndex - 1];
    if (stage && !this.isProcessingHit) {
      this.needleAngle = (this.needleAngle + stage.speed * delta) % 360;
      if (this.needleEl) {
        this.needleEl.style.transform = `rotate(${this.needleAngle}deg)`;
      }

      // Also update station mini-gauges on the car
      const miniNeedle = document.querySelector(`.station-${stage.id} .mini-needle`);
      if (miniNeedle) {
        miniNeedle.style.transform = `rotate(${this.needleAngle}deg)`;
      }
    }

    this.animFrameId = requestAnimationFrame(this.loop);
  }

  // Precision Action Strike Trigger
  handlePlayerAction() {
    if (!this.isPlaying || this.isProcessingHit) return;

    // Guard: Prevent double-click or fast-forward trigger during the 250ms stage-start lockout
    if (performance.now() < this.stageReadyTime) {
      return;
    }

    this.isProcessingHit = true;
    this.totalAttempts++;

    const stage = this.stages[this.currentStageIndex - 1];
    const halfZone = stage.zoneSize / 2;
    const sweetZone = stage.zoneSize * 0.15; // 15% center sweet spot for PERFECT

    // Angular distance calculation with wrap-around
    let angleDiff = Math.abs(this.needleAngle - this.targetCenterAngle);
    if (angleDiff > 180) angleDiff = 360 - angleDiff;

    if (angleDiff <= sweetZone) {
      // 1. PERFECT HIT! (Center of green zone)
      this.perfectHits++;
      this.resolveHit('perfect', stage, angleDiff);
    } else if (angleDiff <= halfZone) {
      // 2. GOOD HIT! (Within green zone)
      this.goodHits++;
      this.resolveHit('good', stage, angleDiff);
    } else {
      // 3. MISS / MECHANICAL FAULT (Outside green zone)
      this.misses++;
      this.resolveMiss(stage, angleDiff);
    }

    this.updateAccuracyUI();
  }

  scheduleAssistHit() {
    if (this.assistTimeoutId) {
      clearTimeout(this.assistTimeoutId);
      this.assistTimeoutId = null;
    }

    // When RPA Assist is active, calculate delay until needle enters sweet spot and auto-fire
    const stage = this.stages[this.currentStageIndex - 1];
    let degreesToTarget = this.targetCenterAngle - this.needleAngle;
    if (degreesToTarget < 0) degreesToTarget += 360;

    const delayMs = (degreesToTarget / stage.speed) * 1000;

    this.assistTimeoutId = setTimeout(() => {
      if (this.isPlaying && this.currentStageIndex === stage.id && this.isProcessingHit === false) {
        // Snap needle directly into center
        this.needleAngle = this.targetCenterAngle;
        if (this.needleEl) {
          this.needleEl.style.transform = `rotate(${this.needleAngle}deg)`;
        }

        const assistBanner = document.getElementById('assist-active-banner');
        if (assistBanner) {
          assistBanner.classList.remove('visible');
        }

        this.stageReadyTime = 0; // Bypass grace period for autonomous assist
        this.handlePlayerAction();
      }
    }, Math.max(120, delayMs));
  }

  resolveHit(type, stage, deltaAngle) {
    if (this.assistTimeoutId) {
      clearTimeout(this.assistTimeoutId);
      this.assistTimeoutId = null;
    }

    if (type === 'perfect') {
      window.soundEngine.playPerfect();
      this.showHitBanner('PERFECT!', `±${(deltaAngle * 2.5).toFixed(1)}ms PRECISION LOCK`, 'perfect');
      this.spawnStationFX(stage.id, '#00ff88', 35);
    } else {
      window.soundEngine.playGood();
      this.showHitBanner('GOOD HIT', `TORQUE LOCKED`, 'good');
      this.spawnStationFX(stage.id, '#00ff88', 20);
    }

    // RPA event notification
    this.rpa.onHit(stage.id, type);

    // Trigger stage specific animation
    this.executeStageAction(stage.id);

    // Advance Stage or Complete Game
    setTimeout(() => {
      if (this.currentStageIndex < 6) {
        this.currentStageIndex++;
        this.setupStageDial(this.currentStageIndex);
        this.isProcessingHit = false;
      } else {
        // STAGE 6 COMPLETE! FINISH PIT STOP!
        this.completeGame();
      }
    }, 450);
  }

  resolveMiss(stage, deltaAngle) {
    if (this.assistTimeoutId) {
      clearTimeout(this.assistTimeoutId);
      this.assistTimeoutId = null;
    }

    window.soundEngine.playFailure();
    this.totalPenalties += this.penaltyDuration;

    // Visual Shake & Red Glitch
    if (this.dialContainer) {
      this.dialContainer.classList.add('shake-error');
      setTimeout(() => this.dialContainer.classList.remove('shake-error'), 450);
    }

    // Station fault visual
    this.spawnFaultFX(stage.id);

    // Warning banner & penalty notice
    this.showPenaltyBanner(`+${(this.penaltyDuration / 1000).toFixed(1)}s PENALTY`, 'MECHANICAL FAILURE: RETRYING STATION');

    // RPA event
    this.rpa.onMiss(stage.id);

    // Allow retry after 550ms
    setTimeout(() => {
      this.isProcessingHit = false;
      this.stageReadyTime = performance.now() + 200; // Small grace period on retry
      // Slightly re-randomize green zone center for retry challenge
      this.targetCenterAngle = (this.targetCenterAngle + 45 + Math.random() * 90) % 360;
      this.updateDialGraphics(stage.zoneSize, this.targetCenterAngle);
    }, 550);
  }

  executeStageAction(stageId) {
    switch (stageId) {
      case 1: // DOCK IN - Jack lifts car
        window.soundEngine.playJackLift();
        const frontJack = document.getElementById('jack-front-indicator');
        const rearJack = document.getElementById('jack-rear-indicator');
        if (frontJack) frontJack.classList.add('engaged');
        if (rearJack) rearJack.classList.add('engaged');
        if (this.f1CarContainer) {
          this.f1CarContainer.classList.add('car-raised');
        }
        break;

      case 2: // FRONT LEFT TYRE
        window.soundEngine.playWheelGun();
        this.animateTyreChange('fl');
        break;

      case 3: // FRONT RIGHT TYRE
        window.soundEngine.playWheelGun();
        this.animateTyreChange('fr');
        break;

      case 4: // REAR LEFT TYRE
        window.soundEngine.playWheelGun();
        this.animateTyreChange('rl');
        break;

      case 5: // REAR RIGHT TYRE
        window.soundEngine.playWheelGun();
        this.animateTyreChange('rr');
        break;

      case 6: // DOCK OUT - Release jacks & dramatic departure
        window.soundEngine.playReleaseAndBurnout();
        this.setGantryLights('green');
        if (this.f1CarContainer) {
          this.f1CarContainer.classList.remove('car-raised');
          this.f1CarContainer.classList.add('anim-launching');
        }
        // Spawn burnout smoke on both rear tyres
        this.spawnBurnoutSmoke();
        break;
    }
  }

  animateTyreChange(wheelKey) {
    const wheel = document.getElementById(`wheel-${wheelKey}`);
    if (wheel) {
      wheel.classList.add('changing');
      setTimeout(() => {
        wheel.classList.remove('changing');
        wheel.classList.add('fresh-tyre');
      }, 350);
    }
  }

  spawnStationFX(stageId, color, sparkCount) {
    const stage = this.stages[stageId - 1];
    if (!stage) return;
    const el = document.getElementById(stage.targetElementId);
    if (!el || !this.particleCanvas) return;

    const rect = el.getBoundingClientRect();
    const canvasRect = this.particleCanvas.getBoundingClientRect();
    const x = rect.left - canvasRect.left + rect.width / 2;
    const y = rect.top - canvasRect.top + rect.height / 2;

    this.particles.spawnSparks(x, y, sparkCount);
    this.particles.spawnShockwave(x, y, color, 80);
  }

  spawnFaultFX(stageId) {
    const stage = this.stages[stageId - 1];
    if (!stage) return;
    const el = document.getElementById(stage.targetElementId);
    if (!el || !this.particleCanvas) return;

    const rect = el.getBoundingClientRect();
    const canvasRect = this.particleCanvas.getBoundingClientRect();
    const x = rect.left - canvasRect.left + rect.width / 2;
    const y = rect.top - canvasRect.top + rect.height / 2;

    this.particles.spawnFaultSparks(x, y, 25);
  }

  spawnBurnoutSmoke() {
    const rl = document.getElementById('wheel-rl');
    const rr = document.getElementById('wheel-rr');
    if (!this.particleCanvas) return;

    const canvasRect = this.particleCanvas.getBoundingClientRect();

    const spawnAt = (el) => {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = rect.left - canvasRect.left + rect.width / 2;
      const y = rect.top - canvasRect.top + rect.height / 2;
      for (let i = 0; i < 4; i++) {
        setTimeout(() => {
          this.particles.spawnBurnoutSmoke(x, y, 15);
        }, i * 80);
      }
    };

    spawnAt(rl);
    spawnAt(rr);
  }

  showHitBanner(title, sub, type) {
    if (!this.hitFeedbackBanner) return;
    this.hitFeedbackBanner.innerHTML = `<span class="hit-title">${title}</span><span class="hit-sub">${sub}</span>`;
    this.hitFeedbackBanner.className = `hit-banner visible type-${type}`;

    setTimeout(() => {
      this.hitFeedbackBanner.classList.remove('visible');
    }, 450);
  }

  showPenaltyBanner(title, reason) {
    if (!this.penaltyAlertBanner) return;
    this.penaltyAlertBanner.innerHTML = `
      <div class="alert-icon">⚠️</div>
      <div class="alert-body">
        <strong>${title}</strong>
        <span>${reason}</span>
      </div>
    `;
    this.penaltyAlertBanner.className = 'penalty-banner visible';

    setTimeout(() => {
      this.penaltyAlertBanner.classList.remove('visible');
    }, 1200);
  }

  updateAccuracyUI() {
    const accuracy = this.totalAttempts > 0 ? ((this.perfectHits + this.goodHits) / this.totalAttempts) * 100 : 100;
    if (this.accuracyDisplay) {
      this.accuracyDisplay.textContent = `${Math.round(accuracy)}%`;
    }
  }

  renderStageChecklist() {
    const listContainer = document.getElementById('hud-stage-list');
    if (!listContainer) return;

    const sparklines = [
      "0,10 8,3 16,11 24,5 32,8 40,2 44,7",
      "0,8 10,12 18,2 26,10 34,4 40,9 44,6",
      "0,12 8,6 16,10 24,2 32,12 40,4 44,7",
      "0,6 8,10 16,3 24,11 32,5 40,10 44,4",
      "0,10 8,3 16,12 24,5 32,9 40,2 44,7",
      "0,7 8,11 16,4 24,9 32,2 40,8 44,5"
    ];

    listContainer.innerHTML = this.stages
      .map((st, idx) => {
        let statusBadge = `<span class="stage-pill-pending"><svg class="sparkline-svg" viewBox="0 0 44 14"><polyline points="${sparklines[idx % sparklines.length]}" /></svg> 🔒</span>`;
        let rowClass = 'sequence-item';

        if (st.id < this.currentStageIndex || (this.isCompleted && st.id <= 6)) {
          statusBadge = '<span class="stage-pill-done">DONE</span>';
          rowClass += ' stage-done';
        } else if (st.id === this.currentStageIndex && this.isPlaying) {
          statusBadge = '<span class="stage-pill-current">IN PROGRESS</span>';
          rowClass += ' stage-current';
        }

        return `
          <div class="${rowClass}">
            <div class="stage-title-wrap">
              <span class="num">${st.id}.</span>
              <span class="name">${st.name}</span>
            </div>
            ${statusBadge}
          </div>
        `;
      })
      .join('');
  }

  completeGame() {
    this.isPlaying = false;
    this.isCompleted = true;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.assistTimeoutId) {
      clearTimeout(this.assistTimeoutId);
      this.assistTimeoutId = null;
    }

    // Turn off Assist mode on finish
    this.assistModeEnabled = false;
    this.rpa.assistActive = false;
    this.rpa.updateUI();

    // Re-render checklist to show all stages as DONE
    this.renderStageChecklist();

    if (this.currentStageDisplay) {
      this.currentStageDisplay.textContent = 'STAGE 6/6: DOCK OUT [DONE]';
    }

    const strikeBtn = document.getElementById('btn-strike-action');
    if (strikeBtn) {
      strikeBtn.innerHTML = 'RETRY<span class="btn-sub">PIT STOP</span>';
    }

    window.soundEngine.playFanfare();
    this.particles.spawnConfetti(90);

    const finalTime = this.currentTime;
    const accuracy = this.totalAttempts > 0 ? ((this.perfectHits + this.goodHits) / this.totalAttempts) * 100 : 100;

    // Racing Badge Qualification
    let badgeTitle = 'PIT STOP MASTER';
    let badgeClass = 'badge-master';
    let badgeDesc = 'Legendary Formula 1 precision! World-class pit stop execution.';

    if (finalTime <= 24000 && accuracy >= 85) {
      badgeTitle = 'PIT STOP MASTER';
      badgeClass = 'badge-master';
      badgeDesc = 'Flawless timing! You matched the elite Red Bull / McLaren pit crew standard.';
    } else if (finalTime <= 40000 && accuracy >= 70) {
      badgeTitle = 'PRECISION DRIVER';
      badgeClass = 'badge-driver';
      badgeDesc = 'Outstanding execution! Solid teamwork between driver and RPA crew.';
    } else if (this.misses <= 3) {
      badgeTitle = 'ROOKIE PIT CREW';
      badgeClass = 'badge-rookie';
      badgeDesc = 'Good effort! Continued RPA calibration will trim precious seconds.';
    } else {
      badgeTitle = 'MECHANICAL DISASTER';
      badgeClass = 'badge-disaster';
      badgeDesc = 'Multiple pneumatic faults and cross-threaded wheel nuts. Back to the sim!';
    }

    // Populate Results Modal
    this.showResultsModal({
      finalTime,
      totalPenalties: this.totalPenalties,
      perfectHits: this.perfectHits,
      goodHits: this.goodHits,
      misses: this.misses,
      accuracy: Math.round(accuracy),
      badgeTitle,
      badgeClass,
      badgeDesc
    });
  }

  showResultsModal(data) {
    if (!this.resultsModal) return;

    const timeFormatted = this.formatTime(data.finalTime);
    document.getElementById('res-final-time').textContent = timeFormatted;
    document.getElementById('res-penalty').textContent = `+${(data.totalPenalties / 1000).toFixed(3)}s (${data.misses} misses)`;
    document.getElementById('res-perfect').textContent = `${data.perfectHits}/6`;
    document.getElementById('res-good').textContent = data.goodHits;
    document.getElementById('res-misses').textContent = data.misses;
    document.getElementById('res-accuracy').textContent = `${data.accuracy}%`;

    const badgeEl = document.getElementById('res-racing-badge');
    if (badgeEl) {
      badgeEl.className = `racing-badge ${data.badgeClass}`;
      badgeEl.innerHTML = `
        <div class="badge-title">${data.badgeTitle}</div>
        <div class="badge-sub">${data.badgeDesc}</div>
      `;
    }

    // Check personal best
    const bestTime = window.leaderboardManager.getBestTime();
    const isNewRecord = !bestTime || data.finalTime < bestTime;
    const recordBanner = document.getElementById('res-record-banner');
    if (recordBanner) {
      recordBanner.style.display = isNewRecord ? 'block' : 'none';
    }

    // Store temporary score object for submission
    this.lastResult = data;

    // Reset submit button state
    const submitBtn = document.getElementById('btn-submit-score');
    if (submitBtn) {
      submitBtn.textContent = 'SAVE';
      submitBtn.disabled = false;
    }

    const nameInput = document.getElementById('player-name-input');
    if (nameInput) {
      setTimeout(() => nameInput.focus(), 150);
    }

    this.resultsModal.classList.add('active');
  }

  submitScore() {
    if (!this.lastResult) return;
    const nameInput = document.getElementById('player-name-input');
    const name = nameInput ? nameInput.value : '';

    window.leaderboardManager.addEntry({
      name: name || 'F1 Racer',
      time: this.lastResult.finalTime,
      accuracy: this.lastResult.accuracy,
      perfectHits: this.lastResult.perfectHits
    });

    this.renderLeaderboards();

    // Disable button to prevent double submit
    const submitBtn = document.getElementById('btn-submit-score');
    if (submitBtn) {
      submitBtn.textContent = '✓ Saved to Leaderboard';
      submitBtn.disabled = true;
    }

    setTimeout(() => {
      this.closeResultsModal();
      this.openLeaderboardModal();
    }, 600);
  }

  closeResultsModal() {
    if (this.resultsModal) {
      this.resultsModal.classList.remove('active');
    }
  }

  openLeaderboardModal() {
    const modal = document.getElementById('leaderboard-modal');
    const tableBody = document.getElementById('leaderboard-modal-table-body');
    if (modal && tableBody) {
      window.leaderboardManager.renderToTable(tableBody);
      modal.classList.add('active');
    }
  }

  formatTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const mill = Math.floor(ms % 1000);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(mill).padStart(3, '0')}`;
  }
}

// Instantiate on DOM load
window.addEventListener('DOMContentLoaded', () => {
  window.pitStopGame = new PitStopGame();
});
