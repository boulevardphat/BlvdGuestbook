import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, getDocs, query, orderBy, Timestamp, deleteDoc, doc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firebase-error';
import { ArrowLeft, Maximize2, Trash2, AlertTriangle, Download, Play, Volume2, FileArchive } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import useImage from 'use-image';
import { Stage, Layer, Line as KonvaLine, Text as KonvaText, Group, Image as KonvaImage } from 'react-konva';
import { cn, formatName } from '../lib/utils';
import { GuestbookEntry, ImageNode, LineNode, TextNode } from '../types';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { CanvasBackground, Polaroid } from './CanvasDecorations';

const ReadonlyURLImage = ({ imageInfo }: { imageInfo: ImageNode }) => {
  const isDataUrl = imageInfo.url.startsWith('data:') || imageInfo.url.startsWith('/');
  const [img] = useImage(imageInfo.url, isDataUrl ? undefined : 'anonymous');
  return (
    <KonvaImage
      image={img}
      x={imageInfo.x}
      y={imageInfo.y}
      width={imageInfo.width}
      height={imageInfo.height}
      rotation={imageInfo.rotation}
    />
  );
};

export default function Gallery({ onBack }: { onBack: () => void }) {
  const [entries, setEntries] = useState<GuestbookEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<GuestbookEntry | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleDownloadZip = async (entry: GuestbookEntry) => {
    setIsDownloading(true);
    try {
      const zip = new JSZip();
      const folderName = `luubut_${formatName(entry.fullName) || 'ban'}`;
      const folder = zip.folder(folderName);
      
      if (folder) {
        // Add canvas image
        if (entry.canvasImage) {
          const imageBase64 = entry.canvasImage.split(',')[1];
          folder.file("guestbook_canvas.jpg", imageBase64, { base64: true });
        }
        
        // Add audio if exists
        if (entry.audioUrl) {
          const audioBase64 = entry.audioUrl.split(',')[1];
          // Determine extension from data url or default to webm/mp3
          const extension = entry.audioUrl.includes('audio/webm') ? 'webm' : 'mp3';
          folder.file(`guestbook_audio.${extension}`, audioBase64, { base64: true });
        }

        // Add long text if exists
        if (entry.longText) {
          const plainText = entry.longText.replace(/<[^>]*>/g, '');
          folder.file("message.txt", plainText);
        }

        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, `${folderName}.zip`);
      }
    } catch (err) {
      console.error("Download failed:", err);
      alert("Không thể tải zip lúc này.");
    } finally {
      setIsDownloading(false);
    }
  };
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    
    setLoading(true);
    const fetchEntries = async () => {
      try {
        const q = query(collection(db, 'guestbookEntries'), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        const fetchedEntries: GuestbookEntry[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          fetchedEntries.push({
            id: doc.id,
            fullName: data.fullName,
            nickname: data.nickname,
            className: data.className,
            schoolName: data.schoolName,
            avatarUrl: data.avatarUrl,
            audioUrl: data.audioUrl || null,
            canvasImage: data.canvasImage || null,
            lines: data.lines ? JSON.parse(data.lines) : [],
            texts: data.texts ? JSON.parse(data.texts) : [],
            images: data.images ? JSON.parse(data.images) : [],
            longText: data.longText || null,
            longTextMeta: data.longTextMeta || null,
            createdAt: data.createdAt,
          });
        });
        setEntries(fetchedEntries);
      } catch (error) {
        console.error(error);
        try {
           handleFirestoreError(error, OperationType.LIST, 'guestbookEntries');
        } catch(e) {}
      } finally {
        setLoading(false);
      }
    };
    fetchEntries();
  }, [isAuthenticated]);

  const handleDelete = async (entryId: string) => {
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'guestbookEntries', entryId));
      setEntries(entries.filter(e => e.id !== entryId));
      setConfirmDeleteId(null);
    } catch (error) {
      console.error("Error deleting entry:", error);
      alert("Không thể xóa lúc này. Thử lại sau!");
      try {
        handleFirestoreError(error, OperationType.DELETE, `guestbookEntries/${entryId}`);
      } catch (e) {
        // Suppress or handle rethrow
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'Thuanphat26092008') {
      setIsAuthenticated(true);
      setError('');
    } else {
      setError('sai mật khẩu rồi!');
    }
  };

  const toggleAudio = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  useEffect(() => {
    if (selectedEntry) {
      setIsPlaying(false);
    }
  }, [selectedEntry]);

  const renderCanvasContent = (entry: GuestbookEntry, scale: number) => {
    if (entry.canvasImage) {
      return (
        <div className="w-full relative overflow-hidden bg-white flex items-center justify-center">
          <img 
            src={entry.canvasImage} 
            alt="Canvas" 
            className="w-full h-auto max-h-[85vh] object-contain shadow-sm"
            style={{ 
              imageRendering: 'auto',
              WebkitBackfaceVisibility: 'hidden'
            }} 
          />
        </div>
      );
    }

    return (
      <div className="w-full h-full bg-white flex items-center justify-center relative overflow-hidden">
        <Stage width={800 * scale} height={600 * scale}>
          <Layer scaleX={scale} scaleY={scale}>
            {/* Background elements & Polaroids under drawing elements */}
            <Group>
              <CanvasBackground type="dotted" width={800} height={600} />
              
              <Polaroid
                url="/img/avatar.jpg"
                name="t. phát"
                x={80}
                y={80}
                rotation={-12}
                scale={1}
              />

              {entry.avatarUrl && (
                <Polaroid
                  url={entry.avatarUrl}
                  name={formatName(entry.fullName) || 'friend'}
                  x={180}
                  y={80}
                  rotation={6}
                  scale={1}
                />
              )}

              {/* Header Info Labels */}
              <KonvaText 
                x={entry.avatarUrl ? 400 : 300}
                y={100}
                text={`FROM: ${formatName(entry.fullName) || 'MỘT NGƯỜI BẠN'}\nTO: CHÁT THUẬN PHÓ`}
                fontFamily="sans-serif"
                fontSize={16}
                fontStyle="bold"
                fill="black"
                lineHeight={1.5}
                padding={4}
              />
            </Group>

            {/* Custom drawings, custom stickers and custom uploaded images on top */}
            <Group>
              {entry.lines.map((line) => (
                <KonvaLine
                  key={line.id}
                  points={line.points}
                  stroke={line.color}
                  strokeWidth={line.thickness}
                  tension={0.5}
                  lineCap="round"
                  lineJoin="round"
                  globalCompositeOperation={line.isEraser ? 'destination-out' : 'source-over'}
                />
              ))}
              {entry.images.map((img) => (
                <ReadonlyURLImage key={img.id} imageInfo={img} />
              ))}
              {entry.texts.map((text) => (
                <KonvaText
                  key={text.id}
                  x={text.x}
                  y={text.y}
                  text={text.text}
                  fontSize={text.fontSize}
                  fontFamily={text.fontFamily}
                  fill={text.color}
                  fontStyle={`${text.isItalic ? 'italic' : ''} ${text.isBold ? 'bold' : 'normal'}`.trim()}
                  textDecoration={text.isUnderline ? 'underline' : ''}
                />
              ))}
            </Group>
          </Layer>
        </Stage>
      </div>
    );
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-brat flex flex-col items-center justify-center p-6 font-sans">
        <form onSubmit={handleLogin} className="w-full max-w-sm flex flex-col gap-4 bg-white p-6 shadow-xl border-4 border-black">
          <h2 className="text-2xl font-bold lowercase tracking-tighter text-black text-center mb-2">nhập mật khẩu</h2>
          <div className="flex flex-col gap-1">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="mật khẩu..."
              className="w-full p-3 border-2 border-black focus:outline-none focus:bg-black focus:text-white bg-gray-50 font-bold placeholder:font-normal"
            />
            {error && <p className="text-red-500 text-xs font-bold lowercase mt-1">{error}</p>}
          </div>
          <p className="text-sm text-gray-600 font-bold lowercase">*gợi ý: gmail chính</p>
          <div className="flex gap-2 mt-2">
            <button type="button" onClick={onBack} className="flex-1 py-3 border-2 border-black text-black font-bold lowercase hover:bg-gray-100 transition-colors">
              quay lại
            </button>
            <button type="submit" className="flex-1 py-3 bg-black text-white font-bold lowercase hover:scale-105 transition-transform duration-200">
              vào xem
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-brat flex items-center justify-center p-6">
         <p className="text-black font-bold text-2xl lowercase tracking-tighter">Đang tải dữ liệu...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brat p-6 md:p-12 font-sans overflow-y-auto">
      <div className="max-w-7xl mx-auto flex flex-col gap-8">
         <div className="flex items-center justify-between">
           <h1 className="text-4xl md:text-6xl font-bold text-black lowercase tracking-tighter leading-none">
             Thư viện lưu bút
           </h1>
           <button 
             onClick={onBack}
             className="flex items-center gap-2 bg-black text-white px-4 py-2 font-bold lowercase text-sm hover:bg-gray-800 transition-colors"
           >
              <ArrowLeft className="w-4 h-4" /> Quay lại
           </button>
         </div>

         {entries.length === 0 ? (
           <div className="text-black text-xl lowercase border-2 border-dashed border-black/20 p-12 text-center">
             Chưa có lời nhắn nào được tạo.
           </div>
         ) : (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {entries.map(entry => (
               <div key={entry.id} className="bg-white border text-left border-gray-200 shadow-md p-4 flex flex-col gap-4 hover:shadow-xl transition-shadow group relative">
                 {/* Delete Button */}
                 <button 
                   onClick={(e) => {
                     e.stopPropagation();
                     setConfirmDeleteId(entry.id);
                   }}
                   className="absolute top-2 right-2 z-30 p-2 bg-red-100 text-red-600 rounded-full opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:bg-red-200 transition-all shadow-sm"
                   title="Xóa lưu bút này"
                 >
                   <Trash2 className="w-4 h-4" />
                 </button>

                 {/* Card Header */}
                 <div className="flex gap-4 items-center border-b border-gray-100 pb-3">
                   <div className="w-12 h-12 bg-gray-200 shrink-0 overflow-hidden">
                     {entry.avatarUrl ? (
                        <img src={entry.avatarUrl} alt={entry.fullName} className="w-full h-full object-cover" />
                     ) : (
                        <div className="w-full h-full flex items-center justify-center bg-zinc-300 text-xs font-bold">...</div>
                     )}
                   </div>
                   <div className="flex flex-col flex-1 overflow-hidden">
                     <p className="font-bold uppercase text-[10px] sm:text-xs truncate">TỪ: {formatName(entry.fullName)}</p>
                     {(entry.className || entry.schoolName) && (
                        <p className="text-[10px] text-gray-500 truncate lowercase">{entry.className ? entry.className + ' - ' : ''}{entry.schoolName}</p>
                     )}
                   </div>
                 </div>
                 
                 {/* Mini Canvas View */}
                 <div className="bg-gray-50 w-full aspect-[4/3] overflow-hidden rounded relative border border-gray-100 flex items-center justify-center">
                   {renderCanvasContent(entry, 0.4)}
                   
                   {/* Overlay to view full */}
                   <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                     <button 
                       onClick={() => setSelectedEntry(entry)}
                       className="opacity-0 group-hover:opacity-100 bg-white text-black text-xs font-bold p-2 lowercase flex items-center gap-2 shadow-lg transition-opacity"
                     >
                        <Maximize2 className="w-4 h-4" />
                        Xem chi tiết
                     </button>
                   </div>
                 </div>
               </div>
             ))}
           </div>
         )}
      </div>

       {/* Fullscreen View Modal */}
       {selectedEntry && (
         <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <div className="relative bg-white w-full max-w-5xl h-[80vh] flex flex-col shadow-2xl">
               {/* Header Info */}
               <div className="bg-brat text-black p-4 flex justify-between items-center z-10 shrink-0 border-b-2 border-black">
                 <div className="flex items-center gap-4">
                   <div className="w-12 h-12 bg-gray-200 shrink-0 overflow-hidden border border-black">
                     {selectedEntry.avatarUrl ? (
                        <img src={selectedEntry.avatarUrl} alt={selectedEntry.fullName} className="w-full h-full object-cover" />
                     ) : (
                        <div className="w-full h-full flex items-center justify-center bg-zinc-300 text-xs font-bold border border-black">...</div>
                     )}
                   </div>
                   <div>
                     <p className="font-bold uppercase text-sm sm:text-base">TỪ: {formatName(selectedEntry.fullName)}</p>
                     {(selectedEntry.className || selectedEntry.schoolName) && (
                        <p className="text-xs text-black/70 lowercase">{selectedEntry.className ? selectedEntry.className + ' - ' : ''}{selectedEntry.schoolName}</p>
                     )}
                   </div>
                 </div>
                 <div className="flex gap-2">
                   {selectedEntry.audioUrl && (
                     <button 
                       onClick={toggleAudio}
                       className={cn(
                         "flex items-center gap-2 px-3 py-2 border-2 border-black font-black uppercase text-[10px] transition-all",
                         isPlaying ? "bg-black text-brat shadow-[2px_2px_0px_0px_rgba(138,206,0,1)]" : "bg-brat text-black hover:bg-white"
                       )}
                     >
                       {isPlaying ? <Volume2 className="w-4 h-4 animate-pulse" /> : <Play className="w-4 h-4 fill-current" />}
                       {isPlaying ? 'đang phát...' : 'nghe lời nhắn'}
                       <audio ref={audioRef} src={selectedEntry.audioUrl} onEnded={() => setIsPlaying(false)} className="hidden" />
                     </button>
                   )}
                   <button 
                     onClick={() => handleDownloadZip(selectedEntry)}
                     disabled={isDownloading}
                     className="flex items-center justify-center w-10 text-black bg-white py-2 border-2 border-black hover:bg-brat transition-all disabled:opacity-50"
                     title="Tải tất cả về (ZIP)"
                   >
                     <FileArchive className={cn("w-4 h-4", isDownloading && "animate-bounce")} /> 
                   </button>
                   <button 
                     onClick={() => setSelectedEntry(null)} 
                     className="text-white bg-black px-4 py-2 border-2 border-black hover:bg-zinc-800 font-black uppercase text-[10px] transition-all"
                   >
                     đóng
                   </button>
                 </div>
               </div>

               {/* Content Area */}
               <div className="flex-1 overflow-y-auto bg-gray-100 flex flex-col">
                  {/* Large Canvas View */}
                  <div className="shrink-0 w-full min-h-[50vh] md:min-h-[70vh] flex items-center justify-center relative p-2 md:p-8">
                     <div className="absolute inset-0 opacity-50 pointer-events-none" style={{ backgroundImage: 'linear-gradient(transparent 95%, #ccc 95%, #ccc 100%)', backgroundSize: '100% 28px' }}></div>
                     <div className="bg-white shadow-xl max-w-full">
                       {renderCanvasContent(selectedEntry, 1)}
                     </div>
                  </div>

                  {/* Long Text Content if exists */}
                  {selectedEntry.longText && (
                     <div className="bg-white p-8 md:p-16 border-t-4 border-black">
                        <h3 className="text-2xl font-black lowercase mb-8 border-b-2 border-black inline-block">tâm tình thêm...</h3>
                        <div 
                           className="leading-relaxed rich-text-content"
                           style={{
                             fontFamily: selectedEntry.longTextMeta?.font || 'inherit',
                             fontSize: `${selectedEntry.longTextMeta?.size || 16}px`,
                             color: selectedEntry.longTextMeta?.color || 'black',
                             textAlign: selectedEntry.longTextMeta?.align || 'left',
                           }}
                           dangerouslySetInnerHTML={{ __html: selectedEntry.longText }}
                        />
                     </div>
                  )}
               </div>
            </div>
         </div>
       )}

       {/* Delete Confirmation Modal */}
       <AnimatePresence>
         {confirmDeleteId && (
           <motion.div 
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             exit={{ opacity: 0 }}
             className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
           >
             <motion.div 
               initial={{ scale: 0.9, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               exit={{ scale: 0.9, opacity: 0 }}
               className="bg-white w-full max-w-sm p-8 shadow-2xl border-4 border-black flex flex-col items-center text-center gap-6"
             >
               <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
                 <AlertTriangle className="w-8 h-8" />
               </div>
               <div>
                  <h3 className="text-xl font-black lowercase mb-2">Xác nhận xóa?</h3>
                  <p className="text-sm text-gray-600 font-bold leading-relaxed px-4">Hành động này sẽ xóa vĩnh viễn lời chúc này khỏi hệ thống và không thể hoàn tác.</p>
               </div>
               <div className="flex gap-3 w-full">
                 <button 
                   disabled={isDeleting}
                   onClick={() => setConfirmDeleteId(null)}
                   className="flex-1 py-3 border-2 border-black font-bold lowercase hover:bg-gray-100 disabled:opacity-50"
                 >
                   hủy bỏ
                 </button>
                 <button 
                   disabled={isDeleting}
                   onClick={() => handleDelete(confirmDeleteId)}
                   className="flex-1 py-3 bg-red-600 text-white font-bold lowercase hover:bg-red-700 disabled:opacity-50"
                 >
                   {isDeleting ? 'đang xóa...' : 'đồng ý xóa'}
                 </button>
               </div>
             </motion.div>
           </motion.div>
         )}
       </AnimatePresence>
    </div>
  );
}
