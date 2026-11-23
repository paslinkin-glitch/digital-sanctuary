# Digital Sanctuary — обязательный протокол работы

ПРИ ЛЮБОЙ ЗАДАЧЕ НАД ПРОЕКТОМ: самым первым шагом всегда включай `window.SANCTUARY_MAINTENANCE = true` в `index.html` и делай промежуточный `git push` в `main` (чтобы на живом сайте отображалось окно «Ведутся технические работы»), а самым последним шагом после проверки кода выключай `window.SANCTUARY_MAINTENANCE = false` перед финальным `git push`.

## Release deploys
- App: `C:\!Deepseek Harness\.digital-sanctuary-release`, branch `main`.
- Media/static assets: Timeweb S3 `digital-sanctuary` at `https://s3.twcstorage.ru`.
- Always run `node --check app.js`, `node --check videos-data.js`, `node --check sw.js` before the final push.
