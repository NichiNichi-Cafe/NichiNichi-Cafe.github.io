// GC010: page observations follow the language actually displayed by the site.
(() => {
  'use strict';
  const route = location.pathname.replace(/index\.html$/, '');
  const names = {
    '/': ['NichiNichi Café', 'NichiNichi Café — EN'],
    '/kalender/': ['Kalender · NichiNichi', 'Calendar · NichiNichi — EN'],
    '/ernaehrung/': ['Ernährungswünsche · NichiNichi', 'Dietary preferences · NichiNichi — EN'],
    '/anfahrt/': ['Anfahrt & Parken · NichiNichi', 'Directions & parking · NichiNichi — EN']
  };
  if (!Object.hasOwn(names, route)) return;

  const loader = document.querySelector('script[data-goatcounter]');
  if (!loader) return;
  const observed = new Set();
  let language = null;
  let bound = false;

  function observe() {
    const gc = window.goatcounter;
    if (!language || document.visibilityState === 'hidden' || !gc?.count || !gc?.bind_events) return;
    try {
      // no_onload disables both the automatic page count and click binding.
      if (!bound) {
        gc.bind_events();
        bound = true;
      }
      const path = language === 'en' ? '/en' + route : route;
      if (observed.has(path)) return;
      // Leave session deduplication and campaign/referrer handling to GoatCounter.
      if (gc.filter?.()) return;
      gc.count({ path, title: names[route][language === 'en' ? 1 : 0], event: false });
      observed.add(path);
    } catch (_) {
      // A blocked analytics API or storage must not disrupt the guest interface.
    }
  }

  window.addEventListener('nichinichi-language', event => {
    if (!['de', 'en'].includes(event.detail)) return;
    language = document.documentElement.lang;
    if (!['de', 'en'].includes(language)) return;
    observe();
  });
  loader.addEventListener('load', observe);
  document.addEventListener('visibilitychange', observe);
  window.addEventListener('pageshow', observe);
})();
