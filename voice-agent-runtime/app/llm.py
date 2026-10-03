"""Ollama and OpenRouter chat completions with a shared tools format."""
import asyncio
import json
import logging
import re
import time
import uuid

import httpx

from .config import CHAT_MODEL, DEFAULT_SETTINGS, OPENROUTER_API_KEY, OPENROUTER_MODEL, OPENROUTER_URL

log = logging.getLogger('voice-studio')

PROVIDER_TIMEOUTS = {'openrouter': 15, 'local': 65}


class ChatResult:
    def __init__(self, content='', tool_calls=None, provider='local', model='', metrics=None):
        self.content = content or ''
        self.tool_calls = tool_calls or []
        self.provider = provider
        self.model = model
        self.metrics = metrics or {}


def _metrics(duration_ns=0, tokens=0, eval_ns=0, **extra):
    elapsed = round(duration_ns / 1e6) if duration_ns else extra.get('llm_ms', 0)
    if tokens and eval_ns:
        tps = round(tokens / max(eval_ns / 1e9, .001), 1)
    elif tokens and elapsed:
        tps = round(tokens / max(elapsed / 1000, .001), 1)
    else:
        tps = extra.get('tokens_per_second', 0)
    return {'llm_ms': elapsed, 'tokens': tokens, 'tokens_per_second': tps}


def pick_local_model(requested, names):
    names = {n.removesuffix(':latest') for n in names}
    for candidate in (requested, 'qwen3:8b', 'qwen3:4b'):
        if candidate and candidate.removesuffix(':latest') in names:
            return candidate.removesuffix(':latest')
    return requested


def _parse_args(raw):
    if raw is None:
        return {}
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            return json.loads(raw) if raw.strip() else {}
        except json.JSONDecodeError:
            return {'query': raw}
    return {}


