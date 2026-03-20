import { applyAssessmentChrome } from './components.js';
import { scoreNavigate } from './scoring.js';

const LAYOUT = {
  width: 720,
  height: 420,
  points: {
    'Home': { x: 360, y: 210, icon: '🏠' },
    'Bus Station': { x: 392, y: 96, icon: '🚌' },
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
  { target: 'Park', facing: 'Mountains' },
  { target: 'Airport', facing: 'Mountains' },
  { target: 'Beach', facing: 'Mountains' },
  { target: 'Bus Station', facing: 'Park' },
  { target: 'Airport', facing: 'Beach' },
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

function buildMapMarkup() {
  const home = LAYOUT.points.Home;
  const homeLeft = (home.x / LAYOUT.width) * 100;
  const homeTop = (home.y / LAYOUT.height) * 100;
  const northLeft = (NORTH_REFERENCE.x / LAYOUT.width) * 100;
  const northTop = (NORTH_REFERENCE.y / LAYOUT.height) * 100;

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
      <div class="navx-home-north-line" aria-hidden="true" style="left:${homeLeft}%;top:${homeTop}%;--navx-line-length:${Math.hypot(NORTH_REFERENCE.x - home.x, NORTH_REFERENCE.y - home.y)}px;--navx-line-angle:${bearingFromTo(home, NORTH_REFERENCE)}deg;"></div>
      <div class="navx-map-north" aria-label="Cardinal direction north" style="left:${northLeft}%;top:${northTop}%">
        <svg class="navx-compass-rose" viewBox="0 0 60 60" aria-hidden="true">
          <g>
            <path d="M 30 2 L 41 24 L 30 18 L 19 24 Z" fill="currentColor"/>
            <text x="30" y="48" text-anchor="middle" class="navx-compass-text">N</text>
          </g>
        </svg>
      </div>
      ${locations}
      <div class="navx-home-ring" aria-hidden="true"></div>
      <button class="btn btn-primary navx-ready-btn" type="button" id="startNavigationTrials">Continue When Ready</button>
    </div>
  `;
}

function mapInstruction(trial) {
  return `Start at North, then move the hand to point to the ${trial.target}.`;
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
  const trialResults = Array.isArray(previous.trials) ? [...previous.trials] : [];

  let trialIndex = Math.max(0, Math.min(TRIALS.length, Number(previous.trialIndex || 0)));
  let cancelled = false;
  let dragging = false;
  let activeAngle = 0;
  let trialStartedAt = 0;
  const northBearing = bearingFromTo(LAYOUT.points.Home, NORTH_REFERENCE);

  const persistInterim = () => {
    const meanError = Number(averageError(trialResults).toFixed(1));
    const score = scoreNavigate({ meanError });
    context.onInterim(task.key, score, {
      trials: [...trialResults],
      meanError,
      score,
      trialIndex,
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

    return normalizeAngle(targetBearing - northBearing);
  };

  const finishTask = () => {
    const meanError = Number(averageError(trialResults).toFixed(1));
    const score = scoreNavigate({ meanError });
    const payload = {
      trials: [...trialResults],
      meanError,
      score,
      total: score,
    };
    context.onComplete(task.key, score, payload);
  };

  const renderSummary = () => {
    const meanError = Number(averageError(trialResults).toFixed(1));
    const score = scoreNavigate({ meanError });

    body.innerHTML = `
      <section class="navx-summary">
        <p class="task-instruction">Your spatial orientation trials are complete.</p>
        <p class="task-helper">Mean angular error: <strong>${meanError.toFixed(1)}°</strong> · Spatial accuracy score: <strong>${score}/10</strong></p>
      </section>
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

  const renderTrial = () => {
    const trial = TRIALS[trialIndex];
    if (!trial) {
      renderSummary();
      return;
    }

    const targetAngle = targetAngleForTrial(trial);
    activeAngle = 0;
    trialStartedAt = performance.now();

    body.innerHTML = `
      <p class="autobio-progress">Trial ${trialIndex + 1}/${TRIALS.length}</p>
      <div class="autobio-copy navx-copy">
        <p class="task-instruction">${mapInstruction(trial)}</p>
      </div>
      <section class="navx-dial-stage">
        <div class="navx-dial" id="navxDial" role="application" aria-label="Navigation direction dial">
          <div class="navx-dial-ring" aria-hidden="true"></div>
          <div class="navx-dial-ticks" aria-hidden="true"></div>
          <div class="navx-dial-north" aria-hidden="true">N</div>
          <div class="navx-hand" id="navxHand" style="transform: rotate(${activeAngle}deg)">
            <span class="navx-hand-tip"></span>
          </div>
          <span class="navx-center-dot" aria-hidden="true"></span>
        </div>
        <p class="task-helper" id="navxDirectionReadout">Bearing from North: ${Math.round(activeAngle)}°</p>
      </section>
      <div class="flow-actions">
        <button class="btn btn-secondary" type="button" id="backNavigation">Back</button>
        <button class="btn btn-primary" type="button" id="confirmNavigation">Confirm Direction</button>
      </div>
    `;

    const dial = body.querySelector('#navxDial');
    const hand = body.querySelector('#navxHand');
    const readout = body.querySelector('#navxDirectionReadout');

    const paintAngle = (angle) => {
      activeAngle = normalizeAngle(angle);
      hand.style.transform = `rotate(${activeAngle}deg)`;
      readout.textContent = `Bearing from North: ${Math.round(activeAngle)}°`;
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
      const userAbsoluteBearing = normalizeAngle(activeAngle + northBearing);
      const error = Number(angularError(activeAngle, targetAngle).toFixed(1));

      const trialResult = {
        facing: trial.facing,
        northBearing: Number(northBearing.toFixed(1)),
        target: trial.target,
        userAngle: Number(activeAngle.toFixed(1)),
        userAbsoluteBearing: Number(userAbsoluteBearing.toFixed(1)),
        targetAngle: Number(targetAngle.toFixed(1)),
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
        <p>Imagine you are standing at Home facing North. North if your reference point.</p>
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
      startPrompt?.classList.add('is-dissolving');
      map?.classList.add('is-fading');
      window.setTimeout(() => {
        if (!cancelled) renderTrial();
      }, 360);
    });
  };

  if (trialIndex >= TRIALS.length && trialResults.length >= TRIALS.length) {
    renderSummary();
  } else if (trialIndex > 0) {
    renderTrial();
  } else {
    renderEncoding();
  }

  return () => {
    cancelled = true;
  };
}
