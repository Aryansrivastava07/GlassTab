import { googleSession, recordAiUsage } from './aiAccess';
export const LIVE_MODEL = 'gemini-3.8-live';
const endpoint = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.';

export function liveSocketUrl({ key, token }) {
  if (token) return endpoint + 'BidiGenerateContentConstrained?access_token=' + encodeURIComponent(token);
  if (key) return endpoint + 'BidiGenerateContent?key=' + encodeURIComponent(key);
  throw new Error('Add a Gemini voice key or sign in for shared voice access.');
}

export async function startGeminiLive({ shared = false, credential, instruction, signal, onStage, onTurn, onEnd }) {
  if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext) {
    throw new Error('Microphone access requires the extension, localhost, or HTTPS.');
  }
  if (shared) await googleSession();
  else await recordAiUsage('voice');
  signal.throwIfAborted();
  const context = new AudioContext({ sampleRate: 16000 });
  const playing = new Set();
  let socket, stream, microphone, capture, timer;
  let ready = false;
  let nextStart = 0;
  let input = '', output = '';
  function finishTurn() {
    if (input.trim() || output.trim()) onTurn(input.trim(), output.trim());
    input = output = '';
  }
  function interrupt() {
    for (const source of playing) { source.onended = null; source.stop(); source.disconnect(); }
    playing.clear();
    nextStart = 0;
  }
  function close() {
    clearTimeout(timer);
    interrupt();
    capture?.disconnect();
    microphone?.disconnect();
    stream?.getTracks().forEach(track => track.stop());
    if (socket) {
      socket.onmessage = socket.onopen = socket.onerror = socket.onclose = null;
      socket.close();
    }
    if (context.state !== 'closed') context.close().catch(() => {});
  }
  signal.addEventListener('abort', close, { once: true });
  try {
    await context.resume();
    signal.throwIfAborted();
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
    signal.throwIfAborted();
    await context.audioWorklet.addModule(new URL('./gemini-microphone.js', document.baseURI));
    signal.throwIfAborted();
    const access = await credential();
    signal.throwIfAborted();
    socket = new WebSocket(liveSocketUrl(access));
    socket.binaryType = 'arraybuffer';
    microphone = context.createMediaStreamSource(stream);
    capture = new AudioWorkletNode(context, 'gemini-microphone');
    capture.port.onmessage = ({ data }) => {
      if (!ready || socket.readyState !== WebSocket.OPEN) return;
      if (socket.bufferedAmount > 512000) return onEnd('The voice connection fell behind. Tap Talk to reconnect.');
      const audio = btoa(String.fromCharCode(...new Uint8Array(data)));
      socket.send(JSON.stringify({ realtimeInput: { audio: { mimeType: 'audio/pcm;rate=16000', data: audio } } }));
    };
    timer = setTimeout(() => onEnd('Gemini Live did not connect. Check your network and voice key.'), 20000);
    socket.onopen = () => socket.send(JSON.stringify({ setup: {
      model: 'models/' + LIVE_MODEL, generationConfig: { responseModalities: ['AUDIO'] },
      systemInstruction: { parts: [{ text: instruction }] },
      inputAudioTranscription: {}, outputAudioTranscription: {},
    } }));
    socket.onmessage = ({ data }) => {
      try {
        const message = JSON.parse(typeof data === 'string' ? data : new TextDecoder().decode(data));
        if (message.error) return onEnd('Gemini Live rejected the request. Check your key, model access and quota.');
        if (message.setupComplete && !ready) {
          clearTimeout(timer);
          ready = true;
          microphone.connect(capture);
          capture.connect(context.destination); // Worklet output is silent.
          onStage('Listening');
        }
        const content = message.serverContent;
        if (!content) return;
        if (content.interrupted) { interrupt(); finishTurn(); onStage('Listening'); }
        input += content.inputTranscription?.text || '';
        output += content.outputTranscription?.text || '';
        for (const part of content.modelTurn?.parts || []) {
          const clip = part.inlineData;
          if (!clip?.mimeType?.startsWith('audio/pcm') || !clip.data) continue;
          const bytes = Uint8Array.from(atob(clip.data), char => char.charCodeAt(0));
          const samples = new Int16Array(bytes.buffer);
          const rate = Number(/rate=(\d+)/.exec(clip.mimeType)?.[1] || 24000);
          const buffer = context.createBuffer(1, samples.length, rate);
          buffer.copyToChannel(Float32Array.from(samples, sample => sample / 32768), 0);
          const source = context.createBufferSource();
          source.buffer = buffer;
          source.connect(context.destination);
          playing.add(source);
          source.onended = () => {
            source.disconnect();
            playing.delete(source);
            if (!playing.size) onStage('Listening');
          };
          const start = Math.max(context.currentTime + 0.01, nextStart);
          source.start(start);
          nextStart = start + buffer.duration;
          onStage('Speaking');
        }
        if (content.turnComplete) finishTurn();
      } catch { onEnd('Could not read the audio response from Gemini Live.'); }
    };
    socket.onerror = () => onEnd('Could not connect to Gemini Live. Check your key and network.');
    socket.onclose = ({ code }) => {
      finishTurn();
      onEnd(code === 1000 ? 'Call ended.' : 'Gemini Live disconnected (' + code + '). Check your quota or key, then tap Talk.');
    };
    stream.getAudioTracks()[0].onended = () => onEnd('Microphone disconnected. Tap Talk to reconnect.');
  } catch (error) {
    signal.removeEventListener('abort', close);
    close();
    throw error;
  }
}
