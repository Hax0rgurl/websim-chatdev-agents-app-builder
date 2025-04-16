// Logging utility: logs to console and UI
function log(message, data) {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] ${message}` + (data !== undefined ? ` ${JSON.stringify(data)}` : '');
  console.log(entry, data);
  const panel = document.getElementById('agentLog');
  if (panel) {
    const div = document.createElement('div');
    div.textContent = entry;
    panel.appendChild(div);
    panel.scrollTop = panel.scrollHeight;
  }
}
window.Logger = { log };