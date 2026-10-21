# GameLogs

Osobista biblioteka gier, dziennik sesji, prywatna galeria screenshotów i losowanie kolejnej gry.
Frontend: **React + TypeScript + Vite**, dotychczasowy CSS bez Tailwinda. Konta, baza i prywatne pliki: Supabase.

Migracja jest na gałęzi `codex/react-typescript-migration`. Nie została opublikowana.
Kontrola typów i build nie zastępują sprawdzenia działania — lista odbiorowa jest w [MIGRATION.md](MIGRATION.md).

## Uruchamianie

W terminalu folderu `gamelogsV2`, z Node.js 24 LTS:

```sh
npm ci
npm run dev
```

Otwórz **http://localhost:5173/** w Chrome. Vite automatycznie odświeża zmienione komponenty.
Zatrzymanie: `Ctrl+C`. Port nie zmienia się automatycznie. `127.0.0.1`, inny port i publiczna domena
mają osobne dane przeglądarki — konsekwentnie używaj `localhost:5173`.
Stary serwer sprzed migracji trzeba zatrzymać przed uruchomieniem Vite.

```sh
npm run check    # ścisła kontrola TypeScript
npm run build    # kontrola typów + produkcyjne pliki w dist/
npm run preview  # lokalny podgląd gotowego dist/ na porcie 4173
npm run format  # formatowanie nowego kodu
```

`npm test` uruchamia nowe testy usług TypeScript i istniejące izolowane testy SQL w PGlite.
Nie łączy się z produkcyjną bazą. Testy UI/kont wymagają osobnej weryfikacji w przeglądarce.
`npm run test:legacy` to archiwalne testy poprzedniej implementacji — nie są kryterium odbioru Reacta.

## Kod

- `src/main.tsx`, `src/App.tsx` — wejście aplikacji, nawigacja, motyw i obsługa błędów.
- `src/components/` — biblioteka, formularze, dziennik, galeria, konto i kostka.
- `src/state/library.ts` — stan biblioteki, zapisy oraz rozdzielenie danych konta i gościa.
- `src/services/` — walidacja, localStorage/IndexedDB, import/eksport, Supabase i obrazy.
- `src/types.ts` — wspólne typy danych.
- `style.css` — dotychczasowy wygląd i responsywność.
- `games.js`, `image-assets.js`, `gallery-demo.js` — zachowane dane demonstracyjne i mapa grafik.
- `config.js` — dotychczasowa publiczna konfiguracja Supabase; opcjonalnie zmienne `VITE_*` z `.env.example`.
- `supabase/` — istniejący SQL, RLS i prywatne magazyny. Migracja frontendu ich nie zmienia.
- `scripts/` — Vite, przygotowanie publikowanych zasobów i optymalizacja obrazów.
- `.github/workflows/deploy.yml` — kompilacja i publikacja **wyłącznie gałęzi main**.

Stare pliki `script.js`, `storage.js`, `cloud.js`, `account.js`, `gallery.js`, `personal-gallery.js`,
`screenshots.js` i `cover-loader.js` pozostają do porównania podczas odbioru. Nie sterują nowym interfejsem
i nie są kopiowane do `dist/`. `routes.js` obsługuje jeszcze stare przekierowanie `dice.html`.

## Dane i zachowane funkcje

Bez logowania pusta lokalna biblioteka pokazuje **15 demonstracyjnych gier**, a galeria **18 zdjęć**.
Demo nie jest automatycznie zapisywane ani przenoszone na konto. Nowe konto zaczyna się puste:
„Add your first game” i dwa miejsca „Add your favourite screenshots”.

Zachowane są `gamelogs:library`, baza IndexedDB `gamelogs-media`, motyw, format kopii JSON `version: 1`
i domyślna sesja Supabase. Migracja nie czyści pamięci i nie uruchamia SQL. Bibliotekę lokalną przenosi się
na konto tylko jawnym przyciskiem w panelu konta; duplikaty identyfikatorów są pomijane.

Gry mają jeden rating niezależny od statusu, rok bez oznaczenia platformy, edycję i usuwanie z potwierdzeniem.
Dziennik pokazuje cztery wpisy z opcją „Show more”. Dolne przyciski biblioteki pojawiają się od 16 widocznych gier.
Galeria konta obsługuje dodawanie i usuwanie pojedynczych zdjęć, bez przycisku Refresh.
Eksport/import obejmuje gry, wpisy i okładki — **nie osobną galerię screenshotów**.

## Grafiki

W bibliotece, szczegółach i przy losowaniu wbudowane okładki używają oryginałów z `images/`,
bez dodatkowej stratnej kompresji — priorytetem jest jakość. Pierwsze pięć ładuje się od razu,
pozostałe później. Miniatury dziennika mają 56 px szerokości. Własne i wbudowane okładki są do nich
pomniejszane z wygładzaniem pod gęstość ekranu, do tymczasowego, bezstratnego PNG w przeglądarce.
Nie nadpisuje to plików okładek. Zewnętrzne adresy bez dostępu CORS pozostają wyświetlane bezpośrednio.
Mapowanie rozpoznaje także wcześniej zapisane zoptymalizowane ścieżki, bez zmieniania danych gier.
Prywatne okładki pobierane są w pobliżu widocznego obszaru; przywrócenie oryginałów dotyczy
wbudowanych grafik, nie odzyskuje jakości wcześniej skompresowanych prywatnych plików.
Galeria demo używa podglądów do 1280 px, pełnych obrazów do 1920 px dopiero po otwarciu.

Nowe pliki JPG/PNG/WebP do 10 MB i 40 megapikseli są kompresowane w przeglądarce:

- okładki: do 800 px, cel 128 KB, twardy limit 256 KB;
- screenshoty: do 1920 px, cel 650 KB, twardy limit 1 MB, do 100 zdjęć w interfejsie.

Adresy zewnętrznych obrazów nie są kompresowane. Istniejące prywatne pliki nie są masowo nadpisywane.
Kostka zachowuje animację 550 ms, przygotowuje wybraną okładkę przed wynikiem i po maksymalnie 2,5 s
używa stabilnego zamiennika, jeśli obraz nie jest gotowy.

Po zmianie grafik źródłowych można uruchomić `npm run images:optimize`.
Generator czyta źródła z `games.js` oraz istniejącego manifestu galerii `image-assets.js`, aktualizując WebP i mapę.
Nie uruchamiaj go tylko z powodu migracji Reacta — obecne zasoby są już przygotowane.

## Adresy i publikacja

Zostają `/`, `/#library`, `/#journal`, `/?game=ID` i `/pick-a-game/`. Galeria ma skrót `/#gallery` w menu.
Stare `.html` przekierowują lub porządkują się bez utraty parametrów i fragmentów.
E-maile Supabase nadal wracają do `/index.html`; istniejąca lista dozwolonych adresów pozostaje aktualna.

Publiczna strona: [anveth.github.io](https://anveth.github.io/).
Repozytorium pozostaje `Anveth/Anveth.github.io`, niezależnie od lokalnej nazwy folderu.
Nie zmieniaj ustawień publikacji przed odbiorem migracji.

- [Publikacja wersji React](PUBLIKACJA.md)
- [Odbiór migracji i zgodność danych](MIGRATION.md)
- [Konta i konfiguracja Supabase](KONTA.md)

Okładka Cyberpunk 2077 pochodzi z [zasobów Steam](https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1091500/library_600x900_2x.jpg).
