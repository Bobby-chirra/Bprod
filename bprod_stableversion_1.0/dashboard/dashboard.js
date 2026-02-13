/* ====================================================================
 * --- 1. DOM Elements ---
 * ====================================================================
 */
const todaySummaryEl = document.getElementById("todaySummary");
const comparisonEl = document.getElementById("comparison");
const streakEl = document.getElementById("streak");
const domainListEl = document.getElementById("domainList");
// Removed heatmapEl
const clearBtn = document.getElementById("clearData"); // Make sure ID matches HTML
const goalInput = document.getElementById("goalInput");
const pomDurationInput = document.getElementById("pomDurationInput");
const darkToggle = document.getElementById("darkToggle");
const saveSettingsBtn = document.getElementById("saveSettings");

// *** ADDED BACK Export buttons and inputs ***
const exportTodayBtn = document.getElementById("exportToday");
const exportAllBtn = document.getElementById("exportAll");
const exportRangeBtn = document.getElementById("exportRange");
const startDateInput = document.getElementById("startDate");
const endDateInput = document.getElementById("endDate");

const dayDetailsHeading = document.getElementById("day-details-heading");
const domainBreakdownHeading = document.getElementById("domain-breakdown-heading");

const dashboardTaskInputRow = document.getElementById("dashboardTaskInputRow");
const dashboardTaskInput = document.getElementById("dashboardTaskInput");
const dashboardAddTaskBtn = document.getElementById("dashboardAddTaskBtn");
const dashboardTaskList = document.getElementById("dashboardTaskList");

// Calendar Elements
const calendarDaysContainer = document.getElementById("calendarDays");
const prevMonthBtn = document.getElementById("prevMonthBtn");
const nextMonthBtn = document.getElementById("nextMonthBtn");
const monthYearDisplay = document.getElementById("monthYearDisplay");

let allData = {};
// Calendar State
let currentYear;
let currentMonth; // 0-indexed
let installDate = null; // Date object
let installDateString = null; // YYYY-MM-DD string for input min attribute
let selectedDateKey = null;

// --- CRITICAL CHECK ---
// Ensure getAllData and setAllData are loaded from utils/storage.js FIRST in HTML
if (typeof getAllData !== 'function' || typeof setAllData !== 'function') {
    console.error("CRITICAL ERROR: Storage functions (getAllData or setAllData) not found! Make sure utils/storage.js is loaded BEFORE dashboard.js in your HTML.");
    document.body.innerHTML = '<p style="color: red; padding: 20px;">Error: Could not load required storage functions. The extension may be broken.</p>';
    throw new Error("Storage functions not available."); // Stop execution
}
// --- DO NOT DECLARE getAllData or setAllData BELOW THIS LINE ---


/* ====================================================================
 * --- 2. Core Functions ---
 * ====================================================================
 */

