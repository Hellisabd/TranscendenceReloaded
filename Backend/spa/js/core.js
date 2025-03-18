const fastify = require("fastify")({
  logger: {
    level: "warn",
    transport: {
      target: "pino-pretty",
      options: {
        ignore: "pid,hostname,time,reqId,responseTime",
        singleLine: true,
      },
    },
  },
});

fastify.register(require("@fastify/websocket"));
const { log, create_account , get_user , logout, settings, waiting_room, update_history, get_history, end_tournament, add_friend, pending_request, get_friends, update_status, Websocket_handling, send_to_friend, display_friends, ping_waiting_room, get_avatar, update_avatar } = require("./proxy");
const cors = require("@fastify/cors");
const path = require('path');
const fastifystatic = require('@fastify/static');
const view = require('@fastify/view');
const fs = require('fs');
// const WebSocket = require("ws");
const axios = require("axios"); // Pour faire des requêtes HTTP
const fastifyCookie = require("@fastify/cookie");
const multipart = require('@fastify/multipart');
const otplib = require('otplib');
const qrcode = require("qrcode");

fastify.register(multipart);

// let pongSocket = new WebSocket("ws://pong:4000/ws/pong");
// pongSocket.on("open", () => { console.log("✅ Connecté au serveur WebSocket de Pong !")});

fastify.register(cors, {
  origin: "http://k1r4p7:8000",  // Autorise toutes les origines (*). Pour plus de sécurité, mets l'URL de ton frontend.
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"], // Autorise ces méthodes HTTP
  allowedHeaders: ["Content-Type"],
  preflightContinue: true,
  credential: true
});

fastify.register(fastifyCookie, {
    secret: process.env.COOKIE_SECRET,
});
fastify.register(view, {
  engine: { ejs: require("ejs") },
  root: path.join(__dirname, "../../Frontend/templates"),
  includeViewExtension: true,
});


fastify.register(fastifystatic, {
  root: path.join(__dirname, '../../Frontend'),
  prefix: '/Frontend/',
});

fastify.post("/login", log);

fastify.get("/get_user", async (req, reply) => {
    const token = req.cookies.session;
    const username = await get_user(token);
    return reply.send({success: true, username});
})

fastify.get("/logout", async (req, reply) => {
  const token = req.cookies.session;
  const username = await logout(token);
  return reply.clearCookie("session", {
    path: "/",
    httpOnly: true,
    secure: true, // ✅ Doit être `true` en production (HTTPS)
    sameSite: "None"
})
.send({ success: true, message: "Déconnexion réussie" });
})

fastify.register(async function (fastify) {
  fastify.get("/ws/spa/friends", {websocket: true}, (connection, req) => {
    console.log("Nouvelle connexion Social WebSocket !");
    connection.socket.on("message", (message) => {
      const data = JSON.parse(message.toString());
      Websocket_handling(data.username, connection);
      send_to_friend();
      display_friends(data.username, connection);
    })
  });
});

fastify.post("/create_account", create_account);

fastify.post("/update_avatar", update_avatar);

fastify.post("/pending_request", pending_request);

fastify.post("/settings", settings);

fastify.post("/update_history", update_history);

fastify.get("/history", get_history);

fastify.post("/update_status", update_status);

fastify.post("/get_friends", get_friends);

fastify.post("/end_tournament", end_tournament);

fastify.post("/waiting_room", waiting_room);

fastify.post("/ping_waiting_room", ping_waiting_room);

fastify.post("/add_friend", add_friend);

fastify.post("/get_avatar", get_avatar);

fastify.get('/:page', async (request, reply) => {
  let page = request.params.page
  if (page[page.length - 1] == '/')
    page = page.substring(0, page.length - 1)
  if (page == '' || page == "end_tournament") // siamais on redirige end_tournament ici
    page = 'index'
  let filePath = "Frontend/templates/" + page + ".ejs"
  let fileName =  page + ".ejs"
  if (page.includes('..') || path.isAbsolute(page)) {
    return reply.code(400).send('Requête invalide');
  }
  if (!fs.existsSync(filePath)) {
    return reply.code(404).send('Page non trouvée');
  }
  return reply.view(fileName);
});

const start = async () => {
    try {
        await fastify.ready();
        await fastify.listen({ port: 7000, host: '0.0.0.0' });
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

fastify.post("/2fa/setup", async (request, reply) => {
  const { username } = request.body;

  if (!username) {
      console.log("Erreur : username inexistant");
      return reply.code(400).send({ error: 'Username inexistant.' });
  }

  try {
      // Générer le secret 2FA
      const secret = otplib.authenticator.generateSecret();
      if (!secret || typeof secret !== 'string') {
          console.error("Le secret généré n'est pas valide");
          return reply.code(500).send({ error: "Erreur lors de la generation du secret 2FA" });
      }

      // Générer l'URL pour le QR Code
      const otplibUrl = otplib.authenticator.keyuri(username, 'MyApp', secret);
      console.log("URL du QR Code generee :", otplibUrl);

      // Utiliser un async/await pour gérer correctement la génération du QR code
      const dataUrl = await new Promise((resolve, reject) => {
          qrcode.toDataURL(otplibUrl, (err, url) => {
              if (err) {
                  console.error("Erreur lors de la generation du QR code:", err);
                  return reject(err);
              }
              resolve(url);
          });
      });

      // Une fois le QR code généré, on envoie la réponse
      console.log("QR Code genere avec succes");
      return reply.send({ otplib_url: otplibUrl, qr_code: dataUrl });

  } catch (err) {
      console.error("Erreur serveur lors du traitement 2FA:", err);
      return reply.code(500).send({ error: "Erreur serveur lors de la mise en place du 2FA" });
  }
});

start();
