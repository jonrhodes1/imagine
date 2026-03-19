import { scoreIntentionPlanning } from './scoring.js';
import { applyAssessmentChrome } from './components.js';

const BALL_RADIUS = 15;
const BALL_STEP = 32;
const BOARD_BASE_Y = 156;

function createSvg(tag) {
  return document.createElementNS('http://www.w3.org/2000/svg', tag);
}

function cloneState(state) {
  return state.map((rod) => [...rod]);
}

function renderTowerBoard(state, capacities) {
  const colors = {
    red: '#ef4a45',
    green: '#37c28a',
    blue: '#42c7d3',
  };

  const svg = createSvg('svg');
  svg.setAttribute('viewBox', '0 0 360 200');
  svg.classList.add('tol-svg');

  const base = createSvg('rect');
  base.setAttribute('x', '20');
  base.setAttribute('y', '170');
  base.setAttribute('width', '320');
  base.setAttribute('height', '8');
  base.setAttribute('rx', '4');
  base.setAttribute('fill', 'rgba(10,10,10,0.28)');
  svg.append(base);

  const rodX = [80, 180, 280];
  const rodHeights = capacities.map((cap) => 40 + cap * BALL_STEP);

  rodX.forEach((x, index) => {
    const rod = createSvg('rect');
    rod.setAttribute('x', String(x - 4));
    rod.setAttribute('y', String(170 - rodHeights[index]));
    rod.setAttribute('width', '8');
    rod.setAttribute('height', String(rodHeights[index]));
    rod.setAttribute('rx', '4');
    rod.setAttribute('fill', '#111827');
    svg.append(rod);
  });

  state.forEach((rod, rodIndex) => {
    rod.forEach((ball, level) => {
      const circle = createSvg('circle');
      circle.setAttribute('cx', String(rodX[rodIndex]));
      circle.setAttribute('cy', String(BOARD_BASE_Y - level * BALL_STEP));
      circle.setAttribute('r', String(BALL_RADIUS));
      circle.setAttribute('fill', colors[ball] || '#888');
      circle.setAttribute('stroke', 'rgba(0,0,0,0.22)');
      circle.setAttribute('stroke-width', '1.2');
      svg.append(circle);
    });
  });

  return svg;
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function renderTaskIntention(task, context, helpers = {}) {
  const { createTaskHeader } = helpers;
  const root = context.root;
  root.innerHTML = '';

  const header = typeof createTaskHeader === 'function'
    ? createTaskHeader(task)
    : (() => {
      const block = document.createElement('div');
      block.className = 'task-heading';
      block.innerHTML = `<h2 class="task-title">${task.title}</h2>${task.subtitle ? `<p class="task-subtitle">${task.subtitle}</p>` : ''}`;
      return block;
    })();

  root.append(header);

  const body = document.createElement('div');
  body.className = 'task-view task-panel card intention-task';
  root.append(body);
  applyAssessmentChrome(header, body);

  const capacities = [3, 1, 2];
  const initialState = [
    ['red', 'green'],
    ['blue'],
    [],
  ];
  const goalState = [
    ['red'],
    ['green'],
    ['blue'],
  ];

  const solutionStates = [
    cloneState(initialState),
    [
      ['red', 'green'],
      [],
      ['blue'],
    ],
    [
      ['red'],
      ['green'],
      ['blue'],
    ],
    [
      ['red', 'blue'],
      ['green'],
      [],
    ],
    cloneState(goalState),
  ];

  const expectedMoves = 4;

  body.innerHTML = `
    <section class="intention-instructions card">
      <p>You are about to complete an IMAGINE Intention planning challenge inspired by Tower of London.</p>
      <p>Study the initial position first, then press <strong>Ready</strong> to reveal the target and start the timer.</p>
      <p>After the target appears, mentally plan the shortest move sequence to reach it.</p>
      <p>When you are confident in your plan, press <strong>STOP</strong> to reveal the solution slowly.</p>
    </section>

    <section class="intention-puzzle card">
      <div class="intention-timer" id="intentionTimer">0.000</div>
      <p class="task-subtitle intention-prompt">Mentally plan the shortest sequence of moves.</p>

      <div class="intention-grid">
        <div class="intention-column">
          <h4>Initial</h4>
          <div id="initialBoard" class="tol-board"></div>
        </div>
        <div class="intention-column">
          <h4>Target</h4>
          <div id="goalBoard" class="tol-board"></div>
        </div>
      </div>

      <div class="flow-actions intention-actions">
        <button class="btn btn-secondary" type="button" id="backIntention">Back</button>
        <button class="btn btn-primary" type="button" id="stopIntention">STOP</button>
        <button class="btn btn-primary is-disabled" type="button" id="continueIntention" disabled>Continue</button>
      </div>

      <div class="intention-reveal" id="intentionReveal" hidden>
        <div class="intention-solution-board" id="solutionBoard"></div>
        <p class="intention-move" id="intentionMoveText">Move 1 of 4</p>
        <p class="intention-summary" id="intentionSummary">Correct solution: 4 moves</p>
        <p class="intention-feedback" id="intentionFeedback">Planning takes time</p>
      </div>
    </section>
  `;

  const initialBoard = body.querySelector('#initialBoard');
  const goalBoard = body.querySelector('#goalBoard');
  const solutionBoard = body.querySelector('#solutionBoard');
  const reveal = body.querySelector('#intentionReveal');
  const timerEl = body.querySelector('#intentionTimer');
  const moveText = body.querySelector('#intentionMoveText');
  const summary = body.querySelector('#intentionSummary');
  const feedback = body.querySelector('#intentionFeedback');
  const stopBtn = body.querySelector('#stopIntention');
  const continueBtn = body.querySelector('#continueIntention');
  const backBtn = body.querySelector('#backIntention');

  initialBoard.append(renderTowerBoard(initialState, capacities));
  goalBoard.append(renderTowerBoard(goalState, capacities));
  solutionBoard.append(renderTowerBoard(solutionStates[0], capacities));

  let cancelled = false;
  let done = false;
  let started = true;
  let frame = null;
  let startTime = 0;
  let elapsedMs = 0;
  let planningScore = 2;

  const tick = (now) => {
    if (cancelled || done || !started) return;
    elapsedMs = now - startTime;
    timerEl.textContent = (elapsedMs / 1000).toFixed(3);
    frame = requestAnimationFrame(tick);
  };

  backBtn.addEventListener('click', () => {
    if (done) return;
    cancelled = true;
    if (frame) cancelAnimationFrame(frame);
    context.onBack?.();
  });

  startTime = performance.now();
  timerEl.textContent = '0.000';
  frame = requestAnimationFrame(tick);

  const playSolution = async () => {
    reveal.hidden = false;
    for (let i = 1; i <= expectedMoves; i += 1) {
      if (cancelled) return;
      solutionBoard.innerHTML = '';
      solutionBoard.append(renderTowerBoard(solutionStates[i], capacities));
      moveText.textContent = `Move ${i} of ${expectedMoves}`;
      await wait(1200);
    }

    summary.textContent = `Correct solution: ${expectedMoves} moves`;
    feedback.textContent = elapsedMs / 1000 <= 12 ? 'Efficient planning' : 'Planning takes time';

    continueBtn.disabled = false;
    continueBtn.classList.remove('is-disabled');
  };

  stopBtn.addEventListener('click', async () => {
    if (done || cancelled || !started) return;
    done = true;
    if (frame) cancelAnimationFrame(frame);

    const timeTaken = elapsedMs / 1000;
    planningScore = scoreIntentionPlanning(timeTaken);

    const interim = {
      planningTime: Number(timeTaken.toFixed(3)),
      timeTaken: Number(timeTaken.toFixed(3)),
      expectedMoves,
      score: planningScore,
    };

    context.onInterim(task.key, planningScore, interim);

    stopBtn.disabled = true;
    stopBtn.classList.add('is-disabled');

    await playSolution();
  });

  continueBtn.addEventListener('click', () => {
    const payload = {
      planningTime: Number((elapsedMs / 1000).toFixed(3)),
      timeTaken: Number((elapsedMs / 1000).toFixed(3)),
      expectedMoves,
      score: planningScore,
    };
    context.onComplete(task.key, planningScore, payload);
  });

  return () => {
    cancelled = true;
    if (frame) cancelAnimationFrame(frame);
  };
}
