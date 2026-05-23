import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  X, 
  Send, 
  Brain, 
  Sparkles, 
  ChevronDown, 
  User, 
  Bot,
  MapPin,
  RefreshCcw
} from 'lucide-react';

const ShepherdCopilot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Bonjour ! Je suis ShepherdAI. Comment puis-je vous aider avec votre troupeau aujourd\'hui ?' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await fetch('/api/copilot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: [...messages, userMessage],
          context: {
            totalAnimals: 200,
            alertCount: 12,
            offlineDevices: 3,
            userName: 'Benoît',
            tenantName: 'Bergerie des Alpes'
          }
        })
      });

      if (!response.ok) throw new Error('Copilot error');

      // Simple streaming simulation (replace with real stream reader if backend supports it)
      const data = await response.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
      
      // Handle custom events (like fly-to) if returned in metadata
      if (data.metadata?.flyTo) {
        window.dispatchEvent(new CustomEvent('copilot:fly-to', { 
          detail: { animalId: data.metadata.flyTo } 
        }));
      }

    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Désolé, j'ai rencontré un problème technique. Réessayez dans un instant." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 w-16 h-16 rounded-2xl bg-primary text-white shadow-2xl shadow-primary/40 flex items-center justify-center transition-all hover:scale-110 active:scale-95 z-50 ${isOpen ? 'opacity-0 scale-0' : 'opacity-100 scale-100'}`}
      >
        <Sparkles className="w-8 h-8 animate-pulse" />
      </button>

      {/* Chat Drawer */}
      <div className={`fixed inset-y-0 right-0 w-[400px] bg-white dark:bg-gray-900 shadow-[-20px_0_60px_rgba(0,0,0,0.1)] z-50 transition-transform duration-500 ease-in-out transform ${isOpen ? 'translate-x-0' : 'translate-x-full'} flex flex-col`}>
        {/* Header */}
        <div className="p-6 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-r from-primary/5 to-transparent flex items-center justify-between">
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                 <Brain className="w-6 h-6" />
              </div>
              <div>
                 <h3 className="label-sm text-gray-900 dark:text-white tracking-widest">Shepherd Copilot</h3>
                 <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="label-xs">Claude 3.5 Sonnet actif</span>
                 </div>
              </div>
           </div>
           <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
              <X className="w-5 h-5 text-gray-400" />
           </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px]">
           {messages.map((msg, i) => (
             <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}>
                <div className={`max-w-[85%] p-4 rounded-2xl shadow-sm ${
                  msg.role === 'user' 
                    ? 'bg-primary text-white rounded-tr-none' 
                    : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-gray-700 rounded-tl-none'
                }`}>
                   <p className="body-sm leading-relaxed">{msg.content}</p>
                </div>
             </div>
           ))}
           {isTyping && (
             <div className="flex justify-start animate-fade-in">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 rounded-tl-none flex gap-1">
                   <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
                   <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
                   <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" />
                </div>
             </div>
           )}
        </div>

        {/* Input */}
        <div className="p-6 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
           <div className="relative group">
              <input 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Demander à ShepherdAI..."
                className="w-full pl-5 pr-14 py-4 bg-gray-50 dark:bg-gray-800 border-none rounded-2xl body-sm focus:ring-2 focus:ring-primary/20 transition-all"
              />
              <button 
                onClick={handleSend}
                disabled={!input.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center shadow-lg shadow-primary/30 active:scale-90 transition-all disabled:opacity-50 disabled:scale-90"
              >
                 <Send className="w-4 h-4" />
              </button>
           </div>
           <p className="label-xs mt-3 text-center">
              Propulsé par Anthropic Claude 3.5 Sonnet
           </p>
        </div>
      </div>
    </>
  );
};

export default ShepherdCopilot;
