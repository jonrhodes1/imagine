// Homepage interaction:
// - Animated IMAGINE foreground
// - Fluid hover state that reveals ENTER underneath
// - Click / Enter key routes to assess page

const heroWord = document.getElementById('heroWord');
const wordReveal = document.getElementById('wordReveal');
const displacementMap = document.querySelector('#heroMistFilter feDisplacementMap');

if (heroWord) {
  const hero = document.querySelector('.home-hero');
  let heroRound = 1;
  heroWord.dataset.heroRound = String(heroRound);

  window.setInterval(() => {
    heroRound = heroRound % 4 + 1;
    heroWord.dataset.heroRound = String(heroRound);
  }, 8000);

  const navigateToAssess = () => {
    window.location.href = 'assess.html';
  };

  const updateLens = (event) => {
    const rect = heroWord.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    heroWord.style.setProperty('--mx', `${x}px`);
    heroWord.style.setProperty('--my', `${y}px`);

    const width = rect.width || 1;
    const height = rect.height || 1;
    const nx = (x / width - 0.5) * 2;
    const ny = (y / height - 0.5) * 2;
    heroWord.style.setProperty('--tilt-x', `${(nx * 8).toFixed(2)}px`);
    heroWord.style.setProperty('--tilt-y', `${(ny * 6).toFixed(2)}px`);
    if (hero) {
      hero.style.setProperty('--hero-pan-x', `${(nx * 18).toFixed(2)}px`);
      hero.style.setProperty('--hero-pan-y', `${(ny * 14).toFixed(2)}px`);
    }
  };

  heroWord.addEventListener('pointerenter', () => {
    heroWord.classList.add('is-hover');
    if (displacementMap) displacementMap.setAttribute('scale', '26');
  });

  heroWord.addEventListener('pointerleave', () => {
    heroWord.classList.remove('is-hover');
    heroWord.style.setProperty('--tilt-x', '0px');
    heroWord.style.setProperty('--tilt-y', '0px');
    if (hero) {
      hero.style.setProperty('--hero-pan-x', '0px');
      hero.style.setProperty('--hero-pan-y', '0px');
    }
    if (displacementMap) displacementMap.setAttribute('scale', '12');
  });

  heroWord.addEventListener('pointermove', updateLens);

  heroWord.addEventListener('click', () => {
    navigateToAssess();
  });

  heroWord.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      navigateToAssess();
    }
  });

  if (wordReveal) {
    wordReveal.setAttribute('aria-hidden', 'true');
  }
}
