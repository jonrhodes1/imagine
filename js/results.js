import { getInterpretation } from './scoring.js';
import { TASKS } from './tasks.js';

function animateNumber(element, target, duration = 900) {
  const start = performance.now();

  function tick(now) {
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = Math.round(target * eased);
    element.textContent = String(value);
    if (progress < 1) requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

function drawRingChart(canvas, values) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const size = 320;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  ctx.clearRect(0, 0, size, size);

  const center = size / 2;
  const radius = 106;
  const arcWidth = 18;
  const gap = 0.1;
  const totalSlices = values.length;
  const sweep = (Math.PI * 2 - totalSlices * gap) / totalSlices;

  values.forEach((value, index) => {
    const start = -Math.PI / 2 + index * (sweep + gap);
    const end = start + sweep;
    const ratio = Math.max(0.05, value / 10);

    // Background arc.
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(10,10,10,0.12)';
    ctx.lineWidth = arcWidth;
    ctx.lineCap = 'round';
    ctx.arc(center, center, radius, start, end);
    ctx.stroke();

    // Foreground arc.
    ctx.beginPath();
    ctx.strokeStyle = `hsl(${22 + index * 7}, 95%, 52%)`;
    ctx.lineWidth = arcWidth;
    ctx.lineCap = 'round';
    ctx.arc(center, center, radius, start, start + (end - start) * ratio);
    ctx.stroke();
  });

  ctx.fillStyle = '#0a0a0a';
  ctx.font = '700 14px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('IMAGERY PROFILE', center, center + 4);
}

function hsvToCss(hsv) {
  if (!hsv) return 'hsl(22 95% 52%)';
  return `hsl(${Math.round(hsv.h)} ${Math.round(hsv.s)}% ${Math.round(hsv.v / 1.2)}%)`;
}

function polarToCartesian(cx, cy, radius, angleDeg) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad),
  };
}

function arcPath(cx, cy, radius, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

function appendArc(svg, cfg) {
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', arcPath(cfg.cx, cfg.cy, cfg.radius, cfg.start, cfg.end));
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', cfg.color);
  path.setAttribute('stroke-width', String(cfg.width));
  path.setAttribute('stroke-linecap', 'round');
  path.style.opacity = String(cfg.opacity ?? 0.85);
  path.style.transition = 'opacity 220ms ease';
  if (cfg.tooltip) {
    path.dataset.tooltip = cfg.tooltip;
    path.classList.add('retina-segment');
  }
  if (cfg.delay !== undefined) {
    const len = path.getTotalLength();
    path.style.strokeDasharray = String(len);
    path.style.strokeDashoffset = String(len);
    path.style.animation = `retinaDraw 800ms ease ${cfg.delay}ms forwards`;
  }
  svg.append(path);
  return path;
}

function appendRadialBar(svg, cfg) {
  const p1 = polarToCartesian(cfg.cx, cfg.cy, cfg.inner, cfg.angle);
  const p2 = polarToCartesian(cfg.cx, cfg.cy, cfg.outer, cfg.angle);
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', String(p1.x));
  line.setAttribute('y1', String(p1.y));
  line.setAttribute('x2', String(p2.x));
  line.setAttribute('y2', String(p2.y));
  line.setAttribute('stroke', cfg.color);
  line.setAttribute('stroke-width', String(cfg.width ?? 5));
  line.setAttribute('stroke-linecap', 'round');
  line.style.opacity = '0.85';
  if (cfg.tooltip) {
    line.dataset.tooltip = cfg.tooltip;
    line.classList.add('retina-segment');
  }
  if (cfg.delay !== undefined) {
    const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    line.style.strokeDasharray = String(len);
    line.style.strokeDashoffset = String(len);
    line.style.animation = `retinaDraw 700ms ease ${cfg.delay}ms forwards`;
  }
  svg.append(line);
  return line;
}

function appendDot(svg, cfg) {
  const point = polarToCartesian(cfg.cx, cfg.cy, cfg.radius, cfg.angle);
  const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  dot.setAttribute('cx', String(point.x));
  dot.setAttribute('cy', String(point.y));
  dot.setAttribute('r', String(cfg.size));
  dot.setAttribute('fill', cfg.color);
  dot.style.opacity = String(cfg.opacity ?? 0.8);
  if (cfg.tooltip) {
    dot.dataset.tooltip = cfg.tooltip;
    dot.classList.add('retina-segment');
  }
  if (cfg.delay !== undefined) {
    dot.style.transformOrigin = `${point.x}px ${point.y}px`;
    dot.style.transformBox = 'fill-box';
    dot.style.animation = `retinaPop 480ms ease ${cfg.delay}ms both`;
  }
  svg.append(dot);
  return dot;
}

function markDecorative(element) {
  element.style.pointerEvents = 'none';
  element.setAttribute('aria-hidden', 'true');
  return element;
}

function scoreValue(entry) {
  if (typeof entry === 'number') return entry;
  if (entry && typeof entry.total === 'number') return entry.total;
  return 0;
}

function scorePayload(state, key, fallbackKey = null) {
  const directTaskData = state.taskData?.[key];
  if (directTaskData) return directTaskData;
  const directScore = state.scores?.[key];
  if (directScore && typeof directScore === 'object') return directScore;
  if (fallbackKey) {
    const fallbackTaskData = state.taskData?.[fallbackKey];
    if (fallbackTaskData) return fallbackTaskData;
    const fallbackScore = state.scores?.[fallbackKey];
    if (fallbackScore && typeof fallbackScore === 'object') return fallbackScore;
  }
  return {};
}

function totalScore(state) {
  return TASKS.reduce((sum, task) => sum + scoreValue(state.scores?.[task.key]), 0);
}

let jsPdfLoader = null;
let html2CanvasLoader = null;

function ensureJsPdfLoaded() {
  if (window.jspdf?.jsPDF) {
    return Promise.resolve(window.jspdf.jsPDF);
  }
  if (jsPdfLoader) return jsPdfLoader;

  jsPdfLoader = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js';
    script.async = true;
    script.onload = () => {
      const ctor = window.jspdf?.jsPDF;
      if (ctor) resolve(ctor);
      else reject(new Error('jsPDF loaded but constructor was not found.'));
    };
    script.onerror = () => reject(new Error('Failed to load jsPDF library.'));
    document.head.append(script);
  });

  return jsPdfLoader;
}

