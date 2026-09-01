'use client';

import { useState } from 'react';

export default function Home() {
  const [ticket, setTicket] = useState('');
  const [tier, setTier] = useState('Basic');
  const [result, setResult] = useState<any>(null);
  const [isTriaging, setIsTriaging] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState('');

  const handleSeed = async () => {
    setIsSeeding(true);
    setSeedMessage('');
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiUrl}/api/seed`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setSeedMessage(data.message);
      } else {
        setSeedMessage(`Error: ${data.detail}`);
      }
    } catch (err) {
      setSeedMessage('Failed to seed database.');
    } finally {
      setIsSeeding(false);
    }
  };

  const handleTriage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket.trim()) return;

    setIsTriaging(true);
    setResult(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiUrl}/api/triage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket, tier }),
      });
      
      const data = await res.json();
      if (res.ok) {
        setResult(data);
      } else {
        console.error(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsTriaging(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans p-8 selection:bg-rose-500/30">
      <div className="max-w-4xl mx-auto space-y-12 mt-10">
        
        <header className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-orange-400">
            Semantic Ticket Triage
          </h1>
          <p className="text-slate-400 text-lg">
            AI Support Agent POC — Auto-Resolve vs. Escalate
          </p>
        </header>

        <main className="grid md:grid-cols-2 gap-8">
          
          {/* LEFT: SEED DATABASE (Hidden tools for POC) */}
          <section className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col justify-between">
            <div>
              <h2 className="text-xl font-semibold mb-4 text-slate-300">
                POC Admin Controls
              </h2>
              <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                Before testing, seed the vector database with known "Routine" tickets (e.g., forgotten passwords, minor dashboard lag). The AI will attempt to semantically match incoming tickets against these.
              </p>
            </div>
            
            <div className="space-y-4">
              <button 
                onClick={handleSeed}
                disabled={isSeeding}
                className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-xl transition-all border border-slate-700 disabled:opacity-50"
              >
                {isSeeding ? 'Seeding...' : 'Seed Routine Tickets'}
              </button>
              {seedMessage && (
                <p className="text-xs text-center text-emerald-400">{seedMessage}</p>
              )}
            </div>
          </section>

          {/* RIGHT: SUBMIT TICKET */}
          <section className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
              <span className="text-rose-400">Submit Ticket</span>
            </h2>
            <form onSubmit={handleTriage} className="space-y-4">
              
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Customer Tier</label>
                <select 
                  value={tier}
                  onChange={(e) => setTier(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/50"
                >
                  <option value="Basic">Basic (24h SLA)</option>
                  <option value="Pro">Pro (8h SLA)</option>
                  <option value="Enterprise">Enterprise (1h SLA)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Issue Description</label>
                <textarea 
                  value={ticket}
                  onChange={(e) => setTicket(e.target.value)}
                  placeholder="Describe your problem..."
                  className="w-full h-32 bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition-all resize-none"
                />
              </div>

              <button 
                type="submit" 
                disabled={isTriaging || !ticket.trim()}
                className="w-full py-3 px-4 bg-gradient-to-r from-rose-600 to-orange-500 hover:from-rose-500 hover:to-orange-400 text-white font-medium rounded-xl transition-all shadow-lg shadow-rose-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isTriaging ? 'Triaging via Vector Search...' : 'Submit to AI Agent'}
              </button>
            </form>
          </section>
        </main>

        {/* RESULTS AREA */}
        {result && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className={`p-6 rounded-2xl border ${result.is_risk_demo ? 'bg-red-950/30 border-red-500/50 shadow-2xl shadow-red-900/20' : 'bg-slate-900/80 border-slate-700'}`}>
              
              {result.is_risk_demo && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-4">
                  <span className="text-red-400 text-2xl">⚠️</span>
                  <div>
                    <h3 className="text-red-400 font-bold uppercase tracking-wider text-sm mb-1">POC Risk Demonstrated</h3>
                    <p className="text-red-300 text-sm leading-relaxed">
                      <strong>Context Blindness:</strong> The AI aggressively auto-resolved a massive Enterprise outage because the text semantically resembled a routine "slow dashboard" complaint. The 1-hour SLA is breached and the client is blocked.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">
                  Action Taken: <span className={result.action === 'Escalated' ? 'text-amber-400' : 'text-emerald-400'}>{result.action}</span>
                </h3>
                {result.similarity && (
                  <span className="text-xs bg-slate-800 px-3 py-1 rounded-full text-slate-400 font-mono">
                    Match Confidence: {(result.similarity * 100).toFixed(1)}%
                  </span>
                )}
              </div>
              
              <div className="space-y-4">
                {result.matched_issue && (
                  <div>
                    <span className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Matched Routine Issue</span>
                    <p className="text-slate-300 text-sm italic border-l-2 border-slate-700 pl-3">"{result.matched_issue}"</p>
                  </div>
                )}
                
                <div>
                  <span className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Agent Output</span>
                  <p className="text-slate-200">{result.resolution}</p>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
