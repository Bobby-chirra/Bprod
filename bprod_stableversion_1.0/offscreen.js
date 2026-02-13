// This script runs in the offscreen.html document

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'play-sound' && msg.sound) {
    const audioPlayer = document.getElementById('audioPlayer');
    audioPlayer.src = msg.sound;
    audioPlayer.play();
  }
});