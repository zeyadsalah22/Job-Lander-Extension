// AutoFill Manager - Orchestrates AI-powered form auto-fill
class AutoFillManager {
  constructor(tracker) {
    this.tracker = tracker;
    this.inputAdapter = null; // Will be initialized when needed
    this.eventTrigger = null; // Will be initialized when needed
    this.isRunning = false;
    this.cancelRequested = false;
    this.progressCallback = null;
    this.currentQuestionIndex = 0;
    this.totalQuestions = 0;
    this.results = [];
  }

  /**
   * Initialize adapters (lazy loading)
   */
  initializeAdapters() {
    if (!this.inputAdapter && window.InputAdapterManager) {
      this.inputAdapter = new InputAdapterManager();
    }
    if (!this.eventTrigger && window.EventTriggerManager) {
      this.eventTrigger = new EventTriggerManager();
    }
  }

  /**
   * Start auto-fill process
   * @param {Array} questions - Array of detected questions
   * @param {Object} jobData - Job description and metadata
   * @param {Function} progressCallback - Callback for progress updates
   * @returns {Object} - Completion report
   */
  async startAutoFill(questions, jobData, progressCallback) {
    if (this.isRunning) {
      console.warn('Job Lander: Auto-fill already in progress');
      return { success: false, error: 'Auto-fill already running' };
    }

    console.log('Job Lander: Starting auto-fill process...', {
      questionCount: questions.length,
      hasJobData: !!jobData
    });

    // Initialize
    this.isRunning = true;
    this.cancelRequested = false;
    this.progressCallback = progressCallback;
    this.currentQuestionIndex = 0;
    this.totalQuestions = questions.length;
    this.results = [];

    // Initialize adapters
    this.initializeAdapters();

    if (!this.inputAdapter || !this.eventTrigger) {
      return this.handleError('Required adapters not loaded');
    }

    try {
      // Step 1: Validate prerequisites
      const validation = this.validatePrerequisites(questions, jobData);
      if (!validation.valid) {
        return this.handleError(validation.error);
      }

      // Step 2: Get user ID
      const userId = await this.getUserId();
      if (!userId) {
        return this.handleError('User not authenticated');
      }

      // Step 3: Filter questions that need answers (only completely empty ones)
      const questionsToFill = questions.filter(q => {
        const currentAnswer = q.answer || '';
        return currentAnswer.length === 0; // Only fill if completely empty
      });

      if (questionsToFill.length === 0) {
        this.updateProgress(100, 'All questions already have answers');
        return {
          success: true,
          filled: 0,
          skipped: questions.length,
          failed: 0,
          message: 'All questions already have answers'
        };
      }

      this.totalQuestions = questionsToFill.length;
      this.updateProgress(0, `Processing ${questionsToFill.length} questions...`);

      // Step 4: Request answers from API (batched for efficiency)
      const answers = await this.getAIAnswersBatch(
        questionsToFill, 
        jobData.description || '', 
        userId
      );

      if (!answers.success) {
        return this.handleError('Failed to get AI answers: ' + answers.error);
      }

      // Step 5: Fill each question
      for (let i = 0; i < questionsToFill.length; i++) {
        if (this.cancelRequested) {
          console.log('Job Lander: Auto-fill cancelled by user');
          break;
        }

        const question = questionsToFill[i];
        const answer = answers.data[i];

        this.currentQuestionIndex = i + 1;
        this.updateProgress(
          (i / questionsToFill.length) * 100,
          `Filling question ${i + 1} of ${questionsToFill.length}...`
        );

        // Fill the question
        const result = await this.fillQuestion(question, answer);
        this.results.push(result);

        // Small delay between fills to avoid overwhelming the page
        await this.sleep(300);
      }

      // Step 6: Generate completion report
      return this.generateReport();

    } catch (error) {
      console.error('Job Lander: Auto-fill error:', error);
      return this.handleError('Unexpected error: ' + error.message);
    } finally {
      this.isRunning = false;
      this.updateProgress(100, 'Auto-fill complete');
    }
  }

  /**
   * Fill a single question
   * @param {Object} question - Question object with inputElement
   * @param {String} answer - AI-generated answer
   * @returns {Object} - Result of fill operation
   */
  async fillQuestion(question, answer) {
    const result = {
      questionId: question.id,
      questionText: question.text,
      success: false,
      error: null
    };

    try {
      // Find the input element
      const inputElement = question.inputElement;
      
      if (!inputElement || !document.body.contains(inputElement)) {
        result.error = 'Input element not found or removed from DOM';
        return result;
      }

      // Scroll element into view
      inputElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await this.sleep(200);

      // Detect input type
      const inputType = this.inputAdapter.detectInputType(inputElement);
      console.log('Job Lander: Detected input type:', inputType, 'for question:', question.text.substring(0, 50));

      // Fill the input
      const fillResult = await this.inputAdapter.fillInput(inputElement, answer, inputType);
      
      if (!fillResult.success) {
        result.error = fillResult.error;
        return result;
      }

      // Trigger events
      await this.eventTrigger.triggerInputEvents(inputElement, { inputType });

      // Wait for validation
      await this.eventTrigger.waitForValidation(inputElement, 500);

      // Verify the value was set
      const verifyResult = this.verifyValueSet(inputElement, answer);
      if (!verifyResult.success) {
        result.error = 'Value verification failed: ' + verifyResult.error;
        return result;
      }

      // Update the question's answer in the tracker
      if (this.tracker && this.tracker.dataCollector) {
        this.tracker.dataCollector.updateQuestionAnswer(question.id, answer);
      }

      result.success = true;
      console.log('Job Lander: Successfully filled question:', question.text.substring(0, 50));

    } catch (error) {
      console.error('Job Lander: Error filling question:', error);
      result.error = error.message;
    }

    return result;
  }

