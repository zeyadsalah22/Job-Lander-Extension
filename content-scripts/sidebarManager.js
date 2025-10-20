// Sidebar Manager - Handles the persistent sidebar UI for application tracking
class SidebarManager {
  constructor(tracker) {
    this.tracker = tracker;
    this.sidebar = null;
    this.isVisible = false;
    this.isCollapsed = false;
    this.companies = [];
    this.cvs = [];
    this.updateQuestionsTimeout = null;
    this.lastQuestionsCount = 0;
    this.position = 'left'; // 'left' or 'right'
    this.isDragging = false;
    this.dragStartX = 0;
  }

  async show() {
    if (this.sidebar) {
      this.sidebar.classList.add('jl-visible');
      this.isVisible = true;
      return;
    }

    // Create sidebar
    this.sidebar = document.createElement('div');
    this.sidebar.id = 'job-lander-sidebar';
    this.sidebar.innerHTML = this.getSidebarHTML();
    
    // Add styles
    this.addSidebarStyles();
    
    // Inject into page
    document.body.appendChild(this.sidebar);
    
    // Attach event listeners
    this.attachEventListeners();
    
    // Initialize dragging functionality
    this.initializeDragging();
    
    // Set initial position
    this.updatePosition();
    
    // Load dropdown data
    await this.loadDropdownData();
    
    // Update with current data
    this.updateJobData();
    
    // Show with animation
    setTimeout(() => {
      this.sidebar.classList.add('jl-visible');
    }, 100);
    
    this.isVisible = true;
    console.log('Job Lander: Sidebar shown');
  }

  hide() {
    if (this.sidebar) {
      this.sidebar.classList.remove('jl-visible');
      setTimeout(() => {
        if (this.sidebar && this.sidebar.parentNode) {
          this.sidebar.parentNode.removeChild(this.sidebar);
          this.sidebar = null;
        }
      }, 300);
    }
    this.isVisible = false;
  }

  toggleCollapse() {
    if (!this.sidebar) return;
    
    this.isCollapsed = !this.isCollapsed;
    
    const collapseIcon = this.sidebar.querySelector('.jl-collapse-icon');
    
    if (this.isCollapsed) {
      this.sidebar.classList.add('jl-collapsed');
      if (collapseIcon) {
        collapseIcon.innerHTML = '<path d="M7 10l5 5 5-5z"/>'; // Down arrow
      }
    } else {
      this.sidebar.classList.remove('jl-collapsed');
      if (collapseIcon) {
        collapseIcon.innerHTML = '<path d="M7 14l5-5 5 5z"/>'; // Up arrow
      }
    }
    
    console.log('Job Lander: Sidebar', this.isCollapsed ? 'collapsed' : 'expanded');
  }

