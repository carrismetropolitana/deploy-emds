# # #

FROM nginx:alpine-slim

WORKDIR /app

# # #
# Copy the nginx configuration files.

COPY apps/nginx/configs/. /etc/nginx/.

# # #
# Make the container run the nginx server and reload it every 6 hours.

CMD ["/bin/sh", "-c", "while :; do sleep 6h & wait ${!}; nginx -s reload; done & nginx -g 'daemon off;'"]