// Gets LOCAL date string in YYYY-MM-DD format
function getTodayKeyString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Generates CSV (using the improved version)
function generateCSV(dataToExport, filename) {
    if (!dataToExport || Object.keys(dataToExport).length === 0 || (Object.keys(dataToExport).length === 1 && dataToExport["__meta"])) {
    alert("No data found for the selected period.");
    return;
    }
    let rows = [["date", "type", "value", "minutes_or_status"]];
    for (const [date, obj] of Object.entries(dataToExport)) {
        if (date === "__meta") continue;
        const domains = obj.domains || {};
        const tasks = obj.tasks || [];
        let dateHasEntries = false;

        if (Object.keys(domains).length > 0) {
        dateHasEntries = true;
        for (const [dom, mins] of Object.entries(domains)) {
            rows.push([date, "domain", dom, String(mins)]);
        }
        }
        if (tasks.length > 0) {
        dateHasEntries = true;
        for (const task of tasks) {
            rows.push([date, "task", task.text, task.completed ? "DONE" : "TODO"]);
        }
        }
        // Only add total row if there were entries and totalMinutes exists
        if(dateHasEntries && obj.totalMinutes !== undefined) {
            rows.push([date, "total", "__total__", String(obj.totalMinutes || 0)]);
        }
    }
    if (rows.length <= 1) { // Only header means no real data
        alert("No data (domains or tasks) found for the selected period.");
        return;
    }
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// Draws the details for a specific day
let todayChart = null; // Keep chart instance global for updating

function drawDayDetails(dateKey) {
    const day = allData[dateKey] || null;
    const todayKey = getTodayKeyString();
    const isToday = (dateKey === todayKey);

    if (isToday) {
        dayDetailsHeading.textContent = "Today";
        domainBreakdownHeading.textContent = "Domain Breakdown";
    } else {
        dayDetailsHeading.textContent = `Details for ${dateKey}`;
        domainBreakdownHeading.textContent = `Domain Breakdown for ${dateKey}`;
    }

    if (day) {
        const goal = day.goal || (allData["__meta"] && allData["__meta"].dailyGoal) || 150;
        todaySummaryEl.textContent = `${day.totalMinutes || 0} / ${goal} min`;
    } else {
        todaySummaryEl.textContent = "No productive time.";
    }

    // Comparison with previous day for any selected date
    comparisonEl.textContent = "";
    if (dateKey !== installDateString) {
        const selectedDate = new Date(dateKey);
        selectedDate.setDate(selectedDate.getDate() - 1);
        const prevKey = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
        const prevDay = allData[prevKey] || null;
        if (day && prevDay) {
            const diff = (day.totalMinutes || 0) - (prevDay.totalMinutes || 0);
            const pct = prevDay.totalMinutes ? Math.round((diff / prevDay.totalMinutes) * 100) : (diff > 0 ? 100 : 0);
            comparisonEl.textContent = pct >= 0 ? `+${pct}% vs previous day` : `${pct}% vs previous day`;
        } else if (day && (day.totalMinutes || 0) > 0) {
            comparisonEl.textContent = "+100% vs previous day";
        }
    }

    // Calculate two streaks from the selected date backwards
    streakEl.textContent = "";
    if (day) {
        let goalStreak = 0;
        let activeStreak = 0;
        for (let i = 0; i < 365; i++) {
            const checkDate = new Date(dateKey);
            checkDate.setDate(checkDate.getDate() - i);
            const key = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
            const dayData = allData[key];
            if (!dayData) break;

            const goalForDay = dayData.goal || (allData["__meta"] && allData["__meta"].dailyGoal) || 150;

            if ((dayData.totalMinutes || 0) >= goalForDay) {
                goalStreak++;
            } else {
                break;
            }
        }
        for (let i = 0; i < 365; i++) {
            const checkDate = new Date(dateKey);
            checkDate.setDate(checkDate.getDate() - i);
            const key = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
            const dayData = allData[key];
            if (!dayData) break;

            if ((dayData.totalMinutes || 0) > 0) {
                activeStreak++;
            } else {
                break;
            }
        }
        streakEl.textContent = `Goal streak: ${goalStreak} day(s), Active streak: ${activeStreak} day(s)`;
    }

    domainListEl.innerHTML = "";
    if (day && day.domains && Object.keys(day.domains).length > 0) {
        const items = Object.entries(day.domains).sort((a, b) => b[1] - a[1]);
        for (const [dom, mins] of items) {
            const li = document.createElement("li");
            const text = document.createTextNode(`${dom} — ${mins} min`);
            li.appendChild(text);
            if (isToday) {
                const deleteBtn = document.createElement("span");
                deleteBtn.className = "delete-domain";
                deleteBtn.textContent = "×";
                deleteBtn.title = `Delete entry for ${dom}`;
                deleteBtn.setAttribute("data-domain-name", dom);
                li.appendChild(deleteBtn);
            }
            domainListEl.appendChild(li);
        }
    } else {
        domainListEl.innerHTML = "<li>No domains tracked for this day.</li>";
    }

    dashboardTaskList.innerHTML = "";
    if (dashboardTaskInputRow) dashboardTaskInputRow.style.display = isToday ? "flex" : "none";
    const tasks = (day && day.tasks) || [];
    if (tasks.length === 0) {
        dashboardTaskList.innerHTML = "<li>No tasks for this day.</li>";
    } else {
        tasks.forEach((task, index) => {
            const li = document.createElement("li");
            li.className = task.completed ? "completed" : "";
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = task.completed;
            checkbox.setAttribute("data-index", index);
            checkbox.disabled = !isToday;
            const text = document.createTextNode(task.text);
            li.appendChild(checkbox);
            li.appendChild(text);
            if (isToday) {
                const deleteBtn = document.createElement("span");
                deleteBtn.className = "delete-task";
                deleteBtn.textContent = "×";
                deleteBtn.setAttribute("data-index", index);
                deleteBtn.title = "Delete task";
                li.appendChild(deleteBtn);
            }
            dashboardTaskList.appendChild(li);
        });
    }

    // Chart rendering logic (Chart.js)
    const ctx = document.getElementById('todayChart');
    if (!ctx) return; // Canvas not found, skip

    const domains = day?.domains || {};
    const labels = Object.keys(domains);
    const data = labels.map(domain => domains[domain]);

    if (todayChart) {
        todayChart.destroy();
    }
  const maxY = Math.max(...data, 5); // Set a minimum (for visual) and to auto-scale

  todayChart = new Chart(ctx, {
  type: 'bar',
  data: {
    labels,
    datasets: [{
      label: 'Minutes spent per domain',
      data,
      backgroundColor: 'rgba(15, 100, 170, 0.7)'
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        callbacks: {
          title: function(context) {
            return context[0].label;    // Show domain name in tooltip
          },
          label: function(context) {
            return context.dataset.label + ": " + context.formattedValue + " min";
          }
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Domains'
        },
        ticks: {
          display: false,
          autoSkip: false
        },
        grid: { display: false }
      },
      y: {
        beginAtZero: true,
        min: 0,
        max: maxY,
        title: {
          display: true,
          text: 'Time spent'
        },
        ticks: { stepSize: 1 }
      }
    }
  }
});


console.log(labels, data); // Just before Chart.js initialization
}

// Draws the calendar grid
function drawCalendar(year, month) {
  // ...(unchanged from your working version)...
    calendarDaysContainer.innerHTML = "";

    const monthName = new Date(year, month).toLocaleString('default', { month: 'long' });
    monthYearDisplay.textContent = `${monthName} ${year}`;

    const firstDayOfMonth = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startDayOfWeek = firstDayOfMonth.getDay();

    let maxMinutes = 1;

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayNames.forEach(name => {
        const dayNameEl = document.createElement('div');
        dayNameEl.className = 'day-name';
        dayNameEl.textContent = name;
        calendarDaysContainer.appendChild(dayNameEl);
    });

    for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayData = allData[dateKey];
        const mins = dayData ? (dayData.totalMinutes || 0) : 0;
        maxMinutes = Math.max(maxMinutes, mins);
    }

    for (let i = 0; i < startDayOfWeek; i++) {
        const cell = document.createElement('div');
        cell.className = 'calendar-day blank';
        calendarDaysContainer.appendChild(cell);
    }

    const todayKey = getTodayKeyString();

    for (let day = 1; day <= daysInMonth; day++) {
        const cell = document.createElement('button');
        cell.className = 'calendar-day';

        const currentDate = new Date(year, month, day);
        currentDate.setHours(0,0,0,0);
        const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        cell.setAttribute('data-date-key', dateKey);
        cell.textContent = day;

        const dayData = allData[dateKey];
        const mins = dayData ? (dayData.totalMinutes || 0) : 0;

        if (installDate && currentDate < installDate) {
            cell.classList.add('disabled');
            cell.disabled = true;
        } else {
        const intensity = mins / (maxMinutes || 1);
        const alpha = 0.1 + (0.8 * intensity);
        const safeAlpha = Math.max(0, Math.min(1, alpha));
        cell.style.backgroundColor = `rgba(15, 100, 170, ${safeAlpha})`;
        cell.title = `${dateKey}: ${mins} min`;

        if (dateKey === selectedDateKey) {
            cell.classList.add('selected');
        }
        if (dateKey === todayKey) {
            cell.classList.add('today');
        }
        }
        calendarDaysContainer.appendChild(cell);
    }

    const installYear = installDate ? installDate.getFullYear() : 1970;
    const installMonth = installDate ? installDate.getMonth() : 0;
    if(prevMonthBtn) prevMonthBtn.disabled = (year === installYear && month === installMonth);

    const today = new Date();
    const currentActualYear = today.getFullYear();
    const currentActualMonth = today.getMonth();
    if(nextMonthBtn) nextMonthBtn.disabled = (year === currentActualYear && month === currentActualMonth);
}

