import {chromium} from 'playwright';
import {mkdir, writeFile} from 'node:fs/promises';
const root = new URL('../site/icons/', import.meta.url);
await mkdir(root, {recursive: true});
const browser = await chromium.launch({channel: 'chrome', headless: true});
try {
  const page = await browser.newPage();
  for (const [name, size, scale] of [['icon-192.png',192,.65],['icon-512.png',512,.65],['apple-touch-icon.png',180,.65],['icon-maskable-512.png',512,.5]]) {
    const data = await page.evaluate(({size,scale}) => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d');ctx.fillStyle='#213183';ctx.fillRect(0,0,size,size);
      ctx.fillStyle='#fff';ctx.font=`bold ${Math.round(size*scale)}px "Microsoft YaHei",sans-serif`;
      ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('大',size/2,size*.51);
      return canvas.toDataURL('image/png').split(',')[1];
    }, {size,scale});
    await writeFile(new URL(name,root),Buffer.from(data,'base64'));
  }
} finally { await browser.close(); }
