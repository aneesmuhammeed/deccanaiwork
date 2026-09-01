'use client';

import { useState } from 'react';

export default function Home() {
  const [content, setContent] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [addMessage, setAddMessage] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    
    setIsAdding(true);
    setAddMessage('');
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiUrl}/api/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      
      const data = await res.json();
      if (res.ok) {
        setAddMessage('Successfully added and embedded!');
        setContent('');
      } else {
        setAddMessage(`Error: ${data.error}`);
      }
    } catch (err) {
      setAddMessage('An error occurred while adding.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchResults([]);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const res = await fetch(`${apiUrl}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery }),
      });
      
      const data = await res.json();
      if (res.ok) {
        setSearchResults(data.data || []);
      } else {
        console.error(data.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans p-8 selection:bg-indigo-500/30">
      <div className="max-w-4xl mx-auto space-y-12 mt-10">
        
        <header className="text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
            Vector Study App
          </h1>
          <p className="text-slate-400 text-lg">
            Powered by Next.js, Gemini Embeddings & Supabase pgvector
          </p>
        </header>

        <main className="grid md:grid-cols-2 gap-8">
          {/* ADD NOTE SECTION */}
          <section className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
              <span className="text-indigo-400">1.</span> Store Knowledge
            </h2>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="sr-only">Your Text</label>
                <textarea 
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Enter a concept, note, or paragraph here to generate its vector embedding..."
                  className="w-full h-32 bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all resize-none"
                />
              </div>
              <button 
                type="submit" 
                disabled={isAdding || !content.trim()}
                className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-medium rounded-xl transition-all shadow-lg shadow-indigo-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAdding ? 'Generating Vector...' : 'Save & Embed'}
              </button>
              {addMessage && (
                <p className="text-sm text-center text-emerald-400 mt-2">{addMessage}</p>
              )}
            </form>
          </section>

          {/* SEARCH SECTION */}
          <section className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
              <span className="text-cyan-400">2.</span> Semantic Search
            </h2>
            <form onSubmit={handleSearch} className="space-y-4">
              <div>
                <label className="sr-only">Search Query</label>
                <input 
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by meaning, not just keywords..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 transition-all"
                />
              </div>
              <button 
                type="submit" 
                disabled={isSearching || !searchQuery.trim()}
                className="w-full py-3 px-4 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white font-medium rounded-xl transition-all shadow-lg shadow-cyan-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSearching ? 'Searching Vectors...' : 'Search'}
              </button>
            </form>

            <div className="mt-8 space-y-4">
              {searchResults.length > 0 ? (
                searchResults.map((result) => (
                  <div key={result.id} className="p-4 bg-slate-950 rounded-xl border border-slate-800">
                    <p className="text-sm text-slate-300 leading-relaxed mb-3">
                      "{result.content}"
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500"
                          style={{ width: `${Math.round(result.similarity * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-500 font-mono">
                        {(result.similarity * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                !isSearching && searchQuery && searchResults.length === 0 && (
                  <p className="text-sm text-slate-500 text-center">No matches found.</p>
                )
              )}
            </div>
          </section>
        </main>

      </div>
    </div>
  );
}
