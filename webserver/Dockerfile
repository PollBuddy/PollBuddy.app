FROM nginx:stable-alpine-perl

# Install curl
RUN apk add --no-cache curl

# Bundle the NGINX config files
COPY nginx.conf /etc/nginx/nginx.conf
COPY conf.d /etc/nginx/conf.d

# Port
EXPOSE 80

# Health Check
HEALTHCHECK --interval=15s --timeout=3s CMD curl -f http://localhost || exit 1
