import { useState, useRef, useEffect, useCallback } from 'react';
import { Stage, Layer, Line, Text as KonvaText } from 'react-konva';
import { motion, AnimatePresence } from 'motion/react';
import { GuestData, Tool, LayoutBackground, LineNode, TextNode, ImageNode } from '../types';
import { formatClass, formatName, formatSchool, cn } from '../lib/utils';
import URLImage from './URLImage';
import { CanvasBackground, Polaroid } from './CanvasDecorations';
import VoiceRecorder from './VoiceRecorder';
import { 
  PenTool, Eraser, Pointer, Type, Undo2, Redo2, 
  Trash2, RotateCw, Bold, Italic, 
  Underline, ZoomIn, ZoomOut, 
  AlignLeft, AlignCenter, AlignRight, FileText, Palette,
  Mic, Smile, HelpCircle, ArrowLeft, ArrowRight, Check
} from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firebase-error';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import UnderlineExtension from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import FontFamily from '@tiptap/extension-font-family';
import { TextStyle } from '@tiptap/extension-text-style';

const fonts = [
  { name: 'Inter (Hiện đại)', value: 'Inter' },
  { name: 'Be Vietnam Pro (Chuẩn Việt)', value: '"Be Vietnam Pro"' },
  { name: 'Montserrat (Mạnh mẽ)', value: 'Montserrat' },
  { name: 'Playfair Display (Sang trọng)', value: '"Playfair Display"' },
  { name: 'Lora (Cổ điển)', value: 'Lora' },
  { name: 'Dancing Script (Bay bổng)', value: '"Dancing Script"' },
  { name: 'Pacifico (Vui vẻ)', value: 'Pacifico' },
  { name: 'IBM Plex Serif (Nghiêm túc)', value: '"IBM Plex Serif"' },
  { name: 'Saira Condensed (Đậm chất)', value: '"Saira Condensed"' },
  { name: 'Patrick Hand (Viết tay)', value: '"Patrick Hand"' },
];

// Fun high school stickers (emojis + cute quotes)
const stickersList = [
  '🎓', '✨', '❤️', '📝', '🌸', '🎵', '🍀', '🌟', '🎈', '💌', 
  '🔥', '🙌', '💯', '💫', '🌻', '📚', '🎒', '💬', '🍉', '🍦'
];

const coolQuotes = [
  "mãi bên nhau bạn nhá",
  "thanh xuân rực rỡ",
  "12A2 vô địch!",
  "A2 forever",
  "chúc đỗ nguyện vọng 1!",
  "kiểu gì cũng đỗ nhé!",
  "mãi là anh em",
  "kỉ niệm lớp 12"
];

interface MobileGuestbookEditorProps {
  guestData: GuestData;
  onComplete: () => void;
}

