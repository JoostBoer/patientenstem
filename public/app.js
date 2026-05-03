/* Patiëntenstem — frontend interactions: microphone, AI rewrite, feedback bubble */

(function () {
  'use strict';

  const STRINGS = {
    nl: {
      mic_start: 'Spreek je verhaal in',
      mic_stop: 'Stop opname',
      mic_luistert: 'Aan het luisteren...',
      mic_niet_ondersteund: 'Spraakinvoer werkt het beste in Chrome of Edge',
      mic_geen_toegang: 'Geen microfoon-toegang. Sta het toe in je browser-instellingen.',
      ai_help_bezig: 'Even denken...',
      ai_help_fout: 'Het is niet gelukt, probeer zo nog eens.',
      ai_help_geen_key: 'AI is niet geconfigureerd op deze server.',
      ai_help_te_kort: 'Schrijf eerst minstens 30 tekens.',
      feedback_verstuurd: 'Bedankt, ontvangen.',
      feedback_leeg: 'Schrijf of spreek eerst iets in.',
      feedback_fout: 'Niet gelukt. Probeer later nog eens.',
    },
    en: {
      mic_start: 'Speak your story',
      mic_stop: 'Stop recording',
      mic_luistert: 'Listening...',
      mic_niet_ondersteund: 'Voice input works best in Chrome or Edge',
      mic_geen_toegang: 'No microphone access. Allow it in browser settings.',
      ai_help_bezig: 'Thinking...',
      ai_help_fout: 'That didn\'t work, please try again.',
      ai_help_geen_key: 'AI is not configured on this server.',
      ai_help_te_kort: 'Write at least 30 characters first.',
      feedback_verstuurd: 'Thanks, received.',
      feedback_leeg: 'Write or speak something first.',
      feedback_fout: 'Failed. Please try again later.',
    },
  };

  function s(lang, key) {
    return (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.nl[key] || key;
  }

  function htmlLang() {
    return document.documentElement.lang || 'nl';
  }

  /* ---------------- Microphone (Web Speech API) ---------------- */

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  function attachMic(btn) {
    const targetId = btn.dataset.target;
    const lang = btn.dataset.lang || htmlLang();
    const target = document.getElementById(targetId);
    const status = document.getElementById('micStatus_' + targetId);
    if (!target) return;

    if (!SpeechRecognition) {
      btn.disabled = true;
      btn.classList.add('mic-btn-disabled');
      btn.title = s(lang, 'mic_niet_ondersteund');
      return;
    }

    let recognition = null;
    let listening = false;
    let appendBuffer = '';

    function setListening(on) {
      listening = on;
      btn.classList.toggle('mic-btn-active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      const labelEl = btn.querySelector('.mic-label');
      if (labelEl) labelEl.textContent = on ? s(lang, 'mic_stop') : s(lang, 'mic_start');
      btn.setAttribute('aria-label', on ? s(lang, 'mic_stop') : s(lang, 'mic_start'));
      if (status) status.textContent = on ? s(lang, 'mic_luistert') : '';
    }

    function start() {
      try {
        recognition = new SpeechRecognition();
        recognition.lang = lang === 'en' ? 'en-US' : 'nl-NL';
        recognition.continuous = true;
        recognition.interimResults = true;

        appendBuffer = target.value && !target.value.endsWith(' ') && !target.value.endsWith('\n') ? ' ' : '';
        const baseText = target.value;
        let interim = '';

        recognition.onresult = function (event) {
          let finalChunk = '';
          interim = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const r = event.results[i];
            if (r.isFinal) finalChunk += r[0].transcript;
            else interim += r[0].transcript;
          }
          if (finalChunk) {
            appendBuffer += (appendBuffer && !appendBuffer.endsWith(' ') ? ' ' : '') + finalChunk.trim();
          }
          target.value = baseText + appendBuffer + (interim ? (appendBuffer && !appendBuffer.endsWith(' ') ? ' ' : '') + interim : '');
          target.dispatchEvent(new Event('input', { bubbles: true }));
        };

        recognition.onerror = function (e) {
          if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
            if (status) status.textContent = s(lang, 'mic_geen_toegang');
          }
          setListening(false);
        };

        recognition.onend = function () {
          if (listening) {
            try { recognition.start(); } catch (e) { setListening(false); }
          }
        };

        recognition.start();
        setListening(true);
      } catch (e) {
        setListening(false);
      }
    }

    function stop() {
      setListening(false);
      if (recognition) {
        try { recognition.stop(); } catch (e) {}
        recognition = null;
      }
    }

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      if (listening) stop();
      else start();
    });
  }

  document.querySelectorAll('.mic-btn').forEach(attachMic);

  /* ---------------- Language dropdown ---------------- */

  const langBtn = document.getElementById('langBtn');
  const langMenu = document.getElementById('langMenu');
  if (langBtn && langMenu) {
    langBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      const isOpen = !langMenu.hidden;
      langMenu.hidden = isOpen;
      langBtn.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
    });
    document.addEventListener('click', function (e) {
      if (!langMenu.hidden && !langMenu.contains(e.target) && e.target !== langBtn) {
        langMenu.hidden = true;
        langBtn.setAttribute('aria-expanded', 'false');
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !langMenu.hidden) {
        langMenu.hidden = true;
        langBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ---------------- Voorbeeld-pillen (prefill textarea) ---------------- */

  document.querySelectorAll('.pil[data-prefill]').forEach(function (pil) {
    pil.addEventListener('click', function () {
      const target = document.getElementById('ervaring');
      if (!target) return;
      const prompt = pil.dataset.prefill + '\n\n';
      if (!target.value || target.value.trim() === '') {
        target.value = prompt;
      } else {
        target.value = target.value.trim() + '\n\n' + prompt;
      }
      target.focus();
      target.setSelectionRange(target.value.length, target.value.length);
      target.dispatchEvent(new Event('input', { bubbles: true }));
    });
  });

  /* ---------------- AI rewrite ---------------- */

  const aiBtn = document.getElementById('aiHelpBtn');
  if (aiBtn) {
    const targetId = aiBtn.dataset.target;
    const target = document.getElementById(targetId);
    const lang = aiBtn.dataset.lang || htmlLang();
    const suggestionWrap = document.getElementById('aiSuggestion');
    const suggestionText = document.getElementById('aiSuggestionText');
    const acceptBtn = document.getElementById('aiAccept');
    const rejectBtn = document.getElementById('aiReject');

    aiBtn.addEventListener('click', async function () {
      if (!target.value || target.value.trim().length < 30) {
        alert(s(lang, 'ai_help_te_kort'));
        return;
      }
      const orig = aiBtn.innerHTML;
      aiBtn.disabled = true;
      aiBtn.innerHTML = '<span>' + s(lang, 'ai_help_bezig') + '</span>';
      try {
        const r = await fetch('/api/ai-rewrite', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ tekst: target.value }),
        });
        const data = await r.json();
        if (!r.ok || !data.ok) {
          alert(data.error === 'no_api_key' ? s(lang, 'ai_help_geen_key') : s(lang, 'ai_help_fout'));
          return;
        }
        suggestionText.textContent = data.tekst;
        suggestionWrap.hidden = false;
        suggestionWrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch (e) {
        alert(s(lang, 'ai_help_fout'));
      } finally {
        aiBtn.disabled = false;
        aiBtn.innerHTML = orig;
      }
    });

    acceptBtn && acceptBtn.addEventListener('click', function () {
      target.value = suggestionText.textContent;
      target.dispatchEvent(new Event('input', { bubbles: true }));
      suggestionWrap.hidden = true;
    });
    rejectBtn && rejectBtn.addEventListener('click', function () {
      suggestionWrap.hidden = true;
    });
  }

  /* ---------------- Feedback bubble ---------------- */

  const bubbleOpen = document.getElementById('bubbleOpen');
  const bubbleClose = document.getElementById('bubbleClose');
  const bubbleModal = document.getElementById('bubbleModal');
  const bubbleForm = document.getElementById('bubbleForm');
  const bubbleStatus = document.getElementById('bubbleStatus');

  function openModal() {
    bubbleModal.hidden = false;
    setTimeout(function () {
      const ta = document.getElementById('bubbleTekst');
      if (ta) ta.focus();
    }, 50);
  }
  function closeModal() {
    bubbleModal.hidden = true;
    if (bubbleStatus) bubbleStatus.textContent = '';
  }

  bubbleOpen && bubbleOpen.addEventListener('click', openModal);
  bubbleClose && bubbleClose.addEventListener('click', closeModal);
  bubbleModal && bubbleModal.addEventListener('click', function (e) {
    if (e.target === bubbleModal) closeModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && bubbleModal && !bubbleModal.hidden) closeModal();
  });

  if (bubbleForm) {
    bubbleForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      const lang = htmlLang();
      const tekst = (document.getElementById('bubbleTekst').value || '').trim();
      if (!tekst) {
        bubbleStatus.textContent = s(lang, 'feedback_leeg');
        return;
      }
      try {
        const r = await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ bericht: tekst }),
        });
        const data = await r.json();
        if (data.ok) {
          bubbleStatus.textContent = s(lang, 'feedback_verstuurd');
          document.getElementById('bubbleTekst').value = '';
          setTimeout(closeModal, 1400);
        } else {
          bubbleStatus.textContent = s(lang, 'feedback_fout');
        }
      } catch (e) {
        bubbleStatus.textContent = s(lang, 'feedback_fout');
      }
    });
  }
})();
