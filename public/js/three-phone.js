// Procedural 3D iPhone + orbiting paluwagan coins (Three.js)
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const W = 1.5, H = 3.1, D = 0.17, R = 0.24;

function roundedRectShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function planeFromShape(w, h, r) {
  const g = new THREE.ShapeGeometry(roundedRectShape(w, h, r), 12);
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 0.5);
  uv.needsUpdate = true;
  return g;
}

function shadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(22,19,15,0.45)');
  gr.addColorStop(1, 'rgba(22,19,15,0)');
  x.fillStyle = gr;
  x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function drawScreen(canvas, o = {}) {
  const c = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const accent = o.accent || '#FF4F1A';
  const bg = c.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#1d1a16');
  bg.addColorStop(1, '#0c0b09');
  c.fillStyle = bg;
  c.fillRect(0, 0, w, h);
  // orange glow
  const glow = c.createRadialGradient(w * 0.8, h * 0.2, 10, w * 0.8, h * 0.2, w);
  glow.addColorStop(0, accent + '88');
  glow.addColorStop(1, 'transparent');
  c.fillStyle = glow;
  c.fillRect(0, 0, w, h);
  // island
  c.fillStyle = '#000';
  c.beginPath();
  c.roundRect(w / 2 - 70, 26, 140, 40, 20);
  c.fill();
  // status
  c.fillStyle = '#f3eee3';
  c.font = '600 26px "Bricolage Grotesque", sans-serif';
  c.fillText('9:41', 48, 56);
  c.fillRect(w - 92, 40, 40, 18);
  c.font = '400 22px "JetBrains Mono", monospace';
  c.fillStyle = '#f3eee3aa';
  c.fillText((o.kicker || 'PALUWAGAN').toUpperCase(), 48, 170);
  c.fillStyle = '#f3eee3';
  c.font = 'italic 400 92px "Instrument Serif", serif';
  wrap(c, o.title || 'PaluPhone', 48, 270, w - 96, 88);
  c.font = '400 26px "JetBrains Mono", monospace';
  c.fillStyle = accent;
  c.fillText(o.sub || 'every end of month', 48, 470);
  // ring of dots
  const n = o.slots || 12, filled = o.filled ?? 0;
  const cx = w / 2, cy = h * 0.7, rr = w * 0.3;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    c.beginPath();
    c.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 14, 0, Math.PI * 2);
    c.fillStyle = i < filled ? '#E9B949' : '#f3eee322';
    c.fill();
  }
  c.fillStyle = '#f3eee3';
  c.textAlign = 'center';
  c.font = '400 120px "Instrument Serif", serif';
  c.fillText(`${filled}`, cx, cy + 30);
  c.font = '400 22px "JetBrains Mono", monospace';
  c.fillStyle = '#f3eee399';
  c.fillText(`OF ${n}`, cx, cy + 70);
  c.textAlign = 'left';
  // home bar
  c.fillStyle = '#f3eee3aa';
  c.beginPath();
  c.roundRect(w / 2 - 80, h - 34, 160, 8, 4);
  c.fill();
}

function wrap(c, text, x, y, maxW, lh) {
  const words = String(text).split(' ');
  let line = '';
  let lines = 0;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (c.measureText(test).width > maxW && line) {
      c.fillText(line, x, y);
      line = word;
      y += lh;
      if (++lines >= 2) break;
    } else line = test;
  }
  if (lines < 2) c.fillText(line, x, y);
}

export function webglOK() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

export class PhoneScene {
  constructor(el, opts = {}) {
    this.el = el;
    this.o = Object.assign({ color: '#2b2b2e', pro: false, coins: 12, filled: 0, interactive: true, intro: true, cameraZ: 8.2, coinRadius: 2.45, screen: {}, offsetX: 0 }, opts);
    this.disposed = false;
    this.t0 = performance.now();
    this.pointer = { x: 0, y: 0 };
    this.spin = 0;
    this.spinVel = 0;
    this.burstT = -1;
    this.hovered = -1;
    if (!webglOK()) {
      el.classList.add('no-webgl');
      return;
    }
    try {
      this._init();
    } catch (e) {
      console.warn('3D disabled:', e);
      el.classList.add('no-webgl');
      this.renderer = null;
    }
  }

  _init() {
    const el = this.el;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);
    this.renderer = renderer;

