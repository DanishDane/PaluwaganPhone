// "Piso" — the interactive coin mascot
import { sfx } from './sound.js';

const MOUTHS = {
  happy: 'M47 79 Q60 92 73 79',
  grin: 'M46 77 Q60 96 74 77 Z',
  wow: 'M54 82 a6 7 0 1 0 12 0 a6 7 0 1 0 -12 0',
  worried: 'M48 86 Q54 80 60 83 Q66 80 72 86',
  sad: 'M48 87 Q60 76 72 87',
  sleepy: 'M53 83 L67 83',
  talk: 'M50 79 Q60 90 70 79 Q60 84 50 79',
};

const svg = `
<svg viewBox="0 0 120 150" class="piso-svg" aria-hidden="true">
  <ellipse class="p-shadow" cx="60" cy="142" rx="28" ry="5"/>
  <g class="p-bob">
    <g class="p-legs">
      <path d="M48 104 L46 124" /><path d="M72 104 L74 124" />
      <ellipse cx="44" cy="126" rx="8" ry="4.5" class="p-shoe"/><ellipse cx="76" cy="126" rx="8" ry="4.5" class="p-shoe"/>
    </g>
    <g class="p-arm p-arm-l"><path d="M16 70 Q2 60 6 46" /><circle cx="6" cy="44" r="5" class="p-hand"/></g>
    <g class="p-arm p-arm-r"><path d="M104 70 Q118 80 114 92" /><circle cx="114" cy="94" r="5" class="p-hand"/></g>
    <circle cx="60" cy="62" r="47" class="p-coin"/>
    <circle cx="60" cy="62" r="39" class="p-ridge"/>
    <path d="M30 40 Q38 24 56 20" class="p-shine"/>
    <text x="60" y="38" class="p-peso">₱</text>
    <g class="p-eye" transform="translate(45 60)"><g class="p-lid"><ellipse rx="8.5" ry="10.5" class="p-white"/><circle class="p-pupil" r="4.6"/><circle class="p-glint" cx="1.5" cy="-2.5" r="1.4"/></g></g>
    <g class="p-eye" transform="translate(75 60)"><g class="p-lid"><ellipse rx="8.5" ry="10.5" class="p-white"/><circle class="p-pupil" r="4.6"/><circle class="p-glint" cx="1.5" cy="-2.5" r="1.4"/></g></g>
    <ellipse cx="33" cy="76" rx="6" ry="3.5" class="p-blush"/>
    <ellipse cx="87" cy="76" rx="6" ry="3.5" class="p-blush"/>
    <path class="p-mouth" d="${MOUTHS.happy}"/>
    <g class="p-sweat"><path d="M100 36 Q104 44 100 48 Q96 44 100 36Z"/></g>
  </g>
  <g class="p-zzz"><text x="96" y="20">z</text><text x="106" y="8">z</text></g>
</svg>`;

class Piso {
  mount(root) {
    this.root = root;
    root.innerHTML = `
      <div class="piso" data-mood="happy" data-nosfx>
        <div class="piso-bubble" role="status"><button class="piso-x" aria-label="Close">×</button><div class="piso-txt"></div><div class="piso-actions"></div></div>
        <button class="piso-body" aria-label="Piso the mascot — click me">${svg}</button>
      </div>`;
    this.el = root.querySelector('.piso');
    this.body = root.querySelector('.piso-body');
    this.bubble = root.querySelector('.piso-bubble');
    this.txt = root.querySelector('.piso-txt');
    this.actions = root.querySelector('.piso-actions');
    this.mouth = root.querySelector('.p-mouth');
    this.pupils = [...root.querySelectorAll('.p-pupil')];
    this.tips = [];
    this.tipIndex = 0;
    this.clicks = [];
    this.lastActivity = Date.now();

    const saved = JSON.parse(localStorage.getItem('palu.piso.pos') || 'null');
    if (saved) this._place(saved.x, saved.y);

    root.querySelector('.piso-x').addEventListener('click', (e) => { e.stopPropagation(); this.hide(); sfx.close(); });

    // eyes follow pointer
    window.addEventListener('pointermove', (e) => {
      this._wake();
      const r = this.body.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height * 0.4;
      const a = Math.atan2(e.clientY - cy, e.clientX - cx);
      const d = Math.min(1, Math.hypot(e.clientX - cx, e.clientY - cy) / 300);
      const ox = Math.cos(a) * 3.6 * d, oy = Math.sin(a) * 4.6 * d;
      this.pupils.forEach((p) => p.setAttribute('transform', `translate(${ox.toFixed(2)} ${oy.toFixed(2)})`));
    });
    window.addEventListener('keydown', () => this._wake());

    // drag or click
    let start = null;
    this.body.addEventListener('pointerdown', (e) => {
      sfx.unlock();
      const r = this.el.getBoundingClientRect();
      start = { x: e.clientX, y: e.clientY, ox: r.left, oy: r.top, moved: false };
      this.body.setPointerCapture(e.pointerId);
    });
    this.body.addEventListener('pointermove', (e) => {
      if (!start) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (!start.moved && Math.hypot(dx, dy) > 6) { start.moved = true; this.el.classList.add('dragging'); this.mood('wow'); sfx.boop(); }
      if (start.moved) this._place(start.ox + dx, start.oy + dy);
    });
    this.body.addEventListener('pointerup', () => {
      if (!start) return;
      if (start.moved) {
        this.el.classList.remove('dragging');
        const r = this.el.getBoundingClientRect();
        localStorage.setItem('palu.piso.pos', JSON.stringify({ x: r.left, y: r.top }));
        this.mood('happy');
        this.say(pick(['Wheee! Bagong pwesto!', 'Nice view from here.', 'Okay, dito na lang ako.']), { mood: 'grin', duration: 2200 });
      } else this._clicked();
      start = null;
    });

    // idle → sleepy
    this.idleTimer = setInterval(() => {
      if (Date.now() - this.lastActivity > 50000 && !this.sleeping) {
        this.sleeping = true;
        this.el.classList.add('sleeping');
        this.mood('sleepy');
        this.hide();
      }
    }, 5000);

    // blink
    const blink = () => {
      this.el.classList.add('blink');
      setTimeout(() => this.el.classList.remove('blink'), 140);
      this.blinkT = setTimeout(blink, 2200 + Math.random() * 3500);
    };
    this.blinkT = setTimeout(blink, 2000);

    window.addEventListener('resize', () => {
      const r = this.el.getBoundingClientRect();
      if (this.el.style.left) this._place(r.left, r.top);
    });
  }

