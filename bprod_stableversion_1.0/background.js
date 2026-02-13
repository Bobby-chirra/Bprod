const STORAGE_KEY = "bprod_data_v1";
const TIMER_KEY = "bprod_timer_v1";
const OFFSCREEN_DOCUMENT_PATH = '/offscreen.html';

/* ====================================================================
 * --- OFFSCREEN AUDIO HELPERS ---
 * ====================================================================
 */

let creating; // Promise to prevent multiple creation attempts

async function setupOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH);
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl]
  });
  if (existingContexts.length > 0) return;
  if (creating) { await creating; }
  else {
    creating = chrome.offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'To play a notification sound when a timer ends.',
    });
    await creating;
    creating = null;
  }
}

async function playSound(soundFile) {
  try {
      await setupOffscreenDocument();
      await chrome.runtime.sendMessage({ type: 'play-sound', sound: soundFile });
  } catch (error) { console.error("Error playing sound:", error); }
}

/* ====================================================================
 * --- DATA & TIMER HELPERS ---
 * ====================================================================
 */

// Use local time for todayKey
function getTodayKeyString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
// Keep old UTC version for compatibility if needed elsewhere
function todayKey(ts = Date.now()){ return new Date(ts).toISOString().slice(0,10); }


function getAllData(){ return new Promise(res => chrome.storage.local.get([STORAGE_KEY], d => res(d[STORAGE_KEY] || {}))); }
function setAllData(obj){ const p={}; p[STORAGE_KEY]=obj; return new Promise((res, rej) => chrome.storage.local.set(p, ()=>{ if (chrome.runtime.lastError) { return rej(chrome.runtime.lastError); } res(); })); }
function getTimer(){ return new Promise(res => chrome.storage.local.get([TIMER_KEY], d => res(d[TIMER_KEY] || null))); }
function setTimer(obj){ const p={}; p[TIMER_KEY]=obj; return new Promise((res, rej) => chrome.storage.local.set(p, ()=>{ if (chrome.runtime.lastError) { return rej(chrome.runtime.lastError); } res(); })); }

async function addSecondsForDomain(domain, seconds){
  const mins = Math.round(seconds/60);
  if(mins <= 0) return;
  try {
      const data = await getAllData();
      const key = getTodayKeyString();
      if(!data[key]) { const defaultGoal = (data["__meta"] && data["__meta"].dailyGoal) || 150; data[key] = { totalMinutes:0, domains:{}, goal: defaultGoal, tasks: [] }; }
      data[key].totalMinutes = (data[key].totalMinutes || 0) + mins;
      if (!data[key].domains) data[key].domains = {};
      data[key].domains[domain] = (data[key].domains[domain] || 0) + mins;
      await setAllData(data);
      chrome.runtime.sendMessage({type:"data-updated", day:key}).catch(e => { /* Ignore */ });
  } catch (error) { console.error("Error adding seconds for domain:", error); }
}

/* ====================================================================
 * --- MAIN MESSAGE LISTENER ---
 * ====================================================================
//  */



async function setupOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH);
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl]
  });
  if (existingContexts.length > 0) return;
  if (creating) { await creating; }
  else {
    creating = chrome.offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'To play a notification sound when a timer ends.',
    });
    await creating;
    creating = null;
  }
}

async function playSound(soundFile) {
  try {
    await setupOffscreenDocument();
    await chrome.runtime.sendMessage({ type: 'play-sound', sound: soundFile });
  } catch (error) { console.error("Error playing sound:", error); }
}

// Helper to get date key string YYYY-MM-DD for local time
function getTodayKeyString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper to add seconds split correctly across days (new function)
async function addSecondsWithMidnightSplit(domain, startTimestamp, durationSeconds) {
  if (durationSeconds <= 0) return;

  let remainingSeconds = durationSeconds;
  let currStart = new Date(startTimestamp);

  while (remainingSeconds > 0) {
    // Calculate midnight after current start
    let midnight = new Date(currStart);
    midnight.setHours(24, 0, 0, 0); // next midnight

    // Seconds until midnight boundary
    let secondsToMidnight = Math.round((midnight.getTime() - currStart.getTime()) / 1000);
    let chunk = Math.min(remainingSeconds, secondsToMidnight);

    // Add this chunk to appropriate date key
    const key = getTodayKeyString(currStart);
    try {
      const data = await getAllData();
      if (!data[key]) {
        const defaultGoal = (data["__meta"] && data["__meta"].dailyGoal) || 150;
        data[key] = { totalMinutes: 0, domains: {}, goal: defaultGoal, tasks: [] };
      }

      const mins = Math.round(chunk / 60);
      data[key].totalMinutes = (data[key].totalMinutes || 0) + mins;

      if (!data[key].domains) data[key].domains = {};
      data[key].domains[domain] = (data[key].domains[domain] || 0) + mins;

      await setAllData(data);
      chrome.runtime.sendMessage({ type: "data-updated", day: key }).catch(() => { });
    } catch (error) {
      console.error("Error adding seconds for domain:", error);
    }

    // Update for next loop
    remainingSeconds -= chunk;
    currStart = new Date(midnight.getTime());
  }
}

