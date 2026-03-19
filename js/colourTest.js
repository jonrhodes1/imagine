import { clampScore } from './scoring.js';

function hsvToRgb(h, s, v) {
  const sat = s / 100;
  const val = v / 100;
  const c = val * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = val - c;

  let r = 0;
  let g = 0;
  let b = 0;

  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

function hsvToHex(hsv) {
  const { r, g, b } = hsvToRgb(hsv.h, hsv.s, hsv.v);
  const toHex = (value) => value.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hsvDistance(a, b) {
  const dhRaw = Math.abs(a.h - b.h);
  const dh = Math.min(dhRaw, 360 - dhRaw) / 180;
  const ds = Math.abs(a.s - b.s) / 100;
  const dv = Math.abs(a.v - b.v) / 100;
  return Math.sqrt(dh * dh + ds * ds + dv * dv) / Math.sqrt(3);
}

function scoreFromDistance(distance) {
  return clampScore((1 - distance) * 10);
}

function shuffleArray(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function makePaletteColors(shuffled = false) {
  const colors = [];
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 14; col += 1) {
      const h = Math.round((col / 14) * 360);
      const s = 52 + row * 5;
      const v = 95 - row * 6;
      colors.push({ h, s, v, hex: hsvToHex({ h, s, v }) });
    }
  }
  return shuffled ? shuffleArray(colors) : colors;
}

function paletteElement(onPick, instructionText, options = {}) {
  const {
    shuffled = false,
    timerSeconds = 0,
    onTimeout = null,
    showBack = false,
    onBack = null,
  } = options;

  const wrapper = document.createElement('section');
  wrapper.className = 'task-view colour-stage';
  wrapper.innerHTML = `
    <h2 class="task-title">Colour Memory</h2>
    <p class="task-subtitle">${instructionText}</p>
    ${timerSeconds > 0 ? `<p class="task-subtitle colour-retest-timer">Time left: <strong id="colourRetestTimer">${timerSeconds}</strong>s</p>` : ''}
    <div class="colour-grid" id="colourGrid"></div>
    ${showBack ? '<div class="flow-actions"><button class="btn btn-secondary" type="button" id="colourBackBtn">Back</button></div>' : ''}
  `;

  const grid = wrapper.querySelector('#colourGrid');
  makePaletteColors(shuffled).forEach((entry) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'colour-cell';
    button.style.background = entry.hex;
    button.setAttribute('aria-label', `Select colour ${entry.hex}`);
    button.addEventListener('click', () => onPick(entry));
    grid.append(button);
  });

  if (timerSeconds > 0 && typeof onTimeout === 'function') {
    let remaining = timerSeconds;
    const timerEl = wrapper.querySelector('#colourRetestTimer');
    const countdownId = window.setInterval(() => {
      remaining -= 1;
      if (timerEl) timerEl.textContent = String(Math.max(0, remaining));
      if (remaining <= 0) {
        window.clearInterval(countdownId);
        onTimeout();
      }
    }, 1000);

    wrapper._cleanupTimer = () => window.clearInterval(countdownId);
  }

  if (showBack && typeof onBack === 'function') {
    wrapper.querySelector('#colourBackBtn')?.addEventListener('click', onBack);
  }

  return wrapper;
}

function slider(label, min, max, value) {
  const wrap = document.createElement('div');
  wrap.className = 'control-wrap card';
  wrap.innerHTML = `
    <label><span>${label}</span></label>
    <input class="range" type="range" min="${min}" max="${max}" value="${value}" />
  `;
  return { wrap, input: wrap.querySelector('input') };
}

