const fastify = require("fastify")({ logger: true });
fastify.register(require("@fastify/websocket"));
const axios = require("axios"); // Pour faire des requêtes HTTP

let pong_i = 0;
let ping_i = 0;

let waitingClientPong = {};

const clientsWaitingPong = new Set();

let waitingClientPing = {};

const clientsWaitingPing = new Set();

let tournamentMapPong = new Map();

let id_tournamentPong = 0;

let old_id_tournamentPong = 0;

let tournamentMapPing = new Map();

let id_tournamentPing = 0;

let old_id_tournamentPing = 0;

tournamentMapPong.set(id_tournamentPong, { 
    end_lobby: 0,

    count_game: 0,
    
    history: {},
    
    tournament_id: id_tournamentPong,
    
    classements: [],
    
    tournamentQueue: {},
    
    tournamentsUsernames: []

})

tournamentMapPing.set(id_tournamentPing, { 
    end_lobby: 0,

    count_game: 0,
    
    history: {},
    
    tournament_id: id_tournamentPing,
    
    classements: [],
    
    tournamentQueue: {},
    
    tournamentsUsernames: []

})

function isUsernameInAnyTournament(username) {
    if (tournamentMapPing.size != 1) {
        for (const tournamentData of tournamentMapPing.values()) {
            if (tournamentData.tournamentsUsernames.includes(username)) {
                return true;
            }
            if (tournamentData.tournamentQueue.hasOwnProperty(username)) {
                return true;
            }
        }
    }
    if (tournamentMapPong.size != 1) {
        for (const tournamentData of tournamentMapPong.values()) {
            if (tournamentData.tournamentsUsernames.includes(username)) {
                return true;
            }
            if (tournamentData.tournamentQueue.hasOwnProperty(username)) {
                return true;
            }
        }
    }
    if (Object.values(waitingClientPing).includes(username)) {
        return true;
    }
    if (Object.values(waitingClientPong).includes(username)) {
        return true;
    }
    return false;
}

