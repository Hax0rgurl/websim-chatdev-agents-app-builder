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
  // Set immediately to true, generateResponse will handle turning it off if needed
  window.appState.isAutoConversing = true; 

  // Add user message to state *before* calling addMessage UI function
  // and *before* sending to AI
  const userMessageEntry = {
    role: 'user',
    content: promptText,
    agent: 'user' // Explicitly mark as user
  };
  window.appState.conversation.push(userMessageEntry);

  // Update UI
  await UI.addMessage(promptText, 'user'); // Pass 'user' explicitly
  UI.promptInput.value = '';

  // Update shared state immediately after user message
  await window.Room.updateProjectState();

  // Trigger AI response generation
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

  // Define initial message locally
  const welcomeMessage =
    "Welcome to the Websim Development Team! Our agents specialize in creating " +
    "Websim-specific projects using the available APIs. Check the 'Show API Documentation' " +
    "button for details. Please describe what you'd like to build.";

  // Initialize room first to potentially load existing state
  if (window.Room) {
    console.log('Initializing WebsimSocket room...');
    await window.Room.initializeRoom();
    console.log('Room initialized successfully');

    // Check if conversation is already loaded from room state
    if (window.appState.conversation.length === 0) {
      // Add welcome message to state *and* UI only if conversation is empty
      const welcomeMessageEntry = {
        role: 'assistant',
        content: welcomeMessage,
        agent: 'project-manager'
      };
      window.appState.conversation.push(welcomeMessageEntry);
      await UI.addMessage(welcomeMessage, 'ai', 'project-manager');
      // Sync the initial state if we added the welcome message
      await window.Room.updateProjectState(); 
    }
    // Ensure UI reflects the loaded state (agent highlighting, progress)
    UI.highlightAgent(window.appState.currentAgent || 'product-owner'); // Default if null
    UI.updateProgress(window.appState.progress_value || 0); // Default if null

  } else {
    console.error('Room module not found');
    // Add welcome message locally if room fails, but it won't be synced
    await UI.addMessage(welcomeMessage, 'ai', 'project-manager');
    UI.highlightAgent(window.appState.currentAgent);
  }

  console.log('Application initialized successfully');
})();