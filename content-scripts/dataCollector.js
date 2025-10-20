// Data Collector - Handles progressive data collection and question detection
class DataCollector {
  constructor(tracker) {
    this.tracker = tracker;
    this.questionObserver = null;
    this.formObserver = null;
    this.isTracking = false;
    this.detectedQuestions = new Map(); // questionId -> question object
    this.questionIdCounter = 0;
    this.deletedQuestionLabels = new Set(); // Store labels of deleted questions
  }

  startQuestionTracking() {
    if (this.isTracking) return;

    this.isTracking = true;
    
    // Start observing for new questions
    this.observeQuestions();
    
    // Start monitoring form inputs for answers
    this.observeFormInputs();
    
    // Initial scan for existing questions
    this.scanForQuestions();
    
    console.log('Job Lander: Question tracking started');
  }

  stopQuestionTracking() {
    this.isTracking = false;
    
    if (this.questionObserver) {
      this.questionObserver.disconnect();
      this.questionObserver = null;
    }
    
    if (this.formObserver) {
      this.formObserver.disconnect();
      this.formObserver = null;
    }
    
    // Clear the blacklist when stopping tracking (fresh start for new applications)
    this.deletedQuestionLabels.clear();
    
    console.log('Job Lander: Question tracking stopped and blacklist cleared');
  }

  observeQuestions() {
    this.questionObserver = new MutationObserver((mutations) => {
      if (!this.isTracking) return;

      let shouldScan = false;
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          // Check if new form elements were added
          const addedNodes = Array.from(mutation.addedNodes);
          const hasNewFormElements = addedNodes.some(node => {
            if (node.nodeType !== Node.ELEMENT_NODE) return false;
            
            return node.matches && (
              node.matches('form, label, fieldset, .question, [class*="question"], [class*="form"]') ||
              node.querySelector('form, label, fieldset, .question, [class*="question"], [class*="form"]')
            );
          });
          
          if (hasNewFormElements) {
            shouldScan = true;
          }
        }
      });
      
