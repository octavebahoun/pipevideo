'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Play,
  Edit3,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  Sparkles,
  Loader2,
  Tv,
  Eye,
  ThumbsUp,
  MessageCircle,
  RefreshCw,
  CalendarClock,
  CheckCheck
} from 'lucide-react';
import type { VideoRecord } from '@/types/video';
import VideoPlayerModal from '@/components/VideoPlayerModal';

interface VideoCardProps {
  video: VideoRecord;
  renderingIds: string[];
  publishingIds: string[];
  loadingStatsIds: string[];
  cacheStatus: Record<string, { totalScenes: number; readyScenes: number }>;
  youtubeStats: Record<string, { viewCount: number; likeCount: number; commentCount: number }>;
  onTriggerRender: (id: string, mode?: 'resume' | 'fresh') => void;
  onCancelRender: (id: string) => void;
  onPublishYoutube: (id: string) => void;
  onMarkPublished: (id: string, youtubeId: string) => void;
  onDeleteVideo: (id: string) => void;
  onFetchYoutubeStats: (id: string) => void;
}

function getStatusBadge(status: string) {
  const base = 'px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 w-fit ';
  switch (status) {
    case 'DRAFT':
      return <span className={base + 'bg-zinc-100 text-zinc-600 border border-zinc-200'}><Clock className="w-3.5 h-3.5" /> Brouillon</span>;
    case 'SCRIPTED':
      return <span className={base + 'bg-blue-50 text-blue-600 border border-blue-200'}><Sparkles className="w-3.5 h-3.5" /> Scénarisé</span>;
    case 'RENDERING':
      return <span className={base + 'bg-amber-50 text-amber-600 border border-amber-200 animate-pulse'}><Loader2 className="w-3.5 h-3.5 animate-spin" /> Rendu en cours</span>;
    case 'COMPLETED':
      return <span className={base + 'bg-emerald-50 text-emerald-600 border border-emerald-200'}><CheckCircle2 className="w-3.5 h-3.5" /> Rendu terminé</span>;
    case 'PUBLISHED':
      return <span className={base + 'bg-red-50 text-red-600 border border-red-200'}><Tv className="w-3.5 h-3.5" /> Publié</span>;
    case 'FAILED':
      return <span className={base + 'bg-red-50 text-red-600 border border-red-200'}><AlertCircle className="w-3.5 h-3.5" /> Échec</span>;
    default:
      return <span className={base + 'bg-zinc-100 text-zinc-600'}>{status}</span>;
  }
}

