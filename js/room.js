// WebsimSocket room management module
let room;

/**
 * Initialize the WebsimSocket room
 * @returns {Promise<void>}
 */
async function initializeRoom() {
  try {
    await room.initialize();

    // Load existing state from the store
    try {
      const state = await room.store.get('project_state');
      if (state) {
        window.appState.conversation = state.conversation || [];
        window.appState.currentAgent = state.currentAgent || 'product-owner';
        window.appState.progress_value = state.progress_value || 0;
        UI.highlightAgent(window.appState.currentAgent);
        UI.updateProgress(window.appState.progress_value);
      }
    } catch (error) {
      console.error('Error loading project state:', error);
    }

    try {
      const codeState = await room.store.get('code_state');
      if (codeState && codeState.codeHistory) {
        window.appState.codeHistory = codeState.codeHistory;
        CodeVersion.updateCodeHistory();
        if (window.appState.codeHistory.length > 0) {
          UI.codeEditor.value = window.appState.codeHistory[window.appState.codeHistory.length - 1].code;
          UI.updatePreview(UI.codeEditor.value);
        }
      }
    } catch (error) {
      console.error('Error loading code state:', error);
    }

    // Setup synchronization between clients
    room.onRecordChanged = async (id) => {
      if (id === 'project_state') {
        try {
          const state = await room.store.get('project_state');
          if (state) {
            window.appState.conversation = state.conversation || [];
            window.appState.currentAgent = state.currentAgent || 'product-owner';
            window.appState.progress_value = state.progress_value || 0;
            UI.highlightAgent(window.appState.currentAgent);
            UI.updateProgress(window.appState.progress_value);
          }
        } catch (error) {
          console.error('Error updating from project state:', error);
        }
      }

      if (id === 'code_state') {
        try {
          const state = await room.store.get('code_state');
          if (state && state.codeHistory) {
            window.appState.codeHistory = state.codeHistory;
            CodeVersion.updateCodeHistory();
            if (window.appState.codeHistory.length > 0) {
              UI.codeEditor.value = window.appState.codeHistory[window.appState.codeHistory.length - 1].code;
              UI.updatePreview(UI.codeEditor.value);
            }
          }
        } catch (error) {
          console.error('Error updating from code state:', error);
        }
      }
    };

    // Define unified message handler
    room.onmessage = Messaging.handleMessage;

  } catch (error) {
    console.error('Failed to initialize room:', error);
  }
}

/**
 * Updates the project state in the room storage
 * @param {Object} state - State to update
 * @returns {Promise<void>}
 */
async function updateProjectState() {
  if (!room) return;
  
  try {
    await room.store.update({
      id: 'project_state',
      dependencies: { 
        conversation: window.appState.conversation, 
        currentAgent: window.appState.currentAgent, 
        progress_value: window.appState.progress_value 
      },
      updateFunction: (state) => ({ 
        conversation: window.appState.conversation, 
        currentAgent: window.appState.currentAgent, 
        progress_value: window.appState.progress_value 
      })
    });
  } catch (error) {
    console.error('Error updating project state:', error);
  }
}

/**
 * Updates the code state in the room storage
 * @returns {Promise<void>}
 */
async function updateCodeState() {
  if (!room) return;
  
  try {
    await room.store.update({
      id: 'code_state',
      dependencies: { codeHistory: window.appState.codeHistory },
      updateFunction: (state) => ({ ...(state || {}), codeHistory: window.appState.codeHistory })
    });
  } catch (error) {
    console.error('Error updating code state:', error);
  }
}

// Initialize WebsimSocket with proper error handling
try {
  room = new WebsimSocket();
} catch (error) {
  console.error('Failed to initialize WebsimSocket:', error);
}

// Export the functions
window.Room = {
  room,
  initializeRoom,
  updateProjectState,
  updateCodeState
};