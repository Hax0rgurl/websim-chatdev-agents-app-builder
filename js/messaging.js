// Message handling module

/**
 * Handle incoming messages
 * @param {Object} event - Message event
 */
function handleMessage(event) {
  if (!event || !event.data) return;

  const data = event.data;

  try {
    if (data.type === 'agent_message') {
      if (data.message) {
        UI.addMessage(data.message, 'ai', window.appState.currentAgent);
      }

      if (data.code) {
        UI.codeEditor.value = data.code;
        UI.updatePreview(data.code);
      }

      if (data.next_agent) {
        window.appState.currentAgent = data.next_agent;
        UI.highlightAgent(window.appState.currentAgent);
      }

      if (typeof data.progress === 'number') {
        UI.updateProgress(data.progress);
      }

      if (window.appState.isAutoConversing && data.continue) {
        clearTimeout(window.appState.autoConversationTimeout);
        window.appState.autoConversationTimeout = setTimeout(() => {
          if (window.appState.isAutoConversing) {
            generateResponse("", true);
          }
        }, 2000);
      }
    } else if (data.type === 'propose_changes') {
      window.appState.pendingChanges = data.changes;
      const votePanel = document.querySelector('.vote-panel');
      const diffPanel = document.querySelector('.code-diff');
      const lastCode = window.appState.codeHistory.length > 0 
        ? window.appState.codeHistory[window.appState.codeHistory.length - 1].code 
        : '';
      diffPanel.innerHTML = CodeVersion.generateDiff(lastCode, window.appState.pendingChanges.code);
      votePanel.classList.add('active');
    } else if (data.type === 'vote') {
      window.appState.votes[data.voter] = data.approved;
      CodeVersion.checkVotes();
      CodeVersion.updateVotingStatus();
    }
  } catch (error) {
    console.error('Error handling message:', error);
  }
}

/**
 * Generate a response from AI
 * @param {string} userMessage - User message
 * @param {boolean} isAuto - Auto-generate flag
 * @returns {Promise<void>}
 */
async function generateResponse(userMessage, isAuto = false) {
  UI.thinking.style.display = 'block';
  UI.updateProgress(0);

  try {
    // Build a system prompt instructing agents and JSON output
    const systemPrompt = `You are a collaborative team of AI development agents working together to build Websim-specific projects.
Each agent has a role and responsibilities (e.g., project-manager, product-owner, lead-developer, developer, code-reviewer, QA-engineer, designer, devops).
Your responses must use only Websim APIs as documented, and output exactly one JSON object with keys:
{
  "reply": "text response",
  "code": "HTML/CSS/JS code if any",
  "next_agent": "role-of-next-agent",
  "progress": number-between-0-and-100,
  "continue": true-or-false
}`;

    // Prepare message history for LLM
    const historyMessages = window.appState.conversation.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
    const messages = [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      ...(userMessage ? [{ role: 'user', content: userMessage }] : [])
    ];

    // Call the Websim LLM API, request JSON output
    const completion = await websim.chat.completions.create({ messages, json: true });
    const responseText = (completion.content || '').trim();
    // attempt to parse JSON, but fallback to raw text if parsing fails
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.warn('Received non-JSON response from AI, using raw text reply', e);
      data = {
        reply: responseText,
        code: '',
        next_agent: window.appState.currentAgent,
        progress: window.appState.progress_value,
        continue: false
      };
    }

    // Ensure defaults
    data.reply = data.reply || '';
    data.code = data.code || '';
    data.next_agent = data.next_agent || window.appState.currentAgent;
    data.progress = typeof data.progress === 'number' ? data.progress : window.appState.progress_value;
    data.continue = !!data.continue;

    // Display AI text reply
    await UI.addMessage(data.reply, 'ai', window.appState.currentAgent);

    // If code snippet is provided, show it in chat
    if (data.code) {
      UI.addCodeSnippet(data.code);
      UI.codeEditor.value = data.code;
      UI.updatePreview(data.code);
    }

    // Advance to next agent
    window.appState.currentAgent = data.next_agent;
    UI.highlightAgent(window.appState.currentAgent);

    // Update progress bar
    UI.updateProgress(data.progress);

    // If auto-conversing, schedule next turn
    if (window.appState.isAutoConversing && data.continue) {
      clearTimeout(window.appState.autoConversationTimeout);
      window.appState.autoConversationTimeout = setTimeout(() => {
        if (window.appState.isAutoConversing) {
          generateResponse('', true);
        }
      }, 2000);
    }

    // Broadcast to other clients
    if (window.Room.room) {
      window.Room.room.send({
        type: 'agent_message',
        message: data.reply,
        code: data.code,
        next_agent: data.next_agent,
        progress: data.progress,
        continue: data.continue
      });
    }
  } catch (error) {
    console.error('Error generating response:', error);
    // Let the user know something went wrong
    await UI.addMessage("An error occurred while contacting the AI. Please try again later.", 'ai', 'project-manager');
  } finally {
    UI.thinking.style.display = 'none';
  }
}

// Export the functions
window.Messaging = {
  handleMessage,
  generateResponse
};