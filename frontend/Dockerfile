FROM nginx:alpine
COPY nginx.conf /etc/nginx/nginx.conf
COPY index.html styles.css app.js api.js session.js /usr/share/nginx/html/
USER 101:101
EXPOSE 8080
ENTRYPOINT ["nginx", "-g", "daemon off;"]
