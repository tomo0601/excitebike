const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'index.html');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add Socket.IO script
content = content.replace('</title>', '</title>\n    <script src="/socket.io/socket.io.js"></script>');

// 2. Modify Player constructor to accept colorConfig and use own keys
content = content.replace(
    'constructor() {\n                this.reset();\n                this.width = 50;\n                this.height = 30;\n                this.wheelBase = 30;\n            }',
    `constructor(colorConfig = null) {
                this.width = 50;
                this.height = 30;
                this.wheelBase = 30;
                this.keys = { ArrowRight: false, ArrowLeft: false, ArrowUp: false, ArrowDown: false, KeyX: false, KeyZ: false };
                this.keysJustPressed = { ArrowUp: false, ArrowDown: false };
                this.colorConfig = colorConfig;
                this.reset();
            }`
);

// 3. Replace keys with this.keys in Player methods
// In update()
content = content.replace(/keysJustPressed/g, 'this.keysJustPressed');
// However, there is a global keysJustPressed which we might also replace accidentally?
// We only want to replace inside Player. Let's do it carefully.
// Instead of full replace, let's just replace all `keys.` with `this.keys.` and `keysJustPressed.` with `this.keysJustPressed.` in the Player class block.
// Wait, global keys is used in main loop too.
// Let's replace global `keys` in Player class.
let playerClassStart = content.indexOf('class Player {');
let rivalClassStart = content.indexOf('class Rival {');
let playerClassCode = content.substring(playerClassStart, rivalClassStart);

playerClassCode = playerClassCode.replace(/keysJustPressed\.ArrowUp/g, 'this.keysJustPressed.ArrowUp');
playerClassCode = playerClassCode.replace(/keysJustPressed\.ArrowDown/g, 'this.keysJustPressed.ArrowDown');
playerClassCode = playerClassCode.replace(/keys\.KeyZ/g, 'this.keys.KeyZ');
playerClassCode = playerClassCode.replace(/keys\.KeyX/g, 'this.keys.KeyX');
playerClassCode = playerClassCode.replace(/keys\.ArrowRight/g, 'this.keys.ArrowRight');
playerClassCode = playerClassCode.replace(/keys\.ArrowLeft/g, 'this.keys.ArrowLeft');

// Replace colors in drawBikeBody and drawRider
playerClassCode = playerClassCode.replace(
    "ctx.fillStyle = '#ff5b4a';",
    "ctx.fillStyle = this.colorConfig ? this.colorConfig.frame : '#ff5b4a';"
);
playerClassCode = playerClassCode.replace(
    "ctx.fillStyle = '#d62c1a';",
    "ctx.fillStyle = this.colorConfig ? this.colorConfig.frameShade : '#d62c1a';"
);
playerClassCode = playerClassCode.replace(
    "const suit = isCrashed ? '#8d9398' : (this.overheated ? '#c0392b' : '#2e86de');",
    "const suit = isCrashed ? '#8d9398' : (this.overheated ? '#c0392b' : (this.colorConfig ? this.colorConfig.suit : '#2e86de'));"
);
playerClassCode = playerClassCode.replace(
    "const suitShade = isCrashed ? '#6c7479' : (this.overheated ? '#922b21' : '#1b4f8a');",
    "const suitShade = isCrashed ? '#6c7479' : (this.overheated ? '#922b21' : (this.colorConfig ? this.colorConfig.suitShade : '#1b4f8a'));"
);
playerClassCode = playerClassCode.replace(
    "ctx.fillStyle = isCrashed ? '#7f8c8d' : '#f1c40f';",
    "ctx.fillStyle = isCrashed ? '#7f8c8d' : (this.colorConfig ? this.colorConfig.helmet : '#f1c40f');"
);

content = content.substring(0, playerClassStart) + playerClassCode + content.substring(rivalClassStart);

// 4. Global keys update to player.keys
content = content.replace(
    'if (keys.hasOwnProperty(code)) {',
    `if (keys.hasOwnProperty(code)) {
                if (!player.keys[code] && player.keysJustPressed.hasOwnProperty(code)) player.keysJustPressed[code] = true;
                player.keys[code] = true;`
);
content = content.replace(
    'if (keys.hasOwnProperty(e.code)) keys[e.code] = false;',
    `if (keys.hasOwnProperty(e.code)) {
                keys[e.code] = false;
                player.keys[e.code] = false;
            }`
);
content = content.replace(
    "if (!keys[code] && keysJustPressed.hasOwnProperty(code)) keysJustPressed[code] = true;",
    ""
);

// 5. Setup Network Players
content = content.replace(
    'const player = new Player();',
    `const player = new Player();
        const networkPlayers = {}; // id -> Player`
);

content = content.replace(
    'player.update();',
    `player.update();
                for (const id in networkPlayers) networkPlayers[id].update();`
);

content = content.replace(
    'keysJustPressed.ArrowUp = false; keysJustPressed.ArrowDown = false;',
    `keysJustPressed.ArrowUp = false; keysJustPressed.ArrowDown = false;
            player.keysJustPressed.ArrowUp = false; player.keysJustPressed.ArrowDown = false;
            for (const id in networkPlayers) {
                networkPlayers[id].keysJustPressed.ArrowUp = false;
                networkPlayers[id].keysJustPressed.ArrowDown = false;
            }`
);
// Replace twice because it appears twice in update()
content = content.replace(
    'keysJustPressed.ArrowUp = false; keysJustPressed.ArrowDown = false;',
    `keysJustPressed.ArrowUp = false; keysJustPressed.ArrowDown = false;
            player.keysJustPressed.ArrowUp = false; player.keysJustPressed.ArrowDown = false;
            for (const id in networkPlayers) {
                networkPlayers[id].keysJustPressed.ArrowUp = false;
                networkPlayers[id].keysJustPressed.ArrowDown = false;
            }`
);


