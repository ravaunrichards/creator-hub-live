import assert from 'node:assert/strict';
import { handleTeamLeagueRoute } from '../src/team-leagues.js';

const seasonId = '123e4567-e89b-12d3-a456-426614174100';
const matchId = '123e4567-e89b-12d3-a456-426614174101';
const userId = '123e4567-e89b-12d3-a456-426614174102';
const official = ['A1','A2','A3','B1','B2','B3','B4','B5','C1','C2','C3','C4','C5','D1','D2','D3','D4','D5'];

function context({ pathname, method='GET', admin=true, body={}, seasons=[], standings=[], matches=[], rpcResult=null }={}) {
  const store = {
    league_seasons: seasons.map(row => ({ created_at: new Date().toISOString(), ...row })),
    league_standings: standings.map(row => ({ ...row })),
    league_matches: matches.map(row => ({ created_at: new Date().toISOString(), ...row })),
    leagues: [...official.map(code => ({ code })), { code: 'A' }],
    teams: [],
  };
  const calls = [];
  const sent = { value: null };
  function rows(table) { return store[table] || []; }
  function query(table) {
    const q = { table, op:'select', payload:null, filters:[], orders:[], max:Infinity };
    q.select = function(){ return this; };
    q.eq = function(key,value){this.filters.push({key,value,op:'eq'});return this;};
    q.neq = function(key,value){this.filters.push({key,value,op:'neq'});return this;};
    q.order = function(key,options){this.orders.push({key,ascending:!options||options.ascending!==false});return this;};
    q.limit = function(max){this.max=max;return this;};
    q.insert = function(value){this.op='insert';this.payload=value;return this;};
    q.upsert = function(value,options){this.op='upsert';this.payload=value;this.options=options||{};return this;};
    q.update = function(value){this.op='update';this.payload=value;return this;};
    q.delete = function(){this.op='delete';return this;};
    q.single = async function(){const r=await this.run();return {data:Array.isArray(r.data)?r.data[0]||null:r.data,error:r.error};};
    q.maybeSingle = async function(){const r=await this.run();return {data:Array.isArray(r.data)?r.data[0]||null:r.data||null,error:r.error};};
    q.run = async function(){
      calls.push({table,op:this.op,payload:this.payload});
      const selected = rows(table).filter(row=>this.filters.every(f=>f.op==='eq'?String(row[f.key])===String(f.value):String(row[f.key])!==String(f.value)));
      if(this.op==='upsert'){
        const incoming=Array.isArray(this.payload)?this.payload:[this.payload];const inserted=[];
        for(const value of incoming){
          const keys=String(this.options.onConflict||'').split(',').filter(Boolean);
          const found=keys.length?rows(table).find(row=>keys.every(k=>String(row[k])===String(value[k]))):null;
          if(found&&this.options.ignoreDuplicates)continue;
          if(found)Object.assign(found,value);else{const row={id:`match-${rows(table).length+1}`,...value};rows(table).push(row);inserted.push({...row});}
        }
        return {data:inserted,error:null};
      }
      if(this.op==='insert'){
        const incoming=Array.isArray(this.payload)?this.payload:[this.payload];const inserted=[];
        for(const value of incoming){const row={id:`match-${rows(table).length+1}`,...value};rows(table).push(row);inserted.push({...row});}
        return {data:inserted,error:null};
      }
      if(this.op==='update'){
        const changed=[];for(const row of selected){Object.assign(row,this.payload);changed.push({...row});}
        return {data:changed,error:null};
      }
      let data=selected.map(row=>({...row}));
      for(const ord of [...this.orders].reverse())data.sort((a,b)=>String(a[ord.key]??'').localeCompare(String(b[ord.key]??''))*(ord.ascending?1:-1));
      if(Number.isFinite(this.max))data=data.slice(0,this.max);
      return {data,error:null};
    };
    q.then=function(resolve,reject){return this.run().then(resolve,reject);};
    return q;
  }
  const client={from:query,rpc:async(name,args)=>{calls.push({rpc:name,args});return rpcResult||{data:{id:matchId,status:'completed',...args},error:null};}};
  const ctx={
    pathname,method,req:{headers:{authorization:'Bearer test'},body},res:{},
    requireSupabaseUser:async()=>({id:userId}),profileFor:async()=>({id:userId,is_admin:admin}),
    readJson:async()=>body,db:()=>client,
    normalizeExternalError:error=>({message:error.message,code:error.code,details:error.details,hint:error.hint}),
    fail(status,code,message,details){const e=new Error(message);e.status=status;e.code=code;e.details=details;throw e;},
    ok(_res,payload){sent.value={status:200,body:{ok:true,...payload}};return sent.value;}
  };
  return {ctx,store,calls,sent};
}

