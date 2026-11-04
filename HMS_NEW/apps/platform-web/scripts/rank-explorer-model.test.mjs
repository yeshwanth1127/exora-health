import test from 'node:test';
import assert from 'node:assert/strict';
import {observedSpots,observationHexes,observedRank,regionContains} from '../src/lib/rank-explorer-model.ts';
test('explorer preserves provider positions and distinguishes absence from unchecked and failed searches',()=>{
 const scan={points:[{id:'a',label:'Area A',latitude:13,longitude:77,status:'checked',results:[{id:'clinic',name:'Clinic',position:4}]},{id:'b',label:'Area B',latitude:13,longitude:77,status:'checked',results:[]},{id:'c',label:'Area C',latitude:13,longitude:77,status:'not_checked',results:[]},{id:'d',label:'Area D',latitude:13,longitude:77,status:'unavailable',results:[],error:{message:'quota'}}]};
 const spots=observedSpots(scan);
 assert.deepEqual(spots.map(p=>observedRank(p,'clinic')),[4,null,undefined,undefined]);
 assert.equal(spots[3].where,'quota');
 const {cells:tiles}=observationHexes(spots);assert.equal(tiles.length,4);assert.ok(tiles.every(t=>Number.isFinite(t.x)&&Number.isFinite(t.z)));
 assert.deepEqual(tiles.map(t=>t.top),[['clinic'],[],[],[]]);
 assert.equal(tiles[0].pointId,'a');
});

test('geographic hexes centre the containing area and preserve north, east and distance',()=>{
 const spots=[{pointId:'north',lat:13.02,lng:77.6},{pointId:'home',lat:13,lng:77.6},{pointId:'east',lat:13,lng:77.63},{pointId:'southwest',lat:12.99,lng:77.59}].map(p=>({...p,top:[],positions:{},status:'not_checked',area:p.pointId}));
 const {cells,home,spacing}=observationHexes(spots,{lat:13.001,lng:77.601},'home');
 assert.equal(home,1);assert.equal(cells[home].x,0);assert.equal(cells[home].z,0);
 assert.ok(cells[0].z<0);assert.equal(cells[0].x,0);assert.ok(cells[2].x>0);assert.equal(cells[2].z,0);
 assert.ok(cells[3].x<0&&cells[3].z>0);assert.ok(spacing>0);
 assert.ok(Math.abs(cells[0].z/111.32+.02)<1e-10);
 assert.deepEqual(cells.map(p=>p.pointId),spots.map(p=>p.pointId));
});
test('hospital containment respects multipart boundaries and holes',()=>{
 const boundary='M0 0L10 0L10 10L0 10ZM3 3L7 3L7 7L3 7ZM20 20L22 20L22 22L20 22Z';
 assert.equal(regionContains(boundary,1,1),true);assert.equal(regionContains(boundary,5,5),false);assert.equal(regionContains(boundary,21,21),true);assert.equal(regionContains(boundary,15,15),false);
});
