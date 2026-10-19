/* Creator Hub Live — accessible, responsive authentication with a two-step signup. */
(function () {
  'use strict';
  var CHL = window.CHL, el = CHL.el, ui = CHL.ui, sb = CHL.sb;

  function installAuthStyles() {
    if (document.getElementById('chl-auth-styles')) return;
    var style = document.createElement('style');
    style.id = 'chl-auth-styles';
    style.textContent = [
      '.chl-auth-layout{width:min(1040px,calc(100% - 28px));margin:clamp(18px,4vh,44px) auto;display:grid;grid-template-columns:minmax(0,.92fr) minmax(320px,1.08fr);gap:18px;align-items:stretch}',
      '.chl-auth-visual{position:relative;isolation:isolate;overflow:hidden;min-height:510px;padding:clamp(24px,4vw,44px);border:1px solid rgba(177,157,255,.28);border-radius:26px;background:radial-gradient(ellipse at 12% 8%,rgba(148,111,255,.45),transparent 48%),radial-gradient(ellipse at 88% 88%,rgba(38,204,191,.22),transparent 40%),linear-gradient(145deg,#18152c 0%,#111321 55%,#0a0d15 100%);color:#f7f6ff;display:flex;flex-direction:column;justify-content:space-between;box-shadow:0 26px 80px rgba(0,0,0,.2)}',
      '.chl-auth-orbit{position:absolute;z-index:-1;width:310px;height:310px;border:1px solid rgba(187,169,255,.24);border-radius:50%;right:-120px;top:22%;box-shadow:0 0 0 25px rgba(143,119,255,.04),0 0 0 56px rgba(143,119,255,.035),inset 0 0 50px rgba(143,119,255,.07)}',
      '.chl-auth-brand{display:flex;gap:11px;align-items:center;font-size:12px;letter-spacing:.15em;font-weight:850;color:#d7d1ff;text-transform:uppercase}',
      '.chl-auth-brand img{width:38px;height:38px;object-fit:contain}',
      '.chl-auth-visual h1{font-size:clamp(30px,4.3vw,46px);line-height:1.06;letter-spacing:-.045em;margin:26px 0 14px;max-width:480px;font-weight:900}',
      '.chl-auth-visual p{max-width:430px;color:#d0d2e5;line-height:1.7;font-size:15px}',
      '.chl-auth-points{display:grid;gap:11px;margin-top:26px}',
      '.chl-auth-point{display:flex;align-items:center;gap:10px;color:#e4e3f4;font-size:13px;font-weight:650}',
      '.chl-auth-point span:first-child{display:grid;place-items:center;width:26px;height:26px;flex:0 0 26px;border-radius:9px;background:rgba(139,117,255,.2);color:#c5b8ff;border:1px solid rgba(177,157,255,.2)}',
      '.chl-auth-box{min-width:0;display:flex;flex-direction:column;justify-content:center}',
      '.chl-auth-box>.card{width:100%;padding:clamp(20px,3.5vw,34px);border-radius:26px;border:1px solid var(--line,#34364b);box-shadow:0 24px 74px rgba(0,0,0,.15);background:var(--panel,#171824)}',
      '.chl-auth-box .h1{font-size:clamp(23px,3vw,30px)!important;letter-spacing:-.035em;font-weight:900!important}',
      '.chl-auth-box .sub{line-height:1.65}',
      '.chl-auth-box .field{display:grid;gap:7px;margin:13px 0}',
      '.chl-auth-box .field input{min-height:48px;border-radius:13px}',
      '.chl-auth-progress{height:5px;overflow:hidden;border-radius:99px;background:var(--line,#36384b);margin:17px 0 20px}',
      '.chl-auth-progress span{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,#8b75ff,#47d9c5);transition:width .2s ease}',
      '.chl-auth-step-title{display:flex;align-items:center;justify-content:space-between;gap:10px;font-weight:800;margin:10px 0 4px}',
      '.chl-auth-step-pill{font-size:11px;color:var(--chl-muted,#c5c8d6);border:1px solid var(--line,#34364b);padding:5px 9px;border-radius:99px;white-space:nowrap}',
      '.chl-auth-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:16px}',
      '.chl-auth-actions>.btn{flex:1;min-height:46px}',
      '.chl-auth-box .btn.primary{min-height:48px;border-radius:13px;font-weight:850}',
      '.chl-auth-foot{margin-top:15px;text-align:center;line-height:1.65;color:var(--chl-muted,#c5c8d6);font-size:13px}',
      '.chl-auth-error{min-height:0;margin-top:10px;color:#ffb4bd;font-size:13px;line-height:1.5}',
      '@media(max-width:760px){.chl-auth-layout{grid-template-columns:minmax(0,1fr);width:min(540px,calc(100% - 22px));margin:16px auto 30px;gap:12px}.chl-auth-visual{min-height:0;padding:21px 22px;border-radius:20px}.chl-auth-visual h1{font-size:29px;margin:18px 0 8px}.chl-auth-visual p{font-size:13px;margin:0}.chl-auth-points{display:none}.chl-auth-orbit{width:180px;height:180px;right:-95px;top:-38px}.chl-auth-box>.card{border-radius:20px;padding:22px}}',
      '@media(prefers-reduced-motion:reduce){.chl-auth-progress span{transition:none}}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(style);
  }

  function authShell(title, sub, formNode, footer) {
    installAuthStyles();
    var visual = el('aside', { class: 'chl-auth-visual' }, [
      el('div', { class: 'chl-auth-orbit', 'aria-hidden': 'true' }),
      el('div', { class: 'chl-auth-brand' }, [el('img', { src: 'assets/logo.svg', alt: '' }), el('span', { text: 'Creator Hub Live' })]),
      el('div', {}, [
        el('div', { class: 'chl-auth-step-pill', style: 'display:inline-block;margin-top:22px;border-color:rgba(180,162,255,.35);color:#e4ddff', text: 'YOUR NEXT CHAPTER STARTS HERE' }),
        el('h1', { text: 'Create. Connect. Go LIVE.' }),
        el('p', { text: 'Build your community, share your creativity, and bring your audience together in one place.' }),
        el('div', { class: 'chl-auth-points' }, [
          el('div', { class: 'chl-auth-point' }, [el('span', { text: '✓' }), el('span', { text: 'One creator profile across your experience' })]),
          el('div', { class: 'chl-auth-point' }, [el('span', { text: '✓' }), el('span', { text: 'LIVE rooms, community, and creator tools' })]),
          el('div', { class: 'chl-auth-point' }, [el('span', { text: '✓' }), el('span', { text: 'Your privacy and account settings stay in your control' })])
        ])
      ]),
      el('p', { style: 'font-size:11px;margin-top:28px;color:#aeb1cd', text: 'CREATOR HUB LIVE · BUILT FOR WHAT’S NEXT' })
    ]);
    var card = el('div', { class: 'chl-auth-box' }, [
      el('div', { class: 'card' }, [
        el('div', { class: 'chl-auth-brand', style: 'margin-bottom:19px;letter-spacing:.08em' }, [el('img', { src: 'assets/logo.svg', alt: '' }), el('span', { text: 'Creator Hub Live' })]),
        el('div', { class: 'h1', text: title }),
        el('p', { class: 'sub', text: sub }),
        formNode
      ]),
      footer
    ]);
    return el('div', { class: 'chl-auth-layout' }, [visual, card]);
  }

  CHL.route('/login', function (outlet) {
    if (!CHL.configured) {
      outlet.appendChild(authShell('Connect your account', 'Your Creator Hub services need to be configured before sign-in is available.', ui.setupNotice(), el('div', { class: 'chl-auth-foot' }, [el('a', { href: '#/', text: '← Browse Creator Hub' })])));
      return;
    }
    var f = el('form', { onsubmit: function (e) { e.preventDefault(); doLogin(f); } });
    var email = CHL._field('Email address', 'email', 'you@example.com', 'email');
    var password = CHL._field('Password', 'password', 'Enter your password', 'password');
    email.querySelector('input').required = true; email.querySelector('input').autocomplete = 'email';
    password.querySelector('input').required = true; password.querySelector('input').autocomplete = 'current-password';
    f.appendChild(email); f.appendChild(password);
    var message = el('div', { class: 'chl-auth-error', role: 'status', 'aria-live': 'polite' }); f.appendChild(message);
    f.appendChild(el('button', { class: 'btn primary block', type: 'submit', style: 'margin-top:10px' }, 'Log in securely'));
    f.appendChild(el('div', { class: 'row wrap', style: 'justify-content:space-between;gap:8px;margin-top:14px;font-size:12px' }, [
      el('a', { href: '#/forgot-password', text: 'Forgot password?' }),
      el('a', { href: '#/register', text: 'Create an account' })
    ]));
    outlet.appendChild(authShell('Welcome back', 'Sign in to continue to your creator space.', f,
      el('div', { class: 'chl-auth-foot' }, ['New to Creator Hub Live? ', el('a', { href: '#/register', style: 'color:var(--brand2);font-weight:800', text: 'Join the community' })])));
  });

  async function doLogin(form) {
    var btn = form.querySelector('button[type="submit"]');
    var message = form.querySelector('.chl-auth-error');
    btn.disabled = true; btn.textContent = 'Signing in…'; if (message) message.textContent = '';
    try {
      var result = await sb.auth.signInWithPassword({ email: form.email.value.trim(), password: form.password.value });
      if (result.error) throw result.error;
      await CHL.refreshAuth(); CHL.navigate('#/');
    } catch (error) {
      if (message) message.textContent = error.message || 'Sign-in failed. Check your connection and details.';
      CHL.toast(error.message || 'Sign-in failed.');
    } finally { btn.disabled = false; btn.textContent = 'Log in securely'; }
  }

  CHL.route('/register', function (outlet) {
    if (!CHL.configured) { outlet.appendChild(authShell('Set up your account', 'Registration becomes available when Creator Hub is connected.', ui.setupNotice(), el('div', { class: 'chl-auth-foot' }, [el('a', { href: '#/login', text: 'Back to sign in' })]))); return; }

    var currentStep = 1;
    var form = el('form', { onsubmit: function (e) { e.preventDefault(); if (currentStep === 1) { if (validateStepOne()) showStep(2); return; } doRegister(); } });
    var progress = el('div', { class: 'chl-auth-progress', role: 'progressbar', 'aria-label': 'Registration progress', 'aria-valuemin': '1', 'aria-valuemax': '2', 'aria-valuenow': '1' }, [el('span', { style: 'width:50%' })]);
    form.appendChild(progress);
    var stepTitle = el('div', { class: 'chl-auth-step-title', 'aria-live': 'polite' }, [el('span', { text: 'Your creator identity' }), el('span', { class: 'chl-auth-step-pill', text: 'STEP 1 OF 2' })]);
    form.appendChild(stepTitle);
    var panelOne = el('section', { 'aria-label': 'Your account details' });
    var displayWrap = CHL._field('Display name', 'display_name', 'How people will see you');
    var usernameWrap = CHL._field('Username', 'username', 'your_handle');
    var emailWrap = CHL._field('Email address', 'email', 'you@example.com', 'email');
    var displayInput = displayWrap.querySelector('input'); var usernameInput = usernameWrap.querySelector('input'); var emailInput = emailWrap.querySelector('input');
    displayInput.required = true; displayInput.maxLength = 40; displayInput.autocomplete = 'name';
    usernameInput.required = true; usernameInput.minLength = 3; usernameInput.maxLength = 20; usernameInput.pattern = '[A-Za-z0-9_]{3,20}'; usernameInput.autocomplete = 'username'; usernameInput.title = 'Use 3–20 letters, numbers, or underscores.';
    emailInput.required = true; emailInput.type = 'email'; emailInput.autocomplete = 'email';
    panelOne.appendChild(displayWrap); panelOne.appendChild(usernameWrap); panelOne.appendChild(emailWrap);
    var stepActions = el('div', { class: 'chl-auth-actions' });
    var nextButton = el('button', { class: 'btn primary', type: 'button', text: 'Continue' });
    stepActions.appendChild(nextButton); panelOne.appendChild(stepActions); form.appendChild(panelOne);

    var panelTwo = el('section', { 'aria-label': 'Secure your account', hidden: true });
    panelTwo.appendChild(el('p', { class: 'sub', text: 'Choose a strong password that you do not use on other websites.' }));
    var passwordWrap = CHL._field('Password', 'password', 'At least 8 characters', 'password');
    var confirmWrap = CHL._field('Confirm password', 'confirm_password', 'Enter the same password again', 'password');
    var passwordInput = passwordWrap.querySelector('input'); var confirmInput = confirmWrap.querySelector('input');
    passwordInput.required = true; passwordInput.minLength = 8; passwordInput.maxLength = 128; passwordInput.autocomplete = 'new-password';
    confirmInput.required = true; confirmInput.minLength = 8; confirmInput.maxLength = 128; confirmInput.autocomplete = 'new-password';
    panelTwo.appendChild(passwordWrap); panelTwo.appendChild(confirmWrap);
    var finalActions = el('div', { class: 'chl-auth-actions' });
    var backButton = el('button', { class: 'btn', type: 'button', text: 'Back' });
    var submitButton = el('button', { class: 'btn primary', type: 'submit', text: 'Create account' });
    finalActions.appendChild(backButton); finalActions.appendChild(submitButton); panelTwo.appendChild(finalActions); form.appendChild(panelTwo);
    var message = el('div', { class: 'chl-auth-error', role: 'status', 'aria-live': 'polite' }); form.appendChild(message);

    function fieldsIn(panel) { return Array.prototype.slice.call(panel.querySelectorAll('input,select,textarea,button')); }
    function showStep(step) {
      currentStep = step; panelOne.hidden = step !== 1; panelTwo.hidden = step !== 2;
      fieldsIn(panelOne).forEach(function (field) { field.disabled = step !== 1; });
      fieldsIn(panelTwo).forEach(function (field) { field.disabled = step !== 2; });
      stepTitle.firstElementChild.textContent = step === 1 ? 'Your creator identity' : 'Secure your account';
      stepTitle.lastElementChild.textContent = 'STEP ' + step + ' OF 2';
      progress.setAttribute('aria-valuenow', String(step)); progress.firstElementChild.style.width = step === 1 ? '50%' : '100%';
      if (message) message.textContent = '';
      (step === 1 ? displayInput : passwordInput).focus();
    }
    function validateStepOne() {
      var items = [displayInput, usernameInput, emailInput];
      for (var i = 0; i < items.length; i++) { if (!items[i].checkValidity()) { items[i].reportValidity(); return false; } }
      if (!displayInput.value.trim()) { displayInput.setCustomValidity('Enter a display name.'); displayInput.reportValidity(); displayInput.setCustomValidity(''); return false; }
      if (!usernameInput.value.trim()) { usernameInput.reportValidity(); return false; }
      return true;
    }
    nextButton.addEventListener('click', function () { if (validateStepOne()) showStep(2); });
    backButton.addEventListener('click', function () { showStep(1); });
    showStep(1);
    outlet.appendChild(authShell('Join Creator Hub Live', 'A few quick steps to create your account and get started.', form,
      el('div', { class: 'chl-auth-foot' }, ['Already have an account? ', el('a', { href: '#/login', style: 'color:var(--brand2);font-weight:800', text: 'Log in' })])));

    async function doRegister() {
      var username = usernameInput.value.trim().toLowerCase();
      var displayName = displayInput.value.trim();
      var email = emailInput.value.trim();
      var password = passwordInput.value;
      if (!validateStepOne()) { showStep(1); return; }
      if (password.length < 8) { passwordInput.setCustomValidity('Use at least 8 characters.'); passwordInput.reportValidity(); passwordInput.setCustomValidity(''); return; }
      if (password !== confirmInput.value) { confirmInput.setCustomValidity('The passwords do not match.'); confirmInput.reportValidity(); confirmInput.setCustomValidity(''); if (message) message.textContent = 'Enter the same password in both fields.'; return; }
      submitButton.disabled = true; backButton.disabled = true; submitButton.textContent = 'Creating account…'; if (message) message.textContent = '';
      try {
        var result = await sb.auth.signUp({ email: email, password: password, options: { data: { username: username, display_name: displayName } } });
        if (result.error) throw result.error;
        if (result.data && result.data.session) {
          CHL.toast('Account created. Welcome to Creator Hub Live!');
          await CHL.refreshAuth(); CHL.navigate('#/');
        } else {
          if (message) message.textContent = 'Account created. Check your email to confirm your address, then sign in.';
          CHL.toast('Account created. Check your email if confirmation is required.');
          CHL.navigate('#/login');
        }
      } catch (error) {
        if (message) message.textContent = error.message || 'Registration failed. Check your connection and try again.';
        CHL.toast(error.message || 'Registration failed.');
      } finally { submitButton.disabled = false; backButton.disabled = false; submitButton.textContent = 'Create account'; }
    }
  });

  CHL.route('/404', function (outlet) {
    outlet.appendChild(el('div', { style: 'text-align:center;max-width:460px;margin:48px auto' }, [
      el('img', { src: 'assets/logo.svg', height: '46', alt: CHL.brand, style: 'margin-bottom:18px' }),
      el('div', { style: 'font-size:64px;font-weight:800;line-height:1' }, [el('span', { class: 'grad', text: '404' })]),
      el('h2', { style: 'margin:10px 0 6px', text: "We couldn't find that page." }),
      el('p', { class: 'sub', text: 'The link may be broken or the page may have moved.' }),
      el('div', { class: 'row wrap', style: 'gap:10px;justify-content:center;margin-top:8px' }, [
        el('a', { href: '#/', class: 'btn primary', text: '🏠 Go Home' }),
        el('a', { href: '#/discover', class: 'btn', text: '🔎 Discover' }),
        el('a', { href: '#/create', class: 'btn', text: '▶ Go LIVE' }),
        el('a', { href: '#/search', class: 'btn', text: '🔍 Search' }),
        el('a', { href: '#/login', class: 'btn ghost', text: 'Sign In' })
      ])
    ]));
  });

  CHL.route('/admin-denied', function (outlet) {
    outlet.appendChild(ui.empty('🔒', 'Admin access only', 'You do not have permission to view the Admin Center.', el('a', { href: '#/', class: 'btn', style: 'margin-top:8px' }, 'Go home')));
  });
})();