function getAllData() { return new Promise(res => chrome.storage.local.get([STORAGE_KEY], d => res(d[STORAGE_KEY] || {}))); }
function setAllData(obj) { const p = {}; p[STORAGE_KEY] = obj; return new Promise((res, rej) => chrome.storage.local.set(p, () => { if (chrome.runtime.lastError) { return rej(chrome.runtime.lastError); } res(); })); }
function getTimer() { return new Promise(res => chrome.storage.local.get([TIMER_KEY], d => res(d[TIMER_KEY] || null))); }
function setTimer(obj) { const p = {}; p[TIMER_KEY] = obj; return new Promise((res, rej) => chrome.storage.local.set(p, () => { if (chrome.runtime.lastError) { return rej(chrome.runtime.lastError); } res(); })); }

async function logElapsedTimeForPausedTimer(timer) {
  if (!timer) return;

  const elapsedSeconds = timer.unsavedElapsedSeconds || 0;
  if (elapsedSeconds <= 0) return;

  // Calculate the start timestamp for this elapsed segment
  // For simplicity here, assume elapsed seconds happened just before pause (worst approx)
  let referenceTime = Date.now() - elapsedSeconds * 1000;

  // Use new splitting function
  await addSecondsWithMidnightSplit(timer.domain || "unknown", referenceTime, elapsedSeconds);
}

// Save timer on pause or unload, splitting time across days if needed
async function savePausedTimer(timer) {
  if (!timer || timer.state !== "paused") return;

  await logElapsedTimeForPausedTimer(timer);

  // Reset unsaved elapsed after logging
  const updatedTimer = {
    ...timer,
    unsavedElapsedSeconds: 0,
    duration: timer.remainingSeconds || 0,
    remainingSeconds: timer.remainingSeconds || 0,
    state: "paused",
  };
  delete updatedTimer.start;
  delete updatedTimer.end;
  await setTimer(updatedTimer);
}

// Listen for extension unload or shutdown to auto-save paused timer data
chrome.runtime.onSuspend.addListener(async () => {
  const timer = await getTimer();
  if (timer && (timer.state === "running" || timer.state === "paused")) {
    // If running, convert running to paused first
    if (timer.state === "running") {
      // Calculate elapsed since lastActiveTs
      const now = Date.now();
      const lastActiveTs = timer.lastActiveTs || timer.start || now;
      const elapsed = Math.round((now - lastActiveTs) / 1000);

      const pausedTimer = {
        ...timer,
        state: "paused",
        remainingSeconds: timer.end > now ? Math.round((timer.end - now) / 1000) : 0,
        lastActiveTs: null,
        unsavedElapsedSeconds: (timer.unsavedElapsedSeconds || 0) + elapsed,
      };
      await setTimer(pausedTimer);
      await savePausedTimer(pausedTimer);
    } else {
      await savePausedTimer(timer);
    }
  }
});

