#!/bin/bash

npx tsc

chown -R root:root /usr/src/app/Frontend
npm start &


while inotifywait -r -e modify,create,delete /usr/src/app/Frontend/ts; do
    echo "Changement détecté ! Redémarrage du service..."
	npx tailwindcss -i ./style.css -o ./output.css
    npx tsc  # Ou relancer le processus concerné
done &

while inotifywait -r -e modify,create,delete /usr/src/app/Backend; do
    echo "Changement détecté ! Redémarrage du serveur..."
	kill $(pgrep -f "node")
    npm start & # Ou relancer le processus concerné
done

# npx tailwindcss -i ./Frontend/css/style.css -o ./Frontend/css/output.css --watch
