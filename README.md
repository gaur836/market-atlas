# Market Atlas

A standalone browser-based stock and company information explorer powered by Finnhub. Search for a company or ticker to view its profile, latest quote, key metrics, reported financial statements, one year of daily price history, and recent company news. The app displays data returned by Finnhub; it does not generate or simulate market information.

## Run

From this folder, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\run.ps1
```

The local server opens Market Atlas at `http://localhost:8766/`. Keep the PowerShell window open while using it; press Ctrl+C to stop the server. The existing Haven app remains separate in the parent workspace and is not included with Market Atlas.

## API key and data

Create a Finnhub account and enter your own API key in the app. The key stays in page memory for the current browser session, is sent directly to Finnhub when making API requests, and is not saved in browser storage or written to app files. Clear it or close the tab to remove it from the app. Avoid sharing the browser or developer tools while the key is in use.

Market Atlas uses Finnhub's company symbol search, company profile, quote, basic financial metrics, reported annual financial statements, stock candles, and company news endpoints. Data availability, exchange coverage, delays, and request limits depend on your Finnhub plan. A company or a particular data section may not be covered by your plan; the app reports missing data and request errors rather than substituting sample data. Free plans have usage limits, and loading a company requests several sections.

Market data is provided for informational research only and is not investment advice.

## Publish as a website

This is a static site: it has no build step or server-side code. Deploy the contents of `stock-explorer` to a static web host, using that folder as the publish directory and leaving the build command empty. The relative asset paths also work when the host serves the site from a subpath.

Do not add a Finnhub key to the site files or hosting settings. Each visitor enters their own key in the page; requests go from their browser directly to Finnhub. The key is visible to that visitor in their browser's network tools while in use, so this client-only setup is intended for personal use, not a shared service that uses one private key for everyone.

Published site: [Market Atlas](https://gaur836.github.io/market-atlas/). The source is in the public [market-atlas repository](https://github.com/gaur836/market-atlas). No Finnhub API key is bundled with the site.