    const scene = new THREE.Scene();
    this.scene = scene;
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = this.envTex;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0.2, this.o.cameraZ);
    this.camera = camera;

    const key = new THREE.DirectionalLight(0xfff1dd, 1.6);
    key.position.set(3, 5, 4);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xff7a45, 1.2);
    rim.position.set(-4, 1, -3);
    scene.add(rim);
    scene.add(new THREE.AmbientLight(0xffffff, 0.25));

    // ---- phone ----
    const phone = new THREE.Group();
    this.phone = phone;
    const bodyMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(this.o.color), metalness: 0.75, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.15 });
    this.bodyMat = bodyMat;
    const body = new THREE.Mesh(new RoundedBoxGeometry(W, H, D, 8, R), bodyMat);
    phone.add(body);

    // front bezel + screen
    const bezel = new THREE.Mesh(planeFromShape(W - 0.04, H - 0.04, R - 0.02), new THREE.MeshPhysicalMaterial({ color: 0x050505, roughness: 0.1, metalness: 0, clearcoat: 1 }));
    bezel.position.z = D / 2 + 0.001;
    phone.add(bezel);
    this.screenCanvas = document.createElement('canvas');
    this.screenCanvas.width = 512;
    this.screenCanvas.height = 1060;
    drawScreen(this.screenCanvas, { ...this.o.screen, slots: this.o.coins, filled: this.o.filled });
    this.screenTex = new THREE.CanvasTexture(this.screenCanvas);
    this.screenTex.colorSpace = THREE.SRGBColorSpace;
    this.screenTex.anisotropy = 8;
    const screen = new THREE.Mesh(planeFromShape(W - 0.12, H - 0.12, R - 0.07), new THREE.MeshBasicMaterial({ map: this.screenTex, toneMapped: false }));
    screen.position.z = D / 2 + 0.003;
    phone.add(screen);
    // glass sheen
    const sheen = new THREE.Mesh(planeFromShape(W - 0.04, H - 0.04, R - 0.02), new THREE.MeshPhysicalMaterial({ transparent: true, opacity: 0.08, roughness: 0, metalness: 1, color: 0xffffff }));
    sheen.position.z = D / 2 + 0.006;
    phone.add(sheen);
    // fonts may load after first draw — redraw once ready
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => this.updateScreen());

    // back glass
    const backMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(this.o.color), metalness: 0.2, roughness: 0.45, clearcoat: 1, clearcoatRoughness: 0.3 });
    this.backMat = backMat;
    const back = new THREE.Mesh(planeFromShape(W - 0.05, H - 0.05, R - 0.03), backMat);
    back.position.z = -D / 2 - 0.001;
    back.rotation.y = Math.PI;
    phone.add(back);

    // camera bump
    const bumpSize = this.o.pro ? 0.7 : 0.62;
    const bump = new THREE.Mesh(new RoundedBoxGeometry(bumpSize, bumpSize, 0.06, 4, 0.14), new THREE.MeshPhysicalMaterial({ color: new THREE.Color(this.o.color).multiplyScalar(0.85), metalness: 0.6, roughness: 0.25, clearcoat: 1 }));
    this.bumpMat = bump.material;
    bump.position.set(W / 2 - bumpSize / 2 - 0.1, H / 2 - bumpSize / 2 - 0.1, -D / 2 - 0.03);
    phone.add(bump);
    const lensGeo = new THREE.CylinderGeometry(0.13, 0.14, 0.07, 40);
    const lensMat = new THREE.MeshPhysicalMaterial({ color: 0x0a0a0c, metalness: 0.9, roughness: 0.1, clearcoat: 1 });
    const glassGeo = new THREE.CircleGeometry(0.09, 32);
    const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x1a2440, metalness: 1, roughness: 0.05, iridescence: 1, iridescenceIOR: 1.6 });
    const lensPos = this.o.pro ? [[-0.16, 0.16], [-0.16, -0.16], [0.16, 0]] : [[-0.14, 0.14], [0.14, -0.14]];
    for (const [lx, ly] of lensPos) {
      const lens = new THREE.Mesh(lensGeo, lensMat);
      lens.rotation.x = Math.PI / 2;
      lens.position.set(bump.position.x + lx, bump.position.y + ly, -D / 2 - 0.08);
      phone.add(lens);
      const g = new THREE.Mesh(glassGeo, glassMat);
      g.rotation.y = Math.PI;
      g.position.set(lens.position.x, lens.position.y, -D / 2 - 0.116);
      phone.add(g);
    }
    // side buttons
    const btnMat = bodyMat;
    const btn = (x, y, h) => {
      const m = new THREE.Mesh(new RoundedBoxGeometry(0.04, h, 0.07, 2, 0.015), btnMat);
      m.position.set(x, y, 0);
      phone.add(m);
    };
    btn(W / 2 + 0.01, 0.55, 0.42);
    btn(-W / 2 - 0.01, 0.85, 0.16);
    btn(-W / 2 - 0.01, 0.45, 0.32);
    btn(-W / 2 - 0.01, 0.02, 0.32);

    scene.add(phone);

    // ---- coins ring ----
    this.ring = new THREE.Group();
    this.ring.rotation.x = 1.15;
    this.coinGeo = new THREE.CylinderGeometry(0.21, 0.21, 0.05, 48);
    this.goldMat = new THREE.MeshPhysicalMaterial({ color: 0xe9b949, metalness: 1, roughness: 0.22, clearcoat: 0.6 });
    this.dimMat = new THREE.MeshPhysicalMaterial({ color: 0xcfc6b4, metalness: 0.2, roughness: 0.6, transparent: true, opacity: 0.55 });
    this.hotMat = new THREE.MeshPhysicalMaterial({ color: 0xff4f1a, metalness: 0.6, roughness: 0.3, emissive: 0x551100 });
    this.coins = [];
    this._buildCoins();
    scene.add(this.ring);

    // shadow
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.2), new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = -2.25;
    scene.add(this.shadow);

    phone.position.x = this.o.offsetX;
    this.ring.position.x = this.o.offsetX;
    this.shadow.position.x = this.o.offsetX;

    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2(-10, -10);

    // events
    this._onMove = (e) => {
      const r = el.getBoundingClientRect();
      this.pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      this.pointer.y = ((e.clientY - r.top) / r.height) * 2 - 1;
      this.ndc.set(this.pointer.x, -this.pointer.y);
      if (this.dragging) {
        const dx = e.clientX - this.lastX;
        this.spinVel = dx * 0.012;
        this.spin += dx * 0.012;
        this.lastX = e.clientX;
      }
    };
    this._onDown = (e) => {
      if (!this.o.interactive) return;
      this.dragging = true;
      this.lastX = e.clientX;
      el.setPointerCapture && el.setPointerCapture(e.pointerId);
    };
    this._onUp = () => { this.dragging = false; };
    this._onLeave = () => { this.ndc.set(-10, -10); };
    window.addEventListener('pointermove', this._onMove);
    el.addEventListener('pointerdown', this._onDown);
    window.addEventListener('pointerup', this._onUp);
    el.addEventListener('pointerleave', this._onLeave);

    this._resize = () => {
      const w = el.clientWidth || 300, h = el.clientHeight || 300;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.position.z = this.o.cameraZ * (camera.aspect < 0.8 ? 1.25 : 1);
      camera.updateProjectionMatrix();
    };
    this.ro = new ResizeObserver(this._resize);
    this.ro.observe(el);
    this._resize();

    this.visible = true;
    this.io = new IntersectionObserver(([en]) => { this.visible = en.isIntersecting; });
    this.io.observe(el);

    this._loop = this._loop.bind(this);
    this.raf = requestAnimationFrame(this._loop);
  }

  _buildCoins() {
    for (const c of this.coins) this.ring.remove(c.mesh);
    this.coins = [];
    const n = this.o.coins;
    for (let i = 0; i < n; i++) {
      const mesh = new THREE.Mesh(this.coinGeo, i < this.o.filled ? this.goldMat : this.dimMat);
      const a = (i / n) * Math.PI * 2;
      mesh.userData.index = i;
      mesh.userData.angle = a;
      mesh.position.set(Math.cos(a) * this.o.coinRadius, 0, Math.sin(a) * this.o.coinRadius);
      this.ring.add(mesh);
      this.coins.push({ mesh, a, delay: i * 0.06, scatter: new THREE.Vector3((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 8) });
    }
  }

  setFilled(filled, states) {
    this.o.filled = filled;
    this.states = states || null;
    if (!this.coins) return;
    this.coins.forEach((c, i) => {
      const s = states ? states[i] : i < filled ? 'gold' : 'dim';
      c.mesh.material = s === 'gold' ? this.goldMat : s === 'hot' ? this.hotMat : this.dimMat;
    });
  }

  setColor(hex) {
    if (!this.bodyMat) return;
    this.bodyMat.color.set(hex);
    this.backMat.color.set(hex);
    this.bumpMat.color.set(hex).multiplyScalar(0.85);
  }

  updateScreen(screen) {
    if (!this.screenCanvas) return;
    if (screen) this.o.screen = { ...this.o.screen, ...screen };
    drawScreen(this.screenCanvas, { ...this.o.screen, slots: this.o.coins, filled: this.o.filled });
    this.screenTex.needsUpdate = true;
  }

  burst() {
    this.burstT = performance.now();
    this.spinVel = 0.6;
  }

  _loop(now) {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this._loop);
    if (!this.visible || document.hidden) return;
    const t = (now - this.t0) / 1000;
    const ease = (x) => 1 - Math.pow(1 - Math.min(Math.max(x, 0), 1), 3);
    const intro = this.o.intro ? ease(t / 1.6) : 1;

    // spin physics
    if (!this.dragging) {
      this.spinVel *= 0.94;
      this.spin += this.spinVel;
    }
    const targetY = this.pointer.x * 0.45 + this.spin + Math.sin(t * 0.6) * 0.15;
    const targetX = this.pointer.y * 0.25 + 0.05;
    const p = this.phone;
    const desiredY = targetY - (1 - intro) * Math.PI * 2;
    p.rotation.y += (desiredY - p.rotation.y) * (this.o.intro && t < 1.6 ? 0.2 : 0.08);
    p.rotation.x += (targetX - p.rotation.x) * 0.08;
    p.rotation.z = Math.sin(t * 0.8) * 0.03;
    p.position.y = Math.sin(t * 1.3) * 0.08 + (1 - intro) * -3;
    p.scale.setScalar(0.6 + 0.4 * intro);
    this.shadow.material.opacity = 0.6 + Math.sin(t * 1.3) * -0.15;
    this.shadow.scale.setScalar(1 - Math.sin(t * 1.3) * 0.06);

    // coins
    this.ring.rotation.y = t * 0.25;
    this.ring.rotation.z = Math.sin(t * 0.4) * 0.08;
    const bt = this.burstT > 0 ? (now - this.burstT) / 1000 : -1;
    // hover pick
    let hit = -1;
    if (this.o.onCoin && this.ndc.x > -5) {
      this.raycaster.setFromCamera(this.ndc, this.camera);
      const hits = this.raycaster.intersectObjects(this.coins.map((c) => c.mesh), false);
      if (hits.length) hit = hits[0].object.userData.index;
    }
    if (hit !== this.hovered) {
      this.hovered = hit;
      this.el.style.cursor = hit >= 0 ? 'pointer' : '';
      this.o.onCoin && this.o.onCoin(hit);
    }
    this.coins.forEach((c, i) => {
      const k = this.o.intro ? ease((t - 0.5 - c.delay) / 1.1) : 1;
      const base = new THREE.Vector3(Math.cos(c.a) * this.o.coinRadius, Math.sin(t * 2 + i) * 0.08, Math.sin(c.a) * this.o.coinRadius);
      let pos = c.scatter.clone().lerp(base, k);
      if (bt >= 0 && bt < 1.6) {
        const b = Math.sin((bt / 1.6) * Math.PI);
        pos.multiplyScalar(1 + b * 0.6);
        pos.y += b * Math.sin(i * 1.7) * 1.2;
      }
      c.mesh.position.copy(pos);
      c.mesh.rotation.x = Math.PI / 2 + Math.sin(t + i) * 0.3;
      c.mesh.rotation.z = t * 2 + i;
      const s = (i === this.hovered ? 1.45 : 1) * (0.2 + 0.8 * k);
      c.mesh.scale.lerp(new THREE.Vector3(s, s, s), 0.2);
    });
    if (bt > 1.6) this.burstT = -1;

    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('pointermove', this._onMove);
    window.removeEventListener('pointerup', this._onUp);
    if (this.el) {
      this.el.removeEventListener('pointerdown', this._onDown);
      this.el.removeEventListener('pointerleave', this._onLeave);
    }
    this.ro && this.ro.disconnect();
    this.io && this.io.disconnect();
    if (this.scene) {
      this.scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const ms = Array.isArray(o.material) ? o.material : [o.material];
          ms.forEach((m) => { m.map && m.map.dispose(); m.dispose(); });
        }
      });
    }
    [this.goldMat, this.dimMat, this.hotMat, this.coinGeo].forEach((x) => x && x.dispose());
    this.envTex && this.envTex.dispose();
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss && this.renderer.forceContextLoss();
      this.renderer.domElement.remove();
    }
  }
}
