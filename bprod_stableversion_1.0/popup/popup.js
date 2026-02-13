/* ====================================================================
 * --- 1. DOM Elements ---
 * ====================================================================
 */
const primaryButton = document.getElementById('primaryButton');
const saveButton = document.getElementById('saveButton');
const resetButton = document.getElementById('resetButton');
const themeToggle = document.getElementById('themeToggle');
const saveTooltip = document.getElementById('saveTooltip');
const timerBig = document.getElementById('timerBig');
const todaySummary = document.getElementById('todaySummary');
const domainList = document.getElementById('domainList');
const goalInfo = document.getElementById('goalInfo');
const progressFill = document.getElementById('progressFill');
const openDash = document.getElementById('openDash');
const exportCsv = document.getElementById('exportCsv');
const mainContent = document.getElementById('mainContent');
const successContent = document.getElementById('successContent');
const showDomainsBtn = document.getElementById('showDomainsBtn');
const showTasksBtn = document.getElementById('showTasksBtn');
const domainSummaryContent = document.getElementById('domainSummaryContent');
const taskSummaryContent = document.getElementById('taskSummaryContent');
const taskInput = document.getElementById('taskInput');
const addTaskBtn = document.getElementById('addTaskBtn');
const taskList = document.getElementById('taskList');

let localInterval = null;
let currentTimer = null;
let pomDurationMinutes = 25;
let currentTotalMinutesToday = 0;

// Storage key constant (assuming it's loaded globally via utils/storage.js)
// Make sure STORAGE_KEY is defined in utils/storage.js and loaded first in HTML
// const STORAGE_KEY = "bprod_data_v1"; // DO NOT declare here

/* ====================================================================
 * --- 2. Helper Functions ---
 * ====================================================================
 */

function fmtSec(s){
  if(s === null || s === undefined || isNaN(s) || s < 0) s=0;
  const m = Math.floor(s/60);
  const sec = s%60;
  const mm = String(m).padStart(2,'0');
  const ss = String(sec).padStart(2,'0');
  return mm + ':' + ss;
}

async function activeDomain(){
  try{
    // Ensure chrome.tabs exists
    if (!chrome || !chrome.tabs || !chrome.tabs.query) {
         console.error("chrome.tabs.query API not available.");
         return "unknown";
    }
    const tabs = await chrome.tabs.query({active:true,lastFocusedWindow:true});
    if(tabs && tabs[0] && tabs[0].url){
      // Check if URL is valid before creating URL object
      if (tabs[0].url.startsWith('http:') || tabs[0].url.startsWith('https:') || tabs[0].url.startsWith('file:')) {
          const u = new URL(tabs[0].url);
          return u.hostname.replace(/^www\./,'');
      } else {
          // Handle special Chrome URLs, etc.
          return tabs[0].url.split('/')[0] || "special-page"; // e.g., "chrome:"
      }
    }
  }catch(e){ console.error("Error getting active domain:", e); }
  return "unknown";
}

// Get today's date string in YYYY-MM-DD format (local time)
function getTodayKeyString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}


/* ====================================================================
 * --- 3. Core UI Logic ---
 * ====================================================================
 */