class LLMRouter:
    def __init__(self, ollama_client):
        self.ollama = ollama_client
        self.openrouter = httpx.AsyncClient(base_url=OPENROUTER_URL, timeout=60, trust_env=False)
        self.lock = asyncio.Lock()
        self.last = {'provider': None, 'model': None, 'error': None}

    def bind_lock(self, lock):
        self.lock = lock

    async def aclose(self):
        await self.openrouter.aclose()

    def openrouter_configured(self):
        return bool(OPENROUTER_API_KEY)

    def _order(self, settings):
        primary = settings.get('llm_provider') or DEFAULT_SETTINGS['llm_provider']
        fallback = settings.get('fallback_provider') or DEFAULT_SETTINGS['fallback_provider']
        order = [primary]
        if fallback in {'local', 'openrouter'} and fallback != primary:
            order.append(fallback)
        return order

    async def complete(self, messages, tools, settings):
        last_error = None
        for provider in self._order(settings):
            if provider == 'openrouter' and not OPENROUTER_API_KEY:
                last_error = RuntimeError('OpenRouter is not configured. Set OPENROUTER_API_KEY.')
                continue
            try:
                result = await asyncio.wait_for(
                    self._complete(provider, messages, tools, settings),
                    timeout=PROVIDER_TIMEOUTS[provider],
                )
                self.last = {'provider': result.provider, 'model': result.model, 'error': None}
                return result
            except asyncio.TimeoutError:
                last_error = RuntimeError(
                    f'{provider.title()} did not respond within {PROVIDER_TIMEOUTS[provider]} seconds.'
                )
                log.warning('%s', last_error)
                self.last = {'provider': provider, 'model': None, 'error': str(last_error)}
            except Exception as exc:
                last_error = exc
                log.warning('LLM provider %s failed: %s', provider, exc)
                self.last = {'provider': provider, 'model': None, 'error': str(exc)}
        raise last_error or RuntimeError('No language model provider is available.')

    async def _complete(self, provider, messages, tools, settings):
        if provider == 'openrouter':
            return await self._openrouter(messages, tools, settings)
        return await self._ollama(messages, tools, settings)

    async def _local_names(self):
        r = await self.ollama.get('/api/tags', timeout=4)
        r.raise_for_status()
        return {m['name'].removesuffix(':latest') for m in r.json().get('models', [])}

    async def _ollama(self, messages, tools, settings):
        requested = settings.get('local_model') or CHAT_MODEL
        try:
            model = pick_local_model(requested, await self._local_names())
        except Exception:
            model = requested
        payload = {
            'model': model, 'messages': _to_ollama(messages), 'stream': False,
            'think': False, 'keep_alive': -1,
            'options': {'temperature': 0.35, 'num_ctx': 4096, 'num_predict': 240},
        }
        if tools:
            payload['tools'] = tools
        async with self.lock:
            r = await self.ollama.post('/api/chat', json=payload)
            r.raise_for_status()
            data = r.json()
        message = data.get('message') or {}
        calls = []
        for index, call in enumerate(message.get('tool_calls') or []):
            fn = call.get('function') or call
            calls.append({
                'id': call.get('id') or f'call_{index}',
                'name': fn.get('name', ''),
                'arguments': _parse_args(fn.get('arguments')),
            })
        return ChatResult(
            content=strip_think(message.get('content', '')),
            tool_calls=calls, provider='local', model=model,
            metrics=_metrics(data.get('total_duration', 0), data.get('eval_count', 0), data.get('eval_duration', 0)),
        )

    async def _openrouter(self, messages, tools, settings):
        model = settings.get('openrouter_model') or OPENROUTER_MODEL
        payload = {
            'model': model, 'messages': _to_openai(messages),
            'temperature': 0.4, 'max_tokens': 400,
        }
        if tools:
            payload['tools'] = tools
            payload['tool_choice'] = 'auto'
        headers = {
            'Authorization': f'Bearer {OPENROUTER_API_KEY}',
            'HTTP-Referer': 'http://127.0.0.1:8765',
            'X-Title': 'Local Voice Studio',
        }
        started = time.perf_counter()
        r = await self.openrouter.post('/chat/completions', json=payload, headers=headers)
        elapsed_ms = round((time.perf_counter() - started) * 1000)
        if r.status_code >= 400:
            raise RuntimeError(f'OpenRouter HTTP {r.status_code}: {r.text[:300]}')
        data = r.json()
        choice = (data.get('choices') or [{}])[0]
        message = choice.get('message') or {}
        usage = data.get('usage') or {}
        calls = []
        for index, call in enumerate(message.get('tool_calls') or []):
            fn = call.get('function') or {}
            calls.append({
                'id': call.get('id') or f'call_{index}',
                'name': fn.get('name', ''),
                'arguments': _parse_args(fn.get('arguments')),
            })
        return ChatResult(
            content=strip_think(message.get('content', '')),
            tool_calls=calls, provider='openrouter', model=model,
            metrics=_metrics(tokens=usage.get('completion_tokens', 0), llm_ms=elapsed_ms),
        )

    async def complete_json(self, messages, schema, max_tokens=300, settings=None):
        settings = settings or {}
        last_error = None
        for provider in self._order(settings) or ['local']:
            try:
                if provider == 'openrouter':
                    return await self._openrouter_json(messages, schema, max_tokens, settings)
                return await self._ollama_json(messages, schema, max_tokens, settings)
            except Exception as exc:
                last_error = exc
                log.warning('JSON provider %s failed: %s', provider, exc)
        raise last_error or RuntimeError('Structured extraction is unavailable.')

    async def _ollama_json(self, messages, schema, max_tokens, settings):
        requested = settings.get('local_model') or CHAT_MODEL
        try:
            model = pick_local_model(requested, await self._local_names())
        except Exception:
            model = requested
        async with self.lock:
            r = await self.ollama.post('/api/chat', json={
                'model': model, 'messages': messages, 'stream': False,
                'think': False, 'format': schema, 'keep_alive': -1,
                'options': {'temperature': 0, 'num_ctx': 4096, 'num_predict': max_tokens},
            })
            r.raise_for_status()
            data = r.json()
        content = (data.get('message') or {}).get('content') or '{}'
        return json.loads(content), _metrics(data.get('total_duration', 0), data.get('eval_count', 0), data.get('eval_duration', 0))

    async def _openrouter_json(self, messages, schema, max_tokens, settings):
        if not OPENROUTER_API_KEY:
            raise RuntimeError('OpenRouter is not configured.')
        model = settings.get('openrouter_model') or OPENROUTER_MODEL
        payload = {
            'model': model,
            'messages': messages + [{'role': 'system', 'content': 'Return JSON only. Match this schema: ' + json.dumps(schema)}],
            'temperature': 0, 'max_tokens': max_tokens,
            'response_format': {'type': 'json_object'},
        }
        headers = {'Authorization': f'Bearer {OPENROUTER_API_KEY}', 'X-Title': 'Local Voice Studio'}
        started = time.perf_counter()
        r = await self.openrouter.post('/chat/completions', json=payload, headers=headers)
        elapsed_ms = round((time.perf_counter() - started) * 1000)
        r.raise_for_status()
        data = r.json()
        content = ((data.get('choices') or [{}])[0].get('message') or {}).get('content') or '{}'
        usage = data.get('usage') or {}
        return json.loads(content), _metrics(tokens=usage.get('completion_tokens', 0), llm_ms=elapsed_ms)


