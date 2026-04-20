const app = document.querySelector('#app');
const lobbyScreen = document.querySelector('#lobby-screen');
const gameScreen = document.querySelector('#game-screen');
const battleScreen = document.querySelector('#battle-screen');
const victoryScreen = document.querySelector('#victory-screen');
const continueBtn = document.querySelector('#continue-btn');
const dailyBtn = document.querySelector('#daily-btn');
const backBtn = document.querySelector('#back-btn');
const battleEntryBtn = document.querySelector('#battle-entry-btn');
const battleCloseBtn = document.querySelector('#battle-close-btn');
const matchBtn = document.querySelector('#match-btn');
const matchOverlay = document.querySelector('#match-overlay');
const matchTimerEl = document.querySelector('#match-timer');
const cancelMatchBtn = document.querySelector('#cancel-match-btn');
const plusToolBtn = document.querySelector('#plus-tool-btn');
const hintToolBtn = document.querySelector('#hint-tool-btn');
const battleStatusBar = document.querySelector('#battle-status-bar');
const playerScoreEl = document.querySelector('#player-score');
const opponentScoreEl = document.querySelector('#opponent-score');
const playerProgressFillEl = document.querySelector('#player-progress-fill');
const opponentProgressFillEl = document.querySelector('#opponent-progress-fill');
const battleTargetEl = document.querySelector('#battle-target');
const battleTimerEl = document.querySelector('#battle-timer');
const loseOverlay = document.querySelector('#battle-lose-overlay');
const loseWinsEl = document.querySelector('#lose-wins');
const loseLossesEl = document.querySelector('#lose-losses');
const loseNewGameBtn = document.querySelector('#lose-new-game-btn');
const loseHomeBtn = document.querySelector('#lose-home-btn');
const victoryWinsEl = document.querySelector('#victory-wins');
const victoryLossesEl = document.querySelector('#victory-losses');
const victoryNewGameBtn = document.querySelector('#victory-new-game-btn');
const victoryHomeBtn = document.querySelector('#victory-home-btn');
const difficultyBtns = Array.from(document.querySelectorAll('.difficulty-btn'));
const gameBoardEl = document.querySelector('.game-board');
const boardViewport = document.querySelector('.board-viewport');
const tileGrid = document.querySelector('.tile-grid');
const playerPlusBubble = document.querySelector('#player-plus-bubble');
const opponentPlusBubble = document.querySelector('#opponent-plus-bubble');

const BOARD_COLS = 9;
const BOARD_ROWS = 20;
const BOARD_VISIBLE_ROWS = 10;
const INITIAL_NUMBERS = 35;
const MAX_BOARD_CELLS = BOARD_COLS * BOARD_ROWS;
const MATCHING_MS = 3000;
const PLUS_TOOL_MAX_USES = 5;
const BOT_SCORE_TICK_MS = 2000;
const BATTLE_GOAL_OPTIONS = [
  { targetScore: 200, timeLimitSec: 6 * 60 },
  { targetScore: 400, timeLimitSec: 12 * 60 },
];

const SCORE_RULES = {
  adjacent: 1,
  straightGap: 3,
  diagonalGap: 4,
  edgePair: 5,
  lineClear: 12,
  perfectX1: 3,
  perfectX2: 6,
  perfectX3: 9,
  boardClear: 135,
};

const BOT_DIFFICULTY_CONFIG = {
  high: {
    tickMs: 1000,
    canMistake: false,
  },
  medium: {
    tickMs: 1000,
    canMistake: true,
  },
  low: {
    tickMs: 10000,
    canMistake: true,
  },
};

const state = {
  screen: 'lobby',
  level: 1,
  coins: 0,
  elapsedMs: 0,
  matching: false,
  battleMode: false,
  selectedIndex: null,
  hintIndexes: [],
  boardInitialized: false,
  values: [],
  battle: null,
  battleRecord: {
    wins: 0,
    losses: 0,
    streak: 0,
  },
  botDifficulty: 'medium',
  board: {
    cols: BOARD_COLS,
    rows: BOARD_ROWS,
    visibleRows: BOARD_VISIBLE_ROWS,
  },
};

