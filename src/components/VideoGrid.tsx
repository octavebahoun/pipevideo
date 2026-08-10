'use client';

import { useState } from 'react';
import { Video as VideoIcon } from 'lucide-react';
import { useVideoActions } from '@/hooks/useVideoActions';
import VideoCard from '@/components/VideoCard';
import type { VideoRecord } from '@/types/video';

interface VideoGridProps {
  initialVideos: VideoRecord[];
  emptyTitle: string;
  emptyDescription: string;
}

/**
 * Shared grid used by the published/unpublished/scheduled dashboard sections.
 * Wraps useVideoActions + VideoCard so the polling/render/publish logic isn't
 * duplicated across the three pages.
 */
export default function VideoGrid({ initialVideos, emptyTitle, emptyDescription }: VideoGridProps) {
  const [videos, setVideos] = useState<VideoRecord[]>(initialVideos);
  const actions = useVideoActions(videos, setVideos);

  if (videos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center glass rounded-3xl">
        <VideoIcon className="w-16 h-16 text-zinc-300 mb-4" />
        <h3 className="text-lg font-medium text-zinc-900 mb-1">{emptyTitle}</h3>
        <p className="text-sm text-zinc-500 max-w-sm">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {videos.map((video) => (
        <VideoCard
          key={video.id}
          video={video}
          renderingIds={actions.renderingIds}
          publishingIds={actions.publishingIds}
          loadingStatsIds={actions.loadingStatsIds}
          cacheStatus={actions.cacheStatus}
          youtubeStats={actions.youtubeStats}
          onTriggerRender={actions.handleTriggerRender}
          onCancelRender={actions.handleCancelRender}
          onPublishYoutube={actions.handlePublishYoutube}
          onMarkPublished={actions.handleMarkPublished}
          onDeleteVideo={actions.handleDeleteVideo}
          onFetchYoutubeStats={actions.fetchYoutubeStats}
        />
      ))}
    </div>
  );
}
