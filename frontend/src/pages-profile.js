/* Creator Hub Live â€” connected public and personal creator profiles. */
(function () {
  'use strict';
  var CHL = window.CHL, el = CHL.el, ui = CHL.ui, sb = CHL.sb;
  if (!CHL || !CHL.routes || !sb) return;

  // Replace the placeholder profile route deliberately, without leaving duplicate route registrations.
  delete CHL.routes['/profile'];
  CHL.route('/profile', function (outlet, route) {
    if (!CHL.configured) { outlet.appendChild(ui.pageHead('My Profile')); outlet.appendChild(ui.setupNotice()); return; }
    var handle = route && route.params && route.params.length ? decodeURIComponent(String(route.params[0])) : null;
    if (!CHL.user && !handle) { CHL.navigate('#/login'); return; }
    loadProfile(outlet, handle);
  });

  // Make the existing profile entry explicitly identifiable without adding a second navigation item.
  if (typeof CHL.mountShell === 'function' && !CHL._profileNavLabelPatched) {
    var originalMountShell = CHL.mountShell;
    CHL.mountShell = function (base) {
      var result = originalMountShell.apply(this, arguments);
      document.querySelectorAll('a[data-base="/profile"]').forEach(function (link) {
        Array.prototype.slice.call(link.childNodes).forEach(function (node) {
          if (node.nodeType === 3 && node.textContent.trim()) node.textContent = 'My Profile';
        });
      });
      var me = document.querySelector('.me');
      if (me) { var lines = me.querySelectorAll('div div'); if (lines.length > 1) lines[1].textContent = 'My Profile'; }
      return result;
    };
    CHL._profileNavLabelPatched = true;
  }

  function loadProfile(outlet, handle) {
    outlet.innerHTML = '';
    outlet.appendChild(ui.spinner());
    var own = !handle || handle === 'me' || handle === 'mine';
    var query = sb.from('profiles').select('id,username,display_name,bio,avatar_url,cover_url,followers_count,following_count,posts_count,privacy,links,creator_category,is_creator');
    if (own) query = query.eq('id', CHL.user.id);
    else if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(handle)) query = query.eq('id', handle);
    else query = query.eq('username', handle.replace(/^@/, ''));
    query.maybeSingle().then(function (res) {
      if (res && res.error) throw res.error;
      var profile = res && res.data;
      outlet.innerHTML = '';
      if (!profile) {
        outlet.appendChild(ui.empty('ğŸ‘¤', 'Creator not found', 'This profile may be unavailable or the username may have changed.', el('a', { href: '#/discover', class: 'btn primary', style: 'margin-top:8px' }, 'Discover creators')));
        return;
      }
      var isOwn = !!(CHL.user && profile.id === CHL.user.id);
      if (isOwn) renderProfile(outlet, profile, true, true);
      else if (!CHL.user) renderProfile(outlet, profile, false, false);
      else sb.from('follows').select('follower_id').eq('follower_id', CHL.user.id).eq('followee_id', profile.id).maybeSingle().then(function (followRow) {
        renderProfile(outlet, profile, false, !!(followRow && followRow.data));
      }).catch(function () { renderProfile(outlet, profile, false, false); });
    }).catch(function (err) {
      outlet.innerHTML = '';
      outlet.appendChild(el('div', { class: 'note', text: 'Could not load this profile: ' + (err && err.message ? err.message : 'Please try again.') }));
      outlet.appendChild(el('button', { class: 'btn', style: 'margin-top:10px', onclick: function () { loadProfile(outlet, handle); } }, 'Try again'));
    });
  }

  function renderProfile(outlet, p, own, viewerFollows) {
    var name = p.display_name || p.username || 'Creator';
    var privateProfile = p.privacy && p.privacy.account && p.privacy.account !== 'public' && !own && !viewerFollows;
    var following = !!viewerFollows;
    var root = el('section', { class: 'chl-profile', style: 'max-width:920px;margin:0 auto;padding-bottom:28px;color:var(--txt,#f4f4f8)' });
    var cover = el('button', { type: 'button', 'aria-label': 'View profile cover', style: 'display:block;position:relative;width:100%;height:clamp(125px,24vw,230px);padding:0;border:0;border-radius:18px;overflow:hidden;background:linear-gradient(135deg,#27223f,#45325c,#1b3b35);cursor:pointer' });
    if (p.cover_url) cover.appendChild(el('img', { src: p.cover_url, alt: 'Profile cover image', style: 'width:100%;height:100%;object-fit:cover;display:block' }));
    else cover.appendChild(el('span', { style: 'position:absolute;left:18px;bottom:14px;font-weight:800;font-size:18px;text-shadow:0 1px 6px #0008', text: 'Creator Hub Live' }));
    if (p.cover_url) cover.addEventListener('click', function () { openImage(p.cover_url, 'Profile cover'); });
    root.appendChild(cover);

    var head = el('div', { style: 'display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap;padding:0 14px;margin-top:-42px;position:relative' });
    var avatarButton = el('button', { type: 'button', 'aria-label': 'View profile picture', style: 'flex:0 0 94px;width:94px;height:94px;border-radius:50%;padding:0;overflow:hidden;border:4px solid var(--bg,#0b0b12);background:linear-gradient(135deg,var(--brand,#ff2d6f),var(--brand2,#7a5cff));color:#fff;font-size:28px;font-weight:800;cursor:pointer' });
    if (p.avatar_url) avatarButton.appendChild(el('img', { src: p.avatar_url, alt: name + ' profile picture', style: 'width:100%;height:100%;object-fit:cover;display:block' }));
    else avatarButton.appendChild(document.createTextNode(initials(name)));
    avatarButton.addEventListener('click', function () { if (p.avatar_url) openImage(p.avatar_url, name + ' profile picture'); });
    head.appendChild(avatarButton);

    var identity = el('div', { style: 'flex:1;min-width:180px;padding-top:44px' }, [
      el('div', { style: 'font-size:clamp(20px,4vw,27px);font-weight:850;line-height:1.2;overflow-wrap:anywhere', text: name }),
      el('div', { style: 'color:var(--mut,#9a9ab0);font-size:14px;margin-top:4px', text: '@' + p.username })
    ]);
    if (p.bio) identity.appendChild(el('p', { style: 'white-space:pre-wrap;margin:10px 0 0;overflow-wrap:anywhere', text: p.bio }));
    if (p.creator_category) identity.appendChild(el('div', { class: 'chip', style: 'display:inline-flex;margin-top:8px', text: p.creator_category }));
    head.appendChild(identity);

    var actions = el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;width:100%;margin:4px 0 0' });
    if (own) {
      actions.appendChild(el('button', { class: 'btn primary', type: 'button', onclick: function () { showEditProfile(p, function (updated) { p = updated; outlet.innerHTML = ''; renderProfile(outlet, p, true); }); } }, 'Edit profile'));
      actions.appendChild(el('a', { class: 'btn', href: '#/settings/profile' }, 'Profile settings'));
      actions.appendChild(el('button', { class: 'btn', type: 'button', onclick: function () { shareProfile(p); } }, 'Share profile'));
    } else {
      var followButton = el('button', { class: 'btn' + (following ? '' : ' primary'), type: 'button', onclick: function () { if (!CHL.user) { CHL.navigate('#/login'); return; } toggleFollow(p, followButton, function (v) { following = v; if (v && privateProfile) loadProfile(outlet, p.username); }); } }, following ? 'Following' : 'Follow');
      actions.appendChild(followButton);
      actions.appendChild(el('button', { class: 'btn', type: 'button', onclick: function () { shareProfile(p); } }, 'Share profile'));
    }
    root.appendChild(head);
    root.appendChild(actions);

    var stats = el('div', { style: 'display:flex;gap:24px;flex-wrap:wrap;padding:18px 14px 14px;border-bottom:1px solid var(--line,#262636);margin-top:14px' });
    stats.appendChild(stat(p.posts_count || 0, 'Posts', null));
    stats.appendChild(stat(p.followers_count || 0, 'Followers', null));
    stats.appendChild(stat(p.following_count || 0, 'Following', null));
    root.appendChild(stats);

    if (privateProfile) {
      root.appendChild(ui.empty('ğŸ”’', 'Private account', 'Follow this creator to see posts shared with followers.'));
      outlet.appendChild(root);
      return;
    }

    var postHead = el('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:16px 0 10px;padding:0 4px' });
    var sectionTitle = el('h2', { style: 'font-size:18px;margin:0', text: 'Posts' });
    postHead.appendChild(sectionTitle);
    var controls = el('div', { style: 'display:flex;gap:6px;flex-wrap:wrap' });
    var postsTab, draftsTab;
    if (own) {
      postsTab = el('button', { class: 'btn primary', type: 'button' }, 'Posts');
      draftsTab = el('button', { class: 'btn', type: 'button' }, 'Drafts');
      controls.appendChild(postsTab); controls.appendChild(draftsTab);
      controls.appendChild(el('a', { class: 'btn', href: '#/create-post' }, 'Create post'));
    }
    postHead.appendChild(controls);
    root.appendChild(postHead);
    var grid = el('div', { style: 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px' });
    root.appendChild(grid);
    outlet.appendChild(root);
    function showMode(drafts) {
      sectionTitle.textContent = drafts ? 'Drafts' : 'Posts';
      if (postsTab) { postsTab.classList.toggle('primary', !drafts); draftsTab.classList.toggle('primary', drafts); }
      loadPosts(p, own, grid, drafts);
    }
    if (postsTab) { postsTab.addEventListener('click', function () { showMode(false); }); draftsTab.addEventListener('click', function () { showMode(true); }); }
    loadPosts(p, own, grid, false);
  }

  function stat(value, label, href) {
    var contents = [el('strong', { style: 'font-size:18px;display:block', text: fmt(value) }), el('span', { style: 'font-size:12px;color:var(--mut,#9a9ab0)', text: label })];
    return href ? el('a', { href: href, style: 'min-width:66px;text-align:center' }, contents) : el('div', { style: 'min-width:66px;text-align:center' }, contents);
  }

  function loadPosts(p, own, grid, showDrafts) {
    var q = sb.from('posts').select('id,author_id,kind,caption,media,cover_url,created_at,like_count,comment_count,audience,is_draft,is_test').eq('author_id', p.id).eq('is_draft', !!showDrafts).eq('is_test', false).order('created_at', { ascending: false }).limit(60);
    q.then(function (r) {
      if (r && r.error) throw r.error;
      var posts = (r && r.data) || [];
      grid.innerHTML = '';
      if (!posts.length) {
        grid.style.display = 'block';
        grid.appendChild(ui.empty('â–¦', showDrafts ? 'No drafts saved' : (own ? 'Your posts will appear here' : 'No public posts yet'), showDrafts ? 'Drafts stay private until you publish them.' : (own ? 'Publish a post to start building your profile.' : 'This creator has not shared posts with you yet.'), own && !showDrafts ? el('a', { href: '#/create-post', class: 'btn primary', style: 'margin-top:8px' }, 'Create a post') : null));
        return;
      }
      var ids = posts.map(function (post) { return post.id; });
      var liked = {};
      var likeLoad = CHL.user ? sb.from('likes').select('post_id').eq('user_id', CHL.user.id).in('post_id', ids).then(function (lr) { (lr && lr.data || []).forEach(function (x) { liked[x.post_id] = true; }); }).catch(function () {}) : Promise.resolve();
      likeLoad.then(function () { posts.forEach(function (post) { grid.appendChild(postCard(post, liked, !!showDrafts)); }); });
    }).catch(function (err) {
      grid.innerHTML = '';
      grid.style.display = 'block';
      grid.appendChild(el('div', { class: 'note', text: 'Posts could not be loaded: ' + (err && err.message ? err.message : 'Please try again.') }));
    });
  }

  function postCard(post, liked, isDraft) {
    var mediaUrl = post.cover_url || firstMediaUrl(post.media);
    var tile = el('button', { type: 'button', 'aria-label': 'Open post', style: 'position:relative;display:block;width:100%;aspect-ratio:3/4;min-width:0;padding:0;border:0;border-radius:8px;overflow:hidden;background:var(--card,#191926);cursor:pointer;text-align:left;color:var(--txt,#f4f4f8)' });
    if (mediaUrl) tile.appendChild(el('img', { src: mediaUrl, alt: post.caption || 'Creator post', loading: 'lazy', style: 'width:100%;height:100%;object-fit:cover;display:block' }));
    else tile.appendChild(el('div', { style: 'height:100%;display:flex;align-items:center;justify-content:center;padding:12px;text-align:center;font-size:13px;white-space:pre-wrap;overflow:hidden;background:linear-gradient(145deg,#27223f,#172d2b)', text: post.caption || (post.kind === 'video' ? 'â–¶ Video' : 'Post') }));
    var foot = el('span', { style: 'position:absolute;left:0;right:0;bottom:0;padding:24px 8px 7px;background:linear-gradient(transparent,#000b);display:flex;align-items:center;justify-content:space-between;gap:4px;font-size:12px' });
    foot.appendChild(el('span', { text: isDraft ? 'Draft Â· private' : ((post.kind === 'video' || post.kind === 'short') ? 'â–¶ ' + fmt(post.view_count || 0) : 'â™¥ ' + fmt(post.like_count || 0)) }));
    if (!isDraft) foot.appendChild(el('span', { class: 'chl-post-like-count', text: liked[post.id] ? 'â™¥' : 'â™¡' }));
    tile.appendChild(foot);
    tile.addEventListener('click', function () { openPost(post, liked, tile, isDraft); });
    return tile;
  }

  function openPost(post, liked, tile, isDraft) {
    var mediaUrl = post.cover_url || firstMediaUrl(post.media);
    var overlay = modalShell();
    var panel = el('div', { style: 'width:min(720px,100%);max-height:92vh;overflow:auto;background:var(--card,#191926);border:1px solid var(--line,#262636);border-radius:16px;padding:14px;color:var(--txt,#f4f4f8)' });
    if (mediaUrl) panel.appendChild(el('img', { src: mediaUrl, alt: post.caption || 'Post media', style: 'display:block;max-width:100%;max-height:58vh;object-fit:contain;margin:0 auto 12px;border-radius:10px' }));
    if (isDraft) panel.appendChild(el('div', { class: 'note', text: 'Draft â€” only you can see this until it is published.' }));
    if (post.caption) panel.appendChild(el('p', { style: 'white-space:pre-wrap;overflow-wrap:anywhere', text: post.caption }));
    var actions = el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;margin-top:12px' });
    if (!isDraft) {
      var likeBtn = el('button', { class: 'btn primary', type: 'button', onclick: function () { toggleLike(post, likeBtn, liked, tile); } }, (liked[post.id] ? 'â™¥ Liked' : 'â™¡ Like') + ' Â· ' + fmt(post.like_count || 0));
      actions.appendChild(likeBtn);
      actions.appendChild(el('span', { class: 'chip', style: 'align-self:center', text: fmt(post.comment_count || 0) + ' comments' }));
    }
    if (actions.childNodes.length) panel.appendChild(actions);
    overlay.panel.appendChild(panel);
  }

  function toggleFollow(p, button, onChange) {
    if (!CHL.user) { CHL.navigate('#/login'); return; }
    if (button.disabled) return;
    button.disabled = true;
    var isFollowing = button.textContent === 'Following';
    var action = isFollowing
      ? sb.from('follows').delete().eq('follower_id', CHL.user.id).eq('followee_id', p.id)
      : sb.from('follows').insert({ follower_id: CHL.user.id, followee_id: p.id, status: 'accepted' });
    action.then(function (r) {
      if (r && r.error) throw r.error;
      button.textContent = isFollowing ? 'Follow' : 'Following';
      button.classList.toggle('primary', isFollowing);
      button.disabled = false;
      if (onChange) onChange(!isFollowing);
      CHL.toast(isFollowing ? 'Unfollowed @' + p.username : 'Following @' + p.username);
      // Counts are maintained by the database trigger; refresh the displayed values from the database.
      sb.from('profiles').select('followers_count').eq('id', p.id).maybeSingle().then(function (cr) {
        var node = document.querySelector('.chl-profile');
        if (!node || !cr || !cr.data) return;
        var stats = node.querySelectorAll('strong');
        if (stats.length > 1) stats[1].textContent = fmt(cr.data.followers_count || 0);
      }).catch(function () {});
    }).catch(function (err) {
      button.disabled = false;
      CHL.toast('Could not update follow status: ' + (err && err.message ? err.message : 'Please try again.'));
    });
  }

  function toggleLike(post, button, liked, tile) {
    if (!CHL.user) { CHL.navigate('#/login'); return; }
    if (button.disabled) return;
    button.disabled = true;
    var wasLiked = !!liked[post.id];
    var action = wasLiked ? sb.from('likes').delete().eq('post_id', post.id).eq('user_id'Æ£Chš»½9m2fÑ`i	¨*qâ<fâZïf§A¤qPUXâBø\Wtwñ—@@7LRémºwôM8lõ¨!7	å÷9H +T"ÁFEDÃdC¯ pÙÃz8cz”œ7ú$@~5OÖ~Jô¨ØáÈpî©d”3 1hº#Ù|¸1É€}²«BÈ;Yú8Q;[WtPR÷‰fõ‚³q;D¥,6(È,´dÅšéŒw@èY³;¸A³Ğlé!ë_;H"f$Ø» h{çÂÇ£|F`ëiHğn´. L‡X›çóÄ(¹ü°mk'¥ï˜ğ'O½?ü¨Îì)Gïz­GFP{mĞ5 ;!«~}G[0ÎpH3©#PÄA,§Îi|8c(\İcîLEáëä¦?ïôeÆaàºŒl1®@5#—~ñqeİ$ÎîÜ3­¸Duó5dÂúd3V9£O¬ïÿBı¿Ñe€¬Y'&22oû¸mxr˜–zêâwö@şq~pì»{%6ş]´e4-n)Ó{ı"‘T5”sDl`i!Ëª+€{I]T½3×ˆv`rèBUñÜPlkS$‰q{5b¸m»KuRX_kpƒÈ‰":é`!ën)šõx`ó@êÊ¯=Ş‹#4Lã]îµT`%ÿ&ªÀİ;Dã§$4ÊkçúÛ0fz
~øÃ™5Y‡èİé°®æ÷¢[/	jB€+2`¼ÛV{èŠGÂbm=n3c¹úæhgRdlÍ=¹ív=Q¹á|çú§ßSùû/™›q`ºJÃnã‰Ãc$y™zÒd&é;uS]xogwÜI«§Öó-ü°c#šNåêdNo0ùèOw«b=¥İ¢ 7ë¸dDŠ‡BgÊîÖtß|U‹”ñarÔ'Ò¿n€lf×Ö.´ïfHC=$î°­b$ppaf¤¸²@	mæls/(MSN#l›Óİ®ı+v]®ÃŒ}D§cÙÈ<8 ¡Ğù(ğaèåÊ4õó™â;ô‹h½§ìyËù¿j*(KA%ákLòõ¶éR¸Æ¢mÉ±sèúÖB*j`®cô›ênfwB(³Û¢ ?Ídv”êe`Iz=?m³}'™@NuR† „U (3F¬w ‡ê©®_g[¬`ƒªù!Ttí’uÜXMª­f¬˜àªö¨4}ûp(íT±KıÁ”m"
¤¶*–Hé8ş ]KÎDáçä€ï­ûw|Eéÿ;3Uo

pÂªœ,¯ZåÈÈŞB¨âÛåtã´‹nj+È	şöY7@srõmBDÒD°dsğ]%b1y6£ë14¬6húÌÉnİÕ*j ¤>ªtşdtàS Hın¶`í²X¨	Lb>"Ğ+`í/;ôıæíwË•0|iŸ@¶h,Ió`óÚª½rlivŠó¸X	q€Ê³d'h!‹C9v}]*w\n\¿¿fd³'»õ¦nv)2/¥ge`Î¶9Æ£ƒ};IÔj•³¹’øl[r äq:š]{Mhô&¬°˜¡Ş¸(,xªÕ">.Ø7ª,·anò93H½Vy¼^./¹E6#*9dœFëe-©–üY	ps'îév¼v0a¬vTT<¢üM
×#^=ç‹î¼´º{mºevÅnìñ´pÆì|â{b+à´+ wé´#¨˜* g*%2Â`gd+gèGeÏ´Zµ´!s÷ª§›f^¯Qhz±ºEåÔºåu4T}:²·‰d^D ­O}n¹o`ènæ`¿*i_êÌPwÄd~&2ßâ,,}{è¨gfüKß*º.‰MEµq£½	2”SÙ*èn6W:B°IŠ £,ÿgì4»û9ì qeÏñ:,áQ.ŠV~9_X|!;ôáŠ 4}^t&µQâL ìE$Âé=“!•c€!]4a@n²f³Êtô.M±îÆle¢„ÑÎõHs'\d#5Ñ{)òÙ}0(|cùcŠîb¼eÊ!"4uV,'‡¤\&Wÿo]›î‘5ê³@/0pĞ‡Æ»é-Aàh  @vv`É& #qbH×ÔÎn— !oÔ1À½<Ş¹^_cu¹xU°¨z ®H`$'aé›<bJà )¥j…qìww&¨g©êoƒ_¥ßRø©›[ÆÈA_2ıGl®&Ì?ö `ã½jWÕWè¹SlÖ$ö#~``l.,¬k?íÉˆn†,¦heı,ˆwü„^Tâæ7±òÂ9 ¢sÍnt}ŞØ#Î‰œ	c`OsÏoET1|n2vruÑ™ªÙsà¥}’®Îf`ˆÏÙPŒC@0arÿ\êcu ³  7ú>8Q5„SıİL©}0D',/0)çÜ’"È12û3=2kçİH½dsî}s= {®d”Æ¹³`"ÂÌ{Í<mÄì£&ibêvzf)r kî@Q W3îÜ&ìkè#S¹,eiHN²U¬- ûwD5~)lOt"QAÙNTsj{#9(Jmmrfk#¸´¤bôÓYouw~ÿ$J}‹A'çˆóæÿK&k7&k£‡a{İG"'ñ¡bİn,ùyµDQ[&»05ô.*)HH>lzfÌn:{L¿dvG-äõ`÷N]wå¶l„ì"Èãİ×Øì*.]?d7¿€bQ'åáw-VÂ¢FuºmN‹c8O–fLóŒÆ}Wş¾EdH9w—•q$Ìwddm`…ÕÕDQ|tü3ÛEÙãb%Wo4nxryà$„ılìbsÁJ3†%=;³'HW=i»[½%È!@¹,Å}d\ì¿ùg°l>é­$œ}Œ¤4(à„h­g¨­bNàîˆä&ç)dîæq@üÊ¹_l =/êl)íL>âÛ£Yş¥‘!ËQ6€`ÉÛcâFkD;d}du—Wkeú&ôÖÄ;šF¸Èà3¨u÷ş^9øéÄ6ySİ¿_!Ô ){9Ê@TœWïàïZ+QôÂ5$,ddú?`Î¥İDe`Šk€ à­îgFAôOô“wã|D¡­t(ùawl², lâjNwB†ûbPò»“,
¡(81Ÿä#HD~nX†ë ¢ìì!/ )ş@ïdâ="[ 74¦éA«$Å#öÃ+Õ >LKÜÈå¨/kzguSİñ/c?2m¨fÇİwî°\®$h"D;™òç”2dhTµ^/‹rjÀãìõ7î•wiñˆ<6øo{8dğßì—D›.}•Qth•4EÖêê©¾~ †Â%Ò§8n¤ÔOyqöfJ/úip89#\l@‰&DWµS©ly^|ÿ (?Îûe3çA(¨şeír'¬#Ò* \Ó`[_SKÅD$,ÈäÅÉZğ%áÏG¥FÎy(İÒ÷Ê>#á»¡Ó©cqxÑjfl"3=g$$º'y\¬0nU3×.wCÈ7ƒ&áXw¥D„O«­'Pï•óuˆ—oiüP¡Í`OüşˆD¢à#ïèkÄWĞAbfGdd)hàHĞÌìÅë)«*Ùçâl"5LÀ<:uø.Î†ÿD~h°Ub©cCˆtxcºuŠêmFGiefõÆ o+àxâî^½®‚i¤=>`ışùØsışúÈ=n_ŒW{:åBìMğc½¸Å0_¸êä­ÒYukØDE@Ö¨jtMB½v±plxt?¬iş½ıåEÃú¦.á$~&±õå¨Gq#A[oÜ%è<ƒ¸"–Z¸„År%ÜûÄ†6ª ´<# ]ÑäYúanÒ qûìiéV´É(a0²,&2èPì Ğ\¨Mp¬=é³r&¼{f#ØÈç|ur¥$ìdÄV úÑ EñpacÃ_5¤óËŠ­(2ç+Ô©¥%qÑ)EøæÏmr‰LŒ\<×Nxo†˜K#ÚqğH+äàäUo@hquEæudá9âFcDÂ'¡(´¹0o\ÀK@ÅºE6iü‘@²Q`…× <*Œ¨‚O]Re¨ãRP4qkù-wTÈFleg|m7#'’¡Qxùü`Ø$GìÛOÀ¨¤Lˆ¨~K¹‚®œ\ª:?wC@1‚o§úá:ûñb½$¬sûf,Q¹Vzÿlv‚g$Mu\ÄEÕ€§l}'g8T8FîUšb!Ö
S Jm`bvĞ-Ì©v)€ÕqbUÜ‚D"¡ÌªT»2'™ğ"1d$«Áz¥Q äÏÑ©nê¢&kx	¤?pı¡qï?¦@½ª2ëLÀ›pr^ı¨Z2"w&üò$V`ÇGì:¬İï¹0*›Ök†?)fçÓ{°)CşŒ

<w*™’TêTÓJîûb=GÓ
°OYì$œ÷EFcV"/%’lË<‘½Ÿ‰| ˜—¶uNå pÃÈaw=4}Rt@¬y íHR…T`BAi}LyhºÁ¿ÁVU" bı&g¶ûÌm4'd'íÿ2(ìníªF`$F~D~¤Ä³\yĞUÃÍŒx-.sf( áOs(_Ì¡ºcM üso7¸´ë#¨V9yåFtwplzğa ¾9²‹gÅì„ä zkr¸©ı¯ˆ lúª~zÀ)3’bæVgvİB[hq“bg)'xtùc—DøÆ‰:ÂàD³ŸÙ³_yhÎ&èıî (Q8d*¶GÜ !Ã	te;ÌFQkØ?çot1S8&;6'y)[-AÈ4çj$t§añ9 æ¾şÖbG¦~0‘Ûûw®?ù;ÌUàg­6ïı–ûù!â7 xcGÓ`tW&4ş°5ı« +!.$ö¥¸µÈ{e.\™[(E!F b*á2pí¿=[éj^ÊGe+'Ä}o+"A3  QO“ C°â_î’Ëıcå¨Uf±1½«æìÁ'<96Xö!¾§``©³øÑ„»yN?a<:"Dqs[õkèmq”¸ª'uvPS¾å¶Zy
k©1¯vàà0®*» 
ş`,rfîv;P¡#(4gbâjWZ |6B¤yaÈOà©'Ôüu(°Ü`=ÛÊt",húœäóu\¨ DAo‡£-Ì‰YE1KVs4ßğ†«-±Sÿœ×ªc`ùáfNmI×*/£wÀ±¨L¹6g+gÓf\F„ógùFy>9*–hğu`ªAíw ÈºyüEòªğ^|ÆÕşiŒòÛúíw>ÌÊÎ"±.SH" 8($)A.‘`4ôvSF@9b­‹dn²nÇ(ØY,¢¤ òü@!`ût/Ÿw`èé­ˆae85ªl åWPgr@‡²+YMH1ÎgÕüğ—Dj¯ÀiiÜ£)*Råq½:G7ªÆt§Éõ£ÏĞqVEúj:(úŞ—Ğ|ö},çUEww3÷;`c}œn¨7È8<rqÜ03.¯[ µE@qnløA_F»fºocî å“'ı°ğZqncrNpÍ,Ô5ˆ¶9éuYx]*2±;$çÀœœ*à5,BfJfUò6^âãHÊ1ÜnM*÷¤'{«fŠDå=+æ,” F
(YĞj'ñuÿÊ 1H SjÔliAÆyÂ1(+Y à[Bw]Ñ®o3æK*vº&¹ ş	u‚®67`ßâ6%0œ}ÿ¶,gîM)¼ã¯3t'(èªmaj4oş½¿!+3.™:nd»ÔäÑ|)®Ù<)ğw4ñ¸ª”N] Zş	y€ı4Cæy„1àu•ŠF4pUı İ©ğQw4èdwÄDJ%M ¿ŸN’"Vajûß ¨k¹‰€ƒ$a+‡ô2p3¯CdÀìD?z5
äg±ì»#p*<Z :}«D‰»@©Vïâ"Íıª	]aa‡ è¹ı÷“Cä¤!á`”fH	Uí‹Qc>.d)$5Cu.ş3Êû#Ä<eÈJ|0½b9L­qÙòt©B‚d¤|ÆåaŒI#O"_s"<£)t7yÜÖË:ô—}q²ÁKh Q'»QÅwc¯00%»t®Axcpı!%º®Îºˆ0½ÿ ÿbD©RFDBwQ Û<d“u‰l¾áÅ6é¦üJ;Æj6Âr’"¸B1æm`ACßª6¾^be*ğŠZ˜%õ(0¢¨5¨RôbMÑUÌo4r°DPñ!—š
,h5¨l‘ejXS®#‹0İ°sÆtbËunv´¿Ÿex{1ä)“dce°›=µ&+á*‚vkP
 ¢D¶%	&›²ºe3FÍ=iÕ+c½i¹\#&h'÷›cæ¯ûf)úPë©¢ñWe©9üôSJ/¬0q&iÅ¢·vyîµ¶/|UW¨àA7 ahkêDâÂìŞVFvªô;	°Wç«u”¤x(Ù¼A9nN@M.v,–(ïIZ+"7@uMÕ¦yvyYpW&D8j0iEÇHf¸)^,j5$+feğï#!iMP=35?!ëa¯‹çAxëºÊp à±  Éş`°±0“åÈ3h5"2÷ôïùuuYg£n_Rcg~i¤¹ïÅ5Bb15ŠN¬Qt=f®u¨íw0a9c=äíFãeR0ì}Ñuæÿbd!B¡h0BØôcbz?Êk.+•±	fmT:o€$—+çK^Kvq&!¨U±*5~B$øsò{*´©4„ãÎ÷l ™vz$G Í ù”şü&•<L›3Q&FÎm.qWiR~ã.}$?=¦`bCnMÃÅ!WSÿF.ìBõcŞfc8ı-Œ`Eí•ø¦D¤!Ø°]øMc^`KfJÑyr-sãbâïî|%Åï½s±¹ñb?7±1tí6=(è*]F03E>¼åÖ	.­G“VdUÂâR¿ËDe™l¦tğd•ËD¯N1s(7ô&ƒõ4Ò¨ù<&çÎéõE¨}¯¼ñ|:bQ:wl—2 àıîèuõFØ.ktgf±åbºûEOU¬+™FgBcYB/ôsQ<‡áSUkD'ë¹ªt(¤pxP`Âe¯]'I^aãrPĞ¯—\kKDÍMh%÷²ÖrÌ©!IyGsÙ/4¸Ñ‹1ûéî !À™pp{j£!.lT€-77Kú?]ØÙİ÷fbö99h“3HQ”|È" "1,ÎßêD79›H"Zø-&e$ÄtÓéÛ{!8¡‘ ,2:û›Õ "Ô÷® °)Š¾Ü:ì¡7İt}õ$ ÿô")Ñ>Ô còh:XdcJrUD Ÿiw¥ UsuñYù6Ï’U`Cªÿõu7àv›È:9;D»Í¸OÿJÇÂ²+8‰óBbäëTë§r®ca¶v3,3ˆW–F`ul3·yšaä‰T à ²í"nMl‚ád)jD¤dq'7ùM’t¸êgÜüóh# iU¿lOï!ğÍ{j#v#~¬'!¾^]dÒ^Ç%^eÁ+¯¼’`,¨Hs†\y”$·hqo9==`ÔIşP	¡ñ=Dlùı%î±(çlëÿ>hºÊv0mhæµCÆdöd»@LSv5$!e%áŒÍÀP›`wQ°qÚáË=f*üûƒ¤Yd‘œ}xâ¯`üˆ.I³¹ TÀ@ø£œ
ıìédm. A¹=f»ZS: ¾1ApUs¿âVbev'a%¨§Gôpı¼h]ü
j»¿¯~Œ`,H="ô|yæH\/¨?$ + G/Dç°Õ{íT Y?Òdag#êğ9lš`]wŞ+sy40¹ØĞ²Nfco2¸3ÛëéV¨/vw¿İ±­.Õğ˜3`¨D'§Ó@04á¸AÌ*nW6ŠŸæ*Z]9ƒuU 
SåÙW/9‚)¬¶”¿¹0*ytc¨ )Ìò$›Ba¢e!‚ ğÕŠÊ×n3ÓV®3îõd"öx Ibˆ«á`sÀGPtBào%FÈê-ğ¾b:gu§£j÷ì&dBè™¹zàíƒnÀ½„q_0Úúô9!.€¯.QâSFW+VG$hÀî7åB\Csf¥ıYAVdWbÿæ'jè8QY*·õˆ"+³Ì`aFzuø~e>_ÖnGÏ-g†»¼gÀx&µ¯`vñtğ[&p¥hjïT0NT `>fÌ;9Œ$hí¤o:z›Lbá°õœ;E”W/.Â`xö¹ØTPãQæcÿësà#*:òÅ\U]@+b4 Ln}Z,àMÊ›º™a0 "°4GMîH¥¢k½|½«ˆå()ğ@…]•"ßÍ(¬ÌÏ·ÍìÿÍThà,bD˜[öÁs =.&P§$„sF.!U®ı>?ü¹9eôrMå%Šá<NñÅëCìêÕ­÷wfdÎú€S` ?A\2 H4¾Jì˜&3Qd3!{ªúV,aÊ°!Öø9G8£êD¯8oª¢´5qH®÷r4ÿzth#^#»90âH_}WF|EcüS¹I(¦TL÷kï#j~8Èa»ƒ,x7|RT˜äL$ZN¡%R¢5£$à`Eu37uH])rlbH"®ÿülWeN%.åhu@#í‰F4$½1´¶E91\Üè?buE\)Î£ş¯´Àkó!k4‚­írcÍfÌ››>’î\¾$BBså3¨™ğ<¿ïHö¶@í( ‰vw xÛ-:+Ì>¼ñ8ãe™4VG0iÀ7¨Ê¨êwè ìç	Æ#©[ª“uªzÑ æì*ë}}nWfì;*x0s¼%`)6m	2İX×<iÕ4Ï)sq"àbäl»¹æF/yùˆxÿâÉjbFÏsvT×uC¦Miäk®§cSÜ]Xûßu{>²(#¨ˆıaXôÏ^F6gËD‰Ÿí¥ÃGh(*.CQ1#u%dıEp‹Ø'2íOà¼ØV¬ [tOq×¸¢é ïd5Ffbìº2]G¼õá m¼ˆ½Dr z!ÂïükPU®ñH¬ÿbj±Ø| ¼‚î}he‡<\Ö¹,VÉ'0ğ"6SÂ¨ò_Nrh#i MslNlöB¦Ìh„p‰â¬,161¼[‰¢vä4)b,@Å‘9Z@8s&´Eû+ p8e-³ª%‹@CÉ;Ï<š Ÿf-­Ubÿ"™2è1ü‘ŒjºH]Îgs*åãªä{šê8ìeD~å1ä'Fe-`Š¥Ù'î42-.Od1?¬°c[9Îˆç~îLwy+j"r¨Wa;ğAa516L©Û0ÈÅÎtC]{ı"V÷ôv«èt›x»5Ns‰Q:'´3ÎµšƒCÎÿÀfŞA`KŒM§Ùèª´&"‹
`µö*(„ Tzqów´ÍæÄê˜r¸Î0dk@»J€…,&=mè'»º×dÿD¬=E
Be#i¨6vúğu,5,~|NL3„dvdP$Ù¹dÌİ^ËœQÎûé}Pwô1$=ò¿y~7Óéê‹°“ó#*ewçÿvÎevØX£´ƒò˜¢'{Ø(yøÜ-Só+-ˆ4f´Gİ‘¾óñÏeDg«s—r.6Mlë$¬€>feq7'üDí3Yš‘ÆY*Æ-Pp0!_ıU1ò/‡<¥!ë ®{uee2;b§*¹FdyNt<'œœd #ì&ñ¸jQıähîŒÛ|ÅaL¶Üı¯|lcÖi^%bè4|)Csû!Idhjàp˜
¦2‡sBş."à¦jöû%îbìÜs"Âñ.±w‚AR)`î(ÓEø ØñD;(BSm|»KŠ~òê¬Š¬r´7è'¾`}qé&¿ ƒ’oÁoIGÆe1èĞËİîÌ¨q;L/9üÏ2€UCqü€#áp{:.)!¥xiÜ5m¯­4İ£ï‰U½ìèS†¹ŠŒñ`ªËv™'(lWŒc3Óv"x‹Å~äòE~Q}a;Ñ~ñ;&u@cG¾íAşš²i?·%<ïsw+"k¿fëfí%;ëŸäyTÊ`fèõ£t}_î¨' 8á´/ğ>QQ¡cÏÿª¦ui>bü]â9ZŒt´Ì$!0Š`³t3¾LË¦E,Bÿ-—‰|Bä(fÇqæ¯ä|ˆ™ÿqCW\ Í‘pPFŸçSŒ©3)ß¹7
™êP„QQh{%c¤üC~+ èitb¨ïmß¤O`;^aKiz®`/yA\ehº½ œmÀÎgF; {9hsL>şºî&l$iã·ÆK3[îrœ(ÈÈDsĞ¹û›1¸ŒãwU–B~>ÜbÎáÏ—Ùy¥³ˆìjURqA"(IgÅw,wòq½_ìÌ„g@ª$ıe#Nc>æjŠOûFñÄ1nÉ;ÁtlN‘NÚ2,1®yrv®§€Un^u.båq¯olÙ!­^Ñ1eÚûgQg¨üN}(>Ş‰â+ß­ tıií`0øî(;ÅG¹†,3»¡á"€s'7:üyÓ·d¾w21¯éÒVd¹F9Â‘š9&Ú¡BªItª¨£ªFEpy1‚³xCöŒì¹-taU:©Ø@\â¾ˆââss%¸«í",7î¬=aY'èÌü0$d=‰ É*¡Ù‹{dÎ,ˆ};£RìÑiü9b-RèaŒA4h‹lH’¹ŞYÌ@Döjcyğf"¹g2ğñ¿«x;BCEÍm&ÓèwDİ'»d,î­ü#Aäs[h8õómbXáªaê25ÑVvN@A-+f ophİõÃU;'	üÿíî%5Ypãt	Ù®Ğïs#{îDÑ#Fx|ö!˜a2wÍz©û~¹äR,s`º8JP$øë¾Fcİ*gc¸+Ç«u(,G(«<ò`hæhu‡÷ÏuÌ"&ºĞDëaåK>0z@.˜²1ù/ëşôá"hHê_>h±v±J7§*í€‘*v¢ ÿĞÖwO!âß®ó&Vü¨‚œ{6W<®FP%¢'qW$®¹>
urn<YO| ©X;‹e2ç-#è&Õîp	¿·º–!{.}éç,f¼3¤¹­na~WFı ¸U9èï;˜8lvb1LárÙdlı;}ü? çĞ=~î°&€o¶y}!2õÒøwfÓì¤:}t3h¸lÿwG(Fo¨Ö«75›êV3w01·bd¯è|¹¨):ƒU4M;¨'	¡3³'faêl0ô™	AŠ!{HeÊ}è˜¬è$Y¿+w7´_?DÇ@â5e*ûB2£. ééQh.8ƒmÜCŞÏŒó àúŒbn ¡hdFá´½|`ƒ3íÆçod%2ÙÃoe	¦}Y}ªª®êß`OØìV!¥NDdµ¯wäÎ¡Ê`Qsms;ûHû?aayR%–}ò¢2G™ã`œUº	ä.ii|`·YªNİáÈícf|øBy˜*¦^>eéï'
2ËfàB©)wØú¹Ù/;%g,hBêìë!NŒ!yâm~Ÿ`5¨şùg™ê¸T*Ï!5“›sÕ¼t%)ÚnYQs§'Ù¶¨f *{ıª7B @ˆ¥kìpv!ê$l€p Š CHgö8epé)~# ôşbodÂ{ f%À;pzç3¼w@0ıuwiPâ„ªtıwfê/­u˜îû+ÇÒİúÃÎ¶î{Ü3®òŒ*<#b Ñ¾u-l8µk¼åàd ´LØ&dÜîi;B5NzèçTéÔª‘‘…Ïè¿ìf!s™`í~»‡mPCej,ùôe`;·l/~"½|†1æ.\$àİBws»×.:ÜŸÄ¬ú¬>ì3½‚+q2&U+t¸KÈ Ô¯Y	¢'0»áª«Éª<9Bnà–³°-ôadà³K,*’XŠ%!]kpµŠê¦oÜìs-Aïÿyx

WSÎªæã1¤‰ˆ•˜¡ î>æ²«l[ÈU¬â ©EN&G"8ßlDşCó )³g*=yƒe<ñ5PøâÈª#êaânU©ôCq xH†}eá`Â…ciìaEQ5ñ+ı17œøÆ«1s/(@ÏF–R(ÎAy»§äˆ.¼'™*æğYŠ›#À¡O›İ¶b(õÿXˆ*c¢Âi  @D)JBF*!g7™}Ï+jK¯*Îş8½*m]IlØLçíG‚ÔÚvÂè]Q=îz{îeÄ¡"±´L¦s"DD€ÂB$+uXG6(*¸#`<7L‡Fx Ê¬m©%j3"1fz¢c,ø‡n™bv%åãpmr!màAdD~æü #ß#N|îÉnNôf¸qû,ëev…<¤©´.ÏéoáobºÛ^ğ(MqÉü è{i´q«!uÊ`' &aêÇİæGåğasí‹¤ƒ gëT,&´ %ñØ¶øyVe_ şíÌ æ½ÓN<n¿l ©&¢A¶biLÆ9T% Ûrâ&:[ğøuy  b@ôiÉ(²" ‰OW§q«¯æÏS,m$7S6E¡‚dëeü|§7õŸ{š./ppDáÓ=ïàT%‹w%ı0ß9hHa{õå6}Sgvµbác)ò35dÂui5±%€dˆ#e1gB(ªw«‘ƒ}ïn`™õÌ)wèºÎ÷@qOdR5÷n)üÙ8m~a+iöhB¦dV€)b
wiTwìûfßT/sş%q—¢‘[Šë¿xaÖO–÷Yû™-]èh
 4%E 	eCm]vgÅÖÌg¶©yZ~W™›²šN±Ş[tu |Uˆµ°w i	a` zéšùN©@)¥)¥uáo'&)h·à~–S­ÜqûÁĞROèQ$!íN`|$Ìîmaù»&UÔVh©$Â>á3~b`¬&!æko¤‡‰½¢$§haıkˆr¤‡Wàî/›c`›'°c“mt}Ùq–ğ†)edvÇue%8¬#ur}Õİ*ÏmàÉ}–ŒÎn,‘ñÍT(KIpawQøs ¨ i2ì4+Y$„Z¤qT©6rD@¬$ªS)çÖÒ&Ùxvsú7!1 ù˜Ùçnb~yqD1Aø¬vì´i,zÈ¬mSBØ<rÄ´÷6m +úqf~+~ iä\ 1‚ "ì*ÅÒs_¼d-{lF¿Şd- ¯^5N{klq<&3zØG@qkc#~*5mLrjs+¸û¤2ç–Yß0}3óxBp;Ux¶ˆ¿¤÷Êf£;"l³‡.`ÜW g~…¡#ıïl?˜u°)U7;6.b+0I_ì®fNn8fÈûfKmê´c¿.U[%Ìµn„ì7ÌñİÍÙäj"_}eck2<}ók,OÊ¦v|'bŒc_–dT¥ˆÏ3LĞş(y@V