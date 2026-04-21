import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, RefreshCw, Trophy, Brain, ChevronRight, CheckCircle2, XCircle, Info, Database, Upload, AlertCircle } from 'lucide-react';
import { generateWordPairs, enhanceReviewList } from './lib/gemini';
import { WordPair, Difficulty, ReviewItem } from './types';

interface PlayerData {
  pairs: WordPair[];
  shuffledLeft: string[];
  shuffledRight: string[];
  selectedLeft: string | null;
  selectedRight: string | null;
  matched: Set<string>;
  score: number;
  failedPairs: Set<WordPair>;
}

const initialPlayerData: PlayerData = {
  pairs: [],
  shuffledLeft: [],
  shuffledRight: [],
  selectedLeft: null,
  selectedRight: null,
  matched: new Set<string>(),
  score: 0,
  failedPairs: new Set<WordPair>()
};

const createPlayerData = (pairs: WordPair[]): PlayerData => ({
  pairs,
  shuffledLeft: [...pairs.map(p => p.word)].sort(() => Math.random() - 0.5),
  shuffledRight: [...pairs.map(p => p.synonym)].sort(() => Math.random() - 0.5),
  selectedLeft: null,
  selectedRight: null,
  matched: new Set<string>(),
  score: 0,
  failedPairs: new Set<WordPair>()
});

// Audio Assets
const SOUNDS = {
  SUCCESS: 'https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3', // Happy/Positive
  ERROR: 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3',   // Warning/Buzz
  TICK: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3'    // Clock Tick
};

