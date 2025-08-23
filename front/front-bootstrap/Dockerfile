
# Использовать официальный nginx образ
FROM nginx:alpine

# Создаем директории для кеша и логов с правильными правами доступа
RUN mkdir -p /var/cache/nginx /var/run/nginx /var/log/nginx \
    && chown -R 1000:1000 /var/cache/nginx /var/run/nginx /var/log/nginx \
    && chmod -R 755 /var/cache/nginx /var/run/nginx /var/log/nginx \
    && chown -R 1000:1000 /usr/share/nginx/html \
    && chmod -R 755 /usr/share/nginx/html

# Копируем файлы сайта
COPY --chown=1000:1000 ./dist/ /usr/share/nginx/html/

# Копируем нашу nginx конфигурацию
COPY confs/nginx.conf /etc/nginx/conf.d/default.conf

# Модифицируем основной конфиг nginx, чтобы убрать пользователя
RUN sed -i '/user  nginx;/d' /etc/nginx/nginx.conf \
    && sed -i 's!pid        /var/run/nginx.pid;!pid        /var/run/nginx/nginx.pid;!' /etc/nginx/nginx.conf

# Обновляем права доступа для конфигурационных файлов
RUN touch /var/run/nginx/nginx.pid \
    && chown -R 1000:1000 /etc/nginx /var/run/nginx/nginx.pid

# Открываем порт
EXPOSE 8080

# Запускаем от непривилегированного пользователя
USER 1000

# Настраиваем команду запуска
CMD ["nginx", "-g", "daemon off;"]