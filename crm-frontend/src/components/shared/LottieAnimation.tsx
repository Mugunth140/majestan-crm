"use client";

import dynamic from 'next/dynamic';

const DotLottieReact = dynamic(
  () => import('@lottiefiles/dotlottie-react').then((mod) => mod.DotLottieReact),
  { ssr: false }
);

interface LottieAnimationProps {
  src: string;
  className?: string;
}

export function LottieAnimation({ src, className }: LottieAnimationProps) {
  return (
    <div className={className}>
      <DotLottieReact
        src={src}
        autoplay
        loop
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}
