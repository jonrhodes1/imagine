(() => {
  const revealNodes = Array.from(document.querySelectorAll('[data-reveal]'));

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    revealNodes.forEach((node) => node.classList.add('is-visible'));
  } else if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }
          entry.target.classList.add('is-visible');
          obs.unobserve(entry.target);
        });
      },
      { threshold: 0.16, rootMargin: '0px 0px -10% 0px' }
    );

    revealNodes.forEach((node) => observer.observe(node));
  } else {
    revealNodes.forEach((node) => node.classList.add('is-visible'));
  }

  const toggles = Array.from(document.querySelectorAll('.team-toggle'));
  toggles.forEach((toggle) => {
    toggle.addEventListener('click', () => {
      const card = toggle.closest('.team-card');
      if (!card) {
        return;
      }
      const note = card.querySelector('.team-note');
      if (!note) {
        return;
      }

      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!expanded));
      toggle.textContent = expanded ? 'More' : 'Less';
      note.hidden = expanded;
    });
  });
})();
