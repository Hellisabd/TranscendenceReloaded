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

const cors = require("@fastify/cors");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken")

const SALT_ROUNDS = 10;

fastify.register(cors, {
  origin: "http://spa:3000",
  credential: true
});

const generateToken = (user) => {
  return jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '5h' });
};
// 📌 Chargement de la base de données
const dbFile = process.env.DB_FILE || "/usr/src/app/dataBase/core.db";

// 📌 Vérifier et créer le dossier dataBase s'il n'existe pas
const dbDir = path.dirname(dbFile);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}


// 📌 Initialiser la base SQLite
const db = new Database(dbFile);

// 🔹 Création de la table "users" si elle n'existe pas
db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL
  )
`).run();

// 🔍 Vérifier les tables existantes
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table';").all();

// 🚀 Lancement du serveur
fastify.listen({ port: 5000, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`🚀 Serveur Users démarré sur ${address}`);
});

// 🔹 Route POST pour le login
fastify.post("/login", async (request, reply) => {
  const { email, password } = request.body;
  if (!email || !password) {
    return reply.code(400).send({ success: false, error: "Champs manquants" });
  }
  try {
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (!user)
        return reply.send({ success: false, error: "Connexion Echouée : invalid email" });
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch)
      return reply.send({ success: false, error: "Connexion échouée : Mot de passe incorrect" });
    const token = generateToken(user);
    return reply.send({ success: true, token, username: user.username });
  } catch (error) {
    return reply.code(500).send({ success: false, error: "Erreur interne du serveur" });
  }
});

fastify.post("/modify_user", async (request, reply) => {
  const { email, password, newusername, username } = request.body;
  if (!email || !password || !newusername || !username) {
    return reply.code(400).send({ success: false, error: "Champs manquants" });
  }
  try {
    const newpassword = await bcrypt.hash(password, SALT_ROUNDS); 
    const stmt = db.prepare("UPDATE users SET username = ?, email = ?, password = ? WHERE username = ?");
    const result = stmt.run(newusername, email, newpassword, username);
    if (result.changes > 0) {
      return reply.send({succes: true});
    } else {
      return reply.send({success: false});
    }
  } catch (error) {
    return reply.code(500).send({ success: false, error: "Erreur interne du serveur" });
  }
});

fastify.get("/me", async (request, reply) => {
  try {
    const token = request.cookies.session;
    if (!token) {
      return reply.code(402).send({success: false, error: "Non autorise"});
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return reply.send({ success: true, user : decoded});
  } catch {
    return reply.code(401).send({ success: false, error: "Token invalide" });
  }
});

fastify.post('/logout', async (request, reply) => {
  reply
    .clearCookie('session', { path: '/' })
    .send({ success: true, message: 'Déconnecté' });
});

// 🔹 Route POST pour créer un compte
fastify.post("/create_account", async (request, reply) => {
  const { username, email, password } = request.body;
  if (!username || !email || !password) {
    return reply.code(400).send({ success: false, error: "Champs manquants" });
  }

  try {
    // 🔍 Vérifier si l'utilisateur existe déjà
    const existingemail = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (existingemail) {
      return reply.code(409).send({ success: false });
    }
    const existingUser = db.prepare("SELECT * FROM users WHERE email = ?").get(username);
    if (existingUser) {
      return reply.code(409).send({ success: false });
    }
    const hashedpasswrd = await bcrypt.hash(password, SALT_ROUNDS);
    // 🔹 Insérer le nouvel utilisateur
    db.prepare("INSERT INTO users (username, email, password) VALUES (?, ?, ?)").run(username, email, hashedpasswrd);

    return reply.send({ success: true, message: "Compte créé avec succès !" });

  } catch (error) {
    console.error("❌ Erreur lors de la création du compte :", error.message);
    return reply.code(500).send({ error: "Erreur interne du serveur" });
  }
});