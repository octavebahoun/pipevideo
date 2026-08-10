'use client';

import { useState, useEffect } from 'react';
import type { VideoRecord } from '@/types/video';

/**
 * Shared video-action logic, extracted from the original single-page dashboard
 * so it can be reused identically across the published/unpublished/scheduled
 * dashboard sections without duplicating handlers or polling effects.
 */
export function useVideoActions(
  videos: VideoRecord[],
  setVideos: React.Dispatch<React.SetStateAction<VideoRecord[]>>
) {
  const [renderingIds, setRenderingIds] = useState<string[]>([]);
  const [publishingIds, setPublishingIds] = useState<string[]>([]);
  const [cacheStatus, setCacheStatus] = useState<Record<string, { totalScenes: number; readyScenes: number }>>({});
  const [youtubeStats, setYoutubeStats] = useState<Record<string, { viewCount: number; likeCount: number; commentCount: number }>>({});
  const [loadingStatsIds, setLoadingStatsIds] = useState<string[]>([]);

  const renderingString = videos.filter((v) => v.status === 'RENDERING').map((v) => v.id).join(',');
  const failedString = videos.filter((v) => v.status === 'FAILED').map((v) => v.id).join(',');
  const publishedWithIdString = videos.filter((v) => v.youtubeId).map((v) => v.id).join(',');

  useEffect(() => {
    if (!failedString) return;
    const failedIdsList = failedString.split(',');

    (async () => {
      const results = await Promise.all(
        failedIdsList.map(async (id) => {
          try {
            const res = await fetch(`/api/render/status?id=${id}`);
            if (!res.ok) return null;
            const data = await res.json();
            return { id, totalScenes: data.totalScenes, readyScenes: data.readyScenes };
          } catch {
            return null;
          }
        })
      );

      setCacheStatus((prev) => {
        const next = { ...prev };
        for (const r of results) {
          if (r) next[r.id] = { totalScenes: r.totalScenes, readyScenes: r.readyScenes };
        }
        return next;
      });
    })();
  }, [failedString]);

  const fetchYoutubeStats = async (id: string) => {
    setLoadingStatsIds((prev) => [...prev, id]);
    try {
      const res = await fetch(`/api/youtube/stats?id=${id}`);
      if (res.ok) {
        const data = await res.json();
        setYoutubeStats((prev) => ({
          ...prev,
          [id]: { viewCount: data.viewCount, likeCount: data.likeCount, commentCount: data.commentCount },
        }));
      }
    } catch (err) {
      console.error('Error fetching YouTube stats:', err);
    } finally {
      setLoadingStatsIds((prev) => prev.filter((x) => x !== id));
    }
  };

  useEffect(() => {
    if (!publishedWithIdString) return;
    publishedWithIdString.split(',').forEach((id) => fetchYoutubeStats(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publishedWithIdString]);

  useEffect(() => {
    if (!renderingString) return;
    const renderingIdsList = renderingString.split(',');

    const interval = setInterval(async () => {
      try {
        const updatedVideos = await Promise.all(
          renderingIdsList.map(async (id) => {
            const res = await fetch(`/api/video?id=${id}`);
            if (res.ok) {
              return await res.json();
            }
            return null;
          })
        );

        const validUpdates = updatedVideos.filter((v): v is VideoRecord => v !== null);
        if (validUpdates.length > 0) {
          setVideos((prev) =>
            prev.map((v) => {
              const match = validUpdates.find((u) => u.id === v.id);
              return match ? match : v;
            })
          );
        }
      } catch (err) {
        console.error('Error polling video progress:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [renderingString, setVideos]);

  const handleTriggerRender = async (id: string, mode: 'resume' | 'fresh' = 'resume') => {
    if (
      mode === 'fresh' &&
      !confirm('Recommencer à zéro va régénérer toutes les scènes (voix, images/vidéos IA), même celles déjà réussies. Continuer ?')
    ) {
      return;
    }

    setRenderingIds((prev) => [...prev, id]);
    setVideos((prev) => prev.map((v) => (v.id === id ? { ...v, status: 'RENDERING' } : v)));

    try {
      const res = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, mode }),
      });

      if (res.ok) {
        const updated = await res.json();
        setVideos((prev) => prev.map((v) => (v.id === id ? updated : v)));
      } else {
        alert('Erreur lors du rendu.');
        setVideos((prev) => prev.map((v) => (v.id === id ? { ...v, status: 'FAILED' } : v)));
      }
    } catch (err) {
      console.error(err);
      setVideos((prev) => prev.map((v) => (v.id === id ? { ...v, status: 'FAILED' } : v)));
    } finally {
      setRenderingIds((prev) => prev.filter((x) => x !== id));
    }
  };

  const handleCancelRender = async (id: string) => {
    if (!confirm('Voulez-vous vraiment annuler le rendu en cours ?')) return;

    try {
      const res = await fetch('/api/render/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setVideos((prev) => prev.map((v) => (v.id === id ? { ...v, status: 'DRAFT', progress: 0, progressStep: null } : v)));
        } else {
          alert("Erreur lors de l'annulation.");
        }
      } else {
        alert("Erreur lors de l'annulation.");
      }
    } catch (err) {
      console.error(err);
      alert("Erreur réseau lors de l'annulation.");
    }
  };

  const handlePublishYoutube = async (id: string) => {
    setPublishingIds((prev) => [...prev, id]);
    try {
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (res.ok) {
        alert('Publication demandée avec succès ! Le workflow n8n a été déclenché.');
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert(`Erreur lors de la publication : ${errorData.error || 'Erreur inconnue'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Erreur réseau lors de la publication.');
    } finally {
      setPublishingIds((prev) => prev.filter((x) => x !== id));
    }
  };

  /**
   * Manual fallback for when the n8n callback that's supposed to set
   * status=PUBLISHED + youtubeId after a real YouTube upload doesn't fire
   * (misconfigured webhook, n8n down, etc.) — lets the user confirm publication
   * by hand instead of the video staying stuck as COMPLETED forever.
   */
  const handleMarkPublished = async (id: string, youtubeId: string) => {
    try {
      const res = await fetch('/api/video', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'PUBLISHED', youtubeId, youtubeStatus: 'PUBLIC' }),
      });
      if (res.ok) {
        const updated = await res.json();
        setVideos((prev) => prev.map((v) => (v.id === id ? updated : v)));
      } else {
        alert('Erreur lors de la mise à jour du statut.');
      }
    } catch (err) {
      console.error(err);
      alert('Erreur réseau.');
    }
  };

  const handleDeleteVideo = async (id: string) => {
    if (!confirm('Voulez-vous supprimer cette vidéo ?')) return;

    try {
      const res = await fetch(`/api/video?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setVideos((prev) => prev.filter((v) => v.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  return {
    renderingIds,
    publishingIds,
    cacheStatus,
    youtubeStats,
    loadingStatsIds,
    fetchYoutubeStats,
    handleTriggerRender,
    handleCancelRender,
    handlePublishYoutube,
    handleMarkPublished,
    handleDeleteVideo,
  };
}
