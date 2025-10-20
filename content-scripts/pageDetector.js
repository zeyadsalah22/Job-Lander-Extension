// Page Detector - Monitors page changes and navigation for application tracking
class PageDetector {
  constructor(tracker) {
    this.tracker = tracker;
    this.observer = null;
    this.currentUrl = window.location.href;
    this.isMonitoring = false;
    this.urlChangeCallbacks = [];
  }

  startMonitoring() {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    
    // Monitor URL changes (for SPAs like LinkedIn)
    this.monitorUrlChanges();
    
    // Monitor DOM changes that might indicate page transitions
    this.monitorDomChanges();
    
    // Monitor form submissions
    this.monitorFormSubmissions();
    
    console.log('Job Lander: Page detection started');
  }

  stopMonitoring() {
    this.isMonitoring = false;
    
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    
    // Restore original methods
    if (this.originalPushState) {
      history.pushState = this.originalPushState;
    }
    if (this.originalReplaceState) {
      history.replaceState = this.originalReplaceState;
    }
    
    console.log('Job Lander: Page detection stopped');
  }

  monitorUrlChanges() {
    // Store original methods
    this.originalPushState = history.pushState;
    this.originalReplaceState = history.replaceState;
    
    // Override pushState
    history.pushState = (...args) => {
      this.originalPushState.apply(history, args);
      setTimeout(() => this.handleUrlChange(), 100);
    };
    
    // Override replaceState
    history.replaceState = (...args) => {
      this.originalReplaceState.apply(history, args);
      setTimeout(() => this.handleUrlChange(), 100);
    };
    
    // Listen for popstate (back/forward buttons)
    window.addEventListener('popstate', () => {
      setTimeout(() => this.handleUrlChange(), 100);
    });
    
    // Listen for hashchange
    window.addEventListener('hashchange', () => {
      setTimeout(() => this.handleUrlChange(), 100);
    });
  }

