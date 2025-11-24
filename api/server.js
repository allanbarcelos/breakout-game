const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class ScoreServer {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3000;
        this.server = http.createServer(this.app);
        this.wss = new WebSocket.Server({ server: this.server });
        
        this.dbPath = path.join(__dirname, 'scores.db');
        this.db = null;
        
        this.initialize();
    }

    initialize() {
        this.setupDatabase();
        this.setupMiddleware();
        this.setupWebSocket();
        this.startServer();
    }

    setupDatabase() {
        this.db = new sqlite3.Database(this.dbPath);
        
        this.db.serialize(() => {
            this.db.run(`
                CREATE TABLE IF NOT EXISTS scores (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    gameId TEXT NOT NULL,
                    username TEXT NOT NULL,
                    score INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE (gameId, username)
                )
            `);

            // Índice para melhor performance nas consultas
            this.db.run(`
                CREATE INDEX IF NOT EXISTS idx_scores_game_score 
                ON scores(gameId, score DESC)
            `);
        });
    }

    setupMiddleware() {
        this.app.use(express.static('public'));
        this.app.use(express.json());
        
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({ status: 'OK', timestamp: new Date().toISOString() });
        });
    }

    setupWebSocket() {
        this.wss.on('connection', (ws) => {
            console.log('Novo cliente conectado');
            this.handleWebSocketConnection(ws);
        });

        this.wss.on('error', (error) => {
            console.error('WebSocket server error:', error);
        });
    }

    handleWebSocketConnection(ws) {
        ws.on('message', async (message) => {
            try {
                await this.handleMessage(ws, message);
            } catch (error) {
                console.error('Error handling message:', error);
                this.send(ws, 'error', { message: 'Erro interno do servidor' });
            }
        });

        ws.on('close', () => {
            console.log('Cliente desconectado');
        });

        ws.on('error', (error) => {
            console.error('WebSocket client error:', error);
        });
    }

    async handleMessage(ws, message) {
        const msg = message.toString().trim();
        const [command, ...args] = msg.split(' ');

        switch (command) {
            case '/register':
                await this.handleRegister(ws, args);
                break;
                
            case '/get-scores':
                await this.handleGetScores(ws, args);
                break;
                
            case '/set-score':
                await this.handleSetScore(ws, args);
                break;
                
            default:
                console.log('Comando desconhecido:', command);
                this.send(ws, 'error', { message: 'Comando desconhecido' });
        }
    }

    async handleRegister(ws, args) {
        if (args.length < 2) {
            this.send(ws, 'error', { message: 'Parâmetros insuficientes. Use: /register username gameId' });
            return;
        }

        const [username, gameId] = args;

        try {
            const userId = await this.registerUser(username, gameId);
            this.send(ws, 'register', null, userId);
            
            // Envia ranking atualizado
            await this.broadcastScores(gameId);
            
        } catch (error) {
            if (error.message === 'USERNAME_EXISTS') {
                this.send(ws, 'error', { message: 'Nome de usuário já está em uso neste jogo.' });
            } else {
                throw error;
            }
        }
    }

    registerUser(username, gameId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT id FROM scores WHERE gameId = ? AND username = ?`,
                [gameId, username],
                (err, row) => {
                    if (err) return reject(err);

                    if (row) {
                        return reject(new Error('USERNAME_EXISTS'));
                    }

                    this.db.run(
                        `INSERT INTO scores (gameId, username, score) VALUES (?, ?, ?)`,
                        [gameId, username, 0],
                        function (err) {
                            if (err) return reject(err);
                            resolve(this.lastID);
                        }
                    );
                }
            );
        });
    }

    async handleGetScores(ws, args) {
        if (args.length < 1) {
            this.send(ws, 'error', { message: 'Parâmetros insuficientes. Use: /get-scores gameId' });
            return;
        }

        const gameId = args[0];
        const scores = await this.getScores(gameId);
        this.send(ws, 'get-scores', scores);
    }

    getScores(gameId, limit = 10) {
        return new Promise((resolve, reject) => {
            this.db.all(
                `SELECT id, username, score FROM scores 
                 WHERE gameId = ? 
                 ORDER BY score DESC 
                 LIMIT ?`,
                [gameId, limit],
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                }
            );
        });
    }

    async handleSetScore(ws, args) {
        if (args.length < 2) {
            this.send(ws, 'error', { message: 'Parâmetros insuficientes. Use: /set-score userId increment' });
            return;
        }

        const userId = parseInt(args[0]);
        const increment = parseInt(args[1]) || 1;

        try {
            const gameId = await this.updateUserScore(userId, increment);
            await this.broadcastScores(gameId);
            
        } catch (error) {
            if (error.message === 'USER_NOT_FOUND') {
                this.send(ws, 'error', { message: 'Usuário não encontrado' });
            } else {
                throw error;
            }
        }
    }

    updateUserScore(userId, increment) {
        return new Promise((resolve, reject) => {
            // Primeiro atualiza o score
            this.db.run(
                `UPDATE scores 
                 SET score = score + ?, updated_at = CURRENT_TIMESTAMP 
                 WHERE id = ?`,
                [increment, userId],
                function (err) {
                    if (err) return reject(err);
                    
                    if (this.changes === 0) {
                        return reject(new Error('USER_NOT_FOUND'));
                    }

                    // Recupera o gameId para broadcast
                    this.db.get(
                        `SELECT gameId FROM scores WHERE id = ?`,
                        [userId],
                        (err, row) => {
                            if (err || !row) return reject(new Error('USER_NOT_FOUND'));
                            resolve(row.gameId);
                        }
                    );
                }
            );
        });
    }

    async broadcastScores(gameId) {
        try {
            const scores = await this.getScores(gameId);
            
            this.wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    this.send(client, 'set-score', scores);
                }
            });
        } catch (error) {
            console.error('Error broadcasting scores:', error);
        }
    }

    send(ws, payload, data = null, userId = null) {
        try {
            ws.send(JSON.stringify({ 
                payload, 
                data, 
                user_id: userId,
                timestamp: new Date().toISOString()
            }));
        } catch (error) {
            console.error('Error sending message to client:', error);
        }
    }

    startServer() {
        this.server.listen(this.port, () => {
            console.log(`Servidor rodando em http://localhost:${this.port}`);
        });

        // Graceful shutdown
        process.on('SIGTERM', () => this.shutdown());
        process.on('SIGINT', () => this.shutdown());
    }

    shutdown() {
        console.log('Encerrando servidor...');
        
        this.wss.clients.forEach(client => {
            client.close();
        });
        
        this.wss.close();
        this.server.close();
        
        if (this.db) {
            this.db.close();
        }
        
        process.exit(0);
    }
}

// Inicialização do servidor
new ScoreServer();