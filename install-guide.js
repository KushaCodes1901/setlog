(() => {
  const $ = id => document.getElementById(id);
  const banner = $('installBanner');
  const dialog = $('installGuide');
  const video = $('installVideo');
  const nativeButton = $('installNative');
  const standalone = matchMedia('(display-mode: standalone)');
  const dismissalKey = 'setlog-install-dismissed-v1';
  let deferredPrompt = null;
  let platform = /Android/i.test(navigator.userAgent) ? 'android' : 'iphone';
  const guides = {
    iphone: {
      hint: 'On your iPhone or iPad, open Setlog in Safari.',
      steps: [
        ['Open the page menu, then Share', 'Tap the menu beside the address, then Share. If Share is already in your toolbar, tap it directly.'],
        ['Choose Add to Home Screen', 'Scroll down the share sheet to find it.'],
        ['Keep Open as Web App on', 'If this option appears, leave it switched on for the app experience.'],
        ['Tap Add. You’re ready.', 'Find the Setlog icon on your Home Screen and open it.']
      ],
      help: 'Missing Add to Home Screen? Scroll to the bottom of the share sheet, tap Edit Actions, then add it to the list.'
    },
    android: {
      hint: 'On your Android phone, open Setlog in Chrome.',
      steps: [
        ['Open the three-dot menu', 'Look beside the address bar in Chrome.'],
        ['Choose Install or Add to Home screen', 'Some versions show Install and create shortcut first.'],
        ['Confirm Install', 'Follow the prompt on your phone.'],
        ['Open Setlog from your Home Screen', 'Your journal is now one tap away.']
      ],
      help: 'If no install option appears, open the published Setlog page directly in Chrome, rather than inside another app’s browser.'
    }
  };
  function isInstalled() { return standalone.matches || navigator.standalone === true; }
  function updateBanner() {
    let dismissed = false;
    try { dismissed = Date.now() - Number(localStorage.getItem(dismissalKey) || 0) < 7 * 86400000; } catch {}
    banner.hidden = isInstalled() || dismissed;
    $('settingsInstallGuide').hidden = isInstalled();
    nativeButton.hidden = !deferredPrompt || isInstalled();
  }
  function showPlatform(value) {
    platform = value;
    const guide = guides[value];
    video.pause();
    video.src = 'install-' + value + '.mp4';
    video.poster = 'install-' + value + '.jpg';
    video.replaceChildren();
    const track = document.createElement('track');
    track.kind = 'captions'; track.srclang = 'en'; track.label = 'English';
    track.src = 'install-' + value + '.vtt';
    video.append(track);
    video.load();
    $('installBrowserHint').textContent = guide.hint;
    $('installExtraHelp').textContent = guide.help;
    const list = $('installSteps');
    list.replaceChildren();
    guide.steps.forEach(([title, description]) => {
      const item = document.createElement('li');
      const copy = document.createElement('div'); copy.className = 'install-step-copy';
      const heading = document.createElement('strong'); heading.textContent = title;
      const help = document.createElement('span'); help.textContent = description;
      copy.append(heading, help); item.append(copy); list.append(item);
    });
    dialog.querySelectorAll('[data-install-platform]').forEach(button => {
      button.setAttribute('aria-pressed', button.dataset.installPlatform === platform);
    });
  }
  function openGuide() {
    showPlatform(platform);
    $('installFeedback').textContent = '';
    dialog.showModal();
    dialog.scrollTop = 0;
    document.documentElement.classList.add('install-guide-open');
  }
  $('openInstallGuide').onclick = openGuide;
  $('settingsInstallGuide').onclick = openGuide;
  $('closeInstallGuide').onclick = () => dialog.close();
  dialog.addEventListener('close', () => {
    video.pause();
    document.documentElement.classList.remove('install-guide-open');
  });
  dialog.querySelectorAll('[data-install-platform]').forEach(button => {
    button.onclick = () => showPlatform(button.dataset.installPlatform);
  });
  $('dismissInstall').onclick = () => {
    try { localStorage.setItem(dismissalKey, String(Date.now())); } catch {}
    banner.hidden = true;
  };
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); deferredPrompt = event; updateBanner();
  });
  nativeButton.onclick = async () => {
    const prompt = deferredPrompt;
    if (!prompt) return;
    deferredPrompt = null;
    nativeButton.disabled = true;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      $('installFeedback').textContent = choice.outcome === 'accepted' ? 'Follow your device’s prompt to finish adding Setlog.' : 'No rush. You can add Setlog whenever you’re ready.';
    } catch { $('installFeedback').textContent = 'Use the steps above to add Setlog from your browser menu.'; }
    finally { nativeButton.disabled = false; updateBanner(); }
  };
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null; banner.hidden = true; $('settingsInstallGuide').hidden = true;
    nativeButton.hidden = true;
    $('installFeedback').textContent = 'Setlog is installed. Look for it on your Home Screen.';
  });
  standalone.addEventListener('change', updateBanner);
  updateBanner();
})();
