# Launch assets

These files are prepared for Product Hunt and relevant manual product-directory listings. They portray the live product rather than mockups.

| File | Dimensions | Intended use |
| --- | --- | --- |
| `product-hunt-thumbnail.png` | 240 x 240 | Product Hunt thumbnail |
| `product-hunt-calculator.png` | 1270 x 760 | Primary gallery image: a real US + UK payment-term calculation |
| `product-hunt-guide.png` | 1270 x 760 | Second gallery image: the international payment due-date guide |

Regenerate the files immediately before a Product Hunt launch or a material product change:

```bash
pnpm exec node scripts/capture-launch-assets.mjs
```

The script reads only public production pages. It uses a fixed calculation URL so the gallery stays focused on a meaningful cross-border result. Verify the resulting screenshots manually before submitting them to a third party.
