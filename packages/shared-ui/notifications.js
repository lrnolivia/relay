import { workspaceLink, CTRL_ORIGIN } from './workspace-links.js';
import { glyph } from './glyphs.js';

const storageKey = 'relay.notifications.v1';
const features = new Set(['relay', 'today', 'runner', 'inspector', 'night-shift']);
const labels = { relay: 'Relay', today: 'Today', runner: 'Runner', inspector: 'Inspector', 'night-shift': 'Night Shift' };
let entries = null;
const listeners = new Set();
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function read() {
  if (entries) return entries;
  try { entries = JSON.parse(sessionStorage.getItem(storageKey) || '[]'); } catch { entries = []; }
  if (!Array.isArray(entries)) entries = [];
  // Session history is bounded; active important problems are retained first.
  entries = entries.filter(item => item && typeof item.id === 'string' && typeof item.message === 'string').filter((item,index) => index < 50 || (!item.resolved && item.severity !== 'info'));
  return entries;
}
function emit() {
  try { sessionStorage.setItem(storageKey, JSON.stringify(read())); } catch { /* In-memory delivery still works. */ }
  for (const listener of listeners) listener();
}
export function notificationSnapshot() { return read().map(item => ({...item})); }
export function publishNotification(input) {
  const list = read();
  const feature = features.has(input.feature) ? input.feature : 'relay';
  const existing = list.find(item => item.id === input.id);
  const message = String(input.message || '').slice(0, 1000);
  if (!message) return;
  if (existing && existing.message === message && !existing.resolved) return;
  const item = { id: String(input.id || feature + ':' + message), feature, project: String(input.project || ''),
    title: String(input.title || labels[feature]).slice(0, 120), message,
    severity: ['info','warning','error'].includes(input.severity) ? input.severity : 'info',
    href: workspaceLink(String(input.href || '')), action: String(input.action || 'Open context'),
    createdAt: Date.now(), resolved: false, toastUntil: Date.now() + (input.severity === 'error' ? 10000 : 7000), dismissed: false };
  entries = [item, ...list.filter(entry => entry.id !== item.id)].sort((a,b) => Number(b.severity !== 'info' && !b.resolved) - Number(a.severity !== 'info' && !a.resolved)).filter((item,index) => index < 50 || (!item.resolved && item.severity !== 'info'));
  emit();
}
export function resolveNotification(id) {
  const item = read().find(entry => entry.id === id);
  if (!item || item.resolved) return;
  item.resolved = true; item.toastUntil = 0; emit();
}
export function dismissNotification(id) {
  const item = read().find(entry => entry.id === id);
  if (!item) return;
  item.dismissed = true; item.toastUntil = 0; emit();
}
function safeHref(href) {
  try { const url = new URL(href, location.origin); return href && url.origin === CTRL_ORIGIN ? url.href : url.origin === location.origin ? url.pathname + url.search + url.hash : ''; } catch { return ''; }
}
function messageMarkup(item, toast = false) {
  const href = safeHref(item.href);
  const severity = item.resolved ? 'Recovered' : item.severity === 'error' ? 'Problem' : item.severity === 'warning' ? 'Needs attention' : 'Update';
  const feature = features.has(item.feature) ? item.feature : 'relay';
  return '<article class="notification-message" data-feature="' + feature + '" data-severity="' + escape(item.severity) + '">' +
    '<div class="notification-source"><span class="notification-source-icon" aria-hidden="true">' + glyph(feature === 'relay' ? 'projects' : feature === 'night-shift' ? 'moon' : feature === 'runner' ? 'play' : feature === 'inspector' ? 'review' : feature) + '</span><span>' + escape(labels[feature]) + (item.project ? ' · ' + escape(item.project) : '') + '</span><small>' + severity + '</small></div>' +
    '<strong>' + escape(item.title) + '</strong><p>' + escape(item.message) + '</p>' +
    '<div class="notification-actions">' + (href ? '<a href="' + escape(href) + '">' + escape(item.action) + '</a>' : '') +
    (toast ? '<button type="button" data-dismiss-notification="' + escape(item.id) + '" aria-label="Dismiss notification">' + glyph('close') + '</button>' : '<small>' + (item.resolved ? 'Recovered' : item.dismissed ? 'Toast dismissed · ' : '') + new Date(item.createdAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}) + '</small>') + '</div></article>';
}

