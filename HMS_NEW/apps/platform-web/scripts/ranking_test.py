import concurrent.futures
from datetime import datetime
import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest
from unittest.mock import patch
from zoneinfo import ZoneInfo
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import local_rank
import maps_budget
import rank_map
from lookup_errors import LookupError


class BudgetTests(unittest.TestCase):
    def test_parallel_workers_and_restarts_cannot_overrun_daily_allowance(self):
        with tempfile.TemporaryDirectory() as folder:
            db = Path(folder) / 'usage.sqlite3'
            def request(_):
                try:
                    maps_budget.reserve('details', database=db)
                    return 1
                except LookupError:
                    return 0
            with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
                self.assertEqual(sum(pool.map(request, range(50))), 25)
            with self.assertRaises(LookupError): maps_budget.reserve('details', database=db)
            connection=sqlite3.connect(db)
            try:
                self.assertEqual([r[0] for r in connection.execute('SELECT count FROM usage')], [25,25])
            finally:
                connection.close()

    def test_monthly_limit_survives_daily_reset_and_uses_pacific_dates(self):
        with tempfile.TemporaryDirectory() as folder, patch.dict(maps_budget.LIMITS, {'details': (10,12)}):
            db = Path(folder) / 'usage.sqlite3'
            maps_budget.reserve('details', 10, database=db, now=datetime(2026,10,1,23,tzinfo=ZoneInfo('America/Los_Angeles')))
            maps_budget.reserve('details', 2, database=db, now=datetime(2026,10,2,10,tzinfo=ZoneInfo('UTC')))
            with self.assertRaises(LookupError): maps_budget.reserve('details', database=db, now=datetime(2026,10,3,10,tzinfo=ZoneInfo('UTC')))
            maps_budget.reserve('details', database=db, now=datetime(2026,11,1,10,tzinfo=ZoneInfo('UTC')))

    def test_storage_failure_pauses_requests(self):
        with tempfile.TemporaryDirectory() as folder, self.assertRaises(LookupError) as failure:
            maps_budget.reserve('search', database=Path(folder))
        self.assertEqual(failure.exception.code, 'BUDGET_GUARD_UNAVAILABLE')

    def test_caps_stay_below_smallest_applicable_global_allowances(self):
        allowances = {'autocomplete':10000, 'details':1000, 'search':5000, 'map':10000}
        for kind,(daily,monthly) in maps_budget.LIMITS.items():
            self.assertLessEqual(daily*31,monthly)
            self.assertLess(monthly, allowances[kind])