function ensureHtml2CanvasLoaded() {
  if (window.html2canvas) {
    return Promise.resolve(window.html2canvas);
  }
  if (html2CanvasLoader) return html2CanvasLoader;

  html2CanvasLoader = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
    script.async = true;
    script.onload = () => {
      if (window.html2canvas) resolve(window.html2canvas);
      else reject(new Error('html2canvas loaded but constructor was not found.'));
    };
    script.onerror = () => reject(new Error('Failed to load html2canvas library.'));
    document.head.append(script);
  });

  return html2CanvasLoader;
}

function createPdfStage(state, total, interpretation, retinaWrap) {
  const stage = document.createElement('section');
  stage.style.position = 'fixed';
  stage.style.left = '-99999px';
  stage.style.top = '0';
  stage.style.width = '1120px';
  stage.style.padding = '34px';
  stage.style.background = 'linear-gradient(180deg, #fff8f2 0%, #ffffff 68%)';
  stage.style.color = '#0a0a0a';
  stage.style.fontFamily = 'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif';

  const brand = document.createElement('div');
  brand.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;border:1px solid rgba(255,106,0,0.24);border-radius:16px;background:#fff;padding:14px 18px;box-shadow:0 10px 24px rgba(255,106,0,0.12);">
      <div style="font-size:40px;font-weight:900;letter-spacing:-0.03em;color:#ff6a00;line-height:1;">IMAGINE</div>
      <div style="text-align:right;">
        <div style="font-size:16px;font-weight:700;color:#ff6a00;">Imagery Retina Report</div>
        <div style="font-size:12px;color:#5f5f66;">${new Date().toLocaleString()}</div>
      </div>
    </div>
  `;

  const summary = document.createElement('div');
  summary.innerHTML = `
    <div style="margin-top:16px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;">
      <div style="border:1px solid rgba(255,106,0,0.24);border-radius:14px;padding:12px;background:#fff;">
        <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#5f5f66;">Total Score</div>
        <div style="font-size:34px;font-weight:900;color:#ff6a00;">${total}<span style="font-size:18px;color:#5f5f66;">/${TASKS.length * 10}</span></div>
      </div>
      <div style="border:1px solid rgba(255,106,0,0.24);border-radius:14px;padding:12px;background:#fff;">
        <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#5f5f66;">Profile</div>
        <div style="font-size:22px;font-weight:800;color:#0a0a0a;">${interpretation}</div>
      </div>
      <div style="border:1px solid rgba(255,106,0,0.24);border-radius:14px;padding:12px;background:#fff;">
        <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#5f5f66;">Colour Memory</div>
        <div style="font-size:22px;font-weight:800;color:#0a0a0a;">${Number(state.postResults?.colourMemoryScore || 0)}/10</div>
      </div>
    </div>
  `;

  const retinaClone = retinaWrap.cloneNode(true);
  const tooltip = retinaClone.querySelector('.retina-tooltip');
  if (tooltip) tooltip.remove();

  const footer = document.createElement('div');
  footer.innerHTML = `
    <div style="margin-top:14px;border-top:1px dashed rgba(10,10,10,0.2);padding-top:8px;font-size:12px;color:#5f5f66;display:flex;justify-content:space-between;gap:8px;">
      <span>Generated by IMAGINE imagery assessment.</span>
      <span>Premium Retina Summary</span>
    </div>
  `;

  stage.append(brand, summary, retinaClone, footer);
  document.body.append(stage);
  return stage;
}

async function downloadResultsPdf(state, total, interpretation, retinaWrap) {
  const JsPdf = await ensureJsPdfLoaded();
  const html2canvas = await ensureHtml2CanvasLoaded();
  const doc = new JsPdf({ unit: 'pt', format: 'a4' });

  const stage = createPdfStage(state, total, interpretation, retinaWrap);
  const canvas = await html2canvas(stage, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
  });
  stage.remove();

  const imageData = canvas.toDataURL('image/png');
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 18;
  const usableW = pageW - margin * 2;
  const usableH = pageH - margin * 2;

  const ratio = Math.min(usableW / canvas.width, usableH / canvas.height);
  const drawW = canvas.width * ratio;
  const drawH = canvas.height * ratio;
  const x = (pageW - drawW) / 2;
  const y = margin;

  doc.addImage(imageData, 'PNG', x, y, drawW, drawH, undefined, 'FAST');

  doc.save('imagine-results.pdf');
}

function createRetinaSvg(state, tooltipEl, onHoverInfo, irisColor) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 1200 1200');
  svg.classList.add('retina-svg');

  const cx = 600;
  const cy = 600;
  const irisRadius = 320;

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = `
    <radialGradient id="irisGradient" cx="45%" cy="42%" r="62%">
      <stop offset="0%" stop-color="#d8f0ff" />
      <stop offset="22%" stop-color="${irisColor}" />
      <stop offset="58%" stop-color="#31577f" />
      <stop offset="100%" stop-color="#060b14" />
    </radialGradient>
    <radialGradient id="pupilGradient" cx="44%" cy="40%" r="65%">
      <stop offset="0%" stop-color="#171717" />
      <stop offset="55%" stop-color="#040404" />
      <stop offset="100%" stop-color="#000000" />
    </radialGradient>
    <radialGradient id="corneaGlow" cx="38%" cy="28%" r="72%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.55)" />
      <stop offset="44%" stop-color="rgba(255,255,255,0.14)" />
      <stop offset="100%" stop-color="rgba(255,255,255,0)" />
    </radialGradient>
    <filter id="eyeShadow" x="-20%" y="-30%" width="140%" height="180%">
      <feDropShadow dx="0" dy="28" stdDeviation="32" flood-color="rgba(0,0,0,0.34)" />
    </filter>
    <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="10" />
    </filter>
  `;
  svg.append(defs);

  const backShadow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  backShadow.setAttribute('cx', String(cx));
  backShadow.setAttribute('cy', String(cy + 36));
  backShadow.setAttribute('r', String(irisRadius + 152));
  backShadow.setAttribute('fill', 'rgba(0,0,0,0.18)');
  backShadow.setAttribute('filter', 'url(#softGlow)');
  svg.append(markDecorative(backShadow));

  const whiteRing = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  whiteRing.setAttribute('cx', String(cx));
  whiteRing.setAttribute('cy', String(cy));
  whiteRing.setAttribute('r', String(irisRadius + 88));
  whiteRing.setAttribute('fill', 'none');
  whiteRing.setAttribute('stroke', 'rgba(255,255,255,0.95)');
  whiteRing.setAttribute('stroke-width', '52');
  whiteRing.setAttribute('filter', 'url(#eyeShadow)');
  svg.append(markDecorative(whiteRing));

  const darkRing = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  darkRing.setAttribute('cx', String(cx));
  darkRing.setAttribute('cy', String(cy));
  darkRing.setAttribute('r', String(irisRadius + 28));
  darkRing.setAttribute('fill', 'none');
  darkRing.setAttribute('stroke', 'rgba(7,11,18,0.76)');
  darkRing.setAttribute('stroke-width', '5');
  svg.append(markDecorative(darkRing));

  const irisGlow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  irisGlow.setAttribute('cx', String(cx));
  irisGlow.setAttribute('cy', String(cy));
  irisGlow.setAttribute('r', String(irisRadius + 58));
  irisGlow.setAttribute('fill', 'rgba(135, 187, 255, 0.14)');
  irisGlow.setAttribute('filter', 'url(#softGlow)');
  svg.append(markDecorative(irisGlow));

  const eyeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  svg.append(eyeGroup);

  const iris = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  iris.setAttribute('cx', String(cx));
  iris.setAttribute('cy', String(cy));
  iris.setAttribute('r', String(irisRadius));
  iris.setAttribute('fill', 'url(#irisGradient)');
  iris.setAttribute('stroke', 'rgba(9, 12, 18, 0.7)');
  iris.setAttribute('stroke-width', '4');
  eyeGroup.append(markDecorative(iris));

  for (let i = 0; i < 64; i += 1) {
    appendRadialBar(eyeGroup, {
      cx,
      cy,
      angle: i * (360 / 64),
      inner: 130 + (i % 3) * 10,
      outer: irisRadius - 10 + (i % 4) * 2,
      color: i % 5 === 0 ? 'rgba(255,255,255,0.16)' : 'rgba(10,18,34,0.24)',
      width: i % 4 === 0 ? 3.2 : 2.1,
    });
  }

  const rings = [
    { key: 'imageGeneration', radius: 286, color: '#ffcf5d' },
    { key: 'manipulation', radius: 246, color: '#ff8440' },
    { key: 'autobiographical', radius: 206, color: '#73c988' },
    { key: 'navigation', radius: 166, color: '#53cfe0' },
    { key: 'integration', radius: 128, color: '#d878ff' },
    { key: 'improvise', radius: 96, color: '#9c6fef' },
  ];

  const imageData = scorePayload(state, 'imageGeneration', 'visualisation');
  const imageGenerationParts = imageData.visualisation
    ? imageData
    : (imageData.imageGeneration && imageData.imageGeneration.visualisation ? imageData.imageGeneration : null);
  const visualData = imageGenerationParts?.visualisation || imageData;
  const imageMetrics = [
    { label: 'Hue', value: Math.max(0, Math.min(10, 10 - Math.abs(Number(visualData.hue || 0)) / 9)) },
    { label: 'Saturation', value: Math.max(0, Math.min(10, Number(visualData.saturation || 0) / 22)) },
    { label: 'Brightness', value: Math.max(0, Math.min(10, Number(visualData.brightness || 0) / 22)) },
    { label: 'Contrast', value: Math.max(0, Math.min(10, Number(visualData.contrast || 0) / 22)) },
    { label: 'Detail', value: Math.max(0, Math.min(10, Number(visualData.detail || visualData.texture || 0) / 10)) },
  ];

  imageMetrics.forEach((metric, i) => {
    appendRadialBar(eyeGroup, {
      cx,
      cy,
      angle: -78 + i * 32,
      inner: rings[0].radius - 16,
      outer: rings[0].radius - 16 + metric.value * 11,
      color: rings[0].color,
      width: 7,
      delay: 70 + i * 55,
      tooltip: `Image Generation ${metric.label}: ${metric.value.toFixed(1)}/10`,
    });
  });

  const sensoryMetrics = [
    { name: 'Auditory', value: Number(imageGenerationParts?.auditory?.total || 0), angle: 82 },
    { name: 'Smell', value: Number(imageGenerationParts?.smell?.total || 0), angle: 114 },
    { name: 'Touch', value: Number(imageGenerationParts?.touch?.total || 0), angle: 146 },
    { name: 'Emotion', value: Number(imageGenerationParts?.emotion?.total || 0), angle: 178 },
  ];

  sensoryMetrics.forEach((metric, index) => {
    appendRadialBar(eyeGroup, {
      cx,
      cy,
      angle: metric.angle,
      inner: rings[0].radius - 8,
      outer: rings[0].radius - 8 + Math.max(0, Math.min(10, metric.value)) * 9,
      color: '#ffd981',
      width: 5,
      delay: 340 + index * 60,
      tooltip: `Image Generation ${metric.name}: ${Math.max(0, Math.min(10, metric.value)).toFixed(1)}/10`,
    });
  });

  const trials = scorePayload(state, 'manipulation').trialResults || scorePayload(state, 'manipulation').tests || [];
  for (let i = 0; i < 5; i += 1) {
    const trial = trials[i];
    const value = trial ? (trial.correct ? 9 : 2.5) : 0;
    appendRadialBar(eyeGroup, {
      cx,
      cy,
      angle: 108 + i * 26,
      inner: rings[1].radius - 12,
      outer: rings[1].radius - 12 + value * 9.5,
      color: rings[1].color,
      width: 7,
      delay: 420 + i * 60,
      tooltip: `Manipulation Trial ${i + 1}: ${Math.round(value)}/10`,
    });
  }

  const autobiographical = scorePayload(state, 'autobiographical');
  const autobiographicalAnimals = Array.isArray(autobiographical.animals) ? autobiographical.animals : [];
  const autobiographicalClarity = Array.isArray(autobiographical.clarityScores)
    ? autobiographical.clarityScores.map((value) => Math.max(1, Math.min(10, Number(value || 1))))
    : [];
  const autobiographicalCount = Math.max(
    Number(autobiographical.totalAnimals || 0),
    autobiographicalAnimals.length,
    autobiographicalClarity.length,
  );
  const continuityType = autobiographical.continuityType === 'fragmented' ? 'fragmented' : 'continuous';
  const fluencyValue = Math.max(0, Math.min(10, Number(autobiographical.fluencyScaled || autobiographicalCount / 1.2 || 0)));
  const vividnessValue = Math.max(0, Math.min(10, Number(autobiographical.averageClarity || 0)));
  const continuityValue = continuityType === 'continuous' ? 10 : 4;

  if (autobiographicalCount > 0) {
    const breakFrequency = continuityType === 'fragmented' ? Math.max(2, Math.ceil(autobiographicalCount / 3)) : Infinity;
    const breakCount = continuityType === 'fragmented' ? Math.floor((autobiographicalCount - 1) / breakFrequency) : 0;
    const startAngle = 188;
    const totalSpan = 144;
    const breakAngle = continuityType === 'fragmented' ? 8 : 0;
    const usableSpan = totalSpan - breakCount * breakAngle;
    const spacing = autobiographicalCount > 1 ? usableSpan / (autobiographicalCount - 1) : 0;

    if (continuityType === 'continuous') {
      appendArc(eyeGroup, {
        cx,
        cy,
        radius: rings[2].radius,
        start: startAngle - 5,
        end: startAngle + totalSpan + 5,
        width: 8,
        color: 'rgba(115, 201, 136, 0.42)',
        delay: 760,
        tooltip: `Autobiographical Continuity: Continuous`,
      });
    } else {
      let segmentStart = startAngle - 2;
      for (let index = 0; index < autobiographicalCount; index += breakFrequency) {
        const segmentLength = Math.min(breakFrequency, autobiographicalCount - index);
        const segmentSpan = segmentLength <= 1 ? 10 : (segmentLength - 1) * spacing + 6;
        appendArc(eyeGroup, {
          cx,
          cy,
          radius: rings[2].radius,
          start: segmentStart,
          end: segmentStart + segmentSpan,
          width: 8,
          color: 'rgba(115, 201, 136, 0.28)',
          delay: 760 + index * 24,
          tooltip: `Autobiographical Continuity: Fragmented`,
        });
        segmentStart += segmentSpan + breakAngle;
      }
    }

    let angle = startAngle;
    for (let index = 0; index < autobiographicalCount; index += 1) {
      if (index > 0 && continuityType === 'fragmented' && index % breakFrequency === 0) {
        angle += breakAngle;
      }
      const clarity = autobiographicalClarity[index] || Math.max(1, Math.round(vividnessValue));
      const animal = autobiographicalAnimals[index] || `Animal ${index + 1}`;
      appendDot(eyeGroup, {
        cx,
        cy,
        radius: rings[2].radius,
        angle,
        size: 4.5 + clarity * 0.34,
        color: `rgba(143, 232, 166, ${Math.min(0.95, 0.36 + clarity * 0.05)})`,
        opacity: Math.min(0.96, 0.34 + clarity * 0.055),
        delay: 820 + index * 55,
        tooltip: `Autobiographical Animal ${index + 1}: ${animal} · clarity ${clarity}/10`,
      });
      angle += spacing;
    }

    [
      { name: 'Fluency', value: fluencyValue, angle: 188 },
      { name: 'Vividness', value: vividnessValue, angle: 236 },
      { name: 'Continuity', value: continuityValue, angle: 284 },
    ].forEach((metric, index) => {
      appendRadialBar(eyeGroup, {
        cx,
        cy,
        angle: metric.angle,
        inner: rings[2].radius - 16,
        outer: rings[2].radius - 16 + metric.value * 7.2,
        color: rings[2].color,
        width: 5,
        delay: 940 + index * 70,
        tooltip: metric.name === 'Continuity'
          ? `Autobiographical ${metric.name}: ${continuityType}`
          : `Autobiographical ${metric.name}: ${metric.value.toFixed(1)}/10`,
      });
    });
  }

  const navigationData = scorePayload(state, 'navigate');
  const navigationScore = Math.max(0, Math.min(10, Number(navigationData.score ?? navigationData.total ?? scoreValue(state.scores?.navigate) ?? 0)));
  const navigationMeanError = Math.max(0, Number(navigationData.meanError ?? 0));
  const navigationStart = 214;
  const navigationSweep = navigationScore * 24;
  const navigationWidth = 6 + navigationScore * 0.8;

  for (let tick = 0; tick < 24; tick += 1) {
    appendRadialBar(eyeGroup, {
      cx,
      cy,
      angle: -38 + tick * 8,
      inner: rings[3].radius - 6,
      outer: rings[3].radius + (tick % 3 === 0 ? 8 : 3),
      color: 'rgba(131, 222, 235, 0.22)',
      width: tick % 3 === 0 ? 1.6 : 1,
    });
  }

  appendArc(eyeGroup, {
    cx,
    cy,
    radius: rings[3].radius,
    start: navigationStart,
    end: navigationStart + navigationSweep,
    width: navigationWidth,
    color: rings[3].color,
    delay: 1040,
    tooltip: `Navigation Spatial Accuracy: ${navigationScore.toFixed(1)}/10 · mean error ${navigationMeanError.toFixed(1)}°`,
  });

  const integrationData = scorePayload(state, 'integration', 'exploration');
  const integrationValue = Number(integrationData.similarity ?? scoreValue(state.scores?.integration) ?? scoreValue(state.scores?.exploration) ?? 0);
  appendArc(eyeGroup, {
    cx,
    cy,
    radius: rings[4].radius,
    start: -28,
    end: -28 + integrationValue * 27.5,
    width: 14,
    color: rings[4].color,
    delay: 1120,
    tooltip: `Exploration Similarity: ${integrationValue}/10`,
  });

  const improviseData = scorePayload(state, 'improvise');
  const improviseStability = Math.max(0, Math.min(10, Number(improviseData.stabilityScore || 0)));
  const improviseControl = Math.max(0, Math.min(10, Number(improviseData.controlScore || 0)));
  const improviseContinuity = Math.max(0, Math.min(10, Number(improviseData.continuityScore || 0)));
  const improviseAnchor = String(improviseData.anchorType || '');
  const improviseFragmented = improviseAnchor === 'Nothing stayed stable';
  const improviseBaseWidth = 4.5 + improviseStability * 1.1;

  if (improviseFragmented) {
    // Fragmented: draw broken arcs to represent unstable imagery
    for (let seg = 0; seg < 3; seg += 1) {
      appendArc(eyeGroup, {
        cx,
        cy,
        radius: rings[5].radius,
        start: 28 + seg * 100,
        end: 28 + seg * 100 + improviseStability * 20,
        width: improviseBaseWidth,
        color: rings[5].color,
        delay: 1220 + seg * 90,
        tooltip: `Improvise Stability: ${improviseStability.toFixed(1)}/10 · Fragmented`,
      });
    }
  } else {
    // Solid arc  -  width driven by stability
    appendArc(eyeGroup, {
      cx,
      cy,
      radius: rings[5].radius,
      start: 28,
      end: 28 + improviseStability * 27,
      width: improviseBaseWidth,
      color: rings[5].color,
      delay: 1220,
      tooltip: `Improvise Stability: ${improviseStability.toFixed(1)}/10`,
    });
  }

  // Inner arc  -  control/agency (outer glow intensity)
  appendArc(eyeGroup, {
    cx,
    cy,
    radius: rings[5].radius - 10,
    start: 28,
    end: 28 + improviseControl * 26,
    width: 6,
    color: '#c8a8ff',
    delay: 1310,
    tooltip: `Improvise Control: ${improviseControl.toFixed(1)}/10`,
  });

  // Continuity band
  appendArc(eyeGroup, {
    cx,
    cy,
    radius: rings[5].radius + 10,
    start: 28,
    end: 28 + improviseContinuity * 26,
    width: 4,
    color: 'rgba(180, 130, 255, 0.48)',
    delay: 1380,
    tooltip: `Improvise Continuity: ${improviseContinuity.toFixed(1)}/10`,
  });

  // Anchor highlight node
  if (improviseAnchor && !improviseFragmented) {
    appendDot(eyeGroup, {
      cx,
      cy,
      radius: rings[5].radius,
      angle: 28 + improviseStability * 13.5,
      size: 5.5,
      color: '#e2c8ff',
      opacity: 0.92,
      delay: 1450,
      tooltip: `Improvise Anchor: ${improviseAnchor}`,
    });
  }

  const pupilHalo = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  pupilHalo.setAttribute('cx', String(cx));
  pupilHalo.setAttribute('cy', String(cy));
  pupilHalo.setAttribute('r', '108');
  pupilHalo.setAttribute('fill', 'rgba(0,0,0,0.18)');
  pupilHalo.setAttribute('filter', 'url(#softGlow)');
  eyeGroup.append(markDecorative(pupilHalo));

  const pupil = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  pupil.setAttribute('cx', String(cx));
  pupil.setAttribute('cy', String(cy));
  pupil.setAttribute('r', '92');
  pupil.setAttribute('fill', 'url(#pupilGradient)');
  eyeGroup.append(markDecorative(pupil));

  const cornea = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
  cornea.setAttribute('cx', String(cx));
  cornea.setAttribute('cy', String(cy - 8));
  cornea.setAttribute('rx', '352');
  cornea.setAttribute('ry', '340');
  cornea.setAttribute('fill', 'url(#corneaGlow)');
  eyeGroup.append(markDecorative(cornea));

  const shine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  shine.setAttribute('d', 'M 504 344 C 548 242 662 204 754 244 C 662 270 592 344 552 446 C 534 414 520 384 504 344 Z');
  shine.setAttribute('fill', 'rgba(255,255,255,0.42)');
  shine.setAttribute('filter', 'url(#softGlow)');
  eyeGroup.append(markDecorative(shine));

  const microShine = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
  microShine.setAttribute('cx', '622');
  microShine.setAttribute('cy', '402');
  microShine.setAttribute('rx', '30');
  microShine.setAttribute('ry', '18');
  microShine.setAttribute('fill', 'rgba(255,255,255,0.72)');
  eyeGroup.append(markDecorative(microShine));

  const lowerReflection = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  lowerReflection.setAttribute('d', 'M 360 746 C 470 828 730 846 846 826');
  lowerReflection.setAttribute('fill', 'none');
  lowerReflection.setAttribute('stroke', 'rgba(255,255,255,0.18)');
  lowerReflection.setAttribute('stroke-width', '14');
  lowerReflection.setAttribute('stroke-linecap', 'round');
  eyeGroup.append(markDecorative(lowerReflection));

  const tooltipMove = (event) => {
    const text = event.target?.dataset?.tooltip;
    if (!text) return;
    const hostRect = svg.getBoundingClientRect();
    const x = event.clientX - hostRect.left + 16;
    const y = event.clientY - hostRect.top + 16;
    tooltipEl.style.left = `${x}px`;
    tooltipEl.style.top = `${y}px`;
    tooltipEl.style.bottom = 'auto';
    tooltipEl.style.transform = 'none';
  };

  svg.addEventListener('pointerover', (event) => {
    const target = event.target;
    if (!(target instanceof SVGElement)) return;
    const segment = target.closest('.retina-segment');
    const text = segment?.dataset?.tooltip;
    if (!text) return;
    tooltipEl.textContent = text;
    tooltipEl.classList.add('visible');
    onHoverInfo?.(text);
  });

  svg.addEventListener('pointermove', tooltipMove);

  svg.addEventListener('pointerleave', () => {
    tooltipEl.classList.remove('visible');
  });

  return svg;
}

export function renderResults(root, state, handlers) {
  root.innerHTML = '';

  const view = document.createElement('div');
  view.className = 'task-view';

  const title = document.createElement('h2');
  title.className = 'task-title';
  title.textContent = 'Your Imagery Retina';

  const subtitle = document.createElement('p');
  subtitle.className = 'task-subtitle';
  subtitle.textContent = 'This visual profile reflects how your mind generates, manipulates, recalls, improvises, navigates, and explores imagery.';

  const total = totalScore(state);
  const interpretation = getInterpretation(total);

  const retinaWrap = document.createElement('section');
  retinaWrap.className = 'retina-wrap';

  const bgColor = hsvToCss(state.postResults?.secondFavouriteColour || state.postResults?.firstFavouriteColour);
  const drift = Number(state.postResults?.colourPreferenceShift || 0);
  retinaWrap.style.background = `radial-gradient(circle at 22% 15%, rgba(255,255,255,0.08), transparent 36%), radial-gradient(circle at 78% 8%, rgba(255,255,255,0.06), transparent 30%), linear-gradient(160deg, #070a12 0%, #0c1220 58%, #03060f 100%)`;
  const irisColor = `color-mix(in oklab, ${bgColor} ${Math.max(42, 72 - drift)}%, rgba(255,255,255,0.08))`;

  const retinaCanvas = document.createElement('div');
  retinaCanvas.className = 'retina-canvas';

  const tooltip = document.createElement('div');
  tooltip.className = 'retina-tooltip';
  tooltip.textContent = '';

  const feedbackCard = document.createElement('aside');
  feedbackCard.className = 'retina-feedback card';
  feedbackCard.innerHTML = `
    <h3>Imagery Feedback</h3>
    <p class="feedback-total">Total: <strong id="totalAnimated">0</strong>/${TASKS.length * 10}</p>
    <p class="feedback-band">${interpretation}</p>
    <p class="feedback-live" id="feedbackLive">Hover the retina to inspect each assessment.</p>
    <ul class="feedback-list">
      ${TASKS.map((task) => `<li><span>${task.title}</span><strong>${scoreValue(state.scores?.[task.key])}/10</strong></li>`).join('')}
    </ul>
  `;

  retinaCanvas.append(
    createRetinaSvg(state, tooltip, (text) => {
      const live = feedbackCard.querySelector('#feedbackLive');
      if (live) live.textContent = text;
    }, irisColor),
    tooltip,
  );
  retinaWrap.append(retinaCanvas, feedbackCard);

  const actions = document.createElement('div');
  actions.className = 'flow-actions';
  actions.innerHTML = `
    <button class="btn btn-secondary" type="button" id="downloadResultsPdf">Download PDF</button>
    <button class="btn btn-primary" type="button">Retake Assessment</button>
    <a class="btn btn-secondary" href="index.html">Back to Home</a>
  `;

  const [downloadButton, retakeButton] = actions.querySelectorAll('button');
  retakeButton.addEventListener('click', handlers.onRetake);
  downloadButton.addEventListener('click', async () => {
    if (downloadButton.disabled) return;
    const originalText = downloadButton.textContent;
    downloadButton.disabled = true;
    downloadButton.textContent = 'Preparing PDF...';
    try {
      await downloadResultsPdf(state, total, interpretation, retinaWrap);
    } catch (error) {
      console.error(error);
      window.print();
    } finally {
      downloadButton.disabled = false;
      downloadButton.textContent = originalText;
    }
  });

  view.append(title, subtitle, retinaWrap, actions);
  root.append(view);

  const totalAnimated = document.getElementById('totalAnimated');
  if (totalAnimated) animateNumber(totalAnimated, total);
}
