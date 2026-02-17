#!/bin/bash
# iNovel Installer for macOS/Linux
# Usage: curl -fsSL https://raw.githubusercontent.com/lanbinleo/iNovel/main/scripts/install.sh | bash

set -e

INSTALL_DIR="$HOME/.inovel"
REPO="lanbinleo/iNovel"

echo "iNovel Installer"
echo "================"
echo ""

# Detect OS and architecture
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

case "$OS" in
    darwin) PLATFORM="darwin" ;;
    linux) PLATFORM="linux" ;;
    *) echo "Unsupported OS: $OS"; exit 1 ;;
esac

case "$ARCH" in
    x86_64) ARCH="amd64" ;;
    amd64) ARCH="amd64" ;;
    arm64|aarch64) ARCH="arm64" ;;
    *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

echo "Detected: $PLATFORM-$ARCH"
echo ""

# Get latest release
echo "Fetching latest release..."
RELEASE_INFO=$(curl -s "https://api.github.com/repos/$REPO/releases/latest")
VERSION=$(echo "$RELEASE_INFO" | grep '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/')

if [ -z "$VERSION" ]; then
    echo "Failed to get latest version"
    exit 1
fi

echo "Latest version: $VERSION"
echo ""

# Create install directory
mkdir -p "$INSTALL_DIR"

if [ "$PLATFORM" = "darwin" ]; then
    # macOS - download zip and extract app
    DOWNLOAD_URL="https://github.com/$REPO/releases/download/$VERSION/iNovel-darwin-$ARCH.zip"
    TEMP_ZIP="/tmp/inovel.zip"

    echo "Downloading $DOWNLOAD_URL..."
    curl -L -o "$TEMP_ZIP" "$DOWNLOAD_URL"

    echo "Extracting..."
    unzip -o "$TEMP_ZIP" -d "$INSTALL_DIR"
    rm "$TEMP_ZIP"

    # Create symlink in /usr/local/bin
    if [ -w "/usr/local/bin" ]; then
        ln -sf "$INSTALL_DIR/iNovel.app/Contents/MacOS/iNovel" /usr/local/bin/inovel
        echo "Created symlink: /usr/local/bin/inovel"
    fi

    # Create desktop alias
    if [ -d "$HOME/Desktop" ]; then
        ln -sf "$INSTALL_DIR/iNovel.app" "$HOME/Desktop/iNovel.app"
        echo "Created desktop alias"
    fi

else
    # Linux - download binary
    DOWNLOAD_URL="https://github.com/$REPO/releases/download/$VERSION/iNovel-linux-$ARCH"
    BIN_PATH="$INSTALL_DIR/iNovel"

    echo "Downloading $DOWNLOAD_URL..."
    curl -L -o "$BIN_PATH" "$DOWNLOAD_URL"
    chmod +x "$BIN_PATH"

    # Create symlink in ~/.local/bin
    mkdir -p "$HOME/.local/bin"
    ln -sf "$BIN_PATH" "$HOME/.local/bin/inovel"
    echo "Created symlink: ~/.local/bin/inovel"

    # Create desktop entry
    DESKTOP_DIR="$HOME/.local/share/applications"
    mkdir -p "$DESKTOP_DIR"
    cat > "$DESKTOP_DIR/inovel.desktop" << EOF
[Desktop Entry]
Name=iNovel
Comment=Novel Writer
Exec=$BIN_PATH
Terminal=false
Type=Application
Categories=Office;TextEditor;
EOF
    echo "Created desktop entry"

    # Copy to Desktop if exists
    if [ -d "$HOME/Desktop" ]; then
        cp "$DESKTOP_DIR/inovel.desktop" "$HOME/Desktop/"
        chmod +x "$HOME/Desktop/inovel.desktop"
    fi
fi

echo ""
echo "Installation complete!"
echo "Installed to: $INSTALL_DIR"