  monitorDomChanges() {
    this.observer = new MutationObserver((mutations) => {
      if (!this.isMonitoring) return;

      let significantChange = false;
      
      mutations.forEach((mutation) => {
        // Check for significant DOM changes that might indicate page navigation
        if (mutation.type === 'childList') {
          // Look for major content changes
          const addedNodes = Array.from(mutation.addedNodes);
          const removedNodes = Array.from(mutation.removedNodes);
          
          // Check if main content areas changed
          const significantSelectors = [
            'main', '[role="main"]', '.main-content', 
            '.job-details', '.application-form', '.jobs-apply',
            '.jobs-unified-top-card', '.jobsearch-SerpJobCard'
          ];
          
          const hasSignificantChange = [...addedNodes, ...removedNodes].some(node => {
            if (node.nodeType !== Node.ELEMENT_NODE) return false;
            
            return significantSelectors.some(selector => {
              return node.matches && (node.matches(selector) || node.querySelector(selector));
            });
          });
          
          if (hasSignificantChange) {
            significantChange = true;
          }
        }
      });
      
      if (significantChange) {
        setTimeout(() => this.handleContentChange(), 500);
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false
    });
  }

  monitorFormSubmissions() {
    // Listen for form submissions that might indicate application progress
    document.addEventListener('submit', (e) => {
      if (!this.isMonitoring) return;
      
      const form = e.target;
      if (this.isApplicationForm(form)) {
        console.log('Job Lander: Application form submitted');
        
        // Wait a bit for the submission to process
        setTimeout(() => {
          this.handleFormSubmission(form);
        }, 1000);
      }
    });
    
    // Listen for button clicks that might trigger navigation
    document.addEventListener('click', (e) => {
      if (!this.isMonitoring) return;
      
      const button = e.target.closest('button, a, [role="button"]');
      if (button && this.isApplicationButton(button)) {
        console.log('Job Lander: Application button clicked');
        
        setTimeout(() => {
          this.handleUrlChange();
        }, 500);
      }
    });
  }

  handleUrlChange() {
    if (!this.isMonitoring) return;
    
    const newUrl = window.location.href;
    if (newUrl !== this.currentUrl) {
      console.log('Job Lander: URL changed from', this.currentUrl, 'to', newUrl);
      
      const oldPageType = this.detectPageType(this.currentUrl);
      const newPageType = this.detectPageType(newUrl);
      
      this.currentUrl = newUrl;
      
      if (oldPageType !== newPageType) {
        console.log('Job Lander: Page type changed from', oldPageType, 'to', newPageType);
        this.tracker.onPageChange(newPageType, newUrl);
      }
    }
  }

  handleContentChange() {
    if (!this.isMonitoring) return;
    
    // Check if we're still on the same URL but content changed significantly
    const currentPageType = this.detectPageType(window.location.href);
    console.log('Job Lander: Content changed, page type:', currentPageType);
    
    // Notify tracker of content change
    this.tracker.onPageChange(currentPageType, window.location.href);
  }

  handleFormSubmission(form) {
    if (!this.isMonitoring) return;
    
    // Check if this might lead to a confirmation page
    setTimeout(() => {
      const pageType = this.detectPageType(window.location.href);
      if (pageType === 'application_complete') {
        this.tracker.onPageChange(pageType, window.location.href);
      }
    }, 2000);
  }

  detectPageType(url = window.location.href) {
    const urlLower = url.toLowerCase();
    const pathname = new URL(url).pathname.toLowerCase();
    const pageContent = document.body ? document.body.textContent.toLowerCase() : '';
    
    // LinkedIn patterns
    if (urlLower.includes('linkedin.com')) {
      if (urlLower.includes('/jobs/view/') || urlLower.includes('jobid=')) {
        return 'job_posting';
      }
      if (urlLower.includes('/jobs/application/') || urlLower.includes('apply')) {
        return 'application_form';
      }
      if (pageContent.includes('application submitted') || pageContent.includes('thank you for applying')) {
        return 'application_complete';
      }
    }
    
    // Indeed patterns
    if (urlLower.includes('indeed.com')) {
      if (urlLower.includes('/viewjob') || pathname.includes('/jobs/')) {
        return 'job_posting';
      }
      if (urlLower.includes('/apply') || pathname.includes('/apply')) {
        return 'application_form';
      }
      if (pageContent.includes('application submitted') || pageContent.includes('successfully applied')) {
        return 'application_complete';
      }
    }
    
    // Glassdoor patterns
    if (urlLower.includes('glassdoor.com')) {
      if (urlLower.includes('/job-listing/') || pathname.includes('/jobs/')) {
        return 'job_posting';
      }
      if (pathname.includes('/apply') || urlLower.includes('apply')) {
        return 'application_form';
      }
    }
    
    // Generic patterns
    if (pathname.includes('apply') || pathname.includes('application')) {
      // Check for completion indicators
      if (pageContent.includes('thank you') || 
          pageContent.includes('submitted') || 
          pageContent.includes('confirmation') ||
          pageContent.includes('success')) {
        return 'application_complete';
      }
      return 'application_form';
    }
    
    if (pathname.includes('job') || pathname.includes('career') || pathname.includes('position')) {
      return 'job_posting';
    }
    
    // Check page content for clues
    if (pageContent.includes('apply now') || pageContent.includes('submit application')) {
      return 'job_posting';
    }
    
    if (pageContent.includes('application form') || pageContent.includes('job application')) {
      return 'application_form';
    }
    
    return 'unknown';
  }

  isApplicationForm(form) {
    if (!form || form.tagName !== 'FORM') return false;
    
    const formText = form.textContent.toLowerCase();
    const formClasses = form.className.toLowerCase();
    const formId = form.id.toLowerCase();
    
    // Check for application-related keywords
    const applicationKeywords = [
      'apply', 'application', 'resume', 'cv', 'cover letter',
      'experience', 'qualification', 'why do you want',
      'tell us about', 'describe your'
    ];
    
    const hasApplicationKeywords = applicationKeywords.some(keyword => 
      formText.includes(keyword) || formClasses.includes(keyword) || formId.includes(keyword)
    );
    
    // Check for multiple form fields (indicates substantial form)
    const inputs = form.querySelectorAll('input, textarea, select');
    const hasMultipleFields = inputs.length >= 3;
    
    // Check for file upload (resume/CV upload)
    const hasFileUpload = form.querySelector('input[type="file"]') !== null;
    
    return hasApplicationKeywords && (hasMultipleFields || hasFileUpload);
  }

  isApplicationButton(button) {
    if (!button) return false;
    
    const buttonText = button.textContent.toLowerCase();
    const buttonClasses = button.className.toLowerCase();
    const buttonId = button.id.toLowerCase();
    
    const applicationButtonKeywords = [
      'apply', 'submit application', 'easy apply', 'quick apply',
      'apply now', 'continue application', 'next step', 'submit'
    ];
    
    return applicationButtonKeywords.some(keyword => 
      buttonText.includes(keyword) || 
      buttonClasses.includes(keyword.replace(/\s+/g, '-')) ||
      buttonId.includes(keyword.replace(/\s+/g, '-'))
    );
  }

  // Utility method to check if we're on a job site
  isJobSite() {
    const hostname = window.location.hostname.toLowerCase();
    const jobSites = [
      'linkedin.com', 'indeed.com', 'glassdoor.com',
      'monster.com', 'ziprecruiter.com', 'careerbuilder.com',
      'dice.com', 'simplyhired.com'
    ];
    
    return jobSites.some(site => hostname.includes(site));
  }

  // Get current page context for debugging
  getPageContext() {
    return {
      url: window.location.href,
      pathname: window.location.pathname,
      pageType: this.detectPageType(),
      isJobSite: this.isJobSite(),
      hasApplicationForms: document.querySelectorAll('form').length > 0,
      title: document.title,
      timestamp: new Date().toISOString()
    };
  }
}

// Make available globally
window.PageDetector = PageDetector;
