import { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Trash2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface VoiceRecorderProps {
  onRecordingComplete: (blob: Blob | null) => void;
  onClear: () => void;
  initialAudioUrl?: string | null;
}

export default function VoiceRecorder({ onRecordingComplete, onClear, initialAudioUrl }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(initialAudioUrl || null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMicAvailable, setIsMicAvailable] = useState<boolean | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout|null>(null);
  const audioPlaybackRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Check for mic support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setIsMicAvailable(false);
    } else {
      setIsMicAvailable(true);
    }
  }, []);

  useEffect(() => {
    if (initialAudioUrl) {
      setAudioUrl(initialAudioUrl);
    }
  }, [initialAudioUrl]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      // Only revoke if it was created here, but for simplicity we'll let the parent handle revocation if it passed it in?
      // Actually, if it's passed in, it might be a blob URL from the parent.
    };
  }, []);

  useEffect(() => {
    if (isRecording && recordingTime >= 30) {
      stopRecording();
    }
  }, [isRecording, recordingTime]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        onRecordingComplete(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(prev => prev + 1), 1000);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      // If user denies permission, we treat it as unavailable for the session
      if (err instanceof Error && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
        setIsMicAvailable(false);
      } else {
        alert('Không thể truy cập microphone. Vui lòng kiểm tra quyền truy cập.');
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlay = () => {
    if (audioPlaybackRef.current) {
      setIsPlaying(true);
      audioPlaybackRef.current.play();
    }
  };

  const clearRecording = () => {
    setAudioUrl(null);
    setRecordingTime(0);
    onClear();
  };

  if (isMicAvailable === false) {
    return (
      <div className="bg-black border-2 border-zinc-800 p-4 opacity-50 grayscale cursor-not-allowed">
        <div className="flex items-center gap-2 mb-2">
          <Mic className="w-4 h-4 text-zinc-500" />
          <span className="text-[10px] font-black uppercase text-zinc-500">mic_unavailable</span>
        </div>
        <p className="text-[9px] text-zinc-600 uppercase font-bold">trình duyệt hoặc thiết bị không hỗ trợ ghi âm.</p>
      </div>
    );
  }

  return (
    <div className="bg-black border-2 border-brat p-4 shadow-[4px_4px_0px_0px_rgba(138,206,0,1)] flex flex-col gap-3">
      <div className="flex items-center justify-between border-b border-brat/30 pb-2 mb-1">
        <div className="flex items-center gap-2">
          {isRecording ? (
            <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          ) : (
            <Mic className="w-4 h-4 text-brat" />
          )}
          <span className="text-[10px] font-black uppercase tracking-tighter text-brat">
            {isRecording ? 'vocal_recording...' : 'audio_message'}
          </span>
        </div>
        <div className="font-mono text-xs text-brat bg-brat/10 px-2 py-0.5 rounded">
          {formatTime(recordingTime)}
        </div>
      </div>

      <div className="flex gap-2">
        {!audioUrl ? (
          !isRecording ? (
            <button
              onClick={startRecording}
              className="flex-1 flex items-center justify-center gap-2 bg-brat text-black py-3 px-4 font-black uppercase text-xs hover:opacity-90 transition-all active:scale-95"
            >
              <Mic className="w-4 h-4" /> bắt đầu ghi
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="flex-1 flex items-center justify-center gap-2 bg-red-500 text-white py-3 px-4 font-black uppercase text-xs animate-pulse"
            >
              <Square className="w-4 h-4 fill-current" /> dừng lại
            </button>
          )
        ) : (
          <>
            <button
              onClick={handlePlay}
              disabled={isPlaying}
              className="flex-1 flex items-center justify-center gap-2 bg-brat text-black py-3 px-4 font-black uppercase text-xs hover:opacity-90 transition-all disabled:opacity-50"
            >
              {isPlaying ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4 fill-current" />
              )}
              nghe lại
            </button>
            <button
              onClick={clearRecording}
              className="w-12 flex items-center justify-center bg-zinc-900 border border-brat text-red-500 hover:bg-red-500 hover:text-white transition-all"
              title="Xóa bản ghi"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <audio 
              ref={audioPlaybackRef} 
              src={audioUrl} 
              onEnded={() => setIsPlaying(false)} 
              className="hidden" 
            />
          </>
        )}
      </div>
      
      {isRecording && (
        <p className="text-[9px] text-brat/60 italic uppercase tracking-widest text-center mt-1">đang ghi âm... hãy nói lời thật lòng nhé!</p>
      )}
    </div>
  );
}
