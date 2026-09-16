import React from 'react';

/**
 * Nucleo Glass Style Icons
 * Features layered translucent fills with crisp vector outlines and subtle glass highlights.
 */

export const BadgeSparkleGlassIcon: React.FC<{ className?: string }> = ({ className = "w-3.5 h-3.5" }) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {/* Soft glass badge body */}
    <rect x="2" y="2" width="12" height="12" rx="3.5" fill="currentColor" fillOpacity="0.18" />
    <rect x="2" y="2" width="12" height="12" rx="3.5" stroke="currentColor" strokeWidth="1" strokeOpacity="0.35" />
    {/* Specular glass top highlight */}
    <path
      d="M3.5 3.5C4.5 2.7 6.2 2.5 8 2.5C9.8 2.5 11.5 2.7 12.5 3.5"
      stroke="white"
      strokeWidth="0.8"
      strokeLinecap="round"
      strokeOpacity="0.4"
    />
    {/* Central 4-point diamond sparkle */}
    <path
      d="M8 4C8 5.8 6.8 7 5 7.6C4.8 7.7 4.8 8.3 5 8.4C6.8 9 8 10.2 8 12C8 10.2 9.2 9 11 8.4C11.2 8.3 11.2 7.7 11 7.6C9.2 7 8 5.8 8 4Z"
      fill="currentColor"
    />
  </svg>
);

export const CrownGlassIcon: React.FC<{ className?: string }> = ({ className = "w-3.5 h-3.5" }) => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {/* Crown glass body */}
    <path
      d="M2.5 12.5L2 6.5L5.5 9L8 3.5L10.5 9L14 6.5L13.5 12.5H2.5Z"
      fill="currentColor"
      fillOpacity="0.18"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinejoin="round"
    />
    {/* Crown base bar */}
    <path d="M2.5 13.5H13.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    {/* Crown jewels on peak points */}
    <circle cx="2" cy="6.2" r="0.9" fill="currentColor" />
    <circle cx="8" cy="3.2" r="1.1" fill="currentColor" />
    <circle cx="14" cy="6.2" r="0.9" fill="currentColor" />
  </svg>
);
