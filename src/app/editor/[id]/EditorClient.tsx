'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Settings,
  Layers,
  Music,
  Tv,
  Smile,
  AlertCircle,
  CalendarClock
} from 'lucide-react';
import Link from 'next/link';

interface Scene {
  id: number;
  novitaTaskId?: string;
  narration: string;
  subtitle?: string;
  mediaPath?: string | string[];
  mediaPrompt?: string;
  effects?: {
    zoom?: 'in' | 'out' | 'none';
    transition?: 'fade' | 'slide' | 'none' | 'black' | 'wipe' | 'zoomPunch' | 'whipPan' | 'glitchCut' | 'particleDissolve';
    shake?: boolean;
    cameraMotion?: 'orbit' | 'dolly' | 'pan' | 'static';
  };
  card?: {
    text: string;
    subtext?: string;
  };
}

interface Storyboard {
  title: string;
  ratio: '16:9' | '9:16';
  voice?: string;
  subtitles?: boolean;
  subtitleStyle?: 'karaoke' | 'fondant' | 'cinematic';
  music?: string;
  musicVolume?: number;
  youtubeMetadata?: {
    title: string;
    description: string;
    tags?: string[];
  };
  scenes: Scene[];
}

interface VideoRecord {
  id: string;
  title: string;
  topic: string;
  status: string;
  voice: string;
  ratio: string;
  storyboard: any;
  scheduledFor: string | null;
  createdAt: string;
  updatedAt: string;
}

interface EditorClientProps {
  video: VideoRecord;
}

/** Converts an ISO datetime string to the "YYYY-MM-DDTHH:mm" format expected
 *  by <input type="datetime-local">, in the browser's local timezone. */