export function renderColourMemoryStage(root, stageData, handlers) {
  let cancelled = false;
  const data = {
    firstFavouriteColour: stageData.firstFavouriteColour || null,
    secondFavouriteColour: stageData.secondFavouriteColour || null,
    targetHSV: stageData.targetHSV || null,
    recreatedHSV: stageData.recreatedHSV || { h: 180, s: 60, v: 70 },
    colourMemoryScore: stageData.colourMemoryScore || 0,
    colourPreferenceShift: stageData.colourPreferenceShift || 0,
  };

  const rerender = (node) => {
    if (cancelled) return;
    if (root.firstElementChild && typeof root.firstElementChild._cleanupTimer === 'function') {
      root.firstElementChild._cleanupTimer();
    }
    root.innerHTML = '';
    root.append(node);
  };

  const saveInterim = () => {
    handlers.onInterim({ ...data });
  };

  const showSecondPalette = () => {
    const second = paletteElement((entry) => {
      data.secondFavouriteColour = entry;
      const drift = data.firstFavouriteColour ? hsvDistance(data.firstFavouriteColour, data.secondFavouriteColour) : 0;
      data.colourPreferenceShift = Number((drift * 10).toFixed(2));
      saveInterim();
      handlers.onComplete({ ...data });
    }, 'Retest: choose your original favourite colour again from this shuffled palette.', {
      shuffled: true,
      timerSeconds: 14,
      showBack: true,
      onBack: showComparison,
      onTimeout: () => {
        if (cancelled) return;
        data.secondFavouriteColour = null;
        data.colourPreferenceShift = 10;
        saveInterim();
        handlers.onComplete({ ...data });
      },
    });
    rerender(second);
  };

  const showComparison = () => {
    const panel = document.createElement('section');
    panel.className = 'task-view colour-stage';
    panel.innerHTML = `
      <h2 class="task-title">Colour Match</h2>
      <p class="task-subtitle">Left is your reconstruction. Right is the original.</p>
      <div class="colour-compare">
        <div>
          <p class="task-subtitle">Yours</p>
          <div class="colour-patch" id="userPatch"></div>
        </div>
        <div>
          <p class="task-subtitle">Original</p>
          <div class="colour-patch" id="targetPatch"></div>
        </div>
      </div>
      <p class="task-subtitle score-line">Colour Memory Score: <strong id="memoryScore"></strong>/10</p>
      <div class="flow-actions">
        <button class="btn btn-secondary" type="button" id="backToRebuild">Back</button>
        <button class="btn btn-primary" type="button" id="continueScan">Continue to Retest</button>
      </div>
    `;

    panel.querySelector('#userPatch').style.background = hsvToHex(data.recreatedHSV);
    panel.querySelector('#targetPatch').style.background = hsvToHex(data.targetHSV);

    const distance = hsvDistance(data.recreatedHSV, data.targetHSV);
    data.colourMemoryScore = scoreFromDistance(distance);
    panel.querySelector('#memoryScore').textContent = String(data.colourMemoryScore);
    saveInterim();

    panel.querySelector('#backToRebuild').addEventListener('click', showReconstruction);
    panel.querySelector('#continueScan').addEventListener('click', showSecondPalette);
    rerender(panel);
  };

  const showReconstruction = () => {
    const panel = document.createElement('section');
    panel.className = 'task-view colour-stage';
    panel.innerHTML = `
      <h2 class="task-title">Recreate the colour</h2>
      <p class="task-subtitle">Use hue, saturation, and brightness to match what you saw.</p>
      <div class="colour-patch large" id="rebuildPatch"></div>
      <div class="control-grid" id="rebuildControls"></div>
      <div class="flow-actions">
        <button class="btn btn-secondary" type="button" id="rebuildBack">Back</button>
        <button class="btn btn-primary" type="button" id="confirmRebuild">Confirm</button>
      </div>
    `;

    const patch = panel.querySelector('#rebuildPatch');
    const controls = panel.querySelector('#rebuildControls');
    const hue = slider('Hue', 0, 360, data.recreatedHSV.h);
    const sat = slider('Saturation', 0, 100, data.recreatedHSV.s);
    const bri = slider('Brightness', 0, 100, data.recreatedHSV.v);

    [hue, sat, bri].forEach((control) => controls.append(control.wrap));

    const update = () => {
      data.recreatedHSV = {
        h: Number(hue.input.value),
        s: Number(sat.input.value),
        v: Number(bri.input.value),
      };
      patch.style.background = hsvToHex(data.recreatedHSV);
      saveInterim();
    };

    hue.input.addEventListener('input', update);
    sat.input.addEventListener('input', update);
    bri.input.addEventListener('input', update);
    update();

    panel.querySelector('#rebuildBack').addEventListener('click', showTargetFlash);
    panel.querySelector('#confirmRebuild').addEventListener('click', showComparison);
    rerender(panel);
  };

  const showTargetFlash = () => {
    const panel = document.createElement('section');
    panel.className = 'task-view colour-stage';
    panel.innerHTML = `
      <h2 class="task-title">Remember this colour</h2>
      <div class="colour-patch flash" id="targetFlash"></div>
    `;
    panel.querySelector('#targetFlash').style.background = hsvToHex(data.targetHSV);
    rerender(panel);

    window.setTimeout(() => {
      if (!cancelled) showReconstruction();
    }, 2000);
  };

  const showFirstPalette = () => {
    const first = paletteElement((entry) => {
      data.firstFavouriteColour = entry;
      data.targetHSV = {
        h: 128,
        s: 72,
        v: 56,
      };
      saveInterim();
      showTargetFlash();
    }, 'Select your favourite colour.', {
      showBack: true,
      onBack: () => handlers.onBack?.(),
    });
    rerender(first);
  };

  showFirstPalette();

  return () => {
    cancelled = true;
  };
}
