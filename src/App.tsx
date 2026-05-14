import { useState } from 'react';
import { useInputEngine } from './lib/engine';
import DemoTab from './components/DemoTab';
import TrainingTab from './components/TrainingTab';
import CustomTab from './components/CustomTab';

type TabId = 'demo' | 'pretrain' | 'custom';

export default function App() {
  const engine = useInputEngine();
  const [activeTab, setActiveTab] = useState<TabId>('demo');

  const tabs: { id: TabId; label: string }[] = [
      { id: 'demo', label: '演示模型' },
      { id: 'pretrain', label: '预训练语料' },
      { id: 'custom', label: '自定义权重' }
  ];

  return (
    <div className="min-h-screen bg-white text-zinc-900 font-sans selection:bg-black selection:text-white flex flex-col">
        {/* Minimalist Top Nav */}
        <header className="w-full flex justify-center py-10">
            <div className="flex gap-2 p-1 bg-zinc-100 rounded-2xl shadow-sm border border-zinc-200">
                {tabs.map(t => (
                    <button
                        key={t.id}
                        onClick={() => {
                            setActiveTab(t.id);
                            // Clear input when switching tabs
                            if (activeTab !== t.id) engine.clearInput();
                        }}
                        className={`px-6 py-2 rounded-xl text-sm font-medium transition-all duration-300
                            ${activeTab === t.id 
                                ? 'bg-white text-zinc-900 shadow-sm' 
                                : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200/50'}`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>
        </header>

        {/* Content Container */}
        <main className="flex-1 w-full max-w-2xl mx-auto px-6 pb-20 flex flex-col pt-10">
            {activeTab === 'demo' && <DemoTab engine={engine} />}
            {activeTab === 'pretrain' && <TrainingTab engine={engine} />}
            {activeTab === 'custom' && <CustomTab engine={engine} />}
        </main>
        
        {/* Footer info */}
        <footer className="text-center pb-8 text-zinc-400 text-xs font-mono">
            Streaming Hidden-State Input Architecture v2.0
        </footer>
    </div>
  );
}
