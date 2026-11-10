(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AgendaPriorityEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Manual preference contributes 70% of the score; progress contributes 30%.
  // This keeps the user's explicit priority decisive while sorting titles of
  // the same priority by progress / proximity to completion.
  const PRIORITY_BASE = Object.freeze({ high: 70, normal: 35, low: 0 });
  const PROGRESS_WEIGHT = 30;

  function getProgress(anime) {
    const watched = Math.max(0, Number(anime && anime.watched) || 0);
    const episodes = Math.max(0, Number(anime && anime.episodes) || 0);
    if (!episodes) return { watched, episodes: 0, ratio: 0, percent: 0, known: false };
    const ratio = Math.min(1, watched / episodes);
    return { watched, episodes, ratio, percent: Math.round(ratio * 100), known: true };
  }

  function calculatePriorityScore(anime) {
    const item = anime || {};
    const priority = Object.prototype.hasOwnProperty.call(PRIORITY_BASE, item.agendaPriority)
      ? item.agendaPriority
      : 'normal';
    const progress = getProgress(item);
    const manualScore = PRIORITY_BASE[priority];
    const progressScore = progress.ratio * PROGRESS_WEIGHT;
    return {
      id: item.id == null ? null : String(item.id),
      priority,
      manualScore,
      progressScore: Math.round(progressScore * 100) / 100,
      progressPercent: progress.percent,
      progressKnown: progress.known,
      score: Math.round((manualScore + progressScore) * 100) / 100
    };
  }

  // Convert the 70/30 priority score into a bounded allocation weight.
  // The +1 floor guarantees that low-priority titles can still receive slots.
  function calculateAllocationScore(anime, weeklyCount, consecutive, continuityEnabled) {
    const base = calculatePriorityScore(anime);
    const weight = 1 + (base.score / 50);
    const count = Math.max(0, Number(weeklyCount) || 0);
    const consecutivePenalty = continuityEnabled !== false && consecutive ? 0.4 : 0;
    return {
      priorityScore: base.score,
      weight: Math.round(weight * 1000) / 1000,
      allocationScore: Math.round((weight / (count + 1) - consecutivePenalty) * 1000) / 1000
    };
  }

  function rankAnime(animeList) {
    return (Array.isArray(animeList) ? animeList : [])
      .map((anime, index) => ({ anime, index, result: calculatePriorityScore(anime) }))
      .sort((a, b) => b.result.score - a.result.score || a.index - b.index)
      .map(entry => ({ ...entry.anime, priorityScore: entry.result.score }));
  }

  return Object.freeze({ calculatePriorityScore, calculateAllocationScore, getProgress, rankAnime });
});
