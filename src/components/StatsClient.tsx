'use client';

import { useState, useEffect } from 'react';
import { Download, RefreshCw, Eye, ThumbsUp, MessageCircle, BarChart3 } from 'lucide-react';

interface StatsVideo {
  id: string;
  title: string;
  youtubeId: string;
  createdAt: string;
}

interface StatsRow extends StatsVideo {
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
  loading: boolean;
}

function toCsv(rows: StatsRow[]): string {
  const header = ['Titre', 'ID YouTube', 'Vues', 'Likes', 'Commentaires', 'Date de création'];
  const lines = rows.map((r) =>
    [
      `"${r.title.replace(/"/g, '""')}"`,
      r.youtubeId,
      r.viewCount ?? '',
      r.likeCount ?? '',
      r.commentCount ?? '',
      new Date(r.createdAt).toLocaleDateString('fr-FR'),
    ].join(',')
  );
  return [header.join(','), ...lines].join('\n');
}

export default function StatsClient({ videos }: { videos: StatsVideo[] }) {
  const [rows, setRows] = useState<StatsRow[]>(videos.map((v) => ({ ...v, viewCount: null, likeCount: null, commentCount: null, loading: true })));

  const fetchStatsFor = async (id: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, loading: true } : r)));
    try {
      const res = await fetch(`/api/youtube/stats?id=${id}`);
      if (res.ok) {
        const data = await res.json();
        setRows((prev) =>
          prev.map((r) =>
            r.id === id ? { ...r, viewCount: data.viewCount, likeCount: data.likeCount, commentCount: data.commentCount, loading: false } : r
          )
        );
      } else {
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, loading: false } : r)));
      }
    } catch {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, loading: false } : r)));
    }
  };

  useEffect(() => {
    videos.forEach((v) => fetchStatsFor(v.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExportCsv = () => {
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stats-youtube-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (videos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center glass rounded-3xl">
        <BarChart3 className="w-16 h-16 text-zinc-300 mb-4" />
        <h3 className="text-lg font-medium text-zinc-900 mb-1">Aucune statistique disponible</h3>
        <p className="text-sm text-zinc-500 max-w-sm">Les statistiques apparaissent ici une fois vos vidéos publiées sur YouTube.</p>
      </div>
    );
  }

  return (
    <div className="glass rounded-3xl overflow-hidden">
      <div className="flex justify-end p-4 border-b border-zinc-200">
        <button
          onClick={handleExportCsv}
          className="flex items-center gap-2 px-4 py-2 btn-glossy-red text-white text-sm font-semibold rounded-xl transition-all"
        >
          <Download className="w-4 h-4" /> Exporter en CSV
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-zinc-500 border-b border-zinc-200 uppercase text-xs tracking-wider">
              <th className="px-6 py-3">Titre</th>
              <th className="px-6 py-3"><Eye className="w-3.5 h-3.5 inline mr-1" /> Vues</th>
              <th className="px-6 py-3"><ThumbsUp className="w-3.5 h-3.5 inline mr-1" /> Likes</th>
              <th className="px-6 py-3"><MessageCircle className="w-3.5 h-3.5 inline mr-1" /> Commentaires</th>
              <th className="px-6 py-3">Publiée le</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-zinc-100 hover:bg-zinc-50 transition-colors">
                <td className="px-6 py-4 text-zinc-900 font-medium max-w-xs truncate">{r.title}</td>
                <td className="px-6 py-4 text-zinc-600">{r.loading ? '...' : r.viewCount?.toLocaleString('fr-FR') ?? '—'}</td>
                <td className="px-6 py-4 text-zinc-600">{r.loading ? '...' : r.likeCount?.toLocaleString('fr-FR') ?? '—'}</td>
                <td className="px-6 py-4 text-zinc-600">{r.loading ? '...' : r.commentCount?.toLocaleString('fr-FR') ?? '—'}</td>
                <td className="px-6 py-4 text-zinc-400">{new Date(r.createdAt).toLocaleDateString('fr-FR')}</td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => fetchStatsFor(r.id)}
                    disabled={r.loading}
                    className="text-zinc-400 hover:text-zinc-600 p-1 rounded-lg hover:bg-zinc-100 transition-colors"
                    title="Rafraîchir"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${r.loading ? 'animate-spin' : ''}`} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
