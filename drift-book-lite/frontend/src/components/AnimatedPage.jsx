import { motion } from "framer-motion";

const MotionDiv = motion.div;

export function AnimatedPage({ children }) {
  return (
    <MotionDiv
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
    >
      {children}
    </MotionDiv>
  );
}