let matchingTimer = null;
let matchingClockTimer = null;
let matchingStartedAt = 0;
let battleClockTimer = null;
let botActionTimer = null;
let playerBubbleTimer = null;
let opponentBubbleTimer = null;
let scorePopupLayer = null;
let boardTouchActive = false;
let boardTouchMoved = false;
let boardTouchStartY = 0;
let boardTouchStartScrollTop = 0;
let boardTouchSuppressClickUntil = 0;

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function pickBattleGoalOption() {
  const index = Math.floor(Math.random() * BATTLE_GOAL_OPTIONS.length);
  return BATTLE_GOAL_OPTIONS[index];
}

function getPairDistance(indexA, indexB) {
  const a = indexToRowCol(indexA);
  const b = indexToRowCol(indexB);
  return Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
}

function isDiagonalPair(indexA, indexB) {
  const a = indexToRowCol(indexA);
  const b = indexToRowCol(indexB);
  return Math.abs(a.row - b.row) === Math.abs(a.col - b.col) && a.row !== b.row;
}

function isStraightPair(indexA, indexB) {
  const a = indexToRowCol(indexA);
  const b = indexToRowCol(indexB);
  return (a.row === b.row && a.col !== b.col) || (a.col === b.col && a.row !== b.row);
}

function countFullyEmptyRows(values) {
  let count = 0;
  for (let row = 0; row < BOARD_ROWS; row += 1) {
    let allEmpty = true;
    for (let col = 0; col < BOARD_COLS; col += 1) {
      if (values[rowColToIndex(row, col)] !== null) {
        allEmpty = false;
        break;
      }
    }
    if (allEmpty) count += 1;
  }
  return count;
}

function getStageMultiplier() {
  if (!state.battle || !state.battle.stage) return 1;
  return Math.max(1, state.battle.stage);
}

function ensureScorePopupLayer() {
  if (!gameScreen) return null;
  if (scorePopupLayer && scorePopupLayer.isConnected) return scorePopupLayer;

  scorePopupLayer = gameScreen.querySelector('.score-popups');
  if (scorePopupLayer) return scorePopupLayer;

  scorePopupLayer = document.createElement('div');
  scorePopupLayer.className = 'score-popups';
  gameScreen.appendChild(scorePopupLayer);
  return scorePopupLayer;
}

function getFallbackScoreOrigin() {
  if (!gameScreen) return { x: 0, y: 0 };
  const gameRect = gameScreen.getBoundingClientRect();
  if (!boardViewport) return { x: gameRect.width / 2, y: gameRect.height / 2 };

  const boardRect = boardViewport.getBoundingClientRect();
  return {
    x: boardRect.left - gameRect.left + (boardRect.width / 2),
    y: boardRect.top - gameRect.top + Math.min(80, boardRect.height / 2),
  };
}

function setScoreOriginFromPointer(event) {
  if (!state.battle || !gameScreen) return;
  if (!event) {
    state.battle.lastScoreOrigin = getFallbackScoreOrigin();
    return;
  }

  const gameRect = gameScreen.getBoundingClientRect();
  const clickedCell = event.target && event.target.closest ? event.target.closest('.cell') : null;

  let x = 0;
  let y = 0;
  if (clickedCell) {
    const cellRect = clickedCell.getBoundingClientRect();
    x = (cellRect.left + (cellRect.width / 2)) - gameRect.left;
    y = (cellRect.top + (cellRect.height / 2)) - gameRect.top;
  } else if (typeof event.clientX === 'number' && typeof event.clientY === 'number') {
    x = event.clientX - gameRect.left;
    y = event.clientY - gameRect.top;
  } else {
    const fallback = getFallbackScoreOrigin();
    x = fallback.x;
    y = fallback.y;
  }

  x = Math.min(Math.max(x, 12), Math.max(12, gameRect.width - 12));
  y = Math.min(Math.max(y, 12), Math.max(12, gameRect.height - 12));
  state.battle.lastScoreOrigin = { x, y };
}