// Logic at extension startup to check for timer overlap with midnight and split logs
(async function initializeTimerDayCrossing() {
  const timer = await getTimer();
  if (timer && timer.state === "paused" && (timer.unsavedElapsedSeconds || 0) > 0) {
    // Check if elapsed time crosses multiple days using approximate logic:
    // We log normally below; this can be improved by tracking exact segment start times.

    await logElapsedTimeForPausedTimer(timer);
    timer.unsavedElapsedSeconds = 0;
    await setTimer(timer);
  }
})();


  async function addElapsedToTimer(timer, elapsedSeconds) {
  if (!timer) return timer;
  const prevElapsed = timer.unsavedElapsedSeconds || 0;
  timer.unsavedElapsedSeconds = prevElapsed + elapsedSeconds;
  return timer;
}
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // --- Focus Time ---
  if (msg.type === "start-focus") {
    const domain = msg.domain || "unknown";
    chrome.storage.local.set({ bprod_activeFocus: { domain, start: Date.now() } });
    sendResponse({ ok: true });
    return false;
  } else if (msg.type === "stop-focus") {
    chrome.storage.local.get(["bprod_activeFocus"], async (d) => {
      const af = d.bprod_activeFocus;
      if (af && af.domain && af.start) {
        const secs = Math.round((Date.now() - af.start) / 1000);
        await addSecondsForDomain(af.domain, secs);
      }
      chrome.storage.local.remove("bprod_activeFocus");
      sendResponse({ ok: true });
    });
    return true;
  }

  // --- Pomodoro Actions ---
  else if (msg.type === "primary-action") {
    const domain = msg.domain || "unknown";
    const duration = msg.durationSeconds || 25 * 60;

    getTimer()
      .then(async (timer) => {
        if (!timer) {
          // No existing timer - start new
          const start = Date.now();
          const end = start + duration * 1000;
          const newTimer = {
            state: "running",
            start,
            end,
            duration,
            domain,
            unsavedElapsedSeconds: 0,
            lastActiveTs: start // track last timer start/resume
          };
          await setTimer(newTimer);
          chrome.alarms.create("bprod_pom_end", { when: end });
          sendResponse({ ok: true, timer: newTimer });
        } 
        else if (timer.state === "running") {
          // Pausing: accumulate only the time *since last resume/start*!
          const now = Date.now();
          const lastActiveTs = timer.lastActiveTs || timer.start || now;
          const segmentElapsed = Math.round((now - lastActiveTs) / 1000);
          const remainingMs = timer.end - now;
          const remainingSeconds = Math.max(0, Math.round(remainingMs / 1000));

          let pausedTimer = {
            ...timer,
            state: "paused",
            remainingSeconds,
            lastActiveTs: null // will set again on resume
          };
          const prevElapsed = pausedTimer.unsavedElapsedSeconds || 0;
          pausedTimer.unsavedElapsedSeconds = prevElapsed + segmentElapsed;
          delete pausedTimer.end;
          delete pausedTimer.start;
          await setTimer(pausedTimer);

          chrome.alarms.clear("bprod_pom_end");
          sendResponse({ ok: true, timer: pausedTimer });
        } else if (timer.state === "paused") {
          // Resume
          const resumeDurationSeconds = timer.remainingSeconds || 0;
          if (resumeDurationSeconds <= 0) {
            chrome.alarms.clear("bprod_pom_end");
            chrome.storage.local.remove(TIMER_KEY);
            sendResponse({ ok: true, timer: null });
            return;
          }
          const start = Date.now();
          const end = start + resumeDurationSeconds * 1000;
          const resumedTimer = {
            ...timer,
            state: "running",
            start,
            end,
            lastActiveTs: start // update last active timestamp on resume
          };
          delete resumedTimer.remainingSeconds;

          await setTimer(resumedTimer);
          chrome.alarms.create("bprod_pom_end", { when: end });
          sendResponse({ ok: true, timer: resumedTimer });
        } else {
          chrome.alarms.clear("bprod_pom_end");
          chrome.storage.local.remove(TIMER_KEY);
          sendResponse({ ok: true, timer: null });
        }
      })
      .catch((err) => {
        console.error("GetTimer Error:", err);
        sendResponse({ ok: false, error: err.message });
      });

    return true; // Async response
  }
  else if (msg.type === "save-timer") {
    getTimer().then(async (timer) => {
      if (!timer || timer.state !== "paused") {
        sendResponse({ ok: false, error: "No paused timer to save" });
        return;
      }

      // Log only what's accumulated from prior pause segments:
      const elapsedSeconds = timer.unsavedElapsedSeconds || 0;
      let loggedMinutes = 0;

      if (elapsedSeconds > 0) {
        // Calculate approximate segment start timestamp for elapsed time
        // Since timer is paused, assume elapsedSeconds happened just before now
        const approxStartTs = Date.now() - elapsedSeconds * 1000;

        // Use new function to split elapsed time by day
        await addSecondsWithMidnightSplit(timer.domain || "unknown", approxStartTs, elapsedSeconds);

        loggedMinutes = Math.round(elapsedSeconds / 60);
      }

      // After logging, reset accumulator and keep timer paused
      const updatedTimer = {
        ...timer,
        state: "paused",
        duration: timer.remainingSeconds || 0,
        remainingSeconds: timer.remainingSeconds || 0,
        unsavedElapsedSeconds: 0
      };
      delete updatedTimer.start;
      delete updatedTimer.end;

      await setTimer(updatedTimer);
      sendResponse({ ok: true, loggedMinutes: loggedMinutes });
    })
    .catch((err) => {
      console.error("Save Error:", err);
      sendResponse({ ok: false, error: err.message });
    });
    return true;
  }

  // --- END save-timer Handler ---

  else if (msg.type === "reset-timer") {
    chrome.alarms.clear("bprod_pom_end");
    chrome.storage.local.remove(TIMER_KEY, () => sendResponse({ ok: true, timer: null }));
    return true;
  }
  else if (msg.type === "get-state") {
    Promise.all([
      getAllData(),
      getTimer(),
      new Promise((res) => chrome.storage.local.get(["bprod_activeFocus"], (d) => res(d.bprod_activeFocus || null))),
    ])
      .then(([data, timer, activeFocus]) => sendResponse({ ok: true, data, timer, activeFocus }))
      .catch((err) => {
        console.error("Get State Error:", err);
        sendResponse({ ok: false, error: err.message });
      });
    return true;
  }
  else if (msg.type === "export-data") {
    getAllData()
      .then((d) => sendResponse({ ok: true, data: d }))
      .catch((err) => {
        console.error("Export Error:", err);
        sendResponse({ ok: false, error: err.message });
      });
    return true;
  }
  else if (msg.type === "pause-and-save-segment") {
    getTimer().then(async (timer) => {
      if (!timer || timer.state !== "running") {
        sendResponse({ ok: false, error: "No running timer to pause" });
        return;
      }
      const now = Date.now();
      const lastActiveTs = timer.lastActiveTs || timer.start || now;
      const elapsedSegment = Math.round((now - lastActiveTs) / 1000);
      if (elapsedSegment <= 0) {
        sendResponse({ ok: false, error: "No elapsed time to save" });
        return;
      }

      const pausedTimer = {
        ...timer,
        state: "paused",
        remainingSeconds: timer.end > now ? Math.round((timer.end - now) / 1000) : 0,
        lastActiveTs: null,
        unsavedElapsedSeconds: (timer.unsavedElapsedSeconds || 0) + elapsedSegment
      };
      await setTimer(pausedTimer);

      await saveUnsavedSegment({
        domain: pausedTimer.domain || "unknown",
        elapsedSeconds: pausedTimer.unsavedElapsedSeconds,
        pausedAt: now
      });

      // Remove TIMER_KEY so timer resets visually
      await chrome.storage.local.remove(TIMER_KEY);

      sendResponse({ ok: true });
    })
    .catch((err) => {
      console.error("Pause and Save Error:", err);
      sendResponse({ ok: false, error: err.message });
    });
    return true;
  }
  else if (msg.type === 'log-unsaved-segment') {
    new Promise(res => chrome.storage.local.get('bprod_unsaved_segment_v1', d => res(d.bprod_unsaved_segment_v1)))
      .then(async (segment) => {
        if (!segment || !segment.elapsedSeconds || segment.elapsedSeconds <= 0) {
          sendResponse({ ok: false, error: "No unsaved segment to log" });
          return;
        }
        const approxStart = segment.pausedAt - segment.elapsedSeconds * 1000;
        await addSecondsWithMidnightSplit(segment.domain, approxStart, segment.elapsedSeconds);
        await clearUnsavedSegment();
        sendResponse({ ok: true, loggedMinutes: Math.round(segment.elapsedSeconds / 60) });
      })
      .catch((err) => {
        console.error("Log Unsaved Segment Error:", err);
        sendResponse({ ok: false, error: err.message });
      });
    return true;
  } 
  // --- Discard unsaved segment ---
  else if (msg.type === 'discard-unsaved-segment') {
    clearUnsavedSegment()
      .then(() => sendResponse({ ok: true }))
      .catch((err) => {
        console.error("Discard Unsaved Segment Error:", err);
        sendResponse({ ok: false, error: err.message });
      });
    return true;
  }

  // If message wasn't handled async, return false or nothing
  return false;
});


