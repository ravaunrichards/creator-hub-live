from pathlib import Path
import shutil,sys
f=Path("frontend/src/pages-room.js")
def stop(s): print("STOP:",s,file=sys.stderr); raise SystemExit(2)
if not f.is_file(): stop("Run from the existing repository root.")
s=f.read_text(encoding="utf-8")
if "CHCN_LIVE_LAYOUT_PATCH_V1" in s: stop("Patch marker already exists.")
old="""  function getMessageSenderName(message, ownMessage) {
    var sender = message && message.sender ? message.sender : {};
    var senderDisplayName = String(sender.display_name || '').trim();
    var senderUsername = String(sender.username || '').trim();

    if (ownMessage) {
      var ownProfile = CHL.profile || {};
      return String(
        ownProfile.display_name ||
        ownProfile.username ||
        senderDisplayName ||
        senderUsername ||
        'You'
      ).trim();
    }

    return senderDisplayName || senderUsername || 'Creator';
  }"""
new="""  function getMessageSenderName(message, ownMessage) {
    message = message || {};
    var sender = message.sender && typeof message.sender === 'object' ? message.sender : {};
    // Backend LIVE chat rows expose profile fields at the top level.
    var displayName = String(message.display_name || message.senderName || sender.display_name || sender.displayName || '').trim();
    var username = String(message.username || sender.username || '').trim();
    if (ownMessage) {
      var profile = CHL.profile || {};
      return String(profile.display_name || profile.displayName || profile.username || displayName || username || 'You').trim();
    }
    return displayName || username || 'Creator';
  }"""
if s.count(old)!=1: stop("Sender-name anchor mismatch; no changes made.")
s=s.replace(old,new,1)
anchor="    outlet.appendChild(layout);\n\n    /* LIVE controls. */"
insert="""    /* CHCN_LIVE_LAYOUT_PATCH_V1: four persistent layout modes. */
    var modes = [
      {value:'compact',label:'Compact Mobile'},
      {value:'balanced',label:'Balanced'},
      {value:'spacious',label:'Spacious Desktop'},
      {value:'grid',label:'Multi-Guest / Grid'}
    ];
    var picker = el('div',{class:'row wrap live-layout-picker',style:'gap:8px;align-items:center;margin:0 0 12px'});
    picker.appendChild(el('span',{class:'sub',style:'font-weight:700',text:'Room layout'}));
    var select = el('select',{class:'input','aria-label':'LIVE room layout',style:'width:auto;max-width:100%;min-width:0'});
    modes.forEach(function(m){select.appendChild(el('option',{value:m.value,text:m.label}));});
    var initial='balanced';
    try { var saved=window.localStorage.getItem('chcn-live-layout'); if(modes.some(function(m){return m.value===saved;})) initial=saved; } catch(_) {}
    function applyLayout(mode){
      if(!modes.some(function(m){return m.value===mode;})) mode='balanced';
      layout.dataset.liveLayout=mode; select.value=mode;
      try {window.localStorage.setItem('chcn-live-layout',mode);} catch(_) {}
    }
    select.addEventListener('change',function(){applyLayout(select.value);});
    picker.appendChild(select); outlet.appendChild(picker); applyLayout(initial);

    outlet.appendChild(layout);

    /* LIVE controls. */"""
if s.count(anchor)!=1: stop("Layout insertion anchor mismatch; no changes made.")
s=s.replace(anchor,insert,1)
css_anchor="  var ui = CHL.ui;\n"
css="""  var ui = CHL.ui;

  /* CHCN_LIVE_LAYOUT_PATCH_V1: scoped responsive styles. */
  (function(){
    if(document.getElementById('chcn-live-layout-styles')) return;
    var style=document.createElement('style'); style.id='chcn-live-layout-styles';
    style.textContent=[
      '.live-layout-picker .input{min-height:40px}',
      '.live-room-layout{display:grid;grid-template-columns:minmax(0,1.65fr) minmax(280px,1fr)}',
      '.live-room-layout>.live-video-card,.live-room-layout>.live-room-side{min-width:0}',
      '.live-stage{aspect-ratio:16/9;min-height:220px;background:radial-gradient(ellipse at 50% 25%,#20243b 0%,#080911 58%,#030407 100%);border-radius:12px}',
      '.live-stage video{width:100%;height:100%;object-fit:contain;background:#05050a}',
      '.live-room-layout[data-live-layout="compact"]{grid-template-columns:minmax(0,1fr);gap:10px!important}',
      '.live-room-layout[data-live-layout="compact"] .live-stage{aspect-ratio:4/3;min-height:180px}',
      '.live-room-layout[data-live-layout="balanced"]{grid-template-columns:minmax(0,1.35fr) minmax(260px,1fr)}',
      '.live-room-layout[data-live-layout="spacious"]{grid-template-columns:minmax(0,1.8fr) minmax(300px,.85fr);gap:20px!important}',
      '.live-room-layout[data-live-layout="spacious"] .live-stage{min-height:360px}',
      '.live-room-layout[data-live-layout="grid"]{grid-template-columns:minmax(0,1fr)}',
      '.live-room-layout[data-live-layout="grid"] .live-stage{min-height:260px}',
      '.live-room-layout[data-live-layout="grid"] .live-room-side{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}',
      '.live-room-layout[data-live-layout="grid"] .live-chat-card{grid-column:1/-1}',
      '.live-controls .btn,.live-chat-form .btn{min-height:42px;touch-action:manipulation}',
      '@media(max-width:760px){.live-room-layout,.live-room-layout[data-live-layout="balanced"],.live-room-layout[data-live-layout="spacious"]{grid-template-columns:minmax(0,1fr)}.live-room-layout[data-live-layout="spacious"] .live-stage{min-height:220px}.live-room-layout[data-live-layout="grid"] .live-room-side{grid-template-columns:minmax(0,1fr)}.live-room-layout[data-live-layout="grid"] .live-chat-card{grid-column:auto}.live-layout-picker .input{flex:1;width:100%!important}.live-stage{min-height:180px}.live-chat-messages{max-height:34vh}}',
      '@media(prefers-reduced-motion:reduce){.live-room-layout *{scroll-behavior:auto!important;animation:none!important;transition:none!important}}'
    ].join('\n'); document.head.appendChild(style);
  })();
"""
if s.count(css_anchor)!=1: stop("CSS insertion anchor mismatch; no changes made.")
s=s.replace(css_anchor,css,1)
bak=f.with_name('pages-room.js.pre-live-layout.bak')
if bak.exists(): stop("Backup already exists; move it aside before retrying.")
shutil.copy2(f,bak); f.write_text(s,encoding='utf-8')
print('Applied patch to',f,'; backup:',bak)
print('Only frontend/src/pages-room.js changed. Backend, Supabase, guest APIs, and recording retention are untouched.')
