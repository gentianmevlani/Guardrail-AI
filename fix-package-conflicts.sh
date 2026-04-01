#!/bin/bash

# Fix only package.json files with merge conflicts
echo "Fixing package.json files with merge conflicts..."

files=$(find . -name "package.json" -not -path "./node_modules/*" -not -path "./.git/*" -exec grep -l "<<<<<<< HEAD" {} \;)

for file in $files; do
    echo "Fixing $file..."
    
    # Create a backup
    cp "$file" "$file.backup"
    
    # Remove all conflict markers and their content
    # This removes from <<<<<<< HEAD to >>>>>>> hash inclusive
    perl -i -0pe 's/<<<<<<< HEAD.*?>>>>>>> [a-f0-9]+\n//gs' "$file"
    
    echo "✓ Fixed $file"
done

# Also fix pnpm-workspace.yaml
if [ -f "pnpm-workspace.yaml" ] && grep -q "<<<<<<< HEAD" pnpm-workspace.yaml; then
    echo "Fixing pnpm-workspace.yaml..."
    cp pnpm-workspace.yaml pnpm-workspace.yaml.backup
    perl -i -0pe 's/<<<<<<< HEAD.*?>>>>>>> [a-f0-9]+\n//gs' pnpm-workspace.yaml
    echo "✓ Fixed pnpm-workspace.yaml"
fi

echo
echo "All package.json conflicts resolved!"