content = content.replace(
    'if (playerObj) bikes.push({ lane: Math.round(playerObj.currentLane), obj: playerObj });',
    `if (playerObj) bikes.push({ lane: Math.round(playerObj.currentLane), obj: playerObj });
                for (const id in networkPlayers) bikes.push({ lane: Math.round(networkPlayers[id].currentLane), obj: networkPlayers[id] });`
);

content = content.replace(
    'player.reset();',
    `player.reset();
            for (const id in networkPlayers) networkPlayers[id].reset();`
);

// 6. Socket.IO connection and Controller mode logic
const socketLogic = `
        const socket = typeof io !== 'undefined' ? io() : null;
        const urlParams = new URLSearchParams(window.location.search);
        const isController = urlParams.get('role') === 'controller';

        if (isController) {
            // コントローラー用のUI設定
            document.getElementById('game-container').style.display = 'none';
            document.getElementById('mobile-controls').style.display = 'flex';
            document.getElementById('mobile-controls').style.flexDirection = 'row';
            document.getElementById('mobile-controls').style.height = '100vh';
            document.getElementById('mobile-controls').style.alignItems = 'center';
            document.getElementById('mobile-controls').style.margin = '0';
            
            document.body.style.backgroundColor = '#222';
            document.body.innerHTML += '<div style="position:absolute; top:20px; left:20px; color:#fff; font-size:24px;" id="controller-msg">ホストに接続しました。画面を見て操作してください。</div>';

            if (socket) {
                socket.emit('register', 'controller');
                
                socket.on('player_info', (info) => {
                    // 自分の色が割り当てられたらUIに反映するなどの処理も可能
                    document.getElementById('controller-msg').style.color = info.color.frame;
                });
            }

            // コントローラーの入力をサーバーへ送信
            function sendInput(type, code) {
                if (socket) socket.emit('player_input', { type, code });
            }

            // モバイル操作のバインド上書き
            function bindTouch(id, code) {
                const btn = document.getElementById(id);
                if (!btn) return;
                btn.addEventListener('touchstart', (e) => { e.preventDefault(); sendInput('keydown', code); });
                btn.addEventListener('touchend', (e) => { e.preventDefault(); sendInput('keyup', code); });
                btn.addEventListener('touchcancel', (e) => { e.preventDefault(); sendInput('keyup', code); });
            }

            bindTouch('btn-accel', 'KeyX'); bindTouch('btn-turbo', 'KeyZ');
            bindTouch('btn-up', 'ArrowUp'); bindTouch('btn-down', 'ArrowDown');
            bindTouch('btn-left', 'ArrowLeft'); bindTouch('btn-right', 'ArrowRight');

        } else {
            // ホスト用の設定
            if (socket) {
                socket.emit('register', 'host');

                socket.on('current_players', (playersMap) => {
                    for (const id in playersMap) {
                        const p = playersMap[id];
                        const np = new Player(p.color);
                        np.targetLane = p.lane;
                        np.currentLane = p.lane;
                        networkPlayers[id] = np;
                    }
                });

                socket.on('player_joined', (p) => {
                    const np = new Player(p.color);
                    np.targetLane = p.lane;
                    np.currentLane = p.lane;
                    networkPlayers[p.id] = np;
                });

                socket.on('player_left', (p) => {
                    if (networkPlayers[p.id]) {
                        delete networkPlayers[p.id];
                    }
                });

                socket.on('player_input', (data) => {
                    const np = networkPlayers[data.id];
                    if (np) {
                        if (data.input.type === 'keydown') {
                            if (!np.keys[data.input.code] && np.keysJustPressed.hasOwnProperty(data.input.code)) {
                                np.keysJustPressed[data.input.code] = true;
                            }
                            np.keys[data.input.code] = true;
                        } else if (data.input.type === 'keyup') {
                            np.keys[data.input.code] = false;
                        }
                    }
                });
            }
`;

content = content.replace(
    "const canvas = document.getElementById('gameCanvas');",
    socketLogic + "\n        const canvas = document.getElementById('gameCanvas');"
);

// Controller Mode return early for host-specific logic
content = content.replace(
    "// --- メインループ ---",
    "if (isController) { window.update = ()=>{}; window.draw = ()=>{}; window.gameLoop = ()=>{}; } // Controller doesn't run game loop\n        // --- メインループ ---"
);

content = content.replace(
    "track.generate();\n        track.draw(player);",
    "if (!isController) {\n            track.generate();\n            track.draw(player);\n        }"
);

// Prevent regular keybindings and mobile bind if controller (already handled by redefining bindTouch before)
content = content.replace(
    "bindTouch('btn-accel', 'KeyX'); bindTouch('btn-turbo', 'KeyZ');",
    "if (!isController) {\n            bindTouch('btn-accel', 'KeyX'); bindTouch('btn-turbo', 'KeyZ');\n            bindTouch('btn-up', 'ArrowUp'); bindTouch('btn-down', 'ArrowDown');\n            bindTouch('btn-left', 'ArrowLeft'); bindTouch('btn-right', 'ArrowRight');\n        }"
);
content = content.replace(
    "bindTouch('btn-up', 'ArrowUp'); bindTouch('btn-down', 'ArrowDown');",
    ""
);
content = content.replace(
    "bindTouch('btn-left', 'ArrowLeft'); bindTouch('btn-right', 'ArrowRight');",
    ""
);

// 7. Change QR URL
content = content.replace(
    "const url = location.href;",
    "const url = location.href.split('?')[0] + '?role=controller';"
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Patch applied.');
