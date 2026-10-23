#!/usr/bin/env bash
# Downloads Game UI Database thumbnails listed in <dir>/lists.txt (one line per game:
# "<name> <id1>,<id2>,..." where each id is an upload name without "_thumb.jpg") into
# <dir>/dl/<name>/01.jpg, 02.jpg, ... Run with bash (zsh does not split the id list).
set -euo pipefail
dir=${1:?usage: fetch-thumbs.sh <dir with lists.txt>}
while read -r name ids; do
  [ -z "$name" ] && continue
  mkdir -p "$dir/dl/$name"
  i=0
  for id in ${ids//,/ }; do
    i=$((i + 1))
    curl -s -o "$dir/dl/$name/$(printf %02d $i).jpg" "https://www.gameuidatabase.com/uploads/${id}_thumb.jpg" &
  done
  wait
done < "$dir/lists.txt"
