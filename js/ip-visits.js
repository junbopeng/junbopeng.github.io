// Record only production page views; no cookies, query strings or referrer data.
(() => {
  if (location.origin !== 'https://junbopeng.github.io') return;
  if (!['/', '/index.html', '/gallery.html'].includes(location.pathname)) return;
  fetch('https://homepage-visit-log.pjbustc.workers.dev/visit', {
    method: 'POST',
    body: JSON.stringify({ path: location.pathname }),
    headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    keepalive: true,
  }).catch(() => {});
})();
