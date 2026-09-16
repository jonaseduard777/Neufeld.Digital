#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
neufeld.digital — Leistungen neu aufgebaut

Baut die Sektion "Leistungen" komplett neu: gleiche Struktur in jedem
Aufklapper, kurze Texte, Video unter dem Text, Preis ohne Einrichtung.

STRUKTUR — in jedem Punkt exakt dieselbe Reihenfolge, damit man beim
zweiten Punkt schon weiss, wo der Preis steht:

  zugeklappt   Titel + ein Satz Teaser + Pfeil - KEIN Preis;
               Preise stehen ausschliesslich im aufgeklappten Kasten
  aufgeklappt  1. Text  (die "kleine Erklaerung", ~32 Woerter)
               2. Video - steht unter dem Text, laeuft in jedem Punkt
               3. Preiskasten
               4. Zur Auswahl

  Stichpunkt-Liste und der Terrakotta-Schlusssatz sind am 2026-09-02 raus
  ("dafuer gibt es das Video und die kleine Erklaerung"). Der alte Wortlaut
  steckt noch in index.html.bak-20260902-13*.

REIHENFOLGE: Arbeitsberichte, Lager, Betriebsbuch, Was brauchst du davon?,
Weitere. Seit 2026-09-12 (Ansage Jonas) steht das Lager VOR dem Betriebsbuch:
die beiden, die allein laufen, zuerst - das Betriebsbuch setzt sie voraus und
kommt zuletzt. Dieselbe Reihenfolge wie im Rundum-Paket, im Terminformular
und im Schema. (Vorher stand das Betriebsbuch direkt hinter dem Bericht,
weil der Bericht es fuellt.)

VIERTE ZEILE "WAS BRAUCHST DU DAVON?" (2026-09-11): kein Werkzeug, sondern
die Kombinationslogik - was allein laeuft (Arbeitsbericht, Lager), was erst
zusammen mehr kann (Bericht mit Materialkosten) und warum das Betriebsbuch
die beiden anderen voraussetzt. Stand vorher nirgends auf der Seite. Gleiche
Zeile wie die anderen (Titel, Teaser, Pfeil), im aufgeklappten Teil drei
Bausteine: Einzeln / Zusammen (zwei Berichte nebeneinander) / Was passt
(seit 2026-09-12 ohne eigene Zur-Auswahl-Knoepfe). Jede Aussage ist gegen die drei Apps geprueft (Protokoll-Generator, Lager,
Betriebsbuch), Stand 2026-09-11 - siehe KOMBI unten. Ausserdem traegt die
Betriebsbuch-Zeile seitdem ihre Voraussetzung sichtbar (tag + hinweis).

Die Nummern 01-05 sind raus: fuenf Werkzeuge, die man einzeln kauft, sind
keine Abfolge. Nummeriert wird stattdessen "In 4 Schritten im Betrieb" -
dort ist die Reihenfolge echt.

Ausserdem: no-js-Fix, autocomplete am Formular, "vier" -> "fuenf".

