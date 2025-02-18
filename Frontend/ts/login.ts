import {get_user} from "./game.js"
import {navigateTo} from "./spa.js"

(window as any).login = login;
(window as any).create_account = create_account;
(window as any).modify_user = modify_user;


console.log("login.ts chargé");

type LoginResponse = {
    success: boolean;
    message?: string;
};

type ModifyUserResponse = {
    success: boolean;
};


async function login(event: Event): Promise<void> {
    event.preventDefault();
    console.log("login appelé");
    
    const email = (document.getElementById("email") as HTMLInputElement).value;
    const password = (document.getElementById("password") as HTMLInputElement).value;
    
    try {
        const response = await fetch("/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        console.log(`email: ${email}`);
        console.log(`password: ${password}`);
        
        const result: LoginResponse = await response.json();
        console.log(`result::: ${result.success}`);

        if (result.success) {
            alert(JSON.stringify(result));
            navigateTo("");
        } else {
            alert("Erreur : Wrong email or password");
        }
    } catch (error) {
        console.error("Erreur réseau :", error);
        alert("Erreur de connexion au serveur.");
    }
}

async function create_account(event: Event): Promise<void> {
    event.preventDefault();
    console.log("create account appelé");
    
    const username = (document.getElementById("username") as HTMLInputElement).value;
    const password = (document.getElementById("password") as HTMLInputElement).value;
    const email = (document.getElementById("email") as HTMLInputElement).value;
    
    const response = await fetch("/create_account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, email })
    });
    
    console.log(`username: ${username}`);
    console.log(`password: ${password}`);
    console.log(`email: ${email}`);
    
    const result: LoginResponse = await response.json();
    console.log(`result success:: ${result.success}`);

    if (result.success) {
        alert("Compte créé!");
        navigateTo("login");
    } else {
        alert("Erreur: utilisateur existant");
    }
}

async function logout(print: boolean): Promise<void> {
    await fetch("/logout", { method: "GET" });
    
    console.log(`print: ${print}`);
    if (print) {
        alert("Déconnexion!");
        navigateTo("");
    }
}

async function modify_user(event: Event): Promise<void> {
    event.preventDefault();
    
    const newusername = (document.getElementById("username") as HTMLInputElement).value;
    const password = (document.getElementById("password") as HTMLInputElement).value;
    const email = (document.getElementById("email") as HTMLInputElement).value;
    
    console.log(`newusername: ${newusername}`);
    console.log(`password: ${password}`);
    console.log(`email: ${email}`);
    
    const username = await get_user(); 
    console.log(`oldusername: ${username}`);
    
    if (!username) {
        alert("Impossible de récupérer l'utilisateur!");
    } else {
        const response = await fetch("/modify_user", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ newusername, password, email, username })
        });
        
        const result: ModifyUserResponse = await response.json();
        
        if (result.success) {
            logout(false);
            alert("Modification effectuée!");
            navigateTo("login");
        } else {
            alert("Erreur lors de la modification.");
        }
    }
}
