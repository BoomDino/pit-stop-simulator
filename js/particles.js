/**
 * RPA PIT STOP - High Performance Canvas Particle Engine
 * Manages wheel nut sparks, burnout tire smoke, shockwave rings, and victory confetti
 */

class ParticleEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.shockwaves = [];
    this.confetti = [];
    this.running = false;
    this.resize();

    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    if (!this.canvas) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
  }

  start() {
    if (!this.running) {
      this.running = true;
      this.loop = this.loop.bind(this);
      requestAnimationFrame(this.loop);
    }
  }

  // 1. Wheel Nut Sparks
  spawnSparks(x, y, count = 28) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 6;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        decay: 0.025 + Math.random() * 0.03,
        size: 1.5 + Math.random() * 2.5,
        color: Math.random() > 0.3 ? '#ffe033' : '#ff4400'
      });
    }
  }

  // 2. Shockwave Pulse on Hit
  spawnShockwave(x, y, color = '#00ff88', maxRadius = 90) {
    this.shockwaves.push({
      x,
      y,
      radius: 10,
      maxRadius,
      color,
      alpha: 1.0,
      width: 4
    });
  }

  // 3. Burnout Tire Smoke
  spawnBurnoutSmoke(x, y, count = 12) {
    for (let i = 0; i < count; i++) {
      const angle = Math.PI / 2 + (Math.random() - 0.5) * 1.2; // Puffing downwards/backwards
      const speed = 1 + Math.random() * 4;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 10,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        decay: 0.012 + Math.random() * 0.015,
        size: 8 + Math.random() * 16,
        grow: 0.8,
        color: 'rgba(230, 230, 240, 0.5)',
        isSmoke: true
      });
    }
  }

  // 4. Jammed Wrench Red Fault Glitch
  spawnFaultSparks(x, y, count = 20) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 4;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        decay: 0.03 + Math.random() * 0.03,
        size: 2 + Math.random() * 2,
        color: '#ff2244'
      });
    }
    this.spawnShockwave(x, y, '#ff2244', 60);
  }

  // 5. Victory Confetti
  spawnConfetti(count = 70) {
    const colors = ['#00ff88', '#00d0ff', '#ff3344', '#ffe033', '#ffffff'];
    for (let i = 0; i < count; i++) {
      this.confetti.push({
        x: Math.random() * this.canvas.width,
        y: -10 - Math.random() * 50,
        vx: (Math.random() - 0.5) * 3,
        vy: 2 + Math.random() * 4,
        rot: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 10,
        w: 6 + Math.random() * 6,
        h: 4 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        life: 1.0,
        decay: 0.005 + Math.random() * 0.005
      });
    }
  }

  loop() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Render & update shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const s = this.shockwaves[i];
      s.radius += (s.maxRadius - s.radius) * 0.15 + 1.5;
      s.alpha -= 0.035;
      if (s.alpha <= 0 || s.radius >= s.maxRadius) {
        this.shockwaves.splice(i, 1);
        continue;
      }
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      this.ctx.strokeStyle = s.color;
      this.ctx.lineWidth = s.width;
      this.ctx.globalAlpha = Math.max(0, s.alpha);
      this.ctx.shadowColor = s.color;
      this.ctx.shadowBlur = 10;
      this.ctx.stroke();
      this.ctx.restore();
    }

    // Render & update particles (sparks, smoke)
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;

      if (p.isSmoke) {
        p.size += p.grow || 0.4;
        p.vx *= 0.98;
        p.vy *= 0.98;
      } else {
        p.vy += 0.12; // Gravity on sparks
        p.vx *= 0.96;
      }

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.beginPath();
      if (p.isSmoke) {
        this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        this.ctx.fillStyle = `rgba(220, 225, 235, ${p.life * 0.4})`;
        this.ctx.fill();
      } else {
        this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        this.ctx.fillStyle = p.color;
        this.ctx.globalAlpha = p.life;
        this.ctx.shadowColor = p.color;
        this.ctx.shadowBlur = 8;
        this.ctx.fill();
      }
      this.ctx.restore();
    }

    // Render & update confetti
    for (let i = this.confetti.length - 1; i >= 0; i--) {
      const c = this.confetti[i];
      c.x += c.vx;
      c.y += c.vy;
      c.rot += c.vRot;
      c.life -= c.decay;

      if (c.life <= 0 || c.y > this.canvas.height + 20) {
        this.confetti.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.translate(c.x, c.y);
      this.ctx.rotate((c.rot * Math.PI) / 180);
      this.ctx.fillStyle = c.color;
      this.ctx.globalAlpha = c.life;
      this.ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
      this.ctx.restore();
    }

    requestAnimationFrame(this.loop);
  }
}

window.ParticleEngine = ParticleEngine;
