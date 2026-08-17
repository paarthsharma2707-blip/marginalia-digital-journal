(() => {
  const MOOD_META = {
    joyful: { icon: '🌞', label: 'Joyful' },
    calm: { icon: '🌿', label: 'Calm' },
    neutral: { icon: '🌙', label: 'Neutral' },
    excited: { icon: '✨', label: 'Excited' },
    anxious: { icon: '🌊', label: 'Anxious' },
    sad: { icon: '🌧️', label: 'Sad' },
    angry: { icon: '🔥', label: 'Angry' },
  };

  const state = {
    user: null,
    entries: [],
    selectedId: null,
    filters: { search: '', mood: '', tag: '', favorite: false },
    editing: false,
  };

  const $ = (sel) => document.querySelector(sel);
  const els = {
    authScreen: $('#auth-screen'),
    appScreen: $('#app-screen'),

    loginForm: $('#login-form'),
    registerForm: $('#register-form'),
    authTabs: document.querySelectorAll('.auth-tab'),

    logoutBtn: $('#logout-btn'),
    newEntryBtn: $('#new-entry-btn'),
    searchInput: $('#search-input'),
    moodFilter: $('#mood-filter'),
    favoriteFilter: $('#favorite-filter'),
    tagChips: $('#tag-chips'),
    entryList: $('#entry-list'),
    userChip: $('#user-chip'),

    streakNumber: $('#streak-number'),
    inkCalendar: $('#ink-calendar'),
    moodBreakdown: $('#mood-breakdown'),
    statsTags: $('#stats-tags'),

    emptyState: $('#empty-state'),
    entryView: $('#entry-view'),
    editToggleBtn: $('#edit-toggle-btn'),
    favoriteToggleBtn: $('#favorite-toggle-btn'),
    deleteEntryBtn: $('#delete-entry-btn'),
    saveStatus: $('#save-status'),

    entryTitle: $('#entry-title'),
    entryMood: $('#entry-mood'),
    entryTags: $('#entry-tags'),
    entryDate: $('#entry-date'),
    entryContent: $('#entry-content'),

    toast: $('#toast'),
  };

  // ---------------- helpers ----------------
  function showToast(message, isError = false) {
    els.toast.textContent = message;
    els.toast.classList.toggle('is-error', isError);
    els.toast.classList.remove('is-hidden');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => els.toast.classList.add('is-hidden'), 2600);
  }

  function debounce(fn, wait) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  function formatDate(iso) {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function snippetOf(text, len = 70) {
    const clean = text.replace(/\s+/g, ' ').trim();
    return clean.length > len ? clean.slice(0, len) + '…' : clean;
  }

  // ---------------- auth screen ----------------
  els.authTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      els.authTabs.forEach((t) => t.classList.remove('is-active'));
      tab.classList.add('is-active');
      const target = tab.dataset.tab;
      els.loginForm.classList.toggle('is-hidden', target !== 'login');
      els.registerForm.classList.toggle('is-hidden', target !== 'register');
    });
  });

  els.loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = els.loginForm.querySelector('.form-error');
    errorEl.textContent = '';
    const data = new FormData(els.loginForm);
    try {
      const res = await Api.login({ email: data.get('email'), password: data.get('password') });
      Api.setToken(res.token);
      await enterApp(res.user);
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });

  els.registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = els.registerForm.querySelector('.form-error');
    errorEl.textContent = '';
    const data = new FormData(els.registerForm);
    try {
      const res = await Api.register({
        name: data.get('name'),
        email: data.get('email'),
        password: data.get('password'),
      });
      Api.setToken(res.token);
      await enterApp(res.user);
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });

  els.logoutBtn.addEventListener('click', () => {
    Api.clearToken();
    state.user = null;
    state.entries = [];
    state.selectedId = null;
    els.appScreen.classList.add('is-hidden');
    els.authScreen.classList.remove('is-hidden');
  });

  // ---------------- entering the app ----------------
  async function enterApp(user) {
    state.user = user;
    els.authScreen.classList.add('is-hidden');
    els.appScreen.classList.remove('is-hidden');
    els.userChip.textContent = user.name;
    await Promise.all([loadEntries(), loadStats()]);
  }

  async function tryResumeSession() {
    if (!Api.hasToken()) return;
    try {
      const res = await Api.me();
      await enterApp(res.user);
    } catch {
      Api.clearToken();
    }
  }

  // ---------------- entries: load + render list ----------------
  async function loadEntries() {
    const params = {
      search: state.filters.search,
      mood: state.filters.mood,
      tag: state.filters.tag,
      favorite: state.filters.favorite ? 'true' : '',
    };
    try {
      const res = await Api.listEntries(params);
      state.entries = res.entries;
      renderEntryList();
    } catch (err) {
      showToast(err.message, true);
    }
  }

  function renderEntryList() {
    els.entryList.innerHTML = '';
    if (state.entries.length === 0) {
      const p = document.createElement('p');
      p.className = 'empty-list-hint';
      p.textContent = 'No entries match yet. Try a different filter, or write something new.';
      els.entryList.appendChild(p);
      return;
    }

    state.entries.forEach((entry, index) => {
      const item = document.createElement('button');
      item.className = 'entry-item' + (entry.id === state.selectedId ? ' is-active' : '');
      item.style.setProperty('--i', index);
      item.innerHTML = `
        <span class="entry-item-top">
          ${MOOD_META[entry.mood]?.icon || '🌙'} ${escapeHtml(entry.title || 'Untitled entry')}
          ${entry.favorite ? ' ★' : ''}
        </span>
        <span class="entry-item-snippet">${escapeHtml(snippetOf(entry.content || ''))}</span>
        <span class="entry-item-date">${formatDate(entry.createdAt)}</span>
      `;
      item.addEventListener('click', () => selectEntry(entry.id));
      els.entryList.appendChild(item);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ---------------- entry view / editor ----------------
  function selectEntry(id) {
    const entry = state.entries.find((e) => e.id === id);
    if (!entry) return;
    state.selectedId = id;
    state.editing = false;
    renderEntryList();
    renderEntryView(entry);
  }

  function renderEntryView(entry) {
    els.emptyState.classList.add('is-hidden');
    els.entryView.classList.remove('is-hidden');

    els.entryTitle.value = entry.title;
    els.entryMood.value = entry.mood;
    els.entryTags.value = entry.tags.join(', ');
    els.entryDate.textContent = formatDate(entry.createdAt);
    els.entryContent.value = entry.content;
    els.favoriteToggleBtn.textContent = entry.favorite ? '★' : '☆';
    els.favoriteToggleBtn.classList.toggle('is-active', entry.favorite);

    setEditMode(false);
  }

  function setEditMode(on) {
    state.editing = on;
    [els.entryTitle, els.entryMood, els.entryTags, els.entryContent].forEach((el) => {
      if (el.tagName === 'SELECT') el.disabled = !on;
      else el.readOnly = !on;
    });
    els.editToggleBtn.textContent = on ? 'Done' : 'Edit';
    if (on) els.entryTitle.focus();
  }

  els.editToggleBtn.addEventListener('click', () => {
    if (!state.selectedId) return;
    if (state.editing) {
      saveCurrentEntry(true);
    }
    setEditMode(!state.editing);
  });

  const autosave = debounce(() => saveCurrentEntry(false), 700);
  [els.entryTitle, els.entryMood, els.entryTags, els.entryContent].forEach((el) => {
    el.addEventListener('input', () => {
      if (state.editing) {
        els.saveStatus.textContent = 'Editing…';
        autosave();
      }
    });
  });

  async function saveCurrentEntry(showConfirmation) {
    if (!state.selectedId) return;
    const payload = {
      title: els.entryTitle.value.trim() || 'Untitled entry',
      content: els.entryContent.value,
      mood: els.entryMood.value,
      tags: els.entryTags.value.split(',').map((t) => t.trim()).filter(Boolean),
    };
    try {
      const res = await Api.updateEntry(state.selectedId, payload);
      const idx = state.entries.findIndex((e) => e.id === state.selectedId);
      if (idx !== -1) state.entries[idx] = res.entry;
      renderEntryList();
      els.saveStatus.textContent = 'Saved just now';
      if (showConfirmation) showToast('Entry saved');
      loadStats();
    } catch (err) {
      els.saveStatus.textContent = '';
      showToast(err.message, true);
    }
  }

  els.favoriteToggleBtn.addEventListener('click', async () => {
    if (!state.selectedId) return;
    const entry = state.entries.find((e) => e.id === state.selectedId);
    try {
      const res = await Api.updateEntry(state.selectedId, { favorite: !entry.favorite });
      Object.assign(entry, res.entry);
      els.favoriteToggleBtn.textContent = entry.favorite ? '★' : '☆';
      els.favoriteToggleBtn.classList.toggle('is-active', entry.favorite);
      renderEntryList();
    } catch (err) {
      showToast(err.message, true);
    }
  });

  els.deleteEntryBtn.addEventListener('click', async () => {
    if (!state.selectedId) return;
    if (!confirm('Delete this entry? This cannot be undone.')) return;
    try {
      await Api.deleteEntry(state.selectedId);
      state.entries = state.entries.filter((e) => e.id !== state.selectedId);
      state.selectedId = null;
      els.entryView.classList.add('is-hidden');
      els.emptyState.classList.remove('is-hidden');
      renderEntryList();
      loadStats();
      showToast('Entry deleted');
    } catch (err) {
      showToast(err.message, true);
    }
  });

  els.newEntryBtn.addEventListener('click', async () => {
    try {
      const res = await Api.createEntry({
        title: 'Untitled entry',
        content: '',
        mood: 'neutral',
        tags: [],
      });
      state.entries.unshift(res.entry);
      renderEntryList();
      selectEntry(res.entry.id);
      setEditMode(true);
      loadStats();
    } catch (err) {
      showToast(err.message, true);
    }
  });

  // ---------------- filters ----------------
  els.searchInput.addEventListener(
    'input',
    debounce((e) => {
      state.filters.search = e.target.value;
      loadEntries();
    }, 350)
  );
  els.moodFilter.addEventListener('change', (e) => {
    state.filters.mood = e.target.value;
    loadEntries();
  });
  els.favoriteFilter.addEventListener('click', () => {
    state.filters.favorite = !state.filters.favorite;
    els.favoriteFilter.classList.toggle('is-active', state.filters.favorite);
    els.favoriteFilter.textContent = state.filters.favorite ? '★' : '☆';
    loadEntries();
  });

  function renderTagChips(container, tags) {
    container.innerHTML = '';
    tags.forEach((tag) => {
      const chip = document.createElement('button');
      chip.className = 'tag-chip' + (state.filters.tag === tag ? ' is-active' : '');
      chip.textContent = tag;
      chip.addEventListener('click', () => {
        state.filters.tag = state.filters.tag === tag ? '' : tag;
        loadEntries();
        loadStats();
      });
      container.appendChild(chip);
    });
  }

  // ---------------- stats: streak, ink calendar, mood breakdown ----------------
  async function loadStats() {
    try {
      const stats = await Api.stats();
      animateStreakTo(stats.currentStreak);
      renderInkCalendar(stats.calendar);
      renderMoodBreakdown(stats.moodCounts, stats.total);
      renderTagChips(els.tagChips, stats.tags);
      renderTagChips(els.statsTags, stats.tags);
    } catch (err) {
      showToast(err.message, true);
    }
  }

  function renderInkCalendar(calendarDates) {
    const filled = new Set(calendarDates);
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const leadingBlanks = firstDay.getDay(); // 0 = Sunday
    const todayKey = now.toISOString().slice(0, 10);

    els.inkCalendar.innerHTML = '';
    for (let i = 0; i < leadingBlanks; i++) {
      const spacer = document.createElement('span');
      spacer.className = 'ink-dot';
      spacer.style.visibility = 'hidden';
      els.inkCalendar.appendChild(spacer);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dot = document.createElement('span');
      dot.className = 'ink-dot' + (filled.has(key) ? ' is-filled' : '') + (key === todayKey ? ' is-today' : '');
      dot.title = key + (filled.has(key) ? ' — wrote an entry' : '');
      els.inkCalendar.appendChild(dot);
    }
  }

  function renderMoodBreakdown(moodCounts, total) {
    els.moodBreakdown.innerHTML = '';
    Object.entries(moodCounts).forEach(([mood, count]) => {
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      const row = document.createElement('div');
      row.className = 'mood-row';
      row.innerHTML = `
        <span>${MOOD_META[mood]?.icon || '🌙'}</span>
        <span>${MOOD_META[mood]?.label || mood}</span>
        <span class="mood-bar-track"><span class="mood-bar-fill" style="width:${pct}%"></span></span>
        <span>${count}</span>
      `;
      els.moodBreakdown.appendChild(row);
    });
  }

  // ---------------- decorative: hero constellation (auth screen) ----------------
  function seedHeroConstellation() {
    const field = document.getElementById('hero-constellation');
    if (!field) return;
    const count = 34;
    for (let i = 0; i < count; i++) {
      const dot = document.createElement('span');
      dot.className = 'c-dot';
      dot.style.left = `${Math.random() * 100}%`;
      dot.style.top = `${Math.random() * 100}%`;
      dot.style.animationDelay = `${(Math.random() * 4.5).toFixed(2)}s`;
      field.appendChild(dot);
    }
  }
  seedHeroConstellation();

  // ---------------- decorative: animate streak count-up ----------------
  function animateStreakTo(target) {
    const el = els.streakNumber;
    const from = Number(el.textContent) || 0;
    if (from === target) return;
    const duration = 500;
    const start = performance.now();
    function tick(now) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(from + (target - from) * eased);
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // ---------------- boot ----------------
  tryResumeSession();
})();
