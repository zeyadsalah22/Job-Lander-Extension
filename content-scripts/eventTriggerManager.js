// Event Trigger Manager - Dispatches proper events for form validation and state updates
class EventTriggerManager {
  constructor() {
    this.eventOptions = {
      bubbles: true,
      cancelable: true,
      composed: true
    };
  }

  /**
   * Trigger all necessary input events
   * @param {HTMLElement} element - The input element
   * @param {Object} options - Additional options
   */
  async triggerInputEvents(element, options = {}) {
    if (!element) {
      console.warn('Job Lander: No element provided to triggerInputEvents');
      return;
    }

    const { inputType = 'standard' } = options;

    try {
      // Sequence of events that most forms expect:
      // 1. focusin (before focus)
      // 2. focus
      // 3. keydown (simulate typing)
      // 4. input (main event for React/Vue)
      // 5. keyup
      // 6. change
      // 7. blur (on focus loss)

      // Focus events
      this.dispatchEvent(element, 'focusin');
      await this.sleep(10);
      
      this.dispatchEvent(element, 'focus');
      await this.sleep(20);

      // Simulate typing for character count listeners
      this.dispatchEvent(element, 'keydown', { key: 'a', code: 'KeyA' });
      await this.sleep(10);

      // Main input event (critical for React/Vue)
      this.dispatchInputEvent(element);
      await this.sleep(20);

      // Keyup event
      this.dispatchEvent(element, 'keyup', { key: 'a', code: 'KeyA' });
      await this.sleep(10);

      // Change event (critical for validation)
      this.dispatchEvent(element, 'change');
      await this.sleep(20);

      // Framework-specific events
      if (inputType === 'react') {
        await this.triggerReactEvents(element);
      } else if (inputType === 'vue') {
        await this.triggerVueEvents(element);
      }

      // Blur event (triggers validation in many forms)
      this.dispatchEvent(element, 'blur');
      await this.sleep(10);

      this.dispatchEvent(element, 'focusout');

      console.log('Job Lander: Triggered all events for element');

    } catch (error) {
      console.error('Job Lander: Error triggering events:', error);
    }
  }

  /**
   * Dispatch a standard event
   */
  dispatchEvent(element, eventType, eventInit = {}) {
    try {
      const event = new Event(eventType, {
        ...this.eventOptions,
        ...eventInit
      });
      
      element.dispatchEvent(event);
    } catch (error) {
      console.error(`Job Lander: Error dispatching ${eventType}:`, error);
    }
  }

  /**
   * Dispatch input event with proper inputType
   */
  dispatchInputEvent(element) {
    try {
      const inputEvent = new InputEvent('input', {
        ...this.eventOptions,
        inputType: 'insertText',
        data: element.value || element.textContent
      });
      
      element.dispatchEvent(inputEvent);
    } catch (error) {
      // Fallback to basic Event if InputEvent fails
      console.warn('Job Lander: InputEvent failed, using fallback');
      this.dispatchEvent(element, 'input');
    }
  }

  /**
   * Trigger React-specific events
   */
  async triggerReactEvents(element) {
    try {
      console.log('Job Lander: Triggering React-specific events');

      // Get React fiber
      const reactKey = Object.keys(element).find(key => 
        key.startsWith('__reactProps') || 
        key.startsWith('__reactInternalInstance') ||
        key.startsWith('__reactFiber')
      );

      if (!reactKey) {
        console.log('Job Lander: No React fiber found');
        return;
      }

      // Get value for event
      const value = element.value || element.textContent || '';

      // Create and dispatch React synthetic events
      const nativeEvent = new Event('input', this.eventOptions);
      const syntheticEvent = {
        ...nativeEvent,
        target: element,
        currentTarget: element,
        nativeEvent: nativeEvent,
        bubbles: true,
        cancelable: true,
        defaultPrevented: false,
        eventPhase: 3,
        isTrusted: true,
        timeStamp: Date.now(),
        type: 'input'
      };

      // Dispatch using the element's React event handlers
      element.dispatchEvent(nativeEvent);

      // Additional React-specific events
      const changeEvent = new Event('change', this.eventOptions);
      element.dispatchEvent(changeEvent);

      await this.sleep(50);

    } catch (error) {
      console.error('Job Lander: Error with React events:', error);
    }
  }

  /**
   * Trigger Vue-specific events
   */
  async triggerVueEvents(element) {
    try {
      console.log('Job Lander: Triggering Vue-specific events');

      // If Vue instance exists, use Vue's event system
      if (element.__vue__) {
        const value = element.value || element.textContent || '';
        
        // Emit input event (v-model)
        element.__vue__.$emit('input', value);
        element.__vue__.$emit('change', value);
        
        console.log('Job Lander: Emitted Vue events');
      }

      // Also dispatch native events
      this.dispatchEvent(element, 'input');
      this.dispatchEvent(element, 'change');

      await this.sleep(50);

    } catch (error) {
      console.error('Job Lander: Error with Vue events:', error);
    }
  }

