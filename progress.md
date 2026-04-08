Original prompt: 制作一个网页小游戏，先搭框架（界面先做出来，先不管逻辑0
1.游戏大厅
2.游戏界面

Progress:
- Created initial static web game scaffold for lobby and game screen UI.

TODO:
- Add real tile matching/gameplay logic later.
- Replace placeholder texture/UI art with production assets if desired.
- Verified lobby and game screen with the web game Playwright client.
- Adjusted shell min-height to avoid clipping on shorter mobile viewports.
- Removed the gray brick placeholder visuals while preserving empty layout space for lobby and game screens.
- Replaced game placeholder with a generated 9x20 board (180 cells) and a viewport that shows 10 visible rows.
- Renamed lobby main CTA to "开始游戏" and re-verified the flow: start -> game screen -> back -> lobby.
- Added battle entry flow: clicking lobby poster opens a new battle screen with layout inspired by the reference (top bar, rival row, rank center, stats, match CTA, bottom tabs).
- Added navigation from battle screen back to lobby using top return button and bottom Home tab.
- Implemented Match flow on battle screen: clicking Match shows a VS popup card over a dim backdrop, then auto-transitions to game screen after 3 seconds.
- Implemented number-match gameplay in game board: initialize 35 digits (1-9) in row-major order, click A then B to remove if same or sum to 10, aligned in row/col/diagonal with no blocking numbers in between.
- Updated game tools to two buttons: plus and hint.
- Plus tool duplicates all current remaining digits and appends them after the last filled digit in row-major order.
- Hint tool highlights one valid removable pair (same number or sum to 10, aligned row/col/diagonal, no blockers between).
- Added battle-mode game status bar between game HUD and board.
- Status bar appears only for games entered via Match flow, and stays hidden for direct lobby game starts.
- Added battle-mode runtime state: player/opponent IDs and avatars, remaining-number progress bars, shared timer, and 3 mistake chances per side with immediate battle result when a side exhausts chances.
- Battle status bar updated: removed progress bars and moved hearts into the same row as score/time context.
- Battle score now shows remaining numbers on board for each side instead of cleared-pair counts.
- Added in-game lose popup (card body over dimmed overlay) for battle defeats.
- Added separate victory settlement screen and route transition when player wins battle.
- Updated rematch flow: NEW GAME on both lose popup and victory screen now returns to battle screen first, auto-opens matching popup, waits 3s, then enters battle-mode game.
- Added lobby bot difficulty selector (high/medium/low).
- Wired battle AI behavior by difficulty:
  - High: current speed, no mistakes.
  - Medium: current speed, can make mistakes.
  - Low: 1/10 speed, can make mistakes.
