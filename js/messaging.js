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
    // Get API documentation content
    const apiDocsElement = document.getElementById('apiDocsContent');
    const apiDocsText = apiDocsElement ? apiDocsElement.innerText : 'API Documentation not available.';

    // Build a system prompt instructing agents and JSON output
    const systemPrompt = `You are a collaborative team of AI development agents working together to build Websim-specific projects.
Each agent has a role and responsibilities (e.g., project-manager, product-owner, lead-developer, developer, code-reviewer, QA-engineer, designer, devops).
Your goal is to understand the user's request and generate code (HTML, CSS, JS) or provide guidance using ONLY the available Websim APIs detailed below.
Focus on using WebsimSocket for real-time features, Collections for persistent data, and LLM/ImageGen/TTS for AI capabilities (including using image URLs in prompts).

AVAILABLE WEBSIM APIs:
--- START API DOCS ---
${apiDocsText}
--- END API DOCS ---

When responding:
1.  Acknowledge the current step and what you are doing based on your role.
2.  If generating code, ensure it uses the documented APIs correctly. Incorporate generated images or TTS audio where appropriate if requested.
3.  If unsure, ask clarifying questions.
4.  Determine which agent should handle the next step.
5.  Update the progress percentage based on task completion estimation.
6.  Decide if the conversation should continue automatically (e.g., if more steps are needed).

Your response MUST be a single JSON object containing the following keys, and nothing else:
{
  "reply": "Your text response as the current agent.",
  "code": "HTML/CSS/JS code snippet if generated, otherwise null or empty string.",
  "next_agent": "role-of-the-agent-for-the-next-step",
  "progress": number, // An integer from 0 to 100 representing overall project progress.
  "continue": boolean // Set to true if the team should continue working automatically, false otherwise.
}`;

    // Prepare message history for LLM
    const historyMessages = window.appState.conversation.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant', // Ensure correct roles
      content: `(${msg.agent || 'user'}): ${msg.content}` // Add agent context to history
    }));

    // Construct the final messages array
    const messages = [
      { role: 'system', content: systemPrompt },
      ...historyMessages.slice(-10), // Limit history to last 10 messages
      ...(userMessage ? [{ role: 'user', content: `(user): ${userMessage}` }] : []) // Add current user message if any
    ];

    // Call the Websim LLM API, request JSON output
    const completion = await websim.chat.completions.create({ messages, json: true });
    const responseText = (completion.content || '').trim();
    
    // attempt to parse JSON, but fallback to raw text if parsing fails
    let data;
    try {
      // Sometimes the API might wrap the JSON in ```json ... ```
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonString = jsonMatch ? jsonMatch[1] : responseText;
      data = JSON.parse(jsonString);
      
       // Validate required fields
       if (typeof data.reply !== 'string' || 
           typeof data.next_agent !== 'string' || 
           typeof data.progress !== 'number' ||
           typeof data.continue !== 'boolean') {
         throw new Error("Missing required fields in JSON response.");
       }
       // Ensure code exists, even if null/empty
       data.code = data.code || '';


    } catch (e) {
      console.warn('Received invalid JSON response from AI, attempting to use raw text reply', e, responseText);
      // Fallback logic: Use the raw text as the reply and keep state the same.
      data = {
        reply: responseText || "The AI agent provided an unexpected response format. Please try rephrasing.",
        code: '', // No code if response format is bad
        next_agent: window.appState.currentAgent, // Stay with current agent
        progress: window.appState.progress_value, // No progress update
        continue: false // Stop auto-conversation on error
      };
    }

    // Display AI reply, associating it with the agent *before* the state update
    const speakingAgent = window.appState.currentAgent; // Agent who generated this response
    await UI.addMessage(data.reply, 'ai', speakingAgent);

    // Handle code snippet if provided
    if (data.code && typeof data.code === 'string' && data.code.trim()) {
      UI.codeEditor.value = data.code;
      UI.updatePreview(data.code);
       // Maybe trigger a proposal automatically? Or let the user do it?
       // For now, just update the editor.
    }

    // Advance to next agent (update global state)
    window.appState.currentAgent = data.next_agent;
    UI.highlightAgent(window.appState.currentAgent);

    // Update progress bar
    UI.updateProgress(Math.max(0, Math.min(100, data.progress))); // Clamp progress value


    // If auto-conversing, schedule next turn if 'continue' is true
    clearTimeout(window.appState.autoConversationTimeout); // Clear previous timeout
    if (window.appState.isAutoConversing && data.continue) {
      window.appState.autoConversationTimeout = setTimeout(() => {
        if (window.appState.isAutoConversing) {
           // Send empty message to trigger the next agent's turn
          generateResponse('', true);
        }
      }, 2000); // 2-second delay between agent turns
    } else {
       window.appState.isAutoConversing = false; // Stop auto-conversation if continue is false or not auto-mode
    }

    // Broadcast agent message (using the speaking agent's role)
    if (window.Room.room) {
       // Send the state *after* processing the response
      window.Room.room.send({
        type: 'agent_message',
        agent_role: speakingAgent, // The agent who just spoke
        message: data.reply,
        code: data.code,
        next_agent: data.next_agent, // The agent who should speak next
        progress: data.progress,
        continue: data.continue // Whether auto-continue is requested
      });
       // Update shared state AFTER sending the message related to the previous step
       await window.Room.updateProjectState(); 
    }

  } catch (error) {
    console.error('Error generating response:', error);
    // Let the user know something went wrong
    await UI.addMessage("An error occurred while contacting the AI: " + error.message, 'ai', 'project-manager');
     window.appState.isAutoConversing = false; // Stop on error
  } finally {
    UI.thinking.style.display = 'none';
  }
}

// Export the functions
window.Messaging = {
  handleMessage,
  generateResponse
};