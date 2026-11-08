#!/usr/bin/env bash
# Generates the 6 placeholder demo tracks used by the prototype (audio/demo-1..6.mp3).
# Replace these with Robert's real songs (see docs/ADDING-SONGS.md).
set -e
mkdir -p audio
i=0
for spec in "220:330:0.5" "196:294:0.4" "247:370:0.6" "174:261:0.45" "262:392:0.55" "147:220:0.35"; do
  IFS=: read a b r <<< "$spec"; i=$((i+1))
  trem=$(python3 -c "print(2*$r+1)")
  ffmpeg -loglevel error -y -f lavfi -i "sine=frequency=$a:duration=60" -f lavfi -i "sine=frequency=$b:duration=60" \
    -f lavfi -i "anoisesrc=d=60:c=pink:a=0.02" \
    -filter_complex "[0][1][2]amix=inputs=3,volume=2.5,tremolo=f=$trem:d=0.5,afade=t=in:d=2,afade=t=out:st=56:d=4" \
    -ac 1 -b:a 32k audio/demo-$i.mp3
done
echo "Demo audio written to audio/"
