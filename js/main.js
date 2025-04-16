// Main application logic and initialization

// Global application state
window.appState = {
  conversation: [],
  currentAgent: 'project-manager',
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
  console.log('Initializing application...');
  
  // Add initial welcome message about our design office workflow
  const welcomeMessage = 
    "Welcome to the Websim Design Office! We're your full‑service design agency: " +
    "the project manager clarifies requirements, the product owner defines features, " +
    "the lead developer outlines architecture, the designer crafts UI/UX, developers " +
    "implement functionality, code reviewers ensure quality, QA engineers test thoroughly, " +
    "and DevOps prepares deployment. Let's start by sketching the HTML/CSS/JS scaffold for your application.";
  
  await UI.addMessage(welcomeMessage, 'ai', 'project-manager');
  
  // Ensure UI elements are initialized
  UI.highlightAgent(window.appState.currentAgent);
  
  // Ensure room is initialized
  if (window.Room) {
    console.log('Initializing WebsimSocket room...');
    await window.Room.initializeRoom();
    console.log('Room initialized successfully');
  } else {
    console.error('Room module not found');
  }
  
  console.log('Application initialized successfully');
})();