/* Creator Hub Live — connected public and personal creator profiles. */
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
        outlet.appendChild(ui.empty('👤', 'Creator not found', 'This profile may be unavailable or the username may have changed.', el('a', { href: '#/discover', class: 'btn primary', style: 'margin-top:8px' }, 'Discover creators')));
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
    var postsStat = stat(p.posts_count || 0, 'Posts', null);
    var postsStatStrong = postsStat.querySelector('strong');
    if (postsStatStrong) postsStatStrong.className = 'chl-posts-count';
    stats.appendChild(postsStat);
    stats.appendChild(stat(p.followers_count || 0, 'Followers', null));
    stats.appendChild(stat(p.following_count || 0, 'Following', null));
    root.appendChild(stats);

    if (privateProfile) {
      root.appendChild(ui.empty('🔒', 'Private account', 'Follow this creator to see posts shared with followers.'));
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
    // Show an authoritative, exact published-post count rather than the
    // trigger-maintained profiles.posts_count column, which can drift.
    refreshPostsCount(p.id);
  }

  // Query the exact number of published (non-draft, non-test) posts for a
  // creator and update the profile header count in place.
  function refreshPostsCount(profileId) {
    if (!profileId) return;
    sb.from('posts').select('id', { count: 'exact', head: true }).eq('author_id', profileId).eq('is_draft', false).eq('is_test', false).then(function (r) {
      if (r && r.error) return;
      var node = document.querySelector('.chl-profile .chl-posts-count');
      if (node && typeof r.count === 'number') node.textContent = fmt(r.count);
    }).catch(function () {});
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
        grid.appendChild(ui.empty('▦', showDrafts ? 'No drafts saved' : (own ? 'Your posts will appear here' : 'No public posts yet'), showDrafts ? 'Drafts stay private until you publish them.' : (own ? 'Publish a post to start building your profile.' : 'This creator has not shared posts with you yet.'), own && !showDrafts ? el('a', { href: '#/create-post', class: 'btn primary', style: 'margin-top:8px' }, 'Create a post') : null));
        return;
      }
      var ids = posts.map(function (post) { return post.id; });
      var liked = {};
      var likeLoad = CHL.user ? sb.from('likes').select('post_id').eq('user_id', CHL.user.id).in('post_id', ids).then(function (lr) { (lr && lr.data || []).forEach(function (x) { liked[x.post_id] = true; }); }).catch(function () {}) : Promise.resolve();
      var reloadPosts = function () { loadPosts(p, own, grid, showDrafts); refreshPostsCount(p.id); };
      likeLoad.then(function () { posts.forEach(function (post) { grid.appendChild(postCard(post, liked, !!showDrafts, reloadPosts)); }); });
    }).catch(function (err) {
      grid.innerHTML = '';
      grid.style.display = 'block';
      grid.appendChild(el('div', { class: 'note', text: 'Posts could not be loaded: ' + (err && err.message ? err.message : 'Please try again.') }));
    });
  }

  function postCard(post, liked, isDraft, reloadPosts) {
    var mediaUrl = post.cover_url || firstMediaUrl(post.media);
    var tile = el('button', { type: 'button', 'aria-label': 'Open post', style: 'position:relative;display:block;width:100%;aspect-ratio:3/4;min-width:0;padding:0;border:0;border-radius:8px;overflow:hidden;background:var(--card,#191926);cursor:pointer;text-align:left;color:var(--txt,#f4f4f8)' });
    if (mediaUrl) tile.appendChild(el('img', { src: mediaUrl, alt: post.caption || 'Creator post', loading: 'lazy', style: 'width:100%;height:100%;object-fit:cover;display:block' }));
    else tile.appendChild(el('div', { style: 'height:100%;display:flex;align-items:center;justify-content:center;padding:12px;text-align:center;font-size:13px;white-space:pre-wrap;overflow:hidden;background:linear-gradient(145deg,#27223f,#172d2b)', text: post.caption || (post.kind === 'video' ? '▶ Video' : 'Post') }));
    var foot = el('span', { style: 'position:absolute;left:0;right:0;bottom:0;padding:24px 8px 7px;background:linear-gradient(transparent,#000b);display:flex;align-items:center;justify-content:space-between;gap:4px;font-size:12px' });
    foot.appendChild(el('span', { text: isDraft ? 'Draft · private' : ((post.kind === 'video' || post.kind === 'short') ? '▶ ' + fmt(post.view_count || 0) : '♥ ' + fmt(post.like_count || 0)) }));
    if (!isDraft) foot.appendChild(el('span', { class: 'chl-post-like-count', text: liked[post.id] ? '♥' : '♡' }));
    tile.appendChild(foot);
    tile.addEventListener('click', function () { openPost(post, liked, tile, isDraft, reloadPosts); });
    return tile;
  }

  function openPost(post, liked, tile, isDraft, reloadPosts) {
    var media = firstMedia(post.media);
    var mediaUrl = post.cover_url || (media && media.url) || '';
    var overlay = modalShell();
    var panel = el('div', { style: 'width:min(720px,100%);max-height:92vh;overflow:auto;background:var(--card,#191926);border:1px solid var(--line,#262636);border-radius:16px;padding:14px;color:var(--txt,#f4f4f8)' });
    // Video posts must play inline with native controls. Earlier builds rendered
    // every post (including uploaded videos) as a static <img>, so videos on a
    // creator profile could never be played. Render a real <video> element with
    // an error fallback when the post is a video and a playable source exists.
    if (isVideoPost(post) && media && media.url) {
      var videoEl = el('video', { src: media.url, controls: true, playsinline: true, preload: 'metadata', style: 'display:block;max-width:100%;max-height:58vh;margin:0 auto 12px;border-radius:10px;background:#000' });
      if (post.cover_url) videoEl.setAttribute('poster', post.cover_url);
      videoEl.addEventListener('error', function () {
        if (videoEl.parentNode) videoEl.parentNode.replaceChild(el('div', { class: 'note', text: 'This video could not be played. The media file may be unavailable.' }), videoEl);
      });
      panel.appendChild(videoEl);
    } else if (mediaUrl) {
      panel.appendChild(el('img', { src: mediaUrl, alt: post.caption || 'Post media', style: 'display:block;max-width:100%;max-height:58vh;object-fit:contain;margin:0 auto 12px;border-radius:10px' }));
    }
    if (isDraft) panel.appendChild(el('div', { class: 'note', text: 'Draft — only you can see this until it is published.' }));
    var captionEl = post.caption ? el('p', { style: 'white-space:pre-wrap;overflow-wrap:anywhere', text: post.caption }) : null;
    if (captionEl) panel.appendChild(captionEl);
    var actions = el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;margin-top:12px' });
    if (!isDraft) {
      var likeBtn = el('button', { class: 'btn primary', type: 'button', onclick: function () { toggleLike(post, likeBtn, liked, tile); } }, (liked[post.id] ? '♥ Liked' : '♡ Like') + ' · ' + fmt(post.like_count || 0));
      actions.appendChild(likeBtn);
      actions.appendChild(el('span', { class: 'chip', style: 'align-self:center', text: fmt(post.comment_count || 0) + ' comments' }));
    }
    // Owner-only edit/delete. The author_id guard is also enforced server-side
    // by row-level security; this UI gate is a convenience, not the authority.
    var isOwner = !!(CHL.user && String(post.author_id) === String(CHL.user.id));
    if (isOwner) {
      var editBtn = el('button', { class: 'btn', type: 'button' }, 'Edit caption');
      editBtn.addEventListener('click', function () {
        var next = window.prompt('Edit caption', post.caption || '');
        if (next === null) return;
        next = String(next).slice(0, 2200);
        editBtn.disabled = true;
        sb.from('posts').update({ caption: next }).eq('id', post.id).eq('author_id', CHL.user.id).then(function (r) {
          if (r && r.error) throw r.error;
          post.caption = next;
          if (captionEl) { captionEl.textContent = next; captionEl.style.display = next ? '' : 'none'; }
          else if (next) { captionEl = el('p', { style: 'white-space:pre-wrap;overflow-wrap:anywhere', text: next }); panel.insertBefore(captionEl, actions); }
          editBtn.disabled = false;
          CHL.toast('Caption updated.');
        }).catch(function (err) {
          editBtn.disabled = false;
          CHL.toast('Could not update caption: ' + (err && err.message ? err.message : 'Please try again.'));
        });
      });
      actions.appendChild(editBtn);
      var deleteBtn = el('button', { class: 'btn danger', type: 'button' }, 'Delete');
      deleteBtn.addEventListener('click', function () {
        if (!window.confirm('Delete this post? This cannot be undone.')) return;
        deleteBtn.disabled = true;
        sb.from('posts').delete().eq('id', post.id).eq('author_id', CHL.user.id).then(function (r) {
          if (r && r.error) throw r.error;
          if (tile && typeof tile.remove === 'function') tile.remove();
          overlay.close();
          CHL.toast('Post deleted.');
          if (typeof reloadPosts === 'function') reloadPosts();
        }).catch(function (err) {
          deleteBtn.disabled = false;
          CHL.toast('Could not delete post: ' + (err && err.message ? err.message : 'Please try again.'));
        });
      });
      actions.appendChild(deleteBtn);
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
    var action = wasLiked ? sb.from('likes').delete().eq('post_id', post.id).eq('user_id', CHL.user.id) : sb.from('likes').insert({ post_id: post.id, user_id: CHL.user.id });
    action.then(function (r) {
      if (r && r.error) throw r.error;
      liked[post.id] = !wasLiked;
      post.like_count = Math.max(0, (Number(post.like_count) || 0) + (wasLiked ? -1 : 1));
      button.textContent = (liked[post.id] ? '♥ Liked' : '♡ Like') + ' · ' + fmt(post.like_count);
      if (tile) {
        var likeIcon = tile.querySelector('.chl-post-like-count');
        if (likeIcon) likeIcon.textContent = liked[post.id] ? '♥' : '♡';
        var count = tile.querySelector('span span');
        if (count && post.kind !== 'video' && post.kind !== 'short') count.textContent = '♥ ' + fmt(post.like_count);
      }
      button.disabled = false;
      CHL.toast(liked[post.id] ? 'Liked' : 'Like removed');
    }).catch(function (err) {
      button.disabled = false;
      CHL.toast('Could not update like: ' + (err && err.message ? err.message : 'Please try again.'));
    });
  }

  function showEditProfile(p, onSaved) {
    var overlay = modalShell();
    var panel = el('div', { style: 'width:min(560px,100%);max-height:92vh;overflow:auto;background:var(--card,#191926);border:1px solid var(--line,#262636);border-radius:16px;padding:18px;color:var(--txt,#f4f4f8)' });
    panel.appendChild(el('h2', { style: 'margin:0 0 14px;font-size:21px', text: 'Manage My Profile' }));
    var form = el('form', { onsubmit: async function (ev) {
      ev.preventDefault();
      var submit = form.querySelector('button[type="submit"]'); submit.disabled = true; submit.textContent = 'Saving…';
      try {
        var username = form.username.value.trim();
        if (!/^[a-zA-Z0-9_.]{3,30}$/.test(username)) throw new Error('Username must be 3–30 letters, numbers, underscores or periods.');
        var patch = { display_name: form.display_name.value.trim(), username: username, bio: form.bio.value.trim(), updated_at: new Date().toISOString() };
        var result = await sb.from('profiles').update(patch).eq('id', CHL.user.id).select('id,username,display_name,bio,avatar_url,cover_url,followers_count,following_count,posts_count,privacy,links,creator_category,is_creator').single();
        if (result.error) throw result.error;
        CHL.profile = result.data;
        overlay.close();
        CHL.toast('Profile saved');
        onSaved(result.data);
      } catch (err) {
        CHL.toast(err && err.message ? err.message : 'Could not save profile.');
        submit.disabled = false; submit.textContent = 'Save profile';
      }
    } });
    form.appendChild(field('Display name', 'display_name', p.display_name || ''));
    form.appendChild(field('Username', 'username', p.username || ''));
    form.appendChild(field('Bio', 'bio', p.bio || '', true));
    panel.appendChild(form);
    panel.appendChild(el('div', { style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-top:12px' }, [
      uploadControl('Profile picture', 'avatar', p.avatar_url, p),
      uploadControl('Background / cover picture', 'cover', p.cover_url, p)
    ]));
    form.appendChild(el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;margin-top:14px' }, [
      el('button', { class: 'btn primary', type: 'submit' }, 'Save profile'),
      el('button', { class: 'btn', type: 'button', onclick: function () { overlay.close(); } }, 'Cancel')
    ]));
    overlay.panel.appendChild(panel);
  }

  function uploadControl(label, kind, currentUrl, profile) {
    var box = el('div', { style: 'border:1px solid var(--line,#262636);border-radius:12px;padding:10px;min-width:0' });
    box.appendChild(el('div', { style: 'font-weight:700;font-size:13px;margin-bottom:8px', text: label }));
    if (currentUrl) box.appendChild(el('img', { src: currentUrl, alt: label, style: 'width:100%;height:88px;object-fit:cover;border-radius:8px;margin-bottom:8px' }));
    var input = el('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/gif', style: 'display:block;width:100%;font-size:12px' });
    box.appendChild(input);
    var button = el('button', { class: 'btn', type: 'button', style: 'margin-top:8px;width:100%' }, 'Upload image');
    button.addEventListener('click', async function () {
      var file = input.files && input.files[0];
      if (!file) { CHL.toast('Choose an image first.'); return; }
      if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) { CHL.toast('Choose a JPG, PNG, WEBP or GIF image.'); return; }
      if (file.size > 8 * 1024 * 1024) { CHL.toast('Image must be 8 MB or smaller.'); return; }
      button.disabled = true; button.textContent = 'Uploading…';
      try {
        var ext = file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
        var path = CHL.user.id + '/' + kind + '-' + Date.now() + '.' + ext;
        var upload = await sb.storage.from('profile-media').upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });
        if (upload.error) throw upload.error;
        var publicUrl = sb.storage.from('profile-media').getPublicUrl(path).data.publicUrl;
        var patch = {}; patch[kind === 'avatar' ? 'avatar_url' : 'cover_url'] = publicUrl; patch.updated_at = new Date().toISOString();
        var saved = await sb.from('profiles').update(patch).eq('id', CHL.user.id).select('id,username,display_name,bio,avatar_url,cover_url,followers_count,following_count,posts_count,privacy,links,creator_category,is_creator').single();
        if (saved.error) throw saved.error;
        CHL.profile = saved.data;
        profile.avatar_url = saved.data.avatar_url; profile.cover_url = saved.data.cover_url;
        CHL.toast(label + ' updated');
        // Update the preview in-place so the creator can continue editing.
        var image = box.querySelector('img');
        if (image) image.src = publicUrl;
        else box.insertBefore(el('img', { src: publicUrl, alt: label, style: 'width:100%;height:88px;object-fit:cover;border-radius:8px;margin-bottom:8px' }), input);
        button.textContent = 'Uploaded';
      } catch (err) {
        CHL.toast('Image upload failed: ' + (err && err.message ? err.message : 'Apply the profile-media storage migration first.'));
        button.disabled = false; button.textContent = 'Upload image';
      }
    });
    box.appendChild(button);
    return box;
  }

  function field(label, name, value, multiline) {
    var wrap = el('label', { style: 'display:block;margin:0 0 12px' }, [el('span', { style: 'display:block;font-size:13px;color:var(--mut,#9a9ab0);margin-bottom:5px', text: label })]);
    var control = multiline ? el('textarea', { name: name, rows: '4', maxlength: '500', style: 'width:100%;resize:vertical;min-height:88px;border:1px solid var(--line,#262636);border-radius:10px;padding:10px;background:var(--bg2,#13131f);color:var(--txt,#f4f4f8)' }) : el('input', { name: name, type: 'text', maxlength: name === 'username' ? '30' : '80', style: 'width:100%;border:1px solid var(--line,#262636);border-radius:10px;padding:10px;background:var(--bg2,#13131f);color:var(--txt,#f4f4f8)' });
    control.value = value || '';
    wrap.appendChild(control); return wrap;
  }

  function modalShell() {
    var overlay = el('div', { role: 'dialog', 'aria-modal': 'true', style: 'position:fixed;inset:0;z-index:10000;background:#000b;display:flex;align-items:center;justify-content:center;padding:12px' });
    var panel = el('div', { style: 'position:relative;max-width:100%;max-height:100%;' });
    var close = el('button', { type: 'button', 'aria-label': 'Close', style: 'position:absolute;right:8px;top:8px;z-index:2;width:38px;height:38px;border:0;border-radius:50%;background:#000b;color:#fff;font-size:24px;cursor:pointer' }, '×');
    close.addEventListener('click', function () { overlay.close(); });
    panel.appendChild(close); overlay.appendChild(panel); document.body.appendChild(overlay);
    overlay.close = function () { overlay.remove(); };
    overlay.addEventListener('click', function (ev) { if (ev.target === overlay) overlay.close(); });
    return { root: overlay, panel: panel, close: overlay.close };
  }

  function openImage(url, alt) {
    var overlay = modalShell();
    var zoom = 1;
    var image = el('img', { src: url, alt: alt || 'Profile image', style: 'display:block;max-width:94vw;max-height:82vh;object-fit:contain;transform-origin:center;transition:transform .12s' });
    var controls = el('div', { style: 'display:flex;gap:8px;justify-content:center;margin-top:10px' });
    var zoomLabel = el('span', { style: 'align-self:center;color:#fff;font-size:13px', text: '100%' });
    function updateZoom() { image.style.transform = 'scale(' + zoom + ')'; zoomLabel.textContent = Math.round(zoom * 100) + '%'; }
    controls.appendChild(el('button', { class: 'btn', type: 'button', onclick: function () { zoom = Math.max(.5, zoom - .25); updateZoom(); } }, '−'));
    controls.appendChild(el('button', { class: 'btn', type: 'button', onclick: function () { zoom = 1; updateZoom(); } }, 'Fit'));
    controls.appendChild(el('button', { class: 'btn', type: 'button', onclick: function () { zoom = Math.min(3, zoom + .25); updateZoom(); } }, '+'));
    controls.appendChild(zoomLabel);
    overlay.panel.appendChild(image); overlay.panel.appendChild(controls);
  }

  function shareProfile(p) {
    var url = location.origin + location.pathname + '#/profile/' + encodeURIComponent(p.username || p.id);
    if (navigator.share) navigator.share({ title: (p.display_name || p.username) + ' on Creator Hub Live', text: p.bio || '', url: url }).catch(function () {});
    else if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(function () { CHL.toast('Profile link copied'); }).catch(function () { CHL.toast(url); });
    else CHL.toast(url);
  }

  function firstMediaUrl(media) {
    if (!Array.isArray(media) || !media.length) return '';
    var item = media[0];
    return typeof item === 'string' ? item : item && (item.url || item.src || item.publicUrl) || '';
  }
  // Return the first media entry as { url, type } so callers can decide whether
  // to render a <video> or an <img>. Strings are treated as untyped media.
  function firstMedia(media) {
    if (!Array.isArray(media) || !media.length) return null;
    var item = media[0];
    if (typeof item === 'string') return { url: item, type: '' };
    return { url: (item && (item.url || item.src || item.publicUrl)) || '', type: (item && item.type) || '' };
  }
  // A post is a video when its kind marks it as video/short, or when its first
  // media entry declares a video MIME/type.
  function isVideoPost(post) {
    if (!post) return false;
    if (post.kind === 'video' || post.kind === 'short') return true;
    var m = firstMedia(post.media);
    return !!(m && String(m.type || '').toLowerCase().indexOf('video') >= 0);
  }
  function initials(name) { return String(name || 'CH').trim().split(/\s+/).slice(0, 2).map(function (x) { return x.charAt(0); }).join('').toUpperCase() || 'CH'; }
  function fmt(value) { var n = Number(value) || 0; return n.toLocaleString(); }
})();
