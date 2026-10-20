/* Creator Hub Live — accessible, responsive, server-backed swipe feed. */
(function () {
  'use strict';

  var CHL = window.CHL;
  if (!CHL || CHL.__swipeFeedInstalled) return;
  CHL.__swipeFeedInstalled = true;

  var el = CHL.el;
  var PAGE_SIZE = 10;
  var activeFeed = null;
  var reduceMotion = function () {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  };

  function safeUrl(value) {
    return typeof value === 'string' && /^https:\/\//i.test(value) ? value : '';
  }
  function list(value) { return Array.isArray(value) ? value : []; }
  function schemaError(err) {
    return /column .* does not exist|could not find the .* column|schema cache|relationship .* was not found|PGRST20[024]/i.test(String((err && (err.message || err.details || err.code)) || err || ''));
  }
  function cleanCaption(post) { return String(post.caption || post.body || '').trim(); }
  function mediaOf(post) {
    var media = list(post.media).filter(function (m) { return m && safeUrl(m.url); });
    return media.slice(0, 4);
  }
  function setPressed(button, pressed) {
    button.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    button.classList.toggle('is-on', !!pressed);
  }
  function showStatus(container, title, detail, actionText, action) {
    container.innerHTML = '';
    var box = el('div', { class: 'chl-feed-state', role: 'status' }, [
      el('div', { class: 'chl-feed-state-mark', 'aria-hidden': 'true', text: 'CHL' }),
      el('h2', { text: title }),
      el('p', { text: detail })
    ]);
    if (actionText && action) box.appendChild(el('button', { class: 'btn primary', type: 'button', onclick: action }, actionText));
    container.appendChild(box);
  }

  function disposeActiveFeed() {
    if (!activeFeed) {
      document.documentElement.classList.remove('chl-feed-active');
      return;
    }
    activeFeed.destroyed = true;
    if (activeFeed.itemObserver) activeFeed.itemObserver.disconnect();
    if (activeFeed.loadObserver) activeFeed.loadObserver.disconnect();
    if (activeFeed.fallbackScroll && activeFeed.scroller) activeFeed.scroller.removeEventListener('scroll', activeFeed.fallbackScroll);
    if (activeFeed.keyHandler && activeFeed.scroller) activeFeed.scroller.removeEventListener('keydown', activeFeed.keyHandler);
    if (activeFeed.resizeHandler) window.removeEventListener('resize', activeFeed.resizeHandler);
    if (activeFeed.scroller) activeFeed.scroller.querySelectorAll('video').forEach(function (video) {
      try { video.pause(); video.removeAttribute('src'); video.load(); } catch (_) {}
    });
    activeFeed = null;
    document.documentElement.classList.remove('chl-feed-active');
  }

  function routeIsFeed() {
    var path = String(location.hash || '#/').replace(/^#/, '').split('?')[0];
    return path === '/for-you' || path === '/following';
  }
  window.addEventListener('hashchange', function () {
    if (!routeIsFeed()) disposeActiveFeed();
  });
  window.addEventListener('pagehide', disposeActiveFeed);

  CHL.renderSwipeFeed = function (outlet, mode) {
    disposeActiveFeed();
    mode = mode === 'following' ? 'following' : 'foryou';
    if (!CHL.configured || !CHL.sb) {
      outlet.innerHTML = '';
      outlet.appendChild(CHL.ui.pageHead(mode === 'following' ? 'Following' : 'For You', 'A responsive, full-screen creator feed.'));
      var note = CHL.ui.setupNotice();
      if (note) outlet.appendChild(note);
      return;
    }
    if (mode === 'following' && !CHL.user) {
      outlet.innerHTML = '';
      outlet.appendChild(CHL.ui.pageHead('Following', 'Sign in to see posts from creators you follow.'));
      outlet.appendChild(CHL.ui.empty('👥', 'Sign in to continue', 'Your Following feed uses real accepted follow relationships.', el('a', { href: '#/login', class: 'btn primary' }, 'Log in')));
      return;
    }

    var feed = {
      mode: mode,
      destroyed: false,
      loading: false,
      exhausted: false,
      items: [],
      seen: new Set(),
      cursor: null,
      followingIds: null,
      itemObserver: null,
      loadObserver: null,
      scroller: null,
      muted: true,
      activeIndex: 0,
      likedIds: new Set(),
      savedIds: new Set(),
      followedIds: new Set(),
      pendingFollowIds: new Set()
    };
    activeFeed = feed;
    document.documentElement.classList.add('chl-feed-active');
    outlet.innerHTML = '';

    var shell = el('section', { class: 'chl-feed-shell', 'aria-label': mode === 'following' ? 'Following feed' : 'For You feed' });
    var top = el('header', { class: 'chl-feed-header' }, [
      el('div', { class: 'chl-feed-brand' }, [el('span', { class: 'chl-feed-brand-mark', 'aria-hidden': 'true', text: 'CH' }), el('span', { text: 'Creator Hub Live' })]),
      el('nav', { class: 'chl-feed-switcher', 'aria-label': 'Feed type' }, [
        el('a', { href: '#/for-you', class: mode === 'foryou' ? 'is-current' : '', 'aria-current': mode === 'foryou' ? 'page' : null }, 'For You'),
        el('a', { href: '#/following', class: mode === 'following' ? 'is-current' : '', 'aria-current': mode === 'following' ? 'page' : null }, 'Following')
      ]),
      el('a', { href: '#/search', class: 'chl-feed-search', 'aria-label': 'Search creators' }, '⌕')
    ]);
    var scroller = el('div', { class: 'chl-feed-scroller', tabindex: '0', role: 'region', 'aria-label': 'Swipe vertically through posts. Use the up and down arrow keys to move between posts.' });
    feed.scroller = scroller;
    var status = el('div', { class: 'chl-feed-load-status', 'aria-live': 'polite' });
    scroller.appendChild(el('div', { class: 'chl-feed-loading' }, [el('span', { class: 'chl-feed-spinner', 'aria-hidden': 'true' }), el('span', { text: 'Loading creator posts…' })]));
    shell.appendChild(top);
    shell.appendChild(scroller);
    shell.appendChild(status);
    outlet.appendChild(shell);

    function queryFollowing() {
      if (feed.followingIds !== null) return Promise.resolve(feed.followingIds);
      return CHL.sb.from('follows').select('followee_id').eq('follower_id', CHL.user.id).eq('status', 'accepted').limit(1000).then(function (r) {
        if (r.error) throw r.error;
        feed.followingIds = list(r.data).map(function (row) { return row.followee_id; }).filter(Boolean);
        return feed.followingIds;
      });
    }

    function buildQuery(cursor, followingIds) {
      var fields = 'id,author_id,kind,caption,media,cover_url,hashtags,sound_id,allow_comments,allow_repost,like_count,comment_count,created_at,author:profiles!posts_author_id_fkey(id,username,display_name,avatar_url)';
      var q = CHL.sb.from('posts').select(fields).eq('is_draft', false).eq('is_test', false);
      if (feed.mode === 'following') q = q.in('audience', ['public', 'followers']).in('author_id', followingIds);
      else q = q.eq('audience', 'public');
      if (cursor && cursor.created_at && cursor.id) {
        var stamp = cursor.created_at;
        q = q.or('created_at.lt.' + stamp + ',and(created_at.eq.' + stamp + ',id.lt.' + cursor.id + ')');
      }
      return q.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(PAGE_SIZE);
    }

    function updateAuthorFollow(post, button) {
      if (!CHL.user) { CHL.navigate('#/login'); return; }
      if (!post.author_id || post.author_id === CHL.user.id) return;
      button.disabled = true;
      (async function () {
        var current = await CHL.sb.from('follows').select('status').eq('follower_id', CHL.user.id).eq('followee_id', post.author_id).maybeSingle();
        if (current.error) throw current.error;
        if (current.data) {
          var remove = await CHL.sb.from('follows').delete().eq('follower_id', CHL.user.id).eq('followee_id', post.author_id);
          if (remove.error) throw remove.error;
          feed.followedIds.delete(post.author_id);
          feed.pendingFollowIds.delete(post.author_id);
          button.textContent = '+ Follow';
          button.classList.remove('is-following');
          CHL.toast('Unfollowed creator');
          return;
        }
        var profile = await CHL.sb.from('profiles').select('privacy,username').eq('id', post.author_id).maybeSingle();
        if (profile.error) throw profile.error;
        var privacy = profile.data && profile.data.privacy;
        var privateAccount = privacy && typeof privacy === 'object' && privacy.account === 'private';
        var followStatus = privateAccount ? 'pending' : 'accepted';
        var insert = await CHL.sb.from('follows').insert({ follower_id: CHL.user.id, followee_id: post.author_id, status: followStatus });
        if (insert.error) throw insert.error;
        if (followStatus === 'pending') feed.pendingFollowIds.add(post.author_id); else feed.followedIds.add(post.author_id);
        button.textContent = followStatus === 'pending' ? 'Requested' : 'Following';
        button.classList.add('is-following');
        CHL.toast(followStatus === 'pending' ? 'Follow request sent' : 'Following creator');
      })().catch(function (err) {
        CHL.toast((err && err.message) || 'Could not update follow.');
      }).finally(function () { button.disabled = false; });
    }

    function refreshLikeCount(post, countNode) {
      CHL.sb.from('posts').select('like_count').eq('id', post.id).maybeSingle().then(function (r) {
        if (!r.error && r.data) { post.like_count = Number(r.data.like_count || 0); countNode.textContent = CHL.fmt(post.like_count); }
      }).catch(function () {});
    }

    function toggleLike(post, button, countNode) {
      if (!CHL.user) { CHL.navigate('#/login'); return; }
      if (button.disabled) return;
      button.disabled = true;
      var wasLiked = feed.likedIds.has(post.id);
      (async function () {
        var exists = await CHL.sb.from('likes').select('post_id').eq('post_id', post.id).eq('user_id', CHL.user.id).maybeSingle();
        if (exists.error) throw exists.error;
        if (exists.data) {
          var del = await CHL.sb.from('likes').delete().eq('post_id', post.id).eq('user_id', CHL.user.id);
          if (del.error) throw del.error;
          feed.likedIds.delete(post.id);
        } else {
          var ins = await CHL.sb.from('likes').insert({ post_id: post.id, user_id: CHL.user.id });
          if (ins.error) throw ins.error;
          feed.likedIds.add(post.id);
        }
        setPressed(button, feed.likedIds.has(post.id));
        var icon = button.querySelector('.chl-feed-action-icon');
        if (icon) icon.textContent = feed.likedIds.has(post.id) ? '♥' : '♡';
        refreshLikeCount(post, countNode);
      })().catch(function (err) {
        if (wasLiked) feed.likedIds.add(post.id); else feed.likedIds.delete(post.id);
        setPressed(button, wasLiked);
        var icon = button.querySelector('.chl-feed-action-icon');
        if (icon) icon.textContent = wasLiked ? '♥' : '♡';
        CHL.toast((err && err.message) || 'Could not update like.');
      }).finally(function () { button.disabled = false; });
    }

    function toggleSave(post, button) {
      if (!CHL.user) { CHL.navigate('#/login'); return; }
      if (button.disabled) return;
      button.disabled = true;
      (async function () {
        var q = await CHL.sb.from('saves').select('post_id').eq('post_id', post.id).eq('user_id', CHL.user.id).eq('collection', 'default').maybeSingle();
        if (q.error) throw q.error;
        if (q.data) {
          var d = await CHL.sb.from('saves').delete().eq('post_id', post.id).eq('user_id', CHL.user.id).eq('collection', 'default');
          if (d.error) throw d.error;
          feed.savedIds.delete(post.id);
        } else {
          var i = await CHL.sb.from('saves').insert({ post_id: post.id, user_id: CHL.user.id, collection: 'default' });
          if (i.error) throw i.error;
          feed.savedIds.add(post.id);
        }
        setPressed(button, feed.savedIds.has(post.id));
        CHL.toast(feed.savedIds.has(post.id) ? 'Post saved' : 'Removed from saved posts');
      })().catch(function (err) { CHL.toast((err && err.message) || 'Could not save post.'); }).finally(function () { button.disabled = false; });
    }

    function showComments(post, item, countNode) {
      var prior = item.querySelector('.chl-feed-comments');
      if (prior) { prior.remove(); return; }
      var panel = el('section', { class: 'chl-feed-comments', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Comments' });
      var header = el('header', { class: 'chl-feed-comments-head' }, [el('strong', { text: 'Comments' }), el('button', { type: 'button', class: 'chl-feed-close', 'aria-label': 'Close comments', text: '×', onclick: function () { panel.remove(); } })]);
      var entries = el('div', { class: 'chl-feed-comment-list', 'aria-live': 'polite' });
      panel.appendChild(header); panel.appendChild(entries); item.appendChild(panel);
      entries.appendChild(el('p', { class: 'chl-feed-comment-hint', text: 'Loading comments…' }));
      CHL.sb.from('comments').select('id,body,created_at,author:profiles!comments_author_id_fkey(username,display_name)').eq('post_id', post.id).order('created_at', { ascending: true }).limit(100).then(function (r) {
        if (r.error) throw r.error;
        entries.innerHTML = '';
        var rows = list(r.data);
        if (!rows.length) entries.appendChild(el('p', { class: 'chl-feed-comment-hint', text: 'No comments yet. Start the conversation.' }));
        rows.forEach(function (c) {
          var name = c.author && (c.author.display_name || c.author.username) || 'Creator';
          entries.appendChild(el('article', { class: 'chl-feed-comment' }, [el('strong', { text: name }), el('p', { text: c.body || '' }), el('time', { text: CHL.ago(c.created_at) })]));
        });
      }).catch(function (err) { entries.innerHTML = ''; entries.appendChild(el('p', { class: 'chl-feed-comment-hint', text: (err && err.message) || 'Comments could not be loaded.' })); });
      var form = el('form', { class: 'chl-feed-comment-form', onsubmit: async function (event) {
        event.preventDefault();
        if (!CHL.user) { CHL.navigate('#/login'); return; }
        var input = form.elements.namedItem('message');
        var body = input.value.trim();
        if (!body) return;
        var submit = form.querySelector('button[type="submit"]');
        submit.disabled = true;
        try {
          var result = await CHL.sb.from('comments').insert({ post_id: post.id, author_id: CHL.user.id, body: body });
          if (result.error) throw result.error;
          CHL.toast('Comment added');
          if (countNode) {
            var countResult = await CHL.sb.from('posts').select('comment_count').eq('id', post.id).maybeSingle();
            if (!countResult.error && countResult.data) { post.comment_count = Number(countResult.data.comment_count || 0); countNode.textContent = CHL.fmt(post.comment_count); }
          }
          panel.remove(); showComments(post, item, countNode);
        } catch (err) { CHL.toast((err && err.message) || 'Could not add comment.'); }
        finally { submit.disabled = false; }
      } });
      form.appendChild(el('input', { class: 'input', type: 'text', name: 'message', maxlength: '2000', required: true, placeholder: CHL.user ? 'Write a comment…' : 'Log in to comment', 'aria-label': 'Write a comment', disabled: !CHL.user }));
      form.appendChild(el('button', { class: 'btn primary', type: 'submit', disabled: !CHL.user }, 'Send'));
      panel.appendChild(form);
      var first = panel.querySelector('button'); if (first) first.focus();
    }

    function sharePost(post) {
      var url = location.origin + location.pathname + '#/post/' + encodeURIComponent(post.id);
      var title = (post.author && (post.author.display_name || post.author.username) || 'Creator') + ' on Creator Hub Live';
      if (navigator.share) {
        navigator.share({ title: title, text: cleanCaption(post).slice(0, 160), url: url }).catch(function (err) { if (err && err.name !== 'AbortError') CHL.toast('Sharing was not completed.'); });
        return;
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () { CHL.toast('Post link copied'); }).catch(function () { CHL.navigate('#/post/' + post.id); });
        return;
      }
      CHL.navigate('#/post/' + post.id);
    }

    function createItem(post, index) {
      var item = el('article', { class: 'chl-feed-item', 'data-post-id': post.id, 'data-feed-index': String(index), tabindex: '-1', 'aria-label': 'Post ' + (index + 1) });
      var media = mediaOf(post);
      var video = null;
      if (media.length && String(media[0].type || '').indexOf('video') === 0) {
        video = el('video', { class: 'chl-feed-media chl-feed-video', src: media[0].url, playsinline: true, muted: true, loop: true, controls: true, tabindex: '0', preload: index < 2 ? 'metadata' : 'none', 'aria-label': 'Creator video. Use playback controls to play or pause.' });
        if (safeUrl(post.cover_url)) video.setAttribute('poster', post.cover_url);
        video.addEventListener('error', function () { video.setAttribute('data-playback-error','true'); });
        item.appendChild(video);
      } else if (media.length) {
        var image = el('img', { class: 'chl-feed-media', src: media[0].url, alt: 'Post media', loading: index < 2 ? 'eager' : 'lazy', decoding: 'async' });
        item.appendChild(image);
      } else if (safeUrl(post.cover_url)) {
        item.appendChild(el('img', { class: 'chl-feed-media', src: post.cover_url, alt: 'Post cover', loading: index < 2 ? 'eager' : 'lazy', decoding: 'async' }));
      } else {
        item.classList.add('chl-feed-item--text');
        item.appendChild(el('div', { class: 'chl-feed-text-art', 'aria-hidden': 'true' }, [el('span', { text: 'CREATOR HUB LIVE' }), el('span', { text: '✦' })]));
      }
      item.appendChild(el('div', { class: 'chl-feed-shade', 'aria-hidden': 'true' }));
      var right = el('aside', { class: 'chl-feed-actions', 'aria-label': 'Post actions' });
      var who = post.author && (post.author.display_name || post.author.username) || 'Creator';
      var authorHandle = post.author && post.author.username;
      var authorId = post.author && post.author.id || post.author_id;
      var avatar = safeUrl(post.author && post.author.avatar_url);
      var profileLink = el('a', { class: 'chl-feed-avatar', href: '#/profile/' + encodeURIComponent(authorHandle || authorId || ''), 'aria-label': 'View creator profile' }, avatar ? el('img', { src: avatar, alt: '' }) : el('span', { text: CHL.initials(who).toUpperCase() }));
      right.appendChild(profileLink);
      var like = el('button', { class: 'chl-feed-action', type: 'button', 'aria-label': 'Like post', 'aria-pressed': 'false', onclick: function () { toggleLike(post, like, likeCount); } }, [el('span', { class: 'chl-feed-action-icon', 'aria-hidden': 'true', text: '♡' }), el('strong', { class: 'chl-feed-action-count', text: CHL.fmt(post.like_count || 0) })]);
      var likeCount = like.querySelector('.chl-feed-action-count');
      setPressed(like, feed.likedIds.has(post.id));
      if (feed.likedIds.has(post.id)) like.querySelector('.chl-feed-action-icon').textContent = '♥';
      right.appendChild(like);
      if (post.allow_comments !== false) {
        var comments = el('button', { class: 'chl-feed-action', type: 'button', 'aria-label': 'Open comments', onclick: function () { showComments(post, item, commentsCount); } }, [el('span', { class: 'chl-feed-action-icon', 'aria-hidden': 'true', text: '▢' }), el('strong', { class: 'chl-feed-action-count', text: CHL.fmt(post.comment_count || 0) })]);
        var commentsCount = comments.querySelector('.chl-feed-action-count');
        right.appendChild(comments);
      }
      var save = el('button', { class: 'chl-feed-action', type: 'button', 'aria-label': 'Save post', 'aria-pressed': 'false', onclick: function () { toggleSave(post, save); } }, [el('span', { class: 'chl-feed-action-icon', 'aria-hidden': 'true', text: '⌑' }), el('strong', { class: 'chl-feed-action-label', text: 'Save' })]);
      setPressed(save, feed.savedIds.has(post.id));
      right.appendChild(save);
      right.appendChild(el('button', { class: 'chl-feed-action', type: 'button', 'aria-label': 'Share post', onclick: function () { sharePost(post); } }, [el('span', { class: 'chl-feed-action-icon', 'aria-hidden': 'true', text: '↗' }), el('strong', { class: 'chl-feed-action-label', text: 'Share' })]));
      if (CHL.user && String(authorId) === String(CHL.user.id)) { var removePost = el('button', { class: 'chl-feed-action chl-feed-delete', type: 'button', 'aria-label': 'Delete your post', onclick: async function () { if (!window.confirm('Delete this post? This cannot be undone.')) return; removePost.disabled = true; try { var deleted = await CHL.sb.from('posts').delete().eq('id', post.id).eq('author_id', CHL.user.id).select('id').maybeSingle(); if (deleted.error) throw deleted.error; if (!deleted.data) throw new Error('Post was not deleted. Check that you are signed in as its owner.'); if (video) { try { video.pause(); video.removeAttribute('src'); video.load(); } catch (_) {} } item.remove(); feed.items = feed.items.filter(function (entry) { return entry.post.id !== post.id; }); CHL.toast('Post deleted.'); } catch (error) { CHL.toast(error.message || 'Could not delete this post.'); removePost.disabled = false; } } }, [el('span', { class: 'chl-feed-action-icon', 'aria-hidden': 'true', text: '⌫' }), el('strong', { class: 'chl-feed-action-label', text: 'Delete' })]); right.appendChild(removePost); }
      right.appendChild(el('button', { class: 'chl-feed-action', type: 'button', 'aria-label': 'View creator profile for gifting and LIVE availability', onclick: function () { CHL.navigate('#/profile/' + encodeURIComponent(authorHandle || authorId || '')); } }, [el('span', { class: 'chl-feed-action-icon', 'aria-hidden': 'true', text: '✦' }), el('strong', { class: 'chl-feed-action-label', text: 'Creator' })]));
      item.appendChild(right);

      var details = el('div', { class: 'chl-feed-details' });
      var meta = el('div', { class: 'chl-feed-author-row' }, [el('a', { href: '#/profile/' + encodeURIComponent(authorHandle || authorId || ''), class: 'chl-feed-author', text: who })]);
      if (authorHandle) meta.appendChild(el('span', { class: 'chl-feed-handle', text: '@' + authorHandle }));
      if (CHL.user && authorId && authorId !== CHL.user.id) {
        var isPending = feed.pendingFollowIds.has(authorId);
        var isFollowing = feed.followedIds.has(authorId);
        var follow = el('button', { class: 'chl-feed-follow' + ((isPending || isFollowing) ? ' is-following' : ''), type: 'button', text: isPending ? 'Requested' : isFollowing ? 'Following' : '＋ Follow', onclick: function () { updateAuthorFollow(post, follow); } });
        meta.appendChild(follow);
      }
      details.appendChild(meta);
      var caption = cleanCaption(post);
      if (caption) details.appendChild(el('p', { class: 'chl-feed-caption', text: caption }));
      if (list(post.hashtags).length) {
        var tags = el('div', { class: 'chl-feed-tags' });
        list(post.hashtags).slice(0, 8).forEach(function (tag) { tags.appendChild(el('a', { href: '#/hashtag/' + encodeURIComponent(String(tag).replace(/^#/, '')), text: '#' + String(tag).replace(/^#/, '') })); });
        details.appendChild(tags);
      }
      details.appendChild(el('div', { class: 'chl-feed-time', text: CHL.ago(post.created_at) }));
      if (!media.length && !safeUrl(post.cover_url) && !caption) details.appendChild(el('p', { class: 'chl-feed-caption', text: 'This post has no text or media.' }));
      item.appendChild(details);
      var mute = el('button', { class: 'chl-feed-mute', type: 'button', 'aria-label': 'Turn video sound on', onclick: function () {
        feed.muted = !feed.muted;
        scroller.querySelectorAll('video').forEach(function (v) { v.muted = feed.muted; });
        mute.textContent = feed.muted ? '◖×' : '◖))';
        mute.setAttribute('aria-label', feed.muted ? 'Turn video sound on' : 'Mute video sound');
        if (video && !video.paused) video.play().catch(function () {});
      }, text: '◖×' });
      if (video) item.appendChild(mute);
      item.appendChild(el('button', { class: 'chl-feed-open-post', type: 'button', onclick: function () { CHL.navigate('#/post/' + post.id); }, text: 'Open post' }));
      return { node: item, video: video, post: post };
    }

    function activate(index) {
      if (feed.destroyed) return;
      feed.activeIndex = index;
      var cards = scroller.querySelectorAll('.chl-feed-item');
      cards.forEach(function (card, i) {
        card.classList.toggle('is-active', i === index);
        var v = card.querySelector('video');
        if (!v) return;
        v.muted = feed.muted;
        if (i === index && !reduceMotion()) {
          var play = v.play();
          if (play && play.catch) play.catch(function () { /* user can start playback explicitly */ });
        } else if (i !== index) {
          try { v.pause(); } catch (_) {}
        }
      });
      if (index >= feed.items.length - 3) loadNext(false);
    }

    function observeItem(item, index) {
      if (feed.itemObserver) feed.itemObserver.observe(item);
      if (feed.loadObserver) feed.loadObserver.observe(item);
      if (index === 0) item.classList.add('is-active');
    }

    function appendRows(rows) {
      rows.forEach(function (post) {
        if (!post || !post.id || feed.seen.has(post.id)) return;
        feed.seen.add(post.id);
        feed.items.push(post);
        var made = createItem(post, feed.items.length - 1);
        scroller.appendChild(made.node);
        observeItem(made.node, feed.items.length - 1);
      });
    }

    async function loadInteractionState(rows) {
      if (!CHL.user || !rows.length) return;
      var ids = rows.map(function (p) { return p.id; });
      try {
        var authors = rows.map(function (p) { return p.author_id; }).filter(function (id, i, all) { return id && id !== CHL.user.id && all.indexOf(id) === i; });
        if (authors.length) {
          var follows = await CHL.sb.from('follows').select('followee_id,status').eq('follower_id', CHL.user.id).in('followee_id', authors);
          if (!follows.error) list(follows.data).forEach(function (row) { if (row.status === 'pending') feed.pendingFollowIds.add(row.followee_id); else feed.followedIds.add(row.followee_id); });
        }
      } catch (_) {}
      try {
        var liked = await CHL.sb.from('likes').select('post_id').eq('user_id', CHL.user.id).in('post_id', ids);
        if (!liked.error) list(liked.data).forEach(function (x) { feed.likedIds.add(x.post_id); });
      } catch (_) {}
      try {
        var saved = await CHL.sb.from('saves').select('post_id').eq('user_id', CHL.user.id).eq('collection', 'default').in('post_id', ids);
        if (!saved.error) list(saved.data).forEach(function (x) { feed.savedIds.add(x.post_id); });
      } catch (_) {}
      rows.forEach(function (p) {
        var item = scroller.querySelector('[data-post-id="' + p.id + '"]');
        if (!item) return;
        var actions = item.querySelectorAll('.chl-feed-action');
        if (actions[0]) { setPressed(actions[0], feed.likedIds.has(p.id)); var icon = actions[0].querySelector('.chl-feed-action-icon'); if (icon) icon.textContent = feed.likedIds.has(p.id) ? '♥' : '♡'; }
        if (actions[2]) setPressed(actions[2], feed.savedIds.has(p.id));
      });
    }

    async function loadNext(reset) {
      if (feed.loading || feed.destroyed || (feed.exhausted && !reset)) return;
      feed.loading = true;
      if (reset) { feed.exhausted = false; feed.cursor = null; feed.seen.clear(); feed.items = []; scroller.innerHTML = ''; }
      status.textContent = feed.items.length ? 'Loading more posts…' : 'Loading creator posts…';
      try {
        var followingIds = [];
        if (feed.mode === 'following') {
          followingIds = await queryFollowing();
          if (!followingIds.length) {
            feed.exhausted = true;
            showStatus(scroller, 'Your Following feed is empty', 'Follow creators to see their public and follower-only posts here.', 'Discover creators', function () { CHL.navigate('#/discover'); });
            status.textContent = '';
            return;
          }
        }
        var r = await buildQuery(feed.cursor, followingIds);
        if (r.error) {
          /* Compatibility path for deployments using the earlier text-post shape. RLS still applies. */
          if (!schemaError(r.error)) throw r.error;
          var legacy = CHL.sb.from('posts').select('id,author_id,body,created_at,author:profiles!posts_author_id_fkey(id,username,display_name,avatar_url)').eq('is_draft', false).eq('is_test', false).order('created_at', { ascending: false }).limit(PAGE_SIZE);
          if (feed.mode === 'following') legacy = legacy.in('audience', ['public', 'followers']).in('author_id', followingIds);
          else legacy = legacy.eq('audience', 'public');
          if (feed.cursor && feed.cursor.created_at) legacy = legacy.lt('created_at', feed.cursor.created_at);
          r = await legacy;
          if (r.error) throw r.error;
        }
        if (feed.destroyed) return;
        var rows = list(r.data);
        if (!rows.length) feed.exhausted = true;
        if (rows.length) feed.cursor = { created_at: rows[rows.length - 1].created_at, id: rows[rows.length - 1].id };
        await loadInteractionState(rows);
        appendRows(rows);
        status.textContent = feed.exhausted ? 'You’re all caught up.' : '';
        if (!feed.items.length && !feed.destroyed) {
          showStatus(scroller, 'No posts yet', feed.mode === 'following' ? 'Posts from creators you follow will appear here.' : 'Public creator posts will appear here when they are published.', feed.mode === 'following' ? 'Discover creators' : 'Create a post', function () { CHL.navigate(feed.mode === 'following' ? '#/discover' : '#/compose'); });
        }
      } catch (err) {
        if (feed.destroyed) return;
        status.textContent = '';
        if (!feed.items.length) showStatus(scroller, 'The feed could not load', (err && err.message) || 'Check your connection and try again.', 'Retry', function () { loadNext(true); });
        else status.appendChild(el('button', { type: 'button', class: 'btn', onclick: function () { loadNext(false); }, text: 'Retry loading more' }));
      } finally { feed.loading = false; }
    }

    if ('IntersectionObserver' in window) {
      feed.itemObserver = new IntersectionObserver(function (entries) {
        var visible = entries.filter(function (entry) { return entry.isIntersecting && entry.intersectionRatio >= 0.58; }).sort(function (a, b) { return b.intersectionRatio - a.intersectionRatio; })[0];
        if (visible) activate(Number(visible.target.getAttribute('data-feed-index')) || 0);
      }, { root: scroller, threshold: [0.25, 0.58, 0.8] });
      feed.loadObserver = new IntersectionObserver(function (entries) {
        if (entries.some(function (entry) { return entry.isIntersecting; })) {
          var index = Number(entries.find(function (entry) { return entry.isIntersecting; }).target.getAttribute('data-feed-index')) || 0;
          if (index >= feed.items.length - 3) loadNext(false);
        }
      }, { root: scroller, rootMargin: '0px 0px 90% 0px', threshold: 0.01 });
    } else {
      feed.fallbackScroll = function () {
        if (feed.scrollTick) return;
        feed.scrollTick = true;
        window.requestAnimationFrame(function () {
          feed.scrollTick = false;
          var nodes = scroller.querySelectorAll('.chl-feed-item');
          if (!nodes.length) return;
          var best = 0, dist = Infinity, center = scroller.getBoundingClientRect().top + scroller.clientHeight / 2;
          nodes.forEach(function (node, i) { var r = node.getBoundingClientRect(); var d = Math.abs((r.top + r.bottom) / 2 - center); if (d < dist) { dist = d; best = i; } });
          activate(best);
        });
      };
      scroller.addEventListener('scroll', feed.fallbackScroll, { passive: true });
    }
    feed.keyHandler = function (event) {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) || event.target.isContentEditable) return;
      if (event.key !== 'ArrowDown' && event.key !== 'PageDown' && event.key !== 'ArrowUp' && event.key !== 'PageUp') return;
      event.preventDefault();
      var nodes = scroller.querySelectorAll('.chl-feed-item');
      if (!nodes.length) return;
      var next = Math.max(0, Math.min(nodes.length - 1, feed.activeIndex + ((event.key === 'ArrowUp' || event.key === 'PageUp') ? -1 : 1)));
      nodes[next].scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
      activate(next);
    };
    scroller.addEventListener('keydown', feed.keyHandler);
    loadNext(true);
  };
})();
