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
  MousePointer2, Trash2, RotateCw, Bold, Italic, 
  Underline, ZoomIn, ZoomOut, ChevronDown, ChevronRight, 
  AlignLeft, AlignCenter, AlignRight, FileText, Palette,
  Baseline, Mic
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

// Available fonts (Fully supporting Vietnamese)
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

interface GuestbookEditorProps {
  guestData: GuestData;
  onComplete: () => void;
}

export default function GuestbookEditor({ guestData, onComplete }: GuestbookEditorProps) {
  const [lang, setLang] = useState<'vi' | 'en'>('vi');
  const [activeTab, setActiveTab] = useState<'canvas' | 'longtext'>('canvas');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isRecordingOpen, setIsRecordingOpen] = useState(false);
  const [tool, setTool] = useState<Tool>('pen');
  const [background, setBackground] = useState<LayoutBackground>('blank');
  const [isSaving, setIsSaving] = useState(false);
  const stageRef = useRef<any>(null);
  
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  // Pen state
  const [penColor, setPenColor] = useState('#000000');
  const [penSize, setPenSize] = useState(3);
  
  // Text state
  const [textInput, setTextInput] = useState('');
  const [textColor, setTextColor] = useState('#000000');
  const [textSize, setTextSize] = useState(24);
  const [textFont, setTextFont] = useState(fonts[0].value);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  
  // Canvas data
  const [lines, setLines] = useState<LineNode[]>([]);
  const [texts, setTexts] = useState<TextNode[]>([]);
  const [images, setImages] = useState<ImageNode[]>([]);
  
  // Long text state
  const [longText, setLongText] = useState('');
  const [ltFont, setLtFont] = useState(fonts[1].value); // Default to Be Vietnam Pro
  const [ltSize, setLtSize] = useState(18);
  const [ltColor, setLtColor] = useState('#000000');
  const [ltAlign, setLtAlign] = useState<'left' | 'center' | 'right'>('center');

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
        placeholder: 'Nếu canvas quá chật chội để viết hết tâm tư, hãy viết ở đây nhé...',
      }),
    ],
    content: '',
    onUpdate: ({ editor }) => {
      setLongText(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && activeTab === 'longtext' && editor.isEmpty && longText.length > 0) {
       // Sync once if needed, though tiptap handles its own state
    }
  }, [activeTab, editor]);
  
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

  const handleRedo = () => {
    if (historyStep === history.length - 1) return;
    const next = historyStep + 1;
    const state = history[next];
    setLines(state.lines);
    setTexts(state.texts);
    setImages(state.images);
    setHistoryStep(next);
    setSelectedId(null);
  };

  const isDrawing = useRef(false);
  
  // Responsive stage sizing
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };
    window.addEventListener('resize', updateSize);
    updateSize();
    const timeoutId = setTimeout(updateSize, 100);
    return () => {
      window.removeEventListener('resize', updateSize);
      clearTimeout(timeoutId);
    };
  }, []);

  const handleMouseDown = (e: any) => {
    // Deselect if clicking on empty stage
    if (e.target === e.target.getStage()) {
      setSelectedId(null);
    }

    // Do not draw or fill if clicking on a draggable object (Text, Image, Polaroid)
    // We check this by seeing if the target is NOT the stage and NOT the background.
    // 'background' or lines aren't draggable, but we probably shouldn't draw when clicking a transformer etc.
    const isStageOrBg = e.target === e.target.getStage() || e.target.name() === 'background-rect';
    if (!isStageOrBg && tool !== 'pen' && tool !== 'eraser') {
      return;
    }

    if (e.target !== e.target.getStage() && e.target.name() !== 'background-rect' && !e.target.attrs?.points) {
       // Allow drawing over lines (attrs.points), but not text or images
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
    
    // add point
    lastLine.points = lastLine.points.concat([point.x, point.y]);
    
    // replace last
    lines.splice(lines.length - 1, 1, lastLine);
    setLines([...lines]);
  };

  const handleMouseUp = () => {
    if (isDrawing.current) {
      saveHistory(lines, texts, images);
    }
    isDrawing.current = false;
  };
  
  const addTextToCanvas = () => {
    if (!textInput.trim()) return;
    
    const newTexts = [...texts, {
      id: Date.now().toString(),
      text: textInput,
      x: Math.max(50, (dimensions.width / 2) - 50),
      y: Math.max(50, (dimensions.height / 2) - 50),
      fontSize: textSize,
      fontFamily: textFont,
      color: textColor,
      isBold,
      isItalic,
      isUnderline,
    }];
    setTexts(newTexts);
    saveHistory(lines, newTexts, images);
    
    setTextInput('');
    setTool('select');
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
          // Downsample if too large
          const MAX_SIZE = 1200;
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
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8); // 80% quality jpeg
            
            // Scaled down dimensions for display
            const ratio = w / h;
            let dw = 200;
            let dh = 200;
            if (ratio > 1) {
              dh = 200 / ratio;
            } else {
              dw = 200 * ratio;
            }

            const newImages = [...images, {
              id: Date.now().toString(),
              url: compressedBase64,
              x: dimensions.width / 2 - dw / 2,
              y: dimensions.height / 2 - dh / 2,
              width: dw,
              height: dh,
              rotation: 0
            }];
            setImages(newImages);
            saveHistory(lines, texts, newImages);
            setTool('select');
            setSelectedId(newImages[newImages.length-1].id);
          }
        };
        img.src = base64data;
      }
      reader.readAsDataURL(file);
    }
  };

  const handleObjectClick = (e: any, id: string, type: 'text' | 'line' | 'image') => {
    if (tool === 'eraser-object') {
      if (type === 'text') {
        const newTexts = texts.filter(t => t.id !== id);
        setTexts(newTexts);
        saveHistory(lines, newTexts, images);
      } else if (type === 'line') {
        const newLines = lines.filter(l => l.id !== id);
        setLines(newLines);
        saveHistory(newLines, texts, images);
      } else if (type === 'image') {
         // Optionally prevent erasing image with eraser-object, based on instructions: "với ảnh thì không tính"
      }
      return;
    }
    
    if (tool === 'select' || tool === 'text') {
      setSelectedId(id);
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
  
  const handleSaveAndComplete = async () => {
     if (isSaving) return;
     
     // Force switch to canvas tab if not already there so we can capture it
     if (activeTab !== 'canvas') {
       setActiveTab('canvas');
       setTimeout(handleSaveAndComplete, 300);
       return;
     }

     setIsSaving(true);
     try {
       // Convert audio blob to base64 if it exists
       let audioBase64 = null;
       if (audioBlob) {
         const reader = new FileReader();
         audioBase64 = await new Promise<string>((resolve) => {
           reader.onloadend = () => resolve(reader.result as string);
           reader.readAsDataURL(audioBlob);
         });
       }
       // Convert canvas to image for high-quality representation in gallery
       let dataURL = null;
       if (stageRef.current) {
         // pixelRatio 3 provides high resolution (300 DPI equivalent for typical screens)
         // We use JPEG with 0.8 quality to balance sharpness and Firestore size limits
         dataURL = stageRef.current.toDataURL({ 
           pixelRatio: 3, 
           mimeType: 'image/jpeg', 
           quality: 0.8 
         });
       }
       
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
       
       // Fallback logic 1: If > 1MB, try 2.5x with 0.7 quality
       if (payloadString.length > 1000000 && stageRef.current) {
         const midQualityDataURL = stageRef.current.toDataURL({ 
           pixelRatio: 2.5, 
           mimeType: 'image/jpeg', 
           quality: 0.7 
         });
         payload.canvasImage = midQualityDataURL;
         payloadString = JSON.stringify(payload);
       }

       // Fallback logic 2: If still > 1MB, try 2.0x with 0.6 quality
       if (payloadString.length > 1000000 && stageRef.current) {
         const lowQualityDataURL = stageRef.current.toDataURL({ 
           pixelRatio: 2, 
           mimeType: 'image/jpeg', 
           quality: 0.6 
         });
         payload.canvasImage = lowQualityDataURL;
         payloadString = JSON.stringify(payload);
       }

       if (payloadString.length > 1045000) { // Hard boundary for Firestore (1MB)
         alert('Dữ liệu quá lớn (có thể do ghi âm quá dài hoặc quá nhiều ảnh). Hãy thử ghi âm ngắn lại hoặc xóa bớt ảnh!');
         setIsSaving(false);
         return;
       }

       await addDoc(collection(db, "guestbookEntries"), payload);
       onComplete();
     } catch (error) {
       alert("Có lỗi xảy ra khi lưu. Vui lòng thử lại!");
       handleFirestoreError(error, OperationType.CREATE, 'guestbookEntries');
     } finally {
       setIsSaving(false);
     }
  };

  const formattedName = formatName(guestData.fullName);
  const formattedClass = formatClass(guestData.className);
  const formattedSchool = formatSchool(guestData.schoolName);

  const T = {
    vi: { 
      undo: 'Hoàn tác', redo: 'Làm lại', pen: 'Bút', eraser: 'Tẩy', block: 'Khối', text: 'Chữ', 
      paper: 'giấy', dot: 'chấm', line: 'kẻ', no: 'trống', image: '+ Ảnh', add: 'Thêm',
      send: 'gửi lưu bút', sending: 'Đang gửi...', clickObj: 'Bấm một chữ/nét/ảnh để xóa',
      eraserTool: 'Cục tẩy điểm', rotate: 'Nghiêng', delete: 'Xóa' 
    },
    en: { 
      undo: 'Undo', redo: 'Redo', pen: 'Pen', eraser: 'Eraser', block: 'Block', text: 'Text',
      paper: 'paper', dot: 'dot', line: 'line', no: 'none', image: '+ Image', add: 'Add',
      send: 'send guestbook', sending: 'Sending...', clickObj: 'Click Object To Delete',
      eraserTool: 'Eraser Tool', rotate: 'Rotate', delete: 'Delete' 
    }
  };
  const t = T[lang];

  const toolbarBtnClass = "h-12 md:h-10 flex flex-col md:flex-row items-center justify-center text-[8px] md:text-[10px] uppercase font-bold gap-1 transition-colors";
  const iconClass = "w-4 h-4 shrink-0";

  const renderCanvasSidebar = () => (
    <div className="flex flex-col gap-2 md:gap-4">
      {/* Undo / Redo */}
      <div className="flex gap-1 md:gap-2">
          <button onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')} className="px-1.5 md:px-3 h-8 md:h-10 py-1 text-[9px] md:text-[10px] uppercase font-bold border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 shrink-0">
             {lang === 'vi' ? 'EN / VI' : 'VI / EN'}
          </button>
          <button onClick={handleUndo} disabled={historyStep === 0} className="flex-1 h-8 md:h-10 py-1 flex items-center justify-center gap-1 text-[9px] md:text-[10px] uppercase font-bold border border-zinc-700 disabled:opacity-50 hover:bg-zinc-800">
            <Undo2 className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" /> <span className="hidden md:inline">{t.undo}</span>
          </button>
          <button onClick={handleRedo} disabled={historyStep === history.length - 1} className="flex-1 h-8 md:h-10 py-1 flex items-center justify-center gap-1 text-[9px] md:text-[10px] uppercase font-bold border border-zinc-700 disabled:opacity-50 hover:bg-zinc-800">
            <Redo2 className="w-3.5 h-3.5 md:w-4 md:h-4 shrink-0" /> <span className="hidden md:inline">{t.redo}</span>
          </button>
      </div>

      {/* Tool Mode selector */}
      <div className="grid grid-cols-4 gap-1 bg-zinc-800 p-0.5 md:p-1 mb-0.5 md:mb-1">
        <button onClick={() => setTool('pen')} title={t.pen} className={cn(toolbarBtnClass, tool === 'pen' ? "bg-white text-black" : "text-gray-400 hover:text-white", "h-10 md:h-10")}>
           <PenTool className={iconClass} /> <span className="md:inline">{t.pen}</span>
        </button>
        <button onClick={() => setTool('eraser')} title={t.eraser} className={cn(toolbarBtnClass, tool === 'eraser' ? "bg-white text-black" : "text-gray-400 hover:text-white", "h-10 md:h-10")}>
           <Eraser className={iconClass} /> <span className="md:inline">{t.eraser}</span>
        </button>
         <button onClick={() => setTool('eraser-object')} title={t.block} className={cn(toolbarBtnClass, tool === 'eraser-object' ? "bg-white text-black" : "text-gray-400 hover:text-white", "h-10 md:h-10")}>
           <Pointer className={iconClass} /> <span className="md:inline">{t.block}</span>
        </button>
        <button onClick={() => setTool('text')} title={t.text} className={cn(toolbarBtnClass, tool === 'text' || tool === 'select' ? "bg-white text-black" : "text-gray-400 hover:text-white", "h-10 md:h-10")}>
           <Type className={iconClass} /> <span className="md:inline">{t.text}</span>
        </button>
      </div>

      {/* Image Actions */}
      {(tool === 'select' || tool === 'text') && selectedId && images.find(i => i.id === selectedId) && (
        <div className="flex gap-1 p-1 bg-zinc-900 border border-zinc-700 animate-in fade-in slide-in-from-top-1">
           <button onClick={() => scaleSelectedImage(1.1)} className="flex-1 h-10 flex justify-center items-center text-[10px] font-bold bg-zinc-800 hover:bg-zinc-700" title="Zoom In"><ZoomIn className="w-4 h-4" /></button>
           <button onClick={() => scaleSelectedImage(0.9)} className="flex-1 h-10 flex justify-center items-center text-[10px] font-bold bg-zinc-800 hover:bg-zinc-700" title="Zoom Out"><ZoomOut className="w-4 h-4" /></button>
           <button onClick={rotateSelectedImage} className="flex-1 h-10 flex justify-center items-center gap-1 text-[8px] md:text-[9px] uppercase font-bold bg-zinc-800 hover:bg-zinc-700">
               <RotateCw className="w-4 h-4 shrink-0" /> <span className="hidden md:inline">{t.rotate}</span>
           </button>
           <button onClick={deleteSelectedImage} className="flex-2 h-10 flex justify-center items-center gap-1 text-[8px] md:text-[9px] uppercase font-bold bg-red-900 hover:bg-red-800 px-2">
               <Trash2 className="w-4 h-4 shrink-0" /> <span className="hidden md:inline">{t.delete}</span>
           </button>
        </div>
      )}

      <div className="flex flex-col gap-2 md:gap-4">
        {/* Paper Section */}
        <div className="hidden md:block">
          <label className="text-[10px] uppercase tracking-widest text-gray-400 mb-2 block">{t.paper}</label>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => setBackground('dotted')} className={cn("h-8 text-xs font-bold border", background === 'dotted' ? 'bg-white text-black border-white' : 'border-white text-white hover:bg-white hover:text-black')}>{t.dot}</button>
            <button onClick={() => setBackground('line')} className={cn("h-8 text-xs font-bold border", background === 'line' ? 'bg-white text-black border-white' : 'border-white text-white hover:bg-white hover:text-black')}>{t.line}</button>
            <button onClick={() => setBackground('blank')} className={cn("h-8 text-xs font-bold border", background === 'blank' ? 'bg-white text-black border-white' : 'border-white text-white hover:bg-white hover:text-black')}>{t.no}</button>
          </div>
        </div>
        
        {/* Upload Image Layer */}
        <div className="flex-shrink-0 mt-0.5 md:mt-0">
             <label className="w-full flex justify-center items-center border-[1px] border-dashed border-zinc-600 py-1.5 md:py-3 text-[9px] md:text-[10px] uppercase font-bold text-zinc-400 hover:text-white hover:border-zinc-400 cursor-pointer transition-colors">
               {t.image}
               <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
             </label>
        </div>

        {/* Paper Toggle for Mobile (since sidebar hides most) */}
        <div className="md:hidden grid grid-cols-3 gap-1 bg-zinc-800 p-0.5 mt-0.5">
            <button onClick={() => setBackground('dotted')} className={cn("h-7 text-[9px] font-bold border", background === 'dotted' ? 'bg-white text-black border-white' : 'border-zinc-700 text-zinc-400')}>{t.dot}</button>
            <button onClick={() => setBackground('line')} className={cn("h-7 text-[9px] font-bold border", background === 'line' ? 'bg-white text-black border-white' : 'border-zinc-700 text-zinc-400')}>{t.line}</button>
            <button onClick={() => setBackground('blank')} className={cn("h-7 text-[9px] font-bold border", background === 'blank' ? 'bg-white text-black border-white' : 'border-zinc-700 text-zinc-400')}>{t.no}</button>
        </div>

        {/* Text Section */}
        {(tool === 'text' || tool === 'select') && (
          <div>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <select 
                  className="bg-zinc-800 border border-zinc-700 p-2 text-[10px] md:text-xs text-white outline-none w-1/2"
                  value={textFont}
                  onChange={(e) => setTextFont(e.target.value)}
                >
                  {fonts.map(f => (
                    <option key={f.value} value={f.value}>{f.name}</option>
                  ))}
                </select>
                <input type="number" min="10" max="120" value={textSize} onChange={(e) => setTextSize(Number(e.target.value))} className="w-1/4 bg-zinc-800 border border-zinc-700 p-2 text-[10px] outline-none text-white text-center" />
                
                <div className="w-1/4 flex items-center border border-zinc-700 bg-zinc-800 justify-center">
                  <label className="h-full w-full cursor-pointer relative flex justify-center items-center" style={{ backgroundColor: textColor }}>
                    <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="absolute opacity-0 w-full h-full cursor-pointer" />
                    <span className="text-[9px] uppercase font-mono mix-blend-difference text-white">{textColor.replace('#', '')}</span>
                  </label>
                </div>
              </div>
              
              <div className="flex gap-1 mb-1">
                <button onClick={() => setIsBold(!isBold)} className={cn("flex-1 py-1 flex justify-center items-center border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 transition-colors", isBold && "bg-white text-black hover:bg-white")} title="Bold"><Bold className="w-3.5 h-3.5"/></button>
                <button onClick={() => setIsItalic(!isItalic)} className={cn("flex-1 py-1 flex justify-center items-center border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 transition-colors", isItalic && "bg-white text-black hover:bg-white")} title="Italic"><Italic className="w-3.5 h-3.5"/></button>
                <button onClick={() => setIsUnderline(!isUnderline)} className={cn("flex-1 py-1 flex justify-center items-center border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 transition-colors", isUnderline && "bg-white text-black hover:bg-white")} title="Underline"><Underline className="w-3.5 h-3.5"/></button>
              </div>

              <div className="flex gap-2 h-10 md:h-14">
                <textarea 
                  className="flex-1 bg-zinc-800 border border-zinc-700 p-1 md:p-2 text-[10px] md:text-xs resize-none text-white outline-none"
                  placeholder="Abc..."
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                />
                <button disabled={!textInput.trim()} onClick={addTextToCanvas} className="px-3 md:px-4 bg-zinc-700 hover:bg-zinc-600 text-white text-[9px] md:text-[10px] uppercase font-bold disabled:opacity-50 transition-colors">
                  {t.add}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Drawing Section */}
        {(tool === 'pen' || tool === 'eraser') && (
          <div className="animate-in fade-in slide-in-from-bottom-1">
             <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <input type="range" min="1" max="50" value={penSize} onChange={(e) => setPenSize(Number(e.target.value))} className="flex-1 accent-white h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer" />
                <span className="text-[10px] font-mono w-6 text-right shrink-0">{penSize}</span>
              </div>
              {tool !== 'eraser' && (
                <div className="flex h-8 gap-1">
                  {['#ef4444', '#3b82f6', '#eab308', '#ffffff', '#000000'].map(c => (
                    <button
                      key={c}
                      onClick={() => setPenColor(c)}
                      className={cn("flex-1 border cursor-pointer", c === '#000000' ? 'border-zinc-500' : 'border-transparent', penColor === c ? 'border-2 border-white' : '')}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                   <label className="flex-1 cursor-pointer border border-zinc-700 relative flex justify-center items-center" style={{ backgroundColor: penColor }}>
                     <input type="color" value={penColor} onChange={(e) => setPenColor(e.target.value)} className="absolute opacity-0 w-full h-full cursor-pointer" />
                     <span className="text-[8px] uppercase font-mono mix-blend-difference text-white">{penColor.replace('#', '')}</span>
                   </label>
                </div>
              )}
               {tool === 'eraser' && (
                  <div className="text-[10px] text-zinc-400 uppercase tracking-widest text-center border border-zinc-700 py-1">{t.eraserTool}</div>
               )}
            </div>
          </div>
        )}

        {tool === 'eraser-object' && (
           <div className="p-2 bg-zinc-900 border border-zinc-800 text-center animate-in zoom-in-95">
               <span className="text-[9px] text-zinc-400 uppercase tracking-widest leading-relaxed block">{t.clickObj}</span>
           </div>
        )}
      </div>
    </div>
  );

  const renderLongTextSidebar = () => {
    if (!editor) return null;

    return (
      <div className="flex flex-col gap-2 md:gap-4 animate-in fade-in slide-in-from-left-2 overflow-y-auto custom-scrollbar">
        <label className="text-[9px] md:text-[10px] uppercase tracking-widest text-gray-400 block mb-0.5 md:mb-1">Định dạng tâm thư</label>
        
        <div className="flex flex-col gap-2 md:gap-3 bg-zinc-800 p-2 md:p-3 rounded-sm border border-zinc-700">
          <select 
            className="w-full bg-zinc-900 border border-zinc-700 p-1.5 md:p-2 text-[10px] md:text-xs text-white outline-none"
            value={ltFont}
            onChange={(e) => {
              setLtFont(e.target.value);
              editor.chain().focus().setFontFamily(e.target.value).run();
            }}
          >
            {fonts.map(f => (
              <option key={f.value} value={f.value}>{f.name}</option>
            ))}
          </select>

          <div className="flex gap-1 md:gap-2">
            <input type="number" min="12" max="60" value={ltSize} onChange={(e) => setLtSize(Number(e.target.value))} className="w-1/3 bg-zinc-900 border border-zinc-700 p-1.5 md:p-2 text-[10px] md:text-xs outline-none text-white text-center" />
            <div className="flex-1 flex items-center border border-zinc-700 bg-zinc-900 justify-center">
              <label className="h-full w-full cursor-pointer relative flex justify-center items-center" style={{ backgroundColor: ltColor }}>
                <input type="color" value={ltColor} onChange={(e) => setLtColor(e.target.value)} className="absolute opacity-0 w-full h-full cursor-pointer" />
                <span className="text-[9px] md:text-[10px] uppercase font-mono mix-blend-difference text-white">{ltColor}</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1">
            <button 
              onClick={() => {
                setLtAlign('left');
                editor.chain().focus().setTextAlign('left').run();
              }} 
              className={cn("py-1 md:py-2 flex justify-center items-center border border-zinc-700", ltAlign === 'left' ? "bg-white text-black" : "bg-zinc-900 text-white")}
            >
              <AlignLeft className="w-3.5 h-3.5 md:w-4 md:h-4"/>
            </button>
            <button 
              onClick={() => {
                setLtAlign('center');
                editor.chain().focus().setTextAlign('center').run();
              }} 
              className={cn("py-1 md:py-2 flex justify-center items-center border border-zinc-700", ltAlign === 'center' ? "bg-white text-black" : "bg-zinc-900 text-white")}
            >
              <AlignCenter className="w-3.5 h-3.5 md:w-4 md:h-4"/>
            </button>
            <button 
              onClick={() => {
                setLtAlign('right');
                editor.chain().focus().setTextAlign('right').run();
              }} 
              className={cn("py-1 md:py-2 flex justify-center items-center border border-zinc-700", ltAlign === 'right' ? "bg-white text-black" : "bg-zinc-900 text-white")}
            >
              <AlignRight className="w-3.5 h-3.5 md:w-4 md:h-4"/>
            </button>
          </div>

          <div className="flex gap-1 md:gap-2">
            <button 
              onClick={() => editor.chain().focus().toggleBold().run()} 
              className={cn("flex-1 py-1 md:py-2 border border-zinc-700 text-xs", editor.isActive('bold') ? "bg-white text-black" : "bg-zinc-900 text-white")}
            >
              <Bold className="w-3.5 h-3.5 md:w-4 md:h-4 mx-auto"/>
            </button>
            <button 
              onClick={() => editor.chain().focus().toggleItalic().run()} 
              className={cn("flex-1 py-1 md:py-2 border border-zinc-700 text-xs", editor.isActive('italic') ? "bg-white text-black" : "bg-zinc-900 text-white")}
            >
              <Italic className="w-3.5 h-3.5 md:w-4 md:h-4 mx-auto"/>
            </button>
            <button 
              onClick={() => editor.chain().focus().toggleUnderline().run()} 
              className={cn("flex-1 py-1 md:py-2 border border-zinc-700 text-xs", editor.isActive('underline') ? "bg-white text-black" : "bg-zinc-900 text-white")}
            >
              <Underline className="w-3.5 h-3.5 md:w-4 md:h-4 mx-auto"/>
            </button>
          </div>

          <div className="flex gap-1 md:mt-1">
            <button onClick={() => editor.chain().focus().undo().run()} className="flex-1 py-1 bg-zinc-900 border border-zinc-700 text-white hover:bg-white hover:text-black transition-colors"><Undo2 className="w-3.5 h-3.5 mx-auto"/></button>
            <button onClick={() => editor.chain().focus().redo().run()} className="flex-1 py-1 bg-zinc-900 border border-zinc-700 text-white hover:bg-white hover:text-black transition-colors"><Redo2 className="w-3.5 h-3.5 mx-auto"/></button>
            <button onClick={() => { if(confirm('Xóa hết nội dung tâm thư?')) editor.chain().focus().clearContent().run() }} className="flex-1 py-1 bg-zinc-900 border border-zinc-700 text-red-500 hover:bg-red-500 hover:text-white transition-colors"><Trash2 className="w-3.5 h-3.5 mx-auto"/></button>
          </div>
        </div>

        <div className="mt-1 md:mt-4 p-2 md:p-3 bg-zinc-900/50 border border-dashed border-zinc-700 rounded-md">
          <p className="text-[9px] md:text-[10px] text-zinc-400 italic leading-snug">
            Mẹo: Bôi đen văn bản để thay đổi định dạng từng phần. Hỗ trợ Ctrl+B, Ctrl+I, Ctrl+U.
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] w-full bg-brat text-black font-sans overflow-hidden select-none">
      
      {/* Sidebar Tools - Responsive */}
      <aside className="w-full md:w-64 bg-black text-white p-2 md:p-4 flex flex-col gap-2 md:gap-4 overflow-y-auto shrink-0 z-30 order-1 md:order-1 max-h-[35vh] md:max-h-full md:h-full custom-scrollbar">
        
        {/* Tab Switcher for Mobile/Desktop Sidebar context */}
        <div className="flex border-b border-zinc-800 mb-1 md:mb-2">
          <button 
            onClick={() => setActiveTab('canvas')} 
            className={cn("flex-1 py-2 md:py-3 text-[10px] md:text-[11px] uppercase italic font-bold flex items-center justify-center gap-2 transition-all", activeTab === 'canvas' ? "text-brat border-b-2 border-brat" : "text-zinc-500")}
          >
            canvas
          </button>
          <button 
            onClick={() => setActiveTab('longtext')} 
            className={cn("flex-1 py-2 md:py-3 text-[10px] md:text-[11px] uppercase italic font-bold flex items-center justify-center gap-2 transition-all", activeTab === 'longtext' ? "text-brat border-b-2 border-brat" : "text-zinc-500")}
          >
            tâm tình
          </button>
        </div>

        {activeTab === 'canvas' ? renderCanvasSidebar() : renderLongTextSidebar()}
        
        {/* Voice Recorder - Desktop only */}
        <div className="mt-2 md:mt-4 hidden md:block">
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
        
        {/* Send Action */}
        <div className="mt-auto hidden md:block border-t border-zinc-800 pt-4">
          <button onClick={handleSaveAndComplete} disabled={isSaving} className="w-full py-3 bg-brat text-black font-black text-xl lowercase hover:opacity-90 transition-opacity disabled:opacity-50">
            {isSaving ? t.sending : t.send}
          </button>
        </div>
      </aside>

      {/* Main Content Area with Swipe Support */}
      <main className="flex-1 relative bg-brat overflow-hidden order-2 md:order-2 h-full flex flex-col">
        <AnimatePresence mode="wait">
          {activeTab === 'canvas' ? (
            <motion.div 
              key="canvas"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full h-full p-2 md:p-10 flex flex-col items-center justify-center relative touch-none"
              drag={false} 
              dragConstraints={{ left: 0, right: 0 }}
            >
              <div className="w-full h-full max-w-4xl bg-white shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden flex" ref={containerRef}>
                {/* Konva Layer */}
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
                  className="absolute inset-0 z-20 outline-none"
                  style={{ cursor: tool === 'pen' || tool === 'eraser' ? 'crosshair' : tool === 'eraser-object' ? 'pointer' : 'default' }}
                >
                  <Layer>
                    <CanvasBackground type={background} width={dimensions.width} height={dimensions.height} />
                    
                    <Polaroid
                      url="https://i.ibb.co/TD9mb1pB/avatar.jpg"
                      name="t. phát"
                      x={dimensions.width < 768 ? 32 : 80}
                      y={dimensions.width < 768 ? 32 : 80}
                      rotation={-12}
                      scale={dimensions.width < 768 ? 0.4 : 1}
                    />

                    {guestData.avatarUrl && (
                      <Polaroid
                        url={guestData.avatarUrl}
                        name={formattedName || 'friend'}
                        x={dimensions.width < 768 ? 72 : 180}
                        y={dimensions.width < 768 ? 32 : 80}
                        rotation={6}
                        scale={dimensions.width < 768 ? 0.4 : 1}
                      />
                    )}

                    {/* Meta Text */}
                    <KonvaText 
                      x={dimensions.width < 768 ? (guestData.avatarUrl ? 150 : 100) : (guestData.avatarUrl ? 400 : 300)}
                      y={dimensions.width < 768 ? 32 : 100}
                      text={`FROM: ${formattedName || 'MỘT NGƯỜI BẠN'}\nTO: CHÁT THUẬN PHÓ`}
                      fontFamily="sans-serif"
                      fontSize={dimensions.width < 768 ? 10 : 16}
                      fontStyle="bold"
                      fill="black"
                      lineHeight={1.5}
                      padding={4}
                    />
                  </Layer>
                  <Layer>
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
                        onClick={(e) => handleObjectClick(e, line.id, 'line')}
                        onTap={(e) => handleObjectClick(e, line.id, 'line')}
                      />
                    ))}
                    {texts.map((txt) => (
                      <KonvaText
                        key={txt.id}
                        text={txt.text}
                        x={txt.x}
                        y={txt.y}
                        width={Math.max(100, dimensions.width - txt.x - 20)} 
                        fontSize={txt.fontSize}
                        fontFamily={txt.fontFamily}
                        fill={txt.color}
                        fontStyle={`${txt.isItalic ? 'italic ' : ''}${txt.isBold ? 'bold' : 'normal'}`.trim()}
                        textDecoration={txt.isUnderline ? 'underline' : undefined}
                        draggable={tool === 'select' || tool === 'text'}
                        onDragEnd={(e) => handleTextDragEnd(e, txt.id)}
                        onClick={(e) => handleObjectClick(e, txt.id, 'text')}
                        onTap={(e) => handleObjectClick(e, txt.id, 'text')}
                      />
                    ))}
                    {images.map((img) => (
                      <URLImage 
                        key={img.id}
                        imageInfo={img}
                        isSelected={selectedId === img.id && (tool === 'select' || tool === 'text')}
                        onSelect={() => handleObjectClick({target: null}, img.id, 'image')}
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

              {/* Navigation Peek Button */}
              <motion.button 
                initial={{ x: 20 }}
                animate={{ x: 0 }}
                whileHover={{ x: -2 }}
                onClick={() => setActiveTab('longtext')}
                className="absolute right-0 top-1/2 -translate-y-1/2 group z-50 hidden md:flex items-center h-48"
              >
                <div className="bg-black text-brat h-full px-2 border-l-4 border-brat hover:bg-zinc-900 transition-all flex flex-col items-center justify-center gap-4">
                   <div className="flex items-center justify-center">
                      <span className="[writing-mode:vertical-lr] rotate-180 uppercase italic font-bold text-[12px] md:text-[13px] tracking-widest whitespace-nowrap">viết tâm tư</span>
                   </div>
                   <ChevronRight className="w-4 h-4 text-brat group-hover:translate-x-1 transition-transform" />
                </div>
              </motion.button>
            </motion.div>
          ) : (
            <motion.div 
              key="longtext"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="w-full h-full p-2 md:p-10 flex flex-col items-center justify-center relative bg-white md:bg-transparent"
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragListener={!!('ontouchstart' in window)}
              onDragEnd={(_, info) => {
                if (info.offset.x > 100) setActiveTab('canvas');
              }}
            >
              <div className="w-full h-full max-w-4xl bg-white shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] flex flex-col border border-black p-4 md:p-12 overflow-hidden relative">
                 <div className="relative z-10 h-full flex flex-col">
                    <h2 className="text-xl md:text-3xl font-bold italic lowercase mb-4 border-b-4 border-black pb-1 inline-block self-start">viết thêm vài lời...</h2>
                    <div 
                      className="flex-1 w-full bg-white transition-all overflow-y-auto rich-text-editor"
                      style={{
                        fontFamily: ltFont,
                        fontSize: `${ltSize}px`,
                        color: ltColor,
                        textAlign: ltAlign,
                        lineHeight: 1.5
                      }}
                    >
                       <EditorContent editor={editor} className="h-full focus:outline-none p-3 border-2 border-black/10 focus-within:border-black min-h-full" />
                    </div>
                    <div className="mt-2 md:mt-4 flex justify-between items-center text-[9px] md:text-[10px] uppercase font-bold opacity-30">
                        <span>{longText.replace(/<[^>]*>/g, '').length} ký tự</span>
                        <span>Đang ở chế độ soạn thảo văn bản phong phú</span>
                    </div>
                 </div>
              </div>

              {/* Navigation Peek Button Back */}
              <motion.button 
                initial={{ x: -20 }}
                animate={{ x: 0 }}
                whileHover={{ x: 2 }}
                onClick={() => setActiveTab('canvas')}
                className="absolute left-0 top-1/2 -translate-y-1/2 group z-50 hidden md:flex items-center h-48"
              >
                <div className="bg-black text-brat h-full px-2 border-r-4 border-brat hover:bg-zinc-900 transition-all flex flex-col items-center justify-center gap-4">
                   <ChevronRight className="w-4 h-4 rotate-180 text-brat group-hover:-translate-x-1 transition-transform" />
                   <div className="flex items-center justify-center">
                      <span className="[writing-mode:vertical-lr] rotate-180 uppercase italic font-bold text-[12px] md:text-[13px] tracking-widest whitespace-nowrap">quay lại vẽ</span>
                   </div>
                </div>
              </motion.button>
              
              <div className="md:hidden mt-4 text-[10px] font-bold uppercase text-transparent select-none flex items-center gap-2">
                 Thao tác nút bên để quay lại canvas
              </div>
            </motion.div>
          )}
        </AnimatePresence>


      </main>

      {/* Mobile Send Action - Sticky at Bottom */}
      <div className="w-full md:hidden shrink-0 z-[60] bg-black p-2 order-3 flex gap-2">
        <button 
          onClick={() => setActiveTab(activeTab === 'canvas' ? 'longtext' : 'canvas')}
          className="flex items-center justify-center w-12 bg-zinc-800 text-brat border border-zinc-700"
        >
          {activeTab === 'canvas' ? <FileText className="w-5 h-5"/> : <Palette className="w-5 h-5"/>}
        </button>

        <button 
          onClick={() => setIsRecordingOpen(true)}
          className={cn(
            "flex items-center justify-center w-12 border transition-all",
            audioBlob 
              ? "bg-brat text-black border-brat animate-pulse" 
              : "bg-zinc-800 text-zinc-500 border-zinc-700 hover:text-brat hover:border-brat"
          )}
        >
          <Mic className="w-5 h-5"/>
        </button>

        <button onClick={handleSaveAndComplete} disabled={isSaving} className="flex-1 py-3 bg-brat text-black font-black text-lg lowercase disabled:opacity-50">
          {isSaving ? t.sending : t.send}
        </button>
      </div>

      {/* Voice Recording Modal / Overlay for mobile */}
      <AnimatePresence>
        {isRecordingOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6 md:hidden"
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsRecordingOpen(false);
            }}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-sm"
            >
              <div className="flex justify-end mb-2">
                <button 
                  onClick={() => setIsRecordingOpen(false)}
                  className="bg-brat text-black px-3 py-1 font-black uppercase text-[10px]"
                >
                  đóng
                </button>
              </div>
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
              <p className="mt-4 text-center text-[10px] text-brat/50 uppercase font-black">
                {audioBlob ? "đã lưu bản ghi âm" : "vui lòng ghi âm để để lại lời nhắn thoại"}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer / Status Bar */}
      <footer className="hidden md:flex absolute bottom-0 left-0 w-full bg-black text-brat px-4 py-1 text-[10px] font-mono justify-between items-center uppercase tracking-tighter shrink-0 z-50">
        <div className="flex gap-4">
          <span>Mode: {activeTab === 'canvas' ? 'Canvas_Artist' : 'Text_Writer'}</span>
          <span>Tab: {activeTab === 'canvas' ? '01_DRAW' : '02_WRITE'}</span>
        </div>
        <div className="flex gap-4">
          {activeTab === 'canvas' ? (
             <>
               <span>Tool: {tool}</span>
               <span>Pen_Size: {penSize}px</span>
             </>
          ) : (
             <>
               <span>Chars: {longText.length}</span>
               <span>Font: {ltFont}</span>
             </>
          )}
        </div>
      </footer>
    </div>
  );
}
