# Konta GameLogs — Supabase i GitHub Pages

## Co jest już przygotowane

Projekt Supabase **GameLogs**, region Europa (Irlandia), jest połączony przez
publiczną konfigurację `config.js`. W bazie utworzono tabele
`gamelogs_libraries`, `gamelogs_games`, `gamelogs_entries`, funkcje odczytu/zapisu
oraz prywatny bucket `game-covers`. Nie musisz ponownie uruchamiać SQL w tym projekcie.
Kod jest lokalnie; publikacja frontendu wymaga commita i pusha opisanego niżej.

Każde nowe konto ma pustą bibliotekę. Gry, oceny, dzienniki i wgrane okładki
należą do konkretnego konta. RLS w bazie oraz polityki Storage blokują dostęp
do danych innych osób, także przy próbie ominięcia interfejsu.
Hasła obsługuje Supabase Auth — aplikacja nie zapisuje ich w tabelach gier ani w Git.

Bez logowania pozostaje dotychczasowy tryb lokalny. Logowanie nie przesyła
automatycznie lokalnych danych. W panelu **Moje konto** jest osobny przycisk
**Dodaj lokalne gry do konta**. Kopia lokalna pozostaje bez zmian;
gry o identyfikatorach już obecnych na koncie są pomijane.

## 1. Ustaw adresy powrotu po potwierdzeniu e-maila

W panelu projektu otwórz **Authentication → URL Configuration**.

**Site URL:**

```text
https://anveth.github.io/
```

Do **Redirect URLs** dodaj każdy z poniższych adresów osobno i zapisz:

```text
https://anveth.github.io/index.html
http://localhost:5173/index.html
http://127.0.0.1:5173/index.html
```

Formularze używają strony `index.html` jako celu potwierdzenia rejestracji
i odzyskiwania hasła. Nie stosuj szerokiego `**` dla produkcji.

## 2. Rejestracja e-mail — ważne ograniczenie

W **Authentication → Sign In / Providers → Email** sprawdź, czy logowanie
e-mail i rejestracje są włączone. Pozostaw potwierdzanie adresów e-mail.

Domyślny serwer pocztowy Supabase jest przeznaczony do testów: wiadomości
trafiają tylko na adresy osób należących do zespołu projektu, a limit jest mały
(obecnie 2 wiadomości na godzinę). Zacznij od swojego adresu używanego w Supabase.
Nie dodawaj odwiedzających do organizacji tylko po to, by mogli założyć konto.

Przed uruchomieniem rejestracji dla wszystkich skonfiguruj własne SMTP
w ustawieniach Authentication. Usługa pocztowa może mieć własne limity/koszty;
nie została automatycznie zakupiona ani skonfigurowana. Alternatywą do osobnego
wdrożenia jest logowanie przez dostawcę, np. GitHub, bez wysyłki potwierdzeń
przez domyślny SMTP. Obecny formularz obsługuje e-mail i hasło, nie OAuth.
Nie wyłączaj potwierdzania e-maili jako sposobu obejścia tego ograniczenia.

Źródła: [SMTP](https://supabase.com/docs/guides/auth/auth-smtp),
[logowanie hasłem](https://supabase.com/docs/guides/auth/passwords),
[adresy powrotu](https://supabase.com/docs/guides/auth/redirect-urls).

## 3. Sprawdź własne konto lokalnie

W terminalu projektu:

```sh
npm run dev
```

Otwórz `http://localhost:5173`, odśwież stronę, wybierz **Zaloguj się → Rejestracja**.
Wpisz własny adres i nowe, unikalne hasło (co najmniej 10 znaków), potwierdź
e-mail, a potem zaloguj się. Hasła wpisuj wyłącznie samodzielnie w formularzu,
nie przesyłaj ich na czacie.

Dodaj grę z okładką, oceną i wpisem. Odśwież stronę: dane powinny pozostać.
Zaloguj się na tym samym koncie w innej przeglądarce: biblioteka powinna być
ta sama. Wyloguj się: wróci lokalna biblioteka tej przeglądarki.
Drugie konto powinno zacząć od pustej kolekcji i nie widzieć gier pierwszego.

„Nie pamiętam hasła” wysyła link. Po jego otwarciu ustawiasz nowe hasło
w panelu konta. Tę operację również ogranicza konfiguracja SMTP.

## 4. Sprawdź kod i opublikuj

W VS Code otwórz folder `gamelogsV2`. Polecenie `npm ci` instaluje tylko
narzędzie do testów bazy; serwer podglądu nie wymaga instalacji zależności.

```sh
npm ci
npm run check
npm test
git status
git add index.html dice.html style.css script.js storage.js gallery.js account.js cloud.js config.js scripts/dev.mjs package.json package-lock.json README.md PUBLIKACJA.md KONTA.md tests supabase
git diff --cached --stat
git commit -m "Add private game libraries with Supabase Auth and restore gallery"
git pull --rebase origin main
git push origin main
```

Jeżeli `pull` zgłosi konflikt, rozwiąż go przed `push`; nie używaj `--force`.
Po wdrożeniu w GitHub Actions odśwież stronę przez `Cmd+Shift+R`.
Pages nadal publikuje `main` i `/(root)`. Nie potrzeba własnego serwera Node
ani zmiany adresu strony; backend działa osobno w Supabase.

## Konfiguracja i bezpieczeństwo

- `config.js` zawiera wyłącznie Project URL i publiczny publishable key.
  Mogą być w publicznym repozytorium — ochronę danych zapewniają RLS i sesja.
- Nigdy nie dodawaj `service_role`, `sb_secret_*`, hasła bazy ani tokenów sesji.
- `supabase/schema.sql` pozwala odtworzyć schemat w nowym projekcie przez SQL Editor.
  W nowym projekcie najpierw sprawdź istniejące tabele i konfigurację, potem uzupełnij config.
- Nie zmieniaj bucketa `game-covers` na publiczny. Okładki są pobierane po zalogowaniu.
- Obrazy z zewnętrznego URL są publicznymi zasobami zewnętrznego serwera;
  prywatny magazyn dotyczy plików wgranych przez formularz.
- Przy konflikcie dwóch urządzeń zapis jest odrzucany zamiast nadpisywać
  nowszą wersję. Wybierz **Moje konto → Odśwież bibliotekę** i ponów zmianę.
- Nie ma jeszcze edycji offline z późniejszą synchronizacją. Błąd sieci oznacza
  brak potwierdzonego zapisu. Biblioteka na koncie nie jest zastępowana lokalną kopią.
- Rób okresowo eksport JSON. Zmiana okładki zostawia poprzedni plik w Storage;
  automatyczne usuwanie nieużywanych plików nie jest jeszcze wdrożone.
- Plan Free ma limity i może wstrzymywać nieaktywne projekty. Kontroluj użycie
  w panelu; nie uruchomiono płatnego planu ani dodatkowych płatnych usług.

Testy `npm test` uruchamiają PostgreSQL w pamięci (PGlite), bez kont użytkowników
i bez połączenia z produkcją. Sprawdzają izolację RLS, prywatne ścieżki okładek,
atomowy zapis i konflikty wersji. Nie zastępują końcowego testu rejestracji,
potwierdzenia e-maila oraz logowania na dwóch urządzeniach.
