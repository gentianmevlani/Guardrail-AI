#!/bin/bash

# Environment Variable Management Script
# Helps copy environment variables between different deployment targets

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [command] [target]"
    echo ""
    echo "Commands:"
    echo "  copy     Copy environment template to target"
    echo "  list     List all environment files"
    echo "  check    Check if all required variables are set"
    echo ""
    echo "Targets:"
    echo "  local    .env (local development)"
    echo "  railway  .env.railway (Railway deployment)"
    echo "  netlify  .env.netlify (Netlify deployment)"
    echo ""
    echo "Examples:"
    echo "  $0 copy railway"
    echo "  $0 check railway"
}

# Function to copy environment template
copy_env() {
    local target=$1
    local target_file="$PROJECT_ROOT/.env"
    
    case $target in
        "railway")
            target_file="$PROJECT_ROOT/.env.railway"
            ;;
        "netlify")
            target_file="$PROJECT_ROOT/.env.netlify"
            ;;
        "local"|*)
            target_file="$PROJECT_ROOT/.env"
            ;;
    esac
    
    if [ -f "$PROJECT_ROOT/.env.template" ]; then
        cp "$PROJECT_ROOT/.env.template" "$target_file"
        print_status "Copied .env.template to $target_file"
        print_warning "Please fill in the actual values in $target_file"
    else
        print_error ".env.template not found!"
        exit 1
    fi
}

# Function to list environment files
list_env() {
    print_status "Environment files found:"
    find "$PROJECT_ROOT" -name ".env*" -type f | while read -r file; do
        echo "  - $file"
    done
}

# Function to check required variables
check_env() {
    local target=$1
    local target_file="$PROJECT_ROOT/.env"
    
    case $target in
        "railway")
            target_file="$PROJECT_ROOT/.env.railway"
            ;;
        "netlify")
            target_file="$PROJECT_ROOT/.env.netlify"
            ;;
        "local"|*)
            target_file="$PROJECT_ROOT/.env"
            ;;
    esac
    
    if [ ! -f "$target_file" ]; then
        print_error "Environment file $target_file not found!"
        exit 1
    fi
    
    print_status "Checking environment variables in $target_file..."
    
    # Check for empty values
    local empty_vars=()
    while IFS= read -r line; do
        # Skip comments and empty lines
        if [[ $line =~ ^[[:space:]]*# ]] || [[ -z "${line// }" ]]; then
            continue
        fi
        
        # Extract variable name and value
        var_name=$(echo "$line" | cut -d'=' -f1)
        var_value=$(echo "$line" | cut -d'=' -f2-)
        
        # Check if value is empty or placeholder
        if [[ -z "$var_value" ]] || [[ "$var_value" == "..." ]] || [[ "$var_value" == "your-"* ]]; then
            empty_vars+=("$var_name")
        fi
    done < "$target_file"
    
    if [ ${#empty_vars[@]} -eq 0 ]; then
        print_status "All environment variables are set!"
    else
        print_warning "The following variables need to be set:"
        for var in "${empty_vars[@]}"; do
            echo "  - $var"
        done
    fi
}

# Main script logic
case "${1:-}" in
    "copy")
        if [ -z "${2:-}" ]; then
            print_error "Please specify a target (local, railway, netlify)"
            show_usage
            exit 1
        fi
        copy_env "$2"
        ;;
    "list")
        list_env
        ;;
    "check")
        if [ -z "${2:-}" ]; then
            print_error "Please specify a target (local, railway, netlify)"
            show_usage
            exit 1
        fi
        check_env "$2"
        ;;
    *)
        show_usage
        exit 1
        ;;
esac
