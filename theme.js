document.addEventListener('DOMContentLoaded', () => {
  const root = document.documentElement;
  const saved = localStorage.getItem('theme');
  const initial = saved === 'light' ? 'light' : 'dark';
  root.setAttribute('data-theme', initial);

  document.querySelectorAll('.theme-toggle').forEach(btn => {
    btn.textContent = initial === 'dark' ? '☀️' : '🌙';
    btn.addEventListener('click', () => {
      const current = root.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
      document.querySelectorAll('.theme-toggle').forEach(b => {
        b.textContent = next === 'dark' ? '☀️' : '🌙';
      });
    });
  });
});
