import { motion } from 'motion/react';
import { Camera, Ghost } from 'lucide-react';

interface IntroScreenProps {
  onNext: () => void;
}

export default function IntroScreen({ onNext }: IntroScreenProps) {
  return (
    <div className="fixed inset-0 bg-[#fdfaf3] flex items-center justify-center p-6 z-[100]">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white border-4 border-black p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-center"
      >
        <div className="flex justify-center mb-6">
          <div className="relative">
            <motion.div 
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="bg-yellow-300 p-4 border-2 border-black rounded-full"
            >
              <Camera className="w-8 h-8 text-black" />
            </motion.div>
          </div>
        </div>

        <h2 className="text-2xl font-bold mb-4 lowercase tracking-tight">
          một chút chuẩn bị...
        </h2>
        
        <p className="text-gray-700 mb-8 leading-relaxed">
          trước khi bước vào thế giới lưu bút, bạn hãy chọn cho mình một bức ảnh thật xinh để treo cạnh mình nhé? không có cũng không sao cả, sự hiện diện của bạn là món quà lớn nhất rồi.
          <br/><br/>
          (Tui muốn có ảnh mọi người để cùng lắm hẹ hẹ)
        </p>

        <div className="space-y-4">
          <button 
            onClick={onNext}
            className="w-full flex items-center justify-center gap-3 bg-black text-white py-4 px-6 font-bold hover:bg-gray-800 transition-all group"
          >
            <Camera className="w-5 h-5 group-hover:scale-110 transition-transform" />
            Yarshhhhhhhhhhhhhhhhhh
          </button>
          
          <button 
            onClick={onNext}
            className="w-full flex items-center justify-center gap-3 bg-white text-black border-2 border-black py-4 px-6 font-bold hover:bg-gray-50 transition-all group"
          >
            <Ghost className="w-5 h-5 text-gray-400 group-hover:text-black transition-colors" />
            thôi, mình thích làm "người bí ẩn" hơn
          </button>
        </div>

        <p className="mt-6 text-xs text-gray-400 italic">
          * ảnh của bạn sẽ chỉ xuất hiện trong trang lưu bút này thôi.
        </p>
      </motion.div>
    </div>
  );
}
