(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const video = $('video');
  const canvas = $('fx');
  const ctx = canvas.getContext('2d');
  const arena = $('arena');
  const shaker = $('shaker');
  const TRACK = window.BUTT_TRACK;

  const VIDEO_ASPECT = 720 / 540; // height / width
  const DECK = 0.26;              // gun deck height as a fraction of width
  const MAX_AMMO = 100;
  const FIRE_INTERVAL = 105;      // ms between machine-gun rounds
  const FONT = '"Bangers", "Hind Siliguri", Impact, sans-serif';

  const TIERS = [
    { d: 0.33, pts: 100, label: 'PERFECT!', color: '#ffd23f', perfect: true },
    { d: 0.66, pts: 50, label: 'CHEEK CLAP!', color: '#ff9b42' },
    { d: 1.0, pts: 25, label: 'GRAZED!', color: '#ff6d7e' },
  ];
  const OUCH = [
    'OUCH!', 'MY BUTT!!', 'AAAAH!', 'NOT THE CHEEKS!', 'WHO DID THAT?!',
    "I CAN'T SIT FOR A WEEK!", 'WHY ME?!', 'ও মা গো!', 'বাঁচাও!!', 'উফফ!', 'কে রে?!',
  ];
  const OUCH_PERFECT = ['RIGHT IN THE PUCKZONU!!', 'BULLSEYE?! REALLY?!', 'আমার পাছা রে!!', 'MAMA!!!'];
  const MISSES = [
    'MISS!', 'Stormtrooper aim!', 'The palm tree says ouch 🌴', 'Bro, the BUTT!',
    'Not even close', 'Coconut casualty 🥥', 'Wind check?', 'He didn\'t even notice',
  ];
  const NEAR = ['SO CLOSE!', 'He felt the breeze 💨', 'Almost!'];
  const TIPS = [
    'Tap = sniper precision · Hold = spray &amp; pray',
    'Hit him mid-jump for <b>2× AIR BUTT</b>',
    'Shoot falling 🥥 for +10 ammo',
    'Golden 🥥 = SLOW-MO',
    'Every 5 hits in a row raises the combo',
    'The more you shoot, the faster he jumps',
  ];
  const RANKS = [
    [0, 'Stormtrooper Academy Dropout 🪖'],
    [600, 'Coconut Tree Assassin 🌴'],
    [1500, 'Certified Cheek Tickler 🪶'],
    [3000, 'Booty Hunter 🍑'],
    [5500, 'Butt Sniper Elite 🎯'],
    [9000, 'LEGENDARY PUCKZONU MASTER 👑🍑'],
  ];

  // ---------- Layout ----------
  let W = 480, VH = 640, H = 765, dpr = 1, s = 1;

  function layout() {
    const hud = $('hud').getBoundingClientRect().height;
    const availW = Math.min(window.innerWidth - 8, 600);
    const availH = window.innerHeight - hud - 12;
    W = Math.max(240, Math.floor(Math.min(availW, availH / (VIDEO_ASPECT + DECK))));
    VH = Math.round(W * VIDEO_ASPECT);
    H = Math.round(VH + W * DECK);
    s = W / 480;
    document.documentElement.style.setProperty('--w', W + 'px');
    arena.style.height = H + 'px';
    video.style.height = VH + 'px';
    $('deck').style.height = (H - VH) + 'px';
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ---------- Butt tracking ----------
  function buttAt(t) {
    const p = TRACK.points;
    const f = Math.max(0, t) * TRACK.fps;
    const i = Math.min(Math.floor(f), p.length - 1);
    const j = Math.min(i + 1, p.length - 1);
    const k = i === j ? 0 : f - i;
    const lerp = (q) => p[i][q] + (p[j][q] - p[i][q]) * k;
    const cy = lerp(1);
    return { x: lerp(0) * W, y: cy * VH, rx: lerp(2) * W, ry: lerp(3) * VH, air: cy < 0.8 };
  }

  // ---------- Sound (all synthesized, no files) ----------
  const Sound = (() => {
    let ac = null, master = null, noiseBuf = null, enabled = true;

    function init() {
      if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ac = new AC();
      master = ac.createGain();
      master.gain.value = 0.5;
      master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const ok = () => ac && enabled;

    function env(g, t, a, peak, dec) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
    }
    function noise(t, dur, type, freq, peak, q = 1) {
      const src = ac.createBufferSource();
      src.buffer = noiseBuf;
      const f = ac.createBiquadFilter();
      f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = ac.createGain();
      env(g, t, 0.002, peak, dur);
      src.connect(f).connect(g).connect(master);
      src.start(t, Math.random() * 0.5);
      src.stop(t + dur + 0.05);
    }
    function tone(t, type, f0, f1, dur, peak, attack = 0.005, lp = 0) {
      const o = ac.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + attack + dur);
      const g = ac.createGain();
      env(g, t, attack, peak, dur);
      let node = o;
      if (lp) {
        const f = ac.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = lp;
        node = o.connect(f);
      }
      node.connect(g).connect(master);
      o.start(t);
      o.stop(t + attack + dur + 0.05);
    }

    return {
      init,
      toggle() { enabled = !enabled; return enabled; },
      shot() {
        if (!ok()) return;
        const t = ac.currentTime;
        noise(t, 0.08, 'bandpass', 1300 + Math.random() * 700, 0.6, 0.7);
        noise(t, 0.16, 'lowpass', 600, 0.45);
        tone(t, 'triangle', 170, 45, 0.11, 0.55);
      },
      hit() {
        if (!ok()) return;
        const t = ac.currentTime;
        noise(t, 0.05, 'highpass', 2500, 0.45);
        tone(t, 'sine', 280, 950, 0.16, 0.35);
      },
      fart() {
        if (!ok()) return;
        const t = ac.currentTime + 0.05;
        const dur = 0.45 + Math.random() * 0.45;
        const base = 65 + Math.random() * 45;
        const o = ac.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(base * 1.35, t);
        o.frequency.exponentialRampToValueAtTime(base * 0.7, t + dur);
        const lfo = ac.createOscillator();
        lfo.frequency.value = 12 + Math.random() * 12;
        const lg = ac.createGain();
        lg.gain.value = base * 0.4;
        lfo.connect(lg).connect(o.frequency);
        const f = ac.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = 420; f.Q.value = 5;
        const g = ac.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.9, t + 0.03);
        g.gain.setValueAtTime(0.9, t + dur * 0.55);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(f).connect(g).connect(master);
        o.start(t); lfo.start(t);
        o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
        noise(t, dur * 0.8, 'lowpass', 260, 0.3);
      },
      ricochet() {
        if (!ok()) return;
        tone(ac.currentTime + 0.03, 'sine', 2700, 650, 0.3, 0.1);
      },
      click() {
        if (!ok()) return;
        tone(ac.currentTime, 'square', 1800, 1800, 0.02, 0.12);
      },
      pickup() {
        if (!ok()) return;
        const t = ac.currentTime;
        [523, 659, 784, 1047].forEach((f, i) => tone(t + i * 0.07, 'triangle', f, f, 0.12, 0.3));
      },
      ding() {
        if (!ok()) return;
        const t = ac.currentTime;
        tone(t, 'sine', 1318, 1318, 0.45, 0.2);
        tone(t + 0.04, 'sine', 1976, 1976, 0.35, 0.1);
      },
      combo() {
        if (!ok()) return;
        const t = ac.currentTime;
        [659, 880, 1175].forEach((f, i) => tone(t + i * 0.06, 'square', f, f, 0.08, 0.12, 0.005, 3000));
      },
      sadTrombone() {
        if (!ok()) return;
        const t = ac.currentTime;
        [392, 370, 349].forEach((f, i) => tone(t + i * 0.42, 'sawtooth', f, f * 0.98, 0.34, 0.22, 0.03, 1100));
        tone(t + 1.26, 'sawtooth', 330, 300, 1.1, 0.22, 0.03, 1100);
      },
    };
  })();

  // ---------- State ----------
  const S = {
    running: false, ending: false,
    score: 0, ammo: MAX_AMMO, combo: 0, bestCombo: 0,
    shots: 0, hits: 0, perfects: 0, trees: 0,
    heldShots: 0, firing: false, lastShot: 0, lastRealShot: 0,
    aim: { x: 240, y: 400 }, pointerIn: false,
    slowmoUntil: 0, nextCoconut: 0,
    showHitbox: false,
  };
  let best = 0;
  try { best = parseInt(localStorage.getItem('puckzonu-best') || '0', 10) || 0; } catch (e) { /* storage blocked */ }

  const particles = [];
  const texts = [];
  const tracers = [];
  const decals = [];
  const coconuts = [];
  let bubble = null;
  let announce = null;
  let recoil = 0, flash = 0, shake = 0, gunAngle = -2.4;

  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // ---------- HUD ----------
  function updateHud() {
    $('score').textContent = S.score.toLocaleString();
    const m = multiplier();
    const c = $('combo');
    c.textContent = '×' + m;
    $('comboLabel').textContent = S.combo >= 2 ? 'Combo ' + S.combo : 'Combo';
    c.classList.toggle('hot', m > 1);
    $('ammo').textContent = S.ammo;
    $('ammoFill').style.width = Math.min(100, (S.ammo / MAX_AMMO) * 100) + '%';
    $('ammoStat').classList.toggle('low', S.running && S.ammo <= 10);
    $('best').textContent = best.toLocaleString();
  }
  const multiplier = () => Math.min(4, 1 + Math.floor(S.combo / 5) * 0.5);

  let tipIdx = 0;
  setInterval(() => {
    const tip = $('tip');
    tip.style.opacity = 0;
    setTimeout(() => { tipIdx = (tipIdx + 1) % TIPS.length; tip.innerHTML = TIPS[tipIdx]; tip.style.opacity = 1; }, 300);
  }, 4500);

  // ---------- Effects helpers ----------
  function floatText(text, x, y, color, size = 26, life = 1.1) {
    texts.push({ text, x, y, vy: -60 * s, color, size: size * s, life, max: life });
  }
  function burst(x, y, n, colors, speed = 260) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = rand(0.3, 1) * speed * s;
      particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80 * s, g: 600 * s,
        life: rand(0.35, 0.8), max: 0.8, color: pick(colors), size: rand(2, 5) * s });
    }
  }
  function emoji(ch, x, y, vx, vy, size, life, grow = 0) {
    particles.push({ emoji: ch, x, y, vx, vy, g: 0, life, max: life, size: size * s, grow });
  }
  function say(text, perfect) {
    const now = performance.now();
    if (bubble && now - bubble.born < 650 && !perfect) return;
    bubble = { text, born: now, life: perfect ? 1.4 : 1.0, max: perfect ? 1.4 : 1.0, big: perfect };
  }
  function shout(text, color = '#ffd23f', life = 1.3) {
    announce = { text, color, life, max: life };
  }

  // ---------- Shooting ----------
  let lastLabel = 0;
  function gunPivot() { return { x: W * 0.87, y: VH + (H - VH) * 0.66 }; }
  const BARREL = () => 150 * s;

  function fire(now) {
    if (S.ammo <= 0) { Sound.click(); return; }
    S.ammo--; S.shots++; S.heldShots++;
    S.lastRealShot = now;

    // spread grows while holding the trigger: tap for precision
    const spread = Math.min(0.055, 0.004 + (S.heldShots - 1) * 0.007) * W;
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * spread;
    const tx = S.aim.x + Math.cos(a) * r;
    const ty = Math.min(VH - 2, S.aim.y + Math.sin(a) * r);

    const P = gunPivot();
    const L = BARREL();
    const mx = P.x + Math.cos(gunAngle) * L, my = P.y + Math.sin(gunAngle) * L;
    tracers.push({ x1: mx, y1: my, x2: tx, y2: ty, life: 0.09, max: 0.09 });
    recoil = 1; flash = 0.06; shake = Math.max(shake, 2.5 * s);
    // ejected shell casing
    particles.push({ shell: true, x: P.x + 10 * s, y: P.y - 10 * s, vx: rand(40, 140) * s, vy: rand(-260, -160) * s,
      g: 900 * s, life: 0.7, max: 0.7, size: 3 * s, rot: rand(0, 6), vr: rand(-20, 20) });
    Sound.shot();

    // coconuts first
    for (let i = coconuts.length - 1; i >= 0; i--) {
      const c = coconuts[i];
      if (Math.hypot(tx - c.x, ty - c.y) < c.r * 1.35) {
        coconuts.splice(i, 1);
        hitCoconut(c);
        updateHud();
        return;
      }
    }

    const b = buttAt(video.currentTime);
    const d = Math.hypot((tx - b.x) / b.rx, (ty - b.y) / b.ry);
    const tier = TIERS.find((t) => d <= t.d);

    if (tier) {
      S.hits++; S.combo++;
      S.bestCombo = Math.max(S.bestCombo, S.combo);
      const m = multiplier();
      const air = b.air ? 2 : 1;
      const pts = Math.round(tier.pts * m * air);
      S.score += pts;

      floatText('+' + pts, tx, ty - 10 * s, tier.color, tier.perfect ? 38 : 28);
      if (tier.perfect || air > 1 || now - lastLabel > 350) {
        lastLabel = now;
        floatText(tier.label + (air > 1 ? ' AIR ×2' : ''), tx, ty - 44 * s, '#fff', tier.perfect ? 26 : 20, 0.9);
      }
      burst(tx, ty, tier.perfect ? 28 : 14, ['#ff3355', '#ff8fa3', '#ffffff', '#ffd23f']);
      decals.push({ ox: (tx - b.x) / b.rx, oy: (ty - b.y) / b.ry, life: 2.5, max: 2.5, rot: rand(0, 6), size: rand(5, 8) * s });
      shake = Math.max(shake, (tier.perfect ? 9 : 5) * s);
      Sound.hit();

      if (tier.perfect) {
        S.perfects++;
        Sound.fart();
        Sound.ding();
        say(pick(OUCH_PERFECT), true);
        for (let i = 0; i < 6; i++) {
          emoji('💨', b.x + rand(-0.6, 0.6) * b.rx, b.y + rand(0, 0.5) * b.ry,
            rand(-90, 90) * s, rand(-70, 10) * s, 26, rand(0.9, 1.4), 0.9);
        }
        emoji('🍑', tx, ty, 0, -140 * s, 34, 0.9, 0.5);
        if (S.perfects === 1) shout('FIRST PERFECT! 🍑');
      } else {
        say(pick(OUCH), false);
      }
      if (air > 1 && Math.random() < 0.35) shout('AIR BUTT! ×2', '#7ddc6f', 0.9);
      if (S.combo % 5 === 0 && S.combo <= 30) {
        shout(S.combo + ' HIT COMBO! ×' + multiplier(), '#ff5a3c');
        Sound.combo();
      }
    } else {
      const wasCombo = S.combo;
      S.combo = 0;
      if (d <= 1.6) {
        floatText(pick(NEAR), tx, ty - 16 * s, '#cfe8ff', 20, 0.9);
      } else {
        S.trees++;
        if (Math.random() < 0.45) floatText(pick(MISSES), tx, ty - 16 * s, '#c9c9c9', 18, 0.9);
        if (Math.random() < 0.3) Sound.ricochet();
      }
      burst(tx, ty, 6, ['#d9c7a3', '#8b7a5a', '#ffffff'], 160);
      if (wasCombo >= 5) shout('COMBO BROKEN 💔', '#9fb4ff', 1.0);
    }

    if (S.ammo === 10) shout('LOW AMMO! SHOOT COCONUTS 🥥', '#ff5a3c', 1.6);
    updateHud();
  }

  function hitCoconut(c) {
    Sound.pickup();
    burst(c.x, c.y, 18, c.golden ? ['#ffd23f', '#fff6b0', '#ffae2b'] : ['#6b3f1d', '#a86b3c', '#ffffff']);
    if (c.golden) {
      S.ammo += 5;
      S.slowmoUntil = performance.now() + 4500;
      floatText('+5 AMMO', c.x, c.y - 10 * s, '#ffd23f', 26);
      shout('⏳ SLOW-MO! ⏳', '#ffd23f', 1.4);
    } else {
      S.ammo += 10;
      floatText('+10 AMMO 🥥', c.x, c.y - 10 * s, '#7ddc6f', 26);
    }
  }

  function spawnCoconut() {
    const golden = Math.random() < 0.28;
    coconuts.push({
      x: rand(0.1, 0.9) * W, y: -20 * s, vx: rand(-25, 25) * s, vy: rand(0, 60) * s,
      r: (golden ? 17 : 19) * s, golden, rot: 0, vr: rand(-3, 3),
    });
  }

  // ---------- Game flow ----------
  function startGame() {
    Sound.init();
    Object.assign(S, {
      running: true, ending: false, score: 0, ammo: MAX_AMMO, combo: 0, bestCombo: 0,
      shots: 0, hits: 0, perfects: 0, trees: 0, heldShots: 0, firing: false,
      lastShot: 0, lastRealShot: performance.now(), slowmoUntil: 0,
      nextCoconut: performance.now() + rand(4000, 7000),
    });
    particles.length = texts.length = tracers.length = decals.length = coconuts.length = 0;
    bubble = null;
    $('startScreen').classList.add('hidden');
    $('overScreen').classList.add('hidden');
    video.currentTime = 0;
    video.play().catch(() => {});
    shout('GO GO GO! 🔫', '#ffd23f', 1.0);
    updateHud();
  }

  function endGame() {
    S.ending = true;
    S.running = false;
    S.firing = false;
    video.playbackRate = 1;
    Sound.sadTrombone();
    const isBest = S.score > best;
    if (isBest) {
      best = S.score;
      try { localStorage.setItem('puckzonu-best', String(best)); } catch (e) { /* storage blocked */ }
    }
    let rank = RANKS[0][1];
    for (const [min, name] of RANKS) if (S.score >= min) rank = name;
    const acc = S.shots ? Math.round((S.hits / S.shots) * 100) : 0;
    $('overTitle').textContent = pick(['OUT OF AMMO!', 'CLICK. CLICK. EMPTY.', 'CEASE FIRE!', 'HE SURVIVED... BARELY']);
    $('finalScore').textContent = S.score.toLocaleString();
    $('rank').textContent = rank;
    $('stAcc').textContent = acc + '%';
    $('stPerfect').textContent = S.perfects;
    $('stCombo').textContent = S.bestCombo;
    $('stTrees').textContent = S.trees;
    $('newBest').classList.toggle('hidden', !isBest || S.score === 0);
    setTimeout(() => $('overScreen').classList.remove('hidden'), 400);
    updateHud();
  }

  function share() {
    const acc = S.shots ? Math.round((S.hits / S.shots) * 100) : 0;
    const text = `🍑🔫 I scored ${S.score.toLocaleString()} in PUCKZONU: Booty Blaster 3000 ` +
      `(${S.perfects} perfect butt shots, ${acc}% accuracy). Can you beat me?`;
    const url = location.href.split('#')[0];
    if (navigator.share) {
      navigator.share({ title: 'Puckzonu: Booty Blaster 3000', text, url }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text + ' ' + url).then(() => {
        $('shareBtn').textContent = '✅ COPIED!';
        setTimeout(() => { $('shareBtn').textContent = '📣 BRAG'; }, 1600);
      }).catch(() => {});
    }
  }

  // ---------- Input ----------
  function setAim(e) {
    const r = canvas.getBoundingClientRect();
    S.aim.x = Math.max(0, Math.min(W, e.clientX - r.left));
    S.aim.y = Math.max(0, Math.min(VH - 2, e.clientY - r.top));
  }
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (!S.running) return;
    Sound.init();
    canvas.setPointerCapture?.(e.pointerId);
    setAim(e);
    S.pointerIn = true;
    S.firing = true;
    S.heldShots = 0;
    const now = performance.now();
    if (now - S.lastShot >= FIRE_INTERVAL * 0.6) { S.lastShot = now; fire(now); }
  });
  canvas.addEventListener('pointermove', (e) => { setAim(e); S.pointerIn = true; });
  const release = () => { S.firing = false; S.heldShots = 0; };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') S.pointerIn = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  window.addEventListener('keydown', (e) => {
    if (e.key === 'h' || e.key === 'H') S.showHitbox = !S.showHitbox;
    if (e.code === 'Space' && S.running && !e.repeat) {
      e.preventDefault();
      S.firing = true; S.heldShots = 0;
    }
    if ((e.code === 'Enter' || e.code === 'Space') && !S.running && !e.repeat) {
      e.preventDefault();
      startGame();
    }
  });
  window.addEventListener('keyup', (e) => { if (e.code === 'Space') release(); });

  $('startBtn').addEventListener('click', startGame);
  $('againBtn').addEventListener('click', startGame);
  $('shareBtn').addEventListener('click', share);
  $('soundBtn').addEventListener('click', (e) => {
    Sound.init();
    e.currentTarget.textContent = Sound.toggle() ? '🔊' : '🔇';
  });
  window.addEventListener('resize', layout);

  // ---------- Update ----------
  let lastRate = 1;
  function update(dt, now) {
    if (S.running) {
      if (S.firing && now - S.lastShot >= FIRE_INTERVAL) { S.lastShot = now; fire(now); }
      if (now >= S.nextCoconut) { spawnCoconut(); S.nextCoconut = now + rand(6000, 11000); }
      if (S.ammo <= 0 && !S.ending && now - S.lastRealShot > 1100) endGame();
    }
    // he gets jumpier the more you shoot; golden coconuts slow him down
    let rate = S.running ? 1 + Math.min(0.5, (S.shots / MAX_AMMO) * 0.5) : 1;
    if (now < S.slowmoUntil) rate *= 0.45;
    rate = Math.round(rate * 20) / 20;
    if (rate !== lastRate) { video.playbackRate = rate; lastRate = rate; }

    // gun aim (in attract mode it lazily tracks the butt)
    let target = S.aim;
    if (!S.running) {
      const b = buttAt(video.currentTime);
      target = { x: b.x, y: b.y };
    }
    const P = gunPivot();
    let want = Math.atan2(target.y - P.y, target.x - P.x);
    if (want > 0) want = want > Math.PI / 2 ? -Math.PI : 0;
    gunAngle += (want - gunAngle) * Math.min(1, dt * (S.running ? 30 : 6));

    recoil = Math.max(0, recoil - dt * 12);
    flash = Math.max(0, flash - dt);
    shake = Math.max(0, shake - dt * 40 * s);

    for (let i = coconuts.length - 1; i >= 0; i--) {
      const c = coconuts[i];
      c.vy += 650 * s * dt * (now < S.slowmoUntil ? 0.5 : 1);
      c.x += c.vx * dt; c.y += c.vy * dt; c.rot += c.vr * dt;
      if (c.y - c.r > VH) coconuts.splice(i, 1);
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.vy += p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.grow) p.size *= 1 + p.grow * dt;
      if (p.vr) p.rot += p.vr * dt;
    }
    for (let i = texts.length - 1; i >= 0; i--) {
      const t = texts[i];
      t.life -= dt; t.y += t.vy * dt; t.vy *= 0.96;
      if (t.life <= 0) texts.splice(i, 1);
    }
    for (let i = tracers.length - 1; i >= 0; i--) { tracers[i].life -= dt; if (tracers[i].life <= 0) tracers.splice(i, 1); }
    for (let i = decals.length - 1; i >= 0; i--) { decals[i].life -= dt; if (decals[i].life <= 0) decals.splice(i, 1); }
    if (bubble) { bubble.life -= dt; if (bubble.life <= 0) bubble = null; }
    if (announce) { announce.life -= dt; if (announce.life <= 0) announce = null; }

    const sx = shake ? rand(-shake, shake) : 0, sy = shake ? rand(-shake, shake) : 0;
    shaker.style.transform = shake ? `translate(${sx}px, ${sy}px)` : '';
  }

  // ---------- Drawing ----------
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function outlinedText(text, x, y, size, color, alpha = 1, align = 'center') {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(3, size * 0.18);
    ctx.strokeStyle = '#000';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function drawDecals(b) {
    for (const d of decals) {
      const x = b.x + d.ox * b.rx, y = b.y + d.oy * b.ry;
      ctx.save();
      ctx.globalAlpha = Math.min(1, d.life / 0.6) * 0.9;
      ctx.translate(x, y);
      ctx.rotate(d.rot);
      ctx.fillStyle = '#ff2d55';
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const rr = d.size * (i % 2 ? 0.55 : 1.15);
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffe3ea';
      ctx.beginPath();
      ctx.arc(0, 0, d.size * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawCoconut(c, now) {
    ctx.save();
    ctx.translate(c.x, c.y);
    if (c.golden) {
      ctx.save();
      ctx.rotate(now / 300);
      ctx.strokeStyle = 'rgba(255,220,90,0.8)';
      ctx.lineWidth = 2 * s;
      for (let i = 0; i < 8; i++) {
        ctx.rotate(Math.PI / 4);
        ctx.beginPath();
        ctx.moveTo(c.r * 1.2, 0);
        ctx.lineTo(c.r * 1.7, 0);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.rotate(c.rot);
    const g = ctx.createRadialGradient(-c.r * 0.35, -c.r * 0.35, c.r * 0.1, 0, 0, c.r);
    if (c.golden) { g.addColorStop(0, '#fff7c2'); g.addColorStop(0.5, '#ffc93c'); g.addColorStop(1, '#a8740a'); }
    else { g.addColorStop(0, '#b0743f'); g.addColorStop(1, '#4a2c14'); }
    ctx.fillStyle = g;
    ctx.strokeStyle = '#1d1008';
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.arc(0, 0, c.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = c.golden ? '#7a5406' : '#24130a';
    for (const [ex, ey] of [[-0.28, -0.25], [0.28, -0.25], [0, 0.12]]) {
      ctx.beginPath();
      ctx.arc(ex * c.r, ey * c.r, c.r * 0.13, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    outlinedText(c.golden ? 'SLOW-MO' : '+10', c.x, c.y - c.r - 10 * s, 13 * s, c.golden ? '#ffd23f' : '#7ddc6f');
  }

  function drawGun() {
    const P = gunPivot();
    const L = BARREL();

    // tripod + ammo box (static)
    ctx.save();
    ctx.translate(P.x, P.y);
    ctx.strokeStyle = '#1c1c1c';
    ctx.lineCap = 'round';
    ctx.lineWidth = 6 * s;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(-34 * s, H - P.y + 4);
    ctx.moveTo(0, 0); ctx.lineTo(30 * s, H - P.y + 4);
    ctx.moveTo(0, 0); ctx.lineTo(-4 * s, H - P.y + 4);
    ctx.stroke();
    const bx = -118 * s, by = 4 * s, bw = 58 * s, bh = 34 * s;
    const bg = ctx.createLinearGradient(0, by, 0, by + bh);
    bg.addColorStop(0, '#6b7440'); bg.addColorStop(1, '#3d4424');
    ctx.fillStyle = bg;
    roundRect(bx, by, bw, bh, 4 * s);
    ctx.fill();
    ctx.strokeStyle = '#1b1f10'; ctx.lineWidth = 2 * s; ctx.stroke();
    ctx.fillStyle = '#e7e0c0';
    ctx.font = `${11 * s}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('AMMO ' + S.ammo, bx + bw / 2, by + bh / 2 + 1);
    ctx.restore();

    // ammo belt from box to the gun: fewer rounds hang as ammo drops
    const feed = { x: P.x + Math.cos(gunAngle) * 8 * s - Math.sin(gunAngle) * 16 * s,
      y: P.y + Math.sin(gunAngle) * 8 * s + Math.cos(gunAngle) * 16 * s };
    const start = { x: P.x - 89 * s, y: P.y + 4 * s };
    const rounds = Math.min(12, Math.ceil(S.ammo / 8));
    for (let i = 0; i < rounds; i++) {
      const t = 1 - i / 12;
      const cx = (1 - t) * (1 - t) * start.x + 2 * (1 - t) * t * ((start.x + feed.x) / 2) + t * t * feed.x;
      const mid = Math.max(start.y, feed.y) + 22 * s;
      const cy = (1 - t) * (1 - t) * start.y + 2 * (1 - t) * t * mid + t * t * feed.y;
      ctx.fillStyle = '#d9a441';
      ctx.strokeStyle = '#6b4a12';
      ctx.lineWidth = 1;
      roundRect(cx - 2.5 * s, cy - 7 * s, 5 * s, 12 * s, 2 * s);
      ctx.fill(); ctx.stroke();
    }

    // rotating gun
    ctx.save();
    ctx.translate(P.x, P.y);
    ctx.rotate(gunAngle);
    ctx.translate(-recoil * 9 * s, 0);

    // rear grips
    ctx.fillStyle = '#2a2a2a';
    roundRect(-68 * s, -14 * s, 18 * s, 8 * s, 3 * s); ctx.fill();
    roundRect(-68 * s, 6 * s, 18 * s, 8 * s, 3 * s); ctx.fill();
    // receiver
    const rg = ctx.createLinearGradient(0, -18 * s, 0, 18 * s);
    rg.addColorStop(0, '#6d7a45'); rg.addColorStop(0.5, '#4d5731'); rg.addColorStop(1, '#2d331c');
    ctx.fillStyle = rg;
    roundRect(-52 * s, -18 * s, 90 * s, 36 * s, 8 * s);
    ctx.fill();
    ctx.strokeStyle = '#161a0c'; ctx.lineWidth = 2 * s; ctx.stroke();
    // peach sticker, obviously
    ctx.font = `${16 * s}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('🍑', -14 * s, 0);
    // cooling jacket
    const jg = ctx.createLinearGradient(0, -11 * s, 0, 11 * s);
    jg.addColorStop(0, '#5b6167'); jg.addColorStop(0.5, '#3a3f44'); jg.addColorStop(1, '#202326');
    ctx.fillStyle = jg;
    roundRect(36 * s, -11 * s, L - 62 * s, 22 * s, 5 * s);
    ctx.fill();
    ctx.fillStyle = '#121416';
    for (let x = 48 * s; x < L - 32 * s; x += 13 * s) {
      ctx.beginPath(); ctx.arc(x, -4 * s, 2.6 * s, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 6 * s, 4 * s, 2.6 * s, 0, Math.PI * 2); ctx.fill();
    }
    // barrel + muzzle
    ctx.fillStyle = '#1e2124';
    ctx.fillRect(L - 28 * s, -5 * s, 28 * s, 10 * s);
    ctx.fillStyle = '#0d0e0f';
    ctx.fillRect(L - 7 * s, -8 * s, 7 * s, 16 * s);
    // front sight
    ctx.fillStyle = '#1e2124';
    ctx.fillRect(L - 20 * s, -15 * s, 4 * s, 6 * s);

    if (flash > 0) {
      ctx.save();
      ctx.translate(L + 4 * s, 0);
      const fl = rand(20, 34) * s;
      ctx.fillStyle = 'rgba(255,190,60,0.95)';
      ctx.beginPath();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const rr = i % 2 ? fl * 0.35 : fl * (i % 4 === 0 ? 1 : 0.6);
        ctx.lineTo(Math.cos(a) * rr + (Math.cos(a) > 0 ? rr * 0.5 : 0), Math.sin(a) * rr * 0.7);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff6c8';
      ctx.beginPath(); ctx.arc(4 * s, 0, fl * 0.25, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // pivot cap
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(P.x, P.y, 7 * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#555';
    ctx.beginPath(); ctx.arc(P.x, P.y, 3 * s, 0, Math.PI * 2); ctx.fill();
  }

  function drawBubble(b) {
    if (!bubble) return;
    const hx = b.x, hy = b.y - 0.33 * VH;
    const t = 1 - bubble.life / bubble.max;
    const pop = t < 0.12 ? t / 0.12 : 1;
    const size = (bubble.big ? 24 : 20) * s;
    ctx.save();
    ctx.font = `${size}px ${FONT}`;
    const tw = ctx.measureText(bubble.text).width;
    const w = tw + 24 * s, h = size + 18 * s;
    let x = hx + 30 * s, y = hy - h - 20 * s;
    if (x + w > W - 6) x = Math.max(6, hx - w - 30 * s);
    y = Math.max(6, y);
    ctx.globalAlpha = Math.min(1, bubble.life / 0.25);
    ctx.translate(x + w / 2, y + h / 2);
    ctx.scale(pop, pop);
    ctx.rotate(-0.04);
    ctx.fillStyle = bubble.big ? '#ffe45c' : '#fff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3 * s;
    roundRect(-w / 2, -h / 2, w, h, 12 * s);
    ctx.fill(); ctx.stroke();
    // tail toward the head
    const tx = hx - (x + w / 2), ty = hy - (y + h / 2);
    const side = tx < 0 ? -1 : 1;
    ctx.beginPath();
    ctx.moveTo(side * w * 0.15 - 8 * s, h / 2 - 2);
    ctx.lineTo(tx * 0.55, ty * 0.55);
    ctx.lineTo(side * w * 0.15 + 8 * s, h / 2 - 2);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(bubble.text, 0, 2 * s);
    ctx.restore();
  }

  function drawCrosshair(now) {
    if (!S.running || !S.pointerIn) return;
    const { x, y } = S.aim;
    const spread = S.firing ? Math.min(0.055, 0.004 + S.heldShots * 0.007) * W : 0;
    const r = 13 * s + spread;
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 4 * s;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = S.firing ? '#ff3b3b' : '#ffe14a';
    ctx.lineWidth = 2 * s;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    const g = 5 * s, l = 9 * s;
    ctx.beginPath();
    ctx.moveTo(x - r - l, y); ctx.lineTo(x - r + g, y);
    ctx.moveTo(x + r - g, y); ctx.lineTo(x + r + l, y);
    ctx.moveTo(x, y - r - l); ctx.lineTo(x, y - r + g);
    ctx.moveTo(x, y + r - g); ctx.lineTo(x, y + r + l);
    ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath(); ctx.arc(x, y, 1.8 * s, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function draw(now) {
    ctx.clearRect(0, 0, W, H);
    const b = buttAt(video.currentTime);

    // slow-mo tint
    if (now < S.slowmoUntil) {
      ctx.fillStyle = 'rgba(80,140,255,0.12)';
      ctx.fillRect(0, 0, W, VH);
      outlinedText('SLOW-MO ' + Math.ceil((S.slowmoUntil - now) / 1000), W / 2, 22 * s, 18 * s, '#9fc4ff');
    }

    if (S.showHitbox) {
      ctx.save();
      ctx.strokeStyle = '#00ffd0';
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 2;
      for (const t of TIERS) {
        ctx.beginPath();
        ctx.ellipse(b.x, b.y, b.rx * t.d, b.ry * t.d, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
      outlinedText(b.air ? 'AIRBORNE ×2' : 'grounded', b.x, b.y + b.ry + 14, 14, '#00ffd0');
    }

    drawDecals(b);
    for (const c of coconuts) drawCoconut(c, now);

    for (const t of tracers) {
      const a = t.life / t.max;
      ctx.save();
      ctx.strokeStyle = `rgba(255,230,120,${a})`;
      ctx.lineWidth = 3 * s * a + 1;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(t.x1, t.y1);
      ctx.lineTo(t.x2, t.y2);
      ctx.stroke();
      ctx.restore();
    }

    for (const p of particles) {
      const a = Math.max(0, Math.min(1, p.life / (p.max * 0.5)));
      ctx.save();
      ctx.globalAlpha = a;
      if (p.emoji) {
        ctx.font = `${p.size}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.emoji, p.x, p.y);
      } else if (p.shell) {
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = '#e0b04a';
        ctx.fillRect(-p.size, -p.size * 2, p.size * 2, p.size * 4);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    drawGun();
    drawBubble(b);

    for (const t of texts) {
      const a = Math.min(1, t.life / (t.max * 0.4));
      const pop = 1 + Math.max(0, (t.life - t.max + 0.12) / 0.12) * 0.4;
      outlinedText(t.text, Math.max(40 * s, Math.min(W - 40 * s, t.x)), t.y, t.size * pop, t.color, a);
    }

    if (announce) {
      const t = 1 - announce.life / announce.max;
      const scale = t < 0.15 ? 0.6 + (t / 0.15) * 0.5 : 1.1 - Math.min(0.1, (t - 0.15));
      ctx.save();
      ctx.translate(W / 2, VH * 0.2);
      ctx.rotate(-0.05);
      ctx.scale(scale, scale);
      let size = 34 * s;
      ctx.font = `${size}px ${FONT}`;
      const tw = ctx.measureText(announce.text).width;
      if (tw > W * 0.9) size *= (W * 0.9) / tw;
      outlinedText(announce.text, 0, 0, size, announce.color, Math.min(1, announce.life / 0.3));
      ctx.restore();
    }

    drawCrosshair(now);
  }

  // ---------- Main loop ----------
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt, now);
    draw(now);
    requestAnimationFrame(loop);
  }

  layout();
  updateHud();
  $('tip').innerHTML = TIPS[0];
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
  video.play().catch(() => { /* autoplay blocked until the start click */ });
  requestAnimationFrame(loop);
})();
