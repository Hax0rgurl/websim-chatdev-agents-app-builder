// Message handling module

/**
 * Handle incoming messages
 * @param {Object} event - Message event
 */
function handleMessage(event) {
  if (!event || !event.data) return;

  const data = event.data;
  // console.log('Received message:', data); // Added for debugging

  try {
    // Ignore messages sent by self unless explicitly told otherwise (echo: true)
    // Check if the message has a clientId and if it matches the current client's ID
    if (data.clientId && data.clientId === window.Room.room?.clientId && data.echo !== true) {
      // console.log('Ignoring message from self'); // Added for debugging
      return; 
    }

    switch (data.type) {
      case 'agent_message':
        handleAgentMessage(data);
        break;
      case 'propose_changes':
        handleProposeChanges(data);
        break;
      case 'vote':
        handleVote(data);
        break;
      case 'user_message': // Ensure user messages are added to chat if received from others
        if (data.message && data.username) {
           // Only add if it's not our own message echoing back
           if (!window.appState.conversation.find(m => m.role === 'user' && m.content === data.message)) {
             UI.addMessage(`${data.username}: ${data.message}`, 'user'); // Distinguish remote user messages
           }
        }
        break;
      default:
        // console.log('Received unknown message type:', data.type); // Added for debugging
        break;
    }
  } catch (error) {
    console.error('Error handling message:', error, 'Raw data:', data); // Log raw data on error
  }
}

/**
 * Handle agent_message type
 * @param {object} data - Message data
 */
function handleAgentMessage(data) {
  // console.log('Handling agent_message:', data); // Added for debugging
  if (data.message) {
    // Use the agent specified in the message data, or fall back to current state
    const agentRole = data.next_agent || window.appState.currentAgent;
    UI.addMessage(data.message, 'ai', agentRole);
  }

  if (data.code) {
    UI.codeEditor.value = data.code;
    UI.updatePreview(data.code);
  }

  if (data.next_agent) {
    window.appState.currentAgent = data.next_agent;
    UI.highlightAgent(window.appState.currentAgent);
    // Potentially update room state here if agent change needs immediate sync
    // window.Room.updateProjectState(); // Consider if needed
  }

  if (typeof data.progress === 'number') {
    UI.updateProgress(data.progress);
  }

  // Check if the *current* client should continue the conversation
  // This simple model assumes the client that initiated the last user message drives the conversation
  // A more robust model might designate a "leader" client.
  if (window.appState.isAutoConversing && data.continue) {
    // console.log('Agent message indicates continuation, scheduling next turn.'); // Added for debugging
    clearTimeout(window.appState.autoConversationTimeout);
    window.appState.autoConversationTimeout = setTimeout(() => {
      if (window.appState.isAutoConversing) {
        // console.log('Timeout triggered, calling generateResponse.'); // Added for debugging
        generateResponse("", true); // Pass isAuto=true
      } else {
        // console.log('Timeout triggered, but auto-conversing is now false.'); // Added for debugging
      }
    }, 2000); // Delay before next agent speaks
  } else if (!data.continue) {
     // console.log('Agent message indicates stop (continue=false).'); // Added for debugging
     window.appState.isAutoConversing = false; // Stop the auto flow if explicitly told
     UI.thinking.style.display = 'none';
     // Maybe update progress to 100 if it's not already?
     // UI.updateProgress(100);
  }
}

/**
 * Handle propose_changes type
 * @param {object} data - Message data
 */
function handleProposeChanges(data) {
  // console.log('Handling propose_changes:', data); // Added for debugging
  // Prevent proposing if there's already pending changes
  if (window.appState.pendingChanges && data.clientId !== window.Room.room?.clientId) {
      console.warn("Ignoring proposal, another is active.");
      // Optionally notify the user
      return;
  }
  window.appState.pendingChanges = data.changes;
  window.appState.votes = {}; // Reset votes for new proposal
  const votePanel = document.querySelector('.vote-panel');
  const diffPanel = document.querySelector('.code-diff');
  const lastCode = window.appState.codeHistory.length > 0
    ? window.appState.codeHistory[window.appState.codeHistory.length - 1].code
    : '';
  diffPanel.innerHTML = CodeVersion.generateDiff(lastCode, window.appState.pendingChanges.code);
  votePanel.classList.add('active');
  CodeVersion.updateVotingStatus(); // Update status for new proposal
}

/**
 * Handle vote type
 * @param {object} data - Message data
 */
function handleVote(data) {
  // console.log('Handling vote:', data); // Added for debugging
  // Ensure votes are only counted if there are pending changes
  if (!window.appState.pendingChanges) {
      console.warn("Received vote but no pending changes.");
      return;
  }
  // Use clientId from the message data as the voter identifier
  if (data.clientId) {
    window.appState.votes[data.clientId] = data.approved;
    CodeVersion.checkVotes(); // Re-check votes after receiving one
    CodeVersion.updateVotingStatus(); // Update display
  } else {
    console.warn("Received vote without clientId.");
  }
}


