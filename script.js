//const BACKEND_URL = 'http://localhost:4000';

const video = document.getElementById("video");
const startBtn = document.getElementById('start-att-btn');
const stopBtn = document.getElementById('stop-att-btn');
const statusEl = document.getElementById('status');

let labeledFaceDescriptors = null;
let faceMatcher = null;
let canvas = null;
let displaySize = null;
let detectionInterval = null;
let handleResize = null;
let attendanceRecords = [];
let loggedNames = new Set();
const attListEl = document.getElementById('att-list');
const attCountEl = document.getElementById('att-count');
const exportBtn = document.getElementById('export-att-btn');
const saveSessionBtn = document.getElementById('save-session-btn');
const sessionNameInput = document.getElementById('session-name');
const manualNameInput = document.getElementById('manual-name-input');
const manualAddBtn = document.getElementById('manual-add-btn');
const clearSessionBtn = document.getElementById('clear-session-btn');
const currentDateEl = document.getElementById('current-date');
let modelsLoaded = false;
// Admin modal elements
const adminModal = document.getElementById('admin-modal');
const adminModalClose = document.getElementById('admin-modal-close');
const adminModalBackdrop = document.getElementById('admin-modal-backdrop');
const tabLoginBtn = document.getElementById('tab-login');
const tabSignupBtn = document.getElementById('tab-signup');
const modalLoginEmail = document.getElementById('modal-login-email');
const modalLoginPassword = document.getElementById('modal-login-password');
const modalLoginBtn = document.getElementById('modal-login-btn');
const modalLoginRemember = document.getElementById('modal-login-remember');
const modalSignupName = document.getElementById('modal-signup-name');
const modalSignupLocation = document.getElementById('modal-signup-location');
const modalSignupAvatar = document.getElementById('modal-signup-avatar');
const modalSignupEmail = document.getElementById('modal-signup-email');
const modalSignupPassword = document.getElementById('modal-signup-password');
const modalSignupPasswordConfirm = document.getElementById('modal-signup-password-confirm');
const modalSignupBtn = document.getElementById('modal-signup-btn');
const modalAuthStatus = document.getElementById('modal-auth-status');
const modalOpenDashboardBtn = document.getElementById('modal-open-dashboard');
const modalLogoutBtn = document.getElementById('modal-logout-btn');
// Dashboard modal elements
const dashboardModal = document.getElementById('admin-dashboard-modal');
const dashboardModalClose = document.getElementById('admin-dashboard-close');
const dashboardBackdrop = document.getElementById('admin-dashboard-backdrop');
const dashNewName = document.getElementById('dash-new-name');
const dashNewAvatar = document.getElementById('dash-new-avatar');
const dashAddBtn = document.getElementById('dash-add-btn');
const dashboardRosterList = document.getElementById('dashboard-roster-list');
// Admin drawer elements
const adminToggleBtn = document.getElementById('open-admin-panel');
const adminDrawer = document.getElementById('admin-drawer');
const adminDrawerClose = document.getElementById('admin-drawer-close');
const adminDrawerBackdrop = document.getElementById('admin-drawer-backdrop');
const rosterListEl = document.getElementById('roster-list');
const rosterRefreshBtn = document.getElementById('roster-refresh-btn');
const rosterExportBtn = document.getElementById('roster-export-btn');
const drawerAdminStatus = document.getElementById('drawer-admin-status');
const adminNameInput = document.getElementById('admin-name');
const adminLocationInput = document.getElementById('admin-location');
const adminAvatarInput = document.getElementById('admin-avatar');
const adminEmailInput = document.getElementById('admin-email');
const adminPasswordInput = document.getElementById('admin-password');
const adminSignupBtn = document.getElementById('admin-signup-btn');
const adminLoginBtn = document.getElementById('admin-login-btn');
const adminLogoutBtn = document.getElementById('admin-logout-btn');
const newCaretakerNameInput = document.getElementById('new-caretaker-name');
const newCaretakerAvatarInput = document.getElementById('new-caretaker-avatar');
const addCaretakerBtn = document.getElementById('add-caretaker-btn');

// persistence helpers
function storageKeyForToday() {
  const d = new Date();
  return 'attendance_' + d.toISOString().slice(0,10); // attendance_YYYY-MM-DD
}

function saveAttendanceToStorage() {
  try {
    const key = storageKeyForToday();
    localStorage.setItem(key, JSON.stringify({ session: sessionNameInput ? sessionNameInput.value : '', records: attendanceRecords || [] }));
  } catch (e) { console.warn('save attendance failed', e); }
}

function loadAttendanceFromStorage() {
  try {
    const key = storageKeyForToday();
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved && Array.isArray(saved.records)) {
      saved.records.forEach(r => {
        if (!loggedNames.has(r.name)) {
          loggedNames.add(r.name);
          attendanceRecords.push(r);
          if (attListEl) {
            const li = document.createElement('li');
            li.textContent = r.name;
            const timeSpan = document.createElement('span');
            timeSpan.style.opacity = '0.8';
            timeSpan.style.fontSize = '0.85em';
            timeSpan.textContent = new Date(r.time).toLocaleTimeString();
            li.appendChild(timeSpan);
            attListEl.appendChild(li);
          }
        }
      });
      if (attCountEl) attCountEl.textContent = String(loggedNames.size);
      if (exportBtn) exportBtn.disabled = attendanceRecords.length === 0;
      if (sessionNameInput && saved.session) sessionNameInput.value = saved.session;
    }
  } catch (e) { console.warn('load attendance failed', e); }
}