Aufruf:   python3 patch-neufeld.py [pfad/zum/projekt]
Zurueck:  python3 patch-neufeld.py --undo
"""

import os
import re
import sys
import glob
import shutil
import datetime

MARK = "ND-LEISTUNGEN"
FILES = ("index.html", "style.css", "script.js")
CLIP_BASIS = "https://elektro.neufeld.digital/"


# ===========================================================================
# INHALTE - alles, was auf der Seite steht, steht hier. Sonst nirgends.
# ===========================================================================
#
# PREISMODELL (Stand 2026-09-02, von Jonas vorgegeben):
# Einmalige Einrichtung + fester Monatspreis. Nur die Arbeitsberichte haben
# einen Kopfpreis - dort waechst der Nutzen mit der Mannschaft. Betriebsbuch,
# Lager und Telefon sind pauschal.
#
#   Werkzeug          Einmalig     Monatlich
#   Arbeitsberichte     500 EUR    19,99 EUR je Person   (Betriebe)
#     fuer Selbststaendige ohne Mitarbeiter (seit 2026-09-16): keine
#     Einrichtung, 24,99 EUR monatlich, genau ein Zugang, Abrechnung
#     vierteljaehrlich im Voraus. Auf der Seite steht NUR der Monatspreis -
#     keinen Quartals- oder Jahresbetrag ausrechnen. Kommt ein Mitarbeiter
#     dazu, gilt der Betriebs-Tarif. Gilt nur fuer den Arbeitsbericht.
#   Betriebsbuch      1.000 EUR    69,99 EUR
#   Lager               1.000 EUR  89,99 EUR
#   Weitere                 -      nach Umfang
#
# RUNDUM-PAKET (Stand 2026-09-05): alle drei fertigen Werkzeuge zusammen.
#   Rundum-Paket      2.250 EUR   149,99 EUR + 12,99 EUR je Person
# Der Kopfpreis bleibt drin, aus demselben Grund wie oben: der Nutzen waechst
# mit der Mannschaft. Eine reine Pauschale waere entweder fuer den Drei-Mann-
# Betrieb zu teuer oder fuer den mit fuenfzehn zu billig gewesen.
# Einzeln kostet dasselbe 2.500 EUR Einrichtung und 159,98 EUR + 19,99 EUR je
# Person - macht 14 % Ersparnis bei drei Leuten, 21 % bei neun, 27 % bei zwanzig.
#
# Sprachregelung: "einmalig" und "monatlich", nie "laufend"; "je Person",
# nie "je Kopf".

WERKZEUGE = [
    {
        "key": "arbeitsberichte",
        "titel": "Automatisierte Arbeitsberichte",
        "teaser": "Einmal ins Handy erzählen — der Bericht schreibt sich selbst.",
        "preis": "Für Betriebe: <strong>500 €</strong> einmalig, dann <strong>19,99 €</strong> monatlich je Person.",
        # Zweite, kleinere Zeile direkt unter dem Betriebs-Preis - keine
        # eigene Preiskarte. Nur der Arbeitsbericht hat das Feld.
        "preis_klein": (
            "Du arbeitest allein? Für Selbstständige ohne Mitarbeiter: "
            "<strong>24,99 €</strong> monatlich, ohne Einrichtungsgebühr. "
            "Ein Zugang, Abrechnung vierteljährlich."
        ),
        "kapitel": "protokoll",
        "text": (
            "Aufnahme drücken und erzählen — oder den Zettel fotografieren. Die KI "
            "füllt den Auftragszettel: Kunde, Ort, Arbeiten, Material, Zeiten. Vor "
            "dem Absenden korrigierbar, danach fertiges PDF mit deinem Firmenkopf."
        ),
    },
    {
        "key": "lager",
        "titel": "Automatisiertes Lager",
        "teaser": "QR am Regal, Kamera drauf — die Nachbestellung schreibt sich allein.",
        "preis": "<strong>1.000 €</strong> einmalig, dann <strong>89,99 €</strong> monatlich.",
        "kapitel": "lager",
        "text": (
            "Jeder Artikel bekommt einen QR-Aufkleber. Entnehmen heißt: Kamera drauf, "
            "tippen, fertig — ohne App. Fällt der Bestand aufs Minimum, schreibt die "
            "KI die Bestellung an deinen Lieferanten."
        ),
    },
    {
        "key": "betriebsbuch",
        "titel": "Automatisiertes Betriebsbuch",
        "teaser": "Stunden, Zuschläge, Lohn — bis zur fertigen Kundenrechnung.",
        "preis": "<strong>1.000 €</strong> einmalig, dann <strong>69,99 €</strong> monatlich.",
        "kapitel": "betriebsbuch",
        "text": (
            "Stundenzettel abtippen fällt weg: die Zeiten kommen aus dem "
            "Arbeitsbericht. Zuschläge, Bereitschaft, Urlaub und Krank rechnet das "
            "Betriebsbuch selbst. In der Übersicht steht, was du überweisen musst."
        ),
        # Die Voraussetzung steht in der Zeile selbst, nicht im Kleingedruckten:
        # ein Interessent soll nicht erst im Gespraech merken, dass er drei
        # Sachen braucht. Grund (geprueft im Code des Betriebsbuchs): Zeiten
        # kommen per /api/ingest aus dem Arbeitsbericht, Materialpreise (EK und
        # VK) ausschliesslich live aus dem Lager - eigene Preispflege gibt es
        # dort seit dem Umbau nicht mehr.
        "tag": "Nur zusammen mit Arbeitsbericht + Lager",
        "hinweis": (
            "<strong>Voraussetzung:</strong> Arbeitsbericht und Lager. Daraus kommen "
            "die Stunden und die Materialpreise — ohne die beiden tippst du jeden "
            "Stundenzettel selbst, und Material steht ohne Preis da."
        ),
    },
    {
        "key": "weitere-automatisierung",
        "titel": "Weitere Automatisierungen für deinen Betrieb",
        "teaser": "Dein Ablauf ist nicht dabei? Dann bauen wir ihn.",
        "preis": "<strong>Nach Umfang</strong> — Einrichtung und Monatspreis stehen im Angebot.",
        "kapitel": None,
        "text": (
            "Angebote schreiben, Rechnungen stellen, dieselben Daten zum dritten Mal "
            "eintippen — irgendetwas frisst in jedem Betrieb jede Woche Stunden. Sag "
            "mir, was es bei dir ist."
        ),
    },
]

# ---------------------------------------------------------------------------
# WAS BRAUCHST DU DAVON? - die vierte Zeile: Kombinationslogik.
# Alles hier ist gegen die Apps geprueft (Stand 2026-09-11):
#   Arbeitsbericht: Foto/Sprache/Tippen -> KI fuellt Kunde, Ort, Arbeiten,
#     Material, Zeiten, Fotos, Unterschriften -> PDF/Mail. Materialkosten nur
#     mit Lager-Katalog (/api/material-preis antwortet sonst verfuegbar:false).
#   Lager: QR-Etiketten, Kamera-Scan im Browser, Bestand/Minimum, KI-Bestellung
#     per Mail; druckbare Materialuebersicht je Baustelle (/baustelle/:id).
#   Zusammen: offene Entnahmen des Monteurs stehen automatisch im frischen
#     Bericht (app.js ladeLagerEntnahmen), Baustelle wird vorbelegt, der Bericht
#     zeigt "Materialkosten (aus Lager)" als Summe zum EINKAUFSPREIS - am
#     Bildschirm (no-print), nicht auf dem Kunden-PDF. Verkaufspreise rechnet
#     erst das Betriebsbuch (Rechnung, Nachkalkulation).
#   Betriebsbuch: bekommt jeden Bericht mit Zeiten + materialkosten, Loehne mit
#     Zuschlaegen, Verrechnungssatz je Baustelle, Deckungsbeitrag, Rechnung
#     (Material zum VK aus dem Lager oder Standard-Aufschlag). Nur der Chef
#     meldet sich an; Mitarbeiter sind Stammdaten.
# Die Zahlen im Beispiel-Bericht sind Anschauung, keine Angebotspreise.
# Fuer "Arbeitsbericht + Lager" gibt es KEINEN eigenen Preis - darum steht
# dort auch keiner; die Preise stehen in den beiden Werkzeug-Zeilen.
KOMBI = {
    "key": "kombination",
    "titel": "Was brauchst du davon?",
    "teaser": "Zwei laufen für sich allein, eins braucht die anderen beiden — in 30 Sekunden erklärt.",
    "intro": (
        "Zwei Werkzeuge laufen für sich allein, eins setzt die anderen beiden "
        "voraus. Hier steht, was jedes allein kann — und was erst zusammen geht."
    ),
    "einzeln_kopf": "Einzeln",
    "einzeln": [
        # Texte fuer Arbeitsbericht und Betriebsbuch stammen von Jonas
        # (2026-09-12), gegen die Apps geprueft: Fahrtzeit + Kilometer und
        # Kundenunterschrift stehen im Bericht, Zugaenge legt der Chef an und
        # das Startpasswort muss beim ersten Anmelden ersetzt werden
        # (mussAendern); im Betriebsbuch gibt es je Mitarbeiter Stundenlohn,
        # Kostensatz, Soll-Stunden und Urlaubsanspruch. "absaetze" = je Eintrag
        # ein <p>, "grenze" = der Schlussabsatz.
        {
            "name": "Arbeitsbericht",
            "stand": "läuft allein",
            "bedingt": False,
            "absaetze": [
                "Am Ende des Tages erzählt der Monteur ins Handy, was er gemacht hat. "
                "Daraus wird ein fertiger Bericht: Kunde, Baustelle, Tätigkeiten, "
                "Arbeitszeit, Fahrtzeit und Kilometer, Unterschrift vom Kunden. Als PDF "
                "raus oder direkt per Mail.",
                "Fotos hängt er dran, wo es hakt: eine Wand, die nicht so ist wie "
                "geplant, eine Leitung, die woanders liegt, oder einfach der Stand, an "
                "dem er aufgehört hat. Wer am nächsten Tag rausfährt, weiß dann, wo "
                "weitergemacht wird und worauf er achten muss — statt erst vor Ort "
                "anzurufen.",
                "Jeder Mitarbeiter hat seinen eigenen Zugang. Die legt der Chef an, das "
                "Passwort setzt sich jeder beim ersten Anmelden selbst. Damit steht bei "
                "jedem Bericht fest, wer ihn geschrieben hat.",
            ],
            "grenze": (
                "<strong>Grenze allein:</strong> Material steht nur so drin, wie der "
                "Monteur es gesagt hat — ohne Preise, ohne Summe. Mit dem Lager wird "
                "daraus ein Bericht mit echten Materialkosten."
            ),
        },
        {
            "name": "Lager",
            "stand": "läuft allein",
            "bedingt": False,
            "absaetze": [
                "QR am Regal, Kamera drauf, Bestand sinkt. Fällt er aufs Minimum, "
                "schreibt die KI die Bestellung. Dazu je Baustelle die Liste, was "
                "rausgegangen ist.",
            ],
            "grenze": "<strong>Braucht nichts anderes.</strong>",
        },
        {
            "name": "Betriebsbuch",
            "stand": "nur mit beiden",
            "bedingt": True,
            "absaetze": [
                # Jonas' Fassung: "und der Einzige, an dem er sich anmeldet" - der
                # Chef meldet sich aber auch im Arbeitsbericht an (er legt dort
                # die Zugaenge an). Darum: hier meldet sich NUR er an.
                "Der Platz des Chefs — hier meldet sich nur er an. Jeder Bericht "
                "landet von selbst hier: mit Stunden, Baustelle, Fahrtzeit und dem "
                "Material aus dem Lager samt Preis. Nichts wird abgetippt.",
                "Zu jedem Mitarbeiter liegen Stundenlohn, interner Kostensatz, "
                "Soll-Stunden und Urlaubsanspruch hinterlegt. Daraus rechnet das "
                "Betriebsbuch die Löhne samt Zuschlägen, zeigt pro Baustelle, was sie "
                "gekostet und was sie gebracht hat, und am Ende fällt die "
                "Kundenrechnung mit raus.",
                "Die Mitarbeiter selbst melden sich hier nie an. Sie sind nur "
                "Datensätze, ihre Namen kommen aus dem Arbeitsbericht mit.",
            ],
            "grenze": (
                "<strong>Warum nur zusammen:</strong> die Stunden kommen aus dem "
                "Arbeitsbericht, die Preise aus dem Lager. Ohne die beiden tippst du "
                "jeden Stundenzettel selbst, und Material steht ohne Preis da."
            ),
        },
    ],
    "zusammen_kopf": "Zusammen",
    "zusammen_titel": "Arbeitsbericht + Lager — die Empfehlung für den Alltag",
    # Zwei Berichte nebeneinander: derselbe Tag, einmal ohne, einmal mit Lager.
    "blatt_ohne": {
        "label": "Arbeitsbericht allein",
        "zeilen": [
            ("Baustelle", "Hauptstraße 12"),
            ("Arbeiten", "Verteilung erneuert, 4 Steckdosen gesetzt"),
            ("Material", "NYM-Kabel, Steckdosen, Schalter"),
            ("Zeit", "07:30 – 15:45"),
        ],
        "fuss": "Material: kein Preis, keine Summe",
    },
    "blatt_mit": {
        "label": "Arbeitsbericht + Lager",
        "badge": "Lager · 3 Positionen übernommen",
        "zeilen": [
            ("Baustelle", "Hauptstraße 12"),
            ("Arbeiten", "Verteilung erneuert, 4 Steckdosen gesetzt"),
            ("Material", "25 m NYM-J 3×1,5 · 4 Steckdosen · 2 Schalter"),
            ("Zeit", "07:30 – 15:45"),
        ],
        "fuss_label": "Materialkosten (aus Lager)",
        "fuss_wert": "68,40 €",
    },
    "zusammen_text": (
        "Scannt der Monteur das Material am Regal, steht es beim nächsten Bericht "
        "schon drin — samt Baustelle — und der Bericht rechnet die Materialkosten "
        "zum Einkaufspreis mit. Auf dem Kunden-PDF bleibt die Summe weg; die ist "
        "für dich."
    ),
    "alle_drei": (
        "<strong>Alle drei:</strong> Das Betriebsbuch bekommt jeden Bericht mit "
        "Zeiten und Materialkosten und macht daraus Löhne mit Zuschlägen, die "
        "Nachkalkulation je Baustelle und die Kundenrechnung — Material zum "
        "Verkaufspreis aus dem Lager."
    ),
    "alle_drei_link": "Zum Rundum-Paket",
    "wahl_kopf": "Was passt zu dir?",
    # Reine Entscheidungshilfe, ohne Knoepfe: die "Zur Auswahl"-Knoepfe je
    # Zeile sind am 2026-09-12 auf Jonas' Ansage raus ("die sollen da nicht
    # stehen"). Ausgewaehlt wird weiter in den Werkzeug-Zeilen und im Paket.
    "wahl": [
        {"frage": "Nur Stunden und Arbeiten festhalten",
         "antwort": "Arbeitsbericht", "empfehlung": False},
        {"frage": "Nur das Material im Griff haben",
         "antwort": "Lager", "empfehlung": False},
        {"frage": "Beides — und die Materialkosten gleich im Bericht",
         "antwort": "Arbeitsbericht + Lager", "empfehlung": True},
        {"frage": "Alles auswerten: Löhne, Preise, Rechnungen",
         "antwort": "Alle drei", "empfehlung": False},
    ],
}

# Das Rundum-Paket steht als eigener Block unter der Liste - nicht als
# fuenfte Zeile. Es ist kein weiteres Werkzeug, sondern die Klammer um die
# drei fertigen.
PAKET = {
    "key": "rundum-paket",
    "label": "Rundum-Paket",
    "titel": "Alle drei Werkzeuge zusammen",
    # Der Erklaersatz ist am 2026-09-05 auf Jonas' Ansage raus - der Titel und
    # die Enthalten-Liste sagen dasselbe kuerzer. Wortlaut bleibt hier stehen,
    # falls er zurueck soll; im Markup wird er nicht mehr ausgegeben.
    "text": (
        "Die drei greifen ineinander: Material vom QR-Scan steht im Bericht, die "
        "Zeiten aus dem Bericht stehen im Betriebsbuch, daraus wird die "
        "Kundenrechnung. Eingerichtet wird alles in einem Durchgang."
    ),
    # Was im Paket steckt - dieselben Titel wie oben in der Liste
    "enthalten": [
        "Automatisierte Arbeitsberichte",
        "Automatisiertes Lager",
        "Automatisiertes Betriebsbuch",
    ],
    "betrag": "149,99 €",
    "takt": "/ Monat",
    "zusatz": "+ 12,99 € je Person",
    # Derselbe Betrag noch einmal nackt - er steht seit dem Umbau am
    # 2026-09-05 mitten im Preissatz und nicht mehr als eigene Zeile.
    "kopf_preis": "12,99 €",
    "einmalig": "2.250 €",
    # Der Vergleich ist echt: einzeln kostet die Einrichtung 500 + 1.000 + 1.000.
    "einmalig_statt": "2.500 €",
    # 45 EUR im Monat mal zwoelf plus 250 EUR bei der Einrichtung.
    "spar": "Im ersten Jahr rund 790 € günstiger als einzeln",
}

# Videos sind am 2026-09-02 auf Jonas' Ansage vorerst abgeschaltet
# ("schneide erst mal alle Videos raus"). Der Bauplan bleibt stehen:
# Schalter auf True, Skript laufen lassen, Videos sind wieder da.
VIDEOS_AN = False
VIDEO_HINWEIS = "Dieses Werkzeug im Video — unter einer Minute."

SCHRITT_NUMMERN = ["1", "2", "3", "4"]


# ===========================================================================
# HTML
# ===========================================================================

def baue_liste():
    zeilen = []
    for i, w in enumerate(WERKZEUGE, start=1):
        # Die Kombinationslogik steht hinter den drei fertigen Werkzeugen und
        # vor "Weitere" - erst die Teile, dann was zusammenpasst. Haengt an
        # "Weitere", nicht am letzten Werkzeug, damit ein Umsortieren der
        # Werkzeuge sie nicht mitnimmt.
        if w["key"] == "weitere-automatisierung":
            zeilen.append(baue_kombi())
        video = ""
        if VIDEOS_AN and w["kapitel"]:
            video = (
                '              <div class="tool-video" data-kapitel="%s">\n'
                '                <div class="tool-video-rahmen"></div>\n'
                '                <p class="tool-video-hinweis">%s</p>\n'
                '              </div>\n' % (w["kapitel"], VIDEO_HINWEIS)
            )

        # Voraussetzung sichtbar in der Zeile (tag) und im Aufklapper (hinweis)
        tag = ('\n                <span class="tool-item-tag">%s</span>' % w["tag"]) if w.get("tag") else ""
        hinweis = ('              <p class="tool-hinweis">%s</p>\n' % w["hinweis"]) if w.get("hinweis") else ""
        # Kleine Zusatzzeile im Preiskasten (Einzel-Tarif beim Arbeitsbericht)
        preis_klein = ('\n                <p class="tool-preis-klein">%s</p>' % w["preis_klein"]) if w.get("preis_klein") else ""

        zeilen.append("""        <li class="tool-item" data-tool-key="%(key)s">
          <h3 class="tool-item-head">
            <button type="button" class="tool-toggle" aria-expanded="false" aria-controls="tool-panel-%(i)d">
              <span class="tool-item-copy">
                <span class="tool-item-label">%(titel)s</span>
                <span class="tool-item-teaser">%(teaser)s</span>%(tag)s
              </span>
              <span class="tool-item-dot" aria-hidden="true"></span>
              <svg class="tool-item-arrow" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 6 15 12 9 18"/></svg>
            </button>
          </h3>
          <div class="tool-panel" id="tool-panel-%(i)d" hidden>
            <div class="tool-panel-inner">
              <p class="tool-panel-text">%(text)s</p>
