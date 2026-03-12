(async function () {
  const boot = await Fxzz.bootstrap().catch(() => null);
  if (!boot?.user) return (window.location.href = '/login');
  if (boot.user.role !== 'admin') return (window.location.href = '/dashboard');

  document.getElementById('adminQuick').innerHTML = `
    <div class="user-chip">
      <img src="${boot.user.avatar}" alt="avatar" />
      <div><strong>${Fxzz.escapeHtml(boot.user.email)}</strong><small>Administrator</small></div>
    </div>
    <button class="ghost-btn" id="logoutBtn">تسجيل الخروج</button>
  `;
  document.getElementById('logoutBtn').onclick = async () => {
    if (!confirm('هل تريد تسجيل الخروج؟')) return;
    await Fxzz.api('/api/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  async function loadAll() {
    const overview = await Fxzz.api('/api/admin/overview');
    const users = await Fxzz.api('/api/admin/users');
    const steam = await Fxzz.api('/api/admin/steam');

    renderStats(overview.stats);
    renderUsers(users.users, overview.users);
    renderSteam(steam.items);
    renderSessions(overview.sessions);
  }

  function renderStats(stats) {
    document.getElementById('statsGrid').innerHTML = [
      ['إجمالي المستخدمين', stats.users],
      ['أونلاين الآن', stats.online],
      ['أوفلاين', stats.offline],
      ['حسابات مكررة', stats.duplicateAccounts],
      ['بطاقات Steam', stats.steamCards]
    ].map(([label, value]) => `<div class="glass-card stat-card"><span>${label}</span><strong>${value}</strong></div>`).join('');
  }

  function renderUsers(users, richUsers) {
    const rows = users.map((user) => {
      const details = richUsers.find((item) => item.id === user.id);
      const sessionHint = details?.sessions?.[0];
      return `
        <div class="list-row">
          <div>
            <strong>${Fxzz.escapeHtml(user.name)}</strong>
            <p>${Fxzz.escapeHtml(user.email)} • ${user.role}</p>
            <small>${details?.status === 'online' ? 'أونلاين' : 'أوفلاين'} ${sessionHint ? '• ' + Fxzz.escapeHtml(sessionHint.deviceId) : ''}</small>
          </div>
          <div class="row-actions">
            <button class="ghost-btn toggle-user" data-id="${user.id}" data-active="${user.active}">${user.active ? 'تعطيل' : 'تفعيل'}</button>
            ${user.email !== 'admin@fxzzstore.local' ? `<button class="danger-btn delete-user" data-id="${user.id}">حذف</button>` : ''}
          </div>
        </div>
      `;
    }).join('');
    document.getElementById('usersTable').innerHTML = rows || '<p class="muted">لا يوجد مستخدمون</p>';

    document.querySelectorAll('.toggle-user').forEach((btn) => {
      btn.onclick = async () => {
        await Fxzz.api(`/api/admin/users/${btn.dataset.id}`, {
          method: 'PUT',
          body: JSON.stringify({ active: btn.dataset.active !== 'true' })
        });
        Fxzz.showToast('تم تحديث الحالة');
        loadAll();
      };
    });

    document.querySelectorAll('.delete-user').forEach((btn) => {
      btn.onclick = async () => {
        if (!confirm('هل تريد حذف هذا المستخدم؟')) return;
        await Fxzz.api(`/api/admin/users/${btn.dataset.id}`, { method: 'DELETE' });
        Fxzz.showToast('تم حذف المستخدم');
        loadAll();
      };
    });
  }

  function renderSteam(items) {
    document.getElementById('steamTable').innerHTML = items.map((item) => `
      <div class="list-row">
        <div>
          <strong>${Fxzz.escapeHtml(item.game)}</strong>
          <p>${Fxzz.escapeHtml(item.username)} • ${Fxzz.escapeHtml(item.category)}</p>
        </div>
        <div class="row-actions"><button class="danger-btn delete-card" data-id="${item.id}">حذف</button></div>
      </div>
    `).join('');

    document.querySelectorAll('.delete-card').forEach((btn) => {
      btn.onclick = async () => {
        if (!confirm('هل تريد حذف البطاقة؟')) return;
        await Fxzz.api(`/api/admin/steam/${btn.dataset.id}`, { method: 'DELETE' });
        Fxzz.showToast('تم حذف البطاقة');
        loadAll();
      };
    });
  }

  function renderSessions(items) {
    document.getElementById('sessionTable').innerHTML = items.map((item) => `
      <div class="list-row">
        <div>
          <strong>${Fxzz.escapeHtml(item.email)}</strong>
          <p>${Fxzz.escapeHtml(item.deviceLabel)} • ${Fxzz.escapeHtml(item.browser)}</p>
          <small>${Fxzz.escapeHtml(item.deviceId)} • ${Fxzz.escapeHtml(item.ip)}</small>
        </div>
        <div><span class="pill">${new Date(item.lastSeen).toLocaleString('ar-SA')}</span></div>
      </div>
    `).join('') || '<p class="muted">لا توجد جلسات نشطة</p>';
  }

  document.getElementById('addUserForm').onsubmit = async (event) => {
    event.preventDefault();
    await Fxzz.api('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify({
        name: document.getElementById('newUserName').value,
        email: document.getElementById('newUserEmail').value,
        password: document.getElementById('newUserPassword').value,
        role: document.getElementById('newUserRole').value
      })
    });
    event.target.reset();
    Fxzz.showToast('تمت إضافة المستخدم');
    loadAll();
  };

  document.getElementById('addCardForm').onsubmit = async (event) => {
    event.preventDefault();
    await Fxzz.api('/api/admin/steam', {
      method: 'POST',
      body: JSON.stringify({
        game: document.getElementById('gameName').value,
        category: document.getElementById('gameCategory').value,
        username: document.getElementById('steamUser').value,
        password: document.getElementById('steamPass').value,
        image: document.getElementById('gameImage').value
      })
    });
    event.target.reset();
    Fxzz.showToast('تمت إضافة البطاقة');
    loadAll();
  };

  setInterval(() => Fxzz.api('/api/me/ping', { method: 'POST' }).catch(() => {}), 60000);
  loadAll();
})();
