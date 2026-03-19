import {
  scoreAutobiographical,
  scoreAuditory,
  scoreGoal,
  scoreImageGeneration,
  scoreImageGenerationAuditory,
  scoreImageGenerationEmotion,
  scoreImageGenerationSmell,
  scoreImageGenerationTouch,
  scoreImageGenerationTotal,
  scoreExploration,
  scoreIntegration,
  scoreManipulation,
} from './scoring.js';
import { renderTaskImprovise } from './improvise.js';
import { renderTaskNavigation } from './navigation.js';
import { applyAssessmentChrome } from './components.js';

export const TASK_COUNT = 7;

export const TASKS = [
  { key: 'visualisation', title: 'Image Generation', subtitle: 'how you see thoughts' },
  { key: 'manipulation', title: 'Manipulation', subtitle: 'rotating shapes mentally' },
  { key: 'autobiographical', title: 'Autobiographical', subtitle: 'recalling real experiences in your mind' },
  { key: 'goal', title: 'Goal', subtitle: 'goal size and urgency' },
  { key: 'improvise', title: 'Improvise', subtitle: 'adapting mental worlds in motion' },
  { key: 'navigate', title: 'Navigation', subtitle: 'retracing spatial relationships in your mind' },
  { key: 'exploration', title: 'Exploration', subtitle: 'building fantastical scenes' },
];

const imagePaths = {
  lion: 'assets/img/imagery/lion_reference.png',
  cup: 'assets/img/imagery/coffee_cup.png',
  moonScene: 'assets/img/imagery/lion_unicycle_moon.png',
  glassEdge: 'assets/img/imagery/glass_edge.png',
  glassFall: 'assets/img/imagery/glass_fall.png',
};

