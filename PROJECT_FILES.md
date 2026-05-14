# Project Files Structure & Explanation

## Core Application Files
- `src/main.tsx`: Standard React entry point that mounts the `App` component into the DOM.
- `src/App.tsx`: Main structural component for the UI, handling navigation between different tabs (Input Demo, Customization, Principles).
- `src/index.css`: Global Tailwind CSS imports and basic utility styles.

## Components
- `src/components/DemoTab.tsx`: The primary interaction UI where users can type Pinyin and see candidates. It captures keystrokes and interfaces with the engine.
- `src/components/CustomTab.tsx`: UI for managing the on-device model, uploading custom vocabularies, and exporting/importing neural network configurations.
- `src/components/PrinciplesTab.tsx`: Static explanatory tab regarding the design philosophy. 

## Core Engine & AI Systems
- `src/lib/engine.ts`: The central orchestration hook (`useInputEngine`). It binds keystrokes to the underlying dictionary, neural network inference, and handles candidate pagination. State is persisted in `localStorage`.
- `src/lib/dict.ts`: Handles dictionary initialization and generic parsing operations.
- `src/lib/generated-dict.json`: Compressed built-in Pinyin dictionary database (generated at build time from `pinyin.txt`).
- `src/lib/nn.ts`: Contains a true from-scratch Multi-Layer Perceptron (MLP) Neural Network implementation. Supports forward propagation (inference) and backward propagation (training) for dynamic user scoring.
- `src/lib/backends.ts`: Manages different compute backends (CPU, Web Worker, WASM, WebGL, WebGPU). Includes a functional Web Worker implementation to offload NN inferences into background threads to avoid UI stalling.
