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
const playerHeartsEl = document.querySelector('#player-hearts');
const opponentHeartsEl = document.querySelector('#opponent-hearts');
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

function renderPlusStock(targetEl, usedCount) {
  if (!targetEl) return;
  const used = Math.max(0, Math.min(PLUS_TOOL_MAX_USES, usedCount));
  const icons = Array.from({ length: PLUS_TOOL_MAX_USES }, (_, idx) => {
    const spent = idx < used ? 'is-spent' : '';
    return `<span class="status-plus-icon ${spent}" aria-hidden="true">+</span>`;
  }).join('');
  targetEl.innerHTML = icons;
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
  const { playerRemaining, opponentRemaining, playerPlusUses, opponentPlusUses, elapsedSec } = state.battle;

  if (playerScoreEl) playerScoreEl.textContent = String(playerRemaining);
  if (opponentScoreEl) opponentScoreEl.textContent = String(opponentRemaining);
  renderPlusStock(playerHeartsEl, playerPlusUses);
  renderPlusStock(opponentHeartsEl, opponentPlusUses);
  if (battleTimerEl) battleTimerEl.textContent = formatTime(elapsedSec);
  updatePlusToolButton();
}

function setBattleMode(active) {
  state.battleMode = active;
  gameScreen.classList.toggle('battle-mode', active);
  if (battleStatusBar) battleStatusBar.setAttribute('aria-hidden', active ? 'false' : 'true');

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

function applyBotPlus() {
  if (!state.battle || state.battle.ended) return false;
  if (state.battle.opponentPlusUses >= PLUS_TOOL_MAX_USES) return false;
  const remaining = state.battle.opponentRemaining;
  let chance = 0;

  if (remaining === 1) {
    chance = 1;
  } else if (remaining >= 2 && remaining <= 5) {
    chance = 0.3;
  } else if (remaining >= 6 && remaining <= 15) {
    chance = 0.25;
  } else if (remaining >= 16 && remaining <= 25) {
    chance = 0.2;
  } else {
    return false;
  }

  if (Math.random() >= chance) return false;

  const capacityLeft = Math.max(0, MAX_BOARD_CELLS - state.battle.opponentRemaining);
  if (capacityLeft <= 0) return false;

  const addCount = Math.min(state.battle.opponentRemaining, capacityLeft);
  if (addCount <= 0) return false;

  state.battle.opponentRemaining += addCount;
  state.battle.opponentPlusUses += 1;
  showPlusBubble('opponent');
  return true;
}

function runBotTurn() {
  if (!state.battleMode || !state.battle || state.battle.ended) return;

  const config = BOT_DIFFICULTY_CONFIG[state.botDifficulty] || BOT_DIFFICULTY_CONFIG.medium;

  if (applyBotPlus()) {
    updateBattleStatusUI();
    return;
  }

  state.battle.opponentRemaining = Math.max(0, state.battle.opponentRemaining - 2);
  if (state.battle.opponentRemaining === 0) {
    finishBattle('opponent');
    return;
  }

  updateBattleStatusUI();
}

function startBattleSession() {
  const initialTotal = getRemainingCount();
  const config = BOT_DIFFICULTY_CONFIG[state.botDifficulty] || BOT_DIFFICULTY_CONFIG.medium;

  state.battle = {
    initialTotal,
    playerRemaining: initialTotal,
    opponentRemaining: initialTotal,
    playerPlusUses: 0,
    opponentPlusUses: 0,
    elapsedSec: 0,
    ended: false,
    winner: null,
  };

  updateBattleStatusUI();
  stopBattleTimers();

  battleClockTimer = setInterval(() => {
    if (!state.battleMode || !state.battle || state.battle.ended) return;
    state.battle.elapsedSec += 1;
    updateBattleStatusUI();
  }, 1000);

  botActionTimer = setInterval(() => {
    runBotTurn();
  }, config.tickMs);
}

function syncPlayerBattleProgress() {
  if (!state.battleMode || !state.battle || state.battle.ended) return;
  state.battle.playerRemaining = getRemainingCount();
  if (state.battle.playerRemaining === 0) {
    finishBattle('player');
    return;
  }
  updateBattleStatusUI();
}

function applyPlayerMistake() {
  // Battle mode no longer has mistake-limit defeat; keep board interaction behavior unchanged.
  if (!state.battleMode || !state.battle || state.battle.ended) return;
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

function renderBoardValues() {
  if (!tileGrid) return;
  const cells = tileGrid.querySelectorAll('.cell');

  for (let i = 0; i < cells.length; i += 1) {
    const cell = cells[i];
    const value = state.values[i];
    const isSelected = state.selectedIndex === i;
    const isHinted = state.hintIndexes.includes(i);

    cell.classList.toggle('filled', value !== null);
    cell.classList.toggle('selected', isSelected);
    cell.classList.toggle('hinted', isHinted);
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
  if (!(valueA === valueB || valueA + valueB === 10)) return false;

  if (isCrossRowEdgePair(indexA, indexB)) return true;
  if (!isLineAligned(indexA, indexB)) return false;

  return hasNoBlockingNumbers(indexA, indexB);
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

  let insertIndex = getLastFilledIndex() + 1;
  for (const value of remaining) {
    if (insertIndex >= state.values.length) break;
    state.values[insertIndex] = value;
    insertIndex += 1;
  }

  state.selectedIndex = null;
  state.hintIndexes = [];
  renderBoardValues();

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
    state.values[selected] = null;
    state.values[index] = null;
    collapseClearedRows();
    state.selectedIndex = null;
    renderBoardValues();
    syncPlayerBattleProgress();
    return;
  }

  applyPlayerMistake();
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
  renderBoardValues();
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
