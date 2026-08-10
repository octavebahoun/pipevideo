'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Send, Loader2, Sparkles } from 'lucide-react';

export default function CreateIdeaButton() {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [topic, setTopic] = useState('');
  const [title, setTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        setIsModalOpen(false);
        setTopic('');
        setTitle('');
        router.refresh();
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

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="flex items-center gap-2 px-5 py-2.5 btn-glossy-red text-white rounded-xl font-medium"
      >
        <Plus className="w-5 h-5" /> Nouvelle Idée
      </button>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass p-6 md:p-8 rounded-3xl w-full max-w-md shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-zinc-900 mb-2 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-red-500" /> Planifier un Short
            </h3>
            <p className="text-sm text-zinc-500 mb-6">Saisissez l'idée pour que l'IA commence la rédaction et recherche web.</p>

            <form onSubmit={handleCreateIdea} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Titre du Short</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="ex: Le mystère de l'anaconda géant"
                  required
                  className="w-full bg-white border border-zinc-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 rounded-xl px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Sujet détaillé (Prompt n8n)</label>
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="ex: L'anaconda en Amazonie, sa taille géante, les mythes de serpent géant..."
                  required
                  rows={3}
                  className="w-full bg-white border border-zinc-200 focus:border-red-500 focus:ring-1 focus:ring-red-500 rounded-xl px-4 py-3 text-sm text-zinc-900 placeholder-zinc-400 transition-colors"
                />
              </div>

              <div className="flex gap-3 mt-6 pt-4 border-t border-zinc-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 text-sm font-semibold rounded-xl transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 flex items-center justify-center gap-2 py-3 btn-glossy-red disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Envoyer</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
