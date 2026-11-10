/* AnimeWeek Tracker — GitHub update center, v95.30.0 */
(function installAnimeWeekUpdateCenter() {
  'use strict';
  if (window.__animeWeekUpdateCenterInstalled) return;
  window.__animeWeekUpdateCenterInstalled = true;

  var APP_ID = 'com.animeweek.tracker';
  var APP_VERSION = '95.30.0';
  var OWNER = 'joseluisjr10x-maker';
  var REPO = 'AnimeWeek-Tracker';
  var MANIFEST_URL = 'https://raw.githubusercontent.com/' + OWNER + '/' + REPO + '/main/latest.json';
  var RELEASES_URL = 'https://github.com/' + OWNER + '/' + REPO + '/releases';
  var overlay = null;
  var lastManifest = null;
  var checking = null;

  function currentVersion() {
    try {
      if (window.AndroidUpdateInstaller && typeof window.AndroidUpdateInstaller.getInstalledVersion === 'function') {
        var nativeVersion = window.AndroidUpdateInstaller.getInstalledVersion();
        if (/^\d+\.\d+\.\d+$/.test(String(nativeVersion || ''))) return String(nativeVersion);
      }
    } catch (_) { }
    return APP_VERSION;
  }

  function compareVersions(a, b) {
    var aa = String(a || '0').split(/[.+-]/).slice(0, 3).map(function (v) { return parseInt(v, 10) || 0; });
    var bb = String(b || '0').split(/[.+-]/).slice(0, 3).map(function (v) { return parseInt(v, 10) || 0; });
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

  function validateManifest(data) {
    return !!data && data.appId === APP_ID && /^\d+\.\d+\.\d+$/.test(String(data.version || '')) &&
      (!data.android || !data.android.apkUrl || /^https:\/\/github\.com\//.test(data.android.apkUrl));
  }

  function fetchManifest() {
    if (checking) return checking;
    checking = fetch(MANIFEST_URL + '?v=' + Date.now(), { cache: 'no-store', credentials: 'omit' })
      .then(function (response) {
        if (!response.ok) throw new Error('GitHub respondió HTTP ' + response.status);
        return response.json();
      })
      .then(function (data) {
        if (!validateManifest(data)) throw new Error('El manifiesto de actualizaciones no es válido para esta aplicación.');
        lastManifest = data;
        return data;
      })
      .finally(function () { checking = null; });
    return checking;
  }

  function styleOverlay() {
    if (document.getElementById('aw-update-center-style')) return;
    var style = document.createElement('style');
    style.id = 'aw-update-center-style';
    style.textContent = [
      '#awUpdateOverlay{position:fixed;inset:0;z-index:100500;background:rgba(3,5,12,.78);backdrop-filter:blur(14px);display:grid;place-items:center;padding:16px}',
      '#awUpdateOverlay[hidden]{display:none!important}',
      '#awUpdateCard{width:min(560px,100%);max-height:min(88vh,760px);overflow:auto;background:var(--panel,#171a29);color:var(--text,#f4f5ff);border:1px solid var(--line,#30354d);border-radius:22px;padding:20px;box-shadow:0 24px 90px #0009}',
      '#awUpdateCard .aw-update-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}',
      '#awUpdateCard h2{margin:0;font-size:21px}',
      '#awUpdateCard p{color:var(--muted,#a9aec8);line-height:1.5}',
      '#awUpdateCard .aw-update-box{padding:14px;border-radius:15px;background:var(--panel2,#22263b);border:1px solid var(--line,#30354d);margin:12px 0}',
      '#awUpdateCard .aw-update-version{font-size:28px;font-weight:900;letter-spacing:-1px}',
      '#awUpdateCard .aw-update-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:16px}',
      '#awUpdateCard button{border-radius:12px;padding:11px 14px;font-weight:800}',
      '#awUpdateCard .aw-update-primary{background:var(--accent,linear-gradient(120deg,var(--violet,#a58bff),var(--cyan,#63e8f3)));color:var(--accent-contrast,#0c1020);border:0}',
      '#awUpdateCard .aw-update-muted{background:transparent;border:1px solid var(--line,#30354d);color:inherit}',
      '#awUpdateStatus{font-size:13px;min-height:20px}',
      '#awUpdateNotes{white-space:pre-wrap;font-size:13px;color:var(--muted,#a9aec8)}',
      '#menuUpdateCenter.has-update:after{content:"";display:inline-block;width:8px;height:8px;border-radius:50%;background:#4ade80;margin-left:8px;vertical-align:middle}'
    ].join('');
    document.head.appendChild(style);
  }

  function ensureOverlay() {
    if (overlay) return overlay;
    styleOverlay();
    overlay = document.createElement('div');
    overlay.id = 'awUpdateOverlay';
    overlay.hidden = true;
    overlay.innerHTML = '<section id="awUpdateCard" role="dialog" aria-modal="true" aria-labelledby="awUpdateTitle">' +
      '<div class="aw-update-head"><div><div style="font-size:11px;letter-spacing:1.3px;color:var(--muted)">ANIMEWEEK TRACKER</div><h2 id="awUpdateTitle">Centro de actualizaciones</h2></div>' +
      '<button type="button" class="aw-update-muted" id="awUpdateClose" aria-label="Cerrar">✕</button></div>' +
      '<div class="aw-update-box"><div style="font-size:12px;color:var(--muted)">Versión instalada</div><div class="aw-update-version">v' + APP_VERSION + '</div><div id="awUpdateStatus" role="status" aria-live="polite">Listo para consultar GitHub.</div></div>' +
      '<div id="awUpdateResult"></div><div class="aw-update-actions"><button type="button" class="aw-update-primary" id="awUpdateCheck">Buscar actualizaciones</button><button type="button" class="aw-update-muted" id="awUpdateReleases">Ver Releases</button></div>' +
      '<p style="font-size:11px;margin:14px 0 0">La APK se verifica antes de abrir el instalador. Android siempre solicita tu confirmación y requiere que el certificado coincida con el de la aplicación instalada.</p></section>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function (event) { if (event.target === overlay) close(); });
    overlay.querySelector('#awUpdateClose').addEventListener('click', close);
    overlay.querySelector('#awUpdateCheck').addEventListener('click', function () { check(true); });
    overlay.querySelector('#awUpdateReleases').addEventListener('click', function () { window.open(RELEASES_URL, '_blank', 'noopener'); });
    return overlay;
  }

  function open() {
    ensureOverlay().hidden = false;
    check(false).catch(function () {});
  }

  function close() {
    if (overlay) overlay.hidden = true;
  }

  function setStatus(message, isError) {
    var status = overlay && overlay.querySelector('#awUpdateStatus');
    if (!status) return;
    status.textContent = message;
    status.style.color = isError ? '#fb7185' : '';
  }

  function renderManifest(data) {
    var target = overlay.querySelector('#awUpdateResult');
    var android = data.android || {};
    var apkReady = android.enabled === true && typeof android.apkUrl === 'string' &&
      /^https:\/\/github\.com\//.test(android.apkUrl) && /^[a-fA-F0-9]{64}$/.test(String(android.sha256 || ''));
    var html = '<div class="aw-update-box"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><strong>Última versión publicada</strong><span style="padding:4px 8px;border-radius:99px;background:#14532d;color:#bbf7d0;font-size:11px">v' + escapeHtml(data.version) + '</span></div>' +
      '<p id="awUpdateNotes">' + escapeHtml(data.releaseNotes || 'Esta publicación no incluye notas.') + '</p>';
    if (apkReady) {
      html += '<div style="font-size:11px;color:var(--muted);word-break:break-all">SHA-256: ' + escapeHtml(android.sha256) + '</div>' +
        '<div class="aw-update-actions"><button type="button" class="aw-update-primary" id="awUpdateDownload">Descargar e instalar APK</button></div>';
    } else {
      html += '<p style="font-size:12px">La publicación ya está registrada, pero todavía no hay una APK verificada para instalación automática.</p>';
    }
    var releaseUrl = /^https:\/\/github\.com\//.test(String(data.releaseUrl || '')) ? data.releaseUrl : RELEASES_URL;
    html += '<a href="' + escapeHtml(releaseUrl) + '" target="_blank" rel="noopener" style="font-size:12px;color:var(--cyan)">Abrir publicación en GitHub</a></div>';
    target.innerHTML = html;
    if (apkReady) {
      target.querySelector('#awUpdateDownload').addEventListener('click', function () {
        if (window.AndroidUpdateInstaller && typeof window.AndroidUpdateInstaller.downloadAndInstall === 'function') {
          setStatus('Solicitando la descarga segura a Android…', false);
          window.AndroidUpdateInstaller.downloadAndInstall(android.apkUrl, android.sha256, data.version);
        } else {
          setStatus('Este dispositivo no tiene el instalador nativo integrado. Abre GitHub Releases para consultar la publicación.', true);
          window.open(releaseUrl, '_blank', 'noopener');
        }
      });
    }
  }

  function check(manual) {
    ensureOverlay();
    if (manual) setStatus('Consultando la versión publicada en GitHub…', false);
    var result = overlay.querySelector('#awUpdateResult');
    if (manual) result.innerHTML = '';
    return fetchManifest().then(function (data) {
      var comparison = compareVersions(data.version, currentVersion());
      var menuItem = document.getElementById('menuUpdateCenter');
      if (menuItem) menuItem.classList.toggle('has-update', comparison > 0);
      if (comparison > 0) {
        setStatus('Hay una versión más reciente disponible.', false);
        renderManifest(data);
      } else if (comparison === 0) {
        setStatus('Tienes la versión más reciente publicada (' + data.version + ').', false);
        result.innerHTML = '<div class="aw-update-box"><strong>AnimeWeek Tracker está actualizado.</strong><p>No hay una versión más nueva que la instalada.</p><a href="' + RELEASES_URL + '" target="_blank" rel="noopener" style="font-size:12px;color:var(--cyan)">Consultar historial de versiones</a></div>';
      } else {
        setStatus('GitHub tiene un manifiesto de una versión anterior (' + data.version + ').', true);
        result.innerHTML = '<div class="aw-update-box"><p>La publicación de GitHub es anterior a esta instalación. No se instalará una versión más antigua.</p></div>';
      }
      return data;
    }).catch(function (error) {
      setStatus('No se pudo consultar GitHub: ' + (error && error.message ? error.message : 'error de conexión'), true);
      if (manual) result.innerHTML = '<div class="aw-update-box"><p>Comprueba tu conexión e inténtalo de nuevo.</p><a href="' + RELEASES_URL + '" target="_blank" rel="noopener" style="font-size:12px;color:var(--cyan)">Abrir GitHub Releases</a></div>';
      return null;
    });
  }

  function bindMenu() {
    var menu = document.getElementById('menuPop');
    if (!menu || document.getElementById('menuUpdateCenter')) return;
    var button = document.createElement('button');
    button.type = 'button';
    button.id = 'menuUpdateCenter';
    button.textContent = '↻  Centro de actualizaciones';
    var insertAfter = document.getElementById('menuExport');
    if (insertAfter && insertAfter.parentNode === menu) insertAfter.insertAdjacentElement('afterend', button);
    else menu.appendChild(button);
    button.addEventListener('click', function () {
      menu.classList.remove('open');
      open();
    });
  }

  window.__awUpdateNativeStatus = function (status, message) {
    setStatus(message || status || 'Actualizador Android', status === 'error');
  };

  var priorBackHandler = window.__awUnifiedBack;
  window.__awUnifiedBack = function (app) {
    if (overlay && !overlay.hidden) { close(); return; }
    if (typeof priorBackHandler === 'function') return priorBackHandler(app);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindMenu, { once: true });
  else bindMenu();

  window.AnimeWeekUpdateCenter = {
    open: open,
    close: close,
    check: function () { return check(true); },
    getCurrentVersion: function () { return currentVersion(); }
  };

  window.addEventListener('online', function () {
    if (overlay && !overlay.hidden) check(false).catch(function () {});
  });
  window.addEventListener('load', function () {
    window.setTimeout(function () {
      fetchManifest().then(function (data) {
        var item = document.getElementById('menuUpdateCenter');
        if (item) item.classList.toggle('has-update', compareVersions(data.version, currentVersion()) > 0);
      }).catch(function () {});
    }, 2500);
  }, { once: true });
})();
