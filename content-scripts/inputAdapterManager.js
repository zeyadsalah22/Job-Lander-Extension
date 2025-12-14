// Input Adapter Manager - Handles different input types with specialized adapters
class InputAdapterManager {
  constructor() {
    this.adapters = {
      standard: new StandardInputAdapter(),
      react: new ReactInputAdapter(),
      vue: new VueInputAdapter(),
      contentEditable: new ContentEditableAdapter(),
      wysiwyg: new WYSIWYGAdapter(),
      select: new SelectAdapter()
    };
  }

  /**
   * Detect input type by analyzing the element
   * Priority: WYSIWYG > ContentEditable > React > Vue > Select > Standard
   */
  detectInputType(element) {
    if (!element) return 'standard';

    // Check for WYSIWYG editors first (most specific)
    if (this.isWYSIWYG(element)) {
      return 'wysiwyg';
    }

    // Check for contentEditable
    if (element.contentEditable === 'true' || element.isContentEditable) {
      return 'contentEditable';
    }

    // Check for select elements
    if (element.tagName === 'SELECT') {
      return 'select';
    }

    // Check for React
    if (this.isReactInput(element)) {
      return 'react';
    }

    // Check for Vue
    if (this.isVueInput(element)) {
      return 'vue';
    }

    // Default to standard
    return 'standard';
  }