function showScorePopup(score) {
  if (!state.battleMode || !state.battle || state.battle.ended) return;
  const layer = ensureScorePopupLayer();
  if (!layer) return;

  const origin = state.battle.lastScoreOrigin || getFallbackScoreOrigin();
  const popup = document.createElement('span');
  popup.className = 'score-popup';
  popup.textContent = `+${score}`;
  popup.style.left = `${origin.x}px`;
  popup.style.top = `${origin.y}px`;
  layer.appendChild(popup);

  setTimeout(() => {
    popup.remove();
  }, 1100);
}

function addPlayerScore(baseScore) {
  if (!state.battle || state.battle.ended) return;
  const multiplied = baseScore * getStageMultiplier();
  state.battle.playerScore += multiplied;
  showScorePopup(multiplied);
}

function addOpponentScore(baseScore) {
  if (!state.battle || state.battle.ended) return;
  state.battle.opponentScore += baseScore;
}

function getPerfectBonusByStreak(streak) {
  const level = Math.max(1, Math.min(3, streak));
  if (level === 1) return SCORE_RULES.perfectX1;
  if (level === 2) return SCORE_RULES.perfectX2;
  return SCORE_RULES.perfectX3;
}

function applyPairScore(indexA, indexB, beforePairValues, afterPairValues) {
  const edgePair = isCrossRowEdgePair(indexA, indexB);
  const distance = getPairDistance(indexA, indexB);
  const beforeEmptyRows = countFullyEmptyRows(beforePairValues);
  const afterEmptyRows = countFullyEmptyRows(afterPairValues);
  const newlyClearedRows = Math.max(0, afterEmptyRows - beforeEmptyRows);

  let totalBaseScore = 0;

  if (edgePair) {
    totalBaseScore += SCORE_RULES.edgePair;
  } else if (isDiagonalPair(indexA, indexB) && distance >= 2) {
    totalBaseScore += SCORE_RULES.diagonalGap;
  } else if (isStraightPair(indexA, indexB) && distance >= 2) {
    totalBaseScore += SCORE_RULES.straightGap;
  } else {
    totalBaseScore += SCORE_RULES.adjacent;
  }

  if (newlyClearedRows > 0) {
    totalBaseScore += (newlyClearedRows * SCORE_RULES.lineClear);
  }

  if (state.battle && !state.battle.ended) {
    state.battle.comboStreak = Math.min(3, (state.battle.comboStreak || 0) + 1);
    totalBaseScore += getPerfectBonusByStreak(state.battle.comboStreak);
  }

  addPlayerScore(totalBaseScore);
}

function updatePlusToolButton() {
  if (!plusToolBtn) return;
  if (!state.battleMode || !state.battle || state.battle.ended) {
    plusToolBtn.disabled = false;
    return;
  }
  plusToolBtn.disabled = state.battle.playerPlusUses >= PLUS_TOOL_MAX_USES;
}

function updateBoardMetrics() {
  if (!gameBoardEl) return;

  const styles = window.getComputedStyle(gameBoardEl);
  const paddingLeft = parseFloat(styles.paddingLeft) || 0;
  const paddingRight = parseFloat(styles.paddingRight) || 0;
  const paddingTop = parseFloat(styles.paddingTop) || 0;
  const borderSize = 4;
  const minCellSize = 20;
  const maxCellSize = 56;
  const widthLimit = Math.floor((gameBoardEl.clientWidth - paddingLeft - paddingRight - borderSize) / BOARD_COLS);
  const heightLimit = Math.floor((gameBoardEl.clientHeight - paddingTop - borderSize) / BOARD_VISIBLE_ROWS);
  const cellSize = Math.max(minCellSize, Math.min(widthLimit, heightLimit, maxCellSize));

  gameBoardEl.style.setProperty('--cell-size', `${cellSize}px`);
}

function showPlusBubble(side) {
  const bubble = side === 'player' ? playerPlusBubble : opponentPlusBubble;
  if (!bubble) return;
  bubble.classList.add('show');

  if (side === 'player') {
    if (playerBubbleTimer) clearTimeout(playerBubbleTimer);
    playerBubbleTimer = setTimeout(() => {
      bubble.classList.remove('show');
      playerBubbleTimer = null;
    }, 900);
  } else {
    if (opponentBubbleTimer) clearTimeout(opponentBubbleTimer);
    opponentBubbleTimer = setTimeout(() => {
      bubble.classList.remove('show');
      opponentBubbleTimer = null;
    }, 900);
  }
}