_REASON = re.compile(
    r'(?i)\b(i need to|i should|let me |wait,|the user |the tool|word count|'
    r'first sentence|as per the|make sure|never mention|okay, the user|'
    r'i called |the response from|let me structure|let me count|so maybe|'
    r'however,|also, the user might|the document includes|avoid any markdown|'
    r'under 45 words|one sentence|two sentences)\b'
)

_INTERNAL = re.compile(
    r'(?i)\b(search_knowledge|capture_request|/no_think|business facts|documented polic'
    r'|pending human review|tool returned|rewrite the caller|spoken aloud|assistant(?:\'s)? response'
    r'|instructions say|tools? available|system prompt|developer message|the assistant should)\b'
)


def strip_think(text):
    text = text or ''
    text = re.sub(r'<think>.*?</think>', '', text, flags=re.S | re.I)
    return text.replace('<think>', '').replace('</think>', '').strip()


def is_internal_speech(text):
    return bool(_INTERNAL.search(text or ''))


def repeats_caller(spoken, user):
    def words(value):
        return [w for w in re.findall(r'[a-z0-9]+', (value or '').lower())
                if w not in {'a', 'an', 'the', 'to', 'you', 'i', 'im', 'and', 'do', 'did', 'does'}]
    heard, asked = words(spoken), words(user)
    if not heard or not asked:
        return False
    if heard == asked:
        return True
    return len(set(heard) & set(asked)) / len(set(heard)) >= 0.85


def spoken_reply(text, avoid=''):
    """Keep only caller-facing speech; drop Qwen thinking and tool narration."""
    text = strip_think(text)
    if not text:
        return ''

    def usable(candidate):
        cleaned = re.sub(r'\s+', ' ', candidate or '').strip()
        if not cleaned or repeats_caller(cleaned, avoid) or is_internal_speech(cleaned):
            return ''
        return cleaned[:1400]

    quotes = re.findall(r'["“]([A-Z][^"”]{14,400})["”]', text)
    for quote in reversed(quotes):
        words = quote.split()
        if 4 <= len(words) <= 55 and not _REASON.search(quote):
            kept = usable(quote)
            if kept:
                return kept
    if len(text.split()) <= 55 and not _REASON.search(text):
        kept = usable(text)
        if kept:
            return kept
    chunks = [c.strip() for c in re.split(r'\n+', text) if c.strip()]
    speech = [c for c in chunks if len(c.split()) <= 50 and not _REASON.search(c)]
    if speech:
        kept = usable(' '.join(speech[-3:]))
        if kept:
            return kept
    sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', text) if s.strip()]
    spoken = [s for s in sentences if not _REASON.search(s) and len(s.split()) <= 40]
    if spoken:
        kept = usable(' '.join(spoken[-3:]))
        if kept:
            return kept
    return ''


def _to_ollama(messages):
    converted = []
    for msg in messages:
        item = {'role': msg['role'], 'content': msg.get('content') or ''}
        if msg['role'] == 'assistant' and msg.get('tool_calls'):
            item['tool_calls'] = [{'type': 'function', 'function': {
                'name': c['name'], 'arguments': c.get('arguments') or {},
            }} for c in msg['tool_calls']]
        if msg['role'] == 'tool':
            item = {'role': 'tool', 'tool_name': msg.get('name') or '', 'content': msg.get('content') or ''}
        converted.append(item)
    return converted


def _to_openai(messages):
    converted = []
    for msg in messages:
        if msg['role'] == 'tool':
            converted.append({
                'role': 'tool',
                'tool_call_id': msg.get('tool_call_id') or str(uuid.uuid4()),
                'content': msg.get('content') or '',
            })
            continue
        item = {'role': msg['role'], 'content': msg.get('content') or ''}
        if msg['role'] == 'assistant' and msg.get('tool_calls'):
            item['tool_calls'] = [{'id': c.get('id') or str(uuid.uuid4()), 'type': 'function', 'function': {
                'name': c['name'], 'arguments': json.dumps(c.get('arguments') or {}),
            }} for c in msg['tool_calls']]
            if not item['content']:
                item['content'] = None
        converted.append(item)
    return converted
