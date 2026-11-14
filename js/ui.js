/* Componentes de interface: helpers DOM, Card3D, DeckPile, CoinStack, dialogos, roteador. */
(function (root) {
  'use strict';
  const Coup = (root.Coup = root.Coup || {});
  const Catalog = Coup.Catalog;

  // -------------------------------------------------------------- helpers
  function add(el, kid) {
    if (kid == null || kid === false) return;
    if (Array.isArray(kid)) kid.forEach((k) => add(el, k));
    else el.appendChild(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }

  /** h('div', {class:'x', on:{click:fn}, style:{'--a':'1px'}}, filhos...) */
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    if (props) {
      for (const [k, v] of Object.entries(props)) {
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'style') {
          if (typeof v === 'string') el.style.cssText = v;
          else for (const [sk, sv] of Object.entries(v)) {
            if (sk.startsWith('--')) el.style.setProperty(sk, sv);
            else el.style[sk] = sv;
          }
        } else if (k === 'on') {
          for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
        } else if (k === 'value' || k === 'disabled' || k === 'checked') el[k] = v;
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    kids.forEach((k) => add(el, k));
    return el;
  }

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  // Navegadores bloqueiam vibrate() antes do primeiro toque do usuario.
  let userTouched = false;
  if (typeof document !== 'undefined') {
    document.addEventListener('pointerdown', () => { userTouched = true; },
      { capture: true, once: true });
  }
  function haptic(ms) {
    try { if (userTouched && navigator.vibrate) navigator.vibrate(ms); } catch (_) { /* ignora */ }
  }

  // ------------------------------------------------------------ pecas basicas
  function OutlinedText(text, { size = 28, color = '#fff', stroke = 6 } = {}) {
    return h('span', { class: 'otext',
      style: { '--fs': size + 'px', '--tc': color, '--sw': stroke + 'px' } }, text);
  }

  /** Botao "gordinho". variant: green|red|blue|orange|purple|cream. */
  function Btn({ label, icon, variant = '', onClick, disabled = false, small = false }) {
    const b = h('button', {
      type: 'button',
      class: 'btn ' + variant + (small ? ' sm' : ''),
      disabled,
    }, icon ? h('span', { class: 'ico' }, icon) : null, h('span', null, label));
    b.addEventListener('click', () => {
      if (b.disabled) return;
      haptic(12);
      onClick && onClick(b);
    });
    return b;
  }

  function Panel(children, { cls = '' } = {}) {
    return h('div', { class: 'panel ' + cls }, children);
  }

  // -------------------------------------------------------------- Card3D
  function fallbackFace(cardId, w) {
    const c = cardId ? Catalog.card(cardId) : null;
    if (!c) {
      return h('div', { class: 'c3-fallback back' },
        h('div', { class: 'fb-emoji', style: { background: 'var(--gold)' } }, 'C'));
    }
    const light = `color-mix(in srgb, ${c.color} 70%, white)`;
    return h('div', { class: 'c3-fallback', style: { '--fc': c.color, '--fc2': light } },
      OutlinedText(c.name.toUpperCase(), { size: Math.round(w * 0.14), stroke: Math.round(w * 0.04) }),
      h('div', { class: 'fb-emoji' }, c.emoji),
      h('div', { class: 'fb-desc' }, c.description));
  }

  /**
   * Carta com perspectiva 3D real (CSS): vira com animacao, flutua e inclina
   * seguindo o dedo/mouse. Retorna {el, setFaceUp, setCard, setLost}.
   */
  function Card3D({ cardId = null, faceUp = false, width = 150, lost = false,
    floating = true, onTap = null } = {}) {
    let up = faceUp;
    let currentId = cardId;

    const frontFace = h('div', { class: 'c3-face front' });
    const backFace = h('div', { class: 'c3-face back' });
    const stamp = h('div', { class: 'c3-stamp' },
      OutlinedText('PERDIDA', { size: Math.round(width * 0.13), stroke: 4 }));
    stamp.style.display = lost ? '' : 'none';

    function loadImg(face, src, fb) {
      face.innerHTML = '';
      const img = h('img', { src, alt: '', draggable: 'false' });
      img.addEventListener('error', () => {
        face.innerHTML = '';
        face.appendChild(fb());
        if (face === frontFace) face.appendChild(stamp);
      });
      face.appendChild(img);
      if (face === frontFace) face.appendChild(stamp);
    }
    function renderFront() {
      if (currentId) {
        loadImg(frontFace, Catalog.assetPath(currentId), () => fallbackFace(currentId, width));
      } else {
        frontFace.innerHTML = '';
        frontFace.appendChild(fallbackFace(null, width));
      }
    }
    loadImg(backFace, Catalog.backPath, () => fallbackFace(null, width));
    renderFront();

    const flip = h('div', { class: 'c3-flip' }, backFace, frontFace);
    const lift = h('div', { class: 'c3-lift' }, flip);
    const sheen = h('div', { class: 'c3-sheen' });
    const tilt = h('div', { class: 'c3-tilt' }, lift, sheen);
    const float = h('div', { class: 'c3-float' }, tilt);
    const el = h('div', {
      class: 'card3d' + (up ? ' up' : '') + (lost ? ' lost' : '') +
        (floating ? '' : ' nofloat') + (onTap ? '' : ' static'),
      style: { '--cw': width + 'px' },
    }, float);

    // Inclinacao seguindo o ponteiro (mouse ou toque).
    let drag = null;
    let moved = false;
    function reset() {
      el.classList.remove('dragging');
      tilt.style.setProperty('--rx', '0deg');
      tilt.style.setProperty('--ry', '0deg');
      tilt.style.setProperty('--sx', '20%');
      drag = null;
    }
    el.addEventListener('pointerdown', (e) => {
      drag = { x: e.clientX, y: e.clientY };
      moved = false;
      el.classList.add('dragging');
    });
    el.addEventListener('pointermove', (e) => {
      if (!drag) return;
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 8) moved = true;
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
      const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
      tilt.style.setProperty('--ry', clamp(dx * 44, -32, 32) + 'deg');
      tilt.style.setProperty('--rx', clamp(-dy * 44, -32, 32) + 'deg');
      tilt.style.setProperty('--sx', clamp(50 + dx * 160, -20, 120) + '%');
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => el.addEventListener(ev, reset));
    el.addEventListener('click', () => {
      if (moved) { moved = false; return; }
      onTap && onTap();
    });

    function setFaceUp(b) {
      if (b === up) return;
      up = b;
      el.classList.toggle('up', b);
      lift.classList.remove('lifting');
      void lift.offsetWidth; // reinicia a animacao
      lift.classList.add('lifting');
      haptic(8);
    }
    function setCard(id) {
      if (id === currentId) return;
      currentId = id;
      renderFront();
    }
    function setLost(b) {
      el.classList.toggle('lost', b);
      stamp.style.display = b ? '' : 'none';
    }
    return { el, setFaceUp, setCard, setLost, get faceUp() { return up; } };
  }

  // ------------------------------------------------------------ DeckPile
  /** Pilha de cartas deitada, com espessura proporcional a quantidade. */
  function DeckPile({ count = 13, width = 92 } = {}) {
    const scene = h('div', { class: 'deck-scene' });
    const badge = h('div', { class: 'badge' });
    const el = h('div', { class: 'deck', style: { '--cw': width + 'px' } }, scene, badge);
    let shown = -1;

    function render(n, pop) {
      scene.innerHTML = '';
      const layers = clamp(n, 0, 14);
      if (layers === 0) scene.appendChild(h('div', { class: 'deck-empty' }));
      for (let i = 0; i < layers; i++) {
        const top = i === layers - 1;
        const l = h('div', { class: 'deck-layer' + (top ? ' top' : ''), style: { '--i': i } },
          h('img', { src: Catalog.backPath, alt: '', draggable: 'false' }));
        scene.appendChild(l);
        if (top && pop) l.classList.add('pop');
      }
      badge.textContent = n;
    }
    function setCount(n) {
      if (n === shown) return;
      render(n, shown !== -1);
      shown = n;
    }
    el.addEventListener('click', () => { haptic(8); render(shown, true); });
    setCount(count);
    return { el, setCount };
  }

  // ------------------------------------------------------------ CoinStack
  function bounceOut(t) {
    if (t < 1 / 2.75) return 7.5625 * t * t;
    if (t < 2 / 2.75) { t -= 1.5 / 2.75; return 7.5625 * t * t + 0.75; }
    if (t < 2.5 / 2.75) { t -= 2.25 / 2.75; return 7.5625 * t * t + 0.9375; }
    t -= 2.625 / 2.75;
    return 7.5625 * t * t + 0.984375;
  }

  const INK = '#1b1033';
  const GOLD = '#ffc93c';
  const GOLD_D = '#e09a00';

  function drawCoin(ctx, cx, cy, w, hgt, thick) {
    const rx = w / 2, ry = hgt / 2;
    // corpo (lateral) do cilindro
    ctx.beginPath();
    ctx.moveTo(cx - rx, cy);
    ctx.lineTo(cx - rx, cy + thick);
    ctx.ellipse(cx, cy + thick, rx, ry, 0, Math.PI, 0, true);
    ctx.lineTo(cx + rx, cy);
    ctx.closePath();
    ctx.fillStyle = GOLD_D;
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = INK;
    ctx.stroke();
    // serrilha
    ctx.strokeStyle = 'rgba(27,16,51,.28)';
    ctx.lineWidth = 1.2;
    for (let k = 1; k < 6; k++) {
      const x = cx - rx + (w * k) / 6;
      const t = 1 - Math.pow((x - cx) / rx, 2);
      const yy = cy + ry * Math.sqrt(Math.max(0, t));
      ctx.beginPath();
      ctx.moveTo(x, yy);
      ctx.lineTo(x, yy + thick);
      ctx.stroke();
    }
    // topo
    const g = ctx.createRadialGradient(cx - rx * 0.3, cy - ry * 0.4, 1, cx, cy, rx);
    g.addColorStop(0, '#ffe27a');
    g.addColorStop(1, GOLD);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = INK;
    ctx.stroke();
    // aro interno
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.68, ry * 0.68, 0, 0, Math.PI * 2);
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = GOLD_D;
    ctx.stroke();
  }

  function paintCoins(ctx, W, H, count, dropT, dropping) {
    ctx.clearRect(0, 0, W, H);
    if (count <= 0) return;
    const perStack = 5, maxStacks = 5;
    const shown = Math.min(count, perStack * maxStacks);
    const stacks = Math.ceil(shown / perStack);
    const coinW = W / (Math.max(stacks, 3) + 0.4);
    const coinH = coinW * 0.4;
    const thick = coinW * 0.2;
    const totalW = stacks * coinW + (stacks - 1) * coinW * 0.08;
    const startX = (W - totalW) / 2;
    const baseY = H - coinH / 2 - thick - 4;
    let placed = 0;
    for (let s = 0; s < stacks; s++) {
      const inStack = Math.min(perStack, shown - s * perStack);
      const cx = startX + s * coinW * 1.08 + coinW / 2;
      const jitter = (s % 2 ? -1 : 1) * coinH * 0.12;
      for (let i = 0; i < inStack; i++) {
        placed++;
        let cy = baseY - i * thick + jitter;
        if (placed === shown && dropping) cy -= (1 - dropT) * H * 0.9;
        drawCoin(ctx, cx + (i % 2 ? 1.2 : -1.2), cy, coinW, coinH, thick);
      }
    }
  }

  /** Pilhas de moedas 3D (canvas). Cai uma moeda ao ganhar; balanca ao perder. */
  function CoinStack({ count = 0, width = 220 } = {}) {
    const W = width, H = Math.round(width * 0.5);
    const canvas = h('canvas');
    const el = h('div', { class: 'coins', style: { width: W + 'px', height: H + 'px' } }, canvas);
    const dpr = Math.min(2, root.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    let cur = count;
    let raf = 0;

    function draw(dropT, dropping) { paintCoins(ctx, W, H, cur, dropT, dropping); }
    function setCount(n) {
      if (n === cur) return;
      const grew = n > cur;
      cur = n;
      cancelAnimationFrame(raf);
      if (grew) {
        haptic(15);
        const t0 = performance.now();
        const step = (now) => {
          const t = Math.min(1, (now - t0) / 750);
          draw(bounceOut(t), t < 1);
          if (t < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
      } else {
        haptic(8);
        draw(1, false);
        el.classList.remove('shake');
        void el.offsetWidth;
        el.classList.add('shake');
      }
    }
    draw(1, false);
    return { el, setCount, get count() { return cur; } };
  }

  // ---------------------------------------------------- dialogo / folha / toast
  function dialog({ title, text, buttons }) {
    return new Promise((resolve) => {
      const close = (v) => { m.remove(); resolve(v); };
      const m = h('div', { class: 'modal' },
        h('div', { class: 'panel' },
          title ? h('h3', null, title) : null,
          text ? h('p', null, text) : null,
          h('div', { class: 'btns' }, buttons.map((b) =>
            Btn({ label: b.label, variant: b.variant || 'cream', small: true,
              onClick: () => close(b.value) })))));
      document.body.appendChild(m);
    });
  }

  /** Folha inferior. Retorna a funcao que fecha. */
  function openSheet(content) {
    const bg = h('div', { class: 'sheet-bg' }, h('div', { class: 'sheet' }, content));
    const close = () => bg.remove();
    bg.addEventListener('click', (e) => { if (e.target === bg) close(); });
    document.body.appendChild(bg);
    return close;
  }

  function toast(msg) {
    let box = document.getElementById('toasts');
    if (!box) {
      box = h('div', { id: 'toasts' });
      document.body.appendChild(box);
    }
    const t = h('div', { class: 'toast' }, msg);
    box.appendChild(t);
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3000);
  }

  // --------------------------------------------------------------- Router
  /**
   * Pilha de telas com integracao ao botao Voltar do navegador/Android.
   * tela = { el, onBack?() => true se tratou (bloqueia), onShow?(result) }
   */
  const Router = {
    stack: [],
    host: null,
    _programmatic: false,
    _pendingResult: undefined,

    init(host) {
      this.host = host;
      try { history.replaceState({ coup: 0 }, ''); } catch (_) { /* file:// restrito */ }
      root.addEventListener('popstate', () => this._onPop());
    },

    get top() { return this.stack[this.stack.length - 1]; },

    /** Define a primeira tela (sem entrada de historico). */
    setRoot(screen) {
      this.host.appendChild(screen.el);
      this.stack = [screen];
      this._show(screen, false);
    },

    _show(screen, animate) {
      this.stack.forEach((s) => { s.el.hidden = s !== screen; });
      screen.el.hidden = false;
      if (animate) {
        screen.el.classList.remove('enter');
        void screen.el.offsetWidth;
        screen.el.classList.add('enter');
      }
    },

    push(screen, onResult) {
      screen.onResult = onResult;
      this.host.appendChild(screen.el);
      this.stack.push(screen);
      this._show(screen, true);
      try { history.pushState({ coup: this.stack.length - 1 }, ''); } catch (_) { /* ignora */ }
    },

    /** Substitui a tela do topo (sem criar nova entrada no historico). */
    replace(screen) {
      const old = this.stack.pop();
      if (old) { old.el.remove(); if (old.onDestroy) old.onDestroy(); }
      this.host.appendChild(screen.el);
      this.stack.push(screen);
      this._show(screen, true);
    },

    /** Fecha a tela do topo; `result` e entregue a quem a abriu. */
    pop(result) {
      if (this.stack.length <= 1) return;
      this._pendingResult = result;
      this._programmatic = true;
      try { history.back(); } catch (_) { this._doPop(); }
      // Se o navegador nao emitir popstate (ex.: sem historico), garante o fechamento.
      setTimeout(() => { if (this._programmatic) this._onPop(); }, 250);
    },
    back() { this.pop(undefined); },

    _onPop() {
      if (this._programmatic) {
        this._programmatic = false;
        const r = this._pendingResult;
        this._pendingResult = undefined;
        this._doPop(r);
        return;
      }
      const top = this.top;
      if (this.stack.length > 1 && top && top.onBack && top.onBack()) {
        // tratado (ex.: fluxo em andamento): repoe a entrada de historico
        try { history.pushState({ coup: this.stack.length - 1 }, ''); } catch (_) { /* ignora */ }
        return;
      }
      this._doPop(undefined);
    },

    _doPop(result) {
      if (this.stack.length <= 1) return;
      const old = this.stack.pop();
      const cb = old.onResult;
      old.el.remove();
      if (old.onDestroy) old.onDestroy();
      const now = this.top;
      this._show(now, false);
      now.el.classList.remove('enter');
      if (now.onShow) now.onShow();
      if (cb) cb(result);
    },
  };

  Object.assign(Coup, { h, OutlinedText, Btn, Panel, Card3D, DeckPile, CoinStack,
    dialog, openSheet, toast, Router, haptic, clamp });
})(typeof window !== 'undefined' ? window : globalThis);
