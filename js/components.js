// Components module for loading modular UI components

/**
 * Load HTML components into their container elements
 * @returns {Promise<void>}
 */
async function loadComponents() {
  try {
    // Load the sidebar
    const sidebarContainer = document.getElementById('sidebar-container');
    if (sidebarContainer) {
      const sidebarResponse = await fetch('html/sidebar.html');
      const sidebarHtml = await sidebarResponse.text();
      sidebarContainer.innerHTML = sidebarHtml;
    }

    // Load the workspace
    const workspaceContainer = document.getElementById('workspace-container');
    if (workspaceContainer) {
      const workspaceResponse = await fetch('html/workspace.html');
      const workspaceHtml = await workspaceResponse.text();
      workspaceContainer.innerHTML = workspaceHtml;
    }

    // Load the API docs modal
    const modalsContainer = document.getElementById('modals-container');
    if (modalsContainer) {
      const apiDocsResponse = await fetch('html/api-docs-modal.html');
      const apiDocsHtml = await apiDocsResponse.text();
      modalsContainer.innerHTML = apiDocsHtml;
    }

    // Re-attach event listeners after components are loaded
    attachEventListeners();
    
    console.log('All components loaded successfully');
  } catch (error) {
    console.error('Error loading components:', error);
    
    // Fallback to embedded components if loading fails
    fallbackToEmbeddedComponents();
  }
}

/**
 * Fallback to embedded components if loading components fails
 */
function fallbackToEmbeddedComponents() {
  console.warn('Using fallback embedded components');
  
  // Add fallback embedded HTML if needed
  // This is a simpler version to ensure the app works even if component loading fails
  const sidebar = document.getElementById('sidebar-container');
  if (sidebar) {
    sidebar.innerHTML = `
      <div class="sidebar">
        <h1>Development Team</h1>
        <!-- Simplified agent list -->
        <div class="agent active" data-role="project-manager">
          <div class="agent-info">
            <div class="agent-name">Sarah Chen</div>
            <div class="agent-role">Project Manager</div>
          </div>
        </div>
        <!-- More simplified agents could be added here -->
        <div class="api-docs-toggle">
          <button id="toggleApiDocs">Show API Documentation</button>
        </div>
      </div>
    `;
  }

  const workspace = document.getElementById('workspace-container');
  if (workspace) {
    workspace.innerHTML = `
      <div id="workspace">
        <div class="code-controls">
          <button id="proposeBtn">Propose Changes</button>
          <button id="viewHistoryBtn">View History</button>
        </div>
        <div class="vote-panel">
          <h3>Proposed Changes</h3>
          <div class="code-diff"></div>
          <div class="vote-buttons">
            <button class="vote-btn approve-btn">Approve</button>
            <button class="vote-btn reject-btn">Reject</button>
          </div>
        </div>
        <div class="code-history"></div>
        <textarea id="code-editor" placeholder="Code will appear here for testing..."></textarea>
        <iframe id="preview"></iframe>
      </div>
    `;
  }

  // Attach event listeners to fallback components
  attachEventListeners();
}

/**
 * Attach event listeners to elements after they are loaded
 */
function attachEventListeners() {
  // Reattach event listeners for dynamically loaded components
  const proposeBtn = document.getElementById('proposeBtn');
  if (proposeBtn) {
    proposeBtn.addEventListener('click', window.CodeVersion.proposeChanges);
  }

  const viewHistoryBtn = document.getElementById('viewHistoryBtn');
  if (viewHistoryBtn) {
    viewHistoryBtn.addEventListener('click', function() {
      const historyDiv = document.querySelector('.code-history');
      historyDiv.classList.toggle('visible');
    });
  }

  const approveBtn = document.querySelector('.approve-btn');
  if (approveBtn) {
    approveBtn.addEventListener('click', () => window.CodeVersion.vote(true));
  }

  const rejectBtn = document.querySelector('.reject-btn');
  if (rejectBtn) {
    rejectBtn.addEventListener('click', () => window.CodeVersion.vote(false));
  }

  const codeHistoryDiv = document.querySelector('.code-history');
  if (codeHistoryDiv) {
    codeHistoryDiv.addEventListener('click', (e) => {
      const revision = e.target.closest('.revision');
      if (revision) {
        const index = parseInt(revision.dataset.index);
        const code = window.appState.codeHistory[index].code;
        window.UI.codeEditor.value = code;
        window.UI.updatePreview(code);
      }
    });
  }

  const toggleApiDocsBtn = document.getElementById('toggleApiDocs');
  const apiDocsModal = document.getElementById('apiDocsModal');
  const closeModal = document.querySelector('.close-modal');

  if (toggleApiDocsBtn && apiDocsModal) {
    toggleApiDocsBtn.onclick = function() {
      apiDocsModal.style.display = 'block';
    };
  }

  if (closeModal && apiDocsModal) {
    closeModal.onclick = function() {
      apiDocsModal.style.display = 'none';
    };
  }

  // Handle global modal click
  window.onclick = function(event) {
    if (apiDocsModal && event.target == apiDocsModal) {
      apiDocsModal.style.display = 'none';
    }
  };
}

// Initialize components when DOM is ready
document.addEventListener('DOMContentLoaded', loadComponents);

// Export the functions for potential external use
window.Components = {
  loadComponents,
  fallbackToEmbeddedComponents,
  attachEventListeners
};