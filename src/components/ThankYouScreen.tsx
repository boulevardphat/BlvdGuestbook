import { useState, useEffect } from 'react';
import { GuestData } from '../types';
import { formatName, formatSchool, formatClass } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface ThankYouScreenProps {
  guestData: GuestData;
  onHome: () => void;
  onGallery: () => void;
}

const thanksTexts = [
  { main: "cảm ơn bạn", sub: "đã để lại một kỉ niệm tuyệt vời trong thanh xuân của mình." },
  { main: "merci", sub: "d'avoir laissé un si beau souvenir dans ma jeunesse." },
  { main: "thank you", sub: "for leaving such a wonderful memory in my youth." },
];

export default function ThankYouScreen({ guestData, onHome, onGallery }: ThankYouScreenProps) {
  const [textIndex, setTextIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTextIndex((prev) => (prev + 1) % thanksTexts.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);
  const formattedName = formatName(guestData.fullName);
  const formattedClass = formatClass(guestData.className);
  const formattedSchool = formatSchool(guestData.schoolName);
  const displayName = guestData.nickname ? `${formattedName} (${guestData.nickname})` : formattedName;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-brat text-black selection:bg-black selection:text-brat">
      <div className="max-w-2xl w-full text-center h-48 md:h-64 relative flex flex-col justify-center items-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={textIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.5 }}
            className="absolute w-full"
          >
            <h1 className="text-4xl md:text-8xl font-bold lowercase tracking-tighter leading-none mb-4 md:mb-8">
              {thanksTexts[textIndex].main}
            </h1>
            
            <div className="text-lg md:text-3xl lowercase border-t-4 border-black inline-block pt-4 md:pt-8 space-y-4">
              <p>{thanksTexts[textIndex].sub}</p>
            </div>
          </motion.div>
        </AnimatePresence>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1 }}
          className="absolute -bottom-16 md:-bottom-20 w-full text-center"
        >
          {(displayName || formattedClass || formattedSchool) && (
             <div className="text-black/60 font-medium">
               {displayName && <div>{displayName}</div>}
               {(formattedClass || formattedSchool) && (
                 <div>{[formattedClass, formattedSchool].filter(Boolean).join(' • ')}</div>
               )}
             </div>
          )}
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 2 }}
        className="mt-24 md:mt-32 text-center flex gap-6"
      >
        <button 
          onClick={onHome}
          className="text-black/50 hover:text-black font-bold lowercase tracking-wider hover:border-b-2 border-black transition-all"
        >
          về trang chủ
        </button>
        <button 
          onClick={onGallery}
          className="text-black font-bold lowercase tracking-wider border-b border-black hover:border-black/50 transition-colors"
        >
          xem thư viện
        </button>
      </motion.div>
    </div>
  );
}
