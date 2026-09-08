#!/usr/bin/env bash
# Generates Android adaptive launcher icons from public/orjon-logo.png
set -e

SRC="public/orjon-logo.png"
if [ ! -f "$SRC" ]; then
  echo "Source icon $SRC not found!"
  exit 1
fi

RES_DIR="resources/android/res"
mkdir -p "$RES_DIR/values"
mkdir -p "$RES_DIR/mipmap-anydpi-v26"

cat << "EOF" > "$RES_DIR/values/ic_launcher_background.xml"
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#FFFFFF</color>
</resources>
EOF

cat << "EOF" > "$RES_DIR/mipmap-anydpi-v26/ic_launcher.xml"
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
EOF

cat << "EOF" > "$RES_DIR/mipmap-anydpi-v26/ic_launcher_round.xml"
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
EOF

declare -A DENSITIES=(
  ["mdpi"]="48:108:78"
  ["hdpi"]="72:162:117"
  ["xhdpi"]="96:216:156"
  ["xxhdpi"]="144:324:234"
  ["xxxhdpi"]="192:432:312"
)

for density in "${!DENSITIES[@]}"; do
  IFS=":" read -r standard_size adaptive_size safe_size <<< "${DENSITIES[$density]}"
  DIR="$RES_DIR/mipmap-${density}"
  mkdir -p "$DIR"

  # Standard launcher icon
  convert "$SRC" -resize "${standard_size}x${standard_size}" "$DIR/ic_launcher.png"

  # Round launcher icon
  radius=$(( standard_size / 2 ))
  convert "$SRC" -resize "${standard_size}x${standard_size}" \
    \( -size "${standard_size}x${standard_size}" xc:none -fill white -draw "circle $radius,$radius $radius,1" \) \
    -compose DstIn -composite "$DIR/ic_launcher_round.png"

  # Adaptive icon foreground with safe margins (centered in 108dp viewport)
  convert "$SRC" -resize "${safe_size}x${safe_size}" \
    -gravity center -background none -extent "${adaptive_size}x${adaptive_size}" \
    "$DIR/ic_launcher_foreground.png"

  echo "Generated $density icons"
done

echo "✅ Android launcher icons generated successfully in $RES_DIR"
