const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // 本番環境では XSERVERのドメイン（例: "https://your-domain.com"）に制限することを推奨します
        methods: ["GET", "POST"]
    }
});

// 静的ファイルの提供
app.use(express.static(path.join(__dirname)));

// メインページへのアクセス（一応明示的にもルーティング）
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ゲーム状態の管理
// 単純化のため、グローバルで1つの部屋を共有する形にします
let hostId = null;
const players = {}; // id -> { id, lane, ready, colorIndex }

// 使用可能なカラー（フレーム色など）
const colors = [
    { frame: '#ff5b4a', frameShade: '#d62c1a', suit: '#2e86de', suitShade: '#1b4f8a', helmet: '#f1c40f' }, // Player 1 (Red)
    { frame: '#3498db', frameShade: '#1f6391', suit: '#ecf0f1', suitShade: '#aeb6bf', helmet: '#ffffff' }, // Player 2 (Blue)
    { frame: '#2ecc71', frameShade: '#27ae60', suit: '#f1c40f', suitShade: '#f39c12', helmet: '#e67e22' }, // Player 3 (Green)
    { frame: '#9b59b6', frameShade: '#8e44ad', suit: '#e74c3c', suitShade: '#c0392b', helmet: '#34495e' }  // Player 4 (Purple)
];
let nextColorIndex = 0;

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // クライアントからの役割宣言（host か controller か）
    socket.on('register', (role) => {
        if (role === 'host') {
            console.log(`Host registered: ${socket.id}`);
            hostId = socket.id;
            socket.emit('host_registered', { hostId: socket.id });
            // 既存のプレイヤー情報をホストに送る
            socket.emit('current_players', players);
        } else if (role === 'controller') {
            console.log(`Controller registered: ${socket.id}`);
            // プレイヤーとして追加
            const color = colors[nextColorIndex % colors.length];
            const newPlayer = {
                id: socket.id,
                lane: nextColorIndex % 4, // 0〜3のレーンに割り当て
                color: color,
                ready: false
            };
            players[socket.id] = newPlayer;
            nextColorIndex++;

            // ホストへ通知
            if (hostId) {
                io.to(hostId).emit('player_joined', newPlayer);
            }
            // クライアントに自分の情報を送る
            socket.emit('player_info', newPlayer);
        }
    });

    // コントローラーからの入力受信
    // input = { type: 'keydown'|'keyup', code: 'KeyX' } などの形式
    socket.on('player_input', (input) => {
        if (hostId && players[socket.id]) {
            // ホストへ入力を転送
            io.to(hostId).emit('player_input', {
                id: socket.id,
                input: input
            });
        }
    });

    // コントローラーからの「準備完了（STARTボタン）」受信
    socket.on('player_ready', () => {
        if (players[socket.id]) {
            players[socket.id].ready = true;
            if (hostId) {
                io.to(hostId).emit('player_ready', { id: socket.id });
            }
        }
    });

    // 切断時の処理
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        if (socket.id === hostId) {
            hostId = null;
            console.log('Host disconnected');
        } else if (players[socket.id]) {
            delete players[socket.id];
            if (hostId) {
                io.to(hostId).emit('player_left', { id: socket.id });
            }
        }
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`Network access: http://<YOUR_LOCAL_IP>:${PORT}/`);
});
