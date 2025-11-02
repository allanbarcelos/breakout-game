const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const port = 3000;

// Servir arquivos estáticos do cliente
app.use(express.static('public'));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Configuração do SQLite
const dbPath = path.join(__dirname, 'scores.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // Tabela de scores: jogo, usuário, score
    db.run(`
        CREATE TABLE IF NOT EXISTS scores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            gameId TEXT,
            username TEXT,
            score INTEGER,
            UNIQUE (gameId, username)
        )
    `);
});

// Função para enviar dados para o cliente
function send(ws, payload, data = null, userId = null) {
    ws.send(JSON.stringify({ payload, data, user_id: userId }));
}

// WebSocket
wss.on('connection', (ws) => {
    console.log('Novo cliente conectado');

    ws.on('message', (message) => {
        const msg = message.toString();
        const [command, ...args] = msg.split(' ');

        switch (command) {
            case '/register': {
                const username = args[0];
                const gameId = args[1];

                // Verifica se o nome já existe
                db.get(
                    `SELECT id FROM scores WHERE gameId = ? AND username = ?`,
                    [gameId, username],
                    (err, row) => {
                        if (err) {
                            console.error(err);
                            return;
                        }

                        if (row) {
                            // Usuário já existe
                            send(ws, 'error', { message: 'Nome de usuário já está em uso neste jogo.' });
                            return;
                        }

                        // Insere novo usuário
                        db.run(
                            `INSERT INTO scores (gameId, username, score) VALUES (?, ?, ?)`,
                            [gameId, username, 0],
                            function (err) {
                                if (err) {
                                    console.error(err);
                                    return;
                                }

                                const userId = this.lastID;
                                send(ws, 'register', null, userId);

                                // Envia top 10 scores
                                db.all(
                                    `SELECT * FROM scores WHERE gameId = ? ORDER BY score DESC LIMIT 10`,
                                    [gameId],
                                    (err, rows) => {
                                        if (err) console.error(err);
                                        else send(ws, 'get-scores', rows);
                                    }
                                );
                            }
                        );
                    }
                );
                break;
            }


            case '/get-scores': {
                const gameId = args[0];
                db.all(
                    `SELECT * FROM scores WHERE gameId = ? ORDER BY score DESC LIMIT 10`,
                    [gameId],
                    (err, rows) => {
                        if (err) console.error(err);
                        else send(ws, 'get-scores', rows);
                    }
                );
                break;
            }

            case '/set-score': {
                const userId = parseInt(args[0]);
                const increment = parseInt(args[1]) || 1;

                // Atualiza score do usuário
                db.run(
                    `UPDATE scores SET score = score + ? WHERE id = ?`,
                    [increment, userId],
                    (err) => {
                        if (err) {
                            console.error(err);
                            return;
                        }

                        // Recupera gameId do usuário atualizado
                        db.get(
                            `SELECT gameId FROM scores WHERE id = ?`,
                            [userId],
                            (err, row) => {
                                if (err || !row) return;
                                const gameId = row.gameId;

                                // Envia top 10 scores atualizados para todos clientes
                                db.all(
                                    `SELECT * FROM scores WHERE gameId = ? ORDER BY score DESC LIMIT 10`,
                                    [gameId],
                                    (err, topScores) => {
                                        if (err) return console.error(err);
                                        wss.clients.forEach(client => {
                                            if (client.readyState === WebSocket.OPEN) {
                                                send(client, 'set-score', topScores);
                                            }
                                        });
                                    }
                                );
                            }
                        );
                    }
                );
                break;
            }

            default:
                console.log('Comando desconhecido:', command);
        }
    });

    ws.on('close', () => console.log('Cliente desconectado'));
});

server.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});
