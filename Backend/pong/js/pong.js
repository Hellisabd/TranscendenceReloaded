const fastify = require("fastify")({ logger: true });
fastify.register(require("@fastify/websocket"));

const { setupWebSocket, waitingClients } = require("./websocket");

let waiting_room = [];

let players = {}

let gameState = {
    ball: { x: 500, y: 250 },
    paddles: { player1: { name: "C", y: 200 }, player2: { name: "B", y: 200 } },
    score: { player1: 0, player2: 0 },
    game: { state: 0 }
};
let ballSpeedX = 0.8;
let ballSpeedY = 0.8;
let move = 5;
let speed = Math.sqrt(ballSpeedX * ballSpeedX + ballSpeedY * ballSpeedY);
const arena_height = 500;
const arena_width = 1000;
const paddleWidth = 20;
const paddleHeight = 100;
const ballRadius = 10;

let moving = { player1: { up: false, down: false }, player2: { up: false, down: false } };

    
function update() {
    if (moving.player1.up && gameState.paddles.player1.y > 0) {
        gameState.paddles.player1.y -= move;
    }
    if (moving.player1.down && gameState.paddles.player1.y < arena_height - paddleHeight) {
        gameState.paddles.player1.y += move;
    }
    if (moving.player2.up && gameState.paddles.player2.y > 0) {
        gameState.paddles.player2.y -= move;
    }
    if (moving.player2.down && gameState.paddles.player2.y < arena_height - paddleHeight) {
        gameState.paddles.player2.y += move;
    }

    gameState.ball.x += ballSpeedX;
    gameState.ball.y += ballSpeedY;

    if (gameState.ball.y + ballRadius > arena_height || gameState.ball.y - ballRadius < 0)
        ballSpeedY = -ballSpeedY;
    if (gameState.ball.x - ballRadius < paddleWidth && gameState.ball.y > gameState.paddles.player1.y && gameState.ball.y < gameState.paddles.player1.y + paddleHeight) {
        ballSpeedX = -ballSpeedX * 1.1;
        if (ballSpeedX > 15)
            ballSpeedX = 15;
    }  
    if (gameState.ball.x + ballRadius > arena_width - paddleWidth && gameState.ball.y > gameState.paddles.player2.y && gameState.ball.y < gameState.paddles.player2.y + paddleHeight) {
        ballSpeedX = -ballSpeedX * 1.1;
        if (ballSpeedX < -15)
            ballSpeedX = -15;
    }
    if (gameState.ball.x - ballRadius < 0) {
        gameState.score.player2++;
        resetBall();
    }
    if (gameState.ball.x + ballRadius > arena_width) {
        gameState.score.player1++;
        resetBall();
    }
}

function resetBall() {
    gameState.ball.x = arena_width / 2;
    gameState.ball.y = arena_height / 2;
    ballSpeedX /= 2;
    if (ballSpeedX < 0.8)
        ballSpeedX = 0.8;
    ballSpeedY /= 2;
    if (ballSpeedY < 0.8)
        ballSpeedY = 0.8;
    speed = Math.sqrt(ballSpeedX * ballSpeedX + ballSpeedY * ballSpeedY);
    let angle;
    if (Math.random() < 0.5) {
        angle = Math.random() * (Math.PI / 2) - Math.PI / 4;
    }
    else {
        angle = Math.random() * (Math.PI / 2) + (3 * Math.PI) / 4;
    }
    ballSpeedX = speed * Math.cos(angle);
    ballSpeedY = speed * Math.sin(angle);
}

function new_game() {
    gameState.game.state = 1;
    gameState.score.player1 = 0;
    gameState.score.player2 = 0;
    ballSpeedX = 1.6;
    ballSpeedY = 1.6;
    move = 5;
    resetBall();
}

function check_score() {
    if (gameState.score.player1 == 3 || gameState.score.player2 == 3)
        gameState.game.state = 0;
}

setupWebSocket(fastify, gameState, update, check_score, new_game);

fastify.post("/waiting_room", async (req, reply) => {
    const {username} = req.body;
    if (!username) {
        return reply.code(200).send({ success: false, error: "Username manquant" });
    } if (waiting_room.includes(username)) {
        return reply.code(200).send({ success: false, error: "User already in queue" });
    } else {
        waiting_room.push(username);
        if (waiting_room.length < 2) {
            return reply.code(200).send({ success: true, message: "Match not ready" });
        } else {
            const username1 = waiting_room.shift();
            const username2 = waiting_room.shift();
            console.log(`username1::::: ${username1} username2 :::::: ${username2}`);
            if (waitingClients[username1]) {
                waitingClients[username1].send(JSON.stringify({
                    action: "start_game",
                    username1,
                    username2
                }));
            }
            if (waitingClients[username2]) {
                waitingClients[username2].send(JSON.stringify({
                    action: "start_game",
                    username1,
                    username2
                }));
            }
            return reply.code(200).send({ success: true, "username1": username1, "username2": username2 });
        }
    }
})

const start = async () => {
    try {
        await fastify.listen({ port: 4000, host: "0.0.0.0" });
        console.log("🎮 Pong WebSocket Server running on port 4000");
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();