/** Framework-agnostic touch gesture controller for AR DOM overlays.
 * One finger tap -> onTap. One finger drag -> onDrag. Two fingers -> pinch + rotate.
 * Call destroy() when the overlay unmounts.
 */
export function createARGestureController({
  element,
  onTap,
  onDrag,
  onPinch,
  onRotate,
  tapMaxDuration = 260,
  tapMaxDistance = 12,
  preventDefault = true,
  ignoreSelector = "[data-ui]",
} = {}) {
  if (!element) throw new Error('createARGestureController requires an element');
  const pointers = new Map();
  let start = null;
  let gesture = null;
  let lastSingle = null;

  const point = e => ({ x: e.clientX, y: e.clientY });
  const distance = (a,b) => Math.hypot(b.x-a.x,b.y-a.y);
  const angle = (a,b) => Math.atan2(b.y-a.y,b.x-a.x);

  const down = e => {
    if (ignoreSelector && e.target?.closest?.(ignoreSelector)) return;
    if (preventDefault) e.preventDefault();
    element.setPointerCapture?.(e.pointerId);
    pointers.set(e.pointerId, point(e));
    if (pointers.size === 1) {
      start = { ...point(e), time: performance.now() };
      lastSingle = point(e);
      gesture = null;
    } else if (pointers.size === 2) {
      const [a,b] = [...pointers.values()];
      gesture = { distance: Math.max(1, distance(a,b)), angle: angle(a,b) };
      start = null;
    }
  };
  const move = e => {
    if (!pointers.has(e.pointerId)) return;
    if (preventDefault) e.preventDefault();
    const previous = pointers.get(e.pointerId);
    pointers.set(e.pointerId, point(e));
    if (pointers.size === 2 && gesture) {
      const [a,b] = [...pointers.values()];
      const d = Math.max(1, distance(a,b));
      const a2 = angle(a,b);
      onPinch?.({ factor: d / gesture.distance, center: { x:(a.x+b.x)/2, y:(a.y+b.y)/2 } });
      let delta = a2 - gesture.angle;
      if (delta > Math.PI) delta -= Math.PI * 2;
      if (delta < -Math.PI) delta += Math.PI * 2;
      onRotate?.({ delta, center: { x:(a.x+b.x)/2, y:(a.y+b.y)/2 } });
      gesture = { distance:d, angle:a2 };
    } else if (pointers.size === 1 && lastSingle) {
      const now = point(e);
      const dx = now.x - previous.x, dy = now.y - previous.y;
      if (Math.abs(dx)+Math.abs(dy) > 1) onDrag?.({ dx, dy, x:now.x, y:now.y });
      lastSingle = now;
    }
  };
  const up = e => {
    if (preventDefault) e.preventDefault();
    const end = point(e);
    if (pointers.size === 1 && start) {
      const elapsed = performance.now() - start.time;
      if (elapsed <= tapMaxDuration && distance(start,end) <= tapMaxDistance) onTap?.(end);
    }
    pointers.delete(e.pointerId);
    if (pointers.size < 2) gesture = null;
    if (pointers.size === 1) lastSingle = [...pointers.values()][0]; else lastSingle = null;
  };
  element.addEventListener('pointerdown', down, {passive:false});
  element.addEventListener('pointermove', move, {passive:false});
  element.addEventListener('pointerup', up, {passive:false});
  element.addEventListener('pointercancel', up, {passive:false});
  return { destroy() {
    element.removeEventListener('pointerdown', down);
    element.removeEventListener('pointermove', move);
    element.removeEventListener('pointerup', up);
    element.removeEventListener('pointercancel', up);
    pointers.clear();
  }};
}
