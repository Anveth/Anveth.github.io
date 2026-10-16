
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

Wymagany jest Node.js 18 lub nowszy. Podgląd nie wymaga `npm install`.
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
- `dice.html` — ekran losowania.
- `style.css` — cały wygląd i responsywność; bez kompilatora Sass.
- `script.js` — interfejs katalogu, dzienniki, filtry, oceny, eksport/import i losowanie.
- `games.js` — początkowa kolekcja gier.
- `storage.js` — zapis danych i okładek, odczyt oraz migracja starszej kolekcji.
- `gallery.js` — slider: strzałki, przeciąganie, pasek oraz klawiatura.
- `account.js`, `cloud.js`, `config.js` — konta i połączenie z Supabase.
- `supabase/schema.sql` — tabele, atomowy zapis, RLS i prywatne okładki.
- `images/` — okładki oraz kadry z gier.
- `scripts/dev.mjs` — lokalny serwer podglądu (nie jest backendem aplikacji).

Statusy i oceny początkowych gier to przykładowe dane. Dzienniki są początkowo
puste; kliknij okładkę lub Dziennik, aby dodać sesję. Przycisk Edytuj grę
pozwala zmienić tytuł, status, ocenę i okładkę bez utraty notatek.
Po zalogowaniu biblioteka konta zapisuje się w Supabase. Nowe konto jest puste;
lokalną kolekcję przenosisz jawnie przyciskiem w panelu **Moje konto**.
Przed testem kont ustaw adresy powrotu i zapoznaj się z ograniczeniem SMTP w KONTA.md.

W trybie bez konta dane zapisują się w `localStorage`, a wgrane okładki w `IndexedDB`
konkretnej przeglądarki i adresu. JPG, PNG i WebP do 10 MB są pomniejszane
do maksymalnie 1200 px i zapisywane jako WebP. W trybie lokalnym nie trafiają
na serwer; po zalogowaniu są w prywatnym magazynie Supabase.
Używaj konsekwentnie `http://localhost:5173`; inny port, `127.0.0.1`
lub adres publiczny oznaczają osobny magazyn danych. Wyczyszczenie danych
witryny usuwa zapisaną bibliotekę. Pliki HTML/CSS/JS nie zawierają Twoich
lokalnych wpisów i wysłanie projektu na GitHub ich nie przeniesie.
Użyj Eksportuj, a na nowym adresie Importuj, aby przenieść kolekcję,
okładki i wpisy. Przed zastąpieniem biblioteki importem wyeksportuj obecną.

Okładka Cyberpunk 2077 pochodzi z [zasobów Steam](https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1091500/library_600x900_2x.jpg).

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
git add README.md PUBLIKACJA.md index.html dice.html style.css script.js games.js storage.js package.json package-lock.json .gitignore .nojekyll .vscode/tasks.json scripts/dev.mjs images/cyberpunk-cover.jpg
git add -u -- style.scss style.css.map
git commit -m "Replace game store with GameLogs V2 library"
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