// Loads settings from storage
async function loadSettings() {
    const data = allData;
    const todayKey = getTodayKeyString();
    const todayData = data[todayKey];
    const defaultGoal = (data["__meta"] && data["__meta"].dailyGoal) || 150;
    if (goalInput) goalInput.value = (todayData && todayData.goal) || defaultGoal;

    const pomDuration = (data["__meta"] && data["__meta"].pomDuration) || 25;
    if (pomDurationInput) pomDurationInput.value = pomDuration;

    try {
        const themePref = await chrome.storage.local.get('bprod_darkMode');
        applyTheme(themePref.bprod_darkMode);
    } catch (error) {
        console.error("Error loading dark mode setting:", error);
        applyTheme(false);
    }
}

// Applies theme class
function applyTheme(isDark) {
    if (isDark) {
        document.body.classList.add('dark-mode');
        if (darkToggle) darkToggle.checked = true;
    } else {
        document.body.classList.remove('dark-mode');
        if (darkToggle) darkToggle.checked = false;
    }
}

/* ====================================================================
 * --- 3. Event Listeners ---
 * ====================================================================
 */

// --- Data & Export Buttons ---
// *** ADDED BACK with null checks ***
if (clearBtn) clearBtn.addEventListener("click", async () => {
  if (!confirm("Clear all stored productivity data? This cannot be undone.")) return;
  try {
      await setAllData({});
      allData = {}; // Clear local cache
      installDate = null; installDateString = null; // Reset install date
      await init(); // Re-initialize UI
  } catch (error) {
      console.error("Error clearing data:", error);
      alert("Failed to clear data.");
  }
});

