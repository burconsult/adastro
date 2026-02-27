import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

type ErrorMascotProps = {
  label?: string;
  accentClass?: string;
  forceMotion?: boolean;
};

const ErrorMascot: React.FC<ErrorMascotProps> = ({
  label = 'Adastro explorer drifting in space',
  accentClass = 'text-primary',
  forceMotion = false
}) => {
  const prefersReducedMotion = useReducedMotion();
  const allowMotion = forceMotion ? true : !prefersReducedMotion;
  const float = allowMotion ? { y: [0, -6, 0] } : {};
  const floatTransition = allowMotion
    ? { duration: 3.6, repeat: Infinity, ease: 'easeInOut' }
    : {};

  return (
    <motion.div
      className="relative mx-auto flex h-56 w-56 items-center justify-center sm:h-64 sm:w-64"
      initial={{ opacity: 0, y: allowMotion ? 12 : 0 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <svg viewBox="0 0 240 240" role="img" aria-label={label} className={`h-full w-full ${accentClass}`}>
        <defs>
          <linearGradient id="helmet" x1="0" x2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.2" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.4" />
          </linearGradient>
          <linearGradient id="rocket" x1="0" x2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.9" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0.6" />
          </linearGradient>
        </defs>

        <circle cx="120" cy="120" r="96" fill="currentColor" opacity="0.08" />
        <circle cx="54" cy="76" r="6" fill="currentColor" opacity="0.35" />
        <circle cx="190" cy="96" r="4" fill="currentColor" opacity="0.28" />
        <circle cx="178" cy="168" r="5" fill="currentColor" opacity="0.25" />

        <motion.g animate={float} transition={floatTransition}>
          <circle cx="120" cy="120" r="42" fill="url(#helmet)" stroke="currentColor" strokeWidth="3" />
          <circle cx="120" cy="120" r="26" fill="currentColor" opacity="0.12" />
          <path
            d="M120 82c15 9 24 20 24 36v9c-7 6-15 9-24 9s-17-3-24-9v-9c0-16 9-27 24-36Z"
            fill="url(#rocket)"
            opacity="0.85"
          />
          <circle cx="120" cy="120" r="6" fill="currentColor" opacity="0.65" />
          <path d="M98 152c6 10 16 16 22 16s16-6 22-16" stroke="currentColor" strokeWidth="3" opacity="0.5" />
        </motion.g>

        <circle cx="120" cy="120" r="70" fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="2" />
        <g>
          <circle cx="190" cy="120" r="6" fill="currentColor" opacity="0.5" />
          <rect x="185" y="108" width="10" height="4" rx="2" fill="currentColor" opacity="0.6" />
          <rect x="185" y="128" width="10" height="4" rx="2" fill="currentColor" opacity="0.6" />
          <circle cx="190" cy="120" r="2" fill="currentColor" opacity="0.9" />
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 120 120"
            to="360 120 120"
            dur="6s"
            repeatCount="indefinite"
          />
        </g>
      </svg>
    </motion.div>
  );
};

export default ErrorMascot;
