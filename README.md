# Bprod
Bprod chrome extension, to support/increase productivity.
# Bprod - Productivity Chrome Extension

Bprod is a powerful Chrome extension designed to boost your focus and productivity. It tracks your browsing time by domain/task, features a customizable Pomodoro timer with audio alerts, strict focus lock mode, and detailed analytics via a full dashboard.


## ✨ Features

- **Pomodoro Timer** - Customizable work/break sessions with audio notifications
- **Domain Tracking** - Automatically logs time spent on each website/domain
- **Task Management** - Add, edit, mark complete your daily tasks
- **Strict Focus Lock** - Prevents tab switching during work sessions
- **Midnight Splitting** - Handles timer logs across date boundaries automatically
- **Unsaved Segment Prompts** - Asks to save/discard time when tabs close unexpectedly
- **Dark Mode** - Toggle between light/dark themes
- **CSV Export** - Export daily summaries, domains, and tasks
- **Dashboard Analytics** - Calendar view, charts, and detailed stats
- **Daily Goals** - Set and track your productivity targets


## 🚀 Quick Start

1. **Install the Extension**
   ```bash
   # Option 1: Load unpacked (Development)
   1. Open Chrome → `chrome://extensions/`
   2. Enable "Developer mode"
   3. Click "Load unpacked" → Select this repo folder
   
   # Option 2: Chrome Web Store (Production)
   Coming soon!
   ```

2. **Basic Usage**
   - Click extension icon to open popup
   - Set your Pomodoro duration and start timer
   - Add tasks for the day
   - Enable "Lock" for strict focus mode
   - View analytics in Dashboard (bookmark or pin)

## 🗂️ Project Structure

```
bprod/
├── 📁 popup/           # Popup UI (timer, controls, quick stats)
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── 📁 dashboard/       # Full analytics dashboard
│   ├── dashboard.html
│   ├── dashboard.js
│   └── dashboard.css
├── 📁 utils/           # Shared utilities
│   └── storage.js
├── 📁 offscreen/       # Audio handling (Chrome offscreen API)
│   └── offscreen.html
├── 🔧 manifest.json    # Extension manifest (v3)
├── 📄 content.js       # Tab close detection
├── ⚙️  background.js   # Core timer logic & event handling
├── 📊 chart.umd.min.js # Chart.js bundle (dashboard)
└── README.md
```

## ⚙️ Customization

### Daily Goals & Timer
- Edit `dailyGoalMinutes` in Dashboard settings
- Changes sync across popup and dashboard

### Themes
- Toggle dark mode from popup settings
- CSS variables make theming easy to extend

### Export Format
Current CSV includes:
```
Date, Total Time, Goal, Domains, Tasks
2026-02-13, 120min, 150min, "google.com:45m,youtube.com:75m", "Task1[DONE];Task2[TODO]"
```

## 🛠️ Development

```bash
# Prerequisites
Chrome 96+ (Manifest V3)
VS Code recommended

# Workflow
1. Modify files
2. Reload extension in chrome://extensions/
3. Test popup → Dashboard → Timer scenarios
4. Debug: Check Background page console
```

**Hotkeys (Testing)**
- `Ctrl+Shift+I` → Inspect popup/dashboard
- Background page: `chrome://extensions/` → Inspect views

## 🔒 Permissions Explained

| Permission | Purpose |
|------------|---------|
| `storage` | Save timer data, settings, logs |
| `alarms` | Pomodoro countdown timer |
| `notifications` | Timer completion alerts |
| `tabs` | Track active domain, focus lock |
| `offscreen` | Audio playback (Chrome 109+) |
| `idle` | Detect user away periods |

## 🤝 Contributing

1. Fork the repo
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push (`git push origin feature/amazing-feature`)
5. Open Pull Request

**Good first issues:**
- Mobile responsiveness improvements
- More export formats (JSON, Excel)
- PWA Dashboard version
- Additional sound themes

## 🙏 Acknowledgments

Built with ❤️ by Bobby - Computer Science Engineering graduate from Visakhapatnam, India. Special thanks to the Chrome Extension community and Chart.js team!


**⭐ Star this repo if it helps your productivity!**
