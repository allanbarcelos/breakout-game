// WebSocket com protocolo correto (http/ws ou https/wss)
const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';

const pathParts = window.location.pathname.split('/');
pathParts.pop();
const basePath = pathParts.join('/');

const wsUrl = `${protocol}://${window.location.host}${basePath}/ws`;

let ws = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const reconnectDelay = 3000;

let userId = null;
let currentUsername = '';
const gameId = 'breakout';

// Elementos DOM
const grid = document.querySelector('.grid');
const scoreDisplay = document.querySelector('#score');
const bodyScoreBoard = document.querySelector('#scoreboard-body');
const userNameInput = document.querySelector('#username');
const buttonStart = document.querySelector('#buttonStart');
const restart = document.querySelector('#restart');

// Configurações do jogo
const blockWidth = 100;
const blockHeight = 20;
const boardWidth = 560;
const boardHeight = 300;
const ballDiameter = 20;

const colors = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#ec4899', '#fb923c'];

let userCurrentPosition = [230, 10];
let ballCurrentPosition = [270, 40];
let xDirection = 2;
let yDirection = 2;
let score = 0;
let level = 1;
let timerId = null;
let blocks = [];

// Classes e elementos
class Block {
    constructor(xAxis, yAxis) {
        this.bottomLeft = [xAxis, yAxis];
        this.bottomRight = [xAxis + blockWidth, yAxis];
        this.topLeft = [xAxis, yAxis + blockHeight];
        this.topRight = [xAxis + blockWidth, yAxis + blockHeight];
    }
}

// --- WebSocket Connection ---

function connectWebSocket() {
    try {
        ws = new WebSocket(wsUrl);
        setupWebSocketHandlers();
    } catch (error) {
        console.error('Erro ao criar WebSocket:', error);
        scheduleReconnect();
    }
}

function setupWebSocketHandlers() {
    ws.onopen = () => {
        console.log("Connected to WebSocket server");
        reconnectAttempts = 0;

        // Se já temos um username, registra automaticamente
        if (currentUsername) {
            registerUser();
        }

        getScores(); // Carrega leaderboard
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            const payload = data?.payload;

            if (payload === 'register') {
                userId = data?.user_id;
                console.log("Registered:", currentUsername, userId);
            }

            if (payload === 'error') {
                // Mensagem de erro do backend
                alert(data.data?.message || 'Erro desconhecido');

                // Se for erro de registro, permite tentar novamente
                if (data.data?.message?.includes('usuário') || data.data?.message?.includes('username')) {
                    currentUsername = '';
                    userNameInput.removeAttribute('disabled');
                    buttonStart.removeAttribute('disabled');
                }
            }

            if (payload === 'get-scores' || payload === 'set-score') {
                const scores = data?.data || [];
                updateScoreboard(scores);
            }
        } catch (err) {
            console.error("Erro ao processar mensagem:", err);
        }
    };

    ws.onerror = (error) => {
        console.error("WebSocket Error:", error);
    };

    ws.onclose = (event) => {
        console.log("WebSocket desconectado:", event.code, event.reason);

        if (event.code !== 1000) { // Não reconecta se foi desconexão normal
            scheduleReconnect();
        }
    };
}

function scheduleReconnect() {
    if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++;
        const delay = reconnectDelay * reconnectAttempts;
        console.log(`Tentando reconectar em ${delay / 1000}s... (tentativa ${reconnectAttempts}/${maxReconnectAttempts})`);

        setTimeout(() => {
            connectWebSocket();
        }, delay);
    } else {
        console.error("Não foi possível reconectar após", maxReconnectAttempts, "tentativas");
        alert("Conexão perdida com o servidor. Recarregue a página para tentar novamente.");
    }
}

// Inicializa a conexão quando a página carrega
document.addEventListener('DOMContentLoaded', function () {
    connectWebSocket();
});

// --- Funções de comunicação ---