/* ====================================================================
 * --- ALARM LISTENER (Already Corrected) ---
 * ====================================================================
 */

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "bprod_pom_end") {
    try {
      const t = await getTimer();
      if (t && t.state === "running" && t.start && t.end) {
        const elapsedSecondsSinceLastStart = Math.max(0, Math.round((t.end - t.start) / 1000));
        const totalElapsed = (t.unsavedElapsedSeconds || 0) + elapsedSecondsSinceLastStart;

        // Use new function to split time by day if needed
        await addSecondsWithMidnightSplit(t.domain || "unknown", t.start, totalElapsed);
        await chrome.storage.local.remove(TIMER_KEY);

        chrome.notifications.create('', { type: 'basic', iconUrl: 'assets/icon128.png', title: 'Bprod', message: 'Pomodoro finished — time logged.' });
        playSound('assets/notification.mp3');
        chrome.runtime.sendMessage({ type: "pomodoro-ended" }).catch(() => { });
        await chrome.storage.local.set({ bprod_timerJustFinished: true });
        if (chrome.action && chrome.action.openPopup) chrome.action.openPopup();
      } else {
        await chrome.storage.local.remove(TIMER_KEY);
      }
    } catch (error) {
      console.error("Error processing alarm:", error);
      await chrome.storage.local.remove(TIMER_KEY);
    }
  }
});

