/* AnimeWeek Tracker — GitHub Update Center */
(function () {
  'use strict';

  if (window.__awUpdateCenterInstalled) return;
  window.__awUpdateCenterInstalled = true;

  var APP_ID = 'com.animeweek.tracker';
  var APP_VERSION = '95.27.0';
  var MANIFEST_URL = 'https://raw.githubusercontent.com/joseluisjr10x-maker/AnimeWeek-Tracker/main/latest.json';
  var RELEASES_URL = 'https://github.com/joseluisjr10x-maker/AnimeWeek-Tracker/releases';
  var overlay = null;
  var lastManifest = null;

  function compareVersions(a, b) {
    var aa = String(a || '0').split(/[.+-]/).slice(0, 3).map(function (x) { return parseInt(x, 10) || 0; });
    var bb = String(b || '0').split(/[.+-]/).slice(0, 3).map(function (x) { return parseInt(x, 10) || 0; });
    for (var i = 0; i < 3; i++) {
      if ((aa[i] || 0) > (bb[i] || 0)) return 1;
      if ((aa[i] || 0) < (bb[i] || 0)) return -1;
    }
    return 0;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function validManifest(m) {
    return !!m && m.appId === APP_ID && /^\d+\.\d+\.\d+$/.test(String(m.version || '')) &&
      (!m.android || !m.android.apkUrl || /^https:\/\/github\.com\/joseluisjr10x-maker\/AnimeWeek-Tracker\/releases\/download\//.test(m.android.apkUrl));
  }

  async function fetchManifest() {
    var response = await fetch(MANIFEST_URL + '?t=' + Date.now(), { cache: 'no-store', credentials: 'omit' });
    if (!response.ok) throw new Error('GitHub respondió ' + response.status);
    var manifest = await response.json();
    if (!validManifest(manifest)) throw new Error('El manifiesto no corresponde a esta aplicación o no tiene un formato válido.');
    lastManifest = manifest;
    return manifest;
  }

  function ensureOverlay() {
    if (overlay) return overlay;
    var style = document.createElement('style');
    style.id = 'aw-update-center-style';
    style.textContent = [
      '#awUpdateOverlay{position:fixed;inset:0;z-index:100500;background:rgba(3,5,12,.78);backdrop-filter:blur(14px);display:grid;place-items:center;padding:16px}',
      '#awUpdateCard{width:min(560px,100%);max-height:min(88vh,760px);overflow:auto;background:var(--panel,#171a29);color:var(--text,#f4f5ff);border:1px solid var(--line,#30354d);border-radius:22px;padding:20px;box-shadow:0 24px 90px #0009}',
      '#awUpdateCard .aw-update-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}',
      '#awUpdateCard h2{margin:0;font-size:21px}#awUpdateCard p{color:var(--muted,#a9aec8);line-height:1.5}',
      '#awUpdateCard .aw-update-box{padding:14px;border-radius:15px;background:var(--panel2,#22263b);border:1px solid var(--line,#30354d);margin:12px 0}',
      '#awUpdateCard .aw-update-version{font-size:28px;font-weight:900;letter-spacing:-1px}',
      '#awUpdateCard .aw-update-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:16px}',
      '#awUpdateCard button{border-radius:12px;padding:11px 14px;font-weight:800}',
      '#awUpdateCard .aw-update-primary{background:linear-gradient(120deg,var(--violet,#a58bff),var(--cyan,#63e8f3));color:#0c1020}',
      '#awUpdateCard .aw-update-muted{background:transparent;border:1px solid var(--line,#30354d);color:inherit}',
      '#awUpdateStatus{font-size:13px;min-height:20px}#awUpdateNotes{white-space:pre-wrap;font-size:13px;color:var(--muted,#a9aec8)}',
      '#awUpdateCenterMenu.has-update:after{content:"";display:inline-block;width:8px;height:8px;border-radius:50%;background:#4ade80;margin-left:8px;vertical-align:middle}'
    ].join('');
    document.head.appendChild(style);
    overlay = document.createElement('div');
    overlay.id = 'awUpdateOverlay';
    overlay.className = 'hidden';
    overlay.innerHTML = '<section id="awUpdateCard" role="dialog" aria-modal="true" aria-labelledby="awUpdateTitle">' +
      '<div class="aw-update-head"><div><div style="font-size:11px;letter-spacing:1.3px;color:var(--muted)">ANIMEWEEK TRACKER</div><h2 id="awUpdateTitle">Centro de actualizaciones</h2></div>' +
      '<button type="button" class="aw-update-muted" id="awUpdateClose" aria-label="Cerrar">✕</button></div>' +
      '<div class="aw-update-box"><div style="font-size:12px;color:var(--muted)">Versión instalada</div><div class="aw-update-version">v' + APP_VERSION + '</div><div id="awUpdateStatus">Consultando GitHub…</div></div>' +
      '<div id="awUpdateResult"></div><div class="aw-update-actions"><button type="button" class="aw-update-primary" id="awUpdateCheck">Buscar actualizaciones</button><button type="button" class="aw-update-muted" id="awUpdateReleases">Ver Releases</button></div>' +
      '<p style="font-size:11px;margin:14px 0 0">Las actualizaciones APK requieren la misma firma digital que la aplicación instalada y confirmación del instalador de Android.</p></section>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (event) { if (event.target === overlay) close(); });
    overlay.querySelector('#awUpdateClose').addEventListener('click', close);
    overlay.querySelector('#awUpdateCheck').addEventListener('click', check);
    overlay.querySelector('#awUpdateReleases').addEventListener('click', function () { window.open(RELEASES_URL, '_blank', 'noopener'); });
    return overlay;
  }

  function open() {
    ensureOverlay().classList.remove('hidden');
    check();
  }

  function close() {
    if (overlay) overlay.classList.add('hidden');
  }

  function setStatus(message, isError) {
    var node = overlay && overlay.querySelector('#awUpdateStatus');
    if (node) {
      node.textContent = message;
      node.style.color = isError ? '#fb7185' : '';
    }
  }

  function renderAvailable(manifest) {
    var target = overlay.querySelector('#awUpdateResult');
    var android = manifest.android || {};
    var hasApk = android.enabled === true && typeof android.apkUrl === 'string' && android.apkUrl.length > 0;
    var notes = escapeHtml(manifest.releaseNotes || 'Esta versión no incluye notas de publicación.');
    var release = escapeHtml(manifest.releaseUrl || RELEASES_URL);
    var html = '<div class="aw-update-box"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><strong>Última versión publicada</strong><span style="padding:4px 8px;border-radius:99px;background:#14532d;color:#bbf7d0;font-size:11px">v' + escapeHtml(manifest.version) + '</span></div>' +
      '<p id="awUpdateNotes">' + notes + '</p>';
    if (hasApk) {
      html += '<div style="font-size:11px;color:var(--muted);word-break:break-all">SHA-256: ' + escapeHtml(android.sha256 || 'No informado') + '</div>' +
        '<div class="aw-update-actions"><button type="button" class="aw-update-primary" id="awUpdateDownload">Descargar APK</button></div>';
    } else {
      html += '<p style="font-size:12px">Todavía no hay un APK publicado y verificado para esta versión. Cuando publiques un Release con el APK, aparecerá aquí.</p>';
    }
    html += '<a href="' + release + '" target="_blank" rel="noopener" style="font-size:12px;color:var(--cyan)">Abrir publicación en GitHub</a></div>';
    target.innerHTML = html;
    if (hasApk) {
      target.querySelector('#awUpdateDownload').addEventListener('click', function () {
        var url = android.apkUrl;
        if (window.AndroidUpdateInstaller && typeof window.AndroidUpdateInstaller.downloadAndInstall === 'function') {
          window.AndroidUpdateInstaller.downloadAndInstall(url, android.sha256 || '', manifest.version);
        } else {
          window.open(url, '_blank', 'noopener');
          setStatus('Se abrió la descarga de GitHub. Android solicitará confirmar la instalación.', false);
        }
      });
    }
  }

  async function check() {
    if (!overlay) return;
    setStatus('Consultando la versión publicada en GitHub…', false);
    var result = overlay.querySelector('#awUpdateResult');
    result.innerHTML = '';
    try {
      var manifest = await fetchManifest();
      var comparison = compareVersions(manifest.version, APP_VERSION);
      var menuButton = document.getElementById('awUpdateCenterMenu');
      if (menuButton) menuButton.classList.toggle('has-update', comparison > 0);
      if (comparison > 0) {
        setStatus('Hay una versión más reciente disponible.', false);
        renderAvailable(manifest);
      } else {
        setStatus('Tienes la versión más reciente publicada (' + manifest.version + ').', false);
        result.innerHTML = '<div class="aw-update-box"><strong>Tu aplicación está actualizada.</strong><p>No hay una versión más nueva que la instalada.</p><a href="' + RELEASES_URL + '" target="_blank" rel="noopener" style="font-size:12px;color:var(--cyan)">Consultar historial de versiones</a></div>';
      }
    } catch (error) {
      setStatus('No se pudo consultar GitHub: ' + (error && error.message ? error.message : 'error de conexión'), true);
      result.innerHTML = '<div class="aw-update-box"><p>Comprueba tu conexión e inténtalo de nuevo.</p><a href="' + RELEASES_URL + '" target="_blank" rel="noopener" style="font-size:12px;color:var(--cyan)">Abrir GitHub Releases</a></div>';
    }
  }

  function bindMenu() {
    var menu = document.getElementById('menuPop');
    if (!menu || document.getElementById('awUpdateCenterMenu')) return;
    var item = document.createElement('button');
    item.type = 'button';
    item.id = 'awUpdateCenterMenu';
    item.textContent = '↻  Centro de actualizaciones';
    var anchor = document.getElementById('menuExport');
    if (anchor && anchor.parentNode === menu) menu.insertBefore(item, anchor);
    else menu.appendChild(item);
    item.addEventListener('click', function () {
      menu.classList.remove('open');
      open();
    });
  }

  var previousBack = window.__awUnifiedBack;
  window.__awUnifiedBack = function (app) {
    if (overlay && !overlay.classList.contains('hidden')) { close(); return; }
    if (typeof previousBack === 'function') return previousBack(app);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindMenu, { once: true });
  else bindMenu();

  window.AnimeWeekUpdateCenter = { open: open, check: check, getCurrentVersion: function () { return APP_VERSION; } };
  window.addEventListener('online', function () { if (overlay && !overlay.classList.contains('hidden')) check(); });
  setTimeout(function () {
    fetchManifest().then(function (manifest) {
      if (compareVersions(manifest.version, APP_VERSION) > 0) {
        var menuButton = document.getElementById('awUpdateCenterMenu');
        if (menuButton) menuButton.classList.add('has-update');
      }
    }).catch(function () {});
  }, 2500);
})();
