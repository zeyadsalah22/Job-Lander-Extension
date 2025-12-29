// Background Service Worker for Job Lander Extension
// Note: Using dynamic imports since service workers don't support ES6 imports directly

class BackgroundManager {
  constructor() {
    this.init();
  }

  init() {
    // Listen for messages from content scripts
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async response
    });

    // Listen for extension installation
    chrome.runtime.onInstalled.addListener((details) => {
      this.handleInstallation(details);
    });

    // Listen for tab updates to inject content scripts if needed
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      this.handleTabUpdate(tabId, changeInfo, tab);
    });
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.type) {
        case 'SAVE_QUESTIONS':
          await this.handleQuestionsSave(message.data, sender);
          sendResponse({ success: true });
          break;

        case 'GET_APPLICATION_STATS':
          const stats = await this.getApplicationStats();
          sendResponse({ success: true, data: stats });
          break;

        case 'UPDATE_BADGE':
          await this.updateBadge(message.count);
          sendResponse({ success: true });
          break;

        case 'SAVE_TRACKED_APPLICATION':
          await this.handleTrackedApplicationSave(message.data, sender);
          sendResponse({ success: true });
          break;

        case 'GET_DROPDOWN_DATA':
          const dropdownData = await this.getDropdownData();
          sendResponse({ success: true, data: dropdownData });
          break;

        case 'AUTO_FILL_GET_ANSWER':
          const answer = await this.getAutoFillAnswer(message.data);
          sendResponse({ success: true, data: answer });
          break;

        case 'AUTO_FILL_GET_ANSWERS_BATCH':
          const answers = await this.getAutoFillAnswersBatch(message.data);
          sendResponse({ success: true, data: answers });
          break;

        case 'GET_USER_ID':
          const userId = await this.getUserId();
          sendResponse({ success: true, userId: userId });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  }


  async handleQuestionsSave(questionsData, sender) {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      // Transform questions to match backend format if they're not already
      const transformedQuestions = questionsData.map(q => {
        // If already in correct format, use as is, otherwise transform
        if (q.question1) {
          return q;
        } else {
          return {
            question1: q.questionText || q.question || q,
            answer: q.answer || '',
            applicationId: q.applicationId || 0,
            type: q.type || 'Technical',
            answerStatus: q.answerStatus || 'Pending',
            difficulty: q.difficulty || 3,
            preparationNote: q.preparationNote || '',
            favorite: q.favorite || false,
            tags: q.tags || []
          };
        }
      });

      const response = await fetch('http://localhost:5253/api/questions/batch', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ questions: transformedQuestions }),
      });

      if (response.ok) {
        await this.showNotification(
          'Questions Saved!',
          `Saved ${questionsData.length} interview questions`,
          'success'
        );
      } else {
        throw new Error('Failed to save questions');
      }
    } catch (error) {
      console.error('Error saving questions:', error);
      await this.showNotification(
        'Save Failed',
        'Failed to save questions. Please try again.',
        'error'
      );
      throw error;
    }
  }

  async saveApplicationToAPI(applicationData) {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      const response = await fetch('http://localhost:5253/api/applications', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(applicationData),
      });

      if (response.ok) {
        const result = await response.json();
        return { success: true, data: result };
      } else {
        let errorMessage = 'Failed to save application';
        try {
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            const errJson = await response.json();
            errorMessage = errJson.message || JSON.stringify(errJson);
          } else {
            const errText = await response.text();
            errorMessage = errText || errorMessage;
          }
        } catch (e) {
          // ignore parse errors
        }
        console.error('Application save failed:', {
          status: response.status,
          statusText: response.statusText,
          url: response.url,
          message: errorMessage
        });
        return { success: false, error: errorMessage };
      }
    } catch (error) {
      console.error('Error saving application:', error);
      return { success: false, error: error.message };
    }
  }

  async getAuthToken() {
    try {
      // Use the new auth manager to get valid token from frontend
      return await this.getValidTokenFromFrontend();
    } catch (error) {
      console.error('Error retrieving token:', error);
      return null;
    }
  }

  // Get valid token from frontend localStorage (similar to auth manager)
  async getValidTokenFromFrontend() {
    try {
      const FRONTEND_URL = 'http://localhost:5173';
      
      return new Promise((resolve) => {
        chrome.tabs.query({ url: `${FRONTEND_URL}/*` }, (tabs) => {
          if (tabs.length > 0) {
            chrome.scripting.executeScript({
              target: { tabId: tabs[0].id },
              func: () => {
                const accessToken = localStorage.getItem('access');
                const refreshToken = localStorage.getItem('refreshToken');
                
                if (!accessToken) return null;

                try {
                  // Validate token expiration
                  const payload = JSON.parse(atob(accessToken.split('.')[1]));
                  const currentTime = Date.now() / 1000;
                  
                  // If token is valid (with 5 min buffer), return it
                  if (payload.exp && payload.exp > (currentTime + 300)) {
                    return accessToken;
                  }
                  
                  // Token expired but we have refresh token
                  if (refreshToken) {
                    return { needsRefresh: true, refreshToken };
                  }
                  
                  return null;
                } catch (error) {
                  console.error('Token validation error:', error);
                  return null;
                }
              }
            }, async (results) => {
              if (chrome.runtime.lastError) {
                console.warn('Could not access frontend tokens:', chrome.runtime.lastError);
                resolve(null);
                return;
              }

              const result = results?.[0]?.result;
              
              if (!result) {
                resolve(null);
                return;
              }

              // If token needs refresh, handle it
              if (result.needsRefresh) {
                const newToken = await this.refreshTokenInFrontend(result.refreshToken);
                resolve(newToken);
                return;
              }

              resolve(result);
            });
          } else {
            resolve(null);
          }
        });
      });
    } catch (error) {
      console.error('Error getting token from frontend:', error);
      return null;
    }
  }

  // Refresh token using frontend mechanism
  async refreshTokenInFrontend(refreshToken) {
    try {
      const response = await fetch('http://localhost:5253/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Update tokens in frontend localStorage
        const FRONTEND_URL = 'http://localhost:5173';
        chrome.tabs.query({ url: `${FRONTEND_URL}/*` }, (tabs) => {
          if (tabs.length > 0) {
            chrome.scripting.executeScript({
              target: { tabId: tabs[0].id },
              func: (tokenData) => {
                localStorage.setItem("access", tokenData.token);
                localStorage.setItem("refreshToken", tokenData.refreshToken);
                
                if (tokenData.userId) localStorage.setItem("userId", tokenData.userId);
                if (tokenData.email) localStorage.setItem("email", tokenData.email);
                if (tokenData.fullName) localStorage.setItem("fullName", tokenData.fullName);
                if (tokenData.role !== undefined) localStorage.setItem("role", tokenData.role);
                if (tokenData.expiresAt) localStorage.setItem("expiresAt", tokenData.expiresAt);
              },
              args: [data]
            });
          }
        });
        
        return data.token;
      } else {
        console.error('Token refresh failed');
        return null;
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      return null;
    }
  }

  async getApplicationStats() {
    // Since /applications/stats doesn't exist, return mock data or null
    // TODO: Implement actual stats endpoint in backend or remove this functionality
    try {
      return {
        total: 0,
        thisWeek: 0,
        thisMonth: 0,
        inProgress: 0
      };
    } catch (error) {
      console.error('Error fetching stats:', error);
      return null;
    }
  }

  async updateApplicationBadge() {
    try {
      const stats = await this.getApplicationStats();
      const count = stats?.thisWeek || 0;
      
      await chrome.action.setBadgeText({
        text: count > 0 ? count.toString() : ''
      });
      
      await chrome.action.setBadgeBackgroundColor({
        color: '#3b82f6'
      });
    } catch (error) {
      console.error('Error updating badge:', error);
    }
  }

  async updateBadge(count) {
    try {
      await chrome.action.setBadgeText({
        text: count > 0 ? count.toString() : ''
      });
    } catch (error) {
      console.error('Error updating badge:', error);
    }
  }

  async showNotification(title, message, type = 'info') {
    try {
      // Use the main extension icon for all notifications
      const iconUrl = chrome.runtime.getURL('assets/icon-48.png');

      await chrome.notifications.create({
        type: 'basic',
        iconUrl: iconUrl,
        title: title,
        message: message,
        priority: 1
      });
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }

  async handleInstallation(details) {
    if (details.reason === 'install') {
      // Show welcome notification
      await this.showNotification(
        'Job Lander Extension Installed!',
        'Start capturing job applications automatically. Click the extension icon to get started.',
        'success'
      );

      // Open welcome page
      await chrome.tabs.create({
        url: chrome.runtime.getURL('popup/index.html')
      });
    } else if (details.reason === 'update') {
      // Handle extension updates
      console.log('Extension updated to version:', chrome.runtime.getManifest().version);
    }
  }

  async handleTabUpdate(tabId, changeInfo, tab) {
    // Only process when page is completely loaded
    if (changeInfo.status !== 'complete' || !tab.url) return;

    try {
      // Check if this is a job site that might need our scraper
      const jobSitePatterns = [
        'linkedin.com/jobs',
        'indeed.com',
        'glassdoor.com/job',
        'careers.',
        'jobs.'
      ];

      const isJobSite = jobSitePatterns.some(pattern => 
        tab.url.toLowerCase().includes(pattern)
      );

      if (isJobSite) {
        // Ensure content script is injected (fallback for dynamic pages)
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: () => {
              // Check if our scraper is already active
              return window.jobLanderScraperActive || false;
            }
          });
        } catch (error) {
          // Script injection failed, tab might not be ready
          console.log('Script injection skipped for tab:', tabId);
        }
      }
    } catch (error) {
      console.error('Error handling tab update:', error);
    }
  }

  // Handle tracked application save (new multi-step approach)
  async handleTrackedApplicationSave(data, sender) {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      // Save the application first
      const applicationResult = await this.saveApplicationToAPI(data.application);
      
      if (applicationResult.success) {
        // Save questions if any
        if (data.questions && data.questions.length > 0) {
          // Add applicationId to each question
          const questionsWithAppId = data.questions.map(q => ({
            ...q,
            applicationId: applicationResult.data.applicationId
          }));
          
          await this.saveQuestionsToAPI(questionsWithAppId);
        }

        await this.showNotification(
          'Application Saved!',
          `Successfully saved application: ${data.application.jobTitle}`,
          'success'
        );

        // Update badge count
        await this.updateApplicationBadge();
      } else {
        throw new Error(applicationResult.error);
      }
    } catch (error) {
      console.error('Error saving tracked application:', error);
      
      await this.showNotification(
        'Save Failed',
        'Failed to save application data. Please try again.',
        'error'
      );
      
      throw error;
    }
  }

  // Get dropdown data for companies and CVs (matching frontend API calls)
  async getDropdownData() {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      console.log('Job Lander: Fetching dropdown data...');

      // Build URLs exactly like frontend does
      const companiesUrl = new URL('http://localhost:5253/api/user-companies');
      companiesUrl.searchParams.append('PageSize', '100');

      const cvsUrl = 'http://localhost:5253/api/cvs';

      // Fetch companies and CVs in parallel
      const [companiesResponse, cvsResponse] = await Promise.all([
        fetch(companiesUrl.toString(), {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }),
        fetch(cvsUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        })
      ]);

      let companies = [];
      let cvs = [];

      // Handle user-companies response
      if (companiesResponse.ok) {
        const companiesData = await companiesResponse.json();
        console.log('Job Lander: User-companies response:', companiesData);
        
        // user-companies API returns array directly
        if (Array.isArray(companiesData)) {
          companies = companiesData;
        } else if (companiesData && Array.isArray(companiesData.items)) {
          companies = companiesData.items;
        }
      } else {
        console.error('Job Lander: User-companies API failed:', companiesResponse.status, companiesResponse.statusText);
        const errorText = await companiesResponse.text();
        console.error('Job Lander: User-companies error details:', errorText);
      }

      // Handle CVs response (exactly like frontend)
      if (cvsResponse.ok) {
        const cvsData = await cvsResponse.json();
        console.log('Job Lander: CVs response:', cvsData);
        
        // Frontend expects response.data || []
        cvs = cvsData || [];
      } else {
        console.error('Job Lander: CVs API failed:', cvsResponse.status, cvsResponse.statusText);
        const errorText = await cvsResponse.text();
        console.error('Job Lander: CVs error details:', errorText);
      }

      console.log('Job Lander: Final dropdown data:', { 
        companiesCount: companies.length, 
        cvsCount: cvs.length 
      });

      return { companies, cvs };
    } catch (error) {
      console.error('Job Lander: Error fetching dropdown data:', error);
      return { companies: [], cvs: [] };
    }
  }

  // Save questions to API
  async saveQuestionsToAPI(questions) {
    try {
      const token = await this.getAuthToken();
      if (!token) return;

      const response = await fetch('http://localhost:5253/api/questions/batch', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ questions }),
      });

      if (!response.ok) {
        console.error('Failed to save questions to API');
      } else {
        console.log('Successfully saved', questions.length, 'questions');
      }
    } catch (error) {
      console.error('Error saving questions to API:', error);
    }
  }

  // Utility method to check authentication status
  async isUserAuthenticated() {
    try {
      // This will be called by popup to check auth status
      const token = await chrome.storage.local.get(['joblander_token']);
      return !!token.joblander_token;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get user ID from frontend localStorage or extension storage
   */
  async getUserId() {
    try {
      const FRONTEND_URL = 'http://localhost:5173';
      
      // Try to get from frontend localStorage first
      const userId = await new Promise((resolve) => {
        chrome.tabs.query({ url: `${FRONTEND_URL}/*` }, (tabs) => {
          if (tabs.length > 0) {
            chrome.scripting.executeScript({
              target: { tabId: tabs[0].id },
              func: () => localStorage.getItem('userId')
            }, (results) => {
              if (chrome.runtime.lastError) {
                console.warn('Could not access frontend userId:', chrome.runtime.lastError);
                resolve(null);
              } else {
                resolve(results?.[0]?.result || null);
              }
            });
          } else {
            resolve(null);
          }
        });
      });

      if (userId) {
        console.log('Job Lander BG: Got userId from frontend localStorage:', userId);
        return userId;
      }

      // Fallback to extension storage (cached from login)
      const result = await chrome.storage.local.get(['cached_user_data']);
      const cachedUserId = result.cached_user_data?.userId || null;
      
      if (cachedUserId) {
        console.log('Job Lander BG: Got userId from cached user data:', cachedUserId);
      } else {
        console.warn('Job Lander BG: No userId found in frontend or extension storage');
      }
      
      return cachedUserId;
    } catch (error) {
      console.error('Job Lander BG: Error getting user ID:', error);
      return null;
    }
  }

  // ============== AUTO-FILL METHODS ==============

  /**
   * Get AI-generated answer for a single question
   */
  async getAutoFillAnswer(data) {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      console.log('Job Lander BG: Requesting AI answer for question');

      const response = await fetch('http://localhost:5253/api/ai-assistant/generate-answer', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: data.question,
          jobContext: data.jobDescription || '',
          topK: 50
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Job Lander BG: AI answer received:', result.success ? 'success' : 'failed');
        return result.answer || '';
      } else {
        const errorText = await response.text();
        console.error('Job Lander BG: Failed to get AI answer:', response.status, errorText);
        throw new Error('Failed to get AI answer');
      }
    } catch (error) {
      console.error('Job Lander BG: Auto-fill answer error:', error);
      throw error;
    }
  }

  /**
   * Get AI-generated answers for multiple questions (batched)
   * Since the backend only has a single answer endpoint, we call it multiple times
   */
  async getAutoFillAnswersBatch(data) {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      console.log('Job Lander BG: Requesting AI answers for', data.questions?.length || 0, 'questions');

      const questions = data.questions || [];
      const jobContext = data.jobDescription || '';
      const answers = [];

      // Call the API for each question sequentially
      for (let i = 0; i < questions.length; i++) {
        const question = questions[i];
        console.log(`Job Lander BG: Getting answer ${i + 1}/${questions.length}`);

        try {
          const response = await fetch('http://localhost:5253/api/ai-assistant/generate-answer', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query: question,
              jobContext: jobContext,
              topK: 50
            }),
          });

          if (response.ok) {
            const result = await response.json();
            if (result.success && result.answer) {
              answers.push(result.answer);
              console.log(`Job Lander BG: Answer ${i + 1} received (${result.answer.length} chars)`);
            } else {
              console.warn(`Job Lander BG: Answer ${i + 1} failed - no answer in response`);
              answers.push(''); // Empty answer on failure
            }
          } else {
            const errorText = await response.text();
            console.error(`Job Lander BG: Failed to get answer ${i + 1}:`, response.status, errorText);
            answers.push(''); // Empty answer on failure
          }
        } catch (error) {
          console.error(`Job Lander BG: Error getting answer ${i + 1}:`, error);
          answers.push(''); // Empty answer on failure
        }

        // Small delay to avoid overwhelming the API
        if (i < questions.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      console.log('Job Lander BG: Received', answers.length, 'AI answers');
      return answers;
    } catch (error) {
      console.error('Job Lander BG: Auto-fill batch error:', error);
      throw error;
    }
  }
}

// Initialize background manager
const backgroundManager = new BackgroundManager();

// Export for testing purposes
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BackgroundManager;
}