export default function MobileGuestbookEditor({ guestData, onComplete }: MobileGuestbookEditorProps) {
  const [mobileStep, setMobileStep] = useState<'text' | 'decor' | 'submit'>('text');
  
  // Tab states
  const [activeTab, setActiveTab] = useState<'canvas' | 'longtext'>('longtext');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>('pen');
  const [background, setBackground] = useState<LayoutBackground>('dotted');
  const [isSaving, setIsSaving] = useState(false);
  const stageRef = useRef<any>(null);

  // Clean values
  const formattedName = formatName(guestData.fullName);
  const formattedClass = formatClass(guestData.className);
  const formattedSchool = formatSchool(guestData.schoolName);

  // Pen state
  const [penColor, setPenColor] = useState('#000000');
  const [penSize, setPenSize] = useState(4);
  
  // Text input overlays
  const [canvasTextInput, setCanvasTextInput] = useState('');
  const [showTextModal, setShowTextModal] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  
  // Selected Text style
  const [textColor, setTextColor] = useState('#000000');
  const [textSize, setTextSize] = useState(20);
  const [textFont, setTextFont] = useState(fonts[1].value); // Be Vietnam Pro
  const [isBold, setIsBold] = useState(true);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  
  // Canvas data
  const [lines, setLines] = useState<LineNode[]>([]);
  const [texts, setTexts] = useState<TextNode[]>([]);
  const [images, setImages] = useState<ImageNode[]>([]);
  
  // Long text state (heartfelt message)
  const [longText, setLongText] = useState('');
  const [ltFont, setLtFont] = useState(fonts[1].value); 
  const [ltSize, setLtSize] = useState(16);
  const [ltColor, setLtColor] = useState('#000000');
  const [ltAlign, setLtAlign] = useState<'left' | 'center' | 'right'>('left');

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      FontFamily,
      UnderlineExtension,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Placeholder.configure({
        placeholder: 'Hôm nay viết cho Phát vài lời chúc tốt đẹp, lời cám ơn hay nhắc lại kỉ niệm ngày xưa nha...',
      }),
    ],
    content: '',
    onUpdate: ({ editor }) => {
      setLongText(editor.getHTML());
    },
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // History (Undo/Redo)
  const [history, setHistory] = useState<{lines: LineNode[], texts: TextNode[], images: ImageNode[]}[]>([{lines: [], texts: [], images: []}]);
  const [historyStep, setHistoryStep] = useState(0);

  const saveHistory = useCallback((newLines: LineNode[], newTexts: TextNode[], newImages: ImageNode[]) => {
    const step = historyStep + 1;
    const newHistory = history.slice(0, step);
    newHistory.push({ lines: newLines, texts: newTexts, images: newImages });
    setHistory(newHistory);
    setHistoryStep(step);
  }, [history, historyStep]);

  const handleUndo = () => {
    if (historyStep === 0) return;
    const prev = historyStep - 1;
    const state = history[prev];
    setLines(state.lines);
    setTexts(state.texts);
    setImages(state.images);
    setHistoryStep(prev);
    setSelectedId(null);
  };

  const isDrawing = useRef(false);
  
  // Set dimensions based on mobile viewport
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 350, height: 420 });
  
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight || 420,
        });
      }
    };
    updateSize();
    const tId = setTimeout(updateSize, 300);
    return () => clearTimeout(tId);
  }, [mobileStep]);

  const handleMouseDown = (e: any) => {
    if (e.target === e.target.getStage()) {
      setSelectedId(null);
    }

    const isStageOrBg = e.target === e.target.getStage() || e.target.name() === 'background-rect';
    if (!isStageOrBg && tool !== 'pen' && tool !== 'eraser') {
      return;
    }

    if (e.target !== e.target.getStage() && e.target.name() !== 'background-rect' && !e.target.attrs?.points) {
       return;
    }

    if (tool !== 'pen' && tool !== 'eraser') return;
    isDrawing.current = true;
    const pos = e.target.getStage().getPointerPosition();
    if (!pos) return;
    
    setLines([...lines, { 
      id: Date.now().toString(), 
      points: [pos.x, pos.y], 
      color: penColor, 
      thickness: penSize,
      isEraser: tool === 'eraser' 
    }]);
  };

  const handleMouseMove = (e: any) => {
    if ((tool !== 'pen' && tool !== 'eraser') || !isDrawing.current) return;
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    if (!point) return;
    let lastLine = lines[lines.length - 1];
    if (!lastLine) return;
    
    lastLine.points = lastLine.points.concat([point.x, point.y]);
    lines.splice(lines.length - 1, 1, lastLine);
    setLines([...lines]);
  };

  const handleMouseUp = () => {
    if (isDrawing.current) {
      saveHistory(lines, texts, images);
    }
    isDrawing.current = false;
  };

  const handleTextDragEnd = (e: any, id: string) => {
    const updatedTexts = texts.map((t) => {
      if (t.id === id) {
        return {
          ...t,
          x: e.target.x(),
          y: e.target.y(),
        };
      }
      return t;
    });
    setTexts(updatedTexts);
    saveHistory(lines, updatedTexts, images);
  };

  const addTextToCanvasDirectly = (txt: string, isSticker = false) => {
    if (!txt.trim()) return;
    
    // Pick center-ish spot
    const newTexts = [...texts, {
      id: Date.now().toString(),
      text: txt,
      x: Math.max(20, dimensions.width / 2 - 60 + (Math.random() * 40 - 20)),
      y: Math.max(100, dimensions.height / 2 - 20 + (Math.random() * 40 - 20)),
      fontSize: isSticker ? 44 : textSize,
      fontFamily: isSticker ? 'sans-serif' : textFont,
      color: isSticker ? '#000000' : textColor,
      isBold: isSticker ? false : isBold,
      isItalic: isSticker ? false : isItalic,
      isUnderline: isSticker ? false : isUnderline,
    }];
    setTexts(newTexts);
    setSelectedId(newTexts[newTexts.length - 1].id);
    saveHistory(lines, newTexts, images);
  };

  const handleAddCustomText = () => {
    addTextToCanvasDirectly(canvasTextInput, false);
    setCanvasTextInput('');
    setShowTextModal(false);
  };

  const rotateSelectedText = () => {
    if (!selectedId) return;
    // We can update the text properties to rotate or we can do other edits
    // Wait, TextNode doesn't have rotation natively in the interface, but let's check.
    // It's fine to do scaling or deleting
  };

  const scaleSelectedText = (factor: number) => {
    if (!selectedId) return;
    const newTexts = texts.map(txt => {
      if (txt.id === selectedId) {
         return { ...txt, fontSize: Math.max(10, Math.min(100, Math.round(txt.fontSize * factor))) };
      }
      return txt;
    });
    setTexts(newTexts);
    saveHistory(lines, newTexts, images);
  };

  const deleteSelectedText = () => {
    if (!selectedId) return;
    const newTexts = texts.filter(txt => txt.id !== selectedId);
    setTexts(newTexts);
    setSelectedId(null);
    saveHistory(lines, newTexts, images);
  };

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
          const MAX_SIZE = 600;
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
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
            
            const ratio = w / h;
            let dw = 120;
            let dh = 120;
            if (ratio > 1) {
              dh = 120 / ratio;
            } else {
              dw = 120 * ratio;
            }

            const newImages = [...images, {
              id: Date.now().toString(),
              url: compressedBase64,
              x: dimensions.width / 2 - dw / 2,
              y: dimensions.height / 2 - dh / 2,
              width: dw,
              height: dh,
              rotation: Math.random() * 20 - 10
            }];
            setImages(newImages);
            setSelectedId(newImages[newImages.length - 1].id);
            saveHistory(lines, texts, newImages);
          }
        };
        img.src = base64data;
      }
      reader.readAsDataURL(file);
    }
  };

  const rotateSelectedImage = () => {
    if (!selectedId) return;
    const newImages = images.map(img => {
      if (img.id === selectedId) {
         return { ...img, rotation: img.rotation + 15 };
      }
      return img;
    });
    setImages(newImages);
    saveHistory(lines, texts, newImages);
  };

  const scaleSelectedImage = (factor: number) => {
    if (!selectedId) return;
    const newImages = images.map(img => {
      if (img.id === selectedId) {
         return { ...img, width: img.width * factor, height: img.height * factor };
      }
      return img;
    });
    setImages(newImages);
    saveHistory(lines, texts, newImages);
  };

  const deleteSelectedImage = () => {
    if (!selectedId) return;
    const newImages = images.filter(img => img.id !== selectedId);
    setImages(newImages);
    setSelectedId(null);
    saveHistory(lines, texts, newImages);
  };

  const [capturedCanvas, setCapturedCanvas] = useState<{ normal: string, low: string } | null>(null);

  const handleGoToSubmit = () => {
    if (stageRef.current) {
      try {
        const normal = stageRef.current.toDataURL({ pixelRatio: 2.5, mimeType: 'image/jpeg', quality: 0.7 });
        const low = stageRef.current.toDataURL({ pixelRatio: 1.5, mimeType: 'image/jpeg', quality: 0.5 });
        setCapturedCanvas({ normal, low });
      } catch (err) {
        console.warn("Could not capture canvas data: ", err);
      }
    }
    setMobileStep('submit');
  };

  const handleObjectClick = (id: string, type: 'text' | 'line' | 'image') => {
    setSelectedId(id);
  };

  const handleSaveAndComplete = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      let audioBase64 = null;
      if (audioBlob) {
        const reader = new FileReader();
        audioBase64 = await new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(audioBlob);
        });
      }

      let dataURL = capturedCanvas?.normal || null;
      
      const payload = {
        fullName: guestData.fullName,
        nickname: guestData.nickname,
        className: guestData.className,
        schoolName: guestData.schoolName,
        avatarUrl: guestData.avatarUrl || null,
        canvasImage: dataURL,
        audioUrl: audioBase64,
        lines: JSON.stringify(lines),
        texts: JSON.stringify(texts),
        images: JSON.stringify(images),
        longText: longText.trim() === '<p></p>' ? null : longText.trim(),
        longTextMeta: (longText.trim() && longText.trim() !== '<p></p>') ? {
          font: ltFont,
          size: ltSize,
          color: ltColor,
          align: ltAlign,
        } : null,
        createdAt: serverTimestamp(),
      };

      let payloadString = JSON.stringify(payload);
      
      // Attempt downscale if too large
      if (payloadString.length > 1000000 && capturedCanvas?.low) {
        payload.canvasImage = capturedCanvas.low;
        payloadString = JSON.stringify(payload);
      }

      if (payloadString.length > 1045000) {
        alert('Nội dung quá lớn. Hãy thử ghi âm/viết ngắn lại hoặc thu nhỏ ảnh nhé!');
        setIsSaving(false);
        return;
      }

      await addDoc(collection(db, "guestbookEntries"), payload);
      onComplete();
    } catch (error) {
      alert("Lỗi kết nối Firebase. Hãy gửi lại!");
      handleFirestoreError(error, OperationType.CREATE, 'guestbookEntries');
    } finally {
      setIsSaving(false);
    }
  };

  const isSelectedText = selectedId ? texts.some(t => t.id === selectedId) : false;
  const isSelectedImage = selectedId ? images.some(i => i.id === selectedId) : false;

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-brat text-black font-sans overflow-hidden select-none">
      
      {/* Dynamic Header progress tracker */}
      <header className="bg-black text-white px-4 py-3 flex items-center justify-between border-b-2 border-brat shrink-0 z-30">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold uppercase tracking-wider text-brat font-mono">lưu bút của {formattedName || 'bạn'}</span>
        </div>
        
        {/* Step dots */}
        <div className="flex items-center gap-1.5 bg-zinc-950 px-2.5 py-1 rounded-full border border-zinc-800">
          <div className={cn("w-2.5 h-2.5 rounded-full transition-all", mobileStep === 'text' ? 'bg-brat scale-110 shadow-[0_0_8px_#8ace00]' : 'bg-zinc-700')} />
          <div className={cn("w-2.5 h-2.5 rounded-full transition-all", mobileStep === 'decor' ? 'bg-brat scale-110 shadow-[0_0_8px_#8ace00]' : 'bg-zinc-700')} />
          <div className={cn("w-2.5 h-2.5 rounded-full transition-all", mobileStep === 'submit' ? 'bg-brat scale-110 shadow-[0_0_8px_#8ace00]' : 'bg-zinc-700')} />
        </div>
      </header>

      {/* Main work container for mobile */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col relative bg-[#fdfaf3]/35">
        
        {/* STEP 1: WRITE HEARTFELT SENTIMENTS OR VOICE */}
        {mobileStep === 'text' && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 flex flex-col gap-4 max-w-md mx-auto w-full pb-4"
          >
            {/* Advice panel */}
            <div className="bg-[#8ace00]/10 border-l-4 border-brat p-3.5 rounded-r-md">
              <h3 className="font-bold text-sm text-[13px] uppercase tracking-wide">bước 1: viết lại tâm tư mến gửi</h3>
              <p className="text-[12px] leading-relaxed text-zinc-700 mt-1">bạn hãy để lại vài dòng thư tâm sự ở đây mến tặng Phát nhé. Bạn cũng có thể bôi đen chữ để tùy chỉnh phông phông chữ và căn lề!</p>
            </div>

            {/* Paper letter box */}
            <div className="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_0px_#000] flex-1 min-h-[220px] flex flex-col relative transition-all rounded-md">
              <div className="absolute top-2 right-3 text-[10px] uppercase font-mono tracking-widest text-zinc-400">thư tay sổ tay</div>
              <div className="flex-1 mt-4 overflow-y-auto min-h-[160px] max-h-[300px]">
                <EditorContent 
                  editor={editor} 
                  className="prose prose-sm h-full outline-none focus:outline-none placeholder:text-zinc-400 text-sm select-text" 
                  style={{ fontFamily: ltFont, color: ltColor }}
                />
              </div>
              <div className="border-t border-zinc-200 pt-3 mt-2 flex items-center justify-between text-xs text-zinc-500">
                <span>{longText.replace(/<[^>]*>/g, '').length} từ</span>
                <span className="italic text-[10px]">tiptap editor việt hóa</span>
              </div>
            </div>

            {/* Editor formats (touch friendly style widget) */}
            <div className="bg-white border-2 border-black p-3 shadow-[4px_4px_0px_0px_#000] flex flex-col gap-2 rounded-md">
              <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Định dạng chữ</div>
              <div className="grid grid-cols-2 gap-2">
                <select 
                  className="bg-zinc-100 border border-zinc-300 p-2 text-xs text-black outline-none w-full font-bold focus:border-black rounded-none"
                  value={ltFont}
                  onChange={(e) => {
                    setLtFont(e.target.value);
                    editor?.chain().focus().setFontFamily(e.target.value).run();
                  }}
                >
                  {fonts.map(f => (
                    <option key={f.value} value={f.value}>{f.name}</option>
                  ))}
                </select>

                <div className="grid grid-cols-3 gap-1">
                  <button 
                    onClick={() => {
                      setLtAlign('left');
                      editor?.chain().focus().setTextAlign('left').run();
                    }} 
                    className={cn("py-2 flex justify-center items-center border border-zinc-300", ltAlign === 'left' ? "bg-black text-white" : "bg-zinc-100 text-black")}
                  >
                    <AlignLeft className="w-4 h-4"/>
                  </button>
                  <button 
                    onClick={() => {
                      setLtAlign('center');
                      editor?.chain().focus().setTextAlign('center').run();
                    }} 
                    className={cn("py-2 flex justify-center items-center border border-zinc-300", ltAlign === 'center' ? "bg-black text-white" : "bg-zinc-100 text-black")}
                  >
                    <AlignCenter className="w-4 h-4"/>
                  </button>
                  <button 
                    onClick={() => {
                      setLtAlign('right');
                      editor?.chain().focus().setTextAlign('right').run();
                    }} 
                    className={cn("py-2 flex justify-center items-center border border-zinc-300", ltAlign === 'right' ? "bg-black text-white" : "bg-zinc-100 text-black")}
                  >
                    <AlignRight className="w-4 h-4"/>
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={() => editor?.chain().focus().toggleBold().run()} 
                  className={cn("flex-1 py-1.5 flex justify-center items-center border border-zinc-300 rounded font-bold text-xs uppercase", editor?.isActive('bold') ? "bg-black text-white" : "bg-zinc-100")}
                >
                  <Bold className="w-4 h-4 mr-1"/> đậm
                </button>
                <button 
                  onClick={() => editor?.chain().focus().toggleItalic().run()} 
                  className={cn("flex-1 py-1.5 flex justify-center items-center border border-zinc-300 rounded font-bold text-xs uppercase", editor?.isActive('italic') ? "bg-black text-white" : "bg-zinc-100")}
                >
                  <Italic className="w-4 h-4 mr-1"/> nghiêng
                </button>
                <button 
                  onClick={() => editor?.chain().focus().toggleUnderline().run()} 
                  className={cn("flex-1 py-1.5 flex justify-center items-center border border-zinc-300 rounded font-bold text-xs uppercase", editor?.isActive('underline') ? "bg-black text-white" : "bg-zinc-100")}
                >
                  <Underline className="w-4 h-4 mr-1"/> gạch chân
                </button>
              </div>
            </div>

            {/* Voice Recorder Block */}
            <div className="bg-white border-2 border-black p-1 shadow-[4px_4px_0px_0px_#000] rounded-md">
              <VoiceRecorder 
                initialAudioUrl={audioUrl}
                onRecordingComplete={(blob) => {
                  setAudioBlob(blob);
                  if (blob) setAudioUrl(URL.createObjectURL(blob));
                }} 
                onClear={() => {
                  setAudioBlob(null);
                  setAudioUrl(null);
                }} 
              />
            </div>
            
            {/* Guide to proceed */}
            <button 
              onClick={() => setMobileStep('decor')}
              className="mt-4 bg-black text-[#8ace00] py-4 shadow-[4px_4px_0px_0px_#8ace00] hover:bg-black/95 transition-all text-sm font-bold uppercase tracking-widest flex items-center justify-center gap-2 select-none"
            >
              Bước tiếp: vẽ & dán sticker <ArrowRight className="w-5 h-5" />
            </button>
          </motion.div>
        )}

        {/* STEP 2: FULL MOBILE INTERACTIVE ART CANVAS */}
        {mobileStep === 'decor' && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex-1 flex flex-col gap-3 max-w-md mx-auto w-full pb-4 h-full"
          >
            {/* Quick help bar */}
            <div className="flex flex-col gap-2 bg-white/65 p-2 rounded-md border border-zinc-200">
              <div className="flex items-center justify-between text-xs font-bold text-zinc-600">
                <span className="flex items-center gap-1"><Smile className="w-4 h-4 text-emerald-600" /> dán sticker & ký tên</span>
                <button onClick={() => setShowHelp(!showHelp)} className="text-zinc-500 hover:text-black flex items-center gap-1 font-mono hover:underline">
                  <HelpCircle className="w-4 h-4" /> hướng dẫn
                </button>
              </div>
              <AnimatePresence>
                {showHelp && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <p className="text-xs text-zinc-700 bg-zinc-100 p-2 rounded border border-zinc-200 leading-relaxed font-mono mt-1">
                      Bút vẽ/Tẩy nét dùng để viết tay lên hình. Nhấp các nhãn emoji, nét viết hoặc chữ có sẵn để tùy chỉnh kích thước hoặc xóa bằng thanh điều khiển bên dưới.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Canvas Stage Frame */}
            <div className="flex-1 min-h-[400px] bg-white border-2 border-black shadow-[6px_6px_0px_0px_#000] rounded-md overflow-hidden relative" ref={containerRef}>
              <div className="absolute top-2 right-2 bg-black/60 text-white text-[9px] uppercase px-1.5 py-0.5 rounded-full font-mono z-30 pointer-events-none select-none">vết vẽ thực tế</div>
              <Stage
                ref={stageRef}
                width={dimensions.width}
                height={dimensions.height}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onTouchStart={(e) => { e.evt.preventDefault(); handleMouseDown(e); }}
                onTouchMove={(e) => { e.evt.preventDefault(); handleMouseMove(e); }}
                onTouchEnd={handleMouseUp}
                className="z-20 border-b border-zinc-100"
                style={{ cursor: tool === 'pen' ? 'crosshair' : 'default', touchAction: 'none' }}
              >
                <Layer>
                  <CanvasBackground type={background} width={dimensions.width} height={dimensions.height} />
                  
                  {/* Phat's Avatar on drawing stage */}
                  <Polaroid
                    url="https://i.ibb.co/TD9mb1pB/avatar.jpg"
                    name="t. phát"
                    x={28}
                    y={28}
                    rotation={-8}
                    scale={0.4}
                  />

                  {guestData.avatarUrl && (
                    <Polaroid
                      url={guestData.avatarUrl}
                      name={formattedName || 'đằng ấy'}
                      x={85}
                      y={28}
                      rotation={5}
                      scale={0.4}
                    />
                  )}

                  {/* Header Title labels on Canvas metadata */}
                  <KonvaText 
                    x={guestData.avatarUrl ? 150 : 100}
                    y={32}
                    text={`FROM: ${formattedName || 'MỘT NGƯỜI BẠN'}\nTO: CHÁT THUẬN PHÓ`}
                    fontFamily="sans-serif"
                    fontSize={10}
                    fontStyle="bold"
                    fill="#333"
                    lineHeight={1.4}
                  />
                </Layer>
                <Layer>
                  {/* Render handwritten paths */}
                  {lines.map((line) => (
                    <Line
                      key={line.id}
                      points={line.points}
                      stroke={line.isEraser ? "white" : line.color}
                      strokeWidth={line.thickness}
                      tension={0.5}
                      lineCap="round"
                      lineJoin="round"
                      globalCompositeOperation={line.isEraser ? 'destination-out' : 'source-over'}
                    />
                  ))}
                  
                  {/* Texts and Stickers as Text Nodes */}
                  {texts.map((txt) => (
                    <KonvaText
                      key={txt.id}
                      text={txt.text}
                      x={txt.x}
                      y={txt.y}
                      width={Math.max(100, dimensions.width - txt.x - 10)} 
                      fontSize={txt.fontSize}
                      fontFamily={txt.fontFamily}
                      fill={txt.color}
                      fontStyle={`${txt.isItalic ? 'italic ' : ''}${txt.isBold ? 'bold' : 'normal'}`.trim()}
                      textDecoration={txt.isUnderline ? 'underline' : undefined}
                      draggable
                      onDragEnd={(e) => handleTextDragEnd(e, txt.id)}
                      onClick={() => handleObjectClick(txt.id, 'text')}
                      onTap={() => handleObjectClick(txt.id, 'text')}
                    />
                  ))}
                  
                  {/* Photo uploads */}
                  {images.map((img) => (
                    <URLImage 
                      key={img.id}
                      imageInfo={img}
                      isSelected={selectedId === img.id}
                      onSelect={() => handleObjectClick(img.id, 'image')}
                      onChange={(newProps) => {
                        const newImages = images.map(i => i.id === img.id ? newProps : i);
                        setImages(newImages);
                        saveHistory(lines, texts, newImages);
                      }}
                    />
                  ))}
                </Layer>
              </Stage>
            </div>

            {/* FLOATING ACTION BOTTOM DRAWER FOR ACTIONS */}
            <div className="bg-black text-white p-3 rounded-md border-2 border-brat shadow-[4px_4px_0px_0px_#000] flex flex-col gap-2.5 shrink-0">
              
              {/* Tool Mode selector */}
              <div className="grid grid-cols-4 gap-1 p-1 bg-zinc-900 rounded-sm">
                <button 
                  onClick={() => setTool('pen')} 
                  className={cn("py-2 px-1 flex flex-col items-center justify-center text-[10px] font-bold uppercase transition-all rounded", tool === 'pen' ? "bg-brat text-black scale-105" : "text-zinc-400 hover:text-white")}
                >
                  <PenTool className="w-4 h-4 mb-1" /> bút vẽ
                </button>
                <button 
                  onClick={() => setTool('eraser')} 
                  className={cn("py-2 px-1 flex flex-col items-center justify-center text-[10px] font-bold uppercase transition-all rounded", tool === 'eraser' ? "bg-brat text-black scale-105" : "text-zinc-400 hover:text-white")}
                >
                  <Eraser className="w-4 h-4 mb-1" /> tẩy nét
                </button>
                <button 
                  onClick={() => {
                    setTool('text');
                    setShowTextModal(true);
                  }} 
                  className="py-2 px-1 flex flex-col items-center justify-center text-[10px] font-bold uppercase text-zinc-400 hover:text-white rounded"
                >
                  <Type className="w-4 h-4 mb-1" /> viết chữ
                </button>
                <button 
                  onClick={handleUndo} 
                  disabled={historyStep === 0} 
                  className="py-2 px-1 flex flex-col items-center justify-center text-[10px] font-bold uppercase text-zinc-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none rounded"
                >
                  <Undo2 className="w-4 h-4 mb-1" /> hoàn tác
                </button>
              </div>

              {/* Drawing Options detail adjustment parameters inside toolbar */}
              {tool === 'pen' && (
                <div className="bg-zinc-900 p-2 border border-zinc-800 rounded animate-in fade-in duration-200">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] lowercase font-bold text-zinc-400 shrink-0">cọ {penSize}px</span>
                    <input type="range" min="2" max="24" value={penSize} onChange={(e) => setPenSize(Number(e.target.value))} className="flex-1 accent-brat h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer" />
                  </div>
                  
                  {/* Preset brush color selections */}
                  <div className="flex gap-2.5 mt-2.5">
                    {['#000000', '#ef4444', '#3b82f6', '#eab308', '#ffffff', '#8ace00'].map(c => (
                      <button
                        key={c}
                        onClick={() => setPenColor(c)}
                        className={cn("w-7 h-7 rounded-full border-2 cursor-pointer transition-transform", penColor === c ? 'border-white scale-110 shadow-[0_0_6px_#fff]' : 'border-zinc-700')}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                    <label className="w-7 h-7 cursor-pointer border border-zinc-600 rounded-full relative overflow-hidden shrink-0 flex items-center justify-center" style={{ backgroundColor: penColor }}>
                      <input type="color" value={penColor} onChange={(e) => setPenColor(e.target.value)} className="absolute opacity-0 w-full h-full cursor-pointer" />
                      <span className="text-[8px] font-mono mix-blend-difference text-white">#</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Sticker addition block */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] uppercase font-bold text-zinc-400">Chọn Sticker Dán Lên</span>
                <div className="w-full overflow-x-auto py-1 custom-scrollbar scrollbar-thin">
                  <div className="flex gap-3 w-max">
                    {stickersList.map(emoji => (
                      <button 
                        key={emoji}
                        onClick={() => addTextToCanvasDirectly(emoji, true)}
                        className="w-10 h-10 flex items-center justify-center text-2xl hover:scale-125 hover:rotate-12 transition-transform active:scale-95 bg-zinc-900 hover:bg-zinc-800 rounded-full border border-zinc-800"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Vintage tag bubble presets too */}
                <span className="text-[9px] uppercase font-bold text-zinc-500 mt-1">Câu nói chúc mừng ý nghĩa</span>
                <div className="w-full overflow-x-auto pb-1.5 custom-scrollbar">
                  <div className="flex gap-2 w-max">
                    {coolQuotes.map(quote => (
                      <button 
                        key={quote}
                        onClick={() => addTextToCanvasDirectly(quote, false)}
                        className="bg-zinc-900 border border-zinc-800 px-2.5 py-1 text-[10px] text-zinc-300 font-bold lowercase hover:text-brat hover:border-brat rounded-md"
                      >
                        + {quote}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Upload image overlay layer */}
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center justify-center gap-1.5 text-[10px] uppercase font-bold text-zinc-400 bg-zinc-900 border border-dashed border-zinc-700 py-2.5 rounded-md hover:text-white cursor-pointer transition-colors">
                  <span className="text-sm">+</span> Đăng ảnh kỷ niệm
                  <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                </label>
                
                <div className="bg-zinc-900 px-2 p-1 border border-zinc-800 flex justify-center items-center">
                  <select 
                    className="w-full bg-transparent text-[10px] uppercase tracking-wide border-none text-zinc-300 font-bold outline-none"
                    value={background}
                    onChange={(e) => setBackground(e.target.value as LayoutBackground)}
                  >
                    <option value="dotted">giấy chấm bi</option>
                    <option value="line">giấy kẻ ngang</option>
                    <option value="blank">màu trơn hít</option>
                  </select>
                </div>
              </div>

              {/* LARGE TOUCH-FRIENDLY CONTROLS FOR SELECTED OBJECT */}
              {selectedId && (
                <div className="bg-[#8ace00]/10 border border-brat/30 p-2 rounded-sm flex items-center justify-between text-xs animate-in slide-in-from-bottom-2 duration-200">
                  <span className="font-mono text-[10px] text-zinc-400 lowercase">đang chọn: {isSelectedText ? 'nhãn chữ / sticker' : 'ảnh đăng'}</span>
                  
                  <div className="flex gap-1.5">
                    {/* Zoom actions */}
                    {isSelectedText && (
                      <>
                        <button onClick={() => scaleSelectedText(1.15)} className="bg-zinc-900 hover:bg-zinc-800 text-white w-8 h-8 rounded flex items-center justify-center"><ZoomIn className="w-4 h-4" /></button>
                        <button onClick={() => scaleSelectedText(0.85)} className="bg-zinc-900 hover:bg-zinc-800 text-white w-8 h-8 rounded flex items-center justify-center"><ZoomOut className="w-4 h-4" /></button>
                        <button onClick={deleteSelectedText} className="bg-red-950 text-red-500 hover:text-white hover:bg-red-800 w-8 h-8 rounded flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>
                      </>
                    )}

                    {isSelectedImage && (
                      <>
                        <button onClick={() => scaleSelectedImage(1.15)} className="bg-zinc-900 hover:bg-zinc-800 text-white w-8 h-8 rounded flex items-center justify-center"><ZoomIn className="w-4 h-4" /></button>
                        <button onClick={() => scaleSelectedImage(0.85)} className="bg-zinc-900 hover:bg-zinc-800 text-white w-8 h-8 rounded flex items-center justify-center"><ZoomOut className="w-4 h-4" /></button>
                        <button onClick={rotateSelectedImage} className="bg-zinc-900 hover:bg-zinc-800 text-white w-8 h-8 rounded flex items-center justify-center"><RotateCw className="w-4 h-4" /></button>
                        <button onClick={deleteSelectedImage} className="bg-red-950 text-red-500 hover:text-white hover:bg-red-800 w-8 h-8 rounded flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>
                      </>
                    )}
                  </div>
                </div>
              )}

            </div>

            {/* Stepper buttons */}
            <div className="flex gap-3">
              <button 
                onClick={() => setMobileStep('text')}
                className="flex items-center justify-center gap-2 bg-zinc-200 hover:bg-zinc-300 py-3 px-4 font-bold text-sm uppercase rounded shadow"
              >
                <ArrowLeft className="w-4 h-4" /> Quay lại
              </button>
              <button 
                onClick={handleGoToSubmit}
                className="flex-1 bg-black text-[#8ace00] py-4 font-black uppercase text-sm tracking-widest flex items-center justify-center gap-2 rounded shadow-lg"
              >
                Bước cuối: Duyệt & gửi <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* STEP 3: PREVIEW & FINAL SEND BUTTON */}
        {mobileStep === 'submit' && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 flex flex-col gap-5 max-w-sm mx-auto w-full pb-4 items-center justify-center text-center"
          >
            <div className="relative">
              <motion.div 
                animate={{ scale: [1, 1.05, 1], rotate: [0, 2, -2, 0] }}
                transition={{ duration: 4, repeat: Infinity }}
                className="bg-yellow-300 w-20 h-20 rounded-full flex items-center justify-center border-4 border-black shadow-[4px_4px_0px_0px_#000] rotate-6 mb-2"
              >
                <Check className="w-10 h-10 text-black stroke-[3]" />
              </motion.div>
            </div>

            <h2 className="text-2xl font-black lowercase tracking-tight text-center">
              sẵn sàng gửi gắm thế giới!
            </h2>
            
            <p className="text-sm text-zinc-700 leading-relaxed max-w-xs">
              Mọi thứ đã được trang trí tươm tất. Nhấn nốt vào nút dưới nữa là Phát sẽ nhận được ngay cuốn lưu bút thanh xuân chan chứa kỉ niệm này đó! 
              <br/><br/>
              (Cám ơn Phát vì đã luôn là một người bạn tuyệt vời)
            </p>

            {/* Structured recap metrics list */}
            <div className="bg-white border-2 border-black p-4 w-full text-left shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-md flex flex-col gap-2.5">
              <div className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 border-b pb-1">bản tóm tắt lưu bút</div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-600">Họ và tên của bạn:</span>
                <span className="font-bold lowercase">{formattedName || 'một người bạn'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-600">Nét viết / Nhãn đã dán:</span>
                <span className="font-bold font-mono">{lines.length} nét, {texts.length} nhãn</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-600">Lời chúc đi kèm:</span>
                <span className="font-bold font-mono">{longText.replace(/<[^>]*>/g, '').trim() ? `${longText.replace(/<[^>]*>/g, '').trim().slice(0, 20)}...` : 'không có thư tay'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-600">Lời nhắn nói:</span>
                <span className="font-bold text-emerald-600">{audioBlob ? 'Đã thu âm xong ✓' : 'Không có ghi âm'}</span>
              </div>
            </div>

            <div className="flex flex-col gap-3 w-full self-stretch mt-3">
              <button 
                onClick={handleSaveAndComplete} 
                disabled={isSaving}
                className="w-full bg-black text-brat py-4 rounded font-black text-xl hover:bg-neutral-900 shadow-[6px_6px_0px_0px_#8ace00] disabled:opacity-50 transition-all flex items-center justify-center gap-2 lowercase cursor-pointer"
              >
                {isSaving ? "đang gửi..." : "gửi lưu bút ngay!"}
              </button>

              <button 
                onClick={() => setMobileStep('decor')}
                disabled={isSaving}
                className="w-full bg-white text-black border-2 border-black rounded py-3 font-bold hover:bg-neutral-100 transition-colors lowercase"
              >
                quay lại vẽ thêm sticker
              </button>
            </div>
            
          </motion.div>
        )}

      </div>

      {/* TEXT ADD OVERLAY MODAL FOR STEP 2 WRITING ON CANVAS */}
      <AnimatePresence>
        {showTextModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-white border-4 border-black p-5 shadow-[8px_8px_0px_0px_#000] w-full max-w-xs inline-flex flex-col gap-3 rounded-md"
            >
              <h3 className="text-base font-bold uppercase tracking-wider">Viết chữ lên canvas</h3>
              
              <textarea
                value={canvasTextInput}
                onChange={(e) => setCanvasTextInput(e.target.value)}
                placeholder="Ví dụ: Bạn Phát dễ thương..."
                className="bg-zinc-100 border-2 border-zinc-200 outline-none p-2 text-sm w-full h-24 focus:border-black rounded-none resize-none"
              />

              {/* Text node style parameters */}
              <div className="flex gap-2">
                <select 
                  className="bg-zinc-100 border border-zinc-300 p-1.5 text-[10px] text-black outline-none w-1/2 rounded font-bold"
                  value={textFont}
                  onChange={(e) => setTextFont(e.target.value)}
                >
                  {fonts.map(f => (
                    <option key={f.value} value={f.value}>{f.name}</option>
                  ))}
                </select>
                <div className="flex-1 flex items-center border border-zinc-300 bg-zinc-100 rounded justify-center p-1 cursor-pointer relative" style={{ backgroundColor: textColor }}>
                  <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="absolute opacity-0 w-full h-full cursor-pointer" />
                  <span className="text-[9px] uppercase font-mono mix-blend-difference text-white">{textColor}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-2">
                <button 
                  onClick={() => setShowTextModal(false)}
                  className="bg-zinc-200 hover:bg-zinc-300 font-bold text-xs uppercase py-3 transition-colors"
                >
                  Hủy bỏ
                </button>
                <button 
                  onClick={handleAddCustomText}
                  disabled={!canvasTextInput.trim()}
                  className="bg-black text-[#8ace00] disabled:opacity-40 font-bold text-xs uppercase py-3 transition-colors"
                >
                  Dán chữ lên
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
