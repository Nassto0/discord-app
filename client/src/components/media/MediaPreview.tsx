import { useState } from 'react';
import { X, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface MediaPreviewProps {
  type: 'image' | 'video';
  src: string;
}

export function MediaPreview({ type, src }: MediaPreviewProps) {
  const [lightbox, setLightbox] = useState(false);
  const [playing, setPlaying] = useState(false);

  return (
    <>
      {type === 'image' ? (
        <button onClick={() => setLightbox(true)} className="block overflow-hidden rounded-lg">
          <img src={src} alt="" className="max-h-72 max-w-full rounded-lg object-cover hover:opacity-95 transition-opacity" loading="lazy" />
        </button>
      ) : (
        <div className="relative overflow-hidden rounded-lg max-w-sm">
          {playing ? (
            <video src={src} controls autoPlay playsInline className="max-h-72 w-full rounded-lg" onEnded={() => setPlaying(false)} />
          ) : (
            <>
              <video src={src} className="max-h-72 w-full rounded-lg object-cover" preload="metadata" />
              <button onClick={() => setPlaying(true)} className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/50 transition-colors">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                  <Play className="h-7 w-7 text-white ml-1" fill="white" />
                </div>
              </button>
            </>
          )}
        </div>
      )}

      <AnimatePresence>
        {lightbox && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setLightbox(false)}>
            <button className="absolute right-4 top-4 text-white/70 hover:text-white z-10"><X className="h-8 w-8" /></button>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} onClick={(e) => e.stopPropagation()} className="max-h-[90vh] max-w-[90vw]">
              <img src={src} alt="" className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
