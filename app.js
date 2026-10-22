(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  let toastTimeout;
  function notify(message) {
    $('toast').textContent = message;
    $('toast').hidden = false;
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => { $('toast').hidden = true; }, 4500);
  }
  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem('little-lab:' + key)) ?? fallback; }
    catch { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem('little-lab:' + key, JSON.stringify(value)); }
    catch { notify('浏览器暂时无法保存，当前页面仍可使用。'); }
  }

  const localDay = () => new Date().toLocaleDateString('sv-SE');
  let sessions = read('sessions', {});
  if (!sessions || typeof sessions !== 'object') sessions = {};
  function updateSessions() {
    if (sessions.day !== localDay()) sessions = { day: localDay(), count: 0 };
    if (!Number.isSafeInteger(sessions.count) || sessions.count < 0) sessions.count = 0;
    $('focus-count').textContent = `今天已完成 ${sessions.count} 次专注`;
  }
  let minutes = 25, remaining = 25 * 60, endTime = null, running = false;
  const savedTimer = read('timer', null);
  if (savedTimer && [5, 25].includes(savedTimer.minutes) && Number.isFinite(savedTimer.remaining)) {
    minutes = savedTimer.minutes;
    remaining = Math.min(minutes * 60, Math.max(0, savedTimer.remaining));
    endTime = Number.isFinite(savedTimer.endTime) ? savedTimer.endTime : null;
    running = endTime !== null;
  }
  function saveTimer() { save('timer', { minutes, remaining, endTime }); }
  function renderTimer() {
    const seconds = Math.max(0, Math.ceil(remaining));
    $('timer-display').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    $('timer-display').setAttribute('aria-label', `剩余 ${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`);
    $('timer-progress').style.strokeDashoffset = String(552.92 * (1 - seconds / (minutes * 60)));
    $('timer-label').textContent = running ? (minutes === 25 ? '专注进行中' : '放松一下吧') : remaining === 0 ? '这一段时间，属于你' : remaining < minutes * 60 ? '暂停一下也没关系' : '准备好了吗';
    $('timer-start').textContent = running ? 'Ⅱ  暂停计时' : remaining === 0 ? '↻  再来一轮' : remaining < minutes * 60 ? '▶  继续计时' : minutes === 25 ? '▶  开始专注' : '▶  开始休息';
    document.querySelectorAll('[data-minutes]').forEach(button => { const active = Number(button.dataset.minutes) === minutes; button.classList.toggle('selected', active); button.setAttribute('aria-pressed', String(active)); });
  }
  function tick() {
    updateSessions();
    if (!running) return;
    remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
    if (remaining === 0) {
      running = false; endTime = null;
      if (minutes === 25) { sessions.count++; save('sessions', sessions); updateSessions(); }
      const message = minutes === 25 ? '这一轮专注完成了，给自己一点休息时间吧。' : '休息结束，准备好开始下一件小事了吗？';
      $('timer-message').textContent = message; notify(message); saveTimer();
    }
    renderTimer();
  }
  $('timer-start').addEventListener('click', () => {
    if (running) { remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000)); running = false; endTime = null; }
    else { if (remaining === 0) remaining = minutes * 60; endTime = Date.now() + remaining * 1000; running = true; }
    saveTimer(); renderTimer();
  });
  $('timer-reset').addEventListener('click', () => { running = false; endTime = null; remaining = minutes * 60; saveTimer(); renderTimer(); });
  document.querySelectorAll('[data-minutes]').forEach(button => button.addEventListener('click', () => {
    const next = Number(button.dataset.minutes);
    if (minutes === next) return;
    minutes = next; remaining = minutes * 60; running = false; endTime = null; saveTimer(); renderTimer();
  }));
  setInterval(tick, 500);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
  updateSessions(); tick(); renderTimer();

  let tasks = read('tasks', []);
  tasks = Array.isArray(tasks) ? tasks.filter(task => task && typeof task.text === 'string' && typeof task.id === 'string').map(task => ({ id: task.id, text: task.text.slice(0, 160), done: task.done === true })) : [];
  function renderTasks() {
    $('todo-list').replaceChildren();
    for (const task of tasks) {
      const item = document.createElement('li'); item.classList.toggle('done', task.done);
      const label = document.createElement('label');
      const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = task.done;
      const text = document.createElement('span'); text.textContent = task.text;
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'delete-task'; remove.textContent = '×'; remove.setAttribute('aria-label', '删除待办：' + task.text);
      checkbox.addEventListener('change', () => { task.done = checkbox.checked; save('tasks', tasks); renderTasks(); $('todo-list').querySelectorAll('input')[tasks.indexOf(task)]?.focus(); });
      remove.addEventListener('click', () => { tasks = tasks.filter(entry => entry.id !== task.id); save('tasks', tasks); renderTasks(); $('todo-input').focus(); });
      label.append(checkbox, text); item.append(label, remove); $('todo-list').append(item);
    }
    const completed = tasks.filter(task => task.done).length;
    $('todo-empty').hidden = tasks.length > 0;
    $('todo-summary').textContent = `${completed} / ${tasks.length} 已完成`;
    $('clear-completed').disabled = completed === 0;
    $('todo-progress-bar').style.width = `${tasks.length ? completed / tasks.length * 100 : 0}%`;
  }
  $('todo-form').addEventListener('submit', event => {
    event.preventDefault(); const text = $('todo-input').value.trim();
    if (!text) { notify('先写下一件想完成的小事吧。'); return; }
    tasks.push({ id: Array.from(crypto.getRandomValues(new Uint32Array(4)), value => value.toString(16)).join('-'), text, done: false }); save('tasks', tasks); renderTasks(); $('todo-input').value = ''; $('todo-input').focus(); $('todo-list').lastElementChild.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
  $('clear-completed').addEventListener('click', () => { tasks = tasks.filter(task => !task.done); save('tasks', tasks); renderTasks(); $('todo-input').focus(); });
  renderTasks();

  const savedOptions = read('options', null);
  if (typeof savedOptions === 'string') $('random-options').value = savedOptions;
  $('random-options').addEventListener('input', () => { save('options', $('random-options').value); $('random-result-label').textContent = '选项已更新'; $('random-result-text').textContent = '准备好，再抽一次。'; });
  $('draw-button').addEventListener('click', () => {
    const options = $('random-options').value.split(/\r?\n/).map(option => option.trim()).filter(Boolean);
    if (!options.length) { $('random-result-label').textContent = '还没有候选项'; $('random-result-text').textContent = '先写下至少一个选项吧。'; $('random-options').focus(); return; }
    const limit = Math.floor(4294967296 / options.length) * options.length;
    const random = new Uint32Array(1);
    do { crypto.getRandomValues(random); } while (random[0] >= limit);
    $('random-result-label').textContent = `从 ${options.length} 个选项中，抽到的是`;
    $('random-result-text').textContent = options[random[0] % options.length];
  });

  let textMode = 'count';
  function updateStats() {
    const text = $('text-input').value;
    $('char-count').textContent = Array.from(text.replace(/\s/gu, '')).length.toLocaleString();
    $('word-count').textContent = (text.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) || []).length.toLocaleString();
    $('line-count').textContent = text.length ? text.split(/\r\n|\r|\n/).length.toLocaleString() : '0';
  }
  function clearTextMessage() { $('text-message').textContent = ''; $('text-message').classList.remove('error'); }
  $('text-input').addEventListener('input', () => { updateStats(); clearTextMessage(); });
  document.querySelectorAll('[data-text-mode]').forEach(button => button.addEventListener('click', () => {
    textMode = button.dataset.textMode;
    document.querySelectorAll('[data-text-mode]').forEach(tab => { const active = tab === button; tab.classList.toggle('selected', active); tab.setAttribute('aria-pressed', String(active)); });
    $('text-stats').hidden = textMode !== 'count'; $('json-actions').hidden = textMode !== 'json';
    $('text-input').placeholder = textMode === 'json' ? '粘贴 JSON，例如 {"hello": "world"}' : '粘贴或输入文字，看看灵感有多长…';
    $('text-input').style.fontFamily = textMode === 'json' ? 'Consolas, monospace' : ''; clearTextMessage();
  }));
  $('clear-text').addEventListener('click', () => { $('text-input').value = ''; clearTextMessage(); updateStats(); $('text-input').focus(); });
  $('format-json').addEventListener('click', () => {
    clearTextMessage();
    if (!$('text-input').value.trim()) { $('text-message').textContent = '先粘贴一段 JSON 吧。'; $('text-input').focus(); return; }
    try { const value = JSON.parse($('text-input').value); $('text-input').value = JSON.stringify(value, null, 2); updateStats(); $('text-message').textContent = '已格式化 · 2 空格缩进'; }
    catch { $('text-message').textContent = 'JSON 格式不正确，请检查双引号、逗号和括号。原始内容已保留。'; $('text-message').classList.add('error'); }
  });
  $('copy-text').addEventListener('click', async () => {
    if (!$('text-input').value) { $('text-message').textContent = '还没有可复制的内容。'; return; }
    try { await navigator.clipboard.writeText($('text-input').value); clearTextMessage(); $('text-message').textContent = '已复制到剪贴板'; }
    catch { $('text-input').focus(); $('text-input').select(); $('text-message').textContent = '内容已选中，请按 Ctrl+C（Mac 用 ⌘C）复制。'; }
  });
})();
