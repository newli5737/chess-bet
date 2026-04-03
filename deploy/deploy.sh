#!/bin/bash
# ═══════════════════════════════════════════════════════════
# VPS Deploy Script — Chess-Bet Platform
# Chạy lần đầu trên VPS Ubuntu/Debian sau khi clone repo
# ═══════════════════════════════════════════════════════════
set -e

REPO_DIR="/var/www/chess-bet"
REPO_URL="https://github.com/newli5737/chess-bet.git"

echo "══════════════════════════════════════════"
echo " 1. Cài dependencies hệ thống"
echo "══════════════════════════════════════════"
sudo apt update -y
sudo apt install -y nginx certbot python3-certbot-nginx git curl

# Cài Node.js 20 nếu chưa có
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
fi

# Cài PM2 nếu chưa có
if ! command -v pm2 &> /dev/null; then
  sudo npm install -g pm2
fi

echo ""
echo "══════════════════════════════════════════"
echo " 2. Clone / Pull repo"
echo "══════════════════════════════════════════"
if [ -d "$REPO_DIR" ]; then
  echo "Repo đã tồn tại, pull latest..."
  cd $REPO_DIR && git pull
else
  echo "Clone repo mới..."
  sudo git clone $REPO_URL $REPO_DIR
  sudo chown -R $USER:$USER $REPO_DIR
fi

echo ""
echo "══════════════════════════════════════════"
echo " 3. Setup backend"
echo "══════════════════════════════════════════"
cd $REPO_DIR/backend
npm install

# Tạo .env backend nếu chưa có
if [ ! -f ".env" ]; then
  echo "⚠️  Tạo file .env backend — HÃY SỬA LẠI CÁC GIÁ TRỊ!"
  cat > .env << 'EOF'
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/chess_bet"
JWT_SECRET="CHANGE_THIS_TO_RANDOM_SECRET"
COOKIE_SECRET="CHANGE_THIS_TO_ANOTHER_SECRET"
CORS_ORIGIN="https://cotuong.linguagerman.com"
PORT=4000
NODE_ENV=production
EOF
  echo "❌ DỪNG LẠI: Hãy sửa file $REPO_DIR/backend/.env trước khi tiếp tục!"
  exit 1
fi

# Generate Prisma client
npx prisma generate

# Chạy migration thủ công
npm run db:migrate

echo ""
echo "══════════════════════════════════════════"
echo " 4. Setup frontend"
echo "══════════════════════════════════════════"
cd $REPO_DIR/frontend
npm install

# Tạo .env.local frontend nếu chưa có
if [ ! -f ".env.local" ]; then
  cat > .env.local << 'EOF'
NEXT_PUBLIC_API_URL=https://api-cotuong.linguagerman.com/api/v1
NEXT_PUBLIC_SOCKET_URL=https://api-cotuong.linguagerman.com
EOF
fi

# Build Next.js
npm run build

echo ""
echo "══════════════════════════════════════════"
echo " 5. Khởi động với PM2"
echo "══════════════════════════════════════════"
cd $REPO_DIR

# Stop existing nếu đang chạy
pm2 stop chess-backend  2>/dev/null || true
pm2 stop chess-frontend 2>/dev/null || true
pm2 delete chess-backend  2>/dev/null || true
pm2 delete chess-frontend 2>/dev/null || true

# Start backend
pm2 start "node --loader tsx/esm backend/src/index.ts" \
  --name chess-backend \
  --cwd $REPO_DIR/backend \
  --interpreter none \
  -- --env production

# Hoặc dùng tsx trực tiếp
pm2 start backend/node_modules/.bin/tsx \
  --name chess-backend \
  --cwd $REPO_DIR/backend \
  -- src/index.ts

# Start frontend (Next.js standalone)
pm2 start "npm run start" \
  --name chess-frontend \
  --cwd $REPO_DIR/frontend

pm2 save
pm2 startup

echo ""
echo "══════════════════════════════════════════"
echo " 6. Setup Nginx"
echo "══════════════════════════════════════════"
sudo cp $REPO_DIR/deploy/nginx/api-cotuong.linguagerman.com.conf \
        /etc/nginx/sites-available/api-cotuong.linguagerman.com
sudo cp $REPO_DIR/deploy/nginx/cotuong.linguagerman.com.conf \
        /etc/nginx/sites-available/cotuong.linguagerman.com

sudo ln -sf /etc/nginx/sites-available/api-cotuong.linguagerman.com \
            /etc/nginx/sites-enabled/api-cotuong.linguagerman.com
sudo ln -sf /etc/nginx/sites-available/cotuong.linguagerman.com \
            /etc/nginx/sites-enabled/cotuong.linguagerman.com

# Xoá default nếu còn
sudo rm -f /etc/nginx/sites-enabled/default

sudo nginx -t
sudo systemctl reload nginx

echo ""
echo "══════════════════════════════════════════"
echo " 7. Certbot SSL"
echo "══════════════════════════════════════════"
sudo certbot --nginx \
  -d api-cotuong.linguagerman.com \
  -d cotuong.linguagerman.com \
  --non-interactive \
  --agree-tos \
  --email admin@linguagerman.com \
  --redirect

sudo systemctl reload nginx

echo ""
echo "══════════════════════════════════════════"
echo " ✅ DEPLOY HOÀN THÀNH!"
echo "══════════════════════════════════════════"
echo " Frontend : https://cotuong.linguagerman.com"
echo " Backend  : https://api-cotuong.linguagerman.com"
echo " Socket   : wss://api-cotuong.linguagerman.com/game"
echo ""
echo " Kiểm tra logs:"
echo "   pm2 logs chess-backend"
echo "   pm2 logs chess-frontend"
echo "   pm2 status"
