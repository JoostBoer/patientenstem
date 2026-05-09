# Bijdragen aan Patiëntenstem

Fijn dat je wilt meedenken. Een paar dingen om te weten voor je begint.

## Waar dit project leeft

Patiëntenstem draait op één centrale plek: **[ourpatientvoice.org](https://ourpatientvoice.org/)**. Daar delen patiënten hun verhalen, daar landen jouw bijdragen na een merge.

[@JoostBoer](https://github.com/JoostBoer) onderhoudt de repo en reviewt elke pull request. Geen losse forks die hun eigen kant op gaan — één gedeelde plek voor patiëntenstemmen, zodat verhalen vindbaar blijven en de moderatie consistent is.

## Het doel

Patiëntenstem is gemaakt om de stem van patiënten in de psychiatrie hoorbaar te maken - niet om persoonlijke wraakacties te faciliteren, niet om de zorg in z'n geheel slecht te maken, en niet om een commercieel reviewplatform te worden.

Bij elke beslissing - code, design, copy, moderatiebeleid - is de vraag: helpt dit patiënten zich gehoord te voelen, op een manier die ook voor behandelaars te ontvangen is?

## Wat je kunt doen

### Een instelling toevoegen

Edit `seeds/instellingen.json`. Voeg een regel toe en stuur een PR. Houd de beschrijving feitelijk (locatie, type) en gebruik geen waardeoordelen. Na merge verschijnt de instelling op [ourpatientvoice.org](https://ourpatientvoice.org/).

### Een bug melden

Open een issue. Vertel:
- Wat je probeerde te doen
- Wat er gebeurde
- Wat je verwachtte

### Een feature voorstellen

Open een issue voor je begint te bouwen - niet alle ideeën passen bij de scope, en het is jammer als je voor niets bouwt.

### Code-bijdragen

- Houd het simpel. Express + EJS + SQLite is bewust gekozen om de drempel laag te houden.
- Voeg geen build-stap toe (geen webpack, geen TypeScript, geen React).
- Voeg geen tracking, analytics of externe scripts toe.
- Geen externe afhankelijkheden bij runtime behalve wat al in `package.json` staat - vraag eerst.

### Design / copy

- Toon: rustig, eerlijk, warm. Geen marketing-taal.
- Geen scrolling/marquee/animaties die afleiden.
- Mobile-first.
- Schrijf zoals je tegen iemand zou praten die het zwaar heeft gehad.

## Moderatie

Verhalen worden niet pre-modereerd. Verhalen kunnen achteraf weggehaald worden bij:
- Persoonlijke beschadiging (scheldpartijen tegen iemand met naam)
- Aantoonbaar onjuiste feiten
- Verhalen die door de betrokken patiënt zelf weer weggehaald willen worden

Als je wilt helpen met moderatie: open een issue.

## Code of Conduct

Zie [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Vragen?

Open een issue.
