export class MLP {
    inputSize: number;
    hiddenSize: number;
    outputSize: number;
    w1: number[][];
    b1: number[];
    w2: number[][];
    b2: number[];

    constructor(inputSize: number = 3, hiddenSize: number = 8, outputSize: number = 1) {
        this.inputSize = inputSize;
        this.hiddenSize = hiddenSize;
        this.outputSize = outputSize;
        this.w1 = Array.from({ length: inputSize }, () => Array.from({ length: hiddenSize }, () => Math.random() - 0.5));
        this.b1 = Array.from({ length: hiddenSize }, () => Math.random() - 0.5);
        this.w2 = Array.from({ length: hiddenSize }, () => Array.from({ length: outputSize }, () => Math.random() - 0.5));
        this.b2 = Array.from({ length: outputSize }, () => Math.random() - 0.5);
        this.bootstrap();
    }

    bootstrap() {
        // Pre-train the network on fabricated typical data distributions 
        // to ensure it behaves reasonably before the user heavily interacts with it.
        for (let i = 0; i < 500; i++) {
            this.train([1.0, 1.0, 1.0], [0.9]); // exact match, high base, high usage -> high prob
            this.train([1.0, 1.0, 0.0], [0.8]); // exact match, high base, no usage -> med-high prob
            this.train([0.0, 1.0, 1.0], [0.6]); // prefix match, high base, high usage -> med prob
            this.train([0.0, 1.0, 0.0], [0.4]); // prefix match, high base, no usage -> med-low prob
            this.train([0.0, 0.1, 0.0], [0.1]); // prefix match, low base, no usage -> lowest prob
            this.train([1.0, 0.1, 0.0], [0.5]); // exact match, low base, no usage -> med prob
        }
    }

    static relu(x: number) { return Math.max(0, x); }
    static d_relu(x: number) { return x > 0 ? 1 : 0; }
    static sigmoid(x: number) { return 1 / (1 + Math.exp(-x)); }
    static d_sigmoid(x: number) { const s = MLP.sigmoid(x); return s * (1 - s); }

    forward(input: number[]) {
        const hidden = new Array(this.hiddenSize).fill(0);
        for (let j = 0; j < this.hiddenSize; j++) {
            let sum = this.b1[j];
            for (let i = 0; i < this.inputSize; i++) {
                sum += input[i] * this.w1[i][j];
            }
            hidden[j] = MLP.relu(sum);
        }

        const output = new Array(this.outputSize).fill(0);
        for (let k = 0; k < this.outputSize; k++) {
            let sum = this.b2[k];
            for (let j = 0; j < this.hiddenSize; j++) {
                sum += hidden[j] * this.w2[j][k];
            }
            output[k] = MLP.sigmoid(sum);
        }
        return { hidden, output };
    }

    predict(input: number[]) {
        return this.forward(input).output;
    }

    train(input: number[], target: number[], lr: number = 0.1) {
        const { hidden, output } = this.forward(input);

        // Calculate deltas for output layer
        const d_output = new Array(this.outputSize).fill(0);
        for (let k = 0; k < this.outputSize; k++) {
            const error = target[k] - output[k];
            d_output[k] = error * MLP.d_sigmoid(output[k]);
        }

        // Calculate deltas for hidden layer
        const d_hidden = new Array(this.hiddenSize).fill(0);
        for (let j = 0; j < this.hiddenSize; j++) {
            let error = 0;
            for (let k = 0; k < this.outputSize; k++) {
                error += d_output[k] * this.w2[j][k];
            }
            d_hidden[j] = error * MLP.d_relu(hidden[j]);
        }

        // Update Weights and Biases (Hidden -> Output)
        for (let k = 0; k < this.outputSize; k++) {
            this.b2[k] += lr * d_output[k];
            for (let j = 0; j < this.hiddenSize; j++) {
                this.w2[j][k] += lr * d_output[k] * hidden[j];
            }
        }

        // Update Weights and Biases (Input -> Hidden)
        for (let j = 0; j < this.hiddenSize; j++) {
            this.b1[j] += lr * d_hidden[j];
            for (let i = 0; i < this.inputSize; i++) {
                this.w1[i][j] += lr * d_hidden[j] * input[i];
            }
        }
    }

    serialize() {
        return { w1: this.w1, b1: this.b1, w2: this.w2, b2: this.b2 };
    }

    load(data: any) {
        if (data && data.w1 && data.w2) {
            this.w1 = data.w1;
            this.b1 = data.b1;
            this.w2 = data.w2;
            this.b2 = data.b2;
        }
    }
}
