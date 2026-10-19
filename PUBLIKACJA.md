# GameLogs V2 — od lokalnego podglądu do zastąpienia starej strony

**Aktualizacja: dodano konta Supabase. Przed publikacją kont wykonaj kroki
z [KONTA.md](KONTA.md), w szczególności URL Configuration i test rejestracji.
Znajdziesz tam aktualną listę plików do `git add`, obejmującą konta i galerię.**

## Co jest czym

Na komputerze masz dwa oddzielne foldery:

```text
GameLogs/
  Anveth.github.io/   stara strona, lokalna kopia
  gamelogsV2/        nowa aplikacja i repozytorium Git
```

Repozytorium nowej aplikacji to nadal **Anveth/Anveth.github.io**.
Lokalny folder może się nazywać `gamelogsV2`. Zachowanie nazwy repozytorium
`Anveth.github.io` pozwala zachować adres **https://anveth.github.io/**.

GitHub Pages hostuje pliki strony. Nie uruchamia `npm run dev` ani backendu.
Serwer Node z `scripts/dev.mjs` jest wyłącznie lokalnym narzędziem podglądu.
Obecna aplikacja działa w przeglądarce również po publikacji jako pliki statyczne.

## 1. Uruchom lokalną wersję w VS Code

W VS Code wybierz **File → Open Folder… → gamelogsV2**, a następnie
**Terminal → New Terminal**. Na Macu możesz też wpisać w terminalu:

```sh
cd /Users/pawelszabunio/Desktop/Code/Front-end/Projects/GameLogs/gamelogsV2
npm run dev
```

Wejdź na **http://localhost:5173**. Zapisuj pliki przez `Cmd+S`,
odświeżaj przez `Cmd+R`; serwer zatrzymasz przez `Ctrl+C` w jego terminalu.
Sam podgląd nie wymaga `npm install`. Do testów bazy użyj `npm ci` i `npm test`.

Jeśli widzisz **„GameLogs V2 już działa”**, to dobra wiadomość: jeden podgląd
jest już uruchomiony. Otwórz wskazany adres, zamiast uruchamiać drugi proces.
Jeśli komunikat mówi o **innym lub starszym serwerze**, zatrzymaj wcześniejszy
podgląd przez `Ctrl+C` w jego terminalu i ponów `npm run dev`.
Nie przełączamy automatycznie portu: inny port oznacza inny zapis biblioteki.

## 2. Sprawdź aplikację przed publikacją

1. **Dodaj grę**: wpisz nazwę, wybierz status, platformę i opcjonalnie ocenę.
2. Wybierz okładkę z dysku (JPG, PNG, WebP do 10 MB) albo podaj adres obrazka.
3. Zapisz. Nowy tytuł pojawi się w bibliotece razem z pozostałymi grami.
4. Kliknij okładkę lub **Dziennik**. Dodaj sesję z datą, treścią i opcjonalnym czasem.
5. W **Edytuj grę i okładkę** poprawisz tytuł, okładkę, status i ocenę.
6. Odśwież stronę. Gra, okładka i wpis powinny pozostać.
7. Sprawdź filtry, losowanie, jasny motyw oraz telefon.

Przy porównywaniu monitorów ustaw zoom przeglądarki na **100%** (`Cmd+0`).
Układ rośnie powyżej szerokości Full HD w pikselach CSS: przy 1920 px ma
1120 px szerokości treści, przy 2560 px — 1440 px. Dochodzą większe karty
i tekst. Skalowanie systemu macOS może sprawić, że panel 2560×1440 ma
mniejszą dostępną szerokość CSS; sam model monitora nie określa breakpointu.

W terminalu uruchom:

```sh
npm run check
```

Polecenie sprawdza składnię. Zachowanie aplikacji sprawdzaj też w przeglądarce.

## 3. Zrób kopię własnej biblioteki

Na lokalnej stronie kliknij **Eksportuj** obok liczby gier. Pobierzesz
`gamelogs-RRRR-MM-DD.json`: gry, oceny, statusy, sesje oraz wgrane okładki.
Zachowaj ten plik poza repozytorium, np. w Dokumentach.

Git wysyła kod i grafiki zawarte w projekcie. Nie wysyła wpisów z pamięci
przeglądarki. Wgrane przez formularz okładki są w IndexedDB, a dane gier
i dzienniki w localStorage. Wszystko jest przypisane do konkretnego adresu
i przeglądarki. `localhost:5173` i `anveth.github.io` mają osobne magazyny.

Kopia starego sklepu jest w `../Anveth.github.io`, a jego historia jest
też zachowana w Git. Nie trzeba usuwać starej strony ręcznie na GitHubie.

## 4. Sprawdź repozytorium

W terminalu **gamelogsV2**:

```sh
git branch --show-current
git remote -v
git status
git diff --stat
```

Oczekujesz gałęzi `main` i adresu `https://github.com/Anveth/Anveth.github.io`
przy `origin`. To połączenie jest już ustawione. Nie wykonuj `git init`
i nie zakładaj kolejnego repozytorium `gamelogsV2` na GitHubie.

Jeżeli `origin` rzeczywiście wskazuje inne repozytorium, dopiero wtedy:

```sh
git remote set-url origin https://github.com/Anveth/Anveth.github.io.git
```

## 5. Przygotuj lokalny commit

W VS Code otwórz **Source Control** (`Ctrl+Shift+G`) i klikaj zmienione pliki,
żeby obejrzeć różnice. W terminalu dodaj konkretne pliki aplikacji:

