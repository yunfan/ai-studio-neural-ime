import { useEffect, useRef, useState } from 'react';
import { useInputEngine } from '../lib/engine';

type Engine = ReturnType<typeof useInputEngine>;

export default function DemoTab({ engine }: { engine: Engine }) {
  const engineRef = useRef(engine);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const customInputRef = useRef<HTMLInputElement>(null);
  const [customWord, setCustomWord] = useState('');
  
  useEffect(() => {
      engineRef.current = engine;
  }, [engine]);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isOutputActive = activeEl === textareaRef.current;
      const isBodyActive = activeEl === document.body;
      
      // If user is focused on the custom word input or other inputs, do nothing
      if (!isOutputActive && !isBodyActive && activeEl?.tagName === 'INPUT') return;
      if (!isOutputActive && !isBodyActive && activeEl?.tagName === 'TEXTAREA') return;

      if (e.ctrlKey || e.metaKey || e.altKey) return;
      
      const currentEngine = engineRef.current;

      if (e.key === 'Backspace') {
        if (currentEngine.keyBuffer.length > 0) {
            e.preventDefault();
            currentEngine.handleBackspace();
        } else {
            // let the textarea handle backspace naturally
        }
      } else if (/^[a-z]$/.test(e.key)) {
        e.preventDefault(); // prevent typing a-z directly into textarea
        currentEngine.appendKey(e.key.toLowerCase());
      } else if (e.key === '-' || e.key === '=') {
        if (currentEngine.keyBuffer) {
            e.preventDefault();
            if (e.key === '-') {
                currentEngine.prevPage();
            } else {
                currentEngine.nextPage();
            }
        }
      } else if (e.key === '[') {
          if (currentEngine.keyBuffer) {
              e.preventDefault();
              currentEngine.shrinkSegment();
          }
      } else if (e.key === ']') {
          if (currentEngine.keyBuffer) {
              e.preventDefault();
              currentEngine.expandSegment();
          }
      } else if (e.key === 'Tab') {
          if (currentEngine.keyBuffer) {
              e.preventDefault();
              if (document.activeElement === textareaRef.current) {
                  customInputRef.current?.focus();
              } else {
                  textareaRef.current?.focus();
              }
          }
      } else if (e.key === ' ' || /^[1-8]$/.test(e.key)) {
        if (currentEngine.keyBuffer) {
            e.preventDefault();
            const index = e.key === ' ' ? 0 : parseInt(e.key) - 1;
            if (index < currentEngine.candidates.length) {
                // handle manual insertion at cursor
                const chosen = currentEngine.candidates[index];
                const ta = textareaRef.current;
                if (ta && chosen) {
                    const start = ta.selectionStart;
                    const end = ta.selectionEnd;
                    const text = currentEngine.inputText;
                    const newText = text.substring(0, start) + chosen.text + text.substring(end);
                    currentEngine.setInputText(newText);
                    // Update cursor position after React re-renders
                    setTimeout(() => {
                        ta.selectionStart = ta.selectionEnd = start + chosen.text.length;
                    }, 0);
                } else if (chosen) {
                    currentEngine.setInputText(currentEngine.inputText + chosen.text);
                }
                currentEngine.commitCandidate(index, false); // autoAppend=false
            }
        } else {
            // space when no buffer -> let it type space naturally!
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] w-full animate-in fade-in zoom-in-95 duration-300 relative">
        {engine.isDictLoading && (
            <div className="absolute top-0 right-0 text-xs text-zinc-500 bg-zinc-100/80 px-3 py-1.5 rounded-full flex items-center gap-2 border border-zinc-200 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                挂载外接拼音词库中...
            </div>
        )}
        {/* Upper: Output Text */}
        <div className="relative flex items-center justify-center mb-16 min-h-[60px] w-full max-w-lg">
            <textarea
                ref={textareaRef}
                value={engine.inputText}
                onChange={(e) => engine.setInputText(e.target.value)}
                placeholder="开始打字..."
                className="text-3xl md:text-5xl tracking-widest font-medium text-zinc-900 text-center break-all w-full bg-transparent resize-none outline-none placeholder:text-zinc-200 min-h-[1.5em] overflow-hidden"
                rows={1}
            />
            {engine.inputText && (
                <button 
                    onClick={() => engine.clearInput()}
                    className="absolute -right-4 translate-x-full top-1/2 -translate-y-1/2 text-zinc-300 hover:text-zinc-500 transition-colors p-2"
                    title="清空内容"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                </button>
            )}
        </div>

        {/* Middle: Candidate List */}
        <div className="flex flex-wrap items-center justify-center gap-3 min-h-[50px] mb-12 w-full">
            {engine.candidates.map((c, i) => (
                <button 
                    key={`${c.text}-${i}`}
                    onClick={() => {
                        const ta = textareaRef.current;
                        if (ta) {
                            const start = ta.selectionStart;
                            const end = ta.selectionEnd;
                            const text = engine.inputText;
                            const newText = text.substring(0, start) + c.text + text.substring(end);
                            engine.setInputText(newText);
                            setTimeout(() => {
                                ta.focus();
                                ta.selectionStart = ta.selectionEnd = start + c.text.length;
                            }, 0);
                        } else {
                            engine.setInputText(engine.inputText + c.text);
                        }
                        engine.commitCandidate(i, false);
                    }}
                    className={`px-4 py-2 rounded-xl transition-all duration-200 text-lg flex items-center
                        ${i === 0 
                            ? 'bg-zinc-900 text-white shadow-md hover:bg-zinc-800' 
                            : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200'}`}
                >
                    <span className={`text-[10px] mr-2 opacity-50 font-mono tracking-tighter ${i===0 ? 'text-zinc-300' : 'text-zinc-500'}`}>
                        {i === 0 ? 'Space' : i + 1}
                    </span>
                    {c.text}
                </button>
            ))}
            
            {engine.keyBuffer && engine.totalPages > 1 && (
                <div className="flex items-center gap-1 mx-2">
                    <button 
                        onClick={() => engine.prevPage()}
                        disabled={engine.pageIndex === 0}
                        className="p-1 px-2 text-zinc-400 hover:text-zinc-800 disabled:opacity-30 transition-colors"
                        title="上一页 (-)"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                    </button>
                    <span className="text-xs text-zinc-400 font-mono">
                        {engine.pageIndex + 1}/{engine.totalPages}
                    </span>
                    <button 
                        onClick={() => engine.nextPage()}
                        disabled={engine.pageIndex >= engine.totalPages - 1}
                        className="p-1 px-2 text-zinc-400 hover:text-zinc-800 disabled:opacity-30 transition-colors"
                        title="下一页 (=)"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                    </button>
                </div>
            )}

            {engine.keyBuffer && (
                <div className="flex items-center bg-zinc-100 hover:bg-zinc-200 transition-colors duration-200 rounded-xl overflow-hidden shadow-sm h-[44px]">
                    <input
                        ref={customInputRef}
                        type="text"
                        placeholder="添加词"
                        value={customWord}
                        onChange={(e) => setCustomWord(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && customWord.trim()) {
                                const ta = textareaRef.current;
                                const text = customWord.trim();
                                if (ta) {
                                    const start = ta.selectionStart;
                                    const end = ta.selectionEnd;
                                    const currentText = engine.inputText;
                                    const newText = currentText.substring(0, start) + text + currentText.substring(end);
                                    engine.setInputText(newText);
                                    setTimeout(() => {
                                        ta.focus();
                                        ta.selectionStart = ta.selectionEnd = start + text.length;
                                    }, 0);
                                } else {
                                    engine.setInputText(engine.inputText + text);
                                }
                                engine.teachWord(text, engine.keyBuffer);
                                engine.clearBuffer();
                                setCustomWord('');
                            }
                            if (e.key === 'Backspace') {
                                e.stopPropagation();
                            }
                        }}
                        className="w-16 h-full px-3 bg-transparent text-sm text-zinc-700 focus:outline-none placeholder:text-zinc-400 font-medium"
                    />
                    <button
                        onClick={() => {
                            const text = customWord.trim();
                            if (text) {
                                const ta = textareaRef.current;
                                if (ta) {
                                    const start = ta.selectionStart;
                                    const end = ta.selectionEnd;
                                    const currentText = engine.inputText;
                                    const newText = currentText.substring(0, start) + text + currentText.substring(end);
                                    engine.setInputText(newText);
                                    setTimeout(() => {
                                        ta.focus();
                                        ta.selectionStart = ta.selectionEnd = start + text.length;
                                    }, 0);
                                } else {
                                    engine.setInputText(engine.inputText + text);
                                }
                                engine.teachWord(text, engine.keyBuffer);
                                engine.clearBuffer();
                                setCustomWord('');
                            }
                        }}
                        className="h-full px-2 text-zinc-400 hover:text-zinc-800 hover:bg-zinc-300 transition-colors"
                        title="学习新词"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    </button>
                </div>
            )}
        </div>

        {/* Lower: Pinyin Input Buffer */}
        <div className="text-2xl md:text-3xl font-mono text-zinc-500 relative inline-block border-b-2 border-transparent transition-colors min-h-[40px]">
            {engine.keyBuffer ? (
                <>
                    {(() => {
                        const targetLen = engine.activeSegmentLen !== null ? engine.activeSegmentLen : (engine.candidates.length > 0 ? engine.candidates[0].consumeLen : engine.keyBuffer.length);
                        const highlighted = engine.keyBuffer.slice(0, targetLen);
                        const rest = engine.keyBuffer.slice(targetLen);
                        return (
                            <span>
                                <span className="bg-zinc-800 text-white rounded px-1">{highlighted}</span>
                                <span>{rest}</span>
                            </span>
                        );
                    })()}
                    <span className="w-0.5 h-[1.2em] bg-zinc-400 absolute right-[-8px] top-1/2 -translate-y-1/2 animate-pulse"></span>
                </>
            ) : (
                <span className="opacity-0">placeholder</span>
            )}
            {!engine.keyBuffer && (
                <span className="w-0.5 h-[1.2em] bg-zinc-300 absolute left-0 top-1/2 -translate-y-1/2 animate-pulse"></span>
            )}
        </div>
        
        <div className="mt-16 flex flex-col items-center gap-1 text-xs text-zinc-400 uppercase tracking-widest font-medium">
            <span>Type with Keyboard (A-Z, Space, 1-8)</span>
            <span className="opacity-70">Use [ ] to manually slice pinyin bounds, Shift+Tab / Tab to switch focus</span>
        </div>
    </div>
  )
}
