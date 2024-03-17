# specify the node base image with your desired version node:<version>
FROM node:14.15.0
WORKDIR /app
ADD . /app/
RUN npm install
EXPOSE 8080
