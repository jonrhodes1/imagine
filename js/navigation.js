import { applyAssessmentChrome } from './components.js';
import { scoreNavigate } from './scoring.js';

const LAYOUT = {
  width: 720,
  height: 420,
  points: {
    'Home': { x: 360, y: 210, icon: '🏠' },
    'Bus Station': { x: 425, y: 94, icon: '🚌' },
    'Airport': { x: 570, y: 166, icon: '✈️' },
    'Park': { x: 168, y: 146, icon: '🌳' },
    'Mountains': { x: 282, y: 286, icon: '⛰️' },
    'Beach': { x: 530, y: 318, icon: '🏖️' },
  },
};

const NORTH_REFERENCE = {
  x: 360,
  y: 72,
};

const TRIALS = [
  {
    target: 'Park',
    reference: 'mountains',
    prompt:
      'Standing at Home, facing the Mountains, you are the black dot on the dial. First imagine which direction you are standing in. Now point to the Park.',
  },
  {
    target: 'Beach',
    reference: 'mountains',
    prompt: 'Facing the Mountains, point to the Beach.',
  },
  {
    target: 'Bus Station',
    reference: 'mountains',
    prompt: 'Facing the Mountains, point to the Bus Station.',
  },
  {
    target: 'Airport',
    reference: 'mountains',
    prompt: 'And finally, point to the Airport.',
  },
];

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