const UNSAVED_SEGMENT_KEY = "bprod_unsaved_segment_v1";

async function saveUnsavedSegment(segment) {
  return new Promise((resolve, reject) => {
    const obj = {};
    obj[UNSAVED_SEGMENT_KEY] = segment;
    chrome.storage.local.set(obj, () => {
      if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
      resolve();
    });
  });
}

async function clearUnsavedSegment() {
  return new Promise((resolve) => {
    chrome.storage.local.remove(UNSAVED_SEGMENT_KEY, () => resolve());
  });
}


chrome.windows.onRemoved.addListener(async (windowId) => {
  try {
    const tabs = await chrome.tabs.query({windowId});
    if (!tabs.length) {
      // No tabs means window is fully closed, so pause all running timers, if needed

      // Option 1: Pause all timers globally (if only one timer per user stored)
      const timer = await getTimer();
      if (timer && timer.state === 'running') {
        const now = Date.now();
        const lastActiveTs = timer.lastActiveTs || timer.start || now;
        const elapsedSegment = Math.round((now - lastActiveTs) / 1000);
        if (elapsedSegment > 0) {
          const pausedTimer = {
            ...timer,
            state: 'paused',
            remainingSeconds: timer.end > now ? Math.round((timer.end - now) / 1000) : 0,
            lastActiveTs: null,
            unsavedElapsedSeconds: (timer.unsavedElapsedSeconds || 0) + elapsedSegment,
          };
          await setTimer(pausedTimer);
          // Save unsaved segment for popup prompt later
          await saveUnsavedSegment({
            domain: pausedTimer.domain || "unknown",
            elapsedSeconds: pausedTimer.unsavedElapsedSeconds,
            pausedAt: now
          });
          await chrome.storage.local.remove(TIMER_KEY);
          console.log("pause-and-save-segment received");

        }
      }
    }
  } catch (error) {
    console.error("Error handling window close:", error);
  }
});

// Your other listeners unchanged...

/* ====================================================================
 * --- OTHER LISTENERS (Unchanged) ---
 * ====================================================================
 */
chrome.idle.onStateChanged.addListener((state) => { /* ... (Unchanged) ... */ });
chrome.runtime.onInstalled.addListener(async () => { /* ... (Unchanged) ... */ });
// --- (Full code for other listeners included below) ---
chrome.idle.onStateChanged.addListener((state) => { if(state !== "active"){ chrome.storage.local.get(["bprod_activeFocus"], async (d) => { const af = d.bprod_activeFocus; if(af && af.domain && af.start){ const secs = Math.round((Date.now() - af.start)/1000); await addSecondsForDomain(af.domain, secs); } chrome.storage.local.remove("bprod_activeFocus"); }); } });
chrome.runtime.onInstalled.addListener(async () => { try { const data = await getAllData(); if(!data["__meta"]) { data["__meta"] = {created: new Date().toISOString()}; await setAllData(data); } } catch(error) { console.error("Error during onInstalled:", error); } });