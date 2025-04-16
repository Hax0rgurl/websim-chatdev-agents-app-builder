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
  window.Logger.log('UI.updateProgress', value);
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
  window.Logger.log('UI.highlightAgent', role);
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
 * @param {string} sender - Sender (user or ai)
 * @param {string} agentRole - Agent role
 * @returns {Promise<void>}
 */
async function addMessage(text, sender = 'user', agentRole = null) {
  window.Logger.log('UI.addMessage', { text, sender, agentRole });
  if (!text) return;

  const p = document.createElement('p');
  p.className = sender;

  if (sender === 'ai' && agentRole) {
    const agentTag = document.createElement('div');
    agentTag.className = 'agent-tag';
    
    // Add avatar mini version
    const avatarMini = document.createElement('div');
    avatarMini.className = 'agent-avatar-mini';
    avatarMini.innerHTML = getAgentAvatar(agentRole);
    agentTag.appendChild(avatarMini);
    
    const agentName = document.createElement('span');
    agentName.textContent = getAgentName(agentRole);
    agentTag.appendChild(agentName);
    
    p.appendChild(agentTag);
  }

  const messageText = document.createElement('div');
  messageText.textContent = text;
  p.appendChild(messageText);

  chat.appendChild(p);
  chat.scrollTop = chat.scrollHeight;

  window.appState.conversation.push({
    role: sender === 'user' ? 'user' : 'assistant',
    content: text,
    agent: sender === 'user' ? 'user' : agentRole
  });

  if (sender === 'user' && window.Room.room) {
    try {
      window.Room.room.send({
        type: 'user_message',
        message: text,
        conversation: window.appState.conversation
      });
    } catch (error) {
      console.error('Error sending user message:', error);
    }
  }

  if (window.Room.room) {
    await window.Room.updateProjectState();
  }
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

/**
 * Append a code snippet to the chat area
 * @param {string} code - Code to display
 */
function addCodeSnippet(code) {
  window.Logger.log('UI.addCodeSnippet', code);
  if (!code) return;
  const pre = document.createElement('pre');
  const codeEl = document.createElement('code');
  codeEl.textContent = code;
  pre.appendChild(codeEl);
  chat.appendChild(pre);
  chat.scrollTop = chat.scrollHeight;
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
  addCodeSnippet,
  updatePreview
};