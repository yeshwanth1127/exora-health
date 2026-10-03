import os
from pathlib import Path

DATA_DIR = Path(os.getenv('DATA_DIR', 'data'))
MODEL_DIR = Path(os.getenv('MODEL_DIR', 'models'))
OLLAMA_URL = os.getenv('OLLAMA_URL', 'http://127.0.0.1:11434').rstrip('/')
CHAT_MODEL = os.getenv('CHAT_MODEL', 'qwen3:1.7b')
EMBED_MODEL = os.getenv('EMBED_MODEL', 'nomic-embed-text')
WHISPER_MODEL = os.getenv('WHISPER_MODEL', 'base.en')
OPENROUTER_URL = os.getenv('OPENROUTER_URL', 'https://openrouter.ai/api/v1').rstrip('/')
OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY', '').strip()
OPENROUTER_MODEL = os.getenv('OPENROUTER_MODEL', 'openai/gpt-4o-mini')
LLM_PROVIDER = os.getenv('LLM_PROVIDER', 'openrouter' if OPENROUTER_API_KEY else 'local').strip()
ALLOWED_ORIGINS = set(os.getenv(
    'ALLOWED_ORIGINS',
    'http://localhost:8765,http://127.0.0.1:8765,http://localhost:5567,http://127.0.0.1:5567',
).split(','))
TRUSTED_HOSTS = [item.strip() for item in os.getenv(
    'TRUSTED_HOSTS', 'localhost,127.0.0.1,testserver'
).split(',') if item.strip()]
HOSPITAL_API_URL = os.getenv('HOSPITAL_API_URL', 'http://127.0.0.1:8000').rstrip('/')
HOSPITAL_SERVICE_KEY = os.getenv('HOSPITAL_SERVICE_KEY', 'dev-voice-service-key').strip()
DEFAULT_SETTINGS = {
    'agent_name': 'Maya', 'business_name': 'Avocado Health',
    'instructions': 'Be calm, compassionate, concise, and privacy-conscious. Ask one question at a time. Never diagnose, interpret reports, or recommend medication. Explain that this is an Exora HMS local demonstration if asked.',
    'voice': 'af_heart', 'speed': 1.05, 'silence_ms': 700,
    'retrieval_threshold': 0.45, 'top_k': 4, 'demo': True,
    'llm_provider': LLM_PROVIDER, 'local_model': CHAT_MODEL,
    'openrouter_model': OPENROUTER_MODEL,
    'fallback_provider': 'local' if LLM_PROVIDER == 'openrouter' else 'none',
}