  /**
   * Get AI answers from backend (batched)
   */
  async getAIAnswersBatch(questions, jobDescription, userId) {
    try {
      console.log('Job Lander: Requesting AI answers for', questions.length, 'questions');

      const response = await chrome.runtime.sendMessage({
        type: 'AUTO_FILL_GET_ANSWERS_BATCH',
        data: {
          userId: userId,
          questions: questions.map(q => q.text),
          jobDescription: jobDescription
        }
      });

      if (response && response.success && response.data) {
        console.log('Job Lander: Received', response.data.length, 'AI answers');
        return { success: true, data: response.data };
      } else {
        return { success: false, error: response?.error || 'Unknown error' };
      }
    } catch (error) {
      console.error('Job Lander: Error getting AI answers:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get single AI answer (fallback)
   */
  async getAIAnswer(questionText, jobDescription, userId) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'AUTO_FILL_GET_ANSWER',
        data: {
          userId: userId,
          question: questionText,
          jobDescription: jobDescription
        }
      });

      if (response && response.success) {
        return { success: true, answer: response.data };
      } else {
        return { success: false, error: response?.error || 'Unknown error' };
      }
    } catch (error) {
      console.error('Job Lander: Error getting AI answer:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get user ID from storage
   */
  async getUserId() {
    try {
      // Try to get from frontend localStorage first
      const userId = await this.getFromLocalStorage('userId');
      if (userId) {
        return userId;
      }

      // Fallback to extension storage
      const result = await chrome.storage.local.get(['cached_user_data']);
      return result.cached_user_data?.userId || null;
    } catch (error) {
      console.error('Job Lander: Error getting user ID:', error);
      return null;
    }
  }

  /**
   * Get value from frontend localStorage
   */
  async getFromLocalStorage(key) {
    return new Promise((resolve) => {
      try {
        const FRONTEND_URL = 'http://localhost:5173';
        chrome.tabs.query({ url: `${FRONTEND_URL}/*` }, (tabs) => {
          if (tabs.length > 0) {
            chrome.scripting.executeScript({
              target: { tabId: tabs[0].id },
              func: (storageKey) => localStorage.getItem(storageKey),
              args: [key]
            }, (results) => {
              resolve(results?.[0]?.result || null);
            });
          } else {
            resolve(null);
          }
        });
      } catch (error) {
        resolve(null);
      }
    });
  }

  /**
   * Validate prerequisites before starting
   */
  validatePrerequisites(questions, jobData) {
    if (!questions || questions.length === 0) {
      return { valid: false, error: 'No questions to fill' };
    }

    if (!Array.isArray(questions)) {
      return { valid: false, error: 'Questions must be an array' };
    }

    // Check if questions have input elements
    const questionsWithInputs = questions.filter(q => q.inputElement);
    if (questionsWithInputs.length === 0) {
      return { valid: false, error: 'No input elements found for questions' };
    }

    return { valid: true };
  }

  /**
   * Verify that value was actually set
   */
  verifyValueSet(element, expectedValue) {
    try {
      let actualValue = '';

      // Check different types of elements
      if (element.value !== undefined) {
        actualValue = element.value;
      } else if (element.textContent !== undefined) {
        actualValue = element.textContent;
      } else if (element.innerText !== undefined) {
        actualValue = element.innerText;
      }

      // Trim and compare (allow some flexibility)
      const actualTrimmed = actualValue.trim();
      const expectedTrimmed = expectedValue.trim();

      if (actualTrimmed.length === 0) {
        return { success: false, error: 'Value is empty' };
      }

      // Check if at least 80% of the expected value is present
      if (actualTrimmed.length >= expectedTrimmed.length * 0.8) {
        return { success: true };
      }

      return { success: false, error: 'Value mismatch' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Update progress
   */
  updateProgress(percentage, message) {
    if (this.progressCallback) {
      this.progressCallback({
        percentage: Math.round(percentage),
        currentQuestion: this.currentQuestionIndex,
        totalQuestions: this.totalQuestions,
        message: message
      });
    }
  }

  /**
   * Cancel auto-fill process
   */
  cancel() {
    console.log('Job Lander: Auto-fill cancellation requested');
    this.cancelRequested = true;
    this.updateProgress(100, 'Auto-fill cancelled');
  }

  /**
   * Generate completion report
   */
  generateReport() {
    const successful = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    const cancelled = this.cancelRequested;

    const report = {
      success: true,
      filled: successful,
      skipped: 0,
      failed: failed,
      cancelled: cancelled,
      message: cancelled 
        ? `Auto-fill cancelled. Filled ${successful} questions.`
        : `Filled ${successful} of ${this.totalQuestions} questions.`,
      details: this.results
    };

    console.log('Job Lander: Auto-fill report:', report);
    return report;
  }

  /**
   * Handle errors
   */
  handleError(errorMessage) {
    console.error('Job Lander: Auto-fill error:', errorMessage);
    this.isRunning = false;
    this.updateProgress(100, 'Error: ' + errorMessage);
    
    return {
      success: false,
      filled: 0,
      skipped: 0,
      failed: this.totalQuestions,
      error: errorMessage,
      details: this.results
    };
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current state
   */
  getState() {
    return {
      isRunning: this.isRunning,
      cancelRequested: this.cancelRequested,
      currentQuestion: this.currentQuestionIndex,
      totalQuestions: this.totalQuestions,
      results: this.results
    };
  }
}

// Make available globally
window.AutoFillManager = AutoFillManager;
