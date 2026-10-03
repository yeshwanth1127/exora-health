import asyncio
import io
import re
from collections import OrderedDict

import httpx
import numpy as np
import soundfile as sf

from .config import CHAT_MODEL, EMBED_MODEL, MODEL_DIR, OLLAMA_URL, OPENROUTER_API_KEY, OPENROUTER_MODEL, WHISPER_MODEL
from .llm import LLMRouter, pick_local_model


class Inference:
    def __init__(self):
        self.client = httpx.AsyncClient(base_url=OLLAMA_URL, timeout=90, trust_env=False)
        self.router = LLMRouter(self.client)
        self.stt = None
        self.tts = None
        self.speech_error = None
        self.stt_lock = asyncio.Lock()
        self.tts_lock = asyncio.Lock()
        self.llm_lock = asyncio.Lock()
        self.router.bind_lock(self.llm_lock)
        self.ready = False
        self.ranker = None
        self.rerank_lock = asyncio.Lock()
        self.audio_cache = OrderedDict()

    async def aclose(self):
        await self.router.aclose()
        await self.client.aclose()

    async def rerank(self, query, sources, limit):
        if not sources:
            return []
        if self.ranker is None:
            raise RuntimeError('Local relevance model is not ready.')
        from flashrank import RerankRequest
        def run():
            ranked = self.ranker.rerank(RerankRequest(query=query, passages=[
                {'id': s['id'], 'text': s['locator'] + '\n' + s['text']} for s in sources]))
            by_id = {s['id']: s for s in sources}
            return [dict(by_id[r['id']], relevance=round(float(r['score']), 4))
                    for r in ranked if float(r['score']) >= .15][:limit]
        async with self.rerank_lock:
            return await self._thread_locked(run)

    async def embeddings(self, texts, query=False):
        prefix = 'search_query: ' if query else 'search_document: '
        r = await self.client.post('/api/embed', json={'model': EMBED_MODEL, 'input': [prefix + t for t in texts], 'keep_alive': -1, 'truncate': False})
        r.raise_for_status()
        return r.json()['embeddings']

    async def json_response(self, messages, schema, max_tokens=300, settings=None):
        return await self.router.complete_json(messages, schema, max_tokens, settings)

    async def load_speech(self):
        def load():
            from faster_whisper import WhisperModel
            from kokoro_onnx import Kokoro
            self.stt = WhisperModel(str(MODEL_DIR / 'whisper' / WHISPER_MODEL), device='cpu', compute_type='int8', cpu_threads=3, num_workers=1, local_files_only=True)
            import onnxruntime as ort
            opts = ort.SessionOptions()
            opts.intra_op_num_threads = 2
            opts.inter_op_num_threads = 1
            session = ort.InferenceSession(str(MODEL_DIR / 'kokoro-v1.0.onnx'), sess_options=opts, providers=['CPUExecutionProvider'])
            self.tts = Kokoro.from_session(session, str(MODEL_DIR / 'voices-v1.0.bin'))
            from flashrank import Ranker
            from flashrank.Config import model_file_map
            class OfflineRanker(Ranker):
                def _prepare_model_dir(self, model_name):
                    if not (self.model_dir / model_file_map[model_name]).is_file():
                        raise RuntimeError('Relevance model missing. Run the model download script first.')
            model_name = 'ms-marco-MiniLM-L-12-v2'
            self.ranker = OfflineRanker(model_name=model_name, cache_dir=str(MODEL_DIR / 'reranker'), max_length=384)
            self.ranker.session = ort.InferenceSession(str(self.ranker.model_dir / model_file_map[model_name]), sess_options=opts, providers=['CPUExecutionProvider'])
            self.ready = True
        try:
            await asyncio.to_thread(load)
        except Exception as exc:
            self.speech_error = str(exc)

    async def transcribe(self, pcm: bytes):
        if self.stt is None:
            raise RuntimeError('Speech recognition is not ready. Check System status.')
        samples = np.frombuffer(pcm, dtype='<i2').astype(np.float32) / 32768.0
        if len(samples) < 3200 or np.sqrt(np.mean(samples * samples)) < .002:
            return ''
        def run():
            segments, _ = self.stt.transcribe(samples, language='en', beam_size=1,
                condition_on_previous_text=False, vad_filter=True,
                no_speech_threshold=.6, vad_parameters={'min_silence_duration_ms': 300})
            return ' '.join(s.text.strip() for s in segments if s.no_speech_prob < .75).strip()
        async with self.stt_lock:
            return await self._thread_locked(run)

    async def speak(self, text, voice='af_heart', speed=1.05):
        if self.tts is None:
            raise RuntimeError('Voice synthesis is not ready. Check System status.')
        def run():
            audio, rate = self.tts.create(text, voice=voice, speed=speed, lang='en-us')
            buf = io.BytesIO()
            sf.write(buf, audio, rate, format='WAV', subtype='PCM_16')
            return buf.getvalue()
        async with self.tts_lock:
            key = (text, voice, speed)
            if key in self.audio_cache:
                self.audio_cache.move_to_end(key)
                return self.audio_cache[key]
            wav = await self._thread_locked(run)
            self.audio_cache[key] = wav
            while len(self.audio_cache) > 32:
                self.audio_cache.popitem(last=False)
            return wav

    @staticmethod
    async def _thread_locked(fn):
        task = asyncio.create_task(asyncio.to_thread(fn))
        try:
            return await asyncio.shield(task)
        except asyncio.CancelledError:
            await task
            raise

    async def status(self, settings=None):
        settings = settings or {}
        local_model = settings.get('local_model') or CHAT_MODEL
        try:
            r = await self.client.get('/api/tags', timeout=4)
            r.raise_for_status()
            models = r.json()['models']
            names = {m['name'].removesuffix(':latest') for m in models}
            resolved = pick_local_model(local_model, names)
            return {
                'connected': True,
                'chat_ready': resolved in names,
                'resolved_local_model': resolved,
                'embedding_ready': EMBED_MODEL in names,
                'openrouter_configured': bool(OPENROUTER_API_KEY),
                'openrouter_model': settings.get('openrouter_model') or OPENROUTER_MODEL,
                'local_model': local_model,
                'last_llm': self.router.last,
                'models': [{'name': m['name'], 'size': m['size'], 'digest': m.get('digest')} for m in models],
            }
        except Exception as exc:
            return {
                'connected': False, 'chat_ready': False, 'embedding_ready': False,
                'openrouter_configured': bool(OPENROUTER_API_KEY),
                'openrouter_model': settings.get('openrouter_model') or OPENROUTER_MODEL,
                'local_model': local_model, 'last_llm': self.router.last, 'error': str(exc),
            }


def sentences(text):
    parts = re.split(r'(?<=[.!?])\s+(?=[A-Z])', text)
    return [p.strip() for p in parts if p.strip()] or ([text.strip()] if text and text.strip() else [])
