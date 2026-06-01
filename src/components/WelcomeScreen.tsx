import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, ImagePlus, Library } from 'lucide-react';
import { GuestData } from '../types';

interface WelcomeScreenProps {
  onComplete: (data: GuestData) => void;
  onOpenGallery: () => void;
}

const welcomeTexts = [
  "chào mừng bạn đã đến\nvới cuốn lưu bút của\nnguyễn thuận phát\n12a2\ntrường thpt chuyên hùng vương",
  "bienvenue dans\nle livre d'or de\nnguyen thuan phat\n12a2\nlycée d'excellence hung vuong",
  "welcome to\nthe guestbook of\nnguyen thuan phat\n12a2\nhung vuong for the gifted"
];

export default function WelcomeScreen({ onComplete, onOpenGallery }: WelcomeScreenProps) {
  const [formData, setFormData] = useState({
    fullName: '',
    nickname: '',
    className: '',
    schoolName: '',
  });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [randomAngle] = useState(Math.random() * 10 - 5); // Tilted less
  const [textIndex, setTextIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTextIndex((prev) => (prev + 1) % welcomeTexts.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        const img = new window.Image();
        img.onload = () => {
          let w = img.width;
          let h = img.height;
          const MAX_SIZE = 400; // Avatars can be smaller
          if (w > MAX_SIZE || h > MAX_SIZE) {
             const ratio = w / h;
             if (ratio > 1) {
                w = MAX_SIZE;
                h = MAX_SIZE / ratio;
             } else {
                h = MAX_SIZE;
                w = MAX_SIZE * ratio;
             }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (ctx) {
             ctx.drawImage(img, 0, 0, w, h);
             const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);
             setAvatarUrl(compressedBase64);
          }
        };
        img.src = base64data;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStart = () => {
    onComplete({
      ...formData,
      avatarUrl,
    });
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row items-center justify-center p-6 md:p-12 gap-8 lg:gap-16 bg-brat text-black overflow-x-hidden">
      {/* Intro and Polaroid */}
      <div className="flex-1 w-full flex flex-col pt-4 md:pt-0 max-w-2xl">
        {/* Fixed height container for text to avoid layout layout jump but text doesn't overflow container constraints */}
        <div className="min-h-[160px] sm:min-h-[180px] md:min-h-[280px] lg:min-h-[350px] w-full flex items-start justify-start relative">
          <AnimatePresence mode="wait">
            <motion.div
               key={textIndex}
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -10 }}
               transition={{ duration: 0.5 }}
               className="text-[26px] sm:text-4xl md:text-[44px] lg:text-6xl font-bold lowercase tracking-tighter leading-[1.1] md:leading-[1.05] whitespace-pre-wrap break-words w-full"
            >
              {welcomeTexts[textIndex]}
            </motion.div>
          </AnimatePresence>
        </div>

        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1, rotate: randomAngle }}
          transition={{ duration: 0.5, type: 'spring' }}
          className="hidden md:block relative bg-white p-3 pb-12 shadow-xl border border-gray-200 mt-8 self-start w-56 lg:w-64 shrink-0"
        >
          <div className="w-full aspect-square bg-gray-200 overflow-hidden">
            {/* Fallback image if mainavt doesn't exist */}
            <img 
              src="/img/avatar.jpg" 
              alt="Nguyễn Thuận Phát" 
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.src = 'https://api.dicebear.com/7.x/notionists/svg?seed=Phat'; // Placeholder if no file
              }}
            />
          </div>
          <p className="text-sm font-bold text-center mt-2 lowercase">t. phát</p>
        </motion.div>
      </div>

      {/* Form */}
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm flex flex-col gap-3 md:gap-4 mt-8 lg:mt-0 shrink-0"
      >
        <div className="flex flex-col items-center mb-6">
          <label className="relative cursor-pointer group">
            <div className={`w-32 h-32 rounded-full border-4 border-black/20 flex flex-col items-center justify-center overflow-hidden bg-black/5 group-hover:bg-black/10 transition-colors ${avatarUrl ? '' : 'border-dashed'}`}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="Your avatar" className="w-full h-full object-cover" />
              ) : (
                <>
                  <Camera className="w-8 h-8 mb-2 opacity-50" />
                  <span className="text-xs font-bold uppercase opacity-50">Upload Ảnh</span>
                </>
              )}
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          </label>
        </div>

        <input 
          type="text" 
          placeholder="họ và tên" 
          className="w-full bg-black/5 border-2 border-black/20 rounded-none px-4 py-3 focus:outline-none focus:border-black placeholder:text-black/40 text-lg lowercase"
          value={formData.fullName}
          onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
        />
        <input 
          type="text" 
          placeholder="biệt danh" 
          className="w-full bg-black/5 border-2 border-black/20 rounded-none px-4 py-3 focus:outline-none focus:border-black placeholder:text-black/40 text-lg lowercase"
          value={formData.nickname}
          onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
        />
        <input 
          type="text" 
          placeholder="lớp" 
          className="w-full bg-black/5 border-2 border-black/20 rounded-none px-4 py-3 focus:outline-none focus:border-black placeholder:text-black/40 text-lg lowercase"
          value={formData.className}
          onChange={(e) => setFormData({ ...formData, className: e.target.value })}
        />
        <input 
          type="text" 
          placeholder="tên trường" 
          className="w-full bg-black/5 border-2 border-black/20 rounded-none px-4 py-3 focus:outline-none focus:border-black placeholder:text-black/40 text-lg lowercase"
          value={formData.schoolName}
          onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
        />
        
        <button 
          onClick={handleStart}
          className="mt-4 w-full bg-black text-brat uppercase font-bold tracking-widest py-4 hover:bg-black/80 transition-colors"
        >
          vào ghi lưu bút
        </button>
      </motion.div>

      {/* Floating Gallery Button */}
      <motion.button
        onClick={onOpenGallery}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="fixed bottom-6 right-6 md:bottom-8 md:right-8 bg-white text-black p-3 md:p-4 rounded-full shadow-xl hover:scale-110 active:scale-95 transition-transform flex items-center justify-center border-2 border-black/10 z-50 group cursor-pointer"
        title="Xem Thư Viện"
      >
        <Library className="w-5 h-5 md:w-6 md:h-6" />
        <span className="w-0 overflow-hidden whitespace-nowrap group-hover:w-24 group-hover:ml-2 transition-all duration-300 font-bold lowercase text-sm">thư viện</span>
      </motion.button>
    </div>
  );
}
