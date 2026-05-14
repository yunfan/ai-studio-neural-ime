# Project Operation Principles & Technical Details

## 1. Core Concept
This project models a "local, on-device neural input method". Unlike traditional statistical input methods (like classical n-gram configurations) or purely cloud-based LLM APIs, it utilizes a lightweight, functional Neural Network executed directly in the browser via JavaScript.

## 2. On-Device Real Neural Network (MLP)
The candidate scoring is driven by a custom-built Multi-Layer Perceptron (MLP) (`src/lib/nn.ts`).
- **Input Features:** 
  1. `isExactMatch` (whether the raw input perfectly matches the start or entirety of the Pinyin).
  2. `baseRankScore` (normalized static dictionary weight).
  3. `normalizedUsage` (user-specific usage frequency normalized between 0 and 1).
- **Hidden Layer:** A lightweight intermediate mapping (e.g., 8 neurons) with ReLU activation allowing it to uncover nonlinear interactions (e.g., frequency weighing heavier only on exact matches).
- **Output Layer:** A singular Sigmoid activated neuron producing a probability score (0.0 to 1.0) indicating how likely this candidate is the target.

## 2.1 Dynamic Pinyin Segmentation
The engine does not strictly require exact exact match for the whole input string `keyBuffer`. It intelligently matches prefixes and predicts the optimal slice through the typing sequence.
- Users can manually override the neural network's suggested bounds by pressing `[`/`]` keys (`shrinkSegment`/`expandSegment`).
- Manual slicing truncates the evaluated Pinyin context, forcing candidates into specific segment boundaries.
- The UI visibly highlights the bounds of the top selected candidate to indicate which slice spacebar will consume.

## 3. Real-Time On-Device Learning (Backpropagation)
When the user types and selects a candidate (e.g., using spacebar or number keys), the engine doesn't just bump a frequency counter. 
1. It gathers the input features for the selected word and treats it as a target output of `1.0`.
2. It gathers the input features for the rejected visible candidates and treats them as a target output of `0.0`.
3. It performs **stochastic gradient descent (backpropagation)** over the network's weights locally. 
This means the Neural Network is dynamically adapting to the user's specific context over time, refining its weights to personalize candidate curation.

## 4. Dictionary & Vocabulary
The system relies on a large offline dataset initialized from `pinyin.txt` (converted to `generated-dict.json` during the build process) which holds over 50,000 Pinyin-character maps. The engine seamlessly merges global base vocabulary and user-defined custom definitions into the inference stream.

## 5. Compute Backends & Concurrency
The engine supports delegating the localized MLP inferences across various backends (`CPU`, `Web Worker`, `WASM`, `WebGL`, `WebGPU`) configurable in the UI. 
- **CPU:** Standard main-thread JavaScript execution.
- **Web Worker:** Spawns a background thread that executes the MLP array calculations so the UI remains fluid even with large dictionaries.
- **WASM/WebGL/WebGPU:** Architectural targets for handling exceptionally large dictionaries and expanded neural networks via high-concurrency pathways.

## 6. Offline & Privacy
All inferences (`predict()`) and training iterations (`train()`) execute in memory during the session and are serialized via `localStorage` on the user's browser, satisfying strict privacy constraints without remote servers.
