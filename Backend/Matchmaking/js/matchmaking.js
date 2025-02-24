const fastify = require("fastify")({ logger: true });
fastify.register(require("@fastify/websocket"));
const axios = require("axios"); // Pour faire des requêtes HTTP

let i = 0;

let waitingClient = {};

const clientsWaiting = new Set();

let tournamentMap = new Map();

let id_tournament = 0;

let old_id_tournament = 0;

tournamentMap.set(id_tournament, { 
    end_lobby: 0,

    count_game: 0,
    
    history: {},
    
    tournament_id: id_tournament,
    
    classements: [],
    
    tournamentQueue: {},
    
    tournamentsUsernames: []

})



fastify.register(async function (fastify) {
    let username1 = 0;
    let username2 = 0;
    fastify.get("/ws/matchmaking/pong", { websocket: true }, (connection, req) => { 
        clientsWaiting.add(connection);
        console.log("Nouvelle connexion WebSocket sur Waiting !");
        connection.socket.on("close", () => {
            clientsWaiting.clear();
            waitingClient = {};
            i = 0;
            console.log("Connexion WebSocket Waiting fermée.");
        });
        connection.socket.on("message", (message) => {
            const data = JSON.parse(message.toString());
            if (i == 0) {
                waitingClient[0] = data.username;
                username1 = data.username;
                i++;
            } else if (i == 1) {
                if (data.username == username1)
                    return ;
                waitingClient[1] = data.username;
                username2 = data.username;
                i++;
            }
            if (i == 2) {
                i = 0;
                const lobbyKey = `${username1}${username2}`;
                console.log("lobby: ", lobbyKey); 
                clientsWaiting.forEach(clientsWaiting => {
                    i++;
                    clientsWaiting.socket.send(JSON.stringify({ 
                        success: true,
                        player1: username1,
                        player2: username2,
                        player_id: i,
                        "lobbyKey": lobbyKey
                    }));
                });
                clientsWaiting.clear();
                waitingClient = {};
                i = 0;
            }
        });
    })
    fastify.get("/ws/matchmaking/tournament", { websocket: true }, (connection, req) => {
        try {
            console.log("Nouvelle connexion WebSocket sur Tournament !");
            connection.socket.on("message", (message) => {
                if (old_id_tournament != id_tournament) {
                    tournamentMap.set(id_tournament, {
                        end_lobby: 0,
                        count_game: 0,
                        history: {},
                        tournament_id: id_tournament,
                        classements: [],
                        tournamentQueue: {},
                        tournamentsUsernames: []
                    });
                    old_id_tournament = id_tournament; // Met à jour l'ancien ID
                }
                const data = JSON.parse(message.toString());
                let id_tournament_key_from_player = data.id_tournament_key_from_player ?? id_tournament;
                console.log("matchmaking id_tournament a la reception du client", id_tournament_key_from_player); 
                let currentTournament = tournamentMap.get(id_tournament_key_from_player);
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
                            currentTournament.tournamentQueue[currentTournament.tournamentsUsernames[i]].socket.send(JSON.stringify({ succes: true, id_tournament: id_tournament}));
                        }
                        id_tournament++;
                        currentTournament.count_game++;
                        launchTournament(currentTournament.tournamentsUsernames[0], currentTournament.tournamentsUsernames[1], currentTournament.tournamentsUsernames[2], currentTournament.tournamentsUsernames[3], id_tournament_key_from_player);
                    }
                }
                if (data.endgame) {
                    id_tournament_key_from_player = data.id_tournament_key_from_player;
                    currentTournament.end_lobby++;
                    console.log("avant de push history: ", data.history);
                    console.log("avant de push username: ", data.username);
                    console.log("avant de push back history: ", currentTournament.history[data.username]);
                    currentTournament.history[data.username].push(data.history);
                    if (data.history.win == 2) {
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
    
                        launchTournament(currentTournament.tournamentsUsernames[0], currentTournament.tournamentsUsernames[2], currentTournament.tournamentsUsernames[1], currentTournament.tournamentsUsernames[3], id_tournament_key_from_player)
                        currentTournament.count_game++;
                        currentTournament.end_lobby = 0; 
                    } 
                    else if (currentTournament.end_lobby == 4 && currentTournament.count_game == 2) {
                        console.log("game 3");
                        launchTournament(currentTournament.tournamentsUsernames[0], currentTournament.tournamentsUsernames[3], currentTournament.tournamentsUsernames[1], currentTournament.tournamentsUsernames[2], id_tournament_key_from_player)
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

                            tournamentMap.delete(id_tournament_key_from_player);

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

function launchTournament(user1, user2, user3, user4, id_tournament_key_from_player) {
    let users = [user1, user2, user3, user4];
    let currentTournament = tournamentMap.get(id_tournament_key_from_player);
    if (!currentTournament) {
        console.error("no tournament in lauch tournament");
        return ;
    }
    let lobbyKey = null;
    let username1 = null;
    let username2 = null;
    const lobbyKeypart1 = `${user1}${user2}`;
    const lobbyKeypart2 = `${user3}${user4}`;
    console.log(`Nombre de joueurs en attente: ${Object.keys(currentTournament.tournamentQueue).length}`);
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
            currentTournament.tournamentQueue[users[i]].socket.send(JSON.stringify({
                    success: true, 
                    player1: username1,
                    player2: username2,
                    player_id: i % 2 + 1, // for format 0 or 1
                    "lobbyKey": lobbyKey
                }));
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