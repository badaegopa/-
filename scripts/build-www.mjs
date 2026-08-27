/* 웹 자산을 www/ 로 모아 Capacitor 가 안드로이드 assets 로 복사할 수 있게 한다.
   저장소 루트를 그대로 webDir 로 쓰면 .git 까지 APK 에 들어가므로 반드시 이 단계를 거친다. */
import { mkdir, copyFile, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const WWW  = path.join(ROOT, 'www');

const FILES = ['index.html', 'manifest.webmanifest', 'sw.js'];
const DIRS  = ['icons'];

await rm(WWW, { recursive: true, force: true });
await mkdir(WWW, { recursive: true });

for (const f of FILES) {
  if (!existsSync(path.join(ROOT, f))) { console.warn('건너뜀 (없음):', f); continue; }
  await copyFile(path.join(ROOT, f), path.join(WWW, f));
  console.log('복사:', f);
}
for (const d of DIRS) {
  const src = path.join(ROOT, d);
  if (!existsSync(src)) continue;
  await mkdir(path.join(WWW, d), { recursive: true });
  for (const f of await readdir(src)) {
    await copyFile(path.join(src, f), path.join(WWW, d, f));
  }
  console.log('복사:', d + '/');
}
console.log('\nwww/ 준비 완료 — 다음: npx cap sync android');