/**
 * Generate a response from AI
 * @param {string} userMessage - User message
 * @param {boolean} isAuto - Auto-generate flag (true if called by timeout)
 * @returns {Promise<void>}
 */
async function generateResponse(userMessage, isAuto = false) {
  // console.log(`generateResponse called. userMessage: "${userMessage}", isAuto: ${isAuto}`); // Added for debugging
  UI.thinking.style.display = 'block';
  // Don't reset progress if it's an auto-continuation? Maybe only reset on user input.
  if (!isAuto) {
    UI.updateProgress(0);
  }

  // Set auto-conversing flag if user initiates
  if (userMessage) {
      window.appState.isAutoConversing = true;
      // console.log('User initiated, setting isAutoConversing = true'); // Debug log
  } else if (!isAuto) {
      // This case shouldn't normally happen (no user message, not auto), but safety first.
      window.appState.isAutoConversing = false;
      // console.log('No user message and not auto, setting isAutoConversing = false'); // Debug log
  }


  try {
    // Refined system prompt for better flow control
    const systemPrompt = `You are a collaborative team of AI development agents building a web project using only the capabilities provided by Websim (WebsimSocket for multiplayer, Collections for data, LLM APIs).
Your goal is to fulfill the user's request step-by-step. Each agent speaks in turn.
Current Agent: ${window.appState.currentAgent}

Available Agents/Roles:
- project-manager: Oversees the project, clarifies requirements, assigns tasks. Starts and ends discussions.
- product-owner: Represents the user's vision, defines features.
- lead-developer: Designs the overall code structure, assigns coding tasks.
- developer: Writes HTML, CSS, and JavaScript code using Websim APIs.
- code-reviewer: Reviews code for quality, correctness, and adherence to Websim APIs.
- qa-engineer: Tests the functionality, reports bugs.
- designer: Focuses on UI/UX, suggests styling improvements.
- devops: (Less relevant here, focus on deployment is handled by Websim).

Workflow:
1. PM/PO clarifies request with user if needed.
2. PM/Lead Dev breaks down the task.
3. Agents execute tasks (coding, reviewing, testing).
4. Iterate until the feature is complete or user input is needed.

Output Format: Respond *only* with a single JSON object. Do not include any text outside the JSON braces.
Required JSON fields:
{
  "reply": "Your text response for the chat.",
  "code": "null | HTML/CSS/JS code snippet if you are writing/modifying code. Use null otherwise.",
  "next_agent": "role-of-the-agent-who-should-speak-next (e.g., 'developer', 'code-reviewer', 'project-manager'). Choose logically based on the workflow.",
  "progress": number // An estimate (0-100) of overall task completion. Increment realistically.
  "continue": boolean // Set to true if the conversation should continue automatically. Set to false if the task is complete OR you need input/clarification from the user.
}`;

    // Prepare message history for LLM
    // Limit history to keep token count reasonable
    const historyLimit = 15;
    const historyMessages = window.appState.conversation
      .slice(-historyLimit) // Take only the last N messages
      .map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant', // Map 'ai' back to 'assistant' for the API
        content: msg.content
    }));

    const messages = [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      // Add the current user message only if it's not an auto-triggered call
      ...(userMessage ? [{ role: 'user', content: userMessage }] : [])
    ];

    // Add a final instruction for the current agent if it's an auto-call
    if (!userMessage && isAuto) {
        messages.push({ role: 'user', content: `(Continue the task. Your role is: ${window.appState.currentAgent})` });
    }

    // console.log('Sending messages to LLM:', JSON.stringify(messages, null, 2)); // Debug log

    // Call the Websim LLM API, request JSON output
    const completion = await websim.chat.completions.create({ messages, json: true });
    const responseText = (completion.content || '').trim();
    // console.log('Raw LLM response:', responseText); // Debug log

    let data;
    try {
      // Attempt to parse the JSON response
      data = JSON.parse(responseText);
      // console.log('Parsed LLM response:', data); // Debug log
    } catch (e) {
      console.error('Failed to parse LLM response as JSON:', e, 'Raw response:', responseText);
      // Gracefully handle non-JSON response: show the text, stop the flow.
      await UI.addMessage(`(System Error: Received invalid response from ${window.appState.currentAgent}. Raw response: ${responseText})`, 'ai', 'project-manager');
      window.appState.isAutoConversing = false; // Stop the flow on error
      UI.thinking.style.display = 'none';
      // Attempt to keep the state consistent by broadcasting the error state? Optional.
      if (window.Room.room) {
           window.Room.room.send({
                type: 'agent_message',
                message: `(System Error: Agent ${window.appState.currentAgent} failed. Stopping.)`,
                code: null,
                next_agent: 'project-manager', // Reset to PM
                progress: window.appState.progress_value, // Keep last progress
                continue: false, // Definitely stop
                echo: true // Ensure all clients see this error state
           });
      }
      await window.Room.updateProjectState(); // Sync state after error
      return; // Exit the function
    }

    // --- Process Parsed JSON Data ---

    // Validate required fields and provide defaults
    data.reply = data.reply || '(No text reply provided)';
    data.code = data.code || null; // Explicitly null if empty/missing
    // Validate next_agent or default, maybe stop if invalid?
    const validAgents = ['project-manager', 'product-owner', 'lead-developer', 'developer', 'code-reviewer', 'qa-engineer', 'designer', 'devops'];
    if (!data.next_agent || !validAgents.includes(data.next_agent)) {
        console.warn(`LLM provided invalid next_agent: '${data.next_agent}'. Defaulting to project-manager and stopping.`);
        await UI.addMessage(`(System Error: Agent ${window.appState.currentAgent} specified invalid next agent '${data.next_agent}'. Stopping.)`, 'ai', 'project-manager');
        data.next_agent = 'project-manager';
        data.continue = false; // Stop flow on invalid agent
        window.appState.isAutoConversing = false;
    }
    data.progress = typeof data.progress === 'number' ? Math.max(0, Math.min(100, data.progress)) : window.appState.progress_value;
    data.continue = typeof data.continue === 'boolean' ? data.continue : false; // Default to not continuing if missing


    // --- Update UI and State ---

    // Display AI reply *before* potentially changing the current agent for the UI message tag
    const replyingAgent = window.appState.currentAgent;
    await UI.addMessage(data.reply, 'ai', replyingAgent);

    // Update code editor and preview *only if* code was provided
    if (data.code !== null) { // Check for explicit null
      UI.codeEditor.value = data.code;
      UI.updatePreview(data.code);
      // Do not automatically propose changes here - let user/agent decide
    }

    // Update agent *after* displaying the message from the previous agent
    window.appState.currentAgent = data.next_agent;
    UI.highlightAgent(window.appState.currentAgent);

    // Update progress bar
    UI.updateProgress(data.progress);

    // Update auto-conversing state based on LLM response
    window.appState.isAutoConversing = data.continue;
    // console.log(`LLM set continue=${data.continue}, isAutoConversing is now ${window.appState.isAutoConversing}`); // Debug log

    // --- Broadcast and Schedule Next Turn ---

    // Broadcast the processed agent message to other clients
    if (window.Room.room) {
      // console.log('Broadcasting agent_message to room'); // Debug log
      window.Room.room.send({
        type: 'agent_message',
        message: data.reply,
        code: data.code, // Send null if no code
        next_agent: data.next_agent,
        progress: data.progress,
        continue: data.continue,
        // echo: false // Default behavior is not to echo back to sender
      });
    }
     // Update the shared room state *after* processing and broadcasting
    await window.Room.updateProjectState();


    // If auto-conversing should continue, schedule the next turn *for this client*
    if (window.appState.isAutoConversing) {
       // console.log('Continue is true, scheduling next generateResponse call.'); // Debug log
      clearTimeout(window.appState.autoConversationTimeout);
      window.appState.autoConversationTimeout = setTimeout(() => {
        if (window.appState.isAutoConversing) { // Double check flag before calling
          // console.log('Timeout triggered for next turn, calling generateResponse.'); // Debug log
          generateResponse('', true); // Pass isAuto=true
        } else {
           // console.log('Timeout triggered, but auto-conversing became false.'); // Debug log
        }
      }, 2000); // Delay before next agent speaks
    } else {
       // console.log('Continue is false, not scheduling next turn.'); // Debug log
       UI.thinking.style.display = 'none'; // Hide thinking indicator
       if (data.progress === 100) {
            // Maybe add a final message?
            // await UI.addMessage("Task marked as complete.", 'ai', 'project-manager');
       }
    }

  } catch (error) {
    console.error('Error in generateResponse function:', error);
    await UI.addMessage("An unexpected error occurred while processing the AI response. Please check the console and try again.", 'ai', 'project-manager');
    window.appState.isAutoConversing = false; // Stop flow on error
  } finally {
    // Hide thinking indicator *if* not continuing automatically
    if (!window.appState.isAutoConversing) {
       UI.thinking.style.display = 'none';
    }
     // console.log('generateResponse finished.'); // Debug log
  }
}

// Export the functions
window.Messaging = {
  handleMessage,
  generateResponse
};