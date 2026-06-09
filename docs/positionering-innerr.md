# Positionering: Innerr als dé plek voor ouders

*Werkdocument — juni 2026*

## Waarom het nu te generiek voelt

Innerr heeft de juiste fundering al in huis: de onboarding vraagt om kinderen en geboortedatums (`AddChildren`, `BirthDate`), er zijn privé-circles met kijkrechten (`CirclePermissions`), en een feed zonder publiek of vreemden. Architectonisch is dit een ouder-app.

De *taal* is dat nog niet. De intro belooft "Gather your circles / Share your moments / Stay close" — dat is een rustigere, privé Instagram voor je naasten. Waar of voor wie het precies is, blijft open. Een vriendengroep, een sportclub of een stel zonder kinderen zou exact dezelfde tekst lezen en denken: niet voor mij, of: voor iedereen. Dat is precies het "te generiek"-gevoel.

De oplossing zit dus niet in nieuwe architectuur, maar in het scherp kiezen van één persoon die je bedient en dat overal — copy, onboarding, features, app store — consequent terug laten komen.

## De doelgroep, scherp

Niet "mensen die privé willen delen", maar: **ouders van jonge kinderen (0–7) die de eerste jaren willen vastleggen en delen met familie, zonder die foto's op het publieke internet te zetten.**

De concurrent is niet een andere app — het is de WhatsApp-familiegroep en het openbare Instagram-account. De eerste is rommelig en vluchtig; de tweede voelt onveilig met kindfoto's. Innerr zit daar precies tussenin: net zo makkelijk als de familiegroep, maar geordend rond het kind en gesloten als een afgeschermd album.

## Positioneringsstatement

> **Innerr is het privé-album voor je gezin. Leg de eerste jaren van je kind vast en deel ze alleen met de mensen die ertoe doen — opa en oma, peetouders, naaste vrienden. Geen publiek, geen vreemden, geen advertenties.**

Eén zin die je in de app store, op de website en in de onboarding herhaalt. Alles wat daar niet bij past, schrap je of stop je weg.

## Drie pijlers

### 1. Kindgerichte tijdlijn

Dit is het sterkste onderscheid met élke generieke deel-app en het wordt nu het minst benut. De data is er al (kind + geboortedatum); de beleving ontbreekt nog.

Maak het kind het hart van de app, niet de gebruiker:

- Een aparte tijdlijn per kind, geordend op leeftijd ("6 maanden", "2 jaar en 3 maanden") in plaats van alleen op datum.
- Mijlpalen: eerste stapjes, eerste woordje, eerste schooldag — als markeerbare momenten op de tijdlijn.
- "Vandaag een jaar geleden" — een terugblik-melding die ouders terugbrengt naar de app en die een algemene fotoapp zelden persoonlijk maakt.
- Bij het posten automatisch de leeftijd van het kind tonen op het moment van de foto.

Dit is de feature die maakt dat een ouder zegt: "dit is voor mij gebouwd."

### 2. Privacy en veiligheid als kernbelofte

Voor ouders is dit dé reden om níet Instagram of een open platform te gebruiken. Behandel het daarom als belofte op de voorgrond, niet als instelling diep in een menu.

- Standaard privé: foto's zijn alleen zichtbaar voor genodigde circle-leden, punt.
- Expliciet en zichtbaar maken: geen advertenties, geen openbaar profiel, geen doorverkoop, geen AI-training op de gezichten van kinderen.
- Zet dit op het welkomstscherm en in de app store-omschrijving — niet weggestopt in de privacyverklaring. Dit is een verkoopargument, geen kleine letter.
- Kindgerichte controle: ouder bepaalt per circle wie mag kijken en wie niet mag delen of downloaden (`CirclePermissions` bouwt hierop voort).

### 3. Familie samen

Het delen met familie ver weg is de emotionele kern: opa en oma die de kleinkinderen zien opgroeien.

- Circles afgestemd op familierollen: grootouders met kijkrechten maar geen deel- of downloadrechten; peetouders; naaste vrienden.
- Drempelloze uitnodiging voor minder digitale familieleden — een eenvoudige link, geen verplichte accountdrempel om te kijken (`InviteLanding`, `ShareInviteLinkSection` zijn er al).
- Reacties en hartjes houden het rustig en warm, zonder de prestatiedruk van likes-tellingen in het openbaar.

## Concrete aanpassingen, per scherm

Hieronder de bestaande schermen en hoe de copy verschuift van generiek naar ouder-specifiek.

**Welcome (`Auth/Welcome.vue`)** — Vervang een algemene welkomsttekst door het positioneringsstatement. Bijvoorbeeld: "Het privé-album voor je gezin. Leg de eerste jaren vast en deel ze alleen met je naasten."

**Onboarding intro (`Onboarding/Intro.vue`)** — De drie stappen herschrijven van neutraal naar ouder-gericht:

- "Gather your circles" → "Stel je familiekring samen — opa, oma en wie je vertrouwt. Alleen genodigden zien wat je deelt."
- "Share your moments" → "Deel de foto's en filmpjes van je kind. Geen publieke feed, geen vreemden."
- "Stay close" → "Houd familie ver weg dichtbij. Zij zien je kind opgroeien, rustig en privé."

**Onboarding kind (`AddChildren`, `BirthDate`)** — Dit is nu een formulierstap; maak het een belofte. "Voor wie maak je dit album?" met naam + geboortedatum, en leg meteen uit dat de hele tijdlijn zich daarna rond dat kind vormt.

**Lege schermen en feed (`Feed.vue`, `FeedGrid.vue`)** — Een lege feed is een gemiste eerste indruk. In plaats van "Nog geen berichten": "Voeg de eerste foto van [kindnaam] toe — opa en oma kijken mee."

**App store-omschrijving** — Begin met het statement en de privacybelofte, niet met een featurelijst. De eerste twee zinnen bepalen of een zoekende ouder zich herkent.

## Prioriteiten

Wat het meeste verschil maakt met de minste bouwinspanning, eerst:

1. **Copy herschrijven** (Welcome, Onboarding, lege schermen, app store). Lage inspanning, directe impact op het "voor wie is dit"-gevoel. Begin hier.
2. **Leeftijd op posts en tijdlijn-ordening op leeftijd.** Middelgrote inspanning, gebruikt bestaande data, maakt de kindgerichtheid voelbaar.
3. **Privacybelofte zichtbaar maken** op welkomst- en store-niveau. Lage inspanning, hoog vertrouwen-effect.
4. **"Vandaag een jaar geleden" en mijlpalen.** Grotere inspanning; bouw dit als de eerste drie de positionering hebben bevestigd.

## De ene keuze die telt

Alle drie de pijlers versterken elkaar, maar de tijdlijn-rond-het-kind is wat Innerr écht onderscheidt — privacy en familie-delen kan een concurrent kopiëren, een doordachte kindtijdlijn voelt persoonlijker en is moeilijker na te maken. Als je je energie ergens op concentreert na de copy-herschrijving, is dat het.
