/**
 * RPA PIT STOP - Autonomous Robotic Process Automation (RPA) Engine
 * Coordinates the automated pit crew workflow: DETECT -> ANALYSE -> EXECUTE -> VERIFY
 * Provides live telemetry, bot status dispatching, and optional AUTOMATION ASSIST mode.
 */

class RPAEngine {
  constructor(game) {
    this.game = game;
    this.workflowSteps = ['detect', 'analyse', 'execute', 'verify'];
    this.currentStepIndex = 0;
    this.completedTasks = 0;
    this.failedTasks = 0;
    this.assistUsed = false;
    this.assistActive = false;
    this.assistTargetStage = null;

    this.bots = {
      1: { id: 'BOT-JACK-F01', name: 'Front Jack Automation', type: 'Pneumatic Actuator', status: 'STANDBY' },
      2: { id: 'BOT-WHEEL-FL', name: 'FL Torque Station', type: 'High-Torque Optical', status: 'STANDBY' },
      3: { id: 'BOT-WHEEL-FR', name: 'FR Torque Station', type: 'High-Torque Optical', status: 'STANDBY' },
      4: { id: 'BOT-WHEEL-RL', name: 'RL Torque Station', type: 'High-Torque Optical', status: 'STANDBY' },
      5: { id: 'BOT-WHEEL-RR', name: 'RR Torque Station', type: 'High-Torque Optical', status: 'STANDBY' },
      6: { id: 'BOT-JACK-R02', name: 'Rear Jack & Launch', type: 'Pneumatic Release', status: 'STANDBY' }
    };

    this.logs = [];
    this.maxLogs = 8;
  }

  reset() {
    this.currentStepIndex = 0;
    this.completedTasks = 0;
    this.failedTasks = 0;
    this.assistUsed = false;
    this.assistActive = false;
    this.assistTargetStage = null;
    this.logs = [];

    Object.values(this.bots).forEach((b) => (b.status = 'STANDBY'));
    this.updateUI();
    this.log('SYS-INIT', 'RPA Automation Controller initialized. Standby for dock-in.', 'info');
  }

  setupAssistStage() {
    // Pick one random tyre check (stages 2, 3, 4, or 5) for AI Assist demonstration
    const tyreStages = [2, 3, 4, 5];
    this.assistTargetStage = tyreStages[Math.floor(Math.random() * tyreStages.length)];
    this.log('ASSIST-CFG', `Automation Assist armed for Stage ${this.assistTargetStage} (Autonomous Execution).`, 'sync');
  }

  onStageStart(stageIndex, stageInfo) {
    const bot = this.bots[stageIndex];
    if (bot) {
      bot.status = 'DETECTING';
    }

    this.setWorkflowStep(0); // DETECT
    this.log(bot ? bot.id : 'RPA-CORE', `Acquiring target: ${stageInfo.name}... Optical CV lock established.`, 'sync');

    // Simulate RPA sub-step progression
    setTimeout(() => {
      if (this.game.currentStageIndex === stageIndex && this.game.isPlaying) {
        this.setWorkflowStep(1); // ANALYSE
        if (bot) bot.status = 'ANALYSING';
        this.log(bot ? bot.id : 'RPA-CORE', `Analysing rotational sync & torque curve. Ready for precision trigger.`, 'info');
      }
    }, 450);

    // If this stage matches our Assist Target and Assist is enabled
    if (this.game.assistModeEnabled && stageIndex === this.assistTargetStage && !this.assistUsed) {
      this.triggerAutoAssist(stageIndex);
    }

    this.updateUI();
  }

  setWorkflowStep(stepIndex) {
    this.currentStepIndex = stepIndex;
    const stepNames = ['detect', 'analyse', 'execute', 'verify'];

    stepNames.forEach((step, idx) => {
      const el = document.getElementById(`rpa-step-${step}`);
      if (el) {
        el.classList.remove('active', 'completed', 'pulse');
        if (idx < stepIndex) {
          el.classList.add('completed');
        } else if (idx === stepIndex) {
          el.classList.add('active', 'pulse');
        }
      }
    });

    const statusBadge = document.getElementById('rpa-status-badge');
    if (statusBadge) {
      const stepUpper = stepNames[stepIndex].toUpperCase();
      statusBadge.textContent = stepUpper;
      statusBadge.className = `rpa-badge rpa-badge-${stepNames[stepIndex]}`;
    }
  }

