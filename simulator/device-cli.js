// Reuse the existing CLI and command engine in a device-local, non-modal window.
var ptDeviceCliState = null;
var ptDeviceCliClickCandidate = null;
var ptDeviceCommandHistories = new WeakMap();
var ptDeviceHistoryDevice = null;
function deviceCliDragExceeded(start, event, x, y) {
  return (
    Math.hypot(event.clientX - x, event.clientY - y) > (start.pointerType === 'touch' ? 10 : 6)
  );
}
function selectDeviceCliHistory(id) {
  const device = get(id);
  if (!device || ptDeviceHistoryDevice === device) return;
  if (ptDeviceHistoryDevice) ptDeviceCommandHistories.set(ptDeviceHistoryDevice, ptCommandHistory);
  ptCommandHistory = ptDeviceCommandHistories.get(device) || [];
  ptHistoryIndex = ptCommandHistory.length;
  ptDeviceHistoryDevice = device;
}
// A device drag owns its touch gesture; scrolling elsewhere on the page remains native.
const deviceCliGestureStyle = document.createElement('style');
deviceCliGestureStyle.textContent = '#ptCanvas .pt-node{touch-action:none}';
document.head.append(deviceCliGestureStyle);
function refreshDeviceCli() {
  const device = get($p('ptCliDevice').value);
  if (device) selectDeviceCliHistory(device.id);
  if (!ptDeviceCliState?.dialog.open) return;
  if (!device) {
    ptDeviceCliState.dialog.close();
    return;
  }
  if (ptDeviceCliState.deviceId !== device.id) $p('ptCliInput').value = '';
  ptDeviceCliState.title.textContent = device.name + ' · ' + device.type + ' · CLI';
  ptDeviceCliState.deviceId = device.id;
}
function positionDeviceCli() {
  if (!ptDeviceCliState?.dialog.open) return;
  const dialog = ptDeviceCliState.dialog;
  const nodes = [...svg.querySelectorAll('g[data-id]')];
  const node = nodes.find((node) => node.dataset.id === ptDeviceCliState.deviceId);
  const anchor = node?.getBoundingClientRect();
  const viewport = window.visualViewport;
  const width = viewport?.width ?? window.innerWidth,
    height = viewport?.height ?? window.innerHeight;
  dialog.style.maxHeight = Math.max(120, height - 24) + 'px';
  const bounds = dialog.getBoundingClientRect(),
    w = bounds.width,
    h = bounds.height;
  const candidates = anchor
    ? [
        [anchor.right + 12, anchor.top],
        [anchor.left - w - 12, anchor.top],
        [anchor.left, anchor.bottom + 12],
        [anchor.left, anchor.top - h - 12],
        [width - w - 12, 12],
        [12, 12],
      ]
    : [[12, 12]];
  const rectangles = nodes.map((n) => n.getBoundingClientRect());
  const positions = candidates
    .map(([x, y]) => {
      const left = Math.max(12, Math.min(x, width - w - 12)),
        top = Math.max(12, Math.min(y, height - h - 12));
      const overlap = rectangles.reduce(
        (sum, r) =>
          sum +
          Math.max(0, Math.min(left + w, r.right) - Math.max(left, r.left)) *
            Math.max(0, Math.min(top + h, r.bottom) - Math.max(top, r.top)),
        0,
      );
      return {
        left,
        top,
        score: overlap * 1000 + (anchor ? Math.hypot(left - anchor.right, top - anchor.top) : 0),
      };
    })
    .sort((a, b) => a.score - b.score);
  dialog.style.left = positions[0].left + 'px';
  dialog.style.top = positions[0].top + 'px';
}
function openDeviceCli(id) {
  const device = get(id);
  if (!device || connectMode) return;
  if (selected !== id) {
    cliMode = 'user';
    currentInterface = '';
  }
  selected = id;
  $p('ptCliDevice').value = id;
  // A pending command for another device must not be submitted accidentally.
  if (ptDeviceCliState?.deviceId !== id) $p('ptCliInput').value = '';
  updateInspector();
  render();
  if (!ptDeviceCliState) {
    const card = document.querySelector('.pt-cli-card');
    const slot = document.createComment('Device CLI dock');
    card.before(slot);
    const dialog = document.createElement('dialog');
    dialog.id = 'ptDeviceCliDialog';
    dialog.setAttribute('aria-labelledby', 'ptDeviceCliTitle');
    const header = document.createElement('div');
    header.className = 'pt-device-cli-titlebar';
    const title = document.createElement('strong');
    title.id = 'ptDeviceCliTitle';
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = 'Kapat ×';
    close.setAttribute('aria-label', 'CLI penceresini kapat');
    header.append(title, close);
    dialog.append(header);
    document.body.append(dialog);
    ptDeviceCliState = { dialog, title, card, slot, deviceId: id };
    close.onclick = () => dialog.close();
    dialog.addEventListener('close', () => {
      // close is queued: a quick new device selection may already have reopened
      // the dialog or moved focus. An old close must not undock it or steal focus.
      if (dialog.open) return;
      const restoreFocus =
        dialog.contains(document.activeElement) || document.activeElement === document.body;
      slot.parentNode.insertBefore(card, slot.nextSibling);
      const node = [...svg.querySelectorAll('g[data-id]')].find(
        (node) => node.dataset.id === ptDeviceCliState.deviceId,
      );
      if (restoreFocus) (node || $p('ptQuickCli'))?.focus({ preventScroll: true });
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && dialog.open && !event.defaultPrevented && !connectMode) {
        event.preventDefault();
        dialog.close();
      }
    });
    window.addEventListener('resize', positionDeviceCli);
    window.addEventListener('scroll', positionDeviceCli, { passive: true });
    window.visualViewport?.addEventListener('resize', positionDeviceCli);
    document.addEventListener('click', (event) => {
      const tab = event.target.closest('[data-area]');
      if (tab && tab.dataset.area !== 'lab' && dialog.open) dialog.close();
    });
    const style = document.createElement('style');
    style.textContent = `
   #ptDeviceCliDialog{position:fixed;margin:0;padding:0;width:min(440px,calc(100vw - 24px));max-width:calc(100vw - 24px);max-height:calc(100vh - 24px);max-height:calc(100dvh - 24px);overflow:auto;border:1px solid #557591;border-radius:14px;background:var(--panel,#111d2d);color:var(--text,#e7f1ff);box-shadow:0 18px 70px #0009;z-index:10000}
   #ptDeviceCliDialog .pt-device-cli-titlebar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;background:var(--panel2,#1b3045);position:sticky;top:0;z-index:1}
   #ptDeviceCliDialog .pt-device-cli-titlebar strong{overflow-wrap:anywhere}
   #ptDeviceCliDialog .pt-device-cli-titlebar button{width:auto;min-height:40px;flex-shrink:0}
   #ptDeviceCliDialog .pt-cli-card{margin:0;border:0;border-radius:0;min-width:0;grid-column:auto;padding:14px}
   #ptDeviceCliDialog .pt-terminal{height:240px;max-height:35vh;overflow:auto;max-width:100%;white-space:pre-wrap;overflow-wrap:anywhere}
   #ptDeviceCliDialog .pt-cli-form{display:flex;flex-wrap:wrap;gap:6px}
   #ptDeviceCliDialog .pt-cli-form input{min-width:80px;flex:1}
   #ptDeviceCliDialog .pt-cli-form button{width:auto}
   #ptDeviceCliDialog .pt-card-head{flex-wrap:wrap}
   #ptDeviceCliDialog select{max-width:100%}
   #ptCanvas .pt-node:focus-visible rect{stroke:#f4cd79;stroke-width:3}
  `;
    document.head.append(style);
  }
  const state = ptDeviceCliState;
  state.deviceId = id;
  if (!state.dialog.open) {
    state.dialog.append(state.card);
    state.dialog.show();
  }
  refreshDeviceCli();
  positionDeviceCli();
  $p('ptCliInput').focus({ preventScroll: true });
}
