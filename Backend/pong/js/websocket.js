const fastify = require("fastify")({ logger: true });
fastify.register(require("@fastify/websocket"));

const clients = new Set();

let playerReady = new Set();

const waitingClients = {}

function setupWebSocket(fastify, gameState, update, check_score, new_game) {
	fastify.get("/ws/pong", { websocket: true }, (connection, req) => {
        clients.add(connection);
        console.log("Nouvelle connexion WebSocket !");
        
        connection.socket.on("message", (message) => {
            const data = JSON.parse(message.toString());
            if (data.username1 && data.username2) {
                gameState.paddles.player1.name = data.username1;
                gameState.paddles.player2.name = data.username2;
            }
            if (data.player) {
				handlePlayerMovement(data, gameState);
			}
            if (data.game === "new") {
                playerReady.add(data.player);
                if (playerReady.size == 2) {
                    console.log("🎮 Les deux joueurs sont prêts, démarrage du jeu !");
                    new_game();
                }
            }
        });
        
        connection.socket.on("close", () => {
			clients.delete(connection);
            for (const username in waitingClients) {
                if (waitingClients[username] === connection.socket) {
                    console.log(`❌ ${username} s'est déconnecté.`);
                    delete waitingClients[username];
                }
            }
            playerReady.clear();
            console.log("Connexion WebSocket fermée.");
        });

		function gameLoop() {
            if (gameState.game.state == 1) {
              update();
              check_score();
              clients.forEach(client => {
                  client.socket.send(JSON.stringify({ gameState }));
              });
          }
        }
		setInterval(gameLoop, 16);
	});

	function handlePlayerMovement(data, gameState) {
		const moving = {
			player1: { up: false, down: false },
			player2: { up: false, down: false }
		};
	
		if (data.player === "player1") {
			if (data.move === "up") {
				moving.player1.up = true;
				moving.player1.down = false;
			} else if (data.move === "down") {
				moving.player1.down = true;
				moving.player1.up = false;
			} else if (data.move === "stop") {
				moving.player1.up = false;
				moving.player1.down = false;
			}
		}
		if (data.player === "player2") {
			if (data.move === "up") {
				moving.player2.up = true;
				moving.player2.down = false;
			} else if (data.move === "down") {
				moving.player2.down = true;
				moving.player2.up = false;
			} else if (data.move === "stop") {
				moving.player2.up = false;
				moving.player2.down = false;
			}
		}
	}
}

module.exports = { setupWebSocket, waitingClients };