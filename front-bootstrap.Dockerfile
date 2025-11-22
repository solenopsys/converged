# Использовать официальный nginx образ
FROM nginx:alpine

# Создаем директории для кеша, логов и pid с правильными правами
RUN mkdir -p /var/cache/nginx /var/run/nginx /var/log/nginx \
    && chown -R 1000:1000 /var/cache/nginx /var/run/nginx /var/log/nginx \
    && chmod -R 755 /var/cache/nginx /var/run/nginx /var/log/nginx \
    && chown -R 1000:1000 /usr/share/nginx/html \
    && chmod -R 755 /usr/share/nginx/html

# Копируем файлы сайта
COPY --chown=1000:1000 front/front-bootstrap/dist/ /usr/share/nginx/html/

# Копируем нашу nginx конфигурацию
COPY front/front-bootstrap/confs/nginx.conf /etc/nginx/conf.d/default.conf

# Модифицируем основной конфиг nginx
RUN sed -i '/user  nginx;/d' /etc/nginx/nginx.conf \
    && sed -i 's!pid        /var/run/nginx.pid;!pid        /var/run/nginx/nginx.pid;!' /etc/nginx/nginx.conf

# Создаем pid файл и устанавливаем права
RUN touch /var/run/nginx/nginx.pid \
    && chown -R 1000:1000 /etc/nginx /var/run/nginx/nginx.pid \
    && chmod 666 /var/run/nginx/nginx.pid

# КРИТИЧНО: даем права на /run для непривилегированного пользователя
RUN chown -R 1000:1000 /run \
    && chmod -R 755 /run

# Открываем порт
EXPOSE 8080

# Запускаем от непривилегированного пользователя
USER 1000

# Настраиваем команду запуска
CMD ["nginx", "-g", "daemon off;"]