fastify.register(async function (fastify) {
    let username1 = 0;
    let username2 = 0;
    fastify.get("/ws/matchmaking/pong", { websocket: true }, (connection, req) => { 
        clientsWaitingPong.add(connection);
        console.log("Nouvelle connexion WebSocket sur Waiting !");
        connection.socket.on("close", () => {
            clientsWaitingPong.clear();
            waitingClientPong = {};
            pong_i = 0;
            console.log("Connexion WebSocket Waiting fermée.");
        });
        connection.socket.on("message", (message) => {
            const data = JSON.parse(message.toString());
            if (isUsernameInAnyTournament(data.username) && data.init == true)
                return ;
            if (pong_i == 0) {
                waitingClientPong[0] = data.username;
                username1 = data.username;
                pong_i++;
            } else if (pong_i == 1) {
                if (data.username == username1)
                    return ;
                waitingClientPong[1] = data.username;
                username2 = data.username;
                pong_i++;
            }
            if (pong_i == 2) {
                pong_i = 0;
                const lobbyKey = `${username1}${username2}`;
                clientsWaitingPong.forEach(clientsWaiting => {
                    pong_i++;
                    clientsWaiting.socket.send(JSON.stringify({ 
                        success: true,
                        player1: username1,
                        player2: username2,
                        player_id: pong_i,
                        "lobbyKey": lobbyKey
                    }));
                });
                clientsWaitingPong.clear();
                waitingClientPong = {};
                pong_i = 0;
            }
        });
    })
    fastify.get("/ws/matchmaking/tournament", { websocket: true }, (connection, req) => {
        try {
            console.log("Nouvelle connexion WebSocket sur Tournament !");
            connection.socket.on("message", (message) => {
                if (old_id_tournamentPong != id_tournamentPong) {
                    tournamentMapPong.set(id_tournamentPong, {
                        end_lobby: 0,
                        count_game: 0,
                        history: {},
                        tournament_id: id_tournamentPong,
                        classements: [],
                        tournamentQueue: {},
                        tournamentsUsernames: []
                    });
                    old_id_tournamentPong = id_tournamentPong; // Met à jour l'ancien ID
                }
                const data = JSON.parse(message.toString());
                if (isUsernameInAnyTournament(data.username) && data.init == true) {
                    return ;
                }
                let id_tournament_key_from_player = data.id_tournament_key_from_player ?? id_tournamentPong;
                let currentTournament = tournamentMapPong.get(id_tournament_key_from_player);
                if (!currentTournament) {
                    console.error(`Tournoi ${id_tournament_key_from_player} introuvable`);
                    return ;
                }
                if (data.disconnect) {
                    if (currentTournament.tournamentsUsernames.length < 4) { 
                        for (let i = 0; i < currentTournament.tournamentsUsernames.length; i++) {
                            if (connection == currentTournament.tournamentQueue[currentTournament.tournamentsUsernames[i]]) {
                                delete currentTournament.tournamentQueue[currentTournament.tournamentsUsernames[i]];
                                console.log(`disconnecting ${currentTournament.tournamentsUsernames[i]} from tournament queue`);
                                const index = currentTournament.classements.findIndex(player => player.username === currentTournament.tournamentsUsernames[i])
                                currentTournament.tournamentsUsernames.splice(i, 1);
                                if (index !== -1)
                                    currentTournament.classements.splice(index, 1);
                                return ;
                            }
                        }
                    }
                    currentTournament.classements.sort((a, b) => b.score - a.score);
                    console.log("a player as leave the tournament");
                    for (let i = 0; i < currentTournament.tournamentsUsernames.length ; i++) {
                        if (connection != currentTournament.tournamentQueue[currentTournament.tournamentsUsernames[i]])
                            currentTournament.tournamentQueue[currentTournament.tournamentsUsernames[i]].socket.send(JSON.stringify({end_tournament : true, classementDecroissant: currentTournament.classements}));
                    }
                    tournamentMapPong.delete(id_tournament_key_from_player);
                    console.log("Connexion WebSocket fermée.");
                }
                if (data.init) {
                    if (currentTournament.tournamentsUsernames.includes(data.username)) {
                        console.log("user already in tournament");
                        return ;
                    }
                    currentTournament.tournamentQueue[data.username] = connection;
                    currentTournament.classements.push({username: data.username, score: 0});
                    currentTournament.tournamentsUsernames.push(data.username);
                    currentTournament.history[data.username] = [];
                    if (currentTournament.tournamentsUsernames.length == 4) {
                        for (let i = 0; i < 4; i++) {
                            currentTournament.tournamentQueue[currentTournament.tournamentsUsernames[i]].socket.send(JSON.stringify({ succes: true, id_tournament: id_tournamentPong}));
                        }
                        id_tournamentPong++;
                        currentTournament.count_game++;
                        console.log("game 1");
                        launchTournament(currentTournament.tournamentsUsernames[0], currentTournament.tournamentsUsernames[1], currentTournament.tournamentsUsernames[2], currentTournament.tournamentsUsernames[3], currentTournament.count_game, currentTournament);
                    }
                }
                if (data.endgame) {
                    id_tournament_key_from_player = data.id_tournament_key_from_player;
                    currentTournament.end_lobby++;
                    currentTournament.history[data.username].push(data.history);
                    if (data.history.win == 1) {
                        for (let i = 0; i < 4; i++) {
                            if (data.username == currentTournament.classements[i].username) {
                                currentTournament.classements[i].score += 1;
                                break ;
                            }
                        }
                    }
                    console.log("nombre de joueurs dans la queue pour le tournoi: ", currentTournament.end_lobby)
                    if (currentTournament.count_game == 1 && currentTournament.end_lobby == 4) {
                        console.log("game 2");
                        launchTournament(currentTournament.tournamentsUsernames[0], currentTournament.tournamentsUsernames[2], currentTournament.tournamentsUsernames[1], currentTournament.tournamentsUsernames[3], currentTournament.count_game, currentTournament)
                        currentTournament.count_game++;
                        currentTournament.end_lobby = 0; 
                    } 
                    else if (currentTournament.end_lobby == 4 && currentTournament.count_game == 2) {
                        console.log("game 3");
                        launchTournament(currentTournament.tournamentsUsernames[0], currentTournament.tournamentsUsernames[3], currentTournament.tournamentsUsernames[1], currentTournament.tournamentsUsernames[2], currentTournament.count_game, currentTournament)
                        currentTournament.end_lobby = 0;
                        currentTournament.count_game++; 
                    }
                    else if (currentTournament.count_game == 3 && currentTournament.end_lobby == 4) {
                        currentTournament.classements.sort((a, b) => b.score - a.score);
                        for (let i = 0; i < 4; i++) {
                            currentTournament.tournamentQueue[currentTournament.tournamentsUsernames[i]].socket.send(JSON.stringify({end_tournament : true, classementDecroissant: currentTournament.classements}));
                            axios.post("http://users:5000/update_history",
                                {
                                    history: currentTournament.history[currentTournament.tournamentsUsernames[i]],
                                    gametype: "pong",
                                    tournament: true
                                },
                                {  
                                    headers: {
                                        "Content-Type": "application/json"
                                    }
                                }
                            );
                        }
                        axios.post("http://users:5000/update_history_tournament", 
                            {
                                classement: currentTournament.classements,
                                gametype: "pong",
                                tournament: true
                            },
                            {
                                headers: {
                                    "Content-Type": "application/json"
                                }
                            }
                        );
                        if (currentTournament) {
                            let socketClose = Object.values(currentTournament.tournamentQueue);

                            tournamentMapPong.delete(id_tournament_key_from_player);

                            socketClose.forEach(client => {
                                if (client && client.socket) {
                                    client.socket.close();
                                }
                            })
                        }
                    }
                } 
            });
        }
        catch (err) {
            console.error("error in websocket");
        }
    })
    fastify.get("/ws/matchmaking/ping", { websocket: true }, (connection, req) => { 
        clientsWaitingPing.add(connection);
        console.log("Nouvelle connexion WebSocket sur Waiting !");
        connection.socket.on("close", () => {
            clientsWaitingPing.clear();
            waitingClientPing = {};
            ping_i = 0;
            console.log("Connexion WebSocket Waiting fermée.");
        });
        connection.socket.on("message", (message) => {
            const data = JSON.parse(message.toString());
            if (isUsernameInAnyTournament(data.username) && data.init == true)
                return ;
            if (ping_i == 0) {
                waitingClientPing[0] = data.username;
                username1 = data.username;
                ping_i++;
            } else if (ping_i == 1) {
                if (data.username == username1)
                    return ;
                waitingClientPing[1] = data.username;
                username2 = data.username;
                ping_i++;
            }
            if (ping_i == 2) {
                ping_i = 0;
                const lobbyKey = `${username1}${username2}`;
                console.log("lobby: ", lobbyKey); 
                clientsWaitingPing.forEach(clientsWaiting => {
                    ping_i++;
                    clientsWaiting.socket.send(JSON.stringify({ 
                        success: true,
                        player1: username1,
                        player2: username2,
                        player_id: ping_i,
                        "lobbyKey": lobbyKey
                    }));
                });
                clientsWaitingPing.clear();
                waitingClientPing = {};
                ping_i = 0;
            }
        });
    })
    fastify.get("/ws/matchmaking/ping_tournament", { websocket: true }, (connection, req) => {
        try {
            console.log("Nouvelle connexion WebSocket sur Tournament !");
            connection.socket.on("message", (message) => {
                if (old_id_tournamentPing != id_tournamentPing) {
                    tournamentMapPing.set(id_tournamentPing, {
                        end_lobby: 0,
                        count_game: 0,
                        history: {},
                        tournament_id: id_tournamentPing,
                        classements: [],
                        tournamentQueue: {},
                        tournamentsUsernames: []
                    });
                    old_id_tournamentPing = id_tournamentPing; // Met à jour l'ancien ID
                }
                const data = JSON.parse(message.toString());
                if (isUsernameInAnyTournament(data.username) && data.init == true) {
                    return ;
                }
                let id_tournament_key_from_player = data.id_tournament_key_from_player ?? id_tournamentPing;
                console.log("matchmaking id_tournament a la reception du client", id_tournament_key_from_player); 
                let currentTournament = tournamentMapPing.get(id_tournament_key_from_player);
                if (!currentTournament) {
                    console.error(`Tournoi ${id_tournament_key_from_player} introuvable`);
                    return ;
                }
                if (data.disconnect) {
                    if (currentTournament.tournamentsUsernames.length < 4) { 
                        console.log("a player in queue as left");
                        for (let i = 0; i < currentTournament.tournamentsUsernames.length; i++) {
                            if (connection == currentTournament.tournamentQueue[currentTournament.tournamentsUsernames[i]]) {
                                console.log("suppressing user: ", currentTournament.tournamentsUsernames[i]);
                                delete currentTournament.tournamentQueue[currentTournament.tournamentsUsernames[i]];
                                const index = currentTournament.classements.findIndex(player => player.username === currentTournament.tournamentsUsernames[i])
                                currentTournament.tournamentsUsernames.splice(i, 1);
                                console.log(`users in tournament: ${currentTournament.tournamentsUsernames}`);
                                if (index !== -1)
                                    currentTournament.classements.splice(index, 1);
                                return ; 
                            }
                        }
                    }
                    currentTournament.classements.sort((a, b) => b.score - a.score);
                    console.log("a player as leave the tournament");
                    for (let i = 0; i < currentTournament.tournamentsUsernames.length ; i++) {
                        if (connection != currentTournament.tournamentQueue[currentTournament.tournamentsUsernames[i]])
                            currentTournament.tournamentQueue[currentTournament.tournamentsUsernames[i]].socket.send(JSON.stringify({end_tournament : true, classementDecroissant: currentTournament.classements}));
                    }
                    tournamentMapPing.delete(id_tournament_key_from_player);
                    console.log("Connexion WebSocket fermée.");
                }
                if (data.init) {
                    if (currentTournament.tournamentsUsernames.includes(data.username)) {
                        console.log("user already in tournament");
                        return ;
                    }
                    currentTournament.tournamentQueue[data.username] = connection;
                    currentTournament.classements.push({username: data.username, score: 0});
                    currentTournament.tournamentsUsernames.push(data.username);
                    currentTournament.history[data.username] = [];
                    console.log("pushing : ", data.username);
                    if (currentTournament.tournamentsUsernames.length == 4) {
                        console.log("Launch tournament : game 1");
                        for (let i = 0; i < 4; i++) {
                            console.log("sending tournament id to: ", currentTournament.tournamentsUsernames[i]);
                            currentTournament.tournamentQueue[currentTournament.tournamentsUsernames[i]].socket.send(JSON.stringify({ succes: true, id_tournament: id_tournamentPing}));
                        }
                        id_tournamentPing++;
                        currentTournament.count_game++;
                        launchTournament(currentTournament.tournamentsUsernames[0], currentTournament.tournamentsUsernames[1], currentTournament.tournamentsUsernames[2], currentTournament.tournamentsUsernames[3], currentTournament.count_game, currentTournament);
                    }
                }
                if (data.endgame) {
                    id_tournament_key_from_player = data.id_tournament_key_from_player;
                    currentTournament.end_lobby++;
                    console.log("avant de push history: ", data.history);
                    console.log("avant de push username: ", data.username);
                    console.log("avant de push back history: ", currentTournament.history[data.username]);
                    currentTournament.history[data.username].push(data.history);
                    if (data.history.win == 1) {
                        for (let i = 0; i < 4; i++) {
                            if (data.username == currentTournament.classements[i].username) {
                                currentTournament.classements[i].score += 1;
                                break ;
                            }
                        }
                    }
                    console.log("data: ", data);
                    if (currentTournament.count_game == 1 && currentTournament.end_lobby == 4) {
                        console.log("game 2"); 
    
                        launchTournament(currentTournament.tournamentsUsernames[0], currentTournament.tournamentsUsernames[2], currentTournament.tournamentsUsernames[1], currentTournament.tournamentsUsernames[3], currentTournament.count_game, currentTournament)
                        currentTournament.count_game++;
                        currentTournament.end_lobby = 0; 
                    } 
                    else if (currentTournament.end_lobby == 4 && currentTournament.count_game == 2) {
                        console.log("game 3");
                        launchTournament(currentTournament.tournamentsUsernames[0], currentTournament.tournamentsUsernames[3], currentTournament.tournamentsUsernames[1], currentTournament.tournamentsUsernames[2], currentTournament.count_game, currentTournament)
                        currentTournament.end_lobby = 0;
                        currentTournament.count_game++; 
                    }
                    else if (currentTournament.count_game == 3 && currentTournament.end_lobby == 4) {
                        currentTournament.classements.sort((a, b) => b.score - a.score);
                        console.log("end tournament");
                        for (let i = 0; i < 4; i++) {
                            console.log("sending trucs par clients pour la fin du tournoi");
                            currentTournament.tournamentQueue[currentTournament.tournamentsUsernames[i]].socket.send(JSON.stringify({end_tournament : true, classementDecroissant: currentTournament.classements}));
                            console.log(currentTournament.history[currentTournament.tournamentsUsernames[i]]);
                            axios.post("http://users:5000/update_history", 
                                {
                                    history: currentTournament.history[currentTournament.tournamentsUsernames[i]],
                                    gametype: "ping",
                                    tournament: true
                                },
                                {
                                    headers: {
                                        "Content-Type": "application/json"
                                    }
                                }
                            );
                        }
                        axios.post("http://users:5000/update_history_tournament",
                            {
                                classement: currentTournament.classements,
                                gametype: "ping",
                                tournament: true
                            },
                            {
                                headers: {
                                    "Content-Type": "application/json"
                                }
                            }
                        );
                        if (currentTournament) {
                            let socketClose = Object.values(currentTournament.tournamentQueue);

                            tournamentMapPing.delete(id_tournament_key_from_player);

                            socketClose.forEach(client => {
                                if (client && client.socket) {
                                    client.socket.close();
                                }
                            })
                        }
                    }
                } 
            });
        }
        catch (err) {
            console.error("error in websocket");
        }
    })
});

