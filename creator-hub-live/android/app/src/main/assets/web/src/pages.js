/* Creator Hub Live \u2014 pages: route handlers. Real Supabase reads/writes.
   Honest empty states; never fabricated data. */
(function(){
  'use strict';
  var CHL = window.CHL; var el = CHL.el, ui = CHL.ui, sb = CHL.sb;

  function needSetup(outlet){
    if (CHL.configured) return false;
    outlet.appendChild(ui.pageHead(CHL.brand, 'Create. Connect. Go LIVE.'));
    outlet.appendChild(ui.setupNotice());
    return true;
  }

  /* ============ HOME ============ */
  CHL.route('/', function(outlet){
    var hero = el('div',{class:'hero'},[
      el('h1',{html:'<span class="grad">Create. Connect.</span> Go LIVE.'}),
      el('p',{text:'A real international live-streaming & creator platform. Start a broadcast, send gifts, grow your audience \u2014 built on real infrastructure, no fake numbers.'}),
      el('div',{class:'row wrap',style:'gap:10px'},[
        el('a',{href:'#/create',class:'btn primary'},'\u25B6 Go LIVE now'),
        el('a',{href:'#/discover',class:'btn ghost'},'Explore streams')
      ])
    ]);
    outlet.appendChild(hero);
    if (needSetup(outlet)) return;

    outlet.appendChild(el('div',{class:'row between',style:'margin:4px 0 12px'},[
      el('div',{class:'h1',style:'font-size:20px',text:'Live now'}),
      el('a',{href:'#/discover',style:'color:var(--mut);font-size:13px'},'See all \u2192')
    ]));
    var grid = el('div',{class:'grid live'}); outlet.appendChild(grid);
    grid.appendChild(ui.spinner());
    loadLive(grid, 8);
  });

  function loadLive(grid, limit){
    sb.from('live_sessions')
      .select('id,title,viewer_count,status,started_at,host:profiles!live_sessions_host_id_fkey(username,display_name)')
      .eq('status','live').order('viewer_count',{ascending:false}).limit(limit||20)
      .then(function(r){
        grid.innerHTML = '';
        var rows = (r && r.data) || [];
        if (!rows.length){
          grid.appendChild(ui.empty('\uD83D\uDCF4','No one is live right now','Be the first to go LIVE \u2014 your stream will appear here in real time.', el('a',{href:'#/create',class:'btn primary',style:'margin-top:8px'},'Start streaming')));
          grid.style.display='block'; return;
        }
        grid.style.display='';
        rows.forEach(function(s){ grid.appendChild(ui.liveTile(s)); });
      }).catch(function(e){ grid.innerHTML=''; grid.appendChild(el('div',{class:'note',text:'Could not load streams: '+e.message})); });
  }

  /* ============ DISCOVER ============ */
  CHL.route('/discover', function(outlet){
    outlet.appendChild(ui.pageHead('Discover', 'Browse every live broadcast happening now.'));
    if (needSetup(outlet)) return;
    var cats = ['All','Just Chatting','Music','Gaming','IRL','Dance','Sports'];
    var bar = el('div',{class:'row wrap',style:'gap:8px;margin-bottom:16px'});
    cats.forEach(function(c,i){ bar.appendChild(el('span',{class:'chip'+(i===0?' on':''),onclick:function(){ bar.querySelectorAll('.chip').forEach(function(x){x.classList.remove('on');}); this.classList.add('on'); }},c)); });
    outlet.appendChild(bar);
    var grid = el('div',{class:'grid live'}); outlet.appendChild(grid);
    grid.appendChild(ui.spinner());
    loadLive(grid, 30);
  });

  /* ============ LIVE ROOM ============
     Canonical implementation lives in pages-room.js (server-authoritative
     LiveKit session via /api/live/rooms). It was previously registered here as
     well, which produced a DUPLICATE ROUTE REGISTRATION where the later file
     silently overwrote this one. Consolidated to a single owner (pages-room.js). */
})();