{
  const standings=['t1','t2','t3','t4'].map(team_id=>({season_id:seasonId,team_id,division_code:'D5',played:0}));
  const s={id:seasonId,name:'Test season',status:'active',starts_at:'2026-01-01T00:00:00.000Z',ends_at:'2027-01-01T00:00:00.000Z'};
  const first=context({pathname:`/api/admin/leagues/seasons/${seasonId}/fixtures/generate`,method:'POST',seasons:[s],standings});
  await handleTeamLeagueRoute(first.ctx);
  assert.equal(first.sent.value.body.fixturePairsPlanned,6,'four teams should produce six one-leg round-robin fixtures');
  assert.equal(first.sent.value.body.fixturesCreated,6);
  assert.equal(first.store.league_matches.length,6);
  const second=context({pathname:`/api/admin/leagues/seasons/${seasonId}/fixtures/generate`,method:'POST',seasons:[s],standings,matches:first.store.league_matches});
  await handleTeamLeagueRoute(second.ctx);
  assert.equal(second.sent.value.body.fixturesCreated,0,'repeat generation must not duplicate existing team pairs');
}

{
  const built=context({pathname:`/api/admin/leagues/matches/${matchId}/result`,method:'POST',body:{home_score:2,away_score:1}});
  await handleTeamLeagueRoute(built.ctx);
  const call=built.calls.find(x=>x.rpc==='record_league_match_result');
  assert.ok(call,'result must be recorded by the server-side database function');
  assert.equal(call.args.p_home_score,2);assert.equal(call.args.p_away_score,1);assert.equal(call.args.p_actor,userId);
}

{
  const built=context({pathname:`/api/admin/leagues/seasons/${seasonId}/fixtures/generate`,method:'POST',admin:false});
  await assert.rejects(()=>handleTeamLeagueRoute(built.ctx),e=>e.status===403&&e.code==='ADMIN_REQUIRED');
}

{
  const built=context({pathname:`/api/admin/leagues/seasons/${seasonId}/finalize`,method:'POST',seasons:[{id:seasonId,name:'Future season',status:'active',starts_at:'2026-01-01T00:00:00.000Z',ends_at:new Date(Date.now()+86400000).toISOString()}]});
  await assert.rejects(()=>handleTeamLeagueRoute(built.ctx),e=>e.status===409&&e.code==='SEASON_NOT_ENDED');
}

{
  const old='2026-01-01T00:00:00.000Z';
  const standings=[{team_id:'t1',division_code:'D5',played:1},{team_id:'t2',division_code:'D5',played:1}];
  const matches=[{id:matchId,status:'completed'}];
  const built=context({pathname:`/api/admin/leagues/seasons/${seasonId}/finalize`,method:'POST',seasons:[{id:seasonId,name:'Ended season',status:'active',starts_at:old,ends_at:old}],standings,matches,rpcResult:{data:null,error:null}});
  await handleTeamLeagueRoute(built.ctx);
  assert.ok(built.calls.some(x=>x.rpc==='finalize_league_season'));
  assert.equal(built.sent.value.body.finalized,true);
}

console.log('PASS — idempotent round-robin fixture generation, server-authoritative result entry, admin-only controls and guarded season finalization');