function hideMatchOverlay() {
  state.matching = false;
  if (!matchOverlay) return;
  matchOverlay.classList.remove('is-active');
  matchOverlay.setAttribute('aria-hidden', 'true');
  if (matchingTimer) {
    clearTimeout(matchingTimer);
    matchingTimer = null;
  }
  if (matchingClockTimer) {
    clearInterval(matchingClockTimer);
    matchingClockTimer = null;
  }
  matchingStartedAt = 0;
  if (matchTimerEl) matchTimerEl.textContent = '匹配中 00:00';
}

function hideLoseOverlay() {
  if (!loseOverlay) return;
  loseOverlay.classList.remove('is-active');
  loseOverlay.setAttribute('aria-hidden', 'true');
}

function showLoseOverlay() {
  if (!loseOverlay) return;
  if (loseWinsEl) loseWinsEl.textContent = String(state.battleRecord.wins);
  if (loseLossesEl) loseLossesEl.textContent = String(state.battleRecord.losses);
  loseOverlay.classList.add('is-active');
  loseOverlay.setAttribute('aria-hidden', 'false');
}

function updateVictoryView() {
  if (victoryWinsEl) victoryWinsEl.textContent = String(state.battleRecord.wins);
  if (victoryLossesEl) victoryLossesEl.textContent = String(state.battleRecord.losses);
}

function stopBattleTimers() {
  if (battleClockTimer) {
    clearInterval(battleClockTimer);
    battleClockTimer = null;
  }
  if (botActionTimer) {
    clearInterval(botActionTimer);
    botActionTimer = null;
  }
}

function getRemainingCount() {
  return state.values.filter((value) => value !== null).length;
}

function updateBattleStatusUI() {
  if (!state.battleMode || !state.battle) return;
  const { playerScore, opponentScore, targetScore, remainingSec } = state.battle;
  const denominator = Math.max(1, targetScore);
  const playerPercent = Math.min(100, Math.max(0, (playerScore / denominator) * 100));
  const opponentPercent = Math.min(100, Math.max(0, (opponentScore / denominator) * 100));

  if (playerScoreEl) playerScoreEl.textContent = `${playerScore}/${targetScore}`;
  if (opponentScoreEl) opponentScoreEl.textContent = `${opponentScore}/${targetScore}`;
  if (playerProgressFillEl) playerProgressFillEl.style.width = `${playerPercent}%`;
  if (opponentProgressFillEl) opponentProgressFillEl.style.width = `${opponentPercent}%`;
  if (battleTargetEl) battleTargetEl.textContent = `Target ${targetScore}`;
  if (battleTimerEl) battleTimerEl.textContent = formatTime(remainingSec);
  updatePlusToolButton();
}

function setBattleMode(active) {
  state.battleMode = active;
  gameScreen.classList.toggle('battle-mode', active);
  if (battleStatusBar) battleStatusBar.setAttribute('aria-hidden', active ? 'false' : 'true');
  if (!active && battleTargetEl) battleTargetEl.textContent = 'Target --';

  if (!active) {
    state.battle = null;
    stopBattleTimers();
  }
  updatePlusToolButton();
}

function finishBattle(winner) {
  if (!state.battle || state.battle.ended) return;
  state.battle.ended = true;
  state.battle.winner = winner;
  stopBattleTimers();

  if (winner === 'player') {
    state.battleRecord.wins += 1;
    state.battleRecord.streak += 1;
    updateVictoryView();
    showScreen('victory');
  } else {
    state.battleRecord.losses += 1;
    state.battleRecord.streak = 0;
    showLoseOverlay();
  }

  updateBattleStatusUI();
}

function runBotTurn() {
  if (!state.battleMode || !state.battle || state.battle.ended) return;
  addOpponentScore(1);
  if (state.battle.opponentScore >= state.battle.targetScore) {
    finishBattle('opponent');
    return;
  }
  updateBattleStatusUI();
}

