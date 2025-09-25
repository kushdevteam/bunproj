/**
 * Token Launch Management Store using Zustand
 * Handles token launches, drafts, statistics, and creation form state
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateSessionId } from '../utils/crypto';
import { apiClient } from '../api/client';
import { fourMemeClient } from '../services/four-meme-client';
import { useWalletStore } from './wallets';
import { useSessionStore } from './session';

// Launch/Token types
export interface TokenLaunch {
  id: string;
  projectName: string;
  symbol: string;
  description: string;
  image?: {
    file: File | null;
    preview?: string;
    dimensions?: { width: number; height: number };
  };
  socialLinks: {
    twitter?: string;
    telegram?: string;
    website?: string;
  };
  launchOptions: {
    selectedOption: string | null;
    availableOptions: string[];
  };
  status: 'draft' | 'saved' | 'launching' | 'launched' | 'failed';
  createdAt: string;
  updatedAt: string;
  launchedAt?: string;
  contractAddress?: string;
  transactionHash?: string;
  profitBnb?: number;
}

export interface LaunchStatistics {
  tokensLaunched: number;
  totalProfitsBnb: number;
  lastLaunchDate: string | null;
  lastLaunchSymbol: string | null;
  totalDrafts: number;
  averageProfitPerLaunch: number;
}

export interface LaunchFormState {
  currentDraft: Partial<TokenLaunch>;
  isFormValid: boolean;
  validationErrors: Record<string, string>;
  isSaving: boolean;
  isLaunching: boolean;
  selectedFile: File | null;
}

// Available launch options (only "Four" with four.meme branding)
export const LAUNCH_OPTIONS = [
  'Four'
] as const;

export type LaunchOption = typeof LAUNCH_OPTIONS[number];

interface LaunchState {
  // Launch data
  launches: TokenLaunch[];
  drafts: TokenLaunch[];
  statistics: LaunchStatistics;
  
  // Form state
  formState: LaunchFormState;
  
  // UI state
  showConfirmationModal: boolean;
  confirmationData: Partial<TokenLaunch> | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions - Launch Management
  createDraft: () => string;
  updateDraft: (updates: Partial<TokenLaunch>) => void;
  saveDraft: () => Promise<boolean>;
  deleteDraft: (id: string) => void;
  loadDraft: (id: string) => void;
  
  // Actions - Launch Process
  prepareLaunch: (draftId: string) => void;
  confirmLaunch: () => Promise<boolean>;
  cancelLaunch: () => void;
  
  // Actions - Form Management
  updateFormField: (field: keyof TokenLaunch, value: any) => void;
  setImage: (file: File | null) => void;
  setSocialLink: (platform: 'twitter' | 'telegram' | 'website', url: string) => void;
  selectLaunchOption: (option: LaunchOption) => void;
  validateForm: () => boolean;
  resetForm: () => void;
  
  // Actions - Statistics
  refreshStatistics: () => void;
  addSuccessfulLaunch: (launch: TokenLaunch, profit: number) => void;
  
  // Actions - UI
  showConfirmation: (data: Partial<TokenLaunch>) => void;
  hideConfirmation: () => void;
  clearError: () => void;
}

// Default form state
const defaultFormState: LaunchFormState = {
  currentDraft: {
    projectName: '',
    symbol: '',
    description: '',
    image: {
      file: null,
      preview: undefined,
    },
    socialLinks: {
      twitter: '',
      telegram: '',
      website: '',
    },
    launchOptions: {
      selectedOption: null,
      availableOptions: [...LAUNCH_OPTIONS],
    },
    status: 'draft',
  },
  isFormValid: false,
  validationErrors: {},
  isSaving: false,
  isLaunching: false,
  selectedFile: null,
};

// Default statistics
const defaultStatistics: LaunchStatistics = {
  tokensLaunched: 0,
  totalProfitsBnb: 0,
  lastLaunchDate: null,
  lastLaunchSymbol: null,
  totalDrafts: 0,
  averageProfitPerLaunch: 0,
};

export const useLaunchStore = create<LaunchState>()(
  persist(
    (set, get) => ({
      // Initial state
      launches: [],
      drafts: [],
      statistics: defaultStatistics,
      formState: defaultFormState,
      showConfirmationModal: false,
      confirmationData: null,
      isLoading: false,
      error: null,

      // Create new draft
      createDraft: () => {
        const id = generateSessionId();
        const now = new Date().toISOString();
        
        const newDraft: TokenLaunch = {
          id,
          projectName: '',
          symbol: '',
          description: '',
          image: {
            file: null,
          },
          socialLinks: {
            twitter: '',
            telegram: '',
            website: '',
          },
          launchOptions: {
            selectedOption: null,
            availableOptions: [...LAUNCH_OPTIONS],
          },
          status: 'draft',
          createdAt: now,
          updatedAt: now,
        };

        set(state => ({
          drafts: [...state.drafts, newDraft],
          formState: {
            ...defaultFormState,
            currentDraft: newDraft,
          }
        }));

        get().refreshStatistics();
        return id;
      },

      // Update current draft
      updateDraft: (updates: Partial<TokenLaunch>) => {
        set(state => {
          const currentDraft = { ...state.formState.currentDraft, ...updates };
          const updatedDrafts = state.drafts.map(draft => 
            draft.id === currentDraft.id ? { ...draft, ...updates, updatedAt: new Date().toISOString() } : draft
          );

          return {
            drafts: updatedDrafts,
            formState: {
              ...state.formState,
              currentDraft,
            }
          };
        });

        get().validateForm();
        get().refreshStatistics();
      },

      // Save draft
      saveDraft: async () => {
        try {
          set(state => ({ 
            formState: { ...state.formState, isSaving: true },
            error: null 
          }));

          const { formState } = get();
          if (!formState.currentDraft.id) {
            throw new Error('No draft to save');
          }

          // Convert frontend format to backend format
          const draftData = {
            id: formState.currentDraft.id,
            project_name: formState.currentDraft.projectName || '',
            symbol: formState.currentDraft.symbol || '',
            description: formState.currentDraft.description || '',
            twitter: formState.currentDraft.socialLinks?.twitter || null,
            telegram: formState.currentDraft.socialLinks?.telegram || null,
            website: formState.currentDraft.socialLinks?.website || null,
            launch_option: formState.currentDraft.launchOptions?.selectedOption || null,
            status: 'saved',
          };

          // Save to backend
          const response = await apiClient.saveDraft(draftData);
          
          if (!response.success) {
            throw new Error(response.error || 'Failed to save draft');
          }

          // Update local state
          get().updateDraft({ 
            status: 'saved',
            updatedAt: new Date().toISOString()
          });

          set(state => ({ 
            formState: { ...state.formState, isSaving: false } 
          }));

          return true;
        } catch (error) {
          set(state => ({ 
            formState: { ...state.formState, isSaving: false },
            error: error instanceof Error ? error.message : 'Failed to save draft'
          }));
          return false;
        }
      },

      // Delete draft
      deleteDraft: (id: string) => {
        set(state => ({
          drafts: state.drafts.filter(draft => draft.id !== id),
          formState: state.formState.currentDraft?.id === id ? defaultFormState : state.formState
        }));
        get().refreshStatistics();
      },

      // Load draft
      loadDraft: (id: string) => {
        const draft = get().drafts.find(d => d.id === id);
        if (draft) {
          set(state => ({
            formState: {
              ...state.formState,
              currentDraft: draft,
            }
          }));
          get().validateForm();
        }
      },

      // Prepare launch (show confirmation)
      prepareLaunch: (draftId: string) => {
        const draft = get().drafts.find(d => d.id === draftId);
        if (draft && get().validateForm()) {
          get().showConfirmation(draft);
        }
      },

      // Confirm and execute launch
      confirmLaunch: async () => {
        try {
          set(state => ({ 
            formState: { ...state.formState, isLaunching: true },
            error: null 
          }));

          const { confirmationData } = get();
          if (!confirmationData?.id) {
            throw new Error('No launch data to confirm');
          }

          console.log('Starting token creation with four.meme...');

          // Get wallet stores for private key access
          const walletStore = useWalletStore.getState();
          const sessionStore = useSessionStore.getState();

          // Check if session is unlocked - this is the only required validation
          if (!sessionStore.isUnlocked) {
            throw new Error('Session must be unlocked to create tokens. Please unlock your session.');
          }

          // Only check for wallets if we have any - wallet generation happens in launch plan step
          let creatorWallet = null;
          if (walletStore.wallets.length > 0) {
            creatorWallet = walletStore.wallets[0];
          }

          // Handle wallet requirements for token creation
          let privateKey: string | null = null;
          
          if (creatorWallet) {
            console.log(`Creating token using wallet: ${creatorWallet.address}`);
            
            // Get private key for transaction signing using secure session-based approach
            try {
              // First try session-based decryption (for wallets created during this session)
              const sessionDecryptedKey = await walletStore.getDecryptedPrivateKeyFromSession(creatorWallet.id);
              
              if (sessionDecryptedKey) {
                privateKey = sessionDecryptedKey;
                console.log('Successfully decrypted wallet using session-based approach');
              } else {
                // SECURITY FIX: No insecure fallback - require proper session unlock or explicit user authentication
                throw new Error('Unable to decrypt wallet. Please ensure your session is properly unlocked or the wallet was encrypted with the current session key. For enhanced security, deterministic passphrase fallbacks have been removed.');
              }
            } catch (decryptError) {
              console.error('Private key decryption failed:', decryptError);
              throw new Error(`Unable to access wallet for token creation: ${decryptError instanceof Error ? decryptError.message : 'Unknown decryption error'}`);
            }
          } else {
            console.log('No wallets available - proceeding with token creation using four.meme default wallet');
            // Token creation will use four.meme's managed wallet system
          }

          // Prepare token data for four.meme API
          const tokenData = {
            name: confirmationData.projectName || 'Unnamed Token',
            symbol: confirmationData.symbol || 'TOKEN',
            description: confirmationData.description || 'Created with JustJewIt Token Launcher',
            imageFile: confirmationData.image?.file || null,
            socialLinks: {
              website: confirmationData.socialLinks?.website || '',
              twitter: confirmationData.socialLinks?.twitter || '',
              telegram: confirmationData.socialLinks?.telegram || ''
            },
            launchTime: Date.now(),
            preSaleBnb: '0' // No presale for now
          };

          console.log('Token data prepared:', {
            name: tokenData.name,
            symbol: tokenData.symbol,
            description: tokenData.description.substring(0, 50) + '...',
            hasImage: !!tokenData.imageFile,
            socialLinks: tokenData.socialLinks
          });

          // Execute token creation through four.meme with progress tracking
          const tokenResult = await fourMemeClient.createToken(tokenData, privateKey || '', (step: string, progress: number) => {
            console.log(`Token creation progress: ${step} (${progress}%)`);
            // Note: In the future, this could update the loading screen with specific progress
          });

          console.log('Token creation successful:', tokenResult);

          // Calculate estimated profit (this would come from actual trading data in production)
          const estimatedProfit = 0; // No profit calculation yet since token just launched

          const now = new Date().toISOString();
          const launchedToken: TokenLaunch = {
            ...confirmationData as TokenLaunch,
            status: 'launched',
            launchedAt: now,
            contractAddress: tokenResult.contractAddress,
            transactionHash: tokenResult.transactionHash,
            profitBnb: estimatedProfit,
          };

          set(state => ({
            launches: [...state.launches, launchedToken],
            drafts: state.drafts.filter(d => d.id !== confirmationData.id),
            formState: { ...state.formState, isLaunching: false },
            showConfirmationModal: false,
            confirmationData: null,
          }));

          // Update statistics
          get().addSuccessfulLaunch(launchedToken, estimatedProfit);

          console.log('Token launch completed successfully:', {
            name: launchedToken.projectName,
            symbol: launchedToken.symbol,
            contractAddress: launchedToken.contractAddress,
            transactionHash: launchedToken.transactionHash,
            fourMemeUrl: `https://four.meme/token/${launchedToken.contractAddress}`
          });

          return true;
        } catch (error) {
          console.error('Token launch failed:', error);
          set(state => ({ 
            formState: { ...state.formState, isLaunching: false },
            error: error instanceof Error ? error.message : 'Token launch failed'
          }));
          return false;
        }
      },

      // Cancel launch
      cancelLaunch: () => {
        set({
          showConfirmationModal: false,
          confirmationData: null,
        });
      },

      // Update form field
      updateFormField: (field: keyof TokenLaunch, value: any) => {
        get().updateDraft({ [field]: value });
      },

      // Set image
      setImage: (file: File | null) => {
        let preview: string | undefined;
        
        if (file) {
          preview = URL.createObjectURL(file);
        }

        get().updateDraft({
          image: {
            file,
            preview,
          }
        });

        set(state => ({
          formState: {
            ...state.formState,
            selectedFile: file,
          }
        }));
      },

      // Set social link
      setSocialLink: (platform: 'twitter' | 'telegram' | 'website', url: string) => {
        const { formState } = get();
        const currentSocialLinks = formState.currentDraft.socialLinks || {};
        
        get().updateDraft({
          socialLinks: {
            ...currentSocialLinks,
            [platform]: url,
          }
        });
      },

      // Select launch option
      selectLaunchOption: (option: LaunchOption) => {
        get().updateDraft({
          launchOptions: {
            selectedOption: option,
            availableOptions: [...LAUNCH_OPTIONS],
          }
        });
      },

      // Validate form
      validateForm: () => {
        const { formState } = get();
        const { currentDraft } = formState;
        const errors: Record<string, string> = {};

        // Validate required fields
        if (!currentDraft.projectName?.trim()) {
          errors.projectName = 'Project name is required';
        }

        if (!currentDraft.symbol?.trim()) {
          errors.symbol = 'Symbol is required';
        } else if (currentDraft.symbol.length > 10) {
          errors.symbol = 'Symbol must be 10 characters or less';
        }

        if (!currentDraft.description?.trim()) {
          errors.description = 'Description is required';
        } else if (currentDraft.description.length < 10) {
          errors.description = 'Description must be at least 10 characters';
        }

        if (!currentDraft.launchOptions?.selectedOption) {
          errors.launchOption = 'Please select a launch option';
        }

        const isValid = Object.keys(errors).length === 0;

        set(state => ({
          formState: {
            ...state.formState,
            isFormValid: isValid,
            validationErrors: errors,
          }
        }));

        return isValid;
      },

      // Reset form
      resetForm: () => {
        set({ formState: defaultFormState });
      },

      // Refresh statistics
      refreshStatistics: () => {
        const { launches, drafts } = get();
        
        const tokensLaunched = launches.length;
        const totalProfitsBnb = launches.reduce((sum, launch) => sum + (launch.profitBnb || 0), 0);
        const lastLaunch = launches
          .filter(l => l.launchedAt)
          .sort((a, b) => new Date(b.launchedAt!).getTime() - new Date(a.launchedAt!).getTime())[0];
        
        const statistics: LaunchStatistics = {
          tokensLaunched,
          totalProfitsBnb,
          lastLaunchDate: lastLaunch?.launchedAt || null,
          lastLaunchSymbol: lastLaunch?.symbol || null,
          totalDrafts: drafts.length,
          averageProfitPerLaunch: tokensLaunched > 0 ? totalProfitsBnb / tokensLaunched : 0,
        };

        set({ statistics });
      },

      // Add successful launch
      addSuccessfulLaunch: (launch: TokenLaunch, profit: number) => {
        set(state => {
          const updatedLaunch = { ...launch, profitBnb: profit };
          const launches = state.launches.map(l => 
            l.id === launch.id ? updatedLaunch : l
          );
          return { launches };
        });
        get().refreshStatistics();
      },

      // Show confirmation modal
      showConfirmation: (data: Partial<TokenLaunch>) => {
        set({
          showConfirmationModal: true,
          confirmationData: data,
        });
      },

      // Hide confirmation modal
      hideConfirmation: () => {
        set({
          showConfirmationModal: false,
          confirmationData: null,
        });
      },


      // Clear error
      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'launch-store',
      partialize: (state) => ({
        launches: state.launches,
        drafts: state.drafts.map(draft => ({
          ...draft,
          image: draft.image ? { ...draft.image, file: null } : undefined // Don't persist File objects
        })),
        statistics: state.statistics,
      }),
    }
  )
);

// Initialize statistics on store creation
setTimeout(() => {
  useLaunchStore.getState().refreshStatistics();
}, 100);