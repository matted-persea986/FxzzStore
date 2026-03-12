(async function () {
  const loader = document.getElementById('loader');
  setTimeout(() => loader.classList.remove('active'), 1200);

  try {
    const boot = await Fxzz.bootstrap();
    if (boot.user) {
      window.location.href = boot.user.role === 'admin' ? '/admin' : '/dashboard';
      return;
    }
  } catch (_) {}

  const form = document.getElementById('loginForm');
  const box = document.getElementById('authMessage');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    box.classList.add('hidden');
    try {
      const data = await Fxzz.api('/api/login', {
        method: 'POST',
        body: JSON.stringify({
          email: document.getElementById('email').value,
          password: document.getElementById('password').value,
          deviceId: Fxzz.getDeviceId(),
          deviceName: Fxzz.getDeviceName()
        })
      });
      Fxzz.showToast('تم تسجيل الدخول بنجاح');
      setTimeout(() => {
        window.location.href = data.user.role === 'admin' ? '/admin' : '/dashboard';
      }, 500);
    } catch (error) {
      box.textContent = error.message;
      box.classList.remove('hidden');
    }
  });
})();