function startBattleSession() {
  const goal = pickBattleGoalOption();

  state.battle = {
    targetScore: goal.targetScore,
    timeLimitSec: goal.timeLimitSec,
    remainingSec: goal.timeLimitSec,
    stage: 1,
    playerScore: 0,
    opponentScore: 0,
    comboStreak: 0,
    playerPlusUses: 0,
    opponentPlusUses: 0,
    lastScoreOrigin: null,
    ended: false,
    winner: null,
  };

  updateBattleStatusUI();
  stopBattleTimers();

  battleClockTimer = setInterval(() => {
    if (!state.battleMode || !state.battle || state.battle.ended) return;
    state.battle.remainingSec = Math.max(0, state.battle.remainingSec - 1);
    if (state.battle.remainingSec === 0) {
      if (state.battle.playerScore > state.battle.opponentScore) finishBattle('player');
      else finishBattle('opponent');
      return;
    }
    updateBattleStatusUI();
  }, 1000);

  botActionTimer = setInterval(() => {
    runBotTurn();
  }, BOT_SCORE_TICK_MS);
}

function syncPlayerBattleProgress() {
  if (!state.battleMode || !state.battle || state.battle.ended) return;
  if (state.battle.playerScore >= state.battle.targetScore) {
    finishBattle('player');
    return;
  }

  const remaining = getRemainingCount();
  if (remaining === 0) {
    addPlayerScore(SCORE_RULES.boardClear);
    if (state.battle.playerScore >= state.battle.targetScore) {
      finishBattle('player');
      return;
    }

    state.battle.stage += 1;
    initializeBoardValues();
    if (boardViewport) boardViewport.scrollTop = 0;
    renderBoardValues({ animateIndexes: new Set(getFilledIndexes(state.values)) });
  }

  updateBattleStatusUI();
}

function applyPlayerMistake() {
  if (!state.battleMode || !state.battle || state.battle.ended) return;
  state.battle.comboStreak = 0;
}

function updateMatchTimerText() {
  if (!matchTimerEl || !matchingStartedAt) return;
  const elapsedMs = Date.now() - matchingStartedAt;
  const elapsedSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  matchTimerEl.textContent = `匹配中 ${formatTime(elapsedSeconds)}`;
}

function startMatching() {
  state.matching = true;
  if (!matchOverlay) return;

  matchOverlay.classList.add('is-active');
  matchOverlay.setAttribute('aria-hidden', 'false');
  matchingStartedAt = Date.now();
  updateMatchTimerText();

  if (matchingTimer) clearTimeout(matchingTimer);
  if (matchingClockTimer) clearInterval(matchingClockTimer);
  matchingClockTimer = setInterval(() => {
    updateMatchTimerText();
  }, 250);

  matchingTimer = setTimeout(() => {
    hideMatchOverlay();
    enterGame(true);
  }, MATCHING_MS);
}

function startRematchFlow() {
  showScreen('battle');
  startMatching();
}

function setBotDifficulty(level) {
  if (!BOT_DIFFICULTY_CONFIG[level]) return;
  state.botDifficulty = level;
  difficultyBtns.forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.difficulty === level);
  });
}

function buildBoardCells() {
  if (!tileGrid) return;
  const frag = document.createDocumentFragment();
  for (let row = 0; row < BOARD_ROWS; row += 1) {
    for (let col = 0; col < BOARD_COLS; col += 1) {
      const cell = document.createElement('span');
      cell.className = 'cell';
      cell.dataset.row = String(row);
      cell.dataset.col = String(col);
      frag.appendChild(cell);
    }
  }
  tileGrid.replaceChildren(frag);
}

function randomDigit() {
  return Math.floor(Math.random() * 9) + 1;
}

function rowColToIndex(row, col) {
  return row * BOARD_COLS + col;
}

function indexToRowCol(index) {
  return {
    row: Math.floor(index / BOARD_COLS),
    col: index % BOARD_COLS,
  };
}

function initializeBoardValues() {
  state.values = Array.from({ length: MAX_BOARD_CELLS }, () => null);
  for (let i = 0; i < INITIAL_NUMBERS; i += 1) {
    state.values[i] = randomDigit();
  }

  state.values[0] = 1;
  state.values[1] = 9;
  state.selectedIndex = null;
  state.hintIndexes = [];
  state.boardInitialized = true;
}

function getFilledIndexes(values) {
  const indexes = [];
  for (let i = 0; i < values.length; i += 1) {
    if (values[i] !== null) indexes.push(i);
  }
  return indexes;
}

