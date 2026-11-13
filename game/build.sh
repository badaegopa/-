#!/bin/sh
# solbaram.html(아티팩트 원본)에 문서 머리말을 붙여 단독 실행/Netlify용 index.html을 만든다.
cd "$(dirname "$0")"
{ printf '<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n</head>\n<body>\n'; cat solbaram.html; printf '\n</body>\n</html>\n'; } > index.html