```sh
git add README.md PUBLIKACJA.md KONTA.md index.html dice.html pick-a-game routes.js cover-loader.js style.css script.js games.js storage.js gallery.js image-assets.js account.js cloud.js config.js package.json package-lock.json scripts images/optimized tests supabase
git diff --cached --stat
git commit -m "Improve gallery and optimize images"
```

Lista obejmuje kod kont, galerii i wygenerowane pliki WebP. Stary projekt
pozostaje w swoim osobnym folderze. Nie dodawaj plików `.DS_Store` ani sekretów.
Commit zapisuje zmiany lokalnie — sam jeszcze nie publikuje strony.

## 6. Pobierz aktualny stan GitHuba i wyślij nową wersję

```sh
git pull --rebase origin main
```

Jeśli zobaczysz `Already up to date`, możesz przejść dalej. Jeśli Git zgłosi
konflikt, rozwiąż go w edytorze, wykonaj `git add` dla rozwiązanych plików
i `git rebase --continue`. W razie wątpliwości zatrzymaj się na komunikacie
konfliktu i pokaż go do wyjaśnienia. Nie używaj `git push --force`.
Jeśli Git blokuje pull przez niezwiązane lokalne zmiany, np. `.DS_Store`,
schowaj tylko te konkretne zmiany: `git stash push -m "local Finder metadata" -- .DS_Store`.

Teraz **publikujący krok**:

```sh
git push origin main
```

Przy skonfigurowanym Pages to polecenie uruchamia podmianę publicznej strony.
Lokalna kopia starego sklepu nie jest wysyłana. Przy logowaniu HTTPS użyj
logowania GitHub w VS Code lub menedżera poświadczeń; zwykłe hasło konta
nie zastępuje tokenu w uwierzytelnianiu Git. Nie wklejaj tokenów do plików projektu.

## 7. Sprawdź ustawienia GitHub Pages

1. Otwórz [repozytorium Anveth/Anveth.github.io](https://github.com/Anveth/Anveth.github.io).
2. Wybierz **Settings → Pages** (menu po lewej).
3. W **Build and deployment → Source** wybierz **Deploy from a branch**.
4. W **Branch** wybierz **main**, a obok **/(root)**.
5. Kliknij **Save**. Jeżeli tak już jest ustawione, nie musisz nic zmieniać.
6. Przejdź do zakładki **Actions** i otwórz najnowszy przebieg **pages build and deployment**.
7. Zaczekaj, aż zakończy się powodzeniem. Kliknij link do wdrożonej strony.

`index.html`, `dice.html`, `routes.js`, `cover-loader.js`, `style.css`, `script.js`, `games.js`, `storage.js`
i katalogi `pick-a-game/` oraz `images/` muszą być bezpośrednio w głównym katalogu repozytorium.
Losowanie znajduje się w `pick-a-game/index.html`, czyli pod adresem `/pick-a-game/`.
`dice.html` zachowuje przekierowanie dla starych linków.
Nie przesyłaj folderu `gamelogsV2` jako dodatkowego katalogu wewnątrz repo.

Źródło ustawień: [oficjalna dokumentacja GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## 8. Otwórz nową stronę i przenieś swoją kolekcję

1. Wejdź na **https://anveth.github.io/**.
2. Jeśli widzisz stary sklep, odśwież z pominięciem cache: `Cmd+Shift+R`.
3. Kliknij **Importuj** i wybierz kopię JSON z kroku 3.
4. Sprawdź liczbę gier i wpisów, po czym kliknij **Przywróć bibliotekę**.
5. Sprawdź nową grę, jej własną okładkę, dziennik oraz wynik losowania.

Import zastępuje bibliotekę w tej konkretnej przeglądarce. W razie posiadania
innych wpisów na publicznym adresie najpierw je wyeksportuj. Import nie
publikuje notatek w repozytorium. Każdy odwiedzający nadal ma swoją lokalną
bibliotekę w trybie bez logowania. Po zalogowaniu ma oddzielną bibliotekę
na swoim koncie Supabase; lokalną kolekcję można przenieść przez **Moje konto**.

## 9. Kolejne aktualizacje

Zmieniasz pliki w `gamelogsV2`, sprawdzasz lokalnie, dodajesz zmienione pliki,
robisz `git commit`, potem `git pull --rebase origin main` i `git push origin main`.
Nie musisz ponownie konfigurować Pages. Przy zmianach CSS/JS zwiększ wersję
`?v=` w obu plikach HTML; zmiany w importach modułów też powinny dostać nową wersję.

## Gdy coś nie działa

- **`Missing script: dev`** — otwarty jest zły folder; przejdź do `gamelogsV2`.
- **`node: command not found`** — zainstaluj Node.js LTS i otwórz ponownie terminal.
- **Port zajęty** — użyj działającego podglądu lub zatrzymaj poprzedni w jego terminalu.
- **404 na GitHubie** — sprawdź `main`, `/(root)`, położenie `index.html` oraz wynik Actions.
- **Brak nowych zmian** — sprawdź wynik `git push`, commit na GitHubie i odśwież cache.
- **Puste okładki po publikacji** — sprawdź wielkość liter w ścieżkach, np. `GoWR.png`, oraz czy `images/` jest w commicie.
- **Nie ma prywatnych gier po publikacji** — wczytaj eksport JSON na publicznym adresie.
- **Zniknęły wpisy przy zmianie adresu/portu** — wróć do poprzedniego adresu, wyeksportuj i zaimportuj na docelowym.
- **Brak miejsca na dane** — wyeksportuj bibliotekę przed czyszczeniem danych witryny.

Dokument opisuje publikację do wykonania przez Ciebie. Zmiany nie zostały automatycznie wypchnięte na GitHub.