function scheduleMidnightReset() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate()+1, 0,0,5);
  const ms = next - now;
  setTimeout(() => {
    // clear in-memory UI and storage key for new day
    loggedNames.clear();
    attendanceRecords = [];
    if (attListEl) attListEl.innerHTML = '';
    if (attCountEl) attCountEl.textContent = '0';
    if (exportBtn) exportBtn.disabled = true;
    // schedule next reset
    scheduleMidnightReset();
  }, ms);
}

function updateCurrentDate() {
  if (!currentDateEl) return;
  const now = new Date();
  currentDateEl.textContent = now.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

// Admin helpers
function getAuthToken() {
  // Prefer session storage (current session) over persistent localStorage.
  // This avoids a remembered token in localStorage from accidentally
  // overriding a freshly-logged-in session token stored in sessionStorage.
  const s = sessionStorage.getItem('auth_token');
  if (s) return s;
  return localStorage.getItem('auth_token');
}

function updateAdminUIStatus() {
  const token = getAuthToken();
  if (drawerAdminStatus) {
    if (token) {
      drawerAdminStatus.textContent = 'Logged in';
    } else {
      drawerAdminStatus.textContent = 'Not logged in';
    }
  }
  // also update embedded admin-status if present
  const as = document.getElementById('admin-status');
  if (as) as.textContent = token ? 'Logged in' : 'Not logged in';
  // toggle auth buttons
  if (adminSignupBtn) adminSignupBtn.style.display = token ? 'none' : 'inline-block';
  if (adminLoginBtn) adminLoginBtn.style.display = token ? 'none' : 'inline-block';
  if (adminLogoutBtn) adminLogoutBtn.style.display = token ? 'inline-block' : 'none';
  if (modalLogoutBtn) modalLogoutBtn.style.display = token ? 'inline-block' : 'none';
  if (modalOpenDashboardBtn) modalOpenDashboardBtn.style.display = token ? 'inline-block' : 'none';
  // enable/disable start/manual-add based on auth + models
  updateStartControls();
}

function isAdminLoggedIn() {
  return !!getAuthToken();
}

function updateStartControls() {
  const allow = modelsLoaded && isAdminLoggedIn();
  if (startBtn) startBtn.disabled = !allow;
  if (manualAddBtn) manualAddBtn.disabled = !isAdminLoggedIn();
}

async function fetchAndRenderRoster() {
  if (!rosterListEl) return;
  rosterListEl.innerHTML = '<li style="opacity:0.7;color:var(--muted)">Loading…</li>';
  try {
    const token = getAuthToken();
    if (!token) {
      rosterListEl.innerHTML = '<li style="color:var(--muted)">Login required to view roster</li>';
      return;
    }
    const res = await fetch((BACKEND_URL || '') + '/api/labels', { headers: { 'Authorization': 'Bearer ' + token } });
    if (!res.ok) {
      if (res.status === 401) rosterListEl.innerHTML = '<li style="color:var(--muted)">Login required to view roster</li>';
      else rosterListEl.innerHTML = '<li style="color:var(--muted)">Failed to load roster</li>';
      return;
    }
    const j = await res.json();
    const items = (j.items || []);
    if (!items.length) {
      rosterListEl.innerHTML = '<li style="color:var(--muted)">No caretakers yet</li>';
      // also clear dashboard list
      if (dashboardRosterList) dashboardRosterList.innerHTML = '';
      return;
    }
    rosterListEl.innerHTML = '';
    items.forEach(it => {
      const li = document.createElement('li');
      li.className = 'roster-item';
      const img = document.createElement('img');
      img.src = it.avatarUrl || 'assets/logo.svg';
      img.alt = it.name || '';
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.innerHTML = `<div style="font-weight:600;color:#e6eef8">${it.name}</div><div style="font-size:0.85rem;color:var(--muted)">id: ${it._id}</div>`;
      li.appendChild(img);
        li.appendChild(meta);
        // add delete button when admin is logged in
        const delBtn = document.createElement('button');
        delBtn.className = 'btn';
        delBtn.textContent = 'Delete';
        delBtn.style.marginLeft = '12px';
        delBtn.addEventListener('click', async () => {
          if (!confirm('Delete ' + it.name + '?')) return;
          try {
            const token = getAuthToken();
            if (!token) { if (drawerAdminStatus) drawerAdminStatus.textContent = 'Login required'; return; }
            const res = await fetch((BACKEND_URL || '') + '/api/labels/' + it._id, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } });
            const j = await res.json();
            if (!res.ok) { if (drawerAdminStatus) drawerAdminStatus.textContent = 'Delete failed: ' + (j.error || res.statusText); return; }
            fetchAndRenderRoster();
          } catch (e) {
            if (drawerAdminStatus) drawerAdminStatus.textContent = 'Delete failed';
          }
        });
        li.appendChild(delBtn);
      rosterListEl.appendChild(li);
    });
    // also render into dashboard roster list if present
    if (dashboardRosterList) {
      dashboardRosterList.innerHTML = '';
      items.forEach(it => {
        const li = document.createElement('li');
        li.className = 'roster-item';
        const img = document.createElement('img');
        img.src = it.avatarUrl || 'assets/logo.svg';
        img.alt = it.name || '';
        const meta = document.createElement('div');
        meta.className = 'meta';
        const nameLine = document.createElement('div');
        nameLine.style.fontWeight = '600'; nameLine.style.color = '#e6eef8';
        nameLine.textContent = it.name;
        const idLine = document.createElement('div'); idLine.style.fontSize = '0.85rem'; idLine.style.color = 'var(--muted)'; idLine.textContent = 'id: ' + it._id;
        meta.appendChild(nameLine); meta.appendChild(idLine);
        li.appendChild(img); li.appendChild(meta);
        // delete button (create first so edit handler can reference it)
        const delBtn = document.createElement('button'); delBtn.className = 'btn'; delBtn.textContent = 'Delete'; delBtn.style.marginLeft = '8px';
        delBtn.addEventListener('click', async () => {
          if (!confirm('Delete ' + it.name + '?')) return;
          try {
            const token = getAuthToken();
            if (!token) { if (modalAuthStatus) modalAuthStatus.textContent = 'Login required'; return; }
            const res = await fetch((BACKEND_URL || '') + '/api/labels/' + it._id, { method: 'DELETE', headers: { 'Authorization': 'Bearer ' + token } });
            const j = await res.json();
            if (!res.ok) { if (modalAuthStatus) modalAuthStatus.textContent = 'Delete failed: ' + (j.error || res.statusText); return; }
            fetchAndRenderRoster();
          } catch (e) { if (modalAuthStatus) modalAuthStatus.textContent = 'Delete failed'; }
        });
        // edit button
        const editBtn = document.createElement('button'); editBtn.className = 'btn'; editBtn.textContent = 'Edit'; editBtn.style.marginLeft = '12px';
        editBtn.addEventListener('click', () => {
          // transform meta into editable fields
          const nameInput = document.createElement('input'); nameInput.className = 'session-input'; nameInput.value = it.name;
          const avatarInput = document.createElement('input'); avatarInput.className = 'session-input'; avatarInput.value = it.avatarUrl || '';
          const saveBtn = document.createElement('button'); saveBtn.className = 'btn btn-primary'; saveBtn.textContent = 'Save';
          const cancelBtn = document.createElement('button'); cancelBtn.className = 'btn'; cancelBtn.textContent = 'Cancel';
          // clear meta and append inputs
          meta.innerHTML = '';
          meta.appendChild(nameInput); meta.appendChild(avatarInput);
          // replace action buttons
          editBtn.style.display = 'none'; delBtn.style.display = 'none';
          li.appendChild(saveBtn); li.appendChild(cancelBtn);
          saveBtn.addEventListener('click', async () => {
            try {
              const token = getAuthToken();
              if (!token) { if (modalAuthStatus) modalAuthStatus.textContent = 'Login required'; return; }
              const res = await fetch((BACKEND_URL || '') + '/api/labels/' + it._id, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify({ name: nameInput.value.trim(), avatarUrl: avatarInput.value.trim() }) });
              const j = await res.json();
              if (!res.ok) { if (modalAuthStatus) modalAuthStatus.textContent = 'Update failed: ' + (j.error || res.statusText); return; }
              fetchAndRenderRoster();
            } catch (e) { if (modalAuthStatus) modalAuthStatus.textContent = 'Update failed'; }
          });
          cancelBtn.addEventListener('click', () => { fetchAndRenderRoster(); });
        });
        li.appendChild(editBtn); li.appendChild(delBtn);
        dashboardRosterList.appendChild(li);
      });
    }
  } catch (e) {
    console.error(e);
    rosterListEl.innerHTML = '<li style="color:var(--muted)">Failed to load roster</li>';
  }
}