export default function App() {
  const [step, setStep] = useState<'welcome' | 'loading' | 'playing' | 'results'>('welcome');
  const [mode, setMode] = useState<'ai' | 'custom'>('ai');
  const [gameMode, setGameMode] = useState<'single' | 'battle'>('single');
  const [category, setCategory] = useState('IELTS');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [duration, setDuration] = useState(60);
  const [customInput, setCustomInput] = useState('');
  
  // Game State for Players
  const [p1Data, setP1Data] = useState<PlayerData>(initialPlayerData);
  const [p2Data, setP2Data] = useState<PlayerData>(initialPlayerData);
  
  // Track words used in current game to prevent repetition
  const [p1UsedWords, setP1UsedWords] = useState<string[]>([]);
  const [p2UsedWords, setP2UsedWords] = useState<string[]>([]);
  
  const [remainingTime, setRemainingTime] = useState(60);
  const [isWrongP1, setIsWrongP1] = useState(false);
  const [isWrongP2, setIsWrongP2] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingReview, setIsGeneratingReview] = useState(false);
  const [p1Review, setP1Review] = useState<ReviewItem[]>([]);
  const [p2Review, setP2Review] = useState<ReviewItem[]>([]);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('lexis_match_highscore');
    return saved ? parseInt(saved, 10) : 0;
  });

  // Persist High Score
  useEffect(() => {
    const currentMax = Math.max(p1Data.score, p2Data.score);
    if (currentMax > highScore) {
      setHighScore(currentMax);
      localStorage.setItem('lexis_match_highscore', currentMax.toString());
    }
  }, [p1Data.score, p2Data.score, highScore]);

  // Initialize Game
  const startGame = async () => {
    setError(null);
    setStep('loading');
    setP1Review([]);
    setP2Review([]);
    
    let initialPairsP1: WordPair[] = [];
    let initialPairsP2: WordPair[] = [];

    if (mode === 'custom') {
      const lines = customInput.split('\n').filter(line => line.trim().includes('|'));
      const customPairs = lines.map(line => {
        const [word, synonym] = line.split('|').map(s => s.trim());
        return { word, synonym };
      }).filter(p => p.word && p.synonym);

      if (customPairs.length < 2) {
        setError('Please provide at least 2 valid word pairs (Word|Synonym)');
        setStep('welcome');
        return;
      }
      initialPairsP1 = [...customPairs].sort(() => Math.random() - 0.5).slice(0, 5);
      initialPairsP2 = [...customPairs].sort(() => Math.random() - 0.5).slice(0, 5);
    } else {
      initialPairsP1 = await generateWordPairs(category, difficulty);
      if (gameMode === 'battle') {
        initialPairsP2 = await generateWordPairs(category, difficulty);
      }
    }

    setP1Data(createPlayerData(initialPairsP1));
    setP1UsedWords([...initialPairsP1.map(p => p.word), ...initialPairsP1.map(p => p.synonym)]);
    
    if (gameMode === 'battle') {
      setP2Data(createPlayerData(initialPairsP2));
      setP2UsedWords([...initialPairsP2.map(p => p.word), ...initialPairsP2.map(p => p.synonym)]);
    }
    
    setRemainingTime(duration);
    setStep('playing');
  };

  const refreshPlayerBatch = async (playerNum: 1 | 2) => {
    let nextPairs: WordPair[] = [];
    const usedWords = playerNum === 1 ? p1UsedWords : p2UsedWords;
    
    if (mode === 'custom') {
      const lines = customInput.split('\n').filter(line => line.trim().includes('|'));
      const allCustom = lines.map(line => {
        const [word, synonym] = line.split('|').map(s => s.trim());
        return { word, synonym };
      }).filter(p => p.word && p.synonym && !usedWords.includes(p.word)); // Filter custom bank if words are many
      
      nextPairs = [...allCustom].sort(() => Math.random() - 0.5).slice(0, 5);
    } else {
      nextPairs = await generateWordPairs(category, difficulty, usedWords);
    }

    if (playerNum === 1) {
      setP1UsedWords(prev => [...prev, ...nextPairs.map(p => p.word), ...nextPairs.map(p => p.synonym)]);
      setP1Data(prev => ({
        ...prev,
        pairs: nextPairs,
        shuffledLeft: [...nextPairs.map(p => p.word)].sort(() => Math.random() - 0.5),
        shuffledRight: [...nextPairs.map(p => p.synonym)].sort(() => Math.random() - 0.5),
        matched: new Set(),
        selectedLeft: null,
        selectedRight: null
      }));
    } else {
      setP2UsedWords(prev => [...prev, ...nextPairs.map(p => p.word), ...nextPairs.map(p => p.synonym)]);
      setP2Data(prev => ({
        ...prev,
        pairs: nextPairs,
        shuffledLeft: [...nextPairs.map(p => p.word)].sort(() => Math.random() - 0.5),
        shuffledRight: [...nextPairs.map(p => p.synonym)].sort(() => Math.random() - 0.5),
        matched: new Set(),
        selectedLeft: null,
        selectedRight: null
      }));
    }
  };

  // Audio logic
  const playSound = (url: string) => {
    const audio = new Audio(url);
    audio.volume = 0.4;
    audio.play().catch(() => {});
  };

  // Timer logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === 'playing' && remainingTime > 0) {
      interval = setInterval(() => {
        setRemainingTime(t => Math.max(0, t - 1));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, remainingTime > 0]);

  // Handle Game Over transition via separate effect
  useEffect(() => {
    if (step === 'playing' && remainingTime <= 0) {
      handleGameOver();
    }
  }, [remainingTime, step]);

  // Sound triggering for countdown
  useEffect(() => {
    if (step === 'playing' && remainingTime <= 30 && remainingTime > 0) {
      playSound(SOUNDS.TICK);
    }
  }, [remainingTime, step]);

  const handleGameOver = async () => {
    setStep('results');
    setIsGeneratingReview(true);
    try {
      const p1Errors = Array.from(p1Data.failedPairs) as WordPair[];
      const p2Errors = Array.from(p2Data.failedPairs) as WordPair[];
      
      const [res1, res2] = await Promise.all([
        p1Errors.length > 0 ? enhanceReviewList(p1Errors, category) : Promise.resolve([]),
        (gameMode === 'battle' && p2Errors.length > 0) ? enhanceReviewList(p2Errors, category) : Promise.resolve([])
      ]);
      
      setP1Review(res1);
      setP2Review(res2);
    } catch (e) {
      console.error("Failed to generate review:", e);
    } finally {
      setIsGeneratingReview(false);
    }
  };

  // Unified Match Effect
  const handleMatch = (playerNum: 1 | 2) => {
    const data = playerNum === 1 ? p1Data : p2Data;
    const setData = playerNum === 1 ? setP1Data : setP2Data;
    const setIsWrong = playerNum === 1 ? setIsWrongP1 : setIsWrongP2;

    if (data.selectedLeft && data.selectedRight) {
      const pair = data.pairs.find(p => p.word === data.selectedLeft && p.synonym === data.selectedRight);
      
      if (pair) {
        playSound(SOUNDS.SUCCESS);
        const newMatched = new Set([...data.matched, data.selectedLeft!, data.selectedRight!]);
        setData(prev => ({
          ...prev,
          score: prev.score + 10,
          matched: newMatched,
          selectedLeft: null,
          selectedRight: null
        }));
        
        // Refresh batch if player finished current set
        if (newMatched.size === data.pairs.length * 2) {
          refreshPlayerBatch(playerNum);
        }
      } else {
        playSound(SOUNDS.ERROR);
        setIsWrong(true);
        // Track the failed pairs
        const failedPairLeft = data.pairs.find(p => p.word === data.selectedLeft || p.synonym === data.selectedLeft);
        const failedPairRight = data.pairs.find(p => p.word === data.selectedRight || p.synonym === data.selectedRight);
        
        setData(prev => {
          const updatedFailed = new Set(prev.failedPairs);
          if (failedPairLeft) updatedFailed.add(failedPairLeft);
          if (failedPairRight) updatedFailed.add(failedPairRight);
          return { ...prev, score: Math.max(0, prev.score - 5), failedPairs: updatedFailed };
        });
        
        setTimeout(() => {
          setData(prev => ({ ...prev, selectedLeft: null, selectedRight: null }));
          setIsWrong(false);
        }, 800);
      }
    }
  };

  useEffect(() => { handleMatch(1); }, [p1Data.selectedLeft, p1Data.selectedRight]);
  useEffect(() => { if (gameMode === 'battle') handleMatch(2); }, [p2Data.selectedLeft, p2Data.selectedRight]);

  const downloadPDF = () => {
    const timestamp = new Date().toLocaleString();
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Lexis Match Review - ${category}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #333; padding: 40px; max-width: 800px; margin: 0 auto; }
          h1 { color: #0891b2; border-bottom: 2px solid #0891b2; padding-bottom: 10px; }
          .meta { font-size: 12px; color: #666; margin-bottom: 30px; }
          .section { margin-bottom: 40px; }
          .section-title { font-size: 18px; font-weight: bold; color: #4338ca; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 1px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; text-align: left; font-size: 13px; color: #64748b; }
          td { border: 1px solid #e2e8f0; padding: 12px; font-size: 14px; }
          .word { font-weight: bold; color: #0f172a; }
          .ipa { font-family: "Lucida Sans Unicode", "Arial Unicode MS", sans-serif; color: #64748b; font-size: 12px; }
          .meaning { color: #666; font-style: italic; }
          @media print {
            .no-print { display: none; }
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <h1>Lexis Match: Vocabulary Review</h1>
        <div className="meta">
          <strong>Category:</strong> ${category} | 
          <strong>Difficulty:</strong> ${difficulty} | 
          <strong>Generated:</strong> ${timestamp}
        </div>

        ${p1Review.length > 0 ? `
          <div class="section">
            <div class="section-title">Player 1 - Focus Points</div>
            <table>
              <thead>
                <tr>
                  <th>Word</th>
                  <th>IPA</th>
                  <th>Synonym</th>
                  <th>Meaning (Chinese)</th>
                </tr>
              </thead>
              <tbody>
                ${p1Review.map(item => `
                  <tr>
                    <td class="word">${item.word}</td>
                    <td class="ipa">${item.phonetic}</td>
                    <td>${item.synonym}</td>
                    <td class="meaning">${item.meaning}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}

        ${p2Review.length > 0 ? `
          <div class="section">
            <div class="section-title">Player 2 - Focus Points</div>
            <table>
              <thead>
                <tr>
                  <th>Word</th>
                  <th>IPA</th>
                  <th>Synonym</th>
                  <th>Meaning (Chinese)</th>
                </tr>
              </thead>
              <tbody>
                ${p2Review.map(item => `
                  <tr>
                    <td class="word">${item.word}</td>
                    <td class="ipa">${item.phonetic}</td>
                    <td>${item.synonym}</td>
                    <td class="meaning">${item.meaning}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}

        <div class="no-print" style="margin-top: 50px; text-align: center; border-top: 1px solid #eee; pt: 20px;">
          <p style="font-size: 12px; color: #999;">Tip: Press Ctrl+P (or Cmd+P) to save this list as a professional PDF.</p>
        </div>
      </body>
      </html>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    // Try to use Share API first if it's a mobile device and supported
    if (navigator.share && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
      const file = new File([blob], `Lexis_Review_${category.replace(/\s+/g, '_')}.html`, { type: 'text/html' });
      navigator.share({
        title: `Lexis Match Review - ${category}`,
        text: `My vocabulary review from Lexis Match (${category})`,
        files: [file]
      }).catch(() => {
        // Fallback to direct download if share fails
        triggerDownload(url, category);
      });
    } else {
      triggerDownload(url, category);
    }
  };

  const triggerDownload = (url: string, category: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `Lexis_Review_${category.replace(/\s+/g, '_')}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Fallback: if download attribute didn't work (still on page), try opening in new window
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans selection:bg-cyan-500/30 overflow-x-hidden">
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[10%] left-[10%] w-[50%] h-[50%] bg-indigo-900/10 rounded-full blur-[120px] opacity-40 animate-pulse" />
        <div className="absolute bottom-[10%] right-[10%] w-[40%] h-[40%] bg-cyan-900/10 rounded-full blur-[100px] opacity-40" />
      </div>

      <main className="relative max-w-5xl mx-auto px-6 py-12 flex flex-col min-h-screen print:hidden">
        <header className="mb-10 w-full flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-col items-center md:items-start text-center md:text-left">
            <motion.span 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[10px] uppercase tracking-[0.3em] text-cyan-400 font-bold mb-1"
            >
              Academic Mastery
            </motion.span>
            <motion.h1 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-4xl md:text-5xl font-black tracking-tight text-white uppercase"
            >
              LEXIS <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-500">MATCH</span>
            </motion.h1>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6">
            {gameMode === 'battle' ? (
              <>
                <div className="bg-slate-900/50 border border-cyan-500/30 px-6 py-2 rounded-full flex flex-col items-center min-w-[120px] backdrop-blur-sm shadow-[0_0_15px_rgba(34,211,238,0.2)]">
                  <span className="text-[9px] uppercase tracking-wider text-cyan-400">Player 1</span>
                  <span className="text-xl font-mono font-bold text-white tabular-nums">{p1Data.score.toLocaleString()}</span>
                </div>
                <div className="bg-slate-900/50 border border-indigo-500/30 px-6 py-2 rounded-full flex flex-col items-center min-w-[120px] backdrop-blur-sm shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                  <span className="text-[9px] uppercase tracking-wider text-indigo-400">Player 2</span>
                  <span className="text-xl font-mono font-bold text-white tabular-nums">{p2Data.score.toLocaleString()}</span>
                </div>
              </>
            ) : (
              <div className="bg-slate-900/50 border border-slate-700/50 px-6 py-2 rounded-full flex flex-col items-center min-w-[120px] backdrop-blur-sm shadow-inner">
                <span className="text-[9px] uppercase tracking-wider text-slate-400">Total Score</span>
                <span className="text-xl font-mono font-bold text-white tabular-nums">{p1Data.score.toLocaleString()}</span>
              </div>
            )}
            
            <div className="relative flex items-center justify-center w-20 h-20 group">
              <svg className="absolute w-full h-full -rotate-90">
                <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="3" fill="transparent" className="text-slate-800" />
                <motion.circle 
                  cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="3" fill="transparent" 
                  className={remainingTime <= 30 ? "text-red-500 shadow-[0_0_15px_#ef4444]" : "text-cyan-500 shadow-[0_0_10px_#22d3ee]"} 
                  strokeDasharray="226" 
                  animate={{ strokeDashoffset: Math.max(0, 226 - ((remainingTime / duration) * 226)) }}
                  transition={{ duration: 1 }}
                />
              </svg>
              <span className={`text-lg font-bold font-mono tabular-nums ${remainingTime <= 30 ? 'text-red-400 animate-pulse' : 'text-cyan-300'}`}>
                {remainingTime}
              </span>
              
              {step === 'playing' && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.1 }}
                  onClick={handleGameOver}
                  className="absolute -bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest hover:bg-red-500/40 transition-all backdrop-blur-sm z-50"
                >
                  End Game
                </motion.button>
              )}
            </div>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {step === 'welcome' && (
            <motion.section
              key="welcome"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900/80 border border-slate-800 p-8 md:p-12 rounded-3xl backdrop-blur-xl shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-3xl" />
              
              <div className="space-y-8 relative z-10">
                {/* Game Mode Selector */}
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-slate-500 mb-3 font-bold">Game Mode</label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setGameMode('single')}
                      className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl font-bold transition-all border ${
                        gameMode === 'single' ? 'bg-slate-800 text-cyan-400 border-cyan-500/50' : 'bg-slate-950/50 text-slate-500 border-slate-800'
                      }`}
                    >
                      Single Player
                    </button>
                    <button
                      onClick={() => setGameMode('battle')}
                      className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl font-bold transition-all border ${
                        gameMode === 'battle' ? 'bg-slate-800 text-cyan-400 border-cyan-500/50 shadow-[0_0_15px_rgba(34,211,238,0.2)]' : 'bg-slate-950/50 text-slate-500 border-slate-800'
                      }`}
                    >
                      Parallel Battle (2P)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-slate-500 mb-3 font-bold">Time Limit (Seconds)</label>
                  <div className="flex gap-3">
                    {[60, 90, 120, 150].map(s => (
                      <button
                        key={s}
                        onClick={() => setDuration(s)}
                        className={`flex-1 py-3 rounded-xl border transition-all font-mono font-bold ${
                          duration === s ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/50' : 'bg-slate-950/50 text-slate-500 border-slate-800'
                        }`}
                      >
                        {s}s
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mode Selector */}
                <div className="flex p-1 bg-slate-950/50 border border-slate-800 rounded-2xl">
                  <button
                    onClick={() => setMode('ai')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${
                      mode === 'ai' ? 'bg-slate-800 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.2)]' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <Sparkles size={18} /> AI Generated
                  </button>
                  <button
                    onClick={() => setMode('custom')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all ${
                      mode === 'custom' ? 'bg-slate-800 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.2)]' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <Database size={18} /> Custom Bank
                  </button>
                </div>

                <AnimatePresence mode="wait">
                  {mode === 'ai' ? (
                    <motion.div
                      key="ai-config"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="space-y-8"
                    >
                      <div>
                        <label className="block text-[10px] uppercase tracking-widest text-slate-500 mb-3 font-bold">Vocabulary Domain</label>
                        <div className="flex flex-wrap gap-3">
                          {['IELTS', 'TOEFL', '大学英语四六级'].map((cat) => (
                            <button
                              key={cat}
                              onClick={() => setCategory(cat)}
                              className={`px-5 py-2.5 rounded-xl border transition-all font-bold text-sm ${
                                category === cat 
                                  ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/50 shadow-[0_0_10px_rgba(34,211,238,0.1)]' 
                                  : 'bg-slate-950/50 text-slate-400 border-slate-800 hover:border-slate-700'
                              }`}
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase tracking-widest text-slate-500 mb-3 font-bold">Complexity Level</label>
                        <div className="flex gap-3">
                          {(['easy', 'medium', 'hard'] as Difficulty[]).map((level) => (
                            <button
                              key={level}
                              onClick={() => setDifficulty(level)}
                              className={`flex-1 px-6 py-3 rounded-xl border transition-all font-bold capitalize text-sm ${
                                difficulty === level 
                                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.3)]' 
                                  : 'bg-slate-950/50 text-slate-400 border-slate-800 hover:border-slate-700'
                              }`}
                            >
                              {level}
                            </button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="custom-config"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-4"
                    >
                      <div>
                        <label className="block text-[10px] uppercase tracking-widest text-slate-500 mb-2 font-bold">Data Import</label>
                        <p className="text-[11px] text-slate-400 mb-3">Schema: <span className="font-mono bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">Target|Synonym</span> per line.</p>
                        <textarea
                          value={customInput}
                          onChange={(e) => setCustomInput(e.target.value)}
                          placeholder="Analysis|Evaluation&#10;Resilient|Persistent..."
                          className="w-full h-48 p-4 rounded-xl bg-slate-950/50 border border-slate-800 text-slate-200 focus:border-cyan-500/50 outline-none transition-all font-mono text-xs resize-none placeholder:text-slate-700 shadow-inner"
                        />
                      </div>
                      {error && (
                        <div className="flex items-center gap-2 text-red-400 text-xs font-bold bg-red-950/20 border border-red-900/30 p-3 rounded-xl">
                          <AlertCircle size={14} /> {error}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  onClick={startGame}
                  className="w-full bg-gradient-to-r from-cyan-600 to-indigo-600 text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-sm hover:from-cyan-500 hover:to-indigo-500 transition-all flex items-center justify-center gap-3 active:scale-[0.98] group shadow-xl shadow-indigo-950/50 border border-white/5"
                >
                  {mode === 'custom' ? 'Initialize Custom Bank' : 'Deploy AI Logic'} <ChevronRight className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </motion.section>
          )}

          {step === 'loading' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center py-20 space-y-8"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-cyan-500/20 rounded-full blur-2xl animate-pulse" />
                <RefreshCw size={64} className="animate-spin text-cyan-400 relative z-10" />
                <Sparkles size={24} className="absolute -top-4 -right-4 text-indigo-400 animate-bounce" />
              </div>
              <div className="text-center">
                <h2 className="text-2xl font-black text-white mb-3 uppercase tracking-widest">Compiling Database...</h2>
                <div className="flex items-center justify-center gap-1">
                  <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" />
                </div>
              </div>
            </motion.div>
          )}

          {step === 'playing' && (
            <motion.div
              key="playing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`flex-1 grid gap-12 ${gameMode === 'battle' ? 'grid-cols-1 lg:grid-cols-2 lg:divide-x divide-slate-800' : 'grid-cols-1'}`}
            >
              {/* Player 1 Section */}
              <div className="space-y-12">
                {gameMode === 'battle' && (
                  <div className="text-center">
                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-400">Section Alpha: Player 1</span>
                  </div>
                )}
                <div className="w-full grid grid-cols-1 md:grid-cols-11 gap-4 items-center">
                  <div className="col-span-12 md:col-span-5 flex flex-col gap-3">
                    {p1Data.shuffledLeft.map((word) => (
                      <WordCard
                        key={word}
                        text={word}
                        isSelected={p1Data.selectedLeft === word}
                        isMatched={p1Data.matched.has(word)}
                        isIncorrect={isWrongP1 && p1Data.selectedLeft === word}
                        onClick={() => !p1Data.matched.has(word) && setP1Data(prev => ({ ...prev, selectedLeft: word }))}
                        side="left"
                      />
                    ))}
                  </div>

                  <div className="hidden md:col-span-1 h-full md:flex flex-col justify-around py-4 relative opacity-10">
                    <div className="w-[1px] h-full mx-auto bg-cyan-500" />
                  </div>

                  <div className="col-span-12 md:col-span-5 flex flex-col gap-3">
                    {p1Data.shuffledRight.map((word) => (
                      <WordCard
                        key={word}
                        text={word}
                        isSelected={p1Data.selectedRight === word}
                        isMatched={p1Data.matched.has(word)}
                        isIncorrect={isWrongP1 && p1Data.selectedRight === word}
                        onClick={() => !p1Data.matched.has(word) && setP1Data(prev => ({ ...prev, selectedRight: word }))}
                        side="right"
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Player 2 Section (Battle Only) */}
              {gameMode === 'battle' && (
                <div className="space-y-12 lg:pl-12">
                  <div className="text-center">
                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400">Section Beta: Player 2</span>
                  </div>
                  <div className="w-full grid grid-cols-1 md:grid-cols-11 gap-4 items-center">
                    <div className="col-span-12 md:col-span-5 flex flex-col gap-3">
                      {p2Data.shuffledLeft.map((word) => (
                        <WordCard
                          key={word}
                          text={word}
                          isSelected={p2Data.selectedLeft === word}
                          isMatched={p2Data.matched.has(word)}
                          isIncorrect={isWrongP2 && p2Data.selectedLeft === word}
                          onClick={() => !p2Data.matched.has(word) && setP2Data(prev => ({ ...prev, selectedLeft: word }))}
                          side="left"
                        />
                      ))}
                    </div>

                    <div className="hidden md:col-span-1 h-full md:flex flex-col justify-around py-4 relative opacity-10">
                      <div className="w-[1px] h-full mx-auto bg-indigo-500" />
                    </div>

                    <div className="col-span-12 md:col-span-5 flex flex-col gap-3">
                      {p2Data.shuffledRight.map((word) => (
                        <WordCard
                          key={word}
                          text={word}
                          isSelected={p2Data.selectedRight === word}
                          isMatched={p2Data.matched.has(word)}
                          isIncorrect={isWrongP2 && p2Data.selectedRight === word}
                          onClick={() => !p2Data.matched.has(word) && setP2Data(prev => ({ ...prev, selectedRight: word }))}
                          side="right"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {step === 'results' && (
            <motion.section
              key="results"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-slate-900 border border-slate-800 p-12 rounded-3xl text-center shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-cyan-500 via-indigo-500 to-cyan-500 shadow-[0_0_10px_#22d3ee55]" />
              
              <div className="mb-10">
                <div className="w-24 h-24 bg-cyan-950/30 border border-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(34,211,238,0.1)]">
                  <Trophy size={48} className="text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]" />
                </div>
                <h2 className="text-4xl font-black text-white mb-2 uppercase tracking-tight">
                  {gameMode === 'battle' 
                    ? (p1Data.score > p2Data.score ? 'PLAYER 1 DOMINANCE' : p2Data.score > p1Data.score ? 'PLAYER 2 DOMINANCE' : 'SYNCHRONIZED TIE') 
                    : 'SEQUENCE COMPLETE'}
                </h2>
                <p className="text-slate-400 text-lg">
                  {gameMode === 'battle' ? 'Competitive validation metrics confirmed.' : 'Lexical validation confirmed.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-10">
                {gameMode === 'battle' ? (
                  <>
                    <div className={`p-6 bg-slate-950/50 border rounded-2xl ${p1Data.score >= p2Data.score ? 'border-cyan-500/50' : 'border-slate-800'}`}>
                      <span className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Alpha Metrics</span>
                      <span className="text-4xl font-mono font-bold text-white tabular-nums">{p1Data.score}</span>
                      {p1Review.length > 0 && (
                        <div className="mt-3 text-[10px] text-red-400 font-bold uppercase tracking-tighter">
                          {p1Review.length} Focus Points Identified
                        </div>
                      )}
                    </div>
                    <div className={`p-6 bg-slate-950/50 border rounded-2xl ${p2Data.score >= p1Data.score ? 'border-indigo-500/50' : 'border-slate-800'}`}>
                      <span className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Beta Metrics</span>
                      <span className="text-4xl font-mono font-bold text-white tabular-nums">{p2Data.score}</span>
                      {p2Review.length > 0 && (
                        <div className="mt-3 text-[10px] text-red-400 font-bold uppercase tracking-tighter">
                          {p2Review.length} Focus Points Identified
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-6 bg-slate-950/50 border border-slate-800 rounded-2xl relative">
                      <span className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Personal Record</span>
                      <span className="text-4xl font-mono font-bold text-amber-500 tabular-nums">{highScore}</span>
                      <Trophy size={16} className="absolute top-4 right-4 text-amber-500/50" />
                    </div>
                    <div className="p-6 bg-slate-950/50 border border-slate-800 rounded-2xl">
                      <span className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Game Magnitude</span>
                      <span className="text-4xl font-mono font-bold text-white tabular-nums">{p1Data.score}</span>
                    </div>
                  </>
                )}
              </div>

              {gameMode === 'single' ? (
                p1Review.length > 0 && (
                  <div className="mb-10 text-left">
                    <h3 className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-4 flex items-center gap-2">
                       <CheckCircle2 size={12} className="text-cyan-500" /> Focus Vocabulary List
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {p1Review.map((item, idx) => (
                        <div key={idx} className="bg-slate-950/50 border border-slate-800 p-4 rounded-xl text-xs group hover:border-cyan-500/30 transition-all">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-cyan-400 font-bold text-sm tracking-wide">{item.word}</span>
                            <span className="text-slate-600 font-mono text-[10px]">{item.phonetic}</span>
                          </div>
                          <div className="text-slate-300 font-medium mb-1">{item.synonym}</div>
                          <div className="text-slate-500 italic mt-2 border-t border-slate-900 pt-2">{item.meaning}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10 w-full">
                  {p1Review.length > 0 && (
                    <div className="text-left w-full">
                      <h3 className="text-[10px] uppercase tracking-widest text-cyan-500 font-bold mb-4">Player 1 Mistakes</h3>
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                        {p1Review.map((item, idx) => (
                          <div key={idx} className="bg-slate-950/50 border border-slate-800/50 p-3 rounded-lg text-xs">
                            <div className="flex justify-between text-[11px] mb-1">
                              <span className="text-cyan-300 font-bold">{item.word}</span>
                              <span className="text-slate-600 font-mono">{item.phonetic}</span>
                            </div>
                            <div className="text-slate-500 text-[10px]">{item.meaning}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {p2Review.length > 0 && (
                    <div className="text-left w-full">
                      <h3 className="text-[10px] uppercase tracking-widest text-indigo-500 font-bold mb-4">Player 2 Mistakes</h3>
                      <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                        {p2Review.map((item, idx) => (
                          <div key={idx} className="bg-slate-950/50 border border-slate-800/50 p-3 rounded-lg text-xs">
                            <div className="flex justify-between text-[11px] mb-1">
                              <span className="text-indigo-300 font-bold">{item.word}</span>
                              <span className="text-slate-600 font-mono">{item.phonetic}</span>
                            </div>
                            <div className="text-slate-500 text-[10px]">{item.meaning}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-4">
                {(p1Data.failedPairs.size > 0 || (gameMode === 'battle' && p2Data.failedPairs.size > 0)) ? (
                  <div className="w-full">
                    <button
                      onClick={downloadPDF}
                      disabled={isGeneratingReview}
                      className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-900/20 border border-indigo-400/20 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                      {isGeneratingReview ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" /> Syncing Global Records...
                        </>
                      ) : (
                        <>
                          <Upload size={14} className="group-hover:-translate-y-0.5 transition-transform" /> Download / Print Review Sheet
                        </>
                      )}
                    </button>
                    {!isGeneratingReview && (
                      <p className="text-[9px] text-slate-600 mt-2 text-center italic">
                        If no window appears, please ensure popups are allowed or try "Open in Browser".
                      </p>
                    )}
                  </div>
                ) : null}
                <button
                  onClick={startGame}
                  className="w-full bg-cyan-600 text-white py-4 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-cyan-500 transition-all shadow-lg shadow-cyan-900/20 border border-cyan-400/20"
                >
                  Initiate New Cycle
                </button>
                <button
                  onClick={() => setStep('welcome')}
                  className="w-full bg-transparent text-slate-400 border border-slate-800 py-4 rounded-xl font-bold uppercase tracking-widest text-xs hover:text-white hover:border-slate-600 transition-all"
                >
                  Return to Interface
                </button>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Bottom Interface */}
        <footer className="mt-auto pt-12 pb-8 w-full">
          <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl flex flex-col md:flex-row justify-between items-center gap-6 backdrop-blur-sm">
            <div className="flex flex-col items-center md:items-start text-center md:text-left">
              <span className="text-[10px] text-slate-500 uppercase tracking-[0.3em] font-bold mb-1 flex items-center gap-2">
                <Info size={12} className="text-cyan-500" /> v1.2.4 - PWA Optimized
              </span>
              <p className="text-xs text-slate-400 max-w-sm">Synchronize lexical pairs by mapping targets to their corresponding synonyms.</p>
            </div>
            
            <div className="flex gap-4">
              {/* Extra controls removed from here to header for mobile visibility */}
            </div>
          </div>
        </footer>
      </main>

      {/* Print View - Hidden on screen, visible on print */}
      <div className="hidden print:block p-8 bg-white text-black min-h-screen">
        <h1 className="text-3xl font-bold mb-4">Lexis Match - Vocabulary Review</h1>
        <div className="text-sm text-gray-600 mb-8 pb-4 border-b">
          Exam Context: {category} | Difficulty: {difficulty} | {new Date().toLocaleDateString()}
        </div>

        {p1Review.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4 text-cyan-700">Player 1 Mistakes</h2>
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 p-2 text-left">Word</th>
                  <th className="border border-gray-300 p-2 text-left">Phonetic</th>
                  <th className="border border-gray-300 p-2 text-left">Synonym</th>
                  <th className="border border-gray-300 p-2 text-left">Meaning (Chinese)</th>
                </tr>
              </thead>
              <tbody>
                {p1Review.map((item, idx) => (
                  <tr key={idx}>
                    <td className="border border-gray-300 p-2 font-bold">{item.word}</td>
                    <td className="border border-gray-300 p-2">{item.phonetic}</td>
                    <td className="border border-gray-300 p-2">{item.synonym}</td>
                    <td className="border border-gray-300 p-2">{item.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {p2Review.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold mb-4 text-indigo-700">Player 2 Mistakes</h2>
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 p-2 text-left">Word</th>
                  <th className="border border-gray-300 p-2 text-left">Phonetic</th>
                  <th className="border border-gray-300 p-2 text-left">Synonym</th>
                  <th className="border border-gray-300 p-2 text-left">Meaning (Chinese)</th>
                </tr>
              </thead>
              <tbody>
                {p2Review.map((item, idx) => (
                  <tr key={idx}>
                    <td className="border border-gray-300 p-2 font-bold">{item.word}</td>
                    <td className="border border-gray-300 p-2">{item.phonetic}</td>
                    <td className="border border-gray-300 p-2">{item.synonym}</td>
                    <td className="border border-gray-300 p-2">{item.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

interface WordCardProps {
  text: string;
  isSelected: boolean;
  isMatched: boolean;
  isIncorrect: boolean;
  onClick: () => void;
  side?: 'left' | 'right';
}

const WordCard: React.FC<WordCardProps> = ({ text, isSelected, isMatched, isIncorrect, onClick, side = 'left' }) => {
  return (
    <motion.button
      whileHover={!isMatched ? { scale: 1.01 } : {}}
      whileTap={!isMatched ? { scale: 0.98 } : {}}
      onClick={onClick}
      disabled={isMatched}
      className={`
        w-full p-6 rounded-2xl border-2 transition-all duration-300 relative overflow-hidden group shadow-lg text-left
        ${isMatched ? 'bg-slate-900/40 border-slate-800 opacity-40 shadow-none' : 
          isIncorrect ? 'bg-red-950/20 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)] animate-shake' :
          isSelected ? 'bg-indigo-900/40 border-cyan-500 shadow-[0_0_20px_rgba(34,211,238,0.3)]' : 
          'bg-slate-900/80 border-slate-800 hover:border-cyan-500/50'}
      `}
    >
      <div className={`flex justify-between items-center w-full ${side === 'right' ? 'flex-row-reverse' : ''}`}>
        <span className={`text-xl font-semibold tracking-wide ${isSelected ? 'text-cyan-100' : 'text-slate-200'} ${isMatched ? 'text-slate-500' : ''}`}>
          {text}
        </span>
        <div className={`
          w-3 h-3 rounded-full transition-all duration-300
          ${isMatched ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 
            isIncorrect ? 'bg-red-500 shadow-[0_0_10px_#ef4444]' :
            isSelected ? 'bg-cyan-400 shadow-[0_0_10px_#22d3ee]' : 
            'bg-slate-700 group-hover:bg-cyan-400 group-hover:shadow-[0_0_10px_rgba(34,211,238,0.4)]'}
        `} />
      </div>

      {isSelected && !isIncorrect && (
        <div className={`absolute top-1/2 -translate-y-1/2 w-4 h-[1px] bg-cyan-500 ${side === 'left' ? '-right-1' : '-left-1'}`} />
      )}
    </motion.button>
  );
}