function registerUser() {
    const username = userNameInput.value.trim();

    if (username.length !== 5) {
        alert('Username must be exactly 5 characters.');
        return false;
    }

    currentUsername = username;

    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(`/register ${username} ${gameId}`);
        return true;
    } else {
        alert('Connecting to server... Try again in a moment.');
        connectWebSocket(); // Tenta reconectar
        return false;
    }
}

function getScores() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(`/get-scores ${gameId}`);
    } else {
        console.warn('WebSocket não está conectado');
    }
}

function setScore() {
    if (ws && ws.readyState === WebSocket.OPEN && userId) {
        ws.send(`/set-score ${userId} ${score}`);
        setTimeout(getScores, 400); // Atualiza leaderboard
    }
}

// Restante do código do jogo permanece igual...
// [O restante do código do jogo continua exatamente como estava]

// Criar blocos
function createBlocks() {
    blocks = [
        ...Array(5).fill().map((_, i) => new Block(10 + i * 110, 270)),
        ...Array(5).fill().map((_, i) => new Block(10 + i * 110, 240)),
        ...Array(5).fill().map((_, i) => new Block(10 + i * 110, 210)),
    ];
}

function addBlocks() {
    createBlocks();
    blocks.forEach(block => {
        const el = document.createElement('div');
        el.classList.add('block');
        el.style.left = block.bottomLeft[0] + 'px';
        el.style.bottom = block.bottomLeft[1] + 'px';
        el.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        grid.appendChild(el);
    });
}

// Plataforma do usuário
const user = document.createElement('div');
user.classList.add('user', 'hidden');
grid.appendChild(user);

function drawUser() {
    user.style.left = userCurrentPosition[0] + 'px';
    user.style.bottom = userCurrentPosition[1] + 'px';
}

// Bola
const ball = document.createElement('div');
ball.classList.add('ball', 'hidden');
grid.appendChild(ball);

function drawBall() {
    ball.style.left = ballCurrentPosition[0] + 'px';
    ball.style.bottom = ballCurrentPosition[1] + 'px';
}

// Controles
function moveUser(e) {
    if (e.key === 'ArrowLeft' && userCurrentPosition[0] > 0) {
        userCurrentPosition[0] -= 15;
        drawUser();
    }
    if (e.key === 'ArrowRight' && userCurrentPosition[0] < boardWidth - blockWidth) {
        userCurrentPosition[0] += 15;
        drawUser();
    }
}

document.addEventListener('keydown', moveUser);

// Movimento da bola
function moveBall() {
    ballCurrentPosition[0] += xDirection;
    ballCurrentPosition[1] += yDirection;
    drawBall();
    checkForCollisions();
}

// Iniciar jogo
function start() {
    if (!registerUser()) return;

    addBlocks();
    drawUser();
    drawBall();
    showGameElements();

    // Esconde a mensagem neon
    document.getElementById('neonMessage').classList.add('hidden');

    timerId = setInterval(moveBall, Math.max(15, 30 / level));
    userNameInput.setAttribute('disabled', true);
    buttonStart.setAttribute('disabled', true);
    restart.classList.add('hidden');
}

// Colisões
function checkForCollisions() {
    // Blocos
    for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        if (
            ballCurrentPosition[0] > b.bottomLeft[0] && ballCurrentPosition[0] < b.bottomRight[0] &&
            ballCurrentPosition[1] + ballDiameter > b.bottomLeft[1] && ballCurrentPosition[1] < b.topLeft[1]
        ) {
            document.querySelectorAll('.block')[i].remove();
            blocks.splice(i, 1);
            changeDirection();
            score++;
            scoreDisplay.innerHTML = score;
            setScore();

            if (blocks.length === 0) {
                nextLevel();
            }
            return;
        }
    }

    // Paredes
    if (
        ballCurrentPosition[0] >= (boardWidth - ballDiameter) ||
        ballCurrentPosition[1] >= (boardHeight - ballDiameter) ||
        ballCurrentPosition[0] <= 0
    ) {
        changeDirection();
    }

    // Plataforma
    if (
        ballCurrentPosition[0] > userCurrentPosition[0] &&
        ballCurrentPosition[0] < userCurrentPosition[0] + blockWidth &&
        ballCurrentPosition[1] > userCurrentPosition[1] &&
        ballCurrentPosition[1] < userCurrentPosition[1] + blockHeight
    ) {
        changeDirection();
    }

    // Game Over
    if (ballCurrentPosition[1] <= 0) {
        endGame();
    }
}