function createTaskHeader(task) {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <div class="task-heading">
      <p class="imagine-task-label">IMAGINE</p>
      <h2 class="task-title">${task.title}</h2>
      ${task.subtitle ? `<p class="task-subtitle">${task.subtitle}</p>` : ''}
    </div>
  `;
  return wrapper.firstElementChild;
}

function renderCupVector(size = 170) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 220 220');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.classList.add('cup-vector');

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = `
    <linearGradient id="cupBody" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#fff8f1" />
      <stop offset="100%" stop-color="#ffe4cf" />
    </linearGradient>
    <linearGradient id="cupRim" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#ff9a3c" />
      <stop offset="100%" stop-color="#ff6a00" />
    </linearGradient>
  `;
  svg.append(defs);

  const saucer = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
  saucer.setAttribute('cx', '110');
  saucer.setAttribute('cy', '176');
  saucer.setAttribute('rx', '72');
  saucer.setAttribute('ry', '16');
  saucer.setAttribute('fill', '#ffd9bf');
  svg.append(saucer);

  const body = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  body.setAttribute('d', 'M 56 60 L 164 60 L 152 156 Q 110 176 68 156 Z');
  body.setAttribute('fill', 'url(#cupBody)');
  body.setAttribute('stroke', '#ff6a00');
  body.setAttribute('stroke-width', '4');
  svg.append(body);

  const rim = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
  rim.setAttribute('cx', '110');
  rim.setAttribute('cy', '60');
  rim.setAttribute('rx', '56');
  rim.setAttribute('ry', '14');
  rim.setAttribute('fill', '#fff');
  rim.setAttribute('stroke', 'url(#cupRim)');
  rim.setAttribute('stroke-width', '4');
  svg.append(rim);

  const handle = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  handle.setAttribute('d', 'M 163 84 C 196 84 199 134 166 134');
  handle.setAttribute('fill', 'none');
  handle.setAttribute('stroke', '#ff6a00');
  handle.setAttribute('stroke-width', '8');
  handle.setAttribute('stroke-linecap', 'round');
  svg.append(handle);

  return svg;
}

function imageWithFallback(src, alt) {
  const stage = document.createElement('div');
  stage.className = 'image-stage';

  const image = document.createElement('img');
  image.src = src;
  image.alt = alt;
  image.loading = 'eager';
  image.onerror = () => {
    stage.innerHTML = `<p class="fallback">Missing asset: ${src}</p>`;
  };

  stage.append(image);
  return { stage, image };
}

function sliderControl(label, min, max, value) {
  const wrap = document.createElement('div');
  wrap.className = 'control-wrap card';
  wrap.innerHTML = `
    <label>
      <span>${label}</span>
      <strong data-value>${value}</strong>
    </label>
    <input class="range" type="range" min="${min}" max="${max}" value="${value}" />
  `;
  return {
    wrap,
    input: wrap.querySelector('input'),
    valueEl: wrap.querySelector('[data-value]'),
  };
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function rotatePoint([x, y], rotation) {
  const angle = (rotation * Math.PI) / 180;
  const xr = x * Math.cos(angle) - y * Math.sin(angle);
  const yr = x * Math.sin(angle) + y * Math.cos(angle);
  return [Math.round(xr), Math.round(yr)];
}

function normalizeShape(cells) {
  const xs = cells.map((c) => c[0]);
  const ys = cells.map((c) => c[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return cells
    .map(([x, y]) => [x - minX, y - minY])
    .sort(([ax, ay], [bx, by]) => (ax - bx) || (ay - by));
}

function shapeToKey(cells) {
  return normalizeShape(cells)
    .map(([x, y]) => `${x},${y}`)
    .join('|');
}

function renderShapeSVG(cells, size = 112, options = {}) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 80 80');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));

  const cubes3d = Boolean(options.cubes3d);
  const normalized = normalizeShape(cells);
  const cellSize = cubes3d ? 14 : 16;
  const maxX = Math.max(...normalized.map((c) => c[0]));
  const maxY = Math.max(...normalized.map((c) => c[1]));
  const offsetX = (80 - (maxX + 1) * cellSize) / 2;
  const offsetY = (80 - (maxY + 1) * cellSize) / 2;

  normalized.forEach(([x, y]) => {
    const px = offsetX + x * cellSize;
    const py = offsetY + y * cellSize;

    if (!cubes3d) {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', String(px));
      rect.setAttribute('y', String(py));
      rect.setAttribute('width', String(cellSize - 2));
      rect.setAttribute('height', String(cellSize - 2));
      rect.setAttribute('rx', '3');
      rect.setAttribute('fill', '#f6f6f6');
      rect.setAttribute('stroke', '#000');
      rect.setAttribute('stroke-width', '1.8');
      svg.append(rect);
      return;
    }

    const depth = 3;
    const frontSize = cellSize - 3;

    const topFace = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    topFace.setAttribute(
      'points',
      `${px},${py} ${px + depth},${py - depth} ${px + frontSize + depth},${py - depth} ${px + frontSize},${py}`,
    );
    topFace.setAttribute('fill', '#2b2b2b');
    topFace.setAttribute('stroke', '#000');
    topFace.setAttribute('stroke-width', '0.9');

    const rightFace = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    rightFace.setAttribute(
      'points',
      `${px + frontSize},${py} ${px + frontSize + depth},${py - depth} ${px + frontSize + depth},${py + frontSize - depth} ${px + frontSize},${py + frontSize}`,
    );
    rightFace.setAttribute('fill', '#1b1b1b');
    rightFace.setAttribute('stroke', '#000');
    rightFace.setAttribute('stroke-width', '0.9');

    const frontFace = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    frontFace.setAttribute('x', String(px));
    frontFace.setAttribute('y', String(py));
    frontFace.setAttribute('width', String(frontSize));
    frontFace.setAttribute('height', String(frontSize));
    frontFace.setAttribute('rx', '1.8');
    frontFace.setAttribute('fill', '#efefef');
    frontFace.setAttribute('stroke', '#000');
    frontFace.setAttribute('stroke-width', '1.4');

    svg.append(topFace, rightFace, frontFace);
  });

  return svg;
}

const baseShapes = [
  [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 2],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
    [1, 1],
  ],
  [
    [0, 0],
    [0, 1],
    [1, 1],
    [2, 1],
  ],
  [
    [0, 0],
    [1, 0],
    [1, 1],
    [2, 1],
  ],
  [
    [0, 0],
    [1, 0],
    [2, 0],
    [2, 1],
  ],
];

const manipulationTrials = [
  {
    target: [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 2],
    ],
    options: [
      [
        [0, 0],
        [1, 0],
        [2, 0],
        [2, 1],
      ],
      [
        [0, 0],
        [1, 0],
        [2, 0],
        [0, 1],
      ],
      [
        [0, 0],
        [0, 1],
        [1, 1],
        [2, 1],
      ],
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [1, 2],
      ],
    ],
    correctIndex: 1,
  },
  {
    target: [
      [0, 0],
      [1, 0],
      [2, 0],
      [0, 1],
    ],
    options: [
      [
        [0, 0],
        [0, 1],
        [0, 2],
        [1, 0],
      ],
      [
        [0, 0],
        [1, 0],
        [2, 0],
        [2, 1],
      ],
      [
        [0, 0],
        [0, 1],
        [1, 1],
        [2, 1],
      ],
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [1, 2],
      ],
    ],
    correctIndex: 3,
  },
  {
    target: [
      [0, 0],
      [1, 0],
      [2, 0],
      [2, 1],
    ],
    options: [
      [
        [0, 0],
        [0, 1],
        [0, 2],
        [1, 0],
      ],
      [
        [1, 0],
        [1, 1],
        [0, 2],
        [1, 2],
      ],
      [
        [0, 0],
        [1, 0],
        [2, 0],
        [0, 1],
      ],
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [1, 2],
      ],
    ],
    correctIndex: 1,
  },
  {
    target: [
      [0, 0],
      [0, 1],
      [0, 2],
      [1, 0],
    ],
    options: [
      [
        [0, 0],
        [1, 0],
        [2, 0],
        [2, 1],
      ],
      [
        [0, 0],
        [1, 0],
        [2, 0],
        [0, 1],
      ],
      [
        [0, 0],
        [0, 1],
        [1, 1],
        [2, 1],
      ],
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [1, 2],
      ],
    ],
    correctIndex: 0,
  },
  {
    mode: 'folds',
    correctOptions: [0, 3],
    options: [
      { id: 1, top: 'navy', left: 'green', right: 'cyan' },
      { id: 3, top: 'green', left: 'orange', right: 'red' },
      { id: 4, top: 'navy', left: 'cyan', right: 'green' },
      { id: 2, top: 'red', left: 'green', right: 'orange' },
    ],
  },
];

const foldPalette = {
  orange: '#f7a247',
  green: '#37c28a',
  cyan: '#42c7d3',
  red: '#ef4a45',
  navy: '#1f2f6f',
};

function renderFoldTargetSVG() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 520 300');
  svg.classList.add('fold-target-svg');

  const orange = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  orange.setAttribute('points', '120,64 180,80 158,134 98,118');
  orange.setAttribute('fill', foldPalette.orange);
  orange.setAttribute('stroke', '#000');
  orange.setAttribute('stroke-width', '2.2');

  const green = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  green.setAttribute('points', '180,80 240,96 218,150 158,134');
  green.setAttribute('fill', foldPalette.green);
  green.setAttribute('stroke', '#000');
  green.setAttribute('stroke-width', '2.2');

  const cyan = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  cyan.setAttribute('points', '240,96 300,112 278,166 218,150');
  cyan.setAttribute('fill', foldPalette.cyan);
  cyan.setAttribute('stroke', '#000');
  cyan.setAttribute('stroke-width', '2.2');

  const red = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  red.setAttribute('points', '98,118 158,134 112,186');
  red.setAttribute('fill', foldPalette.red);
  red.setAttribute('stroke', '#000');
  red.setAttribute('stroke-width', '2.2');

  const navy = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  navy.setAttribute('points', '240,96 300,112 286,44');
  navy.setAttribute('fill', foldPalette.navy);
  navy.setAttribute('stroke', '#000');
  navy.setAttribute('stroke-width', '2.2');

  svg.append(orange, green, cyan, red, navy);
  return svg;
}

function renderFoldOptionSVG(option) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 150 140');
  svg.classList.add('fold-option-svg');

  const top = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  top.setAttribute('points', '34,28 114,44 58,60');
  top.setAttribute('fill', foldPalette[option.top]);
  top.setAttribute('stroke', '#000');
  top.setAttribute('stroke-width', '2');

  const left = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  left.setAttribute('points', '34,28 58,60 58,126 34,94');
  left.setAttribute('fill', foldPalette[option.left]);
  left.setAttribute('stroke', '#000');
  left.setAttribute('stroke-width', '2');

  const right = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  right.setAttribute('points', '58,60 114,44 114,110 58,126');
  right.setAttribute('fill', foldPalette[option.right]);
  right.setAttribute('stroke', '#000');
  right.setAttribute('stroke-width', '2');

  svg.append(top, left, right);
  return svg;
}

export function renderTask(taskNumber, context) {
  const task = TASKS[taskNumber - 1];
  if (!task) return null;

  if (taskNumber === 1) return renderTaskImageGeneration(task, context);
  if (taskNumber === 2) return renderTaskManipulation(task, context);
  if (taskNumber === 3) return renderTaskAutobiographical(task, context);
  if (taskNumber === 4) return renderTaskGoal(task, context);
  if (taskNumber === 5) return renderTaskImprovise(task, context, { createTaskHeader });
  if (taskNumber === 6) return renderTaskNavigation(task, context);
  return renderTaskExploration(task, context);
}

function renderTaskImageGeneration(task, context) {
  const root = context.root;
  root.innerHTML = '';

  const body = document.createElement('div');
  body.className = 'task-view task-panel card imagegen-sequence';
  root.append(body);
  applyAssessmentChrome(null, body);

  const stageHeading = document.createElement('div');
  stageHeading.className = 'imagegen-stage-head';
  stageHeading.innerHTML = `
    <h2 class="imagegen-stage-title">${task.title}</h2>
    <p class="imagegen-stage-subtitle">${task.subtitle}</p>
  `;

  const storedImageGeneration = context.state.scores.imageGeneration || context.state.scores.visualisation?.imageGeneration || {};
  const storedVisual = context.state.scores.visualisation || {};

  const stageScores = {
    visualisation: {
      total: Number(storedImageGeneration.visualisation?.total ?? storedVisual.total ?? 0),
      hue: Number(storedImageGeneration.visualisation?.hue ?? storedVisual.hue ?? 0),
      saturation: Number(storedImageGeneration.visualisation?.saturation ?? storedVisual.saturation ?? 100),
      brightness: Number(storedImageGeneration.visualisation?.brightness ?? storedVisual.brightness ?? 100),
      contrast: Number(storedImageGeneration.visualisation?.contrast ?? storedVisual.contrast ?? 100),
      detail: Number(storedImageGeneration.visualisation?.detail ?? storedVisual.detail ?? 50),
    },
    auditory: {
      total: Number(storedImageGeneration.auditory?.total ?? 0),
      volume: Number(storedImageGeneration.auditory?.volume ?? 0),
      clarity: Number(storedImageGeneration.auditory?.clarity ?? 0),
    },
    smell: {
      total: Number(storedImageGeneration.smell?.total ?? 1),
      intensity: Number(storedImageGeneration.smell?.intensity ?? 1),
      valence: storedImageGeneration.smell?.valence || 'neutral',
    },
    touch: {
      total: Number(storedImageGeneration.touch?.total ?? 1),
    },
    emotion: {
      total: Number(storedImageGeneration.emotion?.total ?? 0),
      direction: Number(storedImageGeneration.emotion?.direction ?? 0),
      intensity: Number(storedImageGeneration.emotion?.intensity ?? 0),
    },
  };

  const stages = [
    {
      key: 'visualisation',
      title: 'Image Generation: Visualisation',
      subtitle: 'Colour Reconstruction',
      progress: 'Visual 1/5',
      imagineLines: [
        'Imagine a lion.',
        'Close your eyes, or do whatever feels comfortable, and picture it as clearly as you can.',
      ],
      rateLines: ['Reconstruct the clarity of the lion in your mind using the sliders below. If you thought of a differernt lion or a cartoon image, please recreate the clarity in relation to the image shown.'],
    },
    {
      key: 'auditory',
      title: 'Image Generation: Auditory',
      subtitle: '',
      progress: 'Auditory 2/5',
      imagineLines: [
        'Think of the lion roaring.',
        'Imagine the sound as clearly as you can.',
      ],
      rateLines: ['Rate the imagined sound profile.'],
    },
    {
      key: 'smell',
      title: 'Image Generation: Smell',
      subtitle: '',
      progress: 'Smell 3/5',
      imagineLines: [
        'Think of how the lion would smell.',
        'Perhaps like a wet dog, or maybe something else.',
      ],
      rateLines: ['Drag the marker across the smell curve.'],
    },
    {
      key: 'touch',
      title: 'Image Generation: Touch',
      subtitle: '',
      progress: 'Touch 4/5',
      imagineLines: [
        'So, you decide to touch the lion and stroke his fur. Thankfully, he seems pleased.',
        'Imagine the feeling of stroking soft fur.',
      ],
      rateLines: ['Rate how vivid the touch sensation feels.'],
    },
    {
      key: 'emotion',
      title: 'Image Generation: Emotion',
      subtitle: '',
      progress: 'Emotion 5/5',
      imagineLines: [
        'You’ve been stroking the lion for too long and he’s hungry.',
        'He roars and you realise that you’ve just been stroking a lion.',
        'You feel a sense of urgency to get out of there.',
      ],
      rateLines: ['Rate your emotional intensity and direction.'],
    },
  ];

  const progressLabel = document.createElement('p');
  progressLabel.className = 'imagegen-subprogress';

  const anchor = document.createElement('div');
  anchor.className = 'imagegen-anchor image-stage';

  const anchorImage = document.createElement('img');
  anchorImage.src = imagePaths.lion;
  anchorImage.alt = 'Lion imagery anchor';
  anchorImage.className = 'imagegen-anchor-img';

  const overlay = document.createElement('div');
  overlay.className = 'imagegen-overlay';

  const timer = document.createElement('div');
  timer.className = 'imagegen-timer';
  timer.textContent = '10.00';

  anchor.append(anchorImage, overlay, timer);

  const controlsWrap = document.createElement('div');
  controlsWrap.className = 'imagegen-controls';

  const actions = document.createElement('div');
  actions.className = 'flow-actions';

  body.append(stageHeading, progressLabel, anchor, controlsWrap, actions);

  let cancelled = false;
  let countdownFrame = null;
  let stageIndex = 0;

  function updateHeader(stage) {
    const titleEl = stageHeading.querySelector('.imagegen-stage-title');
    const subtitleEl = stageHeading.querySelector('.imagegen-stage-subtitle');
    if (titleEl) titleEl.textContent = stage.title;
    if (subtitleEl) {
      subtitleEl.textContent = stage.subtitle || '';
      subtitleEl.style.display = stage.subtitle ? '' : 'none';
    }
    progressLabel.textContent = `Part 1: Image Generation · ${stage.progress}`;
  }

  function formatTimer(remainingMs) {
    return `${Math.max(0, remainingMs / 1000).toFixed(1)}s`;
  }

  function setOverlayLines(lines, fading = false) {
    overlay.innerHTML = lines.map((line) => `<p>${line}</p>`).join('');
    overlay.classList.toggle('is-fading', fading);
  }

  function buildImageGenerationPayload() {
    const imageGeneration = {
      visualisation: { ...stageScores.visualisation },
      auditory: { ...stageScores.auditory },
      smell: { ...stageScores.smell },
      touch: { ...stageScores.touch },
      emotion: { ...stageScores.emotion },
    };

    imageGeneration.total = scoreImageGenerationTotal(imageGeneration);
    return imageGeneration;
  }

  function buildLegacyVisualPayload(imageGeneration) {
    return {
      hue: imageGeneration.visualisation.hue,
      saturation: imageGeneration.visualisation.saturation,
      brightness: imageGeneration.visualisation.brightness,
      contrast: imageGeneration.visualisation.contrast,
      detail: imageGeneration.visualisation.detail,
      texture: imageGeneration.visualisation.detail,
      imageGeneration,
      imageGenerationTotal: imageGeneration.total,
      auditoryVolume: imageGeneration.auditory.volume,
      auditoryClarity: imageGeneration.auditory.clarity,
      smellIntensity: imageGeneration.smell.intensity,
      smellValence: imageGeneration.smell.valence,
      touchTotal: imageGeneration.touch.total,
      emotionDirection: imageGeneration.emotion.direction,
      emotionIntensity: imageGeneration.emotion.intensity,
    };
  }

  function pushInterim() {
    const imageGeneration = buildImageGenerationPayload();
    context.onInterim('imageGeneration', imageGeneration.total, imageGeneration);
    context.onInterim(task.key, imageGeneration.total, buildLegacyVisualPayload(imageGeneration));
  }

  function updateAnchorAppearance(stageKey, isRatingPhase) {
    anchor.classList.toggle('is-rating', isRatingPhase);
    const visual = stageScores.visualisation;

    if (stageKey === 'visualisation' && isRatingPhase) {
      const fadeToBlack = visual.brightness <= 6;
      const fadeToWhite = visual.brightness >= 194 && visual.contrast <= 16;
      const blur = (100 - visual.detail) * 0.22;
      anchor.style.background = fadeToBlack ? '#000' : '#fff';
      anchorImage.style.filter = `hue-rotate(${visual.hue}deg) saturate(${visual.saturation}%) brightness(${visual.brightness}%) contrast(${visual.contrast}%) blur(${Math.max(0, blur)}px)`;
      anchorImage.style.opacity = fadeToBlack || fadeToWhite ? '0' : '0.92';
      return;
    }

    anchor.style.background = '#0b0f17';
    anchorImage.style.filter = 'grayscale(12%) saturate(62%) brightness(52%) contrast(86%) blur(12px)';
    anchorImage.style.opacity = '0.26';
  }

  function runCountdown(durationMs = 10000) {
    timer.classList.add('is-active');
    const started = performance.now();

    return new Promise((resolve) => {
      const tick = (now) => {
        if (cancelled) return;
        const elapsed = now - started;
        const remaining = Math.max(0, durationMs - elapsed);
        timer.textContent = formatTimer(remaining);

        if (remaining > 0) {
          countdownFrame = requestAnimationFrame(tick);
        } else {
          timer.classList.remove('is-active');
          resolve();
        }
      };
      countdownFrame = requestAnimationFrame(tick);
    });
  }

  function renderStageActionButton(enabled, onContinue, onBack) {
    actions.innerHTML = `
      <button class="btn btn-secondary" type="button" id="imageGenBackBtn">Back</button>
      <button class="btn btn-primary" type="button" id="imageGenContinueBtn">Continue</button>
    `;
    const continueButton = actions.querySelector('#imageGenContinueBtn');
    const backButton = actions.querySelector('#imageGenBackBtn');

    continueButton.disabled = !enabled;
    continueButton.classList.toggle('is-disabled', !enabled);
    continueButton.addEventListener('click', onContinue);
    backButton.addEventListener('click', onBack);
    return continueButton;
  }

  function createAudioControl(label, value, onUpdate) {
    const wrap = document.createElement('section');
    wrap.className = 'audio-dial card';
    wrap.innerHTML = `
      <p class="audio-label">${label}</p>
      <div class="audio-bars" data-bars></div>
      <div class="audio-controls">
        <button type="button" class="audio-step" data-dir="down" aria-label="Decrease ${label}">−</button>
        <span class="audio-value" data-value>${value}/10</span>
        <button type="button" class="audio-step" data-dir="up" aria-label="Increase ${label}">+</button>
      </div>
    `;

    const bars = wrap.querySelector('[data-bars]');
    for (let i = 1; i <= 10; i += 1) {
      const bar = document.createElement('span');
      bar.className = 'audio-bar';
      bar.style.setProperty('--bar-height', `${24 + i * 6}px`);
      bars.append(bar);
    }

    const valueEl = wrap.querySelector('[data-value]');
    const paint = (nextValue) => {
      valueEl.textContent = `${nextValue}/10`;
      bars.querySelectorAll('.audio-bar').forEach((bar, index) => {
        bar.classList.toggle('is-active', index < nextValue);
      });
    };

    paint(value);
    wrap.querySelectorAll('.audio-step').forEach((button) => {
      button.addEventListener('click', () => {
        const next = Math.max(1, Math.min(10, value + (button.dataset.dir === 'up' ? 1 : -1)));
        value = next;
        paint(next);
        onUpdate(next);
      });
    });

    return wrap;
  }

  function renderVisualisationControls(onReady) {
    controlsWrap.innerHTML = '';
    controlsWrap.className = 'imagegen-controls control-grid';

    const v = stageScores.visualisation;
    const hueControl = sliderControl('Hue', -90, 90, v.hue);
    const satControl = sliderControl('Saturation', 0, 220, v.saturation);
    const brightControl = sliderControl('Brightness', 0, 220, v.brightness);
    const contrastControl = sliderControl('Contrast', 0, 220, v.contrast);
    const detailControl = sliderControl('Detail', 0, 100, v.detail);

    const controls = [
      { ref: hueControl, key: 'hue' },
      { ref: satControl, key: 'saturation' },
      { ref: brightControl, key: 'brightness' },
      { ref: contrastControl, key: 'contrast' },
      { ref: detailControl, key: 'detail' },
    ];

    let interacted = stageScores.visualisation.total > 0;
    onReady(interacted);

    controls.forEach((control) => {
      controlsWrap.append(control.ref.wrap);
      control.ref.input.addEventListener('input', () => {
        interacted = true;
        control.ref.valueEl.textContent = control.ref.input.value;
        stageScores.visualisation[control.key] = Number(control.ref.input.value);
        stageScores.visualisation.total = scoreImageGeneration({
          hue: stageScores.visualisation.hue,
          saturation: stageScores.visualisation.saturation,
          brightness: stageScores.visualisation.brightness,
          contrast: stageScores.visualisation.contrast,
          texture: stageScores.visualisation.detail,
        });
        updateAnchorAppearance('visualisation', true);
        pushInterim();
        onReady(interacted);
      });
    });

    updateAnchorAppearance('visualisation', true);
  }

  function renderAuditoryControls(onReady) {
    controlsWrap.innerHTML = '';
    controlsWrap.className = 'imagegen-controls audio-control-grid';

    let interacted = stageScores.auditory.total > 0;
    onReady(interacted);

    const updateAuditory = () => {
      interacted = true;
      stageScores.auditory.total = scoreImageGenerationAuditory(stageScores.auditory.volume, stageScores.auditory.clarity);
      pushInterim();
      onReady(interacted);
    };

    controlsWrap.append(
      createAudioControl('Volume', Math.max(1, stageScores.auditory.volume || 1), (value) => {
        stageScores.auditory.volume = value;
        updateAuditory();
      }),
      createAudioControl('Clarity', Math.max(1, stageScores.auditory.clarity || 1), (value) => {
        stageScores.auditory.clarity = value;
        updateAuditory();
      }),
    );
  }

  function renderSmellControls(onReady) {
    controlsWrap.innerHTML = '';
    controlsWrap.className = 'imagegen-controls';

    const wrap = document.createElement('section');
    wrap.className = 'card smell-wrap';
    wrap.innerHTML = `
      <div class="smell-label smell-left">Smells great</div>
      <div class="smell-label smell-center">No smell</div>
      <div class="smell-label smell-right">Smells awful</div>
      <svg viewBox="0 0 390 250" class="smell-svg" aria-label="Smell scale">
        <path id="smellPath" d="M 40 48 Q 195 220 350 48" fill="none" stroke="rgba(255,106,0,0.35)" stroke-width="6" stroke-linecap="round"></path>
        <circle id="smellHandle" cx="195" cy="220" r="12" fill="#ff6a00"></circle>
      </svg>
      <p class="smell-live" id="smellLive">Intensity: 1/10 · neutral</p>
    `;

    const svg = wrap.querySelector('.smell-svg');
    const handle = wrap.querySelector('#smellHandle');
    const live = wrap.querySelector('#smellLive');

    let interacted = stageScores.smell.total > 1;
    onReady(interacted);

    const pointAt = (t) => {
      const p0 = { x: 40, y: 48 };
      const p1 = { x: 195, y: 220 };
      const p2 = { x: 350, y: 48 };
      const x = (1 - t) ** 2 * p0.x + 2 * (1 - t) * t * p1.x + t ** 2 * p2.x;
      const y = (1 - t) ** 2 * p0.y + 2 * (1 - t) * t * p1.y + t ** 2 * p2.y;
      return { x, y };
    };

    const nearestT = (x, y) => {
      let bestT = 0.5;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (let i = 0; i <= 100; i += 1) {
        const t = i / 100;
        const p = pointAt(t);
        const d = Math.hypot(x - p.x, y - p.y);
        if (d < bestDistance) {
          bestDistance = d;
          bestT = t;
        }
      }
      return bestT;
    };

    const updateFromT = (t) => {
      const p = pointAt(t);
      handle.setAttribute('cx', String(p.x));
      handle.setAttribute('cy', String(p.y));

      const distanceFromCenter = Math.min(1, Math.abs(t - 0.5) / 0.5);
      const intensity = Math.max(1, Math.min(10, Math.round(1 + distanceFromCenter * 9)));
      let valence = 'neutral';
      if (Math.abs(t - 0.5) >= 0.1) {
        valence = t < 0.5 ? 'pleasant' : 'unpleasant';
      }

      stageScores.smell.intensity = intensity;
      stageScores.smell.valence = valence;
      stageScores.smell.total = scoreImageGenerationSmell(intensity);
      live.textContent = valence === 'neutral' ? `Intensity: ${intensity}/10 · no smell` : `Intensity: ${intensity}/10 · ${valence}`;
      pushInterim();
    };

    let dragging = false;
    const pointerToSvg = (event) => {
      const rect = svg.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) / rect.width) * 390,
        y: ((event.clientY - rect.top) / rect.height) * 250,
      };
    };

    svg.addEventListener('pointerdown', (event) => {
      dragging = true;
      interacted = true;
      const p = pointerToSvg(event);
      updateFromT(nearestT(p.x, p.y));
      onReady(interacted);
      if (svg.setPointerCapture) svg.setPointerCapture(event.pointerId);
    });

    svg.addEventListener('pointermove', (event) => {
      if (!dragging) return;
      const p = pointerToSvg(event);
      updateFromT(nearestT(p.x, p.y));
    });

    const stopDrag = () => {
      dragging = false;
    };

    svg.addEventListener('pointerup', stopDrag);
    svg.addEventListener('pointercancel', stopDrag);
    svg.addEventListener('pointerleave', stopDrag);

    const initialT = stageScores.smell.valence === 'pleasant'
      ? 0.24
      : stageScores.smell.valence === 'unpleasant'
        ? 0.76
        : 0.5;
    updateFromT(initialT);
    controlsWrap.append(wrap);
  }

  function renderTouchControls(onReady) {
    controlsWrap.innerHTML = '';
    controlsWrap.className = 'imagegen-controls';

    const wrap = document.createElement('section');
    wrap.className = 'card tactile-wrap';
    wrap.innerHTML = `
      <div class="tactile-labels">
        <span>I can’t imagine that</span>
        <span>I’m stroking a lion</span>
      </div>
      <input class="range tactile-range" type="range" min="1" max="10" value="${Math.max(1, stageScores.touch.total || 1)}" />
      <p class="tactile-value" id="touchValue">${Math.max(1, stageScores.touch.total || 1)}/10</p>
    `;

    const range = wrap.querySelector('.tactile-range');
    const value = wrap.querySelector('#touchValue');

    let interacted = stageScores.touch.total > 1;
    onReady(interacted);

    range.addEventListener('input', () => {
      interacted = true;
      stageScores.touch.total = scoreImageGenerationTouch(Number(range.value));
      value.textContent = `${stageScores.touch.total}/10`;
      pushInterim();
      onReady(interacted);
    });

    controlsWrap.append(wrap);
  }

  function renderEmotionControls(onReady) {
    controlsWrap.innerHTML = '';
    controlsWrap.className = 'imagegen-controls';

    const initialDirection = Number(stageScores.emotion.direction || 0);
    const initialSigned = initialDirection === 0 ? 0 : initialDirection * Number(stageScores.emotion.intensity || 0);

    const wrap = document.createElement('section');
    wrap.className = 'card emotion-wrap';
    wrap.innerHTML = `
      <input class="range emotion-range" type="range" min="-10" max="10" value="${initialSigned}" />
      <div class="emotion-labels">
        <span>I’m relaxed and am going to leave slowly</span>
        <span>No feeling</span>
        <span>I’m frightened and getting out of there quickly</span>
      </div>
      <p class="emotion-value" id="emotionValue">Intensity: ${Math.abs(initialSigned)}/10</p>
    `;

    const range = wrap.querySelector('.emotion-range');
    const value = wrap.querySelector('#emotionValue');

    let interacted = stageScores.emotion.intensity > 0;
    onReady(interacted);

    range.addEventListener('input', () => {
      interacted = true;
      const signed = Number(range.value);
      const direction = signed === 0 ? 0 : signed < 0 ? -1 : 1;
      const intensity = Math.abs(signed);
      stageScores.emotion.direction = direction;
      stageScores.emotion.intensity = intensity;
      stageScores.emotion.total = scoreImageGenerationEmotion(intensity);

      const tone = direction === 0 ? 'neutral' : direction < 0 ? 'calm' : 'alarmed';
      value.textContent = `Intensity: ${intensity}/10 · ${tone}`;
      pushInterim();
      onReady(interacted);
    });

    controlsWrap.append(wrap);
  }

  function renderControlsForStage(stage, onInteractionStateChange) {
    if (stage.key === 'visualisation') {
      renderVisualisationControls(onInteractionStateChange);
      return;
    }
    if (stage.key === 'auditory') {
      renderAuditoryControls(onInteractionStateChange);
      return;
    }
    if (stage.key === 'smell') {
      renderSmellControls(onInteractionStateChange);
      return;
    }
    if (stage.key === 'touch') {
      renderTouchControls(onInteractionStateChange);
      return;
    }
    renderEmotionControls(onInteractionStateChange);
  }

  async function runStage(index) {
    const stage = stages[index];
    if (!stage || cancelled) return;

    stageIndex = index;
    updateHeader(stage);
    controlsWrap.innerHTML = '';
    actions.innerHTML = '';

    updateAnchorAppearance(stage.key, false);
    setOverlayLines(stage.imagineLines);
    timer.textContent = '10.0s';

    await wait(3000);
    if (cancelled) return;

    await runCountdown(10000);
    if (cancelled) return;

    setOverlayLines(stage.rateLines, true);
    updateAnchorAppearance(stage.key, true);

    let continueButton = null;
    const updateContinueState = (enabled) => {
      if (!continueButton) return;
      continueButton.disabled = !enabled;
      continueButton.classList.toggle('is-disabled', !enabled);
    };

    continueButton = renderStageActionButton(false, () => {
      if (continueButton?.disabled) return;
      if (stageIndex < stages.length - 1) {
        runStage(stageIndex + 1);
        return;
      }

      const imageGeneration = buildImageGenerationPayload();
      context.onInterim('imageGeneration', imageGeneration.total, imageGeneration);
      context.onComplete(task.key, imageGeneration.total, buildLegacyVisualPayload(imageGeneration));
    }, () => {
      if (stageIndex > 0) {
        runStage(stageIndex - 1);
        return;
      }
      context.onBack?.();
    });

    renderControlsForStage(stage, (hasInteracted) => {
      updateContinueState(hasInteracted);
    });
  }

  runStage(0);

  return () => {
    cancelled = true;
    if (countdownFrame) {
      cancelAnimationFrame(countdownFrame);
      countdownFrame = null;
    }
  };
}

function renderTaskManipulation(task, context) {
  const root = context.root;
  root.innerHTML = '';
  const header = createTaskHeader(task);
  root.append(header);

  const body = document.createElement('div');
  body.className = 'task-view task-panel card';
  root.append(body);
  applyAssessmentChrome(header, body);

  const taskState = context.state.scores.manipulation || { tests: [] };
  const trialResults = Array.isArray(taskState.tests) ? [...taskState.tests] : [];

  let trialIndex = 0;
  let trialStart = 0;
  let accepting = true;
  let foldSelections = new Set();

  const trialLabel = document.createElement('p');
  trialLabel.className = 'task-subtitle';
  body.append(trialLabel);

  const frame = document.createElement('div');
  frame.className = 'rotation-grid';
  body.append(frame);

  const actions = document.createElement('div');
  actions.className = 'flow-actions';
  actions.innerHTML = `
    <button class="btn btn-secondary" type="button" id="backManipulation">Back</button>
    <button class="btn btn-primary" type="button" id="continueManipulation" style="display:none">Continue</button>
  `;
  actions.querySelector('#backManipulation').addEventListener('click', () => context.onBack?.());
  const continueBtn = actions.querySelector('#continueManipulation');
  body.append(actions);

  function renderTrial() {
    const trial = manipulationTrials[trialIndex];
    const shape = trial.target;
    const use3dCubes = trialIndex === 4;
    const isFoldTrial = trial.mode === 'folds';

    trialLabel.textContent = isFoldTrial
      ? `Which of these objects matches the unfolded paper target? Select two answers. Trial ${trialIndex + 1} of ${manipulationTrials.length}`
      : `Which option is the target rotated 90° clockwise once? Trial ${trialIndex + 1} of ${manipulationTrials.length}`;

    frame.innerHTML = '';
    const leftCard = document.createElement('div');
    leftCard.className = 'card rotation-target';
    if (isFoldTrial) {
      leftCard.append(renderFoldTargetSVG());
    } else {
      leftCard.append(renderShapeSVG(shape, 130, { cubes3d: use3dCubes }));
    }

    const rightCard = document.createElement('div');
    rightCard.className = 'option-grid';

    continueBtn.style.display = isFoldTrial ? 'inline-flex' : 'none';
    continueBtn.disabled = true;
    continueBtn.classList.add('is-disabled');
    continueBtn.onclick = null;

    if (isFoldTrial) {
      foldSelections = new Set();
    }

    trial.options.forEach((optionData, optionIndex) => {
      const option = document.createElement('button');
      option.className = 'shape-option';
      option.setAttribute('type', 'button');
      option.setAttribute('aria-label', `Option ${optionIndex + 1}`);
      if (isFoldTrial) {
        option.classList.add('fold-option');
        const label = document.createElement('span');
        label.className = 'fold-option-label';
        label.textContent = String(optionIndex + 1);
        option.append(label, renderFoldOptionSVG(optionData));
      } else {
        option.append(renderShapeSVG(optionData, 98, { cubes3d: use3dCubes }));
      }

      option.addEventListener('click', () => {
        if (!accepting) return;

        if (isFoldTrial) {
          if (foldSelections.has(optionIndex)) {
            foldSelections.delete(optionIndex);
            option.classList.remove('selected');
          } else {
            if (foldSelections.size >= 2) {
              return;
            }
            foldSelections.add(optionIndex);
            option.classList.add('selected');
          }

          const canContinue = foldSelections.size === 2;
          continueBtn.disabled = !canContinue;
          continueBtn.classList.toggle('is-disabled', !canContinue);
          return;
        }

        accepting = false;

        const correct = optionIndex === trial.correctIndex;
        option.classList.add(correct ? 'correct' : 'wrong');

        trialResults.push({
          correct,
          reactionTime: Math.max(250, performance.now() - trialStart),
          selectedOption: optionIndex,
        });

        const persistData = { tests: [...trialResults] };
        context.onInterim(task.key, null, persistData);

        wait(550).then(() => {
          trialIndex += 1;
          if (trialIndex >= manipulationTrials.length) {
            const score = scoreManipulation(trialResults);
            context.onComplete(task.key, score, persistData);
            return;
          }
          accepting = true;
          renderTrial();
        });
      });

      rightCard.append(option);
    });

    if (isFoldTrial) {
      continueBtn.onclick = () => {
        if (continueBtn.disabled || !accepting) return;
        accepting = false;

        const elapsedSeconds = (performance.now() - trialStart) / 1000;
        const correctSet = new Set(trial.correctOptions);
        const selected = [...foldSelections];
        const correctCount = selected.filter((index) => correctSet.has(index)).length;

        const accuracyPoints = correctCount === 2 ? 5 : correctCount === 1 ? 2.5 : 0;
        let speedPoints = 0;
        if (elapsedSeconds <= 15) {
          speedPoints = 5;
        } else if (elapsedSeconds <= 21) {
          speedPoints = 3;
        } else if (correctCount >= 1) {
          speedPoints = 2;
        }

        let trialScore = Math.min(10, accuracyPoints + speedPoints);
        if (correctCount === 0 && selected.length > 0) {
          trialScore = Math.max(1, trialScore);
        }

        trialResults.push({
          mode: 'folds',
          correct: correctCount === 2,
          reactionTime: Math.max(250, performance.now() - trialStart),
          selectedOptions: selected,
          correctCount,
          accuracyPoints,
          speedPoints,
          elapsedSeconds: Number(elapsedSeconds.toFixed(2)),
          trialScore,
        });

        const persistData = { tests: [...trialResults] };
        context.onInterim(task.key, null, persistData);
        const score = scoreManipulation(trialResults);
        context.onComplete(task.key, score, persistData);
      };
    }

    frame.append(leftCard, rightCard);
    trialStart = performance.now();
  }

  const keyHandler = (event) => {
    if (!accepting) return;
    const keyNumber = Number(event.key);
    if (keyNumber >= 1 && keyNumber <= 4) {
      const button = frame.querySelectorAll('.shape-option')[keyNumber - 1];
      if (button instanceof HTMLButtonElement) button.click();
    }
  };

  window.addEventListener('keydown', keyHandler);
  renderTrial();

  return () => {
    window.removeEventListener('keydown', keyHandler);
  };
}

function renderTaskAutobiographical(task, context) {
  const root = context.root;
  root.innerHTML = '';
  const header = createTaskHeader(task);
  root.append(header);

  const body = document.createElement('div');
  body.className = 'task-view task-panel card';
  root.append(body);
  applyAssessmentChrome(header, body);

  const previous = context.state.scores.autobiographical || {};
  const animals = Array.isArray(previous.animals) ? [...previous.animals] : [];
  const clarityScores = Array.isArray(previous.clarityScores) ? [...previous.clarityScores] : [];
  const dedupe = new Set(animals.map((animal) => animal.toLowerCase()));

  let stage = previous.phase || (animals.length ? (previous.continuityType ? 'continuity' : 'clarity') : 'activation');
  let currentRatingIndex = Math.max(0, Math.min(animals.length - 1, Number(previous.currentRatingIndex || 0)));
  let continuityType = previous.continuityType || null;
  let activationTimerId = null;
  let activationRemaining = 10;
  let activationComplete = stage !== 'activation';

  function averageClarityValue() {
    if (!clarityScores.length) return 0;
    return Number((clarityScores.reduce((sum, value) => sum + Number(value || 0), 0) / clarityScores.length).toFixed(1));
  }

  function persistInterim(score = null, extra = {}) {
    context.onInterim(task.key, score, {
      animals: [...animals],
      totalAnimals: animals.length,
      clarityScores: clarityScores.slice(0, animals.length),
      averageClarity: averageClarityValue(),
      continuityType,
      currentRatingIndex,
      phase: stage,
      ...extra,
    });
  }

  function completeTask() {
    const payload = {
      animals: [...animals],
      totalAnimals: animals.length,
      clarityScores: clarityScores.slice(0, animals.length).map((value) => Math.max(1, Math.min(10, Number(value || 1)))),
      averageClarity: averageClarityValue(),
      continuityType: continuityType || 'fragmented',
    };

    const scored = scoreAutobiographical(payload);
    context.onComplete(task.key, scored.score, {
      ...payload,
      averageClarity: scored.details.averageClarity,
      fluencyScaled: scored.details.fluencyScaled,
      vividness: scored.details.vividness,
      continuityBonus: scored.details.continuityBonus,
      phase: 'done',
    });
  }

  function renderStageShell(progressText, instructions = []) {
    body.innerHTML = '';

    const progress = document.createElement('p');
    progress.className = 'autobio-progress';
    progress.textContent = progressText;

    const instructionBlock = document.createElement('div');
    instructionBlock.className = 'autobio-copy';
    instructions.forEach((line) => {
      const paragraph = document.createElement('p');
      paragraph.className = 'task-instruction';
      paragraph.textContent = line;
      instructionBlock.append(paragraph);
    });

    const stageWrap = document.createElement('section');
    stageWrap.className = 'autobio-stage';

    const actions = document.createElement('div');
    actions.className = 'flow-actions';

    body.append(progress, instructionBlock, stageWrap, actions);
    return { stageWrap, actions, instructionBlock };
  }

  function renderActivationStage() {
    stage = 'activation';
    activationComplete = false;
    activationRemaining = 10;

    const titleEl = header.querySelector('.task-title');
    const subtitleEl = header.querySelector('.task-subtitle');
    if (titleEl) titleEl.textContent = 'Autobiographical';
    if (subtitleEl) {
      subtitleEl.textContent = 'Walk the Zoo';
      subtitleEl.style.display = '';
    }

    const { stageWrap, actions } = renderStageShell('Part 3: Autobiographical', []);

    stageWrap.classList.add('autobio-activation');
    stageWrap.innerHTML = `
      <div class="autobio-memory-field">
        <div class="autobio-memory-glow"></div>
        <div class="stage-timer autobio-timer" id="autobioActivationTimer">10.0s</div>
        <div class="autobio-overlay" id="autobioActivationOverlay">
          <p>Think about the last time you visited a zoo.</p>
          <p>If you haven’t, imagine a pet shop or somewhere similar.</p>
          <p>Place yourself at the entrance.</p>
        </div>
      </div>
    `;

    actions.innerHTML = `
      <button class="btn btn-secondary" type="button" id="autobioBackActivation">Back</button>
      <button class="btn btn-primary is-disabled" type="button" id="autobioBeginWalk" disabled>Continue</button>
    `;

    actions.querySelector('#autobioBackActivation')?.addEventListener('click', () => context.onBack?.());
    const continueBtn = actions.querySelector('#autobioBeginWalk');
    continueBtn?.addEventListener('click', () => {
      if (continueBtn.disabled) return;
      stage = 'sequence';
      persistInterim();
      renderSequenceStage();
    });

    const timerEl = stageWrap.querySelector('#autobioActivationTimer');
    const overlayEl = stageWrap.querySelector('#autobioActivationOverlay');

    const finishActivation = async () => {
      activationComplete = true;
      if (overlayEl) {
        overlayEl.classList.add('is-fading');
        await wait(260);
        if (stage !== 'activation') return;
        overlayEl.innerHTML = '<p>Now walk through the zoo in your mind.</p>';
        overlayEl.classList.remove('is-fading');
        overlayEl.classList.add('is-settled');
      }
      if (continueBtn) {
        continueBtn.disabled = false;
        continueBtn.classList.remove('is-disabled');
      }
      persistInterim();
    };

    activationTimerId = window.setInterval(() => {
      activationRemaining = Math.max(0, activationRemaining - 0.1);
      if (timerEl) timerEl.textContent = `${activationRemaining.toFixed(1)}s`;
      if (activationRemaining <= 0) {
        if (activationTimerId) {
          window.clearInterval(activationTimerId);
          activationTimerId = null;
        }
        finishActivation();
      }
    }, 100);
  }

  function renderSequenceStage() {
    stage = 'sequence';

    const { stageWrap, actions } = renderStageShell(
      'Part 3: Autobiographical · Walk the Zoo',
      [
        'Recall the animals in the order you encountered them.',
        'Build the memory as a path, one animal at a time.',
      ],
    );

    stageWrap.classList.add('autobio-path-stage');
    stageWrap.innerHTML = `
      <div class="autobio-input-row">
        <input class="autobio-input" id="autobioAnimalInput" type="text" maxlength="40" placeholder="Add the next animal you remember" />
        <button class="btn btn-primary" type="button" id="autobioAddAnimal">Add</button>
      </div>
      <p class="task-helper" id="autobioSequenceHint">Enter at least two animals. You can add up to 20.</p>
      <div class="autobio-path" id="autobioPath" aria-live="polite"></div>
    `;

    actions.innerHTML = `
      <button class="btn btn-secondary" type="button" id="autobioBackSequence">Back</button>
      <button class="btn btn-primary ${animals.length < 2 ? 'is-disabled' : ''}" type="button" id="autobioContinueSequence" ${animals.length < 2 ? 'disabled' : ''}>Continue</button>
    `;

    const input = stageWrap.querySelector('#autobioAnimalInput');
    const addBtn = stageWrap.querySelector('#autobioAddAnimal');
    const hint = stageWrap.querySelector('#autobioSequenceHint');
    const path = stageWrap.querySelector('#autobioPath');
    const continueBtn = actions.querySelector('#autobioContinueSequence');

    const renderAnimals = () => {
      path.innerHTML = '';
      animals.forEach((animal, index) => {
        const node = document.createElement('article');
        node.className = 'autobio-node';
        node.innerHTML = `
          <span class="autobio-node-step">Animal ${index + 1}</span>
          <strong>${animal}</strong>
        `;
        path.append(node);

        if (index < animals.length - 1) {
          const connector = document.createElement('span');
          connector.className = 'autobio-connector';
          connector.setAttribute('aria-hidden', 'true');
          connector.textContent = '→';
          path.append(connector);
        }
      });

      if (hint) {
        hint.textContent = animals.length >= 20
          ? 'You have reached the 20 animal limit.'
          : animals.length >= 2
            ? 'Your memory path is ready. Continue when you want to rate clarity.'
            : 'Enter at least two animals. You can add up to 20.';
      }

      if (continueBtn) {
        const enabled = animals.length >= 2;
        continueBtn.disabled = !enabled;
        continueBtn.classList.toggle('is-disabled', !enabled);
      }
    };

    const submitAnimal = () => {
      const value = input.value.trim();
      if (!value || animals.length >= 20) return;

      const normalized = value.toLowerCase();
      if (dedupe.has(normalized)) {
        input.value = '';
        input.placeholder = 'Already added. Try the next animal in the sequence.';
        return;
      }

      dedupe.add(normalized);
      animals.push(value);
      clarityScores.length = animals.length;
      input.value = '';
      input.placeholder = 'Add the next animal you remember';
      renderAnimals();
      persistInterim();
      path.scrollTo({ left: path.scrollWidth, behavior: 'smooth' });
      input.focus();
    };

    addBtn?.addEventListener('click', submitAnimal);
    input?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        submitAnimal();
      }
    });

    actions.querySelector('#autobioBackSequence')?.addEventListener('click', () => {
      if (animals.length) {
        renderActivationStage();
        return;
      }
      context.onBack?.();
    });

    continueBtn?.addEventListener('click', () => {
      if (continueBtn.disabled) return;
      stage = 'clarity';
      currentRatingIndex = Math.max(0, Math.min(currentRatingIndex, animals.length - 1));
      persistInterim();
      renderClarityStage();
    });

    renderAnimals();
    input?.focus();
  }

  function renderClarityStage() {
    stage = 'clarity';
    currentRatingIndex = Math.max(0, Math.min(currentRatingIndex, animals.length - 1));

    const currentAnimal = animals[currentRatingIndex];
    if (!currentAnimal) {
      renderSequenceStage();
      return;
    }

    if (!clarityScores[currentRatingIndex]) {
      clarityScores[currentRatingIndex] = 5;
    }

    const { stageWrap, actions } = renderStageShell(
      `Part 3: Autobiographical · Clarity ${currentRatingIndex + 1}/${animals.length}`,
      [`How clearly can you picture the ${currentAnimal}?`],
    );

    stageWrap.classList.add('autobio-clarity-stage');
    stageWrap.innerHTML = `
      <div class="autobio-clarity-figure" id="autobioClarityFigure" style="--clarity:${clarityScores[currentRatingIndex]}; --clarity-blur:${Math.max(0, 12 - clarityScores[currentRatingIndex] * 1.2)}px;">
        <div class="autobio-clarity-halo"></div>
        <div class="autobio-clarity-core">${currentAnimal}</div>
      </div>
      <div class="autobio-clarity-scale card">
        <label class="autobio-clarity-label" for="autobioClarityRange">
          <span>1/10 unclear</span>
          <strong id="autobioClarityValue">${clarityScores[currentRatingIndex]}/10</strong>
          <span>10/10 clear</span>
        </label>
        <input class="range" id="autobioClarityRange" type="range" min="1" max="10" value="${clarityScores[currentRatingIndex]}" />
      </div>
    `;

    actions.innerHTML = `
      <button class="btn btn-secondary" type="button" id="autobioBackClarity">Back</button>
      <button class="btn btn-primary" type="button" id="autobioContinueClarity">${currentRatingIndex >= animals.length - 1 ? 'Continue' : 'Next Animal'}</button>
    `;

    const figure = stageWrap.querySelector('#autobioClarityFigure');
    const range = stageWrap.querySelector('#autobioClarityRange');
    const valueEl = stageWrap.querySelector('#autobioClarityValue');

    const paintClarity = (value) => {
      const numeric = Math.max(1, Math.min(10, Number(value || 1)));
      clarityScores[currentRatingIndex] = numeric;
      if (valueEl) valueEl.textContent = `${numeric}/10`;
      if (figure) {
        figure.style.setProperty('--clarity', String(numeric));
        figure.style.setProperty('--clarity-blur', `${Math.max(0, 12 - numeric * 1.2)}px`);
      }
      persistInterim();
    };

    range?.addEventListener('input', () => {
      paintClarity(range.value);
    });

    actions.querySelector('#autobioBackClarity')?.addEventListener('click', () => {
      if (currentRatingIndex > 0) {
        currentRatingIndex -= 1;
        persistInterim();
        renderClarityStage();
        return;
      }
      renderSequenceStage();
    });

    actions.querySelector('#autobioContinueClarity')?.addEventListener('click', () => {
      paintClarity(range?.value || clarityScores[currentRatingIndex]);
      if (currentRatingIndex < animals.length - 1) {
        currentRatingIndex += 1;
        renderClarityStage();
        return;
      }
      stage = 'continuity';
      persistInterim();
      renderContinuityStage();
    });

    persistInterim();
  }

  function renderContinuityStage() {
    stage = 'continuity';

    const { stageWrap, actions } = renderStageShell(
      'Part 3: Autobiographical · Continuity',
      ['Did the memory feel like a continuous walk, or separate moments?'],
    );

    stageWrap.classList.add('autobio-continuity-stage');
    stageWrap.innerHTML = `
      <div class="autobio-continuity-grid">
        <button class="autobio-choice ${continuityType === 'continuous' ? 'is-selected' : ''}" type="button" data-value="continuous">
          <span class="autobio-choice-title">Continuous</span>
          <span class="autobio-choice-copy">The memory played as one walk through the scene.</span>
        </button>
        <button class="autobio-choice ${continuityType === 'fragmented' ? 'is-selected' : ''}" type="button" data-value="fragmented">
          <span class="autobio-choice-title">Fragmented</span>
          <span class="autobio-choice-copy">The memory came back in separate moments.</span>
        </button>
      </div>
    `;

    actions.innerHTML = `
      <button class="btn btn-secondary" type="button" id="autobioBackContinuity">Back</button>
      <button class="btn btn-primary ${continuityType ? '' : 'is-disabled'}" type="button" id="autobioFinishContinuity" ${continuityType ? '' : 'disabled'}>Continue</button>
    `;

    const finishBtn = actions.querySelector('#autobioFinishContinuity');
    stageWrap.querySelectorAll('.autobio-choice').forEach((button) => {
      button.addEventListener('click', () => {
        continuityType = button.dataset.value;
        stageWrap.querySelectorAll('.autobio-choice').forEach((choice) => {
          choice.classList.toggle('is-selected', choice === button);
        });
        if (finishBtn) {
          finishBtn.disabled = false;
          finishBtn.classList.remove('is-disabled');
        }
        persistInterim();
      });
    });

    actions.querySelector('#autobioBackContinuity')?.addEventListener('click', () => {
      currentRatingIndex = Math.max(0, animals.length - 1);
      renderClarityStage();
    });
    finishBtn?.addEventListener('click', () => {
      if (finishBtn.disabled) return;
      completeTask();
    });

    persistInterim();
  }

  if (stage === 'activation') {
    renderActivationStage();
  } else if (stage === 'sequence') {
    renderSequenceStage();
  } else if (stage === 'continuity') {
    renderContinuityStage();
  } else {
    renderClarityStage();
  }

  return () => {
    if (activationTimerId) {
      window.clearInterval(activationTimerId);
      activationTimerId = null;
    }
  };
}

function renderTaskGoal(task, context) {
  const root = context.root;
  root.innerHTML = '';
  const header = createTaskHeader(task);
  root.append(header);

  const body = document.createElement('div');
  body.className = 'task-view task-panel card';
  root.append(body);
  applyAssessmentChrome(header, body);

  const existing = context.state.scores.goal || { goalSize: 1, goalDistance: 0 };
  let step = 'size';
  let radius = Math.max(6, Math.min(120, Number(existing.goalSize || 1) * 12));
  let distance = Math.max(0, Math.min(100, Number(existing.goalDistance || 0) * 10));

  const card = document.createElement('div');
  card.className = 'card goal-wrap';
  body.append(card);

  const renderSizeStep = () => {
    card.innerHTML = '';
    const text = document.createElement('div');
    text.innerHTML = `
      <p class="task-subtitle">Think of a meaningful goal you often think about.</p>
      <p class="task-subtitle">Using the circle, draw the size of the goal. A big circle is a massive goal and a small circle is a small goal. If you have no goal, leave it as a dot.</p>
    `;

    const area = document.createElement('div');
    area.className = 'goal-area';
    const nowLabel = document.createElement('span');
    nowLabel.className = 'goal-now';
    nowLabel.textContent = 'NOW';

    const circle = document.createElement('div');
    circle.className = 'goal-circle';
    circle.style.width = `${radius * 2}px`;
    circle.style.height = `${radius * 2}px`;

    area.append(nowLabel, circle);

    const sizeControl = sliderControl('Goal Size', 1, 120, Math.round(radius));
    sizeControl.input.addEventListener('input', () => {
      radius = Number(sizeControl.input.value);
      sizeControl.valueEl.textContent = sizeControl.input.value;
      circle.style.width = `${radius * 2}px`;
      circle.style.height = `${radius * 2}px`;
      const goalSizeScore = Math.max(1, Math.round((radius / 120) * 9 + 1));
      context.onInterim(task.key, null, { goalSize: goalSizeScore, goalDistance: Math.max(0, Math.round(distance / 10)) });
    });

    const actions = document.createElement('div');
    actions.className = 'flow-actions';
    actions.innerHTML = `
      <button class="btn btn-secondary" type="button" id="backGoalSize">Back</button>
      <button class="btn btn-primary" type="button" id="lockGoalSize">Lock Goal Size</button>
    `;
    actions.querySelector('#backGoalSize').addEventListener('click', () => context.onBack?.());
    actions.querySelector('#lockGoalSize').addEventListener('click', () => {
      step = 'distance';
      renderDistanceStep();
    });

    card.append(text, area, sizeControl.wrap, actions);
  };

  const renderDistanceStep = () => {
    card.innerHTML = '';
    const text = document.createElement('div');
    text.innerHTML = `
      <p class="task-subtitle">How close are you to the goal you thought about?</p>
      <p class="task-subtitle">Pull the line back in time.</p>
    `;

    const map = document.createElement('div');
    map.className = 'goal-distance-map';
    map.innerHTML = `
      <div class="goal-future-label">FUTURE GOAL</div>
      <div class="goal-future-circle" style="width:${radius * 2}px;height:${radius * 2}px;"></div>
      <div class="goal-line" id="goalLine"></div>
      <div class="goal-now-floating" id="goalNow">NOW</div>
      <div class="goal-distance-note" id="goalDistanceNote"></div>
    `;

    const line = map.querySelector('#goalLine');
    const goalNow = map.querySelector('#goalNow');
    const distanceNote = map.querySelector('#goalDistanceNote');

    const updateDistanceVisual = () => {
      const rightAnchor = 18 + radius;
      const maxLine = Math.max(24, map.clientWidth - rightAnchor - 48);
      const width = (distance / 100) * maxLine;
      line.style.right = `${rightAnchor}px`;
      line.style.width = `${width}px`;

      const endPointX = map.clientWidth - (rightAnchor + width);
      goalNow.style.left = `${endPointX}px`;
      distanceNote.style.left = `${endPointX}px`;

      let activeLabel = '';
      const marks = [
        { threshold: 8, text: 'a few days away' },
        { threshold: 24, text: 'weeks' },
        { threshold: 44, text: 'months' },
        { threshold: 66, text: 'years' },
        { threshold: 86, text: 'decades' },
      ];
      marks.forEach((mark) => {
        if (distance >= mark.threshold) {
          activeLabel = mark.text;
        }
      });

      distanceNote.textContent = activeLabel;
      distanceNote.style.opacity = activeLabel ? '1' : '0';
    };

    const distanceControl = sliderControl('Goal Distance', 0, 100, Math.round(distance));
    distanceControl.input.addEventListener('input', () => {
      distance = Number(distanceControl.input.value);
      distanceControl.valueEl.textContent = distanceControl.input.value;
      updateDistanceVisual();
      const goalSizeScore = Math.max(1, Math.round((radius / 120) * 9 + 1));
      const goalDistanceScore = Math.round(distance / 10);
      context.onInterim(task.key, null, { goalSize: goalSizeScore, goalDistance: goalDistanceScore });
    });

    updateDistanceVisual();

    const actions = document.createElement('div');
    actions.className = 'flow-actions';
    actions.innerHTML = `
      <button class="btn btn-secondary" type="button" id="backGoalDistance">Back</button>
      <button class="btn btn-primary" type="button" id="continueGoalDistance">Continue</button>
    `;
    actions.querySelector('#backGoalDistance').addEventListener('click', () => {
      step = 'size';
      renderSizeStep();
    });
    actions.querySelector('#continueGoalDistance').addEventListener('click', () => {
      const goalSizeScore = Math.max(1, Math.round((radius / 120) * 9 + 1));
      const goalDistanceScore = Math.round(distance / 10);
      const total = scoreGoal(goalSizeScore, goalDistanceScore);
      context.onComplete(task.key, total, { goalSize: goalSizeScore, goalDistance: goalDistanceScore });
    });

    card.append(text, map, distanceControl.wrap, actions);
  };

  if (step === 'size') {
    renderSizeStep();
  } else {
    renderDistanceStep();
  }

  return () => null;
}

function renderTaskExploration(task, context) {
  const root = context.root;
  root.innerHTML = '';
  const header = createTaskHeader(task);
  root.append(header);

  const body = document.createElement('div');
  body.className = 'task-view task-panel card';
  root.append(body);
  applyAssessmentChrome(header, body);

  const existing = context.state.scores.exploration || { similarity: 5 };
  let cancelled = false;

  async function runSequence() {
    body.innerHTML = `
      <p class="task-subtitle countdown-accent exploration-instruction" id="exploreInstruction">Think of a single image: a lion juggling on a unicycle on the moon.</p>
      <div class="card countdown-card exploration-instruction" id="exploreInstructionCard">Visualize silently. Countdown begins now.</div>
      <p class="countdown countdown-accent countdown-fade" id="exploreCountdown" aria-live="polite">10</p>
    `;

    const instruction = body.querySelector('#exploreInstruction');
    const instructionCard = body.querySelector('#exploreInstructionCard');
    const counter = body.querySelector('#exploreCountdown');

    await wait(600);
    if (cancelled) return;
    counter.classList.add('is-visible');

    for (let i = 10; i >= 1; i -= 1) {
      if (cancelled) return;
      if (i <= 3) {
        counter.textContent = 'READY?';
        instruction.classList.add('is-hidden');
        instructionCard.classList.add('is-hidden');
      } else {
        counter.textContent = String(i);
      }
      await wait(1000);
    }

    if (cancelled) return;

    body.innerHTML = '';
    const prompt = document.createElement('p');
    prompt.className = 'task-subtitle';
    prompt.textContent = 'Rate how close your image was to this scene.';

    const media = imageWithFallback(imagePaths.moonScene, 'Fantastical scene');
    media.image.style.transition = 'filter 280ms ease';
    media.stage.classList.add('integration-image');

    const wrap = document.createElement('div');
    wrap.className = 'similarity-wrap';

    const scoreLine = document.createElement('p');
    scoreLine.className = 'task-subtitle';

    const track = document.createElement('div');
    track.className = 'similarity-track';

    const fill = document.createElement('div');
    fill.className = 'similarity-fill';
    track.append(fill);

    const labels = document.createElement('div');
    labels.className = 'scale-labels';
    labels.innerHTML = '<span>1 no image</span><span>10 very similar</span>';

    const range = document.createElement('input');
    range.className = 'range';
    range.type = 'range';
    range.min = '1';
    range.max = '10';
    range.value = String(existing.similarity || 5);

    const updateVisual = () => {
      const value = Number(range.value);
      fill.style.width = `${value * 10}%`;
      const clarity = (value - 1) / 9;
      const blur = (1 - clarity) * 14;
      const brightness = clarity <= 0.01 ? 0 : 18 + clarity * 92;
      const contrast = clarity <= 0.01 ? 220 : 35 + clarity * 85;
      const saturate = clarity * 100;
      const opacity = clarity <= 0.01 ? 0 : 0.08 + clarity * 0.92;
      media.stage.style.background = clarity <= 0.01 ? '#000' : '#fff';
      media.image.style.opacity = String(opacity);
      media.image.style.filter = `blur(${blur}px) brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%)`;
      scoreLine.textContent = `Similarity: ${value}/10`;
      context.onInterim(task.key, null, { similarity: value });
    };

    updateVisual();
    range.addEventListener('input', updateVisual);

    wrap.append(track, labels, range);

    const actions = document.createElement('div');
    actions.className = 'flow-actions';
    actions.innerHTML = `
      <button class="btn btn-secondary" type="button" id="backExploration">Back</button>
      <button class="btn btn-primary" type="button" id="continueExploration">Continue</button>
    `;
    actions.querySelector('#backExploration').addEventListener('click', () => context.onBack?.());
    actions.querySelector('#continueExploration').addEventListener('click', () => {
      const value = Number(range.value);
      context.onComplete(task.key, scoreExploration(value), { similarity: value });
    });

    body.append(prompt, media.stage, scoreLine, wrap, actions);
  }

  runSequence();

  return () => {
    cancelled = true;
  };
}

function createEqControl(label, selectedValue, onSelect) {
  const wrap = document.createElement('div');
  wrap.className = 'card';

  const title = document.createElement('p');
  title.className = 'task-subtitle';
  title.textContent = `${label}: ${selectedValue}/10`;

  const grid = document.createElement('div');
  grid.className = 'eq-grid';

  for (let i = 1; i <= 10; i += 1) {
    const col = document.createElement('button');
    col.type = 'button';
    col.className = 'eq-col';
    col.style.setProperty('--fill', `${i <= selectedValue ? 100 : 18}%`);
    col.setAttribute('aria-label', `${label} ${i} of 10`);
    col.addEventListener('click', () => onSelect(i));
    grid.append(col);
  }

  wrap.append(title, grid);
  return { wrap, title };
}

function renderTaskAuditory(task, context) {
  const root = context.root;
  root.innerHTML = '';
  const header = createTaskHeader(task);
  root.append(header);

  const body = document.createElement('div');
  body.className = 'task-view task-panel card';
  root.append(body);

  const existing = context.state.scores.auditory || { volume: 5, clarity: 5 };
  let loudness = Number(existing.volume ?? 5);
  let clarity = Number(existing.clarity ?? 5);

  const subtitle = document.createElement('p');
  subtitle.className = 'task-subtitle';
  subtitle.textContent =
    'A child is running around the room and accidentally hits the glass off the table. You watch it fall to the ground.';

  const first = imageWithFallback(imagePaths.glassEdge, 'Glass on table edge');
  const second = imageWithFallback(imagePaths.glassFall, 'Glass falling');

  second.stage.style.opacity = '0';
  second.stage.style.position = 'absolute';
  second.stage.style.inset = '0';

  const visual = document.createElement('div');
  visual.className = 'card auditory-image-wrap';
  visual.style.position = 'relative';
  visual.append(first.stage, second.stage);

  let showingSecond = false;
  const runVisualLoop = () => {
    first.stage.style.transition = 'opacity 520ms ease, filter 520ms ease';
    second.stage.style.transition = 'opacity 520ms ease, filter 520ms ease';
    showingSecond = !showingSecond;
    if (showingSecond) {
      first.stage.style.opacity = '0';
      first.stage.style.filter = 'blur(8px)';
      second.stage.style.opacity = '1';
      second.stage.style.filter = 'blur(0)';
      return;
    }
    first.stage.style.opacity = '1';
    first.stage.style.filter = 'blur(0)';
    second.stage.style.opacity = '0';
    second.stage.style.filter = 'blur(8px)';
  };

  const loopTimer = window.setInterval(runVisualLoop, 3000);

  const prompt = document.createElement('p');
  prompt.className = 'task-subtitle';
  prompt.textContent = 'Imagine the sound of the glass landing.';

  const controlsWrap = document.createElement('div');
  const actions = document.createElement('div');
  actions.className = 'flow-actions';
  actions.innerHTML = `
    <button class="btn btn-secondary" type="button" id="backAuditory">Back</button>
    <button class="btn btn-primary" type="button" id="continueAuditory">Continue</button>
  `;
  actions.querySelector('#backAuditory').addEventListener('click', () => context.onBack?.());

  const renderControls = () => {
    controlsWrap.innerHTML = '';

    const loud = createEqControl('Loudness', loudness, (value) => {
      loudness = value;
      context.onInterim(task.key, null, { loudness, clarity });
      renderControls();
    });

    const clear = createEqControl('Clarity', clarity, (value) => {
      clarity = value;
      context.onInterim(task.key, null, { loudness, clarity });
      renderControls();
    });

    controlsWrap.append(loud.wrap, clear.wrap);
  };

  actions.querySelector('#continueAuditory').addEventListener('click', () => {
    const score = scoreAuditory(loudness, clarity);
    context.onComplete(task.key, score, { volume: loudness, clarity });
  });

  renderControls();
  body.append(subtitle, visual, prompt, controlsWrap, actions);

  return () => {
    window.clearInterval(loopTimer);
  };
}
