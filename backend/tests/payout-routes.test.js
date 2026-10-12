import assert from 'node:assert/strict';
import { handlePayoutRoute } from '../src/payout-routes.js';

const uid='123e4567-e89b-12d3-a456-426614174200';
const payoutId='123e4567-e89b-12d3-a456-426614174201';
function context({pathname,method='GET',admin=true,body={},headers={},tables={},rpcResult}={}){
  const calls=[];const sent={value:null};
  function query(table){
    const q={table,op:'select',payload:null,filters:[],orders:[],max:Infinity};
    q.select=function(){return this;};q.eq=function(key,value){this.filters.push(row=>String(row[key])===String(value));return this;};
    q.in=function(key,values){this.filters.push(row=>values.map(String).includes(String(row[key])));return this;};
    q.order=function(key,options){this.orders.push({key,ascending:!options||options.ascending!==false});return this;};
    q.limit=function(n){this.max=n;return this;};q.upsert=function(value){this.op='upsert';this.payload=value;return this;};
    q.maybeSingle=async function(){const x=await this.run();return {data:x.data[0]||null,error:x.error};};
    q.run=async function(){
      calls.push({table,op:this.op,payload:this.payload});
      let data=(tables[table]||[]).filter(row=>this.filters.every(f=>f(row))).map(row=>({...row}));
      for(const order of [...this.orders].reverse())data.sort((a,b)=>String(a[order.key]||'').localeCompare(String(b[order.key]||''))*(order.ascending?1:-1));
      if(Number.isFinite(this.max))data=data.slice(0,this.max);
      if(this.op==='upsert')return {data:[{...this.payload}],error:null};
      return {data,error:null};
    };
    q.then=function(resolve,reject){return this.run().then(resolve,reject);};return q;
  }
  const client={from:query,rpc:async(name,args)=>{calls.push({rpc:name,args});return rpcResult||{data:{id:payoutId,status:'pending',user_id:uid,amount:500,reference:args.p_reference,payout_email_snapshot:args.p_paypal_email},error:null};}};
  const ctx={pathname,method,req:{headers:{authorization:'Bearer token',...headers},body},res:{},db:()=>client,requireSupabaseUser:async()=>({id:uid}),profileFor:async()=>({id:uid,is_admin:admin}),readJson:async()=>body,
    normalizeExternalError:error=>({message:error.message||'database error',code:error.code,details:error.details,hint:error.hint}),
    fail(status,code,message,details){const e=new Error(message);e.status=status;e.code=code;e.details=details;throw e;},
    ok(_res,payload){sent.value={status:200,body:{ok:true,...payload}};return sent.value;}};
  return {ctx,calls,sent};
}

{
  const built=context({pathname:'/api/creator/payouts',method:'POST',body:{amount:500},headers:{'idempotency-key':'creator-payout-test-key-0001'},tables:{paypal_payout_info:[{user_id:uid,paypal_email:'creator@example.com'}]}});
  await handlePayoutRoute(built.ctx);
  const call=built.calls.find(x=>x.rpc==='request_creator_payout');
  assert.ok(call,'payout request must use the atomic server-side ledger function');
  assert.equal(call.args.p_amount,500);assert.equal(call.args.p_user,uid);assert.match(call.args.p_reference,/creator-payout:/);
  assert.equal(built.sent.value.body.request.status,'pending');
}

{
  const built=context({pathname:'/api/creator/payouts',method:'POST',body:{amount:500},tables:{paypal_payout_info:[{user_id:uid,paypal_email:'creator@example.com'}]}});
  await assert.rejects(()=>handlePayoutRoute(built.ctx),e=>e.status===400&&e.code==='PAYOUT_IDEMPOTENCY_REQUIRED');
  assert.ok(!built.calls.some(x=>x.rpc),'missing idempotency key must not debit the wallet');
}

{
  const built=context({pathname:'/api/creator/payouts',method:'POST',body:{amount:500},headers:{'idempotency-key':'creator-payout-test-key-0002'},tables:{paypal_payout_info:[]}});
  await assert.rejects(()=>handlePayoutRoute(built.ctx),e=>e.status===409&&e.code==='PAYPAL_PAYOUT_ACCOUNT_REQUIRED');
  assert.ok(!built.calls.some(x=>x.rpc),'missing payout destination must not debit the wallet');
}

{
  const built=context({pathname:'/api/admin/payouts',method:'GET',admin:false});
  await assert.rejects(()=>handlePayoutRoute(built.ctx),e=>e.status===403&&e.code==='ADMIN_REQUIRED');
}

{
  const built=context({pathname:`/api/admin/payouts/${payoutId}/status`,method:'POST',body:{status:'paid',fiatAmount:10,fiatCurrency:'USD',paypalTransactionId:'PAYPAL-123'},tables:{}});
  await handlePayoutRoute(built.ctx);
  assert.ok(built.calls.some(x=>x.rpc==='admin_update_creator_payout'));
  const call=built.calls.find(x=>x.rpc==='admin_update_creator_payout');
  assert.equal(call.args.p_status,'paid');assert.equal(call.args.p_paypal_transaction_id,'PAYPAL-123');assert.equal(call.args.p_actor,uid);
}

{
  const built=context({pathname:`/api/admin/payouts/${payoutId}/status`,method:'POST',body:{status:'sent',fiatAmount:10,fiatCurrency:'USD'}});
  await assert.rejects(()=>handlePayoutRoute(built.ctx),e=>e.status===400&&e.code==='INVALID_PAYOUT_STATUS');
  assert.ok(!built.calls.some(x=>x.rpc),'invalid payout status must not reach database workflow');
}

console.log('PASS — creator payout idempotency, PayPal destination prerequisite, admin authorization and payout status contracts');
