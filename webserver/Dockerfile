FROM httpd:2.4

# Run on the standard webserver port
EXPOSE 80

# Install dos2unix (working around a Docker on Windows issue) and curl
RUN apt-get update -q \
        && apt-get upgrade -qy \
        && apt-get install -qy dos2unix curl procps

# Bundle the config file(s)
COPY httpd.conf /usr/local/apache2/conf/httpd.conf

# Fix potentially incorrect file endings
RUN dos2unix /usr/local/apache2/conf/httpd.conf

# Validate the config just in case
RUN apachectl configtest

# Health Check
HEALTHCHECK --interval=15s --timeout=3s CMD curl -f http://localhost || exit 1
