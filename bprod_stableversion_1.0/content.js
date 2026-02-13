window.addEventListener('beforeunload', () => {
  chrome.runtime.sendMessage({ type: "pause-and-save-segment" });
});