import React, { useMemo, useState } from 'react';
import { Bot, Send, Sparkles, ShieldCheck, BookOpen, MessageCircle } from 'lucide-react';
import { assistantAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

function CustomerAssistant() {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hi, I’m your HALOmed assistant. Ask me about medicines, cart, checkout, orders, prescriptions, or delivery tracking.',
      groundednessScore: 92,
      groundednessLabel: 'high',
      sources: [],
      matchedTopics: ['customer', 'orders', 'checkout'],
    },
  ]);

  const history = useMemo(
    () => messages.map((entry) => ({ role: entry.role, content: entry.content })),
    [messages]
  );

  const handleSend = async (event) => {
    event.preventDefault();

    const trimmed = message.trim();
    if (!trimmed || loading) {
      return;
    }

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
    };

    setMessages((current) => [...current, userMessage]);
    setMessage('');
    setLoading(true);

    try {
      const response = await assistantAPI.chat({
        message: trimmed,
        history,
      });

      const payload = response.data || {};
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: payload.answer || 'I could not generate an answer.',
          groundednessScore: payload.groundednessScore ?? 0,
          groundednessLabel: payload.groundednessLabel || 'unknown',
          responseMode: payload.responseMode || 'app_help',
          sources: payload.sources || [],
          matchedTopics: payload.matchedTopics || [],
        },
      ]);
    } catch (error) {
      console.error('Assistant request failed:', error);
      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          content: error?.message || 'The assistant could not answer right now.',
          groundednessScore: 0,
          groundednessLabel: 'very low',
          responseMode: 'app_help',
          sources: [],
          matchedTopics: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const confidenceBadge = (score) => {
    if (score >= 80) return 'bg-green-100 text-green-800 border-green-200';
    if (score >= 55) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (score >= 30) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  return (
    <div className="space-y-8">
      <div className="rounded-3xl bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-800 text-white p-8 shadow-xl overflow-hidden relative">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.35),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(59,130,246,0.35),_transparent_25%)]" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm">
              <Sparkles size={16} />
              Customer support
            </div>
            <div>
              <h1 className="text-4xl font-bold">HALOmed Assistant</h1>
              <p className="mt-3 text-white/80 text-base leading-7">
                Ask questions about medicines, cart, checkout, orders, prescriptions, and delivery tracking.
                Every answer comes with a confidence label so you can judge how closely it matches HALOmed guidance.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 min-w-[280px]">
            <div className="rounded-2xl bg-white/10 border border-white/10 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-wider text-white/60">Role</p>
              <p className="text-lg font-semibold mt-1 capitalize">{user?.role || 'customer'}</p>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/10 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-wider text-white/60">Style</p>
              <p className="text-lg font-semibold mt-1">Guided</p>
            </div>
            <div className="rounded-2xl bg-white/10 border border-white/10 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-wider text-white/60">Safety</p>
              <p className="text-lg font-semibold mt-1 flex items-center gap-2">
                <ShieldCheck size={18} />
                Grounded
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.9fr)] gap-6">
        <div className="card flex flex-col min-h-[640px]">
          <div className="flex items-center gap-2 mb-4">
            <MessageCircle className="text-primary" size={20} />
            <h2 className="text-xl font-semibold">Chat</h2>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto pr-1">
            {messages.map((entry) => (
              <div
                key={entry.id}
                className={`flex ${entry.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-4 py-3 shadow-sm border ${
                    entry.role === 'user'
                      ? 'bg-primary text-white border-primary/20'
                      : 'bg-slate-50 text-slate-800 border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {entry.role === 'user' ? (
                      <span className="text-xs uppercase tracking-wider opacity-80">You</span>
                    ) : (
                      <span className="text-xs uppercase tracking-wider text-primary">Assistant</span>
                    )}
                    {entry.role === 'assistant' && entry.groundednessScore !== undefined && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[11px] font-semibold px-2 py-1 rounded-full border ${confidenceBadge(entry.groundednessScore)}`}>
                          Confidence {entry.groundednessScore}%
                        </span>
                        {entry.responseMode === 'medical_guidance' && (
                          <span className="text-[11px] font-semibold px-2 py-1 rounded-full border border-amber-200 bg-amber-50 text-amber-800">
                            Health guidance
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap leading-7">{entry.content}</p>

                  {entry.role === 'assistant' && entry.matchedTopics?.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {entry.matchedTopics.map((topic) => (
                        <span key={topic} className="text-xs bg-white/70 text-slate-700 px-2 py-1 rounded-full border border-slate-200">
                          {topic}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl px-4 py-3 bg-slate-50 text-slate-700 border border-slate-200 shadow-sm">
                  Thinking with the knowledge base...
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSend} className="mt-5 flex flex-col gap-3 border-t border-slate-200 pt-4">
            <textarea
              className="input-field min-h-[120px] resize-y"
              placeholder="Ask about orders, delivery tracking, checkout, prescriptions, or medicines..."
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm text-gray-500 flex items-center gap-2">
                <BookOpen size={16} />
                Answers are based on HALOmed guidance.
              </p>
              <button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={loading || !message.trim()}>
                <Send size={16} />
                {loading ? 'Sending...' : 'Send'}
              </button>
            </div>
          </form>
        </div>

        <div className="space-y-6">
          <div className="card">
            <h2 className="text-xl font-semibold mb-3">How it works</h2>
            <div className="space-y-3 text-sm text-gray-600 leading-6">
              <p>1. Ask a question in plain language.</p>
              <p>2. The assistant finds the most relevant HALOmed guidance.</p>
              <p>3. It answers with a confidence label.</p>
              <p>4. If the confidence is low, treat the response as tentative.</p>
            </div>
          </div>

          <div className="card">
            <h2 className="text-xl font-semibold mb-3">Best questions to try</h2>
            <div className="flex flex-wrap gap-2">
              {[
                'How do I track my order?',
                'How does checkout work?',
                'How do I confirm an order was received?',
                'Where can I browse medicines?',
                'What does the status assigned mean?',
                'I have fever and headache - what medicine category fits?',
                'Can this medicine help my cough and for how long should I take it?',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="text-sm px-3 py-2 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-left"
                  onClick={() => setMessage(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <h2 className="text-xl font-semibold mb-3">Confidence</h2>
            <p className="text-sm text-gray-600 leading-6">
              The confidence level tells you how closely the answer matches HALOmed guidance. Higher values mean the answer is more directly supported by the app's verified information.
            </p>
          </div>

          <div className="card">
            <h2 className="text-xl font-semibold mb-3">Disclaimer</h2>
            <p className="text-sm text-gray-600 leading-6">
              This assistant is designed for HALOmed usage questions, not medical diagnosis or emergency advice.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CustomerAssistant;
