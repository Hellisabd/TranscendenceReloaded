console.log("game.js chargé");

declare function navigateTo(page: string, addHistory: boolean, classement:  { username: string; score: number }[] | null): void;
declare function get_user(): Promise<string | null>;

let mystatus: string | null = null;

let mobile_move_interval: any = null;

let player_id = 0;

let id_tournament: number = 0;

let inTournament:boolean = false;

let lobbyKey: string | null = null;

let socket: WebSocket | null = null;
let Wsocket: WebSocket | null = null;
let Tsocket: WebSocket | null = null;

let disp: boolean = true;
let win: number = 0;

const BLUE_PADDLE = new Image();
BLUE_PADDLE.src = "Frontend/assets/BLUE_PADDLE.png";

const RED_PADDLE = new Image();
RED_PADDLE.src = "Frontend/assets/RED_PADDLE.png";

const WIN_image = new Image();
WIN_image.src = "Frontend/assets/WIN.webp";

const LOSE_image = new Image();
LOSE_image.src = "Frontend/assets/LOSE.webp";

async function play_pong() {
    Disconnect_from_game();
    const user = await get_user();

    fetch("/update_status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({"status": "inqueue"})
    });
    mystatus = "inqueue";
    const sock_name = window.location.host;
    Wsocket = new WebSocket("wss://" + sock_name + "/ws/matchmaking/pong");
    Wsocket.onopen = () => {
        console.log("✅ WebSocket waiting connectée !");
        Wsocket?.send(JSON.stringify({ username: user }));
    };
    Wsocket.onerror = (event) => {
        console.error("❌ WebSocket waiting erreur :", user);};
    Wsocket.onclose = (event) => {
        console.warn("⚠️ WebSocket waiting fermée :", user);};
    Wsocket.onmessage = (event) => {
        let data = JSON.parse(event.data);
        if (data.success == true) {
            Wsocket?.close();
            player_id = data.player_id;
            lobbyKey = data.lobbyKey;
            initializeGame(data.player1, data.player2, user);
        }
    };
}

function mobile_ready_pong() {
    if (lobbyKey && disp == true) {
        win = 0;
        const message = { playerReady: true, player: player_id, "lobbyKey": lobbyKey };
        socket?.send(JSON.stringify(message))
    }
}

function move_mobile_pong(input: string) {
    if (socket?.readyState === WebSocket.OPEN) {
        const message = {
            player: player_id,
            move: input,
            lobbyKey: lobbyKey
        };
        socket.send(JSON.stringify(message));
    }
}

function display_order (player1: string, player2: string, player3: string, player4: string) {
    const canvas = document.getElementById("tournament_order") as HTMLCanvasElement;
    if (canvas) {
        const ctx = canvas.getContext("2d");
        if (!ctx) {
            return ;
        }
		ctx.clearRect(0, 0, canvas.width, canvas.height);
        let i = 0;
        ctx.textAlign = "start";
        ctx.textBaseline = "alphabetic";
        ctx.font = "20px Arial";
        ctx.fillStyle = "#FFFFFF";
        ctx.fillText(String("Game 1 :"), 0, 20 + (i++ * 30));
        ctx.fillText(String(player1 + "   vs   " + player2), 0, 20 + (i++ * 30));
        ctx.fillText(String(player3 + "   vs   " + player4), 0, 20 + (i++ * 30));
        ctx.fillText(String("Game 2 :"), 0, 20 + (i++ * 30));
        ctx.fillText(String(player1 + "   vs   " + player3), 0, 20 + (i++ * 30));
        ctx.fillText(String(player2 + "   vs   " + player4), 0, 20 + (i++ * 30));
        ctx.fillText(String("Game 3 :"), 0, 20 + (i++ * 30));
        ctx.fillText(String(player1 + "   vs   " + player4), 0, 20 + (i++ * 30));
        ctx.fillText(String(player2 + "   vs   " + player3), 0, 20 + (i++ * 30));
    }
}

async function pong_tournament() {
    Disconnect_from_game();
    const user = await get_user();
    fetch("/update_status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({"status": "inqueue"})
    });
    mystatus = "inqueue";
    inTournament = true;
    const sock_name = window.location.host;
    Tsocket = new WebSocket("wss://" + sock_name + "/ws/matchmaking/tournament");
    Tsocket.onopen = () => {
        console.log("✅ WebSocket tournament connectée !");
        Tsocket?.send(JSON.stringify({ username: user, init: true }));
    };
    Tsocket.onerror = (event) => {
        console.error("❌ WebSocket tournament erreur :", user);};
    Tsocket.onclose = (event) => {
        console.warn("⚠️ WebSocket tournament fermée :", user);};
    Tsocket.onmessage = (event) => {
        let data = JSON.parse(event.data);
        if (data.id_tournament != undefined) {
            id_tournament = data.id_tournament; 
        }
        if (data.end_tournament && data.classementDecroissant) {
            Tsocket?.close();
            navigateTo("end_tournament", true, data.classementDecroissant);
            inTournament = false;
            return ;
        }
        if (data.success == true) {
            player_id = data.player_id;
            lobbyKey = data.lobbyKey;
            initializeGame(data.player1, data.player2, user);
        }
        console.log("censee ne pas etre vide" + data.next_match);
        if (data.next_match) {
            display_next_match(data.next_match);
        }
    };
}

