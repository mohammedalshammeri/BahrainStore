# نشر Bazar على Hostinger VPS

## المتطلبات
- Hostinger VPS (KVM 2 أو أعلى — الذاكرة 4GB على الأقل)  
- نظام Ubuntu 24.04 LTS  
- نطاق: bazar.bsmc.bh (أو نطاقك)

---

## 1. تجهيز الخادم

```bash
# تحديث النظام
sudo apt update && sudo apt upgrade -y

# تثبيت Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# تثبيت Docker Compose
sudo apt install -y docker-compose-plugin

# تثبيت Certbot لشهادات SSL
sudo apt install -y certbot
```

---

## 2. رفع الكود

```bash
# على الجهاز المحلي
git init   # إن لم يكن مشروعك في git
git add .
git commit -m "initial"

# على الخادم
git clone https://github.com/YOUR_ACCOUNT/YOUR_REPO.git /opt/bazar
cd /opt/bazar
```

أو يمكنك رفع الملفات عبر **Hostinger File Manager** أو `scp`.

---

## 3. ضبط المتغيرات

```bash
cd /opt/bazar
cp .env.example .env
nano .env   # عدّل DOMAIN و POSTGRES_PASSWORD و JWT_SECRET
```

---

## 4. إنشاء شهادات SSL

```bash
# شهادة للـ API والداشبورد
sudo certbot certonly --standalone -d api.bazar.bsmc.bh -d dashboard.bazar.bsmc.bh

# شهادة wildcard للمتاجر الفرعية (تحتاج DNS challenge)
sudo certbot certonly --manual --preferred-challenges dns -d "*.bazar.bsmc.bh"

# انسخ الشهادات إلى مجلد nginx
mkdir -p /opt/bazar/nginx/certs
sudo cp /etc/letsencrypt/live/api.bazar.bsmc.bh/fullchain.pem  nginx/certs/api.bazar.bsmc.bh.crt
sudo cp /etc/letsencrypt/live/api.bazar.bsmc.bh/privkey.pem    nginx/certs/api.bazar.bsmc.bh.key
sudo cp /etc/letsencrypt/live/dashboard.bazar.bsmc.bh/fullchain.pem  nginx/certs/dashboard.bazar.bsmc.bh.crt
sudo cp /etc/letsencrypt/live/dashboard.bazar.bsmc.bh/privkey.pem    nginx/certs/dashboard.bazar.bsmc.bh.key
sudo cp /etc/letsencrypt/live/*.bazar.bsmc.bh/fullchain.pem  nginx/certs/wildcard.bazar.bsmc.bh.crt
sudo cp /etc/letsencrypt/live/*.bazar.bsmc.bh/privkey.pem    nginx/certs/wildcard.bazar.bsmc.bh.key
```

---

## 5. DNS على Hostinger

في **Hostinger hPanel → Domains → DNS**، أضف:

| Type  | Name        | Value             |
|-------|-------------|-------------------|
| A     | @           | IP_الخادم         |
| A     | api         | IP_الخادم         |
| A     | dashboard   | IP_الخادم         |
| A     | *.bazar     | IP_الخادم         |

---

## 6. تشغيل المنصة

```bash
cd /opt/bazar
docker compose up -d --build

# تتبع السجلات
docker compose logs -f backend

# التحقق من تشغيل كل الخدمات
docker compose ps
```

---

## 7. تحديث المنصة لاحقاً

```bash
cd /opt/bazar
git pull
docker compose up -d --build
```

---

## ملاحظات
- مجلد `uploads/` محفوظ كـ Docker volume — لن تُفقد الصور عند إعادة البناء  
- قاعدة البيانات محفوظة في volume منفصل `pgdata`  
- شهادات Let's Encrypt تنتهي كل 90 يوماً. أضف مهمة cron:
  ```bash
  0 0 1 * * certbot renew --quiet && docker compose restart nginx
  ```
