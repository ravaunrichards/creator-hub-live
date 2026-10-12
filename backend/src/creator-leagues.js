// Creator Hub Creator Network — creator-league API module.
// Integration: import handleCreatorLeagueRoute and dispatch it before the existing 404 fallback.
// Requires existing server helpers passed through deps. Does not create a second HTTP server.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function bad(status, code, message) {
  const e = new Error(message); e.status = status; e.code = code; return e;
}
function validUuid(v, label='ID') {
  const s = String(v || '');
  if (!UUID.test(s)) throw bad(400, 'INVALID_INPUT', `${label} is invalid.`);
  return s;
}
function intScore(v, label) {
  if (!Number.isSafeInteger(v) || v < 0 || v > 1000000)
    throw bad(400, 'INVALID_SCORE', `${label} must be a whole number from 0 to 1,000,000.`);
  return v;
}
function amountString(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) throw bad(400, 'INVALID_AMOUNT', 'Entry fee must be greater than zero.');
  return n.toFixed(2);
}
async function unwrap(query) {
  const { data, error } = await query;
  if (error) throw error;
  return data;
}
async function leagueRole(client, leagueId, user) {
  const league = await unwrap(client.from('creator_leagues').select('*').eq('id', leagueId).maybeSingle());
  if (!league) throw bad(404, 'LEAGUE_NOT_FOUND', 'Creator league was not found.');
  const profile = await unwrap(client.from('profiles').select('is_admin').eq('id', user.id).maybeSingle());
  if (profile?.is_admin) return { league, role: 'global_admin' };
  if (league.owner_id === user.id) return { league, role: 'owner' };
  const assignment = await unwrap(client.from('creator_league_admins').select('role').eq('league_id', leagueId).eq('user_id', user.id).maybeSingle());
  if (!assignment) throw bad(403, 'LEAGUE_ADMIN_REQUIRED', 'You do not have permission to manage this league.');
  return { league, role: assignment.role };
}
async function requireLeagueManager(client, leagueId, user, roles=['owner','global_admin','admin']) {
  const auth = await leagueRole(client, leagueId, user);
  if (!roles.includes(auth.role)) throw bad(403, 'LEAGUE_PERMISSION_DENIED', 'Your league role cannot perform this action.');
  return auth;
}
async function listLeagues(client) {
  return unwrap(client.from('creator_leagues').select('id,owner_id,name,description,status,entry_fee,currency,max_participants,win_points,draw_points,loss_points,starts_at,ends_at,created_at').neq('status','draft').order('created_at',{ascending:false}).limit(100));
}
async function createLeague(client, user, body) {
  const name = String(body.name || '').trim();
  if (name.length < 3 || name.length > 100) throw bad(400,'INVALID_INPUT','League name must contain 3–100 characters.');
  const description = String(body.description || '').trim().slice(0,3000);
  const fee = Number(body.entryFee ?? 0);
  if (!Number.isFinite(fee) || fee < 0 || fee > 1000000) throw bad(400,'INVALID_AMOUNT','Entry fee must be between 0 and 1,000,000.');
  const currency = String(body.currency || 'USD').toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw bad(400,'INVALID_CURRENCY','Currency must be a three-letter code.');
  const max = Number(body.maxParticipants ?? 20);
  if (!Number.isSafeInteger(max) || max < 2 || max > 500) throw bad(400,'INVALID_INPUT','maxParticipants must be between 2 and 500.');
  const status = body.openRegistration === true ? 'registration_open' : 'draft';
  const row = await unwrap(client.from('creator_leagues').insert({
    owner_id:user.id,name,description,entry_fee:fee.toFixed(2),currency,
    max_participants:max,status,
    win_points:Number.isSafeInteger(body.winPoints) && body.winPoints>=0 && body.winPoints<=100 ? body.winPoints : 3,
    draw_points:Number.isSafeInteger(body.drawPoints) && body.drawPoints>=0 && body.drawPoints<=100 ? body.drawPoints : 1,
    loss_points:Number.isSafeInteger(body.lossPoints) && body.lossPoints>=0 && body.lossPoints<=100 ? body.lossPoints : 0,
    starts_at:body.startsAt || null, ends_at:body.endsAt || null
  }).select('*').single());
  return row;
}
async function registerCreator(client, user, leagueId) {
  const league = await unwrap(client.from('creator_leagues').select('*').eq('id',leagueId).maybeSingle());
  if (!league) throw bad(404,'LEAGUE_NOT_FOUND','Creator league was not found.');
  if (league.status !== 'registration_open') throw bad(409,'REGISTRATION_CLOSED','Registration is not open.');
  const existing = await unwrap(client.from('creator_league_registrations').select('*').eq('league_id',leagueId).eq('user_id',user.id).maybeSingle());
  if (existing && existing.status !== 'withdrawn') return existing;
  const regs = await unwrap(client.from('creator_league_registrations').select('id',{count:'exact'}).eq('league_id',leagueId).eq('status','registered'));
  if ((regs || []).length >= league.max_participants) throw bad(409,'LEAGUE_FULL','This league has reached its participant limit.');
  const status = Number(league.entry_fee) > 0 ? 'pending_payment' : 'registered';
  if (existing) {
    return unwrap(client.from('creator_league_registrations').update({status,updated_at:new Date().toISOString()}).eq('id',existing.id).select('*').single());
  }
  return unwrap(client.from('creator_league_registrations').insert({league_id:leagueId,user_id:user.id,status}).select('*').single());
}
async function makeRoundRobin(client, leagueId, user) {
  const {league} = await requireLeagueManager(client,leagueId,user);
  if (!['registration_closed','active'].includes(league.status)) throw bad(409,'LEAGUE_STATE','Close registration before generating fixtures.');
  const existing = await unwrap(client.from('creator_league_fixtures').select('id').eq('league_id',leagueId).limit(1));
  if (existing?.length) throw bad(409,'FIXTURES_EXIST','Fixtures already exist; deleting/replacing them requires a separate admin action.');
  const participants = await unwrap(client.from('creator_league_registrations').select('user_id').eq('league_id',leagueId).eq('status','registered').order('registered_at',{ascending:true}));
  const ids = (participants || []).map(x=>x.user_id);
  if (ids.length < 2) throw bad(409,'NOT_ENOUGH_PARTICIPANTS','At least two paid/registered creators are required.');
  const hasBye = ids.length % 2 === 1;
  if (hasBye) ids.push(null);
  const n = ids.length, rounds = n - 1, perRound = n/2, fixtures=[];
  let wheel = [...ids];
  for (let round=1; round<=rounds; round++) {
    for (let i=0;i<perRound;i++) {
      let a=wheel[i], b=wheel[n-1-i];
      if (a && b) {
        if ((round+i)%2===0) [a,b]=[b,a];
        fixtures.push({league_id:leagueId,round_number:round,home_user_id:a,away_user_id:b,status:'scheduled'});
      }
    }
    wheel=[wheel[0],wheel[n-1],...wheel.slice(1,n-1)];
  }
  await unwrap(client.from('creator_league_fixtures').insert(fixtures));
  await unwrap(client.from('creator_leagues').update({status:'active',updated_at:new Date().toISOString()}).eq('id',leagueId));
  return {rounds,fixturesCreated:fixtures.length};
}
async function recordScore(client, leagueId, fixtureId, user, body) {
  await requireLeagueManager(client,leagueId,user,['owner','global_admin','admin','scorer']);
  const homeScore=intScore(body.homeScore,'homeScore'), awayScore=intScore(body.awayScore,'awayScore');
  const fixture=await unwrap(client.from('creator_league_fixtures').select('*').eq('id',fixtureId).eq('league_id',leagueId).maybeSingle());
  if (!fixture) throw bad(404,'FIXTURE_NOT_FOUND','Fixture was not found in this league.');
  if (fixture.status==='cancelled') throw bad(409,'FIXTURE_CANCELLED','Cancelled fixtures cannot receive scores.');
  const previous = fixture.status==='completed';
  const updated=await unwrap(client.rpc('record_creator_league_score',{
    p_league_id:leagueId,p_fixture_id:fixtureId,p_actor_id:user.id,
    p_home_score:homeScore,p_away_score:awayScore,
    p_note:String(body.note||'').trim().slice(0,500)
  }));
  return Array.isArray(updated) ? updated[0] : updated;
}
async function standings(client, leagueId) {
  const league=await unwrap(client.from('creator_leagues').select('id,name,status,win_points,draw_points,loss_points').eq('id',leagueId).maybeSingle());
  if (!league) throw bad(404,'LEAGUE_NOT_FOUND','Creator league was not found.');
  const regs=await unwrap(client.from('creator_league_registrations').select('user_id,registered_at,profiles(id,username,display_name,avatar_url)').eq('league_id',leagueId).eq('status','registered'));
  const matches=await unwrap(client.from('creator_league_fixtures').select('home_user_id,away_user_id,home_score,away_score,status,round_number').eq('league_id',leagueId).eq('status','completed'));
  const rows=new Map();
  for (const reg of regs||[]) rows.set(reg.user_id,{userId:reg.user_id,username:reg.profiles?.username||null,displayName:reg.profiles?.display_name||reg.profiles?.username||'Creator',played:0,wins:0,draws:0,losses:0,points:0,for:0,against:0});
  for (const m of matches||[]) {
    if (m.home_score==null||m.away_score==null) continue;
    const h=rows.get(m.home_user_id),a=rows.get(m.away_user_id); if(!h||!a) continue;
    h.played++;a.played++;h.for+=m.home_score;h.against+=m.away_score;a.for+=m.away_score;a.against+=m.home_score;
    if(m.home_score>m.away_score){h.wins++;a.losses++;h.points+=league.win_points;a.points+=league.loss_points;}
    else if(m.home_score<m.away_score){a.wins++;h.losses++;a.points+=league.win_points;h.points+=league.loss_points;}
    else {h.draws++;a.draws++;h.points+=league.draw_points;a.points+=league.draw_points;}
  }
  const sorted=[...rows.values()].sort((a,b)=>b.points-a.points||(b.for-b.against)-(a.for-a.against)||b.for-a.for||a.displayName.localeCompare(b.displayName));
  return {league,standings:sorted.map((r,i)=>({...r,goalDifference:r.for-r.against,position:i+1}))};
}
async function createEntryOrder(client,user,leagueId,deps) {
  const league=await unwrap(client.from('creator_leagues').select('*').eq('id',leagueId).maybeSingle());
  if(!league) throw bad(404,'LEAGUE_NOT_FOUND','Creator league was not found.');
  if(league.status!=='registration_open') throw bad(409,'REGISTRATION_CLOSED','Registration is not open.');
  if(Number(league.entry_fee)<=0) throw bad(409,'NO_ENTRY_FEE','This league does not require payment.');
  const reg=await unwrap(client.from('creator_league_registrations').select('*').eq('league_id',leagueId).eq('user_id',user.id).maybeSingle());
  if(!reg||reg.status!=='pending_payment') throw bad(409,'REGISTRATION_REQUIRED','Register first; payment is only available for a pending registration.');
  const prior=await unwrap(client.from('creator_league_payments').select('*').eq('registration_id',reg.id).in('status',['created','pending']).maybeSingle());
  if(prior) return {orderId:prior.provider_order_id,status:prior.status,amount:Number(prior.amount),currency:prior.currency};
  const idem=`creator-league-${reg.id}-${Date.now()}`;
  const order=await deps.paypal('/v2/checkout/orders',{method:'POST',headers:{'PayPal-Request-Id':idem},body:JSON.stringify({
    intent:'CAPTURE',purchase_units:[{reference_id:`creator_league_${league.id}`,custom_id:`${league.id}:${reg.id}:${user.id}`,description:`Creator Hub league entry: ${league.name}`.slice(0,127),amount:{currency_code:league.currency,value:amountString(league.entry_fee)}}],
    application_context:{user_action:'PAY_NOW',...(deps.paypalReturnUrl?{return_url:`${deps.paypalReturnUrl}/?league_payment=success#/leagues`,cancel_url:`${deps.paypalReturnUrl}/#/leagues?payment_cancelled=true`}:{})}
  })});
  if(!order?.id) throw bad(502,'PAYMENT_PROVIDER_ERROR','PayPal did not return an order ID.');
  await unwrap(client.from('creator_league_payments').insert({
    league_id:league.id,registration_id:reg.id,user_id:user.id,provider_order_id:order.id,
    amount:amountString(league.entry_fee),currency:league.currency,status:'pending',raw_order:order
  }));
  const approve=Array.isArray(order.links)?order.links.find(x=>['approve','payer-action'].includes(x.rel)&&x.href):null;
  if(!approve?.href) throw bad(502,'PAYMENT_PROVIDER_ERROR','PayPal did not return an approval link.');
  let approval; try {const u=new URL(approve.href);const hosts=deps.paypalEnv==='live'?['paypal.com','www.paypal.com']:['sandbox.paypal.com','www.sandbox.paypal.com'];if(u.protocol!=='https:'||!hosts.includes(u.hostname))throw 0;approval=u.toString();}catch{throw bad(502,'PAYMENT_PROVIDER_ERROR','PayPal approval URL failed validation.');}
  return {orderId:order.id,status:'pending',amount:Number(league.entry_fee),currency:league.currency,approveUrl:approval};
}
async function captureEntryOrder(client,user,orderId,deps) {
  const id=String(orderId||'').trim();
  if(!id||id.length>128) throw bad(400,'INVALID_ORDER','A valid PayPal order ID is required.');
  const payment=await unwrap(client.from('creator_league_payments').select('*').eq('provider_order_id',id).maybeSingle());
  if(!payment) throw bad(404,'PAYMENT_NOT_FOUND','League payment order was not found.');
  if(payment.user_id!==user.id) throw bad(403,'PAYMENT_OWNER_MISMATCH','This payment belongs to another account.');
  if(payment.status==='completed') return {paid:true,registrationId:payment.registration_id,alreadyCaptured:true};
  const capture=await deps.paypal(`/v2/checkout/orders/${encodeURIComponent(id)}/capture`,{method:'POST',headers:{'PayPal-Request-Id':`capture-${id}`},body:'{}'});
  const pu=capture?.purchase_units?.[0];
  const cap=pu?.payments?.captures?.[0];
  const amount=cap?.amount;
  if(capture?.status!=='COMPLETED'||cap?.status!=='COMPLETED'||!cap?.id||
     Number(amount?.value).toFixed(2)!==Number(payment.amount).toFixed(2)||
     String(amount?.currency_code||'').toUpperCase()!==String(payment.currency).toUpperCase()){
    throw bad(502,'PAYMENT_VERIFICATION_FAILED','PayPal capture did not match the expected amount/currency or was not completed. Registration remains unpaid.');
  }
  const updated=await unwrap(client.from('creator_league_payments').update({
    status:'completed',provider_capture_id:cap.id,verified_at:new Date().toISOString(),raw_capture:capture,updated_at:new Date().toISOString()
  }).eq('id',payment.id).select('*').single());
  await unwrap(client.from('creator_league_registrations').update({status:'registered',updated_at:new Date().toISOString()}).eq('id',payment.registration_id).eq('user_id',user.id).eq('status','pending_payment'));
  return {paid:true,registrationId:updated.registration_id,alreadyCaptured:false};
}