  /**
   * Fill input using appropriate adapter
   */
  async fillInput(element, value, inputType) {
    const adapter = this.getAdapter(inputType);
    
    if (!adapter) {
      console.error('Job Lander: No adapter found for type:', inputType);
      return { success: false, error: 'No adapter available' };
    }

    try {
      return await adapter.fill(element, value);
    } catch (error) {
      console.error('Job Lander: Adapter error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get adapter instance
   */
  getAdapter(inputType) {
    return this.adapters[inputType] || this.adapters.standard;
  }

  /**
   * Check if element is React input
   */
  isReactInput(element) {
    // Check for React fiber properties
    const keys = Object.keys(element);
    return keys.some(key => 
      key.startsWith('__reactProps') || 
      key.startsWith('__reactInternalInstance') ||
      key.startsWith('__reactFiber')
    );
  }

  /**
   * Check if element is Vue input
   */
  isVueInput(element) {
    // Check for Vue properties
    return !!(element.__vue__ || element.__vnode || element._value !== undefined);
  }

  /**
   * Check if element is WYSIWYG editor
   */
  isWYSIWYG(element) {
    // Check for common WYSIWYG editor indicators
    const wysiwygClasses = ['tox-', 'ck-editor', 'ql-editor', 'fr-element', 'note-editable'];
    const elementClasses = element.className || '';
    
    if (wysiwygClasses.some(cls => elementClasses.includes(cls))) {
      return true;
    }

    // Check parent for WYSIWYG container
    let parent = element.parentElement;
    let depth = 0;
    while (parent && depth < 5) {
      const parentClasses = parent.className || '';
      if (wysiwygClasses.some(cls => parentClasses.includes(cls))) {
        return true;
      }
      parent = parent.parentElement;
      depth++;
    }

    // Check for editor-specific data attributes
    return !!(element.dataset.editor || element.closest('[data-editor]'));
  }
}

/**
 * Standard Input Adapter - For <input> and <textarea>
 */
class StandardInputAdapter {
  async fill(element, value) {
    try {
      // Focus element
      element.focus();
      await this.sleep(50);

      // Clear existing value
      element.value = '';
      
      // Set new value
      element.value = value;
      
      // Trigger input event
      const inputEvent = new Event('input', { bubbles: true, cancelable: true });
      element.dispatchEvent(inputEvent);
      
      await this.sleep(50);

      return { success: true };
    } catch (error) {
      console.error('Job Lander: Standard adapter error:', error);
      return { success: false, error: error.message };
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * React Input Adapter - For React-controlled inputs
 */
class ReactInputAdapter {
  async fill(element, value) {
    try {
      // Get React internal instance
      const reactKey = Object.keys(element).find(key => 
        key.startsWith('__reactProps') || 
        key.startsWith('__reactInternalInstance') ||
        key.startsWith('__reactFiber')
      );

      if (!reactKey) {
        // Fallback to standard method
        return new StandardInputAdapter().fill(element, value);
      }

      // Focus element
      element.focus();
      await this.sleep(50);

      // Get native setter
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set || Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value'
      )?.set;

      if (nativeInputValueSetter) {
        // Set value using native setter
        nativeInputValueSetter.call(element, value);
      } else {
        element.value = value;
      }

      // Dispatch React's synthetic events
      const inputEvent = new Event('input', { bubbles: true, cancelable: true });
      const changeEvent = new Event('change', { bubbles: true, cancelable: true });
      
      element.dispatchEvent(inputEvent);
      element.dispatchEvent(changeEvent);

      await this.sleep(50);

      return { success: true };
    } catch (error) {
      console.error('Job Lander: React adapter error:', error);
      // Fallback to standard method
      return new StandardInputAdapter().fill(element, value);
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Vue Input Adapter - For Vue v-model bindings
 */
class VueInputAdapter {
  async fill(element, value) {
    try {
      // Focus element
      element.focus();
      await this.sleep(50);

      // Set value
      element.value = value;

      // If Vue instance is available, update it directly
      if (element.__vue__) {
        element.__vue__.$emit('input', value);
      }

      // Dispatch events
      const inputEvent = new Event('input', { bubbles: true, cancelable: true });
      const changeEvent = new Event('change', { bubbles: true, cancelable: true });
      
      element.dispatchEvent(inputEvent);
      element.dispatchEvent(changeEvent);

      await this.sleep(50);

      return { success: true };
    } catch (error) {
      console.error('Job Lander: Vue adapter error:', error);
      // Fallback to standard method
      return new StandardInputAdapter().fill(element, value);
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * ContentEditable Adapter - For contenteditable divs
 */
class ContentEditableAdapter {
  async fill(element, value) {
    try {
      // Focus element
      element.focus();
      await this.sleep(50);

      // Clear existing content
      element.textContent = '';

      // Set new content
      element.textContent = value;

      // Dispatch events
      const inputEvent = new Event('input', { bubbles: true, cancelable: true });
      element.dispatchEvent(inputEvent);

      await this.sleep(50);

      return { success: true };
    } catch (error) {
      console.error('Job Lander: ContentEditable adapter error:', error);
      return { success: false, error: error.message };
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * WYSIWYG Adapter - For rich text editors
 */
class WYSIWYGAdapter {
  async fill(element, value) {
    try {
      console.log('Job Lander: Attempting WYSIWYG fill');

      // Try to detect specific editor type and use its API
      const editorType = this.detectEditorType(element);
      console.log('Job Lander: Detected editor type:', editorType);

      let filled = false;

      // TinyMCE
      if (editorType === 'tinymce' && window.tinymce) {
        const editor = this.findTinyMCEEditor(element);
        if (editor) {
          editor.setContent(value);
          filled = true;
        }
      }

      // Quill
      if (!filled && editorType === 'quill') {
        const quillInstance = this.findQuillInstance(element);
        if (quillInstance) {
          quillInstance.setText(value);
          filled = true;
        }
      }

      // CKEditor
      if (!filled && editorType === 'ckeditor' && window.CKEDITOR) {
        const editor = this.findCKEditor(element);
        if (editor) {
          editor.setData(value);
          filled = true;
        }
      }

      // Fallback to contentEditable
      if (!filled) {
        console.log('Job Lander: Falling back to contentEditable method');
        const contentEditableElement = this.findContentEditableElement(element);
        if (contentEditableElement) {
          return new ContentEditableAdapter().fill(contentEditableElement, value);
        }
      }

      if (filled) {
        return { success: true };
      } else {
        return { success: false, error: 'Could not find editor API or editable element' };
      }
    } catch (error) {
      console.error('Job Lander: WYSIWYG adapter error:', error);
      return { success: false, error: error.message };
    }
  }

  detectEditorType(element) {
    const classes = element.className || '';
    
    if (classes.includes('tox-') || element.closest('.tox-tinymce')) {
      return 'tinymce';
    }
    if (classes.includes('ql-editor') || element.closest('.ql-container')) {
      return 'quill';
    }
    if (classes.includes('ck-editor') || element.closest('.ck-editor')) {
      return 'ckeditor';
    }
    if (classes.includes('fr-element') || element.closest('.fr-box')) {
      return 'froala';
    }
    
    return 'unknown';
  }

  findTinyMCEEditor(element) {
    if (!window.tinymce) return null;
    
    // Try to find by ID
    const editorId = element.id;
    if (editorId && tinymce.get(editorId)) {
      return tinymce.get(editorId);
    }

    // Try to find by searching through all editors
    const editors = tinymce.editors;
    for (let editor of editors) {
      if (editor.getElement() === element || editor.getBody() === element) {
        return editor;
      }
    }

    return null;
  }

  findQuillInstance(element) {
    // Quill stores instance in __quill property
    let current = element;
    let depth = 0;
    while (current && depth < 5) {
      if (current.__quill) {
        return current.__quill;
      }
      current = current.parentElement;
      depth++;
    }
    return null;
  }

  findCKEditor(element) {
    if (!window.CKEDITOR) return null;

    // Try to find by ID
    const editorId = element.id;
    if (editorId && CKEDITOR.instances[editorId]) {
      return CKEDITOR.instances[editorId];
    }

    // Try to find by searching through all instances
    for (let name in CKEDITOR.instances) {
      const editor = CKEDITOR.instances[name];
      if (editor.element.$ === element) {
        return editor;
      }
    }

    return null;
  }

  findContentEditableElement(element) {
    // Try the element itself
    if (element.contentEditable === 'true') {
      return element;
    }

    // Search within element
    const editable = element.querySelector('[contenteditable="true"]');
    if (editable) {
      return editable;
    }

    // Search parents
    let parent = element.parentElement;
    let depth = 0;
    while (parent && depth < 5) {
      const editable = parent.querySelector('[contenteditable="true"]');
      if (editable) {
        return editable;
      }
      parent = parent.parentElement;
      depth++;
    }

    return null;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Select Adapter - For <select> elements
 */
class SelectAdapter {
  async fill(element, value) {
    try {
      // For select elements, we need to match options
      // This is a simple implementation - could be enhanced
      
      // Try to find matching option by text
      const options = Array.from(element.options);
      const matchingOption = options.find(opt => 
        opt.text.toLowerCase().includes(value.toLowerCase()) ||
        opt.value.toLowerCase().includes(value.toLowerCase())
      );

      if (matchingOption) {
        element.value = matchingOption.value;
        
        // Trigger change event
        const changeEvent = new Event('change', { bubbles: true, cancelable: true });
        element.dispatchEvent(changeEvent);
        
        return { success: true };
      } else {
        return { success: false, error: 'No matching option found' };
      }
    } catch (error) {
      console.error('Job Lander: Select adapter error:', error);
      return { success: false, error: error.message };
    }
  }
}

// Make available globally
window.InputAdapterManager = InputAdapterManager;