function renderBoardValues(options = {}) {
  if (!tileGrid) return;
  const cells = tileGrid.querySelectorAll('.cell');
  const animateIndexes = options.animateIndexes || null;
  let appearOrder = 0;

  for (let i = 0; i < cells.length; i += 1) {
    const cell = cells[i];
    const value = state.values[i];
    const isSelected = state.selectedIndex === i;
    const isHinted = state.hintIndexes.includes(i);
    const shouldAnimate = Boolean(animateIndexes && animateIndexes.has(i) && value !== null);

    cell.classList.toggle('filled', value !== null);
    cell.classList.toggle('selected', isSelected);
    cell.classList.toggle('hinted', isHinted);
    cell.classList.toggle('appearing', shouldAnimate);
    if (shouldAnimate) {
      cell.style.setProperty('--appear-order', String(appearOrder));
      appearOrder += 1;
    } else {
      cell.style.removeProperty('--appear-order');
    }
    cell.textContent = value === null ? '' : String(value);
    cell.setAttribute('aria-label', value === null ? '空格' : `数字 ${value}`);
  }
}

function getStep(delta) {
  if (delta === 0) return 0;
  return delta > 0 ? 1 : -1;
}

function hasNoBlockingNumbers(indexA, indexB) {
  const a = indexToRowCol(indexA);
  const b = indexToRowCol(indexB);
  const rowDelta = b.row - a.row;
  const colDelta = b.col - a.col;
  const rowStep = getStep(rowDelta);
  const colStep = getStep(colDelta);
  let row = a.row + rowStep;
  let col = a.col + colStep;

  while (row !== b.row || col !== b.col) {
    const index = rowColToIndex(row, col);
    if (state.values[index] !== null) return false;
    row += rowStep;
    col += colStep;
  }

  return true;
}

function isLineAligned(indexA, indexB) {
  const a = indexToRowCol(indexA);
  const b = indexToRowCol(indexB);
  const sameRow = a.row === b.row;
  const sameCol = a.col === b.col;
  const sameDiagonal = Math.abs(a.row - b.row) === Math.abs(a.col - b.col);
  return sameRow || sameCol || sameDiagonal;
}

function firstNonEmptyIndexInRow(row) {
  for (let col = 0; col < BOARD_COLS; col += 1) {
    const idx = rowColToIndex(row, col);
    if (state.values[idx] !== null) return idx;
  }
  return -1;
}

function lastNonEmptyIndexInRow(row) {
  for (let col = BOARD_COLS - 1; col >= 0; col -= 1) {
    const idx = rowColToIndex(row, col);
    if (state.values[idx] !== null) return idx;
  }
  return -1;
}

function isCrossRowEdgePair(indexA, indexB) {
  const a = indexToRowCol(indexA);
  const b = indexToRowCol(indexB);
  if (Math.abs(a.row - b.row) !== 1) return false;

  const upperRow = Math.min(a.row, b.row);
  const lowerRow = Math.max(a.row, b.row);
  const upperLast = lastNonEmptyIndexInRow(upperRow);
  const lowerFirst = firstNonEmptyIndexInRow(lowerRow);
  if (upperLast === -1 || lowerFirst === -1) return false;

  return (
    (indexA === upperLast && indexB === lowerFirst) ||
    (indexB === upperLast && indexA === lowerFirst)
  );
}

function canPair(indexA, indexB) {
  const valueA = state.values[indexA];
  const valueB = state.values[indexB];
  if (valueA === null || valueB === null) return false;
  if (!isValuePairCompatible(valueA, valueB)) return false;

  if (isCrossRowEdgePair(indexA, indexB)) return true;
  if (!isLineAligned(indexA, indexB)) return false;

  return hasNoBlockingNumbers(indexA, indexB);
}

function isValuePairCompatible(valueA, valueB) {
  if (valueA === null || valueB === null) return false;
  return valueA === valueB || valueA + valueB === 10;
}

