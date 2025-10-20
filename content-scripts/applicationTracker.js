// Application Tracker - Main orchestrator for multi-step job application tracking
class ApplicationTracker {
  constructor() {
    this.isTracking = false;
    this.applicationData = {
      // Job posting data
      jobTitle: '',
      companyName: '',
      description: '',
      jobType: '',
      location: '',
      salary: '',
      link: window.location.href,
      
      // User selections (required)
      companyId: null,
      submittedCvId: null,
      
      // Progressive data
      questions: [],
      userAnswers: new Map(),
      currentStep: 'job_posting',
      steps: ['job_posting', 'application', 'complete'],
      
      // API format data
      stage: 'Applied',
      status: 'Pending',
      atsScore: 0,
      contactedEmployeeIds: []
    };
    
    this.sidebarManager = null;
    this.pageDetector = null;
    this.dataCollector = null;
    
    this.init();
  }

  init() {
    // Only initialize on job posting pages
    if (this.isJobPostingPage()) {
      this.addStartTrackingButton();
      console.log('Job Lander: Application tracker initialized on job posting page');
    }
  }

  isJobPostingPage() {
    const url = window.location.href.toLowerCase();
    const pathname = window.location.pathname.toLowerCase();
    
    // LinkedIn job posting patterns
    if (url.includes('linkedin.com/jobs/view')) return true;
    if (url.includes('linkedin.com/jobs/collections') && url.includes('jobId=')) return true;
    
    // Indeed job posting patterns
    if (url.includes('indeed.com/viewjob')) return true;
    if (url.includes('indeed.com') && pathname.includes('/jobs/')) return true;
    
    // Glassdoor job posting patterns
    if (url.includes('glassdoor.com/job-listing')) return true;
    if (url.includes('glassdoor.com') && pathname.includes('/jobs/')) return true;
    
    // WhiteCarrot ATS platform
    if (url.includes('whitecarrot.io') && pathname.includes('/role/')) return true;
    
    // Greenhouse ATS
    if (url.includes('greenhouse.io') || url.includes('boards.greenhouse.io')) return true;
    
    // Lever ATS
    if (url.includes('lever.co/') && pathname.includes('/jobs/')) return true;
    
    // Workday ATS
    if (url.includes('myworkdayjobs.com') || url.includes('wd1.myworkdaysite.com')) return true;
    
    // Ashby ATS (pattern: jobs.ashbyhq.com/company-name/job-uuid)
    if (url.includes('ashbyhq.com') || url.includes('jobs.ashbyhq.com')) return true;
    
    // Generic job posting patterns
    if (pathname.includes('job') && !pathname.includes('apply')) return true;
    if (pathname.includes('career') && !pathname.includes('apply')) return true;
    if (pathname.includes('position') && !pathname.includes('apply')) return true;
    if (pathname.includes('opening') && !pathname.includes('apply')) return true;
    
    // Check query parameters for job indicators
    if (url.includes('jobboard=') || url.includes('jobid=') || url.includes('job_id=')) return true;
    
    return false;
  }

  addStartTrackingButton() {
    // Remove existing button if any
    const existingButton = document.getElementById('job-lander-start-tracking');
    if (existingButton) {
      existingButton.remove();
    }

    const button = document.createElement('div');
    button.id = 'job-lander-start-tracking';
    button.innerHTML = `
      <div style="
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 999999;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 14px 20px;
        border-radius: 12px;
        cursor: pointer;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        font-weight: 600;
        box-shadow: 0 8px 25px rgba(102, 126, 234, 0.4);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        display: flex;
        align-items: center;
        gap: 10px;
        border: none;
        user-select: none;
      " 
      onmouseover="this.style.transform='translateY(-3px) scale(1.02)'; this.style.boxShadow='0 12px 35px rgba(102, 126, 234, 0.5)'" 
      onmouseout="this.style.transform='translateY(0) scale(1)'; this.style.boxShadow='0 8px 25px rgba(102, 126, 234, 0.4)'">
        <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
        Start Tracking Application
      </div>
    `;

    button.addEventListener('click', () => {
      this.startTracking();
    });

    document.body.appendChild(button);
  }

  async startTracking() {
    try {
      this.isTracking = true;
      
      // Hide the start button
      const startButton = document.getElementById('job-lander-start-tracking');
      if (startButton) {
        startButton.style.display = 'none';
      }
      
      // 1. Collect initial job posting data
      await this.collectJobPostingData();
      
      // 2. Initialize other components
      await this.initializeComponents();
      
      // 3. Show sidebar with collected data
      await this.sidebarManager.show();
      
      // 4. Start monitoring
      this.pageDetector.startMonitoring();
      this.dataCollector.startQuestionTracking();
      
      console.log('Job Lander: Application tracking started', this.applicationData);
      
    } catch (error) {
      console.error('Job Lander: Error starting tracking:', error);
      this.showErrorNotification('Failed to start tracking. Please try again.');
    }
  }

  async initializeComponents() {
    // Dynamically import and initialize components
    if (!this.sidebarManager) {
      // We'll create these as separate files
      this.sidebarManager = new SidebarManager(this);
      this.pageDetector = new PageDetector(this);
      this.dataCollector = new DataCollector(this);
    }
  }

