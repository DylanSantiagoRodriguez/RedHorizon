export const CONTROLS = [
  ['KeyW', 'Avanzar', 'Movimiento'], ['KeyS', 'Retroceder', 'Movimiento'],
  ['KeyA', 'Izquierda', 'Movimiento'], ['KeyD', 'Derecha', 'Movimiento'],
  ['ShiftLeft', 'Correr', 'Movimiento'], ['Space', 'Saltar / bunnyhop', 'Movimiento'],
  ['ControlLeft', 'Deslizarse', 'Movimiento'],
  ['Mouse0', 'Disparar', 'Combate'], ['Mouse2', 'Apuntar', 'Combate'],
  ['KeyQ', 'Pulso', 'Combate'], ['KeyF', 'Disparo continuo', 'Combate'],
  ['Digit1', 'Plasma', 'Equipo'], ['Digit2', 'Escopeta', 'Equipo'], ['Digit3', 'Lanzador', 'Equipo'],
  ['KeyE', 'Interactuar / invocar / lanzar', 'Equipo'],
];
export const DEFAULT_BINDINGS = Object.fromEntries(CONTROLS.map(([code]) => [code, code]));
export const validBinding = code => typeof code === 'string' && /^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Space|Shift(Left|Right)|Control(Left|Right)|Enter|Backspace|CapsLock|Mouse[0-4])$/.test(code);
export function normalizeBindings(value) {
  const result = { ...DEFAULT_BINDINGS };
  if (!value || typeof value !== 'object') return result;
  // Accept only complete, unique maps; malformed saves cannot disable an action.
  const codes = CONTROLS.map(([key]) => value[key]);
  if (codes.every(validBinding) && new Set(codes).size === codes.length)
    for (const [key] of CONTROLS) result[key] = value[key];
  return result;
}
export function rebind(bindings, action, code) {
  if (!(action in DEFAULT_BINDINGS) || !validBinding(code)) return false;
  const other = Object.keys(bindings).find(key => key !== action && bindings[key] === code);
  if (other) bindings[other] = bindings[action];
  bindings[action] = code;
  return true;
}
export function keyLabel(code) {
  const labels = { Space: 'Espacio', ShiftLeft: 'Shift izq.', ShiftRight: 'Shift der.', ControlLeft: 'Ctrl izq.', ControlRight: 'Ctrl der.', Mouse0: 'Ratón izq.', Mouse1: 'Ratón central', Mouse2: 'Ratón der.', Mouse3: 'Ratón 4', Mouse4: 'Ratón 5', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Enter: 'Intro', Backspace: 'Retroceso', CapsLock: 'Bloq. Mayús', Escape: 'Esc' };
  return labels[code] || code?.replace(/^(Key|Digit)/, '') || '?';
}
