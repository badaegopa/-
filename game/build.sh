#!/bin/sh
# 아티팩트 원본에 문서 머리말을 붙여 단독 실행/Netlify용 파일을 만든다.
#   solbaram.html   -> index.html (2D 판)
#   solbaram3d.html -> 3d.html    (3D 판)
cd "$(dirname "$0")"
wrap() { { printf '<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n</head>\n<body>\n'; cat "$1"; printf '\n</body>\n</html>\n'; } > "$2"; }
wrap solbaram.html index.html
wrap solbaram3d.html 3d.html