if (exportTodayBtn) exportTodayBtn.addEventListener("click", () => {
  const todayKey = getTodayKeyString();
  const todayData = {};
  if (allData[todayKey]) {
    todayData[todayKey] = allData[todayKey]; // Extract only today's data
  }
  // Include meta? No, just today's specific data.
  generateCSV(todayData, `bprod_${todayKey}.csv`);
});

if (exportAllBtn) exportAllBtn.addEventListener("click", () => {
  // console.log("Export All button clicked!"); // Optional debug
  generateCSV(allData, "bprod_all_time.csv"); // Export everything including meta (CSV function filters it)
});

if (exportRangeBtn) exportRangeBtn.addEventListener("click", () => {
  const startDate = startDateInput?.value;
  const endDate = endDateInput?.value;
  if (!startDate || !endDate) { alert("Please select both a start and end date."); return; }
  if (startDate > endDate) { alert("Start date must be before the end date."); return; }
  const rangedData = {};
  for (const dateKey of Object.keys(allData)) {
    // Only include actual date keys within the range
    if (dateKey !== "__meta" && dateKey >= startDate && dateKey <= endDate) {
      rangedData[dateKey] = allData[dateKey];
    }
  }
  generateCSV(rangedData, `bprod_${startDate}_to_${endDate}.csv`);
});


// --- Settings Inputs ---
if (saveSettingsBtn) saveSettingsBtn.addEventListener("click", async () => {
    // ...(validation unchanged)...
    let goalVal = Number(goalInput.value);
    if (goalVal > 1440) { alert("Validation Error: Daily Goal cannot be more than 1440 minutes."); return; }
    if (isNaN(goalVal) || goalVal <= 0) { goalVal = 150; }
    goalInput.value = goalVal; // Update input to reflect validation

    let pomVal = Number(pomDurationInput.value);
    if (pomVal > 60) { alert("Validation Error: Pomodoro Time cannot be more than 60 minutes."); return; }
    if (isNaN(pomVal) || pomVal <= 0) { pomVal = 25; }
    pomDurationInput.value = pomVal; // Update input to reflect validation

    // Ensure __meta exists
    if (!allData["__meta"]) allData["__meta"] = {};
    allData["__meta"].pomDuration = pomVal;
    allData["__meta"].dailyGoal = goalVal; // Store the default/current goal

    const todayKey = getTodayKeyString();
    if (!allData[todayKey]) {
        // Initialize today's data if it doesn't exist
        allData[todayKey] = { totalMinutes: 0, domains: {}, goal: goalVal, tasks: [] }; // No streak here
    } else {
        allData[todayKey].goal = goalVal; // Update today's specific goal
    }

    try {
        await setAllData(allData);
        // Redraw details for the currently selected day (might be today or a past day)
        drawDayDetails(selectedDateKey || todayKey);

        saveSettingsBtn.textContent = "Saved!"; saveSettingsBtn.disabled = true;
        setTimeout(() => { saveSettingsBtn.textContent = "Save"; saveSettingsBtn.disabled = false; }, 1500);
    } catch (err) {
        console.error("Error saving settings:", err);
        alert("Failed to save settings.");
    }
});

