// Message handling module

/**
 * Handle incoming messages
 * @param {Object} event - Message event
 */
function handleMessage(event) {
  if (!event || !event.data) return;

  const data = event.data;

  try {
    // Check if the message is from the AI agent team
    if (data.type === 'agent_message') {
      // Add the AI's text reply to the chat UI
      if (data.message) {
        // Use the agent role provided in the message data
        const agentRole = data.agent_role || window.appState.currentAgent; // Fallback if missing
        UI.addMessage(data.message, 'ai', agentRole);
      }

      // Update the code editor and preview if code is provided
      if (data.code && typeof data.code === 'string') {
        UI.codeEditor.value = data.code;
        UI.updatePreview(data.code);
      }

      // Set the next agent and update the UI highlight
      if (data.next_agent) {
        window.appState.currentAgent = data.next_agent;
        UI.highlightAgent(window.appState.currentAgent);
      }

      // Update the progress bar
      if (typeof data.progress === 'number') {
        // Ensure progress is clamped between 0 and 100
        UI.updateProgress(Math.max(0, Math.min(100, data.progress)));
      }

      // Handle auto-continuation logic
      clearTimeout(window.appState.autoConversationTimeout); // Clear any previous timeout
      if (window.appState.isAutoConversing && data.continue) {
        window.appState.autoConversationTimeout = setTimeout(() => {
          // Double-check if still auto-conversing before proceeding
          if (window.appState.isAutoConversing) {
            generateResponse("", true); // Trigger next agent turn
          }
        }, 2000); // Delay between turns
      } else {
        // Stop auto-conversation explicitly if continue is false or if not in auto mode
        window.appState.isAutoConversing = false;
      }

      // Update shared state after processing the message locally
      // This now happens *after* the agent message is sent in generateResponse
      // Room.updateProjectState(); // Removed from here, handled in generateResponse

    } else if (data.type === 'propose_changes') {
      // Handle incoming code change proposals from other users
      window.appState.pendingChanges = data.changes;
      const votePanel = document.querySelector('.vote-panel');
      const diffPanel = document.querySelector('.code-diff');
      // Determine the previous code state for diffing
      const lastCode = window.appState.codeHistory.length > 0 
        ? window.appState.codeHistory[window.appState.codeHistory.length - 1].code 
        : '';
      // Generate and display the diff
      diffPanel.innerHTML = CodeVersion.generateDiff(lastCode, window.appState.pendingChanges.code);
      // Show the voting panel and update status
      votePanel.classList.add('active');
      CodeVersion.updateVotingStatus(); // Update vote counts display

    } else if (data.type === 'vote') {
      // Handle incoming votes from other users
      if (window.appState.pendingChanges) { // Only process votes if there's a pending change
        window.appState.votes[data.voter] = data.approved;
        CodeVersion.checkVotes(); // Check if consensus is reached
        CodeVersion.updateVotingStatus(); // Update vote counts display
      }
    }
    // Note: 'connected' and 'disconnected' events are handled directly in room.js's onmessage if needed for UI updates (like user lists).
  } catch (error) {
    console.error('Error handling message:', error, data);
    // Optionally inform the user about the error via UI
    // UI.addMessage("Error processing message: " + error.message, 'ai', 'system');
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
  // Reset progress slightly or keep it, depending on desired feel. Resetting to 0 might feel jerky.
  // UI.updateProgress(0); 

  // Keep track of which agent is speaking for this turn
  const speakingAgent = window.appState.currentAgent;

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

Task: Based on the user request and conversation history, the current agent (${speakingAgent}) should perform their role's task.

Code Generation:
-   Generate HTML, CSS, and JavaScript as needed.
-   For now, combine everything into a SINGLE HTML string.
-   Embed CSS within \`<style>\` tags in the HTML \`<head>\`.
-   Embed JavaScript within \`<script>\` tags, usually placed just before the closing \`</body>\` tag.
-   Ensure the generated code utilizes the Websim APIs correctly as documented if the task requires it (e.g., using WebsimSocket, Collections, LLM calls).

Response Format:
Your response MUST be a single JSON object containing the following keys, and nothing else:
{
  "reply": "Your text response as the current agent (${speakingAgent}). Explain what you did and why.",
  "code": "string | null; The complete HTML code including any embedded CSS (<style>...</style>) and JavaScript (<script>...</script>), or null if no code was generated this turn.",
  "next_agent": "role-of-the-agent-for-the-next-step (e.g., 'developer', 'qa-engineer', 'designer')",
  "progress": number, // An integer from 0 to 100 estimating overall project completion. Increase this incrementally based on task completion.
  "continue": boolean // Set to true if the team should continue working automatically without user input, false if waiting for user feedback or the task is complete.
}`;

    // Prepare message history for LLM
    const historyMessages = window.appState.conversation.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant', // Map roles correctly
      // Add agent context to history for clarity
      content: `(${msg.agent || (msg.role === 'user' ? 'user' : 'unknown')}): ${msg.content}` 
    }));

    // Construct the final messages array for the LLM call
    const messages = [
      { role: 'system', content: systemPrompt },
      // Include a limited number of recent messages to maintain context
      ...historyMessages.slice(-10), 
      // Add the current user message if provided for this turn
      ...(userMessage ? [{ role: 'user', content: `(user): ${userMessage}` }] : []) 
    ];

    // Call the Websim LLM API, requesting JSON output
    const completion = await websim.chat.completions.create({ messages, json: true });
    const responseText = (completion.content || '').trim();
    
    // Attempt to parse the JSON response, with fallback for errors
    let data;
    try {
      // Handle potential markdown code blocks around the JSON
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonString = jsonMatch ? jsonMatch[1] : responseText;
      data = JSON.parse(jsonString);
      
       // Validate required fields in the parsed JSON
       if (typeof data.reply !== 'string' || 
           typeof data.next_agent !== 'string' || 
           typeof data.progress !== 'number' ||
           typeof data.continue !== 'boolean') {
         console.error("Invalid JSON structure received:", data);
         throw new Error("Missing required fields in JSON response.");
       }
       // Ensure 'code' field exists, defaulting to null if missing
       data.code = data.code || null; // Use null explicitly if no code


    } catch (e) {
      console.warn('Received invalid JSON response from AI, attempting to use raw text reply', e, responseText);
      // Fallback: Use the raw text as the reply, maintain current state.
      data = {
        reply: responseText || "The AI agent provided an unexpected response format. Please try rephrasing or ask the agent to use the correct JSON format.",
        code: null, // No code if response format is invalid
        next_agent: speakingAgent, // Stay with the current agent on error
        progress: window.appState.progress_value, // Don't change progress on error
        continue: false // Stop auto-conversation on error
      };
    }

    // --- State Update and UI ---

    // 1. Add AI reply to conversation state *before* updating UI
    const aiMessageEntry = {
      role: 'assistant',
      content: data.reply,
      agent: speakingAgent // Associate with the agent who generated this
    };
    window.appState.conversation.push(aiMessageEntry);

    // 2. Update UI: Display AI reply
    await UI.addMessage(data.reply, 'ai', speakingAgent);

    // 3. Update UI: Handle code snippet if provided
    if (data.code && typeof data.code === 'string' && data.code.trim()) {
      UI.codeEditor.value = data.code;
      UI.updatePreview(data.code);
       // Future: Could automatically trigger a proposal here if desired.
    }

    // 4. Update State: Advance to next agent
    window.appState.currentAgent = data.next_agent;

    // 5. Update UI: Highlight the *next* agent who will speak
    UI.highlightAgent(window.appState.currentAgent);

    // 6. Update State & UI: Update progress bar
    const newProgress = Math.max(0, Math.min(100, data.progress)); // Clamp progress
    window.appState.progress_value = newProgress;
    UI.updateProgress(newProgress);

    // 7. Handle Auto-Conversation Continuation
    clearTimeout(window.appState.autoConversationTimeout); // Clear previous timeout
    if (isAuto && data.continue) { // Check both isAuto flag and AI response
      window.appState.isAutoConversing = true; // Ensure flag is set
      window.appState.autoConversationTimeout = setTimeout(() => {
        if (window.appState.isAutoConversing) {
           // Send empty message to trigger the next agent's turn
          generateResponse('', true);
        }
      }, 2000); // Delay between agent turns
    } else {
       window.appState.isAutoConversing = false; // Stop auto-conversation
    }

    // --- Send Message and Sync State ---

    // 8. Broadcast this agent's message via WebsimSocket
    if (window.Room.room) {
      window.Room.room.send({
        type: 'agent_message',
        agent_role: speakingAgent, // The agent who *just* spoke
        message: data.reply,
        code: data.code,          // Include the generated code
        next_agent: data.next_agent, // The agent who should speak next
        progress: newProgress,      // Send the clamped progress value
        continue: data.continue     // Signal if auto-continue is requested
      });

      // 9. Sync the updated application state (conversation, currentAgent, progress)
      // This happens *after* the message related to this turn is sent.
      await window.Room.updateProjectState();
    }

  } catch (error) {
    console.error('Error generating response:', error);
    // Inform the user about the error
    const errorMessage = "An error occurred while contacting the AI development team: " + error.message;
    // Add error message to state and UI
    window.appState.conversation.push({ role: 'assistant', content: errorMessage, agent: 'system' });
    await UI.addMessage(errorMessage, 'ai', 'project-manager'); // Show error as from PM or system
    window.appState.isAutoConversing = false; // Stop auto-conversation on error
    // Sync state even on error to share the error message
    if (window.Room.room) {
      await window.Room.updateProjectState();
    }
  } finally {
    // Hide the thinking indicator regardless of success or failure
    UI.thinking.style.display = 'none';
  }
}

// Export the functions
window.Messaging = {
  handleMessage,
  generateResponse
};