import { renderResults } from './results.js';
import { renderColourMemoryStage } from './colourTest.js';
import { TASK_COUNT, TASKS, renderTask } from './tasks.js';

const STORAGE_KEY = 'imagery_assessment_v2_static';

const defaultState = {
  currentTask: 0,
  postResults: {
    firstFavouriteColour: null,
    secondFavouriteColour: null,
    targetHSV: null,
    recreatedHSV: { h: 180, s: 60, v: 70 },
    colourMemoryScore: 0,
    colourPreferenceShift: 0,
  },
  scores: {
    imageGeneration: {
      visualisation: {
        total: 0,
        hue: 0,
        saturation: 100,
        brightness: 100,
        contrast: 100,
        detail: 50,
      },
      auditory: {
        total: 0,
        volume: 0,
        clarity: 0,
      },
      smell: {
        total: 0,
        intensity: 1,
        valence: 'neutral',
      },
      touch: {
        total: 1,
      },
      emotion: {
        total: 0,
        direction: 0,
        intensity: 0,
      },
      total: 0,
    },
    visualisation: {
      total: 0,
      hue: 0,
      saturation: 100,
      brightness: 100,
      contrast: 100,
      detail: 50,
    },
    manipulation: {
      total: 0,
      tests: [],
    },
    autobiographical: {
      total: 0,
      animals: [],
      totalAnimals: 0,
      clarityScores: [],
      averageClarity: 0,
      continuityType: null,
      currentRatingIndex: 0,
      phase: 'activation',
    },
    goal: {
      total: 0,
      goalSize: 1,
      goalDistance: 0,
    },
    improvise: {
      total: 0,
      stabilityScore: 0,
      anchorType: null,
      controlScore: 0,
      continuityScore: 0,
      finalScore: 0,
    },
    navigate: {
      total: 0,
      trials: [],
      meanError: 0,
      score: 0,
      trialIndex: 0,
    },
    exploration: {
      total: 0,
      similarity: 5,
    },
  },
};

const root = document.getElementById('taskRoot');
const transitionLayer = document.getElementById('transitionLayer');
const taskCounter = document.getElementById('taskCounter');
const taskLabel = document.getElementById('taskLabel');
const progressBar = document.getElementById('progressBar');
const progressTrack = document.querySelector('.progress-track');

let state = hydrateState();
let cleanupTask = null;
let navigationDirection = 'forward';

function hydrateState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);

    const parsed = JSON.parse(raw);
    const migratedScores = { ...structuredClone(defaultState).scores, ...(parsed.scores || {}) };

    if (typeof migratedScores.imageGeneration === 'number') {
      migratedScores.visualisation.total = migratedScores.imageGeneration;
    }
    if (typeof migratedScores.integration === 'number') {
      migratedScores.exploration.total = migratedScores.integration;
    }
    if (typeof migratedScores.auditory === 'number') {
      migratedScores.auditory = {
        total: migratedScores.auditory,
      };
    }
    if (!migratedScores.improvise) {
      migratedScores.improvise = { ...defaultState.scores.improvise };
    }
    if (typeof migratedScores.manipulation === 'number') {
      migratedScores.manipulation = {
        ...defaultState.scores.manipulation,
        total: migratedScores.manipulation,
      };
    }
    if (typeof migratedScores.navigate === 'number') {
      migratedScores.navigate = {
        ...defaultState.scores.navigate,
        total: migratedScores.navigate,
        score: migratedScores.navigate,
      };
    }
    if (typeof migratedScores.autobiographical === 'number') {
      migratedScores.autobiographical = {
        ...defaultState.scores.autobiographical,
        total: migratedScores.autobiographical,
      };
    }
    if (typeof migratedScores.alternatives === 'number' && !migratedScores.autobiographical?.total) {
      migratedScores.autobiographical = {
        ...defaultState.scores.autobiographical,
        total: migratedScores.alternatives,
      };
    }
    if (!migratedScores.autobiographical || typeof migratedScores.autobiographical !== 'object') {
      migratedScores.autobiographical = structuredClone(defaultState.scores.autobiographical);
    }

    const legacyVisual = {
      ...defaultState.scores.visualisation,
      ...(migratedScores.visualisation || {}),
    };

    const persistedImageGeneration = migratedScores.imageGeneration || legacyVisual.imageGeneration || null;
    const migratedImageGeneration = {
      ...defaultState.scores.imageGeneration,
      ...(persistedImageGeneration || {}),
      visualisation: {
        ...defaultState.scores.imageGeneration.visualisation,
        ...(persistedImageGeneration?.visualisation || {}),
        hue: Number(persistedImageGeneration?.visualisation?.hue ?? legacyVisual.hue ?? 0),
        saturation: Number(persistedImageGeneration?.visualisation?.saturation ?? legacyVisual.saturation ?? 100),
        brightness: Number(persistedImageGeneration?.visualisation?.brightness ?? legacyVisual.brightness ?? 100),
        contrast: Number(persistedImageGeneration?.visualisation?.contrast ?? legacyVisual.contrast ?? 100),
        detail: Number(persistedImageGeneration?.visualisation?.detail ?? legacyVisual.detail ?? 50),
        total: Number(persistedImageGeneration?.visualisation?.total ?? legacyVisual.total ?? 0),
      },
      auditory: {
        ...defaultState.scores.imageGeneration.auditory,
        ...(persistedImageGeneration?.auditory || {}),
      },
      smell: {
        ...defaultState.scores.imageGeneration.smell,
        ...(persistedImageGeneration?.smell || {}),
      },
      touch: {
        ...defaultState.scores.imageGeneration.touch,
        ...(persistedImageGeneration?.touch || {}),
      },
      emotion: {
        ...defaultState.scores.imageGeneration.emotion,
        ...(persistedImageGeneration?.emotion || {}),
      },
    };

    if (typeof migratedImageGeneration.total !== 'number') {
      migratedImageGeneration.total = Number(migratedImageGeneration.visualisation.total || 0);
    }

    migratedScores.imageGeneration = migratedImageGeneration;
    migratedScores.visualisation = {
      ...legacyVisual,
      total: Number(legacyVisual.total || migratedImageGeneration.total || 0),
      imageGeneration: migratedImageGeneration,
      imageGenerationTotal: Number(migratedImageGeneration.total || 0),
    };

    const hydrated = {
      ...structuredClone(defaultState),
      ...parsed,
      postResults: {
        ...defaultState.postResults,
        ...(parsed.postResults || {}),
      },
      scores: migratedScores,
    };

    const maxStep = TASK_COUNT + 2;
    const currentTask = Number(hydrated.currentTask);
    hydrated.currentTask = Number.isFinite(currentTask)
      ? Math.max(0, Math.min(maxStep, Math.trunc(currentTask)))
      : 0;

    return hydrated;
  } catch {
    return structuredClone(defaultState);
  }
}