function collapseClearedRows() {
  const activeRows = [];

  for (let row = 0; row < BOARD_ROWS; row += 1) {
    const rowValues = [];
    let hasNumber = false;

    for (let col = 0; col < BOARD_COLS; col += 1) {
      const idx = rowColToIndex(row, col);
      const value = state.values[idx];
      rowValues.push(value);
      if (value !== null) hasNumber = true;
    }

    if (hasNumber) activeRows.push(rowValues);
  }

  const flattened = [];
  for (const rowValues of activeRows) {
    flattened.push(...rowValues);
  }

  const missing = MAX_BOARD_CELLS - flattened.length;
  if (missing > 0) {
    flattened.push(...Array.from({ length: missing }, () => null));
  }

  state.values = flattened;
}

function getRemainingNumbers() {
  return state.values.filter((value) => value !== null);
}

function getLastFilledIndex() {
  for (let i = state.values.length - 1; i >= 0; i -= 1) {
    if (state.values[i] !== null) return i;
  }
  return -1;
}

function duplicateRemainingNumbersAtTail(source = 'player') {
  if (state.battleMode && state.battle && state.battle.ended) return;
  if (state.battleMode && state.battle && source === 'player') {
    if (state.battle.playerPlusUses >= PLUS_TOOL_MAX_USES) {
      updatePlusToolButton();
      return;
    }
  }

  const remaining = getRemainingNumbers();
  if (remaining.length === 0) return;

  const appendedIndexes = [];
  let insertIndex = getLastFilledIndex() + 1;
  for (const value of remaining) {
    if (insertIndex >= state.values.length) break;
    state.values[insertIndex] = value;
    appendedIndexes.push(insertIndex);
    insertIndex += 1;
  }

  state.selectedIndex = null;
  state.hintIndexes = [];
  renderBoardValues({ animateIndexes: new Set(appendedIndexes) });

  if (state.battleMode && state.battle && !state.battle.ended && source === 'player') {
    state.battle.playerPlusUses += 1;
    showPlusBubble('player');
  }

  syncPlayerBattleProgress();
}

function findHintPair() {
  for (let i = 0; i < state.values.length; i += 1) {
    if (state.values[i] === null) continue;
    for (let j = i + 1; j < state.values.length; j += 1) {
      if (state.values[j] === null) continue;
      if (canPair(i, j)) return [i, j];
    }
  }
  return [];
}

function showHintPair() {
  if (state.battleMode && state.battle && state.battle.ended) return;
  state.selectedIndex = null;
  state.hintIndexes = findHintPair();
  renderBoardValues();
}

function setupBoardTouchScroll() {
  if (!boardViewport) return;

  boardViewport.addEventListener('touchstart', (event) => {
    if (event.touches.length !== 1) return;
    boardTouchActive = true;
    boardTouchMoved = false;
    boardTouchStartY = event.touches[0].clientY;
    boardTouchStartScrollTop = boardViewport.scrollTop;
  }, { passive: true });

  boardViewport.addEventListener('touchmove', (event) => {
    if (!boardTouchActive || event.touches.length !== 1) return;
    const currentY = event.touches[0].clientY;
    const deltaY = currentY - boardTouchStartY;

    if (Math.abs(deltaY) > 6) {
      boardTouchMoved = true;
    }

    boardViewport.scrollTop = boardTouchStartScrollTop - deltaY;
    event.preventDefault();
  }, { passive: false });

  const endTouchScroll = () => {
    if (boardTouchActive && boardTouchMoved) {
      boardTouchSuppressClickUntil = Date.now() + 220;
    }
    boardTouchActive = false;
    boardTouchMoved = false;
  };

  boardViewport.addEventListener('touchend', endTouchScroll);
  boardViewport.addEventListener('touchcancel', endTouchScroll);
}

