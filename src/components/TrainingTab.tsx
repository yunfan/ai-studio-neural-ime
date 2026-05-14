import { useState, useEffect } from 'react';
import { useInputEngine } from '../lib/engine';

type Engine = ReturnType<typeof useInputEngine>;

export default function TrainingTab({ engine }: { engine: Engine }) {
    const [isTraining, setIsTraining] = useState(false);
    const [progress, setProgress] = useState(0);

    const startTraining = () => {
        setIsTraining(true);
        setProgress(0);
    };

    useEffect(() => {
        if (!isTraining) return;
        
        const interval = setInterval(() => {
            setProgress(p => {
                if (p >= 100) {
                    setIsTraining(false);
                    clearInterval(interval);
                    
                    // Simulate updating base metrics
                    engine.updateWeights(w => {
                        const newBase = { ...w.base };
                        // Mock adding generic weights to vocabulary words
                        ['流式', '端侧', '模型', '架构'].forEach(word => {
                            newBase[word] = (newBase[word] || 0) + 100;
                        });
                        return { ...w, base: newBase };
                    });
                    
                    return 100;
                }
                return p + Math.floor(Math.random() * 15) + 5;
            });
        }, 300);

        return () => clearInterval(interval);
    }, [isTraining, engine]);

    return (
        <div className="max-w-md mx-auto py-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <h2 className="text-xl font-semibold mb-2">云端级预训练同步</h2>
            <p className="text-zinc-500 text-sm mb-8 leading-relaxed">
                利用开源中文语料进行宏观基础知识压缩。训练产物将直接修改内存中的基础模型映射权重（Base Adapter），形成全局共享的肌肉记忆骨架。
            </p>

            <div className="bg-zinc-50 p-6 rounded-2xl border border-zinc-100 flex flex-col items-center">
                <div className="text-zinc-400 mb-6 font-mono text-sm">
                    Model Size Limit: <span className="text-zinc-800 font-medium">10M Params</span>
                </div>

                <div className="w-full bg-zinc-200 rounded-full h-1.5 mb-6 overflow-hidden">
                    <div 
                        className="bg-zinc-900 h-1.5 rounded-full transition-all duration-300 ease-out" 
                        style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                </div>

                <button 
                    onClick={startTraining} 
                    disabled={isTraining}
                    className="w-full py-3 bg-zinc-900 text-white rounded-xl font-medium hover:bg-zinc-800 disabled:bg-zinc-300 disabled:text-zinc-500 transition-colors"
                >
                    {isTraining ? `正在同步并演化权重... ${progress}%` : '注入特定领域知识语料'}
                </button>
            </div>
        </div>
    );
}
