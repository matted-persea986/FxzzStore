(async function () {
  let currentUser = null;
  let cards = [];
  let rules = [];
  let avatars = [];

  const boot = await Fxzz.bootstrap().catch(() => null);
  if (!boot?.user) return (window.location.href = '/login');
  if (boot.user.role === 'admin') return (window.location.href = '/admin');

  currentUser = boot.user;
  renderTopbar(boot.user, boot.session);

  const [me, steam, rulesData, avatarData] = await Promise.all([
    Fxzz.api('/api/me'),
    Fxzz.api('/api/steam'),
    Fxzz.api('/api/rules'),
    Fxzz.api('/api/avatars')
  ]);

  currentUser = me.user;
  cards = steam.items;
  rules = rulesData.rules;
  avatars = avatarData.avatars;

  renderSessionInfo(me.session);
  renderRules();
  fillCategories();
  renderProfile();
  renderCards();

  document.getElementById('searchInput').addEventListener('input', renderCards);
  document.getElementById('filterCategory').addEventListener('change', renderCards);
  document.getElementById('sortMode').addEventListener('change', renderCards);

  document.getElementById('cancelLogout').onclick = () => document.getElementById('confirmModal').classList.add('hidden');
  document.getElementById('confirmLogout').onclick = async () => {
    await Fxzz.api('/api/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  setInterval(() => Fxzz.api('/api/me/ping', { method: 'POST' }).catch(() => {}), 60000);

  function renderTopbar(user, session) {
    document.getElementById('userQuick').innerHTML = `
      <div class="user-chip">
        <img src="${user.avatar}" alt="avatar" />
        <div>
          <strong>${Fxzz.escapeHtml(user.email)}</strong>
          <small>${Fxzz.escapeHtml(session?.deviceLabel || Fxzz.getDeviceName())}</small>
        </div>
      </div>
      <button class="ghost-btn" id="logoutBtn">تسجيل الخروج</button>
    `;
    document.getElementById('logoutBtn').onclick = () => document.getElementById('confirmModal').classList.remove('hidden');
  }

  function renderSessionInfo(session) {
    document.getElementById('sessionInfo').innerHTML = `
      <div class="stat-mini"><span>نوع الجهاز</span><strong>${Fxzz.escapeHtml(session?.deviceLabel || Fxzz.getDeviceName())}</strong></div>
      <div class="stat-mini"><span>رقم الجهاز</span><strong>${Fxzz.escapeHtml(session?.deviceId || Fxzz.getDeviceId())}</strong></div>
      <div class="stat-mini"><span>الجلسات</span><strong>${session?.activeSessions || 1}</strong></div>
    `;
  }

  function renderRules() {
    document.getElementById('rulesList').innerHTML = rules.map((rule) => `<div class="rule-item">${Fxzz.escapeHtml(rule)}</div>`).join('');
  }

  function fillCategories() {
    const select = document.getElementById('filterCategory');
    const categories = ['all', ...new Set(cards.map((item) => item.category))];
    select.innerHTML = categories.map((cat) => `<option value="${cat}">${cat === 'all' ? 'كل الأقسام' : Fxzz.escapeHtml(cat)}</option>`).join('');
  }

  function renderProfile() {
    const options = avatars.map((src) => `
      <button class="avatar-choice ${src === currentUser.avatar ? 'selected' : ''}" data-avatar="${src}">
        <img src="${src}" alt="avatar" />
      </button>
    `).join('');

    document.getElementById('profileWrap').innerHTML = `
      <div class="profile-head">
        <img class="profile-avatar" src="${currentUser.avatar}" alt="avatar" />
        <div>
          <h4>${Fxzz.escapeHtml(currentUser.name)}</h4>
          <p>${Fxzz.escapeHtml(currentUser.email)}</p>
        </div>
      </div>
      <form id="profileForm" class="form-stack compact-top">
        <label><span>الاسم المعروض</span><input id="profileName" value="${Fxzz.escapeHtml(currentUser.name)}" maxlength="40" /></label>
        <div class="avatar-row">${options}</div>
        <button class="primary-btn" type="submit">حفظ التعديل</button>
      </form>
    `;

    let selectedAvatar = currentUser.avatar;
    document.querySelectorAll('.avatar-choice').forEach((btn) => {
      btn.onclick = () => {
        document.querySelectorAll('.avatar-choice').forEach((x) => x.classList.remove('selected'));
        btn.classList.add('selected');
        selectedAvatar = btn.dataset.avatar;
      };
    });

    document.getElementById('profileForm').onsubmit = async (e) => {
      e.preventDefault();
      const updated = await Fxzz.api('/api/me/profile', {
        method: 'PUT',
        body: JSON.stringify({ name: document.getElementById('profileName').value, avatar: selectedAvatar })
      });
      currentUser = updated.user;
      renderTopbar(currentUser, me.session);
      renderProfile();
      Fxzz.showToast('تم تحديث الملف الشخصي');
    };
  }

  function renderCards() {
    const search = document.getElementById('searchInput').value.trim().toLowerCase();
    const category = document.getElementById('filterCategory').value;
    const sortMode = document.getElementById('sortMode').value;

    const filtered = cards
      .filter((item) => category === 'all' || item.category === category)
      .filter((item) => item.game.toLowerCase().includes(search) || item.category.toLowerCase().includes(search) || item.username.toLowerCase().includes(search))
      .sort((a, b) => sortMode === 'status' ? a.status.localeCompare(b.status) : a.game.localeCompare(b.game));

    document.getElementById('cardsCount').textContent = `${filtered.length} بطاقة`;
    document.getElementById('cardsGrid').innerHTML = filtered.map((item) => `
      <article class="steam-card">
        <img class="steam-cover" src="${item.image}" alt="${Fxzz.escapeHtml(item.game)}" loading="lazy" />
        <div class="steam-content">
          <div class="section-head-inline">
            <h4>${Fxzz.escapeHtml(item.game)}</h4>
            <span class="status-tag ${item.status === 'ready' ? 'online' : 'warn'}">${item.status === 'ready' ? 'جاهز' : Fxzz.escapeHtml(item.status)}</span>
          </div>
          <p class="muted">${Fxzz.escapeHtml(item.category)}</p>
          <div class="cred-box"><span>اسم المستخدم</span><strong>${Fxzz.escapeHtml(item.username)}</strong><button class="copy-btn" data-copy="${Fxzz.escapeHtml(item.username)}">نسخ</button></div>
          <div class="cred-box"><span>كلمة المرور</span><strong>${Fxzz.escapeHtml(item.password)}</strong><button class="copy-btn" data-copy="${Fxzz.escapeHtml(item.password)}">نسخ</button></div>
        </div>
      </article>
    `).join('') || '<div class="rule-item">لا توجد بطاقات مطابقة للبحث الحالي.</div>';

    document.querySelectorAll('.copy-btn').forEach((btn) => {
      btn.onclick = async () => {
        await navigator.clipboard.writeText(btn.dataset.copy);
        Fxzz.showToast('تم النسخ بنجاح');
      };
    });
  }
})();
