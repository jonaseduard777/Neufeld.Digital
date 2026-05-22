#!/bin/bash
# Doppelklick → öffnet die Termin-Box als EINEN Tab in Safari (Posteingang).
# Innerhalb der Termin-Box kannst du oben zwischen Posteingang, Anrufe und
# Kalender wechseln. Wenn Safari schon ein Fenster offen hat (z. B. die
# Webseite via index.html), wird der Tab dort angehängt — sonst neues Fenster.
# Die Webseite wird hier NICHT eigenständig geöffnet.

cd "$(dirname "$0")"

GOLD='\033[38;5;178m'
DIM='\033[2m'
RESET='\033[0m'

clear
printf "\n"
printf "    ${GOLD}╔═══════════════════════╗${RESET}\n"
printf "    ${GOLD}║                       ║${RESET}\n"
printf "    ${GOLD}║${RESET}      ${GOLD}J E${RESET}              ${GOLD}║${RESET}\n"
printf "    ${GOLD}║${RESET}    ${DIM}Jonas Eduard${RESET}       ${GOLD}║${RESET}\n"
printf "    ${GOLD}║                       ║${RESET}\n"
printf "    ${GOLD}╚═══════════════════════╝${RESET}\n\n"

# 1) Termin-Inbox sicherstellen (läuft sonst per LaunchAgent im Hintergrund)
if ! curl -s -o /dev/null --max-time 1 http://localhost:3200/inbox; then
    echo "  Termin-Inbox starten …"
    launchctl load "/Users/jonaseduard/Library/LaunchAgents/com.jonaseduard.termine-eduard.plist" 2>/dev/null
    for i in 1 2 3 4 5 6 7 8 9 10; do
        sleep 1
        curl -s -o /dev/null --max-time 1 http://localhost:3200/inbox && break
    done
fi

# 2) Termin-Box öffnen. `open` ist die zuverlässige macOS-Methode — keine
#    Automation-Berechtigungen nötig. Safari entscheidet selbst, ob Tab oder
#    neues Fenster (Standard: Tab im vorhandenen Fenster).
open -a Safari "http://localhost:3200/inbox"

echo "  Termin-Inbox:    http://localhost:3200/inbox"
echo "  Kalender:        http://localhost:3200/kalender"
echo "  Anrufe:          http://localhost:3200/anrufe"
echo ""
echo "  Fertig — du kannst dieses Fenster jetzt schließen."
echo ""
