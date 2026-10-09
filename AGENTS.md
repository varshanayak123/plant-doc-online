<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Application architecture
- Use separate TanStack leaf routes for each main page with shared header/footer and a language provider in the root; each page needs independently shareable metadata.
- Route all detection through src/services/diseaseDetection.ts, which calls server functions in src/lib/scans.functions.ts; AI calls and the storage admin client stay server-side so keys and other guests' data never reach the browser.
- Guests are identified by a random token in localStorage; the server stores only its SHA-256 hash and scan_history/crop-images have no client policies, so records are reachable only via token-checked server functions.
- Keep multilingual display copy in the shared i18n module and have the AI return each disease detail in every supported language so saved scans display in any language.
