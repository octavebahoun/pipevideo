'use client';

import { useState } from 'react';
import { 
  Video as VideoIcon, 
  Play, 
  Edit3, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Plus, 
  Send,
  Trash2,
  Film,
  Sparkles,
  Loader2,
  Tv
} from 'lucide-react';
import Link from 'next/link';

interface VideoRecord {
  id: string;
  title: string;
  topic: string;
  status: string;
  voice: string;
  ratio: string;
  storyboard: any;
  videoPath: string | null;
  youtubeId: string | null;
  youtubeStatus: string | null;
  scheduledFor: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DashboardClientProps {
  initialVideos: VideoRecord[];
}

export default function DashboardClient({ initialVideos }: DashboardClientProps) {
  const [videos, setVideos] = useState<VideoRecord[]>(initialVideos);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [topic, setTopic] = useState('');
  const [title, setTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [renderingIds, setRenderingIds] = useState<string[]>([]);
  const [publishingIds, setPublishingIds] = useState<string[]>([]);

  // Stats calculation
  const totalVideos = videos.length;
  const completedVideos = videos.filter(v => v.status === 'COMPLETED' || v.status === 'PUBLISHED').length;
  const renderingVideos = videos.filter(v => v.status === 'RENDERING').length;
  const draftVideos = videos.filter(v => v.status === 'DRAFT' || v.status === 'SCRIPTED').length;

  const handleCreateIdea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic || !title) return;

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/webhook/idea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, title }),
      });

      if (res.ok) {
        const newVideo = await res.json();
        setVideos([newVideo, ...videos]);
        setIsModalOpen(false);
        setTopic('');
        setTitle('');
      } else {
        alert("Erreur lors de la création de l'idée.");
      }
    } catch (err) {
      console.error(err);
      alert('Erreur réseau.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTriggerRender = async (id: string) => {
    setRenderingIds(prev => [...prev, id]);
    // Optimistically update status
    setVideos(prev => prev.map(v => v.id === id ? { ...v, status: 'RENDERING' } : v));

    try {
      const res = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (res.ok) {
        const updated = await res.json();
        setVideos(prev => prev.map(v => v.id === id ? updated : v));
      } else {
        alert('Erreur lors du rendu.');
        setVideos(prev => prev.map(v => v.id === id ? { ...v, status: 'FAILED' } : v));
      }
    } catch (err) {
      console.error(err);
      setVideos(prev => prev.map(v => v.id === id ? { ...v, status: 'FAILED' } : v));
    } finally {
      setRenderingIds(prev => prev.filter(x => x !== id));
    }
  };

  const handlePublishYoutube = async (id: string) => {
    setPublishingIds(prev => [...prev, id]);
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
      setPublishingIds(prev => prev.filter(x => x !== id));
    }
  };

  const handleDeleteVideo = async (id: string) => {
    if (!confirm('Voulez-vous supprimer cette vidéo ?')) return;

    try {
      const res = await fetch(`/api/video?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setVideos(prev => prev.filter(v => v.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getStatusBadge = (status: string) => {
    const base = "px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 w-fit ";
    switch (status) {
      case 'DRAFT':
        return <span className={base + "bg-zinc-800/80 text-zinc-300 border border-zinc-700"}><Clock className="w-3.5 h-3.5" /> Brouillon</span>;
      case 'SCRIPTED':
        return <span className={base + "bg-blue-950/80 text-blue-300 border border-blue-800"}><Sparkles className="w-3.5 h-3.5" /> Scénarisé</span>;
      case 'RENDERING':
        return <span className={base + "bg-yellow-950/80 text-yellow-300 border border-yellow-800 animate-pulse"}><Loader2 className="w-3.5 h-3.5 animate-spin" /> Rendu en cours</span>;
      case 'COMPLETED':
        return <span className={base + "bg-emerald-950/80 text-emerald-300 border border-emerald-800"}><CheckCircle2 className="w-3.5 h-3.5" /> Rendu terminé</span>;
      case 'PUBLISHED':
        return <span className={base + "bg-purple-950/80 text-purple-300 border border-purple-800"}><Tv className="w-3.5 h-3.5" /> Publié</span>;
      case 'FAILED':
        return <span className={base + "bg-red-950/80 text-red-300 border border-red-800"}><AlertCircle className="w-3.5 h-3.5" /> Échec</span>;
      default:
        return <span className={base + "bg-zinc-800 text-zinc-300"}>{status}</span>;
    }
  };

  return (
    <div className="relative min-h-screen p-6 md:p-12 max-w-7xl mx-auto z-10">
      {/* Background Glow */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse-slow -z-10" />
      <div className="absolute bottom-10 left-10 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl animate-pulse-slow -z-10" />

      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-12">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent text-glow">
            Content Factory
          </h1>
          <p className="text-sm text-zinc-400 mt-1">Orchestrateur & Back-office de production vidéo automatisée</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-medium shadow-lg shadow-purple-500/20 transition-all duration-200 hover:-translate-y-0.5"
        >
          <Plus className="w-5 h-5" /> Nouvelle Idée
        </button>
      </header>

      {/* Stats Grid */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
        {[
          { label: 'Total Vidéos', value: totalVideos, icon: VideoIcon, color: 'text-purple-400' },
          { label: 'Rendus Terminés', value: completedVideos, icon: CheckCircle2, color: 'text-emerald-400' },
          { label: 'En cours', value: renderingVideos, icon: Loader2, color: 'text-yellow-400' },
          { label: 'Brouillons / Scripts', value: draftVideos, icon: Clock, color: 'text-blue-400' },
        ].map((stat, i) => (
          <div key={i} className="glass p-5 rounded-2xl border border-zinc-800 flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-400 uppercase font-bold tracking-wider">{stat.label}</p>
              <p className="text-3xl font-bold mt-1 text-white">{stat.value}</p>
            </div>
            <stat.icon className={`w-8 h-8 ${stat.color} opacity-80`} />
          </div>
        ))}
      </section>

      {/* Videos List Section */}
      <main className="glass p-6 md:p-8 rounded-3xl border border-zinc-800">
        <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
          <Film className="w-5 h-5 text-purple-400" /> Flux de production
        </h2>

        {videos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <VideoIcon className="w-16 h-16 text-zinc-600 mb-4 animate-bounce" />
            <h3 className="text-lg font-medium text-white mb-1">Aucune vidéo pour le moment</h3>
            <p className="text-sm text-zinc-400 max-w-sm mb-6">
              Commencez par ajouter une nouvelle idée de vidéo pour démarrer le pipeline automatisé.
            </p>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm transition-colors border border-zinc-700"
            >
              Créer une idée
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map((video) => (
              <div key={video.id} className="glass glass-hover p-6 rounded-2xl border border-zinc-800 flex flex-col justify-between h-[280px]">
                <div>
                  <div className="flex justify-between items-start gap-2 mb-3">
                    {getStatusBadge(video.status)}
                    <button 
                      onClick={() => handleDeleteVideo(video.id)}
                      className="text-zinc-500 hover:text-red-400 p-1 rounded-lg hover:bg-red-500/10 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <h3 className="text-lg font-bold text-white line-clamp-1 mb-1">{video.title}</h3>
                  <p className="text-sm text-zinc-400 line-clamp-2 mb-4">Sujet : {video.topic}</p>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <Link 
                      href={`/editor/${video.id}`}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold rounded-xl border border-zinc-700 transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Éditer Storyboard
                    </Link>

                    {video.status === 'COMPLETED' && video.videoPath && (
                      <a 
                        href={`/${video.videoPath}`} 
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center p-2 bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-800 rounded-xl transition-colors"
                        title="Visionner la vidéo"
                      >
                        <Play className="w-4 h-4" />
                      </a>
                    )}
                  </div>

                  {(video.status === 'SCRIPTED' || video.status === 'DRAFT' || video.status === 'FAILED') && (
                    <button 
                      onClick={() => handleTriggerRender(video.id)}
                      disabled={renderingIds.includes(video.id)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-purple-500/10"
                    >
                      {renderingIds.includes(video.id) ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Rendu en cours...
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5" /> Lancer le Rendu
                        </>
                      )}
                    </button>
                  )}

                  {video.status === 'COMPLETED' && (
                    <button 
                      onClick={() => handlePublishYoutube(video.id)}
                      disabled={publishingIds.includes(video.id)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 disabled:from-red-800 disabled:to-red-950 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-red-500/10"
                    >
                      {publishingIds.includes(video.id) ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Publication...
                        </>
                      ) : (
                        <>
                          <Tv className="w-3.5 h-3.5" /> Publier sur YouTube
                        </>
                      )}
                    </button>
                  )}

                  {(video.status === 'PUBLISHED' || video.youtubeId) && (
                    <a
                      href={`https://youtube.com/watch?v=${video.youtubeId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-xl transition-all border border-zinc-700"
                    >
                      <Tv className="w-3.5 h-3.5 text-red-500" /> Voir sur YouTube ({video.youtubeStatus || 'PUBLIC'})
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal - Create Idea */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass p-6 md:p-8 rounded-3xl border border-zinc-800 w-full max-w-md shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-400" /> Planifier un Short
            </h3>
            <p className="text-sm text-zinc-400 mb-6">Saisissez l'idée pour que l'IA commence la rédaction et recherche web.</p>

            <form onSubmit={handleCreateIdea} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Titre du Short</label>
                <input 
                  type="text" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="ex: Le mystère de l'anaconda géant"
                  required
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Sujet détaillé (Prompt n8n)</label>
                <textarea 
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="ex: L'anaconda en Amazonie, sa taille géante, les mythes de serpent géant..."
                  required
                  rows={3}
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-500 transition-colors"
                />
              </div>

              <div className="flex gap-3 mt-6 pt-4 border-t border-zinc-900">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-sm font-semibold rounded-xl border border-zinc-800 transition-colors"
                >
                  Annuler
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-purple-500/20"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4" /> Envoyer
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
