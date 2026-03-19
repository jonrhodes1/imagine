export function applyAssessmentChrome(header, stage) {
  if (header) {
    header.classList.add('imagine-task-head');
    if (!header.querySelector('.imagine-task-label')) {
      const label = document.createElement('p');
      label.className = 'imagine-task-label';
      label.textContent = 'IMAGINE';
      header.prepend(label);
    }
  }

  if (stage) {
    stage.classList.add('assessment-stage');
  }
}
