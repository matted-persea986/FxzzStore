const Fxzz = (() => {
  const storageKey = 'fxzz_device_id';
  const nameKey = 'fxzz_device_name';

  function getDeviceId() {
    let id = localStorage.getItem(storageKey);
    if (!id) {
      id = 'FXZZ-' + Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
      localStorage.setItem(storageKey, id);
    }
    return id;
  }

  function getDeviceName() {
    let saved = localStorage.getItem(nameKey);
    if (saved) return saved;
    const ua = navigator.userAgent.toLowerCase();
    const type = /mobile|iphone|android/.test(ua) ? 'Mobile' : /ipad|tablet/.test(ua) ? 'Tablet' : 'Desktop';
    const browser = ua.includes('edg') ? 'Edge' : ua.includes('firefox') ? 'Firefox' : ua.includes('chrome') ? 'Chrome' : 'Browser';
    saved = `${type} • ${browser}`;
    localStorage.setItem(nameKey, saved);
    return saved;
  }

  async function api(url, options = {}) {
    const res = await fetch(url, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Request failed');
    return data;
  }

  function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      toast.className = 'toast';
    }, 2400);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  async function bootstrap() {
    return api('/api/bootstrap');
  }

  return { getDeviceId, getDeviceName, api, showToast, escapeHtml, bootstrap };
})();