function persistState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function clearActiveTask() {
  if (typeof cleanupTask === 'function') {
    cleanupTask();
  }
  cleanupTask = null;
}

function updateProgressUI() {
  if (!taskCounter || !taskLabel || !progressBar || !progressTrack) {
    return;
  }

  if (state.currentTask === 0) {
    taskCounter.textContent = 'Intro';
    taskLabel.textContent = `Task 0 of ${TASK_COUNT + 2}`;
    progressBar.style.width = '0%';
    progressTrack.setAttribute('aria-valuenow', '0');
    return;
  }

  if (state.currentTask >= 1 && state.currentTask <= TASK_COUNT) {
    const task = TASKS[state.currentTask - 1];
    const progress = Math.round((state.currentTask / TASK_COUNT) * 100);
    taskCounter.textContent = task.title;
    taskLabel.textContent = `Task ${state.currentTask} of ${TASK_COUNT}`;
    progressBar.style.width = `${progress}%`;
    progressTrack.setAttribute('aria-valuenow', String(progress));
    return;
  }

  if (state.currentTask === TASK_COUNT + 1) {
    const progress = Math.round(((TASK_COUNT + 1) / (TASK_COUNT + 2)) * 100);
    taskCounter.textContent = 'Colour Memory';
    taskLabel.textContent = `Task ${TASK_COUNT + 1} of ${TASK_COUNT + 2}`;
    progressBar.style.width = `${progress}%`;
    progressTrack.setAttribute('aria-valuenow', String(progress));
    return;
  }

  taskCounter.textContent = 'Imagery Retina';
  taskLabel.textContent = `Task ${TASK_COUNT + 2} of ${TASK_COUNT + 2}`;
  progressBar.style.width = '100%';
  progressTrack.setAttribute('aria-valuenow', '100');
}

async function runTransition(text = 'Loading next task...') {
  const isBack = navigationDirection === 'back';
  transitionLayer.classList.toggle('is-back', isBack);
  transitionLayer.classList.add('is-active');
  transitionLayer.setAttribute('aria-hidden', 'false');
  transitionLayer.textContent = text;
  await new Promise((resolve) => window.setTimeout(resolve, 230));
  transitionLayer.classList.remove('is-active');
  transitionLayer.classList.remove('is-back');
  transitionLayer.setAttribute('aria-hidden', 'true');
  transitionLayer.textContent = '';
}

function completeTask(taskKey, score, taskPayload) {
  navigationDirection = 'forward';
  const current = state.scores[taskKey] || {};
  state.scores[taskKey] = {
    ...current,
    ...(taskPayload || {}),
    total: score,
  };

  if (state.currentTask < TASK_COUNT) {
    state.currentTask += 1;
    persistState();
    runTransition('Transitioning...').then(renderCurrentStep);
    return;
  }

  state.currentTask = TASK_COUNT + 1;
  persistState();
  renderCurrentStep();
}

function saveInterim(taskKey, score, taskPayload) {
  const current = state.scores[taskKey] || {};
  state.scores[taskKey] = {
    ...current,
    ...(taskPayload || {}),
    ...(typeof score === 'number' ? { total: score } : {}),
  };
  persistState();
}