// --- Dark Mode ---
if (darkToggle) darkToggle.addEventListener("change", () => {
  const isDark = darkToggle.checked;
  applyTheme(isDark);
  chrome.storage.local.set({ bprod_darkMode: isDark }); // Save preference
});

// --- Background Updates ---
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "data-updated") {
        console.log("Received data-updated, re-initializing dashboard.");
        init(); // Refetch data and redraw everything
    }
});


// --- Calendar Navigation ---
if (prevMonthBtn) prevMonthBtn.addEventListener("click", () => {
  currentMonth--;
  if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  drawCalendar(currentYear, currentMonth);
});
if (nextMonthBtn) nextMonthBtn.addEventListener("click", () => {
  currentMonth++;
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  drawCalendar(currentYear, currentMonth);
});

// --- Calendar Day Click (Using working version) ---
if (calendarDaysContainer) calendarDaysContainer.addEventListener("click", (e) => {
  const cell = e.target.closest("button.calendar-day:not(.disabled):not(.blank)");
  if (!cell) return;

  const dateKey = cell.getAttribute("data-date-key");
  if (!dateKey) { console.error("Clicked cell missing data-date-key."); return; }

  selectedDateKey = dateKey;

  // Visually update selection
  calendarDaysContainer.querySelectorAll("button.calendar-day.selected").forEach(c => c.classList.remove("selected"));
  cell.classList.add("selected");

  drawDayDetails(dateKey);
});


// --- Domain List Delete ---
if (domainListEl) domainListEl.addEventListener("click", async (e) => {
  const deleteBtn = e.target.closest(".delete-domain");
  if (!deleteBtn) return;

  const todayKey = getTodayKeyString();
  // Ensure we are viewing today
  if (selectedDateKey !== todayKey) {
    alert("You can only delete entries from the current day's view.");
    return;
  }
  const domainToDelete = deleteBtn.getAttribute("data-domain-name");
  if (!domainToDelete) return;

  if (confirm(`Are you sure you want to delete all ${domainToDelete} time for today (${todayKey})?`)) {
    const dayData = allData[todayKey];
    // Check more thoroughly before proceeding
    if (!dayData || !dayData.domains || !(domainToDelete in dayData.domains)) {
         console.warn(`Domain ${domainToDelete} not found for deletion.`);
         return; // Domain doesn't exist or data structure issue
    }

    const minsToDelete = dayData.domains[domainToDelete];
    dayData.totalMinutes = Math.max(0, (dayData.totalMinutes || 0) - minsToDelete);
    delete dayData.domains[domainToDelete]; // Delete the property

    await setAllData(allData);
    drawDayDetails(todayKey); // Redraw
  }
});

// --- Task Add/Edit/Delete ---
async function addDashboardTask() {
  if (!dashboardTaskInput) return;
  const text = dashboardTaskInput.value.trim();
  if (text) {
    const todayKey = getTodayKeyString();
    // Ensure data structure exists before adding
    if (!allData[todayKey]) {
      const currentGoal = Number(goalInput?.value) || (allData["__meta"] && allData["__meta"].dailyGoal) || 150;
      allData[todayKey] = { totalMinutes: 0, domains: {}, goal: currentGoal, tasks: [] };
    }
    if (!allData[todayKey].tasks) {
      allData[todayKey].tasks = [];
    }
    allData[todayKey].tasks.push({ text: text, completed: false });
    dashboardTaskInput.value = "";
    await setAllData(allData);
    // Only redraw if today is the selected day
    if (selectedDateKey === todayKey) {
        drawDayDetails(todayKey);
    }
  }
}
if(dashboardAddTaskBtn) dashboardAddTaskBtn.addEventListener('click', addDashboardTask);
if(dashboardTaskInput) dashboardTaskInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addDashboardTask(); });