  /**
   * Trigger keyboard events for character count listeners
   */
  triggerKeyboardEvents(element, text) {
    try {
      // Simulate typing each character
      for (let i = 0; i < Math.min(text.length, 10); i++) {
        const char = text[i];
        
        // Key down
        const keyDownEvent = new KeyboardEvent('keydown', {
          key: char,
          code: `Key${char.toUpperCase()}`,
          charCode: char.charCodeAt(0),
          keyCode: char.charCodeAt(0),
          which: char.charCodeAt(0),
          ...this.eventOptions
        });
        element.dispatchEvent(keyDownEvent);

        // Key press (deprecated but some forms still use it)
        const keyPressEvent = new KeyboardEvent('keypress', {
          key: char,
          charCode: char.charCodeAt(0),
          keyCode: char.charCodeAt(0),
          which: char.charCodeAt(0),
          ...this.eventOptions
        });
        element.dispatchEvent(keyPressEvent);

        // Key up
        const keyUpEvent = new KeyboardEvent('keyup', {
          key: char,
          code: `Key${char.toUpperCase()}`,
          charCode: char.charCodeAt(0),
          keyCode: char.charCodeAt(0),
          which: char.charCodeAt(0),
          ...this.eventOptions
        });
        element.dispatchEvent(keyUpEvent);
      }
    } catch (error) {
      console.error('Job Lander: Error triggering keyboard events:', error);
    }
  }

  /**
   * Wait for form validation to complete
   * @param {HTMLElement} element - The input element
   * @param {Number} timeout - Max wait time in ms
   */
  async waitForValidation(element, timeout = 500) {
    const startTime = Date.now();
    
    try {
      // Wait for any validation messages or error states to appear
      await this.sleep(100);

      // Check if element is still valid
      let iterations = 0;
      const maxIterations = timeout / 50;

      while (iterations < maxIterations) {
        // Check for validation attributes
        const isValid = element.validity?.valid !== false;
        const hasValidationMessage = !element.validationMessage;
        
        // Check for common error indicators in DOM
        const hasErrorClass = element.classList.contains('error') || 
                             element.classList.contains('invalid') ||
                             element.classList.contains('is-invalid');

        const hasErrorSibling = this.hasErrorSibling(element);

        // If we see validation happening, wait a bit more
        if (hasErrorClass || hasErrorSibling || !isValid) {
          await this.sleep(50);
          iterations++;
        } else {
          // Validation seems complete
          break;
        }
      }

      // Final wait to ensure any async validation completes
      await this.sleep(100);

    } catch (error) {
      console.error('Job Lander: Error waiting for validation:', error);
      // Just wait the minimum time if error occurs
      await this.sleep(timeout);
    }
  }

  /**
   * Check if element has error message siblings
   */
  hasErrorSibling(element) {
    try {
      const parent = element.parentElement;
      if (!parent) return false;

      // Look for common error message elements
      const errorSelectors = [
        '.error',
        '.error-message',
        '.invalid-feedback',
        '.field-error',
        '[role="alert"]',
        '.help-block.error'
      ];

      for (const selector of errorSelectors) {
        const errorElement = parent.querySelector(selector);
        if (errorElement && errorElement.textContent.trim()) {
          return true;
        }
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Trigger clipboard events (for paste simulation)
   */
  triggerClipboardEvents(element, text) {
    try {
      // Create clipboard data
      const dataTransfer = new DataTransfer();
      dataTransfer.setData('text/plain', text);

      // Paste event
      const pasteEvent = new ClipboardEvent('paste', {
        ...this.eventOptions,
        clipboardData: dataTransfer
      });

      element.dispatchEvent(pasteEvent);
    } catch (error) {
      console.error('Job Lander: Error triggering clipboard events:', error);
    }
  }

  /**
   * Trigger composition events (for IME input)
   */
  triggerCompositionEvents(element, text) {
    try {
      // Composition start
      const compositionStartEvent = new CompositionEvent('compositionstart', {
        ...this.eventOptions,
        data: ''
      });
      element.dispatchEvent(compositionStartEvent);

      // Composition update
      const compositionUpdateEvent = new CompositionEvent('compositionupdate', {
        ...this.eventOptions,
        data: text
      });
      element.dispatchEvent(compositionUpdateEvent);

      // Composition end
      const compositionEndEvent = new CompositionEvent('compositionend', {
        ...this.eventOptions,
        data: text
      });
      element.dispatchEvent(compositionEndEvent);
    } catch (error) {
      console.error('Job Lander: Error triggering composition events:', error);
    }
  }

  /**
   * Trigger mutation events (legacy but some forms still use them)
   */
  triggerMutationEvents(element) {
    try {
      // DOMSubtreeModified (deprecated but still used by some forms)
      const mutationEvent = new MutationEvent();
      mutationEvent.initMutationEvent('DOMSubtreeModified', true, false, null, '', '', '', 0);
      element.dispatchEvent(mutationEvent);
    } catch (error) {
      // Mutation events might not be supported, that's okay
      console.debug('Job Lander: Mutation events not supported');
    }
  }

  /**
   * Trigger all possible events (comprehensive approach)
   */
  async triggerAllEvents(element, value) {
    // Standard events
    await this.triggerInputEvents(element);
    
    // Keyboard events
    this.triggerKeyboardEvents(element, value);
    
    // Clipboard events
    this.triggerClipboardEvents(element, value);
    
    // Composition events (for international input)
    this.triggerCompositionEvents(element, value);
    
    // Wait for everything to settle
    await this.sleep(200);
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Make available globally
window.EventTriggerManager = EventTriggerManager;
