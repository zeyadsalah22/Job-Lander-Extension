// API utilities for Job Lander Extension
import authManager from './auth.js';

class APIManager {
  constructor() {
    this.auth = authManager;
  }

  // Save application data
  async saveApplication(applicationData) {
    try {
      const response = await this.auth.apiRequest('/applications', {
        method: 'POST',
        body: JSON.stringify(applicationData),
      });

      if (response.ok) {
        const result = await response.json();
        return { success: true, data: result };
      } else {
        const error = await response.json();
        return { success: false, error: error.message || 'Failed to save application' };
      }
    } catch (error) {
      console.error('Error saving application:', error);
      return { success: false, error: error.message };
    }
  }

  // Get user's applications
  async getApplications(filters = {}) {
    try {
      // Build query parameters
      const params = new URLSearchParams();
      
      // Add pagination parameters
      if (filters.pageNumber) params.append('PageNumber', filters.pageNumber);
      if (filters.pageSize) params.append('PageSize', filters.pageSize);
      
      // Add filter parameters
      if (filters.companyId) params.append('CompanyId', filters.companyId);
      if (filters.companyName) params.append('CompanyName', filters.companyName);
      if (filters.jobTitle) params.append('JobTitle', filters.jobTitle);
      if (filters.jobType) params.append('JobType', filters.jobType);
      if (filters.stage) params.append('Stage', filters.stage);
      if (filters.status) params.append('Status', filters.status);
      if (filters.fromDate) params.append('FromDate', filters.fromDate);
      if (filters.toDate) params.append('ToDate', filters.toDate);
      if (filters.searchTerm) params.append('SearchTerm', filters.searchTerm);
      
      // Add sorting parameters
      if (filters.sortBy) params.append('SortBy', filters.sortBy);
      if (filters.sortDescending !== undefined) params.append('SortDescending', filters.sortDescending);
      
      const queryString = params.toString();
      const endpoint = queryString ? `/applications?${queryString}` : '/applications';
      
      console.log('Job Lander: Fetching applications from:', endpoint);
      
      const response = await this.auth.apiRequest(endpoint);

      if (response.ok) {
        const result = await response.json();
        console.log('Job Lander: Applications fetched:', result);
        return { success: true, data: result };
      } else {
        const errorText = await response.text();
        console.error('Job Lander: Failed to fetch applications:', response.status, errorText);
        return { success: false, error: 'Failed to fetch applications' };
      }
    } catch (error) {
      console.error('Job Lander: Error fetching applications:', error);
      return { success: false, error: error.message };
    }
  }

  // Get companies
  async getCompanies() {
    try {
      const response = await this.auth.apiRequest('/companies');

      if (response.ok) {
        const result = await response.json();
        return { success: true, data: result };
      } else {
        return { success: false, error: 'Failed to fetch companies' };
      }
    } catch (error) {
      console.error('Error fetching companies:', error);
      return { success: false, error: error.message };
    }
  }

  // Save interview questions
  async saveQuestions(questions) {
    try {
      const response = await this.auth.apiRequest('/questions/batch', {
        method: 'POST',
        body: JSON.stringify({ questions }),
      });

      if (response.ok) {
        const result = await response.json();
        return { success: true, data: result };
      } else {
        const error = await response.json();
        return { success: false, error: error.message || 'Failed to save questions' };
      }
    } catch (error) {
      console.error('Error saving questions:', error);
      return { success: false, error: error.message };
    }
  }

