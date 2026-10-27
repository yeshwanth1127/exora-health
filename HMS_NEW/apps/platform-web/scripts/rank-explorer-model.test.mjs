import test from 'node:test';
import assert from 'node:assert/strict';
import {observedSpots,observationHexes,observedRank} from '../src/lib/rank-explorer-model.ts';
test('explorer preserves provider positions and distinguishes absence from unchecked and failed searches',()=>{
 const scan={points:[{id:'a',label:'Area A',latitude:13,longitude:77,status:'checked',results:[{id:'clinic',name:'Clinic',position:4}]},{id:'b',label:'Area B',latitude:13,longitude:77,status:'checked',results:[]},{id:'c',label:'Area C',latitude:13,longitude:77,status:'not_checked',results:[]},{id:'d',label:'Area D',latitude:13,longitude:77,status:'unavailable',results:[],error:{message:'quota'}}]};
 const spots=observedSpots(scan);
 assert.deepEqual(spots.map(p=>observedRank(p,'clinic')),[4,null,undefined,undefined]);
 assert.equal(spots[3].where,'quota');
 const tiles=observationHexes(spots);assert.equal(tiles.length,4);assert.equal(new Set(tiles.map(t=>`${t.q}:${t.r}`)).size,4);
 assert.deepEqual(tiles.map(t=>t.top),[['clinic'],[],[],[]]);
 assert.equal(tiles[0].pointId,'a');
});