export async function handleCreatorLeagueRoute({req,res,pathname,method,deps}) {
  const {requireSupabaseUser,db,readJson,ok,send,paypal,paypalReturnUrl,paypalEnv}=deps;
  const d={paypal,paypalReturnUrl,paypalEnv};
  const clientFor=()=>db();
  try {
    if(pathname==='/api/creator-leagues'&&method==='GET') {
      const client=clientFor(); return ok(res,{leagues:await listLeagues(client)});
    }
    if(pathname==='/api/creator-leagues'&&method==='POST') {
      const user=await requireSupabaseUser(req),client=clientFor(),profile=await unwrap(client.from('profiles').select('is_admin').eq('id',user.id).maybeSingle());
      if(!profile?.is_admin) throw bad(403,'GLOBAL_ADMIN_REQUIRED','Only a platform administrator can create a league in this initial API version.');
      const league=await createLeague(client,user,await readJson(req)); return send(res,201,{ok:true,league});
    }
    const one=pathname.match(/^\/api\/creator-leagues\/([0-9a-f-]{36})$/i);
    if(one&&method==='GET') {
      const client=clientFor(),id=validUuid(one[1],'League ID');
      const league=await unwrap(client.from('creator_leagues').select('id,owner_id,name,description,status,entry_fee,currency,max_participants,win_points,draw_points,loss_points,starts_at,ends_at,created_at').neq('status','draft').eq('id',id).maybeSingle());
      if(!league) throw bad(404,'LEAGUE_NOT_FOUND','Creator league was not found.');
      const fixtures=await unwrap(client.from('creator_league_fixtures').select('id,round_number,home_user_id,away_user_id,scheduled_at,status,home_score,away_score').eq('league_id',id).order('round_number',{ascending:true}));
      return ok(res,{league,fixtures:fixtures||[]});
    }
    const reg=pathname.match(/^\/api\/creator-leagues\/([0-9a-f-]{36})\/register$/i);
    if(reg&&method==='POST') {
      const user=await requireSupabaseUser(req),client=clientFor();
      return ok(res,{registration:await registerCreator(client,user,validUuid(reg[1],'League ID'))});
    }
    const fixture=pathname.match(/^\/api\/creator-leagues\/([0-9a-f-]{36})\/fixtures$/i);
    if(fixture&&method==='POST') {
      const user=await requireSupabaseUser(req),client=clientFor();
      return ok(res,await makeRoundRobin(client,validUuid(fixture[1],'League ID'),user));
    }
    const score=pathname.match(/^\/api\/creator-leagues\/([0-9a-f-]{36})\/fixtures\/([0-9a-f-]{36})\/score$/i);
    if(score&&method==='POST') {
      const user=await requireSupabaseUser(req),client=clientFor();
      return ok(res,{fixture:await recordScore(client,validUuid(score[1],'League ID'),validUuid(score[2],'Fixture ID'),user,await readJson(req))});
    }
    const board=pathname.match(/^\/api\/creator-leagues\/([0-9a-f-]{36})\/standings$/i);
    if(board&&method==='GET') {
      const client=clientFor();return ok(res,await standings(client,validUuid(board[1],'League ID')));
    }
    const pay=pathname.match(/^\/api\/creator-leagues\/([0-9a-f-]{36})\/payments\/paypal\/create-order$/i);
    if(pay&&method==='POST') {
      const user=await requireSupabaseUser(req),client=clientFor();
      return ok(res,await createEntryOrder(client,user,validUuid(pay[1],'League ID'),d));
    }
    if(pathname==='/api/creator-leagues/payments/paypal/capture-order'&&method==='POST') {
      const user=await requireSupabaseUser(req),client=clientFor(),body=await readJson(req);
      return ok(res,await captureEntryOrder(client,user,body.orderId,d));
    }
    const statusChange=pathname.match(/^\/api\/creator-leagues\/([0-9a-f-]{36})\/status$/i);
    if(statusChange&&method==='PUT') {
      const user=await requireSupabaseUser(req),client=clientFor(),leagueId=validUuid(statusChange[1],'League ID'),body=await readJson(req);
      const {league}=await requireLeagueManager(client,leagueId,user,['owner','global_admin','admin']);
      const allowed=['draft','registration_open','registration_closed','active','completed','cancelled'];
      if(!allowed.includes(body.status)) throw bad(400,'INVALID_LEAGUE_STATUS',`status must be one of: ${allowed.join(', ')}.`);
      const transitions={
        draft:['registration_open','cancelled'],
        registration_open:['registration_closed','cancelled'],
        registration_closed:['active','cancelled'],
        active:['completed','cancelled'],
        completed:[],
        cancelled:[]
      };
      if(body.status!==league.status && !transitions[league.status].includes(body.status))
        throw bad(409,'INVALID_STATUS_TRANSITION',`Cannot change league status from ${league.status} to ${body.status}.`);
      if(body.status==='active') {
        const existing=await unwrap(client.from('creator_league_fixtures').select('id').eq('league_id',leagueId).limit(1));
        if(!existing?.length) throw bad(409,'FIXTURES_REQUIRED','Generate fixtures before activating the league.');
      }
      const updated=await unwrap(client.from('creator_leagues').update({status:body.status,updated_at:new Date().toISOString()}).eq('id',leagueId).select('*').single());
      return ok(res,{league:updated});
    }
    const adminAssign=pathname.match(/^\/api\/creator-leagues\/([0-9a-f-]{36})\/admins$/i);
    if(adminAssign&&method==='POST') {
      const user=await requireSupabaseUser(req),client=clientFor(),body=await readJson(req);
      const profile=await unwrap(client.from('profiles').select('is_admin').eq('id',user.id).maybeSingle());
      if(!profile?.is_admin) throw bad(403,'GLOBAL_ADMIN_REQUIRED','Only a platform administrator may assign league roles.');
      const leagueId=validUuid(adminAssign[1],'League ID'),target=validUuid(body.userId,'User ID');
      if(!['admin','scorer','moderator'].includes(body.role)) throw bad(400,'INVALID_ROLE','Role must be admin, scorer, or moderator.');
      const assignment=await unwrap(client.from('creator_league_admins').upsert({league_id:leagueId,user_id:target,role:body.role,granted_by:user.id},{onConflict:'league_id,user_id'}).select('*').single());
      return ok(res,{assignment});
    }
    return false;
  } catch(error) {
    const status=Number(error?.status)||Number(error?.statusCode)||500;
    const code=error?.code||'CREATOR_LEAGUE_ERROR';
    if(status>=500) console.error('[Creator League API]',{status,code,message:error?.message});
    return send(res,status,{ok:false,code,error:status>=500?'Creator league request failed.':(error?.message||'Request failed.')});
  }
}