// Admin auth functions
async function signupAdmin() {
  try {
    const name = adminNameInput && adminNameInput.value && adminNameInput.value.trim();
    const location = adminLocationInput && adminLocationInput.value && adminLocationInput.value.trim();
    const avatarUrl = adminAvatarInput && adminAvatarInput.value && adminAvatarInput.value.trim();
    const email = adminEmailInput && adminEmailInput.value && adminEmailInput.value.trim();
    const password = adminPasswordInput && adminPasswordInput.value;
    if (!name || !email || !password) {
      if (drawerAdminStatus) drawerAdminStatus.textContent = 'Provide name, email and password';
      return;
    }
    const res = await fetch((BACKEND_URL || '') + '/api/auth/signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, password, location, avatarUrl })
    });
    const j = await res.json();
    if (!res.ok) {
      if (drawerAdminStatus) drawerAdminStatus.textContent = 'Signup failed: ' + (j.error || res.statusText);
      return;
    }
    // store token
    localStorage.setItem('auth_token', j.token);
    if (drawerAdminStatus) drawerAdminStatus.textContent = 'Signed up and logged in as ' + (j.user && j.user.name ? j.user.name : 'admin');
    updateAdminUIStatus();
    // reflect modal state if visible
    try { showSignedInInModal(j.user); } catch (e) {}
    // clear password
    if (adminPasswordInput) adminPasswordInput.value = '';
  } catch (e) {
    if (drawerAdminStatus) drawerAdminStatus.textContent = 'Signup error';
  }
}

async function loginAdmin() {
  try {
    const email = adminEmailInput && adminEmailInput.value && adminEmailInput.value.trim();
    const password = adminPasswordInput && adminPasswordInput.value;
    if (!email || !password) {
      if (drawerAdminStatus) drawerAdminStatus.textContent = 'Provide email and password';
      return;
    }
    const res = await fetch((BACKEND_URL || '') + '/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password })
    });
    const j = await res.json();
    if (!res.ok) {
      if (drawerAdminStatus) drawerAdminStatus.textContent = 'Login failed: ' + (j.error || res.statusText);
      return;
    }
    localStorage.setItem('auth_token', j.token);
    if (drawerAdminStatus) drawerAdminStatus.textContent = 'Logged in as ' + (j.user && j.user.name ? j.user.name : 'admin');
    if (adminPasswordInput) adminPasswordInput.value = '';
    updateAdminUIStatus();
    try { showSignedInInModal(j.user); } catch (e) {}
  } catch (e) {
    if (drawerAdminStatus) drawerAdminStatus.textContent = 'Login error';
  }
}