function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EditorClient({ video }: EditorClientProps) {
  const router = useRouter();
  const [title, setTitle] = useState(video.title);
  const [topic, setTopic] = useState(video.topic);
  const [isSaving, setIsSaving] = useState(false);
  const [scheduledFor, setScheduledFor] = useState(toDatetimeLocalValue(video.scheduledFor));

  // Initialize storyboard with default structure if missing
  const initialStoryboard: Storyboard = {
    title: video.title,
    ratio: (video.ratio as '16:9' | '9:16') || '9:16',
    voice: video.voice || 'george',
    subtitles: true,
    subtitleStyle: 'karaoke',
    music: '',
    musicVolume: 0.09,
    youtubeMetadata: {
      title: '',
      description: '',
      tags: []
    },
    scenes: [],
    ...video.storyboard
  };

  const [storyboard, setStoryboard] = useState<Storyboard>(initialStoryboard);
  const [activeSceneId, setActiveSceneId] = useState<number | null>(
    storyboard.scenes.length > 0 ? storyboard.scenes[0].id : null
  );

  const updateGlobalField = (field: keyof Storyboard, value: any) => {
    setStoryboard(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const updateYoutubeMetadataField = (field: 'title' | 'description' | 'tags', value: any) => {
    setStoryboard(prev => ({
      ...prev,
      youtubeMetadata: {
        title: '',
        description: '',
        tags: [],
        ...prev.youtubeMetadata,
        [field]: value
      }
    }));
  };

  const updateSceneField = (sceneId: number, field: keyof Scene, value: any) => {
    setStoryboard(prev => ({
      ...prev,
      scenes: prev.scenes.map(scene => {
        if (scene.id === sceneId) {
          const updatedScene = { ...scene, [field]: value };
          if (field === 'mediaPrompt' || field === 'narration') {
            delete updatedScene.mediaPath;
            delete updatedScene.novitaTaskId;
          }
          return updatedScene;
        }
        return scene;
      })
    }));
  };

  const updateSceneEffects = (sceneId: number, effectField: string, value: any) => {
    setStoryboard(prev => ({
      ...prev,
      scenes: prev.scenes.map(scene => {
        if (scene.id === sceneId) {
          const effects = scene.effects || {};
          return {
            ...scene,
            effects: {
              ...effects,
              [effectField]: value
            }
          };
        }
        return scene;
      })
    }));
  };

  const addScene = () => {
    const nextId = storyboard.scenes.length > 0 
      ? Math.max(...storyboard.scenes.map(s => s.id)) + 1 
      : 1;
    
    const newScene: Scene = {
      id: nextId,
      narration: 'Nouvelle phrase lue par la voix off.',
      effects: {
        zoom: 'none',
        transition: 'fade',
        cameraMotion: 'static',
        shake: false
      }
    };

    setStoryboard(prev => ({
      ...prev,
      scenes: [...prev.scenes, newScene]
    }));
    setActiveSceneId(nextId);
  };

  const deleteScene = (sceneId: number) => {
    setStoryboard(prev => {
      const filtered = prev.scenes.filter(s => s.id !== sceneId);
      // Re-index scenes sequentially
      const reindexed = filtered.map((s, idx) => ({
        ...s,
        id: idx + 1
      }));
      return {
        ...prev,
        scenes: reindexed
      };
    });
    setActiveSceneId(null);
  };

  const moveScene = (index: number, direction: 'up' | 'down') => {
    const newScenes = [...storyboard.scenes];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIdx < 0 || targetIdx >= newScenes.length) return;

    // Swap scenes
    const temp = newScenes[index];
    newScenes[index] = newScenes[targetIdx];
    newScenes[targetIdx] = temp;

    // Re-assign IDs sequentially to maintain order
    const updated = newScenes.map((s, idx) => ({
      ...s,
      id: idx + 1
    }));

    setStoryboard(prev => ({
      ...prev,
      scenes: updated
    }));
    setActiveSceneId(updated[targetIdx].id);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/video', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: video.id,
          title,
          topic,
          voice: storyboard.voice,
          ratio: storyboard.ratio,
          storyboard: storyboard,
          scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : null,
        }),
      });

      if (res.ok) {
        router.push('/');
        router.refresh();
      } else {
        alert('Erreur lors de la sauvegarde.');
      }
    } catch (err) {
      console.error(err);
      alert('Erreur de connexion réseau.');
    } finally {
      setIsSaving(false);
    }
  };

  const activeScene = storyboard.scenes.find(s => s.id === activeSceneId);

  return (
    <div className="relative min-h-screen p-6 md:p-12 max-w-7xl mx-auto z-10">
      {/* Glow */}
      <div className="absolute top-0 left-10 w-96 h-96 bg-purple-600/5 rounded-full blur-3xl animate-pulse-slow -z-10" />

      {/* Header */}
      <header className="flex justify-between items-center mb-8 border-b border-zinc-800 pb-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="p-2.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white rounded-xl transition-all">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <input 
                type="text" 
                value={title} 
                onChange={(e) => setTitle(e.target.value)} 
                className="bg-transparent text-2xl font-bold text-white border-b border-transparent hover:border-zinc-700 focus:border-purple-500 focus:outline-none px-1"
              />
            </div>
            <p className="text-xs text-zinc-500 mt-1">Sujet original : {topic}</p>
          </div>
        </div>

        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-medium shadow-lg shadow-purple-500/20 transition-all duration-200"
        >
          {isSaving ? 'Sauvegarde...' : <><Save className="w-5 h-5" /> Enregistrer</>}
        </button>
      </header>

      {/* Configuration Globale */}
      <section className="glass p-6 rounded-2xl border border-zinc-800 mb-8 grid grid-cols-1 md:grid-cols-4 gap-6">
        <div>
          <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Smile className="w-4 h-4 text-purple-400" /> Voix Off (ElevenLabs)
          </label>
          <select 
            value={storyboard.voice || 'george'} 
            onChange={(e) => updateGlobalField('voice', e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 focus:border-purple-500 rounded-xl px-3 py-2.5 text-sm text-white"
          >
            <option value="george">George (Voix grave - Anglais/Français)</option>
            <option value="anais">Anais (Voix douce - Français)</option>
            <option value="liam">Liam (Voix énergique - Anglais)</option>
            <option value="rachel">Rachel (Voix narrative - Anglais)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Tv className="w-4 h-4 text-purple-400" /> Format Vidéo
          </label>
          <select 
            value={storyboard.ratio} 
            onChange={(e) => updateGlobalField('ratio', e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 focus:border-purple-500 rounded-xl px-3 py-2.5 text-sm text-white"
          >
            <option value="9:16">Short / Mobile (9:16)</option>
            <option value="16:9">Paysage / YouTube (16:9)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Music className="w-4 h-4 text-purple-400" /> Musique de fond
          </label>
          <input 
            type="text" 
            value={storyboard.music || ''} 
            onChange={(e) => updateGlobalField('music', e.target.value)}
            placeholder="music.mp3"
            className="w-full bg-zinc-900 border border-zinc-800 focus:border-purple-500 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            Volume Musique ({(storyboard.musicVolume || 0).toFixed(2)})
          </label>
          <input 
            type="range" 
            min="0" 
            max="0.5" 
            step="0.01" 
            value={storyboard.musicVolume || 0.09} 
            onChange={(e) => updateGlobalField('musicVolume', parseFloat(e.target.value))}
            className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-500 mt-3"
          />
        </div>
      </section>

      {/* YouTube Metadata */}
      <section className="glass p-6 rounded-2xl border border-zinc-800 mb-8">
        <h3 className="text-md font-bold text-white mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-purple-400" /> Métadonnées YouTube SEO
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                Titre Vidéo (YouTube SEO)
              </label>
              <input 
                type="text" 
                value={storyboard.youtubeMetadata?.title || ''} 
                onChange={(e) => updateYoutubeMetadataField('title', e.target.value)}
                placeholder="Titre accrocheur..."
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-purple-500 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
                Tags (séparés par des virgules)
              </label>
              <input 
                type="text" 
                value={(storyboard.youtubeMetadata?.tags || []).join(', ')} 
                onChange={(e) => {
                  const tagsArray = e.target.value.split(',').map(t => t.trim()).filter(Boolean);
                  updateYoutubeMetadataField('tags', tagsArray);
                }}
                placeholder="Exemple: python, dev, IA..."
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-purple-500 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
              Description de la vidéo
            </label>
            <textarea
              value={storyboard.youtubeMetadata?.description || ''}
              onChange={(e) => updateYoutubeMetadataField('description', e.target.value)}
              rows={4}
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-purple-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 resize-y"
              placeholder="Description optimisée pour YouTube..."
            />
          </div>
        </div>
      </section>

      {/* Scheduled Publication */}
      <section className="glass p-6 rounded-2xl border border-zinc-800 mb-8">
        <h3 className="text-md font-bold text-white mb-4 flex items-center gap-2">
          <CalendarClock className="w-5 h-5 text-purple-400" /> Publication programmée
        </h3>
        <div className="flex flex-col md:flex-row md:items-end gap-4">
          <div className="flex-1 max-w-xs">
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">
              Date et heure de publication
            </label>
            <input
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-purple-500 rounded-xl px-4 py-2.5 text-sm text-white [color-scheme:dark]"
            />
          </div>
          {scheduledFor && (
            <button
              type="button"
              onClick={() => setScheduledFor('')}
              className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-semibold rounded-xl border border-zinc-800 transition-colors"
            >
              Annuler la programmation
            </button>
          )}
          <p className="text-xs text-zinc-500 md:max-w-xs">
            Une fois la vidéo rendue (statut « Rendu terminé »), elle sera publiée automatiquement sur YouTube à cette date.
          </p>
        </div>
      </section>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar Scene Navigator */}
        <aside className="lg:col-span-4 glass p-6 rounded-2xl border border-zinc-800 flex flex-col h-[500px]">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-md font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-purple-400" /> Scènes ({storyboard.scenes.length})
            </h3>
            <button 
              onClick={addScene}
              className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Ajouter
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {storyboard.scenes.map((scene, index) => (
              <div 
                key={scene.id}
                onClick={() => setActiveSceneId(scene.id)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                  activeSceneId === scene.id 
                    ? 'bg-purple-600/10 border-purple-500 text-white' 
                    : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 text-zinc-400'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs font-bold bg-zinc-800 px-2 py-1 rounded text-zinc-300">#{scene.id}</span>
                  <span className="text-xs font-medium truncate min-w-0 pr-2">{scene.narration}</span>
                </div>

                <div className="flex gap-1 items-center shrink-0">
                  <button 
                    onClick={(e) => { e.stopPropagation(); moveScene(index, 'up'); }}
                    disabled={index === 0}
                    className="p-1 hover:bg-zinc-800 text-zinc-500 hover:text-white rounded disabled:opacity-30"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); moveScene(index, 'down'); }}
                    disabled={index === storyboard.scenes.length - 1}
                    className="p-1 hover:bg-zinc-800 text-zinc-500 hover:text-white rounded disabled:opacity-30"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); deleteScene(scene.id); }}
                    className="p-1 hover:bg-red-950 text-zinc-500 hover:text-red-400 rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Scene Editor Form */}
        <main className="lg:col-span-8 glass p-6 md:p-8 rounded-2xl border border-zinc-800 min-h-[500px]">
          {activeScene ? (
            <div className="space-y-6">
              <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
                <h3 className="text-lg font-bold text-white">Édition Scène #{activeScene.id}</h3>
                <span className="text-xs text-zinc-500">ID Unique: {activeScene.id}</span>
              </div>

              {/* Narration & Visual Prompt Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Narration (Edge-TTS)</label>
                  <textarea 
                    value={activeScene.narration} 
                    onChange={(e) => updateSceneField(activeScene.id, 'narration', e.target.value)}
                    rows={4}
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-purple-500 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 resize-y"
                    placeholder="Saisissez la voix off de la scène..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Prompt Visuel (Seedance 1.5 Pro)</label>
                  <textarea 
                    value={activeScene.mediaPrompt || ''} 
                    onChange={(e) => updateSceneField(activeScene.id, 'mediaPrompt', e.target.value)}
                    rows={4}
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-purple-500 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 resize-y"
                    placeholder="Saisissez le prompt descriptif en anglais pour générer la vidéo..."
                  />
                </div>
              </div>

              {/* Media Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Chemin Média (public/)</label>
                  <input 
                    type="text" 
                    value={activeScene.mediaPath as string || ''} 
                    onChange={(e) => updateSceneField(activeScene.id, 'mediaPath', e.target.value)}
                    placeholder="scene_1.png"
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-purple-500 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-600"
                  />
                  <p className="text-[10px] text-zinc-500 mt-1">Exemple: images/space.jpg ou videos/waves.mp4</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Zoom</label>
                  <select 
                    value={activeScene.effects?.zoom || 'none'} 
                    onChange={(e) => updateSceneEffects(activeScene.id, 'zoom', e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-purple-500 rounded-xl px-3 py-2.5 text-sm text-white"
                  >
                    <option value="none">Aucun (Fixe)</option>
                    <option value="in">Ken Burns In (Zoom avant lent)</option>
                    <option value="out">Ken Burns Out (Zoom arrière lent)</option>
                  </select>
                </div>
              </div>

              {/* Camera & Motion */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Transition Entrée</label>
                  <select 
                    value={activeScene.effects?.transition || 'fade'} 
                    onChange={(e) => updateSceneEffects(activeScene.id, 'transition', e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-purple-500 rounded-xl px-3 py-2.5 text-sm text-white"
                  >
                    <option value="none">Pas de transition</option>
                    <option value="fade">Fondu (Fade)</option>
                    <option value="slide">Glissement (Slide)</option>
                    <option value="black">Transition au noir</option>
                    <option value="wipe">Balayage (Wipe)</option>
                    <option value="zoomPunch">Zoom Punch</option>
                    <option value="whipPan">Whip Pan</option>
                    <option value="glitchCut">Glitch Cut</option>
                    <option value="particleDissolve">Dissolution de Particules</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Mouvement Caméra (Prompt IA)</label>
                  <select 
                    value={activeScene.effects?.cameraMotion || 'static'} 
                    onChange={(e) => updateSceneEffects(activeScene.id, 'cameraMotion', e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-purple-500 rounded-xl px-3 py-2.5 text-sm text-white"
                  >
                    <option value="static">Plan Fixe (Static)</option>
                    <option value="orbit">Orbite (Caméra tournante)</option>
                    <option value="dolly">Travelling (Travelling avant/arrière)</option>
                    <option value="pan">Panoramique (Pan horizontal)</option>
                  </select>
                </div>

                <div className="flex items-center pt-6">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-zinc-300">
                    <input 
                      type="checkbox"
                      checked={activeScene.effects?.shake || false}
                      onChange={(e) => updateSceneEffects(activeScene.id, 'shake', e.target.checked)}
                      className="w-4 h-4 bg-zinc-900 border-zinc-800 text-purple-600 rounded focus:ring-purple-500"
                    />
                    Tremblement caméra (Shake)
                  </label>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <AlertCircle className="w-12 h-12 text-zinc-600 mb-3" />
              <h3 className="text-lg font-medium text-white mb-1">Aucune scène sélectionnée</h3>
              <p className="text-sm text-zinc-400 max-w-sm">
                Sélectionnez une scène dans la liste de gauche ou cliquez sur "Ajouter" pour créer une nouvelle scène.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
