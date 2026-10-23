import io
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import business_lookup as lookup


class BusinessLookupTests(unittest.TestCase):
    def test_status_exposes_no_credential(self):
        with patch.object(lookup, "api_key", return_value="private-test-key"):
            self.assertEqual(lookup.lookup("mode=status"), {"configured": True})

    def test_invalid_input_never_calls_google(self):
        with patch.object(lookup, "google_request") as request:
            for query in ["mode=details&id=../../secrets", "mode=search&q=x", "mode=other"]:
                with self.assertRaises(lookup.LookupError):
                    lookup.lookup(query)
            request.assert_not_called()

    def test_autocomplete_maps_predictions_and_passes_session(self):
        response = {"suggestions": [{"placePrediction": {"placeId": "abc123", "text": {"text": "Cafe, Bengaluru"}}}, {"queryPrediction": {"text": {"text": "Cafe"}}}]}
        with patch.object(lookup, "google_request", return_value=response) as request:
            result = lookup.lookup("mode=autocomplete&q=Cafe&session=session-123")
        self.assertEqual(result, {"predictions": [{"id": "abc123", "label": "Cafe, Bengaluru"}]})
        self.assertEqual(request.call_args.args[0], "places:autocomplete")
        self.assertEqual(request.call_args.args[2]["sessionToken"], "session-123")

    def test_details_uses_session_and_invalid_session_never_calls_google(self):
        with patch.object(lookup, "google_request", return_value={"id": "abc123"}) as request:
            lookup.lookup("mode=details&id=abc123&session=session-123")
            self.assertEqual(request.call_args.args[0], "places/abc123?sessionToken=session-123")
            request.reset_mock()
            with self.assertRaises(lookup.LookupError):
                lookup.lookup("mode=autocomplete&q=Cafe&session=../../secret")
            request.assert_not_called()

    def test_missing_fields_remain_unknown(self):
        result = lookup.normalise({"id": "abc123", "displayName": {"text": "Example"}})
        self.assertIsNone(result["rating"])
        self.assertEqual(result["website"], "")
        self.assertEqual(result["hours"], [])

    def test_only_safe_links_are_exposed(self):
        self.assertEqual(lookup.safe_url("javascript:alert(1)"), "")
        self.assertEqual(lookup.safe_url("https://user:password@example.com"), "")
        self.assertEqual(lookup.safe_url("https://google.com.attacker.test/maps", True), "")
        self.assertEqual(lookup.safe_url("https://maps.google.com/?q=test", True), "https://maps.google.com/?q=test")

    def test_optional_public_fields_preserve_false_and_missing(self):
        result = lookup.normalise({"currentOpeningHours": {"openNow": False}, "accessibilityOptions": {"wheelchairAccessibleEntrance": False, "wheelchairAccessibleRestroom": True}, "location": {"latitude": 12.9, "longitude": 77.6}})
        self.assertIs(result["openNow"], False)
        self.assertIs(result["accessibility"]["wheelchairAccessibleEntrance"], False)
        self.assertTrue(result["accessibility"]["wheelchairAccessibleRestroom"])
        self.assertEqual(result["location"]["latitude"], 12.9)
        empty = lookup.normalise({})
        self.assertIsNone(empty["openNow"])
        self.assertIsNone(empty["location"])
        self.assertEqual(empty["accessibility"], {})

    def test_disabled_service_error_has_no_raw_provider_content(self):
        body = json.dumps({"error": {"message": "private-test-key", "details": [{"reason": "SERVICE_DISABLED"}]}}).encode()
        error = HTTPError("https://places.googleapis.com", 403, "Forbidden", {}, io.BytesIO(body))
        with patch.object(lookup, "api_key", return_value="private-test-key"), patch.object(lookup, "urlopen", side_effect=error):
            with self.assertRaises(lookup.LookupError) as failure:
                lookup.google_request("places:searchText", "places.id", {})
        self.assertEqual(failure.exception.code, "PLACES_DISABLED")
        self.assertNotIn("private-test-key", str(failure.exception))


if __name__ == "__main__":
    unittest.main()
