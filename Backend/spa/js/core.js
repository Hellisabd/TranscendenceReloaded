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

const { log, create_account , get_user , logout, modify_user, waiting_room } = require("./proxy");
const cors = require("@fastify/cors");
const path = require('path');
const fastifystatic = require('@fastify/static');
const view = require('@fastify/view');
const fs = require('fs');
const WebSocket = require("ws");
const axios = require("axios"); // Pour faire des requêtes HTTP
const fastifyCookie = require("@fastify/cookie");

let pongSocket = new WebSocket("ws://pong:4000/ws/pong");
pongSocket.on("open", () => { console.log("✅ Connecté au serveur WebSocket de Pong !")});

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

fastify.post("/create_account", create_account);

fastify.post("/modify_user", modify_user);

fastify.post("/waiting_room", waiting_room);

fastify.get('/:page', async (request, reply) => {
  let page = request.params.page
  if (page[page.length - 1] == '/')
    page = page.substring(0, page.length - 1)
  if (page == '')
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
        await fastify.listen({ port: 3000, host: '0.0.0.0' });
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();