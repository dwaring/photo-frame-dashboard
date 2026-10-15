#!/bin/zsh
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "${0:A:h}/dashboard" || exit 1
if [[ ! -d node_modules ]]; then
  npm ci || exit 1
fi
echo 'Home HQ: http://127.0.0.1:5173/'
echo 'Keep this Terminal window open. Press Control-C to stop.'
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort --open