%(hinweis)s%(video)s              <div class="tool-preis">
                <p class="tool-preis-zeile">%(preis)s</p>%(preis_klein)s
              </div>
              <button type="button" class="tool-select" data-tool-add="%(key)s">
                <span class="tool-select-icon" aria-hidden="true"></span>
                <span class="tool-select-text">Zur Auswahl</span>
              </button>
            </div>
          </div>
        </li>""" % dict(w, i=i, video=video, tag=tag, hinweis=hinweis, preis_klein=preis_klein))


    return ('<!-- %s:START -->\n      <ul class="tool-list" data-aos="fade-up">\n\n'
            '%s\n\n      </ul>\n\n'
            '%s\n'
            '      <!-- %s:END -->'
            % (MARK, "\n\n".join(zeilen), baue_paket(), MARK))


def _blatt(b, mit):
    """Ein Beispiel-Bericht im Kleinformat: Label, vier Zeilen, Fusszeile.
    'mit' = die Fassung mit Lager (Badge + Summe)."""
    zeilen = "\n".join(
        '                      <div><dt>%s</dt><dd>%s</dd></div>' % (k, v)
        for k, v in b["zeilen"])
    if mit:
        fuss = ('<p class="kombi-blatt-fuss"><span>%s</span><strong>%s</strong></p>'
                % (b["fuss_label"], b["fuss_wert"]))
        badge = '\n                    <span class="kombi-badge">%s</span>' % b["badge"]
    else:
        fuss = '<p class="kombi-blatt-fuss ist-leer"><span>%s</span></p>' % b["fuss"]
        badge = ""
    return """                  <div class="kombi-blatt%s" aria-label="%s">
                    <span class="kombi-blatt-label">%s</span>%s
                    <dl class="kombi-blatt-zeilen">