function normalizeAngle(value) {
  const wrapped = Number(value) % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

function bearingFromTo(fromPoint, toPoint) {
  const dx = toPoint.x - fromPoint.x;
  const dy = toPoint.y - fromPoint.y;
  return normalizeAngle((Math.atan2(dx, -dy) * 180) / Math.PI);
}

function angularError(a, b) {
  const diff = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  return diff > 180 ? 360 - diff : diff;
}

function averageError(trials) {
  if (!trials.length) return 0;
  return trials.reduce((sum, trial) => sum + Number(trial.error || 0), 0) / trials.length;
}

function quadrantError(a, b) {
  const aQuadrant = Math.floor(normalizeAngle(a) / 90);
  const bQuadrant = Math.floor(normalizeAngle(b) / 90);
  const rawStepDiff = Math.abs(aQuadrant - bQuadrant);
  const wrappedStepDiff = Math.min(rawStepDiff, 4 - rawStepDiff);
  return wrappedStepDiff * 90;
}

function buildMapMarkup(options = {}) {
  const { showFacingArrow = false, showReadyButton = true } = options;
  const home = LAYOUT.points.Home;
  const mountains = LAYOUT.points.Mountains;
  const homeXPct = (home.x / LAYOUT.width) * 100;
  const homeYPct = (home.y / LAYOUT.height) * 100;
  const mountainsXPct = (mountains.x / LAYOUT.width) * 100;
  const mountainsYPct = (mountains.y / LAYOUT.height) * 100;
  const midwayToMountainsXPct = ((home.x + mountains.x) / 2 / LAYOUT.width) * 100;
  const midwayToMountainsYPct = ((home.y + mountains.y) / 2 / LAYOUT.height) * 100;

  const locations = Object.entries(LAYOUT.points)
    .map(([name, point]) => {
      const left = (point.x / LAYOUT.width) * 100;
      const top = (point.y / LAYOUT.height) * 100;
      return `
        <figure class="navx-node" style="left:${left}%;top:${top}%">
          <span class="navx-icon" aria-hidden="true">${point.icon}</span>
          <figcaption>${name}</figcaption>
        </figure>
      `;
    })
    .join('');

  return `
    <div class="navx-map" id="navxMap">
      <div class="navx-map-haze" aria-hidden="true"></div>
      <svg class="navx-north-line" aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none">
        <line x1="50" y1="0" x2="${homeXPct.toFixed(2)}" y2="${homeYPct.toFixed(2)}"
          stroke="rgba(178,223,232,0.22)" stroke-width="0.55" stroke-linecap="round"/>
      </svg>
      ${showFacingArrow
        ? `<svg class="navx-facing-arrow" aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none">
            <line x1="${homeXPct.toFixed(2)}" y1="${homeYPct.toFixed(2)}" x2="${midwayToMountainsXPct.toFixed(2)}" y2="${midwayToMountainsYPct.toFixed(2)}"
              stroke="rgba(178,223,232,0.52)" stroke-width="0.75" stroke-linecap="round"/>
            <polygon points="0,-1.05 2.2,0 0,1.05" fill="rgba(206,243,255,0.75)"
              transform="translate(${midwayToMountainsXPct.toFixed(2)} ${midwayToMountainsYPct.toFixed(2)}) rotate(${bearingFromTo(home, mountains) - 90})"/>
          </svg>`
        : ''}
      <div class="navx-map-north" aria-label="Cardinal direction north">
        <svg class="navx-compass-rose" viewBox="0 0 60 72" aria-hidden="true">
          <path d="M 30 3 L 43 32 L 30 24 L 17 32 Z" fill="currentColor"/>
          <text x="30" y="66" text-anchor="middle" class="navx-compass-text">N</text>
        </svg>
      </div>
      ${locations}
      <div class="navx-home-ring" aria-hidden="true"></div>
      ${showReadyButton ? '<button class="btn btn-primary navx-ready-btn" type="button" id="startNavigationTrials">Continue When Ready</button>' : ''}
    </div>
  `;
}

function mapInstruction(trial) {
  return trial.prompt;
}

function buildSummaryDialMarkup(trialResults) {
  const home = LAYOUT.points.Home;
  const handPalette = ['#7dff5b', '#ffe44d', '#48ddff', '#ff69d8', '#ff9f43'];

  const landmarks = Object.entries(LAYOUT.points)
    .filter(([name]) => name !== 'Home')
    .map(([name, point]) => {
      const bearing = bearingFromTo(home, point);
      const radians = (bearing * Math.PI) / 180;
      const pointRadius = 40;
      const labelRadius = 47;
      const x = 50 + Math.sin(radians) * pointRadius;
      const y = 50 - Math.cos(radians) * pointRadius;
      const labelX = 50 + Math.sin(radians) * labelRadius;
      const labelY = 50 - Math.cos(radians) * labelRadius;

      return `
        <span class="navx-summary-landmark-dot" style="left:${x.toFixed(2)}%;top:${y.toFixed(2)}%" aria-hidden="true"></span>
        <span class="navx-summary-landmark-label" style="left:${labelX.toFixed(2)}%;top:${labelY.toFixed(2)}%">${name}</span>
      `;
    })
    .join('');

  const userHands = trialResults
    .map((trial, index) => {
      if (!trial) return '';
      const absolute = Number(trial.userAbsoluteBearing);
      if (!Number.isFinite(absolute)) return '';
      const color = handPalette[index % handPalette.length];
      return `<div class="navx-summary-hand" style="--navx-hand-angle:${normalizeAngle(absolute)}deg;--navx-hand-color:${color};" aria-hidden="true"></div>`;
    })
    .join('');

  const legend = trialResults
    .map((trial, index) => {
      if (!trial) return '';
      const color = handPalette[index % handPalette.length];
      const trialNumber = index + 1;
      return `
        <li class="navx-summary-legend-item">
          <span class="navx-summary-legend-swatch" style="background:${color};"></span>
          <span>Trial ${trialNumber}: ${trial.target}</span>
        </li>
      `;
    })
    .join('');

  return `
    <section class="navx-summary-visual" aria-label="Navigation trial visual summary">
      <div class="navx-dial navx-summary-dial" aria-hidden="true">
        <div class="navx-dial-ring"></div>
        <div class="navx-dial-ticks"></div>
        ${landmarks}
        ${userHands}
        <div class="navx-summary-north">N</div>
        <span class="navx-center-dot"></span>
      </div>
      <ul class="navx-summary-legend">${legend}</ul>
    </section>
  `;
}

export function renderTaskNavigation(task, context) {
  const root = context.root;
  root.innerHTML = '';

  const header = createTaskHeader(task);
  root.append(header);

  const body = document.createElement('div');
  body.className = 'task-view task-panel card';
  root.append(body);
  applyAssessmentChrome(header, body);

  const previous = context.state.scores.navigate || {};
  const rawPreviousTrials = Array.isArray(previous.trials) ? [...previous.trials] : [];
  const legacyHasRemovedTrial = rawPreviousTrials[0]?.target === 'Mountains';

  // Normalize older persisted payloads (5-trial flow) into the current 4-trial flow.
  const trialResults = legacyHasRemovedTrial
    ? rawPreviousTrials.slice(1, TRIALS.length + 1)
    : rawPreviousTrials.slice(0, TRIALS.length);

  const previousTrialIndexRaw = Math.max(0, Number(previous.trialIndex || 0));
  const migratedTrialIndex = legacyHasRemovedTrial
    ? Math.max(0, previousTrialIndexRaw - 1)
    : previousTrialIndexRaw;
  let trialIndex = Math.max(0, Math.min(TRIALS.length, migratedTrialIndex));
  let cancelled = false;
  let dragging = false;
  let activeAngle = 0;
  let trialStartedAt = 0;
  const northBearing = bearingFromTo(LAYOUT.points.Home, NORTH_REFERENCE);
  const mountainsBearing = bearingFromTo(LAYOUT.points.Home, LAYOUT.points.Mountains);
  let pendingFacingStep =
    typeof previous.pendingFacingStep === 'boolean' ? previous.pendingFacingStep : trialIndex === 0;
  if (trialIndex === 0 && trialResults.length === 0) {
    pendingFacingStep = true;
  }
  if (trialIndex > 0) {
    pendingFacingStep = false;
  }
  let northHintUsesTotal = Math.max(0, Number(previous.northHintUsesTotal || 0));
  const previousHintUses = Array.isArray(previous.northHintUsesByTrial) ? previous.northHintUsesByTrial : [];
  const normalizedHintUses = legacyHasRemovedTrial ? previousHintUses.slice(1) : previousHintUses;
  const northHintUsesByTrial = Array.from({ length: TRIALS.length }, (_, index) =>
    Math.max(0, Number(normalizedHintUses[index] || 0)),
  );
  let activeNorthHintTimer = null;

  const scoreCapTriggered = () => northHintUsesTotal > 5;

  const withHintCap = (score) => (scoreCapTriggered() ? Math.min(score, 5) : score);

  const persistInterim = () => {
    const meanError = Number(averageError(trialResults).toFixed(1));
    const score = withHintCap(scoreNavigate({ meanError }));
    context.onInterim(task.key, score, {
      trials: [...trialResults],
      meanError,
      score,
      trialIndex,
      pendingFacingStep,
      northHintUsesTotal,
      northHintUsesByTrial: [...northHintUsesByTrial],
      total: score,
    });
  };

  const pointerAngleForEvent = (event, dial) => {
    const rect = dial.getBoundingClientRect();
    const x = event.clientX - (rect.left + rect.width / 2);
    const y = event.clientY - (rect.top + rect.height / 2);
    return normalizeAngle((Math.atan2(x, -y) * 180) / Math.PI);
  };

  const targetAngleForTrial = (trial) => {
    const home = LAYOUT.points.Home;
    const targetPoint = LAYOUT.points[trial.target];
    const targetBearing = bearingFromTo(home, targetPoint);
    const referenceBearing = trial.reference === 'mountains' ? mountainsBearing : northBearing;
    return normalizeAngle(targetBearing - referenceBearing);
  };

  const finishTask = () => {
    const meanError = Number(averageError(trialResults).toFixed(1));
    const score = withHintCap(scoreNavigate({ meanError }));
    const payload = {
      trials: [...trialResults],
      meanError,
      score,
      scoreCappedByNorthHints: scoreCapTriggered(),
      northHintUsesTotal,
      northHintUsesByTrial: [...northHintUsesByTrial],
      total: score,
    };
    context.onComplete(task.key, score, payload);
  };

  const renderSummary = () => {
    const meanError = Number(averageError(trialResults).toFixed(1));
    const score = withHintCap(scoreNavigate({ meanError }));
    const visualSummary = buildSummaryDialMarkup(trialResults);

    body.innerHTML = `
      <section class="navx-summary">
        <p class="task-instruction">Your spatial orientation trials are complete.</p>
        <p class="task-helper">Mean angular error: <strong>${meanError.toFixed(1)}°</strong> · Spatial accuracy score: <strong>${score}/10</strong></p>
        ${scoreCapTriggered() ? '<p class="task-helper">North was used often, so the final score is capped at 5.</p>' : ''}
      </section>
      ${visualSummary}
      <div class="flow-actions">
        <button class="btn btn-secondary" type="button" id="backNavigation">Back</button>
        <button class="btn btn-primary" type="button" id="continueNavigation">Continue</button>
      </div>
    `;

    body.querySelector('#backNavigation')?.addEventListener('click', () => {
      trialIndex = Math.max(0, TRIALS.length - 1);
      renderTrial();
    });
    body.querySelector('#continueNavigation')?.addEventListener('click', finishTask);
  };

  const renderFacingStep = () => {
    body.innerHTML = `
      <div class="navx-start-prompt" id="navxTurnPrompt" aria-live="polite">
        <p>You now turn to face the Mountains. This shifts your perspective.</p>
        <p>Remember where each location is in relation to you facing the Mountains.</p>
      </div>
      <section class="navx-encoding-stage">
        ${buildMapMarkup({ showFacingArrow: true, showReadyButton: false })}
      </section>
      <div class="flow-actions">
        <button class="btn btn-primary" type="button" id="continueFacingStep">Continue when ready</button>
      </div>
    `;

    const turnPrompt = body.querySelector('#navxTurnPrompt');
    const map = body.querySelector('#navxMap');
    body.querySelector('#continueFacingStep')?.addEventListener('click', () => {
      if (cancelled) return;
      pendingFacingStep = false;
      persistInterim();
      turnPrompt?.classList.add('is-dissolving');
      map?.classList.add('is-fading');
      window.setTimeout(() => {
        if (!cancelled) renderTrial();
      }, 360);
    });
  };

  const renderTrial = () => {
    const trial = TRIALS[trialIndex];
    if (!trial) {
      renderSummary();
      return;
    }

    const referenceBearing = trial.reference === 'mountains' ? mountainsBearing : northBearing;
    const targetAngle = targetAngleForTrial(trial);
    const showMountainTopMarker = true;
    activeAngle = 0;
    trialStartedAt = performance.now();

    body.innerHTML = `
      <p class="autobio-progress">Trial ${trialIndex + 1}/${TRIALS.length}</p>
      <div class="autobio-copy navx-copy">
        <p class="task-instruction">${mapInstruction(trial)}</p>
      </div>
      <section class="navx-dial-stage navx-dial-stage--fade-in">
        <div class="navx-dial" id="navxDial" role="application" aria-label="Navigation direction dial">
          <div class="navx-dial-ring" aria-hidden="true"></div>
          <div class="navx-dial-ticks" aria-hidden="true"></div>
          ${showMountainTopMarker ? '<div class="navx-dial-mountain" aria-hidden="true">⛰️</div>' : ''}
          <div class="navx-dial-north-hint navx-dial-north-hint--bottom" id="navxDialNorthHint" aria-hidden="true"><span>N</span></div>
          <div class="navx-hand" id="navxHand" style="transform: rotate(${activeAngle}deg)">
            <span class="navx-hand-tip"></span>
          </div>
          <span class="navx-center-dot" aria-hidden="true"></span>
        </div>
        <button class="btn btn-secondary navx-find-north" type="button" id="navxFindNorth">Find North</button>
      </section>
      <div class="flow-actions">
        <button class="btn btn-secondary" type="button" id="backNavigation">Back</button>
        <button class="btn btn-primary" type="button" id="confirmNavigation">Confirm Direction</button>
      </div>
    `;

    const dial = body.querySelector('#navxDial');
    const hand = body.querySelector('#navxHand');
    const northHint = body.querySelector('#navxDialNorthHint');

    const paintAngle = (angle) => {
      activeAngle = normalizeAngle(angle);
      hand.style.transform = `rotate(${activeAngle}deg)`;
    };

    const onPointerDown = (event) => {
      dragging = true;
      dial.classList.add('is-active');
      paintAngle(pointerAngleForEvent(event, dial));
      if (dial.setPointerCapture) {
        dial.setPointerCapture(event.pointerId);
      }
    };

    const onPointerMove = (event) => {
      if (!dragging) return;
      paintAngle(pointerAngleForEvent(event, dial));
    };

    const onPointerUp = () => {
      dragging = false;
      dial.classList.remove('is-active');
    };

    dial.addEventListener('pointerdown', onPointerDown);
    dial.addEventListener('pointermove', onPointerMove);
    dial.addEventListener('pointerup', onPointerUp);
    dial.addEventListener('pointercancel', onPointerUp);
    dial.addEventListener('pointerleave', onPointerUp);

    body.querySelector('#navxFindNorth')?.addEventListener('click', () => {
      northHintUsesTotal += 1;
      northHintUsesByTrial[trialIndex] += 1;
      persistInterim();

      if (activeNorthHintTimer) {
        window.clearTimeout(activeNorthHintTimer);
      }

      northHint?.classList.add('is-visible');
      activeNorthHintTimer = window.setTimeout(() => {
        northHint?.classList.remove('is-visible');
      }, 8000);
    });

    body.querySelector('#backNavigation')?.addEventListener('click', () => {
      if (trialIndex > 0) {
        trialIndex -= 1;
        renderTrial();
        return;
      }
      context.onBack?.();
    });

    body.querySelector('#confirmNavigation')?.addEventListener('click', () => {
      const elapsedMs = Math.max(1, Math.round(performance.now() - trialStartedAt));
      const userAbsoluteBearing = normalizeAngle(activeAngle + referenceBearing);
      const error = Number(quadrantError(activeAngle, targetAngle).toFixed(1));

      const trialResult = {
        reference: trial.reference,
        referenceBearing: Number(referenceBearing.toFixed(1)),
        northBearing: Number(northBearing.toFixed(1)),
        target: trial.target,
        userAngle: Number(activeAngle.toFixed(1)),
        userAbsoluteBearing: Number(userAbsoluteBearing.toFixed(1)),
        targetAngle: Number(targetAngle.toFixed(1)),
        northHintAngle: 180,
        northHintUses: northHintUsesByTrial[trialIndex],
        error,
        angularError: error,
        reactionTimeMs: elapsedMs,
      };

      trialResults[trialIndex] = trialResult;
      trialIndex += 1;
      persistInterim();
      renderTrial();
    });
  };

  const renderEncoding = () => {
    body.innerHTML = `
      <div class="navx-start-prompt" id="navxStartPrompt" aria-live="polite">
        <p>Imagine you are standing at Home facing North. North is the direction you are facing and your reference point.</p>
        <p>Also, remember where each location is and when you're ready, let's begin.</p>
      </div>
      <section class="navx-encoding-stage">
        ${buildMapMarkup()}
      </section>
      <div class="flow-actions">
        <button class="btn btn-secondary" type="button" id="backNavigation">Back</button>
      </div>
    `;

    body.querySelector('#backNavigation')?.addEventListener('click', () => context.onBack?.());
    const continueButton = body.querySelector('#startNavigationTrials');
    const startPrompt = body.querySelector('#navxStartPrompt');
    const map = body.querySelector('#navxMap');

    continueButton?.addEventListener('click', () => {
      if (cancelled) return;
      pendingFacingStep = true;
      startPrompt?.classList.add('is-dissolving');
      map?.classList.add('is-fading');
      window.setTimeout(() => {
        if (!cancelled) renderFacingStep();
      }, 360);
    });
  };

  if (trialIndex >= TRIALS.length && trialResults.length >= TRIALS.length) {
    renderSummary();
  } else if (pendingFacingStep) {
    renderFacingStep();
  } else if (trialIndex > 0) {
    renderTrial();
  } else {
    renderEncoding();
  }

  return () => {
    cancelled = true;
    if (activeNorthHintTimer) {
      window.clearTimeout(activeNorthHintTimer);
    }
  };
}
