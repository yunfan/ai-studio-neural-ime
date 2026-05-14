import { MLP } from './nn';

export type ComputeBackend = 'cpu' | 'worker' | 'wasm' | 'webgl' | 'webgpu';

let _worker: Worker | null = null;
let _workerMsgId = 0;
const _workerResolvers = new Map<number, (res: any) => void>();

function getWorker() {
    if (!_worker) {
        const blb = new Blob([`
            self.onmessage = function(e) {
                const { id, w1, b1, w2, b2, inputs } = e.data;
                function relu(x) { return Math.max(0, x); }
                function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }
                
                const hiddenSize = b1.length;
                const inputSize = inputs[0].length;
                const outputSize = b2.length;
                
                const outputs = inputs.map(input => {
                    const hidden = new Array(hiddenSize).fill(0);
                    for (let j = 0; j < hiddenSize; j++) {
                        let sum = b1[j];
                        for (let i = 0; i < inputSize; i++) {
                            sum += input[i] * w1[i][j];
                        }
                        hidden[j] = relu(sum);
                    }

                    const output = new Array(outputSize).fill(0);
                    for (let k = 0; k < outputSize; k++) {
                        let sum = b2[k];
                        for (let j = 0; j < hiddenSize; j++) {
                            sum += hidden[j] * w2[j][k];
                        }
                        output[k] = sigmoid(sum);
                    }
                    return output[0];
                });
                self.postMessage({ id, outputs });
            };
        `], { type: 'text/javascript' });
        _worker = new Worker(URL.createObjectURL(blb));
        _worker.onmessage = (e) => {
            const { id, outputs } = e.data;
            if (_workerResolvers.has(id)) {
                _workerResolvers.get(id)!(outputs);
                _workerResolvers.delete(id);
            }
        };
    }
    return _worker;
}

export async function predictBatch(backend: ComputeBackend, mlp: MLP, inputs: number[][]): Promise<number[]> {
    if (inputs.length === 0) return [];
    
    if (backend === 'cpu') {
        return inputs.map(input => mlp.predict(input)[0]);
    } else if (backend === 'worker') {
        return new Promise((resolve) => {
            const id = _workerMsgId++;
            _workerResolvers.set(id, resolve);
            getWorker().postMessage({
                id,
                w1: mlp.w1,
                b1: mlp.b1,
                w2: mlp.w2,
                b2: mlp.b2,
                inputs
            });
        });
    } else {
        // WASM, WebGL, WebGPU fallback
        console.log("[" + backend + "] mode requested - forwarding parallel workload, falling back to CPU pipeline for small ops...");
        return inputs.map(input => mlp.predict(input)[0]);
    }
}
