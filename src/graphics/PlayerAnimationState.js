export const LOCOMOTION = ['idle_rifle', 'walk_forward', 'walk_backward', 'strafe_left', 'strafe_right', 'run_forward', 'run_backward', 'run_strafe_left', 'run_strafe_right'];

export function movementWeights(player) {
  const speed = Math.hypot(player.vx, player.vz);
  if (speed < 0.25) return { idle_rifle: 1 };
  const forward = player.vx * Math.sin(player.yaw) + player.vz * Math.cos(player.yaw);
  const side = player.vx * Math.cos(player.yaw) - player.vz * Math.sin(player.yaw);
  const total = Math.abs(forward) + Math.abs(side) || 1;
  const running = Math.max(0, Math.min(1, (speed - 7 * player.stats.speed) / (3.5 * player.stats.speed)));
  return {
    [forward >= 0 ? 'walk_forward' : 'walk_backward']: Math.abs(forward) / total * (1 - running),
    [forward >= 0 ? 'run_forward' : 'run_backward']: Math.abs(forward) / total * running,
    [side >= 0 ? 'strafe_right' : 'strafe_left']: Math.abs(side) / total * (1 - running),
    [side >= 0 ? 'run_strafe_right' : 'run_strafe_left']: Math.abs(side) / total * running,
  };
}

export function avatarState(run) {
  if (run.mission.phase === 'cinematic') return 'final_collapse';
  if (run.player.dead) return 'death';
  if (run.player.slideTime > 0) return 'slide';
  if (!run.player.grounded) return 'jump';
  if (run.mission.phase === 'countdown' && run.mission.countdown <= 15 && Math.hypot(run.player.vx, run.player.vz) < 0.25) return 'final_exhausted';
  return 'locomotion';
}
