/**
 * RPA PIT STOP - Hybrid Backend & LocalStorage Leaderboard Manager
 * Seamlessly syncs with backend REST API (/api/leaderboard) when available,
 * while maintaining instant offline fallback to localStorage.
 */

class LeaderboardManager {
  constructor() {
    this.storageKey = 'rpa_pitstop_leaderboard_v1';
    this.apiEndpoint = '/api/leaderboard';
    this.defaultSeed = [
      { name: 'BOT-TITAN (RPA Alpha)', time: 15420, accuracy: 100, perfectHits: 6, date: '2026-10-25' },
      { name: 'Max V. (Red Bull Sim)', time: 17850, accuracy: 92, perfectHits: 5, date: '2026-10-26' },
      { name: 'Lando Wrench (McLaren)', time: 19940, accuracy: 88, perfectHits: 4, date: '2026-10-28' },
      { name: 'Cyber Mech #44', time: 23150, accuracy: 83, perfectHits: 3, date: '2026-10-29' },
      { name: 'Pit Academy Rookie', time: 31200, accuracy: 71, perfectHits: 2, date: '2026-10-30' }
    ];

    // Initial background sync with backend API if on HTTP/S
    if (window.location.protocol.startsWith('http')) {
      this.fetchFromBackend();
    }
  }

  async fetchFromBackend() {
    try {
      const res = await fetch(this.apiEndpoint);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          this.saveEntries(data);
          return data;
        }
      }
    } catch (e) {
      // Offline or file protocol, fallback silently to localStorage
    }
    return this.getEntries();
  }

  getEntries() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (!data) {
        this.saveEntries(this.defaultSeed);
        return [...this.defaultSeed];
      }
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [...this.defaultSeed];
    } catch (e) {
      console.warn('Failed to read leaderboard from localStorage:', e);
      return [...this.defaultSeed];
    }
  }

  saveEntries(entries) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(entries));
    } catch (e) {
      console.warn('Failed to save leaderboard to localStorage:', e);
    }
  }

  async addEntry({ name, time, accuracy, perfectHits }) {
    const cleanName = (name || 'Anonymous Racer').trim().slice(0, 20);
    const dateStr = new Date().toISOString().split('T')[0];

    const newScore = {
      name: cleanName,
      time: Math.round(time),
      accuracy: Math.round(accuracy),
      perfectHits: Math.min(6, Math.max(0, perfectHits)),
      date: dateStr
    };

    // 1. Save locally immediately
    const entries = this.getEntries();
    entries.push(newScore);
    entries.sort((a, b) => a.time - b.time);
    const trimmed = entries.slice(0, 30);
    this.saveEntries(trimmed);

    // 2. Post to backend REST API if available
    if (window.location.protocol.startsWith('http')) {
      try {
        await fetch(this.apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newScore)
        });
      } catch (err) {
        console.warn('Could not sync score to backend server:', err);
      }
    }

    return trimmed;
  }

  isPersonalBest(time) {
    const entries = this.getEntries();
    if (entries.length === 0) return true;
    return time < entries[0].time;
  }

  getBestTime() {
    const entries = this.getEntries();
    return entries.length > 0 ? entries[0].time : null;
  }

  formatTime(ms) {
    if (ms == null) return '--:--.---';
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    const mill = Math.floor(ms % 1000);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(mill).padStart(3, '0')}`;
  }

  renderToTable(containerElement) {
    if (!containerElement) return;
    const entries = this.getEntries();

    if (entries.length === 0) {
      containerElement.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 20px;">No records yet! Be the first to set a time.</td></tr>`;
      return;
    }

    containerElement.innerHTML = entries
      .map((entry, idx) => {
        let rankBadge = `${idx + 1}`;
        let rowClass = '';
        if (idx === 0) {
          rankBadge = '🥇 1';
          rowClass = 'rank-gold';
        } else if (idx === 1) {
          rankBadge = '🥈 2';
          rowClass = 'rank-silver';
        } else if (idx === 2) {
          rankBadge = '🥉 3';
          rowClass = 'rank-bronze';
        }

        return `
        <tr class="${rowClass}">
          <td class="col-rank">${rankBadge}</td>
          <td class="col-name"><strong>${this.escapeHtml(entry.name)}</strong></td>
          <td class="col-time"><span class="time-badge">${this.formatTime(entry.time)}</span></td>
          <td class="col-acc">${entry.accuracy}%</td>
          <td class="col-perf"><span class="perf-star">★</span> ${entry.perfectHits}/6</td>
          <td class="col-date">${entry.date}</td>
        </tr>
      `;
      })
      .join('');
  }

  renderToCompactTable(containerElement) {
    if (!containerElement) return;
    const entries = this.getEntries();

    const displayList = entries.length > 0 ? entries.slice(0, 5) : [
      { name: 'Student', time: 13300 },
      { name: 'Somen', time: 14850 },
      { name: 'Stadems', time: 16200 },
      { name: 'RPA Alpha', time: 17400 },
      { name: 'Cyber Cadet', time: 19100 }
    ];

    containerElement.innerHTML = displayList
      .map((entry, idx) => {
        let rankBadge = `${idx + 1}`;
        let rowClass = '';
        if (idx === 0) { rankBadge = '🥇'; rowClass = 'top-1'; }
        else if (idx === 1) { rankBadge = '🥈'; rowClass = 'top-2'; }
        else if (idx === 2) { rankBadge = '🥉'; rowClass = 'top-3'; }

        const initial = (entry.name || 'S').charAt(0).toUpperCase();

        return `
          <tr class="${rowClass}">
            <td style="width:24px; text-align:center;">${rankBadge}</td>
            <td>
              <span class="student-avatar">${initial}</span>
              <strong>${this.escapeHtml(entry.name)}</strong>
            </td>
            <td class="lb-time-badge" style="text-align:right;">${this.formatTime(entry.time)}</td>
          </tr>
        `;
      })
      .join('');
  }

  escapeHtml(str) {
    return str.replace(/[&<>'"]/g, (tag) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  }

  clearAll() {
    try {
      localStorage.removeItem(this.storageKey);
      this.saveEntries(this.defaultSeed);
      if (window.location.protocol.startsWith('http')) {
        fetch(this.apiEndpoint, { method: 'DELETE' }).catch(err => console.warn(err));
      }
    } catch (e) {
      console.warn(e);
    }
  }
}

window.leaderboardManager = new LeaderboardManager();
