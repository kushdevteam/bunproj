/**
 * Loading Screen Component
 * Full-screen loading overlay with spinner and "Saving metadata..." text
 */

import React from 'react';
import { useLaunchStore } from '../store/launches';
import './LoadingScreen.css';

export const LoadingScreen: React.FC = () => {
  const { formState: { isLaunching } } = useLaunchStore();

  if (!isLaunching) {
    return null;
  }

  return (
    <div className="loading-screen-overlay">
      <div className="loading-screen-content">
        <div className="loading-spinner"></div>
        <div className="loading-text">Saving metadata...</div>
      </div>
    </div>
  );
};