  initializeDragging() {
    if (!this.sidebar) return;
    
    const header = this.sidebar.querySelector('.jl-sidebar-header');
    if (!header) return;
    
    // Make header draggable
    header.style.cursor = 'grab';
    
    header.addEventListener('mousedown', (e) => {
      // Don't drag if clicking on buttons
      if (e.target.closest('button')) return;
      
      this.isDragging = true;
      this.dragStartX = e.clientX;
      header.style.cursor = 'grabbing';
      
      // Prevent text selection during drag
      e.preventDefault();
      
      console.log('Job Lander: Started dragging sidebar');
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      
      const deltaX = e.clientX - this.dragStartX;
      const windowWidth = window.innerWidth;
      
      // Threshold to switch sides (drag more than 30% of screen width)
      if (Math.abs(deltaX) > windowWidth * 0.3) {
        const newPosition = deltaX > 0 ? 'right' : 'left';
        
        if (newPosition !== this.position) {
          this.position = newPosition;
          this.updatePosition();
          this.dragStartX = e.clientX; // Reset start point
          console.log('Job Lander: Sidebar moved to', this.position);
        }
      }
    });
    
    document.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        const header = this.sidebar?.querySelector('.jl-sidebar-header');
        if (header) {
          header.style.cursor = 'grab';
        }
        console.log('Job Lander: Stopped dragging sidebar');
      }
    });
  }

  updatePosition() {
    if (!this.sidebar) return;
    
    // Remove existing position classes
    this.sidebar.classList.remove('jl-position-left', 'jl-position-right');
    
    // Add new position class
    this.sidebar.classList.add(`jl-position-${this.position}`);
    
    console.log('Job Lander: Position updated to', this.position);
  }

  getSidebarHTML() {
    return `
      <div class="jl-sidebar-container">
        <div class="jl-sidebar-header">
          <div class="jl-header-content">
            <div class="jl-logo">
              <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              <span>Job Lander</span>
            </div>
            <div class="jl-header-actions">
              <button class="jl-collapse-btn" data-action="toggle-collapse" title="Collapse/Expand">
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24" class="jl-collapse-icon">
                  <path d="M7 14l5-5 5 5z"/>
                </svg>
              </button>
              <button class="jl-close-btn" data-action="close" title="Close">
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="jl-subtitle">Application Tracker</div>
        </div>
        
        <div class="jl-sidebar-content">
          <!-- Progress Indicator -->
          <div class="jl-section">
            <div class="jl-progress">
              <div class="jl-step active" data-step="job_posting">
                <div class="jl-step-icon">1</div>
                <span>Job Info</span>
              </div>
              <div class="jl-step" data-step="application">
                <div class="jl-step-icon">2</div>
                <span>Application</span>
              </div>
              <div class="jl-step" data-step="complete">
                <div class="jl-step-icon">3</div>
                <span>Complete</span>
              </div>
            </div>
          </div>

          <!-- Job Data Section -->
          <div class="jl-section">
            <h4>📋 Job Information</h4>
            <div class="jl-field-group">
              <div class="jl-field">
                <label for="jl-job-title-input">Job Title:</label>
                <input type="text" id="jl-job-title-input" class="jl-input" placeholder="Loading..." />
              </div>
              <div class="jl-field">
                <label for="jl-company-name-input">Company:</label>
                <input type="text" id="jl-company-name-input" class="jl-input" placeholder="Loading..." />
              </div>
              <div class="jl-field">
                <label for="jl-location-input">Location:</label>
                <input type="text" id="jl-location-input" class="jl-input" placeholder="Loading..." />
              </div>
              <div class="jl-field">
                <label for="jl-job-type-input">Job Type:</label>
                <input type="text" id="jl-job-type-input" class="jl-input" placeholder="Loading..." />
              </div>
              <div class="jl-field">
                <label for="jl-description-input">Job Description:</label>
                <input type="text" id="jl-description-input" class="jl-input" placeholder="Loading..." />
              </div>
            </div>
          </div>

          <!-- User Selections -->
          <div class="jl-section">
            <h4>⚙️ Application Settings</h4>
            <div class="jl-field-group">
              <div class="jl-field">
                <label for="jl-company-select">Select Company *</label>
                <div class="jl-select-wrapper">
                  <select id="jl-company-select" required>
                    <option value="">Loading companies...</option>
                  </select>
                  <div class="jl-select-arrow">
                    <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M7 10l5 5 5-5z"/>
                    </svg>
                  </div>
                </div>
                <div class="jl-field-hint">Choose the company you're applying to</div>
              </div>
              
              <div class="jl-field">
                <label for="jl-cv-select">Select CV *</label>
                <div class="jl-select-wrapper">
                  <select id="jl-cv-select" required>
                    <option value="">Loading CVs...</option>
                  </select>
                  <div class="jl-select-arrow">
                    <svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M7 10l5 5 5-5z"/>
                    </svg>
                  </div>
                </div>
                <div class="jl-field-hint">Choose the CV you're submitting</div>
              </div>
            </div>
          </div>

          <!-- Questions Section -->
          <div class="jl-section">
            <h4>❓ Detected Questions (<span id="jl-question-count">0</span>)</h4>
            <div class="jl-questions-info">
              <div class="jl-info-banner">
                <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>
                <span>Only questions with answers ≥ 100 characters will be saved</span>
              </div>
              <div class="jl-color-legend">
                <div class="jl-legend-item">
                  <span class="jl-legend-color jl-legend-green"></span>
                  <span>Will be saved</span>
                </div>
                <div class="jl-legend-item">
                  <span class="jl-legend-color jl-legend-yellow"></span>
                  <span>Too short</span>
                </div>
              </div>
            </div>
            <button class="jl-btn jl-btn-add-question" data-action="add-question">
              <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
              </svg>
              Add Question Manually
            </button>
            <div id="jl-questions-list" class="jl-questions-container">
              <div class="jl-no-questions">
                <svg width="48" height="48" fill="currentColor" viewBox="0 0 24 24" opacity="0.3">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/>
                </svg>
                <p>No questions detected yet</p>
                <small>Questions will appear as you fill out the application</small>
              </div>
            </div>
          </div>

          <!-- Status Messages -->
          <div id="jl-status-messages"></div>
        </div>

        <div class="jl-sidebar-footer">
          <button class="jl-btn jl-btn-secondary" data-action="stop">
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h12v12H6z"/>
            </svg>
            Stop Tracking
          </button>
          <button class="jl-btn jl-btn-primary" data-action="save">
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z"/>
            </svg>
            Save Application
          </button>
        </div>
      </div>
    `;
  }

  addSidebarStyles() {
    if (document.getElementById('jl-sidebar-styles')) return;

    const styles = `
      #job-lander-sidebar {
        position: fixed;
        top: 0;
        width: 380px;
        height: 100vh;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        box-shadow: 4px 0 20px rgba(0,0,0,0.15);
        z-index: 999998;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        overflow: hidden;
        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        display: flex;
        flex-direction: column;
      }
      
      /* Position-based transforms */
      #job-lander-sidebar.jl-position-left {
        left: 0;
        transform: translateX(-100%);
      }
      
      #job-lander-sidebar.jl-position-left.jl-visible {
        transform: translateX(0);
      }
      
      #job-lander-sidebar.jl-position-right {
        right: 0;
        left: auto;
        transform: translateX(100%);
        box-shadow: -4px 0 20px rgba(0,0,0,0.15);
      }
      
      #job-lander-sidebar.jl-position-right.jl-visible {
        transform: translateX(0);
      }
      
      #job-lander-sidebar.jl-position-right .jl-sidebar-container {
        margin-left: 0;
        margin-right: 4px;
        border-radius: 12px 0 0 12px;
      }
      
      #job-lander-sidebar.jl-position-right .jl-sidebar-header {
        border-radius: 12px 0 0 0;
      }
      
      #job-lander-sidebar.jl-position-right .jl-sidebar-footer {
        border-radius: 0 0 0 12px;
      }
      
      /* Collapsed state - show only header at top */
      #job-lander-sidebar.jl-collapsed {
        height: auto;
        width: 380px;
      }
      
      #job-lander-sidebar.jl-collapsed .jl-sidebar-content {
        display: none;
      }
      
      #job-lander-sidebar.jl-collapsed .jl-sidebar-footer {
        display: none;
      }
      
      #job-lander-sidebar.jl-collapsed .jl-subtitle {
        display: none;
      }
      
      .jl-sidebar-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: white;
        color: #1f2937;
        margin-left: 4px;
        border-radius: 0 12px 12px 0;
      }
      
      .jl-sidebar-header {
        padding: 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border-radius: 0 12px 0 0;
        user-select: none;
        position: relative;
      }
      
      .jl-sidebar-header::before {
        content: '';
        position: absolute;
        left: 50%;
        bottom: 8px;
        transform: translateX(-50%);
        width: 40px;
        height: 4px;
        background: rgba(255, 255, 255, 0.3);
        border-radius: 2px;
        transition: all 0.2s;
      }
      
      .jl-sidebar-header:hover::before {
        background: rgba(255, 255, 255, 0.5);
        width: 60px;
      }
      
      .jl-header-content {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }
      
      .jl-header-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .jl-collapse-btn,
      .jl-close-btn {
        background: rgba(255,255,255,0.1);
        border: none;
        color: white;
        width: 32px;
        height: 32px;
        border-radius: 6px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }
      
      .jl-collapse-btn:hover,
      .jl-close-btn:hover {
        background: rgba(255,255,255,0.2);
        transform: scale(1.05);
      }
      
      .jl-logo {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 700;
        font-size: 18px;
      }
      
      .jl-subtitle {
        font-size: 14px;
        opacity: 0.9;
        font-weight: 500;
      }
      
      .jl-close-btn {
        background: rgba(255,255,255,0.2);
        border: none;
        color: white;
        width: 32px;
        height: 32px;
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
      }
      
      .jl-close-btn:hover {
        background: rgba(255,255,255,0.3);
      }
      
      .jl-sidebar-content {
        flex: 1;
        padding: 20px;
        overflow-y: auto;
        background: #f8fafc;
      }
      
      .jl-section {
        margin-bottom: 24px;
        background: white;
        border-radius: 12px;
        padding: 16px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        border: 1px solid #e5e7eb;
      }
      
      .jl-section h4 {
        margin: 0 0 16px 0;
        color: #374151;
        font-size: 15px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .jl-field-group {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      
      .jl-field {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      
      .jl-field label {
        font-size: 13px;
        color: #6b7280;
        font-weight: 600;
        margin: 0;
      }
      
      .jl-field-value {
        padding: 10px 12px;
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        font-size: 13px;
        color: #374151;
        min-height: 20px;
        word-break: break-word;
      }
      
      .jl-field-value:empty::before {
        content: "Not detected";
        color: #9ca3af;
        font-style: italic;
      }
      
      .jl-select-wrapper {
        position: relative;
      }
      
      .jl-select-wrapper select {
        width: 100%;
        padding: 10px 36px 10px 12px;
        border: 2px solid #e5e7eb;
        border-radius: 8px;
        font-size: 13px;
        background: white;
        color: #374151;
        cursor: pointer;
        appearance: none;
        transition: border-color 0.2s, box-shadow 0.2s;
      }
      
      .jl-select-wrapper select:focus {
        outline: none;
        border-color: #667eea;
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
      }
      
      .jl-select-wrapper select:required:invalid {
        border-color: #ef4444;
      }
      
      .jl-select-arrow {
        position: absolute;
        right: 12px;
        top: 50%;
        transform: translateY(-50%);
        pointer-events: none;
        color: #6b7280;
      }
      
      .jl-field-hint {
        font-size: 11px;
        color: #9ca3af;
        margin-top: 4px;
      }
      
      .jl-progress {
        display: flex;
        gap: 8px;
        margin-bottom: 8px;
      }
      
      .jl-step {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        padding: 12px 8px;
        border-radius: 8px;
        background: #f3f4f6;
        color: #6b7280;
        font-size: 11px;
        font-weight: 600;
        text-align: center;
        transition: all 0.3s;
      }
      
      .jl-step.active {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        transform: scale(1.05);
      }
      
      .jl-step-icon {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: rgba(255,255,255,0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 700;
      }
      
      .jl-step.active .jl-step-icon {
        background: rgba(255,255,255,0.3);
      }
      
      .jl-questions-container {
        max-height: 200px;
        overflow-y: auto;
      }
      
      .jl-no-questions {
        text-align: center;
        padding: 24px 16px;
        color: #6b7280;
      }
      
      .jl-no-questions p {
        margin: 8px 0 4px 0;
        font-weight: 500;
      }
      
      .jl-no-questions small {
        font-size: 11px;
        opacity: 0.8;
      }
      
      .jl-question-item {
        padding: 12px;
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        margin-bottom: 8px;
        font-size: 12px;
      }
      
      .jl-question-item.answered {
        background: #ecfdf5;
        border-color: #10b981;
      }
      
      .jl-question-text {
        font-weight: 500;
        color: #374151;
        margin-bottom: 4px;
      }
      
      .jl-question-status {
        font-size: 11px;
        color: #6b7280;
      }
      
      .jl-question-status.answered {
        color: #10b981;
      }
      
      .jl-sidebar-footer {
        padding: 20px;
        border-top: 1px solid #e5e7eb;
        display: flex;
        gap: 12px;
        background: white;
        border-radius: 0 0 12px 0;
      }
      
      .jl-btn {
        flex: 1;
        padding: 12px 16px;
        border: none;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
      }
      
      .jl-btn-primary {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
      }
      
      .jl-btn-primary:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
      }
      
      .jl-btn-secondary {
        background: #f3f4f6;
        color: #374151;
        border: 1px solid #e5e7eb;
      }
      
      .jl-btn-secondary:hover {
        background: #e5e7eb;
      }
      
      .jl-status-message {
        padding: 12px 16px;
        border-radius: 8px;
        margin-bottom: 12px;
        font-size: 13px;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .jl-status-success {
        background: #ecfdf5;
        color: #065f46;
        border: 1px solid #10b981;
      }
      
      .jl-status-error {
        background: #fef2f2;
        color: #991b1b;
        border: 1px solid #ef4444;
      }
      
      /* Scrollbar styling */
      .jl-sidebar-content::-webkit-scrollbar,
      .jl-questions-container::-webkit-scrollbar {
        width: 4px;
      }
      
      .jl-sidebar-content::-webkit-scrollbar-track,
      .jl-questions-container::-webkit-scrollbar-track {
        background: #f1f5f9;
      }
      
      .jl-sidebar-content::-webkit-scrollbar-thumb,
      .jl-questions-container::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 2px;
      }
      
      /* Input field styles */
      .jl-input {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        font-size: 13px;
        background: white;
        color: #374151;
        transition: all 0.2s;
        box-sizing: border-box;
      }
      
      .jl-input:focus {
        outline: none;
        border-color: #667eea;
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
      }
      
       .jl-input::placeholder {
         color: #9ca3af;
       }
       
       /* Question item styles */
       .jl-question-item {
         background: #f8fafc;
         border: 1px solid #e2e8f0;
         border-radius: 8px;
         padding: 12px;
         margin-bottom: 12px;
         transition: all 0.2s;
       }
       
       /* Color coding based on answer length */
       .jl-question-item.will-save {
         background: #f0fdf4;
         border-color: #22c55e;
         border-left: 4px solid #22c55e;
       }
       
       .jl-question-item.too-short {
         background: #fefce8;
         border-color: #facc15;
         border-left: 4px solid #facc15;
       }
       
       .jl-question-item.answered {
         background: #f0f9ff;
         border-color: #0ea5e9;
       }
       
       .jl-question-header {
         display: flex;
         justify-content: space-between;
         align-items: center;
         margin-bottom: 8px;
       }
       
       .jl-question-number {
         font-size: 12px;
         font-weight: 600;
         color: #667eea;
         background: rgba(102, 126, 234, 0.1);
         padding: 2px 8px;
         border-radius: 12px;
       }
       
       .jl-question-remove {
         background: rgba(239, 68, 68, 0.1);
         border: none;
         color: #ef4444;
         width: 24px;
         height: 24px;
         border-radius: 4px;
         cursor: pointer;
         display: flex;
         align-items: center;
         justify-content: center;
         transition: all 0.2s;
       }
       
       .jl-question-remove:hover {
         background: rgba(239, 68, 68, 0.2);
         transform: scale(1.1);
       }
       
       .jl-question-content {
         margin-bottom: 8px;
       }
       
       .jl-question-content .jl-field {
         margin-bottom: 8px;
       }
       
       .jl-question-content label {
         font-size: 11px;
         font-weight: 600;
         color: #6b7280;
         margin-bottom: 4px;
         display: block;
       }
       
       .jl-question-text-input,
       .jl-question-answer-input {
         font-size: 12px;
       }
       
       .jl-question-answer-input {
         resize: vertical;
         min-height: 40px;
       }
       
       .jl-question-status {
         font-size: 11px;
         font-weight: 500;
         color: #6b7280;
         display: flex;
         align-items: center;
         gap: 4px;
       }
       
       .jl-question-status.answered {
         color: #059669;
       }
       
       /* Questions info banner and legend */
       .jl-questions-info {
         margin-bottom: 12px;
       }
       
       .jl-info-banner {
         display: flex;
         align-items: center;
         gap: 8px;
         padding: 10px 12px;
         background: #eff6ff;
         border: 1px solid #93c5fd;
         border-radius: 6px;
         font-size: 12px;
         color: #1e40af;
         margin-bottom: 10px;
       }
       
       .jl-info-banner svg {
         flex-shrink: 0;
         color: #3b82f6;
       }
       
       .jl-color-legend {
         display: flex;
         gap: 16px;
         padding: 8px 0;
       }
       
       .jl-legend-item {
         display: flex;
         align-items: center;
         gap: 6px;
         font-size: 11px;
         color: #6b7280;
       }
       
       .jl-legend-color {
         width: 16px;
         height: 16px;
         border-radius: 3px;
         border: 1px solid #e5e7eb;
       }
       
       .jl-legend-green {
         background: #22c55e;
       }
       
       .jl-legend-yellow {
         background: #facc15;
       }
       
       /* Add question button */
       .jl-btn-add-question {
         width: 100%;
         margin-bottom: 12px;
         padding: 10px 12px;
         background: #f3f4f6;
         border: 1px dashed #9ca3af;
         color: #4b5563;
         font-size: 13px;
         font-weight: 600;
         display: flex;
         align-items: center;
         justify-content: center;
         gap: 6px;
         cursor: pointer;
         border-radius: 8px;
         transition: all 0.2s;
       }
       
       .jl-btn-add-question:hover {
         background: #e5e7eb;
         border-color: #667eea;
         color: #667eea;
       }
       
       .jl-btn-add-question svg {
         width: 16px;
         height: 16px;
       }
     `;

     const styleSheet = document.createElement('style');
    styleSheet.id = 'jl-sidebar-styles';
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
  }

  attachEventListeners() {
    if (!this.sidebar) return;

    // Close button
    const closeBtn = this.sidebar.querySelector('[data-action="close"]');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.tracker.stopTracking();
      });
    }

    // Collapse/Expand button
    const collapseBtn = this.sidebar.querySelector('[data-action="toggle-collapse"]');
    if (collapseBtn) {
      collapseBtn.addEventListener('click', () => {
        this.toggleCollapse();
      });
    }

    // Stop tracking button
    const stopBtn = this.sidebar.querySelector('[data-action="stop"]');
    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        this.tracker.stopTracking();
      });
    }

    // Save application button
    const saveBtn = this.sidebar.querySelector('[data-action="save"]');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        this.tracker.saveApplication();
      });
    }

    // Company selection
    const companySelect = this.sidebar.querySelector('#jl-company-select');
    if (companySelect) {
      companySelect.addEventListener('change', (e) => {
        this.tracker.updateCompanySelection(e.target.value);
      });
    }

    // CV selection
    const cvSelect = this.sidebar.querySelector('#jl-cv-select');
    if (cvSelect) {
      cvSelect.addEventListener('change', (e) => {
        this.tracker.updateCvSelection(e.target.value);
      });
    }

    // Add question button
    const addQuestionBtn = this.sidebar.querySelector('[data-action="add-question"]');
    if (addQuestionBtn) {
      addQuestionBtn.addEventListener('click', () => {
        this.showAddQuestionForm();
      });
    }
  }

  async loadDropdownData() {
    try {
      console.log('Job Lander: Loading dropdown data...');
      
      const response = await chrome.runtime.sendMessage({
        type: 'GET_DROPDOWN_DATA'
      });

      console.log('Job Lander: Dropdown response:', response);

      if (response && response.success) {
        this.companies = response.data.companies || [];
        this.cvs = response.data.cvs || [];
        
        console.log('Job Lander: Loaded companies:', this.companies.length);
        console.log('Job Lander: Loaded CVs:', this.cvs.length);
        
        this.populateCompanyDropdown();
        this.populateCvDropdown();
        
        if (this.companies.length === 0) {
          this.showError('No companies found. Please add companies in your Job Lander dashboard first.');
        }
        
        if (this.cvs.length === 0) {
          this.showError('No CVs found. Please upload a CV in your Job Lander dashboard first.');
        }
      } else {
        console.error('Job Lander: Failed to load dropdown data:', response?.error);
        this.showError('Failed to load companies and CVs: ' + (response?.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Job Lander: Error loading dropdown data:', error);
      this.showError('Failed to load dropdown data: ' + error.message);
    }
  }

  populateCompanyDropdown() {
    const select = this.sidebar?.querySelector('#jl-company-select');
    if (!select) {
      console.warn('Job Lander: Company select element not found');
      return;
    }

    console.log('Job Lander: Populating company dropdown with', this.companies.length, 'companies');

    select.innerHTML = '<option value="">Select a company...</option>';
    
    if (this.companies.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No companies available';
      option.disabled = true;
      select.appendChild(option);
      return;
    }
    
    this.companies.forEach((company, index) => {
      console.log(`Job Lander: Adding company ${index + 1}:`, company);
      
      const option = document.createElement('option');
      option.value = company.companyId || company.id;
      
      // Handle user-companies API structure
      const companyName = company.companyName || company.name;
      const companyLocation = company.companyLocation || company.location;
      
      option.textContent = `${companyName}${companyLocation ? ` (${companyLocation})` : ''}`;
      select.appendChild(option);
    });
    
    console.log('Job Lander: Company dropdown populated with', select.options.length - 1, 'options');
  }

  populateCvDropdown() {
    const select = this.sidebar?.querySelector('#jl-cv-select');
    if (!select) {
      console.warn('Job Lander: CV select element not found');
      return;
    }

    console.log('Job Lander: Populating CV dropdown with', this.cvs.length, 'CVs');

    select.innerHTML = '<option value="">Select a CV...</option>';
    
    if (this.cvs.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'No CVs available';
      option.disabled = true;
      select.appendChild(option);
      return;
    }
    
    this.cvs.forEach((cv, index) => {
      console.log(`Job Lander: Adding CV ${index + 1}:`, cv);
      
      const option = document.createElement('option');
      option.value = cv.resumeId || cv.id;
      option.textContent = `Resume ${cv.resumeId || cv.id} (${new Date(cv.createdAt).toLocaleDateString()})`;
      select.appendChild(option);
    });
    
    console.log('Job Lander: CV dropdown populated with', select.options.length - 1, 'options');
  }

  updateJobData() {
    const data = this.tracker.applicationData;
    
    this.updateInputField('jl-job-title-input', data.jobTitle);
    this.updateInputField('jl-company-name-input', data.companyName);
    this.updateInputField('jl-location-input', data.location);
    this.updateInputField('jl-job-type-input', data.jobType);
    this.updateInputField('jl-description-input', data.description);
  }

  updateInputField(fieldId, value) {
    const field = this.sidebar?.querySelector(`#${fieldId}`);
    if (field) {
      field.value = value || '';
      field.placeholder = value ? '' : 'Not detected';
    }
  }

  // Get current values from input fields
  getCurrentJobData() {
    if (!this.sidebar) return {};
    
    return {
      jobTitle: this.sidebar.querySelector('#jl-job-title-input')?.value || '',
      companyName: this.sidebar.querySelector('#jl-company-name-input')?.value || '',
      location: this.sidebar.querySelector('#jl-location-input')?.value || '',
      jobType: this.sidebar.querySelector('#jl-job-type-input')?.value || '',
      description: this.sidebar.querySelector('#jl-description-input')?.value || '',
      companyId: this.sidebar.querySelector('#jl-company-select')?.value || '',
      cvId: this.sidebar.querySelector('#jl-cv-select')?.value || ''
    };
  }

  updateQuestions(questions) {
    // Check if we actually need to rebuild the UI (questions added/removed)
    if (questions.length === this.lastQuestionsCount) {
      // Same number of questions, just update counter and return
      this.updateQuestionCounter(questions.length);
      return;
    }

    // Clear any pending timeout
    if (this.updateQuestionsTimeout) {
      clearTimeout(this.updateQuestionsTimeout);
    }

    // Debounce the actual UI rebuild
    this.updateQuestionsTimeout = setTimeout(() => {
      this.rebuildQuestionsUI(questions);
    }, 3000); // Wait 3 seconds after last update

    // Update counter immediately
    this.updateQuestionCounter(questions.length);
    this.lastQuestionsCount = questions.length;
  }

  updateQuestionCounter(count) {
    const counter = this.sidebar?.querySelector('#jl-question-count');
    if (counter) {
      counter.textContent = count;
    }
  }

  rebuildQuestionsUI(questions) {
    const container = this.sidebar?.querySelector('#jl-questions-list');
    if (!container) return;

    console.log('Job Lander: Rebuilding questions UI with', questions.length, 'questions');

    if (questions.length === 0) {
      container.innerHTML = `
        <div class="jl-no-questions">
          <svg width="48" height="48" fill="currentColor" viewBox="0 0 24 24" opacity="0.3">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/>
          </svg>
          <p>No questions detected yet</p>
          <small>Questions will appear as you fill out the application</small>
        </div>
      `;
      return;
    }

    container.innerHTML = questions.map((question, index) => {
      const isAnswered = this.tracker.applicationData.userAnswers.has(question.text);
      const answer = this.tracker.applicationData.userAnswers.get(question.text) || question.answer || '';
      
      // Determine color class based on answer length
      const answerLength = answer.length;
      let colorClass = '';
      if (answerLength >= 100) {
        colorClass = 'will-save';
      } else if (answerLength > 0 && answerLength < 100) {
        colorClass = 'too-short';
      }
      
      return `
        <div class="jl-question-item ${colorClass}" data-question-id="${question.id}">
          <div class="jl-question-header">
            <span class="jl-question-number">#${index + 1}</span>
            <button class="jl-question-remove" data-action="remove-question" data-question-id="${question.id}" title="Remove question">
              <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
          
          <div class="jl-question-content">
            <div class="jl-field">
              <label>Question:</label>
              <input type="text" class="jl-input jl-question-text-input" 
                     value="${this.escapeHtml(question.text)}" 
                     data-question-id="${question.id}"
                     placeholder="Enter question text...">
            </div>
            
            <div class="jl-field">
              <label>Answer:</label>
              <textarea class="jl-input jl-question-answer-input" 
                        data-question-id="${question.id}"
                        placeholder="Enter your answer..."
                        rows="2">${this.escapeHtml(answer)}</textarea>
            </div>
          </div>
          
          <div class="jl-question-status" data-question-id="${question.id}">
            ${answer.length >= 100 
              ? `✅ Will be saved (${answer.length} chars)` 
              : answer.length > 0 
                ? `⚠️ Too short (${answer.length}/100 chars)`
                : 'No answer yet'}
          </div>
        </div>
      `;
    }).join('');
    
    // Attach event listeners for question editing
    this.attachQuestionEventListeners();
  }

  // Force immediate UI rebuild (for when questions are added/removed)
  forceUpdateQuestions(questions) {
    if (this.updateQuestionsTimeout) {
      clearTimeout(this.updateQuestionsTimeout);
      this.updateQuestionsTimeout = null;
    }
    this.rebuildQuestionsUI(questions);
    this.lastQuestionsCount = questions.length;
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  attachQuestionEventListeners() {
    if (!this.sidebar) return;

    // Remove question buttons (only attach to new buttons)
    const removeButtons = this.sidebar.querySelectorAll('[data-action="remove-question"]:not([data-listener-attached])');
    removeButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        const questionId = button.dataset.questionId;
        this.removeQuestion(questionId);
      });
      button.setAttribute('data-listener-attached', 'true');
    });

    // Question text inputs (only attach to new inputs)
    const questionInputs = this.sidebar.querySelectorAll('.jl-question-text-input:not([data-listener-attached])');
    questionInputs.forEach(input => {
      input.addEventListener('input', (e) => {
        const questionId = input.dataset.questionId;
        this.updateQuestionText(questionId, e.target.value);
      });
      input.setAttribute('data-listener-attached', 'true');
    });

    // Answer inputs (only attach to new inputs)
    const answerInputs = this.sidebar.querySelectorAll('.jl-question-answer-input:not([data-listener-attached])');
    answerInputs.forEach(input => {
      input.addEventListener('input', (e) => {
        const questionId = input.dataset.questionId;
        this.updateQuestionAnswer(questionId, e.target.value);
      });
      input.setAttribute('data-listener-attached', 'true');
    });
  }

  removeQuestion(questionId) {
    if (!questionId) return;
    
    // Remove from tracker's data
    if (this.tracker && this.tracker.dataCollector) {
      this.tracker.dataCollector.removeQuestion(questionId);
      
      // Force immediate UI update since a question was removed
      const remainingQuestions = Array.from(this.tracker.dataCollector.detectedQuestions.values());
      this.forceUpdateQuestions(remainingQuestions);
    }
    
    console.log('Job Lander: Question removed:', questionId);
  }

  updateQuestionText(questionId, newText) {
    if (!questionId || !this.tracker || !this.tracker.dataCollector) return;
    
    this.tracker.dataCollector.updateQuestionText(questionId, newText);
    console.log('Job Lander: Question text updated:', questionId, newText);
  }

  updateQuestionAnswer(questionId, newAnswer) {
    if (!questionId || !this.tracker || !this.tracker.dataCollector) return;
    
    this.tracker.dataCollector.updateQuestionAnswer(questionId, newAnswer);
    
    // Update status display immediately (without rebuilding UI)
    this.updateQuestionStatusDisplay(questionId, newAnswer);
    
    console.log('Job Lander: Question answer updated:', questionId, newAnswer.length, 'chars');
  }

  updateQuestionStatusDisplay(questionId, answer) {
    const questionElement = this.sidebar?.querySelector(`[data-question-id="${questionId}"]`);
    if (questionElement) {
      const statusElement = questionElement.querySelector('.jl-question-status');
      if (statusElement) {
        const answerLength = answer ? answer.length : 0;
        
        // Determine color class based on answer length
        let colorClass = '';
        let statusText = 'No answer yet';
        
        if (answerLength >= 100) {
          colorClass = 'will-save';
          statusText = `✅ Will be saved (${answerLength} chars)`;
        } else if (answerLength > 0) {
          colorClass = 'too-short';
          statusText = `⚠️ Too short (${answerLength}/100 chars)`;
        }
        
        // Update the status element
        statusElement.className = 'jl-question-status';
        statusElement.textContent = statusText;
        
        // Update the parent question item class
        questionElement.className = `jl-question-item ${colorClass}`;
      }
    }
  }

  updateProgress(step) {
    const steps = this.sidebar?.querySelectorAll('.jl-step');
    if (!steps) return;

    steps.forEach(stepEl => {
      stepEl.classList.remove('active');
      if (stepEl.dataset.step === step) {
        stepEl.classList.add('active');
      }
    });
  }

  showAddQuestionForm() {
    if (!this.tracker || !this.tracker.dataCollector) return;
    
    // Create a temporary question ID
    const tempQuestionId = `manual-${Date.now()}`;
    
    // Add an empty question to the data collector
    this.tracker.dataCollector.detectedQuestions.set(tempQuestionId, {
      id: tempQuestionId,
      text: '',
      answer: '',
      element: null
    });
    
    // Force immediate UI rebuild to show the new question
    const allQuestions = Array.from(this.tracker.dataCollector.detectedQuestions.values());
    this.forceUpdateQuestions(allQuestions);
    
    // Focus on the question text input
    setTimeout(() => {
      const newQuestionInput = this.sidebar?.querySelector(`input[data-question-id="${tempQuestionId}"]`);
      if (newQuestionInput) {
        newQuestionInput.focus();
      }
    }, 100);
    
    console.log('Job Lander: Manual question added:', tempQuestionId);
  }

  showSuccess(message) {
    this.showStatusMessage(message, 'success');
  }

  showError(message) {
    this.showStatusMessage(message, 'error');
  }

  showStatusMessage(message, type) {
    const container = this.sidebar?.querySelector('#jl-status-messages');
    if (!container) return;

    const messageEl = document.createElement('div');
    messageEl.className = `jl-status-message jl-status-${type}`;
    messageEl.innerHTML = `
      <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
        ${type === 'success' 
          ? '<path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>'
          : '<path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>'
        }
      </svg>
      ${message}
    `;

    container.appendChild(messageEl);

    // Auto remove after 5 seconds
    setTimeout(() => {
      if (messageEl.parentNode) {
        messageEl.parentNode.removeChild(messageEl);
      }
    }, 5000);
  }
}

// Make available globally
window.SidebarManager = SidebarManager;