  onHit(stageIndex, hitType) {
    const bot = this.bots[stageIndex];
    this.setWorkflowStep(2); // EXECUTE
    if (bot) bot.status = 'EXECUTING';

    this.log(bot ? bot.id : 'RPA-CORE', `Execution triggered [${hitType.toUpperCase()}]. Nut torque: 460Nm. Seating verification started.`, 'exec');

    setTimeout(() => {
      this.setWorkflowStep(3); // VERIFY
      if (bot) bot.status = 'VERIFIED';
      this.completedTasks++;
      this.log(bot ? bot.id : 'RPA-CORE', `Lock pin seated. Telemetry verification PASS. Ready for next station.`, 'pass');
      this.updateUI();
    }, 350);
  }

  onMiss(stageIndex) {
    const bot = this.bots[stageIndex];
    this.failedTasks++;
    if (bot) bot.status = 'ERROR_FAULT';
    this.setWorkflowStep(1); // Back to analyse / retry
    this.log(bot ? bot.id : 'RPA-CORE', `FAULT: Timing signal out of bounds! Wheel gun jammed. Retrying torque cycle (+1.5s penalty).`, 'warn');
    this.updateUI();
  }

  triggerAutoAssist(stageIndex) {
    if (this.assistUsed) return;
    this.assistActive = true;
    this.assistUsed = true;
    this.game.assistModeEnabled = false; // Immediately disable so it never fires on subsequent runs

    const overlay = document.getElementById('assist-active-banner');
    if (overlay) {
      overlay.innerHTML = `<div class="assist-pulse-dot"></div><span>🤖 RPA AUTO-PILOT ENGAGED (STAGE ${stageIndex})</span>`;
      overlay.classList.add('visible');
    }

    this.log('RPA-AGENT', `>>> AUTONOMOUS ASSIST ENGAGED! Neural timing lock active for Stage ${stageIndex}. <<<`, 'pass');
    window.soundEngine.playTelemetryBlip();

    // The Assist Bot calculates the moment needle enters sweet spot and auto-strikes
    this.game.scheduleAssistHit();
    this.updateUI();
  }

  log(source, message, type = 'info') {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');
    this.logs.unshift({ time: timeStr, source, message, type });

    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    const logContainer = document.getElementById('rpa-log-feed');
    if (logContainer) {
      logContainer.innerHTML = this.logs
        .map(
          (l) => `
        <div class="rpa-log-item rpa-log-${l.type}">
          <span class="rpa-log-time">${l.time}</span>
          <span class="rpa-log-src">[${l.source}]</span>
          <span class="rpa-log-msg">${l.message}</span>
        </div>
      `
        )
        .join('');
    }
  }

  updateUI() {
    const completedEl = document.getElementById('rpa-stat-completed');
    const failedEl = document.getElementById('rpa-stat-failed');
    const botIdEl = document.getElementById('rpa-active-bot-id');
    const botDescEl = document.getElementById('rpa-active-bot-desc');
    const cvConfidenceEl = document.getElementById('rpa-cv-confidence');

    if (completedEl) completedEl.textContent = `${this.completedTasks}/6`;
    if (failedEl) failedEl.textContent = this.failedTasks;

    const currentBot = this.bots[this.game.currentStageIndex];
    if (currentBot) {
      if (botIdEl) botIdEl.textContent = currentBot.id;
      if (botDescEl) botDescEl.textContent = `${currentBot.name} [${currentBot.status}]`;
    }

    if (cvConfidenceEl) {
      const conf = (99.1 + Math.random() * 0.8).toFixed(1);
      cvConfidenceEl.textContent = `${conf}%`;
    }

    // Assist button state
    const assistBtn = document.getElementById('btn-assist-toggle');
    if (assistBtn) {
      if (this.game.assistModeEnabled) {
        assistBtn.classList.add('active');
        assistBtn.innerHTML = `<span class="icon">🤖</span> RPA ASSIST: <span class="badge-on">READY (STG ${this.assistTargetStage || '?'})</span>`;
      } else {
        assistBtn.classList.remove('active');
        assistBtn.innerHTML = `<span class="icon">🤖</span> RPA ASSIST: <span class="badge-off">OFF</span>`;
      }
    }
  }
}

window.RPAEngine = RPAEngine;
