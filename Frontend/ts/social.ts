console.log("Script social.ts chargé !");
declare function get_user(): Promise<string | null>;

let friends: { username: string; status: string }[] = [];



let socialSocket: WebSocket | null = null;

async function display_friends() {
    const canvas = document.getElementById("friends_list") as HTMLCanvasElement;
    if (canvas) {
        const ctx = canvas.getContext("2d");
        if (!ctx) {
            return;
        }

        // Nettoyer le canvas avant de redessiner
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Définir la police et la couleur du titre
        ctx.font = "30px Arial";
        ctx.fillStyle = "#2D3748";  // Slate-500 en hex (équivalent)
        ctx.fillText("Friends", 10, 40);  // Décalage pour éviter que le texte soit collé au bord

        // Boucle pour afficher les amis
        for (let i = 0; i < friends.length; i++) {
            ctx.textAlign = "start";  // Alignement à gauche
            ctx.textBaseline = "alphabetic";  // Alignement vertical du texte

            ctx.font = "20px Arial";  // Taille de police pour le nom des amis
            let yPos = 70 + i * 40;  // Calculer la position Y, avec un espacement de 40px entre chaque ami

            // Définir la couleur en fonction du statut
            if (friends[i].status == "online") {
                ctx.fillStyle = "#00FF00";  // Vert
            } else if (friends[i].status == "offline") {
                ctx.fillStyle = "#FF0000";  // Rouge
            } else if (friends[i].status == "inqueue") {
                ctx.fillStyle = "#0080FF";  // Bleu
            } else if (friends[i].status == "ingame") {
                ctx.fillStyle = "#FF8000";  // Orange
            }

            // Afficher le nom de l'ami et son statut
            ctx.fillText(friends[i].username, 10, yPos);  // Affiche le nom à la position calculée
            ctx.fillText(friends[i].status, 200, yPos);   // Affiche le statut à une position différente
        }
    }
}

async function display_pending(user: string[]) {
	console.log("user tab:", user);
	console.log("user tab:", user);
	const canvas = document.getElementById("pending_request") as HTMLCanvasElement;
	if (canvas) {
		const ctx = canvas.getContext("2d");
        if (!ctx) {
            return ;
        }
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		for (let i = 0; i < user.length; i++) {
			ctx.textAlign = "start";
            ctx.textBaseline = "alphabetic";
            ctx.font = "20px Arial";
			ctx.fillStyle = "#0080FF";
            ctx.fillText(String(user[i]), 0, 20 + (i * 30));
            ctx.fillText(String("Invited you"), 200, 20 + (i * 30));
		}
	}
}

async function set_up_friend_list(user: string | null) {
	if (!user) {
		user = await get_user();
	}
    const sock_name = window.location.host;
	socialSocket = new WebSocket("wss://" + sock_name + "/ws/spa/friends");
    socialSocket.onopen = () => {
        console.log("✅ WebSocket users connectée !");
        socialSocket?.send(JSON.stringify({ username: user }));
    };
    socialSocket.onerror = (event) => {
    	console.error("❌ WebSocket users erreur :", user);};
	socialSocket.onclose = (event) => {
        console.warn("⚠️ WebSocket users fermée :", user);};
	socialSocket.onmessage = (event) => {
        let data = JSON.parse(event.data);
		const index = friends.findIndex(friend => friend.username == data.username);
		if (index == -1)
			friends.push({username: data.username, status: data.status});
		else {
			friends[index] = {username: data.username, status: data.status};
		}
		if (data.success == true && data.user_inviting) {
			console.log("lol?");
			display_pending(data.user_inviting);
		}
		else 
			console.log("pas lol?");
		display_friends();
    };
}

function close_users_socket() {
	socialSocket?.close();
	friends = [];
}

async function add_friend(event: Event): Promise<void> {
    event.preventDefault();

	const friend_username = (document.getElementById("friend_username") as HTMLInputElement).value;
	if (!sanitizeInput(friend_username)) {
        return alert("Be carefull i can bite");
    }
	const myusername = await get_user();
	if (myusername == friend_username) {
		alert("Prends un Curly");
		return ;
	}
	const response = await fetch("/add_friend", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ user_sending: myusername, user_to_add: friend_username })
	});
	const result: LoginResponse = await response.json();
	alert(result.message);
	return ;
}

async function pending_request(): Promise<void> {
	const myusername = await get_user();
	const response = await fetch("/pending_request", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ username: myusername})
	});
	const result = await response.json();
	console.log("result in pending: ", result);
	display_pending(result.user_inviting);
}
