// WebsimSocket room management module
// Keep 'room' scoped within the module
let roomInstance = null;

/**
 * Initialize the WebsimSocket room
 * @returns {Promise<void>}
 */
async function initializeRoom() {
  if (!roomInstance) {
    roomInstance = new WebsimSocket();
    console.log('WebsimSocket instance created.'); // Added log
  } else {
    console.log('WebsimSocket instance already exists.'); // Added log
  }

  try {
    // Initialize connection and fetch initial state
    await roomInstance.initialize();
    console.log('WebsimSocket initialized. Client ID:', roomInstance.clientId); // Added log
    console.log('Initial Peers:', roomInstance.peers); // Added log
    console.log('Initial Room State:', roomInstance.roomState); // Added log
    console.log('Initial Presence:', roomInstance.presence); // Added log


    // --- Load Initial State ---
    const initial = roomInstance.roomState || {};

    // Use || [] and || {} for safety against null/undefined state parts
    window.appState.conversation = initial.conversation || [];
    window.appState.currentAgent = initial.currentAgent || 'product-owner'; // Default agent
    window.appState.progress_value = typeof initial.progress_value === 'number' ? initial.progress_value : 0;
    window.appState.codeHistory = initial.codeHistory || [];
    window.appState.pendingChanges = initial.pendingChanges || null; // Load pending changes too
    window.appState.votes = initial.votes || {}; // Load existing votes

    // --- Apply Initial State to UI ---
    UI.chat.innerHTML = ''; // Clear chat before repopulating
    window.appState.conversation.forEach(msg => {
        // Render messages carefully, distinguishing user roles if possible
        const senderType = msg.role === 'user' ? 'user' : 'ai';
        const agentRole = senderType === 'ai' ? msg.agent : null;
        UI.addMessage(msg.content, senderType, agentRole); // Let addMessage handle formatting
    });

    UI.highlightAgent(window.appState.currentAgent);
    UI.updateProgress(window.appState.progress_value);

    if (window.appState.codeHistory.length > 0) {
        const lastRevision = window.appState.codeHistory[window.appState.codeHistory.length - 1];
        UI.codeEditor.value = lastRevision.code;
        UI.updatePreview(lastRevision.code);
    }
    CodeVersion.updateCodeHistory(); // Update the history list display


    // Restore voting panel if there are pending changes
    if (window.appState.pendingChanges) {
        const votePanel = document.querySelector('.vote-panel');
        const diffPanel = document.querySelector('.code-diff');
        const lastCode = window.appState.codeHistory.length > 0
            ? window.appState.codeHistory[window.appState.codeHistory.length - 1].code
            : '';
        diffPanel.innerHTML = CodeVersion.generateDiff(lastCode, window.appState.pendingChanges.code);
        votePanel.classList.add('active');
        CodeVersion.updateVotingStatus(); // Show current votes
    }


    // --- Subscribe to Updates ---

    // Subscribe to Room State changes
    roomInstance.subscribeRoomState(state => {
      // console.log('Received roomState update:', state); // Added log
      // More granular updates might be better than full re-renders

      if (state.conversation && JSON.stringify(state.conversation) !== JSON.stringify(window.appState.conversation)) {
        window.appState.conversation = state.conversation;
        // Full refresh - could be optimized later if needed
        UI.chat.innerHTML = '';
        window.appState.conversation.forEach(msg =>
          UI.addMessage(msg.content, msg.role === 'user' ? 'user' : 'ai', msg.agent)
        );
      }
      if (state.currentAgent && state.currentAgent !== window.appState.currentAgent) {
        window.appState.currentAgent = state.currentAgent;
        UI.highlightAgent(window.appState.currentAgent);
      }
      if (typeof state.progress_value === 'number' && state.progress_value !== window.appState.progress_value) {
        window.appState.progress_value = state.progress_value;
        UI.updateProgress(window.appState.progress_value);
      }
      if (state.codeHistory && JSON.stringify(state.codeHistory) !== JSON.stringify(window.appState.codeHistory)) {
        window.appState.codeHistory = state.codeHistory;
        CodeVersion.updateCodeHistory();
        // Potentially update editor if history changed externally? This could be disruptive.
        // For now, let local edits take precedence unless a proposal is accepted.
      }
       if (state.pendingChanges !== undefined && JSON.stringify(state.pendingChanges) !== JSON.stringify(window.appState.pendingChanges)) {
           window.appState.pendingChanges = state.pendingChanges;
           // Update UI based on whether changes are pending or cleared
            const votePanel = document.querySelector('.vote-panel');
           if (window.appState.pendingChanges) {
                const diffPanel = document.querySelector('.code-diff');
                const lastCode = window.appState.codeHistory.length > 0
                    ? window.appState.codeHistory[window.appState.codeHistory.length - 1].code
                    : '';
                diffPanel.innerHTML = CodeVersion.generateDiff(lastCode, window.appState.pendingChanges.code);
                votePanel.classList.add('active');
           } else {
                votePanel.classList.remove('active');
           }
       }
        if (state.votes && JSON.stringify(state.votes) !== JSON.stringify(window.appState.votes)) {
            window.appState.votes = state.votes;
            if(window.appState.pendingChanges){ // Only update status if panel should be visible
               CodeVersion.updateVotingStatus();
            }
       }

    });

    // Subscribe to Presence updates (e.g., users joining/leaving)
    // This is useful for the voting mechanism that depends on peer count
    roomInstance.subscribePresence(() => {
        // console.log('Presence updated:', roomInstance.presence); // Added log
        // console.log('Peers updated:', roomInstance.peers); // Added log
        // Re-check votes if presence changed and there's a pending proposal
        if (window.appState.pendingChanges) {
            CodeVersion.checkVotes();
            CodeVersion.updateVotingStatus();
        }
    });


    // Set the message handler for events
    roomInstance.onmessage = Messaging.handleMessage;
    console.log('Room message handler assigned.'); // Added log

  } catch (error) {
    console.error("Error initializing WebsimSocket room:", error);
    // Optionally display an error to the user
    UI.addMessage("Error connecting to the collaboration service. Please refresh.", 'ai', 'project-manager');
  }
}

