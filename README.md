
# GameLogs V2

Osobisty katalog gier: backlog, aktualnie ogrywane i ukończone tytuły,
oceny, dodawanie gier z własnymi okładkami, dzienniki sesji, jasny/ciemny
motyw i losowanie gry z biblioteki. Eksport/import przenosi także własne okładki.

**Pełny poradnik publikacji i podmiany starej strony: [PUBLIKACJA.md](PUBLIKACJA.md).**

**Konta, prywatny zapis w Supabase i konfiguracja e-mail: [KONTA.md](KONTA.md).**

## Dwa oddzielne projekty

- `../Anveth.github.io` — lokalne archiwum starego sklepu, przywrócone z commita `87a88a8`.
- `gamelogsV2` — aktualnie rozwijana aplikacja. Ten folder ma historię Git
  oraz `origin` ustawiony na `https://github.com/Anveth/Anveth.github.io`.

Nazwa folderu na komputerze może być inna niż nazwa repozytorium GitHub.
Docelowy adres nowej wersji to **https://anveth.github.io/**.

## Uruchamianie w VS Code

Wybierz **File → Open Folder…** i otwórz folder `gamelogsV2`.
Potem **Terminal → New Terminal** i wpisz:

```sh
npm run dev
```

Otwórz **http://localhost:5173**. Zapisuj zmiany w VS Code (`Cmd+S`)
i odświeżaj przeglądarkę (`Cmd+R`). Serwer wyłączysz przez `Ctrl+C`
w jego terminalu. Możesz też wybrać **Terminal → Run Task… →
GameLogs V2: uruchom podgląd**.

Jeśli serwer już działa, kolejne `npm run dev` wyświetli działający adres.
Nie zmieniamy automatycznie portu, aby zachować jeden magazyn danych.

Wymagany jest Node.js 20.9 lub nowszy (zalecany aktualny LTS). Podgląd nie wymaga `npm install`.
`npm run check` sprawdza składnię JavaScript. Testy bazy wymagają jednorazowego
`npm ci`, a następnie `npm test` (PostgreSQL w pamięci, bez zmian w produkcji).

Na macOS możesz otworzyć projekt z terminala:

```sh
cd /Users/pawelszabunio/Desktop/Code/Front-end/Projects/GameLogs/gamelogsV2
code .
npm run dev
```

## Gdzie edytować

- `index.html` — biblioteka, formularz i sekcje strony głównej.
- `pick-a-game/index.html` — ekran losowania pod `/pick-a-game/`.
- `dice.html` — zgodność ze starymi linkami: przekierowanie do `/pick-a-game/`.
- `routes.js` — porządkowanie adresów z zachowaniem parametrów i fragmentów.
- `cover-loader.js` — pobranie i dekodowanie okładki przed pokazaniem wyniku losowania.
- `style.css` — cały wygląd i responsywność; bez kompilatora Sass.
- `script.js` — interfejs katalogu, dzienniki, filtry, oceny, eksport/import i losowanie.
- `games.js` — początkowa kolekcja gier.
- `storage.js` — zapis danych i okładek, odczyt oraz migracja starszej kolekcji.
- `gallery.js` — slider: strzałki, przeciąganie, pasek oraz klawiatura.
- `image-assets.js` — wygenerowana mapa lżejszych grafik, również dla starszych zapisów biblioteki.
- `scripts/optimize-images.mjs` — konwersja oryginalnych grafik na WebP i warianty responsywne.
- `account.js`, `cloud.js`, `config.js` — konta i połączenie z Supabase.
- `supabase/schema.sql` — tabele, atomowy zapis, RLS i prywatne okładki.
- `images/` — okładki oraz kadry z gier.
- `scripts/dev.mjs` — lokalny serwer podglądu (nie jest backendem aplikacji).

### Adresy bez `.html`

Strona główna używa `/`, sekcje `/#library` i `/#journal`, a losowanie
`/pick-a-game/`. Link do dziennika wybranej gry ma postać `/?game=ID`.
Plik `pick-a-game/index.html` działa również po bezpośrednim wejściu
i odświeżeniu na GitHub Pages — nie wymaga routingu SPA ani backendu.
Stary `/dice.html` przekierowuje, a `/index.html` porządkuje się do `/`
bez gubienia parametrów i fragmentów (także powrotów z logowania).
Adresy e-mail Supabase nadal wracają do dotychczasowego `/index.html`;
nie trzeba zmieniać listy dozwolonych adresów opisanej w KONTA.md.
Po zmianie `scripts/dev.mjs` uruchom serwer ponownie przez `npm run dev`.

