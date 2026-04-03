#!/bin/bash
set -e

REPO_DIR="/home/ubuntu/chess-bet"

cd $REPO_DIR && git pull

# ── Backend ────────────────────────────────────────────────
cd $REPO_DIR/backend

cat > .env << 'EOF'
DATABASE_URL="postgresql://postgres:test1234@localhost:5432/chess_bet"
JWT_SECRET="change_this_jwt_secret"
COOKIE_SECRET="change_this_cookie_secret"
CORS_ORIGIN="https://cotuong.linguagerman.com"
PORT=4000
NODE_ENV=production
EOF

npm install
npx prisma generate
npx prisma db push
npm run db:migrate

# ── Frontend ───────────────────────────────────────────────
cd $REPO_DIR/frontend

cat > .env.local << 'EOF'
NEXT_PUBLIC_API_URL=https://api-cotuong.linguagerman.com/api/v1
NEXT_PUBLIC_SOCKET_URL=https://api-cotuong.linguagerman.com
EOF

npm install
npm run build

# ── PM2 ───────────────────────────────────────────────────
cd $REPO_DIR

pm2 delete chess-backend  2>/dev/null || true
pm2 delete chess-frontend 2>/dev/null || true

pm2 start $REPO_DIR/backend/node_modules/.bin/tsx \
  --name chess-backend \
  --cwd $REPO_DIR/backend \
  -- src/index.ts

pm2 start "npm run start" \
  --name chess-frontend \
  --cwd $REPO_DIR/frontend

pm2 save
pm2 startup

# ── Nginx ─────────────────────────────────────────────────
sudo cp $REPO_DIR/deploy/nginx/api-cotuong.linguagerman.com.conf /etc/nginx/sites-available/api-cotuong.linguagerman.com
sudo cp $REPO_DIR/deploy/nginx/cotuong.linguagerman.com.conf     /etc/nginx/sites-available/cotuong.linguagerman.com

sudo ln -sf /etc/nginx/sites-available/api-cotuong.linguagerman.com /etc/nginx/sites-enabled/api-cotuong.linguagerman.com
sudo ln -sf /etc/nginx/sites-available/cotuong.linguagerman.com     /etc/nginx/sites-enabled/cotuong.linguagerman.com

sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

# ── Certbot ───────────────────────────────────────────────
sudo certbot --nginx \
  -d api-cotuong.linguagerman.com \
  -d cotuong.linguagerman.com \
  --non-interactive \
  --agree-tos \
  --email admin@linguagerman.com \
  --redirect

sudo systemctl reload nginx

echo ""
echo "Done!"
echo "  https://cotuong.linguagerman.com"
echo "  https://api-cotuong.linguagerman.com"
