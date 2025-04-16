// Main application logic and initialization

// Global application state
window.appState = {
  conversation: [],
  currentAgent: 'product-owner',
  progress_value: 0,
  autoConversationTimeout: null,
  isAutoConversing: false,
  codeHistory: [],
  pendingChanges: null,
  votes: {}
};

// Event listeners
document.getElementById('generateBtn').addEventListener('click', async function() {
  const promptText = UI.promptInput.value.trim();
  if (!promptText) return;

  clearTimeout(window.appState.autoConversationTimeout);
  window.appState.isAutoConversing = true;

  await UI.addMessage(promptText);
  UI.promptInput.value = '';

  await Messaging.generateResponse(promptText, true);
});

UI.promptInput.addEventListener('keypress', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    document.getElementById('generateBtn').click();
  }
});

UI.codeEditor.addEventListener('input', function() {
  UI.updatePreview(this.value);
});

UI.proposeBtn.addEventListener('click', CodeVersion.proposeChanges);
UI.approveBtn.addEventListener('click', () => CodeVersion.vote(true));
UI.rejectBtn.addEventListener('click', () => CodeVersion.vote(false));

UI.viewHistoryBtn.addEventListener('click', function() {
  const historyDiv = document.querySelector('.code-history');
  historyDiv.classList.toggle('visible');
});

UI.codeHistoryDiv.addEventListener('click', (e) => {
  const revision = e.target.closest('.revision');
  if (revision) {
    const index = parseInt(revision.dataset.index);
    const code = window.appState.codeHistory[index].code;
    UI.codeEditor.value = code;
    UI.updatePreview(code);
  }
});

// API Documentation Modal functionality
const modal = document.getElementById('apiDocsModal');
const btn = document.getElementById('toggleApiDocs');
const span = document.getElementsByClassName('close-modal')[0];

btn.onclick = function() {
  modal.style.display = 'block';
};

span.onclick = function() {
  modal.style.display = 'none';
};

window.onclick = function(event) {
  if (event.target == modal) {
    modal.style.display = 'none';
  }
};

// Initialize the application
(async function init() {
  // Add initial welcome message about Websim projects
  const welcomeMessage = 
    "Welcome to the Websim Development Team! Our agents specialize in creating " +
    "Websim-specific projects. Check the API documentation to see what tools " +
    "are available for your project. Please describe what you'd like to build.";
  
  await UI.addMessage(welcomeMessage, 'ai', 'project-manager');
  
  // Ensure room is initialized
  if (window.Room && window.Room.room) {
    await window.Room.initializeRoom();
  }
})();