class RankingTests(unittest.TestCase):
    def test_sample_checks_nine_neighbourhoods_and_leaves_others_unchecked(self):
        requests=[]
        def google(path,fields,body):
            requests.append((path, fields, body))
            return {'places':[{'id':'other','displayName':{'text':'Other'}},{'id':'target','displayName':{'text':'Target'}}]}
        result=local_rank.scan({'id':'target','address':'Bangalore, Karnataka','primaryType':'medical_clinic'},google)
        self.assertEqual(len(requests),9)
        self.assertEqual(result['checkedPoints'],9)
        self.assertEqual(result['totalPoints'],120)
        self.assertEqual(sum(p['status']=='not_checked' for p in result['points']),111)
        for point in result['points']:
            if point['status']=='checked':
                self.assertEqual(point['targetPosition'],2)
                self.assertEqual(point['resultsAbove'],1)
        for path,fields,body in requests:
            self.assertEqual(path,'places:searchText')
            self.assertEqual(fields,local_rank.SEARCH_FIELDS)
            self.assertNotIn('rating',fields)
            self.assertEqual(body['rankPreference'],'RELEVANCE')
            self.assertEqual(body['pageSize'],20)
            self.assertNotIn('Bangalore',body['textQuery']) # Preserve per-point bias.

    def test_initial_scan_starts_near_the_selected_clinic_not_fixed_city_origins(self):
        place = {'id':'target','address':'Bengaluru','primaryType':'hospital','location':{'latitude':12.96,'longitude':77.68}}
        result = local_rank.scan(place, lambda *args: {'places':[]})
        expected, nearby = local_rank.nearby_points(place, local_rank.CITIES['bengaluru'])
        self.assertTrue(nearby)
        self.assertEqual({p['id'] for p in result['points'] if p['status']=='checked'}, {p['id'] for p in expected[:9]})
        self.assertNotIn('yelahanka', {p['id'] for p in result['points'] if p['status']=='checked'})
        self.assertTrue(all('distanceKm' in p for p in result['points']))
        self.assertIn('nearest',result['sampleDescription'])
        self.assertEqual(result['checkedPoints'],9)

    def test_map_frame_fits_bengaluru_origins_in_a_square_overview(self):
        points = local_rank.CITIES['bengaluru']['points']
        frame = rank_map.map_frame(points)
        self.assertEqual((frame['width'],frame['height']), (640,640))
        self.assertGreaterEqual(frame['zoom'],11)
        cx,cy = rank_map.world(frame['center']['latitude'],frame['center']['longitude'])
        size = 256 * 2 ** frame['zoom']
        for point in points:
            x,y = rank_map.world(point['latitude'],point['longitude'])
            self.assertLess(abs((x-cx)*size),frame['width']/2-20)
            self.assertLess(abs((y-cy)*size),frame['height']/2-20)

    def test_quota_error_never_becomes_not_found_or_a_zero_rank(self):
        def google(*args): raise LookupError('FREE_TIER_LIMIT','Protected limit',429)
        result=local_rank.scan({'id':'target','address':'Bengaluru','primaryType':'hospital'},google)
        self.assertEqual(result['checkedPoints'],0)
        self.assertEqual(result['leaderboard'],[])
        self.assertEqual(sum(p['status']=='unavailable' for p in result['points']),9)
        self.assertTrue(all(p['targetPosition'] is None for p in result['points']))

    def test_unsupported_city_or_category_never_calls_google(self):
        for place in [{'address':'Mumbai','primaryType':'hospital'},{'address':'Bengaluru','primaryType':'restaurant'}]:
            with patch('local_rank.observation') as observation:
                self.assertEqual(local_rank.scan(place,None)['status'],'unsupported')
                observation.assert_not_called()

    def test_visibility_penalises_absence_and_excludes_unavailable_points(self):
        points=[{'status':'checked','results':[{'id':'a','name':'A','mapsUrl':'','position':1},{'id':'b','name':'B','mapsUrl':'','position':2}]},
                {'status':'checked','results':[{'id':'b','name':'B','mapsUrl':'','position':2}]},
                {'status':'unavailable','results':[]}]
        board=local_rank.leaderboard(points,'a')
        self.assertEqual([b['id'] for b in board],['b','a'])
        self.assertEqual(board[0]['top3Share'],100)
        self.assertEqual(board[1]['visibility'],50)

    def test_area_lookup_is_one_search_and_rejects_unknown_points_before_google(self):
        with patch('local_rank.observation',return_value={'status':'checked'}) as request:
            self.assertEqual(len(local_rank.scan_areas('bengaluru','hospital',['indiranagar'],None)),1)
            self.assertEqual(request.call_count,1)
            request.reset_mock()
            for areas in [['invalid'],['indiranagar','indiranagar'],[]]:
                with self.assertRaises(LookupError): local_rank.scan_areas('bengaluru','hospital',areas,None)
            request.assert_not_called()

    def test_all_city_points_have_unique_ids_and_valid_origins(self):
        for city in local_rank.CITIES.values():
            self.assertEqual(len({p['id'] for p in city['points']}),len(city['points']))
            self.assertEqual(len(city['initialAreas']),9)
            lo_lat,lo_lng,hi_lat,hi_lng=city['bounds']
            self.assertTrue(all(lo_lat<=p['latitude']<=hi_lat and lo_lng<=p['longitude']<=hi_lng for p in city['points']))

if __name__=='__main__': unittest.main()
