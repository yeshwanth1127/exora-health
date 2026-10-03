/* Convert microphone audio to bounded 20 ms, 16 kHz, signed PCM frames. No cloud speech API. */
class PCMCapture extends AudioWorkletProcessor {
  constructor(){super();this.ratio=sampleRate/16000;this.sum=0;this.count=0;this.phase=0;this.frame=new Int16Array(320);this.position=0;}
  process(inputs){const channel=inputs[0]?.[0];if(!channel)return true;for(const value of channel){this.sum+=value;this.count++;this.phase++;if(this.phase>=this.ratio){const v=Math.max(-1,Math.min(1,this.sum/this.count));this.frame[this.position++]=v<0?v*32768:v*32767;this.phase-=this.ratio;this.sum=0;this.count=0;if(this.position===320){this.port.postMessage(this.frame.buffer,[this.frame.buffer]);this.frame=new Int16Array(320);this.position=0;}}}return true;}
}
registerProcessor('pcm-capture',PCMCapture);
