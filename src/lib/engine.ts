import { useState, useCallback, useMemo } from 'react';
import GENERATED_VOCAB from './generated-dict.json';
import { parsePinyinTxt } from './dict';

export const MOCK_VOCAB = GENERATED_VOCAB;

export type NeuralWeights = {
    base: Record<string, number>;
    adapter: Record<string, number>;
    customVocab: Array<{ text: string, pinyin: string, initials: string, weight: number }>;
};

const defaultWeights: NeuralWeights = {
    base: {},
    adapter: {},
    customVocab: []
};

function loadWeights(): NeuralWeights {
    try {
        const stored = localStorage.getItem('nn_weights');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (!parsed.customVocab) parsed.customVocab = [];
            return parsed;
        }
    } catch(e) {}
    return defaultWeights;
}

export type Candidate = { text: string; pinyin: string; score: number; consumeLen: number; matchType: string };

// Start using MOCK_VOCAB as initial state only
export function useInputEngine() {
  const [baseVocab] = useState(MOCK_VOCAB);
  const [isDictLoading] = useState(false);
  const [weights, setWeights] = useState<NeuralWeights>(loadWeights);
  const [inputText, setInputText] = useState("");
  const [keyBuffer, setKeyBuffer] = useState("");
  const [pageIndex, setPageIndex] = useState(0);

  const updateWeights = useCallback((updater: (prev: NeuralWeights) => NeuralWeights) => {
      setWeights(prev => {
          const next = updater(prev);
          localStorage.setItem('nn_weights', JSON.stringify(next));
          return next;
      });
  }, []);

  const allCandidates = useMemo(() => {
     if (!keyBuffer) return [];
     
     const combinedVocab = [...baseVocab, ...weights.customVocab];
     const mapped = combinedVocab.map(v => {
        let score = 0;
        let consumeLen = 0;
        let matchType = '';
        
        if (keyBuffer.startsWith(v.pinyin)) { score = v.weight + 500; consumeLen = v.pinyin.length; matchType = 'full'; }
        else if (v.pinyin.startsWith(keyBuffer)) { score = v.weight + 300; consumeLen = keyBuffer.length; matchType = 'prefix'; }
        else if (keyBuffer.startsWith(v.initials)) { score = v.weight + 100; consumeLen = v.initials.length; matchType = 'initials'; }
        else if (v.initials.startsWith(keyBuffer)) { score = v.weight; consumeLen = keyBuffer.length; matchType = 'initials_prefix'; }
        
        if (score > 0) {
            score += (weights.base[v.text] || 0);
            score += (weights.adapter[v.text] || 0);
        }
        
        return score > 0 ? { ...v, score, consumeLen, matchType } : null;
     }).filter(Boolean) as Candidate[];
     
     mapped.sort((a, b) => b.score - a.score);
     return mapped;
  }, [keyBuffer, weights, baseVocab]);

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
      
      // 增量同步自定义权重 (On-device Customization)
      if (index > 0 || pageIndex > 0) {
          updateWeights(w => ({
              ...w,
              adapter: {
                  ...w.adapter,
                  [chosen.text]: (w.adapter[chosen.text] || 0) + 50
              }
          }));
      } else {
          updateWeights(w => ({
              ...w,
              adapter: {
                  ...w.adapter,
                  [chosen.text]: (w.adapter[chosen.text] || 0) + 2
              }
          }));
      }
      
      setKeyBuffer(prevBuffer => prevBuffer.slice(chosen.consumeLen));
      setPageIndex(0);
  }, [candidates, updateWeights, pageIndex]);

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
      totalPages: Math.ceil(allCandidates.length / 8)
  };
}
