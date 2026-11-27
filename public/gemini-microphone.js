// Batch 50 ms of mono PCM per message. The capture AudioContext runs at 16 kHz.
class GeminiMicrophone extends AudioWorkletProcessor {
  constructor() {
    super();
    this.samples = new Int16Array(800);
    this.used = 0;
  }

  process(inputs) {
    for (const value of inputs[0]?.[0] || []) {
      const sample = Math.max(-1, Math.min(1, value));
      this.samples[this.used++] = sample * (sample < 0 ? 32768 : 32767);
      if (this.used === this.samples.length) {
        this.port.postMessage(this.samples.buffer, [this.samples.buffer]);
        this.samples = new Int16Array(800);
        this.used = 0;
      }
    }
    return true;
  }
}
registerProcessor('gemini-microphone', GeminiMicrophone);
