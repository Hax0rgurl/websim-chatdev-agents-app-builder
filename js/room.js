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
    window.appState.conversation.forEach(msg =>
      UI.addMessage(msg.content, msg.role === 'user' ? 'user' : 'ai', msg.agent)
    );
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
    if (window.appState.codeHistory.length > 0) {
      const last = window.appState.codeHistory.length - 1;
      UI.codeEditor.value = window.appState.codeHistory[last].code;
      UI.updatePreview(UI.codeEditor.value);
    }
  }

  // Subscribe to shared state updates
  room.subscribeRoomState(state => {
    if (state.conversation) {
      window.appState.conversation = state.conversation;
      UI.chat.innerHTML = '';
      window.appState.conversation.forEach(msg =>
        UI.addMessage(msg.content, msg.role === 'user' ? 'user' : 'ai', msg.agent)
      );
    }
    if (state.currentAgent) {
      window.appState.currentAgent = state.currentAgent;
      UI.highlightAgent(window.appState.currentAgent);
    }
    if (typeof state.progress_value === 'number') {
      window.appState.progress_value = state.progress_value;
      UI.updateProgress(window.appState.progress_value);
    }
    if (state.codeHistory) {
      window.appState.codeHistory = state.codeHistory;
      CodeVersion.updateCodeHistory();
    }
  });

  // Handle incoming events/messages
  room.onmessage = Messaging.handleMessage;
}

/**
 * Push local project UI state into the shared roomState
 */
function updateProjectState() {
  if (!room) return;
  room.updateRoomState({
    conversation: window.appState.conversation,
    currentAgent: window.appState.currentAgent,
    progress_value: window.appState.progress_value
  });
}

/**
 * Push local code-history into the shared roomState
 */
function updateCodeState() {
  if (!room) return;
  room.updateRoomState({
    codeHistory: window.appState.codeHistory
  });
}

// Export the functions
window.Room = {
  room,
  initializeRoom,
  updateProjectState,
  updateCodeState
};