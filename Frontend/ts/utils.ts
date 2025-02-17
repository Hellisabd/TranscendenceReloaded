let waiting_room: string[] = [];
let socket: WebSocket | null = null;
let isWebSocketConnected = false;

export async function get_user(): Promise<string> {
    try {
        const response = await fetch("/get_user", {
            method: "GET",
            credentials: "include",
        })
        if (!response.ok)
            return "";
        const data: {success: boolean; username?: string} = await response.json();
        return data.success ? data.username ?? "" : ""; 
    } catch (error) {
        alert("Erreur cant get user");
        return "";
    }
}

export async function connectWebSocket() {
	if (isWebSocketConnected) {
		console.log("Websocket already connected");
		return ;
	}

	const user =  await get_user();
	if (!user) {
		console.log("Can't get user");
		return ;
	}
	const sock_name = window.location.host;
	socket = new WebSocket("wss://" + sock_name + "ws/pong");
	socket.onopen = () => {
		console.log("✅ WebSocket connectée !");
	}
	socket.onmessage = (event) => {
		const data = JSON.parse(event.data);
		if (data.action === "start_game") {
			console.log("Launch game");
			initializeGame(data.username1, data.username2);
		}
	}
	socket.onerror = (event) => {
		console.error("❌ WebSocket erreur :", event);};
	socket.onclose = (event) => {
		console.warn("⚠️ WebSocket fermée :", event);};
}