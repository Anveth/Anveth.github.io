# Publikacja GameLogs po migracji na React

Nowa wersja wymaga kompilacji. **Nie publikuj katalogu głównego repozytorium jako gotowej strony**:
zawiera źródła TSX, których przeglądarka nie wykonuje. Publikujemy wyłącznie wygenerowany `dist/`.

Migracja jest na `codex/react-typescript-migration`, nie na `main`.
Na tym etapie niczego nie wypchnięto ani nie zmieniono w ustawieniach GitHub Pages.

## Przed publikacją

1. Zrób eksport własnej biblioteki i zachowaj go poza repozytorium. Eksport nie obejmuje osobnej galerii.
2. Odbierz funkcje z [MIGRATION.md](MIGRATION.md), w szczególności konta, powroty e-mail i prywatne obrazy.
3. W folderze `gamelogsV2` uruchom kontrolę i build. Testy uruchamiaj, gdy chcesz sprawdzić nową wersję:

```sh
npm ci
npm run check
npm test
npm run build
npm run preview
```

Podgląd produkcyjny działa na `http://localhost:4173/` i ma osobny lokalny magazyn danych od portu 5173.
Do sprawdzania kont używaj skonfigurowanych adresów powrotu z KONTA.md; nie dodawaj szerokich wildcardów.
PGlite w testach nie dotyka produkcyjnej bazy.

## Zapisanie gałęzi migracji

Po obejrzeniu `git status` i `git diff` można zapisać zmiany oraz wysłać **gałąź migracji**.
To nie jest polecenie publikacji na main:

```sh
git add .gitignore .prettierrc.json .github README.md PUBLIKACJA.md MIGRATION.md KONTA.md .env.example package.json package-lock.json tsconfig.json vite.config.ts index.html pick-a-game/index.html style.css scripts/dev.mjs scripts/copy-static.mjs src tests/unit
git diff --cached --stat
git commit -m "Migrate GameLogs frontend to React and TypeScript with Vite"
git push -u origin codex/react-typescript-migration
```

Nie dodawaj `.env`, sekretów ani prywatnych eksportów JSON. `VITE_*` trafia do kodu przeglądarki:
dozwolony jest tylko URL projektu i klucz publishable/anon, nigdy service_role lub sb_secret_*.
Dotychczasowy publiczny `config.js` działa też bez zmiennych środowiskowych.

## Właściwe wdrożenie — dopiero po akceptacji

1. W repozytorium [Anveth/Anveth.github.io](https://github.com/Anveth/Anveth.github.io) ustaw
   **Settings → Pages → Build and deployment → Source → GitHub Actions**.
2. Dopiero po akceptacji połącz gałąź migracji z `main` przez przegląd zmian / pull request.
   Nie używaj `push --force` i nie wykonuj automatycznego merge bez sprawdzenia.
3. `.github/workflows/deploy.yml` na `main` uruchomi `npm ci`, `npm run build` i opublikuje `dist/`.
4. W Actions sprawdź powodzenie „Deploy GameLogs”, następnie otwórz [stronę](https://anveth.github.io/).
5. Sprawdź też bezpośrednie wejście i odświeżenie `/pick-a-game/`, stary `/dice.html` oraz logowanie.

Workflow z gałęzi migracji nie publikuje strony, także przy ręcznym uruchomieniu.
W tym zadaniu ustawienia Pages, produkcyjna baza i Supabase Storage nie zostały zmienione.

Vite dodaje hashe do plików JS/CSS — nie trzeba już ręcznie podbijać `?v=` w głównych plikach HTML.
Nie zmieniamy domeny ani portu rozwojowego; wcześniejsze localStorage/IndexedDB pozostają dostępne.

Instrukcje: [Vite — GitHub Pages](https://vite.dev/guide/static-deploy.html#github-pages),
[GitHub — źródło publikacji](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).
