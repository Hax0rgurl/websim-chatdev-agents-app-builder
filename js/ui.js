// UI-related functions module

/**
 * Update the progress bar
 * @param {number} value - Progress value (0-100)
 */
function updateProgress(value) {
  const progress = document.querySelector('.progress');
  if (progress) {
    progress.style.width = `${value}%`;
    window.appState.progress_value = value;
  }
}

/**
 * Highlight the active agent
 * @param {string} role - Agent role
 */
function highlightAgent(role) {
  if (!role) return;

  const agents = document.querySelectorAll('.agent');
  agents.forEach(a => a.classList.remove('active'));

  const safeRole = role.replace(/[^a-zA-Z0-9-_]/g, '');
  const agent = document.querySelector(`[data-role="${safeRole}"]`);
  if (agent) {
    agent.classList.add('active');
  }
}

/**
 * Get the agent name by role
 * @param {string} role - Agent role
 * @returns {string} Agent name
 */
function getAgentName(role) {
  if (!role) return 'Unknown Agent';

  // Sanitize role for selector to prevent syntax errors
  const safeRole = role.replace(/[^a-zA-Z0-9-_]/g, '');
  const agent = document.querySelector(`[data-role="${safeRole}"]`);
  return agent ? agent.querySelector('.agent-name').textContent : 'Unknown Agent';
}

/**
 * Get the agent avatar by role
 * @param {string} role - Agent role
 * @returns {string} HTML of the agent avatar
 */
function getAgentAvatar(role) {
  if (!role) return '';

  const agent = document.querySelector(`[data-role="${role}"]`);
  if (!agent) return '';
  
  const avatar = agent.querySelector('.agent-avatar');
  return avatar ? avatar.innerHTML : '';
}

/**
 * Add message to the chat
 * @param {string} text - Message text
 * @param {string} sender - Sender ('user' or 'ai')
 * @param {string | null} agentRole - Agent role if sender is 'ai'
 * @param {string | null} imageUrl - Optional image URL
 * @returns {Promise<void>} - Returns void, but marked async for potential future use
 */
async function addMessage(text, sender = 'user', agentRole = null, imageUrl = null) {
  if (!text && !imageUrl) return;
  
  const chat = document.getElementById('chat');
  if (!chat) {
    console.error('Chat container not found');
    return;
  }

  const p = document.createElement('p');
  p.className = sender; // 'user' or 'ai'

  // Add agent tag only if sender is 'ai' and role is provided
  if (sender === 'ai' && agentRole) {
    const agentTag = document.createElement('div');
    agentTag.className = 'agent-tag';

    // Add avatar mini version
    const avatarMini = document.createElement('div');
    // Use a class for styling the mini avatar
    avatarMini.className = 'agent-avatar-mini'; 
    avatarMini.innerHTML = getAgentAvatar(agentRole);
    agentTag.appendChild(avatarMini);

    const agentName = document.createElement('span');
    agentName.textContent = getAgentName(agentRole);
    agentTag.appendChild(agentName);

    p.appendChild(agentTag);
  } else if (sender === 'user') {
     // Optionally add a "User" tag or avatar for user messages
     // For consistency, let's add a simple tag
     const userTag = document.createElement('div');
     userTag.className = 'user-tag'; // Add CSS for this
     userTag.textContent = 'You';
     p.appendChild(userTag);
  }

  if (text) {
    const messageText = document.createElement('div');
    messageText.className = 'message-content';
    messageText.textContent = text;
    p.appendChild(messageText);
  }

  if (imageUrl) {
    const img = document.createElement('img');
    img.src = imageUrl;
    img.className = 'message-image';
    img.alt = "Generated asset";
    p.appendChild(img);
  }

  // Append the complete message block to chat
  chat.appendChild(p);
  // Ensure chat scrolls to the bottom
  setTimeout(() => {
    chat.scrollTop = chat.scrollHeight;
  }, 10);

  // *** Defer state update to avoid duplicate entries ***
  // The state update (window.appState.conversation.push) should happen
  // *before* calling addMessage or be handled centrally where the message
  // originates (like in generateResponse or the user input handler)
  // to prevent double-adding when receiving messages via WebsimSocket.

  // Removed state update and broadcast from here.
  // It's now handled in the calling functions (generateResponse, main.js listener)
  // and synchronized via Room.updateProjectState()
}

/**
 * Update the code preview
 * @param {string} code - HTML code
 */
function updatePreview(code) {
  try {
    const previewFrame = document.getElementById('preview');
    if (!previewFrame) {
      console.error('Preview frame not found');
      return;
    }

    const doc = previewFrame.contentDocument;
    doc.open();
    // Inject base style for preview to look decent even if empty
    const baseStyle = '<style>body{font-family:sans-serif;margin:0;padding:20px;color:#333}</style>';
    // If the code doesn't start with <html>, inject basic structure
    if (!code.trim().startsWith('<html') && !code.trim().startsWith('<!DOCTYPE')) {
       doc.write(baseStyle + code);
    } else {
       doc.write(code);
    }
    doc.close();
  } catch (error) {
    console.error('Error updating preview:', error);
  }
}

/**
 * Get UI element references
 * @returns {Object} Object containing UI element references
 */
function getUIElements() {
  return {
    chat: document.getElementById('chat'),
    thinking: document.querySelector('.thinking'),
    progress: document.querySelector('.progress'),
    promptInput: document.getElementById('prompt'),
    codeEditor: document.getElementById('code-editor'),
    previewFrame: document.getElementById('preview'),
    proposeBtn: document.getElementById('proposeBtn'),
    viewHistoryBtn: document.getElementById('viewHistoryBtn'),
    approveBtn: document.querySelector('.approve-btn'),
    rejectBtn: document.querySelector('.reject-btn'),
    codeHistoryDiv: document.querySelector('.code-history'),
    toggleApiDocsBtn: document.getElementById('toggleApiDocs')
  };
}

// Export the functions
window.UI = {
  updateProgress,
  highlightAgent,
  getAgentName,
  getAgentAvatar,
  addMessage,
  updatePreview,
  getUIElements,
  // Convenience accessor for commonly used elements
  get codeEditor() { return document.getElementById('code-editor'); },
  get chat() { return document.getElementById('chat'); },
  // Accessor for the thinking indicator element
  get thinking() { return document.querySelector('.thinking'); }
};