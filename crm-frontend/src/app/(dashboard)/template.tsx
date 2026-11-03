"use client";

import { motion } from "motion/react";

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      // Full height only where the desktop scroller is fixed-height; on phones the page grows with its content
      className="w-full md:h-full"
    >
      {children}
    </motion.div>
  );
}
