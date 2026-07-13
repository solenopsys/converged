#!/usr/bin/env bash
#
# install.sh — сборка baresip с Opus на Arch Linux / EndeavourOS
#
#  • устанавливает зависимости через pacman
#  • клонирует re, rem, baresip в ~/src
#  • собирает через CMake и ставит в /usr
#
set -euo pipefail

SRC="$HOME/src"
JOBS=$(nproc)
PREFIX="/usr"

echo "==> Installing build dependencies..."
sudo pacman -S --needed --noconfirm \
    git gcc make cmake \
    opus \
    alsa-lib openssl libsrtp speexdsp \
    curl v4l-utils \
    pipewire libpipewire \
    libtool

# подчистим старые сборки в /usr/local если были
sudo rm -f /usr/local/lib*/lib{re,rem}.so* \
            /usr/local/lib*/baresip/modules/*.so 2>/dev/null || true

mkdir -p "$SRC"
cd "$SRC"

clone() {
  local url="$1"
  local dir="${url##*/}"
  dir="${dir%.git}"
  if [[ -d "$dir/.git" ]]; then
    echo "==> Updating $dir ..."
    git -C "$dir" pull --ff-only
  else
    echo "==> Cloning $dir ..."
    git clone --depth 1 "$url" "$dir"
  fi
}

build() {
  local dir="$1"
  echo "==> Building $dir ..."
  cd "$SRC/$dir"
  mkdir -p build && cd build
  cmake .. -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX="$PREFIX"
  make -j"$JOBS"
  echo "==> Installing $dir ..."
  sudo make install
}

echo "==> Fetching sources..."
clone https://github.com/baresip/re.git
clone https://github.com/baresip/rem.git
clone https://github.com/baresip/baresip.git

build re
build rem
build baresip

sudo ldconfig 2>/dev/null || true

echo "==> Configuring ~/.baresip ..."
mkdir -p "$HOME/.baresip"

# accounts: add registrar-less UA if not already present
ACCOUNTS="$HOME/.baresip/accounts"
if [[ ! -f "$ACCOUNTS" ]]; then
    baresip -p "$HOME/.baresip" -f 2>/dev/null || true  # generate default config
fi
if ! grep -q "^<sip:user@localhost>" "$ACCOUNTS" 2>/dev/null; then
    echo "" >> "$ACCOUNTS"
    echo "<sip:user@localhost>;regint=0;audio_codecs=opus/48000/2" >> "$ACCOUNTS"
    echo "   Added UA: <sip:user@localhost>"
fi

# config: enable opus.so if not already enabled
CONFIG="$HOME/.baresip/config"
if [[ ! -f "$CONFIG" ]]; then
    baresip -p "$HOME/.baresip" -f 2>/dev/null || true
fi
if grep -q "^#module.*opus\.so" "$CONFIG" 2>/dev/null; then
    sed -i 's/^#module\s*opus\.so/module\t\t\topus.so/' "$CONFIG"
    echo "   Enabled opus.so in config"
elif ! grep -q "^module.*opus\.so" "$CONFIG" 2>/dev/null; then
    sed -i '/^module\s*g711\.so/i module\t\t\topus.so' "$CONFIG"
    echo "   Inserted opus.so before g711.so in config"
fi

echo ""
echo "Baresip installed."
echo "  dial: /dial sip:<number>@<gate-ip>:5060"
