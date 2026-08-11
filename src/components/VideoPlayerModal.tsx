'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';

interface VideoPlayerModalProps {
  src: string;
  title: string;
  onClose: () => void;
}

/** Lightweight in-app player so a rendered video can be watched without
 *  leaving the dashboard or downloading the raw file. */
export default function VideoPlayerModal({ src, title, onClose }: VideoPlayerModalProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="glass rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200">
          <h3 className="text-sm font-bold text-zinc-900 truncate pr-4">{title}</h3>
          <button
            onClick={onClose}
            className="shrink-0 text-zinc-400 hover:text-zinc-900 p-1.5 rounded-lg hover:bg-zinc-100 transition-colors"
            aria-label="Fermer le lecteur"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="bg-black flex items-center justify-center">
          <video
            src={src}
            controls
            autoPlay
            playsInline
            className="max-h-[75vh] w-full"
          >
            Votre navigateur ne prend pas en charge la lecture vidéo.
          </video>
        </div>
      </div>
    </div>
  );
}
