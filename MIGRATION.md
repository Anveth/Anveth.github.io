# Odbiór migracji React + TypeScript + Vite

## Zakres

Gałąź: `codex/react-typescript-migration`. Interfejs i usługi aplikacji są przeniesione do `src/`.
Zachowujemy obecny CSS, projekty Supabase, dane, grafiki i publiczne adresy.
Nie dodajemy Tailwinda, Next.js, nowego backendu ani nowej bazy.

Strict TypeScript sprawdza nowy kod w `src/`. `allowJs` pozostaje włączone dla istniejących danych
demonstracyjnych i wygenerowanych manifestów; nie jest to obietnica przepisania każdego archiwalnego pliku JS.
Testy starego renderera są zachowane wyłącznie do porównania. Aktualny zestaw usług znajduje się w `tests/unit`.

## Zgodność danych

- Ta sama domena/port, `gamelogs:library` i format JSON `version: 1`.
- IndexedDB `gamelogs-media`, wersja 1, magazyn `covers` — bez resetowania.
- Ten sam klucz motywu `gamelogs:theme` i odczyt starego `colorMode`.
- Ten sam projekt Supabase i domyślne przechowywanie sesji SDK; callback `/index.html`.
- Te same RPC, rewizje biblioteki, tabele, polityki RLS i prywatne buckety.
- Brak automatycznego importowania demo lub lokalnych danych do konta.
- Błędy odczytu nie powodują nadpisania biblioteki demonstracyjnymi danymi.
- Przy zmianie konta unieważniamy trwające operacje widoku, czyścimy cache prywatnych okładek i cofamy object URL.
- Nowe pliki mają nowe identyfikatory i `upsert: false`; nie nadpisujemy istniejących prywatnych zdjęć.
- Błąd zapisu lub konflikt rewizji nie oznacza sukcesu; pozostaje komunikat i poprzedni stan.

Zmiany schematu SQL i konfiguracji produkcyjnej nie są częścią migracji.
Nie uruchamiaj ponownie SQL tylko dlatego, że zmienił się frontend.

## Etapy

1. Typy i usługi danych, walidacja starych zapisów i kopii.
2. Komponenty biblioteki, formularze i dziennik; stan niezależny od renderowania DOM.
3. Konto, prywatna galeria oraz losowanie z przygotowaniem obrazka i dotychczasową animacją.
4. Vite, wielostronicowy build zachowujący ścieżki, przygotowanie statycznych zasobów i GitHub Actions.
5. Odbiór funkcjonalny przez użytkownika / testy na jego polecenie, potem decyzja o publikacji.

Kontrola typów i kompilacja są częścią przygotowania. Testy nie są wykonywane automatycznie podczas tej migracji,
zgodnie z ustaleniem z użytkownikiem. Sama kompilacja nie potwierdza poprawnego logowania lub wyglądu.

## Lista odbiorowa przed połączeniem z main

Używaj Chrome i konta przeznaczonego do prób. Najpierw wyeksportuj własną bibliotekę.

- [ ] Gość: zachowane wcześniejsze gry, oceny, wpisy i wgrane okładki po odświeżeniu.
- [ ] Gość bez danych: 15 gier i 18 demonstracyjnych screenshotów; brak kafelków pustego konta.
- [ ] Dodanie, edycja i usunięcie jednej gry; zmiana statusu nie zeruje oceny.
- [ ] Okładka z pliku i URL, usunięcie okładki, błąd / zbyt duży plik.
- [ ] Dziennik: dodawanie i usuwanie wpisu nie usuwa gry; „Show more” odsłania resztę.
- [ ] Filtry, dolne przyciski od 16 widocznych gier, hover okładki/tytułu, klawiatura.
- [ ] Eksport i odtworzenie JSON version 1 z okładką i notatkami, odrzucenie uszkodzonego pliku.
- [ ] Logowanie, wylogowanie, rejestracja, potwierdzenie e-mail i reset hasła.
- [ ] Nowe konto puste; jawny transfer lokalnych danych, bez kopiowania demo i duplikatów.
- [ ] Odświeżenie biblioteki konta; konflikt dwóch kart nie nadpisuje nieświadomie nowszych danych.
- [ ] Zmiana konta podczas wolnego odczytu nie pokazuje danych poprzedniego konta.
- [ ] Prywatna galeria: dwa puste miejsca, dodanie, powiększenie, usunięcie pojedynczego zdjęcia.
- [ ] Galeria: strzałki, przeciąganie, klawiatura, Esc i zamknięcie kliknięciem poza oknem.
- [ ] Odnowienie prywatnych URL zdjęć po dłuższym otwarciu strony.
- [ ] Kostka: filtry, ta sama animacja, brak tekstu powitalnego podczas rzutu, obraz bez migania.
- [ ] Wolny / błędny obraz nie blokuje losowania na stałe.
- [ ] Jasny i ciemny motyw, desktop i mobile, stopka na dole.
- [ ] Wejście bezpośrednie i odświeżenie `/pick-a-game/`; `/dice.html`, `/index.html`, `/?game=ID`, kotwice.
- [ ] `npm test`, `npm run build`, potem odbiór produkcyjnego `dist/` przez `npm run preview`.

Po zatwierdzeniu można usunąć stare nieaktywne moduły i dostosować / zastąpić archiwalne testy interfejsu.
Nie usuwamy ich przed odbiorem, żeby zachować łatwe porównanie z poprzednią wersją.
