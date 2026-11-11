export const PROTOCOL_VERSION = 1;
export const GAME_VERSION = 'coop-2';
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const normalizeCode = code => typeof code === 'string' ? code.replace(/\s/g, '').toUpperCase() : '';
export const HELD = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'Space', 'Mouse0'];
export const ACTIONS = ['Space', 'ControlLeft', 'KeyQ', 'KeyE', 'KeyF', 'Digit1', 'Digit2', 'Digit3'];
export const ERRORS = {
  UNAVAILABLE: 'No se pudo conectar con el servidor multijugador. Comprueba que esté iniciado y vuelve a intentar crear o unirte a una sala.',
  INVALID_CODE: 'Código inválido: usa seis caracteres sin I, O, 0 ni 1.', NOT_FOUND: 'La sala no existe o ha caducado.', FULL: 'La sala está llena (máximo 4 jugadores).',
  STARTED: 'La partida ya comenzó. Solo pueden reconectar sus participantes.', VERSION: 'Versión incompatible. Actualiza la página.', OFFLINE: 'Servidor desconectado. Intentando recuperar la conexión…',
  TOKEN: 'La reconexión no es válida o ha expirado.', ACTIVE: 'Este jugador ya tiene una conexión activa.', PERMISSION: 'Solo el creador puede iniciar con 2–4 jugadores conectados y listos.',
  INVALID: 'Mensaje inválido.', LIMIT: 'Límite de solicitudes alcanzado. Espera un momento.', SHUTDOWN: 'El servidor se está reiniciando. Esta sala no se conservará.',
};
export function validateMessage(m) {
  if (!m || typeof m !== 'object' || Array.isArray(m) || typeof m.type !== 'string') return false;
  const keys = { create: ['type', 'version', 'gameVersion', 'nickname'], join: ['type', 'version', 'gameVersion', 'nickname', 'code'], reconnect: ['type', 'version', 'gameVersion', 'code', 'token'], ready: ['type', 'ready'], start: ['type'], leave: ['type'], ping: ['type', 'at'], input: ['type', 'seq', 'held', 'actions', 'yaw', 'aim', 'enabled'], upgrade: ['type', 'round', 'option'] }[m.type];
  if (!keys || Object.keys(m).some(k => !keys.includes(k))) return false;
  if (['create', 'join', 'reconnect'].includes(m.type)) return Number.isSafeInteger(m.version) && typeof m.gameVersion === 'string' && m.gameVersion.length < 40 && (m.type === 'reconnect' ? typeof m.token === 'string' && /^[a-f0-9]{64}$/.test(m.token) && typeof m.code === 'string' && m.code.length <= 32 : (m.nickname === undefined || typeof m.nickname === 'string' && m.nickname.length <= 64) && (m.type !== 'join' || typeof m.code === 'string' && m.code.length <= 32));
  if (m.type === 'ready') return typeof m.ready === 'boolean';
  if (m.type === 'ping') return Number.isFinite(m.at);
  if (m.type === 'upgrade') return Number.isSafeInteger(m.round) && typeof m.option === 'string' && m.option.length <= 32;
  if (m.type !== 'input') return true;
  return Number.isSafeInteger(m.seq) && m.seq > 0 && typeof m.enabled === 'boolean' && Number.isFinite(m.yaw) && Math.abs(m.yaw) <= 1e6 &&
    Array.isArray(m.held) && m.held.length <= HELD.length && m.held.every(k => HELD.includes(k)) && new Set(m.held).size === m.held.length &&
    Array.isArray(m.actions) && m.actions.length <= ACTIONS.length && m.actions.every(k => ACTIONS.includes(k)) && new Set(m.actions).size === m.actions.length &&
    m.aim && Object.keys(m.aim).length === 3 && ['x', 'y', 'z'].every(k => Number.isFinite(m.aim[k])) && Math.abs(Math.hypot(m.aim.x, m.aim.y, m.aim.z) - 1) < .01;
}
export function inputAdapter(message, consume = true) {
  const actions = new Set(message.enabled ? message.actions : []);
  return { down: k => message.enabled && message.held.includes(k), take: k => { const has = actions.has(k); if (consume) actions.delete(k); return has; } };
}