/**
 * Push local *relevant* app state into the shared roomState.
 * Be selective to avoid overwriting state unnecessarily or causing loops.
 */
async function updateProjectState() {
  if (!roomInstance) {
    console.warn('updateProjectState called before room initialized.'); // Added warning
    return;
  }
  try {
     // console.log('Updating project state in room:', window.appState); // Added log
    // Only send necessary state parts, avoid sending codeHistory unless explicitly changed by an action
    await roomInstance.updateRoomState({
      conversation: window.appState.conversation,
      currentAgent: window.appState.currentAgent,
      progress_value: window.appState.progress_value,
      // pendingChanges: window.appState.pendingChanges, // Managed by propose/accept/reject flow
      // votes: window.appState.votes // Managed by voting flow
    });
    // console.log('Project state updated successfully.'); // Added log
  } catch (error) {
      console.error("Error updating project state:", error);
  }
}

/**
 * Push local code-related state (history, pending changes, votes) into the shared roomState.
 * Typically called after accepting/rejecting changes or proposing them.
 */
async function updateCodeState() {
  if (!roomInstance) {
     console.warn('updateCodeState called before room initialized.'); // Added warning
     return;
  }
  try {
    // console.log('Updating code state in room:', window.appState); // Added log
    await roomInstance.updateRoomState({
      codeHistory: window.appState.codeHistory,
      pendingChanges: window.appState.pendingChanges, // Ensure cleared/set correctly
      votes: window.appState.votes // Ensure cleared/set correctly
      // Might need to sync other states if they depend on code changes?
    });
     // console.log('Code state updated successfully.'); // Added log
  } catch (error) {
     console.error("Error updating code state:", error);
  }
}

// Expose the initialized room instance and functions
// Avoid exposing the raw 'room' variable directly if possible
window.Room = {
  get room() { return roomInstance; }, // Getter for controlled access
  initializeRoom,
  updateProjectState,
  updateCodeState
};