export function bindNotifications(root) {
  let open = false, timer = null, pausedAt = 0;
  const stack = document.createElement('section');
  stack.className = 'notification-toasts'; stack.setAttribute('aria-label', 'Recent notifications');
  const live = document.createElement('span'); live.className = 'notification-announcement'; live.setAttribute('role','status'); live.setAttribute('aria-live','polite');
  document.body.append(stack, live);
  root.classList.add('notification-center');
  root.innerHTML = '<button type="button" class="notification-bell" aria-label="Notifications" aria-expanded="false">' + glyph('bell') + '<span data-notification-count hidden></span></button><section class="notification-menu" aria-label="Notifications" hidden><div class="notification-menu-head"><strong>Notifications</strong><button type="button" data-close-notifications aria-label="Close notifications">' + glyph('close') + '</button></div><p class="notification-hint">Toast dismissal keeps the problem here. Nothing is marked resolved.</p><div data-notification-list></div></section>';
  const bell = root.querySelector('.notification-bell'), menu = root.querySelector('.notification-menu');
  let lastAnnouncement = '';
  function render() {
    const focusedLink = root.contains(document.activeElement) && document.activeElement?.closest('a')?.getAttribute('href');
    const list = read(), active = list.filter(item => !item.resolved && item.severity !== 'info');
    const count = root.querySelector('[data-notification-count]'); count.textContent = String(active.length); count.hidden = !active.length;
    bell.setAttribute('aria-label','Notifications' + (active.length ? ', ' + active.length + ' need attention' : ''));
    root.querySelector('[data-notification-list]').innerHTML = list.length ? list.map(item => messageMarkup(item)).join('') : '<p class="notification-empty">No notifications in this tab yet.</p>';
    if (focusedLink) Array.from(root.querySelectorAll('a')).find(link=>link.getAttribute('href')===focusedLink)?.focus();
    const toasts = list.filter(item => !item.dismissed && !item.resolved && item.toastUntil > (pausedAt || Date.now())).slice(0,2);
    if (!pausedAt) stack.innerHTML = toasts.map(item => messageMarkup(item,true)).join('');
    stack.hidden = !toasts.length || open;
    const announcement = toasts.map(item => item.title + '. ' + item.message).join(' ');
    if (announcement && announcement !== lastAnnouncement) live.textContent = announcement;
    lastAnnouncement = announcement;
    clearTimeout(timer);
    if (toasts.length && !pausedAt) timer = setTimeout(render, Math.max(10, Math.min(...toasts.map(item => item.toastUntil)) - Date.now() + 10));
  }
  function pause() { if (!pausedAt) pausedAt = Date.now(); clearTimeout(timer); }
  function resume() {
    if (stack.matches(':hover') || stack.contains(document.activeElement)) return;
    if (pausedAt) { const elapsed=Date.now()-pausedAt; for(const item of read()) if(item.toastUntil>=pausedAt)item.toastUntil+=elapsed; pausedAt=0; }
    render();
  }
  function toggle(value) {
    open = value; menu.hidden = !open; bell.setAttribute('aria-expanded',String(open)); render();
    if (open) menu.querySelector('button').focus(); else bell.focus();
  }
  function click(event) {
    const dismiss = event.target.closest('[data-dismiss-notification]');
    if (dismiss) { pausedAt=0; dismissNotification(dismiss.dataset.dismissNotification); }
    if (event.target.closest('.notification-bell')) toggle(!open);
    if (event.target.closest('[data-close-notifications]')) toggle(false);
  }
  function key(event) { if (open && event.key === 'Escape') { event.preventDefault(); toggle(false); } }
  function outside(event) { if (open && !root.contains(event.target)) { open=false; menu.hidden=true; bell.setAttribute('aria-expanded','false'); render(); } }
  root.addEventListener('click',click); stack.addEventListener('click',click); document.addEventListener('keydown',key); document.addEventListener('pointerdown',outside);
  stack.addEventListener('pointerenter',pause); stack.addEventListener('pointerleave',resume);
  stack.addEventListener('focusin',pause); stack.addEventListener('focusout',()=>queueMicrotask(resume));
  listeners.add(render); render();
  return () => { clearTimeout(timer); listeners.delete(render); root.removeEventListener('click',click); document.removeEventListener('keydown',key); document.removeEventListener('pointerdown',outside); stack.remove(); live.remove(); };
}
