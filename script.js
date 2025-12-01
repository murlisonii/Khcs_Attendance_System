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

// initialize date and load any saved attendance for today
updateCurrentDate();
loadAttendanceFromStorage();
scheduleMidnightReset();

// Backend URL (empty = same origin)
const BACKEND_URL = 'http://localhost:4000'; // if backend runs on another host, set e.g. 'http://localhost:4000'

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
    const res = await fetch((BACKEND_URL || '') + '/api/labels');
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
    const present = attendanceRecords.map(r => ({ name: r.name, time: r.time, confidence: r.confidence }));
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
  if (statusEl) statusEl.textContent = 'Ready — click Start to begin attendance';
  if (startBtn) startBtn.disabled = false;
});

function startWebcam() {
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
  const labels = ["moksh","shashtika"];
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
      const drawBox = new faceapi.draw.DrawBox(box, {
        label: result,
      });
      drawBox.draw(canvas);
      // If a person is recognized (not "unknown"), add to attendance log once
      try {
        const label = result.label || (result.toString && result.toString());
        if (label && label !== 'unknown' && !loggedNames.has(label)) {
          const ts = new Date();
          loggedNames.add(label);
          attendanceRecords.push({ name: label, time: ts.toISOString() });
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
          try { sendAttendanceToServer({ name: label, confidence: it.confidence, time: ts.toISOString() }); } catch(e) {}
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