function end_game(win: number, user: string | null, otheruser: string, myscore: number, otherscore: number,  intournament: boolean) {
    if (intournament && (myscore == 3 || otherscore == 3)) { // a changer en 3 c est le score finish
        Tsocket?.send(JSON.stringify({ id_tournament_key_from_player: id_tournament, username: user, endgame: true, history: {"win": win, myusername: user, "otherusername": otheruser,  "myscore": myscore, "otherscore": otherscore, "gametype": "pong"}}));
        socket?.close();
    }
    else if (myscore == 3 || otherscore == 3) { // a changer en 3 c est le score finish
        fetch("/update_history", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ history:{"win": win, "myusername": user, "otherusername": otheruser, "myscore": myscore, "otherscore": otherscore, "gametype": "pong"}})
        });
    }
    win = 0;
}

function Disconnect_from_game() {
    fetch("/update_status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({"status": "online"})
    });
    mystatus = "online";
    if (window.location.pathname !== "/waiting_room" && window.location.pathname !== "/pong_tournament") {
        animation_pong_stop();
        animation_ping_stop();
    }
    if (!Wsocket && !socket && !lobbyKey && !Tsocket)
        return;
    Wsocket?.close();
    socket?.close();
    Tsocket?.send(JSON.stringify({ id_tournament_key_from_player: id_tournament, disconnect: true}));
    Tsocket?.close();
    socket = null;
    lobbyKey = null;
    id_tournament = 0;
    disp = true;
    win = 0;
}

