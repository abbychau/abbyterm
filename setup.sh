#!/bin/bash
# AbbyTerm Setup Script

set -e

if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    echo "Error: This script is designed for Linux."
    exit 1
fi

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check Node.js
echo "Checking Node.js..."
if command_exists node; then
    echo "Node.js is installed: $(node --version)"
else
    echo "Error: Node.js is not installed. Please install Node.js 18+."
    exit 1
fi

# Check Rust
echo "Checking Rust..."
if command_exists cargo; then
    echo "Rust is installed: $(cargo --version)"
else
    echo "Rust is not installed. Install now? (y/n)"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
        source $HOME/.cargo/env
    else
        echo "Error: Rust is required."
        exit 1
    fi
fi

# Check System Dependencies
echo "Checking system dependencies..."
if [ -f /etc/os-release ]; then
    . /etc/os-release
    DISTRO=$ID
fi

DEPS_MISSING=false
if ! pkg-config --exists webkit2gtk-4.1 || ! pkg-config --exists gtk+-3.0; then
    DEPS_MISSING=true
fi

if [ "$DEPS_MISSING" = true ]; then
    echo "Missing system dependencies. Install now? (requires sudo) (y/n)"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        case $DISTRO in
            ubuntu|debian|linuxmint|pop)
                sudo apt update && sudo apt install -y libwebkit2gtk-4.1-dev build-essential curl wget file libssl-dev libayatana-appindicator3-dev librsvg2-dev
                ;;
            arch|manjaro)
                sudo pacman -S --needed webkit2gtk-4.1 base-devel curl wget file openssl appmenu-gtk-module gtk3 libappindicator-gtk3 librsvg libvips
                ;;
            fedora|rhel|centos)
                sudo dnf install -y webkit2gtk4.1-devel openssl-devel curl wget file libappindicator-gtk3-devel librsvg2-devel
                ;;
            *)
                echo "Unknown distribution. Please install dependencies manually."
                ;;
        esac
    fi
fi

echo "Setup complete."
