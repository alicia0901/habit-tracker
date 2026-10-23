const state = {
  token: localStorage.getItem('token') || null,
  username: localStorage.getItem('username') || null,
  isRegisterMode: false,
};

const el = {
  authSection: document.getElementById('authSection'),
  mainSection: document.getElementById('mainSection'),
  userBar: document.getElementById('userBar'),
  userName: document.getElementById('userName'),
  authForm: document.getElementById('authForm'),
  authTitle: document.getElementById('authTitle'),
  authError: document.getElementById('authError'),
  toggleModeBtn: document.getElementById('toggleModeBtn'),
  logoutBtn: document.getElementById('logoutBtn'),
  newHabitForm: document.getElementById('newHabitForm'),
  newHabitName: document.getElementById('newHabitName'),
  habitList: document.getElementById('habitList'),
};

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'エラーが発生しました');
  return data;
}

function renderAuthState() {
  const loggedIn = !!state.token;
  el.authSection.classList.toggle('hidden', loggedIn);
  el.mainSection.classList.toggle('hidden', !loggedIn);
  el.userBar.classList.toggle('hidden', !loggedIn);
  el.userName.textContent = state.username || '';
}

function renderHeatmap(container, logs) {
  container.innerHTML = '';
  container.className = 'heatmap';
  for (const day of logs) {
    const cell = document.createElement('div');
    cell.className = `cell${day.done ? ' done' : ''}`;
    cell.title = day.date;
    container.appendChild(cell);
  }
}

async function loadHabits() {
  const habits = await api('/habits');
  el.habitList.innerHTML = '';

  for (const habit of habits) {
    const li = document.createElement('li');
    li.className = 'habit';
    li.innerHTML = `
      <div class="habit-top">
        <button class="check-btn${habit.doneToday ? ' done' : ''}" title="今日の達成を切り替え">${habit.doneToday ? '✓' : ''}</button>
        <div>
          <div class="habit-name">${escapeHtml(habit.name)}</div>
          <div class="streak">現在 ${habit.streak.current}日連続 / 最長 ${habit.streak.longest}日</div>
        </div>
        <button class="delete-btn">削除</button>
      </div>
      <div class="heatmap"></div>
    `;

    li.querySelector('.check-btn').addEventListener('click', async () => {
      await api(`/habits/${habit.id}/toggle`, { method: 'POST', body: JSON.stringify({}) });
      loadHabits();
    });
    li.querySelector('.delete-btn').addEventListener('click', async () => {
      if (!confirm(`「${habit.name}」を削除しますか?`)) return;
      await api(`/habits/${habit.id}`, { method: 'DELETE' });
      loadHabits();
    });

    el.habitList.appendChild(li);

    api(`/habits/${habit.id}/logs?days=30`).then((logs) => {
      renderHeatmap(li.querySelector('.heatmap'), logs);
    });
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

el.toggleModeBtn.addEventListener('click', () => {
  state.isRegisterMode = !state.isRegisterMode;
  el.authTitle.textContent = state.isRegisterMode ? 'アカウント作成' : 'ログイン';
  el.authForm.querySelector('button[type="submit"]').textContent = state.isRegisterMode ? '作成する' : 'ログイン';
  el.toggleModeBtn.textContent = state.isRegisterMode ? 'ログインに戻る' : 'アカウントを作成する';
});

el.authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  el.authError.classList.add('hidden');
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  try {
    const path = state.isRegisterMode ? '/auth/register' : '/auth/login';
    const data = await api(path, { method: 'POST', body: JSON.stringify({ username, password }) });
    state.token = data.token;
    state.username = data.username;
    localStorage.setItem('token', data.token);
    localStorage.setItem('username', data.username);
    renderAuthState();
    loadHabits();
  } catch (err) {
    el.authError.textContent = err.message;
    el.authError.classList.remove('hidden');
  }
});

el.logoutBtn.addEventListener('click', () => {
  state.token = null;
  state.username = null;
  localStorage.removeItem('token');
  localStorage.removeItem('username');
  renderAuthState();
});

el.newHabitForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = el.newHabitName.value.trim();
  if (!name) return;
  await api('/habits', { method: 'POST', body: JSON.stringify({ name }) });
  el.newHabitName.value = '';
  loadHabits();
});

renderAuthState();
if (state.token) loadHabits();