Statusy i oceny początkowych gier to przykładowe dane. Dzienniki są początkowo
puste; kliknij okładkę lub tytuł gry, aby dodać sesję. Przycisk Edytuj grę
pozwala zmienić tytuł, status, ocenę i okładkę bez utraty notatek.
Po zalogowaniu biblioteka konta zapisuje się w Supabase. Nowe konto jest puste;
lokalną kolekcję przenosisz jawnie przyciskiem w panelu **Moje konto**.
Przed testem kont ustaw adresy powrotu i zapoznaj się z ograniczeniem SMTP w KONTA.md.

W trybie bez konta dane zapisują się w `localStorage`, a wgrane okładki w `IndexedDB`
konkretnej przeglądarki i adresu. JPG, PNG i WebP do 10 MB są pomniejszane
do maksymalnie 800 px i zapisywane jako WebP (cel 128 KB, twardy limit
256 KB po kompresji; maks. 40 megapikseli na wejściu). W trybie lokalnym nie trafiają
na serwer; po zalogowaniu są w prywatnym magazynie Supabase.
Używaj konsekwentnie `http://localhost:5173`; inny port, `127.0.0.1`
lub adres publiczny oznaczają osobny magazyn danych. Wyczyszczenie danych
witryny usuwa zapisaną bibliotekę. Pliki HTML/CSS/JS nie zawierają Twoich
lokalnych wpisów i wysłanie projektu na GitHub ich nie przeniesie.
Użyj Eksportuj, a na nowym adresie Importuj, aby przenieść kolekcję,
okładki i wpisy. Przed zastąpieniem biblioteki importem wyeksportuj obecną.

Okładka Cyberpunk 2077 pochodzi z [zasobów Steam](https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1091500/library_600x900_2x.jpg).

## Lżejsze grafiki i większa galeria

Bez logowania pusta lokalna biblioteka pokazuje 15 domyślnych gier. To widok demo,
nie dane automatycznie zapisywane lub przenoszone na konto. Dopiero nowa biblioteka
konta zaczyna się pusta, z kafelkiem „Add your first game”. Zapisane wcześniej gry
i wpisy pozostają bez zmian. Player journal pokazuje cztery wpisy w dwóch kolumnach;
„Show more” odsłania kolejne (na telefonie jedna kolumna).
Dolne przyciski Add a game / Pick from Want to play pojawiają się od 16 gier
w aktualnie wyświetlanej liście; górne są dostępne zawsze.

Bez logowania galeria pokazuje dotychczasowe 18 zoptymalizowanych zdjęć demonstracyjnych.
Nie ma w niej przycisków dodawania, usuwania ani Refresh. Po zalogowaniu galeria jest
osobista: dwa puste miejsca „Add your favourite screenshots”, przycisk Add screenshot,
podpis do 100 znaków i osobny kosz przy każdym własnym zdjęciu (z potwierdzeniem).
Przykładowe zdjęcia nie są kopiowane na konto. JPG/PNG/WebP do 10 MB i 40 megapikseli
są konwertowane w przeglądarce do WebP, do 1920 px i 1 MB. Interfejs pozwala dodać
do 100 zdjęć; limit rozmiaru pojedynczego pliku obowiązuje także w Supabase Storage.
Zdjęcia konta są przechowywane w prywatnym bucket `game-screenshots`,
a podpisy w tabeli `gamelogs_screenshots`. Adresy zdjęć odnawiają się automatycznie.
W nowym projekcie Supabase uruchom także `supabase/gallery.sql`.
Zdjęcia zapisane lokalnie w poprzedniej wersji pozostają w IndexedDB, lecz widok gościa
ich teraz nie wyświetla i nie przenosi automatycznie na konto. Export/Import biblioteki
nadal obejmuje gry, okładki i wpisy — nie jest kopią zapasową osobnej galerii.
Usunięcie gry nie usuwa screenshotów. Oryginalne demo plików w images/ pozostaje w repo.

Na komputerze galeria pokazuje dwa kadry 16:9, na telefonie jeden pełnej
szerokości obszaru treści. Kliknięcie otwiera powiększenie na stronie; działają strzałki,
klawiatura, Esc oraz kliknięcie poza oknem. Zdjęcie w powiększeniu nie jest
przycinane. Dodawanie i wyświetlanie prywatnej galerii wymaga JavaScript.

