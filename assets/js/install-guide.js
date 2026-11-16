(() => {
  const $ = id => document.getElementById(id);
  const banner = $('installBanner');
  const dialog = $('installGuide');
  const nativeButton = $('installNative');
  const standalone = matchMedia('(display-mode: standalone)');
  // Dismiss only for this page visit; old seven-day dismissals no longer hide it.
  let dismissed = false;
  let deferredPrompt = null;
  let platform = /Android/i.test(navigator.userAgent) ? 'android' : 'iphone';
  const guides = {
    iphone: {
      hint: 'On your iPhone or iPad, open Setlog in Safari.',
      steps: [
        ['Tap the menu icon in the address bar', 'Already see Share? Skip this step.'],
        ['Tap “Share”', ''],
        ['Tap “View More”', 'Only if your share sheet shows this option.'],
        ['Tap “Add to Home Screen”', 'Scroll down if needed.'],
        ['Tap “Add”, then open Setlog from your Home Screen', '']
      ],
      help: 'Keep Open as Web App on if it appears. Missing Add to Home Screen? Scroll to the bottom of the share sheet, tap Edit Actions, then add it to the list.'
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
    banner.hidden = isInstalled() || dismissed;
    $('settingsInstallGuide').hidden = isInstalled();
    nativeButton.hidden = !deferredPrompt || isInstalled();
  }
  function showPlatform(value) {
    platform = value;
    const guide = guides[value];
    $('installBrowserHint').textContent = guide.hint;
    $('installExtraHelp').textContent = guide.help;
    const list = $('installSteps');
    list.replaceChildren();
    guide.steps.forEach(([title, description], index) => {
      const item = document.createElement('li');
      const copy = document.createElement('div'); copy.className = 'install-step-copy';
      const heading = document.createElement('p'); heading.className = 'install-step-title';
      const parts = title.split(/(“[^”]+”)/g);
      parts.forEach(part => {
        const text = document.createElement(part.startsWith('“') ? 'strong' : 'span');
        text.textContent = part; heading.append(text);
      });
      const help = document.createElement('span'); help.textContent = description;
      help.className = 'install-step-help'; help.hidden = !description;
      const illustration = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      illustration.setAttribute('viewBox', '0 0 160 108');
      illustration.setAttribute('class', 'install-step-picture');
      illustration.setAttribute('aria-hidden', 'true');
      illustration.setAttribute('focusable', 'false');
      const drawing = document.createElementNS('http://www.w3.org/2000/svg', 'use');
      drawing.setAttribute('href', 'assets/media/illustrations/install-steps.svg?v=samsung-1#' + value + '-' + (index + 1));
      illustration.append(drawing);
      copy.append(heading, help); item.append(copy, illustration); list.append(item);
    });
    dialog.querySelectorAll('[data-install-platform]').forEach(button => {
      button.setAttribute('aria-pressed', button.dataset.installPlatform === platform);
    });
  }
  function openGuide() {
    dialog.showModal();
    showPlatform(platform);
    $('installFeedback').textContent = '';
    dialog.scrollTop = 0;
    document.documentElement.classList.add('install-guide-open');
  }
  $('openInstallGuide').onclick = openGuide;
  $('settingsInstallGuide').onclick = openGuide;
  $('closeInstallGuide').onclick = () => dialog.close();
  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove('install-guide-open');
  });
  dialog.querySelectorAll('[data-install-platform]').forEach(button => {
    button.onclick = () => showPlatform(button.dataset.installPlatform);
  });
  $('dismissInstall').onclick = () => {
    dismissed = true;
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