function changeDirection() {
    if (xDirection === 2 && yDirection === 2) {
        yDirection = -2;
    } else if (xDirection === 2 && yDirection === -2) {
        xDirection = -2;
    } else if (xDirection === -2 && yDirection === -2) {
        yDirection = 2;
    } else if (xDirection === -2 && yDirection === 2) {
        xDirection = 2;
    }
}

function nextLevel() {
    level++;
    clearInterval(timerId);
    ballCurrentPosition = [270, 40];
    xDirection = 2;
    yDirection = 2;
    addBlocks();
    timerId = setInterval(moveBall, Math.max(15, 30 / level));
}

function endGame() {
    clearInterval(timerId);
    scoreDisplay.innerHTML = 'Game Over';
    document.removeEventListener('keydown', moveUser);
    restart.classList.remove('hidden');
    setScore(); // Envia score final
}

function showGameElements() {
    document.querySelectorAll('.block, .user, .ball').forEach(el => {
        el.classList.remove('hidden');
    });
}

// --- Scoreboard Visual ---

function updateScoreboard(scores) {
    const tbody = bodyScoreBoard;
    tbody.innerHTML = '';

    if (!scores.length) {
        tbody.innerHTML = `<tr><td colspan="2" class="text-center text-gray-500 py-8">No scores yet</td></tr>`;
        return;
    }

    scores.forEach((entry, i) => {
        const { username, score } = entry;
        const isCurrentUser = username === currentUsername;

        const row = document.createElement('tr');
        row.className = `
            transition-all duration-300 hover:bg-purple-50 border-b border-gray-100
            ${i < 3 ? 'font-bold' : ''}
            ${isCurrentUser ? 'bg-green-50 hover:bg-green-100' : ''}
        `;

        const medal = i === 0 ? 'bg-yellow-400 text-yellow-900' :
            i === 1 ? 'bg-gray-400 text-gray-900' :
                i === 2 ? 'bg-orange-600 text-white' : '';

        const rank = i < 3
            ? `<span class="inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${medal}">
                 ${i + 1}
               </span>`
            : `<span class="text-gray-500 text-sm w-8 text-center">${i + 1}</span>`;

        row.innerHTML = `
            <td class="px-4 py-3 flex items-center gap-2">
                ${rank}
                <span class="truncate max-w-28 font-medium ${isCurrentUser ? 'text-green-700' : ''}">
                    ${username}
                </span>
                ${isCurrentUser ? '<span class="text-xs text-green-600 font-bold">YOU</span>' : ''}
            </td>
            <td class="px-4 py-3 text-right font-mono text-purple-700 font-bold">
                ${score.toLocaleString()}
            </td>
        `;

        tbody.appendChild(row);
    });

    // Animação de entrada
    tbody.querySelectorAll('tr').forEach((r, i) => {
        r.style.opacity = '0';
        r.style.transform = 'translateY(8px)';
        setTimeout(() => {
            r.style.transition = 'all 0.3s ease';
            r.style.opacity = '1';
            r.style.transform = 'translateY(0)';
        }, i * 60);
    });
}

// Atualiza leaderboard a cada 10 segundos
setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
        getScores();
    }
}, 10000);

// Inicializa score
scoreDisplay.innerHTML = score;