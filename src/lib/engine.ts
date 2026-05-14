import { useState, useCallback, useMemo, useEffect } from 'react';
import { GENERATED_VOCAB } from './dict-data/index';
import { parsePinyinTxt } from './dict';
import { MLP } from './nn';
import { predictBatch, ComputeBackend } from './backends';

export const MOCK_VOCAB = GENERATED_VOCAB;

export type NeuralWeights = {
    base: Record<string, number>;
    adapter: Record<string, number>;
    customVocab: Array<{ text: string, pinyin: string, initials: string, weight: number }>;
    nnModel?: any;
};

const defaultMLP = new MLP();
const defaultWeights: NeuralWeights = {
    base: {},
    adapter: {},
    customVocab: [],
    nnModel: defaultMLP.serialize()
};

function loadWeights(): NeuralWeights {
    try {
        const stored = localStorage.getItem('nn_weights');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (!parsed.customVocab) parsed.customVocab = [];
            if (!parsed.nnModel) parsed.nnModel = defaultMLP.serialize();
            return parsed;
        }
    } catch(e) {}
    return defaultWeights;
}

export type Candidate = { text: string; pinyin: string; score: number; consumeLen: number; matchType: string; nnInputs: number[] };

// Start using MOCK_VOCAB as initial state only
export function useInputEngine() {
  const [baseVocab] = useState(MOCK_VOCAB);
  const [isDictLoading] = useState(false);
  const [weights, setWeights] = useState<NeuralWeights>(loadWeights);
  const [inputText, setInputText] = useState("");
  const [keyBuffer, setKeyBuffer] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [backend, setBackend] = useState<ComputeBackend>('cpu');
  const [allCandidates, setAllCandidates] = useState<Candidate[]>([]);

  const mlp = useMemo(() => {
      const net = new MLP();
      if (weights.nnModel) {
          net.load(weights.nnModel);
      }
      return net;
  }, [weights.nnModel]);

  const updateWeights = useCallback((updater: (prev: NeuralWeights) => NeuralWeights) => {
      setWeights(prev => {
          const next = updater(prev);
          localStorage.setItem('nn_weights', JSON.stringify(next));
          return next;
      });
  }, []);

  useEffect(() => {
     if (!keyBuffer) {
         setAllCandidates([]);
         return;
     }

     let active = true;
     const combinedVocab = [...baseVocab, ...weights.customVocab];
     const filtered: any[] = [];

     for (const v of combinedVocab) {
        let isExactMatch = 0;
        let consumeLen = 0;
        let matchType = '';
        
        if (keyBuffer.startsWith(v.pinyin)) { consumeLen = v.pinyin.length; matchType = 'full'; isExactMatch = 1.0; }
        else if (v.pinyin.startsWith(keyBuffer)) { consumeLen = keyBuffer.length; matchType = 'prefix'; }
        else if (keyBuffer.startsWith(v.initials)) { consumeLen = v.initials.length; matchType = 'initials'; isExactMatch = 1.0; }
        else if (v.initials.startsWith(keyBuffer)) { consumeLen = keyBuffer.length; matchType = 'initials_prefix'; }
        else { continue; }

        filtered.push({ v, isExactMatch, consumeLen, matchType });
     }

     const inputs = filtered.map(f => {
         const usageCount = weights.adapter[f.v.text] || 0;
         const normalizedUsage = Math.min(1.0, usageCount / 50.0);
         const baseRankScore = (f.v.weight || 10) / 100.0;
         return [f.isExactMatch, baseRankScore, normalizedUsage];
     });

     predictBatch(backend, mlp, inputs).then(probabilities => {
         if (!active) return;
         const mapped = filtered.map((f, i) => {
             const probability = probabilities[i];
             const score = probability * 10000 + (f.isExactMatch * 10);
             return { ...f.v, score, consumeLen: f.consumeLen, matchType: f.matchType, nnInputs: inputs[i] };
         });
         mapped.sort((a, b) => b.score - a.score);
         setAllCandidates(mapped);
     });

     return () => { active = false; };
  }, [keyBuffer, weights.customVocab, weights.adapter, baseVocab, mlp, backend]);

  const candidates = useMemo(() => {
      return allCandidates.slice(pageIndex * 8, (pageIndex + 1) * 8);
  }, [allCandidates, pageIndex]);

  const nextPage = useCallback(() => {
     setPageIndex(prev => (prev + 1) * 8 < allCandidates.length ? prev + 1 : prev);
  }, [allCandidates.length]);

  const prevPage = useCallback(() => {
     setPageIndex(prev => prev > 0 ? prev - 1 : 0);
  }, []);

  const appendKey = useCallback((char: string) => {
      setKeyBuffer(prev => {
          if (prev.length >= 20) return prev;
          return prev + char;
      });
      setPageIndex(0);
  }, []);

  const commitCandidate = useCallback((index: number, autoAppend: boolean = true) => {
      const chosen = candidates[index];
      if (!chosen) return;
      
      if (autoAppend) {
          setInputText(prevText => prevText + chosen.text);
      }
      
      const newMlp = new MLP();
      if (weights.nnModel) newMlp.load(weights.nnModel);

      // On-Device Train Neural Net: Train the chosen word positively
      newMlp.train(chosen.nnInputs, [1.0], 0.1);

      // Negative reinforcement for visibly skipped options above
      candidates.forEach((c, idx) => {
          if (idx !== index) {
              newMlp.train(c.nnInputs, [0.0], 0.05); // smaller learning rate so it doesn't overly penalize
          }
      });
      
      // Update Neural Weights and adapter frequency 
      updateWeights(w => ({
          ...w,
          adapter: {
              ...w.adapter,
              [chosen.text]: (w.adapter[chosen.text] || 0) + 1
          },
          nnModel: newMlp.serialize()
      }));
      
      setKeyBuffer(prevBuffer => prevBuffer.slice(chosen.consumeLen));
      setPageIndex(0);
  }, [candidates, updateWeights, weights.nnModel]);

  const handleBackspace = useCallback(() => {
      setKeyBuffer(prev => {
          if (prev.length > 0) return prev.slice(0, -1);
          return prev;
      });
      setPageIndex(0);
  }, []);

  const clearInput = useCallback(() => {
     setInputText("");
     setKeyBuffer("");
     setPageIndex(0);
  }, []);

  const teachWord = useCallback((text: string, pinyin: string) => {
      if (!text || !pinyin) return;
      const initials = pinyin.split(/(?=[a-z])/).map(c => c[0]).join(''); // simplistic initial grab
      
      updateWeights(w => {
          // If word already exists in baseVocab or customVocab, just boost adapter
          const exists = [...baseVocab, ...w.customVocab].find(v => v.text === text);
          if (exists) {
              return {
                 ...w,
                 adapter: {
                     ...w.adapter,
                     [text]: (w.adapter[text] || 0) + 100
                 }
              };
          }
          
          return {
              ...w,
              customVocab: [
                 ...w.customVocab,
                 { text, pinyin, initials, weight: 100 }
              ],
              adapter: {
                  ...w.adapter,
                  [text]: 100
              }
          };
      });
  }, [baseVocab, updateWeights]);

  const bulkTrain = useCallback((items: Array<{text: string, pinyin: string, initials: string, weight: number}>) => {
      updateWeights(w => {
          const baseTexts = new Set(baseVocab.map(v => v.text));
          const existingText = new Set(w.customVocab.map(v => v.text));
          const newVocab = [...w.customVocab];
          const newAdapter = { ...w.adapter };
          
          for (const item of items) {
              if (existingText.has(item.text) || baseTexts.has(item.text)) {
                  newAdapter[item.text] = (newAdapter[item.text] || 0) + item.weight;
              } else {
                  newVocab.push(item);
                  existingText.add(item.text);
                  newAdapter[item.text] = (newAdapter[item.text] || 0) + item.weight;
              }
          }
          
          return {
              ...w,
              customVocab: newVocab,
              adapter: newAdapter
          };
      });
  }, [baseVocab, updateWeights]);

  return {
      inputText,
      keyBuffer,
      candidates,
      weights,
      isDictLoading,
      updateWeights,
      appendKey,
      handleBackspace,
      commitCandidate,
      clearInput,
      teachWord,
      bulkTrain,
      setInputText,
      nextPage,
      prevPage,
      pageIndex,
      totalPages: Math.ceil(allCandidates.length / 8),
      backend,
      setBackend
  };
}
