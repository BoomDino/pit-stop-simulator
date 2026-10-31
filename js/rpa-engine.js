/** Real UiPath monitoring. Game animations remain local simulations. */
class RPAEngine {
  constructor(game) {
    this.game = game;
    this.key = 'pitstop_real_events_v1';
    this.queue = [];
    this.logs = [];
    this.busy = false;
    this.assistActive = false;
    try { this.queue = JSON.parse(localStorage.getItem(this.key) || '[]'); } catch (_) {}
    if (!Array.isArray(this.queue)) this.queue = [];
    this.queue = this.queue.filter(x => x && x.event && x.event.event_id);
    document.getElementById('rpa-retry')?.addEventListener('click', () => this.retry());
    this.checkConnection();
    this.interval = setInterval(() => { this.checkConnection(); this.pump(); }, 5000);
    this.pump();
  }
  id() { return crypto.randomUUID(); }
  reset() {
    this.runId = this.id();
    this.playerId = 'player_' + this.id();
    this.runEvents = [];
    this.runEnabled = false;
    this.stageStarted = performance.now();
    this.updateUI();
  }
  setupAssistStage() {
    this.runEnabled = true;
    // Enabling mid-run queues earlier successful actions, preserving sequence.
    for (const event of this.runEvents) this.enqueue(event);
    this.pump();
  }
  onStageStart() { this.stageStarted = performance.now(); }
  onHit(stage) {
    const wheels = [null, 'FRONT_LEFT', 'FRONT_RIGHT', 'REAR_LEFT', 'REAR_RIGHT', null];
    const event = {
      event_id: this.id(), run_id: this.runId, player_id: this.playerId, stage,
      event: stage === 1 ? 'DOCK_IN' : stage === 6 ? 'DOCK_OUT' : 'TYRE_REPLACED',
      wheel_position: wheels[stage - 1], status: 'SUCCESS',
      player_score: this.game.perfectHits * 100 + this.game.goodHits * 75,
      execution_time: Math.max(0, (performance.now() - this.stageStarted) / 1000),
      timestamp: new Date().toISOString()
    };
    this.runEvents.push(event);
    if (this.runEnabled) { this.enqueue(event); this.pump(); }
    else this.log('GAME', `Stage ${stage} completed locally; automation disabled.`, 'offline');
  }
  onMiss(stage) { this.log('GAME', `Stage ${stage} timing miss; no robot event sent.`, 'offline'); }
  enqueue(event) {
    if (this.queue.some(x => x.event.event_id === event.event_id)) return;
    this.queue.push({event, state: 'LOCAL', job_id: null});
    this.save();
    this.log('DETECT', `Player completed stage ${event.stage}; queued locally.`, 'pending');
  }
  save() {
    // Retain unresolved entries and the most recent 100 confirmed events.
    const done = this.queue.filter(x => x.state === 'SUCCESS').slice(-100);
    this.queue = this.queue.filter(x => x.state !== 'SUCCESS').concat(done);
    try { localStorage.setItem(this.key, JSON.stringify(this.queue)); }
    catch (_) { this.log('STORAGE', 'Browser storage unavailable; queue survives only this tab session.', 'failed'); }
    this.text('rpa-pending', this.queue.filter(x => x.state !== 'SUCCESS').length);
  }
  async api(path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const base = window.location.protocol === 'file:' ? 'http://127.0.0.1:8000' : '';
      const response = await fetch(base + path, {...options, signal: controller.signal});
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : `Backend HTTP ${response.status}`);
      return data;
    } finally { clearTimeout(timeout); }
  }
  async checkConnection() {
    if (this.checking) return;
    this.checking = true;
    try {
      const data = await this.api('/api/uipath/status');
      this.text('rpa-connection', data.connected ? 'UIPATH CONNECTED' : 'UIPATH DISCONNECTED');
      this.text('rpa-bot', data.bot_online ? 'BOT ONLINE' : 'BOT OFFLINE');
      document.getElementById('rpa-connection').dataset.state = data.connected ? 'success' : 'offline';
      document.getElementById('rpa-bot').dataset.state = data.bot_online ? 'success' : 'offline';
      this.text('rpa-connection-detail', data.detail);
    } catch (_) {
      this.text('rpa-connection', 'UIPATH DISCONNECTED');
      this.text('rpa-bot', 'BOT OFFLINE');
      this.text('rpa-connection-detail', 'FastAPI unavailable. Gameplay remains local.');
      for (const id of ['rpa-bot', 'rpa-connection']) document.getElementById(id).dataset.state = 'offline';
    } finally { this.checking = false; }
  }
  async pump() {
    if (this.busy) return;
    // One outstanding stage per run; failures in an old run do not block new runs.
    const item = this.queue.find(x => ['LOCAL', 'PENDING'].includes(x.state) &&
      !this.queue.some(y => y.event.run_id === x.event.run_id && y.event.stage < x.event.stage && y.state !== 'SUCCESS'));
    if (!item) return;
    this.busy = true;
    this.text('rpa-task', `${item.event.event} / stage ${item.event.stage}`);
    this.text('rpa-wheel', item.event.wheel_position || '—');
    this.text('rpa-job', item.job_id || '—');
    try {
      const wasLocal = !item.job_id;
      const response = item.job_id ? await this.api('/api/uipath/job/' + item.job_id) :
        await this.api('/api/pitstop/event' + (item.retry ? '?retry=true' : ''), {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(item.event)});
      item.state = response.state;
      item.job_id = response.job_id;
      this.text('rpa-job', item.job_id || '—');
      this.text('rpa-result', response.result || 'Awaiting confirmed robot output');
      if (wasLocal && item.job_id) {
        this.log('ANALYSE', 'Backend accepted event and sequence.', 'pending');
        this.log('EXECUTE', `Orchestrator job ${item.job_id} accepted.`, 'pending');
      }
      if (item.state === 'SUCCESS') this.log('VERIFY', `Job ${item.job_id}: robot confirmed validation and Excel write.`, 'success');
      if (['FAILED', 'RETRYABLE', 'UNKNOWN'].includes(item.state)) {
        this.log('VERIFY', response.result || item.state, 'failed');
      }
      this.status(item.state, item.state === 'SUCCESS' ? 'success' : item.state === 'PENDING' ? 'pending' : 'failed');
    } catch (error) {
      // Retrying the same event ID is safe; backend will not redispatch an uncertain job.
      item.state = item.job_id ? 'PENDING' : 'RETRYABLE';
      this.status('AUTOMATION UNAVAILABLE', 'offline');
      this.text('rpa-result', error.message + ' — retained for retry');
      this.log('NETWORK', 'Request failed; gameplay continues. Use Retry / refresh jobs.', 'offline');
    } finally { this.busy = false; this.save(); }
    if (item.state === 'SUCCESS') this.pump();
  }
  retry() {
    const hasUnknown = this.queue.some(x => x.state === 'UNKNOWN');
    for (const item of this.queue) {
      if (item.state === 'RETRYABLE' || item.state === 'FAILED' || item.state === 'UNKNOWN') {
        item.retry = item.state === 'FAILED'; item.state = 'LOCAL'; item.job_id = null;
      }
    }
    this.save();
    this.checkConnection();
    this.pump();
    if (hasUnknown)
      this.log('REVIEW', 'Unknown jobs require operator review; no automatic duplicate launch. See UiPath README.', 'failed');
  }
  status(label, state) {
    this.text('rpa-execution', label);
    document.getElementById('rpa-execution').dataset.state = state;
  }
  text(id, value) { const el = document.getElementById(id); if (el) el.textContent = value; }
  log(source, message, state = 'offline') {
    this.logs.unshift({source, message, state, time: new Date().toLocaleTimeString()});
    this.logs = this.logs.slice(0, 20);
    const host = document.getElementById('rpa-log-feed');
    if (!host) return;
    host.replaceChildren(...this.logs.map(entry => {
      const line = document.createElement('div');
      line.dataset.state = entry.state;
      line.textContent = `${entry.time} ${entry.source} → ${entry.message}`;
      return line;
    }));
  }
  updateUI() {
    const button = document.getElementById('btn-assist-toggle');
    if (!button) return;
    button.classList.toggle('active', this.game.assistModeEnabled);
    button.setAttribute('aria-pressed', String(this.game.assistModeEnabled));
    button.title = 'Automation Assist: ' + (this.game.assistModeEnabled ? 'ON' : 'OFF') + '. Manual timing required. Changes during a run apply to the next run.';
  }
}
window.RPAEngine = RPAEngine;