%s
                    </dl>
                    %s
                  </div>""" % (" kombi-blatt--mit" if mit else "", b["label"], b["label"], badge, zeilen, fuss)


def baue_kombi():
    """Die vierte Zeile: kein Werkzeug, die Erklaerung, was allein laeuft und was
    erst zusammen geht. Gleicher Kopf wie die Werkzeug-Zeilen; im Aufklapper
    drei Bausteine. Kein Preis, kein Video - Preise stehen bei den Werkzeugen,
    fuer "Arbeitsbericht + Lager" gibt es keinen eigenen."""
    k = KOMBI
    einzeln = "\n".join("""                <li>
                  <div class="kombi-einzeln-kopf">
                    <span class="kombi-einzeln-name">%(name)s</span>
                    <span class="kombi-stand%(cls)s">%(stand)s</span>
                  </div>
%(absaetze)s
                  <p class="kombi-grenze">%(grenze)s</p>
                </li>""" % dict(e, cls=" ist-bedingt" if e["bedingt"] else "",
                                absaetze="\n".join("                  <p>%s</p>" % a for a in e["absaetze"]))
        for e in k["einzeln"])

    wahl = "\n".join("""                <li class="kombi-wahl-zeile">
                  <span class="kombi-wahl-frage">%(frage)s</span>
                  <span class="kombi-wahl-antwort">%(empf)s%(antwort)s</span>
                </li>""" % dict(w, empf='<span class="kombi-empfehlung">Empfehlung</span>' if w["empfehlung"] else "")
        for w in k["wahl"])

    return """        <li class="tool-item tool-item--kombi" data-tool-key="%(key)s">
          <h3 class="tool-item-head">
            <button type="button" class="tool-toggle" aria-expanded="false" aria-controls="tool-panel-kombi">
              <span class="tool-item-copy">
                <span class="tool-item-label">%(titel)s</span>
                <span class="tool-item-teaser">%(teaser)s</span>
              </span>
              <span class="tool-item-dot" aria-hidden="true"></span>
              <svg class="tool-item-arrow" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 6 15 12 9 18"/></svg>
            </button>
          </h3>
          <div class="tool-panel" id="tool-panel-kombi" hidden>
            <div class="tool-panel-inner">
              <p class="tool-panel-text">%(intro)s</p>

              <span class="kombi-kicker">%(einzeln_kopf)s</span>
              <ul class="kombi-einzeln">
%(einzeln)s
              </ul>

              <span class="kombi-kicker">%(zusammen_kopf)s</span>
              <div class="kombi-zusammen">
                <p class="kombi-zusammen-titel">%(zusammen_titel)s</p>
                <div class="kombi-blaetter">
%(blatt_ohne)s
%(blatt_mit)s
                </div>
                <p class="kombi-zusammen-text">%(zusammen_text)s</p>
                <p class="kombi-alle">%(alle_drei)s <a class="kombi-link" href="#rundum-paket">%(alle_drei_link)s →</a></p>
              </div>

              <span class="kombi-kicker">%(wahl_kopf)s</span>
              <ul class="kombi-wahl">
%(wahl)s
              </ul>
            </div>
          </div>
        </li>""" % dict(k, einzeln=einzeln, wahl=wahl,
                        blatt_ohne=_blatt(k["blatt_ohne"], False),
                        blatt_mit=_blatt(k["blatt_mit"], True))


def baue_paket():
    """Der Rundum-Block unter der Liste. Steht bewusst ausserhalb der <ul>:
    er ist kein weiteres Werkzeug, sondern die Klammer um die drei fertigen.
    Zwei Spalten am Rechner, untereinander am Handy."""
    posten = "\n".join(
        '          <li><span class="paket-nr">%02d</span>%s</li>' % (i, t)
        for i, t in enumerate(PAKET["enthalten"], start=1))
    # id: Ziel des Links "Zum Rundum-Paket" aus der Kombinations-Zeile.
    # Der Erklaersatz (.paket-text) wird wieder ausgegeben: er stand am
    # 2026-09-11 live in index.html, das Skript haette ihn beim naechsten Lauf
    # stillschweigend entfernt.
    return """      <div class="paket" id="rundum-paket" data-aos="fade-up">
        <span class="paket-label">%(label)s</span>
        <h3 class="paket-titel">%(titel)s</h3>
        <p class="paket-text">%(text)s</p>

        <p class="paket-enthalten-kopf">Enthalten</p>
        <ul class="paket-enthalten">
%(posten)s
        </ul>

        <div class="paket-preis">
          <p class="paket-preis-zeile"><strong>%(einmalig)s</strong> einmalig, dann <strong>%(betrag)s</strong> monatlich + <strong>%(kopf_preis)s</strong> je Person.</p>
          <p class="paket-preis-statt">statt <s>%(einmalig_statt)s</s> Einrichtung</p>
        </div>

        <button type="button" class="paket-select" data-tool-add="%(key)s">
          <span class="tool-select-icon" aria-hidden="true"></span>
          <span class="tool-select-text">Zur Auswahl</span>
        </button>

        <p class="paket-spar">%(spar)s</p>
      </div>""" % dict(PAKET, posten=posten)


# ===========================================================================
# CSS
# ===========================================================================

CSS = """
/* {M}:START */

/* --- Zeile: Titel + Teaser links, Preis rechts --------------------------- */
.tool-item + .tool-item {{ border-top: 1px solid var(--line, rgba(23,22,26,.10)); }}