function renderTimerState(timer) {
  // Store the latest timer state globally
  currentTimer = timer || null;

  clearInterval(localInterval);
  localInterval = null;

  // Add null checks for elements
  if (!timerBig || !primaryButton || !saveButton || !resetButton) {
      console.error("Core timer UI elements not found in renderTimerState!");
      return;
  }

  if (!timer) { // IDLE State
    timerBig.textContent = fmtSec(pomDurationMinutes * 60);
    primaryButton.textContent = "Start";
    primaryButton.disabled = false;
    saveButton.disabled = true;
    resetButton.disabled = true;
    if (saveTooltip) saveTooltip.textContent = "Start the timer first.";
  } else if (timer.state === "running") { // RUNNING State
    primaryButton.textContent = "Stop";
    primaryButton.disabled = false;
    saveButton.disabled = true;
    resetButton.disabled = false;
    if (saveTooltip) saveTooltip.textContent = "Pause the timer first.";
    const updateDisplay = () => {
      // Add checks inside interval callback too
      if (!currentTimer || currentTimer.state !== "running" || !timerBig || !document.body.contains(timerBig)) {
          clearInterval(localInterval); localInterval = null; return;
      }
      const now = Date.now();
      // Ensure timer.end exists before calculation
      const rem = Math.round(((currentTimer.end || now) - now) / 1000);
      timerBig.textContent = fmtSec(rem < 0 ? 0 : rem);
      if (rem <= 0) { clearInterval(localInterval); localInterval = null; }
    };
    updateDisplay(); // Initial display
    localInterval = setInterval(async () => {
       try {
           // Ensure popup is still relevant before async operation
           if (!document.getElementById('timerBig')) { clearInterval(localInterval); localInterval = null; return; }
           const resp = await new Promise((res, rej) => chrome.runtime.sendMessage({ type: 'get-state' }, r => {
               if (chrome.runtime.lastError) { rej(chrome.runtime.lastError); } else { res(r); }
           }));
           // Check again after await
           if (!document.getElementById('timerBig')) { clearInterval(localInterval); localInterval = null; return; }
           // Add checks for response structure
           if (resp && resp.ok && resp.timer && resp.timer.state === "running") {
               currentTimer = resp.timer;
               updateDisplay();
           } else {
               clearInterval(localInterval); localInterval = null;
               // Refresh might be safer if state is unexpected
               if (document.getElementById('timerBig')) refreshSummary();
           }
        } catch (error) { console.warn("Polling error:", error); clearInterval(localInterval); localInterval = null; }
    }, 1000);
  } else if (timer.state === "paused") { // PAUSED State
    // Ensure remainingSeconds exists
    timerBig.textContent = fmtSec(timer.remainingSeconds || 0);
    primaryButton.textContent = "Resume";
    primaryButton.disabled = false;
    saveButton.disabled = false;
    resetButton.disabled = false;
  } else {
      console.warn("Timer in unexpected state:", timer);
      // Fallback to idle state visually
      timerBig.textContent = fmtSec(pomDurationMinutes * 60);
      primaryButton.textContent = "Start";
      primaryButton.disabled = false;
      saveButton.disabled = true;
      resetButton.disabled = true;
      if (saveTooltip) saveTooltip.textContent = "Start the timer first.";
  }
}

// Renders tasks specific to the popup's list
function renderPopupTasks(tasksArray) {
  if (!taskList) return;
  taskList.innerHTML = "";
  if (!tasksArray || tasksArray.length === 0) {
      taskList.innerHTML = "<li>No tasks for today.</li>"; return;
  }
  tasksArray.forEach((task, index) => { /* ... (rendering logic unchanged) ... */ });
   // Full rendering logic for completeness
   tasksArray.forEach((task, index) => {
    const li = document.createElement("li");
    li.className = task.completed ? "completed" : "";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox"; checkbox.checked = !!task.completed; checkbox.setAttribute("data-index", index); checkbox.title = "Toggle task";
    const text = document.createTextNode(" " + (task.text || "")); // Handle missing text
    const deleteBtn = document.createElement("span");
    deleteBtn.className = "delete-task"; deleteBtn.textContent = "×"; deleteBtn.setAttribute("data-index", index); deleteBtn.title = "Delete task";
    li.appendChild(checkbox); li.appendChild(text); li.appendChild(deleteBtn);
    taskList.appendChild(li);
  });
}