function launchTournament(user1, user2, user3, user4, count_game, currentTournament) {
    let users = [user1, user2, user3, user4];
    if (!currentTournament) {
        console.error("no tournament in lauch tournament");
        return ;
    }
    let next_match = null;
    let lobbyKey = null;
    let username1 = null;
    let username2 = null;
    const lobbyKeypart1 = `${user1}${user2}`;
    const lobbyKeypart2 = `${user3}${user4}`;
    if (count_game == 1) {
        next_match = [];
        next_match.push(user1);
        next_match.push(user3);
        next_match.push(user2);
        next_match.push(user4);
    } else if (count_game == 2) {
        next_match = [];
        next_match.push(user1);
        next_match.push(user4);
        next_match.push(user2);
        next_match.push(user3);
    } else if (count_game == 3) {
        next_match = "last_match";
    }
    for (let i = 0; i < users.length; i++) {
        if (i <= 1) {
            lobbyKey = lobbyKeypart1;
            username1 = user1;
            username2 = user2;
        }
        else {
            lobbyKey = lobbyKeypart2;
            username1 = user3;
            username2 = user4;
        }
        if (currentTournament.tournamentQueue[users[i]]) {
            console.log(next_match);
            if (currentTournament.count_game == 1){
                currentTournament.tournamentQueue[users[i]].socket.send(JSON.stringify({
                    success: true, 
                    player1: username1,
                    player2: username2,
                    player_id: i % 2 + 1, // for format 2 or 1
                    "lobbyKey": lobbyKey,
                    next_match : next_match
                }));
            }
            else {
                currentTournament.tournamentQueue[users[i]].socket.send(JSON.stringify({
                        success: true, 
                        player1: username1,
                        player2: username2,
                        player_id: i % 2 + 1, // for format 2 or 1
                        "lobbyKey": lobbyKey,
                        next_match : next_match
                    }));
            }
        }
    }
}

const start = async () => {
    try {
        await fastify.listen({ port: 4020, host: "0.0.0.0" });
        console.log("Matchmaking WebSocket Server running on port 4020");
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();