const fastify = require("fastify")();
const axios = require("axios");
const fastifyCookie = require("@fastify/cookie");

let usersession = {}

fastify.register(fastifyCookie, {
    secret: process.env.COOKIE_SECRET,
}).then(() => {
    console.log("✅ Plugin `@fastify/cookie` chargé !");
}).catch(err => {
    console.error("❌ Erreur lors de l'enregistrement du plugin :", err);
});

async function log(req, reply) {
    try {
        
        const response = await axios.post("http://users:5000/login", req.body);
        const result = await response.data;
        if (result.success) {
            console.log(response.data);
            const {token , username} = response.data;
            usersession[token] = username;
            return reply
            .setCookie("session", token, {
                path: "/",
                httpOnly: true,  
                secure: true, // ⚠️ Mets `true` en prod (HTTPS obligatoire)
                maxAge: 18000,  
                sameSite: "None",  // ⚠️ Indispensable pour autoriser le partage de cookies cross-origin
                domain: "transcendence",  // ⚠️ Change en fonction de ton domaine
                partitioned: true  // ✅ Active la compatibilité avec "State Partitioning" de Firefox
            })
            .send({ success: true, message: `Bienvenue ${username}`});
        } else {
            return reply.send({success: false});
        }
    } catch (error) {
        console.error("❌ Erreur API users:", error.message);
        return reply.code(500).send({ error: "Erreur interne du serveur SPA" });
    }
}

async function create_account(req, reply) {
    try {
        
        const response = await axios.post("http://users:5000/create_account", req.body, {
            withCredentials: true
        });
        console.log(response.data);
        return reply.send(response.data);
    } catch (error) {
        const statuscode = error.response ? error.response.status : 500;
        const errormessage = error.response ? error.response.data.error : "Server Error";
        console.error("❌ Erreur API users:", error.message);
        return reply.code(statuscode).send({ error: errormessage });
    }
}

async function get_user(token) {
    return usersession[token] || null;
}

async function logout(token, reply) {
    delete usersession[token];
}

async function modify_user(req, reply) {
    console.log("i m here");
    const response = await axios.post("http://users:5000/modify_user", req.body, {
        withCredentials: true
    });
    reply.send(response.data);
}

async function waiting_room(req, reply) {
    const response = await axios.post("http://pong:4000/waiting_room", req.body);
    reply.send(response.data);
}

module.exports = { log , create_account , logout, get_user, modify_user, waiting_room };