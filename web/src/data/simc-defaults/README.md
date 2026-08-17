# SimC default APL manifest

`manifest.json` lists SimulationCraft `MID1_*.simc` raid profiles from
[`simulationcraft/simc`](https://github.com/simulationcraft/simc) (default branch
`midnight`, directory `profiles/MID1`). The New APL picker uses this file so
class/spec/hero-variant choices render without a GitHub listing request.

Regenerate after SimC adds or renames profiles:

```bash
cd web
npm run generate:simc-defaults
```

Optional: `SIMC_REF=midnight npm run generate:simc-defaults`
