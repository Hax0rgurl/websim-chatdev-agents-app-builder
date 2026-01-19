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
      if (data.message || data.image_url) {
        UI.addMessage(data.message, 'ai', window.appState.currentAgent, data.image_url);
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

// Helper to load API docs text for system prompt
let apiDocsCache = null;
async function getApiDocsText() {
  if (apiDocsCache) return apiDocsCache;
  // Try reading from the currently loaded modal
  const el = document.getElementById('apiDocsContent');
  if (el) {
    apiDocsCache = el.innerText;
    return apiDocsCache;
  }
  // Fallback: fetch the modal HTML and extract the docs section
  try {
    const res = await fetch('html/api-docs-modal.html');
    const html = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const contentEl = doc.getElementById('apiDocsContent');
    apiDocsCache = contentEl ? contentEl.innerText : '';
  } catch (e) {
    console.error('Failed to load API docs:', e);
    apiDocsCache = '';
  }
  return apiDocsCache;
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
    // Check if websim API is available
    if (!window.websim || !window.websim.chat || !window.websim.chat.completions) {
      throw new Error("Websim API not available. Please ensure you're running in the Websim environment.");
    }

    // Load API documentation content for system prompt
    const apiDocsText = await getApiDocsText();

    // Build a system prompt instructing agents and JSON output
    const systemPrompt = `You are a collaborative team of AI development agents working together to build Websim-specific projects.
Each agent has a distinct personality and deep technical expertise. Be immersive, professional, and slightly quirky (like high-performing dev teams).
- Sarah (PM): Organized, focuses on the big picture and deadlines.
- Michael (PO): Obsessed with user value and "the vibe".
- James (Lead Dev): Pragmatic, architectures for scale, loves clean code.
- Emily (Dev): Enthusiastic, fast coder, sometimes misses edge cases.
- David (Reviewer): Pedantic, security-focused, extremely thorough.
- Lisa (QA): Skeptical, loves finding bugs, focuses on accessibility.
- Alex (Designer): Visual perfectionist, hates bad typography.
- Sam (DevOps): Lives in the terminal, focuses on performance and reliability.

Your goal is to build Websim-specific projects using the available APIs and recommended libraries below.
Focus on WebsimSocket (real-time), Collections (persistence), and AI APIs (LLM/ImageGen/TTS).
You can also leverage Websim's vast ecosystem:
- Access the asset database: Use preview images from other sites via \`https://images.websim.com/v1/site/\${site_id}/600\`.
- Remix/Reference public projects: You can fetch public project data using \`/api/v1/users/\${username}/projects\` or \`/api/v1/trending\`.
- Integrate user profiles: Link to creators using \`https://websim.com/@\${username}\` and show their avatars.

AVAILABLE WEBSIM APIs:
--- START API DOCS ---
${apiDocsText}
--- END API DOCS ---

When responding:
1.  STAY IN CHARACTER. Use the internal 'thought' field to strategize before replying.
2.  Collaborate like a real team: reference what others said, suggest improvements, or push back if a feature is scope-creeping.
3.  Ensure code snippets are functional and use documented APIs correctly.
4.  Determine who the logical 'next agent' should be based on the task flow.

Your response MUST be a single JSON object:
{
  "thought": "Internal reasoning about the current project state and team dynamic.",
  "reply": "Your public message to the team/user.",
  "code": "HTML/CSS/JS code if applicable, or empty string.",
  "image": { "prompt": "Image generation prompt", "aspect_ratio": "1:1|16:9|9:16" }, // Optional
  "next_agent": "role-of-the-agent-for-the-next-step",
  "progress": number,
  "continue": boolean
}`;

    // Prepare message history for LLM with safety checks
    const historyMessages = window.appState.conversation
      .filter(msg => msg && typeof msg.content === 'string')
      .map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant', 
        content: `(${msg.agent || 'user'}): ${msg.content}`
      }));

    // Construct the final messages array
    const messages = [
      { role: 'system', content: systemPrompt },
      ...historyMessages.slice(-15), // Increased history context
      ...(userMessage ? [{ role: 'user', content: `(user): ${userMessage}` }] : [])
    ];

    // Call the Websim LLM API, request JSON output
    const completion = await window.websim.chat.completions.create({ messages, json: true });
    const responseText = (completion && completion.content) ? completion.content.trim() : '';
    
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
    
    let generatedImageUrl = null;
    if (data.image && data.image.prompt) {
      // Show local loading state for image
      const chat = document.getElementById('chat');
      const loadingDiv = document.createElement('div');
      loadingDiv.className = 'image-loading';
      loadingDiv.innerHTML = `<span class="thinking-dots"></span> Generating visual asset: "${data.image.prompt}"`;
      chat.appendChild(loadingDiv);
      chat.scrollTop = chat.scrollHeight;

      try {
        const imageResult = await window.websim.imageGen({
          prompt: data.image.prompt,
          aspect_ratio: data.image.aspect_ratio || "1:1"
        });
        generatedImageUrl = imageResult.url;
      } catch (imgErr) {
        console.error("Image generation failed:", imgErr);
      } finally {
        loadingDiv.remove();
      }
    }

    await UI.addMessage(data.reply, 'ai', speakingAgent, generatedImageUrl);

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
        image_url: generatedImageUrl,
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