// Refreshes summary (domains, goal, total time) and tasks
async function refreshSummary() {
  try {
    const resp = await new Promise((res, rej) => chrome.runtime.sendMessage({ type: 'get-state' }, r => {
      // Handle potential errors during message passing
      if (chrome.runtime.lastError) {
        rej(chrome.runtime.lastError);
      } else if (!r) {
        rej(new Error("No response from background"));
      } else if (!r.ok) {
        rej(new Error(r.error || "Background script reported an error"));
      } else {
        res(r);
      }
    }));

    // Check response structure after promise resolves
    if (!resp.data) {
      console.warn("Could not get state or data is missing.", resp);
      // Display a user-friendly state if data is missing
      if(todaySummary) todaySummary.textContent = "Loading error";
      if(domainList) domainList.innerHTML = '<div>...</div>';
      if(goalInfo) goalInfo.textContent = `- / - min`;
      if(progressFill) progressFill.style.width = '0%';
      renderPopupTasks([]);
      renderTimerState(resp.timer); // Still try to render timer if available
      return;
    }

    const data = resp.data || {};
    pomDurationMinutes = (data["__meta"] && data["__meta"].pomDuration) || 25;

    const todayKey = getTodayKeyString(); // Use local time helper
    const t = data[todayKey]; // Today's data object

    const currentTotal = t?.totalMinutes || 0; // Use optional chaining
    currentTotalMinutesToday = currentTotal; // Update local counter

    // Update Top Summary (Total Time)
    if (todaySummary) todaySummary.textContent = `Today: ${currentTotal} min`;

    // --- DOMAIN LIST SORTING ---
    if (t?.domains && Object.keys(t.domains).length > 0) { // Check t and domains exist
      if (domainList) {
        // 1. Convert domains object to array: [ [domain, minutes], ... ]
        const domainEntries = Object.entries(t.domains);

        // 2. Sort the array by minutes (index 1), descending (b[1] - a[1])
        const sortedDomains = domainEntries.sort(([, minsA], [, minsB]) => minsB - minsA);

        // 3. Map the *sorted* array to HTML strings
        domainList.innerHTML = sortedDomains
          .map(([d, m]) => `<div>${d}: ${m} min</div>`)
          .join('');
      }
    } else {
      // Handle case where there are no domains tracked today
      if (domainList) domainList.innerHTML = '<div>No domains tracked today.</div>';
    }
    // --- END DOMAIN LIST SORTING ---

    // Update Goal Info and Progress Bar
    const dashboardGoal = (data["__meta"] && data["__meta"].dailyGoal) || 150;
    const goal = t?.goal || dashboardGoal;  // GOOD: fallback comes from dashboard default
    if (goalInfo) goalInfo.textContent = `${currentTotal} / ${goal} min`;
    const pct = goal > 0 ? Math.min(100, Math.round((currentTotal / goal) * 100)) : 0;
    if (progressFill) progressFill.style.width = pct + '%';

    // Render Tasks
    renderPopupTasks(t?.tasks || []); // Check t exists, provide default empty array

    // Render Timer State LAST
    renderTimerState(resp.timer);

  } catch (error) {
    console.error("Error refreshing summary:", error);
    // Display error state in UI
    if (todaySummary) todaySummary.textContent = "Error loading data.";
    if (domainList) domainList.innerHTML = '<div>Error</div>';
    if (goalInfo) goalInfo.textContent = `Err / Err`;
    if (progressFill) progressFill.style.width = '0%';
    renderPopupTasks([]);
    renderTimerState(null); // Show idle timer on error
    // Disable buttons maybe?
    if(primaryButton) primaryButton.disabled = true;
    if(saveButton) saveButton.disabled = true;
    if(resetButton) resetButton.disabled = true;
  }
}

/* ====================================================================
 * --- 4. Event Listeners ---
 * Add null checks before each addEventListener
 * ====================================================================
 */

