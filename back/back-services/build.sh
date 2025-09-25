#!/bin/bash

# build.sh — последовательно выполнить `bun bld` в каждом ./packages/<pkg>

PACKAGES_DIR="./packages"

# Проверяем, что директория packages существует
if [ ! -d "$PACKAGES_DIR" ]; then
  echo "❌ Директория $PACKAGES_DIR не найдена"
  exit 1
fi

# Перебираем все директории в packages
for pkg_path in "$PACKAGES_DIR"/*; do
  # Проверяем, что это директория
  if [ ! -d "$pkg_path" ]; then
    continue
  fi
  
  pkg_name=$(basename "$pkg_path")
  
  echo
  echo "▶️  $pkg_name: bun bld"
  
  # Переходим в директорию пакета и выполняем команду
  if (cd "$pkg_path" && bun bld); then
    echo "✅ $pkg_name: done"
  else
    echo "❌ $pkg_name: build failed"
    # Если нужно падать сразу — раскомментируй:
    # exit 1
  fi
done

echo
echo "🎉 Сборка завершена"