  _place(x, y) {
    const w = 110, h = 140;
    x = Math.max(4, Math.min(window.innerWidth - w, x));
    y = Math.max(4, Math.min(window.innerHeight - h, y));
    Object.assign(this.el.style, { left: x + 'px', top: y + 'px', right: 'auto', bottom: 'auto' });
    this.el.classList.toggle('bubble-right', x < window.innerWidth / 2);
    this.el.classList.toggle('bubble-below', y < 220);
  }

  _wake() {
    this.lastActivity = Date.now();
    if (this.sleeping) {
      this.sleeping = false;
      this.el.classList.remove('sleeping');
      this.mood('wow');
      setTimeout(() => this.mood('happy'), 700);
    }
  }

  _clicked() {
    this._wake();
    const n = Date.now();
    this.clicks = this.clicks.filter((t) => n - t < 1500).concat(n);
    this.jump();
    sfx.boop();
    if (this.clicks.length >= 5) {
      this.clicks = [];
      this.el.classList.add('dizzy');
      setTimeout(() => this.el.classList.remove('dizzy'), 1200);
      this.say(pick(['Hala, nahihilo na ako! 😵', 'Hey, that tickles!', 'Easy lang po, boss!']), { mood: 'wow', duration: 2500 });
      return;
    }
    if (this.tips.length) {
      const t = this.tips[this.tipIndex % this.tips.length];
      this.tipIndex++;
      this.say(t.text || t, { mood: t.mood || 'happy', actions: t.actions });
    } else this.say(pick(['Hi! I\'m Piso, your paluwagan buddy.', 'Click me anytime for tips!', 'Hulog today, iPhone tomorrow!']));
  }

  setTips(tips) {
    this.tips = tips || [];
    this.tipIndex = 0;
  }

  mood(m) {
    this.el.dataset.mood = m;
    this.mouth.setAttribute('d', MOUTHS[m] || MOUTHS.happy);
  }

  jump() {
    this.el.classList.remove('jump');
    void this.el.offsetWidth;
    this.el.classList.add('jump');
  }

  celebrate(text) {
    this.el.classList.remove('party');
    void this.el.offsetWidth;
    this.el.classList.add('party');
    setTimeout(() => this.el.classList.remove('party'), 1400);
    this.say(text || pick(['Ayun! Bayad na! 🎉', 'Ka-ching! Recorded!', 'Isa pang hulog, palapit na sa iPhone!']), { mood: 'grin', duration: 3200 });
  }

  worry(text) {
    this.say(text, { mood: 'worried', duration: 3800 });
    this.el.classList.add('shake');
    setTimeout(() => this.el.classList.remove('shake'), 500);
  }

  say(text, { mood = 'happy', duration, actions } = {}) {
    if (!this.el) return;
    this._wake();
    clearTimeout(this.hideT);
    clearInterval(this.typeT);
    this.mood('talk');
    this.el.classList.add('talking');
    this.bubble.classList.add('show');
    this.txt.textContent = '';
    this.actions.innerHTML = '';
    const chars = [...text];
    let i = 0;
    this.typeT = setInterval(() => {
      if (i >= chars.length) {
        clearInterval(this.typeT);
        this.mood(mood);
        this.el.classList.remove('talking');
        if (actions && actions.length) {
          for (const a of actions) {
            const b = document.createElement('button');
            b.className = 'piso-act';
            b.textContent = a.label;
            b.addEventListener('click', () => { a.onClick(); this.hide(); });
            this.actions.appendChild(b);
          }
        }
        this.hideT = setTimeout(() => this.hide(), duration || Math.max(3500, chars.length * 70) + (actions ? 4000 : 0));
        return;
      }
      this.txt.textContent += chars[i];
      if (chars[i] !== ' ' && i % 2 === 0) sfx.blip(i);
      if (i % 3 === 0) this.mouth.setAttribute('d', i % 6 === 0 ? MOUTHS.wow : MOUTHS.talk);
      i++;
    }, 28);
  }

  hide() {
    if (!this.bubble) return;
    clearInterval(this.typeT);
    this.bubble.classList.remove('show');
    this.el.classList.remove('talking');
    if (!this.sleeping) this.mood(this.el.dataset.mood === 'talk' ? 'happy' : this.el.dataset.mood);
  }

  show(on = true) {
    if (this.el) this.el.style.display = on ? '' : 'none';
  }
}

const pick = (a) => a[Math.floor(Math.random() * a.length)];
export const piso = new Piso();

