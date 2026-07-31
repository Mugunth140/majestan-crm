"use client";

import { WifiOff } from 'lucide-react'

export default function OfflinePage() {
  return (
    <div className="flex flex-col items-center justify-center h-[100dvh] w-full px-6 bg-background text-center">
      <div className="w-20 h-20 bg-muted flex items-center justify-center rounded-full mb-6">
        <WifiOff className="w-10 h-10 text-muted-foreground" />
      </div>
      <h1 className="text-2xl font-bold text-foreground mb-2">You are offline</h1>
      <p className="text-muted-foreground text-sm max-w-sm mb-8">
        It seems you have lost your internet connection. Please check your network and try again.
      </p>
      <button 
        onClick={() => window.location.reload()}
        className="h-12 px-8 bg-blue-600 text-white rounded-xl font-medium active:scale-95 transition-transform"
      >
        Retry Connection
      </button>
    </div>
  )
}
