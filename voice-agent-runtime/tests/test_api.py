from fastapi.testclient import TestClient
from app.config import DEFAULT_SETTINGS
from app.main import app

client = TestClient(app)


def test_origin_and_host_guard():
    assert client.get('/api/health/live').status_code == 200
    assert client.get('/api/settings', headers={'Origin': 'https://untrusted.example'}).status_code == 403
    assert client.get('/api/settings', headers={'Host': 'attacker.example'}).status_code == 400
    assert client.get('/api/settings', headers={'Origin': 'http://localhost:8765'}).status_code == 200


def test_default_llm_provider_is_openrouter_with_local_fallback():
    assert DEFAULT_SETTINGS['llm_provider'] == 'openrouter'
    assert DEFAULT_SETTINGS['fallback_provider'] == 'local'


def test_settings_validation_and_safe_headers():
    assert client.put('/api/settings', json={'voice': 'unsupported'}).status_code == 422
    assert client.put('/api/settings', json={'llm_provider': 'cloud'}).status_code == 422
    r = client.get('/')
    assert r.status_code == 200
    assert "frame-ancestors 'none'" in r.headers['content-security-policy']
    assert r.headers['x-content-type-options'] == 'nosniff'
    settings = client.get('/api/settings', headers={'Origin': 'http://localhost:8765'}).json()
    assert settings['llm_provider'] in {'local', 'openrouter'}
    assert settings['fallback_provider'] in {'none', 'local', 'openrouter'}


def test_unknown_document_and_session():
    assert client.get('/api/documents/missing').status_code == 404
    assert client.get('/api/sessions/missing').status_code == 404
    assert client.delete('/api/documents/missing').status_code == 404
