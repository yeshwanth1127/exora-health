import assert from 'node:assert/strict';
import test from 'node:test';
import { rankLeaderboard } from '../src/lib/local-ranking.ts';
test('area comparison penalises checked absence and excludes unavailable or unchecked locations', () => {
 const result=(id,position)=>({id,name:id,mapsUrl:'',position});
 const points=[{status:'checked',results:[result('a',1),result('b',2)]},{status:'checked',results:[result('b',2)]},{status:'unavailable',results:[]},{status:'not_checked',results:[]}];
 const board=rankLeaderboard(points,'a');
 assert.deepEqual(board.map(b=>b.id),['b','a']);
 assert.equal(board[0].visibility,95);
 assert.equal(board[1].visibility,50);
 assert.equal(board[1].averagePosition,1);
 assert.equal(board[1].top3Share,50);
 assert.deepEqual(rankLeaderboard(points.slice(2),'a'),[]);
});