if(primaryButton) primaryButton.addEventListener('click', async () => {
  let domain = "unknown";
  // Ensure currentTimer state is checked correctly
  if (!currentTimer || currentTimer.state !== 'running' && currentTimer.state !== 'paused') {
      domain = await activeDomain();
  }
  chrome.runtime.sendMessage( { type: 'primary-action', domain: domain, durationSeconds: pomDurationMinutes * 60 }, (resp) => {
    // Check popup still open and response is valid
    if (document.getElementById('primaryButton')) {
        if (resp && resp.ok && resp.timer !== undefined) { // Check timer exists in response
            renderTimerState(resp.timer);
        } else {
            console.warn("Primary action response invalid or missing timer:", resp);
            refreshSummary(); // Refresh fully if response is odd
        }
    }
  });
});

if (saveButton) saveButton.addEventListener('click', () => {
  // ...(Corrected logic from previous step)...
  if (primaryButton) primaryButton.disabled = true;
  if (saveButton) saveButton.disabled = true;
  if (resetButton) resetButton.disabled = true;
  if (saveTooltip) saveTooltip.style.visibility = 'hidden';
  chrome.runtime.sendMessage({ type: 'save-timer' }, (resp) => {
      if (!document.getElementById('saveButton')) return;
      if (resp && resp.ok) {
          currentTotalMinutesToday += resp.loggedMinutes || 0;
          if (todaySummary) todaySummary.textContent = `Today: ${currentTotalMinutesToday} min`;
          const goalText = goalInfo ? goalInfo.textContent.split('/')[1] : `${pomDurationMinutes} min`;
          const goal = parseInt(goalText) || pomDurationMinutes;
          if(goalInfo) goalInfo.textContent = `${currentTotalMinutesToday} / ${goal} min`;
          const pct = goal > 0 ? Math.min(100, Math.round((currentTotalMinutesToday / goal) * 100)) : 0;
          if(progressFill) progressFill.style.width = pct + '%';
          if (saveButton) saveButton.textContent = "Saved!";
          setTimeout(() => {
              if (!document.getElementById('saveButton')) return;
              if (saveButton) saveButton.textContent = "Save";
              if (saveTooltip) saveTooltip.style.visibility = '';
              // Re-render the PAUSED state using the currentTimer object
              renderTimerState(currentTimer);
          }, 1500);
      } else {
          console.error("Failed to save timer:", resp?.error); alert("Error saving time.");
          refreshSummary(); // Refresh to re-enable
          if (saveButton) saveButton.textContent = "Save";
          if (saveTooltip) saveTooltip.style.visibility = '';
      }
  });
});

if (resetButton) resetButton.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'reset-timer' }, (resp) => {
      if (document.getElementById('resetButton')) { renderTimerState(null); }
  });
});

if (openDash) openDash.addEventListener('click', ()=> {
    // Ensure API exists
    if(chrome.runtime && chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
    } else {
        console.warn("chrome.runtime.openOptionsPage is not available.");
        // Maybe open the dashboard URL directly if known?
        // window.open(chrome.runtime.getURL('dashboard/dashboard.html'));
    }
});
if (exportCsv) exportCsv.addEventListener('click', async () => {
  const todayKey = getTodayKeyString();
  try {
    const resp = await new Promise((res, rej) => chrome.runtime.sendMessage({type:"export-data"}, r => {
      if (chrome.runtime.lastError) { rej(chrome.runtime.lastError); }
      else if (!r || !r.ok) { rej(new Error(r?.error || "Invalid response")); }
      else { res(r); }
    }));
    if (!resp.data) { alert("No data available."); return; }
    const all = resp.data;
    const todayData = all[todayKey];
    if (!todayData) { alert("No data recorded for today (" + todayKey + ")."); return; }
    const domains = todayData.domains || {};
    const tasks = todayData.tasks || [];
    let rows = [["date", "type", "value", "minutes_or_status"]];

    // Domains as separate rows
    for (const [dom, mins] of Object.entries(domains)) {
      rows.push([todayKey, "domain", dom, String(mins)]);
    }

    // Tasks as separate rows
    for (const task of tasks) {
      rows.push([todayKey, "task", task.text, task.completed ? "DONE" : "TODO"]);
    }

    // Optionally add total as a final row
    if (todayData.totalMinutes !== undefined) {
      rows.push([todayKey, "total", "__total__", String(todayData.totalMinutes || 0)]);
    }

    // Prepare CSV
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], {type:"text/csv"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bprod_${todayKey}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    console.log(`CSV generated: bprod_${todayKey}.csv`);
  } catch (error) {
    console.error("Error during popup CSV export:", error);
    alert(`Export error: ${error.message || error}`);
  }
});


