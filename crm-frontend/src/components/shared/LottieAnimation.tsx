"use client";

import dynamic from 'next/dynamic';

const DotLottiePlayer = dynamic(
  () => import('@dotlottie/react-player').then((mod) => mod.DotLottiePlayer),
  { ssr: false }
);

interface LottieAnimationProps {
  src: string;
  className?: string;
}

export function LottieAnimation({ src, className }: LottieAnimationProps) {
  return (
    <div className={className}>
      <DotLottiePlayer
        src={src}
        autoplay
        loop
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}
