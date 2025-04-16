// Code versioning and voting system module

/**
 * Propose changes to the code
 */
function proposeChanges() {
  const currentCode = window.UI.codeEditor.value;
  if (!currentCode.trim()) return;

  const lastCode = window.appState.codeHistory.length > 0 
    ? window.appState.codeHistory[window.appState.codeHistory.length - 1].code 
    : '';

  window.appState.pendingChanges = {
    code: currentCode,
    proposedBy: window.appState.currentAgent,
    timestamp: Date.now()
  };

  const votePanel = document.querySelector('.vote-panel');
  const diffPanel = document.querySelector('.code-diff');
  diffPanel.innerHTML = generateDiff(lastCode, currentCode);
  votePanel.classList.add('active');

  if (window.Room.room) {
    window.Room.room.send({
      type: 'propose_changes',
      changes: window.appState.pendingChanges
    });
  }
}

/**
 * Generate a diff display between two code versions
 * @param {string} oldCode - Old code
 * @param {string} newCode - New code
 * @returns {string} HTML diff representation
 */
function generateDiff(oldCode, newCode) {
  if (!oldCode) return `<div class="added">${newCode}</div>`;
  return `<div class="removed">${oldCode}</div><div class="added">${newCode}</div>`;
}

/**
 * Vote on pending changes
 * @param {boolean} approved - Is approved
 */
function vote(approved) {
  if (!window.appState.pendingChanges || !window.Room.room) return;

  const username = window.Room.room.clientId;
  if (!username) return;

  window.appState.votes[username] = approved;

  if (window.Room.room) {
    window.Room.room.send({
      type: 'vote',
      approved,
      voter: username
    });
  }

  checkVotes();
  updateVotingStatus();
}

/**
 * Check if votes are sufficient to accept/reject changes
 */
function checkVotes() {
  if (!window.Room.room || !window.appState.pendingChanges) return;

  const agents = Object.keys(window.Room.room.peers || {}).length || 1; // Minimum 1 user
  const totalVotesNeeded = Math.max(1, agents);
  const approvals = Object.values(window.appState.votes).filter(v => v).length;
  const rejections = Object.values(window.appState.votes).filter(v => !v).length;

  const lastCode = window.appState.codeHistory.length > 0 
    ? window.appState.codeHistory[window.appState.codeHistory.length - 1].code 
    : '';
  const isDeletion = window.appState.pendingChanges && lastCode && window.appState.pendingChanges.code.length < lastCode.length * 0.5;

  if (isDeletion) {
    // Major deletions require unanimous approval
    if (approvals === totalVotesNeeded) {
      acceptChanges();
    } else if (rejections > 0) {
      rejectChanges();
    }
  } else {
    // Regular changes need majority
    const requiredVotes = Math.ceil(agents * 0.5);
    if (approvals >= requiredVotes) {
      acceptChanges();
    } else if (rejections >= requiredVotes) {
      rejectChanges();
    }
  }
}

/**
 * Update the voting status display
 */
function updateVotingStatus() {
  const votePanel = document.querySelector('.vote-panel');
  let statusDiv = votePanel.querySelector('.voting-status');

  if (!statusDiv) {
    statusDiv = document.createElement('div');
    statusDiv.className = 'voting-status';
    votePanel.insertBefore(statusDiv, votePanel.querySelector('.vote-buttons'));
  }

  const totalAgents = Object.keys(window.Room.room?.peers || {}).length || 1;
  const currentVotes = Object.keys(window.appState.votes).length;
  statusDiv.textContent = `Votes: ${currentVotes}/${totalAgents} needed`;
}

/**
 * Accept pending changes
 */
function acceptChanges() {
  if (!window.appState.pendingChanges) return;

  window.appState.codeHistory.push(window.appState.pendingChanges);
  updateCodeHistory();
  window.appState.pendingChanges = null;
  window.appState.votes = {};
  document.querySelector('.vote-panel').classList.remove('active');

  window.Room.updateCodeState();
}

/**
 * Reject pending changes
 */
function rejectChanges() {
  window.appState.pendingChanges = null;
  window.appState.votes = {};
  document.querySelector('.vote-panel').classList.remove('active');

  if (window.appState.codeHistory.length > 0) {
    window.UI.codeEditor.value = window.appState.codeHistory[window.appState.codeHistory.length - 1].code;
    window.UI.updatePreview(window.UI.codeEditor.value);
  }
}

/**
 * Update the code history display
 */
function updateCodeHistory() {
  const historyDiv = document.querySelector('.code-history');
  historyDiv.innerHTML = window.appState.codeHistory.map((revision, i) => 
    `<div class="revision" data-index="${i}">Revision ${i+1} by ${revision.proposedBy} (${new Date(revision.timestamp).toLocaleString()})</div>`
  ).join('');
}

// Export the functions
window.CodeVersion = {
  proposeChanges,
  generateDiff,
  vote,
  checkVotes,
  updateVotingStatus,
  acceptChanges,
  rejectChanges,
  updateCodeHistory
};