// --- Theme Toggle Code ---
/**
 * Applies the dark/light theme by adding/removing a class from the <body>
 */
function applyTheme(isDark) {
  if (isDark) {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }
}

/**
 * Loads the theme preference from storage when the popup opens.
 */
function loadTheme() {
  // Check if themeToggle element exists before proceeding
  if (!themeToggle) {
      console.warn("Theme toggle button not found during load.");
      return;
  }
  chrome.storage.local.get('bprod_darkMode', (data) => {
    // Check if popup is still open within the async callback
    if (document.getElementById('themeToggle')) {
        applyTheme(data.bprod_darkMode);
        // Sync checkbox state if needed (though we use icons now)
        // themeToggle.checked = data.bprod_darkMode; // Not needed for button toggle
    }
  });
}

// Attach the click listener *only if* the button exists
if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    // Toggle the class on the body
    const isDark = document.body.classList.toggle('dark-mode');
    console.log("Dark mode toggled:", isDark); // Debug log

    // Save the new preference to storage (use the same key as dashboard)
    chrome.storage.local.set({ bprod_darkMode: isDark }, () => {
        if(chrome.runtime.lastError) {
            console.error("Error saving theme preference:", chrome.runtime.lastError);
        } else {
            console.log("Theme preference saved."); // Debug log
        }
    });
  });
} else {
    console.error("Theme toggle button (#themeToggle) not found in HTML!");
}


// --- Storage & Message Listeners ---
chrome.storage.onChanged.addListener((changes, area) => {
    // Check if popup DOM is still available AND if STORAGE_KEY is defined
    if (!document.getElementById('timerBig') || typeof STORAGE_KEY === 'undefined') return;
    if (area === 'local' && changes[STORAGE_KEY]) { refreshSummary(); }
    else if (area === 'local' && changes.bprod_data_v1) { refreshSummary(); } // Fallback
});
chrome.runtime.onMessage.addListener((m) => {
  if (!document.getElementById('timerBig')) return false;
  if (m.type === "pomodoro-ended") {
    // Show success content immediately, just like in init()
    if (mainContent) mainContent.style.display = 'none';
    if (successContent) successContent.style.display = 'flex';
    // Remove the timer-just-finished flag if set
    chrome.storage.local.remove('bprod_timerJustFinished');
    setTimeout(() => {
      if (!document.getElementById('timerBig')) return;
      if (mainContent) mainContent.style.display = 'block';
      if (successContent) successContent.style.display = 'none';
      refreshSummary();
    }, 3000);
    return false;
  }
  if (m.type === "data-updated") refreshSummary();
  return false;
});


// --- TAB & TASK LISTENERS ---
if (showDomainsBtn) showDomainsBtn.addEventListener('click', () => {
    if(taskSummaryContent) taskSummaryContent.style.display = 'none';
    if(domainSummaryContent) domainSummaryContent.style.display = 'block';
    showDomainsBtn.classList.add('active');
    if(showTasksBtn) showTasksBtn.classList.remove('active');
});
if (showTasksBtn) showTasksBtn.addEventListener('click', () => {
    if(domainSummaryContent) domainSummaryContent.style.display = 'none';
    if(taskSummaryContent) taskSummaryContent.style.display = 'block';
    showTasksBtn.classList.add('active');
    if(showDomainsBtn) showDomainsBtn.classList.remove('active');
});