function logoutAdmin() {
  localStorage.removeItem('auth_token');
  sessionStorage.removeItem('auth_token');
  updateAdminUIStatus();
  if (drawerAdminStatus) drawerAdminStatus.textContent = 'Logged out';
  // reflect signed-out state in modal
  showSignedOutInModal();
}

async function addCaretaker() {
  try {
    const token = getAuthToken();
    if (!token) {
      if (drawerAdminStatus) drawerAdminStatus.textContent = 'Login required to add caretaker';
      return;
    }
    const name = newCaretakerNameInput && newCaretakerNameInput.value && newCaretakerNameInput.value.trim();
    const avatarUrl = newCaretakerAvatarInput && newCaretakerAvatarInput.value && newCaretakerAvatarInput.value.trim();
    if (!name) {
      if (drawerAdminStatus) drawerAdminStatus.textContent = 'Enter caretaker name';
      return;
    }
    const res = await fetch((BACKEND_URL || '') + '/api/labels', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify({ name, avatarUrl })
    });
    const j = await res.json();
    if (!res.ok) {
      if (drawerAdminStatus) drawerAdminStatus.textContent = 'Add failed: ' + (j.error || res.statusText);
      return;
    }
    if (drawerAdminStatus) drawerAdminStatus.textContent = 'Caretaker added';
    if (newCaretakerNameInput) newCaretakerNameInput.value = '';
    if (newCaretakerAvatarInput) newCaretakerAvatarInput.value = '';
    fetchAndRenderRoster();
  } catch (e) {
    if (drawerAdminStatus) drawerAdminStatus.textContent = 'Add caretaker error';
  }
}

// wire admin button listeners
if (adminSignupBtn) adminSignupBtn.addEventListener('click', signupAdmin);
if (adminLoginBtn) adminLoginBtn.addEventListener('click', loginAdmin);
if (adminLogoutBtn) adminLogoutBtn.addEventListener('click', () => { logoutAdmin(); });
if (addCaretakerBtn) addCaretakerBtn.addEventListener('click', addCaretaker);

function openAdminDrawer() {
  if (!adminDrawer) return;
  adminDrawer.classList.add('open');
  if (adminDrawerBackdrop) { adminDrawerBackdrop.hidden = false; }
  adminDrawer.setAttribute('aria-hidden', 'false');
  fetchAndRenderRoster();
  updateAdminUIStatus();
}

function closeAdminDrawer() {
  if (!adminDrawer) return;
  adminDrawer.classList.remove('open');
  if (adminDrawerBackdrop) { adminDrawerBackdrop.hidden = true; }
  adminDrawer.setAttribute('aria-hidden', 'true');
}

// admin button now opens the auth modal first (professional auth UI)
function openAuthModal() {
  if (!adminModal) { openAdminDrawer(); return; }
  // show modal as a popup on the current page (do not hide the main app)
  adminModal.setAttribute('aria-hidden', 'false');
  adminModal.style.display = 'flex';
  if (adminModalBackdrop) adminModalBackdrop.hidden = false;
  if (modalAuthStatus) modalAuthStatus.textContent = isAdminLoggedIn() ? 'Signed in' : 'Not signed in';
  // show "Open dashboard" button only when logged in
  if (modalOpenDashboardBtn) modalOpenDashboardBtn.style.display = isAdminLoggedIn() ? 'inline-block' : 'none';
  // allow closing modal regardless of auth state (it's a popup)
  if (adminModalClose) adminModalClose.style.display = 'inline-block';
}

function closeAuthModal() {
  if (!adminModal) return;
  adminModal.setAttribute('aria-hidden', 'true');
  adminModal.style.display = 'none';
  if (adminModalBackdrop) adminModalBackdrop.hidden = true;
}

