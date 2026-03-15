'use client';

import { BRANDING_NAME } from '@lobechat/business-const';
import { motion } from 'motion/react';

import styles from './index.module.css';

const DEFAULT_START_TEXT = 'Get Started';
const DEFAULT_LAUNCH_SLOGAN = 'Your AI workspace, engineered for the future by Avato.';

type BrandTextLoadingMode = 'default' | 'launch';

interface BrandTextLoadingProps {
  brandName?: string;
  debugId?: string;
  mode?: BrandTextLoadingMode;
  onStart?: () => void;
  slogan?: string;
  startButtonText?: string;
}

const BrandTextLoading = ({
  debugId,
  mode = 'default',
  brandName,
  slogan = DEFAULT_LAUNCH_SLOGAN,
  startButtonText = DEFAULT_START_TEXT,
  onStart,
}: BrandTextLoadingProps) => {
  const isLaunchMode = mode === 'launch';
  const showDebug = process.env.NODE_ENV === 'development' && debugId;
  const resolvedBrandName = brandName ?? BRANDING_NAME;

  const handleStart = () => {
    if (onStart) {
      onStart();
      return;
    }

    window.location.assign('/');
  };

  return (
    <div className={styles.container}>
      <div aria-label="Loading" className={styles.brand} role="status">
        <motion.div
          animate={isLaunchMode ? { y: 0, opacity: 1 } : false}
          className={styles.brandLogoWrapper}
          initial={isLaunchMode ? { y: 42, opacity: 0 } : false}
          transition={
            isLaunchMode
              ? {
                  duration: 0.9,
                  ease: [0.22, 1, 0.36, 1],
                }
              : undefined
          }
        >
          <img alt={resolvedBrandName} className={styles.brandLogoImg} src="/avatars/lobe-ai.png" />
        </motion.div>

        <motion.div
          animate={isLaunchMode ? { opacity: 1 } : false}
          className={styles.brandName}
          initial={isLaunchMode ? { opacity: 0 } : false}
          transition={
            isLaunchMode
              ? {
                  delay: 0.45,
                  duration: 0.35,
                }
              : undefined
          }
        >
          {resolvedBrandName}
        </motion.div>

        <motion.div
          animate={isLaunchMode ? { opacity: 1 } : false}
          className={styles.slogan}
          initial={isLaunchMode ? { opacity: 0, y: 16 } : false}
          transition={
            isLaunchMode
              ? {
                  delay: 0.85,
                  duration: 0.45,
                }
              : undefined
          }
        >
          {slogan.split(' ').map((word, index) => (
            <motion.span
              animate={isLaunchMode ? { opacity: 1, y: 0 } : false}
              className={styles.sloganWord}
              initial={isLaunchMode ? { opacity: 0, y: 8 } : false}
              key={`${word}-${index}`}
              transition={
                isLaunchMode
                  ? {
                      delay: 0.9 + index * 0.08,
                      duration: 0.35,
                    }
                  : undefined
              }
            >
              {word}
            </motion.span>
          ))}
        </motion.div>

        {isLaunchMode && (
          <motion.button
            animate={{ opacity: 1, y: 0 }}
            className={styles.startButton}
            initial={{ opacity: 0, y: 20 }}
            transition={{ delay: 1.5, duration: 0.4 }}
            type="button"
            onClick={handleStart}
          >
            {startButtonText}
          </motion.button>
        )}
      </div>

      {showDebug && (
        <div className={styles.debug}>
          <div className={styles.debugRow}>
            <code>Debug ID:</code>
            <span className={styles.debugTag}>
              <code>{debugId}</code>
            </span>
          </div>
          <div className={styles.debugHint}>only visible in development</div>
        </div>
      )}
    </div>
  );
};

export default BrandTextLoading;