// Add Task
async function addTask() {
  if(!taskInput) return;
  const text = taskInput.value.trim();
  if (text) {
    const todayKey = getTodayKeyString();
    try {
        const storageData = await new Promise((res, rej) => chrome.storage.local.get(STORAGE_KEY, data => { if (chrome.runtime.lastError) { rej(chrome.runtime.lastError); } else { res(data); } }));
        const allData = storageData[STORAGE_KEY] || {};
        const dashboardGoal = (allData["__meta"] && allData["__meta"].dailyGoal) || 150;
        if (!allData[todayKey]) {
          allData[todayKey] = { totalMinutes: 0, domains: {}, goal: dashboardGoal, tasks: [] };
        }
        if (!allData[todayKey].tasks) { allData[todayKey].tasks = []; }
        allData[todayKey].tasks.push({ text: text, completed: false });
        taskInput.value = "";
        await new Promise((res, rej) => chrome.storage.local.set({[STORAGE_KEY]: allData}, () => { if (chrome.runtime.lastError) { rej(chrome.runtime.lastError); } else { res(); } }));
        renderPopupTasks(allData[todayKey].tasks); // Update UI
    } catch (error) { console.error("Error adding task:", error); alert("Failed to add task."); }
  }
}
if (addTaskBtn) addTaskBtn.addEventListener('click', addTask);
if (taskInput) taskInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addTask(); });

// Toggle or Delete Task
if (taskList) taskList.addEventListener('click', async (e) => {
  const indexStr = e.target.getAttribute('data-index');
  if (indexStr === null) return;
  const index = parseInt(indexStr, 10);
  if (isNaN(index)) return;

  const todayKey = getTodayKeyString();
  try {
      const storageData = await new Promise((res, rej) => chrome.storage.local.get(STORAGE_KEY, data => { if (chrome.runtime.lastError) { rej(chrome.runtime.lastError); } else { res(data); } }));
      const allData = storageData[STORAGE_KEY] || {};
      if (!allData[todayKey] || !allData[todayKey].tasks) return;
      const todayTasks = allData[todayKey].tasks;
      if (!todayTasks[index]) return;

      if (e.target.matches('.delete-task')) { todayTasks.splice(index, 1); }
      else if (e.target.matches('input[type="checkbox"]')) { todayTasks[index].completed = !todayTasks[index].completed; }
      else { return; }

      await new Promise((res, rej) => chrome.storage.local.set({[STORAGE_KEY]: allData}, () => { if (chrome.runtime.lastError) { rej(chrome.runtime.lastError); } else { res(); } }));
      renderPopupTasks(todayTasks); // Update UI
  } catch(error) { console.error("Error modifying task:", error); alert("Failed to modify task."); }
});

/* ====================================================================
 * --- 5. Initialization ---
 * ====================================================================
 */

// --- Include all your existing popup.js code exactly as you provided ---
// (Refer to your detailed popup.js from the conversation)

// Add the following at the end of your popup.js after your existing init and helper functions:

// Check for unsaved segment on popup open and prompt user

async function checkUnsavedSegmentPrompt() {
  const segment = await new Promise(res => {
    chrome.storage.local.get('bprod_unsaved_segment_v1', data => {
      res(data.bprod_unsaved_segment_v1 || null);
    });
  });
  if (segment && segment.elapsedSeconds > 0) {
    showUnsavedSegmentPrompt(segment);
  }
}