function handleBoardClick(event) {
  if (state.battleMode && state.battle && state.battle.ended) return;
  if (Date.now() < boardTouchSuppressClickUntil) return;

  const target = event.target.closest('.cell');
  if (!target) return;

  state.hintIndexes = [];
  const row = Number(target.dataset.row);
  const col = Number(target.dataset.col);
  const index = rowColToIndex(row, col);
  const value = state.values[index];

  if (value === null) {
    state.selectedIndex = null;
    renderBoardValues();
    return;
  }

  if (state.selectedIndex === null) {
    state.selectedIndex = index;
    renderBoardValues();
    return;
  }

  if (state.selectedIndex === index) {
    state.selectedIndex = null;
    renderBoardValues();
    return;
  }

  const selected = state.selectedIndex;
  if (canPair(selected, index)) {
    setScoreOriginFromPointer(event);
    const beforePairValues = state.values.slice();
    state.values[selected] = null;
    state.values[index] = null;
    applyPairScore(selected, index, beforePairValues, state.values);
    collapseClearedRows();
    state.selectedIndex = null;
    renderBoardValues();
    syncPlayerBattleProgress();
    return;
  }

  if (isValuePairCompatible(state.values[selected], value)) {
    applyPlayerMistake();
  }
  state.selectedIndex = index;
  renderBoardValues();
}

function enterGame(isBattleMode) {
  hideLoseOverlay();
  setBattleMode(isBattleMode);
  initializeBoardValues();
  showScreen('game');
  updateBoardMetrics();
  if (boardViewport) boardViewport.scrollTop = 0;
  renderBoardValues({ animateIndexes: new Set(getFilledIndexes(state.values)) });
  if (isBattleMode) startBattleSession();
}

function showScreen(screen) {
  state.screen = screen;
  app.dataset.screen = screen;

  lobbyScreen.classList.toggle('is-active', screen === 'lobby');
  gameScreen.classList.toggle('is-active', screen === 'game');
  battleScreen.classList.toggle('is-active', screen === 'battle');
  if (victoryScreen) victoryScreen.classList.toggle('is-active', screen === 'victory');

  if (screen !== 'battle') hideMatchOverlay();
  if (screen !== 'game') hideLoseOverlay();
  if (screen !== 'game' && screen !== 'victory') setBattleMode(false);
}

if (continueBtn) continueBtn.addEventListener('click', () => enterGame(false));
if (dailyBtn) dailyBtn.addEventListener('click', () => enterGame(false));
if (backBtn) backBtn.addEventListener('click', () => showScreen('lobby'));
if (battleEntryBtn) battleEntryBtn.addEventListener('click', () => showScreen('battle'));
if (battleCloseBtn) battleCloseBtn.addEventListener('click', () => showScreen('lobby'));
if (matchBtn) matchBtn.addEventListener('click', () => startMatching());
if (cancelMatchBtn) cancelMatchBtn.addEventListener('click', () => hideMatchOverlay());
if (tileGrid) tileGrid.addEventListener('click', (event) => handleBoardClick(event));
if (plusToolBtn) plusToolBtn.addEventListener('click', () => duplicateRemainingNumbersAtTail('player'));
if (hintToolBtn) hintToolBtn.addEventListener('click', () => showHintPair());
if (loseNewGameBtn) loseNewGameBtn.addEventListener('click', () => startRematchFlow());
if (loseHomeBtn) loseHomeBtn.addEventListener('click', () => showScreen('battle'));
if (victoryNewGameBtn) victoryNewGameBtn.addEventListener('click', () => startRematchFlow());
if (victoryHomeBtn) victoryHomeBtn.addEventListener('click', () => showScreen('battle'));

difficultyBtns.forEach((btn) => {
  btn.addEventListener('click', () => setBotDifficulty(btn.dataset.difficulty));
});

window.render_game_to_text = () => JSON.stringify({
  note: 'UI scaffold and gameplay. Coordinates use CSS pixels from top-left, x right, y down.',
  screen: state.screen,
  level: state.level,
  coins: state.coins,
  elapsedMs: state.elapsedMs,
  board: state.board,
  selectedIndex: state.selectedIndex,
  hintIndexes: state.hintIndexes,
  remainingNumbers: getRemainingCount(),
  battleMode: state.battleMode,
  battle: state.battle,
  botDifficulty: state.botDifficulty,
  matching: state.matching,
});

window.advanceTime = (ms = 16) => {
  state.elapsedMs += ms;
  return window.render_game_to_text();
};

window.addEventListener('resize', () => {
  updateBoardMetrics();
});

showScreen('lobby');
setBotDifficulty(state.botDifficulty);
buildBoardCells();
initializeBoardValues();
updateBoardMetrics();
renderBoardValues();
setupBoardTouchScroll();
