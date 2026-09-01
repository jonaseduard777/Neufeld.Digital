#!/bin/zsh
# ============================================================
# neufeld.digital LIVE stellen
# Einfach doppelklicken. Lädt die fertigen Änderungen zu GitHub
# hoch — Vercel deployt danach automatisch auf neufeld.digital.
# ============================================================
cd "$(dirname "$0")" || exit 1

echo "──────────────────────────────────────────────"
echo "  neufeld.digital live stellen"
echo "──────────────────────────────────────────────"
echo ""
echo "Änderungen, die hochgeladen werden:"
git log --oneline origin/main..main 2>/dev/null
echo ""
echo "Lade zu GitHub hoch …"
echo ""

if git push origin main; then
  echo ""
  echo "✅ Fertig! Hochgeladen. Vercel deployt jetzt automatisch."
  echo "   In ~1 Minute ist es live auf https://neufeld.digital"
else
  echo ""
  echo "❌ Push fehlgeschlagen. Meist fehlt nur der GitHub-Login."
  echo "   Falls nach Benutzername/Passwort gefragt wird:"
  echo "   Benutzer = jonaseduard777, Passwort = dein GitHub-Token."
fi

echo ""
echo "Dieses Fenster kannst du jetzt schließen."