if (adminToggleBtn) adminToggleBtn.addEventListener('click', openAuthModal);
if (adminDrawerClose) adminDrawerClose.addEventListener('click', closeAdminDrawer);
if (adminDrawerBackdrop) adminDrawerBackdrop.addEventListener('click', closeAdminDrawer);
if (rosterRefreshBtn) rosterRefreshBtn.addEventListener('click', fetchAndRenderRoster);
if (rosterExportBtn) rosterExportBtn.addEventListener('click', async () => {
  try {
    const token = getAuthToken();
    if (!token) { if (drawerAdminStatus) drawerAdminStatus.textContent = 'Login required to export roster'; return; }
    const res = await fetch((BACKEND_URL || '') + '/api/labels', { headers: { 'Authorization': 'Bearer ' + token } });
    if (!res.ok) { if (drawerAdminStatus) drawerAdminStatus.textContent = 'Export failed'; return; }
    const j = await res.json();
    const rows = [['name','id','avatarUrl']].concat((j.items||[]).map(x=>[x.name,x._id,x.avatarUrl||'']));
    const csv = rows.map(r => r.map(c => '"'+String(c).replace(/"/g,'""')+'"').join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'roster.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  } catch(e) {}
});

// ensure admin status initialized
updateAdminUIStatus();
// if a token exists (session or local), try to fetch the user profile so header can show on page load
async function loadAdminFromToken() {
  try {
    const token = getAuthToken();
    if (!token) return;
    const res = await fetch((BACKEND_URL || '') + '/api/auth/me', { headers: { 'Authorization': 'Bearer ' + token } });
    if (!res.ok) {
      // invalid token — clear stored tokens and update UI
      if (res.status === 401) {
        try { localStorage.removeItem('auth_token'); sessionStorage.removeItem('auth_token'); } catch (e) {}
        updateAdminUIStatus();
        showSignedOutInModal();
      }
      return;
    }
    const j = await res.json();
    if (j && j.user) {
      try { showSignedInInModal(j.user); } catch (e) {}
      updateAdminUIStatus();
      updateStartControls();
    }
  } catch (e) {
    console.warn('Failed to load admin from token', e);
  }
}
loadAdminFromToken();

// Removed redirect-to-auth page to keep landing page as first view.
// Previously the app redirected unauthenticated users to `auth.html`.
// Now the landing page (`index.html`) remains the entry point and admin
// controls (drawer/modal) are available via the Admin button.

// modal tab switching and controls
if (adminModalClose) adminModalClose.addEventListener('click', closeAuthModal);
if (adminModalBackdrop) adminModalBackdrop.addEventListener('click', closeAuthModal);
if (tabLoginBtn) tabLoginBtn.addEventListener('click', () => { document.getElementById('auth-login-form').hidden = false; document.getElementById('auth-signup-form').hidden = true; tabLoginBtn.classList.add('active'); tabSignupBtn.classList.remove('active'); });
if (tabSignupBtn) tabSignupBtn.addEventListener('click', () => { document.getElementById('auth-login-form').hidden = true; document.getElementById('auth-signup-form').hidden = false; tabSignupBtn.classList.add('active'); tabLoginBtn.classList.remove('active'); });

// landing choice buttons (prominent flow chooser)
const choiceLoginBtn = document.getElementById('choice-login');
const choiceSignupBtn = document.getElementById('choice-signup');
if (choiceLoginBtn) choiceLoginBtn.addEventListener('click', () => { tabLoginBtn && tabLoginBtn.click(); document.getElementById('auth-choices').style.display = 'none'; });
if (choiceSignupBtn) choiceSignupBtn.addEventListener('click', () => { tabSignupBtn && tabSignupBtn.click(); document.getElementById('auth-choices').style.display = 'none'; });

// wire modal auth buttons (these perform login/signup using modal inputs)
function showSignedInInModal(user) {
  try {
    // hide forms
    const loginForm = document.getElementById('auth-login-form');
    const signupForm = document.getElementById('auth-signup-form');
    if (loginForm) loginForm.hidden = true;
    if (signupForm) signupForm.hidden = true;
    if (tabLoginBtn) tabLoginBtn.classList.remove('active');
    if (tabSignupBtn) tabSignupBtn.classList.remove('active');
    // show brief info
    if (modalAuthStatus) modalAuthStatus.textContent = (user && user.name ? user.name : 'Admin') + (user && user.location ? ' — ' + user.location : '');
    if (modalOpenDashboardBtn) modalOpenDashboardBtn.style.display = 'inline-block';
    if (modalLogoutBtn) modalLogoutBtn.style.display = 'inline-block';
    // update header to show admin name and location
    try {
      const headerAdminEl = document.getElementById('header-admin');
      const facilityEl = document.querySelector('.facility');
      const name = user && user.name ? user.name : '';
      const loc = user && user.location ? user.location : '';
      if (headerAdminEl) {
        const avatarEl = document.getElementById('header-admin-avatar');
        const textEl = document.getElementById('header-admin-text');
        // compute display name fallback
        const displayName = name || (user && user.email) || 'Admin';
        const textContent = displayName + (loc ? ' — ' + loc : '');
        if (textEl) textEl.textContent = textContent;
        if (avatarEl) {
          // prefer image avatar when provided
          if (user && user.avatarUrl) {
            avatarEl.style.backgroundImage = `url('${user.avatarUrl}')`;
            avatarEl.style.backgroundSize = 'cover';
            avatarEl.style.backgroundPosition = 'center';
            avatarEl.textContent = '';
          } else {
            avatarEl.style.backgroundImage = '';
            const initials = (displayName.split(' ').map(s=>s.trim()).filter(Boolean).map(s=>s[0].toUpperCase()).slice(0,2).join('')) || 'A';
            avatarEl.textContent = initials;
          }
        }
      }
      if (facilityEl) facilityEl.textContent = loc || 'Matki Chauraha, BJS — Jodhpur';
    } catch (e) { /* non-fatal */ }
  } catch (e) { /* non-fatal */ }
}

function showSignedOutInModal() {
  try {
    const loginForm = document.getElementById('auth-login-form');
    const signupForm = document.getElementById('auth-signup-form');
    if (loginForm) loginForm.hidden = false;
    if (signupForm) signupForm.hidden = true;
    if (tabLoginBtn) tabLoginBtn.classList.add('active');
    if (tabSignupBtn) tabSignupBtn.classList.remove('active');
    if (modalAuthStatus) modalAuthStatus.textContent = 'Not signed in';
    if (modalOpenDashboardBtn) modalOpenDashboardBtn.style.display = 'none';
    if (modalLogoutBtn) modalLogoutBtn.style.display = 'none';
    // reset header and facility to default when signed out
    try {
      const headerAdminEl = document.getElementById('header-admin');
      const facilityEl = document.querySelector('.facility');
      if (headerAdminEl) {
        const avatarEl = document.getElementById('header-admin-avatar');
        const textEl = document.getElementById('header-admin-text');
        if (textEl) textEl.textContent = '';
        if (avatarEl) {
          avatarEl.textContent = '';
          avatarEl.style.backgroundImage = '';
        }
      }
      if (facilityEl) facilityEl.textContent = 'Matki Chauraha, BJS — Jodhpur';
    } catch (e) { /* non-fatal */ }
  } catch (e) {}
}

if (modalLoginBtn) modalLoginBtn.addEventListener('click', async () => {
  const email = modalLoginEmail && modalLoginEmail.value && modalLoginEmail.value.trim();
  const password = modalLoginPassword && modalLoginPassword.value;
  if (!email || !password) { if (modalAuthStatus) modalAuthStatus.textContent = 'Enter email & password'; return; }
  try {
    const res = await fetch((BACKEND_URL || '') + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const j = await res.json();
    if (!res.ok) { if (modalAuthStatus) modalAuthStatus.textContent = 'Login failed: ' + (j.error || res.statusText); return; }
    // store token persistently only if user asked to be remembered
    try {
      if (modalLoginRemember && modalLoginRemember.checked) {
        localStorage.setItem('auth_token', j.token);
      } else {
        sessionStorage.setItem('auth_token', j.token);
      }
    } catch (e) { localStorage.setItem('auth_token', j.token); }
    if (modalAuthStatus) modalAuthStatus.textContent = 'Logged in as ' + (j.user && j.user.name ? j.user.name : 'admin');
    showSignedInInModal(j.user);
    updateAdminUIStatus();
    updateStartControls();
    // show open-dashboard button
    if (modalOpenDashboardBtn) modalOpenDashboardBtn.style.display = 'inline-block';
    // optionally close modal automatically
    setTimeout(() => closeAuthModal(), 700);
  } catch (e) { if (modalAuthStatus) modalAuthStatus.textContent = 'Login error'; }
});

if (modalSignupBtn) modalSignupBtn.addEventListener('click', async () => {
  const name = modalSignupName && modalSignupName.value && modalSignupName.value.trim();
  const location = modalSignupLocation && modalSignupLocation.value && modalSignupLocation.value.trim();
  const avatarUrl = modalSignupAvatar && modalSignupAvatar.value && modalSignupAvatar.value.trim();
  const email = modalSignupEmail && modalSignupEmail.value && modalSignupEmail.value.trim();
  const password = modalSignupPassword && modalSignupPassword.value;
  const passwordConfirm = modalSignupPasswordConfirm && modalSignupPasswordConfirm.value;
  if (!name || !email || !password) { if (modalAuthStatus) modalAuthStatus.textContent = 'Provide name,email,password'; return; }
  if (passwordConfirm !== undefined && password !== passwordConfirm) { if (modalAuthStatus) modalAuthStatus.textContent = 'Passwords do not match'; return; }
  try {
    const res = await fetch((BACKEND_URL || '') + '/api/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, password, location, avatarUrl }) });
    const j = await res.json();
    if (!res.ok) { if (modalAuthStatus) modalAuthStatus.textContent = 'Signup failed: ' + (j.error || res.statusText); return; }
    // store token persistently for new users (remember-by-default in this flow)
    try { localStorage.setItem('auth_token', j.token); } catch (e) { sessionStorage.setItem('auth_token', j.token); }
    if (modalAuthStatus) modalAuthStatus.textContent = 'Signed up and logged in as ' + (j.user && j.user.name ? j.user.name : 'admin');
    showSignedInInModal(j.user);
    updateAdminUIStatus();
    updateStartControls();
    if (modalOpenDashboardBtn) modalOpenDashboardBtn.style.display = 'inline-block';
    setTimeout(() => closeAuthModal(), 700);
  } catch (e) { if (modalAuthStatus) modalAuthStatus.textContent = 'Signup error'; }
});

// Open dashboard popup from the auth modal (not the side drawer)
function openDashboardModal() {
  if (!dashboardModal) return;
  dashboardModal.setAttribute('aria-hidden', 'false');
  dashboardModal.style.display = 'flex';
  if (dashboardBackdrop) dashboardBackdrop.hidden = false;
  // ensure latest roster
  fetchAndRenderRoster();
}

function closeDashboardModal() {
  if (!dashboardModal) return;
  dashboardModal.setAttribute('aria-hidden', 'true');
  dashboardModal.style.display = 'none';
  if (dashboardBackdrop) dashboardBackdrop.hidden = true;
}

if (modalOpenDashboardBtn) modalOpenDashboardBtn.addEventListener('click', () => { closeAuthModal(); openDashboardModal(); });

if (dashboardModalClose) dashboardModalClose.addEventListener('click', closeDashboardModal);
if (dashboardBackdrop) dashboardBackdrop.addEventListener('click', closeDashboardModal);

if (modalLogoutBtn) modalLogoutBtn.addEventListener('click', () => {
  logoutAdmin();
  // close auth modal and dashboard if open
  closeAuthModal();
  closeDashboardModal();
});

// add caretaker from dashboard modal
if (dashAddBtn) {
  dashAddBtn.addEventListener('click', async () => {
    try {
      const token = getAuthToken();
      if (!token) { if (modalAuthStatus) modalAuthStatus.textContent = 'Login required'; return; }
      const name = dashNewName && dashNewName.value && dashNewName.value.trim();
      const avatarUrl = dashNewAvatar && dashNewAvatar.value && dashNewAvatar.value.trim();
      if (!name) { if (modalAuthStatus) modalAuthStatus.textContent = 'Enter caretaker name'; return; }
      const res = await fetch((BACKEND_URL || '') + '/api/labels', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }, body: JSON.stringify({ name, avatarUrl }) });
      const j = await res.json();
      if (!res.ok) { if (modalAuthStatus) modalAuthStatus.textContent = 'Add failed: ' + (j.error || res.statusText); return; }
      if (modalAuthStatus) modalAuthStatus.textContent = 'Caretaker added';
      if (dashNewName) dashNewName.value = '';
      if (dashNewAvatar) dashNewAvatar.value = '';
      fetchAndRenderRoster();
    } catch (e) { if (modalAuthStatus) modalAuthStatus.textContent = 'Add error'; }
  });
}

// initialize date and load any saved attendance for today
updateCurrentDate();
loadAttendanceFromStorage();
scheduleMidnightReset();

// Backend URL (empty = same origin)
//const BACKEND_URL = 'http://localhost:4000'; // if backend runs on another host, set e.g. 'http://localhost:4000'

async function sendAttendanceToServer(record) {
  try {
    const payload = {
      deviceId: 'camera-1',
      session: sessionNameInput ? sessionNameInput.value : '',
      records: [ {
        name: record.name,
        confidence: record.confidence,
        time: record.time
      } ]
    };
    const res = await fetch((BACKEND_URL || '') + '/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      console.warn('Failed to send attendance to server', await res.text());
    }
  } catch (e) {
    console.warn('Attendance server error', e);
  }
}

// helper: fetch known labels (caretaker roster) from server
async function fetchKnownLabels() {
  try {
    const token = getAuthToken();
    if (!token) return [];
    const res = await fetch((BACKEND_URL || '') + '/api/labels', { headers: { 'Authorization': 'Bearer ' + token } });
    if (!res.ok) return [];
    const j = await res.json();
    return (j.items || []).map(i => i.name);
  } catch (e) {
    return [];
  }
}

// Save session: computes absent list (labels not present) and sends present+absent to server
if (saveSessionBtn) {
  saveSessionBtn.addEventListener('click', async () => {
    saveSessionBtn.disabled = true;
    const session = sessionNameInput ? sessionNameInput.value : '';
    // dedupe present entries by normalized name to avoid duplicates
    const presentMap = {};
    (attendanceRecords || []).forEach(r => {
      if (!r || !r.name) return;
      const key = String(r.name).trim().toLowerCase();
      if (!key) return;
      if (!presentMap[key]) {
        presentMap[key] = { name: r.name, time: r.time, confidence: r.confidence };
      }
    });
    const present = Object.values(presentMap);
    let absent = [];
    // try fetch known labels from backend to compute absentees
    const labels = await fetchKnownLabels();
    if (labels && labels.length) {
      absent = labels.filter(n => !loggedNames.has(n)).map(n => ({ name: n }));
    }

    try {
      const payload = { deviceId: 'camera-1', session, present, absent, timestamp: new Date().toISOString() };
      const res = await fetch((BACKEND_URL || '') + '/api/attendance/session', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      const j = await res.json();
      if (res.ok) {
        if (statusEl) statusEl.textContent = 'Session saved to server.';
      } else {
        if (statusEl) statusEl.textContent = 'Save failed: ' + (j.error || res.statusText);
      }
    } catch (e) {
      if (statusEl) statusEl.textContent = 'Save failed: network error';
    }

    setTimeout(() => { if (statusEl) statusEl.textContent = 'Ready'; saveSessionBtn.disabled = false; }, 2000);
  });
}

// Load models, then prepare labeled descriptors. Enable Start button when ready.
Promise.all([
  faceapi.nets.ssdMobilenetv1.loadFromUri("/models"),
  faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
  faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
]).then(async () => {
  if (statusEl) statusEl.textContent = 'Models loaded — preparing labels...';
  labeledFaceDescriptors = await getLabeledFaceDescriptions();
  faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors);
  modelsLoaded = true;
  if (statusEl) statusEl.textContent = 'Ready — click Start to begin attendance';
  // enable start only when admin logged in as well
  updateStartControls();
});

function startWebcam() {
  if (!isAdminLoggedIn()) {
    if (statusEl) statusEl.textContent = 'Admin login required to start attendance.';
    return;
  }
  navigator.mediaDevices
    .getUserMedia({
      video: true,
      audio: false,
    })
    .then((stream) => {
      video.srcObject = stream;
      if (startBtn) startBtn.disabled = true;
      if (stopBtn) stopBtn.disabled = false;
      if (statusEl) statusEl.textContent = 'Camera active — detecting...';
    })
    .catch((error) => {
      console.error(error);
      if (statusEl) statusEl.textContent = 'Camera access denied or unavailable.';
    });
}

function stopWebcam() {
  // Stop media tracks
  if (video.srcObject) {
    const tracks = video.srcObject.getTracks();
    tracks.forEach((t) => t.stop());
    video.srcObject = null;
  }

  // Stop detection loop
  if (detectionInterval) {
    clearInterval(detectionInterval);
    detectionInterval = null;
  }

  // Remove canvas overlay
  if (canvas && canvas.parentNode) {
    canvas.parentNode.removeChild(canvas);
    canvas = null;
  }

  // Remove resize listener
  if (handleResize) {
    window.removeEventListener('resize', handleResize);
    handleResize = null;
  }

  if (startBtn) startBtn.disabled = false;
  if (stopBtn) stopBtn.disabled = true;
  if (statusEl) statusEl.textContent = 'Camera stopped.';
}

function getLabeledFaceDescriptions() {
  const labels = ["moksh","shashtika","Ronaldo","Messi","Kohli","Murli"];
  return Promise.all(
    labels.map(async (label) => {
      const descriptions = [];
      for (let i = 1; i <= 2; i++) {
        const img = await faceapi.fetchImage(`./labels/${label}/${i}.png`);
        const detections = await faceapi
          .detectSingleFace(img)
          .withFaceLandmarks()
          .withFaceDescriptor();
        descriptions.push(detections.descriptor);
      }
      return new faceapi.LabeledFaceDescriptors(label, descriptions);
    })
  );
}

video.addEventListener("play", async () => {
  // avoid starting multiple detection loops
  if (detectionInterval) return;

  // Ensure faceMatcher is ready
  if (!faceMatcher) {
    // labels might still be loading; wait a short moment and retry
    console.warn('Face matcher not ready yet');
    return;
  }

  // create overlay canvas if needed and append inside container
  if (!canvas) {
    canvas = faceapi.createCanvasFromMedia(video);
    const container = document.querySelector('.video-container') || document.body;
    container.appendChild(canvas);
  }

  // Use rendered size and update on resize
  let rect = video.getBoundingClientRect();
  displaySize = { width: rect.width, height: rect.height };
  faceapi.matchDimensions(canvas, displaySize);

  handleResize = () => {
    rect = video.getBoundingClientRect();
    displaySize = { width: rect.width, height: rect.height };
    faceapi.matchDimensions(canvas, displaySize);
  };
  window.addEventListener('resize', handleResize);

  detectionInterval = setInterval(async () => {
    const detections = await faceapi
      .detectAllFaces(video)
      .withFaceLandmarks()
      .withFaceDescriptors();

    const resizedDetections = faceapi.resizeResults(detections, displaySize);

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const results = resizedDetections.map((d) => {
      return faceMatcher.findBestMatch(d.descriptor);
    });
    results.forEach((result, i) => {
      const box = resizedDetections[i].detection.box;
      // result is a faceapi.FaceMatch / BestMatch object — use its string form for the label
      const drawBox = new faceapi.draw.DrawBox(box, {
        label: result.toString(),
      });
      drawBox.draw(canvas);
      // If a person is recognized (not "unknown"), add to attendance log once
      try {
        const label = result.label || (result.toString && result.toString());
        if (label && label !== 'unknown' && !loggedNames.has(label)) {
          const ts = new Date();
          loggedNames.add(label);
          // include a simple confidence metric (1 - distance) when available
          const confidence = (typeof result.distance === 'number') ? +(1 - result.distance).toFixed(3) : null;
          attendanceRecords.push({ name: label, time: ts.toISOString(), confidence });
          // update UI list
          if (attListEl) {
            const li = document.createElement('li');
            li.textContent = label;
            const timeSpan = document.createElement('span');
            timeSpan.style.opacity = '0.8';
            timeSpan.style.fontSize = '0.85em';
            timeSpan.textContent = new Date(ts).toLocaleTimeString();
            li.appendChild(timeSpan);
            attListEl.appendChild(li);
          }
          if (attCountEl) attCountEl.textContent = String(loggedNames.size);
          if (exportBtn) exportBtn.disabled = false;
          // persist
          saveAttendanceToStorage();
          // send to backend (best-effort)
          try { sendAttendanceToServer({ name: label, confidence: (typeof result.distance === 'number') ? +(1 - result.distance).toFixed(3) : null, time: ts.toISOString() }); } catch(e) {}
        }
      } catch (e) {
        // non-fatal
      }
    });
  }, 100);
});

// export CSV
if (exportBtn) {
  exportBtn.addEventListener('click', () => {
    if (!attendanceRecords.length) return;
    const rows = [['Name','Timestamp']].concat(attendanceRecords.map(r => [r.name, r.time]));
    const csv = rows.map(r => r.map(c => '"'+String(c).replace(/"/g,'""')+'"').join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'attendance.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
}

// Wire up buttons if present
if (startBtn) startBtn.addEventListener('click', startWebcam);
if (stopBtn) stopBtn.addEventListener('click', stopWebcam);

// Manual add - allows caretakers to be marked present manually
if (manualAddBtn) {
  manualAddBtn.addEventListener('click', () => {
    const name = manualNameInput && manualNameInput.value && manualNameInput.value.trim();
    if (!name) return;
    if (!loggedNames.has(name)) {
      const ts = new Date();
      loggedNames.add(name);
      attendanceRecords.push({ name, time: ts.toISOString() });
      if (attListEl) {
        const li = document.createElement('li');
        li.textContent = name;
        const timeSpan = document.createElement('span');
        timeSpan.style.opacity = '0.8';
        timeSpan.style.fontSize = '0.85em';
        timeSpan.textContent = ts.toLocaleTimeString();
        li.appendChild(timeSpan);
        attListEl.appendChild(li);
      }
      if (attCountEl) attCountEl.textContent = String(loggedNames.size);
      if (exportBtn) exportBtn.disabled = false;
      saveAttendanceToStorage();
    }
    if (manualNameInput) manualNameInput.value = '';
    // send to backend (best-effort)
    try { sendAttendanceToServer({ name, confidence: null, time: new Date().toISOString() }); } catch(e) {}
  });
}

// Clear session (confirm)
if (clearSessionBtn) {
  clearSessionBtn.addEventListener('click', () => {
    if (!confirm('Clear this session attendance? This will remove today\'s in-memory records (localStorage copy will also be removed).')) return;
    // remove storage key and clear UI
    try { localStorage.removeItem(storageKeyForToday()); } catch (e) {}
    loggedNames.clear();
    attendanceRecords = [];
    if (attListEl) attListEl.innerHTML = '';
    if (attCountEl) attCountEl.textContent = '0';
    if (exportBtn) exportBtn.disabled = true;
  });
}