.tool-item-copy {{
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}}
.tool-item-teaser {{
  font-size: .95rem;
  font-weight: 400;
  line-height: 1.45;
  color: var(--muted, #5b5a61);
  /* Seit der Preis aus der Zeile raus ist, ist rechts Platz - der Teaser
     darf einzeilig bleiben, statt auf 46ch umzubrechen. */
  max-width: 64ch;
  max-height: 4em;
  transition: opacity 200ms ease 60ms, max-height 300ms ease;
}}
.tool-item.is-open .tool-item-teaser {{
  opacity: 0;
  max-height: 0;
  overflow: hidden;
  transition: opacity 160ms ease, max-height 260ms ease;
}}

{video_css}/* --- Preiskasten -------------------------------------------------------- */
.tool-preis {{
  margin: 26px 0 22px;
  padding: 16px 20px;
  border: 1px solid var(--accent-line, rgba(226, 85, 43, .30));
  border-radius: 14px;
  background: var(--accent-wash, rgba(226, 85, 43, .09));
}}
.tool-preis-zeile {{
  margin: 0;
  font-size: 1.05rem;
  line-height: 1.5;
  color: var(--ink, #17161A);
}}
.tool-preis-zeile strong {{ font-weight: 600; white-space: nowrap; }}
/* Einzel-Tarif: kleinere Zeile direkt unter dem Betriebs-Preis - derselbe
   Baustein wie .paket-preis-statt, keine eigene Preiskarte */
.tool-preis-klein {{
  margin: 7px 0 0;
  font-size: .88rem;
  line-height: 1.5;
  color: var(--muted, #6E6A73);
}}
.tool-preis-klein strong {{ font-weight: 600; color: var(--ink, #17161A); white-space: nowrap; }}

/* --- Nummern gehoeren hierher, nicht zu den Werkzeugen ------------------- */
.process-card {{ position: relative; }}
.process-num {{
  position: absolute;
  top: 16px;
  right: 18px;
  font-size: .78rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: .04em;
  color: var(--accent, #E2552B);
  opacity: .85;
}}

@media (max-width: 760px) {{
  .tool-item-teaser {{ font-size: .9rem; max-width: 100%; }}
{video_css_mobil}  .tool-preis {{ padding: 14px 16px; }}
  .tool-preis-zeile {{ font-size: 1rem; }}
  .tool-preis-klein {{ font-size: .84rem; }}
}}

/* --- Rundum-Paket: die Klammer um die drei Werkzeuge --------------------- */
/* Grosser Typ-Sprung (Preis und Titel gross, alles andere klein), Mono fuer
   Label und Nummern.
   HINTER BUCHSTABEN UND ZAHLEN LIEGT KEINE FARBE (Ansage Jonas,
   2026-09-05). Es gab zwei Zwischenstaende - erst neun orange Flecken hinter
   den einzelnen Zeilen, dann eine warme Flaeche ueber dem ganzen Block plus
   ein Schein hinter dem Preis. Beides ist raus, weil Text auf farbigen
   Schlieren schlechter liest. Farbe gibt es nur noch am Rand. */
/* AUFBAU WIE EIN AUFGEKLAPPTER LEISTUNGSPUNKT (Ansage Jonas, 2026-09-05):
   eine Spalte, linksbuendig, in derselben Reihenfolge wie oben in der Liste
   - Titel, Erklaerung, Preis im ruhigen Kasten, Knopf. Vorher standen Text
   und Preis in zwei Spalten mit senkrechter Trennlinie; das war ein eigener
   Bauplan an genau der Stelle, an der die Seite sonst immer gleich
   funktioniert, und der Preis stand doppelt so gross wie ueberall sonst. */
.paket {{
  position: relative;
  isolation: isolate;         /* haelt die Lichtbahn im Block */
  max-width: 640px;           /* Textbreite wie .tool-panel-inner (62ch) */
  margin: 56px auto 0;
  padding: 40px 42px 38px;
  border-radius: var(--r-xl, 32px);
}}

/* --- Die Lichtbahn im Rahmen ---------------------------------------------
   Zwei Lagen, beide auf einen 1 px schmalen Rand maskiert (aussen minus
   innen): unten die ruhende Haarlinie, die immer steht - auch ohne JS -,
   darueber ein Kegelverlauf, der fast rundum durchsichtig ist und nur auf
   einem kurzen Bogen glueht. Dreht der Winkel, wandert der Bogen am Rand
   entlang. Die Klasse .leuchtet setzt script.js beim Sichtbarwerden. */

/* Der Winkel muss angemeldet sein, sonst kann der Browser ihn nicht weich
   drehen, sondern nur hart von 0 auf 360 umschalten. */
@property --winkel {{
  syntax: "<angle>";
  inherits: false;
  initial-value: 0deg;
}}

.paket::before {{
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: inherit;
  padding: 1px;              /* = Breite der Lichtbahn */
  background:
    conic-gradient(from var(--winkel),
      rgba(226, 85, 43, 0)     0deg,
      rgba(226, 85, 43, 0)    26deg,
      rgba(226, 85, 43, .30)  42deg,
      rgba(255, 141, 79, 1)   54deg,
      rgba(226, 85, 43, .30)  66deg,
      rgba(226, 85, 43, 0)    82deg,
      rgba(226, 85, 43, 0)   360deg),
    linear-gradient(rgba(23, 22, 26, .10) 0 0);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
          mask-composite: exclude;
}}

/* Zuenden: eine schnelle Runde aus dem Stand, danach der ruhige Dauerlauf.
   Der Lauf beginnt genau dort, wo das Zuenden aufhoert (330 = -30 Grad),
   damit an der Naht nichts springt. */
.paket.leuchtet::before,
.paket.leuchtet::after {{
  animation:
    paketZuenden 1150ms cubic-bezier(.16, .84, .28, 1) both,
    paketLauf 8s linear 1150ms infinite;
}}
@keyframes paketZuenden {{ from {{ --winkel: -30deg; }} to {{ --winkel: 330deg; }} }}
@keyframes paketLauf    {{ from {{ --winkel: -30deg; }} to {{ --winkel: 330deg; }} }}

/* --- Der Nachglut-Saum ---------------------------------------------------
   Dieselbe Bahn ein zweites Mal, breiter und weichgezeichnet: das Licht
   zieht einen Schein hinter sich her, statt als kalter Strich zu wandern.
   Einzige Stelle mit filter: blur() - eine Ebene, und auf dem Handy aus. */
.paket::after {{
  content: "";
  position: absolute;
  inset: -1px;
  z-index: -2;
  border-radius: inherit;
  padding: 3px;
  background: conic-gradient(from var(--winkel),
      rgba(226, 85, 43, 0)     0deg,
      rgba(226, 85, 43, 0)    18deg,
      rgba(226, 85, 43, .55)  42deg,
      rgba(255, 141, 79, .95) 54deg,
      rgba(226, 85, 43, .55)  66deg,
      rgba(226, 85, 43, 0)    90deg,
      rgba(226, 85, 43, 0)   360deg);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
          mask-composite: exclude;
  filter: blur(14px);
  opacity: 0;
  transition: opacity 1100ms var(--ease);
}}
.paket.leuchtet::after {{ opacity: 1; }}

/* --- Textspalte ---------------------------------------------------------- */
/* Mono + Versalien + weites Sperren fuer Label und Nummern: der Kleinkram
   bekommt eine eigene Stimme, statt eine kleinere Fassung der Ueberschrift
   zu sein. */
.paket-label {{
  display: inline-block;
  font-family: var(--font-mono);
  font-size: .72rem;
  font-weight: 500;
  letter-spacing: .16em;
  text-transform: uppercase;
  color: var(--accent-deep, #C13F17);
}}
/* Titel und Text in der Groesse eines Leistungspunkts, nicht als eigene
   Display-Zeile: der Block soll sich einreihen, nicht danebenstehen. */
.paket-titel {{
  margin: 14px 0 0;
  max-width: 22ch;
  font-size: clamp(1.35rem, 1.1rem + .9vw, 1.7rem);
  font-weight: 600;
  line-height: 1.2;
  letter-spacing: -.028em;
  color: var(--ink, #17161A);
}}
/* Der Erklaersatz unter dem Titel - stand am 2026-09-11 live (Markup und
   Regel), wird darum wieder mit ausgegeben. */
.paket-text {{
  margin: 14px 0 0;
  font-size: .97rem;
  line-height: 1.68;
  color: var(--muted, #6E6A73);
}}

.paket-enthalten-kopf {{
  display: inline-block;
  margin: 30px 0 0;
  font-family: var(--font-mono);
  font-size: .7rem;
  font-weight: 500;
  letter-spacing: .16em;
  text-transform: uppercase;
  color: var(--muted, #6E6A73);
}}
.paket-enthalten {{
  list-style: none;
  margin: 14px 0 0;
  padding: 0;
}}
.paket-enthalten li {{
  display: flex;
  align-items: baseline;
  gap: 16px;
  padding: 11px 0;
  font-size: .99rem;
  line-height: 1.4;
  color: var(--ink, #17161A);
  border-top: 1px solid var(--line, rgba(23, 22, 26, .10));
}}
.paket-enthalten li:first-child {{ border-top: 0; padding-top: 4px; }}
.paket-enthalten li:last-child {{ padding-bottom: 0; }}
.paket-nr {{
  flex: 0 0 auto;
  font-family: var(--font-mono);
  font-size: .78rem;
  font-weight: 500;
  letter-spacing: .04em;
  color: var(--muted, #6E6A73);
  opacity: .6;
}}

/* --- Preiskasten: dieselbe Flaeche wie in den Werkzeug-Aufklappern -------
   Ein Satz, wie oben in der Liste: "X einmalig, dann Y monatlich." Die
   Betraege tragen die Zeile ueber <strong>, nicht ueber Schriftgroesse -
   ein Preis in 3 rem war an dieser Stelle der einzige auf der Seite. */
.paket-preis {{
  margin: 26px 0 0;
  padding: 20px 22px;
  border: 0;
  border-radius: var(--r, 16px);
  background: var(--paper-2, #F5F5F7);
}}
.paket-preis-zeile {{
  margin: 0;
  font-size: 1rem;
  line-height: 1.5;
  color: var(--ink, #17161A);
  font-variant-numeric: tabular-nums;
}}
.paket-preis-zeile strong {{ font-weight: 600; white-space: nowrap; }}
/* Der Vergleich steht klein darunter - kein Siegel, nur die echte Zahl */
.paket-preis-statt {{
  margin: 7px 0 0;
  font-size: .88rem;
  color: var(--muted, #6E6A73);
}}
.paket-preis-statt s {{ text-decoration-thickness: 1px; }}

/* Knopf: dieselbe Stelle und Groesse wie .tool-select, nur gefuellt - das
   Paket ist der Hauptweg, aber es bleibt derselbe Baustein. */
.paket-select {{
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  margin-top: 22px;
  padding: 13px 24px;
  border: 0;
  border-radius: 999px;
  background: var(--accent, #E2552B);
  color: #fff;
  font-family: var(--font);
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: -.01em;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(193, 63, 23, .18), 0 12px 28px rgba(193, 63, 23, .22);
  transition: background-color 300ms var(--ease), transform 200ms var(--ease),
              box-shadow 300ms var(--ease);
}}
.paket-select:hover {{
  background: var(--accent-deep, #C13F17);
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(193, 63, 23, .22), 0 16px 34px rgba(193, 63, 23, .26);
}}
.paket-select:active {{ transform: translateY(0); }}
.paket-select:focus-visible {{ outline: 2px solid var(--accent-deep, #C13F17); outline-offset: 3px; }}
.paket-select.is-selected {{ background: var(--ink, #17161A); box-shadow: none; }}
/* Das Plus wird zum Haken - dieselbe Geometrie wie bei .tool-select, die
   dortigen Regeln greifen hier nicht, weil der Knopf eine eigene Klasse hat. */
.paket-select.is-selected .tool-select-icon::before {{
  top: 8.4px; left: 0.5px; width: 6px; transform: rotate(45deg);
}}
.paket-select.is-selected .tool-select-icon::after {{
  top: 2.4px; left: 7.6px; width: 1.6px; height: 10.5px; transform: rotate(40deg);
}}

/* Die Ersparnis ist ein Verkaufsargument, kein Kleingedrucktes. Block, nicht
   inline-block: sonst legt sie sich neben den Knopf, weil der inline-flex ist. */
.paket-spar {{
  display: block;
  margin: 18px 0 0;
  font-size: .95rem;
  font-weight: 500;
  line-height: 1.5;
  color: var(--accent-deep, #C13F17);
}}

/* Der Block ist schon einspaltig - auf schmalen Schirmen wird nur der
   Innenabstand kleiner, damit die Zeilen nicht in die Kante laufen. */
@media (max-width: 760px) {{
  .paket {{
    padding: 34px 28px 32px;
    border-radius: var(--r-lg, 24px);
  }}
  .paket-preis {{ padding: 17px 18px; }}
}}
@media (max-width: 560px) {{
  .paket {{ padding: 28px 20px 26px; }}
  .paket-titel {{ max-width: none; }}
  .paket-select {{ width: 100%; }}
  .paket-enthalten li {{ gap: 12px; }}
  /* Auf dem Handy laeuft nur die scharfe Bahn - die weichgezeichnete Ebene
     ist genau dort am teuersten, wo am wenigsten Leistung da ist. */
  .paket::after {{ display: none; }}
}}

/* Wer keine Bewegung will, bekommt dasselbe Bild - nur steht es still:
   das Licht sitzt oben rechts im Rahmen. */
@media (prefers-reduced-motion: reduce) {{
  .paket.leuchtet::before,
  .paket.leuchtet::after {{
    animation: none;
    --winkel: 296deg;        /* Licht steht oben rechts, ueber dem Preis */
  }}
  .paket.leuchtet::after {{ opacity: .8; }}
}}

@media (prefers-reduced-motion: reduce) {{
  .tool-item-teaser {{ transition: none; }}
}}
{kombi_css}/* {M}:END */
"""

VIDEO_CSS = """/* --- Video: steht UNTER dem Text - erst lesen, dann sehen ---------------- */
.tool-video { margin: 30px auto 4px; }
.tool-video-rahmen {
  width: 100%;
  max-width: 292px;
  margin: 0 auto;
  aspect-ratio: 9 / 16;
  border-radius: 20px;
  overflow: hidden;
  background: #f5f5f7;
  box-shadow: 0 2px 6px rgba(23, 22, 26, .06), 0 14px 34px rgba(23, 22, 26, .12);
}
.tool-video-rahmen iframe { display: block; width: 100%; height: 100%; border: 0; }
.tool-video-hinweis {
  margin: 10px auto 0;
  max-width: 380px;
  font-size: .82rem;
  line-height: 1.45;
  color: var(--muted, #5b5a61);
}

"""

VIDEO_CSS_MOBIL = """  .tool-video-rahmen { max-width: 240px; }
  .tool-video-hinweis { max-width: 300px; }
"""

KOMBI_CSS = """
/* --- Voraussetzung in der Betriebsbuch-Zeile ----------------------------- */
/* Mono-Zeile unter dem Teaser; bleibt auch im aufgeklappten Zustand stehen,
   waehrend der Teaser wegblendet - die Voraussetzung ist keine Werbezeile. */
.tool-item-tag {
  display: inline-block;
  margin-top: 1px;
  font-family: var(--font-mono);
  font-size: .66rem;
  font-weight: 500;
  letter-spacing: .09em;
  text-transform: uppercase;
  color: var(--accent-deep, #C13F17);
}
.tool-hinweis {
  margin: 16px 0 0;
  padding-left: 14px;
  border-left: 2px solid var(--accent-line, rgba(226, 85, 43, .30));
  font-size: .95rem;
  line-height: 1.6;
  color: var(--body, #3A3740);
}
.tool-hinweis strong { color: var(--ink, #17161A); font-weight: 600; }

/* --- Zeile "Was brauchst du davon?" -------------------------------------- */
/* Drei Bausteine im Aufklapper, jeder mit einem Mono-Kicker wie das
   "Enthalten" im Paket. Text auf Weiss, Farbe nur an Kanten und Kickern. */
.kombi-kicker {
  display: block;
  margin: 34px 0 0;
  font-family: var(--font-mono);
  font-size: .7rem;
  font-weight: 500;
  letter-spacing: .16em;
  text-transform: uppercase;
  color: var(--muted, #6E6A73);
}

/* Einzeln: Name links, Stand rechts, darunter zwei Saetze */
.kombi-einzeln { list-style: none; margin: 10px 0 0; padding: 0; }
.kombi-einzeln li { padding: 16px 0; border-top: 1px solid var(--line, rgba(23,22,26,.10)); }
.kombi-einzeln li:first-child { border-top: 0; padding-top: 6px; }
.kombi-einzeln li:last-child { padding-bottom: 4px; }
.kombi-einzeln-kopf {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.kombi-einzeln-name {
  font-size: 1.04rem;
  font-weight: 600;
  letter-spacing: -.018em;
  color: var(--ink, #17161A);
}
.kombi-stand {
  flex: 0 0 auto;
  font-family: var(--font-mono);
  font-size: .68rem;
  font-weight: 500;
  letter-spacing: .1em;
  text-transform: uppercase;
  color: var(--muted, #6E6A73);
  white-space: nowrap;
}
.kombi-stand.ist-bedingt { color: var(--accent-deep, #C13F17); }
.kombi-einzeln p {
  margin: 10px 0 0;   /* seit 2026-09-12 mehrere Absaetze je Eintrag */
  font-size: .97rem;
  line-height: 1.62;
  color: var(--body, #3A3740);
}
.kombi-einzeln p strong { color: var(--ink, #17161A); font-weight: 600; }

/* Zusammen: ruhige graue Flaeche (wie der Preiskasten), darin zwei Berichte */
.kombi-zusammen {
  margin: 12px 0 0;
  padding: 22px 22px 20px;
  border-radius: var(--r, 16px);
  background: var(--paper-2, #F5F5F7);
}
.kombi-zusammen-titel {
  margin: 0;
  font-size: 1.06rem;
  font-weight: 600;
  line-height: 1.35;
  letter-spacing: -.02em;
  color: var(--ink, #17161A);
}
.kombi-blaetter {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-top: 16px;
}
.kombi-blatt {
  display: flex;
  flex-direction: column;
  padding: 15px 16px 13px;
  border-radius: 12px;
  border: 1px solid var(--line, rgba(23,22,26,.10));
  background: var(--card, #fff);
  box-shadow: var(--shadow-sm);
}
.kombi-blatt--mit { border-color: var(--accent-line, rgba(226,85,43,.30)); }
.kombi-blatt-label {
  display: block;
  font-family: var(--font-mono);
  font-size: .64rem;
  font-weight: 500;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: var(--muted, #6E6A73);
}
.kombi-blatt--mit .kombi-blatt-label { color: var(--accent-deep, #C13F17); }
.kombi-badge {
  align-self: flex-start;
  margin-top: 9px;
  padding: 3px 9px;
  border: 1px solid var(--accent-line, rgba(226,85,43,.30));
  border-radius: 999px;
  font-size: .7rem;
  font-weight: 600;
  color: var(--accent-deep, #C13F17);
}
.kombi-blatt-zeilen { margin: 11px 0 0; }
.kombi-blatt-zeilen > div {
  display: grid;
  grid-template-columns: 60px 1fr;
  gap: 8px;
  padding: 5px 0;
  font-size: .8rem;
  line-height: 1.45;
  border-top: 1px dashed var(--line, rgba(23,22,26,.10));
}
.kombi-blatt-zeilen > div:first-child { border-top: 0; padding-top: 0; }
.kombi-blatt-zeilen dt { color: var(--muted, #6E6A73); }
.kombi-blatt-zeilen dd { margin: 0; color: var(--ink, #17161A); }
.kombi-blatt-fuss {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 10px;
  margin: auto 0 0;
  padding-top: 10px;
  border-top: 1px solid var(--line, rgba(23,22,26,.10));
  font-size: .8rem;
  line-height: 1.4;
  color: var(--muted, #6E6A73);
}
.kombi-blatt-fuss.ist-leer { margin-top: 12px; }
.kombi-blatt-fuss strong {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  color: var(--ink, #17161A);
}
.kombi-zusammen-text {
  margin: 16px 0 0;
  font-size: .95rem;
  line-height: 1.62;
  color: var(--body, #3A3740);
}
.kombi-alle {
  margin: 16px 0 0;
  padding-top: 14px;
  border-top: 1px solid var(--line, rgba(23,22,26,.10));
  font-size: .95rem;
  line-height: 1.62;
  color: var(--body, #3A3740);
}
.kombi-alle strong { color: var(--ink, #17161A); font-weight: 600; }
.kombi-link {
  color: var(--accent-deep, #C13F17);
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
  box-shadow: inset 0 -1px 0 rgba(0, 0, 0, .14);
  transition: box-shadow 200ms var(--ease);
}
.kombi-link:hover { box-shadow: inset 0 -1px 0 currentColor; }

/* Was passt: Frage, darunter die Pfeil-Antwort - ohne Knoepfe */
.kombi-wahl { list-style: none; margin: 10px 0 0; padding: 0; }
.kombi-wahl-zeile {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 15px 0;
  border-top: 1px solid var(--line, rgba(23,22,26,.10));
}
.kombi-wahl-zeile:first-child { border-top: 0; padding-top: 6px; }
.kombi-wahl-frage {
  font-size: .95rem;
  line-height: 1.5;
  color: var(--body, #3A3740);
}
.kombi-wahl-antwort {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 10px;
  font-size: 1.02rem;
  font-weight: 600;
  letter-spacing: -.018em;
  color: var(--ink, #17161A);
}
.kombi-wahl-antwort::before {
  content: "→";
  font-weight: 500;
  color: var(--accent, #E2552B);
}
.kombi-empfehlung {
  order: 2;
  font-family: var(--font-mono);
  font-size: .64rem;
  font-weight: 500;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: var(--accent-deep, #C13F17);
}
@media (max-width: 760px) {
  .kombi-zusammen { padding: 18px 16px 16px; }
}
@media (max-width: 600px) {
  .kombi-blaetter { grid-template-columns: 1fr; }
  .kombi-blatt-fuss.ist-leer { margin-top: 10px; }
  .kombi-einzeln-kopf { flex-wrap: wrap; gap: 4px 12px; }
}
"""

CSS = CSS.format(M=MARK,
                 video_css=VIDEO_CSS if VIDEOS_AN else "",
                 video_css_mobil=VIDEO_CSS_MOBIL if VIDEOS_AN else "",
                 kombi_css=KOMBI_CSS)


# ===========================================================================
# JS
# ===========================================================================

JS = """
/* {M}:START */
{video_js}/* Notnagel: laedt AOS nicht (Adblocker, Skriptfehler, mieses Netz), bleibt
   sonst alles unter dem Hero auf opacity 0 stehen. */
setTimeout(() => {{
  if (!document.querySelector('[data-aos].aos-animate')) {{
    document.documentElement.classList.add('no-js');
  }}
}}, 3000);
/* {M}:END */
"""

# Erklaervideo je Werkzeug, erst beim Aufklappen geladen - haengt an VIDEOS_AN.
VIDEO_JS = """(() => {
  const BASIS = '{basis}';

  /* Capture-Phase: der iframe muss im DOM stehen, BEVOR die Aufklapp-Logik
     die Panel-Hoehe misst - sonst klappt das Panel zu kurz auf. */
  document.addEventListener('click', (e) => {
    const kopf = e.target.closest('.tool-toggle');
    if (!kopf) return;
    const item = kopf.closest('.tool-item');
    const box = item && item.querySelector('.tool-video');
    if (!box || box.dataset.geladen || !box.dataset.kapitel) return;
    const rahmen = box.querySelector('.tool-video-rahmen');
    if (!rahmen) return;

    box.dataset.geladen = '1';
    const f = document.createElement('iframe');
    f.src = BASIS + '?kapitel=' + box.dataset.kapitel;
    f.title = 'Erkl\\u00e4rvideo: ' + (item.querySelector('.tool-item-label')?.textContent.trim() || '');
    f.setAttribute('allow', 'autoplay; fullscreen');
    f.setAttribute('referrerpolicy', 'no-referrer');
    rahmen.appendChild(f);
  }, true);

  /* Beim Zuklappen anhalten - sonst redet im Hintergrund ein Sprecher
     weiter, den keiner mehr sieht. */
  document.addEventListener('click', (e) => {
    const kopf = e.target.closest('.tool-toggle');
    if (!kopf || kopf.getAttribute('aria-expanded') !== 'true') return;
    const item = kopf.closest('.tool-item');
    const f = item && item.querySelector('.tool-video iframe');
    if (f) f.src = f.src;
  });
})();

"""


# ===========================================================================
# Mechanik
# ===========================================================================

def fail(msg):
    print("\n  ABBRUCH: " + msg + "\n  Es wurde nichts veraendert.\n")
    sys.exit(1)


def read(p):
    with open(p, "r", encoding="utf-8") as f:
        return f.read()


def write(p, s):
    with open(p, "w", encoding="utf-8") as f:
        f.write(s)


def strip_blocks(text, *namen):
    for name in namen:
        for pat in (r"[ \t]*<!-- %s:START[^\n]*?-->.*?<!-- %s:END[^\n]*?-->\n?" % (name, name),
                    r"[ \t]*/\* %s:START[^\n]*?\*/.*?/\* %s:END[^\n]*?\*/\n?" % (name, name)):
            text = re.sub(pat, "", text, flags=re.S)
    return text


def undo(root):
    stamps = sorted({os.path.basename(p).split(".bak-")[-1]
                     for p in glob.glob(os.path.join(root, "*.bak-*"))})
    if not stamps:
        fail("Kein Backup gefunden.")
    stamp = stamps[-1]
    for name in FILES:
        bak = os.path.join(root, name + ".bak-" + stamp)
        if os.path.exists(bak):
            shutil.copy2(bak, os.path.join(root, name))
            print("  wiederhergestellt: " + name)
    print("\n  Stand von " + stamp + " ist zurueck.\n")
    sys.exit(0)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    root = os.path.abspath(args[0]) if args else os.getcwd()

    if "--undo" in sys.argv:
        undo(root)

    print("\n  Projekt: " + root)

    for name in FILES:
        if not os.path.exists(os.path.join(root, name)):
            fail(name + " nicht gefunden. Ins Projektverzeichnis wechseln oder Pfad angeben.")

    html = read(os.path.join(root, "index.html"))
    css = read(os.path.join(root, "style.css"))
    js = read(os.path.join(root, "script.js"))

    alte = (MARK, "ND-PREIS-VIDEO", "ND-AUTO-HTML", "ND-AUTO-DATA",
            "ND-AUTO-JS", "ND-AUTO-CSS", "ND-AUTOMATION-LISTE")
    if any(a in html for a in alte):
        print("  Fruehere Fassung gefunden — wird ersetzt.")
    # Eine frueher gebaute Liste zuerst auf den nackten Anker zurueckbauen -
    # sonst nimmt strip_blocks das <ul class="tool-list"> gleich mit und der
    # zweite Lauf findet nichts mehr, woran er sich festhalten koennte.
    for a in alte:
        html, n = re.subn(
            r'[ \t]*<!-- %s:START -->\s*<ul class="tool-list".*?<!-- %s:END -->' % (a, a),
            '      <ul class="tool-list" data-aos="fade-up"></ul>',
            html, count=1, flags=re.S)
        if n:
            break

    html = strip_blocks(html, *alte)
    css = strip_blocks(css, *alte)
    js = strip_blocks(js, *alte)

    bericht = []

    # --- 1. Werkzeug-Liste komplett ersetzen
    ul_start = html.find('<ul class="tool-list"')
    if ul_start == -1:
        fail('<ul class="tool-list"> nicht gefunden.')
    tiefe, pos = 0, ul_start
    while True:
        m = re.compile(r"</?ul\b").search(html, pos)
        if not m:
            fail("Ende der tool-list nicht gefunden.")
        tiefe += 1 if m.group(0) == "<ul" else -1
        pos = m.end()
        if tiefe == 0:
            ul_ende = html.find(">", m.start()) + 1
            break
    rest = html[ul_ende:]
    nm = re.match(r'\s*<p class="tool-list-note".*?</p>', rest, re.S)
    if nm:
        ul_ende += nm.end()
    html = html[:ul_start] + baue_liste() + html[ul_ende:]
    bericht.append("Liste neu gebaut: %d Werkzeuge + Zeile \"%s\", %s"
                   % (len(WERKZEUGE), KOMBI["titel"],
                      ("%d mit Video" % sum(1 for w in WERKZEUGE if w["kapitel"]))
                      if VIDEOS_AN else "Videos aus (VIDEOS_AN = False)"))

    # --- 2. Nummern in die Ablauf-Karten
    z = {"i": 0}

    def nummeriere(m):
        if z["i"] >= len(SCHRITT_NUMMERN):
            return m.group(0)
        n = SCHRITT_NUMMERN[z["i"]]
        z["i"] += 1
        return (m.group(0) + '<!-- %s:START --><span class="process-num" aria-hidden="true">%s</span>'
                '<!-- %s:END -->' % (MARK, n, MARK))

    html = re.sub(r'<div class="process-card-head">', nummeriere, html)
    if z["i"] != 4:
        fail("%d Ablauf-Karten gefunden (erwartet: 4)." % z["i"])
    bericht.append("4 Ablauf-Karten nummeriert")

    # --- 3. no-js
    if "classList.remove('no-js')" not in html:
        if 'class="no-js"' not in html:
            html, n = re.subn(r'<html lang="de">', '<html lang="de" class="no-js">', html, count=1)
            if n != 1:
                fail('<html lang="de"> nicht gefunden.')
        html, n = re.subn(
            r'<head>',
            '<head>\n  <!-- %s:START -->\n'
            '  <script>document.documentElement.classList.remove(\'no-js\');</script>\n'
            '  <!-- %s:END -->' % (MARK, MARK), html, count=1)
        if n != 1:
            fail("<head> nicht gefunden.")
        bericht.append("no-js-Klasse gesetzt (deine CSS-Regel feuert jetzt)")

    # --- 4. autocomplete
    felder = {"firstname": "given-name", "lastname": "family-name",
              "email": "email", "phone": "tel"}
    n_ac = 0
    for feld, wert in felder.items():
        html, n = re.subn(r'(<input[^>]*name="%s"(?![^>]*autocomplete))' % feld,
                          r'\1 autocomplete="%s"' % wert, html, count=1)
        n_ac += n
    if n_ac:
        bericht.append("autocomplete an %d Formularfeldern" % n_ac)

    # --- 5. vier -> fuenf
    html, n = re.subn(r'vier fertige Werkzeuge', 'fünf fertige Werkzeuge', html)
    if n:
        bericht.append("Meta-Description: vier -> fuenf (%dx)" % n)

    # --- 6. Cache-Marker
    v = datetime.datetime.now().strftime("%Y%m%d%H%M")
    html, n_bump = re.subn(
        r'((?:href|src)="(?:style\.css|script\.js))(\?v=[^"]*)?"',
        lambda m: '%s?v=%s"' % (m.group(1), v), html)

    # --- 7. CSS + JS
    # Der Design-Block (ND-DESIGN, Dateiende) korrigiert Regeln, die VOR ihm
    # stehen - darunter den Preiskasten aus diesem Block (grau statt peach).
    # Ans Dateiende gehaengt stuende unser Block hinter ihm und der Preiskasten
    # kaeme peach zurueck. Also vor den Design-Block setzen, wenn es ihn gibt.
    design = "/* ND-DESIGN:START"
    if design in css:
        i = css.index(design)
        css = css[:i].rstrip() + "\n" + CSS + "\n" + css[i:]
    else:
        css = css.rstrip() + "\n" + CSS
    js = js.rstrip() + "\n" + JS.format(
        M=MARK,
        video_js=VIDEO_JS.replace("{basis}", CLIP_BASIS) if VIDEOS_AN else "")

    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    for name in FILES:
        shutil.copy2(os.path.join(root, name), os.path.join(root, name + ".bak-" + stamp))
    print("  Backups: *.bak-" + stamp)

    write(os.path.join(root, "index.html"), html)
    write(os.path.join(root, "style.css"), css)
    write(os.path.join(root, "script.js"), js)

    print("\n  Fertig.\n")
    for b in bericht:
        print("    - " + b)
    print("    - Cache-Marker erneuert (%d)" % n_bump)
    if VIDEOS_AN:
        print("\n  Video: %s?kapitel=...\n"
              "  Ohne patch-clip.py laeuft dort das ganze Video von vorne.\n"
              "  Der Aufruf hat kein ?id=, loest also keine Scan-Mail aus."
              % CLIP_BASIS)
    else:
        print("\n  Videos sind aus. VIDEOS_AN = True setzen und das Skript\n"
              "  noch einmal laufen lassen, dann sind sie wieder drin.")

    print("""
  Alle Texte und Preise stehen oben in WERKZEUGE.

  Rueckgaengig:  python3 patch-neufeld.py --undo
""")


if __name__ == "__main__":
    main()
