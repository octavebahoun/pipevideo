'use client';

import { useState } from 'react';
import { Sparkles, X, Send, Loader2 } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AIAssistantProps {
  /** Optional: scopes the assistant's context to one video's storyboard. */
  videoId?: string;
}

export default function AIAssistant({ videoId }: AIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSend = async () => {
    if (!question.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: question };
    setMessages((prev) => [...prev, userMessage]);
    setQuestion('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userMessage.content, videoId }),
      });
      const data = await res.json();

      if (res.ok) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.answer }]);
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: `Erreur : ${data.error || 'inconnue'}` }]);
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Erreur réseau, réessaie.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] h-[480px] glass rounded-2xl shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200">
            <div className="flex items-center gap-2 text-zinc-900 font-semibold text-sm">
              <Sparkles className="w-4 h-4 text-red-500" /> Assistant IA
            </div>
            <button onClick={() => setIsOpen(false)} className="text-zinc-400 hover:text-zinc-900 p-1 rounded-lg hover:bg-zinc-100 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <p className="text-xs text-zinc-400 text-center mt-8">
                Posez une question libre sur la création vidéo, ou sur cette vidéo précisément si vous êtes dans l'éditeur.
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`text-sm rounded-xl px-3 py-2 max-w-[85%] whitespace-pre-line ${
                  m.role === 'user' ? 'bg-red-50 text-red-700 ml-auto' : 'bg-zinc-100 text-zinc-700'
                }`}
              >
                {m.content}
              </div>
            ))}
            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Réflexion en cours...
              </div>
            )}
          </div>

          <div className="p-3 border-t border-zinc-200 flex items-center gap-2">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Posez votre question..."
              className="flex-1 bg-white border border-zinc-200 focus:border-red-500 rounded-xl px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 outline-none"
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !question.trim()}
              className="p-2 btn-glossy-red disabled:opacity-50 text-white rounded-xl transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 btn-glossy-red text-white rounded-full flex items-center justify-center transition-all"
        title="Assistant IA"
      >
        <Sparkles className="w-6 h-6" />
      </button>
    </>
  );
}
