import io
import json
import zipfile

import numpy as np
import pytest

from app.knowledge import KnowledgeStore, chunk_sections, extract_document
from app.main import validate_extraction


def test_markdown_preserves_sections_and_overlaps():
    sections = extract_document('test.md', b'# Guide\nIntro\n## Hours\nOpen 9 to 6\n## Fees\n499 rupees')
    assert [s['locator'] for s in sections] == ['Guide', 'Hours', 'Fees']
    chunks = chunk_sections([{'text': ' '.join(str(i) for i in range(500)), 'locator': 'Page 2'}])
    assert len(chunks) == 3
    assert chunks[0]['text'].split()[-35:] == chunks[1]['text'].split()[:35]
    assert all(c['locator'] == 'Page 2' for c in chunks)


def test_html_does_not_index_executable_content():
    sections = extract_document('page.html', b'<h1>Hours</h1><p>Open Monday</p><script>secret script</script><style>private css</style>')
    assert 'Monday' in sections[0]['text']
    assert 'secret' not in sections[0]['text']
    assert 'private' not in sections[0]['text']


def test_csv_keeps_column_names_with_row():
    sections = extract_document('prices.csv', b'service,price\nInspection,499\nCleaning,799\n')
    assert sections[0]['text'] == 'service: Inspection; price: 499'
    assert sections[1]['locator'] == 'Row 3'


def test_scanned_pdf_rejected():
    from pypdf import PdfWriter
    pdf = PdfWriter()
    pdf.add_blank_page(width=100, height=100)
    buf = io.BytesIO()
    pdf.write(buf)
    with pytest.raises(ValueError, match='OCR'):
        extract_document('scan.pdf', buf.getvalue())


def test_hybrid_search_dedup_and_delete(tmp_path):
    store = KnowledgeStore(tmp_path)
    chunks = [{'text': 'The visit fee is 499 rupees.', 'locator': 'Fees'}, {'text': 'Open Monday to Friday.', 'locator': 'Hours'}]
    vectors = [[1, 0, 0], [.1, 1, 0]]
    doc = store.insert_document('demo.md', b'demo', chunks, vectors)
    assert store.insert_document('other-name.md', b'demo', chunks, vectors) == doc
    assert len(store.documents()) == 1
    results = store.search('visit fee', [1, 0, 0], threshold=.4)
    assert results[0]['locator'] == 'Fees'
    assert results[0]['keyword_match']
    assert store.search('unknown', [0, 0, 1], threshold=.4) == []
    assert store.delete_document(doc)
    assert store.search('visit fee', [1, 0, 0]) == []
    assert store.db.execute('SELECT count(*) FROM chunks_fts').fetchone()[0] == 0


def test_atomic_rollback_on_invalid_embeddings(tmp_path):
    store = KnowledgeStore(tmp_path)
    with pytest.raises(ValueError):
        store.insert_document('bad.md', b'bad', [{'text': 'Good first chunk', 'locator': '1'}, {'text': 'Bad second chunk', 'locator': '2'}], [[1,0], [0,0]])
    assert store.documents() == []
    assert store.db.execute('SELECT count(*) FROM chunks_fts').fetchone()[0] == 0


def test_extraction_rejects_invented_values_and_evidence():
    text = 'My name is Priya. My phone is 9876543210. I need a cardiology appointment in Whitefield.'
    result = validate_extraction({
        'name': {'value': 'Priya', 'evidence': 'My name is Priya.'},
        'phone': {'value': '9876543210', 'evidence': 'My phone is 9876543210.'},
        'email': {'value': 'priya@example.com', 'evidence': 'My email is priya@example.com.'},
        'service': {'value': 'cardiology', 'evidence': 'I need a cardiology appointment in Whitefield.'},
        'area': {'value': 'Koramangala', 'evidence': 'I need a cardiology appointment in Whitefield.'},
    }, text)
    assert result['fields']['name']['value'] == 'Priya'
    assert result['fields']['phone']['verified']
    assert result['fields']['service']['verified']
    assert result['fields']['email']['value'] is None
    assert result['fields']['area']['value'] is None
    assert result['status'] == 'request_only_pending_human_review'


def test_sessions_and_interrupted_turns_persist(tmp_path):
    store = KnowledgeStore(tmp_path)
    sid = store.create_session()
    store.add_turn(sid, 'a', 'hello', 'hi', [], {'stt_ms': 99}, 'interrupted')
    store.end_session(sid)
    reopened = KnowledgeStore(tmp_path)
    result = reopened.session(sid)
    assert result['ended']
    assert result['turns'][0]['status'] == 'interrupted'
    assert result['turns'][0]['metrics']['stt_ms'] == 99


def test_conversation_memory_persists_for_reconnect(tmp_path):
    store = KnowledgeStore(tmp_path)
    sid = store.create_session()
    memory = {'directory_context': {
        'department': 'cardiology',
        'doctors': [{'id': 'doctor-1', 'name': 'Dr. Vikram Rao'}],
    }}
    store.save_memory(sid, memory)

    reopened = KnowledgeStore(tmp_path).session(sid)

    assert reopened['memory'] == memory


def test_rag_audit_log_persists_query_results_and_errors(tmp_path):
    store = KnowledgeStore(tmp_path)
    store.add_rag_query('hospital overview', 'conversation', 37, [{
        'id': 'c1', 'document_id': 'd1', 'name': 'demo.md', 'locator': 'Overview',
        'similarity': 0.82, 'score': 0.03,
    }], session_id='s1', turn_id='t1')
    store.add_rag_query('broken query', 'retrieval_lab', 12, error='RuntimeError: unavailable')
    rows = KnowledgeStore(tmp_path).rag_queries()
    assert rows[0]['query'] == 'broken query'
    assert rows[0]['error'] == 'RuntimeError: unavailable'
    assert rows[1]['result_count'] == 1
    assert rows[1]['results'][0]['locator'] == 'Overview'


def test_explicit_contact_extraction_and_ambiguity():
    result = validate_extraction({}, 'My phone number is 9876543210. My email is priya@example.com.')
    assert result['fields']['phone']['value'] == '9876543210'
    assert result['fields']['email']['value'] == 'priya@example.com'
    result = validate_extraction({}, 'My phone is 9876543210. My phone is 9876543211.')
    assert result['fields']['phone']['value'] is None


def test_unsupported_and_oversized_input():
    with pytest.raises(ValueError, match='Supported formats'):
        extract_document('malware.exe', b'MZ')
    with pytest.raises(ValueError, match='15 MB'):
        extract_document('large.txt', b'a' * (15 * 1024 * 1024 + 1))
