"use client";

import { useEffect } from "react";
import { useMobileHeader } from "./mobile-header-context";

interface MobileHeaderProps {
  title: string;
  showBack?: boolean;
}

export function MobileHeader({ title, showBack = false }: MobileHeaderProps) {
  const { setTitle, setShowBack } = useMobileHeader();

  useEffect(() => {
    setTitle(title);
    setShowBack(showBack);
    return () => {
      setTitle(null);
      setShowBack(false);
    };
  }, [title, showBack, setTitle, setShowBack]);

  return null;
}