33 archiwalne grafiki demonstracyjne (15 okładek i 18 kadrów) mają zoptymalizowane wersje
w `images/optimized/`. Oryginały i starsze wygenerowane pliki są zachowane.
Okładki mają warianty do 96, 320, 480 i 640 px: małe miniatury dziennika nie
pobierają pliku przeznaczonego do dużej okładki. Stare zapisane ścieżki (także
adresy bezwzględne z tej samej domeny) są rozpoznawane; zewnętrzne adresy pozostają bez zmian.
Galeria ma podglądy do 640 i 1280 px; większa wersja do 1920 px jest pobierana
dopiero po otwarciu zdjęcia. Mniejsze oryginały nie są powiększane. `srcset` dobiera
plik do ekranu, `loading="lazy"` odracza pobieranie galerii poniżej ekranu.
Pierwsze pięć okładek ma `loading="eager"` i wysoki priorytet; obrazy mają zarezerwowane proporcje,
żeby ograniczyć skakanie układu. Prywatne screenshoty nadal zachowują większą jakość
(1920 px, do 1 MB). Istniejących plików użytkownika nie nadpisujemy automatycznie;
ostrzejszy limit okładek obowiązuje nowe i ponownie wgrane okładki.
Przy losowaniu pobieranie okładki zaczyna się podczas obrotu (nadal 550 ms).
Wynik pojawia się po przygotowaniu obrazu; przy wolnym połączeniu prawa część
pozostaje chwilę pusta. Po 2,5 s lub błędzie obrazu pojawia się stabilna okładka
zastępcza, żeby niedostępny obraz nie blokował losowania.

Po zmianie oryginałów uruchom:

```sh
npm ci
npm run images:optimize
npm run check
npm test
```

Generator odczytuje źródła okładek z `games.js`, a galerii z `data-original`
w HTML. Aktualizuje warianty WebP, mapę `image-assets.js` i atrybuty obrazków
w galerii. Wygenerowane pliki trzeba dodać do commita razem z kodem.
Stare zapisane lokalnie i na koncie odwołania do wbudowanych okładek są
przekierowane na lżejsze pliki przy odczycie, bez usuwania notatek czy ocen.
The Walking Dead usunięto z domyślnej kolekcji. Z wcześniejszej lokalnej kopii
znika tylko niezmieniony kafelek demonstracyjny bez wpisów; własne wpisy,
zmienione metadane i biblioteki kont nie są automatycznie usuwane.

## GitHub — połączenie jest już ustawione

Uruchamiaj polecenia w folderze `gamelogsV2`:

```sh
git remote -v
git status
```

`origin` powinien wskazywać na `https://github.com/Anveth/Anveth.github.io`.
Nie twórz repozytorium `gamelogsV2` na GitHubie — korzystamy z istniejącego,
żeby zachować dotychczasowy adres strony. Nie trzeba wykonywać `git init`.

## Publikacja — dopiero gdy chcesz zastąpić obecną stronę

Najpierw obejrzyj różnice w Source Control w VS Code lub przez `git diff`.
W terminalu projektu:

```sh
git add README.md PUBLIKACJA.md KONTA.md index.html dice.html style.css script.js games.js storage.js gallery.js image-assets.js account.js cloud.js config.js package.json package-lock.json scripts images/optimized tests supabase
git diff --cached --stat
git commit -m "Improve gallery and optimize images"
git pull --rebase origin main
git push origin main
```

Jeśli `pull --rebase` zgłosi konflikt, rozwiąż go przed `push`; nie używaj
`--force`. Przy pierwszym wysyłaniu GitHub może poprosić o zalogowanie.
VS Code oferuje logowanie do GitHub przy **Source Control → Sync Changes**.

Na GitHubie: repozytorium **Anveth/Anveth.github.io → Settings → Pages**.
Dla tej statycznej wersji ustaw **Deploy from a branch → main → /(root)**.
Jeżeli takie ustawienia są już aktywne, pozostaw je. Po `push` sprawdź
postęp publikacji w zakładce **Actions**. Nowa wersja zastąpi stronę pod
**https://anveth.github.io/**; stare pliki pozostaną lokalnie w osobnym
folderze oraz w historii repozytorium.

Nie wykonano automatycznej publikacji podczas wydzielania projektu.

Źródło: [Konfiguracja publikacji GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
