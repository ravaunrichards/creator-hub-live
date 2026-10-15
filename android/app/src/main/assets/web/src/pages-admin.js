/* Creator Hub Creator Network \u2014 Admin Center. All routes gated to admin profiles by the router. */
(function(){
  'use strict';
  var CHL = window.CHL; var el = CHL.el, ui = CHL.ui, sb = CHL.sb;

  var ANAV=[
    ['#/admin','Dashboard'],['#/admin/users','Users'],['#/admin/content','Content'],
    ['#/admin/live','LIVE'],['#/admin/payments','Payments'],['#/admin/coins','Coins'],
    ['#/admin/diamonds','Diamonds'],['#/admin/gifts','Gifts'],['#/admin/subscriptions','Subscriptions'],
    ['#/admin/payouts','Payouts'],['#/admin/teams','Teams'],['#/admin/leagues','Leagues'],
    ['#/admin/rankings','Rankings'],['#/admin/moderation','Moderation'],['#/admin/reports','Reports'],
    ['#/admin/verification','Verification'],['#/admin/settings','Settings'],['#/admin/audit','Audit']
  ];
  function anav(){
    var bar=el('div',{class:'row wrap',style:'gap:6px;margin-bottom:16px'});
    ANAV.forEach(function(it){ var on=CHL.current.path===it[0].replace('#',''); bar.appendChild(el('a',{href:it[0],class:'chip'+(on?' on':'')},it[1])); });
    return bar;
  }
  function head(o,title,sub){
    o.appendChild(el('div',{class:'row',style:'gap:8px;margin-bottom:4px'},[ el('span',{class:'pill',text:'\uD83D\uDD12 ADMIN'}) ]));
    o.appendChild(ui.pageHead(title,sub));
    if(!CHL.configured){ o.appendChild(ui.setupNotice()); return true; }
    o.appendChild(anav()); return false;
  }

  function countCard(label, table, filter){
    var c=ui.statCard('\u2026',label);
    var q=sb.from(table).select('*',{count:'exact',head:true});
    if(filter) q=filter(q);
    q.then(function(r){ c.querySelector('.stat-v').textContent=CHL.fmt(r.count||0); }).catch(function(){ c.querySelector('.stat-v').textContent='0'; });
    return c;
  }

  CHL.route('/admin', function(o){ if(head(o,'Admin Dashboard','Platform overview \u2014 real counts from the database.')) return;
    var stat=el('div',{class:'grid stat'}); o.appendChild(stat);
    stat.appendChild(countCard('Users','profiles'));
    stat.appendChild(countCard('Live now','live_sessions',function(q){ return q.eq('status','live'); }));
    stat.appendChild(countCard('Posts','posts'));
    stat.appendChild(countCard('Gift tx','gift_transactions'));
    stat.appendChild(countCard('Payments','payments'));
    stat.appendChild(countCard('Teams','teams'));
    o.appendChild(el('div',{class:'note',html:'The admin account must be provisioned securely (set <code>is_admin=true</code> or <code>role=\'admin\'</code> on your profile row). Admin credentials are never hard-coded.'}));
  });

  function listPage(path,title,sub,table,cols){
    CHL.route(path, function(o){ if(head(o,title,sub)) return;
      var wrap=el('div',{class:'card',style:'overflow:auto'}); o.appendChild(wrap); wrap.appendChild(ui.spinner());
      sb.from(table).select(cols.join(',')).limit(50).then(function(r){ wrap.innerHTML='';
        var rows=(r&&r.data)||[];
        if(r&&r.error){ wrap.appendChild(el('div',{class:'note',text:'Table \u201c'+table+'\u201d: '+r.error.message})); return; }
        if(!rows.length){ wrap.appendChild(ui.empty('\uD83D\uDCED','Nothing here yet','No rows in '+table+'. Real data appears as the platform is used.')); return; }
        var t=el('table',{style:'width:100%;border-collapse:collapse;font-size:13px'});
        var hr=el('tr'); cols.forEach(function(c){ hr.appendChild(el('th',{style:'text-align:left;padding:8px;border-bottom:1px solid var(--line);color:var(--mut)',text:c})); }); t.appendChild(hr);
        rows.forEach(function(row){ var tr=el('tr'); cols.forEach(function(c){ tr.appendChild(el('td',{style:'padding:8px;border-bottom:1px solid var(--line)',text:String(row[c]==null?'':row[c]).slice(0,40)})); }); t.appendChild(tr); });
        wrap.appendChild(t);
      }).catch(function(e){ wrap.innerHTML=''; wrap.appendChild(el('div',{class:'note',text:e.message})); });
    });
  }

  listPage('/admin/users','Users','Manage, verify, restrict and suspend accounts.','profiles',['id','username','display_name']);
  listPage('/admin/content','Content','Review and moderate posts.','posts',['id','author_id','created_at']);
  listPage('/admin/live','LIVE','Monitor and manage live sessions.','live_sessions',['id','title','status','viewer_count']);
  listPage('/admin/payments','Payments','All payment records (idempotent ledger).','payments',['id','user_id','status','provider']);
  listPage('/admin/coins','Coins','Coin ledger entries.','coin_ledger',['id','user_id','amount','balance_after']);
  listPage('/admin/diamonds','Diamonds','Diamond ledger entries.','diamond_ledger',['id','user_id','amount','balance_after']);
  listPage('/admin/gifts','Gifts','Gift transactions.','gift_transactions',['id','sender_id','recipient_id','coins']);
  listPage('/admin/subscriptions','Subscriptions','Active and past subscriptions.','subscriptions',['id','subscriber_id','creator_id','status']);
  CHL.route('/admin/payouts', function(o){
    if(head(o,'Creator payouts','Review creator requests from the diamond ledger. Actual PayPal transfers are made externally and must be confirmed here with a transaction reference.')) return;
    var wrap=el('div',{class:'card',style:'min-width:0;overflow:auto'});o.appendChild(wrap);wrap.appendChild(ui.spinner());
    function feedback(node,text,error){node.appendChild(el('div',{class:'note',style:error?'border-color:var(--warn);margin-top:8px':'margin-top:8px',text:text}));}
    function load(){
      wrap.innerHTML='';wrap.appendChild(ui.spinner());
      CHL.authenticatedApiRequest('/api/admin/payouts').then(function(result){
        wrap.innerHTML='';var rows=result&&result.requests||[];
        if(!rows.length){wrap.appendChild(ui.empty('💸','No payout requests yet','Creator requests will appear here when submitted. No sample transactions are created.'));return;}
        rows.forEach(function(p){
          var creator=p.creator&&(p.creator.displayName||p.creator.username)||p.user_id;
          var box=el('div',{class:'tile',style:'margin:8px 0;min-width:0;overflow-wrap:anywhere'});
          box.appendChild(el('div',{class:'t',text:creator+' · '+CHL.fmt(Number(p.amount)||0)+' diamonds'}));
          box.appendChild(el('div',{class:'u',text:'Status: '+String(p.status||'unknown').toUpperCase()+' · Requested: '+(p.created_at?new Date(p.created_at).toLocaleString():'—')}));
          box.appendChild(el('div',{class:'u',text:'PayPal destination: '+(p.payout_email_snapshot||'Missing destination')}));
          box.appendChild(el('div',{class:'u',text:'Reference: '+String(p.reference||'—')}));
          if(p.fiat_amount!=null)box.appendChild(el('div',{class:'u',text:'Recorded payout: '+String(p.fiat_currency||'USD')+' '+Number(p.fiat_amount).toFixed(2)}));
          if(p.paypal_transaction_id)box.appendChild(el('div',{class:'u',text:'PayPal transaction: '+p.paypal_transaction_id}));
          if(p.admin_note)box.appendChild(el('div',{class:'u',text:'Last note: '+p.admin_note}));
          if(p.status==='pending'||p.status==='approved'){
            var controls=el('div',{style:'display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;margin-top:12px'});
            var fiat=el('input',{class:'input',type:'number',min:'0.01',step:'0.01',placeholder:'Actual fiat amount'});fiat.value=p.fiat_amount==null?'':String(p.fiat_amount);
            var currency=el('input',{class:'input',type:'text',maxlength:'3',placeholder:'USD'});currency.value=p.fiat_currency||'USD';
            var txn=el('input',{class:'input',type:'text',maxlength:'200',placeholder:'PayPal transaction ID (required to mark paid)'});txn.value=p.paypal_transaction_id||'';
            var note=el('textarea',{class:'input',rows:'2',maxlength:'1000',placeholder:'Administrator note (optional)'});note.value=p.admin_note||'';
            var output=el('div',{style:'width:100%'});
            controls.appendChild(el('label',{class:'field',style:'flex:1 1 150px;min-width:0'},[el('span',{text:'Actual fiat payout'}),fiat]));
            controls.appendChild(el('label',{class:'field',style:'flex:0 1 100px;min-width:90px'},[el('span',{text:'Currency'}),currency]));
            controls.appendChild(el('label',{class:'field',style:'flex:1 1 240px;min-width:0'},[el('span',{text:'PayPal transaction reference'}),txn]));
            controls.appendChild(el('label',{class:'field',style:'flex:1 1 100%;min-width:0'},[el('span',{text:'Administrator note'}),note]));
            controls.appendChild(output);
            async function update(status){
              output.innerHTML='';
              if((status==='approved'||status==='paid')&&(!Number.isFinite(Number(fiat.value))||Number(fiat.value)<=0)){feedback(output,'Enter the actual amount in '+(currency.value||'USD')+'.',true);return;}
              if(status==='paid'&&!txn.value.trim()){feedback(output,'Enter the PayPal transaction reference only after the transfer succeeds.',true);return;}
              if(status==='rejected'&&!window.confirm('Reject this payout request and refund the diamonds to the creator?'))return;
              controls.querySelectorAll('button').forEach(function(b){b.disabled=true;});
              try{
                var response=await CHL.authenticatedApiRequest('/api/admin/payouts/'+encodeURIComponent(p.id)+'/status',{method:'POST',body:{status:status,fiatAmount:fiat.value?Number(fiat.value):null,fiatCurrency:currency.value||'USD',adminNote:note.value,paypalTransactionId:txn.value}});
                if(!response||!response.request||!response.request.id)throw new Error('The backend did not confirm the status change.');
                feedback(output,'Payout request updated to '+status.toUpperCase()+'.',false);load();
              }catch(error){feedback(output,(error&&error.message)||'Could not update the payout request.',true);controls.querySelectorAll('button').forEach(function(b){b.disabled=false;});}
            }
            if(p.status==='pending')controls.appendChild(el('button',{class:'btn primary',type:'button',onclick:function(){update('approved');}},'Approve request'));
            controls.appendChild(el('button',{class:'btn primary',type:'button',onclick:function(){update('paid');}},'Record paid transfer'));
            controls.appendChild(el('button',{class:'btn',type:'button',onclick:function(){update('rejected');}},'Reject and refund diamonds'));
            box.appendChild(controls);
          } else {
            box.appendChild(el('div',{class:'u',text:'This request is in a terminal status and cannot be changed through this screen.'}));
          }
          wrap.appendChild(box);
        });
      }).catch(function(error){wrap.innerHTML='';feedback(wrap,(error&&error.message)||'Could not load payout requests.',true);});
    }
    load();
  });
  listPage('/admin/teams','Teams','Manage teams by their official league division and points.','teams',['id','name','division_code','points']);
  CHL.route('/admin/leagues', function(o){
    if(head(o,'Leagues','Create and activate competition seasons. Existing divisions and the league promotion/relegation rules remain server-managed.')) return;
    o.appendChild(el('div',{class:'note',style:'margin-bottom:14px',text:'A division catalog is not an active season. Create a season with the intended dates, then activate it when the current time falls inside that date range. Activation initializes standings for existing teams; teams created later are added automatically.'}));

    function inputField(labelText,type,placeholder){
      var input=el('input',{class:'input',type:type,placeholder:placeholder||''});
      input.required=true;
      var wrap=el('label',{class:'field',style:'flex:1 1 240px;min-width:0'},[el('span',{text:labelText}),input]);
      return {wrap:wrap,input:input};
    }
    function message(text,kind){return el('div',{class:'note',style:'margin:10px 0;'+(kind==='error'?'border-color:var(--warn);':''),text:text});}
    function dateText(value){var date=new Date(value);return Number.isNaN(date.getTime())?String(value||'—'):date.toLocaleString();}
    var activeMatchPanel=null;
    function renderSeasonMatches(season){
      if(activeMatchPanel&&activeMatchPanel.parentNode)activeMatchPanel.parentNode.removeChild(activeMatchPanel);
      var panel=el('div',{class:'card',style:'min-width:0;margin:12px 0;overflow:hidden'});activeMatchPanel=panel;
      panel.appendChild(el('div',{class:'t',text:'Fixtures and results · '+season.name}));
      panel.appendChild(message('Fixture generation adds one round-robin match per team pair in each division and preserves existing fixtures. Record a score only when the result is known. Corrected results rebuild standings on the server.'));
      var actions=el('div',{class:'row wrap',style:'gap:8px;margin:10px 0'});
      var generate=el('button',{class:'btn primary',type:'button'},'Generate missing fixtures');
      var refresh=el('button',{class:'btn',type:'button'},'Refresh fixtures/results');
      if(season.status==='scheduled'||season.status==='active')actions.appendChild(generate);
      actions.appendChild(refresh);panel.appendChild(actions);
      var feedback=el('div');panel.appendChild(feedback);
      var matchesWrap=el('div',{style:'min-width:0'});panel.appendChild(matchesWrap);listWrap.appendChild(panel);
      async function loadMatches(){
        matchesWrap.innerHTML='';matchesWrap.appendChild(ui.spinner());
        try{
          var result=await CHL.authenticatedApiRequest('/api/admin/leagues/seasons/'+encodeURIComponent(season.id)+'/matches');
          var matches=result&&result.matches||[];matchesWrap.innerHTML='';
          if(!matches.length){matchesWrap.appendChild(ui.empty('⚽','No fixtures yet','Generate fixtures after teams have been enrolled in this season. No matches or scores are made up.'));return;}
          matches.forEach(function(match){
            var card=el('div',{class:'tile',style:'margin:9px 0;min-width:0;overflow-wrap:anywhere'});
            function relationName(value,fallback){return Array.isArray(value)?(value[0]&&value[0].name||fallback):(value&&value.name||fallback);}
            var home=relationName(match.home_team,String(match.home_team_id||'').slice(0,8));
            var away=relationName(match.away_team,String(match.away_team_id||'').slice(0,8));
            card.appendChild(el('div',{class:'t',text:home+'  '+(match.home_score==null?'—':match.home_score)+' : '+(match.away_score==null?'—':match.away_score)+'  '+away}));
            card.appendChild(el('div',{class:'u',text:'Division '+match.division_code+' · Round '+(match.round_number||'unassigned')+' · '+String(match.status||'unknown').toUpperCase()}));
            if(match.status==='completed')card.appendChild(el('div',{class:'u',text:'Result recorded: '+(match.played_at?new Date(match.played_at).toLocaleString():'timestamp not recorded')}));
            if(match.status==='scheduled'||match.status==='live'||match.status==='completed'){
              var scoreForm=el('form',{style:'display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin-top:10px'});
              var hs=el('input',{class:'input',type:'number',min:'0',max:'100',step:'1',required:true,placeholder:'Home score'});if(match.home_score!=null)hs.value=String(match.home_score);
              var as=el('input',{class:'input',type:'number',min:'0',max:'100',step:'1',required:true,placeholder:'Away score'});if(match.away_score!=null)as.value=String(match.away_score);
              var save=el('button',{class:'btn primary',type:'submit'},match.status==='completed'?'Correct result':'Record result');
              scoreForm.appendChild(el('label',{class:'field',style:'flex:0 1 120px;min-width:90px'},[el('span',{text:'Home score'}),hs]));
              scoreForm.appendChild(el('label',{class:'field',style:'flex:0 1 120px;min-width:90px'},[el('span',{text:'Away score'}),as]));
              scoreForm.appendChild(save);var resultFeedback=el('div',{style:'width:100%'});scoreForm.appendChild(resultFeedback);card.appendChild(scoreForm);
              scoreForm.addEventListener('submit',async function(event){
                event.preventDefault();resultFeedback.innerHTML='';
                var hv=Number(hs.value),av=Number(as.value);if(!Number.isSafeInteger(hv)||!Number.isSafeInteger(av)||hv<0||av<0||hv>100||av>100){resultFeedback.appendChild(message('Enter whole-number scores between 0 and 100.','error'));return;}
                save.disabled=true;save.textContent='Saving…';
                try{
                  var op=match.status==='completed'?'correct':'result';
                  var saved=await CHL.authenticatedApiRequest('/api/admin/leagues/matches/'+encodeURIComponent(match.id)+'/'+op,{method:'POST',body:{home_score:hv,away_score:av}});
                  if(!saved||!saved.match||!saved.match.id)throw new Error('The backend did not confirm the saved result.');
                  feedback.innerHTML='';feedback.appendChild(message('Match result saved. Season standings were recalculated by the database.'));loadMatches();
                }catch(error){resultFeedback.appendChild(message((error&&error.message)||'Could not save match result.','error'));save.disabled=false;save.textContent=match.status==='completed'?'Correct result':'Record result';}
              });
            }
            if(match.status==='scheduled'){
              var cancel=el('button',{class:'btn',type:'button',style:'margin-top:8px'},'Cancel fixture');
              cancel.addEventListener('click',async function(){
                if(!window.confirm('Cancel this fixture? It will not count as a result.'))return;
                cancel.disabled=true;
                try{await CHL.authenticatedApiRequest('/api/admin/leagues/matches/'+encodeURIComponent(match.id)+'/cancel',{method:'POST',body:{}});feedback.innerHTML='';feedback.appendChild(message('Fixture cancelled.'));loadMatches();}
                catch(error){feedback.innerHTML='';feedback.appendChild(message((error&&error.message)||'Could not cancel fixture.','error'));cancel.disabled=false;}
              });card.appendChild(cancel);
            }
            matchesWrap.appendChild(card);
          });
        }catch(error){matchesWrap.innerHTML='';matchesWrap.appendChild(message((error&&error.message)||'Could not load fixtures/results.','error'));}
      }
      generate.addEventListener('click',async function(){
        feedback.innerHTML='';generate.disabled=true;generate.textContent='Generating…';
        try{
          var response=await CHL.authenticatedApiRequest('/api/admin/leagues/seasons/'+encodeURIComponent(season.id)+'/fixtures/generate',{method:'POST',body:{}});
          feedback.appendChild(message('Added '+Number(response&&response.fixturesCreated||0)+' missing fixture(s). Existing fixtures were preserved.'));
          loadMatches();
        }catch(error){feedback.appendChild(message((error&&error.message)||'Could not generate fixtures.','error'));}
        finally{generate.disabled=false;generate.textContent='Generate missing fixtures';}
      });
      refresh.addEventListener('click',loadMatches);
      loadMatches();
    }
    var form=el('form',{class:'card',style:'display:flex;flex-wrap:wrap;gap:10px;align-items:flex-start;min-width:0;margin-bottom:16px'});
    var seasonName=inputField('Season name','text','Opening Season / Rising Stars / Champions League / All-Star Season'); seasonName.input.maxLength=100;
    var seasonStart=inputField('Season starts','datetime-local','');
    var seasonEnd=inputField('Season ends','datetime-local','');
    form.appendChild(seasonName.wrap);form.appendChild(seasonStart.wrap);form.appendChild(seasonEnd.wrap);
    var activateNow=el('input',{type:'checkbox'});
    var activateWrap=el('label',{class:'field',style:'flex:1 1 100%;display:flex;gap:8px;align-items:center'},[activateNow,el('span',{text:'Activate immediately (current date/time must be inside this season)'})]);
    form.appendChild(activateWrap);
    var submit=el('button',{class:'btn primary',type:'submit'},'Create season');form.appendChild(submit);
    var feedback=el('div',{style:'width:100%'});form.appendChild(feedback);o.appendChild(form);

    var listWrap=el('div',{class:'card',style:'min-width:0'});o.appendChild(el('div',{class:'h1',style:'font-size:18px;margin:10px 0'},'Existing seasons'));o.appendChild(listWrap);
    function loadSeasons(){
      activeMatchPanel=null;listWrap.innerHTML='';listWrap.appendChild(ui.spinner());
      CHL.authenticatedApiRequest('/api/admin/leagues/seasons').then(function(result){
        listWrap.innerHTML='';var rows=result&&result.seasons||[];
        if(!rows.length){listWrap.appendChild(ui.empty('🏅','No seasons created yet','Create the first season above. No season or standings will be fabricated automatically.'));return;}
        rows.forEach(function(season){
          var details=el('div',{style:'min-width:0;flex:1;overflow-wrap:anywhere'},[
            el('div',{class:'t',text:season.name}),
            el('div',{class:'u',text:'Status: '+season.status}),
            el('div',{class:'u',text:'Starts: '+dateText(season.starts_at)}),
            el('div',{class:'u',text:'Ends: '+dateText(season.ends_at)})
          ]);
          var row=el('div',{class:'tile',style:'display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap;margin-bottom:8px;min-width:0'},[details]);
          var starts=Date.parse(season.starts_at),ends=Date.parse(season.ends_at),now=Date.now();
          if(season.status==='scheduled'&&Number.isFinite(starts)&&Number.isFinite(ends)&&starts<=now&&now<ends){
            var activateBtn=el('button',{class:'btn primary',type:'button'},'Activate season');
            activateBtn.addEventListener('click',function(){
              activateBtn.disabled=true;activateBtn.textContent='Activating…';
              CHL.authenticatedApiRequest('/api/admin/leagues/seasons/'+encodeURIComponent(season.id)+'/activate',{method:'POST',body:{}}).then(function(){feedback.innerHTML='';feedback.appendChild(message('Season activated. Existing teams were initialized in the season standings.'));loadSeasons();}).catch(function(error){feedback.innerHTML='';feedback.appendChild(message((error&&error.message)||'Could not activate the season.', 'error'));activateBtn.disabled=false;activateBtn.textContent='Activate season';});
            });row.appendChild(activateBtn);
          }
          var manageBtn=el('button',{class:'btn',type:'button'},'Manage fixtures/results');
          manageBtn.addEventListener('click',function(){renderSeasonMatches(season);});
          row.appendChild(manageBtn);
          if(season.status==='active'&&Number.isFinite(ends)&&ends<=now){
            var finalizeBtn=el('button',{class:'btn primary',type:'button'},'Finalize season');
            finalizeBtn.addEventListener('click',async function(){
              if(!window.confirm('Finalize this season and apply server-calculated promotions/relegations? This action is final.'))return;
              finalizeBtn.disabled=true;finalizeBtn.textContent='Finalizing…';
              try{
                var result=await CHL.authenticatedApiRequest('/api/admin/leagues/seasons/'+encodeURIComponent(season.id)+'/finalize',{method:'POST',body:{}});
                feedback.innerHTML='';feedback.appendChild(message('Season finalized. Server-managed promotion/relegation outcomes were applied.'));
                loadSeasons();
              }catch(error){feedback.innerHTML='';feedback.appendChild(message((error&&error.message)||'Could not finalize season.','error'));finalizeBtn.disabled=false;finalizeBtn.textContent='Finalize season';}
            });row.appendChild(finalizeBtn);
          }
          listWrap.appendChild(row);
        });
      }).catch(function(error){listWrap.innerHTML='';listWrap.appendChild(message((error&&error.message)||'Could not load seasons.','error'));});
    }
    form.addEventListener('submit',function(event){
      event.preventDefault();feedback.innerHTML='';
      if(!seasonName.input.value.trim()){feedback.appendChild(message('Enter a season name.','error'));seasonName.input.focus();return;}
      if(!seasonStart.input.value||!seasonEnd.input.value){feedback.appendChild(message('Enter both the season start and end date/time.','error'));return;}
      var startDate=new Date(seasonStart.input.value),endDate=new Date(seasonEnd.input.value);
      if(Number.isNaN(startDate.getTime())||Number.isNaN(endDate.getTime())||endDate<=startDate){feedback.appendChild(message('The end date/time must be later than the start date/time.','error'));return;}
      if(activateNow.checked&&!(startDate.getTime()<=Date.now()&&Date.now()<endDate.getTime())){feedback.appendChild(message('To activate immediately, the current time must fall inside the season dates.','error'));return;}
      submit.disabled=true;submit.textContent='Creating…';
      CHL.authenticatedApiRequest('/api/admin/leagues/seasons',{method:'POST',body:{name:seasonName.input.value.trim(),starts_at:startDate.toISOString(),ends_at:endDate.toISOString(),activate:activateNow.checked}}).then(function(result){
        feedback.innerHTML='';var season=result&&result.season;
        feedback.appendChild(message(season&&season.status==='active'?'Season created and activated. '+(result.seededTeams||0)+' existing team(s) initialized.':'Season created as scheduled. Activate it once the date window begins.'));
        seasonName.input.value='';loadSeasons();
      }).catch(function(error){feedback.innerHTML='';var text=(error&&error.message)||'Could not create the season.';if(error&&error.code)text+=' ['+error.code+']';feedback.appendChild(message(text,'error'));}).finally(function(){submit.disabled=false;submit.textContent='Create season';});
    });
    loadSeasons();
  });
  listPage('/admin/rankings','Rankings','Computed leaderboards.','rankings',['id','scope','subject_id','points']);
  listPage('/admin/moderation','Moderation','Moderation actions log.','moderation_actions',['id','actor_id','action','target_id']);
  listPage('/admin/reports','Reports','User reports queue.','reports',['id','reporter_id','type','status']);
  listPage('/admin/verification','Verification','Verification requests.','profiles',['id','username','display_name']);
  listPage('/admin/audit','Audit log','Every sensitive admin action is logged.','admin_audit_logs',['id','admin_id','action','created_at']);

  CHL.route('/admin/settings', function(o){ if(head(o,'Platform settings','Feature flags, currency, countries and languages.')) return;
    var wrap=el('div',{class:'card',style:'overflow:auto'}); o.appendChild(wrap); wrap.appendChild(ui.spinner());
    sb.from('platform_settings').select('key,value').limit(100).then(function(r){ wrap.innerHTML='';
      if(r&&r.error){ wrap.appendChild(el('div',{class:'note',text:r.error.message})); return; }
      var rows=(r&&r.data)||[];
      if(!rows.length){ wrap.appendChild(ui.empty('\u2699\uFE0F','No settings yet','Platform settings are stored here.')); return; }
      rows.forEach(function(s){ wrap.appendChild(el('div',{class:'row between',style:'padding:8px 0;border-bottom:1px solid var(--line)'},[ el('b',{text:s.key}), el('span',{style:'color:var(--mut)',text:String(s.value)}) ])); });
    }).catch(function(e){ wrap.innerHTML=''; wrap.appendChild(el('div',{class:'note',text:e.message})); });
  });
})();
