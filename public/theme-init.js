// Runs before first paint (loaded as a same-origin script so the CSP stays script-src 'self').
// Keeps in sync with src/context/ThemeContext.jsx: preference light | dark | system, stored in localStorage.
(function () {
  var pref = 'system';
  try {
    var saved = localStorage.getItem('selora-theme');
    if (saved === 'light' || saved === 'dark' || saved === 'system') pref = saved;
  } catch (e) { /* storage unavailable: follow the system */ }
  var dark = pref === 'dark' || (pref === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  var root = document.documentElement;
  root.setAttribute('data-theme', dark ? 'dark' : 'light');
  root.style.colorScheme = dark ? 'dark' : 'light';
})();
