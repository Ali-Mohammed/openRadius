#!/bin/sh
# Wrapper script to execute Docker commands
# This avoids issues with .NET Process spawning on macOS

# Close stdin to prevent Docker from waiting for input
exec </dev/null

# Execute Docker with all arguments
exec /Applications/Docker.app/Contents/Resources/bin/docker "$@"