export default function VideoCard({
  video,
  renderingIds,
  publishingIds,
  loadingStatsIds,
  cacheStatus,
  youtubeStats,
  onTriggerRender,
  onCancelRender,
  onPublishYoutube,
  onMarkPublished,
  onDeleteVideo,
  onFetchYoutubeStats,
}: VideoCardProps) {
  const [isMarkingPublished, setIsMarkingPublished] = useState(false);
  const [manualYoutubeId, setManualYoutubeId] = useState('');
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);

  const playableSrc = video.videoPath
    ? video.videoPath.startsWith('http')
      ? video.videoPath
      : `/${video.videoPath}`
    : null;

  const handleConfirmMarkPublished = () => {
    if (!manualYoutubeId.trim()) return;
    onMarkPublished(video.id, manualYoutubeId.trim());
    setIsMarkingPublished(false);
    setManualYoutubeId('');
  };

  return (
    <div className="glass glass-hover p-6 rounded-2xl flex flex-col justify-between min-h-[280px]">
      <div>
        <div className="flex justify-between items-start gap-2 mb-3">
          {getStatusBadge(video.status)}
          <button
            onClick={() => onDeleteVideo(video.id)}
            className="text-zinc-400 hover:text-red-500 p-1 rounded-lg hover:bg-red-50 transition-colors"
            title="Supprimer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
        <h3 className="text-lg font-bold text-zinc-900 line-clamp-1 mb-1">{video.title}</h3>
        <p className="text-sm text-zinc-500 line-clamp-2 mb-4">Sujet : {video.topic}</p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Link
            href={`/editor/${video.id}`}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 btn-glossy-white text-zinc-700 text-xs font-semibold rounded-xl transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" /> Éditer Storyboard
          </Link>

          {video.status === 'COMPLETED' && playableSrc && (
            <button
              onClick={() => setIsPlayerOpen(true)}
              className="flex items-center justify-center p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors"
              title="Visionner la vidéo"
            >
              <Play className="w-4 h-4" />
            </button>
          )}
        </div>

        {(video.status === 'SCRIPTED' || video.status === 'DRAFT') && (
          <button
            onClick={() => onTriggerRender(video.id)}
            disabled={renderingIds.includes(video.id)}
            className="w-full flex items-center justify-center gap-2 py-2.5 btn-glossy-red disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all"
          >
            {renderingIds.includes(video.id) ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Rendu en cours...</>
            ) : (
              <><Play className="w-3.5 h-3.5" /> Lancer le Rendu</>
            )}
          </button>
        )}

        {video.status === 'FAILED' && (
          <div className="space-y-2 w-full">
            {cacheStatus[video.id] && cacheStatus[video.id].totalScenes > 0 && (
              <p className="text-xs text-zinc-500 text-center">
                {cacheStatus[video.id].readyScenes}/{cacheStatus[video.id].totalScenes} scènes déjà générées
              </p>
            )}
            <button
              onClick={() => onTriggerRender(video.id, 'resume')}
              disabled={renderingIds.includes(video.id)}
              className="w-full flex items-center justify-center gap-2 py-2.5 btn-glossy-red disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all"
            >
              {renderingIds.includes(video.id) ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Rendu en cours...</>
              ) : (
                <><Play className="w-3.5 h-3.5" /> Reprendre le rendu</>
              )}
            </button>
            <button
              onClick={() => onTriggerRender(video.id, 'fresh')}
              disabled={renderingIds.includes(video.id)}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 text-zinc-400 hover:text-zinc-600 text-xs transition-colors"
            >
              Recommencer à zéro
            </button>
          </div>
        )}

        {video.status === 'RENDERING' && (
          <div className="space-y-3 w-full">
            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-500 truncate max-w-[70%] font-medium">
                {video.progressStep || 'Préparation...'}
              </span>
              <span className="text-red-600 font-bold">{video.progress || 0}%</span>
            </div>

            <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden border border-zinc-200">
              <div
                className="h-full bg-gradient-to-r from-red-600 to-red-500 rounded-full transition-all duration-500 ease-out shadow-[0_0_8px_rgba(255,0,0,0.3)]"
                style={{ width: `${video.progress || 0}%` }}
              />
            </div>

            <button
              onClick={() => onCancelRender(video.id)}
              className="w-full flex items-center justify-center gap-2 py-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 text-xs font-bold rounded-xl transition-all"
            >
              Annuler le Rendu
            </button>
          </div>
        )}

        {video.status === 'COMPLETED' && (
          <div className="space-y-2 w-full">
            {video.scheduledFor && new Date(video.scheduledFor) > new Date() && (
              <p className="flex items-center justify-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl py-1.5">
                <CalendarClock className="w-3.5 h-3.5" />
                Programmée pour le {new Date(video.scheduledFor).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
              </p>
            )}
            <button
              onClick={() => onPublishYoutube(video.id)}
              disabled={publishingIds.includes(video.id)}
              className="w-full flex items-center justify-center gap-2 py-2.5 btn-glossy-red disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all"
            >
              {publishingIds.includes(video.id) ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Publication...</>
              ) : (
                <><Tv className="w-3.5 h-3.5" /> Publier maintenant sur YouTube</>
              )}
            </button>

            {isMarkingPublished ? (
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={manualYoutubeId}
                  onChange={(e) => setManualYoutubeId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleConfirmMarkPublished()}
                  placeholder="ID YouTube (ex: dQw4w9WgXcQ)"
                  autoFocus
                  className="flex-1 min-w-0 bg-white border border-zinc-200 focus:border-red-500 rounded-lg px-2.5 py-1.5 text-xs text-zinc-900 placeholder-zinc-400 outline-none"
                />
                <button
                  onClick={handleConfirmMarkPublished}
                  disabled={!manualYoutubeId.trim()}
                  className="px-2.5 bg-zinc-900 hover:bg-zinc-700 disabled:opacity-40 text-white rounded-lg transition-colors"
                  title="Confirmer"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsMarkingPublished(true)}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 text-zinc-400 hover:text-zinc-600 text-xs transition-colors"
              >
                Déjà publiée manuellement ? Marquer comme publiée
              </button>
            )}
          </div>
        )}

        {(video.status === 'PUBLISHED' || video.youtubeId) && (
          <div className="space-y-2 w-full">
            <div className="flex gap-2">
              <a
                href={`https://youtube.com/watch?v=${video.youtubeId}`}
                target="_blank"
                rel="noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-2.5 btn-glossy-white text-zinc-700 text-xs font-bold rounded-xl transition-all"
              >
                <Tv className="w-3.5 h-3.5 text-red-500" /> Voir sur YouTube ({video.youtubeStatus || 'PUBLIC'})
              </a>
              {playableSrc && (
                <button
                  onClick={() => setIsPlayerOpen(true)}
                  className="flex items-center justify-center p-2.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-colors"
                  title="Visionner le fichier rendu"
                >
                  <Play className="w-4 h-4" />
                </button>
              )}
            </div>

            {video.youtubeId && (
              <div className="flex items-center justify-between gap-2 px-1">
                {youtubeStats[video.id] ? (
                  <div className="flex items-center gap-3 text-xs text-zinc-500">
                    <span className="flex items-center gap-1" title="Vues">
                      <Eye className="w-3.5 h-3.5" /> {youtubeStats[video.id].viewCount.toLocaleString('fr-FR')}
                    </span>
                    <span className="flex items-center gap-1" title="Likes">
                      <ThumbsUp className="w-3.5 h-3.5" /> {youtubeStats[video.id].likeCount.toLocaleString('fr-FR')}
                    </span>
                    <span className="flex items-center gap-1" title="Commentaires">
                      <MessageCircle className="w-3.5 h-3.5" /> {youtubeStats[video.id].commentCount.toLocaleString('fr-FR')}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-zinc-400">Statistiques non chargées</span>
                )}
                <button
                  onClick={() => onFetchYoutubeStats(video.id)}
                  disabled={loadingStatsIds.includes(video.id)}
                  className="text-zinc-400 hover:text-zinc-600 p-1 rounded-lg hover:bg-zinc-100 transition-colors"
                  title="Rafraîchir les statistiques"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingStatsIds.includes(video.id) ? 'animate-spin' : ''}`} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {isPlayerOpen && playableSrc && (
        <VideoPlayerModal src={playableSrc} title={video.title} onClose={() => setIsPlayerOpen(false)} />
      )}
    </div>
  );
}