  // Get application statistics (calculated client-side from applications data)
  // This method is deprecated - stats are now calculated in the Dashboard component
  async getApplicationStats() {
    try {
      const response = await this.auth.apiRequest('/applications/stats');

      if (response.ok) {
        const result = await response.json();
        return { success: true, data: result };
      } else {
        return { success: false, error: 'Failed to fetch stats' };
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
      return { success: false, error: error.message };
    }
  }

  // Get current weekly goal
  async getCurrentWeeklyGoal() {
    try {
      console.log('Job Lander: Fetching current weekly goal...');
      
      const response = await this.auth.apiRequest('/weekly-goals/current');

      if (response.ok) {
        const result = await response.json();
        console.log('Job Lander: Weekly goal fetched:', result);
        return { success: true, data: result };
      } else if (response.status === 404) {
        // No weekly goal set yet
        console.log('Job Lander: No weekly goal found');
        return { success: true, data: null };
      } else {
        const errorText = await response.text();
        console.error('Job Lander: Failed to fetch weekly goal:', response.status, errorText);
        return { success: false, error: 'Failed to fetch weekly goal' };
      }
    } catch (error) {
      console.error('Job Lander: Error fetching weekly goal:', error);
      return { success: false, error: error.message };
    }
  }

  // Update application status
  async updateApplicationStatus(applicationId, status) {
    try {
      const response = await this.auth.apiRequest(`/applications/${applicationId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        const result = await response.json();
        return { success: true, data: result };
      } else {
        const error = await response.json();
        return { success: false, error: error.message || 'Failed to update application' };
      }
    } catch (error) {
      console.error('Error updating application:', error);
      return { success: false, error: error.message };
    }
  }

  // Create weekly goal
  async createWeeklyGoal(goalData) {
    try {
      console.log('Job Lander: Creating weekly goal:', goalData);
      
      const response = await this.auth.apiRequest('/weekly-goals', {
        method: 'POST',
        body: JSON.stringify(goalData),
      });

      if (response.ok) {
        // Try to parse JSON response
        try {
          const text = await response.text();
          const result = text ? JSON.parse(text) : null;
          console.log('Job Lander: Weekly goal created:', result);
          return { success: true, data: result };
        } catch (parseError) {
          console.warn('Job Lander: Could not parse response, but request succeeded');
          return { success: true, data: null };
        }
      } else {
        let errorMessage = 'Failed to create weekly goal';
        try {
          const errorText = await response.text();
          if (errorText) {
            errorMessage += ': ' + errorText;
          }
        } catch (e) {
          // Ignore parse errors
        }
        console.error('Job Lander: Failed to create weekly goal:', response.status);
        return { success: false, error: errorMessage };
      }
    } catch (error) {
      console.error('Job Lander: Error creating weekly goal:', error);
      return { success: false, error: error.message };
    }
  }

  // Update weekly goal
  async updateWeeklyGoal(goalId, goalData) {
    try {
      console.log('Job Lander: Updating weekly goal:', goalId, goalData);
      
      const response = await this.auth.apiRequest(`/weekly-goals/${goalId}`, {
        method: 'PUT',
        body: JSON.stringify(goalData),
      });

      if (response.ok) {
        // Check if response has content before parsing JSON
        const contentType = response.headers.get('content-type');
        let result = null;
        
        if (contentType && contentType.includes('application/json')) {
          const text = await response.text();
          if (text) {
            result = JSON.parse(text);
          }
        }
        
        console.log('Job Lander: Weekly goal updated');
        return { success: true, data: result };
      } else {
        const errorText = await response.text();
        console.error('Job Lander: Failed to update weekly goal:', response.status, errorText);
        return { success: false, error: 'Failed to update weekly goal' };
      }
    } catch (error) {
      console.error('Job Lander: Error updating weekly goal:', error);
      return { success: false, error: error.message };
    }
  }

  // Delete weekly goal
  async deleteWeeklyGoal(goalId) {
    try {
      console.log('Job Lander: Deleting weekly goal:', goalId);
      
      const response = await this.auth.apiRequest(`/weekly-goals/${goalId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        console.log('Job Lander: Weekly goal deleted');
        return { success: true };
      } else {
        let errorMessage = 'Failed to delete weekly goal';
        try {
          const errorText = await response.text();
          if (errorText) {
            errorMessage += ': ' + errorText;
          }
        } catch (e) {
          // Ignore parse errors
        }
        console.error('Job Lander: Failed to delete weekly goal:', response.status);
        return { success: false, error: errorMessage };
      }
    } catch (error) {
      console.error('Job Lander: Error deleting weekly goal:', error);
      return { success: false, error: error.message };
    }
  }

  // Get weekly goal stats
  async getWeeklyGoalStats() {
    try {
      console.log('Job Lander: Fetching weekly goal stats...');
      
      const response = await this.auth.apiRequest('/weekly-goals/stats');

      if (response.ok) {
        const result = await response.json();
        console.log('Job Lander: Weekly goal stats fetched:', result);
        return { success: true, data: result };
      } else {
        const errorText = await response.text();
        console.error('Job Lander: Failed to fetch weekly goal stats:', response.status, errorText);
        return { success: false, error: 'Failed to fetch weekly goal stats' };
      }
    } catch (error) {
      console.error('Job Lander: Error fetching weekly goal stats:', error);
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
const apiManager = new APIManager();
export default apiManager;