if(dashboardTaskList) dashboardTaskList.addEventListener('click', async (e) => {
  const indexStr = e.target.getAttribute('data-index'); // Get index as string
  if (indexStr === null) return; // Didn't click element with index

  const index = parseInt(indexStr, 10); // Convert to number
  if (isNaN(index)) return; // Invalid index

  const todayKey = getTodayKeyString();
  // Ensure we are viewing today
  if (selectedDateKey !== todayKey) return;

  if (!allData[todayKey] || !allData[todayKey].tasks) return; // No tasks for today
  const todayTasks = allData[todayKey].tasks;
  if (!todayTasks[index]) return; // Index out of bounds

  if (e.target.matches('.delete-task')) {
    todayTasks.splice(index, 1);
  } else if (e.target.matches('input[type="checkbox"]')) {
    todayTasks[index].completed = !todayTasks[index].completed;
  } else {
    return; // Clicked somewhere else
  }

  await setAllData(allData);
  drawDayDetails(todayKey); // Redraw
});

// --- Start Date Change Listener (Restored) ---
if (startDateInput) startDateInput.addEventListener("change", () => {
    if(endDateInput) {
        endDateInput.min = startDateInput.value;
        if (endDateInput.value && endDateInput.value < startDateInput.value) {
            endDateInput.value = "";
        }
    }
});


window.addEventListener('resize', function() {
  if (todayChart) {
    todayChart.options.scales.x.ticks.display = false; // Always hide
    todayChart.update();
  }
});



/* ====================================================================
 * --- 4. Initialization ---
 * ====================================================================
 */
async function init() {
  console.log("Initializing dashboard...");
  try {
      const todayKey = getTodayKeyString();

      // Set max attributes (with null checks)
      if (startDateInput) startDateInput.max = todayKey;
      if (endDateInput) endDateInput.max = todayKey;
      if (goalInput) goalInput.max = 1440;
      if (pomDurationInput) pomDurationInput.max = 60;

      allData = await getAllData();
      console.log("Data loaded:", allData);

      // Determine install date and string
      if (allData["__meta"] && allData["__meta"].created) {
        installDate = new Date(allData["__meta"].created);
        installDate.setHours(0, 0, 0, 0);
        installDateString = `${installDate.getFullYear()}-${String(installDate.getMonth() + 1).padStart(2, '0')}-${String(installDate.getDate()).padStart(2, '0')}`;
      } else {
        console.warn("Install date not found, setting to today and saving.");
        installDate = new Date();
        installDate.setHours(0, 0, 0, 0);
        installDateString = todayKey;
        if (!allData["__meta"]) allData["__meta"] = {};
        if (!allData["__meta"].created) {
            allData["__meta"].created = installDate.toISOString();
            await setAllData(allData); // Save the newly created meta immediately
        }
      }

      // Set min attributes (with null checks)
      if (startDateInput) startDateInput.min = installDateString;
      if (endDateInput) endDateInput.min = installDateString;

      // Set initial calendar view state
      const todayDateObj = new Date();
      currentYear = todayDateObj.getFullYear();
      currentMonth = todayDateObj.getMonth();
      selectedDateKey = todayKey; // Select today initially

      await loadSettings(); // Load settings (includes theme)
      drawCalendar(currentYear, currentMonth); // Draw calendar grid
      drawDayDetails(todayKey); // Draw details for today LAST
      console.log("Dashboard initialized successfully.");

  } catch (error) {
      console.error("Error during dashboard initialization:", error);
      document.body.innerHTML = '<p style="color: red; padding: 20px;">Error initializing dashboard. Check console for details.</p>';
  }
}

// Final check before running init
// Already checked for storage functions at the top
init(); // Call init directly