function showUnsavedSegmentPrompt(segment) {
  if (!mainContent) return;
  mainContent.style.display = 'none';

  let promptDiv = document.getElementById('unsavedSegmentPrompt');
  if (!promptDiv) {
    promptDiv = document.createElement('div');
    promptDiv.id = 'unsavedSegmentPrompt';
    promptDiv.style.cssText = 'margin: 24px auto; background: white; color: #111; border: 1px solid #aaa; padding: 18px; max-width: 320px; min-width: 200px; text-align: center; border-radius: 10px;';
    mainContent.parentNode.insertBefore(promptDiv, mainContent);

  }
  const minutes = Math.round(segment.elapsedSeconds / 60);

  promptDiv.innerHTML = `
    <p>You have an unsaved timer segment of about <b>${minutes} minutes</b>. Do you want to save it?</p>
    <button id="saveUnsavedBtn" style="margin-right: 10px;">✔ Yes</button>
    <button id="discardUnsavedBtn">✘ No</button>
  `;

  document.getElementById('saveUnsavedBtn').onclick = async () => {
    await new Promise(res => {
      chrome.runtime.sendMessage({type: 'log-unsaved-segment'}, resp => {
        if (resp && resp.ok) alert(`Saved ${resp.loggedMinutes} minutes.`);
        else alert(`Save failed.`);
        res();
      });
    });
    cleanupUnsavedPrompt();
    refreshSummary();
  };

  document.getElementById('discardUnsavedBtn').onclick = async () => {
    await new Promise(res => {
      chrome.runtime.sendMessage({type: 'discard-unsaved-segment'}, () => res());
    });
    cleanupUnsavedPrompt();
    refreshSummary();
  };
}

function cleanupUnsavedPrompt() {
  const promptDiv = document.getElementById('unsavedSegmentPrompt');
  if (promptDiv) promptDiv.remove();
  if (mainContent) mainContent.style.display = 'block';
}

function cleanupUnsavedPrompt() {
  const promptDiv = document.getElementById("unsavedSegmentPrompt");
  if (promptDiv) {
    promptDiv.remove();
  }
  if (mainContent) mainContent.style.display = "block";
}


// Modify your existing init() a bit, add this line before or after refreshSummary()


// Add these lines at the bottom of popup.js (or inside the global scope) to handle unloading popup itself gracefully:
window.addEventListener('unload', async () => {
  // No action needed here for tab/window close; content script handles that
});

function init() {
  console.log("Popup init start");
  loadTheme();
  chrome.storage.local.get('bprod_timerJustFinished', (data) => {
    if (!document.getElementById('timerBig')) return; // Check popup still open
    if (data.bprod_timerJustFinished) {
      console.log("Timer just finished flag found.");
      chrome.storage.local.remove('bprod_timerJustFinished');
      if (mainContent) mainContent.style.display = 'none';
      if (successContent) successContent.style.display = 'flex';
      setTimeout(() => {
        if (!document.getElementById('timerBig')) return;
        if (mainContent) mainContent.style.display = 'block';
        if (successContent) successContent.style.display = 'none';
        refreshSummary();
        checkUnsavedSegmentPrompt();
      }, 3000);
    } else {
      if (mainContent) mainContent.style.display = 'block';
      if (successContent) successContent.style.display = 'none';
      refreshSummary().then(() => {
        checkUnsavedSegmentPrompt(); // NEW: check on normal init too
      });
    }
  });
}

// --- Final Checks before Init ---
// Check if STORAGE_KEY is defined (should be from utils/storage.js)
if (typeof STORAGE_KEY === 'undefined') {
    console.error("STORAGE_KEY not defined! Ensure utils/storage.js is loaded BEFORE popup.js in popup.html.");
    document.body.innerHTML = '<p style="color:red; padding: 10px;">Error: Missing storage configuration.</p>';
}
// Check essential UI elements are present
else if (!primaryButton || !saveButton || !resetButton || !timerBig || !mainContent || !successContent || !taskList || !domainList) {
    console.error("Crucial popup UI elements not found! Check HTML IDs in popup.html.");
    document.body.innerHTML = '<p style="color:red; padding: 10px;">Error: UI elements missing.</p>';
}
else {
    init(); // Run initialization only if checks pass
}


// --- Ensure functions are defined ---
// (Included full functions above, no need for separate list here)