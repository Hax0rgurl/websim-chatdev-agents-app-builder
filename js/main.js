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

// Event listener for the generate button
function setupGenerateButtonListener() {
  const generateBtn = document.getElementById('generateBtn');
  if (generateBtn) {
    generateBtn.addEventListener('click', async function() {
      const promptInput = document.getElementById('prompt');
      if (!promptInput) return;

      const promptText = promptInput.value.trim();
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
      await window.UI.addMessage(promptText, 'user'); // Pass 'user' explicitly
      
      // Ensure the team starts working autonomously
      window.appState.isAutoConversing = true;
      promptInput.value = '';

      // Update shared state immediately after user message
      await window.Room.updateProjectState();

      // Trigger AI response generation
      await window.Messaging.generateResponse(promptText, true);
    });
  }
}

// Event listener for the prompt input
function setupPromptInputListener() {
  const promptInput = document.getElementById('prompt');
  if (promptInput) {
    promptInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const generateBtn = document.getElementById('generateBtn');
        if (generateBtn) generateBtn.click();
      }
    });
  }
}

// Event listener for the code editor
function setupCodeEditorListener() {
  const codeEditor = document.getElementById('code-editor');
  if (codeEditor) {
    codeEditor.addEventListener('input', function() {
      window.UI.updatePreview(this.value);
    });
  }
}

// Initialize all event listeners
function setupEventListeners() {
  // Set up main interaction listeners
  setupGenerateButtonListener();
  setupPromptInputListener();
  setupCodeEditorListener();
  
  // The component-specific listeners are now handled in components.js
  // via the attachEventListeners function after dynamic component loading
}

// Initialize the application
async function init() {
  console.log('Initializing application...');

  // Define initial message locally
  const welcomeMessage =
    "Welcome to the Websim Development Team! Our agents specialize in creating " +
    "Websim-specific projects using the available APIs. Check the 'Show API Documentation' " +
    "button for details. Please describe what you'd like to build.";

  // Add event listeners after DOM is loaded and components are ready
  // This is now handled by components.js, but we setup app-level listeners here
  setupEventListeners();

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
      await window.UI.addMessage(welcomeMessage, 'ai', 'project-manager');
      // Sync the initial state if we added the welcome message
      await window.Room.updateProjectState(); 
    }
    // Ensure UI reflects the loaded state (agent highlighting, progress)
    window.UI.highlightAgent(window.appState.currentAgent || 'product-owner'); // Default if null
    window.UI.updateProgress(window.appState.progress_value || 0); // Default if null

  } else {
    console.error('Room module not found');
    // Add welcome message locally if room fails, but it won't be synced
    await window.UI.addMessage(welcomeMessage, 'ai', 'project-manager');
    window.UI.highlightAgent(window.appState.currentAgent);
  }

  console.log('Application initialized successfully');
}

// Initialize the application once the DOM is fully loaded
document.addEventListener('DOMContentLoaded', init);

// Export functions for external use if needed
window.App = {
  init,
  setupEventListeners
};