import { motion } from 'motion/react';
import { useEffect } from 'react';

interface TransitionScreenProps {
  onComplete: () => void;
}

export default function TransitionScreen({ onComplete }: TransitionScreenProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 2500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 min-h-screen bg-black flex items-center justify-center overflow-hidden z-50">
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 20, rotate: 0 }}
        transition={{ duration: 1.5, ease: 'circIn' }}
        className="w-32 h-32 bg-brat rounded-full"
      />
      
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: 2, times: [0, 0.2, 1] }}
        className="absolute text-black text-6xl md:text-8xl font-bold tracking-tighter lowercase"
      >
        chuẩn bị
      </motion.div>
    </div>
  );
}