function goBackOneStep() {
  navigationDirection = 'back';
  if (state.currentTask <= 0) {
    return;
  }

  if (state.currentTask === TASK_COUNT + 2) {
    state.currentTask = TASK_COUNT + 1;
  } else if (state.currentTask === TASK_COUNT + 1) {
    state.currentTask = TASK_COUNT;
  } else {
    state.currentTask = Math.max(0, state.currentTask - 1);
  }

  persistState();
  runTransition('Going back...').then(renderCurrentStep);
}

function renderIntro() {
  root.innerHTML = '';
  const hasProgress = Object.values(state.scores).some((entry) => (entry?.total || 0) > 0) || (state.currentTask > 0 && state.currentTask <= TASK_COUNT + 1);

  const intro = document.createElement('section');
  intro.className = 'task-view intro-screen';
  intro.innerHTML = `
    <article class="intro-card">
      <p class="eyebrow intro-eyebrow">IMAGINE</p>
      <h2 class="intro-title">Imagery Profile Assessment</h2>
      <p class="intro-copy">We all think and therefore imagine in different ways. We’ve designed quick assessments for you to take and get an individual profile. There are 7 assessments and you’ll get your scores back straight after you complete each part. There are no good or bad scores, just your score.</p>

      <h3 class="intro-section-title">The order of tests follows the IMAGINE Framework</h3>
      <ul class="intro-list" aria-label="Assessment order">
        <li><strong>Image Generation</strong><span>how you see thoughts</span></li>
        <li><strong>Manipulation</strong><span>rotating shapes mentally</span></li>
        <li><strong>Autobiographical</strong><span>recalling real experiences in your mind</span></li>
        <li><strong>Goal</strong><span>goal size and urgency</span></li>
        <li><strong>Improvise</strong><span>adapting mental worlds in motion</span></li>
        <li><strong>Navigation</strong><span>retracing spatial relationships in your mind</span></li>
        <li><strong>Exploration</strong><span>building fantastical scenes</span></li>
      </ul>

      <div class="flow-actions intro-actions">
        <button class="btn btn-primary intro-start-btn" id="startBtn" type="button">Begin Assessment</button>
      </div>

      ${hasProgress ? `
        <div class="intro-utility-actions">
          <button class="btn btn-secondary" id="resumeBtn" type="button">Resume Progress</button>
          <button class="btn btn-danger" id="clearBtn" type="button">Reset Saved Progress</button>
        </div>
      ` : ''}
      <p class="intro-footnote">Each task takes a short moment and your profile updates as you progress. In Part 1, each sensory imagination section runs on a 10 second timer before rating.</p>
    </article>
  `;

  root.append(intro);

  const startBtn = document.getElementById('startBtn');
  startBtn?.addEventListener('click', () => {
    state = structuredClone(defaultState);
    state.currentTask = 1;
    persistState();
    renderCurrentStep();
  });

  const resumeBtn = document.getElementById('resumeBtn');
  resumeBtn?.addEventListener('click', () => {
    if (state.currentTask === 0 || state.currentTask > TASK_COUNT + 1) {
      state.currentTask = 1;
    }
    renderCurrentStep();
  });

  const clearBtn = document.getElementById('clearBtn');
  clearBtn?.addEventListener('click', () => {
    localStorage.removeItem(STORAGE_KEY);
    state = structuredClone(defaultState);
    renderCurrentStep();
  });
}

function renderCurrentStep() {
  clearActiveTask();
  root.classList.toggle('is-back-nav', navigationDirection === 'back');
  root.classList.toggle('intro-mode', state.currentTask === 0);
  updateProgressUI();

  const resetDirection = () => {
    window.setTimeout(() => {
      navigationDirection = 'forward';
      root.classList.remove('is-back-nav');
    }, 520);
  };

  if (state.currentTask === 0) {
    renderIntro();
    resetDirection();
    return;
  }

  if (state.currentTask >= 1 && state.currentTask <= TASK_COUNT) {
    cleanupTask = renderTask(state.currentTask, {
      root,
      state,
      onComplete: completeTask,
      onInterim: saveInterim,
      onBack: goBackOneStep,
    });
    resetDirection();
    return;
  }

  if (state.currentTask === TASK_COUNT + 1) {
    cleanupTask = renderColourMemoryStage(root, state.postResults, {
      onInterim: (payload) => {
        state.postResults = { ...state.postResults, ...payload };
        persistState();
      },
      onBack: goBackOneStep,
      onComplete: (payload) => {
        navigationDirection = 'forward';
        state.postResults = { ...state.postResults, ...payload };
        state.currentTask = TASK_COUNT + 2;
        persistState();
        runTransition('Rendering retina...').then(renderCurrentStep);
      },
    });
    resetDirection();
    return;
  }

  navigationDirection = 'forward';
  renderResults(root, state, {
    onRetake: () => {
      localStorage.removeItem(STORAGE_KEY);
      state = structuredClone(defaultState);
      state.currentTask = 0;
      renderCurrentStep();
    },
  });
}

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && state.currentTask > 0 && state.currentTask <= TASK_COUNT) {
    state.currentTask = 0;
    persistState();
    renderCurrentStep();
  }
});

renderCurrentStep();
