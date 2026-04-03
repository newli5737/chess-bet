#!/bin/bash
set -e 

NGINX_SITES="/etc/nginx/sites-available"
NGINX_ENABLED="/etc/nginx/sites-enabled"

echo "Copy nginx configs..."
sudo cp nginx/api-cotuong.linguagerman.com.conf  $NGINX_SITES/api-cotuong.linguagerman.com
sudo cp nginx/cotuong.linguagerman.com.conf      $NGINX_SITES/cotuong.linguagerman.com

echo "Enable sites..."
sudo ln -sf $NGINX_SITES/api-cotuong.linguagerman.com  $NGINX_ENABLED/api-cotuong.linguagerman.com
sudo ln -sf $NGINX_SITES/cotuong.linguagerman.com      $NGINX_ENABLED/cotuong.linguagerman.com

echo "Test nginx config..."
sudo nginx -t

echo "Reload nginx..."
sudo systemctl reload nginx

echo "Xin SSL certificate (certbot)..."
sudo certbot --nginx \
  -d api-cotuong.linguagerman.com \
  -d cotuong.linguagerman.com \
  --non-interactive \
  --agree-tos \
  --email admin@linguagerman.com \
  --redirect   

echo "Reload nginx lần cuối sau SSL..."
sudo systemctl reload nginx
