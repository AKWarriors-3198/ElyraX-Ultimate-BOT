"use client";

import { motion } from "framer-motion";

export function Reveal({ children, delay = 0, className = "" }: {children: React.ReactNode; delay?: number; className?: string}) {
  return <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .45, delay, ease: [0.22,1,0.36,1] }} className={className}>{children}</motion.div>;
}

export function HoverCard({ children, className = "" }: {children: React.ReactNode; className?: string}) {
  return <motion.div whileHover={{ y: -3 }} transition={{ type: "spring", stiffness: 350, damping: 25 }} className={className}>{children}</motion.div>;
}

export function Pulse() {
  return <motion.span animate={{ opacity: [1,.35,1], scale: [1,.88,1] }} transition={{ duration: 2, repeat: Infinity }} className="inline-block h-2 w-2 rounded-full bg-white" />;
}