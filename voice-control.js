(() => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const oldBtn = document.getElementById('micBtn');
  const status = document.getElementById('voiceStatus');
  const input = document.getElementById('commandInput');
  const processBtn = document.getElementById('processBtn');
  if (!oldBtn || !status) return;

  // Remove the earlier click handler by replacing the button node.
  const btn = oldBtn.cloneNode(true);
  oldBtn.replaceWith(btn);

  if (!SR) {
    btn.disabled = true;
    status.textContent = 'Voice recognition unavailable in this browser';
    return;
  }

  let recognition = null;
  let listening = false;
  let finalTranscript = '';

  const setIdle = (message = 'Ready to listen') => {
    listening = false;
    btn.classList.remove('listening');
    btn.setAttribute('aria-label', 'Start voice command');
    const label = btn.querySelector('span');
    if (label) label.textContent = 'Voice command';
    status.textContent = message;
  };

  const hardStop = ({ process = false } = {}) => {
    if (recognition) {
      try { recognition.abort(); } catch (_) {}
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition = null;
    }
    const transcript = finalTranscript.trim();
    finalTranscript = '';
    setIdle();
    if (process && transcript) {
      input.value = transcript;
      processBtn?.click();
    }
  };

  const start = () => {
    if (listening) return hardStop({ process: true });
    recognition = new SR();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;
    finalTranscript = '';

    recognition.onstart = () => {
      listening = true;
      btn.classList.add('listening');
      btn.setAttribute('aria-label', 'Stop voice command');
      const label = btn.querySelector('span');
      if (label) label.textContent = 'Stop listening';
      status.textContent = 'Listening — tap again to stop';
    };

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalTranscript += text + ' ';
        else interim += text;
      }
      input.value = (finalTranscript + interim).trim();
    };

    recognition.onerror = () => hardStop();
    recognition.onend = () => {
      const transcript = (finalTranscript || input.value || '').trim();
      recognition = null;
      listening = false;
      setIdle();
      if (transcript) processBtn?.click();
    };

    try { recognition.start(); }
    catch (_) { hardStop(); }
  };

  btn.addEventListener('click', start);

  // Privacy/safety lifecycle: never keep listening when the user leaves the app.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hardStop();
  });
  window.addEventListener('pagehide', () => hardStop());
  window.addEventListener('beforeunload', () => hardStop());
  window.addEventListener('blur', () => {
    if (listening) hardStop();
  });

  setIdle();
})();
