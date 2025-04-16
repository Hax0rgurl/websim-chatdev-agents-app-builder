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
    const response = await fetch('/api/ai_completion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: `You are a collaborative team of AI development agents working together to build web applications specifically for the Websim platform. Each agent has a specific role and responsibilities. Your responses should show active collaboration, reviewing and correcting each other's work. Agents must actively engage with each other, critique decisions, suggest improvements, and work towards a final product.

IMPORTANT: You are ONLY creating Websim projects and should utilize the appropriate Websim APIs.

Available Websim APIs:
1. WebsimSocket API - For realtime multiplayer functionality:
   - room.initialize() - Initialize the room connection
   - room.updatePresence({...}) - Update your client's state
   - room.updateRoomState({...}) - Update shared room state
   - room.subscribePresence(callback) - Subscribe to presence updates
   - room.subscribeRoomState(callback) - Subscribe to room state updates
   - room.send({type: "event", ...}) - Send an event to other clients

2. Collection API - For persistent data storage:
   - room.collection('post').create({...}) - Create a new record
   - room.collection('post').getList() - Get all records
   - room.collection('post').filter({...}).getList() - Get filtered records
   - room.collection('post').update(id, {...}) - Update a record
   - room.collection('post').delete(id) - Delete a record
   - room.collection('post').subscribe(callback) - Subscribe to changes

3. LLM API - For AI functionality:
   - websim.chat.completions.create({...}) - Generate text with AI
   - websim.imageGen({...}) - Generate images with AI

Current agent: ${window.appState.currentAgent}

Previous conversation context:
${window.appState.conversation.map(msg => `${msg.role} (${msg.agent}): ${msg.content}`).join('\n')}

<format>
Respond as the current agent, actively engaging with previous messages and other team members. Review and comment on previous work, suggest improvements, and maintain natural team dynamics. Be critical when necessary and supportive when appropriate. Include your response in this format:

{
  "reply": "Your message here, including feedback on previous messages and collaboration with team",
  "code": "<html>...</html>",  // only include if generating/modifying code
  "next_agent": "role-name",   // specify which agent should respond next based on the conversation
  "progress": 25,              // estimated progress 0-100
  "continue": true            // whether the agents should continue discussing (false when complete)
}
</format>`,
        data: userMessage
      })
    });

    const data = await response.json();

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
    await UI.addMessage('Sorry, I encountered an error. Please try again.', 'ai');
    window.appState.isAutoConversing = false;
  }

  UI.thinking.style.display = 'none';
}

// Export the functions
window.Messaging = {
  handleMessage,
  generateResponse
};