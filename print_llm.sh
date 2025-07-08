#!/bin/bash

# This script gathers all source code from a project into a single file,
# making it easy to analyze and understand the entire project structure.

# --- Configuration ---
# Specify the directories containing your source code.
# Example: SOURCE_DIRS="src services utils"
SOURCE_DIRS="."

# Define the file extensions of the code you want to include.
# Example: FILE_EXTENSIONS="js|ts|py|java"
FILE_EXTENSIONS="js|html|css"

# List any directories you wish to exclude from the output.
# Common exclusions include node_modules, .git, and build directories.
EXCLUDE_DIRS=".git|node_modules|dist|build"

# Add a title and a brief description to the output file.
echo "Project Overview"
echo "Generated on: $(date)" 
echo "--------------------------------"

# Use the 'find' command to locate all relevant files.
# It searches the specified source directories, filtering by file extension
# and excluding specified directories.
find $SOURCE_DIRS -type f -name "*.*" | grep -E "\.($FILE_EXTENSIONS)$" | grep -vE "$EXCLUDE_DIRS" | while read -r file; do
    # For each file found, append a header with the file's path.
    echo "--- File: $file ---"
    # Append the content of the file to the output.
    cat "$file"
    # Add a newline for better separation between files.
    echo ""
done
