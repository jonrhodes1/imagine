import { applyAssessmentChrome } from './components.js';

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

// The surreal bus narrative  -  each stage is an array of { text, pause }
const STORY_LINES = [
  { text: 'You step onto a bus.', pause: 5000 },
  { text: 'You get on and pay.', pause: 5000 },
  { text: 'The driver nods.', pause: 5000 },
  { text: 'You notice something slightly off\u2026', pause: 5000 },
  { text: 'The driver is a polar bear.', pause: 5000 },
  { text: "He's wearing a uniform.", pause: 5000 },
  { text: 'The hat is far too small.', pause: 5000 },
  { text: 'He adjusts it like nothing is wrong.', pause: 5000 },
  { text: 'You sit by the window.', pause: 5000 },
  { text: 'The bus begins moving.', pause: 5000 },
  { text: 'A faint smell drifts through the bus\u2026', pause: 5000 },
  { text: '\u2026burnt strawberries.', pause: 5000 },
  { text: "It's sweet. But not quite right.", pause: 5000 },
  { text: 'The bus hits a bump.', pause: 5000 },
  { text: 'But instead of landing\u2026', pause: 5000 },
  { text: '\u2026you begin to float.', pause: 5000 },
  { text: 'The polar bear keeps driving.', pause: 5000 },
  { text: 'Other passengers remain calm.', pause: 5000 },
  { text: 'One slowly drifts past you upside down.', pause: 5000 },
  { text: 'No one reacts.', pause: 5000 },
];

function buildParticles() {
  const wrap = document.createElement('div');
  wrap.className = 'improvise-particles';
  for (let i = 0; i < 20; i++) {
    const p = document.createElement('span');
    p.className = 'improvise-particle';
    p.style.setProperty('--x', `${Math.random() * 100}%`);
    p.style.setProperty('--d', `${(Math.random() * 9 + 5).toFixed(1)}s`);
    p.style.setProperty('--delay', `${(Math.random() * 5).toFixed(1)}s`);
    p.style.setProperty('--size', `${(Math.random() * 3.5 + 1.5).toFixed(1)}px`);
    wrap.append(p);
  }
  return wrap;
}

function calculateLineSmoothness(points) {
  if (points.length < 3) return 5;
  const angles = [];
  for (let i = 1; i < points.length - 1; i++) {
    const dx1 = points[i].x - points[i - 1].x;
    const dy1 = points[i].y - points[i - 1].y;
    const dx2 = points[i + 1].x - points[i].x;
    const dy2 = points[i + 1].y - points[i].y;
    const a1 = Math.atan2(dy1, dx1);
    const a2 = Math.atan2(dy2, dx2);
    let diff = Math.abs(a2 - a1);
    if (diff > Math.PI) diff = Math.PI * 2 - diff;
    angles.push(diff);
  }
  const avgDiff = angles.reduce((s, v) => s + v, 0) / angles.length;
  const smoothness = Math.max(0, 1 - avgDiff / (Math.PI * 0.45));
  return Math.max(1, Math.min(10, Math.round(smoothness * 9 + 1)));
}

