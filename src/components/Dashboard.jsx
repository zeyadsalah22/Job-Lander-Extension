import React, { useState, useEffect } from 'react';
import { 
  Briefcase, 
  Plus, 
  Settings, 
  LogOut, 
  ExternalLink,
  Target,
  Calendar,
  TrendingUp,
  CheckCircle,
  Clock,
  X,
  RefreshCw
} from 'lucide-react';
import apiManager from '../../utils/api';

const Dashboard = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [recentApplications, setRecentApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [weeklyGoal, setWeeklyGoal] = useState(null);
  const [weeklyGoalLoading, setWeeklyGoalLoading] = useState(false);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [goalFormData, setGoalFormData] = useState({
    targetApplicationCount: '',
    notes: ''
  });
  const [goalFormSubmitting, setGoalFormSubmitting] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      console.log('Job Lander: Loading dashboard data...');
      
      // Fetch recent applications with pagination
      const appsResult = await apiManager.getApplications({
        pageNumber: 1,
        pageSize: 10,
        sortBy: 'submissionDate',
        sortDescending: true
      });

      if (appsResult.success) {
        const applications = appsResult.data?.items || [];
        console.log('Job Lander: Loaded applications:', applications.length);
        setRecentApplications(applications);
        
        // Calculate stats from the application data
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        
        const thisWeek = applications.filter(app => {
          const submissionDate = new Date(app.submissionDate || app.createdAt);
          return submissionDate >= weekAgo;
        }).length;
        
        const thisMonth = applications.filter(app => {
          const submissionDate = new Date(app.submissionDate || app.createdAt);
          return submissionDate >= monthAgo;
        }).length;
        
        const inProgress = applications.filter(app => 
          app.status === 'Pending' && app.stage !== 'Rejected'
        ).length;
        
        const interviews = applications.filter(app => 
          ['PhoneScreen', 'HrInterview', 'TechnicalInterview'].includes(app.stage)
        ).length;
        
        setStats({
          total: appsResult.data?.totalCount || applications.length,
          thisWeek,
          thisMonth,
          inProgress,
          interviews
        });
      } else {
        console.error('Job Lander: Failed to load applications:', appsResult.error);
        // Set empty state if API fails
        setRecentApplications([]);
        setStats({
          total: 0,
          thisWeek: 0,
          thisMonth: 0,
          inProgress: 0,
          interviews: 0
        });
      }
    } catch (error) {
      console.error('Job Lander: Error loading dashboard data:', error);
      // Set empty state on error
      setRecentApplications([]);
      setStats({
        total: 0,
        thisWeek: 0,
        thisMonth: 0,
        inProgress: 0,
        interviews: 0
      });
    } finally {
      setLoading(false);
    }
  };

  const openJobLander = () => {
    chrome.tabs.create({ url: 'http://localhost:5173' });
  };

  const openJobSite = (url) => {
    chrome.tabs.create({ url });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const loadWeeklyGoal = async () => {
    setWeeklyGoalLoading(true);
    try {
      console.log('Job Lander: Loading weekly goal...');
      const result = await apiManager.getCurrentWeeklyGoal();
      
      if (result.success) {
        setWeeklyGoal(result.data);
        console.log('Job Lander: Weekly goal loaded:', result.data);
      } else {
        console.error('Job Lander: Failed to load weekly goal:', result.error);
        setWeeklyGoal(null);
      }
    } catch (error) {
      console.error('Job Lander: Error loading weekly goal:', error);
      setWeeklyGoal(null);
    } finally {
      setWeeklyGoalLoading(false);
    }
  };

  const handleCreateGoal = () => {
    setGoalFormData({
      targetApplicationCount: '',
      notes: ''
    });
    setShowGoalForm(true);
  };

  const handleEditGoal = () => {
    if (weeklyGoal) {
      setGoalFormData({
        targetApplicationCount: weeklyGoal.targetApplicationCount.toString(),
        notes: weeklyGoal.notes || ''
      });
      setShowGoalForm(true);
    }
  };

  const handleGoalFormSubmit = async (e) => {
    e.preventDefault();
    setGoalFormSubmitting(true);

    try {
      const data = {
        targetApplicationCount: parseInt(goalFormData.targetApplicationCount),
        notes: goalFormData.notes
      };

      let result;
      if (weeklyGoal) {
        // Update existing goal
        result = await apiManager.updateWeeklyGoal(weeklyGoal.weeklyGoalId, data);
      } else {
        // Create new goal - need to add weekStartDate
        const today = new Date();
        const weekStartDate = today.toISOString().split('T')[0];
        result = await apiManager.createWeeklyGoal({
          ...data,
          weekStartDate
        });
      }

      if (result.success) {
        console.log('Job Lander: Goal saved successfully');
        setShowGoalForm(false);
        await loadWeeklyGoal(); // Reload to get updated data
      } else {
        console.error('Job Lander: Failed to save goal:', result.error);
        alert('Failed to save goal: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Job Lander: Error saving goal:', error);
      alert('Error saving goal: ' + error.message);
    } finally {
      setGoalFormSubmitting(false);
    }
  };

  const handleDeleteGoal = async () => {
    if (!weeklyGoal || !confirm('Are you sure you want to delete this goal?')) {
      return;
    }

    try {
      const result = await apiManager.deleteWeeklyGoal(weeklyGoal.weeklyGoalId);
      
      if (result.success) {
        console.log('Job Lander: Goal deleted successfully');
        setWeeklyGoal(null);
      } else {
        console.error('Job Lander: Failed to delete goal:', result.error);
        alert('Failed to delete goal: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Job Lander: Error deleting goal:', error);
      alert('Error deleting goal: ' + error.message);
    }
  };

  // Load weekly goal when Goals tab is active
  useEffect(() => {
    if (activeTab === 'goals' && !weeklyGoalLoading && weeklyGoal === null) {
      loadWeeklyGoal();
    }
  }, [activeTab]);

  // Helper function to format dates
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Helper function to get color class for stage
  const getStageColor = (stage) => {
    switch (stage) {
      case 'Applied':
        return 'bg-blue-500 text-white';
      case 'PhoneScreen':
        return 'bg-cyan-500 text-white';
      case 'Assessment':
        return 'bg-purple-500 text-white';
      case 'HrInterview':
        return 'bg-indigo-500 text-white';
      case 'TechnicalInterview':
        return 'bg-violet-500 text-white';
      case 'Offer':
        return 'bg-green-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  const quickSearchSites = [
    { name: 'LinkedIn', url: 'https://www.linkedin.com/jobs/', icon: '💼' },
    { name: 'Indeed', url: 'https://indeed.com/', icon: '🔍' },
    { name: 'Glassdoor', url: 'https://www.glassdoor.com/Job/jobs.htm', icon: '🏢' },
    { name: 'AngelList', url: 'https://angel.co/jobs', icon: '👼' }
  ];

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm text-muted-foreground">Loading dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background">
      {/* Header */}
      <div className="border-b border-border px-6 py-4 bg-gradient-to-r from-background to-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-gradient-to-br from-primary to-primary-dark rounded-xl flex items-center justify-center shadow-md">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-foreground tracking-tight">Job Lander</h1>
              <p className="text-xs text-muted-foreground">Welcome back, <span className="font-medium text-primary">{user?.firstName || 'User'}</span></p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={openJobLander}
              className="btn btn-ghost btn-sm"
              title="Open Dashboard"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
            <button
              onClick={onLogout}
              className="btn btn-ghost btn-sm"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-border px-6">
        <div className="flex space-x-6">
          {[
            { id: 'overview', label: 'Overview', icon: TrendingUp },
            { id: 'quick-search', label: 'Quick Search', icon: Plus },
            { id: 'goals', label: 'Goals', icon: Target }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            {stats && (
              <div className="grid grid-cols-2 gap-4 fade-in">
                <div className="card-glow hover-scale cursor-pointer">
                  <div className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Total Applications</p>
                        <p className="text-3xl font-bold text-foreground">{stats.total || 0}</p>
                      </div>
                      <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary-dark rounded-xl flex items-center justify-center shadow-md">
                        <Briefcase className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="card-glow hover-scale cursor-pointer">
                  <div className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">This Week</p>
                        <p className="text-3xl font-bold text-foreground">{stats.thisWeek || 0}</p>
                      </div>
                      <div className="w-12 h-12 bg-gradient-to-br from-success to-success/80 rounded-xl flex items-center justify-center shadow-md">
                        <Calendar className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card-glow hover-scale cursor-pointer">
                  <div className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">In Progress</p>
                        <p className="text-3xl font-bold text-foreground">{stats.inProgress || 0}</p>
                      </div>
                      <div className="w-12 h-12 bg-gradient-to-br from-warning to-warning/80 rounded-xl flex items-center justify-center shadow-md">
                        <Clock className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card-glow hover-scale cursor-pointer">
                  <div className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Interviews</p>
                        <p className="text-3xl font-bold text-foreground">{stats.interviews || 0}</p>
                      </div>
                      <div className="w-12 h-12 bg-gradient-to-br from-accent to-accent/80 rounded-xl flex items-center justify-center shadow-md">
                        <CheckCircle className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Recent Applications */}
            <div className="card">
              <div className="card-header">
                <div className="flex items-center justify-between">
                  <h3 className="card-title">Recent Applications</h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleRefresh}
                      disabled={refreshing}
                      className="btn btn-ghost btn-sm"
                      title="Refresh applications"
                    >
                      <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                      onClick={openJobLander}
                      className="btn btn-ghost btn-sm"
                      title="Open full dashboard"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="card-content">
                {recentApplications.length > 0 ? (
                  <div className="space-y-3">
                    {recentApplications.map((app) => (
                      <div key={app.applicationId} className="flex items-start justify-between p-3 border border-border rounded-md hover:bg-muted/50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground text-sm truncate" title={app.jobTitle}>
                            {app.jobTitle}
                          </p>
                          <p className="text-xs text-muted-foreground truncate" title={app.companyName}>
                            {app.companyName}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">
                              {formatDate(app.submissionDate || app.createdAt)}
                            </span>
                            {app.jobType && (
                              <>
                                <span className="text-xs text-muted-foreground">•</span>
                                <span className="text-xs text-muted-foreground">{app.jobType}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 ml-2">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${getStageColor(app.stage)}`}>
                            {app.stage}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Briefcase className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No applications yet</p>
                    <p className="text-xs text-muted-foreground mt-1">Start applying to jobs to see them here</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'quick-search' && (
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-foreground mb-4">Quick Job Search</h3>
              <div className="grid grid-cols-2 gap-3">
                {quickSearchSites.map(site => (
                  <button
                    key={site.name}
                    onClick={() => openJobSite(site.url)}
                    className="btn btn-outline btn-md justify-start space-x-3 h-12"
                  >
                    <span className="text-lg">{site.icon}</span>
                    <span>{site.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h4 className="card-title">Extension Features</h4>
              </div>
              <div className="card-content space-y-3">
                <div className="flex items-center space-x-3 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>Auto-capture application data</span>
                </div>
                <div className="flex items-center space-x-3 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>Save interview questions</span>
                </div>
                <div className="flex items-center space-x-3 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>Track application status</span>
                </div>
                <div className="flex items-center space-x-3 text-sm">
                  <Clock className="w-4 h-4 text-yellow-500" />
                  <span>Smart notifications (coming soon)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'goals' && (
          <div className="space-y-6">
            <div className="card">
              <div className="card-header">
                <div className="flex items-center justify-between">
                  <h3 className="card-title">Weekly Goals</h3>
                  <button
                    onClick={loadWeeklyGoal}
                    disabled={weeklyGoalLoading}
                    className="btn btn-ghost btn-sm"
                    title="Refresh weekly goal"
                  >
                    <RefreshCw className={`w-4 h-4 ${weeklyGoalLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
              <div className="card-content">
                {weeklyGoalLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-sm text-muted-foreground">Loading goal...</span>
                    </div>
                  </div>
                ) : showGoalForm ? (
                  <form onSubmit={handleGoalFormSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Target Applications Per Week
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={goalFormData.targetApplicationCount}
                        onChange={(e) => setGoalFormData({ ...goalFormData, targetApplicationCount: e.target.value })}
                        className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="e.g., 10"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Notes (Optional)
                      </label>
                      <textarea
                        value={goalFormData.notes}
                        onChange={(e) => setGoalFormData({ ...goalFormData, notes: e.target.value })}
                        className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                        rows="3"
                        placeholder="Add notes about your goal..."
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={goalFormSubmitting}
                        className="btn btn-primary btn-sm flex-1"
                      >
                        {goalFormSubmitting ? 'Saving...' : weeklyGoal ? 'Update Goal' : 'Create Goal'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowGoalForm(false)}
                        disabled={goalFormSubmitting}
                        className="btn btn-ghost btn-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : weeklyGoal ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-foreground">Applications this week</span>
                      <span className="text-sm font-medium">
                        {weeklyGoal.actualApplicationCount} / {weeklyGoal.targetApplicationCount}
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all ${
                          weeklyGoal.isCompleted ? 'bg-green-500' : 'bg-primary'
                        }`}
                        style={{ width: `${Math.min(weeklyGoal.progressPercentage, 100)}%` }}
                      ></div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {new Date(weeklyGoal.weekStartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(weeklyGoal.weekEndDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                      <span className={weeklyGoal.isCompleted ? 'text-green-600 font-medium' : ''}>
                        {weeklyGoal.progressPercentage}% complete
                      </span>
                    </div>
                    {weeklyGoal.notes && (
                      <div className="mt-3 p-3 bg-muted rounded-md">
                        <p className="text-xs text-muted-foreground">
                          <strong>Notes:</strong> {weeklyGoal.notes}
                        </p>
                      </div>
                    )}
                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={handleEditGoal}
                        className="btn btn-outline btn-sm flex-1"
                      >
                        <Settings className="w-3 h-3 mr-1" />
                        Edit Goal
                      </button>
                      <button
                        onClick={handleDeleteGoal}
                        className="btn btn-ghost btn-sm text-red-600 hover:bg-red-50"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Target className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm font-medium text-foreground mb-1">No Weekly Goal Set</p>
                    <p className="text-xs text-muted-foreground mb-4">
                      Set a weekly application goal to track your progress
                    </p>
                    <button
                      onClick={handleCreateGoal}
                      className="btn btn-primary btn-md"
                    >
                      <Plus className="w-4 h-4 mr-1.5" />
                      Set Goal
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h4 className="card-title">Tips</h4>
              </div>
              <div className="card-content space-y-3">
                <div className="text-sm text-muted-foreground">
                  • Set a weekly application goal
                </div>
                <div className="text-sm text-muted-foreground">
                  • Follow up on applications after 1 week
                </div>
                <div className="text-sm text-muted-foreground">
                  • Customize your resume for each application
                </div>
                <div className="text-sm text-muted-foreground">
                  • Practice common interview questions
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
