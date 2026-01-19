// WebsimSocket room management module
let room;

/**
 * Initialize the WebsimSocket room
 * @returns {Promise<void>}
 */
async function initializeRoom() {
  if (!room) {
    room = new WebsimSocket();
  }
  await room.initialize();

  // Load any existing roomState
  const initial = room.roomState || {};
  if (initial.conversation) {
    window.appState.conversation = initial.conversation;
    UI.chat.innerHTML = '';
    window.appState.conversation.forEach(msg => {
      // Ensure agent role is passed correctly
      const role = msg.role === 'user' ? 'user' : 'ai';
      const agent = msg.agent || (role === 'ai' ? 'project-manager' : 'user'); // Default agent if missing
      UI.addMessage(msg.content, role, agent);
    });
  }
  if (initial.currentAgent) {
    window.appState.currentAgent = initial.currentAgent;
    UI.highlightAgent(window.appState.currentAgent);
  }
  if (typeof initial.progress_value === 'number') {
    window.appState.progress_value = initial.progress_value;
    UI.updateProgress(window.appState.progress_value);
  }
  if (initial.codeHistory) {
    window.appState.codeHistory = initial.codeHistory;
    CodeVersion.updateCodeHistory();
    // Update editor/preview only if history is not empty
    if (window.appState.codeHistory.length > 0) {
      const lastRevision = window.appState.codeHistory[window.appState.codeHistory.length - 1];
      UI.codeEditor.value = lastRevision.code;
      UI.updatePreview(lastRevision.code);
    }
  }

  // Subscribe to shared state updates
  room.subscribeRoomState(state => {
    let stateChanged = false;
    // Basic deduplication check: only update if length is different or last message is different
    // This prevents tight loops of identical state updates
    const currentLen = window.appState.conversation.length;
    const newLen = state.conversation ? state.conversation.length : 0;
    
    // Only process update if the new state looks valid and is actually different/newer
    // We assume state only grows or resets (length 0 or 1)
    if (state.conversation && (newLen > currentLen || newLen <= 1)) {
      if (JSON.stringify(state.conversation) !== JSON.stringify(window.appState.conversation)) {
        window.appState.conversation = state.conversation;
        UI.chat.innerHTML = ''; // Clear chat before re-rendering
        
        // Safety: Only render last 50 messages to prevent DOM overload from loops
        const renderStart = Math.max(0, window.appState.conversation.length - 50);
        
        window.appState.conversation.slice(renderStart).forEach(msg => {
          const role = msg.role === 'user' ? 'user' : 'ai';
          const agent = msg.agent || (role === 'ai' ? 'project-manager' : 'user');
          UI.addMessage(msg.content, role, agent);
        });
        stateChanged = true;
      }
    }
    if (state.currentAgent && state.currentAgent !== window.appState.currentAgent) {
      window.appState.currentAgent = state.currentAgent;
      UI.highlightAgent(window.appState.currentAgent);
      stateChanged = true;
    }
    if (typeof state.progress_value === 'number' && state.progress_value !== window.appState.progress_value) {
      window.appState.progress_value = state.progress_value;
      UI.updateProgress(window.appState.progress_value);
      stateChanged = true;
    }
    if (state.codeHistory && JSON.stringify(state.codeHistory) !== JSON.stringify(window.appState.codeHistory)) {
      window.appState.codeHistory = state.codeHistory;
      CodeVersion.updateCodeHistory();
      // Update editor/preview only if history is not empty
      if (window.appState.codeHistory.length > 0) {
        const lastRevision = window.appState.codeHistory[window.appState.codeHistory.length - 1];
        // Only update if editor content differs from the latest history to avoid overwriting user edits
        if (UI.codeEditor.value !== lastRevision.code) {
          UI.codeEditor.value = lastRevision.code;
          UI.updatePreview(lastRevision.code);
        }
      } else {
        // Clear editor if history becomes empty
        UI.codeEditor.value = '';
        UI.updatePreview('');
      }
      stateChanged = true;
    }
    // If state changed due to subscription, reflect it (e.g., potentially stop auto-conversation if another user took over)
    // This part might need more refined logic depending on desired behavior
  });

  // Handle incoming events/messages
  room.onmessage = (event) => {
    // Pass the event directly to the handler
    Messaging.handleMessage(event);
  };
}

/**
 * Push local project UI state into the shared roomState
 * Debounced to avoid excessive updates.
 */
let updateProjectStateTimeout;
function updateProjectState() {
  if (!room) return;
  clearTimeout(updateProjectStateTimeout);
  updateProjectStateTimeout = setTimeout(() => {
    console.log('Updating shared project state:', {
      conversation: window.appState.conversation.length, // Log length for brevity
      currentAgent: window.appState.currentAgent,
      progress_value: window.appState.progress_value
    });
    room.updateRoomState({
      conversation: window.appState.conversation,
      currentAgent: window.appState.currentAgent,
      progress_value: window.appState.progress_value
    });
  }, 500); // Debounce for 500ms
}

/**
 * Push local code-history into the shared roomState
 * Debounced to avoid excessive updates.
 */
let updateCodeStateTimeout;
function updateCodeState() {
  if (!room) return;
  clearTimeout(updateCodeStateTimeout);
  updateCodeStateTimeout = setTimeout(() => {
    console.log('Updating shared code state:', { codeHistoryLength: window.appState.codeHistory.length });
    room.updateRoomState({
      codeHistory: window.appState.codeHistory
    });
  }, 500); // Debounce for 500ms
}

// Make room instance available globally after initialization
window.Room = {
  get room() { return room; }, // Getter to access the initialized room instance
  initializeRoom,
  updateProjectState,
  updateCodeState
};