      if (shouldScan) {
        // Debounce the scanning to avoid excessive calls
        clearTimeout(this.scanTimeout);
        this.scanTimeout = setTimeout(() => {
          this.scanForQuestions();
        }, 500);
      }
    });

    this.questionObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: false
    });
  }

  observeFormInputs() {
    // Monitor all input changes
    document.addEventListener('input', (e) => {
      if (!this.isTracking) return;
      
      if (e.target.matches('input, textarea, select')) {
        this.handleInputChange(e.target);
      }
    });
    
    // Monitor focus events to detect which questions are being answered
    document.addEventListener('focus', (e) => {
      if (!this.isTracking) return;
      
      if (e.target.matches('input, textarea, select')) {
        this.handleInputFocus(e.target);
      }
    }, true);
  }

  scanForQuestions() {
    if (!this.isTracking) return;

    const newQuestions = [];
    
    // Focus only on input field labels and associated elements
    const inputElements = document.querySelectorAll('input, textarea, select');
    
    inputElements.forEach(input => {
      const questionData = this.extractQuestionFromInput(input);
      if (questionData && this.isValidQuestion(questionData.text)) {
        // Check if this question label was previously deleted
        const normalizedText = this.normalizeQuestionText(questionData.text);
        if (this.deletedQuestionLabels.has(normalizedText)) {
          console.log('Job Lander: Skipping deleted question:', questionData.text);
          return; // Skip this question
        }
        
        const questionId = this.generateQuestionId(questionData.text);
        
        if (!this.detectedQuestions.has(questionId)) {
          const question = {
            id: questionId,
            text: questionData.text,
            normalizedText: normalizedText,
            inputElement: input,
            labelElement: questionData.labelElement,
            type: this.categorizeQuestion(questionData.text),
            detectedAt: new Date().toISOString(),
            answer: input.value || ''
          };
          
          this.detectedQuestions.set(questionId, question);
          newQuestions.push(question);
          
          console.log('Job Lander: New question detected from input:', questionData.text);
        }
      }
    });

    if (newQuestions.length > 0) {
      console.log('Job Lander: Detected', newQuestions.length, 'new questions');
      this.updateTracker();
    }
  }

  extractQuestionFromInput(inputElement) {
    if (!inputElement) return null;

    let questionText = '';
    let labelElement = null;

    // Method 1: Look for associated label using 'for' attribute
    if (inputElement.id) {
      labelElement = document.querySelector(`label[for="${inputElement.id}"]`);
      if (labelElement) {
        questionText = this.cleanQuestionText(labelElement.textContent);
      }
    }

    // Method 2: Look for parent label
    if (!questionText) {
      labelElement = inputElement.closest('label');
      if (labelElement) {
        // Get text excluding the input element itself
        const clone = labelElement.cloneNode(true);
        const inputInClone = clone.querySelector('input, textarea, select');
        if (inputInClone) inputInClone.remove();
        questionText = this.cleanQuestionText(clone.textContent);
      }
    }

    // Method 3: Look for nearby text elements (aria-label, placeholder, etc.)
    if (!questionText) {
      // Check aria-label
      if (inputElement.getAttribute('aria-label')) {
        questionText = this.cleanQuestionText(inputElement.getAttribute('aria-label'));
      }
      // Check placeholder as fallback (only if it looks like a question)
      else if (inputElement.placeholder && inputElement.placeholder.includes('?')) {
        questionText = this.cleanQuestionText(inputElement.placeholder);
      }
      // Look for preceding text elements
      else {
        const precedingElements = this.findPrecedingQuestionElements(inputElement);
        if (precedingElements.length > 0) {
          questionText = precedingElements.map(el => this.cleanQuestionText(el.textContent)).join(' ');
          labelElement = precedingElements[0];
        }
      }
    }

    // Method 4: Look for fieldset legend or form section headers
    if (!questionText) {
      const fieldset = inputElement.closest('fieldset');
      if (fieldset) {
        const legend = fieldset.querySelector('legend');
        if (legend) {
          questionText = this.cleanQuestionText(legend.textContent);
          labelElement = legend;
        }
      }
    }

    if (!questionText) return null;

    return {
      text: questionText,
      labelElement: labelElement,
      inputElement: inputElement
    };
  }

  findPrecedingQuestionElements(inputElement) {
    const elements = [];
    let current = inputElement.previousElementSibling;
    
    // Look at up to 3 preceding siblings
    let count = 0;
    while (current && count < 3) {
      if (current.matches('label, span, div, p') && 
          current.textContent.trim() && 
          current.textContent.trim().length > 5) {
        elements.unshift(current);
        break; // Take the first meaningful preceding element
      }
      current = current.previousElementSibling;
      count++;
    }
    
    return elements;
  }

  cleanQuestionText(text) {
    if (!text) return '';
    
    return text
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[*:]+$/, '') // Remove trailing asterisks and colons
      .trim();
  }

  normalizeQuestionText(text) {
    if (!text) return '';
    
    return text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/[*:?!.]+/g, '') // Remove punctuation
      .replace(/\s+/g, '_') // Replace spaces with underscores for consistent matching
      .trim();
  }

  categorizeQuestion(text) {
    if (!text) return 'General';
    
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('experience') || lowerText.includes('skill') || lowerText.includes('technical')) {
      return 'Technical';
    } else if (lowerText.includes('why') || lowerText.includes('motivat') || lowerText.includes('interest')) {
      return 'Behavioral';
    } else if (lowerText.includes('salary') || lowerText.includes('compensation') || lowerText.includes('benefit')) {
      return 'Compensation';
    } else {
      return 'General';
    }
  }

  extractQuestionFromElement(element) {
    if (!element) return null;

    let text = '';
    let relatedInput = null;

    // Get text content
    if (element.tagName === 'LABEL') {
      text = element.textContent.trim();
      
      // Find related input
      if (element.htmlFor) {
        relatedInput = document.getElementById(element.htmlFor);
      } else {
        relatedInput = element.querySelector('input, textarea, select');
      }
    } else if (element.tagName === 'LEGEND') {
      text = element.textContent.trim();
      relatedInput = element.closest('fieldset')?.querySelector('input, textarea, select');
    } else {
      text = element.textContent.trim();
      
      // Try to find nearby input
      relatedInput = this.findNearbyInput(element);
    }

    return text ? { text, relatedInput } : null;
  }

  findNearbyInput(element) {
    // Look for inputs in the same parent container
    const parent = element.parentElement;
    if (parent) {
      // Check siblings
      const sibling = parent.querySelector('input, textarea, select');
      if (sibling) return sibling;
      
      // Check in next sibling containers
      let nextSibling = parent.nextElementSibling;
      while (nextSibling && nextSibling.tagName !== 'FORM') {
        const input = nextSibling.querySelector('input, textarea, select');
        if (input) return input;
        nextSibling = nextSibling.nextElementSibling;
      }
    }
    
    return null;
  }

  isValidQuestion(text) {
    if (!text || text.length < 10 || text.length > 500) return false;
    
    // Filter out common non-question labels
    const excludePatterns = [
      /^(name|email|phone|address|city|state|zip|country)$/i,
      /^(first name|last name|full name)$/i,
      /^(password|confirm password|username)$/i,
      /^(submit|cancel|save|next|previous|back)$/i,
      /^(yes|no|true|false|ok|cancel)$/i,
      /^(required|optional|\*|•)$/i,
      /^(loading|please wait|processing)$/i
    ];
    
    if (excludePatterns.some(pattern => pattern.test(text))) {
      return false;
    }
    
    // Look for question indicators
    const questionIndicators = [
      // Direct question markers
      /\?/,
      
      // Question words
      /\b(why|how|what|when|where|which|who|describe|explain|tell us|share|discuss)\b/i,
      
      // Experience/qualification related
      /\b(experience|skill|qualification|background|knowledge|expertise)\b/i,
      
      // Application specific
      /\b(motivat|interest|passion|goal|objective|strength|weakness)\b/i,
      
      // Behavioral questions
      /\b(example|situation|time when|challenge|problem|conflict)\b/i,
      
      // Requirements
      /\b(require|need|must|should|expect|prefer)\b/i
    ];
    
    return questionIndicators.some(pattern => pattern.test(text));
  }

  generateQuestionId(text) {
    // Create a simple hash of the question text
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString();
  }

  handleInputChange(input) {
    const value = input.value.trim();
    
    // Only process substantial answers (>100 characters as requested)
    if (value.length > 100) {
      const questionId = this.findQuestionForInput(input);
      if (questionId) {
        const question = this.detectedQuestions.get(questionId);
        if (question) {
          question.answered = true;
          question.answer = value;
          
          console.log('Job Lander: Captured substantial answer for question:', question.text.substring(0, 50) + '...');
          
          // Update tracker
          this.tracker.updateQuestionAnswer(questionId, value);
          this.updateTracker();
        }
      }
    }
  }

  handleInputFocus(input) {
    // When user focuses on an input, try to identify the related question
    const questionId = this.findQuestionForInput(input);
    if (questionId) {
      console.log('Job Lander: User focused on question:', questionId);
    }
  }

  findQuestionForInput(input) {
    // Try to find which question this input belongs to
    for (const [questionId, question] of this.detectedQuestions) {
      if (question.relatedInput === input) {
        return questionId;
      }
    }
    
    // If no direct match, try to find by proximity
    for (const [questionId, question] of this.detectedQuestions) {
      if (this.isInputNearElement(input, question.element)) {
        // Update the question's related input
        question.relatedInput = input;
        return questionId;
      }
    }
    
    return null;
  }

  isInputNearElement(input, element) {
    if (!input || !element) return false;
    
    // Check if they're in the same form
    const inputForm = input.closest('form');
    const elementForm = element.closest('form');
    if (inputForm && elementForm && inputForm === elementForm) {
      // Check if they're reasonably close in the DOM
      const inputRect = input.getBoundingClientRect();
      const elementRect = element.getBoundingClientRect();
      
      // Consider them related if they're within 200px vertically
      return Math.abs(inputRect.top - elementRect.top) < 200;
    }
    
    // Check if they're in the same container
    const commonParent = this.findCommonParent(input, element);
    if (commonParent) {
      const containerHeight = commonParent.getBoundingClientRect().height;
      return containerHeight < 300; // Reasonable container size
    }
    
    return false;
  }

  findCommonParent(element1, element2) {
    const parents1 = [];
    let current = element1;
    while (current && current !== document.body) {
      parents1.push(current);
      current = current.parentElement;
    }
    
    current = element2;
    while (current && current !== document.body) {
      if (parents1.includes(current)) {
        return current;
      }
      current = current.parentElement;
    }
    
    return null;
  }

  updateTracker() {
    const questions = Array.from(this.detectedQuestions.values());
    this.tracker.updateQuestions(questions);
  }

  // Get statistics for debugging
  getStats() {
    const questions = Array.from(this.detectedQuestions.values());
    return {
      totalQuestions: questions.length,
      answeredQuestions: questions.filter(q => q.answered).length,
      unansweredQuestions: questions.filter(q => !q.answered).length,
      questionsWithInputs: questions.filter(q => q.relatedInput).length,
      averageQuestionLength: questions.reduce((sum, q) => sum + q.text.length, 0) / questions.length || 0,
      blacklistedQuestions: this.deletedQuestionLabels.size,
      blacklistedLabels: Array.from(this.deletedQuestionLabels)
    };
  }

  // Manual question detection for testing
  detectQuestionsManually() {
    this.scanForQuestions();
    return Array.from(this.detectedQuestions.values());
  }

  removeQuestion(questionId) {
    if (this.detectedQuestions.has(questionId)) {
      const question = this.detectedQuestions.get(questionId);
      
      // Add to blacklist to prevent re-detection
      const normalizedText = question.normalizedText || this.normalizeQuestionText(question.text);
      this.deletedQuestionLabels.add(normalizedText);
      
      // Remove from current questions
      this.detectedQuestions.delete(questionId);
      
      // Also remove from tracker's user answers if it exists
      if (this.tracker && this.tracker.applicationData && this.tracker.applicationData.userAnswers) {
        this.tracker.applicationData.userAnswers.delete(question.text);
      }
      
      console.log('Job Lander: Question removed and blacklisted:', questionId, normalizedText);
      this.updateTracker();
    }
  }

  updateQuestionText(questionId, newText) {
    if (this.detectedQuestions.has(questionId)) {
      const question = this.detectedQuestions.get(questionId);
      const oldText = question.text;
      
      question.text = newText;
      
      // Update tracker's user answers map if the question text changed
      if (this.tracker && this.tracker.applicationData && this.tracker.applicationData.userAnswers) {
        const userAnswers = this.tracker.applicationData.userAnswers;
        if (userAnswers.has(oldText)) {
          const answer = userAnswers.get(oldText);
          userAnswers.delete(oldText);
          userAnswers.set(newText, answer);
        }
      }
      
      console.log('Job Lander: Question text updated:', questionId, newText);
      this.updateTracker();
    }
  }

  updateQuestionAnswer(questionId, newAnswer) {
    if (this.detectedQuestions.has(questionId)) {
      const question = this.detectedQuestions.get(questionId);
      question.answer = newAnswer;
      
      // Update tracker's user answers - only store answers >= 100 characters
      if (this.tracker && this.tracker.applicationData && this.tracker.applicationData.userAnswers) {
        if (newAnswer && newAnswer.length >= 100) {
          this.tracker.applicationData.userAnswers.set(question.text, newAnswer);
          console.log('Job Lander: Answer stored (≥100 chars):', questionId, newAnswer.length, 'chars');
        } else {
          // Remove from userAnswers if it falls below 100 chars
          this.tracker.applicationData.userAnswers.delete(question.text);
          if (newAnswer && newAnswer.length > 0) {
            console.log('Job Lander: Answer too short (not stored):', questionId, newAnswer.length, 'chars');
          }
        }
      }
      
      // Don't call updateTracker() for answer updates to avoid UI rebuilds
    }
  }
}

// Make available globally
window.DataCollector = DataCollector;
