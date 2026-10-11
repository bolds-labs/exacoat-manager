import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import {
  ShopeeListingItem,
  TikTokListingItem,
  ShopeeInjectImagesResult,
} from '../lib/wordpressBridge';
import { useToast } from './ToastContext';

export interface MarketplaceInjectionJob {
  id: string;
  channel: 'shopee' | 'tiktok';
  channelLabel: string;
  itemId: number | string;
  itemTitle: string;
  status: 'running' | 'completed' | 'failed';
  currentStep: number;
  totalSteps: number;
  stage: string;
  details: string;
  percent: number;
  startedAt: number;
  completedAt?: number;
  result?: ShopeeInjectImagesResult;
  error?: string;
  shopeeItem?: ShopeeListingItem | null;
  tiktokItem?: TikTokListingItem | null;
}

export interface ModalOpenParams {
  item?: ShopeeListingItem | null;
  tiktokItem?: TikTokListingItem | null;
  channel?: 'shopee' | 'tiktok';
  onSuccess?: (res: ShopeeInjectImagesResult) => void;
}

interface MarketplaceInjectionContextType {
  activeJob: MarketplaceInjectionJob | null;
  startJob: (params: {
    channel: 'shopee' | 'tiktok';
    itemId: number | string;
    itemTitle: string;
    totalSteps: number;
    shopeeItem?: ShopeeListingItem | null;
    tiktokItem?: TikTokListingItem | null;
  }) => string;
  updateJobProgress: (
    jobId: string,
    currentStep: number,
    totalSteps: number,
    stage: string,
    details: string
  ) => void;
  completeJob: (jobId: string, result: ShopeeInjectImagesResult) => void;
  failJob: (jobId: string, error: string) => void;
  dismissJob: (jobId?: string) => void;
  // Global modal opener for top bar click
  isModalOpen: boolean;
  modalParams: ModalOpenParams | null;
  openInjectorModal: (params: ModalOpenParams) => void;
  closeInjectorModal: () => void;
}

const MarketplaceInjectionContext = createContext<MarketplaceInjectionContextType | undefined>(
  undefined
);

export const MarketplaceInjectionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [activeJob, setActiveJob] = useState<MarketplaceInjectionJob | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalParams, setModalParams] = useState<ModalOpenParams | null>(null);
  const { showToast } = useToast();

  const activeJobRef = useRef<MarketplaceInjectionJob | null>(null);
  activeJobRef.current = activeJob;

  const startJob = useCallback(
    (params: {
      channel: 'shopee' | 'tiktok';
      itemId: number | string;
      itemTitle: string;
      totalSteps: number;
      shopeeItem?: ShopeeListingItem | null;
      tiktokItem?: TikTokListingItem | null;
    }): string => {
      const id = `${params.channel}-${params.itemId}-${Date.now()}`;
      const channelLabel = params.channel === 'tiktok' ? 'TikTok Shop' : 'Shopee';

      const newJob: MarketplaceInjectionJob = {
        id,
        channel: params.channel,
        channelLabel,
        itemId: params.itemId,
        itemTitle: params.itemTitle || `${channelLabel} Listing #${params.itemId}`,
        status: 'running',
        currentStep: 0,
        totalSteps: Math.max(1, params.totalSteps),
        stage: 'Initializing',
        details: `Preparing ${channelLabel} injection pipeline...`,
        percent: 0,
        startedAt: Date.now(),
        shopeeItem: params.shopeeItem,
        tiktokItem: params.tiktokItem,
      };

      setActiveJob(newJob);
      return id;
    },
    []
  );

  const updateJobProgress = useCallback(
    (
      jobId: string,
      currentStep: number,
      totalSteps: number,
      stage: string,
      details: string
    ) => {
      setActiveJob((prev) => {
        if (!prev || prev.id !== jobId) return prev;
        const safeTotal = Math.max(1, totalSteps);
        const percent = Math.min(100, Math.round((currentStep / safeTotal) * 100));

        return {
          ...prev,
          currentStep,
          totalSteps: safeTotal,
          stage,
          details,
          percent,
        };
      });
    },
    []
  );

  const completeJob = useCallback(
    (jobId: string, result: ShopeeInjectImagesResult) => {
      setActiveJob((prev) => {
        if (!prev || prev.id !== jobId) return prev;
        return {
          ...prev,
          status: 'completed',
          percent: 100,
          currentStep: prev.totalSteps,
          stage: 'Complete',
          details: result.message || `${prev.channelLabel} listing updated successfully.`,
          completedAt: Date.now(),
          result,
        };
      });

      const current = activeJobRef.current;
      const label = current?.channelLabel || 'Marketplace';
      const title = current?.itemTitle || 'Listing';

      showToast(
        'success',
        `${label} Injection Complete`,
        `${title} images and variants updated successfully.`
      );
    },
    [showToast]
  );

  const failJob = useCallback(
    (jobId: string, error: string) => {
      setActiveJob((prev) => {
        if (!prev || prev.id !== jobId) return prev;
        return {
          ...prev,
          status: 'failed',
          stage: 'Failed',
          details: error,
          completedAt: Date.now(),
          error,
        };
      });

      const current = activeJobRef.current;
      const label = current?.channelLabel || 'Marketplace';
      const title = current?.itemTitle || 'Listing';

      showToast(
        'error',
        `${label} Injection Failed`,
        `Failed to update ${title}: ${error}`
      );
    },
    [showToast]
  );

  const dismissJob = useCallback((jobId?: string) => {
    setActiveJob((prev) => {
      if (!prev) return null;
      if (!jobId || prev.id === jobId) return null;
      return prev;
    });
  }, []);

  const openInjectorModal = useCallback((params: ModalOpenParams) => {
    setModalParams(params);
    setIsModalOpen(true);
  }, []);

  const closeInjectorModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  return (
    <MarketplaceInjectionContext.Provider
      value={{
        activeJob,
        startJob,
        updateJobProgress,
        completeJob,
        failJob,
        dismissJob,
        isModalOpen,
        modalParams,
        openInjectorModal,
        closeInjectorModal,
      }}
    >
      {children}
    </MarketplaceInjectionContext.Provider>
  );
};

export const useMarketplaceInjection = (): MarketplaceInjectionContextType => {
  const context = useContext(MarketplaceInjectionContext);
  if (!context) {
    throw new Error(
      'useMarketplaceInjection must be used within a MarketplaceInjectionProvider'
    );
  }
  return context;
};