function initializeGame(user1: string, user2: string, myuser: string | null): void {
    console.log("Initialisation du jeu...");
    const btnUp = document.getElementById("btnUp");
    btnUp?.addEventListener("mousedown", () => move_mobile_pong("up"));
    btnUp?.addEventListener("mouseup", () => move_mobile_pong("stop"));
    btnUp?.addEventListener("touchstart", () => move_mobile_pong("up"));
    btnUp?.addEventListener("touchend", () => move_mobile_pong("stop"));

    const btnDown = document.getElementById("btnDown");
    btnDown?.addEventListener("mousedown", () => move_mobile_pong("down"));
    btnDown?.addEventListener("mouseup", () => move_mobile_pong("stop"));
    btnDown?.addEventListener("touchstart", () => move_mobile_pong("down"));
    btnDown?.addEventListener("touchend", () => move_mobile_pong("stop"));

    const canvas = document.getElementById("pongCanvas") as HTMLCanvasElement;
    fetch("/update_status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({"status": "ingame"})
    });
    mystatus = "ingame";
    if (canvas) {
        const ctx = canvas.getContext("2d");
        if (!ctx) {
            return ;
        }

        animation_pong_stop();
        document.getElementById("pong_animation")?.classList.add("hidden");
        document.getElementById("pong_animation_arena")?.classList.add("hidden");
        document.getElementById("div_pong_anim")?.classList.add("hidden");
        document.getElementById("div_pong_game")?.classList.remove("hidden");

        const sock_name = window.location.host
        socket = new WebSocket("wss://" + sock_name + "/ws/pong");
        if (!socket)
            return ;
        socket.onopen = () => {
            console.log("✅ WebSocket connectée !");
            socket?.send(JSON.stringify({ username1: user1, username2: user2, "lobbyKey": lobbyKey, "myuser": myuser}));
        };
        socket.onerror = (event) => {
            console.error("❌ WebSocket erreur :", event);};
        socket.onclose = (event) => {
            socket = null;
            lobbyKey = null;
            disp = true;
            win = 0;
            console.warn("⚠️ WebSocket fermée :", event);
        };
        
        const paddleWidth = 20;
        const paddleHeight = 100;
        const ballRadius = 10;

        let gameState = {
            ball: { x: 500, y: 250 },
            paddles: {
                player1: { name: user1, y: 200 },
                player2: { name: user2, y: 200 }
            },
            score: { player1: 0, player2: 0 },
            playerReady: { player1: false, player2: false }
        };

        function pong_player_one(): string {
            return gameState.paddles.player1.name;
        }
        function pong_player_two(): string {
            return gameState.paddles.player2.name;
        }
      
        const playerOneElement = document.querySelector("#playerOne") as HTMLElement;
        const playerTwoElement = document.querySelector("#playerTwo") as HTMLElement;
        
        playerOneElement.innerText = `${pong_player_one()}`;
        playerTwoElement.innerText = `${pong_player_two()}`;

        let canvasWidth: number = canvas.offsetWidth;
        let canvasHeight: number = canvas.offsetHeight;
        
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        let ratio: number = canvasWidth / 1000;

        socket.onmessage = (event) => {
            let gs = JSON.parse(event.data);
            if (gs.disconnect == true) {
                socket?.close();
            }
            if (gs.start == "start")
                disp = false;
            else if (gs.start == "stop")
                disp = true;
            if (gs.lobbyKey === lobbyKey) {
                gameState = gs.gameState;
                drawGame();
            }
            if (gs.winner == true) {
                win = 1;
                draw_winner(ratio);
            }
            else if (gs.winner == false) {
                win = 2;
                draw_winner(ratio);
            }
        };

        document.addEventListener("keydown", (event) => {
            if (socket?.readyState === WebSocket.OPEN) {
                let message: { player?: number; move?: string; playerReady?: boolean; lobbyKey?: string | null} | null = null;
        
                if (event.key === "ArrowUp")
                    message = { player: player_id, move: "up", "lobbyKey": lobbyKey };
                if (event.key === "ArrowDown")
                    message = { player: player_id, move: "down", "lobbyKey": lobbyKey};
                if (event.key === " " && disp == true) {
                    win = 0;
                    message = { playerReady: true, player: player_id, "lobbyKey": lobbyKey };
                    console.log("message from front: ", message);
                }

                if (message) {
                    socket?.send(JSON.stringify(message));
                }
            }
        });

        document.addEventListener("keyup", (event) => {
            if (socket?.readyState === WebSocket.OPEN) {
                let message: { player?: number; move?: string; game?: string; lobbyKey?: string | null } | null = null;

                if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                    message = { player: player_id, move: "stop", "lobbyKey": lobbyKey  };
                }

                if (message) {
                    socket.send(JSON.stringify(message));
                }
            }
        });        

        function drawGame(): void {
            if (!ctx) {
                return ;
            }

            let canvasWidth: number = canvas.offsetWidth;
            let canvasHeight: number = canvas.offsetHeight;
            
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
    
            let ratio: number = canvasWidth / 1000;

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            ctx.drawImage(RED_PADDLE, 0, gameState.paddles.player1.y  * ratio, paddleWidth * ratio, paddleHeight * ratio);

            ctx.drawImage(BLUE_PADDLE, canvas.width - (paddleWidth * ratio), gameState.paddles.player2.y  * ratio, paddleWidth * ratio, paddleHeight * ratio);

            ctx.beginPath();
            ctx.arc(gameState.ball.x * ratio, gameState.ball.y * ratio, ballRadius * ratio, 0, Math.PI * 2);
            ctx.fillStyle = "#efb60a";
            ctx.fill(); 
            
            ctx.lineWidth = 2;
            ctx.strokeStyle = "black";
            ctx.stroke();

            draw_score(ratio);
            draw_winner(ratio);
            if (disp == true) {
                document.getElementById("pong_playersdiv")?.classList.remove("hidden");
                ctx.font = `bold ${30 * ratio}px 'Canted Comic', 'system-ui', sans-serif`;
                ctx.fillStyle = "black";
                ctx.textAlign = "center";
                ctx.fillText("Press SPACE to start", canvas.width / 2, canvas.height / 2 + (200 * ratio));
            }
        }
        requestAnimationFrame(drawGame);

        function draw_score(ratio: number): void {
            if (!ctx) {
                return ;
            }
            ctx.textAlign = "start";
            ctx.textBaseline = "alphabetic";
            ctx.font = `bold ${40 * ratio}px 'KaBlam', 'system-ui', sans-serif`;
            ctx.fillStyle = "red";
            ctx.fillText(String(gameState.score.player1), canvas.width / 2 - (70 * ratio), 40 * ratio);
            ctx.fillStyle = "blue";
            ctx.fillText(String(gameState.score.player2), canvas.width / 2 + (50 * ratio), 40 * ratio);
        }

        function draw_winner(ratio: number): void {
            if (!ctx) {
                return ;
            }
            if (win == 1) {
                let image_size: number = 400 * ratio;
                ctx.drawImage(WIN_image, (canvas.width / 2) - image_size / 2, (canvas.height / 2) - image_size / 2, image_size, image_size);
            }
            if (win == 2) {
                let image_size: number = 400 * ratio;
                ctx.drawImage(LOSE_image, (canvas.width / 2) - image_size / 2, (canvas.height / 2) - image_size / 2, image_size, image_size);
            }
            if (player_id == 1 && win != 0) {
                end_game(win, gameState.paddles.player1.name, gameState.paddles.player2.name, gameState.score.player1, gameState.score.player2, inTournament);
            }
            else if (player_id == 2 && win != 0) {
                end_game(win, gameState.paddles.player2.name, gameState.paddles.player1.name, gameState.score.player2, gameState.score.player1, inTournament);
            }
        }
    } 
    else {
        console.error("Erreur : Le canvas n'a pas été trouvé.");
    }
}

window.addEventListener("beforeunload", () => {
    if (Tsocket?.readyState === WebSocket.OPEN) {
        Tsocket?.send(JSON.stringify({ id_tournament_key_from_player: id_tournament, disconnect: true}));
    }
});

