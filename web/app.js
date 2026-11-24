/* ============================================================================
 * NillyView Pro — Ultra-Light 62-Format Image, Camera RAW, SVG & PSD Studio
 * created by Nilly graphics (Sotiris Christos) — https://nillygraphics.com/
 * Zero external libraries · Native Desktop WIC Bridge + Standalone Mobile PWA
 * ============================================================================ */

(function () {
  'use strict';

  const LS_THEME = 'nillyview_theme';
  const urlParams = new URLSearchParams(window.location.search);
  const DESKTOP_MODE = urlParams.get('desktop') === '1';
  const SESSION_TOKEN = urlParams.get('t') || '';

  // ==========================================================================
  // STATE
  // ==========================================================================
  const state = {
    // Folder / Gallery items
    items: [],           // Desktop: [{ i, name, ext, size }] | Web: [{ i, name, ext, size, url, file }]
    currentIdx: -1,
    folder: '',
    meta: null,
    decodeTier: '',

    // Active editable bitmap buffer (offscreen canvas holds current committed image!)
    baseCanvas: document.createElement('canvas'),
    origCanvas: document.createElement('canvas'), // pristine loaded image for Reset
    undoStack: [],       // ImageData / offscreen snapshots (up to 20)
    redoStack: [],
    hasEdits: false,

    // Live color adjustments (non-destructive until export/commit!)
    adj: { bright: 100, contrast: 100, sat: 100, gray: false },

    // Viewport transform
    zoom: 1,
    fitMode: true,
    panX: 0,
    panY: 0,
    backdropIdx: 0,      // 0=dark, 1=checker, 2=light, 3=black

    // Edit & Tool state
    editOpen: false,
    tool: 'pan',         // pan | crop | eyedropper | arrow | rect | pen | text | blur
    color: '#EF4444',
    brushSize: 6,
    cropRatio: 0,        // 0 = free
    cropRect: null,      // { x, y, w, h } in image pixel coords

    // Pointer interaction
    pointerDown: false,
    startClient: null,
    startPan: null,
    startImgPt: null,
    penPts: [],
    draftShape: null,
    pendingTextPt: null,

    // Export modal state
    expFmt: 'webp',
    expSize: 'original',
    expQual: 88,

    // Slideshow & Prefetch cache
    slideshowTimer: null,
    prefetchMap: new Map() // idx -> { blobUrl, tier }
  };

  // ==========================================================================
  // DOM REFERENCES
  // ==========================================================================
  const $ = (id) => document.getElementById(id);
  const el = {
    btnToggleFilmstrip: $('btnToggleFilmstrip'),
    imgFileName: $('imgFileName'),
    imgQuickSpec: $('imgQuickSpec'),
    navControls: $('navControls'),
    folderNavGroup: $('folderNavGroup'),
    btnPrevImg: $('btnPrevImg'),
    lblImgPos: $('lblImgPos'),
    btnNextImg: $('btnNextImg'),
    btnZoomOut: $('btnZoomOut'),
    lblZoom: $('lblZoom'),
    btnZoomIn: $('btnZoomIn'),
    btnZoom100: $('btnZoom100'),
    btnZoomFit: $('btnZoomFit'),

    btnOpenImg: $('btnOpenImg'),
    btnToggleEdit: $('btnToggleEdit'),
    btnBackdrop: $('btnBackdrop'),
    btnToggleInfo: $('btnToggleInfo'),
    moreMenuWrap: $('moreMenuWrap'),
    btnMoreMenu: $('btnMoreMenu'),
    moreMenu: $('moreMenu'),
    btnCopyImg: $('btnCopyImg'),
    btnQuickRotR: $('btnQuickRotR'),
    btnQuickRotL: $('btnQuickRotL'),
    btnSlideshow: $('btnSlideshow'),
    btnFullscreen: $('btnFullscreen'),
    btnPrintImg: $('btnPrintImg'),
    btnRevealExplorer: $('btnRevealExplorer'),
    btnDeleteRecycle: $('btnDeleteRecycle'),
    btnSaveOpen: $('btnSaveOpen'),
    btnThemeToggle: $('btnThemeToggle'),

    editStrip: $('editStrip'),
    inkPalette: $('inkPalette'),
    selBrushSize: $('selBrushSize'),
    btnRotLeft: $('btnRotLeft'),
    btnRotRight: $('btnRotRight'),
    btnFlipH: $('btnFlipH'),
    btnFlipV: $('btnFlipV'),
    btnAdjustToggle: $('btnAdjustToggle'),
    btnUndo: $('btnUndo'),
    btnRedo: $('btnRedo'),
    btnResetEdits: $('btnResetEdits'),

    cropBar: $('cropBar'),
    cropRatioRow: $('cropRatioRow'),
    lblCropDims: $('lblCropDims'),
    btnApplyCrop: $('btnApplyCrop'),
    btnCancelCrop: $('btnCancelCrop'),

    adjustBar: $('adjustBar'),
    rngBright: $('rngBright'),
    valBright: $('valBright'),
    rngContrast: $('rngContrast'),
    valContrast: $('valContrast'),
    rngSat: $('rngSat'),
    valSat: $('valSat'),
    btnGrayToggle: $('btnGrayToggle'),
    btnResetAdjust: $('btnResetAdjust'),

    dropTarget: $('dropTarget'),
    deskViewport: $('deskViewport'),
    emptyState: $('emptyState'),
    btnEmptyOpen: $('btnEmptyOpen'),
    btnEmptyPaste: $('btnEmptyPaste'),
    btnEdgePrev: $('btnEdgePrev'),
    btnEdgeNext: $('btnEdgeNext'),
    stageWrap: $('stageWrap'),
    imgStage: $('imgStage'),
    viewCanvas: $('viewCanvas'),
    overlayCanvas: $('overlayCanvas'),
    loadingBadge: $('loadingBadge'),

    colorPill: $('colorPill'),
    colorSwatch: $('colorSwatch'),
    colorHex: $('colorHex'),
    colorRgb: $('colorRgb'),
    colorCmyk: $('colorCmyk'),

    infoRail: $('infoRail'),
    btnCloseInfo: $('btnCloseInfo'),
    histCanvas: $('histCanvas'),
    infoGrid: $('infoGrid'),

    filmstrip: $('filmstrip'),
    filmstripTrack: $('filmstripTrack'),
    statusText: $('statusText'),
    fileOpenInput: $('fileOpenInput'),

    modalExport: $('modalExport'),
    lblExportMeta: $('lblExportMeta'),
    inpExportName: $('inpExportName'),
    expFmtRow: $('expFmtRow'),
    expSizeGrid: $('expSizeGrid'),
    inpExpW: $('inpExpW'),
    inpExpH: $('inpExpH'),
    expQualWrap: $('expQualWrap'),
    lblExpQual: $('lblExpQual'),
    rngExpQual: $('rngExpQual'),
    btnSaveDirectDesktop: $('btnSaveDirectDesktop'),
    btnConfirmExport: $('btnConfirmExport'),

    modalText: $('modalText'),
    txtOverlayInput: $('txtOverlayInput'),
    chkTextBackdrop: $('chkTextBackdrop'),
    btnCommitText: $('btnCommitText'),
    toast: $('toast')
  };

  // ==========================================================================
  // UTILITIES
  // ==========================================================================
  let toastTimer = null;
  function showToast(msg, ms = 2500) {
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), ms);
  }

  function setStatus(msg) {
    if (el.statusText) el.statusText.textContent = msg;
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function formatBytes(b) {
    if (!b || b < 0) return '0 B';
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(2) + ' MB';
  }

  function gcd(a, b) {
    return b === 0 ? a : gcd(b, a % b);
  }

  function formatAspect(w, h) {
    if (!w || !h) return '—';
    const g = gcd(w, h);
    const rw = Math.round(w / g), rh = Math.round(h / g);
    if (rw <= 24 && rh <= 24) return `${rw}:${rh}`;
    return (w / h).toFixed(2) + ':1';
  }

  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase();
  }

  function rgbToCmyk(r, g, b) {
    const rn = r / 255, gn = g / 255, bn = b / 255;
    const k = 1 - Math.max(rn, gn, bn);
    if (k >= 0.999) return '0, 0, 0, 100';
    const c = Math.round(((1 - rn - k) / (1 - k)) * 100);
    const m = Math.round(((1 - gn - k) / (1 - k)) * 100);
    const y = Math.round(((1 - bn - k) / (1 - k)) * 100);
    return `${c}, ${m}, ${y}, ${Math.round(k * 100)}`;
  }

  function applyTheme(theme) {
    const t = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', t);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'light' ? '#FFFFFF' : '#16171A');
    try { localStorage.setItem(LS_THEME, t); } catch (_) {}
  }

  function applyBackdrop(idx) {
    state.backdropIdx = idx % 4;
    const cls = ['backdrop-dark', 'backdrop-checker', 'backdrop-light', 'backdrop-black'];
    el.deskViewport.classList.remove(...cls);
    el.deskViewport.classList.add(cls[state.backdropIdx]);
  }

  function getFilterString() {
    const { bright, contrast, sat, gray } = state.adj;
    const parts = [];
    if (bright !== 100) parts.push(`brightness(${bright}%)`);
    if (contrast !== 100) parts.push(`contrast(${contrast}%)`);
    if (sat !== 100) parts.push(`saturate(${sat}%)`);
    if (gray) parts.push('grayscale(100%)');
    return parts.length ? parts.join(' ') : 'none';
  }

  function cloneCanvas(src) {
    const c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    c.getContext('2d').drawImage(src, 0, 0);
    return c;
  }

  function pushUndoSnapshot() {
    state.undoStack.push(cloneCanvas(state.baseCanvas));
    if (state.undoStack.length > 18) state.undoStack.shift();
    state.redoStack = [];
    state.hasEdits = true;
    updateUndoUI();
  }

  function updateUndoUI() {
    el.btnUndo.style.opacity = state.undoStack.length ? '1' : '0.35';
    el.btnRedo.style.opacity = state.redoStack.length ? '1' : '0.35';
  }

  // ==========================================================================
  // LOADING IMAGES (DESKTOP 62-FORMAT BRIDGE + STANDALONE WEB PWA)
  // ==========================================================================
  function loadImgElement(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  async function fetchDesktopImageUrl(idx) {
    if (state.prefetchMap.has(idx)) return state.prefetchMap.get(idx);
    const resp = await fetch(`/api/img?t=${encodeURIComponent(SESSION_TOKEN)}&i=${idx}`);
    if (!resp.ok) throw new Error(await resp.text());
    const tier = resp.headers.get('X-Decode-Tier') || '';
    const blob = await resp.blob();
    const blobUrl = URL.createObjectURL(blob);
    const entry = { blobUrl, tier };
    state.prefetchMap.set(idx, entry);
    // Keep prefetch cache tiny (only last 4 images) so RAM stays ultra-lean!
    if (state.prefetchMap.size > 5) {
      const firstKey = state.prefetchMap.keys().next().value;
      if (firstKey !== idx) {
        URL.revokeObjectURL(state.prefetchMap.get(firstKey).blobUrl);
        state.prefetchMap.delete(firstKey);
      }
    }
    return entry;
  }

  function prefetchNeighbor(idx) {
    if (!DESKTOP_MODE || idx < 0 || idx >= state.items.length || state.prefetchMap.has(idx)) return;
    fetchDesktopImageUrl(idx).catch(() => {});
  }

  async function showItemAt(idx) {
    if (!state.items.length || idx < 0 || idx >= state.items.length) return;
    state.currentIdx = idx;
    const item = state.items[idx];

    el.emptyState.hidden = true;
    el.stageWrap.hidden = false;
    el.navControls.hidden = false;
    el.btnToggleEdit.hidden = false;
    el.btnBackdrop.hidden = false;
    el.btnToggleInfo.hidden = false;
    el.moreMenuWrap.hidden = false;
    el.btnSaveOpen.hidden = false;

    const multi = state.items.length > 1;
    el.folderNavGroup.hidden = !multi;
    el.btnEdgePrev.hidden = !multi;
    el.btnEdgeNext.hidden = !multi;
    el.lblImgPos.textContent = `${idx + 1} / ${state.items.length}`;

    el.imgFileName.textContent = item.name;
    el.imgFileName.title = item.name;
    document.title = `${item.name} — NillyView Pro`;

    // Reset per-image edit buffer
    state.undoStack = [];
    state.redoStack = [];
    state.hasEdits = false;
    state.cropRect = null;
    state.adj = { bright: 100, contrast: 100, sat: 100, gray: false };
    syncAdjustSliders();
    updateUndoUI();

    el.loadingBadge.hidden = false;
    setStatus(`Φόρτωση ${item.name}…`);

    try {
      let srcUrl = item.url;
      state.decodeTier = 'Web';
      if (DESKTOP_MODE && SESSION_TOKEN) {
        const fetched = await fetchDesktopImageUrl(idx);
        srcUrl = fetched.blobUrl;
        state.decodeTier = fetched.tier;
      }

      const img = await loadImgElement(srcUrl);
      // For SVG files with missing natural dimensions, pick crisp 1200px default
      const natW = img.naturalWidth || 1200;
      const natH = img.naturalHeight || 900;

      state.baseCanvas.width = natW;
      state.baseCanvas.height = natH;
      const bctx = state.baseCanvas.getContext('2d');
      bctx.clearRect(0, 0, natW, natH);
      bctx.drawImage(img, 0, 0, natW, natH);

      state.origCanvas.width = natW;
      state.origCanvas.height = natH;
      state.origCanvas.getContext('2d').drawImage(state.baseCanvas, 0, 0);

      // Auto-enable checkerboard backdrop for transparent SVG/PNG/ICO if user is on default dark? Keep user choice, or show crisp canvas!
      state.fitMode = true;
      state.panX = 0;
      state.panY = 0;
      renderStage(true);
      updateQuickSpecAndStatus();
      updateFilmstripActive();

      // Load EXIF metadata + histogram asynchronously (non-blocking!)
      if (DESKTOP_MODE && SESSION_TOKEN) {
        fetch(`/api/meta?t=${encodeURIComponent(SESSION_TOKEN)}&i=${idx}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((meta) => {
            if (state.currentIdx === idx) {
              state.meta = meta;
              if (!el.infoRail.hidden) renderInfoPanel();
            }
          })
          .catch(() => {});
        // Background pre-fetch next & prev image for 0 ms instant browsing!
        setTimeout(() => {
          prefetchNeighbor(idx + 1);
          prefetchNeighbor(idx - 1);
        }, 120);
      } else {
        state.meta = {
          name: item.name,
          ext: item.ext,
          size: item.size,
          width: natW,
          height: natH,
          dpiX: 96,
          dpiY: 96
        };
        if (!el.infoRail.hidden) renderInfoPanel();
      }
    } catch (err) {
      console.error('Image load error:', err);
      showToast(`Αδυναμία εμφάνισης: ${item.name}`);
      setStatus(`Σφάλμα φόρτωσης (${item.name})`);
    } finally {
      el.loadingBadge.hidden = true;
    }
  }

  function updateQuickSpecAndStatus() {
    const item = state.items[state.currentIdx];
    if (!item) return;
    const w = state.baseCanvas.width, h = state.baseCanvas.height;
    const mp = ((w * h) / 1000000).toFixed(1);
    const sz = item.size ? formatBytes(item.size) : '';
    const spec = `${w} × ${h} px${sz ? ' · ' + sz : ''} · ${item.ext}`;
    el.imgQuickSpec.textContent = spec;
    el.imgQuickSpec.hidden = false;
    const tierTxt = state.decodeTier ? ` · ${state.decodeTier}` : '';
    setStatus(`${item.name} · ${w}×${h} px (${mp} MP · ${formatAspect(w, h)})${sz ? ' · ' + sz : ''}${tierTxt}`);
  }

  // ==========================================================================
  // CANVAS RENDERING, ZOOM & PAN
  // ==========================================================================
  function renderStage(recalcFit = false) {
    const w = state.baseCanvas.width, h = state.baseCanvas.height;
    if (!w || !h) return;

    el.viewCanvas.width = w;
    el.viewCanvas.height = h;
    el.overlayCanvas.width = w;
    el.overlayCanvas.height = h;

    const ctx = el.viewCanvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    ctx.filter = getFilterString();
    ctx.drawImage(state.baseCanvas, 0, 0);
    ctx.filter = 'none';

    if (state.fitMode || recalcFit) {
      const pad = window.innerWidth <= 820 ? 18 : 44;
      const availW = Math.max(200, el.deskViewport.clientWidth - pad);
      const availH = Math.max(200, el.deskViewport.clientHeight - pad);
      state.zoom = Math.min(availW / w, availH / h, 1.0);
      if (w < 300 && h < 300) {
        // Small icons/SVGs fit nicely up to 2x so they aren't microscopic
        state.zoom = Math.min(availW / w, availH / h, 2.0);
      }
      state.panX = 0;
      state.panY = 0;
    }

    applyStageTransform();
    drawOverlay();
    if (!el.infoRail.hidden) drawHistogram();
  }

  function applyStageTransform() {
    const w = state.baseCanvas.width, h = state.baseCanvas.height;
    if (!w || !h) return;
    const dispW = Math.max(1, Math.round(w * state.zoom));
    const dispH = Math.max(1, Math.round(h * state.zoom));
    el.imgStage.style.width = dispW + 'px';
    el.imgStage.style.height = dispH + 'px';
    el.viewCanvas.style.width = dispW + 'px';
    el.viewCanvas.style.height = dispH + 'px';
    el.imgStage.style.transform = `translate(${Math.round(state.panX)}px, ${Math.round(state.panY)}px)`;
    el.viewCanvas.classList.toggle('pixelated', state.zoom >= 2.5);
    el.lblZoom.textContent = state.fitMode ? 'Fit' : Math.round(state.zoom * 100) + '%';
  }

  function setZoom(newZoom, fit = false) {
    state.fitMode = fit;
    if (fit) {
      renderStage(true);
    } else {
      state.zoom = clamp(newZoom, 0.08, 12.0);
      applyStageTransform();
    }
  }

  // ==========================================================================
  // FILMSTRIP THUMBNAILS
  // ==========================================================================
  function buildFilmstrip() {
    el.filmstripTrack.innerHTML = '';
    const limit = Math.min(state.items.length, 250);
    for (let i = 0; i < limit; i++) {
      const it = state.items[i];
      const btn = document.createElement('button');
      btn.className = 'film-item' + (i === state.currentIdx ? ' active' : '');
      btn.dataset.idx = String(i);
      btn.title = it.name;
      const src = DESKTOP_MODE && SESSION_TOKEN
        ? `/api/thumb?t=${encodeURIComponent(SESSION_TOKEN)}&i=${i}`
        : it.url;
      btn.innerHTML = `<img loading="lazy" src="${src}" alt="" /><span class="film-ext">${it.ext}</span>`;
      btn.addEventListener('click', () => showItemAt(i));
      el.filmstripTrack.appendChild(btn);
    }
  }

  function updateFilmstripActive() {
    if (el.filmstrip.hidden) return;
    const nodes = el.filmstripTrack.querySelectorAll('.film-item');
    nodes.forEach((n) => {
      const active = Number(n.dataset.idx) === state.currentIdx;
      n.classList.toggle('active', active);
      if (active) n.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    });
  }

  // ==========================================================================
  // PREPRESS & EXIF INSPECTOR + RGB HISTOGRAM
  // ==========================================================================
  function renderInfoPanel() {
    const w = state.baseCanvas.width, h = state.baseCanvas.height;
    const m = state.meta || {};
    const dpi = m.dpiX && m.dpiX > 1 ? m.dpiX : 300;
    const mmW = (w / 300) * 25.4;
    const mmH = (h / 300) * 25.4;
    const mp = ((w * h) / 1000000).toFixed(2);

    const rows = [
      ['Αρχείο', m.name || (state.items[state.currentIdx]?.name || '—')],
      ['Μορφή', (m.ext || '—') + (state.decodeTier ? ` (${state.decodeTier})` : '')],
      ['Διαστάσεις (px)', `${w} × ${h} px (${mp} MP)`],
      ['Αναλογία', formatAspect(w, h)],
      ['Εκτύπωση @ 300 DPI', `${mmW.toFixed(1)} × ${mmH.toFixed(1)} mm (${(mmW / 10).toFixed(1)} × ${(mmH / 10).toFixed(1)} cm)`],
      ['Μέγεθος δίσκου', formatBytes(m.size || 0)]
    ];
    if (m.pixelFormat) rows.push(['Χρωματικός χώρος', m.pixelFormat]);
    if (m.dpiX && m.dpiX !== 96) rows.push(['Ενσωματωμένο DPI', `${m.dpiX} × ${m.dpiY} DPI`]);
    if (m.cameraMake || m.cameraModel) rows.push(['Κάμερα', `${m.cameraMake || ''} ${m.cameraModel || ''}`.trim()]);
    if (m.lens) rows.push(['Φακός', m.lens]);
    const expParts = [m.focal, m.aperture, m.shutter, m.iso ? 'ISO ' + m.iso : ''].filter(Boolean);
    if (expParts.length) rows.push(['Έκθεση (EXIF)', expParts.join(' · ')]);
    if (m.dateTaken) rows.push(['Ημ. λήψης', m.dateTaken]);
    if (m.mtime) rows.push(['Τροποποίηση', m.mtime]);

    el.infoGrid.innerHTML = rows.map(([k, v]) => `<div class="info-row"><span>${k}</span><strong>${escapeHtml(v)}</strong></div>`).join('');
    drawHistogram();
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function drawHistogram() {
    const cv = el.histCanvas;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    const w = state.baseCanvas.width, h = state.baseCanvas.height;
    if (!w || !h) return;

    // Sample down to <= 240px for sub-3ms real-time histogram!
    const s = Math.min(1, 240 / Math.max(w, h));
    const sw = Math.max(1, Math.round(w * s)), sh = Math.max(1, Math.round(h * s));
    const tmp = document.createElement('canvas');
    tmp.width = sw; tmp.height = sh;
    const tctx = tmp.getContext('2d');
    tctx.filter = getFilterString();
    tctx.drawImage(state.baseCanvas, 0, 0, sw, sh);
    const data = tctx.getImageData(0, 0, sw, sh).data;

    const rB = new Uint32Array(64), gB = new Uint32Array(64), bB = new Uint32Array(64);
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 16) continue;
      rB[data[i] >> 2]++;
      gB[data[i + 1] >> 2]++;
      bB[data[i + 2] >> 2]++;
    }
    let peak = 1;
    for (let i = 0; i < 64; i++) peak = Math.max(peak, rB[i], gB[i], bB[i]);

    const drawChan = (bins, fill) => {
      ctx.fillStyle = fill;
      const bw = cv.width / 64;
      for (let i = 0; i < 64; i++) {
        const bh = (bins[i] / peak) * (cv.height - 4);
        ctx.fillRect(i * bw, cv.height - bh, bw + 0.5, bh);
      }
    };
    ctx.globalCompositeOperation = 'lighter';
    drawChan(rB, 'rgba(239, 68, 68, 0.55)');
    drawChan(gB, 'rgba(16, 185, 129, 0.55)');
    drawChan(bB, 'rgba(59, 130, 246, 0.60)');
    ctx.globalCompositeOperation = 'source-over';
  }

  // ==========================================================================
  // QUICK EDITING (ROTATE, FLIP, CROP, BLUR, ARROW, RECT, PEN, TEXT, EYEDROPPER)
  // ==========================================================================
  function setTool(t) {
    state.tool = t;
    el.editStrip.querySelectorAll('.tool-btn').forEach((b) => b.classList.toggle('active', b.dataset.tool === t));
    el.cropBar.hidden = t !== 'crop';
    el.colorPill.hidden = t !== 'eyedropper';

    el.overlayCanvas.classList.remove('pan-cursor', 'cross-cursor');
    if (t === 'pan') el.overlayCanvas.classList.add('pan-cursor');
    else el.overlayCanvas.classList.add('cross-cursor');

    if (t === 'crop') {
      const w = state.baseCanvas.width, h = state.baseCanvas.height;
      state.cropRect = { x: Math.round(w * 0.1), y: Math.round(h * 0.1), w: Math.round(w * 0.8), h: Math.round(h * 0.8) };
      enforceCropAspect();
    } else {
      state.cropRect = null;
    }
    drawOverlay();
  }

  function enforceCropAspect() {
    if (!state.cropRect || !state.cropRatio) { updateCropLabel(); return; }
    const w = state.baseCanvas.width, h = state.baseCanvas.height;
    let cw = state.cropRect.w;
    let ch = Math.round(cw / state.cropRatio);
    if (state.cropRect.y + ch > h) {
      ch = h - state.cropRect.y;
      cw = Math.round(ch * state.cropRatio);
    }
    state.cropRect.w = clamp(cw, 16, w - state.cropRect.x);
    state.cropRect.h = clamp(ch, 16, h - state.cropRect.y);
    updateCropLabel();
  }

  function updateCropLabel() {
    if (!state.cropRect) { el.lblCropDims.textContent = ''; return; }
    el.lblCropDims.textContent = `${Math.round(state.cropRect.w)} × ${Math.round(state.cropRect.h)} px`;
  }

  function applyCrop() {
    if (!state.cropRect) return;
    const { x, y, w, h } = state.cropRect;
    const cw = Math.max(8, Math.round(w)), ch = Math.max(8, Math.round(h));
    const cx = clamp(Math.round(x), 0, state.baseCanvas.width - cw);
    const cy = clamp(Math.round(y), 0, state.baseCanvas.height - ch);
    pushUndoSnapshot();
    const cut = document.createElement('canvas');
    cut.width = cw; cut.height = ch;
    cut.getContext('2d').drawImage(state.baseCanvas, cx, cy, cw, ch, 0, 0, cw, ch);
    state.baseCanvas.width = cw;
    state.baseCanvas.height = ch;
    state.baseCanvas.getContext('2d').drawImage(cut, 0, 0);
    setTool('pan');
    renderStage(true);
    updateQuickSpecAndStatus();
    showToast(`Περικοπή: ${cw} × ${ch} px`);
  }

  function transformImage(kind) {
    const w = state.baseCanvas.width, h = state.baseCanvas.height;
    if (!w || !h) return;
    pushUndoSnapshot();
    const tmp = document.createElement('canvas');
    const rot90 = kind === 'rotR' || kind === 'rotL';
    tmp.width = rot90 ? h : w;
    tmp.height = rot90 ? w : h;
    const ctx = tmp.getContext('2d');
    ctx.translate(tmp.width / 2, tmp.height / 2);
    if (kind === 'rotR') ctx.rotate(Math.PI / 2);
    else if (kind === 'rotL') ctx.rotate(-Math.PI / 2);
    else if (kind === 'flipH') ctx.scale(-1, 1);
    else if (kind === 'flipV') ctx.scale(1, -1);
    ctx.drawImage(state.baseCanvas, -w / 2, -h / 2);

    state.baseCanvas.width = tmp.width;
    state.baseCanvas.height = tmp.height;
    state.baseCanvas.getContext('2d').drawImage(tmp, 0, 0);
    renderStage(true);
    updateQuickSpecAndStatus();
  }

  function applyMosaicBlur(rect) {
    const w = state.baseCanvas.width, h = state.baseCanvas.height;
    const rx = clamp(Math.round(Math.min(rect.x, rect.x + rect.w)), 0, w - 1);
    const ry = clamp(Math.round(Math.min(rect.y, rect.y + rect.h)), 0, h - 1);
    const rw = clamp(Math.round(Math.abs(rect.w)), 4, w - rx);
    const rh = clamp(Math.round(Math.abs(rect.h)), 4, h - ry);
    if (rw < 4 || rh < 4) return;

    pushUndoSnapshot();
    const block = Math.max(8, Math.round(Math.max(w, h) / 75));
    const sw = Math.max(1, Math.round(rw / block));
    const sh = Math.max(1, Math.round(rh / block));
    const tiny = document.createElement('canvas');
    tiny.width = sw; tiny.height = sh;
    tiny.getContext('2d').drawImage(state.baseCanvas, rx, ry, rw, rh, 0, 0, sw, sh);

    const bctx = state.baseCanvas.getContext('2d');
    bctx.save();
    bctx.imageSmoothingEnabled = false;
    bctx.drawImage(tiny, 0, 0, sw, sh, rx, ry, rw, rh);
    bctx.restore();
    renderStage(false);
  }

  function drawOverlay() {
    const cv = el.overlayCanvas;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (!cv.width || !cv.height) return;
    const invZoom = 1 / Math.max(0.15, state.zoom);

    // Draw Crop dimming & rule-of-thirds grid
    if (state.tool === 'crop' && state.cropRect) {
      const r = state.cropRect;
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.56)';
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.clearRect(r.x, r.y, r.w, r.h);

      // Rule of thirds lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = Math.max(1, invZoom);
      for (let k = 1; k <= 2; k++) {
        ctx.beginPath();
        ctx.moveTo(r.x + (r.w * k) / 3, r.y); ctx.lineTo(r.x + (r.w * k) / 3, r.y + r.h);
        ctx.moveTo(r.x, r.y + (r.h * k) / 3); ctx.lineTo(r.x + r.w, r.y + (r.h * k) / 3);
        ctx.stroke();
      }
      ctx.strokeStyle = '#3B82F6';
      ctx.lineWidth = Math.max(2, 2.2 * invZoom);
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.restore();
      updateCropLabel();
    }

    // Draw active drag draft shape (arrow / rect / pen / blur preview)
    if (state.draftShape) {
      drawShapeOnContext(ctx, state.draftShape, invZoom);
    }
  }

  function drawShapeOnContext(ctx, s, scaleRef = 1) {
    const lw = Math.max(2, s.size * Math.max(1, state.baseCanvas.width / 900));
    ctx.save();
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (s.type === 'rect') {
      ctx.strokeRect(s.x, s.y, s.w, s.h);
    } else if (s.type === 'blur') {
      ctx.strokeStyle = '#3B82F6';
      ctx.fillStyle = 'rgba(37, 99, 235, 0.16)';
      ctx.setLineDash([6 * scaleRef, 4 * scaleRef]);
      ctx.lineWidth = Math.max(2, 2 * scaleRef);
      ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.strokeRect(s.x, s.y, s.w, s.h);
    } else if (s.type === 'arrow') {
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
      const ang = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
      const head = Math.max(14, lw * 4);
      ctx.beginPath();
      ctx.moveTo(s.x2, s.y2);
      ctx.lineTo(s.x2 - head * Math.cos(ang - Math.PI / 6.5), s.y2 - head * Math.sin(ang - Math.PI / 6.5));
      ctx.lineTo(s.x2 - head * Math.cos(ang + Math.PI / 6.5), s.y2 - head * Math.sin(ang + Math.PI / 6.5));
      ctx.closePath();
      ctx.fill();
    } else if (s.type === 'pen' && s.pts.length > 1) {
      ctx.beginPath();
      ctx.moveTo(s.pts[0][0], s.pts[0][1]);
      for (let i = 1; i < s.pts.length; i++) ctx.lineTo(s.pts[i][0], s.pts[i][1]);
      ctx.stroke();
    }
    ctx.restore();
  }

  function getImagePoint(e) {
    const r = el.overlayCanvas.getBoundingClientRect();
    return {
      x: clamp(((e.clientX - r.left) / r.width) * el.overlayCanvas.width, 0, el.overlayCanvas.width),
      y: clamp(((e.clientY - r.top) / r.height) * el.overlayCanvas.height, 0, el.overlayCanvas.height)
    };
  }

  function samplePixelColor(pt) {
    const px = clamp(Math.floor(pt.x), 0, el.viewCanvas.width - 1);
    const py = clamp(Math.floor(pt.y), 0, el.viewCanvas.height - 1);
    const d = el.viewCanvas.getContext('2d').getImageData(px, py, 1, 1).data;
    const hex = rgbToHex(d[0], d[1], d[2]);
    const rgb = `rgb(${d[0]}, ${d[1]}, ${d[2]})`;
    const cmyk = `CMYK ${rgbToCmyk(d[0], d[1], d[2])}`;
    el.colorSwatch.style.background = hex;
    el.colorHex.textContent = hex;
    el.colorRgb.textContent = rgb;
    el.colorCmyk.textContent = cmyk;
    return { hex, rgb, cmyk };
  }

  function undo() {
    if (!state.undoStack.length) return;
    state.redoStack.push(cloneCanvas(state.baseCanvas));
    const prev = state.undoStack.pop();
    state.baseCanvas.width = prev.width;
    state.baseCanvas.height = prev.height;
    state.baseCanvas.getContext('2d').drawImage(prev, 0, 0);
    renderStage(false);
    updateQuickSpecAndStatus();
    updateUndoUI();
  }

  function redo() {
    if (!state.redoStack.length) return;
    state.undoStack.push(cloneCanvas(state.baseCanvas));
    const next = state.redoStack.pop();
    state.baseCanvas.width = next.width;
    state.baseCanvas.height = next.height;
    state.baseCanvas.getContext('2d').drawImage(next, 0, 0);
    renderStage(false);
    updateQuickSpecAndStatus();
    updateUndoUI();
  }

  function resetAllEdits() {
    if (!state.origCanvas.width) return;
    pushUndoSnapshot();
    state.baseCanvas.width = state.origCanvas.width;
    state.baseCanvas.height = state.origCanvas.height;
    state.baseCanvas.getContext('2d').drawImage(state.origCanvas, 0, 0);
    state.adj = { bright: 100, contrast: 100, sat: 100, gray: false };
    syncAdjustSliders();
    renderStage(true);
    updateQuickSpecAndStatus();
    showToast('Επαναφορά αρχικής εικόνας');
  }

  function syncAdjustSliders() {
    el.rngBright.value = String(state.adj.bright);
    el.valBright.textContent = state.adj.bright + '%';
    el.rngContrast.value = String(state.adj.contrast);
    el.valContrast.textContent = state.adj.contrast + '%';
    el.rngSat.value = String(state.adj.sat);
    el.valSat.textContent = state.adj.sat + '%';
    el.btnGrayToggle.classList.toggle('active', state.adj.gray);
  }

  // ==========================================================================
  // SMART EXPORT, CONVERT (WebP / JPG / PNG / ICO) & RESIZE
  // ==========================================================================
  function getPresetDims(preset) {
    const w = state.baseCanvas.width, h = state.baseCanvas.height;
    if (state.expFmt === 'ico') return { w: 256, h: 256 };
    const maxMap = { small: 1200, medium: 1920, large: 3000, original: 0 };
    const cap = maxMap[preset] || 0;
    if (!cap || Math.max(w, h) <= cap) return { w, h };
    const s = cap / Math.max(w, h);
    return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
  }

  function openExportModal() {
    if (!state.baseCanvas.width) return;
    const item = state.items[state.currentIdx];
    const baseName = (item ? item.name : 'image').replace(/\.[^.]+$/, '');
    el.inpExportName.value = baseName;
    el.lblExportMeta.textContent = `Τρέχουσα ανάλυση: ${state.baseCanvas.width} × ${state.baseCanvas.height} px`;
    el.btnSaveDirectDesktop.hidden = !(DESKTOP_MODE && SESSION_TOKEN && item && /^(JPG|JPEG|PNG|WEBP)$/i.test(item.ext));
    updateExportEstimates();
    el.modalExport.hidden = false;
  }

  function updateExportEstimates() {
    const dims = getPresetDims(state.expSize);
    el.inpExpW.value = String(dims.w);
    el.inpExpH.value = String(dims.h);
    el.expQualWrap.style.visibility = (state.expFmt === 'png' || state.expFmt === 'ico') ? 'hidden' : 'visible';

    const bpp = state.expFmt === 'png' ? 0.95 : (state.expFmt === 'webp' ? 0.14 : 0.22);
    const qScale = state.expQual / 85;
    ['small', 'medium', 'large', 'original'].forEach((k) => {
      const d = getPresetDims(k);
      const tag = el.expSizeGrid.querySelector(`.est-tag[data-est="${k}"]`);
      if (tag) {
        const estBytes = state.expFmt === 'ico' ? 36000 : Math.max(8000, Math.round(d.w * d.h * bpp * qScale));
        tag.textContent = `${d.w}×${d.h} · ~${formatBytes(estBytes)}`;
      }
    });
  }

  // Build crisp 256px Windows .ICO (PNG-inside-ICO standard) natively in JS!
  function wrapPngInIco(pngBytes, size) {
    const out = new Uint8Array(22 + pngBytes.length);
    const dv = new DataView(out.buffer);
    dv.setUint16(0, 0, true);
    dv.setUint16(2, 1, true);
    dv.setUint16(4, 1, true);
    out[6] = size >= 256 ? 0 : size;
    out[7] = size >= 256 ? 0 : size;
    out[8] = 0; out[9] = 0;
    dv.setUint16(10, 1, true);
    dv.setUint16(12, 32, true);
    dv.setUint32(14, pngBytes.length, true);
    dv.setUint32(18, 22, true);
    out.set(pngBytes, 22);
    return out;
  }

  async function renderExportBytes(fmt, targetW, targetH, quality) {
    const cv = document.createElement('canvas');
    cv.width = clamp(targetW, 16, 16000);
    cv.height = clamp(targetH, 16, 16000);
    const ctx = cv.getContext('2d');
    if (fmt === 'jpeg') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, cv.width, cv.height);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.filter = getFilterString();
    ctx.drawImage(state.baseCanvas, 0, 0, cv.width, cv.height);
    ctx.filter = 'none';

    if (fmt === 'ico') {
      const blob = await new Promise((r) => cv.toBlob(r, 'image/png'));
      const pngBytes = new Uint8Array(await blob.arrayBuffer());
      return wrapPngInIco(pngBytes, cv.width);
    }
    const mime = fmt === 'webp' ? 'image/webp' : (fmt === 'jpeg' ? 'image/jpeg' : 'image/png');
    const blob = await new Promise((r) => cv.toBlob(r, mime, quality / 100));
    return new Uint8Array(await blob.arrayBuffer());
  }

  async function performExport(overwriteOriginal = false) {
    const fmt = overwriteOriginal
      ? (state.items[state.currentIdx]?.ext || 'png').toLowerCase().replace('jpg', 'jpeg')
      : state.expFmt;
    const ext = fmt === 'jpeg' ? 'jpg' : fmt;
    const w = parseInt(el.inpExpW.value, 10) || state.baseCanvas.width;
    const h = parseInt(el.inpExpH.value, 10) || state.baseCanvas.height;
    const cleanBase = (el.inpExportName.value || 'image').trim().replace(/[<>:"/\\|?*]+/g, '_').replace(/\.[^.]+$/, '');
    const fileName = `${cleanBase}.${ext}`;

    el.btnConfirmExport.disabled = true;
    try {
      const bytes = await renderExportBytes(fmt, w, h, state.expQual);
      if (DESKTOP_MODE && SESSION_TOKEN) {
        const ep = overwriteOriginal
          ? `/api/save?t=${encodeURIComponent(SESSION_TOKEN)}&i=${state.currentIdx}`
          : `/api/saveas?t=${encodeURIComponent(SESSION_TOKEN)}&name=${encodeURIComponent(fileName)}`;
        const resp = await fetch(ep, { method: 'POST', body: bytes });
        if (resp.status === 204) return;
        if (!resp.ok) throw new Error(await resp.text());
        state.prefetchMap.delete(state.currentIdx);
        state.hasEdits = false;
        el.modalExport.hidden = true;
        showToast(`Αποθηκεύτηκε: ${fileName} (${w}×${h} · ${formatBytes(bytes.byteLength)})`, 3400);
      } else {
        const blob = new Blob([bytes]);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = fileName;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        state.hasEdits = false;
        el.modalExport.hidden = true;
        showToast(`Κατέβηκε: ${fileName} (${formatBytes(bytes.byteLength)})`, 3200);
      }
    } catch (err) {
      console.error('Export failed:', err);
      showToast('Σφάλμα κατά την αποθήκευση.');
    } finally {
      el.btnConfirmExport.disabled = false;
    }
  }

  async function copyImageToClipboard() {
    if (!state.baseCanvas.width) return;
    try {
      const bytes = await renderExportBytes('png', state.baseCanvas.width, state.baseCanvas.height, 100);
      const blob = new Blob([bytes], { type: 'image/png' });
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      showToast('Αντιγράφηκε η εικόνα στο πρόχειρο (Ctrl+V σε NillyDoc / Affinity / Viber)');
    } catch (_) {
      showToast('Ο browser δεν επέτρεψε αντιγραφή εικόνας.');
    }
  }

  // ==========================================================================
  // WEB LOCAL FILES LOADER (Mobile / Hostinger / Drag & Drop)
  // ==========================================================================
  function loadLocalWebFiles(fileList) {
    const arr = Array.from(fileList || []).filter((f) =>
      /^image\//i.test(f.type) || /\.(jpe?g|png|webp|avif|gif|bmp|ico|svg)$/i.test(f.name)
    );
    if (!arr.length) { showToast('Επίλεξε έγκυρες εικόνες (JPG, PNG, WebP, SVG, AVIF, GIF).'); return; }
    state.items.forEach((it) => { if (it.url && it.url.startsWith('blob:')) URL.revokeObjectURL(it.url); });
    state.items = arr.map((f, i) => ({
      i,
      name: f.name,
      ext: (f.name.split('.').pop() || 'IMG').toUpperCase(),
      size: f.size,
      url: URL.createObjectURL(f),
      file: f
    }));
    buildFilmstrip();
    showItemAt(0);
  }

  // ==========================================================================
  // DESKTOP BRIDGE BOOT
  // ==========================================================================
  async function initDesktopBridge() {
    if (!DESKTOP_MODE || !SESSION_TOKEN) return;
    el.btnRevealExplorer.hidden = false;
    el.btnDeleteRecycle.hidden = false;

    const ping = () => fetch(`/api/heartbeat?t=${encodeURIComponent(SESSION_TOKEN)}`, { method: 'POST', keepalive: true }).catch(() => {});
    ping();
    setInterval(ping, 2500);
    window.addEventListener('beforeunload', () => {
      try { navigator.sendBeacon(`/api/bye?t=${encodeURIComponent(SESSION_TOKEN)}`); } catch (_) {}
    });

    try {
      const resp = await fetch(`/api/list?t=${encodeURIComponent(SESSION_TOKEN)}`);
      if (resp.ok) {
        const data = await resp.json();
        applyDesktopList(data);
      }
    } catch (err) {
      console.warn('Desktop list error:', err);
    }
  }

  function applyDesktopList(data) {
    state.prefetchMap.forEach((v) => URL.revokeObjectURL(v.blobUrl));
    state.prefetchMap.clear();
    state.items = data.items || [];
    state.folder = data.folder || '';
    if (state.items.length > 0 && data.currentIndex >= 0) {
      buildFilmstrip();
      showItemAt(data.currentIndex);
    } else {
      el.emptyState.hidden = false;
      el.stageWrap.hidden = true;
    }
  }

  // ==========================================================================
  // EVENT BINDINGS
  // ==========================================================================
  function bindEvents() {
    try { applyTheme(localStorage.getItem(LS_THEME) || 'dark'); } catch (_) { applyTheme('dark'); }
    el.btnThemeToggle.addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme');
      applyTheme(cur === 'light' ? 'dark' : 'light');
    });

    const triggerOpen = async () => {
      if (DESKTOP_MODE && SESSION_TOKEN) {
        try {
          const resp = await fetch(`/api/open-file?t=${encodeURIComponent(SESSION_TOKEN)}`, { method: 'POST' });
          if (resp.ok) applyDesktopList(await resp.json());
        } catch (_) {}
      } else {
        el.fileOpenInput.value = '';
        el.fileOpenInput.click();
      }
    };
    el.btnOpenImg.addEventListener('click', triggerOpen);
    el.btnEmptyOpen.addEventListener('click', triggerOpen);
    el.fileOpenInput.addEventListener('change', (e) => loadLocalWebFiles(e.target.files));

    el.btnEmptyPaste.addEventListener('click', async () => {
      try {
        const items = await navigator.clipboard.read();
        for (const it of items) {
          const imgType = it.types.find((t) => t.startsWith('image/'));
          if (imgType) {
            const blob = await it.getType(imgType);
            loadLocalWebFiles([new File([blob], `clipboard_${Date.now()}.png`, { type: imgType })]);
            return;
          }
        }
        showToast('Δεν υπάρχει εικόνα στο πρόχειρο.');
      } catch (_) {
        showToast('Πάτησε Ctrl+V για επικόλληση εικόνας.');
      }
    });

    // Global Drag & Drop + Ctrl+V Paste
    let dragC = 0;
    window.addEventListener('dragenter', (e) => { e.preventDefault(); dragC++; el.dropTarget.classList.add('drop-active'); });
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('dragleave', () => { dragC = Math.max(0, dragC - 1); if (dragC === 0) el.dropTarget.classList.remove('drop-active'); });
    window.addEventListener('drop', (e) => {
      e.preventDefault(); dragC = 0; el.dropTarget.classList.remove('drop-active');
      if (e.dataTransfer?.files?.length) loadLocalWebFiles(e.dataTransfer.files);
    });
    window.addEventListener('paste', (e) => {
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const it = Array.from(e.clipboardData?.items || []).find((x) => x.type && x.type.startsWith('image/'));
      if (!it) return;
      const blob = it.getAsFile();
      if (blob) {
        e.preventDefault();
        loadLocalWebFiles([new File([blob], `clipboard_${Date.now()}.png`, { type: blob.type || 'image/png' })]);
        showToast('Επικολλήθηκε εικόνα από πρόχειρο');
      }
    });

    // Folder Prev / Next
    const stepImg = (delta) => {
      if (state.items.length < 2) return;
      const next = (state.currentIdx + delta + state.items.length) % state.items.length;
      showItemAt(next);
    };
    el.btnPrevImg.addEventListener('click', () => stepImg(-1));
    el.btnNextImg.addEventListener('click', () => stepImg(1));
    el.btnEdgePrev.addEventListener('click', () => stepImg(-1));
    el.btnEdgeNext.addEventListener('click', () => stepImg(1));

    // Zoom & Backdrop
    el.btnZoomOut.addEventListener('click', () => setZoom(state.zoom / 1.22, false));
    el.btnZoomIn.addEventListener('click', () => setZoom(state.zoom * 1.22, false));
    el.btnZoom100.addEventListener('click', () => { state.panX = 0; state.panY = 0; setZoom(1.0, false); });
    el.btnZoomFit.addEventListener('click', () => setZoom(1.0, true));
    el.btnBackdrop.addEventListener('click', () => {
      applyBackdrop(state.backdropIdx + 1);
      const names = ['Dark Studio', 'Διαφάνεια (Checkerboard)', 'Ανοιχτό Χαρτί', 'Μαύρο Darkroom'];
      showToast('Φόντο: ' + names[state.backdropIdx], 1600);
    });

    // Smooth Mouse-Wheel Zoom directly on desk!
    el.deskViewport.addEventListener('wheel', (e) => {
      if (!state.baseCanvas.width) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.14 : 1 / 1.14;
      setZoom(state.zoom * factor, false);
    }, { passive: false });

    let rzTimer = null;
    window.addEventListener('resize', () => {
      if (!state.baseCanvas.width || !state.fitMode) return;
      clearTimeout(rzTimer);
      rzTimer = setTimeout(() => renderStage(true), 100);
    });

    // Toggles: Filmstrip, Edit Strip, Info Rail, More Menu
    el.btnToggleFilmstrip.addEventListener('click', () => {
      if (!state.items.length) return;
      el.filmstrip.hidden = !el.filmstrip.hidden;
      el.btnToggleFilmstrip.classList.toggle('active', !el.filmstrip.hidden);
      $('app').classList.toggle('filmstrip-open', !el.filmstrip.hidden);
      if (!el.filmstrip.hidden) updateFilmstripActive();
      if (state.fitMode) setTimeout(() => renderStage(true), 40);
    });

    el.btnToggleEdit.addEventListener('click', () => {
      state.editOpen = !state.editOpen;
      el.editStrip.hidden = !state.editOpen;
      el.btnToggleEdit.classList.toggle('active', state.editOpen);
      if (!state.editOpen) {
        el.cropBar.hidden = true;
        el.adjustBar.hidden = true;
        setTool('pan');
      }
      if (state.fitMode) setTimeout(() => renderStage(true), 40);
    });

    el.btnToggleInfo.addEventListener('click', () => {
      el.infoRail.hidden = !el.infoRail.hidden;
      el.btnToggleInfo.classList.toggle('active', !el.infoRail.hidden);
      if (!el.infoRail.hidden) renderInfoPanel();
      if (state.fitMode) setTimeout(() => renderStage(true), 40);
    });
    el.btnCloseInfo.addEventListener('click', () => {
      el.infoRail.hidden = true;
      el.btnToggleInfo.classList.remove('active');
      if (state.fitMode) setTimeout(() => renderStage(true), 40);
    });

    const closeMore = () => { el.moreMenu.hidden = true; };
    el.btnMoreMenu.addEventListener('click', (e) => { e.stopPropagation(); el.moreMenu.hidden = !el.moreMenu.hidden; });
    document.addEventListener('click', (e) => { if (!el.moreMenu.hidden && !el.moreMenuWrap.contains(e.target)) closeMore(); });

    el.btnCopyImg.addEventListener('click', () => { closeMore(); copyImageToClipboard(); });
    el.btnQuickRotR.addEventListener('click', () => { closeMore(); transformImage('rotR'); });
    el.btnQuickRotL.addEventListener('click', () => { closeMore(); transformImage('rotL'); });
    el.btnPrintImg.addEventListener('click', () => { closeMore(); window.print(); });
    el.btnFullscreen.addEventListener('click', () => {
      closeMore();
      if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
      else document.exitFullscreen().catch(() => {});
    });
    el.btnSlideshow.addEventListener('click', () => {
      closeMore();
      if (state.slideshowTimer) {
        clearInterval(state.slideshowTimer);
        state.slideshowTimer = null;
        showToast('Τερματισμός Slideshow');
      } else if (state.items.length > 1) {
        state.slideshowTimer = setInterval(() => stepImg(1), 3500);
        showToast('Slideshow (κάθε 3.5 δευτ. · F5 για παύση)');
      }
    });
    el.btnRevealExplorer.addEventListener('click', () => {
      closeMore();
      if (DESKTOP_MODE && SESSION_TOKEN)
        fetch(`/api/reveal?t=${encodeURIComponent(SESSION_TOKEN)}&i=${state.currentIdx}`, { method: 'POST' }).catch(() => {});
    });
    el.btnDeleteRecycle.addEventListener('click', async () => {
      closeMore();
      if (!DESKTOP_MODE || !SESSION_TOKEN || state.currentIdx < 0) return;
      const name = state.items[state.currentIdx]?.name || '';
      const resp = await fetch(`/api/delete?t=${encodeURIComponent(SESSION_TOKEN)}&i=${state.currentIdx}`, { method: 'POST' });
      if (resp.ok) {
        showToast(`Μετακινήθηκε στον Κάδο Ανακύκλωσης: ${name}`);
        applyDesktopList(await resp.json());
      }
    });

    // Edit Strip Controls
    el.editStrip.querySelectorAll('.tool-btn').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));
    el.inkPalette.querySelectorAll('.ink-dot').forEach((d) => {
      d.addEventListener('click', () => {
        state.color = d.dataset.color;
        el.inkPalette.querySelectorAll('.ink-dot').forEach((x) => x.classList.toggle('active', x === d));
      });
    });
    el.selBrushSize.addEventListener('change', () => { state.brushSize = parseInt(el.selBrushSize.value, 10) || 6; });
    el.btnRotLeft.addEventListener('click', () => transformImage('rotL'));
    el.btnRotRight.addEventListener('click', () => transformImage('rotR'));
    el.btnFlipH.addEventListener('click', () => transformImage('flipH'));
    el.btnFlipV.addEventListener('click', () => transformImage('flipV'));
    el.btnUndo.addEventListener('click', undo);
    el.btnRedo.addEventListener('click', redo);
    el.btnResetEdits.addEventListener('click', resetAllEdits);

    // Crop Bar
    el.cropRatioRow.querySelectorAll('.seg-m').forEach((b) => {
      b.addEventListener('click', () => {
        state.cropRatio = parseFloat(b.dataset.ratio) || 0;
        el.cropRatioRow.querySelectorAll('.seg-m').forEach((x) => x.classList.toggle('active', x === b));
        enforceCropAspect();
        drawOverlay();
      });
    });
    el.btnApplyCrop.addEventListener('click', applyCrop);
    el.btnCancelCrop.addEventListener('click', () => setTool('pan'));

    // Light / Color Adjustments Bar
    el.btnAdjustToggle.addEventListener('click', () => {
      el.adjustBar.hidden = !el.adjustBar.hidden;
      el.btnAdjustToggle.classList.toggle('active', !el.adjustBar.hidden);
    });
    const onAdj = () => {
      state.adj.bright = parseInt(el.rngBright.value, 10);
      state.adj.contrast = parseInt(el.rngContrast.value, 10);
      state.adj.sat = parseInt(el.rngSat.value, 10);
      syncAdjustSliders();
      renderStage(false);
    };
    el.rngBright.addEventListener('input', onAdj);
    el.rngContrast.addEventListener('input', onAdj);
    el.rngSat.addEventListener('input', onAdj);
    el.btnGrayToggle.addEventListener('click', () => { state.adj.gray = !state.adj.gray; syncAdjustSliders(); renderStage(false); });
    el.btnResetAdjust.addEventListener('click', () => {
      state.adj = { bright: 100, contrast: 100, sat: 100, gray: false };
      syncAdjustSliders();
      renderStage(false);
    });

    // Canvas Pointer Interaction (Pan, Crop, Eyedropper, Arrow, Rect, Pen, Text, Blur)
    el.overlayCanvas.addEventListener('pointerdown', (e) => {
      if (!state.baseCanvas.width || e.button !== 0) return;
      const pt = getImagePoint(e);

      if (state.tool === 'eyedropper') {
        const picked = samplePixelColor(pt);
        navigator.clipboard.writeText(picked.hex).catch(() => {});
        showToast(`Αντιγράφηκε ${picked.hex} · ${picked.rgb} · ${picked.cmyk}`, 3200);
        return;
      }

      if (state.tool === 'text') {
        state.pendingTextPt = pt;
        el.txtOverlayInput.value = '';
        el.modalText.hidden = false;
        setTimeout(() => el.txtOverlayInput.focus(), 30);
        return;
      }

      state.pointerDown = true;
      state.startClient = { x: e.clientX, y: e.clientY };
      state.startPan = { x: state.panX, y: state.panY };
      state.startImgPt = pt;
      el.overlayCanvas.setPointerCapture(e.pointerId);

      if (state.tool === 'pan') {
        el.overlayCanvas.classList.add('panning');
      } else if (state.tool === 'crop') {
        state.cropRect = { x: pt.x, y: pt.y, w: 0, h: 0 };
      } else if (state.tool === 'pen') {
        state.draftShape = { type: 'pen', color: state.color, size: state.brushSize, pts: [[pt.x, pt.y]] };
      } else if (state.tool === 'arrow') {
        state.draftShape = { type: 'arrow', color: state.color, size: state.brushSize, x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y };
      } else {
        state.draftShape = { type: state.tool, color: state.color, size: state.brushSize, x: pt.x, y: pt.y, w: 0, h: 0 };
      }
    });

    el.overlayCanvas.addEventListener('pointermove', (e) => {
      if (!state.baseCanvas.width) return;
      const pt = getImagePoint(e);
      if (state.tool === 'eyedropper') {
        samplePixelColor(pt);
        return;
      }
      if (!state.pointerDown) return;

      if (state.tool === 'pan') {
        state.panX = state.startPan.x + (e.clientX - state.startClient.x);
        state.panY = state.startPan.y + (e.clientY - state.startClient.y);
        applyStageTransform();
        return;
      }

      if (state.tool === 'crop' && state.cropRect) {
        let w = pt.x - state.startImgPt.x;
        let h = pt.y - state.startImgPt.y;
        if (state.cropRatio) h = Math.sign(h || 1) * Math.abs(w / state.cropRatio);
        state.cropRect = {
          x: clamp(w >= 0 ? state.startImgPt.x : state.startImgPt.x + w, 0, state.baseCanvas.width),
          y: clamp(h >= 0 ? state.startImgPt.y : state.startImgPt.y + h, 0, state.baseCanvas.height),
          w: Math.min(Math.abs(w), state.baseCanvas.width),
          h: Math.min(Math.abs(h), state.baseCanvas.height)
        };
        drawOverlay();
        return;
      }

      if (state.draftShape) {
        if (state.draftShape.type === 'pen') state.draftShape.pts.push([pt.x, pt.y]);
        else if (state.draftShape.type === 'arrow') { state.draftShape.x2 = pt.x; state.draftShape.y2 = pt.y; }
        else { state.draftShape.w = pt.x - state.draftShape.x; state.draftShape.h = pt.y - state.draftShape.y; }
        drawOverlay();
      }
    });

    const endPtr = (e) => {
      if (!state.pointerDown) return;
      state.pointerDown = false;
      el.overlayCanvas.classList.remove('panning');
      try { el.overlayCanvas.releasePointerCapture(e.pointerId); } catch (_) {}

      if (state.draftShape) {
        const s = state.draftShape;
        state.draftShape = null;
        if (s.type === 'blur') {
          applyMosaicBlur(s);
        } else {
          const valid = (s.type === 'pen' && s.pts.length > 2)
            || (s.type === 'arrow' && Math.hypot(s.x2 - s.x1, s.y2 - s.y1) > 6)
            || (s.type === 'rect' && Math.abs(s.w) > 4 && Math.abs(s.h) > 4);
          if (valid) {
            pushUndoSnapshot();
            drawShapeOnContext(state.baseCanvas.getContext('2d'), s, 1);
            renderStage(false);
          }
        }
        drawOverlay();
      }
    };
    el.overlayCanvas.addEventListener('pointerup', endPtr);
    el.overlayCanvas.addEventListener('pointercancel', endPtr);

    // Double-click image toggles Fit <-> 100%
    el.overlayCanvas.addEventListener('dblclick', () => {
      if (state.tool !== 'pan') return;
      if (state.fitMode) { state.panX = 0; state.panY = 0; setZoom(1.0, false); }
      else setZoom(1.0, true);
    });

    // Text overlay commit
    const commitTextOverlay = () => {
      const txt = el.txtOverlayInput.value.trim();
      el.modalText.hidden = true;
      if (!txt || !state.pendingTextPt) return;
      pushUndoSnapshot();
      const ctx = state.baseCanvas.getContext('2d');
      const fs = Math.max(18, Math.round((state.brushSize * 4.5) * Math.max(1, state.baseCanvas.width / 1000)));
      ctx.save();
      ctx.font = `700 ${fs}px "Segoe UI", -apple-system, Arial, sans-serif`;
      ctx.textBaseline = 'top';
      const lines = txt.split('\n');
      const lh = fs * 1.28;
      if (el.chkTextBackdrop.checked) {
        let mw = 0;
        lines.forEach((l) => { mw = Math.max(mw, ctx.measureText(l).width); });
        ctx.fillStyle = state.color === '#FFFFFF' ? 'rgba(15,23,42,0.82)' : 'rgba(255,255,255,0.92)';
        ctx.fillRect(state.pendingTextPt.x - 10, state.pendingTextPt.y - 6, mw + 20, lines.length * lh + 12);
      }
      ctx.fillStyle = state.color;
      lines.forEach((l, i) => ctx.fillText(l, state.pendingTextPt.x, state.pendingTextPt.y + i * lh));
      ctx.restore();
      renderStage(false);
    };
    el.btnCommitText.addEventListener('click', commitTextOverlay);
    el.txtOverlayInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitTextOverlay(); }
    });

    // Export Modal controls
    el.btnSaveOpen.addEventListener('click', openExportModal);
    el.expFmtRow.querySelectorAll('.seg-btn').forEach((b) => {
      b.addEventListener('click', () => {
        state.expFmt = b.dataset.fmt;
        el.expFmtRow.querySelectorAll('.seg-btn').forEach((x) => x.classList.toggle('active', x === b));
        updateExportEstimates();
      });
    });
    el.expSizeGrid.querySelectorAll('.size-card').forEach((c) => {
      c.addEventListener('click', () => {
        state.expSize = c.dataset.size;
        el.expSizeGrid.querySelectorAll('.size-card').forEach((x) => x.classList.toggle('active', x === c));
        updateExportEstimates();
      });
    });
    el.inpExpW.addEventListener('input', () => {
      const nw = parseInt(el.inpExpW.value, 10);
      if (nw > 0 && state.baseCanvas.width) {
        el.inpExpH.value = String(Math.max(1, Math.round(nw * (state.baseCanvas.height / state.baseCanvas.width))));
      }
    });
    el.inpExpH.addEventListener('input', () => {
      const nh = parseInt(el.inpExpH.value, 10);
      if (nh > 0 && state.baseCanvas.height) {
        el.inpExpW.value = String(Math.max(1, Math.round(nh * (state.baseCanvas.width / state.baseCanvas.height))));
      }
    });
    el.rngExpQual.addEventListener('input', () => {
      state.expQual = parseInt(el.rngExpQual.value, 10) || 88;
      el.lblExpQual.textContent = state.expQual + '%';
      updateExportEstimates();
    });
    el.btnConfirmExport.addEventListener('click', () => performExport(false));
    el.btnSaveDirectDesktop.addEventListener('click', () => performExport(true));

    document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => { $(b.dataset.close).hidden = true; }));
    document.querySelectorAll('.modal-backdrop').forEach((bd) => bd.addEventListener('click', (e) => { if (e.target === bd) bd.hidden = true; }));

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      const tag = (e.target && e.target.tagName) || '';
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); openExportModal(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') { e.preventDefault(); triggerOpen(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && !typing) { e.preventDefault(); copyImageToClipboard(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e' && DESKTOP_MODE) { e.preventDefault(); el.btnRevealExplorer.click(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y' && !typing) { e.preventDefault(); redo(); return; }
      if (e.key === 'Escape') {
        closeMore();
        document.querySelectorAll('.modal-backdrop:not([hidden])').forEach((m) => { m.hidden = true; });
        if (state.tool === 'crop') setTool('pan');
        return;
      }

      if (typing || !state.baseCanvas.width) return;

      const k = e.key.toLowerCase();
      if (e.key === 'ArrowRight') { e.preventDefault(); stepImg(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); stepImg(-1); }
      else if (e.key === 'Home') showItemAt(0);
      else if (e.key === 'End') showItemAt(state.items.length - 1);
      else if (e.key === '+' || e.key === '=') setZoom(state.zoom * 1.22, false);
      else if (e.key === '-') setZoom(state.zoom / 1.22, false);
      else if (e.key === '0' || e.key === ' ') { e.preventDefault(); setZoom(1.0, true); }
      else if (e.key === '1') { state.panX = 0; state.panY = 0; setZoom(1.0, false); }
      else if (k === 'e') el.btnToggleEdit.click();
      else if (k === 'i') el.btnToggleInfo.click();
      else if (k === 'f') el.btnToggleFilmstrip.click();
      else if (k === 'b') el.btnBackdrop.click();
      else if (k === 'r' && !state.editOpen) transformImage('rotR');
      else if (k === 'l') transformImage('rotL');
      else if (e.key === 'F5') { e.preventDefault(); el.btnSlideshow.click(); }
      else if (e.key === 'Delete' && DESKTOP_MODE) el.btnDeleteRecycle.click();
      else if (state.editOpen) {
        const map = { v: 'pan', c: 'crop', k: 'eyedropper', a: 'arrow', r: 'rect', p: 'pen', t: 'text', u: 'blur' };
        if (map[k]) setTool(map[k]);
      }
    });
  }

  // ==========================================================================
  // BOOT
  // ==========================================================================
  bindEvents();
  initDesktopBridge();
})();
