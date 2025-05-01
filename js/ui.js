// UI-related functions module

// Get DOM elements
const chat = document.getElementById('chat');
const thinking = document.querySelector('.thinking');
const progress = document.querySelector('.progress');
const promptInput = document.getElementById('prompt');
const codeEditor = document.getElementById('code-editor');
const previewFrame = document.getElementById('preview');
const proposeBtn = document.getElementById('proposeBtn');
const viewHistoryBtn = document.getElementById('viewHistoryBtn');
const approveBtn = document.querySelector('.approve-btn');
const rejectBtn = document.querySelector('.reject-btn');
const codeHistoryDiv = document.querySelector('.code-history');
const toggleApiDocsBtn = document.getElementById('toggleApiDocs');

/**
 * Update the progress bar
 * @param {number} value - Progress value (0-100)
 */
function updateProgress(value) {
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
  if (!role) {
    console.warn('No role specified for highlighting agent');
    return;
  }

  const agents = document.querySelectorAll('.agent');
  agents.forEach(a => a.classList.remove('active'));

  const agent = document.querySelector(`[data-role="${role}"]`);
  if (agent) {
    agent.classList.add('active');
  } else {
    console.warn(`Agent with role "${role}" not found`);
  }
}

/**
 * Get the agent name by role
 * @param {string} role - Agent role
 * @returns {string} Agent name
 */
function getAgentName(role) {
  if (!role) return 'Unknown Agent';

  const agent = document.querySelector(`[data-role="${role}"]`);
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
 * @returns {Promise<void>} - Returns void, but marked async for potential future use
 */
async function addMessage(text, sender = 'user', agentRole = null) {
  if (!text) return;

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


  const messageText = document.createElement('div');
  // Basic sanitization or markdown rendering could happen here
  messageText.textContent = text;
  p.appendChild(messageText);

  // Append the complete message block to chat
  chat.appendChild(p);
  // Ensure chat scrolls to the bottom
  chat.scrollTop = chat.scrollHeight;

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
    const doc = previewFrame.contentDocument;
    doc.open();
    doc.write(code);
    doc.close();
  } catch (error) {
    console.error('Error updating preview:', error);
  }
}

// Export the functions
window.UI = {
  chat,
  thinking,
  progress,
  promptInput,
  codeEditor,
  previewFrame,
  proposeBtn,
  viewHistoryBtn,
  approveBtn,
  rejectBtn,
  codeHistoryDiv,
  toggleApiDocsBtn,
  updateProgress,
  highlightAgent,
  getAgentName,
  getAgentAvatar,
  addMessage,
  updatePreview
};