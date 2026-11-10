import { Game } from './core/Game.js';
import './style.css';
try {
  const game = new Game(document.querySelector('#app'));
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('qa')) window.__RED_HORIZON__ = game;
  if (import.meta.hot) import.meta.hot.dispose(() => game.dispose());
} catch (error) {
  console.error(error);
  document.querySelector('#app').innerHTML = '<div class="fatal"><h1>No se pudo iniciar WebGL.</h1><p>Activa la aceleración gráfica del navegador y vuelve a cargar la página.</p></div>';
}
