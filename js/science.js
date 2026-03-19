(function () {
  'use strict';

  var grid = document.getElementById('sciGrid');
  var revealNodes = Array.prototype.slice.call(document.querySelectorAll('.sci-card, .sci-header, .sci-what, .sci-teacher-intro-block, .sci-use-card, .sci-model, .sci-example, .sci-references'));

  revealNodes.forEach(function (node, index) {
    node.classList.add('sci-reveal');
    node.style.setProperty('--reveal-order', String(index));
  });

  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    revealNodes.forEach(function (node) {
      node.classList.add('is-visible');
    });
  } else if ('IntersectionObserver' in window) {
    var revealObserver = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });

    revealNodes.forEach(function (node) {
      revealObserver.observe(node);
    });
  } else {
    revealNodes.forEach(function (node) {
      node.classList.add('is-visible');
    });
  }

  if (!grid) return;

  grid.addEventListener('click', function (e) {
    var toggle = e.target.closest('.sci-toggle');
    if (!toggle) return;

    var panelId = toggle.dataset.panel;
    var panel = document.getElementById(panelId);
    if (!panel) return;

    var isOpen = toggle.getAttribute('aria-expanded') === 'true';
    var card = toggle.closest('.sci-card');

    toggle.setAttribute('aria-expanded', String(!isOpen));
    panel.setAttribute('aria-hidden', String(isOpen));
    if (card) {
      card.classList.toggle('is-active', !isOpen);
    }
  });
}());