export function renderTaskImprovise(task, context, helpers = {}) {
  const { createTaskHeader } = helpers;
  const root = context.root;
  root.innerHTML = '';

  const header =
    typeof createTaskHeader === 'function'
      ? createTaskHeader(task)
      : (() => {
          const block = document.createElement('div');
          block.className = 'task-heading';
          block.innerHTML = `<h2 class="task-title">${task.title}</h2>${task.subtitle ? `<p class="task-subtitle">${task.subtitle}</p>` : ''}`;
          return block;
        })();

  root.append(header);

  const body = document.createElement('div');
  body.className = 'task-view task-panel card improvise-task';
  root.append(body);
  applyAssessmentChrome(header, body);

  let cancelled = false;

  // Persistent measure results
  let stabilityScore = 5;
  let anchorType = null;
  let controlScore = 5;
  let continuityScore = 5;

  function computeFinalScore() {
    const base = (stabilityScore + controlScore + continuityScore) / 3;
    const anchorBoost = anchorType === 'Nothing stayed stable' ? -0.5 : 0.5;
    return Math.max(1, Math.min(10, base + anchorBoost));
  }

  function completeTask() {
    const finalScore = computeFinalScore();
    const payload = {
      stabilityScore,
      anchorType: anchorType || 'Nothing stayed stable',
      controlScore,
      continuityScore,
      finalScore: Number(finalScore.toFixed(2)),
    };
    context.onComplete(task.key, Math.round(finalScore), payload);
  }

  // ─── PHASE 1: Narrative ──────────────────────────────────────────────────────
  async function runNarrative() {
    body.innerHTML = '';
    body.className = 'task-view task-panel card improvise-task improvise-scene';

    body.append(buildParticles());

    const label = document.createElement('p');
    label.className = 'improvise-stage-label';
    label.textContent = 'Improvise';
    body.append(label);

    const lineEl = document.createElement('p');
    lineEl.className = 'improvise-line';
    lineEl.setAttribute('aria-live', 'polite');
    body.append(lineEl);

    const backBtn = document.createElement('button');
    backBtn.className = 'btn btn-secondary improvise-back-btn';
    backBtn.textContent = 'Back';
    backBtn.addEventListener('click', () => {
      cancelled = true;
      context.onBack?.();
    });
    body.append(backBtn);

    for (const { text, pause } of STORY_LINES) {
      if (cancelled) return;
      lineEl.style.opacity = '0';
      await wait(320);
      if (cancelled) return;
      lineEl.textContent = text;
      lineEl.style.opacity = '1';
      await wait(pause);
    }

    if (!cancelled) {
      lineEl.style.opacity = '0';
      await wait(400);
      runTimer();
    }
  }

  // ─── PHASE 2: Immersion Timer ────────────────────────────────────────────────
  function runTimer() {
    if (cancelled) return;

    body.innerHTML = '';
    body.className = 'task-view task-panel card improvise-task improvise-scene';

    body.append(buildParticles());

    const instr = document.createElement('p');
    instr.className = 'improvise-timer-instruction';
    instr.textContent = 'Hold this scene clearly in your mind for 10 seconds.';
    body.append(instr);

    const DURATION = 10_000;
    const startTime = performance.now();

    const frame = () => {
      if (cancelled) return;
      const elapsed = performance.now() - startTime;
      const remaining = Math.max(0, DURATION - elapsed);
      if (remaining > 0) {
        requestAnimationFrame(frame);
      } else {
        // Fade out then move to measures
        body.style.opacity = '0';
        body.style.transition = 'opacity 600ms ease';
        window.setTimeout(() => {
          if (!cancelled) showStabilityMeasure();
        }, 650);
      }
    };
    requestAnimationFrame(frame);
  }

  // ─── MEASURE SCAFFOLDING ─────────────────────────────────────────────────────
  function enterMeasureMode() {
    body.innerHTML = '';
    body.style.opacity = '1';
    body.style.transition = '';
    body.className = 'task-view task-panel card improvise-task improvise-measures';
  }

  // ─── MEASURE 1: Stability ─────────────────────────────────────────────────────
  function showStabilityMeasure() {
    if (cancelled) return;
    enterMeasureMode();

    const title = document.createElement('p');
    title.className = 'improvise-measure-title';
    title.textContent = 'How stable and clear was the scene?';

    const hint = document.createElement('p');
    hint.className = 'improvise-measure-hint';
    hint.textContent = 'Drag outward from the centre  -  further out means clearer and more stable.';

    const canvasWrap = document.createElement('div');
    canvasWrap.className = 'improvise-field-wrap';

    const canvas = document.createElement('canvas');
    const SIZE = 280;
    canvas.width = SIZE;
    canvas.height = SIZE;
    canvas.className = 'improvise-stability-canvas';
    canvasWrap.append(canvas);

    const ctx = canvas.getContext('2d');
    const cx = SIZE / 2;
    const cy = SIZE / 2;
    const maxRadius = SIZE / 2 - 14;
    let currentRadius = maxRadius * 0.38;
    let dragging = false;

    function drawStabilityField(r) {
      ctx.clearRect(0, 0, SIZE, SIZE);
      const ratio = r / maxRadius;

      // Ghost circles for scale reference
      for (let ring = 1; ring <= 4; ring++) {
        ctx.beginPath();
        ctx.arc(cx, cy, maxRadius * (ring / 4), 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(156, 111, 239, 0.08)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Glow fill
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, `rgba(160, 110, 255, ${0.08 + ratio * 0.28})`);
      grad.addColorStop(0.7, `rgba(140, 90, 230, ${0.04 + ratio * 0.14})`);
      grad.addColorStop(1, 'rgba(140, 90, 230, 0)');
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // Main ring  -  jagged/dashed when low, solid when high
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      if (ratio < 0.5) {
        const dash = 6 + (1 - ratio) * 14;
        const gap = 3 + (1 - ratio) * 8;
        ctx.setLineDash([dash, gap]);
      } else {
        ctx.setLineDash([]);
      }
      ctx.strokeStyle = `rgba(190, 150, 255, ${0.4 + ratio * 0.55})`;
      ctx.lineWidth = 2.5 + ratio * 1.5;
      ctx.stroke();
      ctx.setLineDash([]);

      // Centre dot
      ctx.beginPath();
      ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(210, 180, 255, 0.9)';
      ctx.fill();

      // Score label
      const score = Math.max(1, Math.round(ratio * 10));
      ctx.fillStyle = 'rgba(220, 200, 255, 0.75)';
      ctx.font = '600 12px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${score} / 10`, cx, SIZE - 8);
    }

    drawStabilityField(currentRadius);

    function getPointerRadius(e) {
      const rect = canvas.getBoundingClientRect();
      const sx = SIZE / rect.width;
      const sy = SIZE / rect.height;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const dx = (clientX - rect.left) * sx - cx;
      const dy = (clientY - rect.top) * sy - cy;
      return Math.min(maxRadius, Math.sqrt(dx * dx + dy * dy));
    }

    canvas.addEventListener('pointerdown', (e) => {
      dragging = true;
      canvas.setPointerCapture(e.pointerId);
      currentRadius = Math.max(maxRadius * 0.05, getPointerRadius(e));
      drawStabilityField(currentRadius);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      currentRadius = Math.max(maxRadius * 0.05, getPointerRadius(e));
      drawStabilityField(currentRadius);
    });
    canvas.addEventListener('pointerup', () => { dragging = false; });

    const nextBtn = document.createElement('button');
    nextBtn.className = 'btn btn-primary improvise-next';
    nextBtn.textContent = 'Next';
    nextBtn.addEventListener('click', () => {
      stabilityScore = Math.max(1, Math.min(10, Math.round((currentRadius / maxRadius) * 10)));
      context.onInterim(task.key, null, { stabilityScore, phase: 'stability' });
      showAnchorMeasure();
    });

    body.append(title, hint, canvasWrap, nextBtn);
  }

  // ─── MEASURE 2: Anchor ────────────────────────────────────────────────────────
  function showAnchorMeasure() {
    if (cancelled) return;
    enterMeasureMode();

    const title = document.createElement('p');
    title.className = 'improvise-measure-title';
    title.textContent = 'Which part of the imagery did you connect with and hold onto the most?';

    const options = [
      'The driver (polar bear)',
      'The smell',
      'The floating sensation',
      'The movement of the bus',
      'The upside down passenger',
      'Nothing stayed stable',
    ];

    let selected = null;

    const optionWrap = document.createElement('div');
    optionWrap.className = 'improvise-anchor-options';

    const nextBtn = document.createElement('button');
    nextBtn.className = 'btn btn-primary improvise-next is-disabled';
    nextBtn.disabled = true;
    nextBtn.textContent = 'Next';

    options.forEach((opt) => {
      const btn = document.createElement('button');
      btn.className = 'improvise-anchor-btn';
      btn.textContent = opt;
      btn.addEventListener('click', () => {
        selected = opt;
        optionWrap.querySelectorAll('.improvise-anchor-btn').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        nextBtn.disabled = false;
        nextBtn.classList.remove('is-disabled');
      });
      optionWrap.append(btn);
    });

    nextBtn.addEventListener('click', () => {
      anchorType = selected;
      context.onInterim(task.key, null, { stabilityScore, anchorType, phase: 'anchor' });
      showControlMeasure();
    });

    body.append(title, optionWrap, nextBtn);
  }

  // ─── MEASURE 3: Agency/Control ────────────────────────────────────────────────
  function showControlMeasure() {
    if (cancelled) return;
    enterMeasureMode();

    const title = document.createElement('p');
    title.className = 'improvise-measure-title';
    title.textContent = 'How much control did you feel over what was happening?';

    const controlWrap = document.createElement('div');
    controlWrap.className = 'improvise-control-wrap';

    const leftLabel = document.createElement('span');
    leftLabel.className = 'improvise-control-label';
    leftLabel.textContent = 'I was just observing';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '1';
    slider.max = '10';
    slider.value = '5';
    slider.className = 'improvise-control-slider';

    const rightLabel = document.createElement('span');
    rightLabel.className = 'improvise-control-label';
    rightLabel.textContent = 'I was directing what happened';

    const valueEl = document.createElement('div');
    valueEl.className = 'improvise-control-value';
    valueEl.textContent = '5 / 10';

    slider.addEventListener('input', () => {
      valueEl.textContent = `${slider.value} / 10`;
    });

    controlWrap.append(leftLabel, slider, rightLabel);

    const nextBtn = document.createElement('button');
    nextBtn.className = 'btn btn-primary improvise-next';
    nextBtn.textContent = 'Next';
    nextBtn.addEventListener('click', () => {
      controlScore = Math.max(1, Math.min(10, Number(slider.value)));
      context.onInterim(task.key, null, { stabilityScore, anchorType, controlScore, phase: 'control' });
      showContinuityMeasure();
    });

    body.append(title, controlWrap, valueEl, nextBtn);
  }

  // ─── MEASURE 4: Continuity line drawing ──────────────────────────────────────
  function showContinuityMeasure() {
    if (cancelled) return;
    enterMeasureMode();

    const title = document.createElement('p');
    title.className = 'improvise-measure-title';
    title.textContent = 'How continuous did the experience feel?';

    const hint = document.createElement('p');
    hint.className = 'improvise-measure-hint';
    hint.textContent = 'Draw a line left to right  -  smooth for continuous, jagged for fragmented.';

    const canvasWrap = document.createElement('div');
    canvasWrap.className = 'improvise-field-wrap';

    const W = 360;
    const H = 120;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    canvas.className = 'improvise-continuity-canvas';
    canvasWrap.append(canvas);

    const ctx = canvas.getContext('2d');
    let drawing = false;
    const points = [];
    let hasDrawn = false;

    function drawGuide() {
      ctx.clearRect(0, 0, W, H);
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.22)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(20, H / 2);
      ctx.lineTo(W - 20, H / 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#000';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Draw here', 22, H - 10);
    }

    function redraw() {
      drawGuide();
      if (points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
      ctx.strokeStyle = 'rgba(190, 148, 255, 0.92)';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.setLineDash([]);
      ctx.stroke();
    }

    drawGuide();

    function getPos(e) {
      const rect = canvas.getBoundingClientRect();
      const sx = W / rect.width;
      const sy = H / rect.height;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return { x: (clientX - rect.left) * sx, y: (clientY - rect.top) * sy };
    }

    canvas.addEventListener('pointerdown', (e) => {
      drawing = true;
      hasDrawn = true;
      points.length = 0;
      points.push(getPos(e));
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drawing) return;
      points.push(getPos(e));
      redraw();
    });
    canvas.addEventListener('pointerup', () => { drawing = false; });

    const resetBtn = document.createElement('button');
    resetBtn.className = 'btn btn-secondary improvise-reset-btn';
    resetBtn.textContent = 'Reset';
    resetBtn.addEventListener('click', () => {
      points.length = 0;
      hasDrawn = false;
      drawGuide();
    });

    const doneBtn = document.createElement('button');
    doneBtn.className = 'btn btn-primary improvise-next';
    doneBtn.textContent = 'Complete';
    doneBtn.addEventListener('click', () => {
      continuityScore = hasDrawn ? calculateLineSmoothness(points) : 5;
      completeTask();
    });

    const btnRow = document.createElement('div');
    btnRow.className = 'flow-actions improvise-continuity-actions';
    btnRow.append(resetBtn, doneBtn);

    body.append(title, hint, canvasWrap, btnRow);
  }

  // Start the experience
  runNarrative();

  return () => {
    cancelled = true;
  };
}