  async collectJobPostingData() {
    // Use the new intelligent job data extractor
    if (!window.JobDataExtractor) {
      console.error('Job Lander: JobDataExtractor not loaded');
      return;
    }

    const extractor = new JobDataExtractor();
    const jobData = await extractor.extract();
    
    // Update application data with extracted fields
    Object.assign(this.applicationData, {
      jobTitle: jobData.jobTitle || '',
      companyName: jobData.companyName || '',
      description: jobData.jobDescription || '',
      jobType: jobData.jobType || '',
      location: jobData.location || '',
      salary: jobData.salary || '',
      link: window.location.href
    });

    console.log('Job Lander: Collected job posting data', this.applicationData);
  }

  stopTracking() {
    this.isTracking = false;
    
    if (this.sidebarManager) {
      this.sidebarManager.hide();
    }
    if (this.pageDetector) {
      this.pageDetector.stopMonitoring();
    }
    if (this.dataCollector) {
      this.dataCollector.stopQuestionTracking();
    }
    
    // Show start button again
    const startButton = document.getElementById('job-lander-start-tracking');
    if (startButton) {
      startButton.style.display = 'flex';
    }
    
    console.log('Job Lander: Application tracking stopped');
  }

  async saveApplication() {
    try {
      // Get current values from sidebar inputs
      const currentData = this.sidebarManager.getCurrentJobData();
      
      // Merge with existing data (user edits take priority)
      const mergedData = {
        ...this.applicationData,
        ...currentData
      };
      
      // Validate required fields
      if (!mergedData.companyId) {
        this.sidebarManager.showError('Please select a company');
        return;
      }

      if (!mergedData.cvId) {
        this.sidebarManager.showError('Please select a CV');
        return;
      }

      // Prepare data for API
      const apiData = {
        companyId: parseInt(mergedData.companyId),
        jobTitle: mergedData.jobTitle,
        jobType: mergedData.jobType || 'Full-time',
        description: mergedData.description,
        link: this.applicationData.link,
        submittedCvId: parseInt(mergedData.cvId),
        atsScore: this.applicationData.atsScore || 0,
        stage: this.applicationData.stage || 'Applied',
        status: this.applicationData.status || 'Pending',
        submissionDate: new Date().toISOString().split('T')[0],
        contactedEmployeeIds: this.applicationData.contactedEmployeeIds || []
      };

      // Filter questions to only include answers >= 100 characters (final safeguard)
      const validQuestions = Array.from(this.applicationData.userAnswers.entries())
        .filter(([questionText, answer]) => answer && answer.length >= 100)
        .map(([questionText, answer]) => ({
          question1: questionText,
          answer: answer,
          type: 'Technical',
          answerStatus: 'Completed',
          difficulty: 3,
          preparationNote: '',
          favorite: false,
          tags: []
        }));
      
      console.log(`Job Lander: Saving ${validQuestions.length} questions with valid answers (≥100 chars)`);

      // Send to background script
      const response = await chrome.runtime.sendMessage({
        type: 'SAVE_TRACKED_APPLICATION',
        data: {
          application: apiData,
          questions: validQuestions
        }
      });

      if (response.success) {
        this.sidebarManager.showSuccess('Application saved successfully!');
        setTimeout(() => {
          this.stopTracking();
        }, 2000);
      } else {
        throw new Error(response.error || 'Failed to save application');
      }
    } catch (error) {
      console.error('Job Lander: Error saving application:', error);
      this.sidebarManager.showError('Failed to save application: ' + error.message);
    }
  }

  // Event handlers
  onPageChange(pageType, url) {
    console.log('Job Lander: Page changed to', pageType, url);
    
    if (pageType === 'application_form') {
      this.applicationData.currentStep = 'application';
      this.sidebarManager.updateProgress('application');
    } else if (pageType === 'application_complete') {
      this.applicationData.currentStep = 'complete';
      this.sidebarManager.updateProgress('complete');
    }
  }

  updateQuestions(questions) {
    // Update questions list
    this.applicationData.questions = questions;
    if (this.sidebarManager) {
      this.sidebarManager.updateQuestions(questions);
    }
  }

  updateQuestionAnswer(questionId, answer) {
    // Only store answers with 100 or more characters
    if (answer.length >= 100) {
      const question = this.applicationData.questions.find(q => q.id === questionId);
      if (question) {
        this.applicationData.userAnswers.set(question.text, answer);
        console.log('Job Lander: Captured answer for question:', question.text.substring(0, 50) + '...');
      }
    }
  }

  updateCompanySelection(companyId) {
    this.applicationData.companyId = companyId;
    console.log('Job Lander: Company selected:', companyId);
  }

  updateCvSelection(cvId) {
    this.applicationData.submittedCvId = cvId;
    console.log('Job Lander: CV selected:', cvId);
  }

  showErrorNotification(message) {
    // Simple error notification
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      z-index: 999999;
      background: #ef4444;
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 5000);
  }
}

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.jobLanderTracker = new ApplicationTracker();
  });
} else {
  window.jobLanderTracker = new ApplicationTracker();
}
