import {bindFieldMotion} from "./field-springs.js";
// Short blur accompanies movement, never resting content or pure color changes.
export function bindMotion() {
  const fieldCleanup=bindFieldMotion();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const active = new Set(), byElement = new WeakMap();
  const enabled = () => !reduced.matches && document.documentElement.dataset.presentationMotion !== 'calm' && !document.hidden;
  const cancel = () => { for (const animation of active) animation.cancel(); active.clear(); };
  const blur = (element, duration) => {
    if (!enabled() || !(element instanceof Element) || !element.animate || element.closest('[data-loew-spring="true"]')) return;
    const mobile = innerWidth <= 900, rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height || rect.bottom < 0 || rect.top > innerHeight) return;
    if (element.matches(".operator-topbar,.qa-companion,.presentation-panel") || rect.width * rect.height > (mobile ? 80000 : 160000)) {
      // A large rail/panel moves its small identity layer; no viewport-sized filter.
      const identity = element.querySelector('.operator-brand, .qa-review-head, .presentation-panel > strong');
      if (identity) blur(identity, duration);
      return;
    }
    const previous = byElement.get(element);
    if (previous) { previous.cancel(); active.delete(previous); }
    if (active.size >= (mobile ? 2 : 4)) return;
    const resting = getComputedStyle(element).filter;
    const base = resting === 'none' ? '' : resting + ' ';
    const animation = element.animate([
      { filter: resting },
      { offset: .35, filter: base + `blur(${mobile ? .6 : 1}px)` },
      { filter: resting }
    ], { id: 'relay-motion-blur', duration: Math.min(duration, mobile ? 240 : 400), easing: 'cubic-bezier(.16,.9,.28,1.08)' });
    byElement.set(element, animation); active.add(animation);
    animation.finished.catch(() => {}).finally(() => { active.delete(animation); if (byElement.get(element) === animation) byElement.delete(element); });
  };
  const transition = event => {
    if (event.pseudoElement || !['transform','width','padding-left','padding-right','max-width'].includes(event.propertyName)) return;
    const seconds = Math.max(...getComputedStyle(event.target).transitionDuration.split(',').map(parseFloat));
    blur(event.target, seconds * 1000);
  };
  const animation = event => {
    // These CSS effects own their bounded blur, including the tiny status rings.
    if (event.pseudoElement || /^(signal-spring|unit-arrive|relay-(?!panel-enter)|inspector-card-)/.test(event.animationName)) return;
    const moving = event.target.getAnimations().find(a => a.animationName === event.animationName);
    const timing = moving?.effect?.getTiming();
    if (timing?.iterations === Infinity || !moving?.effect?.getKeyframes().some(frame => frame.transform && frame.transform !== 'none')) return;
    blur(event.target, Number(timing.duration));
  };
  const preference = () => { if (!enabled()) cancel(); };
  const observer = new MutationObserver(preference);
  observer.observe(document.documentElement, {attributes:true,attributeFilter:['data-presentation-motion']});
  document.addEventListener('transitionrun', transition); document.addEventListener('animationstart', animation);
  document.addEventListener('visibilitychange', preference); reduced.addEventListener('change', preference);
  return () => {fieldCleanup();cancel();observer.disconnect();document.removeEventListener('transitionrun',transition);document.removeEventListener('animationstart',animation);document.removeEventListener('visibilitychange',preference);reduced.removeEventListener('change',preference);};
}
