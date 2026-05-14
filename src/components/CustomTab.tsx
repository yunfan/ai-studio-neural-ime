import { useRef, useState, ChangeEvent } from 'react';
import { useInputEngine, NeuralWeights } from '../lib/engine';
import { parsePinyinTxt } from '../lib/dict';

type Engine = ReturnType<typeof useInputEngine>;

export default function CustomTab({ engine }: { engine: Engine }) {
    const fileRef = useRef<HTMLInputElement>(null);
    const txtFileRef = useRef<HTMLInputElement>(null);
    const [msg, setMsg] = useState("");

    const handleExport = () => {
        // Merge base and adapter to simulate compiling into a single new model
        const mergedWeights: Record<string, number> = { ...engine.weights.base };
        for (const [k, v] of Object.entries(engine.weights.adapter)) {
            mergedWeights[k] = (mergedWeights[k] || 0) + v;
        }

        // 导出真实的融合成的单一模型配置（包含所有词汇权重及用户自定义词）
        const modelData = {
            metadata: {
                name: "Neural Input Model (Fine-tuned)",
                version: "3.0",
                type: "compiled_model",
                exportTime: new Date().toISOString(),
                architecture: "Hidden-State Streaming",
                quantization: "FP32",
                paramsCount: `${Object.keys(mergedWeights).length} Nodes`
            },
            modelStructure: {
                vocabSize: Object.keys(mergedWeights).length,
                customTokens: engine.weights.customVocab,
                nodes: mergedWeights
            }
        };
        const data = JSON.stringify(modelData, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'fused-neural-model.json';
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleImport = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                
                if (json.type === "compiled_model" && json.modelStructure) {
                    engine.updateWeights(() => ({
                        base: json.modelStructure.nodes,
                        adapter: {}, // Fused, so no separate adapter anymore
                        customVocab: json.modelStructure.customTokens || []
                    }));
                    setMsg("模型导入成功");
                    setTimeout(() => setMsg(""), 3000);
                } else {
                    // Fallback for older format
                    const params = json.modelParameters || json; 
                    if (params && params.adapter !== undefined && params.base !== undefined) {
                        engine.updateWeights(() => params);
                        setMsg("模型导入成功");
                        setTimeout(() => setMsg(""), 3000);
                    } else {
                        alert("不是有效的模型文件格式");
                    }
                }
            } catch (err) {
                alert("解析模型文件失败");
            }
        };
        reader.readAsText(file);
        
        // reset input
        if (fileRef.current) {
            fileRef.current.value = "";
        }
    };

    const handleTrainText = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const text = event.target?.result as string;
                const items = parsePinyinTxt(text);
                if (items.length > 0) {
                    engine.bulkTrain(items);
                    setMsg(`成功提取并融合 ${items.length} 个汉字的权重！`);
                    setTimeout(() => setMsg(""), 4000);
                } else {
                    alert("未能从该文本中解析出拼音格式数据。");
                }
            } catch (err) {
                alert("文本解析失败");
            }
        };
        reader.readAsText(file);
        
        // reset input
        if (txtFileRef.current) {
            txtFileRef.current.value = "";
        }
    };

    const mergedWeights: Record<string, number> = { ...engine.weights.base };
    for (const [k, v] of Object.entries(engine.weights.adapter)) {
        mergedWeights[k] = (mergedWeights[k] || 0) + v;
    }
    const fusedNodeCount = Object.keys(mergedWeights).length;
    const customVocabCount = engine.weights.customVocab?.length || 0;

    return (
        <div className="max-w-md mx-auto py-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <h2 className="text-xl font-semibold mb-2">模型本地化管理</h2>
            <p className="text-zinc-500 text-sm mb-8 leading-relaxed">
                管理处于内存中的神经网络端侧模型。训练过程中产生的权重更新会实时融合到模型中，导出时将打包为一个完整的特定版本模型（不再分离基础模型和增量权重）。
            </p>

            <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="bg-zinc-50 border border-zinc-100 p-4 rounded-xl">
                    <div className="text-[10px] text-zinc-400 mb-1 uppercase tracking-wider">Params</div>
                    <div className="text-xl font-mono text-zinc-800">{fusedNodeCount}</div>
                </div>
                <div className="bg-zinc-50 border border-zinc-100 p-4 rounded-xl">
                    <div className="text-[10px] text-zinc-400 mb-1 uppercase tracking-wider">Vocab Size</div>
                    <div className="text-xl font-mono text-zinc-800">{fusedNodeCount}</div>
                </div>
                <div className="bg-zinc-50 border border-zinc-100 p-4 rounded-xl">
                    <div className="text-[10px] text-zinc-400 mb-1 uppercase tracking-wider">Custom Tokens</div>
                    <div className="text-xl font-mono text-zinc-800">{customVocabCount}</div>
                </div>
            </div>

            <div className="flex flex-col gap-4 mb-8 relative">
                {msg && <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-emerald-50 text-emerald-600 px-4 py-1.5 rounded-full text-sm font-medium animate-in fade-in slide-in-from-bottom-2 whitespace-nowrap shadow-sm border border-emerald-100">{msg}</div>}
                
                <div className="flex gap-4">
                    <button 
                        onClick={() => fileRef.current?.click()}
                        className="flex-1 py-3 bg-zinc-100 text-zinc-700 rounded-xl font-medium hover:bg-zinc-200 transition-colors"
                    >
                        导入完整模型
                    </button>
                    <input 
                        type="file" 
                        accept=".json"
                        ref={fileRef}
                        className="hidden"
                        onChange={handleImport}
                    />
                    <button 
                        onClick={handleExport}
                        className="flex-1 py-3 bg-zinc-900 text-white rounded-xl font-medium hover:bg-zinc-800 transition-colors"
                    >
                        导出模型备份
                    </button>
                </div>
                
                <button 
                    onClick={() => txtFileRef.current?.click()}
                    className="w-full py-3 bg-white text-zinc-700 rounded-xl font-medium hover:bg-zinc-50 border border-zinc-200 border-dashed transition-colors"
                >
                    导入预训练集 (.txt)
                </button>
                <input 
                    type="file" 
                    accept=".txt"
                    ref={txtFileRef}
                    className="hidden"
                    onChange={handleTrainText}
                />
            </div>
            
            <div className="mt-8">
                <div className="text-xs text-zinc-400 uppercase tracking-widest mb-3">Compiled Model Nodes</div>
                <div className="bg-zinc-900 text-emerald-400 p-4 rounded-xl font-mono text-xs overflow-y-auto max-h-[200px] shadow-inner custom-scrollbar relative overflow-hidden">
                    {Object.entries(mergedWeights)
                        .sort((a, b) => b[1] - a[1]) // highest weights first
                        .slice(0, 50).map(([k, v]) => (
                        <div key={k} className="flex justify-between mb-1 hover:bg-zinc-800/50 px-2 -mx-2 rounded transition-colors">
                            <span>{k}</span>
                            <span className="opacity-50">{v}</span>
                        </div>
                    ))}
                    {fusedNodeCount > 50 && (
                        <div className="opacity-50 mt-2 truncate pt-2 border-t border-zinc-800">
                            ... and {fusedNodeCount - 50} more fused context nodes
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
