/* Creator Hub Creator Network — accessibility preferences, local to this browser. */
(function () {
  'use strict';
  var CHL = window.CHL, el = CHL.el, ui = CHL.ui;
  function field(label, control) {
    return el('label', { class: 'field' }, [el('span', { class: 'field-label', text: label }), control]);
  }
  CHL.route('/settings/accessibility', function (outlet) {
    outlet.appendChild(ui.pageHead('Accessibility', 'Display preferences apply on this device and do not change your account data.'));
    var card = el('form', { class: 'card form-stack', style: 'max-width:650px', onsubmit: function (event) { event.preventDefault(); save(); } });
    var scale = el('select', { class: 'input', name: 'scale' }, [
      el('option', { value: '0.9' }, 'Compact text'), el('option', { value: '1' }, 'Default text'),
      el('option', { value: '1.1' }, 'Large text'), el('option', { value: '1.2' }, 'Extra large text')
    ]);
    var motion = el('input', { type: 'checkbox', name: 'motion' });
    var contrast = el('input', { type: 'checkbox', name: 'contrast' });
    var saveButton = el('button', { class: 'btn primary', type: 'submit' }, 'Save accessibility preferences');
    card.appendChild(field('Text size', scale));
    card.appendChild(el('label', { class: 'row', style: 'gap:8px' }, [motion, el('span', { text: 'Reduce motion and animations' })]));
    card.appendChild(el('label', { class: 'row', style: 'gap:8px' }, [contrast, el('span', { text: 'Increase text contrast' })]));
    card.appendChild(el('div', { class: 'note', text: 'These preferences are stored locally on this device. Browser and operating-system accessibility settings remain available.' }));
    card.appendChild(saveButton); outlet.appendChild(card);
    function apply(value) {
      document.documentElement.style.setProperty('--user-scale', String(value.scale));
      document.documentElement.classList.toggle('reduce-motion', !!value.motion);
      document.documentElement.classList.toggle('high-contrast', !!value.contrast);
    }
    function save() {
      var value = { scale: Number(scale.value), motion: motion.checked, contrast: contrast.checked };
      try { localStorage.setItem('chcn_accessibility', JSON.stringify(value)); apply(value); CHL.toast('Accessibility preferences saved on this device.'); }
      catch (_) { CHL.toast('Could not save accessibility preferences.'); }
    }
    try {
      var value = JSON.parse(localStorage.getItem('chcn_accessibility') || '{}');
      scale.value = String(value.scale || 1); motion.checked = !!value.motion; contrast.checked = !!value.contrast;
      apply({ scale: Number(scale.value), motion: motion.checked, contrast: contrast.checked });
    } catch (_) { apply({ scale: 1, motion: false, contrast: false }); }
  });
})();
