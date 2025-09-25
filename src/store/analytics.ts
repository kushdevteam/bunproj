/**
 * Analytics State Management Store
 * Manages analytics data fetching, caching, and real-time updates
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { analyticsService, type AnalyticsMetrics, type AnalyticsTimeRange } from '../services/analytics';
import type { AnalyticsExportOptions } from '../services/analytics';

export type AnalyticsViewMode = 'overview' | 'bundles' | 'wallets' | 'network' | 'transactions' | 'gas';
export type AnalyticsRefreshStatus = 'idle' | 'loading' | 'error' | 'success';

interface AnalyticsState {
  // Current analytics data
  metrics: AnalyticsMetrics | null;
  
  // UI state
  currentView: AnalyticsViewMode;
  timeRange: AnalyticsTimeRange;
  isLoading: boolean;
  refreshStatus: AnalyticsRefreshStatus;
  lastUpdated: Date | null;
  error: string | null;
  
  // Real-time monitoring
  isRealTimeEnabled: boolean;
  autoRefreshInterval: number; // seconds
  intervalId: NodeJS.Timeout | null; // Fixed: Proper interval ID storage
  
  // Export state
  isExporting: boolean;
  exportProgress: number;
  
  // Filtering and customization
  selectedMetrics: (keyof AnalyticsMetrics)[];
  customFilters: Record<string, any>;
  
  // Actions - Data Management
  fetchAnalytics: (timeRange?: AnalyticsTimeRange) => Promise<void>;
  refreshAnalytics: () => Promise<void>;
  setTimeRange: (timeRange: AnalyticsTimeRange) => void;
  
  // Actions - View Management
  setCurrentView: (view: AnalyticsViewMode) => void;
  toggleMetricSelection: (metric: keyof AnalyticsMetrics) => void;
  setCustomFilter: (key: string, value: any) => void;
  clearFilters: () => void;
  
  // Actions - Real-time Control
  enableRealTime: () => void;
  disableRealTime: () => void;
  setAutoRefreshInterval: (seconds: number) => void;
  
  // Actions - Export
  exportAnalytics: (options: AnalyticsExportOptions) => Promise<string>;
  
  // Actions - Utility
  clearError: () => void;
  reset: () => void;
}

const defaultTimeRange: AnalyticsTimeRange = {
  start: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
  end: new Date(),
  period: '24h',
  granularity: 'hour'
};

export const useAnalyticsStore = create<AnalyticsState>()(
  persist(
    (set, get) => ({
      // Initial state
      metrics: null,
      currentView: 'overview',
      timeRange: defaultTimeRange,
      isLoading: false,
      refreshStatus: 'idle',
      lastUpdated: null,
      error: null,
      isRealTimeEnabled: false,
      autoRefreshInterval: 30,
      intervalId: null, // Fixed: Initialize interval ID
      isExporting: false,
      exportProgress: 0,
      selectedMetrics: ['bundlePerformance', 'walletAnalytics', 'networkStats', 'transactionTracking', 'gasAnalytics'],
      customFilters: {},

      // Fetch analytics data
      fetchAnalytics: async (timeRange?: AnalyticsTimeRange) => {
        try {
          set({ isLoading: true, refreshStatus: 'loading', error: null });
          
          const effectiveTimeRange = timeRange || get().timeRange;
          const metrics = await analyticsService.getAnalyticsMetrics(effectiveTimeRange);
          
          set({
            metrics,
            timeRange: effectiveTimeRange,
            isLoading: false,
            refreshStatus: 'success',
            lastUpdated: new Date(),
            error: null
          });
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to fetch analytics';
          set({
            isLoading: false,
            refreshStatus: 'error',
            error: errorMessage
          });
        }
      },

      // Refresh current analytics data
      refreshAnalytics: async () => {
        const state = get();
        await state.fetchAnalytics(state.timeRange);
      },

      // Set time range for analytics
      setTimeRange: (timeRange: AnalyticsTimeRange) => {
        set({ timeRange });
        // Auto-fetch with new time range
        get().fetchAnalytics(timeRange);
      },

      // Set current view mode
      setCurrentView: (view: AnalyticsViewMode) => {
        set({ currentView: view });
      },

      // Toggle metric selection for custom views
      toggleMetricSelection: (metric: keyof AnalyticsMetrics) => {
        const state = get();
        const selectedMetrics = state.selectedMetrics.includes(metric)
          ? state.selectedMetrics.filter(m => m !== metric)
          : [...state.selectedMetrics, metric];
        
        set({ selectedMetrics });
      },

      // Set custom filter
      setCustomFilter: (key: string, value: any) => {
        const state = get();
        set({
          customFilters: {
            ...state.customFilters,
            [key]: value
          }
        });
      },

      // Clear all filters
      clearFilters: () => {
        set({ customFilters: {} });
      },

      // Enable real-time monitoring - FIXED: Proper interval management
      enableRealTime: () => {
        const state = get();
        
        // Clear existing interval if any
        if (state.intervalId) {
          clearInterval(state.intervalId);
        }
        
        set({ isRealTimeEnabled: true });
        analyticsService.startMonitoring();
        
        // Set up periodic refresh
        const interval = state.autoRefreshInterval * 1000;
        const refreshInterval = setInterval(() => {
          const currentState = get();
          if (currentState.isRealTimeEnabled && !currentState.isLoading) {
            currentState.refreshAnalytics();
          }
        }, interval);
        
        // Store interval ID properly
        set({ intervalId: refreshInterval });
      },

      // Disable real-time monitoring - FIXED: Proper cleanup
      disableRealTime: () => {
        const state = get();
        
        // Clear refresh interval
        if (state.intervalId) {
          clearInterval(state.intervalId);
          set({ intervalId: null });
        }
        
        set({ isRealTimeEnabled: false });
        
        // Stop service monitoring
        analyticsService.stopMonitoring();
      },

      // Set auto-refresh interval - FIXED: Proper interval restart
      setAutoRefreshInterval: (seconds: number) => {
        set({ autoRefreshInterval: seconds });
        
        // If real-time is enabled, restart with new interval
        const state = get();
        if (state.isRealTimeEnabled) {
          // Temporarily disable and re-enable with new interval
          state.disableRealTime();
          // Small delay to ensure cleanup completes
          setTimeout(() => {
            state.enableRealTime();
          }, 100);
        }
      },

      // Export analytics data
      exportAnalytics: async (options: AnalyticsExportOptions): Promise<string> => {
        try {
          set({ isExporting: true, exportProgress: 0 });
          
          // Simulate progress updates
          const progressInterval = setInterval(() => {
            const currentProgress = get().exportProgress;
            if (currentProgress < 90) {
              set({ exportProgress: currentProgress + 10 });
            }
          }, 100);
          
          const exportData = await analyticsService.exportAnalytics(options);
          
          clearInterval(progressInterval);
          set({ isExporting: false, exportProgress: 100 });
          
          // Reset progress after a short delay
          setTimeout(() => {
            set({ exportProgress: 0 });
          }, 2000);
          
          return exportData;
          
        } catch (error) {
          set({ isExporting: false, exportProgress: 0 });
          const errorMessage = error instanceof Error ? error.message : 'Export failed';
          set({ error: errorMessage });
          throw error;
        }
      },

      // Clear error state
      clearError: () => {
        set({ error: null, refreshStatus: 'idle' });
      },

      // Reset analytics state - FIXED: Proper cleanup
      reset: () => {
        // Disable real-time monitoring if enabled
        const state = get();
        if (state.isRealTimeEnabled) {
          state.disableRealTime();
        }
        
        set({
          metrics: null,
          currentView: 'overview',
          timeRange: defaultTimeRange,
          isLoading: false,
          refreshStatus: 'idle',
          lastUpdated: null,
          error: null,
          isRealTimeEnabled: false,
          intervalId: null, // Fixed: Reset interval ID
          isExporting: false,
          exportProgress: 0,
          selectedMetrics: ['bundlePerformance', 'walletAnalytics', 'networkStats', 'transactionTracking', 'gasAnalytics'],
          customFilters: {},
        });
      },
    }),
    {
      name: 'bnb-bundler-analytics',
      partialize: (state) => ({
        currentView: state.currentView,
        timeRange: state.timeRange,
        selectedMetrics: state.selectedMetrics,
        autoRefreshInterval: state.autoRefreshInterval,
        customFilters: state.customFilters,
      }),
    }
  )
);

// Helper functions for creating time ranges
export const createTimeRange = (period: '1h' | '4h' | '12h' | '24h' | '7d' | '30d' | 'all'): AnalyticsTimeRange => {
  const end = new Date();
  let start: Date;
  let granularity: 'minute' | 'hour' | 'day' | 'week';

  switch (period) {
    case '1h':
      start = new Date(end.getTime() - 60 * 60 * 1000);
      granularity = 'minute';
      break;
    case '4h':
      start = new Date(end.getTime() - 4 * 60 * 60 * 1000);
      granularity = 'minute';
      break;
    case '12h':
      start = new Date(end.getTime() - 12 * 60 * 60 * 1000);
      granularity = 'hour';
      break;
    case '24h':
      start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
      granularity = 'hour';
      break;
    case '7d':
      start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
      granularity = 'day';
      break;
    case '30d':
      start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
      granularity = 'day';
      break;
    case 'all':
      start = new Date(end.getTime() - 365 * 24 * 60 * 60 * 1000); // 1 year
      granularity = 'week';
      break;
    default:
      start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
      granularity = 'hour';
  }

  return { start, end, period, granularity };
};

// Utility function to format time range for display
export const formatTimeRange = (timeRange: AnalyticsTimeRange): string => {
  const { period } = timeRange;
  
  switch (period) {
    case '1h': return 'Last Hour';
    case '4h': return 'Last 4 Hours';
    case '12h': return 'Last 12 Hours';
    case '24h': return 'Last 24 Hours';
    case '7d': return 'Last 7 Days';
    case '30d': return 'Last 30 Days';
    case 'all': return 'All Time';
    default: return 'Custom Range';
  }
};

// Utility function to get view display name
export const getViewDisplayName = (view: AnalyticsViewMode): string => {
  switch (view) {
    case 'overview': return 'Overview';
    case 'bundles': return 'Bundle Performance';
    case 'wallets': return 'Wallet Analytics';
    case 'network': return 'Network Stats';
    case 'transactions': return 'Transaction Tracking';
    case 'gas': return 'Gas Analytics';
    default: return 'Analytics';
  }
};

// Analytics store monitoring functions
let analyticsMonitoringInterval: NodeJS.Timeout | null = null;

export const startAnalyticsMonitoring = (): void => {
  if (analyticsMonitoringInterval) {
    clearInterval(analyticsMonitoringInterval);
  }
  
  // Initialize analytics service
  analyticsService.initialize().catch(error => {
    console.error('Failed to initialize analytics service:', error);
  });
  
  // Monitor analytics store state and sync with service
  analyticsMonitoringInterval = setInterval(() => {
    const state = useAnalyticsStore.getState();
    
    if (state.isRealTimeEnabled && !state.isLoading) {
      // Trigger refresh if real-time is enabled
      state.refreshAnalytics().catch(error => {
        console.error('Analytics monitoring refresh failed:', error);
      });
    }
  }, 60000); // Check every minute
  
  console.log('Analytics monitoring started');
};

export const stopAnalyticsMonitoring = (): void => {
  if (analyticsMonitoringInterval) {
    clearInterval(analyticsMonitoringInterval);
    analyticsMonitoringInterval = null;
  }
  
  // Stop analytics service monitoring
  analyticsService.stopMonitoring();
  
  console.log('Analytics monitoring stopped');
};

// Initialize analytics when store is created
analyticsService.initialize().catch(error => {
  console.error('Failed to initialize analytics service:', error);
});

// Export store type for use in components
export type { AnalyticsState };